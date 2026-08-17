// spec: R1 R2 R8 R9
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Command } from "../../../src/lib/command.js";
import { Container } from "../../../src/lib/container.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { FlowTargetExpectation } from "../../../src/lib/flow-target-guard.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  WorktreeFlowBindingStore,
  WorktreeFlowIdentity,
} from "../../../src/lib/worktree-flow-binding.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { FLOW_STEPS } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import {
  makeFlowManager,
  makeFlowState,
  moveFlowToStep,
  setupFlowConfig,
} from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

let tmp;
afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function addActiveFlow(manager, { specId, runId, issue }) {
  manager.create(makeFlowState({
    spec: `specs/${specId}/spec.json`,
    runId,
    issue,
    featureBranch: `feature/${specId}`,
  }));
  manager.addActiveFlow(specId, "local");
}

function captureError(operation) {
  try {
    operation();
  } catch (error) {
    return error;
  }
  assert.fail("operation must fail");
}

function snapshotTree(root) {
  const entries = {};
  const visit = (directory) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const stat = fs.lstatSync(absolute);
      if (stat.isDirectory()) visit(absolute);
      else entries[path.relative(root, absolute)] = fs.readFileSync(absolute);
    }
  };
  visit(root);
  return entries;
}

function spawnFlowCli(root, args) {
  return spawnSync(process.execPath, [path.resolve("src/senti.js"), "flow", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
}

function runFlowCli(root, args) {
  const result = spawnFlowCli(root, args);
  const stdout = result.stdout.trim();
  const envelope = stdout ? JSON.parse(stdout) : null;
  return {
    status: result.status,
    stdout: result.stdout,
    envelope,
  };
}

test("R1: explicit selectors use AND matching and distinguish 2+ ambiguity from zero matches", () => {
  tmp = createTmpDir("spec-322-target-");
  const manager = makeFlowManager(tmp);
  addActiveFlow(manager, { specId: "001-first", runId: "run-first", issue: 443 });
  addActiveFlow(manager, { specId: "002-second", runId: "run-second", issue: 443 });

  const exact = manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
    expectRunId: "run-second",
    expectIssue: 443,
    expectSpec: "002-second",
  }));
  assert.equal(exact.state.runId, "run-second");
  assert.equal(exact.specId, "002-second");

  const missing = captureError(() => manager.resolveExplicitFlowTarget(
    new FlowTargetExpectation({ expectRunId: "run-second", expectIssue: 999 }),
  ));
  const ambiguous = captureError(() => manager.resolveExplicitFlowTarget(
    new FlowTargetExpectation({ expectIssue: 443 }),
  ));
  assert.equal(missing.data?.matchCount, 0);
  assert.equal(ambiguous.data?.matchCount, 2);
  assert.notEqual(ambiguous.code, missing.code, "ambiguity needs its own typed error");
  assert.match(ambiguous.code, /AMBIGUOUS/);

  const readMismatch = captureError(() => manager.resolveExplicitFlowTargetForRead(
    new FlowTargetExpectation({ expectRunId: "run-second", expectIssue: 999 }),
  ));
  assert.equal(readMismatch.data?.matchCount, 0);
  assert.match(readMismatch.code, /NOT_FOUND|MISMATCH/);

  const activeMismatch = captureError(() => manager.resolveActiveFlow(null, {
    selectRunId: "run-second",
    selectIssue: 999,
  }));
  assert.match(activeMismatch.code, /NOT_FOUND|MISMATCH/);
  assert.notEqual(activeMismatch.data?.activeRunId, "run-second", "foreign target is not returned");
});

test("R1: preparing targets use AND matching for exact, zero, and 2+ outcomes", () => {
  tmp = createTmpDir("spec-322-preparing-");
  const manager = makeFlowManager(tmp);
  manager.createPreparingFlow("run-preparing-one", { issue: 444, request: "first" });
  manager.createPreparingFlow("run-preparing-two", { issue: 444, request: "second" });

  const exact = manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
    expectRunId: "run-preparing-two",
    expectIssue: 444,
  }));
  assert.equal(exact.preparing, true);
  assert.equal(exact.state.runId, "run-preparing-two");

  const missing = captureError(() => manager.resolveExplicitFlowTarget(
    new FlowTargetExpectation({ expectRunId: "run-preparing-two", expectIssue: 999 }),
  ));
  const ambiguous = captureError(() => manager.resolveExplicitFlowTarget(
    new FlowTargetExpectation({ expectIssue: 444 }),
  ));
  assert.equal(missing.data?.matchCount, 0);
  assert.equal(ambiguous.data?.matchCount, 2);
  assert.notEqual(ambiguous.code, missing.code);
  assert.match(ambiguous.code, /AMBIGUOUS/);
});

