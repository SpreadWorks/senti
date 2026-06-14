/**
 * src/flow/lib/run-gate.js
 *
 * FlowCommand: gate — check deliverable readiness for each phase.
 *
 * Phases (issue #184, cac6/T3):
 *   draft        (level=parent)       check draft.json structure + guardrail compliance
 *   spec         (level=parent)       check spec.json structure + guardrail compliance
 *   task-spec    (level=task)         check task spec + guardrail compliance
 *   task-impl    (level=task)         check task impl against spec + guardrail compliance
 *   integration  (level=integration)  check integration task + guardrail compliance
 *
 * AI evaluation output is a structured JSON schema:
 *   { "evaluations": [{ "guardrail_id": string, "result": "pass"|"fail"|"skip", "reason": string }] }
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { assertOk } from "../../lib/process.js";
import { runGit } from "../../lib/git-helpers.js";

const execFileAsync = promisify(execFile);
import { container } from "../../lib/container.js";
import { PromptBuilder } from "../../lib/prompt-builder.js";
import { filterByPhase, loadMergedGuardrails } from "../../lib/guardrail.js";
import { getSpecName } from "../../lib/flow-helpers.js";
import {
  enumerateUsableRequirementIds,
  loadSpecJson,
  resolveSpecJsonPath,
  resolveSpecDir,
  specJsonToPromptText,
  validateSpecJsonObject,
} from "../../lib/spec-json.js";
import { loadFileMap, reconcileFileMap } from "./req-map.js";
import { buildAcknowledgedRationaleSection } from "./acknowledged-rationale.js";
import { checkTasksMonotonic } from "./check-tasks-monotonic.js";
import {
  VALID_GATE_PHASES,
  VALID_GATE_LEVELS,
  VALID_LEVEL_PHASE_COMBINATIONS,
} from "../../lib/constants.js";
import { FlowCommand } from "./base-command.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";
import { resolveGateStepId, resolveGatePhaseFromState } from "./gate-step.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { contractFromGateArtifact, repoRelative } from "./flow-judgment-contract.js";
import { validateDraftLifecycle } from "./draft-lifecycle.js";
import {
  IMPL_GATE_RESULT_FILE,
  assertIntegrationRegressionEvidence,
  validateIntegrationArtifactTrust,
} from "./test-artifacts.js";
import {
  Observation,
  Diagnosis,
  NextAction,
  legacyEvaluationsToNextAction,
} from "./observation.js";
import {
  assertAuditedBroadMode,
  evaluateTaskScope,
  resolveCurrentTaskSpec,
  taskScopeViolationMessages,
} from "./task-scope.js";
import {
  DRAFT_REVIEW_ARTIFACT_LIMIT,
  DRAFT_REVIEW_ROUTES,
  DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT,
} from "./draft-review-routes.js";
import { persistCurrentRecoveryBaseline } from "./retry-recovery.js";
import {
  deferExhaustedSemanticFindings,
  readBoundedSourceArtifact,
  sourceArtifactExists,
  specDirFromFlowState,
} from "./flow-findings.js";
import {
  completeDraftArtifactChange,
  completeSpecArtifactChange,
} from "./artifact-completion.js";

export { resolveGateStepId };

export async function completeGateArtifactBeforeSemanticEvaluation({
  completeArtifact,
  evaluateSemanticGuardrail,
} = {}) {
  const completed = await completeArtifact();
  if (completed?.constructor?.name === "ArtifactCompletionMechanicalFailure" || completed?.ok === false) {
    return completed;
  }
  return evaluateSemanticGuardrail(completed);
}

/**
 * Execute gate PASS side effects driven by definition's sideEffects attribute.
 * Looks up sideEffects from the definition for the given phase, then dispatches.
 * Called from registry.js gate post hook when result is "pass".
 *
 * @param {object} ctx - flow command context with flowManager
 * @param {string} phase - gate phase (e.g. "task-impl", "draft")
 */
export async function executeGateSideEffects(ctx, phase) {
  const { deriveNextAction } = await import("../definition.js");
  const fm = ctx.flowManager;
  const state = fm.load();
  const stepId = resolveGateStepId(phase);
  const scope = state?.currentTaskId != null ? "task" : "flow";
  const derived = deriveNextAction({ scope, stepId, context: state });
  const sideEffects = derived?.sideEffects;
  if (!sideEffects || sideEffects.length === 0) return;

  for (const effect of sideEffects) {
    try {
      if (effect === "completeTask") {
        if (state?.currentTaskId != null) {
          fm.completeTask(state.currentTaskId);
        }
      } else if (effect === "promoteNextTask") {
        const { promoteNextPending } = await import("../../lib/flow-helpers.js");
        fm.mutate((s) => { promoteNextPending(s); });
      } else if (effect === "mergeOverview") {
        const { default: RunUpdateOverviewCommand } = await import("./run-update-overview.js");
        const cmd = new RunUpdateOverviewCommand();
        await cmd.execute({ ...ctx, args: { json: "[]" } });
      }
    } catch (err) {
      process.stderr.write(`[senti] gate side effect '${effect}' failed: ${err.message}\n`);
    }
  }
}


// ---------------------------------------------------------------------------
// Level / phase validation
// ---------------------------------------------------------------------------

/**
 * Map from gate phase to its canonical gate level.
 */
export const PHASE_TO_LEVEL = Object.freeze({
  "draft": "parent",
  "spec": "parent",
  "task-spec": "task",
  "task-impl": "task",
  "integration": "integration",
});

/**
 * spec 251 R17 and spec 258: precheck for integration gate. Verifies the
 * full trust-input set produced by test-execute / test-result-review before
 * delegating to the AI guardrail pipeline. The validator also enforces
 * placeholder-permission.json before any detected placeholder artifact can be
 * tolerated.
 */
function checkIntegrationTestArtifacts(root, state, level, phase, config = {}) {
  const specPath = state.spec;
  const specDir = path.dirname(path.resolve(root, specPath));
  const result = validateIntegrationArtifactTrust({
    root,
    specDir,
    phase,
    specPath,
    state,
    config,
  });
  if (!result.ok) {
    return Envelope.fail("run", "gate", result.code, [
      `test artifact validation failed: ${result.reason}`,
    ], { phase, level, spec: specPath });
  }
  return null;
}

/**
 * Validate a (level, phase) pair against the allowed combinations.
 * Throws Error if invalid.
 */
