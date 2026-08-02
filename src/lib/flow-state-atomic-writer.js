import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { ProcessIdentity, ProcessIdentitySource } from "./process-identity.js";
import {
  RepositoryFlowOperationLock,
} from "./repository-maintenance-lock.js";
import { FlowSpecId } from "./flow-spec-id.js";
import { DEFAULT_FLOW_SPEC_DIR, FlowSpecLocation, FlowSpecRoot } from "./flow-workspace.js";

const LOCK_VERSION = 3;
const LOCK_KIND = "flow-state-writer";
const MAX_TEMP_ATTEMPTS = 3;
const MAX_LOCK_BYTES = 64 * 1024;
const SAFE_TRANSITION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const STATE_FILE = "flow.json";

export { ProcessIdentity, ProcessIdentitySource } from "./process-identity.js";

function serializeState(state) {
  return Buffer.from(`${JSON.stringify(state, null, 2)}\n`);
}

function digest(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function atomicError(code, message, options = {}) {
  return new FlowStateAtomicSaveError(code, message, options);
}

function authorityError(message, options = {}) {
  return atomicError("FLOW_STATE_ATOMIC_AUTHORITY_INVALID", message, options);
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function pathMayExist(target) {
  try {
    fs.lstatSync(target);
    return true;
  } catch (cause) {
    return cause.code !== "ENOENT";
  }
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function lstatOptional(target) {
  try {
    return fs.lstatSync(target);
  } catch (cause) {
    if (cause.code === "ENOENT") return null;
    throw cause;
  }
}

function assertBoundSpecId(boundSpecId) {
  try {
    FlowSpecId.from(boundSpecId);
  } catch {
    throw authorityError("atomic flow state replacement requires a bound specId");
  }
}

export function flowStatePath(root, boundSpecId, specRoot = DEFAULT_FLOW_SPEC_DIR) {
  assertBoundSpecId(boundSpecId);
  return new FlowSpecLocation({
    repositoryRoot: path.resolve(root),
    specRoot,
    specId: boundSpecId,
  }).flowStateFile;
}

function assertRealDirectory(directory, label) {
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch (cause) {
    throw authorityError(`${label} is unavailable: ${directory}`, { cause });
  }
  let realPath;
  try {
    realPath = fs.realpathSync(directory);
  } catch (cause) {
    throw authorityError(`${label} real path is unavailable: ${directory}`, { cause });
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || realPath !== directory) {
    throw authorityError(`${label} must be a real directory: ${directory}`);
  }
}

function prepareFlowStateDirectories(root, boundSpecId, specRoot) {
  assertBoundSpecId(boundSpecId);
  if (typeof root !== "string" || root === "") throw authorityError("atomic writer root is required");
  const canonicalRoot = path.resolve(root);
  assertRealDirectory(canonicalRoot, "root");
  const location = new FlowSpecLocation({ repositoryRoot: canonicalRoot, specRoot, specId: boundSpecId });
  let current = canonicalRoot;
  const directories = location.relativeRoot.split("/").map((segment) => {
    current = path.join(current, segment);
    return [current, "spec root directory"];
  });
  directories.push([location.directory, "spec directory"]);
  for (const [directory, label] of directories) {
    try {
      fs.mkdirSync(directory, { mode: 0o755 });
    } catch (cause) {
      if (cause.code !== "EEXIST") throw authorityError(`${label} creation failed: ${directory}`, { cause });
    }
    assertRealDirectory(directory, label);
  }
}

class FlowStateIdentity {
  constructor(state, label) {
    if (typeof state?.runId !== "string" || state.runId.trim() === "") {
      throw authorityError(`${label} requires a non-empty runId`);
    }
    this.runId = state.runId;
    try {
      this.specId = FlowSpecId.from(state.specId).toString();
    } catch {
      throw authorityError(`${label} requires a valid specId`);
    }
    this.hasIssue = Object.hasOwn(state, "issue") && state.issue != null;
    this.issue = this.hasIssue ? Number(state.issue) : null;
    if (this.hasIssue && (!Number.isSafeInteger(this.issue) || this.issue < 1)) {
      throw authorityError(`${label} Issue must be a positive integer`);
    }
    Object.freeze(this);
  }

  sameImmutableTarget(other) {
    return other instanceof FlowStateIdentity
      && this.runId === other.runId
      && this.specId === other.specId;
  }

  sameIssue(other) {
    return other instanceof FlowStateIdentity
      && this.hasIssue === other.hasIssue
      && this.issue === other.issue;
  }
}

export class FlowStateRevision {
  #content;

  constructor(content) {
    if (!Buffer.isBuffer(content)) throw new Error("flow state revision content must be a Buffer");
    this.#content = Buffer.from(content);
    this.digest = digest(this.#content);
    this.identity = new FlowStateIdentity(
      JSON.parse(this.#content.toString("utf8")),
      "flow state revision",
    );
    Object.freeze(this);
  }

  matches(content) {
    return Buffer.isBuffer(content)
      && digest(content) === this.digest
      && content.equals(this.#content);
  }

  matchesIdentity(identity) {
    return this.identity.sameImmutableTarget(identity)
      && this.identity.sameIssue(identity);
  }

  matchesState(state) {
    return isDeepStrictEqual(JSON.parse(this.#content.toString("utf8")), state);
  }
}

export class FlowStatePathAuthority {
  constructor({ root, boundSpecId, specRoot = DEFAULT_FLOW_SPEC_DIR, requireExisting = true }) {
    assertBoundSpecId(boundSpecId);
    this.root = this.#canonicalRoot(root);
    this.specId = boundSpecId;
    this.specRoot = FlowSpecRoot.from(specRoot);
    this.location = new FlowSpecLocation({
      repositoryRoot: this.root,
      specRoot: this.specRoot,
      specId: boundSpecId,
    });
    this.specsDirectory = this.location.root;
    this.specDirectory = this.location.directory;
    this.statePath = this.location.flowStateFile;
    this.lockPath = path.join(this.specDirectory, ".flow.json.writer.lock");
    assertRealDirectory(this.specsDirectory, "specs directory");
    assertRealDirectory(this.specDirectory, "spec directory");
    const stateStat = this.#optionalLstat(this.statePath, "flow state");
    if (requireExisting && stateStat == null) {
      throw authorityError(`flow state is unavailable: ${this.statePath}`);
    }
    if (!requireExisting && stateStat != null) {
      throw atomicError("FLOW_STATE_ALREADY_EXISTS", `flow state already exists: ${this.statePath}`, {
        lockPath: this.lockPath,
      });
    }
    if (stateStat != null && (
      !stateStat.isFile()
      || stateStat.isSymbolicLink()
      || this.#realpath(this.statePath, "flow state") !== this.statePath
    )) {
      throw authorityError(`flow state must be a regular real file: ${this.statePath}`);
    }
    this.mode = stateStat == null ? 0o644 : stateStat.mode & 0o777;
    if (new.target === FlowStatePathAuthority) Object.freeze(this);
  }

  assertExactSpecId(specId, label) {
    if (specId !== this.specId) {
      throw authorityError(`${label} specId must exactly match bound authority ${this.specId}`);
    }
  }

  #canonicalRoot(root) {
    if (typeof root !== "string" || root === "") throw authorityError("atomic writer root is required");
    const resolved = path.resolve(root);
    assertRealDirectory(resolved, "root");
    return resolved;
  }

  #lstat(target, label) {
    try {
      return fs.lstatSync(target);
    } catch (cause) {
      throw authorityError(`${label} is unavailable: ${target}`, { cause });
    }
  }

  #optionalLstat(target, label) {
    try {
      return fs.lstatSync(target);
    } catch (cause) {
      if (cause.code === "ENOENT") return null;
      throw authorityError(`${label} is unavailable: ${target}`, { cause });
    }
  }

  #realpath(target, label) {
    try {
      return fs.realpathSync(target);
    } catch (cause) {
      throw authorityError(`${label} real path is unavailable: ${target}`, { cause });
    }
  }
}

export class FlowStateWriteAuthority extends FlowStatePathAuthority {
  constructor({
    root,
    boundSpecId,
    pathAuthority,
    expectedOriginal,
    nextState,
    expectedRevision,
    allowIssueTransition = false,
  }) {
    super(pathAuthority
      ? { root: pathAuthority.root, boundSpecId: pathAuthority.specId, specRoot: pathAuthority.specRoot }
      : { root, boundSpecId });
    if (!expectedOriginal || typeof expectedOriginal !== "object") {
      throw authorityError("atomic flow state replacement requires expectedOriginal");
    }
    if (!nextState || typeof nextState !== "object") {
      throw authorityError("atomic flow state replacement requires next state");
    }
    this.assertExactSpecId(expectedOriginal.specId, "expected original");
    this.assertExactSpecId(nextState.specId, "next state");
    this.expectedIdentity = new FlowStateIdentity(expectedOriginal, "expected original");
    this.nextIdentity = new FlowStateIdentity(nextState, "next state");
    if (!this.expectedIdentity.sameImmutableTarget(this.nextIdentity)) {
      throw authorityError("next flow state identity differs from expected original");
    }
    if (!allowIssueTransition && !this.expectedIdentity.sameIssue(this.nextIdentity)) {
      throw authorityError("next flow state issue differs from expected original");
    }
    this.expectedRevision = expectedRevision ?? new FlowStateRevision(serializeState(expectedOriginal));
    if (!(this.expectedRevision instanceof FlowStateRevision)) {
      throw authorityError("atomic flow state replacement requires a valid expected revision");
    }
    if (!this.expectedRevision.matchesIdentity(this.expectedIdentity)) {
      throw authorityError("expected flow state identity differs from its loaded revision");
    }
    this.nextContent = serializeState(nextState);
    Object.freeze(this);
  }
}

export class FlowStateCleanupError {
  constructor({ phase, target, cause }) {
    this.phase = phase;
    this.target = target;
    this.code = cause?.code ?? null;
    this.message = cause?.message ?? String(cause);
    Object.freeze(this);
  }
}

export class FlowStateAtomicSaveError extends Error {
  constructor(code, message, {
    cause,
    authority,
    committed = false,
    cleanupErrors = [],
    residuePaths = [],
    lockPath = authority?.lockPath ?? null,
  } = {}) {
    super(message, { cause });
    this.name = "FlowStateAtomicSaveError";
    this.code = code;
    this.committed = committed;
    this.path = authority?.statePath ?? null;
    this.lockPath = lockPath;
    this.cleanupErrors = [...cleanupErrors];
    this.residuePaths = [...residuePaths];
    Object.freeze(this.cleanupErrors);
    Object.freeze(this.residuePaths);
  }
}

class FaultBoundary {
  constructor(faultInjector) {
    this.faultInjector = faultInjector;
  }

  emit(phase, data = {}) {
    this.faultInjector({ phase, ...data });
  }
}

class CleanupReport {
  constructor(faults) {
    this.faults = faults;
    this.errors = [];
  }

  close(phase, descriptor, target) {
    this.#captureInjected(phase, target);
    try {
      fs.closeSync(descriptor);
    } catch (cause) {
      this.#record(phase, target, cause);
    }
  }

  unlink(phase, target) {
    if (!this.#captureInjected(phase, target)) return false;
    try {
      fs.unlinkSync(target);
      return true;
    } catch (cause) {
      this.#record(phase, target, cause);
      return false;
    }
  }

  fsyncDirectory(phase, directory) {
    if (!this.#captureInjected(phase, directory)) return;
    try {
      fsyncDirectory(directory);
    } catch (cause) {
      this.#record(phase, directory, cause);
    }
  }

  append(other) {
    this.errors.push(...other.errors);
  }

  #captureInjected(phase, target) {
    try {
      this.faults.emit(phase, { target });
      return true;
    } catch (cause) {
      this.#record(phase, target, cause);
      return false;
    }
  }

  #record(phase, target, cause) {
    this.errors.push(new FlowStateCleanupError({ phase, target, cause }));
  }
}

class FlowStateWriterTransitionAuthority {
  constructor({ transitionId, writerOwnerToken, writerOwnerTempName }) {
    if (!SAFE_TRANSITION_ID.test(transitionId) || !SAFE_TRANSITION_ID.test(writerOwnerToken)) {
      throw authorityError("flow writer transition publication IDs must be UUIDs");
    }
    const expectedTempName = `.flow.json.writer.${writerOwnerToken}.owner.tmp`;
    if (writerOwnerTempName !== expectedTempName || path.basename(writerOwnerTempName) !== writerOwnerTempName) {
      throw authorityError("flow writer transition owner temp name is invalid");
    }
    this.transitionId = transitionId;
    this.writerOwnerToken = writerOwnerToken;
    this.writerOwnerTempName = writerOwnerTempName;
    Object.freeze(this);
  }

  static optional(input) {
    const values = [input.transitionId, input.writerOwnerToken, input.writerOwnerTempName];
    if (values.every((value) => value == null)) return null;
    return new FlowStateWriterTransitionAuthority(input);
  }

  tempPath(specDirectory) {
    return path.join(specDirectory, this.writerOwnerTempName);
  }
}

class FlowStateWriterLock {
  constructor(authority, faults, processIdentitySource, transitionAuthority = null) {
    this.authority = authority;
    this.faults = faults;
    this.processIdentitySource = processIdentitySource;
    this.transitionAuthority = transitionAuthority;
    this.processIdentity = null;
    this.ownerTempPath = null;
    this.acquired = false;
  }

  acquire() {
    let descriptor = null;
    const cleanup = new CleanupReport(this.faults);
    try {
      if (pathMayExist(this.authority.lockPath)) {
        throw this.#existingLockError(new Error("flow writer lock already exists"));
      }
      const opened = this.#openOwnerTemp();
      this.ownerTempPath = opened.path;
      descriptor = opened.descriptor;
      try {
        this.processIdentity = this.processIdentitySource.createOwner(opened.token);
      } catch (cause) {
        throw atomicError("FLOW_STATE_ATOMIC_PROCESS_IDENTITY_UNKNOWN", cause.message, {
          cause,
          authority: this.authority,
        });
      }
      const ownerContent = Buffer.from(`${JSON.stringify(this.#owner(), null, 2)}\n`);
      this.faults.emit("before-lock-owner-write", { tempPath: this.ownerTempPath });
      fs.writeFileSync(descriptor, ownerContent);
      this.faults.emit("after-lock-owner-write", { tempPath: this.ownerTempPath });
      fs.fchmodSync(descriptor, 0o600);
      this.faults.emit("before-lock-owner-fsync", { tempPath: this.ownerTempPath });
      fs.fsyncSync(descriptor);
      this.faults.emit("after-lock-owner-fsync", { tempPath: this.ownerTempPath });
      fs.closeSync(descriptor);
      descriptor = null;

      this.faults.emit("before-lock-publish", { lockPath: this.authority.lockPath });
      try {
        fs.linkSync(this.ownerTempPath, this.authority.lockPath);
      } catch (cause) {
        if (cause.code === "EEXIST") throw this.#existingLockError(cause);
        throw cause;
      }
      this.acquired = true;
      this.faults.emit("after-lock-publish", { lockPath: this.authority.lockPath });
      fs.unlinkSync(this.ownerTempPath);
      this.ownerTempPath = null;
      this.faults.emit("before-lock-dir-fsync", { lockPath: this.authority.lockPath });
      fsyncDirectory(this.authority.specDirectory);
      this.faults.emit("after-lock-dir-fsync", { lockPath: this.authority.lockPath });
      this.faults.emit("lock-acquired", { lockPath: this.authority.lockPath });
    } catch (cause) {
      if (descriptor != null) cleanup.close("before-lock-cleanup-close", descriptor, this.ownerTempPath);
      if (this.ownerTempPath) cleanup.unlink("before-lock-cleanup-owner-unlink", this.ownerTempPath);
      if (this.ownerTempPath) cleanup.fsyncDirectory("before-lock-cleanup-dir-fsync", this.authority.specDirectory);
      if (this.acquired) cleanup.unlink("before-lock-cleanup-unlink", this.authority.lockPath);
      if (this.acquired) cleanup.fsyncDirectory("before-lock-cleanup-dir-fsync", this.authority.specDirectory);
      this.acquired = false;
      if (cause instanceof FlowStateAtomicSaveError) {
        throw new FlowStateAtomicSaveError(cause.code, cause.message, {
          cause: cause.cause,
          authority: this.authority,
          committed: false,
          cleanupErrors: [...cause.cleanupErrors, ...cleanup.errors],
          residuePaths: this.#residuePaths(),
        });
      }
      throw atomicError(
        "FLOW_STATE_ATOMIC_SAVE_FAILED",
        `flow writer lock acquisition failed: ${cause.message}`,
        {
          cause,
          authority: this.authority,
          cleanupErrors: cleanup.errors,
          residuePaths: this.#residuePaths(),
        },
      );
    }
  }

  release() {
    const cleanup = new CleanupReport(this.faults);
    if (!this.acquired) return cleanup;
    let owner;
    try {
      owner = this.#readOwner();
      if (owner.processIdentity.ownerToken !== this.processIdentity.ownerToken) {
        throw new Error("flow writer lock ownership changed");
      }
    } catch (cause) {
      cleanup.errors.push(new FlowStateCleanupError({
        phase: "lock-owner-verify",
        target: this.authority.lockPath,
        cause,
      }));
      return cleanup;
    }
    if (cleanup.unlink("before-lock-release-unlink", this.authority.lockPath)) {
      cleanup.fsyncDirectory("before-lock-release-dir-fsync", this.authority.specDirectory);
      this.acquired = false;
    }
    return cleanup;
  }

  recoverCommittedWrite() {
    if (!(this.transitionAuthority instanceof FlowStateWriterTransitionAuthority)) {
      throw authorityError("flow writer recovery requires an exact transition ID", {
        authority: this.authority,
      });
    }
    const tempPath = this.transitionAuthority.tempPath(this.authority.specDirectory);
    const visible = lstatOptional(this.authority.lockPath);
    const temp = lstatOptional(tempPath);
    if (!visible && !temp) {
      fsyncDirectory(this.authority.specDirectory);
      return;
    }
    let snapshot;
    if (visible && temp) {
      if (!sameFile(visible, temp) || visible.nlink !== 2 || temp.nlink !== 2) {
        throw this.#recoveryAuthorityError("flow writer publication names do not have exact two-link authority");
      }
      snapshot = this.#readOwnerSnapshot(this.authority.lockPath, 2);
    } else if (visible) {
      snapshot = this.#readOwnerSnapshot(this.authority.lockPath, 1);
    } else {
      snapshot = this.#readOwnerSnapshot(tempPath, 1);
    }
    const assessment = this.processIdentitySource.assess(snapshot.owner.processIdentity);
    if (assessment.status !== "stale") {
      throw this.#assessmentError(
        snapshot.owner,
        assessment,
        new Error("flow writer recovery requires a proven-stale owner"),
      );
    }
    if (
      snapshot.owner.transitionId !== this.transitionAuthority.transitionId
      || snapshot.owner.processIdentity.ownerToken !== this.transitionAuthority.writerOwnerToken
    ) {
      throw atomicError(
        "FLOW_STATE_ATOMIC_TRANSITION_MISMATCH",
        "flow writer lock belongs to a different Issue transition",
        { authority: this.authority, residuePaths: [this.authority.lockPath] },
      );
    }
    try {
      if (temp) {
        this.#assertRecoveryName(tempPath, snapshot.stat, visible ? 2 : 1);
        fs.unlinkSync(tempPath);
      }
      if (visible) {
        this.#assertRecoveryName(this.authority.lockPath, snapshot.stat, 1);
        fs.unlinkSync(this.authority.lockPath);
      }
      fsyncDirectory(this.authority.specDirectory);
    } catch (cause) {
      throw atomicError(
        "FLOW_STATE_ATOMIC_SAVE_FAILED",
        `committed flow writer recovery failed: ${cause.message}`,
        {
          cause,
          authority: this.authority,
          committed: true,
          residuePaths: [this.authority.lockPath, tempPath].filter((target) => pathMayExist(target)),
        },
      );
    }
  }

  #openOwnerTemp() {
    if (this.transitionAuthority) {
      const tempPath = this.transitionAuthority.tempPath(this.authority.specDirectory);
      this.faults.emit("before-lock-owner-temp-open", { attempt: 0, tempPath });
      return {
        token: this.transitionAuthority.writerOwnerToken,
        path: tempPath,
        descriptor: fs.openSync(tempPath, "wx", 0o600),
      };
    }
    for (let attempt = 0; attempt < MAX_TEMP_ATTEMPTS; attempt += 1) {
      const token = crypto.randomUUID();
      const tempPath = path.join(this.authority.specDirectory, `.flow.json.writer.${token}.owner.tmp`);
      this.faults.emit("before-lock-owner-temp-open", { attempt, tempPath });
      try {
        const descriptor = fs.openSync(tempPath, "wx", 0o600);
        return { token, path: tempPath, descriptor };
      } catch (cause) {
        if (cause.code !== "EEXIST") throw cause;
      }
    }
    throw atomicError("FLOW_STATE_ATOMIC_TEMP_COLLISION", "flow writer owner temp collision limit exceeded", {
      authority: this.authority,
    });
  }

  #owner() {
    return {
      version: LOCK_VERSION,
      kind: LOCK_KIND,
      processIdentity: this.processIdentity,
      root: this.authority.root,
      specId: this.authority.specId,
      specRoot: this.authority.specRoot.toString(),
      statePath: this.authority.statePath,
      ...(this.transitionAuthority && { transitionId: this.transitionAuthority.transitionId }),
    };
  }

  #existingLockError(cause) {
    let owner;
    try {
      owner = this.#readOwner();
    } catch (ownerCause) {
      return atomicError("FLOW_STATE_ATOMIC_LOCK_CORRUPT", "flow writer lock is corrupt", {
        cause: ownerCause,
        authority: this.authority,
      });
    }
    const assessment = this.processIdentitySource.assess(owner.processIdentity);
    return this.#assessmentError(owner, assessment, cause);
  }

  #assessmentError(owner, assessment, cause) {
    if (assessment.status === "live") {
      return atomicError("FLOW_STATE_ATOMIC_BUSY", assessment.reason, {
        cause,
        authority: this.authority,
      });
    }
    if (assessment.status === "stale") {
      return atomicError("FLOW_STATE_ATOMIC_LOCK_STALE", assessment.reason, {
        cause,
        authority: this.authority,
      });
    }
    return atomicError("FLOW_STATE_ATOMIC_LOCK_UNKNOWN", assessment.reason, {
      cause,
      authority: this.authority,
    });
  }

  #readOwner() {
    return this.#readOwnerSnapshot().owner;
  }

  #readOwnerSnapshot(filePath = this.authority.lockPath, expectedLinkCount = 1) {
    const visible = fs.lstatSync(filePath);
    if (
      !visible.isFile()
      || visible.isSymbolicLink()
      || visible.nlink !== expectedLinkCount
      || visible.size > MAX_LOCK_BYTES
      || fs.realpathSync(filePath) !== filePath
    ) {
      throw new Error("flow writer lock must be a bounded regular file");
    }
    let descriptor = null;
    let owner;
    try {
      descriptor = fs.openSync(
        filePath,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
      );
      const opened = fs.fstatSync(descriptor);
      if (!sameFile(visible, opened) || opened.nlink !== expectedLinkCount || opened.size > MAX_LOCK_BYTES) {
        throw new Error("flow writer lock changed while opening");
      }
      owner = JSON.parse(fs.readFileSync(descriptor, "utf8"));
      const afterVisible = fs.lstatSync(filePath);
      if (!sameFile(opened, afterVisible) || afterVisible.nlink !== expectedLinkCount) {
        throw new Error("flow writer lock changed while reading");
      }
    } finally {
      if (descriptor != null) fs.closeSync(descriptor);
    }
    if (
      owner.version !== LOCK_VERSION
      || owner.kind !== LOCK_KIND
      || owner.root !== this.authority.root
      || owner.specId !== this.authority.specId
      || owner.specRoot !== this.authority.specRoot.toString()
      || owner.statePath !== this.authority.statePath
    ) {
      throw new Error("flow writer lock authority is invalid");
    }
    try {
      owner.processIdentity = new ProcessIdentity(owner.processIdentity ?? {});
    } catch (cause) {
      throw new Error("flow writer lock process identity is invalid", { cause });
    }
    return { owner, stat: visible };
  }

  #assertRecoveryName(filePath, expectedStat, expectedLinkCount) {
    const current = fs.lstatSync(filePath);
    if (!sameFile(current, expectedStat) || current.nlink !== expectedLinkCount) {
      throw this.#recoveryAuthorityError("flow writer publication changed before transition recovery");
    }
  }

  #recoveryAuthorityError(message) {
    return atomicError("FLOW_STATE_ATOMIC_LOCK_UNKNOWN", message, {
      authority: this.authority,
      residuePaths: [
        this.authority.lockPath,
        this.transitionAuthority?.tempPath(this.authority.specDirectory),
      ].filter((target) => target && pathMayExist(target)),
    });
  }

  #residuePaths() {
    return [this.ownerTempPath, this.authority.lockPath]
      .filter((candidate) => candidate && pathMayExist(candidate));
  }
}

