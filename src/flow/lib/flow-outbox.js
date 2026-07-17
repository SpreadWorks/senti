const OUTBOX_STATUSES = new Set(["pending", "done", "failed"]);

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function requireTimestamp(value, field) {
  requireString(value, field);
  if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
  return value;
}

function cloneJson(value) {
  if (value === undefined) return null;
  return structuredClone(value);
}

export class FlowOutboxIdentity {
  constructor({ runId, taskId = null, stepId, operation, idempotencyKey = null }) {
    this.runId = requireString(runId, "outbox runId");
    if (taskId != null) requireString(taskId, "outbox taskId");
    this.taskId = taskId;
    this.stepId = requireString(stepId, "outbox stepId");
    this.operation = requireString(operation, "outbox operation");
    const segments = ["flow-outbox-v1", this.runId, this.taskId ?? "flow", this.stepId, this.operation];
    const derivedKey = segments.map((segment) => encodeURIComponent(segment)).join(":");
    if (idempotencyKey != null && idempotencyKey !== derivedKey) {
      throw new Error("outbox idempotencyKey does not match its identity");
    }
    this.idempotencyKey = derivedKey;
    Object.freeze(this);
  }

  equals(other) {
    return other instanceof FlowOutboxIdentity && this.idempotencyKey === other.idempotencyKey;
  }

  toJSON() {
    return {
      idempotencyKey: this.idempotencyKey,
      runId: this.runId,
      taskId: this.taskId,
      stepId: this.stepId,
      operation: this.operation,
    };
  }

  static fromStored(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("stored outbox identity must be an object");
    }
    return new FlowOutboxIdentity(value);
  }
}

export class FlowOutboxEntry {
  constructor({
    identity,
    status,
    attempt,
    startedAt,
    updatedAt,
    result = null,
    failure = null,
  }) {
    if (!(identity instanceof FlowOutboxIdentity)) throw new Error("outbox identity is required");
    if (!OUTBOX_STATUSES.has(status)) throw new Error(`invalid outbox status: ${status}`);
    if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error("outbox attempt must be a positive integer");
    requireTimestamp(startedAt, "outbox startedAt");
    requireTimestamp(updatedAt, "outbox updatedAt");
    if (status === "pending" && (result != null || failure != null)) {
      throw new Error("pending outbox entry cannot retain a result or failure");
    }
    if (status === "done" && failure != null) throw new Error("done outbox entry cannot retain a failure");
    if (status === "failed") requireString(failure, "outbox failure");
    this.identity = identity;
    this.status = status;
    this.attempt = attempt;
    this.startedAt = startedAt;
    this.updatedAt = updatedAt;
    this.result = cloneJson(result);
    this.failure = failure;
    Object.freeze(this);
  }

  get idempotencyKey() {
    return this.identity.idempotencyKey;
  }

  retry(at) {
    if (this.status === "done" || this.status === "pending") return this;
    return new FlowOutboxEntry({
      identity: this.identity,
      status: "pending",
      attempt: this.attempt + 1,
      startedAt: requireTimestamp(at, "outbox retry timestamp"),
      updatedAt: at,
    });
  }

  touch(at) {
    if (this.status !== "pending") return this;
    const requestedAt = requireTimestamp(at, "outbox touch timestamp");
    const updatedAt = Date.parse(requestedAt) > Date.parse(this.updatedAt)
      ? requestedAt
      : new Date(Date.parse(this.updatedAt) + 1).toISOString();
    return new FlowOutboxEntry({
      identity: this.identity,
      status: "pending",
      attempt: this.attempt,
      startedAt: this.startedAt,
      updatedAt,
    });
  }

  complete(result, at) {
    if (this.status === "done") return this;
    if (this.status !== "pending") throw new Error("failed outbox entry must begin a retry before completion");
    return new FlowOutboxEntry({
      identity: this.identity,
      status: "done",
      attempt: this.attempt,
      startedAt: this.startedAt,
      updatedAt: requireTimestamp(at, "outbox completion timestamp"),
      result,
    });
  }

  fail(error, at) {
    if (this.status === "done") return this;
    const message = error instanceof Error ? error.message : String(error || "side effect failed");
    return new FlowOutboxEntry({
      identity: this.identity,
      status: "failed",
      attempt: this.attempt,
      startedAt: this.startedAt,
      updatedAt: requireTimestamp(at, "outbox failure timestamp"),
      failure: message,
    });
  }