export function validateLevelPhase(level, phase) {
  if (!VALID_GATE_LEVELS.includes(level)) {
    throw new Error(
      `invalid level: ${level} (valid: ${VALID_GATE_LEVELS.join(", ")})`,
    );
  }
  if (!VALID_GATE_PHASES.includes(phase)) {
    throw new Error(
      `invalid phase: ${phase} (valid: ${VALID_GATE_PHASES.join(", ")})`,
    );
  }
  const ok = VALID_LEVEL_PHASE_COMBINATIONS.some(
    (c) => c.level === level && c.phase === phase,
  );
  if (!ok) {
    throw new Error(
      `invalid level/phase combination: (${level}, ${phase}). ` +
        `allowed: ${VALID_LEVEL_PHASE_COMBINATIONS.map((c) => `(${c.level},${c.phase})`).join(", ")}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runGitDiff(args, errorMessage, cwd) {
  const res = runGit(["diff", ...args], { cwd });
  assertOk(res, errorMessage);
  return res.stdout;
}

const UNTRACKED_DEFAULT_MAX_FILES = 500;
const UNTRACKED_DEFAULT_MAX_FILE_SIZE = 1024 * 1024; // 1 MiB
const TASK_IMPL_GATE_DIFF_MAX_BYTES = 1024 * 1024; // 1 MiB
const MAX_IMPL_REQUIREMENT_BATCH_CHARS = 120000;
const MAX_AGENT_PROMPT_INPUT_CHARS = 900000;
const MAX_GUARDRAIL_TARGET_CHARS = 250000;
const GATE_SOURCE_ARTIFACT_BY_PHASE = Object.freeze({
  draft: "draft-gate-source.json",
  spec: "spec-gate-source.json",
  "task-impl": "task-impl-gate-source.json",
  integration: IMPL_GATE_RESULT_FILE,
});
const GATE_RESULT_ARTIFACT_BY_PHASE = Object.freeze({
  draft: "draft-gate-result.json",
  spec: "spec-gate-result.json",
  "task-impl": "task-impl-gate-result.json",
  integration: IMPL_GATE_RESULT_FILE,
});

/**
 * Synthesize a unified diff for every untracked file in `root` and return the
 * concatenated diff text. Untracked-file omission in `git diff` is the root
 * cause of spec 221 — a test-first new test file becomes invisible to
 * impl-gate unless we splice it back in here.
 *
 * Read-only: uses `git ls-files --others --exclude-standard` for enumeration
 * and `git diff --no-index /dev/null <path>` for synthesis. Neither mutates
 * the index or working tree (REQ-4 / REQ-5).
 *
 * Exit-code contract for `git diff --no-index`:
 *   - 0 → no differences (impossible here since we compare against /dev/null
 *         for a non-empty file, but accepted for completeness)
 *   - 1 → differences present (the normal, expected case)
 *   - ≥2 (or signal / killed) → real git error → re-throw via `assertOk`
 *
 * Bounded resource usage: refuses to process more than `maxFiles` files or
 * any single file larger than `maxFileSize` bytes (REQ-6). Exceeding either
 * limit throws an Error tagged with `code = "UNTRACKED_LIMIT_EXCEEDED"`.
 *
 * @param {string} root absolute path to the repository (or worktree) root
 * @param {{maxFiles?: number, maxFileSize?: number, excludeFile?: Function}} [options]
 * @returns {Promise<string>} concatenated unified diff text, or "" if none
 */
export async function collectUntrackedDiff(root, options = {}) {
  const maxFiles = options.maxFiles ?? UNTRACKED_DEFAULT_MAX_FILES;
  const maxFileSize = options.maxFileSize ?? UNTRACKED_DEFAULT_MAX_FILE_SIZE;

  // Single async git invocation — not in any loop, so no bulk-path concern.
  let listStdout;
  try {
    ({ stdout: listStdout } = await execFileAsync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "-z"],
      { cwd: root },
    ));
  } catch (err) {
    const wrapped = new Error(`failed to list untracked files: ${err.message}`);
    wrapped.cause = err;
    throw wrapped;
  }
  // -z output: NUL-separated, no trailing entry
  const excludeFile = typeof options.excludeFile === "function" ? options.excludeFile : () => false;
  const files = listStdout
    .split("\0")
    .filter((p) => p.length > 0)
    .filter((p) => !excludeFile(p));
  if (files.length === 0) return "";

  if (files.length > maxFiles) {
    const err = new Error(
      `untracked file count ${files.length} exceeds limit ${maxFiles}`,
    );
    err.code = "UNTRACKED_LIMIT_EXCEEDED";
    throw err;
  }

  // Stat every candidate in parallel (avoids serial sync I/O in this loop)
  // and enforce per-file size limits before invoking git.
  const sizes = await Promise.all(
    files.map((rel) => fs.promises.stat(path.join(root, rel)).then((s) => s.size)),
  );
  for (let i = 0; i < files.length; i++) {
    if (sizes[i] > maxFileSize) {
      const err = new Error(
        `untracked file ${files[i]} is ${sizes[i]} bytes, exceeds limit ${maxFileSize}`,
      );
      err.code = "UNTRACKED_LIMIT_EXCEEDED";
      throw err;
    }
  }

  // Run every per-file `git diff --no-index` in parallel. Async execFile
  // avoids blocking on per-file synchronous I/O when the untracked set
  // grows. `git diff --no-index` exits 1 when differences exist (the
  // expected outcome here); execFileAsync rejects on non-zero, so we
  // resolve that rejection only for the well-defined exit-1 case and
  // re-throw anything else as a real git failure.
  const parts = await Promise.all(files.map(async (rel) => {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["diff", "--no-index", "--no-color", "--", "/dev/null", rel],
        { cwd: root, maxBuffer: maxFileSize * 4 },
      );
      return stdout;
    } catch (err) {
      // Differences-present is signalled as exit code 1 — accept it.
      if (err && err.code === 1 && typeof err.stdout === "string") return err.stdout;
      const wrapped = new Error(
        `failed to synthesize untracked diff for ${rel}: ${err.message}`,
      );
      wrapped.cause = err;
      throw wrapped;
    }
  }));
  return parts.join("");
}

function splitDiffByFile(diffText) {
  const map = new Map();
  if (!diffText) return map;
  const segments = diffText.split(/(?=^diff --git )/m);
  for (const segment of segments) {
    if (!segment.trim()) continue;
    const headerMatch = segment.match(/^diff --git a\/.+? b\/(.+)$/m);
    if (!headerMatch) continue;
    const filePath = headerMatch[1];
    const existing = map.get(filePath) || "";
    map.set(filePath, existing + segment);
  }
  return map;
}

function summarizeDiffSegment(file, fileDiff) {
  const added = (fileDiff.match(/^\+(?!\+\+)/gm) || []).length;
  const removed = (fileDiff.match(/^-(?!--)/gm) || []).length;
  const header = fileDiff.split(/\r?\n/).slice(0, 4).filter(Boolean).join(" | ");
  return `- ${file}: +${added} -${removed}; ${header}`;
}

function appendPromptLine(lines, line, maxChars) {
  const currentLength = lines.join("\n").length;
  if (currentLength + line.length + 1 > maxChars) return false;
  lines.push(line);
  return true;
}

function compactDiffForGuardrailPrompt(diff, maxChars = MAX_GUARDRAIL_TARGET_CHARS) {
  if (typeof diff !== "string") throw new Error("diff must be a string");
  if (!Number.isInteger(maxChars) || maxChars <= 0) throw new Error("maxChars must be a positive integer");
  if (diff.length <= maxChars) return diff;

  const lines = [
    `[diff compacted for guardrail prompt: original ${diff.length} chars, budget ${maxChars} chars]`,
    "Full file diffs with added or modified lines are prioritized. Deletion-only file bodies are summarized.",
    "",
    "## Full Diffs",
  ];
  const summarized = [];
  const omitted = [];

  for (const [file, fileDiff] of splitDiffByFile(diff)) {
    const hasAddedLines = /^\+(?!\+\+)/m.test(fileDiff);
    if (!hasAddedLines) {
      summarized.push(summarizeDiffSegment(file, fileDiff));
      continue;
    }

    if (appendPromptLine(lines, fileDiff.trimEnd(), maxChars)) continue;

    const marker = `[full diff truncated for ${file}; file summary follows]`;
    const remaining = maxChars - lines.join("\n").length - marker.length - 2;
    if (remaining > 1000) {
      lines.push(`${fileDiff.slice(0, remaining).trimEnd()}\n${marker}`);
    } else {
      omitted.push(summarizeDiffSegment(file, fileDiff));
    }
  }

  if (summarized.length > 0 || omitted.length > 0) {
    appendPromptLine(lines, "", maxChars);
    appendPromptLine(lines, "## Summarized Or Omitted File Diffs", maxChars);
  }
  for (const summary of [...summarized, ...omitted]) {
    if (!appendPromptLine(lines, summary, maxChars)) {
      appendPromptLine(lines, "- ... additional file diffs omitted from compacted prompt", maxChars);
      break;
    }
  }

  const compacted = lines.join("\n");
  if (compacted.length <= maxChars) return compacted;
  return `${compacted.slice(0, Math.max(0, maxChars - 38)).trimEnd()}\n[compacted diff truncated]`;
}

function collectPerFileDiffsForGate(committed, uncommitted, untracked) {
  const merged = splitDiffByFile(committed);
  for (const [file, d] of splitDiffByFile(uncommitted)) {
    merged.set(file, (merged.get(file) || "") + d);
  }
  for (const [file, d] of splitDiffByFile(untracked)) {
    merged.set(file, (merged.get(file) || "") + d);
  }
  return merged;
}

function taskCursorRequiredGateFailure(scopeDecision, phase, state) {
  return Envelope.fail(
    "run",
    "gate",
    "TASK_CURSOR_REQUIRED",
    taskScopeViolationMessages(scopeDecision, "impl-gate"),
    { phase, currentTaskId: state.currentTaskId ?? null },
  );
}

function isGeneratedSpecArtifactForGate(relPath, specPath) {
  if (!specPath) return false;
  const specDir = path.posix.dirname(specPath.split(path.sep).join("/"));
  const normalized = relPath.split(path.sep).join("/");
  if (!normalized.startsWith(`${specDir}/`)) return false;
  if (/^specs\/[^/]+\/tests\/[^/]+\.(test|spec)\.(js|mjs|ts)$/.test(normalized)) return false;
  return true;
}

function sectionAt(lines, lineIdx) {
  for (let i = lineIdx - 1; i >= 0; i--) {
    const m = lines[i].match(/^\s*##\s+(.+)/);
    if (m) return m[1].trim();
  }
  return "";
}

// ---------------------------------------------------------------------------
// Unresolved-marker patterns (shared by markdown and JSON checkers)
// ---------------------------------------------------------------------------

const UNRESOLVED_PATTERNS = Object.freeze([
  /\[NEEDS CLARIFICATION\]/i,
  /\bTBD\b/i,
  /\bTODO\b/i,
  /\bFIXME\b/i,
]);

function findUnresolvedMatch(text) {
  for (const p of UNRESOLVED_PATTERNS) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Text checks — task draft markdown (used by phase=task-spec)
// ---------------------------------------------------------------------------

/**
 * @param {string} text
 * @returns {string[]} issues
 */
function checkSpecText(text) {
  const issues = [];
  const lines = text.split("\n");

  const PRE_SKIP_SECTIONS = /^(Status|Acceptance Criteria|User Scenarios\s*&?\s*Testing|User Confirmation)/i;

  for (const [idx, line] of lines.entries()) {
    if (/^\s*\|/.test(line)) continue;

    if (findUnresolvedMatch(line)) {
      issues.push(`line ${idx + 1}: unresolved token (${line.trim()})`);
    }
    if (/^\s*-\s*\[\s\]\s+/.test(line)) {
      const section = sectionAt(lines, idx);
      if (PRE_SKIP_SECTIONS.test(section)) continue;
      issues.push(`line ${idx + 1}: unchecked task/question (${line.trim()})`);
    }
  }

  if (!/^\s*##\s+Clarifications\b/im.test(text)) {
    issues.push("missing section: ## Clarifications");
  }
  if (!/^\s*##\s+Open Questions\b/im.test(text)) {
    issues.push("missing section: ## Open Questions");
  }
  if (!/^\s*##\s+User Confirmation\b/im.test(text)) {
    issues.push("missing section: ## User Confirmation");
  }
  const hasAcceptance =
    /^\s*##\s+Acceptance Criteria\b/im.test(text) ||
    /^\s*##\s+User Scenarios\s*&\s*Testing\b/im.test(text) ||
    /^\s*##\s+User Scenarios\b/im.test(text);
  if (!hasAcceptance) {
    issues.push(
      "missing section: ## Acceptance Criteria (or ## User Scenarios & Testing)",
    );
  }

  return issues;
}

// ---------------------------------------------------------------------------
// JSON checks — parent spec.json (used by phase=spec)
// ---------------------------------------------------------------------------

/**
 * Scan a parsed spec.json tree for unresolved markers in human-authored
 * string values. Schema validation is performed at the caller via
 * `loadSpecJson()` (the single validated load path); this function operates
 * on an already-validated spec object.
 *
 * @param {object} spec - parsed and schema-validated spec.json
 * @returns {string[]} issues, each prefixed with the dotted field path
 */
function checkSpecJson(spec) {
  const issues = [];
  walkStrings(spec, "", (value, path) => {
    const marker = findUnresolvedMatch(value);
    if (marker) {
      issues.push(`${path}: unresolved marker "${marker}" in value (${value.trim()})`);
    }
  });

  // spec 228: minimum-content sanity checks — catch empty stubs before AI guardrails.
  const requiredNonEmpty = [
    ["goal", (v) => typeof v === "string" && v.trim() === "", "spec must have a non-empty goal"],
    ["requirements", (v) => Array.isArray(v) && v.length === 0, "spec must have at least one requirement"],
    ["acceptance_criteria", (v) => Array.isArray(v) && v.length === 0, "spec must have at least one acceptance criterion"],
  ];
  for (const [field, isEmpty, msg] of requiredNonEmpty) {
    if (isEmpty(spec[field])) {
      issues.push(`${field}: empty (${msg})`);
    }
  }

  // spec 226: tasks[] must be present and non-empty for new specs.
  // Existing merged specs are not gated (flow.json is cleanup'd on finalize),
  // so this check naturally applies only to active flows.
  if (spec.tasks === undefined) {
    issues.push("tasks: missing field (task decomposition required per spec 226)");
  } else if (Array.isArray(spec.tasks) && spec.tasks.length === 0) {
    issues.push("tasks: empty array (task decomposition required for all new specs per spec 226)");
  }

  // spec 226: forest depth upper bound = 10.
  if (Array.isArray(spec.tasks) && spec.tasks.length > 0) {
    const depth = computeForestDepth(spec.tasks);
    if (depth > 10) {
      issues.push(`tasks: forest depth ${depth} exceeds maximum of 10`);
    }
  }

  return issues;
}

const SPEC_TRIAGE_DECISIONS = new Set([
  "apply",
  "invalid",
  "already_resolved",
  "downgraded_to_non_blocking",
]);

const SPEC_REPAIR_DECISIONS = new Set([
  "applied",
]);

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateSpecRepairAudit(root, specInput) {
  const specDir = path.dirname(path.resolve(root, specInput));
  const reviewPath = path.join(specDir, "spec-review.json");
  const triagePath = path.join(specDir, "spec-triage.json");
  const repairPath = path.join(specDir, "spec-repair.json");
  const issues = [];

  let review;
  try {
    review = readJsonIfExists(reviewPath);
  } catch (err) {
    return [`spec-repair: spec-review.json is invalid JSON: ${err.message}`];
  }
  if (!review || review.verdict !== "FAIL") return [];

  const blocking = Array.isArray(review.blockingFindings) ? review.blockingFindings : [];
  if (!fs.existsSync(triagePath)) {
    return ["spec-triage: spec-review.json verdict is FAIL but spec-triage.json is missing"];
  }

  let triage;
  try {
    triage = readJsonIfExists(triagePath);
  } catch (err) {
    return [`spec-triage: spec-triage.json is invalid JSON: ${err.message}`];
  }

  if (triage?.version !== 1) issues.push("spec-triage: spec-triage.json version must be 1");
  if (triage?.phase !== "spec-triage") issues.push('spec-triage: spec-triage.json phase must be "spec-triage"');
  if (triage?.sourceReview !== "spec-review.json") issues.push('spec-triage: spec-triage.json sourceReview must be "spec-review.json"');
  if (typeof triage?.summary !== "string" || triage.summary.trim() === "") {
    issues.push("spec-triage: spec-triage.json summary must be non-empty");
  }
  if (!Array.isArray(triage?.items)) {
    issues.push("spec-triage: spec-triage.json items must be an array");
    return issues;
  }
  if (triage.items.length !== blocking.length) {
    issues.push(
      `spec-triage: spec-triage.json items length ${triage.items.length} does not match blockingFindings length ${blocking.length}`,
    );
  }

  for (let i = 0; i < triage.items.length; i++) {
    const item = triage.items[i];
    const finding = blocking[i];
    const prefix = `spec-triage: items[${i}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    if (typeof item.title !== "string" || item.title.trim() === "") issues.push(`${prefix}.title must be non-empty`);
    if (typeof item.target !== "string" || item.target.trim() === "") issues.push(`${prefix}.target must be non-empty`);
    if (finding && item.title !== finding.title) {
      issues.push(`${prefix}.title must match blockingFindings[${i}].title`);
    }
    if (finding && item.target !== finding.target) {
      issues.push(`${prefix}.target must match blockingFindings[${i}].target`);
    }
    if (!SPEC_TRIAGE_DECISIONS.has(item.decision)) {
      issues.push(`${prefix}.decision must be one of ${Array.from(SPEC_TRIAGE_DECISIONS).join(", ")}`);
    }
    if (typeof item.rationale !== "string" || item.rationale.trim() === "") {
      issues.push(`${prefix}.rationale must be non-empty`);
    }
    if (typeof item.evidence !== "string" || item.evidence.trim() === "") {
      issues.push(`${prefix}.evidence must be non-empty`);
    }
  }

  if (!fs.existsSync(repairPath)) {
    issues.push("spec-repair: spec-review.json verdict is FAIL but spec-repair.json is missing");
    return issues;
  }

  let repair;
  try {
    repair = readJsonIfExists(repairPath);
  } catch (err) {
    return [`spec-repair: spec-repair.json is invalid JSON: ${err.message}`];
  }

  if (repair?.version !== 1) issues.push("spec-repair: spec-repair.json version must be 1");
  if (repair?.phase !== "spec-repair") issues.push('spec-repair: spec-repair.json phase must be "spec-repair"');
  if (repair?.sourceReview !== "spec-triage.json") issues.push('spec-repair: spec-repair.json sourceReview must be "spec-triage.json"');
  if (typeof repair?.summary !== "string" || repair.summary.trim() === "") {
    issues.push("spec-repair: spec-repair.json summary must be non-empty");
  }
  if (!Array.isArray(repair?.items)) {
    issues.push("spec-repair: spec-repair.json items must be an array");
    return issues;
  }
  const applyItems = triage.items.filter((item) => item?.decision === "apply");
  if (repair.items.length !== applyItems.length) {
    issues.push(
      `spec-repair: spec-repair.json items length ${repair.items.length} does not match spec-triage apply item length ${applyItems.length}`,
    );
  }

  for (let i = 0; i < repair.items.length; i++) {
    const item = repair.items[i];
    const triageItem = applyItems[i];
    const prefix = `spec-repair: items[${i}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    if (typeof item.title !== "string" || item.title.trim() === "") issues.push(`${prefix}.title must be non-empty`);
    if (typeof item.target !== "string" || item.target.trim() === "") issues.push(`${prefix}.target must be non-empty`);
    if (triageItem && item.title !== triageItem.title) {
      issues.push(`${prefix}.title must match spec-triage apply item ${i}.title`);
    }
    if (triageItem && item.target !== triageItem.target) {
      issues.push(`${prefix}.target must match spec-triage apply item ${i}.target`);
    }
    if (!SPEC_REPAIR_DECISIONS.has(item.decision)) {
      issues.push(`${prefix}.decision must be one of ${Array.from(SPEC_REPAIR_DECISIONS).join(", ")}`);
    }
    if (typeof item.rationale !== "string" || item.rationale.trim() === "") {
      issues.push(`${prefix}.rationale must be non-empty`);
    }
    if (typeof item.evidence !== "string" || item.evidence.trim() === "") {
      issues.push(`${prefix}.evidence must be non-empty`);
    }
    if (!Array.isArray(item.changedFields)) {
      issues.push(`${prefix}.changedFields must be an array`);
    } else if (item.decision === "applied" && item.changedFields.length === 0) {
      issues.push(`${prefix}.changedFields must be non-empty when decision is applied`);
    }
  }

  return issues;
}

/**
 * Compute the deepest parent-chain length in a task forest.
 * Returns 0 for a flat (all parent=null) list. Bounded by tasks.length to
 * guard against cycles (schema prevents cycles but defensive).
 *
 * @param {Array<{id: string, parent?: string|null}>} tasks
 * @returns {number}
 */
function computeForestDepth(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let maxDepth = 0;
  for (const t of tasks) {
    let depth = 0;
    let cur = t;
    const maxHops = tasks.length;
    while (cur && cur.parent != null && byId.has(cur.parent) && depth <= maxHops) {
      cur = byId.get(cur.parent);
      depth++;
    }
    if (depth > maxDepth) maxDepth = depth;
  }
  return maxDepth;
}

/**
 * Recursively visit every string value in a JSON-like tree, invoking the
 * callback with (value, dotted-path). Bounded by spec.schema.json's
 * maxItems / maxLength constraints (spec 218).
 */
function walkStrings(node, path, fn) {
  if (typeof node === "string") {
    fn(node, path || "<root>");
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      walkStrings(node[i], `${path}[${i}]`, fn);
    }
    return;
  }
  if (node && typeof node === "object") {
    for (const key of Object.keys(node)) {
      const next = path ? `${path}.${key}` : key;
      walkStrings(node[key], next, fn);
    }
  }
}

// ---------------------------------------------------------------------------
// JSON checks — draft (spec 229: draft.md → draft.json)
// ---------------------------------------------------------------------------

function checkDraftJson(draft) {
  return validateDraftLifecycle(draft);
}

const DRAFT_REVIEW_CLASSIFICATION_BY_ARRAY = Object.freeze({
  blockingFindings: "blocking",
  advisoryFindings: "advisory",
  repairTargets: "repair_target",
});

const ALLOWED_DRAFT_TRIAGE_DECISIONS = new Set([
  "apply",
  "invalid",
  "already_resolved",
  "downgraded_to_non_blocking",
  "requires_user_decision",
]);
const DRAFT_REVIEW_ITEM_FIELDS = Object.freeze(["title", "target", "rationale", "evidence"]);
const DRAFT_TRIAGE_ITEM_FIELDS = Object.freeze(["title", "target", "decision", "rationale", "evidence"]);
const DRAFT_REPAIR_ITEM_FIELDS = Object.freeze(["title", "target", "rationale", "evidence"]);
const MAX_DRAFT_CHANGED_FIELD_PATHS = 20;
const MAX_DRAFT_REVIEW_ARTIFACT_BYTES = 1024 * 1024;
const MAX_DRAFT_REVIEW_ROUTES_TO_VALIDATE = 8;

function draftFindingTitleTargetKey(item) {
  return [item?.title || "", item?.target || ""].join("\0");
}

function readDraftArtifact(specDir, filename) {
  try {
    const filePath = path.join(specDir, filename);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > MAX_DRAFT_REVIEW_ARTIFACT_BYTES) {
      const err = new Error(`artifact exceeds ${MAX_DRAFT_REVIEW_ARTIFACT_BYTES} bytes`);
      err.code = "DRAFT_ARTIFACT_TOO_LARGE";
      throw err;
    }
    return readJsonIfExists(filePath);
  } catch (err) {
    err.artifactName = filename;
    throw err;
  }
}

function validateArtifactObject(issues, artifactName, artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    issues.push(`${artifactName}: artifact must be an object`);
    return false;
  }
  return true;
}

function validateRequiredString(issues, label, value) {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(`${label} must be non-empty`);
  }
}

function validateRequiredStringFields(issues, prefix, item, fields) {
  for (const field of fields) {
    validateRequiredString(issues, `${prefix}.${field}`, item?.[field]);
  }
}

function validateDraftReviewArtifact(issues, artifactSet, review) {
  if (!validateArtifactObject(issues, artifactSet.reviewArtifact, review)) return;
  for (const field of ["version", "phase", "sourceDraft", "generatedAt", "verdict", "summary", "blockingFindings", "advisoryFindings", "repairTargets"]) {
    if (!(field in review)) issues.push(`${artifactSet.reviewArtifact}: missing field ${field}`);
  }
  if (review.version !== 1) issues.push(`${artifactSet.reviewArtifact}: version must be 1`);
  if (review.phase !== artifactSet.reviewStepId) issues.push(`${artifactSet.reviewArtifact}: phase must be ${artifactSet.reviewStepId}`);
  if (review.sourceDraft !== "draft.json") issues.push(`${artifactSet.reviewArtifact}: sourceDraft must be draft.json`);
  validateRequiredString(issues, `${artifactSet.reviewArtifact}: generatedAt`, review.generatedAt);
  validateRequiredString(issues, `${artifactSet.reviewArtifact}: summary`, review.summary);
  if (!["PASS", "ADVISORY", "FAIL"].includes(review.verdict)) issues.push(`${artifactSet.reviewArtifact}: verdict must be PASS, ADVISORY, or FAIL`);
  for (const [arrayField, classification] of Object.entries(DRAFT_REVIEW_CLASSIFICATION_BY_ARRAY)) {
    const items = review[arrayField];
    if (!Array.isArray(items)) {
      issues.push(`${artifactSet.reviewArtifact}: ${arrayField} must be an array`);
      continue;
    }
    if (items.length > DRAFT_REVIEW_ARTIFACT_LIMIT) {
      issues.push(`${artifactSet.reviewArtifact}: ${arrayField} must contain at most ${DRAFT_REVIEW_ARTIFACT_LIMIT} items`);
    }
    const boundedItems = items.slice(0, DRAFT_REVIEW_ARTIFACT_LIMIT);
    for (let i = 0; i < boundedItems.length; i++) {
      const item = boundedItems[i];
      const prefix = `${artifactSet.reviewArtifact}: ${arrayField}[${i}]`;
      validateRequiredStringFields(issues, prefix, item, DRAFT_REVIEW_ITEM_FIELDS);
      if (item?.classification !== classification) {
        issues.push(`${prefix}.classification must be ${classification}`);
      }
    }
  }
  const blockingCount = Array.isArray(review.blockingFindings) ? review.blockingFindings.length : 0;
  const advisoryCount = Array.isArray(review.advisoryFindings) ? review.advisoryFindings.length : 0;
  const repairTargetCount = Array.isArray(review.repairTargets) ? review.repairTargets.length : 0;
  if (review.verdict === "PASS" && blockingCount + advisoryCount + repairTargetCount > 0) {
    issues.push(`${artifactSet.reviewArtifact}: PASS cannot include findings`);
  }
  if (review.verdict === "ADVISORY" && blockingCount > 0) {
    issues.push(`${artifactSet.reviewArtifact}: ADVISORY cannot include blocking findings`);
  }
  if (review.verdict === "ADVISORY" && advisoryCount + repairTargetCount === 0) {
    issues.push(`${artifactSet.reviewArtifact}: ADVISORY requires advisory findings or repair targets`);
  }
  if (review.verdict === "FAIL" && blockingCount === 0) {
    issues.push(`${artifactSet.reviewArtifact}: FAIL requires at least one blocking finding`);
  }
}

function validateDraftTriageArtifact(issues, artifactSet, review, triage) {
  if (!validateArtifactObject(issues, artifactSet.triageArtifact, triage)) return [];
  if (triage.version !== 1) issues.push(`${artifactSet.triageArtifact}: version must be 1`);
  if (triage.phase !== artifactSet.triageStepId) issues.push(`${artifactSet.triageArtifact}: phase must be ${artifactSet.triageStepId}`);
  if (triage.sourceReview !== artifactSet.reviewArtifact) issues.push(`${artifactSet.triageArtifact}: sourceReview must be ${artifactSet.reviewArtifact}`);
  validateRequiredString(issues, `${artifactSet.triageArtifact}: summary`, triage.summary);
  if (!Array.isArray(triage.items)) {
    issues.push(`${artifactSet.triageArtifact}: items must be an array`);
    return [];
  }
  if (triage.items.length > DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT) {
    issues.push(`${artifactSet.triageArtifact}: items must contain at most ${DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT} items`);
  }
  const triageItems = triage.items.slice(0, DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT);

  const requiredItems = [
    ...(Array.isArray(review.blockingFindings) ? review.blockingFindings.slice(0, DRAFT_REVIEW_ARTIFACT_LIMIT) : []),
    ...(Array.isArray(review.repairTargets) ? review.repairTargets.slice(0, DRAFT_REVIEW_ARTIFACT_LIMIT) : []),
  ];
  const requiredCounts = new Map();
  const requiredItemsByKey = new Map();
  for (const item of requiredItems) {
    const key = draftFindingTitleTargetKey(item);
    requiredCounts.set(key, (requiredCounts.get(key) || 0) + 1);
    if (!requiredItemsByKey.has(key)) requiredItemsByKey.set(key, item);
  }
  const triageCounts = new Map();
  for (let i = 0; i < triageItems.length; i++) {
    const item = triageItems[i];
    const prefix = `${artifactSet.triageArtifact}: items[${i}]`;
    const key = draftFindingTitleTargetKey(item);
    const seenCount = (triageCounts.get(key) || 0) + 1;
    triageCounts.set(key, seenCount);
    const requiredCount = requiredCounts.get(key) || 0;
    if (requiredCount === 0) {
      issues.push(`${prefix} must match a blocking finding or repair target from ${artifactSet.reviewArtifact}`);
    } else if (seenCount > requiredCount) {
      issues.push(`${prefix} exceeds matching source review item count`);
    }
    validateRequiredStringFields(issues, prefix, item, DRAFT_TRIAGE_ITEM_FIELDS);
    if (!ALLOWED_DRAFT_TRIAGE_DECISIONS.has(item?.decision)) issues.push(`${prefix}.decision is invalid`);
    if (item?.decision === "requires_user_decision") issues.push(`${prefix}.decision requires user decision`);
  }
  for (const [key, requiredCount] of requiredCounts) {
    const triageCount = triageCounts.get(key) || 0;
    if (triageCount < requiredCount) {
      const item = requiredItemsByKey.get(key);
      issues.push(`${artifactSet.triageArtifact}: missing item for ${item.title}`);
    }
  }
  return triageItems;
}

function validateDraftRepairArtifact(issues, artifactSet, triageItems, repair) {
  if (!validateArtifactObject(issues, artifactSet.repairArtifact, repair)) return;
  if (repair.version !== 1) issues.push(`${artifactSet.repairArtifact}: version must be 1`);
  if (repair.phase !== artifactSet.repairStepId) issues.push(`${artifactSet.repairArtifact}: phase must be ${artifactSet.repairStepId}`);
  if (repair.sourceTriage !== artifactSet.triageArtifact) issues.push(`${artifactSet.repairArtifact}: sourceTriage must be ${artifactSet.triageArtifact}`);
  validateRequiredString(issues, `${artifactSet.repairArtifact}: summary`, repair.summary);
  if (!Array.isArray(repair.items)) {
    issues.push(`${artifactSet.repairArtifact}: items must be an array`);
    return;
  }
  if (repair.items.length > DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT) {
    issues.push(`${artifactSet.repairArtifact}: items must contain at most ${DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT} items`);
  }
  const repairItems = repair.items.slice(0, DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT);
  const applyItems = triageItems.filter((item) => item?.decision === "apply");
  const applyCounts = new Map();
  const applyItemsByKey = new Map();
  for (const item of applyItems) {
    const key = draftFindingTitleTargetKey(item);
    applyCounts.set(key, (applyCounts.get(key) || 0) + 1);
    if (!applyItemsByKey.has(key)) applyItemsByKey.set(key, item);
  }
  if (repairItems.length !== applyItems.length) {
    issues.push(`${artifactSet.repairArtifact}: items length must match apply triage items length`);
  }
  const repairCounts = new Map();
  for (let i = 0; i < repairItems.length; i++) {
    const item = repairItems[i];
    const prefix = `${artifactSet.repairArtifact}: items[${i}]`;
    const key = draftFindingTitleTargetKey(item);
    const seenCount = (repairCounts.get(key) || 0) + 1;
    repairCounts.set(key, seenCount);
    validateRequiredStringFields(issues, prefix, item, DRAFT_REPAIR_ITEM_FIELDS);
    const applyCount = applyCounts.get(key) || 0;
    if (applyCount === 0) {
      issues.push(`${prefix} must match an apply triage item`);
    } else if (seenCount > applyCount) {
      issues.push(`${prefix} exceeds matching apply triage item count`);
    }
    if (!Array.isArray(item?.changedFieldPaths)) {
      issues.push(`${prefix}.changedFieldPaths must be an array`);
    } else if (item.changedFieldPaths.length > MAX_DRAFT_CHANGED_FIELD_PATHS) {
      issues.push(`${prefix}.changedFieldPaths must contain at most ${MAX_DRAFT_CHANGED_FIELD_PATHS} items`);
    } else {
      for (let j = 0; j < item.changedFieldPaths.length; j += 1) {
        validateRequiredString(issues, `${prefix}.changedFieldPaths[${j}]`, item.changedFieldPaths[j]);
      }
    }
  }
  for (const [key, applyCount] of applyCounts) {
    const repairCount = repairCounts.get(key) || 0;
    if (repairCount < applyCount) {
      const item = applyItemsByKey.get(key);
      issues.push(`${artifactSet.repairArtifact}: missing item for apply triage ${item.title}`);
    }
  }
}

function validateDraftReviewArtifactSet(specDir, artifactSet) {
  const issues = [];
  const review = readDraftArtifact(specDir, artifactSet.reviewArtifact);
  if (!review) return { issues: [`${artifactSet.reviewArtifact}: missing draft review artifact`], triage: null };
  validateDraftReviewArtifact(issues, artifactSet, review);

  const triage = readDraftArtifact(specDir, artifactSet.triageArtifact);
  if (!triage) {
    issues.push(`${artifactSet.triageArtifact}: missing draft triage artifact`);
    return { issues, triage: null };
  }
  const triageItems = validateDraftTriageArtifact(issues, artifactSet, review, triage);

  const repair = readDraftArtifact(specDir, artifactSet.repairArtifact);
  if (!repair) {
    issues.push(`${artifactSet.repairArtifact}: missing draft repair artifact`);
    return { issues, triage };
  }
  validateDraftRepairArtifact(issues, artifactSet, triageItems, repair);
  return { issues, triage };
}

function draftReviewRouteSetsForValidation() {
  if (DRAFT_REVIEW_ROUTES.length > MAX_DRAFT_REVIEW_ROUTES_TO_VALIDATE) {
    throw new Error(`draft review route count exceeds ${MAX_DRAFT_REVIEW_ROUTES_TO_VALIDATE}`);
  }
  return DRAFT_REVIEW_ROUTES.slice(0, MAX_DRAFT_REVIEW_ROUTES_TO_VALIDATE);
}

function validateDraftReviewArtifacts(root, specPath, draft) {
  const specDir = path.dirname(path.resolve(root, specPath));
  const issues = [];
  let coverageRequiresUserDecision = false;
  for (const artifactSet of draftReviewRouteSetsForValidation()) {
    try {
      const result = validateDraftReviewArtifactSet(specDir, artifactSet);
      issues.push(...result.issues);
      if (artifactSet.key === "coverage" && Array.isArray(result.triage?.items)) {
        coverageRequiresUserDecision = result.triage.items
          .slice(0, DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT)
          .some((item) => item?.decision === "requires_user_decision");
      }
    } catch (err) {
      const artifactName = err.artifactName || artifactSet.reviewArtifact;
      const detail = err.code === "DRAFT_ARTIFACT_TOO_LARGE"
        ? err.message
        : `invalid JSON: ${err.message}`;
      issues.push(`${artifactName}: ${detail}`);
    }
  }
  if (!coverageRequiresUserDecision && draft?.approval?.approved !== true) {
    issues.push("draft-review: draft approval.approved must be true after coverage repair when no user decision is unresolved");
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Guardrail AI prompt (structured JSON schema)
// ---------------------------------------------------------------------------

export const IMPL_DIFF_SCOPE_LINES = [
  "## Diff Scope Constraint",
  "The content includes a `## Git Diff` section. Restrict violation judgment to code changes",
  "actually introduced by this diff — that is, lines added or modified (lines starting with `+`",
  "in the diff). Context lines (unchanged, pre-existing code shown without `+`/`-` markers, or",
  "removed-only `-` lines that are not being replaced) MUST NOT be counted as violations of any",
  "guardrail. If a pattern that appears to violate a guardrail exists only in pre-existing,",
  "unchanged code, mark the article as pass with a reason stating the violation is out of diff scope.",
  "",
];

// Phases where diff-scope constraint applies (task-impl and integration both operate on git diff).
const DIFF_SCOPED_PHASES = Object.freeze(["task-impl", "integration"]);

/**
 * Build AI prompt for structured guardrail-article evaluation.
 *
 * Accepts ALL guardrails and filters them internally by phase. When a caller
 * has already filtered, use {@link buildGuardrailArticleEvalPrompt} instead
 * to avoid re-filtering.
 *
 * @param {string} targetText - text to evaluate
 * @param {Array} guardrails - guardrails (unfiltered)
 * @param {string} phase - gate phase
 * @param {string} [role] - checker role override
 * @param {string[]} [previouslyPassedIds] - guardrail IDs that passed in previous evaluation
 * @returns {string|null} prompt, or null if no guardrails match phase
 */
function buildGuardrailPrompt(targetText, guardrails, phase, role, previouslyPassedIds, options = {}) {
  const filtered = filterByPhase(guardrails, phase);
  const pb = buildGuardrailArticleEvalPrompt(
    targetText,
    filtered,
    phase,
    role,
    previouslyPassedIds,
    options,
  );
  if (!pb) return null;
  const built = pb.build();
  const parts = [];
  if (built.systemPrompt) parts.push(built.systemPrompt);
  if (built.fmtFallback) parts.push(built.fmtFallback);
  if (built.userPrompt) parts.push(built.userPrompt);
  return parts.join("\n\n");
}

/**
 * Variant of {@link buildGuardrailPrompt} that takes pre-filtered guardrails.
 * Used by internal callers (e.g. {@link checkGuardrail}) that have already
 * filtered by phase and want to avoid the redundant pass.
 *
 * @param {string[]} [previouslyPassedIds] - guardrail IDs that passed in a prior evaluation (spec 229)
 */
// spec 255 R1: split the shared GUARDRAIL_EVAL_SCHEMA into two distinct schemas.
// Article evaluation: per-FAIL violations[] structured enumeration with target/where/why_violates.
// Implementation requirement check: unchanged single-reason shape.
export const GUARDRAIL_ARTICLE_EVAL_SCHEMA = {
  type: "object",
  properties: {
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          failureMode: { type: "string", enum: ["guardrail-violation"] },
          requirementRef: { type: "string" },
          where: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                properties: {
                  file: { type: "string" },
                  locator: { type: "string" },
                },
                required: ["file"],
                additionalProperties: false,
              },
            ],
          },
          observed: { type: "string" },
        },
        required: ["failureMode", "requirementRef", "where", "observed"],
        additionalProperties: false,
      },
    },
  },
  required: ["observations"],
  additionalProperties: false,
};

