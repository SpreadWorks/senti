import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { RealDirectoryAuthority } from "./process-owned-lock.js";

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
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
      this.faultInjector({ phase: "before-json-temp-open", filePath: this.filePath });
      descriptor = fs.openSync(tempPath, "wx", mode);
      this.faultInjector({ phase: "before-json-temp-write", filePath: this.filePath });
      fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
      fs.fchmodSync(descriptor, mode);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = null;
      this.directoryAuthority.assertStable();
      this.faultInjector({ phase: "before-json-rename", filePath: this.filePath });
      fs.renameSync(tempPath, this.filePath);
      fsyncDirectory(this.directory);
    } catch (cause) {
      if (descriptor != null) {
        try { fs.closeSync(descriptor); } catch (_) {}
      }
      try { fs.unlinkSync(tempPath); } catch (_) {}
      throw cause;
    }
  }
}
