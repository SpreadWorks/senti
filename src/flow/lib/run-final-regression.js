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
import { sentiOutputDir } from "../../lib/config.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import {
  FINAL_REGRESSION_RESULT_FILE,
  TESTS_RAW_DIR_RELATIVE,
  matchUpgradeRequiredSourcePaths,
  validateFinalRegressionResult,
  validateUpgradeEvidenceForGate,
} from "./test-artifacts.js";
import { contractFromFinalRegressionArtifact } from "./flow-judgment-contract.js";
import {
  classifyRegression,
  commandIdentityFor,
  DEFAULT_PROCESS_HEARTBEAT_MS,
  discoverRegressionCommand,
  formatElapsedMs,
  listRegressionChangedFiles,
  processOutputLines,
  processPassed,
  resolveTestTimeoutSeconds,
  runProcessDetailed,
  withChangedFileFingerprints,
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
const SKIP_KINDS = Object.freeze({
  COVERED_BY_TEST_EXECUTE: "covered_by_test_execute_full_regression",
  RISK_BASED_STATIC_PROOF: "risk_based_static_proof",
});
const SENSITIVE_PATH_CLASSES = Object.freeze([
  "package-config",
  "test-runner",
  "dependency",
  "runtime-source",
  "external-integration",
  "unknown",
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

  static skipped() {
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

class FinalRegressionSkipProof {
  constructor({ kind, data }) {
    if (!Object.values(SKIP_KINDS).includes(kind)) throw new Error(`unknown final-regression skip kind: ${kind}`);
    this.kind = kind;
    Object.assign(this, data);
    Object.freeze(this);
  }

  toJSON() {
    return { ...this };
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
    skipKind = null,
    reason = null,
    proof = null,
  }) {
    if (!["pass", "fail", "skipped"].includes(result)) throw new Error("final-regression result must be pass, fail, or skipped");
    if (!(decision instanceof FinalRegressionDecision)) throw new Error("final-regression decision is required");
    if (result === "skipped" && !Object.values(SKIP_KINDS).includes(skipKind)) throw new Error("final-regression skipped artifact requires skipKind");
    this.version = "1";
    this.completed = result === "pass" || result === "skipped";
    this.result = result;
    this.failureKind = decision.failureKind;
    this.skipKind = skipKind;
    this.reason = reason;
    this.command = command;
    this.commandSource = commandSource;
    this.rawOutputPath = rawOutputPath;
    this.rawOutputLines = rawOutputLines;
    this.process = process;
    this.changedFiles = Object.freeze([...(changedFiles || [])]);
    this.retryable = decision.retryable;
    this.nextAction = decision.nextAction;
    this.proof = proof;
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      completed: this.completed,
      result: this.result,
      failureKind: this.failureKind,
      ...(this.skipKind ? { skipKind: this.skipKind } : {}),
      ...(this.reason ? { reason: this.reason } : {}),
      command: this.command,
      commandSource: this.commandSource,
      rawOutputPath: this.rawOutputPath,
      rawOutputLines: this.rawOutputLines,
      process: this.process.toJSON(),
      changedFiles: this.changedFiles,
      retryable: this.retryable,
      nextAction: this.nextAction,
      ...(this.proof ? { proof: this.proof.toJSON() } : {}),
    };
  }

  toEnvelopeArtifacts(resultPath) {
    return {
      result_path: resultPath,
      raw_output_path: this.rawOutputPath,
      completed: this.completed,
      result: this.result,
      failureKind: this.failureKind,
      ...(this.skipKind ? { skipKind: this.skipKind } : {}),
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
  process.stderr.write(`[senti] final-regression ${message}\n`);
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
  const analysisPath = path.join(sentiOutputDir(root), "analysis.json");
  if (!fs.existsSync(analysisPath)) return null;
  return JSON.parse(fs.readFileSync(analysisPath, "utf8"));
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sortedPrimitiveObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]));
}

function primitiveObjectEqual(a, b) {
  const left = sortedPrimitiveObject(a);
  const right = sortedPrimitiveObject(b);
  if (!left || !right) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.hasOwn(right, key)) return false;
    const lv = left[key];
    const rv = right[key];
    if (lv !== null && !["string", "number", "boolean"].includes(typeof lv)) return false;
    if (rv !== null && !["string", "number", "boolean"].includes(typeof rv)) return false;
    if (lv !== rv) return false;
  }
  return true;
}

