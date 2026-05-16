/**
 * src/flow/lib/run-report.js
 *
 * FlowCommand: report — generate a work report from the current flow state.
 *
 * spec 251: report consumes the persisted artifacts produced by impl-phase
 * mainline steps:
 *   - retro.json (aggregated requirement pass/fail from retro)
 *   - test-execute-result.json (per-requirement evidence from test-execute)
 *   - test-result-review.json (artifact integrity verdict)
 * It does NOT read state.test.summary; the legacy aggregator path was removed.
 */

import fs from "fs";
import path from "path";
import { collectGitSummary } from "../../lib/git-helpers.js";
import { generateReport, saveReport } from "../commands/report.js";
import { loadIssueLog } from "./set-issue-log.js";
import { FlowCommand } from "./base-command.js";
import { buildTestResultsFromArtifacts } from "./test-artifacts.js";

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new Error(`[sdd-forge] run-report: failed to parse ${filePath}: ${err.message}`);
  }
}

export class RunReportCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const dryRun = ctx.dryRun || false;
    const state = ctx.flowState;

    const baseBranch = state.baseBranch;
    if (!baseBranch) {
      throw new Error("baseBranch not set in flow.json");
    }

    const { diffStat: implDiffStat, commitMessages } = collectGitSummary(root, baseBranch);

    let redolog = { entries: [] };
    try { redolog = loadIssueLog(root, state.spec); } catch (_) { /* no redolog */ }

    const specDir = path.dirname(path.resolve(root, state.spec));
    const retro = readJsonIfExists(path.join(specDir, "retro.json"));
    const hasTestExecuteResult = fs.existsSync(path.join(specDir, "test-execute-result.json"));
    const hasTestResultReview = fs.existsSync(path.join(specDir, "test-result-review.json"));

    const results = {};
    if (retro) {
      results.retro = {
        status: "done",
        summary: retro.summary,
        requirements: retro.requirements,
      };
    }
    // Shared loader preserves results.testExecute.projectRegression for report rendering.
    if (hasTestExecuteResult || hasTestResultReview) {
      Object.assign(results, buildTestResultsFromArtifacts(specDir));
    }

    const report = generateReport({
      state,
      results,
      redolog,
      implDiffStat,
      commitMessages,
    });

    if (dryRun) {
      return {
        result: "dry-run",
        artifacts: { report },
      };
    }

    try { saveReport(root, state.spec, report); } catch (e) { report.saveError = e.message; }

    const specRelDir = path.dirname(state.spec);
    return {
      result: "ok",
      changed: [path.join(specRelDir, "report.json")],
      artifacts: { report },
    };
  }
}

export default RunReportCommand;
