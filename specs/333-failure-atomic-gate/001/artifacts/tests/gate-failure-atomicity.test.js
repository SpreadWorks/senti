// spec: R1 R2 R3 R4 R5 R6
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { Agent } from "../../../src/lib/agent.js";
import { Command } from "../../../src/lib/command.js";
import { Container } from "../../../src/lib/container.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { Logger } from "../../../src/lib/log.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { deriveNextAction } from "../../../src/flow/definition.js";
import { resolveGatePhaseFromState } from "../../../src/flow/lib/gate-step.js";
import { GateMutationOwner } from "../../../src/flow/lib/gate-mutation-owner.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import * as gate from "../../../src/flow/lib/run-gate.js";

function inferredIntegrationState() {
  return {
    runId: "run-001-test",
    issue: 1,
    spec: "specs/001-test/spec.json",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: [
      { id: "spec-gate", status: "in_progress" },
      { id: "impl-gate", status: "in_progress" },
    ],
    tasks: [],
    currentTaskId: null,
  };
}

class PersistedStaleGateManager {
  constructor(specDir, state) {
    this.file = path.join(specDir, "flow.json");
    this.recordedTransitions = [];
    this.recordedMetrics = [];
    fs.writeFileSync(this.file, `${JSON.stringify(state, null, 2)}\n`);
  }

  load() {
    return JSON.parse(fs.readFileSync(this.file, "utf8"));
  }

  updateStepStatus(transition) {
    return this.updateStepStatuses([transition]);
  }

  updateStepStatuses(transitions) {
    const next = this.load();
    for (const transition of transitions) {
      const step = next.steps.find((candidate) => candidate.id === transition.stepId);
      assert.ok(step, `unknown persisted test step: ${transition.stepId}`);
      assert.equal(step.status, transition.currentStatus);
      step.status = transition.requestedStatus;
    }
    fs.writeFileSync(this.file, `${JSON.stringify(next, null, 2)}\n`);
    this.recordedTransitions.push(...transitions);
  }

  mutate(mutation) {
    const next = this.load();
    mutation(next);
    fs.writeFileSync(this.file, `${JSON.stringify(next, null, 2)}\n`);
  }

  appendMetric(metric) {
    this.recordedMetrics.push(metric);
    this.mutate((state) => {
      state.metrics ||= [];
      state.metrics.push(metric);
    });
  }
}

function persistedGateFixture(prefix) {
  const root = createTmpDir(prefix);
  const state = inferredIntegrationState();
  const specDir = path.join(root, "specs", "001-test");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), `${JSON.stringify({
    requirements: [{ id: "R1", desc: "Preserve gate state.", priority: "must" }],
  }, null, 2)}\n`);

  const manager = new PersistedStaleGateManager(specDir, state);

  fs.writeFileSync(path.join(specDir, "issue-log.json"), '{"entries":[{"step":"sentinel"}]}\n');
  fs.writeFileSync(path.join(specDir, "flow-findings.json"), '{"version":1,"entries":[]}\n');
  fs.writeFileSync(path.join(specDir, "impl-gate-source.json"), '{"source":"sentinel"}\n');
  fs.writeFileSync(path.join(specDir, "impl-gate-result.json"), '{"result":"sentinel"}\n');
  fs.mkdirSync(path.join(root, ".tmp", "logs"), { recursive: true });
  fs.writeFileSync(path.join(root, ".tmp", "logs", "001-test.log"), "diagnostic-sentinel\n");
  return { root, specDir, manager };
}

const DURABLE_SURFACE_FILES = [
  "flow.json",
  "issue-log.json",
  "flow-findings.json",
  "impl-gate-source.json",
  "impl-gate-result.json",
];

function durableSurfaceSnapshot(specDir) {
  return Object.fromEntries(DURABLE_SURFACE_FILES.map((name) => {
    const file = path.join(specDir, name);
    return [name, fs.existsSync(file) ? fs.readFileSync(file) : null];
  }));
}

