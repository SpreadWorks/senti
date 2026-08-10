/**
 * src/lib/flow-store.js
 *
 * Owns `<configured-spec-root>/<specId>/flow.json` — the per-spec state file.
 * Provides load / create / atomic mutation primitives plus targeted setters.
 *
 * Task-aware (cac6/T2): load enforces the new `tasks`/`currentTaskId` schema.
 * Mutators accept an optional `{ taskId }` scope argument; when omitted, scope
 * is inferred from `state.currentTaskId`.
 */

import fs from "fs";
import path from "path";
import { normalizeAgentMetricDimension } from "./agent-metrics.js";
import {
  hasExplicitOption,
} from "./flow-options.js";
import { runGit } from "./git-helpers.js";
import { managedDir } from "./config.js";
import { renameFlowStateStepIds } from "./step-id-rename.js";
import { FlowSpecId } from "./flow-spec-id.js";
import {
  AtomicFlowStateWriter,
  FlowStateAtomicSaveError,
  FlowStateCreator,
  FlowStateRevision,
  flowStatePath,
} from "./flow-state-atomic-writer.js";
import { FlowState } from "./flow-state.js";
import {
  TASK_ORIGINS,
  TASK_STATUSES,
  TASK_STEP_STATUSES,
  TASK_REQUIREMENT_STATUSES,
  completeTaskInState,
} from "./flow-helpers.js";
import {
  bindFlowStateLocation,
  DEFAULT_FLOW_SPEC_DIR,
  FlowSpecLocation,
  FlowSpecRoot,
} from "./flow-workspace.js";
import { findStepById, promoteNextPendingLeaf, flattenSteps } from "../flow/lib/step-tree.js";
import { DRAFT_REVIEW_ROUTES } from "../flow/lib/draft-review-routes.js";
import { applyPlanRewind, latestPlanRewind } from "../flow/lib/plan-rewind.js";
import {
  DefinitionLifecycleTransition,
  ExplicitRecoveryTransition,
  NormalStepTransition,
  StepTransitionCommitIntent,
  StepTransitionError,
  isStepTransition,
} from "../flow/lib/step-transition-policy.js";

const MAX_FLOW_STEPS_FOR_MIGRATION = 200;
const MAX_FLOW_ARTIFACTS_FOR_MIGRATION = 500;
const MAX_FLOW_STATE_READ_BYTES = 5 * 1024 * 1024;
const REMOVED_DIRECT_STATE_FIELDS = Object.freeze([
  "directFlowSession",
  "directResolutionPlan",
  "directIntegrationReceipt",
  "directCompletionReceipt",
  "directAbortReceipt",
  "directAbortHistory",
  "directReconcileEvidence",
]);
const FLOW_STATE_REVISIONS = new WeakMap();
const DRAFT_REVIEW_ARTIFACT_REWRITES = new Map(
  DRAFT_REVIEW_ROUTES.flatMap((route) => [
    [`draft-review-${route.key}.md`, route.reviewArtifact],
    [`draft-review-${route.key}-repair.json`, route.repairArtifact],
  ]),
);

function specFlowPath(root, specId, specRoot) {
  return flowStatePath(root, specId, specRoot);
}

export class FlowStateSchemaUnsupportedError extends Error {
  constructor(message) {
    super(message);
    this.name = "FlowStateSchemaUnsupportedError";
    this.code = "FLOW_STATE_SCHEMA_UNSUPPORTED";
  }
}

function schemaUnsupported(message) {
  return new FlowStateSchemaUnsupportedError(message);
}

