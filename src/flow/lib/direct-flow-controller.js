import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

import { Envelope } from "../../lib/flow-envelope.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { runGit } from "../../lib/git-helpers.js";
import { FlowTargetExpectation } from "../../lib/flow-target-guard.js";
import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";
import { findActiveNode } from "../definition.js";
import { findStepById, flattenSteps } from "./step-tree.js";
import { FlowCompletion } from "./flow-completion.js";
import {
  DirectChangedPathFingerprint,
  DirectFlowSession,
  DirectFlowTarget,
  DirectVerificationResult,
  flowStateRevisionDigest,
} from "./direct-flow-session.js";
import {
  DirectResolutionFinding,
  DirectResolutionPlan,
} from "./direct-resolution-plan.js";
import { DirectVerificationCommandResolver } from "./direct-verification-command.js";
import {
  DirectAbortReceipt,
  DirectAbortReceiptHistory,
  DirectGitEvidence,
} from "./direct-completion.js";
import { inspectPersistedIntegrationReceipt } from "./direct-integration-evidence.js";
import { IssueLogStore } from "./issue-log-store.js";
import {
  attachUserActionPrompt,
  guardFlagsForState,
  UserActionChoice,
  UserActionImpact,
  UserActionPrompt,
} from "./user-action-prompt.js";

const DIRECT_SKIPPED_STEPS = Object.freeze([
  "impl-review",
  "impl-triage",
  "impl-repair",
  "impl-gate",
  "retro",
  "acceptance-review",
  "final-regression",
  "report",
  "finalize-commit",
  "finalize-merge",
  "finalize-sync",
  "finalize-cleanup",
]);
const DIRECT_VALIDATION_ITEMS = Object.freeze([
  "target identity and managed worktree binding remain exact",
  "feature history only advances from the handoff HEAD",
  "no unresolved Git conflicts exist",
  "specified deterministic tests or mechanical checks are recorded",
  "all changed paths stay inside the persisted direct scope",
  "the merge target has no prohibited in-progress Git operation",
]);
const MAX_FINDINGS = 200;
const MAX_SCOPE_PATHS = 200;
const DEFAULT_TEST_TIMEOUT_MS = 120_000;
const MAX_TEST_TIMEOUT_MS = 900_000;
const MAX_DIRECT_VERIFICATION_ATTEMPTS = 3;

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

function commandFor(state, suffix) {
  const guards = guardFlagsForState(state);
  return `senti flow ${suffix}${guards ? ` ${guards}` : ""}`;
}

function choice(input) {
  return new UserActionChoice({
    ...input,
    impact: new UserActionImpact(input.impact),
  });
}

function promptResult({
  code,
  state,
  question,
  choices,
  recommendedActionId,
  recommendationReason,
  details = {},
}) {
  const prompt = new UserActionPrompt({
    question,
    choices,
    recommendedActionId,
    recommendationReason,
  });
  return {
    code,
    ...details,
    yieldsControl: true,
    requiresUserAction: true,
    actionPrompt: prompt.toJSON(),
    ...(state?.directFlowSession && {
      directFlowSession: DirectFlowSession.fromStored(state.directFlowSession).toJSON(),
    }),
  };
}

function stoppedEnvelope(type, key, code, messages, state, prompt) {
  return attachUserActionPrompt(
    Envelope.fail(type, key, code, messages),
    prompt,
  );
}

function directIdentityExpectation(state) {
  return new FlowTargetExpectation({
    expectRunId: state.runId,
    expectSpec: state.spec,
    ...(state.issue == null ? { expectNoIssue: true } : { expectIssue: state.issue }),
  });
}

function resolveStateFallback(ctx) {
  const mainRoot = ctx.mainRoot || ctx.flowManager?._mainRoot || ctx.root;
  const specId = ctx.expectSpec ? specIdFromPath(ctx.expectSpec) : null;
  if (specId) {
    const flowManager = ctx.flowManager.forRoot(mainRoot, { specId });
    const state = flowManager.loadReadOnly(specId);
    const mismatch = state && new FlowTargetExpectation(ctx).mismatchAgainst(state);
    if (state?.directFlowSession && !mismatch) {
      return {
        ...ctx,
        root: mainRoot,
        flowManager,
        flowState: state,
        state,
        specId,
      };
    }
  }
  if (ctx.flowState) return { ...ctx, state: ctx.flowState };
  if (!ctx.expectSpec) return { ...ctx, state: null };
  if (!specId) return { ...ctx, state: null };
  const flowManager = ctx.flowManager.forRoot(mainRoot, { specId });
  const state = flowManager.loadReadOnly(specId);
  if (!state) return { ...ctx, state: null };
  const mismatch = new FlowTargetExpectation(ctx).mismatchAgainst(state);
  if (mismatch) return { ...ctx, state: null };
  return {
    ...ctx,
    root: mainRoot,
    flowManager,
    flowState: state,
    state,
    specId,
  };
}

function originatingFlowState(state) {
  const source = structuredClone(state);
  for (const key of [
    "directFlowSession",
    "directResolutionPlan",
    "directIntegrationReceipt",
    "directCompletionReceipt",
    "directAbortReceipt",
    "directAbortHistory",
    "directReconcileEvidence",
  ]) {
    delete source[key];
  }
  return source;
}

function normalizedScopePaths(value) {
  const inputs = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const paths = [];
  for (const input of inputs) {
    const normalized = String(input || "").trim().replaceAll("\\", "/").replace(/^\.\//, "");
    if (!normalized) continue;
    if (
      path.posix.isAbsolute(normalized)
      || path.win32.isAbsolute(normalized)
      || normalized === ".."
      || normalized.startsWith("../")
    ) {
      throw new Error(`direct scope path must stay inside the repository: ${input}`);
    }
    const canonical = path.posix.normalize(normalized);
    if (canonical === "." || canonical.startsWith("../")) {
      throw new Error(`direct scope path must identify a repository-relative target: ${input}`);
    }
    if (!paths.includes(canonical)) paths.push(canonical);
    if (paths.length > MAX_SCOPE_PATHS) throw new Error(`direct scope exceeds ${MAX_SCOPE_PATHS} paths`);
  }
  return paths;
}

function parseStatusPaths(output) {
  const records = String(output || "").split("\0");
  const paths = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const file = record.slice(3);
    if (file && !paths.includes(file)) paths.push(file);
    if (status.includes("R") || status.includes("C")) {
      const original = records[++index];
      if (original && !paths.includes(original)) paths.push(original);
    }
  }
  return paths;
}

function readWorkingTreePaths(root) {
  const status = runGit([
    "-C",
    root,
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "-z",
  ]);
  if (!status.ok) throw new Error(`direct Git status failed: ${status.stderr || status.stdout}`);
  return parseStatusPaths(status.stdout);
}

function readFeatureDiffPaths(root, baseBranch, featureBranch) {
  const result = runGit([
    "-C",
    root,
    "diff",
    "--name-only",
    "-z",
    `${baseBranch}...${featureBranch}`,
  ]);
  if (!result.ok) {
    throw new Error(`direct feature diff failed: ${result.stderr || result.stdout}`);
  }
  return String(result.stdout || "").split("\0").filter(Boolean);
}

function combinedChangedPaths(root, state, ignoredPrefixes = []) {
  return [...new Set([
    ...readFeatureDiffPaths(root, state.baseBranch, state.featureBranch),
    ...readWorkingTreePaths(root),
  ])].filter((relativePath) => !ignoredPrefixes.some((prefix) => (
    relativePath === prefix || relativePath.startsWith(`${prefix}/`)
  ))).sort();
}

function directIgnoredPathPrefixes(authority, root) {
  const candidates = [
    authority.paths?.agentWorkDir,
    authority.paths?.logDir,
    authority.agentWorkDir,
    path.join(root, ".tmp"),
  ].filter(Boolean);
  const prefixes = [];
  for (const candidate of candidates) {
    const absolute = path.resolve(root, candidate);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    if (
      relative === ""
      || relative === "."
      || relative === ".."
      || relative.startsWith("../")
      || path.isAbsolute(relative)
    ) continue;
    if (!prefixes.includes(relative)) prefixes.push(relative);
  }
  return prefixes;
}

function hashRegularFile(filePath, hash) {
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    for (;;) {
      const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(descriptor);
  }
}

