import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchema } from "../../lib/schema-validate.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { flowLeafIdsBetween } from "../definition.js";
import { findStepById } from "./step-tree.js";
import {
  ACCEPTANCE_FINAL_DISPOSITIONS,
  mirrorFinalDispositions,
  readBoundedSourceArtifact,
  readFlowFindingsArtifact,
  validateFinalDisposition,
} from "./flow-findings.js";
import {
  assertRepairFingerprint,
  buildRepairFingerprint,
  prepareImplTriageArtifact,
  readImplRepairLedger,
  readRejectedImplReviewTriage,
  writeRepairEvidenceArtifact,
} from "./impl-repair-artifacts.js";
import {
  validateScenarioValidityResult,
  validateTestExecuteResultV2,
  validateTestResultReview,
} from "./test-artifacts.js";

export const ACCEPTANCE_REVIEW_ARTIFACT_FILE = "acceptance-review.json";

const SCHEMA_PATH = fileURLToPath(new URL("../schemas/acceptance-review.schema.json", import.meta.url));
const JUDGMENT_STATUSES = new Set(["met", "notMet", "notVerifiable"]);
const VERDICTS = new Set(["pass", "repair_required", "user_decision_required", "blocked"]);
const USER_DECISION_CHOICES = new Set(["accept_risk_and_continue", "abort"]);
const REQUIRED_MECHANICAL_ARTIFACTS = Object.freeze([
  "scenario-validity-result.json",
  "test-execute-result.json",
  "test-result-review.json",
  "impl-review.json",
  "impl-gate-result.json",
  "retro.json",
]);
const FINGERPRINTED_INPUT_ARTIFACTS = Object.freeze(REQUIRED_MECHANICAL_ARTIFACTS.slice(1));
const MAX_ACCEPTANCE_RAW_EVIDENCE_BYTES = 20 * 1024 * 1024;

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function requireStringArray(value, field, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${field} must be ${allowEmpty ? "an" : "a non-empty"} array`);
  }
  return value.map((entry, index) => requireString(entry, `${field}[${index}]`));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function acceptanceSchema() {
  return readJson(SCHEMA_PATH);
}

function requireFinalDisposition(value, field = "finalDisposition") {
  const disposition = validateFinalDisposition(value, field);
  if (disposition === null) {
    throw new Error(`${field} must be one of ${ACCEPTANCE_FINAL_DISPOSITIONS.join(", ")}`);
  }
  return disposition;
}

export class RequirementAcceptanceJudgment {
  constructor(input = {}) {
    this.requirementId = requireString(input.requirementId, "requirementId");
    this.status = requireString(input.status, "status");
    if (!JUDGMENT_STATUSES.has(this.status)) throw new Error(`invalid acceptance judgment status: ${this.status}`);
    this.requestRefs = Object.freeze(requireStringArray(input.requestRefs, "requestRefs"));
    this.requirementRefs = Object.freeze(requireStringArray(input.requirementRefs, "requirementRefs"));
    const evidenceMayBeMissing = this.status === "notVerifiable";
    this.diffRefs = Object.freeze(requireStringArray(input.diffRefs || [], "diffRefs", { allowEmpty: evidenceMayBeMissing }));
    this.repairRefs = Object.freeze(requireStringArray(input.repairRefs, "repairRefs"));
    this.testRefs = Object.freeze(requireStringArray(input.testRefs || [], "testRefs", { allowEmpty: evidenceMayBeMissing }));
    this.missingEvidence = Object.freeze(requireStringArray(input.missingEvidence || [], "missingEvidence", {
      allowEmpty: !evidenceMayBeMissing,
    }));
    if (evidenceMayBeMissing && this.missingEvidence.length === 0) {
      throw new Error("missingEvidence must be non-empty for notVerifiable");
    }
    if (!evidenceMayBeMissing && this.missingEvidence.length > 0) {
      throw new Error(`missingEvidence must be empty for ${this.status}`);
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      requirementId: this.requirementId,
      status: this.status,
      requestRefs: [...this.requestRefs],
      requirementRefs: [...this.requirementRefs],
      diffRefs: [...this.diffRefs],
      repairRefs: [...this.repairRefs],
      testRefs: [...this.testRefs],
      missingEvidence: [...this.missingEvidence],
    };
  }
}

export class MechanicalBlocker {
  constructor(input = {}) {
    this.blockerId = requireString(input.blockerId, "blockerId");
    this.kind = requireString(input.kind, "kind");
    this.summary = requireString(input.summary, "summary");
    Object.freeze(this);
  }

  toJSON() {
    return { blockerId: this.blockerId, kind: this.kind, summary: this.summary };
  }
}

export class DeferredAcceptanceFinding {
  constructor(input = {}) {
    this.findingId = requireString(input.findingId, "findingId");
    this.sourceStep = requireString(input.sourceStep, "sourceStep");
    this.sourceArtifact = requireString(input.sourceArtifact, "sourceArtifact");
    this.sourceFindingId = requireString(input.sourceFindingId, "sourceFindingId");
    this.finalDisposition = requireFinalDisposition(input.finalDisposition);
    this.evidenceRefs = Object.freeze(requireStringArray(input.evidenceRefs || [], "evidenceRefs", { allowEmpty: true }));
    Object.freeze(this);
  }

  toJSON() {
    return {
      findingId: this.findingId,
      sourceStep: this.sourceStep,
      sourceArtifact: this.sourceArtifact,
      sourceFindingId: this.sourceFindingId,
      finalDisposition: this.finalDisposition,
      evidenceRefs: [...this.evidenceRefs],
    };
  }
}

export class AcceptanceReviewOutcome {
  constructor(input = {}) {
    if (input.version !== 2) throw new Error("acceptance-review version must be 2");
    this.version = 2;
    this.repairFingerprint = requireString(input.repairFingerprint, "repairFingerprint");
    if (!/^[a-f0-9]{64}$/i.test(this.repairFingerprint)) {
      throw new Error("repairFingerprint must be a 64-character SHA-256 digest");
    }
    if (!Array.isArray(input.mechanicalBlockers)) throw new Error("mechanicalBlockers must be an array");
    this.mechanicalBlockers = Object.freeze(input.mechanicalBlockers.map((entry) => (
      entry instanceof MechanicalBlocker ? entry : new MechanicalBlocker(entry)
    )));
    if (!Array.isArray(input.hardBlockers)) throw new Error("hardBlockers must be an array");
    this.hardBlockers = Object.freeze(clone(input.hardBlockers));
    if (!Array.isArray(input.requirementJudgments)) throw new Error("requirementJudgments must be an array");
    this.requirementJudgments = Object.freeze(input.requirementJudgments.map((entry) => (
      entry instanceof RequirementAcceptanceJudgment ? entry : new RequirementAcceptanceJudgment(entry)
    )));
    if (!Array.isArray(input.deferredFindings)) throw new Error("deferredFindings must be an array");
    this.deferredFindings = Object.freeze(input.deferredFindings.map((entry) => (
      entry instanceof DeferredAcceptanceFinding ? entry : new DeferredAcceptanceFinding(entry)
    )));
    this.userDecision = input.userDecision == null ? null : Object.freeze(clone(input.userDecision));
    if (this.userDecision !== null) {
      if (!USER_DECISION_CHOICES.has(this.userDecision.choice)) throw new Error("userDecision.choice is invalid");
      if (Number.isNaN(Date.parse(this.userDecision.decidedAt))) throw new Error("userDecision.decidedAt must be an ISO timestamp");
    }
    this.verdict = deriveAcceptanceReviewVerdict(this);
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      repairFingerprint: this.repairFingerprint,
      mechanicalBlockers: this.mechanicalBlockers.map((entry) => entry.toJSON()),
      hardBlockers: clone(this.hardBlockers),
      requirementJudgments: this.requirementJudgments.map((entry) => entry.toJSON()),
      deferredFindings: this.deferredFindings.map((entry) => entry.toJSON()),
      userDecision: this.userDecision == null ? null : clone(this.userDecision),
      verdict: this.verdict,
    };
  }
}

export class AcceptanceEvidenceBindings {
  constructor(context) {
    this.requestRef = "flow.request";
    this.requirementIds = Object.freeze([...context.requirementIds]);
    this.diffRefs = Object.freeze(
      [...String(context.evidence.diff || "").matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)]
        .flatMap((match) => [`diff:${match[1]}`, `diff:${match[2]}`]),
    );
    const repair = context.evidence.repairEvidence;
    const repairRefs = new Set([repair.ref]);
    if (repair.kind === "repair-audit") {
      for (const [index, entry] of (repair.artifact?.entries || []).entries()) {
        repairRefs.add(`${repair.ref}#entries[${index}]`);
        if (entry?.id) repairRefs.add(`${repair.ref}#${entry.id}`);
      }
    }
    this.repairRefs = Object.freeze([...repairRefs]);
    Object.freeze(this);
  }

  validate(input) {
    const judgment = input instanceof RequirementAcceptanceJudgment
      ? input
      : new RequirementAcceptanceJudgment(input);
    if (!this.requirementIds.includes(judgment.requirementId)) {
      throw new Error(`unknown requirement judgment: ${judgment.requirementId}`);
    }
    if (judgment.requestRefs.some((ref) => ref !== this.requestRef)) {
      throw new Error(`${judgment.requirementId}: requestRefs must cite ${this.requestRef}`);
    }
    const requirementRef = `spec.json#${judgment.requirementId}`;
    if (judgment.requirementRefs.some((ref) => ref !== requirementRef)) {
      throw new Error(`${judgment.requirementId}: requirementRefs must cite ${requirementRef}`);
    }
    if (judgment.diffRefs.some((ref) => !this.diffRefs.includes(ref))) {
      throw new Error(`${judgment.requirementId}: diffRefs contain a path outside the current diff`);
    }
    if (judgment.repairRefs.some((ref) => !this.repairRefs.includes(ref))) {
      throw new Error(`${judgment.requirementId}: repairRefs do not cite current repair evidence`);
    }
    const allowedTestRefs = new Set([
      "test-execute-result.json",
      `test-execute-result.json#${judgment.requirementId}`,
      "test-result-review.json",
    ]);
    if (judgment.testRefs.some((ref) => !allowedTestRefs.has(ref))) {
      throw new Error(`${judgment.requirementId}: testRefs do not cite current test evidence`);
    }
    return judgment;
  }
}

