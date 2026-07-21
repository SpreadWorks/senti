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
  NO_SUPPORTED_REGRESSION_COMMAND,
  processOutputLines,
  processPassed,
  resolveTestTimeoutSeconds,
  runProcessDetailed,
  withChangedFileFingerprints,
} from "./test-regression.js";
import { appendIssueLogEntry, loadIssueLog } from "./set-issue-log.js";
import {
  assertRepairFingerprint,
  buildRepairFingerprint,
  ensureRepairFingerprintContract,
} from "./impl-repair-artifacts.js";

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
const FAILURE_CATEGORIES = Object.freeze({
  CURRENT_CHANGE: "caused_by_current_change",
  EXISTING: "existing_failure",
  ENVIRONMENT: "environment",
  SANDBOX: "sandbox",
  TIMEOUT: "timeout",
  DEPENDENCY: "dependency",
  OUT_OF_SCOPE: "out_of_scope",
  FLAKY_SUSPECTED: "flaky_suspected",
});
const NEXT_RECOMMENDED_ACTIONS = Object.freeze({
  FIX_AND_RERUN: "fix-and-rerun",
  RECORD_AND_PROCEED: "record-and-proceed",
  STOP: "stop",
});
const RECORD_AND_PROCEED_CATEGORIES = new Set([
  FAILURE_CATEGORIES.EXISTING,
  FAILURE_CATEGORIES.ENVIRONMENT,
  FAILURE_CATEGORIES.SANDBOX,
  FAILURE_CATEGORIES.TIMEOUT,
  FAILURE_CATEGORIES.DEPENDENCY,
  FAILURE_CATEGORIES.OUT_OF_SCOPE,
  FAILURE_CATEGORIES.FLAKY_SUSPECTED,
]);
const EXPLICIT_RECORD_CATEGORIES = new Set([
  FAILURE_CATEGORIES.OUT_OF_SCOPE,
  FAILURE_CATEGORIES.FLAKY_SUSPECTED,
]);
const FIX_ATTEMPT_SCAN_LIMIT = 10_000;
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
const ZERO_TEST_SUMMARY_LINE = /^(?:unit|integration|acceptance):\s*0$|^#\s*(?:tests|suites|pass|fail|cancelled|skipped|todo)\s+0$/i;
const GENERIC_COMMAND_FAILURE_LINE = /^command failed(?::|\s)/i;
export const FINAL_REGRESSION_HEARTBEAT_MS = DEFAULT_PROCESS_HEARTBEAT_MS;

class TextFailureClassifier {
  constructor(pattern, FailureClass) {
    this.pattern = pattern;
    this.FailureClass = FailureClass;
    Object.freeze(this);
  }

  classify(text) {
    return this.pattern.test(text) ? new this.FailureClass() : null;
  }
}
const SKIP_KINDS = Object.freeze({
  COVERED_BY_TEST_EXECUTE: "covered_by_test_execute_full_regression",
  RISK_BASED_STATIC_PROOF: "risk_based_static_proof",
  SKIPPED_BY_PROJECT_POLICY: "skipped_by_project_policy",
});
const SENSITIVE_PATH_CLASSES = Object.freeze([
  "package-config",
  "test-runner",
  "dependency",
  "runtime-source",
  "external-integration",
  "unknown",
]);

export class FinalRegressionRecoveryPolicy {
  constructor({ kind, retryable, nextAction, resumeInstruction = null }) {
    if (new.target === FinalRegressionRecoveryPolicy) {
      throw new Error("FinalRegressionRecoveryPolicy is abstract");
    }
    if (typeof kind !== "string" || kind.length === 0) throw new Error("final-regression recovery kind is required");
    if (typeof retryable !== "boolean") throw new Error("final-regression recovery retryable must be boolean");
    if (typeof nextAction !== "string" || nextAction.length === 0) throw new Error("final-regression recovery nextAction is required");
    if (resumeInstruction != null && (typeof resumeInstruction !== "string" || resumeInstruction.length === 0)) {
      throw new Error("final-regression resumeInstruction must be a non-empty string");
    }
    this.kind = kind;
    this.retryable = retryable;
    this.nextAction = nextAction;
    this.resumeInstruction = resumeInstruction;
  }

  toJSON() {
    return {
      kind: this.kind,
      retryable: this.retryable,
      nextAction: this.nextAction,
      ...(this.resumeInstruction ? { resumeInstruction: this.resumeInstruction } : {}),
    };
  }
}

