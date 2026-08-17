// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import { Container } from "../../../src/lib/container.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  buildRepairFingerprint,
  completeImplRepair,
  prepareImplTriageArtifact,
  readImplRepairLedger,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import {
  AcceptanceEvidenceRefresh,
} from "../../../src/flow/lib/acceptance-review-artifacts.js";
import {
  readRepairFingerprintManifest,
} from "../../../src/flow/lib/repair-state-identity.js";
import {
  StaleTestEvidenceMismatch,
  StaleTestEvidenceRefresh,
} from "../../../src/flow/lib/stale-test-evidence-refresh.js";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import RunRewindTestEvidenceCommand from "../../../src/flow/lib/run-rewind-test-evidence.js";
import {
  checkIntegrationTestArtifacts,
} from "../../../src/flow/lib/run-gate.js";
import {
  ExternalBlockedOutcome,
  StepAttempt,
} from "../../../src/flow/lib/step-outcome.js";
import { flowLeafIdsBetween } from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { makeFlowState, moveFlowToStep } from "../../../tests/helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../../../tests/helpers/git-repo.js";
import {
  createTmpDir,
  removeTmpDir,
  writeFile,
} from "../../../tests/helpers/tmp-dir.js";
import { standaloneTestEnvironment } from "./standalone-test-environment.js";

const SPEC_PATH = "specs/demo/spec.json";
const SPEC_DIR = "specs/demo";
const TRANSACTION_FILE = "impl-repair-transaction.json";
const LEDGER_FILE = "impl-repair.json";
const REWIND_SPEC_ID = "001-rewind-stale-evidence";
const REWIND_SPEC_PATH = `specs/${REWIND_SPEC_ID}/spec.json`;
const REWIND_RUN_ID = "run-rewind-stale-evidence";
const REWIND_ISSUE = 458;
const PROJECT_ROOT = path.resolve(".");
const SHARED_CLI_LIFECYCLE_SUITE = "tests/e2e/231-task-e2e-full-lifecycle.test.js";

const temporaryRoots = [];

afterEach(() => {
  while (temporaryRoots.length > 0) {
    removeTmpDir(temporaryRoots.pop());
  }
});

class TransactionalFlowManager {
  constructor(state) {
    this.state = state;
    this.updateCalls = 0;
    this.mutateCalls = 0;
  }

  load() {
    return this.state;
  }

  loadReadOnly() {
    return this.state;
  }

  mutate(mutator) {
    this.mutateCalls += 1;
    mutator(this.state);
    return this.state;
  }

  completeStepTransitionIntent(commitIntent) {
    commitIntent.completeIn(this.state);
    return this.state;
  }

  updateStepStatus(transition, _options, commitIntent = null) {
    this.updateCalls += 1;
    commitIntent?.assertBeforeTransition(this.state);
    const next = structuredClone(this.state);
    const now = new Date().toISOString();
    for (const change of transition.changes) {
      const step = findStepById(next.steps, change.stepId);
      assert.ok(step, `missing step ${change.stepId}`);
      assert.equal(step.status, change.currentStatus);
      step.status = change.requestedStatus;
      delete step.startedAt;
      delete step.finishedAt;
      if (step.status === "in_progress") step.startedAt = now;
    }
    commitIntent?.applyTo(next);
    this.state = next;
    return next;
  }

  resetCounters() {
    this.updateCalls = 0;
    this.mutateCalls = 0;
  }
}

function jsonFile(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function runSharedSuites(files) {
  return spawnSync(process.execPath, ["--test", ...files], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    env: standaloneTestEnvironment(),
  });
}

