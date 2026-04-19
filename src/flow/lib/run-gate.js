/**
 * src/flow/lib/run-gate.js
 *
 * FlowCommand: gate — check deliverable readiness for each phase.
 *
 * Phases:
 *   draft — check draft.md structure + guardrail compliance
 *   pre   — check spec.md structure + guardrail compliance (default, before approval)
 *   post  — check spec.md structure (stricter) + guardrail compliance (after approval)
 *   impl  — check spec requirements + git diff + guardrail compliance
 */

import fs from "fs";
import path from "path";
import { assertOk } from "../../lib/process.js";
import { runGit } from "../../lib/git-helpers.js";
import { container } from "../../lib/container.js";
import { filterByPhase, loadMergedGuardrails } from "../../lib/guardrail.js";
import { getSpecName } from "../../lib/flow-helpers.js";
import { loadTestEvidence } from "./get-test-result.js";
import { VALID_GATE_PHASES } from "../../lib/constants.js";
import { FlowCommand } from "./base-command.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run `git diff <args>` and return stdout. Throws if the command fails.
 * @param {string[]} args - git diff arguments
 * @param {string} errorMessage - context for error
 * @param {string} cwd - working directory
 * @returns {string}
 */
function runGitDiff(args, errorMessage, cwd) {
  const res = runGit(["diff", ...args], { cwd });
  assertOk(res, errorMessage);
  return res.stdout;
}

/**
 * Detect which section a line belongs to by scanning headings above it.
 */
