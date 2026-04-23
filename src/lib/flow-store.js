/**
 * src/lib/flow-store.js
 *
 * Owns `specs/<NNN>/flow.json` — the per-spec state file.
 * Provides load / save / mutate primitives plus the targeted setter helpers.
 *
 * Task-aware (cac6/T2): load enforces the new `tasks`/`currentTaskId` schema.
 * Mutators accept an optional `{ taskId }` scope argument; when omitted, scope
 * is inferred from `state.currentTaskId`.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { runGit } from "./git-helpers.js";
import { sddDir } from "./config.js";
import {
  STATE_FILE,
  specIdFromPath,
  TASK_ORIGINS,
  TASK_STATUSES,
  TASK_STEP_STATUSES,
  TASK_REQUIREMENT_STATUSES,
} from "./flow-helpers.js";

function specFlowPath(root, specId) {
  return path.join(root, "specs", specId, STATE_FILE);
}

function specIdFromBranch(root) {
  const res = runGit(["-C", root, "rev-parse", "--abbrev-ref", "HEAD"]);
  if (!res.ok) return null;
  const branch = res.stdout.trim();
  const prefix = "feature/";
  if (branch.startsWith(prefix)) return branch.slice(prefix.length);
  return null;
}

function assertTaskSchema(state, sourcePath) {
  if (!state || typeof state !== "object") {
    throw new Error(`flow-store: invalid flow state (not an object): ${sourcePath || "<unknown>"}`);
  }
  if (!Array.isArray(state.tasks)) {
    throw new Error(
      `flow-store: legacy flow.json without 'tasks' field rejected. ` +
      `Path: ${sourcePath || "<unknown>"}. ` +
      `cac6/T2 requires 'tasks: []' and 'currentTaskId: null' on every flow.json.`,
    );
  }
  if (!("currentTaskId" in state)) {
    throw new Error(
      `flow-store: legacy flow.json without 'currentTaskId' field rejected. ` +
      `Path: ${sourcePath || "<unknown>"}.`,
    );
  }
  if (state.metrics != null && !Array.isArray(state.metrics)) {
    throw new Error(
      `flow-store: legacy flow.json with non-array 'metrics' rejected. ` +
      `Path: ${sourcePath || "<unknown>"}. ` +
      `cac6/T10 requires 'metrics' to be an append-only entry array.`,
    );
  }
  if (state.notes != null) {
    if (!Array.isArray(state.notes)) {
      throw new Error(
        `flow-store: legacy flow.json with non-array 'notes' rejected. ` +
        `Path: ${sourcePath || "<unknown>"}.`,
      );
    }
    const firstNonObj = state.notes.find((n) => n != null && typeof n !== "object");
    if (firstNonObj !== undefined) {
      throw new Error(
        `flow-store: legacy flow.json with string-array 'notes' rejected. ` +
        `Path: ${sourcePath || "<unknown>"}. ` +
        `cac6/T10 requires note entries to be objects {taskId, text, ts}.`,
      );
    }
  }
  for (const task of state.tasks) {
    if (task && ("metrics" in task || "notes" in task)) {
      throw new Error(
        `flow-store: legacy flow.json with per-task metrics/notes rejected. ` +
        `Task: ${task.id}. Path: ${sourcePath || "<unknown>"}. ` +
        `cac6/T10 moved metrics/notes to flat top-level arrays with taskId.`,
      );
    }
  }
}

/**
 * Resolve the taskId for an append-only log entry (metrics / notes / issue-log).
 * Rules: explicit `opts.taskId` always wins (null → flow scope, unknown id →
 * throw); when omitted, infer from `state.currentTaskId` (null if none).
 *
 * @returns {string|null} resolved taskId (null = flow scope)
 */