function durableDiagnosticSnapshot(root) {
  const file = path.join(root, ".tmp", "logs", "001-test.log");
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

function transitionFor(state) {
  const resolution = resolveGatePhaseFromState(state);
  const owner = new GateMutationOwner({ flowState: state, phase: resolution.phase });
  return new gate.InferredGateTransition({ flowState: state, resolution, owner });
}

function serialized(value) {
  return JSON.stringify(value);
}

function validGateResult(result = "pass") {
  return {
    result,
    artifacts: {
      level: "implementation",
      phase: "integration",
      target: "specs/001-test/spec.json",
      ...(result === "fail" && { failureKind: "ai_semantic_fail" }),
      evaluations: [{
        guardrail_id: "R1",
        result,
        category: "requirements",
        reason: result === "pass" ? "" : "The requirement remains unmet.",
      }],
      issues: result === "fail" ? ["One bounded semantic finding remains."] : [],
    },
    next: result === "pass" ? "refresh-next-action" : null,
  };
}

function protocolFailure() {
  return new gate.GateOutputProtocolFailure({
    phase: "integration",
    originalError: new gate.EvaluationSchemaError("invalid gate output"),
    attempts: [{
      attempt: 1,
      repair: false,
      cacheOutcome: "miss",
      fresh: true,
      providerCalled: true,
      error: "invalid gate output",
    }],
    classification: "tooling_provider_failure",
  });
}

function configuredProviderAgent(root) {
  const profile = {
    command: process.execPath,
    args: ["-e", "process.stdout.write('configured-provider')", "{{PROMPT}}"],
  };
  const config = {
    agent: {
      default: "test/exec",
      providers: { "test/exec": profile },
      timeout: 30,
    },
  };
  return new Agent({
    config,
    paths: { root, agentWorkDir: path.join(root, ".tmp") },
    registry: new ProviderRegistry(config.agent.providers),
    logger: new Logger({ logDir: path.join(root, ".tmp"), enabled: false }),
    flowManager: {
      resolveCurrentContext() {
        return { spec: "specs/001-test/spec.json", taskId: null, sentiPhase: "impl" };
      },
      loadActiveFlows() {
        return [{ spec: "specs/001-test/spec.json" }];
      },
      appendMetric() {},
      accumulateAgentMetrics() {},
    },
  });
}

async function runBoundaryAttempt({
  boundary,
  attempt,
  manager,
  specDir,
  committed,
  semanticResult = "pass",
}) {
  const state = manager.load();
  const executeGate = async () => {
    if (attempt === 1 && boundary === "validation") return { result: "unknown", artifacts: {} };
    if (attempt === 1 && boundary === "agent") throw new Error("agent execution fault");
    if (attempt === 1 && boundary === "output-protocol") throw protocolFailure();
    return validGateResult(semanticResult);
  };
  const writeArtifact = attempt === 1 && boundary === "artifact-write"
    ? () => {
      fs.writeFileSync(path.join(specDir, "issue-log.json"), '{"entries":[{"step":"partial"}]}\n');
      fs.writeFileSync(path.join(specDir, "flow-findings.json"), '{"version":1,"entries":[{"partial":true}]}\n');
      fs.writeFileSync(path.join(specDir, "impl-gate-source.json"), '{"source":"partial"}\n');
      throw new Error("artifact write fault");
    }
    : (file, content) => fs.writeFileSync(file, content);

  return gate.runGatePhaseWithDependencies({
    phase: "integration",
    specDir,
    transition: transitionFor(state),
    flowManager: manager,
    executeGate,
    writeArtifact,
    onCommitted(transitions, result) {
      committed.push({ transitions, result });
    },
  });
}

async function dispatchGateAttempt({
  fixture,
  boundary,
  attempt,
  semanticResult = "pass",
  callbackEvents,
  commandAttempts,
}) {
  const invocationState = fixture.manager.load();
  class DispatchedGateCommand extends Command {
    static outputMode = "envelope";

    execute() {
      commandAttempts.push(attempt);
      return runBoundaryAttempt({
        boundary,
        attempt,
        manager: fixture.manager,
        specDir: fixture.specDir,
        committed: [],
        semanticResult,
      });
    }
  }

  const entry = {
    ...FLOW_COMMANDS.run.gate,
    command: async () => ({ default: DispatchedGateCommand }),
    async pre(ctx) {
      callbackEvents.push("pre");
      await FLOW_COMMANDS.run.gate.pre(ctx);
    },
    async post(ctx, result) {
      callbackEvents.push("post");
      await FLOW_COMMANDS.run.gate.post(ctx, result);
    },
    async onError(ctx, error) {
      callbackEvents.push("onError");
      await FLOW_COMMANDS.run.gate.onError(ctx, error);
    },
  };
  const container = new Container();
  container.register("config", {});
  container.register("paths", {
    root: fixture.root,
    agentWorkDir: path.join(fixture.root, ".tmp", "agent"),
  });
  const stdout = [];
  await dispatch({
    container,
    entry,
    argv: [],
    envelopeType: "run",
    envelopeKey: "gate",
    stdout: (chunk) => stdout.push(chunk),
    stderr: () => {},
    setExitCode: () => {},
    buildHookCtx: () => ({
      root: fixture.root,
      specId: "001-test",
      flowState: invocationState,
      flowManager: fixture.manager,
      config: {},
    }),
  });
  return JSON.parse(stdout.join(""));
}

test("R1: inferred phase resolution and transition construction are pure", () => {
  const fixture = persistedGateFixture("gate-pure-inference-");
  const diagnostics = [];
  const originalWrite = process.stderr.write;
  try {
    const state = fixture.manager.load();
    const beforeState = serialized(state);
    const beforeFiles = durableSurfaceSnapshot(fixture.specDir);
    const beforeDiagnostic = durableDiagnosticSnapshot(fixture.root);
    process.stderr.write = (chunk) => {
      diagnostics.push(String(chunk));
      return true;
    };

    const resolution = resolveGatePhaseFromState(state);
    assert.deepEqual(
      { phase: resolution.phase, staleSteps: resolution.staleSteps },
      { phase: "integration", staleSteps: ["spec-gate"] },
    );
    const transition = transitionFor(state);

    assert.equal(transition.phase, "integration");
    assert.deepEqual(transition.staleStepIds, ["spec-gate"]);
    assert.equal(transition.owner.stepId, "impl-gate");
    assert.equal(serialized(fixture.manager.load()), beforeState);
    assert.deepEqual(durableSurfaceSnapshot(fixture.specDir), beforeFiles);
    assert.deepEqual(durableDiagnosticSnapshot(fixture.root), beforeDiagnostic);
    assert.deepEqual(fixture.manager.recordedTransitions, []);
    assert.equal(diagnostics.some((line) => /transitioned|committed/i.test(line)), false);
  } finally {
    process.stderr.write = originalWrite;
    removeTmpDir(fixture.root);
  }
});

test("R2: inferred transition validates identity, stale steps, and GateMutationOwner", () => {
  const state = inferredIntegrationState();
  const before = serialized(state);
  const resolution = resolveGatePhaseFromState(state);
  const owner = new GateMutationOwner({ flowState: state, phase: resolution.phase });
  const transition = new gate.InferredGateTransition({ flowState: state, resolution, owner });

  assert.equal(transition.owner, owner);
  assert.throws(
    () => new gate.InferredGateTransition({
      flowState: state,
      resolution: { phase: "", staleSteps: ["spec-gate"] },
      owner,
    }),
    /phase/i,
  );
  assert.throws(
    () => new gate.InferredGateTransition({
      flowState: state,
      resolution: { phase: "integration", staleSteps: ["spec-gate", "spec-gate"] },
      owner,
    }),
    /stale|unique|duplicate/i,
  );
  assert.throws(
    () => new gate.InferredGateTransition({
      flowState: state,
      resolution: { phase: "integration", staleSteps: ["impl-gate"] },
      owner,
    }),
    /owner|stale/i,
  );
  assert.throws(
    () => new gate.InferredGateTransition({
      flowState: state,
      resolution,
      owner: {},
    }),
    /GateMutationOwner|owner/i,
  );
  const foreignState = { ...inferredIntegrationState(), runId: "run-foreign", spec: "specs/foreign/spec.json" };
  assert.throws(
    () => new gate.InferredGateTransition({
      flowState: state,
      resolution,
      owner: new GateMutationOwner({ flowState: foreignState, phase: "integration" }),
    }),
    /identity|owner|flowState/i,
  );
  assert.equal(serialized(state), before);
});

test("R3: validation, agent, output-protocol, and artifact failures are pre-commit", async () => {
  for (const boundary of ["validation", "agent", "output-protocol", "artifact-write"]) {
    const fixture = persistedGateFixture(`gate-${boundary}-`);
    try {
      const committed = [];
      const beforeState = serialized(fixture.manager.load());
      const beforeFiles = durableSurfaceSnapshot(fixture.specDir);

      await assert.rejects(
        runBoundaryAttempt({
          boundary,
          attempt: 1,
          manager: fixture.manager,
          specDir: fixture.specDir,
          committed,
        }),
        boundary === "validation"
          ? /gate result|result.*pass|result.*fail|validation/i
          : new RegExp(boundary === "output-protocol" ? "invalid gate output" : `${boundary.split("-")[0]}.*fault`),
      );

      assert.equal(serialized(fixture.manager.load()), beforeState, boundary);
      assert.deepEqual(durableSurfaceSnapshot(fixture.specDir), beforeFiles, boundary);
      assert.deepEqual(fixture.manager.recordedTransitions, [], boundary);
      assert.deepEqual(committed, [], boundary);
    } finally {
      removeTmpDir(fixture.root);
    }
  }
});

test("R4: persisted PASS and FAIL judgments commit explicit recovery exactly once", async () => {
  for (const semanticResult of ["pass", "fail"]) {
    const fixture = persistedGateFixture(`gate-${semanticResult}-`);
    try {
      const state = fixture.manager.load();
      const resolution = resolveGatePhaseFromState(state);
      const selectedOwnerCalls = [];
      const baseOwner = new GateMutationOwner({ flowState: state, phase: resolution.phase });
      const observedOwner = new Proxy(baseOwner, {
        get(target, property, receiver) {
          if (property !== "createTransition") return Reflect.get(target, property, receiver);
          return (input) => {
            selectedOwnerCalls.push(input);
            return target.createTransition(input);
          };
        },
      });
      const transition = new gate.InferredGateTransition({
        flowState: state,
        resolution,
        owner: observedOwner,
      });
      const events = [];

      const result = await gate.runGatePhaseWithDependencies({
        phase: "integration",
        specDir: fixture.specDir,
        transition,
        flowManager: fixture.manager,
        executeGate: async () => validGateResult(semanticResult),
        writeArtifact(file, content) {
          events.push("artifact");
          fs.writeFileSync(file, content);
        },
        onCommitted(committedTransitions) {
          events.push(`commit:${committedTransitions.length}`);
        },
      });

      assert.deepEqual(events, ["artifact", "commit:1"]);
      assert.deepEqual(result.changed, ["impl-gate-result.json"]);
      assert.equal(fixture.manager.load().steps[0].status, "done");
      assert.equal(fixture.manager.recordedTransitions.length, 1);
      assert.equal(fixture.manager.recordedTransitions[0].stepId, "spec-gate");
      assert.deepEqual(selectedOwnerCalls, [{
        status: "in_progress",
        event: "gate:phase-inference",
      }]);
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(fixture.specDir, "impl-gate-result.json"), "utf8")).result,
        semanticResult,
      );
      assert.deepEqual(transition.commit(fixture.manager), []);
      assert.equal(fixture.manager.recordedTransitions.length, 1);
      assert.equal(selectedOwnerCalls.length, 1);
      assert.equal(
        fixture.manager.load().steps.find((step) => step.id === "impl-gate").status,
        "in_progress",
        "the selected owner is already active; dispatcher post owns PASS completion and FAIL retention",
      );
    } finally {
      removeTmpDir(fixture.root);
    }
  }
});

