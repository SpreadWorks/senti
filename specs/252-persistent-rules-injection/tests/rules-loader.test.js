// spec: R1 R2 R11 R12 R19 R31 R36 R39
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const rulesPath = path.join(repoRoot, "src", "templates", "skills", "rules.json");

test("R1: rules.json exists at the canonical package path", () => {
  assert.ok(fs.existsSync(rulesPath), `expected rules.json at ${rulesPath}`);
});

test("R1: rules.json parses as JSON with a `rules` array of objects", () => {
  const data = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  assert.ok(Array.isArray(data.rules), "rules field must be an array");
  for (const r of data.rules) {
    assert.equal(typeof r, "object");
  }
});

test("R2: loader rejects rules.json with duplicate id", async () => {
  const { loadRulesFromString } = await import(path.join(repoRoot, "src/lib/skill-rules.js"));
  const dup = JSON.stringify({
    rules: [
      { id: "alpha", phase: ["flow.draft"], body: "**MUST: a**" },
      { id: "alpha", phase: ["flow.draft"], body: "**MUST: b**" },
    ],
  });
  assert.throws(() => loadRulesFromString(dup), (err) => {
    assert.match(err.message, /rules\.json/);
    assert.match(err.message, /duplicate id/);
    assert.match(err.message, /alpha/);
    return true;
  });
});

test("R2: loader rejects unknown phase value", async () => {
  const { loadRulesFromString } = await import(path.join(repoRoot, "src/lib/skill-rules.js"));
  const bad = JSON.stringify({
    rules: [{ id: "alpha", phase: ["flow.does-not-exist"], body: "**MUST: a**" }],
  });
  assert.throws(() => loadRulesFromString(bad), (err) => {
    assert.match(err.message, /rules\.json/);
    assert.match(err.message, /unknown phase/);
    assert.match(err.message, /flow\.does-not-exist/);
    return true;
  });
});

test("R2: loader rejects extra unknown field", async () => {
  const { loadRulesFromString } = await import(path.join(repoRoot, "src/lib/skill-rules.js"));
  const bad = JSON.stringify({
    rules: [{ id: "alpha", phase: ["flow.draft"], body: "**MUST: a**", extra: 1 }],
  });
  assert.throws(() => loadRulesFromString(bad), /rules\.json/);
});

test("R2: loader rejects malformed kebab-case id", async () => {
  const { loadRulesFromString } = await import(path.join(repoRoot, "src/lib/skill-rules.js"));
  const bad = JSON.stringify({
    rules: [{ id: "Alpha_Bad", phase: ["flow.draft"], body: "**MUST: a**" }],
  });
  assert.throws(() => loadRulesFromString(bad), /rules\.json/);
});

test("R11: rules.json contains exactly 10 entries with the canonical id list in order", () => {
  const expected = [
    "no-premature-conclusion",
    "no-auto-mode-override-skill",
    "thoroughness",
    "no-shortcuts",
    "wait-for-instruction-skill",
    "commit-split-strategy",
    "no-scope-splitting",
    "choice-format-discipline",
    "no-chain-sddforge",
    "no-shared-repo-git-ops",
  ];
  const data = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  assert.equal(data.rules.length, 10, "rules.json must have exactly 10 entries");
  assert.deepEqual(data.rules.map((r) => r.id), expected);
});

test("R12: drift-prone rules have MUST + Why + How to apply headed sections", async () => {
  const { loadRulesFromFile, DRIFT_PRONE_RULE_IDS } = await import(path.join(repoRoot, "src/lib/skill-rules.js"));
  const rules = loadRulesFromFile(rulesPath);
  for (const id of DRIFT_PRONE_RULE_IDS) {
    const rule = rules.find((r) => r.id === id);
    assert.ok(rule, `rule ${id} missing`);
    assert.match(rule.body, /^### MUST/m, `rule ${id} body must contain ### MUST heading`);
    assert.match(rule.body, /^### Why/m, `rule ${id} body must contain ### Why heading`);
    assert.match(rule.body, /^### How to apply/m, `rule ${id} body must contain ### How to apply heading`);
  }
});

test("R12: loader rejects drift-prone rule body missing required heading", async () => {
  const { loadRulesFromString } = await import(path.join(repoRoot, "src/lib/skill-rules.js"));
  const bad = JSON.stringify({
    rules: [{ id: "no-premature-conclusion", phase: ["flow.draft"], body: "MUST do not conclude early" }],
  });
  assert.throws(() => loadRulesFromString(bad), /rules\.json/);
});

test("R19: phase enum is derived from FLOW_DEFINITION + TASK_DEFINITION leaves", async () => {
  const { collectLeafIds, FLOW_DEFINITION, TASK_DEFINITION } = await import(path.join(repoRoot, "src/flow/definition.js"));
  const { VALID_SKILL_RULE_PHASES } = await import(path.join(repoRoot, "src/lib/skill-rules.js"));
  const expected = new Set([
    ...collectLeafIds(FLOW_DEFINITION).map((id) => `flow.${id}`),
    ...collectLeafIds(TASK_DEFINITION).map((id) => `task.${id}`),
  ]);
  assert.deepEqual(new Set(VALID_SKILL_RULE_PHASES), expected);
});

test("R31: loader resolves rules.json relative to the package, not cwd", async (t) => {
  const { loadRules } = await import(path.join(repoRoot, "src/lib/skill-rules.js"));
  const tmp = fs.mkdtempSync(path.join(repoRoot, ".tmp", "rules-resolve-"));
  const prevCwd = process.cwd();
  try {
    process.chdir(tmp);
    const rules = loadRules();
    assert.ok(Array.isArray(rules) && rules.length > 0);
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R36: no-auto-mode-override-skill has state: []", () => {
  const data = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  const rule = data.rules.find((r) => r.id === "no-auto-mode-override-skill");
  assert.ok(rule, "rule missing");
  assert.deepEqual(rule.state ?? [], []);
});

test("R39: loader rejects rule body with leading or trailing blank line", async () => {
  const { loadRulesFromString } = await import(path.join(repoRoot, "src/lib/skill-rules.js"));
  const trailing = JSON.stringify({
    rules: [{ id: "alpha", phase: ["flow.draft"], body: "**MUST: a**\n\n" }],
  });
  assert.throws(() => loadRulesFromString(trailing), /rules\.json/);
  const leading = JSON.stringify({
    rules: [{ id: "alpha", phase: ["flow.draft"], body: "\n**MUST: a**" }],
  });
  assert.throws(() => loadRulesFromString(leading), /rules\.json/);
});