export const IMPL_REQUIREMENT_EVAL_SCHEMA = {
  type: "object",
  properties: {
    evaluations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          guardrail_id: { type: "string" },
          result: { type: "string", enum: ["pass", "fail", "skip"] },
          reason: { type: "string" },
        },
        required: ["guardrail_id", "result", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["evaluations"],
  additionalProperties: false,
};

export const GUARDRAIL_FMT_FALLBACK = [
  "OUTPUT FORMAT — strictly required:",
  "Return a single JSON object matching this shape:",
  '  {"observations":[{"failureMode":"guardrail-violation","requirementRef":"<guardrail id>","where":{"file":"<path or artifact>","locator":"<optional locator>"},"observed":"<concrete violation>"}]}',
  "  - Include one observation per concrete FAIL occurrence/edit location.",
  "  - If every listed guardrail passes, return {\"observations\":[]}.",
  "Output MUST be valid JSON. No preamble, no trailing commentary, no Markdown prose — JSON only.",
].join("\n");

const IMPL_REQUIREMENT_FMT_FALLBACK = [
  "OUTPUT FORMAT — strictly required:",
  "Return a single JSON object matching this shape:",
  '  {"evaluations":[{"guardrail_id":"<id>","result":"pass"|"fail"|"skip","reason":"<brief>"}]}',
  "Output MUST be valid JSON. No preamble, no trailing commentary, no Markdown prose — JSON only.",
].join("\n");

// spec 255 R6: rename buildGuardrailPromptFromFiltered to buildGuardrailArticleEvalPrompt
// and add exhaustive-enumeration directive in the rules text.
export function buildGuardrailArticleEvalPrompt(targetText, filtered, phase, role, previouslyPassedIds, options = {}) {
  if (filtered.length === 0) return null;

  const articleList = filtered
    .map((g) => `- id: ${g.id}\n  title: ${g.title}\n  body: ${g.body.trim()}`)
    .join("\n");

  const checkerRole = role || `You are a ${phase} compliance checker.`;

  const pb = new PromptBuilder();
  pb.setRole(`${checkerRole} Check the following content against each guardrail article.`);

  const rules = [
    "- Evaluate every guardrail article listed below, identified by its id.",
    "- Evaluate only explicit requirements stated in the listed guardrail article body. Do not invent additional design, codebase-context, or completeness criteria.",
    "- This is a readiness gate, not a design review. Do not search for new implementation-target gaps, existing-behavior gaps, integration choices, or product-scope issues unless the guardrail article explicitly requires that check.",
    "- If a concern is not directly grounded in a listed guardrail article, it must not be reported as a FAIL here.",
    "- Return `observations` only. Do not return `evaluations`, `result`, `reason`, `violations`, `kind`, `severity`, or `refs`.",
    "- Exhaustive enumeration: emit ONE observation per occurrence/edit location. Repeated occurrences of the same vague phrase in different places are distinct entries — distinguishable by `where`. Do NOT group or summarize.",
    "- For document-level guardrails (rule violations that have no concrete passage to quote — e.g. a missing required section): emit one OR MORE observations, one per distinct gap. Use `where.file` as the artifact name (e.g. \"spec.json\").",
    "- When a diff-scope section is present below, list ONLY violations introduced by the diff (lines added or modified, marked with `+`).",
    "- Omit observations for passing, skipped, inapplicable, or runtime-dependent guardrails.",
    "- Matched Spec Acknowledgment Rationale is context only. Exception permission comes from the guardrail article clause, not from the rationale section alone.",
    "- To acknowledge a guardrail exception in a spec, write the target guardrail_id directly in constraints, clarifications, or alternatives_considered.",
    "- For each FAIL, describe the actionable Observation using these AI-owned fields: failureMode, requirementRef, where, observed. The system derives kind, severity, and refs.",
  ].join("\n");
  pb.setRules(rules);
  pb.setJsonSchema(GUARDRAIL_ARTICLE_EVAL_SCHEMA);
  pb.setFmtFallback(GUARDRAIL_FMT_FALLBACK);

  if (Array.isArray(previouslyPassedIds) && previouslyPassedIds.length > 0) {
    pb.addUserPrompt(
      "## Previously Passed Guardrails",
      "The following guardrail IDs passed in a previous evaluation of this content.\n"
        + "Only FAIL these if the current content specifically introduces a new violation.\n"
        + "IDs: " + previouslyPassedIds.join(", "),
    );
  }

  if (DIFF_SCOPED_PHASES.includes(phase)) {
    pb.addUserPrompt("## Diff Scope Constraint", IMPL_DIFF_SCOPE_LINES.slice(1).join("\n"));
  }

  pb.addUserPrompt(
    "## Observation Output Fields",
    "For each FAIL, emit only these AI-owned Observation fields: failureMode, requirementRef, where, observed.",
  );

  pb.addUserPrompt("## Guardrail Articles", articleList);
  if (options?.acknowledgedRationale?.markdown) {
    pb.addUserRaw(options.acknowledgedRationale.markdown);
  }
  if (options?.priorMemoryMarkdown) {
    pb.addUserRaw(options.priorMemoryMarkdown);
  }
  pb.addUserPrompt("## Content", targetText);

  return pb;
}

// ---------------------------------------------------------------------------
// Structured evaluation parser (REQ-5/6/7)
// ---------------------------------------------------------------------------

export class EvaluationSchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = "EvaluationSchemaError";
    this.code = "EVALUATION_SCHEMA_ERROR";
  }
}

const ALLOWED_RESULT_VALUES = Object.freeze(["pass", "fail", "skip"]);

/**
 * Strip common wrappers (code fences, leading/trailing noise) and extract
 * a candidate JSON string. Does NOT attempt to guess — if no JSON-like object
 * is detectable, returns the original text so JSON.parse can surface a clear error.
 */
function extractJsonCandidate(raw) {
  let text = String(raw).trim();
  // Strip ``` or ```json fences
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) text = fenceMatch[1].trim();
  // Trim to first { ... last }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

// spec 255 R2/R3/R4/R19/R20: split parseEvaluationResponse into two parsers.
//   parseGuardrailArticleEvaluation: enforces FAIL→violations[] / PASS|SKIP→reason,
//     derives reason summary on FAIL, rejects unknown / duplicate / missing ids and extra keys.
//   parseImplRequirementEvaluation: preserves the legacy single-reason contract verbatim.

const ARTICLE_ENTRY_KEYS = new Set(["guardrail_id", "result", "reason", "violations"]);
const REQUIREMENT_ENTRY_KEYS = new Set(["guardrail_id", "result", "reason"]);
const VIOLATION_KEYS = new Set(["target", "where", "why_violates"]);
const AI_OBSERVATION_KEYS = new Set(["failureMode", "requirementRef", "where", "observed"]);

function parseEvaluationsArray(rawResponse) {
  const candidate = extractJsonCandidate(rawResponse);
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    throw new EvaluationSchemaError(
      `AI evaluation response is not valid JSON: ${err.message}`,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new EvaluationSchemaError("AI evaluation response is not a JSON object");
  }
  if (!Array.isArray(parsed.evaluations)) {
    throw new EvaluationSchemaError(
      'AI evaluation response missing "evaluations" array',
    );
  }
  return parsed.evaluations;
}

