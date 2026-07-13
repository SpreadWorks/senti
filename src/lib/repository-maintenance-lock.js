import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ProcessIdentity, ProcessIdentitySource } from "./process-identity.js";

const LOCK_VERSION = 1;
const MAX_LOCK_BYTES = 64 * 1024;
const MAX_TEMP_ATTEMPTS = 3;
const MAINTENANCE_KIND = "repository-maintenance";
const FLOW_OPERATION_KIND = "repository-flow-operation";
const MAINTENANCE_FILE = ".repository-maintenance.lock";
const FLOW_OPERATION_FILE = ".repository-flow-operation.lock";

export class RepositoryLockError extends Error {
  constructor(code, message, { lockPath, cause } = {}) {
    super(message, { cause });
    this.name = "RepositoryLockError";
    this.code = code;
    this.lockPath = lockPath;
  }
}

function canonicalMainRoot(mainRoot) {
  const resolved = path.resolve(mainRoot);
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(resolved) !== resolved) {
    throw new RepositoryLockError(
      "REPOSITORY_LOCK_AUTHORITY_INVALID",
      `repository main authority must be a real directory: ${resolved}`,
    );
  }
  return resolved;
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function lockCode(kind, status) {
  const prefix = kind === MAINTENANCE_KIND
    ? "REPOSITORY_MAINTENANCE"
    : "REPOSITORY_FLOW_OPERATION";
  if (status === "live") return `${prefix}_BUSY`;
  if (status === "stale") return `${prefix}_LOCK_STALE`;
  if (status === "unknown") return `${prefix}_LOCK_UNKNOWN`;
  return `${prefix}_LOCK_CORRUPT`;
}

class ProcessOwnedRepositoryLock {
  constructor({ mainRoot, kind, fileName, processIdentitySource }) {
    this.mainRoot = canonicalMainRoot(mainRoot);
    this.directory = path.join(this.mainRoot, ".senti");
    this.kind = kind;
    this.lockPath = path.join(this.directory, fileName);
    this.processIdentitySource = processIdentitySource;
    this.processIdentity = null;
  }

  acquire() {
    fs.mkdirSync(this.directory, { recursive: true });
    const existing = this.inspect();
    if (existing) throw this.conflict(existing);

    let descriptor = null;
    let tempPath = null;
    let published = false;
    try {
      for (let attempt = 0; attempt < MAX_TEMP_ATTEMPTS; attempt += 1) {
        const token = crypto.randomUUID();
        const candidate = path.join(this.directory, `.${path.basename(this.lockPath)}.${token}.owner.tmp`);
        try {
          descriptor = fs.openSync(candidate, "wx", 0o600);
          tempPath = candidate;
          this.processIdentity = this.processIdentitySource.createOwner(token);
          break;
        } catch (error) {
          if (descriptor != null) fs.closeSync(descriptor);
          descriptor = null;
          if (error.code !== "EEXIST") throw error;
        }
      }
      if (descriptor == null || tempPath == null || this.processIdentity == null) {
        throw new Error("repository lock owner temp collision limit exceeded");
      }
      fs.writeFileSync(descriptor, `${JSON.stringify(this.owner(), null, 2)}\n`);
      fs.fchmodSync(descriptor, 0o600);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = null;
      try {
        fs.linkSync(tempPath, this.lockPath);
      } catch (error) {
        if (error.code === "EEXIST") {
          const owner = this.inspect();
          if (owner) throw this.conflict(owner);
        }
        throw error;
      }
      published = true;
      fs.unlinkSync(tempPath);
      tempPath = null;
      fsyncDirectory(this.directory);
      return this.processIdentity.ownerToken;
    } catch (cause) {
      if (descriptor != null) {
        try { fs.closeSync(descriptor); } catch (_) {}
      }
      if (tempPath != null) {
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }
      if (published) {
        try { fs.unlinkSync(this.lockPath); } catch (_) {}
      }
      this.processIdentity = null;
      if (cause instanceof RepositoryLockError) throw cause;
      throw new RepositoryLockError(
        "REPOSITORY_LOCK_ACQUIRE_FAILED",
        `repository lock acquisition failed: ${cause.message}`,
        { lockPath: this.lockPath, cause },
      );
    }
  }

  release() {
    if (this.processIdentity == null) return;
    const owner = this.readOwner();
    if (owner.processIdentity.ownerToken !== this.processIdentity.ownerToken) {
      throw new RepositoryLockError(
        "REPOSITORY_LOCK_OWNERSHIP_CHANGED",
        "repository lock ownership changed",
        { lockPath: this.lockPath },
      );
    }
    fs.unlinkSync(this.lockPath);
    fsyncDirectory(this.directory);
    this.processIdentity = null;
  }

  inspect() {
    try {
      fs.lstatSync(this.lockPath);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw new RepositoryLockError(
        lockCode(this.kind, "corrupt"),
        `repository lock is unreadable: ${error.message}`,
        { lockPath: this.lockPath, cause: error },
      );
    }
    return this.readOwner();
  }

