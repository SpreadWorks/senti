/**
 * src/flow/lib/resolve-context-envelope.js
 *
 * Shared payload builder for `flow get resolve-context` and `flow run resume`.
 * Both commands expose the same envelope shape; centralizing the assembly here
 * removes the drift risk of maintaining two parallel copies (spec 219 review).
 */

import fs from "fs";
import path from "path";
import { getWorktreeStatus, getCurrentBranch, getAheadCount, getLastCommit, isGhAvailable } from "../../lib/git-helpers.js";
import { derivePhase } from "../../lib/flow-helpers.js";

function extractSection(text, heading) {
  const lines = text.split("\n");
  let inSection = false;
  const result = [];
  for (const line of lines) {
    if (inSection && /^## /.test(line)) break;
    if (new RegExp(`^## ${heading}\\b`, "i").test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) result.push(line);
  }
  return result.join("\n").trim();
}

function phaseToSkill(phase) {
  switch (phase) {
    case "plan": return "flow-plan";
    case "impl": return "flow-impl";
    case "finalize": return "flow-finalize";
    case "sync": return "flow-sync";
    default: return "flow-finalize";
  }
}

/**
 * Build the shared `{ mainRepoPath, worktreePath, ... }` envelope consumed by
 * both `get-resolve-context` and `run-resume`. Throws when no active flow is
 * found, matching the legacy behavior of both commands.
 *
 * @param {Object} ctx - flow command context (mainRoot, root, flowManager, flowState)
 * @returns {Object} envelope fields shared by both commands
 */
export function buildResolvedFlowContext(ctx) {
  const { root, mainRoot, flowManager } = ctx;

  const resolved = flowManager.resolveActiveFlow(ctx.flowState);
  if (!resolved) {
    throw new Error("no active flow found");
  }

  const { state, specId, worktreePath } = resolved;
  const mainRepoPath = mainRoot;
  const flowJsonPath = path.resolve(root, `specs/${specId}/flow.json`);

  const steps = state.steps || [];
  const phase = derivePhase(state);
  const currentStep = steps.find((s) => s.status === "in_progress");
  const doneSteps = steps.filter((s) => s.status === "done" || s.status === "skipped");

  let goal = null;
  let scope = null;
  const effectiveRoot = worktreePath && fs.existsSync(worktreePath) ? worktreePath : mainRepoPath;
  const specPath = path.resolve(effectiveRoot, state.spec);
  if (fs.existsSync(specPath)) {
    const specText = fs.readFileSync(specPath, "utf8");
    goal = extractSection(specText, "Goal") || null;
    scope = extractSection(specText, "Scope") || null;
  }

  const { dirty, dirtyFiles } = getWorktreeStatus(effectiveRoot);
  const currentBranch = getCurrentBranch(effectiveRoot);
  const aheadCount = getAheadCount(effectiveRoot, state.baseBranch || "main");
  const lastCommit = getLastCommit(effectiveRoot);
  const ghAvailable = isGhAvailable();

  return {
    mainRepoPath,
    worktreePath,
    activeFlow: specId,
    flowJsonPath,
    spec: state.spec,
    baseBranch: state.baseBranch,
    featureBranch: state.featureBranch,
    worktree: state.worktree || false,
    issue: state.issue || null,
    phase,
    currentStep: currentStep?.id || null,
    progress: { done: doneSteps.length, total: steps.length },
    request: state.request || null,
    goal,
    scope,
    requirements: state.requirements || [],
    notes: state.notes || [],
    dirty,
    dirtyFiles,
    currentBranch,
    aheadCount,
    lastCommit,
    ghAvailable,
    recommendedSkill: phaseToSkill(phase),
  };
}
