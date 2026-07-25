// spec: R7 R8
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { buildInitialSteps, FLOW_STEPS } from "../../../src/lib/flow-helpers.js";
import {
  isPlanEvidenceFresh,
  PlanEvidenceReference,
} from "../../../src/flow/lib/plan-rewind.js";
import { RunReopenDraftCommand } from "../../../src/flow/lib/run-reopen-draft.js";
import SetStepCommand from "../../../src/flow/lib/set-step.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const SPEC_ID = "approval-rewind-freshness";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;
const RUN_ID = "run-approval-rewind-freshness";
const ISSUE = 459;

function stepsAt(activeStepId) {
  const steps = buildInitialSteps();
  const activeIndex = FLOW_STEPS.indexOf(activeStepId);
  assert.notEqual(activeIndex, -1, activeStepId);
  for (const [index, stepId] of FLOW_STEPS.entries()) {
    const step = findStepById(steps, stepId);
    step.status = index < activeIndex ? "done" : index === activeIndex ? "in_progress" : "pending";
  }
  return steps;
}

function writeSpec(root, confirmedAt) {
  const file = path.join(root, SPEC_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({
    goal: "approval freshness fixture",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    tasks: [],
    user_approval: {
      approved: true,
      confirmed_at: confirmedAt,
      notes: "fixture",
    },
  }, null, 2)}\n`);
}

class ApprovalFreshnessHarness {
  constructor() {
    this.root = createTmpDir("approval-rewind-freshness-");
    this.flowManager = new FlowManager({
      root: this.root,
      mainRoot: this.root,
      inWorktree: false,
    });
  }

  create(activeStepId, confirmedAt) {
    writeSpec(this.root, confirmedAt);
    this.flowManager.create({
      spec: SPEC_PATH,
      issue: ISSUE,
      runId: RUN_ID,
      baseBranch: "main",
      featureBranch: "feature/approval-rewind-freshness",
      currentTaskId: null,
      steps: stepsAt(activeStepId),
      requirements: [],
      tasks: [],
      metrics: [],
    });
    this.flowManager.addActiveFlow(SPEC_ID, "local");
  }

  setApprovalStep(confirmedAt) {
    writeSpec(this.root, confirmedAt);
    this.flowManager.mutate((state) => {
      state.steps = stepsAt("approval");
    });
  }

  async createSealedSpecCorrectionRewind() {
    this.create("implement", "2026-07-25T00:00:00.000Z");
    const result = await new RunReopenDraftCommand().execute({
      category: "spec-correction",
      reason: "Create the production sealed rewind shape for approval freshness verification.",
      root: this.root,
      specId: SPEC_ID,
      flowState: this.flowManager.load(),
      flowManager: this.flowManager,
      expectRunId: RUN_ID,
      expectIssue: ISSUE,
      expectSpec: SPEC_PATH,
    });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    const audit = this.flowManager.load().planRewinds.at(-1);
    assert.equal(audit.category, "spec-correction");
    assert.equal(Object.hasOwn(audit, "rewoundAt"), false);
    assert.match(audit.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(audit.entryDigest, /^[a-f0-9]{64}$/);
    return audit;
  }

  async completeApproval() {
    return new SetStepCommand().execute({
      id: "approval",
      status: "done",
      root: this.root,
      specId: SPEC_ID,
      flowManager: this.flowManager,
    });
  }

  cleanup() {
    removeTmpDir(this.root);
  }
}

function evidenceAt(createdAt) {
  return new PlanEvidenceReference({ kind: "approval", createdAt });
}

function shiftIso(value, deltaMs) {
  return new Date(Date.parse(value) + deltaMs).toISOString();
}

function auditSnapshot(state) {
  return {
    planRewinds: structuredClone(state.planRewinds),
    planRewindChain: structuredClone(state.planRewindChain),
  };
}

function implementBoundarySnapshot(state) {
  return ["implement", "test-execute", "test-result-review"].map((stepId) => ({
    id: stepId,
    status: findStepById(state.steps, stepId).status,
  }));
}

describe("approval freshness across current rewind record types", () => {
  it("R7: normalizes guarded rewoundAt and sealed spec-correction timestamp", () => {
    const occurrence = "2026-07-25T00:00:00.000Z";
    const records = [
      { rewoundAt: occurrence },
      { category: "spec-correction", timestamp: occurrence },
    ];

    for (const record of records) {
      const state = { planRewinds: [record] };
      assert.equal(isPlanEvidenceFresh(state, evidenceAt(shiftIso(occurrence, -1))), false);
      assert.equal(isPlanEvidenceFresh(state, evidenceAt(occurrence)), false);
      assert.equal(isPlanEvidenceFresh(state, evidenceAt(shiftIso(occurrence, 1))), true);
    }

    const older = "2026-07-25T00:00:00.000Z";
    const latest = "2026-07-25T00:00:10.000Z";
    const histories = [
      [
        { category: "spec-correction", timestamp: older },
        { rewoundAt: latest },
      ],
      [
        { rewoundAt: older },
        { category: "spec-correction", timestamp: latest },
      ],
    ];
    for (const planRewinds of histories) {
      const state = { planRewinds };
      assert.equal(isPlanEvidenceFresh(state, evidenceAt(shiftIso(older, 1))), false);
      assert.equal(isPlanEvidenceFresh(state, evidenceAt(latest)), false);
      assert.equal(isPlanEvidenceFresh(state, evidenceAt(shiftIso(latest, 1))), true);
    }
  });

  it("R8: accepts only approval confirmed after a production sealed rewind", async () => {
    for (const [deltaMs, expectedFresh] of [[-1, false], [0, false], [1, true]]) {
      const harness = new ApprovalFreshnessHarness();
      try {
        const audit = await harness.createSealedSpecCorrectionRewind();
        harness.setApprovalStep(shiftIso(audit.timestamp, deltaMs));
        const stateBefore = harness.flowManager.load();
        const auditBefore = auditSnapshot(stateBefore);
        const implementBoundaryBefore = implementBoundarySnapshot(stateBefore);
        const result = await harness.completeApproval();
        if (expectedFresh) {
          assert.equal(result.status, "done", JSON.stringify(result));
        } else {
          assert.equal(result.ok, false);
          assert.equal(result.errors[0].code, "STALE_PLAN_APPROVAL");
        }
        const stateAfter = harness.flowManager.load();
        assert.deepEqual(auditSnapshot(stateAfter), auditBefore);
        assert.deepEqual(implementBoundarySnapshot(stateAfter), implementBoundaryBefore);
      } finally {
        harness.cleanup();
      }
    }
  });

  it("R8: fails closed for malformed occurrence time and preserves no-rewind behavior", async () => {
    const malformed = new ApprovalFreshnessHarness();
    try {
      malformed.create("approval", "2026-07-25T00:00:01.000Z");
      malformed.flowManager.mutate((state) => {
        state.planRewinds = [{ category: "spec-correction", timestamp: "not-an-iso-timestamp" }];
      });
      assert.equal(
        isPlanEvidenceFresh(malformed.flowManager.load(), evidenceAt("2026-07-25T00:00:01.000Z")),
        false,
      );
      const rejected = await malformed.completeApproval();
      assert.equal(rejected.ok, false);
      assert.equal(rejected.errors[0].code, "STALE_PLAN_APPROVAL");
    } finally {
      malformed.cleanup();
    }

    const noRewind = new ApprovalFreshnessHarness();
    try {
      noRewind.create("approval", "2026-07-25T00:00:01.000Z");
      const accepted = await noRewind.completeApproval();
      assert.equal(accepted.status, "done", JSON.stringify(accepted));
    } finally {
      noRewind.cleanup();
    }
  });
});
