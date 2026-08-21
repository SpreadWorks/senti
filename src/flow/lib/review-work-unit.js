/**
 * Transient input/output work unit for one canonical review Attempt.
 *
 * The parent creates this contract from canonical state.  The worker may only
 * consume its declared inputs and seal its one declared output.  A recovered
 * worker manifest is evidence, never authority: the parent compares it with
 * the contract it has just reconstructed from the active Attempt.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { AtomicFile } from "../../lib/atomic-file.js";
import { PRODUCT } from "../../lib/product.js";
import { captureRegularFile } from "../../lib/regular-file-snapshot.js";
import { FlowArtifactAttemptHistory } from "../../lib/flow-artifact-contract.js";

export const REVIEW_WORK_UNIT_MANIFEST_ENV = PRODUCT.env("REVIEW_WORK_UNIT_MANIFEST");
const REVIEW_WORK_UNIT_ROOT = PRODUCT.managedPath("review-work-units");
const MAX_WORK_UNIT_FILE_BYTES = 2 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const TREE_SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

function exactObject(value, fields, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} has invalid fields`);
  return value;
}

function requiredDigest(value, field) {
  const digest = requiredText(value, field).toLowerCase();
  if (!SHA256.test(digest)) throw new Error(`${field} must be a SHA-256 digest`);
  return digest;
}

function requiredTreeSha(value, field) {
  const treeSha = requiredText(value, field).toLowerCase();
  if (!TREE_SHA.test(treeSha)) throw new Error(`${field} must be a Git tree SHA`);
  return treeSha;
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isWithin(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function ensureRealDirectory(directory, boundary) {
  const target = path.resolve(directory);
  const root = path.resolve(boundary);
  if (target !== root && !isWithin(root, target)) throw new Error("review work unit directory escapes execution authority");
  const parent = path.dirname(target);
  if (target !== root) ensureRealDirectory(parent, root);
  if (!fs.existsSync(target)) fs.mkdirSync(target, { mode: 0o755 });
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(target) !== target) {
    throw new Error("review work unit directory must be a real directory");
  }
  return target;
}

function regularFile(file, label) {
  try {
    return captureRegularFile(file, { label, maxBytes: MAX_WORK_UNIT_FILE_BYTES });
  } catch (cause) {
    throw new Error(`${label} is unavailable or invalid: ${cause.message}`);
  }
}

function logicalPath(value, field) {
  const text = requiredText(value, field);
  if (path.posix.normalize(text) !== text || path.posix.isAbsolute(text) || text.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`${field} is invalid`);
  }
  return text;
}

export class ReviewWorkUnitTarget {
  constructor(value = {}) {
    const source = exactObject(value, ["treeSha", "targetStateDigest"], "review work unit target");
    this.treeSha = requiredTreeSha(source.treeSha, "review work unit target treeSha");
    this.targetStateDigest = requiredDigest(source.targetStateDigest, "review work unit target targetStateDigest");
    Object.freeze(this);
  }

  toJSON() { return { treeSha: this.treeSha, targetStateDigest: this.targetStateDigest }; }

  equals(other) {
    return other instanceof ReviewWorkUnitTarget
      && this.treeSha === other.treeSha
      && this.targetStateDigest === other.targetStateDigest;
  }
}

export class ReviewWorkUnitOutput {
  constructor(value = {}) {
    const source = exactObject(value, ["logicalKey", "basename", "mediaType"], "review work unit output");
    this.logicalKey = requiredText(source.logicalKey, "review work unit output logicalKey");
    this.basename = requiredText(source.basename, "review work unit output basename");
    if (this.basename !== path.basename(this.basename) || !this.basename.endsWith(".json")) {
      throw new Error("review work unit output basename must be a JSON basename");
    }
    this.mediaType = requiredText(source.mediaType, "review work unit output mediaType");
    Object.freeze(this);
  }

  toJSON() { return { logicalKey: this.logicalKey, basename: this.basename, mediaType: this.mediaType }; }

  equals(other) {
    return other instanceof ReviewWorkUnitOutput && stableJson(this.toJSON()) === stableJson(other.toJSON());
  }

  static forReview({ phase, taskId = null } = {}) {
    const reviewPhase = requiredText(phase, "review work unit review phase");
    const task = taskId === null ? null : requiredText(taskId, "review work unit review taskId");
    const values = {
      "draft-questions": ["draft.questions.review", "draft-review-questions.json"],
      "draft-coverage": ["draft.coverage.review", "draft-review-coverage.json"],
      spec: ["spec.review", "spec-review.json"],
      test: ["test.review", "test-review.json"],
      impl: [task === null ? "impl.review" : "task.review", "impl-review.json"],
    }[reviewPhase];
    if (!values) throw new Error("review work unit review phase is unsupported");
    return new ReviewWorkUnitOutput({ logicalKey: values[0], basename: values[1], mediaType: "application/json" });
  }
}

export class ReviewWorkUnitInput {
  constructor(value = {}) {
    const source = exactObject(value, ["logicalKey", "logicalPath", "relativePath", "digest", "byteLength", "mediaType"], "review work unit input");
    this.logicalKey = requiredText(source.logicalKey, "review work unit input logicalKey");
    this.logicalPath = logicalPath(source.logicalPath, "review work unit input logicalPath");
    this.relativePath = logicalPath(source.relativePath, "review work unit input relativePath");
    this.digest = requiredDigest(source.digest, "review work unit input digest");
    if (!Number.isSafeInteger(source.byteLength) || source.byteLength < 0 || source.byteLength > MAX_WORK_UNIT_FILE_BYTES) {
      throw new Error("review work unit input byteLength is invalid");
    }
    this.byteLength = source.byteLength;
    this.mediaType = requiredText(source.mediaType, "review work unit input mediaType");
    Object.freeze(this);
  }

  toJSON() {
    return {
      logicalKey: this.logicalKey,
      logicalPath: this.logicalPath,
      relativePath: this.relativePath,
      digest: this.digest,
      byteLength: this.byteLength,
      mediaType: this.mediaType,
    };
  }

  assertSnapshot(root) {
    const source = path.resolve(root, this.relativePath);
    if (!isWithin(root, source)) throw new Error("review work unit input escapes its directory");
    const snapshot = regularFile(source, `review work unit input ${this.logicalKey}`);
    if (snapshot.digest !== this.digest || snapshot.byteLength !== this.byteLength) {
      throw new Error(`review work unit input ${this.logicalKey} changed after manifest finalization`);
    }
    return snapshot;
  }
}

/** Parent-authoritative, exact worker contract. */
export class ReviewWorkUnitManifest {
  constructor(value = {}) {
    const source = exactObject(value, [
      "version", "runId", "specId", "phase", "taskId", "nodeId", "attemptId", "target", "inputs", "output",
    ], "review work unit manifest");
    if (source.version !== 1) throw new Error("review work unit manifest version must be 1");
    this.version = 1;
    this.runId = requiredText(source.runId, "review work unit manifest runId");
    this.specId = requiredText(source.specId, "review work unit manifest specId");
    this.phase = requiredText(source.phase, "review work unit manifest phase");
    this.taskId = source.taskId === null ? null : requiredText(source.taskId, "review work unit manifest taskId");
    this.nodeId = requiredText(source.nodeId, "review work unit manifest nodeId");
    this.attemptId = requiredText(source.attemptId, "review work unit manifest attemptId");
    this.target = source.target instanceof ReviewWorkUnitTarget ? source.target : new ReviewWorkUnitTarget(source.target);
    if (!Array.isArray(source.inputs)) throw new Error("review work unit manifest inputs must be an array");
    this.inputs = Object.freeze(source.inputs.map((input) => input instanceof ReviewWorkUnitInput ? input : new ReviewWorkUnitInput(input)));
    this.output = source.output instanceof ReviewWorkUnitOutput ? source.output : new ReviewWorkUnitOutput(source.output);
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      phase: this.phase,
      taskId: this.taskId,
      nodeId: this.nodeId,
      attemptId: this.attemptId,
      target: this.target.toJSON(),
      inputs: this.inputs.map((input) => input.toJSON()),
      output: this.output.toJSON(),
    };
  }

  get digest() { return digest(stableJson(this.toJSON())); }
  get inputDigest() { return digest(stableJson(this.inputs.map((input) => input.toJSON()))); }

  equals(other) {
    return other instanceof ReviewWorkUnitManifest && this.digest === other.digest;
  }

  assertBinding(expected) {
    if (!(expected instanceof ReviewWorkUnitManifest) || !this.equals(expected)) {
      throw new Error("review worker manifest does not match the parent Attempt contract");
    }
    return this;
  }
}

