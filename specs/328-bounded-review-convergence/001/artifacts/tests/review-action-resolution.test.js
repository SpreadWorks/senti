// spec: R3 R4 R6 R8
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import GetStatusCommand from "../../../src/flow/lib/get-status.js";
import {
  makeFlowManager,
  makeFlowState,
  moveFlowToStep,
} from "../../../tests/helpers/flow-setup.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const importRoot = (relPath) => import(pathToFileURL(path.join(root, relPath)).href);
const treeSha = "c".repeat(40);

async function model() {
  const relPath = "src/flow/lib/review-convergence.js";
  assert.ok(fs.existsSync(path.join(root, relPath)), `${relPath} must be implemented`);
  return importRoot(relPath);
}

function state(ReviewConvergenceState, overrides = {}) {
  return new ReviewConvergenceState({
    phase: "impl",
    taskId: null,
    treeSha,
    semanticAttempts: 0,
    semanticMaxAttempts: 3,
    toolingAttempts: 0,
    toolingMaxAttempts: 1,
    evidence: null,
    finalizedEvidenceAvailable: false,
    handoffFindings: [],
    blocker: null,
    ...overrides,
  });
}

test("R3: non-blocking evidence and exhausted rejection resolve to acceptance handoff", async () => {
  const {
    MoveToAcceptance,
    RetryReview,
    ReviewConvergenceState,
    resolveReviewPermittedOperation,
  } = await model();

  const retryAfterRepair = resolveReviewPermittedOperation(state(ReviewConvergenceState, {
    semanticAttempts: 1,
    evidence: { disposition: "REJECTED", evidenceId: "E-0" },
    handoffFindings: [{ findingId: "B-0" }],
  }));
  assert.ok(retryAfterRepair instanceof RetryReview);
  assert.equal(retryAfterRepair.kind, "retry_review");
  assert.equal(retryAfterRepair.budgetKind, "semantic");
  assert.equal(retryAfterRepair.remainingSemanticAttempts, 2);
  assert.equal(retryAfterRepair.requiresChangedEvidence, true);

  const advisory = resolveReviewPermittedOperation(state(ReviewConvergenceState, {
    evidence: { disposition: "ADVISORY", evidenceId: "E-1" },
    handoffFindings: [{ findingId: "A-1" }],
  }));
  assert.ok(advisory instanceof MoveToAcceptance);
  assert.equal(advisory.kind, "move_to_acceptance");
  assert.deepEqual(advisory.handoffFindings.map((entry) => entry.findingId), ["A-1"]);

  const rejected = resolveReviewPermittedOperation(state(ReviewConvergenceState, {
    semanticAttempts: 3,
    evidence: { disposition: "REJECTED", evidenceId: "E-2" },
    handoffFindings: [{ findingId: "B-1" }],
  }));
  assert.ok(rejected instanceof MoveToAcceptance);
  assert.equal(rejected.kind, "move_to_acceptance");
});

test("R4: tooling retry budget is shared by the target and cannot be reset by provider changes", async () => {
  const {
    RetryReview,
    StopAsBlocker,
    ReviewConvergenceState,
    resolveReviewPermittedOperation,
  } = await model();

  const retry = resolveReviewPermittedOperation(state(ReviewConvergenceState));
  assert.ok(retry instanceof RetryReview);
  assert.equal(retry.kind, "retry_review");
  assert.equal(retry.remainingToolingAttempts, 1);

  for (const provider of ["provider-a", "provider-b"]) {
    const stopped = resolveReviewPermittedOperation(state(ReviewConvergenceState, {
      toolingAttempts: 1,
      blocker: { kind: "provider_permission", reason: `${provider} denied` },
    }));
    assert.ok(stopped instanceof StopAsBlocker);
    assert.equal(stopped.remainingToolingAttempts, 0);
  }
});

