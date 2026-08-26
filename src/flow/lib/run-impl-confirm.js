/**
 * src/flow/lib/run-impl-confirm.js
 *
 * FlowCommand: impl-confirm — check implementation readiness by comparing
 * spec.json requirements against actual file changes.
 */

import { runGit } from "../../lib/git-helpers.js";
import { VALID_IMPL_CONFIRM_MODES } from "../../lib/constants.js";
import { FlowCommand } from "./base-command.js";
import { CanonicalSpecRecord } from "./canonical-spec-record.js";

/**
 * Get files changed between base branch and HEAD.
 * @param {string} root - repo root
 * @param {string} baseBranch - base branch name
 * @returns {string[]} changed file paths
 */
function getChangedFiles(root, baseBranch) {
  const res = runGit(["-C", root, "diff", `${baseBranch}...HEAD`, "--name-only"]);
  if (!res.ok) return [];
  return res.stdout.trim().split("\n").filter(Boolean);
}

/**
 * Summarize requirements loaded from spec.json.
 * @param {Array<{desc: string, status: string}>} requirements
 * @returns {{ total: number, done: number, pending: number, inProgress: number, items: Array }}
 */
function summarizeRequirements(requirements) {
  if (!requirements || requirements.length === 0) {
    return { total: 0, done: 0, pending: 0, inProgress: 0, items: [] };
  }
  const done = requirements.filter((r) => r.status === "done").length;
  const inProgress = requirements.filter((r) => r.status === "in_progress").length;
  const pending = requirements.filter((r) => r.status === "pending").length;
  return {
    total: requirements.length,
    done,
    pending,
    inProgress,
    items: requirements.map((r, i) => ({ index: i, desc: r.desc, status: r.status })),
  };
}

export class RunImplConfirmCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const executionRoot = ctx.executionRoot || root;
    const state = ctx.flowState;

    const mode = ctx.mode || "overview";
    if (!VALID_IMPL_CONFIRM_MODES.includes(mode)) {
      throw new Error(`invalid mode: ${mode} (valid: ${VALID_IMPL_CONFIRM_MODES.join(", ")})`);
    }
    const requirements = summarizeRequirements(new CanonicalSpecRecord({
      flowManager: ctx.flowManager,
      state,
      consumerNodeId: "implement",
    }).requirements());

    // Determine readiness
    const allDone = requirements.total > 0 && requirements.done === requirements.total;
    const noRequirements = requirements.total === 0;

    let files = [];
    if (mode === "detail") {
      files = getChangedFiles(executionRoot, state.baseBranch);
    }

    return {
      result: allDone || noRequirements ? "ready" : "incomplete",
      changed: [],
      artifacts: {
        mode,
        requirements,
        files: mode === "detail" ? files : undefined,
        specId: state.specId,
        specExists: true,
        baseBranch: state.baseBranch,
        featureBranch: state.featureBranch,
      },
    };
  }
}

export default RunImplConfirmCommand;