export class FlowStateCreator {
  constructor({
    root,
    mainRoot = root,
    specRoot = DEFAULT_FLOW_SPEC_DIR,
    boundSpecId,
    state,
    faultInjector = () => {},
    maintenanceOwnerToken = null,
    operationOwnerToken = null,
    allowProcessOwnerBorrow = false,
    processIdentitySource = new ProcessIdentitySource(),
  }) {
    assertBoundSpecId(boundSpecId);
    if (state?.specId !== boundSpecId) {
      throw authorityError(`new state specId must exactly match bound authority ${boundSpecId}`);
    }
    this.root = root;
    this.specRoot = FlowSpecRoot.from(specRoot);
    this.boundSpecId = boundSpecId;
    this.authority = null;
    this.identity = new FlowStateIdentity(state, "new state");
    this.content = serializeState(state);
    this.faults = new FaultBoundary(faultInjector);
    this.repositoryOperation = new RepositoryFlowOperationLock({
      mainRoot,
      maintenanceOwnerToken,
      operationOwnerToken,
      allowProcessOwnerBorrow,
      processIdentitySource,
    });
  }

  create() {
    this.repositoryOperation.acquire();
    try {
      prepareFlowStateDirectories(this.root, this.boundSpecId, this.specRoot);
      this.authority = new FlowStatePathAuthority({
        root: this.root,
        boundSpecId: this.boundSpecId,
        specRoot: this.specRoot,
        requireExisting: false,
      });
      this.authority.assertExactSpecId(this.identity.specId, "new state");
      return this.#create();
    } finally {
      this.repositoryOperation.release();
    }
  }