export class ReviewWorkUnitSealedOutput {
  constructor(value = {}) {
    const source = exactObject(value, ["digest", "byteLength"], "review work unit sealed output");
    this.digest = requiredDigest(source.digest, "review work unit sealed output digest");
    if (!Number.isSafeInteger(source.byteLength) || source.byteLength < 0 || source.byteLength > MAX_WORK_UNIT_FILE_BYTES) {
      throw new Error("review work unit sealed output byteLength is invalid");
    }
    this.byteLength = source.byteLength;
    Object.freeze(this);
  }

  toJSON() { return { digest: this.digest, byteLength: this.byteLength }; }

  equals(other) {
    return other instanceof ReviewWorkUnitSealedOutput
      && this.digest === other.digest
      && this.byteLength === other.byteLength;
  }
}

/** Immutable proof that the declared worker output and inputs were observed. */
export class ReviewWorkUnitSeal {
  constructor(value = {}) {
    const source = exactObject(value, ["version", "manifestDigest", "runId", "specId", "nodeId", "attemptId", "target", "inputDigest", "output"], "review work unit seal");
    if (source.version !== 1) throw new Error("review work unit seal version must be 1");
    this.version = 1;
    this.manifestDigest = requiredDigest(source.manifestDigest, "review work unit seal manifestDigest");
    this.runId = requiredText(source.runId, "review work unit seal runId");
    this.specId = requiredText(source.specId, "review work unit seal specId");
    this.nodeId = requiredText(source.nodeId, "review work unit seal nodeId");
    this.attemptId = requiredText(source.attemptId, "review work unit seal attemptId");
    this.target = source.target instanceof ReviewWorkUnitTarget ? source.target : new ReviewWorkUnitTarget(source.target);
    this.inputDigest = requiredDigest(source.inputDigest, "review work unit seal inputDigest");
    this.output = source.output instanceof ReviewWorkUnitSealedOutput
      ? source.output
      : new ReviewWorkUnitSealedOutput(source.output);
    Object.freeze(this);
  }

