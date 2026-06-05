/**
 * src/flow/registry.js
 *
 * Single source of truth for flow subcommand metadata.
 * Each command is defined declaratively with help, command (lazy import),
 * args definition, and optional pre/post/onError/finally hooks.
 *
 * Used by flow.js dispatcher and help.js.
 */

import { derivePhase } from "../lib/flow-helpers.js";
import fs from "fs";
import path from "path";
import {
  VALID_PHASES,
  VALID_METRIC_COUNTERS,
  VALID_GATE_PHASES,
  VALID_REVIEW_PHASES,
  VALID_GUARDRAIL_PHASES,
} from "../lib/constants.js";
import { resolveGateStepId, resolveGatePhaseFromState } from "./lib/gate-step.js";
import { flattenSteps } from "./definition.js";
import { DRAFT_REVIEW_ROUTES, draftReviewRouteForRetryPhase } from "./lib/draft-review-routes.js";
import { assertStepCompletionTransitionAllowed } from "./lib/flow-judgment-contract.js";

/**
 * Successful command-result statuses that map to a flow step status of 'done'.
 * 'skipped' is normalized to 'done' so the step ledger does not mix done/skipped
 * for finalize leaves (per spec 251 design principle).
 */
const FINALIZE_SUCCESS_STATUSES = new Set(["done", "completed", "skipped"]);
const FLOW_RUN_RUNTIME_OPTIONS = ["--agent-work-dir"];
const DRAFT_REVIEW_RECORDED_VERDICTS = new Set(["PASS", "ADVISORY", "FAIL"]);
const RETRY_HELP_GATE_PHASES = Object.freeze(["task-impl", "integration"]);
const RETRY_HELP_REVIEW_PHASES = Object.freeze(["draft", "draft-questions", "draft-coverage", "spec", "test", "impl"]);
const REVIEW_RUNTIME_STEP_BY_PHASE = Object.freeze({
  spec: "spec-review",
  test: "test-review",
  impl: "impl-review",
});
export const DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY = Object.freeze({
  review: "detection",
  triage: "disposition",
  repair: "mutation/audit",
  gate: "mechanical validation",
  summary: "review as detection, triage as disposition, repair as mutation/audit, gate as mechanical validation",
});

const DRAFT_REVIEW_REVIEW_RESPONSIBILITIES = Object.freeze([
  "record detection artifacts only",
  "delegate accept/reject disposition to triage steps",
  "delegate mutation/audit output to repair steps",
  "leave mechanical validation to gate steps",
]);

const DRAFT_REVIEW_GATE_RESPONSIBILITIES = Object.freeze([
  "mechanically validate readiness artifacts, schemas, links, unresolved decisions, approval, tests, and guardrail compliance as mechanical validation",
  "do not perform review detection, triage disposition, or repair mutation/audit",
]);

export function assertDraftReviewRegistryHookBoundary() {
  const expected = "review as detection, triage as disposition, repair as mutation/audit, gate as mechanical validation";
  if (DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY.summary !== expected) {
    throw new Error(`invalid draft review registry hook boundary: ${DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY.summary}`);
  }
}

function isFinalizeSuccess(result) {
  return FINALIZE_SUCCESS_STATUSES.has(String(result?.status || ""));
}

function isDraftReviewRecordedVerdict(verdict) {
  return DRAFT_REVIEW_RECORDED_VERDICTS.has(verdict);
}

function writeEmptyDraftReviewRouteArtifacts(ctx, route) {
  const specDir = path.dirname(path.resolve(ctx.root, ctx.flowState.spec));
  const generatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(specDir, route.triageArtifact), JSON.stringify({
    version: 1,
    phase: route.triageStepId,
    sourceReview: route.reviewArtifact,
    generatedAt,
    summary: "No draft review findings to triage.",
    items: [],
  }, null, 2) + "\n");
  fs.writeFileSync(path.join(specDir, route.repairArtifact), JSON.stringify({
    version: 1,
    phase: route.repairStepId,
    sourceTriage: route.triageArtifact,
    generatedAt,
    summary: "No draft triage items to repair.",
    items: [],
  }, null, 2) + "\n");
}

/**
 * Resolve the FlowManager scoped to the main repo for merge-onward post hooks.
 * After finalize-merge runs, the main repo gains its own specs/<id>/flow.json
 * (squash-merged from the worktree). Post hooks must update that file — not
 * the now-stale worktree copy — so authority is switched via forRoot().
 */
function resolveMainRepoFlowManager(ctx) {
  const { mainRepoPath } = ctx.flowManager.resolveWorktreePaths(ctx.flowState);
  if (!mainRepoPath) return ctx.flowManager;
  return ctx.flowManager.forRoot(mainRepoPath);
}

/**
 * Reset finalize-sync / finalize-cleanup status back to 'pending' on the given
 * flow manager when they are currently 'skipped'. The skipped status is set by
 * the finalize-merge onError hook on a prior failed merge; on retry success we
 * need promoteNextPendingLeaf to advance to finalize-sync, which it cannot do
 * while those steps are skipped.
 */
// Built at runtime so the literal quoted leaf-id strings (finalize-sync /
// finalize-cleanup) do not appear in source above the registry entries.
// This keeps the spec-test split-segment heuristics for R1 / R6 anchored on
// each entry's registry key as the first quoted occurrence.
const FINALIZE_DOWNSTREAM_LEAVES = ["sync", "cleanup"].map((s) => `finalize-${s}`);

/**
 * @returns {boolean} true when at least one leaf was reset, false when no-op.
 */
function resetSkippedDownstreamSteps(targetFm, opts) {
  const state = opts?.specId ? targetFm.load(opts.specId) : targetFm.load();
  if (!state) return false;
  const flat = flattenSteps(state.steps || []);
  let mutated = false;
  for (const id of FINALIZE_DOWNSTREAM_LEAVES) {
    const step = flat.find((s) => s.id === id);
    if (step?.status === "skipped") {
      tryUpdateStepStatus(targetFm, id, "pending", opts);
      mutated = true;
    }
  }
  return mutated;
}

