import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { AtomicJsonFile } from "../../lib/atomic-json-file.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { missingExactTargetGuardNames } from "../../lib/flow-target-guard.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { collectFlowLeafIds, findActiveNode } from "../definition.js";
import { FlowCommand } from "./base-command.js";
import { buildRepairFingerprint } from "./impl-repair-artifacts.js";
import {
  MAX_REVIEW_EVIDENCE_BYTES,
  ReviewTargetState,
} from "./review-convergence.js";
import {
  ReviewEvidenceInput,
  resolveCurrentReviewTreeSha,
} from "./review-evidence-store.js";
import { flowReviewRouteForPhase } from "./review-route.js";
import { findStepById } from "./step-tree.js";

const REVIEW_PASS_RECOVERY_VERSION = 1;
const FLOW_LEAF_IDS = Object.freeze(collectFlowLeafIds());

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export class CanonicalReviewPassRecoveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CanonicalReviewPassRecoveryError";
    this.code = code;
  }
}

function reject(code, message) {
  throw new CanonicalReviewPassRecoveryError(code, message);
}

class BoundedReviewJsonFile {
  constructor({ root, file, boundary, label }) {
    this.root = fs.realpathSync(path.resolve(root));
    this.file = path.resolve(file);
    this.boundary = fs.realpathSync(path.resolve(boundary));
    this.label = label;
    if (!isInside(this.boundary, this.file)) {
      reject("REVIEW_PASS_RECOVERY_PATH_INVALID", `${label} must stay inside its review directory`);
    }
    Object.freeze(this);
  }

  read({ optional = false } = {}) {
    let stat;
    try {
      stat = fs.lstatSync(this.file);
    } catch (error) {
      if (optional && error.code === "ENOENT") return null;
      reject("REVIEW_PASS_RECOVERY_ARTIFACT_INVALID", `${this.label} is unavailable: ${error.message}`);
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      reject(
        "REVIEW_PASS_RECOVERY_ARTIFACT_INVALID",
        `${this.label} must be a regular file and cannot be a symbolic link`,
      );
    }
    if (stat.size > MAX_REVIEW_EVIDENCE_BYTES) {
      reject(
        "REVIEW_PASS_RECOVERY_ARTIFACT_INVALID",
        `${this.label} exceeds ${MAX_REVIEW_EVIDENCE_BYTES} bytes`,
      );
    }
    if (!isInside(this.boundary, fs.realpathSync(this.file))) {
      reject("REVIEW_PASS_RECOVERY_PATH_INVALID", `${this.label} resolves outside its review directory`);
    }
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch (error) {
      if (optional) return null;
      reject("REVIEW_PASS_RECOVERY_ARTIFACT_INVALID", `${this.label} is invalid JSON: ${error.message}`);
    }
  }
}

class HistoricalReviewPass {
  constructor({ artifact, relativePath, canonicalEvidence, route }) {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
      reject("REVIEW_PASS_RECOVERY_HISTORY_INVALID", `${relativePath} must contain a JSON object`);
    }
    if (
      artifact.version !== 1
      || artifact.phase !== canonicalEvidence.phase
      || artifact.sourceArtifact !== route.projectionFile
      || artifact.verdict !== "PASS"
      || artifact.generatedAt !== canonicalEvidence.provenance.capturedAt
      || !Number.isSafeInteger(artifact.attempt)
      || artifact.attempt < 1
    ) {
      reject(
        "REVIEW_PASS_RECOVERY_HISTORY_INVALID",
        `${relativePath} does not match the canonical PASS identity`,
      );
    }
    const findings = artifact.findings;
    if (!Array.isArray(findings) || findings.length !== 0) {
      reject(
        "REVIEW_PASS_RECOVERY_HISTORY_INVALID",
        `${relativePath} is not a finding-free canonical PASS projection`,
      );
    }
    const {
      sourceArtifact: _sourceArtifact,
      attempt: _attempt,
      findings: _findings,
      ...projection
    } = artifact;
    if (
      Object.hasOwn(projection, "toolingOutcome")
      || projection.verdict !== "PASS"
    ) {
      reject(
        "REVIEW_PASS_RECOVERY_HISTORY_INVALID",
        `${relativePath} is not a finalized PASS provider projection`,
      );
    }
    this.relativePath = relativePath;
    this.attempt = artifact.attempt;
    this.projection = Object.freeze(projection);
    Object.freeze(this);
  }
}

