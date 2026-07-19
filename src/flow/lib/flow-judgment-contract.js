import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Envelope } from "../../lib/flow-envelope.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { IMPL_GATE_RESULT_FILE, readJsonStrict } from "./test-artifacts.js";
import {
  normalizeSourceArtifactPath,
  readBoundedSourceArtifact,
  readFlowFindingsArtifact,
} from "./flow-findings.js";
import {
  PlanEvidenceReference,
  isPlanArtifactFresh,
  isPlanEvidenceFresh,
  latestPlanRewind,
} from "./plan-rewind.js";
import {
  assertRepairFingerprint,
  buildRepairFingerprint,
} from "./impl-repair-artifacts.js";

export const COMPLETION_OVERRIDE_FILE = "completion-overrides.json";

const TARGET_ARTIFACT_FILE_BY_STEP = Object.freeze({
  "test-review": "test-review.json",
  "impl-review": "impl-review.json",
  "impl-gate": IMPL_GATE_RESULT_FILE,
  "test-result-review": "test-result-review.json",
  "acceptance-review": "acceptance-review.json",
  "final-regression": "final-regression-result.json",
});

const ALLOWED_DISPOSITIONS = Object.freeze(new Set([
  "out_of_scope",
  "transferred_to_successor",
  "accepted_risk",
  "false_positive",
]));

