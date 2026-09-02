import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CurrentAttemptIdentity,
  CurrentFlowIdentity,
} from "../../src/flow/lib/current-flow-state.js";
import {
  WorkerArtifactSemanticInputRevision,
} from "../../src/flow/lib/worker-artifact-handoff.js";

const INPUT_DIGEST = "a".repeat(64);

function revision({
  inputDigest = INPUT_DIGEST,
  flowId = "flow-run-semantic-revision",
  flowVersionId = "flow-v1-run-semantic-revision",
  runId = "run-semantic-revision",
  specId = "500-semantic-revision",
  attemptId = "attempt-implement-1",
} = {}) {
  return new WorkerArtifactSemanticInputRevision({
    inputDigest,
    flowIdentity: new CurrentFlowIdentity({
      flowId,
      flowVersionId,
      runId,
      specId,
    }),
    attempt: new CurrentAttemptIdentity({
      id: attemptId,
      nodeId: "implement",
      sequence: 1,
    }),
  }).toString();
}

describe("worker artifact semantic input revision", () => {
  it("binds the complete Flow identity, Attempt, and declared input digest", () => {
    const baseline = revision();

    assert.equal(revision(), baseline);
    for (const changed of [
      { inputDigest: "b".repeat(64) },
      { flowId: "another-flow" },
      { flowVersionId: "flow-v2-run-semantic-revision" },
      { runId: "another-run" },
      { specId: "501-semantic-revision" },
      { attemptId: "attempt-implement-2" },
    ]) {
      assert.notEqual(revision(changed), baseline, JSON.stringify(changed));
    }
  });
});
