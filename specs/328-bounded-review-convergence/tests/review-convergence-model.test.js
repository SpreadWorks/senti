// spec: R1 R2 R4 R7 R9
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const importRoot = (relPath) => import(pathToFileURL(path.join(root, relPath)).href);
const treeSha = "a".repeat(40);
const findingFingerprint = "b".repeat(64);

async function model() {
  const relPath = "src/flow/lib/review-convergence.js";
  assert.ok(fs.existsSync(path.join(root, relPath)), `${relPath} must be implemented`);
  return importRoot(relPath);
}

function finding(ReviewFinding, id = "F-1") {
  return new ReviewFinding({
    findingId: id,
    summary: `summary ${id}`,
    fingerprint: findingFingerprint,
    evidenceRefs: ["review.md#finding-1"],
  });
}

test("R1: disposition classes enforce PASS ADVISORY and REJECTED finding invariants", async () => {
  const { ReviewDisposition, ReviewFinding } = await model();
  const advisory = finding(ReviewFinding);

  assert.equal(new ReviewDisposition({ value: "PASS" }).value, "PASS");
  assert.equal(new ReviewDisposition({ value: "ADVISORY", advisoryFindings: [advisory] }).value, "ADVISORY");
  assert.equal(new ReviewDisposition({ value: "REJECTED", blockingFindings: [advisory] }).value, "REJECTED");

  assert.throws(() => new ReviewDisposition({ value: "PASS", advisoryFindings: [advisory] }), /PASS|finding/i);
  assert.throws(() => new ReviewDisposition({ value: "ADVISORY" }), /ADVISORY|finding/i);
  assert.throws(() => new ReviewDisposition({ value: "REJECTED" }), /REJECTED|blocking/i);
  assert.throws(() => new ReviewDisposition({ value: "TOOLING_ERROR" }), /disposition|TOOLING_ERROR/i);
});

test("R2: canonical review evidence derives a stable phase task tree and digest identity", async () => {
  const {
    ReviewDisposition,
    ReviewEvidence,
    ReviewFinding,
    ReviewProvenance,
  } = await model();
  const input = {
    phase: "impl",
    taskId: null,
    treeSha,
    provenance: new ReviewProvenance({
      provider: "independent-reviewer",
      invocationId: "audit-001",
      capturedAt: "2026-07-22T00:00:00.000Z",
    }),
    disposition: new ReviewDisposition({
      value: "ADVISORY",
      advisoryFindings: [finding(ReviewFinding)],
    }),
  };

  const first = new ReviewEvidence(input);
  const second = new ReviewEvidence(input);
  assert.equal(first.identity.phase, "impl");
  assert.equal(first.identity.taskId, null);
  assert.equal(first.identity.treeSha, treeSha);
  assert.match(first.identity.evidenceDigest, /^[a-f0-9]{64}$/);
  assert.equal(first.identity.evidenceDigest, second.identity.evidenceDigest);
  assert.deepEqual(first.toJSON(), second.toJSON());
});

test("R4: tooling outcome records a bounded stage attempt without a reviewer disposition", async () => {
  const { ReviewToolingOutcome } = await model();
  for (const stage of ["startup", "communication", "parse", "post_hook", "canonical_write", "projection", "result_recording"]) {
    const outcome = new ReviewToolingOutcome({
      stage,
      attempt: 1,
      maxAttempts: 1,
      reason: `${stage} failed`,
    });
    assert.equal(outcome.kind, "TOOLING_ERROR");
    assert.equal(outcome.stage, stage);
    assert.equal(outcome.remainingAttempts, 0);
    assert.equal(Object.hasOwn(outcome.toJSON(), "disposition"), false);
  }
  assert.throws(() => new ReviewToolingOutcome({ stage: "parse", attempt: 2, maxAttempts: 1, reason: "overflow" }), /attempt/i);
});

test("R7: legacy FAIL and TOOLING_FAILURE values are not accepted as disposition aliases", async () => {
  const { ReviewDisposition } = await model();
  assert.throws(() => new ReviewDisposition({ value: "FAIL" }), /FAIL|disposition/i);
  assert.throws(() => new ReviewDisposition({ value: "TOOLING_FAILURE" }), /TOOLING_FAILURE|disposition/i);
});

test("R9: spec-local test headers collectively cover R1 through R9", () => {
  const specTestDir = path.join(root, "specs/328-bounded-review-convergence/tests");
  const covered = new Set();
  for (const name of fs.readdirSync(specTestDir).filter((entry) => entry.endsWith(".test.js"))) {
    const header = fs.readFileSync(path.join(specTestDir, name), "utf8").split("\n", 1)[0];
    for (const requirementId of header.match(/R\d+/g) || []) covered.add(requirementId);
  }
  assert.deepEqual(
    [...covered].sort((left, right) => Number(left.slice(1)) - Number(right.slice(1))),
    Array.from({ length: 9 }, (_, index) => `R${index + 1}`),
  );
});

test("R9: guardrail diff compaction preserves bounded spec-test declaration evidence", async () => {
  const {
    buildGuardrailTargetTextForPrompt,
  } = await importRoot("src/flow/lib/run-gate.js");
  const generatedDiff = [
    "diff --git a/specs/328-bounded-review-convergence/review-history/large.json b/specs/328-bounded-review-convergence/review-history/large.json",
    "--- /dev/null",
    "+++ b/specs/328-bounded-review-convergence/review-history/large.json",
    "@@ -0,0 +1 @@",
    `+${"x".repeat(8_000)}`,
  ].join("\n");
  const testDiff = [
    "diff --git a/specs/328-bounded-review-convergence/tests/example.test.js b/specs/328-bounded-review-convergence/tests/example.test.js",
    "--- /dev/null",
    "+++ b/specs/328-bounded-review-convergence/tests/example.test.js",
    "@@ -0,0 +1,2 @@",
    "+// spec: R2 R4 R9",
    "+test('R9: projection failure preserves advisory evidence', () => {});",
  ].join("\n");

  const target = buildGuardrailTargetTextForPrompt(
    "# Compact guardrail fixture",
    `${generatedDiff}\n${testDiff}\n`,
    2_000,
  );

  assert.match(target, /## Spec Test Header And Declaration Evidence/);
  assert.match(target, /specs\/328-bounded-review-convergence\/tests\/example\.test\.js: \/\/ spec: R2 R4 R9/);
  assert.match(target, /R9: projection failure preserves advisory evidence/);
  assert.ok(target.length <= 2_000);
});
