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
  FINAL_REGRESSION_RESULT_FILE,
  TESTS_RAW_DIR_RELATIVE,
  validateFinalRegressionResult,
} from "./test-artifacts.js";
import {
  classifyRegression,
  DEFAULT_PROCESS_HEARTBEAT_MS,
  discoverRegressionCommand,
  formatElapsedMs,
  listRegressionChangedFiles,
  processOutputLines,
  processPassed,
  resolveTestTimeoutSeconds,
  runProcessDetailed,
} from "./test-regression.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";

const FAILURE_KINDS = Object.freeze({
  CURRENT_CHANGE: "caused_by_current_change",
  UNATTRIBUTED_EXISTING: "unattributed_existing_failure",
  INFRA: "infra_failure",
  TIMEOUT: "timeout",
  DEPENDENCY: "dependency_failure",
  SANDBOX: "sandbox_restriction",
  PERMISSION: "permission_error",
  CHILD_PROCESS_EPERM: "child_process_eperm",
  INVALID_PROJECT_TEST: "invalid_project_test",
});

const FAILURE_NEXT_ACTION = Object.freeze({
  [FAILURE_KINDS.CURRENT_CHANGE]: "regression-repair",
  [FAILURE_KINDS.UNATTRIBUTED_EXISTING]: "user-confirmation",
  [FAILURE_KINDS.INFRA]: "stop",
  [FAILURE_KINDS.TIMEOUT]: "stop",
  [FAILURE_KINDS.DEPENDENCY]: "stop",
  [FAILURE_KINDS.SANDBOX]: "stop",
  [FAILURE_KINDS.PERMISSION]: "stop",
  [FAILURE_KINDS.CHILD_PROCESS_EPERM]: "stop",
  [FAILURE_KINDS.INVALID_PROJECT_TEST]: "test-repair",
});
const FINAL_REGRESSION_ATTEMPT_FILE_RE = /^final-regression-attempt-(\d+)\.log$/;
const MAX_FINAL_REGRESSION_ATTEMPTS = 10_000;
const MAX_FINAL_REGRESSION_RAW_DIR_SCAN_ENTRIES = 10_000;
const ATTEMPT_LIMIT_MESSAGE = `final-regression attempt limit exceeded (max=${MAX_FINAL_REGRESSION_ATTEMPTS})`;
const MAX_FAILURE_EVIDENCE_CHARS = 256 * 1024;
const MAX_CHANGED_FILES_TO_MATCH = 1000;
const FAILURE_EVIDENCE_INPUT_COUNT = 4;
const FAILURE_EVIDENCE_JOINER_CHARS = FAILURE_EVIDENCE_INPUT_COUNT - 1;
const MAX_FAILURE_EVIDENCE_SOURCE_CHARS = Math.floor(
  (MAX_FAILURE_EVIDENCE_CHARS - FAILURE_EVIDENCE_JOINER_CHARS) / FAILURE_EVIDENCE_INPUT_COUNT,
);
export const FINAL_REGRESSION_HEARTBEAT_MS = DEFAULT_PROCESS_HEARTBEAT_MS;

class TextFailureClassifier {
  constructor(pattern, kind) {
    this.pattern = pattern;
    this.kind = kind;
    Object.freeze(this);
  }

  matches(text) {
    return this.pattern.test(text);
  }
}

const TEXT_FAILURE_CLASSIFIERS = Object.freeze([
  new TextFailureClassifier(/\beperm\b/, FAILURE_KINDS.CHILD_PROCESS_EPERM),
  new TextFailureClassifier(/sandbox/, FAILURE_KINDS.SANDBOX),
  new TextFailureClassifier(/\beacces\b|permission denied/, FAILURE_KINDS.PERMISSION),
  new TextFailureClassifier(/\benoent\b|not found|command not found/, FAILURE_KINDS.DEPENDENCY),
  new TextFailureClassifier(/without stdout\/stderr|spawnerror/, FAILURE_KINDS.INFRA),
]);

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
    const repairable = failureKind === FAILURE_KINDS.CURRENT_CHANGE
      || failureKind === FAILURE_KINDS.INVALID_PROJECT_TEST;
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
    };
  }

  toEnvelopeArtifacts(resultPath) {
    return {
      result_path: resultPath,
      raw_output_path: this.rawOutputPath,
      completed: this.completed,
      result: this.result,
      failureKind: this.failureKind,
      retryable: this.retryable,
      nextAction: this.nextAction,
    };
  }
}

