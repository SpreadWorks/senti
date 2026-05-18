/**
 * src/flow/lib/run-review.js
 *
 * FlowCommand: review — wraps `flow commands/review.js` for AI code quality review.
 * Runs review as a subprocess and parses its output.
 */

import { PKG_DIR } from "../../lib/cli.js";
import { runCmd } from "../../lib/process.js";
const DEFAULT_AGENT_TIMEOUT_MS = 300_000;
import { VALID_REVIEW_PHASES } from "../../lib/constants.js";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { resolveNodeFor, FLOW_DEFINITION, flattenSteps, findStepById } from "../definition.js";
import path from "path";
import fs from "fs";
import {
  ReviewFailure,
  clearReviewStopState,
  writeReviewStopState,
} from "./review-failure.js";
import {
  RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS,
} from "./test-artifacts.js";

// ---------------------------------------------------------------------------
// Review retry counter (spec 253: enforce review maxAttempts on the CLI side)
// ---------------------------------------------------------------------------

const REVIEW_NODE_ID_BY_PHASE = Object.freeze({
  "draft-questions": "review-draft-questions",
  "draft-coverage": "review-draft-coverage",
  spec: "review-spec",
  test: "review-test",
  impl: "review",
});

const REVIEW_PHASE_KEYS = Object.freeze(Object.keys(REVIEW_NODE_ID_BY_PHASE));

function persistedPhaseKey(ctxPhase) {
  return ctxPhase == null ? "impl" : ctxPhase;
}

function resolveDraftReviewPhaseKey(flowState = {}) {
  const steps = Array.isArray(flowState.steps) ? flattenSteps(flowState.steps) : [];
  const byId = new Map(steps.map((step) => [step.id, step]));
  if (byId.get("review-draft-coverage")?.status === "in_progress") return "draft-coverage";
  if (byId.get("review-draft-questions")?.status === "in_progress") return "draft-questions";
  return "draft-questions";
}

function reviewPhaseKeyForCtx(ctx, phase) {
  if (phase !== "draft") return persistedPhaseKey(phase);
  return resolveDraftReviewPhaseKey(ctx?.flowState || {});
}

/**
 * Replay a reset-aware reviewRetry counter for the given phase.
 * Only counts flow-scope entries (taskId == null) per R19.
 */
export function countReviewRetry(entries, phase) {
  if (!Array.isArray(entries)) return 0;
  let count = 0;
  for (const e of entries) {
    if (e.phase !== phase || e.counter !== "reviewRetry") continue;
    if (e.taskId != null) continue; // R19: task-scope leakage guard
    if (e.reset) count = 0;
    else count += e.delta ?? 1;
  }
  return count;
}

/**
 * Resolve review max attempts from FLOW_DEFINITION (flow scope only).
 * Throws on unknown phase — callers should catch via checkReviewRetryBelowMax.
 */
export function resolveReviewRetryMax(retryContext = {}, phase) {
  const nodeId = REVIEW_NODE_ID_BY_PHASE[phase];
  if (!nodeId) {
    const err = new Error(`unknown review phase: ${phase}`);
    err.code = "UNKNOWN_REVIEW_PHASE";
    throw err;
  }
  const flowState = retryContext.flowState || retryContext;
  const node = resolveNodeFor(FLOW_DEFINITION, nodeId);
  return node?.resolveMaxAttempts(flowState) ?? 5;
}

/**
 * Pre-check called from RunReviewCommand.execute. Returns:
 *  - null when count < max (proceed) OR currentTaskId is non-null (R15: task scope skip)
 *  - Envelope.fail(REVIEW_MAX_ATTEMPTS_EXCEEDED) when count >= max
 *  - Envelope.fail(UNKNOWN_REVIEW_PHASE) when phase is not mapped
 */
