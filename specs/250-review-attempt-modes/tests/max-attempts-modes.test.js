// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13 R14 R15 R16 R17 R18
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeFlowManager, replaceFlowState } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import {
  FlowNode,
  collectFlowNodes,
  collectTaskNodes,
  buildInitialTaskSteps,
  deriveNextAction,
  resolveNodeFor,
} from "../../../src/flow/definition.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { getReviewMaxAttempts } from "../../../src/flow/commands/review.js";
import * as runGate from "../../../src/flow/lib/run-gate.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cli = path.join(root, "src/senti.js");
const FLOW_DEFINITION = collectFlowNodes();
const TASK_DEFINITION = collectTaskNodes();

function runCli(tmp, args) {
  const out = execFileSync("node", [cli, ...args], {
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
  });
  return JSON.parse(out).data;
}

function setupFlow(tmp, overrides = {}) {
  const state = {
    spec: "specs/250-review-attempt-modes/spec.json",
    runId: "run-250-review-attempt-modes",
    baseBranch: "main",
    featureBranch: "feature/250-review-attempt-modes",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
    ...overrides,
  };
  const fm = makeFlowManager(tmp);
  fm.create(state);
  fm.addActiveFlow("250-review-attempt-modes", "local");
  return state;
}

function setFlowStep(state, stepId) {
  for (const step of flattenSteps(state.steps)) step.status = "pending";
  const target = findStepById(state.steps, stepId);
  assert.ok(target, `step ${stepId} exists`);
  target.status = "in_progress";
}

function setTaskStep(state, taskId, stepId) {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  assert.ok(task, `task ${taskId} exists`);
  for (const step of task.steps) step.status = "pending";
  const target = task.steps.find((candidate) => candidate.id === stepId);
  assert.ok(target, `task step ${stepId} exists`);
  target.status = "in_progress";
  state.currentTaskId = taskId;
}

