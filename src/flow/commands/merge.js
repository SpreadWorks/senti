/**
 * src/flow/commands/merge.js
 *
 * Squash merge or PR creation based on flow state.
 * Called by finalize.js with ctx containing root, flowState, worktreePath, mainRepoPath.
 *
 * Strategy is determined solely from config (`commands.gh`) and `gh` availability:
 *   commands.gh === "enable" AND gh available  → PR route
 *   otherwise                                   → squash merge route
 * No CLI escape hatch exists (spec 215 / issue #223).
 */

import { runCmd, assertOk } from "../../lib/process.js";
import path from "path";
import os from "os";
import { container } from "../../lib/container.js";
import { isGhAvailable, runGit, fetchBranch, rebaseOnto, abortRebase } from "../../lib/git-helpers.js";
import { loadSpecJson } from "../../lib/spec-json.js";
import { hasOutboxCommit } from "../lib/run-finalize.js";

const MAX_IMPLEMENTATION_SUBJECTS = 50;
const MAX_SUBJECT_INPUT_CHARS = 4000;
const MAX_SUBJECT_INPUT_LINES = 20;
const MAX_IMPLEMENTATION_SUBJECT_OUTPUT_CHARS = MAX_IMPLEMENTATION_SUBJECTS * (MAX_SUBJECT_INPUT_CHARS + 1);
const SQUASH_MESSAGE_IGNORED_SUBJECTS = new Set([
  "chore: record finalize metadata before merge",
  "chore: add retro and report",
  "chore: add finalization artifacts",
]);

export class MergeRevalidationRequiredError extends Error {
  constructor({ beforeHead, afterHead }) {
    super("pre-merge synchronization changed the feature HEAD; verification must be refreshed");
    this.name = "MergeRevalidationRequiredError";
    this.code = "MERGE_REVALIDATION_REQUIRED";
    this.beforeHead = beforeHead;
    this.afterHead = afterHead;
  }
}

/**
 * Resolve push remote from config.
 * @param {Object} cfg - Spec-Driven Development config
 * @returns {string}
 */
function resolveRemote(cfg) {
  return cfg?.flow?.push?.remote || "origin";
}

/**
 * Extract the Goal / Scope / Requirements fields from a spec.json object as
 * structured data (spec 207 / T8). Pure data extraction with no formatting —
 * rendering lives in the formatter helpers below.
 *
 * @param {object|null} spec - parsed spec.json (or null)
 * @returns {{
 *   goal: string|null,
 *   scopeIn: string[],
 *   scopeOut: string[],
 *   requirements: Array<{id:string,desc:string,priority?:string}>
 * }}
 */
function parseSpec(spec) {
  if (!spec) return { goal: null, scopeIn: [], scopeOut: [], requirements: [] };
  return {
    goal: spec.goal ? spec.goal.trim() || null : null,
    scopeIn: Array.isArray(spec.scope?.in) ? spec.scope.in : [],
    scopeOut: Array.isArray(spec.scope?.out) ? spec.scope.out : [],
    requirements: Array.isArray(spec.requirements) ? spec.requirements : [],
  };
}

function formatRequirementsBlock(reqs) {
  if (!reqs || reqs.length === 0) return null;
  return reqs.map((r) => `- ${r.id}${r.priority ? ` [${r.priority}]` : ""}: ${r.desc}`).join("\n");
}

function formatScopeBlock({ scopeIn, scopeOut }) {
  const parts = [];
  for (const item of scopeIn) parts.push(`- ${item}`);
  if (scopeOut.length) {
    parts.push("", "### Out of Scope");
    for (const item of scopeOut) parts.push(`- ${item}`);
  }
  return parts.length ? parts.join("\n") : null;
}

/**
 * Build PR title from parsed spec.
 * @param {{goal: string|null}|null} spec - parsed spec sections
 * @param {string} fallback - fallback title
 * @returns {string}
 */
function buildPrTitle(spec, fallback) {
  if (spec?.goal) {
    const firstLine = spec.goal.split("\n")[0].trim();
    if (firstLine) return firstLine;
  }
  return fallback;
}

