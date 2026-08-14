/**
 * src/flow/lib/run-final-regression.js
 *
 * Final project-level regression runner. Normal test-execute keeps the repair
 * loop focused on spec-local evidence; this command runs the full project
 * command after retro and before finalize.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PRODUCT } from "../../lib/product.js";
import { FlowTargetIdentityAuthority } from "../../lib/flow-target-identity-authority.js";
import { flowStateSpecLocation } from "../../lib/flow-workspace.js";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { loadConfig, managedConfigPath, managedOutputDir } from "../../lib/config.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import {
  FINAL_REGRESSION_RESULT_FILE,
  TESTS_RAW_DIR_RELATIVE,
  validateFinalRegressionResult,
  validateFinalRegressionEvidence,
  validateExplicitFinalRegressionProceed,
  finalRegressionTestCount,
  FinalRegressionRepositoryBinding,
  validateCanonicalUpgradeEvidence,
} from "./test-artifacts.js";
import { contractFromFinalRegressionArtifact } from "./flow-judgment-contract.js";
import {
  ChildProcessExecutionRecord,
  ChildProcessExecutionRecordCodec,
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
import { RepairArtifactRegistry } from "./repair-state-identity.js";
import { recordEligibleNonblockingAttempt } from "./nonblocking.js";
import {
  nextStepAttemptNumber,
  recordStepAttempt,
} from "./step-outcome.js";
import { FINAL_REGRESSION_MAX_ATTEMPTS } from "../../lib/flow-artifact-contract.js";
import {
  CanonicalTestArtifactStore,
  isCanonicalFlowState,
} from "./canonical-test-artifacts.js";
import { attachCanonicalCommandResultArtifact } from "./canonical-command-result.js";

const FAILURE_KINDS = Object.freeze({
  CURRENT_CHANGE: "caused_by_current_change",
  UNATTRIBUTED_EXISTING: "unattributed_existing_failure",
  UNATTRIBUTED_UNKNOWN: "unattributed_unknown_failure",
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
  [FAILURE_KINDS.UNATTRIBUTED_UNKNOWN]: "stop",
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
  UNKNOWN: "unknown",
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
const MAX_FINAL_REGRESSION_RAW_DIR_SCAN_ENTRIES = 10_000;
const ATTEMPT_LIMIT_MESSAGE = `final-regression attempt limit exceeded (max=${FINAL_REGRESSION_MAX_ATTEMPTS})`;
const MAX_CHANGED_FILES_TO_MATCH = 1000;
const MAX_FINAL_REGRESSION_STREAM_BYTES = 1024 * 1024;
export const FINAL_REGRESSION_HEARTBEAT_MS = DEFAULT_PROCESS_HEARTBEAT_MS;
const CHILD_PROCESS_RECORD_CODEC = new ChildProcessExecutionRecordCodec();

function configForAuthorityRoot(root, fallback = {}) {
  return fs.existsSync(managedConfigPath(root)) ? loadConfig(root) : fallback;
}

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
  SKIPPED_BY_PROJECT_POLICY: "skipped_by_project_policy",
});

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

class UnknownRegressionFailure extends FinalRegressionFailure {
  constructor() {
    super({
      kind: FAILURE_KINDS.UNATTRIBUTED_UNKNOWN,
      recoveryPolicy: new ResumeRecoveryPolicy({
        resumeInstruction: "Inspect the preserved child diagnostics and classify or repair the unknown regression failure before retrying.",
      }),
    });
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
  constructor({
    failure,
    process,
    childProcesses = [],
    fixAttempts,
    autoApprove = false,
    canValidateProceed = true,
  }) {
    if (!(failure instanceof FinalRegressionFailure)) throw new Error("FinalRegressionFailure is required");
    this.failureKind = failure.kind;
    this.recoveryPolicy = failure.recoveryPolicy;
    this.failureCategory = failureCategoryFor(failure.kind);
    this.failureNature = failureNatureFor(failure.kind, process, childProcesses);
    this.fixAttempts = fixAttempts;
    this.recordAndProceedEligible = canValidateProceed && recordAndProceedEligibleFor(this.failureCategory, failure.kind);
    this.nextRecommendedAction = nextRecommendedActionFor({
      failureKind: failure.kind,
      eligible: this.recordAndProceedEligible,
      fixAttempts,
    });
    this.selectedAction = null;
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
    childProcesses = [],
    selectedAction = null,
    remainingRisk = null,
    executionBinding = null,
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
    if (childProcesses.some((entry) => !(entry instanceof ChildProcessExecutionRecord))) {
      throw new Error("final-regression childProcesses must contain ChildProcessExecutionRecord values");
    }
    this.childProcesses = Object.freeze([...childProcesses]);
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
    this.executionBinding = executionBinding;
    this.failureSummary = failureSummary;
    this.currentDiffRelationship = this.failureCategory === FAILURE_CATEGORIES.CURRENT_CHANGE
      ? "current-diff"
      : this.failureCategory === FAILURE_CATEGORIES.EXISTING
        ? "non-current-diff"
        : "unknown";
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
      childProcesses: this.childProcesses.map((entry) => entry.toArtifactJSON()),
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
      ...(this.executionBinding ? { executionBinding: this.executionBinding } : {}),
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

class FinalRegressionStreamCapture {
  constructor(content) {
    const bytes = Buffer.from(String(content || ""), "utf8");
    let end = Math.min(bytes.length, MAX_FINAL_REGRESSION_STREAM_BYTES);
    while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
    if (end < bytes.length && end > 0) {
      const lead = bytes[end - 1];
      const width = lead < 0x80 ? 1 : lead < 0xe0 ? 2 : lead < 0xf0 ? 3 : 4;
      if (end - 1 + width > MAX_FINAL_REGRESSION_STREAM_BYTES) end -= 1;
    }
    const captured = bytes.subarray(0, end);
    this.content = captured.toString("utf8");
    this.originalByteLength = bytes.length;
    this.capturedByteLength = captured.length;
    this.truncated = bytes.length > captured.length;
    Object.freeze(this);
  }
  toEvidenceJSON() {
    return {
      originalByteLength: this.originalByteLength,
      capturedByteLength: this.capturedByteLength,
      truncated: this.truncated,
      sha256: crypto.createHash("sha256").update(this.content).digest("hex"),
    };
  }
}

function captureStream(content) {
  return new FinalRegressionStreamCapture(content);
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
  process.stderr.write(`[sennel] final-regression ${message}\n`);
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
  const analysisPath = path.join(managedOutputDir(root), "analysis.json");
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
  if (failureKind === FAILURE_KINDS.UNATTRIBUTED_UNKNOWN) return FAILURE_CATEGORIES.UNKNOWN;
  if (failureKind === FAILURE_KINDS.TIMEOUT) return FAILURE_CATEGORIES.TIMEOUT;
  if (failureKind === FAILURE_KINDS.DEPENDENCY) return FAILURE_CATEGORIES.DEPENDENCY;
  if (failureKind === FAILURE_KINDS.SANDBOX || failureKind === FAILURE_KINDS.CHILD_PROCESS_EPERM) return FAILURE_CATEGORIES.SANDBOX;
  if (failureKind === FAILURE_KINDS.PERMISSION || failureKind === FAILURE_KINDS.INFRA || failureKind === FAILURE_KINDS.INVALID_PROJECT_TEST) {
    return FAILURE_CATEGORIES.ENVIRONMENT;
  }
  return FAILURE_CATEGORIES.ENVIRONMENT;
}

function failureNatureFor(failureKind, process, childProcesses = []) {
  if (childProcesses.some((entry) => entry.kind === "assertion-failure")) return "assertion";
  if (
    childProcesses.length === 0
    && (failureKind === FAILURE_KINDS.UNATTRIBUTED_EXISTING || failureKind === FAILURE_KINDS.CURRENT_CHANGE)
  ) return "assertion";
  if (process?.started === false || process?.spawnError || process?.timedOut) return "execution";
  return "execution";
}

function recordAndProceedEligibleFor(category, failureKind) {
  if (
    failureKind === FAILURE_KINDS.INVALID_PROJECT_TEST
    || failureKind === FAILURE_KINDS.CURRENT_CHANGE
    || failureKind === FAILURE_KINDS.INFRA
    || failureKind === FAILURE_KINDS.UNATTRIBUTED_UNKNOWN
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

function currentChangedFilesWithFingerprints(root, changedFiles) {
  return withChangedFileFingerprints(root, changedFiles);
}

function finalRegressionGeneratedPath(filePath, state) {
  const location = flowStateSpecLocation(state);
  if (location === null) {
    throw new Error("final-regression freshness requires a manager-bound Version location");
  }
  return filePath.startsWith(`${location.relativeDirectory}/`)
    || filePath === PRODUCT.managedPath(".active-flow")
    || FlowTargetIdentityAuthority.managesRepositoryPath(filePath)
    || filePath.startsWith(".tmp/logs/");
}

function finalRegressionFreshnessFiles(changedFiles, state) {
  return (changedFiles || []).filter((entry) => {
    const filePath = changedFilePath(entry);
    return filePath && !finalRegressionGeneratedPath(filePath.split(path.sep).join("/"), state);
  });
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

function boundedText(value, maxChars) {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  if (maxChars <= 1) return text.slice(0, maxChars);
  const head = Math.floor((maxChars - 1) / 2);
  const tail = maxChars - 1 - head;
  return `${text.slice(0, head)}\n${text.slice(-tail)}`;
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

function hasConcreteUnchangedFailurePath(normalizedText, changedFiles) {
  const changed = new Set(
    (changedFiles || [])
      .map(changedFilePath)
      .filter(Boolean)
      .map((entry) => normalizeFailureMatchText(entry).replace(/^\.\//, "")),
  );
  const matches = normalizedText.matchAll(/\b(?:src|tests)\/[a-z0-9_.\-/]+/g);
  for (const match of matches) {
    const candidate = match[0].replace(/[.,;:)]+$/, "");
    if (!changed.has(candidate)) return true;
  }
  return false;
}

function classifyChildProcessFailure(childProcesses, changedFiles) {
  if (childProcesses.length === 0) return null;
  const failures = childProcesses.filter((entry) => entry.kind !== "passed");
  if (failures.length === 0) return null;
  if (failures.some((entry) => entry.kind === "timeout")) return new TimeoutRegressionFailure();
  const executionFailureText = normalizeFailureMatchText(
    failures
      .flatMap((entry) => [entry.errorCode, entry.spawnError])
      .filter(Boolean)
      .join("\n"),
  );
  for (const classifier of TEXT_FAILURE_CLASSIFIERS) {
    const failure = classifier.classify(executionFailureText);
    if (failure) return failure;
  }
  const normalizedText = normalizeFailureMatchText(
    failures
      .flatMap((entry) => [entry.stdout.content, entry.stderr.content])
      .filter(Boolean)
      .join("\n"),
  );
  if (failures.some((entry) => entry.kind === "signal" || entry.kind === "max-buffer")) {
    return new InfrastructureRegressionFailure();
  }
  const changedFilesForMatching = changedFilesWithinMatchLimit(changedFiles);
  if (!changedFilesForMatching) return new UnknownRegressionFailure();
  if (failureReferencesChangedFile(normalizedText, changedFilesForMatching)) {
    return new CurrentChangeRegressionFailure();
  }
  if (
    failures.some((entry) => entry.kind === "assertion-failure")
    && hasConcreteUnchangedFailurePath(normalizedText, changedFilesForMatching)
  ) {
    return new ExistingRegressionFailure();
  }
  return new UnknownRegressionFailure();
}

function decodeChildProcessRecords(result, rawOutputPath) {
  const text = `${String(result?.stdout || "")}\n${String(result?.stderr || "")}`;
  return CHILD_PROCESS_RECORD_CODEC.decodeAll(text)
    .map((record) => record.withRawOutputPath(rawOutputPath));
}

export function classifyFinalRegressionFailure({
  result,
  discoveryError = null,
  changedFiles = [],
  childProcesses = [],
  childRecordError = null,
}) {
  if (discoveryError) return new InvalidCommandRegressionFailure();
  if (childRecordError) return new InfrastructureRegressionFailure();
  if (result?.timedOut) return new TimeoutRegressionFailure();
  const childFailure = classifyChildProcessFailure(childProcesses, changedFiles);
  if (childProcesses.some((entry) => entry.kind !== "passed") && childFailure) {
    return childFailure;
  }
  if (result?.signal) return new InfrastructureRegressionFailure();
  if (result?.kind === "spawn-error" || result?.kind === "max-buffer" || result?.started === false || result?.spawnError) {
    const processFailureText = normalizeFailureMatchText(
      [result?.errorCode, result?.spawnError].filter(Boolean).join("\n"),
    );
    for (const classifier of TEXT_FAILURE_CLASSIFIERS) {
      const failure = classifier.classify(processFailureText);
      if (failure) return failure;
    }
    return new InfrastructureRegressionFailure();
  }
  if (result?.exitCode === 127) return new DependencyRegressionFailure();
  const output = normalizeFailureMatchText([result?.stdout, result?.stderr].filter(Boolean).join("\n"));
  if (failureReferencesChangedFile(output, changedFiles)) return new CurrentChangeRegressionFailure();
  if (hasConcreteUnchangedFailurePath(output, changedFiles)) return new ExistingRegressionFailure();
  if (childFailure) return childFailure;
  return new UnknownRegressionFailure();
}

function nextFinalRegressionAttempt(specDir) {
  const rawDir = path.join(specDir, TESTS_RAW_DIR_RELATIVE);
  fs.mkdirSync(rawDir, { recursive: true });
  const nextIndex = latestAttemptIndex(rawDir) + 1;
  if (nextIndex > FINAL_REGRESSION_MAX_ATTEMPTS) {
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
  const issueLog = retiredIssueReader(root, state.specPath);
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
  retiredIssueWriter(root, state.specPath, {
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
  if (ctx.recordAndProceedEvidence && typeof ctx.recordAndProceedEvidence === "object") {
    return ctx.recordAndProceedEvidence;
  }
  return {
    category: ctx.recordCategory,
    evidence: ctx.recordEvidence,
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

class CanonicalFinalRegressionProceed {
  constructor({ priorArtifact, input }) {
    const prior = validateFinalRegressionResult(priorArtifact);
    if (prior.result !== "fail" || prior.completed === true) {
      throw new Error("record-and-proceed requires an uncompleted final-regression failure");
    }
    if (prior.executionBinding === null || typeof prior.executionBinding !== "object") {
      throw new Error("record-and-proceed requires the prior execution binding");
    }
    const decision = validateRecordAndProceedInput(input, prior.failureCategory);
    this.prior = prior;
    this.category = decision.category;
    this.evidence = decision.evidence;
    this.remainingRisk = decision.remainingRisk;
    this.operatorJustification = typeof input?.operatorJustification === "string" && input.operatorJustification.trim().length > 0
      ? input.operatorJustification
      : decision.evidence;
    Object.freeze(this);
  }

  toArtifact() {
    return {
      ...this.prior,
      completed: true,
      failureCategory: this.category,
      recordAndProceed: {
        eligible: true,
        validated: true,
        evidence: this.evidence,
        failureClassification: this.category,
        operatorJustification: this.operatorJustification,
        remainingRisk: this.remainingRisk,
        executionBinding: this.prior.executionBinding,
      },
      selectedAction: "explicit-record-and-proceed",
      remainingRisk: this.remainingRisk,
      retryable: false,
      nextAction: "report",
      nextRecommendedAction: "record-and-proceed",
    };
  }
}

function recordAndProceedFailure(code, message, data = {}) {
  return Envelope.fail("run", "final-regression", code, message, data);
}

/**
 * Run the normal project regression against V1 state. Inputs and output are
 * resolved through the Version Store, and raw bytes live only in the typed
 * transient contract.
 */
