import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { AtomicJsonFile } from "../../lib/atomic-json-file.js";
import { ProcessIdentitySource } from "../../lib/process-identity.js";
import { ProcessOwnedLock, RealDirectoryAuthority } from "../../lib/process-owned-lock.js";
import {
  RepositoryFlowOperationLock,
  resolveRepositoryLockRoot,
} from "../../lib/repository-maintenance-lock.js";

const LOCK_WAIT_ATTEMPTS = 500;
const LOCK_WAIT_MS = 10;

function requireAuthorityString(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} is required`);
  return value.trim();
}

function issueLogError(status, message, { lockPath, cause } = {}) {
  const error = new Error(message, { cause });
  error.name = "IssueLogStoreError";
  error.code = `ISSUE_LOG_${status.replace(/-/g, "_").toUpperCase()}`;
  error.lockPath = lockPath;
  return error;
}

function waitForWriter() {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_WAIT_MS);
}

function revisionOf(document) {
  return crypto.createHash("sha256").update(JSON.stringify(document.toJSON())).digest("hex");
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function writeExactIssueLog(filePath, bytes, mode) {
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${crypto.randomUUID()}.restore.tmp`);
  const descriptor = fs.openSync(tempPath, "wx", mode);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fchmodSync(descriptor, mode);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(tempPath, filePath);
  fsyncDirectory(path.dirname(filePath));
}

function assertSpecFileAuthority(resolvedSpec, spec) {
  let stat;
  try {
    stat = fs.lstatSync(resolvedSpec);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw new Error(`issue-log spec authority is unreadable: ${spec}`, { cause: error });
  }
  if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(resolvedSpec) !== resolvedSpec) {
    throw new Error(`issue-log spec authority must be a real file: ${spec}`);
  }
}

export class IssueLogDocument {
  constructor(value = {}, { allowLegacyArray = false } = {}) {
    if (allowLegacyArray && Array.isArray(value)) {
      this.entries = structuredClone(value);
      this.legacyArray = true;
      return;
    }
    if (value == null || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.entries)) {
      throw new Error('Invalid issue-log.json: "entries" must be an array');
    }
    this.entries = structuredClone(value.entries);
    this.legacyArray = false;
  }

  append(entry, idempotencyKey) {
    const key = requireAuthorityString(idempotencyKey, "issue-log idempotencyKey");
    const existing = this.entries.find((item) => item?.issueLogId === key || item?.grantId === key);
    if (existing) return { appended: false, entry: structuredClone(existing) };
    const stored = { ...structuredClone(entry), issueLogId: key };
    this.entries.push(stored);
    return { appended: true, entry: structuredClone(stored) };
  }

  remove(idempotencyKey) {
    const key = requireAuthorityString(idempotencyKey, "issue-log idempotencyKey");
    const index = this.entries.findIndex((item) => item?.issueLogId === key || item?.grantId === key);
    if (index < 0) return false;
    this.entries.splice(index, 1);
    return true;
  }

  toJSON() {
    const entries = structuredClone(this.entries);
    return this.legacyArray ? entries : { entries };
  }
}

export class IssueLogSnapshot {
  constructor(document) {
    this.document = document;
    this.revision = revisionOf(document);
    Object.freeze(this);
  }

  toJSON() {
    return this.document.toJSON();
  }
}

export class IssueLogStore {
  constructor({
    root,
    spec,
    processIdentitySource = new ProcessIdentitySource(),
    faultInjector,
    allowLegacyArray = false,
    mainRoot = null,
    maintenanceOwnerToken = null,
    operationOwnerToken = null,
  } = {}) {
    this.root = path.resolve(requireAuthorityString(root, "issue-log root"));
    this.mainRoot = mainRoot == null
      ? resolveRepositoryLockRoot(this.root)
      : path.resolve(mainRoot);
    this.maintenanceOwnerToken = maintenanceOwnerToken;
    this.operationOwnerToken = operationOwnerToken;
    this.processIdentitySource = processIdentitySource;
    this.spec = requireAuthorityString(spec, "issue-log spec");
    const resolvedSpec = path.resolve(this.root, this.spec);
    const relative = path.relative(this.root, resolvedSpec);
    const specFile = path.basename(resolvedSpec);
    if (
      relative.startsWith("..")
      || path.isAbsolute(relative)
      || !["spec.json", "spec.md"].includes(specFile)
    ) {
      throw new Error(`issue-log spec authority is outside the project root: ${this.spec}`);
    }
    this.directory = path.dirname(resolvedSpec);
    this.filePath = path.join(this.directory, "issue-log.json");
    const directoryAuthority = new RealDirectoryAuthority(this.directory, {
      errorFactory: (status, message, data) => issueLogError(status, message, data),
    });
    directoryAuthority.ensure();
    assertSpecFileAuthority(resolvedSpec, this.spec);
    this.lock = new ProcessOwnedLock({
      directoryAuthority,
      fileName: ".issue-log.lock",
      kind: "issue-log-writer",
      authority: { root: this.root, spec: this.spec, filePath: this.filePath },
      processIdentitySource,
      errorFactory: (status, message, data) => issueLogError(status, message, data),
    });
    this.file = new AtomicJsonFile(this.filePath, { faultInjector });
    this.allowLegacyArray = allowLegacyArray;
  }

  read() {
    return this.#readFresh();
  }

