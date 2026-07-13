import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRowsFromMetrics } from "../../../src/metrics/commands/token.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager, setupFlow, setStepDone } from "../../../tests/helpers/flow-setup.js";
import { findStepById, flattenSteps } from "../../../src/flow/definition.js";

describe("R1: resolveCurrentContext returns sddPhase from nested steps", () => {
  let tmp;
  it("returns the in_progress leaf step id as sddPhase", () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp);
    setStepDone(state, "branch", "prepare-spec");
    const step = findStepById(state.steps, "draft");
    step.status = "in_progress";
    const fm = makeFlowManager(tmp);
    fm.create(state);

    const ctx = fm.resolveCurrentContext();
    assert.equal(ctx.sddPhase, "draft");
  });

  it("returns null sddPhase when no step is in_progress", () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp);
    for (const s of flattenSteps(state.steps)) {
      s.status = "done";
    }
    const fm = makeFlowManager(tmp);
    fm.create(state);

    const ctx = fm.resolveCurrentContext();
    assert.equal(ctx.sddPhase, null);
  });

  it("returns the correct leaf when a deeper nested step is in_progress", () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp);
    for (const s of flattenSteps(state.steps)) {
      s.status = "done";
    }
    const step = findStepById(state.steps, "finalize-commit");
    step.status = "in_progress";
    const fm = makeFlowManager(tmp);
    fm.create(state);

    const ctx = fm.resolveCurrentContext();
    assert.equal(ctx.sddPhase, "finalize-commit");
  });
});

describe("R2: normalizeMetrics skips counter-only entries", () => {
  it("does not produce rows from counter-only metrics array", () => {
    const counterOnlyMetrics = [
      { phase: "draft", counter: "srcRead", delta: 1 },
      { phase: "draft", counter: "docsRead", delta: 1 },
      { phase: "spec", counter: "gateRetry", delta: 1 },
    ];
    const rows = buildRowsFromMetrics("2026-04-28", counterOnlyMetrics);
    assert.equal(rows.length, 0, `expected 0 rows from counter-only metrics, got ${rows.length}`);
  });

  it("produces rows from agent entries in array metrics", () => {
    const agentMetrics = [
      {
        phase: "draft",
        kind: "agent",
        callCount: 1,
        tokens: { input: 100, output: 50, cacheRead: 10, cacheCreation: 5 },
        cost: 0.001,
        durationMs: 5000,
      },
    ];
    const rows = buildRowsFromMetrics("2026-04-28", agentMetrics);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].phase, "draft");
    assert.equal(rows[0].tokenInput, 100);
    assert.equal(rows[0].cost, 0.001);
  });

  it("produces correct rows when agent and counter entries are mixed", () => {
    const mixedMetrics = [
      { phase: "draft", counter: "srcRead", delta: 1 },
      {
        phase: "draft",
        kind: "agent",
        callCount: 2,
        tokens: { input: 200, output: 100, cacheRead: 20, cacheCreation: 10 },
        cost: 0.002,
        durationMs: 8000,
      },
      { phase: "spec", counter: "gateRetry", delta: 1 },
    ];
    const rows = buildRowsFromMetrics("2026-04-28", mixedMetrics);
    assert.equal(rows.length, 1, "only agent-containing phases should produce rows");
    assert.equal(rows[0].phase, "draft");
    assert.equal(rows[0].tokenInput, 200);
  });

  it("still works with object-format metrics (non-array)", () => {
    const objectMetrics = {
      draft: {
        tokens: { input: 100, output: 50, cacheRead: 0, cacheCreation: 0 },
        cost: 0.001,
        callCount: 1,
      },
    };
    const rows = buildRowsFromMetrics("2026-04-28", objectMetrics);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].phase, "draft");
  });
});
