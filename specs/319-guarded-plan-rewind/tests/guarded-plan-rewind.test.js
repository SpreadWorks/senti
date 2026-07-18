// spec: R1 R2 R3 R4 R5 R6 R7 R8
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import RunReopenDraftCommand from "../../../src/flow/lib/run-reopen-draft.js";
import SetApprovalCommand from "../../../src/flow/lib/set-approval.js";
import { findActiveNode, getFlowNode } from "../../../src/flow/definition.js";
import { promoteNextPendingLeaf } from "../../../src/flow/lib/step-tree.js";
import { readRetryCount } from "../../../src/flow/lib/retry-accounting.js";
import { FlowStore } from "../../../src/lib/flow-store.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

const RUN_ID = "run-434";
const SPEC = "specs/319-guarded-plan-rewind/spec.json";
const REWOUND_AT = "2026-07-12T20:00:00.000Z";
const EXPECTED_STAGES = ["impl-review", "impl-gate", "retro", "acceptance-review", "final-regression"];
const EXPECTED_REVIEW_PHASES = ["draft-questions", "draft-coverage", "spec", "test", "impl"];
const EXPECTED_GATE_PHASES = ["draft", "spec", "integration"];
const EVIDENCE_KINDS = [
  "approval",
  "draft-review",
  "spec-review",
  "plan-gate",
  "scenario-validity",
  "test-review",
  "test-execute",
  "test-result-review",
  "implementation",
  "impl-review",
  "impl-gate",
  "retro",
  "acceptance-review",
  "flow-findings",
  "completion-overrides",
  "final-regression",
];

const PLAN_STEPS = [
  "branch", "prepare-spec", "draft", "draft-questions-review",
  "draft-questions-triage", "draft-questions-repair", "draft-refine",
  "draft-coverage-review", "draft-coverage-triage", "draft-coverage-repair",
  "draft-gate", "spec", "spec-review", "spec-triage", "spec-repair",
  "spec-gate", "approval", "test", "scenario-validity", "test-review",
];
const IMPL_STEPS = [
  "implement", "test-execute", "test-result-review", "impl-review",
  "impl-gate", "retro", "acceptance-review", "final-regression",
];
const FINALIZE_STEPS = ["finalize-commit", "finalize-merge", "finalize-sync", "finalize-cleanup"];

function leaf(id, status = "done") {
  return {
    id,
    status,
    startedAt: "2026-07-12T18:00:00.000Z",
    finishedAt: "2026-07-12T18:01:00.000Z",
    runtimeLog: { sequence: 1 },
  };
}

function fixture(sourceStage = "impl-gate") {
  const plan = PLAN_STEPS.map((id) => leaf(id));
  const impl = IMPL_STEPS.map((id) => leaf(id, id === sourceStage ? "in_progress" : "done"));
  const sourceIndex = IMPL_STEPS.indexOf(sourceStage);
  for (let index = sourceIndex + 1; index < impl.length; index++) impl[index].status = "pending";
  return {
    runId: RUN_ID,
    issue: 434,
    spec: SPEC,
    baseBranch: "main",
    featureBranch: "feature/319-guarded-plan-rewind",
    worktree: true,
    currentTaskId: null,
    tasks: [{
      id: "T-1",
      status: "done",
      origin: "plan",
      parent: null,
      spec: "tasks/T-1.md",
      summary: "preserved",
      added_round: 0,
      requirements: [{ desc: "existing", status: "done" }],
      steps: [{ id: "implement", status: "done" }],
    }],
    metrics: [
      { phase: "impl", counter: "reviewRetry", delta: 3, taskId: null, ts: "2026-07-12T18:00:00.000Z" },
      { phase: "integration", counter: "gateRetry", delta: 4, taskId: null, ts: "2026-07-12T18:00:01.000Z" },
    ],
    retryRecovery: { version: 1, entries: [{ kind: "gate", phase: "integration", maxAttempts: 6 }] },
    steps: [
      { id: "plan", status: "done", children: plan },
      {
        id: "impl",
        status: "in_progress",
        children: [
          ...impl,
          {
            id: "finalize",
            status: "pending",
            children: FINALIZE_STEPS.map((id) => leaf(id, "pending")),
          },
        ],
      },
    ],
    state: { mergeStrategy: null, featureBranchSquashedSha: null },
  };
}

