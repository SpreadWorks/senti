import assert from "node:assert/strict";
import { test } from "node:test";
import RunAcceptanceReviewCommand, {
  AcceptanceReviewResponseSource,
} from "../../../src/flow/lib/run-acceptance-review.js";
import {
  AcceptanceRepairFindingSet,
  deriveAcceptanceReviewVerdict,
  validateAcceptanceReviewArtifact,
} from "../../../src/flow/lib/acceptance-review-artifacts.js";
import { CanonicalAcceptanceArtifactStore } from "../../../src/flow/lib/canonical-acceptance-artifacts.js";

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

test("acceptance has no Task Review handoff when no Task review artifact is a fourth repaired rejection", () => {
  const store = new CanonicalAcceptanceArtifactStore({
    state: { schemaRevision: 3, specId: "001", runId: "run", flowId: "flow", flowVersionId: "v1", request: "x" },
    flowManager: {
      readArtifact() { throw new Error("no task review should be read"); },
      readCatalogArtifact() {},
      artifactCatalog() { return { artifacts: [] }; },
      activityLedger() { return []; },
      specLocation() { return { specRoot: "specs", specId: "001", relativeDirectory: "specs/001" }; },
    },
  });
  assert.deepEqual(store.taskReviewHandoffs(), []);
});

test("rejects a retired root-artifact acceptance fixture", async () => {
  await assert.rejects(
    () => new RunAcceptanceReviewCommand().execute({
      flowManager: { load: () => ({ schemaRevision: 2 }) },
    }),
    /Version-1 Flow/,
  );
});

test("requires stable hard-blocker identities and binds all repair findings", () => {
  const hardBlockers = ["DF-1", "DF-2"].map((findingId) => ({ findingId }));
  const artifact = {
    version: 2,
    repairFingerprint: "a".repeat(64),
    mechanicalBlockers: [],
    hardBlockers,
    requirementJudgments: [{
      requirementId: "R-1",
      status: "notMet",
      requestRefs: ["flow.request"],
      requirementRefs: ["spec.json#R-1"],
      diffRefs: ["diff:product.js"],
      repairRefs: ["acceptance:no-repair"],
      testRefs: ["test-execute-result.json#R-1"],
      missingEvidence: [],
    }],
    deferredFindings: [],
    userDecision: null,
    verdict: "repair_required",
  };
  assert.equal(deriveAcceptanceReviewVerdict(artifact), "repair_required");
  validateAcceptanceReviewArtifact(artifact, { requirementIds: ["R-1"] });
  assert.deepEqual(new AcceptanceRepairFindingSet(artifact).toJSON(), [
    "requirement:R-1",
    "hard-blocker:DF-1",
    "hard-blocker:DF-2",
  ]);

  assert.throws(() => validateAcceptanceReviewArtifact({
    ...artifact,
    hardBlockers: [{ findingId: "DF-1" }, {}],
  }, { requirementIds: ["R-1"] }), /hardBlockers\[1\].findingId|schema validation/);
  assert.equal(deriveAcceptanceReviewVerdict({ ...artifact, requirementJudgments: [{
    ...artifact.requirementJudgments[0], status: "met",
  }] }), "user_decision_required");
});