test("R5: every pre-commit boundary retries once without duplicate durable effects", async () => {
  for (const boundary of ["validation", "agent", "output-protocol", "artifact-write"]) {
    const fixture = persistedGateFixture(`gate-retry-${boundary}-`);
    try {
      const committed = [];
      const beforeState = serialized(fixture.manager.load());
      const beforeFiles = durableSurfaceSnapshot(fixture.specDir);

      await assert.rejects(runBoundaryAttempt({
        boundary,
        attempt: 1,
        manager: fixture.manager,
        specDir: fixture.specDir,
        committed,
      }));
      assert.equal(serialized(fixture.manager.load()), beforeState, boundary);
      assert.deepEqual(durableSurfaceSnapshot(fixture.specDir), beforeFiles, boundary);
      assert.deepEqual(fixture.manager.recordedTransitions, [], boundary);
      assert.deepEqual(committed, [], boundary);

      await runBoundaryAttempt({
        boundary,
        attempt: 2,
        manager: fixture.manager,
        specDir: fixture.specDir,
        committed,
      });

      const artifacts = fs.readdirSync(fixture.specDir).filter((name) => name.endsWith("-gate-result.json"));
      const persisted = JSON.parse(fs.readFileSync(
        path.join(fixture.specDir, "impl-gate-result.json"),
        "utf8",
      ));
      assert.deepEqual(artifacts, ["impl-gate-result.json"], boundary);
      assert.equal(fixture.manager.recordedTransitions.length, 1, boundary);
      assert.equal(committed.length, 1, boundary);
      assert.equal(persisted.artifacts.evaluations.length, 1, boundary);
      assert.equal(new Set(persisted.artifacts.evaluations.map((item) => item.guardrail_id)).size, 1, boundary);
      assert.equal(
        fs.readFileSync(path.join(fixture.specDir, "issue-log.json"), "utf8"),
        beforeFiles["issue-log.json"].toString(),
        boundary,
      );
      assert.equal(
        fs.readFileSync(path.join(fixture.specDir, "flow-findings.json"), "utf8"),
        beforeFiles["flow-findings.json"].toString(),
        boundary,
      );
    } finally {
      removeTmpDir(fixture.root);
    }
  }
});

