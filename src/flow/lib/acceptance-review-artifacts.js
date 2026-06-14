import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchema } from "../../lib/schema-validate.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { collectFlowLeafIds } from "../definition.js";
import { findStepById } from "./step-tree.js";
import {
  readFlowFindingsArtifact,
  readBoundedSourceArtifact,
  mirrorFinalDispositions,
  validateFinalDisposition,
  ACCEPTANCE_FINAL_DISPOSITIONS,
} from "./flow-findings.js";

export const ACCEPTANCE_REVIEW_ARTIFACT_FILE = "acceptance-review.json";

const SCHEMA_PATH = fileURLToPath(new URL("../schemas/acceptance-review.schema.json", import.meta.url));
const VERDICTS = new Set(["pass", "amend_required", "user_decision_required", "blocked"]);
const USER_DECISION_CHOICES = new Set(["amend_and_retry", "abort", "accept_risk_and_continue"]);
const BLOCKED_DECISION_CHOICES = new Set(["repair_and_reevaluate", "abort", "accept_risk_and_continue"]);
const NON_PASS_NEXT_ACTIONS = new Set(["amend", "repair", "user_decision"]);
const NON_PASS_TARGET_STEPS = new Set(["spec", "test", "implement", "test-execute", "impl-review", "impl-gate"]);

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value;
}

function requireArray(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
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

function removeUndefined(value) {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) out[key] = removeUndefined(child);
    }
    return out;
  }
  return value;
}

function requireAcceptanceFinalDisposition(value, field = "finalDisposition") {
  const disposition = validateFinalDisposition(value, field);
  if (disposition === null) {
    throw new Error(`${field} must be one of ${ACCEPTANCE_FINAL_DISPOSITIONS.join(", ")}`);
  }
  return disposition;
}

export class AcceptanceFinding {
  constructor(input = {}) {
    this.findingId = requireString(input.findingId, "findingId");
    this.summary = requireString(input.summary, "summary");
    this.severity = requireString(input.severity, "severity");
    this.category = requireString(input.category, "category");
    this.mappedRequirementIds = requireArray(input.mappedRequirementIds, "mappedRequirementIds");
    this.linkedRequirementAmendmentProposalIds = requireArray(input.linkedRequirementAmendmentProposalIds, "linkedRequirementAmendmentProposalIds");
    this.evidenceRefs = requireArray(input.evidenceRefs, "evidenceRefs");
    this.confidence = requireString(input.confidence, "confidence");
    this.shouldReimplement = Boolean(input.shouldReimplement);
    this.reimplementationReason = typeof input.reimplementationReason === "string" ? input.reimplementationReason : "";
    this.requiresUserDecision = Boolean(input.requiresUserDecision);
    Object.freeze(this);
  }

  toJSON() {
    return { ...this };
  }
}

export class RequirementAmendmentProposal {
  constructor(input = {}) {
    this.proposalId = requireString(input.proposalId, "proposalId");
    this.proposalType = requireString(input.proposalType, "proposalType");
    this.targetRequirementIds = requireArray(input.targetRequirementIds, "targetRequirementIds");
    this.proposedRequirementSummary = requireString(input.proposedRequirementSummary, "proposedRequirementSummary");
    this.reason = requireString(input.reason, "reason");
    this.relationToOriginalRequest = requireString(input.relationToOriginalRequest, "relationToOriginalRequest");
    this.linkedFindingIds = requireArray(input.linkedFindingIds, "linkedFindingIds");
    this.shouldReimplementAfterAmendment = Boolean(input.shouldReimplementAfterAmendment);
    Object.freeze(this);
  }

  toJSON() {
    return { ...this };
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
    return { ...this };
  }
}

export class DeferredAcceptanceFinding {
  constructor(input = {}) {
    this.findingId = requireString(input.findingId, "findingId");
    this.sourceStep = requireString(input.sourceStep, "sourceStep");
    this.sourceArtifact = requireString(input.sourceArtifact, "sourceArtifact");
    this.sourceFindingId = requireString(input.sourceFindingId, "sourceFindingId");
    this.finalDisposition = requireAcceptanceFinalDisposition(input.finalDisposition, "finalDisposition");
    this.evidenceRefs = requireArray(input.evidenceRefs || [], "evidenceRefs");
    Object.freeze(this);
  }

  toJSON() {
    return { ...this };
  }
}