test("R1: selector matches across active and preparing sources are one typed ambiguity", () => {
  tmp = createTmpDir("spec-322-cross-source-ambiguity-");
  const manager = makeFlowManager(tmp);
  addActiveFlow(manager, {
    specId: "011-cross-source-active",
    runId: "run-cross-source-active",
    issue: 452,
  });
  manager.createPreparingFlow("run-cross-source-preparing", {
    issue: 452,
    request: "preserve preparing candidate",
  });
  const activeBefore = manager.load("011-cross-source-active");
  const preparingBefore = manager.loadPreparingFlow("run-cross-source-preparing");
  const before = snapshotTree(tmp);

  const ambiguous = captureError(() => manager.resolveExplicitFlowTarget(
    new FlowTargetExpectation({ expectIssue: 452 }),
  ));

  assert.equal(ambiguous.code, "FLOW_TARGET_AMBIGUOUS");
  assert.equal(ambiguous.data?.matchCount, 2);
  assert.deepEqual(manager.load("011-cross-source-active"), activeBefore);
  assert.deepEqual(manager.loadPreparingFlow("run-cross-source-preparing"), preparingBefore);
  assert.deepEqual(snapshotTree(tmp), before, "ambiguity neither selects nor mutates either source");
});

test("R1: managed bound worktree accepts exact identity and rejects foreign selectors", () => {
  tmp = createTmpDir("spec-322-bound-");
  const worktreePath = path.join(tmp, ".senti", "worktree", "bound-flow");
  fs.mkdirSync(worktreePath, { recursive: true });
  const specId = "003-bound";
  const state = makeFlowState({
    spec: `specs/${specId}/spec.json`,
    runId: "run-bound",
    issue: 445,
    worktree: true,
    featureBranch: `feature/${specId}`,
  });
  const manager = new FlowManager({ root: worktreePath, mainRoot: tmp, inWorktree: true, specId });
  manager.create(state);
  const identity = new WorktreeFlowIdentity({
    runId: state.runId,
    issue: state.issue,
    spec: state.spec,
    worktreePath,
  });
  new WorktreeFlowBindingStore({ worktreePath }).save(identity);

  const exact = manager.resolveWorktreeBinding(new FlowTargetExpectation({
    expectRunId: "run-bound",
    expectIssue: 445,
    expectSpec: specId,
  }));
  assert.deepEqual(exact.toJSON(), identity.toJSON());

  const mismatch = captureError(() => manager.resolveWorktreeBinding(new FlowTargetExpectation({
    expectRunId: "foreign-run",
    expectIssue: 999,
    expectSpec: "999-foreign",
  })));
  assert.equal(mismatch.code, "ACTIVE_FLOW_MISMATCH");
  assert.deepEqual(manager.resolveWorktreeBinding().toJSON(), identity.toJSON());
});

