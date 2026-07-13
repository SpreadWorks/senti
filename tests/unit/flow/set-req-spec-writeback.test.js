/**
 * tests/unit/flow/set-req-spec-writeback.test.js
 *
 * spec 219 R3: `flow set req <reqId|zeroBasedIndex> <status>` は対象
 * requirement の status を更新し、更新後の spec.json が spec.schema.json
 * のバリデーションを通過する。
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

const SENTI = path.resolve("src/senti.js");

function createProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "set-req-"));
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  execFileSync("git", ["init", tmp], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "commit", "--allow-empty", "-m", "init"], { stdio: "ignore" });
  fs.writeFileSync(
    path.join(tmp, ".senti", "config.json"),
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
    spec: `specs/${specId}/spec.json`,
    runId: `run-${specId}`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
  };
  makeFlowManager(tmp).create(state);
  makeFlowManager(tmp).addActiveFlow(specId, "branch");
  return specDir;
}

function run(tmp, argv) {
  return spawnSync("node", [SENTI, ...argv], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
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

  it("updates spec.json.requirements by requirement id", () => {
    tmp = createProject();
    const specId = "001-test";
    const specDir = setup(tmp, specId, [
      { id: "R1", desc: "first", priority: "must", status: "pending" },
      { id: "R2", desc: "second", priority: "must", status: "pending" },
    ]);

    const res = run(tmp, ["flow", "set", "req", "R2", "done"]);
    assert.equal(res.status, 0, res.stderr || res.stdout);

    const envelope = JSON.parse(res.stdout);
    assert.equal(envelope.data.index, 1);
    assert.equal(envelope.data.reqId, "R2");

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
