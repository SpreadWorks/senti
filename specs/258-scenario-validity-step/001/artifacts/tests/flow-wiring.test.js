// spec: R1 R2
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Command } from "../../../src/lib/command.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { FLOW_STEPS, buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import {
  collectFlowNodes,
  collectLeafIds,
  deriveNextAction,
  resolveNodeFor,
} from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const SPEC_ID = "258-scenario-validity-step";
const SPEC_REL = `specs/${SPEC_ID}/spec.json`;
const FLOW_DEFINITION = collectFlowNodes();

function planLeafIdsFromDefinition() {
  const plan = FLOW_DEFINITION.find((node) => node.id === "plan");
  assert.ok(plan, "plan branch exists in FLOW_DEFINITION");
  return collectLeafIds([plan]);
}

function baseState() {
  return {
    spec: SPEC_REL,
    runId: "run-258-scenario-validity-step",
    baseBranch: "main",
    featureBranch: "feature/258-scenario-validity-step",
    steps: buildInitialSteps(),
    requirements: [{ id: "R1", desc: "example" }],
    tasks: [],
    currentTaskId: null,
  };
}

function assertNoScenarioValidityArtifacts(root) {
  assert.equal(
    fs.existsSync(path.join(root, "specs", SPEC_ID, "scenario-validity-result.json")),
    false,
    "scenario-validity-result.json must not be written",
  );
  assert.equal(
    fs.existsSync(path.join(root, "specs", SPEC_ID, "tests/.raw/scenario-validity.log")),
    false,
    "scenario-validity raw log must not be written",
  );
}

test("R1: FLOW_DEFINITION plan leaves contain test -> scenario-validity -> test-review contiguously", () => {
  const planLeafIds = planLeafIdsFromDefinition();
  const indexOfTest = planLeafIds.indexOf("test");
  assert.ok(indexOfTest >= 0, "test leaf exists in plan branch");
  assert.deepEqual(planLeafIds.slice(indexOfTest, indexOfTest + 3), [
    "test",
    "scenario-validity",
    "test-review",
  ]);

  const testIndex = FLOW_STEPS.indexOf("test");
  const scenarioIndex = FLOW_STEPS.indexOf("scenario-validity");
  const reviewIndex = FLOW_STEPS.indexOf("test-review");
  assert.ok(testIndex >= 0, "test step exists");
  assert.equal(scenarioIndex, testIndex + 1, "scenario-validity immediately follows test");
  assert.equal(reviewIndex, scenarioIndex + 1, "review-test immediately follows scenario-validity");
});

test("R1: scenario-validity leaf metadata resolves from FLOW_DEFINITION", () => {
  const node = resolveNodeFor(FLOW_DEFINITION, "scenario-validity");
  assert.ok(node, "scenario-validity node exists");
  assert.equal(node.id, "scenario-validity");
  assert.equal(node.action, "run-scenario-validity");
  assert.equal(node.instructionsKey, "plan.scenario-validity");
  assert.equal(node.outputSchemaRef, "next-action/scenario-validity.schema.json");
  assert.equal(node.resolveMaxAttempts({ autoApprove: false }), 3);
  assert.equal(node.resolveMaxAttempts({ autoApprove: true }), 3);

  const next = deriveNextAction({ scope: "flow", stepId: "scenario-validity", context: { autoApprove: false } });
  assert.equal(next.action, "run-scenario-validity");
  assert.equal(next.instructionsKey, "plan.scenario-validity");
  assert.equal(next.outputSchemaRef, "next-action/scenario-validity.schema.json");
  assert.equal(next.maxAttempts, 3);
});

test("R2: registry exposes internal active-flow-only scenario-validity command metadata", () => {
  const entry = FLOW_COMMANDS.run["scenario-validity"];
  assert.ok(entry, "flow run scenario-validity registry entry exists");
  assert.equal(entry.helpKey, "flow.run.scenario-validity");
  assert.equal(entry.internal, true, "scenario-validity is an internal flow command");
  assert.equal(entry.requiresFlow, true, "scenario-validity requires an active flow");
  assert.deepEqual(entry.args?.positional || [], [], "no user-facing positional args");
  assert.match(entry.help, /Usage: senti flow run scenario-validity/);
  assert.match(String(entry.command), /run-scenario-validity\.js/);
  assert.equal(typeof entry.command, "function");
  assert.equal(typeof entry.post, "function");
});

