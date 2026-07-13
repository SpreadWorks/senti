import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const LOCK_VERSION = 1;
const LOCK_KIND = "flow-state-writer";
const MAX_TEMP_ATTEMPTS = 3;
const MAX_LOCK_BYTES = 64 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
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

class FlowStateIdentity {
  constructor(state, label) {
    if (typeof state?.runId !== "string" || state.runId.trim() === "") {
      throw authorityError(`${label} requires a non-empty runId`);
    }
    this.runId = state.runId;
    this.spec = state.spec;
    this.hasIssue = Object.hasOwn(state, "issue") && state.issue != null;
    this.issue = this.hasIssue ? Number(state.issue) : null;
    if (this.hasIssue && (!Number.isSafeInteger(this.issue) || this.issue < 1)) {
      throw authorityError(`${label} Issue must be a positive integer`);
    }
    Object.freeze(this);
  }

  equals(other) {
    return other instanceof FlowStateIdentity
      && this.runId === other.runId
      && this.spec === other.spec
      && this.hasIssue === other.hasIssue
      && this.issue === other.issue;
  }
}

export class FlowStateWriteAuthority {
  constructor({ root, boundSpecId, expectedOriginal, nextState }) {
    if (
      typeof boundSpecId !== "string"
      || boundSpecId === ""
      || boundSpecId === "."
      || boundSpecId === ".."
      || boundSpecId.includes("/")
      || boundSpecId.includes("\\")
    ) {
      throw authorityError("atomic flow state replacement requires a bound specId");
    }
    if (!expectedOriginal || typeof expectedOriginal !== "object") {
      throw authorityError("atomic flow state replacement requires expectedOriginal");
    }
    if (!nextState || typeof nextState !== "object") {
      throw authorityError("atomic flow state replacement requires next state");
    }

    this.root = this.#canonicalRoot(root);
    this.specId = boundSpecId;
    this.spec = `specs/${boundSpecId}/spec.json`;
    this.#assertExactSpec(expectedOriginal.spec, "expected original");
    this.#assertExactSpec(nextState.spec, "next state");
    this.expectedIdentity = new FlowStateIdentity(expectedOriginal, "expected original");
    this.nextIdentity = new FlowStateIdentity(nextState, "next state");
    if (!this.expectedIdentity.equals(this.nextIdentity)) {
      throw authorityError("next flow state identity differs from expected original");
    }

    this.specsDirectory = path.join(this.root, "specs");
    this.specDirectory = path.join(this.specsDirectory, boundSpecId);
    this.statePath = path.join(this.specDirectory, "flow.json");
    this.lockPath = path.join(this.specDirectory, ".flow.json.writer.lock");
    this.#assertRealDirectory(this.specsDirectory, "specs directory");
    this.#assertRealDirectory(this.specDirectory, "spec directory");
    const stateStat = this.#lstat(this.statePath, "flow state");
    if (!stateStat.isFile() || stateStat.isSymbolicLink() || this.#realpath(this.statePath, "flow state") !== this.statePath) {
      throw authorityError(`flow state must be an existing regular real file: ${this.statePath}`);
    }
    this.mode = stateStat.mode & 0o777;
    this.expectedContent = serializeState(expectedOriginal);
    this.expectedDigest = digest(this.expectedContent);
    this.nextContent = serializeState(nextState);
    Object.freeze(this);
  }

  #canonicalRoot(root) {
    if (typeof root !== "string" || root === "") throw authorityError("atomic writer root is required");
    const resolved = path.resolve(root);
    const stat = this.#lstat(resolved, "root");
    if (!stat.isDirectory() || stat.isSymbolicLink() || this.#realpath(resolved, "root") !== resolved) {
      throw authorityError(`atomic writer root must be a canonical real directory: ${resolved}`);
    }
    return resolved;
  }

  #assertExactSpec(spec, label) {
    if (
      typeof spec !== "string"
      || spec !== this.spec
      || spec !== path.posix.normalize(spec)
      || !/^specs\/[^/]+\/spec\.json$/.test(spec)
    ) {
      throw authorityError(`${label} spec must exactly match bound authority ${this.spec}`);
    }
  }

  #assertRealDirectory(directory, label) {
    const stat = this.#lstat(directory, label);
    if (!stat.isDirectory() || stat.isSymbolicLink() || this.#realpath(directory, label) !== directory) {
      throw authorityError(`${label} must be a real directory: ${directory}`);
    }
  }

  #lstat(target, label) {
    try {
      return fs.lstatSync(target);
    } catch (cause) {
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

class FlowStateWriterLock {
  constructor(authority, faults) {
    this.authority = authority;
    this.faults = faults;
    this.token = null;
    this.ownerTempPath = null;
    this.acquired = false;
  }

  acquire() {
    let descriptor = null;
    const cleanup = new CleanupReport(this.faults);
    try {
      const opened = this.#openOwnerTemp();
      this.token = opened.token;
      this.ownerTempPath = opened.path;
      descriptor = opened.descriptor;
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
      if (owner.token !== this.token) throw new Error("flow writer lock ownership changed");
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

  #openOwnerTemp() {
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
      token: this.token,
      pid: process.pid,
      root: this.authority.root,
      spec: this.authority.spec,
      statePath: this.authority.statePath,
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
    const ownerIsAlive = isProcessAlive(owner.pid);
    return atomicError(
      ownerIsAlive ? "FLOW_STATE_ATOMIC_BUSY" : "FLOW_STATE_ATOMIC_LOCK_STALE",
      ownerIsAlive
        ? `flow state writer is active (pid ${owner.pid})`
        : `stale flow state writer lock requires manual removal: ${this.authority.lockPath}`,
      { cause, authority: this.authority },
    );
  }

  #readOwner() {
    const stat = fs.lstatSync(this.authority.lockPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_LOCK_BYTES) {
      throw new Error("flow writer lock must be a bounded regular file");
    }
    const owner = JSON.parse(fs.readFileSync(this.authority.lockPath, "utf8"));
    if (
      owner.version !== LOCK_VERSION
      || owner.kind !== LOCK_KIND
      || !UUID_PATTERN.test(owner.token)
      || !Number.isSafeInteger(owner.pid)
      || owner.pid < 1
      || owner.root !== this.authority.root
      || owner.spec !== this.authority.spec
      || owner.statePath !== this.authority.statePath
    ) {
      throw new Error("flow writer lock authority is invalid");
    }
    return owner;
  }

  #residuePaths() {
    return [this.ownerTempPath, this.authority.lockPath]
      .filter((candidate) => candidate && pathMayExist(candidate));
  }
}