class CanonicalReviewPassRecord {
  constructor({ record, evidenceInput, currentTreeSha, targetState }) {
    if (
      record?.phase !== evidenceInput.phase
      || (record.taskId ?? null) !== null
      || record.treeSha !== currentTreeSha
      || record.targetStateDigest !== targetState.digest
      || record.targetState?.digest !== targetState.digest
      || record.evidence?.disposition !== "PASS"
      || record.evidence?.evidenceId !== evidenceInput.evidence.identity.evidenceDigest
      || record.evidenceIdentity?.evidenceDigest !== evidenceInput.evidence.identity.evidenceDigest
      || record.evidenceIdentity?.phase !== evidenceInput.phase
      || (record.evidenceIdentity?.taskId ?? null) !== null
      || record.evidenceIdentity?.treeSha !== currentTreeSha
      || record.canonicalEvidenceRef !== `review-evidence/${evidenceInput.evidence.identity.evidenceDigest}.json`
      || !Array.isArray(record.evidenceHistory)
      || !record.evidenceHistory.some((entry) => (
        entry?.phase === evidenceInput.phase
        && (entry.taskId ?? null) === null
        && entry.treeSha === currentTreeSha
        && entry.evidenceDigest === evidenceInput.evidence.identity.evidenceDigest
      ))
    ) {
      reject(
        "REVIEW_PASS_RECOVERY_IDENTITY_MISMATCH",
        "stored review convergence does not match the canonical PASS identity",
      );
    }
    const recordedTargetState = new ReviewTargetState(record.targetState);
    if (stableStringify(recordedTargetState.toJSON()) !== stableStringify(targetState.toJSON())) {
      reject(
        "REVIEW_PASS_RECOVERY_IDENTITY_MISMATCH",
        "stored review target state does not match the current target state",
      );
    }
    if (
      stableStringify(record.evidenceIdentity.provenance)
      !== stableStringify(evidenceInput.evidence.provenance.toJSON())
    ) {
      reject(
        "REVIEW_PASS_RECOVERY_IDENTITY_MISMATCH",
        "stored review provenance does not match the canonical PASS provenance",
      );
    }
    this.record = record;
    this.evidenceDigest = evidenceInput.evidence.identity.evidenceDigest;
    this.canonicalEvidenceRef = record.canonicalEvidenceRef;
    Object.freeze(this);
  }
}

function phaseRoute(phase) {
  const route = flowReviewRouteForPhase(phase);
  if (!route) {
    reject(
      "REVIEW_PASS_RECOVERY_PHASE_UNSUPPORTED",
      `canonical review PASS recovery does not support phase ${phase || "missing"}`,
    );
  }
  return route;
}

function recoveryLifecycle(state, route) {
  const active = findActiveNode(state);
  if (active?.scope !== "flow") return null;
  if (findStepById(state.steps || [], route.reviewStepId)?.status !== "done") return null;
  if (!route.bypassStepIds.every((stepId) => (
    ["done", "skipped"].includes(findStepById(state.steps || [], stepId)?.status)
  ))) return null;
  const reviewIndex = FLOW_LEAF_IDS.indexOf(route.reviewStepId);
  const activeIndex = FLOW_LEAF_IDS.indexOf(active.stepId);
  if (reviewIndex < 0 || activeIndex <= reviewIndex) return null;
  return active;
}

function latestPassAttempt(state, route) {
  return (state.stepAttempts || []).findLast((entry) => (
    entry?.runId === state.runId
    && (entry.taskId ?? null) === null
    && entry.stepId === route.reviewStepId
    && entry.outcome?.kind === "decision"
    && entry.outcome?.terminal === true
    && entry.outcome?.decision === "PASS"
  )) || null;
}

function convergencePassRecord(state, phase, currentTreeSha, targetStateDigest) {
  const matches = (state.reviewConvergence?.records || []).filter((record) => (
    record?.phase === phase
    && (record.taskId ?? null) === null
    && record.treeSha === currentTreeSha
    && record.targetStateDigest === targetStateDigest
    && record.evidence?.disposition === "PASS"
  ));
  if (matches.length > 1) {
    reject(
      "REVIEW_PASS_RECOVERY_IDENTITY_AMBIGUOUS",
      "multiple canonical PASS records match the active review target",
    );
  }
  return matches[0] || null;
}

