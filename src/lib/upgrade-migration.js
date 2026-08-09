/**
 * Explicit, one-way managed-directory migration for `senrail upgrade --migrate`.
 *
 * Normal runtime deliberately does not import this module. Legacy names are
 * confined here so opening a current project never creates a compatibility
 * path by accident.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { AtomicFile, fsyncDirectory } from "./atomic-file.js";
import { loadConfigFromManagedDirectory, loadRawConfigFromManagedDirectory } from "./config.js";
import { migrateLegacyManagedGitattributes } from "./gitattributes.js";
import { migrateLegacyManagedGitignore } from "./gitignore.js";
import { PRODUCT } from "./product.js";

const LEGACY_DIRECTORY_NAMES = Object.freeze([".sdd-forge", ".senti"]);
const STAGING_PREFIX = "senrail-upgrade-migrate-";
const JOURNAL_FILE_NAME = "senrail-upgrade-migrate.json";
const JOURNAL_VERSION = 1;
const JOURNAL_PHASES = new Set([
  "staged",
  "legacy-backed-up",
  "placed-senti",
  "metadata-updated",
  "final-renamed",
]);
const RAW_COPY_ROOTS = new Set(["plugins", "plugin-sources"]);
const MANAGED_TEMPLATE_FIELD_REPLACEMENTS = Object.freeze(new Map([
  // These were public names in generated template guidance. They are not
  // arbitrary camel-case words: each maps to the current container path key.
  ["sentiDir", "managedDir"],
]));

function relativePath(root, filePath) {
  const relative = path.relative(root, filePath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`migration path escapes the project root: ${filePath}`);
  }
  return relative.split(path.sep).join("/");
}

function lstatOrNull(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function assertRealDirectory(directory, label) {
  const stat = lstatOrNull(directory);
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== path.resolve(directory)) {
    throw new Error(`${label} must be a real directory: ${directory}`);
  }
  return stat;
}

function assertRegularFile(filePath, label) {
  const stat = lstatOrNull(filePath);
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file: ${filePath}`);
  }
  return stat;
}

function directoryIdentity(directory, label) {
  const stat = assertRealDirectory(directory, label);
  return { dev: stat.dev, ino: stat.ino };
}

function sameDirectoryIdentity(directory, identity, label) {
  const stat = assertRealDirectory(directory, label);
  return stat.dev === identity.dev && stat.ino === identity.ino;
}

function removeTree(directory, label) {
  const stat = lstatOrNull(directory);
  if (!stat) return;
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link: ${directory}`);
  fs.rmSync(directory, { recursive: true, force: true });
}

function legacyTokenToCanonical(value) {
  let transformed = value;
  for (const [legacy, canonical] of MANAGED_TEMPLATE_FIELD_REPLACEMENTS) {
    transformed = transformed.replaceAll(legacy, canonical);
  }
  return transformed
    .replace(/(?<![A-Za-z0-9_])sdd-forge(?=$|[^A-Za-z0-9_])/g, PRODUCT.machineName)
    .replace(/(?<![A-Za-z0-9_])sddForge(?=$|[A-Z]|[^A-Za-z0-9_])/g, PRODUCT.machineName)
    .replace(/(?<![A-Za-z0-9_])senti(?=$|[A-Z]|[^A-Za-z0-9_])/g, PRODUCT.machineName)
    .replace(/(?<![A-Za-z0-9_])SddForge(?=$|[A-Z]|[^A-Za-z0-9_])/g, PRODUCT.displayName)
    .replace(/(?<![A-Za-z0-9_])Senti(?=$|[A-Z]|[^A-Za-z0-9_])/g, PRODUCT.displayName)
    .replace(/(?<![A-Za-z0-9_])SDD_FORGE(?=$|[^A-Za-z0-9_])/g, PRODUCT.machineName.toUpperCase())
    // An underscore is a word character here, intentionally preserving
    // project-owned SENTI_* environment variable names.
    .replace(/(?<![A-Za-z0-9_])SENTI(?=$|[^A-Za-z0-9_])/g, PRODUCT.machineName.toUpperCase());
}

function isRawCopyPath(relative) {
  return RAW_COPY_ROOTS.has(relative.split("/")[0]);
}

function transformedRelativePath(relative) {
  if (relative === "" || isRawCopyPath(relative) || !relative.startsWith("templates/")) return relative;
  return relative.split("/").map(legacyTokenToCanonical).join("/");
}

function transformedLinkTarget(target) {
  return target.split(/([/\\])/).map((component) => {
    if (component === ".sdd-forge" || component === ".senti") return PRODUCT.managedDirName;
    return component;
  }).join("");
}

function isManagedMarkdown(relative) {
  return relative.startsWith("templates/") && /\.md$/i.test(relative);
}

function transformManagedMarkdown(content) {
  return legacyTokenToCanonical(content);
}

function hashBytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function transformedFileBytes(relative, bytes) {
  return isManagedMarkdown(relative)
    ? Buffer.from(transformManagedMarkdown(bytes.toString("utf8")), "utf8")
    : bytes;
}

class SourceTreeSnapshot {
  constructor({ rootIdentity, rootMode, entries }) {
    this.rootIdentity = Object.freeze({ ...rootIdentity });
    this.rootMode = rootMode;
    this.entries = Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
    this.serialized = JSON.stringify({ rootIdentity: this.rootIdentity, rootMode: this.rootMode, entries: this.entries });
    Object.freeze(this.entries);
    Object.freeze(this);
  }

  static capture(root) {
    const rootStat = assertRealDirectory(root, "legacy managed directory");
    const entries = [];
    const targetPaths = new Set();
    const visit = (directory, relative = "") => {
      const names = fs.readdirSync(directory).sort((left, right) => left.localeCompare(right));
      for (const name of names) {
        const source = path.join(directory, name);
        const childRelative = relative === "" ? name : `${relative}/${name}`;
        const stat = fs.lstatSync(source);
        const targetPath = transformedRelativePath(childRelative);
        if (targetPaths.has(targetPath)) {
          throw new Error(`migration path collision: ${childRelative} maps to ${targetPath}`);
        }
        targetPaths.add(targetPath);
        if (stat.isDirectory()) {
          if (stat.isSymbolicLink()) throw new Error(`managed directory contains a symbolic-link directory: ${childRelative}`);
          entries.push({
            path: childRelative,
            targetPath,
            kind: "directory",
            dev: stat.dev,
            ino: stat.ino,
            mode: stat.mode & 0o777,
          });
          visit(source, childRelative);
        } else if (stat.isFile()) {
          const bytes = fs.readFileSync(source);
          const transformed = transformedFileBytes(childRelative, bytes);
          entries.push({
            path: childRelative,
            targetPath,
            kind: "file",
            dev: stat.dev,
            ino: stat.ino,
            mode: stat.mode & 0o777,
            hash: hashBytes(bytes),
            transformedHash: hashBytes(transformed),
          });
        } else if (stat.isSymbolicLink()) {
          entries.push({
            path: childRelative,
            targetPath,
            kind: "symlink",
            target: fs.readlinkSync(source),
            transformedTarget: transformedLinkTarget(fs.readlinkSync(source)),
          });
        } else {
          throw new Error(`managed directory contains an unsupported entry: ${childRelative}`);
        }
      }
    };
    visit(root);
    return new SourceTreeSnapshot({
      rootIdentity: { dev: rootStat.dev, ino: rootStat.ino },
      rootMode: rootStat.mode & 0o777,
      entries,
    });
  }

  get treePlan() {
    return { entries: this.entries.length, outputs: this.entries.map((entry) => entry.targetPath).sort() };
  }

  assertUnchanged(root) {
    const current = SourceTreeSnapshot.capture(root);
    if (current.serialized !== this.serialized) {
      throw new Error("legacy managed directory changed while migration staging was in progress");
    }
  }

  assertStaged(root) {
    const rootStat = assertRealDirectory(root, "migration staged directory");
    if ((rootStat.mode & 0o777) !== this.rootMode) {
      throw new Error("migration staged tree does not preserve the managed root directory mode");
    }
    const actual = [];
    const visit = (directory, relative = "") => {
      for (const name of fs.readdirSync(directory).sort((left, right) => left.localeCompare(right))) {
        const target = path.join(directory, name);
        const childRelative = relative === "" ? name : `${relative}/${name}`;
        const stat = fs.lstatSync(target);
        if (stat.isDirectory()) {
          if (stat.isSymbolicLink()) throw new Error(`migration staged tree has a symbolic-link directory: ${childRelative}`);
          actual.push({ path: childRelative, kind: "directory", mode: stat.mode & 0o777 });
          visit(target, childRelative);
        } else if (stat.isFile()) {
          actual.push({
            path: childRelative,
            kind: "file",
            mode: stat.mode & 0o777,
            hash: hashBytes(fs.readFileSync(target)),
          });
        } else if (stat.isSymbolicLink()) {
          actual.push({ path: childRelative, kind: "symlink", target: fs.readlinkSync(target) });
        } else {
          throw new Error(`migration staged tree contains an unsupported entry: ${childRelative}`);
        }
      }
    };
    visit(root);
    const expected = this.entries.map((entry) => {
      if (entry.kind === "directory") {
        return { path: entry.targetPath, kind: entry.kind, mode: entry.mode };
      }
      if (entry.kind === "file") {
        return { path: entry.targetPath, kind: entry.kind, mode: entry.mode, hash: entry.transformedHash };
      }
      return { path: entry.targetPath, kind: entry.kind, target: entry.transformedTarget };
    });
    const comparePath = (left, right) => left.path.localeCompare(right.path);
    const serializedActual = JSON.stringify(actual.sort(comparePath));
    if (serializedActual !== JSON.stringify(expected.sort(comparePath))) {
      throw new Error("migration staged tree does not match the source-derived transformation");
    }
  }
}

class RootMetadataFile {
  constructor({ root, name, existed, original, planned }) {
    this.root = root;
    this.name = name;
    this.existed = existed;
    this.original = Buffer.from(original);
    this.planned = Buffer.from(planned);
    Object.freeze(this);
  }

  get filePath() {
    return path.join(this.root, this.name);
  }

  static plan(root, name, transform) {
    const filePath = path.join(root, name);
    const stat = lstatOrNull(filePath);
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) {
      throw new Error(`root metadata file must be a regular file: ${name}`);
    }
    const original = stat ? fs.readFileSync(filePath) : Buffer.alloc(0);
    const planned = Buffer.from(transform(original.toString("utf8")), "utf8");
    return new RootMetadataFile({ root, name, existed: Boolean(stat), original, planned });
  }

  static fromJSON(root, value) {
    const keys = value && typeof value === "object" ? Object.keys(value).sort() : [];
    if (JSON.stringify(keys) !== JSON.stringify(["existed", "name", "original", "planned"])
      || typeof value.name !== "string" || typeof value.existed !== "boolean"
      || typeof value.original !== "string" || typeof value.planned !== "string") {
      throw new Error("migration root metadata journal entry is invalid");
    }
    return new RootMetadataFile({
      root,
      name: value.name,
      existed: value.existed,
      original: Buffer.from(value.original, "base64"),
      planned: Buffer.from(value.planned, "base64"),
    });
  }

  toJSON() {
    return {
      name: this.name,
      existed: this.existed,
      original: this.original.toString("base64"),
      planned: this.planned.toString("base64"),
    };
  }

  stage(stagingRoot) {
    fs.writeFileSync(path.join(stagingRoot, this.name), this.planned, "utf8");
  }

  #assertExact(expected) {
    const stat = lstatOrNull(this.filePath);
    if (!expected) {
      if (stat) throw new Error(`root metadata appeared before migration: ${this.name}`);
      return false;
    }
    if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`root metadata changed before migration: ${this.name}`);
    }
    if (!fs.readFileSync(this.filePath).equals(expected)) {
      throw new Error(`root metadata content changed before migration: ${this.name}`);
    }
    return true;
  }

  assertOriginal() {
    return this.#assertExact(this.existed ? this.original : null);
  }

  #assertRestorable() {
    const stat = lstatOrNull(this.filePath);
    if (this.existed) {
      if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`cannot restore root metadata with changed authority: ${this.name}`);
      }
      const current = fs.readFileSync(this.filePath);
      if (!current.equals(this.planned) && !current.equals(this.original)) {
        throw new Error(`cannot restore root metadata changed by another process: ${this.name}`);
      }
      return true;
    }
    if (!stat) return false;
    if (!stat.isFile() || stat.isSymbolicLink() || !fs.readFileSync(this.filePath).equals(this.planned)) {
      throw new Error(`cannot remove root metadata changed by another process: ${this.name}`);
    }
    return true;
  }

  apply() {
    this.assertOriginal();
    new AtomicFile(this.filePath, {
      phaseNamespace: "upgrade-migration-metadata",
      commitGuard: () => this.assertOriginal(),
    }).write(this.planned);
  }

  restore() {
    const present = this.#assertRestorable();
    if (this.existed) {
      new AtomicFile(this.filePath, {
        phaseNamespace: "upgrade-migration-metadata-restore",
        commitGuard: () => this.#assertRestorable(),
      }).write(this.original);
      return;
    }
    if (!present) return;
    new AtomicFile(this.filePath, {
      phaseNamespace: "upgrade-migration-metadata-restore",
      commitGuard: () => this.#assertRestorable(),
    }).remove();
  }
}

class UpgradeMigrationJournal {
  constructor({ root, sourceName, stagingRelative, sourceIdentity, stagedSentiIdentity, metadata, tempRootCreated, phase = "staged" }) {
    if (!LEGACY_DIRECTORY_NAMES.includes(sourceName)) throw new Error("migration journal source directory is invalid");
    if (!JOURNAL_PHASES.has(phase)) throw new Error(`migration journal phase is invalid: ${phase}`);
    if (!new RegExp(`^\\.tmp/${STAGING_PREFIX}[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).test(stagingRelative)) {
      throw new Error("migration journal staging path is invalid");
    }
    for (const identity of [sourceIdentity, stagedSentiIdentity]) {
      if (!identity || JSON.stringify(Object.keys(identity).sort()) !== JSON.stringify(["dev", "ino"])
        || !Number.isSafeInteger(identity.dev) || !Number.isSafeInteger(identity.ino)) {
        throw new Error("migration journal directory identity is invalid");
      }
    }
    if (typeof tempRootCreated !== "boolean") throw new Error("migration journal temporary-directory state is invalid");
    const metadataNames = metadata.map((entry) => entry.name).sort();
    if (JSON.stringify(metadataNames) !== JSON.stringify([".gitattributes", ".gitignore"])) {
      throw new Error("migration journal metadata authority is invalid");
    }
    this.root = path.resolve(root);
    if (relativePath(this.root, path.join(this.root, stagingRelative)) !== stagingRelative) {
      throw new Error("migration journal staging path escapes the project root");
    }
    this.sourceName = sourceName;
    this.stagingRelative = stagingRelative;
    this.sourceIdentity = sourceIdentity;
    this.stagedSentiIdentity = stagedSentiIdentity;
    this.metadata = metadata;
    this.tempRootCreated = tempRootCreated;
    this.phase = phase;
    this.reservationIdentity = null;
  }

  get stagingRoot() {
    return path.join(this.root, this.stagingRelative);
  }

  get stagedSentiPath() {
    return path.join(this.stagingRoot, ".senti");
  }

  get backupPath() {
    return path.join(this.stagingRoot, "legacy-senti-backup");
  }

  get journalPath() {
    return path.join(this.root, ".tmp", JOURNAL_FILE_NAME);
  }

  toJSON() {
    return {
      version: JOURNAL_VERSION,
      root: this.root,
      sourceName: this.sourceName,
      stagingRelative: this.stagingRelative,
      sourceIdentity: this.sourceIdentity,
      stagedSentiIdentity: this.stagedSentiIdentity,
      metadata: this.metadata.map((entry) => entry.toJSON()),
      tempRootCreated: this.tempRootCreated,
      phase: this.phase,
    };
  }

  write() {
    new AtomicFile(this.journalPath).write(`${JSON.stringify(this.toJSON(), null, 2)}\n`);
  }

  publish() {
    const payload = `${JSON.stringify(this.toJSON(), null, 2)}\n`;
    let descriptor = null;
    let primaryError = null;
    try {
      // `wx` makes the initial publication a reservation: a second migration
      // cannot replace an in-progress journal between preflight and commit.
      descriptor = fs.openSync(
        this.journalPath,
        fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0),
        0o600,
      );
    } catch (error) {
      if (error.code === "EEXIST") {
        throw new Error("migration journal was created by another migration; source was not changed", { cause: error });
      }
      throw error;
    }
    try {
      const stat = fs.fstatSync(descriptor);
      if (!stat.isFile()) throw new Error("migration journal authority changed during publication");
      this.reservationIdentity = { dev: stat.dev, ino: stat.ino };
      fs.writeFileSync(descriptor, payload);
      fs.fsyncSync(descriptor);
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      try {
        fs.closeSync(descriptor);
      } catch (closeError) {
        if (primaryError) {
          throw new AggregateError([primaryError, closeError], "migration journal publication and descriptor cleanup both failed", { cause: primaryError });
        }
        throw closeError;
      }
    }
    fsyncDirectory(path.dirname(this.journalPath));
  }

  discardReservation() {
    if (!this.reservationIdentity) return;
    const removal = new AtomicFile(this.journalPath, {
      phaseNamespace: "migration-journal-reservation",
      commitGuard: () => {
        const stat = assertRegularFile(this.journalPath, "migration journal reservation");
        if (stat.dev !== this.reservationIdentity.dev || stat.ino !== this.reservationIdentity.ino) {
          throw new Error("migration journal reservation changed before cleanup");
        }
      },
    }).remove();
    if (!removal.committed) throw new Error("migration journal reservation disappeared before cleanup");
    this.reservationIdentity = null;
  }

  advance(phase) {
    if (!JOURNAL_PHASES.has(phase)) throw new Error(`unsupported migration phase: ${phase}`);
    this.phase = phase;
    this.write();
  }

  remove() {
    new AtomicFile(this.journalPath, { phaseNamespace: "migration-journal" }).remove();
  }

  static read(root) {
    const temporaryRoot = path.join(root, ".tmp");
    const temporaryStat = lstatOrNull(temporaryRoot);
    if (!temporaryStat) return null;
    assertRealDirectory(temporaryRoot, "migration temporary directory");
    const journalPath = path.join(temporaryRoot, JOURNAL_FILE_NAME);
    const stat = lstatOrNull(journalPath);
    if (!stat) return null;
    assertRegularFile(journalPath, "migration journal");
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    } catch (error) {
      throw new Error(`migration journal is invalid: ${error.message}`);
    }
    const keys = raw && typeof raw === "object" ? Object.keys(raw).sort() : [];
    const expectedKeys = ["metadata", "phase", "root", "sourceIdentity", "sourceName", "stagedSentiIdentity", "stagingRelative", "tempRootCreated", "version"];
    if (JSON.stringify(keys) !== JSON.stringify(expectedKeys) || raw.version !== JOURNAL_VERSION || path.resolve(raw.root || "") !== path.resolve(root)
      || !Array.isArray(raw.metadata) || !raw.sourceIdentity || !raw.stagedSentiIdentity) {
      throw new Error("migration journal has an unsupported schema");
    }
    const journal = new UpgradeMigrationJournal({
      root,
      sourceName: raw.sourceName,
      stagingRelative: raw.stagingRelative,
      sourceIdentity: raw.sourceIdentity,
      stagedSentiIdentity: raw.stagedSentiIdentity,
      metadata: raw.metadata.map((entry) => RootMetadataFile.fromJSON(root, entry)),
      tempRootCreated: raw.tempRootCreated,
      phase: raw.phase,
    });
    for (const entry of journal.metadata) {
      const expected = entry.name === ".gitignore"
        ? Buffer.from(migrateLegacyManagedGitignore(entry.original.toString("utf8")), "utf8")
        : Buffer.from(migrateLegacyManagedGitattributes(entry.original.toString("utf8")), "utf8");
      if (!expected.equals(entry.planned)) throw new Error("migration journal metadata plan is invalid");
    }
    return journal;
  }
}

function copyTree(sourceRoot, destinationRoot, relative = "") {
  for (const name of fs.readdirSync(sourceRoot).sort((left, right) => left.localeCompare(right))) {
    const source = path.join(sourceRoot, name);
    const sourceRelative = relative === "" ? name : `${relative}/${name}`;
    const targetRelative = transformedRelativePath(sourceRelative);
    const destination = path.join(destinationRoot, targetRelative);
    if (lstatOrNull(destination)) throw new Error(`migration path collision: ${sourceRelative} maps to ${targetRelative}`);
    const stat = fs.lstatSync(source);
    if (stat.isDirectory()) {
      if (stat.isSymbolicLink()) throw new Error(`managed directory contains a symbolic-link directory: ${sourceRelative}`);
      fs.mkdirSync(destination, { recursive: true, mode: stat.mode & 0o777 });
      fs.chmodSync(destination, stat.mode & 0o777);
      copyTree(source, destinationRoot, sourceRelative);
    } else if (stat.isSymbolicLink()) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.symlinkSync(transformedLinkTarget(fs.readlinkSync(source)), destination);
    } else if (stat.isFile()) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const bytes = fs.readFileSync(source);
      const transformed = transformedFileBytes(sourceRelative, bytes);
      if (transformed === bytes) fs.copyFileSync(source, destination);
      else fs.writeFileSync(destination, transformed);
      fs.chmodSync(destination, stat.mode & 0o777);
    } else {
      throw new Error(`managed directory contains an unsupported entry: ${sourceRelative}`);
    }
  }
}

function activeFlowPresent(sourceRoot) {
  const entries = fs.readdirSync(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".active-flow.")) return true;
  }
  const activePath = path.join(sourceRoot, ".active-flow");
  if (!lstatOrNull(activePath)) return false;
  assertRegularFile(activePath, "legacy active-flow registry");
  try {
    const value = JSON.parse(fs.readFileSync(activePath, "utf8"));
    return !Array.isArray(value) || value.length > 0;
  } catch (error) {
    throw new Error(`legacy active-flow registry is invalid: ${error.message}`);
  }
}

function findBusyMarkers(sourceRoot) {
  const found = [];
  const visit = (directory, relative = "") => {
    for (const name of fs.readdirSync(directory).sort((left, right) => left.localeCompare(right))) {
      const source = path.join(directory, name);
      const childRelative = relative === "" ? name : `${relative}/${name}`;
      const stat = fs.lstatSync(source);
      if (name.endsWith(".lock")) found.push(childRelative);
      if (stat.isDirectory() && !stat.isSymbolicLink()) visit(source, childRelative);
    }
  };
  visit(sourceRoot);
  return found;
}

function readJsonWarning(filePath, label) {
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, "utf8")), warnings: [] };
  } catch (error) {
    return { value: null, warnings: [`${label}: JSON parse error: ${error.message}`] };
  }
}

function validationPathSegments(validationMessage) {
  const pathMatch = validationMessage.match(/'?([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*|\[\d+\])*)'?:/);
  if (!pathMatch) return null;
  return pathMatch[1].match(/[A-Za-z][A-Za-z0-9_]*|\d+/g) || null;
}

function localOverlaySuppliesPath(local, segments) {
  // plugin sources/packages merge entries by id, so a field path alone cannot
  // establish which stored file supplied it. Keep diagnostics conservative.
  if (segments[0] === "plugin" && ["sources", "packages"].includes(segments[1])) return false;

  let current = local;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return true;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return false;
    current = current[segment];
  }
  return true;
}

function originForConfigPath(local, validationMessage) {
  const segments = validationPathSegments(validationMessage);
  return segments && localOverlaySuppliesPath(local || {}, segments)
    ? "config.local.json"
    : "config.json";
}

export function collectMigrationConfigWarnings(sourceRoot) {
  const configPath = path.join(sourceRoot, "config.json");
  const localPath = path.join(sourceRoot, "config.local.json");
  if (!lstatOrNull(configPath)) return ["config.json: missing; the subsequent normal upgrade will fail validation"];
  assertRegularFile(configPath, "legacy config.json");
  const config = readJsonWarning(configPath, "config.json");
  if (config.value == null) return config.warnings;
  if (!config.value || typeof config.value !== "object" || Array.isArray(config.value)) {
    return ["config.json: config must be a non-null object"];
  }
  let local = {};
  const warnings = [...config.warnings];
  if (lstatOrNull(localPath)) {
    assertRegularFile(localPath, "legacy config.local.json");
    const parsedLocal = readJsonWarning(localPath, "config.local.json");
    warnings.push(...parsedLocal.warnings);
    if (parsedLocal.value == null) return warnings;
    if (!parsedLocal.value || typeof parsedLocal.value !== "object" || Array.isArray(parsedLocal.value)) {
      warnings.push("config.local.json: config.local.json must be a non-null object");
      return warnings;
    }
    local = parsedLocal.value;
  }
  try {
    loadConfigFromManagedDirectory(sourceRoot);
  } catch (error) {
    const detail = String(error.message || error)
      .replace(/^Config validation failed:\s*/, "")
      .split("\n")
      .map((line) => line.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean);
    for (const message of detail) warnings.push(`${originForConfigPath(local, message)}: ${message}`);
  }
  return warnings;
}