test("R5: dispatcher retry scenarios execute exactly one failed and one successful command attempt", async () => {
  assert.equal(
    gate.resolveRetryMax({ scope: "flow", autoApprove: true }, "integration"),
    5,
    "the production integration gate retry limit remains unchanged",
  );

  for (const boundary of ["validation", "agent", "output-protocol", "artifact-write"]) {
    const fixture = persistedGateFixture(`gate-dispatch-retry-${boundary}-`);
    try {
      const callbackEvents = [];
      const commandAttempts = [];
      const first = await dispatchGateAttempt({
        fixture,
        boundary,
        attempt: 1,
        callbackEvents,
        commandAttempts,
      });
      const second = await dispatchGateAttempt({
        fixture,
        boundary,
        attempt: 2,
        semanticResult: "fail",
        callbackEvents,
        commandAttempts,
      });

      assert.equal(first.ok, false, boundary);
      assert.equal(second.ok, true, boundary);
      assert.deepEqual(commandAttempts, [1, 2], boundary);
      assert.deepEqual(callbackEvents, ["pre", "onError", "pre", "post"], boundary);
      assert.equal(fixture.manager.recordedTransitions.length, 1, boundary);
      assert.deepEqual(
        fixture.manager.recordedTransitions.map((transition) => transition.stepId),
        ["spec-gate"],
        boundary,
      );
      const persistedResult = JSON.parse(
        fs.readFileSync(path.join(fixture.specDir, "impl-gate-result.json"), "utf8"),
      );
      assert.deepEqual(persistedResult.artifacts.issues, [
        "One bounded semantic finding remains.",
      ], boundary);
      assert.equal(persistedResult.artifacts.evaluations.length, 1, boundary);
      const issueLog = JSON.parse(
        fs.readFileSync(path.join(fixture.specDir, "issue-log.json"), "utf8"),
      );
      assert.equal(
        issueLog.entries.filter((entry) => entry.trigger === "gate post hook (auto)").length,
        1,
        boundary,
      );
    } finally {
      removeTmpDir(fixture.root);
    }
  }
});

