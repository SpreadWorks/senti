import crypto from "crypto";
import fs from "fs";
import path from "path";
import { sentiDir } from "../../lib/config.js";

const JOURNAL_VERSION = 2;
const JOURNAL_KIND = "issue-441-reopen-draft";
const JOURNAL_PHASES = new Set(["prepared", "applying", "targets-applied", "committed"]);
const FILE_KEYS = Object.freeze(["flow", "spec", "issueLog"]);
const DEFAULT_PROJECT_FILE_MODE = 0o644;
const MAX_PENDING_JOURNALS = 100;
const ABANDONED_OWNER_PID = 2_147_483_647;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LOCK_PHASES = new Set([
  "acquired",
  "prepared",
  "applying",
  "targets-applied",
  "committed",
  "recovering",
  "recovery-failed",
]);
const RECOVERABLE_OWNER_PHASES = new Set(["acquired", ...JOURNAL_PHASES]);

function digest(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function transactionError(message, options = {}) {
  return new ReopenDraftTransactionError(message, options);
}

function trustFailure(message, options = {}) {
  return transactionError(message, { ...options, code: "TRANSACTION_TRUST_FAILED" });
}

function canonicalRoot(root) {
  const resolved = path.resolve(root);
  let stat;
  try {
    stat = fs.lstatSync(resolved);
  } catch (err) {
    throw trustFailure(`transaction authority root is unavailable: ${resolved}`, { cause: err });
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(resolved) !== resolved) {
    throw trustFailure(`transaction authority root must be a canonical real directory: ${resolved}`);
  }
  return resolved;
}

function normalizedSpecPath(specPath) {
  if (typeof specPath !== "string") throw trustFailure("transaction spec path must be a string");
  const normalized = specPath.replaceAll("\\", "/");
  if (
    normalized !== path.posix.normalize(normalized)
    || !/^specs\/[^/]+\/spec\.json$/.test(normalized)
  ) {
    throw trustFailure(`transaction spec path must be normalized: ${specPath}`);
  }
  return normalized;
}

function normalizedIdentity(identity) {
  if (typeof identity?.runId !== "string" || identity.runId.trim() === "") {
    throw trustFailure("transaction identity requires runId");
  }
  const issue = identity.issue == null ? null : Number(identity.issue);
  if (issue != null && (!Number.isSafeInteger(issue) || issue < 1)) {
    throw trustFailure("transaction Issue must be a positive integer when present");
  }
  return Object.freeze({ runId: identity.runId.trim(), issue });
}

function assertSafeExistingPath(root, target, { allowMissingLeaf = false } = {}) {
  const relative = path.relative(root, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw trustFailure(`transaction target escapes authority root: ${target}`);
  }
  let cursor = root;
  const parts = relative.split(path.sep);
  for (let index = 0; index < parts.length; index += 1) {
    cursor = path.join(cursor, parts[index]);
    if (!fs.existsSync(cursor)) {
      if (allowMissingLeaf && index === parts.length - 1) return;
      throw trustFailure(`transaction path component is missing: ${cursor}`);
    }
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) throw trustFailure(`transaction path contains a symlink: ${cursor}`);
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw trustFailure(`transaction parent is not a directory: ${cursor}`);
    }
  }
}

function ensureSafeDirectory(root, directory) {
  const relative = path.relative(root, directory);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw trustFailure(`transaction directory escapes authority root: ${directory}`);
  }
  let cursor = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    if (!fs.existsSync(cursor)) fs.mkdirSync(cursor);
    const stat = fs.lstatSync(cursor);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw trustFailure(`transaction directory is not a real directory: ${cursor}`);
    }
  }
}

function isProcessAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

function decode(encoded, expectedDigest, field) {
  if (typeof encoded !== "string" || typeof expectedDigest !== "string") {
    throw trustFailure(`transaction content metadata is invalid: ${field}`);
  }
  const content = Buffer.from(encoded, "base64");
  if (digest(content) !== expectedDigest) throw trustFailure(`transaction checksum mismatch: ${field}`);
  return content;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw trustFailure(`invalid ${label}: ${err.message}`, { cause: err });
  }
}

