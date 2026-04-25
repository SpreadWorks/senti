/**
 * src/flow/lib/run-gate.js
 *
 * FlowCommand: gate — check deliverable readiness for each phase.
 *
 * Phases (issue #184, cac6/T3):
 *   draft        (level=parent)       check draft.md structure + guardrail compliance
 *   spec         (level=parent)       check spec.md structure + guardrail compliance
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
import { filterByPhase, loadMergedGuardrails } from "../../lib/guardrail.js";
import { getSpecName } from "../../lib/flow-helpers.js";
import { loadSpecJson, resolveSpecJsonPath } from "../../lib/spec-json.js";
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

export { resolveGateStepId };

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
 * @param {{maxFiles?: number, maxFileSize?: number}} [options]
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
  const files = listStdout.split("\0").filter((p) => p.length > 0);
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
// Text checks — draft
// ---------------------------------------------------------------------------

function buildDraftFieldPattern(labels) {
  return new RegExp(`(?:^\\s*##\\s+(?:${labels})|\\*{0,2}(?:${labels})\\*{0,2}\\s*[:：])`, "im");
}

const DRAFT_DEV_TYPE_ENUM = Object.freeze([
  "feature",
  "bugfix",
  "refactor",
  "docs",
  "chore",
  "test",
  "other",
]);

// Case-sensitive: only lowercase letters are accepted. Uppercase / mixed case
// values are intentionally rejected so the enum remains a single canonical form.
// Tolerant to `**LABEL:**` (colon inside bold) and `**LABEL**:` (colon outside).
// Line-anchored so stray inline mentions elsewhere are not parsed as the field.
const DRAFT_DEV_TYPE_VALUE_RE =
  /^\s*\*{0,2}(?:開発種別|Development\s*Type)\*{0,2}\s*[:：]\s*\*{0,2}\s*([A-Za-z]+)/m;

function checkDraftText(text) {
  const issues = [];

  if (!/##\s+Q&A/i.test(text)) {
    issues.push("missing Q&A section");
  }

  const hasApproval =
    /-\s*\[\s*x\s*\]\s*(?:User approved this draft|ユーザーがこの draft を承認した)/i.test(text);
  if (!hasApproval) {
    issues.push("draft approval is required: set `- [x] User approved this draft`");
  }

  if (!buildDraftFieldPattern("開発種別|dev(?:elopment)?\\s*type").test(text)) {
    issues.push("missing development type (開発種別)");
  } else {
    const match = text.match(DRAFT_DEV_TYPE_VALUE_RE);
    const value = match ? match[1] : "";
    if (!DRAFT_DEV_TYPE_ENUM.includes(value)) {
      issues.push(
        `invalid development type "${value}" (expected one of: ${DRAFT_DEV_TYPE_ENUM.join(", ")})`,
      );
    }
  }

  if (!buildDraftFieldPattern("目的|goal").test(text)) {
    issues.push("missing goal (目的)");
  }

  if (!/^\s*##\s+Scope Verification\b/im.test(text)) {
    issues.push("missing section: ## Scope Verification");
  }

  if (!/^\s*##\s+Impact on Existing Features\b/im.test(text)) {
    issues.push("missing section: ## Impact on Existing Features");
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
 * Build AI prompt for structured guardrail evaluation.
 *
 * Accepts ALL guardrails and filters them internally by phase. When a caller
 * has already filtered, use {@link buildGuardrailPromptFromFiltered} instead
 * to avoid re-filtering.
 *
 * @param {string} targetText - text to evaluate
 * @param {Array} guardrails - guardrails (unfiltered)
 * @param {string} phase - gate phase
 * @param {string} [role] - checker role override
 * @returns {string|null} prompt, or null if no guardrails match phase
 */
function buildGuardrailPrompt(targetText, guardrails, phase, role) {
  const filtered = filterByPhase(guardrails, phase);
  return buildGuardrailPromptFromFiltered(targetText, filtered, phase, role);
}

/**
 * Variant of {@link buildGuardrailPrompt} that takes pre-filtered guardrails.
 * Used by internal callers (e.g. {@link checkGuardrail}) that have already
 * filtered by phase and want to avoid the redundant pass.
 */