function normalizeArtifact(input) {
  const artifact = removeUndefined(clone(input));
  artifact.version = artifact.version ?? 1;
  artifact.findings = (artifact.findings || []).map((finding) => new AcceptanceFinding(finding).toJSON());
  artifact.requirementAmendmentProposals = (artifact.requirementAmendmentProposals || []).map((proposal) => new RequirementAmendmentProposal(proposal).toJSON());
  artifact.mechanicalBlockers = (artifact.mechanicalBlockers || []).map((blocker) => new MechanicalBlocker(blocker).toJSON());
  artifact.deferredFindings = (artifact.deferredFindings || []).map((finding) => new DeferredAcceptanceFinding(finding).toJSON());
  artifact.hardBlockers = artifact.hardBlockers || [];
  artifact.userDecision = artifact.userDecision === undefined ? null : artifact.userDecision;
  artifact.blockedDecision = artifact.blockedDecision === undefined ? null : artifact.blockedDecision;
  artifact.verdict = deriveAcceptanceReviewVerdict(artifact);
  return artifact;
}

export function validateAcceptanceReviewArtifact(artifact) {
  const errors = validateSchema(artifact, acceptanceSchema());
  if (errors.length > 0) throw new Error(`acceptance-review schema validation failed: ${errors.join("; ")}`);
  if (!VERDICTS.has(artifact.verdict)) throw new Error(`invalid acceptance-review verdict: ${artifact.verdict}`);
  const derivedVerdict = deriveAcceptanceReviewVerdict(artifact);
  if (artifact.verdict !== derivedVerdict) {
    throw new Error(`acceptance-review verdict must match evidence-derived verdict: ${derivedVerdict}`);
  }
  if (artifact.verdict !== "pass") {
    if (!NON_PASS_NEXT_ACTIONS.has(artifact.nextAction)) {
      throw new Error(`nextAction must be one of ${[...NON_PASS_NEXT_ACTIONS].join(", ")} for non-pass acceptance-review`);
    }
    if (!NON_PASS_TARGET_STEPS.has(artifact.targetStep)) {
      throw new Error(`targetStep must be one of ${[...NON_PASS_TARGET_STEPS].join(", ")} for non-pass acceptance-review`);
    }
  }
  return artifact;
}

export function deriveAcceptanceReviewVerdict(artifact = {}) {
  if (Array.isArray(artifact.mechanicalBlockers) && artifact.mechanicalBlockers.length > 0) return "blocked";
  const deferredFindings = Array.isArray(artifact.deferredFindings) ? artifact.deferredFindings : [];
  if (deferredFindings.some((finding) => finding?.finalDisposition === "blocking")) return "blocked";
  if (artifact.nextAction === "user_decision" && artifact.verdict === "user_decision_required") {
    return "user_decision_required";
  }
  if (deferredFindings.some((finding) => finding?.finalDisposition === "still_open")) return "amend_required";
  if (Array.isArray(artifact.hardBlockers) && artifact.hardBlockers.length > 0) return "amend_required";
  if (Array.isArray(artifact.findings) && artifact.findings.some((finding) => finding?.requiresUserDecision === true)) {
    return "user_decision_required";
  }
  const thresholds = artifact.thresholds || {};
  const goalPass = thresholds.goalSatisfactionPass ?? 0.9;
  if (Number(artifact.goalSatisfactionScore) < goalPass) return "amend_required";
  if (artifact.verdict && artifact.verdict !== "pass") return artifact.verdict;
  return "pass";
}

function validateDeferredFindingCoverage(specDir, deferredFindings = []) {
  const expectedEntries = readFlowFindingsArtifact(specDir).entries;
  const expectedIds = new Set(expectedEntries.map((entry) => entry.findingId));
  const actualIds = new Set();
  for (const finding of deferredFindings) {
    if (actualIds.has(finding.findingId)) {
      throw new Error(`duplicate deferred finding classification: ${finding.findingId}`);
    }
    actualIds.add(finding.findingId);
    if (!expectedIds.has(finding.findingId)) {
      throw new Error(`unknown deferred finding classification: ${finding.findingId}`);
    }
  }
  for (const findingId of expectedIds) {
    if (!actualIds.has(findingId)) {
      throw new Error(`missing deferred finding classification: ${findingId}`);
    }
  }
}

