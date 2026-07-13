import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Container } from "../../../src/lib/container.js";
import { buildInitialSteps, FLOW_STEPS } from "../../../src/lib/flow-helpers.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { RunReopenDraftCommand } from "../../../src/flow/lib/run-reopen-draft.js";
import {
  ReopenDraftTransaction,
  SimulatedTransactionCrash,
} from "../../../src/flow/lib/reopen-draft-transaction.js";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import { findInProgressLeaf, findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { makeDefaultTask } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "441-reopen-spec-correction";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;

function makeContainer(root, { mainRoot = root, inWorktree = false } = {}) {
  const container = new Container();
  const flowManager = new FlowManager({ root, mainRoot, inWorktree });
  container.register("paths", { root });
  container.register("mainRoot", mainRoot);
  container.register("inWorktree", inWorktree);
  container.register("config", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
  container.register("flowManager", flowManager);
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

function currentTask(overrides) {
  return makeDefaultTask({
    ...overrides,
    steps: [
      { id: "task-impl", status: "pending" },
      { id: "task-review", status: "pending" },
      { id: "task-gate", status: "pending" },
    ],
  });
}

function setupFlow(root, {
  issue = 441,
  activeStep = "implement",
  doneTask = false,
  mainRoot = root,
  inWorktree = false,
} = {}) {
  const specDir = path.join(root, "specs", SPEC_ID);
  const partialSource = path.join(root, "src", "partial-implementation.js");
  const evidence = path.join(specDir, "test-execute-result.json");
  fs.mkdirSync(path.dirname(partialSource), { recursive: true });
  fs.writeFileSync(partialSource, "export const partial = true;\n");
  writeJson(evidence, { version: "2", result: "pass", marker: "preserve-me" });
  writeJson(path.join(specDir, "draft.json"), { approval: { approved: true } });
  writeJson(path.join(specDir, "spec.json"), {
    goal: "fixture",
    requirements: [],
    tasks: [],
    user_approval: { approved: true, confirmed_at: "2026-07-13T00:00:00Z", notes: "stale" },
  });

  const tasks = doneTask
    ? [currentTask({ id: "T-1", status: "done" }), currentTask({ id: "T-2", status: "in_progress" })]
    : [currentTask({ id: "T-1", status: "pending" })];
  const state = {
    spec: SPEC_PATH,
    baseBranch: "main",
    featureBranch: `feature/${SPEC_ID}`,
    runId: "run-441",
    ...(issue == null ? {} : { issue }),
    worktree: true,
    steps: implementationSteps(activeStep),
    requirements: [],
    tasks,
    currentTaskId: doneTask ? "T-2" : null,
    metrics: [
      { phase: "spec", counter: "gateRetry", delta: 1, taskId: null, ts: "2026-07-13T00:00:00Z" },
      { phase: "test", counter: "reviewRetry", delta: 1, taskId: null, ts: "2026-07-13T00:00:00Z" },
    ],
    retryLimits: { gate: 5, review: 4 },
  };
  const fm = new FlowManager({ root, mainRoot, inWorktree });
  fm.save(state);
  fm.addActiveFlow(SPEC_ID, "worktree");
  return { partialSource, evidence, specDir };
}

function targetInput(overrides = {}) {
  return {
    reason: "Source verification found a contradictory Issue identity requirement.",
    category: "spec-correction",
    expectRunId: "run-441",
    expectIssue: "441",
    expectSpec: SPEC_PATH,
    _envelopeType: "run",
    _envelopeKey: "reopen-draft",
    ...overrides,
  };
}

async function runReopen(root, input = targetInput()) {
  return new RunReopenDraftCommand().run(makeContainer(root), input);
}

function snapshot(root, paths) {
  return Object.fromEntries(paths.map((file) => [
    path.relative(root, file),
    fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null,
  ]));
}

function issueLogPath(root) {
  return path.join(root, "specs", SPEC_ID, "issue-log.json");
}

function transactionContents(root) {
  const specDir = path.join(root, "specs", SPEC_ID);
  const flow = JSON.parse(fs.readFileSync(path.join(specDir, "flow.json"), "utf8"));
  const spec = JSON.parse(fs.readFileSync(path.join(specDir, "spec.json"), "utf8"));
  return {
    flow: `${JSON.stringify({ ...flow, transactionMarker: true }, null, 2)}\n`,
    spec: `${JSON.stringify({ ...spec, transactionMarker: true }, null, 2)}\n`,
    issueLog: `${JSON.stringify({ entries: [{ transactionMarker: true }] }, null, 2)}\n`,
  };
}

function transactionFiles(root) {
  const specDir = path.join(root, "specs", SPEC_ID);
  return [
    path.join(specDir, "flow.json"),
    path.join(specDir, "spec.json"),
    path.join(specDir, "issue-log.json"),
  ];
}

describe("guarded reopen for source-discovered spec corrections", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("allows implement-stage correction with zero done tasks and records an audited atomic rewind", async () => {
    tmp = createTmpDir("reopen-correction-");
    const files = setupFlow(tmp);
    const sourceBefore = fs.readFileSync(files.partialSource, "utf8");
    const evidenceBefore = fs.readFileSync(files.evidence, "utf8");

    const result = await runReopen(tmp);

    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.data.mode, "spec-correction");
    assert.equal(result.data.doneTaskCount, 0);
    const fm = makeContainer(tmp).get("flowManager");
    const state = fm.load(SPEC_ID);
    const inProgress = flattenSteps(state.steps).filter((step) => step.status === "in_progress");
    assert.deepEqual(inProgress.map((step) => step.id), ["draft"]);
    assert.equal(findInProgressLeaf(state.steps).id, "draft");
    assert.equal(state.currentTaskId, null);
    assert.equal(state.tasks[0].status, "pending");
    assert.deepEqual(state.retryLimits, { gate: 5, review: 4 });
    assert.deepEqual(state.metrics.slice(0, 2), [
      { phase: "spec", counter: "gateRetry", delta: 1, taskId: null, ts: "2026-07-13T00:00:00Z" },
      { phase: "test", counter: "reviewRetry", delta: 1, taskId: null, ts: "2026-07-13T00:00:00Z" },
    ]);
    assert.ok(state.metrics.some((entry) => entry.reset === true && entry.counter === "gateRetry"));
    assert.ok(state.metrics.some((entry) => entry.reset === true && entry.counter === "reviewRetry"));
    const audit = state.planRewinds.at(-1);
    assert.equal(audit.category, "spec-correction");
    assert.deepEqual(audit.target, {
      runId: "run-441",
      spec: SPEC_PATH,
      issue: { present: true, value: 441 },
    });
    assert.equal(audit.sourceStage, "implement");
    assert.equal(audit.destinationStep, "draft");
    assert.equal(audit.preservedWorktree.enabled, true);
    assert.ok(audit.invalidatedEvidence.includes("test-execute-result.json"));
    const spec = JSON.parse(fs.readFileSync(path.join(files.specDir, "spec.json"), "utf8"));
    assert.equal(spec.user_approval.approved, false);
    assert.equal(fs.readFileSync(files.partialSource, "utf8"), sourceBefore);
    assert.equal(fs.readFileSync(files.evidence, "utf8"), evidenceBefore);
    assert.equal(fs.existsSync(issueLogPath(tmp)), true);

    const next = await new GetNextActionCommand().run(makeContainer(tmp), targetInput());
    assert.equal(next.step, "draft");
    assert.equal(next.action, "write-draft");
  });

  it("accepts explicit Issue absence without fabricating an Issue", async () => {
    tmp = createTmpDir("reopen-no-issue-");
    setupFlow(tmp, { issue: null });

    const result = await runReopen(tmp, targetInput({ expectIssue: undefined, expectNoIssue: true }));

    assert.equal(result.ok, true, JSON.stringify(result.errors));
    const state = makeContainer(tmp).get("flowManager").load(SPEC_ID);
    assert.equal(Object.hasOwn(state, "issue"), false);
    assert.deepEqual(state.planRewinds.at(-1).target.issue, { present: false, value: null });
  });

  it("rejects missing guards, invalid Issue values, and identity mismatches before every mutation", async () => {
    const cases = [
      { name: "missing runId", input: { expectRunId: undefined }, code: "TARGET_GUARDS_REQUIRED" },
      { name: "missing spec", input: { expectSpec: undefined }, code: "TARGET_GUARDS_REQUIRED" },
      { name: "missing Issue guard", input: { expectIssue: undefined }, code: "TARGET_GUARDS_REQUIRED" },
      { name: "missing reason", input: { reason: "" }, code: "INVALID_REASON" },
      { name: "conflicting Issue guards", input: { expectNoIssue: true }, code: "ARGS_ERROR" },
      { name: "zero Issue", input: { expectIssue: "0" }, code: "ARGS_ERROR" },
      { name: "negative Issue", input: { expectIssue: "-1" }, code: "ARGS_ERROR" },
      { name: "fractional Issue", input: { expectIssue: "1.5" }, code: "ARGS_ERROR" },
      { name: "wrong runId", input: { expectRunId: "wrong" }, code: "ACTIVE_FLOW_MISMATCH" },
      { name: "wrong spec", input: { expectSpec: "specs/999-wrong/spec.json" }, code: "ACTIVE_FLOW_MISMATCH" },
      { name: "wrong Issue", input: { expectIssue: "999" }, code: "ACTIVE_FLOW_MISMATCH" },
      { name: "unexpected Issue absence", input: { expectIssue: undefined, expectNoIssue: true }, code: "ACTIVE_FLOW_MISMATCH" },
    ];
    for (const testCase of cases) {
      tmp = createTmpDir(`reopen-${testCase.name.replaceAll(" ", "-")}-`);
      const files = setupFlow(tmp);
      const durable = [
        path.join(files.specDir, "flow.json"),
        path.join(files.specDir, "spec.json"),
        files.partialSource,
        files.evidence,
        issueLogPath(tmp),
      ];
      const before = snapshot(tmp, durable);

      const result = await runReopen(tmp, targetInput(testCase.input));

      assert.equal(result.ok, false, testCase.name);
      assert.equal(result.errors[0].code, testCase.code, testCase.name);
      assert.deepEqual(snapshot(tmp, durable), before, testCase.name);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("requires explicit Issue absence for Issue-less flows", async () => {
    tmp = createTmpDir("reopen-no-issue-guard-");
    const files = setupFlow(tmp, { issue: null });
    const flowPath = path.join(files.specDir, "flow.json");
    const before = fs.readFileSync(flowPath, "utf8");

    const missing = await runReopen(tmp, targetInput({ expectIssue: undefined }));
    const fabricated = await runReopen(tmp, targetInput({ expectIssue: "441" }));

    assert.equal(missing.errors[0].code, "TARGET_GUARDS_REQUIRED");
    assert.equal(fabricated.errors[0].code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(fs.readFileSync(flowPath, "utf8"), before);
  });

  it("rejects unsupported/finalize stages and preserves the existing done-task task-addition route", async () => {
    tmp = createTmpDir("reopen-finalize-");
    const finalizeFiles = setupFlow(tmp, { activeStep: "finalize-merge" });
    const finalizeFlow = path.join(finalizeFiles.specDir, "flow.json");
    const before = fs.readFileSync(finalizeFlow, "utf8");

    const blocked = await runReopen(tmp);

    assert.equal(blocked.ok, false);
    assert.equal(blocked.errors[0].code, "REOPEN_STAGE_UNSUPPORTED");
    assert.equal(fs.readFileSync(finalizeFlow, "utf8"), before);

    removeTmpDir(tmp);
    tmp = createTmpDir("reopen-task-addition-");
    setupFlow(tmp, { doneTask: true });
    const beforeTaskAddition = makeContainer(tmp).get("flowManager").load(SPEC_ID);
    const taskAddition = await runReopen(tmp, targetInput({ category: "task-addition" }));
    assert.equal(taskAddition.ok, true, JSON.stringify(taskAddition.errors));
    assert.equal(taskAddition.data.mode, "implementation");
    const state = makeContainer(tmp).get("flowManager").load(SPEC_ID);
    assert.equal(findStepById(state.steps, "draft").status, "in_progress");
    assert.equal(state.tasks[0].status, "done");
    assert.deepEqual(state.tasks, beforeTaskAddition.tasks);
    assert.deepEqual(state.metrics, beforeTaskAddition.metrics);
    assert.equal(state.currentTaskId, beforeTaskAddition.currentTaskId);
    assert.equal(state.issue, beforeTaskAddition.issue);
    assert.equal(JSON.parse(fs.readFileSync(issueLogPath(tmp), "utf8")).entries.length, 1);
  });

  it("keeps category mandatory for zero-done correction and preserves the pre-implementation plan route", async () => {
    tmp = createTmpDir("reopen-category-");
    setupFlow(tmp);

    const missingCategory = await runReopen(tmp, targetInput({ category: undefined }));

    assert.equal(missingCategory.ok, false);
    assert.equal(missingCategory.errors[0].code, "NO_DONE_TASK");

    const durable = transactionFiles(tmp);
    const beforeUnknown = snapshot(tmp, durable);
    const unknown = await runReopen(tmp, targetInput({ category: "typo-correction" }));
    assert.equal(unknown.ok, false);
    assert.equal(unknown.errors[0].code, "ARGS_ERROR");
    assert.deepEqual(snapshot(tmp, durable), beforeUnknown);

    removeTmpDir(tmp);
    tmp = createTmpDir("reopen-plan-route-");
    setupFlow(tmp, { activeStep: "spec" });
    const beforePlan = makeContainer(tmp).get("flowManager").load(SPEC_ID);
    const planRoute = await runReopen(tmp, targetInput({ category: undefined }));
    assert.equal(planRoute.ok, true, JSON.stringify(planRoute.errors));
    assert.equal(planRoute.data.mode, "pre-implementation");
    const afterPlan = makeContainer(tmp).get("flowManager").load(SPEC_ID);
    assert.equal(findInProgressLeaf(afterPlan.steps).id, "draft");
    assert.deepEqual(afterPlan.tasks, beforePlan.tasks);
    assert.deepEqual(afterPlan.metrics, beforePlan.metrics);
    assert.equal(afterPlan.currentTaskId, beforePlan.currentTaskId);
    assert.equal(afterPlan.issue, beforePlan.issue);
    assert.equal(JSON.parse(fs.readFileSync(issueLogPath(tmp), "utf8")).entries.length, 1);
  });

  it("commits the guarded correction only in the resolved worktree authority root", async () => {
    tmp = createTmpDir("reopen-worktree-authority-");
    const worktree = path.join(tmp, ".senti", "worktree", "feature-441-authority");
    setupFlow(worktree, { mainRoot: tmp, inWorktree: true });
    const mainSpecDir = path.join(tmp, "specs", SPEC_ID);
    writeJson(path.join(mainSpecDir, "flow.json"), { sentinel: "main-flow-must-not-change" });
    writeJson(path.join(mainSpecDir, "spec.json"), { sentinel: "main-spec-must-not-change" });
    writeJson(path.join(mainSpecDir, "issue-log.json"), { entries: [{ sentinel: "main-log-must-not-change" }] });
    const mainBefore = snapshot(tmp, transactionFiles(tmp));

    const result = await new RunReopenDraftCommand().run(
      makeContainer(worktree, { mainRoot: tmp, inWorktree: true }),
      targetInput(),
    );

    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.data.transaction.authorityRoot, fs.realpathSync(worktree));
    assert.deepEqual(snapshot(tmp, transactionFiles(tmp)), mainBefore);
    const worktreeState = new FlowManager({ root: worktree, mainRoot: tmp, inWorktree: true }).load(SPEC_ID);
    assert.equal(findInProgressLeaf(worktreeState.steps).id, "draft");
    assert.equal(JSON.parse(fs.readFileSync(path.join(worktree, SPEC_PATH), "utf8")).user_approval.approved, false);
    assert.equal(JSON.parse(fs.readFileSync(issueLogPath(worktree), "utf8")).entries.at(-1).originIssue, 441);
  });

  it("rolls back every file boundary without changing any durable byte", () => {
    for (const key of ["flow", "spec", "issueLog"]) {
      tmp = createTmpDir(`reopen-transaction-${key}-`);
      setupFlow(tmp);
      const files = transactionFiles(tmp);
      const before = snapshot(tmp, files);
      const transaction = new ReopenDraftTransaction({
        root: tmp,
        specPath: SPEC_PATH,
        identity: { runId: "run-441", issue: 441 },
        contents: transactionContents(tmp),
        faultInjector(event) {
          if (event.phase === "before-apply" && event.key === key) {
            throw new Error(`injected ${key} write failure`);
          }
        },
      });

      assert.throws(
        () => transaction.commit(),
        (err) => err.code === "TRANSACTION_COMMIT_FAILED" && err.recovered === true,
      );
      assert.deepEqual(snapshot(tmp, files), before, key);
      assert.deepEqual(ReopenDraftTransaction.recoverPending({ root: tmp }), []);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("recovers a partial commit on process restart", async () => {
    tmp = createTmpDir("reopen-transaction-crash-");
    setupFlow(tmp);
    const files = transactionFiles(tmp);
    const before = snapshot(tmp, files);
    const transaction = new ReopenDraftTransaction({
      root: tmp,
      specPath: SPEC_PATH,
      identity: { runId: "run-441", issue: 441 },
      contents: transactionContents(tmp),
      faultInjector(event) {
        if (event.phase === "after-apply" && event.key === "spec") {
          throw new SimulatedTransactionCrash("process terminated after spec apply");
        }
      },
    });
    assert.throws(() => transaction.commit(), SimulatedTransactionCrash);
    assert.notDeepEqual(snapshot(tmp, files), before);

    const next = await new GetNextActionCommand().run(makeContainer(tmp), targetInput());

    assert.equal(next.step, "implement");
    assert.deepEqual(snapshot(tmp, files), before);
    assert.equal(ReopenDraftTransaction.pendingJournalPaths(tmp).length, 0);
  });

  it("surfaces recovery failure structurally and retains its journal for retry", () => {
    tmp = createTmpDir("reopen-transaction-recovery-failure-");
    setupFlow(tmp);
    const transaction = new ReopenDraftTransaction({
      root: tmp,
      specPath: SPEC_PATH,
      identity: { runId: "run-441", issue: 441 },
      contents: transactionContents(tmp),
      faultInjector(event) {
        if (event.phase === "after-apply" && event.key === "flow") {
          throw new SimulatedTransactionCrash("process terminated after flow apply");
        }
      },
    });
    assert.throws(() => transaction.commit(), SimulatedTransactionCrash);

    assert.throws(
      () => ReopenDraftTransaction.recoverPending({
        root: tmp,
        faultInjector(event) {
          if (event.phase === "before-restore" && event.key === "flow") {
            throw new Error("injected recovery failure");
          }
        },
      }),
      (err) => err.code === "TRANSACTION_RECOVERY_FAILED" && err.journalPath != null,
    );
    assert.equal(ReopenDraftTransaction.pendingJournalPaths(tmp).length, 1);
    assert.equal(ReopenDraftTransaction.recoverPending({ root: tmp }).length, 1);
  });

  it("fails every flow command closed before state reads when startup recovery cannot run", async () => {
    tmp = createTmpDir("reopen-transaction-fail-closed-");
    setupFlow(tmp);
    const transaction = new ReopenDraftTransaction({
      root: tmp,
      specPath: SPEC_PATH,
      identity: { runId: "run-441", issue: 441 },
      contents: transactionContents(tmp),
      faultInjector(event) {
        if (event.phase === "after-apply" && event.key === "flow") {
          throw new SimulatedTransactionCrash("process terminated after flow apply");
        }
      },
    });
    assert.throws(() => transaction.commit(), SimulatedTransactionCrash);
    const journalPath = ReopenDraftTransaction.pendingJournalPaths(tmp)[0];
    fs.writeFileSync(journalPath, "{not-json\n");
    const durable = transactionFiles(tmp);
    const before = snapshot(tmp, durable);

    const result = await new GetNextActionCommand().run(makeContainer(tmp), targetInput());

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "TRANSACTION_RECOVERY_FAILED");
    assert.equal(result.data.journalPath, journalPath);
    assert.deepEqual(snapshot(tmp, durable), before);
  });
});
