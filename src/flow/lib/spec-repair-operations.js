import crypto from "node:crypto";
import { validateSpecJsonObject } from "../../lib/spec-json.js";
import { checkSpecGateReadiness } from "./spec-gate-readiness.js";

const SHA256 = /^[a-f0-9]{64}$/;
const SHA256_REVISION = /^sha256:([a-f0-9]{64})$/;
const MAX_OPERATIONS = 64;
const MAX_VALUE_BYTES = 32 * 1024;
const MAX_ATTEMPT_ERROR_BYTES = 1024;
const COLLECTION_TARGETS = new Set([
  "scope.in", "scope.out", "constraints", "design_principles", "acceptance_criteria",
  "clarifications", "alternatives_considered", "open_questions", "overview.modules", "overview.data_flow",
  "overview.decisions", "keywords", "implementationTargets",
]);
const REPLACE_ROOTS = new Set(["goal", "background"]);
const REQUIREMENT_FIELDS = new Set(["desc", "priority", "status", "testable"]);
const TASK_FIELDS = new Set(["title", "goal", "acceptance", "implementation_notes"]);
const OPERATION_TYPES = new Map();

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}
function clone(value) { return structuredClone(value); }
function stableBytes(value) { return Buffer.byteLength(JSON.stringify(value)); }
function valueDigest(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function revisionFor(inputRevision) { return `sha256:${inputRevision}`; }
function exactKeys(value, expected, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw new Error(`${field} has an invalid schema`);
}
function optionalExactKeys(value, required, optional, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
  const actual = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key)) || actual.some((key) => !required.includes(key) && !optional.includes(key))) throw new Error(`${field} has an invalid schema`);
}
function freezeNested(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freezeNested); Object.freeze(value); }
  return value;
}
function frozen(value) { return freezeNested(clone(value)); }
function boundedErrorMessage(message) {
  const normalized = String(message ?? "spec repair attempt rejected").replace(/[\r\n\t]+/g, " ").trim();
  const bytes = Buffer.from(normalized, "utf8");
  return bytes.length <= MAX_ATTEMPT_ERROR_BYTES
    ? normalized
    : `${bytes.subarray(0, MAX_ATTEMPT_ERROR_BYTES - 3).toString("utf8")}...`;
}
function fallbackAttemptAudit(baseRevision = null) {
  return {
    version: 2, phase: "spec-repair", baseRevision,
    attempts: [], acceptedOperations: [], discardedOperations: [], scopeExpansions: [], appliedFindings: [],
    operationDigest: valueDigest({ accepted: [], discarded: [] }), resultRevision: null,
    audit: { missingRequiredTargets: [] },
  };
}
function commandOwnedAttemptFailure(audit, code, message) {
  const bounded = boundedErrorMessage(message);
  const source = audit ?? fallbackAttemptAudit();
  const validationSummary = code === "FLOW_SPEC_REPAIR_RESULT_SCHEMA_INVALID" || code === "FLOW_SPEC_REPAIR_GATE_READY_INVALID"
    ? bounded
    : null;
  return frozen({
    ...source,
    audit: {
      ...(source.audit ?? { missingRequiredTargets: [] }),
      error: { code, message: bounded },
      ...(validationSummary === null ? {} : { validationSummary }),
    },
  });
}
function auditTarget(value) {
  try { return SpecRepairTarget.fromJSON(value, "discarded operation target").toJSON(); } catch { return null; }
}
/** Never retain a raw worker operation in the command-owned audit.  In
 * particular this prevents rejected replacement text from becoming a second,
 * unbounded canonical worker artifact. */
function discardedOperation(value, reason) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : null;
  return Object.freeze({
    findingId: typeof source?.findingId === "string" ? source.findingId : null,
    kind: typeof source?.kind === "string" ? source.kind : null,
    target: auditTarget(source?.target),
    operationDigest: valueDigest(value),
    reason,
  });
}