function readCanonicalEvidence({ root, specDir, phase, record, treeSha, targetStateDigest }) {
  const expectedRef = `review-evidence/${record.evidence?.evidenceId}.json`;
  if (record.canonicalEvidenceRef !== expectedRef) {
    reject(
      "REVIEW_PASS_RECOVERY_IDENTITY_MISMATCH",
      "canonical review evidence reference does not match the stored evidence digest",
    );
  }
  let evidenceInput;
  try {
    evidenceInput = ReviewEvidenceInput.fromFile({
      root,
      specDir,
      inputPath: path.relative(root, path.join(specDir, expectedRef)),
    });
    evidenceInput.validateTarget({
      phase,
      taskId: null,
      treeSha,
    });
    if (
      evidenceInput.evidence.targetStateDigest != null
      && evidenceInput.evidence.targetStateDigest !== targetStateDigest
    ) {
      reject(
        "REVIEW_PASS_RECOVERY_EVIDENCE_INVALID",
        "canonical PASS evidence target-state digest does not match the current target",
      );
    }
  } catch (error) {
    reject(
      "REVIEW_PASS_RECOVERY_EVIDENCE_INVALID",
      `canonical PASS evidence is invalid: ${error.message}`,
    );
  }
  if (
    evidenceInput.disposition.value !== "PASS"
    || evidenceInput.evidence.identity.evidenceDigest !== record.evidence.evidenceId
  ) {
    reject(
      "REVIEW_PASS_RECOVERY_EVIDENCE_INVALID",
      "canonical evidence digest or disposition does not match the stored PASS record",
    );
  }
  return evidenceInput;
}

function readHistoricalPass({ root, specDir, route, canonicalEvidence }) {
  const historyDir = path.join(specDir, "review-history");
  let names;
  try {
    names = fs.readdirSync(historyDir)
      .filter((name) => route.historyPattern.test(name))
      .sort();
  } catch (error) {
    reject(
      "REVIEW_PASS_RECOVERY_HISTORY_INVALID",
      `review history is unavailable: ${error.message}`,
    );
  }
  const matches = [];
  for (const name of names) {
    const relativePath = `review-history/${name}`;
    const artifact = new BoundedReviewJsonFile({
      root,
      file: path.join(historyDir, name),
      boundary: historyDir,
      label: relativePath,
    }).read();
    if (
      artifact?.verdict !== "PASS"
      || artifact.generatedAt !== canonicalEvidence.provenance.capturedAt
    ) continue;
    matches.push(new HistoricalReviewPass({
      artifact,
      relativePath,
      canonicalEvidence,
      route,
    }));
  }
  if (matches.length !== 1) {
    reject(
      matches.length === 0
        ? "REVIEW_PASS_RECOVERY_HISTORY_MISSING"
        : "REVIEW_PASS_RECOVERY_HISTORY_AMBIGUOUS",
      `expected one canonical PASS history artifact, found ${matches.length}`,
    );
  }
  return matches[0];
}

function projectionProblem({ root, specDir, route, expectedProjection, record }) {
  const projection = new BoundedReviewJsonFile({
    root,
    file: path.join(specDir, route.projectionFile),
    boundary: specDir,
    label: route.projectionFile,
  }).read({ optional: true });
  return {
    currentProjection: projection,
    projectionMatches: stableStringify(projection) === stableStringify(expectedProjection),
    convergenceMatches: (
      record.toolingOutcome == null
      && record.blocker == null
      && record.finalizedEvidenceAvailable === true
    ),
  };
}

export class CanonicalReviewPassRecoveryPlan {
  constructor({
    root,
    specDir,
    phase,
    route,
    state,
    activeStepId,
    recordIndex,
    canonicalRecord,
    history,
    targetState,
    currentTreeSha,
    problem,
  }) {
    this.root = root;
    this.specDir = specDir;
    this.phase = phase;
    this.route = route;
    this.state = state;
    this.activeStepId = activeStepId;
    this.recordIndex = recordIndex;
    this.canonicalRecord = canonicalRecord;
    this.history = history;
    this.targetState = targetState;
    this.currentTreeSha = currentTreeSha;
    this.problem = problem;
    this.projectionDigest = sha256(stableStringify(history.projection));
    Object.freeze(this);
  }