function requireOwn(input, field) {
  if (!Object.prototype.hasOwnProperty.call(input, field)) {
    throw new Error(`${field} is required`);
  }
}

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function repoRelative(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function normalizeFindings(findings) {
  if (!Array.isArray(findings)) throw new Error("blockingFindings must be an array");
  return Object.freeze(findings.map((finding) => Object.freeze({ ...(finding || {}) })));
}

function normalizeNextAction(value) {
  if (value === undefined) throw new Error("nextAction is required");
  return value;
}

export class FlowJudgmentContract {
  constructor(input = {}) {
    requireOwn(input, "targetStep");
    requireOwn(input, "artifactPath");
    requireOwn(input, "verdict");
    requireOwn(input, "blockingFindings");
    requireOwn(input, "failureKind");
    requireOwn(input, "nextAction");
    requireOwn(input, "rawArtifactPath");
    requireOwn(input, "inputFingerprint");
    requireOwn(input, "artifactFingerprint");

    this.targetStep = requireNonEmptyString(input.targetStep, "targetStep");
    this.artifactPath = requireNonEmptyString(input.artifactPath, "artifactPath");
    this.verdict = requireNonEmptyString(input.verdict, "verdict");
    this.blockingFindings = normalizeFindings(input.blockingFindings);
    if (input.failureKind !== null && typeof input.failureKind !== "string") {
      throw new Error("failureKind must be a string or null");
    }
    this.failureKind = input.failureKind;
    this.nextAction = normalizeNextAction(input.nextAction);
    this.rawArtifactPath = input.rawArtifactPath === null
      ? null
      : requireNonEmptyString(input.rawArtifactPath, "rawArtifactPath");
    this.inputFingerprint = requireNonEmptyString(input.inputFingerprint, "inputFingerprint");
    this.artifactFingerprint = requireNonEmptyString(input.artifactFingerprint, "artifactFingerprint");
    Object.freeze(this);
  }

  get blockingCount() {
    return this.blockingFindings.length;
  }

  get summary() {
    const policy = StepCompletionPolicy.maybeForStep(this.targetStep);
    return new JudgmentContractSummary({
      targetStep: this.targetStep,
      artifactPath: this.artifactPath,
      verdict: this.verdict,
      result: this.verdict,
      blockingCount: this.blockingCount,
      failureKind: this.failureKind,
      nextAction: this.nextAction,
      completionKind: policy?.allowsNormal(this) ? "normal" : "non_normal",
      progressSignature: progressSignature(this),
    });
  }

  toJSON() {
    return {
      targetStep: this.targetStep,
      artifactPath: this.artifactPath,
      verdict: this.verdict,
      blockingFindings: this.blockingFindings,
      failureKind: this.failureKind,
      nextAction: this.nextAction,
      rawArtifactPath: this.rawArtifactPath,
      inputFingerprint: this.inputFingerprint,
      artifactFingerprint: this.artifactFingerprint,
      summary: this.summary.toJSON(),
    };
  }
}

export class JudgmentContractSummary {
  constructor(input = {}) {
    this.targetStep = requireNonEmptyString(input.targetStep, "targetStep");
    this.artifactPath = requireNonEmptyString(input.artifactPath, "artifactPath");
    this.verdict = requireNonEmptyString(input.verdict, "verdict");
    this.result = requireNonEmptyString(input.result, "result");
    this.blockingCount = Number(input.blockingCount);
    if (!Number.isInteger(this.blockingCount) || this.blockingCount < 0) {
      throw new Error("blockingCount must be a non-negative integer");
    }
    this.failureKind = input.failureKind;
    this.nextAction = normalizeNextAction(input.nextAction);
    this.completionKind = requireNonEmptyString(input.completionKind, "completionKind");
    this.progressSignature = requireNonEmptyString(input.progressSignature, "progressSignature");
    Object.freeze(this);
  }

  toJSON() {
    return {
      targetStep: this.targetStep,
      artifactPath: this.artifactPath,
      verdict: this.verdict,
      result: this.result,
      blockingCount: this.blockingCount,
      failureKind: this.failureKind,
      nextAction: this.nextAction,
      completionKind: this.completionKind,
      progressSignature: this.progressSignature,
    };
  }
}

export class StepCompletionPolicy {
  constructor({ stepId, allowedVerdicts, requireNoBlocking = true, failureKind = undefined, nextAction = undefined }) {
    this.stepId = requireNonEmptyString(stepId, "stepId");
    if (!Array.isArray(allowedVerdicts) || allowedVerdicts.length === 0) {
      throw new Error("allowedVerdicts must be a non-empty array");
    }
    this.allowedVerdicts = Object.freeze(allowedVerdicts.map((value) => requireNonEmptyString(value, "allowedVerdicts[]")));
    this.requireNoBlocking = Boolean(requireNoBlocking);
    this.requiredFailureKind = failureKind;
    this.requiredNextAction = nextAction;
    Object.freeze(this);
  }

  allowsNormal(contract) {
    if (!(contract instanceof FlowJudgmentContract)) throw new Error("contract must be a FlowJudgmentContract");
    if (contract.targetStep !== this.stepId) return false;
    if (this.stepId === "final-regression") {
      if (contract.verdict === "pass" || contract.verdict === "skipped") {
        return contract.failureKind === null && contract.nextAction === "report";
      }
      return contract.verdict === "fail"
        && contract.blockingCount === 0
        && typeof contract.failureKind === "string"
        && contract.nextAction === "report";
    }
    if (!this.allowedVerdicts.includes(contract.verdict)) return false;
    if (this.requireNoBlocking && contract.blockingCount !== 0) return false;
    if (this.requiredFailureKind !== undefined && contract.failureKind !== this.requiredFailureKind) return false;
    if (this.requiredNextAction !== undefined && contract.nextAction !== this.requiredNextAction) return false;
    return true;
  }

  static defaultPolicies() {
    return new Map([
      ["test-review", new StepCompletionPolicy({ stepId: "test-review", allowedVerdicts: ["PASS", "ADVISORY"] })],
      ["impl-review", new StepCompletionPolicy({
        stepId: "impl-review",
        allowedVerdicts: ["PASS", "ADVISORY", "FAIL"],
        requireNoBlocking: false,
      })],
      ["impl-gate", new StepCompletionPolicy({ stepId: "impl-gate", allowedVerdicts: ["pass"] })],
      ["test-result-review", new StepCompletionPolicy({ stepId: "test-result-review", allowedVerdicts: ["pass"], requireNoBlocking: false })],
      ["acceptance-review", new StepCompletionPolicy({
        stepId: "acceptance-review",
        allowedVerdicts: ["pass"],
        requireNoBlocking: true,
        failureKind: null,
        nextAction: "final-regression",
      })],
      ["final-regression", new StepCompletionPolicy({
        stepId: "final-regression",
        allowedVerdicts: ["pass", "skipped"],
        requireNoBlocking: false,
        failureKind: null,
        nextAction: "report",
      })],
    ]);
  }

  static maybeForStep(stepId) {
    return StepCompletionPolicy.defaultPolicies().get(stepId) || null;
  }

  static forStep(stepId) {
    const policy = StepCompletionPolicy.maybeForStep(stepId);
    if (!policy) throw new Error(`no completion policy for step: ${stepId}`);
    return policy;
  }
}

export class FindingDisposition {
  constructor(input = {}) {
    this.findingId = requireNonEmptyString(input.findingId, "findingId");
    this.disposition = requireNonEmptyString(input.disposition, "disposition");
    if (!ALLOWED_DISPOSITIONS.has(this.disposition)) {
      throw new Error(`invalid disposition: ${this.disposition}`);
    }
    this.successorOwner = requireNonEmptyString(input.successorOwner, "successorOwner");
    this.acceptedRisk = requireNonEmptyString(input.acceptedRisk, "acceptedRisk");
    Object.freeze(this);
  }

  toJSON() {
    return {
      findingId: this.findingId,
      disposition: this.disposition,
      successorOwner: this.successorOwner,
      acceptedRisk: this.acceptedRisk,
    };
  }
}

export class OverrideCompletionEvidence {
  constructor(input = {}) {
    this.stepId = requireNonEmptyString(input.stepId, "stepId");
    if (input.userApproval !== true) throw new Error("userApproval must be true");
    this.userApproval = true;
    this.reason = requireNonEmptyString(input.reason, "reason");
    this.approvedAt = requireNonEmptyString(input.approvedAt, "approvedAt");
    this.approvedBy = requireNonEmptyString(input.approvedBy, "approvedBy");
    if (!Array.isArray(input.findings) || input.findings.length === 0) {
      throw new Error("findings must be a non-empty array");
    }
    this.findings = Object.freeze(input.findings.map((finding) => new FindingDisposition(finding)));
    Object.freeze(this);
  }

  appliesTo(contract) {
    return contract instanceof FlowJudgmentContract && contract.targetStep === this.stepId;
  }

  toJSON() {
    return {
      stepId: this.stepId,
      userApproval: this.userApproval,
      reason: this.reason,
      approvedAt: this.approvedAt,
      approvedBy: this.approvedBy,
      findings: this.findings.map((finding) => finding.toJSON()),
    };
  }
}

export class CompletionValidationResult {
  constructor({ kind, reason, contract, override = null }) {
    this.kind = requireNonEmptyString(kind, "kind");
    this.reason = requireNonEmptyString(reason, "reason");
    this.contract = contract;
    this.override = override;
    Object.freeze(this);
  }
}

export class CompletionValidator {
  constructor(policies = StepCompletionPolicy.defaultPolicies()) {
    if (policies instanceof Map) {
      this.policies = new Map(policies);
    } else if (Array.isArray(policies)) {
      this.policies = new Map(policies.map((policy) => [policy.stepId, policy]));
    } else {
      throw new Error("policies must be a Map or array");
    }
  }

  validate({ contract, requestedStatus, overrideEvidence = null, deferredEvidence = null }) {
    if (!(contract instanceof FlowJudgmentContract)) throw new Error("contract must be a FlowJudgmentContract");
    if (requestedStatus !== "done") {
      return new CompletionValidationResult({ kind: "normal", reason: `status ${requestedStatus} does not require completion validation`, contract });
    }
    const policy = this.policies.get(contract.targetStep);
    if (!policy) {
      return new CompletionValidationResult({ kind: "normal", reason: `no completion policy for ${contract.targetStep}`, contract });
    }
    if (policy.allowsNormal(contract)) {
      return new CompletionValidationResult({ kind: "normal", reason: "normal completion policy satisfied", contract });
    }
    if (overrideEvidence instanceof OverrideCompletionEvidence && overrideEvidence.appliesTo(contract)) {
      return new CompletionValidationResult({ kind: "override", reason: "valid override completion evidence found", contract, override: overrideEvidence });
    }
    if (deferredEvidence === true) {
      return new CompletionValidationResult({ kind: "deferred", reason: "valid deferred flow finding evidence found", contract });
    }
    return new CompletionValidationResult({
      kind: "inconsistent",
      reason: "normal completion policy failed and no valid override evidence was found",
      contract,
    });
  }
}

function deferredEvidenceApplies(specDir, contract, state) {
  const findingsFile = path.join(specDir, "flow-findings.json");
  if (latestPlanRewind(state) && !isPlanArtifactFresh(state, findingsFile, "flow-findings")) {
    return false;
  }
  let artifact;
  try {
    artifact = readFlowFindingsArtifact(specDir, { flowState: state });
  } catch {
    return false;
  }
  const contractArtifact = contractArtifactRelativeToSpec(specDir, contract.artifactPath);
  if (!contractArtifact) return false;
  return artifact.entries.some((entry) => (
    entry.completionKind === "deferred"
    && entry.retryExhausted === true
    && entry.sourceArtifact === contractArtifact
    && (entry.sourceStep === contract.targetStep || entry.sourceStep === contract.targetStep.replace(/-gate$/, "-gate"))
    && sourceArtifactContainsFinding(specDir, entry)
  ));
}

function contractArtifactRelativeToSpec(specDir, artifactPath) {
  let normalized;
  try {
    normalized = normalizeSourceArtifactPath(artifactPath, "artifactPath");
  } catch {
    return null;
  }
  const specPrefix = `${path.basename(path.dirname(specDir))}/${path.basename(specDir)}/`;
  return normalized.startsWith(specPrefix) ? normalized.slice(specPrefix.length) : normalized;
}

function sourceArtifactContainsFinding(specDir, entry) {
  const source = readBoundedSourceArtifact(specDir, entry.sourceArtifact);
  if (!source) return false;
  return deferredFindingCandidates(source).some((finding) => (
    findingIdOf(finding) === entry.sourceFindingId
    && isFailedFinding(source, finding)
    && isContentAlignmentFinding(finding)
  ));
}

function deferredFindingCandidates(source) {
  const candidates = [
    source?.blockingFindings,
    source?.findings,
    source?.comments,
    source?.proposals,
    source?.advisoryFindings,
    source?.evaluations,
    source?.observations,
    source?.nextAction?.diagnosis?.observations,
  ];
  return candidates.filter(Array.isArray).flat();
}

function findingIdOf(finding) {
  return finding?.findingId || finding?.id || finding?.proposalId || null;
}

function isFailedFinding(source, finding) {
  if (typeof finding?.result === "string") return finding.result.toLowerCase() === "fail";
  if (typeof finding?.verdict === "string") return finding.verdict.toLowerCase() === "fail";
  return String(source?.verdict || source?.result || "").toLowerCase() === "fail";
}

function findingText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(findingText).join(" ");
  if (typeof value === "object") return Object.values(value).map(findingText).join(" ");
  return String(value);
}

