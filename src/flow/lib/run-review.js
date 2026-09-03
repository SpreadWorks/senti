/**
 * src/flow/lib/run-review.js
 *
 * FlowCommand: review — wraps `flow commands/review.js` for AI code quality review.
 * Runs review as a subprocess and parses its output.
 */

import { PKG_DIR } from "../../lib/cli.js";
import { runCmd } from "../../lib/process.js";
import { VALID_REVIEW_PHASES } from "../../lib/constants.js";
import { AgentTimeout } from "../../lib/agent-timeout.js";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import {
  flowLeafIdsBetween,
} from "../definition.js";
import { flattenSteps } from "./step-tree.js";
import path from "path";
import fs from "fs";
import crypto from "node:crypto";
import { runGit } from "../../lib/git-helpers.js";
import { PRODUCT } from "../../lib/product.js";
import {
  REVIEW_FAILURE_MARKER_PREFIX,
  ReviewFailure,
} from "./review-failure.js";
import {
  assertAuditedBroadMode,
  resolveImplReviewScope,
  taskScopeViolationMessages,
} from "./task-scope.js";
import { normalizeDraftReviewArtifactDocument } from "./draft-review-artifacts.js";
import {
  ReviewToolingOutcome,
} from "./review-convergence.js";
import { FLOW_REVIEW_ROUTES } from "./review-route.js";
import { ReviewTargetAuthority } from "./review-target-authority.js";
import {
  CanonicalReviewPromotion,
  CanonicalReviewWorkUnit,
  canonicalReviewNodeId,
} from "./canonical-review-artifacts.js";
import {
  REVIEW_WORK_UNIT_MANIFEST_ENV,
  ReviewWorkUnit,
} from "./review-work-unit.js";
import { isCanonicalFlowState } from "./canonical-test-artifacts.js";
import { ReviewExecutionLease } from "./review-execution-lease.js";
import { resolveCurrentReviewTransition } from "./review-transition-persistence.js";
import {
  CurrentTaskSourceSnapshot,
  TaskMutationLineageSet,
  TaskReviewRepairManifest,
} from "./task-mutation-lineage.js";
import {
  SourceMutationBaseline,
  SourceMutationManifest,
} from "./worker-artifact-handoff.js";
import { CanonicalTaskContext } from "./task-canonical-context.js";

const IMPL_REVIEW_PHASE = "impl";
const REVIEW_VERDICT_VALUES = Object.freeze(["PASS", "ADVISORY", "REJECTED"]);
const REVIEW_VERDICT_PATTERN = new RegExp(`verdict=(${REVIEW_VERDICT_VALUES.join("|")})`);
const REVIEW_TOOLING_OUTCOME_PATTERN = /outcome=TOOLING_ERROR/;
const MAX_IMPL_DOWNSTREAM_RESET_STEPS = 20;
// Review proposals invalidate all implementation leaves from fresh test
// execution through finalize cleanup; both endpoints are intentionally reset.
const IMPL_REVIEW_DOWNSTREAM_STEP_IDS = flowLeafIdsBetween("test-execute", "finalize-cleanup");
if (IMPL_REVIEW_DOWNSTREAM_STEP_IDS.length > MAX_IMPL_DOWNSTREAM_RESET_STEPS) {
  throw new Error(`impl downstream reset leaf count exceeds max ${MAX_IMPL_DOWNSTREAM_RESET_STEPS}`);
}

// Review execution phase metadata. Retry authority lives in definition.js.

const REVIEW_NODE_ID_BY_PHASE = Object.freeze(Object.fromEntries(
  FLOW_REVIEW_ROUTES.map((route) => [route.phase, route.reviewStepId]),
));

const REVIEW_PHASE_KEYS = Object.freeze(Object.keys(REVIEW_NODE_ID_BY_PHASE));

function persistedPhaseKey(ctxPhase) {
  return ctxPhase == null ? IMPL_REVIEW_PHASE : ctxPhase;
}

function isImplementationReviewPhase(phase) {
  return phase == null || phase === IMPL_REVIEW_PHASE;
}

function taskCursorRequiredReviewFailure(decision, state) {
  return Envelope.fail(
    "run",
    "review",
    "TASK_CURSOR_REQUIRED",
    taskScopeViolationMessages(decision, "impl-review"),
    { currentTaskId: state?.currentTaskId ?? null },
  );
}

function invalidReviewScopeFailure(decision, state) {
  return Envelope.fail(
    "run",
    "review",
    "REVIEW_SCOPE_INVALID",
    [`implementation review scope is invalid: ${decision.reason}`],
    {
      currentTaskId: state?.currentTaskId ?? null,
      reason: decision.reason,
    },
  );
}