function createFixture() {
  const root = createTmpDir("spec-337-stale-refresh-");
  temporaryRoots.push(root);
  const specDir = path.join(root, SPEC_DIR);
  writeFile(root, SPEC_PATH, JSON.stringify({ requirements: [] }, null, 2));
  writeFile(root, "src/value.js", "export const value = 1;\n");
  initGitRepo(root);
  commitAll(root, "initial");

  const baseline = buildRepairFingerprint({ root, specPath: SPEC_PATH });
  const state = moveFlowToStep(makeFlowState({
    spec: SPEC_PATH,
    issue: 458,
    runId: "run-458",
    repairBaseline: baseline.baseline.toJSON(),
  }), "impl-repair");
  const flowManager = new TransactionalFlowManager(state);

  writeFile(root, `${SPEC_DIR}/impl-review.json`, JSON.stringify({
    repairFingerprint: baseline.hash,
    blockingFindings: [{ findingId: "F-1" }],
    nonBlockingImprovements: [],
  }, null, 2));
  prepareImplTriageArtifact({
    specDir,
    sourceStep: "impl-review",
    sourceArtifact: "impl-review.json",
    findings: [{ findingId: "F-1", summary: "Apply the first repair." }],
    fingerprint: baseline,
  });
  writeFile(root, `${SPEC_DIR}/test-execute-result.json`, JSON.stringify({
    repairFingerprint: baseline.hash,
  }, null, 2));
  writeFile(root, "src/value.js", "export const value = 2;\n");
  completeImplRepair({
    root,
    state: flowManager.state,
    flowManager,
    resetStepIds: flowLeafIdsBetween("test-execute", "finalize-cleanup"),
  });

  const repaired = buildRepairFingerprint({
    root,
    specPath: SPEC_PATH,
    state: flowManager.state,
  });
  writeFile(root, `${SPEC_DIR}/test-execute-result.json`, JSON.stringify({
    repairFingerprint: repaired.hash,
  }, null, 2));
  writeFile(root, `${SPEC_DIR}/test-result-review.json`, JSON.stringify({
    repairFingerprint: repaired.hash,
  }, null, 2));
  writeFile(root, `${SPEC_DIR}/retro.json`, JSON.stringify({
    repairFingerprint: repaired.hash,
  }, null, 2));
  moveFlowToStep(flowManager.state, "final-regression");
  writeFile(root, "src/value.js", "export const value = 3;\n");
  const current = buildRepairFingerprint({
    root,
    specPath: SPEC_PATH,
    state: flowManager.state,
  });
  flowManager.resetCounters();

  return {
    root,
    specDir,
    flowManager,
    repaired,
    current,
  };
}

function recover(fixture, { faultPhase = null } = {}) {
  return new StaleTestEvidenceRefresh({
    previousFingerprint: fixture.repaired.hash,
    currentFingerprint: fixture.current.hash,
  }).recover({
    root: fixture.root,
    state: fixture.flowManager.state,
    specDir: fixture.specDir,
    flowManager: fixture.flowManager,
    reason: "spec 337 verifies formal stale evidence repair",
    sourceStep: "final-regression",
    faultInjector: faultPhase == null
      ? null
      : ({ phase }) => {
          if (phase === faultPhase) throw new Error(`injected ${phase}`);
        },
  });
}

function recoverThroughIntegrationGate(fixture) {
  const staleEvidence = checkIntegrationTestArtifacts(
    fixture.root,
    fixture.flowManager.state,
    "integration",
    "integration",
  );
  assert.equal(typeof staleEvidence?.recover, "function");
  const ctx = {
    root: fixture.root,
    flowState: fixture.flowManager.state,
    flowManager: fixture.flowManager,
  };
  return staleEvidence.recover(ctx, {
    level: "integration",
    phase: "integration",
    specDir: fixture.specDir,
  });
}

async function recoverThroughFinalRegression(fixture) {
  return new RunFinalRegressionCommand().execute({
    root: fixture.root,
    config: {},
    flowState: fixture.flowManager.state,
    flowManager: fixture.flowManager,
  });
}

function recoverThroughAcceptanceReview(fixture) {
  const refresh = new AcceptanceEvidenceRefresh({
    fingerprint: fixture.current,
    artifacts: {
      "test-execute-result.json": {
        repairFingerprint: fixture.repaired.hash,
      },
      "test-result-review.json": {
        repairFingerprint: fixture.repaired.hash,
      },
    },
    blockers: [{
      kind: "invalid_schema",
      summary: "Required artifact is invalid: impl-repair.json.",
    }],
    deferredFindings: [],
  });
  assert.equal(refresh.required, true);
  return refresh.recover({
    specDir: fixture.specDir,
    flowManager: fixture.flowManager,
    acceptancePath: path.join(fixture.specDir, "acceptance-review.json"),
  });
}

