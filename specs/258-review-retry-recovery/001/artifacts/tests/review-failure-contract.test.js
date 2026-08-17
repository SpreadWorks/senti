// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  checkReviewRetryBelowMax,
  runCmdWithRetry,
} from "../../../src/flow/lib/run-review.js";

import {
  REVIEW_FAILURE_MARKER_PREFIX,
  ReviewFailure,
  buildReviewStopView,
  clearReviewStopState,
  writeReviewStopState,
} from "../../../src/flow/lib/review-failure.js";

test("R1: taxonomy exposes the required review failure classifications", () => {
  assert.deepEqual(ReviewFailure.classifications().sort(), [
    "input_size_failure",
    "max_attempts_exceeded",
    "provider_failure",
    "review_verdict_failure",
    "schema_failure",
    "subprocess_failure",
  ]);
});

test("R2: subprocess retry decisions are classified and bounded", () => {
  const retryable = ReviewFailure.subprocessFailure({
    phase: "spec",
    exitCode: 1,
    stderr: "transient subprocess failure",
  });
  assert.equal(retryable.shouldRetrySubprocess({ attempt: 1, maxAttempts: 3 }), true);
  assert.equal(retryable.shouldRetrySubprocess({ attempt: 3, maxAttempts: 3 }), false);

  const killed = ReviewFailure.subprocessFailure({
    phase: "spec",
    signal: "SIGTERM",
    killed: true,
    stderr: "timeout",
  });
  assert.equal(killed.shouldRetrySubprocess({ attempt: 1, maxAttempts: 3 }), false);

  const input = ReviewFailure.inputSizeFailure({
    phase: "test",
    reason: "input-length",
    recoveryHint: "Reduce review input before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase test",
  });
  assert.equal(input.shouldRetrySubprocess({ attempt: 1, maxAttempts: 3 }), false);

  const provider = ReviewFailure.providerFailure({
    phase: "spec",
    reason: "rate-limit",
    recoveryHint: "Wait for provider quota reset before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase spec",
  });
  const verdict = ReviewFailure.reviewVerdictFailure({
    phase: "test",
    reason: "gaps-remain",
  });
  const maxed = ReviewFailure.maxAttemptsExceeded({
    phase: "spec",
    attempts: 3,
    max: 3,
  });

  for (const failure of [provider, verdict, maxed]) {
    assert.equal(failure.shouldRetrySubprocess({ attempt: 1, maxAttempts: 3 }), false);
  }
});

test("R2: run-review mechanical retry stops at three total attempts", async () => {
  let calls = 0;
  const result = await runCmdWithRetry(() => {
    calls += 1;
    return {
      ok: calls === 3,
      status: calls === 3 ? 0 : 1,
      stdout: "",
      stderr: calls === 3 ? "verdict=PASS gaps=0" : "transient subprocess failure",
      signal: null,
      killed: false,
    };
  }, { retryDelayMs: 0 });

  assert.equal(result.ok, true);
  assert.equal(calls, 3);

  let cappedCalls = 0;
  const capped = await runCmdWithRetry(() => {
    cappedCalls += 1;
    return {
      ok: false,
      status: 1,
      stdout: "",
      stderr: "transient subprocess failure",
      signal: null,
      killed: false,
    };
  }, { retryCount: 100, retryDelayMs: 0 });

  assert.equal(capped.ok, false);
  assert.equal(cappedCalls, 3);
});

test("R2: run-review does not retry signal, killed, provider, or input-size stops", async () => {
  const provider = ReviewFailure.providerFailure({
    phase: "spec",
    reason: "quota",
    recoveryHint: "Wait for quota reset before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase spec",
  });
  const input = ReviewFailure.inputSizeFailure({
    phase: "test",
    reason: "input-length",
    recoveryHint: "Reduce review input before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase test",
  });

  for (const result of [
    { ok: false, status: null, stdout: "", stderr: "", signal: "SIGTERM", killed: false },
    { ok: false, status: null, stdout: "", stderr: "timeout", signal: null, killed: true },
    { ok: false, status: 1, stdout: "", stderr: provider.toMarkerLine(), signal: null, killed: false },
    { ok: false, status: 1, stdout: "", stderr: input.toMarkerLine(), signal: null, killed: false },
  ]) {
    let calls = 0;
    const actual = await runCmdWithRetry(() => {
      calls += 1;
      return result;
    }, { retryDelayMs: 0 });
    assert.equal(actual.ok, false);
    assert.equal(calls, 1);
  }
});