function fingerprintChangedPath(root, relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  let stat;
  try {
    stat = fs.lstatSync(absolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return new DirectChangedPathFingerprint({
      path: relativePath,
      kind: "missing",
      digest: flowStateRevisionDigest({ kind: "missing", path: relativePath }),
    });
  }
  const hash = crypto.createHash("sha256");
  hash.update(`${relativePath}\0${stat.mode & 0o7777}\0`);
  let kind;
  if (stat.isSymbolicLink()) {
    kind = "symlink";
    hash.update(fs.readlinkSync(absolutePath));
  } else if (stat.isFile()) {
    kind = "file";
    hashRegularFile(absolutePath, hash);
  } else {
    throw Object.assign(new Error(
      `direct verification cannot fingerprint non-file changed path: ${relativePath}`,
    ), { code: "DIRECT_PATH_TYPE_UNSUPPORTED" });
  }
  return new DirectChangedPathFingerprint({
    path: relativePath,
    kind,
    digest: hash.digest("hex"),
  });
}

function directPathFingerprints(root, changedPaths, specId) {
  const directMetadata = new Set([
    `specs/${specId}/flow.json`,
    `specs/${specId}/issue-log.json`,
  ]);
  return changedPaths
    .filter((relativePath) => !directMetadata.has(relativePath))
    .map((relativePath) => fingerprintChangedPath(root, relativePath));
}

function managedTargetContext(ctx, state) {
  const specId = specIdFromPath(state.spec);
  const paths = ctx.flowManager.resolveWorktreePaths(state);
  const worktreePath = paths.worktreePath
    || (ctx.flowManager.usesWorktreeFlowBinding() ? ctx.root : null);
  if (!worktreePath || !fs.existsSync(worktreePath)) {
    throw Object.assign(new Error("managed worktree is unavailable"), {
      code: "DIRECT_MODE_UNSUPPORTED",
    });
  }
  const worktreeManager = ctx.flowManager.forRoot(worktreePath, { specId });
  if (!worktreeManager.usesWorktreeFlowBinding()) {
    throw Object.assign(new Error("target is not an active managed worktree"), {
      code: "DIRECT_MODE_UNSUPPORTED",
    });
  }
  const binding = worktreeManager.snapshotWorktreeBinding(directIdentityExpectation(state));
  const registry = ctx.flowManager.snapshotActiveFlows({
    operationOwnerToken: ctx.repositoryOperationOwnerToken || null,
  });
  const activeEntry = registry.entries.find((entry) => entry.spec === specId);
  if (!activeEntry) {
    throw Object.assign(new Error("target Flow is parked or no longer active"), {
      code: "DIRECT_MODE_UNSUPPORTED",
    });
  }
  if (activeEntry.mode !== "worktree") {
    throw Object.assign(new Error(`target mode ${activeEntry.mode} is unsupported`), {
      code: "DIRECT_MODE_UNSUPPORTED",
    });
  }
  if (registry.revision == null) throw new Error("active Flow registry revision is unavailable");
  return {
    specId,
    worktreePath,
    worktreeManager,
    binding,
    registry,
    mainRoot: ctx.mainRoot || ctx.flowManager._mainRoot || paths.mainRepoPath,
  };
}

function captureDirectTarget(ctx, state) {
  const target = managedTargetContext(ctx, state);
  const featureHead = gitValue(
    ["-C", target.mainRoot, "rev-parse", `refs/heads/${state.featureBranch}`],
    "direct feature HEAD could not be resolved",
  );
  return new DirectFlowTarget({
    runId: state.runId,
    issue: state.issue ?? null,
    spec: state.spec,
    worktreePath: target.worktreePath,
    bindingRevision: target.binding.revision,
    featureBranch: state.featureBranch,
    baseBranch: state.baseBranch,
    featureHead,
    flowStateRevision: flowStateRevisionDigest(state),
    activeRegistryRevision: target.registry.revision,
  });
}

function captureDirectRecoveryTarget(ctx, state, session, plan) {
  const managed = managedTargetContext(ctx, state);
  const featureHead = gitValue(
    ["-C", managed.mainRoot, "rev-parse", `refs/heads/${state.featureBranch}`],
    "direct recovery feature HEAD could not be resolved",
  );
  const worktreeHead = gitValue(
    ["-C", managed.worktreePath, "rev-parse", "HEAD"],
    "direct recovery worktree HEAD could not be resolved",
  );
  const branch = gitValue(
    ["-C", managed.worktreePath, "branch", "--show-current"],
    "direct recovery worktree branch could not be resolved",
  );
  const ancestry = runGit([
    "-C",
    managed.mainRoot,
    "merge-base",
    "--is-ancestor",
    session.target.featureHead,
    featureHead,
  ]).ok;
  const originMatches = flowStateRevisionDigest(originatingFlowState(state))
    === plan.originFlowStateRevision;
  if (
    managed.worktreePath !== session.target.worktreePath
    || featureHead !== worktreeHead
    || branch !== state.featureBranch
    || !ancestry
    || !originMatches
  ) {
    throw Object.assign(new Error(
      "direct recovery target changed after abort; retained work was not reopened",
    ), {
      code: "DIRECT_RECOVERY_TARGET_CHANGED",
      data: {
        expectedWorktreePath: session.target.worktreePath,
        worktreePath: managed.worktreePath,
        featureHead,
        worktreeHead,
        branch,
        ancestry,
        originMatches,
      },
    });
  }
  return new DirectFlowTarget({
    ...session.target.toJSON(),
    bindingRevision: managed.binding.revision,
    activeRegistryRevision: managed.registry.revision,
    featureHead,
    flowStateRevision: plan.originFlowStateRevision,
  });
}

function implementationReached(state) {
  const implement = findStepById(state.steps || [], "implement");
  return implement != null && ["in_progress", "done", "skipped"].includes(implement.status);
}

function approvedSpec(state) {
  const approval = findStepById(state.steps || [], "approval");
  return approval?.status === "done";
}

function eligibility(ctx, state) {
  if (!state) return { supported: false, reason: "NO_FLOW" };
  if (state.directFlowSession) return { supported: true };
  if (state.worktree !== true) {
    return { supported: false, reason: "DIRECT_MODE_UNSUPPORTED", detail: "branch and local modes are out of scope" };
  }
  if (!approvedSpec(state)) {
    return { supported: false, reason: "DIRECT_MODE_UNSUPPORTED", detail: "the spec is not approved" };
  }
  if (!implementationReached(state)) {
    return { supported: false, reason: "DIRECT_MODE_UNSUPPORTED", detail: "the Flow has not reached impl" };
  }
  try {
    managedTargetContext(ctx, state);
  } catch (error) {
    return { supported: false, reason: error.code || "DIRECT_MODE_UNSUPPORTED", detail: error.message };
  }
  return { supported: true };
}

function unsupportedResult(state, detail) {
  const normalAction = commandFor(state, "get next-action");
  return promptResult({
    code: "DIRECT_MODE_UNSUPPORTED",
    state,
    question: "Direct mode cannot change this Flow. What should happen next?",
    choices: [
      choice({
        actionId: "CONTINUE_NORMAL_FLOW",
        label: "Continue through the normal Flow path",
        nextAction: normalAction,
        impact: {
          retains: ["Flow state", "worktree or branch", "artifacts"],
          changes: ["Only normal Flow state when the returned action is executed"],
        },
      }),
      choice({
        actionId: "KEEP_FLOW_STATE",
        label: "Keep the Flow exactly as it is",
        nextAction: commandFor(state, "get status --details"),
        impact: { retains: ["Flow state", "Git state", "all artifacts"] },
      }),
    ],
    recommendedActionId: "CONTINUE_NORMAL_FLOW",
    recommendationReason: detail || "The target is outside the state-changing scope of direct mode.",
    details: { reason: detail || "unsupported target" },
  });
}

function operationBusyResult(state, conflict) {
  return promptResult({
    code: conflict.code || "REPOSITORY_FLOW_OPERATION_BUSY",
    state,
    question: "Another repository Flow/Git operation owns the mutation authority. What should happen next?",
    choices: [
      choice({
        actionId: "RETRY_DIRECT_HANDOFF",
        label: "Retry the read-only direct handoff after the owner finishes",
        nextAction: commandFor(state, "get direct"),
        impact: { retains: ["Flow state", "worktree", "feature branch", "artifacts"] },
      }),
      choice({
        actionId: "INSPECT_FLOW_STATUS",
        label: "Inspect the preserved target without starting conflict handling",
        nextAction: commandFor(state, "get status --details"),
        impact: { retains: ["Flow state", "Git state", "lock ownership"] },
      }),
    ],
    recommendedActionId: "RETRY_DIRECT_HANDOFF",
    recommendationReason: "Direct mode must not compete with or reclaim a live repository operation.",
    details: { lockPath: conflict.lockPath || null },
  });
}

function repositoryOperationConflict(ctx) {
  const mainRoot = ctx.mainRoot || ctx.flowManager?._mainRoot || ctx.root;
  const conflict = new RepositoryFlowOperationLock({
    mainRoot,
    operationOwnerToken: ctx.repositoryOperationOwnerToken || null,
  }).inspectConflict();
  return conflict?.code?.endsWith("_LOCK_STALE") ? null : conflict;
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size > 1024 * 1024) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectPlanFindings(root, state, autoSelectSafe) {
  const specDir = path.dirname(path.resolve(root, state.spec));
  const collected = [];
  const add = (input) => {
    if (collected.length >= MAX_FINDINGS) return;
    if (collected.some((finding) => finding.findingId === input.findingId)) return;
    collected.push(new DirectResolutionFinding(input));
  };
  const deferred = readJsonIfPresent(path.join(specDir, "flow-findings.json"));
  for (const entry of deferred?.entries || []) {
    const final = entry.finalDisposition;
    const dismissed = ["fixed", "not_needed", "false_positive", "pre_existing"].includes(final);
    const classification = dismissed ? "DISMISSED" : "FIX_REQUIRED";
    const recommendedResolution = dismissed
      ? `Retain the existing final disposition: ${final}`
      : "Resolve the deferred finding in direct mode and cover it with deterministic verification.";
    add({
      findingId: `flow-finding:${entry.findingId}`,
      source: entry.sourceArtifact || "flow-findings.json",
      classification,
      summary: entry.rationale || `Deferred finding ${entry.findingId}`,
      recommendedResolution,
      changeTargets: [],
      rationale: dismissed
        ? "The existing final disposition is already non-blocking."
        : "The finding remains unresolved in the durable Flow finding ledger.",
      selectedResolution: autoSelectSafe ? recommendedResolution : null,
    });
  }
  for (const artifact of ["impl-review.json", "impl-gate-result.json", "acceptance-review.json"]) {
    const value = readJsonIfPresent(path.join(specDir, artifact));
    if (
      artifact === "acceptance-review.json"
      && value?.verdict === "user_decision_required"
      && value?.userDecision == null
    ) {
      add({
        findingId: "acceptance-review:user-decision",
        source: artifact,
        classification: "USER_DECISION_REQUIRED",
        summary: "Acceptance evidence requires an explicit user decision.",
        recommendedResolution: "Resolve the acceptance decision explicitly before direct implementation continues.",
        changeTargets: [],
        rationale: "The durable acceptance artifact is waiting for a user-owned semantic decision.",
        selectedResolution: null,
      });
    }
    const findings = Array.isArray(value?.findings) ? value.findings : [];
    for (let index = 0; index < findings.length; index += 1) {
      const finding = findings[index];
      const disposition = String(
        finding?.finalDisposition || finding?.disposition || finding?.severity || "",
      ).toLowerCase();
      if (!["must-fix", "blocking", "still_open", "fail", "error"].includes(disposition)) continue;
      const findingId = finding.findingId || finding.id || `${artifact}:${index + 1}`;
      const recommendedResolution = "Apply the finding's bounded fix before direct verification.";
      add({
        findingId: `${artifact}:${findingId}`,
        source: artifact,
        classification: "FIX_REQUIRED",
        summary: finding.summary || finding.message || finding.reason || `Unresolved finding ${findingId}`,
        recommendedResolution,
        changeTargets: Array.isArray(finding.files)
          ? finding.files
          : finding.file
            ? [finding.file]
            : [],
        rationale: "The latest post-implementation artifact records this finding as blocking.",
        selectedResolution: autoSelectSafe ? recommendedResolution : null,
      });
    }
  }
  return collected;
}

function latestRoutingFailure(state) {
  const attempts = Array.isArray(state.stepAttempts) ? state.stepAttempts : [];
  const latest = attempts.findLast((entry) => (
    entry?.runId === state.runId
      && entry?.outcome
      && ["external-blocked", "awaiting-decision"].includes(entry.outcome.kind)
  ));
  return latest?.outcome?.reason || null;
}

function planIssueLogId(plan) {
  return `direct-plan:${plan.target.runId}:${plan.planId}:r${plan.revision}`;
}

function appendPlanIssueLog({ root, state, plan, mainRoot, operationOwnerToken = null }) {
  const findings = plan.findings.map((finding) => ({
    findingId: finding.findingId,
    classification: finding.classification,
    selectedResolution: finding.selectedResolution,
    changeTargets: [...finding.changeTargets],
    rationale: finding.rationale,
  }));
  return new IssueLogStore({
    root,
    mainRoot,
    spec: state.spec,
    operationOwnerToken,
  }).append({
    step: "direct-handoff-preflight",
    reason: plan.transitionReason,
    trigger: plan.adoptedActionId,
    resolution: "Persisted the direct resolution plan before implementation changes.",
    runId: plan.target.runId,
    planId: plan.planId,
    planRevision: plan.revision,
    sourceStep: plan.sourceStep,
    skippedSteps: [...plan.skippedSteps],
    routingFailure: plan.routingFailure,
    findings,
    timestamp: plan.transitionAt,
    taskId: null,
  }, planIssueLogId(plan));
}

function appendAbortRecoveryIssueLog({
  root,
  state,
  plan,
  abortReceipt,
  reason,
  mainRoot,
  operationOwnerToken = null,
}) {
  return new IssueLogStore({
    root,
    mainRoot,
    spec: state.spec,
    operationOwnerToken,
  }).append({
    step: "direct-recovery",
    reason,
    trigger: "REOPEN_ABORTED_DIRECT",
    resolution: "Archived the abort receipt and reopened the retained target for bounded verification.",
    runId: state.runId,
    planId: plan.planId,
    planRevision: plan.revision,
    abortReceiptId: abortReceipt.receiptId,
    sourceStep: plan.sourceStep,
    timestamp: new Date().toISOString(),
    taskId: null,
  }, `direct-recovery:${state.runId}:${abortReceipt.receiptId}:r${plan.revision}`);
}

function explicitSelectionSource(input) {
  const source = String(input.source || "manual").trim().toLowerCase();
  if (source === "manual") return source;
  throw Object.assign(new Error("direct transition requires an explicit user selection"), {
    code: "DIRECT_EXPLICIT_SELECTION_REQUIRED",
  });
}

function persistSelectedSession(authority, state, input, actionId) {
  if (state.directFlowSession) return DirectFlowSession.fromStored(state.directFlowSession);
  const selectionSource = explicitSelectionSource(input);
  const target = captureDirectTarget(authority, state);
  const sourceStep = findActiveNode(state)?.stepId || "impl";
  const selectedAt = new Date().toISOString();
  const session = new DirectFlowSession({
    phase: "DIRECT_SELECTED",
    target,
    sourceStep,
    transitionReason: input.reason || "User explicitly selected direct mode.",
    selectionSource,
    adoptedActionId: actionId,
    requestedScopePaths: normalizedScopePaths(input.scope),
    selectedAt,
  });
  authority.flowManager.mutate((current) => {
    if (current.directFlowSession) return;
    current.directFlowSession = session.toJSON();
  }, directMutationOptions(authority, { expectedOriginal: state }));
  return session;
}

function buildPlan(authority, state, session, input) {
  const originatingRevision = flowStateRevisionDigest(originatingFlowState(state));
  if (originatingRevision !== session.target.flowStateRevision) {
    throw Object.assign(new Error("Flow state changed after direct selection and before plan persistence"), {
      code: "DIRECT_CAS_CONFLICT",
    });
  }
  const targetRoot = session.target.worktreePath;
  const initialPaths = combinedChangedPaths(
    targetRoot,
    state,
    directIgnoredPathPrefixes(authority, targetRoot),
  );
  const explicitPaths = normalizedScopePaths([
    ...session.requestedScopePaths,
    ...normalizedScopePaths(input.scope),
  ]);
  const findings = collectPlanFindings(
    authority.root,
    state,
    state.autoApprove === true || session.adoptedActionId.startsWith("SELECT_DIRECT_"),
  );
  const findingTargets = findings.flatMap((finding) => finding.changeTargets);
  return new DirectResolutionPlan({
    target: session.target,
    sourceStep: session.sourceStep,
    transitionReason: session.transitionReason,
    transitionAt: session.selectedAt,
    skippedSteps: DIRECT_SKIPPED_STEPS.filter((stepId) => {
      const step = findStepById(state.steps || [], stepId);
      return step == null || !["done", "skipped"].includes(step.status);
    }),
    validationItems: DIRECT_VALIDATION_ITEMS,
    findings,
    routingFailure: latestRoutingFailure(state),
    originFlowStateRevision: session.target.flowStateRevision,
    selectionSource: session.selectionSource,
    adoptedActionId: session.adoptedActionId,
    scopePaths: normalizedScopePaths([...initialPaths, ...explicitPaths, ...findingTargets]),
  });
}

function ensureDirectPreflight(authority, input, finalPhase) {
  let state = authority.flowManager.load(authority.specId);
  let session = DirectFlowSession.fromStored(state.directFlowSession);
  let plan = state.directResolutionPlan
    ? DirectResolutionPlan.fromStored(state.directResolutionPlan)
    : null;
  if (!plan) {
    plan = buildPlan(authority, state, session, input);
    const handoff = session.withPlan(plan).transition("DIRECT_HANDOFF_PREFLIGHT");
    authority.flowManager.mutate((current) => {
      const currentSession = DirectFlowSession.fromStored(current.directFlowSession);
      if (current.directResolutionPlan) return;
      if (currentSession.phase !== "DIRECT_SELECTED") {
        throw Object.assign(new Error("direct session changed before preflight"), {
          code: "DIRECT_CAS_CONFLICT",
        });
      }
      current.directResolutionPlan = plan.toJSON();
      current.directFlowSession = handoff.toJSON();
    }, directMutationOptions(authority, { expectedOriginal: state }));
    state = authority.flowManager.load(authority.specId);
    session = DirectFlowSession.fromStored(state.directFlowSession);
  }
  appendPlanIssueLog({
    root: authority.root,
    mainRoot: authority.mainRoot,
    state,
    plan,
    operationOwnerToken: authority.repositoryOperationOwnerToken,
  });
  if (plan.unresolvedDecisions.length > 0) {
    return { state, session, plan, waiting: true };
  }
  if (session.phase === "DIRECT_HANDOFF_PREFLIGHT") {
    const next = session.transition(finalPhase, {
      planId: plan.planId,
      planRevision: plan.revision,
    });
    authority.flowManager.mutate((current) => {
      const currentSession = DirectFlowSession.fromStored(current.directFlowSession);
      if (
        currentSession.phase !== "DIRECT_HANDOFF_PREFLIGHT"
        || currentSession.planId !== plan.planId
        || currentSession.planRevision !== plan.revision
      ) {
        throw Object.assign(new Error("direct session changed before preflight completion"), {
          code: "DIRECT_CAS_CONFLICT",
        });
      }
      current.directFlowSession = next.toJSON();
    }, directMutationOptions(authority, { expectedOriginal: state }));
    state = authority.flowManager.load(authority.specId);
    session = DirectFlowSession.fromStored(state.directFlowSession);
  }
  return { state, session, plan, waiting: false };
}

function sessionWithPlan(session, plan, changes = {}) {
  return new DirectFlowSession({
    ...session.toJSON(),
    ...changes,
    planId: plan.planId,
    planRevision: plan.revision,
    revision: session.revision + 1,
    updatedAt: new Date().toISOString(),
  });
}

function persistPlanRevision(authority, state, plan, changes = {}) {
  const session = DirectFlowSession.fromStored(state.directFlowSession);
  const currentPlan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
  if (
    currentPlan.planId !== plan.planId
    || currentPlan.revision + 1 !== plan.revision
    || session.planId !== currentPlan.planId
    || session.planRevision !== currentPlan.revision
  ) {
    throw Object.assign(new Error("direct plan revision changed before persistence"), {
      code: "DIRECT_CAS_CONFLICT",
    });
  }
  const nextSession = sessionWithPlan(session, plan, changes);
  authority.flowManager.mutate((current) => {
    const durablePlan = DirectResolutionPlan.fromStored(current.directResolutionPlan);
    const durableSession = DirectFlowSession.fromStored(current.directFlowSession);
    if (
      durablePlan.planId !== currentPlan.planId
      || durablePlan.revision !== currentPlan.revision
      || durableSession.revision !== session.revision
    ) {
      throw Object.assign(new Error("direct plan CAS changed before persistence"), {
        code: "DIRECT_CAS_CONFLICT",
      });
    }
    current.directResolutionPlan = plan.toJSON();
    current.directFlowSession = nextSession.toJSON();
  }, directMutationOptions(authority, { expectedOriginal: state }));
  const persisted = authority.flowManager.load(authority.specId);
  appendPlanIssueLog({
    root: authority.root,
    mainRoot: authority.mainRoot,
    state: persisted,
    plan,
    operationOwnerToken: authority.repositoryOperationOwnerToken,
  });
  return persisted;
}

function advanceResolvedPreflight(authority, state) {
  const session = DirectFlowSession.fromStored(state.directFlowSession);
  const plan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
  if (plan.unresolvedDecisions.length > 0 || session.phase !== "DIRECT_HANDOFF_PREFLIGHT") {
    return state;
  }
  const finalPhase = session.adoptedActionId === "SELECT_DIRECT_RECONCILE"
    ? "DIRECT_RECONCILE"
    : "DIRECT_FIX";
  const next = session.transition(finalPhase);
  authority.flowManager.mutate((current) => {
    const durable = DirectFlowSession.fromStored(current.directFlowSession);
    if (
      durable.revision !== session.revision
      || durable.phase !== "DIRECT_HANDOFF_PREFLIGHT"
      || durable.planId !== plan.planId
      || durable.planRevision !== plan.revision
    ) {
      throw Object.assign(new Error("direct preflight changed before decision completion"), {
        code: "DIRECT_CAS_CONFLICT",
      });
    }
    current.directFlowSession = next.toJSON();
  }, directMutationOptions(authority, { expectedOriginal: state }));
  return authority.flowManager.load(authority.specId);
}

function resolveDirectDecision(authority, input) {
  const state = authority.flowManager.load(authority.specId);
  const plan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
  const finding = plan.unresolvedDecisions.find((entry) => entry.findingId === input.findingId);
  if (!finding) {
    throw Object.assign(new Error(`unresolved direct finding does not exist: ${input.findingId || "<missing>"}`), {
      code: "DIRECT_FINDING_NOT_FOUND",
    });
  }
  const revised = plan.withFindingResolution(input.findingId, input.resolution);
  const persisted = persistPlanRevision(authority, state, revised);
  return advanceResolvedPreflight(authority, persisted);
}

function recordDirectFinding(authority, input) {
  const state = authority.flowManager.load(authority.specId);
  const session = DirectFlowSession.fromStored(state.directFlowSession);
  if (!["DIRECT_FIX", "DIRECT_VERIFY"].includes(session.phase)) {
    throw Object.assign(new Error(`new direct findings cannot be recorded from ${session.phase}`), {
      code: "DIRECT_PHASE_MISMATCH",
    });
  }
  const classification = String(input.classification || "FIX_REQUIRED").trim().toUpperCase();
  const recommendedResolution = String(input.recommendedResolution || input.resolution || "").trim();
  const selectedResolution = classification === "USER_DECISION_REQUIRED"
    ? null
    : (String(input.resolution || recommendedResolution).trim() || null);
  const finding = new DirectResolutionFinding({
    findingId: input.findingId,
    source: input.findingSource || "direct-fix",
    classification,
    summary: input.summary,
    recommendedResolution,
    changeTargets: normalizedScopePaths(input.changeTarget),
    rationale: input.rationale,
    selectedResolution,
  });
  const plan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
  const revised = plan.withFinding(finding);
  return persistPlanRevision(authority, state, revised);
}

function authorityForDirectFix(ctx, state) {
  const target = managedTargetContext(ctx, state);
  return {
    ...ctx,
    root: target.worktreePath,
    mainRoot: target.mainRoot,
    flowManager: target.worktreeManager,
    flowState: target.worktreeManager.load(target.specId),
    state: target.worktreeManager.load(target.specId),
    specId: target.specId,
  };
}

function mainStateForReconcile(ctx, state) {
  const target = managedTargetContext(ctx, state);
  const mainManager = ctx.flowManager.forRoot(target.mainRoot, { specId: target.specId });
  let mainState = mainManager.loadReadOnly(target.specId);
  if (!mainState) {
    mainManager.create(structuredClone(state), directMutationOptions(ctx));
    mainState = mainManager.load(target.specId);
  }
  return {
    ...ctx,
    root: target.mainRoot,
    mainRoot: target.mainRoot,
    flowManager: mainManager,
    flowState: mainState,
    state: mainState,
    specId: target.specId,
  };
}

export function inspectDirectReconcileEvidence(ctx, state) {
  if (!state?.worktree || !state.featureBranch || !state.baseBranch) return null;
  const target = managedTargetContext(ctx, state);
  const ignoredPrefixes = directIgnoredPathPrefixes(ctx, target.worktreePath);
  const directMetadata = new Set([
    `specs/${target.specId}/flow.json`,
    `specs/${target.specId}/issue-log.json`,
  ]);
  const uncommittedImplementationPaths = readWorkingTreePaths(target.worktreePath)
    .filter((relativePath) => !directMetadata.has(relativePath))
    .filter((relativePath) => !ignoredPrefixes.some((prefix) => (
      relativePath === prefix || relativePath.startsWith(`${prefix}/`)
    )));
  if (uncommittedImplementationPaths.length > 0) return null;
  const mainManager = ctx.flowManager.forRoot(target.mainRoot, { specId: target.specId });
  const mainState = mainManager.loadReadOnly(target.specId);
  const receiptEvidence = mainState
    ? inspectPersistedIntegrationReceipt(target.mainRoot, mainState)
    : null;
  if (receiptEvidence) return receiptEvidence;
  const featureHead = gitValue(
    ["-C", target.mainRoot, "rev-parse", `refs/heads/${state.featureBranch}`],
    "reconcile feature HEAD could not be resolved",
  );
  const mainHead = gitValue(
    ["-C", target.mainRoot, "rev-parse", `refs/heads/${state.baseBranch}`],
    "reconcile main HEAD could not be resolved",
  );
  const ancestry = runGit([
    "-C",
    target.mainRoot,
    "merge-base",
    "--is-ancestor",
    featureHead,
    mainHead,
  ]);
  if (!ancestry.ok) return null;
  return new DirectGitEvidence({ kind: "exact-ancestry", featureHead, mainHead });
}

function resolveDirectVerificationCommand(authority, state, explicitCommand = null) {
  if (typeof authority?.flowManager?.resolveWorktreePaths !== "function") return null;
  const target = managedTargetContext(authority, state);
  return new DirectVerificationCommandResolver({
    root: target.worktreePath,
    config: authority.config || {},
    state,
  }).resolve(explicitCommand);
}

function activeDirectPrompt(ctx, state) {
  const session = DirectFlowSession.fromStored(state.directFlowSession);
  const plan = state.directResolutionPlan
    ? DirectResolutionPlan.fromStored(state.directResolutionPlan)
    : null;
  const guards = guardFlagsForState(state);
  const run = (action, extra = "") => (
    `senti flow run direct --action ${action}${extra ? ` ${extra}` : ""} ${guards}`.trim()
  );
  let resolvedVerificationCommand;
  const verificationCommand = () => {
    if (resolvedVerificationCommand === undefined) {
      resolvedVerificationCommand = resolveDirectVerificationCommand(ctx, state) || null;
    }
    return resolvedVerificationCommand;
  };
  const verificationOption = () => (
    verificationCommand()?.toCliOption() || '--test-command "<command>"'
  );
  if (session.phase === "DIRECT_SELECTED") {
    return promptResult({
      code: "DIRECT_SELECTED",
      state,
      question: "Direct repair was requested, but the repair plan has not finished saving.",
      choices: [
        choice({
          actionId: "RESUME_DIRECT_PREFLIGHT",
          label: "Finish saving the repair plan",
          nextAction: run("RESUME_DIRECT_PREFLIGHT"),
          stateTransition: "DIRECT_SELECTED -> DIRECT_HANDOFF_PREFLIGHT",
          impact: {
            retains: ["normal step progress", "worktree", "feature branch", "existing records"],
            changes: ["saved repair plan", "recovery progress", "issue log"],
          },
        }),
        choice({
          actionId: "KEEP_FLOW_STATE",
          label: "Keep the saved selection without changing Git state",
          nextAction: commandFor(state, "get status --details"),
          impact: { retains: ["Flow state", "worktree", "feature branch", "artifacts"] },
        }),
      ],
      recommendedActionId: "RESUME_DIRECT_PREFLIGHT",
      recommendationReason: "The repair plan must be saved before implementation files can be changed.",
    });
  }
  if (plan?.unresolvedDecisions.length > 0) {
    const finding = plan.unresolvedDecisions[0];
    return promptResult({
      code: "DIRECT_USER_DECISION_REQUIRED",
      state,
      question: `${finding.summary} A product decision is needed before repair can continue.`,
      choices: [
        choice({
          actionId: "ADOPT_RECOMMENDED_RESOLUTION",
          label: "Use the recorded recommendation",
          nextAction: run("ADOPT_DIRECT_RECOMMENDATION", `--finding-id "${finding.findingId}"`),
          impact: {
            retains: ["normal step progress", "Git state", "earlier repair records"],
            changes: ["recorded decision", "repair plan", "issue log"],
          },
          reason: finding.rationale,
        }),
        choice({
          actionId: "RECORD_CUSTOM_RESOLUTION",
          label: "Record a different explicit resolution",
          nextAction: run(
            "RESOLVE_DIRECT_DECISION",
            `--finding-id "${finding.findingId}" --resolution "<resolution>"`,
          ),
          impact: {
            retains: ["normal step progress", "Git state", "earlier repair records"],
            changes: ["recorded decision", "repair plan", "issue log"],
          },
        }),
        choice({
          actionId: "SUSPEND_DIRECT",
          label: "Suspend and retain the exact target",
          nextAction: run("SUSPEND_DIRECT"),
          stateTransition: `${session.phase} -> SUSPENDED`,
          impact: { retains: ["Flow state", "worktree", "feature branch", "artifacts"] },
        }),
      ],
      recommendedActionId: "ADOPT_RECOMMENDED_RESOLUTION",
      recommendationReason: finding.recommendedResolution,
      details: { finding: finding.toJSON(), remainingDecisionCount: plan.unresolvedDecisions.length },
    });
  }
  if (session.phase === "DIRECT_HANDOFF_PREFLIGHT") {
    return promptResult({
      code: "DIRECT_HANDOFF_PREFLIGHT",
      state,
      question: "The repair plan is saved and all required decisions are recorded.",
      choices: [
        choice({
          actionId: "RESUME_DIRECT_PREFLIGHT",
          label: "Continue into repair",
          nextAction: run("RESUME_DIRECT_PREFLIGHT"),
          stateTransition: "DIRECT_HANDOFF_PREFLIGHT -> DIRECT_FIX/DIRECT_RECONCILE",
          impact: {
            retains: ["normal step progress", "repair plan", "all Git state"],
            changes: ["recovery progress"],
          },
        }),
        choice({
          actionId: "SUSPEND_DIRECT",
          label: "Suspend without entering direct implementation",
          nextAction: run("SUSPEND_DIRECT"),
          stateTransition: "DIRECT_HANDOFF_PREFLIGHT -> SUSPENDED",
          impact: { retains: ["Flow state", "worktree", "feature branch", "artifacts"] },
        }),
      ],
      recommendedActionId: "RESUME_DIRECT_PREFLIGHT",
      recommendationReason: "The saved plan is ready; continuing does not recreate or replace it.",
    });
  }
  if (
    ["DIRECT_FIX", "DIRECT_VERIFY"].includes(session.phase)
    && session.verificationAttempts >= MAX_DIRECT_VERIFICATION_ATTEMPTS
    && session.verification?.status !== "passed"
  ) {
    const riskAvailable = session.verification != null
      && session.verification.checks.every((check) => check.passed || check.overrideable);
    const choices = [
      choice({
        actionId: "KEEP_DIRECT_FIX",
        label: "Keep the worktree for further correction",
        nextAction: commandFor(state, "get direct"),
        impact: {
          retains: ["worktree", "feature branch", "repair plan", "test results"],
        },
      }),
      ...(riskAvailable ? [choice({
        actionId: "ACCEPT_DIRECT_RISK",
        label: "Accept only the remaining test failure risk",
        nextAction: run("ACCEPT_DIRECT_RISK", '--reason "<reason>"'),
        impact: {
          retains: ["all non-overridable safety checks"],
          changes: ["repair risk record", "test-risk acceptance"],
        },
      })] : []),
      choice({
        actionId: "SUSPEND_DIRECT",
        label: "Suspend and park this exact Flow",
        nextAction: run("SUSPEND_DIRECT"),
        stateTransition: `${session.phase} -> SUSPENDED`,
        impact: { retains: ["worktree", "feature branch", "Flow state", "artifacts"] },
      }),
      choice({
        actionId: "ABORT_DIRECT",
        label: "Abort without merge or cleanup",
        nextAction: run("ABORT_DIRECT", '--reason "<reason>"'),
        stateTransition: `${session.phase} -> ABORTED`,
        impact: {
          retains: ["worktree", "feature branch", "unapplied changes"],
          changes: ["direct abort receipt"],
        },
      }),
    ];
    return promptResult({
      code: "DIRECT_VERIFICATION_LIMIT",
      state,
      question: `The project tests did not pass after ${MAX_DIRECT_VERIFICATION_ATTEMPTS} attempts. Automatic retries are stopped.`,
      choices,
      recommendedActionId: "KEEP_DIRECT_FIX",
      recommendationReason: "Keep the worktree so the remaining failure can be corrected without losing work.",
      details: {
        attempts: session.verificationAttempts,
        maxAttempts: MAX_DIRECT_VERIFICATION_ATTEMPTS,
        verification: session.verification?.toJSON() || null,
      },
    });
  }
  if (session.phase === "DIRECT_FIX") {
    return promptResult({
      code: "DIRECT_FIX",
      state,
      question: "The repair plan is saved. Run the recorded project tests after the code changes are ready.",
      choices: [
        choice({
          actionId: "VERIFY_DIRECT",
          label: "Run the recorded project verification",
          nextAction: run("VERIFY_DIRECT", verificationOption()),
          impact: {
            retains: ["normal Flow step progress", "repair plan"],
            changes: ["direct verification result", "test evidence"],
          },
        }),
        choice({
          actionId: "RECORD_DIRECT_FINDING",
          label: "Record a newly discovered finding before continuing",
          nextAction: run(
            "RECORD_DIRECT_FINDING",
            [
              '--finding-id "<id>"',
              '--finding-source "<source>"',
              '--classification "<classification>"',
              '--summary "<summary>"',
              '--recommended-resolution "<resolution>"',
              '--change-target "<paths>"',
              '--rationale "<rationale>"',
            ].join(" "),
          ),
          impact: {
            retains: ["normal step statuses", "Git state", "prior plan revisions"],
            changes: ["direct finding ledger", "plan revision", "spec issue-log"],
          },
        }),
        choice({
          actionId: "SUSPEND_DIRECT",
          label: "Suspend and park this exact Flow",
          nextAction: run("SUSPEND_DIRECT"),
          stateTransition: "DIRECT_FIX -> SUSPENDED",
          impact: { retains: ["worktree", "feature branch", "Flow state", "artifacts"] },
        }),
        choice({
          actionId: "ABORT_DIRECT",
          label: "Abort without merging or deleting Git state",
          nextAction: run("ABORT_DIRECT", '--reason "<reason>"'),
          stateTransition: "DIRECT_FIX -> ABORTED",
          impact: {
            retains: ["worktree", "feature branch", "unapplied changes"],
            changes: ["aborted receipt"],
          },
        }),
      ],
      recommendedActionId: "VERIFY_DIRECT",
      recommendationReason: "The Flow already records the verification command needed before completion.",
      details: {
        phase: session.phase,
        verificationCommand: verificationCommand()?.toJSON() || null,
      },
    });
  }
  if (session.phase === "DIRECT_VERIFY") {
    if (session.verification?.status === "passed") {
      return promptResult({
        code: "DIRECT_VERIFY_PASSED",
        state,
      question: "Project verification passed. The repair can now be committed, integrated, and cleaned up.",
        choices: [
          choice({
            actionId: "FINALIZE_DIRECT",
            label: "Commit, merge, record completion, and clean up",
            nextAction: run("FINALIZE_DIRECT"),
            stateTransition: "DIRECT_VERIFY -> MERGE_ONLY_FINALIZE -> COMPLETED_DIRECT",
            impact: {
              retains: ["repair plan", "issue-log evidence", "completion record"],
              changes: ["base branch", "last-finalized pointer", "active registry"],
              deletes: ["managed worktree", "feature branch"],
            },
          }),
          choice({
            actionId: "RETURN_TO_DIRECT_FIX",
            label: "Return to direct fix without finalizing",
            nextAction: run("RETURN_TO_DIRECT_FIX"),
            stateTransition: "DIRECT_VERIFY -> DIRECT_FIX",
            impact: { retains: ["all Git state", "verification history"] },
          }),
        ],
        recommendedActionId: "FINALIZE_DIRECT",
        recommendationReason: "All project tests and required safety checks passed.",
      });
    }
    const riskAvailable = session.verification != null
      && session.verification.checks.every((check) => check.passed || check.overrideable);
    return promptResult({
      code: "DIRECT_VERIFY_STOPPED",
      state,
      question: "Project verification did not pass. The failed check must be corrected or explicitly accepted when allowed.",
      choices: [
        choice({
          actionId: "RETURN_TO_DIRECT_FIX",
          label: "Continue the bounded direct fix",
          nextAction: run("RETURN_TO_DIRECT_FIX"),
          stateTransition: "DIRECT_VERIFY -> DIRECT_FIX",
          impact: { retains: ["worktree", "branch", "repair plan", "failed test result"] },
        }),
        choice({
          actionId: "VERIFY_DIRECT",
          label: "Run the recorded project verification again",
          nextAction: run("VERIFY_DIRECT", verificationOption()),
          impact: { retains: ["direct plan"], changes: ["verification evidence"] },
        }),
        ...(riskAvailable ? [choice({
          actionId: "ACCEPT_DIRECT_RISK",
          label: "Explicitly accept only overrideable test risk",
          nextAction: run("ACCEPT_DIRECT_RISK", '--reason "<reason>"'),
          impact: {
            retains: ["all non-overridable safety checks"],
            changes: ["verification risk acceptance"],
          },
        })] : []),
        choice({
          actionId: "SUSPEND_DIRECT",
          label: "Suspend and park this exact Flow",
          nextAction: run("SUSPEND_DIRECT"),
          stateTransition: "DIRECT_VERIFY -> SUSPENDED",
          impact: { retains: ["worktree", "feature branch", "Flow state", "artifacts"] },
        }),
        choice({
          actionId: "ABORT_DIRECT",
          label: "Abort without merge or cleanup",
          nextAction: run("ABORT_DIRECT", '--reason "<reason>"'),
          stateTransition: "DIRECT_VERIFY -> ABORTED",
          impact: {
            retains: ["worktree", "feature branch", "unapplied changes"],
            changes: ["direct abort receipt"],
          },
        }),
      ],
      recommendedActionId: "RETURN_TO_DIRECT_FIX",
      recommendationReason: "Continue in the same worktree so the failed check can be corrected without losing work.",
      details: { verification: session.verification?.toJSON() || null },
    });
  }
  if (session.phase === "DIRECT_RECONCILE") {
    return promptResult({
      code: "DIRECT_RECONCILE",
      state,
      question: "Git confirms that the implementation is already in the base branch. Completion can be recorded without merging again.",
      choices: [
        choice({
          actionId: "FINALIZE_DIRECT_RECONCILE",
          label: "Record completion and clean up without merging again",
          nextAction: run("FINALIZE_DIRECT_RECONCILE", verificationOption()),
          stateTransition: "DIRECT_RECONCILE -> COMPLETED_DIRECT",
          impact: {
            retains: ["integrated base-branch history", "completion record"],
            changes: ["last-finalized pointer", "active registry"],
            deletes: ["managed worktree", "feature branch"],
          },
        }),
        choice({
          actionId: "SUSPEND_DIRECT",
          label: "Suspend without cleanup",
          nextAction: run("SUSPEND_DIRECT"),
          stateTransition: "DIRECT_RECONCILE -> SUSPENDED",
          impact: { retains: ["worktree", "branch", "Flow state", "evidence"] },
        }),
      ],
      recommendedActionId: "FINALIZE_DIRECT_RECONCILE",
      recommendationReason: "The implementation is already in the base branch, so this records completion without merging again.",
      details: {
        verificationCommand: verificationCommand()?.toJSON() || null,
      },
    });
  }
  if (session.phase === "MERGE_ONLY_FINALIZE") {
    return promptResult({
      code: "MERGE_ONLY_FINALIZE",
      state,
      question: "Completion was interrupted after it started. Only the unfinished completion and cleanup work remains.",
      choices: [
        choice({
          actionId: "FINALIZE_DIRECT",
          label: "Resume the remaining completion work",
          nextAction: run("FINALIZE_DIRECT"),
          impact: {
            retains: ["saved completion progress and records"],
            changes: ["only unfinished completion work"],
          },
        }),
        choice({
          actionId: "KEEP_FLOW_STATE",
          label: "Inspect and keep the current recovery authorities",
          nextAction: commandFor(state, "get status --details"),
          impact: { retains: ["all current Flow and Git state"] },
        }),
      ],
      recommendedActionId: "FINALIZE_DIRECT",
      recommendationReason: "The saved progress allows the unfinished work to resume without repeating completed operations.",
    });
  }
  if (session.phase === "SUSPENDED") {
    return promptResult({
      code: "SUSPENDED",
      state,
      question: "This direct handling is paused and its worktree and branch are still available.",
      choices: [
        choice({
          actionId: "RESUME_DIRECT",
          label: "Resume the saved repair step",
          nextAction: run("RESUME_DIRECT"),
          stateTransition: `SUSPENDED -> ${session.suspendedFrom}`,
          impact: {
            retains: ["Flow state", "worktree", "feature branch", "artifacts"],
            changes: ["recovery progress"],
          },
        }),
        choice({
          actionId: "ABORT_DIRECT",
          label: "Abort without merging or deleting Git state",
          nextAction: run("ABORT_DIRECT", '--reason "<reason>"'),
          stateTransition: "SUSPENDED -> ABORTED",
          impact: {
            retains: ["worktree", "feature branch", "unapplied changes"],
            changes: ["direct abort receipt"],
          },
        }),
        choice({
          actionId: "KEEP_FLOW_STATE",
          label: "Keep the Flow suspended",
          nextAction: commandFor(state, "get status --details"),
          impact: { retains: ["Flow state", "worktree", "feature branch", "artifacts"] },
        }),
      ],
      recommendedActionId: "RESUME_DIRECT",
      recommendationReason: "Resume continues from the saved repair step without restarting the normal Flow.",
    });
  }
  if (session.phase === "ABORTED") {
    return promptResult({
      code: "ABORTED",
      state,
      question: "Direct handling is aborted, but its retained target can be reopened for a new bounded verification cycle.",
      choices: [
        choice({
          actionId: "REOPEN_ABORTED_DIRECT",
          label: "Reopen the retained target and continue direct verification",
          nextAction: commandFor(
            state,
            'run direct --action REOPEN_ABORTED_DIRECT --reason "<reason>"',
          ),
          stateTransition: "ABORTED -> DIRECT_FIX",
          impact: {
            retains: ["worktree", "feature branch", "unapplied changes", "abort receipt history"],
            changes: ["direct plan revision", "verification attempt budget", "recovery progress"],
          },
        }),
        choice({
          actionId: "KEEP_ABORTED_TARGET",
          label: "Keep the worktree and branch for manual disposition",
          nextAction: commandFor(state, "get status --details"),
          impact: { retains: ["worktree", "feature branch", "unapplied changes", "abort receipt"] },
        }),
        choice({
          actionId: "INSPECT_ABORTED_CLEANUP",
          label: "Inspect Git state before a separate cleanup decision",
          nextAction: `git -C "${session.target.worktreePath}" status --short`,
          impact: { retains: ["all Flow and Git state"] },
          reason: "Deletion is deliberately separate and is never inferred from abort.",
        }),
      ],
      recommendedActionId: "REOPEN_ABORTED_DIRECT",
      recommendationReason: "The exact worktree, branch, plan, and abort receipt are available for guarded recovery.",
      details: {
        abortReceipt: state.directAbortReceipt || null,
        abortHistory: state.directAbortHistory || null,
      },
    });
  }
  return {
    code: session.phase,
    yieldsControl: false,
    directFlowSession: session.toJSON(),
    completion: state.directCompletionReceipt || null,
  };
}

export function getDirectFlowAction(ctx) {
  const authority = resolveStateFallback(ctx);
  const state = authority.state;
  if (!state) {
    return {
      code: "NO_FLOW",
      directMode: false,
      normalDirectFix: true,
      message: "No Flow exists. This is an ordinary direct fix; no Flow or Git state was changed.",
      yieldsControl: false,
    };
  }
  const completion = new FlowCompletion(state);
  if (completion.complete && !state.directFlowSession) {
    return {
      code: "COMPLETED",
      directMode: false,
      completion: completion.toJSON(),
      message: "This Flow is already complete. No Flow or Git state was changed.",
      yieldsControl: false,
    };
  }
  if (state.directFlowSession) {
    const session = DirectFlowSession.fromStored(state.directFlowSession);
    if (!["COMPLETED_DIRECT", "ABORTED"].includes(session.phase)) {
      const conflict = repositoryOperationConflict(authority);
      if (conflict) return operationBusyResult(state, conflict);
    }
    return activeDirectPrompt(authority, state);
  }
  const conflict = repositoryOperationConflict(authority);
  if (conflict) return operationBusyResult(state, conflict);
  const eligible = eligibility(authority, state);
  if (!eligible.supported) return unsupportedResult(state, eligible.detail);
  const evidence = inspectDirectReconcileEvidence(authority, state);
  const guards = guardFlagsForState(state);
  const selectDirect = `senti flow run direct --action SELECT_DIRECT_FIX ${guards}`;
  const choices = [
    choice({
      actionId: "SELECT_DIRECT_FIX",
      label: "Continue fixing the current implementation",
      nextAction: selectDirect.trim(),
      stateTransition: "NORMAL/BLOCKED -> DIRECT_SELECTED -> DIRECT_HANDOFF_PREFLIGHT -> DIRECT_FIX",
      impact: {
        retains: ["normal step statuses", "current worktree", "feature branch", "existing records"],
        changes: ["direct recovery progress", "bounded repair plan", "issue log"],
      },
    }),
    choice({
      actionId: "CONTINUE_NORMAL_FLOW",
      label: "Continue the normal Flow path",
      nextAction: commandFor(state, "get next-action"),
      impact: { retains: ["No direct session or plan is created"] },
    }),
  ];
  if (evidence) {
    choices.splice(1, 0, choice({
      actionId: "SELECT_DIRECT_RECONCILE",
      label: "Record an implementation that is already merged",
      nextAction: `senti flow run direct --action SELECT_DIRECT_RECONCILE ${guards}`,
      stateTransition: "EXTERNALLY_MERGED_WITH_STALE_FLOW -> DIRECT_RECONCILE",
      impact: {
        retains: ["existing base-branch history", "worktree until cleanup is confirmed"],
        changes: ["direct recovery progress", "completion evidence"],
      },
      reason: "The feature commit is already contained in the base branch.",
    }));
  }
  return promptResult({
    code: "DIRECT_SELECTION_REQUIRED",
    state,
    question: "Direct repair can continue in the current worktree. The direct skill starts that path without another confirmation.",
    choices,
    recommendedActionId: "SELECT_DIRECT_FIX",
    recommendationReason: "Explicit use of the direct skill already authorizes continuing the current repair.",
    details: {
      evidence: evidence?.toJSON() || null,
      autoApproveSelectedDirect: false,
      currentStep: findActiveNode(state)?.stepId || null,
      stopReason: latestRoutingFailure(state),
    },
  });
}

function runTestCommand(root, command, timeoutMs) {
  if (command == null || String(command).trim() === "") {
    return {
      status: "not-configured",
      command: null,
      detail: "No deterministic test command was configured.",
    };
  }
  const timeout = timeoutMs == null ? DEFAULT_TEST_TIMEOUT_MS : Number(timeoutMs);
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > MAX_TEST_TIMEOUT_MS) {
    throw new Error(`test timeout must be 1 through ${MAX_TEST_TIMEOUT_MS} milliseconds`);
  }
  const result = spawnSync(String(command), {
    cwd: root,
    encoding: "utf8",
    shell: true,
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) {
    return {
      status: "tooling-error",
      command: String(command),
      detail: result.error.message,
    };
  }
  return {
    status: result.status === 0 ? "passed" : "failed",
    command: String(command),
    detail: result.status === 0
      ? "Deterministic test command exited successfully."
      : `Deterministic test command exited ${result.status}: ${String(result.stderr || result.stdout || "").slice(0, 1000)}`,
  };
}

function pathAllowed(file, plan, specId) {
  const normalized = file.replaceAll("\\", "/");
  const metadata = new Set([
    `specs/${specId}/flow.json`,
    `specs/${specId}/issue-log.json`,
  ]);
  if (metadata.has(normalized)) return true;
  return plan.scopePaths.some((scope) => normalized === scope || normalized.startsWith(`${scope}/`));
}

function hasProhibitedGitOperation(root) {
  const gitPath = (name) => gitValue(
    ["-C", root, "rev-parse", "--git-path", name],
    `Git path ${name} could not be resolved`,
  );
  return [
    "MERGE_HEAD",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "REBASE_HEAD",
    "rebase-merge",
    "rebase-apply",
  ].filter((name) => fs.existsSync(path.resolve(root, gitPath(name))));
}

function directSafetySnapshot(authority, state, plan) {
  const target = managedTargetContext(authority, state);
  const session = DirectFlowSession.fromStored(state.directFlowSession);
  const durablePlan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
  const currentHead = gitValue(
    ["-C", target.mainRoot, "rev-parse", `refs/heads/${state.featureBranch}`],
    "direct feature ref could not be resolved",
  );
  const worktreeHead = gitValue(
    ["-C", target.worktreePath, "rev-parse", "HEAD"],
    "direct worktree HEAD could not be resolved",
  );
  const branch = gitValue(
    ["-C", target.worktreePath, "branch", "--show-current"],
    "direct worktree branch could not be resolved",
  );
  const conflictsResult = runGit(["-C", target.worktreePath, "diff", "--name-only", "--diff-filter=U"]);
  const conflictPaths = conflictsResult.ok
    ? conflictsResult.stdout.split(/\r?\n/).filter(Boolean)
    : ["<git-conflict-probe-failed>"];
  const ancestry = runGit([
    "-C",
    target.mainRoot,
    "merge-base",
    "--is-ancestor",
    plan.target.featureHead,
    currentHead,
  ]).ok;
  const changedPaths = combinedChangedPaths(
    target.worktreePath,
    state,
    directIgnoredPathPrefixes(authority, target.worktreePath),
  );
  const outOfScope = changedPaths.filter((file) => !pathAllowed(file, plan, target.specId));
  const prohibited = hasProhibitedGitOperation(target.mainRoot);
  const originRevisionMatches = flowStateRevisionDigest(originatingFlowState(state))
    === plan.originFlowStateRevision;
  const directPlanCasMatches = durablePlan.planId === plan.planId
    && durablePlan.revision === plan.revision
    && session.planId === plan.planId
    && session.planRevision === plan.revision;
  const checks = [
    {
      id: "target-identity",
      passed: plan.target.sameIdentity(state),
      detail: plan.target.sameIdentity(state)
        ? "runId, Issue, spec, and branch identity match the handoff."
        : "runId, Issue, spec, or branch identity changed.",
      overrideable: false,
    },
    {
      id: "origin-flow-revision",
      passed: originRevisionMatches,
      detail: originRevisionMatches
        ? "The normal Flow state still matches the revision adopted by the direct plan."
        : "The normal Flow state changed after direct selection.",
      overrideable: false,
    },
    {
      id: "direct-plan-cas",
      passed: directPlanCasMatches,
      detail: directPlanCasMatches
        ? "Direct session and plan revisions match."
        : "Direct session or plan revision changed.",
      overrideable: false,
    },
    {
      id: "worktree-binding",
      passed: target.binding.revision === plan.target.bindingRevision
        && target.worktreePath === plan.target.worktreePath,
      detail: target.binding.revision === plan.target.bindingRevision
        && target.worktreePath === plan.target.worktreePath
        ? "Managed worktree binding matches the handoff revision."
        : "Managed worktree binding or path changed.",
      overrideable: false,
    },
    {
      id: "active-registry-cas",
      passed: target.registry.revision === plan.target.activeRegistryRevision,
      detail: target.registry.revision === plan.target.activeRegistryRevision
        ? "Active Flow registry revision matches the handoff."
        : "Active Flow registry changed after handoff.",
      overrideable: false,
    },
    {
      id: "feature-history",
      passed: currentHead === worktreeHead && branch === state.featureBranch && ancestry,
      detail: currentHead === worktreeHead && branch === state.featureBranch && ancestry
        ? "Feature ref and worktree HEAD match and descend from the handoff HEAD."
        : "Feature ref, branch, worktree HEAD, or ancestry diverged.",
      overrideable: false,
    },
    {
      id: "git-conflicts",
      passed: conflictPaths.length === 0,
      detail: conflictPaths.length === 0
        ? "No unresolved Git conflicts exist."
        : `Unresolved conflicts: ${conflictPaths.join(", ")}`,
      overrideable: false,
    },
    {
      id: "change-scope",
      passed: outOfScope.length === 0,
      detail: outOfScope.length === 0
        ? "All changed paths are inside the persisted direct scope."
        : `Out-of-scope changes: ${outOfScope.join(", ")}`,
      overrideable: false,
    },
    {
      id: "merge-target-operation",
      passed: prohibited.length === 0,
      detail: prohibited.length === 0
        ? "No prohibited Git operation is in progress on the merge target."
        : `In-progress Git operations: ${prohibited.join(", ")}`,
      overrideable: false,
    },
  ];
  return {
    target,
    currentHead,
    changedPaths,
    pathFingerprints: directPathFingerprints(
      target.worktreePath,
      changedPaths,
      target.specId,
    ),
    checks,
  };
}

function runDirectVerification(authority, input) {
  let state = authority.flowManager.load(authority.specId);
  let session = DirectFlowSession.fromStored(state.directFlowSession);
  const plan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
  if (session.verificationAttempts >= MAX_DIRECT_VERIFICATION_ATTEMPTS) {
    throw Object.assign(new Error(
      `direct verification reached its ${MAX_DIRECT_VERIFICATION_ATTEMPTS}-attempt limit`,
    ), { code: "DIRECT_VERIFICATION_LIMIT" });
  }
  if (session.phase === "DIRECT_FIX") {
    const verifying = session.transition("DIRECT_VERIFY");
    authority.flowManager.mutate((current) => {
      current.directFlowSession = verifying.toJSON();
    }, directMutationOptions(authority, { expectedOriginal: state }));
    state = authority.flowManager.load(authority.specId);
    session = DirectFlowSession.fromStored(state.directFlowSession);
  }
  if (session.phase !== "DIRECT_VERIFY") {
    throw Object.assign(new Error(`direct verification is unavailable from ${session.phase}`), {
      code: "DIRECT_PHASE_MISMATCH",
    });
  }
  const snapshot = directSafetySnapshot(authority, state, plan);
  const verificationCommand = resolveDirectVerificationCommand(
    authority,
    state,
    input.testCommand,
  );
  const test = runTestCommand(
    snapshot.target.worktreePath,
    verificationCommand?.command,
    input.timeoutMs,
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
  const verification = new DirectVerificationResult({
    status,
    testStatus: test.status,
    testCommand: test.command,
    checks,
    changedPaths: snapshot.changedPaths,
    pathFingerprints: snapshot.pathFingerprints,
    featureHead: snapshot.currentHead,
  });
  const nextSession = session.withVerification(verification);
  authority.flowManager.mutate((current) => {
    const currentSession = DirectFlowSession.fromStored(current.directFlowSession);
    if (currentSession.phase !== "DIRECT_VERIFY") {
      throw Object.assign(new Error("direct session changed during verification"), {
        code: "DIRECT_CAS_CONFLICT",
      });
    }
    current.directFlowSession = nextSession.toJSON();
  }, directMutationOptions(authority, { expectedOriginal: state }));
  return authority.flowManager.load(authority.specId);
}

function acceptDirectRisk(authority, input) {
  const state = authority.flowManager.load(authority.specId);
  const session = DirectFlowSession.fromStored(state.directFlowSession);
  if (session.phase !== "DIRECT_VERIFY" || !session.verification) {
    throw Object.assign(new Error("risk acceptance requires a failed direct verification"), {
      code: "DIRECT_PHASE_MISMATCH",
    });
  }
  const nonOverrideableFailure = session.verification.checks.find((check) => (
    !check.passed && !check.overrideable
  ));
  if (nonOverrideableFailure) {
    throw Object.assign(new Error(
      `risk acceptance cannot bypass ${nonOverrideableFailure.id}: ${nonOverrideableFailure.detail}`,
    ), { code: "DIRECT_NON_OVERRIDEABLE_SAFETY_FAILED" });
  }
  const reason = String(input.reason || "").trim();
  if (reason.length < 10) {
    throw Object.assign(new Error("explicit risk acceptance requires a reason of at least 10 characters"), {
      code: "DIRECT_RISK_REASON_REQUIRED",
    });
  }
  const verification = new DirectVerificationResult({
    ...session.verification.toJSON(),
    status: "passed",
    riskAccepted: true,
    riskReason: reason,
    verifiedAt: new Date().toISOString(),
  });
  const plan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
  const riskFinding = new DirectResolutionFinding({
    findingId: `risk:verification:${session.verificationAttempts}`,
    source: "direct-verification",
    classification: "RISK_ACCEPTED",
    summary: "The deterministic test result did not pass.",
    recommendedResolution: "Record explicit risk acceptance without bypassing any safety check.",
    changeTargets: [],
    rationale: reason,
    selectedResolution: reason,
  });
  const revised = plan.withFinding(riskFinding);
  return persistPlanRevision(authority, state, revised, {
    verification: verification.toJSON(),
  });
}

function returnToDirectFix(authority) {
  const state = authority.flowManager.load(authority.specId);
  const session = DirectFlowSession.fromStored(state.directFlowSession);
  if (session.phase !== "DIRECT_VERIFY") {
    throw Object.assign(new Error(`cannot return to direct fix from ${session.phase}`), {
      code: "DIRECT_PHASE_MISMATCH",
    });
  }
  const next = session.transition("DIRECT_FIX");
  authority.flowManager.mutate((current) => {
    current.directFlowSession = next.toJSON();
  }, directMutationOptions(authority, { expectedOriginal: state }));
  return authority.flowManager.load(authority.specId);
}

function reopenAbortedDirect(authority, input) {
  const state = authority.flowManager.load(authority.specId);
  const session = DirectFlowSession.fromStored(state.directFlowSession);
  if (session.phase !== "ABORTED") {
    throw Object.assign(new Error(`direct reopen is unavailable from ${session.phase}`), {
      code: "DIRECT_PHASE_MISMATCH",
    });
  }
  const reason = String(input.reason || "").trim();
  if (reason.length < 10) {
    throw Object.assign(new Error("direct reopen requires an explicit reason of at least 10 characters"), {
      code: "DIRECT_REOPEN_REASON_REQUIRED",
    });
  }
  if (state.directCompletionReceipt || state.directIntegrationReceipt) {
    throw Object.assign(new Error(
      "direct reopen is unavailable after completion or integration evidence exists",
    ), { code: "DIRECT_RECOVERY_INTEGRATION_CONFLICT" });
  }
  const plan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
  const abortReceipt = DirectAbortReceipt.fromStored(state.directAbortReceipt);
  if (
    abortReceipt.runId !== state.runId
    || abortReceipt.issue !== (state.issue ?? null)
    || abortReceipt.spec !== state.spec
    || abortReceipt.planId !== plan.planId
    || abortReceipt.planRevision !== plan.revision
    || session.planId !== plan.planId
    || session.planRevision !== plan.revision
  ) {
    throw Object.assign(new Error(
      "direct abort receipt, session, and plan identities do not match",
    ), { code: "DIRECT_RECOVERY_IDENTITY_MISMATCH" });
  }
  const target = captureDirectRecoveryTarget(authority, state, session, plan);
  const revisedPlan = plan.withRecoveryTarget(target);
  const reopened = session.reopenAfterAbort(revisedPlan, reason);
  const abortHistory = DirectAbortReceiptHistory
    .fromStored(state.directAbortHistory)
    .append(abortReceipt);
  authority.flowManager.mutate((current) => {
    const durableSession = DirectFlowSession.fromStored(current.directFlowSession);
    const durablePlan = DirectResolutionPlan.fromStored(current.directResolutionPlan);
    const durableAbort = DirectAbortReceipt.fromStored(current.directAbortReceipt);
    if (
      durableSession.phase !== "ABORTED"
      || durableSession.revision !== session.revision
      || durablePlan.planId !== plan.planId
      || durablePlan.revision !== plan.revision
      || durableAbort.receiptId !== abortReceipt.receiptId
    ) {
      throw Object.assign(new Error("direct recovery state changed before reopen"), {
        code: "DIRECT_CAS_CONFLICT",
      });
    }
    current.directResolutionPlan = revisedPlan.toJSON();
    current.directFlowSession = reopened.toJSON();
    current.directAbortHistory = abortHistory.toJSON();
    delete current.directAbortReceipt;
  }, directMutationOptions(authority, { expectedOriginal: state }));
  const persisted = authority.flowManager.load(authority.specId);
  appendAbortRecoveryIssueLog({
    root: target.worktreePath,
    mainRoot: authority.mainRoot,
    state: persisted,
    plan: revisedPlan,
    abortReceipt,
    reason,
    operationOwnerToken: authority.repositoryOperationOwnerToken,
  });
  return authority.flowManager.load(authority.specId);
}

function transitionTerminal(authority, phase, input) {
  const state = authority.flowManager.load(authority.specId);
  const session = DirectFlowSession.fromStored(state.directFlowSession);
  const suppliedReason = String(input.reason || "").trim();
  if (phase === "ABORTED" && suppliedReason.length < 10) {
    throw Object.assign(new Error("direct abort requires an explicit reason of at least 10 characters"), {
      code: "DIRECT_ABORT_REASON_REQUIRED",
    });
  }
  const reason = suppliedReason || "User suspended the direct session.";
  const plan = state.directResolutionPlan
    ? DirectResolutionPlan.fromStored(state.directResolutionPlan)
    : null;
  if (phase === "ABORTED" && !plan) {
    throw Object.assign(new Error("direct abort requires a persisted resolution plan"), {
      code: "DIRECT_PLAN_REQUIRED",
    });
  }
  const abortReceipt = phase === "ABORTED"
    ? new DirectAbortReceipt({
        runId: state.runId,
        issue: state.issue ?? null,
        spec: state.spec,
        planId: plan.planId,
        planRevision: plan.revision,
        reason,
      })
    : null;
  const completion = abortReceipt
    ? {
        completionMode: "aborted",
        success: false,
        receiptId: abortReceipt.receiptId,
        reason,
        recordedAt: abortReceipt.recordedAt,
      }
    : session.completion;
  const next = session.phase === phase
    ? session
    : session.transition(phase, { completion });
  authority.flowManager.mutate((current) => {
    current.directFlowSession = next.toJSON();
    if (abortReceipt) current.directAbortReceipt = abortReceipt.toJSON();
  }, directMutationOptions(authority, { expectedOriginal: state }));
  if (phase === "SUSPENDED" && !state.state?.finalizedAt) {
    const identity = directIdentityExpectation(state);
    const { ParkedFlowIdentity } = authority.parkTypes;
    const worktreeManager = authority.flowManager.forRoot(session.target.worktreePath, {
      specId: authority.specId,
    });
    worktreeManager.parkActiveFlow(new ParkedFlowIdentity(identity), {
      operationOwnerToken: authority.repositoryOperationOwnerToken,
    });
  }
  return authority.flowManager.loadReadOnly(authority.specId);
}

function resumeDirectSession(authority) {
  const state = authority.flowManager.load(authority.specId);
  const session = DirectFlowSession.fromStored(state.directFlowSession);
  if (session.phase !== "SUSPENDED") {
    throw Object.assign(new Error(`direct resume is unavailable from ${session.phase}`), {
      code: "DIRECT_PHASE_MISMATCH",
    });
  }
  if (!state.state?.finalizedAt) {
    const worktreeManager = authority.flowManager.forRoot(session.target.worktreePath, {
      specId: authority.specId,
    });
    const identity = new authority.parkTypes.ParkedFlowIdentity(directIdentityExpectation(state));
    worktreeManager.resumeParkedFlow(identity, {
      operationOwnerToken: authority.repositoryOperationOwnerToken,
    });
  }
  const resumed = session.transition(session.suspendedFrom);
  authority.flowManager.mutate((current) => {
    const durable = DirectFlowSession.fromStored(current.directFlowSession);
    if (durable.revision !== session.revision || durable.phase !== "SUSPENDED") {
      throw Object.assign(new Error("direct session changed while resuming parked state"), {
        code: "DIRECT_CAS_CONFLICT",
      });
    }
    current.directFlowSession = resumed.toJSON();
  }, directMutationOptions(authority, { expectedOriginal: state }));
  return authority.flowManager.load(authority.specId);
}

async function runDirectFlowActionOwned(ctx, input) {
  let authority = resolveStateFallback(ctx);
  const state = authority.state;
  if (!state) {
    return Envelope.fail("run", "direct", "NO_FLOW", "No Flow exists; use an ordinary direct fix.");
  }
  const action = String(input.action || "").trim();
  if (!action) {
    return Envelope.fail("run", "direct", "DIRECT_ACTION_REQUIRED", "--action is required");
  }
  if (new FlowCompletion(state).complete && !state.directFlowSession) {
    return Envelope.fail(
      "run",
      "direct",
      "FLOW_ALREADY_COMPLETED",
      "The normal Flow is already complete; direct mode did not mutate it.",
    );
  }
  const eligible = eligibility(authority, state);
  if (!eligible.supported) {
    const result = unsupportedResult(state, eligible.detail);
    return stoppedEnvelope(
      "run",
      "direct",
      "DIRECT_MODE_UNSUPPORTED",
      eligible.detail || "direct mode is unsupported for this target",
      state,
      result.actionPrompt,
    );
  }

  if (["SELECT_DIRECT_FIX", "SELECT_DIRECT_RECONCILE"].includes(action)) {
    try {
      explicitSelectionSource(input);
    } catch (error) {
      const selection = getDirectFlowAction(authority);
      return stoppedEnvelope(
        "run",
        "direct",
        error.code,
        error.message,
        state,
        selection.actionPrompt,
      );
    }
  }

  if (action === "SELECT_DIRECT_FIX") {
    authority = authorityForDirectFix(authority, state);
    let current = authority.state;
    persistSelectedSession(authority, current, input, action);
    const prepared = ensureDirectPreflight(authority, input, "DIRECT_FIX");
    if (prepared.waiting) return activeDirectPrompt(authority, prepared.state);
    return activeDirectPrompt(authority, prepared.state);
  }

  if (action === "SELECT_DIRECT_RECONCILE") {
    const evidence = inspectDirectReconcileEvidence(authority, state);
    if (!evidence) {
      return stoppedEnvelope(
        "run",
        "direct",
        "DIRECT_RECONCILE_EVIDENCE_INSUFFICIENT",
        [
          "Reconciliation requires a matching integration receipt or exact feature-HEAD ancestry.",
          "Squash, cherry-pick, patch equivalence, tree digest, and file equality are not adopted.",
        ],
        state,
        new UserActionPrompt({
          question: "Strong integration evidence is unavailable. What should happen next?",
          choices: [
            choice({
              actionId: "SELECT_DIRECT_FIX",
              label: "Use direct fix and a safety-checked merge",
              nextAction: `${commandFor(state, "run direct --action SELECT_DIRECT_FIX")} --scope <paths>`,
              impact: {
                retains: ["existing main and feature history"],
                changes: ["direct plan after explicit selection"],
              },
            }),
            choice({
              actionId: "KEEP_FLOW_STATE",
              label: "Keep the stale Flow and inspect evidence manually",
              nextAction: commandFor(state, "get status --details"),
              impact: { retains: ["worktree", "branch", "Flow state", "artifacts"] },
            }),
          ],
          recommendedActionId: "KEEP_FLOW_STATE",
          recommendationReason: "Without strong evidence, automatic reconciliation must fail closed.",
        }),
      );
    }
    authority = mainStateForReconcile(authority, state);
    persistSelectedSession(authority, authority.state, input, action);
    const prepared = ensureDirectPreflight(authority, input, "DIRECT_RECONCILE");
    const refreshed = authority.flowManager.load(authority.specId);
    authority.flowManager.mutate((current) => {
      current.directReconcileEvidence = evidence.toJSON();
    }, directMutationOptions(authority, { expectedOriginal: refreshed }));
    return activeDirectPrompt(authority, authority.flowManager.load(authority.specId));
  }

  const currentSession = state.directFlowSession
    ? DirectFlowSession.fromStored(state.directFlowSession)
    : null;
  if (!currentSession) {
    return Envelope.fail(
      "run",
      "direct",
      "DIRECT_SELECTION_REQUIRED",
      "Select DIRECT_FIX or DIRECT_RECONCILE before running a direct action.",
    );
  }
  if (currentSession.phase === "COMPLETED_DIRECT") {
    return Envelope.fail(
      "run",
      "direct",
      "FLOW_ALREADY_COMPLETED",
      "The direct Flow is already complete; no state was changed.",
    );
  }
  if (currentSession.phase === "ABORTED" && action !== "REOPEN_ABORTED_DIRECT") {
    const prompt = activeDirectPrompt(authority, state);
    return stoppedEnvelope(
      "run",
      "direct",
      "DIRECT_ALREADY_ABORTED",
      "The direct Flow is already aborted; merge and cleanup remain disabled.",
      state,
      prompt.actionPrompt,
    );
  }
  const directTarget = currentSession.target;
  const targetManager = authority.flowManager.forRoot(
    authority.root === directTarget.worktreePath ? authority.root : (
      currentSession.phase === "DIRECT_RECONCILE"
        || authority.root === (authority.mainRoot || authority.flowManager._mainRoot)
        ? authority.root
        : directTarget.worktreePath
    ),
    { specId: specIdFromPath(state.spec) },
  );
  authority = {
    ...authority,
    flowManager: targetManager,
    state: targetManager.load(specIdFromPath(state.spec)),
    flowState: targetManager.load(specIdFromPath(state.spec)),
    specId: specIdFromPath(state.spec),
    parkTypes: await import("../../lib/flow-manager.js"),
  };

  if (action === "RESUME_DIRECT_PREFLIGHT") {
    const current = authority.flowManager.load(authority.specId);
    const session = DirectFlowSession.fromStored(current.directFlowSession);
    let resumed;
    if (session.phase === "DIRECT_SELECTED") {
      const finalPhase = session.adoptedActionId === "SELECT_DIRECT_RECONCILE"
        ? "DIRECT_RECONCILE"
        : "DIRECT_FIX";
      resumed = ensureDirectPreflight(authority, input, finalPhase).state;
    } else {
      resumed = advanceResolvedPreflight(authority, current);
    }
    return activeDirectPrompt(authority, resumed);
  }
  if (action === "ADOPT_DIRECT_RECOMMENDATION") {
    const current = authority.flowManager.load(authority.specId);
    const plan = DirectResolutionPlan.fromStored(current.directResolutionPlan);
    const finding = plan.unresolvedDecisions.find((entry) => entry.findingId === input.findingId);
    if (!finding) {
      return stoppedEnvelope(
        "run",
        "direct",
        "DIRECT_FINDING_NOT_FOUND",
        `Unresolved direct finding does not exist: ${input.findingId || "<missing>"}`,
        current,
        activeDirectPrompt(authority, current).actionPrompt,
      );
    }
    const resolved = resolveDirectDecision(authority, {
      ...input,
      resolution: finding.recommendedResolution,
    });
    return activeDirectPrompt(authority, resolved);
  }
  if (action === "RESOLVE_DIRECT_DECISION") {
    const resolved = resolveDirectDecision(authority, input);
    return activeDirectPrompt(authority, resolved);
  }
  if (action === "RECORD_DIRECT_FINDING") {
    const recorded = recordDirectFinding(authority, input);
    return activeDirectPrompt(authority, recorded);
  }
  if (action === "VERIFY_DIRECT") {
    if (DirectFlowSession.fromStored(authority.state.directFlowSession).verificationAttempts
      >= MAX_DIRECT_VERIFICATION_ATTEMPTS) {
      const stopped = activeDirectPrompt(authority, authority.state);
      return stoppedEnvelope(
        "run",
        "direct",
        "DIRECT_VERIFICATION_LIMIT",
        `Direct verification reached its ${MAX_DIRECT_VERIFICATION_ATTEMPTS}-attempt limit.`,
        authority.state,
        stopped.actionPrompt,
      );
    }
    const verified = runDirectVerification(authority, input);
    return activeDirectPrompt(authority, verified);
  }
  if (action === "ACCEPT_DIRECT_RISK") {
    const accepted = acceptDirectRisk(authority, input);
    return activeDirectPrompt(authority, accepted);
  }
  if (action === "RETURN_TO_DIRECT_FIX") {
    const returned = returnToDirectFix(authority);
    return activeDirectPrompt(authority, returned);
  }
  if (action === "REOPEN_ABORTED_DIRECT") {
    const reopened = reopenAbortedDirect(authority, input);
    return activeDirectPrompt(authority, reopened);
  }
  if (action === "SUSPEND_DIRECT") {
    const suspended = transitionTerminal(authority, "SUSPENDED", input);
    return activeDirectPrompt(authority, suspended);
  }
  if (action === "RESUME_DIRECT") {
    const resumed = resumeDirectSession(authority);
    return activeDirectPrompt(authority, resumed);
  }
  if (action === "ABORT_DIRECT") {
    const aborted = transitionTerminal(authority, "ABORTED", input);
    return activeDirectPrompt(authority, aborted);
  }
  if (["FINALIZE_DIRECT", "FINALIZE_DIRECT_RECONCILE"].includes(action)) {
    const { finalizeDirectFlow } = await import("./direct-finalize-adapter.js");
    const verificationCommand = action === "FINALIZE_DIRECT_RECONCILE"
      ? resolveDirectVerificationCommand(authority, authority.state, input.testCommand)
      : null;
    return finalizeDirectFlow(authority, {
      reconcile: action === "FINALIZE_DIRECT_RECONCILE",
      testCommand: verificationCommand?.command || input.testCommand,
      timeoutMs: input.timeoutMs,
      runTestCommand,
      directSafetySnapshot,
    });
  }
  return Envelope.fail("run", "direct", "DIRECT_ACTION_UNKNOWN", `Unknown direct action: ${action}`);
}

export async function runDirectFlowAction(ctx, input) {
  const resolved = resolveStateFallback(ctx);
  const state = resolved.state;
  if (!state || !eligibility(resolved, state).supported) {
    return runDirectFlowActionOwned(ctx, input);
  }
  const mainRoot = resolved.mainRoot || resolved.flowManager?._mainRoot || resolved.root;
  const operation = new RepositoryFlowOperationLock({ mainRoot });
  let token;
  try {
    token = operation.acquire();
  } catch (error) {
    const prompt = operationBusyResult(state, error);
    return stoppedEnvelope(
      "run",
      "direct",
      error.code || "REPOSITORY_FLOW_OPERATION_BUSY",
      error.message,
      state,
      prompt.actionPrompt,
    );
  }
  let result;
  let primaryError = null;
  try {
    result = await runDirectFlowActionOwned({
      ...ctx,
      repositoryOperationOwnerToken: token,
    }, input);
  } catch (error) {
    primaryError = error;
  }
  let releaseError = null;
  try {
    operation.release();
  } catch (error) {
    releaseError = error;
  }
  if (primaryError && releaseError) {
    throw new AggregateError(
      [primaryError, releaseError],
      "direct Flow operation and repository lock release both failed",
      { cause: primaryError },
    );
  }
  if (primaryError) throw primaryError;
  if (releaseError) throw releaseError;
  return result;
}

export {
  activeDirectPrompt,
  combinedChangedPaths,
  directSafetySnapshot,
  eligibility,
  managedTargetContext,
  promptResult,
  runTestCommand,
  stoppedEnvelope,
};
