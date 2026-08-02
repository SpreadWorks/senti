import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";

function writeFlowWithoutSpecRepair(tmp, mutate = () => {}) {
  const specId = "001-test";
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  const steps = buildInitialSteps();
  const plan = steps.find((s) => s.id === "plan");
  plan.children = plan.children.filter((s) => s.id !== "spec-triage");
  plan.children = plan.children.filter((s) => s.id !== "spec-repair");
  mutate(steps);
  fs.writeFileSync(path.join(specDir, "flow.json"), JSON.stringify({
    specId: specId,
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps,
    requirements: [],
    tasks: [],
    currentTaskId: null,
    runId: "legacy-spec-repair",
  }, null, 2) + "\n");
  return specId;
}

describe("legacy spec-repair flow-state rejection", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("rejects missing spec repair leaves without changing bytes", () => {
    tmp = createTmpDir();
    const specId = writeFlowWithoutSpecRepair(tmp);
    const flowPath = path.join(tmp, "specs", specId, "flow.json");
    const before = fs.readFileSync(flowPath);
    assert.throws(
      () => makeFlowManager(tmp).load(specId),
      (error) => error.code === "FLOW_STATE_SCHEMA_UNSUPPORTED",
    );
    assert.deepEqual(fs.readFileSync(flowPath), before);
  });

  it("does not synthesize spec repair leaves for a started legacy flow", () => {
    tmp = createTmpDir();
    const specId = writeFlowWithoutSpecRepair(tmp, (steps) => {
      const gate = findStepById(steps, "spec-gate");
      gate.status = "in_progress";
      gate.startedAt = "2026-05-13T00:00:00.000Z";
    });
    const flowPath = path.join(tmp, "specs", specId, "flow.json");
    const before = fs.readFileSync(flowPath);
    assert.throws(
      () => makeFlowManager(tmp).load(specId),
      (error) => error.code === "FLOW_STATE_SCHEMA_UNSUPPORTED",
    );
    assert.deepEqual(fs.readFileSync(flowPath), before);
  });
});