/**
 * Build PR body from flow state and parsed spec structured data.
 * @param {Object} state - flow.json state
 * @param {ReturnType<typeof parseSpec>|null} spec - structured spec data
 * @returns {string}
 */
function buildPrBody(state, spec) {
  const lines = [];
  if (state.issue) {
    lines.push(`fixes #${state.issue}`);
    lines.push("");
  }
  const reqsBlock = spec ? formatRequirementsBlock(spec.requirements) : null;
  const scopeBlock = spec ? formatScopeBlock(spec) : null;
  if (spec?.goal) {
    lines.push("## Goal", "", spec.goal, "");
  }
  if (reqsBlock) {
    lines.push("## Requirements", "", reqsBlock, "");
  }
  if (scopeBlock) {
    lines.push("## Scope", "", scopeBlock, "");
  }
  if (!spec?.goal && !reqsBlock && !scopeBlock && state.request) {
    lines.push("## Summary", "", state.request);
  }
  return lines.join("\n").trim();
}

/**
 * Load spec.json from flow state and reduce it to the goal/scope/requirements
 * summary structure used for PR body / squash commit metadata. Throws when
 * spec.json is missing or invalid — active flows are expected to have a valid
 * spec.json by invariant (spec 207 / T8).
 */
function loadSpec(state, root) {
  if (!state.spec) return null;
  const specInput = path.resolve(root, state.spec);
  const spec = loadSpecJson(specInput);
  return parseSpec(spec);
}

function firstNonEmptySubjectLine(value) {
  const text = String(value || "").slice(0, MAX_SUBJECT_INPUT_CHARS);
  let lineStart = 0;
  let inspectedLines = 0;
  for (let i = 0; i <= text.length && inspectedLines < MAX_SUBJECT_INPUT_LINES; i += 1) {
    if (i < text.length && text[i] !== "\n") continue;
    const line = text.slice(lineStart, i).trim();
    if (line) return line;
    inspectedLines += 1;
    lineStart = i + 1;
  }
  return null;
}

function collectImplementationSubjects({
  cwd,
  baseBranch,
  featureBranch,
  limit = MAX_IMPLEMENTATION_SUBJECTS,
}) {
  const parsedLimit = Number(limit);
  const effectiveLimit = Number.isFinite(parsedLimit) ? parsedLimit : MAX_IMPLEMENTATION_SUBJECTS;
  const boundedLimit = Math.trunc(Math.max(0, Math.min(effectiveLimit, MAX_IMPLEMENTATION_SUBJECTS)));
  if (!cwd || !baseBranch || !featureBranch || boundedLimit === 0) return [];
  const res = runGit(["-C", cwd, "log", `--max-count=${boundedLimit}`, "--format=%s", `${baseBranch}..${featureBranch}`]);
  if (!res.ok) {
    process.stderr.write(`[senti] warning: failed to collect implementation commit subjects: ${res.stderr || res.stdout}\n`);
    return [];
  }
  return String(res.stdout || "")
    .slice(0, MAX_IMPLEMENTATION_SUBJECT_OUTPUT_CHARS)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((subject) => !SQUASH_MESSAGE_IGNORED_SUBJECTS.has(subject));
}

function buildSquashCommitMessage({
  state,
  spec,
  fallbackTitle,
  implementationSubjects = [],
  idempotencyKey = null,
}) {
  let implementationSubject = null;
  for (const candidate of implementationSubjects) {
    implementationSubject = firstNonEmptySubjectLine(candidate);
    if (implementationSubject) break;
  }
  const subject = firstNonEmptySubjectLine(spec?.goal)
    || implementationSubject
    || firstNonEmptySubjectLine(fallbackTitle)
    || "finalize-merge";
  const paragraphs = [subject];
  if (state.issue) paragraphs.push(`fixes #${state.issue}`);
  if (idempotencyKey) paragraphs.push(`senti-outbox: ${idempotencyKey}`);
  return paragraphs.join("\n\n");
}