export class SpecRepairOperationsError extends Error {
  constructor(code, message, { retryable = false, audit = null } = {}) {
    const bounded = boundedErrorMessage(message);
    super(bounded); this.name = "SpecRepairOperationsError"; this.code = code; this.retryable = retryable;
    this.audit = commandOwnedAttemptFailure(audit, code, bounded);
  }
}
export class SpecRepairOperationValidationError extends SpecRepairOperationsError {
  constructor(message, { audit = null } = {}) { super("FLOW_SPEC_REPAIR_OPERATION_VALIDATION_FAILURE", message, { retryable: true, audit }); this.name = "SpecRepairOperationValidationError"; }
}
export class SpecRepairRequiredTargetsError extends SpecRepairOperationsError {
  constructor(missing, audit) { super("FLOW_SPEC_REPAIR_REQUIRED_TARGETS_MISSING", `spec repair is missing required targets: ${missing.map(formatMissingTarget).join(", ")}`, { retryable: true, audit }); this.name = "SpecRepairRequiredTargetsError"; this.missing = Object.freeze([...missing]); }
}
/** A conflict is recorded per operation. It never aborts independent staging. */
export class SpecRepairConflictError extends SpecRepairOperationsError {
  constructor(target, audit) { super("FLOW_SPEC_REPAIR_OPERATION_CONFLICT", `spec repair contains conflicting operations for ${target}`, { retryable: true, audit }); this.name = "SpecRepairConflictError"; }
}

/** Structured target classes own decoding and later resolution behavior. */
export class SpecRepairTarget {
  static fromJSON(value, field) {
    if (Object.hasOwn(value ?? {}, "collection")) return new SpecRepairArrayTarget(value, field);
    if (Object.hasOwn(value ?? {}, "id")) return new SpecRepairIdEntityTarget(value, field);
    return new SpecRepairRootTarget(value, field);
  }
}
export class SpecRepairRootTarget extends SpecRepairTarget {
  constructor(value, field) {
    super(); exactKeys(value, ["entity", "field"], field);
    if (value.entity !== "spec" || !REPLACE_ROOTS.has(value.field)) throw new Error(`${field} must name a replaceable spec field`);
    this.entity = value.entity; this.field = value.field; Object.freeze(this);
  }
  permissionKey() { return `root:${this.field}`; }
  conflictKey() { return this.permissionKey(); }
  toJSON() { return { entity: this.entity, field: this.field }; }
  resolve(context) { return context.rootReference(this); }
}
export class SpecRepairIdEntityTarget extends SpecRepairTarget {
  constructor(value, field) {
    super(); exactKeys(value, ["entity", "id", "field"], field);
    if (value.entity !== "requirement" && value.entity !== "task") throw new Error(`${field}.entity is invalid`);
    this.id = requiredText(value.id, `${field}.id`);
    const allowed = value.entity === "requirement" ? REQUIREMENT_FIELDS : TASK_FIELDS;
    if (!allowed.has(value.field)) throw new Error(`${field}.field is invalid`);
    this.entity = value.entity; this.field = value.field; Object.freeze(this);
  }
  get domain() { return `${this.entity}s`; }
  permissionKey() { return `id:${this.entity}:${this.id}:${this.field}`; }
  conflictKey() { return this.permissionKey(); }
  toJSON() { return { entity: this.entity, id: this.id, field: this.field }; }
  resolve(context) { return context.idEntityReference(this); }
}
export class SpecRepairArrayTarget extends SpecRepairTarget {
  constructor(value, field) {
    super(); optionalExactKeys(value, ["collection"], ["position"], field);
    if (!COLLECTION_TARGETS.has(value.collection)) throw new Error(`${field}.collection is invalid`);
    if (Object.hasOwn(value, "position") && (!Number.isInteger(value.position) || value.position < 0)) throw new Error(`${field}.position must be a non-negative integer`);
    this.collection = value.collection; this.position = value.position ?? null; Object.freeze(this);
  }
  permissionKey() { return `array:${this.collection}`; }
  conflictKey(expectedDigest) { return `array:${this.collection}:${this.position ?? expectedDigest}`; }
  toJSON() { return this.position === null ? { collection: this.collection } : { collection: this.collection, position: this.position }; }
  resolve(context, expectedDigest) { return context.arrayElementReference(this, expectedDigest); }
}

/** A triage permission is a capability: a collection location alone cannot
 * accidentally grant array-add or array-delete authority. */
