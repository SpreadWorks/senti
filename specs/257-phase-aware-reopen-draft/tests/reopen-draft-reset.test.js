// spec: R1 R2 R3 R4 R5 R8
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { setupFlow, makeFlowManager, makeDefaultTask } from "../../../tests/helpers/flow-setup.js";
import { findStepById, flattenSteps } from "../../../src/flow/definition.js";
import { RunReopenDraftCommand } from "../../../src/flow/lib/run-reopen-draft.js";

const SPEC_REL = "specs/257-phase-aware-reopen-draft/spec.json";
const SPEC_DIR = "specs/257-phase-aware-reopen-draft";
const PLAN_RESET_IDS = [
  "review-draft-questions",
  "draft-refine",
  "review-draft-coverage",
  "gate-draft",
  "spec",
  "review-spec",
  "spec-repair",
  "gate",
  "approval",
  "test",
  "review-test",
];

function writeArtifacts(root) {
  const dir = path.join(root, SPEC_DIR);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of [
    ["spec.json", "{}\n"],
    ["spec.md", "# stale spec\n"],
    ["draft.json", "{}\n"],
    ["issue.md", "# issue\n"],
    ["test.md", "# test design\n"],
  ]) {
    fs.writeFileSync(path.join(dir, name), content);
  }
}

function setPlanState(root, activeStep) {
  const fm = makeFlowManager(root);
  fm.mutate((state) => {
    for (const step of flattenSteps(state.steps)) step.status = "pending";
    for (const id of ["branch", "prepare-spec", "draft", "review-draft-questions", "draft-refine", "review-draft-coverage", "gate-draft"]) {
      const step = findStepById(state.steps, id);
      if (step) step.status = "done";
    }
    if (activeStep === "test") {
      for (const id of ["spec", "review-spec", "spec-repair", "gate", "approval"]) {
        const step = findStepById(state.steps, id);
        if (step) step.status = "done";
      }
    }
    findStepById(state.steps, activeStep).status = "in_progress";
    state.tasks = [];
    state.currentTaskId = null;
  });
}

function setupPlanFlow(root, activeStep) {
  setupFlow(root, { spec: SPEC_REL, tasks: [], currentTaskId: null });
  writeArtifacts(root);
  setPlanState(root, activeStep);
}

function loadFlow(root) {
  return makeFlowManager(root).load();
}

function loadIssueLog(root) {
  return JSON.parse(fs.readFileSync(path.join(root, SPEC_DIR, "issue-log.json"), "utf8"));
}

async function runReopen(root, reason = "missing draft QA") {
  const cmd = new RunReopenDraftCommand();
  return cmd.execute({ root, config: {}, reason });
}

