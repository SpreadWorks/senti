// spec: R1 R2 R3 R4 R5 R6 R7 R8
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, mock, test } from "node:test";
import {
  buildDraftReviewArtifact,
  writeReviewAttemptHistory,
} from "../../../src/flow/commands/review.js";
import {
  applyReviewEvidenceTransition,
  ReviewDisposition,
  ReviewEvidence,
} from "../../../src/flow/lib/review-convergence.js";
import * as runReview from "../../../src/flow/lib/run-review.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { Agent } from "../../../src/lib/agent.js";

const {
  canonicalReviewArtifactFindings,
  reviewArtifactFindingLists,
} = runReview;

const REPAIR_TARGET = Object.freeze({
  title: "Empty initial QA list",
  target: "qa[]",
  rationale: "Initial QA list is empty before answer collection",
  evidence: "qa[] is empty before any answer exists",
  classification: "repair_target",
});

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

class DraftReviewFixture {
  constructor({
    phase = "draft-questions",
    blockingFindings = [],
    advisoryFindings = [],
    repairTargets = [],
  } = {}) {
    this.phase = phase;
    this.artifactName = phase === "draft-coverage"
      ? "draft-review-coverage.json"
      : "draft-review-questions.json";
    this.artifact = Object.freeze({
      blockingFindings: Object.freeze([...blockingFindings]),
      advisoryFindings: Object.freeze([...advisoryFindings]),
      repairTargets: Object.freeze([...repairTargets]),
    });
    Object.freeze(this);
  }

  canonicalFindings() {
    return canonicalReviewArtifactFindings(
      this.artifact,
      this.phase,
      this.artifactName,
    );
  }

  disposition(value) {
    return new ReviewDisposition({
      value,
      ...this.canonicalFindings(),
    });
  }
}

function advisoryEvidence(disposition, invocationId) {
  return new ReviewEvidence({
    phase: "draft-questions",
    taskId: null,
    treeSha: "1".repeat(40),
    provenance: {
      provider: "issue-454-fixture",
      invocationId,
      capturedAt: "2026-07-24T00:00:00.000Z",
    },
    disposition,
  });
}

test("R1: draft-questions repairTargets-only records canonical advisory findings", () => {
  const fixture = new DraftReviewFixture({ repairTargets: [REPAIR_TARGET] });
  const disposition = fixture.disposition("ADVISORY");
  const flowState = {};
  const recorded = applyReviewEvidenceTransition(
    flowState,
    advisoryEvidence(disposition, "r1-result-recording"),
    { configuredSemanticMaxAttempts: 4 },
  );

  assert.equal(disposition.value, "ADVISORY");
  assert.deepEqual(disposition.blockingFindings, []);
  assert.equal(disposition.advisoryFindings.length, 1);
  assert.equal(
    disposition.advisoryFindings[0].findingId,
    "draft-questions-advisory-001",
  );
  assert.equal(recorded.disposition, "ADVISORY");
  assert.equal(recorded.finalizedEvidenceAvailable, true);
  assert.equal(recorded.handoffFindings.length, 1);
  assert.equal(flowState.reviewConvergence.records.length, 1);
});

test("R2: draft-coverage repairTargets-only uses the canonical advisory contract", () => {
  const fixture = new DraftReviewFixture({
    phase: "draft-coverage",
    repairTargets: [REPAIR_TARGET],
  });
  const disposition = fixture.disposition("ADVISORY");

  assert.equal(disposition.value, "ADVISORY");
  assert.deepEqual(disposition.blockingFindings, []);
  assert.equal(disposition.advisoryFindings.length, 1);
  assert.equal(
    disposition.advisoryFindings[0].findingId,
    "draft-coverage-advisory-001",
  );
});

