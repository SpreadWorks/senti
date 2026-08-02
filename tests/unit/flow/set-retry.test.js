import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import SetRetryCommand from "../../../src/flow/lib/set-retry.js";
import { RunReviewCommand } from "../../../src/flow/lib/run-review.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/impl-repair-artifacts.js";
import { resolveCurrentReviewTreeSha } from "../../../src/flow/lib/review-evidence-store.js";
import { buildCurrentRecoveryFingerprint, persistRecoveryBaseline } from "../../../src/flow/lib/retry-recovery.js";
import { moveFlowToStep, makeFlowManager, makeFlowState } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const roots = [];
const SPEC_PATH = "specs/001-retry/spec.json";

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

function initializeRepositoryWithUntrackedSpec(root) {
  git(root, ["init", "--initial-branch=main"]);
  git(root, ["config", "user.email", "tests@example.invalid"]);
  git(root, ["config", "user.name", "Senti tests"]);
  fs.writeFileSync(path.join(root, "tracked.js"), "export const tracked = true;\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "initial fixture"]);
  fs.mkdirSync(path.join(root, "specs", "001-retry"), { recursive: true });
  fs.writeFileSync(path.join(root, "specs", "001-retry", "spec.json"), '{"revision":1}\n');
}

test("review retry reset includes an uncommitted target-state change in review identity", async () => {
  const root = createTmpDir("set-retry-worktree-identity-");
  roots.push(root);
  initializeRepository(root);

  const state = moveFlowToStep(makeFlowState({
    specId: "001-retry",
    runId: "retry-target-state",
    metrics: Array.from({ length: 5 }, () => ({
      phase: "test",
      counter: "reviewRetry",
      delta: 1,
      taskId: null,
    })),
  }), "test-review");
  const treeSha = resolveCurrentReviewTreeSha(root, SPEC_PATH);
  const targetState = buildRepairFingerprint({ root, specPath: SPEC_PATH, state });
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
  git(root, ["add", "specs/001-retry/flow.json"]);
  git(root, ["commit", "-m", "track flow state"]);

  fs.writeFileSync(path.join(root, "specs", "001-retry", "tests", "retry.test.mjs"), "export const version = 2;\n");
  const changedTreeSha = resolveCurrentReviewTreeSha(root, SPEC_PATH);
  assert.notEqual(changedTreeSha, treeSha);

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
  assert.equal(recovered.treeSha, changedTreeSha);
  assert.notEqual(recovered.targetStateDigest, targetStateDigest);
  assert.equal(recovered.semanticAttempts, 4);

  const review = new RunReviewCommand({
    finalizeResult: ({ parse }) => parse(),
    runCommand() {
      const flowPath = path.join(root, "specs", "001-retry", "flow.json");
      const persisted = JSON.parse(fs.readFileSync(flowPath, "utf8"));
      fs.writeFileSync(flowPath, `${JSON.stringify({
        ...persisted,
        agentTelemetry: { calls: 1 },
      }, null, 2)}\n`);
      return {
        ok: true,
        status: 0,
        stdout: "Test review PASS. No blocking test issues found.",
        stderr: "[test-review] verdict=PASS blocking=0 advisory=0",
        signal: null,
        killed: false,
      };
    },
  });
  const reviewResult = await review.execute({
    root,
    phase: "test",
    config: { agent: {} },
    flowState: { ...flowManager.load(), metrics: [] },
  });
  assert.equal(reviewResult.result, "ok", JSON.stringify(reviewResult));

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

test("review retry reset accepts a changed canonical digest when the exhausted record has no target-state entries", () => {
  const root = createTmpDir("set-retry-legacy-tooling-identity-");
  roots.push(root);
  initializeRepositoryWithUntrackedSpec(root);

  const state = moveFlowToStep(makeFlowState({
    specId: "001-retry",
    runId: "retry-tooling-target-state",
    metrics: Array.from({ length: 4 }, () => ({
      phase: "spec",
      counter: "reviewRetry",
      delta: 1,
      taskId: null,
    })),
  }), "spec-review");
  const treeSha = resolveCurrentReviewTreeSha(root, SPEC_PATH);
  const targetState = buildRepairFingerprint({ root, specPath: SPEC_PATH, state });
  state.reviewConvergence = {
    version: 1,
    records: [{
      phase: "spec",
      taskId: null,
      treeSha,
      semanticAttempts: 0,
      semanticMaxAttempts: 4,
      toolingAttempts: 1,
      toolingMaxAttempts: 1,
      evidence: null,
      finalizedEvidenceAvailable: false,
      handoffFindings: [],
      blocker: { kind: "tooling_attempts_exhausted", reason: "provider-error" },
      toolingOutcome: {
        kind: "TOOLING_ERROR",
        stage: "communication",
        attempt: 2,
        maxAttempts: 2,
        remainingAttempts: 0,
        reason: "provider-error",
        permissionRelated: false,
      },
      provider: "independent-reviewer",
      targetStateDigest: targetState.hash,
    }],
  };
  persistRecoveryBaseline(state, {
    kind: "review",
    phase: "spec",
    fingerprint: buildCurrentRecoveryFingerprint({
      root,
      flowState: state,
      kind: "review",
      canonicalPhase: "spec",
      baseline: null,
    }),
    createdAt: "2026-07-31T00:00:00.000Z",
  });
  const flowManager = makeFlowManager(root);
  flowManager.create(state);

  fs.writeFileSync(path.join(root, SPEC_PATH), '{"revision":2}\n');
  const nextTreeSha = resolveCurrentReviewTreeSha(root, SPEC_PATH);
  const nextTargetState = buildRepairFingerprint({
    root,
    specPath: SPEC_PATH,
    state: flowManager.load(),
  });
  assert.equal(nextTreeSha, treeSha);
  assert.notEqual(nextTargetState.hash, targetState.hash);

  const result = new SetRetryCommand().execute({
    action: "reset",
    kind: "review",
    phase: "spec",
    reason: "Canonical spec input changed after the provider tooling failure.",
    yes: true,
    root,
    flowState: flowManager.load(),
    flowManager,
  });

  assert.equal(result.reset, true, JSON.stringify(result));
  const recovered = flowManager.load().reviewConvergence.records[0];
  assert.equal(recovered.treeSha, treeSha);
  assert.equal(recovered.targetStateDigest, nextTargetState.hash);
  assert.equal(recovered.toolingAttempts, 0);
});
