import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AtomicJsonFile } from "./atomic-json-file.js";
import { ProcessOwnedLock, RealDirectoryAuthority } from "./process-owned-lock.js";

const CATALOG_SCHEMA_REVISION = 1;
const MIGRATION_CLASSIFICATIONS = new Set(["fresh", "legacy", "versioned", "conflict"]);
const MIGRATION_ARTIFACT_ROLES = new Set([
  "flow-state", "activity-ledger", "spec-record", "issue-log",
  "phase-artifact", "review-evidence", "artifact", "runtime",
]);
const ARTIFACT_AUTHORITIES = new Set([
  "canonical-flow-artifacts",
  "execution-checkout",
  "dispatcher-handoff",
  "repository-metadata",
  "user-decision",
]);
const VERSION_ROOT_AUTHORITIES = new Set(["flow.json", "flow-version.json", "activities.jsonl", "spec.json", "issue-log.json"]);
const VERSION_TRANSIENT_FILES = new Set([".issue-log.lock", ".current-flow-state.lock", ".artifact-catalog.lock"]);

function text(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function identifier(value, field) {
  const result = text(value, field);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(result)) throw new Error(`${field} must be an identifier`);
  return result;
}

function relativePath(value, field) {
  const result = text(value, field);
  if (result.includes("\\") || path.posix.isAbsolute(result) || path.posix.normalize(result) !== result) {
    throw new Error(`${field} must be a normalized POSIX relative path`);
  }
  if (result.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${field} must not contain empty, current, or parent segments`);
  }
  return result;
}

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function beforeImage(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`publication authority is not a real regular file: ${file}`);
    return Object.freeze({ file, exists: true, bytes: fs.readFileSync(file), mode: stat.mode & 0o777 });
  } catch (error) {
    if (error.code === "ENOENT") return Object.freeze({ file, exists: false, bytes: null, mode: null });
    throw error;
  }
}

function restoreBeforeImage(image) {
  const directory = path.dirname(image.file);
  if (image.exists) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o755 });
    fs.writeFileSync(image.file, image.bytes, { mode: image.mode });
    fs.chmodSync(image.file, image.mode);
    const descriptor = fs.openSync(image.file, "r");
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  } else {
    try { fs.unlinkSync(image.file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  fsyncDirectory(directory);
}

function codeUnitOrder(left, right) { return left < right ? -1 : left > right ? 1 : 0; }

function catalogManagedPath(value) {
  return VERSION_ROOT_AUTHORITIES.has(value) || value.startsWith("phases/") || value.startsWith("artifacts/");
}

function assertNoSymlinkAncestor(root, file) {
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("artifact path escapes the Version root");
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`artifact path contains a symbolic-link ancestor: ${relative}`);
  }
}

function managedFiles(root, current = root, result = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    const rel = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isSymbolicLink()) throw new Error(`Version storage must not contain symbolic links: ${rel}`);
    if (entry.isDirectory()) {
      if (rel === ".runtime" || rel === ".senti") continue;
      managedFiles(root, absolute, result);
      continue;
    }
    if (!entry.isFile()) throw new Error(`Version storage contains an unsupported entry: ${rel}`);
    if (rel === "artifact-catalog.json" || VERSION_TRANSIENT_FILES.has(rel)) continue;
    if (!catalogManagedPath(rel)) throw new Error(`Version storage contains an unclassified artifact: ${rel}`);
    result.push(rel);
  }
  return result.sort(codeUnitOrder);
}

class IdentityValue {
  constructor(value, field) { this.value = identifier(value, field); Object.freeze(this); }
  toString() { return this.value; }
  toJSON() { return this.value; }
  equals(other) { return other instanceof this.constructor && other.value === this.value; }
}

export class FlowId extends IdentityValue {
  constructor(value) { super(value, "flowId"); }
  static from(value) { return value instanceof FlowId ? value : new FlowId(value); }
}

export class FlowVersionId extends IdentityValue {
  constructor(value) { super(value, "flowVersionId"); }
  static from(value) { return value instanceof FlowVersionId ? value : new FlowVersionId(value); }
}

export class FlowSpecIdentity extends IdentityValue {
  constructor(value) { super(value, "specId"); }
  static from(value) { return value instanceof FlowSpecIdentity ? value : new FlowSpecIdentity(value); }
}

export class FlowRunId extends IdentityValue {
  constructor(value) { super(value, "runId"); }
  static from(value) { return value instanceof FlowRunId ? value : new FlowRunId(value); }
}

export class FlowVersion {
  constructor(value) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("version must be a positive safe integer");
    this.value = value;
    Object.freeze(this);
  }
  static from(value) { return value instanceof FlowVersion ? value : new FlowVersion(value); }
  get pathSegment() { return String(this.value).padStart(3, "0"); }
  toJSON() { return this.value; }
  toString() { return String(this.value); }
}

export class ArtifactAuthority {
  constructor(value) {
    this.value = text(value, "artifact authority");
    if (!ARTIFACT_AUTHORITIES.has(this.value)) throw new Error(`invalid artifact authority: ${this.value}`);
    Object.freeze(this);
  }
  static from(value) { return value instanceof ArtifactAuthority ? value : new ArtifactAuthority(value); }
  toString() { return this.value; }
  toJSON() { return this.value; }
}

export class FlowVersionIdentity {
  constructor({ flowId, flowVersionId, version, specId, runId } = {}) {
    this.flowId = FlowId.from(flowId);
    this.flowVersionId = FlowVersionId.from(flowVersionId);
    this.version = FlowVersion.from(version);
    this.specId = FlowSpecIdentity.from(specId);
    this.runId = FlowRunId.from(runId);
    Object.freeze(this);
  }
  toJSON() { return { flowId: this.flowId.toJSON(), flowVersionId: this.flowVersionId.toJSON(), version: this.version.toJSON(), specId: this.specId.toJSON(), runId: this.runId.toJSON() }; }
}

export class FlowVersionRecord {
  constructor({ identity, schemaRevision } = {}) {
    this.identity = identity instanceof FlowVersionIdentity ? identity : new FlowVersionIdentity(identity);
    if (!Number.isSafeInteger(schemaRevision) || schemaRevision < 1) throw new Error("schemaRevision must be a positive safe integer");
    this.schemaRevision = schemaRevision;
    Object.freeze(this);
  }
  toJSON() { return { ...this.identity.toJSON(), schemaRevision: this.schemaRevision }; }
}

export class FlowVersionLocation {
  constructor({ repositoryRoot, specRoot = "specs", specId, version } = {}) {
    if (typeof repositoryRoot !== "string" || !path.isAbsolute(repositoryRoot)) throw new Error("repositoryRoot must be an absolute path");
    this.repositoryRoot = path.resolve(repositoryRoot);
    this.specRoot = relativePath(specRoot, "specRoot");
    this.specId = FlowSpecIdentity.from(specId);
    this.version = FlowVersion.from(version);
    this.relativeDirectory = path.posix.join(this.specRoot, this.specId.toString(), this.version.pathSegment);
    this.directory = path.join(this.repositoryRoot, ...this.relativeDirectory.split("/"));
    Object.freeze(this);
  }
  relativePath(value) { return path.posix.join(this.relativeDirectory, relativePath(value, "version-relative path")); }
  resolve(value) { return path.join(this.directory, ...relativePath(value, "version-relative path").split("/")); }
  phasePath(phase, value) { return this.resolve(path.posix.join("phases", identifier(phase, "phase"), relativePath(value, "phase artifact path"))); }
  runtimePath(value) { return this.resolve(path.posix.join(".runtime", relativePath(value, "runtime artifact path"))); }
  artifactPath(value) { return this.resolve(path.posix.join("artifacts", relativePath(value, "artifact path"))); }
  get flowStateFile() { return this.resolve("flow.json"); }
  get identityFile() { return this.resolve("flow-version.json"); }
  get activitiesFile() { return this.resolve("activities.jsonl"); }
  get specFile() { return this.resolve("spec.json"); }
  get catalogFile() { return this.resolve("artifact-catalog.json"); }
  get issueLogFile() { return this.resolve("issue-log.json"); }
  get reportFile() { return this.resolve("artifacts/report.json"); }
  get reviewEvidenceDirectory() { return this.resolve("phases/review/evidence"); }
  get resumeRuntimeFile() { return this.runtimePath("resume.json"); }
  get finalizeRuntimeFile() { return this.runtimePath("finalize.json"); }
  validatorArtifactPath(value) { return this.phasePath("validation", value); }
  gateArtifactPath(phase, value) { return this.phasePath(`gate-${identifier(phase, "gate phase")}`, value); }
  reviewEvidencePath(value) { return path.join(this.reviewEvidenceDirectory, ...relativePath(value, "review evidence path").split("/")); }
}

export class FlowArtifactDescriptor {
  constructor({ kind, relativePath: file, hash, size, mediaType, authority, retention, activityId = null } = {}) {
    this.kind = identifier(kind, "artifact kind");
    this.relativePath = relativePath(file, "artifact relativePath");
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("artifact hash must be a lowercase SHA-256 digest");
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("artifact size must be a non-negative safe integer");
    this.hash = hash;
    this.size = size;
    this.mediaType = text(mediaType, "artifact mediaType");
    this.authority = ArtifactAuthority.from(authority);
    this.retention = identifier(retention, "artifact retention");
    this.activityId = activityId == null ? null : identifier(activityId, "artifact activityId");
    Object.freeze(this);
  }
  static fromFile({ location, kind, relativePath: file, mediaType, authority, retention, activityId = null } = {}) {
    if (!(location instanceof FlowVersionLocation)) throw new Error("FlowVersionLocation is required to capture an artifact");
    const safePath = relativePath(file, "artifact relativePath");
    const filePath = location.resolve(safePath);
    if (!catalogManagedPath(safePath)) throw new Error(`artifact is outside catalog-managed storage: ${safePath}`);
    assertNoSymlinkAncestor(location.directory, filePath);
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("artifact must be a regular non-symlink file");
    const bytes = fs.readFileSync(filePath);
    return new FlowArtifactDescriptor({ kind, relativePath: safePath, hash: sha256(bytes), size: bytes.length, mediaType, authority, retention, activityId });
  }
  verify(location) {
    const actual = FlowArtifactDescriptor.fromFile({ location, kind: this.kind, relativePath: this.relativePath, mediaType: this.mediaType, authority: this.authority, retention: this.retention, activityId: this.activityId });
    if (actual.hash !== this.hash || actual.size !== this.size) throw new Error(`artifact content does not match the catalog: ${this.relativePath}`);
    return actual;
  }
  authorityKey() { return `${this.kind}\0${this.authority.toString()}`; }
  toJSON() { return { kind: this.kind, relativePath: this.relativePath, hash: this.hash, size: this.size, mediaType: this.mediaType, authority: this.authority.toJSON(), retention: this.retention, activityId: this.activityId }; }
}

export class FlowArtifactCatalog {
  constructor({ schemaRevision = CATALOG_SCHEMA_REVISION, artifacts = [] } = {}) {
    if (schemaRevision !== CATALOG_SCHEMA_REVISION) throw new Error(`unsupported artifact catalog schemaRevision: ${schemaRevision}`);
    if (!Array.isArray(artifacts)) throw new Error("artifact catalog artifacts must be an array");
    const sorted = artifacts.map((entry) => entry instanceof FlowArtifactDescriptor ? entry : new FlowArtifactDescriptor(entry));
    sorted.sort((left, right) => codeUnitOrder(left.relativePath, right.relativePath) || codeUnitOrder(left.kind, right.kind));
    const paths = new Set();
    const authorities = new Set();
    for (const artifact of sorted) {
      if (paths.has(artifact.relativePath)) throw new Error(`duplicate artifact path: ${artifact.relativePath}`);
      if (!catalogManagedPath(artifact.relativePath)) throw new Error(`artifact is outside catalog-managed storage: ${artifact.relativePath}`);
      if (authorities.has(artifact.authorityKey())) throw new Error(`duplicate artifact authority: ${artifact.kind}/${artifact.authority}`);
      paths.add(artifact.relativePath); authorities.add(artifact.authorityKey());
    }
    this.schemaRevision = schemaRevision;
    this.artifacts = Object.freeze(sorted);
    this.hash = sha256(Buffer.from(JSON.stringify(this.content()), "utf8"));
    Object.freeze(this);
  }
  content() { return { schemaRevision: this.schemaRevision, artifacts: this.artifacts.map((artifact) => artifact.toJSON()) }; }
  static regenerate(descriptors) { return new FlowArtifactCatalog({ artifacts: descriptors }); }
  resolve(file) {
    const result = this.artifacts.find((artifact) => artifact.relativePath === relativePath(file, "artifact relativePath"));
    if (!result) throw new Error(`artifact is not cataloged: ${file}`);
    return result;
  }
  verify(location) {
    if (!(location instanceof FlowVersionLocation)) throw new Error("FlowVersionLocation is required to verify an artifact catalog");
    const actual = new Set(managedFiles(location.directory));
    const cataloged = new Set(this.artifacts.map((artifact) => artifact.relativePath));
    for (const file of actual) if (!cataloged.has(file)) throw new Error(`catalog-managed artifact is missing from the catalog: ${file}`);
    for (const artifact of this.artifacts) artifact.verify(location);
    return this;
  }
  toJSON() { return { ...this.content(), hash: this.hash }; }
}

export class FlowArtifactCatalogStore {
  constructor({ location, faultInjector } = {}) {
    if (!(location instanceof FlowVersionLocation)) throw new Error("FlowVersionLocation is required for artifact catalog storage");
    this.location = location;
    this.file = new AtomicJsonFile(location.catalogFile, ...(faultInjector ? [{ faultInjector }] : []));
    this.faultInjector = faultInjector ?? null;
    Object.freeze(this);
  }
  load() {
    const value = this.file.read(null);
    if (value === null) return null;
    const catalog = new FlowArtifactCatalog(value);
    if (value.hash !== catalog.hash) throw new Error("artifact catalog hash does not match its canonical content");
    return catalog.verify(this.location);
  }
  require() {
    const catalog = this.load();
    if (catalog === null) throw new Error("artifact catalog is required for Version authoritative storage");
    return catalog;
  }
  save(catalog) {
    if (!(catalog instanceof FlowArtifactCatalog)) throw new Error("FlowArtifactCatalog is required");
    fs.mkdirSync(this.location.directory, { recursive: true, mode: 0o755 });
    catalog.verify(this.location);
    this.file.write(catalog.toJSON());
    return catalog;
  }
  regenerate(descriptors) { return this.save(FlowArtifactCatalog.regenerate(descriptors)); }
  publish({ relativePath: file, kind, mediaType, authority, retention, activityId = null, write } = {}) {
    return this.publishMany({
      artifacts: [{ relativePath: file, kind, mediaType, authority, retention, activityId }],
      write,
    });
  }
  publishMany({ artifacts, write } = {}) {
    if (typeof write !== "function") throw new Error("catalog publication requires a write function");
    if (!Array.isArray(artifacts) || artifacts.length === 0) throw new Error("catalog publication requires artifacts");
    return this.#withPublicationLock(() => {
      const paths = new Set(artifacts.map((artifact) => relativePath(artifact.relativePath, "artifact relativePath")));
      const images = [
        ...[...paths].map((file) => beforeImage(this.location.resolve(file))),
        beforeImage(this.location.catalogFile),
      ];
      const previous = this.require();
      try {
        const result = write();
        const descriptors = artifacts.map((artifact) => FlowArtifactDescriptor.fromFile({ location: this.location, ...artifact }));
        const catalog = new FlowArtifactCatalog({
          artifacts: [...previous.artifacts.filter((artifact) => !paths.has(artifact.relativePath)), ...descriptors],
        });
        this.save(catalog);
        return Object.freeze({ result, catalog });
      } catch (error) {
        this.#rollback(images, error);
      }
    });
  }
  unpublish({ relativePath: file, write } = {}) {
    if (typeof write !== "function") throw new Error("catalog unpublication requires a write function");
    const safePath = relativePath(file, "artifact relativePath");
    return this.#withPublicationLock(() => {
      const images = [beforeImage(this.location.resolve(safePath)), beforeImage(this.location.catalogFile)];
      const previous = this.require();
      try {
        const result = write();
        const catalog = new FlowArtifactCatalog({ artifacts: previous.artifacts.filter((artifact) => artifact.relativePath !== safePath) });
        this.save(catalog);
        return Object.freeze({ result, catalog });
      } catch (error) {
        this.#rollback(images, error);
      }
    });
  }
  #withPublicationLock(operation) {
    const directoryAuthority = new RealDirectoryAuthority(this.location.directory);
    directoryAuthority.ensure();
    const lock = new ProcessOwnedLock({
      directoryAuthority,
      fileName: ".artifact-catalog.lock",
      kind: "artifact-catalog-publication",
      authority: { directory: this.location.directory, catalog: this.location.catalogFile },
    });
    lock.acquire({ claimStale: true });
    let result;
    let primaryError = null;
    try { result = operation(); } catch (error) { primaryError = error; }
    try { lock.release(); } catch (releaseError) {
      if (primaryError) throw new AggregateError([primaryError, releaseError], "artifact catalog publication and lock release failed", { cause: primaryError });
      throw releaseError;
    }
    if (primaryError) throw primaryError;
    return result;
  }
  #rollback(images, originalError) {
    try {
      for (const image of [...images].reverse()) restoreBeforeImage(image);
    } catch (rollbackError) {
      throw new AggregateError([originalError, rollbackError], "artifact catalog publication authority corrupted during rollback", { cause: originalError });
    }
    throw originalError;
  }
}

export class FlowVersionIdentityStore {
  constructor({ location } = {}) {
    if (!(location instanceof FlowVersionLocation)) throw new Error("FlowVersionLocation is required for Flow Version identity storage");
    this.location = location;
    this.file = new AtomicJsonFile(location.identityFile);
    Object.freeze(this);
  }
  create(record) {
    if (!(record instanceof FlowVersionRecord)) throw new Error("FlowVersionRecord is required");
    if (!record.identity.specId.equals(this.location.specId) || record.identity.version.value !== this.location.version.value) {
      throw new Error("Flow Version identity does not match its Version location");
    }
    if (fs.existsSync(this.location.identityFile)) throw new Error("Flow Version identity already exists");
    fs.mkdirSync(this.location.directory, { recursive: true, mode: 0o755 });
    this.file.write(record.toJSON());
    return record;
  }
  load() {
    const value = this.file.read(null);
    if (value === null) return null;
    const record = new FlowVersionRecord({ identity: value, schemaRevision: value.schemaRevision });
    if (!record.identity.specId.equals(this.location.specId) || record.identity.version.value !== this.location.version.value) {
      throw new Error("persisted Flow Version identity does not match its Version location");
    }
    return record;
  }
}

export class FlowVersionMigrationClassification {
  constructor({ value, sourcePath = null, target } = {}) {
    if (!MIGRATION_CLASSIFICATIONS.has(value)) throw new Error(`invalid Flow Version migration classification: ${value}`);
    if (!(target instanceof FlowVersionLocation)) throw new Error("FlowVersionLocation is required for migration classification");
    this.value = value;
    this.sourcePath = sourcePath == null ? null : text(sourcePath, "migration sourcePath");
    this.target = target;
    Object.freeze(this);
  }
  static inspect({ sourcePath = null, legacyPresent, versionPresent, target } = {}) {
    if (typeof legacyPresent !== "boolean" || typeof versionPresent !== "boolean") throw new Error("migration classification presence flags must be boolean");
    const value = legacyPresent && versionPresent ? "conflict" : versionPresent ? "versioned" : legacyPresent ? "legacy" : "fresh";
    return new FlowVersionMigrationClassification({ value, sourcePath, target });
  }
  get migratable() { return this.value === "legacy" || this.value === "fresh"; }
  toJSON() { return { classification: this.value, sourcePath: this.sourcePath, targetDirectory: this.target.relativeDirectory, migratable: this.migratable }; }
}

export class FlowVersionMigrationArtifact {
  constructor({ role, sourcePath, targetPath } = {}) {
    if (!MIGRATION_ARTIFACT_ROLES.has(role)) throw new Error(`unknown migration artifact role: ${role}`);
    this.role = role;
    this.sourcePath = relativePath(sourcePath, "migration source artifact path");
    this.targetPath = relativePath(targetPath, "migration target artifact path");
    if (role === "runtime" ? !this.targetPath.startsWith(".runtime/") : !catalogManagedPath(this.targetPath)) {
      throw new Error(`migration target does not match its role: ${this.targetPath}`);
    }
    Object.freeze(this);
  }
  toJSON() { return { role: this.role, sourcePath: this.sourcePath, targetPath: this.targetPath, cataloged: this.role !== "runtime" }; }
}

function classifyMigrationArtifact(sourcePath) {
  if (sourcePath === "flow.json") return { role: "flow-state", targetPath: "flow.json" };
  if (sourcePath === "activities.jsonl") return { role: "activity-ledger", targetPath: "activities.jsonl" };
  if (sourcePath === "spec.json") return { role: "spec-record", targetPath: "spec.json" };
  if (sourcePath === "issue-log.json") return { role: "issue-log", targetPath: "issue-log.json" };
  if (sourcePath.startsWith(".runtime/")) return { role: "runtime", targetPath: sourcePath };
  if (sourcePath.startsWith("review-evidence/")) return { role: "review-evidence", targetPath: `phases/review/evidence/${sourcePath.slice("review-evidence/".length)}` };
  if (sourcePath.startsWith("phases/")) return { role: "phase-artifact", targetPath: sourcePath };
  if (sourcePath.startsWith("artifacts/")) return { role: "artifact", targetPath: sourcePath };
  throw new Error(`unknown legacy migration artifact: ${sourcePath}`);
}

export class FlowVersionMigrationClassifier {
  constructor({ target } = {}) {
    if (!(target instanceof FlowVersionLocation)) throw new Error("FlowVersionLocation is required for migration classification");
    this.target = target;
    Object.freeze(this);
  }
  inspectDirectory(sourceDirectory) {
    const root = path.resolve(text(sourceDirectory, "migration source directory"));
    if (!fs.existsSync(root) || !fs.lstatSync(root).isDirectory()) throw new Error("migration source directory must be a real directory");
    const artifacts = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        const sourcePath = path.relative(root, absolute).split(path.sep).join("/");
        if (entry.isSymbolicLink()) throw new Error(`unsafe migration source symlink: ${sourcePath}`);
        if (entry.isDirectory()) { visit(absolute); continue; }
        if (!entry.isFile()) throw new Error(`unsupported migration source entry: ${sourcePath}`);
        const classified = classifyMigrationArtifact(sourcePath);
        artifacts.push(new FlowVersionMigrationArtifact({ sourcePath, ...classified }));
      }
    };
    visit(root);
    return Object.freeze(artifacts.sort((left, right) => codeUnitOrder(left.sourcePath, right.sourcePath)));
  }
}

export class FlowVersionMigrationPlan {
  constructor({ classification, artifacts = [] } = {}) {
    if (!(classification instanceof FlowVersionMigrationClassification)) throw new Error("FlowVersionMigrationClassification is required");
    if (!classification.migratable) throw new Error(`migration cannot plan a ${classification.value} source`);
    if (!Array.isArray(artifacts)) throw new Error("migration artifacts must be an array");
    const entries = artifacts.map((artifact) => artifact instanceof FlowVersionMigrationArtifact ? artifact : new FlowVersionMigrationArtifact(artifact));
    const targets = new Set();
    for (const artifact of entries) {
      if (targets.has(artifact.targetPath)) throw new Error(`migration target conflict: ${artifact.targetPath}`);
      targets.add(artifact.targetPath);
    }
    this.classification = classification;
    this.artifacts = Object.freeze(entries.sort((left, right) => codeUnitOrder(left.targetPath, right.targetPath)));
    this.writes = Object.freeze([...new Set([
      ...this.artifacts.map((artifact) => classification.target.relativePath(artifact.targetPath)),
      classification.target.relativePath("flow-version.json"),
      classification.target.relativePath("artifact-catalog.json"),
    ])].sort(codeUnitOrder));
    Object.freeze(this);
  }
  outputFixture({ identity, state, spec } = {}) {
    return new FlowVersionMigrationFixture({ plan: this, identity, state, spec });
  }
  toJSON() { return { mode: "dry-run", layout: "flow-version-v1", ...this.classification.toJSON(), artifacts: this.artifacts.map((artifact) => artifact.toJSON()), writes: [...this.writes] }; }
}

export class FlowVersionMigrationFixture {
  #state;
  #spec;
  constructor({ plan, identity, state, spec } = {}) {
    if (!(plan instanceof FlowVersionMigrationPlan)) throw new Error("FlowVersionMigrationPlan is required for migration fixture output");
    if (!(identity instanceof FlowVersionRecord)) throw new Error("FlowVersionRecord is required for migration fixture output");
    if (
      identity.identity.specId.toString() !== plan.classification.target.specId.toString()
      || identity.identity.version.value !== plan.classification.target.version.value
    ) throw new Error("migration fixture identity does not match the target Version location");
    if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("migration fixture state must be an object");
    if (state.schemaRevision !== identity.schemaRevision || state.version !== identity.identity.version.value) {
      throw new Error("migration fixture state schemaRevision/version does not match its identity");
    }
    if (!spec || typeof spec !== "object" || Array.isArray(spec) || (spec.id ?? spec.specId) !== identity.identity.specId.toString()) {
      throw new Error("migration fixture spec must match its identity specId");
    }
    const roles = new Set(plan.artifacts.map((artifact) => artifact.role));
    if (!roles.has("flow-state") || !roles.has("spec-record")) throw new Error("migration fixture requires flow-state and spec-record artifacts");
    this.plan = plan;
    this.identity = identity;
    this.#state = structuredClone(state);
    this.#spec = structuredClone(spec);
    Object.freeze(this);
  }
  get format() { return "flow-version-v1"; }
  get directory() { return this.plan.classification.target.relativeDirectory; }
  toJSON() {
    return {
      format: this.format,
      directory: this.directory,
      identity: this.identity.toJSON(),
      state: structuredClone(this.#state),
      spec: structuredClone(this.#spec),
      artifacts: this.plan.artifacts.map((artifact) => artifact.toJSON()),
      catalogPaths: this.plan.artifacts.filter((artifact) => artifact.role !== "runtime").map((artifact) => artifact.targetPath),
    };
  }
}