function assertFlowStateSchema(state, sourcePath) {
  const displayPath = sourcePath ?? "<unknown>";
  if (!state || typeof state !== "object") {
    throw schemaUnsupported(`flow-store: invalid flow state (not an object): ${displayPath}`);
  }
  const removedFields = REMOVED_DIRECT_STATE_FIELDS.filter((field) => Object.hasOwn(state, field));
  if (removedFields.length > 0) {
    throw schemaUnsupported(
      `flow-store: removed direct recovery state rejected: ${displayPath}. `
      + `Fields: ${removedFields.join(", ")}.`,
    );
  }
  if (typeof state.runId !== "string" || state.runId.trim() === "") {
    throw schemaUnsupported(`flow-store: flow.json without a current runId rejected. Path: ${displayPath}.`);
  }
  if (!Array.isArray(state.tasks)) {
    throw schemaUnsupported(
      `flow-store: flow.json without 'tasks' array rejected. ` +
      `Path: ${displayPath}. ` +
      `Requires a 'tasks' array and a 'currentTaskId' field (string or null).`,
    );
  }
  if (!("currentTaskId" in state)) {
    throw schemaUnsupported(
      `flow-store: legacy flow.json without 'currentTaskId' field rejected. ` +
      `Path: ${displayPath}.`,
    );
  }
  if (state.metrics != null && !Array.isArray(state.metrics)) {
    throw schemaUnsupported(
      `flow-store: legacy flow.json with non-array 'metrics' rejected. ` +
      `Path: ${displayPath}. ` +
      `cac6/T10 requires 'metrics' to be an append-only entry array.`,
    );
  }
  if (state.notes != null) {
    if (!Array.isArray(state.notes)) {
      throw schemaUnsupported(
        `flow-store: legacy flow.json with non-array 'notes' rejected. ` +
        `Path: ${displayPath}.`,
      );
    }
    const firstNonObj = state.notes.find((n) => n != null && typeof n !== "object");
    if (firstNonObj !== undefined) {
      throw schemaUnsupported(
        `flow-store: legacy flow.json with string-array 'notes' rejected. ` +
        `Path: ${displayPath}. ` +
        `cac6/T10 requires note entries to be objects {taskId, text, ts}.`,
      );
    }
  }
  for (const task of state.tasks) {
    if (task && ("metrics" in task || "notes" in task)) {
      throw schemaUnsupported(
        `flow-store: legacy flow.json with per-task metrics/notes rejected. ` +
        `Task: ${task.id}. Path: ${displayPath}. ` +
        `cac6/T10 moved metrics/notes to flat top-level arrays with taskId.`,
      );
    }
  }
}

function assertCurrentFlowStateSchema(state, sourcePath) {
  assertFlowStateSchema(state, sourcePath);
  const migrationProbe = structuredClone(state);
  if (migrateFlowState(migrationProbe)) {
    throw schemaUnsupported(`flow-store: legacy flow step schema rejected. Path: ${sourcePath}.`);
  }
  try {
    new FlowState(state);
  } catch (cause) {
    throw schemaUnsupported(`flow-store: ${cause.message}. Path: ${sourcePath}.`);
  }
}

function parseStepIdMigrationState(content, sourcePath) {
  const state = JSON.parse(content.toString("utf8"));
  assertFlowStateSchema(state, sourcePath);
  return state;
}

function flowStepList(state) {
  const plan = Array.isArray(state?.steps)
    ? state.steps.find((s) => s?.id === "plan" && Array.isArray(s.children))
    : null;
  return plan ? plan.children : state?.steps;
}

function boundedFlowStepListForMigration(state) {
  const steps = flowStepList(state);
  if (Array.isArray(steps) && steps.length > MAX_FLOW_STEPS_FOR_MIGRATION) {
    throw new Error(`flow-store: refusing draft review migration with ${steps.length} steps (max ${MAX_FLOW_STEPS_FOR_MIGRATION})`);
  }
  return Array.isArray(steps) ? steps : [];
}

function shouldMarkInsertedDraftReviewLeafDone(consumerStatus) {
  return consumerStatus === "done" || consumerStatus === "in_progress";
}

function createMigratedDraftReviewStep(id, consumer) {
  const markDone = shouldMarkInsertedDraftReviewLeafDone(consumer.status);
  const step = { id, status: markDone ? "done" : "pending" };
  if (markDone) {
    const timestamp = consumer.finishedAt || consumer.startedAt;
    if (timestamp) step.finishedAt = timestamp;
  }
  return step;
}

function migrateDraftReviewSteps(state) {
  if (!Array.isArray(state?.steps)) return false;
  let changed = false;
  const steps = flowStepList(state);
  const legacyIndex = steps.findIndex((s) => s?.id === "review-draft");
  if (legacyIndex < 0) return false;

  const legacy = steps[legacyIndex];
  const base = {
    status: legacy.status || "pending",
    ...(legacy.startedAt && { startedAt: legacy.startedAt }),
    ...(legacy.finishedAt && { finishedAt: legacy.finishedAt }),
  };
  const questionStep = { id: "draft-questions-review", ...base };
  const coverageStep = { id: "draft-coverage-review", ...base };

  if (legacy.status === "in_progress") {
    coverageStep.status = "pending";
    delete coverageStep.startedAt;
    delete coverageStep.finishedAt;
  }

  steps.splice(legacyIndex, 1, questionStep, coverageStep);
  changed = true;
  return changed;
}

function migrateDraftRefineStep(state) {
  if (!Array.isArray(state?.steps)) return false;
  const steps = flowStepList(state);
  if (steps.some((s) => s?.id === "draft-refine")) return false;

  const questionIndex = steps.findIndex((s) => s?.id === "draft-questions-review");
  const coverageIndex = steps.findIndex((s) => s?.id === "draft-coverage-review");
  if (questionIndex < 0 || coverageIndex < 0) return false;

  const coverage = steps[coverageIndex];
  const status = coverage.status && coverage.status !== "pending"
    ? "done"
    : "pending";
  const refineStep = { id: "draft-refine", status };
  if (status === "done" && coverage.startedAt) {
    refineStep.finishedAt = coverage.startedAt;
  }

  steps.splice(coverageIndex, 0, refineStep);
  return true;
}