function flatten(steps) {
  return steps.flatMap((step) => [step, ...(step.children ? flatten(step.children) : [])]);
}

function assertErrorCode(fn, expectedCode) {
  assert.throws(fn, (error) => {
    assert.equal(error.code, expectedCode);
    return true;
  });
}

function activateOnly(state, stepId) {
  for (const step of flatten(state.steps)) {
    if (step.children) continue;
    step.status = step.id === stepId ? "in_progress" : "done";
    if (FINALIZE_STEPS.includes(step.id) && step.id !== stepId) step.status = "pending";
  }
  return state;
}

function request(PlanRewindRequest, sourceStage = "impl-gate", overrides = {}) {
  return new PlanRewindRequest({
    runId: RUN_ID,
    issue: 434,
    spec: SPEC,
    sourceStage,
    destinationStep: "draft",
    reason: "Clarify the approved requirement contradiction.",
    rewoundAt: REWOUND_AT,
    invalidatedApprovalConfirmedAt: "2026-07-12T19:00:00.000Z",
    ...overrides,
  });
}

async function loadPlanRewind() {
  try {
    return await import("../../../src/flow/lib/plan-rewind.js");
  } catch (error) {
    assert.fail(`plan rewind production module must load: ${error.message}`);
  }
}

function tempRoot(state) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-plan-rewind-"));
  const specDir = path.join(root, path.dirname(state.spec));
  fs.mkdirSync(specDir, { recursive: true });
  fs.copyFileSync(SPEC, path.join(specDir, "spec.json"));
  fs.writeFileSync(path.join(specDir, "issue-log.json"), "{\"entries\":[]}\n");
  fs.writeFileSync(path.join(specDir, "prior-review.json"), "{\"verdict\":\"FAIL\"}\n");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "product.js"), "export const preserved = true;\n");
  return { root, specDir };
}

function realStore(root) {
  return new FlowStore({
    root,
    mainRoot: root,
    inWorktree: false,
    activeFlowsProvider: () => ({ load: () => [{ spec: "319-guarded-plan-rewind" }] }),
  });
}

function fakeManager(state, applyPlanRewind, latestPlanRewind) {
  function mutate(mutator) {
    mutator(state);
  }
  function rewindPlan(rewindRequest, evidence) {
    const next = applyPlanRewind(state, rewindRequest, evidence);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, next);
    return latestPlanRewind(state);
  }
  return {
    load: () => state,
    rewindPlan,
    _store: { mutate, rewindPlan },
  };
}

function commandContainer(root, state) {
  const values = {
    paths: { root },
    mainRoot: root,
    inWorktree: false,
    config: {},
    flowManager: { load: () => state },
  };
  return { get: (key) => values[key] };
}

