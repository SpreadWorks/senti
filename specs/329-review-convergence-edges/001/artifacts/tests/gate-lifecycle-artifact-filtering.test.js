// spec: R7
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  excludeGateLifecycleArtifactsFromGateDiff,
} from "../../../src/flow/lib/run-gate.js";
import {
  ReviewDisposition,
  ReviewFinding,
} from "../../../src/flow/lib/review-convergence.js";
import {
  REVIEW_FINDING_CANONICAL_FIELD_MAX_CHARS,
  ReviewFindingFingerprint,
} from "../../../src/flow/lib/finding-disposition-policy.js";

function modifiedDiff(file) {
  return [
    `diff --git a/${file} b/${file}`,
    "index 1111111..2222222 100644",
    `--- a/${file}`,
    `+++ b/${file}`,
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "",
  ].join("\n");
}

test("R7: gate input excludes only gate-owned lifecycle artifacts", () => {
  const specDir = "specs/329-review-convergence-edges";
  const excluded = [
    "flow.json",
    "issue-log.json",
    "retry-recovery.json",
    ".retry-recovery.transaction.json",
    "draft-gate-source.json",
    "spec-gate-result.json",
    "task-impl-gate-source.json",
    "impl-gate-result.json",
  ].map((file) => `${specDir}/${file}`);
  const retained = [
    `${specDir}/test-execute-result.json`,
    `${specDir}/tests/review-completion-scope.test.js`,
    "src/flow/lib/run-review.js",
  ];
  const diff = [...excluded, ...retained].map(modifiedDiff).join("");

  const filtered = excludeGateLifecycleArtifactsFromGateDiff(
    diff,
    `${specDir}/spec.json`,
  );

  for (const file of excluded) assert.doesNotMatch(filtered, new RegExp(file.replaceAll(".", "\\.")));
  for (const file of retained) assert.match(filtered, new RegExp(file.replaceAll(".", "\\.")));
});

test("R7: PASS ADVISORY and REJECTED retain their finding bucket invariants", () => {
  const finding = new ReviewFinding({
    findingId: "bucket-invariant",
    summary: "Bucket invariant evidence",
    fingerprint: "1".repeat(64),
    evidenceRefs: ["test-review.json#bucket-invariant"],
  });

  assert.equal(new ReviewDisposition({ value: "PASS" }).value, "PASS");
  assert.equal(new ReviewDisposition({
    value: "ADVISORY",
    advisoryFindings: [finding],
  }).value, "ADVISORY");
  assert.equal(new ReviewDisposition({
    value: "REJECTED",
    blockingFindings: [finding],
  }).value, "REJECTED");

  assert.throws(
    () => new ReviewDisposition({ value: "PASS", advisoryFindings: [finding] }),
    /PASS|finding/i,
  );
  assert.throws(
    () => new ReviewDisposition({ value: "ADVISORY" }),
    /ADVISORY|finding/i,
  );
  assert.throws(
    () => new ReviewDisposition({ value: "REJECTED" }),
    /REJECTED|blocking/i,
  );
});

test("R7: canonical finding tuples enforce fixed and bounded input", () => {
  assert.match(
    ReviewFindingFingerprint.fromCanonicalTuple([
      "target",
      "blocking",
      "title",
      "issue",
    ]).value,
    /^[a-f0-9]{64}$/,
  );
  assert.throws(
    () => ReviewFindingFingerprint.fromCanonicalTuple(["target", "blocking", "title"]),
    /exactly 4/,
  );
  assert.throws(
    () => ReviewFindingFingerprint.fromCanonicalTuple([
      "target",
      "blocking",
      "title",
      "x".repeat(REVIEW_FINDING_CANONICAL_FIELD_MAX_CHARS + 1),
    ]),
    /at most 1200/,
  );
});