export function deriveAcceptanceReviewVerdict(artifact = {}) {
  if ((artifact.mechanicalBlockers || []).length > 0 || (artifact.hardBlockers || []).length > 0) return "blocked";
  const judgments = artifact.requirementJudgments || [];
  if (judgments.some((judgment) => judgment.status === "notMet")) return "repair_required";
  if (judgments.some((judgment) => judgment.status === "notVerifiable")) return "user_decision_required";
  return "pass";
}

function normalizeArtifact(input = {}) {
  return new AcceptanceReviewOutcome(input).toJSON();
}

export function validateAcceptanceReviewArtifact(artifact, { requirementIds = null } = {}) {
  const errors = validateSchema(artifact, acceptanceSchema());
  if (errors.length > 0) throw new Error(`acceptance-review schema validation failed: ${errors.join("; ")}`);
  if (!VERDICTS.has(artifact.verdict)) throw new Error(`invalid acceptance-review verdict: ${artifact.verdict}`);
  const judgments = artifact.requirementJudgments.map((entry) => new RequirementAcceptanceJudgment(entry));
  const expected = Array.isArray(requirementIds) ? requirementIds : judgments.map((entry) => entry.requirementId);
  const actual = new Set();
  for (const judgment of judgments) {
    if (actual.has(judgment.requirementId)) throw new Error(`duplicate requirement judgment: ${judgment.requirementId}`);
    actual.add(judgment.requirementId);
    if (!expected.includes(judgment.requirementId)) throw new Error(`unknown requirement judgment: ${judgment.requirementId}`);
  }
  for (const requirementId of expected) {
    if (!actual.has(requirementId)) throw new Error(`missing requirement judgment: ${requirementId}`);
  }
  const derived = deriveAcceptanceReviewVerdict(artifact);
  if (artifact.verdict !== derived) throw new Error(`acceptance-review verdict must match derived verdict: ${derived}`);
  return artifact;
}

