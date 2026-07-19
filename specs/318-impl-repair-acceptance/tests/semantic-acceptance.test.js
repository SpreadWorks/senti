// spec: R5 R6
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { getFlowNode } from "../../../src/flow/definition.js";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";

const fingerprint = "f".repeat(64);
const acceptanceModulePath = path.join(process.cwd(), "src/flow/lib/acceptance-review-artifacts.js");

async function loadAcceptanceModule() {
  return import(`${pathToFileURL(acceptanceModulePath).href}?t=${Date.now()}`);
}

async function fingerprintFor(root, state) {
  const repairModulePath = path.join(process.cwd(), "src/flow/lib/impl-repair-artifacts.js");
  const repair = await import(`${pathToFileURL(repairModulePath).href}?t=${Date.now()}`);
  return repair.buildRepairFingerprint({ root, specPath: state.spec }).hash;
}

function judgment(requirementId, status = "met", overrides = {}) {
  return {
    requirementId,
    status,
    requestRefs: ["flow.request"],
    requirementRefs: [`spec.json#${requirementId}`],
    diffRefs: ["diff:src/flow/definition.js"],
    repairRefs: ["impl-repair.json#no-repair"],
    testRefs: [`test-execute-result.json#${requirementId}`],
    missingEvidence: [],
    ...overrides,
  };
}

function artifact(judgments, overrides = {}) {
  const value = {
    version: 2,
    repairFingerprint: fingerprint,
    mechanicalBlockers: [],
    hardBlockers: [],
    requirementJudgments: judgments,
    deferredFindings: [],
    userDecision: null,
    ...overrides,
  };
  value.verdict = value.mechanicalBlockers.length > 0
    ? "blocked"
    : judgments.some((entry) => entry.status === "notMet")
      ? "repair_required"
      : judgments.some((entry) => entry.status === "notVerifiable")
        ? "user_decision_required"
        : "pass";
  return value;
}

function setupFlow(tmp) {
  const specDir = path.join(tmp, "specs/001-test");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
    requirements: [
      { id: "R1", priority: "must", desc: "First requirement.", status: "done" },
      { id: "R2", priority: "must", desc: "Second requirement.", status: "done" },
    ],
  }, null, 2));
  const state = {
    spec: "specs/001-test/spec.json",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    requirements: ["R1", "R2"],
    tasks: [],
    currentTaskId: null,
  };
  for (const step of state.steps.flatMap((entry) => entry.children || [entry])) step.status = "done";
  findStepById(state.steps, "acceptance-review").status = "in_progress";
  findStepById(state.steps, "acceptance-decision").status = "pending";
  findStepById(state.steps, "final-regression").status = "pending";

  return {
    state,
    flowManager: {
      load() { return state; },
      mutate(callback) { callback(state); },
    },
  };
}

test("R5: requirement judgments enforce semantic evidence invariants", async () => {
  const { RequirementAcceptanceJudgment } = await loadAcceptanceModule();
  assert.throws(() => new RequirementAcceptanceJudgment(judgment("R1", "unknown")), /status/i);
  assert.throws(() => new RequirementAcceptanceJudgment(judgment("R1", "met", { diffRefs: [] })), /diffRefs/i);
  assert.throws(() => new RequirementAcceptanceJudgment(judgment("R1", "notVerifiable")), /missingEvidence/i);

  const unverifiable = new RequirementAcceptanceJudgment(judgment("R1", "notVerifiable", {
    diffRefs: [],
    testRefs: [],
    missingEvidence: ["No reproducible external service evidence."],
  }));
  assert.equal(unverifiable.status, "notVerifiable");
});

test("R5: acceptance artifact covers every requirement exactly once", async () => {
  const { validateAcceptanceReviewArtifact } = await loadAcceptanceModule();
  const valid = artifact([judgment("R1"), judgment("R2")]);
  assert.equal(validateAcceptanceReviewArtifact(valid, { requirementIds: ["R1", "R2"] }), valid);

  assert.throws(
    () => validateAcceptanceReviewArtifact(artifact([judgment("R1")]), { requirementIds: ["R1", "R2"] }),
    /missing.*R2|R2.*missing/i,
  );
  assert.throws(
    () => validateAcceptanceReviewArtifact(artifact([judgment("R1"), judgment("R1")]), { requirementIds: ["R1"] }),
    /duplicate.*R1|R1.*duplicate/i,
  );
  assert.throws(
    () => validateAcceptanceReviewArtifact(artifact([judgment("R1"), judgment("R3")]), { requirementIds: ["R1", "R2"] }),
    /unknown.*R3|R3.*unknown/i,
  );
});

