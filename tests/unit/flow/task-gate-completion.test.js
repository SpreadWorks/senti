import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import {
  TaskGateCompletionError,
  TaskGateCompletionIntent,
  TaskGateOverviewEffect,
} from "../../../src/flow/lib/task-gate-completion.js";
import { NormalStepTransition } from "../../../src/flow/lib/step-transition-policy.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/impl-repair-artifacts.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import {
  makeDefaultTask,
  makeFlowManager,
  makeFlowState,
  moveFlowToStep,
} from "../../helpers/flow-setup.js";

const CLI = path.join(process.cwd(), "src/senti.js");

function validSpec() {
  return {
    goal: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "",
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    tasks: [],
  };
}

function task(specId, id, status) {
  const stepStatus = status === "in_progress"
    ? (stepId) => stepId === "task-gate" ? "in_progress" : "done"
    : () => status === "done" ? "done" : "pending";
  return makeDefaultTask({
    id,
    spec: `specs/${specId}/tasks/${id}.md`,
    status,
    requirements: [],
    summary: null,
    steps: [
      { id: "task-impl", status: stepStatus("task-impl") },
      { id: "task-review", status: stepStatus("task-review") },
      { id: "task-gate", status: stepStatus("task-gate") },
    ],
  });
}

function setupTaskGate(root, specId, taskCount, { spec = validSpec() } = {}) {
  const specDir = path.join(root, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  const tasks = Array.from({ length: taskCount }, (_, index) => (
    task(specId, `T-${index + 1}`, index === 0 ? "in_progress" : "pending")
  ));
  const state = moveFlowToStep(makeFlowState({
    spec: `specs/${specId}/spec.json`,
    runId: `run-${specId}`,
    featureBranch: `feature/${specId}`,
    tasks,
    currentTaskId: "T-1",
  }), "implement");
  const manager = makeFlowManager(root);
  manager.create(state);
  manager.addActiveFlow(specId, "branch");
  return manager;
}

function completionTransition() {
  return new NormalStepTransition({
    stepId: "task-gate",
    currentStepId: "task-gate",
    currentStatus: "in_progress",
    requestedStatus: "done",
  });
}

function completionIntent(state, faultInjector = () => {}) {
  return new TaskGateCompletionIntent({
    runId: state.runId,
    taskId: "T-1",
    faultInjector,
  });
}

function gatePassContext(root, specId, manager) {
  return {
    root,
    phase: "task-impl",
    flowState: manager.loadReadOnly(specId),
    flowManager: manager,
    specId,
  };
}

function gatePassResult() {
  return {
    result: "pass",
    artifacts: { phase: "task-impl", evaluations: [] },
    next: "refresh-next-action",
  };
}

function runCli(root, args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: root },
  });
  return {
    exitCode: result.status,
    envelope: result.stdout ? JSON.parse(result.stdout) : null,
    stderr: result.stderr,
  };
}

