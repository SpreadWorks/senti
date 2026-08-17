// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Agent } from "../../../src/lib/agent.js";
import { Command } from "../../../src/lib/command.js";
import { Container } from "../../../src/lib/container.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { Logger } from "../../../src/lib/log.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { deriveNextAction, resolveLifecycle } from "../../../src/flow/definition.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import * as gate from "../../../src/flow/lib/run-gate.js";

const KNOWN_GUARDRAILS = [
  { id: "known-a", title: "Known A", body: "Check A.", meta: { category: "test" } },
  { id: "known-b", title: "Known B", body: "Check B.", meta: { category: "test" } },
];

function validObservation(requirementRef = "known-a") {
  return JSON.stringify({
    observations: [{
      failureMode: "guardrail-violation",
      requirementRef,
      where: { file: "spec.json", locator: "$.goal" },
      observed: "concrete failure",
    }],
  });
}

function invalidObservation(requirementRef = "known-a: explanation") {
  return validObservation(requirementRef);
}

function makeProtocolFailure(phase = "integration") {
  assert.equal(typeof gate.GateOutputProtocolFailure, "function");
  return new gate.GateOutputProtocolFailure({
    phase,
    originalError: new gate.EvaluationSchemaError("invalid requirementRef"),
    attempts: [
      { attempt: 1, cacheOutcome: "hit", fresh: false },
      { attempt: 2, cacheOutcome: "bypass", fresh: true },
    ],
    classification: "tooling_provider_failure",
  });
}

test("R1: provider prompt and schema enumerate only current invocation IDs", () => {
  const built = gate.buildGuardrailArticleEvalPrompt(
    "target",
    KNOWN_GUARDRAILS,
    "spec",
  ).build();
  const requirementRef = built.jsonSchema.properties.observations.items.properties.requirementRef;

  assert.deepEqual(requirementRef.enum, ["known-a", "known-b"]);
  assert.match(built.fmtFallback, /known-a/);
  assert.match(built.fmtFallback, /known-b/);
  assert.doesNotMatch(built.fmtFallback, /<guardrail id>/);

  for (const invalid of [
    "prefix-known-a",
    "known-a: explanation",
    "known-a suffix",
    "",
    "unknown",
  ]) {
    assert.throws(
      () => gate.parseGuardrailArticleEvaluation(invalidObservation(invalid), ["known-a", "known-b"]),
      gate.EvaluationSchemaError,
    );
  }

  const requirementPrompt = new gate.RequirementGateBatch({
    requirements: [
      { id: "R-A", desc: "Implement A." },
      { id: "R-B", desc: "Implement B." },
    ],
    diff: "diff --git a/a.js b/a.js\n+implemented\n",
  }).buildPrompt().build();
  const requirementId = requirementPrompt.jsonSchema.properties.evaluations.items.properties.guardrail_id;
  assert.deepEqual(requirementId.enum, ["R-A", "R-B"]);
  assert.match(requirementPrompt.fmtFallback, /R-A/);
  assert.match(requirementPrompt.fmtFallback, /R-B/);

  const validEvaluations = JSON.stringify({ evaluations: [
    { guardrail_id: "R-A", result: "pass", reason: "implemented" },
    { guardrail_id: "R-B", result: "pass", reason: "implemented" },
  ] });
  assert.equal(gate.parseImplRequirementEvaluation(validEvaluations, ["R-A", "R-B"]).length, 2);
  for (const invalid of ["prefix-R-A", "R-A: explanation", "R-A suffix", "", "R-X"]) {
    const response = JSON.stringify({ evaluations: [
      { guardrail_id: invalid, result: "pass", reason: "implemented" },
      { guardrail_id: "R-B", result: "pass", reason: "implemented" },
    ] });
    assert.throws(
      () => gate.parseImplRequirementEvaluation(response, ["R-A", "R-B"]),
      gate.EvaluationSchemaError,
    );
  }
});

