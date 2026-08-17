// spec: R1 R2 R3 R4

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Container } from "../../../src/lib/container.js";
import SetStepCommand from "../../../src/flow/lib/set-step.js";
import { syncSpecTasksToFlow } from "../../../src/flow/lib/sync-spec-tasks.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import {
  makeFlowManager,
  setupFlowAtStep,
} from "../../../tests/helpers/flow-setup.js";
import {
  createTmpDir,
  removeTmpDir,
} from "../../../tests/helpers/tmp-dir.js";

const SPEC_ID = "327-approval-task-sync-atomic";
const SPEC_RELATIVE_PATH = `specs/${SPEC_ID}/spec.json`;

class InterceptingFlowManager {
  constructor(delegate, { beforeUpdate = null, faultInjector = null } = {}) {
    this.delegate = delegate;
    this.beforeUpdate = beforeUpdate;
    this.faultInjector = faultInjector;
  }

  load(...args) {
    return this.delegate.load(...args);
  }

  updateStepStatus(transition, options, commitIntent) {
    this.beforeUpdate?.(this.delegate);
    return this.delegate.updateStepStatus(
      transition,
      {
        ...options,
        ...(this.faultInjector ? { faultInjector: this.faultInjector } : {}),
      },
      commitIntent,
    );
  }
}

function specDocument(tasks = approvalTasks()) {
  return {
    goal: "Commit approval and task synchronization atomically.",
    scope: { in: ["approval task sync"], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "Issue #451 regression fixture.",
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    tasks,
  };
}

function approvalTasks() {
  return [
    {
      id: "T-1",
      title: "First task",
      goal: "Implement the first part.",
      origin: "plan",
      parent: null,
      added_round: 0,
      status: "pending",
    },
    {
      id: "T-2",
      title: "Second task",
      goal: "Implement the second part.",
      origin: "plan",
      parent: null,
      added_round: 0,
      status: "pending",
    },
  ];
}

function writeSpec(root, document = specDocument()) {
  const specPath = path.join(root, SPEC_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(specPath, `${JSON.stringify(document, null, 2)}\n`);
  return specPath;
}

function flowPath(root) {
  return path.join(root, path.dirname(SPEC_RELATIVE_PATH), "flow.json");
}

function visibleBytes(root) {
  return fs.readFileSync(flowPath(root));
}

function visibleState(root) {
  return JSON.parse(visibleBytes(root).toString("utf8"));
}

function createApprovalFixture(roots, overrides = {}) {
  const root = createTmpDir("approval-task-sync-atomic-");
  roots.push(root);
  setupFlowAtStep(root, "approval", {
    spec: SPEC_RELATIVE_PATH,
    issue: 451,
    runId: "run-451",
    tasks: [],
    currentTaskId: null,
    ...overrides,
  });
  writeSpec(root);
  return {
    root,
    flowManager: makeFlowManager(root),
  };
}

function executeApproval({ root, flowManager }) {
  return new SetStepCommand().execute({
    id: "approval",
    status: "done",
    root,
    specId: SPEC_ID,
    flowManager,
  });
}

function commandContainer(root) {
  const container = new Container();
  container.register("paths", { root });
  container.register("mainRoot", root);
  container.register("config", {});
  container.register("flowManager", makeFlowManager(root));
  container.register("inWorktree", false);
  return container;
}

function executeGuardedApproval({ root }, overrides = {}) {
  return new SetStepCommand().run(commandContainer(root), {
    id: "approval",
    status: "done",
    expectRunId: "run-451",
    expectSpec: SPEC_RELATIVE_PATH,
    expectIssue: 451,
    ...overrides,
  });
}

async function rejectionSignature(operation) {
  let rejection = null;
  try {
    await operation();
  } catch (error) {
    rejection = error;
  }
  assert.ok(rejection, "expected a caller-visible rejection");
  return {
    name: rejection.name,
    code: rejection.code || null,
    message: rejection.message,
    committed: rejection.committed ?? null,
  };
}

function failureEnvelopeSignature(result) {
  assert.equal(result.ok, false);
  return result.errors.map((error) => ({
    code: error.code,
    messages: error.messages,
  }));
}

function withoutTransitionTimes(state) {
  const clone = structuredClone(state);
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value == null || typeof value !== "object") return;
    delete value.startedAt;
    delete value.finishedAt;
    Object.values(value).forEach(visit);
  };
  visit(clone);
  return clone;
}

