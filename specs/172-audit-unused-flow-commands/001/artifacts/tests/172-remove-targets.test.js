/**
 * Spec 172: Verify remove targets are deleted.
 *
 * R1: --confirm-skip-guardrail flag removed from registry and logic removed from run-gate
 * R2: redo removed from VALID_METRIC_COUNTERS
 * R3: redoCount removed from token.js DIFFICULTY_BASELINES and difficulty calculation
 * R4: AGENTS.md directory tree does not list redo under set/
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

describe("172: remove targets", () => {
  it("R1: registry.js shall not define --confirm-skip-guardrail flag", () => {
    const content = fs.readFileSync(path.join(ROOT, "src/flow/registry.js"), "utf8");
    assert.ok(
      !content.includes("confirm-skip-guardrail"),
      "registry.js still references confirm-skip-guardrail",
    );
  });

  it("R1: run-gate.js shall not contain confirm-skip-guardrail safety-check logic", () => {
    const content = fs.readFileSync(path.join(ROOT, "src/flow/lib/run-gate.js"), "utf8");
    assert.ok(
      !content.includes("confirmSkipGuardrail"),
      "run-gate.js still references confirmSkipGuardrail",
    );
  });

  it("R2: VALID_METRIC_COUNTERS shall not include redo", () => {
    const content = fs.readFileSync(path.join(ROOT, "src/lib/constants.js"), "utf8");
    const match = content.match(/VALID_METRIC_COUNTERS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
    assert.ok(match, "VALID_METRIC_COUNTERS not found");
    const counters = match[1];
    assert.ok(!counters.includes('"redo"'), "redo is still in VALID_METRIC_COUNTERS");
  });

  it("R3: token.js DIFFICULTY_BASELINES shall not include redoCount", () => {
    const content = fs.readFileSync(path.join(ROOT, "src/metrics/commands/token.js"), "utf8");
    assert.ok(
      !content.includes("redoCount"),
      "token.js still references redoCount",
    );
  });

  it("R4: AGENTS.md directory tree shall not list redo under set/", () => {
    const agentsPath = path.join(ROOT, "src/AGENTS.md");
    if (!fs.existsSync(agentsPath)) return; // AGENTS.md is auto-generated
    const content = fs.readFileSync(agentsPath, "utf8");
    // Match the set/ line in the directory tree
    const setLine = content.match(/set\/\s+.*/);
    if (setLine) {
      assert.ok(
        !setLine[0].includes("redo"),
        `AGENTS.md set/ line still lists redo: ${setLine[0]}`,
      );
    }
  });
});