function resolveDraftReviewPhaseKey(flowState = {}) {
  const steps = Array.isArray(flowState.steps) ? flattenSteps(flowState.steps) : [];
  const byId = new Map(steps.map((step) => [step.id, step]));
  if (byId.get("draft-coverage-review")?.status === "in_progress") return "draft-coverage";
  if (byId.get("draft-questions-review")?.status === "in_progress") return "draft-questions";
  return "draft-questions";
}

function reviewPhaseKeyForCtx(ctx, phase) {
  if (phase !== "draft") return persistedPhaseKey(phase);
  return resolveDraftReviewPhaseKey(ctx?.flowState || {});
}

export { REVIEW_PHASE_KEYS };

const PHASE_REVIEW_PARSERS = {
  test:  { countPattern: /blocking=(\d+)/,   countKey: "blockingCount",   countWord: "blocking finding(s)",   label: "Test review", commandId: "flow.test.review" },
  spec:  { countPattern: /proposalCount=(\d+)/, countKey: "proposalCount", countWord: "proposal(s)", label: "Spec review", commandId: "flow.spec.review.propose" },
  draft: { countPattern: /(questions|findings|issues)=(\d+)/, countKey: "issueCount", countWord: "issue(s)", label: "Draft review", commandId: "flow.draft.review" },
};

function parseToolingOutcome(stderr) {
  if (!REVIEW_TOOLING_OUTCOME_PATTERN.test(stderr)) return null;
  const stage = stderr.match(/stage=([a-z_]+)/)?.[1] || "communication";
  const attempt = Number(stderr.match(/attempt=(\d+)/)?.[1] || 1);
  const maxAttempts = Number(stderr.match(/maxAttempts=(\d+)/)?.[1] || 1);
  const toolingKind = stderr.match(/toolingKind=([a-z_]+)/)?.[1] || `${stage}_error`;
  return new ReviewToolingOutcome({
    stage,
    attempt,
    maxAttempts,
    reason: toolingKind,
    permissionRelated: /permission|EACCES|EPERM|sandbox/i.test(stderr),
  });
}

function parsePhaseReviewOutput(res, stdout, stderr, { phase, countPattern, countKey, countWord, label }) {
  const verdictMatch = stderr.match(REVIEW_VERDICT_PATTERN);
  const toolingOutcome = parseToolingOutcome(stderr);
  const countMatch = stderr.match(countPattern);
  const reviewPathMatch = stderr.match(/Results saved to (\S+)/);
  const jsonPathMatch = stderr.match(/JSON saved to (\S+)/);
  const retryPhaseMatch = stderr.match(/retryPhase=([a-z-]+)/);
  const retryPhase = retryPhaseMatch ? retryPhaseMatch[1] : null;

  const verdict = verdictMatch ? verdictMatch[1] : (res.ok ? "PASS" : "REJECTED");
  const count = countMatch ? parseInt(countMatch[countMatch.length - 1], 10) : null;

  const changed = [];
  if (reviewPathMatch) changed.push(reviewPathMatch[1]);
  if (jsonPathMatch) changed.push(jsonPathMatch[1]);

  if (toolingOutcome) {
    const artifacts = { phase, toolingOutcome: toolingOutcome.toJSON(), [countKey]: count ?? 0 };
    if (retryPhase) artifacts.retryPhase = retryPhase;
    return {
      result: "tooling-error",
      changed,
      artifacts,
      output: stdout,
    };
  }

  if (!res.ok) {
    const detail = count === 0
      ? `${label} subprocess error (0 ${countWord} reported but process exited with error)`
      : count !== null
        ? `${label} FAIL: ${count} ${countWord} remaining`
        : `${label} failed (subprocess error)`;
    throw new Error(
      [detail, ...(stderr ? [stderr] : []), ...(stdout ? [stdout] : [])].join("\n"),
    );
  }

  const artifacts = { phase, verdict, [countKey]: count ?? 0 };
  if (retryPhase) artifacts.retryPhase = retryPhase;

  return {
    result: "ok",
    changed,
    artifacts,
    output: stdout,
  };
}

function parseTestReviewOutput(res, stdout, stderr) {
  const parsed = parsePhaseReviewOutput(res, stdout, stderr, { phase: "test", ...PHASE_REVIEW_PARSERS.test });
  const advisoryMatch = stderr.match(/advisory=(\d+)/);
  if (advisoryMatch) parsed.artifacts.advisoryCount = parseInt(advisoryMatch[1], 10);
  return parsed;
}

function parseSpecReviewOutput(res, stdout, stderr) {
  return parsePhaseReviewOutput(res, stdout, stderr, { phase: "spec", ...PHASE_REVIEW_PARSERS.spec });
}

function parseProposalReviewOutput(res, stdout, stderr) {
  return parsePhaseReviewOutput(res, stdout, stderr, { phase: "draft", ...PHASE_REVIEW_PARSERS.draft });
}

