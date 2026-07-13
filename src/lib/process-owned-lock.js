import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ProcessIdentity, ProcessIdentitySource } from "./process-identity.js";

const LOCK_VERSION = 1;
const MAX_LOCK_BYTES = 64 * 1024;
const MAX_ACQUIRE_ATTEMPTS = 4;

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function defaultErrorFactory(status, message, { lockPath, cause } = {}) {
  const error = new Error(message, { cause });
  error.name = "ProcessOwnedLockError";
  error.code = `PROCESS_OWNED_LOCK_${status.replace(/-/g, "_").toUpperCase()}`;
  error.lockPath = lockPath;
  return error;
}

function stableAuthority(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

export class RealDirectoryAuthority {
  constructor(directory, {
    create = false,
    parentAuthority = null,
    errorFactory = defaultErrorFactory,
  } = {}) {
    this.directory = path.resolve(directory);
    this.create = create;
    this.parentAuthority = parentAuthority;
    this.errorFactory = errorFactory;
    this.identity = null;
    this.#captureIfPresent();
  }

  ensure() {
    this.parentAuthority?.assertStable();
    if (this.identity == null) {
      if (!this.create) this.#fail("authority-invalid", `lock directory is unavailable: ${this.directory}`);
      try {
        fs.mkdirSync(this.directory);
      } catch (cause) {
        if (cause.code !== "EEXIST") {
          this.#fail("authority-invalid", `lock directory creation failed: ${this.directory}`, cause);
        }
      }
      this.#capture();
    }
    this.assertStable();
    return this.directory;
  }

  assertStable() {
    this.parentAuthority?.assertStable();
    const stat = this.#validatedStat();
    if (this.identity && !sameFile(stat, this.identity)) {
      this.#fail("authority-invalid", `lock directory identity changed: ${this.directory}`);
    }
    if (this.identity == null) this.identity = { dev: stat.dev, ino: stat.ino };
    return this.directory;
  }

  #captureIfPresent() {
    try {
      fs.lstatSync(this.directory);
    } catch (cause) {
      if (cause.code === "ENOENT") return;
      this.#fail("authority-invalid", `lock directory is unavailable: ${this.directory}`, cause);
    }
    this.#capture();
  }

  #capture() {
    const stat = this.#validatedStat();
    this.identity = { dev: stat.dev, ino: stat.ino };
  }

  #validatedStat() {
    let stat;
    try {
      stat = fs.lstatSync(this.directory);
      if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(this.directory) !== this.directory) {
        throw new Error("lock authority must be a real directory");
      }
    } catch (cause) {
      this.#fail("authority-invalid", `invalid lock directory authority: ${this.directory}`, cause);
    }
    return stat;
  }

  #fail(status, message, cause) {
    throw this.errorFactory(status, message, { lockPath: this.directory, cause });
  }
}

class ProcessOwnedLockOwner {
  constructor({ kind, authority, processIdentity }) {
    this.version = LOCK_VERSION;
    this.kind = kind;
    this.authority = authority;
    this.processIdentity = processIdentity instanceof ProcessIdentity
      ? processIdentity
      : new ProcessIdentity(processIdentity ?? {});
  }

  toJSON() {
    return {
      version: this.version,
      kind: this.kind,
      ...this.authority,
      processIdentity: this.processIdentity,
    };
  }
}

export class ProcessOwnedLock {
  constructor({
    directoryAuthority,
    fileName,
    kind,
    authority,
    processIdentitySource = new ProcessIdentitySource(),
    errorFactory = defaultErrorFactory,
  }) {
    this.directoryAuthority = directoryAuthority;
    this.directory = directoryAuthority.directory;
    this.lockPath = path.join(this.directory, fileName);
    this.kind = kind;
    this.authority = authority;
    this.serializedAuthority = stableAuthority(authority);
    this.processIdentitySource = processIdentitySource;
    this.errorFactory = errorFactory;
    this.processIdentity = null;
    this.lockIdentity = null;
  }

  acquire({ claimStale = false } = {}) {
    this.directoryAuthority.ensure();
    for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt += 1) {
      const existing = this.inspect();
      if (existing) {
        const assessment = this.processIdentitySource.assess(existing.owner.processIdentity);
        if (assessment.status !== "stale" || !claimStale) {
          throw this.conflict(existing.owner, assessment);
        }
        if (!this.#removeStale(existing)) continue;
      }
      try {
        return this.#publish();
      } catch (cause) {
        if (cause.code === "EEXIST") continue;
        if (cause?.lockPath === this.lockPath) throw cause;
        throw this.#error("acquire-failed", `process-owned lock acquisition failed: ${cause.message}`, cause);
      }
    }
    const existing = this.inspect();
    if (existing) throw this.conflict(existing.owner);
    throw this.#error("acquire-failed", "process-owned lock acquisition retry limit exceeded");
  }

