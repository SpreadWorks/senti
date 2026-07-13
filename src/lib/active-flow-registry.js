/**
 * src/lib/active-flow-registry.js
 *
 * Manages `.senti/.active-flow` — the pointer file listing currently
 * active Spec-Driven Development flows in this repository. Used by FlowManager.
 *
 * @typedef {Object} ActiveFlowEntry
 * @property {string} spec - spec ID (e.g. "086-migrate-flow-state")
 * @property {"worktree"|"branch"|"local"} mode
 */

import fs from "fs";
import path from "path";
import { sentiDir } from "./config.js";
import { runGit } from "./git-helpers.js";
import { ACTIVE_FLOW_FILE } from "./flow-helpers.js";
import { flowStatePath } from "./flow-state-atomic-writer.js";
import { AtomicJsonFile } from "./atomic-json-file.js";

function activeFlowPath(mainRoot) {
  return path.join(sentiDir(mainRoot), ACTIVE_FLOW_FILE);
}

function readActiveFlowAuthority(filePath) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs.realpathSync(filePath) !== path.resolve(filePath)) {
    throw new Error(`active-flow authority must be one real non-hardlinked file: ${filePath}`);
  }
  const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(value)) throw new Error(`active-flow authority must contain an array: ${filePath}`);
  return value;
}

function removeDurably(filePath) {
  fs.unlinkSync(filePath);
  const descriptor = fs.openSync(path.dirname(filePath), "r");
  let primaryError = null;
  try {
    fs.fsyncSync(descriptor);
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch (cleanupError) {
      if (primaryError) {
        throw new AggregateError(
          [primaryError, cleanupError],
          `active-flow removal durability and descriptor cleanup both failed: ${filePath}`,
          { cause: primaryError },
        );
      }
      throw cleanupError;
    }
  }
  if (primaryError) throw primaryError;
}

function runGitFailOpenBoolean(args, predicate, contextLabel) {
  const res = runGit(args);
  if (!res.ok) {
    process.stderr.write(`[senti] ${contextLabel}: git ${args.join(" ")} failed, assuming exists: ${res.stderr}\n`);
    return true;
  }
  return predicate(res.stdout);
}

function worktreeExists(mainRoot, branch) {
  return runGitFailOpenBoolean(
    ["-C", mainRoot, "worktree", "list", "--porcelain"],
    (stdout) => stdout.includes(`branch refs/heads/${branch}`),
    "worktreeExists",
  );
}

function branchExists(mainRoot, branch) {
  return runGitFailOpenBoolean(
    ["-C", mainRoot, "branch", "--list", branch],
    (stdout) => stdout.trim().length > 0,
    "branchExists",
  );
}

export class ActiveFlowRegistry {
  /**
   * @param {Object} opts
   * @param {string} opts.mainRoot - main repo root (resolved from worktree if applicable)
   */
  constructor({ mainRoot }) {
    this._mainRoot = mainRoot;
  }

  /** @returns {ActiveFlowEntry[]} */
  load() {
    const p = activeFlowPath(this._mainRoot);
    if (!fs.existsSync(p)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error(`[flow-state] WARN: failed to parse .active-flow (${p}): ${err.message}`);
      }
      return [];
    }
  }

  /**
   * @param {string} specId
   * @param {"worktree"|"branch"|"local"} mode
   */
  add(specId, mode) {
    const flows = this.load();
    if (flows.some((f) => f.spec === specId)) return;
    flows.push({ spec: specId, mode });
    const p = activeFlowPath(this._mainRoot);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(flows, null, 2) + "\n", "utf8");
  }

  /**
   * @param {string} specId
   */
  remove(specId) {
    const p = activeFlowPath(this._mainRoot);
    const flows = readActiveFlowAuthority(p);
    if (flows == null) return;
    const filtered = flows.filter((f) => f.spec !== specId);
    if (filtered.length === 0) {
      removeDurably(p);
      return;
    }
    new AtomicJsonFile(p).write(filtered);
  }

  /**
   * Remove stale entries from .active-flow.
   * @returns {ActiveFlowEntry[]} cleaned active flows
   */
  cleanStale() {
    const flows = this.load();
    if (flows.length === 0) return [];

    const valid = [];
    for (const entry of flows) {
      const branch = `feature/${entry.spec}`;
      let isStale = false;

      if (entry.mode === "worktree") {
        isStale = !worktreeExists(this._mainRoot, branch);
      } else if (entry.mode === "branch") {
        isStale = !branchExists(this._mainRoot, branch);
      } else {
        isStale = !fs.existsSync(flowStatePath(this._mainRoot, entry.spec));
      }

      if (!isStale) valid.push(entry);
    }

    if (valid.length !== flows.length) {
      const p = activeFlowPath(this._mainRoot);
      if (valid.length === 0) {
        try { fs.unlinkSync(p); } catch (err) { if (err.code !== "ENOENT") console.error(err); }
      } else {
        fs.writeFileSync(p, JSON.stringify(valid, null, 2) + "\n", "utf8");
      }
    }

    return valid;
  }
}
