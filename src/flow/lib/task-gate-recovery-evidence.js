import fs from "node:fs";
import path from "node:path";

import {
  IssueLogRepairEvidenceSource,
  ReviewFindingCycle,
} from "./finding-disposition-policy.js";

const TASK_GATE_SOURCE_FILE = "task-impl-gate-source.json";
const MAX_TASK_GATE_SOURCE_BYTES = 1024 * 1024;
const FINDING_ID_RE = /^[a-f0-9]{64}$/;

function failedFindings(artifact) {
  const blocking = Array.isArray(artifact.blockingFindings)
    ? artifact.blockingFindings
    : [];
  if (blocking.length > 0) return blocking;
  const evaluations = Array.isArray(artifact.evaluations)
    ? artifact.evaluations.filter((finding) => finding?.result === "fail")
    : [];
  if (evaluations.length > 0) return evaluations;
  const observations = Array.isArray(artifact.observations)
    ? artifact.observations
    : [];
  return observations.filter((finding) => finding?.severity === "blocking");
}

export class TaskGateRepairEvidenceAssessment {
  constructor({ valid, reason, findingIds = [] }) {
    this.valid = valid === true;
    this.reason = String(reason || "").trim();
    this.findingIds = Object.freeze([...findingIds]);
    if (this.valid && this.reason !== "matching-formal-repair-evidence") {
      throw new Error("valid task gate repair evidence requires a matching reason");
    }
    if (!this.valid && this.reason === "") {
      throw new Error("invalid task gate repair evidence requires a reason");
    }
    Object.freeze(this);
  }

  static reject(reason) {
    return new TaskGateRepairEvidenceAssessment({ valid: false, reason });
  }

  static accept(findingIds) {
    return new TaskGateRepairEvidenceAssessment({
      valid: true,
      reason: "matching-formal-repair-evidence",
      findingIds,
    });
  }
}

export function assessTaskGateRepairEvidence({ root, flowState, issueLogEntries }) {
  const taskId = typeof flowState?.currentTaskId === "string"
    ? flowState.currentTaskId.trim()
    : "";
  if (!taskId) return TaskGateRepairEvidenceAssessment.reject("missing-current-task");
  if (typeof flowState?.spec !== "string" || flowState.spec.trim() === "") {
    return TaskGateRepairEvidenceAssessment.reject("missing-flow-spec");
  }

  const repositoryRoot = path.resolve(root);
  const specPath = path.resolve(repositoryRoot, flowState.spec);
  const relativeSpec = path.relative(repositoryRoot, specPath);
  if (relativeSpec.startsWith("..") || path.isAbsolute(relativeSpec)) {
    return TaskGateRepairEvidenceAssessment.reject("invalid-flow-spec-authority");
  }
  const sourcePath = path.join(path.dirname(specPath), TASK_GATE_SOURCE_FILE);
  let artifact;
  try {
    const stat = fs.lstatSync(sourcePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_TASK_GATE_SOURCE_BYTES) {
      return TaskGateRepairEvidenceAssessment.reject("invalid-task-gate-source");
    }
    artifact = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  } catch {
    return TaskGateRepairEvidenceAssessment.reject("missing-or-malformed-task-gate-source");
  }
  if (
    artifact == null
    || typeof artifact !== "object"
    || Array.isArray(artifact)
    || artifact.phase !== "task-impl"
  ) {
    return TaskGateRepairEvidenceAssessment.reject("invalid-task-gate-source");
  }
  try {
    if (!new ReviewFindingCycle(flowState).matchesArtifact(artifact)) {
      return TaskGateRepairEvidenceAssessment.reject("stale-task-gate-source");
    }
  } catch {
    return TaskGateRepairEvidenceAssessment.reject("invalid-task-gate-cycle");
  }

  const findings = failedFindings(artifact);
  if (findings.length === 0) {
    return TaskGateRepairEvidenceAssessment.reject("missing-current-task-gate-finding");
  }
  const evidenceSource = new IssueLogRepairEvidenceSource(issueLogEntries);
  const findingIds = [];
  for (const finding of findings) {
    const findingId = String(finding?.findingId || finding?.fingerprint || "").trim();
    const reportedAt = String(finding?.reportedAt || artifact.generatedAt || "").trim();
    if (!FINDING_ID_RE.test(findingId) || !Number.isFinite(Date.parse(reportedAt))) {
      return TaskGateRepairEvidenceAssessment.reject("invalid-current-task-gate-finding");
    }
    const evidence = evidenceSource.find({
      normalizedFindingId: findingId,
      phase: "task-impl",
      taskId,
      reportedAt,
      root: repositoryRoot,
    });
    if (!evidence) {
      return TaskGateRepairEvidenceAssessment.reject("missing-matching-formal-repair-evidence");
    }
    findingIds.push(findingId);
  }
  return TaskGateRepairEvidenceAssessment.accept(findingIds);
}
