import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlowConfig } from "../../helpers/flow-setup.js";
import {
  resolveGateStepId,
  resolveGatePhaseFromState,
  STEP_TO_PHASE,
} from "../../../src/flow/lib/gate-step.js";
import { VALID_GATE_PHASES } from "../../../src/lib/constants.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { SetStepStatus } from "../../../src/flow/definition.js";
import { DefinitionLifecycleTransition } from "../../../src/flow/lib/step-transition-policy.js";

// -----------------------------------------------------------------------------
// AC6 (R5): resolveGateStepId / STEP_TO_PHASE round-trip consistency
// -----------------------------------------------------------------------------

describe("gate-step.js: step <-> phase round-trip (AC6/R5)", () => {
  it("exports STEP_TO_PHASE mapping covering every VALID_GATE_PHASES value", () => {
    assert.ok(STEP_TO_PHASE && typeof STEP_TO_PHASE === "object");
    const phases = Object.values(STEP_TO_PHASE);
    for (const phase of phases) {
      assert.ok(
        VALID_GATE_PHASES.includes(phase),
        `STEP_TO_PHASE produced unknown phase: ${phase}`,
      );
    }
  });

  it("resolveGateStepId -> STEP_TO_PHASE round-trips for flow-level gate steps", () => {
    // For each known phase, compute the step id, then look up the phase back.
    // The forward function maps integration to impl-gate and task-impl to task-gate;
    // this round-trip only asserts the flow-level gate steps (spec-gate / draft-gate / impl-gate).
    for (const phase of VALID_GATE_PHASES) {
      const stepId = resolveGateStepId(phase);
      const back = STEP_TO_PHASE[stepId];
      // back must be a valid phase and stepId(back) must land on the same step.
      if (stepId === "spec-gate" || stepId === "draft-gate" || stepId === "impl-gate") {
        assert.ok(
          VALID_GATE_PHASES.includes(back),
          `inverse produced non-phase value for ${stepId}: ${back}`,
        );
        assert.equal(
          resolveGateStepId(back),
          stepId,
          `inverse is not consistent with forward for ${phase} -> ${stepId} -> ${back}`,
        );
      }
    }
  });
});

// -----------------------------------------------------------------------------
// AC1 (R1): single in_progress at flow level resolves to expected phase
// -----------------------------------------------------------------------------