function validateDeferredFindingCoverage(specDir, deferredFindings) {
  const expected = readFlowFindingsArtifact(specDir).entries.map((entry) => entry.findingId);
  const actual = deferredFindings.map((entry) => entry.findingId);
  if (new Set(actual).size !== actual.length) throw new Error("duplicate deferred finding classification");
  for (const findingId of expected) {
    if (!actual.includes(findingId)) throw new Error(`missing deferred finding classification: ${findingId}`);
  }
  for (const findingId of actual) {
    if (!expected.includes(findingId)) throw new Error(`unknown deferred finding classification: ${findingId}`);
  }
}

export function writeAcceptanceReviewArtifact({ specDir, artifact, requirementIds = null, fingerprint = null }) {
  const normalized = normalizeArtifact(artifact);
  const reportPath = path.join(specDir, "report.json");
  if (fs.existsSync(reportPath)) normalized.reportRefs = ["report.json"];
  validateDeferredFindingCoverage(specDir, normalized.deferredFindings);
  validateAcceptanceReviewArtifact(normalized, { requirementIds });
  if (!fingerprint) throw new Error("acceptance-review writer requires the current repair fingerprint");
  const written = writeRepairEvidenceArtifact({
    specDir,
    stepId: "acceptance-review",
    artifact: normalized,
    fingerprint,
  });
  if (normalized.deferredFindings.length > 0) mirrorFinalDispositions(specDir, normalized.deferredFindings);
  return written;
}

