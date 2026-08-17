// spec: R1 R3 R5 R6 R7 R8 R15 R19 R25

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("R1: VALID_METRIC_COUNTERS includes reviewRetry", () => {
  it("R1: exports reviewRetry as a valid counter name", async () => {
    const mod = await import("../../../src/lib/constants.js");
    assert.ok(
      mod.VALID_METRIC_COUNTERS.includes("reviewRetry"),
      "VALID_METRIC_COUNTERS must include 'reviewRetry'",
    );
  });
});

describe("R7: resolveReviewRetryMax derives max from FLOW_DEFINITION", () => {
  it("R7: review-draft returns 1 in autoApprove mode and 5 in manual mode", async () => {
    const { resolveReviewRetryMax } = await import("../../../src/flow/lib/run-review.js");
    const autoMax = resolveReviewRetryMax({ flowState: { autoApprove: true } }, "draft");
    const manualMax = resolveReviewRetryMax({ flowState: { autoApprove: false } }, "draft");
    assert.equal(autoMax, 1, "review-draft auto max should be 1");
    assert.equal(manualMax, 5, "review-draft manual max should be 5");
  });

  it("R7: review-spec / review-test / impl return their FLOW_DEFINITION values", async () => {
    const { resolveReviewRetryMax } = await import("../../../src/flow/lib/run-review.js");
    assert.equal(resolveReviewRetryMax({ flowState: { autoApprove: true } }, "spec"), 3);
    assert.equal(resolveReviewRetryMax({ flowState: { autoApprove: true } }, "test"), 3);
    assert.equal(resolveReviewRetryMax({ flowState: { autoApprove: true } }, "impl"), 3);
  });
});

describe("R8: unknown phase fail-closed", () => {
  it("R8: checkReviewRetryBelowMax returns Envelope.fail UNKNOWN_REVIEW_PHASE for unknown phase", async () => {
    const { checkReviewRetryBelowMax } = await import("../../../src/flow/lib/run-review.js");
    const result = checkReviewRetryBelowMax({ flowState: { metrics: [], autoApprove: false } }, "bogus-phase");
    assert.equal(result?.ok, false);
    assert.equal(result.errors[0].code, "UNKNOWN_REVIEW_PHASE");
    assert.equal(result.data.phase, "bogus-phase");
  });
});

describe("R5: plan PASS resets, FAIL increments", () => {
  it("R5: plan verdict='PASS' (strict) appends a reset entry", async () => {
    const { updateReviewRetryCounter } = await import("../../../src/flow/lib/run-review.js");
    const calls = [];
    const ctx = {
      phase: "draft",
      flowState: { metrics: [], currentTaskId: null },
      flowManager: { appendMetric: (p, opts) => calls.push({ ...p, _opts: opts }) },
    };
    updateReviewRetryCounter(ctx, { result: "ok", artifacts: { phase: "draft", verdict: "PASS" } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].counter, "reviewRetry");
    assert.equal(calls[0].phase, "draft");
    assert.equal(calls[0].reset, true);
    assert.equal(calls[0]._opts?.taskId, null, "appendMetric opts must explicitly set taskId:null (R19)");
  });

  it("R5: plan verdict='FAIL' / undefined / unknown appends delta=1", async () => {
    const { updateReviewRetryCounter } = await import("../../../src/flow/lib/run-review.js");
    const verdicts = ["FAIL", undefined, "WEIRD"];
    for (const v of verdicts) {
      const calls = [];
      const ctx = {
        phase: "spec",
        flowState: { metrics: [], currentTaskId: null },
        flowManager: { appendMetric: (p, opts) => calls.push({ ...p, _opts: opts }) },
      };
      updateReviewRetryCounter(ctx, { result: "ok", artifacts: { phase: "spec", verdict: v } });
      assert.equal(calls.length, 1, `verdict=${v} should still record an entry`);
      assert.equal(calls[0].delta, 1, `verdict=${v} should be FAIL`);
      assert.equal(calls[0].reset, undefined, `verdict=${v} should not be a reset`);
    }
  });
});

describe("R6: impl PASS conditions", () => {
  it("R6: impl result='no-changes' / 'no-proposals' / proposalCount===0 → reset", async () => {
    const { updateReviewRetryCounter } = await import("../../../src/flow/lib/run-review.js");
    const passCases = [
      { result: "no-changes", artifacts: { proposalCount: 5 } },
      { result: "no-proposals", artifacts: { proposalCount: 0 } },
      { result: "ok", artifacts: { proposalCount: 0 } },
    ];
    for (const r of passCases) {
      const calls = [];
      const ctx = {
        phase: null,
        flowState: { metrics: [], currentTaskId: null },
        flowManager: { appendMetric: (p, opts) => calls.push({ ...p, _opts: opts }) },
      };
      updateReviewRetryCounter(ctx, r);
      assert.equal(calls.length, 1, `${JSON.stringify(r)} should append`);
      assert.equal(calls[0].reset, true, `${JSON.stringify(r)} should reset`);
      assert.equal(calls[0].phase, "impl", "impl phase key");
    }
  });

  it("R6: impl result='ok' && proposalCount>0 / unknown result → delta=1 (fail-closed)", async () => {
    const { updateReviewRetryCounter } = await import("../../../src/flow/lib/run-review.js");
    const failCases = [
      { result: "ok", artifacts: { proposalCount: 3 } },
      { result: "weird", artifacts: { proposalCount: 5 } },
    ];
    for (const r of failCases) {
      const calls = [];
      const ctx = {
        phase: null,
        flowState: { metrics: [], currentTaskId: null },
        flowManager: { appendMetric: (p, opts) => calls.push({ ...p, _opts: opts }) },
      };
      updateReviewRetryCounter(ctx, r);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].delta, 1, `${JSON.stringify(r)} should be FAIL`);
    }
  });
});

