/**
 * src/flow/lib/run-final-regression.js
 *
 * Final project-level regression runner. Normal test-execute keeps the repair
 * loop focused on spec-local evidence; this command runs the full project
 * command after retro and before finalize.
 */

import fs from "fs";
import path from "path";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { sddOutputDir } from "../../lib/config.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import {
  FINAL_REGRESSION_RAW_OUTPUT_RELATIVE,
  FINAL_REGRESSION_RESULT_FILE,
  validateFinalRegressionResult,
} from "./test-artifacts.js";
import {
  classifyRegression,
  discoverRegressionCommand,
  listRegressionChangedFiles,
  processOutputLines,
  processPassed,
  resolveTestTimeoutSeconds,
  runProcessDetailed,
} from "./test-regression.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";

const FAILURE_NEXT_ACTION = Object.freeze({
  caused_by_current_change: "regression-repair",
  pre_existing: "user-confirmation",
  infra_failure: "stop",
  timeout: "stop",
  dependency_failure: "stop",
  sandbox_restriction: "stop",
  permission_error: "stop",
  child_process_eprem: "stop",
  invalid_project_test: "test-repair",
});
const MAX_FAILURE_EVIDENCE_CHARS = 256 * 1024;
const MAX_CHANGED_FILES_TO_MATCH = 1000;
const FAILURE_EVIDENCE_INPUT_COUNT = 4;
const FAILURE_EVIDENCE_JOINER_CHARS = FAILURE_EVIDENCE_INPUT_COUNT - 1;
const MAX_FAILURE_EVIDENCE_SOURCE_CHARS = Math.floor(
  (MAX_FAILURE_EVIDENCE_CHARS - FAILURE_EVIDENCE_JOINER_CHARS) / FAILURE_EVIDENCE_INPUT_COUNT,
);

class FinalRegressionDecision {
  constructor({ failureKind, retryable, nextAction }) {
    if (failureKind !== null && !Object.hasOwn(FAILURE_NEXT_ACTION, failureKind)) {
      throw new Error(`unknown final-regression failure kind: ${failureKind}`);
    }
    if (typeof retryable !== "boolean") throw new Error("final-regression retryable must be boolean");
    if (typeof nextAction !== "string" || nextAction.length === 0) {
      throw new Error("final-regression nextAction must be a non-empty string");
    }
    this.failureKind = failureKind;
    this.retryable = retryable;
    this.nextAction = nextAction;
    Object.freeze(this);
  }

  static pass() {
    return new FinalRegressionDecision({
      failureKind: null,
      retryable: false,
      nextAction: "finalize-commit",
    });
  }

  static fail(failureKind, previousFailureCount) {
    const repairable = failureKind === "caused_by_current_change" || failureKind === "invalid_project_test";
    const retryable = repairable && previousFailureCount === 0;
    return new FinalRegressionDecision({
      failureKind,
      retryable,
      nextAction: repairable && !retryable ? "stop" : FAILURE_NEXT_ACTION[failureKind],
    });
  }
}

class FinalRegressionProcess {
  constructor(result) {
    this.started = Boolean(result?.started);
    this.exitCode = Number.isInteger(result?.exitCode) ? result.exitCode : null;
    this.signal = typeof result?.signal === "string" ? result.signal : null;
    this.timedOut = Boolean(result?.timedOut);
    this.spawnError = typeof result?.spawnError === "string" ? result.spawnError : null;
    Object.freeze(this);
  }

  toJSON() {
    return {
      started: this.started,
      exitCode: this.exitCode,
      signal: this.signal,
      timedOut: this.timedOut,
      spawnError: this.spawnError,
    };
  }
}

class FinalRegressionArtifact {
  constructor({
    result,
    command,
    commandSource,
    rawOutputPath,
    rawOutputLines,
    process,
    changedFiles,
    decision,
    previousFailureKind = null,
  }) {
    if (result !== "pass" && result !== "fail") throw new Error("final-regression result must be pass or fail");
    if (!(decision instanceof FinalRegressionDecision)) throw new Error("final-regression decision is required");
    this.version = "1";
    this.completed = result === "pass";
    this.result = result;
    this.failureKind = decision.failureKind;
    this.command = command;
    this.commandSource = commandSource;
    this.rawOutputPath = rawOutputPath;
    this.rawOutputLines = rawOutputLines;
    this.process = process;
    this.changedFiles = Object.freeze([...(changedFiles || [])]);
    this.retryable = decision.retryable;
    this.nextAction = decision.nextAction;
    this.previousFailureKind = previousFailureKind;
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      completed: this.completed,
      result: this.result,
      failureKind: this.failureKind,
      command: this.command,
      commandSource: this.commandSource,
      rawOutputPath: this.rawOutputPath,
      rawOutputLines: this.rawOutputLines,
      process: this.process.toJSON(),
      changedFiles: this.changedFiles,
      retryable: this.retryable,
      nextAction: this.nextAction,
      previousFailureKind: this.previousFailureKind,
    };
  }
}