function buildGuardrailPromptFromFiltered(targetText, filtered, phase, role) {
  if (filtered.length === 0) return null;

  const articleList = filtered
    .map((g) => `- id: ${g.id}\n  title: ${g.title}\n  body: ${g.body.trim()}`)
    .join("\n");

  const checkerRole = role || `You are a ${phase} compliance checker.`;

  const parts = [
    `${checkerRole} Check the following content against each guardrail article.`,
    "",
    "OUTPUT FORMAT — strictly required:",
    "Return a single JSON object matching this shape:",
    '  {"evaluations":[{"guardrail_id":"<id>","result":"pass"|"fail"|"skip","reason":"<brief>"}]}',
    "",
    "Rules:",
    "- Include exactly one entry per guardrail article listed below, identified by its id.",
    "- `result` MUST be one of the lowercase strings: pass, fail, skip.",
    "- Use skip only when the article cannot be evaluated without runtime evidence not provided.",
    "- If an article is inapplicable by nature of the content, mark it as pass with a short reason.",
    "- Output MUST be valid JSON. No preamble, no trailing commentary, no Markdown prose — JSON only.",
    "",
  ];

  if (DIFF_SCOPED_PHASES.includes(phase)) {
    parts.push(...IMPL_DIFF_SCOPE_LINES);
  }

  parts.push(
    "## Guardrail Articles",
    articleList,
    "",
    "## Content",
    targetText,
  );

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Structured evaluation parser (REQ-5/6/7)
// ---------------------------------------------------------------------------

export class EvaluationSchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = "EvaluationSchemaError";
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

/**
 * Parse the structured AI evaluation response.
 *
 * @param {string} rawResponse - raw AI response text
 * @param {string[]} knownIds - guardrail ids that must appear
 * @returns {Array<{guardrail_id: string, result: string, reason: string}>}
 * @throws {EvaluationSchemaError}
 */
export function parseEvaluationResponse(rawResponse, knownIds) {
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

  const known = new Set(knownIds);
  const seen = new Set();
  const results = [];
  for (const [idx, entry] of parsed.evaluations.entries()) {
    if (!entry || typeof entry !== "object") {
      throw new EvaluationSchemaError(`evaluations[${idx}] is not an object`);
    }
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

async function checkGuardrail(root, targetText, _config, phase, role) {
  const guardrails = loadMergedGuardrails(root);
  if (guardrails.length === 0) return null;

  const filtered = filterByPhase(guardrails, phase);
  if (filtered.length === 0) return { passed: true, evaluations: [] };

  const agent = container.get("agent");
  if (!agent.resolve("flow.spec.gate")) return null;

  const prompt = buildGuardrailPromptFromFiltered(targetText, filtered, phase, role);
  if (!prompt) return { passed: true, evaluations: [] };

  const response = await agent.call(prompt, { commandId: "flow.spec.gate" });
  const knownIds = filtered.map((g) => g.id);
  const parsed = parseEvaluationResponse(response, knownIds);
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
// Test-file change detection (spec 201, P1-R1〜P1-R6)
//
// Deterministic mechanical check that replaces the retired
// `impl-test-preservation` AI guardrail. Classifies each test-file hunk by
// pure diff structure (line counts of `+` / `-`) without any language parsing.
// ---------------------------------------------------------------------------

const DEFAULT_TEST_GLOBS = Object.freeze([
  "**/*.test.*",
  "**/*_test.*",
  "**/*.spec.*",
  "tests/**",
]);

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${escaped}$`);
}

function isTestFile(filePath, testGlobs) {
  return testGlobs.some((g) => globToRegExp(g).test(filePath));
}

/**
 * Parse a raw git diff into per-file, per-hunk records.
 * @param {string} diff
 * @returns {Array<{file: string, hunks: Array<{newStart: number, added: number, removed: number}>}>}
 */
function parseDiffHunks(diff) {
  const files = [];
  const lines = diff.split("\n");
  let curFile = null;
  let curHunk = null;

  for (const line of lines) {
    const fileMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (fileMatch) {
      curFile = { file: fileMatch[2], hunks: [] };
      files.push(curFile);
      curHunk = null;
      continue;
    }
    if (!curFile) continue;

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      curHunk = { newStart: Number(hunkMatch[1]), added: 0, removed: 0 };
      curFile.hunks.push(curHunk);
      continue;
    }
    if (!curHunk) continue;

    if (line.startsWith("+") && !line.startsWith("+++")) curHunk.added += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) curHunk.removed += 1;
  }

  return files;
}

/**
 * Check a git diff for disallowed changes to test files.
 *
 * Rules:
 *   - Any hunk with `removed >= 1` (delete or modify existing line) → FAIL
 *   - Any hunk with `added === 1 && removed === 0`                  → FAIL
 *   - Multi-line `+` only hunks (added >= 2, removed === 0)         → PASS (skip)
 *
 * Language parsing is NOT used (P1-R6).
 *
 * Spec 205: test files listed in `authorizedFiles` are exempted — all hunks
 * in those files are skipped regardless of the rules above. The exemption
 * is opt-in by the spec author via the `## Authorized Existing Test
 * Modifications` section in spec.md (see {@link parseAuthorizedTestModifications}).
 *
 * @param {string} diff               raw unified diff text
 * @param {string[]} [testGlobs]      optional override; defaults to common test patterns
 * @param {string[]} [authorizedFiles] optional list of test file paths to exempt
 * @returns {{ issues: string[] }}
 */
export function checkTestChanges(diff, testGlobs, authorizedFiles) {
  const globs = Array.isArray(testGlobs) && testGlobs.length > 0
    ? testGlobs
    : DEFAULT_TEST_GLOBS;
  const authorized = Array.isArray(authorizedFiles) ? new Set(authorizedFiles) : new Set();

  const issues = [];
  for (const f of parseDiffHunks(diff)) {
    if (!isTestFile(f.file, globs)) continue;
    if (authorized.has(f.file)) continue;
    for (const h of f.hunks) {
      if (h.removed >= 1) {
        issues.push(
          `${f.file}:${h.newStart}: existing line modified/deleted in test file (removed=${h.removed}, added=${h.added})`,
        );
      } else if (h.added === 1 && h.removed === 0) {
        issues.push(
          `${f.file}:${h.newStart}: single-line addition in test file (likely assertion insertion)`,
        );
      }
    }
  }
  return { issues };
}

// ---------------------------------------------------------------------------
// Authorized test modifications (spec 205)
// ---------------------------------------------------------------------------

const AUTH_SECTION_HEADER = "## Authorized Existing Test Modifications";
const AUTH_REASON_MIN_CHARS = 40;

// Match a single flat-bullet entry: `- `<path>` — <reason>`.
// The separator is a literal em dash (U+2014) surrounded by whitespace.
const AUTH_ENTRY_RE = /^-\s+`([^`]+)`\s+—\s+(.+?)\s*$/;

/**
 * Parse the `## Authorized Existing Test Modifications` section of a spec.md.
 *
 * Entry format: `` - `<path>` — <reason (>=40 chars)> ``
 *
 * @param {string} specText full spec.md content
 * @returns {{ files: string[], errors: string[] }}
 */
export function parseAuthorizedTestModificationsFromJson(entries) {
  const files = [];
  const errors = [];
  if (!Array.isArray(entries)) return { files, errors };
  for (const e of entries) {
    if (!e || typeof e.path !== "string" || typeof e.reason !== "string") {
      errors.push(`authorized-test entry missing path/reason`);
      continue;
    }
    if (e.reason.length < AUTH_REASON_MIN_CHARS) {
      errors.push(
        `authorized-test entry \`${e.path}\`: reason must be at least ${AUTH_REASON_MIN_CHARS} chars (got ${e.reason.length})`,
      );
      continue;
    }
    files.push(e.path);
  }
  return { files, errors };
}

export function parseAuthorizedTestModifications(specText) {
  const files = [];
  const errors = [];
  if (typeof specText !== "string" || specText.length === 0) {
    return { files, errors };
  }

  const lines = specText.split("\n");
  let inSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!inSection) {
      if (line === AUTH_SECTION_HEADER) inSection = true;
      continue;
    }
    if (line.startsWith("## ")) break;
    if (line.trim() === "") continue;

    const match = line.match(AUTH_ENTRY_RE);
    if (!match) {
      if (/^-\s+[^`]/.test(line)) {
        errors.push(`authorized-test entry must wrap the path in backticks: ${line.trim()}`);
      } else {
        errors.push(`authorized-test entry syntax invalid (expected \`- \`<path>\` — <reason>\`): ${line.trim()}`);
      }
      continue;
    }

    const path = match[1];
    const reason = match[2];
    if (reason.length < AUTH_REASON_MIN_CHARS) {
      errors.push(
        `authorized-test entry \`${path}\`: reason must be at least ${AUTH_REASON_MIN_CHARS} chars (got ${reason.length})`,
      );
      continue;
    }
    files.push(path);
  }

  return { files, errors };
}

/**
 * Spec 205 R5: return warning messages for authorized entries whose files do
 * not appear in the diff. Gate itself still PASSes — the caller surfaces the
 * warnings alongside the PASS result.
 *
 * @param {string} diff
 * @param {string[]} authorizedFiles
 * @returns {string[]} human-readable warning messages
 */
export function findUnusedAuthorizations(diff, authorizedFiles) {
  if (!Array.isArray(authorizedFiles) || authorizedFiles.length === 0) return [];
  const diffFiles = new Set(parseDiffHunks(diff).map((f) => f.file));
  const warnings = [];
  for (const p of authorizedFiles) {
    if (!diffFiles.has(p)) {
      warnings.push(`authorized-test entry \`${p}\` has no matching change in the diff`);
    }
  }
  return warnings;
}

function resolveTestGlobs(config) {
  const configured = config?.flow?.gate?.testGlobs;
  return Array.isArray(configured) && configured.length > 0
    ? configured
    : DEFAULT_TEST_GLOBS;
}

// ---------------------------------------------------------------------------
// Retry counter & escalation (spec 201, P2-R1〜P2-R4)
// ---------------------------------------------------------------------------

const DEFAULT_GATE_RETRY_MAX = 3;
const RETRY_TRACKED_PHASES = Object.freeze(["task-impl", "integration"]);

function resolveRetryMax(config) {
  const n = Number(config?.flow?.retry?.max);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_GATE_RETRY_MAX;
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
  const max = resolveRetryMax(ctx.config);
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
  const max = resolveRetryMax(ctx.config);
  if (count < max) return null;

  const history = formatRetryHistory(ctx.root, ctx.flowState?.spec, max, phase);
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
}

// ---------------------------------------------------------------------------
// Missing head test evidence guard (spec 222)
// ---------------------------------------------------------------------------

/**
 * Returns a failure Envelope with `code="NO_HEAD_TEST_EVIDENCE"` when the gate
 * is running on a retry-tracked phase (task-impl / integration) without
 * tool-recorded head test evidence in flow state. The signal is the presence
 * of `flowState.test.summary.exitCode` — only `flow run tests` writes it
 * (via `flowManager.setTestSummary({ ...counts, exitCode }, ...)`), while
 * AI-side `flow set test-summary --unit N` writes counts without exitCode.
 *
 * Returns null when the command is allowed to proceed. The caller runs this
 * before invoking the AI agent so no retry budget is consumed — the dispatcher
 * skips the post-hook (which increments gateRetry) for ok:false envelopes.
 */
export function checkMissingHeadTestEvidence({ phase, flowState }) {
  if (!RETRY_TRACKED_PHASES.includes(phase)) return null;
  const exitCode = flowState?.test?.summary?.exitCode;
  if (typeof exitCode === "number") return null;
  const messages = [
    `gate ${phase}: no tool-recorded head test evidence found in flow state.`,
    "Run: sdd-forge flow run tests",
    "This populates flow.json `test.summary.exitCode` which gate-impl requires to evaluate implementation against the spec's test requirements.",
  ];
  process.stderr.write(
    `[sdd-forge] gate pre-check rejected (NO_HEAD_TEST_EVIDENCE) — retry budget not consumed\n`,
  );
  return Envelope.fail(
    "run",
    "gate",
    "NO_HEAD_TEST_EVIDENCE",
    messages,
    { phase },
  );
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
// Repeated-identical-FAIL escalation guard (spec 212)
// ---------------------------------------------------------------------------

/**
 * Normalize a reason string for identity comparison: trim, collapse any
 * consecutive whitespace to a single space, lowercase ASCII. Semantic
 * similarity (Levenshtein / embedding) is intentionally excluded — the
 * guard compares decision-level text produced by the same model with
 * matching inputs, so exact-after-normalization suffices (REQ-6).
 */
export function normalizeReason(text) {
  if (text == null) return "";
  return String(text).trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Extract FAIL-only evaluations as `{ guardrail_id, reason }` pairs for
 * persistence in issue-log and for identity comparison. PASS / SKIP are
 * dropped.
 */
export function buildFailedEvaluations(evaluations) {
  if (!Array.isArray(evaluations)) return [];
  return evaluations
    .filter((e) => e && e.result === "fail" && typeof e.guardrail_id === "string")
    .map((e) => ({ guardrail_id: e.guardrail_id, reason: String(e.reason ?? "") }));
}

/**
 * Return the most recent same-phase FAIL entry's `failedEvaluations`, or
 * null when no such entry exists. Legacy entries without the field are
 * skipped so pre-212 issue-logs cannot cause false matches.
 */
export function findPreviousFailedEvaluations({ issueLog, phase }) {
  const entries = Array.isArray(issueLog?.entries) ? issueLog.entries : [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.phase !== phase) continue;
    if (!Array.isArray(e.failedEvaluations) || e.failedEvaluations.length === 0) continue;
    return e.failedEvaluations;
  }
  return null;
}

/**
 * Throw `Error` with `err.code = "ESCALATE_REPEATED_FAIL"` when any FAIL
 * pair in the current evaluation matches a pair recorded in the previous
 * same-phase FAIL entry (guardrail_id exact match + normalized reason
 * exact match). The caller runs this after AI evaluation but before the
 * gateFail return, so the registry's POST-hook (which increments
 * `gateRetry`) never fires — retry budget is preserved (REQ-2).
 */
function buildFailPairKey({ guardrail_id, reason }) {
  return `${guardrail_id}|${normalizeReason(reason)}`;
}

export function assertNoRepeatedFail({ issueLog, phase, currentEvaluations }) {
  if (!RETRY_TRACKED_PHASES.includes(phase)) return;
  const current = buildFailedEvaluations(currentEvaluations);
  if (current.length === 0) return;
  const previous = findPreviousFailedEvaluations({ issueLog, phase });
  if (!previous) return;

  const priorKeys = new Set(previous.map(buildFailPairKey));
  const matched = current.filter((c) => priorKeys.has(buildFailPairKey(c)));
  if (matched.length === 0) return;

  const detail = matched
    .map((m) => `  ${m.guardrail_id}: ${m.reason}`)
    .join("\n");
  const msg = [
    `gate-impl escalation: repeated identical FAIL detected for phase "${phase}".`,
    "Matching (guardrail, reason) pairs:",
    detail,
    "",
    "The AI has failed on the same requirement(s) for the same reason as the previous attempt.",
    "Fix the spec wording or implementation so the failure mode changes, then retry.",
  ].join("\n");
  const err = new Error(msg);
  err.code = "ESCALATE_REPEATED_FAIL";
  err.data = { phase, matched };
  throw err;
}

// ---------------------------------------------------------------------------
// Task-impl / integration: requirements check
// ---------------------------------------------------------------------------

const BASELINE_MISSING_WARNING = "baseline not captured";

function buildImplCheckPrompt(specText, diff, testEvidence, knownIds) {
  const baseline = testEvidence?.baseline ?? null;
  const head = testEvidence?.summary ?? null;
  const hasAnyEvidence = Boolean(baseline || head);
  const lines = [
    "You are an implementation compliance checker.",
    "Check whether each spec requirement has been implemented in the diff.",
    "",
    "OUTPUT FORMAT — strictly required:",
    "Return a single JSON object:",
    '  {"evaluations":[{"guardrail_id":"<requirement-id>","result":"pass"|"fail"|"skip","reason":"<brief>"}]}',
    "",
    "Rules:",
    "- guardrail_id MUST be one of the requirement ids listed below.",
    "- result MUST be one of the lowercase strings: pass, fail, skip.",
    "- Use skip only when the requirement can only be verified by running tests and no execution evidence is provided.",
    "- Output MUST be valid JSON only.",
    "",
  ];

  if (hasAnyEvidence) {
    lines.push(
      "Use the Test Results sections to verify requirements about test execution.",
      "Baseline-vs-head differential rule:",
      "- escalate or FAIL only when head.failed contains an id not present in baseline.failed.",
      "- ids appearing in both baseline.failed and head.failed are pre-existing and must NOT be treated as spec-induced breakage.",
      "- ids only in baseline.failed (resolved) are a positive side-effect.",
    );
    if (!baseline) {
      lines.push(
        `WARNING: ${BASELINE_MISSING_WARNING}. Evaluate head-only; do NOT infer pre-existing vs new without baseline data.`,
      );
    }
  }

  lines.push(
    "",
    "## Requirement IDs",
    knownIds.map((id) => `- ${id}`).join("\n"),
    "",
    "## Spec",
    specText,
    "",
    "## Git Diff",
    diff,
  );

  if (baseline) {
    lines.push("", "## Baseline Test Results", JSON.stringify(baseline));
  }
  if (head) {
    lines.push("", "## Head Test Results", JSON.stringify(head));
  }

  return lines.join("\n");
}

/**
 * Extract requirement ids (REQ-1, REQ-2, ...) from spec.md. Fallback to a
 * single synthetic id when none can be parsed.
 */
function extractRequirementIds(specText) {
  const ids = [];
  const seen = new Set();
  const regex = /\*\*(REQ-[\w-]+)\*\*/g;
  let m;
  while ((m = regex.exec(specText))) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      ids.push(m[1]);
    }
  }
  return ids.length > 0 ? ids : ["REQ-SPEC"];
}

// ---------------------------------------------------------------------------
// Phase → next-step mapping
// ---------------------------------------------------------------------------

const PASS_NEXT = {
  "draft": "spec",
  "spec": "approval",
  "task-spec": "task-impl",
  "task-impl": "review",
  "integration": "review",
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

function reasonsFromEvaluations(evaluations) {
  return (evaluations || []).map((e) => ({
    verdict: e.result === "pass" ? "PASS" : e.result === "fail" ? "FAIL" : "SKIP",
    detail: `${e.title || e.guardrail_id} — ${e.reason}`,
    guardrail_id: e.guardrail_id,
    category: e.category,
  }));
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
 */
async function runGateFlow(args) {
  const {
    root, config, level, phase,
    targetPath, targetText, textCheck, checkerRole, skipGuardrail,
  } = args;

  validateLevelPhase(level, phase);

  const issues = textCheck();
  if (issues.length > 0) {
    return gateFail(level, phase, targetPath, [], issues);
  }

  if (skipGuardrail) {
    return gatePass(level, phase, targetPath, []);
  }

  const result = await checkGuardrail(root, targetText, config, phase, checkerRole);
  if (!result) {
    return gatePass(level, phase, targetPath, []);
  }
  if (!result.passed) {
    return gateFail(level, phase, targetPath, result.evaluations, []);
  }
  return gatePass(level, phase, targetPath, result.evaluations);
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

    if (phase === "draft") {
      return this.executeDraft(ctx, root, level, skipGuardrail);
    }
    if (phase === "task-impl" || phase === "integration") {
      return this.executeDiffBasedGate(ctx, root, level, phase, skipGuardrail);
    }
    if (phase === "task-spec") {
      return this.executeTaskSpec(ctx, root, level, skipGuardrail);
    }
    // "spec" — parent spec.json
    return this.executeSpec(ctx, root, level, skipGuardrail);
  }

  async executeDraft(ctx, root, level, skipGuardrail) {
    const state = ctx.flowState;
    const specDir = state?.spec ? path.dirname(path.resolve(root, state.spec)) : null;
    if (!specDir) throw new Error("no active flow found");

    const draftPath = path.join(specDir, "draft.md");
    if (!fs.existsSync(draftPath)) {
      throw new Error(`draft not found: ${draftPath}`);
    }

    const text = fs.readFileSync(draftPath, "utf8");
    const relPath = path.relative(root, draftPath);

    return runGateFlow({
      root,
      config: ctx.config,
      level,
      phase: "draft",
      targetPath: relPath,
      targetText: text,
      textCheck: () => checkDraftText(text),
      checkerRole:
        "You are a draft compliance checker. Check whether the draft considered each guardrail perspective.",
      skipGuardrail,
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
          : [...checkSpecJson(spec), ...monotonicIssues],
      checkerRole: undefined,
      skipGuardrail,
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

    // spec 209 REQ-6: surface remaining retry budget before running the gate.
    warnGateRetryBudget(ctx, phase);
    // spec 201 P2-R2/R3: refuse to run further retries once the limit is reached.
    const retryFail = checkRetryBelowMax(ctx, phase);
    if (retryFail) return retryFail;

    // spec 222 REQ-1/REQ-2: fail early when head test evidence is missing.
    // Returns ok:false envelope before AI invocation, so gateRetry is not
    // incremented (the registry post-hook never runs on an ok:false return).
    const missingEvidenceFail = checkMissingHeadTestEvidence({ phase, flowState: state });
    if (missingEvidenceFail) return missingEvidenceFail;

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
    const absSpecPath = path.resolve(root, specPath);
    if (!fs.existsSync(absSpecPath)) {
      throw new Error(`spec not found: ${absSpecPath}`);
    }

    const specText = fs.readFileSync(absSpecPath, "utf8");

    // spec 207 / T8: authorized_test_modifications is sourced from spec.json
    // via the single validated load path. loadSpecJson throws if spec.json is
    // missing or invalid — that failure surfaces to the user immediately.
    const spec = loadSpecJson(path.dirname(absSpecPath));
    const authEntries = Array.isArray(spec.authorized_test_modifications)
      ? spec.authorized_test_modifications
      : [];

    const committed = runGitDiff([`${state.baseBranch}...HEAD`], "failed to get git diff", root);
    const uncommitted = runGitDiff(["HEAD"], "failed to get uncommitted git diff", root);
    // spec 221: include untracked new files so test-first additions are
    // visible to the diff-based gate evaluation.
    const untracked = await collectUntrackedDiff(root);
    const diff = committed + uncommitted + untracked;

    if (!diff.trim()) {
      return gateFail(level, phase, specPath, [], [
        "no changes found (committed or uncommitted) against base branch",
      ]);
    }

    // spec 201 P1: mechanical check on test-file changes (replaces retired
    // `impl-test-preservation` AI guardrail). Skips the AI path entirely when
    // the mechanical check already found a violation.
    //
    // spec 205: an optional `## Authorized Existing Test Modifications` section
    // in spec.md can exempt named files from the check. Parse errors in that
    // section are themselves a gate FAIL; unused entries surface as warnings.
    const authResult = parseAuthorizedTestModificationsFromJson(authEntries);
    if (authResult.errors.length > 0) {
      return gateFail(level, phase, specPath, [], authResult.errors);
    }
    const testIssues = checkTestChanges(diff, resolveTestGlobs(ctx.config), authResult.files).issues;
    if (testIssues.length > 0) {
      return gateFail(level, phase, specPath, [], testIssues);
    }
    const unusedWarnings = findUnusedAuthorizations(diff, authResult.files);

    const agent = container.get("agent");
    if (!agent.resolve("flow.spec.gate")) {
      throw new Error(
        "no AI agent configured (agent.default or agent.profiles.<name>.flow.spec.gate)",
      );
    }

    const reqIds = extractRequirementIds(specText);
    const testEvidence = {
      baseline: state?.test?.baseline ?? null,
      summary: state?.test?.summary ?? null,
    };
    if (!testEvidence.baseline) {
      unusedWarnings.push(BASELINE_MISSING_WARNING);
    }
    const reqPrompt = buildImplCheckPrompt(specText, diff, testEvidence, reqIds);
    const reqResponse = await agent.call(reqPrompt, { commandId: "flow.spec.gate" });
    const reqResults = parseEvaluationResponse(reqResponse, reqIds);
    const reqEvaluations = reqResults.map((r) => ({
      ...r,
      title: r.guardrail_id,
      category: "requirements",
    }));

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

    if (skipGuardrail) {
      return gatePass(level, phase, specPath, reqEvaluations, unusedWarnings);
    }

    const grResult = await checkGuardrail(
      root,
      `${specText}\n\n## Git Diff\n${diff}`,
      ctx.config,
      phase,
      "You are an implementation compliance checker. Check the implementation against each guardrail.",
    );
    if (!grResult) {
      return gatePass(level, phase, specPath, reqEvaluations, unusedWarnings);
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
    return gatePass(level, phase, specPath, combined, unusedWarnings);
  }
}

export default RunGateCommand;
export {
  checkSpecText,
  checkSpecJson,
  checkDraftText,
  buildGuardrailPrompt,
  buildImplCheckPrompt,
  checkGuardrail,
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