function parseJsonObject(rawResponse) {
  const candidate = extractJsonCandidate(rawResponse);
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    throw new EvaluationSchemaError(`AI evaluation response is not valid JSON: ${err.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new EvaluationSchemaError("AI evaluation response is not a JSON object");
  }
  return parsed;
}

function checkExtraKeys(entry, idx, allowed, label) {
  for (const k of Object.keys(entry)) {
    if (!allowed.has(k)) {
      throw new EvaluationSchemaError(
        `${label}[${idx}]: unknown property "${k}"`,
      );
    }
  }
}

function deriveArticleFailReason(violations) {
  return violations
    .map((v) => `${v.target} — ${v.why_violates} (at ${v.where})`)
    .join("; ");
}

function buildPassEvaluationsForObservedGuardrails(guardrails) {
  return guardrails.map((guardrail) => ({
    guardrail_id: guardrail.id,
    result: "pass",
    reason: "no observations emitted",
    category: guardrail.meta.category || "guardrail",
    title: guardrail.title || guardrail.id,
    observations: [],
  }));
}

/**
 * Parse the structured AI guardrail-article evaluation response (spec 255).
 *
 * @param {string} rawResponse
 * @param {string[]} knownIds
 * @returns {Array<Object>} Observation JSON entries
 * @throws {EvaluationSchemaError}
 */
export function parseGuardrailArticleEvaluation(rawResponse, knownIds) {
  const rawObject = parseJsonObject(rawResponse);
  if (Array.isArray(rawObject.observations)) {
    const known = new Set(knownIds);
    return rawObject.observations.map((entry, idx) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new EvaluationSchemaError(`observations[${idx}] is not an object`);
      }
      checkExtraKeys(entry, idx, AI_OBSERVATION_KEYS, "observations");
      for (const key of AI_OBSERVATION_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(entry, key)) {
          throw new EvaluationSchemaError(`observations[${idx}]: missing required "${key}"`);
        }
      }
      if (!known.has(entry.requirementRef)) {
        throw new EvaluationSchemaError(`observations[${idx}]: unknown requirementRef "${entry.requirementRef}"`);
      }
      return new Observation({
        kind: "violation",
        failureMode: entry.failureMode,
        requirementRef: entry.requirementRef,
        where: entry.where ?? null,
        observed: entry.observed,
        severity: "blocking",
        refs: [entry.requirementRef],
      }).toJSON();
    });
  }
  if (!Array.isArray(rawObject.evaluations)) {
    throw new EvaluationSchemaError('AI evaluation response missing "evaluations" or "observations" array');
  }
  const evaluations = rawObject.evaluations;
  const known = new Set(knownIds);
  const seen = new Set();
  const results = [];
  for (const [idx, entry] of evaluations.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new EvaluationSchemaError(`evaluations[${idx}] is not an object`);
    }
    checkExtraKeys(entry, idx, ARTICLE_ENTRY_KEYS, "evaluations");

    const { guardrail_id, result } = entry;
    if (typeof guardrail_id !== "string" || !guardrail_id) {
      throw new EvaluationSchemaError(
        `evaluations[${idx}]: guardrail_id must be a non-empty string`,
      );
    }
    if (!known.has(guardrail_id)) {
      throw new EvaluationSchemaError(
        `evaluations[${idx}]: unknown guardrail_id "${guardrail_id}"`,
      );
    }
    if (seen.has(guardrail_id)) {
      throw new EvaluationSchemaError(
        `evaluations[${idx}]: duplicate guardrail_id "${guardrail_id}"`,
      );
    }
    seen.add(guardrail_id);
    if (!ALLOWED_RESULT_VALUES.includes(result)) {
      throw new EvaluationSchemaError(
        `evaluations[${idx}]: result must be one of pass|fail|skip (got "${result}")`,
      );
    }

    if (result === "fail") {
      if (!Array.isArray(entry.violations) || entry.violations.length === 0) {
        throw new EvaluationSchemaError(
          `evaluations[${idx}]: FAIL requires non-empty violations[]`,
        );
      }
      const violationKey = new Set();
      const violations = [];
      for (const [vIdx, v] of entry.violations.entries()) {
        if (!v || typeof v !== "object" || Array.isArray(v)) {
          throw new EvaluationSchemaError(
            `evaluations[${idx}].violations[${vIdx}] is not an object`,
          );
        }
        checkExtraKeys(v, vIdx, VIOLATION_KEYS, `evaluations[${idx}].violations`);
        for (const field of ["target", "where", "why_violates"]) {
          if (typeof v[field] !== "string" || !v[field].trim()) {
            throw new EvaluationSchemaError(
              `evaluations[${idx}].violations[${vIdx}]: ${field} must be a non-empty string`,
            );
          }
        }
        const key = `${v.target.trim()}|${v.where.trim()}`;
        if (violationKey.has(key)) {
          throw new EvaluationSchemaError(
            `evaluations[${idx}].violations[${vIdx}]: duplicate (target, where) pair "${key}"`,
          );
        }
        violationKey.add(key);
        violations.push({
          target: v.target.trim(),
          where: v.where.trim(),
          why_violates: v.why_violates.trim(),
        });
      }
      results.push({
        guardrail_id,
        result,
        reason: deriveArticleFailReason(violations),
        violations,
      });
    } else {
      // pass / skip
      if (entry.violations !== undefined) {
        throw new EvaluationSchemaError(
          `evaluations[${idx}]: ${result.toUpperCase()} entry must not include violations`,
        );
      }
      const reason = entry.reason;
      if (typeof reason !== "string" || !reason.trim()) {
        throw new EvaluationSchemaError(
          `evaluations[${idx}]: ${result.toUpperCase()} entry requires a non-empty reason`,
        );
      }
      results.push({ guardrail_id, result, reason: reason.trim() });
    }
  }
  const missing = knownIds.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw new EvaluationSchemaError(
      `evaluations missing for guardrail_id(s): ${missing.join(", ")}`,
    );
  }
  return legacyEvaluationsToNextAction({
    evaluations: results,
    prescription: "gate",
  }).diagnosis.observations.map((observation) => observation.toJSON());
}

/**
 * Parse the structured AI implementation-requirement evaluation response (spec 255).
 * Preserves the legacy single-reason contract verbatim.
 *
 * @param {string} rawResponse
 * @param {string[]} knownIds
 * @returns {Array<{guardrail_id: string, result: string, reason: string}>}
 * @throws {EvaluationSchemaError}
 */
export function parseImplRequirementEvaluation(rawResponse, knownIds) {
  const evaluations = parseEvaluationsArray(rawResponse);
  const known = new Set(knownIds);
  const seen = new Set();
  const results = [];
  for (const [idx, entry] of evaluations.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new EvaluationSchemaError(`evaluations[${idx}] is not an object`);
    }
    checkExtraKeys(entry, idx, REQUIREMENT_ENTRY_KEYS, "evaluations");

    const { guardrail_id, result, reason } = entry;
    if (typeof guardrail_id !== "string" || !guardrail_id) {
      throw new EvaluationSchemaError(
        `evaluations[${idx}]: guardrail_id must be a non-empty string`,
      );
    }
    if (!known.has(guardrail_id)) {
      throw new EvaluationSchemaError(
        `evaluations[${idx}]: unknown guardrail_id "${guardrail_id}"`,
      );
    }
    if (seen.has(guardrail_id)) {
      throw new EvaluationSchemaError(
        `evaluations[${idx}]: duplicate guardrail_id "${guardrail_id}"`,
      );
    }
    seen.add(guardrail_id);
    if (!ALLOWED_RESULT_VALUES.includes(result)) {
      throw new EvaluationSchemaError(
        `evaluations[${idx}]: result must be one of pass|fail|skip (got "${result}")`,
      );
    }
    if (typeof reason !== "string" || !reason.trim()) {
      throw new EvaluationSchemaError(
        `evaluations[${idx}]: reason must be a non-empty string`,
      );
    }
    results.push({ guardrail_id, result, reason: reason.trim() });
  }
  const missing = knownIds.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw new EvaluationSchemaError(
      `evaluations missing for guardrail_id(s): ${missing.join(", ")}`,
    );
  }
  return results;
}

// ---------------------------------------------------------------------------
// Gate report builder (REQ-8)
// ---------------------------------------------------------------------------

/**
 * Build a structured gate report. Throws if any required field is missing
 * or malformed — callers must pass a complete input.
 */
export function buildGateReport({ level, phase, evaluations }) {
  if (!level) throw new Error("buildGateReport: level is required");
  if (!phase) throw new Error("buildGateReport: phase is required");
  validateLevelPhase(level, phase);
  if (arguments[0]?.observations !== undefined) {
    const input = arguments[0];
    const observations = normalizeObservations(input.observations || []);
    const hasBlocking = observations.some((observation) => observation.severity === "blocking");
    const verdict = hasBlocking ? "fail" : "pass";
    const prescription = verdict === "fail" ? input.failPrescription : input.passPrescription;
    return {
      level,
      phase,
      verdict,
      nextAction: new NextAction({
        diagnosis: new Diagnosis({
          summary: observations.length === 0
            ? "No observations."
            : `${observations.length} observation(s).`,
          observations,
        }),
        prescription,
      }).toJSON(),
    };
  }
  if (!Array.isArray(evaluations)) {
    throw new Error("buildGateReport: evaluations array is required");
  }
  for (const [idx, ev] of evaluations.entries()) {
    if (!ev.guardrail_id) {
      throw new Error(`buildGateReport: evaluations[${idx}].guardrail_id is required`);
    }
    if (!ALLOWED_RESULT_VALUES.includes(ev.result)) {
      throw new Error(
        `buildGateReport: evaluations[${idx}].result must be one of pass|fail|skip`,
      );
    }
    if (typeof ev.reason !== "string" || !ev.reason) {
      throw new Error(`buildGateReport: evaluations[${idx}].reason is required`);
    }
    if (!ev.category) {
      throw new Error(`buildGateReport: evaluations[${idx}].category is required`);
    }
  }
  return { level, phase, evaluations };
}

function normalizeObservations(observations) {
  if (!Array.isArray(observations)) throw new Error("observations must be an array");
  return observations.map((entry) => entry instanceof Observation ? entry : Observation.fromJSON(entry));
}

export function buildGateResultArtifact({
  level,
  phase,
  target,
  verdict,
  observations,
  evaluations,
  passPrescription,
  failPrescription,
}) {
  const report = observations !== undefined
    ? buildGateReport({ level, phase, observations, passPrescription, failPrescription })
    : { nextAction: legacyEvaluationsToNextAction({
        evaluations,
        prescription: verdict === "fail" ? failPrescription : passPrescription,
      }).toJSON() };
  return {
    result: verdict,
    changed: [],
    artifacts: {
      target,
      level,
      phase,
      evaluations: evaluations || [],
      nextAction: report.nextAction,
    },
    next: verdict === "fail" ? FAIL_NEXT[phase] : PASS_NEXT[phase],
  };
}

// ---------------------------------------------------------------------------
// Guardrail AI check — shared
// ---------------------------------------------------------------------------

async function checkGuardrail(root, targetText, phase, role, previouslyPassedIds, options = {}) {
  const guardrails = loadMergedGuardrails(root);
  if (guardrails.length === 0) return null;

  const filtered = filterByPhase(guardrails, phase);
  if (filtered.length === 0) return { passed: true, evaluations: [] };
  const filteredIds = new Set(filtered.map((g) => g.id));
  const promptPreviouslyPassedIds = Array.isArray(previouslyPassedIds)
    ? previouslyPassedIds.filter((id) => filteredIds.has(id))
    : previouslyPassedIds;

  const agent = container.get("agent");
  if (!agent.resolve("flow.spec.gate")) return null;

  const pb = buildGuardrailArticleEvalPrompt(
    targetText,
    filtered,
    phase,
    role,
    promptPreviouslyPassedIds,
    options,
  );
  if (!pb) return { passed: true, evaluations: [] };

  const built = pb.build();
  const knownIds = filtered.map((g) => g.id);
  const { observations: parsed } = await evaluateGuardrailObservationsWithRetry({
    knownIds,
    phase,
    retryContext: options?.retryContext || null,
    callAgent: () => agent.call(built.userPrompt, {
      commandId: "flow.spec.gate",
      systemPrompt: built.systemPrompt,
      jsonSchema: built.jsonSchema,
      fmtFallback: built.fmtFallback,
    }),
  });
  const byId = new Map(filtered.map((g) => [g.id, g]));
  if (parsed.length === 0) {
    return { passed: true, evaluations: buildPassEvaluationsForObservedGuardrails(filtered) };
  }
  if (parsed[0]?.requirementRef) {
    const evaluations = parsed.map((observation) => ({
      guardrail_id: observation.requirementRef,
      result: observation.severity === "blocking" ? "fail" : "pass",
      reason: observation.observed,
      category: byId.get(observation.requirementRef)?.meta.category || "guardrail",
      title: byId.get(observation.requirementRef)?.title || observation.requirementRef,
      observations: [observation],
    }));
    const passed = evaluations.every((e) => e.result === "pass" || e.result === "skip");
    return { passed, evaluations };
  }
  const evaluations = parsed.map((e) => ({
    ...e,
    category: byId.get(e.guardrail_id).meta.category,
    title: byId.get(e.guardrail_id).title,
  }));
  const passed = evaluations.every((e) => e.result === "pass" || e.result === "skip");
  return { passed, evaluations };
}

// ---------------------------------------------------------------------------
// Retry counter & escalation (spec 201, P2-R1〜P2-R4)
// ---------------------------------------------------------------------------

import { resolveMaxAttempts } from "../definition.js";

const RETRY_TRACKED_PHASES = Object.freeze(["draft", "spec", "task-impl", "integration"]);
const GATE_RECOVERY_PHASES = new Set(["task-impl", "integration"]);
const GATE_RECOVERY_TRIGGER_RETRY_EXHAUSTED = "gate-retry-exhausted";
const GATE_RECOVERY_TRIGGER_RESULT_FAIL = "gate-result-fail";

export function resolveRetryMax(retryContext = {}, phase) {
  const stepId = resolveGateStepId(phase);
  const flowState = retryContext.flowState || retryContext;
  const scope = retryContext.scope
    || (flowState?.currentTaskId != null ? "task" : "flow");
  return resolveMaxAttempts({ scope, stepId, context: flowState }) ?? 5;
}

/**
 * Replay a reset-aware `gateRetry` counter for the given phase against the
 * flat append-only metrics entries. PASS writes a `reset: true` entry which
 * zeros the running count; FAIL writes a `delta: 1` entry which increments.
 * Exported for reuse by tests and any other counter consumers.
 *
 * @param {Array<Object>} entries — `state.metrics`
 * @param {string} phase — phase to scope the scan to
 * @returns {number} current post-reset count
 */
export function countGateRetry(entries, phase) {
  if (!Array.isArray(entries)) return 0;
  let count = 0;
  for (const e of entries) {
    if (e.phase !== phase || e.counter !== "gateRetry") continue;
    if (e.reset) count = 0;
    else count += e.delta ?? 1;
  }
  return count;
}

function readGateRetryCount(state, phase) {
  return countGateRetry(state?.metrics, phase);
}

function hasGateRecoveryBaseline(state, phase) {
  if (!Array.isArray(state?.reviewRecoveryBaselines)) return false;
  return state.reviewRecoveryBaselines.some((entry) => (
    entry?.kind === "gate"
    && entry?.canonicalPhase === phase
  ));
}

function persistGateRecoveryBaseline(ctx, phase, trigger, options = {}) {
  if (!GATE_RECOVERY_PHASES.has(phase)) return;
  if (!ctx?.root || typeof ctx?.flowManager?.mutate !== "function") return;
  ctx.flowManager.mutate((state) => {
    if (!state?.spec) return;
    if (options.seedOnly === true && hasGateRecoveryBaseline(state, phase)) return;
    persistCurrentRecoveryBaseline({
      root: ctx.root,
      flowState: state,
      kind: "gate",
      phase,
      trigger,
    });
  });
}

// Set of step ids that represent gate evaluations. After the phase-prefix
// rename every gate step ends in "-gate" (spec-gate, draft-gate, impl-gate,
// task-gate). The explicit set keeps retry-history matching scoped to gates.
const GATE_STEP_IDS = new Set(["spec-gate", "draft-gate", "impl-gate", "task-gate"]);
const GATE_ESCALATION_TRIGGER = "gate onError hook (auto)";

function isRetryHistoryGateEntry(entry, phase) {
  if (!GATE_STEP_IDS.has(String(entry.step || ""))) return false;
  if (entry.phase !== phase) return false;
  if (entry.trigger === GATE_ESCALATION_TRIGGER) return false;
  return true;
}

function formatRetryHistory(root, specPath, limit, phase) {
  let log;
  try {
    log = loadIssueLog(root, specPath);
  } catch (err) {
    process.stderr.write(`[senti] formatRetryHistory: loadIssueLog failed: ${err.message}\n`);
    return "";
  }
  const gateEntries = (log.entries || [])
    .filter((e) => isRetryHistoryGateEntry(e, phase))
    .slice(-limit);
  if (gateEntries.length === 0) return "";
  return gateEntries
    .map((e, i) => `  attempt ${i + 1}: ${e.reason}`)
    .join("\n");
}

export function warnGateRetryBudget(ctx, phase) {
  if (!RETRY_TRACKED_PHASES.includes(phase)) return;
  const used = readGateRetryCount(ctx.flowState, phase);
  const max = resolveRetryMax(ctx, phase);
  const remaining = Math.max(0, max - used);
  process.stderr.write(
    `[senti] gate retry: ${used}/${max} used (${remaining} remaining) [AI-FAIL=${used}] for phase "${phase}"\n`,
  );
}

export function buildGateRetryExhaustedEnvelope({ phase, attempts, max, reason }) {
  const messages = [
    `gate retry limit exhausted: ${attempts}/${max} FAIL attempts recorded for phase "${phase}".`,
    reason || "Stop the automatic retry loop and return control to the user.",
  ];
  return Envelope.fail(
    "run",
    "gate",
    "ESCALATE_RETRY_EXHAUSTED",
    messages,
    { phase, attempts, max },
  );
}

const GATE_COVERAGE_FAILURE_KINDS = new Set([
  "coverage_header_failure",
  "missing_header",
  "uncovered_requirement",
  "unknown_requirement_id",
  "malformed_header",
  "duplicate_requirement_id",
  "duplicate_header",
  "not_testable_in_header",
  "wrong_header_marker",
  "header_without_test_name",
  "test_name_without_header",
]);

function normalizeGateMode(value) {
  return String(value || "").toLowerCase().replace(/[-\s]+/g, "_");
}

function hasStructuredCoverageFailure(finding) {
  return normalizeGateMode(finding?.origin) === "test_coverage"
    || GATE_COVERAGE_FAILURE_KINDS.has(normalizeGateMode(finding?.failureKind))
    || GATE_COVERAGE_FAILURE_KINDS.has(normalizeGateMode(finding?.failureMode));
}

function failedGateFindings(artifact) {
  const blockingFindings = Array.isArray(artifact?.blockingFindings)
    ? artifact.blockingFindings
    : [];
  if (blockingFindings.length > 0) return blockingFindings;
  const evaluations = Array.isArray(artifact?.evaluations)
    ? artifact.evaluations.filter((entry) => entry?.result === "fail")
    : [];
  if (evaluations.length > 0) return evaluations;
  const observations = artifact?.nextAction?.diagnosis?.observations || artifact?.observations || [];
  return Array.isArray(observations)
    ? observations.filter((entry) => entry?.severity === "blocking")
    : [];
}

export function classifyGateRetryExhaustionSource(input = {}) {
  const artifact = input.sourceArtifact || {};
  const merged = { ...artifact, ...input };
  if (merged.flowStateValid === false) return { completionKind: "blocking", deferAllowed: false, reason: "flow_corruption" };
  if (merged.guardCode === "NO_PROGRESS_SINCE_LAST_FAIL") return { completionKind: "blocking", deferAllowed: false, reason: "no_progress_guard" };
  if (merged.toolingFailure) return { completionKind: "blocking", deferAllowed: false, reason: "tooling_failure" };
  if (merged.command && merged.command.exitCode != null && merged.command.exitCode !== 0) return { completionKind: "blocking", deferAllowed: false, reason: "failed_command" };
  if (merged.testEvidence && merged.testEvidence.result === "fail") return { completionKind: "blocking", deferAllowed: false, reason: "failed_test_evidence" };
  if (merged.sourceArtifactStatus === "invalid_schema") return { completionKind: "blocking", deferAllowed: false, reason: "invalid_schema" };
  if (merged.malformedArtifact) return { completionKind: "blocking", deferAllowed: false, reason: "malformed_artifact" };
  if (merged.coverage?.validation?.ok === false) return { completionKind: "blocking", deferAllowed: false, reason: "coverage_header_failure" };
  if (merged.phase === "test" && merged.validation?.ok === false) return { completionKind: "blocking", deferAllowed: false, reason: "coverage_header_failure" };
  const artifactFindings = failedGateFindings(artifact);
  const findings = artifactFindings.length > 0 ? artifactFindings : failedGateFindings(merged);
  if (findings.length === 0) return { completionKind: "blocking", deferAllowed: false, reason: "missing_content_findings" };
  if (findings.some(hasStructuredCoverageFailure)) {
    return { completionKind: "blocking", deferAllowed: false, reason: "coverage_header_failure" };
  }
  return {
    completionKind: "deferred",
    deferAllowed: true,
    reason: "semantic_findings",
  };
}

function gateSourceFindingId(finding, index) {
  return finding?.findingId || finding?.id || `gate-finding-${index + 1}`;
}

function persistGateSourceFindingIds(specDir, sourceArtifact, artifact) {
  const normalized = JSON.parse(JSON.stringify(artifact));
  const findings = failedGateFindings(normalized);
  findings.forEach((finding, index) => {
    if (!finding.findingId && !finding.id) {
      finding.findingId = gateSourceFindingId(finding, index);
    }
  });
  fs.writeFileSync(path.join(specDir, sourceArtifact), JSON.stringify(normalized, null, 2) + "\n");
  return { artifact: normalized, findings };
}

function gateDeferredResult(phase, attempts, findingCount) {
  return {
    result: "deferred",
    changed: ["flow-findings.json"],
    artifacts: {
      phase,
      deferred: true,
      retryExhausted: true,
      attempts,
      findingCount,
      completionKind: "deferred",
    },
    next: null,
  };
}

function writeDurableGateSourceArtifact(specDir, phase, sourceArtifact, artifact) {
  const full = path.join(specDir, sourceArtifact);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify({
    version: 1,
    phase,
    result: artifact.result || artifact.verdict || "fail",
    evaluations: Array.isArray(artifact.evaluations) ? artifact.evaluations : [],
    observations: artifact?.nextAction?.diagnosis?.observations || artifact?.observations || [],
    command: artifact.command,
    testEvidence: artifact.testEvidence,
    toolingFailure: artifact.toolingFailure,
    guardCode: artifact.guardCode,
    sourceArtifactStatus: artifact.sourceArtifactStatus,
    flowStateValid: artifact.flowStateValid,
  }, null, 2) + "\n");
}

function resolveGateSourceForDefer({ root, flowState, phase }) {
  const specDir = specDirFromFlowState(root, flowState);
  const sourceArtifact = GATE_SOURCE_ARTIFACT_BY_PHASE[phase];
  if (!sourceArtifact) return null;
  const resultArtifact = GATE_RESULT_ARTIFACT_BY_PHASE[phase];
  const artifact = resultArtifact ? readBoundedSourceArtifact(specDir, resultArtifact) : null;
  if (artifact) {
    if (!classifyGateRetryExhaustionSource({ sourceArtifact: artifact }).deferAllowed) {
      return { specDir, sourceArtifact: resultArtifact, artifact };
    }
    if (sourceArtifact === resultArtifact) {
      return { specDir, sourceArtifact: resultArtifact, artifact };
    }
    writeDurableGateSourceArtifact(specDir, phase, sourceArtifact, artifact);
    return { specDir, sourceArtifact, artifact: readBoundedSourceArtifact(specDir, sourceArtifact) };
  }
  if (sourceArtifactExists(specDir, sourceArtifact)) {
    const source = readBoundedSourceArtifact(specDir, sourceArtifact);
    return { specDir, sourceArtifact, artifact: source };
  }
  if (resultArtifact) {
    return { specDir, sourceArtifact: resultArtifact, artifact };
  }
  return null;
}

function tryDeferGateRetryExhaustion(ctx, phase, attempts) {
  if (!ctx?.root || !ctx?.flowState?.spec || typeof ctx?.flowManager?.updateStepStatus !== "function") return null;
  const source = resolveGateSourceForDefer({ root: ctx.root, flowState: ctx.flowState, phase });
  if (!source?.artifact) return null;
  const classification = classifyGateRetryExhaustionSource({ sourceArtifact: source.artifact });
  if (!classification.deferAllowed) return null;
  const { findings } = persistGateSourceFindingIds(source.specDir, source.sourceArtifact, source.artifact);
  deferExhaustedSemanticFindings({
    root: ctx.root,
    flowState: ctx.flowState,
    sourceStep: resolveGateStepId(phase),
    sourceArtifact: source.sourceArtifact,
    attempts,
  });
  ctx.flowManager.updateStepStatus(resolveGateStepId(phase), "done");
  return gateDeferredResult(phase, attempts, findings.length);
}

function persistGateSourceFromResult(ctx, result, phase) {
  if (result?.result !== "fail") return;
  if (!ctx?.root || !ctx?.flowState?.spec) return;
  const sourceArtifact = GATE_SOURCE_ARTIFACT_BY_PHASE[phase];
  if (!sourceArtifact || sourceArtifact === IMPL_GATE_RESULT_FILE) return;
  const artifact = {
    phase,
    result: "fail",
    evaluations: result?.artifacts?.evaluations || [],
    observations: result?.artifacts?.nextAction?.diagnosis?.observations || [],
    command: result?.artifacts?.command,
    testEvidence: result?.artifacts?.testEvidence,
    toolingFailure: result?.artifacts?.toolingFailure,
    guardCode: result?.artifacts?.guardCode,
    sourceArtifactStatus: result?.artifacts?.sourceArtifactStatus,
    flowStateValid: result?.artifacts?.flowStateValid,
  };
  const classification = classifyGateRetryExhaustionSource({ sourceArtifact: artifact });
  if (!classification.deferAllowed) return;
  const specDir = specDirFromFlowState(ctx.root, ctx.flowState);
  writeDurableGateSourceArtifact(specDir, phase, sourceArtifact, artifact);
}

/**
 * Returns a failure Envelope when the retry budget for the given phase is
 * exhausted, or null when the command is still allowed to proceed. Callers
 * return the envelope verbatim to short-circuit the command with ok:false.
 * (Spec 213: "judgment-result" exhaustion must not throw.)
 */
export function checkRetryBelowMax(ctx, phase) {
  if (!RETRY_TRACKED_PHASES.includes(phase)) return null;
  const count = readGateRetryCount(ctx.flowState, phase);
  const max = resolveRetryMax(ctx, phase);
  if (count < max) return null;
  const deferred = tryDeferGateRetryExhaustion(ctx, phase, count);
  if (deferred) return deferred;

  const history = formatRetryHistory(ctx.root, ctx.flowState?.spec, max, phase);
  persistGateRecoveryBaseline(ctx, phase, GATE_RECOVERY_TRIGGER_RETRY_EXHAUSTED, { seedOnly: true });
  const messages = [
    `gate retry limit exhausted: ${count}/${max} FAIL attempts recorded for phase "${phase}".`,
    `Counter breakdown: AI-FAIL=${count}`,
    "Previous FAIL reasons:",
    history || "  (no issue-log entries found)",
    "",
    "Stop the automatic retry loop and return control to the user.",
  ];
  appendGateEscalationIssueLog(ctx, phase, messages);
  return Envelope.fail(
    "run",
    "gate",
    "ESCALATE_RETRY_EXHAUSTED",
    messages,
    { phase, attempts: count, max },
  );
}

export async function evaluateGuardrailObservationsWithRetry({
  knownIds,
  maxAttempts = null,
  callAgent,
  phase = "task-impl",
  retryContext = null,
}) {
  let lastError = null;
  const resolvedMax = maxAttempts ?? (
    retryContext ? Math.max(1, resolveRetryMax(retryContext, phase) - readGateRetryCount(retryContext.flowState, phase)) : 2
  );
  for (let attempt = 1; attempt <= resolvedMax; attempt += 1) {
    const raw = await callAgent();
    try {
      const observations = parseGuardrailArticleEvaluation(raw, knownIds);
      return { observations };
    } catch (err) {
      lastError = err;
    }
  }
  const envelope = buildGateRetryExhaustedEnvelope({
    phase,
    attempts: resolvedMax,
    max: resolvedMax,
    reason: "invalid Observation output",
  });
  const err = new Error(lastError?.message || "invalid Observation output");
  err.code = envelope.errors[0].code;
  err.retryExhaustionEnvelope = envelope;
  throw err;
}

/**
 * spec 216: record a gate escalation (retry exhausted / no-progress) in
 * issue-log before its caller returns an `Envelope.fail`. The dispatcher's
 * success path treats an ok:false envelope as `skipPost=true` and never
 * invokes `onError`, so without this call the escalation would not be
 * logged — asymmetric with the throw-based `ESCALATE_REPEATED_FAIL` path.
 *
 * `flowState.metrics` is not touched, so `gateRetry` remains un-incremented.
 *
 * Skipped when no spec is available (unit-level callers without flow state).
 */
function appendGateEscalationIssueLog(ctx, phase, messages) {
  if (!ctx?.flowState?.spec) return;
  appendIssueLogFromGateError({ ...ctx, phase }, { message: messages.join("\n") });
}

/**
 * Post-hook: update `state.metrics[phase].gateRetry`.
 *   - PASS → reset to 0
 *   - AI semantic FAIL → increment by 1
 *   - structural/mechanical/schema/protocol FAIL → no retry mutation
 * No-op for non-tracked phases (draft / spec / task-spec).
 */
export function updateGateRetryCounter(ctx, result) {
  const phase = result?.artifacts?.phase || ctx?.phase;
  if (!RETRY_TRACKED_PHASES.includes(phase)) return;
  persistGateSourceFromResult(ctx, result, phase);
  const mgr = ctx.flowManager;
  if (!mgr) return;
  if (result?.result === "pass") {
    mgr.appendMetric({ phase, counter: "gateRetry", delta: 0, reset: true });
  } else if (result?.artifacts?.failureKind === "ai_semantic_fail") {
    mgr.appendMetric({ phase, counter: "gateRetry", delta: 1 });
    persistGateRecoveryBaseline(ctx, phase, GATE_RECOVERY_TRIGGER_RESULT_FAIL);
  } else if (ctx.gitState && (phase === "task-impl" || phase === "integration")) {
    mgr.mutate((state) => updateGateImplMemory({
      root: ctx.root,
      flowState: state,
      phase,
      round: nextGateImplMemoryRound(ctx.root, state, phase),
      status: "advisory",
      statusReason: "gate pass",
      gitState: ctx.gitState,
      passedGuardrails: buildPassedGuardrails(result?.artifacts?.evaluations),
      observations: result?.artifacts?.nextAction?.diagnosis?.observations || [],
    }));
  }
}


// ---------------------------------------------------------------------------
// No-progress-since-last-fail guard (spec 210)
// ---------------------------------------------------------------------------

/**
 * Compute a state identifier for the current working tree. `headSha` is the
 * current HEAD commit; `worktreeHash` is a sha256 over the tracked diff and
 * the porcelain status output, so any modification — tracked content change
 * or untracked file addition — changes the hash.
 */
export function computeGitState(root) {
  const head = runGit(["rev-parse", "HEAD"], { cwd: root });
  assertOk(head, "failed to read HEAD sha");
  const diff = runGit(["diff", "HEAD"], { cwd: root });
  assertOk(diff, "failed to read git diff HEAD");
  const status = runGit(["status", "--porcelain=v1", "-z"], { cwd: root });
  assertOk(status, "failed to read git status");
  const worktreeHash = crypto
    .createHash("sha256")
    .update(diff.stdout)
    .update("\x00")
    .update(status.stdout)
    .digest("hex");
  return { headSha: head.stdout.trim(), worktreeHash };
}

/**
 * Return the most recent same-phase FAIL entry that carries state identifiers,
 * or null. Shared scan used by {@link findPreviousFailState} and the rejection
 * error message.
 */
function findPreviousFailEntry(issueLog, phase) {
  const entries = Array.isArray(issueLog?.entries) ? issueLog.entries : [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.phase !== phase) continue;
    if (typeof e.headSha !== "string" || typeof e.worktreeHash !== "string") continue;
    return e;
  }
  return null;
}

function resolveGateImplMemoryPaths(root, flowState) {
  const specPath = flowState?.spec;
  if (!specPath) throw new Error("flowState.spec is required");
  const specDir = path.dirname(path.resolve(root, specPath));
  const artifactPath = path.join(specDir, "gate-impl-memory.json");
  return {
    specDir,
    artifactPath,
    artifactRelPath: path.relative(root, artifactPath).split(path.sep).join("/"),
  };
}

function readGateImplMemoryArtifact(root, flowState) {
  const { artifactPath } = resolveGateImplMemoryPaths(root, flowState);
  if (!fs.existsSync(artifactPath)) return { version: 1, entries: [] };
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  if (!Array.isArray(artifact.entries)) return { version: 1, entries: [] };
  return artifact;
}

function writeGateImplMemoryArtifact(root, flowState, artifact) {
  const { specDir, artifactPath } = resolveGateImplMemoryPaths(root, flowState);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
}

function gateImplMemoryForPhase(flowState, phase) {
  const memory = flowState?.gateImplMemory;
  if (!memory || memory.phase !== phase) return null;
  return memory;
}

function samePhaseMemoryEntries(artifact, phase) {
  return (Array.isArray(artifact?.entries) ? artifact.entries : [])
    .filter((entry) => entry?.phase === phase);
}

function nextGateImplMemoryRound(root, flowState, phase) {
  const artifact = readGateImplMemoryArtifact(root, flowState);
  const rounds = samePhaseMemoryEntries(artifact, phase)
    .map((entry) => Number(entry.round))
    .filter((round) => Number.isInteger(round));
  return rounds.length === 0 ? 1 : Math.max(...rounds) + 1;
}

export function updateGateImplMemory({
  root,
  flowState,
  phase,
  round = null,
  status = "blocking",
  statusReason = "",
  gitState,
  passedGuardrails = [],
  observations = [],
}) {
  if (phase !== "task-impl" && phase !== "integration") return null;
  const observedAt = new Date().toISOString();
  const normalizedObservations = normalizeObservations(observations).map((entry) => entry.toJSON());
  const artifact = readGateImplMemoryArtifact(root, flowState);
  const { artifactRelPath } = resolveGateImplMemoryPaths(root, flowState);
  const resolvedRound = round ?? nextGateImplMemoryRound(root, flowState, phase);
  const entry = {
    phase,
    round: resolvedRound,
    status,
    statusReason,
    updatedAt: observedAt,
    headSha: gitState?.headSha || null,
    worktreeHash: gitState?.worktreeHash || null,
    passedGuardrails,
    observations: normalizedObservations,
  };
  artifact.version = 1;
  const otherPhaseEntries = (Array.isArray(artifact.entries) ? artifact.entries : [])
    .filter((item) => item?.phase !== phase);
  const retainedPhaseEntries = samePhaseMemoryEntries(artifact, phase)
    .filter((item) => item.round !== resolvedRound);
  const latestPhaseEntries = [...retainedPhaseEntries, entry]
    .sort((a, b) => a.round - b.round)
    .slice(-3);
  artifact.entries = [...otherPhaseEntries, ...latestPhaseEntries]
    .sort((a, b) => {
      const phaseOrder = String(a.phase || "").localeCompare(String(b.phase || ""));
      return phaseOrder || a.round - b.round;
    });
  writeGateImplMemoryArtifact(root, flowState, artifact);

  const phaseEntries = samePhaseMemoryEntries(artifact, phase);
  const latest = phaseEntries[phaseEntries.length - 1];
  flowState.gateImplMemory = {
    version: 1,
    phase,
    artifactPath: artifactRelPath,
    roundsKept: 3,
    lastUpdatedAt: observedAt,
    headSha: latest.headSha,
    worktreeHash: latest.worktreeHash,
    passedGuardrails: latest.passedGuardrails,
    entries: phaseEntries.map((item) => ({
      signature: item.observations[0] ? Observation.fromJSON(item.observations[0]).signature() : "",
      status: item.status,
      observationRef: `${artifactRelPath}#round-${item.round}`,
    })),
  };
  return flowState.gateImplMemory;
}

