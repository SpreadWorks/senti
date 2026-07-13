// spec: R9 R14
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { runDetachedAutoRescue } from "../../../src/flow/lib/run-finalize-cleanup.js";
import { AtomicJsonFile } from "../../../src/lib/atomic-json-file.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCleanupSrc() {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
    "utf8",
  );
}

const OLD_BASE = "1".repeat(40);
const NEW_BASE = "2".repeat(40);
const MOVED_BASE = "3".repeat(40);

function gitResult(ok, stdout = "", stderr = "") {
  return { ok, status: ok ? 0 : 1, stdout, stderr, signal: null, killed: false };
}

function rescueArgs(root, runGitFn, suffix) {
  const gitDirPath = path.join(root, ".git", "worktrees", `fake-${suffix}`);
  return {
    mainRepoPath: root,
    baseBranch: "main",
    baseline: "0".repeat(40),
    featureBranch: "feature/rescue",
    specId: "253-rescue",
    range: `${"0".repeat(40)}..feature/rescue`,
    runGitFn,
    worktreeAuthoritySource: {
      capture(_worktreePath, expectedHeadSha = null) {
        return {
          worktreeDev: 1,
          worktreeIno: 2,
          gitDirPath,
          gitDirDev: 3,
          gitDirIno: 4,
          headSha: expectedHeadSha || OLD_BASE,
        };
      },
      assertCurrent() {},
      assertAbsent() {},
    },
    tempWorktreePathFactory: () => path.join(os.tmpdir(), `senti-rescue-tmp-${suffix}`),
  };
}

function autoRescueJournalDirectory(root) {
  return path.join(root, ".git", "senti", "recovery", "auto-rescue");
}

function assertCompletedAutoRescueJournal(root) {
  const directory = autoRescueJournalDirectory(root);
  const files = fs.readdirSync(directory);
  assert.equal(files.length, 1);
  const journal = JSON.parse(fs.readFileSync(path.join(directory, files[0]), "utf8"));
  assert.equal(journal.phase, "completed");
  return journal;
}

describe("R9: --auto-rescue cherry-picks safely with proper preconditions", () => {
  it("R9: auto-rescue path detects MAIN_REPO_DIRTY and halts before cherry-pick", () => {
    const src = readCleanupSrc();
    assert.ok(src.includes("MAIN_REPO_DIRTY"), "MAIN_REPO_DIRTY code required");
    assert.ok(
      /["']status["'][\s\S]{0,80}["']--porcelain["']/.test(src),
      "auto-rescue must check main repo dirty state via git status --porcelain",
    );
  });
  it("R9: auto-rescue handles baseBranch lock with detached worktree fallback or MAIN_REPO_LOCKED", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("worktree add") || src.includes("MAIN_REPO_LOCKED") || src.includes("--detach"),
      "auto-rescue must handle baseBranch lock (detached fallback or explicit lock code)",
    );
  });
  it("R9: cherry-pick conflict triggers --abort and CHERRY_PICK_CONFLICT halt", () => {
    const src = readCleanupSrc();
    assert.ok(src.includes("CHERRY_PICK_CONFLICT"), "CHERRY_PICK_CONFLICT code required");
    assert.ok(
      src.includes("cherry-pick") && src.includes("--abort"),
      "auto-rescue conflict path must invoke cherry-pick --abort to restore state",
    );
  });
  it("R9: empty patch (duplicate apply) is handled via cherry-pick --skip", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("--skip"),
      "auto-rescue must use cherry-pick --skip for empty/duplicate patches",
    );
  });
  it("R9: detached rescue updates the base ref with the probed old OID as CAS authority", () => {
    const root = createTmpDir("auto-rescue-cas-contract-");
    let registered = false;
    let currentBase = OLD_BASE;
    const runGitFn = (args) => {
      if (args.includes("--verify")) return gitResult(true, `${OLD_BASE}\n`);
      if (args.includes("list") && args.includes("--porcelain")) {
        return gitResult(true, registered ? `worktree ${path.join(os.tmpdir(), "senti-rescue-tmp-cas-contract")}\n` : "");
      }
      if (args.includes("add") && args.includes("--detach")) {
        registered = true;
        return gitResult(true);
      }
      if (args.includes("cherry-pick")) return gitResult(true);
      if (args.includes("rev-parse") && args.includes("HEAD")) return gitResult(true, `${NEW_BASE}\n`);
      if (args.includes("update-ref")) {
        assert.equal(args.at(-2), NEW_BASE);
        assert.equal(args.at(-1), OLD_BASE);
        currentBase = MOVED_BASE;
        return gitResult(false, "", "expected old OID mismatch");
      }
      if (args.includes("remove") && args.includes("--force")) {
        registered = false;
        return gitResult(true);
      }
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    };
    try {
      const result = runDetachedAutoRescue(rescueArgs(root, runGitFn, "cas-contract"));
      assert.equal(result.code, "MAIN_REPO_LOCKED");
      assert.equal(currentBase, MOVED_BASE);
    } finally {
      removeTmpDir(root);
    }
  });
  it("R9: detached rescue journals and verifies temporary worktree cleanup", () => {
    const src = readCleanupSrc();
    assert.ok(src.includes("AutoRescueCleanupJournal"), "cleanup needs durable retry authority");
    assert.match(
      src,
      /const cleanupRes = runGitFn\([\s\S]{0,160}"worktree", "remove"[\s\S]{0,240}if \(!cleanupRes\.ok\)/,
      "temporary worktree removal failure must be checked before teardown",
    );
  });
});

