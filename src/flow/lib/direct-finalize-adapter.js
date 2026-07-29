import fs from "node:fs";
import path from "node:path";

import { Envelope } from "../../lib/flow-envelope.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { FlowTargetExpectation } from "../../lib/flow-target-guard.js";
import {
  GitCommitPathProbeError,
  GitCommitPathSet,
  GitStatusPathSet,
  runGit,
} from "../../lib/git-helpers.js";
import {
  DirectAbortArchive,
  DirectCompletionReceipt,
  DirectGitEvidence,
  DirectIntegrationReceipt,
  DirectRetainedWorktree,
  DirectSkippedStep,
} from "./direct-completion.js";
import {
  DirectFlowSession,
  DirectFlowTarget,
  DirectVerificationResult,
} from "./direct-flow-session.js";
import {
  inspectNormalFinalizeAncestorEvidence,
  revalidatePersistedIntegrationReceipt,
} from "./direct-integration-evidence.js";
import { DirectResolutionPlan } from "./direct-resolution-plan.js";
import { RepairArtifactRegistry } from "./repair-state-identity.js";
import { hasOutboxCommit } from "./run-finalize.js";
import { IssueLogStore } from "./issue-log-store.js";
import {
  readPersistedFinalizeTeardownTransaction,
  RunFinalizeCleanupCommand,
} from "./run-finalize-cleanup.js";
import {
  UserActionChoice,
  UserActionImpact,
  UserActionPrompt,
  attachUserActionPrompt,
  guardFlagsForState,
} from "./user-action-prompt.js";

function directMutationOptions(authority, options = {}) {
  return {
    ...options,
    operationOwnerToken: authority.repositoryOperationOwnerToken || null,
  };
}

function gitValue(args, label) {
  const result = runGit(args);
  if (!result.ok) {
    const error = new Error(`${label}: ${result.stderr || result.stdout || "git command failed"}`);
    error.code = "DIRECT_GIT_PROBE_FAILED";
    throw error;
  }
  return result.stdout.trim();
}

function hasOnlyFlowOwnedArtifacts(statusOutput, specPath) {
  const paths = GitStatusPathSet.fromPorcelainV1Z(statusOutput);
  const registry = new RepairArtifactRegistry(specPath);
  return paths.size > 0 && paths.every((entry) => registry.owns(entry));
}

const PENDING_RECOVERY_REFRESHABLE_CHECKS = new Set([
  "worktree-binding",
  "active-registry-cas",
  "feature-history",
]);

class PendingIntegrationRecovery {
  constructor({
    mainRoot,
    state,
    session,
    plan,
    receipt,
    snapshot,
    force = false,
  }) {
    this.session = DirectFlowSession.fromStored(session);
    this.plan = DirectResolutionPlan.fromStored(plan);
    this.receipt = DirectIntegrationReceipt.fromStored(receipt);
    this.snapshot = snapshot;
    if (
      this.session.phase !== "MERGE_ONLY_FINALIZE"
      || this.receipt.status !== "pending"
      || this.session.completion?.status !== "pending-merge"
      || this.session.completion?.integrationReceiptId !== this.receipt.receiptId
      || state.directCompletionReceipt != null
    ) {
      throw Object.assign(new Error(
        "pending integration recovery requires an unmerged receipt and pending-merge session",
      ), { code: "DIRECT_INTEGRATION_RECOVERY_INVALID" });
    }
    if (
      this.receipt.runId !== state.runId
      || this.receipt.spec !== state.spec
      || this.receipt.planId !== this.plan.planId
      || this.receipt.planRevision !== this.plan.revision
    ) {
      throw Object.assign(new Error(
        "pending integration receipt does not match the active direct plan",
      ), { code: "DIRECT_INTEGRATION_RECEIPT_INVALID" });
    }
    if (
      hasOutboxCommit({
        root: mainRoot,
        ref: state.baseBranch,
        idempotencyKey: this.receipt.idempotencyKey,
      })
    ) {
      this.needed = false;
      this.integrationRecorded = true;
      Object.freeze(this);
      return;
    }
    const hardFailure = snapshot.checks.find((check) => (
      !check.passed && !PENDING_RECOVERY_REFRESHABLE_CHECKS.has(check.id)
    ));
    if (hardFailure) {
      throw Object.assign(new Error(
        `pending integration recovery failed ${hardFailure.id}: ${hardFailure.detail}`,
      ), { code: "DIRECT_SAFETY_REVALIDATION_FAILED" });
    }
    if (
      snapshot.target.worktreePath !== this.session.target.worktreePath
      || snapshot.currentHead !== snapshot.worktreeHead
      || snapshot.branch !== state.featureBranch
    ) {
      throw Object.assign(new Error(
        "pending integration recovery target no longer identifies the managed feature worktree",
      ), { code: "DIRECT_RECOVERY_TARGET_CHANGED" });
    }
    const baseAncestry = runGit([
      "-C",
      mainRoot,
      "merge-base",
      "--is-ancestor",
      `refs/heads/${state.baseBranch}`,
      snapshot.currentHead,
    ]);
    if (!baseAncestry.ok) {
      this.needed = false;
      this.integrationRecorded = false;
      Object.freeze(this);
      return;
    }
    const implementationProof = this.session.implementationProof;
    const verification = this.session.verification;
    if (
      implementationProof == null
      || verification?.status !== "passed"
      || !implementationProof.matchesVerification(verification)
    ) {
      throw Object.assign(new Error(
        "pending integration recovery requires the previously verified implementation evidence",
      ), { code: "DIRECT_REBASE_CONTENT_CHANGED" });
    }
    const receiptAncestry = runGit([
      "-C",
      mainRoot,
      "merge-base",
      "--is-ancestor",
      this.receipt.featureHead,
      snapshot.currentHead,
    ]).ok;
    this.needed = force === true
      || !receiptAncestry
      || snapshot.target.binding.revision !== this.plan.target.bindingRevision
      || snapshot.target.registry.revision !== this.plan.target.activeRegistryRevision;
    this.integrationRecorded = false;
    Object.freeze(this);
  }

  refresh() {
    if (!this.needed || this.integrationRecorded) {
      throw new Error("pending integration recovery refresh is not required");
    }
    const target = new DirectFlowTarget({
      ...this.plan.target.toJSON(),
      bindingRevision: this.snapshot.target.binding.revision,
      activeRegistryRevision: this.snapshot.target.registry.revision,
      featureHead: this.snapshot.currentHead,
    });
    const plan = this.plan.withRecoveryTarget(target);
    const implementationProof = this.session.implementationProof
      .rebindToRecoverySnapshot(plan, this.snapshot);
    const session = this.session.recoverPendingIntegration(plan, implementationProof);
    return { plan, session };
  }
}