function createRewindFixture() {
  const root = createTmpDir("spec-337-rewind-entrypoint-");
  temporaryRoots.push(root);
  const specDir = path.join(root, "specs", REWIND_SPEC_ID);
  const rawOutputPath = `specs/${REWIND_SPEC_ID}/tests/.raw/test-execution.log`;
  const resultPath = `specs/${REWIND_SPEC_ID}/test-execute-result.json`;
  writeFile(root, REWIND_SPEC_PATH, JSON.stringify({
    goal: "Verify explicit stale evidence rewind.",
    requirements: [],
    tasks: [],
  }, null, 2));
  writeFile(root, "src/value.js", "export const value = 1;\n");
  initGitRepo(root);
  commitAll(root, "initial");

  const previous = buildRepairFingerprint({
    root,
    specPath: REWIND_SPEC_PATH,
  });
  writeFile(root, `specs/${REWIND_SPEC_ID}/impl-review.json`, JSON.stringify({
    version: 1,
    phase: "impl",
    verdict: "REJECTED",
    summary: { blocking: 1, nonBlocking: 0, total: 1 },
    blockingFindings: [{
      findingId: "F-1",
      suggestion: "Apply the repair.",
    }],
    nonBlockingImprovements: [],
    repairFingerprint: previous.hash,
  }, null, 2));
  prepareImplTriageArtifact({
    specDir,
    sourceStep: "impl-review",
    sourceArtifact: "impl-review.json",
    findings: [{ findingId: "F-1", summary: "Apply the repair." }],
    fingerprint: previous,
  });
  writeFile(root, rawOutputPath, "stale test output\n");
  writeFile(root, resultPath, JSON.stringify({
    repairFingerprint: previous.hash,
    raw_output_path: rawOutputPath,
  }, null, 2));
  writeFile(root, `specs/${REWIND_SPEC_ID}/test-result-review.json`, JSON.stringify({
    repairFingerprint: previous.hash,
    result_file_path: resultPath,
    raw_output_path: rawOutputPath,
  }, null, 2));
  writeFile(root, `specs/${REWIND_SPEC_ID}/test-result-review.md`, "review\n");
  writeFile(root, `specs/${REWIND_SPEC_ID}/review.md`, "implementation review\n");
  writeFile(root, "src/value.js", "export const value = 2;\n");

  const state = moveFlowToStep(makeFlowState({
    spec: REWIND_SPEC_PATH,
    runId: REWIND_RUN_ID,
    issue: REWIND_ISSUE,
    baseBranch: "main",
    featureBranch: "feature/rewind-stale-evidence",
    tasks: [],
  }), "impl-gate");
  const current = buildRepairFingerprint({
    root,
    specPath: REWIND_SPEC_PATH,
    state,
  });
  state.stepAttempts = [new StepAttempt({
    runId: REWIND_RUN_ID,
    taskId: null,
    stepId: "impl-gate",
    attempt: 1,
    outcome: new ExternalBlockedOutcome({
      reason: "gate_failure",
      resumeInstruction: "Regenerate stale test evidence.",
    }),
    recordedAt: "2026-07-25T00:00:00.000Z",
  }).toJSON()];
  writeFile(root, `specs/${REWIND_SPEC_ID}/issue-log.json`, JSON.stringify({
    entries: [{
      step: "impl-gate",
      phase: "integration",
      trigger: "gate onError hook (auto)",
      reason: `test-execute-result.json repairFingerprint mismatch: expected ${current.hash}, got ${previous.hash}`,
      timestamp: "2026-07-25T00:00:00.000Z",
    }],
  }, null, 2));

  const flowManager = new FlowManager({
    root,
    mainRoot: root,
    inWorktree: false,
  });
  flowManager.create(state);
  flowManager.addActiveFlow(REWIND_SPEC_ID, "branch");
  const container = new Container();
  container.register("paths", { root });
  container.register("mainRoot", root);
  container.register("inWorktree", false);
  container.register("config", {});
  container.register("flowManager", flowManager);
  return {
    root,
    specDir,
    previous,
    current,
    flowManager,
    container,
  };
}

function assertPendingOwnedTransaction(fixture) {
  assert.equal(
    findStepById(fixture.flowManager.state.steps, "test-execute").status,
    "in_progress",
  );
  assert.ok(fixture.flowManager.state.implRepairTransaction);
  assert.equal(
    fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE)),
    true,
  );
}