test("R6: direct exports preserve explicit and inferred phase behavior", async () => {
  const command = new gate.default();
  assert.ok(command instanceof gate.RunGateCommand);

  const explicit = { phase: "spec", flowState: inferredIntegrationState() };
  assert.equal(gate.resolveEffectiveGatePhase(explicit), "spec");

  const singleStepState = inferredIntegrationState();
  singleStepState.steps[0].status = "done";
  const singleStep = { phase: undefined, flowState: singleStepState };
  assert.equal(
    gate.resolveEffectiveGatePhase(singleStep, resolveGatePhaseFromState(singleStepState)),
    "integration",
  );

  const multiStep = { phase: undefined, flowState: inferredIntegrationState() };
  assert.equal(
    gate.resolveEffectiveGatePhase(multiStep, resolveGatePhaseFromState(multiStep.flowState)),
    "integration",
  );
  assert.equal(gate.resolveGateStepId("integration"), "impl-gate");

  const explicitFixture = persistedGateFixture("gate-explicit-phase-");
  try {
    const before = serialized(explicitFixture.manager.load());
    class ExplicitSpecGateCommand extends gate.RunGateCommand {
      async executeSpec() {
        return {
          result: "pass",
          changed: [],
          artifacts: {
            level: "parent",
            phase: "spec",
            evaluations: [],
            issues: [],
          },
          next: "approval",
        };
      }
    }
    const result = await new ExplicitSpecGateCommand().execute({
      root: explicitFixture.root,
      phase: "spec",
      flowState: explicitFixture.manager.load(),
      flowManager: explicitFixture.manager,
      config: {},
      skipGuardrail: true,
    });

    assert.equal(result.artifacts.phase, "spec");
    assert.equal(serialized(explicitFixture.manager.load()), before);
    assert.deepEqual(explicitFixture.manager.recordedTransitions, []);
  } finally {
    removeTmpDir(explicitFixture.root);
  }
});