class TargetSet {
  constructor({ root, spec }) {
    this.root = root;
    this.spec = spec;
    const specFile = path.resolve(root, spec);
    const specDirectory = path.dirname(specFile);
    assertSafeExistingPath(root, specDirectory);
    this.paths = Object.freeze({
      flow: path.join(specDirectory, "flow.json"),
      spec: specFile,
      issueLog: path.join(specDirectory, "issue-log.json"),
    });
    assertSafeExistingPath(root, this.paths.flow);
    assertSafeExistingPath(root, this.paths.spec);
    assertSafeExistingPath(root, this.paths.issueLog, { allowMissingLeaf: true });
    Object.freeze(this);
  }

  pathFor(key) {
    return this.paths[key];
  }

  tempFor(key, transactionId) {
    const target = this.pathFor(key);
    return path.join(path.dirname(target), `.${path.basename(target)}.${transactionId}.next`);
  }
}

class DurableIo {
  constructor(faultInjector = () => {}) {
    this.faultInjector = faultInjector;
  }

  emit(event) {
    this.faultInjector(event);
  }

  fsyncDirectory(directory, metadata) {
    this.emit({ phase: "before-fsync-dir", ...metadata, directory });
    const fd = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    this.emit({ phase: "after-fsync-dir", ...metadata, directory });
  }

  writeDirect(file, content, mode, metadata) {
    const fd = fs.openSync(file, "w", mode);
    try {
      fs.writeFileSync(fd, content);
      this.emit({ phase: "before-fsync-file", ...metadata, file });
      fs.fsyncSync(fd);
      this.emit({ phase: "after-fsync-file", ...metadata, file });
    } finally {
      fs.closeSync(fd);
    }
    fs.chmodSync(file, mode);
    this.fsyncDirectory(path.dirname(file), metadata);
  }

  rename(source, target, metadata) {
    this.emit({ phase: "before-rename", ...metadata, source, target });
    fs.renameSync(source, target);
    this.emit({ phase: "after-rename", ...metadata, source, target });
    this.fsyncDirectory(path.dirname(target), metadata);
  }

  writeAtomic(file, content, mode, metadata) {
    const staging = stagePath(file);
    try {
      this.writeDirect(staging, content, mode, { ...metadata, role: `${metadata.role}-stage` });
      this.rename(staging, file, metadata);
    } catch (err) {
      if (!(err instanceof SimulatedTransactionCrash)) this.unlink(staging, {
        ...metadata,
        role: `${metadata.role}-stage-cleanup`,
      });
      throw err;
    }
  }

  unlink(file, metadata) {
    if (!fs.existsSync(file)) return;
    this.emit({ phase: "before-unlink", ...metadata, file });
    fs.unlinkSync(file);
    this.emit({ phase: "after-unlink", ...metadata, file });
    this.fsyncDirectory(path.dirname(file), metadata);
  }
}

function stagePath(file) {
  return `${file}.stage`;
}

class TransactionEntry {
  constructor({ key, target, nextContent }) {
    const stat = fs.existsSync(target) ? fs.lstatSync(target) : null;
    if (stat?.isSymbolicLink() || (stat && !stat.isFile())) {
      throw trustFailure(`transaction target must be a regular file: ${target}`);
    }
    const originalContent = stat ? fs.readFileSync(target) : null;
    const next = Buffer.from(nextContent);
    this.key = key;
    this.original = originalContent == null
      ? { exists: false, content: null, sha256: null, mode: null }
      : {
          exists: true,
          content: originalContent.toString("base64"),
          sha256: digest(originalContent),
          mode: stat.mode & 0o777,
        };
    this.next = {
      content: next.toString("base64"),
      sha256: digest(next),
      mode: this.original.mode ?? DEFAULT_PROJECT_FILE_MODE,
    };
    Object.freeze(this.original);
    Object.freeze(this.next);
    Object.freeze(this);
  }

  toJSON() {
    return { key: this.key, original: this.original, next: this.next };
  }
}