function sectionAt(lines, lineIdx) {
  for (let i = lineIdx - 1; i >= 0; i--) {
    const m = lines[i].match(/^\s*##\s+(.+)/);
    if (m) return m[1].trim();
  }
  return "";
}

// ---------------------------------------------------------------------------
// Text checks — spec (pre/post)
// ---------------------------------------------------------------------------

/**
 * @param {string} text
 * @param {{ phase?: "pre"|"post" }} [opts]
 * @returns {string[]} issues
 */
function checkSpecText(text, opts) {
  const phase = opts?.phase || "pre";
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
      if (phase === "pre") {
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
  } else if (phase === "post") {
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

/**
 * Build a regex that matches a draft field by either:
 *   - `## Heading` format (anchored to line start with `m` flag)
 *   - `**key:** value` or `key: value` colon format
 *
 * @param {string} labels - regex alternation of field name variants (e.g. "目的|goal")
 * @returns {RegExp}
 */
function buildDraftFieldPattern(labels) {
  return new RegExp(`(?:^\\s*##\\s+(?:${labels})|\\*{0,2}(?:${labels})\\*{0,2}\\s*[:：])`, "im");
}

/**
 * @param {string} text
 * @returns {string[]} issues
 */
function checkDraftText(text) {
  const issues = [];

  // Q&A section
  if (!/##\s+Q&A/i.test(text)) {
    issues.push("missing Q&A section");
  }

  // User approval checkbox (checked)
  const hasApproval =
    /-\s*\[\s*x\s*\]\s*(?:User approved this draft|ユーザーがこの draft を承認した)/i.test(text);
  if (!hasApproval) {
    issues.push("draft approval is required: set `- [x] User approved this draft`");
  }

  // Development type — accepts both colon format and ## heading format (line-anchored)
  if (!buildDraftFieldPattern("開発種別|dev(?:elopment)?\\s*type").test(text)) {
    issues.push("missing development type (開発種別)");
  }

  // Goal — accepts both colon format and ## heading format (line-anchored)
  if (!buildDraftFieldPattern("目的|goal").test(text)) {
    issues.push("missing goal (目的)");
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Guardrail AI check — shared
// ---------------------------------------------------------------------------

/**
 * Impl-phase instruction: restrict violation judgment to added/changed diff lines
 * so pre-existing code is not flagged as a FAIL (Issue #180).
 */
const IMPL_DIFF_SCOPE_LINES = [
  "## Diff Scope Constraint",
  "The content includes a `## Git Diff` section. Restrict violation judgment to code changes",
  "actually introduced by this diff — that is, lines added or modified (lines starting with `+`",
  "in the diff). Context lines (unchanged, pre-existing code shown without `+`/`-` markers, or",
  "removed-only `-` lines that are not being replaced) MUST NOT be counted as violations of any",
  "guardrail. If a pattern that appears to violate a guardrail exists only in pre-existing,",
  "unchanged code, mark the article as PASS with a reason stating the violation is out of diff scope.",
  "",
];

/**
 * Build AI prompt for guardrail compliance check.
 * @param {string} targetText - text to check (spec, draft, or requirements+diff)
 * @param {Array} guardrails - all guardrails (pre-filtered)
 * @param {string} phase - guardrail phase to filter
 * @param {string} [role] - checker role description override
 */
function buildGuardrailPrompt(targetText, guardrails, phase, role) {
  const filtered = filterByPhase(guardrails, phase);
  if (filtered.length === 0) return null;

  const articleList = filtered.map((g, i) =>
    `${i + 1}. **${g.title}**: ${g.body.trim()}`
  ).join("\n");

  const checkerRole = role || `You are a ${phase} compliance checker.`;

  const parts = [
    `${checkerRole} Check the following content against each guardrail article.`,
    "For each article, output exactly one line in this format:",
    "  PASS: <article title> — <brief reason>",
    "  FAIL: <article title> — <brief reason>",
    "",
    "If an article is inapplicable by nature of the content, mark it as PASS and state the reason.",
    "",
    "Output ONLY the result lines. No preamble, no summary.",
    "",
  ];

  if (phase === "impl") {
    parts.push(...IMPL_DIFF_SCOPE_LINES);
  }

  parts.push(
    "## Guardrail Articles",
    articleList,
    "",
    `## Content`,
    targetText,
  );

  return parts.join("\n");
}

/**
 * Parse AI response into per-article results.
 * Recognizes PASS, FAIL, and SKIP lines.
 * SKIP indicates a requirement that cannot be verified without test execution.
 */
function parseGuardrailResponse(response) {
  const results = [];
  for (const line of response.split("\n")) {
    const skipM = line.match(/^SKIP\s*(?:\([^)]*\))?\s*:\s*(.+?)\s*[—–-]\s*(.+)/);
    if (skipM) {
      results.push({
        title: skipM[1].trim(),
        passed: false,
        skipped: true,
        reason: skipM[2].trim(),
      });
      continue;
    }
    const m = line.match(/^(PASS|FAIL):\s*(.+?)\s*[—–-]\s*(.+)/);
    if (m) {
      results.push({
        title: m[2].trim(),
        passed: m[1] === "PASS",
        skipped: false,
        reason: m[3].trim(),
      });
    }
  }
  return results;
}

/**
 * Run guardrail AI compliance check for a given phase.
 * @param {string} root
 * @param {string} targetText - text to check
 * @param {Object} config
 * @param {string} phase - "draft" | "spec" | "impl"
 * @param {string} [role] - checker role override
 */
async function checkGuardrail(root, targetText, _config, phase, role) {
  const guardrails = loadMergedGuardrails(root);
  if (guardrails.length === 0) return null;

  const agent = container.get("agent");
  if (!agent.resolve("flow.spec.gate")) return null;

  const prompt = buildGuardrailPrompt(targetText, guardrails, phase, role);
  if (!prompt) return { passed: true, results: [] };

  const response = await agent.call(prompt, { commandId: "flow.spec.gate" });
  const results = parseGuardrailResponse(response);
  const passed = results.length > 0 && results.every((r) => r.passed);

  return { passed, results };
}

// ---------------------------------------------------------------------------
// Impl-specific: requirements check
// ---------------------------------------------------------------------------

/**
 * Build AI prompt for implementation requirements check.
 * @param {string} specText
 * @param {string} diff
 * @param {{ summary: Object|null, log: string|null }|null} testEvidence
 */
function buildImplCheckPrompt(specText, diff, testEvidence) {
  const hasEvidence = testEvidence && (testEvidence.summary || testEvidence.log);
  const lines = [
    "You are an implementation compliance checker.",
    "Check whether each requirement in the spec has been implemented in the diff.",
    "For each requirement, output exactly one line in this format:",
    "  PASS: <requirement summary> — <brief reason>",
    "  FAIL: <requirement summary> — <brief reason>",
    "",
  ];

  if (hasEvidence) {
    lines.push(
      "Some requirements may refer to test execution results. Use the Test Execution Evidence",
      "section below to verify those requirements.",
    );
  } else {
    lines.push(
      "No test execution evidence is available. Requirements that can only be verified by",
      "running tests (e.g. 'tests pass', 'no regressions') cannot be determined from the diff.",
      "For such requirements, output:",
      "  SKIP (execution required): <requirement summary> — cannot verify without test execution",
    );
  }

  lines.push(
    "",
    "Output ONLY the result lines. No preamble, no summary.",
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

// ---------------------------------------------------------------------------
// Phase → next-step mapping
// ---------------------------------------------------------------------------

const PASS_NEXT = { draft: "spec", pre: "approval", post: "approval", impl: "review" };
const FAIL_NEXT = { draft: "draft", pre: "spec", post: "spec", impl: "implement" };

// ---------------------------------------------------------------------------
// Result builders
// ---------------------------------------------------------------------------

function gatePass(phase, targetPath, reasons) {
  return {
    result: "pass",
    changed: [],
    artifacts: { target: targetPath, phase, reasons },
    next: PASS_NEXT[phase],
  };
}

function gateFail(phase, targetPath, reasons, issues) {
  return {
    result: "fail",
    changed: [],
    artifacts: { target: targetPath, phase, reasons, issues },
    next: FAIL_NEXT[phase],
  };
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export class RunGateCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const phase = ctx.phase || "pre";

    if (!VALID_GATE_PHASES.includes(phase)) {
      throw new Error(`invalid phase: ${phase} (valid: ${VALID_GATE_PHASES.join(", ")})`);
    }

    const skipGuardrail = ctx.skipGuardrail || false;

    if (phase === "draft") {
      return this.executeDraft(ctx, root, skipGuardrail);
    }
    if (phase === "impl") {
      return this.executeImpl(ctx, root, skipGuardrail);
    }
    return this.executeSpec(ctx, root, phase, skipGuardrail);
  }

  /**
   * Gate draft: check draft.md structure + guardrail AI compliance.
   */
  async executeDraft(ctx, root, skipGuardrail) {
    const state = ctx.flowState;
    const specDir = state?.spec ? path.dirname(path.resolve(root, state.spec)) : null;
    if (!specDir) throw new Error("no active flow found");

    const draftPath = path.join(specDir, "draft.md");
    if (!fs.existsSync(draftPath)) {
      throw new Error(`draft not found: ${draftPath}`);
    }

    const text = fs.readFileSync(draftPath, "utf8");
    const relPath = path.relative(root, draftPath);

    // Text structure check
    const issues = checkDraftText(text);
    if (issues.length > 0) {
      return gateFail("draft", relPath, [], issues);
    }

    // Guardrail AI check
    const reasons = [];
    if (!skipGuardrail) {
      const result = await checkGuardrail(
        root, text, ctx.config, "draft",
        "You are a draft compliance checker. Check whether the draft considered each guardrail perspective.",
      );
      if (result) {
        for (const r of result.results) {
          reasons.push({ verdict: r.passed ? "PASS" : "FAIL", detail: `${r.title} — ${r.reason}` });
        }
        if (!result.passed) {
          return gateFail("draft", relPath, reasons, []);
        }
      }
    }

    return gatePass("draft", relPath, reasons);
  }

  /**
   * Gate spec (pre/post): check spec.md structure + guardrail AI compliance.
   */
  async executeSpec(ctx, root, phase, skipGuardrail) {
    const spec = ctx.spec || "";
    const resolvedPhase = phase === "post" ? "post" : "pre";

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

    // Text-based checks
    const issues = checkSpecText(text, { phase: resolvedPhase });
    if (issues.length > 0) {
      return gateFail(resolvedPhase, specPath, [], issues);
    }

    // Guardrail AI compliance check
    const reasons = [];
    if (!skipGuardrail) {
      const result = await checkGuardrail(root, text, ctx.config, "spec");
      if (result) {
        for (const r of result.results) {
          reasons.push({ verdict: r.passed ? "PASS" : "FAIL", detail: `${r.title} — ${r.reason}` });
        }
        if (!result.passed) {
          return gateFail(resolvedPhase, specPath, reasons, []);
        }
      }
    }

    return gatePass(resolvedPhase, specPath, reasons);
  }

  /**
   * Gate impl: check spec requirements against git diff + guardrail AI compliance.
   */
  async executeImpl(ctx, root, skipGuardrail) {
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
      return gateFail("impl", specPath, [], ["no changes found (committed or uncommitted) against base branch"]);
    }

    // Requirements check via AI
    const agent = container.get("agent");
    if (!agent.resolve("flow.spec.gate")) throw new Error("no AI agent configured (agent.default or agent.profiles.<name>.flow.spec.gate)");

    const testEvidence = loadTestEvidence(root, ctx.config, state);
    const reqPrompt = buildImplCheckPrompt(specText, diff, testEvidence);
    const reqResponse = await agent.call(reqPrompt, { commandId: "flow.spec.gate" });
    const reqResults = parseGuardrailResponse(reqResponse);

    const reasons = reqResults.map((r) => ({
      verdict: r.skipped ? "SKIP" : (r.passed ? "PASS" : "FAIL"),
      detail: `${r.title} — ${r.reason}`,
    }));

    // SKIP is acceptable (requirement needs test execution to verify)
    const reqPassed = reqResults.length > 0 && reqResults.every((r) => r.passed || r.skipped);
    if (!reqPassed) {
      return gateFail("impl", specPath, reasons, []);
    }

    // Guardrail AI check
    if (!skipGuardrail) {
      const grResult = await checkGuardrail(
        root, `${specText}\n\n## Git Diff\n${diff}`, ctx.config, "impl",
        "You are an implementation compliance checker. Check the implementation against each guardrail.",
      );
      if (grResult) {
        for (const r of grResult.results) {
          reasons.push({ verdict: r.passed ? "PASS" : "FAIL", detail: `${r.title} — ${r.reason}` });
        }
        if (!grResult.passed) {
          return gateFail("impl", specPath, reasons, []);
        }
      }
    }

    return gatePass("impl", specPath, reasons);
  }
}

export default RunGateCommand;
export { checkSpecText, checkDraftText, buildGuardrailPrompt, parseGuardrailResponse, checkGuardrail, IMPL_DIFF_SCOPE_LINES };

/**
 * Resolve the step id targeted by a `gate` invocation.
 * Mirrors the dispatcher-side helper used by the gate registry hooks.
 * @param {string} [phase]
 * @returns {string}
 */
export function resolveGateStepId(phase) {
  if (phase === "draft") return "gate-draft";
  if (phase === "impl") return "gate-impl";
  return "gate";
}

/**
 * Append an issue-log entry summarising a gate failure result.
 * Used by registry's gate post hook to keep domain logic out of the
 * registry layer.
 * @param {Object} ctx - dispatcher ctx (root, flowState, phase)
 * @param {Object} result - gate result envelope.data
 */
export function appendIssueLogFromGateResult(ctx, result) {
  const issueLog = loadIssueLog(ctx.root, ctx.flowState?.spec);
  const reasons = result?.artifacts?.issues?.length
    ? result.artifacts.issues.join("; ")
    : (result?.artifacts?.reasons || []).map((r) => r.detail || r).join("; ");
  issueLog.entries.push({
    step: resolveGateStepId(ctx.phase),
    reason: reasons || "gate FAIL (no details)",
    trigger: "gate post hook (auto)",
    timestamp: new Date().toISOString(),
  });
  saveIssueLog(ctx.root, ctx.flowState?.spec, issueLog);
}

/**
 * Append an issue-log entry recording a thrown error from the gate command.
 * Used by registry's gate onError hook.
 * @param {Object} ctx - dispatcher ctx (root, flowState, phase)
 * @param {Error} err
 */
export function appendIssueLogFromGateError(ctx, err) {
  const issueLog = loadIssueLog(ctx.root, ctx.flowState?.spec);
  issueLog.entries.push({
    step: resolveGateStepId(ctx.phase),
    reason: err.message || String(err),
    trigger: "gate onError hook (auto)",
    timestamp: new Date().toISOString(),
  });
  saveIssueLog(ctx.root, ctx.flowState?.spec, issueLog);
}
