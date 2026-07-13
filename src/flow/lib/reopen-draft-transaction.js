import crypto from "crypto";
import fs from "fs";
import path from "path";
import { sentiDir } from "../../lib/config.js";

const JOURNAL_VERSION = 1;
const JOURNAL_KIND = "issue-441-reopen-draft";
const MAX_PENDING_JOURNALS = 100;

function digest(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function decodedContent(encoded, expectedDigest, field) {
  const content = Buffer.from(encoded, "base64");
  if (digest(content) !== expectedDigest) {
    throw new Error(`reopen-draft transaction checksum mismatch: ${field}`);
  }
  return content;
}

function fsyncDirectory(directory) {
  const fd = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function durableWrite(file, content, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, "w", mode);
  try {
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fsyncDirectory(path.dirname(file));
}

function durableRename(source, target) {
  fs.renameSync(source, target);
  fsyncDirectory(path.dirname(target));
}

function durableUnlink(file) {
  if (!fs.existsSync(file)) return;
  fs.unlinkSync(file);
  fsyncDirectory(path.dirname(file));
}

function journalDirectory(root) {
  return path.join(sentiDir(root), "transactions", "reopen-draft");
}

function pathWithinRoot(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, relativePath);
  if (absolute !== absoluteRoot && !absolute.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error(`transaction path escapes project root: ${relativePath}`);
  }
  return absolute;
}

class ReopenTransactionFile {
  constructor({ root, id, key, target, content }) {
    if (typeof content !== "string") throw new Error(`${key} transaction content must be a string`);
    this.key = key;
    this.target = path.relative(root, target);
    this.temp = path.relative(root, path.join(path.dirname(target), `.${path.basename(target)}.${id}.next`));
    const originalContent = fs.existsSync(target) ? fs.readFileSync(target) : null;
    const nextContent = Buffer.from(content);
    this.original = originalContent
      ? { exists: true, content: originalContent.toString("base64"), sha256: digest(originalContent) }
      : { exists: false, content: null };
    this.next = { content: nextContent.toString("base64"), sha256: digest(nextContent) };
    Object.freeze(this.original);
    Object.freeze(this.next);
    Object.freeze(this);
  }

  toJSON() {
    return {
      key: this.key,
      target: this.target,
      temp: this.temp,
      original: this.original,
      next: this.next,
    };
  }
}

class ReopenTransactionJournal {
  constructor({ id, entries, createdAt = new Date().toISOString() }) {
    this.version = JOURNAL_VERSION;
    this.kind = JOURNAL_KIND;
    this.id = id;
    this.createdAt = createdAt;
    this.entries = entries;
    Object.freeze(this.entries);
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      kind: this.kind,
      id: this.id,
      createdAt: this.createdAt,
      entries: this.entries.map((entry) => entry.toJSON()),
    };
  }

  static fromJSON(raw) {
    if (
      raw?.version !== JOURNAL_VERSION
      || raw?.kind !== JOURNAL_KIND
      || typeof raw.id !== "string"
      || !Array.isArray(raw.entries)
      || raw.entries.length !== 3
    ) {
      throw new Error("invalid reopen-draft transaction journal");
    }
    const keys = raw.entries.map((entry) => entry?.key);
    if (keys.join(",") !== "flow,spec,issueLog") {
      throw new Error("invalid reopen-draft transaction file set");
    }
    for (const entry of raw.entries) {
      if (
        typeof entry.target !== "string"
        || typeof entry.temp !== "string"
        || typeof entry.original?.exists !== "boolean"
        || (entry.original.exists && (
          typeof entry.original.content !== "string"
          || typeof entry.original.sha256 !== "string"
        ))
        || typeof entry.next?.content !== "string"
        || typeof entry.next?.sha256 !== "string"
      ) {
        throw new Error(`invalid reopen-draft transaction entry: ${entry?.key ?? "unknown"}`);
      }
      if (entry.original.exists) {
        decodedContent(entry.original.content, entry.original.sha256, `${entry.key}.original`);
      }
      decodedContent(entry.next.content, entry.next.sha256, `${entry.key}.next`);
    }
    return raw;
  }
}

export class ReopenDraftTransactionError extends Error {
  constructor(message, { code, cause, journalPath, recovered = false, recoveryCause = null } = {}) {
    super(message, { cause });
    this.name = "ReopenDraftTransactionError";
    this.code = code;
    this.journalPath = journalPath;
    this.recovered = recovered;
    this.recoveryCause = recoveryCause;
  }
}

export class SimulatedTransactionCrash extends Error {
  constructor(message = "simulated process crash") {
    super(message);
    this.name = "SimulatedTransactionCrash";
  }
}

function recoveryError(err, journalPath) {
  if (err instanceof ReopenDraftTransactionError && err.code === "TRANSACTION_RECOVERY_FAILED") return err;
  return new ReopenDraftTransactionError(
    `reopen-draft transaction recovery failed: ${err.message}`,
    {
      code: "TRANSACTION_RECOVERY_FAILED",
      cause: err,
      journalPath,
      recovered: false,
      recoveryCause: err,
    },
  );
}

