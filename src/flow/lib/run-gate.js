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
import { validateDraftLifecycle } from "./draft-lifecycle.js";
import { validateIntegrationArtifactTrust } from "./test-artifacts.js";
import { assertIntegrationRegressionEvidence } from "./test-artifacts.js";
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

export { resolveGateStepId };

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
  const derived = deriveNextAction(scope, stepId, state);
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
      process.stderr.write(`[sdd-forge] gate side effect '${effect}' failed: ${err.message}\n`);
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

/**
 * Synthesize a unified diff for every untracked file in `root` and return the
 * concatenated diff text. Untracked-file omission in `git diff` is the root
 * cause of spec 221 — a test-first new test file becomes invisible to
 * gate-impl unless we splice it back in here.
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
    taskScopeViolationMessages(scopeDecision, "gate-impl"),
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
  const triagePath = path.join(specDir, "spec-review-triage.json");
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
    return ["spec-review-triage: spec-review.json verdict is FAIL but spec-review-triage.json is missing"];
  }

  let triage;
  try {
    triage = readJsonIfExists(triagePath);
  } catch (err) {
    return [`spec-review-triage: spec-review-triage.json is invalid JSON: ${err.message}`];
  }

  if (triage?.version !== 1) issues.push("spec-review-triage: spec-review-triage.json version must be 1");
  if (triage?.phase !== "spec-review-triage") issues.push('spec-review-triage: spec-review-triage.json phase must be "spec-review-triage"');
  if (triage?.sourceReview !== "spec-review.json") issues.push('spec-review-triage: spec-review-triage.json sourceReview must be "spec-review.json"');
  if (typeof triage?.summary !== "string" || triage.summary.trim() === "") {
    issues.push("spec-review-triage: spec-review-triage.json summary must be non-empty");
  }
  if (!Array.isArray(triage?.items)) {
    issues.push("spec-review-triage: spec-review-triage.json items must be an array");
    return issues;
  }
  if (triage.items.length !== blocking.length) {
    issues.push(
      `spec-review-triage: spec-review-triage.json items length ${triage.items.length} does not match blockingFindings length ${blocking.length}`,
    );
  }

  for (let i = 0; i < triage.items.length; i++) {
    const item = triage.items[i];
    const finding = blocking[i];
    const prefix = `spec-review-triage: items[${i}]`;
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
  if (repair?.sourceReview !== "spec-review-triage.json") issues.push('spec-repair: spec-repair.json sourceReview must be "spec-review-triage.json"');
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
      `spec-repair: spec-repair.json items length ${repair.items.length} does not match spec-review-triage apply item length ${applyItems.length}`,
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
      issues.push(`${prefix}.title must match spec-review-triage apply item ${i}.title`);
    }
    if (triageItem && item.target !== triageItem.target) {
      issues.push(`${prefix}.target must match spec-review-triage apply item ${i}.target`);
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
    evaluations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          guardrail_id: { type: "string" },
          result: { type: "string", enum: ["pass", "fail", "skip"] },
          reason: { type: "string" },
          violations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                target: { type: "string" },
                where: { type: "string" },
                why_violates: { type: "string" },
              },
              required: ["target", "where", "why_violates"],
              additionalProperties: false,
            },
          },
        },
        required: ["guardrail_id", "result"],
        additionalProperties: false,
      },
    },
  },
  required: ["evaluations"],
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
  '  {"evaluations":[{"guardrail_id":"<id>","result":"pass"|"fail"|"skip", ...}]}',
  "  - For result=\"pass\" or \"skip\": include a non-empty \"reason\" field; do NOT include \"violations\".",
  "  - For result=\"fail\": include a non-empty \"violations\" array with one entry per occurrence/edit location.",
  '    Each violation: {"target":"<verbatim text excerpt or short gap descriptor>","where":"<heading anchor, JSON path, file:line, or artifact name>","why_violates":"<1-2 sentence reason>"}',
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
    "- Include exactly one entry per guardrail article listed below, identified by its id.",
    "- Evaluate only explicit requirements stated in the listed guardrail article body. Do not invent additional design, codebase-context, or completeness criteria.",
    "- This is a readiness gate, not a design review. Do not search for new implementation-target gaps, existing-behavior gaps, integration choices, or product-scope issues unless the guardrail article explicitly requires that check.",
    "- If a concern is not directly grounded in a listed guardrail article, it must not be reported as a FAIL here.",
    "- `result` MUST be one of the lowercase strings: pass, fail, skip.",
    "- For pass/skip: include a non-empty `reason` and do NOT include `violations`.",
    "- For fail: include a non-empty `violations` array (do NOT rely on `reason` — it is overwritten by a derived summary).",
    "- Exhaustive enumeration: emit ONE violation entry per occurrence/edit location. Repeated occurrences of the same vague phrase in different places are distinct entries — distinguishable by `where`. Do NOT group or summarize.",
    "- For document-level guardrails (rule violations that have no concrete passage to quote — e.g. a missing required section): emit one OR MORE entries, one per distinct gap. Use `target` as a short gap descriptor (e.g. \"missing section: Acceptance Criteria\") and `where` as the artifact name (e.g. \"spec.json\").",
    "- Each violation entry requires non-empty `target`, `where`, and `why_violates`. Duplicate (target, where) pairs within the same guardrail FAIL are forbidden.",
    "- When a diff-scope section is present below, list ONLY violations introduced by the diff (lines added or modified, marked with `+`).",
    "- Use skip only when the article cannot be evaluated without runtime evidence not provided.",
    "- If an article is inapplicable by nature of the content, mark it as pass with a short reason.",
    "- Matched Spec Acknowledgment Rationale is context only. Exception permission comes from the guardrail article clause, not from the rationale section alone.",
    "- To acknowledge a guardrail exception in a spec, write the target guardrail_id directly in constraints, clarifications, or alternatives_considered.",
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

  pb.addUserPrompt("## Guardrail Articles", articleList);
  if (options?.acknowledgedRationale?.markdown) {
    pb.addUserRaw(options.acknowledgedRationale.markdown);
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

/**
 * Parse the structured AI guardrail-article evaluation response (spec 255).
 *
 * @param {string} rawResponse
 * @param {string[]} knownIds
 * @returns {Array<{guardrail_id: string, result: string, reason: string, violations?: Array}>}
 * @throws {EvaluationSchemaError}
 */