  get recoveryNeeded() {
    return !this.problem.projectionMatches || !this.problem.convergenceMatches;
  }

  matchingReceipt(state = this.state) {
    return (state.canonicalReviewPassRecoveries || []).find((receipt) => (
      receipt?.version === REVIEW_PASS_RECOVERY_VERSION
      && receipt.runId === state.runId
      && receipt.spec === state.spec
      && receipt.phase === this.phase
      && receipt.evidenceDigest === this.canonicalRecord.evidenceDigest
      && receipt.projectionDigest === this.projectionDigest
    )) || null;
  }

  writeProjection() {
    new AtomicJsonFile(path.join(this.specDir, this.route.projectionFile))
      .write(this.history.projection);
  }

  applyState(flowManager, recoveredAt = new Date().toISOString()) {
    const invalidatesActiveDownstream = this.activeStepId === this.route.passNextStepId;
    const receipt = Object.freeze({
      version: REVIEW_PASS_RECOVERY_VERSION,
      runId: this.state.runId,
      issue: this.state.issue ?? null,
      spec: this.state.spec,
      phase: this.phase,
      treeSha: this.currentTreeSha,
      targetStateDigest: this.targetState.digest,
      evidenceDigest: this.canonicalRecord.evidenceDigest,
      canonicalEvidenceRef: this.canonicalRecord.canonicalEvidenceRef,
      historyRef: this.history.relativePath,
      projectionDigest: this.projectionDigest,
      invalidatedDownstreamStep: invalidatesActiveDownstream
        ? this.route.passNextStepId
        : null,
      recoveredAt,
    });
    flowManager.mutate((current) => {
      const record = current.reviewConvergence?.records?.[this.recordIndex];
      if (
        record?.phase !== this.phase
        || record?.evidence?.evidenceId !== this.canonicalRecord.evidenceDigest
        || record?.treeSha !== this.currentTreeSha
        || record?.targetStateDigest !== this.targetState.digest
      ) {
        reject(
          "REVIEW_PASS_RECOVERY_AUTHORITY_CHANGED",
          "canonical PASS authority changed before the recovery mutation",
        );
      }
      current.reviewConvergence.records[this.recordIndex] = {
        ...record,
        toolingAttempts: 0,
        finalizedEvidenceAvailable: true,
        blocker: null,
        toolingOutcome: null,
        updatedAt: recoveredAt,
      };
      if (invalidatesActiveDownstream) {
        const downstream = findStepById(current.steps || [], this.route.passNextStepId);
        if (downstream?.status !== "in_progress") {
          reject(
            "REVIEW_PASS_RECOVERY_AUTHORITY_CHANGED",
            "the downstream review consumer changed before recovery",
          );
        }
        downstream.startedAt = recoveredAt;
        delete downstream.finishedAt;
        delete downstream.runtimeLog;
        if (this.route.downstreamGatePhase) {
          current.metrics = Array.isArray(current.metrics) ? current.metrics : [];
          current.metrics.push({
            phase: this.route.downstreamGatePhase,
            counter: "gateRetry",
            delta: 0,
            reset: true,
            taskId: null,
            ts: recoveredAt,
          });
        }
      }
      const receipts = current.canonicalReviewPassRecoveries || [];
      if (!this.matchingReceipt(current)) {
        current.canonicalReviewPassRecoveries = [...receipts, receipt];
      }
    }, {
      expectedOriginal: this.state,
      passThroughError: (error) => error instanceof CanonicalReviewPassRecoveryError,
    });
    return receipt;
  }
}

