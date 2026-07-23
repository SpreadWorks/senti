// spec: R1 R2 R3 R4 R5 R8
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, mock, test } from "node:test";
import {
  buildDraftReviewArtifact,
  writeReviewAttemptHistory,
} from "../../../src/flow/commands/review.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { ReviewDisposition } from "../../../src/flow/lib/review-convergence.js";
import { Agent } from "../../../src/lib/agent.js";
import { reviewFindingFromHistory } from "./review-fixture-helpers.js";

const REPAIR_TARGET = Object.freeze({
  title: "Empty initial QA list",
  target: "qa[]",
  rationale: "Initial QA list is empty before answer collection",
  evidence: "qa[] is empty before any answer exists",
});

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

class RecordedDraftReview {
  constructor({ rawArtifact, historyArtifact, recordCalls }) {
    assert.equal(typeof rawArtifact?.verdict, "string");
    assert.ok(Array.isArray(rawArtifact.blockingFindings));
    assert.ok(Array.isArray(rawArtifact.advisoryFindings));
    assert.ok(Array.isArray(rawArtifact.repairTargets));
    assert.ok(Array.isArray(historyArtifact?.findings));
    assert.equal(recordCalls, 1);
    this.rawArtifact = rawArtifact;
    this.historyArtifact = historyArtifact;
    this.recordCalls = recordCalls;
    Object.freeze(this);
  }

  get canonicalFindings() {
    return this.historyArtifact.findings;
  }

  get triageInput() {
    return this.rawArtifact.repairTargets;
  }

  toDisposition() {
    const blockingFindings = [];
    const advisoryFindings = [];
    for (const finding of this.canonicalFindings) {
      const canonicalFinding = reviewFindingFromHistory(
        finding,
        this.historyArtifact.sourceArtifact,
      );
      if (finding.severity === "blocking") {
        blockingFindings.push(canonicalFinding);
      } else if (finding.severity === "non-blocking") {
        advisoryFindings.push(canonicalFinding);
      } else {
        throw new Error(`unsupported canonical finding severity: ${finding.severity}`);
      }
    }
    return new ReviewDisposition({
      value: this.rawArtifact.verdict,
      blockingFindings,
      advisoryFindings,
    });
  }
}

class DraftReviewHistoryRecorder {
  constructor(route) {
    if (route !== "questions" && route !== "coverage") {
      throw new Error(`unsupported draft review route: ${route}`);
    }
    this.route = route;
    this.specDir = fs.mkdtempSync(path.join(os.tmpdir(), `issue-454-${route}-`));
    tempDirs.push(this.specDir);
    this.recordCalls = 0;
  }

  record(artifact) {
    this.recordCalls += 1;
    if (this.recordCalls !== 1) {
      throw new Error("a draft review scenario may be recorded exactly once");
    }
    const retryPhase = `draft-${this.route}`;
    const latestBasename = `draft-review-${this.route}.json`;
    const written = writeReviewAttemptHistory({
      specDir: this.specDir,
      phase: retryPhase,
      latestBasename,
      artifact,
      attemptNumber: 1,
    });
    return new RecordedDraftReview({
      rawArtifact: JSON.parse(fs.readFileSync(written.latestPath, "utf8")),
      historyArtifact: JSON.parse(fs.readFileSync(written.historyJsonPath, "utf8")),
      recordCalls: this.recordCalls,
    });
  }
}

class DraftReviewScenario {
  constructor(route) {
    this.route = route;
    this.recorder = new DraftReviewHistoryRecorder(route);
  }

  proposal(kind) {
    if (kind === "repair") {
      return {
        title: REPAIR_TARGET.title,
        file: null,
        body: [
          `**QA:** ${REPAIR_TARGET.target}`,
          `**Issue:** ${REPAIR_TARGET.evidence}`,
          `**Suggestion:** ${REPAIR_TARGET.rationale}`,
          "**Classification:** repair_target",
        ].join("\n"),
      };
    }
    if (kind === "advisory") {
      return {
        title: "Keep advisory context",
        file: null,
        body: [
          "**QA:** analysis.validation",
          "**Issue:** Existing validation context should remain visible.",
          "**Suggestion:** Preserve the advisory finding.",
          "**Classification:** advisory",
        ].join("\n"),
      };
    }
    throw new Error(`unsupported proposal kind: ${kind}`);
  }

  record(kinds) {
    const proposals = kinds.map((kind) => this.proposal(kind));
    const retryPhase = `draft-${this.route}`;
    const artifact = buildDraftReviewArtifact({
      raw: proposals.length === 0 ? "NO_PROPOSALS" : "STRUCTURED_REVIEW_OUTPUT",
      draftPath: "draft.json",
      proposals,
      stage: {
        reviewPhase: `${retryPhase}-review`,
        findingClassification: this.route === "questions" ? "repair_target" : "blocking",
      },
    });
    return this.recorder.record(artifact.toJSON());
  }
}

class RawCheckpointReviewScenario {
  constructor() {
    this.recorder = new DraftReviewHistoryRecorder("questions");
    this.rawArtifact = Object.freeze({
      verdict: "ADVISORY",
      blockingFindings: Object.freeze([]),
      advisoryFindings: Object.freeze([]),
      repairTargets: Object.freeze([Object.freeze({
        ...REPAIR_TARGET,
        classification: "repair_target",
      })]),
    });
    Object.freeze(this);
  }

  replay() {
    return this.recorder.record(this.rawArtifact);
  }
}

function assertCanonicalRepairTarget(finding) {
  assert.equal(finding.severity, "non-blocking");
  assert.equal(finding.category, "repair_target");
  assert.equal(finding.title, REPAIR_TARGET.title);
  assert.equal(finding.body, REPAIR_TARGET.rationale);
}

