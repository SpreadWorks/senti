/**
 * tests/unit/flow/flow-run-draft-task-prompt.test.js
 *
 * Spec: 199-draft-task-production-wiring.
 *
 * Tests the exported buildDraftPrompt(task, context, reasons) contract:
 *  - REQ-P4: reasons argument controls whether a "## Previous attempt failed — reasons"
 *    section is injected into the prompt.
 *  - initial call (reasons=null) and retry call (reasons=[...]) differ only by that
 *    section.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDraftPrompt } from "../../../src/flow/lib/run-draft-task.js";

const task = { id: "T-1", title: "sample addition task" };
const context = {
  parentSpec: "# parent\n## Goal\nparent goal\n",
  siblingTasks: [],
  request: "make it work",
};

describe("buildDraftPrompt(task, context, reasons)", () => {
  it("is exported from run-draft-task.js", () => {
    assert.equal(typeof buildDraftPrompt, "function");
  });

  it("does not include the 'Previous attempt failed' section on the initial call (reasons=null)", () => {
    const prompt = buildDraftPrompt(task, context, null);
    assert.equal(typeof prompt, "string");
    assert.ok(prompt.length > 0);
    assert.ok(!/Previous attempt failed/.test(prompt),
      "initial prompt must not contain the retry feedback section");
  });

  it("also omits the section when reasons is an empty array", () => {
    const prompt = buildDraftPrompt(task, context, []);
    assert.ok(!/Previous attempt failed/.test(prompt));
  });

  it("injects the 'Previous attempt failed — reasons' section when reasons are provided", () => {
    const reasons = [
      { verdict: "FAIL", guardrail_id: "complete-context", detail: "missing trigger condition" },
      { verdict: "PASS", guardrail_id: "unambiguous-requirements", detail: "ok" },
      { verdict: "FAIL", guardrail_id: "draft-scope-boundary", detail: "too much impl detail" },
    ];
    const prompt = buildDraftPrompt(task, context, reasons);
    assert.ok(/## Previous attempt failed — reasons/.test(prompt),
      "retry prompt must include the dedicated section heading");
    assert.ok(/complete-context/.test(prompt), "FAIL guardrail_id must appear in retry prompt");
    assert.ok(/missing trigger condition/.test(prompt), "FAIL detail must appear in retry prompt");
    assert.ok(/draft-scope-boundary/.test(prompt), "other FAIL entry must also appear");
  });

  it("filters out non-FAIL verdicts from the injected section", () => {
    const reasons = [
      { verdict: "PASS", guardrail_id: "single-responsibility", detail: "focused spec" },
      { verdict: "SKIP", guardrail_id: "spec-synthesize-not-copy", detail: "cannot verify" },
    ];
    const prompt = buildDraftPrompt(task, context, reasons);
    assert.ok(!/Previous attempt failed/.test(prompt),
      "when no FAIL entries exist, the section must not be added");
  });

  it("produces identical prompts apart from the retry feedback section", () => {
    const initial = buildDraftPrompt(task, context, null);
    const retry = buildDraftPrompt(task, context, [
      { verdict: "FAIL", guardrail_id: "x", detail: "y" },
    ]);
    const retryWithoutSection = retry.replace(/## Previous attempt failed — reasons[\s\S]*?(?=\n## |$)/, "");
    assert.equal(retryWithoutSection.trim(), initial.trim(),
      "retry prompt must differ from initial only by the dedicated section");
  });
});
