#!/usr/bin/env node
/**
 * One-shot migration script for spec 227.
 *
 * Populates `tasks: []` (empty) in every flow.json with a single synthesized
 * "T-legacy" task derived from the flow-level steps.  After this migration,
 * FlowStore.load can reject empty tasks (T-A2) and get-next-action can drop
 * its flat-fallback path (T-A3).
 *
 * Idempotent: re-running on already-migrated files produces no changes.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SPECS_DIR = path.join(REPO_ROOT, "specs");

function inferTaskStatus(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return "pending";
  const allDone = steps.every((s) => s.status === "done" || s.status === "skipped");
  if (allDone) return "done";
  if (steps.some((s) => s.status === "in_progress")) return "in_progress";
  return "pending";
}

const TASK_STEP_IDS = ["write-tests", "implement", "gate-impl"];

function buildTaskSteps(flowSteps) {
  return TASK_STEP_IDS.map((id) => {
    const flowStep = flowSteps.find((s) => s.id === id);
    return { id, status: flowStep?.status === "done" ? "done" : "pending" };
  });
}

export function migrateFlowTasks(state) {
  const next = structuredClone(state);

  if (!Array.isArray(next.tasks) || next.tasks.length > 0) {
    return { state: next, changed: false };
  }

  const taskStatus = inferTaskStatus(next.steps);
  next.tasks = [{
    id: "T-legacy",
    title: "Legacy flow (migrated)",
    goal: "Pre-forest flow migrated to single-task format by spec 227.",
    parent: null,
    origin: "plan",
    added_round: 0,
    status: taskStatus,
    steps: buildTaskSteps(next.steps || []),
  }];

  if (taskStatus === "in_progress" || taskStatus === "done") {
    next.currentTaskId = "T-legacy";
  }

  return { state: next, changed: true };
}

async function readJson(p) {
  return JSON.parse(await fs.promises.readFile(p, "utf8"));
}

async function writeJson(p, obj) {
  await fs.promises.writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

async function listSpecDirs(root) {
  return (await fs.promises.readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => path.join(root, e.name))
    .sort();
}

const MAX_SPEC_DIRS = 10000;

export async function runMigration({ dryRun = false } = {}) {
  const allDirs = await listSpecDirs(SPECS_DIR);
  if (allDirs.length > MAX_SPEC_DIRS) {
    throw new Error(`spec directory count ${allDirs.length} exceeds maximum ${MAX_SPEC_DIRS}`);
  }
  const specDirs = allDirs;
  const summary = {
    scanned: specDirs.length,
    migrated: 0,
    noop: 0,
    error: 0,
    changes: [],
    errors: [],
  };

  for (const dir of specDirs) {
    const rel = path.relative(REPO_ROOT, dir);
    const flowPath = path.join(dir, "flow.json");
    try {
      await fs.promises.access(flowPath);
    } catch {
      summary.noop += 1;
      continue;
    }
    try {
      const state = await readJson(flowPath);
      const { state: migrated, changed } = migrateFlowTasks(state);
      if (!changed) {
        summary.noop += 1;
        continue;
      }
      if (!dryRun) await writeJson(flowPath, migrated);
      summary.migrated += 1;
      summary.changes.push(`${dryRun ? "would " : ""}migrate ${rel}/flow.json`);
    } catch (err) {
      summary.error += 1;
      summary.errors.push(`${rel}/flow.json: ${err.message}`);
    }
  }

  return summary;
}

function printSummary(s, { dryRun }) {
  const lines = [];
  lines.push(`== migrate-empty-tasks ${dryRun ? "(dry-run)" : "apply"} ==`);
  if (s.changes.length) {
    lines.push(`-- ${dryRun ? "planned" : "applied"} changes (${s.changes.length}) --`);
    for (const c of s.changes) lines.push(`  ${c}`);
  } else {
    lines.push("(no changes)");
  }
  if (s.errors.length) {
    lines.push(`\n-- errors (${s.errors.length}) --`);
    for (const e of s.errors) lines.push(`  ${e}`);
  }
  lines.push(`\n-- summary --`);
  lines.push(`scanned: ${s.scanned}, migrated: ${s.migrated}, no-op: ${s.noop}, error: ${s.error}`);
  process.stdout.write(lines.join("\n") + "\n");
}

function isMain() {
  return path.resolve(process.argv[1] ?? "") === __filename;
}

if (isMain()) {
  const dryRun = process.argv.includes("--dry-run");
  if (process.argv.includes("-h") || process.argv.includes("--help")) {
    process.stderr.write("Usage: node specs/227-post-226-forest-integration/migrate.js [--dry-run]\n");
    process.exit(0);
  }
  runMigration({ dryRun }).then((summary) => {
    printSummary(summary, { dryRun });
    process.exit(summary.errors.length === 0 ? 0 : 1);
  });
}