test("R6: provider, lifecycle, retry, artifact, and routing parity is exercised directly", async () => {
  const providerRoot = createTmpDir("gate-provider-parity-");
  try {
    const output = await configuredProviderAgent(providerRoot).call("evaluate", {
      commandId: "flow.spec.gate",
      systemPrompt: "gate parity",
      jsonSchema: { type: "object" },
      fmtFallback: "gate parity",
    });
    assert.equal(output, "configured-provider");
  } finally {
    removeTmpDir(providerRoot);
  }

  for (const semanticResult of ["pass", "fail"]) {
    const artifactRoot = createTmpDir(`gate-${semanticResult}-artifact-parity-`);
    try {
      const sourcePath = path.join(artifactRoot, "impl-gate-source.json");
      fs.writeFileSync(sourcePath, '{"source":"parity-sentinel"}\n');
      const gateResult = validGateResult(semanticResult);
      const written = await gate.runGatePhaseWithDependencies({
        phase: "integration",
        specDir: artifactRoot,
        gateResult,
      });
      assert.deepEqual(written.changed, ["impl-gate-result.json"]);
      const persisted = JSON.parse(
        fs.readFileSync(path.join(artifactRoot, "impl-gate-result.json"), "utf8"),
      );
      assert.equal(persisted.result, semanticResult);
      assert.equal(persisted.artifacts.phase, "integration");
      assert.deepEqual(
        persisted.artifacts.evaluations.map(({ guardrail_id, result }) => ({ guardrail_id, result })),
        [{ guardrail_id: "R1", result: semanticResult }],
      );
      assert.equal(
        fs.readFileSync(sourcePath, "utf8"),
        '{"source":"parity-sentinel"}\n',
      );
      assert.deepEqual(
        fs.readdirSync(artifactRoot).sort(),
        ["impl-gate-result.json", "impl-gate-source.json"],
      );
    } finally {
      removeTmpDir(artifactRoot);
    }
  }

  const nonIntegrationArtifactPaths = [
    {
      phase: "draft",
      source: "draft-gate-source.json",
      result: "draft-gate-result.json",
    },
    {
      phase: "spec",
      source: "spec-gate-source.json",
      result: "spec-gate-result.json",
    },
    {
      phase: "task-impl",
      source: "task-impl-gate-source.json",
      result: "task-impl-gate-result.json",
    },
  ];
  for (const artifactPaths of nonIntegrationArtifactPaths) {
    const artifactRoot = createTmpDir(`gate-${artifactPaths.phase}-artifact-path-parity-`);
    try {
      const sourcePath = path.join(artifactRoot, artifactPaths.source);
      fs.writeFileSync(sourcePath, '{"source":"parity-sentinel"}\n');
      const written = await gate.runGatePhaseWithDependencies({
        phase: artifactPaths.phase,
        specDir: artifactRoot,
        gateResult: validGateResult("pass"),
      });
      assert.deepEqual(written.changed, [artifactPaths.result]);
      assert.equal(
        fs.readFileSync(sourcePath, "utf8"),
        '{"source":"parity-sentinel"}\n',
      );
      assert.deepEqual(
        fs.readdirSync(artifactRoot).sort(),
        [artifactPaths.result, artifactPaths.source].sort(),
      );
    } finally {
      removeTmpDir(artifactRoot);
    }
  }

  const metrics = [];
  const retryContext = {
    flowState: {},
    flowManager: {
      appendMetric(input) {
        metrics.push(input);
      },
      mutate(fn) {
        fn(retryContext.flowState);
      },
    },
  };
  gate.updateGateRetryCounter(retryContext, {
    result: "fail",
    artifacts: { phase: "integration", failureKind: "ai_semantic_fail" },
  });
  gate.updateGateRetryCounter(retryContext, {
    result: "fail",
    artifacts: { phase: "integration", failureKind: "tooling_provider_failure" },
  });
  assert.deepEqual(metrics, [
    { phase: "integration", counter: "gateRetry", delta: 1 },
  ]);

  const passRoute = deriveNextAction({
    scope: "flow",
    stepId: "impl-gate",
    context: inferredIntegrationState(),
  });
  assert.equal(passRoute.action, "run-gate");
  assert.deepEqual(passRoute.sideEffects, [
    "completeTask",
    "promoteNextTask",
    "mergeOverview",
  ]);

  assert.equal(FLOW_COMMANDS.run.gate.args.options.includes("--phase"), true);
  assert.equal(FLOW_COMMANDS.run.gate.args.options.includes("--agent-work-dir"), true);
});