export class SpecRepairPermission {
  constructor(value, field) {
    exactKeys(value, ["target", "operationKinds"], field);
    this.target = SpecRepairTarget.fromJSON(value.target, `${field}.target`);
    if (!Array.isArray(value.operationKinds) || value.operationKinds.length === 0 || new Set(value.operationKinds).size !== value.operationKinds.length) throw new Error(`${field}.operationKinds must be a non-empty unique array`);
    for (const kind of value.operationKinds) {
      if (!OPERATION_TYPES.has(kind)) throw new Error(`${field}.operationKinds contains an invalid kind`);
      if (!OPERATION_TYPES.get(kind).supportsTarget(this.target)) throw new Error(`${field}.operationKinds is incompatible with its target`);
    }
    this.operationKinds = Object.freeze([...value.operationKinds]); Object.freeze(this);
  }
  allows(operation) { return this.target.permissionKey() === operation.target.permissionKey() && this.operationKinds.includes(operation.kind); }
  toJSON() { return { target: this.target.toJSON(), operationKinds: [...this.operationKinds] }; }
}

export class SpecRepairOperation {
  constructor(input, index, { replacementRequired = true } = {}) {
    const keys = ["findingId", "kind", "target", "expectedDigest", "reason"];
    if (replacementRequired) keys.push("replacement");
    exactKeys(input, keys, `spec-repair.operations[${index}]`);
    this.findingId = requiredText(input.findingId, `spec-repair.operations[${index}].findingId`);
    this.kind = requiredText(input.kind, `spec-repair.operations[${index}].kind`);
    this.target = SpecRepairTarget.fromJSON(input.target, `spec-repair.operations[${index}].target`);
    this.reason = requiredText(input.reason, `spec-repair.operations[${index}].reason`);
    if (replacementRequired && stableBytes(input.replacement) > MAX_VALUE_BYTES) throw new Error(`spec-repair.operations[${index}].replacement is oversized`);
    this.replacement = replacementRequired ? frozen(input.replacement) : null;
    this.replacementRequired = replacementRequired;
    if (input.expectedDigest !== null && !SHA256.test(input.expectedDigest)) throw new Error(`spec-repair.operations[${index}].expectedDigest must be SHA-256 or null`);
    this.expectedDigest = input.expectedDigest;
  }
  toJSON() {
    return {
      findingId: this.findingId, kind: this.kind, target: this.target.toJSON(), expectedDigest: this.expectedDigest,
      ...(this.replacementRequired ? { replacement: clone(this.replacement) } : {}), reason: this.reason,
    };
  }
  conflictKey() { return this.target.conflictKey(this.expectedDigest); }
  isComposableWith() { return false; }
  resolve(context) { return this.target.resolve(context, this.expectedDigest); }
  apply() { throw new Error("SpecRepairOperation subclasses implement apply"); }
  static supportsTarget() { return false; }
}
/** The closed operation classes own semantic application. Batch orchestration
 * has no operation-specific instanceof switching. */
export class SpecRepairFieldReplace extends SpecRepairOperation {
  constructor(input, index) { super(input, index); if (this.kind !== "replace-field" || !SpecRepairFieldReplace.supportsTarget(this.target) || this.expectedDigest === null) throw new Error(`spec-repair.operations[${index}] replace-field target or digest is invalid`); Object.freeze(this); }
  static supportsTarget(target) { return target instanceof SpecRepairRootTarget; }
  apply(context) { return context.replace(this.resolve(context), this); }
}
export class SpecRepairIdEntityFieldReplace extends SpecRepairOperation {
  constructor(input, index) { super(input, index); if (this.kind !== "replace-entity-field" || !SpecRepairIdEntityFieldReplace.supportsTarget(this.target) || this.expectedDigest === null) throw new Error(`spec-repair.operations[${index}] replace-entity-field target or digest is invalid`); Object.freeze(this); }
  static supportsTarget(target) { return target instanceof SpecRepairIdEntityTarget; }
  apply(context) { return context.replace(this.resolve(context), this); }
}
export class SpecRepairArrayAdd extends SpecRepairOperation {
  constructor(input, index) { super(input, index); if (this.kind !== "add-array-element" || !SpecRepairArrayAdd.supportsTarget(this.target) || this.expectedDigest !== null || this.target.position !== null) throw new Error(`spec-repair.operations[${index}] add-array-element target or digest is invalid`); Object.freeze(this); }
  static supportsTarget(target) { return target instanceof SpecRepairArrayTarget; }
  conflictKey() { return `array-add:${this.target.collection}`; }
  isComposableWith(other) { return other instanceof SpecRepairArrayAdd && other.target.collection === this.target.collection; }
  apply(context) { return context.append(this.target, this.replacement); }
}
export class SpecRepairArrayReplace extends SpecRepairOperation {
  constructor(input, index) { super(input, index); if (this.kind !== "replace-array-element" || !SpecRepairArrayReplace.supportsTarget(this.target) || this.expectedDigest === null) throw new Error(`spec-repair.operations[${index}] replace-array-element target or digest is invalid`); Object.freeze(this); }
  static supportsTarget(target) { return target instanceof SpecRepairArrayTarget; }
  apply(context) { return context.replaceArrayElement(this.resolve(context), this); }
}
export class SpecRepairArrayDelete extends SpecRepairOperation {
  constructor(input, index) { super(input, index, { replacementRequired: false }); if (this.kind !== "delete-array-element" || !SpecRepairArrayDelete.supportsTarget(this.target) || this.expectedDigest === null) throw new Error(`spec-repair.operations[${index}] delete-array-element target or digest is invalid`); Object.freeze(this); }
  static supportsTarget(target) { return target instanceof SpecRepairArrayTarget; }
  apply(context) { return context.deleteArrayElement(this.resolve(context)); }
}
OPERATION_TYPES.set("replace-field", SpecRepairFieldReplace);
OPERATION_TYPES.set("replace-entity-field", SpecRepairIdEntityFieldReplace);
OPERATION_TYPES.set("add-array-element", SpecRepairArrayAdd);
OPERATION_TYPES.set("replace-array-element", SpecRepairArrayReplace);
OPERATION_TYPES.set("delete-array-element", SpecRepairArrayDelete);