export function resolveTaskIdForEntry(state, opts) {
  const explicit = opts && Object.prototype.hasOwnProperty.call(opts, "taskId");
  if (explicit) {
    const { taskId } = opts;
    if (taskId == null) return null;
    const task = (state.tasks || []).find((t) => t.id === taskId);
    if (!task) throw new Error(`unknown task id: ${taskId}`);
    return taskId;
  }
  return state.currentTaskId ?? null;
}

/**
 * Resolve which scope (parent/flow-level vs a specific task) a mutation should
 * target. Used by step / requirement / test-summary setters (still per-task).
 *
 * Explicit argument wins: undefined → infer from currentTaskId, null → parent,
 * "<id>" → target task (throw if unknown).
 *
 * @returns {object} scope object on which to mutate (state or a task)
 */
/**
 * Promote the first pending step in `steps` to `in_progress` when no step
 * is currently `in_progress`. Used by `updateStepStatus` on →done transitions
 * and by `flow get next-action` as a NO_IN_PROGRESS_STEP fallback (spec 219).
 *
 * Returns the promoted step, or null when nothing was promoted (either another
 * step is already in_progress, or no pending remains).
 */
export function promoteFirstPending(steps) {
  if (!Array.isArray(steps)) return null;
  if (steps.some((s) => s.status === "in_progress")) return null;
  const pending = steps.find((s) => s.status === "pending");
  if (!pending) return null;
  pending.status = "in_progress";
  return pending;
}

export function resolveMutationScope(state, opts = {}) {
  const explicit = Object.prototype.hasOwnProperty.call(opts, "taskId");
  const taskId = explicit ? opts.taskId : (state.currentTaskId ?? null);
  if (taskId == null) return state;
  const task = (state.tasks || []).find((t) => t.id === taskId);
  if (!task) {
    throw new Error(
      explicit
        ? `unknown task id: ${taskId}`
        : `internal: currentTaskId='${taskId}' not found in state.tasks`,
    );
  }
  return task;
}

export class FlowStore {
  /**
   * @param {Object} opts
   * @param {string} opts.root        - work root (worktree path when in one)
   * @param {string} opts.mainRoot    - main repo root
   * @param {boolean} opts.inWorktree - pre-resolved worktree flag
   * @param {() => import("./active-flow-registry.js").ActiveFlowRegistry} opts.activeFlowsProvider
   */
  constructor({ root, mainRoot, inWorktree, activeFlowsProvider }) {
    this._root = root;
    this._mainRoot = mainRoot;
    this._inWorktree = inWorktree;
    this._activeFlowsProvider = activeFlowsProvider;
  }

  pathFor(specId) {
    return specFlowPath(this._root, specId);
  }

  /**
   * Load flow.json. Returns null if not found. Throws when the file exists but
   * predates the cac6/T2 schema (missing `tasks`/`currentTaskId`).
   * @param {string} [specId]
   * @returns {object|null}
   */
  load(specId) {
    let state = null;
    let resolvedPath = null;

    if (specId) {
      const p = specFlowPath(this._root, specId);
      if (!fs.existsSync(p)) return null;
      state = JSON.parse(fs.readFileSync(p, "utf8"));
      resolvedPath = p;
    } else if (this._inWorktree) {
      const id = specIdFromBranch(this._root);
      if (id) {
        const p = specFlowPath(this._root, id);
        if (fs.existsSync(p)) {
          state = JSON.parse(fs.readFileSync(p, "utf8"));
          resolvedPath = p;
        }
      }
    }

    if (!state) {
      const flows = this._activeFlowsProvider().load();
      const current = this._resolveCurrentFlow(flows);
      if (!current) return null;
      const p = specFlowPath(this._root, current.spec);
      if (!fs.existsSync(p)) return null;
      state = JSON.parse(fs.readFileSync(p, "utf8"));
      resolvedPath = p;
    }

    assertTaskSchema(state, resolvedPath);

    if (state && !state.runId) {
      state.runId = crypto.randomUUID();
      try {
        fs.writeFileSync(resolvedPath, JSON.stringify(state, null, 2) + "\n", "utf8");
      } catch (err) {
        console.error(`[flow-state] WARN: failed to persist migrated runId: ${err.message}`);
      }
    }

    return state;
  }