function parseImplReviewOutput(res, stdout, stderr, opts = {}) {
  const verdictMatch = stderr.match(REVIEW_VERDICT_PATTERN);
  const toolingOutcome = parseToolingOutcome(stderr);
  const blockingMatch = stderr.match(/blocking=(\d+)/);
  const nonBlockingMatch = stderr.match(/nonBlocking=(\d+)/);
  const reviewPathMatch = stderr.match(/Results saved to (\S+)/);
  const jsonPathMatch = stderr.match(/JSON saved to (\S+)/);
  const taskIdMatch = stderr.match(/taskId=(\S+)/);
  const targetMatch = stderr.match(/target=(\S+)/);

  const changed = [];
  if (reviewPathMatch) changed.push(reviewPathMatch[1]);
  if (jsonPathMatch) changed.push(jsonPathMatch[1]);

  if (toolingOutcome) {
    return {
      result: "tooling-error",
      changed,
      artifacts: {
        phase: "impl",
        toolingOutcome: toolingOutcome.toJSON(),
        blockingCount: 0,
        nonBlockingCount: 0,
      },
      output: stdout,
    };
  }

  if (!res.ok) {
    throw new Error(
      ["Impl review failed", ...(stderr ? [stderr] : []), ...(stdout ? [stdout] : [])].join("\n"),
    );
  }

  let artifactData = null;
  if (opts.root && jsonPathMatch) {
    const artifactPath = path.resolve(opts.root, jsonPathMatch[1]);
    try {
      artifactData = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    } catch (err) {
      throw new Error(`failed to read impl-review.json artifact: ${err.message}`);
    }
  }

  const verdict = artifactData?.verdict || (verdictMatch ? verdictMatch[1] : "PASS");
  const blockingCount = artifactData?.summary?.blocking ?? (blockingMatch ? parseInt(blockingMatch[1], 10) : 0);
  const nonBlockingCount = artifactData?.summary?.nonBlocking ?? (nonBlockingMatch ? parseInt(nonBlockingMatch[1], 10) : 0);

  const artifacts = {
    phase: "impl",
    verdict,
    blockingCount,
    nonBlockingCount,
  };
  if (taskIdMatch) artifacts.taskId = taskIdMatch[1];
  if (targetMatch) artifacts.target = targetMatch[1];

  return {
    result: "ok",
    changed,
    artifacts,
    output: stdout,
  };
}

function normalizeImplReviewSubprocessResult(result = {}) {
  const verdict = result.verdict || "PASS";
  return {
    verdict,
    failureKind: result.failureKind || null,
    retryable: result.retryable ?? null,
    reviewRetryConsumed: false,
    artifacts: result.artifacts || [],
    message: result.message || "",
  };
}

export { PHASE_REVIEW_PARSERS, parseTestReviewOutput, parseSpecReviewOutput, parseProposalReviewOutput, parseImplReviewOutput, normalizeImplReviewSubprocessResult };

export function appendIssueLogFromTestReviewToolingFailure(ctx, result) {
  void ctx;
  void result;
}

const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 3000;
const MAX_REVIEW_SUBPROCESS_RETRIES = 2;
const MAX_REVIEW_SUBPROCESS_RETRY_DELAY_MS = 30_000;

export function normalizeReviewSubprocessRetryCount(value) {
  const parsed = Number(value ?? DEFAULT_RETRY_COUNT);
  if (!Number.isFinite(parsed)) return DEFAULT_RETRY_COUNT;
  return Math.min(MAX_REVIEW_SUBPROCESS_RETRIES, Math.max(0, Math.trunc(parsed)));
}