function appendRaw(lines, sectionLines) {
  const start = lines.length + 1;
  lines.push(...sectionLines);
  return { start_line: start, end_line: lines.length };
}

function commandDiscoveryProcess(err) {
  return {
    started: false,
    exitCode: 1,
    signal: null,
    timedOut: false,
    spawnError: err.message || String(err),
    stdout: "",
    stderr: err.message || String(err),
  };
}

function readAnalysisIfExists(root) {
  const analysisPath = path.join(sddOutputDir(root), "analysis.json");
  if (!fs.existsSync(analysisPath)) return null;
  return JSON.parse(fs.readFileSync(analysisPath, "utf8"));
}

function classifyChangeScope({ root, state, config, changedFiles }) {
  const analysis = readAnalysisIfExists(root);
  const classification = classifyRegression({ root, state, analysis, config, changedFiles });
  return classification.required ? "current-change" : "pre-existing";
}

function boundedText(value, maxChars) {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  if (maxChars <= 1) return text.slice(0, maxChars);
  const head = Math.floor((maxChars - 1) / 2);
  const tail = maxChars - 1 - head;
  return `${text.slice(0, head)}\n${text.slice(-tail)}`;
}

function boundedEvidenceSource(value) {
  return boundedText(value, MAX_FAILURE_EVIDENCE_SOURCE_CHARS);
}

function failureEvidenceText(result, discoveryError) {
  const text = [
    discoveryError?.message,
    result?.spawnError,
    result?.stdout,
    result?.stderr,
  ].map(boundedEvidenceSource).join("\n");
  return boundedText(text, MAX_FAILURE_EVIDENCE_CHARS);
}

function normalizeFailureMatchText(text) {
  return String(text ?? "").replaceAll("\\", "/").toLowerCase();
}

function changedFilePath(entry) {
  if (typeof entry === "string") return entry;
  return typeof entry?.path === "string" ? entry.path : null;
}

