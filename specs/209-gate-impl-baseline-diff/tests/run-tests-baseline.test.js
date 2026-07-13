/**
 * Spec 209 verification: flow run tests の --baseline / summarized envelope
 *
 * Verifies:
 * - REQ-1: --baseline 指定で logs/baseline-test-output.log に保存、test.baseline に記録
 * - REQ-1: 通常時は logs/test-output.log + test.summary
 * - REQ-3: agent 失敗時は envelope に summarized="failed" を付けて返す
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { buildInitialSteps, specIdFromPath } from "../../../src/lib/flow-helpers.js";
import { Container } from "../../../src/lib/container.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { RunTestsCommand } from "../../../src/flow/lib/run-tests.js";

function makeCtxAgent(shouldFail = false) {
  return {
    resolve: () => true,
    call: async () => {
      if (shouldFail) throw new Error("agent unavailable");
      return JSON.stringify({ failed: [{ id: "test_x", reason: "ok" }] });
    },
  };
}

function setupProject(tmp, { testExitCode = 0 } = {}) {
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "js", type: "cli",
    docs: { languages: ["en"], defaultLanguage: "en" },
    commands: {
      test: {
        parent: `node -e "console.log('unit: 2'); process.exit(${testExitCode})"`,
      },
    },
  });
  const specPath = "specs/209-test/spec.json";
  writeFile(tmp, specPath, "{}\n");
  const fm = makeFlowManager(tmp);
  fm.create({
    spec: specPath, baseBranch: "main", featureBranch: "feature/t",
    steps: buildInitialSteps(),
  });
  fm.addActiveFlow(specIdFromPath(specPath), "branch");
}

function buildCtx(tmp, { baseline = false, agentFail = false } = {}) {
  const flowManager = new FlowManager({ root: tmp, mainRoot: tmp, inWorktree: false });
  const flowState = flowManager.load();
  const config = JSON.parse(fs.readFileSync(path.join(tmp, ".sdd-forge/config.json"), "utf8"));
  const container = new Container();
  container.register("agent", makeCtxAgent(agentFail));
  container.register("flowManager", flowManager);
  return {
    root: tmp,
    flowManager,
    flowState,
    config,
    container,
    baseline,
  };
}

describe("spec 209: flow run tests --baseline + summarized envelope", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("--baseline writes to logs/baseline-test-output.log and test.baseline", async () => {
    tmp = createTmpDir();
    setupProject(tmp);
    const ctx = buildCtx(tmp, { baseline: true });
    const cmd = new RunTestsCommand();
    const result = await cmd.execute(ctx);
    assert.equal(result.scope, "parent");
    assert.match(result.logPath, /baseline-test-output\.log$/);
    assert.ok(fs.existsSync(path.join(tmp, result.logPath)));
    const flow = ctx.flowManager.load();
    assert.ok(flow.test?.baseline, "test.baseline recorded");
    assert.equal(flow.test.baseline.exitCode, 0);
    assert.equal(flow.test.summary, undefined);
  });

  it("non-baseline writes to logs/test-output.log and test.summary", async () => {
    tmp = createTmpDir();
    setupProject(tmp);
    const ctx = buildCtx(tmp, { baseline: false });
    const cmd = new RunTestsCommand();
    const result = await cmd.execute(ctx);
    assert.match(result.logPath, /test-output\.log$/);
    assert.doesNotMatch(result.logPath, /baseline/);
    const flow = ctx.flowManager.load();
    assert.ok(flow.test?.summary);
    assert.equal(flow.test.baseline, undefined);
  });

  it("envelope.summarized=ok when agent succeeds, failed[] is recorded", async () => {
    tmp = createTmpDir();
    setupProject(tmp);
    const ctx = buildCtx(tmp, { baseline: false, agentFail: false });
    const cmd = new RunTestsCommand();
    const result = await cmd.execute(ctx);
    assert.equal(result.summarized, "ok");
    const flow = ctx.flowManager.load();
    assert.equal(flow.test.summary.failed[0].id, "test_x");
  });

  it("envelope.summarized=failed when agent throws, no failed[] stored", async () => {
    tmp = createTmpDir();
    setupProject(tmp);
    const ctx = buildCtx(tmp, { baseline: false, agentFail: true });
    const cmd = new RunTestsCommand();
    const result = await cmd.execute(ctx);
    assert.equal(result.summarized, "failed");
    assert.match(result.summarizeError ?? "", /agent unavailable/);
    const flow = ctx.flowManager.load();
    // tool-measured fields present, but failed[] not set
    assert.ok(flow.test.summary.exitCode != null);
    assert.equal(flow.test.summary.failed, undefined);
  });
});