export function inspectCanonicalReviewPassRecovery({
  root,
  state,
  phase = "spec",
  includeHealthy = false,
} = {}) {
  const route = phaseRoute(phase);
  const active = state ? recoveryLifecycle(state, route) : null;
  if (!state || !active) return null;
  if (!latestPassAttempt(state, route)) return null;

  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  if (route.triageFile && fs.existsSync(path.join(specDir, route.triageFile))) return null;

  const currentTreeSha = resolveCurrentReviewTreeSha(root, state.spec);
  const fingerprint = buildRepairFingerprint({
    root,
    specPath: state.spec,
    state,
  });
  const targetState = ReviewTargetState.fromRepairFingerprint(fingerprint);
  const record = convergencePassRecord(state, phase, currentTreeSha, targetState.digest);
  if (!record) return null;
  const recordIndex = state.reviewConvergence.records.indexOf(record);
  const evidenceInput = readCanonicalEvidence({
    root,
    specDir,
    phase,
    record,
    treeSha: currentTreeSha,
    targetStateDigest: targetState.digest,
  });
  const canonicalRecord = new CanonicalReviewPassRecord({
    record,
    evidenceInput,
    currentTreeSha,
    targetState,
  });
  const history = readHistoricalPass({
    root,
    specDir,
    route,
    canonicalEvidence: evidenceInput.evidence,
  });
  const problem = projectionProblem({
    root,
    specDir,
    route,
    expectedProjection: history.projection,
    record,
  });
  const plan = new CanonicalReviewPassRecoveryPlan({
    root,
    specDir,
    phase,
    route,
    state,
    activeStepId: active.stepId,
    recordIndex,
    canonicalRecord,
    history,
    targetState,
    currentTreeSha,
    problem,
  });
  return includeHealthy || plan.recoveryNeeded ? plan : null;
}

function requireExactGuards(ctx, state) {
  const missing = missingExactTargetGuardNames(ctx, state);
  if (missing.length === 0) return null;
  return Envelope.fail(
    "run",
    "recover-review-pass",
    "REVIEW_PASS_RECOVERY_GUARDS_REQUIRED",
    `canonical review PASS recovery requires ${missing.join(", ")}`,
  );
}

export default class RunRecoverReviewPassCommand extends FlowCommand {
  execute(ctx) {
    const state = ctx.flowState;
    const guardFailure = requireExactGuards(ctx, state);
    if (guardFailure) return guardFailure;
    try {
      const plan = inspectCanonicalReviewPassRecovery({
        root: ctx.root,
        state,
        phase: ctx.phase || "spec",
        includeHealthy: true,
      });
      if (!plan) {
        return Envelope.fail(
          "run",
          "recover-review-pass",
          "REVIEW_PASS_RECOVERY_NOT_ELIGIBLE",
          "the active Flow has no exact canonical PASS projection recovery",
        );
      }
      const priorReceipt = plan.matchingReceipt();
      if (!plan.recoveryNeeded && priorReceipt) {
        return Envelope.ok("run", "recover-review-pass", {
          recovered: true,
          idempotent: true,
          phase: plan.phase,
          activeStep: plan.activeStepId,
          evidenceDigest: plan.canonicalRecord.evidenceDigest,
          historyRef: plan.history.relativePath,
          projectionFile: plan.route.projectionFile,
          receipt: priorReceipt,
        });
      }
      if (!plan.recoveryNeeded) {
        return Envelope.fail(
          "run",
          "recover-review-pass",
          "REVIEW_PASS_RECOVERY_NOT_REQUIRED",
          "the canonical PASS projection and convergence state are already consistent",
        );
      }
      plan.writeProjection();
      const receipt = plan.applyState(ctx.flowManager);
      return Envelope.ok("run", "recover-review-pass", {
        recovered: true,
        idempotent: false,
        phase: plan.phase,
        activeStep: plan.activeStepId,
        evidenceDigest: plan.canonicalRecord.evidenceDigest,
        historyRef: plan.history.relativePath,
        projectionFile: plan.route.projectionFile,
        receipt,
      });
    } catch (error) {
      if (error instanceof CanonicalReviewPassRecoveryError) {
        return Envelope.fail("run", "recover-review-pass", error.code, error.message);
      }
      if (error?.code === "FLOW_STATE_ATOMIC_STALE") {
        return Envelope.fail(
          "run",
          "recover-review-pass",
          "REVIEW_PASS_RECOVERY_AUTHORITY_CHANGED",
          "Flow state changed before canonical PASS recovery could commit",
        );
      }
      return Envelope.fail(
        "run",
        "recover-review-pass",
        "REVIEW_PASS_RECOVERY_REJECTED",
        `canonical review PASS recovery rejected: ${error.message}`,
      );
    }
  }
}