  static forManifest(manifest, snapshot) {
    if (!(manifest instanceof ReviewWorkUnitManifest)) throw new Error("review work unit seal requires a manifest");
    return new ReviewWorkUnitSeal({
      version: 1,
      manifestDigest: manifest.digest,
      runId: manifest.runId,
      specId: manifest.specId,
      nodeId: manifest.nodeId,
      attemptId: manifest.attemptId,
      target: manifest.target.toJSON(),
      inputDigest: manifest.inputDigest,
      output: new ReviewWorkUnitSealedOutput({ digest: snapshot.digest, byteLength: snapshot.byteLength }),
    });
  }

  toJSON() {
    return {
      version: this.version,
      manifestDigest: this.manifestDigest,
      runId: this.runId,
      specId: this.specId,
      nodeId: this.nodeId,
      attemptId: this.attemptId,
      target: this.target.toJSON(),
      inputDigest: this.inputDigest,
      output: this.output.toJSON(),
    };
  }

  assertManifest(manifest) {
    if (!(manifest instanceof ReviewWorkUnitManifest)
      || this.manifestDigest !== manifest.digest
      || this.runId !== manifest.runId
      || this.specId !== manifest.specId
      || this.nodeId !== manifest.nodeId
      || this.attemptId !== manifest.attemptId
      || !this.target.equals(manifest.target)
      || this.inputDigest !== manifest.inputDigest) {
      throw new Error("review work unit seal does not match its Attempt contract");
    }
    return this;
  }
}

