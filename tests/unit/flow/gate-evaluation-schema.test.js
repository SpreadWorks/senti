import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseGuardrailArticleEvaluation,
  parseImplRequirementEvaluation,
  EvaluationSchemaError,
} from "../../../src/flow/lib/run-gate.js";

// -----------------------------------------------------------------------------
// spec 255: split parser into article / requirement variants.
// Article variant: FAIL→violations[] / PASS|SKIP→reason.
// Requirement variant: legacy single-reason contract.
// -----------------------------------------------------------------------------

describe("parseGuardrailArticleEvaluation", () => {
  const known = ["g1", "g2"];

  it("parses well-formed PASS / FAIL payload (FAIL has violations[], PASS has reason)", () => {
    const resp = JSON.stringify({
      evaluations: [
        { guardrail_id: "g1", result: "pass", reason: "ok" },
        {
          guardrail_id: "g2",
          result: "fail",
          violations: [{ target: "vague phrase", where: "section A", why_violates: "no measurable criteria" }],
        },
      ],
    });
    const result = parseGuardrailArticleEvaluation(resp, known);
    assert.equal(result.length, 1);
    assert.equal(result[0].kind, "violation");
    assert.equal(result[0].requirementRef, "g2");
    assert.equal(result[0].observed, "no measurable criteria");
    assert.deepEqual(result[0].where, { file: "section A" });
  });

  it("strips code-fence wrappers before parsing", () => {
    const resp = "```json\n" + JSON.stringify({
      evaluations: [{ guardrail_id: "g1", result: "skip", reason: "n/a" }],
    }) + "\n```";
    const result = parseGuardrailArticleEvaluation(resp, ["g1"]);
    assert.equal(result.length, 0);
  });

  it("throws on non-JSON free text", () => {
    assert.throws(
      () => parseGuardrailArticleEvaluation("PASS: g1 — ok", known),
      EvaluationSchemaError,
    );
  });

  it("throws on unknown guardrail_id", () => {
    const resp = JSON.stringify({
      evaluations: [{ guardrail_id: "unknown", result: "pass", reason: "x" }],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(resp, known), /unknown|guardrail_id/i);
  });

  it("throws on duplicate guardrail_id", () => {
    const resp = JSON.stringify({
      evaluations: [
        { guardrail_id: "g1", result: "pass", reason: "a" },
        { guardrail_id: "g1", result: "pass", reason: "b" },
      ],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(resp, known), /duplicate|guardrail_id/i);
  });

  it("throws on invalid result value", () => {
    const resp = JSON.stringify({
      evaluations: [{ guardrail_id: "g1", result: "PASS", reason: "capitalized" }],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(resp, known), /result|pass|fail|skip/i);
  });

  it("throws when PASS entry omits reason", () => {
    const resp = JSON.stringify({
      evaluations: [{ guardrail_id: "g1", result: "pass" }],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(resp, ["g1"]), /reason/i);
  });

  it("throws when FAIL entry omits violations", () => {
    const resp = JSON.stringify({
      evaluations: [{ guardrail_id: "g1", result: "fail" }],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(resp, ["g1"]), /violations/i);
  });

  it("throws when PASS entry includes violations", () => {
    const resp = JSON.stringify({
      evaluations: [
        {
          guardrail_id: "g1",
          result: "pass",
          reason: "ok",
          violations: [{ target: "t", where: "w", why_violates: "y" }],
        },
      ],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(resp, ["g1"]), /violations/i);
  });

  it("throws on extra entry-level keys", () => {
    const resp = JSON.stringify({
      evaluations: [{ guardrail_id: "g1", result: "pass", reason: "ok", extra: 1 }],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(resp, ["g1"]), /unknown property/i);
  });
});

describe("parseImplRequirementEvaluation (legacy single-reason contract)", () => {
  const known = ["R1", "R2"];

  it("parses a well-formed JSON payload", () => {
    const resp = JSON.stringify({
      evaluations: [
        { guardrail_id: "R1", result: "pass", reason: "implemented" },
        { guardrail_id: "R2", result: "fail", reason: "missing in diff" },
      ],
    });
    const result = parseImplRequirementEvaluation(resp, known);
    assert.equal(result.length, 2);
    assert.equal(result[1].reason, "missing in diff");
  });

  it("strips code-fence wrappers before parsing", () => {
    const resp = "```json\n" + JSON.stringify({
      evaluations: [{ guardrail_id: "R1", result: "skip", reason: "n/a" }],
    }) + "\n```";
    const result = parseImplRequirementEvaluation(resp, ["R1"]);
    assert.equal(result.length, 1);
  });

  it("throws on malformed JSON", () => {
    assert.throws(() => parseImplRequirementEvaluation("{evaluations: not-json", known), EvaluationSchemaError);
  });

  it("throws when reason is missing", () => {
    const resp = JSON.stringify({ evaluations: [{ guardrail_id: "R1", result: "pass" }] });
    assert.throws(() => parseImplRequirementEvaluation(resp, ["R1"]), /reason/i);
  });

  it("throws on unknown id", () => {
    const resp = JSON.stringify({ evaluations: [{ guardrail_id: "unknown", result: "pass", reason: "x" }] });
    assert.throws(() => parseImplRequirementEvaluation(resp, known), /unknown|guardrail_id/i);
  });
});
