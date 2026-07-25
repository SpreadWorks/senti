/**
 * src/lib/flow-manager.js
 *
 * Facade for Spec-Driven Development flow state management. Owns:
 *   - FlowStore             : specs/<NNN>/flow.json I/O + mutations
 *   - ActiveFlowRegistry    : .senti/.active-flow pointer
 *   - PreparingFlowStore    : .senti/.active-flow.<runId> transient state
 *
 * Constructed once per CLI process by `container.js` with paths already
 * resolved by Container — no `workRoot` argument is needed on any method.
 */

import fs from "fs";
import path from "path";
import { sentiDir } from "./config.js";
import { FlowStore } from "./flow-store.js";
import { withSpecIdArgDefault, withSpecIdDefault } from "./flow-options.js";
import { ActiveFlowRegistry } from "./active-flow-registry.js";
import { PreparingFlowStore } from "./preparing-flow-store.js";
import { PREPARING_SCAN_LIMIT, specIdFromPath } from "./flow-helpers.js";
import { FlowTargetExpectation } from "./flow-target-guard.js";
import { findInProgressLeaf } from "../flow/lib/step-tree.js";
import { WorktreeFlowBindingStore } from "./worktree-flow-binding.js";
import { RepositoryFlowOperationLock } from "./repository-maintenance-lock.js";

const ACTIVE_FLOW_MODES = new Set(["worktree", "branch", "local"]);

export class ResolvedFlowTarget {
  constructor({ state, specId = null, worktreePath = null, authorityRoot, preparing = false }) {
    if (!state || typeof state !== "object") throw new Error("resolved flow target state is required");
    if (!state.runId) throw new Error("resolved flow target runId is required");
    if (!authorityRoot) throw new Error("resolved flow target authority root is required");
    this.state = state;
    this.specId = state.spec ? specIdFromPath(state.spec) : specId;
    this.worktreePath = worktreePath;
    this.authorityRoot = authorityRoot;
    this.preparing = Boolean(preparing);
    if (this.preparing && this.specId != null) {
      throw new Error("preparing flow target must not have a spec");
    }
    if (!this.preparing && !this.specId) {
      throw new Error("active flow target spec is required");
    }
    Object.freeze(this);
  }

  matches(expectation) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty) return false;
    if (expectation.runId != null && this.state.runId !== expectation.runId) return false;
    const activeIssue = this.state.issue == null ? null : Number(this.state.issue);
    if (expectation.issue != null && activeIssue !== expectation.issue) return false;
    if (expectation.issueAbsent && activeIssue !== null) return false;
    if (expectation.spec != null && this.specId !== expectation.spec) return false;
    return true;
  }

}

export class ActiveFlowIdentityEntry {
  constructor({ entry, state } = {}) {
    if (!entry || typeof entry !== "object") throw new Error("active flow identity entry is required");
    if (typeof entry.spec !== "string" || entry.spec.trim() === "") {
      throw new Error("active flow identity spec is required");
    }
    if (!ACTIVE_FLOW_MODES.has(entry.mode)) throw new Error("active flow identity mode is invalid");
    if (!state || typeof state !== "object" || typeof state.runId !== "string" || state.runId.trim() === "") {
      throw new Error(`active flow identity state is unavailable for ${entry.spec}`);
    }
    if (specIdFromPath(state.spec) !== entry.spec) {
      throw new Error(`active flow identity spec mismatch for ${entry.spec}`);
    }
    const issue = state.issue == null ? null : Number(state.issue);
    if (issue != null && (!Number.isSafeInteger(issue) || issue < 1)) {
      throw new Error(`active flow identity issue is invalid for ${entry.spec}`);
    }
    this.runId = state.runId;
    this.issue = issue;
    this.spec = entry.spec;
    this.mode = entry.mode;
    Object.freeze(this);
  }

  get key() {
    return `${this.runId}\u0000${this.issue ?? "none"}\u0000${this.spec}\u0000${this.mode}`;
  }

  toJSON() {
    return {
      runId: this.runId,
      issue: this.issue,
      spec: this.spec,
      mode: this.mode,
    };
  }
}

export class ActiveFlowIdentitySnapshot {
  constructor({ entries, revision } = {}) {
    if (!Array.isArray(entries)) throw new Error("active flow identity snapshot entries are required");
    if (revision != null && typeof revision !== "string") {
      throw new Error("active flow identity snapshot revision is invalid");
    }
    this.entries = Object.freeze(entries.map((entry) => (
      entry instanceof ActiveFlowIdentityEntry ? entry : new ActiveFlowIdentityEntry(entry)
    )));
    this.revision = revision;
    Object.freeze(this);
  }

  toJSON() {
    return {
      entries: this.entries.map((entry) => entry.toJSON()),
      revision: this.revision,
    };
  }
}

export class FlowTargetNotFoundError extends Error {
  constructor(expectation, matchCount = 0) {
    super(`explicit flow target not found: ${flowTargetSummary(expectation)}`);
    this.code = "FLOW_TARGET_NOT_FOUND";
    this.data = flowTargetErrorData(expectation, matchCount);
  }
}

export class FlowTargetAmbiguousError extends Error {
  constructor(expectation, matchCount) {
    super(`explicit flow target is ambiguous: ${flowTargetSummary(expectation)}`);
    this.code = "FLOW_TARGET_AMBIGUOUS";
    this.data = flowTargetErrorData(expectation, matchCount);
  }
}

