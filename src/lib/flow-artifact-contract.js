import path from "node:path";
import crypto from "node:crypto";
import { ArtifactAuthority, ArtifactAuthoritySlot, ArtifactCardinality } from "./artifact-authority.js";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ROOT_ARTIFACT_KEYS = new Set([
  "flow.state", "flow.activities", "spec.record", "issue.log", "artifact.catalog", "issue.snapshot",
]);
const RETENTIONS = new Set(["permanent", "transient"]);
const PLACEMENT_CATEGORIES = new Set(["root-authority", "step-owner", "step-shared", "independent-deliverable", "transient"]);
const MUTATION_POLICIES = new Set(["replaceable", "immutable"]);
const SWITCH_TARGET_ACTIONS = new Set(["switch", "new", "remove"]);
const AUTHORITY_ACTORS = new Set(["system", "branch", "prepare-spec", "draft", "draft-questions-review", "draft-questions-triage", "draft-questions-repair", "draft-refine", "draft-coverage-review", "draft-coverage-triage", "draft-coverage-repair", "draft-gate", "spec", "spec-review", "spec-triage", "spec-repair", "spec-gate", "approval", "test", "scenario-validity", "test-review", "implement", "test-execute", "test-result-review", "impl-review", "impl-triage", "impl-repair", "impl-gate", "retro", "acceptance-review", "acceptance-decision", "final-regression", "report", "finalize-commit", "finalize-merge", "finalize-sync", "finalize-cleanup", "task-impl", "task-review", "task-gate"]);

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function identifier(value, field) {
  const result = requiredText(value, field);
  if (!IDENTIFIER.test(result)) throw new Error(`${field} must be an identifier`);
  return result;
}

function safeRelativePath(value, field) {
  const result = requiredText(value, field);
  if (result.includes("\\") || path.posix.isAbsolute(result) || path.posix.normalize(result) !== result) {
    throw new Error(`${field} must be a normalized POSIX relative path`);
  }
  if (result.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${field} must not contain empty, current, or parent segments`);
  }
  return result;
}

function people(values, field) {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${field} must name at least one actor`);
  const normalized = values.map((value) => identifier(value, field));
  if (normalized.some((value) => !AUTHORITY_ACTORS.has(value))) throw new Error(`${field} must name an authority step or system actor`);
  if (new Set(normalized).size !== normalized.length) throw new Error(`${field} must not contain duplicates`);
  return Object.freeze(normalized);
}

function authorityActor(value, field) {
  const actor = identifier(value, field);
  if (!AUTHORITY_ACTORS.has(actor)) throw new Error(`${field} must name an authority step or system actor`);
  return actor;
}

function immutableData(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  for (const member of Object.values(value)) immutableData(member, seen);
  return Object.freeze(value);
}

export class FlowArtifactLogicalKey {
  constructor(value) {
    this.value = requiredText(value, "artifact logical key");
    if (!this.value.split(".").every((part) => IDENTIFIER.test(part))) {
      throw new Error("artifact logical key must contain dot-separated identifiers");
    }
    Object.freeze(this);
  }
  toString() { return this.value; }
}

export class FlowArtifactRetention {
  constructor(value) {
    this.value = identifier(value, "artifact retention");
    if (!RETENTIONS.has(this.value)) throw new Error(`unknown artifact retention: ${this.value}`);
    Object.freeze(this);
  }
  toString() { return this.value; }
}

/** Governs whether a cataloged canonical artifact can replace prior bytes. */
export class FlowArtifactMutationPolicy {
  constructor(value) {
    this.value = identifier(value, "artifact mutation policy");
    if (!MUTATION_POLICIES.has(this.value)) throw new Error(`unknown artifact mutation policy: ${this.value}`);
    Object.freeze(this);
  }
  assertPublication(previous, next) {
    if (this.value === "immutable" && previous !== undefined && previous !== null
      && (previous.hash !== next.hash || previous.size !== next.size)) {
      throw new Error("immutable artifact publication cannot replace existing bytes");
    }
  }
  toString() { return this.value; }
}

/** Declares why an artifact lives at its canonical path. */
export class FlowArtifactPlacement {
  constructor(value) {
    this.value = identifier(value, "artifact placement");
    if (!PLACEMENT_CATEGORIES.has(this.value)) throw new Error(`unknown artifact placement: ${this.value}`);
    Object.freeze(this);
  }
  assertCompatible({ logicalKey, canonicalPath, retention, cataloged } = {}) {
    const key = new FlowArtifactLogicalKey(logicalKey).toString();
    const target = canonicalPath instanceof FlowArtifactCanonicalPath ? canonicalPath.toString() : new FlowArtifactCanonicalPath(canonicalPath).toString();
    const lifetime = retention instanceof FlowArtifactRetention ? retention.toString() : new FlowArtifactRetention(retention).toString();
    if (this.value === "root-authority") {
      if (!ROOT_ARTIFACT_KEYS.has(key) || target.includes("/") || lifetime !== "permanent") {
        throw new Error("root authority placement requires one of the six permanent root artifacts");
      }
      if (cataloged !== (key !== "artifact.catalog")) throw new Error("root authority catalog membership must match the catalog self-exception");
      return;
    }
    if (this.value === "independent-deliverable") {
      if (!target.startsWith("artifacts/") || lifetime !== "permanent" || cataloged !== true) {
        throw new Error("independent deliverable placement requires a cataloged permanent artifacts/ path");
      }
      return;
    }
    if (this.value === "transient") {
      const stepLog = /^steps\/(?:scenario-validity|test-execute)\/output\.log$/.test(target)
        || /^steps\/final-regression\/attempt-:\{attempt\}\.log$/.test(target);
      if ((!target.startsWith(".runtime/") && !stepLog) || lifetime !== "transient" || cataloged !== false) {
        throw new Error("transient placement requires a non-cataloged transient runtime or step log path");
      }
      return;
    }
    if (!target.startsWith("steps/") || lifetime !== "permanent" || cataloged !== true) {
      throw new Error(`${this.value} placement requires a cataloged permanent steps/ path`);
    }
    const segments = target.split("/");
    if (this.value === "step-shared" && (segments.length !== 2 || segments[0] !== "steps" || target.includes(":{"))) {
      throw new Error("step shared placement requires one static file directly below steps/");
    }
    if (this.value === "step-owner" && (segments.length < 3 || segments[0] !== "steps")) {
      throw new Error("step owner placement requires a steps/<owner>/<file> hierarchy");
    }
  }
  toString() { return this.value; }
}

export class FlowArtifactAttempt {
  constructor(value) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 999) throw new Error("artifact attempt must be a positive three-digit safe integer");
    this.value = value;
    Object.freeze(this);
  }
  toString() { return String(this.value).padStart(3, "0"); }
}

export class FlowArtifactAttemptSequence {
  constructor(attempts = []) {
    if (!Array.isArray(attempts) || attempts.some((attempt) => !(attempt instanceof FlowArtifactAttempt))) {
      throw new Error("artifact attempt sequence requires typed attempts");
    }
    for (let index = 1; index < attempts.length; index += 1) {
      if (attempts[index - 1].value >= attempts[index].value) throw new Error("artifact attempts must be append-only and strictly increasing");
    }
    this.attempts = Object.freeze([...attempts]);
    Object.freeze(this);
  }
  next() { return new FlowArtifactAttempt((this.attempts.at(-1)?.value ?? 0) + 1); }
}

export class FlowArtifactAttemptHistory {
  constructor(attempts = []) {
    if (!Array.isArray(attempts) || attempts.some((attempt) => !(attempt instanceof FlowArtifactAttemptRecord))) throw new Error("artifact attempt history requires typed attempt records");
    this.sequence = new FlowArtifactAttemptSequence(attempts.map((record) => record.attempt));
    this.attempts = Object.freeze([...attempts]);
    this.current = attempts.at(-1) ?? null;
    Object.freeze(this);
  }
  append(record) { return new FlowArtifactAttemptHistory([...this.attempts, record]); }
  toJSON() { return { attempts: this.attempts.map((record) => record.toJSON()) }; }
}

export class FlowArtifactAttemptRecord {
  constructor({ attempt, payload } = {}) {
    this.attempt = attempt instanceof FlowArtifactAttempt ? attempt : new FlowArtifactAttempt(attempt);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("artifact attempt payload must be an object");
    if (Object.hasOwn(payload, "attempt")) throw new Error("artifact attempt payload must not override attempt");
    this.payload = immutableData(structuredClone(payload));
    Object.freeze(this);
  }
  toJSON() { return { attempt: this.attempt.value, ...this.payload }; }
}

export class FlowArtifactLegacyTarget {
  constructor(value) { this.value = safeRelativePath(value, "legacy artifact target"); Object.freeze(this); }
  toString() { return this.value; }
}

export class FlowArtifactSwitchTarget {
  constructor({ logicalKey, legacyPaths = [], legacyPatterns = [], canonicalPath = null, action, producer, consumer } = {}) {
    this.logicalKey = new FlowArtifactLogicalKey(logicalKey).toString();
    if (!Array.isArray(legacyPaths)) throw new Error("switch target legacy paths must be an array");
    if (!Array.isArray(legacyPatterns)) throw new Error("switch target legacy patterns must be an array");
    this.legacyPaths = Object.freeze(legacyPaths.map((value) => new FlowArtifactLegacyTarget(value)));
    this.legacyPatterns = Object.freeze(legacyPatterns.map((value) => (
      value instanceof FlowArtifactLegacyPattern ? value : new FlowArtifactLegacyPattern(value)
    )));
    const legacyValues = [...this.legacyPaths, ...this.legacyPatterns].map(String);
    if (new Set(legacyValues).size !== legacyValues.length) throw new Error("switch target legacy paths must not contain duplicates");
    this.action = identifier(action, "switch target action");
    if (!SWITCH_TARGET_ACTIONS.has(this.action)) throw new Error("switch target action is invalid");
    if (this.action === "new") {
      if (legacyValues.length !== 0) throw new Error("new artifact target must not declare legacy paths");
      this.canonicalPath = new FlowArtifactCanonicalPath(canonicalPath).toString();
    } else if (this.action === "switch") {
      if (legacyValues.length === 0) throw new Error("switch target requires legacy paths");
      this.canonicalPath = new FlowArtifactCanonicalPath(canonicalPath).toString();
    } else {
      if (legacyValues.length === 0) throw new Error("remove target requires legacy paths");
      if (canonicalPath !== null) throw new Error("remove target must not declare a canonical path");
      this.canonicalPath = null;
    }
    this.producer = authorityActor(producer, "switch target producer");
    this.consumer = authorityActor(consumer, "switch target consumer");
    Object.freeze(this);
  }

