#!/usr/bin/env node
/**
 * specs/167-metrics-token-difficulty/fill-flow-counts.js
 *
 * Fill missing reviewCount / redoCount / qaCount / requestChars fields
 * in specs/<id>/flow.json.
 *
 * reviewCount source:
 *   specs/<spec>/review.md
 *   Count only numbered review items: `### [ ] 1. ...` / `### [x] 2. ...`
 *
 * redoCount source:
 *   specs/<spec>/issue-log.json entries.length
 *
 * qaCount source (when flow.metrics.draft.question is missing):
 *   specs/<spec>/qa.md count of list items starting with "- Q:"
 *
 * requestChars source (when flow.requestChars is missing):
 *   flow.request.length
 *
 * This script only fills missing values and does not overwrite existing values.
 */

import fs from "node:fs";
import path from "node:path";

function usage() {
  return [
    "Usage:",
    "  node specs/167-metrics-token-difficulty/fill-flow-counts.js --spec <spec-id>",
    "  node specs/167-metrics-token-difficulty/fill-flow-counts.js --all",
    "",
    "Options:",
    "  --spec <id>   Update only specs/<id>/flow.json",
    "  --all         Update all specs/*/flow.json",
    "  --dry-run     Print changes without writing files",
    "  -h, --help    Show this help",
  ].join("\n");
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function findRepoRoot(startDir) {
  let dir = startDir;
  for (;;) {
    if (fs.existsSync(path.join(dir, "specs")) && fs.existsSync(path.join(dir, "src"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("repo root not found (expected both specs/ and src/)");
}

function parseArgs(argv) {
  let specId = null;
  let all = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") return { help: true };
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--spec") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) fail("missing value for --spec");
      specId = next;
      i += 1;
      continue;
    }
    fail(`unknown option: ${arg}`);
  }

  if (all && specId) fail("use either --all or --spec, not both");
  if (!all && !specId) fail("either --all or --spec is required");

  return { help: false, all, specId, dryRun };
}

function readJson(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return JSON.parse(text);
}

function countReviewItems(reviewMdPath) {
  if (!fs.existsSync(reviewMdPath)) return 0;
  const text = fs.readFileSync(reviewMdPath, "utf8");
  const matches = text.match(/^###\s+\[(?: |x)\]\s+\d+\.\s+/gm);
  return matches ? matches.length : 0;
}

function countIssueLogEntries(issueLogPath) {
  if (!fs.existsSync(issueLogPath)) return 0;
  const parsed = readJson(issueLogPath);
  if (!parsed || !Array.isArray(parsed.entries)) return 0;
  return parsed.entries.length;
}

function countQaItems(qaMdPath) {
  if (!fs.existsSync(qaMdPath)) return 0;
  const text = fs.readFileSync(qaMdPath, "utf8");
  const matches = text.match(/^\s*-\s*Q:/gm);
  return matches ? matches.length : 0;
}

function listTargetSpecs(specsDir, args) {
  if (args.all) {
    return fs.readdirSync(specsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  }
  return [args.specId];
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function updateFlow(specDir, dryRun) {
  const flowPath = path.join(specDir, "flow.json");
  if (!fs.existsSync(flowPath)) {
    return { specId: path.basename(specDir), skipped: "flow.json not found" };
  }

  const flow = readJson(flowPath);
  const reviewMdPath = path.join(specDir, "review.md");
  const issueLogPath = path.join(specDir, "issue-log.json");
  const qaMdPath = path.join(specDir, "qa.md");

  const reviewItemCount = countReviewItems(reviewMdPath);
  const redoCount = countIssueLogEntries(issueLogPath);
  const qaCount = countQaItems(qaMdPath);
  const requestChars = typeof flow.request === "string" ? flow.request.length : null;

  let changed = false;
  const updates = [];

  if (!flow.reviewCount || typeof flow.reviewCount !== "object") {
    flow.reviewCount = { spec: reviewItemCount, test: 0, impl: 0 };
    changed = true;
    updates.push(`reviewCount={spec:${reviewItemCount},test:0,impl:0}`);
  } else {
    for (const key of ["spec", "test", "impl"]) {
      if (!Number.isFinite(flow.reviewCount[key])) {
        flow.reviewCount[key] = key === "spec" ? reviewItemCount : 0;
        changed = true;
        updates.push(`reviewCount.${key}=${flow.reviewCount[key]}`);
      }
    }
  }

  if (!Number.isFinite(flow.redoCount)) {
    flow.redoCount = redoCount;
    changed = true;
    updates.push(`redoCount=${redoCount}`);
  }

  if (!flow.metrics || typeof flow.metrics !== "object") {
    flow.metrics = {};
  }
  if (!flow.metrics.draft || typeof flow.metrics.draft !== "object") {
    flow.metrics.draft = {};
  }
  if (!Number.isFinite(flow.metrics.draft.question)) {
    flow.metrics.draft.question = qaCount;
    changed = true;
    updates.push(`metrics.draft.question=${qaCount}`);
  }

  if (!Number.isFinite(flow.requestChars) && Number.isFinite(requestChars)) {
    flow.requestChars = requestChars;
    changed = true;
    updates.push(`requestChars=${requestChars}`);
  }

  if (changed && !dryRun) {
    writeJson(flowPath, flow);
  }

  return {
    specId: path.basename(specDir),
    changed,
    dryRun,
    updates,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const root = findRepoRoot(process.cwd());
  const specsDir = path.join(root, "specs");
  const targets = listTargetSpecs(specsDir, args);

  const results = [];
  for (const specId of targets) {
    const specDir = path.join(specsDir, specId);
    if (!fs.existsSync(specDir)) {
      results.push({ specId, skipped: "spec directory not found" });
      continue;
    }
    results.push(updateFlow(specDir, args.dryRun));
  }

  let changedCount = 0;
  for (const r of results) {
    if (r.skipped) {
      process.stdout.write(`- ${r.specId}: skipped (${r.skipped})\n`);
      continue;
    }
    if (r.changed) {
      changedCount += 1;
      process.stdout.write(`- ${r.specId}: ${args.dryRun ? "would update" : "updated"} (${r.updates.join(", ")})\n`);
    } else {
      process.stdout.write(`- ${r.specId}: no change\n`);
    }
  }
  process.stdout.write(`\nDone. changed=${changedCount}, total=${results.length}${args.dryRun ? " (dry-run)" : ""}\n`);
}

main();
