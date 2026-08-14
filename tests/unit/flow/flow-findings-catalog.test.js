import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  CanonicalFlowFindingsStore,
  deferExhaustedSemanticFindings,
} from "../../../src/flow/lib/flow-findings.js";
import {
  CanonicalNonBlockingHandoffStore,
  materializeNonblockingAcceptanceHandoff,
  verifyNonblockingHandoffSource,
} from "../../../src/flow/lib/nonblocking-handoff.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let tmp = null;

afterEach(() => {
  if (tmp !== null) removeTmpDir(tmp);
  tmp = null;
});

function attemptHistory(logicalKey, payload) {
  return Buffer.from(`${JSON.stringify({
    attempts: [{ attempt: 1, artifact: { logicalKey, payload } }],
  }, null, 2)}\n`, "utf8");
}

function semanticFinding(id) {
  return {
    findingId: id,
    fingerprint: "a".repeat(64),
    disposition: "must-fix",
    rationale: "The behavior remains semantically incomplete.",
  };
}

test("semantic retry deferral publishes flow.findings through the active Version catalog", () => {
  tmp = createTmpDir("flow-findings-catalog-");
  const flowManager = makeFlowManager(tmp);
  const flow = new CanonicalFlowFixture({ flowManager, specId: "001-findings" })
    .create()
    .registerActive()
    .activate("test-review");
  const state = flow.state();
  flowManager.publishArtifacts({
    specId: state.specId,
    nodeId: "test-review",
    artifactWrites: [{
      logicalKey: "test.review",
      mediaType: "application/json",
      bytes: attemptHistory("test.review", {
        verdict: "REJECTED",
        blockingFindings: [semanticFinding("semantic-1")],
      }),
    }],
  });

  const outcome = deferExhaustedSemanticFindings({
    flowManager,
    flowState: state,
    nodeId: "test-review",
    sourceStep: "test-review",
    sourceArtifact: "test.review",
    attempts: 5,
  });

  assert.equal(outcome.deferred.length, 1);
  const findings = new CanonicalFlowFindingsStore({ flowManager, flowState: state, nodeId: "test-review" }).read();
  assert.equal(findings.entries[0].sourceArtifact, "steps/test-review/result.json");
  assert.equal(findings.entries[0].sourceFindingId, "semantic-1");
  assert.equal(findings.entries[0].completionKind, "deferred");
  const location = flowManager.specLocation(state.specId);
  assert.equal(fs.existsSync(path.join(location.directory, "flow-findings.json")), false);
});

test("nonblocking handoff binds its evidence and deferred finding to cataloged artifacts", () => {
  tmp = createTmpDir("nonblocking-handoff-catalog-");
  const flowManager = makeFlowManager(tmp);
  const flow = new CanonicalFlowFixture({ flowManager, specId: "002-handoff" })
    .create()
    .registerActive()
    .activate("scenario-validity");
  const state = flow.state();
  const evidence = attemptHistory("scenario.validity", { result: "unavailable", reason: "test runner unavailable" });
  flowManager.publishArtifacts({
    specId: state.specId,
    nodeId: "scenario-validity",
    artifactWrites: [{
      logicalKey: "scenario.validity",
      mediaType: "application/json",
      bytes: evidence,
    }],
  });

  const result = materializeNonblockingAcceptanceHandoff({
    flowManager,
    flowState: state,
    nodeId: "scenario-validity",
    sourceStep: "scenario-validity",
    evidenceRef: "scenario.validity",
    evidenceDigest: crypto.createHash("sha256").update(evidence).digest("hex"),
    resultKind: "unavailable",
    attempts: 1,
  });

  assert.equal(result.findingCount, 1);
  const handoffs = new CanonicalNonBlockingHandoffStore({ flowManager, flowState: state, nodeId: "scenario-validity" }).read();
  assert.equal(handoffs.findings.length, 1);
  assert.equal(verifyNonblockingHandoffSource({
    flowManager,
    flowState: state,
    nodeId: "scenario-validity",
    value: handoffs.findings[0],
  }), true);
  const findings = new CanonicalFlowFindingsStore({ flowManager, flowState: state, nodeId: "scenario-validity" }).read();
  assert.equal(findings.entries[0].sourceArtifact, "steps/nonblocking-handoffs.json");
  assert.equal(fs.existsSync(path.join(flowManager.specLocation(state.specId).directory, "nonblocking-handoffs.json")), false);
});
