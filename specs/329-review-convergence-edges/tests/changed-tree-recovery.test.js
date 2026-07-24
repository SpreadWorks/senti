// spec: R3 R4 R7
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import * as reviewConvergence from "../../../src/flow/lib/review-convergence.js";
import {
  buildCurrentRecoveryFingerprint,
} from "../../../src/flow/lib/retry-recovery.js";
import {
  checkoutNewBranch,
  commitAll,
  initGitRepo,
} from "../../../tests/helpers/git-repo.js";
import {
  makeFlowManager,
  makeFlowState,
  moveFlowToStep,
  setupFlowConfig,
} from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const previousTreeSha = "1".repeat(40);
const nextTreeSha = "2".repeat(40);
const spec = "specs/329-review-convergence-edges/spec.json";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sentiBin = path.join(repoRoot, "src/senti.js");

function exhaustedFlowState() {
  return {
    runId: "run-review-recovery",
    issue: 453,
    spec,
    reviewConvergence: {
      version: 1,
      records: [{
        phase: "impl",
        taskId: null,
        treeSha: previousTreeSha,
        semanticAttempts: 2,
        semanticMaxAttempts: 4,
        toolingAttempts: 1,
        toolingMaxAttempts: 1,
        evidence: null,
        finalizedEvidenceAvailable: false,
        handoffFindings: [],
        blocker: {
          kind: "tooling_attempts_exhausted",
          reason: "review provider failed",
        },
        toolingOutcome: {
          kind: "TOOLING_ERROR",
          stage: "communication",
          attempt: 2,
          maxAttempts: 2,
          remainingAttempts: 0,
          reason: "review provider failed",
          permissionRelated: false,
        },
        provider: "independent-reviewer",
        targetStateDigest: "3".repeat(64),
      }],
    },
    retryRecovery: { version: 1, entries: [] },
  };
}

function mutation(overrides = {}) {
  assert.equal(
    typeof reviewConvergence.ReviewToolingRecoveryMutation,
    "function",
    "ReviewToolingRecoveryMutation must implement changed-tree recovery",
  );
  const { ReviewToolingRecoveryMutation } = reviewConvergence;
  return new ReviewToolingRecoveryMutation({
    phase: "impl",
    taskId: null,
    previousTreeSha,
    nextTreeSha,
    expectedRunId: "run-review-recovery",
    expectedIssue: 453,
    expectedSpec: spec,
    ...overrides,
  });
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function createRecoveryFixture(t) {
  const root = createTmpDir("changed-tree-recovery-");
  t.after(() => removeTmpDir(root));
  initGitRepo(root);
  setupFlowConfig(root, "en");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, path.dirname(spec)), { recursive: true });
  fs.writeFileSync(path.join(root, "src/product.js"), "export const revision = 1;\n");
  fs.writeFileSync(path.join(root, spec), `${JSON.stringify({ requirements: [] }, null, 2)}\n`);
  commitAll(root, "initial review target");
  checkoutNewBranch(root, "feature/recovery");
  const oldTreeSha = git(root, ["rev-parse", "HEAD^{tree}"]);
  const state = moveFlowToStep(makeFlowState({
    spec,
    runId: "run-review-recovery",
    issue: 453,
    baseBranch: "main",
    featureBranch: "feature/recovery",
    metrics: Array.from({ length: 4 }, () => ({
      phase: "impl",
      counter: "reviewRetry",
      delta: 1,
      taskId: null,
    })),
    reviewConvergence: {
      version: 1,
      records: [{
        ...exhaustedFlowState().reviewConvergence.records[0],
        treeSha: oldTreeSha,
      }],
    },
  }), "impl-review");
  const baseline = buildCurrentRecoveryFingerprint({
    root,
    flowState: state,
    kind: "review",
    canonicalPhase: "impl",
    baseline: null,
  });
  state.reviewRecoveryBaselines = [{
    kind: "review",
    phase: "impl",
    canonicalPhase: "impl",
    fingerprint: baseline.toJSON(),
    createdAt: "2026-07-24T00:00:00.000Z",
  }];
  const flowManager = makeFlowManager(root);
  flowManager.create(state);
  flowManager.addActiveFlow("329-review-convergence-edges", "branch");

  fs.writeFileSync(path.join(root, "src/product.js"), "export const revision = 2;\n");
  commitAll(root, "change review target");
  return {
    root,
    flowManager,
    oldTreeSha,
    nextTreeSha: git(root, ["rev-parse", "HEAD^{tree}"]),
  };
}