class FinalRegressionProcessResultFactory {
  static failure({ spawnError = null, stderr = "" } = {}) {
    // spawnError is set only for actual command discovery or spawn failures.
    return {
      started: false,
      exitCode: 1,
      signal: null,
      timedOut: false,
      spawnError,
      stdout: "",
      stderr,
    };
  }

  static commandDiscovery(err) {
    const message = err.message || String(err);
    return FinalRegressionProcessResultFactory.failure({ spawnError: message, stderr: message });
  }

  static rootMismatch(message) {
    return FinalRegressionProcessResultFactory.failure({ stderr: message });
  }
}

function repoRelative(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function writeFinalRegressionProgressLine(message) {
  process.stderr.write(`[sdd-forge] final-regression ${message}\n`);
}

function appendRaw(lines, sectionLines) {
  const start = lines.length + 1;
  lines.push(...sectionLines);
  return { start_line: start, end_line: lines.length };
}

function resolveRealPath(value) {
  const resolved = path.resolve(value);
  try {
    return fs.realpathSync(resolved);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
    return resolved;
  }
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
  if (discoveryError) return FAILURE_KINDS.INVALID_PROJECT_TEST;
  if (result?.timedOut) return FAILURE_KINDS.TIMEOUT;
  if (normalizedText.trim() === "" && result?.exitCode) return FAILURE_KINDS.INFRA;
  if (/^command failed:/.test(normalizedText.trim()) && result?.exitCode) return FAILURE_KINDS.INFRA;
  for (const classifier of TEXT_FAILURE_CLASSIFIERS) {
    if (classifier.matches(normalizedText)) return classifier.kind;
  }
  if (result?.signal) return FAILURE_KINDS.INFRA;
  if (result?.exitCode === 127) return FAILURE_KINDS.DEPENDENCY;
  const changedFilesForMatching = changedFilesWithinMatchLimit(changedFiles);
  if (!changedFilesForMatching) return FAILURE_KINDS.INFRA;
  if (classifyChangeScope({ root, state, config, changedFiles }) === "pre-existing") {
    return FAILURE_KINDS.UNATTRIBUTED_EXISTING;
  }
  if (!failureReferencesChangedFile(normalizedText, changedFilesForMatching)) {
    return FAILURE_KINDS.UNATTRIBUTED_EXISTING;
  }
  return FAILURE_KINDS.CURRENT_CHANGE;
}

function nextFinalRegressionAttempt(specDir) {
  const rawDir = path.join(specDir, TESTS_RAW_DIR_RELATIVE);
  fs.mkdirSync(rawDir, { recursive: true });
  const nextIndex = latestAttemptIndex(rawDir) + 1;
  if (nextIndex > MAX_FINAL_REGRESSION_ATTEMPTS) {
    throw new Error(`${ATTEMPT_LIMIT_MESSAGE}; next=${nextIndex}`);
  }
  const fileName = `final-regression-attempt-${String(nextIndex).padStart(3, "0")}.log`;
  return path.join(rawDir, fileName);
}

function latestAttemptIndex(rawDir) {
  let maxIndex = 0;
  const dir = fs.opendirSync(rawDir);
  let seen = 0;
  try {
    let entry;
    while ((entry = dir.readSync())) {
      if (++seen > MAX_FINAL_REGRESSION_RAW_DIR_SCAN_ENTRIES) {
        throw new Error(`final-regression raw directory scan limit exceeded (max=${MAX_FINAL_REGRESSION_RAW_DIR_SCAN_ENTRIES})`);
      }
      const match = FINAL_REGRESSION_ATTEMPT_FILE_RE.exec(entry.name);
      if (match) maxIndex = Math.max(maxIndex, Number.parseInt(match[1], 10));
    }
  } finally {
    dir.closeSync();
  }
  return maxIndex;
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
    const attemptPath = nextFinalRegressionAttempt(specDir);
    const resultPath = path.join(specDir, FINAL_REGRESSION_RESULT_FILE);
    const resultPathRelative = repoRelative(root, resultPath);
    const rawOutputPathRelative = repoRelative(root, attemptPath);

    const rawLines = [];
    const previousFailures = previousFinalRegressionFailures(root, state);
    const expectedRoot = state.worktree
      ? state.worktreePath ?? ctx.flowManager.resolveWorktreePaths(state).worktreePath
      : null;
    const rootPath = path.resolve(root);
    const expectedRootPath = expectedRoot ? path.resolve(expectedRoot) : null;
    const rootOk = !expectedRootPath || resolveRealPath(rootPath) === resolveRealPath(expectedRootPath);
    let changedFiles = [];
    let rootCommand;
    let commandText = null;
    let result;
    let resultStatus;
    let failureKind;
    let discoveryError = null;

    if (rootOk) {
      changedFiles = listRegressionChangedFiles({ root, state });
      try {
        rootCommand = discoverRegressionCommand(root, config);
        commandText = rootCommand.toString();
        writeFinalRegressionProgressLine(`command: ${commandText}`);
        writeFinalRegressionProgressLine(`raw log: ${rawOutputPathRelative}`);
        result = await runProcessDetailed(rootCommand, {
          cwd: root,
          timeoutMs: resolveTestTimeoutSeconds(config) * 1000,
          heartbeatIntervalMs: ctx.finalRegressionProgress?.heartbeatMs ?? FINAL_REGRESSION_HEARTBEAT_MS,
          onHeartbeat({ elapsedMs }) {
            writeFinalRegressionProgressLine(`elapsed: ${formatElapsedMs(elapsedMs)}`);
          },
        });
      } catch (err) {
        discoveryError = err;
        result = FinalRegressionProcessResultFactory.commandDiscovery(err);
      }
      resultStatus = !discoveryError && processPassed(result) ? "pass" : "fail";
      failureKind = resultStatus === "pass"
        ? null
        : classifyFailure({ result, discoveryError, root, state, config, changedFiles });
    } else {
      result = FinalRegressionProcessResultFactory.rootMismatch(
        `final-regression worktree root mismatch: expected ${expectedRootPath || "<unresolved>"}, got ${rootPath}`,
      );
      resultStatus = "fail";
      failureKind = FAILURE_KINDS.INFRA;
    }

    const decision = resultStatus === "pass"
      ? FinalRegressionDecision.pass()
      : FinalRegressionDecision.fail(failureKind, previousFailures.length);

    const range = appendRaw(rawLines, [
      `[sdd-forge] final regression start command=${commandText || "<unresolved>"}`,
      `command: ${commandText || "<unresolved>"}`,
      ...(rootCommand ? [`commandSource: ${rootCommand.source}`] : []),
      ...processOutputLines(result),
      `result: ${resultStatus}`,
      ...(failureKind ? [`failureKind: ${failureKind}`, `retryable: ${decision.retryable}`, `nextAction: ${decision.nextAction}`] : []),
      `[sdd-forge] final regression end result=${resultStatus}`,
    ]);
    fs.writeFileSync(attemptPath, rawLines.join("\n") + "\n");

    const artifact = new FinalRegressionArtifact({
      result: resultStatus,
      command: commandText,
      commandSource: rootCommand?.source || null,
      rawOutputPath: rawOutputPathRelative,
      rawOutputLines: range,
      process: new FinalRegressionProcess(result),
      changedFiles,
      decision,
    });
    const json = artifact.toJSON();
    validateFinalRegressionResult(json);
    fs.writeFileSync(resultPath, JSON.stringify(json, null, 2) + "\n");

    const envelopeArtifacts = artifact.toEnvelopeArtifacts(resultPathRelative);
    if (resultStatus === "pass") {
      return {
        result: "pass",
        changed: [
          resultPathRelative,
          rawOutputPathRelative,
        ],
        artifacts: envelopeArtifacts,
        next: "finalize-commit",
      };
    }

    writeFinalRegressionProgressLine(`result artifact: ${resultPathRelative}`);
    writeFinalRegressionProgressLine(`wrote raw log: ${rawOutputPathRelative}`);
    recordFinalRegressionFailure(root, state, json);
    return Envelope.fail(
      "run",
      "final-regression",
      "FINAL_REGRESSION_FAILED",
      `final-regression failed (${failureKind}); nextAction=${decision.nextAction}`,
      envelopeArtifacts,
    );
  }
}
