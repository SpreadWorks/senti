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
import { runGit } from "./git-helpers.js";
import { sentiDir } from "./config.js";
import { FlowStore } from "./flow-store.js";
import { withSpecIdArgDefault, withSpecIdDefault } from "./flow-options.js";
import { ActiveFlowRegistry } from "./active-flow-registry.js";
import { PreparingFlowStore } from "./preparing-flow-store.js";
import { SCAN_FLOWS_LIMIT, PREPARING_SCAN_LIMIT, specIdFromPath } from "./flow-helpers.js";
import { flowStatePath } from "./flow-state-atomic-writer.js";
import { FlowTargetExpectation } from "./flow-target-guard.js";
import { findInProgressLeaf } from "../flow/lib/step-tree.js";
import { WorktreeFlowBindingStore } from "./worktree-flow-binding.js";
import { RepositoryFlowOperationLock } from "./repository-maintenance-lock.js";

export class FlowScanEntry {
  constructor({ specId, mode, state, location }) {
    this.specId = specId;
    this.mode = mode ?? null;
    this.state = state ?? null;
    this.location = location;
    Object.freeze(this);
  }
}

export class FlowScanResult {
  constructor({ entries, truncated, limit }) {
    this.entries = entries;
    this.truncated = Boolean(truncated);
    this.limit = limit;
    Object.freeze(this.entries);
    Object.freeze(this);
  }

  toDiscoveryJSON() {
    return {
      limit: this.limit,
      truncated: this.truncated,
      count: this.entries.length,
    };
  }
}

export class RecoveryFlowCandidate {
  constructor({ specId, state, mode, flowState, location, executionRoot }) {
    this.specId = specId;
    this.state = state;
    this.mode = mode ?? null;
    this.flowState = flowState ?? null;
    this.location = location;
    this.runId = this.flowState?.runId || null;
    this.executionRoot = executionRoot || null;
    Object.freeze(this);
  }

  get continuable() {
    return (
      (this.state === "active" || this.state === "orphan-worktree")
      && Boolean(this.runId)
      && Boolean(this.executionRoot)
    );
  }

  get blockReason() {
    if (this.continuable) return null;
    if (this.state === "finalized") return "finalized";
    if (!this.runId) return "missing-runId";
    if (!this.executionRoot) return "missing-execution-root";
    return this.state;
  }

  toJSON() {
    return {
      specId: this.specId,
      state: this.state,
      mode: this.mode,
      runId: this.runId,
      location: this.location,
      executionRoot: this.executionRoot,
      worktreePath: this.state === "orphan-worktree" || this.mode === "worktree" ? this.executionRoot : null,
      continuable: this.continuable,
      blockReason: this.blockReason,
    };
  }
}

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
    const activeIssue = Object.hasOwn(this.state, "issue") ? this.state.issue : null;
    if (expectation.issue != null && activeIssue !== expectation.issue) return false;
    if (expectation.issueAbsent && activeIssue !== null) return false;
    if (expectation.spec != null && this.specId !== expectation.spec) return false;
    return true;
  }

}

export class FlowTargetNotFoundError extends Error {
  constructor(expectation, matchCount) {
    const target = [
      expectation.runId && `runId ${expectation.runId}`,
      expectation.issue && `Issue #${expectation.issue}`,
      expectation.issueAbsent && "no Issue",
      expectation.spec && `spec ${expectation.spec}`,
    ].filter(Boolean).join(", ");
    super(matchCount > 1
      ? `explicit flow target is ambiguous: ${target}`
      : `explicit flow target not found: ${target}`);
    this.code = "FLOW_TARGET_NOT_FOUND";
    this.data = {
      matchCount,
      ...(expectation.runId != null && { expectedRunId: expectation.runId }),
      ...((expectation.issue != null || expectation.issueAbsent) && {
        expectedIssue: expectation.issue,
      }),
      ...(expectation.spec != null && { expectedSpec: expectation.spec }),
    };
  }
}