test("R2: dispatcher reaches the scenario-validity command implementation through registry entry", async () => {
  const entry = FLOW_COMMANDS.run["scenario-validity"];
  const tmp = createTmpDir("scenario-validity-dispatch-");
  const fm = makeFlowManager(tmp);
  const state = baseState();
  findStepById(state.steps, "scenario-validity").status = "in_progress";
  fm.create(state);
  fm.addActiveFlow(SPEC_ID, "local");

  let executeCount = 0;
  class SpyScenarioValidityCommand extends Command {
    static outputMode = "envelope";

    execute() {
      executeCount += 1;
      return { result: "pass" };
    }
  }

  let stdout = "";
  let exitCode = 0;
  try {
    await dispatch({
      container: {},
      entry: {
        ...entry,
        command: async () => ({ default: SpyScenarioValidityCommand }),
      },
      argv: [],
      envelopeType: "run",
      envelopeKey: "scenario-validity",
      stdout: (s) => { stdout += s; },
      setExitCode: (code) => { exitCode = code; },
      buildHookCtx: () => ({
        root: tmp,
        flowManager: fm,
        flowState: state,
        specId: SPEC_ID,
      }),
    });

    assert.equal(exitCode, 0);
    assert.equal(executeCount, 1, "scenario-validity implementation execute() is called once");
    assert.match(stdout, /"ok": true/);
  } finally {
    removeTmpDir(tmp);
  }
});

test("R2: post hook marks scenario-validity done only on passing result", async () => {
  const entry = FLOW_COMMANDS.run["scenario-validity"];
  const tmp = createTmpDir("scenario-validity-registry-");
  try {
    const state = baseState();
    findStepById(state.steps, "scenario-validity").status = "in_progress";
    const fm = makeFlowManager(tmp);
    fm.create(state);
    fm.addActiveFlow(SPEC_ID, "local");

    await entry.post({ flowManager: fm }, { result: "block" });
    let updated = fm.load();
    assert.notEqual(findStepById(updated.steps, "scenario-validity").status, "done");

    await entry.post({ flowManager: fm }, { result: "pass" });
    updated = fm.load();
    assert.equal(findStepById(updated.steps, "scenario-validity").status, "done");
  } finally {
    removeTmpDir(tmp);
  }
});

test("R2: positional arguments are rejected before scenario-validity execution", async () => {
  const entry = FLOW_COMMANDS.run["scenario-validity"];
  const tmp = createTmpDir("scenario-validity-args-");

  let executeCount = 0;
  class NeverRunCommand extends Command {
    static outputMode = "envelope";

    execute() {
      executeCount += 1;
      return { result: "pass" };
    }
  }

  let stdout = "";
  let exitCode = 0;
  try {
    await dispatch({
      container: {},
      entry: {
        ...entry,
        command: async () => ({ default: NeverRunCommand }),
      },
      argv: ["extra"],
      envelopeType: "run",
      envelopeKey: "scenario-validity",
      stdout: (s) => { stdout += s; },
      setExitCode: (code) => { exitCode = code; },
      buildHookCtx: () => ({
        root: tmp,
        flowManager: makeFlowManager(tmp),
        flowState: baseState(),
        specId: SPEC_ID,
      }),
    });

    assert.notEqual(exitCode, 0);
    assert.match(stdout, /ARGS_ERROR|Unexpected argument: extra/);
    assert.equal(executeCount, 0, "scenario-validity must not execute after arg validation failure");
    assertNoScenarioValidityArtifacts(tmp);
  } finally {
    removeTmpDir(tmp);
  }
});

test("R2: scenario-validity requires an active flow before execution", async () => {
  const entry = FLOW_COMMANDS.run["scenario-validity"];
  const tmp = createTmpDir("scenario-validity-no-flow-");

  let executeCount = 0;
  class NeverRunCommand extends Command {
    static outputMode = "envelope";

    execute() {
      executeCount += 1;
      return { result: "pass" };
    }
  }

  let stdout = "";
  let exitCode = 0;
  try {
    await dispatch({
      container: {},
      entry: {
        ...entry,
        command: async () => ({ default: NeverRunCommand }),
      },
      argv: [],
      envelopeType: "run",
      envelopeKey: "scenario-validity",
      stdout: (s) => { stdout += s; },
      setExitCode: (code) => { exitCode = code; },
      buildHookCtx: () => ({
        root: tmp,
        flowManager: makeFlowManager(tmp),
        flowState: null,
        specId: null,
      }),
    });

    assert.notEqual(exitCode, 0);
    assert.match(stdout, /NO_FLOW|no active flow|active flow/i);
    assert.equal(executeCount, 0, "scenario-validity must not execute without an active flow");
    assertNoScenarioValidityArtifacts(tmp);
  } finally {
    removeTmpDir(tmp);
  }
});