test("R4: tooling attempt state persists across provider processes and rejects unchanged execution", async (t) => {
  const {
    ReviewConvergenceStore,
    ReviewToolingOutcome,
  } = await model();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-attempt-state-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const manager = makeFlowManager(tmp);
  manager.create(moveFlowToStep(makeFlowState({
    spec: "specs/001-review/spec.json",
    runId: "run-review",
    issue: 452,
  }), "impl-review"));
  const store = new ReviewConvergenceStore({ flowManager: manager });
  const outcome = new ReviewToolingOutcome({
    stage: "startup",
    attempt: 1,
    maxAttempts: 2,
    reason: "provider-a permission denied",
  });
  store.recordToolingOutcome({
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "provider-a",
    outcome,
    expectedOriginal: manager.load(),
  });

  const persisted = store.read({ phase: "impl", taskId: null, treeSha });
  assert.equal(persisted.toolingAttempts, 0);
  assert.equal(persisted.toolingMaxAttempts, 1);
  assert.equal(persisted.remainingToolingAttempts, 1);
  assert.equal(persisted.semanticAttempts, 0);

  store.recordToolingOutcome({
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "provider-b",
    outcome: new ReviewToolingOutcome({
      stage: "startup",
      attempt: 2,
      maxAttempts: 2,
      reason: "provider-b permission denied",
    }),
    expectedOriginal: manager.load(),
  });
  const exhausted = store.read({ phase: "impl", taskId: null, treeSha });
  assert.equal(exhausted.toolingAttempts, 1);
  assert.equal(exhausted.remainingToolingAttempts, 0);
  const before = Buffer.from(JSON.stringify(manager.load()));

  assert.throws(() => store.recordToolingOutcome({
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "provider-c",
    outcome: new ReviewToolingOutcome({
      stage: "startup",
      attempt: 2,
      maxAttempts: 2,
      reason: "provider-c permission denied",
    }),
    expectedOriginal: manager.load(),
  }), /attempt|exhausted|duplicate/i);
  assert.deepEqual(Buffer.from(JSON.stringify(manager.load())), before);
});

test("R4: changed repair state and provider share one tooling budget for the same phase task and tree", async (t) => {
  const {
    ReviewConvergenceStore,
    ReviewToolingOutcome,
  } = await model();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-target-state-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const manager = makeFlowManager(tmp);
  manager.create(moveFlowToStep(makeFlowState({
    spec: "specs/001-review/spec.json",
    runId: "run-review-target-state",
    issue: 452,
  }), "impl-review"));
  const store = new ReviewConvergenceStore({ flowManager: manager });
  const firstDigest = "1".repeat(64);
  const secondDigest = "2".repeat(64);

  store.recordToolingOutcome({
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "provider-a",
    outcome: new ReviewToolingOutcome({
      stage: "startup",
      attempt: 1,
      maxAttempts: 2,
      reason: "provider-a unavailable",
    }),
    targetStateDigest: firstDigest,
    expectedOriginal: manager.load(),
  });
  assert.equal(store.read({
    phase: "impl",
    taskId: null,
    treeSha,
    targetStateDigest: firstDigest,
  }).toolingAttempts, 0);
  assert.equal(store.read({
    phase: "impl",
    taskId: null,
    treeSha,
    targetStateDigest: secondDigest,
  }).toolingAttempts, 0);
  assert.equal(store.read({
    phase: "impl",
    taskId: null,
    treeSha,
    targetStateDigest: secondDigest,
  }).toolingOutcome.attempt, 1);

  store.recordToolingOutcome({
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "provider-b",
    outcome: new ReviewToolingOutcome({
      stage: "startup",
      attempt: 2,
      maxAttempts: 2,
      reason: "provider-b unavailable",
    }),
    targetStateDigest: secondDigest,
    expectedOriginal: manager.load(),
  });
  const record = manager.load().reviewConvergence.records[0];
  assert.equal(record.targetStateDigest, secondDigest);
  assert.equal(record.provider, "provider-b");
  assert.equal(record.toolingAttempts, 1);
  assert.equal(store.read({
    phase: "impl",
    taskId: null,
    treeSha,
    targetStateDigest: secondDigest,
  }).remainingToolingAttempts, 0);
});

