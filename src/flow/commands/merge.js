/**
 * src/flow/commands/merge.js
 *
 * Squash merge or PR creation based on flow state.
 * Called by finalize.js with ctx containing root, flowState, worktreePath, mainRepoPath, mergeStrategy.
 */

import { readFileSync } from "fs";
import { runCmd, assertOk } from "../../lib/process.js";
import path from "path";
import { container } from "../../lib/container.js";
import { isGhAvailable, runGit } from "../../lib/git-helpers.js";

/**
 * Resolve push remote from config.
 * @param {Object} cfg - SDD config
 * @returns {string}
 */
function resolveRemote(cfg) {
  return cfg?.flow?.push?.remote || "origin";
}

/**
 * Extract a markdown section body by heading name.
 * @param {string} content - full markdown text
 * @param {string} heading - heading text to find (e.g. "Goal")
 * @returns {string|null}
 */
function extractSection(content, heading) {
  const pattern = new RegExp(`^##\\s+${heading}\\s*$`, "m");
  const match = pattern.exec(content);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = rest.search(/^##\s+/m);
  const body = (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();
  return body || null;
}

/**
 * Parse spec.md content and extract Goal, Scope, Requirements sections.
 * @param {string} content - spec.md file content
 * @returns {{goal: string|null, scope: string|null, requirements: string|null}}
 */
function parseSpec(content) {
  if (!content) return { goal: null, scope: null, requirements: null };
  return {
    goal: extractSection(content, "Goal"),
    scope: extractSection(content, "Scope"),
    requirements: extractSection(content, "Requirements"),
  };
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
 * Build PR body from flow state and parsed spec.
 * @param {Object} state - flow.json state
 * @param {{goal: string|null, scope: string|null, requirements: string|null}|null} spec - parsed spec sections
 * @returns {string}
 */
function buildPrBody(state, spec) {
  const lines = [];
  if (state.issue) {
    lines.push(`fixes #${state.issue}`);
    lines.push("");
  }
  if (spec?.goal) {
    lines.push("## Goal");
    lines.push("");
    lines.push(spec.goal);
    lines.push("");
  }
  if (spec?.requirements) {
    lines.push("## Requirements");
    lines.push("");
    lines.push(spec.requirements);
    lines.push("");
  }
  if (spec?.scope) {
    lines.push("## Scope");
    lines.push("");
    lines.push(spec.scope);
    lines.push("");
  }
  if (!spec?.goal && !spec?.requirements && !spec?.scope) {
    if (state.request) {
      lines.push("## Summary");
      lines.push("");
      lines.push(state.request);
    }
  }
  return lines.join("\n").trim();
}

/**
 * Try to read and parse spec.md from flow state.
 * @param {Object} state - flow.json state
 * @param {string} root - project root
 * @returns {{goal: string|null, scope: string|null, requirements: string|null}|null}
 */
function loadSpec(state, root) {
  if (!state.spec) return null;
  try {
    const specPath = path.resolve(root, state.spec);
    const content = readFileSync(specPath, "utf8");
    return parseSpec(content);
  } catch (_) {
    return null;
  }
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
    const fallbackTitle = state.spec?.replace(/^specs\/\d+-/, "").replace(/\/spec\.md$/, "") || featureBranch;
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
  const specTitle = state.spec?.replace(/^specs\/\d+-/, "").replace(/\/spec\.md$/, "") || featureBranch;
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
    runSquashMerge(["-C", mainRepoPath], `Run 'git rebase ${baseBranch}' in the worktree and retry finalize.`);
    return { strategy: "squash" };
  }

  // Branch mode
  const checkoutRes = runGit(["checkout", baseBranch]);
  assertOk(checkoutRes, "git checkout failed");
  runSquashMerge([], `Run 'git rebase ${baseBranch}' and retry finalize.`);
  return { strategy: "squash" };
}

export { runMerge, parseSpec, buildPrTitle, buildPrBody };