export function checkReviewRetryBelowMax(ctx, phase) {
  const flowState = ctx?.flowState || {};
  if (flowState.currentTaskId != null) return null; // R15
  const persistedPhase = reviewPhaseKeyForCtx(ctx, phase);
  let max;
  try {
    max = resolveReviewRetryMax({ flowState }, persistedPhase);
  } catch (err) {
    if (err.code === "UNKNOWN_REVIEW_PHASE") {
      return Envelope.fail("run", "review", "UNKNOWN_REVIEW_PHASE",
        [`unknown review phase: ${persistedPhase}`],
        { phase: persistedPhase });
    }
    throw err;
  }
  const count = countReviewRetry(flowState.metrics, persistedPhase);
  if (count < max) return null;
  const failure = ReviewFailure.maxAttemptsExceeded({ phase: persistedPhase, attempts: count, max });
  return Envelope.fail("run", "review", "REVIEW_MAX_ATTEMPTS_EXCEEDED",
    [
      `review retry limit exhausted: ${count}/${max} FAIL attempts recorded for phase "${persistedPhase}".`,
      "Stop the automatic retry loop and return control to the user. Use `sdd-forge flow set retry reset review <phase> --yes` to recover.",
    ],
    failure.toEnvelopeData());
}

function isImplPass(result) {
  if (!result) return false;
  if (result.result === "no-changes" || result.result === "no-proposals") return true;
  if ((result.artifacts?.proposalCount ?? -1) === 0) return true;
  return false;
}

/**
 * Post-hook helper: append a reviewRetry metric based on the result verdict.
 * No-op when phase is task-scope (R15) or unmapped phase.
 * Errors propagate to the dispatcher (R22 — do NOT swallow internally).
 */
export function updateReviewRetryCounter(ctx, result) {
  const flowState = ctx?.flowState || {};
  if (flowState.currentTaskId != null) return; // R15
  const persistedPhase = result?.artifacts?.retryPhase || reviewPhaseKeyForCtx(ctx, ctx?.phase);
  if (!REVIEW_NODE_ID_BY_PHASE[persistedPhase]) return; // unmapped phase: no-op (post-hook should not crash)
  const mgr = ctx.flowManager;
  if (!mgr) return;
  let isPass;
  if (persistedPhase === "impl") {
    isPass = isImplPass(result);
  } else {
    isPass = result?.artifacts?.verdict === "PASS"
      || result?.artifacts?.verdict === "ADVISORY";
  }
  const payload = isPass
    ? { phase: persistedPhase, counter: "reviewRetry", delta: 0, reset: true }
    : { phase: persistedPhase, counter: "reviewRetry", delta: 1 };
  mgr.appendMetric(payload, { taskId: null }); // R19: explicit flow-scope
  if (isPass && typeof mgr.mutate === "function") {
    mgr.mutate((state) => clearReviewStopState(state, persistedPhase));
  }
}

export { REVIEW_PHASE_KEYS };

// Review-applied code changes can alter file contents without changing the
// changed-file path list. When proposals are produced, this reset owner deletes
// stale downstream artifacts and sends the flow back to test-execute.
function removeReviewDownstreamArtifacts(root, state) {
  const specDir = path.dirname(path.resolve(root, state.spec));
  for (const rel of RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS) {
    const target = path.join(specDir, rel);
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
  }
}

export function resetImplEvidenceAfterReviewProposals(ctx, result) {
  if (ctx?.phase) return false;
  if ((result?.artifacts?.proposalCount ?? 0) <= 0) return false;
  removeReviewDownstreamArtifacts(ctx.root, ctx.flowState);
  ctx.flowManager.mutate((state) => {
    for (const id of ["test-execute", "test-result-review", "review", "gate-impl", "retro"]) {
      const step = findStepById(state.steps, id);
      if (!step) continue;
      step.status = "pending";
      delete step.finishedAt;
      delete step.startedAt;
    }
  });
  return true;
}

const PHASE_REVIEW_PARSERS = {
  test:  { countPattern: /gaps=(\d+)/,   countKey: "gapCount",   countWord: "gap(s)",   label: "Test review",  next: "implement",  commandId: "flow.test.review" },
  spec:  { countPattern: /proposalCount=(\d+)/, countKey: "proposalCount", countWord: "proposal(s)", label: "Spec review",  next: "gate", failNext: "spec-review-triage", commandId: "flow.spec.review.propose" },
  draft: { countPattern: /(questions|findings|issues)=(\d+)/, countKey: "issueCount", countWord: "issue(s)", label: "Draft review", next: "gate-draft", commandId: "flow.draft.review" },
};