test("R2: dispatcher mismatch leaves the complete persisted tree byte-identical", async () => {
  tmp = createTmpDir("spec-322-dispatch-");
  const manager = makeFlowManager(tmp);
  const state = moveFlowToStep(makeFlowState({
    spec: "specs/demo-flow/spec.json",
    runId: "run-430",
    issue: 430,
    featureBranch: "feature/demo-flow",
    metrics: [{ phase: "test", counter: "reviewRetry", delta: 2, taskId: null, ts: "2026-07-20T00:00:00.000Z" }],
    retryLimits: { gate: 5, review: 4 },
  }), "test-review");
  const activeStep = findStepById(state.steps, "test-review");
  activeStep.startedAt = "2026-07-20T00:00:00.000Z";
  activeStep.runtimeLog = { runId: "existing-log", sequence: 7, result: "preserve" };
  manager.create(state);
  manager.addActiveFlow("demo-flow", "local");
  manager.createPreparingFlow("run-preparing-sentinel", { issue: 431, request: "preserve preparing bytes" });
  fs.writeFileSync(path.join(tmp, "specs", "demo-flow", "sentinel-artifact.json"), "artifact-before\n");
  fs.mkdirSync(path.join(tmp, ".tmp", "logs"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".tmp", "logs", "demo-flow.log"), "runtime-before\n");
  const before = snapshotTree(tmp);
  const container = new Container();
  container.register("config", {});
  container.register("root", tmp);
  container.register("paths", { root: tmp, agentWorkDir: path.join(tmp, ".agent-work") });
  const calls = { command: 0, pre: 0, post: 0, onError: 0, metadata: 0 };
  const out = [];

  await dispatch({
    container,
    entry: {
      command: async () => {
        calls.command += 1;
        throw new Error("mismatched target must not load the command");
      },
      args: { options: ["--expect-run-id", "--expect-issue", "--expect-spec"] },
      runtimeLog: { stepId: "test-review" },
      pre() { calls.pre += 1; },
      post() { calls.post += 1; },
      onError() { calls.onError += 1; },
    },
    argv: ["--expect-run-id", "wrong-run", "--expect-issue", "430", "--expect-spec", "demo-flow"],
    envelopeType: "run",
    envelopeKey: "guarded",
    runtimeLog: true,
    stdout: (chunk) => out.push(chunk),
    setExitCode: () => {},
    buildHookCtx: () => ({
      specId: "demo-flow",
      flowState: manager.load("demo-flow"),
      flowManager: {
        setStepRuntimeLog() {
          calls.metadata += 1;
          throw new Error("target failure must not persist runtime metadata");
        },
      },
    }),
  });

  const envelope = JSON.parse(out.join(""));
  assert.equal(envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
  assert.deepEqual(calls, { command: 0, pre: 0, post: 0, onError: 0, metadata: 0 });
  assert.deepEqual(snapshotTree(tmp), before);
});

// spec: R9
test("R9: preparing selection precedes runtime logs and typed rejection precedes every hook", async () => {
  tmp = createTmpDir("spec-322-preparing-dispatch-");
  const manager = makeFlowManager(tmp);
  manager.createPreparingFlow("run-preparing-one", { issue: 449, request: "first" });
  manager.createPreparingFlow("run-preparing-two", { issue: 449, request: "second" });
  const container = new Container();
  container.register("config", {});
  container.register("root", tmp);
  container.register("paths", { root: tmp, agentWorkDir: path.join(tmp, ".agent-work") });
  const logPath = path.join(tmp, ".tmp", "logs", "no-flow.log");
  const calls = { resolution: 0, commandLoad: 0, pre: 0, execute: 0, post: 0, onError: 0 };
  let selectedBeforeRuntimeLog = false;

  class PreparingCommand extends Command {
    static outputMode = "envelope";
    execute(ctx) {
      calls.execute += 1;
      return { selectedRunId: ctx.runId };
    }
  }

  const entry = {
    requiresFlow: false,
    runtimeLog: { stepId: "prepare-spec" },
    args: {
      options: ["--run-id", "--expect-run-id", "--expect-issue", "--expect-spec"],
    },
    command: async () => {
      calls.commandLoad += 1;
      return { default: PreparingCommand };
    },
    pre(ctx) {
      calls.pre += 1;
      assert.equal(ctx.preparingFlowState?.runId, "run-preparing-two");
      assert.equal(fs.existsSync(logPath), true, "runtime log opens only after target selection");
    },
    post() { calls.post += 1; },
    onError() { calls.onError += 1; },
  };
  const buildHookCtx = (_container, input) => {
    calls.resolution += 1;
    if (input.runId) {
      const preparingFlowState = manager.loadPreparingFlow(input.runId);
      selectedBeforeRuntimeLog ||= preparingFlowState?.runId === "run-preparing-two"
        && !fs.existsSync(logPath);
      return { flowManager: manager, flowState: null, preparingFlowState };
    }
    try {
      const target = manager.resolveExplicitFlowTarget(new FlowTargetExpectation(input));
      return { flowManager: manager, flowState: null, preparingFlowState: target.state };
    } catch (flowResolutionError) {
      return { flowManager: manager, flowState: null, preparingFlowState: null, flowResolutionError };
    }
  };
  const run = async (argv) => {
    const out = [];
    let exitCode = null;
    await dispatch({
      container,
      entry,
      argv,
      envelopeType: "run",
      envelopeKey: "preparing-guard",
      runtimeLog: true,
      stdout: (chunk) => out.push(chunk),
      setExitCode: (value) => { exitCode = value; },
      buildHookCtx,
    });
    return { envelope: JSON.parse(out.join("")), exitCode };
  };

  const exact = await run([
    "--run-id", "run-preparing-two",
    "--expect-run-id", "run-preparing-two",
    "--expect-issue", "449",
  ]);
  assert.equal(exact.exitCode, 0);
  assert.equal(exact.envelope.data.selectedRunId, "run-preparing-two");
  assert.equal(selectedBeforeRuntimeLog, true);
  assert.deepEqual(calls, { resolution: 1, commandLoad: 1, pre: 1, execute: 1, post: 1, onError: 0 });

  for (const testCase of [
    {
      name: "preparing guard mismatch",
      argv: ["--run-id", "run-preparing-two", "--expect-run-id", "foreign-run"],
      code: "ACTIVE_FLOW_MISMATCH",
    },
    {
      name: "preparing selector ambiguity",
      argv: ["--expect-issue", "449"],
      code: "FLOW_TARGET_AMBIGUOUS",
    },
    {
      name: "preparing selector not found",
      argv: ["--expect-run-id", "missing-preparing-run"],
      code: "FLOW_TARGET_NOT_FOUND",
    },
  ]) {
    const before = snapshotTree(tmp);
    const callCounts = { ...calls };
    const result = await run(testCase.argv);
    assert.equal(result.exitCode, 1, testCase.name);
    assert.equal(result.envelope.errors[0].code, testCase.code, testCase.name);
    assert.equal(calls.resolution, callCounts.resolution + 1, testCase.name);
    for (const key of ["commandLoad", "pre", "execute", "post", "onError"]) {
      assert.equal(calls[key], callCounts[key], `${testCase.name}: ${key}`);
    }
    assert.deepEqual(snapshotTree(tmp), before, `${testCase.name}: durable tree remains unchanged`);
  }
});

// spec: R8
test("R8: guarded command registry retains all three selector options", () => {
  const guardedPublicEntries = [
    ["get next-action", FLOW_COMMANDS.get["next-action"]],
    ["get runtime-log", FLOW_COMMANDS.get["runtime-log"]],
    ["set step", FLOW_COMMANDS.set.step],
  ];
  for (const [command, entry] of guardedPublicEntries) {
    assert.ok(entry, `${command} remains publicly registered`);
    assert.ok(entry.args.flags.includes("--expect-no-issue"));
    assert.deepEqual(
      entry.args.options.filter((option) => option.startsWith("--expect-")),
      ["--expect-issue", "--expect-spec", "--expect-run-id"],
      command,
    );
  }
  assert.equal(FLOW_COMMANDS.get["runtime-log"].explicitTargetResolution, true);
  assert.equal(FLOW_COMMANDS.get["runtime-log"].mismatchTargetResolution, true);
  assert.equal(FLOW_COMMANDS.get["runtime-log"].parseErrorsAsEnvelope, true);
  assert.deepEqual(FLOW_COMMANDS.set.step.args.positional, ["id", "status"]);
});

test("R8: public CLI retains exact guarded success and typed mismatch without config mutation", () => {
  tmp = createTmpDir("spec-322-cli-");
  setupFlowConfig(tmp, "en");
  const manager = makeFlowManager(tmp);
  addActiveFlow(manager, { specId: "004-cli", runId: "run-cli", issue: 446 });
  const configBefore = fs.readFileSync(path.join(tmp, ".senti", "config.json"));

  const exact = runFlowCli(tmp, [
    "get", "status", "run-cli",
    "--expect-run-id", "run-cli", "--expect-issue", "446", "--expect-spec", "004-cli",
  ]);
  assert.equal(exact.status, 0);
  assert.equal(exact.envelope?.data?.runId, "run-cli");

  const mismatch = runFlowCli(tmp, [
    "get", "status", "run-cli",
    "--expect-run-id", "run-cli", "--expect-issue", "999", "--expect-spec", "004-cli",
  ]);
  assert.notEqual(mismatch.status, 0);
  assert.equal(mismatch.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
  assert.deepEqual(fs.readFileSync(path.join(tmp, ".senti", "config.json")), configBefore);
});

// spec: R8
test("R8: CLI and direct APIs remove first-candidate and selector-OR fallback", () => {
  tmp = createTmpDir("spec-322-and-only-parity-");
  setupFlowConfig(tmp, "en");
  const manager = makeFlowManager(tmp);
  addActiveFlow(manager, { specId: "008-and-first", runId: "run-and-first", issue: 450 });
  addActiveFlow(manager, { specId: "009-and-second", runId: "run-and-second", issue: 450 });
  addActiveFlow(manager, { specId: "010-and-foreign", runId: "run-and-foreign", issue: 451 });
  const configBefore = fs.readFileSync(path.join(tmp, ".senti", "config.json"));

  const directExact = manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
    expectRunId: "run-and-second",
    expectIssue: 450,
    expectSpec: "009-and-second",
  }));
  assert.equal(directExact.state.runId, "run-and-second");

  const noFirstCandidate = captureError(() => manager.resolveActiveFlow(null, {
    selectIssue: 450,
  }));
  assert.equal(noFirstCandidate.code, "FLOW_TARGET_AMBIGUOUS");
  assert.equal(noFirstCandidate.data?.matchCount, 2);

  const noSelectorOr = captureError(() => manager.resolveExplicitFlowTargetForRead(
    new FlowTargetExpectation({ expectRunId: "run-and-first", expectIssue: 451 }),
  ));
  assert.equal(noSelectorOr.code, "FLOW_TARGET_NOT_FOUND");
  assert.equal(noSelectorOr.data?.matchCount, 0);

  const cliExact = runFlowCli(tmp, [
    "get", "status", "run-and-second",
    "--expect-run-id", "run-and-second",
    "--expect-issue", "450",
    "--expect-spec", "009-and-second",
  ]);
  assert.equal(cliExact.status, 0);
  assert.equal(cliExact.envelope?.data?.runId, "run-and-second");

  const cliNoSelectorOr = runFlowCli(tmp, [
    "get", "runtime-log", "--format", "json",
    "--expect-run-id", "run-and-first",
    "--expect-issue", "451",
  ]);
  assert.notEqual(cliNoSelectorOr.status, 0);
  assert.equal(cliNoSelectorOr.envelope?.errors?.[0]?.code, "FLOW_TARGET_NOT_FOUND");
  assert.equal(cliNoSelectorOr.envelope?.data?.matchCount, 0);
  assert.deepEqual(fs.readFileSync(path.join(tmp, ".senti", "config.json")), configBefore);
});

