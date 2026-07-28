import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";
import { makeFlowState, replaceFlowState, setupFlow, setupFlowAtStep } from "../../../helpers/flow-setup.js";
import { flattenSteps } from "../../../../src/flow/lib/step-tree.js";
import { resolveCurrentReviewTreeSha } from "../../../../src/flow/lib/review-evidence-store.js";

const SENTI = path.resolve("src/senti.js");

function invoke(root, args) {
  const result = spawnSync(process.execPath, [SENTI, "flow", "get", "final-response-guard", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
  return { ...result, envelope: JSON.parse(result.stdout) };
}

function initGitRepo(root) {
  const git = (args) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git(["init", "--quiet", "--initial-branch=main"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test User"]);
  fs.writeFileSync(path.join(root, "README.md"), "baseline\n");
  git(["add", "README.md"]);
  git(["commit", "--quiet", "-m", "initial"]);
}

describe("flow final-response guard CLI", () => {
  let root;
  afterEach(() => root && removeTmpDir(root));

  it("rejects an agent final attempt while an active Flow has normal work", () => {
    root = createTmpDir("senti-final-response-guard-");
    const state = setupFlowAtStep(root, "draft");

    const result = invoke(root, ["--expect-run-id", state.runId, "--expect-spec", state.spec]);

    assert.notEqual(result.status, 0);
    assert.equal(result.envelope.errors[0].code, "FLOW_CONTINUATION_REQUIRED");
    assert.equal(result.envelope.data.finalResponse.allowed, false);
    assert.equal(result.envelope.data.finalResponse.directive.kind, "execute_step");
  });

  it("requires rejected review repair, then refreshes into re-review after changed evidence", () => {
    root = createTmpDir("senti-final-response-review-");
    initGitRepo(root);
    const state = setupFlowAtStep(root, "test-review");
    state.reviewConvergence = {
      version: 1,
      records: [{
        phase: "test",
        taskId: null,
        treeSha: resolveCurrentReviewTreeSha(root, state.spec),
        semanticAttempts: 0,
        semanticMaxAttempts: 4,
        toolingAttempts: 0,
        toolingMaxAttempts: 1,
        evidence: { evidenceId: "rejected-test-review", disposition: "REJECTED" },
        finalizedEvidenceAvailable: false,
        handoffFindings: [],
        blocker: null,
        toolingOutcome: null,
      }],
    };
    replaceFlowState(root, state);

    const beforeRepair = invoke(root, ["--expect-run-id", state.runId, "--expect-spec", state.spec]);
    assert.notEqual(beforeRepair.status, 0);
    assert.equal(beforeRepair.envelope.errors[0].code, "FLOW_CONTINUATION_REQUIRED");
    assert.equal(beforeRepair.envelope.data.finalResponse.directive.kind, "repair_evidence");

    fs.appendFileSync(path.join(root, "README.md"), "repair evidence\n");
    const afterChangedEvidence = invoke(root, ["--expect-run-id", state.runId, "--expect-spec", state.spec]);
    assert.notEqual(afterChangedEvidence.status, 0);
    assert.equal(afterChangedEvidence.envelope.errors[0].code, "FLOW_CONTINUATION_REQUIRED");
    assert.deepEqual(afterChangedEvidence.envelope.data.finalResponse.directive, {
      kind: "execute_step",
      terminal: false,
      requiresUserAction: false,
      action: "run-review",
    });
  });

  it("permits final output after completion and after a true target mismatch", () => {
    root = createTmpDir("senti-final-response-terminal-");
    const state = makeFlowState();
    for (const step of flattenSteps(state.steps)) step.status = "done";
    setupFlow(root, state);

    const completed = invoke(root, ["--expect-run-id", state.runId, "--expect-spec", state.spec]);
    assert.equal(completed.status, 0, completed.stderr);
    assert.equal(completed.envelope.data.finalResponse.allowed, true);
    assert.equal(completed.envelope.data.finalResponse.reason, "completed");

    const mismatch = invoke(root, ["--expect-run-id", "different-run", "--expect-spec", state.spec]);
    assert.equal(mismatch.status, 0, mismatch.stderr);
    assert.equal(mismatch.envelope.data.finalResponse.allowed, true);
    assert.equal(mismatch.envelope.data.finalResponse.reason, "target_mismatch");
  });
});
