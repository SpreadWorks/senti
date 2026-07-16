import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { makeFlowManager, replaceFlowState, setupFlow } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_PATH = "specs/001-test/spec.json";

function writeJson(root, relativePath, value) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function testExecuteArtifact() {
  return {
    version: "2",
    raw_output_path: "specs/001-test/tests/.raw/test-execution.log",
    summary: [],
    regression: {
      required: false,
      changed_files: [],
      trigger_relevant_changed_files: [],
      category: "spec-artifact-only",
      reason: "unit fixture",
      classified_paths: [],
    },
  };
}

function testResultReviewArtifact() {
  return {
    verdict: "pass",
    checked_items: [{
      check: "project_regression_verification",
      result: "pass",
      detail: "unit fixture",
    }],
    result_file_path: "specs/001-test/test-execute-result.json",
    raw_output_path: "specs/001-test/tests/.raw/test-execution.log",
  };
}

function setupPostHookFlow(root, stepId) {
  const state = setupFlow(root, {
    spec: SPEC_PATH,
    tasks: [{
      id: "T-1",
      title: "task",
      goal: "task",
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "in_progress",
      steps: [
        { id: "task-impl", status: "in_progress" },
        { id: "task-review", status: "pending" },
        { id: "task-gate", status: "pending" },
      ],
    }],
    currentTaskId: "T-1",
  });
  findStepById(state.steps, stepId).status = "in_progress";
  replaceFlowState(root, state);
  return state;
}

function assertFlowStepCompletedWithoutTaskMutation(root, stepId) {
  const state = makeFlowManager(root).load();
  assert.equal(findStepById(state.steps, stepId).status, "done");
  assert.equal(state.tasks[0].steps[0].status, "in_progress");
  assert.equal(state.currentTaskId, "T-1");
}

function assertScopesUnchanged(root, stepId) {
  const state = makeFlowManager(root).load();
  assert.equal(findStepById(state.steps, stepId).status, "in_progress");
  assert.equal(state.tasks[0].steps[0].status, "in_progress");
  assert.equal(state.currentTaskId, "T-1");
}

describe("flow-level artifact post-hook scope", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("completes test-execute at flow scope when currentTaskId is non-null", async () => {
    tmp = createTmpDir("unit-test-execute-post-hook-scope-");
    const flowState = setupPostHookFlow(tmp, "test-execute");
    writeJson(tmp, "specs/001-test/test-execute-result.json", testExecuteArtifact());

    await FLOW_COMMANDS.run["test-execute"].post({
      root: tmp,
      flowState,
      flowManager: makeFlowManager(tmp),
    });

    assertFlowStepCompletedWithoutTaskMutation(tmp, "test-execute");
  });

  it("completes test-result-review at flow scope when currentTaskId is non-null", async () => {
    tmp = createTmpDir("unit-test-result-review-post-hook-scope-");
    const flowState = setupPostHookFlow(tmp, "test-result-review");
    writeJson(tmp, "specs/001-test/test-result-review.json", testResultReviewArtifact());

    await FLOW_COMMANDS.run["test-result-review"].post({
      root: tmp,
      flowState,
      flowManager: makeFlowManager(tmp),
    });

    assertFlowStepCompletedWithoutTaskMutation(tmp, "test-result-review");
  });

  it("keeps both scopes unchanged when test-execute artifact validation fails", async () => {
    tmp = createTmpDir("unit-test-execute-post-hook-atomicity-");
    const flowState = setupPostHookFlow(tmp, "test-execute");
    writeJson(tmp, "specs/001-test/test-execute-result.json", {
      ...testExecuteArtifact(),
      version: "1",
    });

    await assert.rejects(
      FLOW_COMMANDS.run["test-execute"].post({
        root: tmp,
        flowState,
        flowManager: makeFlowManager(tmp),
      }),
      /expected '2'/,
    );

    assertScopesUnchanged(tmp, "test-execute");
  });

  it("keeps both scopes unchanged when test-result-review artifact validation fails", async () => {
    tmp = createTmpDir("unit-test-result-review-post-hook-atomicity-");
    const flowState = setupPostHookFlow(tmp, "test-result-review");
    writeJson(tmp, "specs/001-test/test-result-review.json", {
      ...testResultReviewArtifact(),
      verdict: "fail",
    });

    await assert.rejects(
      FLOW_COMMANDS.run["test-result-review"].post({
        root: tmp,
        flowState,
        flowManager: makeFlowManager(tmp),
      }),
      /verdict is not pass/,
    );

    assertScopesUnchanged(tmp, "test-result-review");
  });
});
