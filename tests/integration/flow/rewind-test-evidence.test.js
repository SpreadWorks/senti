import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import RunRewindTestEvidenceCommand, {
  CanonicalTestEvidenceRewindEligibility,
} from "../../../src/flow/lib/run-rewind-test-evidence.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

const roots = [];
const FINGERPRINT = "a".repeat(64);

afterEach(() => {
  while (roots.length > 0) removeTmpDir(roots.pop());
});

function attemptHistory(logicalKey, payload) {
  return Buffer.from(`${JSON.stringify({
    attempts: [{ attempt: 1, artifact: { logicalKey, payload } }],
  }, null, 2)}\n`, "utf8");
}

function guard(flow) {
  return {
    expectRunId: flow.runId,
    expectSpec: flow.specId,
    expectNoIssue: true,
  };
}

function fixture({
  executeFingerprint = FINGERPRINT,
  reviewFingerprint = FINGERPRINT,
  gateFingerprint = FINGERPRINT,
  gateResult = "fail",
  issueEntry = { kind: "material_repair", status: "applied", repairFingerprint: FINGERPRINT, findingIds: ["finding-1"] },
} = {}) {
  const root = createTmpDir("rewind-test-evidence-v1-");
  roots.push(root);
  const flowManager = makeFlowManager(root);
  const flow = new CanonicalFlowFixture({
    flowManager,
    specId: "001-rewind",
    runId: "run-001-rewind",
  }).create().registerActive().activate("test-execute");
  flowManager.publishArtifacts({
    specId: flow.specId,
    nodeId: "test-execute",
    artifactWrites: [{
      logicalKey: "test.execute",
      mediaType: "application/json",
      bytes: attemptHistory("test.execute", { repairFingerprint: executeFingerprint, summary: [] }),
    }],
  });
  flow.settle("test-execute").activate("test-result-review");
  flowManager.publishArtifacts({
    specId: flow.specId,
    nodeId: "test-result-review",
    artifactWrites: [{
      logicalKey: "test.result.review",
      mediaType: "application/json",
      bytes: attemptHistory("test.result.review", { repairFingerprint: reviewFingerprint, verdict: "pass" }),
    }],
  });
  flow.settle("test-result-review").activate("impl-gate");
  flowManager.publishArtifacts({
    specId: flow.specId,
    nodeId: "impl-gate",
    artifactWrites: [{
      logicalKey: "impl.gate",
      mediaType: "application/json",
      bytes: attemptHistory("impl.gate", { repairFingerprint: gateFingerprint, result: gateResult }),
    }],
  });
  flowManager.appendIssueLog({
    specId: flow.specId,
    entry: issueEntry,
    idempotencyKey: "rewind-material-repair",
  });
  flow.settle("impl-gate").activate("retro");
  return { root, flowManager, flow };
}

function execute(value, overrides = {}) {
  return new RunRewindTestEvidenceCommand().execute({
    flowManager: value.flowManager,
    flowState: value.flowManager.load(value.flow.specId),
    ...guard(value.flow),
    ...overrides,
  });
}

function operations(value) {
  return value.flowManager.activityLedger(value.flow.specId).map((activity) => activity.transition.operation);
}