function directStop(state, code, messages, { retryAction = "FINALIZE_DIRECT" } = {}) {
  const guards = guardFlagsForState(state);
  const session = state.directFlowSession
    ? DirectFlowSession.fromStored(state.directFlowSession)
    : null;
  const canSuspend = session != null && [
    "DIRECT_FIX",
    "DIRECT_VERIFY",
    "MERGE_ONLY_FINALIZE",
    "DIRECT_RECONCILE",
  ].includes(session.phase) && fs.existsSync(session.target.worktreePath);
  const canAbort = canSuspend
    && state.directIntegrationReceipt == null
    && state.directCompletionReceipt == null;
  const prompt = new UserActionPrompt({
    question: `Direct finalize stopped with ${code}. What should happen next?`,
    choices: [
      new UserActionChoice({
        actionId: "RETRY_DIRECT_FINALIZE",
        label: "Retry from the durable direct finalize state",
        nextAction: `senti flow run direct --action ${retryAction} ${guards}`,
        impact: new UserActionImpact({
          retains: ["direct plan", "integration and completion receipts", "teardown transaction"],
          changes: ["only incomplete idempotent transaction phases"],
        }),
      }),
      new UserActionChoice({
        actionId: "INSPECT_FLOW_STATUS",
        label: "Inspect the preserved Flow and Git authorities",
        nextAction: `senti flow get status --details ${guards}`,
        impact: new UserActionImpact({
          retains: ["Flow state", "worktree", "feature branch", "artifacts"],
        }),
      }),
      ...(canSuspend ? [
        new UserActionChoice({
          actionId: "SUSPEND_DIRECT",
          label: "Suspend and park the exact direct target",
          nextAction: `senti flow run direct --action SUSPEND_DIRECT ${guards}`,
          stateTransition: `${session.phase} -> SUSPENDED`,
          impact: new UserActionImpact({
            retains: ["Flow state", "worktree", "feature branch", "artifacts", "receipts"],
          }),
        }),
      ] : []),
      ...(canAbort ? [
        new UserActionChoice({
          actionId: "ABORT_DIRECT",
          label: "Abort without further merge or cleanup",
          nextAction: `senti flow run direct --action ABORT_DIRECT --reason "<reason>" ${guards}`,
          stateTransition: `${session.phase} -> ABORTED`,
          impact: new UserActionImpact({
            retains: ["worktree", "feature branch", "unapplied changes"],
            changes: ["direct abort receipt"],
          }),
        }),
      ] : []),
    ],
    recommendedActionId: "RETRY_DIRECT_FINALIZE",
    recommendationReason: "The shared teardown transaction resumes from its last durable phase.",
  });
  return attachUserActionPrompt(
    Envelope.fail("run", "direct", code, messages),
    prompt,
  );
}

function commitOrSkip(root, message, paths = null) {
  if (paths && paths.length > 0) {
    let commitPaths;
    try {
      commitPaths = GitCommitPathSet.resolve({
        root: path.resolve(root),
        treeish: "HEAD",
        candidates: paths,
      }).toArray();
    } catch (error) {
      if (!(error instanceof GitCommitPathProbeError)) throw error;
      throw new Error(`direct commit path probe failed: ${error.result.stderr || error.result.stdout}`);
    }
    if (commitPaths.length > 0) {
      // Direct scopes are repository paths, not Git patterns. Literal pathspec
      // magic keeps every metacharacter ordinary for both additions and
      // tracked deletions.
      const literalCommitPaths = commitPaths.map((commitPath) => `:(literal)${commitPath}`);
      const add = runGit(["-C", root, "add", "-A", "--", ...literalCommitPaths]);
      if (!add.ok) throw new Error(`direct commit staging failed: ${add.stderr || add.stdout}`);
    }
  }
  const commit = runGit(["-C", root, "commit", "-m", message]);
  if (commit.ok) {
    return {
      status: "done",
      commit: gitValue(["-C", root, "rev-parse", "HEAD"], "direct commit HEAD could not be resolved"),
    };
  }
  const output = `${commit.stderr || ""}\n${commit.stdout || ""}`;
  if (/nothing to commit|no changes added to commit/i.test(output)) {
    return {
      status: "skipped",
      commit: gitValue(["-C", root, "rev-parse", "HEAD"], "direct HEAD could not be resolved"),
    };
  }
  throw new Error(`direct commit failed: ${commit.stderr || commit.stdout}`);
}

function pendingReceiptMatchesFeatureHead({
  mainRoot,
  pendingReceipt,
  currentFeatureHead,
  specId,
}) {
  if (pendingReceipt.featureHead === currentFeatureHead) return true;
  const receiptAncestry = runGit([
    "-C",
    mainRoot,
    "merge-base",
    "--is-ancestor",
    pendingReceipt.featureHead,
    currentFeatureHead,
  ]);
  if (!receiptAncestry.ok) return false;
  const paths = runGit([
    "-C",
    mainRoot,
    "diff",
    "--name-only",
    `${pendingReceipt.featureHead}..${currentFeatureHead}`,
  ]);
  if (!paths.ok) return false;
  const allowed = new Set([
    path.posix.join("specs", specId, "flow.json"),
    path.posix.join("specs", specId, "issue-log.json"),
  ]);
  const changedPaths = paths.stdout.split(/\r?\n/).filter(Boolean);
  return changedPaths.length > 0 && changedPaths.every((entry) => allowed.has(entry));
}

function normalFinalizeState(mainManager, specId, fallback) {
  const mainState = mainManager.loadReadOnly(specId);
  if (
    mainState?.runId === fallback.runId
    && mainState.spec === fallback.spec
    && (mainState.issue ?? null) === (fallback.issue ?? null)
  ) return mainState;
  return fallback;
}

function completionIssueLogId(receipt) {
  return `direct-completion:${receipt.runId}:${receipt.planId}:r${receipt.planRevision}`;
}