async function executeExistingRoute(state, reason = "") {
  const { root } = tempRoot(state);
  try {
    const command = new RunReopenDraftCommand();
    const result = await command.execute({
      root,
      flowState: state,
      flowManager: fakeManager(state, () => assert.fail("flow-level route not expected"), () => null),
      reason,
    });
    const log = JSON.parse(fs.readFileSync(path.join(root, path.dirname(state.spec), "issue-log.json"), "utf8"));
    return { result, log, state };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("R1: flow-level route is guarded while existing reopen routes retain behavior", async () => {
  const {
    PLAN_REWIND_SUPPORTED_STAGES,
    PlanRewindRequest,
    applyPlanRewind,
    latestPlanRewind,
  } = await loadPlanRewind();
  assert.deepEqual(PLAN_REWIND_SUPPORTED_STAGES, EXPECTED_STAGES);
  const metadata = FLOW_COMMANDS.run["reopen-draft"];
  for (const option of ["--reason", "--expect-run-id", "--expect-issue", "--expect-spec"]) {
    assert.ok(metadata.args.options.includes(option), option);
  }

  const prePlan = activateOnly(fixture(), "spec");
  prePlan.tasks = [];
  const prePlanResult = await executeExistingRoute(prePlan, "Clarify before implementation");
  assert.equal(prePlanResult.result.data.mode, "pre-implementation");
  assert.equal(prePlanResult.log.entries.length, 1);

  const taskRoute = activateOnly(fixture(), "implement");
  const taskResult = await executeExistingRoute(taskRoute);
  assert.equal(taskResult.result.data.mode, "implementation");
  assert.equal(taskResult.result.data.doneTaskCount, 1);
  assert.equal(taskResult.log.entries.length, 1);

  const noDone = activateOnly(fixture(), "implement");
  noDone.tasks = [];
  const noDoneResult = await executeExistingRoute(noDone);
  assert.equal(noDoneResult.result.ok, false);
  assert.equal(noDoneResult.result.errors[0].code, "NO_DONE_TASK");

  const flowState = fixture();
  const { root } = tempRoot(flowState);
  try {
    const command = new RunReopenDraftCommand();
    const result = await command.execute({
      root,
      flowState,
      flowManager: fakeManager(flowState, applyPlanRewind, latestPlanRewind),
      reason: "Clarify approved wording",
      expectRunId: RUN_ID,
      expectIssue: 434,
      expectSpec: SPEC,
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.mode, "flow-level");
    assert.equal(result.data.previousActiveStep, "impl-gate");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R2: each supported source produces one draft action across parent and task scopes", async () => {
  const { PLAN_REWIND_SUPPORTED_STAGES, PlanRewindRequest, applyPlanRewind } = await loadPlanRewind();
  for (const sourceStage of PLAN_REWIND_SUPPORTED_STAGES) {
    const next = applyPlanRewind(fixture(sourceStage), request(PlanRewindRequest, sourceStage), []);
    const activeLeaves = [
      ...flatten(next.steps).filter((step) => !step.children && step.status === "in_progress"),
      ...next.tasks.flatMap((task) => task.steps.filter((step) => step.status === "in_progress")),
    ];
    assert.deepEqual(activeLeaves.map((step) => step.id), ["draft"], sourceStage);
    const target = findActiveNode(next);
    assert.deepEqual({ scope: target.scope, stepId: target.stepId }, { scope: "flow", stepId: "draft" });

    for (const step of flatten(next.steps)) {
      if (step.children) continue;
      const expected = ["branch", "prepare-spec"].includes(step.id)
        ? "done"
        : step.id === "draft" ? "in_progress" : "pending";
      assert.equal(step.status, expected, `${sourceStage}:${step.id}`);
      if (!["branch", "prepare-spec"].includes(step.id)) {
        assert.equal(step.startedAt, undefined, `${step.id}.startedAt`);
        assert.equal(step.finishedAt, undefined, `${step.id}.finishedAt`);
        assert.equal(step.runtimeLog, undefined, `${step.id}.runtimeLog`);
      }
    }
  }

  const conflictingTask = fixture();
  conflictingTask.tasks[0].steps[0].status = "in_progress";
  const snapshot = structuredClone(conflictingTask);
  assertErrorCode(
    () => applyPlanRewind(conflictingTask, request(PlanRewindRequest), []),
    "PLAN_REWIND_INVARIANT",
  );
  assert.deepEqual(conflictingTask, snapshot);
});

test("R2: FlowStore persists one validated rewind and rejects an invalid candidate before save", async () => {
  const { PlanRewindRequest, applyPlanRewind } = await loadPlanRewind();
  const state = fixture();
  const { root, specDir } = tempRoot(state);
  const flowPath = path.join(specDir, "flow.json");
  fs.writeFileSync(flowPath, JSON.stringify(state, null, 2) + "\n");
  try {
    const store = realStore(root);
    store.rewindPlan(request(PlanRewindRequest), []);
    const persisted = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    assert.equal(findActiveNode(persisted).stepId, "draft");
    assert.equal(persisted.planRewinds.length, 1);

    const invalid = activateOnly(fixture(), "impl-gate");
    invalid.tasks[0].steps[0].status = "in_progress";
    fs.writeFileSync(flowPath, JSON.stringify(invalid, null, 2) + "\n");
    const bytesBefore = fs.readFileSync(flowPath);
    assertErrorCode(
      () => store.rewindPlan(request(PlanRewindRequest), []),
      "PLAN_REWIND_INVARIANT",
    );
    assert.deepEqual(fs.readFileSync(flowPath), bytesBefore);

    const pure = applyPlanRewind(state, request(PlanRewindRequest), []);
    assert.equal(findActiveNode(pure).stepId, "draft");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R3: every flow retry phase resets to zero without changing maxima or history", async () => {
  const {
    PLAN_REWIND_GATE_PHASES,
    PLAN_REWIND_REVIEW_PHASES,
    PlanRewindRequest,
    applyPlanRewind,
    latestPlanRewind,
  } = await loadPlanRewind();
  assert.deepEqual(PLAN_REWIND_REVIEW_PHASES, EXPECTED_REVIEW_PHASES);
  assert.deepEqual(PLAN_REWIND_GATE_PHASES, EXPECTED_GATE_PHASES);
  const state = fixture();
  for (const phase of EXPECTED_REVIEW_PHASES) {
    state.metrics.push({ phase, counter: "reviewRetry", delta: 2, taskId: null, ts: "2026-07-12T19:00:00.000Z" });
  }
  for (const phase of EXPECTED_GATE_PHASES) {
    state.metrics.push({ phase, counter: "gateRetry", delta: 2, taskId: null, ts: "2026-07-12T19:00:00.000Z" });
  }
  const oldMetrics = structuredClone(state.metrics);
  const oldRecovery = structuredClone(state.retryRecovery);
  const next = applyPlanRewind(state, request(PlanRewindRequest), []);
  assert.deepEqual(next.metrics.slice(0, oldMetrics.length), oldMetrics);
  for (const phase of EXPECTED_REVIEW_PHASES) {
    assert.equal(readRetryCount({ state: next, kind: "review", phase }), 0, phase);
  }
  for (const phase of EXPECTED_GATE_PHASES) {
    assert.equal(readRetryCount({ state: next, kind: "gate", phase }), 0, phase);
  }
  assert.equal(next.retryRecovery, null);
  assert.deepEqual(latestPlanRewind(next).invalidatedRetryRecovery, oldRecovery);
  assert.equal(getFlowNode("impl-review").resolveMaxAttempts({ autoApprove: false }), 4);
  assert.equal(getFlowNode("impl-gate").resolveMaxAttempts({ autoApprove: false }), 5);
});

test("R4: all approval and evidence categories reject stale timestamps and accept renewed ones", async () => {
  const {
    PLAN_REWIND_EVIDENCE_KINDS,
    PlanEvidenceReference,
    PlanRewindRequest,
    applyPlanRewind,
    isPlanEvidenceFresh,
  } = await loadPlanRewind();
  assert.deepEqual(PLAN_REWIND_EVIDENCE_KINDS, EVIDENCE_KINDS);
  const next = applyPlanRewind(fixture(), request(PlanRewindRequest), []);
  for (const kind of EVIDENCE_KINDS) {
    assert.equal(isPlanEvidenceFresh(next, new PlanEvidenceReference({ kind, createdAt: "2026-07-12T19:59:59.999Z" })), false, kind);
    assert.equal(isPlanEvidenceFresh(next, new PlanEvidenceReference({ kind, createdAt: REWOUND_AT })), false, kind);
    assert.equal(isPlanEvidenceFresh(next, new PlanEvidenceReference({ kind, createdAt: "2026-07-12T20:00:00.001Z" })), true, kind);
  }
  assert.equal(flatten(next.steps).find((step) => step.id === "approval").status, "pending");
});

test("R4: renewed approval and artifact created on the normal route become eligible", async () => {
  const {
    PlanEvidenceReference,
    PlanRewindRequest,
    applyPlanRewind,
    isPlanEvidenceFresh,
  } = await loadPlanRewind();
  const state = applyPlanRewind(fixture(), request(PlanRewindRequest), []);
  const { root, specDir } = tempRoot(state);
  try {
    const approvalResult = new SetApprovalCommand().execute({
      root,
      flowState: state,
      approved: true,
      confirmedAt: "2026-07-12T20:00:00.001Z",
      notes: "renewed after plan rewind",
    });
    assert.equal(approvalResult.user_approval.approved, true);
    assert.equal(isPlanEvidenceFresh(state, new PlanEvidenceReference({
      kind: "approval",
      createdAt: approvalResult.user_approval.confirmed_at,
    })), true);

    const renewedArtifact = path.join(specDir, "impl-gate-result.json");
    fs.writeFileSync(renewedArtifact, "{\"result\":\"pass\"}\n");
    fs.utimesSync(renewedArtifact, new Date("2026-07-12T20:00:00.001Z"), new Date("2026-07-12T20:00:00.001Z"));
    const renewedCreatedAt = fs.statSync(renewedArtifact).mtime.toISOString();
    assert.equal(isPlanEvidenceFresh(state, new PlanEvidenceReference({
      kind: "impl-gate",
      createdAt: renewedCreatedAt,
    })), true);
    assert.equal(isPlanEvidenceFresh(state, new PlanEvidenceReference({
      kind: "impl-gate",
      createdAt: "2026-07-12T19:59:59.999Z",
    })), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R5: inventory enforces exact bounds, streams hashes, and preserves files and tasks", async () => {
  const {
    PLAN_REWIND_LIMITS,
    PlanRewindEvidence,
    PlanRewindEvidenceInventory,
    PlanRewindRequest,
    applyPlanRewind,
    capturePlanRewindEvidence,
  } = await loadPlanRewind();
  assert.deepEqual(PLAN_REWIND_LIMITS, {
    maxReasonChars: 500,
    maxPathChars: 1000,
    maxEvidenceFiles: 500,
    maxEvidenceBytes: 268435456,
    hashChunkBytes: 65536,
    maxAuditRecords: 100,
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "senti-plan-inventory-"));
  try {
    const artifact = path.join(dir, "review.json");
    const product = path.join(dir, "product.js");
    fs.writeFileSync(artifact, Buffer.alloc(65537, "a"));
    fs.writeFileSync(product, "export const preserved = true;\n");
    fs.writeFileSync(path.join(dir, "flow.json"), "excluded\n");
    const beforeArtifact = fs.readFileSync(artifact);
    const beforeProduct = fs.readFileSync(product);
    const chunks = [];
    const evidence = capturePlanRewindEvidence(dir, { onHashChunk: (size) => chunks.push(size) });
    assert.ok(evidence.every((entry) => entry instanceof PlanRewindEvidence));
    assert.ok(evidence.some((entry) => entry.path === "review.json"));
    assert.ok(!evidence.some((entry) => entry.path === "flow.json"));
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((size) => size <= 65536));
    assert.deepEqual(fs.readFileSync(artifact), beforeArtifact);
    assert.deepEqual(fs.readFileSync(product), beforeProduct);

    const exactFiles = Array.from({ length: 500 }, (_, index) => new PlanRewindEvidence({
      path: `artifact-${index}.json`, size: index === 0 ? 268434957 : 1,
      mtime: REWOUND_AT, sha256: "a".repeat(64),
    }));
    assert.equal(new PlanRewindEvidenceInventory(exactFiles).entries.length, 500);
    assertErrorCode(() => new PlanRewindEvidenceInventory([...exactFiles, new PlanRewindEvidence({
      path: "overflow.json", size: 0, mtime: REWOUND_AT, sha256: "b".repeat(64),
    })]), "PLAN_REWIND_EVIDENCE_LIMIT");
    assertErrorCode(() => new PlanRewindEvidenceInventory([
      new PlanRewindEvidence({ path: "too-large.json", size: 268435457, mtime: REWOUND_AT, sha256: "c".repeat(64) }),
    ]), "PLAN_REWIND_EVIDENCE_LIMIT");
    assertErrorCode(() => new PlanRewindEvidence({
      path: `${"x".repeat(1001)}`, size: 0, mtime: REWOUND_AT, sha256: "d".repeat(64),
    }), "PLAN_REWIND_INVALID_EVIDENCE");
    assert.equal(new PlanRewindEvidence({
      path: "x".repeat(1000), size: 0, mtime: REWOUND_AT, sha256: "d".repeat(64),
    }).path.length, 1000);

    const symlink = path.join(dir, "escape-link");
    fs.symlinkSync(os.tmpdir(), symlink, "dir");
    assertErrorCode(() => capturePlanRewindEvidence(dir), "PLAN_REWIND_INVALID_EVIDENCE");

    const state = fixture();
    const tasksBefore = structuredClone(state.tasks);
    const next = applyPlanRewind(state, request(PlanRewindRequest), evidence);
    assert.deepEqual(next.tasks, tasksBefore);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("R5: real persisted rewind preserves identity, task forest, product source, and artifacts", async () => {
  const {
    PlanRewindRequest,
    capturePlanRewindEvidence,
  } = await loadPlanRewind();
  const state = fixture();
  const { root, specDir } = tempRoot(state);
  const flowPath = path.join(specDir, "flow.json");
  const sourcePath = path.join(root, "src", "product.js");
  const artifactPath = path.join(specDir, "prior-review.json");
  fs.writeFileSync(flowPath, JSON.stringify(state, null, 2) + "\n");
  const identityBefore = {
    runId: state.runId,
    issue: state.issue,
    spec: state.spec,
    baseBranch: state.baseBranch,
    featureBranch: state.featureBranch,
    worktree: state.worktree,
    currentTaskId: state.currentTaskId,
    tasks: structuredClone(state.tasks),
  };
  const sourceBefore = fs.readFileSync(sourcePath);
  const artifactBefore = fs.readFileSync(artifactPath);
  try {
    const store = realStore(root);
    store.rewindPlan(
      request(PlanRewindRequest),
      capturePlanRewindEvidence(specDir),
    );
    const persisted = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    assert.deepEqual({
      runId: persisted.runId,
      issue: persisted.issue,
      spec: persisted.spec,
      baseBranch: persisted.baseBranch,
      featureBranch: persisted.featureBranch,
      worktree: persisted.worktree,
      currentTaskId: persisted.currentTaskId,
      tasks: persisted.tasks,
    }, identityBefore);
    assert.deepEqual(fs.readFileSync(sourcePath), sourceBefore);
    assert.deepEqual(fs.readFileSync(artifactPath), artifactBefore);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R6: audit contains every invalidation field, remains append-only, and caps at 100", async () => {
  const {
    PLAN_REWIND_GATE_PHASES,
    PLAN_REWIND_REVIEW_PHASES,
    PlanRewindEvidence,
    PlanRewindRequest,
    applyPlanRewind,
    latestPlanRewind,
  } = await loadPlanRewind();
  const evidence = [new PlanRewindEvidence({
    path: "impl-gate-result.json", size: 2, mtime: "2026-07-12T19:00:00.000Z", sha256: "a".repeat(64),
  })];
  const once = applyPlanRewind(fixture(), request(PlanRewindRequest), evidence);
  const record = latestPlanRewind(once);
  assert.equal(record.reason, request(PlanRewindRequest).reason);
  assert.deepEqual(record.target, { runId: RUN_ID, issue: 434, spec: SPEC });
  assert.equal(record.sourceStage, "impl-gate");
  assert.equal(record.destinationStep, "draft");
  assert.equal(record.rewoundAt, REWOUND_AT);
  assert.equal(record.invalidatedApprovalConfirmedAt, "2026-07-12T19:00:00.000Z");
  assert.deepEqual(record.invalidatedRetryRecovery, fixture().retryRecovery);
  assert.deepEqual(record.reviewRetryResetPhases, PLAN_REWIND_REVIEW_PHASES);
  assert.deepEqual(record.gateRetryResetPhases, PLAN_REWIND_GATE_PHASES);
  assert.ok(record.invalidatedStepIds.includes("approval"));
  assert.deepEqual(record.invalidatedEvidence, evidence.map((entry) => entry.toJSON()));

  const secondSource = activateOnly(structuredClone(once), "retro");
  const twice = applyPlanRewind(secondSource, request(PlanRewindRequest, "retro", {
    rewoundAt: "2026-07-12T21:00:00.000Z",
  }), []);
  assert.equal(twice.planRewinds.length, 2);
  assert.deepEqual(twice.planRewinds[0], once.planRewinds[0]);

  const capped = fixture();
  capped.planRewinds = Array.from({ length: 100 }, () => structuredClone(record));
  const snapshot = structuredClone(capped);
  assertErrorCode(
    () => applyPlanRewind(capped, request(PlanRewindRequest), []),
    "PLAN_REWIND_AUDIT_LIMIT",
  );
  assert.deepEqual(capped, snapshot);
});

test("R7: every guard, route, baseline, resource, and candidate rejection is immutable", async () => {
  const {
    PlanRewindEvidence,
    PlanRewindRequest,
    applyPlanRewind,
    capturePlanRewindEvidence,
    validatePlanRewindGuards,
  } = await loadPlanRewind();
  const base = fixture();
  const mismatchRoot = tempRoot(base).root;
  const baseSnapshot = structuredClone(base);
  try {
    for (const [field, value] of [["expectRunId", "other"], ["expectIssue", 999], ["expectSpec", "specs/other/spec.json"]]) {
      const input = {
        _envelopeKey: "reopen-draft",
        expectRunId: RUN_ID,
        expectIssue: 434,
        expectSpec: SPEC,
        [field]: value,
      };
      const command = new RunReopenDraftCommand();
      let executeCalls = 0;
      command.execute = async () => {
        executeCalls++;
        assert.fail("target mismatch must return before execute");
      };
      const mismatch = await command.run(
        commandContainer(mismatchRoot, base),
        input,
      );
      assert.equal(mismatch.errors[0].code, "ACTIVE_FLOW_MISMATCH", field);
      assert.equal(executeCalls, 0, field);
      assert.deepEqual(base, baseSnapshot, field);
    }
  } finally {
    fs.rmSync(mismatchRoot, { recursive: true, force: true });
  }
  for (const missing of ["expectRunId", "expectIssue", "expectSpec"]) {
    const guards = { expectRunId: RUN_ID, expectIssue: 434, expectSpec: SPEC };
    delete guards[missing];
    assertErrorCode(() => validatePlanRewindGuards(guards), "PLAN_REWIND_MISSING_GUARD");
  }

  const immutableCases = [];
  for (const stage of FINALIZE_STEPS) {
    immutableCases.push([`stage:${stage}`, activateOnly(fixture(), stage), stage, "PLAN_REWIND_FINALIZE_BOUNDARY"]);
  }
  immutableCases.push([
    "unsupported:test-execute",
    activateOnly(fixture(), "test-execute"),
    "test-execute",
    "PLAN_REWIND_UNSUPPORTED_STAGE",
  ]);
  const taskScoped = fixture();
  taskScoped.currentTaskId = "T-1";
  immutableCases.push(["task-scoped", taskScoped, "impl-gate", "PLAN_REWIND_TASK_SCOPE"]);
  for (const [field, value] of [
    ["mergeStrategy", "squash"],
    ["featureBranchSquashedSha", "abc123"],
    ["finalizedAt", "2026-07-12T20:00:00.000Z"],
  ]) {
    const state = fixture();
    state.state[field] = value;
    immutableCases.push([field, state, "impl-gate", "PLAN_REWIND_BASELINE_COMPLETE"]);
  }
  for (const [label, state, stage, code] of immutableCases) {
    const snapshot = structuredClone(state);
    assertErrorCode(() => applyPlanRewind(state, request(PlanRewindRequest, stage), []), code);
    assert.deepEqual(state, snapshot, label);
  }

  for (const reason of ["", "x".repeat(501)]) {
    assertErrorCode(
      () => request(PlanRewindRequest, "impl-gate", { reason }),
      "PLAN_REWIND_INVALID_REASON",
    );
  }
  assertErrorCode(() => new PlanRewindEvidence({
    path: "../escape", size: 0, mtime: REWOUND_AT, sha256: "a".repeat(64),
  }), "PLAN_REWIND_INVALID_EVIDENCE");
  assertErrorCode(() => new PlanRewindEvidence({
    path: "..\\escape", size: 0, mtime: REWOUND_AT, sha256: "a".repeat(64),
  }), "PLAN_REWIND_INVALID_EVIDENCE");
  assertErrorCode(() => new PlanRewindEvidence({
    path: `${"segment/../".repeat(100)}evidence.json`,
    size: 0,
    mtime: REWOUND_AT,
    sha256: "a".repeat(64),
  }), "PLAN_REWIND_INVALID_EVIDENCE");
  assertErrorCode(
    () => capturePlanRewindEvidence(os.tmpdir(), { maxFiles: 0 }),
    "PLAN_REWIND_EVIDENCE_LIMIT",
  );

  const conflict = fixture();
  flatten(conflict.steps).find((step) => step.id === "draft").status = "in_progress";
  const snapshot = structuredClone(conflict);
  assertErrorCode(
    () => applyPlanRewind(conflict, request(PlanRewindRequest), []),
    "PLAN_REWIND_INVARIANT",
  );
  assert.deepEqual(conflict, snapshot);
});

test("R8: impl-gate rewind traverses renewed approval and implementation verification in order", async () => {
  const {
    PlanRewindRequest,
    applyPlanRewind,
    latestPlanRewind,
  } = await loadPlanRewind();
  const state = fixture();
  const sourceBefore = structuredClone(state.tasks);
  const { root, specDir } = tempRoot(state);
  try {
    const priorArtifactPath = path.join(specDir, "prior-review.json");
    const priorArtifactBefore = fs.readFileSync(priorArtifactPath);
    const command = new RunReopenDraftCommand();
    const result = await command.execute({
      root,
      flowState: state,
      flowManager: fakeManager(state, applyPlanRewind, latestPlanRewind),
      reason: "Clarify approved wording",
      expectRunId: RUN_ID,
      expectIssue: 434,
      expectSpec: SPEC,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(state.tasks, sourceBefore);
    assert.deepEqual(fs.readFileSync(priorArtifactPath), priorArtifactBefore);

    const expectedRenewed = [
      "draft", "draft-questions-review", "draft-questions-triage", "draft-questions-repair",
      "draft-refine", "draft-coverage-review", "draft-coverage-triage", "draft-coverage-repair",
      "draft-gate", "spec", "spec-review", "spec-triage", "spec-repair", "spec-gate",
      "approval", "test", "scenario-validity", "test-review", "implement", "test-execute",
      "test-result-review", "impl-review", "impl-gate",
    ];
    const observed = [];
    for (const expected of expectedRenewed) {
      const target = findActiveNode(state);
      assert.equal(target.stepId, expected);
      observed.push(target.stepId);
      const active = flatten(state.steps).find((step) => step.id === expected);
      active.status = "done";
      delete active.startedAt;
      active.finishedAt = "2026-07-12T21:00:00.000Z";
      const next = promoteNextPendingLeaf(state.steps);
      if (next) {
        next.status = "in_progress";
        next.startedAt = "2026-07-12T21:00:00.001Z";
      }
    }
    assert.deepEqual(observed, expectedRenewed);
    assert.ok(observed.indexOf("approval") < observed.indexOf("implement"));
    assert.ok(observed.indexOf("test-execute") < observed.indexOf("impl-gate"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