function dispositionEvidence(specDir) {
  const file = path.join(specDir, "acceptance-review-evidence.json");
  if (!fs.existsSync(file)) return new Map();
  const data = readJson(file);
  return new Map((data.deferredFindingDispositions || []).map((entry) => [entry.findingId, {
    finalDisposition: requireFinalDisposition(entry.finalDisposition),
    evidenceRefs: Array.isArray(entry.evidenceRefs) ? entry.evidenceRefs : [],
  }]));
}

function buildDeferredFindingsFromEvidence(specDir) {
  const evidence = dispositionEvidence(specDir);
  return readFlowFindingsArtifact(specDir).entries.map((entry) => {
    const decision = evidence.get(entry.findingId);
    return new DeferredAcceptanceFinding({
      findingId: entry.findingId,
      sourceStep: entry.sourceStep,
      sourceArtifact: entry.sourceArtifact,
      sourceFindingId: entry.sourceFindingId,
      finalDisposition: decision?.finalDisposition || "still_open",
      evidenceRefs: decision?.evidenceRefs || [],
    }).toJSON();
  });
}

function deferredSourceBlockers(specDir, deferredFindings) {
  const blockers = [];
  for (const finding of deferredFindings) {
    const source = readBoundedSourceArtifact(specDir, finding.sourceArtifact);
    if (!source || !JSON.stringify(source).includes(finding.sourceFindingId)) {
      blockers.push(new MechanicalBlocker({
        blockerId: `M-deferred-${blockers.length + 1}`,
        kind: "missing_deferred_source",
        summary: `Deferred source evidence is missing: ${finding.sourceArtifact}#${finding.sourceFindingId}.`,
      }).toJSON());
    } else if (finding.finalDisposition === "still_open" || finding.finalDisposition === "blocking") {
      blockers.push(new MechanicalBlocker({
        blockerId: `M-deferred-${blockers.length + 1}`,
        kind: "unresolved_deferred_finding",
        summary: `Deferred finding remains unresolved: ${finding.findingId}.`,
      }).toJSON());
    }
  }
  return blockers;
}

export function classifyMechanicalBlockers(input = {}) {
  const blockers = [];
  const add = (kind, summary) => blockers.push(new MechanicalBlocker({
    blockerId: `M-${blockers.length + 1}`,
    kind,
    summary,
  }).toJSON());
  if (input.tests?.missing) add("missing_tests", "Test evidence is missing.");
  if (input.tests?.failed) add("failed_tests", "Test evidence contains failures.");
  for (const id of input.tests?.missingRequired || []) add("missing_required_tests", `Required test coverage is missing for ${id}.`);
  for (const file of input.artifacts?.missing || []) add("missing_artifact", `Required artifact is missing: ${file}.`);
  for (const file of input.artifacts?.invalidSchemas || []) add("invalid_schema", `Required artifact is invalid: ${file}.`);
  return blockers;
}

function requirementList(specDir) {
  return readJson(path.join(specDir, "spec.json")).requirements || [];
}