function parsePhaseReviewOutput(res, stdout, stderr, { phase, countPattern, countKey, countWord, label, next, failNext = null }) {
  const verdictMatch = stderr.match(/verdict=(PASS|FAIL|ADVISORY)/);
  const countMatch = stderr.match(countPattern);
  const reviewPathMatch = stderr.match(/Results saved to (\S+)/);
  const retryPhaseMatch = stderr.match(/retryPhase=([a-z-]+)/);

  const verdict = verdictMatch ? verdictMatch[1] : (res.ok ? "PASS" : "FAIL");
  const count = countMatch ? parseInt(countMatch[countMatch.length - 1], 10) : null;

  const changed = [];
  if (reviewPathMatch) changed.push(reviewPathMatch[1]);

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

  return {
    result: "ok",
    changed,
    artifacts: { phase, verdict, [countKey]: count ?? 0, ...(retryPhaseMatch && { retryPhase: retryPhaseMatch[1] }) },
    next: verdict === "FAIL" ? failNext : next,
    output: stdout,
  };
}

function parseTestReviewOutput(res, stdout, stderr) {
  return parsePhaseReviewOutput(res, stdout, stderr, { phase: "test", ...PHASE_REVIEW_PARSERS.test });
}

function parseSpecReviewOutput(res, stdout, stderr) {
  return parsePhaseReviewOutput(res, stdout, stderr, { phase: "spec", ...PHASE_REVIEW_PARSERS.spec });
}

function parseProposalReviewOutput(res, stdout, stderr) {
  return parsePhaseReviewOutput(res, stdout, stderr, { phase: "draft", ...PHASE_REVIEW_PARSERS.draft });
}

export { PHASE_REVIEW_PARSERS, parseTestReviewOutput, parseSpecReviewOutput, parseProposalReviewOutput };

const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 3000;
const MAX_REVIEW_SUBPROCESS_RETRIES = 2;
const MAX_REVIEW_SUBPROCESS_RETRY_DELAY_MS = 30_000;

function normalizeReviewSubprocessRetryCount(value) {
  const parsed = Number(value ?? DEFAULT_RETRY_COUNT);
  if (!Number.isFinite(parsed)) return DEFAULT_RETRY_COUNT;
  return Math.min(MAX_REVIEW_SUBPROCESS_RETRIES, Math.max(0, Math.trunc(parsed)));
}