function recoverAfterInjectedFailure(fixture, faultPhase) {
  assert.throws(
    () => recover(fixture, { faultPhase }),
    new RegExp(`injected ${faultPhase}`),
  );
  assertPendingOwnedTransaction(fixture);
  return recover(fixture);
}

test("R1: committed refresh aligns manifest ledger delta and result fingerprint", () => {
  const fixture = createFixture();
  const result = recoverAfterInjectedFailure(fixture, "after-ledger");
  const ledger = readImplRepairLedger(fixture.specDir);
  const entry = ledger.entries.at(-1);
  const manifest = readRepairFingerprintManifest(fixture.specDir);
  const delta = jsonFile(fixture.root, `${SPEC_DIR}/${entry.changedPathsRef}`);

  assert.equal(manifest.hash, fixture.current.hash);
  assert.equal(entry.currentHash, fixture.current.hash);
  assert.equal(delta.currentHash, fixture.current.hash);
  assert.equal(result.currentFingerprint, fixture.current.hash);
});

test("R2: refresh appends one continuous ledger entry after retry", () => {
  const fixture = createFixture();
  const before = readImplRepairLedger(fixture.specDir);
  assert.throws(
    () => recover(fixture, { faultPhase: "after-manifest" }),
    /injected after-manifest/,
  );
  const pending = jsonFile(fixture.root, `${SPEC_DIR}/${TRANSACTION_FILE}`);
  recover(fixture);
  const after = readImplRepairLedger(fixture.specDir);
  const entry = after.entries.at(-1);
  const delta = jsonFile(fixture.root, `${SPEC_DIR}/${entry.changedPathsRef}`);
  const persistedEntry = jsonFile(
    fixture.root,
    `${SPEC_DIR}/${LEDGER_FILE}`,
  ).entries.at(-1);

  assert.equal(after.entries.length, before.entries.length + 1);
  assert.equal(
    entry.previousHash,
    before.entries.at(-1).currentHash,
  );
  assert.equal(entry.currentHash, fixture.current.hash);
  assert.ok(delta.changedPaths.length > 0);
  assert.deepEqual(
    persistedEntry.invalidations,
    pending.invalidations,
  );
});

test("R3: every stale entrypoint uses the owned lifecycle transition authority", async () => {
  const gateFixture = createFixture();
  const gateResult = recoverThroughIntegrationGate(gateFixture);
  const finalFixture = createFixture();
  const finalResult = await recoverThroughFinalRegression(finalFixture);
  const acceptanceFixture = createFixture();
  acceptanceFixture.flowManager.state.acceptanceReview = {
    verdict: "pass",
  };
  const acceptanceResult = recoverThroughAcceptanceReview(acceptanceFixture);

  assert.equal(gateFixture.flowManager.updateCalls, 1);
  assert.equal(finalFixture.flowManager.updateCalls, 1);
  assert.equal(acceptanceFixture.flowManager.updateCalls, 1);
  assert.equal(gateFixture.flowManager.mutateCalls, 0);
  assert.equal(finalFixture.flowManager.mutateCalls, 0);
  assert.equal(acceptanceFixture.flowManager.mutateCalls, 0);
  assert.equal(gateFixture.flowManager.state.implRepairTransaction, undefined);
  assert.equal(finalFixture.flowManager.state.implRepairTransaction, undefined);
  assert.equal(
    acceptanceFixture.flowManager.state.implRepairTransaction,
    undefined,
  );
  assert.equal(
    acceptanceFixture.flowManager.state.acceptanceReview,
    undefined,
  );
  assert.equal(gateResult.next, "test-execute");
  assert.equal(finalResult.next, "test-execute");
  assert.equal(acceptanceResult.activeStep, "test-execute");
});