function validateRequirementSummaryMembership(summary, requirements) {
  const expected = requirements.filter((entry) => entry.testable !== false).map((entry) => entry.id);
  const actual = Array.isArray(summary) ? summary.map((entry) => entry?.id) : [];
  if (new Set(actual).size !== actual.length) throw new Error("test-execute summary contains duplicate requirement ids");
  const missing = expected.filter((id) => !actual.includes(id));
  const unknown = actual.filter((id) => !expected.includes(id));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(`test-execute summary membership invalid: missing=${missing.join(",")} unknown=${unknown.join(",")}`);
  }
  return missing;
}

function readScenarioRawEvidence(specDir) {
  const file = path.join(specDir, "tests/.raw/scenario-validity.log");
  if (!fs.existsSync(file)) throw new Error("scenario-validity raw evidence is missing");
  const size = fs.statSync(file).size;
  if (size > MAX_ACCEPTANCE_RAW_EVIDENCE_BYTES) {
    throw new Error(`scenario-validity raw evidence exceeds ${MAX_ACCEPTANCE_RAW_EVIDENCE_BYTES} bytes`);
  }
  return fs.readFileSync(file, "utf8");
}

function validateImplReviewEvidence(artifact) {
  if (!artifact || typeof artifact !== "object") throw new Error("impl-review artifact must be an object");
  if (!["PASS", "ADVISORY", "FAIL"].includes(artifact.verdict)) throw new Error("impl-review verdict is invalid");
  if (!Array.isArray(artifact.blockingFindings)) throw new Error("impl-review blockingFindings must be an array");
  if (!Array.isArray(artifact.nonBlockingImprovements)) throw new Error("impl-review nonBlockingImprovements must be an array");
  if (!artifact.summary || typeof artifact.summary !== "object") throw new Error("impl-review summary is required");
  if (artifact.summary.blocking !== artifact.blockingFindings.length) throw new Error("impl-review blocking summary is inconsistent");
  if (artifact.summary.nonBlocking !== artifact.nonBlockingImprovements.length) throw new Error("impl-review non-blocking summary is inconsistent");
  const expectedVerdict = artifact.blockingFindings.length > 0
    ? "FAIL"
    : artifact.nonBlockingImprovements.length > 0 ? "ADVISORY" : "PASS";
  if (artifact.verdict !== expectedVerdict) throw new Error("impl-review verdict does not match findings");
  for (const finding of artifact.blockingFindings) requireString(finding?.findingId, "impl-review findingId");
}

function validateImplGateEvidence(artifact) {
  if (!artifact || typeof artifact !== "object") throw new Error("impl-gate artifact must be an object");
  if (!["pass", "fail"].includes(artifact.verdict)) throw new Error("impl-gate verdict is invalid");
  if (artifact.phase !== "integration") throw new Error("impl-gate phase must be integration");
  if (!Array.isArray(artifact.evaluations)) throw new Error("impl-gate evaluations must be an array");
  if (!Array.isArray(artifact.issues)) throw new Error("impl-gate issues must be an array");
  const hasFailure = artifact.issues.length > 0 || artifact.evaluations.some((entry) => entry?.result === "fail");
  if ((artifact.verdict === "pass") === hasFailure) throw new Error("impl-gate verdict does not match evaluations");
}

function validateRetroEvidence(artifact, requirements) {
  if (!artifact || typeof artifact !== "object") throw new Error("retro artifact must be an object");
  if (artifact.mode !== "result-file") throw new Error("retro mode must be result-file");
  if (Number.isNaN(Date.parse(artifact.date))) throw new Error("retro date must be an ISO timestamp");
  if (!Array.isArray(artifact.requirements)) throw new Error("retro requirements must be an array");
  if (!artifact.summary || typeof artifact.summary !== "object") throw new Error("retro summary is required");
  const expectedCount = requirements.filter((entry) => entry.testable !== false).length;
  if (artifact.requirements.length !== expectedCount || artifact.summary.total !== expectedCount) {
    throw new Error("retro requirement count is inconsistent");
  }
  if (!Number.isInteger(artifact.summary.not_done) || artifact.summary.not_done < 0) {
    throw new Error("retro summary.not_done is invalid");
  }
  for (const entry of artifact.requirements) {
    if (!new Set(["done", "not_done", "not_applicable"]).has(entry?.status)) {
      throw new Error("retro requirement status is invalid");
    }
  }
}

