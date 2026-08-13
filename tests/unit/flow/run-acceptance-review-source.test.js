import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import RunAcceptanceReviewCommand, {
  AcceptanceReviewResponseSource,
} from "../../../src/flow/lib/run-acceptance-review.js";
import { AgentAuthenticationFailure } from "../../../src/lib/agent-failure.js";
import { container } from "../../../src/lib/container.js";
import { createAcceptanceReviewFixture } from "../../helpers/acceptance-review-fixture.js";
import { buildAcceptanceReviewContext } from "../../../src/flow/lib/acceptance-review-artifacts.js";

class TestFixtureResponseSource extends AcceptanceReviewResponseSource {
  constructor(response) {
    super();
    this.response = response;
  }

  load(context) {
    assert.equal(context.marker, "test-context");
    return this.response;
  }
}

test("production acceptance response source does not read fixture environment variables", () => {
  const previous = process.env.SENNEL_ACCEPTANCE_REVIEW_ARTIFACT;
  process.env.SENNEL_ACCEPTANCE_REVIEW_ARTIFACT = "/tmp/untrusted-acceptance-fixture.json";
  try {
    assert.equal(new AcceptanceReviewResponseSource().load({ marker: "test-context" }), null);
  } finally {
    if (previous === undefined) delete process.env.SENNEL_ACCEPTANCE_REVIEW_ARTIFACT;
    else process.env.SENNEL_ACCEPTANCE_REVIEW_ARTIFACT = previous;
  }
});

test("fixture response requires an explicit injected test source", () => {
  const fixture = { requirementJudgments: [], deferredFindingDispositions: [] };
  const command = new RunAcceptanceReviewCommand({
    responseSource: new TestFixtureResponseSource(fixture),
  });
  assert.equal(command.responseSource.load({ marker: "test-context" }), fixture);
  assert.throws(() => new RunAcceptanceReviewCommand({ responseSource: {} }), /AcceptanceReviewResponseSource/);
});

test("clean-checkout acceptance evidence remains valid without transient raw logs", (t) => {
  const fixture = createAcceptanceReviewFixture({ specPath: "specs/001-test/spec.json" });
  t.after(() => fixture.cleanup());
  fs.rmSync(path.join(fixture.root, fixture.scenarioRaw), { force: true });
  fs.rmSync(path.join(fixture.root, fixture.executionRaw), { force: true });
  fs.rmSync(path.join(fixture.root, fixture.finalRegressionRaw), { force: true });

  const context = buildAcceptanceReviewContext({
    root: fixture.root,
    executionRoot: fixture.root,
    state: fixture.state,
    diff: fixture.diff,
  });
  assert.equal(context.mechanicalBlockers.length, 0);
});

test("acceptance review records a terminal agent failure as durable external-blocked evidence", async (t) => {
  const fixture = createAcceptanceReviewFixture({ specPath: "specs/001-test/spec.json" });
  t.after(() => fixture.cleanup());
  const failure = new AgentAuthenticationFailure({ message: "HTTP 401 Unauthorized" })
    .recordAttempts(1, 3);
  const originalGet = container.get.bind(container);
  container.get = (key) => {
    if (key !== "agent") return originalGet(key);
    return {
      resolve: () => ({ provider: "fixture" }),
      call: async () => { throw failure; },
    };
  };

  let result;
  try {
    result = await new RunAcceptanceReviewCommand().execute({
      root: fixture.root,
      executionRoot: fixture.root,
      flowState: fixture.state,
      flowManager: fixture.flowManager,
    });
  } finally {
    container.get = originalGet;
  }

  const envelope = result.toJSON();
  assert.equal(envelope.ok, false);
  assert.equal(envelope.errors[0].code, "AGENT_AUTHENTICATION_FAILED");
  assert.equal(envelope.data.retryable, false);
  assert.equal(envelope.data.attemptCount, 1);
  assert.equal(envelope.data.maxAttempts, 3);
  assert.equal(envelope.data.stepAttempt.outcome.kind, "external-blocked");
  assert.equal(envelope.data.stepAttempt.outcome.failureCode, "AGENT_AUTHENTICATION_FAILED");
  assert.equal(envelope.data.stepAttempt.outcome.retryable, false);
});