test("R4: failed effects remain pending and never report recovered success", () => {
  const fixture = createFixture();
  let returned = null;

  assert.throws(
    () => {
      returned = recover(fixture, { faultPhase: "after-delta" });
    },
    /injected after-delta/,
  );
  assert.equal(returned, null);
  assertPendingOwnedTransaction(fixture);
  assert.equal(
    findStepById(fixture.flowManager.state.steps, "acceptance-review").status,
    "pending",
  );
  const consumer = checkIntegrationTestArtifacts(
    fixture.root,
    fixture.flowManager.state,
    "integration",
    "integration",
  );
  assert.equal(typeof consumer?.recover, "function");
  assert.notEqual(consumer?.result, "pass");
  assert.equal(
    fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE)),
    true,
  );
  const resumed = consumer.recover({
    root: fixture.root,
    flowState: fixture.flowManager.state,
    flowManager: fixture.flowManager,
  }, {
    level: "integration",
    phase: "integration",
    specDir: fixture.specDir,
  });
  assert.equal(resumed.result, "recovered");
  assert.equal(
    fixture.flowManager.state.implRepairTransaction,
    undefined,
  );
  assert.equal(
    fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE)),
    false,
  );
});

test("R5: every durable effects boundary converges exactly once", () => {
  for (const phase of [
    "after-delta",
    "after-ledger",
    "after-manifest",
    "after-invalidation",
    "after-flow-state",
    "after-intent-completion",
  ]) {
    const fixture = createFixture();
    const before = readImplRepairLedger(fixture.specDir).entries.length;
    assert.throws(
      () => recover(fixture, { faultPhase: phase }),
      new RegExp(`injected ${phase}`),
    );
    if (phase === "after-intent-completion") {
      assert.equal(
        fixture.flowManager.state.implRepairTransaction,
        undefined,
      );
      assert.equal(
        fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE)),
        true,
      );
    } else {
      assertPendingOwnedTransaction(fixture);
    }
    const pending = jsonFile(fixture.root, `${SPEC_DIR}/${TRANSACTION_FILE}`);
    const pendingState = structuredClone(
      fixture.flowManager.state.implRepairTransaction,
    );
    const updatesBeforeRetry = fixture.flowManager.updateCalls;
    const result = recover(fixture);
    const after = readImplRepairLedger(fixture.specDir);
    const entry = after.entries.at(-1).toJSON();
    const delta = jsonFile(
      fixture.root,
      `${SPEC_DIR}/${entry.changedPathsRef}`,
    );

    assert.equal(result.recovered, true, phase);
    assert.equal(
      fixture.flowManager.updateCalls,
      updatesBeforeRetry,
      phase,
    );
    assert.equal(after.entries.length, before + 1, phase);
    assert.equal(after.entries.at(-1).currentHash, fixture.current.hash, phase);
    assert.equal(entry.id, pending.id, phase);
    assert.deepEqual(entry, pending.entry, phase);
    assert.deepEqual(delta, pending.delta, phase);
    if (phase === "after-intent-completion") {
      assert.equal(pendingState, undefined, phase);
    } else {
      assert.deepEqual(pendingState, pending, phase);
    }
    assert.equal(
      fixture.flowManager.state.implRepairTransaction,
      undefined,
      phase,
    );
    assert.equal(
      fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE)),
      false,
      phase,
    );
  }
});

test("R6: changed target identity rejects a pending refresh without mutation", () => {
  for (const [field, value] of [
    ["runId", "foreign-run"],
    ["spec", "specs/foreign/spec.json"],
    ["issue", 999],
  ]) {
    const fixture = createFixture();
    assert.throws(
      () => recover(fixture, { faultPhase: "after-ledger" }),
      /injected after-ledger/,
    );
    const ledgerBefore = fs.readFileSync(
      path.join(fixture.specDir, LEDGER_FILE),
    );
    fixture.flowManager.state[field] = value;

    assert.throws(
      () => recover(fixture),
      /target|identity|authority|run|spec|issue/i,
      field,
    );
    assert.deepEqual(
      fs.readFileSync(path.join(fixture.specDir, LEDGER_FILE)),
      ledgerBefore,
      field,
    );
    assert.equal(
      fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE)),
      true,
      field,
    );
  }

  const foreign = createFixture();
  assert.throws(
    () => recover(foreign, { faultPhase: "after-ledger" }),
    /injected after-ledger/,
  );
  const foreignBefore = fs.readFileSync(
    path.join(foreign.specDir, TRANSACTION_FILE),
  );
  foreign.flowManager.state.implRepairTransaction.sourceStep = "foreign-owner";
  assert.throws(
    () => recover(foreign),
    /transaction|authority|owner|source/i,
  );
  assert.deepEqual(
    fs.readFileSync(path.join(foreign.specDir, TRANSACTION_FILE)),
    foreignBefore,
  );

  const changed = createFixture();
  assert.throws(
    () => recover(changed, { faultPhase: "after-ledger" }),
    /injected after-ledger/,
  );
  const changedBefore = fs.readFileSync(
    path.join(changed.specDir, LEDGER_FILE),
  );
  writeFile(changed.root, "src/value.js", "export const value = 4;\n");
  assert.throws(
    () => recover(changed),
    /fingerprint|current state|authority/i,
  );
  assert.deepEqual(
    fs.readFileSync(path.join(changed.specDir, LEDGER_FILE)),
    changedBefore,
  );
});

