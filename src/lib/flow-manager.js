/**
 * src/lib/flow-manager.js
 *
 * Facade for Spec-Driven Development flow state management. Owns:
 *   - FlowStore             : configured spec-root flow.json I/O + mutations
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
import { FlowTargetExpectation } from "./flow-target-guard.js";
import { findInProgressLeaf } from "../flow/lib/step-tree.js";
import { WorktreeFlowBindingStore } from "./worktree-flow-binding.js";
import { RepositoryFlowOperationLock } from "./repository-maintenance-lock.js";
import { DEFAULT_FLOW_SPEC_DIR, FlowWorkspace } from "./flow-workspace.js";
import { FlowVersion } from "./flow-version.js";
import {
  FlowTargetAuthorityError,
  FlowTargetIdentity,
  FlowTargetIdentityAuthority,
  FlowTargetRecoveryError,
} from "./flow-target-identity-authority.js";

const ACTIVE_FLOW_MODES = new Set(["worktree", "branch", "local"]);

export class ResolvedFlowTarget {
  constructor({ state, specId = null, worktreePath = null, mainRoot, authorityRoot, preparing = false }) {
    if (!state || typeof state !== "object") throw new Error("resolved flow target state is required");
    if (!state.runId) throw new Error("resolved flow target runId is required");
    if (!mainRoot) throw new Error("resolved flow target main root is required");
    if (!authorityRoot) throw new Error("resolved flow target authority root is required");
    this.state = state;
    this.specId = state.specId ?? specId;
    this.worktreePath = worktreePath;
    this.mainRoot = mainRoot;
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
    if (this.mismatchAgainst(expectation)) return false;
    return true;
  }

  mismatchAgainst(expectation) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty) return null;
    if (this.preparing && expectation.binding) {
      return expectation.mismatchAgainst(this.state) || {
        expectedSpec: expectation.binding.specId,
        activeSpec: null,
      };
    }
    if (expectation.binding) {
      try {
        expectation.binding.assertCurrent(this.bindingInput());
      } catch (error) {
        if (error?.code === "ACTIVE_FLOW_MISMATCH") return error.data;
        throw error;
      }
    }
    return expectation.mismatchAgainst(this.state);
  }

  bindingInput() {
    return {
      flowState: this.state,
      mainRoot: this.mainRoot,
      authorityRoot: this.authorityRoot,
      ...(this.worktreePath && { worktreePath: this.worktreePath }),
    };
  }
}

export class ActiveFlowIdentityEntry {
  constructor({ entry, identity } = {}) {
    if (!entry || typeof entry !== "object") throw new Error("active flow identity entry is required");
    if (typeof entry.specId !== "string" || entry.specId.trim() === "") {
      throw new Error("active flow identity specId is required");
    }
    if (!ACTIVE_FLOW_MODES.has(entry.mode)) throw new Error("active flow identity mode is invalid");
    if (!(identity instanceof FlowTargetIdentity) || identity.lifecycle !== "active") {
      throw new Error(`active flow identity authority is unavailable for ${entry.specId}`);
    }
    if (identity.specId !== entry.specId || identity.mode !== entry.mode) {
      throw new Error(`active flow identity specId mismatch for ${entry.specId}`);
    }
    this.runId = identity.runId;
    this.issue = identity.issue;
    this.specId = entry.specId;
    this.mode = entry.mode;
    Object.freeze(this);
  }

  get key() {
    return `${this.runId}\u0000${this.issue ?? "none"}\u0000${this.specId}\u0000${this.mode}`;
  }

  toJSON() {
    return {
      runId: this.runId,
      issue: this.issue,
      specId: this.specId,
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
      || expectation.specId == null
      || (expectation.issue == null && expectation.issueAbsent !== true)
    ) {
      throw new ParkedFlowError(
        "FLOW_PARK_TARGET_REQUIRED",
        "parked flow operations require exact --expect-run-id, --expect-spec, and Issue identity guards",
      );
    }
    this.runId = expectation.runId;
    this.specId = expectation.specId;
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
      "--expect-spec", this.specId,
      ...(this.issueAbsent
        ? ["--expect-no-issue"]
        : ["--expect-issue", String(this.issue)]),
    ];
  }

  toJSON() {
    return {
      runId: this.runId,
      specId: this.specId,
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
    expectation.specId && `spec ${expectation.specId}`,
  ].filter(Boolean).join(", ");
}

function flowTargetErrorData(expectation, matchCount) {
  return {
    matchCount,
    ...(expectation.runId != null && { expectedRunId: expectation.runId }),
    ...((expectation.issue != null || expectation.issueAbsent) && {
      expectedIssue: expectation.issue,
    }),
    ...(expectation.specId != null && { expectedSpec: expectation.specId }),
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
  constructor(expectation, state, data = expectation.mismatchAgainst(state)) {
    super("managed worktree flow identity does not match the specified target");
    this.code = "ACTIVE_FLOW_MISMATCH";
    this.data = data;
  }
}

class CapturedFlowTargetMutation {
  constructor(expectation, mutate) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty || expectation.specId == null) {
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
    specRoot = DEFAULT_FLOW_SPEC_DIR,
    bindingFaultInjector = () => {},
    targetIdentityFaultInjector = () => {},
    processIdentitySource,
  }) {
    this._root = root;
    this._mainRoot = mainRoot;
    this._inWorktree = inWorktree;
    this._boundSpecId = specId;
    this._workspace = new FlowWorkspace({ repositoryRoot: mainRoot, executionRoot: root, specRoot });
    this._bindingFaultInjector = bindingFaultInjector;
    this._targetIdentityFaultInjector = targetIdentityFaultInjector;
    this._processIdentitySource = processIdentitySource;
    this._usesWorktreeFlowBinding = isManagedFlowWorktree(root, mainRoot, inWorktree);
    this._activeFlows = new ActiveFlowRegistry({
      mainRoot,
      specRoot: this._workspace.specRoot,
      ...(processIdentitySource && { processIdentitySource }),
    });
    this._preparing = new PreparingFlowStore({
      mainRoot,
      ...(processIdentitySource && { processIdentitySource }),
    });
    this._targetIdentities = new FlowTargetIdentityAuthority({
      mainRoot,
      specRoot: this._workspace.specRoot,
      faultInjector: targetIdentityFaultInjector,
      ...(processIdentitySource && { processIdentitySource }),
    });
    this._store = new FlowStore({
      root,
      mainRoot,
      inWorktree,
      specRoot: this._workspace.specRoot,
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

  get specRoot() {
    return this._workspace.specRoot;
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
      this._boundSpecId = state.specId;
    }
    return created;
  }
  saveAtomic(state, options = {}) {
    return this._store.saveAtomic(state, { ...options, boundSpecId: this._boundSpecId });
  }

  #bindLoadedState(state) {
    if (state != null && this._boundSpecId == null) {
      this._boundSpecId = state.specId;
    }
    return state;
  }
  mutate(mutator, opts) {
    const resolved = withSpecIdDefault(opts, this._boundSpecId) || {};
    if (!this._worktreeBinding && resolved.allowIssueTransition === true) {
      return this.#mutateIndexedActiveIssue(mutator, resolved);
    }
    return this._store.mutate(mutator, resolved);
  }
  captureExactTarget(expectation) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty || expectation.specId == null) {
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
    return this.mutate((current) => {
      if (expectation.mismatchAgainst(current)) throw new ActiveFlowMismatchError(expectation, current);
      return mutator(current);
    }, { ...opts, specId: expectation.specId });
  }
  pathFor(specId) { return this._store.pathFor(withSpecIdArgDefault(specId, this._boundSpecId)); }
  specLocation(specId) { return this._workspace.forSpec(withSpecIdArgDefault(specId, this._boundSpecId)); }
  canonicalVersionLocation(version, { specId } = {}) {
    return this._workspace.canonicalVersion(withSpecIdArgDefault(specId, this._boundSpecId), FlowVersion.from(version));
  }
  executionVersionLocation(version, { specId } = {}) {
    return this._workspace.executionVersion(withSpecIdArgDefault(specId, this._boundSpecId), FlowVersion.from(version));
  }
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
      specRoot: this._workspace.specRoot,
      bindingFaultInjector: opts.bindingFaultInjector ?? this._bindingFaultInjector,
      targetIdentityFaultInjector: opts.targetIdentityFaultInjector ?? this._targetIdentityFaultInjector,
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

  snapshotWorktreeBinding(expectation = null) {
    if (!this._worktreeBinding) {
      throw new Error("worktree flow binding is available only inside a worktree");
    }
    return this._worktreeBinding.withLock(() => {
      const snapshot = this._worktreeBinding.loadOwned();
      if (expectation instanceof FlowTargetExpectation && !expectation.empty) {
        const mismatch = expectation.mismatchAgainst(snapshot.identity.toJSON());
        if (mismatch) throw new ActiveFlowMismatchError(expectation, snapshot.identity.toJSON());
      }
      return Object.freeze({
        identity: Object.freeze(snapshot.identity.toJSON()),
        revision: snapshot.revision,
      });
    });
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
      return this.mutate(
        (state) => { state.issue = issue; },
        { ...withSpecIdDefault(opts, this._boundSpecId), allowIssueTransition: true },
      );
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
   * Returns { specId, sentiPhase } derived from the active flow.json; both are
   * null when no active flow is present (expected outside Spec-Driven Development contexts).
   */
  resolveCurrentContext() {
    const state = this.load();
    if (!state) return { specId: null, sentiPhase: null, taskId: null };
    const specId = state.specId ?? null;
    const inProgress = findInProgressLeaf(state.steps);
    const sentiPhase = inProgress?.id ?? null;
    const taskId = state.currentTaskId ?? null;
    return { specId, sentiPhase, taskId };
  }

  // ── .active-flow (ActiveFlowRegistry) ───────────────────────────────────────

  loadActiveFlows() { return this._activeFlows.load(); }
  snapshotActiveFlows(options) { return this._activeFlows.snapshot(options); }
  snapshotActiveFlowIdentities(options = {}) {
    return this.#withRepositoryOperation(options, (operationOwnerToken) => {
      const registrySnapshot = this.snapshotActiveFlows({ ...options, operationOwnerToken });
      const identitySnapshot = this._targetIdentities.snapshot();
      const activeIdentities = identitySnapshot.entries.filter((entry) => entry.lifecycle === "active");
      const entries = activeIdentities.map((identity) => {
        const entry = registrySnapshot.entries.find((candidate) => candidate.specId === identity.specId);
        if (!entry || entry.mode !== identity.mode) {
          throw new FlowTargetAuthorityError(
            `active target identity is inconsistent with the active-flow registry: ${identity.specId}`,
            { data: identity.toErrorData() },
          );
        }
        return new ActiveFlowIdentityEntry({ entry, identity });
      });
      return new ActiveFlowIdentitySnapshot({ entries, revision: registrySnapshot.revision });
    }, "active flow identity snapshot and repository lock release both failed");
  }
  addActiveFlow(specId, mode, options = {}) {
    return this.#withRepositoryOperation(options, (operationOwnerToken) => {
      const existing = this._activeFlows.load().find((entry) => entry.specId === specId) ?? null;
      this._activeFlows.add(specId, mode, { ...options, operationOwnerToken });
      let state;
      try {
        state = this._store.load(specId);
      } catch {
        // A pointer to invalid state remains an unindexed orphan. It is kept
        // diagnosable in the registry but never promoted into target identity
        // authority.
        return null;
      }
      // A pointer without state remains an unindexed orphan. Registry-only
      // callers can still diagnose or remove it.
      if (!state) return null;
      try {
        return this._targetIdentities.addActive(state, mode, { ...options, operationOwnerToken });
      } catch (authorityError) {
        if (!existing) {
          try {
            this._activeFlows.remove(specId, { ...options, operationOwnerToken });
          } catch (rollbackError) {
            throw new AggregateError(
              [authorityError, rollbackError],
              "active flow registration and identity rollback both failed",
              { cause: authorityError },
            );
          }
        }
        throw authorityError;
      }
    }, "active flow registration and repository lock release both failed");
  }
  assertCanAddActiveFlow(specId, mode, options) { return this._activeFlows.assertCanAdd(specId, mode, options); }
  removeActiveFlow(specId, options = {}) {
    return this.#withRepositoryOperation(options, (operationOwnerToken) => {
      const registryEntry = this._activeFlows.load().find((entry) => entry.specId === specId) ?? null;
      const identity = this._targetIdentities.snapshot().entries.find((entry) => (
        entry.lifecycle === "active" && entry.specId === specId
      )) ?? null;
      if (identity && (!registryEntry || registryEntry.mode !== identity.mode)) {
        throw new FlowTargetAuthorityError(
          `active target identity is inconsistent with the active-flow registry: ${specId}`,
          { data: identity.toErrorData() },
        );
      }
      this._activeFlows.remove(specId, { ...options, operationOwnerToken });
      try {
        return this._targetIdentities.removeActive(specId, { ...options, operationOwnerToken });
      } catch (authorityError) {
        if (registryEntry) {
          try {
            this._activeFlows.add(specId, registryEntry.mode, { ...options, operationOwnerToken });
          } catch (rollbackError) {
            throw new AggregateError(
              [authorityError, rollbackError],
              "active flow identity removal and registry rollback both failed",
              { cause: authorityError },
            );
          }
        }
        throw authorityError;
      }
    }, "active flow removal and repository lock release both failed");
  }
  assertFlowStateWritable(specId, options) { return this._store.assertWritable(specId, options); }
  cleanStaleFlows(options = {}) {
    return this.#withRepositoryOperation(options, (operationOwnerToken) => {
      const before = this._activeFlows.load();
      const identities = this._targetIdentities.snapshot().entries;
      const valid = this._activeFlows.cleanStale({ ...options, operationOwnerToken });
      const validSpecs = new Set(valid.map((entry) => entry.specId));
      const removedEntries = before.filter((entry) => !validSpecs.has(entry.specId));
      const removedIdentities = [];
      try {
        for (const entry of removedEntries) {
          const identity = identities.find((candidate) => (
            candidate.lifecycle === "active" && candidate.specId === entry.specId
          ));
          if (!identity) continue;
          this._targetIdentities.removeActive(entry.specId, { ...options, operationOwnerToken });
          removedIdentities.push(identity);
        }
      } catch (authorityError) {
        const rollbackErrors = [];
        for (const entry of removedEntries) {
          try {
            this._activeFlows.add(entry.specId, entry.mode, { ...options, operationOwnerToken });
          } catch (error) {
            rollbackErrors.push(error);
          }
        }
        for (const identity of removedIdentities) {
          try {
            this._targetIdentities.restore(identity, { ...options, operationOwnerToken });
          } catch (error) {
            rollbackErrors.push(error);
          }
        }
        if (rollbackErrors.length > 0) {
          throw new AggregateError(
            [authorityError, ...rollbackErrors],
            "stale flow identity cleanup and rollback both failed",
            { cause: authorityError },
          );
        }
        throw authorityError;
      }
      return valid;
    }, "stale flow cleanup and repository lock release both failed");
  }

  parkActiveFlow(identity, options = {}) {
    if (!(identity instanceof ParkedFlowIdentity)) {
      throw new ParkedFlowError(
        "FLOW_PARK_TARGET_REQUIRED",
        "park requires an exact parked flow identity",
      );
    }
    return this.#withParkedFlowOperation(options, (operationOwnerToken) => {
      const resolved = this.#resolveParkedWorktreeOwned(identity);
      const entry = this._activeFlows.load().find((candidate) => candidate.specId === identity.specId);
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
      const targetIdentity = this.#targetIdentityEntries("active")
        .find((candidate) => candidate.specId === identity.specId) ?? null;
      if (!targetIdentity) {
        throw new FlowTargetAuthorityError(`active flow identity is missing for ${identity.specId}`);
      }
      targetIdentity.assertState(resolved.state);
      this._activeFlows.park(identity.specId, {
        ...options,
        operationOwnerToken,
      });
      try {
        this._targetIdentities.removeActive(identity.specId, {
          ...options,
          operationOwnerToken,
        });
      } catch (authorityError) {
        try {
          this._activeFlows.add(identity.specId, "worktree", {
            ...options,
            operationOwnerToken,
          });
        } catch (rollbackError) {
          throw new AggregateError(
            [authorityError, rollbackError],
            "parked flow identity update and registry rollback both failed",
            { cause: authorityError },
          );
        }
        throw authorityError;
      }
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
      const entry = this._activeFlows.load().find((candidate) => candidate.specId === identity.specId);
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
      try {
        this._targetIdentities.addActive(resolved.state, "worktree", {
          ...options,
          operationOwnerToken,
        });
      } catch (authorityError) {
        if (changed) {
          try {
            this._activeFlows.park(identity.specId, {
              ...options,
              operationOwnerToken,
            });
          } catch (rollbackError) {
            throw new AggregateError(
              [authorityError, rollbackError],
              "parked flow resume identity update and registry rollback both failed",
              { cause: authorityError },
            );
          }
        }
        throw authorityError;
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
      specId = current.specId;
    }
    this.removeActiveFlow(specId, options);
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
    return this.#withRepositoryOperation(
      options,
      body,
      "parked flow authority transaction and repository lock release both failed",
    );
  }

  // ── preparing flow (PreparingFlowStore) ─────────────────────────────────────

  generateRunId() { return this._preparing.generateRunId(); }
  createPreparingFlow(runId, extra = {}, options = {}) {
    return this.#withRepositoryOperation(options, (operationOwnerToken) => {
      const createdPath = this._preparing.create(runId, extra);
      const state = this._preparing.load(runId);
      try {
        this._targetIdentities.addPreparing(state, { ...options, operationOwnerToken });
      } catch (authorityError) {
        try {
          this._preparing.delete(runId);
        } catch (rollbackError) {
          throw new AggregateError(
            [authorityError, rollbackError],
            "preparing flow creation and identity rollback both failed",
            { cause: authorityError },
          );
        }
        throw authorityError;
      }
      return createdPath;
    }, "preparing flow creation and repository lock release both failed");
  }
  loadPreparingFlow(runId) { return this._preparing.load(runId); }
  resolvePreparingByRunId(runId) {
    const expectation = new FlowTargetExpectation({ expectRunId: runId });
    try {
      return this.#resolveExplicitIdentity(expectation, "preparing").state;
    } catch (error) {
      if (error.code === "FLOW_TARGET_NOT_FOUND") return null;
      throw error;
    }
  }
  mutatePreparingFlow(runId, mutator, options = {}) {
    return this.#withRepositoryOperation(options, (operationOwnerToken) => {
      const indexed = this._targetIdentities.snapshot().entries.find((entry) => (
        entry.lifecycle === "preparing" && entry.runId === runId
      ));
      if (!indexed) {
        throw new FlowTargetAuthorityError(`preparing flow identity is missing: ${runId}`);
      }
      let original;
      try {
        original = this._preparing.load(runId);
      } catch (cause) {
        throw new FlowTargetRecoveryError(
          indexed,
          `selected preparing flow state is corrupt or unreadable: ${runId}`,
          { cause },
        );
      }
      if (!original) {
        throw new FlowTargetRecoveryError(
          indexed,
          `selected preparing flow state is missing: ${runId}`,
          { reason: "PREPARING_FLOW_NOT_FOUND" },
        );
      }
      indexed.assertState(original);
      const updated = this._preparing.mutate(runId, (state) => {
        mutator(state);
        if (state.runId !== runId || state.lifecycle !== "preparing" || state.specId !== null) {
          throw new Error("preparing flow mutation must preserve runId, lifecycle, and null specId");
        }
      });
      try {
        this._targetIdentities.replacePreparing(updated, { ...options, operationOwnerToken });
      } catch (authorityError) {
        try {
          this._preparing.mutate(runId, (state) => {
            for (const key of Object.keys(state)) delete state[key];
            Object.assign(state, structuredClone(original));
          });
        } catch (rollbackError) {
          throw new AggregateError(
            [authorityError, rollbackError],
            "preparing flow identity update and state rollback both failed",
            { cause: authorityError },
          );
        }
        throw authorityError;
      }
      return updated;
    }, "preparing flow mutation and repository lock release both failed");
  }
  resolvePreparingInputs(runId, cliIssue, cliRequest) {
    return this._preparing.resolveInputs(runId, cliIssue, cliRequest);
  }
  deletePreparingFlow(runId, options = {}) {
    return this.#withRepositoryOperation(options, (operationOwnerToken) => {
      const identity = this._targetIdentities.snapshot().entries.find((entry) => (
        entry.lifecycle === "preparing" && entry.runId === runId
      )) ?? null;
      let state;
      try {
        state = this._preparing.load(runId);
      } catch (cause) {
        if (!identity) throw cause;
        throw new FlowTargetRecoveryError(
          identity,
          `selected preparing flow state is corrupt or unreadable: ${runId}`,
          { cause },
        );
      }
      if (identity) {
        if (!state) {
          throw new FlowTargetRecoveryError(
            identity,
            `selected preparing flow state is missing: ${runId}`,
            { reason: "PREPARING_FLOW_NOT_FOUND" },
          );
        }
        identity.assertState(state);
      }
      this._preparing.delete(runId);
      try {
        return this._targetIdentities.removePreparing(runId, { ...options, operationOwnerToken });
      } catch (authorityError) {
        if (state) {
          try {
            this._preparing.create(runId, state);
          } catch (rollbackError) {
            throw new AggregateError(
              [authorityError, rollbackError],
              "preparing flow identity removal and state rollback both failed",
              { cause: authorityError },
            );
          }
        }
        throw authorityError;
      }
    }, "preparing flow deletion and repository lock release both failed");
  }
  listPreparingFlows() {
    return this._targetIdentities.snapshot().entries
      .filter((entry) => entry.lifecycle === "preparing")
      .map((entry) => entry.runId);
  }

  resolveExplicitFlowTarget(expectation) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty) {
      throw new Error("explicit flow target expectation is required");
    }
    return this.#resolveExplicitIdentity(expectation);
  }

  resolveExplicitFlowTargetForRead(expectation) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty) {
      throw new Error("explicit flow target expectation is required");
    }
    return this.#resolveExplicitIdentity(expectation);
  }

  #resolveExplicitIdentity(expectation, lifecycle = null) {
    const identities = this.#targetIdentityEntries(lifecycle);
    const matches = identities.filter((identity) => identity.matches(expectation));
    const identity = resolveUniqueFlowTarget(expectation, matches);
    const target = this.#loadTargetIdentity(identity);
    if (!target.matches(expectation)) throw new FlowTargetNotFoundError(expectation);
    return target;
  }

  #targetIdentityEntries(lifecycle = null) {
    const identities = this._targetIdentities.snapshot().entries;
    let registry;
    try {
      registry = this._activeFlows.load();
    } catch (cause) {
      throw new FlowTargetAuthorityError("active-flow registry is invalid during target resolution", { cause });
    }
    const selectable = identities.filter((identity) => {
      if (identity.lifecycle !== "active") return true;
      const entry = registry.find((candidate) => candidate.specId === identity.specId);
      if (!entry) {
        throw new FlowTargetAuthorityError(
          `active target identity is missing from the active-flow registry: ${identity.specId}`,
          { data: identity.toErrorData() },
        );
      }
      if (entry.mode !== identity.mode) {
        throw new FlowTargetAuthorityError(
          `active target identity is inconsistent with the active-flow registry: ${identity.specId}`,
          { data: identity.toErrorData() },
        );
      }
      return true;
    });
    return lifecycle == null
      ? selectable
      : selectable.filter((identity) => identity.lifecycle === lifecycle);
  }

  #loadTargetIdentity(identity) {
    let state;
    let resolved = null;
    try {
      if (identity.preparing) {
        state = this._preparing.load(identity.runId);
      } else {
        resolved = this._loadActiveFlowState(identity.specId);
        state = resolved?.state ?? null;
      }
    } catch (cause) {
      throw new FlowTargetRecoveryError(
        identity,
        `selected flow target state is corrupt or unreadable: ${identity.runId}`,
        { cause },
      );
    }
    if (!state) {
      throw new FlowTargetRecoveryError(
        identity,
        `selected flow target state is missing: ${identity.runId}`,
        { reason: identity.preparing ? "PREPARING_FLOW_NOT_FOUND" : "ACTIVE_FLOW_STATE_AUTHORITY_MISSING" },
      );
    }
    identity.assertState(state);
    return new ResolvedFlowTarget({
      state,
      specId: identity.specId,
      worktreePath: resolved?.worktreePath ?? null,
      mainRoot: this._mainRoot,
      authorityRoot: resolved?.worktreePath || this._mainRoot,
      preparing: identity.preparing,
    });
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
      const specId = flowState.specId;
      let worktreePath = null;
      if (flowState.worktree) {
        const candidate = this._store.resolveWorktreePaths(flowState).worktreePath;
        if (candidate && fs.existsSync(candidate)) worktreePath = candidate;
      }
      if (!expectation) {
        return { state: flowState, specId, worktreePath };
      }
      const target = new ResolvedFlowTarget({
        state: flowState,
        specId,
        worktreePath,
        mainRoot: this._mainRoot,
        authorityRoot: worktreePath || this._root,
      });
      const mismatch = expectation ? target.mismatchAgainst(expectation) : null;
      if (mismatch) {
        throw new ActiveFlowMismatchError(expectation, flowState, mismatch);
      }
      return { state: flowState, specId, worktreePath };
    }

    const activeFlows = this._activeFlows.load();
    if (expectation) {
      const target = this.#resolveExplicitIdentity(expectation, "active");
      return {
        state: target.state,
        specId: target.specId,
        worktreePath: target.worktreePath,
      };
    }

    if (activeFlows.length === 1) {
      const resolved = this._loadActiveFlowState(activeFlows[0].specId);
      if (resolved) return resolved;
    } else if (activeFlows.length > 1) {
      throw new Error(
        `multiple active flows: ${activeFlows.map((f) => `${f.specId} (${f.mode})`).join(", ")}. Pass --spec <specId> to select one.`,
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
      const resolved = this._loadActiveFlowState(entry.specId);
      if (resolved?.state && predicate(resolved.state)) matches.push(resolved);
    }
    return matches;
  }

  /**
   * Load one active flow from the single base-side state authority. A managed
   * worktree is execution metadata only and is never a state fallback.
   *
   * @param {string} specId
   * @returns {{ state: object, specId: string, worktreePath: string|null } | null}
   */
  _loadActiveFlowState(specId) {
    const state = this._store.load(specId);
    if (!state) {
      const statePath = this._store.pathFor(specId);
      const error = new Error(
        `active flow state is missing at the configured spec root: ${statePath}. `
        + "Restore flow.specDir or resolve the active flow explicitly before continuing.",
      );
      error.code = "ACTIVE_FLOW_STATE_AUTHORITY_MISSING";
      error.specId = specId;
      error.statePath = statePath;
      throw error;
    }
    let worktreePath = null;
    if (state.worktree) {
      const resolved = this._store.resolveWorktreePaths(state);
      const candidate = resolved.worktreePath;
      if (candidate && fs.existsSync(candidate)) worktreePath = candidate;
    }
    return { state, specId, worktreePath };
  }

  /**
   * Resolve flow state by runId.
   * @param {string} runId
   * @returns {object|null}
   */
  resolveByRunId(runId) {
    const expectation = new FlowTargetExpectation({ expectRunId: runId });
    const matches = this.#targetIdentityEntries().filter((identity) => identity.matches(expectation));
    if (matches.length === 0) return null;
    return this.#loadTargetIdentity(resolveUniqueFlowTarget(expectation, matches)).state;
  }

  #loadBoundWorktreeState(specId, readOnly) {
    this.#recoverBoundIssueTransition();
    return this._worktreeBinding.withLock(() => {
      const identity = this._worktreeBinding.loadOwned().identity;
      const requested = withSpecIdArgDefault(specId, this._boundSpecId);
      if (requested != null && requested !== identity.specId) {
        throw new Error(
          `worktree flow binding specId mismatch: ${requested} != ${identity.specId}`,
        );
      }
      const state = readOnly
        ? this._store.loadReadOnly(identity.specId)
        : this._store.load(identity.specId);
      return identity.assertFlowState(state);
    });
  }

  #mutateIndexedActiveIssue(mutator, opts = {}) {
    const requestedSpecId = withSpecIdArgDefault(opts.specId, this._boundSpecId);
    return this.#withRepositoryOperation(opts, (operationOwnerToken) => {
      const activeIdentities = this.#targetIdentityEntries("active");
      const identity = requestedSpecId
        ? activeIdentities.find((entry) => entry.specId === requestedSpecId) ?? null
        : activeIdentities.length === 1 ? activeIdentities[0] : null;
      if (!identity) {
        const registryEntry = requestedSpecId
          ? this._activeFlows.load().find((entry) => entry.specId === requestedSpecId)
          : null;
        if (requestedSpecId && !registryEntry) {
          return this._store.mutate(mutator, {
            ...opts,
            specId: requestedSpecId,
            operationOwnerToken,
            allowIssueTransition: true,
          });
        }
        throw new FlowTargetAuthorityError(
          requestedSpecId
            ? `active flow identity is missing for ${requestedSpecId}`
            : "Issue mutation requires one active flow identity",
        );
      }
      const specId = identity.specId;
      const original = this._store.load(specId);
      if (!original) {
        throw new FlowTargetRecoveryError(
          identity,
          `selected active flow state is missing: ${identity.runId}`,
          { reason: "ACTIVE_FLOW_STATE_AUTHORITY_MISSING" },
        );
      }
      identity.assertState(original);
      const mutationResult = this._store.mutate((state, context) => {
        mutator(state, context);
        if (state.runId !== identity.runId || state.specId !== identity.specId) {
          throw new Error("Issue mutation must preserve active runId and specId");
        }
      }, {
        ...opts,
        specId,
        operationOwnerToken,
        allowIssueTransition: true,
      });
      const updated = this._store.load(specId);
      try {
        this._targetIdentities.replaceActive(updated, identity.mode, {
          ...opts,
          operationOwnerToken,
        });
      } catch (authorityError) {
        try {
          this._store.saveAtomic(original, {
            ...opts,
            boundSpecId: specId,
            expectedOriginal: updated,
            operationOwnerToken,
            allowIssueTransition: true,
          });
        } catch (rollbackError) {
          throw new AggregateError(
            [authorityError, rollbackError],
            "active flow identity update and Issue state rollback both failed",
            { cause: authorityError },
          );
        }
        throw authorityError;
      }
      return mutationResult;
    }, "active flow Issue mutation and repository lock release both failed");
  }

  #setBoundWorktreeIssue(issue, opts = {}) {
    if (typeof issue !== "number" || !Number.isSafeInteger(issue) || issue < 1) {
      throw new Error(`worktree flow identity issue must be a positive integer: ${issue}`);
    }
    const operationLock = this.#repositoryOperationLock(opts);
    const operationOwnerToken = operationLock.acquire();
    let result;
    let primary = null;
    try {
      result = this._worktreeBinding.withLock((bindingOwnerToken) => {
        this.#recoverBoundIssueTransitionOwned(bindingOwnerToken, operationOwnerToken);
        const identity = this._worktreeBinding.loadOwned().identity;
        if (opts.specId != null && opts.specId !== identity.specId) {
          throw new Error(`worktree flow binding specId mismatch: ${opts.specId} != ${identity.specId}`);
        }
        const currentState = this._store.load(identity.specId);
        identity.assertFlowState(currentState);
        const targetIdentity = this.#targetIdentityEntries("active")
          .find((entry) => entry.specId === identity.specId) ?? null;
        if (!targetIdentity) {
          throw new FlowTargetAuthorityError(`active flow identity is missing for ${identity.specId}`);
        }
        targetIdentity.assertState(currentState);
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
          this._targetIdentities.replaceActive(nextState, targetIdentity.mode, {
            ...opts,
            operationOwnerToken,
          });
        } catch (transactionError) {
          const rollbackErrors = [];
          try {
            const visibleTarget = this._targetIdentities.snapshot().entries.find((entry) => (
              entry.lifecycle === "active" && entry.specId === targetIdentity.specId
            ));
            const nextTarget = FlowTargetIdentity.active(
              nextState,
              targetIdentity.mode,
              this._workspace.specRoot,
            );
            if (visibleTarget?.revision === nextTarget.revision) {
              this._targetIdentities.replaceActive(currentState, targetIdentity.mode, {
                ...opts,
                operationOwnerToken,
              });
            } else if (visibleTarget?.revision !== targetIdentity.revision) {
              throw new Error("flow target identity has an unknown revision after failed Issue update");
            }
          } catch (error) {
            rollbackErrors.push(error);
          }
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
              [transactionError, ...rollbackErrors],
              "worktree Issue binding update and rollback failed",
              { cause: transactionError },
            );
          }
          throw transactionError;
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
    const operationLock = this.#repositoryOperationLock();
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
    const operationLock = this.#repositoryOperationLock();
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
    const targetIdentity = this._targetIdentities.snapshot().entries.find((entry) => (
      entry.lifecycle === "active" && entry.specId === transition.original.specId
    ));
    if (!targetIdentity) {
      throw new FlowTargetAuthorityError(
        `active flow identity is missing for ${transition.original.specId}`,
      );
    }
    const settledIdentity = FlowTargetIdentity.active(
      state,
      targetIdentity.mode,
      this._workspace.specRoot,
    );
    const originalTarget = FlowTargetIdentity.active(
      { ...state, issue: transition.original.issue },
      targetIdentity.mode,
      this._workspace.specRoot,
    );
    const nextTarget = FlowTargetIdentity.active(
      { ...state, issue: transition.next.issue },
      targetIdentity.mode,
      this._workspace.specRoot,
    );
    if (![originalTarget.revision, nextTarget.revision].includes(targetIdentity.revision)) {
      throw new FlowTargetAuthorityError(
        `active flow identity cannot reconcile Issue transition for ${targetIdentity.specId}`,
        { data: targetIdentity.toErrorData() },
      );
    }
    if (targetIdentity.revision !== settledIdentity.revision) {
      this._targetIdentities.replaceActive(state, targetIdentity.mode, { operationOwnerToken });
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

  #withRepositoryOperation(options, body, aggregateMessage) {
    const operationLock = this.#repositoryOperationLock(options);
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
      throw new AggregateError([primary, releaseError], aggregateMessage, { cause: primary });
    }
    if (primary) throw primary;
    if (releaseError) throw releaseError;
    return result;
  }

  #repositoryOperationLock(options = {}) {
    return new RepositoryFlowOperationLock({
      mainRoot: this._mainRoot,
      maintenanceOwnerToken: options.maintenanceOwnerToken,
      operationOwnerToken: options.operationOwnerToken,
      allowProcessOwnerBorrow: false,
      ...(this._processIdentitySource && { processIdentitySource: this._processIdentitySource }),
    });
  }
}