export class AtomicFlowStateWriter {
  constructor({ root, boundSpecId, expectedOriginal, nextState, faultInjector = () => {} }) {
    this.authority = new FlowStateWriteAuthority({ root, boundSpecId, expectedOriginal, nextState });
    this.faults = new FaultBoundary(faultInjector);
    this.lock = new FlowStateWriterLock(this.authority, this.faults);
  }

  save() {
    this.lock.acquire();
    let descriptor = null;
    let tempPath = null;
    let committed = false;
    let primary = null;
    const cleanup = new CleanupReport(this.faults);
    try {
      const current = fs.readFileSync(this.authority.statePath);
      if (digest(current) !== this.authority.expectedDigest || !current.equals(this.authority.expectedContent)) {
        throw atomicError("FLOW_STATE_ATOMIC_STALE", "flow state changed after target resolution", {
          authority: this.authority,
        });
      }

      const opened = this.#openStateTemp();
      tempPath = opened.path;
      descriptor = opened.descriptor;
      this.faults.emit("before-state-temp-write", { tempPath });
      fs.writeFileSync(descriptor, this.authority.nextContent);
      this.faults.emit("after-state-temp-write", { tempPath });
      fs.fchmodSync(descriptor, this.authority.mode);
      this.faults.emit("before-state-file-fsync", { tempPath });
      fs.fsyncSync(descriptor);
      this.faults.emit("after-state-file-fsync", { tempPath });
      fs.closeSync(descriptor);
      descriptor = null;

      this.faults.emit("before-state-rename", { tempPath, statePath: this.authority.statePath });
      fs.renameSync(tempPath, this.authority.statePath);
      tempPath = null;
      committed = true;
      this.faults.emit("after-state-rename", { statePath: this.authority.statePath });
      this.faults.emit("before-state-dir-fsync", { statePath: this.authority.statePath });
      fsyncDirectory(this.authority.specDirectory);
      this.faults.emit("after-state-dir-fsync", { statePath: this.authority.statePath });
    } catch (cause) {
      primary = cause;
    }

    if (descriptor != null) cleanup.close("before-state-cleanup-close", descriptor, tempPath);
    if (tempPath) cleanup.unlink("before-state-cleanup-unlink", tempPath);
    if (tempPath) cleanup.fsyncDirectory("before-state-cleanup-dir-fsync", this.authority.specDirectory);
    cleanup.append(this.lock.release());
    const residuePaths = [tempPath, this.authority.lockPath]
      .filter((candidate) => candidate && pathMayExist(candidate));

    if (primary || cleanup.errors.length > 0) {
      const code = primary instanceof FlowStateAtomicSaveError
        ? primary.code
        : "FLOW_STATE_ATOMIC_SAVE_FAILED";
      const message = primary?.message ?? "atomic flow state replacement cleanup failed";
      throw atomicError(code, message, {
        cause: primary?.cause ?? primary,
        authority: this.authority,
        committed,
        cleanupErrors: [
          ...(primary instanceof FlowStateAtomicSaveError ? primary.cleanupErrors : []),
          ...cleanup.errors,
        ],
        residuePaths,
      });
    }
    return { committed: true, path: this.authority.statePath };
  }

  #openStateTemp() {
    for (let attempt = 0; attempt < MAX_TEMP_ATTEMPTS; attempt += 1) {
      const tempPath = path.join(this.authority.specDirectory, `.flow.json.${crypto.randomUUID()}.tmp`);
      this.faults.emit("before-state-temp-open", { attempt, tempPath });
      try {
        return { path: tempPath, descriptor: fs.openSync(tempPath, "wx", this.authority.mode) };
      } catch (cause) {
        if (cause.code !== "EEXIST") throw cause;
      }
    }
    throw atomicError("FLOW_STATE_ATOMIC_TEMP_COLLISION", "flow state temp collision limit exceeded", {
      authority: this.authority,
    });
  }
}