function isContentAlignmentFinding(finding) {
  const text = findingText({
    kind: finding?.kind,
    category: finding?.category,
    failureMode: finding?.failureMode,
    title: finding?.title,
    guardrail_id: finding?.guardrail_id,
    requirementRef: finding?.requirementRef,
  }).toLowerCase().replace(/[_-]+/g, " ");
  return /\b(content|alignment|semantic|requirement\s?alignment)\b/.test(text)
    && !/\b(schema|tooling|command|test|missing|invalid|corrupt|no\s?progress|mechanical)\b/.test(text);
}

export function progressSignature(contract) {
  if (!(contract instanceof FlowJudgmentContract)) throw new Error("contract must be a FlowJudgmentContract");
  return fingerprint({
    targetStep: contract.targetStep,
    artifactPath: contract.artifactPath,
    verdict: contract.verdict,
    blockingCount: contract.blockingCount,
    failureKind: contract.failureKind,
    nextAction: contract.nextAction,
    inputFingerprint: contract.inputFingerprint,
    artifactFingerprint: contract.artifactFingerprint,
  });
}

export function buildCompletionValidationEnvelope({ contract, policy, overridePath, result = null }) {
  const validation = result || new CompletionValidator([policy]).validate({
    contract,
    requestedStatus: "done",
    overrideEvidence: null,
  });
  return Envelope.fail(
    "set",
    "step",
    "STEP_COMPLETION_VALIDATION_FAILED",
    validation.reason,
    {
      completionValidation: {
        stepId: contract.targetStep,
        result: validation.kind,
        reason: validation.reason,
        artifactPath: contract.artifactPath,
        overridePath,
      },
    },
  );
}