class Journal {
  constructor({ id, root, spec, identity, entries, phase = "prepared" }) {
    this.version = JOURNAL_VERSION;
    this.kind = JOURNAL_KIND;
    this.id = id;
    this.phase = phase;
    this.authority = { root, spec, runId: identity.runId, issue: identity.issue };
    this.entries = entries;
    this.createdAt = new Date().toISOString();
  }

  setPhase(phase) {
    if (!JOURNAL_PHASES.has(phase)) throw new Error(`invalid transaction phase: ${phase}`);
    this.phase = phase;
  }

  toJSON() {
    return {
      version: this.version,
      kind: this.kind,
      id: this.id,
      phase: this.phase,
      authority: this.authority,
      entries: this.entries.map((entry) => entry.toJSON?.() ?? entry),
      createdAt: this.createdAt,
    };
  }

  static load({ root, journalPath }) {
    const raw = readJson(journalPath, "reopen-draft transaction journal");
    if (
      raw.version !== JOURNAL_VERSION
      || raw.kind !== JOURNAL_KIND
      || !UUID_PATTERN.test(raw.id)
      || path.basename(journalPath) !== `${raw.id}.json`
      || !JOURNAL_PHASES.has(raw.phase)
    ) {
      throw trustFailure("invalid reopen-draft transaction journal header", { journalPath });
    }
    const canonical = canonicalRoot(root);
    if (raw.authority?.root !== canonical) {
      throw trustFailure("transaction journal authority root mismatch", { journalPath });
    }
    const spec = normalizedSpecPath(raw.authority?.spec);
    const identity = normalizedIdentity({ runId: raw.authority?.runId, issue: raw.authority?.issue });
    if (!Array.isArray(raw.entries) || raw.entries.map((entry) => entry?.key).join(",") !== FILE_KEYS.join(",")) {
      throw trustFailure("invalid reopen-draft transaction file keys", { journalPath });
    }
    const targets = new TargetSet({ root: canonical, spec });
    for (const entry of raw.entries) {
      if (
        typeof entry.original?.exists !== "boolean"
        || (entry.original.exists && !Number.isInteger(entry.original.mode))
        || !Number.isInteger(entry.next?.mode)
      ) {
        throw trustFailure(`invalid transaction mode metadata: ${entry.key}`, { journalPath });
      }
      if (entry.original.exists) decode(entry.original.content, entry.original.sha256, `${entry.key}.original`);
      decode(entry.next.content, entry.next.sha256, `${entry.key}.next`);
    }
    validateFlowIdentity(raw.entries[0], { spec, identity });
    return { raw, root: canonical, spec, identity, targets };
  }
}

function validateFlowIdentity(flowEntry, { spec, identity }) {
  for (const [label, source] of [["original", flowEntry.original], ["next", flowEntry.next]]) {
    if (label === "original" && source.exists === false) throw trustFailure("flow.json original cannot be absent");
    const flow = JSON.parse(decode(source.content, source.sha256, `flow.${label}`).toString("utf8"));
    const issue = flow.issue == null ? null : Number(flow.issue);
    if (flow.spec !== spec || flow.runId !== identity.runId || issue !== identity.issue) {
      throw trustFailure(`flow.${label} identity does not match transaction authority`);
    }
  }
}

function transactionBase(root) {
  return path.join(sentiDir(root), "transactions");
}

function journalDirectory(root) {
  return path.join(transactionBase(root), "reopen-draft");
}

function lockDirectory(root) {
  return path.join(transactionBase(root), "reopen-draft.lock");
}

function ownerPath(lockPath) {
  return path.join(lockPath, "owner.json");
}

