import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { AtomicJsonFile } from "./atomic-json-file.js";
import { RealDirectoryAuthority } from "./process-owned-lock.js";

const VERSION = 3;
const PHASES = new Set(["staged", "applying", "rolling-back", "rolled-back", "applied"]);

export class OfflineMigrationJournalRemovalError extends Error {
  constructor(message, { cause, phase, journalPath, journal, durabilityUnknown, residue }) {
    super(message, { cause });
    this.name = "OfflineMigrationJournalRemovalError";
    this.code = durabilityUnknown
      ? "OFFLINE_MIGRATION_JOURNAL_DURABILITY_UNCERTAIN"
      : "OFFLINE_MIGRATION_JOURNAL_REMOVE_FAILED";
    this.phase = phase;
    this.journalPath = journalPath;
    this.journal = journal;
    this.durabilityUnknown = durabilityUnknown;
    this.residue = residue;
  }
}

function exactKeys(value, keys, label) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} has an invalid schema`);
}

function hash(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function withinRoot(root, filePath) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`migration authority is outside the repository: ${filePath}`);
  }
  return { resolved, relative: relative.split(path.sep).join("/") };
}

function statRealFile(filePath, label) {
  const stat = fs.lstatSync(filePath);
  if (
    !stat.isFile()
    || stat.isSymbolicLink()
    || stat.nlink !== 1
    || fs.realpathSync(filePath) !== path.resolve(filePath)
  ) {
    throw new Error(`${label} must be one real non-hardlinked file: ${filePath}`);
  }
  return stat;
}

function statRealDirectory(directory, label) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== path.resolve(directory)) {
    throw new Error(`${label} must be a real directory: ${directory}`);
  }
  return stat;
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  let primary = null;
  try {
    fs.fsyncSync(descriptor);
  } catch (error) {
    primary = error;
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch (cleanupError) {
      if (primary) {
        throw new AggregateError([primary, cleanupError], `directory fsync cleanup failed: ${directory}`, { cause: primary });
      }
      throw cleanupError;
    }
  }
  if (primary) throw primary;
}

class OfflineMigrationDirectoryEntry {
  constructor({ name, kind, dev, ino, mode, revision }) {
    if (typeof name !== "string" || name === "" || name.includes("/")) {
      throw new Error("migration directory entry name is invalid");
    }
    if (!["file", "directory", "symlink", "other"].includes(kind)) {
      throw new Error("migration directory entry kind is invalid");
    }
    if (!Number.isSafeInteger(dev) || !Number.isSafeInteger(ino)) {
      throw new Error("migration directory entry identity is invalid");
    }
    if (kind === "file") {
      if (!Number.isSafeInteger(mode) || mode < 0 || mode > 0o777) {
        throw new Error("migration directory entry mode is invalid");
      }
      if (!/^[a-f0-9]{64}$/.test(String(revision))) {
        throw new Error("migration directory entry revision is invalid");
      }
    } else if (mode !== null || revision !== null) {
      throw new Error("non-file migration directory entry cannot have file authority");
    }
    this.name = name;
    this.kind = kind;
    this.dev = dev;
    this.ino = ino;
    this.mode = mode;
    this.revision = revision;
    Object.freeze(this);
  }

  static fromStored(value) {
    exactKeys(value, ["name", "kind", "dev", "ino", "mode", "revision"], "migration directory entry");
    return new OfflineMigrationDirectoryEntry(value);
  }

  toJSON() {
    return {
      name: this.name,
      kind: this.kind,
      dev: this.dev,
      ino: this.ino,
      mode: this.mode,
      revision: this.revision,
    };
  }
}

function directoryEntryKind(stat) {
  if (stat.isFile()) return "file";
  if (stat.isDirectory()) return "directory";
  if (stat.isSymbolicLink()) return "symlink";
  return "other";
}

export class OfflineMigrationDirectorySnapshot {
  constructor({ root, relativePath, includedNames, entries, digest }) {
    this.root = path.resolve(root);
    this.relativePath = relativePath;
    this.includedNames = includedNames == null ? null : Object.freeze([...includedNames].sort());
    this.entries = Object.freeze(entries.map((entry) => (
      entry instanceof OfflineMigrationDirectoryEntry ? entry : OfflineMigrationDirectoryEntry.fromStored(entry)
    )));
    this.digest = digest;
    if (!/^[a-f0-9]{64}$/.test(String(digest))) throw new Error("migration directory snapshot digest is invalid");
  }

  static capture(root, directory, { includedNames = null } = {}) {
    const authorityRoot = path.resolve(root);
    const located = withinRoot(authorityRoot, directory);
    statRealDirectory(located.resolved, "migration closed-world directory");
    const filter = includedNames == null ? null : new Set(includedNames);
    const entries = fs.readdirSync(located.resolved)
      .filter((name) => filter == null || filter.has(name))
      .sort()
      .map((name) => {
        const filePath = path.join(located.resolved, name);
        const stat = fs.lstatSync(filePath);
        const kind = directoryEntryKind(stat);
        return new OfflineMigrationDirectoryEntry({
          name,
          kind,
          dev: stat.dev,
          ino: stat.ino,
          mode: kind === "file" ? stat.mode & 0o777 : null,
          revision: kind === "file" ? hash(fs.readFileSync(filePath)) : null,
        });
      });
    return new OfflineMigrationDirectorySnapshot({
      root: authorityRoot,
      relativePath: located.relative,
      includedNames: includedNames == null ? null : [...filter].sort(),
      entries,
      digest: hash(Buffer.from(JSON.stringify(entries.map((entry) => entry.toJSON())))),
    });
  }

  static fromStored(root, value) {
    exactKeys(value, ["relativePath", "includedNames", "entries", "digest"], "migration directory snapshot");
    if (value.includedNames != null && !Array.isArray(value.includedNames)) {
      throw new Error("migration directory snapshot includedNames is invalid");
    }
    if (!Array.isArray(value.entries)) throw new Error("migration directory snapshot entries are invalid");
    withinRoot(root, path.join(root, value.relativePath));
    const snapshot = new OfflineMigrationDirectorySnapshot({ root, ...value });
    const calculated = hash(Buffer.from(JSON.stringify(snapshot.entries.map((entry) => entry.toJSON()))));
    if (calculated !== snapshot.digest) throw new Error("migration directory snapshot digest does not match entries");
    return snapshot;
  }

  assertUnchanged({ identity = true, mutablePaths = [] } = {}) {
    const current = OfflineMigrationDirectorySnapshot.capture(
      this.root,
      path.join(this.root, this.relativePath),
      { includedNames: this.includedNames },
    );
    const mutable = new Set(mutablePaths);
    const project = (entry) => {
      const relativePath = path.posix.join(this.relativePath, entry.name);
      if (mutable.has(relativePath)) return { name: entry.name, kind: entry.kind };
      const authority = {
        name: entry.name,
        kind: entry.kind,
        mode: entry.mode,
        revision: entry.revision,
      };
      if (identity) {
        authority.dev = entry.dev;
        authority.ino = entry.ino;
      }
      return authority;
    };
    const expected = this.entries.map(project);
    const actual = current.entries.map(project);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`migration closed-world snapshot changed after planning: ${this.relativePath}`);
    }
  }

  toJSON() {
    return {
      relativePath: this.relativePath,
      includedNames: this.includedNames,
      entries: this.entries.map((entry) => entry.toJSON()),
      digest: this.digest,
    };
  }
}

class AtomicBytesFile {
  constructor(filePath) {
    this.filePath = filePath;
    this.directory = path.dirname(filePath);
    this.authority = new RealDirectoryAuthority(this.directory);
  }

  write(bytes, mode) {
    this.authority.assertStable();
    const tempPath = path.join(this.directory, `.${path.basename(this.filePath)}.${crypto.randomUUID()}.migration.tmp`);
    let descriptor = null;
    let renamed = false;
    try {
      descriptor = fs.openSync(tempPath, "wx", mode);
      fs.writeFileSync(descriptor, bytes);
      fs.fchmodSync(descriptor, mode);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = null;
      this.authority.assertStable();
      fs.renameSync(tempPath, this.filePath);
      renamed = true;
      fsyncDirectory(this.directory);
    } catch (primary) {
      const cleanup = [];
      if (descriptor != null) {
        try { fs.closeSync(descriptor); } catch (error) { cleanup.push(error); }
      }
      if (!renamed) {
        try { fs.unlinkSync(tempPath); } catch (error) {
          if (error.code !== "ENOENT") cleanup.push(error);
        }
      }
      if (cleanup.length > 0) {
        throw new AggregateError([primary, ...cleanup], `migration write and cleanup failed: ${this.filePath}`, { cause: primary });
      }
      throw primary;
    }
  }
}

export class OfflineMigrationAuthority {
  constructor({ root, relativePath, kind, dev, ino, mode, revision }) {
    this.root = path.resolve(root);
    this.relativePath = relativePath;
    this.kind = kind;
    this.dev = dev;
    this.ino = ino;
    this.mode = mode;
    this.revision = revision;
  }

  static capture(root, filePath, kind) {
    const authorityRoot = path.resolve(root);
    const located = withinRoot(authorityRoot, filePath);
    const stat = kind === "directory"
      ? statRealDirectory(located.resolved, "migration directory authority")
      : statRealFile(located.resolved, "migration file authority");
    const revision = kind === "directory" ? null : hash(fs.readFileSync(located.resolved));
    return new OfflineMigrationAuthority({
      root: authorityRoot,
      relativePath: located.relative,
      kind,
      dev: stat.dev,
      ino: stat.ino,
      mode: stat.mode & 0o777,
      revision,
    });
  }

  static fromStored(root, value) {
    exactKeys(value, ["relativePath", "kind", "dev", "ino", "mode", "revision"], "migration authority");
    if (!['directory', 'file'].includes(value.kind)) throw new Error("migration authority kind is invalid");
    if (![value.dev, value.ino, value.mode].every(Number.isSafeInteger)) throw new Error("migration authority identity is invalid");
    if (value.kind === "file" && !/^[a-f0-9]{64}$/.test(value.revision)) throw new Error("migration authority revision is invalid");
    if (value.kind === "directory" && value.revision !== null) throw new Error("directory authority revision must be null");
    withinRoot(root, path.join(root, value.relativePath));
    return new OfflineMigrationAuthority({ root, ...value });
  }

  assertUnchanged() {
    const filePath = path.join(this.root, this.relativePath);
    const stat = this.kind === "directory"
      ? statRealDirectory(filePath, "migration directory authority")
      : statRealFile(filePath, "migration file authority");
    if (stat.dev !== this.dev || stat.ino !== this.ino || (stat.mode & 0o777) !== this.mode) {
      throw new Error(`migration authority identity changed: ${this.relativePath}`);
    }
    if (this.kind === "file" && hash(fs.readFileSync(filePath)) !== this.revision) {
      throw new Error(`migration authority content changed: ${this.relativePath}`);
    }
  }

  toJSON() {
    return {
      relativePath: this.relativePath,
      kind: this.kind,
      dev: this.dev,
      ino: this.ino,
      mode: this.mode,
      revision: this.revision,
    };
  }
}

export class OfflineMigrationTarget {
  constructor({ root, relativePath, original, planned, mode, dev, ino }) {
    this.root = path.resolve(root);
    this.relativePath = relativePath;
    this.original = Buffer.from(original);
    this.planned = Buffer.from(planned);
    this.mode = mode;
    this.dev = dev;
    this.ino = ino;
    this.originalRevision = hash(this.original);
    this.plannedRevision = hash(this.planned);
  }

  static capture(root, filePath, planned) {
    const authorityRoot = path.resolve(root);
    const located = withinRoot(authorityRoot, filePath);
    const stat = statRealFile(located.resolved, "migration target");
    return new OfflineMigrationTarget({
      root: authorityRoot,
      relativePath: located.relative,
      original: fs.readFileSync(located.resolved),
      planned,
      mode: stat.mode & 0o777,
      dev: stat.dev,
      ino: stat.ino,
    });
  }

  static fromStored(root, value) {
    exactKeys(value, [
      "relativePath", "original", "planned", "mode", "dev", "ino",
      "originalRevision", "plannedRevision",
    ], "migration target");
    if (![value.mode, value.dev, value.ino].every(Number.isSafeInteger)) throw new Error("migration target identity is invalid");
    withinRoot(root, path.join(root, value.relativePath));
    const target = new OfflineMigrationTarget({
      root,
      relativePath: value.relativePath,
      original: Buffer.from(value.original, "base64"),
      planned: Buffer.from(value.planned, "base64"),
      mode: value.mode,
      dev: value.dev,
      ino: value.ino,
    });
    if (target.originalRevision !== value.originalRevision || target.plannedRevision !== value.plannedRevision) {
      throw new Error(`migration target bytes do not match revisions: ${value.relativePath}`);
    }
    return target;
  }

  get filePath() {
    return path.join(this.root, this.relativePath);
  }

  assertInitialIdentity() {
    const stat = statRealFile(this.filePath, "migration target");
    if (stat.dev !== this.dev || stat.ino !== this.ino || (stat.mode & 0o777) !== this.mode) {
      throw new Error(`migration target identity changed before apply: ${this.relativePath}`);
    }
    if (this.classify() !== "original") throw new Error(`migration target changed before apply: ${this.relativePath}`);
  }

  classify() {
    const stat = statRealFile(this.filePath, "migration target");
    if ((stat.mode & 0o777) !== this.mode) return "foreign";
    const bytes = fs.readFileSync(this.filePath);
    if (bytes.equals(this.original)) return "original";
    if (bytes.equals(this.planned)) return "planned";
    return "foreign";
  }

  writeOriginal() {
    new AtomicBytesFile(this.filePath).write(this.original, this.mode);
  }

  writePlanned() {
    new AtomicBytesFile(this.filePath).write(this.planned, this.mode);
  }

  toJSON() {
    return {
      relativePath: this.relativePath,
      original: this.original.toString("base64"),
      planned: this.planned.toString("base64"),
      mode: this.mode,
      dev: this.dev,
      ino: this.ino,
      originalRevision: this.originalRevision,
      plannedRevision: this.plannedRevision,
    };
  }
}

class MigrationJournal {
  constructor({ name, root, phase, applyIndex, rollbackIndex, authorities, snapshots, targets, updatedAt }) {
    if (typeof name !== "string" || name === "") throw new Error("migration journal name is invalid");
    if (!PHASES.has(phase)) throw new Error(`migration journal phase is invalid: ${phase}`);
    if (!Number.isSafeInteger(applyIndex) || !Number.isSafeInteger(rollbackIndex)) {
      throw new Error("migration journal indexes are invalid");
    }
    this.name = name;
    this.root = path.resolve(root);
    this.phase = phase;
    this.applyIndex = applyIndex;
    this.rollbackIndex = rollbackIndex;
    this.authorities = authorities;
    this.snapshots = snapshots;
    this.targets = targets;
    this.updatedAt = updatedAt;
    if (typeof updatedAt !== "string" || updatedAt === "") throw new Error("migration journal updatedAt is invalid");
    if (applyIndex < 0 || applyIndex > targets.length || rollbackIndex < -1 || rollbackIndex >= targets.length) {
      throw new Error("migration journal indexes are out of range");
    }
  }

  static create(name, root, authorities, snapshots, targets) {
    return new MigrationJournal({
      name,
      root,
      phase: "staged",
      applyIndex: 0,
      rollbackIndex: targets.length - 1,
      authorities,
      snapshots,
      targets,
      updatedAt: new Date().toISOString(),
    });
  }

  static fromStored(name, root, value) {
    exactKeys(value, [
      "version", "name", "root", "phase", "applyIndex", "rollbackIndex",
      "authorities", "snapshots", "targets", "updatedAt",
    ], "migration journal");
    if (value.version !== VERSION || value.name !== name || path.resolve(value.root) !== path.resolve(root)) {
      throw new Error("migration journal targets a different authority");
    }
    if (!Array.isArray(value.authorities) || !Array.isArray(value.snapshots) || !Array.isArray(value.targets)) {
      throw new Error("migration journal lists are invalid");
    }
    const authorities = value.authorities.map((item) => OfflineMigrationAuthority.fromStored(root, item));
    const snapshots = value.snapshots.map((item) => OfflineMigrationDirectorySnapshot.fromStored(root, item));
    const targets = value.targets.map((item) => OfflineMigrationTarget.fromStored(root, item));
    if (new Set(targets.map((target) => target.relativePath)).size !== targets.length) {
      throw new Error("migration journal contains duplicate targets");
    }
    return new MigrationJournal({ ...value, root, authorities, snapshots, targets });
  }

  advance(phase, { applyIndex = this.applyIndex, rollbackIndex = this.rollbackIndex } = {}) {
    this.phase = phase;
    this.applyIndex = applyIndex;
    this.rollbackIndex = rollbackIndex;
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      version: VERSION,
      name: this.name,
      root: this.root,
      phase: this.phase,
      applyIndex: this.applyIndex,
      rollbackIndex: this.rollbackIndex,
      authorities: this.authorities.map((item) => item.toJSON()),
      snapshots: this.snapshots.map((item) => item.toJSON()),
      targets: this.targets.map((item) => item.toJSON()),
      updatedAt: this.updatedAt,
    };
  }
}

class MigrationJournalStore {
  constructor(root, relativePath) {
    const located = withinRoot(path.resolve(root), path.join(root, relativePath));
    this.path = located.resolved;
    const senti = new RealDirectoryAuthority(path.join(root, ".senti"));
    senti.ensure();
    this.directoryAuthority = new RealDirectoryAuthority(path.dirname(this.path), {
      create: true,
      parentAuthority: senti,
    });
    this.directoryAuthority.ensure();
    this.file = new AtomicJsonFile(this.path);
  }

  exists() {
    try {
      const stat = fs.lstatSync(this.path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs.realpathSync(this.path) !== this.path) {
        throw new Error(`migration journal must be one real non-hardlinked file: ${this.path}`);
      }
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }

  read(name, root) {
    if (!this.exists()) return null;
    return MigrationJournal.fromStored(name, root, this.file.read(null));
  }

  write(journal) {
    this.file.write(journal.toJSON());
  }

  remove(journal) {
    let unlinked = false;
    try {
      fs.unlinkSync(this.path);
      unlinked = true;
      fsyncDirectory(path.dirname(this.path));
    } catch (cause) {
      let residue = true;
      try {
        fs.lstatSync(this.path);
      } catch (error) {
        if (error.code === "ENOENT") residue = false;
        else {
          throw new AggregateError(
            [cause, error],
            `migration journal removal and residue inspection both failed: ${this.path}`,
            { cause },
          );
        }
      }
      throw new OfflineMigrationJournalRemovalError(
        `migration journal removal failed during ${unlinked ? "directory-fsync" : "unlink"}: ${this.path}`,
        {
          cause,
          phase: unlinked ? "journal-remove-directory-fsync" : "journal-remove-unlink",
          journalPath: this.path,
          journal: journal.toJSON(),
          durabilityUnknown: unlinked,
          residue,
        },
      );
    }
  }
}

export class OfflineMigrationTransaction {
  constructor({ root, name, journalPath, authorities, snapshots = [], targets }) {
    this.root = path.resolve(root);
    this.name = name;
    this.store = new MigrationJournalStore(this.root, journalPath);
    this.journal = MigrationJournal.create(name, this.root, authorities, snapshots, targets);
  }

  static recover({ root, name, journalPath }) {
    const authorityRoot = path.resolve(root);
    const store = new MigrationJournalStore(authorityRoot, journalPath);
    const journal = store.read(name, authorityRoot);
    if (!journal) return { recovered: false, completed: false };
    const transaction = new OfflineMigrationTransaction({
      root: authorityRoot,
      name,
      journalPath,
      authorities: journal.authorities,
      snapshots: journal.snapshots,
      targets: journal.targets,
    });
    transaction.store = store;
    transaction.journal = journal;
    return transaction.#recover();
  }

  apply() {
    if (this.store.exists()) throw new Error(`migration journal already exists: ${this.store.path}`);
    for (const authority of this.journal.authorities) authority.assertUnchanged();
    for (const snapshot of this.journal.snapshots) snapshot.assertUnchanged();
    for (const target of this.journal.targets) target.assertInitialIdentity();
    this.store.write(this.journal);
    this.journal.advance("applying");
    this.store.write(this.journal);
    let primary = null;
    try {
      for (let index = 0; index < this.journal.targets.length; index += 1) {
        const target = this.journal.targets[index];
        if (target.classify() !== "original") throw new Error(`migration target is not original: ${target.relativePath}`);
        target.writePlanned();
        if (target.classify() !== "planned") throw new Error(`migration target write was not durable: ${target.relativePath}`);
        this.journal.advance("applying", { applyIndex: index + 1 });
        this.store.write(this.journal);
      }
      this.journal.advance("applied", { applyIndex: this.journal.targets.length, rollbackIndex: -1 });
      this.store.write(this.journal);
    } catch (error) {
      primary = error;
    }
    if (!primary) {
      this.store.remove(this.journal);
      return;
    }
    try {
      this.#rollback();
    } catch (rollbackError) {
      throw new AggregateError(
        [primary, rollbackError],
        "migration apply and rollback both failed",
        { cause: primary },
      );
    }
    throw primary;
  }

  #recover() {
    for (const authority of this.journal.authorities) authority.assertUnchanged();
    const mutablePaths = this.journal.targets.map((target) => target.relativePath);
    for (const snapshot of this.journal.snapshots) {
      snapshot.assertUnchanged({ identity: false, mutablePaths });
    }
    if (this.journal.phase === "applied") {
      for (const target of this.journal.targets) {
        if (target.classify() !== "planned") throw new Error(`applied migration target is foreign: ${target.relativePath}`);
      }
      this.store.remove(this.journal);
      return { recovered: true, completed: true };
    }
    if (this.journal.phase === "rolled-back") {
      for (const target of this.journal.targets) {
        if (target.classify() !== "original") throw new Error(`rolled-back migration target is foreign: ${target.relativePath}`);
      }
      this.store.remove(this.journal);
      return { recovered: true, completed: false };
    }
    if (this.journal.phase === "rolling-back") {
      this.#continueRollback();
      this.store.remove(this.journal);
      return { recovered: true, completed: false };
    }
    if (this.journal.phase === "staged") {
      for (const target of this.journal.targets) {
        if (target.classify() !== "original") {
          throw new Error(`staged migration target is foreign: ${target.relativePath}`);
        }
      }
      this.#rollback();
      this.store.remove(this.journal);
      return { recovered: true, completed: false };
    }

    let contiguousPlanned = 0;
    for (let index = 0; index < this.journal.targets.length; index += 1) {
      const target = this.journal.targets[index];
      const state = target.classify();
      if (state === "planned" && contiguousPlanned === index) contiguousPlanned += 1;
      else if (state !== "original") throw new Error(`migration recovery target is foreign: ${target.relativePath}`);
    }
    if (contiguousPlanned < this.journal.applyIndex) {
      throw new Error("migration recovery lost journaled apply progress");
    }
    if (contiguousPlanned > this.journal.applyIndex) {
      this.journal.advance("applying", { applyIndex: contiguousPlanned });
      this.store.write(this.journal);
    }
    if (contiguousPlanned === this.journal.targets.length) {
      this.journal.advance("applied", { applyIndex: contiguousPlanned, rollbackIndex: -1 });
      this.store.write(this.journal);
      this.store.remove(this.journal);
      return { recovered: true, completed: true };
    }
    this.#rollback();
    this.store.remove(this.journal);
    return { recovered: true, completed: false };
  }

  #rollback() {
    this.journal.advance("rolling-back", { rollbackIndex: this.journal.targets.length - 1 });
    this.store.write(this.journal);
    this.#continueRollback();
  }

  #continueRollback() {
    for (let index = this.journal.targets.length - 1; index > this.journal.rollbackIndex; index -= 1) {
      const state = this.journal.targets[index].classify();
      if (state !== "original") {
        throw new Error(`completed migration rollback target is foreign: ${this.journal.targets[index].relativePath}`);
      }
    }
    for (let index = this.journal.rollbackIndex; index >= 0; index -= 1) {
      const target = this.journal.targets[index];
      const state = target.classify();
      if (state === "foreign") throw new Error(`migration rollback target is foreign: ${target.relativePath}`);
      if (state === "planned") target.writeOriginal();
      if (target.classify() !== "original") throw new Error(`migration rollback was not durable: ${target.relativePath}`);
      this.journal.advance("rolling-back", { rollbackIndex: index - 1 });
      this.store.write(this.journal);
    }
    this.journal.advance("rolled-back", { applyIndex: 0, rollbackIndex: -1 });
    this.store.write(this.journal);
  }
}
