import { Envelope } from "../../lib/flow-envelope.js";
import { FLOW_DISPATCH_INVOCATION_ID_ENV } from "./dispatch-invocation.js";
import { FlowCommand } from "./base-command.js";
import {
  WORKER_ARTIFACT_HANDOFF_REQUEST_ENV,
  WorkerArtifactHandoffError,
  sourceMutationManifestForWorker,
} from "./worker-artifact-handoff.js";

/** Materialize the current source Attempt's manifest without mutating Flow state. */
export default class RunSourceMutationManifestCommand extends FlowCommand {
  constructor() { super({ requiresFlow: false, targetGuard: false, skipAmbientFlowContext: true }); }

  execute() {
    try {
      return Envelope.ok("run", "source-mutation-manifest", sourceMutationManifestForWorker({
        requestPath: process.env[WORKER_ARTIFACT_HANDOFF_REQUEST_ENV],
        invocationId: process.env[FLOW_DISPATCH_INVOCATION_ID_ENV],
      }));
    } catch (error) {
      const classification = error instanceof WorkerArtifactHandoffError ? error.classification : "invalid";
      return Envelope.fail("run", "source-mutation-manifest", error.code || "FLOW_SOURCE_HANDOFF_MANIFEST_INVALID", error.message || String(error), {
        classification,
        retryBudgetConsumed: false,
        retryable: error?.retryable === true,
        recoveryPossible: error?.recoveryPossible === true,
      });
    }
  }
}