export function readGateImplMemoryForPrompt({ root, flowState, phase }) {
  if (phase !== "task-impl" && phase !== "integration") return [];
  return samePhaseMemoryEntries(readGateImplMemoryArtifact(root, flowState), phase).slice(-3);
}

export function buildGateImplPriorMemoryPrompt({ root, flowState, phase }) {
  const entries = readGateImplMemoryForPrompt({ root, flowState, phase });
  if (entries.length === 0) return "";
  return [
    "## Prior Gate Observations",
    ...entries.map((entry) => [
      `### Round ${entry.round} (${entry.status})`,
      `Status reason: ${entry.statusReason || "n/a"}`,
      `State: ${entry.headSha || "n/a"} / ${entry.worktreeHash || "n/a"}`,
      ...entry.observations.map((observation) => Observation.fromJSON(observation).toMarkdown()),
    ].join("\n")),
  ].join("\n\n");
}

/**
 * Return the state identifiers of the most recent same-phase FAIL entry that
 * should still be considered active, or null when no such reference exists.
 *
 * A PASS resets the guard via metrics (spec 209 reset entry), so we skip the
 * scan entirely when `countGateRetry` reports zero. Legacy FAIL entries that
 * pre-date this guard are also treated as "no reference" because they lack
 * the state identifiers needed to compare (REQ-7).
 */
