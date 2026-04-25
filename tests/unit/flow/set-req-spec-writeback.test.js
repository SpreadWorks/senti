/**
 * tests/unit/flow/set-req-spec-writeback.test.js
 *
 * spec 219 R3: `flow set req <index> <status>` は spec.json.requirements[index].status
 * を更新し、更新後の spec.json が spec.schema.json のバリデーションを通過する。
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { loadSpecJson } from "../../../src/lib/spec-json.js";

const SDD_FORGE = path.resolve("src/sdd-forge.js");

function createProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "set-req-"));
  fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
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

function setup(tmp, specId, requirements) {
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  const specJson = {
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
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify(specJson, null, 2));
  fs.writeFileSync(path.join(specDir, "spec.md"), "# Spec\n");

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
  return specDir;
}

function run(tmp, argv) {
  return spawnSync("node", [SDD_FORGE, ...argv], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
  });
}

describe("spec 219 R3: flow set req writes to spec.json.requirements", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("updates spec.json.requirements[index].status and passes schema validation", () => {
    tmp = createProject();
    const specId = "001-test";
    const specDir = setup(tmp, specId, [
      { id: "R1", desc: "first", priority: "must", status: "pending" },
      { id: "R2", desc: "second", priority: "must", status: "pending" },
    ]);

    const res = run(tmp, ["flow", "set", "req", "1", "done"]);
    assert.equal(res.status, 0, res.stderr || res.stdout);

    const updated = loadSpecJson(path.join(specDir, "spec.json"));
    assert.equal(updated.requirements[1].status, "done");
    assert.equal(updated.requirements[0].status, "pending");
  });

  it("does not mutate flow state requirements", () => {
    tmp = createProject();
    const specId = "001-test";
    setup(tmp, specId, [
      { id: "R1", desc: "first", priority: "must", status: "pending" },
    ]);

    const res = run(tmp, ["flow", "set", "req", "0", "in_progress"]);
    assert.equal(res.status, 0, res.stderr || res.stdout);

    const flowJson = JSON.parse(
      fs.readFileSync(path.join(tmp, "specs", specId, "flow.json"), "utf8"),
    );
    assert.deepEqual(flowJson.requirements ?? [], [],
      "flow.json.requirements must remain unchanged by set req");
  });
});
