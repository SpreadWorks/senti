import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseProposalReviewOutput,
  parseImplReviewOutput,
  parseSpecReviewOutput,
  parseTestReviewOutput,
  runCmdWithRetry,
  updateReviewRetryCounter,
} from "../../../src/flow/lib/run-review.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { ReviewFailure } from "../../../src/flow/lib/review-failure.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

describe("draft coverage review advisory routing", () => {
  it("parses ADVISORY as a non-blocking draft review result routed to coverage triage", () => {
    const coverageReviewName = "draft-review-coverage";
    const coverageArtifactPath = `specs/demo/${coverageReviewName}.json`;
    const result = parseProposalReviewOutput(
      { ok: true },
      "Draft review ADVISORY. 2 finding(s) recorded; proceeding.",
      `  [${coverageReviewName}] Results saved to ${coverageArtifactPath}\n  [${coverageReviewName}] verdict=ADVISORY findings=2 retryPhase=draft-coverage`,
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "draft-coverage-triage");
    assert.deepEqual(result.changed, [coverageArtifactPath]);
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
    assert.equal(result.next, "spec-gate");
    assert.deepEqual(result.changed, ["specs/demo/spec-review.md"]);
    assert.deepEqual(result.artifacts, {
      phase: "spec",
      verdict: "ADVISORY",
      proposalCount: 2,
    });
  });

  it("routes FAIL to spec-triage instead of a prompt-owned review loop", () => {
    const result = parseSpecReviewOutput(
      { ok: true },
      "Spec review FAIL. 1 blocking finding(s) found. See spec-review.md.",
      "  [spec-review] Results saved to specs/demo/spec-review.md\n  [spec-review] blockingCount=1 improvementCount=0 proposalCount=1\n  [spec-review] verdict=FAIL proposalCount=1",
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "spec-triage");
    assert.deepEqual(result.artifacts, {
      phase: "spec",
      verdict: "FAIL",
      proposalCount: 1,
    });
  });

  it("post-hook advances FAIL to spec-triage by completing spec-review only", async () => {
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

    assert.deepEqual(updates, [{ stepId: "spec-review", status: "done" }]);
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
      { stepId: "spec-review", status: "done" },
      { stepId: "spec-triage", status: "done" },
      { stepId: "spec-repair", status: "done" },
    ]);
  });
});

describe("test-review one-shot verdict routing", () => {
  it("parses ADVISORY as non-blocking and routes to implement", () => {
    const result = parseTestReviewOutput(
      { ok: true },
      "Test review ADVISORY. 2 non-blocking finding(s) recorded; implementation may proceed.",
      "  [test-review] Results saved to specs/demo/test-review.md\n  [test-review] verdict=ADVISORY blocking=0 advisory=2",
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "implement");
    assert.deepEqual(result.changed, ["specs/demo/test-review.md"]);
    assert.deepEqual(result.artifacts, {
      phase: "test",
      verdict: "ADVISORY",
      blockingCount: 0,
      advisoryCount: 2,
    });
  });

  it("parses TOOLING_FAILURE without routing to implementation", () => {
    const result = parseTestReviewOutput(
      { ok: true },
      "Test review TOOLING_FAILURE. Static review tooling failed; see test-review.json.",
      "  [test-review] Results saved to specs/demo/test-review.md\n  [test-review] verdict=TOOLING_FAILURE blocking=0 advisory=0 toolingFailure=parser_error",
    );

    assert.equal(result.result, "tooling-failure");
    assert.equal(result.next, null);
    assert.deepEqual(result.artifacts, {
      phase: "test",
      verdict: "TOOLING_FAILURE",
      blockingCount: 0,
      advisoryCount: 0,
      toolingFailure: "parser_error",
    });
  });

  it("post-hook completes test-review for ADVISORY and skips task/tooling retry metrics", async () => {
    const updates = [];
    const metrics = [];
    await FLOW_COMMANDS.run.review.post({
      phase: "test",
      flowState: {
        currentTaskId: "T-1",
        steps: [{ id: "test-review", status: "in_progress" }],
        tasks: [{
          id: "T-1",
          steps: [
            { id: "task-impl", status: "pending" },
            { id: "task-review", status: "pending" },
            { id: "task-gate", status: "pending" },
          ],
        }],
      },
      flowManager: {
        appendMetric(payload, opts) { metrics.push({ payload, opts }); },
        updateStepStatus(stepId, status, opts) { updates.push({ stepId, status, opts }); },
      },
    }, {
      artifacts: { phase: "test", verdict: "ADVISORY", blockingCount: 0, advisoryCount: 1 },
    });

    assert.deepEqual(updates, [{
      stepId: "test-review",
      status: "done",
      opts: { taskId: null },
    }]);
    assert.deepEqual(metrics, []);

    const tmp = createTmpDir();
    try {
      fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
      const toolingMetrics = [];
      await FLOW_COMMANDS.run.review.post({
        phase: "test",
        root: tmp,
        flowState: { spec: "specs/demo/spec.json" },
        flowManager: {
          appendMetric(payload, opts) { toolingMetrics.push({ payload, opts }); },
          updateStepStatus() { throw new Error("TOOLING_FAILURE must not complete test-review"); },
        },
      }, {
        changed: ["specs/demo/test-review.json"],
        artifacts: { phase: "test", verdict: "TOOLING_FAILURE", blockingCount: 0, advisoryCount: 0, toolingFailure: "parser_error" },
      });
      assert.deepEqual(toolingMetrics, []);
      const issueLog = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/issue-log.json"), "utf8"));
      assert.equal(issueLog.entries.length, 1);
      assert.equal(issueLog.entries[0].step, "test-review");
      assert.equal(issueLog.entries[0].failureKind, "tooling_failure");
    } finally {
      removeTmpDir(tmp);
    }
  });
});

