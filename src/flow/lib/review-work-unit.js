/**
 * Execution-checkout work unit for one canonical review Attempt.
 *
 * The parent creates this contract from canonical state.  The worker may only
 * consume its declared inputs and seal its one declared output.  A recovered
 * worker manifest is evidence, never authority: the parent compares it with
 * the contract it has just reconstructed from the active Attempt.
 */

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { AtomicFile } from "../../lib/atomic-file.js";
import {
  sanitizeGitRepositoryEnvironment,
  sanitizeGitSourceListingEnvironment,
} from "../../lib/git-repository-environment.js";
import { PRODUCT } from "../../lib/product.js";
import { captureRegularFile, RegularFileSnapshot } from "../../lib/regular-file-snapshot.js";
import { FlowArtifactAttemptHistory } from "../../lib/flow-artifact-contract.js";

export const REVIEW_WORK_UNIT_MANIFEST_ENV = PRODUCT.env("REVIEW_WORK_UNIT_MANIFEST");
export const REVIEW_WORK_UNIT_CHECKOUT_ENV = PRODUCT.env("REVIEW_WORK_UNIT_CHECKOUT");
const REVIEW_WORK_UNIT_ROOT = PRODUCT.managedPath("review-work-units");
const MAX_WORK_UNIT_FILE_BYTES = 2 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const TREE_SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const CHECKOUT_EXCLUDED_NAMES = new Set([".git", ".sennel", ".tmp", "node_modules"]);
const MAX_EXECUTION_CHECKOUT_FILES = 20_000;
const MAX_EXECUTION_CHECKOUT_BYTES = 64 * 1024 * 1024;
const MAX_EXECUTION_CHECKOUT_MANIFEST_BYTES = 4 * 1024 * 1024;

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

