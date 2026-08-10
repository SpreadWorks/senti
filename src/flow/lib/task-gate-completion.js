import path from "node:path";

import {
  completeTaskAndPromoteInState,
  getSpecDir,
} from "../../lib/flow-helpers.js";
import { FatalPostHookError } from "../../lib/post-hook-error.js";
import {
  FlowOutbox,
  FlowOutboxIdentity,
  FlowOutboxStore,
} from "./flow-outbox.js";
import {
  BlockedDirective,
  ExecuteCommandDirective,
} from "./next-action-directive.js";
import { persistOverviewUpdate } from "./run-update-overview.js";
import { StepTransitionCommitIntent } from "./step-transition-policy.js";

const TASK_GATE_STEP_ID = "task-gate";
const TASK_GATE_OVERVIEW_OPERATION = "merge-overview";
const EMPTY_OVERVIEW_ADDITIONS = Object.freeze({
  modules: Object.freeze([]),
  data_flow: Object.freeze([]),
  decisions: Object.freeze([]),
});

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function taskFor(state, taskId) {
  return (state.tasks || []).find((task) => task.id === taskId) || null;
}

function gateFor(task) {
  return (task?.steps || []).find((step) => step.id === TASK_GATE_STEP_ID) || null;
}

export function taskGateOverviewIdentity(state, taskId) {
  return new FlowOutboxIdentity({
    runId: requireString(state?.runId, "task-gate overview runId"),
    taskId: requireString(taskId, "task-gate overview taskId"),
    stepId: TASK_GATE_STEP_ID,
    operation: TASK_GATE_OVERVIEW_OPERATION,
  });
}

function unresolvedOverviewEntries(state) {
  return new FlowOutbox(state?.outbox || []).entries.filter((entry) => (
    entry.identity.stepId === TASK_GATE_STEP_ID
    && entry.identity.operation === TASK_GATE_OVERVIEW_OPERATION
    && entry.status !== "done"
  ));
}

export class TaskGateCompletionIntent extends StepTransitionCommitIntent {
  constructor({ runId, taskId, faultInjector = () => {} }) {
    super();
    if (typeof faultInjector !== "function") {
      throw new Error("task-gate completion faultInjector must be a function");
    }
    this.runId = requireString(runId, "task-gate completion runId");
    this.taskId = requireString(taskId, "task-gate completion taskId");
    this.faultInjector = faultInjector;
    Object.freeze(this);
  }

  assertBeforeTransition(state) {
    if (state.runId !== this.runId) {
      throw new Error("task-gate completion runId changed before commit");
    }
    if (state.currentTaskId !== this.taskId) {
      throw new Error("task-gate completion target is no longer the current task");
    }
    const task = taskFor(state, this.taskId);
    if (!task) throw new Error(`task-gate completion target is missing: ${this.taskId}`);
    if (task.status !== "in_progress") {
      throw new Error(`task-gate completion requires an in_progress task, got ${task.status}`);
    }
    const gate = gateFor(task);
    if (!gate || gate.status !== "in_progress") {
      throw new Error("task-gate completion requires task-gate=in_progress");
    }
    const unfinished = (task.steps || []).filter((step) => (
      step.id !== TASK_GATE_STEP_ID && !["done", "skipped"].includes(step.status)
    ));
    if (unfinished.length > 0) {
      throw new Error(`task-gate completion has unfinished prerequisite steps: ${unfinished.map((step) => step.id).join(", ")}`);
    }
  }

  applyTo(state) {
    const task = taskFor(state, this.taskId);
    if (gateFor(task)?.status !== "done") {
      throw new Error("task-gate lifecycle did not mark the gate done before completion intent");
    }
    completeTaskAndPromoteInState(state, this.taskId, this.faultInjector);
    const outbox = new FlowOutbox(state.outbox || []);
    outbox.begin(taskGateOverviewIdentity(state, this.taskId));
    state.outbox = outbox.toJSON();
  }
}

export class TaskGateCompletionError extends FatalPostHookError {
  constructor(error, taskId) {
    super(
      "TASK_GATE_COMPLETION_FAILED",
      `The atomic task-gate completion for ${taskId} failed: ${error?.message || String(error)}`,
      { cause: error, data: { taskId } },
    );
    this.name = "TaskGateCompletionError";
  }
}

export class TaskGateOverviewEffectError extends FatalPostHookError {
  constructor(error, identity) {
    super(
      "TASK_GATE_OVERVIEW_FAILED",
      `The durable task-gate overview effect for ${identity.taskId} failed: ${error?.message || String(error)}`,
      {
        cause: error,
        data: {
          taskId: identity.taskId,
          idempotencyKey: identity.idempotencyKey,
        },
      },
    );
    this.name = "TaskGateOverviewEffectError";
  }
}

export class TaskGateOverviewEffectResult {
  constructor({ identity, status, specJsonPath = null, specMdPath = null }) {
    if (!(identity instanceof FlowOutboxIdentity)) throw new Error("task-gate overview result identity is required");
    if (!["applied", "already-done"].includes(status)) {
      throw new Error(`invalid task-gate overview result status: ${status}`);
    }
    this.identity = identity;
    this.status = status;
    this.specJsonPath = specJsonPath;
    this.specMdPath = specMdPath;
    Object.freeze(this);
  }

