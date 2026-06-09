import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";
import { makeFlowState, setStepDone, makeFlowManager } from "../../../helpers/flow-setup.js";
import { findStepById } from "../../../../src/flow/lib/step-tree.js";
const FLOW_CMD = join(process.cwd(), "src/sdd-forge.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

describe("flow get check impl", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("PASS when spec-gate and test are both done", () => {
    tmp = createTmpDir();
    const state = makeFlowState();
    setStepDone(state, "spec-gate", "test");
    findStepById(state.steps, "test-review").status = "skipped";
    makeFlowManager(tmp).save(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "local");
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "check", "impl"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    assert.match(result, /pass.*true/is);
  });

  it("PASS when spec-gate is done and test is skipped", () => {
    tmp = createTmpDir();
    const state = makeFlowState();
    setStepDone(state, "spec-gate");
    findStepById(state.steps, "test").status = "skipped";
    findStepById(state.steps, "test-review").status = "skipped";
    makeFlowManager(tmp).save(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "local");
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "check", "impl"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    assert.match(result, /pass.*true/is);
  });

  it("FAIL when test-review (last plan-branch leaf) is not done", () => {
    // In the definition-based model, the only cross-branch prerequisite for
    // `implement` is `test-review` (the last leaf of the preceding `plan` branch).
    tmp = createTmpDir();
    const state = makeFlowState();
    // spec-gate and test are done but test-review is NOT done → prereq not met.
    setStepDone(state, "spec-gate", "test");
    makeFlowManager(tmp).save(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "local");
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "check", "impl"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    assert.match(result, /pass.*false/is);
    assert.match(result, /test-review/);
  });

  it("returns ok:true with pass:false when no flow.json exists", () => {
    tmp = createTmpDir();
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "check", "impl"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.pass, false);
    assert.match(envelope.data.summary, /no active flow/);
  });
});
