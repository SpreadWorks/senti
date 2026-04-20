/**
 * src/lib/preparing-flow-store.js
 *
 * Manages `.sdd-forge/.active-flow.<runId>` — transient state files
 * created during the prepare phase before flow.json exists.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { sddDir } from "./config.js";
import {
  PREPARING_PREFIX,
  PREPARING_TTL_MS,
  PREPARING_SCAN_LIMIT,
  buildInitialSteps,
} from "./flow-helpers.js";

export class PreparingFlowStore {
  /**
   * @param {Object} opts
   * @param {string} opts.mainRoot
   */
  constructor({ mainRoot }) {
    this._mainRoot = mainRoot;
  }

  /** @returns {string} new runId */
  generateRunId() {
    return crypto.randomUUID();
  }

  /**
   * @param {string} runId
   * @param {object} [extra]
   * @returns {string} created file path
   */
  create(runId, extra = {}) {
    const dir = sddDir(this._mainRoot);
    fs.mkdirSync(dir, { recursive: true });
    const state = {
      runId,
      lifecycle: "preparing",
      spec: null,
      baseBranch: null,
      featureBranch: null,
      worktree: null,
      steps: buildInitialSteps({ tasks: [] }),
      requirements: [],
      tasks: [],
      currentTaskId: null,
      autoApprove: false,
      ...extra,
    };
    const p = path.join(dir, `${PREPARING_PREFIX}${runId}`);
    fs.writeFileSync(p, JSON.stringify(state, null, 2) + "\n", "utf8");
    return p;
  }

  /**
   * @param {string} runId
   * @returns {object|null}
   */
  load(runId) {
    const p = path.join(sddDir(this._mainRoot), `${PREPARING_PREFIX}${runId}`);
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (err) {
      console.error(`[flow-state] WARN: failed to read preparing flow ${runId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Resolve { issue, request } from CLI args and a preparing-flow file.
   * CLI values take precedence; empty CLI values fall back to preparing values.
   *
   * @param {string} runId - runId from --run-id, or empty when absent
   * @param {string} cliIssue
   * @param {string} cliRequest
   * @returns {{ issue: string, request: string }}
   */
  resolveInputs(runId, cliIssue, cliRequest) {
    let issue = cliIssue || "";
    let request = cliRequest || "";
    if (!runId) return { issue, request };

    const preparing = this.load(runId);
    if (!preparing) {
      throw new Error(`preparing flow not found for runId: ${runId}`);
    }
    if (!issue && preparing.issue != null) issue = String(preparing.issue);
    if (!request && preparing.request) request = preparing.request;
    return { issue, request };
  }

  /** @param {string} runId */
  delete(runId) {
    const p = path.join(sddDir(this._mainRoot), `${PREPARING_PREFIX}${runId}`);
    try { fs.unlinkSync(p); } catch (err) { if (err.code !== "ENOENT") throw err; }
  }

  /** @returns {string[]} runIds */
  list() {
    const dir = sddDir(this._mainRoot);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.startsWith(PREPARING_PREFIX))
      .map((f) => f.slice(PREPARING_PREFIX.length))
      .slice(0, PREPARING_SCAN_LIMIT);
  }

  /** @returns {string[]} deleted runIds */
  cleanStale() {
    const dir = sddDir(this._mainRoot);
    if (!fs.existsSync(dir)) return [];

    const now = Date.now();
    const deleted = [];
    const entries = fs.readdirSync(dir)
      .filter((f) => f.startsWith(PREPARING_PREFIX))
      .slice(0, PREPARING_SCAN_LIMIT);

    for (const f of entries) {
      const p = path.join(dir, f);
      try {
        const stat = fs.statSync(p);
        if (now - stat.mtimeMs > PREPARING_TTL_MS) {
          fs.unlinkSync(p);
          deleted.push(f.slice(PREPARING_PREFIX.length));
        }
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error(`[flow-state] WARN: stale cleanup failed for ${f}: ${err.message}`);
        }
      }
    }
    return deleted;
  }
}