export function findPreviousFailState({ flowState, issueLog, phase }) {
  if (!RETRY_TRACKED_PHASES.includes(phase)) return null;
  if (countGateRetry(flowState?.metrics, phase) === 0) return null;
  const memory = gateImplMemoryForPhase(flowState, phase);
  if (memory?.headSha && memory?.worktreeHash) {
    return {
      headSha: memory.headSha,
      worktreeHash: memory.worktreeHash,
    };
  }
  const entry = findPreviousFailEntry(issueLog, phase);
  return entry ? { headSha: entry.headSha, worktreeHash: entry.worktreeHash } : null;
}

/**
 * Returns a failure Envelope with `code="NO_PROGRESS_SINCE_LAST_FAIL"` when the
 * current working-tree state matches the last recorded FAIL for the same
 * phase. Returns null when the command is allowed to proceed. The caller runs
 * this before invoking the AI agent so no retry budget is consumed (registry's
 * post-hook — which increments gateRetry — only runs on a successful ok:true
 * command return).
 */
export function checkNoProgressSinceLastFail({ flowState, issueLog, phase, currentState, ctx }) {
  const prev = findPreviousFailState({ flowState, issueLog, phase });
  if (!prev) return null;
  if (prev.headSha !== currentState.headSha) return null;
  if (prev.worktreeHash !== currentState.worktreeHash) return null;

  const prevEntry = findPreviousFailEntry(issueLog, phase);
  const prevReason = prevEntry?.reason || null;
  const messages = [
    `impl-gate re-run rejected: working tree is unchanged since the previous FAIL (phase "${phase}").`,
    "Previous FAIL reason:",
    `  ${prevReason || "(no reason recorded)"}`,
    "",
    "Modify the spec or implementation before retrying.",
  ];
  process.stderr.write(
    `[senti] gate pre-check rejected (NO_PROGRESS_SINCE_LAST_FAIL) — retry budget not consumed\n`,
  );
  appendGateEscalationIssueLog(ctx, phase, messages);
  return Envelope.fail(
    "run",
    "gate",
    "NO_PROGRESS_SINCE_LAST_FAIL",
    messages,
    { phase, previous: { headSha: prev.headSha, worktreeHash: prev.worktreeHash } },
  );
}

// ---------------------------------------------------------------------------
// Repeated-similar-FAIL escalation guard (spec 253; supersedes spec 212's
// byte-equal comparison with word-set Jaccard similarity)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "in", "on", "at", "to", "for",
  "by", "with", "from", "is", "are", "was", "were", "be", "been", "being",
  "it", "this", "that", "these", "those", "as", "if", "than",
]);

const JACCARD_THRESHOLD = 0.5;

/**
 * Tokenize and filter a reason string into a word set for Jaccard
 * comparison. ASCII-only: non-word non-space non-hyphen characters are
 * replaced with whitespace, so CJK and other non-ASCII text degrades to
 * an English-keyword view. Hyphen is preserved inside tokens (e.g.
 * "REQ-7" stays a single token). Tokens of length < 2 and pure
 * punctuation tokens are dropped, then Tier-1 STOPWORDS are removed.
 */
export function normalize(text) {
  if (text == null) return new Set();
  const replaced = String(text).toLowerCase().replace(/[^\w\s-]/g, " ");
  const tokens = replaced
    .split(/\s+/)
    .filter((t) => t.length >= 2 && /\w/.test(t) && !STOPWORDS.has(t));
  return new Set(tokens);
}

/**
 * Jaccard similarity of two word sets: |A ∩ B| / |A ∪ B|. Returns 0 when
 * either set is empty (intentional deviation from the issue's pseudocode
 * `union==0 ? 1`: empty reasons are AI-anomaly signals, not "same
 * complaint" — escalating on empty-vs-empty would be a false positive).
 */
export function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Extract FAIL-only evaluations as `{ guardrail_id, reason }` pairs for
 * persistence in issue-log and for similarity comparison. PASS / SKIP are
 * dropped.
 */
export function buildFailedEvaluations(evaluations) {
  if (!Array.isArray(evaluations)) return [];
  return evaluations
    .filter((e) => e && e.result === "fail" && typeof e.guardrail_id === "string")
    .map((e) => ({ guardrail_id: e.guardrail_id, reason: String(e.reason ?? "") }));
}

/**
 * Return all prior same-phase FAIL entries' `failedEvaluations` flattened
 * in chronological (oldest-first) order. Returns an empty array when no
 * prior matching entries exist. Legacy entries without `failedEvaluations`
 * are skipped so pre-212 issue-logs cannot cause false matches.
 */
export function findPreviousFailedEvaluations({ issueLog, phase }) {
  const entries = Array.isArray(issueLog?.entries) ? issueLog.entries : [];
  const flat = [];
  for (const e of entries) {
    if (!e || e.phase !== phase) continue;
    if (!Array.isArray(e.failedEvaluations) || e.failedEvaluations.length === 0) continue;
    for (const fe of e.failedEvaluations) flat.push(fe);
  }
  return flat;
}

function normalizeObservationFailurePairs(observations) {
  if (!Array.isArray(observations)) return [];
  return observations
    .map((entry) => entry instanceof Observation ? entry : Observation.fromJSON(entry))
    .filter((entry) => entry.severity === "blocking")
    .map((entry) => ({
      requirementRef: entry.requirementRef,
      observed: entry.observed,
    }));
}

function observationsFromGateEvaluations(evaluations) {
  if (!Array.isArray(evaluations)) return [];
  return evaluations.flatMap((entry) => (
    Array.isArray(entry?.observations) ? entry.observations : []
  ));
}

function priorGateImplObservations({ root, flowState, phase }) {
  return readGateImplMemoryForPrompt({ root, flowState, phase })
    .flatMap((entry) => Array.isArray(entry.observations) ? entry.observations : []);
}

/**
 * Throw `Error` with `err.code = "ESCALATE_REPEATED_FAIL"` when any
 * current FAIL has Jaccard similarity ≥ JACCARD_THRESHOLD against at
 * least one same-`guardrail_id` prior FAIL in the same phase. Per current
 * FAIL we report only the single most-similar prior; ties are broken by
 * scan order (oldest entry wins). The caller runs this after AI
 * evaluation but before the gateFail return, so the registry's POST-hook
 * (which increments `gateRetry`) never fires — retry budget is preserved.
 */
export function assertNoRepeatedFail({ issueLog, phase, currentEvaluations, priorObservations, currentObservations }) {
  if (!RETRY_TRACKED_PHASES.includes(phase)) return;
  const currentObservationPairs = normalizeObservationFailurePairs(currentObservations);
  if (currentObservationPairs.length > 0) {
    const priorPairs = normalizeObservationFailurePairs(priorObservations);
    const matched = [];
    for (const current of currentObservationPairs) {
      const currSet = normalize(current.observed);
      for (const prior of priorPairs) {
        if (prior.requirementRef !== current.requirementRef) continue;
        if (jaccard(currSet, normalize(prior.observed)) >= JACCARD_THRESHOLD) {
          matched.push({
            requirementRef: current.requirementRef,
            currentObserved: current.observed,
            priorObserved: prior.observed,
          });
          break;
        }
      }
    }
    if (matched.length === 0) return;
    const err = new Error(`impl-gate escalation: repeated similar Observation FAIL detected for phase "${phase}".`);
    err.code = "ESCALATE_REPEATED_FAIL";
    err.data = { phase, matched };
    throw err;
  }
  const current = buildFailedEvaluations(currentEvaluations);
  if (current.length === 0) return;
  const previous = findPreviousFailedEvaluations({ issueLog, phase });
  if (previous.length === 0) return;

  const matched = [];
  for (const c of current) {
    const currSet = normalize(c.reason);
    let bestSim = -1;
    let bestPrior = null;
    for (const p of previous) {
      if (p.guardrail_id !== c.guardrail_id) continue;
      const sim = jaccard(currSet, normalize(p.reason));
      if (sim > bestSim) {
        bestSim = sim;
        bestPrior = p;
      }
    }
    if (bestPrior !== null && bestSim >= JACCARD_THRESHOLD) {
      matched.push({
        guardrail_id: c.guardrail_id,
        currentReason: c.reason,
        priorReason: bestPrior.reason,
        similarity: bestSim,
      });
    }
  }
  if (matched.length === 0) return;

  const detail = matched
    .map((m) => `  ${m.guardrail_id} (jaccard=${m.similarity.toFixed(2)}): ${m.currentReason} ↔ ${m.priorReason}`)
    .join("\n");
  const msg = [
    `impl-gate escalation: repeated similar FAIL detected for phase "${phase}".`,
    "Matching (guardrail, similar prior reason) pairs:",
    detail,
    "",
    "The AI has failed on a semantically similar requirement to a previous attempt.",
    "Fix the spec wording or implementation so the failure mode changes, then retry.",
  ].join("\n");
  const err = new Error(msg);
  err.code = "ESCALATE_REPEATED_FAIL";
  err.data = { phase, matched };
  throw err;
}

// ---------------------------------------------------------------------------
// PASS→FAIL flip detection (spec 228)
// ---------------------------------------------------------------------------

export function buildPassedGuardrails(evaluations) {
  if (!Array.isArray(evaluations)) return [];
  return evaluations
    .filter((e) => e && e.result === "pass" && typeof e.guardrail_id === "string")
    .map((e) => e.guardrail_id);
}

export function findPreviousPassedGuardrails({ issueLog, phase }) {
  const memory = gateImplMemoryForPhase(arguments[0]?.flowState, phase);
  if (memory) {
    return {
      passedGuardrails: memory.passedGuardrails || [],
      headSha: memory.headSha,
      worktreeHash: memory.worktreeHash,
    };
  }
  const entries = Array.isArray(issueLog?.entries) ? issueLog.entries : [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.phase !== phase) continue;
    if (!Array.isArray(e.passedGuardrails)) continue;
    return {
      passedGuardrails: e.passedGuardrails,
      headSha: e.headSha,
      worktreeHash: e.worktreeHash,
    };
  }
  return null;
}

export function applyFlipOverride({ evaluations, previousEntry, currentState, phase }) {
  if (!previousEntry) return evaluations;
  if (!currentState) return evaluations;
  if (previousEntry.headSha !== currentState.headSha) return evaluations;
  if (previousEntry.worktreeHash !== currentState.worktreeHash) return evaluations;

  const prevPassed = new Set(previousEntry.passedGuardrails || []);
  return evaluations.map((e) => {
    if (e.result === "fail" && prevPassed.has(e.guardrail_id)) {
      // spec 255 R17: drop violations[] when flipping FAIL→PASS (PASS entries must not carry violations).
      const { violations, ...rest } = e;
      return { ...rest, result: "pass", reason: `${e.reason} [flip override: previously passed on identical content]` };
    }
    return e;
  });
}

// ---------------------------------------------------------------------------
// Task-impl / integration: requirements check
// ---------------------------------------------------------------------------


export class RequirementPromptExcerpt {
  constructor(requirement) {
    if (!requirement || typeof requirement !== "object" || Array.isArray(requirement)) {
      throw new Error("requirement must be an object");
    }
    if (typeof requirement.id !== "string" || requirement.id.trim() === "") {
      throw new Error("requirement.id must be a non-empty string");
    }
    if (typeof requirement.desc !== "string" || requirement.desc.trim() === "") {
      throw new Error("requirement.desc must be a non-empty string");
    }
    this.id = requirement.id.trim();
    this.desc = requirement.desc.trim();
    this.priority = typeof requirement.priority === "string" && requirement.priority.trim() !== ""
      ? requirement.priority.trim()
      : null;
    this.testable = requirement.testable;
    Object.freeze(this);
  }

  toPromptText() {
    return [
      `- ${this.id}: ${this.desc}`,
      ...(this.priority ? [`  priority: ${this.priority}`] : []),
      ...(this.testable === false ? ["  testing not required"] : []),
    ].join("\n");
  }
}

function normalizeRequirementPromptInput(input) {
  if (input instanceof RequirementPromptExcerpt) return input;
  return new RequirementPromptExcerpt(input);
}

function renderRequirementPromptSection(requirements) {
  return requirements.map((requirement) => normalizeRequirementPromptInput(requirement).toPromptText()).join("\n");
}

export class RequirementGateBatch {
  constructor({ requirements, diff, maxChars = MAX_IMPL_REQUIREMENT_BATCH_CHARS, usesFullSpec = false, fullSpecText = null }) {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      throw new Error("requirements must be a non-empty array");
    }
    if (typeof diff !== "string") throw new Error("diff must be a string");
    if (!Number.isInteger(maxChars) || maxChars <= 0) throw new Error("maxChars must be a positive integer");
    if (fullSpecText !== null && typeof fullSpecText !== "string") throw new Error("fullSpecText must be a string or null");
    this.requirements = Object.freeze(requirements.map(normalizeRequirementPromptInput));
    this.diff = diff;
    this.maxChars = maxChars;
    this.usesFullSpec = Boolean(usesFullSpec);
    this.fullSpecText = fullSpecText;
    this.requirementIds = Object.freeze(this.requirements.map((requirement) => requirement.id));
    this.category = "requirements";
    this.requirementPromptText = this.usesFullSpec ? this.fullSpecText : renderRequirementPromptSection(this.requirements);
    if (this.requirementPromptText.length + this.diff.length > MAX_AGENT_PROMPT_INPUT_CHARS) {
      const budget = Math.max(20000, this.maxChars - this.requirementPromptText.length);
      this.diff = summarizeDiffForPrompt(this.diff, budget);
    }
    this.promptCharCount = this.requirementPromptText.length + this.diff.length;
    this.overflow = this.requirements.length === 1 && !this.usesFullSpec && this.promptCharCount > this.maxChars;
    Object.freeze(this);
  }

  fitsWith(requirement) {
    const requirements = [...this.requirements, normalizeRequirementPromptInput(requirement)];
    const promptCharCount = renderRequirementPromptSection(requirements).length + this.diff.length;
    return promptCharCount <= this.maxChars;
  }

  withRequirement(requirement) {
    return new RequirementGateBatch({
      requirements: [...this.requirements, normalizeRequirementPromptInput(requirement)],
      diff: this.diff,
      maxChars: this.maxChars,
    });
  }

  buildPrompt() {
    return buildImplCheckPrompt({
      requirements: this.usesFullSpec ? this.fullSpecText : this.requirements,
      diff: this.diff,
      knownIds: this.requirementIds,
    });
  }
}

function summarizeDiffForPrompt(diff, maxChars) {
  const lines = [
    "[diff summarized: original diff exceeded provider input limits]",
  ];
  for (const [file, fileDiff] of splitDiffByFile(diff)) {
    const entry = summarizeDiffSegment(file, fileDiff);
    if (lines.join("\n").length + entry.length + 1 > maxChars) {
      lines.push("- ... additional files omitted from summary");
      break;
    }
    lines.push(entry);
  }
  return lines.join("\n");
}

function buildGuardrailTargetTextForPrompt(specText, diff, maxChars = MAX_GUARDRAIL_TARGET_CHARS) {
  if (typeof specText !== "string") throw new Error("specText must be a string");
  if (typeof diff !== "string") throw new Error("diff must be a string");
  if (!Number.isInteger(maxChars) || maxChars <= 0) throw new Error("maxChars must be a positive integer");

  const prefix = `${specText}\n\n## Git Diff\n`;
  if (prefix.length + diff.length <= maxChars) return `${prefix}${diff}`;
  const diffBudget = Math.max(1, maxChars - prefix.length);
  const targetText = `${prefix}${compactDiffForGuardrailPrompt(diff, diffBudget)}`;
  if (targetText.length <= maxChars) return targetText;
  return `${targetText.slice(0, Math.max(0, maxChars - 36)).trimEnd()}\n[target text truncated]`;
}

class RequirementGatePlan {
  constructor({ calls, evaluations }) {
    if (!Array.isArray(calls)) throw new Error("calls must be an array");
    if (!Array.isArray(evaluations)) throw new Error("evaluations must be an array");
    this.calls = Object.freeze(calls);
    this.evaluations = Object.freeze(evaluations);
    Object.freeze(this);
  }
}

function requirementEvaluation(reqId, result, reason) {
  return {
    guardrail_id: reqId,
    result,
    reason,
    title: reqId,
    category: "requirements",
  };
}

export function buildRequirementGateBatches({ requirements, relatedDiffs, maxChars = MAX_IMPL_REQUIREMENT_BATCH_CHARS }) {
  if (!Array.isArray(requirements)) throw new Error("requirements must be an array");
  if (!(relatedDiffs instanceof Map)) throw new Error("relatedDiffs must be a Map");
  const groups = new Map();
  for (const requirementInput of requirements) {
    const requirement = normalizeRequirementPromptInput(requirementInput);
    const diff = relatedDiffs.get(requirement.id) || "";
    if (!groups.has(diff)) groups.set(diff, []);
    groups.get(diff).push(requirement);
  }

  const batches = [];
  for (const [diff, group] of groups) {
    let current = null;
    for (const requirement of group) {
      if (!current) {
        current = new RequirementGateBatch({ requirements: [requirement], diff, maxChars });
        continue;
      }
      if (current.fitsWith(requirement)) {
        current = current.withRequirement(requirement);
        continue;
      }
      batches.push(current);
      current = new RequirementGateBatch({ requirements: [requirement], diff, maxChars });
    }
    if (current) batches.push(current);
  }
  return batches;
}