class RepairRecoveryPolicy extends FinalRegressionRecoveryPolicy {
  constructor() {
    super({ kind: "repair", retryable: true, nextAction: "regression-repair" });
    Object.freeze(this);
  }
}

class ConfirmationRecoveryPolicy extends FinalRegressionRecoveryPolicy {
  constructor() {
    super({
      kind: "awaiting-decision",
      retryable: false,
      nextAction: "user-confirmation",
      resumeInstruction: "Record whether the existing regression failure may be accepted, then resume final-regression.",
    });
    Object.freeze(this);
  }
}

export class ResumeRecoveryPolicy extends FinalRegressionRecoveryPolicy {
  constructor({ nextAction = "stop", retryable = false, resumeInstruction }) {
    super({ kind: "resume", retryable, nextAction, resumeInstruction });
    Object.freeze(this);
  }
}

export class FinalRegressionFailure {
  constructor({ kind, recoveryPolicy }) {
    if (new.target === FinalRegressionFailure) throw new Error("FinalRegressionFailure is abstract");
    if (!Object.values(FAILURE_KINDS).includes(kind)) throw new Error(`unknown final-regression failure kind: ${kind}`);
    if (!(recoveryPolicy instanceof FinalRegressionRecoveryPolicy)) {
      throw new Error("final-regression recovery policy is required");
    }
    this.kind = kind;
    this.recoveryPolicy = recoveryPolicy;
    Object.freeze(this);
  }
}

class CurrentChangeRegressionFailure extends FinalRegressionFailure {
  constructor() {
    super({ kind: FAILURE_KINDS.CURRENT_CHANGE, recoveryPolicy: new RepairRecoveryPolicy() });
  }
}

class ExistingRegressionFailure extends FinalRegressionFailure {
  constructor() {
    super({ kind: FAILURE_KINDS.UNATTRIBUTED_EXISTING, recoveryPolicy: new ConfirmationRecoveryPolicy() });
  }
}

class InfrastructureRegressionFailure extends FinalRegressionFailure {
  constructor() {
    super({
      kind: FAILURE_KINDS.INFRA,
      recoveryPolicy: new ResumeRecoveryPolicy({
        resumeInstruction: "Repair the regression runner infrastructure, then retry final-regression.",
      }),
    });
  }
}

export class TimeoutRegressionFailure extends FinalRegressionFailure {
  constructor() {
    super({
      kind: FAILURE_KINDS.TIMEOUT,
      recoveryPolicy: new ResumeRecoveryPolicy({
        resumeInstruction: "Resolve the timeout or adjust the configured timeout, then retry final-regression.",
      }),
    });
  }
}

export class DependencyRegressionFailure extends FinalRegressionFailure {
  constructor() {
    super({
      kind: FAILURE_KINDS.DEPENDENCY,
      recoveryPolicy: new ResumeRecoveryPolicy({
        resumeInstruction: "Install or restore the missing dependency, then retry final-regression.",
      }),
    });
  }
}

export class SandboxRegressionFailure extends FinalRegressionFailure {
  constructor(kind = FAILURE_KINDS.SANDBOX) {
    super({
      kind,
      recoveryPolicy: new ResumeRecoveryPolicy({
        resumeInstruction: "Grant the required sandbox capability or use an allowed execution environment, then retry final-regression.",
      }),
    });
  }
}

class ChildProcessEpermRegressionFailure extends SandboxRegressionFailure {
  constructor() {
    super(FAILURE_KINDS.CHILD_PROCESS_EPERM);
  }
}

export class PermissionRegressionFailure extends FinalRegressionFailure {
  constructor() {
    super({
      kind: FAILURE_KINDS.PERMISSION,
      recoveryPolicy: new ResumeRecoveryPolicy({
        resumeInstruction: "Grant the required permission, then retry final-regression.",
      }),
    });
  }
}

export class InvalidCommandRegressionFailure extends FinalRegressionFailure {
  constructor() {
    super({
      kind: FAILURE_KINDS.INVALID_PROJECT_TEST,
      recoveryPolicy: new ResumeRecoveryPolicy({
        nextAction: "test-repair",
        retryable: true,
        resumeInstruction: "Configure a valid project regression command, then retry final-regression.",
      }),
    });
  }
}