  conflict(owner) {
    const assessment = this.processIdentitySource.assess(owner.processIdentity);
    return new RepositoryLockError(
      lockCode(this.kind, assessment.status),
      assessment.reason,
      { lockPath: this.lockPath },
    );
  }

  owner() {
    return {
      version: LOCK_VERSION,
      kind: this.kind,
      mainRoot: this.mainRoot,
      processIdentity: this.processIdentity,
    };
  }

  readOwner() {
    try {
      const stat = fs.lstatSync(this.lockPath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_LOCK_BYTES) {
        throw new Error("repository lock must be a bounded regular file");
      }
      const owner = JSON.parse(fs.readFileSync(this.lockPath, "utf8"));
      if (
        owner.version !== LOCK_VERSION
        || owner.kind !== this.kind
        || owner.mainRoot !== this.mainRoot
      ) {
        throw new Error("repository lock authority is invalid");
      }
      owner.processIdentity = new ProcessIdentity(owner.processIdentity ?? {});
      return owner;
    } catch (cause) {
      if (cause instanceof RepositoryLockError) throw cause;
      throw new RepositoryLockError(
        lockCode(this.kind, "corrupt"),
        `repository lock is corrupt: ${cause.message}`,
        { lockPath: this.lockPath, cause },
      );
    }
  }
}

function inspectForeign(lock, allowedOwnerToken) {
  const owner = lock.inspect();
  if (!owner) return null;
  if (allowedOwnerToken && owner.processIdentity.ownerToken === allowedOwnerToken) return null;
  return lock.conflict(owner);
}

export function assertRepositoryMaintenanceAvailable({
  mainRoot,
  maintenanceOwnerToken = null,
  processIdentitySource = new ProcessIdentitySource(),
}) {
  const maintenance = new ProcessOwnedRepositoryLock({
    mainRoot,
    kind: MAINTENANCE_KIND,
    fileName: MAINTENANCE_FILE,
    processIdentitySource,
  });
  const conflict = inspectForeign(maintenance, maintenanceOwnerToken);
  if (conflict) throw conflict;
}

export class RepositoryMaintenanceLock {
  constructor({ mainRoot, processIdentitySource = new ProcessIdentitySource() }) {
    this.processIdentitySource = processIdentitySource;
    this.lock = new ProcessOwnedRepositoryLock({
      mainRoot,
      kind: MAINTENANCE_KIND,
      fileName: MAINTENANCE_FILE,
      processIdentitySource,
    });
    this.flowOperation = new ProcessOwnedRepositoryLock({
      mainRoot,
      kind: FLOW_OPERATION_KIND,
      fileName: FLOW_OPERATION_FILE,
      processIdentitySource,
    });
  }

  static pathFor(mainRoot) {
    return path.join(path.resolve(mainRoot), ".senti", MAINTENANCE_FILE);
  }

  get ownerToken() {
    return this.lock.processIdentity?.ownerToken ?? null;
  }

  acquire() {
    const token = this.lock.acquire();
    try {
      const conflict = inspectForeign(this.flowOperation, null);
      if (conflict) throw conflict;
      return token;
    } catch (error) {
      this.lock.release();
      throw error;
    }
  }

  release() {
    this.lock.release();
  }
}

export class RepositoryFlowOperationLock {
  constructor({
    mainRoot,
    maintenanceOwnerToken = null,
    operationOwnerToken = null,
    processIdentitySource = new ProcessIdentitySource(),
  }) {
    this.maintenanceOwnerToken = maintenanceOwnerToken;
    this.operationOwnerToken = operationOwnerToken;
    this.borrowed = false;
    this.maintenance = new ProcessOwnedRepositoryLock({
      mainRoot,
      kind: MAINTENANCE_KIND,
      fileName: MAINTENANCE_FILE,
      processIdentitySource,
    });
    this.lock = new ProcessOwnedRepositoryLock({
      mainRoot,
      kind: FLOW_OPERATION_KIND,
      fileName: FLOW_OPERATION_FILE,
      processIdentitySource,
    });
  }

  acquire() {
    const before = inspectForeign(this.maintenance, this.maintenanceOwnerToken);
    if (before) throw before;
    const existing = this.lock.inspect();
    if (
      existing
      && this.operationOwnerToken
      && existing.processIdentity.ownerToken === this.operationOwnerToken
    ) {
      this.borrowed = true;
      return this.operationOwnerToken;
    }
    if (existing) throw this.lock.conflict(existing);
    const token = this.lock.acquire();
    try {
      const after = inspectForeign(this.maintenance, this.maintenanceOwnerToken);
      if (after) throw after;
      return token;
    } catch (error) {
      this.lock.release();
      throw error;
    }
  }

  release() {
    if (this.borrowed) {
      this.borrowed = false;
      return;
    }
    this.lock.release();
  }
}
