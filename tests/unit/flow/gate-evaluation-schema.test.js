import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GUARDRAIL_ARTICLE_EVAL_SCHEMA,
  RequirementGateBatch,
  SameSpecContractContext,
  buildGuardrailArticleEvalPrompt,
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

  it("accepts structured observations with null locator", () => {
    const resp = JSON.stringify({
      observations: [{
        failureMode: "guardrail-violation",
        requirementRef: "g1",
        where: { file: "spec.json", locator: null },
        observed: "missing required section",
      }],
    });
    const result = parseGuardrailArticleEvaluation(resp, ["g1"]);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].where, { file: "spec.json" });
  });

  it("uses a strict-compatible schema for observation locations", () => {
    const whereObject = GUARDRAIL_ARTICLE_EVAL_SCHEMA
      .properties.observations.items.properties.where;
    assert.deepEqual(whereObject.type, ["object", "null"]);
    assert.deepEqual([...whereObject.required].sort(), Object.keys(whereObject.properties).sort());
    assert.deepEqual(whereObject.properties.locator.type, ["string", "null"]);
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
    assert.throws(
      () => parseGuardrailArticleEvaluation(resp, known),
      (err) => {
        assert.match(err.message, /unknown|guardrail_id/i);
        assert.equal(err.data.locator, "evaluations[0].guardrail_id");
        assert.equal(err.data.invalidValue, "unknown");
        return true;
      },
    );
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
    assert.throws(
      () => parseImplRequirementEvaluation(resp, known),
      (err) => {
        assert.match(err.message, /unknown|guardrail_id/i);
        assert.equal(err.data.locator, "evaluations[0].guardrail_id");
        assert.equal(err.data.invalidValue, "unknown");
        assert.equal(err.data.primary, true);
        return true;
      },
    );
  });
});

describe("invocation-specific gate output schemas", () => {
  it("enumerates exact guardrail IDs in schema and fallback", () => {
    const built = buildGuardrailArticleEvalPrompt("target", [
      { id: "g1", title: "G1", body: "Check G1.", meta: { category: "test" } },
      { id: "g2", title: "G2", body: "Check G2.", meta: { category: "test" } },
    ], "spec").build();
    assert.deepEqual(
      built.jsonSchema.properties.observations.items.properties.requirementRef.enum,
      ["g1", "g2"],
    );
    assert.match(built.fmtFallback, /Allowed IDs \(exact match only\): g1, g2/);
  });

  it("enumerates exact implementation requirement IDs in schema and fallback", () => {
    const built = new RequirementGateBatch({
      requirements: [
        { id: "R1", desc: "Implement one." },
        { id: "R2", desc: "Implement two." },
      ],
      diff: "diff --git a/a.js b/a.js\n+change\n",
    }).buildPrompt().build();
    assert.deepEqual(
      built.jsonSchema.properties.evaluations.items.properties.guardrail_id.enum,
      ["R1", "R2"],
    );
    assert.match(built.fmtFallback, /Allowed IDs \(exact match only\): R1, R2/);
  });

  it("adds same-spec context without changing the implementation evaluation schema", () => {
    const spec = {
      requirements: [
        { id: "R1", desc: "Define current output." },
        { id: "R2", desc: "Preserve R1." },
      ],
      overview: {
        decisions: [{
          text: "R1 replaces the legacy output.",
          evidence: "current schema",
          consideredAlternatives: "legacy output",
        }],
      },
      clarifications: [{ q: "Is legacy output valid?", a: "No." }],
    };
    const baseline = new RequirementGateBatch({
      requirements: [spec.requirements[1]],
      diff: "diff --git a/a.js b/a.js\n+change\n",
    }).buildPrompt().build();
    const integration = new RequirementGateBatch({
      requirements: [spec.requirements[1]],
      diff: "diff --git a/a.js b/a.js\n+change\n",
      structuredSpec: spec,
    }).buildPrompt().build();

    assert.ok(integration.userPrompt.includes("## Same-Spec Contract Context"));
    assert.ok(integration.userPrompt.includes("requirements[0] R1: Define current output."));
    assert.ok(integration.userPrompt.includes("overview.decisions[0]"));
    assert.ok(integration.userPrompt.includes("clarifications[0]"));
    assert.deepEqual(integration.jsonSchema, baseline.jsonSchema);
    assert.equal(integration.fmtFallback, baseline.fmtFallback);
    assert.ok(new SameSpecContractContext({ spec, currentRequirementIds: ["R2"] }));
  });
});