export function planRequirementGateCalls({
  requirements,
  relatedDiffs,
  previouslyPassed = new Set(),
  fullSpecText = "",
  fullDiff = "",
  phase = "task-impl",
  maxChars = MAX_IMPL_REQUIREMENT_BATCH_CHARS,
}) {
  const requirementExcerpts = requirements.map(normalizeRequirementPromptInput);
  if (relatedDiffs == null) {
    if (phase === "integration") throw new Error("file-map trust input is required for integration gate");
    return new RequirementGatePlan({
      calls: [new RequirementGateBatch({
        requirements: requirementExcerpts,
        diff: fullDiff,
        maxChars,
        usesFullSpec: true,
        fullSpecText,
      })],
      evaluations: [],
    });
  }
  if (!(relatedDiffs instanceof Map)) throw new Error("relatedDiffs must be a Map or null");
  const previousSet = previouslyPassed instanceof Set ? previouslyPassed : new Set(previouslyPassed || []);
  const callRequirements = [];
  const evaluations = [];
  for (const requirement of requirementExcerpts) {
    if (previousSet.has(requirement.id)) {
      evaluations.push(requirementEvaluation(requirement.id, "pass", "previously passed (skipped on retry)"));
      continue;
    }
    const reqDiff = relatedDiffs.get(requirement.id) || "";
    if (!reqDiff.trim()) {
      evaluations.push(requirementEvaluation(requirement.id, "skip", "no related diff found"));
      continue;
    }
    callRequirements.push(requirement);
  }
  return new RequirementGatePlan({
    calls: buildRequirementGateBatches({ requirements: callRequirements, relatedDiffs, maxChars }),
    evaluations,
  });
}

function buildImplCheckPrompt(specTextOrOptions, diffArg, knownIdsArg) {
  const options = typeof specTextOrOptions === "object" && specTextOrOptions !== null && !Array.isArray(specTextOrOptions)
    ? specTextOrOptions
    : { requirements: specTextOrOptions, diff: diffArg, knownIds: knownIdsArg };
  const requirements = options.requirements;
  const diff = options.diff || "";
  const knownIds = options.knownIds || [];
  const pb = new PromptBuilder();
  pb.setRole("You are an implementation compliance checker.\nCheck whether each spec requirement has been implemented in the diff.");

  const rules = [
    "- guardrail_id MUST be one of the requirement ids listed below.",
    "- result MUST be one of the lowercase strings: pass, fail, skip.",
    "- Use skip only when the requirement can only be verified by running tests and no execution evidence is provided.",
  ].join("\n");
  pb.setRules(rules);
  pb.setJsonSchema(IMPL_REQUIREMENT_EVAL_SCHEMA);
  pb.setFmtFallback(IMPL_REQUIREMENT_FMT_FALLBACK);

  pb.addUserPrompt("## Requirement IDs", knownIds.map((id) => `- ${id}`).join("\n"));
  if (Array.isArray(requirements)) {
    pb.addUserPrompt("## Requirements", renderRequirementPromptSection(requirements));
  } else {
    pb.addUserPrompt("## Spec", requirements || "");
  }
  pb.addUserPrompt("## Git Diff", diff);

  return pb;
}

function buildPerRequirementDiffs(fileMap, perFileDiffs, reqIds, fullDiff) {
  if (!fileMap || Object.keys(fileMap).length === 0) return null;

  const allMappedFiles = new Set();
  for (const files of Object.values(fileMap)) {
    if (Array.isArray(files)) {
      for (const f of files) allMappedFiles.add(f);
    }
  }
  const isMappedFile = (file) => {
    if (allMappedFiles.has(file)) return true;
    for (const mapped of allMappedFiles) {
      const prefix = String(mapped).replace(/\/$/, "");
      if (prefix && file.startsWith(`${prefix}/`)) return true;
    }
    return false;
  };

  let unmappedDiff = "";
  for (const [file, diff] of perFileDiffs) {
    if (!isMappedFile(file)) unmappedDiff += diff;
  }

  const result = new Map();
  for (const reqId of reqIds) {
    const mappedFiles = fileMap[reqId];
    if (!Array.isArray(mappedFiles)) {
      result.set(reqId, fullDiff);
      continue;
    }
    let reqDiff = "";
    for (const file of mappedFiles) {
      const fileDiff = perFileDiffs.get(file);
      if (fileDiff) reqDiff += fileDiff;
      const prefix = String(file).replace(/\/$/, "");
      if (prefix) {
        for (const [diffFile, diffText] of perFileDiffs) {
          if (diffFile.startsWith(`${prefix}/`)) reqDiff += diffText;
        }
      }
    }
    reqDiff += unmappedDiff;
    result.set(reqId, reqDiff);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Phase → next-step mapping
// ---------------------------------------------------------------------------

// spec 251: integration PASS now advances to retro (mainline impl-phase
// step), not directly to finalize-commit. retro reads the test-execute /
// test-result-review artifacts and writes retro.json before finalize.
const PASS_NEXT = {
  "draft": "spec",
  "spec": "approval",
  "task-spec": "task-impl",
  "task-impl": null,
  "integration": "retro",
};
const PASS_PRESCRIPTION = {
  ...PASS_NEXT,
  "task-impl": "complete-task",
};
const FAIL_NEXT = {
  "draft": "draft",
  "spec": "spec",
  "task-spec": "task-spec",
  "task-impl": "implement",
  "integration": "implement",
};

// ---------------------------------------------------------------------------
// Result builders
// ---------------------------------------------------------------------------

// spec 255 R9: emit ONE row per violation on FAIL article entries.
// detail includes `(at <where>)` so the location is preserved when persisted to issue-log.
export function reasonsFromEvaluations(evaluations) {
  const rows = [];
  for (const e of evaluations || []) {
    const verdict = e.result === "pass" ? "PASS" : e.result === "fail" ? "FAIL" : "SKIP";
    const title = e.title || e.guardrail_id;
    if (verdict === "FAIL" && Array.isArray(e.violations) && e.violations.length > 0) {
      for (const v of e.violations) {
        rows.push({
          verdict,
          detail: `${title} — ${v.target} — ${v.why_violates} (at ${v.where})`,
          guardrail_id: e.guardrail_id,
          category: e.category,
          where: v.where,
        });
      }
      continue;
    }
    rows.push({
      verdict,
      detail: `${title} — ${e.reason}`,
      guardrail_id: e.guardrail_id,
      category: e.category,
    });
  }
  return rows;
}

function nextActionFromGateEvaluations(evaluations, prescription) {
  const observations = observationsFromGateEvaluations(evaluations);
  const legacyFailures = Array.isArray(evaluations)
    ? evaluations.filter((entry) => (
        entry?.result === "fail"
        && (!Array.isArray(entry.observations) || entry.observations.length === 0)
      ))
    : [];
  const legacyObservations = legacyFailures.length > 0
    ? legacyEvaluationsToNextAction({ evaluations: legacyFailures, prescription }).diagnosis.observations
    : [];
  const combined = [...observations, ...legacyObservations.map((observation) => observation.toJSON())];
  if (combined.length > 0) {
    return new NextAction({
      diagnosis: new Diagnosis({
        summary: `${combined.length} observation(s).`,
        observations: combined,
      }),
      prescription,
    }).toJSON();
  }
  return legacyEvaluationsToNextAction({ evaluations, prescription }).toJSON();
}

function gatePass(level, phase, targetPath, evaluations, warnings) {
  const artifacts = {
    target: targetPath,
    level,
    phase,
    evaluations: evaluations || [],
    reasons: reasonsFromEvaluations(evaluations),
    nextAction: nextActionFromGateEvaluations(evaluations || [], PASS_PRESCRIPTION[phase]),
  };
  if (Array.isArray(warnings) && warnings.length > 0) {
    artifacts.warnings = warnings;
  }
  return {
    result: "pass",
    changed: [],
    artifacts,
    next: PASS_NEXT[phase],
  };
}

function gateFail(level, phase, targetPath, evaluations, issues) {
  const failedSemanticEvaluations = Array.isArray(evaluations)
    && evaluations.some((entry) => entry?.result === "fail");
  const observations = issues?.length
    ? issues.map((issue) => Observation.processEvidenceMissing({
        requirementRef: "process:gate-structure",
        where: null,
        observed: issue,
        diffVerifiable: true,
      }).toJSON())
    : null;
  const nextAction = observations
    ? new NextAction({
        diagnosis: new Diagnosis({ summary: `${observations.length} structural issue(s).`, observations }),
        prescription: FAIL_NEXT[phase],
      }).toJSON()
    : nextActionFromGateEvaluations(evaluations || [], FAIL_NEXT[phase]);
  return {
    result: "fail",
    changed: [],
    artifacts: {
      target: targetPath,
      level,
      phase,
      evaluations: evaluations || [],
      reasons: reasonsFromEvaluations(evaluations),
      issues: issues || [],
      failureKind: failedSemanticEvaluations ? "ai_semantic_fail" : "mechanical",
      nextAction,
    },
    next: FAIL_NEXT[phase],
  };
}

function persistIntegrationGateResult({ root, state, result }) {
  if (!result || typeof result !== "object" || result.ok === false) return result;
  if (result?.artifacts?.deferred === true) return result;
  if (!state?.spec) return result;
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  const artifactPath = path.join(specDir, IMPL_GATE_RESULT_FILE);
  const artifactPathRelative = repoRelative(root, artifactPath);
  const sourceArtifacts = result.artifacts || {};
  const artifact = {
    verdict: result.result === "pass" ? "pass" : "fail",
    issues: Array.isArray(sourceArtifacts.issues) ? sourceArtifacts.issues : [],
    nextAction: sourceArtifacts.nextAction ?? result.next ?? null,
    level: sourceArtifacts.level || "integration",
    phase: "integration",
    evaluations: Array.isArray(sourceArtifacts.evaluations) ? sourceArtifacts.evaluations : [],
    reasons: Array.isArray(sourceArtifacts.reasons) ? sourceArtifacts.reasons : [],
  };
  artifact.contractSummary = contractFromGateArtifact(artifact, {
    phase: "integration",
    artifactPath: artifactPathRelative,
  }).summary.toJSON();
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2) + "\n");
  result.changed = Array.from(new Set([...(Array.isArray(result.changed) ? result.changed : []), artifactPathRelative]));
  result.artifacts = {
    ...sourceArtifacts,
    verdict: artifact.verdict,
    artifactPath: artifactPathRelative,
    contractSummary: artifact.contractSummary,
  };
  return result;
}

// ---------------------------------------------------------------------------
// Common gate flow
// ---------------------------------------------------------------------------

/**
 * Shared orchestrator: resolve target, run text check, run guardrail AI check.
 *
 * @param {Object} args
 * @param {string} args.root
 * @param {Object} args.config
 * @param {string} args.level
 * @param {string} args.phase
 * @param {string} args.targetPath - relative path used in report
 * @param {string} args.targetText - content to evaluate
 * @param {() => string[]} args.textCheck - returns structural issues
 * @param {string} args.checkerRole - guardrail checker role
 * @param {boolean} args.skipGuardrail
 * @param {Object} [args.ctx] - optional context for retry guards (spec 228)
 * @param {Object} [args.guardrailPromptOptions] - optional guardrail prompt context
 */