describe("impl review structured verdict routing", () => {
  it("parses ADVISORY as non-blocking and routes to impl-gate", () => {
    const result = parseImplReviewOutput(
      { ok: true },
      "Impl review ADVISORY. 1 non-blocking improvement(s) recorded. See review.md.",
      "  [review] Results saved to specs/demo/review.md\n  [review] JSON saved to specs/demo/impl-review.json\n  [review] verdict=ADVISORY blocking=0 nonBlocking=1",
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "impl-gate");
    assert.deepEqual(result.changed, ["specs/demo/review.md", "specs/demo/impl-review.json"]);
    assert.deepEqual(result.artifacts, {
      phase: "impl",
      verdict: "ADVISORY",
      blockingCount: 0,
      nonBlockingCount: 1,
    });
  });

  it("resets reviewRetry for PASS and ADVISORY but increments for FAIL", () => {
    assert.deepEqual(metricsForImplVerdict("PASS"), [{
      payload: { phase: "impl", counter: "reviewRetry", delta: 0, reset: true },
      opts: { taskId: null },
    }]);
    assert.deepEqual(metricsForImplVerdict("ADVISORY"), [{
      payload: { phase: "impl", counter: "reviewRetry", delta: 0, reset: true },
      opts: { taskId: null },
    }]);
    assert.deepEqual(metricsForImplVerdict("FAIL"), [{
      payload: { phase: "impl", counter: "reviewRetry", delta: 1 },
      opts: { taskId: null },
    }]);
  });

  it("post-hook completes review only for PASS and ADVISORY", async () => {
    const passUpdates = [];
    await FLOW_COMMANDS.run.review.post({
      phase: null,
      flowState: {},
      flowManager: {
        appendMetric() {},
        updateStepStatus(stepId, status) { passUpdates.push({ stepId, status }); },
      },
    }, {
      artifacts: { phase: "impl", verdict: "PASS", blockingCount: 0, nonBlockingCount: 0 },
    });
    assert.deepEqual(passUpdates, [{ stepId: "impl-review", status: "done" }]);

    const failUpdates = [];
    await FLOW_COMMANDS.run.review.post({
      phase: null,
      flowState: {},
      flowManager: {
        appendMetric() {},
        updateStepStatus(stepId, status) { failUpdates.push({ stepId, status }); },
      },
    }, {
      artifacts: { phase: "impl", verdict: "FAIL", blockingCount: 1, nonBlockingCount: 0 },
    });
    assert.deepEqual(failUpdates, []);
  });
});

function metricsForImplVerdict(verdict) {
  const metrics = [];
  updateReviewRetryCounter(
    {
      phase: null,
      flowState: {},
      flowManager: {
        appendMetric(payload, opts) { metrics.push({ payload, opts }); },
      },
    },
    {
      artifacts: {
        phase: "impl",
        verdict,
        blockingCount: verdict === "FAIL" ? 1 : 0,
        nonBlockingCount: verdict === "ADVISORY" ? 1 : 0,
      },
    },
  );
  return metrics;
}

describe("review subprocess retry", () => {
  it("retries impl schema failures within the tooling limit and preserves diagnostics", async () => {
    let calls = 0;
    const result = await runCmdWithRetry(() => {
      calls += 1;
      const failure = ReviewFailure.schemaFailure({
        phase: "impl",
        targetReview: "impl-review",
        validationError: "requirementId is unknown",
        currentAttempt: 1,
        maximumAttempts: 1,
      });
      return {
        ok: false,
        status: 1,
        stdout: "",
        stderr: failure.toMarkerLine(),
        signal: null,
        killed: false,
      };
    }, { phase: "impl", retryCount: 2, retryDelayMs: 0 });

    const failure = ReviewFailure.fromSubprocessResult({ phase: "impl", result });
    assert.equal(calls, 3);
    assert.equal(failure.classification, "schema_failure");
    assert.equal(failure.currentAttempt, 3);
    assert.equal(failure.maximumAttempts, 3);
  });

  it("does not retry deterministic test-review prompt size failures", async () => {
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
