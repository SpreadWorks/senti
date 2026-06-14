import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  checkReviewRetryBelowMax,
} from "../../../src/flow/lib/run-review.js";
import {
  checkRetryBelowMax as checkGateRetryBelowMax,
  classifyGateRetryExhaustionSource,
} from "../../../src/flow/lib/run-gate.js";
import {
  buildAcceptanceReviewArtifactFromEvidence,
  writeAcceptanceReviewArtifact,
} from "../../../src/flow/lib/acceptance-review-artifacts.js";
import { readFlowFindingsArtifact } from "../../../src/flow/lib/flow-findings.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../helpers/tmp-dir.js";

let tmp;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function semanticFinding(id) {
  return {
    findingId: id,
    failureMode: "missing_acceptance_requirement",
    category: "semantic",
    title: "Missing test-facing behavior",
    reason: "The semantic finding mentions missing test behavior without representing a mechanical precheck failure.",
  };
}

function retryMetrics(counter, phase, count = 10) {
  return Array.from({ length: count }, () => ({ phase, counter, delta: 1 }));
}

function fakeFlowManager(updates) {
  return {
    updateStepStatus(id, status) {
      updates.push({ id, status });
    },
  };
}

function prepareSpecRoot() {
  tmp = createTmpDir("retry-exhaustion-defer-");
  writeJson(tmp, "specs/demo/spec.json", {
    requirements: [{ id: "R1", desc: "demo requirement", priority: "must" }],
  });
  return {
    root: tmp,
    specDir: path.join(tmp, "specs", "demo"),
    specPath: "specs/demo/spec.json",
  };
}

function prepareAcceptanceEvidence(specDir) {
  writeJson(specDir, "scenario-validity-result.json", { result: "pass" });
  writeFile(specDir, "tests/retry-exhaustion.test.js", "test('R1: demo requirement', () => {});\n");
  writeJson(specDir, "test-execute-result.json", {
    version: "2",
    summary: [{ id: "R1", result: "pass" }],
  });
  writeJson(specDir, "test-result-review.json", { verdict: "pass" });
  writeJson(specDir, "retro.json", { result: "pass" });
}

test("review retry exhaustion defers semantic findings without prose keyword blocking", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "FAIL",
    blockingFindings: [semanticFinding("test-semantic")],
  });
  const updates = [];
  const result = checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    },
    flowManager: fakeFlowManager(updates),
  }, "test");

  assert.equal(result?.result, "deferred");
  assert.deepEqual(updates, [{ id: "test-review", status: "done" }]);
  const finding = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0];
  assert.equal(finding.sourceArtifact, "test-review.json");
  assert.equal(finding.sourceFindingId, "test-semantic");
});

test("gate retry exhaustion defers semantic findings and blocks structured coverage failures", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "impl-gate-result.json", {
    phase: "integration",
    result: "fail",
    evaluations: [{
      findingId: "integration-semantic",
      result: "fail",
      category: "requirements",
      reason: "Missing command behavior in a semantic requirement path.",
    }],
  });
  const updates = [];
  const result = checkGateRetryBelowMax({
    root: fixture.root,
    flowState: {
      spec: fixture.specPath,
      metrics: retryMetrics("gateRetry", "integration"),
    },
    flowManager: fakeFlowManager(updates),
  }, "integration");

  assert.equal(result?.result, "deferred");
  assert.deepEqual(updates, [{ id: "impl-gate", status: "done" }]);
  assert.equal(readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0].sourceFindingId, "integration-semantic");

  const coverage = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "test",
      result: "fail",
      blockingFindings: [{ origin: "test-coverage", failureKind: "missing_header" }],
    },
  });
  assert.equal(coverage.deferAllowed, false);
  assert.equal(coverage.reason, "coverage_header_failure");
});

test("acceptance-review consumes deferred findings and mirrors final disposition", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "FAIL",
    blockingFindings: [semanticFinding("test-semantic")],
  });
  checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    },
    flowManager: fakeFlowManager([]),
  }, "test");
  prepareAcceptanceEvidence(fixture.specDir);

  const deferredFindingId = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0].findingId;
  writeJson(fixture.specDir, "acceptance-review-evidence.json", {
    deferredFindingDispositions: [{
      findingId: deferredFindingId,
      finalDisposition: "fixed",
      evidenceRefs: ["test-review.json#test-semantic"],
    }],
  });
  const artifact = buildAcceptanceReviewArtifactFromEvidence({ specDir: fixture.specDir });
  assert.equal(artifact.verdict, "pass");
  assert.equal(artifact.deferredFindings[0].finalDisposition, "fixed");

  writeAcceptanceReviewArtifact({ specDir: fixture.specDir, artifact });
  const mirrored = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0];
  assert.equal(mirrored.finalDisposition, "fixed");

  fs.renameSync(path.join(fixture.specDir, "test-review.json"), path.join(fixture.specDir, "test-review.json.bak"));
  const missingSource = buildAcceptanceReviewArtifactFromEvidence({ specDir: fixture.specDir });
  assert.equal(missingSource.verdict, "blocked");
});
