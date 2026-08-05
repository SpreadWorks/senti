import { Envelope } from "../../lib/flow-envelope.js";
import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";
import { findActiveNode } from "../definition.js";
import { FlowCommand } from "./base-command.js";
import { findStepById } from "./step-tree.js";
import {
  ExplicitRecoveryTransition,
  StepTransitionCommitIntent,
  TEST_REVIEW_REPAIR_ENTRYPOINT,
} from "./step-transition-policy.js";
import {
  inspectTestReviewRepair,
  TestReviewRepairError,
  TestReviewRepairRecord,
} from "./test-review-repair.js";

const REPAIR_STEPS = Object.freeze(["test", "scenario-validity", "test-review"]);

class TestReviewRepairCommitIntent extends StepTransitionCommitIntent {
  constructor({ root, executionRoot, record }) {
    super();
    this.root = root;
    this.executionRoot = executionRoot;
    this.record = TestReviewRepairRecord.from(record);
    Object.freeze(this);
  }

  assertBeforeTransition(state) {
    this.record.assertActiveState(state);
    if (findActiveNode(state)?.stepId !== "test-review") {
      throw new TestReviewRepairError(
        "TEST_REVIEW_REPAIR_STALE",
        "test-review is no longer the active repair source",
      );
    }
    const source = inspectTestReviewRepair({
      root: this.root,
      executionRoot: this.executionRoot,
      state,
    });
    if (!this.record.matchesSource(source)) {
      throw new TestReviewRepairError(
        "TEST_REVIEW_REPAIR_STALE",
        "test-review repair evidence changed before the guarded transition",
      );
    }
  }

  applyTo(state) {
    this.record.assertActiveState(state);
    state.testReviewRepair = this.record.toJSON();
    for (const stepId of REPAIR_STEPS) {
      const step = findStepById(state.steps || [], stepId);
      if (!step) throw new Error(`test review repair step is missing: ${stepId}`);
      delete step.runtimeLog;
      delete step.startedAt;
      delete step.finishedAt;
      if (stepId === "test") step.startedAt = this.record.requestedAt;
    }
  }
}

function repairTransition(state) {
  const changes = [
    ["test", "in_progress"],
    ["scenario-validity", "pending"],
    ["test-review", "pending"],
  ].map(([stepId, requestedStatus]) => {
    const step = findStepById(state.steps || [], stepId);
    if (!step) throw new Error(`test review repair step is missing: ${stepId}`);
    return { stepId, currentStatus: step.status, requestedStatus };
  });
  return new ExplicitRecoveryTransition({
    stepId: "test",
    currentStatus: findStepById(state.steps || [], "test")?.status,
    requestedStatus: "in_progress",
    entrypoint: TEST_REVIEW_REPAIR_ENTRYPOINT,
    changes,
    clearRuntimeLog: true,
  });
}

export default class RunRepairTestReviewCommand extends FlowCommand {
  constructor() {
    super({ explicitTargetResolution: true });
  }

  execute(ctx) {
    let source;
    let record;
    let transition;
    try {
      source = inspectTestReviewRepair({
        root: ctx.root,
        executionRoot: ctx.executionRoot || ctx.root,
        state: ctx.flowState,
      });
      if (!source) {
        throw new TestReviewRepairError(
          "TEST_REVIEW_REPAIR_STAGE_UNSUPPORTED",
          "test review repair requires test-review to be in progress",
        );
      }
      record = TestReviewRepairRecord.create({ state: ctx.flowState, source });
      transition = repairTransition(ctx.flowState);
    } catch (error) {
      return Envelope.fail(
        "run",
        "repair-test-review",
        error.code || "TEST_REVIEW_REPAIR_INVALID",
        error.message,
      );
    }

    const operation = new RepositoryFlowOperationLock({ mainRoot: ctx.mainRoot || ctx.root });
    const operationOwnerToken = operation.acquire();
    try {
      ctx.flowManager.updateStepStatus(
        transition,
        {
          specId: ctx.flowState.specId,
          expectedOriginal: ctx.flowState,
          operationOwnerToken,
        },
        new TestReviewRepairCommitIntent({
          root: ctx.root,
          executionRoot: ctx.executionRoot || ctx.root,
          record,
        }),
      );
    } finally {
      operation.release();
    }
    return Envelope.ok("run", "repair-test-review", {
      previousStep: "test-review",
      nextStep: "test",
      resetSteps: [...REPAIR_STEPS],
      sourceArtifact: record.sourceArtifact,
      sourceArtifactDigest: record.sourceArtifactDigest,
      sourceEvidenceId: record.sourceEvidenceId,
      sourceTestRevisionDigest: record.sourceTestRevision.digest,
      blockingFindingIds: record.blockingFindings.map((finding) => finding.findingId),
    });
  }
}