test("R2: parser preserves invalid field locator and value as primary evidence", () => {
  let failure;
  try {
    gate.parseGuardrailArticleEvaluation(invalidObservation(), ["known-a", "known-b"]);
  } catch (err) {
    failure = err;
  }

  assert.ok(failure instanceof gate.EvaluationSchemaError);
  assert.equal(failure.data.locator, "observations[0].requirementRef");
  assert.equal(failure.data.invalidValue, "known-a: explanation");
  assert.equal(failure.data.primary, true);

  let requirementFailure;
  try {
    gate.parseImplRequirementEvaluation(JSON.stringify({ evaluations: [
      { guardrail_id: "R-A: explanation", result: "pass", reason: "implemented" },
      { guardrail_id: "R-B", result: "pass", reason: "implemented" },
    ] }), ["R-A", "R-B"]);
  } catch (err) {
    requirementFailure = err;
  }
  assert.ok(requirementFailure instanceof gate.EvaluationSchemaError);
  assert.equal(requirementFailure.data.locator, "evaluations[0].guardrail_id");
  assert.equal(requirementFailure.data.invalidValue, "R-A: explanation");
  assert.equal(requirementFailure.data.primary, true);
});

test("R3: invalid output receives one fresh cache-bypassed repair call", async () => {
  const attempts = [];
  const responses = [invalidObservation(), validObservation("known-b")];
  const result = await gate.evaluateGuardrailObservationsWithRetry({
    knownIds: ["known-a", "known-b"],
    phase: "integration",
    callAgent: async (attempt) => {
      attempts.push(attempt);
      return responses[attempts.length - 1];
    },
  });

  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0], { attempt: 1, repair: false, cacheMode: "default" });
  assert.deepEqual(attempts[1], { attempt: 2, repair: true, cacheMode: "bypass" });
  assert.equal(result.observations[0].requirementRef, "known-b");
});