/** Typed durable receipt for the exact sealed worker output. */
export class ReviewWorkUnitOutputReceipt {
  constructor(value = {}) {
    const source = exactObject(value, ["digest", "byteLength", "mediaType"], "review work unit output receipt");
    this.digest = requiredDigest(source.digest, "review work unit output receipt digest");
    if (!Number.isSafeInteger(source.byteLength) || source.byteLength < 0 || source.byteLength > MAX_WORK_UNIT_FILE_BYTES) {
      throw new Error("review work unit output receipt byteLength is invalid");
    }
    this.byteLength = source.byteLength;
    this.mediaType = requiredText(source.mediaType, "review work unit output receipt mediaType");
    Object.freeze(this);
  }

  toJSON() { return { digest: this.digest, byteLength: this.byteLength, mediaType: this.mediaType }; }

  equals(other) {
    return other instanceof ReviewWorkUnitOutputReceipt && stableJson(this.toJSON()) === stableJson(other.toJSON());
  }
}

/** A parent-created execution work unit whose manifest is the child contract. */
export class ReviewWorkUnit {
  constructor({ executionRoot, runId, specId, phase, taskId = null, nodeId, attemptId, target, output } = {}) {
    const execution = requiredText(executionRoot, "review executionRoot");
    if (!path.isAbsolute(execution)) throw new Error("review executionRoot must be absolute");
    this.executionRoot = path.resolve(execution);
    this.runId = requiredText(runId, "review work unit runId");
    this.specId = requiredText(specId, "review work unit specId");
    this.phase = requiredText(phase, "review work unit phase");
    this.taskId = taskId === null ? null : requiredText(taskId, "review work unit taskId");
    this.nodeId = requiredText(nodeId, "review work unit nodeId");
    this.attemptId = requiredText(attemptId, "review work unit attemptId");
    this.target = target instanceof ReviewWorkUnitTarget ? target : new ReviewWorkUnitTarget(target);
    this.output = output instanceof ReviewWorkUnitOutput ? output : new ReviewWorkUnitOutput(output);
    this.root = path.join(
      this.executionRoot,
      REVIEW_WORK_UNIT_ROOT,
      digest(this.specId).slice(0, 24),
      digest(this.runId).slice(0, 24),
      digest(`${this.nodeId}:${this.attemptId}`).slice(0, 32),
    );
    this.inputs = [];
    this.manifestDocument = null;
  }

  prepare() {
    ensureRealDirectory(this.root, this.executionRoot);
    ensureRealDirectory(path.join(this.root, "inputs"), this.root);
    return this;
  }

  get directory() { return this.root; }
  get manifestPath() { return path.join(this.root, "manifest.json"); }
  get sealPath() { return path.join(this.root, "seal.json"); }
  outputPath() { return path.join(this.root, this.output.basename); }

  declareInput({ logicalKey, logicalPath: name, bytes, mediaType = "application/octet-stream", root = false } = {}) {
    if (this.manifestDocument !== null) throw new Error("review work unit inputs are immutable after manifest finalization");
    const key = requiredText(logicalKey, "review work unit input logicalKey");
    const relative = logicalPath(name, "review work unit input logicalPath");
    const value = Buffer.isBuffer(bytes) ? Buffer.from(bytes) : Buffer.from(bytes);
    if (value.length > MAX_WORK_UNIT_FILE_BYTES) throw new Error("review work unit input exceeds maximum size");
    const entry = new ReviewWorkUnitInput({
      logicalKey: key,
      logicalPath: relative,
      relativePath: root ? relative : path.posix.join("inputs", relative),
      digest: digest(value),
      byteLength: value.length,
      mediaType: requiredText(mediaType, "review work unit input mediaType"),
    });
    const existing = this.inputs.find((candidate) => (
      candidate.logicalKey === entry.logicalKey && candidate.relativePath === entry.relativePath
    ));
    if (existing) {
      if (stableJson(existing.toJSON()) !== stableJson(entry.toJSON())) {
        throw new Error(`review work unit input ${entry.logicalKey} was declared inconsistently`);
      }
      return existing;
    }
    this.inputs.push(entry);
    return entry;
  }