function argvEqual(a, b) {
  return Array.isArray(a)
    && Array.isArray(b)
    && a.length === b.length
    && a.every((entry, index) => typeof entry === "string" && entry === b[index]);
}

function commandIdentityEqual(a, b) {
  if (!a || !b) return false;
  for (const key of ["command", "commandSource", "source", "resolvedScriptDigest", "resolvedConfigDigest"]) {
    if (a[key] !== b[key]) return false;
  }
  return argvEqual(a.argv, b.argv)
    && primitiveObjectEqual(a.env, b.env)
    && primitiveObjectEqual(a.metadata, b.metadata);
}

function fingerprintSet(files = []) {
  return files.map((entry) => ({
    path: entry.path,
    fingerprint: entry.fingerprint,
  })).sort((a, b) => a.path.localeCompare(b.path));
}

function fingerprintSetsEqual(a, b) {
  return JSON.stringify(fingerprintSet(a)) === JSON.stringify(fingerprintSet(b));
}

function testExecuteArtifactPath(specDir) {
  return path.join(specDir, "test-execute-result.json");
}

function currentChangedFilesWithFingerprints(root, changedFiles) {
  return withChangedFileFingerprints(root, changedFiles);
}

function coveredByTestExecuteDecision({ root, specDir, testExecute, commandIdentity, triggerRelevantChangedFiles }) {
  const regression = testExecute?.regression;
  if (testExecute?.version !== "2") return null;
  if (!regression || regression.required !== true || regression.mode !== "full" || regression.result !== "pass") return null;
  const evidenceIdentity = {
    command: regression.command,
    commandSource: regression.commandSource,
    argv: regression.argv,
    env: regression.env,
    source: regression.source,
    metadata: regression.metadata,
    resolvedScriptDigest: regression.resolvedScriptDigest,
    resolvedConfigDigest: regression.resolvedConfigDigest,
  };
  if (!commandIdentityEqual(commandIdentity, evidenceIdentity)) return null;
  const evidenceFingerprints = regression.trigger_relevant_changed_files || [];
  if (!fingerprintSetsEqual(triggerRelevantChangedFiles, evidenceFingerprints)) return null;
  return {
    skipKind: SKIP_KINDS.COVERED_BY_TEST_EXECUTE,
    reason: "same-flow full regression evidence already covers current trigger-relevant changes",
    changedFiles: triggerRelevantChangedFiles,
    proof: new FinalRegressionSkipProof({
      kind: SKIP_KINDS.COVERED_BY_TEST_EXECUTE,
      data: {
        reusedArtifactPath: repoRelative(root, testExecuteArtifactPath(specDir)),
        commandIdentity,
        changedFileFingerprints: fingerprintSet(triggerRelevantChangedFiles),
        staleCheck: {
          sameFlow: true,
          commandIdentityMatched: true,
          changedFileFingerprintsMatched: true,
        },
      },
    }),
  };
}

function isCurrentSpecArtifactPath(filePath, specDirRelative) {
  const normalized = path.posix.normalize(filePath);
  return normalized === filePath && normalized.startsWith(`${specDirRelative}/`);
}

function isExplicitDocsPath(filePath) {
  const base = path.posix.basename(filePath);
  if (!/\.(md|mdx)$/i.test(base)) return false;
  return !filePath.includes("/") || filePath.startsWith("docs/");
}

function isFlowPromptPath(filePath) {
  return filePath.startsWith("src/flow/prompts/");
}

function isGenericTestOnlyPath(filePath) {
  return filePath.startsWith("tests/")
    || filePath.startsWith("test/")
    || /\.test\.js$/i.test(filePath)
    || /\.spec\.js$/i.test(filePath);
}

function exactEvidenceContainsPathFingerprint(regression, pathFingerprint) {
  return Array.isArray(regression?.changed_files)
    && regression.changed_files.some((entry) =>
      entry?.path === pathFingerprint.path && entry?.fingerprint === pathFingerprint.fingerprint,
    );
}