test("R3: unavailable freshness stops before a repair call", async () => {
  let calls = 0;
  await assert.rejects(
    gate.evaluateGuardrailObservationsWithRetry({
      knownIds: ["known-a"],
      phase: "integration",
      freshRepairAvailable: false,
      callAgent: async () => {
        calls += 1;
        return invalidObservation();
      },
    }),
    (err) => {
      assert.equal(err.code, "GATE_OUTPUT_TOOLING_FAILURE");
      assert.equal(err.data.failureMode, "freshness_unavailable");
      assert.equal(err.data.providerCalls, 1);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("R3: cached replay is not counted as a fresh repair attempt", async () => {
  let calls = 0;
  await assert.rejects(
    gate.evaluateGuardrailObservationsWithRetry({
      knownIds: ["known-a"],
      phase: "integration",
      callAgent: async ({ repair }) => {
        calls += 1;
        if (!repair) return { text: invalidObservation(), cacheOutcome: "hit", fresh: false };
        return { text: invalidObservation(), cacheOutcome: "hit", fresh: false };
      },
    }),
    (err) => {
      assert.equal(err.code, "GATE_OUTPUT_TOOLING_FAILURE");
      assert.equal(err.data.freshRepairAttempts, 0);
      assert.equal(err.data.providerCalls, 0);
      assert.equal(err.data.attempts[1].cacheOutcome, "hit");
      return true;
    },
  );
  assert.equal(calls, 2);
});

test("R4: invalid fresh repair throws tooling failure instead of semantic exhaustion", async () => {
  let failure;
  try {
    await gate.evaluateGuardrailObservationsWithRetry({
      knownIds: ["known-a"],
      phase: "integration",
      callAgent: async () => invalidObservation(),
    });
  } catch (err) {
    failure = err;
  }

  assert.equal(failure.code, "GATE_OUTPUT_TOOLING_FAILURE");
  assert.notEqual(failure.code, "ESCALATE_RETRY_EXHAUSTED");
  assert.equal(failure.data.classification, "tooling_provider_failure");
  assert.equal(failure.data.effectivePhase, "integration");
  assert.equal(failure.data.attemptCount, 2);
  assert.equal(failure.data.attempts.length, 2);
  assert.match(failure.data.originalError, /requirementRef/);
});

test("R4: parse and schema failures retain distinct tooling evidence", async () => {
  const cases = [
    { response: "not json", failureMode: "parse_failure", pattern: /valid JSON/ },
    { response: invalidObservation(), failureMode: "schema_validation_failure", pattern: /requirementRef/ },
  ];
  for (const scenario of cases) {
    let failure;
    try {
      await gate.evaluateGuardrailObservationsWithRetry({
        knownIds: ["known-a"],
        phase: "task-impl",
        callAgent: async () => scenario.response,
      });
    } catch (err) {
      failure = err;
    }
    assert.equal(failure.code, "GATE_OUTPUT_TOOLING_FAILURE");
    assert.equal(failure.data.failureMode, scenario.failureMode);
    assert.equal(failure.data.classification, "tooling_provider_failure");
    assert.equal(failure.data.effectivePhase, "task-impl");
    assert.equal(failure.data.attempts.length, 2);
    assert.match(failure.data.attempts[0].error, scenario.pattern);
    assert.match(failure.data.attempts[1].error, scenario.pattern);
    assert.match(failure.data.originalError, scenario.pattern);
  }
});

function inferredState(phase) {
  if (phase === "task-impl") {
    return {
      steps: [{ id: "impl-gate", status: "pending" }],
      currentTaskId: "T-1",
      tasks: [{
        id: "T-1",
        status: "in_progress",
        steps: [{ id: "task-gate", status: "in_progress" }],
      }],
    };
  }
  const step = phase === "draft" ? "draft-gate" : phase === "spec" ? "spec-gate" : "impl-gate";
  return {
    steps: [{ id: step, status: "in_progress" }],
    currentTaskId: null,
    tasks: [],
  };
}

test("R5: explicit and inferred phases reach envelope, runtime, registry, and issue-log sinks", async () => {
  assert.equal(typeof gate.resolveEffectiveGatePhase, "function");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-435-phase-"));
  const spec = "specs/demo/spec.json";
  fs.mkdirSync(path.join(root, "specs/demo"), { recursive: true });

  for (const phase of ["draft", "spec", "task-impl", "integration"]) {
    const explicitCtx = { phase, flowState: inferredState(phase) };
    const inferredCtx = { phase: undefined, flowState: inferredState(phase) };
    assert.equal(gate.resolveEffectiveGatePhase(explicitCtx), phase);
    assert.equal(gate.resolveEffectiveGatePhase(inferredCtx), phase);
    assert.equal(inferredCtx.phase, phase);

    const failure = makeProtocolFailure(inferredCtx.phase);
    gate.appendIssueLogFromGateError({
      root,
      phase: inferredCtx.phase,
      flowState: { ...inferredCtx.flowState, spec },
    }, failure);
    assert.equal(failure.data.effectivePhase, phase);
    assert.match(failure.message, /invalid requirementRef/);
    assert.doesNotMatch(failure.message, /phase must be a non-empty string/);
  }

  const issueLog = JSON.parse(fs.readFileSync(path.join(root, "specs/demo/issue-log.json"), "utf8"));
  assert.deepEqual(issueLog.entries.map((entry) => entry.phase), ["draft", "spec", "task-impl", "integration"]);
  assert.ok(issueLog.entries.every((entry) => entry.classification === "tooling_provider_failure"));
  fs.rmSync(root, { recursive: true, force: true });

  for (const phase of ["draft", "spec", "task-impl", "integration"]) {
    for (const explicit of [true, false]) {
      const dispatchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-435-dispatch-phase-"));
      const dispatchSpec = "specs/demo/spec.json";
      fs.mkdirSync(path.join(dispatchRoot, "specs/demo"), { recursive: true });
      const dispatchState = {
        ...inferredState(phase),
        runId: "run-435",
        issue: 435,
        spec: dispatchSpec,
        worktree: false,
        plugins: { flowCommandHooks: [] },
      };
      const runtimeMetadata = [];
      const stepUpdates = [];
      const semanticMutations = [];
      const flowManager = {
        updateStepStatus(...args) { stepUpdates.push(args); },
        setStepRuntimeLog(step, metadata) { runtimeMetadata.push({ step, metadata }); },
        appendMetric(...args) { semanticMutations.push(["metric", args]); },
        mutate(...args) { semanticMutations.push(["mutate", args]); },
      };
      const failure = makeProtocolFailure(phase);
      class ThrowProtocolFailure extends Command {
        static outputMode = "envelope";
        execute() { throw failure; }
      }
      const container = new Container();
      container.register("config", {});
      container.register("paths", {
        root: dispatchRoot,
        agentWorkDir: path.join(dispatchRoot, ".tmp/agent"),
      });
      const output = [];
      await dispatch({
        container,
        entry: {
          ...FLOW_COMMANDS.run.gate,
          command: async () => ({ default: ThrowProtocolFailure }),
        },
        argv: explicit ? ["--phase", phase] : [],
        envelopeType: "run",
        envelopeKey: "gate",
        runtimeLog: true,
        stdout: (chunk) => output.push(chunk),
        stderr: () => {},
        setExitCode: () => {},
        buildHookCtx: () => ({
          root: dispatchRoot,
          specId: dispatchSpec,
          flowState: dispatchState,
          flowManager,
          config: {},
        }),
      });

      const envelope = JSON.parse(output.join(""));
      assert.equal(envelope.errors[0].code, "GATE_OUTPUT_TOOLING_FAILURE");
      assert.equal(envelope.data.effectivePhase, phase);
      assert.equal(envelope.data.runtimeLog.runId, "run-435");
      assert.equal(runtimeMetadata.length, 1);
      assert.equal(
        runtimeMetadata[0].step,
        phase === "task-impl" ? "task-gate" : gate.resolveGateStepId(phase),
      );
      assert.ok(explicit ? stepUpdates.length === 1 : stepUpdates.length === 0);
      assert.deepEqual(semanticMutations, []);
      const dispatchIssueLog = JSON.parse(fs.readFileSync(path.join(dispatchRoot, "specs/demo/issue-log.json"), "utf8"));
      assert.equal(dispatchIssueLog.entries[0].phase, phase);
      assert.equal(dispatchIssueLog.entries[0].classification, "tooling_provider_failure");
      fs.rmSync(dispatchRoot, { recursive: true, force: true });
    }
  }

  assert.throws(
    () => new gate.GateOutputProtocolFailure({
      phase: "",
      originalError: new Error("invalid"),
      attempts: [],
      classification: "tooling_provider_failure",
    }),
    /phase/i,
  );
});

test("R5: secondary onError failure does not replace the primary tooling envelope", async () => {
  const failure = makeProtocolFailure("integration");
  class ThrowProtocolFailure extends Command {
    static outputMode = "envelope";
    execute() { throw failure; }
  }
  const container = new Container();
  container.register("config", {});
  const output = [];
  const errors = [];
  await dispatch({
    container,
    entry: {
      command: async () => ({ default: ThrowProtocolFailure }),
      onError() { throw new Error("secondary diagnostic sink failed"); },
    },
    argv: [],
    envelopeType: "run",
    envelopeKey: "gate",
    stdout: (chunk) => output.push(chunk),
    stderr: (chunk) => errors.push(chunk),
    setExitCode: () => {},
  });

  const envelope = JSON.parse(output.join(""));
  assert.equal(envelope.errors[0].code, "GATE_OUTPUT_TOOLING_FAILURE");
  assert.match(envelope.errors[0].messages[0], /invalid requirementRef/);
  assert.equal(envelope.data.effectivePhase, "integration");
  assert.match(errors.join(""), /secondary diagnostic sink failed/);
  assert.doesNotMatch(envelope.errors[0].messages[0], /secondary diagnostic sink failed/);
});

test("R6: registry onError records tooling evidence without semantic lifecycle mutation", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-435-onerror-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const spec = "specs/demo/spec.json";
  fs.mkdirSync(path.join(root, "specs/demo"), { recursive: true });
  const flowState = {
    spec,
    currentTaskId: "T-1",
    steps: [{ id: "impl-gate", status: "in_progress" }],
    tasks: [{ id: "T-1", status: "in_progress", steps: [] }],
    metrics: [{ phase: "integration", gateRetry: 0 }],
    plugins: { flowCommandHooks: [] },
  };
  const before = structuredClone(flowState);
  const semanticMutations = [];
  const flowManager = {
    load() { return flowState; },
    appendMetric(input) { semanticMutations.push(["metric", input]); },
    updateStepStatus(...args) { semanticMutations.push(["step", args]); },
    mutate(fn) { semanticMutations.push(["mutate"]); fn(flowState); },
  };

  await FLOW_COMMANDS.run.gate.onError({
    root,
    phase: "integration",
    flowState,
    flowManager,
    config: {},
  }, makeProtocolFailure("integration"));

  assert.deepEqual(semanticMutations, []);
  assert.deepEqual(flowState, before);
  assert.deepEqual(fs.readdirSync(path.join(root, "specs/demo")).sort(), ["issue-log.json"]);
  const issueLog = JSON.parse(fs.readFileSync(path.join(root, "specs/demo/issue-log.json"), "utf8"));
  assert.equal(issueLog.entries.length, 1);
  assert.equal(issueLog.entries[0].classification, "tooling_provider_failure");
  assert.equal(issueLog.entries[0].attemptCount, 2);
});

test("R7: valid PASS and semantic FAIL retain production lifecycle actions", () => {
  makeProtocolFailure("integration");
  const cases = [
    { phase: "draft", lifecycleStep: "draft-gate", routeStep: "draft-gate", scope: "flow", sideEffects: null },
    { phase: "spec", lifecycleStep: "spec-gate", routeStep: "spec-gate", scope: "flow", sideEffects: null },
    {
      phase: "task-impl",
      lifecycleStep: "impl-gate",
      routeStep: "task-gate",
      scope: "task",
      sideEffects: ["completeTask", "promoteNextTask", "mergeOverview"],
    },
    {
      phase: "integration",
      lifecycleStep: "impl-gate",
      routeStep: "impl-gate",
      scope: "flow",
      sideEffects: ["completeTask", "promoteNextTask", "mergeOverview"],
    },
  ];

  for (const scenario of cases) {
    const evaluations = [
      { guardrail_id: "known-a", result: "pass", reason: "implemented", category: "test" },
      { guardrail_id: "known-b", result: "fail", reason: "missing", category: "test" },
    ];
    const passResult = gate.buildGateResultArtifact({
      level: gate.PHASE_TO_LEVEL[scenario.phase],
      phase: scenario.phase,
      target: "target.json",
      verdict: "pass",
      evaluations: evaluations.slice(0, 1),
      passPrescription: "continue",
      failPrescription: "repair",
    });
    const failResult = {
      ...gate.buildGateResultArtifact({
        level: gate.PHASE_TO_LEVEL[scenario.phase],
        phase: scenario.phase,
        target: "target.json",
        verdict: "fail",
        evaluations,
        passPrescription: "continue",
        failPrescription: "repair",
      }),
      artifacts: {
        ...gate.buildGateResultArtifact({
          level: gate.PHASE_TO_LEVEL[scenario.phase],
          phase: scenario.phase,
          target: "target.json",
          verdict: "fail",
          evaluations,
          passPrescription: "continue",
          failPrescription: "repair",
        }).artifacts,
        failureKind: "ai_semantic_fail",
      },
    };
    assert.equal(passResult.artifacts.phase, scenario.phase);
    assert.equal(failResult.artifacts.phase, scenario.phase);
    assert.deepEqual(gate.buildPassedGuardrails(evaluations), ["known-a"]);

    for (const explicitPhase of [scenario.phase, undefined]) {
      const passActions = resolveLifecycle({
        event: "gate:post",
        command: "run-gate",
        phase: explicitPhase,
        result: passResult,
        flowState: inferredState(scenario.phase),
      });
      const failActions = resolveLifecycle({
        event: "gate:post",
        command: "run-gate",
        phase: explicitPhase,
        result: failResult,
        flowState: inferredState(scenario.phase),
      });
      assert.deepEqual(
        passActions.map((action) => action.constructor.name),
        ["IncrementMetric", "ExecuteSideEffects", "SetStepStatus"],
      );
      assert.deepEqual(
        failActions.map((action) => action.constructor.name),
        ["IncrementMetric", "SetStepStatus", "AppendIssueLog"],
      );
      assert.equal(passActions[0].phase, scenario.phase);
      assert.equal(passActions[2].step, scenario.lifecycleStep);
      assert.equal(failActions[1].step, scenario.lifecycleStep);
    }

    const definition = deriveNextAction({
      scope: scenario.scope,
      stepId: scenario.routeStep,
      context: inferredState(scenario.phase),
    });
    assert.deepEqual(definition.sideEffects, scenario.sideEffects);

    const metrics = [];
    const ctx = {
      flowState: {},
      flowManager: {
        appendMetric(input) { metrics.push(input); },
        mutate(fn) { fn(ctx.flowState); },
      },
    };
    gate.updateGateRetryCounter(ctx, passResult);
    gate.updateGateRetryCounter(ctx, failResult);
    assert.deepEqual(metrics[0], {
      phase: scenario.phase,
      counter: "gateRetry",
      delta: 0,
      reset: true,
    });
    assert.deepEqual(metrics[1], {
      phase: scenario.phase,
      counter: "gateRetry",
      delta: 1,
    });
  }
});

test("R8: target mismatch stops before hooks, command, cache, and state mutation", async () => {
  makeProtocolFailure("integration");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-435-guard-"));
  const specDir = path.join(root, "specs/319-gate-schema-failure-isolation");
  const cacheDir = path.join(root, ".senti/agent-cache");
  fs.mkdirSync(specDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  const state = {
    runId: "run-435",
    issue: 435,
    spec: "specs/319-gate-schema-failure-isolation/spec.json",
    steps: [{ id: "impl-gate", status: "in_progress" }],
    tasks: [],
  };
  fs.writeFileSync(path.join(specDir, "flow.json"), JSON.stringify(state, null, 2) + "\n");
  fs.writeFileSync(path.join(specDir, "issue-log.json"), '{"version":1,"entries":[]}\n');
  fs.writeFileSync(path.join(specDir, "impl-gate-result.json"), '{"result":"pass"}\n');
  fs.writeFileSync(path.join(specDir, "impl-gate-source.json"), '{"result":"pass"}\n');
  fs.writeFileSync(path.join(cacheDir, "specs-319-gate-schema-failure-isolation-spec.json.json"), '{"version":1,"entries":{"key":{"text":"cached-invalid"}}}\n');

  const snapshotTree = (dir) => {
    const entries = [];
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const absolute = path.join(current, entry.name);
        const relative = path.relative(dir, absolute);
        if (entry.isDirectory()) walk(absolute);
        else entries.push([relative, fs.readFileSync(absolute).toString("base64")]);
      }
    };
    walk(dir);
    return entries;
  };
  const durableBefore = snapshotTree(root);
  const mismatches = [
    ["--expect-run-id", "wrong-run"],
    ["--expect-issue", "999"],
    ["--expect-spec", "specs/other/spec.json"],
  ];
  for (const [option, value] of mismatches) {
    const container = new Container();
    container.register("config", {});
    container.register("paths", { root, agentWorkDir: path.join(root, ".tmp") });
    let commandLoads = 0;
    let preCalls = 0;
    let cacheReads = 0;
    const snapshot = JSON.stringify(state);
    const output = [];

    class MustNotLoad extends Command {
      static outputMode = "envelope";
      execute() {
        cacheReads += 1;
        throw new Error("must not execute");
      }
    }

    await dispatch({
      container,
      entry: {
        args: { options: ["--expect-run-id", "--expect-issue", "--expect-spec"] },
        command: async () => {
          commandLoads += 1;
          return { default: MustNotLoad };
        },
        pre() { preCalls += 1; },
      },
      argv: [option, value],
      envelopeType: "run",
      envelopeKey: "gate",
      stdout: (chunk) => output.push(chunk),
      setExitCode: () => {},
      buildHookCtx: () => ({ flowState: state }),
    });

    const envelope = JSON.parse(output.join(""));
    assert.equal(envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(commandLoads, 0);
    assert.equal(preCalls, 0);
    assert.equal(cacheReads, 0);
    assert.equal(JSON.stringify(state), snapshot);
    assert.deepEqual(snapshotTree(root), durableBefore);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test("R9: repair cache bypass leaves normal prompt cache behavior unchanged", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-435-agent-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const countFile = path.join(root, "provider-count.txt");
  const script = [
    "const fs=require('fs');",
    "const file=process.argv[1];",
    "let count=fs.existsSync(file)?Number(fs.readFileSync(file,'utf8')):0;",
    "count+=1; fs.writeFileSync(file,String(count));",
    "process.stdout.write('provider-'+count);",
  ].join("");
  const profile = { command: "node", args: ["-e", script, countFile, "{{PROMPT}}"] };
  const config = {
    agent: {
      default: "test/cache",
      providers: { "test/cache": profile },
      timeout: 30,
    },
  };
  const metrics = [];
  const flowManager = {
    resolveCurrentContext() {
      return {
        spec: "specs/319-gate-schema-failure-isolation/spec.json",
        taskId: null,
        sentiPhase: "impl",
      };
    },
    loadActiveFlows() {
      return [{ spec: "specs/319-gate-schema-failure-isolation/spec.json" }];
    },
    appendMetric(metric) { metrics.push(metric); },
    accumulateAgentMetrics() {},
  };
  const agent = new Agent({
    config,
    paths: { root, agentWorkDir: path.join(root, ".tmp") },
    registry: new ProviderRegistry(config.agent.providers),
    logger: new Logger({ logDir: root, enabled: false }),
    flowManager,
  });

  const initial = await agent.call("same prompt", { commandId: "flow.spec.gate" });
  const cached = await agent.call("same prompt", { commandId: "flow.spec.gate" });
  const repaired = await agent.call("same prompt", {
    commandId: "flow.spec.gate",
    cacheMode: "bypass",
  });
  const normalAfterRepair = await agent.call("same prompt", { commandId: "flow.spec.gate" });

  assert.equal(initial, "provider-1");
  assert.equal(cached, "provider-1");
  assert.equal(repaired, "provider-2");
  assert.equal(normalAfterRepair, "provider-1");
  assert.equal(fs.readFileSync(countFile, "utf8"), "2");
  assert.ok(metrics.some((metric) => metric.cachedResponse === true));
});