function contractInput(targetStep, artifact, opts) {
  const artifactPath = opts.artifactPath || TARGET_ARTIFACT_FILE_BY_STEP[targetStep] || `${targetStep}.json`;
  return {
    targetStep,
    artifactPath,
    rawArtifactPath: opts.rawArtifactPath || artifact.rawOutputPath || artifact.raw_output_path || artifact.coverageArtifact || artifactPath,
    inputFingerprint: opts.inputFingerprint || fingerprint({ targetStep, artifactPath }),
    artifactFingerprint: opts.artifactFingerprint || fingerprint(artifact),
  };
}

export function contractFromTestReviewArtifact(artifact, opts = {}) {
  return new FlowJudgmentContract({
    ...contractInput("test-review", artifact, opts),
    verdict: artifact.verdict,
    blockingFindings: artifact.blockingFindings || [],
    failureKind: artifact.toolingFailure ? "tooling_failure" : null,
    nextAction: artifact.verdict === "PASS" || artifact.verdict === "ADVISORY" ? "implement" : null,
  });
}

export function contractFromImplReviewArtifact(artifact, opts = {}) {
  if (!Array.isArray(artifact?.blockingFindings)) {
    throw new Error("impl-review blockingFindings must be an array");
  }
  if (!Array.isArray(artifact.nonBlockingImprovements)) {
    throw new Error("impl-review nonBlockingImprovements must be an array");
  }
  const expectedVerdict = artifact.blockingFindings.length > 0
    ? "FAIL"
    : artifact.nonBlockingImprovements.length > 0
      ? "ADVISORY"
      : "PASS";
  if (artifact.verdict !== expectedVerdict) {
    throw new Error(`impl-review verdict must be ${expectedVerdict} for the recorded finding buckets`);
  }
  return new FlowJudgmentContract({
    ...contractInput("impl-review", artifact, opts),
    verdict: artifact.verdict,
    blockingFindings: artifact.blockingFindings,
    failureKind: null,
    nextAction: artifact.verdict === "PASS" || artifact.verdict === "ADVISORY" ? "impl-gate" : null,
  });
}