export function parseGuardrailArticleEvaluation(rawResponse, knownIds) {
  const evaluations = parseEvaluationsArray(rawResponse);
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
  return results;
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
  const response = await agent.call(built.userPrompt, {
    commandId: "flow.spec.gate",
    systemPrompt: built.systemPrompt,
    jsonSchema: built.jsonSchema,
    fmtFallback: built.fmtFallback,
  });
  const knownIds = filtered.map((g) => g.id);
  const parsed = parseGuardrailArticleEvaluation(response, knownIds);
  const byId = new Map(filtered.map((g) => [g.id, g]));
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

import { resolveNodeFor, FLOW_DEFINITION, TASK_DEFINITION } from "../definition.js";

const RETRY_TRACKED_PHASES = Object.freeze(["draft", "spec", "task-impl", "integration"]);
const GATE_RECOVERY_PHASES = new Set(["task-impl", "integration"]);
const GATE_RECOVERY_TRIGGER_RETRY_EXHAUSTED = "gate-retry-exhausted";
const GATE_RECOVERY_TRIGGER_RESULT_FAIL = "gate-result-fail";

export function resolveRetryMax(retryContext = {}, phase) {
  const stepId = resolveGateStepId(phase);
  const flowState = retryContext.flowState || retryContext;
  const scope = retryContext.scope
    || (flowState?.currentTaskId != null ? "task" : "flow");
  const definition = scope === "task" ? TASK_DEFINITION : FLOW_DEFINITION;
  const node = resolveNodeFor(definition, stepId);
  return node?.resolveMaxAttempts(flowState) ?? 5;
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

// Set of step ids that represent gate evaluations. step === "gate" is used by
// spec / task-spec; "gate-draft" and "gate-impl" are used by draft and
// task-impl/integration respectively (see gate-step.js resolveGateStepId).
// A plain `startsWith("gate-")` would silently exclude the bare "gate" value
// and mix histories across phases — hence the explicit set + phase filter.
const GATE_STEP_IDS = new Set(["gate", "gate-draft", "gate-impl"]);
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
    process.stderr.write(`[sdd-forge] formatRetryHistory: loadIssueLog failed: ${err.message}\n`);
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
    `[sdd-forge] gate retry: ${used}/${max} used (${remaining} remaining) [AI-FAIL=${used}] for phase "${phase}"\n`,
  );
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
 *   - FAIL → increment by 1
 * No-op for non-tracked phases (draft / spec / task-spec).
 */
export function updateGateRetryCounter(ctx, result) {
  const phase = result?.artifacts?.phase || ctx?.phase;
  if (!RETRY_TRACKED_PHASES.includes(phase)) return;
  const mgr = ctx.flowManager;
  if (!mgr) return;
  const payload = result?.result === "pass"
    ? { phase, counter: "gateRetry", delta: 0, reset: true }
    : { phase, counter: "gateRetry", delta: 1 };
  mgr.appendMetric(payload);
  if (result?.result === "fail") {
    persistGateRecoveryBaseline(ctx, phase, GATE_RECOVERY_TRIGGER_RESULT_FAIL);
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
    `gate-impl re-run rejected: working tree is unchanged since the previous FAIL (phase "${phase}").`,
    "Previous FAIL reason:",
    `  ${prevReason || "(no reason recorded)"}`,
    "",
    "Modify the spec or implementation before retrying.",
  ];
  process.stderr.write(
    `[sdd-forge] gate pre-check rejected (NO_PROGRESS_SINCE_LAST_FAIL) — retry budget not consumed\n`,
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

/**
 * Throw `Error` with `err.code = "ESCALATE_REPEATED_FAIL"` when any
 * current FAIL has Jaccard similarity ≥ JACCARD_THRESHOLD against at
 * least one same-`guardrail_id` prior FAIL in the same phase. Per current
 * FAIL we report only the single most-similar prior; ties are broken by
 * scan order (oldest entry wins). The caller runs this after AI
 * evaluation but before the gateFail return, so the registry's POST-hook
 * (which increments `gateRetry`) never fires — retry budget is preserved.
 */
export function assertNoRepeatedFail({ issueLog, phase, currentEvaluations }) {
  if (!RETRY_TRACKED_PHASES.includes(phase)) return;
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
    `gate-impl escalation: repeated similar FAIL detected for phase "${phase}".`,
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


function buildImplCheckPrompt(specText, diff, knownIds) {
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
  pb.addUserPrompt("## Spec", specText);
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

  let unmappedDiff = "";
  for (const [file, diff] of perFileDiffs) {
    if (!allMappedFiles.has(file)) unmappedDiff += diff;
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

function gatePass(level, phase, targetPath, evaluations, warnings) {
  const artifacts = {
    target: targetPath,
    level,
    phase,
    evaluations: evaluations || [],
    reasons: reasonsFromEvaluations(evaluations),
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
    },
    next: FAIL_NEXT[phase],
  };
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

  validateLevelPhase(level, phase);

  if (ctx && RETRY_TRACKED_PHASES.includes(phase)) {
    warnGateRetryBudget(ctx, phase);
    const retryFail = checkRetryBelowMax(ctx, phase);
    if (retryFail) return retryFail;

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
  }

  const issues = textCheck();
  if (issues.length > 0) {
    return gateFail(level, phase, targetPath, [], issues);
  }

  if (skipGuardrail) {
    return gatePass(level, phase, targetPath, []);
  }

  let previouslyPassedIds;
  if (ctx && RETRY_TRACKED_PHASES.includes(phase)) {
    const prevEntry = findPreviousPassedGuardrails({ issueLog: ctx.issueLog, phase });
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
    guardrailPromptOptions,
  );
  if (!result) {
    return gatePass(level, phase, targetPath, []);
  }

  let evaluations = result.evaluations;

  if (ctx && RETRY_TRACKED_PHASES.includes(phase) && ctx.gitState) {
    const prevEntry = findPreviousPassedGuardrails({ issueLog: ctx.issueLog, phase });
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
        `[sdd-forge] gate: step-status update skipped (${stepId}=${status}): ${err.message}\n`,
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
          `[sdd-forge] gate: stale in_progress step "${staleId}" ` +
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
    // For RETRY_TRACKED_PHASES, manually increment gateRetry and append issue-log
    // (post-hooks skip on ok:false envelopes). For non-tracked phases (task-spec),
    // return Envelope.fail without retry/log side-effects.
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
          updateGateRetryCounter({ ...ctx, phase }, "fail");
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

    const text = fs.readFileSync(draftPath, "utf8");
    const relPath = path.relative(root, draftPath);

    let draftObj;
    try {
      draftObj = JSON.parse(text);
    } catch (e) {
      return runGateFlow({
        root,
        config: ctx.config,
        level,
        phase: "draft",
        targetPath: relPath,
        targetText: text,
        textCheck: () => [`draft.json is not valid JSON: ${e.message}`],
        checkerRole:
          "You are a draft compliance checker. Check whether the draft satisfies each guardrail perspective.",
        skipGuardrail: true,
        ctx,
      });
    }

    const gitState = computeGitState(root);
    ctx.gitState = gitState;
    const issueLog = state?.spec ? loadIssueLog(root, state.spec) : { entries: [] };

    return runGateFlow({
      root,
      config: ctx.config,
      level,
      phase: "draft",
      targetPath: relPath,
      targetText: text,
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
    const targetText = fs.readFileSync(jsonPath, "utf8");

    let spec;
    let loadError = null;
    try {
      // R1: spec.json is loaded through the single validated load path
      // (loadSpecJson — performs JSON.parse + spec.schema.json validation).
      spec = loadSpecJson(jsonPath);
    } catch (err) {
      loadError = err.message;
    }

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

    const scopeDecision = evaluateTaskScope(state, "gate-impl");
    if (phase === "task-impl") {
      if (scopeDecision.kind === "task") {
        return await this.executeTaskImplGate(ctx, root, level, phase, skipGuardrail);
      }
      if (scopeDecision.kind === "invalid-current-task" || scopeDecision.kind === "blocked" || scopeDecision.promotable) {
        return taskCursorRequiredGateFailure(scopeDecision, phase, state);
      }
      if (scopeDecision.kind === "broad") {
        assertAuditedBroadMode(scopeDecision, "gate-impl");
      }
    }
    if (phase === "integration") {
      if (scopeDecision.kind === "invalid-current-task" || scopeDecision.kind === "blocked" || scopeDecision.promotable) {
        return taskCursorRequiredGateFailure(scopeDecision, phase, state);
      }
      if (scopeDecision.kind === "broad") {
        assertAuditedBroadMode(scopeDecision, "gate-impl");
      }
    }

    // spec 251 R17: integration gate verifies the upstream test-execute /
    // test-result-review artifacts before delegating to the AI guardrail
    // pipeline. Missing / unverified results are treated as FAIL with no
    // retry budget consumption, since the failure is structural.
    if (phase === "integration") {
      const integrationCheck = checkIntegrationTestArtifacts(root, state, level, phase, ctx.config || {});
      if (integrationCheck) return integrationCheck;
    }

    // spec 209 REQ-6: surface remaining retry budget before running the gate.
    warnGateRetryBudget(ctx, phase);
    // spec 201 P2-R2/R3: refuse to run further retries once the limit is reached.
    const retryFail = checkRetryBelowMax(ctx, phase);
    if (retryFail) return retryFail;

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
    if (noProgressFail) return noProgressFail;
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
      return gateFail(level, phase, specPath, [], [`spec.json load failed: ${err.message}`]);
    }
    const specText = specJsonToPromptText(parentSpecForRationale, {
      title: getSpecName(state),
    });
    const reqIds = enumerateUsableRequirementIds(parentSpecForRationale);
    if (reqIds.length === 0) {
      return gateFail(level, phase, specPath, [], ["spec.json has no requirements with usable ids"]);
    }

    const committed = runGitDiff([`${state.baseBranch}...HEAD`], "failed to get git diff", root);
    const uncommitted = runGitDiff(["HEAD"], "failed to get uncommitted git diff", root);
    const untracked = await collectUntrackedDiff(root, {
      excludeFile: (relPath) => isGeneratedSpecArtifactForGate(relPath, state.spec),
    });
    const diff = committed + uncommitted + untracked;

    if (!diff.trim()) {
      return gateFail(level, phase, specPath, [], [
        "no changes found (committed or uncommitted) against base branch",
      ]);
    }


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
      issueLog: loadIssueLog(root, state.spec),
      phase,
    });

    if (!perReqDiffs) {
      const reqPb = buildImplCheckPrompt(specText, diff, reqIds);
      const reqBuilt = reqPb.build();
      const reqResponse = await agent.call(reqBuilt.userPrompt, {
        commandId: "flow.spec.gate",
        systemPrompt: reqBuilt.systemPrompt,
        jsonSchema: reqBuilt.jsonSchema,
        fmtFallback: reqBuilt.fmtFallback,
      });
      const reqResults = parseImplRequirementEvaluation(reqResponse, reqIds);
      reqEvaluations = reqResults.map((r) => ({
        ...r,
        title: r.guardrail_id,
        category: "requirements",
      }));
    } else {
      const previouslyPassed = new Set(previousResult?.passedGuardrails || []);

      reqEvaluations = [];
      for (const reqId of reqIds) {
        if (previouslyPassed.has(reqId)) {
          reqEvaluations.push({
            guardrail_id: reqId,
            result: "pass",
            reason: "previously passed (skipped on retry)",
            title: reqId,
            category: "requirements",
          });
          continue;
        }
        const reqDiff = perReqDiffs.get(reqId) || "";
        if (!reqDiff.trim()) {
          reqEvaluations.push({
            guardrail_id: reqId,
            result: "skip",
            reason: "no related diff found",
            title: reqId,
            category: "requirements",
          });
          continue;
        }
        const reqPb = buildImplCheckPrompt(specText, reqDiff, [reqId]);
        const reqBuilt = reqPb.build();
        const reqResponse = await agent.call(reqBuilt.userPrompt, {
          commandId: "flow.spec.gate",
          systemPrompt: reqBuilt.systemPrompt,
          jsonSchema: reqBuilt.jsonSchema,
          fmtFallback: reqBuilt.fmtFallback,
        });
        const reqResults = parseImplRequirementEvaluation(reqResponse, [reqId]);
        reqEvaluations.push(...reqResults.map((r) => ({
          ...r,
          title: r.guardrail_id,
          category: "requirements",
        })));
      }
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
      });
      return gateFail(level, phase, specPath, reqEvaluations, []);
    }

    // spec 241 R5: file-map reconciliation warnings
    const fileMapWarnings = this.reconcileFileMapWarnings(root, state);

    if (skipGuardrail) {
      return gatePass(level, phase, specPath, reqEvaluations, fileMapWarnings);
    }

    const diffGuardrails = filterByPhase(loadMergedGuardrails(root), phase);
    const acknowledgedRationale = buildAcknowledgedRationaleSection({
      spec: parentSpecForRationale,
      guardrails: diffGuardrails,
    });
    const previouslyPassedIds = previousResult?.passedGuardrails;
    const grResult = await checkGuardrail(
      root,
      `${specText}\n\n## Git Diff\n${diff}`,
      phase,
      "You are an implementation compliance checker. Check the implementation against each guardrail.",
      previouslyPassedIds,
      { acknowledgedRationale },
    );
    if (!grResult) {
      return gatePass(level, phase, specPath, reqEvaluations, fileMapWarnings);
    }
    const combined = [...reqEvaluations, ...grResult.evaluations];
    if (!grResult.passed) {
      // spec 212 REQ-1: escalate on repeated identical guardrail FAIL.
      assertNoRepeatedFail({
        issueLog: loadIssueLog(root, state.spec),
        phase,
        currentEvaluations: combined,
      });
      return gateFail(level, phase, specPath, combined, []);
    }
    return gatePass(level, phase, specPath, combined, fileMapWarnings);
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
      process.stderr.write(`[sdd-forge] file-map reconciliation skipped: ${err.message}\n`);
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
  checkGuardrail,
  splitDiffByFile,
  collectPerFileDiffsForGate,
  buildPerRequirementDiffs,
};

export function appendIssueLogFromGateResult(ctx, result) {
  const issueLog = loadIssueLog(ctx.root, ctx.flowState?.spec);
  const reasons = result?.artifacts?.issues?.length
    ? result.artifacts.issues.join("; ")
    : (result?.artifacts?.reasons || []).map((r) => r.detail || r).join("; ");
  const entry = {
    step: resolveGateStepId(ctx.phase),
    level: result?.artifacts?.level,
    phase: result?.artifacts?.phase,
    reason: reasons || "gate FAIL (no details)",
    trigger: "gate post hook (auto)",
    timestamp: new Date().toISOString(),
  };
  // spec 210 REQ-1: persist the state identifier captured before AI evaluation
  // so a subsequent gate-impl run can reject unchanged re-execution. Only
  // tracked phases carry gitState; gate it explicitly to document the invariant.
  if (ctx.gitState && RETRY_TRACKED_PHASES.includes(ctx.phase)) {
    entry.headSha = ctx.gitState.headSha;
    entry.worktreeHash = ctx.gitState.worktreeHash;
  }
  // spec 212 REQ-4: persist per-FAIL (guardrail_id, reason) pairs so a
  // subsequent gate-impl run can detect repeated identical failures and
  // escalate (see assertNoRepeatedFail). Omit when no FAIL evaluations are
  // present to keep structural-only failures (e.g. "no changes") clean.
  // Note: these reasons are AI-generated gate metadata describing spec /
  // diff compliance; the same text is already persisted in the flat
  // `entry.reason` field above. This adds a structured view of the same
  // data, not new content — so it carries no new log-sensitivity surface.
  const failedEvaluations = buildFailedEvaluations(result?.artifacts?.evaluations);
  if (failedEvaluations.length > 0) {
    entry.failedEvaluations = failedEvaluations;
  }
  entry.passedGuardrails = buildPassedGuardrails(result?.artifacts?.evaluations);
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
