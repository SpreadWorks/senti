/**
 * src/flow/commands/merge.js
 *
 * Squash merge or PR creation based on flow state.
 * Called by finalize.js with ctx containing root, flowState, worktreePath, mainRepoPath, mergeStrategy.
 */

import { runCmd, assertOk } from "../../lib/process.js";
import path from "path";
import { container } from "../../lib/container.js";
import { isGhAvailable, runGit, fetchBranch, rebaseOnto, abortRebase } from "../../lib/git-helpers.js";
import { loadSpecJson } from "../../lib/spec-json.js";

/**
 * Resolve push remote from config.
 * @param {Object} cfg - SDD config
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

/**
 * Execute merge operation.
 * @param {Object} ctx
 * @param {string} ctx.root - project root (worktree or main repo)
 * @param {Object} ctx.flowState - flow.json state
 * @param {string|null} ctx.worktreePath - worktree path (null if not worktree mode)
 * @param {string|null} ctx.mainRepoPath - main repo path (null if not worktree mode)
 * @param {string} ctx.mergeStrategy - "squash" | "pr" | "auto"
 * @returns {{ strategy: string }} - the resolved strategy
 */
function runMerge(ctx) {
  const { flowState: state, mainRepoPath, mergeStrategy } = ctx;
  const root = ctx.root || container.get("root");
  const { baseBranch, featureBranch, worktree } = state;

  // Spec-only: featureBranch == baseBranch
  if (featureBranch === baseBranch) {
    return { strategy: "skip" };
  }

  // Resolve strategy
  let usePr = mergeStrategy === "pr";
  if (mergeStrategy === "auto") {
    const cfg = container.get("config");
    const ghEnabled = cfg?.commands?.gh === "enable";
    if (ghEnabled && isGhAvailable()) {
      usePr = true;
    }
  }

  // PR route
  if (usePr) {
    if (!isGhAvailable()) {
      throw new Error("gh command is not available. Install GitHub CLI to use PR route.");
    }
    const cfg = container.get("config");
    const remote = resolveRemote(cfg);
    const spec = loadSpec(state, root);
    const fallbackTitle = state.spec?.replace(/^specs\/\d+-/, "").replace(/\/spec\.(md|json)$/, "") || featureBranch;
    const title = buildPrTitle(spec, fallbackTitle);
    const body = buildPrBody(state, spec);

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
  const specTitle = state.spec?.replace(/^specs\/\d+-/, "").replace(/\/spec\.(md|json)$/, "") || featureBranch;
  const commitMsg = state.issue ? `${specTitle}\n\nfixes #${state.issue}` : specTitle;

  function runSquashMerge(gitPrefix, hint) {
    const mergeArgs = [...gitPrefix, "merge", "--squash", featureBranch];
    const resetArgs = [...gitPrefix, "reset", "--merge"];
    const mergeRes = runGit(mergeArgs);
    if (!mergeRes.ok) {
      runGit(resetArgs);
      throw new Error(`Merge conflict detected. ${hint}`);
    }
    const commitRes = runGit([...gitPrefix, "commit", "-m", commitMsg]);
    assertOk(commitRes, "commit after squash merge failed");
  }

  if (worktree && mainRepoPath) {
    const cfg = container.get("config");
    const remote = resolveRemote(cfg);
    const syncResult = runPreSync({ worktreePath: root, baseBranch, featureBranch, remote });
    if (syncResult.ok === false) {
      const err = new Error(
        `Pre-merge rebase detected conflicts in ${syncResult.conflictFiles.join(", ")}. ` +
          `Worktree has been restored. ${syncResult.recoveryHint}`,
      );
      err.conflictFiles = syncResult.conflictFiles;
      err.recoveryHint = syncResult.recoveryHint;
      throw err;
    }
    runSquashMerge(["-C", mainRepoPath], `Run 'git rebase ${baseBranch}' in the worktree and retry finalize.`);
    return { strategy: "squash" };
  }

  // Branch mode
  const checkoutRes = runGit(["checkout", baseBranch]);
  assertOk(checkoutRes, "git checkout failed");
  runSquashMerge([], `Run 'git rebase ${baseBranch}' and retry finalize.`);
  return { strategy: "squash" };
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

  abortRebase({ cwd: worktreePath });
  const recoveryHint =
    `Run 'git rebase ${baseBranch}' in the worktree, resolve conflicts, then 'git rebase --continue' and retry 'sdd-forge flow run finalize'.`;
  return { ok: false, conflictFiles: rebaseRes.conflictFiles, recoveryHint };
}

export { runMerge, parseSpec, buildPrTitle, buildPrBody, runPreSync };