test("R9: public CLI distinguishes zero targets from 2+ ambiguity", () => {
  tmp = createTmpDir("spec-322-cli-cardinality-");
  setupFlowConfig(tmp, "en");
  const manager = makeFlowManager(tmp);
  addActiveFlow(manager, { specId: "006-cli-first", runId: "run-cli-first", issue: 448 });
  addActiveFlow(manager, { specId: "007-cli-second", runId: "run-cli-second", issue: 448 });
  const configPath = path.join(tmp, ".senti", "config.json");
  const configBefore = fs.readFileSync(configPath);
  const logPath = path.join(tmp, ".tmp", "logs", "no-flow.log");

  const beforeAmbiguous = snapshotTree(tmp);
  const ambiguous = runFlowCli(tmp, [
    "get", "next-action", "--expect-issue", "448",
  ]);
  assert.notEqual(ambiguous.status, 0);
  assert.match(ambiguous.envelope?.errors?.[0]?.code || "", /AMBIGUOUS/);
  assert.equal(ambiguous.envelope?.data?.matchCount, 2);
  assert.equal(ambiguous.envelope?.data?.runtimeLog?.runId, "no-flow");
  assert.deepEqual(snapshotTree(tmp), beforeAmbiguous, "ambiguity does not mutate durable state");

  const beforeMissing = snapshotTree(tmp);
  const missing = runFlowCli(tmp, [
    "get", "next-action", "--expect-issue", "999",
  ]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.envelope?.errors?.[0]?.code || "", /NOT_FOUND|MISMATCH/);
  assert.equal(missing.envelope?.data?.matchCount, 0);
  assert.equal(missing.envelope?.data?.runtimeLog?.runId, "no-flow");
  assert.deepEqual(snapshotTree(tmp), beforeMissing, "not-found does not mutate durable state");
  assert.deepEqual(fs.readFileSync(configPath), configBefore);
  assert.equal(fs.existsSync(logPath), false, "synthetic runtime metadata does not open no-flow.log");
});

// spec: R8
test("R8/R9: config, help, selector flags, and registered steps retain parity", () => {
  const retained = [
    "branch", "prepare-spec", "draft", "draft-gate", "spec", "spec-gate", "approval",
    "test", "implement", "test-execute", "test-result-review", "impl-review", "impl-gate",
    "retro", "final-regression", "finalize-commit", "finalize-merge", "finalize-sync", "finalize-cleanup",
  ];
  for (const step of retained) assert.ok(FLOW_STEPS.includes(step), `${step} remains registered`);
  assert.equal(new Set(FLOW_STEPS).size, FLOW_STEPS.length);

  const help = spawnFlowCli(process.cwd(), ["get", "status", "--help"]);
  assert.equal(help.status, 0);
  for (const option of ["--expect-run-id", "--expect-issue", "--expect-spec", "--expect-no-issue"]) {
    assert.match(help.stdout, new RegExp(option));
  }
});
