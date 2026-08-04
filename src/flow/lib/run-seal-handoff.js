import { Envelope } from "../../lib/flow-envelope.js";
import { FLOW_DISPATCH_INVOCATION_ID_ENV } from "./dispatch-invocation.js";
import { FlowCommand } from "./base-command.js";
import {
  WORKER_ARTIFACT_HANDOFF_REQUEST_ENV,
  WorkerArtifactHandoffError,
  sealWorkerArtifactHandoff,
} from "./worker-artifact-handoff.js";

/**
 * Seal a dispatcher's execution-root artifact payload for parent publication.
 * This command deliberately owns no Flow mutation authority.
 */
export default class RunSealHandoffCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false, targetGuard: false });
  }

  execute() {
    try {
      const result = sealWorkerArtifactHandoff({
        requestPath: process.env[WORKER_ARTIFACT_HANDOFF_REQUEST_ENV],
        invocationId: process.env[FLOW_DISPATCH_INVOCATION_ID_ENV],
      });
      return Envelope.ok("run", "seal-handoff", result);
    } catch (error) {
      const classification = error instanceof WorkerArtifactHandoffError
        ? error.classification
        : "invalid";
      return Envelope.fail(
        "run",
        "seal-handoff",
        error.code || "FLOW_ARTIFACT_HANDOFF_INVALID",
        error.message || String(error),
        {
          classification,
          retryBudgetConsumed: false,
          recoveryPossible: error?.recoveryPossible === true,
        },
      );
    }
  }
}
