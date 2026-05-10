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
import { resolveNodeFor, FLOW_DEFINITION } from "../definition.js";

const REVIEW_PHASE_NODE_MAP = { draft: "review-draft", spec: "review-spec", test: "review-test" };

function getReviewMaxAttempts(phase, attemptContext) {
  const nodeId = REVIEW_PHASE_NODE_MAP[phase];
  if (!nodeId) throw new Error(`unsupported review maxAttempts phase: ${phase}`);
  if (!attemptContext || typeof attemptContext !== "object") {
    throw new Error(`review maxAttempts resolution requires explicit context for phase: ${phase}`);
  }
  return resolveNodeFor(FLOW_DEFINITION, nodeId).resolveMaxAttempts(attemptContext);
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

/**
 * Collect test files from spec-local tests/ and project tests/.
 * Spec-local takes precedence for same-name files.
 * @param {string} root
 * @param {string} specDir - relative spec directory
 * @returns {{ name: string, content: string, source: string }[]}
 */
function collectTestFiles(root, specDir) {
  const files = new Map();

  // Project-level tests/ (fallback)
  const projectTestDir = path.resolve(root, "tests");
  if (fs.existsSync(projectTestDir)) {
    collectTestsRecursive(projectTestDir, projectTestDir, files, "tests/");
  }

  // Spec-local tests/ (takes precedence)
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
 * @returns {string[]} paths of files written
 */
function applyTestFixes(text, root) {
  const written = [];
  const fileParts = text.split(/^### FILE:\s*/m).filter(Boolean);
  for (const part of fileParts) {
    const nlIdx = part.indexOf("\n");
    if (nlIdx < 0) continue;
    const filePath = part.slice(0, nlIdx).trim();
    const codeMatch = part.match(/```(?:\w*)\n([\s\S]*?)```/);
    if (!codeMatch) continue;
    const absPath = path.resolve(root, filePath);
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
      lines.push(`- ${g.title}`);
      lines.push(`  ${g.body}`);
    }
  }
  return lines.join("\n");
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
      const raw = await callReviewAgent(
        agent, detectPrompt, "flow.test.review",
        "You are a test quality reviewer. Identify gaps between test design and test code.",
      );
      return { issues: parseGaps(raw), raw };
    },
    async fix(raw) {
      const fixPrompt = buildTestFixPrompt(testDesign, raw, testFiles);
      const fixResult = await callReviewAgent(
        agent, fixPrompt, "flow.test.review",
        "You are a test engineer. Fix test gaps by writing complete updated test files.",
      );
      const written = applyTestFixes(fixResult, root);
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
  }
  if (Array.isArray(spec.requirements)) {
    lines.push("# Requirements");
    for (const r of spec.requirements) {
      lines.push(`- ${r.id} [${r.priority}]: ${r.desc}`);
    }
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

/**
 * Build the spec review prompt.
 * @param {string} specText - Minified spec summary from spec.json fields
 * @param {Object[]} contextEntries - Related codebase entries from contextSearch
 * @returns {{systemPrompt: string|null, userPrompt: string}}
 */
function buildSpecReviewPrompt(specText, contextEntries) {
  return new PromptBuilder()
    .setRole("You are a spec completeness reviewer. Analyze the following spec against the codebase context to identify oversights.")
    .setRules([
      "Focus on:",
      "- Files or features around modules in Scope that the spec does not mention",
      "- Related code not explicitly listed in Out of Scope",
      "- External references (skill templates, tests, config) that depend on files to be deleted or moved",
      "- Contradictions or gaps between requirements",
      "",
      "Output a numbered list of proposals in this format:",
      "### 1. <title>",
      "**File:** `<path>` (the file that the spec overlooks)",
      "**Issue:** <what the spec misses or gets wrong>",
      "**Suggestion:** <concrete improvement to the spec>",
      "",
      "If no oversights are found, output: NO_PROPOSALS",
    ].join("\n"))
    .addUserPrompt("## Spec", specText)
    .addUserPrompt(
      "## Codebase Context (related files)",
      formatCodebaseContextForPrompt(contextEntries),
    )
    .build();
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

function formatSpecReviewMd(results) {
  const lines = ["# Spec Review Results", ""];

  if (results.length === 0) {
    lines.push("No proposals generated. Spec looks complete.");
    return lines.join("\n");
  }

  lines.push("## Proposals", "");
  for (let i = 0; i < results.length; i++) {
    lines.push(`### ${i + 1}. ${results[i].title}`);
    if (results[i].body) lines.push(results[i].body);
    lines.push("");
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
  const proposePrompt = buildSpecReviewPrompt(specSummary, contextEntries);
  const proposeRaw = await callReviewAgent(proposeAgent, proposePrompt, "flow.spec.review.propose");

  if (proposeRaw.includes("NO_PROPOSALS")) {
    const reviewPath = path.join(path.resolve(root, specDir), "spec-review.md");
    fs.writeFileSync(reviewPath, formatSpecReviewMd([]));
    console.error(`  [spec-review] Results saved to ${path.relative(root, reviewPath)}`);
    console.error("  [spec-review] verdict=PASS proposalCount=0");
    console.log("NO_PROPOSALS");
    return;
  }

  const proposals = parseProposals(proposeRaw);
  if (proposals.length === 0) {
    const reviewPath = path.join(path.resolve(root, specDir), "spec-review.md");
    fs.writeFileSync(reviewPath, formatSpecReviewMd([]));
    console.error(`  [spec-review] Results saved to ${path.relative(root, reviewPath)}`);
    console.error("  [spec-review] verdict=PASS proposalCount=0");
    console.log("NO_PROPOSALS");
    return;
  }

  console.error(`  [spec-review] ${proposals.length} proposal(s) generated.`);

  const reviewPath = path.join(path.resolve(root, specDir), "spec-review.md");
  fs.writeFileSync(reviewPath, formatSpecReviewMd(proposals));
  console.error(`  [spec-review] Results saved to ${path.relative(root, reviewPath)}`);
  console.error(`  [spec-review] proposalCount=${proposals.length}`);

  console.error(`  [spec-review] verdict=FAIL proposalCount=${proposals.length}`);
  console.log(`Spec review found ${proposals.length} proposal(s). See spec-review.md.`);
}

// ---------------------------------------------------------------------------
// Draft review pipeline (--phase draft)
// ---------------------------------------------------------------------------

function buildDraftReviewPrompt(draftJson, requestText, contextEntries) {
  const qaText = Array.isArray(draftJson?.qa)
    ? draftJson.qa.map((q, i) =>
      `### Q${i + 1}: ${q.question}\n**Answer:** ${q.answer}\n**Evidence:** ${q.evidence || "(none)"}\n**Why:** ${q.why || "(none)"}`
    ).join("\n\n")
    : "(no QA entries)";

  return new PromptBuilder()
    .setRole("You are a draft QA quality reviewer. Analyze the draft's QA entries against the request/issue and codebase context.")
    .setRules([
      "Focus on:",
      "- Questions that are too shallow or generic to drive a useful spec",
      "- Missing coverage: areas the request/issue mentions but no QA entry addresses",
      "- Ambiguous or unsupported answers (claims without evidence)",
      "- Redundant entries that cover the same concern",
      "",
      "Output a numbered list of issues in this format:",
      "### 1. <title>",
      "**QA:** Q<N> (the QA entry number, or 'NEW' for missing coverage)",
      "**Issue:** <what is wrong or missing>",
      "**Suggestion:** <concrete improvement to the QA entry>",
      "",
      "If no issues are found, output: NO_PROPOSALS",
    ].join("\n"))
    .addUserPrompt("## Request / Issue", requestText || "(no request text)")
    .addUserPrompt("## Draft QA Entries", qaText)
    .addUserPrompt(
      "## Codebase Context (related files)",
      formatCodebaseContextForPrompt(contextEntries),
    )
    .build();
}

function formatDraftReviewMd(issues) {
  const lines = ["# Draft Review Results", ""];
  if (issues.length === 0) {
    lines.push("No issues found. PASS.");
  } else {
    lines.push(`${issues.length} issue(s) detected.`, "");
    for (let i = 0; i < issues.length; i++) {
      lines.push(`### ${i + 1}. ${issues[i].title}`);
      if (issues[i].body) lines.push(issues[i].body);
      lines.push("");
    }
  }
  return lines.join("\n");
}

async function runDraftReview(root, flow, config, dryRun) {
  const specDir = path.dirname(flow.spec);
  const draftPath = path.resolve(root, specDir, "draft.json");

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
    console.error(`  [draft-review] Warning: failed to load codebase context: ${e.message}`);
  }

  const agent = ensureAgent("flow.draft.review.propose");

  console.error("  [draft-review] Detecting issues...");
  let contextEntries = [];
  if (analysisData) {
    const searchQuery = draftJson.goal || requestText;
    if (searchQuery) {
      contextEntries = await analysisData.ctxSearch(analysisData.entries, analysisData.analysis, searchQuery, root);
    }
  }
  const detectPrompt = buildDraftReviewPrompt(draftJson, requestText, contextEntries);
  const raw = await callReviewAgent(agent, detectPrompt, "flow.draft.review.propose");

  const issues = raw.includes("NO_PROPOSALS") ? [] : parseProposals(raw);
  const verdict = issues.length === 0 ? "PASS" : "FAIL";

  const reviewPath = path.join(path.resolve(root, specDir), "draft-review.md");
  fs.writeFileSync(reviewPath, formatDraftReviewMd(issues));
  console.error(`  [draft-review] Results saved to ${path.relative(root, reviewPath)}`);
  console.error(`  [draft-review] verdict=${verdict} issues=${issues.length}`);

  if (verdict === "PASS") {
    console.log("Draft review PASS. QA entries are adequate.");
  } else {
    console.log(`Draft review FAIL. ${issues.length} issue(s) detected.`);
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
  extractGoalAndScope, buildSpecReviewPrompt, formatSpecReviewMd,
  isValidSpecOutput, stripPreamble, buildGapAnalysisPrompt, buildTestFixPrompt,
  buildDraftReviewPrompt, formatDraftReviewMd,
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
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}
