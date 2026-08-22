import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../support/builders/tmp-dir.js";
import { commitAll, initGitRepo } from "../../support/infrastructure/git-repo.js";
import { FlowAtStepFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";

const SPEC_ID = "001-test";
const SCRIPT_PATH = "final-regression-fixture.sh";

function setupCanonical(root, script) {
  writeFile(root, SCRIPT_PATH, script);
  initGitRepo(root);
  commitAll(root, "initial");
  const flowManager = makeFlowManager(root);
  const fixture = new FlowAtStepFixture({
    flowManager,
    specId: SPEC_ID,
    runId: "run-terminal-replay",
    request: "Verify terminal final-regression replay.",
    execution: { mode: "direct", baseBranch: "main", featureBranch: "main" },
    specRecord: { goal: "Verify terminal final-regression replay.", requirements: [] },
    targetStep: "final-regression",
  }).create();
  commitAll(root, "record canonical final-regression frontier");
  return {
    root,
    mainRoot: root,
    executionRoot: root,
    specId: SPEC_ID,
    config: { test: { command: `sh ${SCRIPT_PATH}`, timeout: 5 } },
    flowManager,
    flowState: fixture.state(),
  };
}

describe("final-regression terminal replay guard", () => {
  let root;
  let invocationFile;

  afterEach(() => {
    if (root) removeTmpDir(root);
    if (invocationFile) fs.rmSync(invocationFile, { force: true });
  });

  it("does not execute the project command for a terminal failed Attempt replay", async () => {
    root = createTmpDir("final-regression-terminal-replay-");
    invocationFile = path.join(os.tmpdir(), `sennel-final-regression-${process.pid}-${Date.now()}.log`);
    const ctx = setupCanonical(root, [
      `printf '%s\\n' invoked >> ${JSON.stringify(invocationFile)}`,
      "exit 1",
      "",
    ].join("\n"));

    const first = await new RunFinalRegressionCommand().execute(ctx);
    ctx.flowState = ctx.flowManager.loadReadOnly(SPEC_ID);
    const second = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(first.result, "fail");
    assert.equal(first.artifacts.retryable, false);
    assert.equal(second.result, "fail");
    assert.equal(second.artifacts.retryable, false);
    assert.equal(second.artifacts.replayed, true);
    assert.equal(fs.readFileSync(invocationFile, "utf8"), "invoked\n");
    assert.equal(fs.existsSync(path.join(
      root,
      "specs/001-test/001/steps/final-regression/attempt-002.log",
    )), false);
  });

  it("does not infer a retry of a non-retryable Attempt from input drift", async () => {
    root = createTmpDir("final-regression-terminal-changed-");
    invocationFile = path.join(os.tmpdir(), `sennel-final-regression-changed-${process.pid}-${Date.now()}.log`);
    const script = [
      `printf '%s\\n' invoked >> ${JSON.stringify(invocationFile)}`,
      "exit 1",
      "",
    ].join("\n");
    const ctx = setupCanonical(root, script);

    const first = await new RunFinalRegressionCommand().execute(ctx);
    writeFile(root, SCRIPT_PATH, `# changed input\n${script}`);
    ctx.flowState = ctx.flowManager.loadReadOnly(SPEC_ID);
    const second = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(first.result, "fail");
    assert.equal(second.result, "fail");
    assert.equal(second.artifacts.replayed, true);
    assert.equal(fs.readFileSync(invocationFile, "utf8"), "invoked\n");
    assert.equal(fs.existsSync(path.join(
      root,
      "specs/001-test/001/steps/final-regression/attempt-002.log",
    )), false);
  });
});