export class SpecRepairOperationBatch {
  constructor(document) {
    try {
      exactKeys(document, ["version", "baseRevision", "operations", "scopeExpansions"], "spec-repair.json");
      if (document.version !== 1) throw new Error("spec-repair.json version must be 1");
      if (typeof document.baseRevision !== "string" || !SHA256_REVISION.test(document.baseRevision)) throw new Error("spec-repair.json baseRevision must be sha256:<digest>");
      if (!Array.isArray(document.scopeExpansions) || document.scopeExpansions.some((proposal) => typeof proposal !== "string" || proposal.trim() === "")) throw new Error("spec-repair.json scopeExpansions must be a string array");
      if (!Array.isArray(document.operations) || document.operations.length > MAX_OPERATIONS) throw new Error("spec-repair.json operations are invalid");
    } catch (cause) {
      const baseRevision = typeof document?.baseRevision === "string" && SHA256_REVISION.test(document.baseRevision)
        ? document.baseRevision
        : null;
      throw new SpecRepairOperationValidationError(`spec-repair envelope is invalid: ${cause.message}`, { audit: fallbackAttemptAudit(baseRevision) });
    }
    this.baseRevision = document.baseRevision;
    const operations = [];
    const discardedOperations = [];
    document.operations.forEach((operation, index) => {
      try {
        const Type = OPERATION_TYPES.get(operation?.kind);
        if (!Type) throw new Error(`spec-repair.operations[${index}] kind is invalid`);
        operations.push(new Type(operation, index));
      } catch (cause) { discardedOperations.push(discardedOperation(operation, cause.message)); }
    });
    this.operations = Object.freeze(operations); this.discardedOperations = Object.freeze(discardedOperations); this.scopeExpansions = Object.freeze([...document.scopeExpansions]); Object.freeze(this);
  }
}