function hasTestExecuteCoverage(testExecute, pathFingerprint) {
  const regression = testExecute?.regression;
  return testExecute?.version === "2"
    && regression?.result === "pass"
    && ["targeted", "full"].includes(regression?.mode)
    && exactEvidenceContainsPathFingerprint(regression, pathFingerprint);
}

function riskCategoryForPath({ filePath, specDirRelative, upgradePaths, testExecute, fingerprintEntry }) {
  if (isCurrentSpecArtifactPath(filePath, specDirRelative)) return "spec-artifact-only";
  if (isExplicitDocsPath(filePath)) return "docs-only";
  if (isFlowPromptPath(filePath)) return "flow-prompt";
  if (upgradePaths.includes(filePath)) return "upgrade-source";
  if (isGenericTestOnlyPath(filePath) && hasTestExecuteCoverage(testExecute, fingerprintEntry)) return "test-only";
  return null;
}

function riskBasedSkipDecision({ root, state, specDir, changedFiles, testExecute }) {
  if (!changedFiles.length) return null;
  const specDirRelative = path.posix.dirname(state.spec.split(path.sep).join("/"));
  const fingerprinted = currentChangedFilesWithFingerprints(root, changedFiles);
  const normalizedPaths = fingerprinted.map((entry) => entry.path);
  const upgradePaths = matchUpgradeRequiredSourcePaths(normalizedPaths);
  const upgradeEvidence = validateUpgradeEvidenceForGate({
    root,
    specDir,
    baseBranch: state.baseBranch || "main",
    currentRequiredPaths: upgradePaths,
  });
  if (upgradePaths.length > 0 && !upgradeEvidence.ok) return null;

  const allowlistClassifications = [];
  for (const entry of fingerprinted) {
    const category = riskCategoryForPath({
      filePath: entry.path,
      specDirRelative,
      upgradePaths,
      testExecute,
      fingerprintEntry: entry,
    });
    if (!category) return null;
    allowlistClassifications.push({
      path: entry.path,
      category,
      fingerprint: entry.fingerprint,
    });
  }
  return {
    skipKind: SKIP_KINDS.RISK_BASED_STATIC_PROOF,
    reason: "all changed paths are explicit non-runtime paths with required evidence",
    changedFiles: fingerprinted,
    proof: new FinalRegressionSkipProof({
      kind: SKIP_KINDS.RISK_BASED_STATIC_PROOF,
      data: {
        allowlistClassifications,
        checkedSensitivePathClasses: [...SENSITIVE_PATH_CLASSES],
        failClosedDecision: { eligible: true, fallbackReasons: [] },
        upgradeEvidencePath: upgradePaths.length > 0 ? repoRelative(root, path.join(specDir, "upgrade-result.json")) : null,
        testExecuteEvidencePath: allowlistClassifications.some((entry) => entry.category === "test-only")
          ? repoRelative(root, testExecuteArtifactPath(specDir))
          : null,
      },
    }),
  };
}