  inspect() {
    this.directoryAuthority.assertStable();
    let stat;
    try {
      stat = fs.lstatSync(this.lockPath);
    } catch (cause) {
      if (cause.code === "ENOENT") return null;
      throw this.#error("corrupt", `process-owned lock is unreadable: ${cause.message}`, cause);
    }
    return { owner: this.#readOwner(stat), stat: { dev: stat.dev, ino: stat.ino } };
  }

  conflict(owner, assessment = this.processIdentitySource.assess(owner.processIdentity)) {
    return this.#error(assessment.status, assessment.reason);
  }

  release() {
    if (this.processIdentity == null) return;
    this.directoryAuthority.assertStable();
    const current = this.inspect();
    if (
      !current
      || !sameFile(current.stat, this.lockIdentity)
      || current.owner.processIdentity.ownerToken !== this.processIdentity.ownerToken
    ) {
      throw this.#error("ownership-changed", "process-owned lock ownership changed");
    }
    fs.unlinkSync(this.lockPath);
    fsyncDirectory(this.directory);
    this.processIdentity = null;
    this.lockIdentity = null;
  }

  #publish() {
    const token = crypto.randomUUID();
    const tempPath = path.join(this.directory, `.${path.basename(this.lockPath)}.${token}.owner.tmp`);
    let descriptor = null;
    let published = false;
    try {
      descriptor = fs.openSync(tempPath, "wx", 0o600);
      this.processIdentity = this.processIdentitySource.createOwner(token);
      const owner = new ProcessOwnedLockOwner({
        kind: this.kind,
        authority: this.authority,
        processIdentity: this.processIdentity,
      });
      fs.writeFileSync(descriptor, `${JSON.stringify(owner.toJSON(), null, 2)}\n`);
      fs.fchmodSync(descriptor, 0o600);
      fs.fsyncSync(descriptor);
      const tempStat = fs.fstatSync(descriptor);
      this.lockIdentity = { dev: tempStat.dev, ino: tempStat.ino };
      fs.closeSync(descriptor);
      descriptor = null;
      this.directoryAuthority.assertStable();
      fs.linkSync(tempPath, this.lockPath);
      published = true;
      if (!sameFile(fs.lstatSync(this.lockPath), this.lockIdentity)) {
        throw this.#error("ownership-changed", "published process-owned lock identity changed");
      }
      fs.unlinkSync(tempPath);
      fsyncDirectory(this.directory);
      return this.processIdentity.ownerToken;
    } catch (cause) {
      if (descriptor != null) {
        try { fs.closeSync(descriptor); } catch (_) {}
      }
      try { fs.unlinkSync(tempPath); } catch (_) {}
      if (published) {
        try {
          const stat = fs.lstatSync(this.lockPath);
          if (sameFile(stat, this.lockIdentity)) fs.unlinkSync(this.lockPath);
        } catch (_) {}
      }
      this.processIdentity = null;
      this.lockIdentity = null;
      throw cause;
    }
  }

  #removeStale(existing) {
    this.directoryAuthority.assertStable();
    let current;
    try {
      current = this.inspect();
    } catch (error) {
      throw error;
    }
    if (!current) return false;
    if (
      !sameFile(current.stat, existing.stat)
      || current.owner.processIdentity.ownerToken !== existing.owner.processIdentity.ownerToken
    ) return false;
    const assessment = this.processIdentitySource.assess(current.owner.processIdentity);
    if (assessment.status !== "stale") throw this.conflict(current.owner, assessment);
    fs.unlinkSync(this.lockPath);
    fsyncDirectory(this.directory);
    return true;
  }

  #readOwner(stat) {
    let descriptor = null;
    try {
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_LOCK_BYTES) {
        throw new Error("process-owned lock must be a bounded regular file");
      }
      descriptor = fs.openSync(
        this.lockPath,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
      );
      const openedStat = fs.fstatSync(descriptor);
      if (!sameFile(stat, openedStat) || !openedStat.isFile() || openedStat.size > MAX_LOCK_BYTES) {
        throw new Error("process-owned lock identity changed while reading");
      }
      const value = JSON.parse(fs.readFileSync(descriptor, "utf8"));
      const actualAuthority = Object.fromEntries(
        Object.keys(this.authority).map((key) => [key, value[key]]),
      );
      if (
        value.version !== LOCK_VERSION
        || value.kind !== this.kind
        || stableAuthority(actualAuthority) !== this.serializedAuthority
      ) {
        throw new Error("process-owned lock authority is invalid");
      }
      return new ProcessOwnedLockOwner({
        kind: value.kind,
        authority: actualAuthority,
        processIdentity: value.processIdentity,
      });
    } catch (cause) {
      throw this.#error("corrupt", `process-owned lock is corrupt: ${cause.message}`, cause);
    } finally {
      if (descriptor != null) fs.closeSync(descriptor);
    }
  }

  #error(status, message, cause) {
    return this.errorFactory(status, message, { lockPath: this.lockPath, cause });
  }
}
