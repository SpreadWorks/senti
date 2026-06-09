#!/usr/bin/env node
// Historical-data migration tool for the `<phase>-<concern>-<action>` step-id rename.
//
// Converts legacy flow step ids in already-committed spec data under <root>/specs/*.
// Root resolves to SENTI_WORK_ROOT or the current working directory.
//
// Scope (per spec 269):
//   - flow.json: structural step-id positions only. steps[] leaves are flow-scope,
//     tasks[].steps[] leaves are task-scope. Branch container ids (plan/impl) are kept.
//   - issue-log.json: only the `step` field, 1:1 ids only. Collision ids (review /
//     gate-impl / impl) are left as-is because flat entries carry no scope.
//   - report.json / retro.json: only path-string values (those containing "/"), 1:1 ids.
//   - review.md: only fenced code blocks and inline code spans, 1:1 ids.
//   - Free-text / prose (notes, desc, reason, narrative, ...) is never touched.
//   - active flow(s) listed in <root>/.senti/.active-flow are excluded entirely.
//
// Usage:
//   node src/scripts/rename-phase-steps.js            # dry-run: print the planned diff
//   node src/scripts/rename-phase-steps.js --apply    # write changes (requires clean git tree)
//
// Exit codes: 0 on success (including dry-run); non-zero on invalid arguments, a non-clean
// or non-git working tree (under --apply), or a write error.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ONE_TO_ONE_STEP_RENAMES, renameFlowStateStepIds } from "../lib/step-id-rename.js";

// Longest-first so multi-segment tokens win; boundary lookarounds keep `gate` from
// matching inside `gate-draft` / `draft-gate`.
const ONE_TO_ONE_TOKENS = Object.keys(ONE_TO_ONE_STEP_RENAMES).sort((a, b) => b.length - a.length);
function replaceOneToOneTokens(text) {
  let out = text;
  for (const tok of ONE_TO_ONE_TOKENS) {
    out = out.replace(new RegExp(`(?<![\\w-])${tok}(?![\\w-])`, "g"), ONE_TO_ONE_STEP_RENAMES[tok]);
  }
  return out;
}

// Rebuild a JSON value, replacing 1:1 ids inside path-like string values (containing "/").
function transformPathStrings(node, changes) {
  if (typeof node === "string") {
    if (!node.includes("/")) return node;
    const replaced = replaceOneToOneTokens(node);
    if (replaced !== node) changes.push({ from: node, to: replaced });
    return replaced;
  }
  if (Array.isArray(node)) return node.map((v) => transformPathStrings(v, changes));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = transformPathStrings(v, changes);
    return out;
  }
  return node;
}

// Replace 1:1 ids inside fenced code blocks and inline code spans of markdown.
function transformMarkdownCode(text) {
  let out = text.replace(/```[\s\S]*?```/g, (block) => replaceOneToOneTokens(block));
  out = out.replace(/`[^`\n]+`/g, (span) => replaceOneToOneTokens(span));
  return out;
}

function readActiveFlowSpecs(root) {
  const set = new Set();
  const p = path.join(root, ".senti", ".active-flow");
  if (!fs.existsSync(p)) return set;
  try {
    const arr = JSON.parse(fs.readFileSync(p, "utf8"));
    if (Array.isArray(arr)) {
      for (const e of arr) {
        if (e && typeof e.spec === "string") set.add(e.spec);
      }
    }
  } catch {
    // a malformed marker excludes nothing; the git-clean gate still protects --apply.
  }
  return set;
}

function handleFlowJson(dir, id, planned, apply) {
  const p = path.join(dir, "flow.json");
  if (!fs.existsSync(p)) return;
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return;
  }
  const changes = renameFlowStateStepIds(obj);
  if (changes.length === 0) return;
  for (const c of changes) planned.push({ file: `specs/${id}/flow.json`, from: c.from, to: c.to });
  if (apply) fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`);
}

