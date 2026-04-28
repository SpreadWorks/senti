/**
 * specs/239-flow-command-return-value-policy/tests/return-value-policy.test.js
 *
 * Spec verification tests for #282: flow command return value policy.
 * Validates R1-R3 (query commands return ok:true with empty state when no flow).
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { flattenSteps } from "../../../src/flow/definition.js";

const CLI = join(process.cwd(), "src/sdd-forge.js");

function runCli(tmp, args) {
  try {
    const out = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    return { envelope: JSON.parse(out), exitCode: 0 };
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    return { envelope: stdout ? JSON.parse(stdout) : null, exitCode: err.status || 1 };
  }
}

// ── R1: get-next-action returns ok:true with empty state when no flow ────

describe("R1: get-next-action — no active flow", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns ok:true with step=null and action=null when no flow exists", () => {
    tmp = createTmpDir();
    const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
    assert.equal(exitCode, 0, "exit code should be 0");
    assert.equal(envelope.ok, true, "ok should be true");
    assert.equal(envelope.data.step, null, "step should be null");
    assert.equal(envelope.data.action, null, "action should be null");
  });
});

// ── R2: get-next-action returns ok:true with action='completed' when all done ─

describe("R2: get-next-action — all steps completed", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns ok:true with action='completed' when all steps are done", () => {
    tmp = createTmpDir();
    const steps = buildInitialSteps();
    for (const s of flattenSteps(steps)) s.status = "done";
    const state = {
      spec: "specs/001-test/spec.md",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps,
      requirements: [],
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "done", steps: [] }],
      currentTaskId: null,
    };
    const fm = makeFlowManager(tmp);
    fm.save(state);
    fm.addActiveFlow("001-test", "local");

    const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
    assert.equal(exitCode, 0, "exit code should be 0");
    assert.equal(envelope.ok, true, "ok should be true");
    assert.equal(envelope.data.step, null, "step should be null");
    assert.equal(envelope.data.action, "completed", "action should be 'completed'");
  });
});

// ── R3: get-check — no active flow ──────────────────────────────────────

describe("R3: get-check — no active flow", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("dirty check works without active flow", () => {
    tmp = createTmpDir();
    const { envelope, exitCode } = runCli(tmp, ["flow", "get", "check", "dirty"]);
    // dirty check should work regardless of flow state
    assert.equal(exitCode, 0, "exit code should be 0");
    assert.equal(envelope.ok, true, "ok should be true");
    assert.ok(typeof envelope.data.pass === "boolean", "pass should be boolean");
  });

  it("step prerequisites return pass:false with no-active-flow summary", () => {
    tmp = createTmpDir();
    const { envelope, exitCode } = runCli(tmp, ["flow", "get", "check", "impl"]);
    assert.equal(exitCode, 0, "exit code should be 0");
    assert.equal(envelope.ok, true, "ok should be true");
    assert.equal(envelope.data.pass, false, "pass should be false");
    assert.match(envelope.data.summary, /no active flow/, "summary should mention no active flow");
  });
});
