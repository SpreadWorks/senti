import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseProposalReviewOutput,
  parseSpecReviewOutput,
  runCmdWithRetry,
  updateReviewRetryCounter,
} from "../../../src/flow/lib/run-review.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

describe("draft review advisory verdict", () => {
  it("parses ADVISORY as a non-blocking draft review result", () => {
    const result = parseProposalReviewOutput(
      { ok: true },
      "Draft review ADVISORY. 2 finding(s) recorded; proceeding.",
      "  [draft-review-coverage] Results saved to specs/demo/draft-review-coverage.md\n  [draft-review-coverage] verdict=ADVISORY findings=2 retryPhase=draft-coverage",
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "gate-draft");
    assert.deepEqual(result.changed, ["specs/demo/draft-review-coverage.md"]);
    assert.deepEqual(result.artifacts, {
      phase: "draft",
      verdict: "ADVISORY",
      issueCount: 2,
      retryPhase: "draft-coverage",
    });
  });

  it("resets the draft review retry counter for ADVISORY", () => {
    const metrics = [];
    updateReviewRetryCounter(
      {
        phase: "draft",
        flowState: {},
        flowManager: {
          appendMetric(payload, opts) {
            metrics.push({ payload, opts });
          },
        },
      },
      {
        artifacts: {
          verdict: "ADVISORY",
          retryPhase: "draft-coverage",
        },
      },
    );

    assert.deepEqual(metrics, [
      {
        payload: {
          phase: "draft-coverage",
          counter: "reviewRetry",
          delta: 0,
          reset: true,
        },
        opts: { taskId: null },
      },
    ]);
  });
});

describe("spec review advisory verdict", () => {
  it("parses ADVISORY as a non-blocking spec review result", () => {
    const result = parseSpecReviewOutput(
      { ok: true },
      "Spec review ADVISORY. 2 non-blocking improvement(s) recorded. See spec-review.md.",
      "  [spec-review] Results saved to specs/demo/spec-review.md\n  [spec-review] blockingCount=0 improvementCount=2 proposalCount=2\n  [spec-review] verdict=ADVISORY proposalCount=2",
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "gate");
    assert.deepEqual(result.changed, ["specs/demo/spec-review.md"]);
    assert.deepEqual(result.artifacts, {
      phase: "spec",
      verdict: "ADVISORY",
      proposalCount: 2,
    });
  });

  it("routes FAIL to spec-review-triage instead of a prompt-owned review loop", () => {
    const result = parseSpecReviewOutput(
      { ok: true },
      "Spec review FAIL. 1 blocking finding(s) found. See spec-review.md.",
      "  [spec-review] Results saved to specs/demo/spec-review.md\n  [spec-review] blockingCount=1 improvementCount=0 proposalCount=1\n  [spec-review] verdict=FAIL proposalCount=1",
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "spec-review-triage");
    assert.deepEqual(result.artifacts, {
      phase: "spec",
      verdict: "FAIL",
      proposalCount: 1,
    });
  });

  it("post-hook advances FAIL to spec-review-triage by completing review-spec only", async () => {
    const updates = [];
    const metrics = [];
    await FLOW_COMMANDS.run.review.post({
      phase: "spec",
      flowState: {},
      flowManager: {
        appendMetric(payload, opts) { metrics.push({ payload, opts }); },
        updateStepStatus(stepId, status) { updates.push({ stepId, status }); },
      },
    }, {
      artifacts: { phase: "spec", verdict: "FAIL", proposalCount: 1 },
    });

    assert.deepEqual(updates, [{ stepId: "review-spec", status: "done" }]);
    assert.deepEqual(metrics, [{
      payload: { phase: "spec", counter: "reviewRetry", delta: 1 },
      opts: { taskId: null },
    }]);
  });

  it("post-hook skips spec-repair for non-blocking spec review results", async () => {
    const updates = [];
    await FLOW_COMMANDS.run.review.post({
      phase: "spec",
      flowState: {},
      flowManager: {
        appendMetric() {},
        updateStepStatus(stepId, status) { updates.push({ stepId, status }); },
      },
    }, {
      artifacts: { phase: "spec", verdict: "ADVISORY", proposalCount: 1 },
    });

    assert.deepEqual(updates, [
      { stepId: "review-spec", status: "done" },
      { stepId: "spec-review-triage", status: "done" },
      { stepId: "spec-repair", status: "done" },
    ]);
  });
});

describe("review subprocess retry", () => {
  it("does not retry deterministic review-test prompt size failures", async () => {
    let calls = 0;
    const result = await runCmdWithRetry(() => {
      calls++;
      return {
        ok: false,
        status: 1,
        stdout: "",
        stderr: "TEST_REVIEW_PROMPT_TOO_LARGE: gap analysis prompt is too large",
        signal: null,
        killed: false,
      };
    }, { retryCount: 2, retryDelayMs: 0 });

    assert.equal(calls, 1);
    assert.equal(result.status, 1);
  });
});