describe("canonical stale test evidence rewind", () => {
  it("rewinds catalog-bound stale evidence through the fixed V1 Activity", () => {
    const value = fixture();
    const before = value.flowManager.activityLedger(value.flow.specId).length;

    const result = execute(value);

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.recovered, true);
    assert.equal(result.data.fingerprint, FINGERPRINT);
    assert.deepEqual(result.data.materialRepair, ["finding-1"]);
    assert.equal(value.flowManager.activityLedger(value.flow.specId).length, before + 1);
    assert.equal(operations(value).at(-1), "rewind_test_evidence");
    const state = value.flowManager.canonicalState(value.flow.specId);
    assert.equal(state.current.at(-1), "test-execute");
    assert.equal(state.attempt.nodeId, "test-execute");
    assert.equal(Object.hasOwn(value.flowManager.load(value.flow.specId), "stepAttempts"), false);
  });

  it("requires exact target guards before reading catalog evidence", () => {
    const value = fixture();
    const before = value.flowManager.activityLedger(value.flow.specId);

    const result = execute(value, { expectRunId: undefined, expectNoIssue: undefined });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_TARGET_GUARD_REQUIRED");
    assert.match(result.errors[0].messages.join(" "), /--expect-run-id/);
    assert.deepEqual(value.flowManager.activityLedger(value.flow.specId), before);
  });

  it("fails closed when cataloged test and review evidence target different repairs", () => {
    const value = fixture({ reviewFingerprint: "b".repeat(64) });
    const before = value.flowManager.activityLedger(value.flow.specId);

    const result = execute(value);

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "STALE_TEST_EVIDENCE_STALE");
    assert.deepEqual(value.flowManager.activityLedger(value.flow.specId), before);
    assert.equal(value.flowManager.canonicalState(value.flow.specId).current.at(-1), "retro");
  });

  it("requires an applied cataloged material-repair receipt", () => {
    const value = fixture({ issueEntry: { kind: "material_repair", status: "pending", repairFingerprint: FINGERPRINT, findingIds: ["finding-1"] } });
    const before = value.flowManager.activityLedger(value.flow.specId);

    const result = execute(value);

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "STALE_TEST_EVIDENCE_MATERIAL_REPAIR_MISSING");
    assert.deepEqual(value.flowManager.activityLedger(value.flow.specId), before);
  });

  it("does not rewind when the cataloged implementation gate is already passing", () => {
    const value = fixture({ gateResult: "pass" });
    const before = value.flowManager.activityLedger(value.flow.specId);

    const result = execute(value);

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "STALE_TEST_EVIDENCE_NOT_BLOCKED");
    assert.deepEqual(value.flowManager.activityLedger(value.flow.specId), before);
  });

  it("fails closed for a malformed immutable catalog history instead of reading a root artifact", () => {
    const value = fixture();
    const target = value.flowManager;
    const facade = {
      readArtifact(input) {
        const resolved = target.readArtifact(input);
        if (input.logicalKey !== "test.execute") return resolved;
        return Object.freeze({ ...resolved, bytes: Buffer.from("{malformed\\n", "utf8") });
      },
      rewindTestEvidence: target.rewindTestEvidence.bind(target),
    };

    assert.throws(
      () => CanonicalTestEvidenceRewindEligibility.capture({
        flowManager: facade,
        state: target.load(value.flow.specId),
      }),
      (error) => error.code === "STALE_TEST_EVIDENCE_CATALOG_INVALID",
    );
    assert.equal(target.canonicalState(value.flow.specId).current.at(-1), "retro");
    assert.notEqual(operations(value).at(-1), "rewind_test_evidence");
  });

  it("rejects a catalog descriptor that changes between eligibility and the transition CAS", () => {
    const value = fixture();
    const target = value.flowManager;
    let testExecuteReads = 0;
    const facade = {
      readArtifact(input) {
        const resolved = target.readArtifact(input);
        if (input.logicalKey !== "test.execute") return resolved;
        testExecuteReads += 1;
        if (testExecuteReads === 1) return resolved;
        return Object.freeze({
          ...resolved,
          descriptor: Object.freeze({ ...resolved.descriptor, hash: "c".repeat(64) }),
        });
      },
      rewindTestEvidence: target.rewindTestEvidence.bind(target),
    };

    const eligibility = CanonicalTestEvidenceRewindEligibility.capture({
      flowManager: facade,
      state: target.load(value.flow.specId),
    });

    assert.throws(
      () => eligibility.assertCurrent(),
      (error) => error.code === "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
    );
    assert.equal(target.canonicalState(value.flow.specId).current.at(-1), "retro");
    assert.notEqual(operations(value).at(-1), "rewind_test_evidence");
  });

  it("is idempotent: a consumed rewind cannot append another Activity", () => {
    const value = fixture();
    assert.equal(execute(value).ok, true);
    const before = value.flowManager.activityLedger(value.flow.specId);

    const second = execute(value);

    assert.equal(second.ok, false);
    assert.equal(second.errors[0].code, "STALE_TEST_EVIDENCE_REWIND_REJECTED");
    assert.deepEqual(value.flowManager.activityLedger(value.flow.specId), before);
  });
});