const TEXT_FAILURE_CLASSIFIERS = Object.freeze([
  new TextFailureClassifier(/\beperm\b/, ChildProcessEpermRegressionFailure),
  new TextFailureClassifier(/sandbox/, SandboxRegressionFailure),
  new TextFailureClassifier(/\beacces\b|permission denied/, PermissionRegressionFailure),
  new TextFailureClassifier(/\benoent\b|not found|command not found/, DependencyRegressionFailure),
  new TextFailureClassifier(/without stdout\/stderr|spawnerror/, InfrastructureRegressionFailure),
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
      nextAction: "report",
    });
  }

  static skipped() {
    return new FinalRegressionDecision({
      failureKind: null,
      retryable: false,
      nextAction: "report",
    });
  }

  static fail(failure, previousFailureCount) {
    if (!(failure instanceof FinalRegressionFailure)) throw new Error("FinalRegressionFailure is required");
    const policy = failure.recoveryPolicy;
    const retryable = policy.retryable && previousFailureCount === 0;
    return new FinalRegressionDecision({
      failureKind: failure.kind,
      retryable,
      nextAction: policy.retryable && !retryable ? "stop" : policy.nextAction,
    });
  }
}

class FinalRegressionFailureProfile {
  constructor({ failure, process, fixAttempts, autoApprove = false, canValidateProceed = true }) {
    if (!(failure instanceof FinalRegressionFailure)) throw new Error("FinalRegressionFailure is required");
    this.failureKind = failure.kind;
    this.recoveryPolicy = failure.recoveryPolicy;
    this.failureCategory = failureCategoryFor(failure.kind);
    this.failureNature = failureNatureFor(failure.kind, process);
    this.fixAttempts = fixAttempts;
    this.recordAndProceedEligible = canValidateProceed && recordAndProceedEligibleFor(this.failureCategory, failure.kind);
    this.nextRecommendedAction = nextRecommendedActionFor({
      failureKind: failure.kind,
      eligible: this.recordAndProceedEligible,
      fixAttempts,
    });
    this.selectedAction = autoApprove ? this.nextRecommendedAction : null;
    Object.freeze(this);
  }

  recordAndProceedEvidence() {
    const validated = this.selectedAction === NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED;
    return {
      eligible: this.recordAndProceedEligible,
      validated,
      evidence: validated ? `autoApprove selected record-and-proceed for ${this.failureCategory}` : null,
    };
  }

