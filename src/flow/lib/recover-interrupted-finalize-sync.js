import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";
import { runtimeLogFileForContext } from "../../lib/runtime-log.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { createLifecycleStepTransition } from "./lifecycle-step-transition.js";
import { FinalizeFlowStateOwner } from "./finalize-flow-state-owner.js";
import { FlowOutbox, finalizationOutboxIdentity } from "./flow-outbox.js";
import { FinalizeSyncInterruptedError } from "./finalize-sync-diagnostics.js";
import { finalizeOnError } from "./run-finalize.js";
import { findStepById } from "./step-tree.js";

function incompleteRuntimeLog(root, state) {
  const file = runtimeLogFileForContext({
    root,
    specId: specIdFromPath(state.spec),
  });
  const block = file.blocks()
    .filter((candidate) => (
      candidate.runId === state.runId
      && candidate.command === "flow run finalize-sync"
    ))
    .at(-1) || null;
  if (!block || block.complete) return null;
  return {
    runId: block.runId,
    sequence: block.sequence,
    command: block.command,
    startedAt: block.startedAt,
    complete: false,
  };
}

/**
 * Settle a stale, pre-return finalize-sync attempt. The repository operation
 * lock proves that no sync process currently owns the side-effect boundary;
 * only then can its pending outbox be converted into an auditable skip.
 */
export function recoverInterruptedFinalizeSync(ctx) {
  const localState = ctx.flowState;
  const localSyncStep = findStepById(localState?.steps || [], "finalize-sync");
  if (localSyncStep?.status !== "in_progress") return { recovered: false, busy: false };
  const localIdentity = finalizationOutboxIdentity(localState, "finalize-sync");
  const localEntry = new FlowOutbox(localState.outbox || []).find(localIdentity);
  if (localEntry?.status !== "pending") return { recovered: false, busy: false };
  if (typeof ctx.flowManager?.forRoot !== "function") return { recovered: false, busy: false };

  const stateOwner = FinalizeFlowStateOwner.forMainContext(ctx);
  const state = stateOwner.loadReadOnly();
  if (!state) return { recovered: false, busy: false };
  const syncStep = findStepById(state.steps || [], "finalize-sync");
  if (syncStep?.status !== "in_progress") return { recovered: false, busy: false };
  const identity = finalizationOutboxIdentity(state, "finalize-sync");
  const entry = new FlowOutbox(state.outbox || []).find(identity);
  if (entry?.status !== "pending") return { recovered: false, busy: false };

  const operation = new RepositoryFlowOperationLock({ mainRoot: stateOwner.mainRepoPath });
  let token;
  try {
    token = operation.acquire();
  } catch (error) {
    if (["REPOSITORY_FLOW_OPERATION_BUSY", "REPOSITORY_MAINTENANCE_BUSY"].includes(error.code)) {
      return { recovered: false, busy: true };
    }
    throw error;
  }

  const runtimeLog = incompleteRuntimeLog(stateOwner.mainRepoPath, state);
  const interruption = new FinalizeSyncInterruptedError({ runtimeLog });
  try {
    stateOwner.outbox({ operationOwnerToken: token }).fail(identity, interruption);
    const transition = createLifecycleStepTransition({
      flowState: stateOwner.loadReadOnly(),
      stepId: "finalize-sync",
      status: "skipped",
      event: "finalize:interrupted",
      taskId: null,
      currentStepId: "finalize-sync",
    });
    stateOwner.updateStepStatus(transition, { operationOwnerToken: token });
  } finally {
    operation.release();
  }
  finalizeOnError("finalize-sync", "interrupted")({
    ...ctx,
    root: stateOwner.authorityRoot,
    flowManager: stateOwner.flowManager,
    flowState: stateOwner.loadReadOnly(),
    specId: stateOwner.specId,
  }, interruption);
  return { recovered: true, busy: false, stateOwner, interruption };
}
