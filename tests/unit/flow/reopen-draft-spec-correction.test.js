import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Container } from "../../../src/lib/container.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { buildInitialSteps, FLOW_STEPS } from "../../../src/lib/flow-helpers.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { resolveFlowContext } from "../../../src/flow/lib/flow-context.js";
import { RunReopenDraftCommand } from "../../../src/flow/lib/run-reopen-draft.js";
import { findInProgressLeaf, findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { makeDefaultTask } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "441-reopen-spec-correction";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;

function makeContainer(root, { mainRoot = root, inWorktree = false, flowManager } = {}) {
  const container = new Container();
  container.register("paths", { root });
  container.register("mainRoot", mainRoot);
  container.register("inWorktree", inWorktree);
  container.register("config", { lang: "en", type: "base", docs: { languages: ["en"], defaultLanguage: "en" } });
  container.register("flowManager", flowManager || new FlowManager({ root, mainRoot, inWorktree }));
  return container;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function implementationSteps(activeStep = "implement") {
  const steps = buildInitialSteps();
  const targetIndex = FLOW_STEPS.indexOf(activeStep);
  assert.notEqual(targetIndex, -1, activeStep);
  for (const [index, id] of FLOW_STEPS.entries()) {
    const step = findStepById(steps, id);
    step.status = index < targetIndex ? "done" : index === targetIndex ? "in_progress" : "pending";
  }
  return steps;
}

function task(overrides) {
  return makeDefaultTask({
    ...overrides,
    steps: [
      { id: "task-impl", status: "pending" },
      { id: "task-review", status: "pending" },
      { id: "task-gate", status: "pending" },
    ],
  });
}

function fixturePaths(root) {
  const specDir = path.join(root, "specs", SPEC_ID);
  return {
    flow: path.join(specDir, "flow.json"),
    spec: path.join(specDir, "spec.json"),
    issueLog: path.join(specDir, "issue-log.json"),
    draft: path.join(specDir, "draft.json"),
    evidence: path.join(specDir, "test-execute-result.json"),
    source: path.join(root, "src", "partial-implementation.js"),
  };
}

function setupFlow(root, { issue = 441, activeStep = "implement", doneTask = false, mainRoot = root, inWorktree = false } = {}) {
  const files = fixturePaths(root);
  writeJson(files.spec, {
    goal: "fixture",
    requirements: [],
    tasks: [],
    user_approval: { approved: true, confirmed_at: "2026-07-13T00:00:00Z", notes: "must stay byte-identical" },
  });
  writeJson(files.issueLog, { entries: [{ marker: "must stay byte-identical" }] });
  writeJson(files.draft, { approval: { approved: true }, marker: "must stay byte-identical" });
  writeJson(files.evidence, { version: "2", result: "pass", marker: "must stay byte-identical" });
  fs.mkdirSync(path.dirname(files.source), { recursive: true });
  fs.writeFileSync(files.source, "export const partial = true;\n");
  const state = {
    spec: SPEC_PATH,
    baseBranch: "main",
    featureBranch: `feature/${SPEC_ID}`,
    runId: "run-441",
    ...(issue == null ? {} : { issue }),
    worktree: inWorktree,
    steps: implementationSteps(activeStep),
    requirements: [],
    tasks: doneTask
      ? [task({ id: "T-1", status: "done" }), task({ id: "T-2", status: "in_progress" })]
      : [task({ id: "T-1", status: "pending" })],
    currentTaskId: doneTask ? "T-2" : null,
    metrics: [
      { phase: "spec", counter: "gateRetry", delta: 1, taskId: null, ts: "2026-07-13T00:00:00Z" },
      { phase: "test", counter: "reviewRetry", delta: 1, taskId: null, ts: "2026-07-13T00:00:00Z" },
    ],
    retryLimits: { gate: 5, review: 4 },
  };
  const fm = new FlowManager({ root, mainRoot, inWorktree });
  fm.save(state);
  fm.addActiveFlow(SPEC_ID, inWorktree ? "worktree" : "local");
  return { files, state };
}

function targetInput(overrides = {}) {
  return {
    reason: "Source verification found a contradictory target requirement.",
    category: "spec-correction",
    expectRunId: "run-441",
    expectIssue: "441",
    expectSpec: SPEC_PATH,
    _envelopeType: "run",
    _envelopeKey: "reopen-draft",
    ...overrides,
  };
}

function snapshot(files) {
  return Object.fromEntries(Object.entries(files).map(([key, file]) => [
    key,
    fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null,
  ]));
}

async function runDirect(root, input = targetInput(), options = {}) {
  return new RunReopenDraftCommand().run(makeContainer(root, options), input);
}

describe("guarded single-state reopen for source-discovered spec corrections", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("uses one public atomic flow save and leaves every non-flow byte unchanged", async () => {
    tmp = createTmpDir("reopen-single-state-");
    const { files } = setupFlow(tmp);
    const before = snapshot(files);
    const container = makeContainer(tmp);
    const fm = container.get("flowManager");
    let saves = 0;
    const saveAtomic = fm.saveAtomic.bind(fm);
    fm.saveAtomic = (state, options) => { saves += 1; return saveAtomic(state, options); };
    fm.save = () => { throw new Error("non-atomic save must not be used"); };
    fm.mutate = () => { throw new Error("mutate must not be used for spec-correction"); };

    const result = await new RunReopenDraftCommand().run(container, targetInput());

    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(saves, 1);
    const after = snapshot(files);
    assert.notEqual(after.flow, before.flow);
    for (const key of ["spec", "issueLog", "draft", "evidence", "source"]) assert.equal(after[key], before[key], key);
    const state = JSON.parse(fs.readFileSync(files.flow, "utf8"));
    assert.deepEqual(flattenSteps(state.steps).filter((step) => step.status === "in_progress").map((step) => step.id), ["draft"]);
    assert.equal(findStepById(state.steps, "approval").status, "pending");
    assert.equal(state.currentTaskId, null);
    assert.deepEqual(state.metrics, [
      { phase: "spec", counter: "gateRetry", delta: 1, taskId: null, ts: "2026-07-13T00:00:00Z" },
      { phase: "test", counter: "reviewRetry", delta: 1, taskId: null, ts: "2026-07-13T00:00:00Z" },
    ]);
    assert.deepEqual(state.retryLimits, { gate: 5, review: 4 });
    const audit = state.planRewinds.at(-1);
    assert.equal(audit.category, "spec-correction");
    assert.equal(audit.reason, targetInput().reason);
    assert.deepEqual(audit.invalidatedPhases, ["plan", "impl"]);
    assert.equal(audit.previousState.activeStep, "implement");
    assert.equal(audit.previousState.stepStatuses.approval, "done");
    assert.doesNotMatch(JSON.stringify(audit), /originIssue|Issue #441/);
  });

  it("accepts explicit Issue presence or absence without fabricating identity", async () => {
    for (const issue of [987, null]) {
      tmp = createTmpDir(`reopen-issue-${issue ?? "none"}-`);
      const { files } = setupFlow(tmp, { issue });
      const input = issue == null
        ? targetInput({ expectIssue: undefined, expectNoIssue: true })
        : targetInput({ expectIssue: String(issue) });
      const result = await runDirect(tmp, input);
      assert.equal(result.ok, true, JSON.stringify(result.errors));
      const state = JSON.parse(fs.readFileSync(files.flow, "utf8"));
      assert.equal(state.issue ?? null, issue);
      assert.doesNotMatch(JSON.stringify(state.planRewinds.at(-1)), /originIssue|Issue #441/);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("rejects unknown categories, missing correction inputs, and target mismatches with all bytes unchanged", async () => {
    const cases = [
      ["unknown category", { category: "typo" }, "ARGS_ERROR"],
      ["missing reason", { reason: "" }, "INVALID_REASON"],
      ["missing run", { expectRunId: undefined }, "TARGET_GUARDS_REQUIRED"],
      ["missing spec", { expectSpec: undefined }, "TARGET_GUARDS_REQUIRED"],
      ["missing issue", { expectIssue: undefined }, "TARGET_GUARDS_REQUIRED"],
      ["wrong run", { expectRunId: "wrong" }, "ACTIVE_FLOW_MISMATCH"],
      ["wrong spec", { expectSpec: "specs/999-wrong/spec.json" }, "ACTIVE_FLOW_MISMATCH"],
      ["wrong issue", { expectIssue: "999" }, "ACTIVE_FLOW_MISMATCH"],
      ["zero issue", { expectIssue: "0" }, "ARGS_ERROR"],
      ["negative issue", { expectIssue: "-1" }, "ARGS_ERROR"],
      ["fractional issue", { expectIssue: "1.5" }, "ARGS_ERROR"],
      ["conflicting issue", { expectNoIssue: true }, "ARGS_ERROR"],
      ["unexpected issue absence", { expectIssue: undefined, expectNoIssue: true }, "ACTIVE_FLOW_MISMATCH"],
    ];
    for (const [name, overrides, code] of cases) {
      tmp = createTmpDir(`reopen-${name.replaceAll(" ", "-")}-`);
      const { files } = setupFlow(tmp);
      const before = snapshot(files);
      const result = await runDirect(tmp, targetInput(overrides));
      assert.equal(result.ok, false, name);
      assert.equal(result.errors[0].code, code, name);
      assert.deepEqual(snapshot(files), before, name);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("requires the explicit absence guard for an Issue-less flow", async () => {
    for (const overrides of [
      { expectIssue: undefined },
      { expectIssue: "441", expectNoIssue: false },
    ]) {
      tmp = createTmpDir("reopen-issue-less-guard-");
      const { files } = setupFlow(tmp, { issue: null });
      const before = snapshot(files);
      const result = await runDirect(tmp, targetInput(overrides));
      assert.equal(result.ok, false);
      assert.equal(
        result.errors[0].code,
        overrides.expectIssue == null ? "TARGET_GUARDS_REQUIRED" : "ACTIVE_FLOW_MISMATCH",
      );
      assert.deepEqual(snapshot(files), before);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("rechecks implement and zero-done eligibility after guards without changing bytes", async () => {
    for (const options of [{ activeStep: "finalize-merge" }, { doneTask: true }]) {
      tmp = createTmpDir("reopen-ineligible-");
      const { files } = setupFlow(tmp, options);
      const before = snapshot(files);
      const result = await runDirect(tmp);
      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "REOPEN_STAGE_UNSUPPORTED");
      assert.deepEqual(snapshot(files), before);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("keeps old bytes when the public atomic save fails before replacement", async () => {
    tmp = createTmpDir("reopen-save-failure-");
    const { files } = setupFlow(tmp);
    const before = snapshot(files);
    const container = makeContainer(tmp);
    container.get("flowManager").saveAtomic = () => {
      const err = new Error("injected atomic save failure");
      err.code = "FLOW_STATE_ATOMIC_SAVE_FAILED";
      err.committed = false;
      throw err;
    };

    const result = await new RunReopenDraftCommand().run(container, targetInput());

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_STATE_ATOMIC_SAVE_FAILED");
    assert.deepEqual(snapshot(files), before);
  });

  it("preserves the existing plan and task-addition routes", async () => {
    tmp = createTmpDir("reopen-plan-route-");
    let fixture = setupFlow(tmp, { activeStep: "spec" });
    const planBefore = JSON.parse(fs.readFileSync(fixture.files.flow, "utf8"));
    const plan = await runDirect(tmp, targetInput({ category: undefined }));
    assert.equal(plan.ok, true, JSON.stringify(plan.errors));
    const planAfter = JSON.parse(fs.readFileSync(fixture.files.flow, "utf8"));
    assert.equal(findInProgressLeaf(planAfter.steps).id, "draft");
    assert.deepEqual(planAfter.tasks, planBefore.tasks);
    assert.deepEqual(planAfter.metrics, planBefore.metrics);
    assert.equal(planAfter.currentTaskId, planBefore.currentTaskId);

    removeTmpDir(tmp);
    tmp = createTmpDir("reopen-task-route-");
    fixture = setupFlow(tmp, { doneTask: true });
    const taskBefore = JSON.parse(fs.readFileSync(fixture.files.flow, "utf8"));
    const addition = await runDirect(tmp, targetInput({ category: "task-addition" }));
    assert.equal(addition.ok, true, JSON.stringify(addition.errors));
    const taskAfter = JSON.parse(fs.readFileSync(fixture.files.flow, "utf8"));
    assert.deepEqual(taskAfter.tasks, taskBefore.tasks);
    assert.deepEqual(taskAfter.metrics, taskBefore.metrics);
    assert.equal(taskAfter.currentTaskId, taskBefore.currentTaskId);
  });

  it("uses the dispatcher-resolved bound worktree authority without reloading main", async () => {
    tmp = createTmpDir("reopen-dispatch-authority-");
    const worktree = path.join(tmp, ".senti", "worktree", `feature-${SPEC_ID}`);
    const { files } = setupFlow(worktree, { mainRoot: tmp, inWorktree: true });
    const mainFiles = fixturePaths(tmp);
    writeJson(mainFiles.spec, { marker: "main spec" });
    writeJson(mainFiles.issueLog, { entries: [{ marker: "main log" }] });
    const worktreeBefore = snapshot(files);
    const mainBefore = snapshot(mainFiles);
    const worktreeFm = new FlowManager({ root: worktree, mainRoot: tmp, inWorktree: true });
    worktreeFm.pathForCurrent = () => { throw new Error("command must not reload flow path after context resolution"); };
    const container = makeContainer(worktree, {
      mainRoot: tmp,
      inWorktree: true,
      flowManager: worktreeFm,
    });
    const out = [];
    let exitCode = null;

    await dispatch({
      container,
      entry: FLOW_COMMANDS.run["reopen-draft"],
      argv: [
        "--category", "spec-correction",
        "--reason", targetInput().reason,
        "--expect-run-id", "run-441",
        "--expect-spec", SPEC_PATH,
        "--expect-issue", "441",
      ],
      envelopeType: "run",
      envelopeKey: "reopen-draft",
      stdout: (chunk) => out.push(chunk),
      stderr: () => {},
      setExitCode: (code) => { exitCode = code; },
      buildHookCtx: (c, input) => resolveFlowContext(c, {
        explicitTargetResolution: FLOW_COMMANDS.run["reopen-draft"].explicitTargetResolution === true,
        input,
      }),
    });

    const envelope = JSON.parse(out.join(""));
    assert.equal(exitCode, 0, JSON.stringify(envelope));
    assert.equal(envelope.ok, true);
    const worktreeAfter = snapshot(files);
    assert.notEqual(worktreeAfter.flow, worktreeBefore.flow);
    for (const key of ["spec", "issueLog", "draft", "evidence", "source"]) {
      assert.equal(worktreeAfter[key], worktreeBefore[key], key);
    }
    assert.deepEqual(snapshot(mainFiles), mainBefore);
    assert.notEqual(FLOW_COMMANDS.run["reopen-draft"].explicitTargetResolution, true);
    assert.equal(FLOW_COMMANDS.get["runtime-log"].explicitTargetResolution, true);
  });
});