async function assertMatchesCleanSuccess(roots, fixture, execute = executeApproval) {
  const clean = createApprovalFixture(roots);
  await execute(clean);
  assert.deepEqual(
    withoutTransitionTimes(visibleState(fixture.root)),
    withoutTransitionTimes(visibleState(clean.root)),
  );
}

async function assertThrownPreCommitRetry({ roots, breakSpec, repairSpec }) {
  const fixture = createApprovalFixture(roots);
  breakSpec(fixture);
  const before = visibleBytes(fixture.root);

  const first = await rejectionSignature(() => executeApproval(fixture));
  assert.deepEqual(visibleBytes(fixture.root), before);
  const second = await rejectionSignature(() => executeApproval(fixture));
  assert.deepEqual(second, first);
  assert.deepEqual(visibleBytes(fixture.root), before);

  repairSpec(fixture);
  await executeApproval(fixture);
  await assertMatchesCleanSuccess(roots, fixture);
}

function assertCompleteCombinedState(state) {
  const approval = findStepById(state.steps, "approval");
  assert.equal(approval.status, "done");
  assert.ok(Number.isFinite(Date.parse(approval.finishedAt)), "approval completion timestamp must persist");
  assert.equal(findStepById(state.steps, "test").status, "in_progress");
  assert.deepEqual(state.tasks.map((task) => task.id), ["T-1", "T-2"]);
  assert.equal(state.currentTaskId, "T-1");
}

