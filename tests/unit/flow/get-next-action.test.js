/**
 * tests/unit/flow/get-next-action.test.js
 *
 * Contract tests for `flow get next-action` (spec 203 / cac6/T5).
 *
 * Verifies that the CLI command returns a statically-determined
 * next-action envelope based on the current in_progress step at either
 * the flow or task level, with the 3 approval points wired correctly.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import fs from "node:fs";
import pathMod from "node:path";
import { makeFlowManager, replaceFlowState } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { createNextActionHarness } from "../../helpers/next-action-harness.js";
import {
  FLOW_STEPS,
  TASK_STEPS_PLAN,
  buildInitialSteps,
  buildInitialTaskSteps,
} from "../../../src/lib/flow-helpers.js";
import { flattenSteps, findStepById } from "../../../src/flow/lib/step-tree.js";
import { validateSchema } from "../../../src/lib/schema-validate.js";
import { PKG_DIR } from "../../../src/lib/cli.js";
import { resolveIncludes } from "../../../src/lib/include.js";
import { ExternalBlockedOutcome, StepAttempt } from "../../../src/flow/lib/step-outcome.js";
import {
  FlowOutbox,
  FlowOutboxRecoveryClaim,
  finalizationOutboxIdentity,
} from "../../../src/flow/lib/flow-outbox.js";
import { outboxCommitMarker } from "../../../src/flow/lib/run-finalize.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";

const CLI = join(process.cwd(), "src/senti.js");

function runCli(tmp, args) {
  try {
    const out = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });
    return { envelope: JSON.parse(out), exitCode: 0 };
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    return { envelope: stdout ? JSON.parse(stdout) : null, exitCode: err.status || 1 };
  }
}

function setupActiveFlow(tmp, overrides = {}) {
  const specId = "001-test";
  const state = {
    specId: specId,
    runId: `run-${specId}`,
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
    ...overrides,
  };
  const fm = makeFlowManager(tmp);
  fm.create(state);
  fm.addActiveFlow(specId, "local");
  return state;
}

function setFlowStepInProgress(state, stepId) {
  for (const s of flattenSteps(state.steps)) s.status = "pending";
  const step = findStepById(state.steps, stepId);
  assert.ok(step, `step ${stepId} must exist in FLOW_STEPS`);
  step.status = "in_progress";
}

function setTaskStepInProgress(state, taskId, stepId) {
  const task = state.tasks.find((t) => t.id === taskId);
  assert.ok(task, `task ${taskId} must exist`);
  for (const s of task.steps) s.status = "pending";
  const step = task.steps.find((x) => x.id === stepId);
  assert.ok(step, `task step ${stepId} must exist`);
  step.status = "in_progress";
  state.currentTaskId = taskId;
}

function setupPendingNextAction(tmp) {
  const state = setupActiveFlow(tmp);
  const branch = findStepById(state.steps, "branch");
  branch.status = "pending";
  delete branch.startedAt;
  replaceFlowState(tmp, state);
  return makeFlowManager(tmp).forRoot(tmp, { specId: "001-test" });
}

function flowStatePath(tmp) {
  return pathMod.join(tmp, "specs", "001-test", "flow.json");
}

describe("flow get next-action", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  describe("envelope shape (REQ-1)", () => {
    it("returns 7-field data object in envelope", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "draft");
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(exitCode, 0);
      assert.equal(envelope.ok, true);
      assert.equal(envelope.type, "get");
      assert.equal(envelope.key, "next-action");
      const d = envelope.data;
      assert.ok("taskId" in d, "taskId field present");
      assert.ok("step" in d, "step field present");
      assert.ok("action" in d, "action field present");
      assert.ok("instructions" in d, "instructions field present");
      assert.ok("context" in d, "context field present");
      assert.ok("output_schema" in d, "output_schema field present");
      assert.ok("requires_approval" in d, "requires_approval field present");
      assert.deepEqual(d.directive, {
        kind: "execute_step",
        terminal: false,
        requiresUserAction: false,
        action: d.action,
      });
    });
  });

  describe("active flow missing (REQ-2)", () => {
    it("returns ok:true with step=null when no active flow", () => {
      tmp = createTmpDir();
      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.ok, true);
      assert.equal(exitCode, 0);
      assert.equal(envelope.data.step, null);
      assert.equal(envelope.data.action, null);
      assert.equal(envelope.data.directive.kind, "idle");
    });
  });

  describe("task-level target (REQ-3)", () => {
    it("returns task step fields when currentTaskId non-null", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp, {
        tasks: [{
          id: "001",
          spec: "tasks/001-foo.md",
          origin: "plan",
          parent: null,
          status: "in_progress",
          steps: buildInitialTaskSteps("plan"),
          requirements: [],
        }],
      });
      setTaskStepInProgress(state, "001", "task-impl");
      replaceFlowState(tmp, state);

      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.taskId, "001");
      assert.equal(envelope.data.step, "task-impl");
      assert.equal(envelope.data.action, "run-impl");
    });

    it("repairs a promoted current task whose first step is still pending", () => {
      tmp = createTmpDir();
      const task = {
        id: "002",
        spec: "specs/001-test/tasks/002-next.md",
        origin: "plan",
        parent: null,
        status: "in_progress",
        steps: buildInitialTaskSteps("plan"),
        requirements: [],
      };
      const state = setupActiveFlow(tmp, { tasks: [task], currentTaskId: "002" });
      setFlowStepInProgress(state, "implement");
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);

      assert.equal(exitCode, 0);
      assert.equal(envelope.data.taskId, "002");
      assert.equal(envelope.data.step, "task-impl");
      const reloaded = makeFlowManager(tmp).load();
      assert.equal(reloaded.currentTaskId, "002");
      assert.equal(reloaded.tasks[0].status, "in_progress");
      assert.equal(reloaded.tasks[0].steps[0].status, "in_progress");
    });
  });

  it("ignores a task-gate external block recorded before its audited retry reset", () => {
    tmp = createTmpDir();
    const state = setupActiveFlow(tmp, {
      tasks: [{
        id: "T-1",
        spec: "specs/001-test/tasks/T-1.md",
        origin: "plan",
        parent: null,
        status: "in_progress",
        steps: buildInitialTaskSteps("plan"),
        requirements: [],
      }],
      metrics: [{
        phase: "task-impl",
        counter: "gateRetry",
        reset: true,
        ts: "2026-07-26T02:00:00.000Z",
      }],
    });
    setTaskStepInProgress(state, "T-1", "task-gate");
    state.stepAttempts = [new StepAttempt({
      runId: state.runId,
      taskId: "T-1",
      stepId: "task-gate",
      attempt: 1,
      recordedAt: "2026-07-26T01:00:00.000Z",
      outcome: new ExternalBlockedOutcome({
        reason: "mechanical",
        resumeInstruction: "Resolve the previous failure.",
      }),
    }).toJSON()];
    replaceFlowState(tmp, state);

    const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);

    assert.equal(exitCode, 0);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.halt, undefined);
  });

  describe("flow-level fallback (REQ-4)", () => {
    it("returns flow step when currentTaskId is null", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec-gate");
      replaceFlowState(tmp, state);

      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.taskId, null);
      assert.equal(envelope.data.step, "spec-gate");
    });
  });

  describe("approval points (REQ-5)", () => {
    it("flow approval step has requires_approval: true", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "approval");
      replaceFlowState(tmp, state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.data.requires_approval, true);
    });

    it("flow finalize-commit step has requires_approval: true", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "finalize-commit");
      replaceFlowState(tmp, state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.data.requires_approval, true);
    });

    it("all other rule-defined steps have requires_approval: false", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      const falsyFlowSteps = [
        "draft", "draft-gate", "spec", "spec-gate", "test",
        "implement", "test-execute", "test-result-review", "impl-review", "impl-gate", "retro", "final-regression",
      ];
      for (const id of falsyFlowSteps) {
        setFlowStepInProgress(state, id);
        replaceFlowState(tmp, state);
        const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
        assert.equal(envelope.ok, true, `ok for flow.${id}`);
        assert.equal(envelope.data.requires_approval, false, `requires_approval false for flow.${id}`);
      }
    });

    it("returns a deterministic replay when a durable finalize commit lost only its post-hook", () => {
      tmp = createTmpDir();
      initGitRepo(tmp);
      fs.writeFileSync(join(tmp, "README.md"), "baseline\n");
      commitAll(tmp, "test: baseline");

      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "finalize-commit");
      const identity = finalizationOutboxIdentity(state, "finalize-commit");
      const outbox = new FlowOutbox();
      outbox.begin(identity, "2026-07-28T00:00:00.000Z");
      outbox.fail(identity, new Error("failed to stage durable test/report artifacts"), "2026-07-28T00:00:01.000Z");
      state.outbox = outbox.toJSON();
      replaceFlowState(tmp, state);
      execFileSync("git", ["commit", "--allow-empty", "-m", "feat: implementation", "-m", outboxCommitMarker(identity.idempotencyKey)], {
        cwd: tmp,
        stdio: "ignore",
      });

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);

      assert.equal(exitCode, 0);
      assert.equal(envelope.data.directive.kind, "execute_command");
      assert.equal(envelope.data.directive.actionId, "RECOVER_FINALIZE_COMMIT_OUTBOX");
      assert.match(envelope.data.directive.nextAction, /^senti flow run finalize-commit /);
      assert.equal(makeFlowManager(tmp).load().outbox[0].status, "pending");
      assert.ok(makeFlowManager(tmp).load().outbox[0].exactRecoveryReceipt);
    });

    it("replays one failed finalize merge through the dispatcher", () => {
      tmp = createTmpDir();
      initGitRepo(tmp);
      fs.writeFileSync(join(tmp, "README.md"), "baseline\n");
      commitAll(tmp, "test: baseline");
      execFileSync("git", ["checkout", "-b", "feature/001-test"], { cwd: tmp, stdio: "ignore" });
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "finalize-merge");
      const identity = finalizationOutboxIdentity(state, "finalize-merge");
      const outbox = new FlowOutbox();
      outbox.begin(identity, "2026-07-28T00:00:00.000Z");
      outbox.fail(identity, new Error("Merge conflict detected."), "2026-07-28T00:00:01.000Z");
      state.outbox = outbox.toJSON();
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);

      assert.equal(exitCode, 0);
      assert.equal(envelope.data.directive.kind, "execute_command");
      assert.equal(envelope.data.directive.actionId, "RECOVER_FINALIZE_MERGE_OUTBOX");
      assert.match(envelope.data.directive.nextAction, /^senti flow run finalize-merge /);
      assert.equal(makeFlowManager(tmp).load().outbox[0].status, "pending");
      assert.ok(makeFlowManager(tmp).load().outbox[0].exactRecoveryReceipt);
    });

    it("stops instead of retrying a finalize merge after the exact recovery is consumed", () => {
      tmp = createTmpDir();
      initGitRepo(tmp);
      fs.writeFileSync(join(tmp, "README.md"), "baseline\n");
      commitAll(tmp, "test: baseline");
      execFileSync("git", ["checkout", "-b", "feature/001-test"], { cwd: tmp, stdio: "ignore" });
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "finalize-merge");
      const identity = finalizationOutboxIdentity(state, "finalize-merge");
      const outbox = new FlowOutbox();
      outbox.begin(identity, "2026-07-28T00:00:00.000Z");
      outbox.fail(identity, new Error("first merge failure"), "2026-07-28T00:00:01.000Z");
      outbox.reopenFailedExact(new FlowOutboxRecoveryClaim({
        identity,
        attempt: 1,
        failure: "first merge failure",
      }), "2026-07-28T00:00:02.000Z");
      outbox.fail(identity, new Error("second merge failure"), "2026-07-28T00:00:03.000Z");
      state.outbox = outbox.toJSON();
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);

      assert.equal(exitCode, 0);
      assert.equal(envelope.data.directive.kind, "blocked");
      assert.equal(envelope.data.directive.code, "FINALIZE_OUTBOX_RECOVERY_EXHAUSTED");
    });

    it("replays a durable finalize sync whose post-hook failed", () => {
      tmp = createTmpDir();
      initGitRepo(tmp);
      fs.writeFileSync(join(tmp, "README.md"), "baseline\n");
      commitAll(tmp, "test: baseline");

      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "finalize-sync");
      const identity = finalizationOutboxIdentity(state, "finalize-sync");
      const outbox = new FlowOutbox();
      outbox.begin(identity, "2026-07-28T00:00:00.000Z");
      outbox.fail(identity, new Error("post-hook failed"), "2026-07-28T00:00:01.000Z");
      state.outbox = outbox.toJSON();
      replaceFlowState(tmp, state);
      execFileSync("git", ["commit", "--allow-empty", "-m", "docs: sync", "-m", outboxCommitMarker(identity.idempotencyKey)], {
        cwd: tmp,
        stdio: "ignore",
      });

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);

      assert.equal(exitCode, 0);
      assert.equal(envelope.data.directive.kind, "execute_command");
      assert.equal(envelope.data.directive.actionId, "RECOVER_FINALIZE_SYNC_OUTBOX");
      assert.match(envelope.data.directive.nextAction, /^senti flow run finalize-sync /);
      assert.equal(makeFlowManager(tmp).load().outbox[0].status, "pending");
      assert.ok(makeFlowManager(tmp).load().outbox[0].exactRecoveryReceipt);
    });

    it("records an interrupted pending finalize sync and continues to cleanup", () => {
      tmp = createTmpDir();
      initGitRepo(tmp);
      fs.writeFileSync(join(tmp, "README.md"), "baseline\n");
      commitAll(tmp, "test: baseline");

      const state = setupActiveFlow(tmp);
      const leaves = flattenSteps(state.steps);
      const syncIndex = leaves.findIndex((step) => step.id === "finalize-sync");
      for (const [index, step] of leaves.entries()) {
        step.status = index < syncIndex ? "done" : "pending";
      }
      leaves[syncIndex].status = "in_progress";
      const identity = finalizationOutboxIdentity(state, "finalize-sync");
      const outbox = new FlowOutbox();
      outbox.begin(identity, "2026-07-28T00:00:00.000Z");
      state.outbox = outbox.toJSON();
      replaceFlowState(tmp, state);
      const logDir = join(tmp, ".tmp", "logs");
      fs.mkdirSync(logDir, { recursive: true });
      fs.writeFileSync(join(logDir, "001-test.log"), [
        '===== start runId=run-001-test sequence=1 attempt=1 command="flow run finalize-sync" startedAt="2026-07-28T00:00:00.000Z" exitCode="" endedAt="" =====',
        "[stderr] interrupted",
        "",
      ].join("\n"));

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);

      assert.equal(exitCode, 0, JSON.stringify(envelope));
      assert.equal(envelope.data.step, "finalize-cleanup");
      const persisted = makeFlowManager(tmp).load();
      assert.equal(findStepById(persisted.steps, "finalize-sync").status, "skipped");
      assert.equal(persisted.outbox.find((entry) => entry.stepId === "finalize-sync").status, "failed");
      assert.equal(persisted.outbox.find((entry) => entry.stepId === "finalize-sync").failureHistory.at(-1).code, "FINALIZE_SYNC_INTERRUPTED");
      assert.equal(
        persisted.outbox.find((entry) => entry.stepId === "finalize-sync").failureHistory.at(-1).failure,
        "finalize-sync was interrupted before it returned a result",
      );
    });
  });

  describe("context descriptor (REQ-7)", () => {
    it("context contains kinds array of strings and paths object", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec");
      replaceFlowState(tmp, state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ctx = envelope.data.context;
      assert.ok(Array.isArray(ctx.kinds), "kinds is array");
      assert.ok(ctx.kinds.every((k) => typeof k === "string"), "kinds are strings");
      assert.ok(typeof ctx.paths === "object" && ctx.paths !== null, "paths is object");
    });

    it("context does not include resolved file contents", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec");
      replaceFlowState(tmp, state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ctx = envelope.data.context;
      // No raw content fields — only path descriptors
      for (const v of Object.values(ctx.paths)) {
        assert.ok(typeof v === "string" && !v.includes("\n"), "path values are single-line strings (not file contents)");
      }
    });

    it("returns spec-repair as a write-spec action with spec context", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec-repair");
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(exitCode, 0);
      assert.equal(envelope.data.step, "spec-repair");
      assert.equal(envelope.data.action, "write-spec");
      assert.equal(envelope.data.instructions.key, "plan.spec-repair");
      assert.deepEqual(envelope.data.context.paths, { specId: "001-test" });
      assert.equal(envelope.data.output_schema.type, "object");
    });

    it("returns spec-triage as a write-spec action with spec context", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec-triage");
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(exitCode, 0);
      assert.equal(envelope.data.step, "spec-triage");
      assert.equal(envelope.data.action, "write-spec");
      assert.equal(envelope.data.instructions.key, "plan.spec-triage");
      assert.deepEqual(envelope.data.context.paths, { specId: "001-test" });
      assert.equal(envelope.data.output_schema.type, "object");
    });
  });

  describe("output_schema (REQ-8, REQ-10)", () => {
    it("returns inline JSON Schema with a type field", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec-gate");
      replaceFlowState(tmp, state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const schema = envelope.data.output_schema;
      assert.equal(typeof schema, "object");
      assert.equal(typeof schema.type, "string");
    });

    it("returned schema is usable by validateSchema stand-alone", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec-gate");
      replaceFlowState(tmp, state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const schema = envelope.data.output_schema;
      const valid = { verdict: "pass" };
      const invalid = { verdict: 123 };
      assert.deepEqual(validateSchema(valid, schema), []);
      assert.notEqual(validateSchema(invalid, schema).length, 0);
    });
  });

  describe("NO_IN_PROGRESS_STEP auto-recovery (spec 219 / REQ-3)", () => {
    it("promotes first pending step when no in_progress exists, then returns envelope", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      // Simulate a post-gate state: branch/prepare-spec/draft/draft reviews/draft-gate all done,
      // next pending step is `spec`. No step is currently in_progress.
      const steps = flattenSteps(state.steps);
      const gateDraftIndex = steps.findIndex((step) => step.id === "draft-gate");
      assert.notEqual(gateDraftIndex, -1, "draft-gate fixture step must exist");
      steps.forEach((step, index) => {
        step.status = index <= gateDraftIndex ? "done" : "pending";
      });
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(exitCode, 0, "exits cleanly via auto-recovery");
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.taskId, null);
      assert.equal(envelope.data.step, "spec", "first pending step (`spec`) was promoted");

      // State should be persisted: the promoted step now has in_progress status.
      const reloaded = makeFlowManager(tmp).load();
      const promoted = findStepById(reloaded.steps, "spec");
      assert.equal(promoted.status, "in_progress", "fallback persists the promotion to flow.json");
    });

    it("returns ok:true with action='completed' when every step is done/skipped", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      for (const s of flattenSteps(state.steps)) s.status = "done";
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.ok, true);
      assert.equal(exitCode, 0);
      assert.equal(envelope.data.step, null);
      assert.equal(envelope.data.action, "completed");
    });
  });

  describe("GetNextActionCommand promotion boundaries and CAS", () => {
    it("accepts maxAttempts 1 and 10000 and emits one promotion/effect set on repeat", async () => {
      for (const maxAttempts of [1, 10_000]) {
        tmp = createTmpDir(`get-next-action-valid-${maxAttempts}-`);
        const fm = setupPendingNextAction(tmp);
        const harness = createNextActionHarness(fm, { maxAttempts });

        const first = await harness.execute(fm.load());
        const afterFirst = fs.readFileSync(flowStatePath(tmp));
        const repeated = await harness.execute(fm.load());

        assert.equal(first.maxAttempts, maxAttempts);
        assert.equal(repeated.maxAttempts, maxAttempts);
        assert.equal(findStepById(fm.load().steps, "spec").status, "in_progress");
        assert.deepEqual(fs.readFileSync(flowStatePath(tmp)), afterFirst, String(maxAttempts));
        assert.deepEqual(harness.calls, {
          planner: 2,
          save: 1,
          resolve: 0,
          runtime: 1,
          artifact: 1,
          retry: 1,
        }, String(maxAttempts));
        removeTmpDir(tmp);
        tmp = null;
      }
    });

    it("rejects fractional, below-minimum, and above-maximum attempts before writes or effects", async () => {
      for (const maxAttempts of [1.5, 0, 10_001]) {
        tmp = createTmpDir(`get-next-action-invalid-${String(maxAttempts).replace(".", "-")}-`);
        const fm = setupPendingNextAction(tmp);
        const before = fs.readFileSync(flowStatePath(tmp));
        const harness = createNextActionHarness(fm, { maxAttempts });

        await assert.rejects(
          harness.execute(fm.load()),
          (error) => error.code === "NEXT_ACTION_PLAN_INVALID" && /maxAttempts/.test(error.message),
        );

        assert.deepEqual(fs.readFileSync(flowStatePath(tmp)), before, String(maxAttempts));
        assert.deepEqual(harness.calls, {
          planner: 1,
          save: 0,
          resolve: 0,
          runtime: 0,
          artifact: 0,
          retry: 0,
        }, String(maxAttempts));
        removeTmpDir(tmp);
        tmp = null;
      }
    });

    it("surfaces one stale CAS without retry, re-resolution, effects, or winner mutation", async () => {
      tmp = createTmpDir("get-next-action-stale-");
      const fm = setupPendingNextAction(tmp);
      const stale = fm.load();
      fm.mutate((current) => { current.request = "winner"; });
      const winner = fs.readFileSync(flowStatePath(tmp));
      const harness = createNextActionHarness(fm, { expectedRevision: stale, maxAttempts: 1 });

      await assert.rejects(
        harness.execute(stale),
        (error) => error.code === "FLOW_STATE_ATOMIC_STALE" && error.committed === false,
      );

      assert.deepEqual(fs.readFileSync(flowStatePath(tmp)), winner);
      assert.equal(fm.load().request, "winner");
      assert.deepEqual(harness.calls, {
        planner: 1,
        save: 1,
        resolve: 0,
        runtime: 0,
        artifact: 0,
        retry: 0,
      });
    });
  });

  describe("rule missing (REQ-9)", () => {
    it("rejects an in_progress step with no definition entry at the persistence boundary", () => {
      tmp = createTmpDir();
      assert.throws(
        () => setupActiveFlow(tmp, {
          steps: [{ id: "__unknown-step__", status: "in_progress" }],
        }),
        (error) => (
          error.code === "FLOW_STATE_SCHEMA_UNSUPPORTED"
          && error.message.includes("flow definition")
        ),
      );
      assert.equal(fs.existsSync(pathMod.join(tmp, "specs", "001-test", "flow.json")), false);
    });
  });

  describe("task step coverage (plan + addition origins)", () => {
    it("each TASK_STEPS_PLAN step resolves to a rule", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp, {
        tasks: [{
          id: "001",
          spec: "tasks/001-foo.md",
          origin: "plan",
          parent: null,
          status: "in_progress",
          steps: buildInitialTaskSteps("plan"),
          requirements: [],
        }],
      });
      for (const stepId of TASK_STEPS_PLAN) {
        setTaskStepInProgress(state, "001", stepId);
        replaceFlowState(tmp, state);
        const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
        assert.equal(envelope.ok, true, `task.${stepId} has rule`);
        assert.equal(envelope.data.taskId, "001");
        assert.equal(envelope.data.step, stepId);
      }
    });

  });

  // REQ-11 (data-only extensibility via context-rules.json) was removed:
  // definition.js is now the single source of truth. Adding a step requires
  // editing definition.js, which is a code change by design.

  describe("instructions identifier (spec 203 scope, not T6)", () => {
    it("instructions is an object with a `key` field (identifier, not body)", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec");
      replaceFlowState(tmp, state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ins = envelope.data.instructions;
      assert.equal(typeof ins, "object");
      assert.equal(typeof ins.key, "string");
      assert.ok(ins.key.length > 0);
    });
  });

  describe("instructions content (spec 203 / cac6/T6)", () => {
    it("instructions includes resolved content alongside the key (flow scope)", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec");
      replaceFlowState(tmp, state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ins = envelope.data.instructions;
      assert.equal(typeof ins.key, "string");
      assert.equal(typeof ins.content, "string");
      assert.ok(ins.content.length > 0, "content non-empty for flow.spec");
    });

    it("instructions includes resolved content for task scope", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp, {
        tasks: [{
          id: "001",
          spec: "tasks/001-foo.md",
          origin: "plan",
          parent: null,
          status: "in_progress",
          steps: buildInitialTaskSteps("plan"),
          requirements: [],
        }],
      });
      setTaskStepInProgress(state, "001", "task-impl");
      replaceFlowState(tmp, state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ins = envelope.data.instructions;
      assert.equal(typeof ins.content, "string");
      assert.ok(ins.content.length > 0, "content non-empty for task.impl");
    });

    it("content has on-disk prompt file as suffix (rule block may be prepended for matching phase+state)", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "draft");
      replaceFlowState(tmp, state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ins = envelope.data.instructions;
      // ins.key is "plan.draft" → src/flow/prompts/plan/draft.md
      const parts = ins.key.split(".");
      const stepName = parts.pop();
      const filePath = pathMod.join(process.cwd(), "src", "flow", "prompts", ...parts, `${stepName}.md`);
      const onDisk = fs.readFileSync(filePath, "utf8");
      const resolvedOnDisk = resolveIncludes(onDisk, {
        baseDir: pathMod.dirname(filePath),
        pkgDir: PKG_DIR,
        sourceFile: filePath,
      });
      // Per spec 252: persistent rules may be prepended to instructions.content. The on-disk prompt
      // remains as the suffix after include expansion. When zero rules match the active phase+state,
      // content is byte-equal to the include-resolved prompt.
      assert.ok(ins.content.endsWith(resolvedOnDisk), "CLI prompt content must end with the include-resolved on-disk file content");
    });
  });
});
