/**
 * src/flow/lib/get-resolve-context.js
 *
 * Resolve worktree/repo paths and active flow for context recovery
 * after compaction.
 */

import fs from "fs";
import path from "path";
import { getWorktreeStatus, getCurrentBranch, getAheadCount, getLastCommit, isGhAvailable } from "../../lib/git-helpers.js";
import { derivePhase } from "../../lib/flow-helpers.js";
import { FlowCommand } from "./base-command.js";

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

export default class GetResolveContextCommand extends FlowCommand {
  execute(ctx) {
    const { root, flowManager } = ctx;

    const resolved = flowManager.resolveActiveFlow(ctx.flowState);
    if (!resolved) {
      throw new Error("no active flow found");
    }

    const { state, specId, worktreePath } = resolved;
    const mainRepoPath = root;
    const flowJsonPath = path.resolve(root, `specs/${specId}/flow.json`);

    const steps = state.steps || [];
    const phase = derivePhase(state);
    const currentStep = steps.find((s) => s.status === "in_progress");
    const doneSteps = steps.filter((s) => s.status === "done" || s.status === "skipped");

    // Read spec summary
    let goal = null;
    let scope = null;
    const effectiveRoot = worktreePath && fs.existsSync(worktreePath) ? worktreePath : mainRepoPath;
    const specPath = path.resolve(effectiveRoot, state.spec);
    if (fs.existsSync(specPath)) {
      const specText = fs.readFileSync(specPath, "utf8");
      goal = extractSection(specText, "Goal") || null;
      scope = extractSection(specText, "Scope") || null;
    }

    // Git/gh state (read-only)
    const { dirty, dirtyFiles } = getWorktreeStatus(effectiveRoot);
    const currentBranch = getCurrentBranch(effectiveRoot);
    const aheadCount = getAheadCount(effectiveRoot, state.baseBranch || "main");
    const lastCommit = getLastCommit(effectiveRoot);
    const ghAvailable = isGhAvailable();

    // Determine recommended skill
    const phaseSkill = phase === "plan" ? "flow-plan"
      : phase === "impl" ? "flow-impl"
      : phase === "finalize" ? "flow-finalize"
      : phase === "sync" ? "flow-sync"
      : "flow-finalize";

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
      recommendedSkill: phaseSkill,
    };
  }
}