describe("Issue #451 approval/task atomic commit", () => {
  const roots = [];

  afterEach(() => {
    while (roots.length > 0) removeTmpDir(roots.pop());
  });

  it("R1: preserves one complete old or combined state across the atomic rename boundary", async () => {
    for (const [phase, committed] of [
      ["before-state-rename", false],
      ["after-state-rename", true],
    ]) {
      const fixture = createApprovalFixture(roots);
      const before = visibleBytes(fixture.root);
      const flowManager = new InterceptingFlowManager(fixture.flowManager, {
        faultInjector(event) {
          if (event.phase === phase) throw new Error(`injected ${phase}`);
        },
      });

      await assert.rejects(
        executeApproval({ ...fixture, flowManager }),
        (error) => error.code === "FLOW_STATE_ATOMIC_SAVE_FAILED"
          && error.committed === committed,
        phase,
      );

      if (committed) {
        assertCompleteCombinedState(visibleState(fixture.root));
      } else {
        assert.deepEqual(visibleBytes(fixture.root), before);
        assert.equal(findStepById(visibleState(fixture.root).steps, "approval").status, "in_progress");
        assert.deepEqual(visibleState(fixture.root).tasks, []);
      }
    }
  });

  it("R2: propagates broken active-spec input and preparation-time revision drift before mutation", async () => {
    const brokenSpecs = [
      ["missing", (fixture) => fs.rmSync(path.join(fixture.root, SPEC_RELATIVE_PATH))],
      ["malformed", (fixture) => fs.writeFileSync(path.join(fixture.root, SPEC_RELATIVE_PATH), "{broken\n")],
      ["invalid", (fixture) => writeSpec(fixture.root, specDocument([{ id: "", origin: "plan" }]))],
    ];

    for (const [name, breakSpec] of brokenSpecs) {
      const fixture = createApprovalFixture(roots);
      breakSpec(fixture);
      const before = visibleBytes(fixture.root);
      await assert.rejects(executeApproval(fixture), undefined, name);
      assert.deepEqual(visibleBytes(fixture.root), before, name);
    }

    const corruptState = createApprovalFixture(roots);
    fs.writeFileSync(flowPath(corruptState.root), "{broken\n");
    assert.throws(
      () => syncSpecTasksToFlow({ root: corruptState.root }),
      undefined,
      "an active flow load error must not become no-active-flow success",
    );

    const drift = createApprovalFixture(roots);
    let winnerBytes = null;
    const flowManager = new InterceptingFlowManager(drift.flowManager, {
      beforeUpdate(delegate) {
        if (winnerBytes) return;
        delegate.mutate((state) => {
          state.concurrentWinner = "retained";
        });
        winnerBytes = visibleBytes(drift.root);
      },
    });
    await assert.rejects(
      executeApproval({ ...drift, flowManager }),
      (error) => error.code === "FLOW_STATE_ATOMIC_STALE" && error.committed === false,
    );
    assert.deepEqual(visibleBytes(drift.root), winnerBytes);
    assert.equal(visibleState(drift.root).concurrentWinner, "retained");
    assert.equal(findStepById(visibleState(drift.root).steps, "approval").status, "in_progress");
    assert.deepEqual(visibleState(drift.root).tasks, []);
  });

  it("R2: rejects guarded run, spec, and issue mismatches before mutation", async () => {
    for (const [name, mismatch] of [
      ["run", { expectRunId: "wrong-run" }],
      ["spec", { expectSpec: "specs/999-wrong/spec.json" }],
      ["issue", { expectIssue: 999 }],
    ]) {
      const fixture = createApprovalFixture(roots);
      const before = visibleBytes(fixture.root);
      const result = await executeGuardedApproval(fixture, mismatch);
      assert.equal(result.errors[0].code, "ACTIVE_FLOW_MISMATCH", name);
      assert.deepEqual(visibleBytes(fixture.root), before, name);
      assert.equal(findStepById(visibleState(fixture.root).steps, "approval").status, "in_progress", name);
      assert.deepEqual(visibleState(fixture.root).tasks, [], name);
    }
  });

  it("R3: keeps the complete committed state duplicate-free when the caller retries once", async () => {
    const fixture = createApprovalFixture(roots);
    let injected = false;
    const flowManager = new InterceptingFlowManager(fixture.flowManager, {
      faultInjector(event) {
        if (!injected && event.phase === "after-state-rename") {
          injected = true;
          throw new Error("injected committed durability failure");
        }
      },
    });

    await assert.rejects(
      executeApproval({ ...fixture, flowManager }),
      (error) => error.code === "FLOW_STATE_ATOMIC_SAVE_FAILED" && error.committed === true,
    );
    const committedBytes = visibleBytes(fixture.root);
    assertCompleteCombinedState(visibleState(fixture.root));

    const retry = await executeApproval({ ...fixture, flowManager });
    assert.equal(retry.ok, false);
    assert.equal(retry.errors[0].code, "FLOW_STEP_TRANSITION_INVALID");
    assert.deepEqual(visibleBytes(fixture.root), committedBytes);
    assert.deepEqual(visibleState(fixture.root).tasks.map((task) => task.id), ["T-1", "T-2"]);
  });

  it("R3: repeats pre-commit spec and target failures once and matches clean success after repair", async () => {
    await assertThrownPreCommitRetry({
      roots,
      breakSpec(fixture) {
        fs.rmSync(path.join(fixture.root, SPEC_RELATIVE_PATH));
      },
      repairSpec(fixture) {
        writeSpec(fixture.root);
      },
    });
    await assertThrownPreCommitRetry({
      roots,
      breakSpec(fixture) {
        fs.writeFileSync(path.join(fixture.root, SPEC_RELATIVE_PATH), "{broken\n");
      },
      repairSpec(fixture) {
        writeSpec(fixture.root);
      },
    });
    await assertThrownPreCommitRetry({
      roots,
      breakSpec(fixture) {
        writeSpec(fixture.root, specDocument([{ id: "", origin: "plan" }]));
      },
      repairSpec(fixture) {
        writeSpec(fixture.root);
      },
    });

    const mismatch = createApprovalFixture(roots);
    const before = visibleBytes(mismatch.root);
    const first = failureEnvelopeSignature(await executeGuardedApproval(mismatch, { expectRunId: "wrong-run" }));
    assert.deepEqual(visibleBytes(mismatch.root), before);
    const second = failureEnvelopeSignature(await executeGuardedApproval(mismatch, { expectRunId: "wrong-run" }));
    assert.deepEqual(second, first);
    assert.deepEqual(visibleBytes(mismatch.root), before);
    await executeGuardedApproval(mismatch);
    await assertMatchesCleanSuccess(roots, mismatch, executeGuardedApproval);
  });

  it("R4: commits the happy path once and preserves task mapping, promotion, and result fields", async () => {
    const fixture = createApprovalFixture(roots);
    const target = flowPath(fixture.root);
    const originalRename = fs.renameSync;
    let flowCommits = 0;
    fs.renameSync = (source, destination) => {
      if (path.resolve(destination) === path.resolve(target)) flowCommits += 1;
      return originalRename(source, destination);
    };

    let result;
    try {
      result = await executeApproval(fixture);
    } finally {
      fs.renameSync = originalRename;
    }

    assert.equal(flowCommits, 1);
    assert.deepEqual(result, {
      id: "approval",
      status: "done",
      tasksSynced: ["T-1", "T-2"],
    });
    const state = visibleState(fixture.root);
    assertCompleteCombinedState(state);
    assert.deepEqual(state.tasks[0], {
      id: "T-1",
      spec: "specs/327-approval-task-sync-atomic/tasks/T-1.md",
      origin: "plan",
      parent: null,
      status: "in_progress",
      steps: [
        { id: "task-impl", status: "pending" },
        { id: "task-review", status: "pending" },
        { id: "task-gate", status: "pending" },
      ],
      requirements: [],
      summary: null,
      added_round: 0,
    });
    assert.deepEqual(state.tasks[1], {
      id: "T-2",
      spec: "specs/327-approval-task-sync-atomic/tasks/T-2.md",
      origin: "plan",
      parent: null,
      status: "pending",
      steps: [
        { id: "task-impl", status: "pending" },
        { id: "task-review", status: "pending" },
        { id: "task-gate", status: "pending" },
      ],
      requirements: [],
      summary: null,
      added_round: 0,
    });

    const noActiveRoot = createTmpDir("approval-task-sync-no-active-");
    roots.push(noActiveRoot);
    assert.deepEqual(syncSpecTasksToFlow({ root: noActiveRoot }), {
      added: [],
      skipped: true,
      reason: "no active flow",
    });
  });

  it("R4: preserves an existing spec task and appends only the absent id", async () => {
    const existingTask = {
      id: "T-1",
      spec: "specs/327-approval-task-sync-atomic/tasks/T-1.md",
      origin: "plan",
      parent: null,
      status: "pending",
      steps: [
        { id: "task-impl", status: "pending" },
        { id: "task-review", status: "pending" },
        { id: "task-gate", status: "pending" },
      ],
      requirements: ["existing-requirement"],
      summary: "preserve existing task data",
      added_round: 7,
    };
    const fixture = createApprovalFixture(roots, { tasks: [existingTask] });

    const result = await executeApproval(fixture);

    assert.deepEqual(result.tasksSynced, ["T-2"]);
    const state = visibleState(fixture.root);
    assert.deepEqual(state.tasks.map((task) => task.id), ["T-1", "T-2"]);
    assert.equal(state.tasks.filter((task) => task.id === "T-1").length, 1);
    assert.deepEqual(state.tasks[0], { ...existingTask, status: "in_progress" });
    assert.equal(state.currentTaskId, "T-1");
  });
});