function appendCompletionIssueLog({
  root,
  mainRoot,
  state,
  receipt,
  operationOwnerToken = null,
}) {
  return new IssueLogStore({
    root,
    mainRoot,
    spec: state.spec,
    operationOwnerToken,
  }).append({
    step: "direct-completion",
    reason: `Direct handling completed from ${receipt.sourceStep}.`,
    trigger: receipt.mergeDisposition === "already-merged"
      ? "DIRECT_RECONCILE"
      : "MERGE_ONLY_FINALIZE",
    resolution: receipt.deterministicSummary(),
    runId: receipt.runId,
    planId: receipt.planId,
    planRevision: receipt.planRevision,
    completionMode: receipt.completionMode,
    mergeDisposition: receipt.mergeDisposition,
    gitEvidence: receipt.gitEvidence.toJSON(),
    cleanupDisposition: receipt.cleanupDisposition,
    retainedWorktree: receipt.retainedWorktree?.toJSON() || null,
    skippedSteps: receipt.skippedSteps.map((step) => step.toJSON()),
    minimalValidation: receipt.minimalValidation.toJSON(),
    timestamp: receipt.preparedAt,
    taskId: null,
  }, completionIssueLogId(receipt));
}

function retainedCompletionResult(receipt) {
  return Envelope.ok("run", "direct", {
    status: "done",
    completionMode: receipt.completionMode,
    mergeDisposition: receipt.mergeDisposition,
    receiptId: receipt.receiptId,
    cleanup: {
      status: "retained",
      ...receipt.retainedWorktree.toJSON(),
    },
  });
}

function completeWithRetainedWorktree(
  authority,
  state,
  session,
  plan,
  pendingReceipt,
  evidence,
) {
  if (session.verification?.status !== "passed") {
    return directStop(state, "DIRECT_VERIFY_REQUIRED", [
      "Safe retained completion requires the previously passed direct verification.",
      "No merge, cleanup, pointer, branch, worktree, or active-registry mutation was attempted.",
    ]);
  }
  const retainedWorktree = new DirectRetainedWorktree({
    worktreePath: session.target.worktreePath,
    featureBranch: state.featureBranch,
    featureHead: evidence.featureHead,
    reason: "Normal squash integration already contains the original feature head; post-normal feature commits are retained without merging.",
  });
  const integrationReceipt = new DirectIntegrationReceipt({
    ...pendingReceipt.toJSON(),
    status: "merged",
    strategy: "already-merged",
    mergeDisposition: "already-merged",
    featureHead: evidence.normalFeatureHead,
    mainHead: evidence.mainHead,
    integratedAt: new Date().toISOString(),
  });
  const completionReceipt = new DirectCompletionReceipt({
    status: "completed",
    runId: state.runId,
    issue: state.issue ?? null,
    spec: state.spec,
    planId: plan.planId,
    planRevision: plan.revision,
    mergeDisposition: "already-merged",
    sourceStep: plan.sourceStep,
    gitEvidence: new DirectGitEvidence({
      kind: "integration-receipt",
      featureHead: evidence.normalFeatureHead,
      mainHead: evidence.mainHead,
      receiptKey: evidence.receiptKey,
      receiptCommit: evidence.receiptCommit,
    }),
    skippedSteps: skippedStepsForReceipt(plan),
    minimalValidation: session.verification,
    cleanupDisposition: "retain",
    retainedWorktree,
    completedAt: new Date().toISOString(),
  });
  authority.flowManager.mutate((current) => {
    const currentSession = DirectFlowSession.fromStored(current.directFlowSession);
    const currentPlan = DirectResolutionPlan.fromStored(current.directResolutionPlan);
    const currentPending = DirectIntegrationReceipt.fromStored(current.directIntegrationReceipt);
    if (
      currentSession.revision !== session.revision
      || currentSession.phase !== "MERGE_ONLY_FINALIZE"
      || currentPlan.planId !== plan.planId
      || currentPlan.revision !== plan.revision
      || currentPending.receiptId !== pendingReceipt.receiptId
      || currentPending.status !== "pending"
      || current.directCompletionReceipt != null
    ) {
      throw Object.assign(new Error(
        "direct retained completion authority changed before completion recording",
      ), { code: "DIRECT_CAS_CONFLICT" });
    }
    current.directIntegrationReceipt = integrationReceipt.toJSON();
    current.directCompletionReceipt = completionReceipt.toJSON();
    current.directFlowSession = currentSession.completePreparedCleanup({
      success: true,
      completionMode: "direct",
      mergeDisposition: "already-merged",
      receiptId: completionReceipt.receiptId,
      completedAt: completionReceipt.completedAt,
    }).toJSON();
  }, directMutationOptions(authority, { expectedOriginal: state }));
  const completed = authority.flowManager.load(authority.specId);
  appendCompletionIssueLog({
    root: session.target.worktreePath,
    mainRoot: authority.mainRoot,
    state: completed,
    receipt: completionReceipt,
    operationOwnerToken: authority.repositoryOperationOwnerToken,
  });
  commitOrSkip(
    session.target.worktreePath,
    "chore: record retained direct completion",
    [
      path.posix.join("specs", authority.specId, "flow.json"),
      path.posix.join("specs", authority.specId, "issue-log.json"),
    ],
  );
  authority.flowManager.removeActiveFlow(authority.specId, {
    operationOwnerToken: authority.repositoryOperationOwnerToken,
  });
  return retainedCompletionResult(completionReceipt);
}

function skippedStepsForReceipt(plan) {
  return plan.skippedSteps.map((stepId) => new DirectSkippedStep({
    stepId,
    reason: "direct-limited-completion: normal post-impl step was not executed or credited",
  }));
}

function verifyReconcileEvidence(mainRoot, state) {
  if (!state.directReconcileEvidence) return null;
  const evidence = DirectGitEvidence.fromStored(state.directReconcileEvidence);
  const featureHead = gitValue(
    ["-C", mainRoot, "rev-parse", `refs/heads/${state.featureBranch}`],
    "reconcile feature HEAD could not be resolved",
  );
  const mainHead = gitValue(
    ["-C", mainRoot, "rev-parse", `refs/heads/${state.baseBranch}`],
    "reconcile main HEAD could not be resolved",
  );
  if (evidence.kind === "integration-receipt") {
    return revalidatePersistedIntegrationReceipt(mainRoot, state, evidence);
  }
  if (featureHead !== evidence.featureHead) return null;
  const ancestry = runGit([
    "-C",
    mainRoot,
    "merge-base",
    "--is-ancestor",
    featureHead,
    mainHead,
  ]);
  if (!ancestry.ok) return null;
  return new DirectGitEvidence({
    kind: "exact-ancestry",
    featureHead,
    mainHead,
  });
}