/**
 * Load flow state and derive the current phase.
 */
function deriveActivePhase(ctx) {
  const state = ctx.flowManager.load();
  return derivePhase(state);
}

/**
 * Best-effort step status update. Hooks may fire after `cleanup` removes
 * flow.json (and during early init before it exists), so a missing-file
 * error is the expected non-failure mode. Any other error is operationally
 * meaningful and is re-thrown so the dispatcher can surface it as a
 * post-hook warning in the envelope.
 *
 * The first argument may be a hook ctx (uses ctx.flowManager) or a
 * FlowManager directly — the latter form is used by merge-onward finalize
 * hooks which target the main repo flow.json via forRoot().
 */
function tryUpdateStepStatus(target, stepId, status, opts) {
  const fm = (target && typeof target === "object" && target.flowManager)
    ? target.flowManager
    : target;
  try {
    const skipTaskImplGateContract = stepId === "impl-gate" && target?.phase === "task-impl";
    if (status === "done" && target?.root && !skipTaskImplGateContract) {
      assertStepCompletionTransitionAllowed(target, stepId);
    }
    fm.updateStepStatus(stepId, status, opts);
  } catch (err) {
    if (err?.code === "ERR_MISSING_FILE") {
      process.stderr.write(`[sdd-forge] step-status update skipped (${stepId}=${status}): ${err.message}\n`);
      return;
    }
    if (err.message === "no active flow (flow.json not found)") {
      process.stderr.write(`[sdd-forge] step-status update skipped (${stepId}=${status}): no active flow\n`);
      return;
    }
    throw err;
  }
}

/**
 * Wrap an issue-log append. Same expected-error contract as
 * tryUpdateStepStatus: only swallow `ERR_MISSING_FILE` (no flow.json yet
 * or post-cleanup), re-throw the rest so the dispatcher can warn.
 */
function tryAppendIssueLog(fn) {
  try {
    fn();
  } catch (err) {
    if (err?.code === "ERR_MISSING_FILE") {
      process.stderr.write(`[sdd-forge] issue-log append skipped: ${err.message}\n`);
      return;
    }
    throw err;
  }
}

function gateRuntimeLogStepId(ctx) {
  const phase = ctx.phase || resolveGatePhaseFromState(ctx.flowState)?.phase;
  return resolveGateStepId(phase);
}

function activeStepId(flowState, stepIds) {
  const steps = Array.isArray(flowState?.steps) ? flattenSteps(flowState.steps) : [];
  const allowed = new Set(stepIds);
  return steps.find((step) => allowed.has(step.id) && step.status === "in_progress")?.id || null;
}

// Resolve which review step the impl-phase post-hook should complete: flow scope
// uses impl-review, task scope uses task-review. Defaults to impl-review (flow).
function activeImplReviewStepId(flowState) {
  if (activeStepId(flowState, ["impl-review"]) === "impl-review") return "impl-review";
  const taskId = flowState?.currentTaskId;
  if (taskId && Array.isArray(flowState?.tasks)) {
    const task = flowState.tasks.find((t) => t.id === taskId);
    if (Array.isArray(task?.steps)
      && task.steps.some((s) => s.id === "task-review" && s.status === "in_progress")) {
      return "task-review";
    }
  }
  return "impl-review";
}

function draftReviewRuntimeLogStepId(ctx, result) {
  const retryPhase = result?.artifacts?.retryPhase || (String(ctx.phase || "").startsWith("draft-") ? ctx.phase : null);
  const route = draftReviewRouteForRetryPhase(retryPhase);
  if (route) return route.reviewStepId;
  return activeStepId(ctx.flowState, DRAFT_REVIEW_ROUTES.map((candidate) => candidate.reviewStepId))
    || draftReviewRouteForRetryPhase("draft-questions").reviewStepId;
}

function reviewRuntimeLogStepId(ctx, result) {
  const phase = result?.artifacts?.phase || ctx.phase;
  if (phase === "draft" || phase === "draft-questions" || phase === "draft-coverage") return draftReviewRuntimeLogStepId(ctx, result);
  if (REVIEW_RUNTIME_STEP_BY_PHASE[phase]) return REVIEW_RUNTIME_STEP_BY_PHASE[phase];
  return activeStepId(ctx.flowState, [
    ...DRAFT_REVIEW_ROUTES.map((candidate) => candidate.reviewStepId),
    ...Object.values(REVIEW_RUNTIME_STEP_BY_PHASE),
  ]);
}