test("R3: provider and input size failures do not consume reviewRetry and persist recovery data", () => {
  const provider = ReviewFailure.providerFailure({
    phase: "spec",
    reason: "rate-limit",
    recoveryHint: "Wait for provider quota reset before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase spec",
  });
  const input = ReviewFailure.inputSizeFailure({
    phase: "test",
    reason: "input-length",
    recoveryHint: "Reduce review input before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase test",
  });

  for (const failure of [provider, input]) {
    const data = failure.toEnvelopeData();
    assert.equal(data.retryBudgetConsumed, false);
    assert.equal(data.recoveryHint.length > 0, true);
    assert.equal(data.recoveryCommand.length > 0, true);

    const state = {};
    writeReviewStopState(state, failure);
    assert.equal(state.reviewStop.retryBudgetConsumed, false);
    assert.equal(state.reviewStop.recoveryHint, data.recoveryHint);
    assert.equal(state.reviewStop.recoveryCommand, data.recoveryCommand);
  }
});

test("R4: max attempts envelope data includes recoveryCommand", () => {
  const failure = ReviewFailure.maxAttemptsExceeded({
    phase: "spec",
    attempts: 1,
    max: 1,
  });
  assert.deepEqual(failure.toEnvelopeData(), {
    phase: "spec",
    attempts: 1,
    max: 1,
    classification: "max_attempts_exceeded",
    retryBudgetConsumed: false,
    recoveryCommand: "sdd-forge flow set retry reset review spec --yes",
    recoveryHint: "Reset the review retry counter before retrying this phase.",
  });
});

test("R4: review retry precheck returns recoveryCommand when max attempts are exhausted", () => {
  const result = checkReviewRetryBelowMax({
    flowState: {
      currentTaskId: null,
      metrics: [
        { phase: "spec", counter: "reviewRetry", delta: 1 },
        { phase: "spec", counter: "reviewRetry", delta: 1 },
        { phase: "spec", counter: "reviewRetry", delta: 1 },
      ],
    },
  }, "spec");

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "REVIEW_MAX_ATTEMPTS_EXCEEDED");
  assert.equal(result.data.phase, "spec");
  assert.equal(result.data.recoveryCommand, "sdd-forge flow set retry reset review spec --yes");
});

test("R5: next-action recovery view is derived from persisted reviewStop", () => {
  const state = {};
  writeReviewStopState(state, ReviewFailure.providerFailure({
    phase: "spec",
    reason: "quota",
    recoveryHint: "Wait for quota reset before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase spec",
  }));

  const view = buildReviewStopView(state, { surface: "next-action" });
  assert.equal(view.stopReason, "provider_failure");
  assert.equal(view.classification, "provider_failure");
  assert.equal(view.reason, "quota");
  assert.equal(view.retryBudgetConsumed, false);
  assert.equal(view.recoveryCommand, "sdd-forge flow run review --phase spec");
});

test("R5: next-action recovery view falls back to reviewRetry metrics and gives reviewStop precedence", () => {
  const state = {
    metrics: [
      { phase: "spec", counter: "reviewRetry", delta: 1 },
      { phase: "spec", counter: "reviewRetry", delta: 1 },
      { phase: "spec", counter: "reviewRetry", delta: 1 },
    ],
  };
  const fallback = buildReviewStopView(state, {
    surface: "next-action",
    phase: "spec",
    maxAttempts: 3,
  });
  assert.equal(fallback.classification, "max_attempts_exceeded");
  assert.equal(fallback.retryBudgetConsumed, false);
  assert.equal(fallback.recoveryCommand, "sdd-forge flow set retry reset review spec --yes");

  writeReviewStopState(state, ReviewFailure.providerFailure({
    phase: "spec",
    reason: "quota",
    recoveryHint: "Wait for quota reset before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase spec",
  }));
  const preferred = buildReviewStopView(state, {
    surface: "next-action",
    phase: "spec",
    maxAttempts: 3,
  });
  assert.equal(preferred.classification, "provider_failure");
  assert.equal(preferred.reason, "quota");
});

test("R6: status recovery view summarizes persisted reviewStop and clears by phase", () => {
  const state = {};
  writeReviewStopState(state, ReviewFailure.inputSizeFailure({
    phase: "test",
    reason: "input-length",
    recoveryHint: "Reduce review input before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase test",
  }));

  const view = buildReviewStopView(state, { surface: "status" });
  assert.equal(view.summary.includes("input_size_failure"), true);
  assert.equal(view.recoveryCommand, "sdd-forge flow run review --phase test");

  clearReviewStopState(state, "spec");
  assert.notEqual(state.reviewStop, null);
  clearReviewStopState(state, "test");
  assert.equal(state.reviewStop, null);
});

