import {
  RepairReference,
  ReviewFindingCycle,
} from "./finding-disposition-policy.js";

const FINDING_ID_RE = /^[a-f0-9]{64}$/;

class TaskGateRepairEvidenceReference {
  constructor(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("task gate repair evidence must be an object");
    }
    this.normalizedFindingId = String(value.normalizedFindingId || "").trim();
    this.step = String(value.step || "").trim();
    this.taskId = String(value.taskId || "").trim();
    this.timestamp = String(value.timestamp || "").trim();
    this.recordedAt = Date.parse(this.timestamp);
    if (!FINDING_ID_RE.test(this.normalizedFindingId)) {
      throw new Error("task gate repair evidence requires a normalized finding id");
    }
    if (this.step !== "task-gate") {
      throw new Error("task gate repair evidence must be recorded by task-gate");
    }
    if (this.taskId === "" || !Number.isFinite(this.recordedAt)) {
      throw new Error("task gate repair evidence requires task and timestamp");
    }
    this.repairRef = new RepairReference(value.repairRef);
    Object.freeze(this);
  }

  matches({ normalizedFindingId, taskId, reportedAt, root }) {
    const findingTime = Date.parse(String(reportedAt || "").trim());
    return this.normalizedFindingId === normalizedFindingId
      && this.taskId === taskId
      && Number.isFinite(findingTime)
      && this.recordedAt >= findingTime
      && this.repairRef.materializesAfter(root, reportedAt);
  }
}

class TaskGateRepairEvidenceSource {
  constructor(entries) {
    const source = Array.isArray(entries) ? entries : [];
    this.entries = Object.freeze(source.flatMap((entry) => {
      try {
        return [new TaskGateRepairEvidenceReference(entry)];
      } catch {
        return [];
      }
    }));
    Object.freeze(this);
  }

  find(input) {
    return this.entries.findLast((entry) => entry.matches(input)) || null;
  }
}

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

export function assessTaskGateRepairEvidence({ root, flowState, sourceArtifact, issueLogEntries }) {
  const taskId = typeof flowState?.currentTaskId === "string"
    ? flowState.currentTaskId.trim()
    : "";
  if (!taskId) return TaskGateRepairEvidenceAssessment.reject("missing-current-task");
  const artifact = sourceArtifact;
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
  const evidenceSource = new TaskGateRepairEvidenceSource(issueLogEntries);
  const findingIds = [];
  for (const finding of findings) {
    const findingId = String(finding?.findingId || finding?.fingerprint || "").trim();
    const reportedAt = String(finding?.reportedAt || artifact.generatedAt || "").trim();
    if (!FINDING_ID_RE.test(findingId) || !Number.isFinite(Date.parse(reportedAt))) {
      return TaskGateRepairEvidenceAssessment.reject("invalid-current-task-gate-finding");
    }
    const evidence = evidenceSource.find({
      normalizedFindingId: findingId,
      taskId,
      reportedAt,
      root,
    });
    if (!evidence) {
      return TaskGateRepairEvidenceAssessment.reject("missing-matching-formal-repair-evidence");
    }
    findingIds.push(findingId);
  }
  return TaskGateRepairEvidenceAssessment.accept(findingIds);
}