export function classifyMechanicalBlockers(input = {}) {
  const blockers = [];
  function add(kind, summary) {
    blockers.push(new MechanicalBlocker({
      blockerId: `M-${blockers.length + 1}`,
      kind,
      summary,
    }).toJSON());
  }
  if (input.tests?.missing) add("missing_tests", "Test evidence is missing.");
  if (input.tests?.failed) add("failed_tests", "Test evidence contains failures.");
  for (const reqId of input.tests?.missingRequired || []) add("missing_required_tests", `Required test coverage is missing for ${reqId}.`);
  for (const file of input.artifacts?.missing || []) add("missing_artifact", `Required artifact is missing: ${file}.`);
  for (const file of input.artifacts?.invalidSchemas || []) add("invalid_schema", `Required artifact schema is invalid: ${file}.`);
  return blockers;
}

function sourceIncludesFindingId(source, sourceFindingId) {
  if (!source || typeof sourceFindingId !== "string" || sourceFindingId.trim() === "") return false;
  return JSON.stringify(source).includes(sourceFindingId);
}

function deferredSourceBlockers(specDir, deferredFindings) {
  const blockers = [];
  function add(kind, summary) {
    blockers.push(new MechanicalBlocker({
      blockerId: `M-deferred-source-${blockers.length + 1}`,
      kind,
      summary,
    }).toJSON());
  }
  for (const finding of deferredFindings) {
    const source = readBoundedSourceArtifact(specDir, finding.sourceArtifact);
    if (!source) {
      add("missing_deferred_source", `Deferred finding source artifact is missing: ${finding.sourceArtifact}.`);
    } else if (!sourceIncludesFindingId(source, finding.sourceFindingId)) {
      add("missing_deferred_source_finding", `Deferred source finding is missing: ${finding.sourceArtifact}#${finding.sourceFindingId}.`);
    }
  }
  return blockers;
}

export function writeAcceptanceReviewArtifact({ specDir, artifact }) {
  const normalized = normalizeArtifact(artifact);
  const reportPath = path.join(specDir, "report.json");
  if (fs.existsSync(reportPath)) normalized.reportRefs = ["report.json"];
  else delete normalized.reportRefs;
  validateDeferredFindingCoverage(specDir, normalized.deferredFindings);
  validateAcceptanceReviewArtifact(normalized);
  const file = path.join(specDir, ACCEPTANCE_REVIEW_ARTIFACT_FILE);
  writeJson(file, normalized);
  if (Array.isArray(normalized.deferredFindings) && normalized.deferredFindings.length > 0) {
    mirrorFinalDispositions(specDir, normalized.deferredFindings);
  }
  return { path: file, artifact: normalized };
}

function flowOrderRange(startId, endId) {
  const order = collectFlowLeafIds();
  const start = order.indexOf(startId);
  const end = order.indexOf(endId);
  if (start < 0 || end < start) throw new Error(`invalid flow reset range: ${startId}..${endId}`);
  return order.slice(start, end + 1);
}

function resetSteps(state, ids, { inProgress = null } = {}) {
  for (const id of ids) {
    const step = findStepById(state.steps || [], id);
    if (!step) continue;
    step.status = id === inProgress ? "in_progress" : "pending";
    delete step.startedAt;
    delete step.finishedAt;
  }
}

function markStep(state, id, status) {
  const step = findStepById(state.steps || [], id);
  if (step) step.status = status;
}

function acceptanceArtifactPath(state) {
  const specDir = path.posix.dirname(state.spec.split(path.sep).join("/"));
  return path.posix.join(specDir, ACCEPTANCE_REVIEW_ARTIFACT_FILE);
}

function appendIssueLog(root, state, reason) {
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  const file = path.join(specDir, "issue-log.json");
  const data = fs.existsSync(file) ? readJson(file) : { entries: [] };
  data.entries = Array.isArray(data.entries) ? data.entries : [];
  data.entries.push({
    step: "acceptance-review",
    reason,
    trigger: "acceptance-decision",
    resolution: "user accepted risk and continued to final-regression",
    taskId: null,
    timestamp: new Date().toISOString(),
  });
  writeJson(file, data);
}