  #create() {
    let descriptor = null;
    let created = false;
    let primary = null;
    const cleanup = new CleanupReport(this.faults);
    try {
      descriptor = fs.openSync(this.authority.statePath, "wx", this.authority.mode);
      created = true;
      fs.writeFileSync(descriptor, this.content);
      fs.fchmodSync(descriptor, this.authority.mode);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = null;
      fsyncDirectory(this.authority.specDirectory);
    } catch (cause) {
      primary = cause;
    }
    if (primary) {
      if (descriptor != null) cleanup.close("before-create-cleanup-close", descriptor, this.authority.statePath);
      if (created) cleanup.unlink("before-create-cleanup-unlink", this.authority.statePath);
      if (created) cleanup.fsyncDirectory("before-create-cleanup-dir-fsync", this.authority.specDirectory);
    }
    if (primary || cleanup.errors.length > 0) {
      const code = primary?.code === "EEXIST"
        ? "FLOW_STATE_ALREADY_EXISTS"
        : "FLOW_STATE_CREATE_FAILED";
      throw atomicError(code, primary?.message ?? "flow state create cleanup failed", {
        cause: primary,
        authority: this.authority,
        cleanupErrors: cleanup.errors,
        residuePaths: pathMayExist(this.authority.statePath) ? [this.authority.statePath] : [],
      });
    }
    return { created: true, path: this.authority.statePath };
  }
}