export function normalizeReviewSubprocessRetryDelayMs(value) {
  const parsed = Number(value ?? DEFAULT_RETRY_DELAY_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_RETRY_DELAY_MS;
  return Math.min(MAX_REVIEW_SUBPROCESS_RETRY_DELAY_MS, Math.max(0, Math.trunc(parsed)));
}

/**
 * Run a command function with mechanical subprocess retry logic.
 * This does not consume the step retry budget; review verdict REJECTED is handled separately.
 *
 * @param {function} cmdFn - Function that returns { ok, status, stdout, stderr, signal, killed }
 * @param {Object} [opts]
 * @param {number} [opts.retryCount=2] - Number of retries for ordinary subprocess failures (schema failures are capped at two total attempts)
 * @param {number} [opts.retryDelayMs=3000] - Delay between retries in milliseconds
 * @returns {Promise<{ ok: boolean, status: number, stdout: string, stderr: string, signal: string|null, killed: boolean }>}
 */
export async function runCmdWithRetry(cmdFn, opts = {}) {
  const retryCount = normalizeReviewSubprocessRetryCount(opts.retryCount);
  const retryDelayMs = normalizeReviewSubprocessRetryDelayMs(opts.retryDelayMs);

  let lastRes;
  for (let attempt = 0; ; attempt++) {
    lastRes = cmdFn();
    if (lastRes.ok) return lastRes;
    const failure = ReviewFailure.fromSubprocessResult({
      phase: opts.phase || "impl",
      result: lastRes,
    });
    const maximumAttempts = failure.classification === "schema_failure"
      ? 2
      : retryCount + 1;
    const failureForAttempt = failure.withAttempts({
      currentAttempt: attempt + 1,
      maximumAttempts,
    });
    if (failureForAttempt !== failure) {
      const marker = failureForAttempt.toMarkerLine();
      const lines = String(lastRes.stderr || "").split(/\r?\n/);
      const markerIndex = lines.findIndex((line) => line.trim().startsWith(REVIEW_FAILURE_MARKER_PREFIX));
      if (markerIndex >= 0) lines[markerIndex] = marker;
      else lines.unshift(marker);
      lastRes = { ...lastRes, stderr: lines.join("\n") };
    }

    if (attempt + 1 >= maximumAttempts || !failureForAttempt.shouldRetrySubprocess({
      attempt: attempt + 1,
      maxAttempts: maximumAttempts,
    })) {
      return lastRes;
    }
    const next = attempt + 2;
    process.stderr.write(`[review] retry ${next}/${maximumAttempts} after ${retryDelayMs}ms...\n`);
    await new Promise((r) => setTimeout(r, retryDelayMs));
  }
}

const DRAFT_REPAIR_TARGET_PHASES = new Set(["draft-questions", "draft-coverage"]);

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalFindingFallbackId(phase, bucket, index) {
  return `${phase}-${bucket}-${String(index + 1).padStart(3, "0")}`;
}

class CanonicalReviewFindingRegistry {
  constructor() {
    this.findingIds = new Map();
    this.fingerprints = new Map();
  }

  uniqueFindingId(candidate, fallback, identity) {
    if (!this.findingIds.has(candidate) || this.findingIds.get(candidate) === identity) {
      return candidate;
    }
    let suffix = 1;
    let normalized = fallback;
    while (this.findingIds.has(normalized)) {
      suffix += 1;
      normalized = `${fallback}-${suffix}`;
    }
    return normalized;
  }

  uniqueFingerprint(candidate, identity) {
    if (!this.fingerprints.has(candidate) || this.fingerprints.get(candidate) === identity) {
      return candidate;
    }
    let suffix = 1;
    let normalized = sha256Hex(`${identity}:${suffix}`);
    while (this.fingerprints.has(normalized)) {
      suffix += 1;
      normalized = sha256Hex(`${identity}:${suffix}`);
    }
    return normalized;
  }

  register(input, { phase, bucket, index }) {
    const identity = stableStringify(input);
    const fallbackFindingId = canonicalFindingFallbackId(phase, bucket, index);
    const requestedFindingId = String(
      input.findingId || input.id || input.proposalId || input.findingKey || fallbackFindingId,
    ).trim();
    const requestedFingerprint = typeof input.fingerprint === "string" && /^[a-f0-9]{64}$/.test(input.fingerprint)
      ? input.fingerprint
      : sha256Hex(identity);
    const findingId = this.uniqueFindingId(requestedFindingId, fallbackFindingId, identity);
    const fingerprint = this.uniqueFingerprint(requestedFingerprint, identity);
    this.findingIds.set(findingId, identity);
    this.fingerprints.set(fingerprint, identity);
    return { findingId, fingerprint };
  }
}

function canonicalFinding(input, artifactName, { findingId, fingerprint }) {
  const summary = String(
    input.summary || input.title || input.issue || input.improvement || input.rationale || "Review finding.",
  ).trim();
  return {
    findingId,
    summary,
    fingerprint,
    evidenceRefs: [`${artifactName}#${findingId}`],
    ...(input.disposition == null ? {} : { disposition: input.disposition }),
  };
}

export function reviewArtifactFindingLists(artifact, phase) {
  const blocking = [
    artifact.blockingFindings,
    artifact.blocking,
    artifact.findings,
    artifact.comments,
    artifact.proposals,
    artifact.questions,
    artifact.issues,
  ].find(Array.isArray) || [];
  const advisory = [
    artifact.advisoryFindings,
    artifact.nonBlockingImprovements,
    artifact.improvements,
  ].find(Array.isArray) || [];
  const repairTargets = DRAFT_REPAIR_TARGET_PHASES.has(phase) && Array.isArray(artifact.repairTargets)
    ? artifact.repairTargets
    : [];
  return { blocking, advisory: [...advisory, ...repairTargets] };
}

function canonicalFindingList(findings, { phase, bucket, artifactName, registry }) {
  return findings.map((finding, index) => canonicalFinding(
    finding,
    artifactName,
    registry.register(finding, { phase, bucket, index }),
  ));
}

export function canonicalReviewArtifactFindings(artifact, phase, artifactName) {
  const { blocking, advisory } = reviewArtifactFindingLists(artifact, phase);
  const registry = new CanonicalReviewFindingRegistry();
  return {
    blockingFindings: canonicalFindingList(blocking, {
      phase,
      bucket: "blocking",
      artifactName,
      registry,
    }),
    advisoryFindings: canonicalFindingList(advisory, {
      phase,
      bucket: "advisory",
      artifactName,
      registry,
    }),
  };
}

function resolveCurrentReviewTreeSha(ctx) {
  return ReviewTargetAuthority.fromContext(ctx).resolveTreeSha();
}

function resolveCurrentReviewTargetState(ctx, phase = reviewPhaseKeyForCtx(ctx, ctx?.phase || null)) {
  return ReviewTargetAuthority.fromContext(ctx).captureTargetStateForPhase(phase);
}

function resolveCurrentReviewRepairFingerprint(
  ctx,
  phase = reviewPhaseKeyForCtx(ctx, ctx?.phase || null),
) {
  return resolveCurrentReviewTargetState(ctx, phase).digest;
}

/** Definition-owned admission: this command may execute only when no other Review transition is selected. */
function reviewExecutionAdmission(ctx, { persistedPhase, executionRoot }) {
  const specId = ctx.specId ?? ctx.flowState.specId;
  const flowState = ctx.flowManager.loadReadOnly(specId);
  const currentState = ctx.flowManager.canonicalState(specId);
  const currentTaskId = persistedPhase === IMPL_REVIEW_PHASE
    ? flowState.currentTaskId ?? null
    : null;
  if (currentTaskId !== null) {
    try {
      CanonicalTaskContext.capture({
        root: executionRoot,
        flowManager: ctx.flowManager,
        state: flowState,
        taskId: currentTaskId,
      });
    } catch (error) {
      return Envelope.fail(
        "run",
        "review",
        "TASK_CONTEXT_INVALID",
        `canonical Task context is invalid: ${error.message}`,
        { taskId: currentTaskId },
      );
    }
  }
  const scope = currentTaskId === null ? "flow" : "task";
  const stepId = scope === "task"
    ? "task-review"
    : canonicalReviewNodeId({ phase: persistedPhase, taskId: currentTaskId });
  const selection = resolveCurrentReviewTransition({
    flowManager: ctx.flowManager,
    flowState,
    typedState: currentState,
    scope,
    stepId,
  });
  if (selection.disposition === null) return null;
  return Envelope.fail(
    "run",
    "review",
    "REVIEW_DEFINITION_ACTION_REQUIRED",
    "the definition selected a non-review transition for the current canonical evidence; refresh next-action and follow it before starting another Review worker",
    {
      phase: persistedPhase,
      operation: selection.disposition.operation,
      nextActionRequired: true,
      reviewDisposition: selection.disposition.toJSON(),
    },
  );
}

function currentTaskReviewAttemptCount(state, taskId, lineageSet) {
  const task = state.findNode(taskId);
  const step = task?.steps?.find((candidate) => candidate.id === `${taskId}-review`) ?? null;
  const budget = lineageSet.currentBudget;
  const attempts = step?.attemptSequence - budget?.reviewAttemptSequenceAtStart;
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 4) {
    throw new Error("Task Review Attempt is outside its current execution round");
  }
  return attempts;
}

