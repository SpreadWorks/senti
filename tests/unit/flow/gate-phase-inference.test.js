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
    // The forward function maps task-impl / integration both to gate-impl, so we
    // only assert that the inverse maps back into that same equivalence class.
    for (const phase of VALID_GATE_PHASES) {
      const stepId = resolveGateStepId(phase);
      const back = STEP_TO_PHASE[stepId];
      // back must be a valid phase and stepId(back) must land on the same step.
      if (stepId === "gate" || stepId === "gate-draft" || stepId === "gate-impl") {
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
  it("resolves gate-impl in_progress to task-impl", () => {
    const state = {
      steps: [
        { id: "branch", status: "done" },
        { id: "prepare-spec", status: "done" },
        { id: "draft", status: "done" },
        { id: "gate-draft", status: "done" },
        { id: "spec", status: "done" },
        { id: "gate", status: "done" },
        { id: "approval", status: "done" },
        { id: "test", status: "done" },
        { id: "implement", status: "done" },
        { id: "gate-impl", status: "in_progress" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const result = resolveGatePhaseFromState(state);
    assert.ok(result, "expected non-null result");
    assert.equal(result.phase, "task-impl");
    assert.deepEqual(result.staleSteps, []);
  });

  it("resolves gate-draft in_progress to draft", () => {
    const state = {
      steps: [
        { id: "draft", status: "done" },
        { id: "gate-draft", status: "in_progress" },
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
        { id: "gate", status: "in_progress" },
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
        { id: "gate-draft", status: "done" },
        { id: "gate", status: "pending" },
        { id: "gate-impl", status: "pending" },
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
        { id: "gate-draft", status: "done" },
        { id: "spec", status: "done" },
        { id: "gate", status: "in_progress" },
        { id: "implement", status: "done" },
        { id: "gate-impl", status: "in_progress" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const result = resolveGatePhaseFromState(state);
    assert.ok(result);
    assert.equal(result.phase, "task-impl");
    assert.deepEqual(result.staleSteps, ["gate"]);
  });

  it("handles three simultaneously-in_progress gate steps (latest wins, others stale)", () => {
    const state = {
      steps: [
        { id: "gate-draft", status: "in_progress" },
        { id: "gate", status: "in_progress" },
        { id: "gate-impl", status: "in_progress" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const result = resolveGatePhaseFromState(state);
    assert.ok(result);
    assert.equal(result.phase, "task-impl");
    // stale order should reflect the scan order we choose to expose; the set
    // matters. The flow-level spec only requires that staleSteps contains the
    // non-chosen in_progress gate steps.
    assert.deepEqual(new Set(result.staleSteps), new Set(["gate-draft", "gate"]));
  });
});

// -----------------------------------------------------------------------------
// AC4 (R3, task-level): task-level gate in_progress wins over flow-level
// -----------------------------------------------------------------------------

describe("resolveGatePhaseFromState: task-level takes precedence (AC4/R3)", () => {
  it("picks task-spec when active task's gate step is in_progress, even if flow-level gate is too", () => {
    const state = {
      steps: [
        { id: "gate", status: "in_progress" },
        { id: "gate-impl", status: "done" },
      ],
      tasks: [
        {
          id: "T1",
          status: "in_progress",
          steps: [
            { id: "gate", status: "in_progress" },
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
    assert.ok(result.staleSteps.includes("gate"), `expected staleSteps to include flow-level 'gate', got ${JSON.stringify(result.staleSteps)}`);
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
        { id: "gate-draft", status: "done" },
        { id: "gate", status: "pending" },
        { id: "gate-impl", status: "pending" },
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

  it("AC3: transitions stale flow-level gate step to done and emits stderr warning when resolving task-impl from gate+gate-impl both in_progress", async () => {
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
        { id: "gate-draft", status: "done" },
        { id: "spec", status: "done" },
        { id: "gate", status: "in_progress" },
        { id: "approval", status: "done" },
        { id: "test", status: "done" },
        { id: "implement", status: "done" },
        { id: "gate-impl", status: "in_progress" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const transitions = [];
    const stubFlowManager = {
      load: () => state,
      updateStepStatus(stepId, status) {
        transitions.push({ stepId, status });
        const step = state.steps.find((s) => s.id === stepId);
        if (step) step.status = status;
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
      // fire before execute() proceeds into the actual gate evaluation,
      // which needs git/config we intentionally did not set up. We therefore
      // expect an error from the downstream gate path; record it so nothing
      // is silently discarded, and assert the recovery happened regardless.
      let downstreamError = null;
      try {
        await cmd.execute(ctx);
      } catch (err) {
        downstreamError = err;
      }
      assert.ok(
        downstreamError !== null,
        "downstream gate evaluation is expected to throw in this harness (no git/config); if it starts succeeding, update the assertion",
      );
    } finally {
      containerMod.container.get = originalGet;
      process.stderr.write = originalWrite;
    }

    const doneTransition = transitions.find((t) => t.stepId === "gate" && t.status === "done");
    assert.ok(doneTransition, `expected stale 'gate' step to be transitioned to done. transitions=${JSON.stringify(transitions)}`);

    const stderrText = errs.join("");
    assert.match(
      stderrText,
      /gate: stale in_progress step "gate"/,
      `expected stderr to warn about stale step, got: ${stderrText}`,
    );
  });
});