export class AtomicFlowStateWriter {
  constructor({
    root,
    mainRoot = root,
    specRoot = DEFAULT_FLOW_SPEC_DIR,
    boundSpecId,
    expectedOriginal,
    nextState,
    expectedRevision,
    faultInjector = () => {},
    processIdentitySource = new ProcessIdentitySource(),
    maintenanceOwnerToken = null,
    operationOwnerToken = null,
    allowProcessOwnerBorrow = false,
    allowIssueTransition = false,
    transitionId = null,
    writerOwnerToken = null,
    writerOwnerTempName = null,
  }) {
    this.pathAuthority = new FlowStatePathAuthority({ root, boundSpecId, specRoot });
    this.replacementAuthority = expectedOriginal == null && nextState == null
      ? null
      : new FlowStateWriteAuthority({
        pathAuthority: this.pathAuthority,
        expectedOriginal,
        nextState,
        expectedRevision,
        allowIssueTransition,
      });
    this.faults = new FaultBoundary(faultInjector);
    this.transitionAuthority = FlowStateWriterTransitionAuthority.optional({
      transitionId,
      writerOwnerToken,
      writerOwnerTempName,
    });
    this.lock = new FlowStateWriterLock(
      this.pathAuthority,
      this.faults,
      processIdentitySource,
      this.transitionAuthority,
    );
    this.mainRoot = mainRoot;
    this.maintenanceOwnerToken = maintenanceOwnerToken;
    this.processIdentitySource = processIdentitySource;
    this.repositoryOperation = new RepositoryFlowOperationLock({
      mainRoot,
      maintenanceOwnerToken,
      operationOwnerToken,
      allowProcessOwnerBorrow,
    });
  }

