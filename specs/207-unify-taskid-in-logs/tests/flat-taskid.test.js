/**
 * specs/207-unify-taskid-in-logs/tests/flat-taskid.test.js
 *
 * Spec verification: metrics / notes are stored as append-only entry arrays
 * with a taskId field. Per-task branching is gone.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

import { makeFlowManager, makeFlowState } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "../../..");
const FLOW_CMD = path.join(REPO_ROOT, "src/flow.js");

function setupFlow(tmp, { withTask = false, completeTask = false } = {}) {
  const state = makeFlowState();
  if (withTask) {
    state.tasks.push({
      id: "T1",
      spec: "specs/001-test/tasks/T1.md",
      origin: "plan",
      parent: null,
      status: completeTask ? "done" : "pending",
      steps: [{ id: "impl", status: "pending" }],
      requirements: [],
      summary: null,
    });
    if (!completeTask) state.currentTaskId = "T1";
  }
  const fm = makeFlowManager(tmp);
  fm.save(state);
  fm.addActiveFlow("001-test", "local");
  return fm;
}

function runFlowCli(tmp, args) {
  return execFileSync(
    "node", [FLOW_CMD, ...args],
    { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
  );
}

describe("R1.1: metrics stored as append-only entry array", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("incrementMetric appends an entry with taskId=null when no active task", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp);
    fm.incrementMetric("draft", "question");
    const loaded = fm.load("001-test");
    assert.ok(Array.isArray(loaded.metrics), "state.metrics should be an array");
    assert.equal(loaded.metrics.length, 1);
    assert.equal(loaded.metrics[0].phase, "draft");
    assert.equal(loaded.metrics[0].counter, "question");
    assert.equal(loaded.metrics[0].taskId, null);
    assert.ok(loaded.metrics[0].ts, "ts field present");
  });

  it("incrementMetric writes taskId=<id> when active task exists", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp, { withTask: true });
    fm.incrementMetric("impl", "srcRead");
    const loaded = fm.load("001-test");
    assert.equal(loaded.metrics.length, 1);
    assert.equal(loaded.metrics[0].taskId, "T1");
    // No per-task branching
    assert.ok(
      !loaded.tasks[0].metrics,
      "task.metrics must not exist in new flat format",
    );
  });

  it("multiple increments produce multiple entries, not aggregated counters", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp);
    fm.incrementMetric("draft", "question");
    fm.incrementMetric("draft", "question");
    fm.incrementMetric("draft", "question");
    const loaded = fm.load("001-test");
    assert.equal(loaded.metrics.length, 3);
  });
});

describe("R1.2: notes stored as append-only entry array with taskId", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("addNote appends {taskId, text, ts} entry", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp, { withTask: true });
    fm.addNote("hello");
    const loaded = fm.load("001-test");
    assert.ok(Array.isArray(loaded.notes));
    assert.equal(loaded.notes.length, 1);
    assert.equal(loaded.notes[0].text, "hello");
    assert.equal(loaded.notes[0].taskId, "T1");
    assert.ok(loaded.notes[0].ts);
    assert.ok(!loaded.tasks[0].notes, "task.notes must not exist");
  });

  it("addNote writes taskId=null when no current task", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp);
    fm.addNote("parent note");
    const loaded = fm.load("001-test");
    assert.equal(loaded.notes[0].taskId, null);
  });

  it("addNote with explicit taskId=null overrides active task", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp, { withTask: true });
    fm.addNote("parent explicit", { taskId: null });
    const loaded = fm.load("001-test");
    assert.equal(loaded.notes[0].taskId, null);
  });
});

describe("R2: CLI --task-id inference and explicit", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("flow set metric infers taskId from active task", () => {
    tmp = createTmpDir();
    setupFlow(tmp, { withTask: true });
    runFlowCli(tmp, ["set", "metric", "draft", "question"]);
    const loaded = makeFlowManager(tmp).load("001-test");
    assert.equal(loaded.metrics[0].taskId, "T1");
  });

  it("flow set metric --task-id overrides inference", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp, { withTask: true });
    // Add a second task
    fm.addTask({
      id: "T2",
      spec: "x",
      origin: "plan",
      parent: null,
      status: "pending",
      steps: [{ id: "impl", status: "pending" }],
      requirements: [],
      summary: null,
    });
    runFlowCli(tmp, ["set", "metric", "draft", "question", "--task-id", "T1"]);
    const loaded = makeFlowManager(tmp).load("001-test");
    assert.equal(loaded.metrics[0].taskId, "T1");
  });

  it("flow set note --task-id=(unknown) fails with non-zero exit", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    let caught;
    try {
      runFlowCli(tmp, ["set", "note", "hi", "--task-id", "ghost"]);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, "command must fail");
    assert.notEqual(caught.status, 0, "exit code must be non-zero");
    const combined = String(caught.stderr || "") + String(caught.stdout || "");
    assert.match(combined, /unknown|not found/i);
  });
});

describe("R1.4: issue-log entries include taskId", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("set issue-log records taskId from active task", () => {
    tmp = createTmpDir();
    setupFlow(tmp, { withTask: true });
    // Prepare the spec dir so issue-log.json has a home
    fs.mkdirSync(path.join(tmp, "specs/001-test"), { recursive: true });
    runFlowCli(tmp, [
      "set", "issue-log",
      "--step", "test",
      "--reason", "A representative test reason for issue-log capture",
    ]);
    const log = JSON.parse(fs.readFileSync(path.join(tmp, "specs/001-test/issue-log.json"), "utf8"));
    assert.equal(log.entries.length, 1);
    assert.equal(log.entries[0].taskId, "T1");
  });

  it("set issue-log taskId=null when no active task", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    fs.mkdirSync(path.join(tmp, "specs/001-test"), { recursive: true });
    runFlowCli(tmp, [
      "set", "issue-log",
      "--step", "test",
      "--reason", "A representative test reason for issue-log capture",
    ]);
    const log = JSON.parse(fs.readFileSync(path.join(tmp, "specs/001-test/issue-log.json"), "utf8"));
    assert.equal(log.entries[0].taskId, null);
  });
});

describe("R3: get status returns raw arrays + metricsSummary", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("get status returns raw metrics/notes arrays and metricsSummary", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp, { withTask: true });
    fm.incrementMetric("draft", "question");
    fm.incrementMetric("draft", "question");
    fm.addNote("n1");
    const out = runFlowCli(tmp, ["get", "status"]);
    const env = JSON.parse(out);
    assert.ok(Array.isArray(env.data.metrics));
    assert.equal(env.data.metrics.length, 2);
    assert.ok(Array.isArray(env.data.notes));
    assert.ok(env.data.metricsSummary, "metricsSummary present");
    assert.ok(env.data.metricsSummary.tasks?.T1);
    assert.equal(env.data.metricsSummary.tasks.T1.draft.question, 2);
    assert.equal(env.data.metricsSummary.total.draft.question, 2);
  });
});

describe("R4.1: legacy flow.json rejected", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("load throws when state.metrics is a nested map (legacy)", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp);
    // Write legacy format manually (object, not array)
    const p = path.join(tmp, "specs/001-test/flow.json");
    const legacy = JSON.parse(fs.readFileSync(p, "utf8"));
    legacy.metrics = { draft: { question: 1 } };
    fs.writeFileSync(p, JSON.stringify(legacy, null, 2));
    assert.throws(() => fm.load("001-test"), /legacy|metrics|schema/i);
  });

  it("load throws when task.metrics exists (legacy per-task)", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp, { withTask: true });
    const p = path.join(tmp, "specs/001-test/flow.json");
    const legacy = JSON.parse(fs.readFileSync(p, "utf8"));
    legacy.tasks[0].metrics = { impl: { srcRead: 1 } };
    fs.writeFileSync(p, JSON.stringify(legacy, null, 2));
    assert.throws(() => fm.load("001-test"), /legacy|metrics|schema/i);
  });
});