  matchesLegacyPath(value) {
    const relativePath = safeRelativePath(value, "legacy artifact target");
    return this.legacyPaths.some((target) => target.toString() === relativePath)
      || this.legacyPatterns.some((pattern) => pattern.matches(relativePath));
  }
}

export class FlowArtifactNoArtifactClassification {
  constructor(stepId, reason) { this.stepId = identifier(stepId, "no-artifact step"); this.reason = requiredText(reason, "no-artifact reason"); Object.freeze(this); }
}

export class FlowArtifactCanonicalPath {
  constructor(value) {
    this.value = safeRelativePath(value, "artifact canonical path");
    this.parameters = Object.freeze([...this.value.matchAll(/:\{([A-Za-z0-9][A-Za-z0-9._-]*)\}/g)].map((match) => match[1]));
    if (new Set(this.parameters).size !== this.parameters.length) throw new Error("artifact canonical path must not repeat a parameter");
    Object.freeze(this);
  }
  resolve(parameters = {}) {
    const supplied = Object.keys(parameters).sort();
    const expected = [...this.parameters].sort();
    if (supplied.length !== expected.length || supplied.some((key, index) => key !== expected[index])) {
      throw new Error(`artifact path parameters must be exactly: ${expected.join(", ") || "none"}`);
    }
    let resolved = this.value;
    for (const parameter of this.parameters) {
      const value = parameter.endsWith("Path")
        ? safeRelativePath(parameters[parameter], `artifact path parameter ${parameter}`)
        : identifier(parameters[parameter], `artifact path parameter ${parameter}`);
      resolved = resolved.replace(`:{${parameter}}`, value);
    }
    return safeRelativePath(resolved, "resolved artifact canonical path");
  }
  matches(value) {
    const candidate = safeRelativePath(value, "artifact path");
    const expression = this.value.split("/").map((segment) => {
      const parameterPattern = /:\{([A-Za-z0-9][A-Za-z0-9._-]*)\}/g;
      let result = "";
      let cursor = 0;
      let match;
      while ((match = parameterPattern.exec(segment)) !== null) {
        result += segment.slice(cursor, match.index).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result += match[1].endsWith("Path") && match[0] === segment ? ".+" : "[A-Za-z0-9][A-Za-z0-9._-]*";
        cursor = match.index + match[0].length;
      }
      return result + segment.slice(cursor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("/");
    return new RegExp(`^${expression}$`).test(candidate);
  }
  toString() { return this.value; }
}

/** A typed, optionally constrained source-era path pattern. */
export class FlowArtifactLegacyPattern {
  constructor(value, { excludedPrefixes = [] } = {}) {
    this.path = value instanceof FlowArtifactCanonicalPath ? value : new FlowArtifactCanonicalPath(value);
    if (!Array.isArray(excludedPrefixes)) throw new Error("legacy artifact pattern excluded prefixes must be an array");
    this.excludedPrefixes = Object.freeze(excludedPrefixes.map((prefix) => {
      const hasTrailingSlash = typeof prefix === "string" && prefix.endsWith("/");
      const normalized = safeRelativePath(hasTrailingSlash ? prefix.slice(0, -1) : prefix, "legacy artifact pattern excluded prefix");
      return hasTrailingSlash ? `${normalized}/` : normalized;
    }));
    Object.freeze(this);
  }
  matches(value) {
    const candidate = safeRelativePath(value, "legacy artifact path");
    return this.path.matches(candidate) && !this.excludedPrefixes.some((prefix) => (
      candidate === prefix.slice(0, -1) || candidate.startsWith(prefix)
    ));
  }
  toString() { return this.path.toString(); }
}

/** One source-era filename or pattern in the normal Flow inventory. */
export class FlowArtifactKnownFile {
  constructor({ logicalKey, action, legacyPath = null, legacyPattern = null, canonicalPath = null } = {}) {
    this.logicalKey = new FlowArtifactLogicalKey(logicalKey).toString();
    this.action = identifier(action, "known Flow artifact action");
    if (!SWITCH_TARGET_ACTIONS.has(this.action)) throw new Error("known Flow artifact action is invalid");
    if (this.action === "new") {
      if (legacyPath !== null || legacyPattern !== null || canonicalPath === null) {
        throw new Error("new known Flow artifact requires exactly one canonical path");
      }
      this.legacyPath = null;
      this.legacyPattern = null;
      this.canonicalPath = canonicalPath instanceof FlowArtifactCanonicalPath
        ? canonicalPath : new FlowArtifactCanonicalPath(canonicalPath);
    } else {
      if (canonicalPath !== null || (legacyPath === null) === (legacyPattern === null)) {
        throw new Error("known Flow artifact requires exactly one legacy path or pattern");
      }
      this.legacyPath = legacyPath === null ? null : new FlowArtifactLegacyTarget(legacyPath);
      this.legacyPattern = legacyPattern === null ? null : (
        legacyPattern instanceof FlowArtifactLegacyPattern ? legacyPattern : new FlowArtifactLegacyPattern(legacyPattern)
      );
      this.canonicalPath = null;
    }
    Object.freeze(this);
  }
  matches(value) {
    const relativePath = safeRelativePath(value, "known Flow artifact path");
    return this.legacyPath?.toString() === relativePath
      || this.legacyPattern?.matches(relativePath) === true
      || this.canonicalPath?.matches(relativePath) === true;
  }
  toString() { return this.legacyPath?.toString() ?? this.legacyPattern?.toString() ?? this.canonicalPath.toString(); }
}

function legacyPatternSample(pattern) {
  return pattern.path.resolve(Object.fromEntries(pattern.path.parameters.map((parameter) => [
    parameter,
    parameter.endsWith("Path") ? "sample/path" : "sample",
  ])));
}

function legacyEntriesOverlap(left, right) {
  const leftPath = left instanceof FlowArtifactLegacyPattern ? legacyPatternSample(left) : left.toString();
  const rightPath = right instanceof FlowArtifactLegacyPattern ? legacyPatternSample(right) : right.toString();
  const leftMatches = left instanceof FlowArtifactLegacyPattern ? left.matches(rightPath) : leftPath === rightPath;
  const rightMatches = right instanceof FlowArtifactLegacyPattern ? right.matches(leftPath) : rightPath === leftPath;
  return leftMatches || rightMatches;
}

function patternInventoryIdentity(pattern) {
  return `${pattern.toString()}\0${pattern.excludedPrefixes.join("\0")}`;
}

function knownInventoryEntryIdentity(entry) {
  if (entry.legacyPath !== null) return `legacy-path:${entry.legacyPath}`;
  if (entry.legacyPattern !== null) return `legacy-pattern:${patternInventoryIdentity(entry.legacyPattern)}`;
  const type = entry.canonicalPath.parameters.length === 0 ? "canonical-path" : "canonical-pattern";
  return `${type}:${entry.canonicalPath}`;
}

function targetInventoryEntryIdentities(target) {
  if (target.action === "new") {
    const canonical = new FlowArtifactCanonicalPath(target.canonicalPath);
    const type = canonical.parameters.length === 0 ? "canonical-path" : "canonical-pattern";
    return [`${type}:${canonical}`];
  }
  return [
    ...target.legacyPaths.map((legacyPath) => `legacy-path:${legacyPath}`),
    ...target.legacyPatterns.map((legacyPattern) => `legacy-pattern:${patternInventoryIdentity(legacyPattern)}`),
  ];
}

export class FlowArtifactStepOwner {
  static reviewStep(stepId) {
    const allowed = new Set(["draft-questions-review", "draft-coverage-review", "spec-review", "test-review", "impl-review"]);
    if (!allowed.has(stepId)) throw new Error(`invalid review artifact owner: ${stepId}`);
    return new FlowArtifactStepOwner(stepId);
  }
  static taskReview(taskId) { return new FlowArtifactStepOwner(path.posix.join("impl", identifier(taskId, "taskId"), "review")); }
  constructor(value) { this.value = safeRelativePath(value, "artifact step owner"); Object.freeze(this); }
  toString() { return this.value; }
}

/** Typed task-local directory resolution; task specifications remain in spec.json.tasks[]. */
export class FlowArtifactTaskOwner {
  constructor(taskId, segment) {
    this.taskId = identifier(taskId, "taskId");
    this.segment = identifier(segment, "task artifact owner segment");
    if (!new Set(["impl", "review", "gate"]).has(this.segment)) throw new Error("task artifact owner segment is invalid");
    Object.freeze(this);
  }
  toString() { return path.posix.join("steps", "impl", this.taskId, this.segment); }
}

export class FlowArtifactOwnership {
  constructor({ producers, updaters, consumers } = {}) {
    this.producers = people(producers, "artifact producers");
    this.updaters = people(updaters, "artifact updaters");
    this.consumers = people(consumers, "artifact consumers");
    Object.freeze(this);
  }
}

export class FlowArtifactAuthoritySlot {
  constructor({ kind, authority, cardinality = "singleton", publicationStep = "system" } = {}) {
    this.kind = identifier(kind, "artifact authority slot kind");
    this.authority = ArtifactAuthority.from(authority);
    this.cardinality = ArtifactCardinality.from(cardinality);
    this.publicationStep = identifier(publicationStep, "artifact authority publication step");
    Object.freeze(this);
  }
  resolve(memberId = null) {
    if (this.cardinality.value === "singleton") {
      if (memberId !== null) throw new Error("singleton artifact authority slot must not have a memberId");
      return ArtifactAuthoritySlot.singleton({ kind: this.kind, authority: this.authority, publicationStep: this.publicationStep });
    }
    return ArtifactAuthoritySlot.collectionMember({
      kind: this.kind, authority: this.authority, memberId: identifier(memberId, "artifact authority memberId"), publicationStep: this.publicationStep,
    });
  }
  claimKey(memberId = null) { return this.resolve(memberId).claimKey(); }
}

export class FlowArtifactContract {
  constructor({ logicalKey, canonicalPath, placement, mutationPolicy = "replaceable", retention, ownership, authoritySlot, cataloged = true } = {}) {
    this.logicalKey = logicalKey instanceof FlowArtifactLogicalKey ? logicalKey : new FlowArtifactLogicalKey(logicalKey);
    this.canonicalPath = canonicalPath instanceof FlowArtifactCanonicalPath ? canonicalPath : new FlowArtifactCanonicalPath(canonicalPath);
    this.retention = retention instanceof FlowArtifactRetention ? retention : new FlowArtifactRetention(retention);
    this.placement = placement instanceof FlowArtifactPlacement ? placement : new FlowArtifactPlacement(placement);
    this.mutationPolicy = mutationPolicy instanceof FlowArtifactMutationPolicy ? mutationPolicy : new FlowArtifactMutationPolicy(mutationPolicy);
    this.ownership = ownership instanceof FlowArtifactOwnership ? ownership : new FlowArtifactOwnership(ownership);
    if (!(authoritySlot instanceof FlowArtifactAuthoritySlot)) throw new Error("artifact contract requires a FlowArtifactAuthoritySlot");
    this.authoritySlot = authoritySlot;
    if (cataloged !== true && cataloged !== false) throw new Error("artifact contract cataloged must be boolean");
    this.cataloged = cataloged;
    this.placement.assertCompatible({
      logicalKey: this.logicalKey.toString(), canonicalPath: this.canonicalPath,
      retention: this.retention, cataloged: this.cataloged,
    });
    if (!this.ownership.updaters.includes(this.authoritySlot.publicationStep)
      && !this.ownership.producers.includes(this.authoritySlot.publicationStep)) {
      throw new Error("artifact authority publication step must be a declared producer or updater");
    }
    Object.freeze(this);
  }
  resolve(parameters = {}) {
    if (this.logicalKey.toString() === "review.evidence") {
      throw new Error("review evidence must be resolved through the typed registry reviewEvidence API");
    }
    if (this.logicalKey.toString() === "final.regression.raw-log") {
      const attempt = parameters?.attempt;
      const resolvedAttempt = attempt instanceof FlowArtifactAttempt ? attempt.toString() : attempt;
      if (typeof resolvedAttempt !== "string" || !/^(?:00[1-9]|0[1-9][0-9]|[1-9][0-9]{2})$/.test(resolvedAttempt)) {
        throw new Error("final regression raw log attempt must be a typed or three-digit positive attempt");
      }
      return new ResolvedFlowArtifact(this, this.canonicalPath.resolve({ attempt: resolvedAttempt }));
    }
    return new ResolvedFlowArtifact(this, this.canonicalPath.resolve(parameters));
  }
  authoritySlotFor(updater, memberId = null) {
    const actor = identifier(updater, "artifact updater");
    if (!this.ownership.updaters.includes(actor)) throw new Error(`artifact updater is not authorized: ${actor}`);
    return new FlowArtifactAuthoritySlot({ kind: this.authoritySlot.kind, authority: this.authoritySlot.authority, cardinality: this.authoritySlot.cardinality, publicationStep: actor }).resolve(memberId);
  }
}

export class ResolvedFlowArtifact {
  constructor(contract, relativePath) {
    if (!(contract instanceof FlowArtifactContract)) throw new Error("resolved artifact requires a FlowArtifactContract");
    this.contract = contract;
    this.logicalKey = contract.logicalKey.toString();
    this.relativePath = safeRelativePath(relativePath, "resolved artifact path");
    Object.freeze(this);
  }
  authoritySlot(memberId = null) { return this.contract.authoritySlot.resolve(memberId); }
  authoritySlotFor(updater, memberId = null) { return this.contract.authoritySlotFor(updater, memberId); }
  publication({ mediaType, updater = null, memberId = null, activityId = null } = {}) {
    return Object.freeze({
      logicalKey: this.logicalKey,
      relativePath: this.relativePath,
      authoritySlot: updater === null ? this.authoritySlot(memberId) : this.authoritySlotFor(updater, memberId),
      mediaType: requiredText(mediaType, "artifact media type"),
      retention: this.contract.retention.toString(),
      activityId,
    });
  }
}

/** Review evidence binds its owner and digest into both path and collection member identity. */
export class FlowArtifactReviewEvidence {
  constructor(contract, { owner, digest } = {}) {
    if (!(owner instanceof FlowArtifactStepOwner)) throw new Error("review evidence requires a typed review owner");
    const evidenceDigest = identifier(digest, "review evidence digest");
    if (!(contract instanceof FlowArtifactContract)) throw new Error("review evidence requires a FlowArtifactContract");
    this.contract = contract;
    this.logicalKey = contract.logicalKey.toString();
    this.relativePath = contract.canonicalPath.resolve({ ownerPath: owner.toString(), digest: evidenceDigest });
    this.owner = owner;
    this.digest = evidenceDigest;
    this.memberId = crypto.createHash("sha256").update(`${owner.toString()}\0${evidenceDigest}`).digest("hex");
    Object.freeze(this);
  }
  static fromCanonicalPath(contract, relativePath) {
    if (!(contract instanceof FlowArtifactContract) || contract.logicalKey.toString() !== "review.evidence") {
      throw new Error("review evidence canonical path requires its review.evidence contract");
    }
    const match = safeRelativePath(relativePath, "review evidence canonical path").match(/^steps\/(.+)\/evidence\/([A-Za-z0-9][A-Za-z0-9._-]*)\.json$/);
    if (!match) throw new Error("review evidence canonical path must contain a typed owner and digest");
    const [, ownerPath, digest] = match;
    const taskOwner = ownerPath.match(/^impl\/([A-Za-z0-9][A-Za-z0-9._-]*)\/review$/);
    const owner = taskOwner === null
      ? FlowArtifactStepOwner.reviewStep(ownerPath)
      : FlowArtifactStepOwner.taskReview(taskOwner[1]);
    const evidence = new FlowArtifactReviewEvidence(contract, { owner, digest });
    if (evidence.relativePath !== relativePath) throw new Error("review evidence canonical path does not match its typed owner");
    return evidence;
  }
  publicationStep() { return this.owner.toString().startsWith("impl/") ? "task-review" : this.owner.toString(); }
  assertAuthoritySlot(slot) {
    if (!(slot instanceof ArtifactAuthoritySlot)) throw new Error("review evidence requires an ArtifactAuthoritySlot");
    const expected = this.authoritySlotFor(this.publicationStep());
    if (slot.kind !== expected.kind || slot.authority.toString() !== expected.authority.toString()
      || slot.cardinality.toString() !== expected.cardinality.toString() || slot.memberId !== expected.memberId
      || slot.publicationStep !== expected.publicationStep) {
      throw new Error("review evidence authority slot must be derived from its typed owner and digest");
    }
    return slot;
  }
  authoritySlotFor(updater) { return this.contract.authoritySlotFor(updater, this.memberId); }
  publication({ mediaType, updater, activityId = null } = {}) {
    return Object.freeze({
      logicalKey: this.logicalKey,
      relativePath: this.relativePath,
      authoritySlot: this.authoritySlotFor(updater),
      mediaType: requiredText(mediaType, "artifact media type"),
      retention: this.contract.retention.toString(),
      activityId,
    });
  }
}

export class FlowArtifactRegistry {
  constructor({ contracts, legacyTargets = [], switchTargets = [], knownFiles = [] } = {}) {
    if (!Array.isArray(contracts) || contracts.some((contract) => !(contract instanceof FlowArtifactContract))) {
      throw new Error("artifact registry requires typed contracts");
    }
    this.byKey = new Map();
    this.byPath = new Map();
    this.byAuthority = new Map();
    for (const contract of contracts) {
      const key = contract.logicalKey.toString();
      const canonicalPath = contract.canonicalPath.toString();
      const authority = contract.authoritySlot.claimKey(contract.authoritySlot.cardinality.value === "collection" ? "member" : null);
      if (this.byKey.has(key)) throw new Error(`duplicate artifact logical key: ${key}`);
      if (this.byPath.has(canonicalPath)) throw new Error(`duplicate artifact canonical path: ${canonicalPath}`);
      if (this.byAuthority.has(authority)) throw new Error(`duplicate artifact authority slot: ${authority}`);
      this.byKey.set(key, contract);
      this.byPath.set(canonicalPath, contract);
      this.byAuthority.set(authority, contract);
    }
    for (let left = 0; left < contracts.length; left += 1) {
      for (let right = left + 1; right < contracts.length; right += 1) {
        const leftPath = contracts[left].canonicalPath;
        const rightPath = contracts[right].canonicalPath;
        const leftSample = leftPath.resolve(Object.fromEntries(leftPath.parameters.map((parameter) => [parameter, parameter.endsWith("Path") ? "owner/path" : "member"])));
        const rightSample = rightPath.resolve(Object.fromEntries(rightPath.parameters.map((parameter) => [parameter, parameter.endsWith("Path") ? "owner/path" : "member"])));
        if (leftPath.matches(rightSample) || rightPath.matches(leftSample)) {
          throw new Error(`overlapping artifact canonical paths: ${leftPath} / ${rightPath}`);
        }
      }
    }
    const rootKeys = new Set(contracts.filter((contract) => !contract.canonicalPath.toString().includes("/")).map((contract) => contract.logicalKey.toString()));
    for (const key of ROOT_ARTIFACT_KEYS) if (!rootKeys.has(key)) throw new Error(`artifact registry is missing root contract: ${key}`);
    for (const key of rootKeys) if (!ROOT_ARTIFACT_KEYS.has(key)) throw new Error(`unclassified root artifact contract: ${key}`);
    this.legacyTargets = Object.freeze(legacyTargets.map((target) => target instanceof FlowArtifactLegacyTarget ? target : new FlowArtifactLegacyTarget(target)));
    if (new Set(this.legacyTargets.map(String)).size !== this.legacyTargets.length) throw new Error("duplicate legacy artifact target");
    if (this.legacyTargets.some((target) => this.byPath.has(target.toString()))) throw new Error("legacy artifact target must not be a canonical contract");
    if (!Array.isArray(switchTargets) || switchTargets.some((target) => !(target instanceof FlowArtifactSwitchTarget))) {
      throw new Error("artifact registry requires typed switch targets");
    }
    this.switchTargets = Object.freeze([...switchTargets]);
    const switchKeys = new Set();
    const oldPaths = new Set();
    const oldEntries = [];
    for (const target of this.switchTargets) {
      if (switchKeys.has(target.logicalKey)) throw new Error(`duplicate artifact switch logical key: ${target.logicalKey}`);
      switchKeys.add(target.logicalKey);
      for (const legacyPath of [...target.legacyPaths, ...target.legacyPatterns]) {
        const key = legacyPath.toString();
        if (oldPaths.has(key)) throw new Error(`duplicate legacy artifact switch path: ${key}`);
        if (oldEntries.some((existing) => legacyEntriesOverlap(existing, legacyPath))) {
          throw new Error(`overlapping legacy artifact switch paths: ${key}`);
        }
        oldPaths.add(key);
        oldEntries.push(legacyPath);
      }
      const contract = this.byKey.get(target.logicalKey);
      if (target.action === "remove") {
        if (contract) throw new Error(`remove target must not classify canonical contract: ${target.logicalKey}`);
        continue;
      }
      if (!contract) throw new Error(`switch target has no canonical contract: ${target.logicalKey}`);
      if (contract.canonicalPath.toString() !== target.canonicalPath) {
        throw new Error(`switch target canonical path does not match contract: ${target.logicalKey}`);
      }
      if (!contract.ownership.producers.includes(target.producer)) {
        throw new Error(`switch target producer is not declared by canonical ownership: ${target.logicalKey}`);
      }
      if (!contract.ownership.consumers.includes(target.consumer)) {
        throw new Error(`switch target consumer is not declared by canonical ownership: ${target.logicalKey}`);
      }
    }
    for (const key of this.byKey.keys()) {
      if (!switchKeys.has(key)) throw new Error(`canonical artifact contract has no switch classification: ${key}`);
    }
    if (!Array.isArray(knownFiles) || knownFiles.some((entry) => !(entry instanceof FlowArtifactKnownFile))) {
      throw new Error("artifact registry requires typed normal Flow inventory entries");
    }
    this.knownFiles = Object.freeze([...knownFiles]);
    const knownSources = new Set();
    const knownEntries = [];
    for (const entry of this.knownFiles) {
      const entryIdentity = knownInventoryEntryIdentity(entry);
      if (knownSources.has(entryIdentity)) throw new Error(`duplicate known Flow artifact path: ${entry}`);
      const legacy = entry.legacyPath ?? entry.legacyPattern;
      if (legacy !== null && knownEntries.some((existing) => legacyEntriesOverlap(existing, legacy))) {
        throw new Error(`overlapping known Flow artifact paths: ${entry}`);
      }
      knownSources.add(entryIdentity);
      if (legacy !== null) knownEntries.push(legacy);
      const target = this.switchTargets.find((candidate) => candidate.logicalKey === entry.logicalKey);
      if (!target) throw new Error(`known Flow artifact has no target: ${entry.logicalKey}`);
      if (target.action !== entry.action) throw new Error(`known Flow artifact action does not match target: ${entry.logicalKey}`);
      if (!targetInventoryEntryIdentities(target).includes(entryIdentity)) {
        throw new Error(`known Flow artifact is absent from its switch target: ${entry}`);
      }
    }
    for (const target of this.switchTargets) {
      for (const targetEntry of targetInventoryEntryIdentities(target)) {
        const matches = this.knownFiles.filter((entry) => (
          entry.logicalKey === target.logicalKey && entry.action === target.action
          && knownInventoryEntryIdentity(entry) === targetEntry
        ));
        if (matches.length !== 1) {
          throw new Error(`switch target inventory entry must be declared exactly once: ${target.logicalKey}/${targetEntry}`);
        }
      }
    }
    Object.freeze(this);
  }
  require(logicalKey) {
    const contract = this.byKey.get(new FlowArtifactLogicalKey(logicalKey).toString());
    if (!contract) throw new Error(`unknown artifact logical key: ${logicalKey}`);
    return contract;
  }
  resolve(logicalKey, parameters = {}) { return this.require(logicalKey).resolve(parameters); }
  reviewEvidence({ reviewStep = null, taskId = null, digest } = {}) {
    const owner = taskId == null ? FlowArtifactStepOwner.reviewStep(identifier(reviewStep, "review step")) : FlowArtifactStepOwner.taskReview(taskId);
    return new FlowArtifactReviewEvidence(this.require("review.evidence"), { owner, digest });
  }
  taskDirectory(taskId, segment) { return new FlowArtifactTaskOwner(taskId, segment).toString(); }
  finalRegressionRawLog(attempt) { return this.require("final.regression.raw-log").resolve({ attempt: attempt instanceof FlowArtifactAttempt ? attempt : new FlowArtifactAttempt(attempt) }); }
  classify(relativePath) {
    const matches = [...this.byKey.values()].filter((contract) => contract.canonicalPath.matches(relativePath));
    if (matches.length !== 1) throw new Error(`artifact path is not uniquely classified: ${relativePath}`);
    return matches[0];
  }
  isLegacyTarget(relativePath) { return this.legacyTargets.some((target) => target.toString() === safeRelativePath(relativePath, "legacy artifact target")); }
  inventory() { return Object.freeze([...this.byKey.values()]); }
  target(logicalKey) {
    const key = new FlowArtifactLogicalKey(logicalKey).toString();
    const target = this.switchTargets.find((candidate) => candidate.logicalKey === key);
    if (!target) throw new Error(`unknown artifact switch target: ${logicalKey}`);
    return target;
  }
  classifyKnownFile(relativePath) {
    const matches = this.knownFiles.filter((entry) => entry.matches(relativePath));
    if (matches.length !== 1) throw new Error(`known Flow artifact path is not uniquely classified: ${relativePath}`);
    return matches[0];
  }
}

const FLOW_ARTIFACT_PLACEMENTS = new Map([
  ...["flow.state", "flow.activities", "spec.record", "issue.log", "artifact.catalog", "issue.snapshot"].map((key) => [key, new FlowArtifactPlacement("root-authority")]),
  ...["report", "ideas", "tests.source", "plugin.lifecycle.artifact"].map((key) => [key, new FlowArtifactPlacement("independent-deliverable")]),
  ...["upgrade.result", "upgrade.recovery.audit", "completion.overrides", "retry.recovery", "flow.findings", "nonblocking.handoffs"].map((key) => [key, new FlowArtifactPlacement("step-shared")]),
  ...[
    "scenario.validity.raw-log", "test.execute.raw-log", "final.regression.raw-log",
    "retry.recovery.transaction", "impl.repair.transaction", "test.requirement.summary", "worker.handoff", "review.work.unit",
    "finalize.cleanup.runtime-log", "finalize.cleanup.journal",
    "runtime.lock.issue-log", "runtime.lock.current-flow-state", "runtime.lock.artifact-catalog",
    "runtime.lock.retry-recovery", "runtime.lock.flow-state-writer", "runtime.lock.flow-state-writer-owner", "runtime.lock.impl-repair",
    "runtime.lock.issue-log-owner", "runtime.lock.current-flow-state-owner", "runtime.lock.artifact-catalog-owner", "runtime.lock.retry-recovery-owner",
  ].map((key) => [key, new FlowArtifactPlacement("transient")]),
  ...[
    "draft", "draft.questions.review", "draft.questions.triage", "draft.questions.repair",
    "draft.coverage.review", "draft.coverage.triage", "draft.coverage.repair", "draft.gate.source", "draft.gate",
    "spec.review", "spec.triage", "spec.repair", "spec.gate.source", "spec.gate", "scenario.validity",
    "test.review", "test.execute", "test.result.review", "impl.review", "impl.triage", "impl.repair",
    "impl.gate.source", "impl.gate", "retro", "acceptance.review", "acceptance.review.evidence", "final.regression",
    "file.map", "placeholder.permission", "gate.memory", "repair.fingerprint", "repair.delta", "repair.migration",
    "task.review", "task.gate.source", "task.gate", "review.evidence",
    "finalize.cleanup.agent-metrics", "finalize.cleanup.notes", "finalize.cleanup.plugin-artifacts",
  ].map((key) => [key, new FlowArtifactPlacement("step-owner")]),
]);

const FLOW_ARTIFACT_MUTATION_POLICIES = new Map([
  ["review.evidence", new FlowArtifactMutationPolicy("immutable")],
]);

function placementFor(logicalKey) {
  const placement = FLOW_ARTIFACT_PLACEMENTS.get(logicalKey);
  if (!placement) throw new Error(`artifact contract is missing placement: ${logicalKey}`);
  return placement;
}

function mutationPolicyFor(logicalKey) {
  return FLOW_ARTIFACT_MUTATION_POLICIES.get(logicalKey) ?? new FlowArtifactMutationPolicy("replaceable");
}

function contract(logicalKey, canonicalPath, kind, authority, publicationStep, ownership, retention = "permanent", cardinality = "singleton", cataloged = true) {
  return new FlowArtifactContract({
    logicalKey, canonicalPath, placement: placementFor(logicalKey), mutationPolicy: mutationPolicyFor(logicalKey), retention, ownership, cataloged,
    authoritySlot: new FlowArtifactAuthoritySlot({ kind, authority, publicationStep, cardinality }),
  });
}

const own = (producers, updaters, consumers) => ({
  producers: Array.isArray(producers) ? producers : [producers],
  updaters,
  consumers,
});
export const FLOW_ARTIFACT_NO_ARTIFACT_STEPS = Object.freeze([
  new FlowArtifactNoArtifactClassification("branch", "selects execution checkout"),
  new FlowArtifactNoArtifactClassification("approval", "records an explicit decision in flow state"),
  new FlowArtifactNoArtifactClassification("acceptance-decision", "records an explicit decision in flow state"),
  new FlowArtifactNoArtifactClassification("finalize-commit", "delegates repository commit"),
  new FlowArtifactNoArtifactClassification("finalize-merge", "delegates repository merge"),
  new FlowArtifactNoArtifactClassification("task-impl", "changes repository source; task authority remains spec.json.tasks[]"),
]);

const FLOW_ARTIFACT_CONTRACT_LIST = Object.freeze([
  // Roots retain their authoritative names.  Every other permanent output is
  // owned by its producing step; independent deliverables live in artifacts/.
  contract("flow.state", "flow.json", "flow-state", "repository-metadata", "system", own(["system", "prepare-spec"], ["system", "prepare-spec", "draft", "spec", "test", "implement", "finalize-cleanup"], ["prepare-spec", "draft", "spec", "test", "implement", "report"])),
  contract("flow.activities", "activities.jsonl", "activity-ledger", "canonical-flow-artifacts", "system", own(["system", "prepare-spec"], ["system", "prepare-spec", "draft", "spec", "test", "implement"], ["prepare-spec", "draft", "spec", "test", "implement", "report"])),
  contract("spec.record", "spec.json", "spec-record", "repository-metadata", "system", own(["prepare-spec", "spec"], ["system", "prepare-spec", "spec"], ["draft", "spec", "spec-review", "test", "implement", "report"])),
  contract("issue.log", "issue-log.json", "issue-log", "canonical-flow-artifacts", "system", own(["prepare-spec", "system"], ["system", "prepare-spec", "impl-review", "impl-gate", "final-regression"], ["impl-review", "impl-gate", "acceptance-review", "report"])),
  contract("artifact.catalog", "artifact-catalog.json", "artifact-catalog", "repository-metadata", "system", own(["system", "prepare-spec"], ["system"], ["system", "prepare-spec"]), "permanent", "singleton", false),
  contract("issue.snapshot", "issue.md", "issue-snapshot", "canonical-flow-artifacts", "system", own("prepare-spec", ["system", "prepare-spec"], ["draft", "draft-questions-review", "draft-gate", "spec"])),
  contract("draft", "steps/draft/result.json", "draft", "canonical-flow-artifacts", "system", own("draft", ["system", "draft", "draft-refine"], ["draft-questions-review", "draft-coverage-review", "draft-gate", "spec"])),
  contract("draft.questions.review", "steps/draft-questions-review/result.json", "draft-questions-review", "canonical-flow-artifacts", "draft-questions-review", own("draft-questions-review", ["draft-questions-review"], ["draft-questions-triage", "draft-questions-repair", "draft-gate"])),
  contract("draft.questions.triage", "steps/draft-questions-triage/result.json", "draft-questions-triage", "canonical-flow-artifacts", "system", own("draft-questions-triage", ["system", "draft-questions-triage"], ["draft-questions-repair", "draft-refine"])),
  contract("draft.questions.repair", "steps/draft-questions-repair/result.json", "draft-questions-repair", "canonical-flow-artifacts", "system", own("draft-questions-repair", ["system", "draft-questions-repair"], ["draft-refine", "draft-gate"])),
  contract("draft.coverage.review", "steps/draft-coverage-review/result.json", "draft-coverage-review", "canonical-flow-artifacts", "draft-coverage-review", own("draft-coverage-review", ["draft-coverage-review"], ["draft-coverage-triage", "draft-coverage-repair", "draft-gate"])),
  contract("draft.coverage.triage", "steps/draft-coverage-triage/result.json", "draft-coverage-triage", "canonical-flow-artifacts", "system", own("draft-coverage-triage", ["system", "draft-coverage-triage"], ["draft-coverage-repair", "draft-gate"])),
  contract("draft.coverage.repair", "steps/draft-coverage-repair/result.json", "draft-coverage-repair", "canonical-flow-artifacts", "system", own("draft-coverage-repair", ["system", "draft-coverage-repair"], ["draft-gate"])),
  contract("draft.gate.source", "steps/draft-gate/source.json", "draft-gate-source", "canonical-flow-artifacts", "draft-gate", own("draft-gate", ["draft-gate"], ["draft-gate", "spec"])),
  contract("draft.gate", "steps/draft-gate/result.json", "draft-gate", "canonical-flow-artifacts", "draft-gate", own("draft-gate", ["draft-gate"], ["spec"])),
  contract("spec.review", "steps/spec-review/result.json", "spec-review", "canonical-flow-artifacts", "spec-review", own("spec-review", ["spec-review"], ["spec-triage", "spec-repair", "spec-gate"])),
  contract("spec.triage", "steps/spec-triage/result.json", "spec-triage", "canonical-flow-artifacts", "system", own("spec-triage", ["system", "spec-triage"], ["spec-repair", "spec-gate"])),
  contract("spec.repair", "steps/spec-repair/result.json", "spec-repair", "canonical-flow-artifacts", "system", own("spec-repair", ["system", "spec-repair"], ["spec-gate"])),
  contract("spec.gate.source", "steps/spec-gate/source.json", "spec-gate-source", "canonical-flow-artifacts", "spec-gate", own("spec-gate", ["spec-gate"], ["spec-gate", "approval"])),
  contract("spec.gate", "steps/spec-gate/result.json", "spec-gate", "canonical-flow-artifacts", "spec-gate", own("spec-gate", ["spec-gate"], ["approval"])),
  contract("scenario.validity", "steps/scenario-validity/result.json", "scenario-validity", "canonical-flow-artifacts", "scenario-validity", own("scenario-validity", ["scenario-validity"], ["test-review", "implement"])),
  contract("test.review", "steps/test-review/result.json", "test-review", "canonical-flow-artifacts", "test-review", own("test-review", ["test-review"], ["implement", "impl-review"])),
  contract("test.execute", "steps/test-execute/result.json", "test-execute", "canonical-flow-artifacts", "test-execute", own("test-execute", ["test-execute"], ["test-result-review", "impl-gate", "final-regression", "report"])),
  contract("test.result.review", "steps/test-result-review/result.json", "test-result-review", "canonical-flow-artifacts", "test-result-review", own("test-result-review", ["test-result-review"], ["impl-review", "impl-gate", "final-regression", "report"])),
  contract("impl.review", "steps/impl/review/result.json", "impl-review", "canonical-flow-artifacts", "impl-review", own("impl-review", ["impl-review"], ["impl-triage", "impl-repair", "impl-gate", "acceptance-review"])),
  contract("impl.triage", "steps/impl/triage/result.json", "impl-triage", "execution-checkout", "impl-triage", own("impl-triage", ["impl-triage"], ["impl-repair", "impl-gate", "acceptance-review"])),
  contract("impl.repair", "steps/impl/repair/result.json", "impl-repair", "execution-checkout", "impl-repair", own("impl-repair", ["impl-repair"], ["test-execute", "impl-gate", "acceptance-review"])),
  contract("impl.gate.source", "steps/impl/gate/source.json", "impl-gate-source", "canonical-flow-artifacts", "impl-gate", own("impl-gate", ["impl-gate"], ["impl-gate", "retro"])),
  contract("impl.gate", "steps/impl/gate/result.json", "impl-gate", "canonical-flow-artifacts", "impl-gate", own("impl-gate", ["impl-gate"], ["retro", "acceptance-review", "final-regression", "report"])),
  contract("retro", "steps/impl/retro/result.json", "retro", "canonical-flow-artifacts", "retro", own("retro", ["retro"], ["acceptance-review", "report"])),
  contract("acceptance.review", "steps/acceptance-review/result.json", "acceptance-review", "canonical-flow-artifacts", "acceptance-review", own("acceptance-review", ["acceptance-review"], ["acceptance-decision", "final-regression", "report"])),
  contract("acceptance.review.evidence", "steps/acceptance-review/dispositions.json", "acceptance-review-evidence", "canonical-flow-artifacts", "acceptance-review", own("acceptance-review", ["acceptance-review"], ["acceptance-review", "final-regression"])),
  contract("final.regression", "steps/final-regression/result.json", "final-regression", "canonical-flow-artifacts", "final-regression", own("final-regression", ["final-regression"], ["report"])),
  contract("report", "artifacts/report.json", "report", "canonical-flow-artifacts", "report", own("report", ["report"], ["finalize-commit", "finalize-sync"])),
  contract("ideas", "artifacts/ideas.json", "ideas", "canonical-flow-artifacts", "retro", own("retro", ["retro", "finalize-sync"], ["report", "finalize-sync"])),
  // Plugin lifecycle hooks write per-plugin durable outputs beneath this
  // namespace.  Workflow ideas retain their own contract and are excluded
  // from this broader source-era pattern below.
  contract("plugin.lifecycle.artifact", "artifacts/plugin-artifacts/:{pluginArtifactPath}", "plugin-lifecycle-artifact", "canonical-flow-artifacts", "system", own("system", ["system"], ["system"]), "permanent", "collection"),
  contract("file.map", "steps/impl/file-map.json", "file-map", "execution-checkout", "implement", own("implement", ["implement", "impl-repair"], ["impl-review", "impl-gate"])),
  // upgrade.js is the actual writer; this shared progress evidence is consumed by gates and reporting.
  contract("upgrade.result", "steps/upgrade-result.json", "upgrade-result", "canonical-flow-artifacts", "system", own("system", ["system", "impl-gate"], ["impl-gate", "final-regression", "report"])),
  contract("upgrade.recovery.audit", "steps/upgrade-recovery-audit.json", "upgrade-recovery-audit", "canonical-flow-artifacts", "system", own("system", ["system", "impl-gate"], ["impl-gate", "final-regression"])),
  contract("placeholder.permission", "steps/test/placeholder-permission.json", "placeholder-permission", "canonical-flow-artifacts", "system", own("test", ["system", "test"], ["scenario-validity", "test-review", "impl-gate"])),
  contract("completion.overrides", "steps/completion-overrides.json", "completion-overrides", "canonical-flow-artifacts", "system", own("system", ["system"], ["draft-gate", "spec-gate", "impl-gate", "final-regression"])),
  contract("retry.recovery", "steps/retry-recovery.json", "retry-recovery", "canonical-flow-artifacts", "system", own("system", ["system"], ["draft-gate", "spec-gate", "impl-gate", "test-review", "impl-review"])),
  contract("gate.memory", "steps/impl/gate/memory.json", "gate-memory", "canonical-flow-artifacts", "impl-gate", own("impl-gate", ["impl-gate"], ["impl-gate", "final-regression"])),
  contract("repair.fingerprint", "steps/impl/repair/fingerprint.json", "repair-fingerprint", "canonical-flow-artifacts", "impl-repair", own("impl-repair", ["impl-repair"], ["test-execute", "impl-gate"])),
  contract("repair.delta", "steps/impl/repair/deltas/:{deltaId}.json", "repair-delta", "canonical-flow-artifacts", "impl-repair", own("impl-repair", ["impl-repair"], ["test-execute", "impl-gate"]), "permanent", "collection"),
  contract("repair.migration", "steps/impl/repair/migration.json", "repair-migration", "canonical-flow-artifacts", "impl-repair", own("impl-repair", ["impl-repair"], ["test-execute", "impl-gate"])),
  contract("task.review", "steps/impl/:{taskId}/review/result.json", "task-review", "canonical-flow-artifacts", "task-review", own("task-review", ["task-review"], ["task-gate"])),
  contract("task.gate.source", "steps/impl/:{taskId}/gate/source.json", "task-gate-source", "canonical-flow-artifacts", "task-gate", own("task-gate", ["task-gate"], ["task-gate"])),
  contract("task.gate", "steps/impl/:{taskId}/gate/result.json", "task-gate", "canonical-flow-artifacts", "task-gate", own("task-gate", ["task-gate"], ["task-impl", "implement"])),
  contract("review.evidence", "steps/:{ownerPath}/evidence/:{digest}.json", "review-evidence", "canonical-flow-artifacts", "impl-review", own("impl-review", ["draft-questions-review", "draft-coverage-review", "spec-review", "test-review", "impl-review", "task-review"], ["draft-questions-triage", "draft-questions-repair", "draft-coverage-triage", "draft-coverage-repair", "draft-gate", "spec-triage", "spec-repair", "spec-gate", "impl-triage", "impl-repair", "impl-gate", "task-gate", "acceptance-review"]), "permanent", "collection"),
  contract("tests.source", "artifacts/tests/:{testPath}", "test-source", "canonical-flow-artifacts", "system", own("test", ["system", "test"], ["scenario-validity", "test-review", "implement", "test-execute"])),
  contract("flow.findings", "steps/flow-findings.json", "flow-findings", "canonical-flow-artifacts", "impl-review", own("impl-review", ["impl-review", "acceptance-review"], ["impl-triage", "impl-repair", "impl-gate", "acceptance-review"])),
  contract("nonblocking.handoffs", "steps/nonblocking-handoffs.json", "nonblocking-handoffs", "canonical-flow-artifacts", "test-review", own("test-review", ["test-review", "impl-review"], ["impl-gate", "acceptance-review"])),
  // Transient records are non-cataloged. Transactions and worker state are
  // runtime-only; execution logs remain next to the step that produced them.
  contract("scenario.validity.raw-log", "steps/scenario-validity/output.log", "scenario-validity-log", "canonical-flow-artifacts", "scenario-validity", own("scenario-validity", ["scenario-validity"], ["scenario-validity"]), "transient", "singleton", false),
  contract("test.execute.raw-log", "steps/test-execute/output.log", "test-execute-log", "canonical-flow-artifacts", "test-execute", own("test-execute", ["test-execute"], ["test-execute"]), "transient", "singleton", false),
  contract("final.regression.raw-log", "steps/final-regression/attempt-:{attempt}.log", "final-regression-log", "canonical-flow-artifacts", "final-regression", own("final-regression", ["final-regression"], ["final-regression"]), "transient", "collection", false),
  contract("retry.recovery.transaction", ".runtime/retry-recovery/transaction.json", "retry-recovery-transaction", "canonical-flow-artifacts", "system", own("system", ["system"], ["impl-gate"]), "transient", "singleton", false),
  contract("impl.repair.transaction", ".runtime/impl/repair/transaction.json", "impl-repair-transaction", "execution-checkout", "impl-repair", own("impl-repair", ["impl-repair"], ["impl-repair"]), "transient", "singleton", false),
  contract("test.requirement.summary", ".runtime/test/requirement-summary.json", "test-requirement-summary", "canonical-flow-artifacts", "test", own("test", ["test"], ["scenario-validity", "test-review"]), "transient", "singleton", false),
  contract("worker.handoff", ".runtime/worker-handoffs/:{handoffPath}", "worker-handoff", "dispatcher-handoff", "system", own("system", ["system"], ["draft", "spec", "test"]), "transient", "collection", false),
  contract("review.work.unit", ".runtime/review-work-units/:{workUnitPath}", "review-work-unit", "canonical-flow-artifacts", "impl-review", own("impl-review", ["impl-review"], ["impl-review"]), "transient", "collection", false),
  // Finalize cleanup persists the three user-visible durable surfaces; its
  // journal and command log are recovery diagnostics and stay non-cataloged.
  contract("finalize.cleanup.agent-metrics", "steps/finalize-cleanup/agent-metrics.json", "finalize-cleanup-agent-metrics", "canonical-flow-artifacts", "finalize-cleanup", own("finalize-cleanup", ["finalize-cleanup"], ["report"])),
  contract("finalize.cleanup.notes", "steps/finalize-cleanup/notes.json", "finalize-cleanup-notes", "canonical-flow-artifacts", "finalize-cleanup", own("finalize-cleanup", ["finalize-cleanup"], ["report"])),
  contract("finalize.cleanup.plugin-artifacts", "steps/finalize-cleanup/plugin-artifacts.json", "finalize-cleanup-plugin-artifacts", "canonical-flow-artifacts", "finalize-cleanup", own("finalize-cleanup", ["finalize-cleanup"], ["report", "finalize-sync"])),
  contract("finalize.cleanup.runtime-log", ".runtime/finalize-cleanup/runtime-log.json", "finalize-cleanup-runtime-log", "canonical-flow-artifacts", "finalize-cleanup", own("finalize-cleanup", ["finalize-cleanup"], ["finalize-cleanup"]), "transient", "singleton", false),
  contract("finalize.cleanup.journal", ".runtime/finalize-cleanup/journal.json", "finalize-cleanup-journal", "canonical-flow-artifacts", "finalize-cleanup", own("finalize-cleanup", ["finalize-cleanup"], ["finalize-cleanup"]), "transient", "singleton", false),
  // Locks are operational state, never catalog content.  These typed paths
  // keep source-era root lock files out of snapshots and migration payloads.
  contract("runtime.lock.issue-log", ".runtime/locks/issue-log.lock", "issue-log-lock", "canonical-flow-artifacts", "system", own("system", ["system"], ["system"]), "transient", "singleton", false),
  contract("runtime.lock.current-flow-state", ".runtime/locks/current-flow-state.lock", "current-flow-state-lock", "canonical-flow-artifacts", "system", own("system", ["system"], ["system"]), "transient", "singleton", false),
  contract("runtime.lock.artifact-catalog", ".runtime/locks/artifact-catalog.lock", "artifact-catalog-lock", "repository-metadata", "system", own("system", ["system"], ["system"]), "transient", "singleton", false),
  contract("runtime.lock.retry-recovery", ".runtime/locks/retry-recovery.lock", "retry-recovery-lock", "canonical-flow-artifacts", "system", own("system", ["system"], ["system"]), "transient", "singleton", false),
  contract("runtime.lock.flow-state-writer", ".runtime/locks/flow-state-writer.lock", "flow-state-writer-lock", "repository-metadata", "system", own("system", ["system"], ["system"]), "transient", "singleton", false),
  contract("runtime.lock.flow-state-writer-owner", ".runtime/locks/flow-state-writer/:{ownerToken}.owner.tmp", "flow-state-writer-owner", "repository-metadata", "system", own("system", ["system"], ["system"]), "transient", "collection", false),
  contract("runtime.lock.impl-repair", ".runtime/locks/impl-repair/:{lockPath}", "impl-repair-lock", "execution-checkout", "impl-repair", own("impl-repair", ["impl-repair"], ["impl-repair"]), "transient", "collection", false),
  contract("runtime.lock.issue-log-owner", ".runtime/locks/issue-log/:{ownerToken}.owner.tmp", "issue-log-lock-owner", "canonical-flow-artifacts", "system", own("system", ["system"], ["system"]), "transient", "collection", false),
  contract("runtime.lock.current-flow-state-owner", ".runtime/locks/current-flow-state/:{ownerToken}.owner.tmp", "current-flow-state-lock-owner", "canonical-flow-artifacts", "system", own("system", ["system"], ["system"]), "transient", "collection", false),
  contract("runtime.lock.artifact-catalog-owner", ".runtime/locks/artifact-catalog/:{ownerToken}.owner.tmp", "artifact-catalog-lock-owner", "repository-metadata", "system", own("system", ["system"], ["system"]), "transient", "collection", false),
  contract("runtime.lock.retry-recovery-owner", ".runtime/locks/retry-recovery/:{ownerToken}.owner.tmp", "retry-recovery-lock-owner", "canonical-flow-artifacts", "system", own("system", ["system"], ["system"]), "transient", "collection", false),
]);

const target = (logicalKey, legacyPaths, canonicalPath, producer, consumer) => new FlowArtifactSwitchTarget({
  logicalKey, legacyPaths, canonicalPath, action: "switch", producer, consumer,
});
const patternTarget = (logicalKey, legacyPatterns, canonicalPath, producer, consumer) => new FlowArtifactSwitchTarget({
  logicalKey, legacyPatterns, canonicalPath, action: "switch", producer, consumer,
});
const newTarget = (logicalKey, canonicalPath, producer, consumer) => new FlowArtifactSwitchTarget({
  logicalKey, canonicalPath, action: "new", producer, consumer,
});
const removeTarget = (logicalKey, legacyPaths = [], legacyPatterns = [], producer = "system", consumer = "system") => new FlowArtifactSwitchTarget({
  logicalKey, legacyPaths, legacyPatterns, action: "remove", producer, consumer,
});

export const FLOW_ARTIFACT_SWITCH_TARGETS = Object.freeze([
  target("flow.state", ["flow.json"], "flow.json", "prepare-spec", "prepare-spec"),
  newTarget("flow.activities", "activities.jsonl", "prepare-spec", "prepare-spec"),
  target("spec.record", ["spec.json"], "spec.json", "prepare-spec", "spec"),
  target("issue.log", ["issue-log.json"], "issue-log.json", "prepare-spec", "impl-gate"),
  newTarget("artifact.catalog", "artifact-catalog.json", "prepare-spec", "prepare-spec"),
  target("issue.snapshot", ["issue.md"], "issue.md", "prepare-spec", "draft"),
  target("draft", ["draft.json"], "steps/draft/result.json", "draft", "draft-questions-review"),
  target("draft.questions.review", ["draft-review-questions.json"], "steps/draft-questions-review/result.json", "draft-questions-review", "draft-questions-triage"),
  target("draft.questions.triage", ["draft-questions-triage.json"], "steps/draft-questions-triage/result.json", "draft-questions-triage", "draft-questions-repair"),
  target("draft.questions.repair", ["draft-questions-repair.json"], "steps/draft-questions-repair/result.json", "draft-questions-repair", "draft-refine"),
  target("draft.coverage.review", ["draft-review-coverage.json"], "steps/draft-coverage-review/result.json", "draft-coverage-review", "draft-coverage-triage"),
  target("draft.coverage.triage", ["draft-coverage-triage.json"], "steps/draft-coverage-triage/result.json", "draft-coverage-triage", "draft-coverage-repair"),
  target("draft.coverage.repair", ["draft-coverage-repair.json"], "steps/draft-coverage-repair/result.json", "draft-coverage-repair", "draft-gate"),
  target("draft.gate.source", ["draft-gate-source.json"], "steps/draft-gate/source.json", "draft-gate", "draft-gate"),
  target("draft.gate", ["draft-gate-result.json"], "steps/draft-gate/result.json", "draft-gate", "spec"),
  target("spec.review", ["spec-review.json"], "steps/spec-review/result.json", "spec-review", "spec-triage"),
  target("spec.triage", ["spec-triage.json"], "steps/spec-triage/result.json", "spec-triage", "spec-repair"),
  target("spec.repair", ["spec-repair.json"], "steps/spec-repair/result.json", "spec-repair", "spec-gate"),
  target("spec.gate.source", ["spec-gate-source.json"], "steps/spec-gate/source.json", "spec-gate", "spec-gate"),
  target("spec.gate", ["spec-gate-result.json"], "steps/spec-gate/result.json", "spec-gate", "approval"),
  target("scenario.validity", ["scenario-validity-result.json"], "steps/scenario-validity/result.json", "scenario-validity", "test-review"),
  target("test.review", ["test-review.json", "test-coverage.json"], "steps/test-review/result.json", "test-review", "implement"),
  target("test.execute", ["test-execute-result.json"], "steps/test-execute/result.json", "test-execute", "test-result-review"),
  target("test.result.review", ["test-result-review.json"], "steps/test-result-review/result.json", "test-result-review", "impl-review"),
  target("impl.review", ["impl-review.json"], "steps/impl/review/result.json", "impl-review", "impl-triage"),
  target("impl.triage", ["impl-triage.json"], "steps/impl/triage/result.json", "impl-triage", "impl-repair"),
  target("impl.repair", ["impl-repair.json"], "steps/impl/repair/result.json", "impl-repair", "test-execute"),
  target("impl.gate.source", ["impl-gate-source.json"], "steps/impl/gate/source.json", "impl-gate", "impl-gate"),
  target("impl.gate", ["impl-gate-result.json"], "steps/impl/gate/result.json", "impl-gate", "retro"),
  target("retro", ["retro.json"], "steps/impl/retro/result.json", "retro", "acceptance-review"),
  target("acceptance.review", ["acceptance-review.json"], "steps/acceptance-review/result.json", "acceptance-review", "final-regression"),
  target("acceptance.review.evidence", ["acceptance-review-evidence.json"], "steps/acceptance-review/dispositions.json", "acceptance-review", "acceptance-review"),
  target("final.regression", ["final-regression-result.json"], "steps/final-regression/result.json", "final-regression", "report"),
  target("report", ["report.json"], "artifacts/report.json", "report", "finalize-commit"),
  target("ideas", ["ideas.json", "plugin-artifacts/workflow/ideas.json"], "artifacts/ideas.json", "retro", "finalize-sync"),
  patternTarget("plugin.lifecycle.artifact", [new FlowArtifactLegacyPattern("plugin-artifacts/:{pluginArtifactPath}", { excludedPrefixes: ["plugin-artifacts/workflow/ideas.json"] })], "artifacts/plugin-artifacts/:{pluginArtifactPath}", "system", "system"),
  target("file.map", ["file-map.json"], "steps/impl/file-map.json", "implement", "impl-review"),
  target("upgrade.result", ["upgrade-result.json"], "steps/upgrade-result.json", "system", "impl-gate"),
  target("upgrade.recovery.audit", ["upgrade-recovery-audit.json"], "steps/upgrade-recovery-audit.json", "system", "impl-gate"),
  target("placeholder.permission", ["placeholder-permission.json"], "steps/test/placeholder-permission.json", "test", "test-review"),
  target("completion.overrides", ["completion-overrides.json"], "steps/completion-overrides.json", "system", "impl-gate"),
  target("retry.recovery", ["retry-recovery.json"], "steps/retry-recovery.json", "system", "impl-gate"),
  target("gate.memory", ["gate-impl-memory.json"], "steps/impl/gate/memory.json", "impl-gate", "impl-gate"),
  target("repair.fingerprint", ["repair-fingerprint.json"], "steps/impl/repair/fingerprint.json", "impl-repair", "test-execute"),
  patternTarget("repair.delta", ["repair-deltas/:{deltaId}.json"], "steps/impl/repair/deltas/:{deltaId}.json", "impl-repair", "test-execute"),
  target("repair.migration", ["repair-state-migration.json"], "steps/impl/repair/migration.json", "impl-repair", "impl-gate"),
  newTarget("task.review", "steps/impl/:{taskId}/review/result.json", "task-review", "task-gate"),
  target("task.gate.source", ["task-impl-gate-source.json"], "steps/impl/:{taskId}/gate/source.json", "task-gate", "task-gate"),
  target("task.gate", ["task-impl-gate-result.json"], "steps/impl/:{taskId}/gate/result.json", "task-gate", "task-impl"),
  patternTarget("review.evidence", ["review-evidence/:{digest}.json"], "steps/:{ownerPath}/evidence/:{digest}.json", "impl-review", "impl-gate"),
  patternTarget("tests.source", [new FlowArtifactLegacyPattern("tests/:{testPath}", { excludedPrefixes: ["tests/.raw/"] })], "artifacts/tests/:{testPath}", "test", "test-review"),
  target("flow.findings", ["flow-findings.json"], "steps/flow-findings.json", "impl-review", "impl-gate"),
  target("nonblocking.handoffs", ["nonblocking-handoffs.json"], "steps/nonblocking-handoffs.json", "test-review", "impl-gate"),
  target("scenario.validity.raw-log", ["tests/.raw/scenario-validity.log"], "steps/scenario-validity/output.log", "scenario-validity", "scenario-validity"),
  target("test.execute.raw-log", ["tests/.raw/test-execution.log"], "steps/test-execute/output.log", "test-execute", "test-execute"),
  patternTarget("final.regression.raw-log", ["tests/.raw/final-regression-attempt-:{attempt}.log"], "steps/final-regression/attempt-:{attempt}.log", "final-regression", "final-regression"),
  target("retry.recovery.transaction", [".retry-recovery.transaction.json"], ".runtime/retry-recovery/transaction.json", "system", "impl-gate"),
  target("impl.repair.transaction", ["impl-repair-transaction.json"], ".runtime/impl/repair/transaction.json", "impl-repair", "impl-repair"),
  target("test.requirement.summary", ["tests/.raw/requirement-summary.json"], ".runtime/test/requirement-summary.json", "test", "scenario-validity"),
  patternTarget("worker.handoff", [".sennel/handoffs/:{handoffPath}"], ".runtime/worker-handoffs/:{handoffPath}", "system", "draft"),
  patternTarget("review.work.unit", ["review-history/work-units/:{workUnitPath}"], ".runtime/review-work-units/:{workUnitPath}", "impl-review", "impl-review"),
  target("finalize.cleanup.agent-metrics", ["agent-metrics.json"], "steps/finalize-cleanup/agent-metrics.json", "finalize-cleanup", "report"),
  target("finalize.cleanup.notes", ["notes.json"], "steps/finalize-cleanup/notes.json", "finalize-cleanup", "report"),
  target("finalize.cleanup.plugin-artifacts", ["plugin-artifacts.json"], "steps/finalize-cleanup/plugin-artifacts.json", "finalize-cleanup", "finalize-sync"),
  target("finalize.cleanup.runtime-log", ["runtime-log.json"], ".runtime/finalize-cleanup/runtime-log.json", "finalize-cleanup", "finalize-cleanup"),
  target("finalize.cleanup.journal", ["finalize-cleanup.json"], ".runtime/finalize-cleanup/journal.json", "finalize-cleanup", "finalize-cleanup"),
  target("runtime.lock.issue-log", [".issue-log.lock"], ".runtime/locks/issue-log.lock", "system", "system"),
  target("runtime.lock.current-flow-state", [".current-flow-state.lock"], ".runtime/locks/current-flow-state.lock", "system", "system"),
  target("runtime.lock.artifact-catalog", [".artifact-catalog.lock"], ".runtime/locks/artifact-catalog.lock", "system", "system"),
  target("runtime.lock.retry-recovery", [".retry-recovery.lock"], ".runtime/locks/retry-recovery.lock", "system", "system"),
  target("runtime.lock.flow-state-writer", [".flow.json.writer.lock"], ".runtime/locks/flow-state-writer.lock", "system", "system"),
  patternTarget("runtime.lock.flow-state-writer-owner", [".flow.json.writer.:{ownerToken}.owner.tmp"], ".runtime/locks/flow-state-writer/:{ownerToken}.owner.tmp", "system", "system"),
  patternTarget("runtime.lock.impl-repair", [".impl-repair.lock/:{lockPath}"], ".runtime/locks/impl-repair/:{lockPath}", "impl-repair", "impl-repair"),
  patternTarget("runtime.lock.issue-log-owner", ["..issue-log.lock.:{ownerToken}.owner.tmp"], ".runtime/locks/issue-log/:{ownerToken}.owner.tmp", "system", "system"),
  patternTarget("runtime.lock.current-flow-state-owner", ["..current-flow-state.lock.:{ownerToken}.owner.tmp"], ".runtime/locks/current-flow-state/:{ownerToken}.owner.tmp", "system", "system"),
  patternTarget("runtime.lock.artifact-catalog-owner", ["..artifact-catalog.lock.:{ownerToken}.owner.tmp"], ".runtime/locks/artifact-catalog/:{ownerToken}.owner.tmp", "system", "system"),
  patternTarget("runtime.lock.retry-recovery-owner", ["..retry-recovery.lock.:{ownerToken}.owner.tmp"], ".runtime/locks/retry-recovery/:{ownerToken}.owner.tmp", "system", "system"),
  removeTarget("legacy.flow.version", ["flow-version.json"]),
  removeTarget("legacy.activity.view", ["activities.md"]),
  removeTarget("legacy.derived.views", ["draft.md", "draft-review.md", "draft-review-questions.md", "draft-review-coverage.md", "spec.md", "spec-review.md", "test-review.md", "test-result-review.md", "review.md", "qa.md"]),
  removeTarget("legacy.derived.review.artifacts", ["draft-review-questions-repair.json", "spec-review-triage.json"]),
  removeTarget("legacy.review.history", [], [new FlowArtifactLegacyPattern("review-history/:{historyPath}", { excludedPrefixes: ["review-history/work-units/"] })]),
  removeTarget("legacy.finalize.envelopes", ["report-envelope.json", "recovery-envelope.json"], [], "finalize-cleanup", "finalize-cleanup"),
  removeTarget("legacy.upgrade.log", ["tests/.raw/upgrade.log"]),
]);

const known = (logicalKey, action, legacyPath) => new FlowArtifactKnownFile({ logicalKey, action, legacyPath });
const knownPattern = (logicalKey, action, legacyPattern) => new FlowArtifactKnownFile({ logicalKey, action, legacyPattern });
const knownNew = (logicalKey, canonicalPath) => new FlowArtifactKnownFile({ logicalKey, action: "new", canonicalPath });

export const FLOW_ARTIFACT_NORMAL_FLOW_FILES = Object.freeze([
  known("flow.state", "switch", "flow.json"), knownNew("flow.activities", "activities.jsonl"),
  known("spec.record", "switch", "spec.json"), known("issue.log", "switch", "issue-log.json"),
  knownNew("artifact.catalog", "artifact-catalog.json"), known("issue.snapshot", "switch", "issue.md"),
  known("draft", "switch", "draft.json"), known("draft.questions.review", "switch", "draft-review-questions.json"),
  known("draft.questions.triage", "switch", "draft-questions-triage.json"), known("draft.questions.repair", "switch", "draft-questions-repair.json"),
  known("draft.coverage.review", "switch", "draft-review-coverage.json"), known("draft.coverage.triage", "switch", "draft-coverage-triage.json"), known("draft.coverage.repair", "switch", "draft-coverage-repair.json"),
  known("draft.gate.source", "switch", "draft-gate-source.json"), known("draft.gate", "switch", "draft-gate-result.json"),
  known("spec.review", "switch", "spec-review.json"), known("spec.triage", "switch", "spec-triage.json"), known("spec.repair", "switch", "spec-repair.json"), known("spec.gate.source", "switch", "spec-gate-source.json"), known("spec.gate", "switch", "spec-gate-result.json"),
  known("scenario.validity", "switch", "scenario-validity-result.json"), known("test.review", "switch", "test-review.json"), known("test.review", "switch", "test-coverage.json"), known("test.execute", "switch", "test-execute-result.json"), known("test.result.review", "switch", "test-result-review.json"),
  known("impl.review", "switch", "impl-review.json"), known("impl.triage", "switch", "impl-triage.json"), known("impl.repair", "switch", "impl-repair.json"), known("impl.gate.source", "switch", "impl-gate-source.json"), known("impl.gate", "switch", "impl-gate-result.json"), known("retro", "switch", "retro.json"),
  known("acceptance.review", "switch", "acceptance-review.json"), known("acceptance.review.evidence", "switch", "acceptance-review-evidence.json"), known("final.regression", "switch", "final-regression-result.json"), known("report", "switch", "report.json"), known("ideas", "switch", "ideas.json"), known("ideas", "switch", "plugin-artifacts/workflow/ideas.json"), knownPattern("plugin.lifecycle.artifact", "switch", new FlowArtifactLegacyPattern("plugin-artifacts/:{pluginArtifactPath}", { excludedPrefixes: ["plugin-artifacts/workflow/ideas.json"] })), known("file.map", "switch", "file-map.json"),
  known("upgrade.result", "switch", "upgrade-result.json"), known("upgrade.recovery.audit", "switch", "upgrade-recovery-audit.json"), known("placeholder.permission", "switch", "placeholder-permission.json"), known("completion.overrides", "switch", "completion-overrides.json"), known("retry.recovery", "switch", "retry-recovery.json"), known("gate.memory", "switch", "gate-impl-memory.json"),
  known("repair.fingerprint", "switch", "repair-fingerprint.json"), knownPattern("repair.delta", "switch", "repair-deltas/:{deltaId}.json"), known("repair.migration", "switch", "repair-state-migration.json"), known("impl.repair.transaction", "switch", "impl-repair-transaction.json"), knownNew("task.review", "steps/impl/:{taskId}/review/result.json"),
  known("task.gate.source", "switch", "task-impl-gate-source.json"), known("task.gate", "switch", "task-impl-gate-result.json"), knownPattern("review.evidence", "switch", "review-evidence/:{digest}.json"), knownPattern("tests.source", "switch", new FlowArtifactLegacyPattern("tests/:{testPath}", { excludedPrefixes: ["tests/.raw/"] })),
  known("flow.findings", "switch", "flow-findings.json"), known("nonblocking.handoffs", "switch", "nonblocking-handoffs.json"), known("scenario.validity.raw-log", "switch", "tests/.raw/scenario-validity.log"), known("test.execute.raw-log", "switch", "tests/.raw/test-execution.log"), knownPattern("final.regression.raw-log", "switch", "tests/.raw/final-regression-attempt-:{attempt}.log"), known("retry.recovery.transaction", "switch", ".retry-recovery.transaction.json"), known("test.requirement.summary", "switch", "tests/.raw/requirement-summary.json"), knownPattern("worker.handoff", "switch", ".sennel/handoffs/:{handoffPath}"), knownPattern("review.work.unit", "switch", "review-history/work-units/:{workUnitPath}"),
  known("finalize.cleanup.agent-metrics", "switch", "agent-metrics.json"), known("finalize.cleanup.notes", "switch", "notes.json"), known("finalize.cleanup.plugin-artifacts", "switch", "plugin-artifacts.json"), known("finalize.cleanup.runtime-log", "switch", "runtime-log.json"), known("finalize.cleanup.journal", "switch", "finalize-cleanup.json"),
  known("runtime.lock.issue-log", "switch", ".issue-log.lock"), known("runtime.lock.current-flow-state", "switch", ".current-flow-state.lock"), known("runtime.lock.artifact-catalog", "switch", ".artifact-catalog.lock"), known("runtime.lock.retry-recovery", "switch", ".retry-recovery.lock"), known("runtime.lock.flow-state-writer", "switch", ".flow.json.writer.lock"), knownPattern("runtime.lock.flow-state-writer-owner", "switch", ".flow.json.writer.:{ownerToken}.owner.tmp"), knownPattern("runtime.lock.impl-repair", "switch", ".impl-repair.lock/:{lockPath}"),
  knownPattern("runtime.lock.issue-log-owner", "switch", "..issue-log.lock.:{ownerToken}.owner.tmp"), knownPattern("runtime.lock.current-flow-state-owner", "switch", "..current-flow-state.lock.:{ownerToken}.owner.tmp"), knownPattern("runtime.lock.artifact-catalog-owner", "switch", "..artifact-catalog.lock.:{ownerToken}.owner.tmp"), knownPattern("runtime.lock.retry-recovery-owner", "switch", "..retry-recovery.lock.:{ownerToken}.owner.tmp"),
  known("legacy.flow.version", "remove", "flow-version.json"), known("legacy.activity.view", "remove", "activities.md"), known("legacy.derived.views", "remove", "draft.md"), known("legacy.derived.views", "remove", "draft-review.md"), known("legacy.derived.views", "remove", "draft-review-questions.md"), known("legacy.derived.views", "remove", "draft-review-coverage.md"), known("legacy.derived.views", "remove", "spec.md"), known("legacy.derived.views", "remove", "spec-review.md"), known("legacy.derived.views", "remove", "test-review.md"), known("legacy.derived.views", "remove", "test-result-review.md"), known("legacy.derived.views", "remove", "review.md"), known("legacy.derived.views", "remove", "qa.md"), known("legacy.derived.review.artifacts", "remove", "draft-review-questions-repair.json"), known("legacy.derived.review.artifacts", "remove", "spec-review-triage.json"), knownPattern("legacy.review.history", "remove", new FlowArtifactLegacyPattern("review-history/:{historyPath}", { excludedPrefixes: ["review-history/work-units/"] })), known("legacy.finalize.envelopes", "remove", "report-envelope.json"), known("legacy.finalize.envelopes", "remove", "recovery-envelope.json"), known("legacy.upgrade.log", "remove", "tests/.raw/upgrade.log"),
]);

export const FLOW_ARTIFACT_CONTRACTS = new FlowArtifactRegistry({
  contracts: FLOW_ARTIFACT_CONTRACT_LIST,
  legacyTargets: [new FlowArtifactLegacyTarget("flow-version.json"), new FlowArtifactLegacyTarget("artifacts")],
  switchTargets: FLOW_ARTIFACT_SWITCH_TARGETS,
  knownFiles: FLOW_ARTIFACT_NORMAL_FLOW_FILES,
});

export const FLOW_ARTIFACT_LEGACY_SWITCH_TARGETS = Object.freeze([
  new FlowArtifactLegacyTarget("flow-version.json"), new FlowArtifactLegacyTarget("artifacts"), new FlowArtifactLegacyTarget("review-evidence"),
]);