function completedSquashMerge({ root, baseBranch, featureBranch, idempotencyKey }) {
  if (!hasOutboxCommit({ root, ref: baseBranch, idempotencyKey })) return null;
  const baseline = runGit(["-C", root, "rev-parse", featureBranch]);
  assertOk(baseline, "failed to recover the completed squash baseline");
  return { strategy: "squash", mergedFromSha: baseline.stdout.trim(), resumed: true };
}

function unmergedPaths(gitPrefix) {
  const result = runGit([...gitPrefix, "diff", "--name-only", "--diff-filter=U"]);
  if (!result.ok) return [];
  return String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function squashMergeFailure({ mergeResult, unmerged }) {
  if (unmerged.length > 0) {
    const error = new Error(`Merge conflict detected in ${unmerged.join(", ")}.`);
    error.code = "MERGE_CONFLICT";
    error.conflictFiles = unmerged;
    return error;
  }
  const output = String(mergeResult.stderr || mergeResult.stdout || "unknown git merge failure").trim();
  const error = new Error(`Squash merge failed before conflict resolution: ${output}`);
  error.code = "MERGE_SQUASH_FAILED";
  return error;
}

/**
 * Resolve the merge strategy from flow state and config alone. Pure function —
 * used by both the live merge path and finalize's dry-run reporting so that
 * the dry-run `strategy` value matches what would actually be executed.
 *
 * @param {{ baseBranch: string, featureBranch: string }} state
 * @param {Object} config - Spec-Driven Development config
 * @param {() => boolean} [ghAvailable=isGhAvailable]
 * @returns {"skip"|"pr"|"squash"}
 */
function resolveMergeStrategy(state, config, ghAvailable = isGhAvailable) {
  if (state.featureBranch === state.baseBranch) return "skip";
  const ghEnabled = config?.commands?.gh === "enable";
  return ghEnabled && ghAvailable() ? "pr" : "squash";
}

/**
 * Execute merge operation.
 * @param {Object} ctx
 * @param {string} ctx.root - project root (worktree or main repo)
 * @param {Object} ctx.flowState - flow.json state
 * @param {string|null} ctx.worktreePath - worktree path (null if not worktree mode)
 * @param {string|null} ctx.mainRepoPath - main repo path (null if not worktree mode)
 * @returns {{ strategy: string }} - the resolved strategy
 */
function runMerge(ctx) {
  const { flowState: state, mainRepoPath, idempotencyKey = null } = ctx;
  const root = ctx.root || container.get("root");
  const { baseBranch, featureBranch, worktree } = state;

  const cfg = container.get("config");
  const strategy = resolveMergeStrategy(state, cfg);

  if (strategy === "skip") {
    return { strategy: "skip" };
  }

  // PR route
  if (strategy === "pr") {
    const remote = resolveRemote(cfg);
    const spec = loadSpec(state, root);
    const fallbackTitle = state.spec?.replace(/^specs\/\d+-/, "").replace(/\/spec\.(md|json)$/, "") || featureBranch;
    const title = buildPrTitle(spec, fallbackTitle);
    const marker = idempotencyKey ? `<!-- senti:${idempotencyKey} -->` : null;
    const body = [buildPrBody(state, spec), marker].filter(Boolean).join("\n\n");

    if (idempotencyKey) {
      const existing = runCmd("gh", [
        "pr", "list",
        "--base", baseBranch,
        "--head", featureBranch,
        "--state", "all",
        "--limit", "1",
        "--json", "number",
      ]);
      assertOk(existing, "failed to inspect existing pull requests before resume");
      const matches = JSON.parse(existing.stdout || "[]");
      if (matches.length > 0) return { strategy: "pr", resumed: true };
    }

    const pushRes = runGit(["push", "-u", remote, featureBranch]);
    assertOk(pushRes, "git push failed");
    const prRes = runCmd("gh", [
      "pr", "create",
      "--base", baseBranch,
      "--head", featureBranch,
      "--title", title,
      ...(body ? ["--body", body] : []),
    ]);
    assertOk(prRes, "gh pr create failed");
    return { strategy: "pr" };
  }

  // Squash merge route
  const fallbackTitle = state.spec?.replace(/^specs\/\d+-/, "").replace(/\/spec\.(md|json)$/, "") || featureBranch;
  let spec = null;
  try {
    spec = loadSpec(state, root);
  } catch (err) {
    process.stderr.write(`[senti] warning: failed to load spec for squash commit message: ${err.message}\n`);
  }

  const mergeRoot = worktree && mainRepoPath ? mainRepoPath : root;
  const completed = completedSquashMerge({
    root: mergeRoot,
    baseBranch,
    featureBranch,
    idempotencyKey,
  });
  if (completed) return completed;

  function runSquashMerge(gitPrefix, hint) {
    const mergeArgs = [...gitPrefix, "merge", "--squash", featureBranch];
    const resetArgs = [...gitPrefix, "reset", "--merge"];
    const mergeRes = runGit(mergeArgs);
    if (!mergeRes.ok) {
      const unmerged = unmergedPaths(gitPrefix);
      runGit(resetArgs);
      const failure = squashMergeFailure({ mergeResult: mergeRes, unmerged });
      failure.recoveryHint = hint;
      failure.message = `${failure.message} ${hint}`;
      throw failure;
    }
    const repoRoot = gitPrefix[0] === "-C" ? gitPrefix[1] : root;
    const implementationSubjects = collectImplementationSubjects({
      cwd: repoRoot,
      baseBranch,
      featureBranch,
    });
    const commitMsg = buildSquashCommitMessage({
      state,
      spec,
      fallbackTitle,
      implementationSubjects,
      idempotencyKey,
    });
    const commitRes = runGit([...gitPrefix, "commit", "-m", commitMsg]);
    assertOk(commitRes, "commit after squash merge failed");
  }

  if (worktree && mainRepoPath) {
    const cfg = container.get("config");
    const remote = resolveRemote(cfg);
    const beforeSync = runGit(["-C", mainRepoPath, "rev-parse", featureBranch]);
    assertOk(beforeSync, "failed to capture feature HEAD before pre-merge synchronization");
    const syncResult = runPreSync({ worktreePath: root, baseBranch, featureBranch, remote });
    if (syncResult.ok === false) {
      if (syncResult.dirty) {
        const err = new Error(syncResult.recoveryHint);
        err.dirty = true;
        err.recoveryHint = syncResult.recoveryHint;
        throw err;
      }
      const err = new Error(
        `Pre-merge rebase detected conflicts in ${syncResult.conflictFiles.join(", ")}. ` +
          `Worktree has been restored. ${syncResult.recoveryHint}`,
      );
      err.conflictFiles = syncResult.conflictFiles;
      err.recoveryHint = syncResult.recoveryHint;
      throw err;
    }

    const afterSync = runGit(["-C", mainRepoPath, "rev-parse", featureBranch]);
    assertOk(afterSync, "failed to capture feature HEAD after pre-merge synchronization");
    if (
      ctx.requireRevalidationAfterSync === true
      && beforeSync.stdout.trim() !== afterSync.stdout.trim()
    ) {
      throw new MergeRevalidationRequiredError({
        beforeHead: beforeSync.stdout.trim(),
        afterHead: afterSync.stdout.trim(),
      });
    }

    // R17: capture squash baseline after runPreSync (which may have rebased feature HEAD)
    // and before runSquashMerge, so the recorded SHA matches what is actually squashed.
    const baselineRes = runGit(["-C", mainRepoPath, "rev-parse", featureBranch]);
    assertOk(baselineRes, "failed to capture squash baseline (rev-parse featureBranch)");
    const mergedFromSha = baselineRes.stdout.trim();

    const mergeHint = `Run 'git rebase ${baseBranch}' in the worktree and retry finalize.`;
    const checkoutRes = runGit(["-C", mainRepoPath, "checkout", baseBranch]);
    if (checkoutRes.ok) {
      runSquashMerge(["-C", mainRepoPath], mergeHint);
      return { strategy: "squash", mergedFromSha };
    }

    // baseBranch is locked (e.g. checked out in another worktree) — fall back to
    // a temporary detached worktree, squash-merge there, then update the ref.
    const tmpWorktree = path.join(os.tmpdir(), `senti-merge-tmp-${process.pid}-${Date.now()}`);
    try {
      const addRes = runGit(["-C", mainRepoPath, "worktree", "add", "--detach", tmpWorktree, baseBranch]);
      assertOk(addRes, "failed to create temporary worktree for baseBranch checkout fallback");
      runSquashMerge(["-C", tmpWorktree], mergeHint);
      const headRes = runGit(["-C", tmpWorktree, "rev-parse", "HEAD"]);
      assertOk(headRes, "failed to read HEAD of temporary worktree");
      const updateRes = runGit(["-C", mainRepoPath, "update-ref", `refs/heads/${baseBranch}`, headRes.stdout.trim()]);
      assertOk(updateRes, `failed to update ${baseBranch} ref`);
      return { strategy: "squash", mergedFromSha };
    } finally {
      const removeRes = runGit(["-C", mainRepoPath, "worktree", "remove", "--force", tmpWorktree]);
      if (!removeRes.ok) {
        process.stderr.write(`warning: failed to remove temporary worktree ${tmpWorktree}: ${removeRes.stderr}\n`);
      }
    }
  }

  // Branch mode
  // R17: capture squash baseline before checkout so the recorded SHA matches the squash target.
  const baselineRes = runGit(["-C", root, "rev-parse", featureBranch]);
  assertOk(baselineRes, "failed to capture squash baseline (rev-parse featureBranch)");
  const mergedFromSha = baselineRes.stdout.trim();
  const checkoutRes = runGit(["-C", root, "checkout", baseBranch]);
  assertOk(checkoutRes, "git checkout failed");
  runSquashMerge(["-C", root], `Run 'git rebase ${baseBranch}' and retry finalize.`);
  return { strategy: "squash", mergedFromSha };
}

/**
 * Pre-merge sync: fetch base from remote and rebase the worktree's feature branch
 * onto it. Runs only in worktree + squash route; PR route and spec-only mode skip.
 *
 * Returns one of:
 *   { ok: true }                                            — rebase succeeded (or fast-forward / no-op).
 *   { ok: false, conflictFiles: string[], recoveryHint }    — rebase conflicted; worktree restored via --abort.
 *   { skipped: "pr-route" | "spec-only" }                   — not applicable to this route.
 */
function runPreSync({ worktreePath, baseBranch, featureBranch, remote = "origin", usePr = false }) {
  if (usePr) return { skipped: "pr-route" };
  if (featureBranch && featureBranch === baseBranch) return { skipped: "spec-only" };

  const fetchRes = fetchBranch(remote, baseBranch, { cwd: worktreePath });
  if (!fetchRes.ok) {
    const err = new Error(
      `pre-merge fetch failed: git fetch ${remote} ${baseBranch} exited ${fetchRes.status}: ${fetchRes.stderr || fetchRes.stdout}`,
    );
    err.fetchFailed = true;
    throw err;
  }
  const rebaseRef = `${remote}/${baseBranch}`;

  const rebaseRes = rebaseOnto(rebaseRef, { cwd: worktreePath });
  if (rebaseRes.ok) return { ok: true };

  if (rebaseRes.reason === "dirty") {
    return {
      ok: false,
      dirty: true,
      conflictFiles: [],
      recoveryHint:
        "Pre-merge rebase failed: working tree has uncommitted changes. Commit or discard changes in the worktree before retrying finalize.",
    };
  }

  abortRebase({ cwd: worktreePath });
  const recoveryHint =
    `Run 'git rebase ${baseBranch}' in the worktree, resolve conflicts, then 'git rebase --continue' and retry 'senti flow run finalize'.`;
  return { ok: false, conflictFiles: rebaseRes.conflictFiles, recoveryHint };
}

export {
  runMerge,
  resolveMergeStrategy,
  parseSpec,
  buildPrTitle,
  buildPrBody,
  buildSquashCommitMessage,
  collectImplementationSubjects,
  runPreSync,
  squashMergeFailure,
};