export function applyAcceptanceReviewResult({ root, flowManager, artifact }) {
  const state = flowManager.load();
  if (!state?.spec) throw new Error("active flow spec is required");
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  const currentRound = Number.isInteger(state.acceptanceReview?.round) ? state.acceptanceReview.round : 0;
  const preliminary = normalizeArtifact(artifact);
  const nextRound = preliminary.verdict === "pass" ? currentRound : currentRound + 1;
  const artifactForWrite = preliminary.verdict !== "pass" && nextRound >= 2
    ? {
      ...preliminary,
      verdict: preliminary.verdict === "blocked" ? "blocked" : "user_decision_required",
      nextAction: "user_decision",
    }
    : preliminary;
  const written = writeAcceptanceReviewArtifact({ specDir, artifact: artifactForWrite });
  const next = written.artifact;
  flowManager.mutate((s) => {
    s.acceptanceReview = {
      verdict: next.verdict,
      artifactPath: acceptanceArtifactPath(s),
      findings: next.findings,
      deferredFindings: next.deferredFindings || [],
      requirementAmendmentProposals: next.requirementAmendmentProposals,
      mechanicalBlockers: next.mechanicalBlockers,
      hardBlockers: next.hardBlockers,
      nextAction: next.nextAction || null,
      targetStep: next.targetStep || null,
      round: nextRound,
      updatedAt: new Date().toISOString(),
    };
    if (next.verdict === "pass") {
      markStep(s, "acceptance-review", "done");
      markStep(s, "final-regression", "in_progress");
    } else if (next.nextAction === "repair" || next.nextAction === "amend") {
      resetSteps(s, flowOrderRange(next.targetStep, "acceptance-review"), { inProgress: next.targetStep });
    } else {
      markStep(s, "acceptance-review", "in_progress");
    }
  });
  return { verdict: next.verdict, artifactPath: acceptanceArtifactPath(state), artifact: next, path: written.path };
}

function readAcceptanceArtifact(root, state) {
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  return readJson(path.join(specDir, ACCEPTANCE_REVIEW_ARTIFACT_FILE));
}

export function applyAcceptanceDecision({ root, flowManager, choice }) {
  const state = flowManager.load();
  if (!state?.spec) throw new Error("active flow spec is required");
  const artifact = readAcceptanceArtifact(root, state);
  const verdict = state.acceptanceReview?.verdict || artifact.verdict;
  const decidedAt = new Date().toISOString();
  if (verdict === "user_decision_required") {
    if (!USER_DECISION_CHOICES.has(choice)) throw new Error(`invalid acceptance decision for user_decision_required: ${choice}`);
    if (choice === "accept_risk_and_continue" && artifact.mechanicalBlockers?.length > 0) {
      throw new Error("accept_risk_and_continue is not allowed while mechanicalBlockers exist");
    }
    flowManager.mutate((s) => {
      s.acceptanceReview = s.acceptanceReview || { verdict };
      s.acceptanceReview.userDecision = { choice, decidedAt };
      if (choice === "amend_and_retry") {
        resetSteps(s, flowOrderRange(artifact.targetStep || "spec", "acceptance-review"), { inProgress: artifact.targetStep || "spec" });
      } else if (choice === "abort") {
        s.acceptanceReview.status = "aborted";
      } else {
        markStep(s, "acceptance-review", "done");
        markStep(s, "final-regression", "in_progress");
      }
    });
    if (choice === "accept_risk_and_continue") {
      appendIssueLog(root, state, "acceptance-review accept_risk_and_continue selected for user_decision_required verdict");
    }
    return { verdict, choice };
  }
  if (verdict === "blocked") {
    if (!BLOCKED_DECISION_CHOICES.has(choice)) throw new Error(`invalid acceptance decision for blocked: ${choice}`);
    if (choice === "accept_risk_and_continue" && artifact.mechanicalBlockers?.length > 0) {
      throw new Error("accept_risk_and_continue is not allowed while mechanicalBlockers exist");
    }
    flowManager.mutate((s) => {
      s.acceptanceReview = s.acceptanceReview || { verdict };
      s.acceptanceReview.blockedDecision = { choice, decidedAt };
      if (choice === "repair_and_reevaluate") {
        const target = artifact.targetStep || artifact.repairTargetStep || "implement";
        resetSteps(s, flowOrderRange(target, "acceptance-review"), { inProgress: target });
      } else if (choice === "accept_risk_and_continue") {
        markStep(s, "acceptance-review", "done");
        markStep(s, "final-regression", "in_progress");
      } else {
        s.acceptanceReview.status = "aborted";
      }
    });
    return { verdict, choice };
  }
  throw new Error(`acceptance-decision is not available for verdict: ${verdict}`);
}

function requiredArtifactStatus(specDir, file) {
  const full = path.join(specDir, file);
  if (!fs.existsSync(full)) return { missing: true };
  try {
    return { value: readJson(full) };
  } catch (_) {
    return { invalid: true };
  }
}

function testFilesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.test\.[cm]?js$/.test(entry.name)) out.push(full);
    }
  }
  return out;
}

function testableRequirementIds(specDir) {
  const spec = readJson(path.join(specDir, "spec.json"));
  return (spec.requirements || [])
    .filter((requirement) => requirement.testable !== false)
    .map((requirement) => requirement.id);
}