function validateOwner(raw, { root, claim = false }) {
  const identity = normalizedIdentity({ runId: raw?.runId, issue: raw?.issue });
  if (
    raw?.version !== 1
    || raw.kind !== JOURNAL_KIND
    || typeof raw.token !== "string"
    || raw.token === ""
    || !Number.isSafeInteger(raw.pid)
    || raw.pid < 1
    || !LOCK_PHASES.has(raw.phase)
    || raw.authorityRoot !== root
    || normalizedSpecPath(raw.spec) !== raw.spec
    || !UUID_PATTERN.test(raw.transactionId)
    || (claim && !RECOVERABLE_OWNER_PHASES.has(raw.recoveryOfPhase))
  ) {
    throw trustFailure("invalid reopen-draft transaction lock owner");
  }
  return { raw, identity };
}

function recoveryClaims(root) {
  const base = transactionBase(root);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("reopen-draft.recovery-"))
    .map((entry) => path.join(base, entry.name));
}

class TransactionLock {
  constructor({ root, identity, spec, transactionId, io }) {
    this.root = root;
    this.identity = identity;
    this.spec = spec;
    this.transactionId = transactionId;
    this.io = io;
    this.token = crypto.randomUUID();
    this.path = lockDirectory(root);
    this.owner = {
      version: 1,
      kind: JOURNAL_KIND,
      token: this.token,
      pid: process.pid,
      phase: "acquired",
      authorityRoot: root,
      spec,
      runId: identity.runId,
      issue: identity.issue,
      transactionId,
      updatedAt: new Date().toISOString(),
    };
  }

  acquire() {
    ensureSafeDirectory(this.root, transactionBase(this.root));
    if (recoveryClaims(this.root).length > 0) {
      throw transactionError("reopen-draft transaction recovery is already in progress", {
        code: "TRANSACTION_IN_PROGRESS",
      });
    }
    try {
      fs.mkdirSync(this.path);
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      const existing = validateOwner(
        readJson(ownerPath(this.path), "transaction lock owner"),
        { root: this.root },
      ).raw;
      throw transactionError(
        isProcessAlive(existing.pid)
          ? `reopen-draft transaction is active (pid ${existing.pid}, phase ${existing.phase})`
          : "stale reopen-draft transaction requires recovery",
        {
          code: isProcessAlive(existing.pid) ? "TRANSACTION_IN_PROGRESS" : "TRANSACTION_RECOVERY_REQUIRED",
          lockPath: this.path,
        },
      );
    }
    this.io.fsyncDirectory(transactionBase(this.root), { role: "lock", key: null });
    this._persistOwner();
    this.io.emit({ phase: "lock-acquired", lockPath: this.path, token: this.token });
  }

  setPhase(phase) {
    this.owner.phase = phase;
    this.owner.updatedAt = new Date().toISOString();
    this._persistOwner();
  }

  abandon() {
    if (!fs.existsSync(this.path)) return;
    this.owner.pid = ABANDONED_OWNER_PID;
    this.owner.updatedAt = new Date().toISOString();
    const content = `${JSON.stringify(this.owner, null, 2)}\n`;
    const file = ownerPath(this.path);
    fs.writeFileSync(file, content);
    const fd = fs.openSync(file, "r");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }

  release() {
    const persisted = readJson(ownerPath(this.path), "transaction lock owner");
    if (persisted.token !== this.token) {
      throw transactionError("transaction lock ownership changed before release", {
        code: "TRANSACTION_IN_PROGRESS",
        lockPath: this.path,
      });
    }
    this.io.unlink(ownerPath(this.path), { role: "lock", key: null });
    fs.rmdirSync(this.path);
    this.io.fsyncDirectory(transactionBase(this.root), { role: "lock", key: null });
  }

  _persistOwner() {
    this.io.writeAtomic(
      ownerPath(this.path),
      `${JSON.stringify(this.owner, null, 2)}\n`,
      0o600,
      { role: "lock", key: null },
    );
  }
}

export class ReopenDraftTransactionError extends Error {
  constructor(message, {
    code,
    cause,
    journalPath = null,
    lockPath = null,
    recovered = false,
    committed = false,
    recoveryCause = null,
  } = {}) {
    super(message, { cause });
    this.name = "ReopenDraftTransactionError";
    this.code = code;
    this.journalPath = journalPath;
    this.lockPath = lockPath;
    this.recovered = recovered;
    this.committed = committed;
    this.recoveryCause = recoveryCause;
  }
}