export class ParkedFlowError extends Error {
  constructor(code, message, { cause, data } = {}) {
    super(message, { cause });
    this.name = "ParkedFlowError";
    this.code = code;
    this.data = data;
  }
}

export class ParkedFlowIdentity {
  constructor(input = {}) {
    const expectation = input instanceof FlowTargetExpectation
      ? input
      : new FlowTargetExpectation(input);
    if (
      expectation.runId == null
      || expectation.spec == null
      || (expectation.issue == null && expectation.issueAbsent !== true)
    ) {
      throw new ParkedFlowError(
        "FLOW_PARK_TARGET_REQUIRED",
        "parked flow operations require exact --expect-run-id, --expect-spec, and Issue identity guards",
      );
    }
    this.runId = expectation.runId;
    this.specId = expectation.spec;
    this.issue = expectation.issue;
    this.issueAbsent = expectation.issueAbsent;
    this.expectation = expectation;
    Object.freeze(this);
  }

  assertMatches(state, label = "flow authority") {
    const mismatch = this.expectation.mismatchAgainst(state);
    if (mismatch) {
      throw new ParkedFlowError(
        "FLOW_PARK_IDENTITY_MISMATCH",
        `${label} does not match the exact parked flow identity`,
        { data: mismatch },
      );
    }
    return state;
  }

  guardArgv() {
    return [
      "--expect-run-id", this.runId,
      "--expect-spec", `specs/${this.specId}/spec.json`,
      ...(this.issueAbsent
        ? ["--expect-no-issue"]
        : ["--expect-issue", String(this.issue)]),
    ];
  }

  toJSON() {
    return {
      runId: this.runId,
      spec: `specs/${this.specId}/spec.json`,
      issue: this.issue,
    };
  }
}

export class ParkedFlowAuthorityReceipt {
  constructor({ action, identity, executionRoot, changed }) {
    if (!new Set(["park", "resume"]).has(action)) {
      throw new Error(`invalid parked flow authority action: ${action}`);
    }
    if (!(identity instanceof ParkedFlowIdentity)) {
      throw new Error("parked flow authority receipt requires an exact identity");
    }
    if (typeof executionRoot !== "string" || !path.isAbsolute(executionRoot)) {
      throw new Error("parked flow authority receipt requires an absolute execution root");
    }
    const canonicalRoot = fs.realpathSync(executionRoot);
    if (canonicalRoot !== path.resolve(executionRoot)) {
      throw new Error("parked flow authority receipt execution root must be canonical");
    }
    if (typeof changed !== "boolean") {
      throw new Error("parked flow authority receipt changed must be boolean");
    }
    this.action = action;
    this.identity = identity;
    this.executionRoot = canonicalRoot;
    this.mode = "worktree";
    this.changed = changed;
    Object.freeze(this);
  }

  toJSON() {
    const result = {
      [this.action === "park" ? "parked" : "resumed"]: true,
      changed: this.changed,
      identity: this.identity.toJSON(),
      mode: this.mode,
      executionRoot: this.executionRoot,
    };
    if (this.action === "park") {
      result.resume = {
        executionRoot: this.executionRoot,
        argv: ["flow", "resume", "--parked", ...this.identity.guardArgv()],
      };
    }
    return result;
  }
}

function flowTargetSummary(expectation) {
  return [
    expectation.runId && `runId ${expectation.runId}`,
    expectation.issue && `Issue #${expectation.issue}`,
    expectation.issueAbsent && "no Issue",
    expectation.spec && `spec ${expectation.spec}`,
  ].filter(Boolean).join(", ");
}

function flowTargetErrorData(expectation, matchCount) {
  return {
    matchCount,
    ...(expectation.runId != null && { expectedRunId: expectation.runId }),
    ...((expectation.issue != null || expectation.issueAbsent) && {
      expectedIssue: expectation.issue,
    }),
    ...(expectation.spec != null && { expectedSpec: expectation.spec }),
  };
}

function resolveUniqueFlowTarget(expectation, targets) {
  if (targets.length === 0) throw new FlowTargetNotFoundError(expectation);
  if (targets.length > 1) throw new FlowTargetAmbiguousError(expectation, targets.length);
  return targets[0];
}

function activeFlowExpectation(opts) {
  const expectation = new FlowTargetExpectation({
    ...(opts.selectRunId != null && { expectRunId: opts.selectRunId }),
    ...(opts.selectSpecId != null && { expectSpec: opts.selectSpecId }),
    ...(opts.selectIssue != null && { expectIssue: opts.selectIssue }),
    ...(opts.selectNoIssue === true && { expectNoIssue: true }),
  });
  return expectation.empty ? null : expectation;
}

class ActiveFlowMismatchError extends Error {
  constructor(expectation, state) {
    const data = expectation.mismatchAgainst(state);
    super("managed worktree flow identity does not match the specified target");
    this.code = "ACTIVE_FLOW_MISMATCH";
    this.data = data;
  }
}

class CapturedFlowTargetMutation {
  constructor(expectation, mutate) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty || expectation.spec == null) {
      throw new Error("captured flow target mutation requires an exact target with a spec");
    }
    if (typeof mutate !== "function") {
      throw new Error("captured flow target mutation requires a mutation function");
    }
    this.expectation = expectation;
    this._mutate = mutate;
    Object.freeze(this);
  }

  mutate(mutator, opts) {
    if (typeof mutator !== "function") throw new Error("captured flow target mutator is required");
    return this._mutate(mutator, opts);
  }
}