function runRecovery(root) {
  const result = spawnSync(process.execPath, [
    sentiBin,
    "flow",
    "set",
    "retry",
    "reset",
    "review",
    "impl",
    "--reason",
    "Changed implementation tree after the exhausted tooling attempt.",
    "--yes",
    "--expect-run-id",
    "run-review-recovery",
    "--expect-issue",
    "453",
    "--expect-spec",
    spec,
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
  return {
    status: result.status,
    envelope: result.stdout.trim() ? JSON.parse(result.stdout) : null,
  };
}

test("R3: same-tree recovery is rejected without changing convergence state", () => {
  const state = exhaustedFlowState();
  const before = structuredClone(state);

  assert.throws(
    () => mutation({ nextTreeSha: previousTreeSha }).apply(state),
    /tree|unchanged|identity/i,
  );
  assert.deepEqual(state, before);
});

test("R4: changed-tree recovery resets tooling state once and preserves target guards", () => {
  const state = exhaustedFlowState();
  mutation().apply(state);

  assert.equal(state.reviewConvergence.records.length, 1);
  const [record] = state.reviewConvergence.records;
  assert.equal(record.treeSha, nextTreeSha);
  assert.equal(record.toolingAttempts, 0);
  assert.equal(record.semanticAttempts, 2);
  assert.equal(record.semanticMaxAttempts, 4);
  assert.equal(record.provider, "independent-reviewer");
  assert.equal(record.phase, "impl");
  assert.equal(record.taskId, null);
  assert.equal(state.runId, "run-review-recovery");
  assert.equal(state.issue, 453);
  assert.equal(state.spec, spec);

  const afterFirstRecovery = structuredClone(state);
  assert.throws(() => mutation().apply(state), /once|previous|target|tree/i);
  assert.deepEqual(state, afterFirstRecovery);
});

test("R4: public recovery commits one grant with the tooling reset and stays idempotent", (t) => {
  const fixture = createRecoveryFixture(t);
  const first = runRecovery(fixture.root);
  assert.equal(first.status, 0);
  assert.equal(first.envelope.ok, true);

  const afterFirst = fixture.flowManager.load();
  assert.equal(afterFirst.retryRecovery.entries.length, 1);
  assert.equal(afterFirst.reviewConvergence.records.length, 1);
  assert.equal(afterFirst.reviewConvergence.records[0].treeSha, fixture.nextTreeSha);
  assert.equal(afterFirst.reviewConvergence.records[0].toolingAttempts, 0);

  const second = runRecovery(fixture.root);
  assert.notEqual(second.status, 0);
  const afterSecond = fixture.flowManager.load();
  assert.equal(afterSecond.retryRecovery.entries.length, 1);
  assert.deepEqual(afterSecond.reviewConvergence, afterFirst.reviewConvergence);
});

test("R4: flow-state write failure persists neither recovery grant nor tooling reset", (t) => {
  const fixture = createRecoveryFixture(t);
  assert.equal(
    typeof reviewConvergence.ReviewToolingRecoveryMutation,
    "function",
    "ReviewToolingRecoveryMutation must implement changed-tree recovery",
  );
  const mutation = new reviewConvergence.ReviewToolingRecoveryMutation({
    phase: "impl",
    taskId: null,
    previousTreeSha: fixture.oldTreeSha,
    nextTreeSha: fixture.nextTreeSha,
    expectedRunId: "run-review-recovery",
    expectedIssue: 453,
    expectedSpec: spec,
  });
  const flowPath = path.join(fixture.root, path.dirname(spec), "flow.json");
  const before = fs.readFileSync(flowPath);

  assert.throws(() => fixture.flowManager.mutate((state) => {
    const entries = Array.isArray(state.retryRecovery?.entries)
      ? state.retryRecovery.entries
      : [];
    state.retryRecovery = {
      version: 1,
      entries: [...entries, { id: "injected-recovery-grant" }],
    };
    mutation.apply(state);
  }, {
    faultInjector({ phase }) {
      if (phase === "before-state-temp-write") {
        throw new Error("injected recovery CAS write failure");
      }
    },
  }), /injected recovery CAS write failure/);

  assert.deepEqual(fs.readFileSync(flowPath), before);
  const after = fixture.flowManager.load();
  assert.equal(after.reviewConvergence.records[0].treeSha, fixture.oldTreeSha);
  assert.equal(after.reviewConvergence.records[0].toolingAttempts, 1);
  assert.equal(after.retryRecovery?.entries?.length || 0, 0);
});

test("R4: target guard mismatch rejects the whole recovery mutation", () => {
  const state = exhaustedFlowState();
  const before = structuredClone(state);

  assert.throws(
    () => mutation({ expectedRunId: "stale-run" }).apply(state),
    /run|target|guard/i,
  );
  assert.deepEqual(state, before);
});

test("R7: recovery preserves configured limits and the prior tooling outcome provenance", () => {
  const state = exhaustedFlowState();
  const before = structuredClone(state.reviewConvergence.records[0]);
  mutation().apply(state);
  const [record] = state.reviewConvergence.records;

  assert.equal(record.toolingMaxAttempts, 1);
  assert.equal(record.semanticMaxAttempts, before.semanticMaxAttempts);
  assert.deepEqual(record.toolingOutcome, before.toolingOutcome);
  assert.equal(record.provider, before.provider);
  assert.equal(record.targetStateDigest, before.targetStateDigest);
});

test("R7: implementation leaves acceptance semantics protected and limits stale-ledger routing", () => {
  const protectedPaths = [
    "src/flow/lib/run-acceptance-review.js",
    "src/flow/lib/set-acceptance-decision.js",
    "src/flow/schemas/acceptance-review.schema.json",
    "src/flow/schemas/next-action/acceptance-review.schema.json",
    "src/flow/prompts/impl/acceptance-review.md",
    "src/flow/prompts/impl/acceptance-decision.md",
  ];
  const changed = execFileSync(
    "git",
    ["diff", "--name-only", "main", "--", ...protectedPaths],
    { cwd: repoRoot, encoding: "utf8" },
  ).trim();
  assert.equal(changed, "");

  const routingDiff = execFileSync(
    "git",
    ["diff", "--unified=0", "main", "--", "src/flow/lib/acceptance-review-artifacts.js"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const changedLines = routingDiff.split("\n").filter((line) => (
    /^[+-]/.test(line) && !/^(---|\+\+\+)/.test(line)
  ));
  assert.deepEqual(changedLines, [
    "-class AcceptanceEvidenceRefresh {",
    "+export class AcceptanceEvidenceRefresh {",
    "+      if (blocker.summary === \"Required artifact is invalid: impl-repair.json.\") {",
    "+        return this.staleArtifacts.length > 0;",
    "+      }",
  ]);
});
