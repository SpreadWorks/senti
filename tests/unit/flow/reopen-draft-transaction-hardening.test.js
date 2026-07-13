import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Container } from "../../../src/lib/container.js";
import { Command } from "../../../src/lib/command.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import {
  ReopenDraftTransaction,
  ReopenDraftTransactionError,
  SimulatedTransactionCrash,
} from "../../../src/flow/lib/reopen-draft-transaction.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC = "specs/441-transaction-hardening/spec.json";
const IDENTITY = Object.freeze({ runId: "run-441-hardening", issue: 441 });

function writeFile(file, content, mode = 0o644) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode });
  fs.chmodSync(file, mode);
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function targetPaths(root) {
  const specDir = path.join(root, path.dirname(SPEC));
  return {
    flow: path.join(specDir, "flow.json"),
    spec: path.join(specDir, "spec.json"),
    issueLog: path.join(specDir, "issue-log.json"),
  };
}

function setupFiles(root, { issueLog = true } = {}) {
  const targets = targetPaths(root);
  writeFile(targets.flow, json({ spec: SPEC, runId: IDENTITY.runId, issue: 441, marker: "original-flow" }), 0o640);
  writeFile(targets.spec, json({ marker: "original-spec" }), 0o644);
  if (issueLog) writeFile(targets.issueLog, json({ entries: [{ marker: "original-log" }] }), 0o600);
  return targets;
}

function nextContents() {
  return {
    flow: json({ spec: SPEC, runId: IDENTITY.runId, issue: 441, marker: "next-flow" }),
    spec: json({ marker: "next-spec" }),
    issueLog: json({ entries: [{ marker: "next-log" }] }),
  };
}

function snapshot(files) {
  return Object.fromEntries(Object.entries(files).map(([key, file]) => [key, {
    exists: fs.existsSync(file),
    content: fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null,
    mode: fs.existsSync(file) ? fs.statSync(file).mode & 0o777 : null,
  }]));
}

function transactionResidue(root) {
  const found = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "reopen-draft.lock" || entry.name.startsWith("reopen-draft.recovery-")) {
          found.push(file);
        }
        visit(file);
      } else if (/\.(?:next|restore|stage)$/.test(entry.name) || entry.name.endsWith(".json")) {
        if (file.includes(`${path.sep}.senti${path.sep}transactions${path.sep}`)) found.push(file);
        if (file.includes(`${path.sep}specs${path.sep}`) && /\.(?:next|restore|stage)$/.test(entry.name)) {
          found.push(file);
        }
      }
    }
  };
  visit(path.join(root, ".senti", "transactions"));
  visit(path.join(root, "specs"));
  return found.sort();
}

function transaction(root, overrides = {}) {
  return new ReopenDraftTransaction({
    root,
    specPath: SPEC,
    identity: IDENTITY,
    contents: nextContents(),
    ...overrides,
  });
}

function readJournal(root) {
  const journalPath = ReopenDraftTransaction.pendingJournalPaths(root)[0];
  return { journalPath, journal: JSON.parse(fs.readFileSync(journalPath, "utf8")) };
}

function waitForFile(file, timeoutMs = 5000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (fs.existsSync(file)) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error(`timeout waiting for ${file}`));
      setTimeout(poll, 20);
    };
    poll();
  });
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`child exit ${code}/${signal}`)));
  });
}