export function contractFromTestResultReviewArtifact(artifact, opts = {}) {
  const failed = Array.isArray(artifact.checked_items)
    ? artifact.checked_items.filter((item) => item?.result !== "pass")
    : [];
  return new FlowJudgmentContract({
    ...contractInput("test-result-review", artifact, opts),
    verdict: artifact.verdict,
    blockingFindings: failed,
    failureKind: artifact.verdict === "pass" ? null : "invalid_test_result",
    nextAction: artifact.verdict === "pass" ? "impl-review" : null,
    rawArtifactPath: opts.rawArtifactPath || artifact.raw_output_path,
  });
}

export function contractFromFinalRegressionArtifact(artifact, opts = {}) {
  const failedRecorded = artifact.result === "fail"
    && artifact.completed === true
    && artifact.selectedAction === "record-and-proceed"
    && artifact.recordAndProceed?.validated === true
    && artifact.nextAction === "report";
  const blockingFindings = artifact.result === "pass" || artifact.result === "skipped" || failedRecorded
    ? []
    : [{ failureKind: artifact.failureKind, nextAction: artifact.nextAction }];
  return new FlowJudgmentContract({
    ...contractInput("final-regression", artifact, opts),
    verdict: artifact.result,
    blockingFindings,
    failureKind: artifact.failureKind,
    nextAction: artifact.nextAction,
    rawArtifactPath: opts.rawArtifactPath || artifact.rawOutputPath,
  });
}

export function contractFromAcceptanceReviewArtifact(artifact, opts = {}) {
  const mechanical = Array.isArray(artifact.mechanicalBlockers) ? artifact.mechanicalBlockers : [];
  const hard = Array.isArray(artifact.hardBlockers) ? artifact.hardBlockers : [];
  return new FlowJudgmentContract({
    ...contractInput("acceptance-review", artifact, opts),
    verdict: artifact.verdict,
    blockingFindings: [...mechanical, ...hard],
    failureKind: artifact.verdict === "pass" ? null : "acceptance_review_not_pass",
    nextAction: artifact.verdict === "pass" ? "final-regression" : null,
    rawArtifactPath: opts.rawArtifactPath || opts.artifactPath || TARGET_ARTIFACT_FILE_BY_STEP["acceptance-review"],
  });
}

