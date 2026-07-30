import { Envelope } from "../../lib/flow-envelope.js";
import { FlowCommand } from "./base-command.js";
import {
  FinalizeJournalRecoveryAdapter,
  FinalizeJournalReplayRequest,
  FinalizeJournalReplayResult,
} from "./finalize-journal-recovery-adapter.js";
import { NormalRecoveryDispatcher } from "./normal-recovery-dispatcher.js";
import { findStepById } from "./step-tree.js";

function finalizeReplayStarted(state) {
  return findStepById(state.steps || [], "finalize-cleanup")?.status === "in_progress";
}

/**
 * Compatibility-free public recovery entrypoint. Its name is retained for an
 * explicitly requested recovery, but it delegates only to normal Flow state.
 */
export default class RunDirectRecoveryCommand extends FlowCommand {
  constructor() {
    super({ explicitTargetResolution: true });
  }

  async execute(ctx) {
    try {
      if (finalizeReplayStarted(ctx.flowState)) {
        const replay = await new FinalizeJournalRecoveryAdapter({
          flowManager: ctx.flowManager,
          mainRoot: ctx.mainRoot || ctx.root,
        }).replay(FinalizeJournalReplayRequest.fromFlowState(ctx.flowState));
        return Envelope.ok("run", "direct", {
          status: replay instanceof FinalizeJournalReplayResult ? "journal-replayed" : "unavailable",
          recovery: replay.toJSON(),
        });
      }
      const dispatcher = new NormalRecoveryDispatcher({
        flowManager: ctx.flowManager,
        root: ctx.root,
        mainRoot: ctx.mainRoot || ctx.root,
      });
      const result = dispatcher.execute({
        state: ctx.flowState,
        recordId: ctx.recordId || null,
      });
      return Envelope.ok("run", "direct", result.toJSON());
    } catch (error) {
      return Envelope.fail(
        "run",
        "direct",
        error.code || "RECOVERY_DISPATCH_FAILED",
        error.message,
      );
    }
  }
}