test("R1: draft-questions repairTargets-only records one canonical advisory finding", () => {
  const result = new DraftReviewScenario("questions").record(["repair"]);

  assert.equal(result.rawArtifact.verdict, "ADVISORY");
  assert.equal(result.rawArtifact.blockingFindings.length, 0);
  assert.equal(result.rawArtifact.advisoryFindings.length, 0);
  assert.equal(result.rawArtifact.repairTargets.length, 1);
  assert.equal(result.canonicalFindings.length, 1);
  assertCanonicalRepairTarget(result.canonicalFindings[0]);
});

test("R2: draft-coverage repairTargets-only uses the same canonical advisory contract", () => {
  const result = new DraftReviewScenario("coverage").record(["repair"]);

  assert.equal(result.rawArtifact.verdict, "ADVISORY");
  assert.equal(result.rawArtifact.blockingFindings.length, 0);
  assert.equal(result.rawArtifact.advisoryFindings.length, 0);
  assert.equal(result.rawArtifact.repairTargets.length, 1);
  assert.equal(result.canonicalFindings.length, 1);
  assertCanonicalRepairTarget(result.canonicalFindings[0]);
});

test("R3: advisory and repair findings remain advisory without a blocking record", () => {
  const result = new DraftReviewScenario("questions").record(["advisory", "repair"]);

  assert.equal(result.rawArtifact.verdict, "ADVISORY");
  assert.equal(result.rawArtifact.advisoryFindings.length, 1);
  assert.equal(result.rawArtifact.repairTargets.length, 1);
  assert.deepEqual(
    result.canonicalFindings.map((finding) => finding.category),
    ["advisory", "repair_target"],
  );
  assert.ok(result.canonicalFindings.every((finding) => finding.severity === "non-blocking"));
});

test("R4: repair target category and authored fields remain available to triage", () => {
  const result = new DraftReviewScenario("coverage").record(["repair"]);
  const [triageTarget] = result.triageInput;
  const [canonicalFinding] = result.canonicalFindings;

  assert.deepEqual(triageTarget, {
    ...REPAIR_TARGET,
    classification: "repair_target",
  });
  assert.equal(canonicalFinding.category, triageTarget.classification);
  assert.equal(canonicalFinding.title, triageTarget.title);
  assert.equal(canonicalFinding.body, triageTarget.rationale);
  assert.equal(canonicalFinding.target, triageTarget.target);
  assert.equal(canonicalFinding.evidence, triageTarget.evidence);
});

test("R5: empty draft review records PASS with zero canonical findings", () => {
  for (const route of ["questions", "coverage"]) {
    const result = new DraftReviewScenario(route).record([]);
    assert.equal(result.rawArtifact.verdict, "PASS");
    assert.equal(result.rawArtifact.blockingFindings.length, 0);
    assert.equal(result.rawArtifact.advisoryFindings.length, 0);
    assert.equal(result.rawArtifact.repairTargets.length, 0);
    assert.deepEqual(result.canonicalFindings, []);
  }
});

test("R8: checkpoint-shaped repair target is recorded once without review AI", async () => {
  const agentCall = mock.method(Agent.prototype, "call", () => {
    throw new Error("review AI must not be invoked while replaying finalized checkpoint evidence");
  });
  const updates = [];
  const metrics = [];
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
    appendMetric(payload, opts) {
      metrics.push({ payload, opts });
    },
    updateStepStatus(transition) {
      updates.push({ stepId: transition.stepId, status: transition.requestedStatus });
      flowState.steps.find((step) => step.id === transition.stepId).status = transition.requestedStatus;
    },
  };

  try {
    assert.equal(agentCall.mock.callCount(), 0);
    const result = new RawCheckpointReviewScenario().replay();

    assert.equal(result.recordCalls, 1);
    assert.deepEqual(result.rawArtifact.blockingFindings, []);
    assert.deepEqual(result.rawArtifact.advisoryFindings, []);
    assert.deepEqual(result.rawArtifact.repairTargets, [{
      ...REPAIR_TARGET,
      classification: "repair_target",
    }]);
    const disposition = result.toDisposition();
    assert.equal(result.canonicalFindings.length, 1);
    assertCanonicalRepairTarget(result.canonicalFindings[0]);
    assert.equal(result.canonicalFindings[0].target, REPAIR_TARGET.target);
    assert.equal(result.canonicalFindings[0].evidence, REPAIR_TARGET.evidence);
    assert.equal(disposition.value, "ADVISORY");
    assert.equal(disposition.blockingFindings.length, 0);
    assert.equal(disposition.advisoryFindings.length, 1);

    await FLOW_COMMANDS.run.review.post({
      phase: "draft",
      flowState,
      flowManager,
    }, {
      artifacts: {
        phase: "draft",
        verdict: result.rawArtifact.verdict,
        issueCount: result.canonicalFindings.length,
        retryPhase: result.historyArtifact.phase,
      },
    });

    assert.equal(agentCall.mock.callCount(), 0);
    assert.deepEqual(updates, [
      { stepId: "draft-questions-review", status: "done" },
    ]);
    assert.equal(flowState.steps[0].status, "done");
    assert.equal(
      flowState.steps.find((step) => step.status === "pending").id,
      "draft-questions-triage",
    );
    assert.equal(flowState.steps[2].status, "pending");
    assert.deepEqual(metrics, [{
      payload: {
        phase: "draft-questions",
        counter: "reviewRetry",
        delta: 0,
        reset: true,
      },
      opts: { taskId: null },
    }]);
  } finally {
    agentCall.mock.restore();
  }
});