test("R3: advisory findings and repair targets remain advisory without blocking findings", () => {
  const advisoryFinding = {
    title: "Keep advisory context",
    rationale: "Existing advisory context must remain visible.",
    classification: "advisory",
  };
  const fixture = new DraftReviewFixture({
    advisoryFindings: [advisoryFinding],
    repairTargets: [REPAIR_TARGET],
  });
  const mapped = reviewArtifactFindingLists(fixture.artifact, fixture.phase);
  const disposition = fixture.disposition("ADVISORY");

  assert.deepEqual(mapped.blocking, []);
  assert.deepEqual(mapped.advisory, [advisoryFinding, REPAIR_TARGET]);
  assert.deepEqual(disposition.blockingFindings, []);
  assert.equal(disposition.advisoryFindings.length, 2);
  assert.deepEqual(
    disposition.advisoryFindings.map((finding) => finding.findingId),
    ["draft-questions-advisory-001", "draft-questions-advisory-002"],
  );
});

test("R4: repair target metadata remains in history and the raw triage source", () => {
  const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "issue-454-history-"));
  tempDirs.push(specDir);
  const artifact = {
    verdict: "ADVISORY",
    blockingFindings: [],
    advisoryFindings: [],
    repairTargets: [REPAIR_TARGET],
  };
  const written = writeReviewAttemptHistory({
    specDir,
    phase: "draft-questions",
    latestBasename: "draft-review-questions.json",
    artifact,
    attemptNumber: 1,
  });
  const raw = JSON.parse(fs.readFileSync(written.latestPath, "utf8"));
  const history = JSON.parse(fs.readFileSync(written.historyJsonPath, "utf8"));

  assert.deepEqual(raw.repairTargets, [REPAIR_TARGET]);
  assert.equal(history.findings.length, 1);
  assert.deepEqual(
    {
      category: history.findings[0].category,
      target: history.findings[0].target,
      evidence: history.findings[0].evidence,
      rationale: history.findings[0].rationale,
    },
    {
      category: "repair_target",
      target: REPAIR_TARGET.target,
      evidence: REPAIR_TARGET.evidence,
      rationale: REPAIR_TARGET.rationale,
    },
  );
  const disposition = new DraftReviewFixture({
    repairTargets: raw.repairTargets,
  }).disposition(raw.verdict);
  assert.equal(disposition.advisoryFindings.length, 1);
});

test("R5: empty draft buckets remain PASS with zero canonical findings", () => {
  for (const phase of ["draft-questions", "draft-coverage"]) {
    const disposition = new DraftReviewFixture({ phase }).disposition("PASS");
    assert.deepEqual(disposition.blockingFindings, []);
    assert.deepEqual(disposition.advisoryFindings, []);
  }
});

test("R6: invalid PASS, ADVISORY, and REJECTED combinations fail closed", () => {
  const fixture = new DraftReviewFixture({ repairTargets: [REPAIR_TARGET] });
  const [finding] = fixture.canonicalFindings().advisoryFindings;
  const [blockingFinding] = new DraftReviewFixture({
    blockingFindings: [{
      title: "Missing required decision",
      evidence: "The draft has no implementation boundary.",
      classification: "blocking",
    }],
  }).canonicalFindings().blockingFindings;

  assert.throws(
    () => new ReviewDisposition({
      value: "ADVISORY",
      blockingFindings: [blockingFinding],
      advisoryFindings: [finding],
    }),
    /ADVISORY disposition requires advisory findings and no blocking findings/,
  );
  assert.throws(
    () => new ReviewDisposition({
      value: "PASS",
      advisoryFindings: [finding],
    }),
    /PASS disposition cannot contain findings/,
  );
  assert.throws(
    () => new ReviewDisposition({
      value: "REJECTED",
      blockingFindings: [],
    }),
    /REJECTED disposition requires at least one blocking finding/,
  );
});