test("R6: status recovery view handles missing and stale reviewStop state", () => {
  assert.equal(buildReviewStopView({}, { surface: "status", phase: "test", maxAttempts: 3 }), null);

  const state = {};
  writeReviewStopState(state, ReviewFailure.providerFailure({
    phase: "spec",
    reason: "api-error",
    recoveryHint: "Retry after the provider error is resolved.",
    recoveryCommand: "sdd-forge flow run review --phase spec",
  }));
  assert.equal(buildReviewStopView(state, { surface: "status", phase: "test", maxAttempts: 3 }), null);
});

test("R5 R6: recovery views preserve legacy retry fields and tolerate partial legacy metrics", () => {
  const maxedState = {
    metrics: [
      { phase: "test", counter: "reviewRetry", delta: 1 },
      { phase: "test", counter: "reviewRetry", delta: 1 },
      { phase: "test", counter: "reviewRetry", delta: 1 },
    ],
  };
  const nextAction = buildReviewStopView(maxedState, {
    surface: "next-action",
    phase: "test",
    maxAttempts: 3,
  });
  assert.equal(nextAction.phase, "test");
  assert.equal(nextAction.attempts, 3);
  assert.equal(nextAction.max, 3);
  assert.equal(nextAction.classification, "max_attempts_exceeded");

  const partial = buildReviewStopView({
    reviewStop: {
      phase: "spec",
      classification: "provider_failure",
      reason: "provider unavailable",
      retryBudgetConsumed: false,
    },
  }, { surface: "status", phase: "spec", maxAttempts: 3 });
  assert.equal(partial.classification, "provider_failure");
  assert.equal(partial.recoveryCommand.length > 0, true);
  assert.equal(partial.summary.includes("provider_failure"), true);
});

test("R7: task review prompt states the soft upper bound for task-scope review", () => {
  const prompt = fs.readFileSync("src/flow/prompts/task/review.md", "utf8");
  assert.match(prompt, /soft limit/i);
  assert.match(prompt, /next-action maxAttempts/i);
  assert.match(prompt, /\b1\b/);
  assert.match(prompt, /task-scope/i);
  assert.match(prompt, /flow-scope/i);
});

test("R7: flow-scope review prompt remains distinct from task-scope soft limit", () => {
  const prompt = fs.readFileSync("src/flow/prompts/impl/review.md", "utf8");
  assert.match(prompt, /REVIEW_MAX_ATTEMPTS_EXCEEDED/);
  assert.match(prompt, /flow-scope/i);
  assert.match(prompt, /sdd-forge flow set retry reset review <phase> --yes/);
});

test("R8: provider failure data does not require issue-log for transient failures", () => {
  const failure = ReviewFailure.providerFailure({
    phase: "impl",
    reason: "api-error",
    recoveryHint: "Retry after the provider error is resolved.",
    recoveryCommand: "sdd-forge flow run review",
  });
  assert.equal(failure.requiresIssueLog(), false);
  assert.equal(failure.requiresIssueLog({ workaroundApplied: true }), true);
  assert.equal(failure.requiresIssueLog({ manualRecoveryRequired: true }), true);
});

test("R8: ordinary input-size recovery does not require issue-log but manual recovery does", () => {
  const failure = ReviewFailure.inputSizeFailure({
    phase: "test",
    reason: "input-length",
    recoveryHint: "Reduce review input before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase test",
  });

  assert.equal(failure.requiresIssueLog(), false);
  assert.equal(failure.requiresIssueLog({ workaroundApplied: true }), true);
  assert.equal(failure.requiresIssueLog({ specDecisionChanged: true }), true);
  assert.equal(failure.requiresIssueLog({ manualRecoveryRequired: true }), true);
});

test("R8: issue-log policy is visible in CLI-facing review guidance", () => {
  const prompt = fs.readFileSync("src/flow/prompts/impl/review.md", "utf8");
  assert.match(prompt, /provider/i);
  assert.match(prompt, /input size/i);
  assert.match(prompt, /issue-log/i);
  assert.match(prompt, /workaround|manual recovery|specification/i);
});

test("R9: child review marker round-trips provider failure data for run-review", () => {
  const failure = ReviewFailure.providerFailure({
    phase: "spec",
    reason: "rate-limit",
    recoveryHint: "Wait for provider quota reset before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase spec",
  });
  const marker = failure.toMarkerLine();
  assert.equal(marker.startsWith(REVIEW_FAILURE_MARKER_PREFIX), true);

  const parsed = ReviewFailure.fromMarkerLine(marker);
  assert.equal(parsed.classification, "provider_failure");
  assert.equal(parsed.reason, "rate-limit");
  assert.deepEqual(parsed.toEnvelopeData(), failure.toEnvelopeData());
});