test("R7: committed recovery regenerates evidence through the real CLI lifecycle", () => {
  const result = runSharedSuites([SHARED_CLI_LIFECYCLE_SUITE]);

  assert.equal(
    result.status,
    0,
    `shared CLI lifecycle failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(
    result.stdout,
    /stale integration evidence recovery regenerates the acceptance lifecycle/,
  );
});

test("R8: public entrypoints preserve recovery projections and rewind guards", async () => {
  const gateFixture = createFixture();
  const gate = recoverThroughIntegrationGate(gateFixture);
  const finalFixture = createFixture();
  const final = await recoverThroughFinalRegression(finalFixture);
  const acceptanceFixture = createFixture();
  const acceptance = recoverThroughAcceptanceReview(acceptanceFixture);
  const guarded = createFixture();
  const rewind = await new RunRewindTestEvidenceCommand().execute({
    flowState: guarded.flowManager.state,
    input: {},
  });
  const rewindFixture = createRewindFixture();
  const rewindSuccess = await new RunRewindTestEvidenceCommand().run(
    rewindFixture.container,
    {
      expectRunId: REWIND_RUN_ID,
      expectSpec: REWIND_SPEC_PATH,
      expectIssue: REWIND_ISSUE,
      _envelopeType: "run",
      _envelopeKey: "rewind-test-evidence",
    },
  );
  const rewindState = rewindFixture.flowManager.loadReadOnly(REWIND_SPEC_ID);
  const mismatchCases = [
    ["runId", { expectRunId: "foreign-run" }],
    ["spec", { expectSpec: "specs/foreign/spec.json" }],
    ["issue", { expectIssue: 999 }],
  ];

  assert.equal(gate.result, "recovered");
  assert.equal(gate.next, "test-execute");
  assert.equal(gate.artifacts.evidenceRefresh.recovered, true);
  assert.equal(final.result, "recovered");
  assert.equal(final.next, "test-execute");
  assert.equal(final.artifacts.evidenceRefresh.recovered, true);
  assert.equal(acceptance.recovered, true);
  assert.equal(acceptance.activeStep, "test-execute");
  assert.equal(rewind.ok, false);
  assert.equal(
    rewind.errors[0].code,
    "TARGET_GUARDS_REQUIRED",
  );
  assert.equal(rewindSuccess.ok, true);
  assert.equal(rewindSuccess.data.recovered, true);
  assert.equal(rewindSuccess.data.activeStep, "test-execute");
  assert.equal(
    findStepById(rewindState.steps, "test-execute").status,
    "in_progress",
  );
  assert.equal(rewindState.implRepairTransaction, undefined);
  for (const [label, override] of mismatchCases) {
    const mismatchFixture = createRewindFixture();
    const before = structuredClone(
      mismatchFixture.flowManager.loadReadOnly(REWIND_SPEC_ID),
    );
    const mismatch = await new RunRewindTestEvidenceCommand().run(
      mismatchFixture.container,
      {
        expectRunId: REWIND_RUN_ID,
        expectSpec: REWIND_SPEC_PATH,
        expectIssue: REWIND_ISSUE,
        ...override,
        _envelopeType: "run",
        _envelopeKey: "rewind-test-evidence",
      },
    );

    assert.equal(mismatch.ok, false, label);
    assert.equal(mismatch.errors[0].code, "ACTIVE_FLOW_MISMATCH", label);
    assert.deepEqual(
      mismatchFixture.flowManager.loadReadOnly(REWIND_SPEC_ID),
      before,
      label,
    );
    assert.equal(
      fs.existsSync(path.join(mismatchFixture.specDir, TRANSACTION_FILE)),
      false,
      label,
    );
  }
  assert.equal(gateFixture.flowManager.updateCalls, 1);
  assert.equal(finalFixture.flowManager.updateCalls, 1);
  assert.equal(acceptanceFixture.flowManager.updateCalls, 1);
});

test("R9: regression matrix exercises current malformed and mismatched evidence", async () => {
  const successful = createFixture();
  assert.equal(
    StaleTestEvidenceMismatch.detect({
      artifacts: new Map([[
        "test-execute-result.json",
        { repairFingerprint: successful.current.hash },
      ]]),
      currentFingerprint: successful.current.hash,
    }),
    null,
  );
  assert.throws(
    () => StaleTestEvidenceMismatch.detect({
      artifacts: new Map([
        ["test-execute-result.json", {
          repairFingerprint: successful.repaired.hash,
        }],
        ["test-result-review.json", {
          repairFingerprint: "c".repeat(64),
        }],
      ]),
      currentFingerprint: successful.current.hash,
    }),
    /inconsistent repair fingerprints/,
  );

  const current = createFixture();
  writeFile(
    current.root,
    "final-regression-fixture.sh",
    "printf '%s\\n' 'current evidence regression pass'\n",
  );
  writeFile(
    current.root,
    `${SPEC_DIR}/tests/.raw/test-execution.log`,
    "current evidence regression input\n",
  );
  const currentFingerprint = buildRepairFingerprint({
    root: current.root,
    specPath: SPEC_PATH,
    state: current.flowManager.state,
  });
  writeFile(current.root, `${SPEC_DIR}/test-execute-result.json`, JSON.stringify({
    repairFingerprint: currentFingerprint.hash,
  }, null, 2));
  const currentLedger = fs.readFileSync(
    path.join(current.specDir, LEDGER_FILE),
  );
  const currentResult = await new RunFinalRegressionCommand().execute({
    root: current.root,
    config: {
      test: {
        command: "sh final-regression-fixture.sh",
        timeout: 5,
      },
    },
    flowState: current.flowManager.state,
    flowManager: current.flowManager,
  });
  const currentRegressionArtifact = jsonFile(
    current.root,
    `${SPEC_DIR}/final-regression-result.json`,
  );
  assert.equal(currentResult.result, "pass", JSON.stringify({
    currentResult,
    currentRegressionArtifact,
  }));
  assert.equal(currentResult.next, "report");
  assert.equal(current.flowManager.updateCalls, 0);
  assert.equal(current.flowManager.mutateCalls, 0);
  assert.deepEqual(
    fs.readFileSync(path.join(current.specDir, LEDGER_FILE)),
    currentLedger,
  );
  assert.equal(
    fs.existsSync(path.join(current.specDir, TRANSACTION_FILE)),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(current.specDir, "test-execute-result.json")),
    true,
  );

  const malformed = createFixture();
  const malformedLedger = fs.readFileSync(
    path.join(malformed.specDir, LEDGER_FILE),
  );
  const malformedLifecycle = structuredClone(malformed.flowManager.state.steps);
  fs.writeFileSync(
    path.join(malformed.specDir, "test-execute-result.json"),
    "{broken\n",
  );
  const malformedResult = checkIntegrationTestArtifacts(
    malformed.root,
    malformed.flowManager.state,
    "integration",
    "integration",
  );
  assert.equal(malformedResult.ok, false);
  assert.equal(typeof malformedResult.recover, "undefined");
  assert.equal(malformed.flowManager.updateCalls, 0);
  assert.equal(malformed.flowManager.mutateCalls, 0);
  assert.deepEqual(
    fs.readFileSync(path.join(malformed.specDir, LEDGER_FILE)),
    malformedLedger,
  );
  assert.deepEqual(malformed.flowManager.state.steps, malformedLifecycle);
  assert.equal(
    fs.existsSync(path.join(malformed.specDir, TRANSACTION_FILE)),
    false,
  );

  const failed = createFixture();
  assert.throws(
    () => recover(failed, { faultPhase: "after-flow-state" }),
    /injected after-flow-state/,
  );
  assertPendingOwnedTransaction(failed);

});