function verificationForReconcile(authority, state, plan, options) {
  const snapshot = options.directSafetySnapshot(authority, state, plan);
  const test = options.runTestCommand(
    authority.mainRoot,
    options.testCommand,
    options.timeoutMs,
  );
  const checks = [
    ...snapshot.checks,
    {
      id: "deterministic-tests",
      passed: test.status === "passed",
      detail: test.detail,
      overrideable: true,
    },
  ];
  const status = checks.every((check) => check.passed) ? "passed" : (
    test.status === "tooling-error" ? "tooling-error" : "failed"
  );
  return new DirectVerificationResult({
    status,
    testStatus: test.status,
    testCommand: test.command,
    checks,
    changedPaths: snapshot.changedPaths,
    pathFingerprints: snapshot.pathFingerprints,
    featureHead: snapshot.currentHead,
  });
}

export class DirectFinalizeAdapter {
  constructor({ plan, completionReceipt }) {
    this.plan = DirectResolutionPlan.fromStored(plan);
    this.completionReceipt = DirectCompletionReceipt.fromStored(completionReceipt);
    if (
      this.plan.planId !== this.completionReceipt.planId
      || this.plan.revision !== this.completionReceipt.planRevision
      || this.plan.target.runId !== this.completionReceipt.runId
    ) {
      throw new Error("direct finalize adapter plan and completion receipt do not match");
    }
    Object.freeze(this);
  }

  get completionData() {
    return {
      completionMode: "direct",
      mergeDisposition: this.completionReceipt.mergeDisposition,
      receiptId: this.completionReceipt.receiptId,
      externalUpdateKey: this.completionReceipt.externalUpdateKey,
      summary: this.completionReceipt.deterministicSummary(),
    };
  }

  assertTeardownAuthority({
    flowManager,
    state,
    worktreePath,
    mainRoot,
    operationOwnerToken = null,
  }) {
    if (!this.plan.target.sameIdentity(state)) {
      throw Object.assign(new Error("direct teardown Flow identity changed"), {
        code: "DIRECT_TEARDOWN_CAS_CONFLICT",
      });
    }
    const expectation = new FlowTargetExpectation({
      expectRunId: this.plan.target.runId,
      expectSpec: this.plan.target.spec,
      ...(this.plan.target.issue == null
        ? { expectNoIssue: true }
        : { expectIssue: this.plan.target.issue }),
    });
    const worktreeManager = flowManager.forRoot(worktreePath, {
      specId: specIdFromPath(state.spec),
    });
    const binding = worktreeManager.snapshotWorktreeBinding(expectation);
    const registry = flowManager.snapshotActiveFlows({ operationOwnerToken });
    const activeEntry = registry.entries.find((entry) => (
      entry.spec === specIdFromPath(state.spec) && entry.mode === "worktree"
    ));
    const featureHead = gitValue(
      ["-C", mainRoot, "rev-parse", `refs/heads/${state.featureBranch}`],
      "direct teardown feature ref could not be resolved",
    );
    const mainHead = gitValue(
      ["-C", mainRoot, "rev-parse", `refs/heads/${state.baseBranch}`],
      "direct teardown main ref could not be resolved",
    );
    const worktreeHead = gitValue(
      ["-C", worktreePath, "rev-parse", "HEAD"],
      "direct teardown worktree HEAD could not be resolved",
    );
    const status = runGit(["-C", worktreePath, "status", "--porcelain=v1", "-z"]);
    if (!status.ok) {
      throw Object.assign(new Error(`direct teardown status probe failed: ${status.stderr || status.stdout}`), {
        code: "DIRECT_TEARDOWN_STATUS_FAILED",
      });
    }
    const expectedFeatureHead = this.completionReceipt.gitEvidence.featureHead;
    const expectedMainHead = this.completionReceipt.gitEvidence.mainHead;
    const mainAncestry = runGit([
      "-C",
      mainRoot,
      "merge-base",
      "--is-ancestor",
      expectedMainHead,
      mainHead,
    ]);
    const mismatch = (
      binding.revision !== this.plan.target.bindingRevision
      || !activeEntry
      || featureHead !== expectedFeatureHead
      || worktreeHead !== expectedFeatureHead
      || !mainAncestry.ok
    );
    if (mismatch) {
      throw Object.assign(new Error(
        "direct teardown authority changed after integration inspection",
      ), {
        code: "DIRECT_TEARDOWN_CAS_CONFLICT",
        data: {
          expectedBindingRevision: this.plan.target.bindingRevision,
          activeBindingRevision: binding.revision,
          activeTargetEntry: activeEntry?.toJSON?.() || null,
          expectedFeatureHead,
          featureHead,
          worktreeHead,
          expectedMainHead,
          mainHead,
        },
      });
    }
    if (
      status.stdout !== ""
      && !hasOnlyFlowOwnedArtifacts(status.stdout, state.spec)
    ) {
      throw Object.assign(new Error(
        "direct teardown requires a clean worktree with no unapplied changes",
      ), { code: "DIRECT_TEARDOWN_DIRTY" });
    }
  }

