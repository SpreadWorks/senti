/**
 * specs/215-remove-merge-strategy-arg/tests/no-merge-strategy-arg.test.js
 *
 * Verifies that the `--merge-strategy` escape hatch has been fully removed:
 *   R1: CLI finalize does not accept the argument (registry lists no such option).
 *   R5: user-facing skill / prompt templates mention no `--merge-strategy`.
 *   R6: the enum constant and its import are gone from src/.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import fs from "node:fs";
import path from "node:path";
import { readFileSync } from "node:fs";

const ROOT = process.cwd();
const FLOW_CMD = path.join(ROOT, "src/flow.js");

function grepFile(file, pattern) {
  const content = readFileSync(file, "utf8");
  return pattern.test(content);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

describe("R1: finalize does not accept --merge-strategy", () => {
  it("registry has no --merge-strategy option anywhere", () => {
    const registry = readFileSync(path.join(ROOT, "src/flow/registry.js"), "utf8");
    assert.ok(
      !/--merge-strategy/.test(registry),
      "registry.js must not mention --merge-strategy",
    );
  });

  it("finalize --help does not advertise --merge-strategy", () => {
    const output = execFileSync("node", [FLOW_CMD, "run", "finalize", "--help"], {
      encoding: "utf8",
      env: { ...process.env },
    });
    assert.ok(
      !/--merge-strategy/.test(output),
      `finalize --help must not mention --merge-strategy: ${output}`,
    );
  });
});

describe("R5: skill / prompt templates mention no --merge-strategy", () => {
  it("src/templates/skills/sdd-forge.flow/SKILL.md is clean", () => {
    const file = path.join(ROOT, "src/templates/skills/sdd-forge.flow/SKILL.md");
    assert.ok(fs.existsSync(file), `${file} should exist`);
    assert.ok(
      !grepFile(file, /--merge-strategy/),
      `SKILL.md must not contain --merge-strategy`,
    );
  });

  it("src/flow/prompts/ files mention no --merge-strategy", () => {
    const promptsDir = path.join(ROOT, "src/flow/prompts");
    for (const file of walk(promptsDir)) {
      assert.ok(
        !grepFile(file, /--merge-strategy/),
        `${file} must not contain --merge-strategy`,
      );
    }
  });
});

describe("R6: VALID_MERGE_STRATEGIES constant and its imports are gone", () => {
  it("src/lib/constants.js does not export VALID_MERGE_STRATEGIES", () => {
    const constants = readFileSync(path.join(ROOT, "src/lib/constants.js"), "utf8");
    assert.ok(
      !/VALID_MERGE_STRATEGIES/.test(constants),
      "VALID_MERGE_STRATEGIES definition must be removed from constants.js",
    );
  });

  it("no src/ file imports or references VALID_MERGE_STRATEGIES", () => {
    const srcDir = path.join(ROOT, "src");
    for (const file of walk(srcDir)) {
      if (!file.endsWith(".js") && !file.endsWith(".md")) continue;
      assert.ok(
        !grepFile(file, /VALID_MERGE_STRATEGIES/),
        `${file} must not reference VALID_MERGE_STRATEGIES`,
      );
    }
  });
});

describe("R3: finalize.merge-strategy prompt is removed", () => {
  it("get prompt finalize.merge-strategy returns unknown kind error", () => {
    try {
      execFileSync("node", [FLOW_CMD, "get", "prompt", "finalize.merge-strategy"], {
        encoding: "utf8",
        env: { ...process.env },
      });
      assert.fail("finalize.merge-strategy should no longer be a known prompt kind");
    } catch (err) {
      const stdout = err.stdout?.toString() || "";
      const envelope = JSON.parse(stdout);
      assert.equal(envelope.ok, false);
      assert.ok(
        envelope.errors[0].messages[0].includes("unknown kind"),
        `error should mention unknown kind: ${envelope.errors[0].messages[0]}`,
      );
    }
  });
});
