// spec: R1 R2 R5 R6
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildImplReviewPrompt,
  formatImplReviewJson,
  loopProposalsToImplReviewJson,
  parseImplReviewFindings,
} from "../../../src/flow/commands/review.js";
import {
  parseProposalReviewOutput,
  parseSpecReviewOutput,
  parseTestReviewOutput,
  updateReviewRetryCounter,
} from "../../../src/flow/lib/run-review.js";
import {
  deriveAcceptanceReviewVerdict,
  validateAcceptanceReviewArtifact,
} from "../../../src/flow/lib/acceptance-review-artifacts.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

function finding(requirementId, overrides = {}) {
  return {
    title: "Finding",
    failureMode: "refactor",
    file: "src/example.js",
    requirementId,
    issue: "Observable issue.",
    suggestion: "Replace the affected branch.",
    rationale: "Requirement-scoped review evidence.",
    ...overrides,
  };
}

function implMetrics(verdict) {
  const metrics = [];
  updateReviewRetryCounter({
    phase: null,
    flowState: {},
    flowManager: {
      appendMetric(payload, options) {
        metrics.push({ payload, options });
      },
    },
  }, {
    artifacts: {
      phase: "impl",
      verdict,
      blockingCount: verdict === "FAIL" ? 1 : 0,
      nonBlockingCount: verdict === "ADVISORY" ? 1 : 0,
    },
  });
  return metrics;
}

describe("impl-review finding contract", () => {
  it("R1: exposes the target requirement IDs in both prompt and schema", () => {
    const prompt = buildImplReviewPrompt({
      requirementFileMap: { R1: ["src/example.js"], R2: ["src/example.js"] },
      requirementIds: new Set(["R1", "R2"]),
      touchedFiles: ["src/example.js"],
      diff: "diff",
    });
    for (const bucket of ["blockingFindings", "nonBlockingImprovements"]) {
      const itemSchema = prompt.jsonSchema.properties[bucket].items;
      assert.equal(itemSchema.properties.requirementId.type, "string");
      assert.equal(itemSchema.properties.requirementId.minLength, 1);
      assert.deepEqual(itemSchema.properties.requirementId.enum, ["R1", "R2"]);
      assert.equal(itemSchema.required.includes("requirementId"), true);
    }
    assert.match(`${prompt.systemPrompt}\n${prompt.userPrompt}`, /R1.*R2|R2.*R1/s);
    assert.doesNotMatch(`${prompt.systemPrompt}\n${prompt.userPrompt}`, /null for .*requirementId/i);
  });

  it("R2: rejects missing, null, empty, and unknown requirement IDs", () => {
    const requirementIds = new Set(["R2"]);
    const parse = (bucket, item) => parseImplReviewFindings(JSON.stringify({
      blockingFindings: bucket === "blockingFindings" ? [item] : [],
      nonBlockingImprovements: bucket === "nonBlockingImprovements" ? [item] : [],
    }), { requirementIds });

    assert.equal(parse("nonBlockingImprovements", finding("R2")).nonBlockingImprovements[0].requirementId, "R2");
    assert.throws(
      () => parseImplReviewFindings("[]", { requirementIds }),
      /schema/i,
      "legacy top-level arrays are not valid impl-review response objects",
    );
    for (const bucket of ["blockingFindings", "nonBlockingImprovements"]) {
      const failureMode = bucket === "blockingFindings" ? "spec_behavior_contradiction" : "refactor";
      for (const invalidId of [undefined, null, "", "R404"]) {
        assert.throws(
          () => parse(bucket, finding(invalidId, { failureMode })),
          /requirementId|schema/i,
          `${bucket} must reject ${String(invalidId)}`,
        );
      }
    }
  });

  it("R5: preserves valid PASS, ADVISORY, and FAIL lifecycle accounting", () => {
    const prompt = buildImplReviewPrompt({ requirementIds: new Set(["R5"]) });
    assert.deepEqual(
      prompt.jsonSchema.properties.blockingFindings.items.properties.requirementId.enum,
      ["R5"],
    );

    assert.equal(JSON.parse(formatImplReviewJson({ blockingFindings: [], nonBlockingImprovements: [] })).verdict, "PASS");
    assert.equal(JSON.parse(formatImplReviewJson({
      blockingFindings: [],
      nonBlockingImprovements: [finding("R5")],
    })).verdict, "ADVISORY");
    assert.equal(JSON.parse(formatImplReviewJson({
      blockingFindings: [finding("R5", { failureMode: "spec_behavior_contradiction" })],
      nonBlockingImprovements: [],
    })).verdict, "FAIL");

    assert.deepEqual(implMetrics("PASS")[0].payload, { phase: "impl", counter: "reviewRetry", delta: 0, reset: true });
    assert.deepEqual(implMetrics("ADVISORY")[0].payload, { phase: "impl", counter: "reviewRetry", delta: 0, reset: true });
    assert.deepEqual(implMetrics("FAIL")[0].payload, { phase: "impl", counter: "reviewRetry", delta: 1 });
  });

  it("R6: leaves spec and test review parser contracts unchanged", () => {
    const implPrompt = buildImplReviewPrompt({ requirementIds: new Set(["R6"]) });
    assert.deepEqual(
      implPrompt.jsonSchema.properties.nonBlockingImprovements.items.properties.requirementId.enum,
      ["R6"],
    );
    const loopOutput = JSON.parse(loopProposalsToImplReviewJson([{
      title: "Known loop finding",
      body: "Requirement-scoped loop finding.",
      file: "src/example.js",
      requirementId: "R6",
    }], new Set(["R6"])));
    assert.equal(loopOutput.nonBlockingImprovements[0].requirementId, "R6");
    assert.throws(() => loopProposalsToImplReviewJson([{
      title: "Unscoped loop finding",
      body: "Missing requirement context.",
      file: "src/example.js",
    }], new Set(["R6"])), /invalid requirementId/i);

    const specResult = parseSpecReviewOutput(
      { ok: true },
      "Spec review ADVISORY.",
      "[spec-review] verdict=ADVISORY proposalCount=1",
    );
    const testResult = parseTestReviewOutput(
      { ok: true },
      "Test review ADVISORY.",
      "[test-review] verdict=ADVISORY blocking=0 advisory=1",
    );
    const draftResult = parseProposalReviewOutput(
      { ok: true },
      "Draft review PASS.",
      "[draft-review-coverage] verdict=PASS findings=0 retryPhase=draft-coverage",
    );
    const acceptanceArtifact = {
      version: 1,
      goalSatisfactionScore: 1,
      requirementAlignmentScore: 1,
      implementationQualityScore: 1,
      acceptanceScore: 1,
      thresholds: {
        goalSatisfactionPass: 0.9,
        requirementAlignmentPass: 0.9,
        implementationQualityPass: 0.9,
      },
      mechanicalBlockers: [],
      hardBlockers: [],
      attempt: 1,
      findings: [],
      requirementAmendmentProposals: [],
      userDecision: null,
      blockedDecision: null,
      verdict: "pass",
    };
    assert.equal(specResult.next, "spec-gate");
    assert.equal(testResult.next, "implement");
    assert.equal(draftResult.next, "draft-gate");
    assert.equal(validateAcceptanceReviewArtifact(acceptanceArtifact), acceptanceArtifact);
    assert.equal(deriveAcceptanceReviewVerdict(acceptanceArtifact), "pass");
    assert.equal(typeof FLOW_COMMANDS.run["acceptance-review"].command, "function");
  });
});
