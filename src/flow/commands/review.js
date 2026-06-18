#!/usr/bin/env node
/**
 * src/flow/commands/review.js
 *
 * senti flow review — code quality review after implementation.
 * Phases: confirm → draft (propose) → approve → apply
 *
 * --phase test: one-shot static test review before impl.
 * The test review writes requirement-to-test coverage evidence and structured
 * findings; it does not auto-fix tests.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parseArgs, PKG_DIR } from "../../lib/cli.js";
import { getSpecName } from "../../lib/flow-helpers.js";
import { loadSpecJson, resolveSpecDir } from "../../lib/spec-json.js";
import { repairJson } from "../../lib/json-parse.js";
import { resolveIncludes } from "../../lib/include.js";
import {
  WorkUnitCheckpointStore,
  WorkUnitResumeDecision,
  WorkUnitToolingFailure,
  classifyWorkUnitFailure,
  createCrossCheckWorkUnitIdentity,
  createLoopChunkWorkUnitIdentity,
  planFallbackChildWorkUnits,
  shouldFallbackSplit,
} from "../lib/work-unit.js";

async function loadReqMap(root, flow, kind) {
  try {
    const { loadFileMap } = await import("../lib/req-map.js");
    const specDir = resolveSpecDir(path.resolve(root, flow.spec));
    if (kind === "test") {
      // spec 249: test coverage is determined by file headers, not test-map.json.
      // Return null to disable the legacy test-map untested warning path; the
      // header-based untested warning (below) supersedes it.
      return null;
    }
    return loadFileMap(specDir);
  } catch (err) {
    process.stderr.write(`  [review] ${kind}-map load skipped: ${err.message}\n`);
    return null;
  }
}
import { container, initContainer } from "../../lib/container.js";
import { Command } from "../../lib/command.js";
import { PromptBuilder } from "../../lib/prompt-builder.js";
import { buildAcknowledgedRationaleSection } from "../lib/acknowledged-rationale.js";
import { validateSchema } from "../../lib/schema-validate.js";
import { ReviewFailure } from "../lib/review-failure.js";
import { draftReviewRouteForKey } from "../lib/draft-review-routes.js";
import {
  contractFromImplReviewArtifact,
  contractFromTestReviewArtifact,
} from "../lib/flow-judgment-contract.js";

/**
 * Local helper for review-phase agent invocations. The Agent service handles
 * timeout and cwd internally; callers only provide the system prompt and
 * (optionally) commandId.
 */
const callReviewAgent = (agent, prompt, commandId, systemPrompt) => {
  if (prompt && typeof prompt === "object" && "userPrompt" in prompt) {
    return agent.call(prompt.userPrompt, {
      commandId,
      systemPrompt: prompt.systemPrompt ?? systemPrompt,
      jsonSchema: prompt.jsonSchema ?? null,
      fmtFallback: prompt.fmtFallback ?? null,
    });
  }
  return agent.call(prompt, { commandId, systemPrompt });
};

function ensureAgent(commandId) {
  const agent = container.get("agent");
  if (!agent.resolve(commandId)) {
    throw new Error(`no AI agent configured for ${commandId} (set agent.default in config.json)`);
  }
  return agent;
}
import { runGit } from "../../lib/git-helpers.js";
import { EXIT_ERROR } from "../../lib/constants.js";
import { VALID_PHASES } from "../../lib/constants.js";
import { loadMergedGuardrails, filterByPhase } from "../../lib/guardrail.js";
import { resolveMaxAttempts } from "../definition.js";
import { flattenSteps } from "../lib/step-tree.js";

const REVIEW_PHASE_NODE_MAP = {
  "draft-questions": "draft-questions-review",
  "draft-coverage": "draft-coverage-review",
  spec: "spec-review",
  test: "test-review",
};
const DRAFT_QA_RULES_PARTIAL_PATH = path.join(PKG_DIR, "flow", "prompts", "partials", "draft-qa-rules.md");
let cachedDraftQaRulesPartial = null;

function getReviewMaxAttempts(phase, attemptContext) {
  const nodeId = REVIEW_PHASE_NODE_MAP[phase];
  if (!nodeId) throw new Error(`unsupported review maxAttempts phase: ${phase}`);
  if (!attemptContext || typeof attemptContext !== "object") {
    throw new Error(`review maxAttempts resolution requires explicit context for phase: ${phase}`);
  }
  return resolveMaxAttempts({ scope: "flow", stepId: nodeId, context: attemptContext });
}

function resolveDraftReviewStage(flow) {
  const steps = Array.isArray(flow?.steps) ? flattenSteps(flow.steps) : [];
  const byId = new Map(steps.map((step) => [step.id, step]));
  if (byId.get("draft-coverage-review")?.status === "in_progress") {
    return buildDraftReviewStage("coverage", {
      commandId: "flow.draft.review.coverage.propose",
      findingClassification: "blocking",
      countLabel: "findings",
      tag: "draft-review-coverage",
    });
  }
  return buildDraftReviewStage("questions", {
    commandId: "flow.draft.review.questions.propose",
    findingClassification: "repair_target",
    countLabel: "questions",
    tag: "draft-review-questions",
  });
}

const LOOP_REVIEW_THRESHOLD = 10;
const MAX_LOOP_CALLS = 16;

/** Supported review phases and their descriptions. */
const REVIEW_PHASES = {
  test: "test sufficiency",
  spec: "spec completeness",
  draft: "draft QA quality",
};

// Validate REVIEW_PHASES keys are a subset of VALID_PHASES
for (const key of Object.keys(REVIEW_PHASES)) {
  if (!VALID_PHASES.includes(key)) {
    throw new Error(`REVIEW_PHASES key '${key}' is not in VALID_PHASES`);
  }
}

/**
 * Resolve the merge-base SHA between HEAD and baseBranch. Throws with a
 * message that names `merge-base` and includes captured stderr when git
 * reports an error or returns an empty SHA.
 *
 * @param {string} root - repo root
 * @param {string} baseBranch - name/ref of the base branch
 * @returns {string} merge-base SHA (full)
 */
function resolveMergeBase(root, baseBranch) {
  const res = runGit(["-C", root, "merge-base", "HEAD", baseBranch]);
  if (!res.ok) {
    throw new Error(`git merge-base HEAD ${baseBranch} failed: ${res.stderr.trim()}`);
  }
  const sha = res.stdout.trim();
  if (!sha) {
    throw new Error(
      `git merge-base HEAD ${baseBranch} produced empty output (stderr: ${res.stderr.trim()})`,
    );
  }
  return sha;
}

/**
 * Resolve review target files from spec scope or git diff fallback.
 *
 * @param {string} root - repo root
 * @param {import("../../lib/flow-state.js").FlowState} flow - flow state
 * @param {string} mergeBase - merge-base SHA resolved by resolveMergeBase
 * @returns {string} diff text for review
 */
function resolveReviewTarget(root, flow, mergeBase) {
  // spec 207 / T8: read scope.in from spec.json via the single validated load
  // path. Throws when spec.json is missing or invalid — active flows must
  // have a valid spec.json by invariant.
  const specInput = path.resolve(root, flow.spec);
  const spec = loadSpecJson(specInput);
  const scopeFiles = Array.isArray(spec.scope?.in)
    ? spec.scope.in
        .map((l) => l.replace(/`/g, "").trim())
        .filter((l) => /\.(js|ts|json|md)$/.test(l))
    : [];

  if (scopeFiles.length > 0) {
    const diffs = [];
    for (const f of scopeFiles) {
      const abs = path.resolve(root, f);
      if (!fs.existsSync(abs)) continue;
      diffs.push(...collectCommittedAndStagedDiff(root, mergeBase, f));
    }
    if (diffs.length > 0) return diffs.join("\n");
  }

  // Fallback: committed diff against merge-base + staged changes
  return collectCommittedAndStagedDiff(root, mergeBase).join("\n");
}

/** Paths excluded from the fallback (whole-repo) diff in code review.
 *  These are auto-generated by senti pipelines and overwritten on build. */
const REVIEW_EXCLUDE_PATHS = ["docs/", "README.md", "AGENTS.md", ".senti/output/"];

function resolveReviewExcludePaths(config = {}) {
  const configured = config?.flow?.review?.excludePaths;
  return [...REVIEW_EXCLUDE_PATHS, ...(Array.isArray(configured) ? configured : [])];
}

function createReviewExcludeMatcher({ root, exclusions = REVIEW_EXCLUDE_PATHS }) {
  const normalizedRoot = root ? path.resolve(root) : null;
  const rules = exclusions.map((rule) => rule.split(path.sep).join("/").replace(/^\.\//, ""));
  const escapeRegexLiteral = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  const toRepoPath = (input) => {
    let value = String(input).split(path.sep).join("/");
    if (normalizedRoot && path.isAbsolute(input)) value = path.relative(normalizedRoot, input).split(path.sep).join("/");
    return value.replace(/^\.\//, "");
  };
  const excludes = (input) => {
    const repoPath = toRepoPath(input);
    return rules.some((rule) => {
      if (rule.endsWith("/")) return repoPath.startsWith(rule);
      if (rule.includes("*")) {
        const re = new RegExp(`^${rule.split("*").map(escapeRegexLiteral).join(".*")}$`);
        return re.test(repoPath);
      }
      return repoPath === rule || repoPath.startsWith(`${rule}/`);
    });
  };
  return {
    excludes,
    filter: (files) => files.filter((file) => !excludes(file)),
  };
}

/**
 * Build pathspec args for git diff.
 * When filePath is given, scopes to that single file.
 * Otherwise, includes all files except REVIEW_EXCLUDE_PATHS.
 * @param {string} [filePath]
 * @returns {string[]}
 */
function buildReviewPathspec(filePath, exclusions = REVIEW_EXCLUDE_PATHS) {
  if (filePath) return ["--", filePath];
  return ["--", ".", ...exclusions.map((p) => `:!${p}`)];
}

/**
 * Run git diff and return stdout, throwing on failure.
 * @param {string} root
 * @param {string[]} diffArgs - args between "diff" and pathspec
 * @param {string[]} pathspec - pathspec args from buildReviewPathspec
 * @param {string} label - human-readable label for error messages
 * @returns {string} trimmed stdout (may be empty)
 */
function runDiffOrThrow(root, diffArgs, pathspec, label) {
  const res = runGit(["-C", root, "diff", ...diffArgs, ...pathspec]);
  if (!res.ok) throw new Error(`${label} failed: ${res.stderr}`);
  return res.stdout.trim();
}

/**
 * Iterate the two review diff sources (committed vs baseRef, then staged)
 * and call `fn` for each. Keeps both `collectCommittedAndStagedDiff` and
 * `collectTouchedFiles` in sync when the set of sources changes.
 * @param {string} baseRef
 * @param {(source: { args: string[], label: string }) => void} fn
 */
function forEachReviewDiffSource(baseRef, fn) {
  fn({ args: [baseRef], label: `git diff ${baseRef}` });
  fn({ args: ["--cached"], label: "git diff --cached" });
}

/**
 * Collect non-empty committed (vs base) and staged diff outputs.
 * @param {string} root
 * @param {string} baseRef - diff starting point (merge-base SHA recommended)
 * @param {string} [filePath] - optional path to scope the diff to
 * @returns {string[]} array of non-empty diff outputs
 */
function collectCommittedAndStagedDiff(root, baseRef, filePath, exclusions = REVIEW_EXCLUDE_PATHS) {
  const pathspec = buildReviewPathspec(filePath, exclusions);
  const out = [];
  forEachReviewDiffSource(baseRef, ({ args, label }) => {
    const text = runDiffOrThrow(root, args, pathspec, label);
    if (text) out.push(text);
  });
  return out;
}

/**
 * Build system prompt for the draft phase.
 * @param {Object[]} [guardrails=[]] - Pre-filtered guardrail articles (phase:review)
 */
function buildDraftSystemPrompt(guardrails = [], options = {}) {
  const pb = new PromptBuilder();
  pb.setRole("You are a code quality reviewer. Analyze the following code changes and propose improvements.");

  const rules = [
    "Focus on:",
    "- Duplicate code elimination",
    "- Naming improvements",
    "- Dead code removal",
    "- Design pattern consistency",
    "- Simplification opportunities",
    "",
    "Scope constraint (MANDATORY):",
    "- Propose changes ONLY for files that appear in the diff you are given (the touched files of this change set).",
    "- Do not propose changes to files outside the diff, even if you believe they could be improved.",
    "- Every proposal MUST include a '**File:** <path>' line pointing to a file present in the diff. Proposals without this line will be discarded.",
    "",
    "Output a numbered list of proposals in this format:",
    "### 1. <title>",
    "**File:** `<path>`",
    "**Issue:** <description of the problem>",
    "**Suggestion:** <concrete improvement>",
    "",
    "If no improvements are needed, output: NO_PROPOSALS",
  ].join("\n");
  pb.setRules(rules);

  if (guardrails.length > 0) {
    const guardrailLines = [
      "Also check the code against the following project-specific guardrail articles.",
      "If a violation is found, report it as a proposal using the same format above.",
      "",
    ];
    for (const g of guardrails) {
      guardrailLines.push(`- id: ${g.id}`);
      guardrailLines.push(`  title: ${g.title}`);
      guardrailLines.push(`  body: ${g.body.trim()}`);
    }
    pb.addSystemPrompt("## Additional Guardrail Review Perspectives", guardrailLines.join("\n"));
    if (options?.acknowledgedRationale?.markdown) {
      pb.addUserRaw(options.acknowledgedRationale.markdown);
    }
  }

  const built = pb.build();
  return built.systemPrompt + (built.userPrompt ? "\n\n" + built.userPrompt : "");
}

function buildReviewAcknowledgedRationale(root, flow, guardrails) {
  let spec = null;
  try {
    if (flow?.spec) spec = loadSpecJson(path.resolve(root, flow.spec));
  } catch (err) {
    process.stderr.write(
      `  [review] acknowledged rationale context unavailable: ${err.message}\n`,
    );
  }
  return {
    acknowledgedRationale: buildAcknowledgedRationaleSection({ spec, guardrails }),
  };
}

/**
 * Parse proposals from draft output.
 * Also extracts the first '**File:** <path>' marker in the body (if any).
 * @param {string} text
 * @param {{limit?: number}} [options]
 * @returns {{ title: string, body: string, file: string|null }[]}
 */
function parseProposals(text, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit >= 0 ? options.limit : Infinity;
  const proposals = [];
  const parts = text.split(/^### /m).filter(Boolean);
  for (const part of parts) {
    if (proposals.length >= limit) break;
    const nlIdx = part.indexOf("\n");
    const title = nlIdx >= 0 ? part.slice(0, nlIdx).trim() : part.trim();
    const body = nlIdx >= 0 ? part.slice(nlIdx + 1).trim() : "";
    proposals.push({ title, body, file: extractProposalFile(body) });
  }
  return proposals;
}

function formatCodebaseContextForPrompt(contextEntries) {
  const contextText = contextEntries.map((e) =>
    `- **${e.file}**: ${e.summary || "(no summary)"}`
  ).join("\n");
  return ["以下のファイルは spec との関連度順に並んでいます。", contextText].join("\n");
}

/**
 * Extract the file path from a proposal body's '**File:**' marker.
 * Accepts `**File:** `path`` or `**File:** path` forms.
 * @param {string} body
 * @returns {string|null}
 */
function extractProposalFile(body) {
  if (!body) return null;
  const m = body.match(/\*\*File:\*\*\s*`?([^`\n]+?)`?\s*$/m);
  if (!m) return null;
  const file = m[1].trim();
  return file || null;
}

/**
 * Collect the set of files touched by the current change set.
 * The "touched" set is the union of:
 *   - files changed in the committed diff against baseRef (`git diff <baseRef>`)
 *   - files changed in the staged (index) diff (`git diff --cached`)
 * Untracked files that are not staged are intentionally NOT included — this
 * matches the review pipeline's scope, which only considers changes that are
 * either committed on the feature branch or staged for commit.
 * @param {string} root
 * @param {string} baseRef - diff starting point (merge-base SHA recommended)
 * @returns {Set<string>}
 */
function collectTouchedFiles(root, baseRef, options = {}) {
  const touched = new Set();
  const matcher = options.excludeMatcher || null;
  forEachReviewDiffSource(baseRef, ({ args, label }) => {
    const res = runGit(["-C", root, "diff", "--name-only", ...args]);
    if (!res.ok) throw new Error(`git diff --name-only (${label}) failed: ${res.stderr}`);
    for (const line of res.stdout.split("\n")) {
      const p = line.trim();
      if (p && !matcher?.excludes(p)) touched.add(p);
    }
  });
  return touched;
}

function prepareLoopReviewInputsWithExclusions({
  root,
  config = {},
  touchedFiles,
  perFileDiffs,
  fileToRequirements,
  maxLoopCalls = MAX_LOOP_CALLS,
}) {
  const matcher = createReviewExcludeMatcher({ root, exclusions: resolveReviewExcludePaths(config) });
  const scopedTouchedFiles = new Set(matcher.filter([...touchedFiles]));
  const rawPerFileDiffs = new Map(
    [...perFileDiffs].filter(([file]) => !matcher.excludes(file)),
  );
  const strippedDiffs = new Map();
  for (const [file, diff] of rawPerFileDiffs) {
    strippedDiffs.set(file, stripDiffFileHeaders(diff));
  }
  const groups = groupByDiffContent(strippedDiffs, fileToRequirements);
  const reviewChunks = createLoopReviewChunks(groups, maxLoopCalls);
  return { scopedTouchedFiles, rawPerFileDiffs, groups, reviewChunks };
}

/**
 * Filter proposals to keep only those whose 'file' is in the touched set.
 * Proposals without an extractable file are dropped as well.
 * @param {{title: string, body: string, file: string|null}[]} proposals
 * @param {Set<string>} touchedFiles
 * @returns {{kept: object[], excluded: {outOfScope: number, missingFile: number}}}
 */
function filterProposalsByScope(proposals, touchedFiles) {
  const kept = [];
  const excluded = { outOfScope: 0, missingFile: 0 };
  for (const p of proposals) {
    if (!p.file) {
      excluded.missingFile += 1;
      continue;
    }
    if (!touchedFiles.has(p.file)) {
      excluded.outOfScope += 1;
      continue;
    }
    kept.push(p);
  }
  return { kept, excluded };
}

/**
 * Write review.md for the current spec under specDir, using formatReviewMd
 * as the single source of truth for the on-disk format. Returns the absolute
 * path written.
 * @param {string} root
 * @param {object} flow
 * @param {object[]} results
 * @returns {string} absolute path of review.md
 */
function writeReviewMd(root, flow, results) {
  const specDir = path.dirname(path.resolve(root, flow.spec));
  const reviewPath = path.join(specDir, "review.md");
  fs.writeFileSync(reviewPath, formatReviewMd(results));
  return reviewPath;
}

const NO_PROPOSALS_MARKER = "_No proposals generated for this spec._";

/**
 * Generate review.md content.
 */
function formatReviewMd(results) {
  const lines = ["# Code Review Results", ""];
  if (results.length === 0) {
    lines.push(NO_PROPOSALS_MARKER);
    lines.push("");
    return lines.join("\n");
  }
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`### ${i + 1}. ${r.title}`);
    lines.push(r.body);
    lines.push("");
  }
  return lines.join("\n");
}

const IMPL_REVIEW_BLOCKING_FAILURE_MODES = Object.freeze([
  "missing_acceptance_requirement",
  "spec_behavior_contradiction",
  "security_or_data_integrity_bug",
]);
const IMPL_REVIEW_BLOCKING_FAILURE_MODE_SET = new Set(IMPL_REVIEW_BLOCKING_FAILURE_MODES);
const IMPL_REVIEW_MEMORY_BLOCKING_LIMIT = 3;
const IMPL_REVIEW_MEMORY_NON_BLOCKING_LIMIT = 5;
const IMPL_REVIEW_MEMORY_FIELD_LIMIT = 500;

const IMPL_REVIEW_FINDING_SCHEMA = Object.freeze({
  type: "object",
  required: ["title", "failureMode", "file", "requirementId", "issue", "suggestion", "rationale"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1 },
    failureMode: { type: "string", minLength: 1 },
    file: { type: ["string", "null"] },
    requirementId: { type: ["string", "null"] },
    issue: { type: "string", minLength: 1 },
    suggestion: { type: "string", minLength: 1 },
    rationale: { type: "string", minLength: 1 },
  },
});

