import fs from "node:fs";
import path from "node:path";

const LIMIT_KINDS = new Set(["depth", "directory-entries", "files", "unreadable"]);

export class ScanPolicy {
  constructor({
    maxDepth = 32,
    maxDirectoryEntries = 10_000,
    maxFiles = 10_000,
  } = {}) {
    for (const [name, value] of Object.entries({ maxDepth, maxDirectoryEntries, maxFiles })) {
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error(`ScanPolicy ${name} must be a positive safe integer`);
      }
    }
    this.maxDepth = maxDepth;
    this.maxDirectoryEntries = maxDirectoryEntries;
    this.maxFiles = maxFiles;
    Object.freeze(this);
  }
}

export const DEFAULT_SCAN_POLICY = new ScanPolicy();

export class TraversalLimit {
  constructor(kind, relativePath, maximum) {
    if (!LIMIT_KINDS.has(kind)) throw new Error(`unsupported traversal limit: ${kind}`);
    this.kind = kind;
    this.relativePath = relativePath || ".";
    this.maximum = maximum;
    Object.freeze(this);
  }

  toString() {
    if (this.kind === "unreadable") return `unreadable path ${this.relativePath}`;
    return `${this.kind} limit ${this.maximum} at ${this.relativePath}`;
  }
}

export class FileTreeWalkResult {
  constructor(files, limits) {
    this.files = Object.freeze([...files]);
    this.limits = Object.freeze([...limits]);
    Object.freeze(this);
  }

  get complete() {
    return this.limits.length === 0;
  }

  describeLimits() {
    return this.limits.map((limit) => limit.toString()).join(", ");
  }

  assertComplete(context = "file tree traversal") {
    if (!this.complete) {
      throw new Error(`${context} is indeterminate: ${this.describeLimits()}`);
    }
    return this;
  }
}

function normalizeRelative(relativePath) {
  return relativePath.split(path.sep).join("/");
}

export class FileTreeWalker {
  constructor(policy = DEFAULT_SCAN_POLICY) {
    if (!(policy instanceof ScanPolicy)) {
      throw new Error("FileTreeWalker requires a ScanPolicy");
    }
    this.policy = policy;
    Object.freeze(this);
  }

  walk(root, { includeFile = () => true, shouldEnterDirectory = () => true } = {}) {
    const files = [];
    const limits = [];
    let fileLimitReached = false;

    const recordLimit = (kind, relativePath, maximum) => {
      limits.push(new TraversalLimit(kind, normalizeRelative(relativePath), maximum));
    };

    const walkDirectory = (directory, relativeDirectory, depth) => {
      if (fileLimitReached) return;
      if (depth > this.policy.maxDepth) {
        recordLimit("depth", relativeDirectory, this.policy.maxDepth);
        return;
      }

      let entries;
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true })
          .sort((a, b) => a.name.localeCompare(b.name));
      } catch (err) {
        if (err.code === "ENOENT") return;
        recordLimit("unreadable", relativeDirectory, null);
        return;
      }

      if (entries.length > this.policy.maxDirectoryEntries) {
        recordLimit("directory-entries", relativeDirectory, this.policy.maxDirectoryEntries);
        entries = entries.slice(0, this.policy.maxDirectoryEntries);
      }

      for (const entry of entries) {
        if (fileLimitReached) return;
        const relativePath = relativeDirectory
          ? `${relativeDirectory}/${entry.name}`
          : entry.name;
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (shouldEnterDirectory(relativePath, absolutePath)) {
            walkDirectory(absolutePath, relativePath, depth + 1);
          }
        } else if (entry.isFile() && includeFile(relativePath, absolutePath)) {
          if (files.length === this.policy.maxFiles) {
            recordLimit("files", relativePath, this.policy.maxFiles);
            fileLimitReached = true;
            return;
          }
          files.push(normalizeRelative(relativePath));
        }
      }
    };

    walkDirectory(root, "", 0);
    return new FileTreeWalkResult(files, limits);
  }
}