  recoverCommittedWrite() {
    this.repositoryOperation.acquire();
    let primary = null;
    try {
      this.lock.recoverCommittedWrite();
    } catch (error) {
      primary = error;
    }
    let releaseError = null;
    try {
      this.repositoryOperation.release();
    } catch (error) {
      releaseError = error;
    }
    if (primary && releaseError) {
      throw new AggregateError(
        [primary, releaseError],
        "committed flow state recovery and repository barrier release both failed",
        { cause: primary },
      );
    }
    if (primary) throw primary;
    if (releaseError) throw releaseError;
  }

  assertWritable() {
    this.repositoryOperation.acquire();
    let primary = null;
    try {
      this.lock.acquire();
    } catch (error) {
      primary = error;
    }
    const cleanup = this.lock.release();
    if (primary == null && cleanup.errors.length > 0) {
      primary = new AggregateError(cleanup.errors, "flow state writer probe cleanup failed", {
        cause: cleanup.errors[0],
      });
    } else if (primary != null && cleanup.errors.length > 0) {
      primary = new AggregateError(
        [primary, ...cleanup.errors],
        "flow state writer probe and cleanup both failed",
        { cause: primary },
      );
    }
    let releaseError = null;
    try {
      this.repositoryOperation.release();
    } catch (error) {
      releaseError = error;
    }
    if (primary && releaseError) {
      throw new AggregateError(
        [primary, releaseError],
        "flow state writer probe and repository barrier release both failed",
        { cause: primary },
      );
    }
    if (primary) throw primary;
    if (releaseError) throw releaseError;
  }