  toJSON() {
    return {
      ...this.identity.toJSON(),
      status: this.status,
      attempt: this.attempt,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt,
      ...(this.status === "done" ? { result: cloneJson(this.result) } : {}),
      ...(this.status === "failed" ? { failure: this.failure } : {}),
    };
  }

  static fromStored(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("stored outbox entry must be an object");
    }
    return new FlowOutboxEntry({
      ...value,
      identity: FlowOutboxIdentity.fromStored(value),
    });
  }
}

export class FlowOutbox {
  constructor(entries = []) {
    if (!Array.isArray(entries)) throw new Error("flow outbox must be an array");
    this.entries = entries.map((entry) => (
      entry instanceof FlowOutboxEntry ? entry : FlowOutboxEntry.fromStored(entry)
    ));
    const keys = new Set();
    for (const entry of this.entries) {
      if (keys.has(entry.idempotencyKey)) throw new Error(`duplicate outbox identity: ${entry.idempotencyKey}`);
      keys.add(entry.idempotencyKey);
    }
  }

  find(identity) {
    if (!(identity instanceof FlowOutboxIdentity)) throw new Error("outbox identity is required");
    return this.entries.find((entry) => entry.identity.equals(identity)) || null;
  }

  begin(identity, at = new Date().toISOString()) {
    const current = this.find(identity);
    if (current?.status === "done" || current?.status === "pending") return current;
    const next = current
      ? current.retry(at)
      : new FlowOutboxEntry({
          identity,
          status: "pending",
          attempt: 1,
          startedAt: requireTimestamp(at, "outbox begin timestamp"),
          updatedAt: at,
        });
    this.#replace(next);
    return next;
  }

  complete(identity, result, at = new Date().toISOString()) {
    const current = this.find(identity);
    if (!current) throw new Error(`outbox entry not found: ${identity.idempotencyKey}`);
    const next = current.complete(result, at);
    this.#replace(next);
    return next;
  }

  fail(identity, error, at = new Date().toISOString()) {
    const current = this.find(identity);
    if (!current) throw new Error(`outbox entry not found: ${identity.idempotencyKey}`);
    const next = current.fail(error, at);
    this.#replace(next);
    return next;
  }

  touch(identity, at = new Date().toISOString()) {
    const current = this.find(identity);
    if (!current) throw new Error(`outbox entry not found: ${identity.idempotencyKey}`);
    const next = current.touch(at);
    this.#replace(next);
    return next;
  }

  merge(entry) {
    if (!(entry instanceof FlowOutboxEntry)) throw new Error("outbox entry is required");
    const current = this.find(entry.identity);
    if (current?.status === "done") return current;
    if (!current || entry.attempt > current.attempt || entry.updatedAt > current.updatedAt) {
      this.#replace(entry);
      return entry;
    }
    return current;
  }

  #replace(entry) {
    const index = this.entries.findIndex((candidate) => candidate.identity.equals(entry.identity));
    if (index >= 0) this.entries[index] = entry;
    else this.entries.push(entry);
  }

  toJSON() {
    return this.entries.map((entry) => entry.toJSON());
  }
}

export class FlowOutboxStore {
  constructor(flowManager, { specId = null, operationOwnerToken = null } = {}) {
    if (!flowManager || typeof flowManager.mutate !== "function") {
      throw new Error("flowManager.mutate is required for the outbox");
    }
    this.flowManager = flowManager;
    this.specId = specId;
    this.operationOwnerToken = operationOwnerToken;
  }

  begin(identity) {
    return this.#mutate((outbox) => outbox.begin(identity));
  }

  complete(identity, result) {
    return this.#mutate((outbox) => outbox.complete(identity, result));
  }

  fail(identity, error) {
    return this.#mutate((outbox) => outbox.fail(identity, error));
  }

  touch(identity) {
    return this.#mutate((outbox) => outbox.touch(identity));
  }

  #mutate(operation) {
    let entry = null;
    this.flowManager.mutate((state) => {
      const outbox = new FlowOutbox(state.outbox || []);
      entry = operation(outbox);
      state.outbox = outbox.toJSON();
    }, {
      ...(this.specId ? { specId: this.specId } : {}),
      ...(this.operationOwnerToken ? { operationOwnerToken: this.operationOwnerToken } : {}),
    });
    return entry;
  }
}

export function finalizationOutboxIdentity(flowState, stepId) {
  return new FlowOutboxIdentity({
    runId: flowState.runId,
    taskId: null,
    stepId,
    operation: stepId,
  });
}