  /**
   * Read-only loader. Does NOT trigger transparent migration. Enforces the
   * task-aware schema (throws on legacy files).
   */
  loadReadOnly(specId) {
    const p = specFlowPath(this._root, specId);
    if (!fs.existsSync(p)) return null;
    let state;
    try {
      state = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (err) {
      process.stderr.write(`[sdd-forge] flow-store.loadReadOnly: malformed flow.json at ${p}: ${err.message}\n`);
      return null;
    }
    assertTaskSchema(state, p);
    return state;
  }

  save(state) {
    // Guarantee the task-aware schema is always persisted.
    if (!Array.isArray(state.tasks)) state.tasks = [];
    if (!("currentTaskId" in state)) state.currentTaskId = null;
    const specId = specIdFromPath(state.spec);
    const p = specFlowPath(this._root, specId);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(state, null, 2) + "\n", "utf8");
  }

  mutate(mutator) {
    const state = this.load();
    if (!state) throw new Error("no active flow (flow.json not found)");
    mutator(state);
    this.save(state);
  }

  pathForCurrent() {
    const flows = this._activeFlowsProvider().load();
    const current = this._resolveCurrentFlow(flows);
    if (!current) return null;
    return specFlowPath(this._root, current.spec);
  }

  resolveWorktreePaths(state) {
    if (!state.worktree) return { worktreePath: null, mainRepoPath: null };

    if (this._inWorktree) {
      return { worktreePath: this._root, mainRepoPath: this._mainRoot };
    }

    const dirName = state.featureBranch.replace(/\//g, "-");
    return {
      worktreePath: path.join(sddDir(this._root), "worktree", dirName),
      mainRepoPath: this._root,
    };
  }

  saveFinalizedAt(specId, iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(iso)) {
      throw new Error(`invalid finalizedAt: expected ISO 8601 UTC (e.g. 2026-04-17T10:00:00.000Z), got ${iso}`);
    }
    const p = specFlowPath(this._root, specId);
    if (!fs.existsSync(p)) {
      throw new Error(`flow.json not found for spec ${specId}: ${p}`);
    }
    const state = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!state.state || typeof state.state !== "object") state.state = {};
    state.state.finalizedAt = iso;
    fs.writeFileSync(p, JSON.stringify(state, null, 2) + "\n", "utf8");
  }

  // ── targeted setters (scope-aware) ──────────────────────────────────────────

  updateStepStatus(stepId, status, opts) {
    this.mutate((state) => {
      const scope = resolveMutationScope(state, opts);
      if (!Array.isArray(scope.steps)) {
        throw new Error("flow-store: scope has no steps array");
      }
      const step = scope.steps.find((s) => s.id === stepId);
      if (!step) throw new Error(`unknown step: ${stepId}`);
      step.status = status;
      // spec 219: on a →done transition, auto-promote the first pending step
      // in the same scope to in_progress when no other step is in_progress.
      // Keeps the single in_progress invariant; removes the need for skill
      // callers to manually advance to the next step after gate/set-step done.
      if (status === "done") promoteFirstPending(scope.steps);
    });
  }

  setRequirements(descriptions, opts) {
    this.mutate((state) => {
      const scope = resolveMutationScope(state, opts);
      scope.requirements = descriptions.map((desc) => ({ desc, status: "pending" }));
    });
  }

  setTestSummary(summary, opts) {
    const target = opts?.baseline ? "baseline" : "summary";
    const mode = opts?.mode ?? "replace";
    this.mutate((state) => {
      const scope = resolveMutationScope(state, opts);
      if (!scope.test) scope.test = {};
      if (mode === "fallback") {
        const existing = scope.test[target] || {};
        scope.test[target] = { ...existing, failed: summary.failed };
      } else {
        scope.test[target] = summary;
      }
    });
  }

  updateRequirement(index, status, opts) {
    this.mutate((state) => {
      const scope = resolveMutationScope(state, opts);
      if (!scope.requirements?.[index]) throw new Error(`requirement index out of range: ${index}`);
      scope.requirements[index].status = status;
    });
  }

  setRequest(text) { this.mutate((state) => { state.request = text; }); }
  setIssue(issue) { this.mutate((state) => { state.issue = issue; }); }

  /**
   * Append an entry to a flat top-level array on `state[arrayKey]` with
   * store-owned `taskId` / `ts` fields. Shared by `addNote` and `appendMetric`.
   *
   * @param {string} arrayKey — e.g. "notes" or "metrics"
   * @param {object} payload — entry body (taskId/ts are overwritten by store)
   * @param {{taskId?: string|null}} [opts] — explicit taskId override
   */
  _appendFlowEntry(arrayKey, payload, opts) {
    this.mutate((state) => {
      const taskId = resolveTaskIdForEntry(state, opts);
      if (!Array.isArray(state[arrayKey])) state[arrayKey] = [];
      state[arrayKey].push({ ...payload, taskId, ts: new Date().toISOString() });
    });
  }

  addNote(text, opts) {
    this._appendFlowEntry("notes", { text }, opts);
  }

  /**
   * Append a metric entry. Ambient calls (no explicit taskId and no active
   * flow) are skipped silently; otherwise invariants match `_appendFlowEntry`.
   *
   * @param {object|null} payload — entry body without taskId/ts (null → skip)
   * @param {{taskId?: string|null}} [opts]
   */
  appendMetric(payload, opts) {
    if (!payload) return;
    const hasExplicit = opts && Object.prototype.hasOwnProperty.call(opts, "taskId");
    if (!hasExplicit && !this.pathForCurrent()) return;
    this._appendFlowEntry("metrics", payload, opts);
  }

  incrementMetric(phase, counter, opts) {
    if (!phase) return;
    this.appendMetric({ phase, counter, delta: 1 }, opts);
  }

  accumulateAgentMetrics(phase, { usage, responseChars, model, durationMs, taskId } = {}) {
    if (!phase) return;
    const payload = {
      phase,
      kind: "agent",
      callCount: 1,
      responseChars: responseChars || 0,
      ...(durationMs != null && { durationMs }),
      ...(model && { model }),
      ...(usage && {
        tokens: {
          input: usage.input_tokens || 0,
          output: usage.output_tokens || 0,
          cacheRead: usage.cache_read_tokens || 0,
          cacheCreation: usage.cache_creation_tokens || 0,
        },
        ...(usage.cost_usd != null && { cost: usage.cost_usd }),
      }),
    };
    this.appendMetric(payload, taskId !== undefined ? { taskId } : undefined);
  }

  // ── task primitives (cac6/T2) ───────────────────────────────────────────────

  addTask(task) {
    validateTaskShape(task);
    this.mutate((state) => {
      if ((state.tasks || []).some((t) => t.id === task.id)) {
        throw new Error(`duplicate task id: ${task.id}`);
      }
      state.tasks.push(task);
      state.currentTaskId = task.id;
    });
  }

  completeTask(taskId) {
    this.mutate((state) => {
      const task = (state.tasks || []).find((t) => t.id === taskId);
      if (!task) throw new Error(`unknown task id: ${taskId}`);
      task.status = "done";
      if (state.currentTaskId === taskId) state.currentTaskId = null;
      aggregateTaskSummaryIntoParent(state, task);
    });
  }

  setCurrentTaskStep(stepId, status) {
    this.mutate((state) => {
      if (state.currentTaskId == null) {
        throw new Error("no current task (currentTaskId is null)");
      }
      const task = (state.tasks || []).find((t) => t.id === state.currentTaskId);
      if (!task) {
        throw new Error(`internal: currentTaskId='${state.currentTaskId}' not found in state.tasks`);
      }
      const step = (task.steps || []).find((s) => s.id === stepId);
      if (!step) throw new Error(`unknown step: ${stepId}`);
      // Clear any other in_progress step within the same task so that only one
      // step is in progress at a time.
      if (status === "in_progress") {
        for (const s of task.steps) {
          if (s !== step && s.status === "in_progress") s.status = "pending";
        }
      }
      step.status = status;
    });
  }

  // ── internal ────────────────────────────────────────────────────────────────

  _resolveCurrentFlow(flows) {
    if (flows.length === 0) return null;
    if (flows.length === 1) return flows[0];

    const res = runGit(["-C", this._root, "rev-parse", "--abbrev-ref", "HEAD"]);
    if (!res.ok) return null;
    const currentBranch = res.stdout.trim();

    for (const entry of flows) {
      if (currentBranch === `feature/${entry.spec}`) return entry;
    }
    return null;
  }
}

