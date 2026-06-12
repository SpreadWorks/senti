// spec: R4 R14
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { join } from "node:path";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";

const CLI = join(process.cwd(), "src/senti.js");

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

function validPassArtifact() {
  return {
    version: 1,
    goalSatisfactionScore: 1,
    requirementAlignmentScore: 1,
    implementationQualityScore: 1,
    acceptanceScore: 1,
    thresholds: {
      goalSatisfactionPass: 0.9,
      requirementAlignmentPass: 0.9,
      implementationQualityPass: 0.8,
    },
    mechanicalBlockers: [],
    hardBlockers: [],
    attempt: 1,
    findings: [],
    requirementAmendmentProposals: [],
    userDecision: null,
    blockedDecision: null,
    verdict: "pass",
  };
}

function setupAcceptanceReviewFlow(tmp, options = {}) {
  const specId = "001-test";
  const specDir = join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(join(specDir, "spec.json"), JSON.stringify({ requirements: [] }, null, 2));
  if (options.artifact) {
    fs.writeFileSync(join(specDir, "acceptance-review.json"), JSON.stringify(options.artifact, null, 2));
  }
  const state = {
    spec: `specs/${specId}/spec.json`,
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
    acceptanceReview: options.artifact ? {
      verdict: options.artifact.verdict,
      artifactPath: `specs/${specId}/acceptance-review.json`,
    } : undefined,
  };
  for (const step of state.steps.flatMap((entry) => entry.children || [entry])) {
    step.status = "pending";
  }
  const retro = findStepById(state.steps, "retro");
  const acceptance = findStepById(state.steps, "acceptance-review");
  assert.ok(retro, "retro fixture step exists");
  assert.ok(acceptance, "acceptance-review fixture step exists");
  retro.status = "done";
  acceptance.status = "in_progress";

  const fm = makeFlowManager(tmp);
  fm.save(state);
  fm.addActiveFlow(specId, "local");
}

describe("acceptance-review next-action contract", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R4: next-action exposes the public snake_case acceptance-review envelope", () => {
    tmp = createTmpDir();
    setupAcceptanceReviewFlow(tmp);

    const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
    assert.equal(exitCode, 0);
    assert.equal(envelope.ok, true);
    const keys = Object.keys(envelope.data).sort();
    const requiredKeys = [
      "action",
      "context",
      "instructions",
      "maxAttempts",
      "output_schema",
      "requires_approval",
      "step",
      "taskId",
    ];
    for (const key of requiredKeys) {
      assert.equal(keys.includes(key), true, `${key} field must be present`);
    }
    assert.deepEqual(keys.filter((key) => !requiredKeys.includes(key)), envelope.data.failurePolicy === undefined ? [] : ["failurePolicy"]);
    assert.equal(envelope.data.step, "acceptance-review");
    assert.equal(envelope.data.action, "run-acceptance-review");
    assert.equal(envelope.data.requires_approval, false);
    assert.equal(envelope.data.maxAttempts, 1);
    assert.ok(envelope.data.output_schema, "output_schema is present");
    if (envelope.data.failurePolicy !== undefined) {
      assert.equal(envelope.data.failurePolicy, "amend-spec");
    }
  });

  it("R14: acceptance-review next-action includes the evidence context needed before final-regression", () => {
    tmp = createTmpDir();
    setupAcceptanceReviewFlow(tmp);

    const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
    assert.equal(envelope.data.context.kinds.includes("spec"), true);
    assert.equal(envelope.data.context.kinds.includes("test"), true);
    assert.equal(envelope.data.context.kinds.includes("diff"), true);
    assert.equal(envelope.data.context.kinds.includes("retro"), true);
    assert.equal(envelope.data.context.kinds.includes("report"), true);
  });

  it("R14: passing acceptance-review promotes final-regression as the next mechanical check", () => {
    tmp = createTmpDir();
    setupAcceptanceReviewFlow(tmp, { artifact: validPassArtifact() });

    const completion = runCli(tmp, ["flow", "set", "step", "acceptance-review", "done"]);
    assert.equal(completion.exitCode, 0);
    assert.equal(completion.envelope.ok, true);

    const state = makeFlowManager(tmp).load();
    assert.equal(findStepById(state.steps, "acceptance-review").status, "done");
    assert.equal(findStepById(state.steps, "final-regression").status, "in_progress");

    const next = runCli(tmp, ["flow", "get", "next-action"]);
    assert.equal(next.exitCode, 0);
    assert.equal(next.envelope.ok, true);
    assert.equal(next.envelope.data.step, "final-regression");
    assert.equal(next.envelope.data.action, "run-final-regression");
  });
});
