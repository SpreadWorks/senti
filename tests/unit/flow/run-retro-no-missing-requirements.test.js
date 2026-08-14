/**
 * `retro` aggregates producer-owned test Attempt artifacts.  These scenarios
 * use the Version Store publication boundary rather than reconstructing a
 * root spec/result tree.
 */

// spec: R5 R52
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { RunRetroCommand } from "../../../src/flow/lib/run-retro.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/repair-fingerprint.js";
import { attachCanonicalCommandResultArtifact } from "../../../src/flow/lib/canonical-command-result.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { FlowAtStepFixture, makeFlowManager } from "../../helpers/flow-setup.js";

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "retro-req-"));
  execFileSync("git", ["init", root], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "config", "user.email", "t@t.t"], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "config", "user.name", "t"], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "commit", "--allow-empty", "-m", "init"], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "checkout", "-b", "main"], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "checkout", "-b", "feature/001-test"], { stdio: "ignore" });
  fs.writeFileSync(path.join(root, "change.txt"), "hello\n");
  execFileSync("git", ["-C", root, "add", "."], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "commit", "-m", "change"], { stdio: "ignore" });
  return root;
}

function executionArtifact({ repairFingerprint = undefined } = {}) {
  return {
    version: "2",
    raw_output_path: "test-execute.raw-log",
    summary: [{
      id: "R1",
      result: "pass",
      evidence: {
        test_file: "f.test.js",
        test_name: "R1: works",
        command: "node --test",
        raw_output_lines: { start_line: 1, end_line: 1 },
      },
    }],
    regression: {
      required: false,
      result: "skipped",
      mode: "none",
      changed_files: [],
      trigger_relevant_changed_files: [],
      category: "spec-artifact-only",
      reason: "unit fixture",
      classified_paths: [],
    },
    ...(repairFingerprint === undefined ? {} : { repairFingerprint }),
  };
}

function reviewArtifact({ repairFingerprint = undefined } = {}) {
  return {
    verdict: "pass",
    checked_items: [{ check: "project_regression_verification", result: "pass" }],
    result_file_path: "test-execute-result.json",
    raw_output_path: "test-execute.raw-log",
    ...(repairFingerprint === undefined ? {} : { repairFingerprint }),
  };
}

function publishAttemptResult(flowManager, specId, logicalKey, payload) {
  flowManager.publishCurrentAttemptResult({
    specId,
    commandResult: attachCanonicalCommandResultArtifact({ result: "ok" }, { logicalKey, payload }),
  });
}

function createRetroContext(root, {
  includeExecution = true,
  includeReview = true,
  repairFingerprint = undefined,
} = {}) {
  const specId = "001-test";
  const flowManager = makeFlowManager(root);
  const fixture = new FlowAtStepFixture({
    flowManager,
    specId,
    runId: "run-retro-test",
    request: "Aggregate canonical test evidence.",
    execution: { mode: "branch", baseBranch: "main", featureBranch: "feature/001-test" },
    specRecord: {
      goal: "retro fixture",
      requirements: [{ id: "R1", desc: "first", priority: "must", status: "pending" }],
    },
    targetStep: "test-execute",
  }).create();
  if (includeExecution) {
    publishAttemptResult(flowManager, specId, "test.execute", executionArtifact({ repairFingerprint }));
  }
  flowManager.updateStepStatus({ stepId: "test-execute", requestedStatus: "done" }, { specId });
  flowManager.updateStepStatus({ stepId: "test-result-review", requestedStatus: "in_progress" }, { specId });
  if (includeReview) {
    publishAttemptResult(flowManager, specId, "test.result.review", reviewArtifact({ repairFingerprint }));
  }
  flowManager.updateStepStatus({ stepId: "test-result-review", requestedStatus: "done" }, { specId });
  // Retro is separated from test review by definition-owned leaves.  The
  // fixture settles those predecessors through normal typed Attempts.
  fixture.flow.flow.activate("retro");
  return {
    specId,
    flowManager,
    location: fixture.location(),
    context: {
      root,
      mainRoot: root,
      executionRoot: root,
      flowManager,
      flowState: flowManager.loadReadOnly(specId),
    },
  };
}

describe("R5: retro consumes canonical test Attempt results (spec 251)", () => {
  let root;
  afterEach(() => root && fs.rmSync(root, { recursive: true, force: true }));

  it("R5: dry-run retro aggregates pass/fail per requirement when producer artifacts exist", async () => {
    root = createRepo();
    const { context } = createRetroContext(root);

    const out = await new RunRetroCommand().execute({ ...context, dryRun: true });

    assert.equal(out.result, "dry-run", JSON.stringify(out));
    assert.equal(out.artifacts.summary.total, 1);
    assert.equal(out.artifacts.summary.done, 1);
    assert.match(out.artifacts.spec, /^specs\/001-test\/001\/spec\.json$/);
  });

  it("R5: returns Envelope.fail when the canonical test-execute result is missing", async () => {
    root = createRepo();
    const { context } = createRetroContext(root, { includeExecution: false });

    const result = await new RunRetroCommand().execute({ ...context, dryRun: true });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "TEST_EXECUTE_RESULT_MISSING");
    assert.match(result.errors[0].messages.join(" "), /test-execute canonical artifact is absent/i);
  });

  it("rewinds stale post-gate evidence to test-execute through one canonical recovery Activity", async () => {
    root = createRepo();
    const previousFingerprint = "a".repeat(64);
    const { context, flowManager, specId, location } = createRetroContext(root, { repairFingerprint: previousFingerprint });
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "post-gate-repair.js"), "export const repaired = true;\n");
    const currentFingerprint = buildRepairFingerprint({
      root,
      specPath: location.relativeSpecFile,
    }).hash;

    const result = await new RunRetroCommand().execute(context);
    const recoveredState = flowManager.loadReadOnly(specId);

    assert.equal(result.result, "recovered");
    assert.equal(result.next, "test-execute");
    assert.equal(result.artifacts.evidenceRefresh.recovered, true);
    assert.equal(result.artifacts.evidenceRefresh.previousFingerprint, previousFingerprint);
    assert.equal(result.artifacts.evidenceRefresh.currentFingerprint, currentFingerprint);
    assert.equal(findStepById(recoveredState.steps, "test-execute").status, "in_progress");
    assert.equal(findStepById(recoveredState.steps, "retro").status, "invalidated");
    assert.equal(flowManager.activityLedger(specId).at(-1).transition.operation, "rewind_test_evidence");
    assert.equal(fs.existsSync(path.join(root, "specs", specId, "test-execute-result.json")), false);
    assert.equal(fs.existsSync(path.join(root, "specs", specId, "test-result-review.json")), false);
  });
});
