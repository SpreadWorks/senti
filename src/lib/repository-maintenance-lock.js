import crypto from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ProcessIdentitySource } from "./process-identity.js";
import { ProcessOwnedLock, RealDirectoryAuthority } from "./process-owned-lock.js";

const MAINTENANCE_KIND = "repository-maintenance";
const FLOW_OPERATION_KIND = "repository-flow-operation";
const MAINTENANCE_FILE = ".repository-maintenance.lock";
const FLOW_OPERATION_FILE = ".repository-flow-operation.lock";
const PROCESS_OPERATION_OWNERS = new Map();

export function resolveRepositoryLockRoot(root) {
  const resolved = path.resolve(root);
  const result = spawnSync("git", ["-C", resolved, "rev-parse", "--git-common-dir"], { encoding: "utf8" });
  if (result.status !== 0) return resolved;
  const commonDirectory = path.resolve(resolved, result.stdout.trim());
  return path.basename(commonDirectory) === ".git" ? path.dirname(commonDirectory) : resolved;
}

export class RepositoryLockError extends Error {
  constructor(code, message, { lockPath, cause, contention = null } = {}) {
    super(message, { cause });
    this.name = "RepositoryLockError";
    this.code = code;
    this.lockPath = lockPath;
    this.contention = contention;
    this.committed = false;
  }
}

export class RepositoryLockContention {
  constructor({ owner, requester, requesterError = null, operation, boundary }) {
    if (owner != null && typeof owner !== "object") throw new Error("repository lock contention owner must be an object or null");
    if (requester == null && !(requesterError instanceof Error)) {
      throw new Error("repository lock contention requires a requester identity or diagnostic error");
    }
    if (requester != null && typeof requester !== "object") throw new Error("repository lock contention requester must be an object or null");
    if (typeof operation !== "string" || operation === "") throw new Error("repository lock contention requires an operation");
    if (typeof boundary !== "string" || boundary === "") throw new Error("repository lock contention requires a boundary");
    this.owner = owner;
    this.requester = requester;
    this.requesterError = requesterError;
    this.operation = operation;
    this.boundary = boundary;
    Object.freeze(this);
  }
}

function lockCode(kind, status) {
  if (status === "authority-invalid") return "REPOSITORY_LOCK_AUTHORITY_INVALID";
  const prefix = kind === MAINTENANCE_KIND
    ? "REPOSITORY_MAINTENANCE"
    : "REPOSITORY_FLOW_OPERATION";
  if (status === "live") return `${prefix}_BUSY`;
  if (status === "stale") return `${prefix}_LOCK_STALE`;
  if (status === "unknown") return `${prefix}_LOCK_UNKNOWN`;
  if (status === "corrupt") return `${prefix}_LOCK_CORRUPT`;
  if (status === "ownership-changed") return "REPOSITORY_LOCK_OWNERSHIP_CHANGED";
  return "REPOSITORY_LOCK_ACQUIRE_FAILED";
}

function repositoryErrorFactory(kind) {
  return (status, message, { lockPath, cause } = {}) => new RepositoryLockError(
    lockCode(kind, status),
    message,
    { lockPath, cause },
  );
}

class RepositoryLockAuthority {
  constructor(mainRoot) {
    this.mainRoot = path.resolve(mainRoot);
    const authorityError = repositoryErrorFactory(MAINTENANCE_KIND);
    this.root = new RealDirectoryAuthority(this.mainRoot, { errorFactory: authorityError });
    this.directory = new RealDirectoryAuthority(path.join(this.mainRoot, ".senrail"), {
      create: true,
      parentAuthority: this.root,
      errorFactory: authorityError,
    });
  }
}

class ProcessOwnedRepositoryLock {
  constructor({ repositoryAuthority, kind, fileName, processIdentitySource }) {
    this.kind = kind;
    this.core = new ProcessOwnedLock({
      directoryAuthority: repositoryAuthority.directory,
      fileName,
      kind,
      authority: { mainRoot: repositoryAuthority.mainRoot },
      processIdentitySource,
      errorFactory: repositoryErrorFactory(kind),
    });
  }

  get processIdentity() {
    return this.core.processIdentity;
  }

  acquire({ claimStale = false } = {}) {
    return this.core.acquire({ claimStale });
  }

  release() {
    this.core.release();
  }

  inspect() {
    this.core.directoryAuthority.ensure();
    return this.core.inspect()?.owner ?? null;
  }

  conflict(owner) {
    return this.core.conflict(owner);
  }
}

function inspectForeign(lock, allowedOwnerToken) {
  const owner = lock.inspect();
  if (!owner) return null;
  if (allowedOwnerToken && owner.processIdentity.ownerToken === allowedOwnerToken) return null;
  return lock.conflict(owner);
}

function acquisitionCleanupError(message, primaryError, cleanupError, residue) {
  const error = new AggregateError(
    [primaryError, cleanupError],
    message,
    { cause: primaryError },
  );
  error.residue = Object.freeze({ ...residue });
  return error;
}

export function assertRepositoryMaintenanceAvailable({
  mainRoot,
  maintenanceOwnerToken = null,
  processIdentitySource = new ProcessIdentitySource(),
}) {
  const repositoryAuthority = new RepositoryLockAuthority(mainRoot);
  const maintenance = new ProcessOwnedRepositoryLock({
    repositoryAuthority,
    kind: MAINTENANCE_KIND,
    fileName: MAINTENANCE_FILE,
    processIdentitySource,
  });
  const conflict = inspectForeign(maintenance, maintenanceOwnerToken);
  if (conflict) throw conflict;
}