function existingRealDirectory(directory, label) {
  const target = path.resolve(requiredText(directory, label));
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(target) !== target) {
    throw new Error(`${label} must be an existing real directory`);
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

function checkoutManifestFile(file) {
  try {
    return captureRegularFile(file, {
      label: "review execution checkout manifest",
      maxBytes: MAX_EXECUTION_CHECKOUT_MANIFEST_BYTES,
    });
  } catch (cause) {
    throw new Error(`review execution checkout manifest is unavailable or invalid: ${cause.message}`);
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

/** One immutable source file recorded in a parent-created review checkout. */
export class ReviewExecutionCheckoutFile {
  constructor(value = {}) {
    const source = exactObject(value, ["relativePath", "digest", "byteLength"], "review execution checkout file");
    this.relativePath = logicalPath(source.relativePath, "review execution checkout file relativePath");
    this.digest = requiredDigest(source.digest, "review execution checkout file digest");
    if (!Number.isSafeInteger(source.byteLength) || source.byteLength < 0) {
      throw new Error("review execution checkout file byteLength is invalid");
    }
    this.byteLength = source.byteLength;
    Object.freeze(this);
  }

  toJSON() { return { relativePath: this.relativePath, digest: this.digest, byteLength: this.byteLength }; }
}

/** One git-selected source entry captured before the checkout copy begins. */
class ReviewExecutionCheckoutSourceEntry {
  constructor({ relativePath, snapshot }) {
    this.relativePath = logicalPath(relativePath, "review execution checkout source path");
    if (snapshot !== null && !(snapshot instanceof RegularFileSnapshot)) {
      throw new Error("review execution checkout source snapshot is invalid");
    }
    this.snapshot = snapshot;
    Object.freeze(this);
  }

  get included() { return this.snapshot !== null; }

  static capture(sourceRoot, relativePath, { maxBytes = MAX_EXECUTION_CHECKOUT_BYTES } = {}) {
    const source = path.resolve(sourceRoot, ...relativePath.split("/"));
    if (!isWithin(sourceRoot, source)) throw new Error("review execution checkout source escapes its root");
    let resolved = source;
    const visible = fs.lstatSync(source);
    if (visible.isSymbolicLink()) {
      resolved = fs.realpathSync(source);
      if (!isWithin(sourceRoot, resolved)) {
        return new ReviewExecutionCheckoutSourceEntry({ relativePath, snapshot: null });
      }
    }
    const snapshot = captureRegularFile(resolved, {
      label: `review execution checkout source ${relativePath}`,
      maxBytes,
    });
    return new ReviewExecutionCheckoutSourceEntry({ relativePath, snapshot });
  }

  copyTo(checkoutRoot) {
    if (!this.included) return null;
    const destination = path.join(checkoutRoot, ...this.relativePath.split("/"));
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o755 });
    fs.writeFileSync(destination, this.snapshot.bytes, { mode: this.snapshot.mode });
    return new ReviewExecutionCheckoutFile({
      relativePath: this.relativePath,
      digest: this.snapshot.digest,
      byteLength: this.snapshot.byteLength,
    });
  }

  assertUnchanged(sourceRoot) {
    let current;
    try {
      current = ReviewExecutionCheckoutSourceEntry.capture(sourceRoot, this.relativePath, {
        maxBytes: this.included ? this.snapshot.byteLength : MAX_EXECUTION_CHECKOUT_BYTES,
      });
    } catch (cause) {
      throw new Error(`review execution checkout source ${this.relativePath} changed during snapshot: ${cause.message}`);
    }
    if (
      current.included !== this.included
      || (this.included && (
        current.snapshot.digest !== this.snapshot.digest
        || current.snapshot.byteLength !== this.snapshot.byteLength
        || current.snapshot.mode !== this.snapshot.mode
      ))
    ) {
      throw new Error(`review execution checkout source ${this.relativePath} changed during snapshot`);
    }
  }
}

/**
 * Provider-independent execution surface for source review.  It contains a
 * byte-for-byte parent snapshot rather than a symlink or the canonical checkout.
 */
export class ReviewExecutionCheckoutSnapshot {
  constructor({ target, files } = {}) {
    this.target = target instanceof ReviewWorkUnitTarget ? target : new ReviewWorkUnitTarget(target);
    if (!Array.isArray(files)) throw new Error("review execution checkout files must be an array");
    this.files = Object.freeze(files.map((file) => (
      file instanceof ReviewExecutionCheckoutFile ? file : new ReviewExecutionCheckoutFile(file)
    )).sort((left, right) => left.relativePath.localeCompare(right.relativePath)));
    if (new Set(this.files.map((file) => file.relativePath)).size !== this.files.length) {
      throw new Error("review execution checkout has duplicate files");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: 1,
      target: this.target.toJSON(),
      files: this.files.map((file) => file.toJSON()),
    };
  }

  static materialize({ sourceRoot, checkoutRoot, target } = {}) {
    const source = existingRealDirectory(sourceRoot, "review execution checkout sourceRoot");
    const destination = path.resolve(requiredText(checkoutRoot, "review execution checkout checkoutRoot"));
    if (fs.existsSync(destination)) throw new Error("review execution checkout already exists");
    fs.mkdirSync(destination, { recursive: true, mode: 0o755 });
    const sourcePaths = checkoutSourcePaths(source);
    const sourceEntries = [];
    const files = [];
    let totalBytes = 0;
    let includedCount = 0;
    for (const relativePath of sourcePaths) {
      const entry = ReviewExecutionCheckoutSourceEntry.capture(source, relativePath, {
        maxBytes: MAX_EXECUTION_CHECKOUT_BYTES - totalBytes,
      });
      if (entry.included) {
        if (includedCount >= MAX_EXECUTION_CHECKOUT_FILES) {
          throw new Error("review execution checkout exceeds the file limit");
        }
        totalBytes += entry.snapshot.byteLength;
        includedCount += 1;
      }
      sourceEntries.push(entry);
    }
    totalBytes = 0;
    for (const entry of sourceEntries) {
      if (entry.included && files.length >= MAX_EXECUTION_CHECKOUT_FILES) {
        throw new Error("review execution checkout exceeds the file limit");
      }
      const copied = entry.copyTo(destination);
      if (copied === null) continue;
      totalBytes += copied.byteLength;
      files.push(copied);
    }
    if (totalBytes > MAX_EXECUTION_CHECKOUT_BYTES) {
      throw new Error("review execution checkout exceeds the byte limit");
    }
    for (const entry of sourceEntries) entry.assertUnchanged(source);
    const recapturedPaths = checkoutSourcePaths(source);
    if (JSON.stringify(recapturedPaths) !== JSON.stringify(sourcePaths)) {
      throw new Error("review execution checkout source paths changed during snapshot");
    }
    initializeCheckoutGitBoundary(destination);
    const snapshot = new ReviewExecutionCheckoutSnapshot({ target, files });
    if (Buffer.byteLength(`${JSON.stringify(snapshot.toJSON())}\n`, "utf8") > MAX_EXECUTION_CHECKOUT_MANIFEST_BYTES) {
      throw new Error("review execution checkout manifest exceeds the byte limit");
    }
    return snapshot;
  }

  static fromJSON(value) {
    const source = exactObject(value, ["version", "target", "files"], "review execution checkout manifest");
    if (source.version !== 1) throw new Error("review execution checkout manifest version is invalid");
    return new ReviewExecutionCheckoutSnapshot({ target: source.target, files: source.files });
  }

  assertSnapshot(checkoutRoot) {
    const root = existingRealDirectory(checkoutRoot, "review execution checkout");
    for (const file of this.files) {
      const candidate = path.resolve(root, ...file.relativePath.split("/"));
      if (!isWithin(root, candidate)) throw new Error("review execution checkout file escapes its directory");
      let snapshot;
      try {
        snapshot = captureRegularFile(candidate, {
          label: `review execution checkout file ${file.relativePath}`,
          maxBytes: MAX_EXECUTION_CHECKOUT_BYTES,
        });
      } catch (cause) {
        throw new Error(`review execution checkout file ${file.relativePath} is unavailable or invalid: ${cause.message}`);
      }
      if (snapshot.digest !== file.digest || snapshot.byteLength !== file.byteLength) {
        throw new Error(`review execution checkout file ${file.relativePath} changed after parent snapshot`);
      }
    }
    return root;
  }
}

/**
 * Give the provider an independent Git boundary. Without this, Git invoked
 * from checkout/ walks upward and treats the canonical execution checkout as
 * its worktree. The baseline is parent-created after the byte snapshot, so
 * provider mutations and commits remain confined to this disposable copy.
 */
function initializeCheckoutGitBoundary(checkoutRoot) {
  const env = sanitizeGitRepositoryEnvironment();
  try {
    execFileSync("git", ["-C", checkoutRoot, "init", "-q", "--initial-branch=sennel-review-snapshot"], {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    execFileSync("git", ["-C", checkoutRoot, "config", "user.email", "review-snapshot@sennel.invalid"], {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    execFileSync("git", ["-C", checkoutRoot, "config", "user.name", "Sennel review snapshot"], {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    execFileSync("git", ["-C", checkoutRoot, "add", "--all"], {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    execFileSync("git", ["-C", checkoutRoot, "commit", "-q", "--allow-empty", "-m", "review execution snapshot"], {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
  } catch (cause) {
    throw new Error(`review execution checkout Git boundary is unavailable: ${cause.message}`);
  }
}

function checkoutSourcePaths(sourceRoot) {
  let output;
  try {
    output = execFileSync("git", [
      "-c", `core.worktree=${sourceRoot}`,
      "-c", "core.bare=false",
      "-c", "core.fsmonitor=false",
      "-C", sourceRoot,
      "ls-files", "--cached", "--others", "--exclude-standard", "-z",
    ], {
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
      env: sanitizeGitSourceListingEnvironment(),
      // A valid checkout manifest is at least as large as its NUL-delimited
      // source path list, so this bound admits every manifest that can pass
      // the declared manifest limit without inheriting Node's smaller default.
      maxBuffer: MAX_EXECUTION_CHECKOUT_MANIFEST_BYTES,
    });
  } catch (cause) {
    throw new Error(`review execution checkout requires a Git source checkout: ${cause.message}`);
  }
  return output.toString("utf8").split("\0").filter(Boolean)
    .map((entry) => logicalPath(entry, "review execution checkout path"))
    .filter((entry) => !entry.split("/").some((segment) => CHECKOUT_EXCLUDED_NAMES.has(segment)))
    .sort((left, right) => left.localeCompare(right));
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
  get checkoutDirectory() { return path.join(this.root, "checkout"); }
  get checkoutManifestPath() { return path.join(this.root, "checkout-manifest.json"); }
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

  materializeExecutionCheckout() {
    this.prepare();
    const checkoutExisted = fs.existsSync(this.checkoutDirectory);
    const manifestExisted = fs.existsSync(this.checkoutManifestPath);
    try {
      const snapshot = ReviewExecutionCheckoutSnapshot.materialize({
        sourceRoot: this.executionRoot,
        checkoutRoot: this.checkoutDirectory,
        target: this.target,
      });
      new AtomicFile(this.checkoutManifestPath, { phaseNamespace: "review-execution-checkout-manifest" })
        .write(Buffer.from(`${JSON.stringify(snapshot.toJSON(), null, 2)}\n`, "utf8"));
      return Object.freeze({ directory: this.checkoutDirectory, snapshot });
    } catch (cause) {
      // A partially materialized checkout has no sealed worker authority.
      // Remove only entries this invocation created so the same Attempt can
      // retry without treating its own residue as a durable checkout.
      this.cleanupUnsealedExecutionCheckout({
        checkout: !checkoutExisted,
        manifest: !manifestExisted,
      });
      throw cause;
    }
  }

  recoverSealed() {
    const hasManifest = fs.existsSync(this.manifestPath);
    const hasSeal = fs.existsSync(this.sealPath);
    if (!hasManifest && !hasSeal) {
      // A crash can occur after checkout creation but before the parent
      // writes its manifest. This is parent-owned transient residue, never a
      // recoverable worker result, so discard it before retrying the Attempt.
      this.cleanupUnsealedExecutionCheckout();
      return null;
    }
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

  /** Remove only unsealed checkout residue below this exact work-unit root. */
  cleanupUnsealedExecutionCheckout({ checkout = true, manifest = true } = {}) {
    if (!fs.existsSync(this.root)) return false;
    const root = existingRealDirectory(this.root, "review work unit cleanup root");
    let removed = false;
    if (checkout && fs.existsSync(this.checkoutDirectory)) {
      const target = path.resolve(this.checkoutDirectory);
      const stat = fs.lstatSync(target);
      if (!isWithin(root, target) || !stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(target) !== target) {
        throw new Error("review execution checkout cleanup target is invalid");
      }
      fs.rmSync(target, { recursive: true });
      removed = true;
    }
    if (manifest && fs.existsSync(this.checkoutManifestPath)) {
      const target = path.resolve(this.checkoutManifestPath);
      const stat = fs.lstatSync(target);
      if (!isWithin(root, target) || !stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(target) !== target) {
        throw new Error("review execution checkout manifest cleanup target is invalid");
      }
      fs.unlinkSync(target);
      removed = true;
    }
    return removed;
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

  executionCheckout(expectedDirectory = null) {
    if (!(this.manifestDocument instanceof ReviewWorkUnitManifest)) {
      throw new Error("review worker execution checkout requires a manifest");
    }
    const checkout = path.join(this.root, "checkout");
    if (expectedDirectory !== null && path.resolve(expectedDirectory) !== checkout) {
      throw new Error("review worker checkout does not match the parent-declared execution surface");
    }
    const manifestPath = path.join(this.root, "checkout-manifest.json");
    const snapshot = checkoutManifestFile(manifestPath);
    let declared;
    try { declared = ReviewExecutionCheckoutSnapshot.fromJSON(JSON.parse(snapshot.bytes.toString("utf8"))); }
    catch (cause) { throw new Error(`review execution checkout manifest is invalid: ${cause.message}`); }
    if (!declared.target.equals(this.manifestDocument.target)) {
      throw new Error("review execution checkout target does not match its work unit manifest");
    }
    return declared.assertSnapshot(checkout);
  }

  static executionCheckoutFromEnvironment(environment = process.env) {
    const expected = requiredText(environment[REVIEW_WORK_UNIT_CHECKOUT_ENV], REVIEW_WORK_UNIT_CHECKOUT_ENV);
    if (!path.isAbsolute(expected)) throw new Error(`${REVIEW_WORK_UNIT_CHECKOUT_ENV} must be an absolute checkout path`);
    return ReviewWorkUnit.fromEnvironment(environment).executionCheckout(expected);
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
