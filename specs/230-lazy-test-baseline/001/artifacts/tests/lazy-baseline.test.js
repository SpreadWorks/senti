/**
 * specs/230-lazy-test-baseline/tests/lazy-baseline.test.js
 *
 * Spec verification tests for lazy baseline acquisition (spec 230).
 * Tests that `flow run tests` (head mode) automatically captures baseline
 * when test.baseline is not yet recorded.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import fs from "fs";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { setupFlow, makeFlowManager } from "../../../tests/helpers/flow-setup.js";

const FLOW_CMD = join(process.cwd(), "src/flow.js");

function writePkgJson(tmp, scripts) {
  fs.writeFileSync(join(tmp, "package.json"), JSON.stringify({
    name: "fixture",
    scripts,
  }));
}

function initGitRepo(tmp) {
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: tmp, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: tmp, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: tmp, stdio: "ignore" });
  fs.writeFileSync(join(tmp, "dummy.txt"), "init");
  execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd: tmp, stdio: "ignore" });
}

function runFlow(tmp, args) {
  return execFileSync("node", [FLOW_CMD, ...args], {
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    cwd: tmp,
  });
}

function tryRunFlow(tmp, args) {
  try {
    const stdout = runFlow(tmp, args);
    return JSON.parse(stdout);
  } catch (err) {
    return JSON.parse(err.stdout || err.stderr);
  }
}

describe("spec 230: lazy baseline acquisition", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("REQ-1: auto-captures baseline when test.baseline is empty in head mode", () => {
    tmp = createTmpDir();
    initGitRepo(tmp);
    setupFlow(tmp, { baseBranch: "main" });
    writePkgJson(tmp, { test: "node -e \"console.log('1 passing');process.exit(0)\"" });

    const env = tryRunFlow(tmp, ["run", "tests"]);
    const state = makeFlowManager(tmp).load();
    assert.ok(state.test?.baseline, "test.baseline must be recorded after head mode run");
    assert.ok(state.test?.summary, "test.summary must also be recorded");
  });

  it("REQ-2: skips baseline capture when test.baseline is already recorded", () => {
    tmp = createTmpDir();
    initGitRepo(tmp);
    const preBaseline = { unit: 5, exitCode: 0 };
    setupFlow(tmp, { baseBranch: "main", test: { baseline: preBaseline } });
    writePkgJson(tmp, { test: "node -e \"console.log('1 passing');process.exit(0)\"" });

    const env = tryRunFlow(tmp, ["run", "tests"]);
    const state = makeFlowManager(tmp).load();
    assert.equal(state.test.baseline.unit, 5, "pre-existing baseline must be preserved");
    assert.equal(state.test.baseline.exitCode, 0, "pre-existing baseline exitCode must be preserved");
  });

  it("REQ-4: continues head test when baseline auto-capture fails", () => {
    tmp = createTmpDir();
    // no git repo → worktree creation will fail
    setupFlow(tmp, { baseBranch: "main" });
    writePkgJson(tmp, { test: "node -e \"console.log('1 passing');process.exit(0)\"" });

    const env = tryRunFlow(tmp, ["run", "tests"]);
    // head test should still have run (exitCode 0 from the test command)
    assert.equal(env.data.exitCode, 0, "head test must execute even if baseline capture fails");
    const state = makeFlowManager(tmp).load();
    assert.ok(state.test?.summary, "test.summary must be recorded even if baseline capture failed");
  });

  it("REQ-7: --baseline flag still works independently", () => {
    tmp = createTmpDir();
    initGitRepo(tmp);
    setupFlow(tmp, { baseBranch: "main" });
    writePkgJson(tmp, { test: "node -e \"console.log('1 passing');process.exit(0)\"" });

    const env = tryRunFlow(tmp, ["run", "tests", "--baseline"]);
    assert.equal(env.ok, true, "baseline-only mode must succeed");
    assert.equal(env.data.baseline, true, "result must indicate baseline mode");
    const state = makeFlowManager(tmp).load();
    assert.ok(state.test?.baseline, "test.baseline must be recorded");
    assert.equal(state.test?.summary, undefined, "test.summary must NOT be recorded in baseline-only mode");
  });
});