function normalizeReviewSubprocessRetryDelayMs(value) {
  const parsed = Number(value ?? DEFAULT_RETRY_DELAY_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_RETRY_DELAY_MS;
  return Math.min(MAX_REVIEW_SUBPROCESS_RETRY_DELAY_MS, Math.max(0, Math.trunc(parsed)));
}

/**
 * Run a command function with mechanical subprocess retry logic.
 * This does not consume the step retry budget; review verdict FAIL is handled separately.
 *
 * @param {function} cmdFn - Function that returns { ok, status, stdout, stderr, signal, killed }
 * @param {Object} [opts]
 * @param {number} [opts.retryCount=2] - Number of retries (total attempts = retryCount + 1)
 * @param {number} [opts.retryDelayMs=3000] - Delay between retries in milliseconds
 * @returns {Promise<{ ok: boolean, status: number, stdout: string, stderr: string, signal: string|null, killed: boolean }>}
 */
export async function runCmdWithRetry(cmdFn, opts = {}) {
  const retryCount = normalizeReviewSubprocessRetryCount(opts.retryCount);
  const retryDelayMs = normalizeReviewSubprocessRetryDelayMs(opts.retryDelayMs);

  let lastRes;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    lastRes = cmdFn();
    if (lastRes.ok) return lastRes;
    const failure = ReviewFailure.fromSubprocessResult({
      phase: opts.phase || "impl",
      result: lastRes,
    });

    if (attempt < retryCount) {
      if (!failure.shouldRetrySubprocess({ attempt: attempt + 1, maxAttempts: retryCount + 1 })) {
        return lastRes;
      }
      const next = attempt + 2;
      const total = retryCount + 1;
      process.stderr.write(`[review] retry ${next}/${total} after ${retryDelayMs}ms...\n`);
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  return lastRes;
}

export class RunReviewCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const phase = ctx.phase || null;

    if (phase && !VALID_REVIEW_PHASES.includes(phase)) {
      // spec 253 R8: return Envelope.fail with UNKNOWN_REVIEW_PHASE for unknown
      // CLI phase values (uniform fail-closed contract — no throw, no max-attempts
      // bypass via unknown phase).
      return Envelope.fail("run", "review", "UNKNOWN_REVIEW_PHASE",
        [`invalid phase: ${phase} (valid: ${VALID_REVIEW_PHASES.join(", ")})`],
        { phase });
    }

    // spec 253: enforce review maxAttempts (R2 R3) before any subprocess work
    const preCheck = checkReviewRetryBelowMax(ctx, phase);
    if (preCheck) return preCheck;
    const persistedPhase = reviewPhaseKeyForCtx(ctx, phase);
    if (ctx.flowManager) {
      ctx.flowManager.mutate((state) => clearReviewStopState(state, persistedPhase));
    }

    const dryRun = ctx.dryRun || false;
    const skipConfirm = ctx.skipConfirm || false;

    const scriptPath = path.join(PKG_DIR, "flow", "commands", "review.js");
    const args = [];
    if (phase) args.push("--phase", phase);
    if (dryRun) args.push("--dry-run");
    if (skipConfirm) args.push("--skip-confirm");

    const agentTimeout = ctx.config?.agent?.timeout;
    const timeoutMs = agentTimeout != null ? Number(agentTimeout) * 1000 : DEFAULT_AGENT_TIMEOUT_MS;
    const res = await runCmdWithRetry(
      () => runCmd("node", [scriptPath, ...args], { cwd: root, timeout: timeoutMs }),
      { phase: persistedPhase },
    );

    const stdout = (res.stdout || "").trim();
    const stderr = (res.stderr || "").trim();
    if (!res.ok) {
      const failure = ReviewFailure.fromSubprocessResult({ phase: persistedPhase, result: res });
      if (failure.shouldPersistStopState()) {
        if (ctx.flowManager) {
          ctx.flowManager.mutate((state) => writeReviewStopState(state, failure));
        }
        return Envelope.fail("run", "review", failure.toEnvelopeCode(),
          [`review stopped: ${failure.reason}`],
          failure.toEnvelopeData());
      }
    }

    // Route to draft review parser
    if (phase === "draft") {
      return parseProposalReviewOutput(res, stdout, stderr);
    }

    // Route to test review parser
    if (phase === "test") {
      return parseTestReviewOutput(res, stdout, stderr);
    }

    // Route to spec review parser
    if (phase === "spec") {
      return parseSpecReviewOutput(res, stdout, stderr);
    }

    if (!res.ok) {
      throw new Error(
        ["review command failed", ...(stderr ? [stderr] : []), ...(stdout ? [stdout] : [])].join("\n"),
      );
    }

    const proposalCountMatch = stderr.match(/proposalCount=(\d+)/);
    const reviewPathMatch = stderr.match(/Results saved to (\S+)/);

    const proposalCount = proposalCountMatch ? parseInt(proposalCountMatch[1], 10) : 0;
    const noChanges = /No changes detected/i.test(stdout);
    const noProposals = /No improvement proposals found/i.test(stdout) || /NO_PROPOSALS/.test(stdout);

    const changed = [];
    if (reviewPathMatch) changed.push(reviewPathMatch[1]);

    const next = noChanges || noProposals || proposalCount === 0 ? "gate-impl" : "apply";

    return {
      result: noChanges ? "no-changes" : noProposals ? "no-proposals" : "ok",
      changed,
      artifacts: { proposalCount, dryRun },
      next,
      output: stdout,
    };
  }
}

export default RunReviewCommand;