  writeInput(value = {}) {
    this.prepare();
    const entry = this.declareInput(value);
    const target = path.resolve(this.root, entry.relativePath);
    if (!isWithin(this.root, target)) throw new Error("review work unit input escapes its directory");
    ensureRealDirectory(path.dirname(target), this.root);
    new AtomicFile(target, { phaseNamespace: "review-work-unit-input" }).write(Buffer.from(value.bytes));
    return Object.freeze({ sourcePath: target, digest: entry.digest, byteLength: entry.byteLength });
  }

  manifest() {
    return this.manifestDocument || new ReviewWorkUnitManifest({
      version: 1,
      runId: this.runId,
      specId: this.specId,
      phase: this.phase,
      taskId: this.taskId,
      nodeId: this.nodeId,
      attemptId: this.attemptId,
      target: this.target.toJSON(),
      inputs: this.inputs.map((input) => input.toJSON()),
      output: this.output.toJSON(),
    });
  }

  finalize() {
    this.prepare();
    this.manifestDocument = this.manifest();
    new AtomicFile(this.manifestPath, { phaseNamespace: "review-work-unit-manifest" })
      .write(Buffer.from(`${JSON.stringify(this.manifestDocument.toJSON(), null, 2)}\n`, "utf8"));
    return Object.freeze({ manifest: this.manifestDocument, manifestPath: this.manifestPath, directory: this.root, outputPath: this.outputPath() });
  }

  recoverSealed() {
    const hasManifest = fs.existsSync(this.manifestPath);
    const hasSeal = fs.existsSync(this.sealPath);
    if (!hasManifest && !hasSeal) return null;
    if (!hasManifest || !hasSeal) {
      this.cleanup();
      return null;
    }
    const worker = ReviewWorkUnit.fromEnvironment(
      { [REVIEW_WORK_UNIT_MANIFEST_ENV]: this.manifestPath },
      { expectedManifest: this.manifest(), expectedDirectory: this.root },
    );
    worker.readSealedOutput();
    return worker;
  }