test("R9: provider and input-size markers are single-line records with required fields", () => {
  const failures = [
    ReviewFailure.providerFailure({
      phase: "spec",
      reason: "quota",
      recoveryHint: "Wait for quota reset before retrying.",
      recoveryCommand: "sdd-forge flow run review --phase spec",
    }),
    ReviewFailure.inputSizeFailure({
      phase: "test",
      reason: "input-length",
      recoveryHint: "Reduce review input before retrying.",
      recoveryCommand: "sdd-forge flow run review --phase test",
    }),
  ];

  for (const failure of failures) {
    const marker = failure.toMarkerLine();
    assert.equal(marker.split("\n").length, 1);
    assert.equal(marker.startsWith(REVIEW_FAILURE_MARKER_PREFIX), true);
    const parsed = ReviewFailure.fromMarkerLine(marker);
    const data = parsed.toEnvelopeData();
    assert.equal(data.classification, failure.classification);
    assert.equal(typeof data.reason, "string");
    assert.equal(typeof data.recoveryHint, "string");
    assert.equal(typeof data.recoveryCommand, "string");
  }
});

test("R9: marker parsing prefers structured marker data and malformed markers fall back safely", () => {
  const input = ReviewFailure.inputSizeFailure({
    phase: "test",
    reason: "input-length",
    recoveryHint: "Reduce review input before retrying.",
    recoveryCommand: "sdd-forge flow run review --phase test",
  });

  const classified = ReviewFailure.fromSubprocessResult({
    phase: "test",
    result: {
      ok: false,
      status: 1,
      stdout: "",
      stderr: `plain stderr before marker\n${input.toMarkerLine()}\nplain stderr after marker`,
      signal: null,
      killed: false,
    },
  });
  assert.equal(classified.classification, "input_size_failure");
  assert.equal(classified.reason, "input-length");

  assert.equal(ReviewFailure.fromMarkerLine("not a marker"), null);
  assert.equal(ReviewFailure.fromMarkerLine(`${REVIEW_FAILURE_MARKER_PREFIX}{not-json`), null);

  const fallback = ReviewFailure.fromSubprocessResult({
    phase: "spec",
    result: {
      ok: false,
      status: 1,
      stdout: "",
      stderr: `${REVIEW_FAILURE_MARKER_PREFIX}{not-json`,
      signal: null,
      killed: false,
    },
  });
  assert.equal(fallback.classification, "subprocess_failure");
  assert.equal(fallback.reason.length > 0, true);
});

test("R9: unknown or incomplete marker payloads are invalid and conservatively classified", () => {
  for (const payload of [
    { phase: "spec", classification: "unknown_failure", reason: "x", recoveryCommand: "sdd-forge flow run review --phase spec" },
    { phase: "spec", classification: "provider_failure", reason: "quota", recoveryHint: "Wait." },
  ]) {
    const marker = `${REVIEW_FAILURE_MARKER_PREFIX}${JSON.stringify(payload)}`;
    assert.equal(ReviewFailure.fromMarkerLine(marker), null);
    const classified = ReviewFailure.fromSubprocessResult({
      phase: "spec",
      result: { ok: false, status: 1, stdout: "", stderr: marker, signal: null, killed: false },
    });
    assert.equal(classified.classification, "subprocess_failure");
    assert.equal(classified.shouldRetrySubprocess({ attempt: 1, maxAttempts: 3 }), true);
  }
});

test("R3 R4: recovery commands are actionable for every stopped review class", () => {
  const failures = [
    ReviewFailure.providerFailure({
      phase: "spec",
      reason: "api-error",
      recoveryHint: "Retry after the provider error is resolved.",
      recoveryCommand: "sdd-forge flow run review --phase spec",
    }),
    ReviewFailure.inputSizeFailure({
      phase: "test",
      reason: "input-length",
      recoveryHint: "Reduce review input before retrying.",
      recoveryCommand: "sdd-forge flow run review --phase test",
    }),
    ReviewFailure.maxAttemptsExceeded({
      phase: "impl",
      attempts: 3,
      max: 3,
    }),
  ];

  for (const failure of failures) {
    const data = failure.toEnvelopeData();
    assert.match(data.recoveryCommand, /^sdd-forge flow /);
    assert.equal(data.recoveryCommand.includes("\n"), false);
  }
});

test("R1 R3: review verdict failure remains separate from subprocess/provider failures", () => {
  const failure = ReviewFailure.reviewVerdictFailure({
    phase: "test",
    reason: "gaps-remain",
  });

  assert.equal(failure.classification, "review_verdict_failure");
  assert.equal(failure.shouldRetrySubprocess({ attempt: 1, maxAttempts: 3 }), false);
  assert.deepEqual(failure.toEnvelopeData(), {
    phase: "test",
    classification: "review_verdict_failure",
    reason: "gaps-remain",
    retryBudgetConsumed: true,
  });
});