async function runGateFlow(args) {
  const {
    root, config, level, phase,
    targetPath, targetText, textCheck, checkerRole, skipGuardrail,
    ctx, guardrailPromptOptions = {},
  } = args;
  const priorMemoryMarkdown = ctx?.flowState?.spec
    ? buildGateImplPriorMemoryPrompt({ root, flowState: ctx.flowState, phase })
    : "";

  validateLevelPhase(level, phase);

  const issues = textCheck();
  if (issues.length > 0) {
    return gateFail(level, phase, targetPath, [], issues);
  }

  if (ctx && RETRY_TRACKED_PHASES.includes(phase)) {
    warnGateRetryBudget(ctx, phase);
    if (ctx.gitState) {
      const noProgressFail = checkNoProgressSinceLastFail({
        flowState: ctx.flowState,
        issueLog: ctx.issueLog,
        phase,
        currentState: ctx.gitState,
        ctx,
      });
      if (noProgressFail) return noProgressFail;
    }
    const retryFail = checkRetryBelowMax(ctx, phase);
    if (retryFail) return retryFail;
  }

  if (skipGuardrail) {
    return gatePass(level, phase, targetPath, []);
  }

  let previouslyPassedIds;
  if (ctx && RETRY_TRACKED_PHASES.includes(phase)) {
    const prevEntry = findPreviousPassedGuardrails({ flowState: ctx.flowState, issueLog: ctx.issueLog, phase });
    if (prevEntry) {
      previouslyPassedIds = prevEntry.passedGuardrails;
    }
  }

  const result = await checkGuardrail(
    root,
    targetText,
    phase,
    checkerRole,
    previouslyPassedIds,
    {
      ...guardrailPromptOptions,
      priorMemoryMarkdown,
      retryContext: ctx,
    },
  );
  if (!result) {
    return gatePass(level, phase, targetPath, []);
  }

  let evaluations = result.evaluations;

  if (ctx && RETRY_TRACKED_PHASES.includes(phase) && ctx.gitState) {
    const prevEntry = findPreviousPassedGuardrails({ flowState: ctx.flowState, issueLog: ctx.issueLog, phase });
    evaluations = applyFlipOverride({
      evaluations,
      previousEntry: prevEntry,
      currentState: ctx.gitState,
      phase,
    });
  }

  const passed = evaluations.every((e) => e.result === "pass" || e.result === "skip");
  if (!passed) {
    if (ctx && RETRY_TRACKED_PHASES.includes(phase)) {
      assertNoRepeatedFail({
        issueLog: ctx.issueLog,
        phase,
        currentEvaluations: evaluations,
        priorObservations: priorGateImplObservations({ root, flowState: ctx.flowState, phase }),
        currentObservations: observationsFromGateEvaluations(evaluations),
      });
    }
    return gateFail(level, phase, targetPath, evaluations, []);
  }
  return gatePass(level, phase, targetPath, evaluations);
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

/**
 * Update a step's status during gate phase inference. When flow.json has not
 * been created yet (ERR_MISSING_FILE), the update is skipped with a warning —
 * any other error is re-thrown so the dispatcher can surface it to the user.
 *
 * Mirrors registry.js's `tryUpdateStepStatus` helper; kept inline here to
 * avoid exporting internal registry plumbing.
 */
function updateStepStatusDuringInference(stepId, status) {
  try {
    container.get("flowManager").updateStepStatus(stepId, status);
  } catch (err) {
    if (err?.code === "ERR_MISSING_FILE") {
      process.stderr.write(
        `[senti] gate: step-status update skipped (${stepId}=${status}): ${err.message}\n`,
      );
      return;
    }
    throw err;
  }
}

export class RunGateCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    let phase = ctx.phase;

    if (phase == null || phase === "") {
      const resolution = resolveGatePhaseFromState(ctx.flowState);
      if (!resolution) {
        return Envelope.fail(
          "run",
          "gate",
          "NO_GATE_STEP_IN_PROGRESS",
          `no gate-type step is in_progress; specify --phase explicitly. ` +
            `valid phases: ${VALID_GATE_PHASES.join(", ")}`,
        );
      }
      phase = resolution.phase;
      for (const staleId of resolution.staleSteps) {
        updateStepStatusDuringInference(staleId, "done");
        process.stderr.write(
          `[senti] gate: stale in_progress step "${staleId}" ` +
            `transitioned to done (auto-resolved phase=${phase})\n`,
        );
      }
      updateStepStatusDuringInference(resolveGateStepId(phase), "in_progress");
    }

    if (!VALID_GATE_PHASES.includes(phase)) {
      throw new Error(
        `invalid phase: ${phase} (valid: ${VALID_GATE_PHASES.join(", ")}). ` +
          `legacy names pre/post/impl have been retired — use spec / task-spec / task-impl / integration.`,
      );
    }

    const skipGuardrail = ctx.skipGuardrail || false;
    const level = PHASE_TO_LEVEL[phase];

    // spec 255 R5: catch EvaluationSchemaError before returning to the dispatcher.
    // AI output schema failures are non-semantic and must not consume gateRetry.
    try {
      if (phase === "draft") {
        return await this.executeDraft(ctx, root, level, skipGuardrail);
      }
      if (phase === "task-impl" || phase === "integration") {
        return await this.executeDiffBasedGate(ctx, root, level, phase, skipGuardrail);
      }
      if (phase === "task-spec") {
        return await this.executeTaskSpec(ctx, root, level, skipGuardrail);
      }
      // "spec" — parent spec.json
      return await this.executeSpec(ctx, root, level, skipGuardrail);
    } catch (err) {
      if (err instanceof EvaluationSchemaError) {
        if (RETRY_TRACKED_PHASES.includes(phase)) {
          appendIssueLogFromGateError({ ...ctx, phase }, { message: err.message });
        }
        return Envelope.fail(
          "run",
          "gate",
          "EVALUATION_SCHEMA_ERROR",
          err.message,
          { phase },
        );
      }
      throw err;
    }
  }

  async executeDraft(ctx, root, level, skipGuardrail) {
    const state = ctx.flowState;
    const specDir = state?.spec ? path.dirname(path.resolve(root, state.spec)) : null;
    if (!specDir) throw new Error("no active flow found");

    const draftPath = path.join(specDir, "draft.json");
    if (!fs.existsSync(draftPath)) {
      throw new Error(`draft not found: ${draftPath}`);
    }

    const originalText = fs.readFileSync(draftPath, "utf8");
    const relPath = path.relative(root, draftPath);

    const completedDraft = await completeDraftArtifactChange({
      root,
      specDir,
      state,
      rawText: originalText,
    });
    if (completedDraft.constructor.name === "ArtifactCompletionMechanicalFailure") {
      return gateFail(level, "draft", relPath, [], completedDraft.issues);
    }
    const draftObj = completedDraft.artifact;
    const targetText = JSON.stringify(draftObj, null, 2) + "\n";

    const gitState = computeGitState(root);
    ctx.gitState = gitState;
    const issueLog = state?.spec ? loadIssueLog(root, state.spec) : { entries: [] };

    return runGateFlow({
      root,
      config: ctx.config,
      level,
      phase: "draft",
      targetPath: relPath,
      targetText,
      textCheck: () => [
        ...checkDraftJson(draftObj),
        ...validateDraftReviewArtifacts(root, state.spec, draftObj),
      ],
      checkerRole:
        "You are a draft compliance checker. Check whether the draft satisfies each guardrail perspective.",
      skipGuardrail,
      ctx: { ...ctx, issueLog, gitState },
    });
  }

  async executeSpec(ctx, root, level, skipGuardrail) {
    let specInput = ctx.spec || "";
    if (!specInput) {
      const state = ctx.flowState;
      if (state?.spec) {
        specInput = state.spec;
      } else {
        throw new Error("no --spec provided and no active flow found");
      }
    }

    // Resolve any input form (directory / spec.json / spec.md) to spec.json.
    const absInput = path.resolve(root, specInput);
    const jsonPath = resolveSpecJsonPath(absInput);
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`spec.json not found: ${jsonPath}`);
    }

    const targetPath = path.relative(root, jsonPath);
    const originalTargetText = fs.readFileSync(jsonPath, "utf8");

    const completedSpec = await completeSpecArtifactChange({
      root,
      specDir: path.dirname(jsonPath),
      state: ctx.flowState,
      rawText: originalTargetText,
      requireRepairAudit: false,
      requireContent: false,
    });
    if (completedSpec.constructor.name === "ArtifactCompletionMechanicalFailure") {
      return gateFail(level, "spec", targetPath, [], completedSpec.issues);
    }

    let spec;
    let loadError = null;
    try {
      spec = validateSpecJsonObject(completedSpec.artifact);
    } catch (err) {
      loadError = err.message;
      spec = completedSpec.artifact;
    }
    const targetText = JSON.stringify(spec, null, 2) + "\n";

    // REQ-3 (spec 215): tasks[] monotonic check applies to the parent-level
    // spec phase only.
    const flowTasks = ctx.flowState?.tasks || [];
    const monotonicIssues = checkTasksMonotonic({
      flowTasks,
      specTasks: spec?.tasks,
    });

    const gitState = computeGitState(root);
    ctx.gitState = gitState;
    const issueLog = ctx.flowState?.spec ? loadIssueLog(root, ctx.flowState.spec) : { entries: [] };
    const specGuardrails = filterByPhase(loadMergedGuardrails(root), "spec");
    const acknowledgedRationale = buildAcknowledgedRationaleSection({
      spec,
      guardrails: specGuardrails,
    });

    return runGateFlow({
      root,
      config: ctx.config,
      level,
      phase: "spec",
      targetPath,
      targetText,
      textCheck: () =>
        loadError
          ? [`schema: ${loadError}`, ...monotonicIssues]
          : [
            ...checkSpecJson(spec),
            ...monotonicIssues,
            ...validateSpecRepairAudit(root, targetPath),
          ],
      checkerRole: undefined,
      skipGuardrail,
      ctx: { ...ctx, issueLog, gitState },
      guardrailPromptOptions: { acknowledgedRationale },
    });
  }

  async executeTaskSpec(ctx, root, level, skipGuardrail) {
    const spec = ctx.spec || "";
    let specPath = spec;
    if (!specPath) {
      const state = ctx.flowState;
      if (state?.spec) {
        specPath = state.spec;
      } else {
        throw new Error("no --spec provided and no active flow found");
      }
    }

    const absPath = path.resolve(root, specPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`spec not found: ${absPath}`);
    }

    const text = fs.readFileSync(absPath, "utf8");

    return runGateFlow({
      root,
      config: ctx.config,
      level,
      phase: "task-spec",
      targetPath: specPath,
      targetText: text,
      textCheck: () => checkSpecText(text),
      checkerRole: undefined,
      skipGuardrail,
    });
  }

  async executeDiffBasedGate(ctx, root, level, phase, skipGuardrail) {
    const state = ctx.flowState;
    if (!state?.spec) throw new Error("no active flow found");
    if (!state.baseBranch) throw new Error("baseBranch not set in flow.json");
    const finish = (result) => phase === "integration"
      ? persistIntegrationGateResult({ root, state, result })
      : result;

    const scopeDecision = evaluateTaskScope(state, "impl-gate");
    if (phase === "task-impl") {
      if (scopeDecision.kind === "task") {
        return finish(await this.executeTaskImplGate(ctx, root, level, phase, skipGuardrail));
      }
      if (scopeDecision.kind === "invalid-current-task" || scopeDecision.kind === "blocked" || scopeDecision.promotable) {
        return finish(taskCursorRequiredGateFailure(scopeDecision, phase, state));
      }
      if (scopeDecision.kind === "broad") {
        assertAuditedBroadMode(scopeDecision, "impl-gate");
      }
    }
    if (phase === "integration") {
      if (scopeDecision.kind === "invalid-current-task" || scopeDecision.kind === "blocked" || scopeDecision.promotable) {
        return finish(taskCursorRequiredGateFailure(scopeDecision, phase, state));
      }
      if (scopeDecision.kind === "broad") {
        assertAuditedBroadMode(scopeDecision, "impl-gate");
      }
    }

    // spec 251 R17: integration gate verifies the upstream test-execute /
    // test-result-review artifacts before delegating to the AI guardrail
    // pipeline. Missing / unverified results are treated as FAIL with no
    // retry budget consumption, since the failure is structural.
    if (phase === "integration") {
      const integrationCheck = checkIntegrationTestArtifacts(root, state, level, phase, ctx.config || {});
      if (integrationCheck) return finish(integrationCheck);
    }

    // spec 210 REQ-2/REQ-3: reject re-run when the working tree is unchanged
    // since the previous FAIL. Returns ok:false envelope before AI invocation,
    // so gateRetry is not incremented (the registry post-hook never runs on
    // an ok:false return).
    const gitState = computeGitState(root);
    const noProgressFail = checkNoProgressSinceLastFail({
      flowState: state,
      issueLog: loadIssueLog(root, state.spec),
      phase,
      currentState: gitState,
      ctx,
    });
    if (noProgressFail) return finish(noProgressFail);
    // spec 210 REQ-1: stash current state on ctx so appendIssueLogFromGateResult
    // can attach it to FAIL entries without re-running git.
    ctx.gitState = gitState;

    const specPath = state.spec;
    const absSpecInput = path.resolve(root, specPath);
    const specJsonPath = resolveSpecJsonPath(absSpecInput);
    if (!fs.existsSync(specJsonPath)) {
      throw new Error(`spec.json not found: ${specJsonPath}`);
    }

    let parentSpecForRationale;
    try {
      parentSpecForRationale = loadSpecJson(specJsonPath);
    } catch (err) {
      return finish(gateFail(level, phase, specPath, [], [`spec.json load failed: ${err.message}`]));
    }
    const specText = specJsonToPromptText(parentSpecForRationale, {
      title: getSpecName(state),
    });
    const reqIds = enumerateUsableRequirementIds(parentSpecForRationale);
    if (reqIds.length === 0) {
      return finish(gateFail(level, phase, specPath, [], ["spec.json has no requirements with usable ids"]));
    }
    const requirements = parentSpecForRationale.requirements
      .filter((requirement) => reqIds.includes(requirement.id))
      .map((requirement) => new RequirementPromptExcerpt(requirement));

    const committed = runGitDiff([`${state.baseBranch}...HEAD`], "failed to get git diff", root);
    const uncommitted = runGitDiff(["HEAD"], "failed to get uncommitted git diff", root);
    const untracked = await collectUntrackedDiff(root, {
      excludeFile: (relPath) => isGeneratedSpecArtifactForGate(relPath, state.spec),
    });
    const diff = committed + uncommitted + untracked;

    if (!diff.trim()) {
      return finish(gateFail(level, phase, specPath, [], [
        "no changes found (committed or uncommitted) against base branch",
      ]));
    }

    // spec 209 REQ-6: surface remaining retry budget after current structural
    // inputs have been validated, so stale semantic deferral cannot bypass
    // missing/invalid spec or diff evidence.
    warnGateRetryBudget(ctx, phase);
    // spec 201 P2-R2/R3: refuse to run further retries once the limit is reached.
    const retryFail = checkRetryBelowMax(ctx, phase);
    if (retryFail) return finish(retryFail);


    const agent = container.get("agent");
    if (!agent.resolve("flow.spec.gate")) {
      throw new Error(
        "no AI agent configured (agent.default or agent.profiles.<name>.flow.spec.gate)",
      );
    }

    const specDir = resolveSpecDir(specJsonPath);
    const fileMap = loadFileMap(specDir);

    let perReqDiffs = null;
    if (Object.keys(fileMap).length > 0) {
      const perFileDiffs = collectPerFileDiffsForGate(committed, uncommitted, untracked);
      perReqDiffs = buildPerRequirementDiffs(fileMap, perFileDiffs, reqIds, diff);
    }

    let reqEvaluations;
    const previousResult = findPreviousPassedGuardrails({
      flowState: state,
      issueLog: loadIssueLog(root, state.spec),
      phase,
    });

    const requirementPlan = planRequirementGateCalls({
      requirements,
      relatedDiffs: perReqDiffs,
      previouslyPassed: new Set(previousResult?.passedGuardrails || []),
      fullSpecText: specText,
      fullDiff: diff,
      phase,
      maxChars: MAX_IMPL_REQUIREMENT_BATCH_CHARS,
    });
    reqEvaluations = [...requirementPlan.evaluations];
    for (const batch of requirementPlan.calls) {
      const reqPb = batch.buildPrompt();
      const reqBuilt = reqPb.build();
      const reqResponse = await agent.call(reqBuilt.userPrompt, {
        commandId: "flow.spec.gate",
        systemPrompt: reqBuilt.systemPrompt,
        jsonSchema: reqBuilt.jsonSchema,
        fmtFallback: reqBuilt.fmtFallback,
      });
      const reqResults = parseImplRequirementEvaluation(reqResponse, batch.requirementIds);
      reqEvaluations.push(...reqResults.map((r) => ({
        ...r,
        title: r.guardrail_id,
        category: "requirements",
      })));
    }

    const reqPassed = reqEvaluations.every(
      (r) => r.result === "pass" || r.result === "skip",
    );
    if (!reqPassed) {
      // spec 212 REQ-1: escalate when the same requirement FAILs for the same
      // reason as the previous attempt. Throws before gateFail return so the
      // POST-hook retry counter increment never fires (REQ-2).
      assertNoRepeatedFail({
        issueLog: loadIssueLog(root, state.spec),
        phase,
        currentEvaluations: reqEvaluations,
        priorObservations: priorGateImplObservations({ root, flowState: state, phase }),
        currentObservations: observationsFromGateEvaluations(reqEvaluations),
      });
      return finish(gateFail(level, phase, specPath, reqEvaluations, []));
    }

    // spec 241 R5: file-map reconciliation warnings
    const fileMapWarnings = this.reconcileFileMapWarnings(root, state);

    if (skipGuardrail) {
      return finish(gatePass(level, phase, specPath, reqEvaluations, fileMapWarnings));
    }

    const diffGuardrails = filterByPhase(loadMergedGuardrails(root), phase);
    const acknowledgedRationale = buildAcknowledgedRationaleSection({
      spec: parentSpecForRationale,
      guardrails: diffGuardrails,
    });
    const previouslyPassedIds = previousResult?.passedGuardrails;
    const grResult = await checkGuardrail(
      root,
      buildGuardrailTargetTextForPrompt(specText, diff),
      phase,
      "You are an implementation compliance checker. Check the implementation against each guardrail.",
      previouslyPassedIds,
      { acknowledgedRationale, retryContext: ctx },
    );
    if (!grResult) {
      return finish(gatePass(level, phase, specPath, reqEvaluations, fileMapWarnings));
    }
    const combined = [...reqEvaluations, ...grResult.evaluations];
    if (!grResult.passed) {
      // spec 212 REQ-1: escalate on repeated identical guardrail FAIL.
      assertNoRepeatedFail({
        issueLog: loadIssueLog(root, state.spec),
        phase,
        currentEvaluations: combined,
        priorObservations: priorGateImplObservations({ root, flowState: state, phase }),
        currentObservations: observationsFromGateEvaluations(combined),
      });
      return finish(gateFail(level, phase, specPath, combined, []));
    }
    return finish(gatePass(level, phase, specPath, combined, fileMapWarnings));
  }

  async executeTaskImplGate(ctx, root, level, phase, skipGuardrail) {
    const state = ctx.flowState;
    const taskSpec = resolveCurrentTaskSpec({ root, state });
    const committed = runGitDiff([`${state.baseBranch}...HEAD`], "failed to get git diff", root);
    const uncommitted = runGitDiff(["HEAD"], "failed to get uncommitted git diff", root);
    const untracked = await collectUntrackedDiff(root, {
      excludeFile: (relPath) => isGeneratedSpecArtifactForGate(relPath, state.spec),
    });
    const diff = committed + uncommitted + untracked;
    if (!diff.trim()) {
      return gateFail(level, phase, taskSpec.relPath, [], [
        "no changes found (committed or uncommitted) against base branch",
      ]);
    }
    const diffBytes = Buffer.byteLength(diff, "utf8");
    if (diffBytes > TASK_IMPL_GATE_DIFF_MAX_BYTES) {
      return gateFail(level, phase, taskSpec.relPath, [], [
        `task implementation diff is ${diffBytes} bytes, exceeds limit ${TASK_IMPL_GATE_DIFF_MAX_BYTES}`,
      ]);
    }

    const gitState = computeGitState(root);
    ctx.gitState = gitState;
    const issueLog = loadIssueLog(root, state.spec);
    const targetText = `${taskSpec.text}\n\n## Git Diff\n${diff}`;

    return runGateFlow({
      root,
      config: ctx.config,
      level,
      phase,
      targetPath: taskSpec.relPath,
      targetText,
      textCheck: () => [],
      checkerRole:
        "You are a task implementation compliance checker. Check this task specification against the implementation diff.",
      skipGuardrail,
      ctx: { ...ctx, issueLog, gitState },
    });
  }

  reconcileFileMapWarnings(root, state) {
    try {
      const specDir = resolveSpecDir(path.resolve(root, state.spec));
      const fileMap = loadFileMap(specDir);
      if (Object.keys(fileMap).length === 0) return [];

      const diffRes = runGit(["diff", "--name-only", `${state.baseBranch}...HEAD`], { cwd: root });
      if (!diffRes.ok) return [];
      const diffFiles = diffRes.stdout.trim().split("\n").filter(Boolean);
      const unrecorded = reconcileFileMap(fileMap, diffFiles);
      if (unrecorded.length === 0) return [];
      return [`file-map: ${unrecorded.length} file(s) in diff but not recorded: ${unrecorded.join(", ")}`];
    } catch (err) {
      process.stderr.write(`[senti] file-map reconciliation skipped: ${err.message}\n`);
      return [];
    }
  }
}

export default RunGateCommand;
export {
  checkSpecText,
  checkSpecJson,
  validateSpecRepairAudit,
  checkDraftJson,
  validateDraftReviewArtifactSet,
  buildGuardrailPrompt,
  buildImplCheckPrompt,
  MAX_IMPL_REQUIREMENT_BATCH_CHARS,
  MAX_GUARDRAIL_TARGET_CHARS,
  checkGuardrail,
  splitDiffByFile,
  buildGuardrailTargetTextForPrompt,
  compactDiffForGuardrailPrompt,
  collectPerFileDiffsForGate,
  buildPerRequirementDiffs,
};

export function appendIssueLogFromGateResult(ctx, result) {
  const issueLog = loadIssueLog(ctx.root, ctx.flowState?.spec);
  const observations = result?.artifacts?.nextAction?.diagnosis?.observations || [];
  const reasons = result?.artifacts?.issues?.length
    ? result.artifacts.issues.join("; ")
    : observations.map((observation) => observation.observed).join("; ")
      || (result?.artifacts?.reasons || []).map((r) => r.detail || r).join("; ");
  const entry = {
    step: resolveGateStepId(ctx.phase),
    level: result?.artifacts?.level,
    phase: result?.artifacts?.phase,
    reason: reasons || "gate FAIL (no details)",
    trigger: "gate post hook (auto)",
    timestamp: new Date().toISOString(),
  };
  // spec 210 REQ-1: persist the state identifier captured before AI evaluation
  // so a subsequent impl-gate run can reject unchanged re-execution. Only
  // tracked phases carry gitState; gate it explicitly to document the invariant.
  if (ctx.gitState && RETRY_TRACKED_PHASES.includes(ctx.phase)) {
    entry.headSha = ctx.gitState.headSha;
    entry.worktreeHash = ctx.gitState.worktreeHash;
  }
  if (observations.length > 0) {
    entry.observations = observations;
  }
  const passedGuardrails = buildPassedGuardrails(result?.artifacts?.evaluations);
  entry.passedGuardrails = passedGuardrails;
  const failedEvaluations = buildFailedEvaluations(result?.artifacts?.evaluations);
  if (failedEvaluations.length > 0) {
    entry.failedEvaluations = failedEvaluations;
  }

  if (RETRY_TRACKED_PHASES.includes(ctx.phase) && observations.length > 0) {
    const status = observations.some((observation) => observation.severity === "blocking")
      ? "blocking"
      : "advisory";
    const update = (state) => updateGateImplMemory({
      root: ctx.root,
      flowState: state,
      phase: ctx.phase,
      round: nextGateImplMemoryRound(ctx.root, state, ctx.phase),
      status,
      statusReason: entry.reason,
      gitState: ctx.gitState,
      passedGuardrails,
      observations,
    });
    if (ctx.flowManager) {
      ctx.flowManager.mutate(update);
    } else {
      update(ctx.flowState);
    }
  }
  issueLog.entries.push(entry);
  saveIssueLog(ctx.root, ctx.flowState?.spec, issueLog);
}

export function appendIssueLogFromGateError(ctx, err) {
  const issueLog = loadIssueLog(ctx.root, ctx.flowState?.spec);
  issueLog.entries.push({
    step: resolveGateStepId(ctx.phase),
    phase: ctx.phase,
    reason: err.message || String(err),
    trigger: "gate onError hook (auto)",
    timestamp: new Date().toISOString(),
  });
  saveIssueLog(ctx.root, ctx.flowState?.spec, issueLog);
}