  #matchesTeardownRecoveryIdentity({
    state,
    worktreePath,
    transaction,
  }) {
    const receipt = state.directCompletionReceipt
      ? DirectCompletionReceipt.fromStored(state.directCompletionReceipt)
      : null;
    const identity = transaction?.identity;
    return (
      receipt != null
      && receipt.receiptId === this.completionReceipt.receiptId
      && receipt.status === "prepared"
      && this.plan.target.sameIdentity(state)
      && worktreePath === this.plan.target.worktreePath
      && identity?.runId === this.plan.target.runId
      && identity?.spec === this.plan.target.spec
      && (identity?.issue ?? null) === this.plan.target.issue
      && identity?.featureBranch === this.plan.target.featureBranch
      && identity?.baseBranch === this.plan.target.baseBranch
    );
  }

  #matchesCommitExpectation(transaction) {
    const expectation = transaction?.commitExpectation;
    return (
      expectation?.worktreePath === this.plan.target.worktreePath
      && expectation?.worktreeHead === this.completionReceipt.gitEvidence.featureHead
      && expectation?.featureRef === this.completionReceipt.gitEvidence.featureHead
    );
  }

  #authorizesTeardownRecovery({
    state,
    worktreePath,
    transaction,
    requiredPhase,
  }) {
    return (
      this.#matchesTeardownRecoveryIdentity({ state, worktreePath, transaction })
      && transaction?.phase?.atLeast?.(requiredPhase) === true
      && this.#matchesCommitExpectation(transaction)
    );
  }

  authorizePreparedCleanupRecovery({ state, worktreePath, transaction }) {
    if (!this.#matchesTeardownRecoveryIdentity({ state, worktreePath, transaction })) {
      return false;
    }
    if (transaction.commitExpectation == null) {
      return !transaction.phase.atLeast("commit-durable");
    }
    return this.#matchesCommitExpectation(transaction);
  }

  authorizeMissingWorktreeBindingRecovery(input) {
    return this.#authorizesTeardownRecovery({
      ...input,
      requiredPhase: "commit-durable",
    });
  }

  authorizeRemovedWorktreeRuntimeResidueRecovery(input) {
    return this.#authorizesTeardownRecovery({
      ...input,
      requiredPhase: "worktree-removed",
    });
  }

  complete(flowManager, specId, operationOwnerToken) {
    const existingState = flowManager.load(specId);
    const existingSession = DirectFlowSession.fromStored(existingState.directFlowSession);
    const existingReceipt = DirectCompletionReceipt.fromStored(
      existingState.directCompletionReceipt,
    );
    if (
      existingReceipt.receiptId === this.completionReceipt.receiptId
      && existingReceipt.status === "completed"
      && existingSession.phase === "COMPLETED_DIRECT"
    ) {
      return existingReceipt;
    }
    let completedReceipt = null;
    flowManager.mutate((state) => {
      const session = DirectFlowSession.fromStored(state.directFlowSession);
      const receipt = DirectCompletionReceipt.fromStored(state.directCompletionReceipt);
      if (
        receipt.receiptId !== this.completionReceipt.receiptId
      ) {
        throw new Error("direct completion receipt changed before tombstone publication");
      }
      if (receipt.status === "completed" && session.phase === "COMPLETED_DIRECT") {
        completedReceipt = receipt;
        return;
      }
      if (receipt.status !== "prepared") {
        throw new Error("direct completion receipt changed before tombstone publication");
      }
      completedReceipt = receipt.complete();
      const completedSession = session.completePreparedCleanup({
        success: true,
        completionMode: "direct",
        mergeDisposition: completedReceipt.mergeDisposition,
        receiptId: completedReceipt.receiptId,
        completedAt: completedReceipt.completedAt,
      });
      if (session.phase === "ABORTED") DirectAbortArchive.fromState(state).apply(state);
      state.directCompletionReceipt = completedReceipt.toJSON();
      state.directFlowSession = completedSession.toJSON();
    }, { specId, operationOwnerToken });
    return completedReceipt;
  }
}

export class DirectPreparedCleanupContinuation {
  constructor({ state, mainRoot }) {
    const session = DirectFlowSession.fromStored(state?.directFlowSession);
    if (![
      "MERGE_ONLY_FINALIZE",
      "DIRECT_RECONCILE",
      "SUSPENDED",
      "ABORTED",
    ].includes(session.phase)) {
      throw new Error(`prepared direct cleanup cannot resume from ${session.phase}`);
    }
    const plan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
    const receipt = DirectCompletionReceipt.fromStored(state.directCompletionReceipt);
    if (receipt.status !== "prepared") {
      throw new Error("prepared direct cleanup requires a prepared completion receipt");
    }
    const adapter = new DirectFinalizeAdapter({ plan, completionReceipt: receipt });
    const transaction = readPersistedFinalizeTeardownTransaction(mainRoot, state);
    if (
      transaction != null
      && !adapter.authorizePreparedCleanupRecovery({
        state,
        worktreePath: session.target.worktreePath,
        transaction,
      })
    ) {
      throw new Error("prepared direct cleanup transaction does not match the completion receipt");
    }
    this.session = session;
    this.receipt = receipt;
    this.transaction = transaction;
    Object.freeze(this);
  }

  static inspect({ state, mainRoot }) {
    if (!state?.directCompletionReceipt) return null;
    const receipt = DirectCompletionReceipt.fromStored(state.directCompletionReceipt);
    if (receipt.status !== "prepared") return null;
    return new DirectPreparedCleanupContinuation({ state, mainRoot });
  }

  toJSON() {
    return {
      receiptId: this.receipt.receiptId,
      mergeDisposition: this.receipt.mergeDisposition,
      interruptedPhase: this.session.phase,
      teardownPhase: this.transaction?.phase?.name ?? null,
    };
  }
}

function persistPreparedCompletion({
  mainManager,
  mainRoot,
  specId,
  integrationReceipt,
  completionReceipt,
  operationOwnerToken = null,
}) {
  const state = mainManager.load(specId);
  mainManager.mutate((current) => {
    const session = DirectFlowSession.fromStored(current.directFlowSession);
    if (!["MERGE_ONLY_FINALIZE", "DIRECT_RECONCILE"].includes(session.phase)) {
      throw Object.assign(new Error(`direct completion preparation is unavailable from ${session.phase}`), {
        code: "DIRECT_PHASE_MISMATCH",
      });
    }
    current.directIntegrationReceipt = integrationReceipt.toJSON();
    current.directCompletionReceipt = completionReceipt.toJSON();
    current.directFlowSession = new DirectFlowSession({
      ...session.toJSON(),
      completion: {
        success: null,
        completionMode: "direct",
        mergeDisposition: completionReceipt.mergeDisposition,
        receiptId: completionReceipt.receiptId,
        status: "prepared",
      },
      revision: session.revision + 1,
      updatedAt: new Date().toISOString(),
    }).toJSON();
    current.state = {
      ...(current.state || {}),
      mergeStrategy: integrationReceipt.strategy === "squash" ? "squash" : "pr",
      featureBranchSquashedSha: integrationReceipt.strategy === "squash"
        ? integrationReceipt.featureHead
        : null,
    };
  }, {
    expectedOriginal: state,
    operationOwnerToken,
  });
  const prepared = mainManager.load(specId);
  appendCompletionIssueLog({
    root: mainRoot,
    mainRoot,
    state: prepared,
    receipt: completionReceipt,
    operationOwnerToken,
  });
  return mainManager.load(specId);
}

