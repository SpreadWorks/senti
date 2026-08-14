import {
  FlowOutboxRecoveryClaim,
  FlowOutboxStore,
  finalizationOutboxIdentity,
} from "./flow-outbox.js";
import { hasOutboxCommit } from "./run-finalize.js";
import { FinalizeMergeTransaction } from "./finalize-merge-transaction.js";
import {
  BlockedDirective,
  ExecuteCommandDirective,
  RepairEvidenceDirective,
} from "./next-action-directive.js";
import { guardFlagsForState } from "./user-action-prompt.js";
import { runGit } from "../../lib/git-helpers.js";
import { FinalizeFlowArtifactRegistry } from "./repair-state-identity.js";

const FINALIZATION_COMMANDS = Object.freeze({
  report: "report",
  "finalize-commit": "finalize-commit",
  "finalize-merge": "finalize-merge",
  "finalize-sync": "finalize-sync",
});

function recoveryCommand(command, state, binding) {
  if (binding) return binding.guardCommand(`sennel flow run ${command}`);
  const guards = guardFlagsForState(state);
  return `sennel flow run ${command}${guards ? ` ${guards}` : ""}`;
}

function refreshCommand(state, binding) {
  if (binding) return binding.guardCommand("sennel flow get next-action");
  const guards = guardFlagsForState(state);
  return `sennel flow get next-action${guards ? ` ${guards}` : ""}`;
}

function featureMetadataPaths(location) {
  return [
    location.relativeFlowStateFile,
    location.relativeIssueLogFile,
  ];
}

function mainRootFor(ctx, state) {
  if (state.worktree !== true) return ctx.root;
  return ctx.flowManager.resolveWorktreePaths(state).mainRepoPath || ctx.root;
}

export class FinalizationOutboxRecovery {
  constructor({ ctx, state, target, binding = null }) {
    this.ctx = ctx;
    this.state = state;
    this.target = target;
    this.binding = binding;
    Object.freeze(this);
  }

  resolve() {
    if (this.target.scope !== "flow") return null;
    const command = FINALIZATION_COMMANDS[this.target.stepId];
    if (!command) return null;

    const identity = finalizationOutboxIdentity(this.state, this.target.stepId);
    const outbox = new FlowOutboxStore(this.ctx.flowManager, { specId: this.state.specId });
    const entry = outbox.status(identity);
    if (entry?.status !== "failed") return null;
    const preSyncConflict = this.#preSyncConflictRecovery(entry);
    if (preSyncConflict?.directive) return preSyncConflict;
    const recoveryKey = preSyncConflict?.recoveryKey ?? null;
    if (
      entry.exactRecoveryReceipt
      && (
        recoveryKey == null
        || entry.exactRecoveryReceipt.recoveryKey === recoveryKey
      )
    ) {
      return {
        directive: new BlockedDirective({
          code: "FINALIZE_OUTBOX_RECOVERY_EXHAUSTED",
          reason: `The exact recovery for ${this.target.stepId} was already consumed and the operation failed again: ${entry.failure}`,
          resumeInstruction: "Inspect and repair the persisted failure before attempting a new Flow operation.",
        }),
        stateChanged: false,
      };
    }

    const durable = this.#isDurable(entry);
    if (this.target.stepId !== "finalize-merge" && !durable) return null;
    if (this.target.stepId === "finalize-merge" && !durable) {
      const readiness = this.#inspectMergeReadiness();
      if (readiness) return readiness;
    }

    outbox.reopenFailedExact(new FlowOutboxRecoveryClaim({
      identity,
      attempt: entry.attempt,
      failure: entry.failure,
      recoveryKey,
    }));
    return {
      directive: new ExecuteCommandDirective({
        actionId: `RECOVER_${this.target.stepId.replaceAll("-", "_").toUpperCase()}_OUTBOX`,
        nextAction: recoveryCommand(command, this.state, this.binding),
        instruction: `Apply the one persisted exact recovery for ${this.target.stepId}. The outbox key is unchanged, so a durable side effect is resumed rather than duplicated.`,
        reason: durable
          ? `The ${this.target.stepId} side effect is durable, but its lifecycle post-hook did not finish.`
          : "The isolated merge preflight is clean; one exact recovery is available for the incomplete merge transaction.",
      }),
      stateChanged: true,
    };
  }

