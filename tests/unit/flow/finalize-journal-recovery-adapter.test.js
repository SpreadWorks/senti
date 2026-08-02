import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { Envelope } from "../../../src/lib/flow-envelope.js";
import { RepositoryFlowOperationLock } from "../../../src/lib/repository-maintenance-lock.js";
import {
  FinalizeJournalIdentity,
  FinalizeJournalReader,
  FinalizeJournalRecoveryAdapter,
  FinalizeJournalReplayExecutor,
  FinalizeJournalReplayRequest,
  FinalizeJournalSnapshot,
} from "../../../src/flow/lib/finalize-journal-recovery-adapter.js";
import { RecoveryUnavailable } from "../../../src/flow/lib/recovery-contract.js";
import { RunFinalizeCleanupCommand } from "../../../src/flow/lib/run-finalize-cleanup.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { makeFlowManager, replaceFlowState, setupFlow } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

function flowState(overrides = {}) {
  return {
    runId: "run-finalize-replay",
    issue: 473,
    specId: "473",
    featureBranch: "feature/473",
    baseBranch: "main",
    ...overrides,
  };
}

class StaticFlowManager {
  constructor({ state, root }) {
    this.state = state;
    this.root = root;
    this.expectations = [];
  }

  resolveExplicitFlowTargetForRead(expectation) {
    this.expectations.push(expectation);
    return { state: this.state, authorityRoot: this.root };
  }
}

class StaticJournalReader extends FinalizeJournalReader {
  constructor(journal) {
    super();
    this.journal = journal;
    this.calls = 0;
  }

  read() {
    this.calls += 1;
    return this.journal;
  }
}

class CapturingReplayExecutor extends FinalizeJournalReplayExecutor {
  constructor(result = Envelope.ok("run", "finalize-cleanup", { status: "done" })) {
    super();
    this.result = result;
    this.calls = [];
  }

  async replay(context) {
    this.calls.push(context);
    return this.result;
  }
}

function journalFor(state, phase = "pointer-written") {
  const identity = FinalizeJournalIdentity.fromFlowState(state);
  return new FinalizeJournalSnapshot({
    transactionId: "finalize-transaction-473",
    identity,
    phase,
    transaction: { transactionId: "finalize-transaction-473" },
  });
}

function adapterFixture(root, state, journal, executor = new CapturingReplayExecutor()) {
  const flowManager = new StaticFlowManager({ state, root });
  const reader = new StaticJournalReader(journal);
  return {
    flowManager,
    reader,
    executor,
    adapter: new FinalizeJournalRecoveryAdapter({
      flowManager,
      mainRoot: root,
      journalReader: reader,
      replayExecutor: executor,
    }),
  };
}

test("replays only a matching incomplete Issue #473 journal through normal finalize cleanup", async () => {
  const root = createTmpDir("finalize-journal-adapter-match-");
  try {
    const state = flowState();
    const executor = new CapturingReplayExecutor();
    const fixture = adapterFixture(root, state, journalFor(state), executor);

    const result = await fixture.adapter.replay(FinalizeJournalReplayRequest.fromFlowState(state));

    assert.equal(result.toJSON().replayed, true);
    assert.equal(result.toJSON().resumedFromPhase, "pointer-written");
    assert.equal(fixture.flowManager.expectations.length, 1);
    assert.equal(fixture.executor.calls.length, 1);
    assert.equal(fixture.executor.calls[0].flowState, state);
    assert.equal(fixture.executor.calls[0].requirePersistedJournal, true);
    assert.equal(fixture.executor.calls[0].autoRescue, false);
    assert.equal(fixture.executor.calls[0].force, false);
  } finally {
    removeTmpDir(root);
  }
});

