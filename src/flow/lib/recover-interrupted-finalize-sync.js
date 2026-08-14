import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";
import { runtimeLogFileForContext } from "../../lib/runtime-log.js";
import { createLifecycleStepTransition } from "./lifecycle-step-transition.js";
import { FinalizeFlowStateOwner } from "./finalize-flow-state-owner.js";
import { FlowOutboxStore, finalizationOutboxIdentity } from "./flow-outbox.js";
import { FinalizeSyncInterruptedError } from "./finalize-sync-diagnostics.js";
import { findStepById } from "./step-tree.js";

function incompleteRuntimeLog(root, state) {
  const file = runtimeLogFileForContext({
    root,
    specId: state.specId,
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
  if (typeof ctx.flowManager?.forRoot !== "function") return { recovered: false, busy: false };
  const localIdentity = finalizationOutboxIdentity(localState, "finalize-sync");
  const localEntry = new FlowOutboxStore(ctx.flowManager, { specId: localState.specId }).status(localIdentity);
  if (localEntry?.status !== "pending") return { recovered: false, busy: false };

  const stateOwner = FinalizeFlowStateOwner.forMainContext(ctx);
  const state = stateOwner.loadReadOnly();
  if (!state) return { recovered: false, busy: false };
  const syncStep = findStepById(state.steps || [], "finalize-sync");
  if (syncStep?.status !== "in_progress") return { recovered: false, busy: false };
  const identity = finalizationOutboxIdentity(state, "finalize-sync");
  const entry = stateOwner.outbox().status(identity);
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
  // The skipped leaf no longer owns a producer Activity, so its issue-log
  // evidence must be appended only after next-action claims finalize-cleanup.
  // The caller performs that second, ordered half of recovery; attempting it
  // here would leave a non-authoritative direct issue-log writer.
  return { recovered: true, busy: false, stateOwner, interruption };
}

/**
 * Claim cleanup with the interrupted-sync audit in its same Store Activity.
 * The cleanup Attempt owns the issue-log publication, so a crash cannot leave
 * recovery state without its cataloged explanation.
 */
export function recordInterruptedFinalizeSyncIssue(ctx, recovery) {
  if (!recovery?.recovered || !recovery.interruption) return;
  const state = recovery.stateOwner.loadReadOnly();
  const runtimeLog = recovery.interruption.data?.runtimeLog;
  recovery.stateOwner.flowManager.beginInterruptedFinalizeSyncCleanup({
    specId: recovery.stateOwner.specId,
    entry: {
      step: "finalize-sync",
      reason: recovery.interruption.message,
      trigger: "interrupted",
      timestamp: new Date().toISOString(),
      ...(runtimeLog ? { runtimeLog } : {}),
    },
    idempotencyKey: `interrupted-finalize-sync-${state.runId}-${runtimeLog?.sequence ?? "unknown"}`,
  });
}
