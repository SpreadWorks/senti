/**
 * Spec 209 verification: set-test-summary 拡張
 *
 * Verifies:
 * - REQ-9: failed[] のスキーマ検証（id 1〜200 文字, reason ≤ 500 文字）
 * - REQ-4: --mode fallback で exitCode / counts を変更せず failed[] のみ書き込む
 * - REQ-5: --baseline フラグで保存先が test.baseline になる
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";
import { buildInitialSteps, specIdFromPath } from "../../../src/lib/flow-helpers.js";

const FLOW_CMD = join(process.cwd(), "src/sdd-forge.js");

function setupEnv(tmp) {
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "js", type: "cli",
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
  const specPath = "specs/209-test/spec.md";
  writeFile(tmp, specPath, "# Spec\n");
  makeFlowManager(tmp).save({
    spec: specPath, baseBranch: "main", featureBranch: "feature/t",
    steps: buildInitialSteps(),
  });
  makeFlowManager(tmp).addActiveFlow(specIdFromPath(specPath), "branch");
  return tmp;
}

function runCLI(args, tmp, expectFail = false) {
  try {
    const out = execFileSync("node", [FLOW_CMD, "flow", ...args], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    return JSON.parse(out);
  } catch (err) {
    if (!expectFail) throw err;
    return JSON.parse(err.stdout || err.stderr || "{}");
  }
}

describe("spec 209: set test-summary — failed[] support", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("accepts --json with failed[] and saves to test.summary", () => {
    tmp = setupEnv(createTmpDir());
    const payload = JSON.stringify({
      counts: { unit: 3, failed: 1 },
      failed: [{ id: "test_a", reason: "AssertionError" }],
    });
    const result = runCLI(["set", "test-summary", "--json", payload], tmp);
    assert.equal(result.ok, true);
    const flow = makeFlowManager(tmp).load();
    assert.deepEqual(flow.test.summary.failed, [{ id: "test_a", reason: "AssertionError" }]);
  });

  it("rejects empty id in failed[]", () => {
    tmp = setupEnv(createTmpDir());
    const payload = JSON.stringify({
      counts: { failed: 1 },
      failed: [{ id: "", reason: "x" }],
    });
    const result = runCLI(["set", "test-summary", "--json", payload], tmp, true);
    assert.equal(result.ok, false);
  });

  it("--mode fallback preserves existing exitCode/counts, writes only failed[]", () => {
    tmp = setupEnv(createTmpDir());
    // Pre-populate tool-measured values
    const fm = makeFlowManager(tmp);
    const state = fm.load();
    state.test = {
      summary: { unit: 10, integration: 5, exitCode: 1 },
    };
    fm.save(state);

    const payload = JSON.stringify({
      failed: [{ id: "t1", reason: "r1" }, { id: "t2", reason: "r2" }],
    });
    const result = runCLI(["set", "test-summary", "--mode", "fallback", "--json", payload], tmp);
    assert.equal(result.ok, true);

    const flow = fm.load();
    assert.equal(flow.test.summary.unit, 10, "unit preserved");
    assert.equal(flow.test.summary.integration, 5, "integration preserved");
    assert.equal(flow.test.summary.exitCode, 1, "exitCode preserved");
    assert.equal(flow.test.summary.failed.length, 2);
    assert.equal(flow.test.summary.failed[0].id, "t1");
  });

  it("--baseline flag routes to test.baseline", () => {
    tmp = setupEnv(createTmpDir());
    const payload = JSON.stringify({
      counts: { unit: 2, failed: 1 },
      failed: [{ id: "pre_existing", reason: "known failure" }],
    });
    const result = runCLI(["set", "test-summary", "--baseline", "--json", payload], tmp);
    assert.equal(result.ok, true);
    const flow = makeFlowManager(tmp).load();
    assert.ok(flow.test.baseline, "test.baseline exists");
    assert.equal(flow.test.baseline.failed[0].id, "pre_existing");
    assert.equal(flow.test.summary, undefined, "test.summary not written");
  });

  it("baseline tool monopoly: rejects AI write when baseline.exitCode is present", () => {
    tmp = setupEnv(createTmpDir());
    const fm = makeFlowManager(tmp);
    const state = fm.load();
    state.test = { baseline: { unit: 10, exitCode: 0 } };
    fm.save(state);

    const payload = JSON.stringify({
      counts: { unit: 20 },
      failed: [],
    });
    const result = runCLI(["set", "test-summary", "--baseline", "--json", payload], tmp, true);
    assert.equal(result.ok, false);
  });
});