async function cleanupPreparedDirect(authority, mainManager, mainState, receipt, plan) {
  const adapter = new DirectFinalizeAdapter({
    plan,
    completionReceipt: receipt,
  });
  const cleanup = new RunFinalizeCleanupCommand();
  let result;
  try {
    result = await cleanup.execute({
      ...authority,
      root: authority.mainRoot,
      mainRoot: authority.mainRoot,
      flowManager: mainManager,
      flowState: mainState,
      force: true,
      directFinalizeAdapter: adapter,
    });
  } catch (error) {
    return directStop(
      mainState,
      error.code || error.cause?.code || "DIRECT_CLEANUP_FAILED",
      [
        error.message || "Direct cleanup stopped.",
        "The durable completion receipt, target worktree, branch, and active entry were retained.",
      ],
    );
  }
  if (result instanceof Envelope && result.ok === false && result.data?.yieldsControl !== true) {
    return directStop(mainState, result.errors?.[0]?.code || "DIRECT_CLEANUP_STOPPED", (
      result.errors?.[0]?.messages || ["Direct cleanup stopped."]
    ));
  }
  return result;
}

async function finalizeReconcile(authority, state, session, plan, options) {
  const evidence = verifyReconcileEvidence(authority.mainRoot, state);
  if (!evidence) {
    return directStop(state, "DIRECT_RECONCILE_EVIDENCE_CHANGED", [
      "The persisted integration receipt or exact ancestry no longer proves integration.",
      "No merge, cleanup, pointer, branch, worktree, or active-registry mutation was attempted.",
    ], { retryAction: "FINALIZE_DIRECT_RECONCILE" });
  }
  let verification = session.verification;
  if (!verification || verification.status !== "passed") {
    verification = verificationForReconcile(authority, state, plan, options);
    const nextSession = session.withVerification(verification);
    authority.flowManager.mutate((current) => {
      current.directFlowSession = nextSession.toJSON();
    }, directMutationOptions(authority, { expectedOriginal: state }));
    state = authority.flowManager.load(authority.specId);
    session = DirectFlowSession.fromStored(state.directFlowSession);
  }
  if (verification.status !== "passed") {
    return directStop(state, "DIRECT_VERIFY_STOPPED", [
      "Reconciliation minimal verification did not pass.",
      ...verification.checks.filter((check) => !check.passed).map((check) => `${check.id}: ${check.detail}`),
    ], { retryAction: "FINALIZE_DIRECT_RECONCILE" });
  }
  const integrationReceipt = new DirectIntegrationReceipt({
    status: "merged",
    runId: state.runId,
    issue: state.issue ?? null,
    spec: state.spec,
    planId: plan.planId,
    planRevision: plan.revision,
    strategy: "already-merged",
    mergeDisposition: "already-merged",
    featureHead: evidence.featureHead,
    mainHead: evidence.mainHead,
    integratedAt: new Date().toISOString(),
  });
  const completionReceipt = new DirectCompletionReceipt({
    status: "prepared",
    runId: state.runId,
    issue: state.issue ?? null,
    spec: state.spec,
    planId: plan.planId,
    planRevision: plan.revision,
    mergeDisposition: "already-merged",
    sourceStep: plan.sourceStep,
    gitEvidence: evidence,
    skippedSteps: skippedStepsForReceipt(plan),
    minimalValidation: verification,
  });
  const prepared = persistPreparedCompletion({
    mainManager: authority.flowManager,
    mainRoot: authority.mainRoot,
    specId: authority.specId,
    integrationReceipt,
    completionReceipt,
    operationOwnerToken: authority.repositoryOperationOwnerToken,
  });
  return cleanupPreparedDirect(
    authority,
    authority.flowManager,
    prepared,
    completionReceipt,
    plan,
  );
}

async function recoverPendingIntegration(
  authority,
  state,
  session,
  plan,
  pendingReceipt,
  options,
  { force = false } = {},
) {
  if ((options.pendingRecoveryDepth || 0) >= 2) {
    return directStop(state, "DIRECT_INTEGRATION_RECOVERY_LIMIT", [
      "The feature HEAD changed repeatedly while direct integration was being revalidated.",
      "No merge or cleanup was attempted after the second change.",
    ]);
  }
  const snapshot = options.directSafetySnapshot(authority, state, plan);
  let recovery;
  try {
    recovery = new PendingIntegrationRecovery({
      mainRoot: authority.mainRoot,
      state,
      session,
      plan,
      receipt: pendingReceipt,
      snapshot,
      force,
    });
  } catch (error) {
    return directStop(state, error.code || "DIRECT_INTEGRATION_RECOVERY_FAILED", [
      error.message,
      "The pending receipt, branch, worktree, and Flow state were retained.",
    ]);
  }
  if (!recovery.needed || recovery.integrationRecorded) return null;
  const refreshed = recovery.refresh();
  authority.flowManager.mutate((current) => {
    const durableSession = DirectFlowSession.fromStored(current.directFlowSession);
    const durablePlan = DirectResolutionPlan.fromStored(current.directResolutionPlan);
    const durableReceipt = DirectIntegrationReceipt.fromStored(
      current.directIntegrationReceipt,
    );
    if (
      durableSession.revision !== session.revision
      || durablePlan.planId !== plan.planId
      || durablePlan.revision !== plan.revision
      || durableReceipt.receiptId !== pendingReceipt.receiptId
      || current.directCompletionReceipt != null
    ) {
      throw Object.assign(new Error(
        "pending direct integration state changed before recovery",
      ), { code: "DIRECT_CAS_CONFLICT" });
    }
    current.directResolutionPlan = refreshed.plan.toJSON();
    current.directFlowSession = refreshed.session.toJSON();
    delete current.directIntegrationReceipt;
    if (current.state) delete current.state.featureBranchSquashedSha;
  }, directMutationOptions(authority, { expectedOriginal: state }));

  const verificationCommand = session.verification?.testCommand ?? null;
  const verified = options.runDirectVerification(authority, {
    testCommand: verificationCommand,
    timeoutMs: options.timeoutMs,
  });
  const verifiedSession = DirectFlowSession.fromStored(verified.directFlowSession);
  if (verifiedSession.verification?.status !== "passed") {
    return directStop(verified, "DIRECT_REBASE_REVALIDATION_FAILED", [
      "The feature history was refreshed, but deterministic verification did not pass.",
      ...verifiedSession.verification.checks
        .filter((check) => !check.passed)
        .map((check) => `${check.id}: ${check.detail}`),
    ], { retryAction: "VERIFY_DIRECT" });
  }
  return finalizeMerge(
    authority,
    verified,
    verifiedSession,
    refreshed.plan,
    {
      ...options,
      pendingRecoveryDepth: (options.pendingRecoveryDepth || 0) + 1,
    },
  );
}