  #isDurable(entry) {
    if (this.target.stepId === "report") return this.#hasCanonicalReport(entry);
    const mainRoot = mainRootFor(this.ctx, this.state);
    if (this.target.stepId === "finalize-merge") {
      return hasOutboxCommit({
        root: mainRoot,
        ref: this.state.baseBranch,
        idempotencyKey: entry.idempotencyKey,
      });
    }
    const root = this.target.stepId === "finalize-sync"
      ? mainRoot
      : (this.ctx.executionRoot || this.ctx.root);
    return hasOutboxCommit({ root, ref: "HEAD", idempotencyKey: entry.idempotencyKey });
  }

  /**
   * A report is deliberately produced before the finalize commit, so commit
   * markers cannot prove its external-effect recovery is safe.  Version 1
   * instead proves durability through the catalog-owned pending report bound
   * to this exact outbox identity.  No path inference or sibling read is
   * allowed here.
   */
  #hasCanonicalReport(entry) {
    if (this.state?.schemaRevision !== 3) return false;
    try {
      const artifact = this.ctx.flowManager.readArtifact({
        specId: this.state.specId,
        logicalKey: "report",
        consumerNodeId: "report",
        optional: true,
      });
      if (artifact === null) return false;
      const report = JSON.parse(artifact.bytes.toString("utf8"));
      const delivery = report?.data?.delivery;
      return (delivery?.status === "pending" || delivery?.status === "done")
        && delivery.idempotencyKey === entry.idempotencyKey;
    } catch {
      // A malformed or unauthorized report is not durable recovery evidence.
      // The caller leaves the failed outbox unchanged and fails closed.
      return false;
    }
  }

  #preSyncConflictRecovery(entry) {
    if (this.target.stepId !== "finalize-merge") return null;
    const failure = entry.latestFailure;
    if (!failure) return null;
    const recovery = failure.code === "MERGE_PRE_SYNC_CONFLICT" ? failure.recovery : null;
    if (recovery == null) return null;
    const { baseRef, baseHead } = recovery;
    const featureRoot = this.state.worktree === true
      ? (this.ctx.flowManager.resolveWorktreePaths(this.state).worktreePath || this.ctx.root)
      : (this.ctx.executionRoot || this.ctx.root);
    const ancestry = runGit([
      "-C",
      featureRoot,
      "merge-base",
      "--is-ancestor",
      baseHead,
      "HEAD",
    ]);
    if (ancestry.ok) return { recoveryKey: baseHead };
    if (ancestry.status === 1) {
      return {
        directive: new RepairEvidenceDirective({
          actionId: "REPAIR_FINALIZE_MERGE_REBASE",
          evidenceKind: "finalize-merge",
          phase: "finalize",
          instruction: `Rebase the managed worktree onto ${baseRef}, resolve every persisted pre-sync conflict, complete the rebase, then refresh next-action. Do not rerun finalize-merge until ${baseRef}@${baseHead} is an ancestor of the feature HEAD.`,
          reason: `The previous finalize merge stopped at a pre-sync conflict against ${baseRef}@${baseHead}.`,
          nextAction: refreshCommand(this.state, this.binding),
        }),
        stateChanged: false,
      };
    }
    return {
      directive: new BlockedDirective({
        code: "MERGE_REBASE_RECOVERY_UNAVAILABLE",
        reason: `Unable to verify whether the feature contains the persisted pre-sync base ${baseRef}@${baseHead}: ${ancestry.stderr || ancestry.stdout}`,
        resumeInstruction: "Restore access to the managed worktree and Git object database, then refresh the guarded Flow directive.",
      }),
      stateChanged: false,
    };
  }

  #inspectMergeReadiness() {
    try {
      const location = this.ctx.flowManager.specLocation(this.state.specId);
      const flowArtifactRegistry = new FinalizeFlowArtifactRegistry(location.relativeSpecFile);
      new FinalizeMergeTransaction({
        featureRoot: this.ctx.executionRoot || this.ctx.root,
        mainRoot: mainRootFor(this.ctx, this.state),
        baseBranch: this.state.baseBranch,
        featureBranch: this.state.featureBranch,
        commitMessage: "sennel finalize merge recovery inspection",
        flowArtifactRegistry,
      }).inspect({
        allowFeatureMetadataPaths: featureMetadataPaths(location),
        flowArtifactRegistry,
      });
      return null;
    } catch (error) {
      return {
        directive: new BlockedDirective({
          code: error?.code || "FINALIZE_MERGE_RECOVERY_UNAVAILABLE",
          reason: error?.message || "The isolated merge preflight could not be completed.",
          resumeInstruction: "Resolve the reported repository state, then refresh the Flow directive.",
        }),
        stateChanged: false,
      };
    }
  }
}

export function resolveFinalizationOutboxRecovery(ctx, state, target, binding = null) {
  return new FinalizationOutboxRecovery({ ctx, state, target, binding }).resolve();
}