test("returns RecoveryUnavailable without replay for absent, foreign, or completed journals", async () => {
  const root = createTmpDir("finalize-journal-adapter-unavailable-");
  try {
    const state = flowState();
    const cases = [
      [null, "finalize-journal-unavailable"],
      [journalFor(flowState({ runId: "other-run" })), "finalize-journal-target-mismatch"],
      [journalFor(state, "completed"), "finalize-journal-already-completed"],
    ];

    for (const [journal, reason] of cases) {
      const fixture = adapterFixture(root, state, journal);
      const result = await fixture.adapter.replay(FinalizeJournalReplayRequest.fromFlowState(state));
      assert.ok(result instanceof RecoveryUnavailable);
      assert.equal(result.reason, reason);
      assert.equal(fixture.executor.calls.length, 0);
    }
  } finally {
    removeTmpDir(root);
  }
});

test("returns RecoveryUnavailable when the exact Flow changes before replay", async () => {
  const root = createTmpDir("finalize-journal-adapter-target-");
  try {
    const selected = flowState();
    const current = flowState({ featureBranch: "feature/other" });
    const fixture = adapterFixture(root, current, journalFor(current));

    const result = await fixture.adapter.replay(FinalizeJournalReplayRequest.fromFlowState(selected));

    assert.ok(result instanceof RecoveryUnavailable);
    assert.equal(result.reason, "finalize-target-mismatch");
    assert.equal(fixture.reader.calls, 0);
    assert.equal(fixture.executor.calls.length, 0);
  } finally {
    removeTmpDir(root);
  }
});

test("maps existing cleanup authority rejection to RecoveryUnavailable without a retry state", async () => {
  const root = createTmpDir("finalize-journal-adapter-cleanup-");
  try {
    const state = flowState();
    const executor = new CapturingReplayExecutor(Envelope.fail(
      "run",
      "finalize-cleanup",
      "FINALIZE_TEARDOWN_TARGET_MISMATCH",
      "cleanup target changed",
    ));
    const fixture = adapterFixture(root, state, journalFor(state), executor);

    const result = await fixture.adapter.replay(FinalizeJournalReplayRequest.fromFlowState(state));

    assert.ok(result instanceof RecoveryUnavailable);
    assert.equal(result.reason, "finalize-authority-unavailable");
    assert.match(result.message, /FINALIZE_TEARDOWN_TARGET_MISMATCH/);
    assert.equal(fixture.executor.calls.length, 1);
  } finally {
    removeTmpDir(root);
  }
});

test("does not borrow or bypass a repository operation lock", async () => {
  const root = createTmpDir("finalize-journal-adapter-lock-");
  const operation = new RepositoryFlowOperationLock({ mainRoot: root });
  try {
    const state = flowState();
    const fixture = adapterFixture(root, state, journalFor(state));
    operation.acquire();

    const result = await fixture.adapter.replay(FinalizeJournalReplayRequest.fromFlowState(state));

    assert.ok(result instanceof RecoveryUnavailable);
    assert.equal(result.reason, "repository-lock-unavailable");
    assert.equal(fixture.reader.calls, 0);
    assert.equal(fixture.executor.calls.length, 0);
  } finally {
    operation.release();
    removeTmpDir(root);
  }
});

test("Issue #473 cleanup refuses to create a journal when replay requires a persisted journal", async () => {
  const root = createTmpDir("finalize-journal-adapter-no-create-");
  try {
    initGitRepo(root);
    fs.writeFileSync(path.join(root, "README.md"), "fixture\n");
    commitAll(root, "test: baseline");
    const state = setupFlow(root, {
      ...flowState(),
      worktree: false,
      state: { mergeStrategy: "pr" },
    });
    replaceFlowState(root, state, { specId: "473" });
    commitAll(root, "test: add flow");
    execFileSync("git", ["-C", root, "branch", state.featureBranch]);
    const flowManager = makeFlowManager(root);
    const result = await new RunFinalizeCleanupCommand().executeOwned({
      root,
      mainRoot: root,
      flowManager,
      flowState: flowManager.loadReadOnly("473"),
      requirePersistedJournal: true,
      autoRescue: false,
      force: false,
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FINALIZE_TEARDOWN_JOURNAL_MISSING");
    assert.equal(fs.existsSync(path.join(root, "specs", "473", "finalize-cleanup.json")), false);
  } finally {
    removeTmpDir(root);
  }
});