function mechanicalArtifactState({ root, specDir, fingerprint, requirements }) {
  const missing = [];
  const invalidSchemas = [];
  const artifacts = {};
  for (const file of REQUIRED_MECHANICAL_ARTIFACTS) {
    try {
      const value = readBoundedSourceArtifact(specDir, file);
      if (!value) missing.push(file);
      else artifacts[file] = value;
    } catch (_) {
      invalidSchemas.push(file);
    }
  }
  if (artifacts["scenario-validity-result.json"]) {
    try {
      const rawText = readScenarioRawEvidence(specDir);
      validateScenarioValidityResult(artifacts["scenario-validity-result.json"], {
        root,
        specDir,
        requirements,
        rawText,
      });
    } catch (_) {
      invalidSchemas.push("scenario-validity-result.json");
    }
  }
  let missingRequired = [];
  if (artifacts["test-execute-result.json"]) {
    try {
      validateTestExecuteResultV2(artifacts["test-execute-result.json"]);
      missingRequired = validateRequirementSummaryMembership(
        artifacts["test-execute-result.json"].summary,
        requirements,
      );
    } catch (_) {
      invalidSchemas.push("test-execute-result.json");
      const present = new Set((artifacts["test-execute-result.json"].summary || []).map((entry) => entry?.id));
      missingRequired = requirements
        .filter((entry) => entry.testable !== false && !present.has(entry.id))
        .map((entry) => entry.id);
    }
  }
  if (artifacts["test-result-review.json"]) {
    try {
      validateTestResultReview(artifacts["test-result-review.json"]);
    } catch (_) {
      invalidSchemas.push("test-result-review.json");
    }
  }
  const rejectedReviewTriage = artifacts["impl-review.json"]?.verdict === "FAIL"
    && !fs.existsSync(path.join(specDir, "impl-repair.json")) ? (() => {
    try {
      return readRejectedImplReviewTriage(specDir);
    } catch (_) {
      invalidSchemas.push("impl-triage.json");
      return null;
    }
  })() : null;
  if (artifacts["impl-review.json"]) {
    try {
      validateImplReviewEvidence(artifacts["impl-review.json"]);
    } catch (_) {
      invalidSchemas.push("impl-review.json");
    }
  }
  if (artifacts["impl-gate-result.json"]) {
    try {
      validateImplGateEvidence(artifacts["impl-gate-result.json"]);
    } catch (_) {
      invalidSchemas.push("impl-gate-result.json");
    }
  }
  if (artifacts["retro.json"]) {
    try {
      validateRetroEvidence(artifacts["retro.json"], requirements);
    } catch (_) {
      invalidSchemas.push("retro.json");
    }
  }
  if (fs.existsSync(path.join(specDir, "impl-repair.json"))) {
    try {
      const ledger = readImplRepairLedger(specDir);
      if (!ledger || ledger.entries.length === 0) throw new Error("impl-repair ledger must contain an entry");
      artifacts["impl-repair.json"] = ledger.toJSON();
    } catch (_) {
      invalidSchemas.push("impl-repair.json");
    }
  }
  for (const file of FINGERPRINTED_INPUT_ARTIFACTS) {
    if (!artifacts[file]) continue;
    try {
      assertRepairFingerprint({ artifact: artifacts[file], fingerprint, label: file });
    } catch (_) {
      invalidSchemas.push(file);
    }
  }
  const testSummary = artifacts["test-execute-result.json"]?.summary || [];
  const failed = artifacts["scenario-validity-result.json"]?.result !== "pass"
    || testSummary.some((entry) => entry.result === "fail")
    || artifacts["test-result-review.json"]?.verdict !== "pass"
    || (!rejectedReviewTriage && !["PASS", "ADVISORY"].includes(artifacts["impl-review.json"]?.verdict))
    || artifacts["impl-gate-result.json"]?.verdict !== "pass"
    || Number(artifacts["retro.json"]?.summary?.not_done || 0) > 0;
  return {
    artifacts,
    blockers: classifyMechanicalBlockers({
      tests: {
        missing: !artifacts["test-execute-result.json"],
        failed,
        missingRequired,
      },
      artifacts: { missing, invalidSchemas: [...new Set(invalidSchemas)] },
    }),
  };
}

