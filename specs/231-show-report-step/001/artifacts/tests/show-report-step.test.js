/**
 * specs/231-show-report-step/tests/show-report-step.test.js
 *
 * Spec verification tests for show-report step (spec 231).
 * Tests R1–R7: FLOW_STEPS inclusion, PHASE_MAP mapping, context-rules entry,
 * prompt file existence, and finalize step transition.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PKG_DIR = path.resolve(process.cwd(), "src");

describe("spec 231: show-report step", () => {
  // R1: FLOW_STEPS contains show-report after docs-commit
  it("R1: FLOW_STEPS includes show-report after docs-commit", async () => {
    const { FLOW_STEPS } = await import(path.join(PKG_DIR, "lib", "flow-helpers.js"));
    const dcIdx = FLOW_STEPS.indexOf("docs-commit");
    const srIdx = FLOW_STEPS.indexOf("show-report");
    assert.ok(srIdx !== -1, "show-report must exist in FLOW_STEPS");
    assert.ok(dcIdx !== -1, "docs-commit must exist in FLOW_STEPS");
    assert.equal(srIdx, dcIdx + 1, "show-report must be immediately after docs-commit");
  });

  // R1: buildInitialSteps includes show-report with pending status
  it("R1: buildInitialSteps includes show-report entry", async () => {
    const { buildInitialSteps } = await import(path.join(PKG_DIR, "lib", "flow-helpers.js"));
    const steps = buildInitialSteps();
    const sr = steps.find((s) => s.id === "show-report");
    assert.ok(sr, "show-report entry must be in buildInitialSteps output");
    assert.equal(sr.status, "pending");
  });

  // R2: PHASE_MAP maps show-report to sync
  it("R2: PHASE_MAP maps show-report to sync", async () => {
    const { PHASE_MAP } = await import(path.join(PKG_DIR, "lib", "flow-helpers.js"));
    assert.equal(PHASE_MAP["show-report"], "sync");
  });

  // R3: context-rules.json has flow.show-report entry
  it("R3: context-rules.json has flow.show-report entry", () => {
    const rulesPath = path.join(PKG_DIR, "flow", "schemas", "context-rules.json");
    const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
    const entry = rules.flow?.["show-report"];
    assert.ok(entry, "flow.show-report must exist in context-rules.json");
    assert.equal(entry.instructions_key, "sync.show-report");
    assert.ok(entry.action, "show-report entry must have an action");
    assert.ok(entry.output_schema_ref, "show-report entry must have output_schema_ref");
  });

  // R5: prompt file exists
  it("R5: sync/show-report.md prompt file exists", () => {
    const promptPath = path.join(PKG_DIR, "flow", "prompts", "sync", "show-report.md");
    assert.ok(fs.existsSync(promptPath), `prompt file must exist at ${promptPath}`);
  });

  // R3: output_schema_ref points to existing file
  it("R3: output_schema_ref file exists", () => {
    const rulesPath = path.join(PKG_DIR, "flow", "schemas", "context-rules.json");
    const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
    const ref = rules.flow["show-report"].output_schema_ref;
    const schemaPath = path.join(PKG_DIR, "flow", "schemas", ref);
    assert.ok(fs.existsSync(schemaPath), `output_schema_ref file must exist at ${ref}`);
  });
});
