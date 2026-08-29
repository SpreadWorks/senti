import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CanonicalSpecReview,
  SpecReviewDelta,
  mergeSpecReviewDelta,
} from "../../../src/flow/lib/spec-review-artifacts.js";

const IDENTITY = {
  specId: "001-canonical-review",
  revision: 1,
  digest: "a".repeat(64),
  byteLength: 321,
};

function emptyReview() {
  return new CanonicalSpecReview({
    version: 2,
    identity: IDENTITY,
    generation: 0,
    findings: [],
    audit: [],
  });
}

function delta(review, stage, findings, operations = []) {
  return new SpecReviewDelta({
    version: 2,
    stage,
    identity: IDENTITY,
    baseReviewDigest: review.digest,
    findings,
    operations,
  });
}

function finding(findingId, { title = "Clarify requirement", ...extra } = {}) {
  return {
    kind: "blocking", findingId, title, target: "R1", body: "The requirement is incomplete.",
    issue: "Required behavior is missing.", requiredChange: "State the behavior.",
    whyBlocking: "Implementation has no observable basis.", ...extra,
  };
}

function triageUpdate(findingId, disposition, extra = {}) {
  return { findingId, disposition, evidence: "Checked against the immutable snapshot.", ...extra };
}

describe("revision-scoped canonical spec review", () => {
  it("uses one canonical review for review, triage, and repair", () => {
    const initial = emptyReview();
    const reviewed = mergeSpecReviewDelta({
      review: initial,
      delta: delta(initial, "spec-review", [
        finding("F-1", { title: "Clarify R1" }),
        finding("F-2", { title: "Clarify scope" }),
      ]),
    });
    const triaged = mergeSpecReviewDelta({
      review: reviewed,
      delta: delta(reviewed, "spec-triage", [triageUpdate("F-1", "apply", {
        allowedTargets: [{
          target: { entity: "requirement", id: "R1", field: "desc" },
          operationKinds: ["replace-entity-field"],
        }],
      })]),
    });
    const repaired = mergeSpecReviewDelta({
      review: triaged,
      delta: delta(triaged, "spec-repair", [], [{ findingIds: ["F-1"], kind: "replace-entity-field" }]),
      acceptedOperations: [{ findingIds: ["F-1"], kind: "replace-entity-field" }],
    });

    assert.deepEqual([initial.generation, reviewed.generation, triaged.generation, repaired.generation], [0, 1, 2, 3]);
    assert.deepEqual(repaired.identity.toJSON(), IDENTITY);
    assert.equal(repaired.findings.byId("F-1").disposition, "apply");
    assert.deepEqual(repaired.audit.at(-1).appliedFindings, ["F-1"]);
    assert.equal(repaired.audit.at(-1).relation, "revision-scoped-canonical-review");
  });

  it("replaces prior findings on review re-entry and rejects stale deltas", () => {
    const initial = emptyReview();
    const first = mergeSpecReviewDelta({
      review: initial,
      delta: delta(initial, "spec-review", [finding("F-old")]),
    });
    const reentered = mergeSpecReviewDelta({
      review: first,
      delta: delta(first, "spec-review", [finding("F-new")]),
    });
    assert.equal(reentered.generation, 2);
    assert.equal(reentered.findings.byId("F-old"), null);
    assert.ok(reentered.findings.byId("F-new"));
    assert.equal(reentered.audit.at(-1).outcome, "replaced");
    const emptied = mergeSpecReviewDelta({
      review: reentered,
      delta: delta(reentered, "spec-review", []),
    });
    assert.equal(emptied.generation, 3);
    assert.deepEqual(emptied.findings.findings, []);
    assert.equal(emptied.audit.at(-1).outcome, "replaced");
    assert.throws(() => mergeSpecReviewDelta({
      review: emptied,
      delta: delta(first, "spec-triage", []),
    }), /stale/);
  });

  it("audits unknown triage findings without blocking independent valid updates", () => {
    const initial = emptyReview();
    const reviewed = mergeSpecReviewDelta({
      review: initial,
      delta: delta(initial, "spec-review", [finding("F-valid")]),
    });
    const next = mergeSpecReviewDelta({
      review: reviewed,
      delta: delta(reviewed, "spec-triage", [
        triageUpdate("F-invalid", "apply", { allowedTargets: [{ target: { entity: "requirement", id: "R1", field: "desc" }, operationKinds: ["replace-entity-field"] }] }),
        triageUpdate("F-valid", "invalid"),
      ]),
    });
    assert.equal(next.findings.byId("F-valid").disposition, "invalid");
    assert.deepEqual(next.audit.at(-1).discardedOperations, [{ findingId: "F-invalid", reason: "unknown finding" }]);
  });

  it("rejects review self-triage and triage field mutation while preserving valid siblings", () => {
    const initial = emptyReview();
    const reviewed = mergeSpecReviewDelta({
      review: initial,
      delta: delta(initial, "spec-review", [
        { ...finding("F-self"), disposition: "apply", evidence: "self granted", allowedTargets: [] },
        finding("F-valid"),
      ]),
    });
    assert.equal(reviewed.findings.byId("F-self"), null);
    assert.ok(reviewed.findings.byId("F-valid"));
    const triaged = mergeSpecReviewDelta({
      review: reviewed,
      delta: delta(reviewed, "spec-triage", [
        { ...triageUpdate("F-valid", "apply", { allowedTargets: [{ target: { entity: "requirement", id: "R1", field: "desc" }, operationKinds: ["replace-entity-field"] }] }), severity: "blocking" },
        triageUpdate("F-valid", "already_resolved"),
      ]),
    });
    assert.equal(triaged.findings.byId("F-valid").disposition, "already_resolved");
    assert.ok(triaged.audit.at(-1).discardedOperations.some((entry) => /invalid schema/.test(entry.reason)));
  });

  it("has a key-order-independent review digest and discards conflicting duplicate IDs", () => {
    const initial = emptyReview();
    const one = finding("F-one");
    const reordered = Object.fromEntries(Object.entries(one).reverse());
    assert.equal(new CanonicalSpecReview({ version: 2, identity: IDENTITY, generation: 0, findings: [one], audit: [] }).digest,
      new CanonicalSpecReview({ version: 2, identity: IDENTITY, generation: 0, findings: [reordered], audit: [] }).digest);
    const merged = mergeSpecReviewDelta({
      review: initial,
      delta: delta(initial, "spec-review", [one, { ...finding("F-one"), title: "Conflicts" }, finding("F-other")]),
    });
    assert.equal(merged.findings.byId("F-one"), null);
    assert.ok(merged.findings.byId("F-other"));
  });
});