export class SimulatedTransactionCrash extends Error {
  constructor(message = "simulated process crash") {
    super(message);
    this.name = "SimulatedTransactionCrash";
  }
}

function persistJournal({ journal, journalPath, io }) {
  io.writeAtomic(journalPath, `${JSON.stringify(journal.toJSON(), null, 2)}\n`, 0o600, {
    role: "journal",
    key: null,
    transactionPhase: journal.phase,
  });
  io.emit({ phase: "phase-durable", transactionPhase: journal.phase, journalPath });
}

function restoreOriginals({ loaded, journalPath, io }) {
  for (const entry of [...loaded.raw.entries].reverse()) {
    const target = loaded.targets.pathFor(entry.key);
    const temp = loaded.targets.tempFor(entry.key, loaded.raw.id);
    io.emit({ phase: "before-restore", key: entry.key, journalPath });
    if (entry.original.exists) {
      const restore = `${target}.${loaded.raw.id}.restore`;
      io.writeDirect(
        restore,
        decode(entry.original.content, entry.original.sha256, `${entry.key}.original`),
        entry.original.mode,
        { role: "restore-temp", key: entry.key },
      );
      io.rename(restore, target, { role: "restore", key: entry.key });
    } else {
      io.unlink(target, { role: "restore", key: entry.key });
    }
    io.unlink(temp, { role: "temp", key: entry.key });
    io.emit({ phase: "after-restore", key: entry.key, journalPath });
  }
}

function verifyCommittedTargets(loaded) {
  for (const entry of loaded.raw.entries) {
    const target = loaded.targets.pathFor(entry.key);
    assertSafeExistingPath(loaded.root, target);
    const stat = fs.lstatSync(target);
    const content = fs.readFileSync(target);
    if (!stat.isFile() || digest(content) !== entry.next.sha256 || (stat.mode & 0o777) !== entry.next.mode) {
      throw trustFailure(`committed transaction target mismatch: ${entry.key}`);
    }
  }
}

function cleanupJournal({ loaded, journalPath, io }) {
  for (const entry of loaded.raw.entries) {
    const temp = loaded.targets.tempFor(entry.key, loaded.raw.id);
    io.unlink(stagePath(temp), { role: "temp-stage", key: entry.key });
    io.unlink(temp, { role: "temp", key: entry.key });
  }
  io.unlink(stagePath(journalPath), { role: "journal-stage", key: null });
  io.unlink(journalPath, { role: "journal", key: null });
}

function cleanupOwnerTransients({ root, claim, owner, io }) {
  const targets = new TargetSet({ root, spec: owner.spec });
  for (const key of FILE_KEYS) {
    const temp = targets.tempFor(key, owner.transactionId);
    io.unlink(stagePath(temp), { role: "temp-stage", key });
    io.unlink(temp, { role: "temp", key });
  }
  const journalPath = path.join(journalDirectory(root), `${owner.transactionId}.json`);
  io.unlink(stagePath(journalPath), { role: "journal-stage", key: null });
  io.unlink(stagePath(ownerPath(claim)), { role: "recovery-claim-stage", key: null });
}

