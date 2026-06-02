// spec: R1 R2 R3 R4 R5 R6 R7 R8
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT_MODULE = path.join(ROOT, "src", "flow", "lib", "flow-judgment-contract.js");

async function loadContractModule() {
  assert.equal(
    fs.existsSync(CONTRACT_MODULE),
    true,
    "src/flow/lib/flow-judgment-contract.js must exist",
  );
  return import(pathToFileURL(CONTRACT_MODULE).href);
}

function passContract(overrides = {}) {
  return {
    targetStep: "test-review",
    artifactPath: "specs/271-flow-judgment-contract/test-review.json",
    verdict: "PASS",
    blockingFindings: [],
    failureKind: null,
    nextAction: "implement",
    rawArtifactPath: "specs/271-flow-judgment-contract/test-review.md",
    inputFingerprint: "input-a",
    artifactFingerprint: "artifact-a",
    ...overrides,
  };
}

function blockingFinding(overrides = {}) {
  return {
    id: "finding-1",
    title: "Missing contract evidence",
    target: "impl-gate",
    severity: "blocking",
    ...overrides,
  };
}

function validOverride(overrides = {}) {
  return {
    stepId: "test-review",
    userApproval: true,
    reason: "User approved transferring this finding to implementation gate.",
    approvedAt: "2026-06-02T00:00:00.000Z",
    approvedBy: "user",
    findings: [
      {
        findingId: "finding-1",
        disposition: "transferred_to_successor",
        successorOwner: "impl-gate",
        acceptedRisk: "Implementation gate owns the transferred verification.",
      },
    ],
    ...overrides,
  };
}