  append(entry, idempotencyKey) {
    return this.#withLock(() => {
      const snapshot = this.#readFresh();
      const result = snapshot.document.append(entry, idempotencyKey);
      if (result.appended) this.file.write(snapshot.document.toJSON());
      return {
        ...result,
        total: snapshot.document.entries.length,
        revision: revisionOf(snapshot.document),
      };
    });
  }

  appendMany(entries) {
    if (!Array.isArray(entries)) throw new Error("issue-log appendMany entries must be an array");
    return this.#withLock(() => {
      const snapshot = this.#readFresh();
      const appended = [];
      for (const item of entries) {
        const result = snapshot.document.append(item.entry, item.idempotencyKey);
        if (result.appended) appended.push(result.entry);
      }
      if (appended.length > 0) this.file.write(snapshot.document.toJSON());
      return { appended, total: snapshot.document.entries.length, revision: revisionOf(snapshot.document) };
    });
  }

  mutate(expectedRevision, mutator) {
    requireAuthorityString(expectedRevision, "issue-log expectedRevision");
    if (typeof mutator !== "function") throw new Error("issue-log mutator is required");
    return this.#withLock(() => {
      const snapshot = this.#readFresh();
      if (snapshot.revision !== expectedRevision) {
        throw issueLogError("revision-conflict", "issue-log changed before the requested mutation");
      }
      const result = mutator(snapshot.document);
      this.file.write(snapshot.document.toJSON());
      return { result, total: snapshot.document.entries.length, revision: revisionOf(snapshot.document) };
    });
  }

  compensate(idempotencyKey) {
    return this.#withLock(() => {
      const snapshot = this.#readFresh();
      const removed = snapshot.document.remove(idempotencyKey);
      if (removed) this.file.write(snapshot.document.toJSON());
      return { removed, total: snapshot.document.entries.length, revision: revisionOf(snapshot.document) };
    });
  }

  restoreOwnedMutation({ idempotencyKeys, before }) {
    if (!Array.isArray(idempotencyKeys)) throw new Error("issue-log restore IDs must be an array");
    if (
      before == null
      || typeof before !== "object"
      || typeof before.exists !== "boolean"
      || (before.exists && (typeof before.bytes !== "string" || !Number.isInteger(before.mode)))
    ) {
      throw new Error("issue-log restore before-image is invalid");
    }
    const beforeBytes = before.exists ? Buffer.from(before.bytes, "base64") : null;
    const beforeDocument = new IssueLogDocument(
      before.exists ? JSON.parse(beforeBytes.toString("utf8")) : { entries: [] },
      { allowLegacyArray: this.allowLegacyArray },
    );
    return this.#withLock(() => {
      const snapshot = this.#readFresh();
      let removed = false;
      for (const idempotencyKey of new Set(idempotencyKeys)) {
        removed = snapshot.document.remove(idempotencyKey) || removed;
      }
      if (revisionOf(snapshot.document) === revisionOf(beforeDocument)) {
        if (before.exists) {
          writeExactIssueLog(this.filePath, beforeBytes, before.mode);
        } else {
          try {
            fs.unlinkSync(this.filePath);
            fsyncDirectory(this.directory);
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
        }
      } else if (removed) {
        this.file.write(snapshot.document.toJSON());
      }
      return { removed, exact: revisionOf(snapshot.document) === revisionOf(beforeDocument) };
    });
  }

  #readFresh() {
    return new IssueLogSnapshot(new IssueLogDocument(
      this.file.read({ entries: [] }),
      { allowLegacyArray: this.allowLegacyArray },
    ));
  }

  #withLock(operation) {
    const repositoryOperation = new RepositoryFlowOperationLock({
      mainRoot: this.mainRoot,
      maintenanceOwnerToken: this.maintenanceOwnerToken,
      operationOwnerToken: this.operationOwnerToken,
      processIdentitySource: this.processIdentitySource,
    });
    let repositoryAcquired = false;
    for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt += 1) {
      try {
        repositoryOperation.acquire();
        repositoryAcquired = true;
        break;
      } catch (error) {
        if (error.code !== "REPOSITORY_FLOW_OPERATION_BUSY") throw error;
        waitForWriter();
      }
    }
    if (!repositoryAcquired) throw issueLogError("busy", "repository flow-operation lock wait limit exceeded");
    let result;
    let primaryError;
    try {
      result = this.#withWriterLock(operation);
    } catch (error) {
      primaryError = error;
    }
    let releaseError;
    try {
      repositoryOperation.release();
    } catch (error) {
      releaseError = error;
    }
    if (primaryError && releaseError) {
      throw new AggregateError(
        [primaryError, releaseError],
        "issue-log operation and repository barrier release both failed",
        { cause: primaryError },
      );
    }
    if (primaryError) throw primaryError;
    if (releaseError) throw releaseError;
    return result;
  }

  #withWriterLock(operation) {
    let acquired = false;
    for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt += 1) {
      try {
        this.lock.acquire({ claimStale: true });
        acquired = true;
        break;
      } catch (error) {
        if (error.code !== "ISSUE_LOG_LIVE") throw error;
        waitForWriter();
      }
    }
    if (!acquired) throw issueLogError("busy", "issue-log writer lock wait limit exceeded");
    let result;
    let primaryError;
    try {
      result = operation();
    } catch (error) {
      primaryError = error;
    }
    let releaseError;
    try {
      this.lock.release();
    } catch (error) {
      releaseError = error;
    }
    if (primaryError && releaseError) {
      throw new AggregateError(
        [primaryError, releaseError],
        "issue-log operation and writer-lock release both failed",
        { cause: primaryError },
      );
    }
    if (primaryError) throw primaryError;
    if (releaseError) throw releaseError;
    return result;
  }
}
