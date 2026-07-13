import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { RealDirectoryAuthority } from "./process-owned-lock.js";

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  let primaryError = null;
  try {
    fs.fsyncSync(descriptor);
  } catch (cause) {
    primaryError = cause;
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch (cleanupError) {
      if (primaryError) {
        throw new AggregateError(
          [primaryError, cleanupError],
          "Directory durability sync and descriptor cleanup both failed",
          { cause: primaryError },
        );
      }
      throw cleanupError;
    }
  }
  if (primaryError) throw primaryError;
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

export class AtomicJsonWriteError extends Error {
  constructor(message, { cause, phase, committedToVisibleName, durabilityUnknown }) {
    super(message, { cause });
    this.name = "AtomicJsonWriteError";
    this.code = durabilityUnknown
      ? "ATOMIC_JSON_DURABILITY_UNCERTAIN"
      : "ATOMIC_JSON_WRITE_FAILED";
    this.phase = phase;
    this.committedToVisibleName = committedToVisibleName;
    this.durabilityUnknown = durabilityUnknown;
    // Retained as a concise compatibility alias for callers deciding whether
    // an idempotent fresh-read retry is required.
    this.committed = committedToVisibleName;
  }
}

export class AtomicJsonFile {
  constructor(filePath, { faultInjector = () => {} } = {}) {
    this.filePath = path.resolve(filePath);
    this.directory = path.dirname(this.filePath);
    this.directoryAuthority = new RealDirectoryAuthority(this.directory);
    this.faultInjector = faultInjector;
  }

  read(fallback) {
    this.directoryAuthority.assertStable();
    let descriptor = null;
    let stat;
    try {
      stat = fs.lstatSync(this.filePath);
    } catch (cause) {
      if (cause.code === "ENOENT") return structuredClone(fallback);
      throw cause;
    }
    if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(this.filePath) !== this.filePath) {
      throw new Error(`JSON authority must be a regular real file: ${this.filePath}`);
    }
    try {
      descriptor = fs.openSync(
        this.filePath,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
      );
      const openedStat = fs.fstatSync(descriptor);
      if (!sameFile(stat, openedStat) || !openedStat.isFile()) {
        throw new Error(`JSON authority changed while reading: ${this.filePath}`);
      }
      return JSON.parse(fs.readFileSync(descriptor, "utf8"));
    } finally {
      if (descriptor != null) fs.closeSync(descriptor);
    }
  }

  write(value) {
    this.directoryAuthority.assertStable();
    const tempPath = path.join(this.directory, `.${path.basename(this.filePath)}.${crypto.randomUUID()}.tmp`);
    let descriptor = null;
    let mode = 0o644;
    let phase = "inspect-visible-file";
    let committedToVisibleName = false;
    try {
      try {
        const current = fs.lstatSync(this.filePath);
        if (!current.isFile() || current.isSymbolicLink() || fs.realpathSync(this.filePath) !== this.filePath) {
          throw new Error(`JSON authority must be a regular real file: ${this.filePath}`);
        }
        mode = current.mode & 0o777;
      } catch (cause) {
        if (cause.code !== "ENOENT") throw cause;
      }
      phase = "before-json-temp-open";
      this.faultInjector({ phase, filePath: this.filePath });
      descriptor = fs.openSync(tempPath, "wx", mode);
      phase = "before-json-temp-write";
      this.faultInjector({ phase, filePath: this.filePath });
      fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
      fs.fchmodSync(descriptor, mode);
      phase = "temp-file-fsync";
      fs.fsyncSync(descriptor);
      phase = "temp-file-close";
      fs.closeSync(descriptor);
      descriptor = null;
      this.directoryAuthority.assertStable();
      phase = "before-json-rename";
      this.faultInjector({ phase, filePath: this.filePath });
      fs.renameSync(tempPath, this.filePath);
      committedToVisibleName = true;
      phase = "directory-fsync";
      fsyncDirectory(this.directory);
    } catch (cause) {
      const cleanupErrors = [];
      if (descriptor != null) {
        try { fs.closeSync(descriptor); } catch (cleanupError) { cleanupErrors.push(cleanupError); }
      }
      if (!committedToVisibleName) {
        try { fs.unlinkSync(tempPath); } catch (cleanupError) {
          if (cleanupError.code !== "ENOENT") cleanupErrors.push(cleanupError);
        }
      }
      if (committedToVisibleName) {
        throw new AtomicJsonWriteError(
          `JSON write reached the visible name but durability is uncertain: ${this.filePath}`,
          {
            cause: cleanupErrors.length > 0
              ? new AggregateError([cause, ...cleanupErrors], "JSON durability and cleanup failed", { cause })
              : cause,
            phase,
            committedToVisibleName: true,
            durabilityUnknown: true,
          },
        );
      }
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [cause, ...cleanupErrors],
          `JSON write failed before commit and cleanup also failed: ${this.filePath}`,
          { cause },
        );
      }
      throw cause;
    }
  }
}