test("R6: acceptance verdict precedence is blocker, notMet, notVerifiable, then pass", async () => {
  const { deriveAcceptanceReviewVerdict } = await loadAcceptanceModule();
  assert.equal(deriveAcceptanceReviewVerdict(artifact([judgment("R1"), judgment("R2")])), "pass");
  assert.equal(deriveAcceptanceReviewVerdict(artifact([
    judgment("R1", "notVerifiable", { missingEvidence: ["External proof is unavailable."] }),
    judgment("R2"),
  ])), "user_decision_required");
  assert.equal(deriveAcceptanceReviewVerdict(artifact([
    judgment("R1", "notVerifiable", { missingEvidence: ["External proof is unavailable."] }),
    judgment("R2", "notMet"),
  ])), "repair_required");
  assert.equal(deriveAcceptanceReviewVerdict(artifact([judgment("R1")], {
    mechanicalBlockers: [{ blockerId: "M-1", kind: "missing_artifact", summary: "Evidence missing." }],
  })), "blocked");
});

test("R6: acceptance routing reaches repair, approval, or final regression", async () => {
  const { applyAcceptanceReviewResult } = await loadAcceptanceModule();
  const cases = [
    {
      artifact: artifact([judgment("R1", "notMet"), judgment("R2")]),
      expected: { "impl-triage": "in_progress", "acceptance-decision": "pending", "final-regression": "pending" },
    },
    {
      artifact: artifact([
        judgment("R1", "notVerifiable", { missingEvidence: ["External proof is unavailable."] }),
        judgment("R2"),
      ]),
      expected: { "impl-triage": "done", "acceptance-decision": "in_progress", "final-regression": "pending" },
    },
    {
      artifact: artifact([judgment("R1"), judgment("R2")]),
      expected: { "impl-triage": "done", "acceptance-decision": "done", "final-regression": "in_progress" },
    },
    {
      artifact: artifact([judgment("R1"), judgment("R2")], {
        mechanicalBlockers: [{ blockerId: "M-1", kind: "missing_artifact", summary: "Evidence missing." }],
      }),
      expected: {
        "acceptance-review": "in_progress",
        "impl-triage": "done",
        "impl-repair": "done",
        "acceptance-decision": "pending",
        "final-regression": "pending",
      },
    },
  ];

  for (const item of cases) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-semantic-acceptance-"));
    try {
      const { flowManager, state } = setupFlow(tmp);
      item.artifact.repairFingerprint = await fingerprintFor(tmp, state);
      applyAcceptanceReviewResult({ root: tmp, flowManager, artifact: item.artifact });
      for (const [stepId, status] of Object.entries(item.expected)) {
        assert.equal(findStepById(state.steps, stepId).status, status, `${stepId} route`);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
});

test("R6: notVerifiable decision is approval-required and has no implicit unsafe choice", async () => {
  const { applyAcceptanceDecision, applyAcceptanceReviewResult } = await loadAcceptanceModule();
  const node = getFlowNode("acceptance-decision");
  assert.ok(node);
  assert.equal(node.requiresApproval, true);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-acceptance-decision-"));
  try {
    const { flowManager } = setupFlow(tmp);
    const review = artifact([
      judgment("R1", "notVerifiable", { missingEvidence: ["External proof is unavailable."] }),
      judgment("R2"),
    ]);
    review.repairFingerprint = await fingerprintFor(tmp, flowManager.load());
    applyAcceptanceReviewResult({ root: tmp, flowManager, artifact: review });
    assert.throws(() => applyAcceptanceDecision({ root: tmp, flowManager, choice: undefined }), /choice|invalid/i);
    assert.throws(() => applyAcceptanceDecision({ root: tmp, flowManager, choice: "" }), /choice|invalid/i);
    const aborted = applyAcceptanceDecision({ root: tmp, flowManager, choice: "abort" });
    assert.equal(aborted.choice, "abort");
    assert.equal(flowManager.load().acceptanceReview.status, "aborted");
    assert.equal(findStepById(flowManager.load().steps, "final-regression").status, "pending");
    const next = new GetNextActionCommand().execute({ flowState: flowManager.load() });
    assert.equal(next.action, "aborted");
    assert.equal(next.step, null);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
