import { Envelope } from "../../lib/flow-envelope.js";
import { FlowCommand } from "./base-command.js";
import {
  inspectCanonicalTestReviewRepair,
  TestReviewRepairError,
} from "./test-review-repair.js";

const REPAIR_STEPS = Object.freeze(["test", "scenario-validity", "test-review"]);

export default class RunRepairTestReviewCommand extends FlowCommand {
  constructor() {
    super({ explicitTargetResolution: true });
  }

  execute(ctx) {
    try {
      const repair = inspectCanonicalTestReviewRepair({
        flowManager: ctx.flowManager,
        state: ctx.flowState,
      });
      if (repair === null) {
        throw new TestReviewRepairError(
          "TEST_REVIEW_REPAIR_STAGE_UNSUPPORTED",
          "test review repair requires test-review to be in progress",
        );
      }
      ctx.flowManager.repairTestReview({
        specId: ctx.flowState.specId,
        references: repair.references(),
      });
      return Envelope.ok("run", "repair-test-review", {
        previousStep: "test-review",
        nextStep: "test",
        resetSteps: [...REPAIR_STEPS],
        sourceArtifact: repair.sourceArtifact,
        sourceArtifactDigest: repair.sourceArtifactDigest,
        sourceEvidenceId: repair.sourceEvidenceId,
        sourceTestRevisionDigest: repair.sourceTestRevision.digest,
        blockingFindingIds: repair.blockingFindings.map((finding) => finding.findingId),
      });
    } catch (error) {
      return Envelope.fail(
        "run",
        "repair-test-review",
        error.code || "TEST_REVIEW_REPAIR_INVALID",
        error.message,
      );
    }
  }
}