export function legacyPluginSkillSourceDirs(sourceRoot) {
  try {
    const raw = loadRawConfigFromManagedDirectory(sourceRoot);
    const dirs = new Set();
    for (const pkg of raw?.plugin?.packages || []) {
      if (pkg?.enabled === false || typeof pkg?.id !== "string") continue;
      const manifestPath = path.join(sourceRoot, "plugins", pkg.id, "plugin.json");
      if (!lstatOrNull(manifestPath)) continue;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      for (const skill of manifest?.contributions?.skills || []) {
        if (typeof skill?.path !== "string") continue;
        const declared = skill.path.endsWith("/SKILL.md")
          ? path.dirname(path.dirname(skill.path))
          : path.dirname(skill.path);
        dirs.add(path.join(sourceRoot, "plugins", pkg.id, declared));
      }
    }
    return [...dirs];
  } catch (_) {
    // A malformed legacy config is still a migratable byte stream. The
    // following normal upgrade will surface its validation failure, but the
    // directory migration must not strand that config in the retired path.
    return [];
  }
}

function ensureTempRoot(root) {
  const temp = path.join(root, ".tmp");
  const stat = lstatOrNull(temp);
  const created = !stat;
  if (!stat) fs.mkdirSync(temp, { recursive: true, mode: 0o700 });
  assertRealDirectory(temp, "migration temporary directory");
  return { temp, created };
}

