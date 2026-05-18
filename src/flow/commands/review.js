#!/usr/bin/env node
/**
 * src/flow/commands/review.js
 *
 * sdd-forge flow review — code quality review after implementation.
 * Phases: confirm → draft (propose) → approve → apply
 *
 * --phase test: test sufficiency review before impl.
 * Internal pipeline: generate test design → compare with test code → auto-fix loop.
 */

import fs from "fs";
import path from "path";
import { parseArgs } from "../../lib/cli.js";
import { getSpecName } from "../../lib/flow-helpers.js";
import { loadSpecJson, resolveSpecDir } from "../../lib/spec-json.js";
import { repairJson } from "../../lib/json-parse.js";

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
import { resolveNodeFor, FLOW_DEFINITION, flattenSteps } from "../definition.js";

const REVIEW_PHASE_NODE_MAP = {
  "draft-questions": "review-draft-questions",
  "draft-coverage": "review-draft-coverage",
  spec: "review-spec",
  test: "review-test",
};

function getReviewMaxAttempts(phase, attemptContext) {
  const nodeId = REVIEW_PHASE_NODE_MAP[phase];
  if (!nodeId) throw new Error(`unsupported review maxAttempts phase: ${phase}`);
  if (!attemptContext || typeof attemptContext !== "object") {
    throw new Error(`review maxAttempts resolution requires explicit context for phase: ${phase}`);
  }
  return resolveNodeFor(FLOW_DEFINITION, nodeId).resolveMaxAttempts(attemptContext);
}

function resolveDraftReviewStage(flow) {
  const steps = Array.isArray(flow?.steps) ? flattenSteps(flow.steps) : [];
  const byId = new Map(steps.map((step) => [step.id, step]));
  if (byId.get("review-draft-coverage")?.status === "in_progress") {
    return {
      key: "coverage",
      retryPhase: "draft-coverage",
      commandId: "flow.draft.review.coverage.propose",
      artifact: "draft-review-coverage.md",
      repairArtifact: "draft-review-coverage-repair.json",
      repairPhase: "draft-review-coverage-repair",
      countLabel: "findings",
      tag: "draft-review-coverage",
    };
  }
  return {
    key: "questions",
    retryPhase: "draft-questions",
    commandId: "flow.draft.review.questions.propose",
    artifact: "draft-review-questions.md",
    repairArtifact: "draft-review-questions-repair.json",
    repairPhase: "draft-review-questions-repair",
    countLabel: "questions",
    tag: "draft-review-questions",
  };
}

const LOOP_REVIEW_THRESHOLD = 10;
const MAX_LOOP_CALLS = 50;

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
 *  These are auto-generated by sdd-forge pipelines and overwritten on build. */
const REVIEW_EXCLUDE_PATHS = ["docs/", "README.md", "AGENTS.md", ".sdd-forge/output/"];

/**
 * Build pathspec args for git diff.
 * When filePath is given, scopes to that single file.
 * Otherwise, includes all files except REVIEW_EXCLUDE_PATHS.
 * @param {string} [filePath]
 * @returns {string[]}
 */