test("R6: each state exposes exactly one permitted operation and one handoff or blocker payload", async () => {
  const {
    RegisterAlternativeEvidence,
    ReviewConvergenceState,
    StopAsBlocker,
    resolveReviewPermittedOperation,
  } = await model();

  const register = resolveReviewPermittedOperation(state(ReviewConvergenceState, {
    toolingAttempts: 1,
    finalizedEvidenceAvailable: true,
  }));
  assert.ok(register instanceof RegisterAlternativeEvidence);
  assert.equal(register.kind, "register_alternative_evidence");
  assert.equal(register.handoffFindings, null);
  assert.equal(register.blocker.kind, "alternative_evidence_required");
  assert.deepEqual(Object.keys(register.toJSON()).filter((key) => (
    key === "handoffFindings" || key === "blocker"
  )), ["blocker"]);

  const blocker = resolveReviewPermittedOperation(state(ReviewConvergenceState, {
    toolingAttempts: 1,
    blocker: { kind: "missing_evidence", reason: "No finalized evidence is available." },
  }));
  assert.ok(blocker instanceof StopAsBlocker);
  assert.equal(blocker.kind, "stop_as_blocker");
  assert.equal(blocker.handoffFindings, null);
  assert.equal(blocker.blocker.kind, "missing_evidence");
});

test("R6: next-action and status expose one authoritative exhausted-tooling action", async (t) => {
  const {
    ReviewConvergenceStore,
    ReviewToolingOutcome,
  } = await model();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-public-projection-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const specDir = path.join(tmp, "specs", "001-review");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
    requirements: [{ id: "R6", desc: "One public review action", priority: "must" }],
  }));

  const manager = makeFlowManager(tmp);
  manager.create(moveFlowToStep(makeFlowState({
    spec: "specs/001-review/spec.json",
    runId: "run-public-review-action",
    issue: 452,
  }), "impl-review"));
  const store = new ReviewConvergenceStore({ flowManager: manager });
  store.recordToolingOutcome({
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "fixture-provider",
    outcome: new ReviewToolingOutcome({
      stage: "startup",
      attempt: 1,
      maxAttempts: 2,
      reason: "fixture provider unavailable",
    }),
    expectedOriginal: manager.load(),
  });
  store.recordToolingOutcome({
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "replacement-provider",
    outcome: new ReviewToolingOutcome({
      stage: "startup",
      attempt: 2,
      maxAttempts: 2,
      reason: "replacement provider unavailable",
    }),
    expectedOriginal: manager.load(),
  });

  const context = { root: tmp, flowState: manager.load(), flowManager: manager };
  const projections = [
    ["next-action", await new GetNextActionCommand().execute(context)],
    ["status", new GetStatusCommand().execute({ ...context, details: true })],
  ];
  for (const [surface, projection] of projections) {
    assert.equal(projection.reviewAction.kind, "stop_as_blocker", surface);
    assert.equal(projection.reviewAction.remainingToolingAttempts, 0, surface);
    assert.notEqual(
      projection.reviewAction.handoffFindings != null,
      projection.reviewAction.blocker != null,
      `${surface} must expose exactly one handoff or blocker payload`,
    );
    assert.equal(Object.hasOwn(projection, "reviewStop"), false, surface);
    assert.equal(Object.hasOwn(projection, "retryRecovery"), false, surface);
  }
});

test("R8: permission blocker never becomes a flow approval operation", async () => {
  const {
    ReviewConvergenceState,
    StopAsBlocker,
    resolveReviewPermittedOperation,
  } = await model();
  const operation = resolveReviewPermittedOperation(state(ReviewConvergenceState, {
    toolingAttempts: 1,
    blocker: { kind: "sandbox_permission", reason: "Execution denied." },
  }));
  assert.ok(operation instanceof StopAsBlocker);
  assert.equal(operation.requiresApproval, false);
  assert.equal(operation.kind, "stop_as_blocker");
});