describe("spec 257 reopen-draft reset matrix", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R1: pre-spec plan reopen succeeds without tasks or done tasks", async () => {
    tmp = createTmpDir();
    setupPlanFlow(tmp, "spec");

    const result = await runReopen(tmp, "spec discovered missing user decision");

    assert.equal(result.ok, true, JSON.stringify(result.errors));
    const state = loadFlow(tmp);
    assert.equal(findStepById(state.steps, "draft").status, "in_progress");
  });

  it("R2: plan reopen resets downstream steps for pre-spec and post-approval", async () => {
    tmp = createTmpDir();
    setupPlanFlow(tmp, "spec");

    await runReopen(tmp, "reset pre spec matrix");

    const state = loadFlow(tmp);
    for (const id of PLAN_RESET_IDS) {
      assert.equal(findStepById(state.steps, id).status, "pending", `${id} should be pending`);
    }

    removeTmpDir(tmp);
    tmp = createTmpDir();
    setupPlanFlow(tmp, "test");

    await runReopen(tmp, "reset post approval matrix");

    const postApprovalState = loadFlow(tmp);
    for (const id of ["approval", "test", "review-test"]) {
      assert.equal(findStepById(postApprovalState.steps, id).status, "pending", `${id} should be pending`);
    }
  });

  it("R3: plan reopen preserves existing spec artifacts", async () => {
    tmp = createTmpDir();
    setupPlanFlow(tmp, "spec");

    await runReopen(tmp, "preserve stale planning artifacts");

    for (const name of ["spec.json", "spec.md", "draft.json", "issue.md", "test.md"]) {
      assert.equal(fs.existsSync(path.join(tmp, SPEC_DIR, name)), true, `${name} should remain`);
    }
  });

  it("R4: plan reopen records reason and stale context in issue-log", async () => {
    tmp = createTmpDir();
    setupPlanFlow(tmp, "spec");

    await runReopen(tmp, "draft needs product decision");

    const log = loadIssueLog(tmp);
    assert.ok(log.entries.some((entry) => {
      const text = `${entry.reason}\n${entry.trigger || ""}\n${entry.resolution || ""}`;
      return text.includes("draft needs product decision") && /stale/i.test(text);
    }));
  });

  it("R5: implementation reopen preserves done-task precondition and narrow reset", async () => {
    tmp = createTmpDir();
    setupFlow(tmp, {
      spec: SPEC_REL,
      currentTaskId: "T-empty",
      tasks: [],
    });
    writeArtifacts(tmp);

    const emptyTasks = await runReopen(tmp, "implementation has no tasks");

    assert.equal(emptyTasks.ok, false);
    assert.equal(emptyTasks.errors[0].code, "NO_DONE_TASK");

    removeTmpDir(tmp);
    tmp = createTmpDir();
    setupFlow(tmp, {
      spec: SPEC_REL,
      currentTaskId: "T-1",
      tasks: [makeDefaultTask({ id: "T-1", status: "in_progress" })],
    });
    writeArtifacts(tmp);

    const result = await runReopen(tmp, "implementation needs more tasks");

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "NO_DONE_TASK");

    removeTmpDir(tmp);
    tmp = createTmpDir();
    setupFlow(tmp, {
      spec: SPEC_REL,
      currentTaskId: "T-2",
      tasks: [
        makeDefaultTask({ id: "T-1", status: "done" }),
        makeDefaultTask({ id: "T-2", status: "in_progress" }),
      ],
    });
    writeArtifacts(tmp);
    makeFlowManager(tmp).mutate((state) => {
      findStepById(state.steps, "approval").status = "done";
    });

    const success = await runReopen(tmp, "implementation needs follow up task");

    assert.equal(success.ok, true, JSON.stringify(success.errors));
    const state = loadFlow(tmp);
    assert.equal(findStepById(state.steps, "draft").status, "in_progress");
    assert.equal(findStepById(state.steps, "gate-draft").status, "pending");
    assert.notEqual(findStepById(state.steps, "approval").status, "pending");
  });

  it("R8: reset matrix tests cover pre-spec, post-approval, and implementation paths", async () => {
    tmp = createTmpDir();
    setupPlanFlow(tmp, "spec");

    await runReopen(tmp, "coverage pre spec path");

    const preSpecState = loadFlow(tmp);
    assert.equal(findStepById(preSpecState.steps, "draft").status, "in_progress");
    assert.equal(findStepById(preSpecState.steps, "spec").status, "pending");
    assert.equal(fs.existsSync(path.join(tmp, SPEC_DIR, "spec.md")), true);
    assert.ok(loadIssueLog(tmp).entries.some((entry) => /stale/i.test(`${entry.reason}\n${entry.resolution}`)));

    removeTmpDir(tmp);
    tmp = createTmpDir();
    setupPlanFlow(tmp, "test");

    await runReopen(tmp, "coverage post approval path");

    const postApprovalState = loadFlow(tmp);
    assert.equal(findStepById(postApprovalState.steps, "approval").status, "pending");
    assert.equal(findStepById(postApprovalState.steps, "test").status, "pending");

    removeTmpDir(tmp);
    tmp = createTmpDir();
    setupFlow(tmp, {
      spec: SPEC_REL,
      currentTaskId: "T-empty",
      tasks: [],
    });

    const emptyTasks = await runReopen(tmp, "coverage implementation empty task path");

    assert.equal(emptyTasks.ok, false);
    assert.equal(emptyTasks.errors[0].code, "NO_DONE_TASK");

    removeTmpDir(tmp);
    tmp = createTmpDir();
    setupFlow(tmp, {
      spec: SPEC_REL,
      currentTaskId: "T-2",
      tasks: [
        makeDefaultTask({ id: "T-1", status: "done" }),
        makeDefaultTask({ id: "T-2", status: "in_progress" }),
      ],
    });
    makeFlowManager(tmp).mutate((state) => {
      findStepById(state.steps, "approval").status = "done";
    });

    const doneTask = await runReopen(tmp, "coverage implementation done task path");

    assert.equal(doneTask.ok, true, JSON.stringify(doneTask.errors));
    const implementationState = loadFlow(tmp);
    assert.equal(findStepById(implementationState.steps, "draft").status, "in_progress");
    assert.equal(findStepById(implementationState.steps, "gate-draft").status, "pending");
    assert.notEqual(findStepById(implementationState.steps, "approval").status, "pending");
  });
});