class SpecRepairArrayLineage {
  constructor(reference, baseReference) {
    this.reference = reference;
    this.entries = reference.value.map((value, position) => Object.freeze({ value, basePosition: position, digest: valueDigest(baseReference.value[position]) }));
  }
  resolve(target, expectedDigest) {
    if (target.position !== null) {
      const entry = this.entries.find((value) => value.basePosition === target.position);
      if (!entry || entry.digest !== expectedDigest) return { status: "stale" };
      return { status: "ok", entry, index: this.entries.indexOf(entry) };
    }
    const matches = this.entries.filter((entry) => entry.digest === expectedDigest && entry.basePosition !== null);
    if (matches.length === 0) return { status: "stale" };
    if (matches.length > 1) return { status: "conflict" };
    return { status: "ok", entry: matches[0], index: this.entries.indexOf(matches[0]) };
  }
  append(value) { const copy = clone(value); this.reference.value.push(copy); this.entries.push(Object.freeze({ value: copy, basePosition: null, digest: null })); }
  replace(resolution, value) { const copy = clone(value); this.reference.value[resolution.index] = copy; this.entries[resolution.index] = Object.freeze({ ...resolution.entry, value: copy }); }
  delete(resolution) { this.reference.value.splice(resolution.index, 1); this.entries.splice(resolution.index, 1); }
}
/** Application context owns staging state and immutable-base array identity. */
class SpecRepairApplicationContext {
  constructor(candidate, immutableBase) { this.candidate = candidate; this.immutableBase = immutableBase; this.collections = new Map(); }
  rootReference(target) { return { status: "ok", object: this.candidate, key: target.field, value: this.candidate[target.field] }; }
  idEntityReference(target) {
    const matches = Array.isArray(this.candidate[target.domain]) ? this.candidate[target.domain].filter((entry) => entry?.id === target.id) : [];
    if (matches.length !== 1) return { status: matches.length === 0 ? "stale" : "conflict" };
    return { status: "ok", object: matches[0], key: target.field, value: matches[0][target.field] };
  }
  arrayLineage(target) {
    let lineage = this.collections.get(target.collection);
    if (lineage) return lineage;
    const reference = collectionReference(this.candidate, target.collection);
    const baseReference = collectionReference(this.immutableBase, target.collection);
    if (!reference || !baseReference) return null;
    lineage = new SpecRepairArrayLineage(reference, baseReference); this.collections.set(target.collection, lineage); return lineage;
  }
  arrayElementReference(target, expectedDigest) { const lineage = this.arrayLineage(target); return lineage ? lineage.resolve(target, expectedDigest) : { status: "stale" }; }
  replace(reference, operation) {
    if (reference.status !== "ok") return reference;
    if (valueDigest(reference.value) !== operation.expectedDigest) return { status: "stale" };
    reference.object[reference.key] = clone(operation.replacement); return { status: "ok" };
  }
  append(target, replacement) { const lineage = this.arrayLineage(target); if (!lineage) return { status: "stale" }; lineage.append(replacement); return { status: "ok" }; }
  replaceArrayElement(reference, operation) { if (reference.status !== "ok") return reference; this.arrayLineage(operation.target).replace(reference, operation.replacement); return { status: "ok" }; }
  deleteArrayElement(reference) {
    if (reference.status !== "ok") return reference;
    for (const lineage of this.collections.values()) if (lineage.entries.includes(reference.entry)) { lineage.delete(reference); return { status: "ok" }; }
    throw new Error("array resolution is not owned by this application context");
  }
}
function collectionReference(spec, collection) {
  const parts = collection.split("."); let object = spec;
  for (let index = 0; index < parts.length - 1; index += 1) object = object?.[parts[index]];
  const key = parts.at(-1); return Array.isArray(object?.[key]) ? { object, key, value: object[key] } : null;
}
function unique(values) { return new Set(values).size === values.length; }
function targetExists(spec, target) {
  if (target instanceof SpecRepairRootTarget) return Object.hasOwn(spec, target.field);
  if (target instanceof SpecRepairArrayTarget) return collectionReference(spec, target.collection) !== null;
  const entries = spec[target.domain]; return Array.isArray(entries) && entries.filter((entry) => entry?.id === target.id).length === 1;
}
function triageMap(triage, spec) {
  const values = new Map();
  for (const [index, item] of (triage.items ?? []).entries()) {
    if (item.decision !== "apply") continue;
    const findingId = requiredText(item.findingId, `spec-triage apply item ${index}.findingId`);
    try {
      if (!Array.isArray(item.allowedTargets) || item.allowedTargets.length === 0) throw new Error("must declare allowedTargets");
      if (!Array.isArray(item.requiredTargets) || item.requiredTargets.length === 0) throw new Error("must declare requiredTargets");
      const permissions = item.allowedTargets.map((permission, permissionIndex) => new SpecRepairPermission(permission, `spec-triage apply item ${findingId}.allowedTargets[${permissionIndex}]`));
      const requiredTargets = item.requiredTargets.map((target, targetIndex) => SpecRepairTarget.fromJSON(target, `spec-triage apply item ${findingId}.requiredTargets[${targetIndex}]`));
      if (!unique(permissions.map((permission) => permission.target.permissionKey()))) throw new Error("has duplicate allowed target permissions");
      if (!unique(requiredTargets.map((target) => target.permissionKey()))) throw new Error("has duplicate required targets");
      if (requiredTargets.some((target) => !permissions.some((permission) => permission.target.permissionKey() === target.permissionKey()))) throw new Error("has required targets outside allowed target permissions");
      if (spec != null && [...permissions.map((permission) => permission.target), ...requiredTargets].some((target) => !targetExists(spec, target))) throw new Error("declares impossible targets");
      values.set(findingId, Object.freeze({ permissions: Object.freeze(permissions), requiredTargets: Object.freeze(requiredTargets) }));
    } catch (cause) { throw new SpecRepairOperationsError("FLOW_SPEC_REPAIR_TRIAGE_TARGETS_INVALID", `spec-triage apply item ${findingId} ${cause.message}`, { retryable: false }); }
  }
  return values;
}
export function validateSpecRepairTriageTargets(triage, spec) { triageMap(triage, spec); }

