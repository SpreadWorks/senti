/**
 * src/lib/flow-store.js
 *
 * Owns `specs/<NNN>/flow.json` — the per-spec state file.
 * Provides load / save / mutate primitives plus the targeted setter helpers.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { runGit } from "./git-helpers.js";
import { sddDir } from "./config.js";
import { STATE_FILE, specIdFromPath } from "./flow-helpers.js";

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
   * Load flow.json. Returns null if not found.
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
   * Read-only loader. Does NOT trigger transparent migration.
   */
  loadReadOnly(specId) {
    const p = specFlowPath(this._root, specId);
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (err) {
      process.stderr.write(`[sdd-forge] flow-store.loadReadOnly: malformed flow.json at ${p}: ${err.message}\n`);
      return null;
    }
  }

  save(state) {
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

  // ── targeted setters ────────────────────────────────────────────────────────

  updateStepStatus(stepId, status) {
    this.mutate((state) => {
      if (!state.steps) throw new Error("flow.json has no steps");
      const step = state.steps.find((s) => s.id === stepId);
      if (!step) throw new Error(`unknown step: ${stepId}`);
      step.status = status;
    });
  }

  setRequirements(descriptions) {
    this.mutate((state) => {
      state.requirements = descriptions.map((desc) => ({ desc, status: "pending" }));
    });
  }

  setTestSummary(summary) {
    this.mutate((state) => {
      if (!state.test) state.test = {};
      state.test.summary = summary;
    });
  }

  updateRequirement(index, status) {
    this.mutate((state) => {
      if (!state.requirements?.[index]) throw new Error(`requirement index out of range: ${index}`);
      state.requirements[index].status = status;
    });
  }

  setRequest(text) { this.mutate((state) => { state.request = text; }); }
  setIssue(issue) { this.mutate((state) => { state.issue = issue; }); }
  addNote(text) {
    this.mutate((state) => {
      if (!state.notes) state.notes = [];
      state.notes.push(text);
    });
  }

  incrementMetric(phase, counter) {
    if (!phase) return;
    try {
      this.mutate((state) => {
        if (!state.metrics) state.metrics = {};
        if (!state.metrics[phase]) state.metrics[phase] = {};
        state.metrics[phase][counter] = (state.metrics[phase][counter] || 0) + 1;
      });
    } catch (err) {
      // Metric increments are advisory; flow.json may not exist outside an
      // active flow (e.g. setup, help). Surface the reason rather than swallow.
      process.stderr.write(`[sdd-forge] metric increment skipped (${phase}.${counter}): ${err.message}\n`);
    }
  }

  accumulateAgentMetrics(phase, { usage, responseChars, model, durationMs } = {}) {
    if (!phase) return;
    try {
      this.mutate((state) => {
        if (!state.metrics) state.metrics = {};
        if (!state.metrics[phase]) state.metrics[phase] = {};
        const m = state.metrics[phase];

        if (usage) {
          if (!m.tokens) m.tokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
          m.tokens.input = (m.tokens.input || 0) + (usage.input_tokens || 0);
          m.tokens.output = (m.tokens.output || 0) + (usage.output_tokens || 0);
          m.tokens.cacheRead = (m.tokens.cacheRead || 0) + (usage.cache_read_tokens || 0);
          m.tokens.cacheCreation = (m.tokens.cacheCreation || 0) + (usage.cache_creation_tokens || 0);
          if (usage.cost_usd != null) {
            m.cost = (m.cost || 0) + usage.cost_usd;
          }
        }

        m.callCount = (m.callCount || 0) + 1;
        m.responseChars = (m.responseChars || 0) + (responseChars || 0);

        if (durationMs != null) {
          m.durationMs = (m.durationMs || 0) + durationMs;
        }

        if (model) {
          if (!m.models) m.models = {};
          m.models[model] = (m.models[model] || 0) + 1;
        }
      });
    } catch (err) {
      process.stderr.write(`[sdd-forge] failed to accumulate agent metrics: ${err.message}\n`);
    }
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
