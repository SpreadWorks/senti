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
import {
  collectGitSummary,
  commentOnIssueOnce,
  isGhAvailable,
} from "../../lib/git-helpers.js";
import { generateReport, ReportBinding, saveReport } from "../commands/report.js";
import { loadIssueLog } from "./set-issue-log.js";
import { FlowCommand } from "./base-command.js";
import {
  FINAL_REGRESSION_RESULT_FILE,
  UPGRADE_RESULT_FILE,
  buildTestResultsFromArtifacts,
  readJsonStrict,
  validateFinalRegressionResult,
  validateUpgradeResultArtifact,
} from "./test-artifacts.js";
import { readRetroResultIfExists } from "./retro-artifacts.js";
import {
  assertCurrentRepairEvidenceFiles,
  ensureRepairFingerprintContract,
} from "./impl-repair-artifacts.js";
import { advisorySummary } from "./nonblocking.js";

function withAdvisorySummary(report, state) {
  const advisory = advisorySummary(state);
  if (advisory.length === 0) return report;
  const lines = advisory.map((entry) => `- ${entry.stepId}: ${entry.evidenceRef}; risk: ${entry.remainingRisk}; rationale: ${entry.rationale}`);
  return {
    ...report,
    text: `${report.text}\n\n## Advisory continuations\n${lines.join("\n")}`,
    data: { ...report.data, assurance: "advisory", advisorySummary: advisory },
  };
}

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

function withDelivery(report, delivery) {
  return {
    ...report,
    data: {
      ...report.data,
      delivery,
    },
  };
}

function deliveryState(status, reason = null, idempotencyKey = null) {
  return {
    status,
    ...(reason == null ? {} : { reason }),
    ...(idempotencyKey == null ? {} : { idempotencyKey }),
  };
}

function loadPersistedReport(root, specPath) {
  const reportPath = path.join(path.dirname(path.resolve(root, specPath)), "report.json");
  return JSON.parse(fs.readFileSync(reportPath, "utf8"));
}

function loadRequiredIssueLog(root, specPath) {
  const issueLogPath = path.join(path.dirname(path.resolve(root, specPath)), "issue-log.json");
  if (!fs.existsSync(issueLogPath)) {
    throw new Error(`required issue-log.json is missing: ${issueLogPath}`);
  }
  return loadIssueLog(root, specPath);
}

function hasPendingDelivery(report, idempotencyKey) {
  const delivery = report?.data?.delivery;
  return (delivery?.status === "pending" || delivery?.status === "unsent")
    && (delivery.idempotencyKey == null || delivery.idempotencyKey === idempotencyKey);
}

function hasCompletedDelivery(report, idempotencyKey) {
  const delivery = report?.data?.delivery;
  return delivery?.status === "done"
    && (delivery.idempotencyKey == null || delivery.idempotencyKey === idempotencyKey);
}

function reportSourcePaths(root, specDir) {
  const [issueLog, ...optionalArtifacts] = [
    "issue-log.json",
    "retro.json",
    "test-execute-result.json",
    "test-result-review.json",
    FINAL_REGRESSION_RESULT_FILE,
    UPGRADE_RESULT_FILE,
  ];
  return [
    path.join(specDir, issueLog),
    ...optionalArtifacts
      .map((name) => path.join(specDir, name))
      .filter((sourcePath) => fs.existsSync(path.resolve(root, sourcePath))),
  ];
}

function postReportToIssue({ root, state, report, flowOutboxEntry }) {
  if (!isGhAvailable()) {
    return { ok: false, reason: "gh unavailable" };
  }
  const posted = commentOnIssueOnce(
    state.issue,
    report.text,
    root,
    flowOutboxEntry?.idempotencyKey,
  );
  if (!posted.ok) return { ok: false, reason: posted.error };
  return { ok: true, posted };
}

function completedIssueComment(state, flowOutboxEntry, resumed) {
  return {
    status: "done",
    issue: state.issue,
    resumed,
    idempotencyKey: flowOutboxEntry?.idempotencyKey,
  };
}

function deliverySuccess(report, issueComment, changed) {
  return {
    result: "ok",
    changed,
    issueComment,
    artifacts: { report, issueComment },
  };
}

export class RunReportCommand extends FlowCommand {
  static validateBinding(binding, context) {
    return ReportBinding.validate(binding, context);
  }

  static validateFinalEvidence(report, context) {
    return this.validateBinding(report?.data?.binding, context);
  }

