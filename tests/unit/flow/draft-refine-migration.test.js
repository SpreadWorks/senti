import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/definition.js";

function writeFlowWithoutDraftRefine(tmp, overrides = {}) {
  const specId = "001-test";
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  const steps = buildInitialSteps();
  const plan = steps.find((s) => s.id === "plan");
  plan.children = plan.children.filter((s) => s.id !== "draft-refine");
  const state = {
    spec: `specs/${specId}/spec.md`,
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps,
    requirements: [],
    tasks: [],
    currentTaskId: null,
    ...overrides,
  };
  fs.writeFileSync(path.join(specDir, "flow.json"), JSON.stringify(state, null, 2) + "\n");
  return specId;
}

describe("draft-refine flow-state migration", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("inserts draft-refine before pending draft coverage review", () => {
    tmp = createTmpDir();
    const specId = writeFlowWithoutDraftRefine(tmp);
    const loaded = makeFlowManager(tmp).load(specId);

    const refine = findStepById(loaded.steps, "draft-refine");
    const coverage = findStepById(loaded.steps, "draft-coverage-review");

    assert.equal(refine.status, "pending");
    assert.equal(coverage.status, "pending");
    const planIds = loaded.steps.find((s) => s.id === "plan").children.map((s) => s.id);
    assert.ok(planIds.indexOf("draft-questions-review") < planIds.indexOf("draft-refine"));
    assert.ok(planIds.indexOf("draft-refine") < planIds.indexOf("draft-coverage-review"));
  });

  it("marks draft-refine done when draft coverage already started", () => {
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
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps,
      requirements: [],
      tasks: [],
      currentTaskId: null,
    }, null, 2) + "\n");

    const loaded = makeFlowManager(tmp).load(specId);
    const refine = findStepById(loaded.steps, "draft-refine");

    assert.equal(refine.status, "done");
    assert.equal(refine.finishedAt, "2026-05-13T00:00:00.000Z");
  });
});