test("R6: dispatcher executes pre/post for judgments and pre/onError for pre-commit failures", async () => {
  for (const semanticResult of ["pass", "fail"]) {
    const fixture = persistedGateFixture(`gate-dispatch-${semanticResult}-`);
    try {
      const callbackEvents = [];
      const commandAttempts = [];
      const envelope = await dispatchGateAttempt({
        fixture,
        boundary: null,
        attempt: 2,
        semanticResult,
        callbackEvents,
        commandAttempts,
      });

      assert.equal(envelope.ok, true, semanticResult);
      assert.deepEqual(commandAttempts, [2], semanticResult);
      assert.deepEqual(callbackEvents, ["pre", "post"], semanticResult);
      assert.equal(
        fixture.manager.load().steps.find((step) => step.id === "impl-gate").status,
        semanticResult === "pass" ? "done" : "in_progress",
        `${semanticResult} routing`,
      );
    } finally {
      removeTmpDir(fixture.root);
    }
  }

  for (const boundary of ["validation", "agent", "output-protocol", "artifact-write"]) {
    const fixture = persistedGateFixture(`gate-dispatch-error-${boundary}-`);
    try {
      const callbackEvents = [];
      const commandAttempts = [];
      const envelope = await dispatchGateAttempt({
        fixture,
        boundary,
        attempt: 1,
        callbackEvents,
        commandAttempts,
      });

      assert.equal(envelope.ok, false, boundary);
      assert.deepEqual(commandAttempts, [1], boundary);
      assert.deepEqual(callbackEvents, ["pre", "onError"], boundary);
    } finally {
      removeTmpDir(fixture.root);
    }
  }
});