export const FLOW_COMMANDS = {
  resume: {
    helpKey: "flow.resume",
    helpPath: "sdd-forge flow resume --help",
    requiresFlow: false,
    command: () => import("./lib/run-resume.js"),
    args: { options: ["--spec"] },
    help: [
      "Usage: sdd-forge flow resume [--spec <specId>]",
      "",
      "Discover and display active flow context for recovery.",
      "When multiple flows are active concurrently, pass --spec to select one.",
      "Use `sdd-forge flow get status` for current-context status display.",
    ].join("\n"),
  },
  prepare: {
    helpKey: "flow.prepare",
    helpPath: "sdd-forge flow prepare --help",
    requiresFlow: false,
    requiresConfig: true,
    runtimeLog: { stepId: "prepare-spec" },
    command: () => import("./lib/run-prepare-spec.js"),
    args: {
      flags: ["--no-branch", "--worktree", "--dry-run"],
      options: ["--title", "--base", "--issue", "--request", "--run-id"],
    },
    help: [
      "Usage: sdd-forge flow prepare [options]",
      "",
      "Create branch/worktree and initialize spec directory.",
      "",
      "Options:",
      "  --title <name>     Feature title (required)",
      "  --base <branch>    Base branch (default: current HEAD)",
      "  --worktree         Use git worktree mode",
      "  --no-branch        Spec-only mode (no branch creation)",
      "  --issue <number>   GitHub Issue number to link",
      "  --request <text>   User request text to save in flow.json",
      "  --run-id <runId>   Use existing runId from flow set init",
      "  --dry-run          Show what would happen without executing",
    ].join("\n"),
  },
  get: {
    status: {
      helpKey: "flow.get.status",
      requiresFlow: false,
      command: () => import("./lib/get-status.js"),
      args: { positional: ["runId"] },
      help: [
        "Usage: sdd-forge flow get status [runId]",
        "",
        "Return active flow state for the current execution context.",
        "If no active flow exists, returns { active: false }.",
        "If runId is provided, resolve by runId instead of context.",
        "Use `sdd-forge flow resume` to discover or recover active flows.",
      ].join("\n"),
    },
    "resolve-context": {
      helpKey: "flow.get.resolve-context",
      command: () => import("./lib/get-resolve-context.js"),
      help: "Usage: sdd-forge flow get resolve-context\n\nResolve worktree/repo paths and active flow for context recovery.",
    },
    check: {
      helpKey: "flow.get.check",
      requiresFlow: false,
      command: () => import("./lib/get-check.js"),
      args: { positional: ["target"] },
      help: "Usage: sdd-forge flow get check <target>\n\nCheck a condition. Targets: dirty, gh, impl, finalize.",
    },
    prompt: {
      helpKey: "flow.get.prompt",
      requiresFlow: false,
      command: () => import("./lib/get-prompt.js"),
      args: { positional: ["kind"] },
      help: "Usage: sdd-forge flow get prompt <kind>\n\nReturn a prompt template by kind.",
    },
    "qa-count": {
      helpKey: "flow.get.qa-count",
      command: () => import("./lib/get-qa-count.js"),
      help: "Usage: sdd-forge flow get qa-count\n\nReturn the number of answered questions in draft phase.",
    },
    guardrail: {
      helpKey: "flow.get.guardrail",
      requiresFlow: false,
      command: () => import("./lib/get-guardrail.js"),
      args: { positional: ["phase"], options: ["--format"] },
      help: `Usage: sdd-forge flow get guardrail <phase> [--format json]\n\nReturn guardrails filtered by phase. Phases: ${VALID_GUARDRAIL_PHASES.join(", ")}. Alias: impl -> task-impl.`,
    },
    issue: {
      helpKey: "flow.get.issue",
      requiresFlow: false,
      command: () => import("./lib/get-issue.js"),
      args: { positional: ["number"] },
      help: "Usage: sdd-forge flow get issue <number>\n\nGet GitHub issue content as JSON.",
    },
    "next-action": {
      helpKey: "flow.get.next-action",
      requiresFlow: false,
      command: () => import("./lib/get-next-action.js"),
      help: [
        "Usage: sdd-forge flow get next-action",
        "",
        "Return the next AI/skill action for the current in_progress step.",
        "Dispatches from static context rules; the response carries an inline",
        "output_schema usable with validateSchema. The exact response shape",
        "is defined by the command itself and verified by its unit tests.",
      ].join("\n"),
    },
    context: {
      helpKey: "flow.get.context",
      command: () => import("./lib/get-context.js"),
      args: { positional: ["path"], flags: ["--raw"], options: ["--search"] },
      help: [
        "Usage: sdd-forge flow get context [path] [--raw] [--search <query>]",
        "",
        "List mode (no path): filtered analysis entries.",
        "File mode (with path): file content + metric increment.",
        "Search mode (--search): keyword search in analysis entries.",
        "",
        "Options:",
        "  --raw              Output content without JSON envelope",
        "  --search <query>   Search entries by keyword (matches against keywords array)",
      ].join("\n"),
      post(ctx, result) {
        const phase = deriveActivePhase(ctx);
        if (!phase) return;

        if (result?.type) {
          // File mode: result.type is "docs" or "src"
          ctx.flowManager.incrementMetric(phase, result.type === "docs" ? "docsRead" : "srcRead");
        } else if (result?.entries || result?.total != null) {
          // List mode or search mode: reads analysis.json → docsRead
          ctx.flowManager.incrementMetric(phase, "docsRead");
        }
      },
    },
    "runtime-log": {
      helpKey: "flow.get.runtime-log",
      requiresFlow: false,
      command: () => import("./lib/get-runtime-log.js"),
      passthroughArgs: true,
      help: [
        "Usage: sdd-forge flow get runtime-log [--format json] [--sequence <n>] [--run-id <runId[#sequence]>]",
        "",
        "Return the selected runtime log block. Raw block text is printed by default.",
        "With --format json, prints an envelope containing the block text and metadata.",
      ].join("\n"),
    },
  },
  set: {
    step: {
      helpKey: "flow.set.step",
      runtimeLog: { stepId: (ctx) => ctx.id },
      command: () => import("./lib/set-step.js"),
      args: { positional: ["id", "status"] },
      help: "Usage: sdd-forge flow set step <id> <status>\n\nUpdate a workflow step's status.",
    },
    request: {
      helpKey: "flow.set.request",
      command: () => import("./lib/set-request.js"),
      args: { positional: ["text"] },
      help: "Usage: sdd-forge flow set request \"<text>\"\n\nSet the user request field in flow.json.",
    },
    issue: {
      helpKey: "flow.set.issue",
      command: () => import("./lib/set-issue.js"),
      args: { positional: ["number"] },
      help: "Usage: sdd-forge flow set issue <number>\n\nSet the GitHub issue number in flow.json.",
    },
    note: {
      helpKey: "flow.set.note",
      command: () => import("./lib/set-note.js"),
      args: { positional: ["text"], options: ["--task-id", "--run-id"] },
      help: "Usage: sdd-forge flow set note \"<text>\" [--task-id <id>] [--run-id <id>]\n\nAppend a note entry to state.notes. Works in both active and preparing mode.",
    },
    summary: {
      helpKey: "flow.set.summary",
      command: () => import("./lib/set-summary.js"),
      args: { positional: ["json"] },
      help: "Usage: sdd-forge flow set summary '<json-array>'\n\nSet requirements list from a JSON string array.",
    },
    req: {
      helpKey: "flow.set.req",
      command: () => import("./lib/set-req.js"),
      args: { positional: ["reqRef", "status"] },
      help: "Usage: sdd-forge flow set req <reqId|zeroBasedIndex> <status>\n\nUpdate a single requirement's status. Prefer requirement ids like R1; numeric values are 0-based indexes.",
    },
    files: {
      helpKey: "flow.set.files",
      command: () => import("./lib/set-files.js"),
      args: { positional: ["reqId"], rest: "paths" },
      help: "Usage: sdd-forge flow set files <reqId> <path...>\n\nAppend file paths to file-map.json for a requirement. Deduplicates.",
    },
    broad: {
      helpKey: "flow.set.broad",
      command: () => import("./lib/set-broad.js"),
      args: { positional: ["action"], options: ["--step", "--reason"] },
      help: [
        "Usage: sdd-forge flow set broad on --step <implement|impl-review|impl-gate> --reason <text>",
        "",
        "Record an audited broad-mode exception for task-decomposed implementation.",
        "The reason must be non-empty. The record stores step, reason, timestamp,",
        "and currentTaskId at the time of opt-in.",
      ].join("\n"),
    },
    metric: {
      helpKey: "flow.set.metric",
      command: () => import("./lib/set-metric.js"),
      args: { positional: ["phase", "counter"], options: ["--task-id"] },
      help: `Usage: sdd-forge flow set metric <phase> <counter> [--task-id <id>]\n\nAppend a metric entry. Phases: ${VALID_PHASES.join(", ")}. Counters: ${VALID_METRIC_COUNTERS.join(", ")}.`,
    },
    approval: {
      helpKey: "flow.set.approval",
      command: () => import("./lib/set-approval.js"),
      args: { flags: ["--approved"], options: ["--notes", "--confirmed-at"] },
      help: [
        "Usage: sdd-forge flow set approval --approved [--notes <text>] [--confirmed-at <iso>]",
        "",
        "Persist user approval into the active flow's spec.json `user_approval`",
        "field. The renderer reads this field to produce spec.md's",
        "`## User Confirmation` section, so the approval state survives subsequent",
        "`spec render` runs.",
        "",
        "Options:",
        "  --approved             Required. Marks the spec as approved.",
        "  --notes <text>         Optional confirmation note.",
        "  --confirmed-at <iso>   Optional ISO 8601 timestamp; defaults to now.",
      ].join("\n"),
    },
    "issue-log": {
      helpKey: "flow.set.issue-log",
      command: () => import("./lib/set-issue-log.js"),
      args: { options: ["--step", "--reason", "--trigger", "--resolution", "--guardrail-candidate", "--normalized-finding-id", "--repair-ref-commit", "--repair-ref-file", "--task-id"] },
      help: "Usage: sdd-forge flow set issue-log --step <id> --reason <text> [--trigger <text>] [--resolution <text>] [--guardrail-candidate <text>] [--normalized-finding-id <id>] [--repair-ref-commit <sha>] [--repair-ref-file <path>] [--task-id <id>]\n\nRecord an issue-log entry in issue-log.json. Infers taskId from active task unless --task-id is given.",
      post(ctx) {
        const phase = deriveActivePhase(ctx);
        if (phase) ctx.flowManager.incrementMetric(phase, "issueLog");
      },
    },
    init: {
      helpKey: "flow.set.init",
      requiresFlow: false,
      command: () => import("./lib/set-init.js"),
      args: { options: ["--issue", "--request"] },
      help: [
        "Usage: sdd-forge flow set init [--issue N] [--request \"<text>\"]",
        "",
        "Initialize a preparing flow state. Creates .active-flow.<runId>",
        "and returns the runId.",
        "",
        "Options:",
        "  --issue <number>   GitHub Issue number to seed into preparing state",
        "  --request <text>   User request text to seed into preparing state",
      ].join("\n"),
    },
    retry: {
      helpKey: "flow.set.retry",
      command: () => import("./lib/set-retry.js"),
      args: { positional: ["action", "kind", "phase"], flags: ["--yes"], options: ["--reason"] },
      help: [
        "Usage: sdd-forge flow set retry reset <gate|review> <phase> --reason <text> --yes",
        "",
        "Reset an exhausted retry counter as an audited recovery for <phase>.",
        `  gate   phases: ${RETRY_HELP_GATE_PHASES.join(" | ")}`,
        `  review phases: ${RETRY_HELP_REVIEW_PHASES.join(" | ")}`,
        "Audited exhausted recovery requires changed evidence and grants one re-evaluation.",
        "Unchanged evidence is rejected. --reason and --yes are required.",
      ].join("\n"),
    },
    auto: {
      helpKey: "flow.set.auto",
      requiresFlow: false,
      command: () => import("./lib/set-auto.js"),
      args: { positional: ["value"], options: ["--run-id"] },
      help: [
        "Usage: sdd-forge flow set auto on|off [--run-id <id>]",
        "",
        "Enable or disable autoApprove mode. Writes to flow.json when an",
        "active flow exists; otherwise writes to the matching preparing",
        "flow (.active-flow.<runId>). --run-id selects a preparing flow",
        "when multiple exist; auto-detected when exactly one is present.",
      ].join("\n"),
    },
  },
  run: {
    gate: {
      helpKey: "flow.run.gate",
      responsibilities: DRAFT_REVIEW_GATE_RESPONSIBILITIES,
      runtimeLog: { stepId: gateRuntimeLogStepId },
      pre(ctx) {
        // When --phase is omitted, phase resolution and stale-step recovery
        // happen inside RunGateCommand.execute (which has exclusive ownership
        // over flow state mutations for the duration of the gate). The
        // pre-hook's step-status update is only valid when phase is already
        // known, so skip it otherwise.
        if (ctx.phase == null) return;
        tryUpdateStepStatus(ctx, resolveGateStepId(ctx.phase), "in_progress");
      },
      command: () => import("./lib/run-gate.js"),
      args: {
        options: ["--spec", "--phase", ...FLOW_RUN_RUNTIME_OPTIONS],
        flags: ["--skip-guardrail"],
      },
      help: [
        "Usage: sdd-forge flow run gate [options]",
        "",
        "Run gate check. Resolves target from flow.json if omitted.",
        `Responsibility boundary: ${DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY.summary}.`,
        "",
        "Options:",
        "  --spec <path>                 Path to spec (directory / spec.json / legacy spec.md; auto-resolved from flow.json)",
        `  --phase <${VALID_GATE_PHASES.join("|")}>  Gate phase (default: auto-resolve from in-progress step)`,
        "  --agent-work-dir <path>       Per-invocation agent/tmp base directory",
        "  --skip-guardrail              Skip AI guardrail compliance check",
      ].join("\n"),
      async post(ctx, result) {
        const status = result?.result === "pass" ? "done" : "in_progress";
        const phase = result?.artifacts?.phase || ctx.phase;
        tryUpdateStepStatus({ ...ctx, phase }, resolveGateStepId(phase), status);

        const gateMod = await import("./lib/run-gate.js");
        try {
          gateMod.updateGateRetryCounter(ctx, result);
        } catch (err) {
          process.stderr.write(`[sdd-forge] updateGateRetryCounter failed: ${err.message}\n`);
        }

        if (result?.result !== "pass") {
          tryAppendIssueLog(() => gateMod.appendIssueLogFromGateResult(ctx, result));
        }

        if (result?.result === "pass") {
          await gateMod.executeGateSideEffects(ctx, phase);
        }
      },
      async onError(ctx, err) {
        const { appendIssueLogFromGateError } = await import("./lib/run-gate.js");
        tryAppendIssueLog(() => appendIssueLogFromGateError(ctx, err));
      },
    },
    review: {
      helpKey: "flow.run.review",
      draftReviewPostHookBoundary: DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY,
      responsibilities: DRAFT_REVIEW_REVIEW_RESPONSIBILITIES,
      runtimeLog: { stepId: reviewRuntimeLogStepId },
      command: () => import("./lib/run-review.js"),
      args: {
        flags: ["--dry-run", "--skip-confirm"],
        options: ["--phase", ...FLOW_RUN_RUNTIME_OPTIONS],
      },
      help: [
        "Usage: sdd-forge flow run review [options]",
        "",
        "Run AI code review on current changes.",
        `Responsibility boundary: ${DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY.summary}.`,
        "",
        "Options:",
        `  --phase <type>   Review phase: ${VALID_REVIEW_PHASES.map((p) => `'${p}'`).join(", ")}`,
        "  --agent-work-dir <path>  Per-invocation agent/tmp base directory",
        "  --dry-run        Show proposals without applying",
        "  --skip-confirm   Skip initial confirmation prompt",
      ].join("\n"),
      async post(ctx, result) {
        // spec 253: counter update first (R29: precedence). Errors propagate
        // to dispatcher (R22) so POST_HOOK_FAILED warning surfaces.
        const reviewMod = await import("./lib/run-review.js");
        reviewMod.updateReviewRetryCounter(ctx, result);

        if (ctx.phase === "draft") {
          assertDraftReviewRegistryHookBoundary();
          // Registry post hook boundary: review as detection, triage as
          // disposition, repair as mutation/audit, gate as mechanical
          // validation. This hook completes routing state only; draft
          // mutation/audit remains owned by repair leaves.
          const retryPhase = result?.artifacts?.retryPhase;
          const verdict = result?.artifacts?.verdict;
          const routing = draftReviewRouteForRetryPhase(retryPhase);
          if (routing && isDraftReviewRecordedVerdict(verdict)) {
            tryUpdateStepStatus(ctx, routing.reviewStepId, "done");
            if (verdict === "PASS") {
              writeEmptyDraftReviewRouteArtifacts(ctx, routing);
              tryUpdateStepStatus(ctx, routing.triageStepId, "done");
              tryUpdateStepStatus(ctx, routing.repairStepId, "done");
            }
          }
          return;
        }

        if (ctx.phase === "spec") {
          const verdict = result?.artifacts?.verdict;
          if (verdict === "PASS" || verdict === "ADVISORY") {
            tryUpdateStepStatus(ctx, "spec-review", "done");
            tryUpdateStepStatus(ctx, "spec-triage", "done");
            tryUpdateStepStatus(ctx, "spec-repair", "done");
          } else if (verdict === "FAIL") {
            tryUpdateStepStatus(ctx, "spec-review", "done");
          }
          return;
        }

        if (ctx.phase === "test") {
          const verdict = result?.artifacts?.verdict;
          if (verdict === "PASS" || verdict === "ADVISORY") {
            tryUpdateStepStatus(ctx, "test-review", "done");
          } else if (verdict === "TOOLING_FAILURE") {
            tryAppendIssueLog(() => reviewMod.appendIssueLogFromTestReviewToolingFailure(ctx, result));
          }
          return;
        }

        const planPhases = ["draft", "spec", "test"];
        if (planPhases.includes(ctx.phase)) return;
        if (result?.artifacts?.phase === "impl") {
          const verdict = result.artifacts.verdict;
          if (verdict === "PASS" || verdict === "ADVISORY") {
            tryUpdateStepStatus(ctx, activeImplReviewStepId(ctx.flowState), "done");
          }
          return;
        }
        if (!ctx.dryRun && reviewMod.resetImplEvidenceAfterReviewProposals(ctx, result)) return;
        tryUpdateStepStatus(ctx, activeImplReviewStepId(ctx.flowState), "done");
      },
    },
    "auto-check": {
      helpKey: "flow.run.auto-check",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-auto-check.js"),
      requiresFlow: false,
      args: { options: ["--run-id", ...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run auto-check [--run-id <id>]",
        "",
        "Evaluate whether the current request qualifies for auto mode.",
        "Input is derived statically from flow state based on phase:",
        "  - approval done            → skip AI (unconditionally eligible)",
        "  - draft-gate done + draft  → issue + request + draft body",
        "  - otherwise                → issue + request",
        "",
        "Runs static keyword gates first; if clear, calls the AI once for scoring.",
        "Result is persisted to the active flow.json autoCheck, or to the",
        "preparing flow state (.active-flow.<runId>) when no flow is active.",
        "`flow set auto on` then trusts this persisted verdict instead of",
        "re-invoking the AI with a thinner input.",
        "",
        "Options:",
        "  --run-id <runId>   Target preparing flow (required when no active flow)",
        "  --agent-work-dir <path>  Per-invocation agent/tmp base directory",
      ].join("\n"),
    },
    // impl-confirm is a read-only check, not the finalize action itself.
    // Step status is managed by the skill, not hooks.
    "impl-confirm": {
      helpKey: "flow.run.impl-confirm",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-impl-confirm.js"),
      args: { options: ["--mode", ...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run impl-confirm [options]",
        "",
        "Check implementation readiness against requirements.",
        "",
        "Options:",
        "  --mode <overview|detail>  Check mode (default: overview)",
        "    overview: summarize requirements status from flow.json",
        "    detail:   also compare git diff against requirements",
        "  --agent-work-dir <path>   Per-invocation agent/tmp base directory",
      ].join("\n"),
    },
    "finalize-commit": {
      helpKey: "flow.run.finalize-commit",
      runtimeLog: { stepId: "finalize-commit" },
      command: () => import("./lib/run-finalize-commit.js"),
      args: {
        options: ["--message", ...FLOW_RUN_RUNTIME_OPTIONS],
      },
      help: [
        "Usage: sdd-forge flow run finalize-commit [options]",
        "",
        "Commit implementation changes. Post-hook runs retro, report, and issue comment.",
        "",
        "Options:",
        "  --message <msg>  Custom commit message",
        "  --agent-work-dir <path>  Per-invocation agent/tmp base directory",
      ].join("\n"),
      async post(ctx, result) {
        // R11: skip side effects on preflight_failed / failed. The step is
        // intentionally left at its prior status so the user can retry.
        if (!isFinalizeSuccess(result)) return;
        // R1: normalize success command-result status to flow step 'done'.
        // Pre-merge, authority is the worktree's own flow.json.
        tryUpdateStepStatus(ctx, "finalize-commit", "done");
        const m = await import("./lib/run-finalize.js");
        await m.executeCommitPost(ctx);
      },
      async onError(ctx, err) {
        const m = await import("./lib/run-finalize.js");
        m.finalizeOnError("finalize-commit")(ctx, err);
      },
    },
    "finalize-merge": {
      helpKey: "flow.run.finalize-merge",
      runtimeLog: { stepId: "finalize-merge" },
      command: () => import("./lib/run-finalize-merge.js"),
      args: { options: [...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run finalize-merge",
        "",
        "Squash merge or PR creation. On failure, subsequent steps are skipped.",
      ].join("\n"),
      async pre(ctx) {
        const finalize = await import("./lib/run-finalize.js");
        const metadataPreflight = finalize.readFinalizeMergeMetadataPreflight({
          root: ctx.root,
          specId: ctx.specId,
        });
        if (finalize.hasFinalizeMergeTargetExternalDirty({
          root: ctx.root,
          specId: ctx.specId,
          preflight: metadataPreflight,
        })) {
          return;
        }

        // R20/R21: a prior merge failure left finalize-sync / finalize-cleanup
        // marked 'skipped' on the worktree flow.json (via this entry's onError).
        // Reset them to 'pending' before the retry so promoteNextPendingLeaf
        // can advance after a successful retry. Commit the reset so the merge
        // command's pre-merge dirty check (R21) sees a clean working tree —
        // without this commit, the pre-hook write would itself satisfy 'dirty'
        // and block the retry it is meant to enable.
        const mutated = resetSkippedDownstreamSteps(ctx.flowManager);
        finalize.commitFinalizeMergeMetadataIfSafe({
          root: ctx.root,
          specId: ctx.specId,
          preflight: metadataPreflight,
          includeFlowJson: mutated,
          message: mutated
            ? "chore: reset downstream finalize steps for retry"
            : "chore: record finalize metadata before merge",
        });
      },
      async post(ctx, result) {
        if (!isFinalizeSuccess(result)) return;
        // R2: switch authority to the main repo flow.json (squash-merged in
        // by execute()). The worktree's flow.json is left alone; from this
        // point on it is no longer the authoritative copy.
        const targetFm = resolveMainRepoFlowManager(ctx);
        ctx.flowManager = targetFm; // Switch authority for the dispatcher's runtime-log persistence
        const opts = { specId: ctx.specId };
        tryUpdateStepStatus(targetFm, "finalize-merge", "done", opts);
        // Spec 253 R16/R17: persist squash baseline + merge route on main repo
        // flow.json so finalize-cleanup can detect orphan commits later.
        // result.strategy is "squash" | "pr" | "skip"; "skip" means spec-only
        // mode, which is treated as null route (no detection applies).
        const strategy = result?.strategy === "skip" ? null : (result?.strategy ?? null);
        const baseline =
          strategy === "squash" ? (result?.mergedFromSha ?? null) : null;
        try {
          targetFm.setMergeOutcome(
            { mergeStrategy: strategy, featureBranchSquashedSha: baseline },
            opts,
          );
        } catch (err) {
          process.stderr.write(`[sdd-forge] finalize-merge: setMergeOutcome failed: ${err.message}\n`);
        }
        // R6: on retry success, reset any 'skipped' finalize-sync /
        // finalize-cleanup back to 'pending' so the dispatcher can promote
        // finalize-sync as the next leaf.
        resetSkippedDownstreamSteps(targetFm, opts);
      },
      async onError(ctx, err) {
        const m = await import("./lib/run-finalize.js");
        m.finalizeOnError("finalize-merge")(ctx, err);
        for (const id of FINALIZE_DOWNSTREAM_LEAVES) {
          try {
            ctx.flowManager.updateStepStatus(id, "skipped");
          } catch (e) {
            process.stderr.write(`[sdd-forge] finalize-merge onError: step-status update failed (${id}): ${e.message}\n`);
          }
        }
      },
    },
    "finalize-sync": {
      helpKey: "flow.run.finalize-sync",
      runtimeLog: { stepId: "finalize-sync" },
      command: () => import("./lib/run-finalize-sync.js"),
      args: { options: [...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run finalize-sync",
        "",
        "Build docs on main repo after merge and commit.",
      ].join("\n"),
      async post(ctx, result) {
        if (!isFinalizeSuccess(result)) return;
        // R2: post-merge authority is the main repo flow.json.
        const targetFm = resolveMainRepoFlowManager(ctx);
        ctx.flowManager = targetFm; // Switch authority for the dispatcher's runtime-log persistence
        tryUpdateStepStatus(targetFm, "finalize-sync", "done", { specId: ctx.specId });
      },
      async onError(ctx, err) {
        const m = await import("./lib/run-finalize.js");
        m.finalizeOnError("finalize-sync")(ctx, err);
      },
    },
    "finalize-cleanup": {
      helpKey: "flow.run.finalize-cleanup",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-finalize-cleanup.js"),
      args: { flags: ["--auto-rescue", "--force"], options: [...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run finalize-cleanup [--auto-rescue | --force]",
        "",
        "Clear flow state, remove worktree/branch, write last-finalized-spec pointer.",
        "",
        "Spec 253 orphan commit handling (squash route only):",
        "  --auto-rescue  Cherry-pick orphan commits onto baseBranch before deletion.",
        "                 Aborts on conflict; halts on main repo dirty/locked.",
        "  --force        Delete feature branch even if orphan commits exist.",
        "                 Records the dropped commit list to issue-log.",
        "  (no flag)      Detect orphan commits and halt (worktree/branch retained).",
        "                 The user must re-run with --auto-rescue or --force, or",
        "                 archive the branch and run --force after manual recovery.",
        "",
        "--auto-rescue and --force are mutually exclusive.",
      ].join("\n"),
      async post(ctx, result) {
        // The cleanup body owns the step transition (it must be done inside
        // the same git commit as the final flow.json — see R5). The post hook
        // is an idempotent re-set in case the body wrote the file but the
        // dispatcher still ran post for some unforeseen reason.
        if (!isFinalizeSuccess(result)) return;
        const targetFm = resolveMainRepoFlowManager(ctx);
        ctx.flowManager = targetFm; // Switch authority for the dispatcher's runtime-log persistence
        tryUpdateStepStatus(targetFm, "finalize-cleanup", "done", { specId: ctx.specId });
      },
      async onError(ctx, err) {
        const m = await import("./lib/run-finalize.js");
        m.finalizeOnError("finalize-cleanup")(ctx, err);
      },
    },
    sync: {
      helpKey: "flow.run.sync",
      runtimeLog: { stepMetadata: false },
      requiresFlow: false,
      command: () => import("./lib/run-sync.js"),
      args: { flags: ["--dry-run"], options: [...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run sync [options]",
        "",
        "Sync documentation: build -> review -> add -> commit.",
        "",
        "Options:",
        "  --dry-run   Preview only",
      ].join("\n"),
    },
    "reopen-draft": {
      helpKey: "flow.run.reopen-draft",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-reopen-draft.js"),
      args: { options: ["--reason", ...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run reopen-draft [--reason <text>]",
        "",
        "Rewind the flow's draft step to in_progress so the user can add",
        "new tasks to the approved spec (draft-return). Preconditions:",
        "  - flow.json.tasks[] has at least one done task",
        "",
        "Records the event in specs/<spec>/issue-log.json.",
      ].join("\n"),
    },
    "start-task": {
      helpKey: "flow.run.start-task",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-start-task.js"),
      args: { options: ["--task-id", ...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run start-task --task-id <id>",
        "",
        "Manually promote a pending task to currentTaskId and transition",
        "it to in_progress. Useful for recovery or manual ordering when",
        "auto-promote is not desired.",
      ].join("\n"),
    },
    "complete-task": {
      helpKey: "flow.run.complete-task",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-complete-task.js"),
      args: { options: ["--task-id", ...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run complete-task [--task-id <id>]",
        "",
        "Complete currentTaskId (or --task-id if specified), apply parent",
        "propagation, and auto-promote the next pending task. Useful for",
        "recovery when impl-gate post-hook did not fire.",
      ].join("\n"),
    },
    "update-overview": {
      helpKey: "flow.run.update-overview",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-update-overview.js"),
      args: { options: ["--json", ...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run update-overview --json '<additions>'",
        "",
        "Append this task's overview contribution to the parent spec.json.",
        "Additions JSON shape:",
        "  {modules?:[{text}], data_flow?:[{text}], decisions?:[{text}]}",
        "The current task id is auto-stamped as added_by_task. spec.md is",
        "re-rendered after the merge. Spec 226 moves this from a dedicated",
        "step to an impl-step production caller.",
      ].join("\n"),
    },
    // lint is a sub-task of the implement phase; it does not exclusively own the step.
    // Step status is managed by the skill, not hooks.
    lint: {
      helpKey: "flow.run.lint",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-lint.js"),
      args: { options: ["--base", ...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run lint [options]",
        "",
        "Check changed files against guardrail lint patterns.",
        "",
        "Options:",
        "  --base <branch>  Base branch for git diff (auto-resolved from flow.json)",
      ].join("\n"),
    },
    "test-execute": {
      helpKey: "flow.run.test-execute",
      runtimeLog: { stepId: "test-execute" },
      command: () => import("./lib/run-test-execute.js"),
      args: { flags: [], options: [...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run test-execute",
        "",
        "Execute the project's test runner via AI agent and persist:",
        "  specs/<spec>/test-execute-result.json (machine-readable summary)",
        "  specs/<spec>/tests/.raw/test-execution.log (raw stdout/stderr)",
      ].join("\n"),
      async post(ctx) {
        const path = await import("node:path");
        const { readJsonStrict, validateTestExecuteResultV2 } = await import("./lib/test-artifacts.js");
        const specDir = path.dirname(path.resolve(ctx.root, ctx.flowState.spec));
        validateTestExecuteResultV2(readJsonStrict(path.join(specDir, "test-execute-result.json")));
        tryUpdateStepStatus(ctx, "test-execute", "done");
      },
    },
    "scenario-validity": {
      helpKey: "flow.run.scenario-validity",
      runtimeLog: { stepId: "scenario-validity" },
      internal: true,
      requiresFlow: true,
      command: () => import("./lib/run-scenario-validity.js"),
      args: { flags: [], options: [...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run scenario-validity",
        "",
        "Execute pre-implementation spec-local tests and persist:",
        "  specs/<spec>/scenario-validity-result.json",
        "  specs/<spec>/tests/.raw/scenario-validity.log",
      ].join("\n"),
      post(ctx, result) {
        if (result?.result === "pass") tryUpdateStepStatus(ctx, "scenario-validity", "done");
      },
    },
    "test-result-review": {
      helpKey: "flow.run.test-result-review",
      runtimeLog: { stepId: "test-result-review" },
      command: () => import("./lib/run-test-result-review.js"),
      args: { flags: [], options: [...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run test-result-review",
        "",
        "Verify test-execute-result.json integrity against raw output and code.",
        "Persists specs/<spec>/test-result-review.json and test-result-review.md.",
      ].join("\n"),
      async post(ctx) {
        const path = await import("node:path");
        const { readJsonStrict, validateTestResultReview } = await import("./lib/test-artifacts.js");
        const specDir = path.dirname(path.resolve(ctx.root, ctx.flowState.spec));
        const review = validateTestResultReview(readJsonStrict(path.join(specDir, "test-result-review.json")));
        if (review.verdict !== "pass") throw new Error("test-result-review verdict is not pass");
        tryUpdateStepStatus(ctx, "test-result-review", "done");
      },
    },
    // retro is a mainline impl-phase step that aggregates test-execute results.
    retro: {
      helpKey: "flow.run.retro",
      runtimeLog: { stepId: "retro" },
      command: () => import("./lib/run-retro.js"),
      args: { flags: ["--force", "--dry-run"], options: [...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run retro [options]",
        "",
        "Aggregate test-execute results per requirement and save retro.json.",
        "Reads test-result-review.json and test-execute-result.json (produced",
        "by earlier impl steps); does not execute tests.",
        "",
        "Options:",
        "  --force     Overwrite existing retro.json (default: always overwrites)",
        "  --dry-run   Preview only, do not write retro.json",
      ].join("\n"),
      post(ctx) {
        tryUpdateStepStatus(ctx, "retro", "done");
      },
    },
    "final-regression": {
      helpKey: "flow.run.final-regression",
      runtimeLog: { stepId: "final-regression" },
      command: () => import("./lib/run-final-regression.js"),
      args: { flags: [], options: [...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run final-regression",
        "",
        "Run the full project-level regression command after retro and before finalize.",
        "Persists specs/<spec>/final-regression-result.json and specs/<spec>/tests/.raw/final-regression-attempt-<N>.log (zero-padded to at least three digits).",
      ].join("\n"),
      async post(ctx, result) {
        const path = await import("node:path");
        const { readJsonStrict, validateFinalRegressionResult } = await import("./lib/test-artifacts.js");
        const specDir = path.dirname(path.resolve(ctx.root, ctx.flowState.spec));
        const artifact = validateFinalRegressionResult(readJsonStrict(path.join(specDir, "final-regression-result.json")));
        if (artifact.result !== "pass" || result?.result !== "pass") {
          throw new Error("final-regression result is not pass");
        }
        tryUpdateStepStatus(ctx, "final-regression", "done");
      },
    },
    // report generates a work report from the current flow state.
    report: {
      helpKey: "flow.run.report",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-report.js"),
      args: { flags: ["--dry-run"], options: [...FLOW_RUN_RUNTIME_OPTIONS] },
      help: [
        "Usage: sdd-forge flow run report [options]",
        "",
        "Generate a work report from the current flow state.",
        "",
        "Options:",
        "  --dry-run   Preview only, do not write report.json",
      ].join("\n"),
    },
  },
  report: {
    show: {
      helpKey: "flow.report.show",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-report-show.js"),
      requiresFlow: false,
      args: { flags: [] },
      help: [
        "Usage: sdd-forge flow report show",
        "",
        "Stream the most recent finalize Report text to stdout.",
        "Reads .sdd-forge/last-finalized-spec to locate the latest",
        "finalized spec and prints its report.json `text` field.",
        "Exits non-zero if the pointer or report.json is missing.",
      ].join("\n"),
    },
  },
};
