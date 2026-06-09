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
    spec: `specs/${specId}/spec.md`,
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps,
    requirements: [],
    tasks: [],
    currentTaskId: null,
  }, null, 2) + "\n");
  return specId;
}

describe("spec-repair flow-state migration", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("inserts spec-triage and spec-repair before pending spec gate", () => {
    tmp = createTmpDir();
    const specId = writeFlowWithoutSpecRepair(tmp);
    const loaded = makeFlowManager(tmp).load(specId);

    const triage = findStepById(loaded.steps, "spec-triage");
    const repair = findStepById(loaded.steps, "spec-repair");
    const gate = findStepById(loaded.steps, "spec-gate");

    assert.equal(triage.status, "pending");
    assert.equal(repair.status, "pending");
    assert.equal(gate.status, "pending");
    const planIds = loaded.steps.find((s) => s.id === "plan").children.map((s) => s.id);
    assert.ok(planIds.indexOf("spec-review") < planIds.indexOf("spec-triage"));
    assert.ok(planIds.indexOf("spec-triage") < planIds.indexOf("spec-repair"));
    assert.ok(planIds.indexOf("spec-repair") < planIds.indexOf("spec-gate"));
  });

  it("marks spec-triage and spec-repair done when spec gate already started", () => {
    tmp = createTmpDir();
    const specId = writeFlowWithoutSpecRepair(tmp, (steps) => {
      const gate = findStepById(steps, "spec-gate");
      gate.status = "in_progress";
      gate.startedAt = "2026-05-13T00:00:00.000Z";
    });
    const loaded = makeFlowManager(tmp).load(specId);
    const triage = findStepById(loaded.steps, "spec-triage");
    const repair = findStepById(loaded.steps, "spec-repair");

    assert.equal(triage.status, "done");
    assert.equal(triage.finishedAt, "2026-05-13T00:00:00.000Z");
    assert.equal(repair.status, "done");
    assert.equal(repair.finishedAt, "2026-05-13T00:00:00.000Z");
  });
});
