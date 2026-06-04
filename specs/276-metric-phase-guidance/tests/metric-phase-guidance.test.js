// spec: R1 R2 R3
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { makeFlowManager, makeFlowState } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { VALID_PHASES } from "../../../src/lib/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const flowCli = path.join(repoRoot, "src/flow.js");

const guidanceFiles = [
  "src/skills/sdd-forge.flow/SKILL.md",
  ".agents/skills/sdd-forge.flow/SKILL.md",
].map((relativePath) => path.join(repoRoot, relativePath));

const nextActionStepKeys = [
  "test",
  "scenario-validity",
  "test-review",
  "impl-review",
  "impl-gate",
  "retro",
];

function existingGuidanceFiles() {
  return guidanceFiles.filter((filePath) => fs.existsSync(filePath));
}

function readMetricRecordingSection(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const start = text.indexOf("## Metric Recording");
  assert.notEqual(start, -1, `${path.relative(repoRoot, filePath)} must contain metric recording guidance`);
  const rest = text.slice(start);
  const nextSection = rest.slice(1).search(/\n## /);
  return nextSection === -1 ? rest : rest.slice(0, nextSection + 1);
}

function metricExamples(section) {
  return [...section.matchAll(/flow set metric\s+([a-z-]+)\s+([A-Za-z]+)/g)]
    .map((match) => ({ phase: match[1], counter: match[2] }));
}

function setupTempFlow(root) {
  const specId = "001-test";
  const state = makeFlowState({ spec: `specs/${specId}/spec.json` });
  makeFlowManager(root).save(state);
  makeFlowManager(root).addActiveFlow(specId, "local");
}

function runMetric(root, phase) {
  return spawnSync("node", [flowCli, "set", "metric", phase, "srcRead"], {
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: root },
  });
}

test("R1: metric guidance uses draft and not status-derived invalid phase examples", () => {
  const files = existingGuidanceFiles();
  assert.ok(files.length > 0, "at least one guidance file must exist");

  for (const filePath of files) {
    const relativePath = path.relative(repoRoot, filePath);
    const section = readMetricRecordingSection(filePath);
    assert.match(section, /flow set metric draft docsRead/);
    assert.match(section, /flow set metric draft srcRead/);
    for (const example of metricExamples(section)) {
      assert.ok(
        VALID_PHASES.includes(example.phase),
        `${relativePath} contains invalid metric phase example: ${example.phase} ${example.counter}`,
      );
      assert.ok(
        !nextActionStepKeys.includes(example.phase),
        `${relativePath} uses next-action step key as metric phase: ${example.phase} ${example.counter}`,
      );
    }
    assert.doesNotMatch(section, /\bplan\b[^.\n]*(?:phase|example|metric)/i, relativePath);
    assert.doesNotMatch(section, /\bfinalize\b[^.\n]*(?:phase|example|metric)/i, relativePath);
    assert.doesNotMatch(section, /flow set metric plan (?:docsRead|srcRead)/, relativePath);
    assert.doesNotMatch(section, /flow set metric finalize (?:docsRead|srcRead)/, relativePath);
  }
});

test("R2: generated skill guidance is refreshed when present", () => {
  const source = readMetricRecordingSection(path.join(repoRoot, "src/skills/sdd-forge.flow/SKILL.md"));
  const generatedPath = path.join(repoRoot, ".agents/skills/sdd-forge.flow/SKILL.md");
  assert.ok(fs.existsSync(generatedPath), "generated skill artifact must exist after sdd-forge upgrade");
  const generated = readMetricRecordingSection(generatedPath);
  assert.equal(generated, source);
});

test("R3: metric CLI accepts draft and rejects plan", () => {
  const tmp = createTmpDir("metric-phase-guidance-");
  try {
    setupTempFlow(tmp);

    const accepted = runMetric(tmp, "draft");
    assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
    assert.equal(JSON.parse(accepted.stdout).ok, true);

    const rejected = runMetric(tmp, "plan");
    assert.equal(rejected.status, 1);
    assert.match(rejected.stdout, /"code": "INVALID_PHASE"/);
  } finally {
    removeTmpDir(tmp);
  }
});