describe("Issue #441 durable reopen transaction hardening", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("rejects foreign authority, path, key, checksum, and symlink journal trust violations", () => {
    const mutations = [
      ["foreign root", (journal) => { journal.authority.root = "/tmp/foreign-authority"; }],
      ["foreign spec", (journal) => { journal.authority.spec = "../victim/spec.json"; }],
      ["foreign key", (journal) => { journal.entries[0].key = "victim"; }],
      ["checksum", (journal) => { journal.entries[0].original.sha256 = "0".repeat(64); }],
    ];
    for (const [name, mutate] of mutations) {
      tmp = createTmpDir(`reopen-trust-${name.replace(" ", "-")}-`);
      setupFiles(tmp);
      assert.throws(
        () => transaction(tmp, {
          faultInjector(event) {
            if (event.phase === "after-apply" && event.key === "flow") {
              throw new SimulatedTransactionCrash(name);
            }
          },
        }).commit(),
        SimulatedTransactionCrash,
      );
      const { journalPath, journal } = readJournal(tmp);
      mutate(journal);
      fs.writeFileSync(journalPath, json(journal));
      assert.throws(
        () => ReopenDraftTransaction.recoverPending({ root: tmp }),
        (err) => err.code === "TRANSACTION_TRUST_FAILED" || err.code === "TRANSACTION_RECOVERY_FAILED",
        name,
      );
      assert.equal(fs.existsSync(journalPath), true, name);
      removeTmpDir(tmp);
      tmp = null;
    }

    tmp = createTmpDir("reopen-target-symlink-");
    const targets = setupFiles(tmp);
    const outside = path.join(tmp, "outside.json");
    writeFile(outside, "outside\n");
    fs.unlinkSync(targets.issueLog);
    fs.symlinkSync(outside, targets.issueLog);
    assert.throws(
      () => transaction(tmp),
      (err) => err.code === "TRANSACTION_TRUST_FAILED",
    );
  });

  it("rejects symlinked spec parents before journal or lock creation", () => {
    tmp = createTmpDir("reopen-parent-symlink-");
    const outside = path.join(tmp, "outside-specs", "441-transaction-hardening");
    fs.mkdirSync(outside, { recursive: true });
    fs.symlinkSync(path.join(tmp, "outside-specs"), path.join(tmp, "specs"));
    assert.throws(
      () => transaction(tmp),
      (err) => err.code === "TRANSACTION_TRUST_FAILED",
    );
    assert.deepEqual(ReopenDraftTransaction.pendingJournalPaths(tmp), []);
  });

  it("restores original modes on rollback and preserves existing/default modes on commit", () => {
    tmp = createTmpDir("reopen-modes-");
    const targets = setupFiles(tmp, { issueLog: false });
    const before = snapshot(targets);
    assert.throws(
      () => transaction(tmp, {
        faultInjector(event) {
          if (event.phase === "before-apply" && event.key === "issueLog") throw new Error("mode rollback");
        },
      }).commit(),
      (err) => err.code === "TRANSACTION_COMMIT_FAILED",
    );
    assert.deepEqual(snapshot(targets), before);

    const result = transaction(tmp).commit();
    assert.equal(result.committed, true);
    assert.equal(fs.statSync(targets.flow).mode & 0o777, 0o640);
    assert.equal(fs.statSync(targets.spec).mode & 0o777, 0o644);
    assert.equal(fs.statSync(targets.issueLog).mode & 0o777, 0o644);
  });

  it("rolls back crashes after every apply but preserves next bytes for committed recovery", () => {
    for (const key of ["flow", "spec", "issueLog"]) {
      tmp = createTmpDir(`reopen-crash-${key}-`);
      const targets = setupFiles(tmp);
      const before = snapshot(targets);
      assert.throws(
        () => transaction(tmp, {
          faultInjector(event) {
            if (event.phase === "after-apply" && event.key === key) throw new SimulatedTransactionCrash(key);
          },
        }).commit(),
        SimulatedTransactionCrash,
      );
      assert.equal(readJournal(tmp).journal.phase, "applying");
      ReopenDraftTransaction.recoverPending({ root: tmp });
      assert.deepEqual(snapshot(targets), before, key);
      removeTmpDir(tmp);
      tmp = null;
    }

    tmp = createTmpDir("reopen-committed-crash-");
    const targets = setupFiles(tmp);
    const next = nextContents();
    assert.throws(
      () => transaction(tmp, {
        faultInjector(event) {
          if (event.phase === "phase-durable" && event.transactionPhase === "committed") {
            throw new SimulatedTransactionCrash("committed");
          }
        },
      }).commit(),
      SimulatedTransactionCrash,
    );
    assert.equal(readJournal(tmp).journal.phase, "committed");
    ReopenDraftTransaction.recoverPending({ root: tmp });
    assert.equal(fs.readFileSync(targets.flow, "utf8"), next.flow);
    assert.equal(fs.readFileSync(targets.spec, "utf8"), next.spec);
    assert.equal(fs.readFileSync(targets.issueLog, "utf8"), next.issueLog);
  });

  it("fails safely across journal, temp, target rename, directory fsync, and cleanup boundaries", () => {
    tmp = createTmpDir("reopen-stage-crash-");
    setupFiles(tmp);
    assert.throws(
      () => transaction(tmp, {
        faultInjector(event) {
          if (event.phase === "before-rename" && event.role === "journal") {
            throw new SimulatedTransactionCrash("journal stage");
          }
        },
      }).commit(),
      SimulatedTransactionCrash,
    );
    assert.notDeepEqual(transactionResidue(tmp), []);
    ReopenDraftTransaction.recoverPending({ root: tmp });
    assert.deepEqual(transactionResidue(tmp), []);
    removeTmpDir(tmp);
    tmp = null;

    const failures = [
      ["journal rename", (event) => event.phase === "before-rename" && event.role === "journal"],
      ["temp rename", (event) => event.phase === "before-rename" && event.role === "temp" && event.key === "flow"],
      ["temp durability", (event) => event.phase === "before-fsync-dir" && event.role === "temp"],
      ["target rename", (event) => event.phase === "before-rename" && event.role === "target" && event.key === "spec"],
      ["target fsync", (event) => event.phase === "before-fsync-dir" && event.role === "target" && event.key === "issueLog"],
    ];
    for (const [name, matches] of failures) {
      tmp = createTmpDir(`reopen-durability-${name.replace(" ", "-")}-`);
      const targets = setupFiles(tmp);
      const before = snapshot(targets);
      assert.throws(
        () => transaction(tmp, { faultInjector(event) { if (matches(event)) throw new Error(name); } }).commit(),
        (err) => ["TRANSACTION_COMMIT_FAILED", "TRANSACTION_RECOVERY_FAILED"].includes(err.code),
        name,
      );
      if (ReopenDraftTransaction.pendingJournalPaths(tmp).length > 0) {
        ReopenDraftTransaction.recoverPending({ root: tmp });
      }
      assert.deepEqual(snapshot(targets), before, name);
      assert.deepEqual(transactionResidue(tmp), [], name);
      removeTmpDir(tmp);
      tmp = null;
    }

    tmp = createTmpDir("reopen-cleanup-fsync-");
    const targets = setupFiles(tmp);
    assert.throws(
      () => transaction(tmp, {
        faultInjector(event) {
          if (event.phase === "after-unlink" && event.role === "journal") throw new Error("cleanup fsync");
        },
      }).commit(),
      (err) => err.code === "TRANSACTION_COMMIT_CLEANUP_FAILED" && err.committed === true,
    );
    assert.equal(JSON.parse(fs.readFileSync(targets.flow, "utf8")).marker, "next-flow");

    tmp = createTmpDir("reopen-committed-journal-fsync-");
    const committedTargets = setupFiles(tmp);
    assert.throws(
      () => transaction(tmp, {
        faultInjector(event) {
          if (
            event.phase === "before-fsync-dir"
            && event.role === "journal"
            && event.transactionPhase === "committed"
          ) {
            throw new Error("committed journal directory fsync");
          }
        },
      }).commit(),
      (err) => err.code === "TRANSACTION_COMMIT_CLEANUP_FAILED" && err.committed === true,
    );
    assert.equal(JSON.parse(fs.readFileSync(committedTargets.flow, "utf8")).marker, "next-flow");
  });

  it("rejects a stale lock owner that does not match its journal", () => {
    tmp = createTmpDir("reopen-owner-mismatch-");
    setupFiles(tmp);
    assert.throws(
      () => transaction(tmp, {
        faultInjector(event) {
          if (event.phase === "after-apply" && event.key === "flow") {
            throw new SimulatedTransactionCrash("owner mismatch");
          }
        },
      }).commit(),
      SimulatedTransactionCrash,
    );
    const lock = path.join(tmp, ".senti", "transactions", "reopen-draft.lock", "owner.json");
    const owner = JSON.parse(fs.readFileSync(lock, "utf8"));
    owner.transactionId = "foreign-transaction";
    fs.writeFileSync(lock, json(owner));
    assert.throws(
      () => ReopenDraftTransaction.recoverPending({ root: tmp }),
      (err) => err.code === "TRANSACTION_TRUST_FAILED",
    );
    assert.equal(ReopenDraftTransaction.pendingJournalPaths(tmp).length, 1);
  });

  it("recovers before dispatcher hook context reads and fails closed without runtime metadata on recovery failure", async () => {
    tmp = createTmpDir("reopen-dispatch-preflight-");
    const targets = setupFiles(tmp);
    assert.throws(
      () => transaction(tmp, {
        faultInjector(event) {
          if (event.phase === "after-apply" && event.key === "flow") throw new SimulatedTransactionCrash("dispatch");
        },
      }).commit(),
      SimulatedTransactionCrash,
    );
    let observedMarker = null;
    class ReadCommand extends Command {
      static outputMode = "raw";
      execute() { return "ok"; }
    }
    const container = new Container();
    container.register("paths", { root: tmp, agentWorkDir: path.join(tmp, ".agent-work") });
    container.register("mainRoot", tmp);
    await dispatch({
      container,
      entry: { command: async () => ({ default: ReadCommand }), requiresFlow: false },
      argv: [],
      envelopeType: "run",
      envelopeKey: "arbitrary",
      stdout: () => {},
      setExitCode: () => {},
      buildHookCtx: () => {
        observedMarker = JSON.parse(fs.readFileSync(targets.flow, "utf8")).marker;
        return { flowState: null };
      },
    });
    assert.equal(observedMarker, "original-flow");

    assert.throws(
      () => transaction(tmp, {
        faultInjector(event) {
          if (event.phase === "after-apply" && event.key === "flow") throw new SimulatedTransactionCrash("tamper");
        },
      }).commit(),
      SimulatedTransactionCrash,
    );
    const { journalPath } = readJournal(tmp);
    fs.writeFileSync(journalPath, "{broken\n");
    const before = snapshot(targets);
    let hookReads = 0;
    let commandLoads = 0;
    const out = [];
    await dispatch({
      container,
      entry: { command: async () => { commandLoads += 1; return { default: ReadCommand }; }, requiresFlow: false },
      argv: [],
      envelopeType: "run",
      envelopeKey: "arbitrary",
      runtimeLog: true,
      stdout: (chunk) => out.push(chunk),
      setExitCode: () => {},
      buildHookCtx: () => { hookReads += 1; return { flowState: null }; },
    });
    const envelope = JSON.parse(out.join(""));
    assert.equal(envelope.errors[0].code, "TRANSACTION_RECOVERY_FAILED");
    assert.equal(hookReads, 0);
    assert.equal(commandLoads, 0);
    assert.deepEqual(snapshot(targets), before);
    assert.equal(fs.existsSync(path.join(tmp, ".tmp", "logs", "no-flow.log")), false);
  });

  it("discovers an authority-local worktree journal before a main-root dispatcher read", async () => {
    tmp = createTmpDir("reopen-dispatch-worktree-");
    const worktree = path.join(tmp, ".senti", "worktree", "feature-441-hardening");
    const targets = setupFiles(worktree);
    assert.throws(
      () => transaction(worktree, {
        faultInjector(event) {
          if (event.phase === "after-apply" && event.key === "flow") {
            throw new SimulatedTransactionCrash("worktree crash");
          }
        },
      }).commit(),
      SimulatedTransactionCrash,
    );
    assert.equal(ReopenDraftTransaction.pendingJournalPaths(tmp).length, 0);
    assert.equal(ReopenDraftTransaction.pendingJournalPaths(worktree).length, 1);
    let observedMarker = null;
    class ReadCommand extends Command {
      static outputMode = "raw";
      execute() { return "ok"; }
    }
    const container = new Container();
    container.register("paths", { root: tmp });
    container.register("mainRoot", tmp);
    await dispatch({
      container,
      entry: { command: async () => ({ default: ReadCommand }), requiresFlow: false },
      argv: [],
      envelopeType: "run",
      envelopeKey: "worktree-recovery",
      stdout: () => {},
      setExitCode: () => {},
      buildHookCtx: () => {
        observedMarker = JSON.parse(fs.readFileSync(targets.flow, "utf8")).marker;
        return { flowState: null };
      },
    });
    assert.equal(observedMarker, "original-flow");
    assert.equal(ReopenDraftTransaction.pendingJournalPaths(worktree).length, 0);
  });

  it("uses an exclusive live-owner lock and never rolls back another process", async () => {
    tmp = createTmpDir("reopen-concurrency-");
    setupFiles(tmp);
    const barrier = path.join(tmp, "barrier");
    const release = path.join(tmp, "release");
    const moduleUrl = pathToFileURL(path.resolve("src/flow/lib/reopen-draft-transaction.js")).href;
    const script = path.join(tmp, "holder.mjs");
    writeFile(script, `
      import fs from "node:fs";
      import { ReopenDraftTransaction } from ${JSON.stringify(moduleUrl)};
      const tx = new ReopenDraftTransaction({
        root: ${JSON.stringify(tmp)},
        specPath: ${JSON.stringify(SPEC)},
        identity: ${JSON.stringify(IDENTITY)},
        contents: ${JSON.stringify(nextContents())},
        faultInjector(event) {
          if (event.phase !== "lock-acquired") return;
          fs.writeFileSync(${JSON.stringify(barrier)}, "ready");
          while (!fs.existsSync(${JSON.stringify(release)})) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
        },
      });
      tx.commit();
    `);
    const child = spawn(process.execPath, [script], { stdio: ["ignore", "pipe", "pipe"] });
    await waitForFile(barrier);
    try {
      assert.throws(
        () => ReopenDraftTransaction.recoverPending({ root: tmp }),
        (err) => err.code === "TRANSACTION_IN_PROGRESS",
      );
      assert.throws(
        () => transaction(tmp).commit(),
        (err) => err.code === "TRANSACTION_IN_PROGRESS",
      );
    } finally {
      fs.writeFileSync(release, "go");
      await waitForExit(child);
    }
    assert.deepEqual(ReopenDraftTransaction.pendingJournalPaths(tmp), []);
  });
});