const IMPL_REVIEW_RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  required: ["blockingFindings", "nonBlockingImprovements"],
  additionalProperties: false,
  properties: {
    blockingFindings: {
      type: "array",
      items: IMPL_REVIEW_FINDING_SCHEMA,
    },
    nonBlockingImprovements: {
      type: "array",
      items: IMPL_REVIEW_FINDING_SCHEMA,
    },
  },
});

const IMPL_REVIEW_FMT_FALLBACK = [
  "OUTPUT FORMAT - strictly required:",
  "Return only a JSON object. No markdown, no preamble, no commentary.",
  "Schema:",
  JSON.stringify(IMPL_REVIEW_RESPONSE_SCHEMA, null, 2),
  "Use empty arrays when there are no findings in a category.",
].join("\n");

function normalizeReviewPath(value) {
  return String(value || "").trim().replace(/\\/g, "/").replace(/^`|`$/g, "");
}

function truncateReviewMemoryText(value, limit = IMPL_REVIEW_MEMORY_FIELD_LIMIT) {
  const text = String(value || "");
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 13))}...[truncated]`;
}

class ImplReviewFinding {
  constructor(kind, item) {
    this.kind = kind;
    this.title = String(item.title || "").trim();
    this.failureMode = String(item.failureMode || "").trim();
    this.file = normalizeReviewPath(item.file || "");
    this.requirementId = String(item.requirementId || "").trim();
    this.issue = String(item.issue || "").trim();
    this.suggestion = String(item.suggestion || "").trim();
    this.rationale = String(item.rationale || "").trim();
    if (kind === "blocking" && !IMPL_REVIEW_BLOCKING_FAILURE_MODE_SET.has(this.failureMode)) {
      throw new Error(`invalid blocking failureMode: ${this.failureMode}`);
    }
  }

  toJSON() {
    return {
      title: this.title,
      failureMode: this.failureMode,
      ...(this.file ? { file: this.file } : {}),
      ...(this.requirementId ? { requirementId: this.requirementId } : {}),
      issue: this.issue,
      suggestion: this.suggestion,
      rationale: this.rationale,
    };
  }

  toPromptMemory() {
    return {
      title: truncateReviewMemoryText(this.title),
      failureMode: truncateReviewMemoryText(this.failureMode),
      ...(this.file ? { file: truncateReviewMemoryText(this.file) } : {}),
      ...(this.requirementId ? { requirementId: truncateReviewMemoryText(this.requirementId) } : {}),
      issue: truncateReviewMemoryText(this.issue),
      suggestion: truncateReviewMemoryText(this.suggestion),
      rationale: truncateReviewMemoryText(this.rationale),
    };
  }
}

class ImplReviewArtifact {
  constructor({ blockingFindings = [], nonBlockingImprovements = [], excluded = {}, generatedAt = new Date().toISOString() } = {}) {
    this.version = 1;
    this.phase = "impl";
    this.generatedAt = generatedAt;
    this.blockingFindings = blockingFindings.map((item) =>
      item instanceof ImplReviewFinding ? item : new ImplReviewFinding("blocking", item),
    );
    this.nonBlockingImprovements = nonBlockingImprovements.map((item) =>
      item instanceof ImplReviewFinding ? item : new ImplReviewFinding("improvement", item),
    );
    this.verdict = this.blockingFindings.length > 0
      ? "FAIL"
      : this.nonBlockingImprovements.length > 0
        ? "ADVISORY"
        : "PASS";
    this.summary = Object.freeze({
      blocking: this.blockingFindings.length,
      nonBlocking: this.nonBlockingImprovements.length,
      total: this.blockingFindings.length + this.nonBlockingImprovements.length,
    });
    this.excluded = Object.freeze({
      missingFile: Number(excluded.missingFile || 0),
      outOfScope: Number(excluded.outOfScope || 0),
    });
  }

  toPromptMemory() {
    return {
      verdict: this.verdict,
      counts: this.summary,
      previousBlockingFindings: this.blockingFindings
        .slice(0, IMPL_REVIEW_MEMORY_BLOCKING_LIMIT)
        .map((item) => item.toPromptMemory()),
      acknowledgedNonBlockingImprovements: this.nonBlockingImprovements
        .slice(0, IMPL_REVIEW_MEMORY_NON_BLOCKING_LIMIT)
        .map((item) => item.toPromptMemory()),
    };
  }

  toJSON() {
    return {
      version: this.version,
      phase: this.phase,
      generatedAt: this.generatedAt,
      verdict: this.verdict,
      summary: this.summary,
      blockingFindings: this.blockingFindings.map((item) => item.toJSON()),
      nonBlockingImprovements: this.nonBlockingImprovements.map((item) => item.toJSON()),
      excluded: this.excluded,
    };
  }
}

function parseImplReviewJsonOutput(raw) {
  const candidate = extractJsonObjectCandidate(raw);
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    parsed = JSON.parse(repairJson(candidate));
  }
  const errors = validateSchema(parsed, IMPL_REVIEW_RESPONSE_SCHEMA);
  if (errors.length > 0) {
    throw new Error(`impl review output failed schema validation: ${errors.join("; ")}`);
  }
  return parsed;
}

function parseImplReviewFindings(text) {
  const parsed = parseImplReviewJsonOutput(text);
  return {
    blockingFindings: parsed.blockingFindings.map((item) => new ImplReviewFinding("blocking", item)),
    nonBlockingImprovements: parsed.nonBlockingImprovements.map((item) => new ImplReviewFinding("improvement", item)),
  };
}

function isValidRequirementId(requirementIds, id) {
  return id && requirementIds instanceof Set && requirementIds.has(id);
}

function shouldKeepImplReviewFinding(finding, touchedFiles, requirementIds, bucketKind = finding.kind) {
  if (
    bucketKind === "blocking"
    && finding.failureMode === "missing_acceptance_requirement"
    && isValidRequirementId(requirementIds, finding.requirementId)
    && !finding.file
  ) {
    return { keep: true };
  }
  if (!finding.file) return { keep: false, reason: "missingFile" };
  if (!touchedFiles.has(finding.file)) return { keep: false, reason: "outOfScope" };
  return { keep: true };
}

function filterImplReviewFindingsByScope({ parsed, touchedFiles, requirementIds }) {
  const excluded = { missingFile: 0, outOfScope: 0 };
  const filterBucket = (items, bucketKind) => {
    const kept = [];
    for (const item of items) {
      const decision = shouldKeepImplReviewFinding(item, touchedFiles, requirementIds, bucketKind);
      if (decision.keep) kept.push(item);
      else excluded[decision.reason] += 1;
    }
    return kept;
  };
  return {
    blockingFindings: filterBucket(parsed.blockingFindings || [], "blocking"),
    nonBlockingImprovements: filterBucket(parsed.nonBlockingImprovements || [], "improvement"),
    excluded,
  };
}

function formatImplReviewJson(input = {}) {
  const artifact = input instanceof ImplReviewArtifact ? input : new ImplReviewArtifact(input);
  return JSON.stringify(artifact, null, 2) + "\n";
}

function formatImplReviewMd(input = {}) {
  const artifact = input instanceof ImplReviewArtifact ? input : new ImplReviewArtifact(input);
  const lines = ["# Code Review Results", ""];
  lines.push(`## Verdict: ${artifact.verdict}`, "");
  lines.push("## Blocking Findings", "");
  if (artifact.blockingFindings.length === 0) {
    lines.push("No blocking findings.");
  } else {
    for (let i = 0; i < artifact.blockingFindings.length; i++) {
      const item = artifact.blockingFindings[i];
      lines.push(`### ${i + 1}. ${item.title}`);
      lines.push(`**Failure mode:** ${item.failureMode}`);
      if (item.file) lines.push(`**File:** ${item.file}`);
      if (item.requirementId) lines.push(`**Requirement:** ${item.requirementId}`);
      lines.push(`**Issue:** ${item.issue}`);
      lines.push(`**Suggestion:** ${item.suggestion}`);
      lines.push(`**Rationale:** ${item.rationale}`);
      lines.push("");
    }
  }
  lines.push("", "## Non-blocking Improvements", "");
  if (artifact.nonBlockingImprovements.length === 0) {
    lines.push("No non-blocking improvements.");
  } else {
    for (let i = 0; i < artifact.nonBlockingImprovements.length; i++) {
      const item = artifact.nonBlockingImprovements[i];
      lines.push(`### ${i + 1}. ${item.title}`);
      lines.push(`**Failure mode:** ${item.failureMode}`);
      if (item.file) lines.push(`**File:** ${item.file}`);
      lines.push(`**Issue:** ${item.issue}`);
      lines.push(`**Suggestion:** ${item.suggestion}`);
      lines.push(`**Rationale:** ${item.rationale}`);
      lines.push("");
    }
  }
  lines.push("", "## Excluded Findings", "");
  lines.push(`- Missing file: ${artifact.excluded.missingFile}`);
  lines.push(`- Out of scope: ${artifact.excluded.outOfScope}`);
  lines.push("");
  return lines.join("\n");
}

function loadPreviousImplReviewMemory(root, specPath) {
  const specDir = path.dirname(path.resolve(root, specPath));
  const reviewJsonPath = path.join(specDir, "impl-review.json");
  if (!fs.existsSync(reviewJsonPath)) return null;
  const data = JSON.parse(fs.readFileSync(reviewJsonPath, "utf8"));
  return new ImplReviewArtifact({
    generatedAt: data.generatedAt,
    blockingFindings: Array.isArray(data.blockingFindings) ? data.blockingFindings : [],
    nonBlockingImprovements: Array.isArray(data.nonBlockingImprovements) ? data.nonBlockingImprovements : [],
    excluded: data.excluded || {},
  }).toPromptMemory();
}

function buildImplReviewPrompt({ requirementFileMap = {}, diff = "", touchedFiles = [], previousReview = null, taskSpec = null } = {}) {
  const touched = Array.from(touchedFiles instanceof Set ? touchedFiles : new Set(touchedFiles)).sort();
  const modeList = IMPL_REVIEW_BLOCKING_FAILURE_MODES.map((mode, index) => `  ${index + 1}. ${mode}`).join("\n");
  const pb = new PromptBuilder()
    .setRole("You are an implementation reviewer. Determine whether the implementation can proceed based only on narrow blocking findings.")
    .setRules([
      "Return JSON only.",
      "Use blockingFindings[] only for these failure modes:",
      modeList,
      "Classify regression failures, test false positives, scope creep, project-rule violations, naming proposals, refactor proposals, DRY proposals, comment proposals, and docs proposals as non-blocking or out of scope rather than blocking findings.",
      "Non-blocking improvements are optional. Do not generate one unless it names a touched file, describes an observable issue in that file, and provides a replacement action that names the affected function, branch, assertion, prompt sentence, or artifact field.",
      "File-specific findings must use a file from the touched file set.",
      "A missing_acceptance_requirement blocker may use requirementId instead of file when the requirement exists in the spec.",
      "Do not fail the review for non-blocking improvements.",
      "",
      "Return an object with:",
      "- blockingFindings[] with title, failureMode, file, requirementId, issue, suggestion, rationale",
      "- nonBlockingImprovements[] with title, failureMode, file, requirementId, issue, suggestion, rationale",
      "- Use null for file or requirementId when it does not apply.",
      "- Use empty arrays when there are no findings in a category.",
    ].join("\n"))
    .setJsonSchema(IMPL_REVIEW_RESPONSE_SCHEMA)
    .setFmtFallback(IMPL_REVIEW_FMT_FALLBACK)
    .addUserPrompt("## Requirement-File Mapping", JSON.stringify(requirementFileMap, null, 2))
    .addUserPrompt("## Touched Files", touched.join("\n") || "(none)")
    .addUserPrompt("## Diff", diff || "(none)");

  if (taskSpec) {
    pb.addUserPrompt("## Task Review Scope", [
      `Task spec: ${taskSpec.relPath}`,
      taskSpec.content || "",
    ].join("\n"));
  }
  if (previousReview) {
    pb.addUserPrompt("## Previous Impl Review Memory", JSON.stringify(previousReview, null, 2));
  }
  return pb.build();
}

function resolveRequirementIds(root, flow) {
  const spec = loadSpecJson(path.resolve(root, flow.spec), { validate: false });
  return new Set((Array.isArray(spec.requirements) ? spec.requirements : []).map((req) => req.id).filter(Boolean));
}

async function runImplReview({ root, flow, reviewOutput, touchedFiles, taskSpec = null }) {
  const parsed = parseImplReviewFindings(reviewOutput);
  const requirementIds = resolveRequirementIds(root, flow);
  const filtered = filterImplReviewFindingsByScope({
    parsed,
    touchedFiles,
    requirementIds,
  });
  const artifact = new ImplReviewArtifact(filtered);
  const specDir = path.dirname(path.resolve(root, flow.spec));
  const reviewJsonPath = path.join(specDir, "impl-review.json");
  const artifactJson = artifact.toJSON();
  artifactJson.contractSummary = contractFromImplReviewArtifact(artifactJson, {
    artifactPath: path.relative(root, reviewJsonPath).split(path.sep).join("/"),
  }).summary.toJSON();
  const attemptNumber = reviewHistoryAttemptNumber(specDir, "impl");
  const reviewMdWrite = writeReviewAttemptHistory({
    specDir,
    phase: "impl",
    latestBasename: "review.md",
    attemptNumber,
    content: formatImplReviewMd(artifact),
    findings: [
      ...findingsWithSeverity(artifact.blockingFindings.map((finding) => finding.toJSON()), "blocking"),
      ...findingsWithSeverity(artifact.nonBlockingImprovements.map((finding) => finding.toJSON()), "non-blocking"),
    ],
  });
  const reviewJsonWrite = writeReviewAttemptHistory({
    specDir,
    phase: "impl",
    latestBasename: "impl-review.json",
    attemptNumber,
    artifact: artifactJson,
  });
  return {
    result: "ok",
    changed: [
      path.relative(root, reviewMdWrite.latestPath),
      path.relative(root, reviewJsonWrite.latestPath),
    ],
    artifacts: {
      phase: "impl",
      verdict: artifact.verdict,
      blockingCount: artifact.summary.blocking,
      nonBlockingCount: artifact.summary.nonBlocking,
      ...(taskSpec ? { taskId: taskSpec.task.id, target: taskSpec.relPath } : {}),
    },
    next: artifact.verdict === "FAIL" ? null : (taskSpec ? "task-gate" : "impl-gate"),
    output: "",
  };
}

/**
 * Build the apply prompt from approved proposals and diff.
 */