function claimRecovery(root, io) {
  const existingClaims = recoveryClaims(root);
  if (existingClaims.length > 1) {
    throw transactionError("multiple reopen-draft recovery claims found", { code: "TRANSACTION_RECOVERY_FAILED" });
  }
  if (existingClaims.length === 1) {
    const claim = existingClaims[0];
    const owner = validateOwner(
      readJson(ownerPath(claim), "recovery claim owner"),
      { root, claim: true },
    ).raw;
    if (isProcessAlive(owner.pid)) {
      throw transactionError("reopen-draft recovery is active", { code: "TRANSACTION_IN_PROGRESS", lockPath: claim });
    }
    owner.recoveryOfPhase ??= owner.phase;
    owner.pid = process.pid;
    owner.phase = "recovering";
    io.writeAtomic(ownerPath(claim), `${JSON.stringify(owner, null, 2)}\n`, 0o600, {
      role: "recovery-claim",
      key: null,
    });
    return claim;
  }

  const lock = lockDirectory(root);
  if (fs.existsSync(lock)) {
    const owner = validateOwner(
      readJson(ownerPath(lock), "transaction lock owner"),
      { root },
    ).raw;
    if (isProcessAlive(owner.pid)) {
      throw transactionError(
        `reopen-draft transaction is active (pid ${owner.pid}, phase ${owner.phase})`,
        { code: "TRANSACTION_IN_PROGRESS", lockPath: lock },
      );
    }
    const claim = path.join(transactionBase(root), `reopen-draft.recovery-${crypto.randomUUID()}`);
    io.rename(lock, claim, { role: "recovery-claim", key: null });
    const claimedOwner = validateOwner(
      readJson(ownerPath(claim), "recovery claim owner"),
      { root },
    ).raw;
    claimedOwner.recoveryOfPhase = claimedOwner.phase;
    claimedOwner.pid = process.pid;
    claimedOwner.phase = "recovering";
    io.writeAtomic(ownerPath(claim), `${JSON.stringify(claimedOwner, null, 2)}\n`, 0o600, {
      role: "recovery-claim",
      key: null,
    });
    return claim;
  }

  const journals = ReopenDraftTransaction.pendingJournalPaths(root);
  if (journals.length > 0) {
    throw trustFailure("reopen-draft journal exists without its authority lock", {
      journalPath: journals[0],
    });
  }
  return null;
}

function releaseRecoveryClaim(root, claim, io) {
  if (!claim) return;
  io.unlink(ownerPath(claim), { role: "recovery-claim", key: null });
  fs.rmdirSync(claim);
  io.fsyncDirectory(transactionBase(root), { role: "recovery-claim", key: null });
}

function abandonRecoveryClaim(claim) {
  if (!claim || !fs.existsSync(ownerPath(claim))) return;
  const owner = readJson(ownerPath(claim), "recovery claim owner");
  owner.pid = ABANDONED_OWNER_PID;
  owner.phase = "recovery-failed";
  fs.writeFileSync(ownerPath(claim), `${JSON.stringify(owner, null, 2)}\n`);
}

export class ReopenDraftTransaction {
  constructor({ root, specPath, identity, contents, faultInjector = () => {} }) {
    this.root = canonicalRoot(root);
    this.spec = normalizedSpecPath(specPath);
    this.identity = normalizedIdentity(identity);
    if (!contents || Object.keys(contents).sort().join(",") !== [...FILE_KEYS].sort().join(",")) {
      throw trustFailure("reopen-draft transaction requires fixed flow, spec, and issueLog contents");
    }
    for (const key of FILE_KEYS) {
      if (typeof contents[key] !== "string") throw trustFailure(`${key} transaction content must be a string`);
    }
    this.contents = contents;
    this.targets = new TargetSet({ root: this.root, spec: this.spec });
    this.id = crypto.randomUUID();
    this.io = new DurableIo(faultInjector);
    this.journalPath = path.join(journalDirectory(this.root), `${this.id}.json`);
    this.lock = new TransactionLock({
      root: this.root,
      identity: this.identity,
      spec: this.spec,
      transactionId: this.id,
      io: this.io,
    });
  }

