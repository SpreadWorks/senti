// spec: R13
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const CLI = path.join(REPO_ROOT, "src", "sdd-forge.js");

function runCLI(args) {
  return execSync(`node ${CLI} ${args}`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

describe("R13: flow get guardrail excludes phase=[] entries (markdown output)", () => {
  test("R13: flow get guardrail draft (markdown) does not include draft-scope-boundary", () => {
    const output = runCLI("flow get guardrail draft");
    assert.ok(
      !output.includes("draft-scope-boundary"),
      "draft-scope-boundary must not appear in markdown output (disabled via phase=[])",
    );
  });

  test("R13: flow get guardrail spec (markdown) does not include spec-synthesize-not-copy", () => {
    const output = runCLI("flow get guardrail spec");
    assert.ok(
      !output.includes("spec-synthesize-not-copy"),
      "spec-synthesize-not-copy must not appear in markdown output (disabled via phase=[])",
    );
  });
});

describe("R13: flow get guardrail excludes phase=[] entries (JSON output)", () => {
  test("R13: flow get guardrail draft --format json does not include draft-scope-boundary", () => {
    const output = runCLI("flow get guardrail draft --format json");
    const parsed = JSON.parse(output);
    const ids = (parsed?.data?.guardrails || parsed?.data?.entries || []).map((g) => g.id);
    assert.ok(
      !ids.includes("draft-scope-boundary"),
      `draft-scope-boundary must not appear in JSON output. Got ids: ${JSON.stringify(ids)}`,
    );
  });

  test("R13: flow get guardrail spec --format json does not include spec-synthesize-not-copy", () => {
    const output = runCLI("flow get guardrail spec --format json");
    const parsed = JSON.parse(output);
    const ids = (parsed?.data?.guardrails || parsed?.data?.entries || []).map((g) => g.id);
    assert.ok(
      !ids.includes("spec-synthesize-not-copy"),
      `spec-synthesize-not-copy must not appear in JSON output. Got ids: ${JSON.stringify(ids)}`,
    );
  });
});