export class RepositoryMaintenanceLock {
  constructor({ mainRoot, processIdentitySource = new ProcessIdentitySource() }) {
    const repositoryAuthority = new RepositoryLockAuthority(mainRoot);
    this.lock = new ProcessOwnedRepositoryLock({
      repositoryAuthority,
      kind: MAINTENANCE_KIND,
      fileName: MAINTENANCE_FILE,
      processIdentitySource,
    });
    this.flowOperation = new ProcessOwnedRepositoryLock({
      repositoryAuthority,
      kind: FLOW_OPERATION_KIND,
      fileName: FLOW_OPERATION_FILE,
      processIdentitySource,
    });
  }

  static pathFor(mainRoot) {
    return path.join(path.resolve(mainRoot), ".senrail", MAINTENANCE_FILE);
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
    } catch (primaryError) {
      try {
        this.lock.release();
      } catch (cleanupError) {
        throw acquisitionCleanupError(
          "repository maintenance acquisition and cleanup both failed",
          primaryError,
          cleanupError,
          { maintenanceLock: true },
        );
      }
      throw primaryError;
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
    allowProcessOwnerBorrow = true,
    processIdentitySource = new ProcessIdentitySource(),
  }) {
    if (typeof allowProcessOwnerBorrow !== "boolean") {
      throw new Error("repository flow-operation process-owner borrowing flag must be boolean");
    }
    const repositoryAuthority = new RepositoryLockAuthority(mainRoot);
    this.lockPath = path.join(repositoryAuthority.mainRoot, ".senrail", FLOW_OPERATION_FILE);
    this.maintenanceOwnerToken = maintenanceOwnerToken;
    this.operationOwnerToken = operationOwnerToken;
    this.allowProcessOwnerBorrow = allowProcessOwnerBorrow;
    this.borrowed = false;
    this.acquiredOwnerToken = null;
    this.maintenance = new ProcessOwnedRepositoryLock({
      repositoryAuthority,
      kind: MAINTENANCE_KIND,
      fileName: MAINTENANCE_FILE,
      processIdentitySource,
    });
    this.lock = new ProcessOwnedRepositoryLock({
      repositoryAuthority,
      kind: FLOW_OPERATION_KIND,
      fileName: FLOW_OPERATION_FILE,
      processIdentitySource,
    });
  }

  #attachContention(error, owner) {
    if (
      !(error instanceof RepositoryLockError)
      || error.contention
    ) return error;
    let requester = null;
    let requesterError = null;
    try {
      requester = this.lock.core.processIdentitySource.createOwner(crypto.randomUUID());
    } catch (cause) {
      requesterError = cause;
    }
    error.contention = new RepositoryLockContention({
      owner: owner?.processIdentity ?? null,
      requester,
      requesterError,
      operation: FLOW_OPERATION_KIND,
      boundary: "acquire",
    });
    return error;
  }

  acquire() {
    const before = inspectForeign(this.maintenance, this.maintenanceOwnerToken);
    if (before) throw before;
    let existing;
    try {
      existing = this.lock.inspect();
    } catch (error) {
      throw this.#attachContention(error, null);
    }
    const processOwner = PROCESS_OPERATION_OWNERS.get(this.lockPath);
    const knownOwnerToken = this.operationOwnerToken
      || (this.allowProcessOwnerBorrow ? processOwner?.ownerToken : null);
    if (
      existing
      && knownOwnerToken
      && existing.processIdentity.ownerToken === knownOwnerToken
    ) {
      if (processOwner && this.lock.core.processIdentitySource.assess(processOwner).status === "live") {
        this.borrowed = true;
        this.acquiredOwnerToken = knownOwnerToken;
        return knownOwnerToken;
      }
      throw this.#attachContention(
        repositoryErrorFactory(FLOW_OPERATION_KIND)(
          "live",
          "repository flow-operation lock is owned by a different requester identity",
          { lockPath: this.lockPath },
        ),
        existing,
      );
    }
    let token;
    try {
      token = this.lock.acquire({ claimStale: true });
    } catch (error) {
      throw this.#attachContention(error, existing);
    }
    try {
      const after = inspectForeign(this.maintenance, this.maintenanceOwnerToken);
      if (after) throw after;
      this.acquiredOwnerToken = token;
      PROCESS_OPERATION_OWNERS.set(this.lockPath, this.lock.processIdentity);
      return token;
    } catch (primaryError) {
      try {
        this.lock.release();
      } catch (cleanupError) {
        throw acquisitionCleanupError(
          "repository flow-operation acquisition and cleanup both failed",
          primaryError,
          cleanupError,
          { flowOperationLock: true },
        );
      }
      throw primaryError;
    }
  }

  inspectConflict() {
    return inspectForeign(this.maintenance, this.maintenanceOwnerToken)
      || inspectForeign(this.lock, this.operationOwnerToken);
  }

  assertOwned() {
    const owner = this.lock.inspect();
    if (
      this.acquiredOwnerToken == null
      || owner == null
      || owner.processIdentity.ownerToken !== this.acquiredOwnerToken
    ) {
      throw repositoryErrorFactory(FLOW_OPERATION_KIND)(
        "ownership-changed",
        "repository flow-operation ownership changed",
        { lockPath: this.lockPath },
      );
    }
    return this.acquiredOwnerToken;
  }

  release() {
    if (this.borrowed) {
      this.borrowed = false;
      this.acquiredOwnerToken = null;
      return;
    }
    this.lock.release();
    if (PROCESS_OPERATION_OWNERS.get(this.lockPath)?.ownerToken === this.acquiredOwnerToken) {
      PROCESS_OPERATION_OWNERS.delete(this.lockPath);
    }
    this.acquiredOwnerToken = null;
  }
}
