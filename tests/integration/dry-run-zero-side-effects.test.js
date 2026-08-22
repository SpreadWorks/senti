import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../support/builders/tmp-dir.js";

const SENNEL = path.join(process.cwd(), "src/sennel.js");

function snapshotTree(root) {
  const snapshot = [];

  function visit(directory, relativeDirectory = "") {
    for (const name of fs.readdirSync(directory).sort()) {
      const relativePath = path.join(relativeDirectory, name);
      const absolutePath = path.join(directory, name);
      const stat = fs.lstatSync(absolutePath);
      if (stat.isDirectory()) {
        snapshot.push(`directory:${relativePath}`);
        visit(absolutePath, relativePath);
      } else if (stat.isSymbolicLink()) {
        snapshot.push(`symlink:${relativePath}:${fs.readlinkSync(absolutePath)}`);
      } else {
        snapshot.push(`file:${relativePath}:${fs.readFileSync(absolutePath).toString("base64")}`);
      }
    }
  }

  visit(root);
  return snapshot;
}

function runCommand(tmp, args, extraEnv = {}) {
  return spawnSync("node", [SENNEL, ...args], {
    cwd: tmp,
    encoding: "utf8",
    env: {
      ...process.env,
      SENNEL_SOURCE_ROOT: tmp,
      SENNEL_WORK_ROOT: tmp,
      ...extraEnv,
    },
  });
}

function assertZeroSideEffects(tmp, before, result, markerPath = null) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(snapshotTree(tmp), before, "dry-run must leave the project tree byte-identical");
  if (markerPath) {
    assert.equal(fs.existsSync(markerPath), false, "dry-run must not spawn the configured agent");
  }
}

function writeDocsFixture(tmp, { withAgent = false } = {}) {
  const markerPath = path.join(tmp, "agent-spawned");
  const config = {
    name: "dry-run-fixture",
    lang: "en",
    type: "base",
    docs: {
      languages: ["en"],
      defaultLanguage: "en",
      mode: "translate",
      style: { purpose: "developer-guide", tone: "formal" },
    },
  };
  if (withAgent) {
    config.agent = {
      default: "capture",
      providers: {
        capture: {
          command: "node",
          args: [
            "-e",
            "require('node:fs').writeFileSync(process.env.AGENT_MARKER,'called');process.stdout.write('[\\\"overview.md\\\"]');",
            "{{PROMPT}}",
          ],
        },
      },
    };
  }
  writeJson(tmp, ".sennel/config.json", config);
  writeJson(tmp, ".sennel/output/analysis.json", {
    analyzedAt: "2026-01-01T00:00:00.000Z",
    files: { entries: [], summary: { total: 0 } },
  });
  writeJson(tmp, "package.json", { name: "dry-run-fixture" });
  writeFile(tmp, "src/index.js", "export const value = 1;\n");
  return markerPath;
}

describe("dry-run zero-side-effect contract", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("setup renders a plan without registering or writing the project", () => {
    tmp = createTmpDir();
    const before = snapshotTree(tmp);
    const result = runCommand(tmp, [
      "setup",
      "--name", "dry-run-fixture",
      "--path", tmp,
      "--type", "base",
      "--purpose", "developer-guide",
      "--tone", "formal",
      "--lang", "en",
      "--dry-run",
    ]);

    assert.match(result.stdout, /DRY-RUN/);
    assertZeroSideEffects(tmp, before, result);
  });

  it("docs init renders a plan without creating docs or spawning an agent", () => {
    tmp = createTmpDir();
    const markerPath = writeDocsFixture(tmp, { withAgent: true });
    const before = snapshotTree(tmp);
    const result = runCommand(tmp, ["docs", "init", "--type", "base", "--dry-run"], {
      AGENT_MARKER: markerPath,
    });

    assert.match(result.stdout, /DRY-RUN/);
    assertZeroSideEffects(tmp, before, result, markerPath);
  });

  it("docs changelog renders a plan without creating its output directory", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    writeJson(tmp, "specs/001-dry-run/spec.json", {
      goal: "Dry-run fixture",
      scope: { in: ["Verify the plan"], out: [] },
    });
    const before = snapshotTree(tmp);
    const result = runCommand(tmp, ["docs", "changelog", "--dry-run"]);

    assert.match(result.stdout, /Change Log/);
    assertZeroSideEffects(tmp, before, result);
  });

  it("docs build renders its pipeline plan without writes or agent spawn", () => {
    tmp = createTmpDir();
    const markerPath = writeDocsFixture(tmp, { withAgent: true });
    const before = snapshotTree(tmp);
    const result = runCommand(tmp, ["docs", "build", "--dry-run"], {
      AGENT_MARKER: markerPath,
    });

    assert.match(result.stdout, /DRY-RUN/);
    assertZeroSideEffects(tmp, before, result, markerPath);
  });

  it("docs build still commits generated files outside dry-run", () => {
    tmp = createTmpDir();
    writeDocsFixture(tmp);
    const result = runCommand(tmp, ["docs", "build", "--force"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(fs.existsSync(path.join(tmp, ".sennel/output/analysis.json")));
    assert.ok(fs.readdirSync(path.join(tmp, "docs")).some((name) => name.endsWith(".md")));
    assert.ok(fs.existsSync(path.join(tmp, "AGENTS.md")));
  });
});