function buildApplyPrompt(approved, diff) {
  const proposalText = approved
    .map((p, i) => `### ${i + 1}. ${p.title}\n${p.body}`)
    .join("\n\n");

  return [
    "Apply the following approved refactoring proposals to the code.",
    "Make only the changes described. Do not add unrelated improvements.",
    "",
    "## Approved Proposals",
    proposalText,
    "",
    "## Current Diff (for context)",
    diff,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Loop review helpers (spec 242)
// ---------------------------------------------------------------------------

function shouldUseLoopReview(fileCount) {
  return fileCount >= LOOP_REVIEW_THRESHOLD;
}

function stripDiffFileHeaders(diff) {
  return diff.split("\n").filter((line) =>
    !line.startsWith("diff --git ") &&
    !line.startsWith("index ") &&
    !line.startsWith("--- ") &&
    !line.startsWith("+++ "),
  ).join("\n");
}

function groupByDiffContent(perFileDiffs, fileToReqs) {
  const keyToFiles = new Map();
  for (const [file, content] of perFileDiffs) {
    const reqs = fileToReqs ? (fileToReqs.get(file) || []) : [];
    const key = content + "\0" + reqs.slice().sort().join("\0");
    const existing = keyToFiles.get(key);
    if (existing) {
      existing.files.push(file);
    } else {
      keyToFiles.set(key, { files: [file], diff: content });
    }
  }
  return Array.from(keyToFiles.values()).map((g) => ({
    files: g.files,
    diff: g.diff,
    representative: g.files[0],
  }));
}

function buildPerFileReviewInput(filePath, diff, requirements) {
  const lines = [`## File: ${filePath}`, ""];
  if (requirements.length > 0) {
    lines.push("## Related Requirements");
    for (const r of requirements) lines.push(`- ${r}`);
    lines.push("");
  }
  lines.push("## Diff");
  lines.push(diff);
  return lines.join("\n");
}

function buildCrossCheckInput(summaries) {
  if (summaries.length === 0) return "No proposals were generated from individual file reviews.";
  const lines = ["## Individual File Review Summaries", ""];
  for (const s of summaries) {
    lines.push(`### ${s.file}`);
    lines.push(s.proposals);
    lines.push("");
  }
  return lines.join("\n");
}

function buildCrossCheckSystemPrompt() {
  return [
    "You are a cross-file code quality reviewer. Analyze the aggregated per-file review proposals to detect cross-file issues.",
    "Focus on:",
    "- Interface inconsistencies between files",
    "- Duplicate introductions across files",
    "- Naming inconsistencies across files",
    "",
    "Output a numbered list of proposals in this format:",
    "### 1. <title>",
    "**File:** `<path>`",
    "**Issue:** <description of the cross-file problem>",
    "**Suggestion:** <concrete improvement>",
    "",
    "If no cross-file issues are found, output: NO_PROPOSALS",
  ].join("\n");
}

function expandProposalsToGroup(proposals, groupFiles) {
  if (proposals.length === 0) return [];
  const representative = groupFiles[0];
  const expanded = [];
  for (const file of groupFiles) {
    for (const p of proposals) {
      if (file === representative) {
        expanded.push(p);
      } else {
        expanded.push({
          ...p,
          file,
          body: p.body.replace(
            /(\*\*File:\*\*\s*`?)[^`\n]+(`?\s*$)/m,
            `$1${file}$2`,
          ),
        });
      }
    }
  }
  return expanded;
}

function invertFileMap(fileMap, requirements) {
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const result = new Map();
  for (const [reqId, files] of Object.entries(fileMap)) {
    const req = reqById.get(reqId);
    if (!req) continue;
    const reqText = `${req.id}${req.priority ? ` [${req.priority}]` : ""}: ${req.desc}`;
    for (const f of files) {
      if (!result.has(f)) result.set(f, []);
      result.get(f).push(reqText);
    }
  }
  return result;
}

function collectPerFileDiffs(root, mergeBase, touchedFiles) {
  const perFileDiffs = new Map();
  for (const file of touchedFiles) {
    const diffs = collectCommittedAndStagedDiff(root, mergeBase, file);
    if (diffs.length > 0) perFileDiffs.set(file, diffs.join("\n"));
  }
  return perFileDiffs;
}

function buildChunkReviewInput(chunk, rawPerFileDiffs, fileToReqs) {
  const parts = [];
  for (const g of chunk) {
    const diff = rawPerFileDiffs.get(g.representative) || g.diff;
    const reqs = fileToReqs.get(g.representative) || [];
    parts.push(buildPerFileReviewInput(g.representative, diff, reqs));
  }
  return parts.join("\n\n---\n\n");
}

function resolveTaskReviewSpec(root, taskSpecPath) {
  const relPath = String(taskSpecPath || "").trim();
  if (!relPath) return null;
  const absPath = path.resolve(root, relPath);
  if (!absPath.startsWith(root + path.sep)) {
    throw new Error(`task spec path escapes repository root: ${relPath}`);
  }
  if (!fs.existsSync(absPath)) {
    throw new Error(`task spec not found: ${relPath}`);
  }
  const content = fs.readFileSync(absPath, "utf8");
  return {
    relPath,
    task: { id: path.basename(relPath, path.extname(relPath)) },
    text: content,
    content,
  };
}

function buildTaskReviewInput(taskSpec, diff) {
  return [
    "## Task Specification",
    `Path: ${taskSpec.relPath}`,
    "",
    taskSpec.text,
    "",
    "## Diff",
    diff,
  ].join("\n");
}

function chunkLabel(chunk) {
  const primary = chunk[0];
  return chunk.length > 1
    ? `${primary.representative} +${chunk.length - 1} more`
    : `${primary.representative} (${primary.files.length} file(s))`;
}

function createLoopReviewChunks(groups, maxCalls = MAX_LOOP_CALLS) {
  if (groups.length <= maxCalls) return groups.map((g) => [g]);
  const chunkSize = Math.ceil(groups.length / maxCalls);
  const chunks = [];
  for (let i = 0; i < groups.length; i += chunkSize) {
    chunks.push(groups.slice(i, i + chunkSize));
  }
  return chunks;
}

function hashLoopReviewInput(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function providerOutputInvalid(result) {
  if (typeof result !== "string" || result.trim() === "") return "parser_failure";
  if (result.includes("NO_PROPOSALS")) return null;
  if (result.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(result);
      if (!Array.isArray(parsed.proposals)) return "schema_failure";
      if (parsed.proposals.some((item) => typeof item?.title !== "string" || !item.title || typeof item?.file !== "string")) {
        return "schema_failure";
      }
    } catch {
      return "parser_failure";
    }
  }
  if (!/^### /m.test(result)) return "parser_failure";
  return null;
}

function proposalSuccessPayload(proposals) {
  return { proposals: proposals.map((proposal) => ({ ...proposal })) };
}

function persistLoopFinalArtifacts({ specDir, proposals }) {
  if (!specDir) return;
  const jsonText = loopProposalsToImplReviewJson(proposals);
  fs.writeFileSync(path.join(specDir, "impl-review.json"), `${jsonText}\n`);
  fs.writeFileSync(path.join(specDir, "review.md"), formatImplReviewMd(new ImplReviewArtifact(JSON.parse(jsonText))));
}

function toolingFailureResult(failure) {
  return {
    verdict: "TOOLING_FAILURE",
    failureKind: failure.failureKind,
    reviewRetryConsumed: false,
    proposals: [],
    summaries: [],
    reviewChunks: [],
    reviewCallCount: 0,
  };
}

async function executeWorkUnit({
  identity,
  checkpointStore,
  execute,
  parseReviewProposals,
  validateProviderOutput,
}) {
  const existing = checkpointStore?.load(identity);
  if (checkpointStore) {
    const resume = WorkUnitResumeDecision.fromCheckpoint(identity, existing);
    if (resume.action === "reuse") {
      return {
        rawResponse: existing.rawResponse || "",
        proposals: existing.success?.proposals || [],
        reused: true,
      };
    }
  }

  try {
    const rawResponse = await execute();
    const invalidKind = validateProviderOutput ? providerOutputInvalid(rawResponse) : null;
    if (invalidKind) {
      throw new WorkUnitToolingFailure({ failureKind: invalidKind, message: `${invalidKind} during WorkUnit execution`, rawResponse });
    }
    const proposals = rawResponse.includes("NO_PROPOSALS") ? [] : parseReviewProposals(rawResponse);
    checkpointStore?.saveSuccess({ identity, rawResponse, success: proposalSuccessPayload(proposals) });
    return { rawResponse, proposals, reused: false };
  } catch (err) {
    const failure = classifyWorkUnitFailure(err, { failureKind: err.failureKind });
    if (failure.commandFailure) throw err;
    checkpointStore?.saveFailed({ identity, failure });
    return toolingFailureResult(failure);
  }
}

async function runLoopReviewWithDependencies({
  groups,
  maxLoopCalls = MAX_LOOP_CALLS,
  buildChunkInput,
  reviewChunk,
  crossCheck,
  parseReviewProposals = parseProposals,
  expandGroupProposals = expandProposalsToGroup,
  onBatch = null,
  onReviewChunk = null,
  checkpointStore = null,
  specDir = null,
  persistFinalArtifacts = false,
  providerIdentity = "default",
  promptVersion = "impl-review-loop-v1",
  schemaVersion = "impl-review-proposals-v1",
  validateProviderOutput = false,
}) {
  const reviewChunks = createLoopReviewChunks(groups, maxLoopCalls);
  if (groups.length > maxLoopCalls && onBatch) onBatch({ groups, reviewChunks, maxLoopCalls });

  const allProposals = [];
  const summaries = [];
  const seen = new Map();
  let reviewCallCount = 0;

  for (let i = 0; i < reviewChunks.length; i++) {
    const chunk = reviewChunks[i];
    const input = buildChunkInput(chunk);
    const chunkHash = hashLoopReviewInput(input);

    let result = seen.get(chunkHash);
    let proposals = null;
    if (!result) {
      if (onReviewChunk) onReviewChunk({ chunk, index: reviewCallCount, total: reviewChunks.length });
      const identity = createLoopChunkWorkUnitIdentity({
        index: i,
        parentUnitId: null,
        targetFiles: chunk.flatMap((g) => g.files),
        input,
        providerIdentity,
        promptVersion,
        schemaVersion,
      });
      const priorFailures = checkpointStore?.failuresForUnit(identity.unitId) || [];
      if (checkpointStore && shouldFallbackSplit(priorFailures)) {
        const children = planFallbackChildWorkUnits({
          parentUnitId: identity.unitId,
          parentStableOrderKey: identity.stableOrderKey,
          parentChunk: chunk,
          priorFailures,
        });
        const childProposals = [];
        for (const child of children) {
          const childInput = buildChunkInput(child.groups);
          const childExecution = await executeWorkUnit({
            identity: child.identity,
            checkpointStore,
            execute: () => reviewChunk(child.groups, childInput),
            parseReviewProposals,
            validateProviderOutput,
          });
          if (childExecution.verdict === "TOOLING_FAILURE") return childExecution;
          childProposals.push(...childExecution.proposals);
          if (!childExecution.reused) reviewCallCount += 1;
        }
        allProposals.push(...childProposals);
        summaries.push({ file: chunk[0].representative, proposals: childProposals.map((p) => p.title || p.body || "").join("\n") });
        seen.set(chunkHash, "NO_PROPOSALS");
        continue;
      }
      const execution = checkpointStore
        ? await executeWorkUnit({
          identity,
          checkpointStore,
          execute: () => reviewChunk(chunk, input),
          parseReviewProposals,
          validateProviderOutput,
        })
        : { rawResponse: await reviewChunk(chunk, input), proposals: null, reused: false };
      if (execution.verdict === "TOOLING_FAILURE") return execution;
      result = execution.rawResponse;
      proposals = execution.proposals;
      if (!execution.reused) reviewCallCount += 1;
      seen.set(chunkHash, result);
    }
    if (result.includes("NO_PROPOSALS")) continue;

    proposals = proposals || parseReviewProposals(result);
    if (proposals.length === 0) continue;

    for (const g of chunk) {
      const gProposals = proposals.filter((p) => p.file && g.files.includes(p.file));
      const toExpand = gProposals.length > 0 ? gProposals : proposals;
      const expanded = g.files.length > 1
        ? expandGroupProposals(toExpand, g.files)
        : toExpand;
      allProposals.push(...expanded);
    }
    summaries.push({ file: chunk[0].representative, proposals: result });
  }

  if (summaries.length > 1 && reviewCallCount < maxLoopCalls) {
    const identity = createCrossCheckWorkUnitIdentity({
      summaries,
      providerIdentity,
      schemaVersion,
    });
    const execution = checkpointStore
      ? await executeWorkUnit({
        identity,
        checkpointStore,
        execute: () => crossCheck(summaries),
        parseReviewProposals,
        validateProviderOutput,
      })
      : { rawResponse: await crossCheck(summaries), proposals: null, reused: false };
    if (execution.verdict === "TOOLING_FAILURE") return execution;
    const crossCheckResult = execution.rawResponse;
    if (!execution.reused) reviewCallCount += 1;
    if (!crossCheckResult.includes("NO_PROPOSALS")) {
      allProposals.push(...(execution.proposals || parseReviewProposals(crossCheckResult)));
    }
  }

  if (persistFinalArtifacts) persistLoopFinalArtifacts({ specDir, proposals: allProposals });
  return { proposals: allProposals, summaries, reviewChunks, reviewCallCount };
}

function loopProposalsToImplReviewJson(proposals) {
  return JSON.stringify({
    blockingFindings: [],
    nonBlockingImprovements: proposals.map((proposal) => ({
      title: proposal.title,
      failureMode: "refactor",
      ...(proposal.file ? { file: proposal.file } : {}),
      issue: proposal.body || proposal.title,
      suggestion: proposal.body || proposal.title,
      rationale: "Loop review proposal.",
    })),
  });
}

async function runSingleShotImplReviewWithDependencies({ specDir, reviewText }) {
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "impl-review.json"), `${reviewText}\n`);
  fs.writeFileSync(path.join(specDir, "review.md"), "# Code Review Results\n\n");
  return { changed: ["review.md", "impl-review.json"] };
}

async function runNonImplReviewWithDependencies({ phase, specDir, reviewText }) {
  fs.mkdirSync(specDir, { recursive: true });
  const basename = `${phase}-review.json`;
  fs.writeFileSync(path.join(specDir, basename), `${reviewText}\n`);
  return { changed: [basename] };
}

async function runActiveImplReviewWithDependencies({
  touchedFiles,
  shouldUseLoopReview,
  runLoopReview,
  runSingleReview,
  persistImplReview,
}) {
  const reviewOutput = shouldUseLoopReview(touchedFiles.size)
    ? await runLoopReview()
    : await runSingleReview();
  return persistImplReview(reviewOutput);
}

async function runReviewWithDependencies(options) {
  const result = await runActiveImplReviewWithDependencies(options);
  if (result?.verdict === "TOOLING_FAILURE") {
    return {
      result: "tooling-failure",
      changed: [],
      artifacts: {
        phase: "impl",
        verdict: "TOOLING_FAILURE",
        blockingCount: 0,
        nonBlockingCount: 0,
        failureKind: result.failureKind,
      },
      next: null,
      output: result.failureKind || "WorkUnit tooling failure",
    };
  }
  return result;
}

async function runLoopReview(root, flow, mergeBase, fileMap, touchedFiles, guardrails, config = {}) {
  const specInput = path.resolve(root, flow.spec);
  const spec = loadSpecJson(specInput);
  const fileToReqs = invertFileMap(fileMap, spec.requirements || []);
  const specDir = path.dirname(specInput);
  const matcher = createReviewExcludeMatcher({ root, exclusions: resolveReviewExcludePaths(config) });
  const scopedFiles = new Set(matcher.filter([...touchedFiles]));
  const rawPerFileDiffs = collectPerFileDiffs(root, mergeBase, scopedFiles);
  const { groups } = prepareLoopReviewInputsWithExclusions({
    root,
    config,
    touchedFiles: scopedFiles,
    perFileDiffs: rawPerFileDiffs,
    fileToRequirements: fileToReqs,
    maxLoopCalls: MAX_LOOP_CALLS,
  });

  const draftAgent = ensureAgent("flow.impl.review.propose");
  const systemPrompt = buildDraftSystemPrompt(
    guardrails,
    buildReviewAcknowledgedRationale(root, flow, guardrails),
  );

  const result = await runLoopReviewWithDependencies({
    groups,
    maxLoopCalls: MAX_LOOP_CALLS,
    specDir,
    checkpointStore: new WorkUnitCheckpointStore({ specDir, namespace: "impl-review" }),
    providerIdentity: "flow.impl.review.propose",
    promptVersion: "impl-review-loop-v1",
    schemaVersion: "impl-review-proposals-v1",
    validateProviderOutput: true,
    buildChunkInput: (chunk) => buildChunkReviewInput(chunk, rawPerFileDiffs, fileToReqs),
    reviewChunk: (chunk, input) => callReviewAgent(draftAgent, input, "flow.impl.review.propose", systemPrompt),
    crossCheck: (summaries) => {
      console.error("  [loop-review] Running cross-check pass...");
      const crossCheckInput = buildCrossCheckInput(summaries);
      return callReviewAgent(
        draftAgent, crossCheckInput, "flow.impl.review.propose", buildCrossCheckSystemPrompt(),
      );
    },
    onBatch: ({ reviewChunks }) => {
      console.error(`  [loop-review] ${groups.length} groups batched into ${reviewChunks.length} chunk(s) (limit ${MAX_LOOP_CALLS}).`);
    },
    onReviewChunk: ({ chunk, index, total }) => {
      console.error(`  [loop-review] Call ${index + 1}/${total}: ${chunkLabel(chunk)}...`);
    },
  });

  console.error(`  [loop-review] ${touchedFiles.size} files → ${groups.length} group(s) after compaction → ${result.reviewCallCount} AI call(s).`);

  console.error(`  [loop-review] ${result.proposals.length} total proposal(s).`);
  return result.verdict === "TOOLING_FAILURE" ? result : result.proposals;
}

// ---------------------------------------------------------------------------
// Common review loop
// ---------------------------------------------------------------------------

/**
 * Run a review-fix loop up to maxRetries times.
 * @param {Object} opts
 * @param {number} opts.maxRetries - Maximum iterations
 * @param {string} opts.label - Log label (e.g. "test-review", "spec-review")
 * @param {boolean} opts.dryRun - Skip fix phase if true
 * @param {() => Promise<{issues: Object[], raw: string}>} opts.detect - Detect issues. Return { issues, raw }.
 * @param {(raw: string) => Promise<void>} opts.fix - Apply fixes based on raw detection output.
 * @returns {Promise<{history: string[], finalIssues: Object[], verdict: string}>}
 */
async function runReviewLoop({ maxRetries, label, dryRun, detect, fix }) {
  const history = [];
  let finalIssues = [];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.error(`  [${label}] Analysis (attempt ${attempt + 1}/${maxRetries})...`);
    const { issues, raw } = await detect();
    history.push(raw);

    if (issues.length === 0) {
      console.error(`  [${label}] No issues found. PASS.`);
      finalIssues = [];
      break;
    }

    console.error(`  [${label}] ${issues.length} issue(s) found.`);
    finalIssues = issues;

    if (dryRun) {
      console.error(`  [${label}] (dry-run: skipping auto-fix)`);
      break;
    }

    console.error(`  [${label}] Applying fixes...`);
    await fix(raw);
  }

  // Verification detect: if loop ended with issues, run one more detect to check
  // whether the last fix resolved them. This handles the case where the previous
  // code skipped fix on the last iteration, missing fixes that resolved all issues.
  if (finalIssues.length > 0 && !dryRun) {
    console.error(`  [${label}] Verification detect...`);
    const { issues, raw } = await detect();
    history.push(raw);
    if (issues.length === 0) {
      console.error(`  [${label}] Verification PASS — all issues resolved.`);
      finalIssues = [];
    } else {
      console.error(`  [${label}] Verification: ${issues.length} issue(s) still remain.`);
      finalIssues = issues;
    }
  }

  const verdict = finalIssues.length === 0 ? "PASS" : "FAIL";
  return { history, finalIssues, verdict };
}

// ---------------------------------------------------------------------------
// Test review pipeline (--phase test)
// ---------------------------------------------------------------------------

/**
 * Render spec.json.requirements as plain-text bullets for AI prompts. Post-T8
 * there is no regex-based spec.md Requirements extraction.
 */
function extractRequirements(spec) {
  const items = Array.isArray(spec?.requirements) ? spec.requirements : [];
  if (items.length === 0) return "";
  return items
    .map((r) => {
      const annotation = r.testable === false ? " (testing not required)" : "";
      return `- ${r.id}${r.priority ? ` [${r.priority}]` : ""}: ${r.desc}${annotation}`;
    })
    .join("\n");
}

const TEST_REVIEW_PROMPT_TOO_LARGE_CODE = "TEST_REVIEW_PROMPT_TOO_LARGE";
const TEST_REVIEW_PROMPT_CHAR_LIMIT = 1_000_000;

/**
 * Collect test files from the spec-local tests/ directory only.
 * Project-level tests/ are regression inputs for test-execute/impl-gate, not
 * semantic test-review prompt input.
 * @param {string} root
 * @param {string} specDir - relative spec directory
 * @returns {{ name: string, content: string, source: string }[]}
 */
function collectTestFiles(root, specDir) {
  const files = new Map();

  const specTestDir = path.resolve(root, specDir, "tests");
  if (fs.existsSync(specTestDir)) {
    collectTestsRecursive(specTestDir, specTestDir, files, `${specDir}/tests/`);
  }

  return Array.from(files.values());
}

/**
 * Recursively collect test files from a directory.
 */
function collectTestsRecursive(dir, baseDir, fileMap, sourcePrefix) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTestsRecursive(full, baseDir, fileMap, sourcePrefix);
    } else if (/\.(test|spec)\.(js|ts|mjs)$/.test(entry.name)) {
      const relName = path.relative(baseDir, full);
      const content = fs.readFileSync(full, "utf8");
      fileMap.set(relName, { name: relName, content, source: sourcePrefix + relName });
    }
  }
}

/**
 * Build the test design generation prompt.
 */
function buildTestDesignPrompt(requirements) {
  return [
    "You are a test design expert. Based on the following spec requirements, generate a comprehensive test design.",
    "List what should be tested, including:",
    "- Happy path scenarios",
    "- Edge cases and boundary conditions",
    "- Error paths and failure modes",
    "- Test type balance (unit / integration / acceptance)",
    "",
    "Output format:",
    "### Test Design",
    "For each test case:",
    "- **TC-N: <title>**",
    "  - Type: unit|integration|acceptance",
    "  - Input: <description>",
    "  - Expected: <description>",
    "",
    "## Requirements",
    requirements,
  ].join("\n");
}

/**
 * Serialize test files into markdown code blocks for prompts.
 */
function formatTestFilesForPrompt(testFiles) {
  if (testFiles.length === 0) return "(no test files found)";
  return testFiles
    .map((f) => `### ${f.source}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");
}

/**
 * Build the gap analysis prompt.
 */
function buildGapAnalysisPrompt(testDesign, testFiles) {
  return new PromptBuilder()
    .setRole("You are a test quality reviewer. Compare the test design against actual test code and identify gaps.")
    .setRules([
      "For each gap, output:",
      "### GAP-N: <title>",
      "**Missing:** <what is not tested>",
      "**Severity:** HIGH|MEDIUM|LOW",
      "**Fix:** <concrete suggestion for test code>",
      "",
      "If all test cases are adequately covered, output: NO_GAPS",
    ].join("\n"))
    .addSystemPrompt("## Test Design", testDesign)
    .addUserPrompt("## Existing Test Code", formatTestFilesForPrompt(testFiles))
    .build();
}

/**
 * Build the test fix prompt.
 */
function buildTestFixPrompt(testDesign, gaps, testFiles) {
  return new PromptBuilder()
    .setRole("You are a test engineer. Fix the following gaps in the test code.")
    .setRules([
      "Output the complete updated test file(s) with fixes applied.",
      "For each file, output:",
      "### FILE: <path>",
      "```",
      "<complete file content>",
      "```",
      "",
      "Only modify files that need changes. Do not add unrelated tests.",
      "Note: constant definitions may be wrapped in Object.freeze(), Object.seal(), or similar. When writing regex patterns to match definitions, account for these wrappers (e.g. `=\\s*(?:Object\\.freeze\\()?\\[` instead of `=\\s*\\[`).",
    ].join("\n"))
    .addSystemPrompt("## Test Design", testDesign)
    .addUserPrompt("## Gaps to fix", gaps)
    .addUserPrompt("## Current test code", formatTestFilesForPrompt(testFiles))
    .build();
}

const TEST_REVIEW_JSON_FILE = "test-review.json";
const TEST_COVERAGE_JSON_FILE = "test-coverage.json";
const TEST_REVIEW_FINDING_KINDS = Object.freeze(["blocking", "advisory"]);
const TEST_REVIEW_FIELD_MAX_CHARS = 1200;
const TEST_REVIEW_TRUNCATION_SUFFIX = " [truncated]";

const TEST_REVIEW_BLOCKING_ITEM_SCHEMA = Object.freeze({
  type: "object",
  required: ["title", "target", "issue", "requiredChange", "whyBlocking"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1 },
    target: { type: "string", minLength: 1 },
    issue: { type: "string", minLength: 1 },
    requiredChange: { type: "string", minLength: 1 },
    whyBlocking: { type: "string", minLength: 1 },
    origin: { type: "string" },
    failureKind: { type: "string" },
  },
});

const TEST_REVIEW_ADVISORY_ITEM_SCHEMA = Object.freeze({
  type: "object",
  required: ["title", "target", "improvement", "whyNonBlocking"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1 },
    target: { type: "string", minLength: 1 },
    improvement: { type: "string", minLength: 1 },
    whyNonBlocking: { type: "string", minLength: 1 },
  },
});

const TEST_REVIEW_RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  required: ["blockingFindings", "advisoryFindings"],
  additionalProperties: false,
  properties: {
    blockingFindings: {
      type: "array",
      items: TEST_REVIEW_BLOCKING_ITEM_SCHEMA,
    },
    advisoryFindings: {
      type: "array",
      items: TEST_REVIEW_ADVISORY_ITEM_SCHEMA,
    },
  },
});

const TEST_REVIEW_FMT_FALLBACK = [
  "OUTPUT FORMAT - strictly required:",
  "Return only a JSON object. No markdown, no preamble, no commentary.",
  "Schema:",
  JSON.stringify(TEST_REVIEW_RESPONSE_SCHEMA, null, 2),
  "Use empty arrays when there are no findings in a category.",
].join("\n");

function normalizeTestReviewText(value, fallback) {
  const text = typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
  return text.length > TEST_REVIEW_FIELD_MAX_CHARS
    ? `${text.slice(0, TEST_REVIEW_FIELD_MAX_CHARS - TEST_REVIEW_TRUNCATION_SUFFIX.length)}${TEST_REVIEW_TRUNCATION_SUFFIX}`
    : text;
}

class TestReviewFinding {
  constructor(kind, item) {
    if (!TEST_REVIEW_FINDING_KINDS.includes(kind)) {
      throw new Error(`invalid test review finding kind: ${kind}`);
    }
    this.kind = kind;
    this.title = normalizeTestReviewText(item.title, "Untitled test review finding");
    this.target = normalizeTestReviewText(item.target, "GLOBAL");
    if (kind === "blocking") {
      this.issue = normalizeTestReviewText(item.issue, "Blocking test issue.");
      this.requiredChange = normalizeTestReviewText(item.requiredChange, "Fix the blocking test issue.");
      this.whyBlocking = normalizeTestReviewText(item.whyBlocking, "Implementation cannot proceed with this test issue unresolved.");
      this.origin = typeof item.origin === "string" && item.origin.trim() !== "" ? item.origin.trim() : null;
      this.failureKind = typeof item.failureKind === "string" && item.failureKind.trim() !== "" ? item.failureKind.trim() : null;
    } else {
      this.improvement = normalizeTestReviewText(item.improvement, "Advisory test improvement.");
      this.whyNonBlocking = normalizeTestReviewText(item.whyNonBlocking, "Implementation can proceed without this improvement.");
    }
  }

  toJSON() {
    const base = {
      kind: this.kind,
      title: this.title,
      target: this.target,
    };
    if (this.kind === "blocking") {
      return {
        ...base,
        issue: this.issue,
        requiredChange: this.requiredChange,
        whyBlocking: this.whyBlocking,
        ...(this.origin && { origin: this.origin }),
        ...(this.failureKind && { failureKind: this.failureKind }),
      };
    }
    return {
      ...base,
      improvement: this.improvement,
      whyNonBlocking: this.whyNonBlocking,
    };
  }
}

class RequirementCoverageEntry {
  constructor(requirement, files) {
    this.id = requirement.id;
    this.desc = requirement.desc;
    this.testable = requirement.testable !== false;
    this.files = Object.freeze([...files].sort());
    this.status = this.testable
      ? (this.files.length > 0 ? "covered" : "uncovered")
      : "not_testable";
  }

  toJSON() {
    return {
      id: this.id,
      desc: this.desc,
      testable: this.testable,
      status: this.status,
      files: this.files,
    };
  }
}

class TestFileCoverageEntry {
  constructor(specDir, file, info) {
    this.file = path.relative(specDir, file).split(path.sep).join("/");
    this.headerIds = Object.freeze([...(info.headerIds || [])]);
    this.testNameIds = Object.freeze([...(info.testNameIds || [])]);
    this.headerStatus = info.scan?.kind || "unknown";
  }

  toJSON() {
    return {
      file: this.file,
      headerStatus: this.headerStatus,
      headerIds: this.headerIds,
      testNameIds: this.testNameIds,
    };
  }
}

class TestCoverageArtifact {
  constructor({ spec, specDir, headerResult, fileHeaders, generatedAt = new Date().toISOString() }) {
    this.version = 1;
    this.phase = "test-review";
    this.generatedAt = generatedAt;
    this.validation = Object.freeze({
      ok: headerResult.ok === true,
      messages: headerResult.messages || [],
    });
    const reqToFiles = new Map();
    for (const [file, info] of fileHeaders) {
      for (const id of info.headerIds || []) {
        if (!reqToFiles.has(id)) reqToFiles.set(id, []);
        reqToFiles.get(id).push(path.relative(specDir, file).split(path.sep).join("/"));
      }
    }
    this.requirements = Object.freeze(
      (Array.isArray(spec?.requirements) ? spec.requirements : [])
        .map((req) => new RequirementCoverageEntry(req, reqToFiles.get(req.id) || [])),
    );
    this.files = Object.freeze(
      [...fileHeaders.entries()].map(([file, info]) => new TestFileCoverageEntry(specDir, file, info)),
    );
  }

  toPromptSummary() {
    return {
      version: this.version,
      phase: this.phase,
      validation: this.validation,
      requirements: this.requirements.map((entry) => entry.toJSON()),
      files: this.files.map((entry) => entry.toJSON()),
    };
  }

  toJSON() {
    return this.toPromptSummary();
  }
}

class TestCoverageFailureArtifact {
  constructor(message) {
    this.message = normalizeTestReviewText(message, "coverage artifact generation failed");
  }

  toPromptSummary() {
    return {
      version: 1,
      phase: "test-review",
      validation: {
        ok: false,
        messages: [this.message],
      },
      requirements: [],
      files: [],
    };
  }

  toJSON() {
    return this.toPromptSummary();
  }
}

class TestReviewToolingFailure {
  constructor({ kind, message, recovery }) {
    this.kind = normalizeTestReviewText(kind, "tooling_error");
    this.message = normalizeTestReviewText(message, "test-review tooling failed");
    this.recovery = normalizeTestReviewText(recovery, "Recover the tooling failure or record an evidence-based override.");
  }

  toJSON() {
    return {
      kind: this.kind,
      message: this.message,
      recovery: this.recovery,
    };
  }
}

class TestReviewArtifact {
  constructor({ verdict, coverageArtifact, blocking = [], advisory = [], toolingFailure = null, generatedAt = new Date().toISOString() }) {
    this.version = 1;
    this.phase = "test";
    this.generatedAt = generatedAt;
    this.verdict = verdict;
    this.coverageArtifact = coverageArtifact;
    this.blockingFindings = blocking.map((item) => item instanceof TestReviewFinding ? item : new TestReviewFinding("blocking", item));
    this.advisoryFindings = advisory.map((item) => item instanceof TestReviewFinding ? item : new TestReviewFinding("advisory", item));
    this.toolingFailure = toolingFailure;
    this.counts = Object.freeze({
      blocking: this.blockingFindings.length,
      advisory: this.advisoryFindings.length,
      total: this.blockingFindings.length + this.advisoryFindings.length,
    });
  }

  toJSON() {
    return {
      version: this.version,
      phase: this.phase,
      generatedAt: this.generatedAt,
      verdict: this.verdict,
      counts: this.counts,
      coverageArtifact: this.coverageArtifact,
      blockingFindings: this.blockingFindings.map((item) => item.toJSON()),
      advisoryFindings: this.advisoryFindings.map((item) => item.toJSON()),
      ...(this.toolingFailure && { toolingFailure: this.toolingFailure.toJSON() }),
    };
  }
}

function buildTestReviewPrompt(requirements, coverageArtifact, testFiles) {
  return new PromptBuilder()
    .setRole("You are a one-shot static test reviewer. Classify only test design and static anti-pattern issues before implementation.")
    .setRules([
      "This review runs once and does not auto-fix tests.",
      "PASS means blockingFindings[] and advisoryFindings[] are both empty.",
      "ADVISORY means blockingFindings[] is empty and advisoryFindings[] has useful non-blocking improvements.",
      "FAIL means blockingFindings[] has at least one issue that blocks implementation.",
      "Use blockingFindings[] only for concrete blockers:",
      "- an acceptance requirement has no corresponding spec-local test coverage",
      "- a critical risk has no regression test",
      "- a test is not executable or clearly contradicts the target API",
      "- a test encodes an incorrect implementation premise",
      "- the requirement coverage artifact contradicts the actual test files",
      "- the test has a static anti-pattern that would pass without exercising production behavior",
      "Use advisoryFindings[] for non-blocking improvements:",
      "- naming or TC numbering improvements",
      "- helpful extra boundary cases",
      "- duplicate coverage from another useful viewpoint",
      "- wording drift in test design notes that does not affect executable tests",
      "Do not fail for advisory findings.",
      "Do not ask for a review/fix/re-review loop.",
      "Do not rewrite tests. Report the smallest requiredChange for blocking findings.",
      "Runtime pass/fail belongs to scenario-validity, test-execute, test-result-review, impl-gate, and final-regression.",
      "",
      "Return JSON only. The response object must contain:",
      "- blockingFindings[] with title, target, issue, requiredChange, whyBlocking",
      "- advisoryFindings[] with title, target, improvement, whyNonBlocking",
      "- Use empty arrays when there are no findings in a category.",
    ].join("\n"))
    .setJsonSchema(TEST_REVIEW_RESPONSE_SCHEMA)
    .setFmtFallback(TEST_REVIEW_FMT_FALLBACK)
    .addUserPrompt("## Requirements", requirements)
    .addUserPrompt("## Requirement-to-Test Coverage Artifact", JSON.stringify(coverageArtifact.toPromptSummary(), null, 2))
    .addUserPrompt("## Spec-local Test Code", formatTestFilesForPrompt(testFiles))
    .build();
}

function parseTestReviewJsonOutput(raw) {
  const candidate = extractJsonObjectCandidate(raw);
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    parsed = JSON.parse(repairJson(candidate));
  }
  parsed = normalizeReviewResponseArrays(parsed, ["blockingFindings", "advisoryFindings"]);
  const errors = validateSchema(parsed, TEST_REVIEW_RESPONSE_SCHEMA);
  if (errors.length > 0) {
    throw new Error(`test review output failed schema validation: ${errors.join("; ")}`);
  }
  return parsed;
}

function parseTestReviewFindings(raw) {
  const parsed = parseTestReviewJsonOutput(raw);
  return {
    blocking: parsed.blockingFindings.map((item) => new TestReviewFinding("blocking", item)),
    advisory: parsed.advisoryFindings.map((item) => new TestReviewFinding("advisory", item)),
  };
}

function buildHeaderBlockingFindings(headerResult) {
  const findings = [];
  const headerFinding = (failureKind, item) => new TestReviewFinding("blocking", {
    origin: "test-coverage",
    failureKind,
    ...item,
  });
  for (const file of headerResult.missingHeaders || []) {
    findings.push(headerFinding("missing_header", {
      title: "Missing spec header",
      target: file,
      issue: "A spec-local test file lacks the required `// spec: R1 R2 ...` header.",
      requiredChange: "Add a valid spec header before the first non-comment code line.",
      whyBlocking: "Requirement coverage cannot be audited without a header-to-test mapping.",
    }));
  }
  for (const req of headerResult.uncoveredRequirements || []) {
    findings.push(headerFinding("uncovered_requirement", {
      title: "Uncovered requirement",
      target: req.id,
      issue: `${req.id} is testable but no spec-local test header declares it.`,
      requiredChange: `Add or update a spec-local test with a header covering ${req.id}.`,
      whyBlocking: "Implementation would proceed without required acceptance coverage.",
    }));
  }
  for (const entry of headerResult.unknownIds || []) {
    findings.push(headerFinding("unknown_requirement_id", {
      title: "Unknown requirement id in test header",
      target: `${entry.file}:${entry.id}`,
      issue: `The test header declares ${entry.id}, which is not in spec.json requirements.`,
      requiredChange: "Replace the header id with a valid requirement id or update the spec before reviewing tests.",
      whyBlocking: "The requirement coverage artifact contradicts the executable test files.",
    }));
  }
  for (const entry of headerResult.malformedHeaders || []) {
    findings.push(headerFinding("malformed_header", {
      title: "Malformed spec header",
      target: `${entry.file}:${entry.line}`,
      issue: entry.reason || "The spec header does not match the required strict form.",
      requiredChange: "Use the exact `// spec: R1 R2 ...` header form.",
      whyBlocking: "Malformed coverage markers make requirement-to-test evidence unreliable.",
    }));
  }
  for (const entry of headerResult.duplicateIds || []) {
    findings.push(headerFinding("duplicate_requirement_id", {
      title: "Duplicate requirement id in spec header",
      target: `${entry.file}:${entry.id}`,
      issue: `The spec header repeats ${entry.id}.`,
      requiredChange: "Keep each requirement id only once in the file header.",
      whyBlocking: "Duplicate coverage markers make the coverage artifact ambiguous.",
    }));
  }
  for (const entry of headerResult.duplicateHeaders || []) {
    findings.push(headerFinding("duplicate_header", {
      title: "Multiple spec headers in one test file",
      target: `${entry.file}:${entry.lineNumber}`,
      issue: "The test file contains more than one spec header.",
      requiredChange: "Merge requirement ids into the first header and remove duplicate headers.",
      whyBlocking: "Multiple header sources make the coverage artifact ambiguous.",
    }));
  }
  for (const entry of headerResult.notTestableInHeader || []) {
    findings.push(headerFinding("not_testable_in_header", {
      title: "Non-testable requirement declared as covered",
      target: `${entry.file}:${entry.id}`,
      issue: `${entry.id} is marked testable=false but appears in a test header.`,
      requiredChange: "Remove the requirement id from the test header or make the requirement testable in spec.json.",
      whyBlocking: "The coverage artifact contradicts the spec's testability contract.",
    }));
  }
  for (const entry of headerResult.mismatchedMarker || []) {
    findings.push(headerFinding("wrong_header_marker", {
      title: "Wrong spec header marker",
      target: `${entry.file}:${entry.lineNumber}`,
      issue: `JS-like test files must use // spec headers, but this file uses ${entry.found}.`,
      requiredChange: "Use `// spec: R1 R2 ...` for JS-like test files.",
      whyBlocking: "The header parser cannot trust mismatched marker syntax.",
    }));
  }
  for (const entry of headerResult.headerNoTest || []) {
    findings.push(headerFinding("header_without_test_name", {
      title: "Header id has no matching test name",
      target: `${entry.file}:${entry.id}`,
      issue: `The header declares ${entry.id}, but the file has no '${entry.id}: ...' test name.`,
      requiredChange: `Add a '${entry.id}: ...' test name or remove ${entry.id} from the header.`,
      whyBlocking: "The coverage artifact claims requirement coverage that the test body does not expose.",
    }));
  }
  for (const entry of headerResult.testNoHeader || []) {
    findings.push(headerFinding("test_name_without_header", {
      title: "Test name lacks matching header id",
      target: `${entry.file}:${entry.id}`,
      issue: `The file has a '${entry.id}: ...' test name but the header does not declare ${entry.id}.`,
      requiredChange: `Add ${entry.id} to the file header or rename the test.`,
      whyBlocking: "The coverage artifact omits a requirement referenced by executable tests.",
    }));
  }
  return findings;
}

function measurePromptChars(prompt) {
  if (prompt && typeof prompt === "object" && "userPrompt" in prompt) {
    return String(prompt.systemPrompt || "").length
      + String(prompt.userPrompt || "").length
      + String(prompt.fmtFallback || "").length;
  }
  return String(prompt || "").length;
}

function assertTestReviewPromptWithinLimit(prompt, label) {
  const chars = measurePromptChars(prompt);
  if (chars <= TEST_REVIEW_PROMPT_CHAR_LIMIT) return;
  throw new Error(
    `${TEST_REVIEW_PROMPT_TOO_LARGE_CODE}: ${label} prompt is ${chars} chars; `
    + `limit is ${TEST_REVIEW_PROMPT_CHAR_LIMIT}. Narrow test-review inputs before calling the agent.`,
  );
}

async function runTestReviewWithDependencies({
  buildReviewPrompt,
  callAgent,
  promptLabel = "test review",
}) {
  const reviewPrompt = buildReviewPrompt();
  assertTestReviewPromptWithinLimit(reviewPrompt, promptLabel);
  return callAgent(reviewPrompt);
}

function classifyReviewCommandError(err, phase) {
  const message = String(err?.stack || err?.message || err || "");
  const recoveryCommand = phase ? `senti flow run review --phase ${phase}` : "senti flow run review";
  return ReviewFailure.fromMessage({ phase: phase || "impl", message, recoveryCommand });
}

function parseReviewCliArgsForError(rawArgs) {
  try {
    const cli = parseArgs(rawArgs, {
      flags: ["--dry-run", "--skip-confirm"],
      options: ["--phase"],
      defaults: { phase: null },
    });
    return { ...cli, phase: VALID_PHASES.includes(cli.phase) ? cli.phase : null };
  } catch (_) {
    return { phase: null };
  }
}

/**
 * Parse gap analysis output.
 * @param {string} text
 * @returns {{ title: string, body: string }[]}
 */
function parseGaps(text) {
  if (/NO_GAPS/i.test(text)) return [];
  const gaps = [];
  const parts = text.split(/^### GAP-/m).filter(Boolean);
  for (const part of parts) {
    const nlIdx = part.indexOf("\n");
    const title = nlIdx >= 0 ? part.slice(0, nlIdx).trim() : part.trim();
    const body = nlIdx >= 0 ? part.slice(nlIdx + 1).trim() : "";
    gaps.push({ title, body });
  }
  return gaps;
}

/**
 * Parse file fix output and apply to disk.
 * @param {string} text - AI output with ### FILE: <path> blocks
 * @param {string} root
 * @param {string} specDir
 * @returns {string[]} paths of files written
 */
function applyTestFixes(text, root, specDir) {
  const written = [];
  const allowedRoot = path.resolve(root, specDir, "tests");
  const fileParts = text.split(/^### FILE:\s*/m).filter(Boolean);
  for (const part of fileParts) {
    const nlIdx = part.indexOf("\n");
    if (nlIdx < 0) continue;
    const filePath = part.slice(0, nlIdx).trim();
    const codeMatch = part.match(/```(?:\w*)\n([\s\S]*?)```/);
    if (!codeMatch) continue;
    const absPath = path.resolve(root, filePath);
    const relToAllowedRoot = path.relative(allowedRoot, absPath);
    if (relToAllowedRoot.startsWith("..") || path.isAbsolute(relToAllowedRoot)) {
      throw new Error(`test review fix attempted to write outside ${path.relative(root, allowedRoot)}: ${filePath}`);
    }
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(absPath, codeMatch[1]);
    written.push(filePath);
  }
  return written;
}

/**
 * Format test-review.md content.
 */
function formatTestReviewMd(reviewArtifact) {
  const lines = ["# Test Review Results", ""];
  lines.push(`## Verdict: ${reviewArtifact.verdict}`, "");
  lines.push(`Coverage artifact: \`${reviewArtifact.coverageArtifact}\``, "");

  if (reviewArtifact.toolingFailure) {
    const failure = reviewArtifact.toolingFailure;
    lines.push("## Tooling Failure", "");
    lines.push(`- kind: ${failure.kind}`);
    lines.push(`- message: ${failure.message}`);
    lines.push(`- recovery: ${failure.recovery}`);
    lines.push("");
  }

  lines.push("## Blocking Findings", "");
  if (reviewArtifact.blockingFindings.length === 0) {
    lines.push("No blocking findings.");
  } else {
    for (let i = 0; i < reviewArtifact.blockingFindings.length; i++) {
      const finding = reviewArtifact.blockingFindings[i];
      lines.push(`### ${i + 1}. ${finding.title}`);
      lines.push(`**Target:** ${finding.target}`);
      lines.push(`**Issue:** ${finding.issue}`);
      lines.push(`**Required change:** ${finding.requiredChange}`);
      lines.push(`**Why blocking:** ${finding.whyBlocking}`);
      lines.push("");
    }
  }

  lines.push("", "## Advisory Findings", "");
  if (reviewArtifact.advisoryFindings.length === 0) {
    lines.push("No advisory findings.");
  } else {
    for (let i = 0; i < reviewArtifact.advisoryFindings.length; i++) {
      const finding = reviewArtifact.advisoryFindings[i];
      lines.push(`### ${i + 1}. ${finding.title}`);
      lines.push(`**Target:** ${finding.target}`);
      lines.push(`**Improvement:** ${finding.improvement}`);
      lines.push(`**Why non-blocking:** ${finding.whyNonBlocking}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

function writeTestReviewArtifacts({ root, specDir, reviewArtifact, coverageArtifact }) {
  const reviewDir = path.resolve(root, specDir);
  fs.mkdirSync(reviewDir, { recursive: true });
  const coveragePath = path.join(reviewDir, TEST_COVERAGE_JSON_FILE);
  const reviewJsonPath = path.join(reviewDir, TEST_REVIEW_JSON_FILE);
  const reviewMdPath = path.join(reviewDir, "test-review.md");
  const reviewJson = reviewArtifact.toJSON();
  reviewJson.contractSummary = contractFromTestReviewArtifact(reviewJson, {
    artifactPath: path.relative(root, reviewJsonPath).split(path.sep).join("/"),
  }).summary.toJSON();
  const attemptNumber = reviewHistoryAttemptNumber(reviewDir, "test");
  writeJsonArtifact(coveragePath, coverageArtifact);
  writeReviewAttemptHistory({
    specDir: reviewDir,
    phase: "test",
    latestBasename: "test-review.md",
    attemptNumber,
    content: formatTestReviewMd(reviewArtifact),
    findings: [
      ...findingsWithSeverity(reviewArtifact.blockingFindings, "blocking"),
      ...findingsWithSeverity(reviewArtifact.advisoryFindings, "non-blocking"),
    ],
  });
  writeReviewAttemptHistory({
    specDir: reviewDir,
    phase: "test",
    latestBasename: TEST_REVIEW_JSON_FILE,
    attemptNumber,
    artifact: reviewJson,
  });
  return {
    coveragePath: path.relative(root, coveragePath).split(path.sep).join("/"),
    reviewJsonPath: path.relative(root, reviewJsonPath).split(path.sep).join("/"),
    reviewMdPath: path.relative(root, reviewMdPath).split(path.sep).join("/"),
  };
}

function writeTestCoverageArtifact({ root, specDir, coverageArtifact }) {
  const reviewDir = path.resolve(root, specDir);
  fs.mkdirSync(reviewDir, { recursive: true });
  const coveragePath = path.join(reviewDir, TEST_COVERAGE_JSON_FILE);
  writeJsonArtifact(coveragePath, coverageArtifact);
  return path.relative(root, coveragePath).split(path.sep).join("/");
}

function buildToolingFailureReview({ kind, err, coverageRelPath }) {
  const message = err?.message || String(err);
  const toolingFailure = new TestReviewToolingFailure({
    kind,
    message,
    recovery: "Fix the test-review tooling failure, then rerun test-review. If proceeding with accepted risk, record structured evidence in completion-overrides.json entries.test-review; issue-log alone is audit context, not override evidence.",
  });
  return new TestReviewArtifact({
    verdict: "TOOLING_FAILURE",
    coverageArtifact: coverageRelPath || TEST_COVERAGE_JSON_FILE,
    blocking: [],
    advisory: [],
    toolingFailure,
  });
}

/**
 * Run the test review pipeline.
 */
async function runTestReview(root, flow, config, dryRun) {
  const specDir = path.dirname(flow.spec);
  const specInput = path.resolve(root, flow.spec);

  // spec 207 / T8: require spec.json for the test review pipeline. No fallback
  // to spec.md; loadSpecJson throws when spec.json is missing or invalid.
  const spec = loadSpecJson(specInput);
  const requirements = extractRequirements(spec);
  if (!requirements) {
    console.error("Error: no requirements defined in spec.json");
    process.exit(EXIT_ERROR);
  }

  let coverageArtifact;
  let headerBlockingFindings = [];
  let artifactPaths;
  try {
    const { validateTestHeaders, collectFileHeaders, formatValidationMessages } = await import("../lib/test-headers.js");
    const absoluteSpecDir = path.resolve(root, specDir);
    const headerResult = validateTestHeaders({
      specDir: absoluteSpecDir,
      spec,
    });
    headerResult.messages = formatValidationMessages(headerResult);
    coverageArtifact = new TestCoverageArtifact({
      spec,
      specDir: absoluteSpecDir,
      headerResult,
      fileHeaders: collectFileHeaders(absoluteSpecDir),
    });
    artifactPaths = {
      coveragePath: writeTestCoverageArtifact({ root, specDir, coverageArtifact }),
    };
    headerBlockingFindings = buildHeaderBlockingFindings(headerResult);
    if (headerBlockingFindings.length > 0) {
      console.error(`  [test-review] header validation: ${headerBlockingFindings.length} blocking finding(s)`);
    }
  } catch (err) {
    coverageArtifact = new TestCoverageFailureArtifact(err.message);
    const coverageRelPath = `${specDir}/${TEST_COVERAGE_JSON_FILE}`.split(path.sep).join("/");
    const reviewArtifact = buildToolingFailureReview({ kind: "coverage_error", err, coverageRelPath });
    artifactPaths = writeTestReviewArtifacts({ root, specDir, reviewArtifact, coverageArtifact });
    console.error(`  [test-review] Results saved to ${artifactPaths.reviewMdPath}`);
    console.error(`  [test-review] JSON saved to ${artifactPaths.reviewJsonPath}`);
    console.error(`  [test-review] Coverage saved to ${artifactPaths.coveragePath}`);
    console.error("  [test-review] verdict=TOOLING_FAILURE blocking=0 advisory=0 toolingFailure=coverage_error");
    console.log("Test review TOOLING_FAILURE. Coverage artifact generation failed; see test-review.json.");
    return;
  }

  const testFiles = collectTestFiles(root, specDir);
  let aiFindings;
  try {
    const agent = ensureAgent("flow.test.review");
    console.error("  [test-review] Running one-shot static review...");
    if (dryRun) console.error("  [test-review] dry-run has no auto-fix phase; detection still runs once.");
    const raw = await runTestReviewWithDependencies({
      buildReviewPrompt: () => buildTestReviewPrompt(requirements, coverageArtifact, testFiles),
      callAgent: (reviewPrompt) => callReviewAgent(
        agent, reviewPrompt, "flow.test.review",
        "You are a one-shot static test reviewer. Return JSON with blockingFindings and advisoryFindings.",
      ),
    });
    aiFindings = parseTestReviewFindings(raw);
  } catch (err) {
    const kind = /JSON|schema|parse|Unexpected token/i.test(err?.message || "") ? "parser_error" : "agent_error";
    const reviewArtifact = buildToolingFailureReview({
      kind,
      err,
      coverageRelPath: artifactPaths.coveragePath,
    });
    artifactPaths = writeTestReviewArtifacts({ root, specDir, reviewArtifact, coverageArtifact });
    console.error(`  [test-review] Results saved to ${artifactPaths.reviewMdPath}`);
    console.error(`  [test-review] JSON saved to ${artifactPaths.reviewJsonPath}`);
    console.error(`  [test-review] Coverage saved to ${artifactPaths.coveragePath}`);
    console.error(`  [test-review] verdict=TOOLING_FAILURE blocking=0 advisory=0 toolingFailure=${kind}`);
    console.log("Test review TOOLING_FAILURE. Static review tooling failed; see test-review.json.");
    return;
  }

  const blockingFindings = [...headerBlockingFindings, ...aiFindings.blocking];
  const advisoryFindings = aiFindings.advisory;
  const verdict = blockingFindings.length > 0
    ? "FAIL"
    : advisoryFindings.length > 0
      ? "ADVISORY"
      : "PASS";
  const reviewArtifact = new TestReviewArtifact({
    verdict,
    coverageArtifact: artifactPaths.coveragePath,
    blocking: blockingFindings,
    advisory: advisoryFindings,
  });
  artifactPaths = writeTestReviewArtifacts({ root, specDir, reviewArtifact, coverageArtifact });
  console.error(`  [test-review] Results saved to ${artifactPaths.reviewMdPath}`);
  console.error(`  [test-review] JSON saved to ${artifactPaths.reviewJsonPath}`);
  console.error(`  [test-review] Coverage saved to ${artifactPaths.coveragePath}`);
  console.error(`  [test-review] verdict=${verdict} blocking=${blockingFindings.length} advisory=${advisoryFindings.length}`);

  if (verdict === "PASS") {
    console.log("Test review PASS. No blocking or advisory findings.");
  } else if (verdict === "ADVISORY") {
    console.log(`Test review ADVISORY. ${advisoryFindings.length} non-blocking finding(s) recorded; implementation may proceed.`);
  } else {
    console.log(`Test review FAIL. ${blockingFindings.length} blocking finding(s) recorded; fix tests before implementation.`);
  }
}

// ---------------------------------------------------------------------------
// Spec review pipeline (--phase spec)
// ---------------------------------------------------------------------------

import { minify } from "../../docs/lib/minify.js";

const SPEC_REVIEW_TEXT_LIMIT = 500;
const SPEC_REVIEW_EVIDENCE_LIMIT = 700;
const SPEC_REVIEW_TASK_STRATEGY_LIMIT = 700;

function summarizeSpecReviewValue(value, limit = SPEC_REVIEW_TEXT_LIMIT) {
  if (value == null) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}...`;
}

function formatSpecReviewSimpleList(values) {
  if (!Array.isArray(values) || values.length === 0) return "";
  return values.map((value) => `- ${summarizeSpecReviewValue(value)}`).join("\n");
}

function formatSpecReviewDecision(decision) {
  const text = summarizeSpecReviewValue(decision?.text ?? decision);
  const details = [];
  if (decision?.evidence) {
    details.push(`evidence: ${summarizeSpecReviewValue(decision.evidence, SPEC_REVIEW_EVIDENCE_LIMIT)}`);
  }
  if (decision?.consideredAlternatives) {
    details.push(`alternatives: ${summarizeSpecReviewValue(decision.consideredAlternatives, SPEC_REVIEW_EVIDENCE_LIMIT)}`);
  }
  return details.length > 0
    ? `- ${text}\n  ${details.join("\n  ")}`
    : `- ${text}`;
}

function formatSpecReviewTask(task) {
  const lines = [`- ${task.id}: ${summarizeSpecReviewValue(task.title, 250)}`];
  lines.push(`  status: ${task.status || "unknown"}`);
  lines.push(`  goal: ${summarizeSpecReviewValue(task.goal, SPEC_REVIEW_TEXT_LIMIT)}`);
  if (Array.isArray(task.acceptance) && task.acceptance.length > 0) {
    lines.push(`  acceptance: ${task.acceptance.map((item) => summarizeSpecReviewValue(item, 300)).join(" | ")}`);
  }
  if (task.test_strategy) {
    lines.push(`  test_strategy: ${summarizeSpecReviewValue(task.test_strategy, SPEC_REVIEW_TASK_STRATEGY_LIMIT)}`);
  }
  return lines.join("\n");
}

function buildSpecSummaryMarkdown(spec) {
  const lines = [];
  if (spec.goal) lines.push(`# Goal\n${spec.goal}`);
  if (spec.background) lines.push(`# Background\n${spec.background}`);
  if (spec.scope) {
    lines.push("# Scope");
    if (Array.isArray(spec.scope.in)) lines.push(`## In\n${spec.scope.in.map((s) => `- ${s}`).join("\n")}`);
    if (Array.isArray(spec.scope.out)) lines.push(`## Out\n${spec.scope.out.map((s) => `- ${s}`).join("\n")}`);
  }
  if (Array.isArray(spec.constraints)) lines.push(`# Constraints\n${spec.constraints.map((c) => `- ${c}`).join("\n")}`);
  if (Array.isArray(spec.design_principles)) lines.push(`# Design Principles\n${spec.design_principles.map((d) => `- ${d}`).join("\n")}`);
  if (spec.overview) {
    lines.push("# Overview");
    if (Array.isArray(spec.overview.modules)) lines.push(`## Modules\n${spec.overview.modules.map((m) => `- ${m.text}`).join("\n")}`);
    if (Array.isArray(spec.overview.data_flow)) lines.push(`## Data Flow\n${spec.overview.data_flow.map((d) => `- ${d.text}`).join("\n")}`);
    if (Array.isArray(spec.overview.decisions)) lines.push(`## Decisions\n${spec.overview.decisions.map(formatSpecReviewDecision).join("\n")}`);
  }
  if (Array.isArray(spec.requirements)) {
    lines.push("# Requirements");
    for (const r of spec.requirements) {
      const testable = r.testable === false ? " testable=false" : "";
      const status = r.status ? ` status=${r.status}` : "";
      lines.push(`- ${r.id} [${r.priority || "unknown"}${status}${testable}]: ${r.desc}`);
    }
  }
  const acceptance = formatSpecReviewSimpleList(spec.acceptance_criteria);
  if (acceptance) lines.push(`# Acceptance Criteria\n${acceptance}`);
  if (Array.isArray(spec.clarifications) && spec.clarifications.length > 0) {
    lines.push(`# Clarifications\n${spec.clarifications.map((c) => [
      `- Q: ${summarizeSpecReviewValue(c.q)}`,
      `  A: ${summarizeSpecReviewValue(c.a)}`,
    ].join("\n")).join("\n")}`);
  }
  if (Array.isArray(spec.alternatives_considered) && spec.alternatives_considered.length > 0) {
    lines.push(`# Alternatives Considered\n${spec.alternatives_considered.map((a) => [
      `- Option: ${summarizeSpecReviewValue(a.option)}`,
      `  Reason: ${summarizeSpecReviewValue(a.reason)}`,
    ].join("\n")).join("\n")}`);
  }
  const openQuestions = formatSpecReviewSimpleList(spec.open_questions);
  if (openQuestions) lines.push(`# Open Questions\n${openQuestions}`);
  if (Array.isArray(spec.tasks) && spec.tasks.length > 0) {
    lines.push(`# Tasks\n${spec.tasks.map(formatSpecReviewTask).join("\n")}`);
  }
  const md = lines.join("\n\n");
  return minify(md, "spec-summary.md");
}

/**
 * Build a context-search query from a spec.json object.
 */
function extractGoalAndScope(spec) {
  if (Array.isArray(spec?.keywords) && spec.keywords.length > 0) {
    return spec.keywords.join(" ");
  }
  const parts = [];
  if (spec?.goal) parts.push(spec.goal);
  if (Array.isArray(spec?.scope?.in) && spec.scope.in.length) {
    parts.push(spec.scope.in.join("\n"));
  }
  return parts.join("\n");
}

function extractScopePaths(spec) {
  if (!Array.isArray(spec?.scope?.in)) return [];
  const paths = [];
  const re = /`([^`]+\.[a-zA-Z0-9]+)`/g;
  for (const item of spec.scope.in) {
    let m;
    while ((m = re.exec(item)) !== null) {
      paths.push(m[1]);
    }
  }
  return paths;
}

const SPEC_REVIEW_BLOCKING_ITEM_SCHEMA = Object.freeze({
  type: "object",
  required: ["title", "target", "issue", "requiredChange", "whyBlocking"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1 },
    target: { type: "string", minLength: 1 },
    issue: { type: "string", minLength: 1 },
    requiredChange: { type: "string", minLength: 1 },
    whyBlocking: { type: "string", minLength: 1 },
  },
});

const SPEC_REVIEW_IMPROVEMENT_ITEM_SCHEMA = Object.freeze({
  type: "object",
  required: ["title", "target", "improvement", "whyNonBlocking"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1 },
    target: { type: "string", minLength: 1 },
    improvement: { type: "string", minLength: 1 },
    whyNonBlocking: { type: "string", minLength: 1 },
  },
});

const SPEC_REVIEW_RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  required: ["blockingFindings", "nonBlockingImprovements"],
  additionalProperties: false,
  properties: {
    blockingFindings: {
      type: "array",
      items: SPEC_REVIEW_BLOCKING_ITEM_SCHEMA,
    },
    nonBlockingImprovements: {
      type: "array",
      items: SPEC_REVIEW_IMPROVEMENT_ITEM_SCHEMA,
    },
  },
});

const SPEC_REVIEW_FMT_FALLBACK = [
  "OUTPUT FORMAT - strictly required:",
  "Return only a JSON object. No markdown, no preamble, no commentary.",
  "Always include both top-level arrays: blockingFindings[] and nonBlockingImprovements[].",
  "Schema:",
  JSON.stringify(SPEC_REVIEW_RESPONSE_SCHEMA, null, 2),
  "Use empty arrays when there are no findings in a category.",
].join("\n");

/**
 * Build the spec review prompt.
 * @param {string} specText - Minified spec summary from spec.json fields
 * @param {Object[]} contextEntries - Related codebase entries from contextSearch
 * @returns {{systemPrompt: string|null, userPrompt: string}}
 */
function buildSpecReviewPrompt(specText, contextEntries, previousReview = null) {
  const pb = new PromptBuilder()
    .setRole("You are a codebase-context spec reviewer. Find design, implementation-target, and existing-behavior gaps that gate cannot determine mechanically.")
    .setRules([
      "Focus on:",
      "- Blocking findings: codebase-context gaps that make the spec impossible or unsafe to implement or test correctly.",
      "- Treat a concern as blocking only when at least one of these concrete failure modes applies:",
      "  1. The spec contradicts verified existing codebase behavior or omits an impact on existing behavior that must be preserved.",
      "  2. The required behavior has no implementation target or integration point, and codebase context shows one is necessary.",
      "  3. The required behavior has no observable acceptance/test basis, so tests cannot be designed.",
      "  4. The spec omits a required error path, data path, or compatibility path that existing interfaces make mandatory.",
      "  5. Two spec fields conflict in a way that changes what should be implemented, and the conflict is not a gate-owned mechanical issue.",
      "- Do not classify a concern as blocking merely because wording could be clearer, extra rationale would help, another related file could be mentioned, or a design alternative could be documented.",
      "- Non-blocking improvements: helpful clarifications, extra related-file mentions, wording improvements, broader context, or nice-to-have completeness that does not block implementation/test/gate.",
      "- Gate-owned checks are not blocking findings for this review: JSON schema, required/empty fields, unresolved markers, tasks missing/empty/depth structure, and guardrail compliance are handled by the downstream gate.",
      "- If a concern can be decided mechanically from spec.json shape or guardrail articles without codebase context, leave it to gate instead of reporting it here.",
      "- This review is diagnostic. Do not rewrite the spec, do not produce a repair plan, and do not broaden scope.",
      "- For blocking findings, requiredChange must name the smallest spec-level correction needed to remove the blocker.",
      "- For blocking findings, whyBlocking must name the concrete implementation, testing, safety, or compatibility failure that occurs if the spec is left unchanged.",
      "- If a concern is gate-owned, omit it entirely rather than reporting it as a finding or improvement.",
      "- Do not fail the review for non-blocking improvements.",
      "- Do not require every issue to map to a file. Use Target for a spec section, requirement id, file path, or GLOBAL.",
      "- When previous review memory is provided, do not repeat acknowledged non-blocking improvements unless the current spec has changed so the issue is now blocking.",
      "- Re-report previous blocking findings only if they are still blocking in the current spec.",
      "",
      "Return JSON only. The response object must contain:",
      "- Always include both top-level arrays, even when one or both categories have no findings.",
      "- blockingFindings[] with title, target, issue, requiredChange, whyBlocking",
      "- nonBlockingImprovements[] with title, target, improvement, whyNonBlocking",
      "- Use empty arrays when there are no findings in a category.",
    ].join("\n"))
    .setJsonSchema(SPEC_REVIEW_RESPONSE_SCHEMA)
    .setFmtFallback(SPEC_REVIEW_FMT_FALLBACK)
    .addUserPrompt("## Spec", specText)
    .addUserPrompt(
      "## Codebase Context (related files)",
      formatCodebaseContextForPrompt(contextEntries),
    );

  if (previousReview) {
    pb.addUserPrompt(
      "## Previous Spec Review Memory",
      JSON.stringify(previousReview.toPromptMemory(), null, 2),
    );
  }

  return pb.build();
}

function buildSpecReviewRepairPrompt(rawResponse, validationError) {
  return new PromptBuilder()
    .setRole("You repair spec-review JSON response shape. Do not re-review the spec and do not add new findings.")
    .setRules([
      "Rewrite the existing spec-review response into the required JSON shape.",
      "Return JSON only. No markdown, no preamble, no commentary.",
      "Always include both top-level arrays: blockingFindings[] and nonBlockingImprovements[].",
      "Preserve every existing finding exactly when its fields already match the schema.",
      "Use empty arrays only for missing categories that have no findings.",
      "Do not invent findings, remove valid findings, or change blocking/advisory classification.",
    ].join("\n"))
    .setJsonSchema(SPEC_REVIEW_RESPONSE_SCHEMA)
    .setFmtFallback(SPEC_REVIEW_FMT_FALLBACK)
    .addUserPrompt(
      "## Repair task",
      "Rewrite the existing spec-review response into the required JSON shape. Do not re-review the spec.",
    )
    .addUserPrompt("## Existing spec-review response", rawResponse)
    .addUserPrompt("## Validation error", validationError?.message || String(validationError || ""))
    .build();
}

function extractMarkdownField(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(body || "").match(new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*(.+)$`, "im"));
  if (!match) return "";
  return match[1].trim().replace(/^`(.+)`$/, "$1");
}

class SpecReviewItem {
  constructor(kind, item) {
    this.kind = kind;
    this.title = item.title;
    this.target = item.target || extractMarkdownField(item.body, "Target") || extractMarkdownField(item.body, "File") || "GLOBAL";
    if (kind === "blocking") {
      this.issue = item.issue || extractMarkdownField(item.body, "Issue");
      this.requiredChange = item.requiredChange || extractMarkdownField(item.body, "Required change") || extractMarkdownField(item.body, "Suggestion");
      this.whyBlocking = item.whyBlocking || extractMarkdownField(item.body, "Why blocking");
      this.body = item.body || [
        `**Target:** ${this.target}`,
        `**Issue:** ${this.issue}`,
        `**Required change:** ${this.requiredChange}`,
        `**Why blocking:** ${this.whyBlocking}`,
      ].join("\n");
    } else {
      this.improvement = item.improvement || extractMarkdownField(item.body, "Improvement") || extractMarkdownField(item.body, "Suggestion");
      this.whyNonBlocking = item.whyNonBlocking || extractMarkdownField(item.body, "Why non-blocking");
      this.body = item.body || [
        `**Target:** ${this.target}`,
        `**Improvement:** ${this.improvement}`,
        `**Why non-blocking:** ${this.whyNonBlocking}`,
      ].join("\n");
    }
  }

  toPromptMemory() {
    const base = {
      title: this.title,
      target: this.target,
    };
    if (this.kind === "blocking") {
      return {
        ...base,
        issue: this.issue,
        requiredChange: this.requiredChange,
      };
    }
    return {
      ...base,
      improvement: this.improvement,
      whyNonBlocking: this.whyNonBlocking,
    };
  }

  toJSON() {
    const base = {
      kind: this.kind,
      title: this.title,
      target: this.target,
      body: this.body,
    };
    if (this.kind === "blocking") {
      return {
        ...base,
        issue: this.issue,
        requiredChange: this.requiredChange,
        whyBlocking: this.whyBlocking,
      };
    }
    return {
      ...base,
      improvement: this.improvement,
      whyNonBlocking: this.whyNonBlocking,
    };
  }
}

class SpecReviewArtifact {
  constructor({ verdict, blocking = [], improvements = [], generatedAt = new Date().toISOString() }) {
    this.version = 1;
    this.phase = "spec";
    this.generatedAt = generatedAt;
    this.verdict = verdict;
    this.blockingFindings = blocking.map((item) => item instanceof SpecReviewItem ? item : new SpecReviewItem("blocking", item));
    this.nonBlockingImprovements = improvements.map((item) => item instanceof SpecReviewItem ? item : new SpecReviewItem("improvement", item));
    this.counts = Object.freeze({
      blocking: this.blockingFindings.length,
      nonBlocking: this.nonBlockingImprovements.length,
      total: this.blockingFindings.length + this.nonBlockingImprovements.length,
    });
  }

  toPromptMemory() {
    return {
      verdict: this.verdict,
      counts: this.counts,
      previousBlockingFindings: this.blockingFindings.map((item) => item.toPromptMemory()),
      acknowledgedNonBlockingImprovements: this.nonBlockingImprovements.map((item) => item.toPromptMemory()),
    };
  }

  toJSON() {
    return {
      version: this.version,
      phase: this.phase,
      generatedAt: this.generatedAt,
      verdict: this.verdict,
      counts: this.counts,
      blockingFindings: this.blockingFindings.map((item) => item.toJSON()),
      nonBlockingImprovements: this.nonBlockingImprovements.map((item) => item.toJSON()),
    };
  }
}

function extractJsonObjectCandidate(raw) {
  let text = String(raw || "").trim();
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) text = fenceMatch[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

class SpecReviewSchemaValidationError extends Error {
  constructor(errors, parsed) {
    super(`spec review output failed schema validation: ${errors.join("; ")}`);
    this.name = "SpecReviewSchemaValidationError";
    this.errors = errors;
    this.parsed = parsed;
  }
}

function normalizeReviewResponseArrays(parsed, fields) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const normalized = { ...parsed };
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(normalized, field)) {
      normalized[field] = [];
    }
  }
  return normalized;
}

function normalizeSpecReviewResponseShape(parsed) {
  return normalizeReviewResponseArrays(parsed, ["blockingFindings", "nonBlockingImprovements"]);
}

function parseSpecReviewJsonOutput(raw) {
  const candidate = extractJsonObjectCandidate(raw);
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    parsed = JSON.parse(repairJson(candidate));
  }
  parsed = normalizeSpecReviewResponseShape(parsed);
  const errors = validateSchema(parsed, SPEC_REVIEW_RESPONSE_SCHEMA);
  if (errors.length > 0) {
    throw new SpecReviewSchemaValidationError(errors, parsed);
  }
  return parsed;
}

function parseSpecReviewFindings(text) {
  const parsed = parseSpecReviewJsonOutput(text);
  return {
    blocking: parsed.blockingFindings.map((item) => new SpecReviewItem("blocking", item)),
    improvements: parsed.nonBlockingImprovements.map((item) => new SpecReviewItem("improvement", item)),
  };
}

async function parseSpecReviewFindingsWithRepair(raw, repairResponseProvider) {
  try {
    return parseSpecReviewFindings(raw);
  } catch (err) {
    if (!(err instanceof SpecReviewSchemaValidationError)) throw err;
    if (typeof repairResponseProvider !== "function") throw err;
    const repairPrompt = buildSpecReviewRepairPrompt(raw, err);
    const repairedRaw = await repairResponseProvider({
      rawResponse: raw,
      validationError: err,
      repairPrompt,
    });
    try {
      return parseSpecReviewFindings(repairedRaw);
    } catch (repairErr) {
      if (repairErr instanceof SpecReviewSchemaValidationError) throw repairErr;
      throw new Error(`spec review output failed schema validation: repair response is invalid JSON: ${repairErr.message}`);
    }
  }
}

function formatSpecReviewJson({ blocking = [], improvements = [], verdict = "PASS" } = {}) {
  const artifact = new SpecReviewArtifact({ verdict, blocking, improvements });
  return JSON.stringify(artifact, null, 2) + "\n";
}

function loadSpecReviewArtifact(reviewJsonPath) {
  if (!fs.existsSync(reviewJsonPath)) return null;
  const data = JSON.parse(fs.readFileSync(reviewJsonPath, "utf8"));
  return new SpecReviewArtifact({
    verdict: data.verdict || "PASS",
    generatedAt: data.generatedAt,
    blocking: Array.isArray(data.blockingFindings) ? data.blockingFindings : [],
    improvements: Array.isArray(data.nonBlockingImprovements) ? data.nonBlockingImprovements : [],
  });
}

function formatPhaseReviewMd(title, history, verdict, finalIssues) {
  const lines = [`# ${title}`, ""];
  lines.push("## Review Iterations");
  for (let i = 0; i < history.length; i++) {
    if (history.length > 1) lines.push(`### Iteration ${i + 1}`);
    lines.push(history[i]);
    lines.push("");
  }
  lines.push(`## Verdict: ${verdict}`);
  if (verdict === "FAIL" && finalIssues.length > 0) {
    lines.push("");
    lines.push("### Remaining Issues");
    for (const p of finalIssues) {
      lines.push(`- ${p.title}`);
      if (p.body) lines.push(`  ${p.body}`);
    }
  }
  return lines.join("\n");
}

function formatSpecReviewMd(input = {}) {
  const normalized = Array.isArray(input)
    ? { blocking: input, improvements: [], verdict: input.length > 0 ? "FAIL" : "PASS" }
    : input;
  const { blocking = [], improvements = [], verdict = "PASS" } = normalized;
  const lines = ["# Spec Review Results", ""];
  lines.push(`## Verdict: ${verdict}`, "");

  lines.push("## Blocking Findings", "");
  if (blocking.length === 0) {
    lines.push("No blocking findings.");
  } else {
    for (let i = 0; i < blocking.length; i++) {
      lines.push(`### ${i + 1}. ${blocking[i].title}`);
      if (blocking[i].body) lines.push(blocking[i].body);
      lines.push("");
    }
  }

  lines.push("", "## Non-blocking Improvements", "");
  if (improvements.length === 0) {
    lines.push("No non-blocking improvements.");
  } else {
    for (let i = 0; i < improvements.length; i++) {
      lines.push(`### ${i + 1}. ${improvements[i].title}`);
      if (improvements[i].body) lines.push(improvements[i].body);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Run the spec review pipeline (propose-only, 1 AI call).
 */
async function runSpecReview(root, flow, config, dryRun) {
  const specInput = path.resolve(root, flow.spec);
  const specDir = path.dirname(flow.spec);
  const spec = loadSpecJson(specInput);

  let analysisData = null;
  try {
    const { loadAnalysisEntries, contextSearch: ctxSearch } = await import("../lib/get-context.js");
    analysisData = { ...loadAnalysisEntries(root), ctxSearch };
  } catch (e) {
    console.error(`  [spec-review] Warning: failed to load codebase context: ${e.message}`);
  }

  const proposeAgent = ensureAgent("flow.spec.review.propose");


  console.error("  [spec-review] Proposing...");
  const specSummary = buildSpecSummaryMarkdown(spec);
  let contextEntries = [];
  if (analysisData) {
    const searchQuery = extractGoalAndScope(spec);
    if (searchQuery) {
      const scopePaths = extractScopePaths(spec);
      contextEntries = await analysisData.ctxSearch(
        analysisData.entries, analysisData.analysis, searchQuery, root, "ngram",
        { scopePaths, expandImports: true },
      );
    }
  }
  const reviewDir = path.resolve(root, specDir);
  const reviewPath = path.join(reviewDir, "spec-review.md");
  const reviewJsonPath = path.join(reviewDir, "spec-review.json");
  let previousReview = null;
  try {
    previousReview = loadSpecReviewArtifact(reviewJsonPath);
  } catch (e) {
    console.error(`  [spec-review] Warning: failed to load previous review memory: ${e.message}`);
  }

  const proposePrompt = buildSpecReviewPrompt(specSummary, contextEntries, previousReview);
  const proposeRaw = await callReviewAgent(proposeAgent, proposePrompt, "flow.spec.review.propose");

  const findings = await parseSpecReviewFindingsWithRepair(proposeRaw, async ({ repairPrompt }) => {
    console.error("  [spec-review] Repairing response schema...");
    return callReviewAgent(proposeAgent, repairPrompt, "flow.spec.review.repair");
  });
  const blockingCount = findings.blocking.length;
  const improvementCount = findings.improvements.length;
  const proposalCount = blockingCount + improvementCount;
  const verdict = blockingCount > 0 ? "FAIL" : improvementCount > 0 ? "ADVISORY" : "PASS";

  const specReviewArtifact = { ...findings, verdict };
  const attemptNumber = reviewHistoryAttemptNumber(reviewDir, "spec");
  writeReviewAttemptHistory({
    specDir: reviewDir,
    phase: "spec",
    latestBasename: "spec-review.md",
    attemptNumber,
    content: formatSpecReviewMd(specReviewArtifact),
    findings: [
      ...findingsWithSeverity(findings.blocking, "blocking"),
      ...findingsWithSeverity(findings.improvements, "non-blocking"),
    ],
  });
  writeReviewAttemptHistory({
    specDir: reviewDir,
    phase: "spec",
    latestBasename: "spec-review.json",
    attemptNumber,
    artifact: JSON.parse(formatSpecReviewJson(specReviewArtifact)),
  });
  console.error(`  [spec-review] Results saved to ${path.relative(root, reviewPath)}`);
  console.error(`  [spec-review] JSON saved to ${path.relative(root, reviewJsonPath)}`);
  console.error(`  [spec-review] blockingCount=${blockingCount} improvementCount=${improvementCount} proposalCount=${proposalCount}`);

  console.error(`  [spec-review] verdict=${verdict} proposalCount=${proposalCount}`);
  if (verdict === "PASS") {
    console.log("NO_PROPOSALS");
  } else if (verdict === "ADVISORY") {
    console.log(`Spec review ADVISORY. ${improvementCount} non-blocking improvement(s) recorded. See spec-review.md.`);
  } else {
    console.log(`Spec review FAIL. ${blockingCount} blocking finding(s) found. See spec-review.md.`);
  }
}

// ---------------------------------------------------------------------------
// Draft review pipeline (--phase draft)
// ---------------------------------------------------------------------------

function formatDraftQuestionReviewEntry(q, i) {
  return [
    `### ${q.id || `Q${i + 1}`} [${q.status || "unknown"} / ${q.category || "unknown"}]`,
    `**Question:** ${q.question}`,
  ].join("\n");
}

function formatDraftQaMarkdownFieldLine(label, value, fallback) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const text = trimmed !== "" ? value : fallback;
  return `**${label}:** ${text}`;
}

function formatDraftCoverageReviewEntry(q, i) {
  return [
    `### ${q.id || `Q${i + 1}`} [${q.status || "unknown"} / ${q.category || "unknown"}]`,
    `**Question:** ${q.question}`,
    formatDraftQaMarkdownFieldLine("Answer", q.answer, "(empty)"),
    formatDraftQaMarkdownFieldLine("Evidence", q.evidence, "(none)"),
    formatDraftQaMarkdownFieldLine("Why", q.why, "(none)"),
    formatDraftQaMarkdownFieldLine("Considered", q.considered, "(none)"),
    formatDraftQaMarkdownFieldLine("Dropped reason", q.droppedReason, "(none)"),
  ].join("\n");
}

function selectDraftQuestionReviewEntries(entries) {
  return entries.filter((q) => (
    q.status === "pending"
    || q.status === "approved"
    || q.status == null
  ));
}

function selectDraftCoverageReviewEntries(entries) {
  return entries.filter((q) => (
    q.status === "answered"
    || q.status === "dropped"
  ));
}

function summarizeDraftQaStatuses(draftJson) {
  const counts = { total: 0, pending: 0, approved: 0, answered: 0, dropped: 0, other: 0 };
  if (!Array.isArray(draftJson?.qa)) return counts;
  counts.total = draftJson.qa.length;
  for (const q of draftJson.qa) {
    if (Object.hasOwn(counts, q.status)) counts[q.status] += 1;
    else counts.other += 1;
  }
  return counts;
}

function formatDraftQaStatusSummary(draftJson) {
  const counts = summarizeDraftQaStatuses(draftJson);
  return [
    `- total: ${counts.total}`,
    `- pending: ${counts.pending}`,
    `- approved: ${counts.approved}`,
    `- answered: ${counts.answered}`,
    `- dropped: ${counts.dropped}`,
    `- other: ${counts.other}`,
  ].join("\n");
}

function formatDraftDecisionMap(draftJson) {
  const map = draftJson?.decisionMap;
  if (!map || typeof map !== "object" || Array.isArray(map)) return "(no decisionMap)";

  return [
    ["Known facts", map.knownFacts],
    ["Decision points", map.decisionPoints],
    ["Resolved by project rules", map.resolvedByProjectRules],
    ["Requires user judgment", map.requiresUserJudgment],
    ["Deferred to spec", map.deferredToSpec],
  ].map(([label, values]) => {
    const items = Array.isArray(values) && values.length
      ? values.map((value) => `- ${value}`).join("\n")
      : "- (none)";
    return `### ${label}\n${items}`;
  }).join("\n\n");
}

function formatDraftReviewQaEntries(draftJson, stage) {
  if (!Array.isArray(draftJson?.qa)) return "(no QA entries)";

  if (stage.key === "questions") {
    const entries = selectDraftQuestionReviewEntries(draftJson.qa);
    if (entries.length === 0) return "(no pending or approved QA entries)";
    return entries.map(formatDraftQuestionReviewEntry).join("\n\n");
  }

  const entries = selectDraftCoverageReviewEntries(draftJson.qa);
  if (entries.length === 0) return "(no answered or dropped QA entries)";
  return entries.map(formatDraftCoverageReviewEntry).join("\n\n");
}

function buildDraftQuestionReviewPrompt(draftJson, requestText) {
  const qaText = Array.isArray(draftJson?.qa)
    ? formatDraftReviewQaEntries(draftJson, { key: "questions" })
    : "(no QA entries)";

  return [
    "You are a draft question sanity reviewer. Perform a one-shot finite structural check of the initial question list.",
    "This is not a question generation task. The draft step owns the full initial question list.",
    "Check only these finite defects:",
    "- qa[] is empty before any answer exists",
    "- A shown pending/approved question is empty, duplicated, not self-contained, or clearly asks for internal implementation details that project patterns should decide",
    "- A shown pending/approved question appears to include an answer, rationale, evidence, or instruction instead of only the question text",
    "Do not identify missing first-pass questions.",
    "Do not propose NEW QA entries.",
    "Do not add questions for category coverage or because a category label is absent.",
    "If no listed finite defect is present, output: NO_PROPOSALS",
    "",
    "Output a numbered list of issues in this format:",
    "### 1. <title>",
    "**QA:** q<N> (the qa.id)",
    "**Classification:** repair_target",
    "**Issue:** <which finite structural defect is present>",
    "**Suggestion:** <concrete correction to the existing QA entry>",
    "",
    "If no issues are found, output: NO_PROPOSALS",
    "",
    "## Request / Issue",
    "Use this only to understand whether a shown question is obviously off-topic. Do not derive missing questions from it.",
    requestText || "(no request text)",
    "",
    "## Draft QA Status Summary",
    formatDraftQaStatusSummary(draftJson),
    "",
    "## Pending / Approved Draft QA Entries",
    qaText,
  ].join("\n");
}

function loadDraftQaRulesPartial() {
  if (cachedDraftQaRulesPartial !== null) return cachedDraftQaRulesPartial;
  cachedDraftQaRulesPartial = resolveIncludes(fs.readFileSync(DRAFT_QA_RULES_PARTIAL_PATH, "utf8"), {
    baseDir: path.dirname(DRAFT_QA_RULES_PARTIAL_PATH),
    pkgDir: PKG_DIR,
    sourceFile: DRAFT_QA_RULES_PARTIAL_PATH,
  });
  return cachedDraftQaRulesPartial;
}

function buildDraftReviewPrompt(draftJson, requestText, contextEntries, stage) {
  const effectiveStage = stage || { key: "coverage" };
  if (effectiveStage.key === "questions") {
    return buildDraftQuestionReviewPrompt(draftJson, requestText);
  }

  const qaText = Array.isArray(draftJson?.qa)
    ? formatDraftReviewQaEntries(draftJson, effectiveStage)
    : "(no QA entries)";

  const contextText = contextEntries.map((e) =>
    `- **${e.file}**: ${e.summary || "(no summary)"}`
  ).join("\n");

  return [
    "You are a draft coverage gate reviewer. Perform a one-shot final check of answered and dropped draft QA before spec writing.",
    "",
    loadDraftQaRulesPartial(),
    "",
    "Review limits:",
    "- Report at most 3 highest-impact blocking gaps.",
    "- Treat existing answers as authoritative. Do not grade answer clarity, support, wording quality, or propose edits to existing QA.",
    "",
    "Output a numbered list of blocking gaps in this format:",
    "### 1. <title>",
    "**QA:** q<N> (related qa.id, or 'GLOBAL' if no single QA entry applies)",
    "**Classification:** blocking",
    "**Blocking decision:** <the user decision that is still required>",
    "**Why blocking:** <why the spec cannot be written without this decision>",
    "",
    "If no blocking user decision is required, output: NO_PROPOSALS",
    "",
    "## Request / Issue",
    requestText || "(no request text)",
    "",
    "## Draft QA Status Summary",
    formatDraftQaStatusSummary(draftJson),
    "",
    "## Draft QA Entries",
    qaText,
    "",
    "## Decision Map",
    formatDraftDecisionMap(draftJson),
    "",
    "## Codebase Context (related files)",
    "These files are ordered by relevance to the spec.",
    contextText,
  ].join("\n");
}

const DRAFT_REVIEW_CLASSIFICATIONS = Object.freeze(["blocking", "advisory", "repair_target"]);
const DRAFT_REVIEW_ARRAY_CAP = 20;
const DRAFT_REVIEW_FIELD_MAX_CHARS = 1000;
const DRAFT_REVIEW_TRUNCATION_SUFFIX = " [truncated]";

function normalizeDraftReviewText(value, fallback) {
  const text = typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
  return text.length > DRAFT_REVIEW_FIELD_MAX_CHARS
    ? `${text.slice(0, DRAFT_REVIEW_FIELD_MAX_CHARS - DRAFT_REVIEW_TRUNCATION_SUFFIX.length)}${DRAFT_REVIEW_TRUNCATION_SUFFIX}`
    : text;
}

class DraftReviewFinding {
  constructor({ title, target, rationale, evidence, classification }) {
    if (!DRAFT_REVIEW_CLASSIFICATIONS.includes(classification)) {
      throw new Error(`invalid draft review classification: ${classification}`);
    }
    this.title = normalizeDraftReviewText(title, "Untitled finding");
    this.target = normalizeDraftReviewText(target, "GLOBAL");
    this.rationale = normalizeDraftReviewText(rationale, "Recorded by draft review.");
    this.evidence = normalizeDraftReviewText(evidence, "Draft review output.");
    this.classification = classification;
  }

  toJSON() {
    return {
      title: this.title,
      target: this.target,
      rationale: this.rationale,
      evidence: this.evidence,
      classification: this.classification,
    };
  }
}

class DraftReviewArtifact {
  constructor({ phase, sourceDraft, blockingFindings = [], advisoryFindings = [], repairTargets = [] }) {
    this.version = 1;
    this.phase = phase;
    this.sourceDraft = sourceDraft;
    this.generatedAt = new Date().toISOString();
    this.blockingFindings = blockingFindings.slice(0, DRAFT_REVIEW_ARRAY_CAP);
    this.advisoryFindings = advisoryFindings.slice(0, DRAFT_REVIEW_ARRAY_CAP);
    this.repairTargets = repairTargets.slice(0, DRAFT_REVIEW_ARRAY_CAP);
    this.verdict = this.blockingFindings.length > 0
      ? "FAIL"
      : this.advisoryFindings.length > 0 || this.repairTargets.length > 0
        ? "ADVISORY"
        : "PASS";
    this.summary = this.verdict === "PASS"
      ? "No draft review findings recorded."
      : `${this.blockingFindings.length} blocking, ${this.advisoryFindings.length} advisory, ${this.repairTargets.length} repair target finding(s) recorded.`;
  }

  toJSON() {
    return {
      version: this.version,
      phase: this.phase,
      sourceDraft: this.sourceDraft,
      generatedAt: this.generatedAt,
      verdict: this.verdict,
      summary: this.summary,
      blockingFindings: this.blockingFindings.map((item) => item.toJSON()),
      advisoryFindings: this.advisoryFindings.map((item) => item.toJSON()),
      repairTargets: this.repairTargets.map((item) => item.toJSON()),
    };
  }
}

function buildDraftReviewStage(key, overrides) {
  const route = draftReviewRouteForKey(key);
  return {
    key,
    retryPhase: route.retryPhase,
    artifact: route.reviewArtifact,
    reviewPhase: route.reviewStepId,
    ...overrides,
  };
}

function resolveDraftReviewClassification(issue, fallbackClassification) {
  const rawClassification =
    extractMarkdownField(issue.body, "Classification")
    || extractMarkdownField(issue.body, "Severity")
    || extractMarkdownField(issue.body, "Verdict")
    || "";
  const normalized = rawClassification.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (normalized === "blocking" || normalized === "fail") return "blocking";
  if (normalized === "advisory" || normalized === "non_blocking" || normalized === "warning") return "advisory";
  if (normalized === "repair_target" || normalized === "repair") return "repair_target";
  return fallbackClassification;
}

function issueToDraftReviewFinding(issue, fallbackClassification) {
  const classification = resolveDraftReviewClassification(issue, fallbackClassification);
  const qa = extractMarkdownField(issue.body, "QA");
  const issueText = extractMarkdownField(issue.body, "Issue")
    || extractMarkdownField(issue.body, "Blocking decision")
    || issue.body
    || "Draft review finding.";
  const suggestion = extractMarkdownField(issue.body, "Suggestion")
    || extractMarkdownField(issue.body, "Why blocking")
    || issueText;
  return new DraftReviewFinding({
    title: issue.title,
    target: qa || issue.file || "GLOBAL",
    rationale: suggestion,
    evidence: issueText,
    classification,
  });
}

function addDraftReviewFindingToBucket(buckets, finding) {
  if (finding.classification === "blocking") {
    buckets.blockingFindings.push(finding);
  } else if (finding.classification === "advisory") {
    buckets.advisoryFindings.push(finding);
  } else {
    buckets.repairTargets.push(finding);
  }
}

function buildDraftReviewArtifact({ raw, draftPath, proposals, stage }) {
  if (raw.includes("NO_PROPOSALS") || proposals.length === 0) {
    return new DraftReviewArtifact({
      phase: stage.reviewPhase,
      sourceDraft: draftPath,
    });
  }
  const buckets = {
    blockingFindings: [],
    advisoryFindings: [],
    repairTargets: [],
  };
  for (const proposal of proposals) {
    const finding = issueToDraftReviewFinding(proposal, stage.findingClassification);
    addDraftReviewFindingToBucket(buckets, finding);
  }
  return new DraftReviewArtifact({
    phase: stage.reviewPhase,
    sourceDraft: draftPath,
    ...buckets,
  });
}

function writeJsonArtifact(filePath, artifact) {
  fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2) + "\n");
}

function reviewHistoryAttemptNumber(specDir, phase) {
  const historyDir = path.join(specDir, "review-history");
  if (!fs.existsSync(historyDir)) return 1;
  let max = 0;
  const prefix = `${phase}-attempt-`;
  for (const name of fs.readdirSync(historyDir)) {
    if (!name.startsWith(prefix)) continue;
    const match = /^(.+)-attempt-(\d{3})\./.exec(name);
    if (!match) continue;
    max = Math.max(max, Number(match[2]));
  }
  return max + 1;
}

function normalizedFindingId(phase, attempt, severity, index) {
  return `${phase}-${String(attempt).padStart(3, "0")}-${severity}-${String(index).padStart(3, "0")}`;
}

function normalizeFindingSeverity(value, fallback = "blocking") {
  const text = String(value || "").trim().toLowerCase();
  if (text === "blocking") return "blocking";
  if (text === "non-blocking" || text === "advisory" || text === "improvement") return "non-blocking";
  return fallback === "non-blocking" ? "non-blocking" : "blocking";
}

function findingsWithSeverity(findings, severity) {
  return (findings || []).map((finding) => ({ ...finding, severity }));
}

function findingText(item) {
  return String(item.body || item.issue || item.rationale || item.evidence || item.suggestion || item.title || "").trim();
}

function findingCategory(phase, item) {
  if (phase === "impl") return String(item.failureMode || "unknown").trim() || "unknown";
  if (phase.startsWith("draft-")) return String(item.classification || "unknown").trim() || "unknown";
  return String(item.category || item.failureMode || item.classification || "unknown").trim() || "unknown";
}

function normalizeReviewFindingRecords({ phase, sourceArtifact, attempt, artifact = {}, findings = [] }) {
  const records = [];
  const push = (item, severity) => {
    const normalizedSeverity = normalizeFindingSeverity(severity);
    const idx = records.length + 1;
    records.push({
      id: item.id || normalizedFindingId(phase, attempt, normalizedSeverity, idx),
      phase,
      sourceArtifact,
      attempt,
      severity: normalizedSeverity,
      title: String(item.title || "Untitled finding").trim(),
      body: findingText(item),
      category: findingCategory(phase, item),
    });
  };
  for (const item of findings) push(item, item.severity || "blocking");
  for (const item of artifact.blockingFindings || []) push(item, "blocking");
  for (const item of artifact.nonBlockingImprovements || []) push(item, "non-blocking");
  for (const item of artifact.advisoryFindings || []) push(item, "non-blocking");
  for (const item of artifact.repairTargets || []) push(item, "blocking");
  return records;
}

export function writeReviewAttemptHistory({ specDir, phase, latestBasename, artifact = null, content = null, attemptNumber = null, findings = [] }) {
  const attempt = attemptNumber || reviewHistoryAttemptNumber(specDir, phase);
  const ext = latestBasename.endsWith(".md") ? "md" : "json";
  const historyDir = path.join(specDir, "review-history");
  fs.mkdirSync(historyDir, { recursive: true });
  const latestPath = path.join(specDir, latestBasename);
  const historyPath = path.join(historyDir, `${phase}-attempt-${String(attempt).padStart(3, "0")}.${ext}`);
  const normalizedHistoryPath = path.join(historyDir, `${phase}-attempt-${String(attempt).padStart(3, "0")}.json`);
  if (ext === "json") {
    const payload = {
      ...(artifact || {}),
      version: artifact?.version || 1,
      phase,
      sourceArtifact: latestBasename,
      attempt,
      findings: normalizeReviewFindingRecords({ phase, sourceArtifact: latestBasename, attempt, artifact: artifact || {}, findings }),
    };
    writeJsonArtifact(latestPath, artifact || payload);
    writeJsonArtifact(historyPath, payload);
    return { latestPath, historyPath, historyJsonPath: historyPath, normalizedHistoryPath: historyPath };
  }
  const text = content == null ? "" : String(content);
  fs.writeFileSync(latestPath, text);
  fs.writeFileSync(historyPath, text);
  writeJsonArtifact(normalizedHistoryPath, {
    version: 1,
    phase,
    sourceArtifact: latestBasename,
    attempt,
    findings: normalizeReviewFindingRecords({ phase, sourceArtifact: latestBasename, attempt, findings }),
  });
  return { latestPath, historyPath, historyJsonPath: normalizedHistoryPath, normalizedHistoryPath };
}

async function runDraftReview(root, flow, config, dryRun) {
  const specDir = path.dirname(flow.spec);
  const specPath = path.resolve(root, specDir);
  const draftPath = path.resolve(specPath, "draft.json");
  const stage = resolveDraftReviewStage(flow);

  if (!fs.existsSync(draftPath)) {
    console.error("Error: draft.json not found");
    process.exit(EXIT_ERROR);
  }

  let draftJson;
  try {
    draftJson = JSON.parse(fs.readFileSync(draftPath, "utf8"));
  } catch (e) {
    console.error(`Error: failed to parse draft.json: ${e.message}`);
    process.exit(EXIT_ERROR);
  }

  const requestText = [
    flow.request || "",
    flow.issue ? `Issue #${flow.issue}` : "",
  ].filter(Boolean).join("\n");

  let analysisData = null;
  try {
    const { loadAnalysisEntries, contextSearch: ctxSearch } = await import("../lib/get-context.js");
    analysisData = { ...loadAnalysisEntries(root), ctxSearch };
  } catch (e) {
    console.error(`  [${stage.tag}] Warning: failed to load codebase context: ${e.message}`);
  }

  const agent = ensureAgent(stage.commandId);

  console.error(`  [${stage.tag}] Detecting issues...`);
  let contextEntries = [];
  if (analysisData) {
    const searchQuery = draftJson.goal || requestText;
    if (searchQuery) {
      contextEntries = await analysisData.ctxSearch(analysisData.entries, analysisData.analysis, searchQuery, root);
    }
  }
  const detectPrompt = buildDraftReviewPrompt(draftJson, requestText, contextEntries, stage);
  const fallbackSystemPrompt = stage.key === "questions"
    ? "You are a draft question sanity reviewer. Check only finite structural defects; do not generate new questions."
    : "You are a draft coverage gate reviewer. Report at most 3 blocking user decisions; do not generate follow-up loops.";
  const raw = await callReviewAgent(
    agent, detectPrompt, stage.commandId, fallbackSystemPrompt,
  );

  const proposals = raw.includes("NO_PROPOSALS")
    ? []
    : parseProposals(raw, { limit: DRAFT_REVIEW_ARRAY_CAP });

  const reviewPath = path.join(specPath, stage.artifact);
  const reviewArtifact = buildDraftReviewArtifact({
    raw,
    draftPath: path.relative(specPath, draftPath),
    proposals,
    stage,
  });
  writeReviewAttemptHistory({
    specDir: specPath,
    phase: stage.retryPhase,
    latestBasename: stage.artifact,
    artifact: reviewArtifact.toJSON(),
  });

  console.error(`  [${stage.tag}] Results saved to ${path.relative(root, reviewPath)}`);
  console.error(`  [${stage.tag}] verdict=${reviewArtifact.verdict} ${stage.countLabel}=${proposals.length} retryPhase=${stage.retryPhase}`);

  if (reviewArtifact.verdict === "PASS") {
    console.log("Draft review PASS. QA entries are adequate.");
  } else {
    console.log(`Draft review ${reviewArtifact.verdict}. ${proposals.length} finding(s) recorded for triage.`);
  }
}

async function runReview(rawArgs) {
  const root = container.get("root");
  const cli = parseArgs(rawArgs, {
    flags: ["--dry-run", "--skip-confirm"],
    options: ["--phase", "--task-spec"],
    defaults: { dryRun: false, skipConfirm: false, phase: null, taskSpec: null },
  });

  if (cli.help) {
    const phaseDesc = Object.entries(REVIEW_PHASES).map(([k, v]) => `'${k}' for ${v}`).join(", ");
    console.log([
      "Usage: senti flow review [options]",
      "",
      "Options:",
      `  --phase <type>   Review phase: ${phaseDesc}`,
      "  --task-spec <path>  Use rendered task spec markdown as impl review input",
      "  --dry-run        Show proposals without applying",
      "  --skip-confirm   Skip initial confirmation prompt",
    ].join("\n"));
    return;
  }

  if (cli.phase && !REVIEW_PHASES[cli.phase]) {
    const supported = Object.keys(REVIEW_PHASES).join(", ");
    console.error(`Error: unknown phase '${cli.phase}'. Supported: ${supported}`);
    process.exit(EXIT_ERROR);
  }

  const flow = container.get("flowManager").load();
  if (!flow) {
    console.error("Error: no active flow (flow.json not found)");
    process.exit(EXIT_ERROR);
  }

  const config = container.get("config");
  if (!config || Object.keys(config).length === 0) {
    console.error("Error: failed to load config.json");
    process.exit(EXIT_ERROR);
  }

  // Draft review pipeline
  if (cli.phase === "draft") {
    await runDraftReview(root, flow, config, cli.dryRun);
    return;
  }

  // Test review pipeline
  if (cli.phase === "test") {
    await runTestReview(root, flow, config, cli.dryRun);
    return;
  }

  // Spec review pipeline
  if (cli.phase === "spec") {
    await runSpecReview(root, flow, config, cli.dryRun);
    return;
  }

  // Resolve merge-base once and use it as the single diff starting point.
  const mergeBase = resolveMergeBase(root, flow.baseBranch);

  // Resolve target diff
  const diff = resolveReviewTarget(root, flow, mergeBase);
  if (!diff) {
    const result = await runImplReview({
      root,
      flow,
      reviewOutput: JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] }),
      touchedFiles: new Set(),
    });
    console.error(`  [review] Results saved to ${result.changed[0]}`);
    console.error(`  [review] JSON saved to ${result.changed[1]}`);
    console.error("  [review] verdict=PASS blocking=0 nonBlocking=0");
    console.log("Impl review PASS. No changes detected.");
    return;
  }

  const reviewExcludeMatcher = createReviewExcludeMatcher({ root, exclusions: resolveReviewExcludePaths(config) });
  const touchedFiles = collectTouchedFiles(root, mergeBase, { excludeMatcher: reviewExcludeMatcher });
  const reviewGuardrails = filterByPhase(loadMergedGuardrails(root), "review");
  const taskSpec = resolveTaskReviewSpec(root, cli.taskSpec);

  let fileMap = {};
  if (taskSpec) {
    console.error(`  [task-review] Reviewing ${taskSpec.relPath}...`);
  } else {
    fileMap = await loadReqMap(root, flow, "file");
    if (!fileMap || Object.keys(fileMap).length === 0) {
      const spec = loadSpecJson(path.resolve(root, flow.spec), { validate: false });
      const files = Array.from(touchedFiles).sort();
      fileMap = Object.fromEntries(
        (Array.isArray(spec.requirements) ? spec.requirements : [])
          .map((req) => req.id)
          .filter(Boolean)
          .map((id) => [id, files]),
      );
    }
  }
  const previousReview = loadPreviousImplReviewMemory(root, flow.spec);
  const result = await runReviewWithDependencies({
    touchedFiles,
    shouldUseLoopReview: (fileCount) => !taskSpec && shouldUseLoopReview(fileCount),
    runLoopReview: async () => {
      const proposals = await runLoopReview(root, flow, mergeBase, fileMap, touchedFiles, reviewGuardrails, config);
      return proposals?.verdict === "TOOLING_FAILURE" ? proposals : loopProposalsToImplReviewJson(proposals);
    },
    runSingleReview: async () => {
      const reviewPrompt = buildImplReviewPrompt({
        requirementFileMap: fileMap,
        diff,
        touchedFiles,
        previousReview,
        taskSpec: taskSpec ? {
          relPath: taskSpec.relPath,
          content: taskSpec.content,
        } : null,
      });
      const reviewAgent = ensureAgent("flow.impl.review.propose");
      return callReviewAgent(
        reviewAgent,
        reviewPrompt,
        "flow.impl.review.propose",
        buildDraftSystemPrompt(
          reviewGuardrails,
          buildReviewAcknowledgedRationale(root, flow, reviewGuardrails),
        ),
      );
    },
    persistImplReview: (reviewOutput) => runImplReview({ root, flow, reviewOutput, touchedFiles, taskSpec }),
  });
  console.error(`  [review] Results saved to ${result.changed[0]}`);
  console.error(`  [review] JSON saved to ${result.changed[1]}`);
  console.error([
    `  [review] verdict=${result.artifacts.verdict}`,
    `blocking=${result.artifacts.blockingCount}`,
    `nonBlocking=${result.artifacts.nonBlockingCount}`,
    ...(result.artifacts.taskId ? [`taskId=${result.artifacts.taskId}`, `target=${result.artifacts.target}`] : []),
  ].join(" "));
  if (result.artifacts.verdict === "PASS") {
    console.log("Impl review PASS. No blocking findings or non-blocking improvements recorded. See review.md.");
  } else if (result.artifacts.verdict === "ADVISORY") {
    console.log(`Impl review ADVISORY. ${result.artifacts.nonBlockingCount} non-blocking improvement(s) recorded. See review.md.`);
  } else {
    console.log(`Impl review FAIL. ${result.artifacts.blockingCount} blocking finding(s) recorded. See review.md.`);
  }
}