export function buildAcceptanceReviewContext({ root, state, diff }) {
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  const fingerprint = buildRepairFingerprint({ root, specPath: state.spec });
  const requirements = requirementList(specDir);
  const mechanical = mechanicalArtifactState({ root, specDir, fingerprint, requirements });
  const deferredFindings = buildDeferredFindingsFromEvidence(specDir);
  const repairPath = path.join(specDir, "impl-repair.json");
  const implReview = mechanical.artifacts["impl-review.json"];
  const rejectedReviewTriage = !fs.existsSync(repairPath) && implReview?.verdict === "FAIL"
    ? readRejectedImplReviewTriage(specDir)
    : null;
  const repairEvidence = fs.existsSync(repairPath)
    ? {
        kind: "repair-audit",
        ref: "impl-repair.json",
        artifact: mechanical.artifacts["impl-repair.json"] || { invalid: true },
      }
    : rejectedReviewTriage
      ? { kind: "no-repair", ref: "impl-triage.json", artifact: rejectedReviewTriage }
      : { kind: "no-repair", ref: "acceptance:no-repair", artifact: { reason: "No implementation repair was required." } };
  return {
    root,
    specDir,
    fingerprint,
    requirementIds: requirements.map((entry) => entry.id),
    evidence: {
      originalRequest: typeof state.request === "string" && state.request.trim() !== "" ? state.request : null,
      requirements,
      diff,
      repairEvidence,
      testEvidence: mechanical.artifacts,
      deferredFindings,
    },
    mechanicalBlockers: [
      ...mechanical.blockers,
      ...deferredSourceBlockers(specDir, deferredFindings),
      ...(typeof state.request === "string" && state.request.trim() !== "" ? [] : [new MechanicalBlocker({
        blockerId: "M-request",
        kind: "missing_request",
        summary: "The original flow request is missing.",
      }).toJSON()]),
    ],
    deferredFindings,
  };
}

export function artifactFromAcceptanceJudgments({ context, requirementJudgments }) {
  const missingReason = context.mechanicalBlockers.map((entry) => entry.summary).join("; ") || "Mechanical evidence is unavailable.";
  const bindings = context.mechanicalBlockers.length > 0 ? null : new AcceptanceEvidenceBindings(context);
  const judgments = context.mechanicalBlockers.length > 0
    ? context.requirementIds.map((requirementId) => new RequirementAcceptanceJudgment({
      requirementId,
      status: "notVerifiable",
      requestRefs: ["flow.request"],
      requirementRefs: [`spec.json#${requirementId}`],
      diffRefs: [],
      repairRefs: [context.evidence.repairEvidence.ref],
      testRefs: [],
      missingEvidence: [missingReason],
    }).toJSON())
    : requirementJudgments.map((judgment) => bindings.validate(judgment).toJSON());
  return normalizeArtifact({
    version: 2,
    repairFingerprint: context.fingerprint.hash,
    mechanicalBlockers: context.mechanicalBlockers,
    hardBlockers: [],
    requirementJudgments: judgments,
    deferredFindings: context.deferredFindings,
    userDecision: null,
  });
}

function markStep(state, id, status) {
  const step = findStepById(state.steps || [], id);
  if (!step) return;
  step.status = status;
  if (status === "pending") {
    delete step.startedAt;
    delete step.finishedAt;
  }
}

function resetSteps(state, ids, inProgress = null) {
  for (const id of ids) markStep(state, id, id === inProgress ? "in_progress" : "pending");
}

function acceptanceArtifactPath(state) {
  return path.posix.join(path.posix.dirname(state.spec.split(path.sep).join("/")), ACCEPTANCE_REVIEW_ARTIFACT_FILE);
}