function historicalAcceptedOperations(history) {
  if (!(history instanceof SpecRepairCorrectionHistory)) return [];
  const values = [];
  for (const attempt of history.attempts) for (const entry of attempt.audit?.acceptedOperations ?? []) {
    const operation = entry.operation ?? entry;
    try { const Type = OPERATION_TYPES.get(operation?.kind); if (!Type) throw new Error("invalid"); values.push(new Type(operation, 0)); } catch { throw new Error("parent correction history contains an invalid accepted operation"); }
  }
  const seen = new Set();
  return values.filter((operation) => { const digest = valueDigest(operation.toJSON()); if (seen.has(digest)) return false; seen.add(digest); return true; });
}
function operationAudit(operation, attempt) { const json = operation.operation ?? operation.toJSON?.() ?? operation; return Object.freeze({ operation: clone(json), operationDigest: operation.operationDigest ?? valueDigest(json), attempt }); }
function discardedAudit(entry, attempt) {
  return Object.freeze({
    findingId: entry.findingId ?? null, kind: entry.kind ?? null, target: entry.target ?? null,
    operationDigest: entry.operationDigest ?? valueDigest(entry), reason: entry.reason ?? "discarded operation", attempt,
  });
}
function commandOwnedAudit(batch, accepted, discarded, missing, scopeExpansions = []) {
  return Object.freeze({
    version: 2, phase: "spec-repair", baseRevision: batch.baseRevision, attempts: Object.freeze([]),
    acceptedOperations: Object.freeze(accepted.map((operation) => operation.toJSON())), discardedOperations: Object.freeze(discarded), scopeExpansions: Object.freeze([...scopeExpansions]),
    appliedFindings: Object.freeze([...new Set(accepted.map((operation) => operation.findingId))]), operationDigest: valueDigest({ accepted: accepted.map((operation) => operation.toJSON()), discarded }), resultRevision: null,
    audit: Object.freeze({ missingRequiredTargets: Object.freeze([...missing]) }),
  });
}
/** Parent-owned evidence cannot be represented or overwritten by worker JSON. */
export class SpecRepairCorrectionHistory {
  constructor(attempts = []) { if (!Array.isArray(attempts)) throw new Error("spec repair correction history requires attempts"); this.attempts = Object.freeze(attempts.map((entry, index) => new SpecRepairCorrectionAttempt(entry, index + 1))); Object.freeze(this); }
  appendFailure(error) { if (!error || typeof error.code !== "string") throw new Error("spec repair correction history requires an error code"); return new SpecRepairCorrectionHistory([...this.attempts, { status: "rejected", code: error.code, audit: error.data?.specRepairAudit ?? error.audit ?? null }]); }
  aggregate(successAudit = null) {
    const entries = successAudit === null ? this.attempts : [...this.attempts, new SpecRepairCorrectionAttempt({ status: "accepted", audit: successAudit }, this.attempts.length + 1)];
    const acceptedOperations = []; const discardedOperations = []; const scopeExpansions = [];
    const attempts = entries.map((entry, index) => {
      const attempt = index + 1; const audit = entry.audit;
      const accepted = (audit?.acceptedOperations ?? []).map((operation) => operationAudit(operation, attempt));
      const discarded = (audit?.discardedOperations ?? []).map((discard) => discardedAudit(discard, attempt));
      const expansions = (audit?.scopeExpansions ?? []).map((proposal) => Object.freeze({ proposal: clone(proposal), attempt }));
      const error = entry.status === "rejected"
        ? frozen(audit?.audit?.error ?? { code: entry.code, message: "command-owned spec repair attempt rejected" })
        : null;
      acceptedOperations.push(...accepted); discardedOperations.push(...discarded); scopeExpansions.push(...expansions);
      return Object.freeze({ attempt, status: entry.status, ...(entry.code === null ? {} : { code: entry.code }), ...(error === null ? {} : { error }), baseRevision: audit?.baseRevision ?? null, acceptedOperations: Object.freeze(accepted), discardedOperations: Object.freeze(discarded), scopeExpansions: Object.freeze(expansions), missingRequiredTargets: Object.freeze([...(audit?.audit?.missingRequiredTargets ?? [])]), ...(audit?.audit?.validationSummary ? { validationSummary: audit.audit.validationSummary } : {}) });
    });
    const finalAudit = successAudit ?? entries.at(-1)?.audit ?? null;
    return Object.freeze({ version: 2, phase: "spec-repair", baseRevision: finalAudit?.baseRevision ?? null, attempts: Object.freeze(attempts), acceptedOperations: Object.freeze(acceptedOperations), discardedOperations: Object.freeze(discardedOperations), scopeExpansions: Object.freeze(scopeExpansions), appliedFindings: Object.freeze([...new Set(acceptedOperations.map((entry) => entry.operation.findingId))]), operationDigest: valueDigest({ acceptedOperations, discardedOperations }), resultRevision: finalAudit?.resultRevision ? frozen(finalAudit.resultRevision) : null, audit: frozen(finalAudit?.audit ?? { missingRequiredTargets: [] }) });
  }
}
class SpecRepairCorrectionAttempt {
  constructor({ status, code = null, audit = null }, index) {
    if (status !== "rejected" && status !== "accepted") throw new Error(`spec repair correction attempt ${index} has invalid status`);
    if (status === "rejected" && typeof code !== "string") throw new Error(`spec repair correction attempt ${index} requires an error code`);
    this.status = status; this.code = code; this.audit = audit === null ? null : frozen(audit); Object.freeze(this);
  }
}
function authorized(finding, operation) { return finding?.permissions.some((permission) => permission.allows(operation)) ?? false; }
function missingTarget(findingId, target) { return frozen({ findingId, target: target.toJSON() }); }
function formatMissingTarget(entry) { return `${entry.findingId}:${JSON.stringify(entry.target)}`; }
function currentAttemptConflictKeys(operations) {
  const groups = new Map();
  for (const operation of operations) {
    const key = operation.conflictKey();
    const group = groups.get(key) ?? [];
    group.push(operation);
    groups.set(key, group);
  }
  return new Set([...groups.entries()]
    .filter(([, group]) => group.some((operation, index) => group.slice(index + 1).some((other) => !operation.isComposableWith(other))))
    .map(([key]) => key));
}

