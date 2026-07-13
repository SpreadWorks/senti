import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";

function writeFlowWithoutDraftRefine(tmp, overrides = {}) {
  const specId = "001-test";
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  const steps = buildInitialSteps();
  const plan = steps.find((s) => s.id === "plan");
  plan.children = plan.children.filter((s) => s.id !== "draft-refine");
  const state = {
    spec: `specs/${specId}/spec.json`,
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps,
    requirements: [],
    tasks: [],
    currentTaskId: null,
    runId: "legacy-draft-refine",
    ...overrides,
  };
  fs.writeFileSync(path.join(specDir, "flow.json"), JSON.stringify(state, null, 2) + "\n");
  return specId;
}

describe("legacy draft-refine flow-state rejection", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("rejects a missing draft-refine leaf without changing bytes", () => {
    tmp = createTmpDir();
    const specId = writeFlowWithoutDraftRefine(tmp);
    const flowPath = path.join(tmp, "specs", specId, "flow.json");
    const before = fs.readFileSync(flowPath);
    assert.throws(
      () => makeFlowManager(tmp).load(specId),
      (error) => error.code === "FLOW_STATE_SCHEMA_UNSUPPORTED",
    );
    assert.deepEqual(fs.readFileSync(flowPath), before);
  });

  it("does not synthesize draft-refine for a started legacy flow", () => {
    tmp = createTmpDir();
    const steps = buildInitialSteps();
    findStepById(steps, "draft-refine").status = "pending";
    findStepById(steps, "draft-coverage-review").status = "in_progress";
    findStepById(steps, "draft-coverage-review").startedAt = "2026-05-13T00:00:00.000Z";
    const plan = steps.find((s) => s.id === "plan");
    plan.children = plan.children.filter((s) => s.id !== "draft-refine");

    const specId = "001-test";
    const specDir = path.join(tmp, "specs", specId);
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "flow.json"), JSON.stringify({
      spec: `specs/${specId}/spec.json`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps,
      requirements: [],
      tasks: [],
      currentTaskId: null,
      runId: "legacy-started-draft-refine",
    }, null, 2) + "\n");

    const flowPath = path.join(specDir, "flow.json");
    const before = fs.readFileSync(flowPath);
    assert.throws(
      () => makeFlowManager(tmp).load(specId),
      (error) => error.code === "FLOW_STATE_SCHEMA_UNSUPPORTED",
    );
    assert.deepEqual(fs.readFileSync(flowPath), before);
  });
});