describe("flow judgment contract", () => {
  it("R1: rejects a judgment contract with missing required fields", async () => {
    const { FlowJudgmentContract } = await loadContractModule();

    assert.throws(
      () => new FlowJudgmentContract({
        artifactPath: "specs/271-flow-judgment-contract/test-review.json",
        verdict: "PASS",
      }),
      /targetStep/,
    );
  });

  it("R2: applies target-step normal completion policies", async () => {
    const { FlowJudgmentContract, StepCompletionPolicy } = await loadContractModule();

    const testReview = new FlowJudgmentContract(passContract({
      targetStep: "test-review",
      verdict: "ADVISORY",
      blockingFindings: [],
    }));
    assert.equal(StepCompletionPolicy.forStep("test-review").allowsNormal(testReview), true);

    const finalRegression = new FlowJudgmentContract(passContract({
      targetStep: "final-regression",
      artifactPath: "specs/271-flow-judgment-contract/final-regression-result.json",
      verdict: "pass",
      failureKind: null,
      nextAction: "finalize-commit",
    }));
    assert.equal(StepCompletionPolicy.forStep("final-regression").allowsNormal(finalRegression), true);

    const invalidFinalRegression = new FlowJudgmentContract(passContract({
      targetStep: "final-regression",
      artifactPath: "specs/271-flow-judgment-contract/final-regression-result.json",
      verdict: "pass",
      failureKind: "infra_failure",
      nextAction: "finalize-commit",
    }));
    assert.equal(StepCompletionPolicy.forStep("final-regression").allowsNormal(invalidFinalRegression), false);
  });

  it("R3: validates override evidence and finding dispositions", async () => {
    const { OverrideCompletionEvidence } = await loadContractModule();

    const override = new OverrideCompletionEvidence(validOverride());
    assert.equal(override.stepId, "test-review");
    assert.equal(override.findings[0].disposition, "transferred_to_successor");

    assert.throws(
      () => new OverrideCompletionEvidence(validOverride({
        findings: [{ findingId: "finding-1", disposition: "ignored" }],
      })),
      /disposition/,
    );
  });

  it("R4: classifies non-normal completion without override as inconsistent", async () => {
    const { CompletionValidator, FlowJudgmentContract, StepCompletionPolicy } = await loadContractModule();

    const contract = new FlowJudgmentContract(passContract({
      verdict: "FAIL",
      blockingFindings: [blockingFinding()],
    }));
    const result = new CompletionValidator(StepCompletionPolicy.defaultPolicies()).validate({
      contract,
      requestedStatus: "done",
      overrideEvidence: null,
    });

    assert.equal(result.kind, "inconsistent");
    assert.match(result.reason, /override/i);
  });

  it("R5: exposes validation failure details without approving step persistence", async () => {
    const { buildCompletionValidationEnvelope, FlowJudgmentContract, StepCompletionPolicy } = await loadContractModule();

    const contract = new FlowJudgmentContract(passContract({
      targetStep: "impl-gate",
      verdict: "fail",
      blockingFindings: [blockingFinding({ target: "impl-gate" })],
    }));
    const envelope = buildCompletionValidationEnvelope({
      contract,
      policy: StepCompletionPolicy.forStep("impl-gate"),
      overridePath: "specs/271-flow-judgment-contract/completion-overrides.json",
    });

    assert.equal(envelope.ok, false);
    assert.equal(envelope.data.completionValidation.stepId, "impl-gate");
    assert.equal(envelope.data.completionValidation.result, "inconsistent");
    assert.equal(envelope.data.completionValidation.artifactPath, contract.artifactPath);
    assert.equal(envelope.data.completionValidation.overridePath, "specs/271-flow-judgment-contract/completion-overrides.json");
  });

  it("R6: converts target artifacts to contract summaries while preserving existing fields", async () => {
    const {
      contractFromFinalRegressionArtifact,
      contractFromGateArtifact,
      contractFromTestResultReviewArtifact,
    } = await loadContractModule();

    const finalRegression = {
      version: "1",
      completed: true,
      result: "pass",
      command: "node tests/run.js",
      rawOutputPath: "specs/271-flow-judgment-contract/tests/.raw/final-regression-attempt-001.log",
      rawOutputLines: { start_line: 1, end_line: 2 },
      failureKind: null,
      retryable: false,
      nextAction: "finalize-commit",
      changedFiles: [],
      process: { exitCode: 0, signal: null, timedOut: false },
    };
    assert.equal(contractFromFinalRegressionArtifact(finalRegression).summary.targetStep, "final-regression");

    const testResultReview = {
      verdict: "pass",
      checked_items: [{ check: "schema", result: "pass", detail: "valid" }],
      result_file_path: "specs/271-flow-judgment-contract/test-execute-result.json",
      raw_output_path: "specs/271-flow-judgment-contract/tests/.raw/test-execution.log",
    };
    assert.equal(contractFromTestResultReviewArtifact(testResultReview).summary.targetStep, "test-result-review");

    const gate = {
      verdict: "pass",
      issues: [],
      nextAction: { diagnosis: { observations: [] } },
      contractSummary: null,
    };
    assert.equal(contractFromGateArtifact(gate, { phase: "integration" }).summary.targetStep, "impl-gate");
  });

  it("R7: changes progress signatures when input or artifact fingerprints change", async () => {
    const { FlowJudgmentContract, progressSignature } = await loadContractModule();

    const base = new FlowJudgmentContract(passContract());
    const same = new FlowJudgmentContract(passContract());
    const changedInput = new FlowJudgmentContract(passContract({ inputFingerprint: "input-b" }));
    const changedArtifact = new FlowJudgmentContract(passContract({ artifactFingerprint: "artifact-b" }));

    assert.equal(progressSignature(base), progressSignature(same));
    assert.notEqual(progressSignature(base), progressSignature(changedInput));
    assert.notEqual(progressSignature(base), progressSignature(changedArtifact));
  });

  it("R8: supports valid override evidence for non-normal artifacts", async () => {
    const {
      CompletionValidator,
      FlowJudgmentContract,
      OverrideCompletionEvidence,
      StepCompletionPolicy,
    } = await loadContractModule();

    const contract = new FlowJudgmentContract(passContract({
      verdict: "FAIL",
      blockingFindings: [blockingFinding()],
    }));
    const result = new CompletionValidator(StepCompletionPolicy.defaultPolicies()).validate({
      contract,
      requestedStatus: "done",
      overrideEvidence: new OverrideCompletionEvidence(validOverride()),
    });

    assert.equal(result.kind, "override");
    assert.equal(result.override.findings[0].successorOwner, "impl-gate");
  });
});