export function contractFromGateArtifact(artifact, opts = {}) {
  const phase = opts.phase || artifact.phase;
  const targetStep = phase === "integration" ? "impl-gate" : `${phase}-gate`;
  const issues = Array.isArray(artifact.issues) ? artifact.issues : [];
  const failedEvaluations = Array.isArray(artifact.evaluations)
    ? artifact.evaluations.filter((item) => item?.result === "fail")
    : [];
  return new FlowJudgmentContract({
    ...contractInput(targetStep, artifact, opts),
    verdict: artifact.verdict || artifact.result,
    blockingFindings: [...issues.map((issue) => ({ issue })), ...failedEvaluations],
    failureKind: artifact.verdict === "pass" || artifact.result === "pass" ? null : "gate_failure",
    nextAction: artifact.nextAction ?? null,
    rawArtifactPath: opts.rawArtifactPath || opts.artifactPath || TARGET_ARTIFACT_FILE_BY_STEP[targetStep],
  });
}

export function withContractSummary(contract) {
  return contract.summary.toJSON();
}

export function completionOverridePath(specDir) {
  return path.join(specDir, COMPLETION_OVERRIDE_FILE);
}

export function loadCompletionOverrideEvidence(specDir, stepId) {
  const overridePath = completionOverridePath(specDir);
  if (!fs.existsSync(overridePath)) return null;
  const data = readJsonStrict(overridePath);
  const entry = data?.entries?.[stepId];
  if (!entry) return null;
  return new OverrideCompletionEvidence({ stepId, ...entry });
}

export function saveCompletionOverrideEvidence(specDir, evidence) {
  if (!(evidence instanceof OverrideCompletionEvidence)) {
    throw new Error("evidence must be OverrideCompletionEvidence");
  }
  const overridePath = completionOverridePath(specDir);
  const existing = fs.existsSync(overridePath) ? readJsonStrict(overridePath) : { entries: {} };
  const next = {
    ...existing,
    entries: {
      ...(existing.entries || {}),
      [evidence.stepId]: evidence.toJSON(),
    },
  };
  fs.writeFileSync(overridePath, JSON.stringify(next, null, 2) + "\n");
  return overridePath;
}

export function contractForStepFromSpecDir({ root, specDir, stepId }) {
  const artifactFile = TARGET_ARTIFACT_FILE_BY_STEP[stepId];
  if (!artifactFile) throw new Error(`step does not use completion contract: ${stepId}`);
  const artifactPath = path.join(specDir, artifactFile);
  const artifactPathRelative = repoRelative(root, artifactPath);
  const artifact = readJsonStrict(artifactPath);
  if (["impl-review", "impl-gate", "test-result-review", "acceptance-review"].includes(stepId)) {
    const specPath = path.posix.join(repoRelative(root, specDir), "spec.json");
    const currentFingerprint = buildRepairFingerprint({ root, specPath });
    assertRepairFingerprint({ artifact, fingerprint: currentFingerprint, label: artifactFile });
  }
  if (stepId === "test-review") {
    return contractFromTestReviewArtifact(artifact, { artifactPath: artifactPathRelative });
  }
  if (stepId === "impl-review") {
    return contractFromImplReviewArtifact(artifact, { artifactPath: artifactPathRelative });
  }
  if (stepId === "impl-gate") {
    return contractFromGateArtifact(artifact, { phase: "integration", artifactPath: artifactPathRelative });
  }
  if (stepId === "test-result-review") {
    return contractFromTestResultReviewArtifact(artifact, { artifactPath: artifactPathRelative });
  }
  if (stepId === "acceptance-review") {
    return contractFromAcceptanceReviewArtifact(artifact, { artifactPath: artifactPathRelative });
  }
  if (stepId === "final-regression") {
    return contractFromFinalRegressionArtifact(artifact, { artifactPath: artifactPathRelative });
  }
  throw new Error(`unsupported completion contract step: ${stepId}`);
}