function recoverJournal({ root, journalPath, faultInjector = () => {} }) {
  let journal;
  try {
    journal = ReopenTransactionJournal.fromJSON(JSON.parse(fs.readFileSync(journalPath, "utf8")));
    for (const entry of [...journal.entries].reverse()) {
      const target = pathWithinRoot(root, entry.target);
      const temp = pathWithinRoot(root, entry.temp);
      faultInjector({ phase: "before-restore", key: entry.key, journalPath });
      if (entry.original.exists) {
        const restoreTemp = `${target}.${journal.id}.restore`;
        durableWrite(
          restoreTemp,
          decodedContent(entry.original.content, entry.original.sha256, `${entry.key}.original`),
        );
        durableRename(restoreTemp, target);
      } else {
        durableUnlink(target);
      }
      durableUnlink(temp);
      faultInjector({ phase: "after-restore", key: entry.key, journalPath });
    }
    durableUnlink(journalPath);
    return { id: journal.id, kind: journal.kind, journalPath };
  } catch (err) {
    throw recoveryError(err, journalPath);
  }
}

export class ReopenDraftTransaction {
  constructor({ root, specPath, contents, faultInjector = () => {} }) {
    if (!root || !specPath) throw new Error("root and specPath are required");
    const specFile = pathWithinRoot(root, specPath);
    const specDirectory = path.dirname(specFile);
    const expectedKeys = ["flow", "spec", "issueLog"];
    if (!contents || Object.keys(contents).sort().join(",") !== [...expectedKeys].sort().join(",")) {
      throw new Error("reopen-draft transaction requires flow, spec, and issueLog contents");
    }
    this.root = path.resolve(root);
    this.id = crypto.randomUUID();
    this.faultInjector = faultInjector;
    this.entries = [
      new ReopenTransactionFile({
        root: this.root,
        id: this.id,
        key: "flow",
        target: path.join(specDirectory, "flow.json"),
        content: contents.flow,
      }),
      new ReopenTransactionFile({
        root: this.root,
        id: this.id,
        key: "spec",
        target: specFile,
        content: contents.spec,
      }),
      new ReopenTransactionFile({
        root: this.root,
        id: this.id,
        key: "issueLog",
        target: path.join(specDirectory, "issue-log.json"),
        content: contents.issueLog,
      }),
    ];
    this.journal = new ReopenTransactionJournal({ id: this.id, entries: this.entries });
    this.journalPath = path.join(journalDirectory(this.root), `${this.id}.json`);
  }

  commit() {
    const journalStagingPath = `${this.journalPath}.next`;
    try {
      durableWrite(journalStagingPath, `${JSON.stringify(this.journal.toJSON(), null, 2)}\n`);
      durableRename(journalStagingPath, this.journalPath);
      this.faultInjector({ phase: "journal-created", journalPath: this.journalPath });
      for (const entry of this.entries) {
        const target = pathWithinRoot(this.root, entry.target);
        const temp = pathWithinRoot(this.root, entry.temp);
        durableWrite(temp, decodedContent(entry.next.content, entry.next.sha256, `${entry.key}.next`));
        this.faultInjector({ phase: "before-apply", key: entry.key, journalPath: this.journalPath });
        durableRename(temp, target);
        this.faultInjector({ phase: "after-apply", key: entry.key, journalPath: this.journalPath });
      }
      durableUnlink(this.journalPath);
      return { id: this.id, kind: JOURNAL_KIND, committed: true };
    } catch (err) {
      if (err instanceof SimulatedTransactionCrash) throw err;
      if (!fs.existsSync(this.journalPath)) {
        durableUnlink(journalStagingPath);
        throw new ReopenDraftTransactionError(
          `reopen-draft transaction journal creation failed before target writes: ${err.message}`,
          {
            code: "TRANSACTION_COMMIT_FAILED",
            cause: err,
            journalPath: this.journalPath,
            recovered: true,
          },
        );
      }
      try {
        recoverJournal({ root: this.root, journalPath: this.journalPath, faultInjector: this.faultInjector });
      } catch (recoveryFailure) {
        throw new ReopenDraftTransactionError(
          `reopen-draft transaction failed and recovery did not complete: ${err.message}`,
          {
            code: "TRANSACTION_RECOVERY_FAILED",
            cause: err,
            journalPath: this.journalPath,
            recovered: false,
            recoveryCause: recoveryFailure,
          },
        );
      }
      throw new ReopenDraftTransactionError(
        `reopen-draft transaction commit failed and was rolled back: ${err.message}`,
        {
          code: "TRANSACTION_COMMIT_FAILED",
          cause: err,
          journalPath: this.journalPath,
          recovered: true,
        },
      );
    }
  }

  static pendingJournalPaths(root) {
    const directory = journalDirectory(root);
    if (!fs.existsSync(directory)) return [];
    const paths = fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directory, entry.name))
      .sort();
    if (paths.length > MAX_PENDING_JOURNALS) {
      throw new ReopenDraftTransactionError(
        `too many pending reopen-draft transaction journals: ${paths.length}`,
        { code: "TRANSACTION_RECOVERY_FAILED", recovered: false },
      );
    }
    return paths;
  }

  static recoverPending({ root, faultInjector = () => {} }) {
    return this.pendingJournalPaths(root).map((journalPath) => (
      recoverJournal({ root: path.resolve(root), journalPath, faultInjector })
    ));
  }
}

export class ReopenDraftRecoveryPreflight {
  constructor({ root, faultInjector = () => {} }) {
    if (!root) throw new Error("transaction recovery preflight requires root");
    this.root = root;
    this.faultInjector = faultInjector;
    Object.freeze(this);
  }

  run() {
    return ReopenDraftTransaction.recoverPending({
      root: this.root,
      faultInjector: this.faultInjector,
    });
  }
}
