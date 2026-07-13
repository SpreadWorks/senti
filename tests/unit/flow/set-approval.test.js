/**
 * tests/unit/flow/set-approval.test.js
 *
 * spec 221 R5, R7: `senti flow set approval` の挙動を検証する。
 * - --approved を渡すと spec.json.user_approval が更新される
 * - --confirmed-at 省略時は ISO 8601 が自動付与される
 * - --notes は任意
 * - active flow がない場合は非ゼロ終了
 * - --approved を省略した場合は usage error で非ゼロ終了
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "set-approval-"));
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

function setupSpec(tmp, specId, extras = {}) {
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  const specJson = {
    goal: "test",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    ...extras,
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

describe("flow set approval (spec 221 R5, R7)", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("R5: --approved sets user_approval.approved=true and auto-fills confirmed_at", () => {
    tmp = createProject();
    const specDir = setupSpec(tmp, "001-test");
    const res = run(tmp, ["flow", "set", "approval", "--approved"]);
    assert.equal(res.status, 0, res.stderr || res.stdout);
    const updated = loadSpecJson(path.join(specDir, "spec.json"));
    assert.equal(updated.user_approval?.approved, true);
    assert.match(
      updated.user_approval?.confirmed_at ?? "",
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      "confirmed_at must be ISO 8601",
    );
    const md = fs.readFileSync(path.join(specDir, "spec.md"), "utf8");
    assert.match(md, /\[x\] User approved this spec/);
  });

  it("R5: --notes value is persisted", () => {
    tmp = createProject();
    const specDir = setupSpec(tmp, "001-test");
    const res = run(tmp, ["flow", "set", "approval", "--approved", "--notes", "looks good"]);
    assert.equal(res.status, 0, res.stderr || res.stdout);
    const updated = loadSpecJson(path.join(specDir, "spec.json"));
    assert.equal(updated.user_approval?.notes, "looks good");
  });

  it("R5: --confirmed-at overrides the auto timestamp", () => {
    tmp = createProject();
    const specDir = setupSpec(tmp, "001-test");
    const ts = "2025-12-31T23:59:59.000Z";
    const res = run(tmp, ["flow", "set", "approval", "--approved", "--confirmed-at", ts]);
    assert.equal(res.status, 0, res.stderr || res.stdout);
    const updated = loadSpecJson(path.join(specDir, "spec.json"));
    assert.equal(updated.user_approval?.confirmed_at, ts);
  });

  it("R5: written spec.json passes schema validation", () => {
    tmp = createProject();
    const specDir = setupSpec(tmp, "001-test");
    const res = run(tmp, ["flow", "set", "approval", "--approved", "--notes", "ok"]);
    assert.equal(res.status, 0, res.stderr || res.stdout);
    // loadSpecJson validates by default
    const updated = loadSpecJson(path.join(specDir, "spec.json"));
    assert.ok(updated.user_approval);
  });

  it("R5: exits non-zero when no active flow exists", () => {
    tmp = createProject();
    const res = run(tmp, ["flow", "set", "approval", "--approved"]);
    assert.notEqual(res.status, 0, "expected non-zero exit when no active flow");
  });

  it("R7: exits non-zero when --approved is omitted", () => {
    tmp = createProject();
    setupSpec(tmp, "001-test");
    const res = run(tmp, ["flow", "set", "approval"]);
    assert.notEqual(res.status, 0, "expected non-zero exit when --approved is omitted");
    assert.match(res.stderr + res.stdout, /approved|usage/i);
  });
});