  async execute(ctx) {
    const { root } = ctx;
    const dryRun = ctx.dryRun || false;
    const state = ctx.flowState;
    ensureRepairFingerprintContract({ root, state, flowManager: ctx.flowManager });

    const persistedReportPath = path.join(path.dirname(path.resolve(root, state.spec)), "report.json");
    if (state.issue && fs.existsSync(persistedReportPath)) {
      const persistedReport = loadPersistedReport(root, state.spec);
      if (hasPendingDelivery(persistedReport, ctx.flowOutboxEntry?.idempotencyKey)) {
        RunReportCommand.validateFinalEvidence(persistedReport, { root });
        return this.resumeDelivery(ctx);
      }
    }

    const baseBranch = state.baseBranch;
    if (!baseBranch) {
      throw new Error("baseBranch not set in flow.json");
    }

    const { diffStat: implDiffStat, commitMessages } = collectGitSummary(root, baseBranch);

    const redolog = loadRequiredIssueLog(root, state.spec);

    const specDir = path.dirname(path.resolve(root, state.spec));
    assertCurrentRepairEvidenceFiles({
      root,
      state,
      specDir,
      files: ["test-execute-result.json", "test-result-review.json", "retro.json"],
    });
    const retroResult = readRetroResultIfExists(specDir, "run-report");
    const hasTestExecuteResult = fs.existsSync(path.join(specDir, "test-execute-result.json"));
    const hasTestResultReview = fs.existsSync(path.join(specDir, "test-result-review.json"));

    const results = {};
    if (retroResult) results.retro = retroResult;
    // Shared loader preserves results.testExecute.projectRegression for report rendering.
    if (hasTestExecuteResult || hasTestResultReview) {
      Object.assign(results, buildTestResultsFromArtifacts(specDir));
    }
    const finalRegressionPath = path.join(specDir, FINAL_REGRESSION_RESULT_FILE);
    if (!results.finalRegression && fs.existsSync(finalRegressionPath)) {
      const finalRegression = validateFinalRegressionResult(readJsonStrict(finalRegressionPath));
      results.finalRegression = {
        status: "done",
        result: finalRegression.result,
        failureKind: finalRegression.failureKind,
        failureCategory: finalRegression.failureCategory || null,
        failureNature: finalRegression.failureNature || null,
        skipKind: finalRegression.skipKind || null,
        rawOutputPath: finalRegression.rawOutputPath,
        command: finalRegression.command,
        process: finalRegression.process,
        exitCode: finalRegression.process?.exitCode ?? null,
        failureSummary: finalRegression.failureSummary || null,
        currentDiffRelationship: finalRegression.currentDiffRelationship || null,
        changedFiles: finalRegression.changedFiles || [],
        changedFileFingerprints: finalRegression.changedFileFingerprints || [],
        fixAttempts: finalRegression.fixAttempts ?? null,
        selectedAction: finalRegression.selectedAction || null,
        remainingRisk: finalRegression.remainingRisk || null,
        retryable: finalRegression.retryable,
        nextAction: finalRegression.nextAction,
        nextRecommendedAction: finalRegression.nextRecommendedAction || null,
        recordAndProceed: finalRegression.recordAndProceed || null,
        humanSummary: finalRegression.humanSummary || null,
      };
    }
    const upgrade = buildUpgradeReportDataFromArtifacts(specDir);
    if (upgrade) results.upgrade = upgrade;

    const report = withAdvisorySummary(generateReport({
      state,
      results,
      redolog,
      implDiffStat,
      commitMessages,
    }), state);
    const binding = ReportBinding.fromSourcePaths({ root, sourcePaths: reportSourcePaths(root, specDir) });
    const boundReport = {
      ...report,
      data: {
        ...report.data,
        binding: binding.toJSON(),
      },
    };
    RunReportCommand.validateFinalEvidence(boundReport, { root });

    if (dryRun) {
      return {
        result: "dry-run",
        artifacts: { report: boundReport },
      };
    }

    let issueComment = { status: "skipped", reason: "no linked issue" };
    let persistedReport;
    if (!state.issue) {
      persistedReport = withDelivery(boundReport, deliveryState("not_required"));
      saveReport(root, state.spec, persistedReport);
    } else {
      const pendingReport = withDelivery(boundReport, deliveryState("pending", null, ctx.flowOutboxEntry?.idempotencyKey));
      saveReport(root, state.spec, pendingReport);
      const delivery = postReportToIssue({ root, state, report: pendingReport, flowOutboxEntry: ctx.flowOutboxEntry });
      if (!delivery.ok) {
        persistedReport = withDelivery(pendingReport, deliveryState("pending", delivery.reason, ctx.flowOutboxEntry?.idempotencyKey));
        saveReport(root, state.spec, persistedReport);
        throw new Error(`failed to post report to issue #${state.issue}: ${delivery.reason}`);
      }
      issueComment = {
        status: "done",
        issue: state.issue,
        resumed: delivery.posted.resumed,
      };
      persistedReport = withDelivery(boundReport, deliveryState("done", null, ctx.flowOutboxEntry?.idempotencyKey));
      saveReport(root, state.spec, persistedReport);
    }

    const specRelDir = path.dirname(state.spec);
    return {
      result: "ok",
      changed: [path.join(specRelDir, "report.json")],
      artifacts: { report: persistedReport, issueComment },
    };
  }

  async resumeDelivery(ctx) {
    const { root, flowState: state } = ctx;
    if (!state.issue) throw new Error("report delivery retry requires a linked issue");
    const report = loadPersistedReport(root, state.spec);
    if (hasCompletedDelivery(report, ctx.flowOutboxEntry?.idempotencyKey)) {
      return deliverySuccess(report, completedIssueComment(state, ctx.flowOutboxEntry, true), []);
    }
    if (!hasPendingDelivery(report, ctx.flowOutboxEntry?.idempotencyKey)) {
      throw new Error("report delivery retry requires a pending or unsent report");
    }
    RunReportCommand.validateFinalEvidence(report, { root });
    const delivery = postReportToIssue({ root, state, report, flowOutboxEntry: ctx.flowOutboxEntry });
    if (!delivery.ok) {
      saveReport(root, state.spec, withDelivery(report, deliveryState("pending", delivery.reason, ctx.flowOutboxEntry?.idempotencyKey)));
      throw new Error(`failed to post report to issue #${state.issue}: ${delivery.reason}`);
    }
    const deliveredReport = withDelivery(report, deliveryState("done", null, ctx.flowOutboxEntry?.idempotencyKey));
    saveReport(root, state.spec, deliveredReport);
    return deliverySuccess(
      deliveredReport,
      completedIssueComment(state, ctx.flowOutboxEntry, delivery.posted.resumed),
      [path.join(path.dirname(state.spec), "report.json")],
    );
  }
}

export default RunReportCommand;
