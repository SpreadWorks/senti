/**
 * tests/unit/flow/requirements-single-source.test.js
 *
 * spec 219: requirements の source of truth が spec.json.requirements に統一され、
 * flow.json 側を参照しないことを検証する。
 *
 * Covers R1 (retro), R4 (get status), R6 (impl-confirm / resume), R7 (status 未設定時 pending 扱い)。
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";

const SDD_FORGE = path.resolve("src/sdd-forge.js");

function createProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "req-source-"));
  fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
  execFileSync("git", ["init", tmp], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "commit", "--allow-empty", "-m", "init"], { stdio: "ignore" });
  fs.writeFileSync(
    path.join(tmp, ".sdd-forge", "config.json"),
    JSON.stringify({
      lang: "ja",
      type: "base",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    }),
  );
  return tmp;
}

function writeSpecJson(tmp, specId, specJson) {
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify(specJson, null, 2));
  fs.writeFileSync(path.join(specDir, "spec.md"), "# Spec\n");
}

function setupFlow(tmp, specId) {
  const state = {
    spec: `specs/${specId}/spec.md`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
  };
  makeFlowManager(tmp).save(state);
  makeFlowManager(tmp).addActiveFlow(specId, "branch");
  return state;
}

function run(tmp, argv) {
  return spawnSync("node", [SDD_FORGE, ...argv], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
  });
}

function parseEnvelope(res) {
  return JSON.parse(res.stdout.trim());
}

function minimalSpec(requirements) {
  return {
    goal: "test",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements,
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };
}

// ---------------------------------------------------------------------------
// R1: retro source — must not read state.requirements
// ---------------------------------------------------------------------------

describe("spec 219 R1: run-retro.js does not reference flow state requirements", () => {
  it("source does not access state.requirements", () => {
    const src = fs.readFileSync(path.resolve("src/flow/lib/run-retro.js"), "utf8");
    assert.doesNotMatch(
      src,
      /state\.requirements/,
      "run-retro.js must not read requirements from flow state; use spec.json.requirements",
    );
  });

  it("source does not throw 'no requirements found in flow.json'", () => {
    const src = fs.readFileSync(path.resolve("src/flow/lib/run-retro.js"), "utf8");
    assert.doesNotMatch(
      src,
      /no requirements found in flow\.json/,
      "legacy error string must be removed after spec.json becomes the single source",
    );
  });
});

// ---------------------------------------------------------------------------
// R4: flow get status — requirements come from spec.json
// ---------------------------------------------------------------------------

describe("spec 219 R4: flow get status returns requirements from spec.json", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("returns requirements populated from spec.json when flow state requirements is empty", () => {
    tmp = createProject();
    const specId = "001-test";
    writeSpecJson(tmp, specId, minimalSpec([
      { id: "R1", desc: "first requirement", priority: "must", status: "done" },
      { id: "R2", desc: "second requirement", priority: "should", status: "pending" },
    ]));
    setupFlow(tmp, specId);

    const res = run(tmp, ["flow", "get", "status"]);
    assert.equal(res.status, 0, res.stderr || res.stdout);
    const env = parseEnvelope(res);
    assert.equal(env.data.requirements.length, 2);
    assert.equal(env.data.requirementsProgress.done, 1);
    assert.equal(env.data.requirementsProgress.total, 2);
  });

  it("treats spec.json requirements without status field as 'pending' (R7)", () => {
    tmp = createProject();
    const specId = "001-test";
    writeSpecJson(tmp, specId, minimalSpec([
      { id: "R1", desc: "no status", priority: "must" },
      { id: "R2", desc: "explicit done", priority: "must", status: "done" },
    ]));
    setupFlow(tmp, specId);

    const res = run(tmp, ["flow", "get", "status"]);
    assert.equal(res.status, 0, res.stderr || res.stdout);
    const env = parseEnvelope(res);
    assert.equal(env.data.requirementsProgress.total, 2);
    assert.equal(env.data.requirementsProgress.done, 1);
  });
});

// ---------------------------------------------------------------------------
// R6: impl-confirm and resume — must not reference state.requirements
// ---------------------------------------------------------------------------

describe("spec 219 R6: impl-confirm / resume / resolve-context do not reference state.requirements", () => {
  for (const file of [
    "src/flow/lib/run-impl-confirm.js",
    "src/flow/lib/run-resume.js",
    "src/flow/lib/get-resolve-context.js",
  ]) {
    it(`${file} does not read state.requirements`, () => {
      const src = fs.readFileSync(path.resolve(file), "utf8");
      assert.doesNotMatch(
        src,
        /state\.requirements/,
        `${file} must read requirements from spec.json, not flow state`,
      );
    });
  }
});