/**
 * Aggregate a completed task's test.summary counts into the parent state's
 * test.summary. Sums unit / integration / acceptance fields. No-op when the
 * task has no summary.
 */
function aggregateTaskSummaryIntoParent(state, task) {
  const taskSummary = task?.test?.summary;
  if (!taskSummary || typeof taskSummary !== "object") return;
  if (!state.test) state.test = {};
  if (!state.test.summary) state.test.summary = {};
  for (const key of ["unit", "integration", "acceptance"]) {
    const add = Number(taskSummary[key]) || 0;
    state.test.summary[key] = (Number(state.test.summary[key]) || 0) + add;
  }
}

/**
 * Validate that the provided value has the shape of a Task per cac6/T2.
 * Throws on any missing/invalid field.
 */
function validateTaskShape(task) {
  if (!task || typeof task !== "object") {
    throw new Error("addTask: task must be an object");
  }
  const required = ["id", "spec", "origin", "parent", "status", "steps", "requirements", "summary"];
  for (const key of required) {
    if (!(key in task)) {
      throw new Error(`addTask: task missing required field '${key}'`);
    }
  }
  if (typeof task.id !== "string" || task.id.length === 0) {
    throw new Error("addTask: task.id must be a non-empty string");
  }
  if (typeof task.spec !== "string" || task.spec.length === 0) {
    throw new Error("addTask: task.spec must be a non-empty string");
  }
  if (!TASK_ORIGINS.includes(task.origin)) {
    throw new Error(`addTask: invalid task.origin='${task.origin}' (expected ${TASK_ORIGINS.join("|")})`);
  }
  if (task.parent !== null && typeof task.parent !== "string") {
    throw new Error("addTask: task.parent must be string|null");
  }
  if (!TASK_STATUSES.includes(task.status)) {
    throw new Error(`addTask: invalid task.status='${task.status}'`);
  }
  if (!Array.isArray(task.steps)) {
    throw new Error("addTask: task.steps must be an array");
  }
  if (!Array.isArray(task.requirements)) {
    throw new Error("addTask: task.requirements must be an array");
  }
  for (const s of task.steps) {
    if (!s || typeof s !== "object" || typeof s.id !== "string" || typeof s.status !== "string") {
      throw new Error("addTask: each task.steps entry must be { id: string, status: string }");
    }
    if (!TASK_STEP_STATUSES.includes(s.status)) {
      throw new Error(`addTask: invalid step status '${s.status}' for step '${s.id}'`);
    }
  }
  for (const r of task.requirements) {
    if (!r || typeof r !== "object" || typeof r.desc !== "string" || typeof r.status !== "string") {
      throw new Error("addTask: each task.requirements entry must be { desc: string, status: string }");
    }
    if (!TASK_REQUIREMENT_STATUSES.includes(r.status)) {
      throw new Error(`addTask: invalid requirement status '${r.status}'`);
    }
  }
  if (task.summary !== null && typeof task.summary !== "string") {
    throw new Error("addTask: task.summary must be string|null");
  }
}