function handleIssueLog(dir, id, planned, apply) {
  const p = path.join(dir, "issue-log.json");
  if (!fs.existsSync(p)) return;
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return;
  }
  const entries = Array.isArray(obj) ? obj : Array.isArray(obj.entries) ? obj.entries : null;
  if (!entries) return;
  let changed = false;
  for (const e of entries) {
    if (e && typeof e.step === "string" && ONE_TO_ONE_STEP_RENAMES[e.step]) {
      planned.push({ file: `specs/${id}/issue-log.json`, from: `step: ${e.step}`, to: `step: ${ONE_TO_ONE_STEP_RENAMES[e.step]}` });
      e.step = ONE_TO_ONE_STEP_RENAMES[e.step];
      changed = true;
    }
  }
  if (changed && apply) fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`);
}

function handleReportRetro(dir, id, planned, apply) {
  for (const fname of ["report.json", "retro.json"]) {
    const p = path.join(dir, fname);
    if (!fs.existsSync(p)) continue;
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      continue;
    }
    const changes = [];
    const out = transformPathStrings(obj, changes);
    if (changes.length === 0) continue;
    for (const c of changes) planned.push({ file: `specs/${id}/${fname}`, from: c.from, to: c.to });
    if (apply) fs.writeFileSync(p, `${JSON.stringify(out, null, 2)}\n`);
  }
}

function handleReviewMd(dir, id, planned, apply) {
  const p = path.join(dir, "review.md");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  const out = transformMarkdownCode(text);
  if (out === text) return;
  // Report each distinct 1:1 token rename observed in code/path regions as a diff line.
  for (const [from, to] of Object.entries(ONE_TO_ONE_STEP_RENAMES)) {
    const re = new RegExp(`(?<![\\w-])${from}(?![\\w-])`);
    if (re.test(text) && !re.test(out)) {
      planned.push({ file: `specs/${id}/review.md`, from: `code/path: ${from}`, to: `code/path: ${to}` });
    }
  }
  if (apply) fs.writeFileSync(p, out);
}

function assertCleanGitTree(root) {
  const res = spawnSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" });
  if (res.status !== 0) {
    process.stderr.write("error: --apply requires a git repository\n");
    process.exit(1);
  }
  if (res.stdout.trim() !== "") {
    process.stderr.write("error: --apply requires a clean git worktree (commit or stash changes first)\n");
    process.exit(1);
  }
}

function main() {
  let apply = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--apply") apply = true;
    else {
      process.stderr.write(`error: unknown argument: ${arg}\n`);
      process.exit(2);
    }
  }

  const root = process.env.SENTI_WORK_ROOT || process.cwd();
  if (apply) assertCleanGitTree(root);

  const specsDir = path.join(root, "specs");
  const planned = [];
  if (fs.existsSync(specsDir)) {
    const excluded = readActiveFlowSpecs(root);
    const ids = fs
      .readdirSync(specsDir)
      .filter((d) => fs.statSync(path.join(specsDir, d)).isDirectory());
    for (const id of ids) {
      const dir = path.join(specsDir, id);
      // Exclude only the active flow's flow.json (its in-use runtime state); its static
      // artifacts (issue-log / report / retro / review) are still migrated.
      if (!excluded.has(id)) handleFlowJson(dir, id, planned, apply);
      handleIssueLog(dir, id, planned, apply);
      handleReportRetro(dir, id, planned, apply);
      handleReviewMd(dir, id, planned, apply);
    }
  }

  const header = apply
    ? `Applied ${planned.length} change(s).`
    : `Dry-run diff — ${planned.length} change(s); no files written (re-run with --apply):`;
  process.stdout.write(`${header}\n`);
  // Emit a per-file diff: a `--- <file>` header followed by `-`/`+` lines per change.
  let lastFile = null;
  for (const c of planned) {
    if (c.file !== lastFile) {
      process.stdout.write(`--- ${c.file}\n`);
      lastFile = c.file;
    }
    process.stdout.write(`  - ${c.from}\n  + ${c.to}\n`);
  }
  process.exit(0);
}

main();