function migrationState(root) {
  const states = new Map();
  for (const name of [...LEGACY_DIRECTORY_NAMES, PRODUCT.managedDirName]) {
    const target = path.join(root, name);
    const stat = lstatOrNull(target);
    if (stat) states.set(name, stat);
  }
  return states;
}

/**
 * Owns the migration preflight, staged tree construction, commit, rollback,
 * and journal-driven recovery boundaries.
 */
export class UpgradeDirectoryMigration {
  constructor(root, { dryRun = false, logger = console } = {}) {
    this.root = path.resolve(root);
    this.dryRun = dryRun;
    this.logger = logger;
  }

  run() {
    const recovery = UpgradeMigrationJournal.read(this.root);
    if (recovery) {
      if (this.dryRun) {
        this.logger.log("[migrate] DRY-RUN: a valid migration journal would be recovered; no files were changed.");
        return { migrated: false, shouldRunUpgrade: false, warnings: [], recovered: true };
      }
      const recovered = this.#recover(recovery);
      this.logger.log(recovered === "cleanup"
        ? "[migrate] recovered incomplete cleanup after the final rename."
        : "[migrate] recovered an interrupted migration by restoring the legacy directory.");
      return { migrated: false, shouldRunUpgrade: false, warnings: [], recovered: true };
    }

    const state = migrationState(this.root);
    const canonical = state.get(PRODUCT.managedDirName);
    if (canonical) {
      this.logger.log(`[migrate] ${PRODUCT.managedDirName} already exists; no migration or normal upgrade was run.`);
      return { migrated: false, shouldRunUpgrade: false, warnings: [] };
    }
    const sources = LEGACY_DIRECTORY_NAMES.filter((name) => state.has(name));
    if (sources.length === 0) {
      this.logger.log("[migrate] no legacy managed directory was found; no migration or normal upgrade was run.");
      return { migrated: false, shouldRunUpgrade: false, warnings: [] };
    }
    if (sources.length !== 1) throw new Error("migration refuses to merge .sdd-forge and .senti automatically");

    const sourceName = sources[0];
    const sourceRoot = path.join(this.root, sourceName);
    assertRealDirectory(sourceRoot, "legacy managed directory");
    if (activeFlowPresent(sourceRoot)) throw new Error("migration refuses while a legacy Flow is active or preparing");
    const busy = findBusyMarkers(sourceRoot);
    if (busy.length > 0) throw new Error(`migration refuses while another process may be writing managed files: ${busy.join(", ")}`);

    const snapshot = SourceTreeSnapshot.capture(sourceRoot);
    const treePlan = snapshot.treePlan;
    const warnings = collectMigrationConfigWarnings(sourceRoot);
    const pluginSkillDirs = legacyPluginSkillSourceDirs(sourceRoot);
    const metadata = [
      RootMetadataFile.plan(this.root, ".gitignore", migrateLegacyManagedGitignore),
      RootMetadataFile.plan(this.root, ".gitattributes", migrateLegacyManagedGitattributes),
    ];
    if (this.dryRun) {
      this.#printDryRunPlan(sourceName, treePlan, metadata, warnings);
      return {
        migrated: false,
        shouldRunUpgrade: true,
        warnings,
        sourceName,
        pluginSkillDirs,
        normalUpgradeExpectedFailure: warnings.length > 0,
      };
    }

    const tempState = ensureTempRoot(this.root);
    const tempRoot = tempState.temp;
    const stagingRoot = path.join(tempRoot, `${STAGING_PREFIX}${crypto.randomUUID()}`);
    let journal = null;
    let retainStagingForRecovery = false;
    try {
      fs.mkdirSync(stagingRoot, { mode: 0o700 });
      const stagedSenti = path.join(stagingRoot, ".senti");
      fs.mkdirSync(stagedSenti, { mode: 0o700 });
      fs.chmodSync(stagedSenti, snapshot.rootMode);
      copyTree(sourceRoot, stagedSenti);
      snapshot.assertStaged(stagedSenti);
      snapshot.assertUnchanged(sourceRoot);
      for (const entry of metadata) entry.stage(stagingRoot);
      const pendingJournal = new UpgradeMigrationJournal({
        root: this.root,
        sourceName,
        stagingRelative: relativePath(this.root, stagingRoot),
        sourceIdentity: directoryIdentity(sourceRoot, "legacy managed directory"),
        stagedSentiIdentity: directoryIdentity(stagedSenti, "migration staged directory"),
        metadata,
        tempRootCreated: tempState.created,
      });
      try {
        pendingJournal.publish();
      } catch (error) {
        if (pendingJournal.reservationIdentity) {
          try {
            pendingJournal.discardReservation();
          } catch (cleanupError) {
            retainStagingForRecovery = true;
            throw new AggregateError(
              [error, cleanupError],
              "migration journal publication and reservation cleanup both failed",
              { cause: error },
            );
          }
        }
        throw error;
      }
      journal = pendingJournal;
      this.#commit(journal, snapshot);
      this.logger.log(`[migrate] migrated ${sourceName} to ${PRODUCT.managedDirName}.`);
      for (const warning of warnings) this.logger.error(`[migrate] config warning: ${warning}`);
      return { migrated: true, shouldRunUpgrade: true, warnings, pluginSkillDirs };
    } catch (error) {
      if (journal) {
        if (this.#finalRenameVisible(journal)) {
          // The final state is authoritative. Leave its journal for the next
          // --migrate invocation to complete cleanup safely.
          throw error;
        }
        try {
          this.#rollback(journal);
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], "migration and rollback both failed", { cause: error });
        }
      } else if (!retainStagingForRecovery) {
        removeTree(stagingRoot, "migration staging directory");
        if (tempState.created && fs.readdirSync(tempRoot).length === 0) fs.rmdirSync(tempRoot);
      }
      throw error;
    }
  }

  #printDryRunPlan(sourceName, treePlan, metadata, warnings) {
    this.logger.log(`[migrate] DRY-RUN: ${sourceName} -> .senti -> ${PRODUCT.managedDirName}`);
    this.logger.log(`[migrate] DRY-RUN: stage ${treePlan.entries} managed entries under .tmp/${STAGING_PREFIX}<id>/.senti`);
    for (const entry of metadata) {
      const status = entry.original.equals(entry.planned) ? "unchanged" : "replace";
      this.logger.log(`[migrate] DRY-RUN: ${status} ${entry.name}`);
    }
    for (const warning of warnings) this.logger.error(`[migrate] config warning: ${warning}`);
    if (warnings.length > 0) {
      this.logger.error("[migrate] directory migration is feasible, but the subsequent normal upgrade is expected to fail config validation.");
    }
    this.logger.log("[migrate] DRY-RUN: no files, directories, journals, or metadata were changed.");
  }

  #commit(journal, snapshot) {
    const sourceRoot = path.join(this.root, journal.sourceName);
    const temporarySenti = path.join(this.root, ".senti");
    const canonical = path.join(this.root, PRODUCT.managedDirName);
    if (lstatOrNull(canonical) || (journal.sourceName !== ".senti" && lstatOrNull(temporarySenti))) {
      throw new Error("migration destination appeared after preflight");
    }
    if (!sameDirectoryIdentity(sourceRoot, journal.sourceIdentity, "legacy managed directory")) {
      throw new Error("legacy managed directory identity changed before migration commit");
    }
    snapshot.assertUnchanged(sourceRoot);
    for (const entry of journal.metadata) entry.assertOriginal();

    if (journal.sourceName === ".senti") {
      fs.renameSync(sourceRoot, journal.backupPath);
      journal.advance("legacy-backed-up");
    }
    fs.renameSync(journal.stagedSentiPath, temporarySenti);
    journal.advance("placed-senti");
    for (const entry of journal.metadata) entry.apply();
    journal.advance("metadata-updated");
    fs.renameSync(temporarySenti, canonical);
    journal.advance("final-renamed");
    this.#completeCleanup(journal);
  }

  #finalRenameVisible(journal) {
    const canonical = path.join(this.root, PRODUCT.managedDirName);
    const temporary = path.join(this.root, ".senti");
    const stat = lstatOrNull(canonical);
    return Boolean(stat && stat.isDirectory() && !stat.isSymbolicLink() && !lstatOrNull(temporary));
  }

  #completeCleanup(journal) {
    const canonical = path.join(this.root, PRODUCT.managedDirName);
    if (!sameDirectoryIdentity(canonical, journal.stagedSentiIdentity, "migrated managed directory")) {
      throw new Error("migrated managed directory identity changed before cleanup");
    }
    if (journal.sourceName === ".senti") {
      if (lstatOrNull(journal.backupPath)) removeTree(journal.backupPath, "legacy .senti backup");
    } else {
      const source = path.join(this.root, journal.sourceName);
      if (lstatOrNull(source)) removeTree(source, "legacy .sdd-forge directory");
    }
    removeTree(journal.stagingRoot, "migration staging directory");
    journal.remove();
    this.#removeCreatedTempRoot(journal);
  }

  #rollback(journal) {
    if (this.#finalRenameVisible(journal)) {
      throw new Error("cannot roll back after the final rename; cleanup recovery is required");
    }
    const temporary = path.join(this.root, ".senti");
    const backupExists = journal.sourceName === ".senti" && Boolean(lstatOrNull(journal.backupPath));
    const originalSentiStillInPlace = journal.sourceName === ".senti"
      && !backupExists
      && Boolean(lstatOrNull(temporary))
      && sameDirectoryIdentity(temporary, journal.sourceIdentity, "legacy .senti directory");
    if (lstatOrNull(temporary) && !originalSentiStillInPlace) {
      if (!sameDirectoryIdentity(temporary, journal.stagedSentiIdentity, "staged temporary directory")) {
        throw new Error("cannot remove temporary .senti changed by another process");
      }
      removeTree(temporary, "staged temporary directory");
    }
    for (const entry of journal.metadata) entry.restore();
    if (journal.sourceName === ".senti") {
      const source = path.join(this.root, ".senti");
      const backup = journal.backupPath;
      if (backupExists) {
        if (lstatOrNull(source)) throw new Error("cannot restore legacy .senti because its original path is occupied");
        if (!sameDirectoryIdentity(backup, journal.sourceIdentity, "legacy .senti backup")) {
          throw new Error("cannot restore legacy .senti backup changed by another process");
        }
        fs.renameSync(backup, source);
      } else if (!lstatOrNull(source)) {
        throw new Error("legacy .senti disappeared before rollback");
      }
    }
    removeTree(journal.stagingRoot, "migration staging directory");
    journal.remove();
    this.#removeCreatedTempRoot(journal);
  }

  #removeCreatedTempRoot(journal) {
    const temp = path.join(this.root, ".tmp");
    if (journal.tempRootCreated && lstatOrNull(temp) && fs.readdirSync(temp).length === 0) fs.rmdirSync(temp);
  }

  #recover(journal) {
    if (this.#finalRenameVisible(journal)) {
      this.#completeCleanup(journal);
      return "cleanup";
    }
    if (journal.phase === "final-renamed") {
      throw new Error("migration journal says final rename completed, but canonical directory is not safely present");
    }
    this.#rollback(journal);
    return "rollback";
  }
}