test("R7: fallback IDs stay unique while duplicate content and evidence remain rejected", () => {
  const secondRepairTarget = {
    ...REPAIR_TARGET,
    title: "Question contains an embedded rationale",
    target: "qa[1]",
    evidence: "qa[1].question contains answer text",
  };
  const distinctFixture = new DraftReviewFixture({
    repairTargets: [REPAIR_TARGET, secondRepairTarget],
  });
  const distinct = distinctFixture.canonicalFindings();

  assert.deepEqual(
    distinct.advisoryFindings.map((finding) => finding.findingId),
    ["draft-questions-advisory-001", "draft-questions-advisory-002"],
  );
  const disposition = new ReviewDisposition({
    value: "ADVISORY",
    ...distinct,
  });

  const duplicate = new DraftReviewFixture({
    repairTargets: [REPAIR_TARGET, REPAIR_TARGET],
  }).canonicalFindings();
  assert.throws(
    () => new ReviewDisposition({ value: "ADVISORY", ...duplicate }),
    /duplicate fingerprint/,
  );

  const flowState = {};
  const firstEvidence = advisoryEvidence(disposition, "first");
  applyReviewEvidenceTransition(flowState, firstEvidence, {
    configuredSemanticMaxAttempts: 4,
  });
  assert.throws(
    () => applyReviewEvidenceTransition(flowState, firstEvidence, {
      configuredSemanticMaxAttempts: 4,
    }),
    (error) => error.code === "REVIEW_DUPLICATE_IDENTITY",
  );
  assert.throws(
    () => applyReviewEvidenceTransition(
      flowState,
      advisoryEvidence(disposition, "second"),
      { configuredSemanticMaxAttempts: 4 },
    ),
    (error) => error.code === "REVIEW_ALREADY_COMPLETED",
  );
});

test("R8: checkpoint-shaped evidence records once and advances to triage without review AI", async () => {
  const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "issue-454-checkpoint-"));
  tempDirs.push(specDir);
  const agentCall = mock.method(Agent.prototype, "call", () => {
    throw new Error("review AI must not run while replaying finalized checkpoint evidence");
  });
  const transitions = [];
  const flowState = {
    currentTaskId: null,
    steps: [
      { id: "draft-questions-review", status: "in_progress" },
      { id: "draft-questions-triage", status: "pending" },
      { id: "draft-questions-repair", status: "pending" },
    ],
    tasks: [],
  };
  const flowManager = {
    appendMetric() {},
    updateStepStatus(transition) {
      transitions.push({
        stepId: transition.stepId,
        status: transition.requestedStatus,
      });
      flowState.steps.find((step) => step.id === transition.stepId).status =
        transition.requestedStatus;
    },
  };

  try {
    const produced = buildDraftReviewArtifact({
      raw: "FINALIZED_CHECKPOINT_EVIDENCE",
      draftPath: "draft.json",
      proposals: [{
        title: REPAIR_TARGET.title,
        file: null,
        body: [
          `**QA:** ${REPAIR_TARGET.target}`,
          `**Issue:** ${REPAIR_TARGET.evidence}`,
          `**Suggestion:** ${REPAIR_TARGET.rationale}`,
          "**Classification:** repair_target",
        ].join("\n"),
      }],
      stage: {
        reviewPhase: "draft-questions-review",
        findingClassification: "repair_target",
      },
    }).toJSON();
    assert.equal(produced.verdict, "ADVISORY");

    const written = writeReviewAttemptHistory({
      specDir,
      phase: "draft-questions",
      latestBasename: "draft-review-questions.json",
      artifact: produced,
      attemptNumber: 1,
    });
    const raw = JSON.parse(fs.readFileSync(written.latestPath, "utf8"));
    assert.equal(raw.verdict, produced.verdict);
    const canonical = canonicalReviewArtifactFindings(
      raw,
      "draft-questions",
      "draft-review-questions.json",
    );
    const disposition = new ReviewDisposition({
      value: raw.verdict,
      ...canonical,
    });

    assert.equal(disposition.value, "ADVISORY");
    assert.equal(disposition.advisoryFindings.length, 1);
    assert.equal(agentCall.mock.callCount(), 0);
    assert.deepEqual(
      fs.readdirSync(path.join(specDir, "review-history")),
      ["draft-questions-attempt-001.json"],
    );

    await FLOW_COMMANDS.run.review.post({
      phase: "draft",
      flowState,
      flowManager,
    }, {
      artifacts: {
        phase: "draft",
        verdict: disposition.value,
        issueCount: disposition.advisoryFindings.length,
        retryPhase: "draft-questions",
      },
    });

    assert.equal(agentCall.mock.callCount(), 0);
    assert.deepEqual(transitions, [{
      stepId: "draft-questions-review",
      status: "done",
    }]);
    assert.equal(flowState.steps[0].status, "done");
    assert.equal(flowState.steps[1].status, "pending");
  } finally {
    agentCall.mock.restore();
  }
});