class ActiveFlowMismatchError extends Error {
  constructor(expectation, state) {
    const data = expectation.mismatchAgainst(state);
    super("managed worktree flow identity does not match the specified target");
    this.code = "ACTIVE_FLOW_MISMATCH";
    this.data = data;
  }
}

function recoveryCandidateRank(candidate) {
  if (candidate.state === "active") return 50;
  if (candidate.continuable) return 45;
  if (candidate.state === "finalized") return 40;
  if (candidate.state === "orphan-worktree") return 30;
  if (candidate.state === "stale") return 20;
  if (candidate.state === "branch-only") return 10;
  return 0;
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
    if (this._worktreeBinding) return this.#loadBoundWorktreeState(specId, false);
    return this._store.load(withSpecIdArgDefault(specId, this._boundSpecId));
  }
  loadReadOnly(specId) {
    if (this._worktreeBinding) return this.#loadBoundWorktreeState(specId, true);
    return this._store.loadReadOnly(withSpecIdArgDefault(specId, this._boundSpecId));
  }
  create(state, options) { return this._store.create(state, options); }
  saveAtomic(state, options = {}) {
    return this._store.saveAtomic(state, { ...options, boundSpecId: this._boundSpecId });
  }
  mutate(mutator, opts) { return this._store.mutate(mutator, withSpecIdDefault(opts, this._boundSpecId)); }
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

  updateStepStatus(stepId, status, opts) {
    return this._store.updateStepStatus(stepId, status, withSpecIdDefault(opts, this._boundSpecId));
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
  rewindPlan(request, evidence, opts) {
    return this._store.rewindPlan(request, evidence, withSpecIdDefault(opts, this._boundSpecId));
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
  addActiveFlow(specId, mode, options) { return this._activeFlows.add(specId, mode, options); }
  removeActiveFlow(specId, options) { return this._activeFlows.remove(specId, options); }
  cleanStaleFlows(options) { return this._activeFlows.cleanStale(options); }

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
    if (targets.length !== 1) throw new FlowTargetNotFoundError(expectation, targets.length);
    return targets[0];
  }

  resolveExplicitFlowTargetForRead(expectation) {
    if (!(expectation instanceof FlowTargetExpectation) || expectation.empty) {
      throw new Error("explicit flow target expectation is required");
    }
    const targets = this.#explicitFlowTargets();
    const matches = new Set();
    for (const target of targets) {
      const activeIssue = Object.hasOwn(target.state, "issue") ? target.state.issue : null;
      if (expectation.runId != null && target.state.runId === expectation.runId) matches.add(target);
      if (expectation.issue != null && activeIssue === expectation.issue) matches.add(target);
      if (expectation.issueAbsent && activeIssue === null) matches.add(target);
      if (expectation.spec != null && target.specId === expectation.spec) matches.add(target);
    }
    if (matches.size !== 1) throw new FlowTargetNotFoundError(expectation, matches.size);
    return [...matches][0];
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

  // ── cross-cutting ───────────────────────────────────────────────────────────

  /**
   * Scan all flow.json files across worktrees, branches, and local specs.
   * @returns {Array<{specId: string, mode: string|null, state: object|null, location: string}>}
   */
  scanAllFlows() {
    return this._scanAllFlowsResult().entries;
  }

  discoverRecoveryFlows() {
    const scan = this._scanAllFlowsResult();
    const activeSpecIds = new Set(this._activeFlows.load().map((entry) => entry.spec));
    const candidates = this._dedupeRecoveryCandidates(
      scan.entries.map((entry) => this._toRecoveryCandidate(entry, activeSpecIds)),
    );
    return {
      discovery: scan.toDiscoveryJSON(),
      candidates,
    };
  }

  _scanAllFlowsResult() {
    const mainRoot = this._mainRoot;
    const results = [];
    const seen = new Set();
    let truncated = false;

    const specsDir = path.join(mainRoot, "specs");
    if (fs.existsSync(specsDir)) {
      for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || !/^\d{3}-/.test(entry.name)) continue;
        if (results.length >= SCAN_FLOWS_LIMIT) { truncated = true; break; }
        const fp = flowStatePath(mainRoot, entry.name);
        if (fs.existsSync(fp)) {
          const state = JSON.parse(fs.readFileSync(fp, "utf8"));
          const mode = state.worktree ? "worktree" : (state.featureBranch && state.featureBranch !== state.baseBranch) ? "branch" : "local";
          results.push(new FlowScanEntry({ specId: entry.name, mode, state, location: mainRoot }));
        } else {
          results.push(new FlowScanEntry({ specId: entry.name, mode: null, state: null, location: mainRoot }));
        }
        seen.add(entry.name);
      }
    }

    if (!truncated) {
      const wtRes = runGit(["-C", mainRoot, "worktree", "list", "--porcelain"]);
      if (wtRes.ok) {
        const output = wtRes.stdout;
        let wtPath = null;
        outer: for (const line of output.split("\n")) {
          if (line.startsWith("worktree ")) {
            wtPath = line.slice("worktree ".length);
          } else if (line === "" && wtPath && wtPath !== mainRoot) {
            const wtSpecs = path.join(wtPath, "specs");
            if (fs.existsSync(wtSpecs)) {
              for (const entry of fs.readdirSync(wtSpecs, { withFileTypes: true })) {
                if (!entry.isDirectory()) continue;
                if (results.length >= SCAN_FLOWS_LIMIT) { truncated = true; break outer; }
                const fp = flowStatePath(wtPath, entry.name);
                if (fs.existsSync(fp)) {
                  const state = JSON.parse(fs.readFileSync(fp, "utf8"));
                  results.push(new FlowScanEntry({ specId: entry.name, mode: "worktree", state, location: wtPath }));
                  seen.add(entry.name);
                }
              }
            }
            wtPath = null;
          }
        }
      }
    }

    if (!truncated) {
      const branchRes = runGit(["-C", mainRoot, "branch", "--list", "feature/*"]);
      if (branchRes.ok) {
        for (const line of branchRes.stdout.split("\n")) {
          const branch = line.replace(/^[*+ ]+/, "").trim();
          if (!branch) continue;
          const specId = branch.replace("feature/", "");
          if (seen.has(specId)) continue;
          if (results.length >= SCAN_FLOWS_LIMIT) { truncated = true; break; }
          const showRes = runGit(
            ["-C", mainRoot, "show", `${branch}:specs/${specId}/flow.json`],
          );
          if (showRes.ok) {
            try {
              const state = JSON.parse(showRes.stdout);
              results.push(new FlowScanEntry({ specId, mode: "branch", state, location: `branch:${branch}` }));
              seen.add(specId);
            } catch (e) {
              process.stderr.write(`[senti] scanAllFlows: invalid JSON in ${branch}:specs/${specId}/flow.json: ${e.message}\n`);
            }
          }
        }
      }
    }

    if (truncated) {
      process.stderr.write(`[senti] scanAllFlows: truncated at ${SCAN_FLOWS_LIMIT} entries\n`);
    }

    return new FlowScanResult({ entries: results, truncated, limit: SCAN_FLOWS_LIMIT });
  }

  _dedupeRecoveryCandidates(candidates) {
    const deduped = [];
    const indexBySpec = new Map();
    for (const candidate of candidates) {
      const existingIndex = indexBySpec.get(candidate.specId);
      if (existingIndex == null) {
        indexBySpec.set(candidate.specId, deduped.length);
        deduped.push(candidate);
        continue;
      }
      if (recoveryCandidateRank(candidate) > recoveryCandidateRank(deduped[existingIndex])) {
        deduped[existingIndex] = candidate;
      }
    }
    return deduped;
  }

  _toRecoveryCandidate(entry, activeSpecIds) {
    const candidateState = this._recoveryStateFor(entry, activeSpecIds);
    return new RecoveryFlowCandidate({
      specId: entry.specId,
      state: candidateState,
      mode: entry.mode,
      flowState: entry.state,
      location: entry.location,
      executionRoot: this._recoveryExecutionRootFor(entry, candidateState),
    });
  }

  _recoveryStateFor(entry, activeSpecIds) {
    if (entry.state?.finalizedAt) return "finalized";
    if (activeSpecIds.has(entry.specId)) return "active";
    if (entry.mode === "worktree" && entry.location !== this._mainRoot) return "orphan-worktree";
    if (String(entry.location).startsWith("branch:")) return "branch-only";
    return "stale";
  }

  _recoveryExecutionRootFor(entry, candidateState) {
    if (candidateState === "active") {
      try {
        const resolved = this._loadActiveFlowState(entry.specId);
        return resolved?.worktreePath || this._mainRoot;
      } catch {
        return null;
      }
    }
    if (candidateState === "orphan-worktree" && fs.existsSync(entry.location)) {
      try {
        const manager = this.forRoot(entry.location, { specId: entry.specId });
        if (manager.usesWorktreeFlowBinding()) {
          const identity = manager.resolveWorktreeBinding();
          if (identity.specId !== entry.specId) return null;
          identity.assertFlowState(manager.load(entry.specId));
        } else {
          const state = manager.load(entry.specId);
          if (
            !state
            || specIdFromPath(state.spec) !== entry.specId
            || state.runId !== entry.state?.runId
          ) return null;
        }
        return entry.location;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Resolve the active flow for normal flow execution.
   *
   * This intentionally does not call scanAllFlows(). Branch/worktree discovery
   * is a recovery concern owned by resume-like commands; normal status,
   * next-action, and run commands must not be pulled toward stale branch or
   * orphan worktree flow.json files.
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
    if (flowState) {
      const specId = specIdFromPath(flowState.spec);
      let worktreePath = null;
      if (flowState.worktree) {
        const candidate = this._store.resolveWorktreePaths(flowState).worktreePath;
        if (candidate && fs.existsSync(candidate)) worktreePath = candidate;
      }
      return { state: flowState, specId, worktreePath };
    }

    const activeFlows = this._activeFlows.load();
    if (opts.selectRunId) {
      const resolved = this._resolveActiveFlowByState(
        activeFlows,
        (state) => state?.runId === opts.selectRunId,
      );
      if (resolved) return resolved;
      throw new Error(`runId '${opts.selectRunId}' is not in active flows`);
    }

    if (opts.selectSpecId) {
      const match = activeFlows.find((f) => f.spec === opts.selectSpecId);
      if (!match) {
        const known = activeFlows.map((f) => f.spec).join(", ") || "(none)";
        throw new Error(`spec '${opts.selectSpecId}' is not in active flows. Active: ${known}`);
      }
      const resolved = this._loadActiveFlowState(match.spec);
      if (resolved) return resolved;
      throw new Error(`spec '${opts.selectSpecId}' is registered as active but flow.json was not found`);
    }

    if (opts.selectIssue != null) {
      const issue = Number(opts.selectIssue);
      if (!Number.isSafeInteger(issue) || issue < 1) {
        throw new Error(`issue target must be a positive integer: ${opts.selectIssue}`);
      }
      const resolved = this._resolveActiveFlowByState(
        activeFlows,
        (state) => Number(state?.issue) === issue,
      );
      if (resolved) return resolved;
      throw new Error(`Issue #${issue} is not in active flows`);
    }

    if (opts.selectNoIssue === true) {
      const matches = this._resolveActiveFlowsByState(
        activeFlows,
        (state) => state?.issue == null,
      );
      if (matches.length === 1) return matches[0];
      throw new FlowTargetNotFoundError(
        new FlowTargetExpectation({ expectNoIssue: true }),
        matches.length,
      );
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
  _loadActiveFlowState(specId) {
    let state = this._store.load(specId);
    let worktreePath = null;

    // worktree mode: the flow.json lives inside the worktree, not main repo.
    // First check the active-flows registry to know whether to look there.
    if (!state) {
      const entry = this._activeFlows.load().find((f) => f.spec === specId);
      if (entry?.mode === "worktree") {
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
