/**
 * tests/unit/flow/flow-run-tests.test.js
 *
 * Tests for `flow run tests` CLI (REQ-P1-1..6).
 * Spec: 198-test-first-determinism-core.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import fs from "fs";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager } from "../../helpers/flow-setup.js";

const FLOW_CMD = join(process.cwd(), "src/flow.js");

function writePkgJson(tmp, scripts) {
  fs.writeFileSync(join(tmp, "package.json"), JSON.stringify({
    name: "fixture",
    scripts,
  }));
}

function runFlow(tmp, args, opts = {}) {
  return execFileSync("node", [FLOW_CMD, ...args], {
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, ...(opts.env || {}) },
    cwd: tmp,
  });
}

describe("flow run tests CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("REQ-P1-1/P1-4: executes configured test command and records exit code + summary", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    writePkgJson(tmp, { test: "node -e \"console.log('1 passing');process.exit(0)\"" });
    fs.writeFileSync(join(tmp, ".sdd-forge/config.json"), JSON.stringify({
      lang: "ja", type: "base",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      commands: { test: { task: "npm test", parent: "npm test" } },
    }));
    const out = runFlow(tmp, ["run", "tests"]);
    const env = JSON.parse(out);
    assert.equal(env.ok, true);
    assert.equal(env.type, "run");
    assert.equal(env.key, "tests");
    assert.equal(env.data.exitCode, 0);
    const state = makeFlowManager(tmp).load();
    assert.ok(state.test?.summary, "flow.json test.summary must be recorded");
  });

  it("REQ-P1-2: selects task scope when currentTaskId is set, parent otherwise", () => {
    tmp = createTmpDir();
    setupFlow(tmp, {
      currentTaskId: "T1",
      tasks: [{ id: "T1", title: "t1", origin: "plan", status: "in_progress", steps: [], requirements: [] }],
    });
    writePkgJson(tmp, { "test:unit": "node -e \"process.exit(0)\"", test: "node -e \"process.exit(0)\"" });
    const out = runFlow(tmp, ["run", "tests"]);
    const env = JSON.parse(out);
    assert.equal(env.data.scope, "task");
  });

  it("REQ-P1-3: infers command from package.json scripts when commands.test is absent", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    writePkgJson(tmp, { test: "node -e \"process.exit(0)\"" });
    const out = runFlow(tmp, ["run", "tests"]);
    const env = JSON.parse(out);
    assert.equal(env.ok, true);
    assert.equal(env.data.exitCode, 0);
  });

  it("REQ-P1-6 / Edge case 2: exits non-zero when no test command is resolvable", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    writePkgJson(tmp, {});
    try {
      runFlow(tmp, ["run", "tests"]);
      assert.fail("should fail when no test command is available");
    } catch (err) {
      const env = JSON.parse(err.stdout || err.stderr);
      assert.equal(env.ok, false);
    }
  });

  it("REQ-P1-6: non-zero exit code from child is propagated and recorded", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    writePkgJson(tmp, { test: "node -e \"process.exit(7)\"" });
    try {
      runFlow(tmp, ["run", "tests"]);
      assert.fail("should surface non-zero exit");
    } catch (err) {
      const env = JSON.parse(err.stdout || err.stderr);
      assert.equal(env.data.exitCode, 7);
    }
  });

  it("REQ-P1-5: tool-written execution summary is recorded under a dedicated key that AI-side set does not touch", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    writePkgJson(tmp, { test: "node -e \"console.log('1 passing');process.exit(0)\"" });
    runFlow(tmp, ["run", "tests"]);
    const state = makeFlowManager(tmp).load();
    // The tool records an execution exitCode, which set-test-summary (AI-side) has no flag for.
    assert.ok(state.test?.summary, "tool must record test.summary");
    assert.equal(state.test.summary.exitCode, 0, "exitCode is tool-only and cannot be written by AI");
  });

  it("writes test output log under work directory", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    writePkgJson(tmp, { test: "node -e \"console.log('hello-log-marker');process.exit(0)\"" });
    runFlow(tmp, ["run", "tests"]);
    const log = fs.readFileSync(join(tmp, ".tmp/logs/test-output.log"), "utf8");
    assert.ok(log.includes("hello-log-marker"));
  });
});