describe("R14: audit log durability and dirty-check exclusion", () => {
  it("R14: audit log writes to main repo path (not worktree) for cherry-pick conflict", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("appendIssueLog(mainRepoPath, state.spec"),
      "conflict path must persist audit log to main repo",
    );
  });
  it("R14: dirty-check excludes issue-log.json via pathspec when retrying after conflict", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("issue-log.json") &&
        (src.includes(":!") || src.includes("pathspec") || src.includes("exclude")),
      "dirty check must exclude issue-log.json so retry after conflict is not blocked",
    );
  });
  it("R14: audit rollback uses stable-id compensation through the shared store", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("IssueLogStore") && src.includes(".compensate(idempotencyKey)"),
      "rollback must remove only its stable audit id through IssueLogStore",
    );
    assert.ok(!src.includes("saveIssueLog("), "whole-file issue-log rollback must not remain");
  });
});

describe("R9: detached auto-rescue transaction authority", () => {
  it("fails closed when the cherry-pick state probe itself fails", () => {
    const root = createTmpDir("auto-rescue-state-probe-failure-");
    const temp = path.join(os.tmpdir(), "senti-rescue-tmp-state-probe-failure");
    let registered = false;
    const runGitFn = (args) => {
      if (args.includes("CHERRY_PICK_HEAD")) {
        return { ...gitResult(false, "", "state probe failed"), status: 2 };
      }
      if (args.includes("--verify")) return gitResult(true, `${OLD_BASE}\n`);
      if (args.includes("list") && args.includes("--porcelain")) {
        return gitResult(true, registered ? `worktree ${temp}\n` : "");
      }
      if (args.includes("add") && args.includes("--detach")) {
        registered = true;
        return gitResult(true);
      }
      if (args.includes("--skip")) return gitResult(true);
      if (args.includes("cherry-pick")) return gitResult(false, "", "nothing to commit");
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    };
    try {
      assert.throws(
        () => runDetachedAutoRescue(rescueArgs(root, runGitFn, "state-probe-failure")),
        (error) => error.code === "AUTO_RESCUE_CHERRY_PICK_STATE_FAILED"
          && /state probe failed/.test(error.message),
      );
      const journalDirectory = autoRescueJournalDirectory(root);
      const journalPath = path.join(journalDirectory, fs.readdirSync(journalDirectory)[0]);
      assert.equal(JSON.parse(fs.readFileSync(journalPath, "utf8")).phase, "worktree-added");
    } finally {
      removeTmpDir(root);
    }
  });

  for (const crashPhase of ["ref-update-prepared", "base-updated"]) {
    it(`resumes ${crashPhase} crash with exactly-once body and ref mutation`, () => {
      const root = createTmpDir(`auto-rescue-ref-crash-${crashPhase}-`);
      const temp = path.join(os.tmpdir(), `senti-rescue-tmp-ref-crash-${crashPhase}`);
      let registered = false;
      let currentBase = OLD_BASE;
      let cherryPicks = 0;
      let updates = 0;
      const runGitFn = (args) => {
        if (args.includes("--verify")) return gitResult(true, `${currentBase}\n`);
        if (args.includes("list") && args.includes("--porcelain")) {
          return gitResult(true, registered ? `worktree ${temp}\n` : "");
        }
        if (args.includes("add") && args.includes("--detach")) {
          registered = true;
          return gitResult(true);
        }
        if (args.includes("cherry-pick")) {
          cherryPicks += 1;
          return gitResult(true);
        }
        if (args.includes("rev-parse") && args.includes("HEAD")) return gitResult(true, `${NEW_BASE}\n`);
        if (args.includes("update-ref")) {
          updates += 1;
          assert.equal(args.at(-2), NEW_BASE);
          assert.equal(args.at(-1), OLD_BASE);
          if (currentBase !== OLD_BASE) return gitResult(false, "", "old OID mismatch");
          currentBase = NEW_BASE;
          return gitResult(true);
        }
        if (args.includes("remove") && args.includes("--force")) {
          registered = false;
          return gitResult(true);
        }
        throw new Error(`unexpected git command: ${args.join(" ")}`);
      };
      const originalWrite = AtomicJsonFile.prototype.write;
      let injected = false;
      AtomicJsonFile.prototype.write = function injectRefCrash(value) {
        if (!injected && value?.phase === crashPhase) {
          injected = true;
          if (crashPhase === "ref-update-prepared") originalWrite.call(this, value);
          throw new Error(`crash at ${crashPhase}`);
        }
        return originalWrite.call(this, value);
      };
      try {
        assert.throws(
          () => runDetachedAutoRescue(rescueArgs(root, runGitFn, `ref-crash-${crashPhase}`)),
          new RegExp(crashPhase),
        );
      } finally {
        AtomicJsonFile.prototype.write = originalWrite;
      }
      try {
        const resumed = runDetachedAutoRescue(rescueArgs(root, runGitFn, `ref-crash-${crashPhase}`));
        assert.equal(resumed.ok, true, JSON.stringify(resumed));
        assert.equal(currentBase, NEW_BASE);
        assert.equal(cherryPicks, 1);
        assert.equal(updates, 1);
        assert.equal(registered, false);
      } finally {
        removeTmpDir(root);
      }
    });
  }

  for (const scenario of [
    {
      name: "conflict abort",
      initialError: "content conflict",
      configureFailure(args) {
        if (args.includes("diff") && args.includes("--diff-filter=U")) {
          return gitResult(true, "conflict.txt\n");
        }
        return null;
      },
    },
    {
      name: "empty-patch skip abort",
      initialError: "nothing to commit",
      configureFailure(args) {
        if (args.includes("--skip")) return gitResult(false, "", "skip failed");
        return null;
      },
    },
  ]) {
    it(`preserves primary and ${scenario.name} failure until an explicit cleanup retry`, () => {
      const suffix = scenario.name.replaceAll(" ", "-");
      const root = createTmpDir(`auto-rescue-${suffix}-`);
      const temp = path.join(os.tmpdir(), `senti-rescue-tmp-${suffix}`);
      let registered = false;
      let bodyCalls = 0;
      let abortCalls = 0;
      let cleanupCalls = 0;
      const mutations = [];
      const runGitFn = (args) => {
        if (args.includes("--verify")) return gitResult(true, `${OLD_BASE}\n`);
        if (args.includes("list") && args.includes("--porcelain")) {
          return gitResult(true, registered ? `worktree ${temp}\n` : "");
        }
        if (args.includes("add") && args.includes("--detach")) {
          registered = true;
          mutations.push("add");
          return gitResult(true);
        }
        if (args.includes("--abort")) {
          abortCalls += 1;
          mutations.push("abort");
          return gitResult(false, "", "abort failed");
        }
        const configured = scenario.configureFailure(args);
        if (configured) return configured;
        if (args.includes("cherry-pick")) {
          bodyCalls += 1;
          mutations.push("body");
          return gitResult(false, "", scenario.initialError);
        }
        if (args.includes("update-ref")) {
          mutations.push("update-ref");
          return gitResult(true);
        }
        if (args.includes("remove") && args.includes("--force")) {
          cleanupCalls += 1;
          mutations.push("cleanup");
          registered = false;
          return gitResult(true);
        }
        throw new Error(`unexpected git command: ${args.join(" ")}`);
      };
      const args = rescueArgs(root, runGitFn, suffix);
      try {
        let failure;
        try {
          runDetachedAutoRescue(args);
          assert.fail("expected ordered cherry-pick and abort failure");
        } catch (error) {
          failure = error;
        }
        assert.ok(failure instanceof AggregateError);
        assert.equal(failure.errors.length, 2);
        assert.equal(failure.errors[0].code, "CHERRY_PICK_CONFLICT");
        assert.equal(failure.errors[1].code, "CHERRY_PICK_ABORT_FAILED");
        assert.equal(failure.cause, failure.errors[0]);
        assert.equal(failure.cleanupAuthority.phase, "abort-failed");
        assert.equal(failure.cleanupAuthority.residue.worktree, true);
        assert.equal(failure.cleanupAuthority.residue.journal, true);
        assert.equal(bodyCalls, 1);
        assert.equal(abortCalls, 1);
        assert.equal(cleanupCalls, 0);
        assert.equal(mutations.at(-1), "abort");
        assert.ok(!mutations.includes("update-ref"));

        const journalDirectory = autoRescueJournalDirectory(root);
        const journalPath = path.join(journalDirectory, fs.readdirSync(journalDirectory)[0]);
        const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
        assert.equal(journal.phase, "abort-failed");
        assert.equal(journal.outcome.code, "CHERRY_PICK_CONFLICT");
        assert.equal(journal.outcome.abortFailure.code, "CHERRY_PICK_ABORT_FAILED");
        assert.equal(journal.outcome.abortFailure.stderr, "abort failed");

        const recovered = runDetachedAutoRescue(args);
        assert.equal(recovered.code, "CHERRY_PICK_CONFLICT");
        assert.equal(recovered.abortFailure.code, "CHERRY_PICK_ABORT_FAILED");
        assert.equal(bodyCalls, 1);
        assert.equal(abortCalls, 1);
        assert.equal(cleanupCalls, 1);
        assert.equal(registered, false);
        assert.equal(assertCompletedAutoRescueJournal(root).outcome.code, "CHERRY_PICK_CONFLICT");
      } finally {
        removeTmpDir(root);
      }
    });
  }

  it("preserves a base ref that moves after the old-OID probe", () => {
    const root = createTmpDir("auto-rescue-cas-");
    let currentBase = OLD_BASE;
    let registered = false;
    const updateCalls = [];
    const runGitFn = (args) => {
      if (args.includes("--verify")) return gitResult(true, `${OLD_BASE}\n`);
      if (args.includes("list") && args.includes("--porcelain")) {
        const temp = path.join(os.tmpdir(), "senti-rescue-tmp-cas");
        return gitResult(true, registered ? `worktree ${temp}\n` : "");
      }
      if (args.includes("add") && args.includes("--detach")) {
        registered = true;
        return gitResult(true);
      }
      if (args.includes("cherry-pick")) return gitResult(true);
      if (args.includes("rev-parse") && args.includes("HEAD")) return gitResult(true, `${NEW_BASE}\n`);
      if (args.includes("update-ref")) {
        updateCalls.push([...args]);
        currentBase = MOVED_BASE;
        const expected = args.at(-1);
        if (expected !== currentBase) return gitResult(false, "", "expected old OID mismatch");
        currentBase = NEW_BASE;
        return gitResult(true);
      }
      if (args.includes("remove") && args.includes("--force")) {
        registered = false;
        return gitResult(true);
      }
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    };
    try {
      const result = runDetachedAutoRescue(rescueArgs(root, runGitFn, "cas"));
      assert.equal(result.code, "MAIN_REPO_LOCKED");
      assert.equal(currentBase, MOVED_BASE);
      assert.equal(updateCalls.length, 1);
      assert.equal(updateCalls[0].at(-1), OLD_BASE);
      assert.equal(registered, false);
    } finally {
      removeTmpDir(root);
    }
  });

  it("resumes cleanup after a successful ref update without replaying body mutation", () => {
    const root = createTmpDir("auto-rescue-cleanup-resume-");
    const temp = path.join(os.tmpdir(), "senti-rescue-tmp-cleanup-resume");
    let registered = false;
    let cleanupAttempts = 0;
    let cherryPicks = 0;
    let updates = 0;
    let currentBase = OLD_BASE;
    const runGitFn = (args) => {
      if (args.includes("--verify")) return gitResult(true, `${currentBase}\n`);
      if (args.includes("list") && args.includes("--porcelain")) {
        return gitResult(true, registered ? `worktree ${temp}\n` : "");
      }
      if (args.includes("add") && args.includes("--detach")) {
        registered = true;
        return gitResult(true);
      }
      if (args.includes("cherry-pick")) {
        cherryPicks += 1;
        return gitResult(true);
      }
      if (args.includes("rev-parse") && args.includes("HEAD")) return gitResult(true, `${NEW_BASE}\n`);
      if (args.includes("update-ref")) {
        updates += 1;
        assert.equal(args.at(-1), OLD_BASE);
        assert.equal(currentBase, args.at(-1));
        currentBase = NEW_BASE;
        return gitResult(true);
      }
      if (args.includes("remove") && args.includes("--force")) {
        cleanupAttempts += 1;
        if (cleanupAttempts === 1) return gitResult(false, "", "cleanup blocked");
        registered = false;
        return gitResult(true);
      }
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    };
    const args = rescueArgs(root, runGitFn, "cleanup-resume");
    try {
      const failed = runDetachedAutoRescue(args);
      assert.equal(failed.code, "AUTO_RESCUE_CLEANUP_FAILED");
      assert.equal(failed.cleanupAuthority.phase, "cleanup-failed");
      assert.equal(failed.cleanupAuthority.residue.worktree, true);
      assert.equal(failed.cleanupAuthority.residue.journal, true);
      assert.match(failed.cleanupAuthority.journalPath, /\.json$/);
      assert.equal(updates, 1);
      assert.equal(cherryPicks, 1);
      assert.equal(registered, true);
      assert.equal(fs.readdirSync(autoRescueJournalDirectory(root)).length, 1);

      const resumed = runDetachedAutoRescue(args);
      assert.equal(resumed.ok, true);
      assert.equal(updates, 1);
      assert.equal(cherryPicks, 1);
      assert.equal(registered, false);
      assert.equal(assertCompletedAutoRescueJournal(root).outcome.ok, true);
      const terminalRetry = runDetachedAutoRescue(args);
      assert.equal(terminalRetry.ok, true);
      assert.equal(updates, 1);
      assert.equal(cherryPicks, 1);
    } finally {
      removeTmpDir(root);
    }
  });

  it("preserves body and cleanup failures in primary-first order", () => {
    const root = createTmpDir("auto-rescue-dual-failure-");
    const temp = path.join(os.tmpdir(), "senti-rescue-tmp-dual-failure");
    let registered = false;
    const runGitFn = (args) => {
      if (args.includes("--verify")) return gitResult(true, `${OLD_BASE}\n`);
      if (args.includes("list") && args.includes("--porcelain")) {
        return gitResult(true, registered ? `worktree ${temp}\n` : "");
      }
      if (args.includes("add") && args.includes("--detach")) {
        registered = true;
        return gitResult(true);
      }
      if (args.includes("cherry-pick") && !args.includes("--abort")) {
        return gitResult(false, "", "conflict");
      }
      if (args.includes("diff") && args.includes("--diff-filter=U")) return gitResult(true, "conflict.txt\n");
      if (args.includes("--abort")) return gitResult(true);
      if (args.includes("remove") && args.includes("--force")) return gitResult(false, "", "cleanup failed");
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    };
    try {
      let dual;
      try {
        runDetachedAutoRescue(rescueArgs(root, runGitFn, "dual-failure"));
        assert.fail("expected ordered body and cleanup failure");
      } catch (error) {
        dual = error;
      }
      assert.ok(dual instanceof AggregateError);
      assert.equal(dual.errors.length, 2);
      assert.equal(dual.errors[0].code, "CHERRY_PICK_CONFLICT");
      assert.equal(dual.errors[1].code, "AUTO_RESCUE_CLEANUP_FAILED");
      assert.equal(dual.cause, dual.errors[0]);
      assert.equal(dual.errors[1].cleanupAuthority.phase, "cleanup-failed");
      assert.equal(dual.errors[1].cleanupAuthority.residue.worktree, true);
      assert.equal(dual.errors[1].cleanupAuthority.residue.journal, true);
      assert.match(dual.errors[1].cleanupAuthority.journalPath, /\.json$/);
      assert.equal(registered, true);
      const journals = fs.readdirSync(autoRescueJournalDirectory(root));
      assert.equal(journals.length, 1);
      const journal = JSON.parse(fs.readFileSync(
        path.join(autoRescueJournalDirectory(root), journals[0]),
        "utf8",
      ));
      assert.equal(journal.phase, "cleanup-failed");
      assert.equal(journal.outcome.code, "CHERRY_PICK_CONFLICT");
    } finally {
      removeTmpDir(root);
    }
  });

  it("does not adopt a pre-outcome crash as success while cleanup is blocked", () => {
    const root = createTmpDir("auto-rescue-pre-outcome-");
    const temp = path.join(os.tmpdir(), "senti-rescue-tmp-pre-outcome");
    let registered = false;
    let crashBody = true;
    let cleanupBlocked = true;
    let probes = 0;
    let bodies = 0;
    let updates = 0;
    let currentBase = OLD_BASE;
    const events = [];
    const runGitFn = (args) => {
      if (args.includes("--verify")) {
        probes += 1;
        events.push("probe");
        return gitResult(true, `${currentBase}\n`);
      }
      if (args.includes("list") && args.includes("--porcelain")) {
        return gitResult(true, registered ? `worktree ${temp}\n` : "");
      }
      if (args.includes("add") && args.includes("--detach")) {
        registered = true;
        events.push("add");
        return gitResult(true);
      }
      if (args.includes("cherry-pick")) {
        bodies += 1;
        events.push("body");
        if (crashBody) throw new Error("crash before outcome journal");
        return gitResult(true);
      }
      if (args.includes("rev-parse") && args.includes("HEAD")) return gitResult(true, `${NEW_BASE}\n`);
      if (args.includes("update-ref")) {
        updates += 1;
        events.push("update");
        assert.equal(currentBase, args.at(-1));
        currentBase = NEW_BASE;
        return gitResult(true);
      }
      if (args.includes("remove") && args.includes("--force")) {
        events.push("cleanup");
        if (cleanupBlocked) return gitResult(false, "", "cleanup blocked");
        registered = false;
        return gitResult(true);
      }
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    };
    const args = rescueArgs(root, runGitFn, "pre-outcome");
    try {
      assert.throws(() => runDetachedAutoRescue(args), /crash before outcome journal/);
      const journalDirectory = autoRescueJournalDirectory(root);
      const journalPath = path.join(journalDirectory, fs.readdirSync(journalDirectory)[0]);
      assert.equal(JSON.parse(fs.readFileSync(journalPath, "utf8")).phase, "worktree-added");

      const failedCleanup = runDetachedAutoRescue(args);
      assert.equal(failedCleanup.code, "AUTO_RESCUE_CLEANUP_FAILED");
      assert.equal(probes, 1);
      assert.equal(bodies, 1);
      assert.equal(updates, 0);
      const blockedJournal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
      assert.equal(blockedJournal.phase, "cleanup-failed");
      assert.equal(blockedJournal.outcome, null);

      crashBody = false;
      cleanupBlocked = false;
      const eventBoundary = events.length;
      const resumed = runDetachedAutoRescue(args);
      assert.equal(resumed.ok, true);
      assert.equal(probes, 3);
      assert.equal(bodies, 2);
      assert.equal(updates, 1);
      assert.ok(events.slice(eventBoundary).indexOf("cleanup") < events.slice(eventBoundary).indexOf("probe"));
      assert.equal(assertCompletedAutoRescueJournal(root).outcome.ok, true);
    } finally {
      removeTmpDir(root);
    }
  });

  it("rejects malformed, symlinked, and hardlinked cleanup journals before Git mutation", () => {
    const root = createTmpDir("auto-rescue-journal-authority-");
    const temp = path.join(os.tmpdir(), "senti-rescue-tmp-journal-authority");
    let registered = false;
    let cleanupAttempts = 0;
    let gitCalls = 0;
    let currentBase = OLD_BASE;
    const runGitFn = (args) => {
      gitCalls += 1;
      if (args.includes("--verify")) return gitResult(true, `${currentBase}\n`);
      if (args.includes("list") && args.includes("--porcelain")) {
        return gitResult(true, registered ? `worktree ${temp}\n` : "");
      }
      if (args.includes("add") && args.includes("--detach")) {
        registered = true;
        return gitResult(true);
      }
      if (args.includes("cherry-pick")) return gitResult(true);
      if (args.includes("rev-parse") && args.includes("HEAD")) return gitResult(true, `${NEW_BASE}\n`);
      if (args.includes("update-ref")) {
        assert.equal(currentBase, args.at(-1));
        currentBase = NEW_BASE;
        return gitResult(true);
      }
      if (args.includes("remove") && args.includes("--force")) {
        cleanupAttempts += 1;
        return gitResult(false, "", "retain cleanup journal");
      }
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    };
    const args = rescueArgs(root, runGitFn, "journal-authority");
    try {
      assert.equal(runDetachedAutoRescue(args).code, "AUTO_RESCUE_CLEANUP_FAILED");
      assert.equal(cleanupAttempts, 1);
      const directory = autoRescueJournalDirectory(root);
      const journalPath = path.join(directory, fs.readdirSync(directory)[0]);
      const journalBytes = fs.readFileSync(journalPath);
      const external = path.join(root, "external-journal.json");
      const cases = [
        ["malformed", () => fs.writeFileSync(journalPath, "{malformed\n")],
        ["symlink", () => {
          fs.writeFileSync(external, journalBytes);
          fs.unlinkSync(journalPath);
          fs.symlinkSync(external, journalPath);
        }],
        ["hardlink", () => {
          fs.writeFileSync(external, journalBytes);
          fs.unlinkSync(journalPath);
          fs.linkSync(external, journalPath);
        }],
      ];
      for (const [label, tamper] of cases) {
        fs.rmSync(journalPath, { force: true });
        fs.rmSync(external, { force: true });
        fs.writeFileSync(journalPath, journalBytes);
        tamper();
        const beforeCalls = gitCalls;
        assert.throws(() => runDetachedAutoRescue(args), undefined, label);
        assert.equal(gitCalls, beforeCalls, label);
        if (fs.existsSync(external)) assert.deepEqual(fs.readFileSync(external), journalBytes, label);
      }
    } finally {
      removeTmpDir(root);
    }
  });
});