describe("atomic task-gate completion", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  for (const [specId, taskCount] of [
    ["324-standalone-plugin-attribution", 3],
    ["326-update-overview-contract", 1],
    ["328-bounded-review-convergence", 6],
  ]) {
    it(`commits the historical ${specId} task-gate shape without the old contradiction`, () => {
      tmp = createTmpDir(`task-gate-${specId}-`);
      const manager = setupTaskGate(tmp, specId, taskCount);
      const before = manager.loadReadOnly(specId);
      let mutationCount = 0;
      const mutate = manager._store.mutate.bind(manager._store);
      manager._store.mutate = (...args) => {
        mutationCount += 1;
        return mutate(...args);
      };

      manager.updateStepStatus(
        completionTransition(),
        { specId, taskId: "T-1" },
        completionIntent(before),
      );

      const persisted = manager.loadReadOnly(specId);
      const completed = persisted.tasks[0];
      assert.equal(mutationCount, 1);
      assert.equal(completed.steps.find((step) => step.id === "task-gate").status, "done");
      assert.equal(completed.status, "done");
      assert.notEqual(persisted.currentTaskId, "T-1");
      assert.equal(persisted.currentTaskId, taskCount > 1 ? "T-2" : null);
      if (taskCount > 1) assert.equal(persisted.tasks[1].status, "in_progress");
      assert.equal(persisted.outbox.length, 1);
      assert.equal(persisted.outbox[0].taskId, "T-1");
      assert.equal(persisted.outbox[0].status, "pending");
    });
  }

  for (const phase of ["after-task-completion", "after-next-task-promotion"]) {
    it(`persists none of the transition when failure is injected ${phase}`, () => {
      tmp = createTmpDir(`task-gate-${phase}-`);
      const specId = phase === "after-task-completion"
        ? "901-atomic-completion"
        : "902-atomic-promotion";
      const manager = setupTaskGate(tmp, specId, 2);
      const before = manager.loadReadOnly(specId);
      const flowPath = path.join(tmp, "specs", specId, "flow.json");
      const beforeBytes = fs.readFileSync(flowPath);

      assert.throws(
        () => manager.updateStepStatus(
          completionTransition(),
          { specId, taskId: "T-1" },
          completionIntent(before, ({ phase: observed }) => {
            if (observed === phase) throw new Error(`injected ${phase}`);
          }),
        ),
        new RegExp(`injected ${phase}`),
      );

      assert.deepEqual(fs.readFileSync(flowPath), beforeBytes);
      const persisted = manager.loadReadOnly(specId);
      assert.equal(persisted.tasks[0].status, "in_progress");
      assert.equal(persisted.tasks[0].steps.at(-1).status, "in_progress");
      assert.equal(persisted.tasks[1].status, "pending");
      assert.equal(persisted.currentTaskId, "T-1");
      assert.deepEqual(persisted.outbox || [], []);
    });
  }

  it("wraps an atomic writer failure as a typed, retryable task-gate error", async () => {
    tmp = createTmpDir("task-gate-typed-error-");
    const specId = "903-typed-error";
    const manager = setupTaskGate(tmp, specId, 2);
    const originalUpdate = manager.updateStepStatus.bind(manager);
    manager.updateStepStatus = (transition, options, intent) => originalUpdate(transition, {
      ...options,
      faultInjector({ phase }) {
        if (phase === "before-state-temp-write") throw new Error("injected atomic write failure");
      },
    }, intent);

    await assert.rejects(
      FLOW_COMMANDS.run.gate.post(
        gatePassContext(tmp, specId, manager),
        gatePassResult(),
      ),
      (error) => {
        assert.ok(error instanceof TaskGateCompletionError);
        assert.equal(error.code, "TASK_GATE_COMPLETION_FAILED");
        assert.match(error.message, /injected atomic write failure/);
        return true;
      },
    );

    const persisted = manager.loadReadOnly(specId);
    assert.equal(persisted.tasks[0].status, "in_progress");
    assert.equal(persisted.tasks[0].steps.at(-1).status, "in_progress");
    assert.equal(persisted.tasks[1].status, "pending");
    assert.equal(persisted.currentTaskId, "T-1");
  });

  it("records overview failure durably and recovers it through normal next-action", async () => {
    tmp = createTmpDir("task-gate-overview-recovery-");
    const specId = "904-overview-recovery";
    const manager = setupTaskGate(tmp, specId, 1, {
      spec: { requirements: [] },
    });

    await assert.rejects(
      FLOW_COMMANDS.run.gate.post(
        gatePassContext(tmp, specId, manager),
        gatePassResult(),
      ),
      (error) => {
        assert.equal(error.code, "TASK_GATE_OVERVIEW_FAILED");
        assert.match(error.message, /spec\.json failed schema validation/);
        return true;
      },
    );

    let persisted = manager.loadReadOnly(specId);
    assert.equal(persisted.tasks[0].status, "done");
    assert.equal(persisted.tasks[0].steps.at(-1).status, "done");
    assert.equal(persisted.currentTaskId, null);
    assert.equal(persisted.outbox[0].status, "failed");
    assert.equal(persisted.outbox[0].attempt, 1);

    fs.writeFileSync(
      path.join(tmp, "specs", specId, "spec.json"),
      `${JSON.stringify(validSpec(), null, 2)}\n`,
    );
    const planned = runCli(tmp, ["flow", "get", "next-action"]);
    assert.equal(planned.exitCode, 0, planned.stderr);
    assert.equal(planned.envelope.data.directive.actionId, "RECOVER_TASK_GATE_OVERVIEW");
    const binding = planned.envelope.data.directive.nextAction.match(/--expect-binding '([^']+)'/)?.[1];
    assert.ok(binding, "recovery command must retain the exact Flow target binding");

    const recovered = runCli(tmp, [
      "flow", "run", "recover-task-gate-overview",
      "--expect-binding", binding,
      "--expect-no-issue",
    ]);
    assert.equal(recovered.exitCode, 0, recovered.stderr);
    assert.equal(recovered.envelope.ok, true);
    assert.equal(recovered.envelope.data.status, "applied");

    persisted = manager.loadReadOnly(specId);
    assert.equal(persisted.outbox[0].status, "done");
    assert.equal(persisted.outbox[0].attempt, 2);
    let duplicateExecutions = 0;
    const duplicate = new TaskGateOverviewEffect({
      root: tmp,
      flowManager: manager,
      specId,
      taskId: "T-1",
      persist() {
        duplicateExecutions += 1;
        throw new Error("completed effect must not execute again");
      },
    }).execute();
    assert.equal(duplicate.status, "already-done");
    assert.equal(duplicateExecutions, 0);

    const resumed = runCli(tmp, ["flow", "get", "next-action"]);
    assert.equal(resumed.exitCode, 0, resumed.stderr);
    assert.equal(resumed.envelope.data.directive.actionId, undefined);
    assert.equal(resumed.envelope.data.taskId, null);
    assert.equal(resumed.envelope.data.step, "implement");
  });

  it("preserves the integration-gate transition after all tasks are complete", async () => {
    tmp = createTmpDir("task-gate-integration-");
    const specId = "905-integration";
    const specDir = path.join(tmp, "specs", specId);
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(
      path.join(specDir, "spec.json"),
      `${JSON.stringify(validSpec(), null, 2)}\n`,
    );
    const state = moveFlowToStep(makeFlowState({
      spec: `specs/${specId}/spec.json`,
      runId: `run-${specId}`,
      featureBranch: `feature/${specId}`,
      tasks: [task(specId, "T-1", "done")],
      currentTaskId: null,
    }), "impl-gate");
    const manager = makeFlowManager(tmp);
    manager.create(state);
    manager.addActiveFlow(specId, "branch");
    const fingerprint = buildRepairFingerprint({
      root: tmp,
      specPath: state.spec,
      state: manager.loadReadOnly(specId),
    });
    fs.writeFileSync(path.join(specDir, "impl-gate-result.json"), `${JSON.stringify({
      runId: state.runId,
      repairFingerprint: fingerprint.hash,
      result: "pass",
      phase: "integration",
      level: "integration",
      evaluations: [],
      nextAction: "retro",
    }, null, 2)}\n`);

    await FLOW_COMMANDS.run.gate.post({
      root: tmp,
      phase: "integration",
      flowState: manager.loadReadOnly(specId),
      flowManager: manager,
      specId,
    }, {
      result: "pass",
      artifacts: { phase: "integration", evaluations: [] },
      next: "refresh-next-action",
    });

    const persisted = manager.loadReadOnly(specId);
    assert.equal(findStepById(persisted.steps, "impl-gate").status, "done");
    assert.equal(findStepById(persisted.steps, "retro").status, "in_progress");
    assert.deepEqual(persisted.outbox || [], []);
  });
});
