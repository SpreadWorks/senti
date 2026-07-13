#!/usr/bin/env node
// Offline migration for historical step ids. Apply mode resolves the common
// repository authority and refuses to run while any worktree can be changing.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { FlowManager } from "../lib/flow-manager.js";
import { ONE_TO_ONE_STEP_RENAMES, renameFlowStateStepIds } from "../lib/step-id-rename.js";

const ONE_TO_ONE_TOKENS = Object.keys(ONE_TO_ONE_STEP_RENAMES).sort((a, b) => b.length - a.length);
const ACTIVE_FLOW_LIMIT = 1024 * 1024;

class RepositoryWorktree {
  constructor(worktreePath, branch = null) {
    this.path = path.resolve(worktreePath);
    this.branch = branch;
    Object.freeze(this);
  }
}

class RepositoryTopology {
  constructor(mainRoot, worktrees) {
    this.mainRoot = path.resolve(mainRoot);
    this.worktrees = Object.freeze(worktrees);
    Object.freeze(this);
  }
}

class MigrationPlan {
  constructor(root) {
    this.root = root;
    this.changes = [];
    this.flowSpecs = [];
    this.fileWrites = [];
  }

  change(file, from, to) {
    this.changes.push({ file, from, to });
  }

  flow(specId) {
    this.flowSpecs.push(specId);
  }

  file(filePath, content) {
    this.fileWrites.push({ filePath, content });
  }

  apply() {
    const manager = new FlowManager({
      root: this.root,
      mainRoot: this.root,
      inWorktree: false,
    });
    this.#preflight(manager);
    for (const specId of this.flowSpecs) {
      manager.mutate((state) => {
        const changes = renameFlowStateStepIds(state);
        if (changes.length === 0) throw new Error(`migration target changed before apply: ${specId}`);
      }, { specId, stepIdMigration: true });
    }
    for (const write of this.fileWrites) fs.writeFileSync(write.filePath, write.content);
  }

  #preflight(manager) {
    const complete = "step-id migration preflight complete";
    for (const specId of this.flowSpecs) {
      try {
        manager.mutate((state) => {
          const changes = renameFlowStateStepIds(state);
          if (changes.length === 0) throw new Error(`migration target changed before preflight: ${specId}`);
        }, {
          specId,
          stepIdMigration: true,
          faultInjector({ phase }) {
            if (phase === "before-state-temp-open") throw new Error(complete);
          },
        });
      } catch (error) {
        if (error.message === complete) continue;
        throw error;
      }
      throw new Error(`migration preflight unexpectedly wrote flow state: ${specId}`);
    }
  }
}

function replaceOneToOneTokens(text) {
  let out = text;
  for (const token of ONE_TO_ONE_TOKENS) {
    out = out.replace(new RegExp(`(?<![\\w-])${token}(?![\\w-])`, "g"), ONE_TO_ONE_STEP_RENAMES[token]);
  }
  return out;
}

function transformPathStrings(node, changes) {
  if (typeof node === "string") {
    if (!node.includes("/")) return node;
    const replaced = replaceOneToOneTokens(node);
    if (replaced !== node) changes.push({ from: node, to: replaced });
    return replaced;
  }
  if (Array.isArray(node)) return node.map((value) => transformPathStrings(value, changes));
  if (node && typeof node === "object") {
    const out = {};
    for (const [key, value] of Object.entries(node)) out[key] = transformPathStrings(value, changes);
    return out;
  }
  return node;
}

function transformMarkdownCode(text) {
  let out = text.replace(/```[\s\S]*?```/g, (block) => replaceOneToOneTokens(block));
  out = out.replace(/`[^`\n]+`/g, (span) => replaceOneToOneTokens(span));
  return out;
}

function runGit(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim() || "unknown error"}`);
  }
  return result.stdout;
}

