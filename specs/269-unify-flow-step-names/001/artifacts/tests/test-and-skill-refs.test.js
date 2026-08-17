// spec: R4 R5
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");

const UNAMBIGUOUS_OLD_IDS = [
  "gate-draft",
  "gate-impl",
  "review-draft-questions",
  "review-draft-coverage",
  "review-spec",
  "review-test",
  "spec-review-triage",
];

function walk(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, exts, acc);
    else if (ent.isFile() && exts.some((e) => full.endsWith(e))) acc.push(full);
  }
  return acc;
}

function tokenRegex(tok) {
  return new RegExp(`(?<![\\w-])${tok}(?![\\w-])`);
}

function scanFor(files) {
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const tok of UNAMBIGUOUS_OLD_IDS) {
      if (tokenRegex(tok).test(text)) hits.push(`${path.relative(repoRoot, file)} :: ${tok}`);
    }
  }
  return hits;
}

test("R4: tests/unit/flow has no unambiguous old step-id literals", () => {
  const files = walk(path.join(repoRoot, "tests", "unit", "flow"), [".js"]);
  assert.ok(files.length > 0, "expected tests/unit/flow to contain test files");
  const hits = scanFor(files);
  assert.deepEqual(hits, [], `old step-id literals remain in tests/unit/flow:\n${hits.join("\n")}`);
});

test("R5: authored skill/template sources have no unambiguous old step-id literals", () => {
  const dirs = [
    path.join(repoRoot, "src", "skills"),
  ];
  const files = dirs.flatMap((d) => walk(d, [".md", ".js"]));
  assert.ok(files.length > 0, "expected authored skill sources to exist");
  const hits = scanFor(files);
  assert.deepEqual(hits, [], `old step-id literals remain in authored skill sources:\n${hits.join("\n")}`);
});

test("R5: flow prompt contents have no unambiguous old step-id literals", () => {
  const files = walk(path.join(repoRoot, "src", "flow", "prompts"), [".md"]);
  assert.ok(files.length > 0, "expected flow prompt files to exist");
  const hits = scanFor(files);
  assert.deepEqual(hits, [], `old step-id literals remain in flow prompt contents:\n${hits.join("\n")}`);
});

test("R5: installed skill copies have no unambiguous old step-id literals", () => {
  const dirs = [
    path.join(repoRoot, ".claude", "skills"),
    path.join(repoRoot, ".agents", "skills"),
  ].filter((d) => fs.existsSync(d));
  assert.ok(dirs.length > 0, "expected at least one installed skill copy dir (.claude/skills or .agents/skills)");
  const files = dirs.flatMap((d) => walk(d, [".md", ".js"]));
  const hits = scanFor(files);
  assert.deepEqual(hits, [], `old step-id literals remain in installed skill copies:\n${hits.join("\n")}`);
});