function taskReviewTransientDirectories(executionRoot, workUnit) {
  const reviewDirectory = path.relative(executionRoot, workUnit.workUnit.directory).split(path.sep).join("/");
  if (reviewDirectory === "" || reviewDirectory.startsWith("../") || path.posix.isAbsolute(reviewDirectory)) {
    throw new Error("Task Review work unit is outside its execution checkout");
  }
  const directories = [reviewDirectory];
  const versionDirectory = path.relative(
    executionRoot,
    workUnit.flowManager.specLocation(workUnit.state.specId).directory,
  ).split(path.sep).join("/");
  if (versionDirectory !== "" && !versionDirectory.startsWith("../") && !path.posix.isAbsolute(versionDirectory)) {
    directories.push(versionDirectory);
  }
  return directories;
}

export class RunReviewCommand extends FlowCommand {
  constructor({
    resolveScope = resolveImplReviewScope,
    resolveTreeSha = resolveCurrentReviewTreeSha,
    resolveTargetStateDigest = resolveCurrentReviewRepairFingerprint,
    runCommand = runCmd,
  } = {}) {
    super();
    this.resolveScope = resolveScope;
    this.resolveTreeSha = resolveTreeSha;
    this.resolveTargetStateDigest = resolveTargetStateDigest;
    this.runCommand = runCommand;
  }