function missingRequiredTestIds(specDir) {
  const result = readJson(path.join(specDir, "test-execute-result.json"));
  const summaryIds = new Set((result.summary || []).map((entry) => entry.id));
  return testableRequirementIds(specDir).filter((id) => !summaryIds.has(id));
}

export function buildAcceptanceReviewArtifactFromEvidence({ specDir }) {
  const required = ["scenario-validity-result.json", "test-execute-result.json", "test-result-review.json", "retro.json"];
  const missing = [];
  const invalidSchemas = [];
  for (const file of required) {
    const status = requiredArtifactStatus(specDir, file);
    if (status.missing) missing.push(file);
    if (status.invalid) invalidSchemas.push(file);
  }
  let failed = false;
  for (const file of ["test-execute-result.json", "test-result-review.json"]) {
    const full = path.join(specDir, file);
    if (!fs.existsSync(full)) continue;
    try {
      const value = readJson(full);
      if (value.result === "fail" || value.verdict === "fail") failed = true;
    } catch (_) {
      // invalid schema is already classified above
    }
  }
  const testsMissing = testableRequirementIds(specDir).length > 0 && testFilesIn(path.join(specDir, "tests")).length === 0;
  let missingRequired = [];
  try {
    missingRequired = missingRequiredTestIds(specDir);
  } catch (_) {
    missingRequired = testableRequirementIds(specDir);
  }
  const deferredFindings = buildDeferredFindingsFromEvidence(specDir);
  const mechanicalBlockers = [
    ...classifyMechanicalBlockers({
    tests: { missing: testsMissing, failed, missingRequired },
    artifacts: { missing, invalidSchemas },
    }),
    ...deferredSourceBlockers(specDir, deferredFindings),
  ];
  const hasBlockingDeferred = deferredFindings.some((finding) => finding.finalDisposition === "blocking");
  const hasStillOpenDeferred = deferredFindings.some((finding) => finding.finalDisposition === "still_open");
  const hasBlocking = mechanicalBlockers.length > 0 || hasBlockingDeferred;
  const hasRepairNeeded = hasBlocking || hasStillOpenDeferred;
  return {
    version: 1,
    goalSatisfactionScore: hasRepairNeeded ? 0 : 1,
    requirementAlignmentScore: hasRepairNeeded ? 0 : 1,
    implementationQualityScore: mechanicalBlockers.length ? 0 : 1,
    acceptanceScore: hasRepairNeeded ? 0 : 1,
    thresholds: {
      goalSatisfactionPass: 0.9,
      requirementAlignmentPass: 0.9,
      implementationQualityPass: 0.8,
    },
    mechanicalBlockers,
    hardBlockers: [],
    attempt: 1,
    findings: [],
    deferredFindings,
    requirementAmendmentProposals: [],
    userDecision: null,
    blockedDecision: null,
    verdict: hasBlocking ? "blocked" : (hasRepairNeeded ? "amend_required" : "pass"),
    nextAction: hasRepairNeeded ? "repair" : undefined,
    targetStep: mechanicalBlockers.length ? "test-execute" : (hasRepairNeeded ? "implement" : undefined),
  };
}

function readDispositionEvidence(specDir) {
  const file = path.join(specDir, "acceptance-review-evidence.json");
  if (!fs.existsSync(file)) return new Map();
  const data = readJson(file);
  const map = new Map();
  for (const entry of data.deferredFindingDispositions || []) {
    requireAcceptanceFinalDisposition(entry.finalDisposition, "finalDisposition");
    map.set(entry.findingId, {
      finalDisposition: entry.finalDisposition,
      evidenceRefs: Array.isArray(entry.evidenceRefs) ? entry.evidenceRefs : [],
    });
  }
  return map;
}

function buildDeferredFindingsFromEvidence(specDir) {
  const flowFindings = readFlowFindingsArtifact(specDir);
  const evidence = readDispositionEvidence(specDir);
  return flowFindings.entries.map((entry) => {
    const classified = evidence.get(entry.findingId);
    return new DeferredAcceptanceFinding({
      findingId: entry.findingId,
      sourceStep: entry.sourceStep,
      sourceArtifact: entry.sourceArtifact,
      sourceFindingId: entry.sourceFindingId,
      finalDisposition: classified?.finalDisposition || "still_open",
      evidenceRefs: classified?.evidenceRefs || [],
    }).toJSON();
  });
}

export { ACCEPTANCE_FINAL_DISPOSITIONS };
