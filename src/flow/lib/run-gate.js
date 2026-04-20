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
import { assertOk } from "../../lib/process.js";
import { runGit } from "../../lib/git-helpers.js";
import { container } from "../../lib/container.js";
import { filterByPhase, loadMergedGuardrails } from "../../lib/guardrail.js";
import { getSpecName } from "../../lib/flow-helpers.js";
import { loadTestEvidence } from "./get-test-result.js";
import {
  VALID_GATE_PHASES,
  VALID_GATE_LEVELS,
  VALID_LEVEL_PHASE_COMBINATIONS,
} from "../../lib/constants.js";
import { FlowCommand } from "./base-command.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";
import { resolveGateStepId } from "./gate-step.js";

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

function sectionAt(lines, lineIdx) {
  for (let i = lineIdx - 1; i >= 0; i--) {
    const m = lines[i].match(/^\s*##\s+(.+)/);
    if (m) return m[1].trim();
  }
  return "";
}

// ---------------------------------------------------------------------------
// Text checks — spec (parent-level)
// ---------------------------------------------------------------------------

/**
 * @param {string} text
 * @param {{ strict?: boolean }} [opts] - when strict=true, require User Confirmation approval
 * @returns {string[]} issues
 */
function checkSpecText(text, opts) {
  const strict = opts?.strict ?? false;
  const issues = [];
  const lines = text.split("\n");

  const PRE_SKIP_SECTIONS = /^(Status|Acceptance Criteria|User Scenarios\s*&?\s*Testing|User Confirmation)/i;

  const unresolvedPatterns = [
    /\[NEEDS CLARIFICATION\]/i,
    /\bTBD\b/i,
    /\bTODO\b/i,
    /\bFIXME\b/i,
  ];
  for (const [idx, line] of lines.entries()) {
    if (/^\s*\|/.test(line)) continue;

    for (const p of unresolvedPatterns) {
      if (p.test(line)) {
        issues.push(`line ${idx + 1}: unresolved token (${line.trim()})`);
        break;
      }
    }
    if (/^\s*-\s*\[\s\]\s+/.test(line)) {
      if (!strict) {
        const section = sectionAt(lines, idx);
        if (PRE_SKIP_SECTIONS.test(section)) continue;
      }
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
  } else if (strict) {
    const startMatch = text.match(/^\s*##\s+User Confirmation\b/im);
    const start = startMatch?.index ?? -1;
    const tail = start >= 0 ? text.slice(start) : "";
    const nextHeading = tail.slice(1).match(/\n\s*##\s+/m);
    const end = nextHeading ? start + 1 + (nextHeading.index ?? 0) : text.length;
    const block = start >= 0 ? text.slice(start, end) : "";
    const hasApproval =
      /-\s*\[\s*x\s*\]\s*(?:User approved this spec|この仕様で実装して問題ない)\b/i.test(block);
    if (!hasApproval) {
      issues.push(
        "user confirmation is required: set `- [x] User approved this spec` in ## User Confirmation",
      );
    }
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
// Text checks — draft
// ---------------------------------------------------------------------------

function buildDraftFieldPattern(labels) {
  return new RegExp(`(?:^\\s*##\\s+(?:${labels})|\\*{0,2}(?:${labels})\\*{0,2}\\s*[:：])`, "im");
}

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
  }

  if (!buildDraftFieldPattern("目的|goal").test(text)) {
    issues.push("missing goal (目的)");
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
// Task-impl / integration: requirements check
// ---------------------------------------------------------------------------

function buildImplCheckPrompt(specText, diff, testEvidence, knownIds) {
  const hasEvidence = testEvidence && (testEvidence.summary || testEvidence.log);
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

  if (hasEvidence) {
    lines.push(
      "Use the Test Execution Evidence section to verify requirements that refer to test execution results.",
    );
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

  if (hasEvidence) {
    lines.push("", "## Test Execution Evidence");
    if (testEvidence.summary) {
      lines.push("Test summary: " + JSON.stringify(testEvidence.summary));
    }
    if (testEvidence.log) {
      lines.push("", "Test output:", testEvidence.log);
    }
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

function gatePass(level, phase, targetPath, evaluations) {
  return {
    result: "pass",
    changed: [],
    artifacts: {
      target: targetPath,
      level,
      phase,
      evaluations: evaluations || [],
      reasons: reasonsFromEvaluations(evaluations),
    },
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

export class RunGateCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const phase = ctx.phase || "spec";

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
    // "spec" and "task-spec"
    return this.executeSpec(ctx, root, level, phase, skipGuardrail);
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

  async executeSpec(ctx, root, level, phase, skipGuardrail) {
    const spec = ctx.spec || "";
    // "spec" phase uses lenient check (before approval); "task-spec" also lenient for now.
    const strict = false;

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
      phase,
      targetPath: specPath,
      targetText: text,
      textCheck: () => checkSpecText(text, { strict }),
      checkerRole: undefined,
      skipGuardrail,
    });
  }

  async executeDiffBasedGate(ctx, root, level, phase, skipGuardrail) {
    const state = ctx.flowState;
    if (!state?.spec) throw new Error("no active flow found");
    if (!state.baseBranch) throw new Error("baseBranch not set in flow.json");

    const specPath = state.spec;
    const absSpecPath = path.resolve(root, specPath);
    if (!fs.existsSync(absSpecPath)) {
      throw new Error(`spec not found: ${absSpecPath}`);
    }

    const specText = fs.readFileSync(absSpecPath, "utf8");

    const committed = runGitDiff([`${state.baseBranch}...HEAD`], "failed to get git diff", root);
    const uncommitted = runGitDiff(["HEAD"], "failed to get uncommitted git diff", root);
    const diff = committed + uncommitted;

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

    const reqIds = extractRequirementIds(specText);
    const testEvidence = loadTestEvidence(root, ctx.config, state);
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
      return gateFail(level, phase, specPath, reqEvaluations, []);
    }

    if (skipGuardrail) {
      return gatePass(level, phase, specPath, reqEvaluations);
    }

    const grResult = await checkGuardrail(
      root,
      `${specText}\n\n## Git Diff\n${diff}`,
      ctx.config,
      phase,
      "You are an implementation compliance checker. Check the implementation against each guardrail.",
    );
    if (!grResult) {
      return gatePass(level, phase, specPath, reqEvaluations);
    }
    const combined = [...reqEvaluations, ...grResult.evaluations];
    if (!grResult.passed) {
      return gateFail(level, phase, specPath, combined, []);
    }
    return gatePass(level, phase, specPath, combined);
  }
}

export default RunGateCommand;
export {
  checkSpecText,
  checkDraftText,
  buildGuardrailPrompt,
  checkGuardrail,
};

export function appendIssueLogFromGateResult(ctx, result) {
  const issueLog = loadIssueLog(ctx.root, ctx.flowState?.spec);
  const reasons = result?.artifacts?.issues?.length
    ? result.artifacts.issues.join("; ")
    : (result?.artifacts?.reasons || []).map((r) => r.detail || r).join("; ");
  issueLog.entries.push({
    step: resolveGateStepId(ctx.phase),
    level: result?.artifacts?.level,
    phase: result?.artifacts?.phase,
    reason: reasons || "gate FAIL (no details)",
    trigger: "gate post hook (auto)",
    timestamp: new Date().toISOString(),
  });
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
