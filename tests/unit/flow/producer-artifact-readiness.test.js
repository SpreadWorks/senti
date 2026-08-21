import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MissingProducerArtifactRecoveryAdmission,
  ProducerArtifactReadiness,
  producerArtifactReadiness,
  producerArtifactReadinessesForProducer,
} from "../../../src/flow/lib/producer-artifact-readiness.js";

function state({ sequence, current = null, attempt = null } = {}) {
  return {
    current,
    attempt,
    findNode: (nodeId) => nodeId === "spec-review" ? { id: nodeId, attemptSequence: sequence } : null,
  };
}

describe("ProducerArtifactReadiness", () => {
  it("uses primary attempt results rather than optional catalog readers", () => {
    assert.equal(
      producerArtifactReadiness({ producerNodeId: "implement", consumerNodeId: "test-execute" }),
      null,
      "file.map is not a required producer readiness edge",
    );
    assert.equal(
      producerArtifactReadiness({ producerNodeId: "implement", consumerNodeId: "impl-review" }),
      null,
      "optional implementation map availability remains owned by review's domain check",
    );
    assert.ok(
      producerArtifactReadiness({ producerNodeId: "scenario-validity", consumerNodeId: "test-review" })
        instanceof ProducerArtifactReadiness,
      "scenario validity's retained primary result remains required by test review",
    );
    assert.equal(
      producerArtifactReadiness({ producerNodeId: "scenario-validity", consumerNodeId: "acceptance-review" }),
      null,
      "optional nonblocking handoffs cannot become an unconditional readiness edge",
    );
    assert.ok(
      producerArtifactReadiness({ producerNodeId: "acceptance-decision", consumerNodeId: "final-regression" })
        instanceof ProducerArtifactReadiness,
      "an explicit acceptance decision retains its cataloged primary result",
    );
    assert.ok(
      producerArtifactReadiness({ producerNodeId: "task-17-review", consumerNodeId: "task-17-gate" })
        instanceof ProducerArtifactReadiness,
      "dynamic task primary results preserve their task identity",
    );
    assert.ok(
      producerArtifactReadiness({ producerNodeId: "task-17-gate", consumerNodeId: "task-17-impl" })
        instanceof ProducerArtifactReadiness,
      "dynamic task gate results preserve their replacement implementation identity",
    );
    assert.deepEqual(
      producerArtifactReadinessesForProducer({ producerNodeId: "spec-review" })
        .map((readiness) => `${readiness.producerNodeId}->${readiness.consumerNodeId}`),
      ["spec-review->spec-triage"],
    );
  });

  it("requires cataloged spec.review and its matching confirmed spec-review Activity before spec-triage", () => {
    const readiness = producerArtifactReadiness({
      producerNodeId: "spec-review",
      consumerNodeId: "spec-triage",
    });
    assert.ok(readiness instanceof ProducerArtifactReadiness);
    assert.throws(
      () => readiness.assert({ state: state({ sequence: 2 }), catalog: { artifacts: [] }, activities: [] }),
      (error) => error?.code === "CANONICAL_PRODUCER_ARTIFACT_NOT_READY",
    );
    const catalog = {
      artifacts: [{
        logicalKey: "spec.review",
        relativePath: "steps/spec-review/result.json",
        activityId: "confirmed-spec-review",
      }],
    };
    assert.throws(
      () => readiness.assert({
        state: state({ sequence: 2 }),
        catalog,
        activities: [
          {
            id: "started-spec-review",
            nodeId: "spec-review",
            attemptId: "spec-review-attempt-2",
            sequence: 2,
            transition: {
              operation: "start_attempt",
              attempt: { id: "spec-review-attempt-2", nodeId: "spec-review", sequence: 2 },
            },
          },
          {
            id: "confirmed-spec-review",
            nodeId: "spec-review",
            attemptId: "spec-review-attempt-2",
            sequence: 2,
            transition: { operation: "fail_attempt" },
            result: { outcome: "failed" },
          },
        ],
      }),
      (error) => error?.code === "CANONICAL_PRODUCER_ARTIFACT_NOT_READY",
    );
    readiness.assert({
      state: state({ sequence: 2 }),
      catalog,
      activities: [
        {
          id: "started-spec-review",
          nodeId: "spec-review",
          attemptId: "spec-review-attempt-2",
          sequence: 2,
          transition: {
            operation: "start_attempt",
            attempt: { id: "spec-review-attempt-2", nodeId: "spec-review", sequence: 2 },
          },
        },
        {
          id: "confirmed-spec-review",
          nodeId: "spec-review",
          attemptId: "spec-review-attempt-2",
          sequence: 2,
          transition: { operation: "confirm_attempt" },
          result: { outcome: "passed" },
        },
      ],
    });
  });

  it("rejects a retained prior-attempt result when the current producer Attempt is artifactless", () => {
    const readiness = producerArtifactReadiness({ producerNodeId: "spec-review", consumerNodeId: "spec-triage" });
    assert.throws(
      () => readiness.assert({
        state: state({
          sequence: 2,
          current: ["spec-review"],
          attempt: { id: "spec-review-attempt-2", nodeId: "spec-review" },
        }),
        catalog: { artifacts: [{
          logicalKey: "spec.review",
          relativePath: "steps/spec-review/result.json",
          activityId: "published-attempt-1",
        }] },
        activities: [{
          id: "published-attempt-1",
          nodeId: "spec-review",
          attemptId: "spec-review-attempt-1",
          sequence: 1,
          transition: { operation: "publish_artifacts" },
        }],
      }),
      (error) => error?.code === "CANONICAL_PRODUCER_ARTIFACT_NOT_READY",
    );
  });

  it("rejects a terminal descriptor Activity with the wrong Attempt id at the same sequence", () => {
    const readiness = producerArtifactReadiness({ producerNodeId: "spec-review", consumerNodeId: "spec-triage" });
    assert.throws(
      () => readiness.assert({
        state: state({ sequence: 2 }),
        catalog: { artifacts: [{
          logicalKey: "spec.review",
          relativePath: "steps/spec-review/result.json",
          activityId: "confirmed-spec-review",
        }] },
        activities: [
          {
            id: "started-spec-review",
            nodeId: "spec-review",
            attemptId: "spec-review-attempt-2",
            sequence: 2,
            transition: {
              operation: "start_attempt",
              attempt: { id: "spec-review-attempt-2", nodeId: "spec-review", sequence: 2 },
            },
          },
          {
            id: "confirmed-spec-review",
            nodeId: "spec-review",
            attemptId: "wrong-attempt-id",
            sequence: 2,
            transition: { operation: "confirm_attempt" },
            result: { outcome: "passed" },
          },
        ],
      }),
      (error) => error?.code === "CANONICAL_PRODUCER_ARTIFACT_NOT_READY",
    );
  });

  it("rejects historical recovery after the producer result appears", () => {
    const readiness = producerArtifactReadiness({ producerNodeId: "spec-review", consumerNodeId: "spec-triage" });
    const historical = {
      runId: "historical-run",
      current: ["spec-triage"],
      attempt: { id: "triage-attempt-1", sequence: 1, nodeId: "spec-triage", failure: null },
      findNode: (nodeId) => ({
        id: nodeId,
        status: nodeId === "spec-review" ? "failed" : "in_progress",
        attemptSequence: 2,
      }),
    };
    const admission = new MissingProducerArtifactRecoveryAdmission({
      runId: "historical-run",
      consumerAttempt: historical.attempt,
      producerAttempt: {
        id: "spec-review-attempt-2",
        sequence: 2,
        nodeId: "spec-review",
        failure: { code: "REVIEW_EXECUTION_FAILED" },
      },
      readiness,
    });
    assert.throws(
      () => admission.assert({
        state: historical,
        catalog: { artifacts: [{
          logicalKey: "spec.review",
          relativePath: "steps/spec-review/result.json",
          activityId: "published-spec-review-attempt-2",
        }] },
        activities: [
          {
            id: "started-spec-review-attempt-2",
            nodeId: "spec-review",
            attemptId: "spec-review-attempt-2",
            sequence: 2,
            transition: {
              operation: "start_attempt",
              attempt: { id: "spec-review-attempt-2", nodeId: "spec-review", sequence: 2 },
            },
          },
          {
            id: "published-spec-review-attempt-2",
            nodeId: "spec-review",
            attemptId: "spec-review-attempt-2",
            sequence: 2,
            transition: { operation: "publish_artifacts" },
          },
        ],
      }),
      (error) => error?.code === "CANONICAL_MISSING_PRODUCER_ARTIFACT_RECOVERY_STALE",
    );
  });

  it("rejects recovery when the supplied producer Attempt is not the immutable failure record", () => {
    const readiness = producerArtifactReadiness({ producerNodeId: "spec-review", consumerNodeId: "spec-triage" });
    const historical = {
      runId: "historical-run",
      current: ["spec-triage"],
      attempt: { id: "triage-attempt-1", sequence: 1, nodeId: "spec-triage", failure: null },
      findNode: (nodeId) => ({
        id: nodeId,
        status: nodeId === "spec-review" ? "failed" : "in_progress",
        attemptSequence: 2,
      }),
    };
    const admission = new MissingProducerArtifactRecoveryAdmission({
      runId: "historical-run",
      consumerAttempt: historical.attempt,
      producerAttempt: {
        id: "wrong-spec-review-attempt",
        sequence: 2,
        nodeId: "spec-review",
        failure: { code: "REVIEW_EXECUTION_FAILED" },
      },
      readiness,
    });
    assert.throws(
      () => admission.assert({
        state: historical,
        catalog: { artifacts: [] },
        activities: [
          {
            id: "failed-spec-review-attempt-2",
            nodeId: "spec-review",
            attemptId: "spec-review-attempt-2",
            sequence: 2,
            transition: { operation: "fail_attempt" },
            failure: { code: "REVIEW_EXECUTION_FAILED" },
          },
          {
            id: "recorded-spec-review-attempt-2",
            nodeId: "spec-review",
            attemptId: "spec-review-attempt-2",
            sequence: 2,
            transition: { operation: "record_failure" },
          },
        ],
      }),
      (error) => error?.code === "CANONICAL_MISSING_PRODUCER_ARTIFACT_RECOVERY_STALE",
    );
  });
});
