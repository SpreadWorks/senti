import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatSpecReviewJson } from "../../../src/flow/commands/review.js";
import { validateSpecTriageDocument } from "../../../src/flow/lib/spec-review-artifacts.js";

function blockingFinding(title, target) {
  return {
    title,
    target,
    issue: `${title} is missing from the specification.`,
    requiredChange: `Add the ${target} correction.`,
    whyBlocking: "The implementation and its acceptance test cannot be completed safely.",
  };
}

function permission(target, operationKinds = ["replace-entity-field"]) {
  return {
    target,
    operationKinds,
  };
}

function triageItem(finding, decision = "apply") {
  const target = { entity: "requirement", id: finding.target, field: "desc" };
  return {
    findingId: finding.findingId,
    title: finding.title,
    target: finding.target,
    decision,
    rationale: "The finding remains a concrete and bounded correction.",
    evidence: "The immutable spec snapshot lacks the required correction.",
    ...(decision === "apply" ? {
      allowedTargets: [permission(target)],
      requiredTargets: [target],
    } : {}),
  };
}

function reviewAndTriage() {
  const review = JSON.parse(formatSpecReviewJson({
    verdict: "REJECTED",
    blocking: [
      blockingFinding("First correction", "R1"),
      blockingFinding("Second correction", "R2"),
    ],
    improvements: [{
      title: "Advisory context",
      target: "GLOBAL",
      improvement: "Document nearby context.",
      whyNonBlocking: "Implementation can proceed without it.",
    }],
  }));
  const triage = {
    version: 1,
    phase: "spec-triage",
    sourceReview: "spec-review.json",
    summary: "Apply bounded corrections.",
    items: review.blockingFindings.map((finding) => triageItem(finding)),
  };
  return { review, triage };
}

describe("spec review to triage stable finding contract", () => {
  it("emits deterministic IDs for blocking and advisory findings independent of list order", () => {
    const first = JSON.parse(formatSpecReviewJson({
      verdict: "REJECTED",
      blocking: [blockingFinding("First correction", "R1"), blockingFinding("Second correction", "R2")],
      improvements: [{
        title: "Advisory context",
        target: "GLOBAL",
        improvement: "Document nearby context.",
        whyNonBlocking: "Implementation can proceed without it.",
      }],
    }));
    const reordered = JSON.parse(formatSpecReviewJson({
      verdict: "REJECTED",
      blocking: [blockingFinding("Second correction", "R2"), blockingFinding("First correction", "R1")],
      improvements: [{
        title: "Advisory context",
        target: "GLOBAL",
        improvement: "Document nearby context.",
        whyNonBlocking: "Implementation can proceed without it.",
      }],
    }));
    const ids = (document) => new Map([
      ...document.blockingFindings,
      ...document.nonBlockingImprovements,
    ].map((finding) => [finding.title, finding.findingId]));
    assert.deepEqual(ids(first), ids(reordered));
    const reloaded = JSON.parse(formatSpecReviewJson({
      verdict: first.verdict,
      blocking: first.blockingFindings,
      improvements: first.nonBlockingImprovements,
    }));
    assert.deepEqual(ids(first), ids(reloaded));
    assert.ok(first.blockingFindings.every((finding) => finding.findingId.startsWith("spec-review-")));
    assert.ok(first.nonBlockingImprovements[0].findingId.startsWith("spec-review-"));
  });

  it("accepts triage in a different order by matching the complete finding ID set", () => {
    const { review, triage } = reviewAndTriage();
    triage.items.reverse();
    const artifact = validateSpecTriageDocument({ review, triage });
    assert.deepEqual(artifact.items.map((item) => item.findingId), [
      review.blockingFindings[1].findingId,
      review.blockingFindings[0].findingId,
    ]);
  });

  it("rejects unknown and duplicate triage finding IDs", () => {
    const unknown = reviewAndTriage();
    unknown.triage.items[0].findingId = "spec-review-unknown";
    assert.throws(() => validateSpecTriageDocument(unknown), /identify exactly one canonical blocking finding/);

    const duplicate = reviewAndTriage();
    duplicate.triage.items[1].findingId = duplicate.triage.items[0].findingId;
    assert.throws(() => validateSpecTriageDocument(duplicate), /must not duplicate another triage item/);
  });

  it("rejects missing and duplicate canonical blocking finding IDs", () => {
    const missing = reviewAndTriage();
    delete missing.review.blockingFindings[0].findingId;
    assert.throws(() => validateSpecTriageDocument(missing), /requires a stable findingId/);

    assert.throws(() => formatSpecReviewJson({
      verdict: "REJECTED",
      blocking: [
        { ...blockingFinding("Same", "R1"), findingId: "duplicate" },
        { ...blockingFinding("Same", "R1"), findingId: "duplicate" },
      ],
    }), /must not duplicate findingId/);

    const duplicateHandoffReview = reviewAndTriage();
    duplicateHandoffReview.review.blockingFindings[1].findingId =
      duplicateHandoffReview.review.blockingFindings[0].findingId;
    assert.throws(() => validateSpecTriageDocument(duplicateHandoffReview), /blocking findings must not duplicate findingId/);

    assert.throws(() => formatSpecReviewJson({
      verdict: "REJECTED",
      blocking: [{ ...blockingFinding("Blocking", "R1"), findingId: "cross-bucket" }],
      improvements: [{
        title: "Advisory",
        target: "GLOBAL",
        improvement: "Document context.",
        whyNonBlocking: "Implementation can proceed.",
        findingId: "cross-bucket",
      }],
    }), /must not duplicate findingId/);
  });
});
