/**
 * src/lib/flow-manager.js
 *
 * Facade for SDD flow state management. Owns:
 *   - FlowStore             : specs/<NNN>/flow.json I/O + mutations
 *   - ActiveFlowRegistry    : .sdd-forge/.active-flow pointer
 *   - PreparingFlowStore    : .sdd-forge/.active-flow.<runId> transient state
 *
 * Constructed once per CLI process by `container.js` with paths already
 * resolved by Container — no `workRoot` argument is needed on any method.
 */

import fs from "fs";
import path from "path";
import { runGit } from "./git-helpers.js";
import { sddDir } from "./config.js";
import { FlowStore } from "./flow-store.js";
import { withSpecIdArgDefault, withSpecIdDefault } from "./flow-options.js";
import { ActiveFlowRegistry } from "./active-flow-registry.js";
import { PreparingFlowStore } from "./preparing-flow-store.js";
import { STATE_FILE, SCAN_FLOWS_LIMIT, PREPARING_SCAN_LIMIT, specIdFromPath } from "./flow-helpers.js";
import { findInProgressLeaf } from "../flow/definition.js";

// Pointer written by `flow run finalize-cleanup` (and read by `flow report
// show`) to mark the last spec that completed cleanup. Stored relative to the
// main repo root.
const LAST_FINALIZED_SPEC_REL_PATH = path.join(".sdd-forge", "last-finalized-spec");

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

  updateStepStatus(stepId, status, opts) { return this._store.updateStepStatus(stepId, status, opts); }
  setStepRuntimeLog(stepId, runtimeLog, opts) {
    return this._store.setStepRuntimeLog(stepId, runtimeLog, withSpecIdDefault(opts, this._boundSpecId));
  }
  setMergeOutcome(outcome, opts) { return this._store.setMergeOutcome(outcome, opts); }
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
  addTask(task) { return this._store.addTask(task); }

  /** Mark a task done; clears currentTaskId if it pointed at this task. */
  completeTask(taskId) {
    return this._store.completeTask(taskId);
  }

  /** Get the current task object or null. */
  getCurrentTask() {
    const state = this._store.load();
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
  setCurrentTaskStep(stepId, status) {
    return this._store.setCurrentTaskStep(stepId, status);
  }

  /**
   * Resolve the current flow context for logging / metric accumulation.
   * Returns { spec, sddPhase } derived from the active flow.json; both are
   * null when no active flow is present (expected outside SDD contexts).
   */
  resolveCurrentContext() {
    const state = this._store.load();
    if (!state) return { spec: null, sddPhase: null, taskId: null };
    const spec = specIdFromPath(state.spec) ?? null;
    const inProgress = findInProgressLeaf(state.steps);
    const sddPhase = inProgress?.id ?? null;
    const taskId = state.currentTaskId ?? null;
    return { spec, sddPhase, taskId };
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
  cleanStalePreparingFlows() { return this._preparing.cleanStale(); }
  pruneStalePreparingFlowsAndList() { return this._preparing.pruneStaleAndList(); }

  // ── cross-cutting ───────────────────────────────────────────────────────────

  /**
   * Scan all flow.json files across worktrees, branches, and local specs.
   * @returns {Array<{specId: string, mode: string|null, state: object|null, location: string}>}
   */
  scanAllFlows() {
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
          results.push({ specId: entry.name, mode, state, location: mainRoot });
        } else {
          results.push({ specId: entry.name, mode: null, state: null, location: mainRoot });
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
                if (!entry.isDirectory() || seen.has(entry.name)) continue;
                if (results.length >= SCAN_FLOWS_LIMIT) { truncated = true; break outer; }
                const fp = path.join(wtSpecs, entry.name, STATE_FILE);
                if (fs.existsSync(fp)) {
                  const state = JSON.parse(fs.readFileSync(fp, "utf8"));
                  results.push({ specId: entry.name, mode: "worktree", state, location: wtPath });
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
              results.push({ specId, mode: "branch", state, location: `branch:${branch}` });
              seen.add(specId);
            } catch (e) {
              process.stderr.write(`[sdd-forge] scanAllFlows: invalid JSON in ${branch}:specs/${specId}/flow.json: ${e.message}\n`);
            }
          }
        }
      }
    }

    if (truncated) {
      process.stderr.write(`[sdd-forge] scanAllFlows: truncated at ${SCAN_FLOWS_LIMIT} entries\n`);
    }

    return results;
  }

  /**
   * Read the spec id stored in `.sdd-forge/last-finalized-spec` (if any).
   * Returns null when the pointer file does not exist or is empty.
   *
   * Post-cleanup, `.active-flow` is empty and this pointer holds the spec
   * that just completed cleanup. Callers use it to avoid re-activating a
   * spec whose flow.json still exists on main but is no longer in progress.
   */
  _readLastFinalizedSpecId() {
    const pointerPath = path.join(this._mainRoot, LAST_FINALIZED_SPEC_REL_PATH);
    if (!fs.existsSync(pointerPath)) return null;
    const specRel = fs.readFileSync(pointerPath, "utf8").trim();
    if (!specRel) return null;
    return specIdFromPath(specRel);
  }

  /**
   * 3-stage fallback to resolve the single active flow.
   *
   * @param {object|null} flowState - pre-loaded flow state (may be null)
   * @param {object} [opts]
   * @param {string} [opts.selectSpecId] - explicit spec to disambiguate when
   *   multiple flows are active concurrently
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

    if (activeFlows.length === 1) {
      const resolved = this._loadActiveFlowState(activeFlows[0].spec);
      if (resolved) return resolved;
    } else if (activeFlows.length > 1) {
      throw new Error(
        `multiple active flows: ${activeFlows.map((f) => `${f.spec} (${f.mode})`).join(", ")}. Pass --spec <specId> to select one.`,
      );
    }

    const allFlows = this.scanAllFlows();
    const lastFinalizedSpec = this._readLastFinalizedSpecId();
    const active = allFlows.filter((f) => {
      if (f.state == null) return false;
      // Post-cleanup specs remain on disk (committed to main) but are no
      // longer active. Skip them so resume / get-status correctly report
      // active:false.
      if (lastFinalizedSpec && f.specId === lastFinalizedSpec) return false;
      return true;
    });
    if (active.length === 1) {
      const { specId, state, location } = active[0];
      const worktreePath = state.worktree ? location : null;
      return { state, specId, worktreePath };
    } else if (active.length > 1) {
      throw new Error(
        `multiple active flows: ${active.map((f) => `${f.specId} (${f.mode})`).join(", ")}`,
      );
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
        const probe = path.join(sddDir(this._mainRoot), "worktree", `feature-${specId}`);
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
      const state = this._store.loadReadOnly(activeFlows[i].spec);
      if (state?.runId === runId) return state;
    }
    const preparing = this._preparing.load(runId);
    if (preparing) return preparing;
    return null;
  }
}
