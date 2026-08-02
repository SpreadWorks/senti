import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AgentAuthenticationFailure,
  AgentFailure,
  AgentPermissionConfigurationFailure,
  AgentUsageLimitFailure,
  EmptyAgentResponseFailure,
  PermanentNetworkFailure,
  TemporaryNetworkFailure,
  TemporaryRateLimitFailure,
  UnknownProviderFailure,
} from "../../../src/lib/agent-failure.js";
import {
  FlowOutbox,
  FlowOutboxStore,
  finalizationOutboxIdentity,
} from "../../../src/flow/lib/flow-outbox.js";
import {
  WorkUnitCheckpoint,
  WorkUnitIdentity,
  WorkUnitResumeDecision,
} from "../../../src/flow/lib/work-unit.js";
import { ReviewFailure } from "../../../src/flow/lib/review-failure.js";
import {
  ExternalBlockedOutcome,
  StepOutcome,
} from "../../../src/flow/lib/step-outcome.js";

function providerError(message, fields = {}) {
  return Object.assign(new Error(message), fields);
}

function workUnitIdentity(inputHash = "same-input") {
  return new WorkUnitIdentity({
    phase: "impl-review",
    kind: "loop-chunk",
    stableOrderKey: "chunk-0001",
    parentUnitId: null,
    targetFiles: ["src/example.js"],
    inputHash,
    commandId: "flow.impl.review.propose",
    providerIdentity: "test/provider",
    promptVersion: "review-v1",
    schemaVersion: "review-schema-v1",
  });
}

describe("typed agent failure boundaries", () => {
  it("retries only explicit transient provider failures", () => {
    assert.ok(AgentFailure.from(providerError("HTTP 429 rate limited")) instanceof TemporaryRateLimitFailure);
    assert.ok(AgentFailure.from(providerError("temporary DNS", { code: "EAI_AGAIN" })) instanceof TemporaryNetworkFailure);
    const unexplainedExit = AgentFailure.from(providerError("provider=demo | exit=1", {
      code: 1,
      stdout: "",
      stderr: "",
    }));
    assert.ok(unexplainedExit instanceof UnknownProviderFailure);
    assert.equal(unexplainedExit.retryable, false);
    assert.ok(AgentFailure.from(providerError("empty response")) instanceof EmptyAgentResponseFailure);
  });

  it("fails closed for authentication, configuration, quota, permanent DNS, and unknown failures", () => {
    const failures = [
      AgentFailure.from(providerError("api_error_status=401 OAuth token expired")),
      AgentFailure.from(providerError("spawn agent ENOENT", { code: "ENOENT" })),
      AgentFailure.from(providerError("HTTP 429 session limit reached")),
      AgentFailure.from(providerError("getaddrinfo ENOTFOUND provider.invalid", { code: "ENOTFOUND" })),
      AgentFailure.from(providerError("provider=demo | exit=2 | unexplained failure", {
        code: 2,
        stdout: "",
        stderr: "unexplained failure",
      })),
    ];

    assert.ok(failures[0] instanceof AgentAuthenticationFailure);
    assert.ok(failures[1] instanceof AgentPermissionConfigurationFailure);
    assert.ok(failures[2] instanceof AgentUsageLimitFailure);
    assert.ok(failures[3] instanceof PermanentNetworkFailure);
    assert.ok(failures[4] instanceof UnknownProviderFailure);
    assert.ok(failures.every((failure) => failure.retryable === false));
    assert.ok(failures.every((failure) => failure.code && failure.recoveryHint));
  });

  it("records bounded attempt metadata on the typed error", () => {
    const failure = AgentFailure.from(providerError("HTTP 429 rate limited"))
      .recordAttempts(2, 3);
    assert.deepEqual(failure.toJSON(), {
      kind: "temporary_rate_limit",
      code: "AGENT_TEMPORARY_RATE_LIMIT",
      retryable: true,
      recoveryHint: "Wait for the provider rate-limit window, then retry the same input.",
      attemptCount: 2,
      maxAttempts: 3,
      message: "HTTP 429 rate limited",
    });
  });
});

describe("terminal replay guards", () => {
  it("preserves typed failure data through review markers and stored StepOutcomes", () => {
    const source = new AgentAuthenticationFailure({ message: "OAuth token expired" })
      .recordAttempts(1, 3);
    const review = ReviewFailure.fromAgentFailure({ phase: "impl", failure: source });
    const restoredReview = ReviewFailure.fromMarkerLine(review.toMarkerLine());
    assert.equal(restoredReview.failureCode, "AGENT_AUTHENTICATION_FAILED");
    assert.equal(restoredReview.retryable, false);
    assert.equal(restoredReview.attemptCount, 1);
    assert.equal(restoredReview.maxAttempts, 3);

    const outcome = new ExternalBlockedOutcome({
      reason: source.kind,
      resumeInstruction: source.recoveryHint,
      failureCode: source.code,
      retryable: source.retryable,
      recoveryHint: source.recoveryHint,
    });
    const restoredOutcome = StepOutcome.fromStored(outcome.toJSON());
    assert.ok(restoredOutcome instanceof ExternalBlockedOutcome);
    assert.equal(restoredOutcome.failureCode, "AGENT_AUTHENTICATION_FAILED");
    assert.equal(restoredOutcome.retryable, false);
  });

  it("blocks an unchanged non-retryable WorkUnit checkpoint and permits changed input", () => {
    const identity = workUnitIdentity();
    const checkpoint = new WorkUnitCheckpoint({
      identity,
      status: "failed",
      failure: {
        failureKind: "provider_failure",
        failureCode: "AGENT_AUTHENTICATION_FAILED",
        retryable: false,
        message: "authentication failed",
      },
    });

    assert.equal(WorkUnitResumeDecision.fromCheckpoint(identity, checkpoint).action, "blocked");
    assert.equal(WorkUnitResumeDecision.fromCheckpoint(workUnitIdentity("changed-input"), checkpoint).action, "execute");
  });

  it("blocks direct begin of a failed outbox entry without changing it", () => {
    const state = { outbox: [] };
    const flowManager = {
      mutate(operation) {
        operation(state);
      },
    };
    const store = new FlowOutboxStore(flowManager);
    const identity = finalizationOutboxIdentity({ runId: "run-487" }, "finalize-sync");
    store.begin(identity);
    store.fail(identity, new Error("push permission denied"));
    const before = structuredClone(state.outbox);

    assert.throws(
      () => store.beginCommand(identity),
      (error) => error.code === "FINALIZATION_OUTBOX_RECOVERY_REQUIRED" && error.retryable === false,
    );
    assert.deepEqual(state.outbox, before);
    assert.equal(new FlowOutbox(state.outbox).find(identity).status, "failed");
  });
});
