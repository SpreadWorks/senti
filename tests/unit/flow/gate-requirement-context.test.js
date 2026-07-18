import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_REQUIREMENT_CONTEXT_CHARS,
  MAX_REQUIREMENT_CONTEXT_ITEM_CHARS,
  MAX_REQUIREMENT_CONTEXT_ITEMS,
  RequirementGateBatch,
  buildImplCheckPrompt,
  buildRequirementGateContext,
  classifyRequirementObligation,
} from "../../../src/flow/lib/run-gate.js";

function specFixture() {
  return {
    scope: { in: [], out: ["Do not replace delegated behavior"] },
    constraints: ["Use the exact schema contract"],
    design_principles: ["R1 preserves `resultField`"],
    overview: {
      modules: [{ text: "R1 is owned by `src/result.js`" }],
      data_flow: [{ text: "R1 returns `resultField`" }],
      decisions: [{ text: "R1 schema field contract is `resultField`" }],
    },
    acceptance_criteria: ["AC1 (R1): preserve `resultField` unchanged"],
    implementationTargets: ["src/result.js"],
    tasks: [{
      id: "T-1",
      title: "Preserve result",
      goal: "Preserve R1 in `src/result.js`.",
      acceptance: ["R1 uses the exact field."],
      origin: "plan",
      added_round: 0,
      status: "pending",
    }],
  };
}

describe("requirement gate context", () => {
  it("renders linked sources with stable bounds and obligation semantics", () => {
    const requirement = { id: "R1", desc: "Preserve delegated `resultField` behavior", priority: "must" };
    const context = buildRequirementGateContext({
      spec: specFixture(),
      requirement,
      fileMap: { R1: ["src/result.js"] },
      relatedDiff: "+return { resultField };",
    });
    const text = context.toPromptText();
    assert.equal(context.obligation.kind, "preservation/non-interception");
    assert.match(text, /\[REQ:R1\]/);
    assert.match(text, /\[AC:1\]/);
    assert.match(text, /\[SCHEMA:DECISION:1:1\]/);
    assert.match(text, /\[FILE-MAP:R1:1\]/);
    assert.match(text, /\[EVIDENCE:R1\]/);
    assert.ok(text.length <= MAX_REQUIREMENT_CONTEXT_CHARS);
    assert.equal(MAX_REQUIREMENT_CONTEXT_ITEMS, 12);
    assert.equal(MAX_REQUIREMENT_CONTEXT_ITEM_CHARS, 1000);
  });

  it("counts rendered contexts toward batch and prompt identity", () => {
    const requirement = { id: "R1", desc: "Add `resultField` behavior", priority: "must" };
    const context = buildRequirementGateContext({
      spec: specFixture(),
      requirement,
      fileMap: { R1: ["src/result.js"] },
      relatedDiff: "+return { resultField };",
    });
    const diff = "x".repeat(120001 - context.toPromptText().length);
    const batch = new RequirementGateBatch({ requirements: [requirement], contexts: [context], diff });
    assert.equal(batch.promptCharCount, 120001);
    assert.equal(batch.overflow, true);
    const prompt = buildImplCheckPrompt({ contexts: [context], diff, knownIds: ["R1"] }).build();
    assert.match(prompt.userPrompt, /## Requirement Contexts/);
    assert.match(prompt.systemPrompt, /Every evaluation reason MUST cite \[REQ:<id>\]/);
  });

  it("uses matching acceptance criteria when classifying obligations", () => {
    assert.equal(classifyRequirementObligation(
      { id: "R1", desc: "Verify delegated routing" },
      ["AC1 (R1): no regression in existing routing"],
    ).kind, "regression-only");
    assert.equal(classifyRequirementObligation(
      { id: "R1", desc: "Verify delegated routing" },
      ["AC1 (R1): preserve the route unchanged"],
    ).kind, "preservation/non-interception");
  });
});