function migrateSpecReviewTriageAndRepairSteps(state) {
  if (!Array.isArray(state?.steps)) return false;
  const steps = flowStepList(state);

  const reviewIndex = steps.findIndex((s) => s?.id === "spec-review");
  let repairIndex = steps.findIndex((s) => s?.id === "spec-repair");
  let gateIndex = steps.findIndex((s) => s?.id === "spec-gate");
  if (reviewIndex < 0 || gateIndex < 0) return false;

  const review = steps[reviewIndex];
  const gate = steps[gateIndex];
  const repair = repairIndex >= 0 ? steps[repairIndex] : null;
  let changed = false;

  if (!steps.some((s) => s?.id === "spec-triage")) {
    const triageDone = (
      review.status === "skipped"
      || (repair?.status && repair.status !== "pending")
      || (gate.status && gate.status !== "pending")
    );
    const triageStep = { id: "spec-triage", status: triageDone ? "done" : "pending" };
    if (triageDone) {
      const finishedAt = repair?.startedAt || repair?.finishedAt || gate.startedAt || review.finishedAt;
      if (finishedAt) triageStep.finishedAt = finishedAt;
    }
    const insertIndex = repairIndex >= 0 ? repairIndex : gateIndex;
    steps.splice(insertIndex, 0, triageStep);
    changed = true;
    repairIndex = steps.findIndex((s) => s?.id === "spec-repair");
    gateIndex = steps.findIndex((s) => s?.id === "spec-gate");
  }

  if (!steps.some((s) => s?.id === "spec-repair")) {
    const repairDone = (gate.status && gate.status !== "pending");
    const repairStep = { id: "spec-repair", status: repairDone ? "done" : "pending" };
    if (repairDone) {
      const finishedAt = gate.startedAt || review.finishedAt;
      if (finishedAt) repairStep.finishedAt = finishedAt;
    }
    steps.splice(gateIndex, 0, repairStep);
    changed = true;
  }

  return changed;
}

function migrateDraftReviewTriageAndRepairSteps(state) {
  if (!Array.isArray(state?.steps)) return false;
  const steps = boundedFlowStepListForMigration(state);
  let changed = false;

  function insertBefore(consumerId, insertedStepIds) {
    const consumerIndex = steps.findIndex((s) => s?.id === consumerId);
    if (consumerIndex < 0) return;
    const consumer = steps[consumerIndex];
    let insertIndex = consumerIndex;
    for (const id of insertedStepIds) {
      if (steps.some((s) => s?.id === id)) continue;
      const step = createMigratedDraftReviewStep(id, consumer);
      steps.splice(insertIndex, 0, step);
      insertIndex++;
      changed = true;
    }
  }

  for (const route of DRAFT_REVIEW_ROUTES) {
    insertBefore(route.passNextStepId, [route.triageStepId, route.repairStepId]);
  }

  if (Array.isArray(state.artifacts)) {
    if (state.artifacts.length > MAX_FLOW_ARTIFACTS_FOR_MIGRATION) {
      throw new Error(`flow-store: refusing draft review migration with ${state.artifacts.length} artifacts (max ${MAX_FLOW_ARTIFACTS_FOR_MIGRATION})`);
    }
    let artifactChanged = false;
    const rewritten = state.artifacts.map((artifact) => {
      if (typeof artifact !== "string") return artifact;
      const filename = path.basename(artifact);
      const replacement = DRAFT_REVIEW_ARTIFACT_REWRITES.get(filename);
      if (replacement) {
        artifactChanged = true;
        return path.join(path.dirname(artifact), replacement).split(path.sep).join("/");
      }
      return artifact;
    });
    if (artifactChanged) {
      state.artifacts = rewritten;
      changed = true;
    }
  }

  return changed;
}

function readBoundedFlowStateContent(filePath) {
  const size = fs.statSync(filePath).size;
  if (size > MAX_FLOW_STATE_READ_BYTES) {
    throw new Error(
      `flow-store: refusing to read ${size} byte flow state ` +
      `(max ${MAX_FLOW_STATE_READ_BYTES})`,
    );
  }
  return fs.readFileSync(filePath);
}

function parseCurrentFlowState(content, sourcePath, repositoryRoot, specRoot, specId) {
  const state = JSON.parse(content.toString("utf8"));
  return bindCurrentFlowState(state, content, sourcePath, repositoryRoot, specRoot, specId);
}

