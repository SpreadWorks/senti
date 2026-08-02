import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Container } from "../../../src/lib/container.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  WorktreeFlowBindingStore,
  WorktreeFlowIdentity,
} from "../../../src/lib/worktree-flow-binding.js";
import { buildInitialSteps, FLOW_STEPS } from "../../../src/lib/flow-helpers.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { resolveFlowContext } from "../../../src/flow/lib/flow-context.js";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import { RunReopenDraftCommand } from "../../../src/flow/lib/run-reopen-draft.js";
import { SPEC_CORRECTION_SUPPORTED_STAGES } from "../../../src/flow/lib/plan-rewind.js";
import { ExplicitRecoveryTransition } from "../../../src/flow/lib/step-transition-policy.js";
import { findInProgressLeaf, findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { makeDefaultTask } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "441-reopen-spec-correction";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;
const SECOND_REASON = "A second source contradiction was verified.";
const THIRD_REASON = "A third source contradiction was verified.";

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

function task(overrides = {}) {
  const steps = overrides.steps ?? [
    { id: "task-impl", status: "pending" },
    { id: "task-review", status: "pending" },
    { id: "task-gate", status: "pending" },
  ];
  return makeDefaultTask({
    ...overrides,
    spec: overrides.spec ?? `specs/${SPEC_ID}/tasks/${overrides.id ?? "T-1"}.md`,
    requirements: overrides.requirements ?? [],
    summary: overrides.summary ?? null,
    steps,
  });
}

function startedTask(id = "T-1") {
  return task({
    id,
    status: "in_progress",
    steps: [
      {
        id: "task-impl",
        status: "in_progress",
        startedAt: "2026-07-13T00:02:00Z",
        runtimeLog: { sequence: 71, result: "partial implementation" },
      },
      { id: "task-review", status: "pending" },
      { id: "task-gate", status: "pending" },
    ],
    requirements: [{ id: "R1", desc: "old requirement", status: "pending" }],
  });
}

function completedTask(id = "T-1") {
  return task({
    id,
    status: "done",
    steps: ["task-impl", "task-review", "task-gate"].map((stepId, index) => ({
      id: stepId,
      status: "done",
      startedAt: `2026-07-13T00:0${index + 2}:00Z`,
      finishedAt: `2026-07-13T00:0${index + 3}:00Z`,
      runtimeLog: { sequence: 60 + index, result: `${stepId} passed` },
    })),
    requirements: [{ id: "R1", desc: "old requirement", status: "done" }],
    summary: "old completed implementation result",
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

function setupFlow(root, {
  issue = 441,
  activeStep = "implement",
  doneTask = false,
  currentTaskId,
  taskStatus,
  taskStepStatus,
  tasks: suppliedTasks,
  planRewinds,
  planRewindChain,
  mainRoot = root,
  inWorktree = false,
} = {}) {
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
  const steps = implementationSteps(activeStep);
  for (const id of ["draft-questions-review", "draft-gate", "spec-review", "spec-gate", "approval", "test-review", "implement"]) {
    const step = findStepById(steps, id);
    if (step?.status === "done" || step?.status === "in_progress") {
      step.startedAt = "2026-07-13T00:00:00Z";
      if (step.status === "done") step.finishedAt = "2026-07-13T00:01:00Z";
      step.runtimeLog = {
        sequence: id === "implement" ? 71 : id === "approval" ? 55 : 44,
        result: `${id} historical result`,
      };
    }
  }
  const state = {
    specId: SPEC_ID,
    baseBranch: "main",
    featureBranch: `feature/${SPEC_ID}`,
    runId: "run-441",
    ...(issue == null ? {} : { issue }),
    worktree: inWorktree,
    steps,
    requirements: [],
    tasks: suppliedTasks ?? (doneTask
      ? [completedTask("T-1"), startedTask("T-2")]
      : [task({ id: "T-1", status: taskStatus ?? "pending" })]),
    currentTaskId: currentTaskId === undefined ? (doneTask ? "T-2" : null) : currentTaskId,
    metrics: [
      { phase: "spec", counter: "gateRetry", delta: 1, taskId: null, ts: "2026-07-13T00:00:00Z" },
      { phase: "test", counter: "reviewRetry", delta: 1, taskId: null, ts: "2026-07-13T00:00:00Z" },
    ],
    retryLimits: { gate: 5, review: 4 },
    ...(planRewinds !== undefined && { planRewinds: structuredClone(planRewinds) }),
    ...(planRewindChain !== undefined && { planRewindChain: structuredClone(planRewindChain) }),
  };
  if (!doneTask && taskStepStatus) state.tasks[0].steps[0].status = taskStepStatus;
  const fm = new FlowManager({ root, mainRoot, inWorktree });
  fm.create(state);
  if (inWorktree) {
    new WorktreeFlowBindingStore({ worktreePath: root }).save(new WorktreeFlowIdentity({
      runId: state.runId,
      issue: Object.hasOwn(state, "issue") ? state.issue : null,
      specId: state.specId,
      worktreePath: root,
    }));
  }
  fm.addActiveFlow(SPEC_ID, inWorktree ? "worktree" : "local");
  return { files, state };
}

function targetInput(overrides = {}) {
  return {
    reason: "Source verification found a contradictory target requirement.",
    category: "spec-correction",
    expectRunId: "run-441",
    expectIssue: "441",
    expectSpec: SPEC_ID,
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

function interceptRecoverySave(flowManager, handler) {
  const forRoot = flowManager.forRoot.bind(flowManager);
  flowManager.forRoot = (root, options) => {
    const bound = forRoot(root, options);
    const saveRecoveryAtomic = bound.saveRecoveryAtomic.bind(bound);
    bound.saveRecoveryAtomic = (transition, recoveryOptions) => handler({
      root,
      options,
      transition,
      recoveryOptions,
      saveRecoveryAtomic,
    });
    return bound;
  };
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

async function setupConvergedReopen(root) {
  const fixture = setupFlow(root, { tasks: [startedTask("T-1")], currentTaskId: "T-1" });
  const first = await runDirect(root);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  return fixture;
}

function progressToStartedImplementation(files) {
  const state = JSON.parse(fs.readFileSync(files.flow, "utf8"));
  state.steps = implementationSteps("implement");
  state.tasks = [startedTask("T-1")];
  state.currentTaskId = "T-1";
  writeJson(files.flow, state);
}

async function setupTwoRewindHistory(root) {
  const fixture = await setupConvergedReopen(root);
  progressToStartedImplementation(fixture.files);
  const second = await runDirect(root, targetInput({ reason: SECOND_REASON }));
  assert.equal(second.ok, true, JSON.stringify(second.errors));
  progressToStartedImplementation(fixture.files);
  return fixture;
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
    interceptRecoverySave(fm, ({
      root,
      options,
      transition,
      recoveryOptions,
      saveRecoveryAtomic,
    }) => {
      assert.equal(root, tmp);
      assert.deepEqual(options, { specId: SPEC_ID });
      assert.ok(transition instanceof ExplicitRecoveryTransition);
      assert.equal(transition.entrypoint, "reopen-spec-correction");
      assert.deepEqual(transition.expectedOriginal, JSON.parse(fs.readFileSync(files.flow, "utf8")));
      saves += 1;
      return saveRecoveryAtomic(transition, recoveryOptions);
    });
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
    assert.equal(state.planRewinds.length, 1);
    const audit = state.planRewinds[0];
    assert.equal(audit.category, "spec-correction");
    assert.equal(audit.reason, targetInput().reason);
    assert.deepEqual(audit.invalidatedPhases, ["plan", "impl"]);
    assert.equal(audit.previousState.activeStep, "implement");
    assert.equal(audit.previousState.stepStatuses.approval, "done");
    const approval = audit.invalidatedResults.flowSteps.find((step) => step.id === "approval");
    assert.deepEqual(approval.runtimeLog, { sequence: 55, result: "approval historical result" });
    assert.equal(approval.status, "done");
    assert.deepEqual(audit.invalidatedResults.approvals, [{
      stepId: "approval",
      status: "done",
      userApproval: {
        approved: true,
        confirmed_at: "2026-07-13T00:00:00Z",
        notes: "must stay byte-identical",
      },
    }]);
    const implementation = audit.invalidatedResults.flowSteps.find((step) => step.id === "implement");
    assert.deepEqual(implementation.runtimeLog, { sequence: 71, result: "implement historical result" });
    assert.equal(implementation.status, "in_progress");
    assert.deepEqual(audit.invalidatedResults.tasks, []);
    assert.equal(audit.resultingState.activeStep, "draft");
    assert.equal(audit.resultingState.currentTaskId, null);
    assert.equal(audit.resultingState.stepStatuses.approval, "pending");
    assert.equal(findStepById(state.steps, "approval").runtimeLog, undefined);
    assert.doesNotMatch(JSON.stringify(audit), /originIssue|Issue #441/);
  });

  it("accepts every supported implementation stage for a spec correction", async () => {
    for (const activeStep of SPEC_CORRECTION_SUPPORTED_STAGES) {
      tmp = createTmpDir(`reopen-supported-stage-${activeStep}-`);
      const { files } = setupFlow(tmp, { activeStep });

      const result = await runDirect(tmp);

      assert.equal(result.ok, true, `${activeStep}: ${JSON.stringify(result.errors)}`);
      const state = JSON.parse(fs.readFileSync(files.flow, "utf8"));
      assert.equal(state.planRewinds.at(-1).previousState.activeStep, activeStep);
      assert.deepEqual(
        flattenSteps(state.steps).filter((step) => step.status === "in_progress").map((step) => step.id),
        ["draft"],
      );
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("accepts only an absent rewind history as the fresh-state genesis", async () => {
    tmp = createTmpDir("reopen-fresh-history-genesis-");
    const { files } = setupFlow(tmp);

    const result = await runDirect(tmp);

    assert.equal(result.ok, true, JSON.stringify(result.errors));
    const state = JSON.parse(fs.readFileSync(files.flow, "utf8"));
    assert.equal(state.planRewinds.length, 1);
    assert.deepEqual(state.planRewindChain, {
      version: 1,
      entryCount: 1,
      headDigest: state.planRewinds[0].entryDigest,
    });
  });

  it("rejects every present empty, partial, or non-array rewind authority without changing bytes", async () => {
    for (const [name, setup] of [
      ["unanchored-empty", { planRewinds: [] }],
      ["anchored-empty", {
        planRewinds: [],
        planRewindChain: { version: 1, entryCount: 0, headDigest: null },
      }],
      ["chain-only", {
        planRewindChain: { version: 1, entryCount: 0, headDigest: null },
      }],
      ["null", { planRewinds: null }],
      ["object", { planRewinds: { retained: "evidence" } }],
      ["string", { planRewinds: "retained evidence" }],
      ["number", { planRewinds: 7 }],
    ]) {
      tmp = createTmpDir(`reopen-invalid-history-${name}-`);
      const { files } = setupFlow(tmp, setup);
      const before = snapshot(files);

      const result = await runDirect(tmp);

      assert.equal(result.ok, false, name);
      assert.equal(result.errors[0].code, "REOPEN_AUDIT_INVALID", name);
      assert.deepEqual(snapshot(files), before, name);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("rejects laundering a valid rewind history through an empty anchored replacement", async () => {
    tmp = createTmpDir("reopen-reject-truncated-history-");
    const { files } = await setupConvergedReopen(tmp);
    progressToStartedImplementation(files);
    const truncated = JSON.parse(fs.readFileSync(files.flow, "utf8"));
    truncated.planRewinds = [];
    truncated.planRewindChain = { version: 1, entryCount: 0, headDigest: null };
    writeJson(files.flow, truncated);
    const before = snapshot(files);

    const result = await runDirect(tmp, targetInput({ reason: SECOND_REASON }));

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "REOPEN_AUDIT_INVALID");
    assert.deepEqual(snapshot(files), before);
  });

  it("appends a new correction without changing a valid historical audit", async () => {
    tmp = createTmpDir("reopen-append-valid-history-");
    const { files } = await setupConvergedReopen(tmp);
    const firstState = JSON.parse(fs.readFileSync(files.flow, "utf8"));
    const historicalAudit = structuredClone(firstState.planRewinds[0]);
    progressToStartedImplementation(files);

    const second = await runDirect(tmp, targetInput({ reason: SECOND_REASON }));

    assert.equal(second.ok, true, JSON.stringify(second.errors));
    const state = JSON.parse(fs.readFileSync(files.flow, "utf8"));
    assert.equal(state.planRewinds.length, 2);
    assert.deepEqual(state.planRewinds[0], historicalAudit);
    assert.equal(state.planRewinds[1].reason, SECOND_REASON);
    assert.match(state.planRewinds[0].entryDigest, /^[a-f0-9]{64}$/);
    assert.equal(state.planRewinds[0].previousEntryDigest, null);
    assert.match(state.planRewinds[1].entryDigest, /^[a-f0-9]{64}$/);
    assert.equal(state.planRewinds[1].previousEntryDigest, state.planRewinds[0].entryDigest);
    assert.deepEqual(state.planRewindChain, {
      version: 1,
      entryCount: 2,
      headDigest: state.planRewinds[1].entryDigest,
    });
    const convergedBytes = fs.readFileSync(files.flow);
    const retry = await runDirect(tmp, targetInput({ reason: SECOND_REASON }));
    assert.equal(retry.ok, true, JSON.stringify(retry.errors));
    assert.equal(retry.data.idempotent, true);
    assert.deepEqual(fs.readFileSync(files.flow), convergedBytes);
  });

  it("rejects a malformed historical audit before an implement-stage append", async () => {
    tmp = createTmpDir("reopen-reject-history-before-append-");
    const { files } = await setupConvergedReopen(tmp);
    const progressed = JSON.parse(fs.readFileSync(files.flow, "utf8"));
    progressed.steps = implementationSteps("implement");
    progressed.tasks = [startedTask("T-1")];
    progressed.currentTaskId = "T-1";
    progressed.planRewinds[0].unknownHistoricalField = true;
    writeJson(files.flow, progressed);
    const before = snapshot(files);

    const result = await runDirect(tmp, targetInput({ reason: "A second source contradiction was verified." }));

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "REOPEN_AUDIT_INVALID");
    assert.deepEqual(snapshot(files), before);
  });

  it("rejects every shape-valid history mutation before sealing another rewind", async () => {
    const cases = [
      ["reason", (state) => { state.planRewinds[0].reason = "shape-valid rewritten reason"; }],
      ["previous-state", (state) => { state.planRewinds[0].previousState.currentTaskId = null; }],
      ["resulting-state", (state) => {
        state.planRewinds[0].resultingState.tasks[0].requirementStatuses[0].id = "R-forged";
      }],
      ["invalidated-result", (state) => {
        state.planRewinds[0].invalidatedResults.tasks[0].requirements[0].desc = "rewritten evidence";
      }],
      ["runtime-log", (state) => {
        const implementation = state.planRewinds[0].invalidatedResults.flowSteps
          .find((step) => step.id === "implement");
        implementation.runtimeLog.result = "rewritten runtime evidence";
      }],
      ["state-digest", (state) => { state.planRewinds[0].stateDigest = "0".repeat(64); }],
      ["entry-digest", (state) => { state.planRewinds[0].entryDigest = "0".repeat(64); }],
      ["chain-link", (state) => { state.planRewinds[1].previousEntryDigest = "0".repeat(64); }],
      ["chain-authority", (state) => {
        state.planRewindChain = { ...(state.planRewindChain || {}), entryCount: 1 };
      }],
      ["delete", (state) => { state.planRewinds.shift(); }],
      ["duplicate", (state) => { state.planRewinds.push(structuredClone(state.planRewinds[0])); }],
      ["reorder", (state) => { state.planRewinds.reverse(); }],
    ];

    for (const [name, mutate] of cases) {
      tmp = createTmpDir(`reopen-chain-mutation-${name}-`);
      const { files } = await setupTwoRewindHistory(tmp);
      const state = JSON.parse(fs.readFileSync(files.flow, "utf8"));
      mutate(state);
      writeJson(files.flow, state);
      const before = snapshot(files);

      const result = await runDirect(tmp, targetInput({ reason: THIRD_REASON }));

      assert.equal(result.ok, false, name);
      assert.equal(result.errors[0].code, "REOPEN_AUDIT_INVALID", name);
      assert.deepEqual(snapshot(files), before, name);
      removeTmpDir(tmp);
      tmp = null;
    }
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
      ["wrong spec", { expectSpec: "999-wrong" }, "ACTIVE_FLOW_MISMATCH"],
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

  it("rechecks the implement-stage eligibility after guards without changing bytes", async () => {
    for (const options of [{ activeStep: "finalize-merge" }]) {
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

  it("rewinds in-progress and completed tasks without changing dirty implementation bytes", async () => {
    const cases = [
      ["in-progress", [startedTask("T-1")], "T-1"],
      ["completed-and-current", [completedTask("T-1"), startedTask("T-2")], "T-2"],
    ];
    for (const [name, tasks, currentTaskId] of cases) {
      tmp = createTmpDir(`reopen-started-task-${name}-`);
      git(tmp, ["init", "-q"]);
      const { files, state: originalState } = setupFlow(tmp, { tasks, currentTaskId });
      git(tmp, ["add", "."]);
      git(tmp, ["-c", "user.name=Senti Test", "-c", "user.email=senti@example.invalid", "commit", "-qm", "fixture"]);
      fs.writeFileSync(files.source, "export const partial = 'dirty implementation must survive';\n");
      const before = snapshot(files);
      const sourceStatus = git(tmp, ["status", "--short", "--", "src"]);

      const result = await runDirect(tmp);

      assert.equal(result.ok, true, JSON.stringify(result.errors));
      const after = snapshot(files);
      for (const key of ["spec", "issueLog", "draft", "evidence", "source"]) {
        assert.equal(after[key], before[key], `${name}:${key}`);
      }
      assert.equal(git(tmp, ["status", "--short", "--", "src"]), sourceStatus, name);
      const state = JSON.parse(fs.readFileSync(files.flow, "utf8"));
      assert.equal(state.currentTaskId, null, name);
      for (const rewoundTask of state.tasks) {
        assert.equal(rewoundTask.status, "pending", `${name}:${rewoundTask.id}`);
        assert.equal(rewoundTask.summary, null, `${name}:${rewoundTask.id}:summary`);
        assert.ok(rewoundTask.steps.every((step) => step.status === "pending"), `${name}:${rewoundTask.id}:steps`);
        assert.ok(rewoundTask.steps.every((step) => step.runtimeLog == null), `${name}:${rewoundTask.id}:runtimeLog`);
        assert.ok(rewoundTask.requirements.every((requirement) => requirement.status === "pending"), `${name}:${rewoundTask.id}:requirements`);
      }
      const audit = state.planRewinds.at(-1);
      assert.deepEqual(audit.invalidatedResults.tasks, originalState.tasks, name);
      assert.equal(audit.previousState.currentTaskId, currentTaskId, name);
      assert.deepEqual(
        audit.previousState.taskStatuses,
        Object.fromEntries(originalState.tasks.map((taskState) => [taskState.id, taskState.status])),
        name,
      );
      const next = await new GetNextActionCommand().run(makeContainer(tmp), targetInput());
      assert.equal(next.step, "draft", name);
      assert.equal(next.taskId, null, name);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("keeps old bytes when the public atomic save fails before replacement", async () => {
    tmp = createTmpDir("reopen-save-failure-");
    const { files } = setupFlow(tmp);
    const before = snapshot(files);
    const container = makeContainer(tmp);
    interceptRecoverySave(container.get("flowManager"), () => {
      const err = new Error("injected atomic save failure");
      err.code = "FLOW_STATE_ATOMIC_SAVE_FAILED";
      err.committed = false;
      err.path = files.flow;
      err.lockPath = `${files.flow}.writer.lock`;
      err.cleanupErrors = [{ phase: "cleanup", target: files.flow, message: "injected cleanup failure" }];
      err.residuePaths = [`${files.flow}.tmp`];
      throw err;
    });

    const result = await new RunReopenDraftCommand().run(container, targetInput());

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_STATE_ATOMIC_SAVE_FAILED");
    assert.deepEqual(result.data, {
      committed: false,
      statePath: files.flow,
      lockPath: `${files.flow}.writer.lock`,
      cleanupErrors: [{ phase: "cleanup", target: files.flow, message: "injected cleanup failure" }],
      residuePaths: [`${files.flow}.tmp`],
    });
    assert.deepEqual(snapshot(files), before);
  });

  it("fails closed before mutation when approval evidence cannot be preserved", async () => {
    tmp = createTmpDir("reopen-unreadable-approval-");
    const { files } = setupFlow(tmp);
    fs.writeFileSync(files.spec, "{invalid approval evidence\n");
    const before = snapshot(files);

    const result = await runDirect(tmp);

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "REOPEN_EVIDENCE_UNREADABLE");
    assert.deepEqual(snapshot(files), before);
  });

  it("rejects incomplete, unknown, contradictory, duplicate, and forged retry audits", async () => {
    const cases = [
      ["incomplete", (state) => { delete state.planRewinds[0].previousState; }],
      ["unknown-field", (state) => { state.planRewinds[0].unexpected = true; }],
      ["wrong-previous-state", (state) => { state.planRewinds[0].previousState.taskStatuses["T-1"] = "done"; }],
      ["wrong-invalidated-results", (state) => { state.planRewinds[0].invalidatedResults.approvals = []; }],
      ["duplicate", (state) => { state.planRewinds.push(structuredClone(state.planRewinds[0])); }],
      ["conflicting", (state) => {
        const conflict = structuredClone(state.planRewinds[0]);
        conflict.timestamp = "2026-07-13T23:59:59.000Z";
        conflict.previousState.currentTaskId = "T-foreign";
        state.planRewinds.push(conflict);
      }],
      ["matching-summary-forgery", (state) => {
        const audit = state.planRewinds[0];
        state.planRewinds = [{
          category: audit.category,
          reason: audit.reason,
          target: audit.target,
          resultingState: audit.resultingState,
        }];
      }],
    ];

    for (const [name, corrupt] of cases) {
      tmp = createTmpDir(`reopen-forged-audit-${name}-`);
      const { files } = await setupConvergedReopen(tmp);
      const state = JSON.parse(fs.readFileSync(files.flow, "utf8"));
      corrupt(state);
      writeJson(files.flow, state);
      const before = snapshot(files);

      const result = await runDirect(tmp);

      assert.equal(result.ok, false, name);
      assert.equal(result.errors[0].code, "REOPEN_AUDIT_INVALID", name);
      assert.deepEqual(snapshot(files), before, name);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("converges a committed durability fault and makes an exact retry mutation-free", async () => {
    tmp = createTmpDir("reopen-committed-retry-");
    const { files } = setupFlow(tmp, { tasks: [startedTask("T-1")], currentTaskId: "T-1" });
    const container = makeContainer(tmp);
    const fm = container.get("flowManager");
    let injected = false;
    interceptRecoverySave(fm, ({ transition, recoveryOptions, saveRecoveryAtomic }) => (
      saveRecoveryAtomic(transition, {
        ...recoveryOptions,
        faultInjector(event) {
          if (!injected && event.phase === "after-state-rename") {
            injected = true;
            throw new Error("simulated response loss after state replacement");
          }
        },
      })
    ));

    const first = await new RunReopenDraftCommand().run(container, targetInput());

    assert.equal(first.ok, true, JSON.stringify(first.errors));
    assert.equal(first.data.recoveredCommittedWrite, true);
    const convergedBytes = fs.readFileSync(files.flow);
    const converged = JSON.parse(convergedBytes);
    assert.equal(converged.planRewinds.length, 1);
    assert.match(converged.planRewinds[0].stateDigest, /^[a-f0-9]{64}$/);
    assert.equal(findInProgressLeaf(converged.steps).id, "draft");

    const retry = await runDirect(tmp);

    assert.equal(retry.ok, true, JSON.stringify(retry.errors));
    assert.equal(retry.data.idempotent, true);
    assert.deepEqual(fs.readFileSync(files.flow), convergedBytes);
    assert.equal(JSON.parse(fs.readFileSync(files.flow, "utf8")).planRewinds.length, 1);
  });

  it("does not convert a committed write error when authority differs from the expected transaction", async () => {
    tmp = createTmpDir("reopen-committed-divergence-");
    const { files } = setupFlow(tmp, { tasks: [startedTask("T-1")], currentTaskId: "T-1" });
    const container = makeContainer(tmp);
    const fm = container.get("flowManager");
    interceptRecoverySave(fm, ({ transition, recoveryOptions, saveRecoveryAtomic }) => (
      saveRecoveryAtomic(transition, {
        ...recoveryOptions,
        faultInjector(event) {
          if (event.phase !== "after-state-rename") return;
          const divergent = JSON.parse(fs.readFileSync(files.flow, "utf8"));
          divergent.postCommitCorruption = "must prevent success conversion";
          writeJson(files.flow, divergent);
          throw new Error("simulated divergent authority after replacement");
        },
      })
    ));

    const result = await new RunReopenDraftCommand().run(container, targetInput());

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_STATE_ATOMIC_SAVE_FAILED");
    assert.equal(result.data.committed, true);
    const divergentBytes = fs.readFileSync(files.flow);
    const retry = await runDirect(tmp);
    assert.equal(retry.ok, false);
    assert.equal(retry.errors[0].code, "REOPEN_AUDIT_INVALID");
    assert.deepEqual(fs.readFileSync(files.flow), divergentBytes);
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
    assert.deepEqual(
      flattenSteps(taskAfter.steps).filter((step) => step.status === "in_progress").map((step) => step.id),
      ["draft"],
    );
    assert.deepEqual(taskAfter.tasks, taskBefore.tasks);
    assert.deepEqual(taskAfter.metrics, taskBefore.metrics);
    assert.equal(taskAfter.currentTaskId, taskBefore.currentTaskId);
  });

  it("uses the dispatcher-resolved base artifact authority without reloading by path", async () => {
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
        "--expect-spec", SPEC_ID,
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
    assert.deepEqual(worktreeAfter, worktreeBefore);
    const mainAfter = snapshot(mainFiles);
    assert.notEqual(mainAfter.flow, mainBefore.flow);
    for (const key of ["spec", "issueLog", "draft", "evidence", "source"]) {
      assert.equal(mainAfter[key], mainBefore[key], key);
    }
    assert.notEqual(FLOW_COMMANDS.run["reopen-draft"].explicitTargetResolution, true);
    assert.equal(FLOW_COMMANDS.get["runtime-log"].explicitTargetResolution, true);
  });
});