  commit() {
    let journal = null;
    let committed = false;
    let lockAcquired = false;
    ReopenDraftTransaction.recoverPending({ root: this.root });
    try {
      this.lock.acquire();
      lockAcquired = true;
      ensureSafeDirectory(this.root, journalDirectory(this.root));
      this.io.fsyncDirectory(transactionBase(this.root), { role: "journal-directory", key: null });
      const entries = FILE_KEYS.map((key) => new TransactionEntry({
        key,
        target: this.targets.pathFor(key),
        nextContent: this.contents[key],
      }));
      validateFlowIdentity(entries[0].toJSON(), { spec: this.spec, identity: this.identity });
      journal = new Journal({
        id: this.id,
        root: this.root,
        spec: this.spec,
        identity: this.identity,
        entries,
      });
      persistJournal({ journal, journalPath: this.journalPath, io: this.io });
      this.lock.setPhase("prepared");

      journal.setPhase("applying");
      persistJournal({ journal, journalPath: this.journalPath, io: this.io });
      this.lock.setPhase("applying");
      for (const entry of entries) {
        const temp = this.targets.tempFor(entry.key, this.id);
        this.io.writeAtomic(
          temp,
          decode(entry.next.content, entry.next.sha256, `${entry.key}.next`),
          entry.next.mode,
          { role: "temp", key: entry.key },
        );
        this.io.emit({ phase: "before-apply", key: entry.key, journalPath: this.journalPath });
        this.io.rename(temp, this.targets.pathFor(entry.key), { role: "target", key: entry.key });
        this.io.emit({ phase: "after-apply", key: entry.key, journalPath: this.journalPath });
      }

      journal.setPhase("targets-applied");
      persistJournal({ journal, journalPath: this.journalPath, io: this.io });
      this.lock.setPhase("targets-applied");
      journal.setPhase("committed");
      persistJournal({ journal, journalPath: this.journalPath, io: this.io });
      committed = true;
      this.lock.setPhase("committed");
      cleanupJournal({
        loaded: Journal.load({ root: this.root, journalPath: this.journalPath }),
        journalPath: this.journalPath,
        io: this.io,
      });
      this.lock.release();
      return { id: this.id, kind: JOURNAL_KIND, committed: true, authorityRoot: this.root };
    } catch (err) {
      if (err instanceof SimulatedTransactionCrash) {
        if (lockAcquired) this.lock.abandon();
        throw err;
      }
      if (!lockAcquired && err instanceof ReopenDraftTransactionError) throw err;
      if (!committed && journal?.phase === "committed" && fs.existsSync(this.journalPath)) {
        try {
          committed = Journal.load({ root: this.root, journalPath: this.journalPath }).raw.phase === "committed";
        } catch {
          committed = false;
        }
      }
      if (committed) {
        if (lockAcquired) this.lock.abandon();
        throw transactionError(`committed reopen-draft transaction cleanup failed: ${err.message}`, {
          code: "TRANSACTION_COMMIT_CLEANUP_FAILED",
          cause: err,
          journalPath: this.journalPath,
          lockPath: this.lock.path,
          committed: true,
        });
      }
      try {
        if (fs.existsSync(this.journalPath)) {
          const loaded = Journal.load({ root: this.root, journalPath: this.journalPath });
          restoreOriginals({ loaded, journalPath: this.journalPath, io: this.io });
          cleanupJournal({ loaded, journalPath: this.journalPath, io: this.io });
        }
        if (lockAcquired && fs.existsSync(this.lock.path)) this.lock.release();
      } catch (recoveryCause) {
        if (lockAcquired) this.lock.abandon();
        throw transactionError(`reopen-draft transaction failed and rollback failed: ${err.message}`, {
          code: "TRANSACTION_RECOVERY_FAILED",
          cause: err,
          recoveryCause,
          journalPath: this.journalPath,
          lockPath: this.lock.path,
        });
      }
      throw transactionError(`reopen-draft transaction failed and was rolled back: ${err.message}`, {
        code: "TRANSACTION_COMMIT_FAILED",
        cause: err,
        journalPath: this.journalPath,
        recovered: true,
      });
    }
  }