function resolveRepositoryTopology(startRoot) {
  const porcelain = runGit(startRoot, ["worktree", "list", "--porcelain"]);
  const worktrees = [];
  let current = null;
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) worktrees.push(new RepositoryWorktree(current.path, current.branch));
      current = { path: line.slice("worktree ".length), branch: null };
    } else if (current && line.startsWith("branch refs/heads/")) {
      current.branch = line.slice("branch refs/heads/".length);
    }
  }
  if (current) worktrees.push(new RepositoryWorktree(current.path, current.branch));
  if (worktrees.length === 0) throw new Error("git worktree registry is empty");
  const mainRoot = worktrees[0].path;
  const commonDir = path.resolve(startRoot, runGit(startRoot, ["rev-parse", "--git-common-dir"]).trim());
  if (path.resolve(mainRoot, ".git") !== commonDir) {
    throw new Error("unable to resolve the common main worktree authority");
  }
  return new RepositoryTopology(mainRoot, worktrees);
}

function readActiveFlows(mainRoot) {
  const registryPath = path.join(mainRoot, ".senti", ".active-flow");
  let stat;
  try {
    stat = fs.lstatSync(registryPath);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(`active-flow registry is unreadable: ${error.message}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > ACTIVE_FLOW_LIMIT) {
    throw new Error("active-flow registry must be a bounded regular file");
  }
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  } catch (error) {
    throw new Error(`active-flow registry is malformed: ${error.message}`);
  }
  if (!Array.isArray(entries)) throw new Error("active-flow registry must contain an array");
  const seen = new Set();
  for (const entry of entries) {
    if (
      !entry || typeof entry !== "object"
      || typeof entry.spec !== "string" || entry.spec.trim() === ""
      || !["worktree", "branch", "local"].includes(entry.mode)
      || seen.has(entry.spec)
    ) {
      throw new Error("active-flow registry contains an invalid entry");
    }
    seen.add(entry.spec);
  }
  return entries;
}

function flowStateExists(root, specId) {
  try {
    const stat = fs.lstatSync(path.join(root, "specs", specId, "flow.json"));
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function assertRegistryConsistency(topology, activeFlows) {
  for (const entry of activeFlows) {
    if (entry.mode === "worktree") {
      const branch = `feature/${entry.spec}`;
      const match = topology.worktrees.find((worktree) => worktree.branch === branch);
      if (!match || !flowStateExists(match.path, entry.spec)) {
        throw new Error(`active-flow registry/worktree mismatch for ${entry.spec}`);
      }
    } else if (!flowStateExists(topology.mainRoot, entry.spec)) {
      throw new Error(`active-flow registry/main authority mismatch for ${entry.spec}`);
    }
  }
}

function assertNoWriterLocks(worktree) {
  const specsDir = path.join(worktree.path, "specs");
  if (!fs.existsSync(specsDir)) return;
  for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const lockPath = path.join(specsDir, entry.name, ".flow.json.writer.lock");
    if (fs.existsSync(lockPath)) throw new Error(`flow writer lock is present: ${lockPath}`);
  }
}

function assertApplySafety(topology) {
  const activeFlows = readActiveFlows(topology.mainRoot);
  assertRegistryConsistency(topology, activeFlows);
  for (const worktree of topology.worktrees) {
    assertNoWriterLocks(worktree);
    if (runGit(worktree.path, ["status", "--porcelain"]).trim() !== "") {
      throw new Error(`--apply requires every git worktree to be clean: ${worktree.path}`);
    }
  }
  if (activeFlows.length > 0) throw new Error("--apply refuses while any flow is active");
}

function readJson(filePath, label, strict) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (strict) throw new Error(`${label} is malformed or unreadable: ${error.message}`);
    return null;
  }
}

function planFlowJson(dir, id, plan, strict) {
  const flowPath = path.join(dir, "flow.json");
  if (!fs.existsSync(flowPath)) return;
  const state = readJson(flowPath, `specs/${id}/flow.json`, strict);
  if (!state) return;
  const changes = renameFlowStateStepIds(state);
  if (changes.length === 0) return;
  for (const change of changes) plan.change(`specs/${id}/flow.json`, change.from, change.to);
  plan.flow(id);
}

function planIssueLog(dir, id, plan) {
  const filePath = path.join(dir, "issue-log.json");
  if (!fs.existsSync(filePath)) return;
  const data = readJson(filePath, `specs/${id}/issue-log.json`, false);
  if (!data) return;
  const entries = Array.isArray(data) ? data : Array.isArray(data.entries) ? data.entries : null;
  if (!entries) return;
  let changed = false;
  for (const entry of entries) {
    if (entry && typeof entry.step === "string" && ONE_TO_ONE_STEP_RENAMES[entry.step]) {
      plan.change(`specs/${id}/issue-log.json`, `step: ${entry.step}`, `step: ${ONE_TO_ONE_STEP_RENAMES[entry.step]}`);
      entry.step = ONE_TO_ONE_STEP_RENAMES[entry.step];
      changed = true;
    }
  }
  if (changed) plan.file(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function planReportRetro(dir, id, plan) {
  for (const fileName of ["report.json", "retro.json"]) {
    const filePath = path.join(dir, fileName);
    if (!fs.existsSync(filePath)) continue;
    const data = readJson(filePath, `specs/${id}/${fileName}`, false);
    if (!data) continue;
    const changes = [];
    const output = transformPathStrings(data, changes);
    for (const change of changes) plan.change(`specs/${id}/${fileName}`, change.from, change.to);
    if (changes.length > 0) plan.file(filePath, `${JSON.stringify(output, null, 2)}\n`);
  }
}

function planReviewMarkdown(dir, id, plan) {
  const filePath = path.join(dir, "review.md");
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  const output = transformMarkdownCode(text);
  if (output === text) return;
  for (const [from, to] of Object.entries(ONE_TO_ONE_STEP_RENAMES)) {
    const token = new RegExp(`(?<![\\w-])${from}(?![\\w-])`);
    if (token.test(text) && !token.test(output)) plan.change(`specs/${id}/review.md`, `code/path: ${from}`, `code/path: ${to}`);
  }
  plan.file(filePath, output);
}

function buildPlan(root, strict) {
  const plan = new MigrationPlan(root);
  const specsDir = path.join(root, "specs");
  if (!fs.existsSync(specsDir)) return plan;
  const ids = fs.readdirSync(specsDir)
    .filter((id) => fs.statSync(path.join(specsDir, id)).isDirectory());
  for (const id of ids) {
    const dir = path.join(specsDir, id);
    planFlowJson(dir, id, plan, strict);
    planIssueLog(dir, id, plan);
    planReportRetro(dir, id, plan);
    planReviewMarkdown(dir, id, plan);
  }
  return plan;
}

function printPlan(plan, apply) {
  const header = apply
    ? `Applied ${plan.changes.length} change(s).`
    : `Dry-run diff - ${plan.changes.length} change(s); no files written (re-run with --apply):`;
  process.stdout.write(`${header}\n`);
  let lastFile = null;
  for (const change of plan.changes) {
    if (change.file !== lastFile) {
      process.stdout.write(`--- ${change.file}\n`);
      lastFile = change.file;
    }
    process.stdout.write(`  - ${change.from}\n  + ${change.to}\n`);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply") || args.filter((arg) => arg === "--apply").length > 1) {
    throw new Error(`unknown argument: ${args.find((arg) => arg !== "--apply") || "--apply"}`);
  }
  const apply = args.includes("--apply");
  const requestedRoot = path.resolve(process.env.SENTI_WORK_ROOT || process.cwd());
  let root = requestedRoot;
  if (apply) {
    const topology = resolveRepositoryTopology(requestedRoot);
    assertApplySafety(topology);
    root = topology.mainRoot;
  }
  const plan = buildPlan(root, apply);
  if (apply) plan.apply();
  printPlan(plan, apply);
}

try {
  main();
} catch (error) {
  process.stderr.write(`error: ${error.message}\n`);
  process.exitCode = 1;
}