  toJSON() {
    return {
      status: this.status,
      taskId: this.identity.taskId,
      idempotencyKey: this.identity.idempotencyKey,
      ...(this.specJsonPath ? { specJsonPath: this.specJsonPath } : {}),
      ...(this.specMdPath ? { specMdPath: this.specMdPath } : {}),
    };
  }
}

export class TaskGateOverviewEffect {
  constructor({
    root,
    flowManager,
    specId = null,
    taskId,
    persist = persistOverviewUpdate,
  }) {
    if (typeof root !== "string" || !path.isAbsolute(root)) {
      throw new Error("task-gate overview root must be absolute");
    }
    if (!flowManager || typeof flowManager.mutate !== "function") {
      throw new Error("task-gate overview flowManager is required");
    }
    if (typeof persist !== "function") throw new Error("task-gate overview persist boundary is required");
    this.root = root;
    this.flowManager = flowManager;
    this.specId = specId;
    this.taskId = requireString(taskId, "task-gate overview taskId");
    this.persist = persist;
    Object.freeze(this);
  }

  execute() {
    const state = this.specId
      ? this.flowManager.loadReadOnly(this.specId)
      : this.flowManager.load();
    const identity = taskGateOverviewIdentity(state, this.taskId);
    const task = taskFor(state, this.taskId);
    if (!task || task.status !== "done" || gateFor(task)?.status !== "done") {
      throw new TaskGateOverviewEffectError(
        new Error("task-gate overview requires a completed task and gate"),
        identity,
      );
    }
    const current = new FlowOutbox(state.outbox || []).find(identity);
    if (!current) {
      throw new TaskGateOverviewEffectError(new Error("task-gate overview outbox entry is missing"), identity);
    }
    if (current.status === "done") {
      return new TaskGateOverviewEffectResult({ identity, status: "already-done" });
    }

    const store = new FlowOutboxStore(this.flowManager, { specId: this.specId });
    if (current.status === "failed") store.begin(identity);
    try {
      const specDir = getSpecDir(state, this.root);
      if (!specDir) throw new Error("task-gate overview spec directory is unavailable");
      const persisted = this.persist({
        specDir,
        additions: EMPTY_OVERVIEW_ADDITIONS,
        taskId: this.taskId,
      });
      const result = new TaskGateOverviewEffectResult({
        identity,
        status: "applied",
        specJsonPath: persisted.specJsonPath,
        specMdPath: persisted.specMdPath,
      });
      store.complete(identity, result.toJSON());
      return result;
    } catch (error) {
      let durableError = error;
      try {
        store.fail(identity, error);
      } catch (recordError) {
        durableError = new Error(
          `${error?.message || String(error)}; failed to record overview recovery: ${recordError.message}`,
          { cause: recordError },
        );
      }
      throw new TaskGateOverviewEffectError(durableError, identity);
    }
  }
}

export class TaskGateOverviewRecovery {
  constructor({ state, binding }) {
    this.state = state;
    this.binding = binding;
    Object.freeze(this);
  }

  resolve() {
    const entries = unresolvedOverviewEntries(this.state);
    if (entries.length === 0) return null;
    if (entries.length > 1) {
      return {
        directive: new BlockedDirective({
          code: "TASK_GATE_OVERVIEW_RECOVERY_AMBIGUOUS",
          reason: `More than one task-gate overview effect is incomplete: ${entries.map((entry) => entry.identity.taskId).join(", ")}`,
          resumeInstruction: "Inspect the persisted task-gate overview outbox entries and recover them one at a time.",
        }),
        stateChanged: false,
      };
    }
    const entry = entries[0];
    const command = this.binding
      ? this.binding.guardCommand("sennel flow run recover-task-gate-overview")
      : "sennel flow run recover-task-gate-overview";
    return {
      directive: new ExecuteCommandDirective({
        actionId: "RECOVER_TASK_GATE_OVERVIEW",
        nextAction: command,
        instruction: "Resume the persisted task-gate overview effect before continuing the next task or integration gate.",
        reason: entry.status === "failed"
          ? `The task-gate overview effect for ${entry.identity.taskId} failed and is ready for a durable retry.`
          : `The task-gate overview effect for ${entry.identity.taskId} was interrupted while pending.`,
      }),
      stateChanged: false,
    };
  }
}

export function resolveTaskGateOverviewRecovery(state, binding) {
  return new TaskGateOverviewRecovery({ state, binding }).resolve();
}

export function selectTaskGateOverviewRecoveryTask(state) {
  const entries = unresolvedOverviewEntries(state);
  if (entries.length === 0) return null;
  if (entries.length > 1) {
    throw new FatalPostHookError(
      "TASK_GATE_OVERVIEW_RECOVERY_AMBIGUOUS",
      `More than one task-gate overview effect is incomplete: ${entries.map((entry) => entry.identity.taskId).join(", ")}`,
    );
  }
  return entries[0].identity.taskId;
}
