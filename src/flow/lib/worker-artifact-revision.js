const SHA256 = /^[a-f0-9]{64}$/;

function requiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

export class WorkerArtifactRevision {
  constructor(input = {}) {
    if (input.version !== 1) throw new Error("worker artifact revision version must be 1");
    this.version = 1;
    this.runId = requiredString(input.runId, "worker artifact revision runId");
    this.specId = requiredString(input.specId, "worker artifact revision specId");
    this.stepId = requiredString(input.stepId, "worker artifact revision stepId");
    this.digest = requiredString(input.digest, "worker artifact revision digest");
    if (!SHA256.test(this.digest)) throw new Error("worker artifact revision digest must be SHA-256");
    if (!Number.isSafeInteger(input.byteLength) || input.byteLength < 0) {
      throw new Error("worker artifact revision byteLength must be a non-negative safe integer");
    }
    this.byteLength = input.byteLength;
    this.finalizedAt = requiredString(input.finalizedAt, "worker artifact revision finalizedAt");
    if (!Number.isFinite(Date.parse(this.finalizedAt))) {
      throw new Error("worker artifact revision finalizedAt must be an ISO timestamp");
    }
    Object.freeze(this);
  }

  static from(value) {
    return value instanceof WorkerArtifactRevision ? value : new WorkerArtifactRevision(value);
  }

  assertFlow(state) {
    if (state?.runId !== this.runId || state?.specId !== this.specId) {
      throw new Error("worker artifact revision does not match the active Flow");
    }
    return this;
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      stepId: this.stepId,
      digest: this.digest,
      byteLength: this.byteLength,
      finalizedAt: this.finalizedAt,
    };
  }
}