async function finalizeMerge(authority, state, session, plan, options) {
  const targetRoot = session.target.worktreePath;
  const mainRoot = authority.mainRoot;
  const specId = specIdFromPath(state.spec);
  const mainManager = authority.flowManager.forRoot(mainRoot, { specId });
  const existingMain = mainManager.loadReadOnly(specId);
  if (
    session.phase === "MERGE_ONLY_FINALIZE"
    && existingMain?.directIntegrationReceipt
    && DirectIntegrationReceipt.fromStored(existingMain.directIntegrationReceipt).status === "merged"
    && existingMain.directCompletionReceipt
  ) {
    const receipt = DirectCompletionReceipt.fromStored(existingMain.directCompletionReceipt);
    appendCompletionIssueLog({
      root: mainRoot,
      mainRoot,
      state: existingMain,
      receipt,
      operationOwnerToken: authority.repositoryOperationOwnerToken,
    });
    return cleanupPreparedDirect(authority, mainManager, existingMain, receipt, plan);
  }
  let mergeState = state;
  let pendingReceipt = state.directIntegrationReceipt
    ? DirectIntegrationReceipt.fromStored(state.directIntegrationReceipt)
    : null;
  let featureHead = pendingReceipt?.featureHead ?? null;
  if (session.phase === "DIRECT_VERIFY") {
    if (
      session.implementationProof == null
      || !session.implementationProof.matchesIdentity(state, plan)
      || !session.implementationProof.matchesVerification(session.verification)
    ) {
      return directStop(state, "DIRECT_IMPLEMENTATION_NOT_READY", [
        "Limited finalize requires implementation completion evidence for the exact verified change set.",
        "No commit, merge, cleanup, pointer, branch, worktree, or active-registry mutation was attempted.",
      ], { retryAction: "RETURN_TO_DIRECT_FIX" });
    }
    if (session.verification?.status !== "passed") {
      return directStop(state, "DIRECT_VERIFY_REQUIRED", [
        "Limited finalize requires a passed direct verification.",
        "Normal review, gate, report, retro, and final-regression steps were not resumed.",
      ]);
    }
    const snapshot = options.directSafetySnapshot(authority, state, plan);
    const failedSafety = snapshot.checks.find((check) => !check.passed);
    if (failedSafety) {
      return directStop(state, "DIRECT_SAFETY_REVALIDATION_FAILED", [
        `${failedSafety.id}: ${failedSafety.detail}`,
        "No commit, merge, cleanup, pointer, branch, worktree, or active-registry mutation was attempted.",
      ]);
    }
    if (
      JSON.stringify(snapshot.changedPaths)
      !== JSON.stringify([...session.verification.changedPaths].sort())
      || JSON.stringify(snapshot.pathFingerprints.map((entry) => entry.toJSON()))
        !== JSON.stringify(session.verification.pathFingerprints.map((entry) => entry.toJSON()))
      || snapshot.currentHead !== session.verification.featureHead
    ) {
      return directStop(state, "DIRECT_CHANGE_SET_CHANGED", [
        "The changed path set no longer matches the minimally verified path set.",
        "No commit, merge, cleanup, pointer, branch, worktree, or active-registry mutation was attempted.",
      ]);
    }
    commitOrSkip(targetRoot, "fix: complete direct flow resolution", session.verification.changedPaths);
    const committedState = authority.flowManager.load(specId);
    const committedSession = DirectFlowSession.fromStored(committedState.directFlowSession);
    featureHead = gitValue(
      ["-C", mainRoot, "rev-parse", `refs/heads/${state.featureBranch}`],
      "direct feature HEAD could not be resolved before merge",
    );
    pendingReceipt = new DirectIntegrationReceipt({
      status: "pending",
      runId: state.runId,
      issue: state.issue ?? null,
      spec: state.spec,
      planId: plan.planId,
      planRevision: plan.revision,
      strategy: "squash",
      mergeDisposition: "merged",
      featureHead,
    });
    const finalizing = committedSession.transition("MERGE_ONLY_FINALIZE", {
      completion: {
        success: null,
        completionMode: "direct",
        mergeDisposition: "merged",
        integrationReceiptId: pendingReceipt.receiptId,
        status: "pending-merge",
      },
    });
    authority.flowManager.mutate((current) => {
      current.directIntegrationReceipt = pendingReceipt.toJSON();
      current.directFlowSession = finalizing.toJSON();
    }, directMutationOptions(authority, { expectedOriginal: committedState }));
    commitOrSkip(
      targetRoot,
      "chore: record direct integration intent",
      [
        path.posix.join("specs", specId, "flow.json"),
        path.posix.join("specs", specId, "issue-log.json"),
      ],
    );
    mergeState = authority.flowManager.load(specId);
  } else if (session.phase === "MERGE_ONLY_FINALIZE") {
    if (
      pendingReceipt?.status !== "pending"
      || pendingReceipt.runId !== state.runId
      || pendingReceipt.spec !== state.spec
      || pendingReceipt.planId !== plan.planId
      || pendingReceipt.planRevision !== plan.revision
    ) {
      return directStop(state, "DIRECT_INTEGRATION_RECEIPT_INVALID", [
        "The durable pending integration receipt is absent or no longer matches the direct plan.",
        "No merge or cleanup was attempted.",
      ]);
    }
    const currentFeatureHead = gitValue(
      ["-C", mainRoot, "rev-parse", `refs/heads/${state.featureBranch}`],
      "direct feature HEAD could not be resolved during retained completion inspection",
    );
    if (pendingReceiptMatchesFeatureHead({
      mainRoot,
      pendingReceipt,
      currentFeatureHead,
      specId,
    })) {
      const normalAncestor = inspectNormalFinalizeAncestorEvidence(
        mainRoot,
        normalFinalizeState(mainManager, specId, state),
        currentFeatureHead,
      );
      if (normalAncestor?.hasPostNormalFeatureCommits) {
        return completeWithRetainedWorktree(
          authority,
          state,
          session,
          plan,
          pendingReceipt,
          normalAncestor,
        );
      }
    }
    const recovered = await recoverPendingIntegration(
      authority,
      state,
      session,
      plan,
      pendingReceipt,
      options,
    );
    if (recovered != null) return recovered;
    const snapshot = options.directSafetySnapshot(authority, state, plan);
    const failedSafety = snapshot.checks.find((check) => !check.passed);
    if (failedSafety) {
      return directStop(state, "DIRECT_SAFETY_REVALIDATION_FAILED", [
        `${failedSafety.id}: ${failedSafety.detail}`,
        "The pending receipt, branch, worktree, and Flow state were retained.",
      ]);
    }
  } else {
    return directStop(state, "DIRECT_PHASE_MISMATCH", [
      `Limited finalize is unavailable from ${session.phase}.`,
    ]);
  }
  const finalizingSession = DirectFlowSession.fromStored(mergeState.directFlowSession);
  const currentFeatureHead = gitValue(
    ["-C", mainRoot, "rev-parse", `refs/heads/${state.featureBranch}`],
    "direct feature HEAD could not be resolved during retained completion inspection",
  );
  if (
    finalizingSession.phase === "MERGE_ONLY_FINALIZE"
    && pendingReceipt?.status === "pending"
    && pendingReceiptMatchesFeatureHead({
      mainRoot,
      pendingReceipt,
      currentFeatureHead,
      specId,
    })
  ) {
    const normalAncestor = inspectNormalFinalizeAncestorEvidence(
      mainRoot,
      normalFinalizeState(mainManager, specId, mergeState),
      currentFeatureHead,
    );
    if (normalAncestor?.hasPostNormalFeatureCommits) {
      return completeWithRetainedWorktree(
        authority,
        mergeState,
        finalizingSession,
        plan,
        pendingReceipt,
        normalAncestor,
      );
    }
  }
  const { runMerge, resolveMergeStrategy } = await import("../commands/merge.js");
  const config = authority.config || {};
  const strategy = resolveMergeStrategy(mergeState, config);
  if (strategy !== "squash") {
    return directStop(mergeState, "DIRECT_MERGE_STRATEGY_UNSUPPORTED", [
      `Direct limited finalize requires a local squash integration, got ${strategy}.`,
      "No PR adoption or implicit strategy change was performed.",
    ]);
  }
  let mergeResult;
  try {
    mergeResult = runMerge({
      root: targetRoot,
      flowState: mergeState,
      worktreePath: targetRoot,
      mainRepoPath: mainRoot,
      idempotencyKey: pendingReceipt.idempotencyKey,
      requireRevalidationAfterSync: true,
    });
  } catch (error) {
    if (error.code === "MERGE_REVALIDATION_REQUIRED") {
      const refreshedState = authority.flowManager.load(specId);
      const refreshedSession = DirectFlowSession.fromStored(
        refreshedState.directFlowSession,
      );
      const refreshedPlan = DirectResolutionPlan.fromStored(
        refreshedState.directResolutionPlan,
      );
      return recoverPendingIntegration(
        authority,
        refreshedState,
        refreshedSession,
        refreshedPlan,
        DirectIntegrationReceipt.fromStored(refreshedState.directIntegrationReceipt),
        options,
        { force: true },
      );
    }
    return directStop(mergeState, error.code || "DIRECT_MERGE_FAILED", [
      error.message,
      "The direct plan, branch, worktree, and pending integration receipt were retained.",
    ]);
  }
  const mergedFromSha = mergeResult.mergedFromSha || featureHead;
  if (!mergedFromSha) {
    return directStop(mergeState, "DIRECT_MERGE_EVIDENCE_MISSING", [
      "The merge result and pending integration receipt do not identify the merged feature HEAD.",
      "The direct plan, branch, worktree, and pending integration receipt were retained.",
    ]);
  }
  const mainHead = gitValue(
    ["-C", mainRoot, "rev-parse", `refs/heads/${state.baseBranch}`],
    "direct merge main HEAD could not be resolved",
  );
  const mergedReceipt = new DirectIntegrationReceipt({
    ...pendingReceipt.toJSON(),
    status: "merged",
    featureHead: mergedFromSha,
    mainHead,
    integratedAt: new Date().toISOString(),
  });
  const mainState = mainManager.load(specId);
  if (!mainState) {
    return directStop(mergeState, "DIRECT_MAIN_FLOW_MISSING", [
      "The merge completed but the integrated main Flow state is missing.",
      "Keep the branch and worktree; inspect the merge commit before retrying.",
    ]);
  }
  const mainSession = DirectFlowSession.fromStored(mainState.directFlowSession);
  const completionReceipt = new DirectCompletionReceipt({
    status: "prepared",
    runId: mainState.runId,
    issue: mainState.issue ?? null,
    spec: mainState.spec,
    planId: plan.planId,
    planRevision: plan.revision,
    mergeDisposition: "merged",
    sourceStep: plan.sourceStep,
    gitEvidence: new DirectGitEvidence({
      kind: "integration-receipt",
      featureHead: mergedFromSha,
      mainHead,
      receiptKey: mergedReceipt.receiptId,
      receiptCommit: mainHead,
    }),
    skippedSteps: skippedStepsForReceipt(plan),
    minimalValidation: mainSession.verification,
  });
  const prepared = persistPreparedCompletion({
    mainManager,
    mainRoot,
    specId,
    integrationReceipt: mergedReceipt,
    completionReceipt,
    operationOwnerToken: authority.repositoryOperationOwnerToken,
  });
  return cleanupPreparedDirect(
    authority,
    mainManager,
    prepared,
    completionReceipt,
    plan,
  );
}