async function executeCanonicalFinalRegression(ctx) {
  const artifactRoot = ctx.root;
  const root = ctx.executionRoot || artifactRoot;
  const state = ctx.flowState;
  const store = new CanonicalTestArtifactStore({ flowManager: ctx.flowManager, state });
  const canonical = ctx.flowManager.canonicalState(state.specId);
  if (canonical.current?.at(-1) !== "final-regression" || canonical.attempt === null) {
    throw new Error("canonical final-regression requires its active Attempt");
  }
  if (ctx.recordAndProceed) {
    if (canonical.attempt.failure === null) {
      throw new Error("canonical final-regression record-and-proceed requires a prior failed Attempt");
    }
    const prior = store.readCurrentAttempt({
      logicalKey: "final.regression",
      consumerNodeId: "final-regression",
    });
    const artifact = new CanonicalFinalRegressionProceed({
      priorArtifact: prior.payload,
      input: recordAndProceedInput(ctx),
    }).toArtifact();
    validateFinalRegressionResult(artifact);
    const evidence = validateExplicitFinalRegressionProceed({
      root,
      artifact,
      repositoryBindingOptions: {
        pathspecExcludes: new RepairArtifactRegistry(store.location.relativeSpecFile).gitPathspecExcludes(),
      },
    });
    if (!evidence.ok) {
      throw new Error(`record-and-proceed evidence is invalid: ${evidence.reason}`);
    }
    const commandResult = attachCanonicalCommandResultArtifact({
      result: "fail",
      failedRecorded: true,
      changed: [prior.relativePath],
      artifacts: {
        result_path: prior.relativePath,
        raw_output_path: artifact.rawOutputPath,
        completed: true,
        result: "fail",
        failureKind: artifact.failureKind,
        failureCategory: artifact.failureCategory,
        retryable: false,
        nextAction: "report",
      },
      next: "report",
    }, { logicalKey: "final.regression", payload: artifact });
    ctx.flowManager.acceptFinalRegressionFailure({
      specId: state.specId,
      commandResult,
    });
    return commandResult;
  }
  if (canonical.attempt.failure !== null) {
    const prior = store.readCurrentAttempt({
      logicalKey: "final.regression",
      consumerNodeId: "final-regression",
    });
    const artifact = validateFinalRegressionResult(prior.payload);
    return attachCanonicalCommandResultArtifact({
      result: artifact.result,
      changed: [],
      artifacts: {
        result_path: prior.relativePath,
        raw_output_path: artifact.rawOutputPath,
        completed: artifact.completed,
        result: artifact.result,
        failureKind: artifact.failureKind,
        ...(artifact.failureCategory ? { failureCategory: artifact.failureCategory } : {}),
        retryable: artifact.retryable,
        nextAction: artifact.nextAction,
        replayed: true,
      },
      next: artifact.nextAction,
    }, { logicalKey: "final.regression", payload: artifact });
  }
  const attempt = String(canonical.attempt.sequence).padStart(3, "0");
  const rawOutputPathRelative = store.location.relativeArtifact("final.regression.raw-log", { attempt });
  const resultPathRelative = store.location.relativeArtifact("final.regression");
  const config = configForAuthorityRoot(root, ctx.config || {});
  const repositoryBindingOptions = {
    pathspecExcludes: new RepairArtifactRegistry(store.location.relativeSpecFile).gitPathspecExcludes(),
  };
  const beforeRepository = FinalRegressionRepositoryBinding.capture(root, repositoryBindingOptions);
  const rawLines = [];
  const changedFiles = finalRegressionFreshnessFiles(
    expandChangedFileEntries(root, listRegressionChangedFiles({ root, state })),
    state,
  );
  const upgradeEvidence = validateCanonicalUpgradeEvidence({
    flowManager: ctx.flowManager,
    state,
    consumerNodeId: "final-regression",
    root,
    currentRequiredPaths: changedFiles.map((entry) => changedFilePath(entry)),
  });
  if (!upgradeEvidence.ok) {
    throw new Error(`canonical upgrade evidence validation failed: ${upgradeEvidence.reason}`);
  }
  let rootCommand;
  let commandText = null;
  let commandIdentity = null;
  let commandSource = null;
  let result;
  let resultStatus;
  let failure = null;
  let discoveryError = null;
  let childProcesses = [];
  let childRecordError = null;
  let streamEvidence = null;
  let skipDecision = null;

  try {
    rootCommand = discoverRegressionCommand(root, config);
    commandText = rootCommand.toString();
    commandIdentity = commandIdentityFor(rootCommand).toJSON();
    commandSource = commandIdentity.commandSource;
    writeFinalRegressionProgressLine(`command: ${commandText}`);
    writeFinalRegressionProgressLine(`raw log: ${rawOutputPathRelative}`);
    result = await runProcessDetailed(rootCommand, {
      cwd: root,
      timeoutMs: (config?.test?.finalRegressionTimeout || resolveTestTimeoutSeconds(config)) * 1000,
      heartbeatIntervalMs: ctx.finalRegressionProgress?.heartbeatMs ?? FINAL_REGRESSION_HEARTBEAT_MS,
      onHeartbeat({ elapsedMs }) {
        writeFinalRegressionProgressLine(`elapsed: ${formatElapsedMs(elapsedMs)}`);
      },
    });
    resultStatus = processPassed(result) ? "pass" : "fail";
  } catch (error) {
    skipDecision = projectPolicySkipDecision({ err: error, changedFiles });
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
      discoveryError = error;
      result = FinalRegressionProcessResultFactory.commandDiscovery(error);
      resultStatus = "fail";
    }
  }

  if (resultStatus !== "skipped") {
    streamEvidence = { stdout: captureStream(result.stdout), stderr: captureStream(result.stderr) };
    result = { ...result, stdout: streamEvidence.stdout.content, stderr: streamEvidence.stderr.content };
    try {
      childProcesses = decodeChildProcessRecords(result, rawOutputPathRelative);
    } catch (error) {
      childRecordError = error;
    }
    if (resultStatus === "fail") {
      failure = classifyFinalRegressionFailure({
        result,
        discoveryError,
        changedFiles,
        childProcesses,
        childRecordError,
      });
    }
  }

  const testCount = resultStatus === "skipped" ? 0 : finalRegressionTestCount(result.stdout);
  const truncated = resultStatus !== "skipped"
    && Boolean(streamEvidence?.stdout.truncated || streamEvidence?.stderr.truncated);
  const repositoryChangedDuringRun = resultStatus === "pass"
    && !beforeRepository.matches(FinalRegressionRepositoryBinding.capture(root, repositoryBindingOptions));
  if (resultStatus === "pass" && (!result.started || result.exitCode !== 0 || testCount < 1 || truncated || repositoryChangedDuringRun)) {
    resultStatus = "fail";
    failure = new UnknownRegressionFailure();
  }
  const failureKind = failure?.kind || null;
  const priorFailureCount = canonical.attempt.sequence - 1;
  const decision = resultStatus === "pass"
    ? FinalRegressionDecision.pass()
    : resultStatus === "skipped"
      ? FinalRegressionDecision.skipped()
      : FinalRegressionDecision.fail(failure, priorFailureCount);
  const fingerprintedChangedFiles = skipDecision?.changedFiles || currentChangedFilesWithFingerprints(root, changedFiles);
  const failureProfile = resultStatus === "fail"
    ? new FinalRegressionFailureProfile({
      failure,
      process: new FinalRegressionProcess(result),
      childProcesses,
      fixAttempts: priorFailureCount,
      autoApprove: state.autoApprove === true,
      canValidateProceed: Boolean(commandIdentity),
    })
    : null;

  let range;
  if (resultStatus === "skipped") {
    const start = rawLines.length + 1;
    rawLines.push(
      "[sennel] final regression skipped",
      `command: ${commandText || "<unresolved>"}`,
      ...(commandSource ? [`commandSource: ${commandSource}`] : []),
      "result: skipped",
      `skipKind: ${skipDecision.skipKind}`,
      `reason: ${skipDecision.reason}`,
      `nextAction: ${decision.nextAction}`,
    );
    range = { start, end: rawLines.length };
  } else {
    range = appendRaw(rawLines, [
      `[sennel] final regression start command=${commandText || "<unresolved>"}`,
      `command: ${commandText || "<unresolved>"}`,
      ...(commandSource ? [`commandSource: ${commandSource}`] : []),
      ...processOutputLines(result),
      ...(childRecordError ? [`childRecordError: ${childRecordError.message}`] : []),
      `result: ${resultStatus}`,
      ...(failureKind ? [`failureKind: ${failureKind}`, `retryable: ${decision.retryable}`, `nextAction: ${decision.nextAction}`] : []),
      `[sennel] final regression end result=${resultStatus}`,
    ]);
    rawLines.push(
      `evidence.command: ${commandText || "<unresolved>"}`,
      `evidence.result: ${resultStatus}`,
      `evidence.testCount: ${testCount}`,
      `evidence.truncated: ${truncated}`,
      `evidence.worktreeSha256: ${beforeRepository.worktreeSha256}`,
      ...["stdout", "stderr"].flatMap((stream) => {
        const evidence = streamEvidence[stream].toEvidenceJSON();
        return [
          `evidence.${stream}.originalByteLength: ${evidence.originalByteLength}`,
          `evidence.${stream}.capturedByteLength: ${evidence.capturedByteLength}`,
          `evidence.${stream}.truncated: ${evidence.truncated}`,
          `evidence.${stream}.sha256: ${evidence.sha256}`,
        ];
      }),
    );
  }
  const rawText = `${rawLines.join("\n")}\n`;
  store.writeRaw({
    nodeId: "final-regression",
    logicalKey: "final.regression.raw-log",
    parameters: { attempt },
    bytes: rawText,
  });
  const executionBinding = resultStatus === "skipped" ? null : {
    ...beforeRepository,
    command: commandText,
    rawOutputPath: rawOutputPathRelative,
    rawOutputSha256: crypto.createHash("sha256").update(rawText).digest("hex"),
    parsedResult: resultStatus,
    testCount,
    truncated,
    stdout: streamEvidence?.stdout.toEvidenceJSON(),
    stderr: streamEvidence?.stderr.toEvidenceJSON(),
  };
  const artifact = new FinalRegressionArtifact({
    result: resultStatus,
    command: commandText || "<unresolved>",
    commandSource,
    rawOutputPath: rawOutputPathRelative,
    rawOutputLines: range,
    process: new FinalRegressionProcess(result),
    childProcesses,
    changedFiles: fingerprintedChangedFiles,
    decision,
    skipKind: skipDecision?.skipKind || null,
    reason: skipDecision?.reason || null,
    proof: skipDecision?.proof || null,
    commandIdentity,
    changedFileFingerprints: fingerprintedChangedFiles,
    failureProfile,
    failureSummary: resultStatus === "fail" ? failureSummaryFor(result, failureKind) : null,
    executionBinding,
  });
  const json = artifact.toJSON();
  json.contractSummary = contractFromFinalRegressionArtifact(json, {
    artifactPath: resultPathRelative,
  }).summary.toJSON();
  validateFinalRegressionResult(json);
  const commandResult = attachCanonicalCommandResultArtifact({
    result: resultStatus,
    changed: [resultPathRelative, rawOutputPathRelative],
    artifacts: artifact.toEnvelopeArtifacts(resultPathRelative),
    next: resultStatus === "pass" || resultStatus === "skipped" ? "report" : decision.nextAction,
  }, { logicalKey: "final.regression", payload: json });
  if (resultStatus === "pass" || resultStatus === "skipped") return commandResult;

  // Failure facts and the attempt-history bytes become durable together.
  // A later restart can therefore make a definition-owned retry/recovery
  // decision without relying on a raw log or a sibling result file.
  ctx.flowManager.failCurrentAttempt({
    specId: state.specId,
    failure: {
      category: failureProfile.failureCategory,
      code: "FINAL_REGRESSION_FAILED",
      message: `final-regression failed (${failureKind})`,
      retryable: decision.retryable,
      retryKind: decision.retryable ? "semantic" : null,
    },
    result: {
      outcome: "failed",
      summary: `final-regression failed (${failureKind})`,
      confirmedAt: new Date().toISOString(),
      artifactRefs: [],
    },
    commandResult,
  });
  return commandResult;
}

export default class RunFinalRegressionCommand extends FlowCommand {
  async execute(ctx) {
    if (!isCanonicalFlowState(ctx.flowState)) {
      throw new Error("final-regression requires a Version-1 Flow");
    }
    return executeCanonicalFinalRegression(ctx);
  }
}