  /**
   * Version-1 review execution has a deliberately narrow boundary: the
   * established child command writes only a transient work unit, then this
   * parent returns a Store-attached result.  Registry lifecycle confirmation
   * commits the result history, immutable evidence, Activity, and state in
   * one journaled operation.
   */
  async executeCanonical(ctx, { phase, dryRun, executionRoot, admissionChecked = false }) {
    const persistedPhase = reviewPhaseKeyForCtx(ctx, phase);
    const state = ctx.flowManager.canonicalState(ctx.specId ?? ctx.flowState.specId);
    if (state === null) {
      throw new Error("canonical review requires a loaded Version-1 Flow");
    }
    const currentNodeId = state.current?.at(-1) ?? null;
    const taskId = persistedPhase === IMPL_REVIEW_PHASE
      ? ctx.flowState.currentTaskId ?? null
      : null;
    const expectedNodeId = canonicalReviewNodeId({ phase: persistedPhase, taskId });
    if (currentNodeId !== expectedNodeId) {
      throw new Error(`canonical review requires active ${expectedNodeId}, found ${currentNodeId ?? "none"}`);
    }
    if (state.attempt?.failure !== null && state.attempt?.failure !== undefined) {
      const disposition = state.failureDisposition();
      return Envelope.fail(
        "run",
        "review",
        "REVIEW_RETRY_REQUIRED",
        "the current review Attempt has failed; refresh next-action and follow its definition-owned retry or recovery route",
        {
          phase: persistedPhase,
          operation: disposition?.operation ?? "blocked",
          retryKind: disposition?.retryKind ?? null,
          remaining: disposition?.remaining ?? 0,
          nextActionRequired: true,
          failureDisposition: disposition?.toJSON?.() ?? null,
        },
      );
    }
    if (!admissionChecked) {
      const admissionFailure = reviewExecutionAdmission(ctx, { persistedPhase, executionRoot });
      if (admissionFailure !== null) return admissionFailure;
    }
    if (dryRun) {
      return Envelope.fail(
        "run",
        "review",
        "CANONICAL_REVIEW_DRY_RUN_REQUIRES_PREVIEW_BOUNDARY",
        "Version-1 review dry-run does not create a durable Attempt or worker work unit.",
      );
    }

    const treeSha = this.resolveTreeSha(ctx);
    const targetStateDigest = this.resolveTargetStateDigest(ctx, persistedPhase);
    const workUnit = new CanonicalReviewWorkUnit({
      flowManager: ctx.flowManager,
      state: ctx.flowState,
      phase: persistedPhase,
      taskId,
      executionRoot,
      treeSha,
      targetStateDigest,
    });
    let taskRepairBaseline = null;
    let sealedWorkUnit;
    try {
      // Reconstruct the parent-owned input contract before inspecting any
      // worker state. A recovered manifest must match this exact declaration.
      workUnit.declareCanonicalInputs();
      sealedWorkUnit = workUnit.workUnit.recoverSealed();
    } catch (error) {
      return this.#canonicalFailure(ctx, persistedPhase, error);
    }
    if (sealedWorkUnit === null) {
      const prepared = workUnit.prepare();
      const specSource = workUnit.materializeSpecRecord();
      const specReviewInput = workUnit.materializeSpecReview();
      const fileMapSource = workUnit.materializeFileMap();
      const draftSource = workUnit.materializeDraft();
      const testSources = workUnit.materializeTestSources(prepared.directory);
      const taskSpec = workUnit.materializeTaskSpec();
      const taskInputs = workUnit.materializeTaskContextAndSource();
      const surface = workUnit.finalize();
      if (taskId !== null) {
        taskRepairBaseline = SourceMutationBaseline.capture({
          root: executionRoot,
          attempt: state.attempt,
          ignoredDirectories: taskReviewTransientDirectories(executionRoot, workUnit),
        });
      }
      const scriptPath = path.join(PKG_DIR, "flow", "commands", "review.js");
      const args = [];
      if (phase && phase !== IMPL_REVIEW_PHASE) args.push("--phase", phase);
      if (taskSpec !== null) args.push("--task-spec", taskSpec.logicalPath);
      if (ctx.skipConfirm) args.push("--skip-confirm");
      // The worker's Agent owns a provider process tree.  Leave it enough
      // time to terminate that tree before this outer subprocess timeout can
      // kill the worker and release its review-execution lease prematurely.
      const timeoutMs = AgentTimeout.fromConfig(ctx.config?.agent).toOuterProcessMilliseconds();
      const env = {
        ...process.env,
        [PRODUCT.env("REVIEW_OUTPUT_DIR")]: surface.directory,
        [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath,
        [PRODUCT.env("REVIEW_SPEC_SOURCE")]: JSON.stringify(specSource),
        ...(specReviewInput === null ? {} : {
          [PRODUCT.env("REVIEW_SPEC_REVIEW_SOURCE")]: JSON.stringify(specReviewInput.toJSON()),
        }),
        ...(fileMapSource === null ? {} : {
          [PRODUCT.env("REVIEW_FILE_MAP_SOURCE")]: JSON.stringify(fileMapSource),
        }),
        ...(draftSource === null ? {} : {
          [PRODUCT.env("REVIEW_DRAFT_SOURCE")]: JSON.stringify(draftSource),
        }),
        ...(testSources === null ? {} : {
          [PRODUCT.env("REVIEW_TEST_SOURCE_DIR")]: testSources.directory,
          [PRODUCT.env("REVIEW_TEST_ARTIFACT_REVISION")]: JSON.stringify(testSources.revision),
          [PRODUCT.env("REVIEW_TEST_TOPOLOGY")]: JSON.stringify(testSources.topology),
        }),
        ...(taskSpec === null ? {} : {
          [PRODUCT.env("REVIEW_TASK_SPEC_SOURCE")]: JSON.stringify({
            logicalPath: taskSpec.logicalPath,
            sourcePath: taskSpec.sourcePath,
          }),
          [PRODUCT.env("REVIEW_TASK_CONTEXT_SOURCE")]: JSON.stringify(taskInputs.context),
          [PRODUCT.env("REVIEW_TASK_CURRENT_SOURCE")]: JSON.stringify(taskInputs.source),
        }),
      };

      let res;
      try {
        res = await runCmdWithRetry(
          () => this.runCommand("node", [scriptPath, ...args], { cwd: executionRoot, timeout: timeoutMs, env }),
          { phase: persistedPhase, retryCount: 0 },
        );
      } catch (error) {
        return this.#canonicalFailure(ctx, persistedPhase, error);
      }
      if (!res.ok) {
        const reason = [res.stderr, res.stdout].filter(Boolean).join("\n") || "review subprocess failed";
        return this.#canonicalFailure(ctx, persistedPhase, new Error(reason));
      }
      try {
        sealedWorkUnit = ReviewWorkUnit.fromEnvironment(
          { [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath },
          { expectedManifest: surface.manifest, expectedDirectory: surface.directory },
        );
        sealedWorkUnit.readSealedOutput();
      } catch (error) {
        return this.#canonicalFailure(ctx, persistedPhase, error);
      }
    }
    if (taskId !== null && taskRepairBaseline === null) {
      taskRepairBaseline = SourceMutationBaseline.capture({
        root: executionRoot,
        attempt: state.attempt,
        ignoredDirectories: taskReviewTransientDirectories(executionRoot, workUnit),
      });
    }
    let promotion;
    let taskRepair = null;
    let taskMutationLineage = null;
    let resultingTaskLineageSet = null;
    let resultingTaskSource = workUnit.taskSource;
    try {
      promotion = new CanonicalReviewPromotion({
        workUnit: sealedWorkUnit,
        phase: persistedPhase,
        taskId,
        treeSha,
        targetStateDigest,
        specReviewSource: workUnit.specReviewSource,
        taskSource: workUnit.taskSource,
      });
      if (taskId !== null) {
        const lineageSet = new TaskMutationLineageSet({
          runId: state.runId,
          specId: state.specId,
          taskId,
          lineages: ctx.flowManager.taskMutationLineages({ specId: state.specId, taskId }),
        });
        const manifest = SourceMutationManifest.capture({ baseline: taskRepairBaseline });
        taskRepair = new TaskReviewRepairManifest({
          lineageSet,
          baseline: taskRepairBaseline,
          manifest,
          artifact: promotion.sealedArtifact().artifact,
          attemptCount: currentTaskReviewAttemptCount(state, taskId, lineageSet),
        });
        taskMutationLineage = taskRepair.lineage({ attempt: state.attempt });
        resultingTaskLineageSet = new TaskMutationLineageSet({
          runId: state.runId,
          specId: state.specId,
          taskId,
          lineages: [...lineageSet.lineages, taskMutationLineage],
        });
        resultingTaskSource = CurrentTaskSourceSnapshot.capture({
          root: executionRoot,
          lineageSet: resultingTaskLineageSet,
        });
      }
    } catch (error) {
      return this.#canonicalFailure(ctx, persistedPhase, error);
    }
    const currentTreeSha = this.resolveTreeSha(ctx);
    const currentTargetStateDigest = this.resolveTargetStateDigest(ctx, persistedPhase);
    const currentTaskSource = resultingTaskLineageSet === null
      ? workUnit.captureCurrentTaskSource()
      : CurrentTaskSourceSnapshot.capture({ root: executionRoot, lineageSet: resultingTaskLineageSet });
    const acceptedTaskRepair = taskRepair !== null && taskRepair.mutationCount > 0;
    const expectedTaskSource = taskId === null ? workUnit.taskSource : resultingTaskSource;
    const staleTaskSource = currentTaskSource !== null
      && currentTaskSource.fingerprint !== expectedTaskSource?.fingerprint;
    if ((!acceptedTaskRepair && currentTreeSha !== treeSha)
      || (!acceptedTaskRepair && currentTargetStateDigest !== targetStateDigest)
      || staleTaskSource) {
      return Envelope.fail(
        "run",
        "review",
        "STALE_REVIEW_TARGET",
        "the review target tree changed before canonical evidence promotion",
        {
          expectedTreeSha: treeSha,
          currentTreeSha,
          expectedTargetStateDigest: targetStateDigest,
          currentTargetStateDigest,
          expectedTaskSourceFingerprint: expectedTaskSource?.fingerprint ?? null,
          currentTaskSourceFingerprint: currentTaskSource?.fingerprint ?? null,
        },
      );
    }

    try {
      promotion = new CanonicalReviewPromotion({
        workUnit: sealedWorkUnit,
        phase: persistedPhase,
        taskId,
        treeSha,
        targetStateDigest,
        specReviewSource: workUnit.specReviewSource,
        taskSource: resultingTaskSource,
        taskMutationLineage,
        reviewRepairComplete: taskRepair?.complete ?? false,
      });
      const result = promotion.resultFromSealedArtifact();
      promotion.promote(result);
      return result;
    } catch (error) {
      return this.#canonicalFailure(ctx, persistedPhase, error);
    }
  }

  #canonicalFailure(ctx, phase, error) {
    const message = String(error?.message || error);
    try {
      ctx.flowManager.failCurrentAttempt({
        specId: ctx.specId ?? ctx.flowState.specId,
        failure: {
          category: "tooling",
          code: "REVIEW_EXECUTION_FAILED",
          message,
          retryable: true,
          retryKind: "tooling",
        },
        result: {
          outcome: "failed",
          summary: message,
          confirmedAt: new Date().toISOString(),
          artifactRefs: [],
        },
      });
    } catch (failureError) {
      return Envelope.fail(
        "run",
        "review",
        "REVIEW_FAILURE_RECORDING_FAILED",
        `${message}; unable to record the canonical Attempt failure: ${failureError.message}`,
      );
    }
    return Envelope.fail(
      "run",
      "review",
      "REVIEW_TOOLING_ERROR",
      `review tooling error for ${phase}: ${message}`,
    );
  }

  async execute(ctx) {
    const { root } = ctx;
    const executionRoot = ctx.executionRoot || root;
    const phase = ctx.phase || null;
    const dryRun = ctx.dryRun === true;

    if (phase && !VALID_REVIEW_PHASES.includes(phase)) {
      // spec 253 R8: return Envelope.fail with UNKNOWN_REVIEW_PHASE for unknown
      // CLI phase values (uniform fail-closed contract — no throw, no max-attempts
      // bypass via unknown phase).
      return Envelope.fail("run", "review", "UNKNOWN_REVIEW_PHASE",
        [`invalid phase: ${phase} (valid: ${VALID_REVIEW_PHASES.join(", ")})`],
        { phase });
    }

    if (!isCanonicalFlowState(ctx.flowState)) {
      return Envelope.fail(
        "run",
        "review",
        "CANONICAL_REVIEW_REQUIRED",
        "review execution requires a Version-1 Flow Activity and catalog authority.",
      );
    }
    const persistedPhase = reviewPhaseKeyForCtx(ctx, phase);
    const state = ctx.flowManager.canonicalState(ctx.specId ?? ctx.flowState.specId);
    const taskId = persistedPhase === IMPL_REVIEW_PHASE ? ctx.flowState.currentTaskId ?? null : null;
    const expectedNodeId = canonicalReviewNodeId({ phase: persistedPhase, taskId });
    if (state?.current?.at(-1) !== expectedNodeId || state.attempt === null) {
      // executeCanonical returns the detailed canonical target error and
      // remains the single state-validation path.
      return this.executeCanonical(ctx, { phase, dryRun, executionRoot });
    }
    if (state.attempt.failure !== null) {
      return this.executeCanonical(ctx, { phase, dryRun, executionRoot });
    }
    const admissionFailure = reviewExecutionAdmission(ctx, { persistedPhase, executionRoot });
    if (admissionFailure !== null) return admissionFailure;
    const lease = new ReviewExecutionLease({
      mainRoot: ctx.mainRoot || executionRoot,
      runId: state.runId,
      nodeId: expectedNodeId,
      attemptId: state.attempt.id,
    });
    try {
      lease.acquire();
    } catch (error) {
      return Envelope.fail(
        "run",
        "review",
        error.code || "REVIEW_EXECUTION_LOCK_FAILED",
        error.message,
      );
    }
    try {
      return await this.executeCanonical(ctx, { phase, dryRun, executionRoot, admissionChecked: true });
    } finally {
      lease.release();
    }

  }
}

export default RunReviewCommand;
