import { FlowTargetExpectation } from "../../lib/flow-target-guard.js";
import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";
import {
  RecoveryUnavailable,
} from "./recovery-contract.js";
import {
  readPersistedFinalizeCleanupJournal,
  RunFinalizeCleanupCommand,
} from "./run-finalize-cleanup.js";

const FINALIZE_JOURNAL_PHASES = new Set([
  "prepared",
  "worktree-removed",
  "branch-deleted",
  "validated",
  "pointer-written",
  "completed",
]);

class FinalizeJournalPhase {
  constructor(name) {
    this.name = requireString(name, "finalize journal phase", { max: 100 });
    if (!FINALIZE_JOURNAL_PHASES.has(this.name)) {
      throw new Error(`unknown finalize journal phase: ${this.name}`);
    }
    Object.freeze(this);
  }

  static from(value) {
    return value instanceof FinalizeJournalPhase ? value : new FinalizeJournalPhase(value);
  }
}

function requireString(value, field, { max = 4_096 } = {}) {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function requireIssue(value, field) {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer or null`);
  }
  return value;
}

function unavailable(reason, message, actionId, description) {
  return new RecoveryUnavailable({
    reason,
    message,
    nextAction: { actionId, description },
  });
}

function cleanupFailureCode(result) {
  return result?.errors?.[0]?.code || "FINALIZE_JOURNAL_REPLAY_STOPPED";
}

function unavailableForError(error) {
  const code = error?.code || "FINALIZE_JOURNAL_AUTHORITY_UNAVAILABLE";
  if (code === "REPOSITORY_FLOW_OPERATION_BUSY" || code === "REPOSITORY_MAINTENANCE_BUSY") {
    return unavailable(
      "repository-lock-unavailable",
      "The finalize journal was not replayed because another repository operation owns the lock.",
      "inspect-repository-lock",
      "Inspect the repository operation lock, then retry the matching finalize journal replay.",
    );
  }
  if (code === "FLOW_TARGET_NOT_FOUND" || code === "FLOW_TARGET_AMBIGUOUS" || code === "ACTIVE_FLOW_MISMATCH") {
    return unavailable(
      "finalize-target-unavailable",
      "The selected Flow no longer resolves to the exact finalize target. No journal replay was started.",
      "inspect-finalize-target",
      "Inspect the active Flow identity and select the exact run before replaying finalize cleanup.",
    );
  }
  return unavailable(
    "finalize-authority-unavailable",
    `The matching finalize journal could not be replayed because its authority is unavailable (${code}).`,
    "inspect-finalize-journal",
    "Inspect the durable finalize journal and the current Git, merge, and cleanup authority before retrying.",
  );
}

/** The durable identity shared by the Flow state and Issue #473 teardown journal. */
export class FinalizeJournalIdentity {
  constructor({ runId, issue = null, specId, featureBranch, baseBranch }) {
    this.runId = requireString(runId, "finalize journal runId", { max: 300 });
    this.issue = requireIssue(issue, "finalize journal issue");
    this.specId = requireString(specId, "finalize journal specId", { max: 300 });
    this.featureBranch = requireString(featureBranch, "finalize journal featureBranch", { max: 300 });
    this.baseBranch = requireString(baseBranch, "finalize journal baseBranch", { max: 300 });
    Object.freeze(this);
  }

  static fromFlowState(state) {
    return new FinalizeJournalIdentity(state);
  }

  equals(other) {
    return other instanceof FinalizeJournalIdentity
      && this.runId === other.runId
      && this.issue === other.issue
      && this.specId === other.specId
      && this.featureBranch === other.featureBranch
      && this.baseBranch === other.baseBranch;
  }

  targetExpectation() {
    return new FlowTargetExpectation({
      expectRunId: this.runId,
      expectSpec: this.specId,
      ...(this.issue == null ? { expectNoIssue: true } : { expectIssue: this.issue }),
    });
  }

  toJSON() {
    return {
      runId: this.runId,
      issue: this.issue,
      specId: this.specId,
      featureBranch: this.featureBranch,
      baseBranch: this.baseBranch,
    };
  }
}

/** A typed read-only view of a journal owned by Issue #473. */
export class FinalizeJournalSnapshot {
  constructor({ transactionId, identity, phase, transaction }) {
    this.transactionId = requireString(transactionId, "finalize journal transactionId", { max: 300 });
    this.identity = identity instanceof FinalizeJournalIdentity
      ? identity
      : new FinalizeJournalIdentity(identity);
    this.phase = FinalizeJournalPhase.from(phase);
    if (transaction == null || typeof transaction !== "object") {
      throw new Error("finalize journal snapshot transaction is required");
    }
    this.transaction = transaction;
    Object.freeze(this);
  }

  static fromTransaction(transaction) {
    if (transaction == null || typeof transaction !== "object") {
      throw new Error("persisted finalize teardown transaction is required");
    }
    return new FinalizeJournalSnapshot({
      transactionId: transaction.transactionId,
      identity: transaction.identity,
      phase: transaction.phase,
      transaction,
    });
  }

  get completed() { return this.phase.name === "completed"; }
}

/** Exact target selected before a matching journal may be replayed. */
export class FinalizeJournalReplayRequest {
  constructor({ identity }) {
    this.identity = identity instanceof FinalizeJournalIdentity
      ? identity
      : new FinalizeJournalIdentity(identity);
    this.expectation = this.identity.targetExpectation();
    Object.freeze(this);
  }

  static fromFlowState(state) {
    return new FinalizeJournalReplayRequest({ identity: FinalizeJournalIdentity.fromFlowState(state) });
  }
}

/** Boundary for the existing durable journal API. */
export class FinalizeJournalReader {
  read(_mainRoot, _state) {
    throw new Error("finalize journal reader must implement read()");
  }
}

/** Reads, but never creates or changes, Issue #473's durable journal. */
export class PersistedFinalizeJournalReader extends FinalizeJournalReader {
  read(_mainRoot, state) {
    const journal = readPersistedFinalizeCleanupJournal(state);
    if (journal == null) return null;
    return new FinalizeJournalSnapshot({
      transactionId: journal.runId,
      identity: state,
      phase: journal.phase,
      transaction: journal,
    });
  }
}

/** Boundary for replaying an already-matching journal through the normal cleanup command. */
export class FinalizeJournalReplayExecutor {
  async replay(_context) {
    throw new Error("finalize journal replay executor must implement replay()");
  }
}

export class RunFinalizeCleanupReplayExecutor extends FinalizeJournalReplayExecutor {
  constructor(command = new RunFinalizeCleanupCommand()) {
    super();
    if (!command || typeof command.executeOwned !== "function") {
      throw new Error("finalize journal replay requires the existing finalize cleanup command");
    }
    this.command = command;
    Object.freeze(this);
  }

  replay(context) {
    return this.command.executeOwned(context);
  }
}

export class FinalizeJournalReplayResult {
  constructor({ identity, journal, cleanupResult }) {
    this.identity = identity instanceof FinalizeJournalIdentity
      ? identity
      : new FinalizeJournalIdentity(identity);
    if (!(journal instanceof FinalizeJournalSnapshot)) {
      throw new Error("finalize journal replay result requires a journal snapshot");
    }
    this.journal = journal;
    this.cleanupResult = cleanupResult;
    Object.freeze(this);
  }

  toJSON() {
    return {
      replayed: true,
      identity: this.identity.toJSON(),
      transactionId: this.journal.transactionId,
      resumedFromPhase: this.journal.phase.name,
      cleanup: this.cleanupResult?.toJSON?.() || this.cleanupResult,
    };
  }
}

/**
 * Adapts recovery into the existing Issue #473 journal replay. It has no
 * cleanup state or retry state of its own: an absent, stale, or foreign
 * journal is a typed RecoveryUnavailable result rather than a new transaction.
 */
export class FinalizeJournalRecoveryAdapter {
  constructor({
    flowManager,
    mainRoot,
    journalReader = new PersistedFinalizeJournalReader(),
    replayExecutor = new RunFinalizeCleanupReplayExecutor(),
  }) {
    if (!flowManager || typeof flowManager.resolveExplicitFlowTargetForRead !== "function") {
      throw new Error("finalize journal recovery requires an exact-target flow manager");
    }
    this.flowManager = flowManager;
    this.mainRoot = requireString(mainRoot, "finalize journal mainRoot", { max: 4_096 });
    if (!(journalReader instanceof FinalizeJournalReader)) {
      throw new Error("finalize journal recovery requires a journal reader");
    }
    if (!(replayExecutor instanceof FinalizeJournalReplayExecutor)) {
      throw new Error("finalize journal recovery requires a replay executor");
    }
    this.journalReader = journalReader;
    this.replayExecutor = replayExecutor;
    Object.freeze(this);
  }

  async replay(request) {
    if (!(request instanceof FinalizeJournalReplayRequest)) {
      throw new Error("finalize journal replay requires an exact replay request");
    }
    const operation = new RepositoryFlowOperationLock({
      mainRoot: this.mainRoot,
      allowProcessOwnerBorrow: false,
    });
    let ownerToken = null;
    let primaryError = null;
    let result = null;
    try {
      ownerToken = operation.acquire();
      operation.assertOwned();
      const resolved = this.flowManager.resolveExplicitFlowTargetForRead(request.expectation);
      const currentIdentity = FinalizeJournalIdentity.fromFlowState(resolved.state);
      if (!request.identity.equals(currentIdentity)) {
        result = unavailable(
          "finalize-target-mismatch",
          "The active Flow changed after finalize recovery was selected. No journal replay was started.",
          "inspect-finalize-target",
          "Inspect the active Flow identity and select the exact run before replaying finalize cleanup.",
        );
      } else {
        const journal = this.journalReader.read(this.mainRoot, resolved.state);
        if (journal == null) {
          result = unavailable(
            "finalize-journal-unavailable",
            "No matching durable finalize journal exists for this Flow. Recovery did not create a cleanup transaction.",
            "inspect-finalize-journal",
            "Inspect the normal finalize state and Issue #473 journal evidence before attempting recovery.",
          );
        } else if (!journal.identity.equals(currentIdentity)) {
          result = unavailable(
            "finalize-journal-target-mismatch",
            "The durable finalize journal belongs to a different Flow. No journal replay was started.",
            "inspect-finalize-journal",
            "Inspect the journal identity and the active Flow identity before attempting recovery.",
          );
        } else if (journal.completed) {
          result = unavailable(
            "finalize-journal-already-completed",
            "The matching finalize journal is already complete. Recovery did not create or replay cleanup work.",
            "inspect-normal-flow",
            "Inspect the normal Flow completion state and its finalization receipt.",
          );
        } else {
          const cleanupResult = await this.replayExecutor.replay({
            root: resolved.authorityRoot,
            mainRoot: this.mainRoot,
            flowManager: this.flowManager,
            flowState: resolved.state,
            repositoryOperationOwnerToken: ownerToken,
            requirePersistedJournal: true,
            autoRescue: false,
            force: false,
          });
          if (cleanupResult?.ok === false) {
            const code = cleanupFailureCode(cleanupResult);
            result = unavailable(
              "finalize-authority-unavailable",
              `The matching finalize journal was not replayed because cleanup authority rejected it (${code}).`,
              "inspect-finalize-journal",
              "Inspect the durable finalize journal and the current Git, merge, and cleanup authority before retrying.",
            );
          } else {
            result = new FinalizeJournalReplayResult({
              identity: currentIdentity,
              journal,
              cleanupResult,
            });
          }
        }
      }
    } catch (error) {
      primaryError = error;
    } finally {
      if (ownerToken != null) {
        try {
          operation.release();
        } catch (releaseError) {
          primaryError = primaryError == null
            ? releaseError
            : new AggregateError(
              [primaryError, releaseError],
              "finalize journal replay and operation lock release both failed",
              { cause: primaryError },
            );
        }
      }
    }
    return primaryError == null ? result : unavailableForError(primaryError);
  }
}