function isManagedFlowWorktree(root, mainRoot, inWorktree) {
  if (!inWorktree || !root || !mainRoot) return false;
  const resolvedRoot = path.resolve(root);
  const resolvedMainRoot = path.resolve(mainRoot);
  const canonicalRoot = fs.realpathSync(resolvedRoot);
  const canonicalMainRoot = fs.realpathSync(resolvedMainRoot);
  if (canonicalRoot !== resolvedRoot || canonicalMainRoot !== resolvedMainRoot) {
    throw new Error("managed worktree roots must use canonical real paths");
  }
  const managedRootPath = path.resolve(sentiDir(canonicalMainRoot), "worktree");
  let managedRoot;
  try {
    managedRoot = fs.realpathSync(managedRootPath);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  if (managedRoot !== managedRootPath) {
    throw new Error("managed worktree boundary must use a canonical real path");
  }
  const relative = path.relative(managedRoot, canonicalRoot);
  return relative !== ""
    && relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

export class FlowManager {
  /**
   * @param {Object} opts
   * @param {string}  opts.root        - work root (worktree path when in one)
   * @param {string}  opts.mainRoot    - main repo root
   * @param {boolean} opts.inWorktree
   * @param {string|null} [opts.specId]
   */
  constructor({
    root,
    mainRoot,
    inWorktree,
    specId = null,
    bindingFaultInjector = () => {},
    processIdentitySource,
  }) {
    this._root = root;
    this._mainRoot = mainRoot;
    this._inWorktree = inWorktree;
    this._boundSpecId = specId;
    this._bindingFaultInjector = bindingFaultInjector;
    this._processIdentitySource = processIdentitySource;
    this._usesWorktreeFlowBinding = isManagedFlowWorktree(root, mainRoot, inWorktree);
    this._activeFlows = new ActiveFlowRegistry({ mainRoot });
    this._preparing = new PreparingFlowStore({ mainRoot });
    this._store = new FlowStore({
      root,
      mainRoot,
      inWorktree,
      activeFlowsProvider: () => this._activeFlows,
    });
    this._worktreeBinding = this._usesWorktreeFlowBinding
      ? new WorktreeFlowBindingStore({
          worktreePath: root,
          faultInjector: bindingFaultInjector,
          ...(processIdentitySource && { processIdentitySource }),
        })
      : null;
  }

  // ── flow.json (FlowStore) ───────────────────────────────────────────────────

  load(specId) {
    const state = this._worktreeBinding
      ? this.#loadBoundWorktreeState(specId, false)
      : this._store.load(withSpecIdArgDefault(specId, this._boundSpecId));
    return this.#bindLoadedState(state);
  }
  loadReadOnly(specId) {
    const state = this._worktreeBinding
      ? this.#loadBoundWorktreeState(specId, true)
      : this._store.loadReadOnly(withSpecIdArgDefault(specId, this._boundSpecId));
    return this.#bindLoadedState(state);
  }
  create(state, options) {
    const created = this._store.create(state, options);
    // A non-worktree manager that creates a flow owns that exact target for
    // the rest of its creation session. This keeps subsequent CAS operations
    // target-bound without publishing the flow in the shared active registry.
    // Managed worktrees continue to derive authority from their binding file.
    if (!this._worktreeBinding && this._boundSpecId == null) {
      this._boundSpecId = specIdFromPath(state.spec);
    }
    return created;
  }
  saveAtomic(state, options = {}) {
    return this._store.saveAtomic(state, { ...options, boundSpecId: this._boundSpecId });
  }

  #bindLoadedState(state) {
    if (state != null && this._boundSpecId == null) {
      this._boundSpecId = specIdFromPath(state.spec);
    }
    return state;
  }
  mutate(mutator, opts) { return this._store.mutate(mutator, withSpecIdDefault(opts, this._boundSpecId)); }
  captureExactTarget(expectation) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty || expectation.spec == null) {
      throw new Error("exact flow target with a spec is required for capture");
    }
    this.resolveExplicitFlowTargetForRead(expectation);
    return new CapturedFlowTargetMutation(
      expectation,
      (mutator, opts) => this.#mutateCapturedTarget(expectation, mutator, opts),
    );
  }
  mutateExactTarget(expectation, mutator, opts) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty) {
      throw new Error("exact flow target expectation is required for mutation");
    }
    this.resolveExplicitFlowTargetForRead(expectation);
    return this.#mutateCapturedTarget(expectation, mutator, opts);
  }
  #mutateCapturedTarget(expectation, mutator, opts) {
    return this._store.mutate((current) => {
      if (expectation.mismatchAgainst(current)) throw new ActiveFlowMismatchError(expectation, current);
      return mutator(current);
    }, { ...opts, specId: expectation.spec });
  }
  pathFor(specId) { return this._store.pathFor(withSpecIdArgDefault(specId, this._boundSpecId)); }
  pathForCurrent() { return this._store.pathForCurrent(); }
  /** Alias preserved for parity with the legacy `flowStatePath` public export. */
  flowStatePath() { return this._store.pathForCurrent(); }
  resolveWorktreePaths(state) { return this._store.resolveWorktreePaths(state); }
  saveFinalizedAt(specId, iso) { return this._store.saveFinalizedAt(specId, iso); }

  /**
   * Construct a FlowManager scoped to a different root (e.g. a freshly-created
   * worktree). The new instance owns its own paths — callers should not pass
   * paths to its methods. A specId option binds a default target for methods
   * that load, mutate, or locate flow.json; per-call opts.specId still wins.
   * @param {string} root
   * @param {{specId?: string|null}} [opts]
   */
  forRoot(root, opts = {}) {
    return new FlowManager({
      root,
      mainRoot: this._mainRoot,
      inWorktree: root !== this._mainRoot,
      specId: opts.specId,
      bindingFaultInjector: opts.bindingFaultInjector ?? this._bindingFaultInjector,
      ...(this._processIdentitySource && { processIdentitySource: this._processIdentitySource }),
    });
  }

  resolveWorktreeBinding(expectation = null) {
    if (!this._worktreeBinding) {
      throw new Error("worktree flow binding is available only inside a worktree");
    }
    if (expectation instanceof FlowTargetExpectation && !expectation.empty) {
      return this.#resolveGuardedWorktreeBinding(expectation);
    }
    this.#recoverBoundIssueTransition();
    return this._worktreeBinding.load();
  }

  usesWorktreeFlowBinding() {
    return this._usesWorktreeFlowBinding;
  }

  updateStepStatus(transition, opts, commitIntent = null) {
    return this._store.updateStepStatus(transition, withSpecIdDefault(opts, this._boundSpecId), commitIntent);
  }
  completeStepTransitionIntent(commitIntent, opts) {
    return this._store.completeStepTransitionIntent(
      commitIntent,
      withSpecIdDefault(opts, this._boundSpecId),
    );
  }
  updateStepStatuses(transitions, opts, commitIntent = null) {
    return this._store.updateStepStatuses(transitions, withSpecIdDefault(opts, this._boundSpecId), commitIntent);
  }
  setStepRuntimeLog(stepId, runtimeLog, opts) {
    return this._store.setStepRuntimeLog(stepId, runtimeLog, withSpecIdDefault(opts, this._boundSpecId));
  }
  setMergeOutcome(outcome, opts) {
    return this._store.setMergeOutcome(outcome, withSpecIdDefault(opts, this._boundSpecId));
  }
  setRequest(text, opts) { return this._store.setRequest(text, withSpecIdDefault(opts, this._boundSpecId)); }
  setIssue(issue, opts) {
    if (!this._worktreeBinding) {
      return this._store.setIssue(issue, withSpecIdDefault(opts, this._boundSpecId));
    }
    return this.#setBoundWorktreeIssue(issue, withSpecIdDefault(opts, this._boundSpecId));
  }
  rewindPlan(transition, opts) {
    return this._store.rewindPlan(transition, withSpecIdDefault(opts, this._boundSpecId));
  }
  saveRecoveryAtomic(transition, opts) {
    return this._store.saveRecoveryAtomic(transition, {
      ...opts,
      boundSpecId: this._boundSpecId,
    });
  }
  addNote(text, opts) { return this._store.addNote(text, withSpecIdDefault(opts, this._boundSpecId)); }
  incrementMetric(phase, counter, opts) {
    return this._store.incrementMetric(phase, counter, withSpecIdDefault(opts, this._boundSpecId));
  }
  appendMetric(payload, opts) { return this._store.appendMetric(payload, withSpecIdDefault(opts, this._boundSpecId)); }
  /** @param {import("./flow-options.js").AgentMetricOptions} [options] */
  accumulateAgentMetrics(phase, options) {
    return this._store.accumulateAgentMetrics(phase, withSpecIdDefault(options, this._boundSpecId));
  }

  // ── task primitives (cac6/T2) ───────────────────────────────────────────────

  /** Add a new task and set it as the current task. */
  addTask(task, opts) { return this._store.addTask(task, withSpecIdDefault(opts, this._boundSpecId)); }

  /** Mark a task done; clears currentTaskId if it pointed at this task. */
  completeTask(taskId, opts) {
    return this._store.completeTask(taskId, withSpecIdDefault(opts, this._boundSpecId));
  }

  /** Get the current task object or null. */
  getCurrentTask() {
    const state = this.load();
    if (!state || state.currentTaskId == null) return null;
    return (state.tasks || []).find((t) => t.id === state.currentTaskId) ?? null;
  }

  /** Get the in_progress step of the current task, or null. */
  getCurrentTaskStep() {
    const task = this.getCurrentTask();
    if (!task) return null;
    return (task.steps || []).find((s) => s.status === "in_progress") ?? null;
  }

  /** Update a step status on the current task. */
  setCurrentTaskStep(stepId, status, opts) {
    return this._store.setCurrentTaskStep(stepId, status, withSpecIdDefault(opts, this._boundSpecId));
  }

  /**
   * Resolve the current flow context for logging / metric accumulation.
   * Returns { spec, sentiPhase } derived from the active flow.json; both are
   * null when no active flow is present (expected outside Spec-Driven Development contexts).
   */
  resolveCurrentContext() {
    const state = this.load();
    if (!state) return { spec: null, sentiPhase: null, taskId: null };
    const spec = specIdFromPath(state.spec) ?? null;
    const inProgress = findInProgressLeaf(state.steps);
    const sentiPhase = inProgress?.id ?? null;
    const taskId = state.currentTaskId ?? null;
    return { spec, sentiPhase, taskId };
  }

  // ── .active-flow (ActiveFlowRegistry) ───────────────────────────────────────

  loadActiveFlows() { return this._activeFlows.load(); }
  snapshotActiveFlows(options) { return this._activeFlows.snapshot(options); }
  snapshotActiveFlowIdentities(options) {
    const registrySnapshot = this.snapshotActiveFlows(options);
    const entries = registrySnapshot.entries.map((entry) => {
      const resolved = this._loadActiveFlowState(entry.spec, entry.mode);
      if (!resolved?.state) {
        throw new Error(`active flow identity state is unavailable for ${entry.spec}`);
      }
      return new ActiveFlowIdentityEntry({ entry, state: resolved.state });
    });
    return new ActiveFlowIdentitySnapshot({ entries, revision: registrySnapshot.revision });
  }
  addActiveFlow(specId, mode, options) { return this._activeFlows.add(specId, mode, options); }
  removeActiveFlow(specId, options) { return this._activeFlows.remove(specId, options); }
  cleanStaleFlows(options) { return this._activeFlows.cleanStale(options); }

  parkActiveFlow(identity, options = {}) {
    if (!(identity instanceof ParkedFlowIdentity)) {
      throw new ParkedFlowError(
        "FLOW_PARK_TARGET_REQUIRED",
        "park requires an exact parked flow identity",
      );
    }
    return this.#withParkedFlowOperation(options, (operationOwnerToken) => {
      const resolved = this.#resolveParkedWorktreeOwned(identity);
      const entry = this._activeFlows.load().find((candidate) => candidate.spec === identity.specId);
      if (!entry) {
        throw new ParkedFlowError(
          "FLOW_PARK_TARGET_ABSENT",
          `active flow pointer is absent for ${identity.specId}`,
        );
      }
      if (entry.mode !== "worktree") {
        throw new ParkedFlowError(
          "FLOW_PARK_MODE_UNSUPPORTED",
          `flow park supports managed worktree mode only, got ${entry.mode}`,
        );
      }
      this._activeFlows.park(identity.specId, {
        ...options,
        operationOwnerToken,
      });
      return new ParkedFlowAuthorityReceipt({
        action: "park",
        identity,
        executionRoot: resolved.binding.worktreePath,
        changed: true,
      });
    });
  }

  resumeParkedFlow(identity, options = {}) {
    if (!(identity instanceof ParkedFlowIdentity)) {
      throw new ParkedFlowError(
        "FLOW_PARK_TARGET_REQUIRED",
        "parked resume requires an exact parked flow identity",
      );
    }
    return this.#withParkedFlowOperation(options, (operationOwnerToken) => {
      const resolved = this.#resolveParkedWorktreeOwned(identity);
      const entry = this._activeFlows.load().find((candidate) => candidate.spec === identity.specId);
      if (entry && entry.mode !== "worktree") {
        throw new ParkedFlowError(
          "FLOW_PARK_ACTIVE_CONFLICT",
          `active flow pointer for ${identity.specId} has foreign mode ${entry.mode}`,
        );
      }
      const changed = entry == null;
      if (changed) {
        this._activeFlows.add(identity.specId, "worktree", {
          ...options,
          operationOwnerToken,
        });
      }
      return new ParkedFlowAuthorityReceipt({
        action: "resume",
        identity,
        executionRoot: resolved.binding.worktreePath,
        changed,
      });
    });
  }

  /**
   * Clear the active-flow entry for a spec. If specId is omitted,
   * resolves it from the current context.
   */
  clearFlowState(specId, options) {
    if (!specId) {
      const flows = this._activeFlows.load();
      const current = this._store._resolveCurrentFlow(flows);
      if (!current) return;
      specId = current.spec;
    }
    this._activeFlows.remove(specId, options);
  }

  #resolveParkedWorktreeOwned(identity) {
    if (!this._worktreeBinding) {
      throw new ParkedFlowError(
        "FLOW_PARK_MODE_UNSUPPORTED",
        "parked flow operations must run from the target managed worktree",
      );
    }
    try {
      return this._worktreeBinding.withLock(() => {
        const binding = this._worktreeBinding.loadOwned().identity;
        identity.assertMatches(binding.toJSON(), "managed worktree binding");
        if (this._worktreeBinding.loadIssueTransitionOwned()) {
          throw new ParkedFlowError(
            "FLOW_PARK_IDENTITY_UNSETTLED",
            "parked flow operations require a settled worktree identity",
          );
        }
        const state = this._store.loadReadOnly(binding.specId);
        binding.assertFlowState(state);
        identity.assertMatches(state, "flow state");
        if (state.state?.finalizedAt) {
          throw new ParkedFlowError(
            "FLOW_PARK_FINALIZED",
            "a finalized flow cannot be parked or resumed",
          );
        }
        return { binding, state };
      });
    } catch (error) {
      if (error instanceof ParkedFlowError) throw error;
      throw new ParkedFlowError(
        error.code || "FLOW_PARK_WORKTREE_INVALID",
        `managed worktree authority validation failed: ${error.message}`,
        { cause: error },
      );
    }
  }

  #withParkedFlowOperation(options, body) {
    const operationLock = new RepositoryFlowOperationLock({
      mainRoot: this._mainRoot,
      maintenanceOwnerToken: options.maintenanceOwnerToken,
      operationOwnerToken: options.operationOwnerToken,
      ...(this._processIdentitySource && { processIdentitySource: this._processIdentitySource }),
    });
    const operationOwnerToken = operationLock.acquire();
    let result;
    let primary = null;
    try {
      result = body(operationOwnerToken);
    } catch (error) {
      primary = error;
    }
    let releaseError = null;
    try {
      operationLock.release();
    } catch (error) {
      releaseError = error;
    }
    if (primary && releaseError) {
      throw new AggregateError(
        [primary, releaseError],
        "parked flow authority transaction and repository lock release both failed",
        { cause: primary },
      );
    }
    if (primary) throw primary;
    if (releaseError) throw releaseError;
    return result;
  }

  // ── preparing flow (PreparingFlowStore) ─────────────────────────────────────

  generateRunId() { return this._preparing.generateRunId(); }
  createPreparingFlow(runId, extra) { return this._preparing.create(runId, extra); }
  loadPreparingFlow(runId) { return this._preparing.load(runId); }
  mutatePreparingFlow(runId, mutator) { return this._preparing.mutate(runId, mutator); }
  resolvePreparingInputs(runId, cliIssue, cliRequest) {
    return this._preparing.resolveInputs(runId, cliIssue, cliRequest);
  }
  deletePreparingFlow(runId) { return this._preparing.delete(runId); }
  listPreparingFlows() { return this._preparing.list(); }

  resolveExplicitFlowTarget(expectation) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty) {
      throw new Error("explicit flow target expectation is required");
    }
    const targets = this.#explicitFlowTargets().filter((target) => target.matches(expectation));
    return resolveUniqueFlowTarget(expectation, targets);
  }

  resolveExplicitFlowTargetForRead(expectation) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty) {
      throw new Error("explicit flow target expectation is required");
    }
    const targets = this.#explicitFlowTargets().filter((target) => target.matches(expectation));
    return resolveUniqueFlowTarget(expectation, targets);
  }

  #explicitFlowTargets() {
    const candidates = [];
    for (const entry of this._activeFlows.load()) {
      const resolved = this._loadActiveFlowState(entry.spec);
      if (!resolved?.state) continue;
      const target = new ResolvedFlowTarget({
        state: resolved.state,
        specId: resolved.specId,
        worktreePath: resolved.worktreePath,
        authorityRoot: resolved.worktreePath || this._mainRoot,
      });
      candidates.push(target);
    }
    for (const runId of this._preparing.list()) {
      const state = this._preparing.load(runId);
      if (!state) continue;
      const target = new ResolvedFlowTarget({
        state,
        authorityRoot: this._mainRoot,
        preparing: true,
      });
      candidates.push(target);
    }
    return candidates;
  }

  /**
   * Resolve a registered active flow for normal flow execution and resume.
   *
   * @param {object|null} flowState - pre-loaded flow state (may be null)
   * @param {object} [opts]
   * @param {string} [opts.selectSpecId] - explicit spec to disambiguate when
   *   multiple flows are active concurrently
   * @param {string} [opts.selectRunId] - explicit runId to disambiguate when
   *   multiple flows are active concurrently
   * @param {string|number} [opts.selectIssue] - explicit Issue number to
   *   disambiguate when multiple flows are active concurrently
   * @param {boolean} [opts.selectNoIssue] - select the unique active flow
   *   whose Issue identity is absent
   * @returns {{ state: object, specId: string, worktreePath: string|null } | null}
   */
  resolveActiveFlow(flowState, opts = {}) {
    const expectation = activeFlowExpectation(opts);
    if (flowState) {
      if (expectation?.mismatchAgainst(flowState)) {
        throw new ActiveFlowMismatchError(expectation, flowState);
      }
      const specId = specIdFromPath(flowState.spec);
      let worktreePath = null;
      if (flowState.worktree) {
        const candidate = this._store.resolveWorktreePaths(flowState).worktreePath;
        if (candidate && fs.existsSync(candidate)) worktreePath = candidate;
      }
      return { state: flowState, specId, worktreePath };
    }

    const activeFlows = this._activeFlows.load();
    if (expectation) {
      const targets = this._resolveActiveFlowsByState(activeFlows, () => true).map((resolved) => (
        new ResolvedFlowTarget({
          state: resolved.state,
          specId: resolved.specId,
          worktreePath: resolved.worktreePath,
          authorityRoot: resolved.worktreePath || this._mainRoot,
        })
      )).filter((target) => target.matches(expectation));
      const target = resolveUniqueFlowTarget(expectation, targets);
      return {
        state: target.state,
        specId: target.specId,
        worktreePath: target.worktreePath,
      };
    }

    if (activeFlows.length === 1) {
      const resolved = this._loadActiveFlowState(activeFlows[0].spec);
      if (resolved) return resolved;
    } else if (activeFlows.length > 1) {
      throw new Error(
        `multiple active flows: ${activeFlows.map((f) => `${f.spec} (${f.mode})`).join(", ")}. Pass --spec <specId> to select one.`,
      );
    }

    return null;
  }

  _resolveActiveFlowByState(activeFlows, predicate) {
    return this._resolveActiveFlowsByState(activeFlows, predicate)[0] ?? null;
  }

  _resolveActiveFlowsByState(activeFlows, predicate) {
    const matches = [];
    for (const entry of activeFlows) {
      const resolved = this._loadActiveFlowState(entry.spec);
      if (resolved?.state && predicate(resolved.state)) matches.push(resolved);
    }
    return matches;
  }

  /**
   * Load an active flow's state, redirecting to its worktree's specs/ dir
   * when the flow is registered as worktree mode. Returns null if the
   * spec's flow.json cannot be found in either location.
   *
   * @param {string} specId
   * @returns {{ state: object, specId: string, worktreePath: string|null } | null}
   */
  _loadActiveFlowState(specId, registeredMode = null) {
    let state = this._store.load(specId);
    let worktreePath = null;

    // worktree mode: the flow.json lives inside the worktree, not main repo.
    // First check the active-flows registry to know whether to look there.
    if (!state) {
      const mode = registeredMode ?? this._activeFlows.load().find((entry) => entry.spec === specId)?.mode;
      if (mode === "worktree") {
        const probe = path.join(sentiDir(this._mainRoot), "worktree", `feature-${specId}`);
        if (fs.existsSync(probe)) {
          const wtManager = this.forRoot(probe, { specId });
          state = wtManager.load(specId);
          if (state) worktreePath = probe;
        }
      }
    }

    if (state?.worktree && !worktreePath) {
      const resolved = this._store.resolveWorktreePaths(state);
      const candidate = resolved.worktreePath;
      if (candidate && fs.existsSync(candidate)) {
        worktreePath = candidate;
        const wtManager = this.forRoot(worktreePath, { specId });
        state = wtManager.load(specId);
      }
    }

    if (!state) return null;
    return { state, specId, worktreePath };
  }

  /**
   * Resolve flow state by runId.
   * @param {string} runId
   * @returns {object|null}
   */
  resolveByRunId(runId) {
    const activeFlows = this._activeFlows.load();
    const limit = Math.min(activeFlows.length, PREPARING_SCAN_LIMIT);
    for (let i = 0; i < limit; i++) {
      const resolved = this._loadActiveFlowState(activeFlows[i].spec);
      const state = resolved?.state || this._store.loadReadOnly(activeFlows[i].spec);
      if (state?.runId === runId) return state;
    }
    const preparing = this._preparing.load(runId);
    if (preparing) return preparing;
    return null;
  }

  #loadBoundWorktreeState(specId, readOnly) {
    this.#recoverBoundIssueTransition();
    return this._worktreeBinding.withLock(() => {
      const identity = this._worktreeBinding.loadOwned().identity;
      const requested = withSpecIdArgDefault(specId, this._boundSpecId);
      if (requested != null && specIdFromPath(requested) !== identity.specId) {
        throw new Error(
          `worktree flow binding spec mismatch: ${requested} != ${identity.spec}`,
        );
      }
      const state = readOnly
        ? this._store.loadReadOnly(identity.specId)
        : this._store.load(identity.specId);
      return identity.assertFlowState(state);
    });
  }

  #setBoundWorktreeIssue(issue, opts = {}) {
    if (typeof issue !== "number" || !Number.isSafeInteger(issue) || issue < 1) {
      throw new Error(`worktree flow identity issue must be a positive integer: ${issue}`);
    }
    const operationLock = new RepositoryFlowOperationLock({
      mainRoot: this._mainRoot,
      maintenanceOwnerToken: opts.maintenanceOwnerToken,
      operationOwnerToken: opts.operationOwnerToken,
      ...(this._processIdentitySource && { processIdentitySource: this._processIdentitySource }),
    });
    const operationOwnerToken = operationLock.acquire();
    let result;
    let primary = null;
    try {
      result = this._worktreeBinding.withLock((bindingOwnerToken) => {
        this.#recoverBoundIssueTransitionOwned(bindingOwnerToken, operationOwnerToken);
        const identity = this._worktreeBinding.loadOwned().identity;
        if (opts.specId != null && specIdFromPath(opts.specId) !== identity.specId) {
          throw new Error(`worktree flow binding spec mismatch: ${opts.specId} != ${identity.spec}`);
        }
        const currentState = this._store.load(identity.specId);
        identity.assertFlowState(currentState);
        if (identity.issue === issue) return { identity, state: currentState };
        const nextState = structuredClone(currentState);
        nextState.issue = issue;
        const nextIdentity = identity.withIssue(issue);
        const writeOptions = {
          boundSpecId: identity.specId,
          expectedOriginal: currentState,
          faultInjector: opts.faultInjector,
          processIdentitySource: opts.processIdentitySource,
          maintenanceOwnerToken: opts.maintenanceOwnerToken,
          operationOwnerToken,
          allowIssueTransition: true,
        };
        const transition = this._worktreeBinding.beginIssueTransition(
          identity,
          nextIdentity,
          bindingOwnerToken,
        );
        writeOptions.transitionId = transition.transitionId;
        writeOptions.writerOwnerToken = transition.writerOwnerToken;
        writeOptions.writerOwnerTempName = transition.writerOwnerTempName;
        try {
          this._store.saveAtomic(nextState, writeOptions);
        } catch (flowError) {
          try {
            this.#recoverBoundIssueTransitionOwned(bindingOwnerToken, operationOwnerToken);
          } catch (recoveryError) {
            throw new AggregateError(
              [flowError, recoveryError],
              "worktree Issue state update and recovery both failed",
              { cause: flowError },
            );
          }
          throw flowError;
        }
        try {
          this._worktreeBinding.replace(identity, nextIdentity, bindingOwnerToken);
        } catch (bindingError) {
          const rollbackErrors = [];
          try {
            const visibleIdentity = this._worktreeBinding.loadOwned().identity;
            if (visibleIdentity.equals(nextIdentity)) {
              this._worktreeBinding.replace(nextIdentity, identity, bindingOwnerToken);
            } else if (!visibleIdentity.equals(identity)) {
              throw new Error("worktree flow binding has an unknown identity after failed Issue update");
            }
          } catch (error) {
            rollbackErrors.push(error);
          }
          try {
            this._store.saveAtomic(currentState, {
              ...writeOptions,
              expectedOriginal: nextState,
            });
          } catch (error) {
            rollbackErrors.push(error);
          }
          if (rollbackErrors.length === 0) {
            try {
              this._worktreeBinding.clearIssueTransition(bindingOwnerToken);
            } catch (error) {
              rollbackErrors.push(error);
            }
          }
          if (rollbackErrors.length > 0) {
            throw new AggregateError(
              [bindingError, ...rollbackErrors],
              "worktree Issue binding update and rollback failed",
              { cause: bindingError },
            );
          }
          throw bindingError;
        }
        this._worktreeBinding.clearIssueTransition(bindingOwnerToken);
        return { identity: nextIdentity, state: nextState };
      });
    } catch (error) {
      primary = error;
    }
    let releaseError = null;
    try {
      operationLock.release();
    } catch (error) {
      releaseError = error;
    }
    if (primary && releaseError) {
      throw new AggregateError(
        [primary, releaseError],
        "worktree Issue binding transaction and repository lock release both failed",
        { cause: primary },
      );
    }
    if (primary) throw primary;
    if (releaseError) throw releaseError;
    return result;
  }

  #recoverBoundIssueTransition() {
    if (!this._worktreeBinding?.issueTransitionExists) return;
    const operationLock = new RepositoryFlowOperationLock({
      mainRoot: this._mainRoot,
      ...(this._processIdentitySource && { processIdentitySource: this._processIdentitySource }),
    });
    const operationOwnerToken = operationLock.acquire();
    let primary = null;
    try {
      this._worktreeBinding.withLock((bindingOwnerToken) => {
        this.#recoverBoundIssueTransitionOwned(bindingOwnerToken, operationOwnerToken);
      });
    } catch (error) {
      primary = error;
    }
    let releaseError = null;
    try {
      operationLock.release();
    } catch (error) {
      releaseError = error;
    }
    if (primary && releaseError) {
      throw new AggregateError(
        [primary, releaseError],
        "worktree Issue recovery and repository lock release both failed",
        { cause: primary },
      );
    }
    if (primary) throw primary;
    if (releaseError) throw releaseError;
  }

  #resolveGuardedWorktreeBinding(expectation) {
    const operationLock = new RepositoryFlowOperationLock({
      mainRoot: this._mainRoot,
      ...(this._processIdentitySource && { processIdentitySource: this._processIdentitySource }),
    });
    const operationOwnerToken = operationLock.acquire();
    let result;
    let primary = null;
    try {
      result = this._worktreeBinding.withLock((bindingOwnerToken) => {
        const binding = this._worktreeBinding.loadOwned().identity;
        const transition = this._worktreeBinding.loadIssueTransitionOwned();
        const authorities = transition ? [transition.original, transition.next] : [binding];
        const matchesAuthority = authorities.some((identity) => (
          expectation.mismatchAgainst(identity.toJSON()) == null
        ));
        if (!matchesAuthority) throw new ActiveFlowMismatchError(expectation, binding.toJSON());
        if (transition) {
          this.#recoverBoundIssueTransitionOwned(bindingOwnerToken, operationOwnerToken);
        }
        const resolved = this._worktreeBinding.loadOwned().identity;
        const state = this._store.load(resolved.specId);
        resolved.assertFlowState(state);
        return resolved;
      });
    } catch (error) {
      primary = error;
    }
    let releaseError = null;
    try {
      operationLock.release();
    } catch (error) {
      releaseError = error;
    }
    if (primary && releaseError) {
      throw new AggregateError(
        [primary, releaseError],
        "guarded worktree identity resolution and repository lock release both failed",
        { cause: primary },
      );
    }
    if (primary) throw primary;
    if (releaseError) throw releaseError;
    return result;
  }

  #recoverBoundIssueTransitionOwned(bindingOwnerToken, operationOwnerToken) {
    const transition = this._worktreeBinding.loadIssueTransitionOwned();
    if (!transition) return;
    const binding = this._worktreeBinding.loadOwned().identity;
    const state = this._store.load(transition.original.specId);
    const originalState = this.#identityMatchesFlowState(transition.original, state);
    const nextState = this.#identityMatchesFlowState(transition.next, state);
    const originalBinding = binding.equals(transition.original);
    const nextBinding = binding.equals(transition.next);

    if ((originalState || nextState) && (originalBinding || nextBinding)) {
      this._store.recoverCommittedAtomicWrite(transition.original.specId, {
        operationOwnerToken,
        transitionId: transition.transitionId,
        writerOwnerToken: transition.writerOwnerToken,
        writerOwnerTempName: transition.writerOwnerTempName,
        ...(this._processIdentitySource && { processIdentitySource: this._processIdentitySource }),
      });
    }

    if (originalState && nextBinding) {
      this._worktreeBinding.replace(transition.next, transition.original, bindingOwnerToken);
    } else if (nextState && originalBinding) {
      this._worktreeBinding.replace(transition.original, transition.next, bindingOwnerToken);
    } else if (!(originalState && originalBinding) && !(nextState && nextBinding)) {
      throw new Error("worktree flow Issue transition cannot reconcile the visible flow and binding identities");
    }
    this._worktreeBinding.clearIssueTransition(bindingOwnerToken);
  }

  #identityMatchesFlowState(identity, state) {
    try {
      identity.assertFlowState(state);
      return true;
    } catch {
      return false;
    }
  }
}
