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
  artifactFromAcceptanceJudgments,
  buildAcceptanceReviewContext,
  writeAcceptanceReviewArtifact,
} from "../../../src/flow/lib/acceptance-review-artifacts.js";
import {
  buildRepairFingerprint,
  writeRepairEvidenceArtifact,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
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
  writeJson(tmp, ".senti/config.json", { name: "deferred-finding-test" });
  writeFile(tmp, "src/demo.js", "export const demo = true;\n");
  writeJson(tmp, "specs/demo/spec.json", {
    requirements: [{ id: "R1", desc: "demo requirement", priority: "must" }],
  });
  return {
    root: tmp,
    specDir: path.join(tmp, "specs", "demo"),
    specPath: "specs/demo/spec.json",
  };
}

function prepareAcceptanceEvidence({ root, specDir, specPath }) {
  const testFile = "specs/demo/tests/retry-exhaustion.test.js";
  const scenarioRaw = "specs/demo/tests/.raw/scenario-validity.log";
  const executionRaw = "specs/demo/tests/.raw/test-execution.log";
  writeFile(root, testFile, "test('R1: demo requirement', () => {});\n");
  writeFile(root, scenarioRaw, "R1 expected failure\n");
  writeFile(root, executionRaw, "R1 pass\n");
  writeJson(specDir, "scenario-validity-result.json", {
    version: "1",
    raw_output_path: scenarioRaw,
    command: `node ${testFile}`,
    process: { started: true, exitCode: 1, signal: null, timedOut: false, spawnError: null },
    result: "pass",
    summary: [{
      id: "R1",
      classification: "expected_fail",
      evidence: {
        test_file: testFile,
        test_name: "R1: demo requirement",
        command: `node ${testFile}`,
        raw_output_lines: { start_line: 1, end_line: 1 },
      },
    }],
  });
  const fingerprint = buildRepairFingerprint({ root, specPath });
  writeRepairEvidenceArtifact({ specDir, stepId: "test-execute", fingerprint, artifact: {
    version: "2",
    raw_output_path: executionRaw,
    summary: [{
      id: "R1",
      result: "pass",
      evidence: {
        test_file: testFile,
        test_name: "R1: demo requirement",
        command: `node --test ${testFile}`,
        raw_output_lines: { start_line: 1, end_line: 1 },
      },
    }],
    regression: {
      required: false,
      result: "skipped",
      mode: "none",
      changed_files: [],
      trigger_relevant_changed_files: [],
      category: "spec-artifact-only",
      reason: "unit fixture",
      classified_paths: [],
    },
  }});
  writeRepairEvidenceArtifact({ specDir, stepId: "test-result-review", fingerprint, artifact: {
    verdict: "pass",
    checked_items: [{ check: "project_regression_verification", result: "pass", detail: "verified" }],
    result_file_path: "specs/demo/test-execute-result.json",
    raw_output_path: executionRaw,
  }});
  writeRepairEvidenceArtifact({ specDir, stepId: "impl-review", fingerprint, artifact: {
    version: 1,
    phase: "impl",
    generatedAt: new Date().toISOString(),
    verdict: "PASS",
    summary: { blocking: 0, nonBlocking: 0, total: 0 },
    blockingFindings: [],
    nonBlockingImprovements: [],
    excluded: { missingFile: 0, outOfScope: 0 },
  }});
  writeRepairEvidenceArtifact({ specDir, stepId: "impl-gate", fingerprint, artifact: {
    verdict: "pass",
    issues: [],
    nextAction: "retro",
    level: "integration",
    phase: "integration",
    evaluations: [],
    reasons: [],
  }});
  writeRepairEvidenceArtifact({ specDir, stepId: "retro", fingerprint, artifact: {
    spec: specPath,
    date: new Date().toISOString(),
    mode: "result-file",
    requirements: [{ desc: "demo requirement", status: "done", note: "R1: demo requirement" }],
    unplanned: [],
    summary: {
      total: 1,
      done: 1,
      partial: 0,
      not_done: 0,
      not_applicable_count: 0,
      na_count: 0,
      not_testable_count: 0,
      rate: 1,
      notes: "unit fixture",
    },
  }});
  return fingerprint;
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
  const fingerprint = prepareAcceptanceEvidence(fixture);

  const deferredFindingId = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0].findingId;
  writeJson(fixture.specDir, "acceptance-review-evidence.json", {
    deferredFindingDispositions: [{
      findingId: deferredFindingId,
      finalDisposition: "fixed",
      evidenceRefs: ["test-review.json#test-semantic"],
    }],
  });
  const state = {
    spec: fixture.specPath,
    request: "Verify the deferred demo requirement.",
  };
  const diff = [
    "diff --git a/src/demo.js b/src/demo.js",
    "--- a/src/demo.js",
    "+++ b/src/demo.js",
    "@@ -1 +1 @@",
    "-export const demo = false;",
    "+export const demo = true;",
    "",
  ].join("\n");
  const context = buildAcceptanceReviewContext({ root: fixture.root, state, diff });
  const artifact = artifactFromAcceptanceJudgments({
    context,
    requirementJudgments: [{
      requirementId: "R1",
      status: "met",
      requestRefs: ["flow.request"],
      requirementRefs: ["spec.json#R1"],
      diffRefs: ["diff:src/demo.js"],
      repairRefs: ["acceptance:no-repair"],
      testRefs: ["test-execute-result.json#R1"],
      missingEvidence: [],
    }],
  });
  assert.equal(artifact.verdict, "pass");
  assert.equal(artifact.deferredFindings[0].finalDisposition, "fixed");
  assert.equal(artifact.requirementJudgments[0].requirementId, "R1");
  assert.equal(artifact.repairFingerprint, fingerprint.hash);

  writeAcceptanceReviewArtifact({
    specDir: fixture.specDir,
    artifact,
    requirementIds: ["R1"],
    fingerprint,
  });
  const mirrored = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0];
  assert.equal(mirrored.finalDisposition, "fixed");

  fs.renameSync(path.join(fixture.specDir, "test-review.json"), path.join(fixture.specDir, "test-review.json.bak"));
  const missingContext = buildAcceptanceReviewContext({ root: fixture.root, state, diff });
  const missingSource = artifactFromAcceptanceJudgments({ context: missingContext, requirementJudgments: [] });
  assert.equal(missingSource.verdict, "blocked");
});
