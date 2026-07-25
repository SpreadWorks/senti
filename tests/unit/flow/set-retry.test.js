import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import SetRetryCommand from "../../../src/flow/lib/set-retry.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/impl-repair-artifacts.js";
import { resolveCurrentReviewTreeSha } from "../../../src/flow/lib/review-evidence-store.js";
import { buildCurrentRecoveryFingerprint, persistRecoveryBaseline } from "../../../src/flow/lib/retry-recovery.js";
import { moveFlowToStep, makeFlowManager, makeFlowState } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeTmpDir(root);
});

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function initializeRepository(root) {
  git(root, ["init", "--initial-branch=main"]);
  git(root, ["config", "user.email", "tests@example.invalid"]);
  git(root, ["config", "user.name", "Senti tests"]);
  fs.mkdirSync(path.join(root, "specs", "001-retry", "tests"), { recursive: true });
  fs.writeFileSync(path.join(root, "specs", "001-retry", "spec.json"), "{}\n");
  fs.writeFileSync(path.join(root, "specs", "001-retry", "tests", "retry.test.mjs"), "export const version = 1;\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "initial fixture"]);
}

test("review retry reset accepts an uncommitted target-state change without a new tree", () => {
  const root = createTmpDir("set-retry-worktree-identity-");
  roots.push(root);
  initializeRepository(root);

  const state = moveFlowToStep(makeFlowState({
    spec: "specs/001-retry/spec.json",
    runId: "retry-target-state",
    metrics: Array.from({ length: 5 }, () => ({
      phase: "test",
      counter: "reviewRetry",
      delta: 1,
      taskId: null,
    })),
  }), "test-review");
  const treeSha = resolveCurrentReviewTreeSha(root);
  const targetState = buildRepairFingerprint({ root, specPath: state.spec, state });
  const targetStateDigest = targetState.hash;
  state.reviewConvergence = {
    version: 1,
    records: [{
      phase: "test",
      taskId: null,
      treeSha,
      semanticAttempts: 5,
      semanticMaxAttempts: 5,
      toolingAttempts: 0,
      toolingMaxAttempts: 1,
      evidence: { evidenceId: "a".repeat(64), disposition: "REJECTED" },
      finalizedEvidenceAvailable: true,
      handoffFindings: [],
      blocker: null,
      toolingOutcome: null,
      targetStateDigest,
      targetState: {
        digest: targetState.hash,
        entries: targetState.entries,
      },
    }],
  };
  persistRecoveryBaseline(state, {
    kind: "review",
    phase: "test",
    fingerprint: buildCurrentRecoveryFingerprint({
      root,
      flowState: state,
      kind: "review",
      canonicalPhase: "test",
      baseline: null,
    }),
    createdAt: "2026-07-25T00:00:00.000Z",
  });
  const flowManager = makeFlowManager(root);
  flowManager.create(state);

  fs.writeFileSync(path.join(root, "specs", "001-retry", "tests", "retry.test.mjs"), "export const version = 2;\n");

  const command = new SetRetryCommand();
  const result = command.execute({
    action: "reset",
    kind: "review",
    phase: "test",
    reason: "The target test was corrected after the rejected review.",
    yes: true,
    root,
    flowState: flowManager.load(),
    flowManager,
  });

  assert.equal(result.reset, true, JSON.stringify(result));
  const recovered = flowManager.load().reviewConvergence.records[0];
  assert.equal(recovered.treeSha, treeSha);
  assert.notEqual(recovered.targetStateDigest, targetStateDigest);
  assert.equal(recovered.semanticAttempts, 4);

  const unchanged = command.execute({
    action: "reset",
    kind: "review",
    phase: "test",
    reason: "The target test was corrected after the rejected review.",
    yes: true,
    root,
    flowState: flowManager.load(),
    flowManager,
  });
  assert.equal(unchanged.ok, false);
  assert.equal(unchanged.errors[0].code, "REVIEW_IDENTITY_UNCHANGED");

  fs.writeFileSync(path.join(root, "unrelated.js"), "export const unrelated = true;\n");
  const unrelated = command.execute({
    action: "reset",
    kind: "review",
    phase: "test",
    reason: "The target test was corrected after the rejected review.",
    yes: true,
    root,
    flowState: flowManager.load(),
    flowManager,
  });
  assert.equal(unrelated.ok, false);
  assert.equal(unrelated.errors[0].code, "REVIEW_IDENTITY_UNCHANGED");
});