/**
 * Strip AI preamble text that appears before the actual spec content.
 * Also removes markdown fences wrapping the spec.
 * @param {string} text
 * @returns {string}
 */
function stripPreamble(text) {
  if (!text) return text;

  // Strip markdown fences first
  let cleaned = text.replace(/^```(?:markdown)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  // Find the first spec header
  const headerMatch = cleaned.match(/^(#\s+Feature Specification|##\s+Goal)/m);
  if (!headerMatch) return cleaned;

  // Remove everything before the header
  const headerIdx = cleaned.indexOf(headerMatch[0]);
  if (headerIdx > 0) {
    cleaned = cleaned.slice(headerIdx);
  }

  return cleaned;
}

/**
 * Validate that AI output looks like spec content, not garbage text.
 * @param {string} text
 * @returns {boolean}
 */
function isValidSpecOutput(text) {
  if (!text || !text.trim()) return false;
  return /^#\s+Feature Specification/m.test(text) || /^##\s+Goal/m.test(text);
}

export {
  parseProposals, formatReviewMd, resolveReviewTarget,
  resolveMergeBase,
  buildDraftSystemPrompt,
  NO_PROPOSALS_MARKER,
  collectTouchedFiles, filterProposalsByScope, extractProposalFile,
  createReviewExcludeMatcher, resolveReviewExcludePaths, prepareLoopReviewInputsWithExclusions,
  getReviewMaxAttempts, REVIEW_PHASES, extractRequirements, collectTestFiles, parseGaps,
  applyTestFixes, formatTestReviewMd, runReviewLoop,
  buildTestReviewPrompt, parseTestReviewFindings,
  TEST_REVIEW_PROMPT_CHAR_LIMIT, assertTestReviewPromptWithinLimit, runTestReviewWithDependencies,
  extractGoalAndScope, buildSpecSummaryMarkdown, buildSpecReviewPrompt, buildSpecReviewRepairPrompt,
  formatSpecReviewMd, formatSpecReviewJson, parseSpecReviewFindings, parseSpecReviewFindingsWithRepair,
  buildImplReviewPrompt, parseImplReviewFindings, filterImplReviewFindingsByScope,
  formatImplReviewMd, formatImplReviewJson, loadPreviousImplReviewMemory,
  runImplReview,
  isValidSpecOutput, stripPreamble, buildGapAnalysisPrompt, buildTestFixPrompt,
  buildDraftReviewPrompt,
  buildDraftReviewArtifact,
  shouldUseLoopReview, groupByDiffContent, buildPerFileReviewInput,
  buildCrossCheckInput, expandProposalsToGroup,
  createLoopReviewChunks, runLoopReviewWithDependencies,
  runActiveImplReviewWithDependencies, runReviewWithDependencies,
  runSingleShotImplReviewWithDependencies, runNonImplReviewWithDependencies,
  loopProposalsToImplReviewJson,
  LOOP_REVIEW_THRESHOLD, MAX_LOOP_CALLS,
};

export default class FlowReviewCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runReview(ctx._rawArgs || []);
  }
}

// Direct-invocation entrypoint: `node src/flow/commands/review.js ...args`.
// Used by RunReviewCommand (src/flow/lib/run-review.js) as a subprocess so
// AI review can run with its own timeout.
if (import.meta.url === `file://${process.argv[1]}`) {
  initContainer();
  runReview(process.argv.slice(2)).catch((err) => {
    const cli = parseReviewCliArgsForError(process.argv.slice(2));
    const failure = classifyReviewCommandError(err, cli.phase);
    if (failure) console.error(failure.toMarkerLine());
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}
