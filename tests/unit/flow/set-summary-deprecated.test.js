/**
 * tests/unit/flow/set-summary-deprecated.test.js
 *
 * spec 219 R5: `flow set summary` は廃止された。非ゼロ終了 + 明示エラーメッセージで
 * 応答し、spec.json / flow.json を書き換えてはならない。
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";

const SENTI = path.resolve("src/senti.js");

function createProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "set-summary-deprecated-"));
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
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

function setup(tmp) {
  const specId = "001-test";
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  const specJson = {
    goal: "test",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [
      { id: "R1", desc: "original", priority: "must", status: "pending" },
    ],
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
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
  };
  makeFlowManager(tmp).save(state);
  makeFlowManager(tmp).addActiveFlow(specId, "branch");
  return { specDir, specId };
}

function run(tmp, argv) {
  return spawnSync("node", [SENTI, ...argv], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
  });
}

describe("spec 219 R5: flow set summary is deprecated", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("returns non-zero exit code with DEPRECATED error", () => {
    tmp = createProject();
    setup(tmp);

    const res = run(tmp, ["flow", "set", "summary", '["new req"]']);
    assert.notEqual(res.status, 0, "flow set summary must fail with non-zero exit");
    const env = JSON.parse(res.stdout.trim());
    assert.equal(env.ok, false);
    assert.equal(env.errors[0].code, "DEPRECATED");
    const message = env.errors[0].messages.join(" ").toLowerCase();
    assert.match(message, /deprecat|廃止/, "error message must mention deprecation");
  });

  it("does not mutate spec.json requirements", () => {
    tmp = createProject();
    const { specDir } = setup(tmp);
    const before = fs.readFileSync(path.join(specDir, "spec.json"), "utf8");

    run(tmp, ["flow", "set", "summary", '["new req"]']);

    const after = fs.readFileSync(path.join(specDir, "spec.json"), "utf8");
    assert.equal(after, before, "spec.json must remain unchanged by deprecated command");
  });
});
