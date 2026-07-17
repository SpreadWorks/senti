import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ALPHA_VERSION_PATTERN = /^0\.1\.0-alpha\.(0|[1-9]\d*)$/;

function requireRoot(root) {
  if (typeof root !== "string" || root.trim() === "") {
    throw new Error("alpha release root must be a non-empty string");
  }
  return path.resolve(root);
}

export class AlphaVersion {
  constructor(value) {
    const match = ALPHA_VERSION_PATTERN.exec(String(value || ""));
    if (!match) throw new Error(`package version must use 0.1.0-alpha.N format; received ${JSON.stringify(value)}`);
    const sequence = Number(match[1]);
    if (!Number.isSafeInteger(sequence)) throw new Error("alpha version sequence must be a safe integer");
    this.sequence = sequence;
    Object.freeze(this);
  }

  toString() {
    return `0.1.0-alpha.${this.sequence}`;
  }
}

export class ReleaseCommitCount {
  constructor(value) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error("release commit count must be a non-negative safe integer");
    }
    this.value = value;
    Object.freeze(this);
  }

  next() {
    return new ReleaseCommitCount(this.value + 1);
  }
}

export class AlphaReleaseInvariant {
  constructor(version, commitCount) {
    if (!(version instanceof AlphaVersion) || !(commitCount instanceof ReleaseCommitCount)) {
      throw new Error("alpha release invariant requires a version and commit count");
    }
    if (version.sequence !== commitCount.value) {
      throw new Error(
        `package version ${version} does not match HEAD commit count ${commitCount.value}`,
      );
    }
    this.version = version;
    this.commitCount = commitCount;
    Object.freeze(this);
  }
}

export class AlphaVersionSynchronization {
  constructor({ status, version, commitCount }) {
    if (!["updated", "already_synchronized"].includes(status)) {
      throw new Error("alpha version synchronization status is invalid");
    }
    if (!(version instanceof AlphaVersion) || !(commitCount instanceof ReleaseCommitCount)) {
      throw new Error("alpha version synchronization requires a version and commit count");
    }
    this.status = status;
    this.version = version;
    this.commitCount = commitCount;
    Object.freeze(this);
  }
}

class GitRepository {
  constructor(root) {
    this.root = requireRoot(root);
  }

  commitCount() {
    const output = this.#run(["rev-list", "--count", "HEAD"], "read HEAD commit count");
    if (!/^\d+$/.test(output)) throw new Error(`git returned an invalid HEAD commit count: ${output}`);
    return new ReleaseCommitCount(Number(output));
  }

  assertClean() {
    const output = this.#run(
      ["status", "--porcelain=v1", "--untracked-files=all"],
      "inspect release target worktree",
    );
    if (output !== "") {
      throw new Error("alpha version synchronization requires a clean worktree after the release target HEAD is finalized");
    }
  }

  #run(args, operation) {
    const result = spawnSync("git", args, { cwd: this.root, encoding: "utf8" });
    if (result.error) throw new Error(`failed to ${operation}: ${result.error.message}`, { cause: result.error });
    if (result.status !== 0) {
      throw new Error(`failed to ${operation}: ${(result.stderr || result.stdout || "git failed").trim()}`);
    }
    return result.stdout.trim();
  }
}

class PackageManifest {
  constructor(root) {
    this.root = requireRoot(root);
    this.filePath = path.join(this.root, "package.json");
  }

  read() {
    let value;
    try {
      value = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch (cause) {
      throw new Error(`failed to read package.json: ${cause.message}`, { cause });
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("package.json must contain an object");
    }
    return value;
  }

  version() {
    return new AlphaVersion(this.read().version);
  }

  writeVersion(version) {
    if (!(version instanceof AlphaVersion)) throw new Error("package version update requires an AlphaVersion");
    const value = this.read();
    value.version = version.toString();
    const temporaryPath = path.join(
      this.root,
      `.package.json.${process.pid}.${crypto.randomUUID()}.tmp`,
    );
    let descriptor = null;
    let renamed = false;
    try {
      descriptor = fs.openSync(temporaryPath, "wx", 0o644);
      fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = null;
      fs.renameSync(temporaryPath, this.filePath);
      renamed = true;
      descriptor = fs.openSync(this.root, "r");
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = null;
    } catch (error) {
      const cleanupErrors = [];
      if (descriptor !== null) {
        try { fs.closeSync(descriptor); } catch (cleanupError) { cleanupErrors.push(cleanupError); }
      }
      if (!renamed) {
        try { fs.unlinkSync(temporaryPath); } catch (cleanupError) {
          if (cleanupError.code !== "ENOENT") cleanupErrors.push(cleanupError);
        }
      }
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [error, ...cleanupErrors],
          "package version update and temporary-file cleanup both failed",
          { cause: error },
        );
      }
      throw error;
    }
  }
}

export class AlphaReleaseValidator {
  constructor(root = process.cwd()) {
    this.repository = new GitRepository(root);
    this.manifest = new PackageManifest(root);
  }

  validate() {
    return new AlphaReleaseInvariant(
      this.manifest.version(),
      this.repository.commitCount(),
    );
  }
}

export class AlphaReleasePreflight {
  constructor(root = process.cwd()) {
    this.validator = new AlphaReleaseValidator(root);
  }

  run() {
    return this.validator.validate();
  }
}

export class AlphaReleaseSynchronizer {
  constructor(root = process.cwd()) {
    this.repository = new GitRepository(root);
    this.manifest = new PackageManifest(root);
  }

  synchronize() {
    this.repository.assertClean();
    const commitCount = this.repository.commitCount();
    const currentVersion = this.manifest.version();
    if (currentVersion.sequence === commitCount.value) {
      return new AlphaVersionSynchronization({
        status: "already_synchronized",
        version: currentVersion,
        commitCount,
      });
    }
    const finalCommitCount = commitCount.next();
    const version = new AlphaVersion(`0.1.0-alpha.${finalCommitCount.value}`);
    this.manifest.writeVersion(version);
    return new AlphaVersionSynchronization({ status: "updated", version, commitCount: finalCommitCount });
  }
}

export class AlphaReleaseCommand {
  constructor({ label, execute, render }) {
    if (typeof label !== "string" || typeof execute !== "function" || typeof render !== "function") {
      throw new Error("alpha release command configuration is invalid");
    }
    this.label = label;
    this.execute = execute;
    this.render = render;
  }

  run() {
    try {
      const result = this.execute();
      process.stdout.write(`${this.render(result)}\n`);
    } catch (error) {
      process.stderr.write(`[${this.label}] ${error.message || error}\n`);
      process.exitCode = 1;
    }
  }
}