function text(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

describe("mode-specific flow maxAttempts", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R1: FlowNode accepts scalar and mode-specific maxAttempts values", () => {
    const scalar = new FlowNode({ id: "scalar", label: "Scalar", maxAttempts: 2 });
    const modeSpecific = new FlowNode({
      id: "mode",
      label: "Mode",
      maxAttempts: { auto: 1, manual: 5 },
    });

    assert.equal(scalar.resolveMaxAttempts({ autoApprove: true }), 2);
    assert.equal(modeSpecific.resolveMaxAttempts({ autoApprove: true }), 1);
  });

  it("R2: FlowNode rejects invalid maxAttempts values", () => {
    const invalid = [
      0,
      -1,
      1.5,
      NaN,
      "3",
      { auto: 1 },
      { manual: 5 },
      { auto: 1.5, manual: 5 },
      { auto: 1, manual: 0 },
    ];

    for (const maxAttempts of invalid) {
      assert.throws(
        () => new FlowNode({ id: "bad", label: "Bad", maxAttempts }),
        /maxAttempts/,
        `rejects ${JSON.stringify(maxAttempts)}`,
      );
    }
  });

  it("R3: scalar maxAttempts resolves identically in auto and manual modes", () => {
    const node = new FlowNode({ id: "scalar", label: "Scalar", maxAttempts: 7 });
    assert.equal(node.resolveMaxAttempts({ autoApprove: true }), 7);
    assert.equal(node.resolveMaxAttempts({ autoApprove: false }), 7);
    assert.equal(node.resolveMaxAttempts({}), 7);
  });

  it("R4: mode-specific maxAttempts resolves by flow.autoApprove", () => {
    const node = new FlowNode({
      id: "review-draft",
      label: "Review draft",
      maxAttempts: { auto: 1, manual: 5 },
    });

    assert.equal(node.resolveMaxAttempts({ autoApprove: true }), 1);
    assert.equal(node.resolveMaxAttempts({ autoApprove: false }), 5);
    assert.equal(node.resolveMaxAttempts({}), 5);
  });

  it("R5: next-action exposes resolved numeric maxAttempts, not raw objects", () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp, { autoApprove: true });
    setFlowStep(state, "draft-questions-review");
    replaceFlowState(tmp, state);

    const next = runCli(tmp, ["flow", "get", "next-action"]);
    assert.equal(next.step, "draft-questions-review");
    assert.equal(next.maxAttempts, 1);
    assert.equal(typeof next.maxAttempts, "number");
  });

  it("R6: plan review nodes use the approved mode-specific retry budgets", () => {
    const draft = resolveNodeFor(FLOW_DEFINITION, "draft-questions-review");
    const spec = resolveNodeFor(FLOW_DEFINITION, "spec-review");
    const test = resolveNodeFor(FLOW_DEFINITION, "test-review");

    assert.equal(draft.resolveMaxAttempts({ autoApprove: true }), 1);
    assert.equal(draft.resolveMaxAttempts({ autoApprove: false }), 1);
    assert.equal(spec.resolveMaxAttempts({ autoApprove: true }), 4);
    assert.equal(spec.resolveMaxAttempts({ autoApprove: false }), 4);
    assert.equal(test.resolveMaxAttempts({ autoApprove: true }), 5);
    assert.equal(test.resolveMaxAttempts({ autoApprove: false }), 5);
  });

  it("R7: gate nodes and implementation review keep scalar retry limits", () => {
    const expected = [
      ["draft-gate", 5],
      ["spec-gate", 5],
      ["impl-gate", 5],
      ["impl-review", 4],
    ];

    for (const [stepId, limit] of expected) {
      const node = resolveNodeFor(FLOW_DEFINITION, stepId);
      assert.equal(node.resolveMaxAttempts({ autoApprove: true }), limit);
      assert.equal(node.resolveMaxAttempts({ autoApprove: false }), limit);
    }
  });

  it("R8: draft review prompt stops automatic re-review and retains draft-gate ownership", () => {
    const prompt = text("src/flow/prompts/plan/draft-questions-review.md");
    assert.match(prompt, /do not.*re-run this stage automatically/i);
    assert.match(prompt, /Draft-gate remains the blocking validation step/);
  });

  it("R9: regression tests cover validation, resolution, payloads, consumers, and exhaustion behavior", () => {
    const source = text("specs/250-review-attempt-modes/tests/max-attempts-modes.test.js");
    for (const id of ["R1:", "R2:", "R4:", "R5:", "R8:", "R16:", "R17:"]) {
      assert.ok(source.includes(id), `${id} has an explicit regression test`);
    }
  });

  it("R10: task-scope next-action exposes numeric scalar maxAttempts", () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp, {
      autoApprove: true,
      tasks: [{
        id: "T-1",
        spec: "specs/250-review-attempt-modes/tasks/T-1.md",
        origin: "plan",
        parent: null,
        status: "in_progress",
        steps: buildInitialTaskSteps(),
        requirements: [],
      }],
    });
    setTaskStep(state, "T-1", "task-review");
    replaceFlowState(tmp, state);

    const next = runCli(tmp, ["flow", "get", "next-action"]);
    assert.equal(next.taskId, "T-1");
    assert.equal(next.step, "task-review");
    assert.equal(next.maxAttempts, 1);
  });

  it("R11: subprocess retry remains separate from node maxAttempts wording", () => {
    const source = text("src/flow/lib/run-review.js");
    assert.match(source, /mechanical subprocess retry/i);
    assert.match(source, /This does not consume the step retry budget/);
    assert.match(source, /resolveMaxAttempts/, "semantic review budget still resolves from the flow definition");
  });

  it("R12: dispatcher template describes resolved numeric maxAttempts from next-action", () => {
    const template = text("src/skills/senti.flow/SKILL.md");
    assert.match(template, /resolved numeric maxAttempts/i);
    assert.match(template, /next-action envelope/i);
  });

  it("R13: no active or completed next-action omits maxAttempts", () => {
    tmp = createTmpDir();
    let next = runCli(tmp, ["flow", "get", "next-action"]);
    assert.equal(next.step, null);
    assert.equal(Object.hasOwn(next, "maxAttempts"), false);

    const state = setupFlow(tmp);
    for (const step of flattenSteps(state.steps)) step.status = "done";
    replaceFlowState(tmp, state);
    next = runCli(tmp, ["flow", "get", "next-action"]);
    assert.equal(next.step, null);
    assert.equal(Object.hasOwn(next, "maxAttempts"), false);
  });

  it("R14: dispatcher template consumes the resolved next-action maxAttempts", () => {
    const template = text("src/skills/senti.flow/SKILL.md");
    assert.doesNotMatch(template, /definition's maxAttempts limit/i);
    assert.match(template, /Retry limits.*maxAttempts.*next-action envelope/is);
  });

  it("R15: review prompts refer to resolved numeric maxAttempts", () => {
    const promptPaths = [
      "src/flow/prompts/plan/draft-questions-review.md",
      "src/flow/prompts/plan/draft-coverage-review.md",
      "src/flow/prompts/plan/spec-review.md",
      "src/flow/prompts/plan/test-review.md",
      "src/flow/prompts/impl/impl-review.md",
      "src/flow/prompts/task/task-review.md",
    ];

    for (const promptPath of promptPaths) {
      const prompt = text(promptPath);
      assert.match(prompt, /resolved numeric maxAttempts/i, promptPath);
      assert.doesNotMatch(prompt, /definition's maxAttempts/i, promptPath);
    }
  });

  it("R16: review command maxAttempts resolution uses loaded flow.autoApprove", () => {
    assert.equal(getReviewMaxAttempts("draft-questions", { autoApprove: true }), 1);
    assert.equal(getReviewMaxAttempts("draft-questions", { autoApprove: false }), 1);
    assert.equal(getReviewMaxAttempts("spec", { autoApprove: true }), 4);
    assert.equal(getReviewMaxAttempts("test", { autoApprove: false }), 5);
  });

  it("R17: gate retry resolution preserves flow and task scope", () => {
    assert.equal(typeof runGate.resolveRetryMax, "function");
    assert.equal(runGate.resolveRetryMax({ scope: "flow", autoApprove: true }, "spec"), 5);
    assert.equal(runGate.resolveRetryMax({ scope: "flow", autoApprove: true }, "task-impl"), 5);
    assert.equal(runGate.resolveRetryMax({ scope: "task", autoApprove: true }, "task-impl"), 5);

    const flowGate = deriveNextAction({ scope: "flow", stepId: "impl-gate" });
    const taskGate = deriveNextAction({ scope: "task", stepId: "task-gate" });
    assert.equal(flowGate.maxAttempts, 5);
    assert.equal(taskGate.maxAttempts, 5);
  });

  it("R18: mode-specific maxAttempts accepts only exact plain own auto/manual keys", () => {
    const inherited = Object.create({ auto: 1, manual: 5 });
    const invalid = [
      inherited,
      Object.assign([1, 5], { auto: 1, manual: 5 }),
      { auto: 1, manual: 5, extra: 9 },
      null,
      new Number(3),
    ];

    for (const maxAttempts of invalid) {
      assert.throws(
        () => new FlowNode({ id: "bad-shape", label: "Bad shape", maxAttempts }),
        /maxAttempts/,
      );
    }
  });
});
