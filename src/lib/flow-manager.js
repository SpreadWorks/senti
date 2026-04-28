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
import { FlowStore } from "./flow-store.js";
import { ActiveFlowRegistry } from "./active-flow-registry.js";
import { PreparingFlowStore } from "./preparing-flow-store.js";
import { STATE_FILE, SCAN_FLOWS_LIMIT, PREPARING_SCAN_LIMIT, specIdFromPath } from "./flow-helpers.js";
import { findInProgressLeaf } from "../flow/definition.js";

export class FlowManager {
  /**
   * @param {Object} opts
   * @param {string}  opts.root        - work root (worktree path when in one)
   * @param {string}  opts.mainRoot    - main repo root
   * @param {boolean} opts.inWorktree
   */
  constructor({ root, mainRoot, inWorktree }) {
    this._root = root;
    this._mainRoot = mainRoot;
    this._inWorktree = inWorktree;
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

  load(specId) { return this._store.load(specId); }
  loadReadOnly(specId) { return this._store.loadReadOnly(specId); }
  save(state) { return this._store.save(state); }
  mutate(mutator) { return this._store.mutate(mutator); }
  pathFor(specId) { return this._store.pathFor(specId); }
  pathForCurrent() { return this._store.pathForCurrent(); }
  /** Alias preserved for parity with the legacy `flowStatePath` public export. */
  flowStatePath() { return this._store.pathForCurrent(); }
  resolveWorktreePaths(state) { return this._store.resolveWorktreePaths(state); }
  saveFinalizedAt(specId, iso) { return this._store.saveFinalizedAt(specId, iso); }

  /**
   * Construct a FlowManager scoped to a different root (e.g. a freshly-created
   * worktree). The new instance owns its own paths — callers should not pass
   * paths to its methods.
   */
  forRoot(root) {
    return new FlowManager({ root, mainRoot: this._mainRoot, inWorktree: root !== this._mainRoot });
  }

  updateStepStatus(stepId, status, opts) { return this._store.updateStepStatus(stepId, status, opts); }
  setTestSummary(summary, opts) { return this._store.setTestSummary(summary, opts); }
  setRequest(text) { return this._store.setRequest(text); }
  setIssue(issue) { return this._store.setIssue(issue); }
  addNote(text, opts) { return this._store.addNote(text, opts); }
  incrementMetric(phase, counter, opts) { return this._store.incrementMetric(phase, counter, opts); }
  appendMetric(payload, opts) { return this._store.appendMetric(payload, opts); }
  accumulateAgentMetrics(phase, options) {
    return this._store.accumulateAgentMetrics(phase, options);
  }

  // ── task primitives (cac6/T2) ───────────────────────────────────────────────

  /** Add a new task and set it as the current task. */
  addTask(task) { return this._store.addTask(task); }

  /** Mark a task done; clears currentTaskId if it pointed at this task. */
  completeTask(taskId) { return this._store.completeTask(taskId); }

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
   * 3-stage fallback to resolve the single active flow.
   *
   * @param {object|null} flowState - pre-loaded flow state (may be null)
   * @returns {{ state: object, specId: string, worktreePath: string|null } | null}
   */
  resolveActiveFlow(flowState) {
    if (flowState) {
      const specId = specIdFromPath(flowState.spec);
      let worktreePath = null;
      if (flowState.worktree) {
        worktreePath = this._store.resolveWorktreePaths(flowState).worktreePath;
      }
      return { state: flowState, specId, worktreePath };
    }

    const activeFlows = this._activeFlows.load();
    if (activeFlows.length === 1) {
      const specId = activeFlows[0].spec;
      let state = this._store.load(specId);
      let worktreePath = null;
      if (state?.worktree) {
        const resolved = this._store.resolveWorktreePaths(state);
        worktreePath = resolved.worktreePath;
        if (worktreePath && fs.existsSync(worktreePath)) {
          // Re-load from the worktree's own specs/ dir.
          const wtStore = new FlowStore({
            root: worktreePath,
            mainRoot: this._mainRoot,
            inWorktree: true,
            activeFlowsProvider: () => this._activeFlows,
          });
          state = wtStore.load(specId) ?? state;
        }
      }
      if (state) return { state, specId, worktreePath };
    } else if (activeFlows.length > 1) {
      throw new Error(
        `multiple active flows: ${activeFlows.map((f) => `${f.spec} (${f.mode})`).join(", ")}`,
      );
    }

    const allFlows = this.scanAllFlows();
    const active = allFlows.filter((f) => f.state != null);
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