function buildReviewPathspec(filePath) {
  if (filePath) return ["--", filePath];
  return ["--", ".", ...REVIEW_EXCLUDE_PATHS.map((p) => `:!${p}`)];
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
function collectCommittedAndStagedDiff(root, baseRef, filePath) {
  const pathspec = buildReviewPathspec(filePath);
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
 * @returns {{ title: string, body: string, file: string|null }[]}
 */
function parseProposals(text) {
  const proposals = [];
  const parts = text.split(/^### /m).filter(Boolean);
  for (const part of parts) {
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
function collectTouchedFiles(root, baseRef) {
  const touched = new Set();
  forEachReviewDiffSource(baseRef, ({ args, label }) => {
    const res = runGit(["-C", root, "diff", "--name-only", ...args]);
    if (!res.ok) throw new Error(`git diff --name-only (${label}) failed: ${res.stderr}`);
    for (const line of res.stdout.split("\n")) {
      const p = line.trim();
      if (p) touched.add(p);
    }
  });
  return touched;
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

function chunkLabel(chunk) {
  const primary = chunk[0];
  return chunk.length > 1
    ? `${primary.representative} +${chunk.length - 1} more`
    : `${primary.representative} (${primary.files.length} file(s))`;
}

async function runLoopReview(root, flow, mergeBase, fileMap, touchedFiles, guardrails) {
  const specInput = path.resolve(root, flow.spec);
  const spec = loadSpecJson(specInput);
  const fileToReqs = invertFileMap(fileMap, spec.requirements || []);

  const scopedFiles = new Set(
    [...touchedFiles].filter((f) => !REVIEW_EXCLUDE_PATHS.some((ex) => f.startsWith(ex))),
  );
  const rawPerFileDiffs = collectPerFileDiffs(root, mergeBase, scopedFiles);

  const strippedDiffs = new Map();
  for (const [file, diff] of rawPerFileDiffs) {
    strippedDiffs.set(file, stripDiffFileHeaders(diff));
  }
  const groups = groupByDiffContent(strippedDiffs, fileToReqs);

  const draftAgent = ensureAgent("flow.impl.review.propose");
  const systemPrompt = buildDraftSystemPrompt(
    guardrails,
    buildReviewAcknowledgedRationale(root, flow, guardrails),
  );

  // Batch groups into chunks when exceeding MAX_LOOP_CALLS
  let reviewChunks;
  if (groups.length <= MAX_LOOP_CALLS) {
    reviewChunks = groups.map((g) => [g]);
  } else {
    const chunkSize = Math.ceil(groups.length / MAX_LOOP_CALLS);
    reviewChunks = [];
    for (let i = 0; i < groups.length; i += chunkSize) {
      reviewChunks.push(groups.slice(i, i + chunkSize));
    }
    console.error(`  [loop-review] ${groups.length} groups batched into ${reviewChunks.length} chunk(s) (limit ${MAX_LOOP_CALLS}).`);
  }

  console.error(`  [loop-review] ${touchedFiles.size} files → ${groups.length} group(s) after compaction → ${reviewChunks.length} AI call(s).`);

  const allProposals = [];
  const summaries = [];

  for (let i = 0; i < reviewChunks.length; i++) {
    const chunk = reviewChunks[i];
    console.error(`  [loop-review] Call ${i + 1}/${reviewChunks.length}: ${chunkLabel(chunk)}...`);

    const input = buildChunkReviewInput(chunk, rawPerFileDiffs, fileToReqs);
    const result = await callReviewAgent(draftAgent, input, "flow.impl.review.propose", systemPrompt);

    if (!result.includes("NO_PROPOSALS")) {
      const proposals = parseProposals(result);
      if (proposals.length > 0) {
        for (const g of chunk) {
          const gProposals = proposals.filter((p) => p.file && g.files.includes(p.file));
          const toExpand = gProposals.length > 0 ? gProposals : proposals;
          const expanded = g.files.length > 1
            ? expandProposalsToGroup(toExpand, g.files)
            : toExpand;
          allProposals.push(...expanded);
        }
        summaries.push({ file: chunk[0].representative, proposals: result });
      }
    }
  }

  if (summaries.length > 0) {
    console.error("  [loop-review] Running cross-check pass...");
    const crossCheckInput = buildCrossCheckInput(summaries);
    const crossCheckResult = await callReviewAgent(
      draftAgent, crossCheckInput, "flow.impl.review.propose", buildCrossCheckSystemPrompt(),
    );
    if (!crossCheckResult.includes("NO_PROPOSALS")) {
      allProposals.push(...parseProposals(crossCheckResult));
    }
  }

  console.error(`  [loop-review] ${allProposals.length} total proposal(s).`);
  return allProposals;
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
 * Project-level tests/ are regression inputs for test-execute/gate-impl, not
 * semantic review-test prompt input.
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
    + `limit is ${TEST_REVIEW_PROMPT_CHAR_LIMIT}. Narrow review-test inputs before calling the agent.`,
  );
}

function classifyReviewCommandError(err, phase) {
  const message = String(err?.stack || err?.message || err || "");
  const recoveryCommand = phase ? `sdd-forge flow run review --phase ${phase}` : "sdd-forge flow run review";
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
function formatTestReviewMd(testDesign, gapHistory, finalVerdict, remainingGaps) {
  const lines = ["# Test Review Results", ""];
  lines.push("## Test Design");
  lines.push("See [tests/spec.md](tests/spec.md) for the full test design.");
  lines.push("");
  lines.push("## Gap Analysis");
  for (let i = 0; i < gapHistory.length; i++) {
    if (gapHistory.length > 1) lines.push(`### Iteration ${i + 1}`);
    lines.push(gapHistory[i]);
    lines.push("");
  }
  lines.push(`## Verdict: ${finalVerdict}`);
  if (finalVerdict === "FAIL" && remainingGaps.length > 0) {
    lines.push("");
    lines.push("### Remaining Gaps");
    for (const g of remainingGaps) {
      const formatted = formatRemainingGap(g);
      lines.push(`- ${formatted.title}`);
      lines.push(`  ${formatted.body}`);
    }
  }
  return lines.join("\n");
}

function formatRemainingGap(gap) {
  if (gap?.title || gap?.body) {
    return {
      title: gap.title || "Untitled gap",
      body: gap.body || "",
    };
  }
  if (gap?.type === "missing-header") {
    return {
      title: `missing-header ${gap.reqId}`,
      body: `${gap.desc || ""}${gap.suggestion ? ` ${gap.suggestion}` : ""}`.trim(),
    };
  }
  if (gap?.type === "header-lie") {
    return {
      title: `header-lie ${gap.reqId}${gap.file ? ` (${gap.file})` : ""}`,
      body: gap.detail || "",
    };
  }
  return {
    title: String(gap?.type || "gap"),
    body: String(gap?.detail || gap?.desc || ""),
  };
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

  // spec 251: header coverage and header lie detection are deterministic FAIL
  // conditions for test-review. The result of validateTestHeaders is converted
  // into structured gaps that participate in the verdict alongside AI gaps.
  let deterministicHeaderGaps = [];
  try {
    const { validateTestHeaders } = await import("../lib/test-headers.js");
    const headerResult = validateTestHeaders({
      specDir: path.resolve(root, specDir),
      spec,
    });
    const reqDescById = new Map(
      (Array.isArray(spec?.requirements) ? spec.requirements : []).map((r) => [r.id, r.desc]),
    );
    for (const id of headerResult.uncoveredRequirements || []) {
      deterministicHeaderGaps.push({
        type: "missing-header",
        reqId: id,
        desc: reqDescById.get(id) || "",
        suggestion: `Add '// spec: ${id}' header (and an 'R-N: ...' test) to a file under specs/<spec>/tests/`,
      });
    }
    for (const entry of headerResult.headerNoTest || []) {
      deterministicHeaderGaps.push({
        type: "header-lie",
        reqId: entry.id,
        file: entry.file,
        detail: `Header declares ${entry.id} but the file has no matching '${entry.id}: ...' test name`,
      });
    }
    for (const entry of headerResult.testNoHeader || []) {
      deterministicHeaderGaps.push({
        type: "header-lie",
        reqId: entry.id,
        file: entry.file,
        detail: `Test name references ${entry.id} but the file header does not declare it`,
      });
    }
    if (deterministicHeaderGaps.length > 0) {
      console.error(`  [test-review] header validation: ${deterministicHeaderGaps.length} deterministic gap(s):`);
      for (const g of deterministicHeaderGaps) {
        console.error(`    - ${g.type} ${g.reqId}${g.file ? ` (${g.file})` : ""}`);
      }
    }
  } catch (err) {
    process.stderr.write(`  [test-review] header validation skipped: ${err.message}\n`);
  }

  const agent = ensureAgent("flow.test.review");

  // Step 1: Generate test design
  console.error("  [test-review] Generating test design...");
  const testDesignPrompt = buildTestDesignPrompt(requirements);
  const testDesign = await callReviewAgent(
    agent, testDesignPrompt, "flow.test.review",
    "You are a test design expert. Output a structured test design.",
  );
  // Save test design as tests/spec.md
  const testsDir = path.resolve(root, specDir, "tests");
  if (!fs.existsSync(testsDir)) fs.mkdirSync(testsDir, { recursive: true });
  const testSpecPath = path.join(testsDir, "spec.md");
  fs.writeFileSync(testSpecPath, `# Test Design\n\n${testDesign}\n`);
  console.error(`  [test-review] Test design saved to ${path.relative(root, testSpecPath)}`);

  // Step 2-3: Compare and retry loop (using common runReviewLoop)
  let testFiles = collectTestFiles(root, specDir);

  const maxAttempts = getReviewMaxAttempts("test", flow);
  const { history: gapHistory, finalIssues: finalGaps, verdict } = await runReviewLoop({
    maxRetries: maxAttempts,
    label: "test-review",
    dryRun,
    async detect() {
      const detectPrompt = buildGapAnalysisPrompt(testDesign, testFiles);
      assertTestReviewPromptWithinLimit(detectPrompt, "gap analysis");
      const raw = await callReviewAgent(
        agent, detectPrompt, "flow.test.review",
        "You are a test quality reviewer. Identify gaps between test design and test code.",
      );
      return { issues: parseGaps(raw), raw };
    },
    async fix(raw) {
      const fixPrompt = buildTestFixPrompt(testDesign, raw, testFiles);
      assertTestReviewPromptWithinLimit(fixPrompt, "test fix");
      const fixResult = await callReviewAgent(
        agent, fixPrompt, "flow.test.review",
        "You are a test engineer. Fix test gaps by writing complete updated test files.",
      );
      const written = applyTestFixes(fixResult, root, specDir);
      if (written.length > 0) {
        console.error(`  [test-review] Fixed ${written.length} file(s): ${written.join(", ")}`);
      } else {
        console.error("  [test-review] No files were updated by fix attempt.");
      }
      testFiles = collectTestFiles(root, specDir);
    },
  });
  // spec 251: merge deterministic header gaps into the final verdict. AI gap
  // analysis covers semantic alignment; validateTestHeaders covers
  // missing-header / header-lie deterministically. Either category FAILs.
  const mergedGaps = [...finalGaps, ...deterministicHeaderGaps];
  const finalVerdict = mergedGaps.length === 0 ? "PASS" : "FAIL";
  const testReviewPath = path.join(path.resolve(root, specDir), "test-review.md");
  fs.writeFileSync(testReviewPath, formatTestReviewMd(testDesign, gapHistory, finalVerdict, mergedGaps));
  console.error(`  [test-review] Results saved to ${path.relative(root, testReviewPath)}`);

  if (finalVerdict === "PASS") {
    console.error(`  [test-review] verdict=PASS gaps=0`);
    console.log("Test review PASS. All test cases are adequately covered.");
  } else {
    console.error(`  [test-review] verdict=FAIL gaps=${mergedGaps.length} (ai=${finalGaps.length} header=${deterministicHeaderGaps.length})`);
    console.log(`Test review FAIL. ${mergedGaps.length} gap(s) remaining after ${maxAttempts} attempts.`);
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

function parseSpecReviewJsonOutput(raw) {
  const candidate = extractJsonObjectCandidate(raw);
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    parsed = JSON.parse(repairJson(candidate));
  }
  const errors = validateSchema(parsed, SPEC_REVIEW_RESPONSE_SCHEMA);
  if (errors.length > 0) {
    throw new Error(`spec review output failed schema validation: ${errors.join("; ")}`);
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

  const findings = parseSpecReviewFindings(proposeRaw);
  const blockingCount = findings.blocking.length;
  const improvementCount = findings.improvements.length;
  const proposalCount = blockingCount + improvementCount;
  const verdict = blockingCount > 0 ? "FAIL" : improvementCount > 0 ? "ADVISORY" : "PASS";

  fs.writeFileSync(reviewPath, formatSpecReviewMd({ ...findings, verdict }));
  fs.writeFileSync(reviewJsonPath, formatSpecReviewJson({ ...findings, verdict }));
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

function formatDraftCoverageReviewEntry(q, i) {
  return [
    `### ${q.id || `Q${i + 1}`} [${q.status || "unknown"} / ${q.category || "unknown"}]`,
    `**Question:** ${q.question}`,
    `**Answer:** ${q.answer || "(empty)"}`,
    `**Evidence:** ${q.evidence || "(none)"}`,
    `**Why:** ${q.why || "(none)"}`,
    `**Dropped reason:** ${q.droppedReason || "(none)"}`,
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
    "Focus on:",
    "- Only blocking user decisions without which the spec cannot be written",
    "- Report at most 3 highest-impact blocking gaps",
    "- Treat existing answers as authoritative. Do not grade answer clarity, support, wording quality, or propose edits to existing QA.",
    "- Detection must not propose iterative follow-up questions, append QA entries, or mutate draft.json; the separate one-pass repair handles repairable findings",
    "- Do not report issues that can be resolved during spec writing by existing project rules, code patterns, or conservative implementation choices",
    "",
    "Output a numbered list of blocking gaps in this format:",
    "### 1. <title>",
    "**QA:** q<N> (related qa.id, or 'GLOBAL' if no single QA entry applies)",
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

function formatDraftReviewMd(issues, stage, verdict) {
  const title = stage.key === "questions" ? "Draft Question Review Results" : "Draft Coverage Review Results";
  const lines = [`# ${title}`, ""];
  if (issues.length === 0) {
    lines.push("No issues found. PASS.");
  } else {
    lines.push(`${issues.length} advisory finding(s) recorded. ${verdict}.`, "");
    for (let i = 0; i < issues.length; i++) {
      lines.push(`### ${i + 1}. ${issues[i].title}`);
      if (issues[i].body) lines.push(issues[i].body);
      lines.push("");
    }
    lines.push("These findings are advisory for spec writing. The draft review step may proceed; gate-draft remains the blocking validation step.");
  }
  return lines.join("\n");
}

function formatDraftIssuesForRepair(issues) {
  if (!issues.length) return "NO_PROPOSALS";
  return issues.map((issue, index) => [
    `### ${index + 1}. ${issue.title}`,
    issue.body || "",
  ].filter(Boolean).join("\n")).join("\n\n");
}

const DRAFT_REPAIR_TOP_LEVEL_FIELDS = Object.freeze([
  "devType",
  "goal",
  "analysis",
  "decisionMap",
  "scopeVerification",
  "impactOnExisting",
  "qa",
  "openQuestions",
  "approval",
]);

const DRAFT_REPAIR_DECISIONS = Object.freeze([
  "applied",
  "invalid",
  "already_resolved",
  "deferred_to_spec",
  "requires_user_decision",
  "downgraded_to_non_blocking",
]);

const DRAFT_REPAIR_DRAFT_SCHEMA = Object.freeze({
  type: "object",
  required: DRAFT_REPAIR_TOP_LEVEL_FIELDS,
  additionalProperties: false,
  properties: Object.fromEntries(DRAFT_REPAIR_TOP_LEVEL_FIELDS.map((field) => [field, {}])),
});

const DRAFT_REPAIR_AUDIT_ITEM_SCHEMA = Object.freeze({
  type: "object",
  required: ["findingTitle", "target", "decision", "rationale", "evidence", "changedFields"],
  additionalProperties: false,
  properties: {
    findingTitle: { type: "string", minLength: 1 },
    target: { type: "string", minLength: 1 },
    decision: { type: "string", enum: DRAFT_REPAIR_DECISIONS },
    rationale: { type: "string", minLength: 1 },
    evidence: { type: "string", minLength: 1 },
    changedFields: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
});

const DRAFT_REPAIR_AUDIT_SCHEMA = Object.freeze({
  type: "object",
  required: ["version", "phase", "sourceReview", "generatedAt", "summary", "items"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", enum: [1] },
    phase: {
      type: "string",
      enum: ["draft-review-questions-repair", "draft-review-coverage-repair"],
    },
    sourceReview: {
      type: "string",
      enum: ["draft-review-questions.md", "draft-review-coverage.md"],
    },
    generatedAt: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    items: {
      type: "array",
      items: DRAFT_REPAIR_AUDIT_ITEM_SCHEMA,
    },
  },
});

const DRAFT_REPAIR_RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  required: ["draft", "audit"],
  additionalProperties: false,
  properties: {
    draft: DRAFT_REPAIR_DRAFT_SCHEMA,
    audit: DRAFT_REPAIR_AUDIT_SCHEMA,
  },
});

const DRAFT_REPAIR_FMT_FALLBACK = [
  "OUTPUT FORMAT - strictly required:",
  "Return only a JSON object. No markdown, no preamble, no commentary.",
  "Schema:",
  JSON.stringify(DRAFT_REPAIR_RESPONSE_SCHEMA, null, 2),
].join("\n");

class DraftRepairAuditItem {
  constructor(item) {
    this.findingTitle = item.findingTitle;
    this.target = item.target;
    this.decision = item.decision;
    this.rationale = item.rationale;
    this.evidence = item.evidence;
    this.changedFields = item.changedFields;
  }

  requiresUserDecision() {
    return this.decision === "requires_user_decision";
  }

  toJSON() {
    return {
      findingTitle: this.findingTitle,
      target: this.target,
      decision: this.decision,
      rationale: this.rationale,
      evidence: this.evidence,
      changedFields: this.changedFields,
    };
  }
}

class DraftRepairAuditArtifact {
  constructor(audit) {
    this.version = audit.version;
    this.phase = audit.phase;
    this.sourceReview = audit.sourceReview;
    this.generatedAt = audit.generatedAt;
    this.summary = audit.summary;
    this.items = audit.items.map((item) => new DraftRepairAuditItem(item));
  }

  requiresUserDecision() {
    return this.items.some((item) => item.requiresUserDecision());
  }

  toJSON() {
    return {
      version: this.version,
      phase: this.phase,
      sourceReview: this.sourceReview,
      generatedAt: this.generatedAt,
      summary: this.summary,
      items: this.items.map((item) => item.toJSON()),
    };
  }
}

function parseDraftRepairOutput(raw) {
  const candidate = extractJsonObjectCandidate(raw);
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    parsed = JSON.parse(repairJson(candidate));
  }
  const schemaIssues = validateSchema(parsed, DRAFT_REPAIR_RESPONSE_SCHEMA);
  if (schemaIssues.length > 0) {
    throw new Error(`draft repair output failed schema validation: ${schemaIssues.join("; ")}`);
  }
  return {
    draft: parsed.draft,
    audit: new DraftRepairAuditArtifact(parsed.audit),
  };
}

function buildDraftRepairPrompt(draftJson, issues, stage, requestText, contextEntries) {
  const contextText = contextEntries.map((e) =>
    `- **${e.file}**: ${e.summary || "(no summary)"}`
  ).join("\n");

  const stageRules = stage.key === "questions"
    ? [
      "Repair only the finite structural defects found in the initial question list.",
      "Do not answer draft questions.",
      "Do not add category-quota questions.",
      "If qa[] is empty, create the initial pending question list from decisionMap.requiresUserJudgment and the request, not from generic category coverage.",
      "For pending/approved QA entries, answer, evidence, why, and droppedReason must remain empty strings.",
      "Keep approval.approved false in this stage.",
    ]
    : [
      "Repair the draft so the recorded coverage findings are reflected in draft.json before gate-draft.",
      "Do not ask the user and do not append iterative follow-up questions.",
      "Resolve gaps using existing answers, decisionMap, project rules, source context, and conservative implementation choices.",
      "If a finding can be handled during spec writing, record that decision in decisionMap.deferredToSpec or decisionMap.resolvedByProjectRules.",
      "Do not resolve pending/approved QA entries in this coverage repair; draft-refine owns question resolution.",
      "Set approval.approved true with confirmedAt and notes after repair unless an audit item uses requires_user_decision.",
      "If a finding truly requires a new user decision, do not invent the answer; record requires_user_decision in audit, keep approval.approved false, and preserve the unresolved decision in draft.json.",
    ];

  return new PromptBuilder()
    .setRole("You are a draft.json repair agent. Apply recorded draft review findings in one pass and audit every decision.")
    .setRules([
      "Return JSON only with exactly two top-level keys: draft and audit.",
      "draft must be the complete repaired draft.json object.",
      "audit must record one item for every review finding, in the same order.",
      "audit.phase, audit.sourceReview, and audit.generatedAt must use the values from Audit Metadata.",
      "Each audit item must explain whether the finding was applied, invalid, already resolved, deferred to spec, requires a user decision, or downgraded to non-blocking.",
      "For decision=applied, changedFields must list the draft.json field paths changed for that finding.",
      "For decisions other than applied, changedFields may be empty but rationale and evidence must explain why no draft mutation is needed.",
      "Preserve existing user answers and evidence unless a review finding explicitly requires correction.",
      "Do not remove required top-level fields. Do not add unknown top-level fields.",
      ...stageRules,
    ].join("\n"))
    .setJsonSchema(DRAFT_REPAIR_RESPONSE_SCHEMA)
    .setFmtFallback(DRAFT_REPAIR_FMT_FALLBACK)
    .addUserPrompt("## Request / Issue", requestText || "(no request text)")
    .addUserPrompt("## Review Findings To Repair", formatDraftIssuesForRepair(issues))
    .addUserPrompt("## Current draft.json", JSON.stringify(draftJson, null, 2))
    .addUserPrompt("## Audit Metadata", [
      `phase: ${stage.repairPhase}`,
      `sourceReview: ${stage.artifact}`,
      `generatedAt: ${new Date().toISOString()}`,
    ].join("\n"))
    .addUserPrompt("## Codebase Context", contextText || "(no context)")
    .build();
}

function validateDraftRepairShape(draftJson, stage) {
  const issues = [];
  if (!draftJson || typeof draftJson !== "object" || Array.isArray(draftJson)) {
    return ["repair output must be a JSON object"];
  }
  const allowed = new Set(DRAFT_REPAIR_TOP_LEVEL_FIELDS);
  for (const field of Object.keys(draftJson)) {
    if (!allowed.has(field)) issues.push(`repair output contains unknown top-level field "${field}"`);
  }
  for (const field of DRAFT_REPAIR_TOP_LEVEL_FIELDS) {
    if (!Object.hasOwn(draftJson, field)) issues.push(`repair output missing top-level field "${field}"`);
  }
  if (!Array.isArray(draftJson.qa)) {
    issues.push("repair output must include qa[]");
  }
  if (!draftJson.decisionMap || typeof draftJson.decisionMap !== "object" || Array.isArray(draftJson.decisionMap)) {
    issues.push("repair output must include decisionMap object");
  }
  if (stage.key === "questions" && Array.isArray(draftJson.qa)) {
    for (let i = 0; i < draftJson.qa.length; i++) {
      const entry = draftJson.qa[i];
      if (entry?.status === "pending" || entry?.status === "approved" || entry?.status == null) {
        for (const field of ["answer", "evidence", "why", "droppedReason"]) {
          if (entry?.[field]) {
            issues.push(`qa[${i}].${field} must remain empty during question review repair`);
          }
        }
      }
    }
  }
  return issues;
}

function validateDraftRepairAudit(audit, issues, stage, draftJson) {
  const validationIssues = [];
  const serialized = audit instanceof DraftRepairAuditArtifact ? audit.toJSON() : audit;
  validationIssues.push(...validateSchema(serialized, DRAFT_REPAIR_AUDIT_SCHEMA));
  if (validationIssues.length > 0) return validationIssues;

  if (audit.phase !== stage.repairPhase) {
    validationIssues.push(`audit.phase must be ${stage.repairPhase}`);
  }
  if (audit.sourceReview !== stage.artifact) {
    validationIssues.push(`audit.sourceReview must be ${stage.artifact}`);
  }
  if (audit.items.length !== issues.length) {
    validationIssues.push(`audit.items must contain one item per review finding (${issues.length})`);
  }
  for (let i = 0; i < Math.min(audit.items.length, issues.length); i++) {
    const item = audit.items[i];
    if (item.findingTitle !== issues[i].title) {
      validationIssues.push(`audit.items[${i}].findingTitle must match review finding title "${issues[i].title}"`);
    }
    if (item.decision === "applied" && item.changedFields.length === 0) {
      validationIssues.push(`audit.items[${i}].changedFields must be non-empty when decision is applied`);
    }
  }
  if (stage.key === "coverage" && audit.requiresUserDecision() && draftJson?.approval?.approved === true) {
    validationIssues.push("coverage repair must keep approval.approved false when audit requires a user decision");
  }
  return validationIssues;
}

async function repairDraftReviewFindings(agent, draftPath, auditPath, draftJson, issues, stage, requestText, contextEntries) {
  if (issues.length === 0) return { draftJson, repaired: false, audit: null };

  const repairPrompt = buildDraftRepairPrompt(draftJson, issues, stage, requestText, contextEntries);
  const raw = await callReviewAgent(
    agent,
    repairPrompt,
    `${stage.commandId}.repair`,
    "You repair draft.json in one pass. Return only the required JSON object.",
  );

  const repairOutput = parseDraftRepairOutput(raw);
  const repairedDraft = repairOutput.draft;
  const shapeIssues = validateDraftRepairShape(repairedDraft, stage);
  const auditIssues = validateDraftRepairAudit(repairOutput.audit, issues, stage, repairedDraft);
  shapeIssues.push(...auditIssues);
  if (shapeIssues.length > 0) {
    throw new Error(`draft repair produced invalid output: ${shapeIssues.join("; ")}`);
  }

  fs.writeFileSync(draftPath, JSON.stringify(repairedDraft, null, 2) + "\n");
  fs.writeFileSync(auditPath, JSON.stringify(repairOutput.audit, null, 2) + "\n");
  return { draftJson: repairedDraft, repaired: true, audit: repairOutput.audit };
}

function approveDraftAfterCoverageReview(draftPath, draftJson, verdict) {
  if (verdict !== "PASS" && verdict !== "ADVISORY") return;
  const approval = draftJson.approval && typeof draftJson.approval === "object"
    ? draftJson.approval
    : {};
  if (approval.approved === true && approval.confirmedAt) return;

  draftJson.approval = {
    approved: true,
    confirmedAt: new Date().toISOString(),
    notes: approval.notes || (
      verdict === "ADVISORY"
        ? "Draft review advisory findings recorded; proceeding to spec."
        : "Draft review passed."
    ),
  };
  fs.writeFileSync(draftPath, JSON.stringify(draftJson, null, 2) + "\n");
}

async function runDraftReview(root, flow, config, dryRun) {
  const specDir = path.dirname(flow.spec);
  const draftPath = path.resolve(root, specDir, "draft.json");
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

  const issues = raw.includes("NO_PROPOSALS") ? [] : parseProposals(raw);
  const verdict = issues.length === 0 ? "PASS" : "ADVISORY";

  const reviewPath = path.join(path.resolve(root, specDir), stage.artifact);
  const repairAuditPath = path.join(path.resolve(root, specDir), stage.repairArtifact);
  fs.writeFileSync(reviewPath, formatDraftReviewMd(issues, stage, verdict));

  let repaired = false;
  let repairAudit = null;
  if (issues.length > 0) {
    console.error(`  [${stage.tag}] Repairing draft.json from advisory findings...`);
    const repairResult = await repairDraftReviewFindings(
      agent,
      draftPath,
      repairAuditPath,
      draftJson,
      issues,
      stage,
      requestText,
      contextEntries,
    );
    draftJson = repairResult.draftJson;
    repaired = repairResult.repaired;
    repairAudit = repairResult.audit;
    if (repaired) {
      fs.appendFileSync(
        reviewPath,
        `\n\n## Auto Repair\nOne-pass draft.json repair was applied before proceeding.\n\nAudit: ${stage.repairArtifact}\n`,
      );
    }
  }

  if (stage.key === "coverage" && !repairAudit?.requiresUserDecision()) {
    approveDraftAfterCoverageReview(draftPath, draftJson, verdict);
  }

  console.error(`  [${stage.tag}] Results saved to ${path.relative(root, reviewPath)}`);
  console.error(`  [${stage.tag}] verdict=${verdict} ${stage.countLabel}=${issues.length} retryPhase=${stage.retryPhase}`);

  if (verdict === "PASS") {
    console.log("Draft review PASS. QA entries are adequate.");
  } else {
    console.log(`Draft review ADVISORY. ${issues.length} finding(s) recorded; ${repaired ? "draft.json repaired" : "proceeding"}.`);
  }
}

async function runReview(rawArgs) {
  const root = container.get("root");
  const cli = parseArgs(rawArgs, {
    flags: ["--dry-run", "--skip-confirm"],
    options: ["--phase"],
    defaults: { dryRun: false, skipConfirm: false, phase: null },
  });

  if (cli.help) {
    const phaseDesc = Object.entries(REVIEW_PHASES).map(([k, v]) => `'${k}' for ${v}`).join(", ");
    console.log([
      "Usage: sdd-forge flow review [options]",
      "",
      "Options:",
      `  --phase <type>   Review phase: ${phaseDesc}`,
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
    console.log("No changes detected. Skipping review.");
    return;
  }

  // R1 (spec 242): file-map.json is required for impl review
  const fileMap = await loadReqMap(root, flow, "file");
  if (!fileMap || Object.keys(fileMap).length === 0) {
    console.error("Error: file-map.json is required for impl review but was not found or is empty");
    process.exit(EXIT_ERROR);
  }

  const touchedFiles = collectTouchedFiles(root, mergeBase);
  const reviewGuardrails = filterByPhase(loadMergedGuardrails(root), "review");

  // R2 (spec 242): threshold-based routing
  let rawProposals;
  if (shouldUseLoopReview(touchedFiles.size)) {
    rawProposals = await runLoopReview(root, flow, mergeBase, fileMap, touchedFiles, reviewGuardrails);
  } else {
    // Legacy single-call path
    const mapLines = Object.entries(fileMap).map(([reqId, files]) =>
      `- ${reqId}: ${files.join(", ")}`,
    );
    const reviewInput = `## Requirement-File Mapping\n${mapLines.join("\n")}\n\n## Diff\n${diff}`;

    console.error("  [draft] Generating proposals...");
    const draftAgent = ensureAgent("flow.impl.review.propose");
    const draftResult = await callReviewAgent(
      draftAgent,
      reviewInput,
      "flow.impl.review.propose",
      buildDraftSystemPrompt(
        reviewGuardrails,
        buildReviewAcknowledgedRationale(root, flow, reviewGuardrails),
      ),
    );

    if (draftResult.includes("NO_PROPOSALS")) {
      console.log("No improvement proposals found. Code looks good.");
      writeReviewMd(root, flow, []);
      return;
    }

    rawProposals = parseProposals(draftResult);
    if (rawProposals.length === 0) {
      console.log("No structured proposals found.");
      writeReviewMd(root, flow, []);
      return;
    }
  }

  // --- Common post-processing ---
  const { kept: proposals, excluded } = filterProposalsByScope(rawProposals, touchedFiles);
  if (excluded.outOfScope > 0 || excluded.missingFile > 0) {
    console.error(
      `  [draft] excluded ${excluded.outOfScope} out-of-scope + ${excluded.missingFile} missing-file proposal(s).`,
    );
  }
  if (proposals.length === 0) {
    console.log("No improvement proposals found. Code looks good.");
    writeReviewMd(root, flow, []);
    return;
  }

  console.error(`  [draft] ${proposals.length} proposal(s) generated (after scope filter).`);

  const reviewPath = writeReviewMd(root, flow, proposals);
  console.error(`  [review] Results saved to ${path.relative(root, reviewPath)}`);
  console.error(`  [review] proposalCount=${proposals.length}`);

  console.log("");
  console.log("Proposals:");
  for (const p of proposals) {
    console.log(`  - ${p.title}`);
  }
  console.log("");

  if (cli.dryRun) {
    console.log("(dry-run: skipping apply phase)");
    return;
  }

  console.log("Review the proposals above and in review.md.");
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
  getReviewMaxAttempts, REVIEW_PHASES, extractRequirements, collectTestFiles, parseGaps,
  applyTestFixes, formatTestReviewMd, runReviewLoop,
  extractGoalAndScope, buildSpecSummaryMarkdown, buildSpecReviewPrompt, formatSpecReviewMd, formatSpecReviewJson, parseSpecReviewFindings,
  isValidSpecOutput, stripPreamble, buildGapAnalysisPrompt, buildTestFixPrompt,
  buildDraftReviewPrompt, formatDraftReviewMd,
  buildDraftRepairPrompt, parseDraftRepairOutput, validateDraftRepairShape, validateDraftRepairAudit,
  shouldUseLoopReview, groupByDiffContent, buildPerFileReviewInput,
  buildCrossCheckInput, expandProposalsToGroup,
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