export function validateStepCompletionTransition({ root, state, stepId, requestedStatus }) {
  if (requestedStatus !== "done") return null;
  const policy = StepCompletionPolicy.maybeForStep(stepId);
  if (!policy) return null;
  if (!state?.spec) {
    return Envelope.fail(
      "set",
      "step",
      stepId === "acceptance-review" ? "STEP_ARTIFACT_VALIDATION_FAILED" : "STEP_COMPLETION_VALIDATION_FAILED",
      `${stepId} cannot be marked done without an active flow spec`,
      {
        completionValidation: {
          stepId,
          result: "inconsistent",
          reason: "active flow spec is missing",
          artifactPath: TARGET_ARTIFACT_FILE_BY_STEP[stepId],
          overridePath: null,
        },
      },
    );
  }
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  const targetArtifact = path.join(specDir, TARGET_ARTIFACT_FILE_BY_STEP[stepId]);
  if (latestPlanRewind(state) && !isPlanArtifactFresh(state, targetArtifact, stepId)) {
    return Envelope.fail(
      "set",
      "step",
      "STALE_PLAN_EVIDENCE",
      `${stepId} evidence must be regenerated after the latest plan rewind`,
    );
  }
  const overridePath = repoRelative(root, completionOverridePath(specDir));
  let contract;
  try {
    contract = contractForStepFromSpecDir({ root, specDir, stepId });
  } catch (err) {
    return Envelope.fail(
      "set",
      "step",
      stepId === "acceptance-review" ? "STEP_ARTIFACT_VALIDATION_FAILED" : "STEP_COMPLETION_VALIDATION_FAILED",
      `${stepId} completion artifact is invalid: ${err.message}`,
      {
        completionValidation: {
          stepId,
          result: "inconsistent",
          reason: err.message,
          artifactPath: path.posix.join(path.posix.dirname(state.spec.split(path.sep).join("/")), TARGET_ARTIFACT_FILE_BY_STEP[stepId]),
          overridePath,
        },
      },
    );
  }

  let overrideEvidence = null;
  try {
    const overrideFile = completionOverridePath(specDir);
    const overrideFresh = !latestPlanRewind(state)
      || !fs.existsSync(overrideFile)
      || isPlanArtifactFresh(state, overrideFile, "completion-overrides");
    overrideEvidence = overrideFresh ? loadCompletionOverrideEvidence(specDir, stepId) : null;
    if (
      overrideEvidence
      && latestPlanRewind(state)
      && !isPlanEvidenceFresh(state, new PlanEvidenceReference({
        kind: "completion-overrides",
        createdAt: overrideEvidence.approvedAt,
      }))
    ) {
      overrideEvidence = null;
    }
  } catch (err) {
    return buildCompletionValidationEnvelope({
      contract,
      policy,
      overridePath,
      result: new CompletionValidationResult({
        kind: "inconsistent",
        reason: `override evidence is invalid: ${err.message}`,
        contract,
      }),
    });
  }

  const result = new CompletionValidator(StepCompletionPolicy.defaultPolicies()).validate({
    contract,
    requestedStatus,
    overrideEvidence,
    deferredEvidence: deferredEvidenceApplies(specDir, contract, state),
  });
  if (result.kind === "normal" || result.kind === "override" || result.kind === "deferred") return null;
  if (stepId === "acceptance-review") {
    return Envelope.fail(
      "set",
      "step",
      "STEP_ARTIFACT_VALIDATION_FAILED",
      result.reason,
      {
        completionValidation: {
          stepId,
          result: result.kind,
          reason: result.reason,
          artifactPath: contract.artifactPath,
          overridePath,
        },
      },
    );
  }
  return buildCompletionValidationEnvelope({ contract, policy, overridePath, result });
}

export function assertStepCompletionTransitionAllowed(ctx, stepId) {
  const fail = validateStepCompletionTransition({
    root: ctx.root,
    state: ctx.flowState || ctx.flowManager?.load?.(),
    stepId,
    requestedStatus: "done",
  });
  if (!fail) return;
  const err = new Error(fail.errors?.[0]?.messages?.join("; ") || "step completion validation failed");
  err.completionValidation = fail.data?.completionValidation;
  throw err;
}