function finalRegressionSkipDecision({ root, state, config, specDir, changedFiles, rootCommand }) {
  const testExecute = readJsonIfExists(testExecuteArtifactPath(specDir));
  const commandIdentity = commandIdentityFor(rootCommand).toJSON();
  const analysis = readAnalysisIfExists(root);
  const classification = classifyRegression({ root, state, analysis, config, changedFiles });
  const triggerRelevantChangedFiles = currentChangedFilesWithFingerprints(root, classification.triggerRelevantChangedFiles);
  return coveredByTestExecuteDecision({
    root,
    specDir,
    testExecute,
    commandIdentity,
    triggerRelevantChangedFiles,
  }) || riskBasedSkipDecision({
    root,
    state,
    specDir,
    changedFiles,
    testExecute,
  });
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

function listFilesRecursive(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFilesRecursive(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function expandChangedFileEntries(root, changedFiles) {
  const expanded = [];
  for (const entry of changedFiles || []) {
    const relPath = changedFilePath(entry);
    if (!relPath) continue;
    const normalized = relPath.split(path.sep).join("/");
    const absolute = path.join(root, normalized);
    if ((normalized.endsWith("/") || fs.existsSync(absolute) && fs.statSync(absolute).isDirectory())) {
      for (const file of listFilesRecursive(absolute)) {
        expanded.push({
          ...entry,
          path: repoRelative(root, file),
        });
      }
    } else {
      expanded.push({ ...entry, path: normalized });
    }
  }
  return expanded;
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
    let skipDecision = null;
    let commandSource = null;

    if (rootOk) {
      changedFiles = expandChangedFileEntries(root, listRegressionChangedFiles({ root, state }));
      try {
        rootCommand = discoverRegressionCommand(root, config);
        commandText = rootCommand.toString();
        commandSource = commandIdentityFor(rootCommand).commandSource;
        skipDecision = finalRegressionSkipDecision({ root, state, config, specDir, changedFiles, rootCommand });
        if (skipDecision) {
          result = {
            started: false,
            exitCode: null,
            signal: null,
            timedOut: false,
            spawnError: null,
            stdout: "",
            stderr: "",
          };
          resultStatus = "skipped";
          failureKind = null;
        } else {
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
        }
      } catch (err) {
        discoveryError = err;
        result = FinalRegressionProcessResultFactory.commandDiscovery(err);
      }
      if (!skipDecision) {
        resultStatus = !discoveryError && processPassed(result) ? "pass" : "fail";
        failureKind = resultStatus === "pass"
          ? null
          : classifyFailure({ result, discoveryError, root, state, config, changedFiles });
      }
    } else {
      result = FinalRegressionProcessResultFactory.rootMismatch(
        `final-regression worktree root mismatch: expected ${expectedRootPath || "<unresolved>"}, got ${rootPath}`,
      );
      resultStatus = "fail";
      failureKind = FAILURE_KINDS.INFRA;
    }

    const decision = resultStatus === "pass"
      ? FinalRegressionDecision.pass()
      : resultStatus === "skipped"
        ? FinalRegressionDecision.skipped()
        : FinalRegressionDecision.fail(failureKind, previousFailures.length);

    let range;
    if (resultStatus === "skipped") {
      const start = rawLines.length + 1;
      rawLines.push(
        `[senti] final regression skipped`,
        `command: ${commandText || "<unresolved>"}`,
        ...(commandSource ? [`commandSource: ${commandSource}`] : []),
        `result: skipped`,
        `skipKind: ${skipDecision.skipKind}`,
        `reason: ${skipDecision.reason}`,
        `nextAction: ${decision.nextAction}`,
      );
      range = { start, end: rawLines.length };
    } else {
      range = appendRaw(rawLines, [
        `[senti] final regression start command=${commandText || "<unresolved>"}`,
        `command: ${commandText || "<unresolved>"}`,
        ...(commandSource ? [`commandSource: ${commandSource}`] : []),
        ...processOutputLines(result),
        `result: ${resultStatus}`,
        ...(failureKind ? [`failureKind: ${failureKind}`, `retryable: ${decision.retryable}`, `nextAction: ${decision.nextAction}`] : []),
        `[senti] final regression end result=${resultStatus}`,
      ]);
    }
    fs.writeFileSync(attemptPath, rawLines.join("\n") + "\n");

    const artifact = new FinalRegressionArtifact({
      result: resultStatus,
      command: commandText,
      commandSource,
      rawOutputPath: rawOutputPathRelative,
      rawOutputLines: range,
      process: new FinalRegressionProcess(result),
      changedFiles: skipDecision?.changedFiles || changedFiles,
      decision,
      skipKind: skipDecision?.skipKind || null,
      reason: skipDecision?.reason || null,
      proof: skipDecision?.proof || null,
    });
    const json = artifact.toJSON();
    json.contractSummary = contractFromFinalRegressionArtifact(json, {
      artifactPath: resultPathRelative,
    }).summary.toJSON();
    validateFinalRegressionResult(json);
    fs.writeFileSync(resultPath, JSON.stringify(json, null, 2) + "\n");

    const envelopeArtifacts = artifact.toEnvelopeArtifacts(resultPathRelative);
    if (resultStatus === "pass" || resultStatus === "skipped") {
      return {
        result: resultStatus,
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
