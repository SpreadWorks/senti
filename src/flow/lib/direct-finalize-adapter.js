import fs from "node:fs";
import path from "node:path";

import { Envelope } from "../../lib/flow-envelope.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { FlowTargetExpectation } from "../../lib/flow-target-guard.js";
import { runGit } from "../../lib/git-helpers.js";
import {
  DirectAbortArchive,
  DirectCompletionReceipt,
  DirectGitEvidence,
  DirectIntegrationReceipt,
  DirectSkippedStep,
} from "./direct-completion.js";
import {
  DirectFlowSession,
  DirectVerificationResult,
} from "./direct-flow-session.js";
import { revalidatePersistedIntegrationReceipt } from "./direct-integration-evidence.js";
import { DirectResolutionPlan } from "./direct-resolution-plan.js";
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

function hasOnlyTargetFlowArtifacts(statusOutput, specId) {
  const artifactRoot = `specs/${specId}/`;
  const entries = statusOutput.split("\0").filter(Boolean);
  return entries.length > 0 && entries.every((entry) => (
    entry.length > 3 && entry.slice(3).startsWith(artifactRoot)
  ));
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
    const add = runGit(["-C", root, "add", "-A", "--", ...paths]);
    if (!add.ok) throw new Error(`direct commit staging failed: ${add.stderr || add.stdout}`);
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
    skippedSteps: receipt.skippedSteps.map((step) => step.toJSON()),
    minimalValidation: receipt.minimalValidation.toJSON(),
    timestamp: receipt.preparedAt,
    taskId: null,
  }, completionIssueLogId(receipt));
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
      && !hasOnlyTargetFlowArtifacts(status.stdout, specIdFromPath(state.spec))
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
    });
  } catch (error) {
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
