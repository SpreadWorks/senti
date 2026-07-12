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
import { STATE_FILE, SCAN_FLOWS_LIMIT, PREPARING_SCAN_LIMIT, specIdFromPath } from "./flow-helpers.js";
import { FlowTargetExpectation } from "./flow-target-guard.js";
import { findInProgressLeaf } from "../flow/lib/step-tree.js";

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
    if (expectation.issue != null && Number(this.state.issue) !== expectation.issue) return false;
    if (expectation.spec != null && this.specId !== expectation.spec) return false;
    return true;
  }
}

export class FlowTargetNotFoundError extends Error {
  constructor(expectation, matchCount) {
    const target = [
      expectation.runId && `runId ${expectation.runId}`,
      expectation.issue && `Issue #${expectation.issue}`,
      expectation.spec && `spec ${expectation.spec}`,
    ].filter(Boolean).join(", ");
    super(matchCount > 1
      ? `explicit flow target is ambiguous: ${target}`
      : `explicit flow target not found: ${target}`);
    this.code = "FLOW_TARGET_NOT_FOUND";
    this.data = {
      matchCount,
      ...(expectation.runId != null && { expectedRunId: expectation.runId }),
      ...(expectation.issue != null && { expectedIssue: expectation.issue }),
      ...(expectation.spec != null && { expectedSpec: expectation.spec }),
    };
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

export class FlowManager {
  /**
   * @param {Object} opts
   * @param {string}  opts.root        - work root (worktree path when in one)
   * @param {string}  opts.mainRoot    - main repo root
   * @param {boolean} opts.inWorktree
   * @param {string|null} [opts.specId]
   */
  constructor({ root, mainRoot, inWorktree, specId = null }) {
    this._root = root;
    this._mainRoot = mainRoot;
    this._inWorktree = inWorktree;
    this._boundSpecId = specId;
    this._activeFlows = new ActiveFlowRegistry({ mainRoot });
    this._preparing = new PreparingFlowStore({ mainRoot });
    this._store = new FlowStore({
      root,
      mainRoot,
      inWorktree,
      activeFlowsProvider: () => this._activeFlows,
    });
  }

  // ── flow.json (FlowStore) ───────────────────────────────────────────────────

  load(specId) {
    return this._store.load(withSpecIdArgDefault(specId, this._boundSpecId));
  }
  loadReadOnly(specId) {
    return this._store.loadReadOnly(withSpecIdArgDefault(specId, this._boundSpecId));
  }
  save(state) { return this._store.save(state); }
  mutate(mutator, opts) { return this._store.mutate(mutator, withSpecIdDefault(opts, this._boundSpecId)); }
  pathFor(specId) { return this._store.pathFor(withSpecIdArgDefault(specId, this._boundSpecId)); }
  pathForCurrent() { return this._store.pathForCurrent(); }
  rollbackLastRunIdMigration() { return this._store.rollbackLastRunIdMigration(); }
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
    });
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
  setIssue(issue, opts) { return this._store.setIssue(issue, withSpecIdDefault(opts, this._boundSpecId)); }
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
  addActiveFlow(specId, mode) { return this._activeFlows.add(specId, mode); }
  removeActiveFlow(specId) { return this._activeFlows.remove(specId); }
  cleanStaleFlows() { return this._activeFlows.cleanStale(); }

  /**
   * Clear the active-flow entry for a spec. If specId is omitted,
   * resolves it from the current context.
   */
  clearFlowState(specId) {
    if (!specId) {
      const flows = this._activeFlows.load();
      const current = this._store._resolveCurrentFlow(flows);
      if (!current) return;
      specId = current.spec;
    }
    this._activeFlows.remove(specId);
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
    const targets = [];
    for (const entry of this._activeFlows.load()) {
      const resolved = this._loadActiveFlowState(entry.spec);
      if (!resolved?.state) continue;
      const target = new ResolvedFlowTarget({
        state: resolved.state,
        specId: resolved.specId,
        worktreePath: resolved.worktreePath,
        authorityRoot: resolved.worktreePath || this._mainRoot,
      });
      if (target.matches(expectation)) targets.push(target);
    }
    for (const runId of this._preparing.list()) {
      const state = this._preparing.load(runId);
      if (!state) continue;
      const target = new ResolvedFlowTarget({
        state,
        authorityRoot: this._mainRoot,
        preparing: true,
      });
      if (target.matches(expectation)) targets.push(target);
    }
    if (targets.length !== 1) throw new FlowTargetNotFoundError(expectation, targets.length);
    return targets[0];
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
        const fp = path.join(specsDir, entry.name, STATE_FILE);
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
                const fp = path.join(wtSpecs, entry.name, STATE_FILE);
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
      const resolved = this._loadActiveFlowState(entry.specId);
      return resolved?.worktreePath || this._mainRoot;
    }
    if (candidateState === "orphan-worktree" && fs.existsSync(entry.location)) {
      return entry.location;
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
   * @returns {{ state: object, specId: string, worktreePath: string|null } | null}
   */
  resolveActiveFlow(flowState, opts = {}) {
    if (flowState) {
      const specId = specIdFromPath(flowState.spec);
      let worktreePath = null;
      if (flowState.worktree) {
        worktreePath = this._store.resolveWorktreePaths(flowState).worktreePath;
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
    for (const entry of activeFlows) {
      const resolved = this._loadActiveFlowState(entry.spec);
      if (resolved?.state && predicate(resolved.state)) return resolved;
    }
    return null;
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
          const wtStore = new FlowStore({
            root: probe,
            mainRoot: this._mainRoot,
            inWorktree: true,
            activeFlowsProvider: () => this._activeFlows,
          });
          state = wtStore.load(specId);
          if (state) worktreePath = probe;
        }
      }
    }

    if (state?.worktree && !worktreePath) {
      const resolved = this._store.resolveWorktreePaths(state);
      worktreePath = resolved.worktreePath;
      if (worktreePath && fs.existsSync(worktreePath)) {
        const wtStore = new FlowStore({
          root: worktreePath,
          mainRoot: this._mainRoot,
          inWorktree: true,
          activeFlowsProvider: () => this._activeFlows,
        });
        state = wtStore.load(specId) ?? state;
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
}
