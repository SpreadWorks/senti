import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPassedGuardrails,
  findPreviousPassedGuardrails,
  applyFlipOverride,
} from "../../../src/flow/lib/run-gate.js";

// ---------------------------------------------------------------------------
// spec 228 T-2: PASS→FAIL flip detection and override
// ---------------------------------------------------------------------------

// REQ-4: buildPassedGuardrails helper
describe("REQ-4: buildPassedGuardrails", () => {
  it("extracts guardrail_ids with result 'pass'", () => {
    const evaluations = [
      { guardrail_id: "g1", result: "pass", reason: "ok" },
      { guardrail_id: "g2", result: "fail", reason: "bad" },
      { guardrail_id: "g3", result: "pass", reason: "fine" },
      { guardrail_id: "g4", result: "skip", reason: "n/a" },
    ];
    assert.deepEqual(buildPassedGuardrails(evaluations), ["g1", "g3"]);
  });

  it("returns empty array when no PASS evaluations", () => {
    const evaluations = [
      { guardrail_id: "g1", result: "fail", reason: "bad" },
    ];
    assert.deepEqual(buildPassedGuardrails(evaluations), []);
  });

  it("returns empty array for null/undefined input", () => {
    assert.deepEqual(buildPassedGuardrails(null), []);
    assert.deepEqual(buildPassedGuardrails(undefined), []);
  });
});

// REQ-5: findPreviousPassedGuardrails helper
describe("REQ-5: findPreviousPassedGuardrails", () => {
  it("returns passedGuardrails from the most recent same-phase entry", () => {
    const issueLog = {
      entries: [
        { phase: "draft", passedGuardrails: ["g-old"], headSha: "a", worktreeHash: "1" },
        { phase: "draft", passedGuardrails: ["g-new-1", "g-new-2"], headSha: "b", worktreeHash: "2" },
      ],
    };
    const result = findPreviousPassedGuardrails({ issueLog, phase: "draft" });
    assert.deepEqual(result.passedGuardrails, ["g-new-1", "g-new-2"]);
  });

  it("returns null when no entry has passedGuardrails", () => {
    const issueLog = {
      entries: [
        { phase: "draft", reason: "old style entry" },
      ],
    };
    assert.equal(findPreviousPassedGuardrails({ issueLog, phase: "draft" }), null);
  });

  it("ignores entries from other phases", () => {
    const issueLog = {
      entries: [
        { phase: "spec", passedGuardrails: ["g-spec"], headSha: "a", worktreeHash: "1" },
        { phase: "draft", passedGuardrails: ["g-draft"], headSha: "b", worktreeHash: "2" },
      ],
    };
    const result = findPreviousPassedGuardrails({ issueLog, phase: "draft" });
    assert.deepEqual(result.passedGuardrails, ["g-draft"]);
  });

  it("returns null for empty issue-log", () => {
    assert.equal(findPreviousPassedGuardrails({ issueLog: { entries: [] }, phase: "draft" }), null);
    assert.equal(findPreviousPassedGuardrails({ issueLog: null, phase: "draft" }), null);
  });
});

// REQ-5: applyFlipOverride
describe("REQ-5: applyFlipOverride", () => {
  it("overrides flipped guardrails to pass when git state matches", () => {
    const evaluations = [
      { guardrail_id: "g1", result: "fail", reason: "some issue" },
      { guardrail_id: "g2", result: "pass", reason: "ok" },
      { guardrail_id: "g3", result: "fail", reason: "another issue" },
    ];
    const previousEntry = {
      passedGuardrails: ["g1", "g2"],
      headSha: "aaa",
      worktreeHash: "111",
    };
    const currentState = { headSha: "aaa", worktreeHash: "111" };

    const result = applyFlipOverride({ evaluations, previousEntry, currentState, phase: "draft" });

    const g1 = result.find((e) => e.guardrail_id === "g1");
    assert.equal(g1.result, "pass");
    assert.match(g1.reason, /flip override/i);

    const g3 = result.find((e) => e.guardrail_id === "g3");
    assert.equal(g3.result, "fail");
  });

  it("does not override when git state differs", () => {
    const evaluations = [
      { guardrail_id: "g1", result: "fail", reason: "issue" },
    ];
    const previousEntry = {
      passedGuardrails: ["g1"],
      headSha: "aaa",
      worktreeHash: "111",
    };
    const currentState = { headSha: "aaa", worktreeHash: "222" };

    const result = applyFlipOverride({ evaluations, previousEntry, currentState, phase: "draft" });

    assert.equal(result.find((e) => e.guardrail_id === "g1").result, "fail");
  });

  it("does not override when previousEntry is null", () => {
    const evaluations = [
      { guardrail_id: "g1", result: "fail", reason: "issue" },
    ];
    const currentState = { headSha: "aaa", worktreeHash: "111" };

    const result = applyFlipOverride({ evaluations, previousEntry: null, currentState, phase: "draft" });

    assert.equal(result.find((e) => e.guardrail_id === "g1").result, "fail");
  });

  it("returns all-pass when all FAILs are flipped", () => {
    const evaluations = [
      { guardrail_id: "g1", result: "fail", reason: "issue" },
      { guardrail_id: "g2", result: "pass", reason: "ok" },
    ];
    const previousEntry = {
      passedGuardrails: ["g1", "g2"],
      headSha: "aaa",
      worktreeHash: "111",
    };
    const currentState = { headSha: "aaa", worktreeHash: "111" };

    const result = applyFlipOverride({ evaluations, previousEntry, currentState, phase: "draft" });

    assert.ok(result.every((e) => e.result === "pass" || e.result === "skip"));
  });

  it("does not override guardrails not in previousEntry.passedGuardrails", () => {
    const evaluations = [
      { guardrail_id: "g-new", result: "fail", reason: "new issue" },
    ];
    const previousEntry = {
      passedGuardrails: ["g-other"],
      headSha: "aaa",
      worktreeHash: "111",
    };
    const currentState = { headSha: "aaa", worktreeHash: "111" };

    const result = applyFlipOverride({ evaluations, previousEntry, currentState, phase: "draft" });

    assert.equal(result.find((e) => e.guardrail_id === "g-new").result, "fail");
  });
});
