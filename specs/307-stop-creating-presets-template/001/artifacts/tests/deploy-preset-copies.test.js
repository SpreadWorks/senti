// spec: R1 R2 R3 R4 R5 R6
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { deployPresetCopies } from "../../../src/lib/preset-deploy.js";
import { RenameMigration } from "../../../src/upgrade.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const tempRoots = [];
const languages = ["ja", "en"];

function makeTempRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "senti-spec-307-"));
  tempRoots.push(dir);
  return dir;
}

function cleanupTempRoots() {
  for (const dir of tempRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function rel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function readProject(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function templatePath(root, language) {
  return path.join(root, ".senti", "templates", language, "docs", "creating_presets.md");
}

function deployBase(root) {
  const results = deployPresetCopies(root, { presetKeys: ["base"], languages });
  return results.map((file) => rel(root, file)).sort();
}

function assertNoCreatingPresetsTarget(root, results) {
  for (const language of languages) {
    const target = `.senti/templates/${language}/docs/creating_presets.md`;
    assert.ok(!fs.existsSync(path.join(root, target)), `${target} must not be created`);
    assert.ok(!results.includes(target), `${target} must not be returned`);
  }
}

function assertBaseManagedCopies(root, results) {
  assert.ok(results.includes(".senti/presets/base/guardrail.json"));
  assert.ok(results.includes(".senti/presets/base/guardrail-rewrite-rubric.md"));
  assert.equal(
    fs.readFileSync(path.join(root, ".senti", "presets", "base", "guardrail.json"), "utf8"),
    readProject("src/presets/base/guardrail.json"),
  );
  assert.equal(
    fs.readFileSync(path.join(root, ".senti", "presets", "base", "guardrail-rewrite-rubric.md"), "utf8"),
    readProject("src/presets/base/guardrail-rewrite-rubric.md"),
  );
}

function seedBaseManagedCopies(root) {
  const guardrailPath = path.join(root, ".senti", "presets", "base", "guardrail.json");
  const rubricPath = path.join(root, ".senti", "presets", "base", "guardrail-rewrite-rubric.md");
  fs.mkdirSync(path.dirname(guardrailPath), { recursive: true });
  fs.writeFileSync(guardrailPath, "{\"stale\":true}\n");
  fs.writeFileSync(rubricPath, "stale rubric\n");
}

function writeMinimalConfig(root) {
  const configPath = path.join(root, ".senti", "config.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    lang: "ja",
    type: "base",
    docs: {
      languages: ["ja"],
      defaultLanguage: "ja",
    },
  }, null, 2));
}

function runUpgrade(root) {
  execFileSync(process.execPath, [path.join(repoRoot, "src", "senti.js"), "upgrade"], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
}

test.after(cleanupTempRoots);

test("R1: deployPresetCopies does not create or return project-local creating_presets.md", () => {
  const root = makeTempRoot();
  const results = deployBase(root);

  assertNoCreatingPresetsTarget(root, results);
});

test("R2: existing project-local creating_presets.md remains unchanged through upgrade write paths", () => {
  const root = makeTempRoot();
  const existing = templatePath(root, "ja");
  const original = "user-owned sdd-forge note under .sdd-forge\n";
  fs.mkdirSync(path.dirname(existing), { recursive: true });
  fs.writeFileSync(existing, original);
  writeMinimalConfig(root);

  new RenameMigration(root).run();
  deployPresetCopies(root, { presetKeys: ["base"], languages: ["ja"] });
  assert.equal(fs.readFileSync(existing, "utf8"), original);

  runUpgrade(root);
  assert.equal(fs.readFileSync(existing, "utf8"), original);
});

test("R3: deployPresetCopies preserves the base guardrail.json managed copy only", () => {
  const root = makeTempRoot();
  seedBaseManagedCopies(root);
  const results = deployBase(root);

  assertNoCreatingPresetsTarget(root, results);
  assertBaseManagedCopies(root, results);
});

test("R4: deployPresetCopies preserves the base guardrail rewrite rubric managed copy only", () => {
  const root = makeTempRoot();
  seedBaseManagedCopies(root);
  const results = deployBase(root);

  assertNoCreatingPresetsTarget(root, results);
  assertBaseManagedCopies(root, results);
});

test("R5: deployPresetCopies does not create non-base guardrail rewrite rubric managed copies", () => {
  const root = makeTempRoot();
  const presetKey = "spec-307-non-base";
  const presetDir = path.join(repoRoot, "src", "presets", presetKey);
  fs.mkdirSync(presetDir, { recursive: true });
  fs.writeFileSync(path.join(presetDir, "guardrail-rewrite-rubric.md"), "non-base rubric\n");
  try {
    const results = deployPresetCopies(root, { presetKeys: ["base", presetKey], languages })
      .map((file) => rel(root, file))
      .sort();

    assertNoCreatingPresetsTarget(root, results);
    assert.ok(!results.includes(`.senti/presets/${presetKey}/guardrail-rewrite-rubric.md`));
    assert.ok(!fs.existsSync(path.join(root, ".senti", "presets", presetKey, "guardrail-rewrite-rubric.md")));
  } finally {
    fs.rmSync(presetDir, { recursive: true, force: true });
  }
});

test("R6: spec-local regression covers all deployPresetCopies generation targets", () => {
  const root = makeTempRoot();
  const results = deployBase(root);

  assert.deepEqual(results, [
    ".senti/presets/base/guardrail-rewrite-rubric.md",
    ".senti/presets/base/guardrail.json",
  ]);
});