  save() {
    if (this.replacementAuthority == null) {
      throw authorityError("atomic replacement requires expected and next state", {
        authority: this.pathAuthority,
      });
    }
    return this.#replace(() => this.replacementAuthority);
  }

  mutate(mutator, {
    parseState = (content) => JSON.parse(content.toString("utf8")),
    validateState = () => {},
    onFailure = null,
    passThroughError = null,
    allowIssueTransition = false,
  } = {}) {
    if (typeof mutator !== "function") throw new Error("flow state mutator must be a function");
    return this.#replace((current) => {
      const currentRevision = new FlowStateRevision(current);
      const expectedOriginal = parseState(current, this.pathAuthority.statePath);
      const nextState = structuredClone(expectedOriginal);
      mutator(nextState, { revisionDigest: currentRevision.digest });
      validateState(nextState, this.pathAuthority.statePath);
      return new FlowStateWriteAuthority({
        pathAuthority: this.pathAuthority,
        expectedOriginal,
        nextState,
        expectedRevision: currentRevision,
        allowIssueTransition,
      });
    }, onFailure, passThroughError);
  }

  #replace(resolveAuthority, onFailure = null, passThroughError = null) {
    this.repositoryOperation.acquire();
    let result;
    let primaryError = null;
    try {
      result = this.#replaceOwned(resolveAuthority, onFailure, passThroughError);
    } catch (error) {
      primaryError = error;
    }
    let releaseError = null;
    try {
      this.repositoryOperation.release();
    } catch (error) {
      releaseError = error;
    }
    if (primaryError && releaseError) {
      throw new AggregateError(
        [primaryError, releaseError],
        "flow state mutation and repository barrier release both failed",
        { cause: primaryError },
      );
    }
    if (primaryError) throw primaryError;
    if (releaseError) throw releaseError;
    return result;
  }

  #replaceOwned(resolveAuthority, onFailure = null, passThroughError = null) {
    try {
      this.lock.acquire();
    } catch (error) {
      throw error;
    }
    let descriptor = null;
    let tempPath = null;
    let committed = false;
    let primary = null;
    let writeAuthority = this.pathAuthority;
    const cleanup = new CleanupReport(this.faults);
    try {
      const current = fs.readFileSync(this.pathAuthority.statePath);
      writeAuthority = resolveAuthority(current);
      if (!writeAuthority.expectedRevision.matches(current)) {
        throw atomicError("FLOW_STATE_ATOMIC_STALE", "flow state changed after target resolution", {
          authority: writeAuthority,
        });
      }

      const opened = this.#openStateTemp(writeAuthority);
      tempPath = opened.path;
      descriptor = opened.descriptor;
      this.faults.emit("before-state-temp-write", { tempPath });
      fs.writeFileSync(descriptor, writeAuthority.nextContent);
      this.faults.emit("after-state-temp-write", { tempPath });
      fs.fchmodSync(descriptor, writeAuthority.mode);
      this.faults.emit("before-state-file-fsync", { tempPath });
      fs.fsyncSync(descriptor);
      this.faults.emit("after-state-file-fsync", { tempPath });
      fs.closeSync(descriptor);
      descriptor = null;

      this.faults.emit("before-state-rename", { tempPath, statePath: writeAuthority.statePath });
      fs.renameSync(tempPath, writeAuthority.statePath);
      tempPath = null;
      committed = true;
      this.faults.emit("after-state-rename", { statePath: writeAuthority.statePath });
      this.faults.emit("before-state-dir-fsync", { statePath: writeAuthority.statePath });
      fsyncDirectory(writeAuthority.specDirectory);
      this.faults.emit("after-state-dir-fsync", { statePath: writeAuthority.statePath });
    } catch (cause) {
      primary = cause;
    }

    if (primary && !committed && typeof onFailure === "function") {
      try {
        onFailure(primary);
      } catch (rollbackError) {
        primary = new AggregateError([primary, rollbackError], "flow state mutation rollback failed");
      }
    }

    if (descriptor != null) cleanup.close("before-state-cleanup-close", descriptor, tempPath);
    if (tempPath) cleanup.unlink("before-state-cleanup-unlink", tempPath);
    if (tempPath) cleanup.fsyncDirectory("before-state-cleanup-dir-fsync", writeAuthority.specDirectory);
    cleanup.append(this.lock.release());
    const residuePaths = [tempPath, writeAuthority.lockPath]
      .filter((candidate) => candidate && pathMayExist(candidate));

    if (
      primary
      && cleanup.errors.length === 0
      && residuePaths.length === 0
      && typeof passThroughError === "function"
      && passThroughError(primary)
    ) {
      throw primary;
    }

    if (primary || cleanup.errors.length > 0) {
      const code = primary instanceof FlowStateAtomicSaveError
        ? primary.code
        : "FLOW_STATE_ATOMIC_SAVE_FAILED";
      const message = primary?.message ?? "atomic flow state replacement cleanup failed";
      throw atomicError(code, message, {
        cause: primary?.cause ?? primary,
        authority: writeAuthority,
        committed,
        cleanupErrors: [
          ...(primary instanceof FlowStateAtomicSaveError ? primary.cleanupErrors : []),
          ...cleanup.errors,
        ],
        residuePaths,
      });
    }
    return { committed: true, path: writeAuthority.statePath };
  }

  #openStateTemp(authority) {
    for (let attempt = 0; attempt < MAX_TEMP_ATTEMPTS; attempt += 1) {
      const tempPath = path.join(authority.specDirectory, `.flow.json.${crypto.randomUUID()}.tmp`);
      this.faults.emit("before-state-temp-open", { attempt, tempPath });
      try {
        return { path: tempPath, descriptor: fs.openSync(tempPath, "wx", authority.mode) };
      } catch (cause) {
        if (cause.code !== "EEXIST") throw cause;
      }
    }
    throw atomicError("FLOW_STATE_ATOMIC_TEMP_COLLISION", "flow state temp collision limit exceeded", {
      authority,
    });
  }
}
