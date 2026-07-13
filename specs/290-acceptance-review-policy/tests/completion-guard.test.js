// spec: R15
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { StepCompletionPolicy } from "../../../src/flow/lib/flow-judgment-contract.js";
import { resolveLifecycle } from "../../../src/flow/definition.js";

const CLI = join(process.cwd(), "src/senti.js");
const ACCEPTANCE_ARTIFACTS_MODULE = join(process.cwd(), "src/flow/lib/acceptance-review-artifacts.js");

function runCli(tmp, args) {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });
    return { envelope: JSON.parse(stdout), exitCode: 0 };
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    return { envelope: stdout ? JSON.parse(stdout) : null, exitCode: err.status || 1 };
  }
}

async function loadAcceptanceArtifacts() {
  assert.equal(fs.existsSync(ACCEPTANCE_ARTIFACTS_MODULE), true, "acceptance-review artifact helpers must exist");
  return import(pathToFileURL(ACCEPTANCE_ARTIFACTS_MODULE).href);
}

function acceptanceArtifact(verdict, overrides = {}) {
  return {
    version: 1,
    goalSatisfactionScore: verdict === "pass" ? 1 : 0.4,
    requirementAlignmentScore: 1,
    implementationQualityScore: 1,
    acceptanceScore: verdict === "pass" ? 1 : 0.8,
    thresholds: {
      goalSatisfactionPass: 0.9,
      requirementAlignmentPass: 0.9,
      implementationQualityPass: 0.8,
    },
    mechanicalBlockers: verdict === "blocked"
      ? [{ blockerId: "M-1", kind: "missing_tests", summary: "Tests missing." }]
      : [],
    hardBlockers: [],
    attempt: 1,
    findings: [],
    requirementAmendmentProposals: [],
    userDecision: null,
    blockedDecision: null,
    verdict,
    ...overrides,
  };
}

function setupFlow(tmp, stateOverrides = {}, artifact = null) {
  const specId = "001-test";
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({ requirements: [] }, null, 2));
  if (artifact) {
    fs.writeFileSync(path.join(specDir, "acceptance-review.json"), JSON.stringify(artifact, null, 2));
  }

  const state = {
    spec: `specs/${specId}/spec.json`,
    runId: `run-${specId}`,
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
    acceptanceReview: artifact ? {
      verdict: artifact.verdict,
      artifactPath: `specs/${specId}/acceptance-review.json`,
    } : undefined,
    ...stateOverrides,
  };
  for (const step of state.steps.flatMap((entry) => entry.children || [entry])) {
    step.status = "pending";
  }
  findStepById(state.steps, "acceptance-review").status = "in_progress";

  const fm = makeFlowManager(tmp);
  fm.create(state);
  fm.addActiveFlow(specId, "local");
}

describe("acceptance-review completion guard", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R15: completion policy rejects missing or unresolved acceptance-review artifacts", () => {
    assert.equal(StepCompletionPolicy.forStep("acceptance-review").allowedVerdicts.includes("pass"), true);
    tmp = createTmpDir();
    setupFlow(tmp);

    const { envelope, exitCode } = runCli(tmp, ["flow", "set", "step", "acceptance-review", "done"]);

    assert.notEqual(exitCode, 0);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.errors[0].code, "STEP_ARTIFACT_VALIDATION_FAILED");
    assert.match(envelope.errors[0].messages.join("\n"), /acceptance-review/i);
  });

  it("R15: unresolved verdict artifacts cannot complete acceptance-review manually", () => {
    for (const verdict of ["blocked", "amend_required", "user_decision_required"]) {
      tmp = createTmpDir();
      setupFlow(tmp, {}, acceptanceArtifact(verdict));

      const { envelope, exitCode } = runCli(tmp, ["flow", "set", "step", "acceptance-review", "done"]);

      assert.notEqual(exitCode, 0, `${verdict} must not complete`);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.errors[0].code, "STEP_ARTIFACT_VALIDATION_FAILED");
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("R15: acceptance-review lifecycle does not promote final-regression for unresolved verdicts", () => {
    for (const verdict of ["blocked", "amend_required", "user_decision_required"]) {
      const actions = resolveLifecycle({
        currentStepId: "acceptance-review",
        command: "run-acceptance-review",
        result: { artifacts: acceptanceArtifact(verdict) },
      });
      assert.equal(
        actions.some((action) => action.step === "final-regression" && action.status === "in_progress"),
        false,
        `${verdict} must not promote final-regression`,
      );
    }
  });

  it("R15: applying unresolved acceptance-review results to saved state does not promote final-regression", async () => {
    const { applyAcceptanceReviewResult } = await loadAcceptanceArtifacts();
    for (const verdict of ["blocked", "amend_required", "user_decision_required"]) {
      tmp = createTmpDir();
      setupFlow(tmp);

      applyAcceptanceReviewResult({
        root: tmp,
        flowManager: makeFlowManager(tmp),
        artifact: acceptanceArtifact(verdict),
      });

      const state = makeFlowManager(tmp).load();
      assert.notEqual(
        findStepById(state.steps, "final-regression").status,
        "in_progress",
        `${verdict} must not promote final-regression`,
      );
      removeTmpDir(tmp);
      tmp = null;
    }
  });
});