describe("R15: task scope isolation (currentTaskId non-null)", () => {
  it("R15: checkReviewRetryBelowMax returns null when currentTaskId is non-null", async () => {
    const { checkReviewRetryBelowMax } = await import("../../../src/flow/lib/run-review.js");
    const ctx = { flowState: { metrics: [], currentTaskId: "T-1", autoApprove: false } };
    const result = checkReviewRetryBelowMax(ctx, "draft");
    assert.equal(result, null, "task scope should not short-circuit (R15)");
  });

  it("R15: updateReviewRetryCounter is no-op when currentTaskId is non-null", async () => {
    const { updateReviewRetryCounter } = await import("../../../src/flow/lib/run-review.js");
    const calls = [];
    const ctx = {
      phase: "draft",
      flowState: { metrics: [], currentTaskId: "T-1" },
      flowManager: { appendMetric: (p, opts) => calls.push({ ...p, _opts: opts }) },
    };
    updateReviewRetryCounter(ctx, { result: "ok", artifacts: { phase: "draft", verdict: "FAIL" } });
    assert.equal(calls.length, 0, "task scope should not append metrics (R15)");
  });
});

describe("R19: countReviewRetry ignores taskId != null entries", () => {
  it("R19: only flow-scope (taskId == null) entries are counted", async () => {
    const { countReviewRetry } = await import("../../../src/flow/lib/run-review.js");
    const metrics = [
      { phase: "draft", counter: "reviewRetry", delta: 1, taskId: null },
      { phase: "draft", counter: "reviewRetry", delta: 1, taskId: "T-1" },
      { phase: "draft", counter: "reviewRetry", delta: 1, taskId: null },
    ];
    assert.equal(countReviewRetry(metrics, "draft"), 2, "must ignore taskId='T-1' entry");
  });

  it("R19: PASS reset (taskId:null) zeroes flow-scope count", async () => {
    const { countReviewRetry } = await import("../../../src/flow/lib/run-review.js");
    const metrics = [
      { phase: "draft", counter: "reviewRetry", delta: 1, taskId: null },
      { phase: "draft", counter: "reviewRetry", delta: 1, taskId: null },
      { phase: "draft", counter: "reviewRetry", delta: 0, reset: true, taskId: null },
    ];
    assert.equal(countReviewRetry(metrics, "draft"), 0);
  });
});

describe("R3: phase-independent counters and short-circuit side-effect-zero", () => {
  it("R3: draft FAILs do not affect spec count (phase-independence)", async () => {
    const { countReviewRetry } = await import("../../../src/flow/lib/run-review.js");
    const metrics = [
      { phase: "draft", counter: "reviewRetry", delta: 1, taskId: null },
      { phase: "draft", counter: "reviewRetry", delta: 1, taskId: null },
      { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
    ];
    assert.equal(countReviewRetry(metrics, "draft"), 2);
    assert.equal(countReviewRetry(metrics, "spec"), 1);
    assert.equal(countReviewRetry(metrics, "test"), 0);
    assert.equal(countReviewRetry(metrics, "impl"), 0);
  });

  it("R3: short-circuit returns Envelope.fail with zero side effects (no appendMetric, no subprocess)", async () => {
    const { checkReviewRetryBelowMax } = await import("../../../src/flow/lib/run-review.js");
    const calls = [];
    const ctx = {
      flowState: {
        autoApprove: true,
        currentTaskId: null,
        metrics: [
          { phase: "draft", counter: "reviewRetry", delta: 1, taskId: null },
        ],
      },
      flowManager: { appendMetric: (p, opts) => calls.push({ p, opts }) },
    };
    // auto:1 → max=1, count=1, count >= max → short-circuit
    const result = checkReviewRetryBelowMax(ctx, "draft");
    assert.equal(result?.ok, false, "must short-circuit");
    assert.equal(result.errors[0].code, "REVIEW_MAX_ATTEMPTS_EXCEEDED");
    assert.equal(calls.length, 0, "short-circuit must NOT call appendMetric (R3 side-effect-zero)");
  });
});

describe("R25: attempt unit is CLI invocation", () => {
  it("R25: a single appendMetric per CLI invocation (no double-counting from internal review.js loops)", async () => {
    const { updateReviewRetryCounter } = await import("../../../src/flow/lib/run-review.js");
    const calls = [];
    const ctx = {
      phase: "draft",
      flowState: { metrics: [], currentTaskId: null },
      flowManager: { appendMetric: (p, opts) => calls.push({ ...p, _opts: opts }) },
    };
    updateReviewRetryCounter(ctx, { result: "ok", artifacts: { phase: "draft", verdict: "FAIL" } });
    assert.equal(calls.length, 1, "exactly one metric per execute() return");
  });
});