  remainingRisk() {
    return this.selectedAction === NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED
      ? `final-regression remains failed; category=${this.failureCategory}`
      : null;
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
    commandIdentity = null,
    changedFileFingerprints = [],
    failureProfile = null,
    failureSummary = null,
    selectedAction = null,
    remainingRisk = null,
  }) {
    if (!["pass", "fail", "skipped"].includes(result)) throw new Error("final-regression result must be pass, fail, or skipped");
    if (!(decision instanceof FinalRegressionDecision)) throw new Error("final-regression decision is required");
    if (result === "skipped" && !Object.values(SKIP_KINDS).includes(skipKind)) throw new Error("final-regression skipped artifact requires skipKind");
    this.version = "1";
    const autoRecorded = result === "fail" && failureProfile?.selectedAction === NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED;
    this.completed = result === "pass" || result === "skipped" || autoRecorded;
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
    this.commandIdentity = commandIdentity;
    this.changedFileFingerprints = Object.freeze(fingerprintSet(changedFileFingerprints));
    this.retryable = autoRecorded ? false : decision.retryable;
    this.nextAction = autoRecorded ? "report" : decision.nextAction;
    this.nextRecommendedAction = failureProfile?.nextRecommendedAction || (result === "fail" ? NEXT_RECOMMENDED_ACTIONS.STOP : null);
    this.failureCategory = failureProfile?.failureCategory || null;
    this.failureNature = failureProfile?.failureNature || null;
    this.recoveryPolicy = failureProfile?.recoveryPolicy || null;
    this.fixAttempts = failureProfile?.fixAttempts ?? 0;
    this.recordAndProceed = failureProfile?.recordAndProceedEvidence() || null;
    this.selectedAction = selectedAction ?? failureProfile?.selectedAction ?? null;
    this.remainingRisk = remainingRisk || failureProfile?.remainingRisk() || null;
    this.failureSummary = failureSummary;
    this.currentDiffRelationship = this.failureCategory === FAILURE_CATEGORIES.CURRENT_CHANGE ? "current-diff" : "non-current-diff";
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
      ...(this.commandIdentity ? { commandIdentity: this.commandIdentity } : {}),
      changedFileFingerprints: this.changedFileFingerprints,
      retryable: this.retryable,
      nextAction: this.nextAction,
      ...(this.nextRecommendedAction ? { nextRecommendedAction: this.nextRecommendedAction } : {}),
      ...(this.failureCategory ? { failureCategory: this.failureCategory } : {}),
      ...(this.failureNature ? { failureNature: this.failureNature } : {}),
      ...(this.recoveryPolicy ? { recoveryPolicy: this.recoveryPolicy.toJSON() } : {}),
      ...(this.result === "fail" ? { fixAttempts: this.fixAttempts } : {}),
      ...(this.recordAndProceed ? { recordAndProceed: this.recordAndProceed } : {}),
      ...(this.selectedAction ? { selectedAction: this.selectedAction } : {}),
      ...(this.remainingRisk ? { remainingRisk: this.remainingRisk } : {}),
      ...(this.failureSummary ? { failureSummary: this.failureSummary } : {}),
      ...(this.result === "fail" ? { currentDiffRelationship: this.currentDiffRelationship } : {}),
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
      ...(this.failureCategory ? { failureCategory: this.failureCategory } : {}),
      ...(this.recoveryPolicy ? { recoveryPolicy: this.recoveryPolicy.toJSON() } : {}),
      ...(this.skipKind ? { skipKind: this.skipKind } : {}),
      retryable: this.retryable,
      nextAction: this.nextAction,
      ...(this.nextRecommendedAction ? { nextRecommendedAction: this.nextRecommendedAction } : {}),
      ...(this.selectedAction ? { selectedAction: this.selectedAction } : {}),
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

function failureCategoryFor(failureKind) {
  if (failureKind === FAILURE_KINDS.CURRENT_CHANGE) return FAILURE_CATEGORIES.CURRENT_CHANGE;
  if (failureKind === FAILURE_KINDS.UNATTRIBUTED_EXISTING) return FAILURE_CATEGORIES.EXISTING;
  if (failureKind === FAILURE_KINDS.TIMEOUT) return FAILURE_CATEGORIES.TIMEOUT;
  if (failureKind === FAILURE_KINDS.DEPENDENCY) return FAILURE_CATEGORIES.DEPENDENCY;
  if (failureKind === FAILURE_KINDS.SANDBOX || failureKind === FAILURE_KINDS.CHILD_PROCESS_EPERM) return FAILURE_CATEGORIES.SANDBOX;
  if (failureKind === FAILURE_KINDS.PERMISSION || failureKind === FAILURE_KINDS.INFRA || failureKind === FAILURE_KINDS.INVALID_PROJECT_TEST) {
    return FAILURE_CATEGORIES.ENVIRONMENT;
  }
  return FAILURE_CATEGORIES.ENVIRONMENT;
}

function failureNatureFor(failureKind, process) {
  if (failureKind === FAILURE_KINDS.UNATTRIBUTED_EXISTING || failureKind === FAILURE_KINDS.CURRENT_CHANGE) return "assertion";
  if (process?.started === false || process?.spawnError || process?.timedOut) return "execution";
  return "execution";
}

function recordAndProceedEligibleFor(category, failureKind) {
  if (
    failureKind === FAILURE_KINDS.INVALID_PROJECT_TEST
    || failureKind === FAILURE_KINDS.CURRENT_CHANGE
    || failureKind === FAILURE_KINDS.INFRA
  ) return false;
  return RECORD_AND_PROCEED_CATEGORIES.has(category);
}

function nextRecommendedActionFor({ failureKind, eligible, fixAttempts }) {
  if (!eligible) return FAILURE_NEXT_ACTION[failureKind] === "stop" ? NEXT_RECOMMENDED_ACTIONS.STOP : NEXT_RECOMMENDED_ACTIONS.FIX_AND_RERUN;
  return fixAttempts > 0 ? NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED : NEXT_RECOMMENDED_ACTIONS.FIX_AND_RERUN;
}

function failureSummaryFor(result, failureKind) {
  const lines = (firstAssertionFailureBlockLines(result) || processOutputLines(result))
    .filter((line) => String(line).trim().length > 0);
  const text = lines.slice(0, 8).join("\n").trim();
  return boundedText(text || `final-regression failed: ${failureKind}`, 2000);
}

function testExecuteArtifactPath(specDir) {
  return path.join(specDir, "test-execute-result.json");
}

function currentChangedFilesWithFingerprints(root, changedFiles) {
  return withChangedFileFingerprints(root, changedFiles);
}

function finalRegressionGeneratedPath(filePath, state) {
  const specDirRelative = path.posix.dirname(state.spec.split(path.sep).join("/"));
  return filePath === `${specDirRelative}/final-regression-result.json`
    || filePath === `${specDirRelative}/issue-log.json`
    || filePath === `${specDirRelative}/flow.json`
    || filePath === ".senti/.active-flow"
    || filePath.startsWith(".tmp/logs/")
    || filePath.startsWith(`${specDirRelative}/tests/.raw/final-regression-attempt-`);
}

function finalRegressionFreshnessFiles(changedFiles, state) {
  return (changedFiles || []).filter((entry) => {
    const filePath = changedFilePath(entry);
    return filePath && !finalRegressionGeneratedPath(filePath.split(path.sep).join("/"), state);
  });
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

function projectPolicySkipDecision({ err, changedFiles }) {
  if (err?.code !== NO_SUPPORTED_REGRESSION_COMMAND) return null;
  const reason = err.message || "no supported project-level regression command found";
  return {
    skipKind: SKIP_KINDS.SKIPPED_BY_PROJECT_POLICY,
    reason,
    changedFiles,
    proof: new FinalRegressionSkipProof({
      kind: SKIP_KINDS.SKIPPED_BY_PROJECT_POLICY,
      data: {
        commandDiscovery: {
          checkedSources: [...(err.checkedSources || [])],
          supportedCommandFound: false,
          invalidConfiguredCommand: false,
          reason,
        },
      },
    }),
  };
}

function finalRegressionSkipDecision({ root, state, config, specDir, changedFiles, rootCommand }) {
  const testExecute = readJsonIfExists(testExecuteArtifactPath(specDir));
  if (testExecute) {
    const fingerprint = buildRepairFingerprint({ root, specPath: state.spec, state });
    assertRepairFingerprint({ artifact: testExecute, fingerprint, label: "test-execute-result.json" });
  }
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

function hasOnlyZeroTestSummary(result) {
  const lines = [result?.stdout, result?.stderr]
    .flatMap((value) => String(value ?? "").split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);
  let sawZeroSummary = false;
  for (const line of lines) {
    if (ZERO_TEST_SUMMARY_LINE.test(line)) {
      sawZeroSummary = true;
      continue;
    }
    if (GENERIC_COMMAND_FAILURE_LINE.test(line)) continue;
    return false;
  }
  return sawZeroSummary;
}

function assertionFailureBlocks(result) {
  if (result?.started === false || result?.spawnError || result?.timedOut) return null;
  const lines = processOutputLines(result);
  const starts = lines
    .map((line, index) => /^\s*not ok\s+\d+\s+-/i.test(line) ? index : -1)
    .filter((index) => index !== -1);
  if (starts.length === 0) return null;
  return starts.map((start, blockIndex) => {
    let end = starts[blockIndex + 1] ?? lines.length;
    for (let index = start + 1; index < end; index += 1) {
      if (/^\s*#\s*Subtest:/i.test(lines[index])) {
        end = index;
        break;
      }
    }
    return lines.slice(start, end);
  });
}

function firstAssertionFailureBlockLines(result) {
  return assertionFailureBlocks(result)?.[0] || null;
}

function allAssertionFailureBlockLines(result) {
  return assertionFailureBlocks(result)?.flat() || null;
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

export function classifyFinalRegressionFailure({ result, discoveryError = null, root = null, state = null, config = {}, changedFiles = [] }) {
  const assertionLines = discoveryError ? null : allAssertionFailureBlockLines(result);
  const text = assertionLines ? assertionLines.join("\n") : failureEvidenceText(result, discoveryError);
  const normalizedText = normalizeFailureMatchText(text);
  if (discoveryError) return new InvalidCommandRegressionFailure();
  if (result?.timedOut) return new TimeoutRegressionFailure();
  if (normalizedText.trim() === "" && result?.exitCode) return new InfrastructureRegressionFailure();
  if (result?.exitCode && hasOnlyZeroTestSummary(result)) return new InfrastructureRegressionFailure();
  if (/^command failed:/.test(normalizedText.trim()) && result?.exitCode) return new InfrastructureRegressionFailure();
  for (const classifier of TEXT_FAILURE_CLASSIFIERS) {
    const failure = classifier.classify(normalizedText);
    if (failure) return failure;
  }
  if (result?.signal) return new InfrastructureRegressionFailure();
  if (result?.exitCode === 127) return new DependencyRegressionFailure();
  const changedFilesForMatching = changedFilesWithinMatchLimit(changedFiles);
  if (!changedFilesForMatching || !root || !state) return new InfrastructureRegressionFailure();
  if (classifyChangeScope({ root, state, config, changedFiles }) === "pre-existing") {
    return new ExistingRegressionFailure();
  }
  if (!failureReferencesChangedFile(normalizedText, changedFilesForMatching)) {
    return new ExistingRegressionFailure();
  }
  return new CurrentChangeRegressionFailure();
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

function sameCommandIdentityEntry(entry, commandIdentity) {
  return commandIdentityEqual(entry.commandIdentity, commandIdentity);
}

function countFixAttempts({ failures, commandIdentity, currentFingerprints }) {
  const latest = failures.slice(-FIX_ATTEMPT_SCAN_LIMIT).filter((entry) => sameCommandIdentityEntry(entry, commandIdentity));
  const seen = new Set();
  for (const entry of latest) {
    const fingerprints = Array.isArray(entry.changedFileFingerprints) ? entry.changedFileFingerprints : [];
    if (!fingerprintSetsEqual(fingerprints, currentFingerprints)) {
      seen.add(JSON.stringify(fingerprintSet(fingerprints)));
    }
  }
  return seen.size;
}

function recordFinalRegressionFailure(root, state, artifact) {
  appendIssueLogEntry(root, state.spec, {
    step: "final-regression",
    result: "fail",
    failureKind: artifact.failureKind,
    failureCategory: artifact.failureCategory,
    reason: `final-regression failed: ${artifact.failureKind}`,
    command: artifact.command,
    commandIdentity: artifact.commandIdentity,
    changedFileFingerprints: artifact.changedFileFingerprints,
    rawOutputPath: artifact.rawOutputPath,
    fixAttempts: artifact.fixAttempts,
    retryable: artifact.retryable,
    nextAction: artifact.nextAction,
    nextRecommendedAction: artifact.nextRecommendedAction,
    timestamp: new Date().toISOString(),
  });
}

function recordAndProceedInput(ctx) {
  return ctx.recordAndProceedEvidence || {
    category: ctx.recordAndProceedCategory,
    evidence: ctx.recordAndProceedEvidenceText || ctx.evidence,
    remainingRisk: ctx.remainingRisk,
  };
}

function validateRecordAndProceedInput(input, fallbackCategory) {
  const explicitCategory = typeof input?.category === "string" && input.category.length > 0;
  const category = explicitCategory ? input.category : fallbackCategory;
  const explicitEvidence = typeof input?.evidence === "string" && input.evidence.trim().length > 0;
  const explicitRisk = typeof input?.remainingRisk === "string" && input.remainingRisk.trim().length > 0;
  const evidence = explicitEvidence ? input.evidence : `record-and-proceed selected for ${category}`;
  const remainingRisk = explicitRisk ? input.remainingRisk : `final-regression remains failed; category=${category}`;
  if (!RECORD_AND_PROCEED_CATEGORIES.has(category)) {
    throw new Error(`record-and-proceed category invalid: ${category}`);
  }
  if (EXPLICIT_RECORD_CATEGORIES.has(category) && (!explicitEvidence || !explicitRisk)) {
    throw new Error("record-and-proceed evidence is required for explicit category");
  }
  return { category, evidence, remainingRisk };
}

function recordAndProceedFailure(code, message, data = {}) {
  return Envelope.fail("run", "final-regression", code, message, data);
}

function readCurrentFinalRegressionArtifact(resultPath) {
  if (!fs.existsSync(resultPath) || fs.statSync(resultPath).isDirectory()) {
    return { error: "missing" };
  }
  try {
    return { artifact: validateFinalRegressionResult(JSON.parse(fs.readFileSync(resultPath, "utf8"))) };
  } catch (err) {
    return { error: "invalid", message: err.message };
  }
}

function failedRecordedArtifact(artifact) {
  return artifact?.result === "fail"
    && artifact.completed === true
    && artifact.selectedAction === NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED
    && artifact.recordAndProceed?.validated === true
    && artifact.nextAction === "report";
}

function currentRecordAndProceedEvidence({ root, state, config, specDir }) {
  const changedFiles = finalRegressionFreshnessFiles(
    expandChangedFileEntries(root, listRegressionChangedFiles({ root, state })),
    state,
  );
  const rootCommand = discoverRegressionCommand(root, config);
  const commandIdentity = commandIdentityFor(rootCommand).toJSON();
  const changedFileFingerprints = fingerprintSet(currentChangedFilesWithFingerprints(root, changedFiles));
  return {
    changedFiles,
    command: rootCommand.toString(),
    commandSource: commandIdentity.commandSource,
    commandIdentity,
    changedFileFingerprints,
    resultPath: path.join(specDir, FINAL_REGRESSION_RESULT_FILE),
  };
}

function validateRecordAndProceedFreshness(artifact, current) {
  return commandIdentityEqual(artifact.commandIdentity, current.commandIdentity)
    && fingerprintSetsEqual(artifact.changedFileFingerprints, current.changedFileFingerprints);
}

export default class RunFinalRegressionCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const state = ctx.flowState;
    ensureRepairFingerprintContract({ root, state, flowManager: ctx.flowManager });
    const config = ctx.config || {};
    const specDir = resolveSpecDir(path.resolve(root, state.spec));
    const resultPath = path.join(specDir, FINAL_REGRESSION_RESULT_FILE);
    const resultPathRelative = repoRelative(root, resultPath);
    if (ctx.recordAndProceed) {
      return this.recordAndProceed(ctx, { specDir, resultPath, resultPathRelative });
    }

    const attemptPath = nextFinalRegressionAttempt(specDir);
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
    let failure = null;
    let commandIdentity = null;
    let discoveryError = null;
    let skipDecision = null;
    let commandSource = null;

    if (rootOk) {
        changedFiles = finalRegressionFreshnessFiles(
          expandChangedFileEntries(root, listRegressionChangedFiles({ root, state })),
          state,
        );
      try {
        rootCommand = discoverRegressionCommand(root, config);
        commandText = rootCommand.toString();
        commandIdentity = commandIdentityFor(rootCommand).toJSON();
        commandSource = commandIdentity.commandSource;
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
        skipDecision = projectPolicySkipDecision({ err, changedFiles });
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
        } else {
          discoveryError = err;
          result = FinalRegressionProcessResultFactory.commandDiscovery(err);
        }
      }
      if (!skipDecision) {
        resultStatus = !discoveryError && processPassed(result) ? "pass" : "fail";
        failure = resultStatus === "pass"
          ? null
          : classifyFinalRegressionFailure({ result, discoveryError, root, state, config, changedFiles });
      }
    } else {
      result = FinalRegressionProcessResultFactory.rootMismatch(
        `final-regression worktree root mismatch: expected ${expectedRootPath || "<unresolved>"}, got ${rootPath}`,
      );
      resultStatus = "fail";
      failure = new InfrastructureRegressionFailure();
    }

    const failureKind = failure?.kind || null;
    const decision = resultStatus === "pass"
      ? FinalRegressionDecision.pass()
      : resultStatus === "skipped"
        ? FinalRegressionDecision.skipped()
        : FinalRegressionDecision.fail(failure, previousFailures.length);
    const fingerprintedChangedFiles = skipDecision?.changedFiles || currentChangedFilesWithFingerprints(root, changedFiles);
    const failureProfile = resultStatus === "fail"
      ? new FinalRegressionFailureProfile({
        failure,
        process: new FinalRegressionProcess(result),
        fixAttempts: countFixAttempts({
          failures: previousFailures,
          commandIdentity,
          currentFingerprints: fingerprintedChangedFiles,
        }),
        autoApprove: state.autoApprove === true,
        canValidateProceed: Boolean(commandIdentity) && rootOk,
      })
      : null;

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
      changedFiles: fingerprintedChangedFiles,
      decision,
      skipKind: skipDecision?.skipKind || null,
      reason: skipDecision?.reason || null,
      proof: skipDecision?.proof || null,
      commandIdentity,
      changedFileFingerprints: fingerprintedChangedFiles,
      failureProfile,
      failureSummary: resultStatus === "fail" ? failureSummaryFor(result, failureKind) : null,
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
        next: "report",
      };
    }

    writeFinalRegressionProgressLine(`result artifact: ${resultPathRelative}`);
    writeFinalRegressionProgressLine(`wrote raw log: ${rawOutputPathRelative}`);
    recordFinalRegressionFailure(root, state, json);
    if (failedRecordedArtifact(json)) {
      return {
        result: "fail",
        failedRecorded: true,
        changed: [
          resultPathRelative,
          rawOutputPathRelative,
        ],
        artifacts: {
          ...envelopeArtifacts,
          completed: true,
          nextAction: "report",
          nextRecommendedAction: NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED,
          selectedAction: NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED,
        },
        next: "report",
      };
    }
    return Envelope.fail(
      "run",
      "final-regression",
      "FINAL_REGRESSION_FAILED",
      `final-regression failed (${failureKind}); nextAction=${decision.nextAction}`,
      envelopeArtifacts,
    );
  }

  recordAndProceed(ctx, { specDir, resultPath, resultPathRelative }) {
    const { root } = ctx;
    const state = ctx.flowState;
    const config = ctx.config || {};
    const read = readCurrentFinalRegressionArtifact(resultPath);
    if (read.error === "missing") {
      return recordAndProceedFailure(
        "FINAL_REGRESSION_RECORD_AND_PROCEED_MISSING_ARTIFACT",
        "final-regression failed artifact is missing",
      );
    }
    if (read.error === "invalid") {
      return recordAndProceedFailure(
        "FINAL_REGRESSION_RECORD_AND_PROCEED_INVALID_ARTIFACT",
        `final-regression failed artifact is invalid: ${read.message}`,
      );
    }
    const artifact = read.artifact;
    if (artifact.result !== "fail" || artifact.recordAndProceed?.eligible !== true) {
      return recordAndProceedFailure(
        "FINAL_REGRESSION_RECORD_AND_PROCEED_INELIGIBLE",
        "final-regression artifact is not eligible for record-and-proceed",
      );
    }
    let current;
    try {
      current = currentRecordAndProceedEvidence({ root, state, config, specDir });
    } catch (err) {
      return recordAndProceedFailure(
        "FINAL_REGRESSION_RECORD_AND_PROCEED_INELIGIBLE",
        `final-regression current evidence cannot be validated: ${err.message}`,
      );
    }
    if (!validateRecordAndProceedFreshness(artifact, current)) {
      return recordAndProceedFailure(
        "FINAL_REGRESSION_RECORD_AND_PROCEED_STALE",
        "final-regression failed artifact is stale",
      );
    }

    let input;
    try {
      input = validateRecordAndProceedInput(recordAndProceedInput(ctx), artifact.failureCategory);
    } catch (err) {
      return recordAndProceedFailure(
        "FINAL_REGRESSION_RECORD_AND_PROCEED_INVALID_EVIDENCE",
        err.message,
      );
    }

    const category = input.category || artifact.failureCategory;
    if (!RECORD_AND_PROCEED_CATEGORIES.has(category)) {
      return recordAndProceedFailure(
        "FINAL_REGRESSION_RECORD_AND_PROCEED_INELIGIBLE",
        `final-regression category is not eligible: ${category}`,
      );
    }
    const json = {
      ...artifact,
      completed: true,
      result: "fail",
      failureCategory: category,
      selectedAction: NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED,
      remainingRisk: input.remainingRisk,
      retryable: false,
      nextAction: "report",
      nextRecommendedAction: NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED,
      recordAndProceed: {
        eligible: true,
        validated: true,
        evidence: input.evidence,
      },
      command: current.command,
      commandSource: current.commandSource,
      commandIdentity: current.commandIdentity,
      changedFiles: current.changedFiles,
      changedFileFingerprints: current.changedFileFingerprints,
      currentDiffRelationship: category === FAILURE_CATEGORIES.CURRENT_CHANGE ? "current-diff" : "non-current-diff",
    };
    json.contractSummary = contractFromFinalRegressionArtifact(json, {
      artifactPath: resultPathRelative,
    }).summary.toJSON();
    validateFinalRegressionResult(json);
    fs.writeFileSync(resultPath, JSON.stringify(json, null, 2) + "\n");
    const artifacts = {
      result_path: resultPathRelative,
      raw_output_path: json.rawOutputPath,
      completed: true,
      result: "fail",
      failureKind: json.failureKind,
      failureCategory: json.failureCategory,
      retryable: false,
      nextAction: "report",
      nextRecommendedAction: NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED,
      selectedAction: NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED,
    };
    return {
      result: "fail",
      failedRecorded: true,
      changed: [resultPathRelative],
      artifacts,
      next: "report",
    };
  }
}
