import assert from "node:assert/strict";
import { test } from "node:test";
import RunAcceptanceReviewCommand, {
  AcceptanceReviewResponseSource,
} from "../../../src/flow/lib/run-acceptance-review.js";

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
  const previous = process.env.SENTI_ACCEPTANCE_REVIEW_ARTIFACT;
  process.env.SENTI_ACCEPTANCE_REVIEW_ARTIFACT = "/tmp/untrusted-acceptance-fixture.json";
  try {
    assert.equal(new AcceptanceReviewResponseSource().load({ marker: "test-context" }), null);
  } finally {
    if (previous === undefined) delete process.env.SENTI_ACCEPTANCE_REVIEW_ARTIFACT;
    else process.env.SENTI_ACCEPTANCE_REVIEW_ARTIFACT = previous;
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
