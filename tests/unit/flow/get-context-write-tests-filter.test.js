/**
 * tests/unit/flow/get-context-write-tests-filter.test.js
 *
 * Tests for write-tests phase context filter (REQ-P2-1..4).
 * Spec: 198-test-first-determinism-core.
 *
 * During a task's write-tests step, `flow get context` rejects path-mode
 * access to files declared in spec.json.implementationTargets, and silently
 * excludes such files from list/search modes.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import fs from "fs";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager } from "../../helpers/flow-setup.js";

const FLOW_CMD = join(process.cwd(), "src/flow.js");

function writeSpecJson(tmp, specId, targets) {
  const dir = join(tmp, "specs", specId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(join(dir, "spec.json"), JSON.stringify({
    goal: "test", background: "test",
    scope: { in: [], out: [] },
    constraints: [], design_principles: [],
    implementationTargets: targets,
  }));
  if (!fs.existsSync(join(dir, "spec.md"))) {
    fs.writeFileSync(join(dir, "spec.md"), "# spec\n");
  }
}

function makeFlowInWriteTests(tmp) {
  const state = setupFlow(tmp, {
    spec: "specs/198-test-first-determinism-core/spec.md",
    currentTaskId: "T1",
    tasks: [{
      id: "T1",
      title: "t1",
      origin: "plan",
      status: "in_progress",
      steps: [
        { id: "gate", status: "done" },
        { id: "approval", status: "done" },
        { id: "write-tests", status: "in_progress" },
        { id: "impl", status: "pending" },
        { id: "run-tests", status: "pending" },
        { id: "review", status: "pending" },
        { id: "update-overview", status: "pending" },
      ],
      requirements: [],
    }],
  });
  return state;
}

describe("flow get context — write-tests hard wall", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("REQ-P2-3: path-mode access to an implementation target is rejected", () => {
    tmp = createTmpDir();
    makeFlowInWriteTests(tmp);
    writeSpecJson(tmp, "198-test-first-determinism-core", ["src/flow/lib/run-tests.js"]);
    fs.mkdirSync(join(tmp, "src/flow/lib"), { recursive: true });
    fs.writeFileSync(join(tmp, "src/flow/lib/run-tests.js"), "export default 1;\n");
    try {
      execFileSync(
        "node", [FLOW_CMD, "get", "context", "src/flow/lib/run-tests.js"],
        { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp }, cwd: tmp },
      );
      assert.fail("should reject implementation target in write-tests phase");
    } catch (err) {
      const env = JSON.parse(err.stdout || err.stderr);
      assert.equal(env.ok, false);
      assert.match(env.errors?.[0]?.code || "", /CONTEXT_BLOCKED_WRITE_TESTS|BLOCKED/);
    }
  });

  it("REQ-P2-1 / P2-4: list mode excludes implementation targets silently", () => {
    tmp = createTmpDir();
    makeFlowInWriteTests(tmp);
    writeSpecJson(tmp, "198-test-first-determinism-core", ["src/flow/lib/run-tests.js"]);
    // Seed a minimal analysis.json so list mode has entries to filter.
    fs.mkdirSync(join(tmp, ".sdd-forge/output"), { recursive: true });
    fs.writeFileSync(join(tmp, ".sdd-forge/output/analysis.json"), JSON.stringify({
      project: { entries: [
        { file: "src/flow/lib/run-tests.js", summary: "test runner", chapter: "cli_commands" },
        { file: "src/flow/lib/get-status.js", summary: "status get", chapter: "cli_commands" },
      ]},
    }));
    const out = execFileSync(
      "node", [FLOW_CMD, "get", "context"],
      { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp }, cwd: tmp },
    );
    const env = JSON.parse(out);
    const files = (env.data?.entries || []).map((e) => e.file);
    assert.ok(!files.includes("src/flow/lib/run-tests.js"), "blocked target must not appear in list mode");
  });

  it("REQ-P2-1: non-target files are still accessible in path mode during write-tests", () => {
    tmp = createTmpDir();
    makeFlowInWriteTests(tmp);
    writeSpecJson(tmp, "198-test-first-determinism-core", ["src/flow/lib/run-tests.js"]);
    fs.mkdirSync(join(tmp, "src/flow/lib"), { recursive: true });
    fs.writeFileSync(join(tmp, "src/flow/lib/get-status.js"), "export default 1;\n");
    const out = execFileSync(
      "node", [FLOW_CMD, "get", "context", "src/flow/lib/get-status.js"],
      { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp }, cwd: tmp },
    );
    const env = JSON.parse(out);
    assert.equal(env.ok, true);
  });

  it("hard wall is inactive outside write-tests phase", () => {
    tmp = createTmpDir();
    // No currentTaskId → parent-level, not in write-tests phase.
    setupFlow(tmp, { spec: "specs/198-test-first-determinism-core/spec.md" });
    writeSpecJson(tmp, "198-test-first-determinism-core", ["src/flow/lib/run-tests.js"]);
    fs.mkdirSync(join(tmp, "src/flow/lib"), { recursive: true });
    fs.writeFileSync(join(tmp, "src/flow/lib/run-tests.js"), "export default 1;\n");
    const out = execFileSync(
      "node", [FLOW_CMD, "get", "context", "src/flow/lib/run-tests.js"],
      { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp }, cwd: tmp },
    );
    const env = JSON.parse(out);
    assert.equal(env.ok, true, "outside write-tests, impl targets remain accessible");
  });

  it("hard wall is inactive when implementationTargets is empty", () => {
    tmp = createTmpDir();
    makeFlowInWriteTests(tmp);
    writeSpecJson(tmp, "198-test-first-determinism-core", []);
    fs.mkdirSync(join(tmp, "src/flow/lib"), { recursive: true });
    fs.writeFileSync(join(tmp, "src/flow/lib/run-tests.js"), "export default 1;\n");
    const out = execFileSync(
      "node", [FLOW_CMD, "get", "context", "src/flow/lib/run-tests.js"],
      { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp }, cwd: tmp },
    );
    const env = JSON.parse(out);
    assert.equal(env.ok, true, "empty implementationTargets must not block anything");
  });
});
