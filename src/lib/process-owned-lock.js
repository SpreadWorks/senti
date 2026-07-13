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
  let primaryError = null;
  try {
    fs.fsyncSync(descriptor);
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch (cleanupError) {
      if (primaryError) {
        throw new AggregateError(
          [primaryError, cleanupError],
          `directory fsync and descriptor cleanup both failed: ${directory}`,
          { cause: primaryError },
        );
      }
      throw cleanupError;
    }
  }
  if (primaryError) throw primaryError;
}

function orderedFailure(primary, cleanupErrors, message) {
  if (cleanupErrors.length === 0) return primary;
  const primaryErrors = primary instanceof AggregateError && primary.cause === primary.errors[0]
    ? primary.errors
    : [primary];
  return new AggregateError(
    [...primaryErrors, ...cleanupErrors],
    message,
    { cause: primaryErrors[0] },
  );
}

function ownerSnapshot(owner) {
  return owner?.toJSON ? owner.toJSON() : structuredClone(owner ?? null);
}

function residueAt(filePath, cleanupErrors) {
  if (!filePath) return false;
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    cleanupErrors.push(error);
    return true;
  }
}

export class ProcessOwnedLockTransitionError extends Error {
  constructor(message, {
    cause,
    code,
    phase,
    lockPath,
    owner,
    publishedToVisibleName,
    durabilityUnknown,
    residue,
  }) {
    super(message, { cause });
    this.name = "ProcessOwnedLockTransitionError";
    this.code = code;
    this.phase = phase;
    this.lockPath = lockPath;
    this.owner = ownerSnapshot(owner);
    this.publishedToVisibleName = publishedToVisibleName;
    this.durabilityUnknown = durabilityUnknown;
    this.residue = Object.freeze({ temp: residue.temp === true, visible: residue.visible === true });
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
    try {
      fs.unlinkSync(this.lockPath);
    } catch (cause) {
      const cleanupErrors = [];
      const visibleResidue = residueAt(this.lockPath, cleanupErrors);
      throw this.#transitionError({
        phase: "release-unlink",
        cause: orderedFailure(
          cause,
          cleanupErrors,
          `process-owned lock release and residue inspection both failed: ${this.lockPath}`,
        ),
        owner: current.owner,
        publishedToVisibleName: false,
        durabilityUnknown: false,
        residue: { temp: false, visible: visibleResidue },
      });
    }
    this.processIdentity = null;
    this.lockIdentity = null;
    try {
      fsyncDirectory(this.directory);
    } catch (cause) {
      const cleanupErrors = [];
      const visibleResidue = residueAt(this.lockPath, cleanupErrors);
      throw this.#transitionError({
        phase: "release-directory-fsync",
        cause: orderedFailure(
          cause,
          cleanupErrors,
          `process-owned lock release durability and residue inspection both failed: ${this.lockPath}`,
        ),
        owner: current.owner,
        publishedToVisibleName: false,
        durabilityUnknown: true,
        residue: { temp: false, visible: visibleResidue },
      });
    }
  }

  #publish() {
    const token = crypto.randomUUID();
    const tempPath = path.join(this.directory, `.${path.basename(this.lockPath)}.${token}.owner.tmp`);
    let descriptor = null;
    let published = false;
    let owner = null;
    let phase = "owner-temp-open";
    try {
      descriptor = fs.openSync(tempPath, "wx", 0o600);
      this.processIdentity = this.processIdentitySource.createOwner(token);
      owner = new ProcessOwnedLockOwner({
        kind: this.kind,
        authority: this.authority,
        processIdentity: this.processIdentity,
      });
      phase = "owner-file-write";
      fs.writeFileSync(descriptor, `${JSON.stringify(owner.toJSON(), null, 2)}\n`);
      phase = "owner-file-mode";
      fs.fchmodSync(descriptor, 0o600);
      phase = "owner-file-fsync";
      fs.fsyncSync(descriptor);
      phase = "owner-file-stat";
      const tempStat = fs.fstatSync(descriptor);
      this.lockIdentity = { dev: tempStat.dev, ino: tempStat.ino };
      phase = "owner-file-close";
      fs.closeSync(descriptor);
      descriptor = null;
      this.directoryAuthority.assertStable();
      phase = "publish-link";
      fs.linkSync(tempPath, this.lockPath);
      published = true;
      phase = "publish-identity-validate";
      if (!sameFile(fs.lstatSync(this.lockPath), this.lockIdentity)) {
        throw this.#error("ownership-changed", "published process-owned lock identity changed");
      }
      phase = "publish-temp-unlink";
      fs.unlinkSync(tempPath);
      phase = "publish-directory-fsync";
      fsyncDirectory(this.directory);
      return this.processIdentity.ownerToken;
    } catch (primaryError) {
      const cleanupErrors = [];
      let cleanupUnlinked = false;
      if (descriptor != null) {
        try { fs.closeSync(descriptor); } catch (error) { cleanupErrors.push(error); }
      }
      try {
        fs.unlinkSync(tempPath);
        cleanupUnlinked = true;
      } catch (error) {
        if (error.code !== "ENOENT") cleanupErrors.push(error);
      }
      if (published) {
        try {
          const stat = fs.lstatSync(this.lockPath);
          if (sameFile(stat, this.lockIdentity)) {
            fs.unlinkSync(this.lockPath);
            cleanupUnlinked = true;
          } else {
            cleanupErrors.push(new Error(`published process-owned lock identity changed during cleanup: ${this.lockPath}`));
          }
        } catch (error) {
          if (error.code !== "ENOENT") cleanupErrors.push(error);
        }
      }
      if (cleanupUnlinked) {
        try { fsyncDirectory(this.directory); } catch (error) { cleanupErrors.push(error); }
      }
      const residue = {
        temp: residueAt(tempPath, cleanupErrors),
        visible: residueAt(this.lockPath, cleanupErrors),
      };
      const cause = orderedFailure(
        primaryError,
        cleanupErrors,
        `process-owned lock publish and cleanup both failed: ${this.lockPath}`,
      );
      if (primaryError.code === "EEXIST" && cleanupErrors.length === 0 && residue.temp === false && published === false) {
        this.processIdentity = null;
        this.lockIdentity = null;
        throw primaryError;
      }
      const transitionError = this.#transitionError({
        phase,
        cause,
        owner,
        publishedToVisibleName: published,
        durabilityUnknown: phase === "publish-directory-fsync",
        residue,
      });
      this.processIdentity = null;
      this.lockIdentity = null;
      throw transitionError;
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
    try {
      fs.unlinkSync(this.lockPath);
    } catch (cause) {
      const cleanupErrors = [];
      const visibleResidue = residueAt(this.lockPath, cleanupErrors);
      throw this.#transitionError({
        phase: "stale-remove-unlink",
        cause: orderedFailure(
          cause,
          cleanupErrors,
          `stale process-owned lock removal and residue inspection both failed: ${this.lockPath}`,
        ),
        owner: current.owner,
        publishedToVisibleName: false,
        durabilityUnknown: false,
        residue: { temp: false, visible: visibleResidue },
      });
    }
    try {
      fsyncDirectory(this.directory);
    } catch (cause) {
      const cleanupErrors = [];
      const visibleResidue = residueAt(this.lockPath, cleanupErrors);
      throw this.#transitionError({
        phase: "stale-remove-directory-fsync",
        cause: orderedFailure(
          cause,
          cleanupErrors,
          `stale process-owned lock durability and residue inspection both failed: ${this.lockPath}`,
        ),
        owner: current.owner,
        publishedToVisibleName: false,
        durabilityUnknown: true,
        residue: { temp: false, visible: visibleResidue },
      });
    }
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

  #transitionError({
    phase,
    cause,
    owner,
    publishedToVisibleName,
    durabilityUnknown,
    residue,
  }) {
    const status = durabilityUnknown ? "durability-uncertain" : "transition-failed";
    const message = durabilityUnknown
      ? `process-owned lock durability is uncertain during ${phase}: ${this.lockPath}`
      : `process-owned lock transition failed during ${phase}: ${this.lockPath}`;
    const mapped = this.errorFactory(status, message, { lockPath: this.lockPath, cause });
    return new ProcessOwnedLockTransitionError(message, {
      cause,
      code: mapped.code || `PROCESS_OWNED_LOCK_${status.replace(/-/g, "_").toUpperCase()}`,
      phase,
      lockPath: this.lockPath,
      owner,
      publishedToVisibleName,
      durabilityUnknown,
      residue,
    });
  }
}
