import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../helpers/tmp-dir.js";
import { buildInitialSteps, specIdFromPath } from "../../../src/lib/flow-helpers.js";
const FLOW_CMD = join(process.cwd(), "src/sdd-forge.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

function setupFlowEnv(tmp) {
  // Create minimal config and flow state
  writeJson(tmp, ".sdd-forge/config.json", { lang: "js", type: "cli", docs: { languages: ["en"], defaultLanguage: "en" } });
  const specDir = "specs/999-test";
  writeFile(tmp, `${specDir}/spec.md`, "# Spec\n## Requirements\n- REQ-1\n");
  const specPath = `${specDir}/spec.md`;
  makeFlowManager(tmp).save({
    spec: specPath,
    baseBranch: "main",
    featureBranch: "feature/test",
    steps: buildInitialSteps(),
  });
  makeFlowManager(tmp).addActiveFlow(specIdFromPath(specPath), "branch");
  return tmp;
}

describe("flow set test-summary", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("saves test summary to flow.json under test.summary", () => {
    tmp = setupFlowEnv(createTmpDir());
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary", "--unit", "3", "--integration", "2"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.data.summary, { unit: 3, integration: 2 });

    const flow = makeFlowManager(tmp).load();
    assert.deepEqual(flow.test.summary, { unit: 3, integration: 2 });
  });

  it("errors when no flags provided", () => {
    tmp = setupFlowEnv(createTmpDir());
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary"], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      assert.fail("should exit non-zero");
    } catch (err) {
      const out = err.stdout || "";
      const parsed = JSON.parse(out);
      assert.equal(parsed.ok, false);
      assert.match(parsed.errors[0].messages[0], /usage/i);
    }
  });

  it("overwrites previous test.summary", () => {
    tmp = setupFlowEnv(createTmpDir());
    execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary", "--unit", "5"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary", "--acceptance", "1"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    const flow = makeFlowManager(tmp).load();
    assert.deepEqual(flow.test.summary, { acceptance: 1 });
    assert.equal(flow.test.summary.unit, undefined);
  });

  it("does not affect existing flow.json fields", () => {
    tmp = setupFlowEnv(createTmpDir());
    execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary", "--unit", "2"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    const flow = makeFlowManager(tmp).load();
    assert.ok(flow.steps, "steps preserved");
    assert.ok(flow.spec, "spec preserved");
    assert.ok(flow.baseBranch, "baseBranch preserved");
  });

  it("shows in help output", () => {
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "--help"], { encoding: "utf8" });
    assert.match(result, /test-summary/);
  });

  describe("baseline shape inheritance", () => {
    function seedBaseline(tmp, baseline) {
      makeFlowManager(tmp).setTestSummary(baseline, { baseline: true });
    }

    it("inherits unspecified count fields from baseline when legacy flag partial input", () => {
      tmp = setupFlowEnv(createTmpDir());
      seedBaseline(tmp, { unit: 100, integration: 20, acceptance: 0, exitCode: 0 });
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary", "--unit", "10"], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      const flow = makeFlowManager(tmp).load();
      assert.equal(flow.test.summary.unit, 10);
      assert.equal(flow.test.summary.integration, 20);
      assert.equal(flow.test.summary.acceptance, 0);
    });

    it("inherits unspecified count fields from baseline when --json counts partial", () => {
      tmp = setupFlowEnv(createTmpDir());
      seedBaseline(tmp, { unit: 100, integration: 20, acceptance: 0, exitCode: 0 });
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary", "--json", JSON.stringify({ counts: { unit: 10 } })], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      const flow = makeFlowManager(tmp).load();
      assert.equal(flow.test.summary.unit, 10);
      assert.equal(flow.test.summary.integration, 20);
      assert.equal(flow.test.summary.acceptance, 0);
    });

    it("preserves current behavior when baseline is absent", () => {
      tmp = setupFlowEnv(createTmpDir());
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary", "--unit", "10"], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      const flow = makeFlowManager(tmp).load();
      assert.deepEqual(flow.test.summary, { unit: 10 });
      assert.equal(flow.test.summary.integration, undefined);
      assert.equal(flow.test.summary.acceptance, undefined);
    });

    it("does not inherit exitCode even if baseline has it", () => {
      tmp = setupFlowEnv(createTmpDir());
      seedBaseline(tmp, { unit: 100, exitCode: 0 });
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary", "--unit", "10"], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      const flow = makeFlowManager(tmp).load();
      assert.equal(flow.test.summary.exitCode, undefined);
    });

    it("does not apply inheritance in --mode fallback", () => {
      tmp = setupFlowEnv(createTmpDir());
      seedBaseline(tmp, { unit: 100, integration: 20, acceptance: 0, exitCode: 0 });
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary", "--json", JSON.stringify({ failed: [{ id: "t", reason: "r" }] }), "--mode", "fallback"], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      const flow = makeFlowManager(tmp).load();
      assert.deepEqual(flow.test.summary.failed, [{ id: "t", reason: "r" }]);
      assert.equal(flow.test.summary.unit, undefined);
      assert.equal(flow.test.summary.integration, undefined);
      assert.equal(flow.test.summary.acceptance, undefined);
    });

    it("does not inherit when writing to --baseline target itself", () => {
      tmp = setupFlowEnv(createTmpDir());
      seedBaseline(tmp, { unit: 100, integration: 20, acceptance: 0 });
      // Rewrite baseline with only --unit. Inheritance must NOT apply to baseline writes.
      // Note: the seeded baseline has no exitCode so TEST_SUMMARY_LOCKED does not trigger.
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary", "--baseline", "--unit", "10"], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      const flow = makeFlowManager(tmp).load();
      assert.deepEqual(flow.test.baseline, { unit: 10 });
    });

    it("leaves undefined fields undefined when baseline lacks the same field", () => {
      tmp = setupFlowEnv(createTmpDir());
      seedBaseline(tmp, { unit: 100 });
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "test-summary", "--integration", "5"], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      const flow = makeFlowManager(tmp).load();
      assert.equal(flow.test.summary.integration, 5);
      assert.equal(flow.test.summary.unit, 100);
      assert.equal(flow.test.summary.acceptance, undefined);
    });
  });
});
