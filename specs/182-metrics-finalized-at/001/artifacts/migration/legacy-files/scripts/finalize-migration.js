#!/usr/bin/env node
/**
 * One-shot backfill: populate `state.finalizedAt` for every existing
 * `specs/<spec>/flow.json` that lacks it.
 *
 * Invoked exactly once — during `sdd-forge flow run finalize` of spec
 * 182-metrics-finalized-at — via the generic pre-commit migration hook.
 *
 * Idempotency guard: if every existing flow.json already has
 * `state.finalizedAt` (i.e. backfill was already applied), the script
 * logs and exits without any writes. This makes accidental re-invocation
 * a no-op.
 *
 * Data source priority:
 *   1. Merge timestamp on the main branch (`git log --first-parent`)
 *   2. Spec's first-added timestamp (`git log --diff-filter=A`)
 *
 * Specs whose timestamp cannot be resolved are left untouched (metrics
 * token will skip them with a warning post-rollout).
 */

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const repoRoot = process.cwd();
const specsDir = path.join(repoRoot, "specs");

// Hard upper bound to guard against a runaway scan on a corrupt specs/ tree.
const MAX_SPECS = 5000;

// Persistent one-time-execution marker. Written after a successful backfill
// and committed alongside the flow.json updates, so re-invocations (including
// on another clone or later checkout) see the marker and exit immediately.
const MARKER_PATH = path.join(
  repoRoot,
  "specs",
  "182-metrics-finalized-at",
  "scripts",
  ".backfill-done",
);

async function git(args) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return stdout.trim();
  } catch (err) {
    // Log and surface absence as empty string — callers then try the next
    // lookup strategy. Failure is an expected, non-fatal condition here
    // (e.g., a spec with no merge commit on main yet).
    console.error(`[backfill] git ${args.join(" ")} failed: ${err.message}`);
    return "";
  }
}

async function resolveMergeDate(specRelDir) {
  const out = await git([
    "log", "--first-parent", "main", "--format=%aI", "--", specRelDir,
  ]);
  if (!out) return null;
  const lines = out.split("\n").filter(Boolean);
  return lines[lines.length - 1] || null;
}

async function resolveFirstAddedDate(specRelDir) {
  const specMd = path.posix.join(specRelDir, "spec.md");
  const out = await git([
    "log", "--diff-filter=A", "--format=%aI", "--", specMd,
  ]);
  if (!out) return null;
  const lines = out.split("\n").filter(Boolean);
  return lines[lines.length - 1] || null;
}

function toIsoUtcZ(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function processFlow(flowPath, specRelDir) {
  const text = await fs.readFile(flowPath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error(`[backfill] skip (invalid JSON): ${flowPath}: ${err.message}`);
    return { status: "invalid" };
  }
  if (parsed?.state?.finalizedAt) return { status: "already" };

  const merge = await resolveMergeDate(specRelDir);
  const added = merge ? null : await resolveFirstAddedDate(specRelDir);
  const raw = merge || added;
  if (!raw) {
    console.error(`[backfill] unresolved: ${specRelDir}`);
    return { status: "unresolved" };
  }
  const iso = toIsoUtcZ(raw);
  if (!iso) {
    console.error(`[backfill] invalid timestamp: ${raw} for ${specRelDir}`);
    return { status: "invalid-ts" };
  }

  if (!parsed.state || typeof parsed.state !== "object") parsed.state = {};
  parsed.state.finalizedAt = iso;
  await fs.writeFile(flowPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");
  return { status: "updated", iso, source: merge ? "merge" : "added" };
}

async function collectFlowPaths() {
  if (!existsSync(specsDir)) return [];
  const paths = [];
  for (const entry of await fs.readdir(specsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const specRelDir = path.posix.join("specs", entry.name);
    const flowPath = path.join(repoRoot, specRelDir, "flow.json");
    if (existsSync(flowPath)) paths.push({ flowPath, specRelDir });
    if (paths.length > MAX_SPECS) {
      throw new Error(`spec count exceeds MAX_SPECS (${MAX_SPECS}) — aborting backfill`);
    }
  }
  return paths;
}

async function main() {
  if (!existsSync(specsDir)) {
    console.error(`[backfill] specs dir not found: ${specsDir}`);
    process.exit(1);
  }

  // Persistent one-time marker: if already executed, exit immediately.
  if (existsSync(MARKER_PATH)) {
    console.log(`[backfill] marker present at ${MARKER_PATH} — skipping`);
    return;
  }

  const flows = await collectFlowPaths();

  // Single pass: processFlow short-circuits on specs that already have
  // finalizedAt (status: "already"). If every spec returns "already",
  // the no-op idempotency guard holds naturally.
  const tallies = { updated: 0, already: 0, unresolved: 0, invalid: 0, "invalid-ts": 0 };
  for (const { flowPath, specRelDir } of flows) {
    const res = await processFlow(flowPath, specRelDir);
    tallies[res.status] = (tallies[res.status] || 0) + 1;
  }

  if (tallies.updated === 0 && tallies.already === flows.length && flows.length > 0) {
    console.log("[backfill] all flow.json already have state.finalizedAt — nothing to do");
    return;
  }

  console.log(`[backfill] updated=${tallies.updated} already=${tallies.already} unresolved=${tallies.unresolved} invalid=${tallies.invalid + tallies["invalid-ts"]}`);

  if (tallies.updated === 0 && tallies.already === 0) {
    console.error("[backfill] no specs processed — aborting finalize");
    process.exit(1);
  }

  await fs.writeFile(
    MARKER_PATH,
    `backfilled at ${new Date().toISOString()}\n`,
    "utf8",
  );
}

main().catch((err) => {
  console.error(`[backfill] fatal: ${err.message}`);
  process.exit(1);
});
