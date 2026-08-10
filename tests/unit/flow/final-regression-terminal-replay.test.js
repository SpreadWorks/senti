import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { captureRepairBaseline } from "../../../src/flow/lib/repair-state-identity.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";

describe("final-regression terminal replay guard", () => {
  let root;
  let invocationFile;

  afterEach(() => {
    if (root) removeTmpDir(root);
    if (invocationFile) fs.rmSync(invocationFile, { force: true });
  });

  it("does not execute the project command for unchanged non-retryable evidence", async () => {
    root = createTmpDir("final-regression-terminal-replay-");
    invocationFile = path.join(os.tmpdir(), `sennel-final-regression-${process.pid}-${Date.now()}.log`);
    fs.mkdirSync(path.join(root, ".sennel"), { recursive: true });
    writeFile(root, "specs/001-test/spec.md", "# Spec\n");
    writeFile(root, "final-regression-fixture.sh", [
      `printf '%s\\n' invoked >> ${JSON.stringify(invocationFile)}`,
      "exit 1",
      "",
    ].join("\n"));
    initGitRepo(root);
    commitAll(root, "initial");

    const runId = "run-terminal-replay";
    const repairBaseline = captureRepairBaseline({ root, baseRef: "main", runId });
    const state = moveFlowToStep(makeFlowState({
      runId,
      repairBaseline: repairBaseline.toJSON(),
    }), "final-regression");
    const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false });
    flowManager.create(state);
    const config = { test: { command: "sh final-regression-fixture.sh", timeout: 5 } };

    const first = await new RunFinalRegressionCommand().execute({
      root,
      config,
      flowState: flowManager.loadReadOnly(),
      flowManager,
    });
    const second = await new RunFinalRegressionCommand().execute({
      root,
      config,
      flowState: flowManager.loadReadOnly(),
      flowManager,
    });

    assert.equal(first.errors[0].code, "FINAL_REGRESSION_FAILED");
    assert.equal(first.data.retryable, false);
    assert.equal(second.errors[0].code, "FINAL_REGRESSION_NON_RETRYABLE_INPUT_UNCHANGED");
    assert.equal(second.data.retryable, false);
    assert.match(second.data.recoveryHint, /Inspect|Change|repair/i);
    assert.equal(fs.readFileSync(invocationFile, "utf8"), "invoked\n");
    assert.equal(fs.existsSync(path.join(root, "specs/001-test/tests/.raw/final-regression-attempt-002.log")), false);
  });

  it("executes again when non-retryable final-regression input changes", async () => {
    root = createTmpDir("final-regression-terminal-changed-");
    invocationFile = path.join(os.tmpdir(), `sennel-final-regression-changed-${process.pid}-${Date.now()}.log`);
    fs.mkdirSync(path.join(root, ".sennel"), { recursive: true });
    writeFile(root, "specs/001-test/spec.md", "# Spec\n");
    const scriptPath = "final-regression-fixture.sh";
    const script = [
      `printf '%s\\n' invoked >> ${JSON.stringify(invocationFile)}`,
      "exit 1",
      "",
    ].join("\n");
    writeFile(root, scriptPath, script);
    initGitRepo(root);
    commitAll(root, "initial");

    const runId = "run-terminal-changed";
    const repairBaseline = captureRepairBaseline({ root, baseRef: "main", runId });
    const state = moveFlowToStep(makeFlowState({
      runId,
      repairBaseline: repairBaseline.toJSON(),
    }), "final-regression");
    const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false });
    flowManager.create(state);
    const config = { test: { command: `sh ${scriptPath}`, timeout: 5 } };

    const first = await new RunFinalRegressionCommand().execute({
      root,
      config,
      flowState: flowManager.loadReadOnly(),
      flowManager,
    });
    writeFile(root, scriptPath, `# repaired input\n${script}`);
    const second = await new RunFinalRegressionCommand().execute({
      root,
      config,
      flowState: flowManager.loadReadOnly(),
      flowManager,
    });

    assert.equal(first.errors[0].code, "FINAL_REGRESSION_FAILED");
    assert.equal(second.errors[0].code, "FINAL_REGRESSION_FAILED");
    assert.equal(fs.readFileSync(invocationFile, "utf8"), "invoked\ninvoked\n");
    assert.equal(fs.existsSync(path.join(root, "specs/001-test/tests/.raw/final-regression-attempt-002.log")), true);
  });
});