export function applyAcceptanceReviewResult({ root, flowManager, artifact }) {
  const state = flowManager.load();
  if (!state?.spec) throw new Error("active flow spec is required");
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  const requirements = requirementList(specDir);
  const fingerprint = buildRepairFingerprint({ root, specPath: state.spec });
  if (requireString(artifact.repairFingerprint, "repairFingerprint") !== fingerprint.hash) {
    throw new Error("acceptance-review repairFingerprint does not match current inputs");
  }
  const written = writeAcceptanceReviewArtifact({
    specDir,
    artifact,
    requirementIds: requirements.map((entry) => entry.id),
    fingerprint,
  });
  const next = written.artifact;
  if (next.verdict === "repair_required") {
    const findings = next.requirementJudgments
      .filter((judgment) => judgment.status === "notMet")
      .map((judgment) => ({
        findingId: `acceptance:${judgment.requirementId}`,
        summary: `Acceptance judgment is notMet for ${judgment.requirementId}.`,
        suggestion: `Repair ${judgment.requirementId} and regenerate evidence.`,
      }));
    prepareImplTriageArtifact({
      specDir,
      sourceStep: "acceptance-review",
      sourceArtifact: ACCEPTANCE_REVIEW_ARTIFACT_FILE,
      findings,
      fingerprint,
    });
  }
  flowManager.mutate((current) => {
    current.acceptanceReview = {
      verdict: next.verdict,
      artifactPath: acceptanceArtifactPath(current),
      requirementJudgments: next.requirementJudgments,
      mechanicalBlockers: next.mechanicalBlockers,
      deferredFindings: next.deferredFindings,
      updatedAt: new Date().toISOString(),
    };
    if (next.verdict === "pass") {
      markStep(current, "acceptance-review", "done");
      markStep(current, "acceptance-decision", "done");
      markStep(current, "final-regression", "in_progress");
    } else if (next.verdict === "repair_required") {
      resetSteps(current, flowLeafIdsBetween("impl-triage", "finalize-cleanup"), "impl-triage");
      markStep(current, "acceptance-review", "done");
      markStep(current, "impl-triage", "in_progress");
    } else if (next.verdict === "user_decision_required") {
      markStep(current, "acceptance-review", "done");
      markStep(current, "acceptance-decision", "in_progress");
      markStep(current, "final-regression", "pending");
    } else {
      markStep(current, "acceptance-review", "in_progress");
      markStep(current, "acceptance-decision", "pending");
      markStep(current, "final-regression", "pending");
    }
  });
  return { verdict: next.verdict, artifactPath: acceptanceArtifactPath(state), artifact: next, path: written.path };
}

function appendRiskDecisionIssue(root, state) {
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  const file = path.join(specDir, "issue-log.json");
  const issueLog = fs.existsSync(file) ? readJson(file) : { entries: [] };
  issueLog.entries = Array.isArray(issueLog.entries) ? issueLog.entries : [];
  issueLog.entries.push({
    step: "acceptance-decision",
    reason: "User explicitly selected accept_risk_and_continue for notVerifiable acceptance evidence.",
    trigger: "flow set acceptance-decision",
    resolution: "continue to final-regression with accepted risk",
    taskId: null,
    timestamp: new Date().toISOString(),
  });
  writeJson(file, issueLog);
}

export function applyAcceptanceDecision({ root, flowManager, choice }) {
  if (!USER_DECISION_CHOICES.has(choice)) throw new Error(`invalid acceptance decision choice: ${choice}`);
  const state = flowManager.load();
  if (!state?.spec) throw new Error("active flow spec is required");
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  const file = path.join(specDir, ACCEPTANCE_REVIEW_ARTIFACT_FILE);
  const artifact = readJson(file);
  if (artifact.verdict !== "user_decision_required") {
    throw new Error(`acceptance-decision is not available for verdict: ${artifact.verdict}`);
  }
  const fingerprint = buildRepairFingerprint({ root, specPath: state.spec });
  assertRepairFingerprint({ artifact, fingerprint, label: ACCEPTANCE_REVIEW_ARTIFACT_FILE });
  const userDecision = { choice, decidedAt: new Date().toISOString() };
  artifact.userDecision = userDecision;
  const written = writeAcceptanceReviewArtifact({
    specDir,
    artifact,
    requirementIds: requirementList(specDir).map((entry) => entry.id),
    fingerprint,
  });
  const decidedArtifact = written.artifact;
  flowManager.mutate((current) => {
    current.acceptanceReview = current.acceptanceReview || { verdict: decidedArtifact.verdict };
    current.acceptanceReview.userDecision = userDecision;
    markStep(current, "acceptance-decision", "done");
    if (choice === "accept_risk_and_continue") markStep(current, "final-regression", "in_progress");
    else current.acceptanceReview.status = "aborted";
  });
  if (choice === "accept_risk_and_continue") appendRiskDecisionIssue(root, state);
  return { verdict: decidedArtifact.verdict, choice, userDecision };
}

export { ACCEPTANCE_FINAL_DISPOSITIONS };
