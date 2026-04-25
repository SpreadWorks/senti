import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkSpecJson } from "../../../src/flow/lib/run-gate.js";

function makeValidSpec() {
  return {
    goal: "Some goal",
    requirements: [{ id: "REQ-1", desc: "Something" }],
    acceptance_criteria: ["Criterion 1"],
    tasks: [{ id: "T-1", parent: null }],
  };
}

describe("checkSpecJson — empty-field sanity checks (spec 228)", () => {
  it("REQ-1: reports issue when goal is empty string", () => {
    const spec = { ...makeValidSpec(), goal: "" };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /goal/.test(i) && /empty/.test(i)));
  });

  it("REQ-1: reports issue when goal is whitespace-only", () => {
    const spec = { ...makeValidSpec(), goal: "   " };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /goal/.test(i) && /empty/.test(i)));
  });

  it("REQ-2: reports issue when requirements is empty array", () => {
    const spec = { ...makeValidSpec(), requirements: [] };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /requirements/.test(i) && /empty/.test(i)));
  });

  it("REQ-3: reports issue when acceptance_criteria is empty array", () => {
    const spec = { ...makeValidSpec(), acceptance_criteria: [] };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /acceptance_criteria/.test(i) && /empty/.test(i)));
  });

  it("REQ-4: returns no sanity issues when all fields are non-empty", () => {
    const spec = makeValidSpec();
    const issues = checkSpecJson(spec);
    const sanityIssues = issues.filter(
      (i) => /goal/.test(i) || /requirements.*empty/.test(i) || /acceptance_criteria.*empty/.test(i),
    );
    assert.equal(sanityIssues.length, 0);
  });

  it("reports multiple issues when all three fields are empty", () => {
    const spec = {
      ...makeValidSpec(),
      goal: "",
      requirements: [],
      acceptance_criteria: [],
    };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /goal/.test(i)));
    assert.ok(issues.some((i) => /requirements/.test(i)));
    assert.ok(issues.some((i) => /acceptance_criteria/.test(i)));
  });
});