describe("resolveGatePhaseFromState: single in_progress (AC1/R1)", () => {
  it("resolves flow-level impl-gate in_progress to integration", () => {
    const state = {
      steps: [
        { id: "branch", status: "done" },
        { id: "prepare-spec", status: "done" },
        { id: "draft", status: "done" },
        { id: "draft-gate", status: "done" },
        { id: "spec", status: "done" },
        { id: "spec-gate", status: "done" },
        { id: "approval", status: "done" },
        { id: "test", status: "done" },
        { id: "implement", status: "done" },
        { id: "impl-gate", status: "in_progress" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const result = resolveGatePhaseFromState(state);
    assert.ok(result, "expected non-null result");
    assert.equal(result.phase, "integration");
    assert.deepEqual(result.staleSteps, []);
  });

  it("resolves draft-gate in_progress to draft", () => {
    const state = {
      steps: [
        { id: "draft", status: "done" },
        { id: "draft-gate", status: "in_progress" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const result = resolveGatePhaseFromState(state);
    assert.ok(result);
    assert.equal(result.phase, "draft");
    assert.deepEqual(result.staleSteps, []);
  });

  it("resolves flow-level gate in_progress to spec", () => {
    const state = {
      steps: [
        { id: "spec", status: "done" },
        { id: "spec-gate", status: "in_progress" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const result = resolveGatePhaseFromState(state);
    assert.ok(result);
    assert.equal(result.phase, "spec");
    assert.deepEqual(result.staleSteps, []);
  });
});

// -----------------------------------------------------------------------------
// AC2 (R2): zero in_progress -> null (caller must reject with error)
// -----------------------------------------------------------------------------

describe("resolveGatePhaseFromState: zero in_progress (AC2/R2)", () => {
  it("returns null when no gate-type step is in_progress", () => {
    const state = {
      steps: [
        { id: "branch", status: "done" },
        { id: "draft-gate", status: "done" },
        { id: "spec-gate", status: "pending" },
        { id: "impl-gate", status: "pending" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const result = resolveGatePhaseFromState(state);
    assert.equal(result, null);
  });
});

// -----------------------------------------------------------------------------
// AC3 (R3): multiple flow-level in_progress -> latest wins, others stale
// -----------------------------------------------------------------------------

describe("resolveGatePhaseFromState: multiple flow-level in_progress (AC3/R3)", () => {
  it("prefers the later step in FLOW_STEPS order and marks earlier ones stale", () => {
    const state = {
      steps: [
        { id: "draft-gate", status: "done" },
        { id: "spec", status: "done" },
        { id: "spec-gate", status: "in_progress" },
        { id: "implement", status: "done" },
        { id: "impl-gate", status: "in_progress" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const result = resolveGatePhaseFromState(state);
    assert.ok(result);
    assert.equal(result.phase, "integration");
    assert.deepEqual(result.staleSteps, ["spec-gate"]);
  });

  it("handles three simultaneously-in_progress gate steps (latest wins, others stale)", () => {
    const state = {
      steps: [
        { id: "draft-gate", status: "in_progress" },
        { id: "spec-gate", status: "in_progress" },
        { id: "impl-gate", status: "in_progress" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const result = resolveGatePhaseFromState(state);
    assert.ok(result);
    assert.equal(result.phase, "integration");
    // stale order should reflect the scan order we choose to expose; the set
    // matters. The flow-level spec only requires that staleSteps contains the
    // non-chosen in_progress gate steps.
    assert.deepEqual(new Set(result.staleSteps), new Set(["draft-gate", "spec-gate"]));
  });
});

// -----------------------------------------------------------------------------
// AC4 (R3, task-level): task-level gate in_progress wins over flow-level
// -----------------------------------------------------------------------------

describe("resolveGatePhaseFromState: task-level takes precedence (AC4/R3)", () => {
  it("picks task-impl when active task's task-gate step is in_progress", () => {
    const state = {
      steps: [
        { id: "impl-gate", status: "pending" },
      ],
      tasks: [
        {
          id: "T1",
          status: "in_progress",
          steps: [
            { id: "task-impl", status: "done" },
            { id: "task-review", status: "done" },
            { id: "task-gate", status: "in_progress" },
          ],
        },
      ],
      currentTaskId: "T1",
    };
    const result = resolveGatePhaseFromState(state);
    assert.ok(result, "expected non-null result");
    assert.equal(result.phase, "task-impl");
    assert.deepEqual(result.staleSteps, []);
  });

  it("picks task-spec when active task's gate step is in_progress, even if flow-level gate is too", () => {
    const state = {
      steps: [
        { id: "spec-gate", status: "in_progress" },
        { id: "impl-gate", status: "done" },
      ],
      tasks: [
        {
          id: "T1",
          status: "in_progress",
          steps: [
            { id: "spec-gate", status: "in_progress" },
            { id: "approval", status: "pending" },
          ],
        },
      ],
      currentTaskId: "T1",
    };
    const result = resolveGatePhaseFromState(state);
    assert.ok(result);
    assert.equal(result.phase, "task-spec");
    // The flow-level gate step is considered stale in this situation.
    assert.ok(result.staleSteps.includes("spec-gate"), `expected staleSteps to include flow-level 'gate', got ${JSON.stringify(result.staleSteps)}`);
  });

  it("passes explicit task scope to the task-gate lifecycle mutation", async () => {
    const updates = [];
    const storedState = {
      currentTaskId: "T1",
      steps: [{ id: "impl-gate", status: "pending" }],
      tasks: [{
        id: "T1",
        steps: [
          { id: "task-impl", status: "done" },
          { id: "task-review", status: "done" },
          { id: "task-gate", status: "pending" },
        ],
      }],
    };
    const flowState = structuredClone(storedState);
    flowState.tasks[0].steps[2].status = "in_progress";

    assert.equal(
      FLOW_COMMANDS.run.gate.runtimeLog.stepId({ phase: "task-impl", flowState }),
      "task-gate",
    );

    await FLOW_COMMANDS.run.gate.pre({
      phase: "task-impl",
      flowState,
      flowManager: {
        load: () => storedState,
        updateStepStatus(transition, opts) { updates.push({ transition, opts }); },
      },
    });

    assert.equal(updates.length, 1);
    const [{ transition, opts }] = updates;
    assert.ok(transition instanceof DefinitionLifecycleTransition);
    assert.ok(transition.action instanceof SetStepStatus);
    assert.equal(transition.stepId, "task-gate");
    assert.equal(transition.action.step, "task-gate");
    assert.equal(transition.currentStepId, "task-gate");
    assert.equal(transition.requestedStatus, "in_progress");
    assert.deepEqual(opts, { taskId: "T1" });
  });

  it("keeps the flow-level integration gate lifecycle identity at impl-gate", async () => {
    const updates = [];
    const flowState = {
      currentTaskId: null,
      steps: [{ id: "impl-gate", status: "pending" }],
      tasks: [],
    };

    await FLOW_COMMANDS.run.gate.pre({
      phase: "integration",
      flowState,
      flowManager: {
        load: () => flowState,
        updateStepStatus(transition, opts) { updates.push({ transition, opts }); },
      },
    });

    assert.equal(updates.length, 1);
    const [{ transition, opts }] = updates;
    assert.ok(transition instanceof DefinitionLifecycleTransition);
    assert.equal(transition.stepId, "impl-gate");
    assert.equal(transition.action.step, "impl-gate");
    assert.equal(transition.currentStepId, "impl-gate");
    assert.deepEqual(opts, { taskId: null });
  });

  it("allows explicit terminal gate revalidation without reopening lifecycle state", async () => {
    const updates = [];
    const flowState = {
      currentTaskId: null,
      steps: [
        { id: "impl-gate", status: "done" },
        { id: "retro", status: "done" },
        { id: "acceptance-review", status: "in_progress" },
      ],
      tasks: [],
    };
    const ctx = {
      phase: "integration",
      flowState,
      flowManager: {
        load: () => flowState,
        updateStepStatus(transition, opts) { updates.push({ transition, opts }); },
      },
    };

    await FLOW_COMMANDS.run.gate.pre(ctx);
    await FLOW_COMMANDS.run.gate.post(ctx, {
      result: "pass",
      artifacts: { phase: "integration", evaluations: [] },
    });

    assert.equal(ctx.terminalGateRevalidation, true);
    assert.deepEqual(updates, []);
    assert.equal(flowState.steps[2].status, "in_progress");
  });

  it("skips the normal gate post-hook after stale evidence recovery", async () => {
    let loaded = false;
    await FLOW_COMMANDS.run.gate.post({
      terminalGateRevalidation: false,
      flowManager: {
        load() {
          loaded = true;
          throw new Error("normal gate lifecycle must not run");
        },
      },
    }, {
      result: "recovered",
      artifacts: {
        evidenceRefresh: { recovered: true },
      },
    });
    assert.equal(loaded, false);
  });
});

// -----------------------------------------------------------------------------
// AC2 / AC3 via in-process execution of RunGateCommand (R2, R3)
// No external processes — we exercise RunGateCommand.execute directly.
// -----------------------------------------------------------------------------

describe("RunGateCommand.execute (in-process, AC2/AC3)", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("AC2: returns ok:false envelope with --phase enum listed when no gate-type step is in_progress", async () => {
    tmp = createTmpDir();
    setupFlowConfig(tmp, "ja");
    const state = {
      spec: "specs/001-test/spec.json",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: [
        { id: "branch", status: "done" },
        { id: "draft-gate", status: "done" },
        { id: "spec-gate", status: "pending" },
        { id: "impl-gate", status: "pending" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const { default: RunGateCommand } = await import("../../../src/flow/lib/run-gate.js");
    const cmd = new RunGateCommand();
    const result = await cmd.execute({ flowState: state, phase: undefined, root: tmp, config: {} });
    // RunGateCommand returns an Envelope on precondition failure.
    assert.ok(result && typeof result.toJSON === "function", `expected Envelope, got: ${result}`);
    const json = result.toJSON();
    assert.equal(json.ok, false);
    const errorMsg = JSON.stringify(json.errors || []);
    for (const phase of ["draft", "spec", "task-spec", "task-impl", "integration"]) {
      assert.ok(errorMsg.includes(phase), `error message must list phase "${phase}", got: ${errorMsg}`);
    }
    // Verify the error code matches the precondition contract.
    assert.ok(json.errors?.[0]?.code === "NO_GATE_STEP_IN_PROGRESS", `unexpected code: ${errorMsg}`);
  });

  it("AC3: transitions stale flow-level gate step to done and emits stderr warning when resolving integration from spec-gate+impl-gate both in_progress", async () => {
    // In-process test: drive RunGateCommand.execute directly with a mock
    // flow state and a stub flowManager. This verifies the stale-step
    // recovery side effect without spawning external processes.
    tmp = createTmpDir();
    setupFlowConfig(tmp, "ja");

    const state = {
      spec: "specs/001-test/spec.json",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: [
        { id: "branch", status: "done" },
        { id: "prepare-spec", status: "done" },
        { id: "draft", status: "done" },
        { id: "draft-gate", status: "done" },
        { id: "spec", status: "done" },
        { id: "spec-gate", status: "in_progress" },
        { id: "approval", status: "done" },
        { id: "test", status: "done" },
        { id: "implement", status: "done" },
        { id: "impl-gate", status: "in_progress" },
      ],
      tasks: [],
      currentTaskId: null,
      // spec 222: satisfy the head-evidence guard so the downstream path runs
      // (and the expected throw from missing git/config fires as originally
      // intended).
      test: { summary: { exitCode: 0 } },
    };
    const transitions = [];
    const stubFlowManager = {
      load: () => state,
      updateStepStatus(transition) {
        assert.ok(transition instanceof DefinitionLifecycleTransition);
        transitions.push(transition);
        const step = state.steps.find((candidate) => candidate.id === transition.stepId);
        if (step) step.status = transition.requestedStatus;
      },
    };

    // Replace container.get("flowManager") for this invocation. Use dynamic
    // import + module-level container ref.
    const containerMod = await import("../../../src/lib/container.js");
    const originalGet = containerMod.container.get.bind(containerMod.container);
    containerMod.container.get = (key) => (key === "flowManager" ? stubFlowManager : originalGet(key));

    const errs = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk) => {
      errs.push(String(chunk));
      return true;
    };

    try {
      const { default: RunGateCommand } = await import("../../../src/flow/lib/run-gate.js");
      const cmd = new RunGateCommand();
      // Minimal ctx: execute uses ctx.phase, ctx.flowState. Other fields
      // (ctx.config, ctx.root) are not reached before the stale-step update.
      const ctx = { flowState: state, phase: undefined, root: tmp, config: {} };
      // The recovery side effects (stale-step transition, stderr warning)
      // fire before execute() proceeds into the actual gate evaluation. The
      // downstream path may either (a) throw because git/config are missing
      // or (b) return a gateFail envelope when the integration precheck
      // (spec 251 R17) detects the missing test artifacts. Either outcome
      // exercises the same recovery path; record both.
      let downstreamError = null;
      let downstreamResult = null;
      try {
        downstreamResult = await cmd.execute(ctx);
      } catch (err) {
        downstreamError = err;
      }
      assert.ok(
        downstreamError !== null || downstreamResult !== null,
        "downstream gate evaluation must produce an outcome (throw or gateFail); got neither",
      );
    } finally {
      containerMod.container.get = originalGet;
      process.stderr.write = originalWrite;
    }

    const doneTransition = transitions.find((transition) => (
      transition.stepId === "spec-gate" && transition.requestedStatus === "done"
    ));
    assert.ok(doneTransition, `expected stale 'gate' step to be transitioned to done. transitions=${JSON.stringify(transitions)}`);

    const stderrText = errs.join("");
    assert.match(
      stderrText,
      /gate: stale in_progress step "spec-gate"/,
      `expected stderr to warn about stale step, got: ${stderrText}`,
    );
  });
});