function bindCurrentFlowState(state, content, sourcePath, repositoryRoot, specRoot, specId) {
  assertCurrentFlowStateSchema(state, sourcePath);
  const boundSpecId = FlowSpecId.from(specId).toString();
  if (state.specId !== boundSpecId) {
    throw schemaUnsupported(`flow-store: flow state specId does not match its bound directory. Path: ${sourcePath}.`);
  }
  const revision = new FlowStateRevision(content);
  try {
    new FlowState(state, { revision });
  } catch (cause) {
    throw schemaUnsupported(`flow-store: ${cause.message}. Path: ${sourcePath}.`);
  }
  FLOW_STATE_REVISIONS.set(state, revision);
  return bindFlowStateLocation(state, new FlowSpecLocation({
    repositoryRoot,
    specRoot,
    specId: boundSpecId,
  }));
}

function migrateFlowState(state) {
  const renamedStepIds = renameFlowStateStepIds(state);
  const renamedChanged = renamedStepIds.length > 0;
  const reviewChanged = migrateDraftReviewSteps(state);
  const refineChanged = migrateDraftRefineStep(state);
  const draftReviewTriageRepairChanged = migrateDraftReviewTriageAndRepairSteps(state);
  const specRepairChanged = migrateSpecReviewTriageAndRepairSteps(state);
  return renamedChanged
    || reviewChanged
    || refineChanged
    || draftReviewTriageRepairChanged
    || specRepairChanged;
}

/**
 * Resolve the taskId for an append-only log entry (metrics / notes / issue-log).
 * Rules: explicit `opts.taskId` always wins (null → flow scope, unknown id →
 * throw); when omitted, infer from `state.currentTaskId` (null if none).
 *
 * @returns {string|null} resolved taskId (null = flow scope)
 */
