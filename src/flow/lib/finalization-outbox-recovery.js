import path from "node:path";
import {
  FlowOutbox,
  FlowOutboxRecoveryClaim,
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
import { container } from "../../lib/container.js";

const FINALIZATION_COMMANDS = Object.freeze({
  "finalize-commit": "finalize-commit",
  "finalize-merge": "finalize-merge",
  "finalize-sync": "finalize-sync",
});

function recoveryCommand(command, state, binding) {
  if (binding) return binding.guardCommand(`senti flow run ${command}`);
  const guards = guardFlagsForState(state);
  return `senti flow run ${command}${guards ? ` ${guards}` : ""}`;
}

function refreshCommand(state, binding) {
  if (binding) return binding.guardCommand("senti flow get next-action");
  const guards = guardFlagsForState(state);
  return `senti flow get next-action${guards ? ` ${guards}` : ""}`;
}

function featureMetadataPaths(state) {
  if (typeof state.spec !== "string" || state.spec === "") return [];
  const specDirectory = path.posix.dirname(state.spec.replaceAll("\\", "/"));
  return [
    `${specDirectory}/flow.json`,
    `${specDirectory}/issue-log.json`,
  ];
}

function mainRootFor(ctx, state) {
  if (state.worktree !== true) return ctx.root;
  return ctx.flowManager.resolveWorktreePaths(state).mainRepoPath || ctx.root;
}

function configuredPushRemote() {
  const config = container.has("config") ? container.get("config") : null;
  return config?.flow?.push?.remote || "origin";
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
    const entry = new FlowOutbox(this.state.outbox || []).find(identity);
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

    const outbox = new FlowOutbox(this.state.outbox || []);
    outbox.reopenFailedExact(new FlowOutboxRecoveryClaim({
      identity,
      attempt: entry.attempt,
      failure: entry.failure,
      recoveryKey,
    }));
    this.state.outbox = outbox.toJSON();
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
    const mainRoot = mainRootFor(this.ctx, this.state);
    if (this.target.stepId === "finalize-merge") {
      return hasOutboxCommit({
        root: mainRoot,
        ref: this.state.baseBranch,
        idempotencyKey: entry.idempotencyKey,
      });
    }
    const root = this.target.stepId === "finalize-sync" ? mainRoot : this.ctx.root;
    return hasOutboxCommit({ root, ref: "HEAD", idempotencyKey: entry.idempotencyKey });
  }

  #preSyncConflictRecovery(entry) {
    if (this.target.stepId !== "finalize-merge") return null;
    const failure = entry.latestFailure;
    if (!failure) return null;
    const recovery = failure.code === "MERGE_PRE_SYNC_CONFLICT"
      ? failure.recovery
      : this.#legacyPreSyncConflictRecovery(failure);
    if (recovery == null) return null;
    const { baseRef, baseHead } = recovery;
    const featureRoot = this.state.worktree === true
      ? (this.ctx.flowManager.resolveWorktreePaths(this.state).worktreePath || this.ctx.root)
      : this.ctx.root;
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

  #legacyPreSyncConflictRecovery(failure) {
    if (!String(failure.failure || "").startsWith("Pre-merge rebase detected conflicts in ")) return null;
    const baseRef = `${configuredPushRemote()}/${this.state.baseBranch}`;
    const featureRoot = this.state.worktree === true
      ? (this.ctx.flowManager.resolveWorktreePaths(this.state).worktreePath || this.ctx.root)
      : this.ctx.root;
    const baseHead = runGit(["-C", featureRoot, "rev-parse", baseRef]);
    if (!baseHead.ok || baseHead.stdout.trim() === "") return null;
    return { baseRef, baseHead: baseHead.stdout.trim() };
  }

  #inspectMergeReadiness() {
    try {
      new FinalizeMergeTransaction({
        featureRoot: this.ctx.root,
        mainRoot: mainRootFor(this.ctx, this.state),
        baseBranch: this.state.baseBranch,
        featureBranch: this.state.featureBranch,
        commitMessage: "senti finalize merge recovery inspection",
      }).inspect({ allowFeatureMetadataPaths: featureMetadataPaths(this.state) });
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
