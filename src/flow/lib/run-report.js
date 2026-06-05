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
import {
  UPGRADE_RESULT_FILE,
  buildTestResultsFromArtifacts,
  validateUpgradeResultArtifact,
} from "./test-artifacts.js";
import { readRetroResultIfExists } from "./retro-artifacts.js";

export function buildUpgradeReportDataFromArtifacts(specDir) {
  const resultPath = path.join(specDir, UPGRADE_RESULT_FILE);
  if (!fs.existsSync(resultPath)) return null;
  const artifact = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  const validation = validateUpgradeResultArtifact(specDir, artifact);
  if (!validation.ok) {
    throw new Error(`upgrade artifact invalid: ${validation.reason}`);
  }
  return {
    result: artifact.result,
    summary: artifact.summary,
    rawLogPath: artifact.rawLogPath,
  };
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
    const retroResult = readRetroResultIfExists(specDir, "run-report");
    const hasTestExecuteResult = fs.existsSync(path.join(specDir, "test-execute-result.json"));
    const hasTestResultReview = fs.existsSync(path.join(specDir, "test-result-review.json"));

    const results = {};
    if (retroResult) results.retro = retroResult;
    // Shared loader preserves results.testExecute.projectRegression for report rendering.
    if (hasTestExecuteResult || hasTestResultReview) {
      Object.assign(results, buildTestResultsFromArtifacts(specDir));
    }
    const upgrade = buildUpgradeReportDataFromArtifacts(specDir);
    if (upgrade) results.upgrade = upgrade;

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
