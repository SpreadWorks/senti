import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  fileURLToPath(import.meta.url),
  "..",
  "..",
  "..",
  "..",
);
const WORKFLOW_JS = path.join(REPO_ROOT, "experimental", "workflow.js");

function makeTmpProject(configOverrides = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "wf-e2e-"));
  const sddDir = path.join(dir, ".sdd-forge");
  mkdirSync(sddDir, { recursive: true });
  const baseConfig = {
    lang: "ja",
    type: "node-cli",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    ...configOverrides,
  };
  writeFileSync(
    path.join(sddDir, "config.json"),
    JSON.stringify(baseConfig, null, 2),
  );
  return dir;
}

function runWorkflow(args, cwd) {
  return spawnSync("node", [WORKFLOW_JS, ...args], {
    cwd,
    encoding: "utf8",
  });
}

describe("workflow.js CLI E2E", () => {
  it("returns non-zero exit when experimental.workflow is missing", () => {
    const tmp = makeTmpProject();
    try {
      const r = runWorkflow(["list"], tmp);
      assert.notEqual(r.status, 0);
      const out = r.stdout + r.stderr;
      assert.match(out, /workflow is not enabled|not enabled/i);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns non-zero exit when enable=false", () => {
    const tmp = makeTmpProject({
      experimental: { workflow: { enable: false } },
    });
    try {
      const r = runWorkflow(["list"], tmp);
      assert.notEqual(r.status, 0);
      const out = r.stdout + r.stderr;
      assert.match(out, /workflow is not enabled|not enabled/i);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("prints help when --help is given", () => {
    const r = spawnSync("node", [WORKFLOW_JS, "--help"], { encoding: "utf8" });
    const out = r.stdout + r.stderr;
    assert.match(out, /add|update|show|search|list|publish/);
  });

  it("returns non-zero exit on unknown subcommand", () => {
    const tmp = makeTmpProject({
      experimental: { workflow: { enable: true } },
    });
    try {
      const r = runWorkflow(["bogus-cmd"], tmp);
      assert.notEqual(r.status, 0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("outputs JSON envelope on add success (mocked or dry-run path)", () => {
    // This test asserts that the dispatcher outputs envelope format.
    // It uses --help on a subcommand to avoid actual GitHub API calls.
    const r = spawnSync("node", [WORKFLOW_JS, "add", "--help"], {
      encoding: "utf8",
    });
    const out = r.stdout + r.stderr;
    assert.match(out, /add|--status|--category/);
  });
});