  static pendingJournalPaths(root) {
    const canonical = canonicalRoot(root);
    const directory = journalDirectory(canonical);
    if (!fs.existsSync(directory)) return [];
    assertSafeExistingPath(canonical, directory);
    const journals = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.name.endsWith(".json")) continue;
      if (!entry.isFile() || !/^[0-9a-f-]+\.json$/.test(entry.name)) {
        throw trustFailure(`foreign reopen-draft journal entry: ${entry.name}`);
      }
      journals.push(path.join(directory, entry.name));
    }
    journals.sort();
    if (journals.length > MAX_PENDING_JOURNALS) {
      throw transactionError(`too many pending reopen-draft journals: ${journals.length}`, {
        code: "TRANSACTION_RECOVERY_FAILED",
      });
    }
    return journals;
  }

  static recoverPending({ root, faultInjector = () => {} }) {
    const canonical = canonicalRoot(root);
    const io = new DurableIo(faultInjector);
    let claim;
    try {
      claim = claimRecovery(canonical, io);
    } catch (err) {
      if (err instanceof ReopenDraftTransactionError) throw err;
      throw transactionError(`reopen-draft recovery claim failed: ${err.message}`, {
        code: "TRANSACTION_RECOVERY_FAILED",
        cause: err,
      });
    }
    if (!claim) return [];
    const recovered = [];
    let journals = [];
    try {
      journals = this.pendingJournalPaths(canonical);
      const claimOwner = validateOwner(
        readJson(ownerPath(claim), "recovery claim owner"),
        { root: canonical, claim: true },
      ).raw;
      if (journals.length === 0) {
        if (!["acquired", "committed"].includes(claimOwner.recoveryOfPhase)) {
          throw trustFailure(
            `missing journal for transaction phase ${claimOwner.recoveryOfPhase ?? "unknown"}`,
            { lockPath: claim },
          );
        }
      }
      for (const journalPath of journals) {
        const loaded = Journal.load({ root: canonical, journalPath });
        if (
          claimOwner.authorityRoot !== loaded.root
          || claimOwner.spec !== loaded.spec
          || claimOwner.runId !== loaded.identity.runId
          || (claimOwner.issue ?? null) !== loaded.identity.issue
          || claimOwner.transactionId !== loaded.raw.id
        ) {
          throw trustFailure("transaction lock owner does not match journal authority", {
            journalPath,
            lockPath: claim,
          });
        }
        if (loaded.raw.phase === "committed") {
          verifyCommittedTargets(loaded);
        } else {
          restoreOriginals({ loaded, journalPath, io });
        }
        cleanupJournal({ loaded, journalPath, io });
        recovered.push({
          id: loaded.raw.id,
          kind: loaded.raw.kind,
          phase: loaded.raw.phase,
          journalPath,
          action: loaded.raw.phase === "committed" ? "kept-committed" : "restored-original",
        });
      }
      cleanupOwnerTransients({ root: canonical, claim, owner: claimOwner, io });
      releaseRecoveryClaim(canonical, claim, io);
      return recovered;
    } catch (err) {
      abandonRecoveryClaim(claim);
      if (err instanceof ReopenDraftTransactionError) {
        if (err.journalPath == null) err.journalPath = journals[0] ?? null;
        if (err.lockPath == null) err.lockPath = claim;
        throw err;
      }
      throw transactionError(`reopen-draft transaction recovery failed: ${err.message}`, {
        code: "TRANSACTION_RECOVERY_FAILED",
        cause: err,
        journalPath: this.pendingJournalPaths(canonical)[0] ?? null,
        lockPath: claim,
      });
    }
  }
}

export function discoverReopenDraftTransactionRoots({ root, mainRoot = root }) {
  const candidates = new Set([path.resolve(root), path.resolve(mainRoot)]);
  const worktrees = path.join(sentiDir(path.resolve(mainRoot)), "worktree");
  if (fs.existsSync(worktrees) && !fs.lstatSync(worktrees).isSymbolicLink()) {
    for (const entry of fs.readdirSync(worktrees, { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.add(path.join(worktrees, entry.name));
    }
  }
  return [...candidates].filter((candidate) => {
    try {
      canonicalRoot(candidate);
      return true;
    } catch {
      return false;
    }
  });
}

export class ReopenDraftRecoveryPreflight {
  constructor({ root, mainRoot = root, faultInjector = () => {} }) {
    this.roots = discoverReopenDraftTransactionRoots({ root, mainRoot });
    this.faultInjector = faultInjector;
    Object.freeze(this.roots);
    Object.freeze(this);
  }

  run() {
    return this.roots.flatMap((root) => ReopenDraftTransaction.recoverPending({
      root,
      faultInjector: this.faultInjector,
    }));
  }
}