  cleanup() {
    if (!fs.existsSync(this.root)) return false;
    const stat = fs.lstatSync(this.root);
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(this.root) !== this.root) {
      throw new Error("review work unit cleanup target is invalid");
    }
    fs.rmSync(this.root, { recursive: true });
    return true;
  }

  static fromEnvironment(environment = process.env, { expectedManifest = null, expectedDirectory = null } = {}) {
    const manifestPath = requiredText(environment[REVIEW_WORK_UNIT_MANIFEST_ENV], REVIEW_WORK_UNIT_MANIFEST_ENV);
    if (!path.isAbsolute(manifestPath) || path.basename(manifestPath) !== "manifest.json") {
      throw new Error(`${REVIEW_WORK_UNIT_MANIFEST_ENV} must be an absolute manifest path`);
    }
    const directory = path.dirname(manifestPath);
    const directoryStat = fs.lstatSync(directory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || fs.realpathSync(directory) !== directory) {
      throw new Error("review worker manifest directory must be a real directory");
    }
    const snapshot = regularFile(manifestPath, "review work unit manifest");
    let manifest;
    try { manifest = new ReviewWorkUnitManifest(JSON.parse(snapshot.bytes.toString("utf8"))); }
    catch (cause) { throw new Error(`review work unit manifest is invalid: ${cause.message}`); }
    if (expectedDirectory !== null && path.resolve(expectedDirectory) !== directory) {
      throw new Error("review worker manifest is outside the parent execution work unit");
    }
    if (expectedManifest !== null) manifest.assertBinding(expectedManifest);
    const instance = Object.create(ReviewWorkUnit.prototype);
    instance.root = directory;
    instance.manifestDocument = manifest;
    instance.manifestDigest = snapshot.digest;
    return instance;
  }

  assertOutputDirectory(directory) {
    if (path.resolve(directory) !== this.root) throw new Error("review output directory does not match its work unit manifest");
    return this;
  }

  seal() {
    if (!(this.manifestDocument instanceof ReviewWorkUnitManifest)) throw new Error("only a worker manifest may be sealed");
    for (const input of this.manifestDocument.inputs) input.assertSnapshot(this.root);
    const output = regularFile(path.join(this.root, this.manifestDocument.output.basename), "review work unit output");
    const seal = ReviewWorkUnitSeal.forManifest(this.manifestDocument, output);
    new AtomicFile(path.join(this.root, "seal.json"), { phaseNamespace: "review-work-unit-seal" })
      .write(Buffer.from(`${JSON.stringify(seal.toJSON(), null, 2)}\n`, "utf8"));
    return seal;
  }

  readSealedOutput() {
    if (!(this.manifestDocument instanceof ReviewWorkUnitManifest)) throw new Error("review work unit manifest is required");
    const sealSnapshot = regularFile(path.join(this.root, "seal.json"), "review work unit seal");
    let seal;
    try { seal = new ReviewWorkUnitSeal(JSON.parse(sealSnapshot.bytes.toString("utf8"))); }
    catch (cause) { throw new Error(`review work unit seal is invalid: ${cause.message}`); }
    seal.assertManifest(this.manifestDocument);
    for (const input of this.manifestDocument.inputs) input.assertSnapshot(this.root);
    const output = regularFile(path.join(this.root, this.manifestDocument.output.basename), "sealed review work unit output");
    if (seal.output.digest !== output.digest || seal.output.byteLength !== output.byteLength) {
      throw new Error("sealed review work unit output changed after sealing");
    }
    return Object.freeze({ bytes: output.bytes, output: this.manifestDocument.output, seal });
  }
}

function expectedNodeForManifest(manifest) {
  if (manifest.phase === "draft-questions" || manifest.phase === "draft-coverage") return `${manifest.phase}-review`;
  if (manifest.phase === "spec" || manifest.phase === "test") return `${manifest.phase}-review`;
  if (manifest.phase === "impl") return manifest.taskId === null ? "impl-review" : `${manifest.taskId}-review`;
  throw new Error("review work unit manifest phase is not recognized");
}

function safeDirectoryEntries(directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== path.resolve(directory)) {
    throw new Error("review work unit reconciliation directory is not real");
  }
  return fs.readdirSync(directory, { withFileTypes: true }).map((entry) => {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error("review work unit reconciliation found an unknown namespace entry");
    }
    return path.join(directory, entry.name);
  });
}

function descriptorSnapshot(flowManager, specId, descriptor) {
  const location = flowManager.specLocation(specId);
  const snapshot = regularFile(location.resolve(descriptor.relativePath), "canonical review receipt artifact");
  if (snapshot.digest !== descriptor.hash || snapshot.byteLength !== descriptor.size) {
    throw new Error("canonical review receipt descriptor does not match its artifact bytes");
  }
  return snapshot;
}