export async function finalizeDirectFlow(authority, options) {
  const state = authority.flowManager.load(authority.specId);
  if (!state?.directFlowSession || !state?.directResolutionPlan) {
    return Envelope.fail("run", "direct", "DIRECT_STATE_MISSING", "Direct session and plan are required.");
  }
  const session = DirectFlowSession.fromStored(state.directFlowSession);
  const plan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
  if (state.directCompletionReceipt) {
    const receipt = DirectCompletionReceipt.fromStored(state.directCompletionReceipt);
    if (receipt.status === "prepared") {
      appendCompletionIssueLog({
        root: authority.mainRoot,
        mainRoot: authority.mainRoot,
        state,
        receipt,
        operationOwnerToken: authority.repositoryOperationOwnerToken,
      });
      return cleanupPreparedDirect(
        authority,
        authority.flowManager,
        state,
        receipt,
        plan,
      );
    }
  }
  if (options.reconcile) {
    if (session.phase !== "DIRECT_RECONCILE") {
      return Envelope.fail(
        "run",
        "direct",
        "DIRECT_PHASE_MISMATCH",
        `DIRECT_RECONCILE finalize is unavailable from ${session.phase}.`,
      );
    }
    return finalizeReconcile(authority, state, session, plan, options);
  }
  return finalizeMerge(authority, state, session, plan, options);
}