export function resolveTaskIdForEntry(state, opts) {
  const explicit = hasExplicitOption(opts, "taskId");
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
  const explicit = hasExplicitOption(opts, "taskId");
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
  constructor({ root, mainRoot, inWorktree, activeFlowsProvider, specRoot = DEFAULT_FLOW_SPEC_DIR }) {
    this._root = root;
    this._mainRoot = mainRoot;
    this._inWorktree = inWorktree;
    this._activeFlowsProvider = activeFlowsProvider;
    this._specRoot = FlowSpecRoot.from(specRoot);
  }

  pathFor(specId) {
    return specFlowPath(this._mainRoot, specId, this._specRoot);
  }

  /**
   * Load flow.json. Returns null if not found. Throws when the file exists but
   * predates the cac6/T2 schema (missing `tasks`/`currentTaskId`).
   * @param {string} [specId]
   * @returns {object|null}
   */
  load(specId) {
    const resolvedSpecId = this.#resolveSpecId(specId);
    if (!resolvedSpecId) return null;
    const resolvedPath = specFlowPath(this._mainRoot, resolvedSpecId, this._specRoot);
    if (!fs.existsSync(resolvedPath)) return null;
    return parseCurrentFlowState(
      readBoundedFlowStateContent(resolvedPath),
      resolvedPath,
      this._mainRoot,
      this._specRoot,
      resolvedSpecId,
    );
  }

  /**
   * Read-only loader. Enforces the current schema and never mutates storage.
   */
  loadReadOnly(specId) {
    const p = specFlowPath(this._mainRoot, specId, this._specRoot);
    if (!fs.existsSync(p)) return null;
    let content;
    let state;
    try {
      content = readBoundedFlowStateContent(p);
      state = JSON.parse(content.toString("utf8"));
    } catch (err) {
      process.stderr.write(`[sennel] flow-store.loadReadOnly: malformed flow.json at ${p}: ${err.message}\n`);
      return null;
    }
    return bindCurrentFlowState(state, content, p, this._mainRoot, this._specRoot, specId);
  }

  create(state, {
    faultInjector = () => {},
    maintenanceOwnerToken = null,
    operationOwnerToken = null,
    allowProcessOwnerBorrow = false,
    processIdentitySource,
  } = {}) {
    const nextState = structuredClone(state);
    if (!Array.isArray(nextState.tasks)) nextState.tasks = [];
    if (!("currentTaskId" in nextState)) nextState.currentTaskId = null;
    let specId;
    try {
      specId = FlowSpecId.from(nextState.specId).toString();
    } catch {
      throw schemaUnsupported("flow-store: new flow state requires a canonical specId");
    }
    const p = specFlowPath(this._mainRoot, specId, this._specRoot);
    assertCurrentFlowStateSchema(nextState, p);
    return new FlowStateCreator({
      root: this._mainRoot,
      mainRoot: this._mainRoot,
      specRoot: this._specRoot,
      boundSpecId: specId,
      state: nextState,
      faultInjector,
      maintenanceOwnerToken,
      operationOwnerToken,
      allowProcessOwnerBorrow,
      processIdentitySource,
    }).create();
  }

  /**
   * Durably replace one flow.json without exposing partial JSON. This is a
   * single-state primitive; callers remain responsible for command-level
   * eligibility and target guards.
   */
  saveAtomic(state, {
    boundSpecId,
    expectedOriginal,
    faultInjector = () => {},
    processIdentitySource,
    maintenanceOwnerToken,
    operationOwnerToken,
    allowProcessOwnerBorrow = false,
    allowIssueTransition = false,
    transitionId = null,
    writerOwnerToken = null,
    writerOwnerTempName = null,
  } = {}) {
    const writer = new AtomicFlowStateWriter({
      root: this._mainRoot,
      mainRoot: this._mainRoot,
      specRoot: this._specRoot,
      boundSpecId,
      expectedOriginal,
      nextState: state,
      expectedRevision: FLOW_STATE_REVISIONS.get(expectedOriginal),
      faultInjector,
      processIdentitySource,
      maintenanceOwnerToken,
      operationOwnerToken,
      allowProcessOwnerBorrow,
      allowIssueTransition,
      transitionId,
      writerOwnerToken,
      writerOwnerTempName,
    });
    assertCurrentFlowStateSchema(state, writer.pathAuthority.statePath);
    assertCurrentFlowStateSchema(expectedOriginal, writer.pathAuthority.statePath);
    return writer.save();
  }

  recoverCommittedAtomicWrite(boundSpecId, {
    processIdentitySource,
    maintenanceOwnerToken,
    operationOwnerToken,
    allowProcessOwnerBorrow = false,
    transitionId,
    writerOwnerToken,
    writerOwnerTempName,
  } = {}) {
    return new AtomicFlowStateWriter({
      root: this._mainRoot,
      mainRoot: this._mainRoot,
      specRoot: this._specRoot,
      boundSpecId,
      processIdentitySource,
      maintenanceOwnerToken,
      operationOwnerToken,
      allowProcessOwnerBorrow,
      transitionId,
      writerOwnerToken,
      writerOwnerTempName,
    }).recoverCommittedWrite();
  }

  assertWritable(specId, {
    processIdentitySource,
    maintenanceOwnerToken,
    operationOwnerToken,
  } = {}) {
    return new AtomicFlowStateWriter({
      root: this._mainRoot,
      mainRoot: this._mainRoot,
      specRoot: this._specRoot,
      boundSpecId: specId,
      processIdentitySource,
      maintenanceOwnerToken,
      operationOwnerToken,
      allowProcessOwnerBorrow: true,
    }).assertWritable();
  }

  mutate(mutator, opts = {}) {
    // Spec 251: merge-onward post hooks operate on the main repo's flow.json
    // before .active-flow has been registered there. They pass an explicit
    // specId via opts so we can load by path without going through the
    // active-flow registry.
    const specId = this.#resolveSpecId(opts.specId);
    if (!specId) throw new Error("no active flow (flow.json not found)");
    const expectedRevision = opts.expectedOriginal == null
      ? null
      : FLOW_STATE_REVISIONS.get(opts.expectedOriginal);
    if (opts.expectedOriginal != null && !expectedRevision) {
      throw new FlowStateAtomicSaveError(
        "FLOW_STATE_ATOMIC_STALE",
        "expected flow state revision is unavailable",
      );
    }
    const guardedMutator = (state, context) => {
      bindFlowStateLocation(state, new FlowSpecLocation({
        repositoryRoot: this._mainRoot,
        specRoot: this._specRoot,
        specId,
      }));
      if (expectedRevision && expectedRevision.digest !== context.revisionDigest) {
        throw new FlowStateAtomicSaveError(
          "FLOW_STATE_ATOMIC_STALE",
          "flow state changed after promotion planning",
        );
      }
      mutator(state, context);
    };
    const configuredPassThrough = opts.passThroughError
      ?? ((error) => error instanceof FlowStateSchemaUnsupportedError);
    return new AtomicFlowStateWriter({
      root: this._mainRoot,
      mainRoot: this._mainRoot,
      specRoot: this._specRoot,
      boundSpecId: specId,
      faultInjector: opts.faultInjector,
      processIdentitySource: opts.processIdentitySource,
      maintenanceOwnerToken: opts.maintenanceOwnerToken,
      operationOwnerToken: opts.operationOwnerToken,
      allowProcessOwnerBorrow: opts.allowProcessOwnerBorrow === true,
    }).mutate(guardedMutator, {
      parseState: opts.stepIdMigration === true
        ? parseStepIdMigrationState
        : (content, statePath) => parseCurrentFlowState(
          content,
          statePath,
          this._mainRoot,
          this._specRoot,
          specId,
        ),
      validateState: assertCurrentFlowStateSchema,
      onFailure: opts.onFailure,
      passThroughError: (error) => (
        error instanceof FlowStateAtomicSaveError || configuredPassThrough(error)
      ),
      allowIssueTransition: opts.allowIssueTransition === true,
    });
  }

  pathForCurrent() {
    const flows = this._activeFlowsProvider().load();
    const current = this._resolveCurrentFlow(flows);
    if (!current) return null;
    return specFlowPath(this._mainRoot, current.specId, this._specRoot);
  }

  resolveWorktreePaths(state) {
    if (!state.worktree) return { worktreePath: null, mainRepoPath: null };

    if (this._inWorktree) {
      return { worktreePath: this._root, mainRepoPath: this._mainRoot };
    }

    const dirName = state.featureBranch.replace(/\//g, "-");
    return {
      worktreePath: path.join(managedDir(this._root), "worktree", dirName),
      mainRepoPath: this._root,
    };
  }

  /**
   * Spec 253 R16/R17: persist squash baseline SHA and merge route discriminator
   * on the main repo flow.json after finalize-merge succeeds. Called from the
   * registry post hook with explicit specId.
   *
   * Invariants enforced here:
   *  - mergeStrategy ∈ {"squash", "pr", null}
   *  - featureBranchSquashedSha is a non-empty string OR null
   *  - if mergeStrategy !== "squash" then featureBranchSquashedSha must be null
   */
  setMergeOutcome({ mergeStrategy, featureBranchSquashedSha }, opts) {
    const allowedStrategies = new Set(["squash", "pr", null]);
    if (!allowedStrategies.has(mergeStrategy)) {
      throw new Error(`invalid mergeStrategy: ${mergeStrategy}`);
    }
    if (
      featureBranchSquashedSha !== null &&
      (typeof featureBranchSquashedSha !== "string" || featureBranchSquashedSha.length === 0)
    ) {
      throw new Error(
        `invalid featureBranchSquashedSha: must be non-empty string or null`,
      );
    }
    if (mergeStrategy !== "squash" && featureBranchSquashedSha !== null) {
      throw new Error(
        `featureBranchSquashedSha must be null when mergeStrategy is ${mergeStrategy}`,
      );
    }
    this.mutate((state) => {
      if (!state.state || typeof state.state !== "object") state.state = {};
      state.state.mergeStrategy = mergeStrategy;
      state.state.featureBranchSquashedSha = featureBranchSquashedSha;
    }, opts);
  }

  saveFinalizedAt(specId, iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(iso)) {
      throw new Error(`invalid finalizedAt: expected ISO 8601 UTC (e.g. 2026-04-17T10:00:00.000Z), got ${iso}`);
    }
    return this.mutate((state) => {
      if (!state.state || typeof state.state !== "object") state.state = {};
      state.state.finalizedAt = iso;
    }, { specId });
  }

  // ── targeted setters (scope-aware) ──────────────────────────────────────────

  updateStepStatus(transition, opts, commitIntent = null) {
    return this.updateStepStatuses([transition], opts, commitIntent);
  }

  completeStepTransitionIntent(commitIntent, opts) {
    if (!(commitIntent instanceof StepTransitionCommitIntent)) {
      throw new StepTransitionError(
        "completeStepTransitionIntent requires a StepTransitionCommitIntent",
      );
    }
    return this.mutate((state) => {
      commitIntent.completeIn(state);
    }, opts);
  }

  updateStepStatuses(transitions, opts, commitIntent = null) {
    if (!Array.isArray(transitions) || transitions.length === 0 || transitions.some((transition) => !isStepTransition(transition))) {
      throw new StepTransitionError("updateStepStatuses requires explicit step transitions");
    }
    if (commitIntent != null && !(commitIntent instanceof StepTransitionCommitIntent)) {
      throw new StepTransitionError("updateStepStatuses commit intent must be a StepTransitionCommitIntent");
    }
    // opts may carry { specId } so the mutate path loads the file directly
    // (spec 251: main-repo authority before .active-flow is registered).
    this.mutate((state) => {
      const scope = resolveMutationScope(state, opts);
      if (!Array.isArray(scope.steps)) {
        throw new Error("flow-store: scope has no steps array");
      }
      const isNested = scope.steps.some((s) => s.children);
      const changes = transitions.flatMap((transition) => (
        transition instanceof ExplicitRecoveryTransition
          ? transition.changes
          : [transition]
      ));
      for (const transition of transitions) {
        if (!(transition instanceof NormalStepTransition)) continue;
        const current = flattenSteps(scope.steps).filter((candidate) => candidate.status === "in_progress");
        if (current.length !== 1 || current[0].id !== transition.currentStepId) {
          throw new StepTransitionError(
            `normal transition requires exactly current step ${transition.currentStepId} (got ${current.map((step) => step.id).join(", ") || "none"})`,
          );
        }
      }
      if (transitions.some((transition) => (
        !(transition instanceof NormalStepTransition)
        && !(transition instanceof DefinitionLifecycleTransition)
        && !(transition instanceof ExplicitRecoveryTransition)
      ))) {
        throw new StepTransitionError("unsupported step transition type");
      }
      const now = new Date().toISOString();
      const resolved = changes.map((change) => {
        const step = isNested
          ? findStepById(scope.steps, change.stepId)
          : scope.steps.find((candidate) => candidate.id === change.stepId);
        if (!step) throw new StepTransitionError(`unknown transition step: ${change.stepId}`);
        if (step.status !== change.currentStatus) {
          throw new StepTransitionError(
            `stale transition source for ${change.stepId}: expected ${change.currentStatus}, got ${step.status}`,
          );
        }
        return { change, step };
      });
      commitIntent?.assertBeforeTransition(state);
      for (const { change, step } of resolved) {
        const status = change.requestedStatus;
        step.status = status;
        if (status === "pending") {
          delete step.startedAt;
          delete step.finishedAt;
        }
        if (status === "in_progress") {
          delete step.finishedAt;
          if (!step.startedAt) step.startedAt = now;
        }
        if (status === "done" || status === "skipped") {
          step.finishedAt = now;
        }
      }

      const sole = changes.length === 1 ? changes[0] : null;
      const explicitPromotionOwned = transitions.some((transition) => (
        transition instanceof DefinitionLifecycleTransition
        && transition.hasExplicitInProgressTarget
      ));
      if (
        !explicitPromotionOwned
        && sole
        && (sole.requestedStatus === "done" || sole.requestedStatus === "skipped")
      ) {
        if (isNested) {
          const next = promoteNextPendingLeaf(scope.steps);
          if (next) {
            next.status = "in_progress";
            next.startedAt = now;
          }
        } else {
          promoteFirstPending(scope.steps);
        }
      }
      commitIntent?.applyTo(state);
    }, opts);
  }

  setStepRuntimeLog(stepId, runtimeLog, opts) {
    this.mutate((state) => {
      const scope = resolveMutationScope(state, opts);
      if (!Array.isArray(scope.steps)) {
        throw new Error("flow-store: scope has no steps array");
      }
      const isNested = scope.steps.some((s) => s.children);
      const step = isNested
        ? findStepById(scope.steps, stepId)
        : scope.steps.find((s) => s.id === stepId);
      if (!step) throw new Error(`unknown step: ${stepId}`);
      step.runtimeLog = { ...runtimeLog };
    }, { ...opts, allowProcessOwnerBorrow: true });
  }

  setRequest(text, opts) { this.mutate((state) => { state.request = text; }, opts); }
  setIssue(issue, opts = {}) {
    this.mutate((state) => { state.issue = issue; }, { ...opts, allowIssueTransition: true });
  }

  rewindPlan(transition, opts) {
    if (!(transition instanceof ExplicitRecoveryTransition)) {
      throw new StepTransitionError("rewindPlan requires an explicit recovery transition");
    }
    let result;
    this.mutate((state) => {
      const draft = findStepById(state.steps || [], transition.stepId);
      if (draft?.status !== transition.currentStatus) {
        throw new StepTransitionError(
          `stale recovery source for ${transition.stepId}: expected ${transition.currentStatus}, got ${draft?.status ?? "missing"}`,
        );
      }
      if (transition.request) {
        const next = applyPlanRewind(state, transition.request, transition.evidence);
        transition.commitIntent?.assertBeforeTransition(next);
        transition.commitIntent?.applyTo(next);
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, next);
        result = latestPlanRewind(state);
        return;
      }
      const resolved = transition.changes.map((change) => {
        const step = findStepById(state.steps || [], change.stepId);
        if (!step) throw new StepTransitionError(`unknown recovery step: ${change.stepId}`);
        if (step.status !== change.currentStatus) {
          throw new StepTransitionError(
            `stale recovery source for ${change.stepId}: expected ${change.currentStatus}, got ${step.status}`,
          );
        }
        return { change, step };
      });
      const now = new Date().toISOString();
      for (const { change, step } of resolved) {
        step.status = change.requestedStatus;
        delete step.startedAt;
        delete step.finishedAt;
        if (transition.clearRuntimeLog) delete step.runtimeLog;
        if (change.requestedStatus === "in_progress") step.startedAt = now;
      }
      delete state.draftReviewRevisions;
      delete state.draftArtifactPromotion;
      transition.commitIntent?.assertBeforeTransition(state);
      transition.commitIntent?.applyTo(state);
      result = { resetSteps: transition.changes.map((change) => change.stepId) };
    }, opts);
    return result;
  }

  saveRecoveryAtomic(transition, opts = {}) {
    if (
      !(transition instanceof ExplicitRecoveryTransition)
      || transition.entrypoint !== "reopen-spec-correction"
    ) {
      throw new StepTransitionError("saveRecoveryAtomic requires a spec-correction recovery transition");
    }
    const originalDraft = findStepById(transition.expectedOriginal.steps || [], transition.stepId);
    const replacementDraft = findStepById(transition.replacementState.steps || [], transition.stepId);
    if (
      originalDraft?.status !== transition.currentStatus
      || replacementDraft?.status !== transition.requestedStatus
    ) {
      throw new StepTransitionError("spec-correction recovery candidate does not match its transition");
    }
    return this.saveAtomic(transition.replacementState, {
      ...opts,
      expectedOriginal: transition.expectedOriginal,
    });
  }

  /**
   * Append an entry to a flat top-level array on `state[arrayKey]` with
   * store-owned `taskId` / `ts` fields. Shared by `addNote` and `appendMetric`.
   *
   * @param {string} arrayKey — e.g. "notes" or "metrics"
   * @param {object} payload — entry body (taskId/ts are overwritten by store)
   * @param {import("./flow-options.js").FlowRouteOptions} [opts]
   *   taskId selects the entry scope; specId is forwarded to mutate() to pick
   *   the target flow.json.
   */
  _appendFlowEntry(arrayKey, payload, opts) {
    this.mutate((state) => {
      const taskId = resolveTaskIdForEntry(state, opts);
      if (!Array.isArray(state[arrayKey])) state[arrayKey] = [];
      state[arrayKey].push({ ...payload, taskId, ts: new Date().toISOString() });
    }, opts);
  }

  addNote(text, opts) {
    this._appendFlowEntry("notes", { text }, opts);
  }

  /**
   * Append a metric entry. Ambient calls (no explicit taskId and no active
   * flow) are skipped silently. An explicit taskId or specId selects a route
   * before that short-circuit; otherwise invariants match `_appendFlowEntry`.
   *
   * @param {object|null} payload — entry body without taskId/ts (null → skip)
   * @param {import("./flow-options.js").FlowRouteOptions} [opts]
   */
  appendMetric(payload, opts) {
    if (!payload) return;
    const hasSpecRoute = hasExplicitOption(opts, "specId") && opts.specId != null;
    if (!hasSpecRoute && !this.pathForCurrent()) return;
    this._appendFlowEntry("metrics", payload, opts);
  }

  incrementMetric(phase, counter, opts) {
    if (!phase) return;
    this.appendMetric({ phase, counter, delta: 1 }, opts);
  }

  /** @param {import("./flow-options.js").AgentMetricOptions} [options] */
  accumulateAgentMetrics(phase, options = {}) {
    if (!phase) return;
    const { usage, responseChars, model, durationMs, provider, profileKey } = options;
    let routeOptions;
    if (hasExplicitOption(options, "taskId") || hasExplicitOption(options, "specId")) {
      routeOptions = {};
      if (hasExplicitOption(options, "taskId")) routeOptions.taskId = options.taskId;
      if (hasExplicitOption(options, "specId")) routeOptions.specId = options.specId;
    }
    const payload = {
      phase,
      kind: "agent",
      provider: normalizeAgentMetricDimension(provider),
      profileKey: normalizeAgentMetricDimension(profileKey),
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
    this.appendMetric(payload, routeOptions);
  }

  // ── task primitives (cac6/T2) ───────────────────────────────────────────────

  addTask(task, opts) {
    validateTaskShape(task);
    this.mutate((state) => {
      if ((state.tasks || []).some((t) => t.id === task.id)) {
        throw new Error(`duplicate task id: ${task.id}`);
      }
      state.tasks.push(task);
      state.currentTaskId = task.id;
    }, opts);
  }

  completeTask(taskId, opts) {
    this.mutate((state) => {
      completeTaskInState(state, taskId);
      // NOTE: promoteNextPending is intentionally NOT called here.
      // Callers (impl-gate post-hook, CLI) must invoke it explicitly.
    }, opts);
  }

  setCurrentTaskStep(stepId, status, opts) {
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
    }, opts);
  }

  // ── internal ────────────────────────────────────────────────────────────────

  #resolveSpecId(specId) {
    if (specId) return specId;
    const current = this._resolveCurrentFlow(this._activeFlowsProvider().load());
    return current?.specId ?? null;
  }

  _resolveCurrentFlow(flows) {
    if (flows.length === 0) return null;
    if (flows.length === 1) return flows[0];

    const res = runGit(["-C", this._root, "rev-parse", "--abbrev-ref", "HEAD"]);
    if (!res.ok) return null;
    const currentBranch = res.stdout.trim();

    for (const entry of flows) {
      if (currentBranch === `feature/${entry.specId}`) return entry;
    }
    return null;
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