function confirmedReviewReceipt(flowManager, specId, manifest, seal) {
  const activity = flowManager.activityLedger(specId).find((candidate) => (
    candidate.type === "result_confirmed"
    && candidate.nodeId === manifest.nodeId
    && candidate.attemptId === manifest.attemptId
  )) ?? null;
  if (activity === null) return false;
  const catalog = flowManager.artifactCatalog(specId);
  const evidenceDescriptor = catalog.artifacts.find((entry) => (
    entry.logicalKey === "review.evidence" && entry.activityId === activity.id
  )) ?? null;
  const outputDescriptor = catalog.artifacts.find((entry) => (
    entry.logicalKey === manifest.output.logicalKey && entry.activityId === activity.id
  )) ?? null;
  if (evidenceDescriptor === null || outputDescriptor === null || outputDescriptor.mediaType !== manifest.output.mediaType) return false;
  let evidence;
  let history;
  try {
    evidence = JSON.parse(descriptorSnapshot(flowManager, specId, evidenceDescriptor).bytes.toString("utf8"));
    history = FlowArtifactAttemptHistory.fromJSON(JSON.parse(
      descriptorSnapshot(flowManager, specId, outputDescriptor).bytes.toString("utf8"),
    ));
  } catch {
    return false;
  }
  const record = history.attempts.find((entry) => entry.attempt.value === activity.sequence) ?? null;
  let outputReceipt = null;
  try {
    outputReceipt = new ReviewWorkUnitOutputReceipt(record?.payload?.artifact?.payload?.workerOutput);
  } catch {
    return false;
  }
  return evidence?.phase === manifest.phase
    && (evidence?.taskId ?? null) === manifest.taskId
    && evidence?.treeSha === manifest.target.treeSha
    && evidence?.targetStateDigest === manifest.target.targetStateDigest
    && outputReceipt.equals(new ReviewWorkUnitOutputReceipt({
      digest: seal.output.digest,
      byteLength: seal.output.byteLength,
      mediaType: manifest.output.mediaType,
    }));
}

/**
 * Dispatcher-start reconciliation for a process crash after Store confirmation
 * but before local cleanup. The worker manifest chooses no authority here: it
 * is only a locator which must match a canonical Activity and evidence receipt.
 */
export function reconcileCompletedReviewWorkUnits({ flowManager, specId, executionRoot } = {}) {
  if (!flowManager || typeof flowManager.activityLedger !== "function" || typeof flowManager.artifactCatalog !== "function") {
    throw new Error("review work unit reconciliation requires FlowManager receipts");
  }
  const state = flowManager.canonicalState(specId);
  if (state === null) throw new Error("review work unit reconciliation requires a Version-1 Flow state");
  const root = path.join(
    path.resolve(requiredText(executionRoot, "review reconciliation executionRoot")),
    REVIEW_WORK_UNIT_ROOT,
    digest(requiredText(specId, "review reconciliation specId")).slice(0, 24),
    digest(requiredText(state.runId, "review reconciliation runId")).slice(0, 24),
  );
  if (!fs.existsSync(root)) return 0;
  let cleaned = 0;
  for (const directory of safeDirectoryEntries(root)) {
    const manifestPath = path.join(directory, "manifest.json");
    const sealPath = path.join(directory, "seal.json");
    if (!fs.existsSync(manifestPath) || !fs.existsSync(sealPath)) {
      const stat = fs.lstatSync(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== directory) {
        throw new Error("unsealed review work unit cleanup target is invalid");
      }
      fs.rmSync(directory, { recursive: true });
      cleaned += 1;
      continue;
    }
    const worker = ReviewWorkUnit.fromEnvironment({ [REVIEW_WORK_UNIT_MANIFEST_ENV]: manifestPath }, { expectedDirectory: directory });
    const manifest = worker.manifestDocument;
    if (
      manifest.specId !== specId
      || manifest.runId !== state.runId
      || manifest.nodeId !== expectedNodeForManifest(manifest)
      || path.basename(directory) !== digest(`${manifest.nodeId}:${manifest.attemptId}`).slice(0, 32)
      || !manifest.output.equals(ReviewWorkUnitOutput.forReview({ phase: manifest.phase, taskId: manifest.taskId }))
    ) throw new Error("review work unit reconciliation identity does not match its execution namespace");
    const sealed = worker.readSealedOutput();
    if (confirmedReviewReceipt(flowManager, specId, manifest, sealed.seal)) {
      worker.cleanup();
      cleaned += 1;
      continue;
    }
    const activeAttempt = flowManager.canonicalState(specId)?.attempt ?? null;
    if (state.currentNodeId === manifest.nodeId && activeAttempt?.id === manifest.attemptId) continue;
    throw new Error("sealed review work unit has no canonical confirmation receipt or active Attempt");
  }
  return cleaned;
}