function failureReferencesChangedFile(normalizedText, changedFiles) {
  return (changedFiles || []).some((entry) => {
    const filePath = changedFilePath(entry);
    if (!filePath) return false;
    const normalizedPath = normalizeFailureMatchText(filePath).replace(/^\.\//, "");
    return normalizedPath.length > 0 && normalizedText.includes(normalizedPath);
  });
}

function changedFilesWithinMatchLimit(changedFiles) {
  const files = changedFiles || [];
  return files.length <= MAX_CHANGED_FILES_TO_MATCH ? files : null;
}

function classifyFailure({ result, discoveryError = null, root, state, config, changedFiles }) {
  const text = failureEvidenceText(result, discoveryError);
  const normalizedText = normalizeFailureMatchText(text);
  if (discoveryError) return "invalid_project_test";
  if (result?.timedOut) return "timeout";
  if (/\beperm\b/.test(normalizedText)) return "child_process_eprem";
  if (/sandbox/.test(normalizedText)) return "sandbox_restriction";
  if (/\beacces\b|permission denied/.test(normalizedText)) return "permission_error";
  if (/\benoent\b|not found|command not found/.test(normalizedText)) return "dependency_failure";
  if (result?.signal) return "infra_failure";
  if (result?.exitCode === 127) return "dependency_failure";
  const changedFilesForMatching = changedFilesWithinMatchLimit(changedFiles);
  if (!changedFilesForMatching) return "infra_failure";
  if (classifyChangeScope({ root, state, config, changedFiles }) === "pre-existing") return "pre_existing";
  if (!failureReferencesChangedFile(normalizedText, changedFilesForMatching)) return "pre_existing";
  return "caused_by_current_change";
}

function previousFinalRegressionFailures(root, state) {
  const issueLog = loadIssueLog(root, state.spec);
  return issueLog.entries.filter((entry) => entry.step === "final-regression" && entry.result === "fail");
}

function recordFinalRegressionFailure(root, state, artifact) {
  const issueLog = loadIssueLog(root, state.spec);
  issueLog.entries.push({
    step: "final-regression",
    result: "fail",
    failureKind: artifact.failureKind,
    reason: `final-regression failed: ${artifact.failureKind}`,
    command: artifact.command,
    rawOutputPath: artifact.rawOutputPath,
    retryable: artifact.retryable,
    nextAction: artifact.nextAction,
    timestamp: new Date().toISOString(),
  });
  saveIssueLog(root, state.spec, issueLog);
}

export default class RunFinalRegressionCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const state = ctx.flowState;
    const config = ctx.config || {};
    const specDir = resolveSpecDir(path.resolve(root, state.spec));
    const rawOutputPath = path.join(specDir, FINAL_REGRESSION_RAW_OUTPUT_RELATIVE);
    const resultPath = path.join(specDir, FINAL_REGRESSION_RESULT_FILE);
    fs.mkdirSync(path.dirname(rawOutputPath), { recursive: true });

    const rawLines = [];
    const changedFiles = listRegressionChangedFiles({ root, state });
    const previousFailures = previousFinalRegressionFailures(root, state);
    const previousFailureKind = previousFailures.at(-1)?.failureKind || null;
    let rootCommand;
    let result;
    let discoveryError = null;

    try {
      rootCommand = discoverRegressionCommand(root, config);
      result = await runProcessDetailed(rootCommand, {
        cwd: root,
        timeoutMs: resolveTestTimeoutSeconds(config) * 1000,
      });
    } catch (err) {
      discoveryError = err;
      result = commandDiscoveryProcess(err);
    }

    const commandText = rootCommand ? rootCommand.toString() : null;
    const resultText = !discoveryError && processPassed(result) ? "pass" : "fail";
    const failureKind = resultText === "pass"
      ? null
      : classifyFailure({ result, discoveryError, root, state, config, changedFiles });
    const decision = resultText === "pass"
      ? FinalRegressionDecision.pass()
      : FinalRegressionDecision.fail(failureKind, previousFailures.length);

    const range = appendRaw(rawLines, [
      `[sdd-forge] final regression start command=${commandText || "<unresolved>"}`,
      `command: ${commandText || "<unresolved>"}`,
      ...(rootCommand ? [`commandSource: ${rootCommand.source}`] : []),
      ...processOutputLines(result),
      `result: ${resultText}`,
      ...(failureKind ? [`failureKind: ${failureKind}`, `nextAction: ${decision.nextAction}`] : []),
      `[sdd-forge] final regression end result=${resultText}`,
    ]);
    fs.writeFileSync(rawOutputPath, rawLines.join("\n") + "\n");

    const artifact = new FinalRegressionArtifact({
      result: resultText,
      command: commandText,
      commandSource: rootCommand?.source || null,
      rawOutputPath: path.relative(root, rawOutputPath).split(path.sep).join("/"),
      rawOutputLines: range,
      process: new FinalRegressionProcess(result),
      changedFiles,
      decision,
      previousFailureKind,
    });
    const json = artifact.toJSON();
    validateFinalRegressionResult(json);
    fs.writeFileSync(resultPath, JSON.stringify(json, null, 2) + "\n");

    if (resultText === "pass") {
      return {
        result: "pass",
        changed: [
          path.relative(root, resultPath),
          path.relative(root, rawOutputPath),
        ],
        artifacts: {
          result_path: path.relative(root, resultPath),
          raw_output_path: path.relative(root, rawOutputPath),
          completed: true,
          result: "pass",
          failureKind: null,
          retryable: false,
          nextAction: decision.nextAction,
        },
        next: "finalize-commit",
      };
    }

    recordFinalRegressionFailure(root, state, json);
    return Envelope.fail(
      "run",
      "final-regression",
      "FINAL_REGRESSION_FAILED",
      `final-regression failed (${failureKind}); nextAction=${decision.nextAction}`,
      {
        result_path: path.relative(root, resultPath),
        raw_output_path: path.relative(root, rawOutputPath),
        completed: false,
        result: "fail",
        failureKind,
        retryable: decision.retryable,
        nextAction: decision.nextAction,
      },
    );
  }
}