export function applySpecRepairOperations({ spec, triage, repair, inputRevision, correctionHistory = null }) {
  const batch = repair instanceof SpecRepairOperationBatch ? repair : new SpecRepairOperationBatch(repair);
  if (batch.baseRevision !== revisionFor(inputRevision)) throw new SpecRepairOperationsError("FLOW_SPEC_REPAIR_BASE_REVISION_MISMATCH", "spec-repair operations do not match the immutable handoff revision", { retryable: true, audit: commandOwnedAudit(batch, [], [], []) });
  const permissions = triageMap(triage, spec);
  const candidate = clone(spec); const context = new SpecRepairApplicationContext(candidate, frozen(spec));
  const accepted = []; const acceptedThisAttempt = []; const discarded = [...batch.discardedOperations]; const touched = new Map();
  const historicalOperations = historicalAcceptedOperations(correctionHistory);
  const historicalDigests = new Set(historicalOperations.map((operation) => valueDigest(operation.toJSON())));
  const currentOperations = batch.operations.filter((operation) => {
    if (!historicalDigests.has(valueDigest(operation.toJSON()))) return true;
    discarded.push(discardedOperation(operation.toJSON(), "already accepted in a prior correction")); return false;
  });
  // Authorization is a per-operation decision.  An unauthorized proposal must
  // not poison an otherwise valid operation merely because it names the same
  // location; only authorized operations participate in conflict detection.
  const authorizedCurrentOperations = currentOperations.filter((operation) => {
    if (authorized(permissions.get(operation.findingId), operation)) return true;
    discarded.push(discardedOperation(operation.toJSON(), "unauthorized operation"));
    return false;
  });
  const conflictingCurrentKeys = currentAttemptConflictKeys(authorizedCurrentOperations);
  // A current operation may supersede one historical operation, but an
  // internally conflicting current group has no authority to erase a prior
  // accepted correction merely by being present.
  const priorOperations = historicalOperations.filter((prior) => !authorizedCurrentOperations.some((current) => (
    !conflictingCurrentKeys.has(current.conflictKey())
    && current.conflictKey() === prior.conflictKey()
    && current.findingId === prior.findingId
    && !current.isComposableWith(prior)
  )));
  for (const [operation, isPrior] of [...priorOperations.map((operation) => [operation, true]), ...authorizedCurrentOperations.map((operation) => [operation, false])]) {
    if (!isPrior && conflictingCurrentKeys.has(operation.conflictKey())) {
      discarded.push(discardedOperation(operation.toJSON(), "conflicting operation"));
      continue;
    }
    const finding = permissions.get(operation.findingId);
    if (!authorized(finding, operation)) {
      if (isPrior) throw new Error("parent correction history contains an unauthorized accepted operation");
      discarded.push(discardedOperation(operation.toJSON(), "unauthorized operation")); continue;
    }
    const conflict = touched.get(operation.conflictKey());
    if (conflict && !operation.isComposableWith(conflict)) {
      if (isPrior) throw new Error("parent correction history contains conflicting accepted operations");
      conflictingCurrentKeys.add(operation.conflictKey());
      discarded.push(discardedOperation(operation.toJSON(), "conflicting operation")); continue;
    }
    const result = operation.apply(context);
    if (result.status !== "ok") {
      if (isPrior) throw new Error(`parent correction history contains a ${result.status} accepted operation`);
      discarded.push(discardedOperation(operation.toJSON(), result.status === "conflict" ? "conflicting target resolution" : "stale target digest")); continue;
    }
    touched.set(operation.conflictKey(), operation); accepted.push(operation); if (!isPrior) acceptedThisAttempt.push(operation);
  }
  const missing = [];
  for (const [findingId, finding] of permissions) for (const target of finding.requiredTargets) {
    if (!accepted.some((operation) => operation.findingId === findingId && operation.target.permissionKey() === target.permissionKey())) missing.push(missingTarget(findingId, target));
  }
  const audit = commandOwnedAudit(batch, acceptedThisAttempt, discarded, missing, batch.scopeExpansions);
  if (batch.scopeExpansions.length > 0) throw new SpecRepairOperationsError("FLOW_SPEC_REPAIR_SCOPE_EXPANSION_REQUIRED", "spec repair proposes a scope expansion requiring an explicit route", { retryable: true, audit });
  if (conflictingCurrentKeys.size > 0) throw new SpecRepairConflictError([...conflictingCurrentKeys].join(", "), audit);
  if (missing.length > 0) throw new SpecRepairRequiredTargetsError(missing, audit);
  try { validateSpecJsonObject(candidate); } catch (cause) { throw new SpecRepairOperationsError("FLOW_SPEC_REPAIR_RESULT_SCHEMA_INVALID", cause.message, { retryable: true, audit }); }
  const readiness = checkSpecGateReadiness(candidate);
  if (readiness.length > 0) throw new SpecRepairOperationsError("FLOW_SPEC_REPAIR_GATE_READY_INVALID", readiness.join("; "), { retryable: true, audit });
  const finalAudit = Object.freeze({ ...audit, resultRevision: Object.freeze({ digest: valueDigest(candidate), byteLength: stableBytes(candidate) }), acceptedOperations: Object.freeze(acceptedThisAttempt.map((operation) => operationAudit(operation, 1))), discardedOperations: Object.freeze(discarded.map((entry) => discardedAudit(entry, 1))) });
  const history = correctionHistory instanceof SpecRepairCorrectionHistory ? correctionHistory : new SpecRepairCorrectionHistory();
  return Object.freeze({ spec: Object.freeze(candidate), audit: history.aggregate(finalAudit) });
}
