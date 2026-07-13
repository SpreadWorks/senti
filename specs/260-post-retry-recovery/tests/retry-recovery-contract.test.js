// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager, setupFlow, setupFlowConfig } from "../../../tests/helpers/flow-setup.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");
const recoveryPath = path.join(repoRoot, "src/flow/lib/retry-recovery.js");
const sentiBin = path.join(repoRoot, "src/senti.js");
const specId = "001-test";
const specPath = `specs/${specId}/spec.json`;
const artifactPath = `specs/${specId}/retry-recovery.json`;
const issueLogPath = `specs/${specId}/issue-log.json`;
const reason = "Re-evaluate after implementation evidence changed.";

async function loadRecovery() {
  assert.ok(fs.existsSync(recoveryPath), "src/flow/lib/retry-recovery.js should exist");
  return import(pathToFileURL(recoveryPath).href);
}

function readJson(root, relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

function writeFixtureSpec(root) {
  writeJson(root, specPath, {
    goal: "Retry recovery fixture.",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [{ id: "R1", priority: "must", status: "pending", desc: "fixture" }],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  });
  writeFile(root, `specs/${specId}/tests/recovery.test.js`, "test('fixture', () => {});\n");
}

function setStepStatus(steps, id, status) {
  for (const step of steps || []) {
    if (step.id === id) {
      step.status = status;
      return true;
    }
    if (setStepStatus(step.children, id, status)) return true;
  }
  return false;
}

function setupRecoveryFixture({
  activeStep = "task-gate",
  kind = "gate",
  phase = "task-impl",
  attempts = 3,
  maxAttempts = 3,
  baselineHash = "before",
  currentHash = "after",
  recovered = false,
} = {}) {
  const root = createTmpDir("retry-recovery-");
  setupFlowConfig(root, "ja");
  writeFixtureSpec(root);

  const metrics = Array.from({ length: attempts }, () => ({
    phase,
    counter: kind === "gate" ? "gateRetry" : "reviewRetry",
    delta: 1,
    taskId: null,
    ts: "2026-05-18T00:00:00.000Z",
  }));
  const state = setupFlow(root, {
    spec: specPath,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    metrics,
    reviewRecoveryBaselines: [
      {
        kind,
        phase,
        canonicalPhase: phase,
        fingerprint: {
          sourceKind: kind === "gate" ? "implementation-diff" : "spec-json",
          hash: baselineHash,
          paths: [kind === "gate" ? "src/changed.js" : specPath],
          truncated: false,
        },
        createdAt: "2026-05-18T00:00:00.000Z",
      },
    ],
    retryRecovery: recovered
      ? {
          version: 1,
          entries: [{
            id: "recovery-existing",
            kind,
            phase,
            canonicalPhase: phase,
            reason,
            changedEvidence: {
              sourceKind: kind === "gate" ? "implementation-diff" : "spec-json",
              baselineHash,
              currentHash,
              changedPaths: [kind === "gate" ? "src/changed.js" : specPath],
              truncated: false,
              changed: true,
            },
            permittedReevaluationCount: 1,
            attemptsBefore: maxAttempts,
            maxAttempts,
            counterAfter: maxAttempts - 1,
            recoveryCommand: `senti flow set retry reset ${kind} ${phase} --reason "${reason}" --yes`,
            createdAt: "2026-05-18T00:00:00.000Z",
          }],
        }
      : undefined,
  });
  setStepStatus(state.steps, activeStep, "in_progress");
  for (const task of state.tasks || []) {
    if (setStepStatus(task.steps, activeStep, "in_progress")) {
      setStepStatus(state.steps, "branch", "done");
      task.status = "in_progress";
      state.currentTaskId = task.id;
    }
  }
  writeJson(root, `specs/${specId}/flow.json`, state);
  writeJson(root, issueLogPath, { entries: [] });
  writeJson(root, artifactPath, { version: 1, entries: [] });
  writeFile(root, "src/changed.js", `export const value = "${currentHash}";\n`);
  return root;
}

function snapshotRecoveryFiles(root) {
  return {
    flow: fs.readFileSync(path.join(root, `specs/${specId}/flow.json`), "utf8"),
    issueLog: fs.readFileSync(path.join(root, issueLogPath), "utf8"),
    recovery: fs.readFileSync(path.join(root, artifactPath), "utf8"),
  };
}

function runSenti(root, args) {
  try {
    const stdout = execFileSync(process.execPath, [sentiBin, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: root },
    });
    return { status: 0, envelope: JSON.parse(stdout) };
  } catch (error) {
    return {
      status: error.status || 1,
      envelope: JSON.parse(error.stdout || "{}"),
      stderr: error.stderr || "",
    };
  }
}

function assertNoMutation(root, before) {
  assert.equal(fs.readFileSync(path.join(root, `specs/${specId}/flow.json`), "utf8"), before.flow);
  assert.equal(fs.readFileSync(path.join(root, issueLogPath), "utf8"), before.issueLog);
  assert.equal(fs.readFileSync(path.join(root, artifactPath), "utf8"), before.recovery);
}

describe("retry recovery contract", () => {
  const cleanup = [];
  afterEach(() => {
    while (cleanup.length > 0) removeTmpDir(cleanup.pop());
  });

  it("R1: TC-4 TC-5 TC-6 TC-7 TC-8 TC-9 TC-10: command input validates before side effects", async () => {
    const { RetryRecoveryInput } = await loadRecovery();
    const valid = new RetryRecoveryInput({
      action: "reset",
      kind: "gate",
      phase: "task-impl",
      reason,
      yes: true,
    });
    assert.equal(valid.kind, "gate");
    assert.equal(valid.canonicalPhase, "task-impl");

    const invalidInputs = [
      [{ action: "clear", kind: "gate", phase: "task-impl", reason, yes: true }, /action/i],
      [{ action: "reset", kind: "build", phase: "task-impl", reason, yes: true }, /kind/i],
      [{ action: "reset", kind: "gate", phase: "draft", reason, yes: true }, /phase/i],
      [{ action: "reset", kind: "review", phase: "integration", reason, yes: true }, /phase/i],
      [{ action: "reset", kind: "gate", phase: "task-impl", yes: true }, /reason/i],
      [{ action: "reset", kind: "review", phase: "spec", reason: "   ", yes: true }, /reason/i],
      [{ action: "reset", kind: "review", phase: "spec", reason: "x".repeat(501), yes: true }, /reason/i],
      [{ action: "reset", kind: "review", phase: "impl", reason, yes: false }, /yes/i],
    ];
    for (const [input, pattern] of invalidInputs) {
      assert.throws(() => new RetryRecoveryInput(input), pattern);
    }

    const root = setupRecoveryFixture();
    cleanup.push(root);
    const invalidCommands = [
      ["flow", "set", "retry", "clear", "gate", "task-impl", "--reason", reason, "--yes"],
      ["flow", "set", "retry", "reset", "build", "task-impl", "--reason", reason, "--yes"],
      ["flow", "set", "retry", "reset", "gate", "draft", "--reason", reason, "--yes"],
      ["flow", "set", "retry", "reset", "review", "integration", "--reason", reason, "--yes"],
      ["flow", "set", "retry", "reset", "gate", "task-impl", "--yes"],
      ["flow", "set", "retry", "reset", "review", "impl", "--reason", reason],
    ];
    for (const args of invalidCommands) {
      const before = snapshotRecoveryFiles(root);
      const result = runSenti(root, args);
      assert.notEqual(result.status, 0, `invalid command must fail: ${args.join(" ")}`);
      assert.equal(result.envelope.ok, false);
      assertNoMutation(root, before);
    }
  });

  it("R1: R2: R6: R7: TC-1 TC-2 TC-3: valid CLI recovery grants each recoverable target independently", async () => {
    const cases = [
      { kind: "gate", phase: "task-impl", activeStep: "task-gate" },
      { kind: "gate", phase: "integration", activeStep: "impl-gate" },
      { kind: "review", phase: "draft-questions", activeStep: "draft-questions-review" },
      { kind: "review", phase: "draft-coverage", activeStep: "draft-coverage-review" },
      { kind: "review", phase: "spec", activeStep: "spec-review" },
      { kind: "review", phase: "test", activeStep: "test-review" },
      { kind: "review", phase: "impl", activeStep: "impl-review" },
    ];

    for (const item of cases) {
      const root = setupRecoveryFixture(item);
      cleanup.push(root);
      const result = runSenti(root, [
        "flow",
        "set",
        "retry",
        "reset",
        item.kind,
        item.phase,
        "--reason",
        reason,
        "--yes",
      ]);
      assert.equal(result.status, 0, `${item.kind}/${item.phase} reset should exit 0`);
      assert.equal(result.envelope.ok, true);
      const flow = readJson(root, `specs/${specId}/flow.json`);
      const recovery = readJson(root, artifactPath);
      const issueLog = readJson(root, issueLogPath);
      assert.equal(recovery.entries.length, 1, `${item.kind}/${item.phase} writes one recovery artifact entry`);
      assert.equal(issueLog.entries.length, 1, `${item.kind}/${item.phase} writes one issue-log entry`);
      assert.equal(recovery.entries[0].kind, item.kind);
      assert.equal(recovery.entries[0].phase, item.phase);
      assert.equal(recovery.entries[0].counterAfter, 2);
      assert.equal(flow.metrics.at(-1).delta, 2, "reset grant leaves one reevaluation before exhaustion");
    }
  });

  it("R1: TC-9: reason length boundary accepts the configured maximum and rejects maximum plus one", async () => {
    const { RECOVERY_REASON_MAX_LENGTH, RetryRecoveryInput } = await loadRecovery();
    const maxReason = "x".repeat(RECOVERY_REASON_MAX_LENGTH);
    const valid = new RetryRecoveryInput({
      action: "reset",
      kind: "review",
      phase: "spec",
      reason: maxReason,
      yes: true,
    });
    assert.equal(valid.reason.length, RECOVERY_REASON_MAX_LENGTH);
    assert.throws(() => new RetryRecoveryInput({
      action: "reset",
      kind: "review",
      phase: "spec",
      reason: `${maxReason}x`,
      yes: true,
    }), /reason/i);
  });

  it("R2: recoverable target matrix is strict and displayable", async () => {
    const { resolveRecoveryTarget, buildRetryRecoveryView } = await loadRecovery();

    for (const phase of ["task-impl", "integration"]) {
      assert.deepEqual(resolveRecoveryTarget("gate", phase).toJSON(), {
        kind: "gate",
        phase,
        canonicalPhase: phase,
        recoverable: true,
        reason: "recoverable",
      });
    }
    for (const [phase, canonicalPhase] of [
      ["draft-questions", "draft-questions"],
      ["draft-coverage", "draft-coverage"],
      ["draft-questions-review", "draft-questions"],
      ["draft-coverage-review", "draft-coverage"],
      ["spec", "spec"],
      ["test", "test"],
      ["impl", "impl"],
    ]) {
      const target = resolveRecoveryTarget("review", phase);
      assert.equal(target.recoverable, true);
      assert.equal(target.canonicalPhase, canonicalPhase);
    }

    for (const phase of ["draft", "spec"]) {
      const target = resolveRecoveryTarget("gate", phase);
      assert.equal(target.recoverable, false);
      assert.equal(target.reason, "unsupported-plan-gate-phase");
      const view = buildRetryRecoveryView({
        kind: "gate",
        phase,
        canonicalPhase: phase,
        attempts: 3,
        max: 3,
        recoveryPossible: false,
        recoveryReason: target.reason,
        changedEvidence: null,
        reason,
      });
      assert.equal(view.recoveryPossible, false);
      assert.equal(view.recoveryCommand, null);
    }
  });

  it("R2: R8: TC-11 TC-12: exhausted gate draft and spec display no recovery command and reject reset", () => {
    for (const phase of ["draft", "spec"]) {
      const root = setupRecoveryFixture({
        activeStep: phase === "draft" ? "draft-gate" : "spec-gate",
        kind: "gate",
        phase,
      });
      cleanup.push(root);
      const next = runSenti(root, ["flow", "get", "next-action"]);
      const status = runSenti(root, ["flow", "get", "status"]);
      for (const envelope of [next.envelope, status.envelope]) {
        const view = envelope.data.retryRecovery || envelope.data.gateStop || envelope.data.reviewStop;
        assert.equal(view.kind, "gate");
        assert.equal(view.phase, phase);
        assert.equal(view.recoveryPossible, false);
        assert.equal(view.recoveryReason, "unsupported-plan-gate-phase");
        assert.equal(view.recoveryCommand, null);
      }
      const before = snapshotRecoveryFiles(root);
      const reset = runSenti(root, [
        "flow",
        "set",
        "retry",
        "reset",
        "gate",
        phase,
        "--reason",
        reason,
        "--yes",
      ]);
      assert.notEqual(reset.status, 0);
      assert.equal(reset.envelope.ok, false);
      assertNoMutation(root, before);
    }
  });

  it("R3: TC-13 TC-14: review FAIL and review stop persist canonical phase baselines before exhaustion", async () => {
    const {
      EvidenceFingerprint,
      ReviewRecoveryBaseline,
      persistReviewRecoveryBaseline,
    } = await loadRecovery();
    const state = { reviewRecoveryBaselines: [] };
    const fingerprint = new EvidenceFingerprint({
      sourceKind: "spec-json",
      hash: "spec-before",
      paths: [specPath],
      truncated: false,
    });

    const failBaseline = persistReviewRecoveryBaseline(state, {
      phase: "draft-questions-review",
      trigger: "review-verdict-fail",
      fingerprint,
      createdAt: "2026-05-18T00:00:00.000Z",
    });
    const stopBaseline = persistReviewRecoveryBaseline(state, {
      phase: "spec",
      trigger: "review-stop",
      fingerprint,
      createdAt: "2026-05-18T00:00:01.000Z",
    });

    assert.ok(failBaseline instanceof ReviewRecoveryBaseline);
    assert.equal(failBaseline.canonicalPhase, "draft-questions");
    assert.equal(stopBaseline.canonicalPhase, "spec");
    assert.deepEqual(state.reviewRecoveryBaselines.map((entry) => entry.trigger), [
      "review-verdict-fail",
      "review-stop",
    ]);
  });

  it("R4: R5: TC-15 TC-16: eligibility uses mapped evidence and latest matching baseline", async () => {
    const {
      EvidenceFingerprint,
      ReviewRecoveryBaseline,
      evaluateRecoveryEligibility,
      resolveRecoveryEvidenceSource,
    } = await loadRecovery();
    const oldDraftBaseline = new ReviewRecoveryBaseline({
      kind: "review",
      phase: "draft-questions",
      canonicalPhase: "draft-questions",
      fingerprint: new EvidenceFingerprint({
        sourceKind: "draft-json",
        hash: "old-draft",
        paths: ["specs/001-test/draft.json"],
        truncated: false,
      }),
      createdAt: "2026-05-18T00:00:00.000Z",
    });
    const matchingBaseline = new ReviewRecoveryBaseline({
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      fingerprint: new EvidenceFingerprint({
        sourceKind: "spec-json",
        hash: "spec-before",
        paths: [specPath],
        truncated: false,
      }),
      createdAt: "2026-05-18T00:00:01.000Z",
    });
    const current = new EvidenceFingerprint({
      sourceKind: "spec-json",
      hash: "spec-after",
      paths: [specPath, "unmapped.log"],
      truncated: false,
    });

    const eligibility = evaluateRecoveryEligibility({
      kind: "review",
      phase: "spec",
      maxAttempts: 3,
      attempts: 3,
      baselines: [oldDraftBaseline, matchingBaseline],
      currentFingerprint: current,
      mappedSource: resolveRecoveryEvidenceSource({
        kind: "review",
        canonicalPhase: "spec",
        specDir: `specs/${specId}`,
      }),
    });
    assert.equal(eligibility.recoverable, true);
    assert.equal(eligibility.changedEvidence.changed, true);
    assert.deepEqual(eligibility.changedEvidence.changedPaths, [specPath]);

    const unchanged = evaluateRecoveryEligibility({
      kind: "review",
      phase: "spec",
      maxAttempts: 3,
      attempts: 3,
      baselines: [matchingBaseline],
      currentFingerprint: matchingBaseline.fingerprint,
      mappedSource: resolveRecoveryEvidenceSource({
        kind: "review",
        canonicalPhase: "spec",
        specDir: `specs/${specId}`,
      }),
    });
    assert.equal(unchanged.recoverable, false);
    assert.equal(unchanged.reason, "unchanged-evidence");

    const missingBaseline = evaluateRecoveryEligibility({
      kind: "gate",
      phase: "task-impl",
      maxAttempts: 3,
      attempts: 3,
      baselines: [matchingBaseline],
      currentFingerprint: current,
      mappedSource: resolveRecoveryEvidenceSource({
        kind: "gate",
        canonicalPhase: "task-impl",
        specDir: `specs/${specId}`,
      }),
    });
    assert.equal(missingBaseline.recoverable, false);
    assert.equal(missingBaseline.reason, "missing-baseline");
  });

  it("R5: TC-17: unchanged exhausted reset is rejected by CLI without byte changes", () => {
    const root = setupRecoveryFixture({
      activeStep: "spec-review",
      kind: "review",
      phase: "spec",
      baselineHash: "same",
      currentHash: "same",
    });
    cleanup.push(root);
    const before = snapshotRecoveryFiles(root);
    const result = runSenti(root, [
      "flow",
      "set",
      "retry",
      "reset",
      "review",
      "spec",
      "--reason",
      reason,
      "--yes",
    ]);
    assert.notEqual(result.status, 0);
    assert.equal(result.envelope.ok, false);
    assert.equal(result.envelope.errors[0].code, "UNCHANGED_EVIDENCE");
    assertNoMutation(root, before);
  });

  it("R5: R6: R7: TC-18 TC-19 TC-20: granted recovery appends audit artifacts after eligibility succeeds", async () => {
    const {
      ChangedEvidenceSummary,
      RetryRecoveryInput,
      applyRetryRecoveryGrant,
      buildOneAttemptGrantMetrics,
      RECOVERY_ARTIFACT_FILE,
    } = await loadRecovery();
    const root = setupRecoveryFixture({ attempts: 4, maxAttempts: 4 });
    cleanup.push(root);
    const flowPath = path.join(root, `specs/${specId}/flow.json`);
    const input = new RetryRecoveryInput({
      action: "reset",
      kind: "gate",
      phase: "task-impl",
      reason,
      yes: true,
    });
    const changedEvidence = new ChangedEvidenceSummary({
      sourceKind: "implementation-diff",
      baselineHash: "before",
      currentHash: "after",
      changedPaths: ["src/changed.js"],
      truncated: false,
    });

    const before = readJson(root, `specs/${specId}/flow.json`);
    const grant = applyRetryRecoveryGrant({
      root,
      spec: specPath,
      flowManager: makeFlowManager(root),
      input,
      eligibility: { recoverable: true, changedEvidence },
      attemptsBefore: 4,
      maxAttempts: 4,
      createdAt: "2026-05-18T00:00:02.000Z",
    });

    assert.equal(RECOVERY_ARTIFACT_FILE, "retry-recovery.json");
    assert.equal(grant.counterAfter, 3);
    assert.deepEqual(buildOneAttemptGrantMetrics({
      counter: "gateRetry",
      phase: "task-impl",
      maxAttempts: 4,
    }), [
      { phase: "task-impl", counter: "gateRetry", delta: 0, reset: true },
      { phase: "task-impl", counter: "gateRetry", delta: 3 },
    ]);

    const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    const recoveryLog = readJson(root, artifactPath);
    const issueLog = readJson(root, issueLogPath);
    const lastMetric = flow.metrics.at(-1);
    const entry = recoveryLog.entries.at(-1);
    const issue = issueLog.entries.at(-1);

    assert.equal(entry.kind, "gate");
    assert.equal(entry.phase, "task-impl");
    assert.equal(entry.canonicalPhase, "task-impl");
    assert.equal(entry.reason, reason);
    assert.equal(entry.permittedReevaluationCount, 1);
    assert.equal(entry.attemptsBefore, 4);
    assert.equal(entry.maxAttempts, 4);
    assert.equal(entry.counterAfter, 3);
    assert.equal(entry.recoveryCommand, `senti flow set retry reset gate task-impl --reason "${reason}" --yes`);
    assert.equal(issue.recoveryCommand, entry.recoveryCommand);
    assert.equal(issue.createdAt, entry.createdAt);
    assert.equal(lastMetric.counter, "gateRetry");
    assert.equal(lastMetric.delta, 3);
    assert.ok(new Date(lastMetric.ts) >= new Date(entry.createdAt), "metrics are appended after artifact creation");
  });

  it("R7: TC-20: counterAfter is maxAttempts minus one for boundary values", async () => {
    const { buildOneAttemptGrantMetrics } = await loadRecovery();
    for (const maxAttempts of [1, 2, 3]) {
      const metrics = buildOneAttemptGrantMetrics({
        counter: "reviewRetry",
        phase: "spec",
        maxAttempts,
      });
      assert.deepEqual(metrics, [
        { phase: "spec", counter: "reviewRetry", delta: 0, reset: true },
        { phase: "spec", counter: "reviewRetry", delta: maxAttempts - 1 },
      ]);
    }
  });

  it("R6: separate recovery grants append audit entries in chronological order", async () => {
    const {
      ChangedEvidenceSummary,
      RetryRecoveryInput,
      applyRetryRecoveryGrant,
    } = await loadRecovery();
    const root = setupRecoveryFixture();
    cleanup.push(root);
    const firstFlow = readJson(root, `specs/${specId}/flow.json`);
    applyRetryRecoveryGrant({
      root,
      spec: specPath,
      flowManager: makeFlowManager(root),
      input: new RetryRecoveryInput({
        action: "reset",
        kind: "gate",
        phase: "task-impl",
        reason,
        yes: true,
      }),
      eligibility: {
        recoverable: true,
        changedEvidence: new ChangedEvidenceSummary({
          sourceKind: "implementation-diff",
          baselineHash: "a",
          currentHash: "b",
          changedPaths: ["src/a.js"],
          truncated: false,
        }),
      },
      attemptsBefore: 3,
      maxAttempts: 3,
      createdAt: "2026-05-18T00:00:01.000Z",
    });
    const secondFlow = readJson(root, `specs/${specId}/flow.json`);
    applyRetryRecoveryGrant({
      root,
      spec: specPath,
      flowManager: makeFlowManager(root),
      input: new RetryRecoveryInput({
        action: "reset",
        kind: "review",
        phase: "spec",
        reason,
        yes: true,
      }),
      eligibility: {
        recoverable: true,
        changedEvidence: new ChangedEvidenceSummary({
          sourceKind: "spec-json",
          baselineHash: "b",
          currentHash: "c",
          changedPaths: [specPath],
          truncated: false,
        }),
      },
      attemptsBefore: 3,
      maxAttempts: 3,
      createdAt: "2026-05-18T00:00:02.000Z",
    });
    const recovery = readJson(root, artifactPath);
    const issueLog = readJson(root, issueLogPath);
    assert.deepEqual(recovery.entries.map((entry) => entry.kind), ["gate", "review"]);
    assert.deepEqual(issueLog.entries.map((entry) => entry.kind), ["gate", "review"]);
    assert.ok(recovery.entries[0].createdAt < recovery.entries[1].createdAt);
  });

  it("rolls artifact, issue-log, and flow bytes back when the atomic flow save fails", async () => {
    const {
      ChangedEvidenceSummary,
      RetryRecoveryInput,
      applyRetryRecoveryGrant,
    } = await loadRecovery();
    const root = setupRecoveryFixture({ attempts: 3, maxAttempts: 3 });
    cleanup.push(root);
    const before = snapshotRecoveryFiles(root);

    assert.throws(() => applyRetryRecoveryGrant({
      root,
      spec: specPath,
      flowManager: makeFlowManager(root),
      input: new RetryRecoveryInput({
        action: "reset",
        kind: "gate",
        phase: "task-impl",
        reason,
        yes: true,
      }),
      eligibility: {
        recoverable: true,
        changedEvidence: new ChangedEvidenceSummary({
          sourceKind: "implementation-diff",
          baselineHash: "before",
          currentHash: "after",
          changedPaths: ["src/changed.js"],
          truncated: false,
        }),
      },
      attemptsBefore: 3,
      maxAttempts: 3,
      faultInjector({ phase }) {
        if (phase === "before-state-temp-write") throw new Error("injected flow save failure");
      },
    }), /injected flow save failure/);

    assertNoMutation(root, before);
  });

  it("R6: requirement verification exposes the full recovery audit entry schema", async () => {
    const { ChangedEvidenceSummary, RetryRecoveryEntry } = await loadRecovery();
    const entry = new RetryRecoveryEntry({
      id: "recovery-schema",
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      reason,
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "spec-json",
        baselineHash: "before",
        currentHash: "after",
        changedPaths: [specPath],
        truncated: false,
      }),
      permittedReevaluationCount: 1,
      attemptsBefore: 3,
      maxAttempts: 3,
      counterAfter: 2,
      recoveryCommand: `senti flow set retry reset review spec --reason "${reason}" --yes`,
      createdAt: "2026-05-18T00:00:02.000Z",
    }).toJSON();

    assert.deepEqual(Object.keys(entry), [
      "id",
      "kind",
      "phase",
      "canonicalPhase",
      "reason",
      "changedEvidence",
      "permittedReevaluationCount",
      "attemptsBefore",
      "maxAttempts",
      "counterAfter",
      "recoveryCommand",
      "createdAt",
    ]);
  });

  it("R7: R9: TC-21 TC-22 TC-25: one reevaluation re-exhausts, pass resets, and second recovery needs new evidence", async () => {
    const {
      ChangedEvidenceSummary,
      applyRecoveredRetryOutcome,
      buildRetryRecoveryView,
      evaluateRepeatedRecovery,
    } = await loadRecovery();
    const state = {
      metrics: [
        { phase: "spec", counter: "reviewRetry", delta: 0, reset: true },
        { phase: "spec", counter: "reviewRetry", delta: 2 },
      ],
      retryRecovery: { version: 1, entries: [{ kind: "review", canonicalPhase: "spec" }] },
    };

    const failed = applyRecoveredRetryOutcome(state, {
      kind: "review",
      phase: "spec",
      verdict: "fail",
      maxAttempts: 3,
    });
    assert.equal(failed.counterAfter, 3);
    assert.equal(failed.exhausted, true);
    const repeated = buildRetryRecoveryView({
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      attempts: 3,
      max: 3,
      recoveryPossible: false,
      recoveryReason: "one-recovery-already-used",
      changedEvidence: null,
      reason,
    });
    assert.equal(repeated.recoveryCommand, null);

    const unchangedSecond = evaluateRepeatedRecovery({
      priorRecoveryEntries: state.retryRecovery.entries,
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "spec-json",
        baselineHash: "same",
        currentHash: "same",
        changedPaths: [],
        truncated: false,
      }),
    });
    assert.equal(unchangedSecond.recoverable, false);
    assert.equal(unchangedSecond.reason, "unchanged-evidence");

    const changedSecond = evaluateRepeatedRecovery({
      priorRecoveryEntries: state.retryRecovery.entries,
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "spec-json",
        baselineHash: "same",
        currentHash: "new",
        changedPaths: [specPath],
        truncated: false,
      }),
    });
    assert.equal(changedSecond.recoverable, true);

    const passed = applyRecoveredRetryOutcome(state, {
      kind: "review",
      phase: "spec",
      verdict: "pass",
      maxAttempts: 3,
    });
    assert.equal(passed.counterAfter, 0);
    assert.equal(passed.exhausted, false);
  });

  it("R7: R9: TC-21 TC-22 TC-25: subsequent fail re-exhausts, pass resets, and unchanged second reset is rejected", async () => {
    const {
      ChangedEvidenceSummary,
      applyRecoveredRetryOutcome,
      evaluateRepeatedRecovery,
    } = await loadRecovery();
    const state = {
      metrics: [
        { phase: "task-impl", counter: "gateRetry", delta: 0, reset: true },
        { phase: "task-impl", counter: "gateRetry", delta: 2 },
      ],
      retryRecovery: {
        version: 1,
        entries: [{ kind: "gate", canonicalPhase: "task-impl", createdAt: "2026-05-18T00:00:01.000Z" }],
      },
    };

    const fail = applyRecoveredRetryOutcome(state, {
      kind: "gate",
      phase: "task-impl",
      verdict: "fail",
      maxAttempts: 3,
    });
    assert.equal(fail.counterAfter, 3);
    assert.equal(fail.exhausted, true);
    assert.equal(fail.autoRecoveryGranted, false);

    const repeated = evaluateRepeatedRecovery({
      priorRecoveryEntries: state.retryRecovery.entries,
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "implementation-diff",
        baselineHash: "same",
        currentHash: "same",
        changedPaths: [],
        truncated: false,
      }),
    });
    assert.equal(repeated.recoverable, false);
    assert.equal(repeated.reason, "unchanged-evidence");

    const pass = applyRecoveredRetryOutcome(state, {
      kind: "gate",
      phase: "task-impl",
      verdict: "pass",
      maxAttempts: 3,
    });
    assert.equal(pass.counterAfter, 0);
    assert.equal(pass.exhausted, false);
  });

  it("R9: requirement verification does not expose an automatic second recovery command", async () => {
    const { buildRetryRecoveryView } = await loadRecovery();
    const view = buildRetryRecoveryView({
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      attempts: 3,
      max: 3,
      recoveryPossible: false,
      recoveryReason: "one-recovery-already-used",
      changedEvidence: null,
      reason,
    });

    assert.equal(view.recoveryPossible, false);
    assert.equal(view.recoveryCommand, null);
  });

  it("R8: TC-23 TC-24: next-action and status show exhausted recovery details", async () => {
    const root = setupRecoveryFixture({ activeStep: "spec-review", kind: "review", phase: "spec" });
    cleanup.push(root);
    const reset = runSenti(root, ["flow", "set", "retry", "reset", "review", "spec", "--reason", reason, "--yes"]);
    assert.equal(reset.status, 0);
    assert.equal(reset.envelope.ok, true);

    const next = runSenti(root, ["flow", "get", "next-action"]);
    const status = runSenti(root, ["flow", "get", "status"]);
    for (const envelope of [next.envelope, status.envelope]) {
      const view = envelope.data.reviewStop || envelope.data.retryRecovery;
      assert.equal(view.kind, "review");
      assert.equal(view.phase, "spec");
      assert.equal(view.canonicalPhase, "spec");
      assert.equal(view.attempts, 3);
      assert.equal(view.max, 3);
      assert.equal(view.recoveryPossible, true);
      assert.equal(view.recoveryReason, "changed-evidence");
      assert.deepEqual(view.changedEvidence.changedPaths, [specPath]);
      assert.match(view.recoveryCommand, /flow set retry reset review spec --reason/);
    }
  });

  it("R8: TC-23 TC-24: next-action and status display gate, review, and unrecoverable exhaustion", () => {
    const cases = [
      { kind: "gate", phase: "integration", activeStep: "impl-gate", recoverable: true },
      { kind: "review", phase: "spec", activeStep: "spec-review", recoverable: true },
      { kind: "gate", phase: "spec", activeStep: "spec-gate", recoverable: false },
    ];

    for (const item of cases) {
      const root = setupRecoveryFixture(item);
      cleanup.push(root);
      const next = runSenti(root, ["flow", "get", "next-action"]);
      const status = runSenti(root, ["flow", "get", "status"]);
      for (const envelope of [next.envelope, status.envelope]) {
        const view = envelope.data.retryRecovery || envelope.data.reviewStop || envelope.data.gateStop;
        assert.ok(view, `missing retry recovery view for ${item.kind}/${item.phase}: ${JSON.stringify(envelope.data)}`);
        assert.equal(view.kind, item.kind);
        assert.equal(view.phase, item.phase);
        assert.equal(view.canonicalPhase, item.phase);
        assert.equal(view.attempts, 3);
        assert.equal(view.max, 3);
        assert.equal(view.recoveryPossible, item.recoverable);
        if (item.recoverable) {
          assert.equal(view.recoveryReason, "changed-evidence");
          assert.deepEqual(view.changedEvidence.changedPaths.length > 0, true);
          assert.match(view.recoveryCommand, /flow set retry reset/);
        } else {
          assert.equal(view.recoveryReason, "unsupported-plan-gate-phase");
          assert.equal(view.recoveryCommand, null);
        }
      }
    }
  });

  it("R8: TC-23 TC-24: recovery display distinguishes changed and unchanged evidence", async () => {
    const { ChangedEvidenceSummary, buildRetryRecoveryView } = await loadRecovery();
    const changed = buildRetryRecoveryView({
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      attempts: 3,
      max: 3,
      recoveryPossible: true,
      recoveryReason: "changed-evidence",
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "spec-json",
        baselineHash: "before",
        currentHash: "after",
        changedPaths: [specPath],
        truncated: false,
      }),
      reason,
    });
    assert.equal(changed.recoveryPossible, true);
    assert.deepEqual(changed.changedEvidence.changedPaths, [specPath]);
    assert.match(changed.recoveryCommand, /--reason/);

    const unchanged = buildRetryRecoveryView({
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      attempts: 3,
      max: 3,
      recoveryPossible: false,
      recoveryReason: "unchanged-evidence",
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "spec-json",
        baselineHash: "same",
        currentHash: "same",
        changedPaths: [],
        truncated: false,
      }),
      reason,
    });
    assert.equal(unchanged.recoveryPossible, false);
    assert.equal(unchanged.recoveryCommand, null);
    assert.equal(unchanged.recoveryReason, "unchanged-evidence");
  });

  it("R4: R6: R7: TC-18 TC-19 TC-20: resolved maxAttempts and audit command/timestamps stay consistent", async () => {
    const {
      ChangedEvidenceSummary,
      RetryRecoveryInput,
      applyRetryRecoveryGrant,
      buildRetryRecoveryView,
    } = await loadRecovery();
    const root = setupRecoveryFixture({ attempts: 5, maxAttempts: 5 });
    cleanup.push(root);
    const command = `senti flow set retry reset gate task-impl --reason "${reason}" --yes`;
    const changedEvidence = new ChangedEvidenceSummary({
      sourceKind: "implementation-diff",
      baselineHash: "before",
      currentHash: "after",
      changedPaths: ["src/changed.js"],
      truncated: false,
    });
    const grant = applyRetryRecoveryGrant({
      root,
      spec: specPath,
      flowManager: makeFlowManager(root),
      input: new RetryRecoveryInput({
        action: "reset",
        kind: "gate",
        phase: "task-impl",
        reason,
        yes: true,
      }),
      eligibility: { recoverable: true, changedEvidence },
      attemptsBefore: 5,
      maxAttempts: 5,
      createdAt: "2026-05-18T00:00:05.000Z",
    });
    const artifact = readJson(root, artifactPath).entries.at(-1);
    const issue = readJson(root, issueLogPath).entries.at(-1);
    const view = buildRetryRecoveryView({
      kind: "gate",
      phase: "task-impl",
      canonicalPhase: "task-impl",
      attempts: 5,
      max: 5,
      recoveryPossible: true,
      recoveryReason: "changed-evidence",
      changedEvidence,
      reason,
    });

    assert.equal(grant.counterAfter, 4);
    assert.equal(artifact.attemptsBefore, 5);
    assert.equal(artifact.maxAttempts, 5);
    assert.equal(artifact.counterAfter, 4);
    assert.equal(artifact.createdAt, "2026-05-18T00:00:05.000Z");
    assert.equal(issue.createdAt, artifact.createdAt);
    assert.equal(artifact.recoveryCommand, command);
    assert.equal(issue.recoveryCommand, command);
    assert.equal(view.recoveryCommand, command);
  });

  it("R10: TC-26 TC-27 TC-28: CLI help, prompts, and generated skill template document audited recovery", () => {
    const help = execFileSync(process.execPath, [
      sentiBin,
      "flow",
      "set",
      "retry",
      "--help",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.match(help, /flow set retry reset <gate\|review> <phase> --reason <text> --yes/);
    assert.match(help, /one re-evaluation/);
    assert.match(help, /unchanged evidence/i);

    const prompt = fs.readFileSync(path.join(repoRoot, "src/flow/prompts/task/task-review.md"), "utf8");
    const template = fs.readFileSync(path.join(repoRoot, "src/skills/senti.flow/SKILL.md"), "utf8");
    for (const text of [prompt, template]) {
      assert.match(text, /flow set retry reset <gate\|review> <phase> --reason <text> --yes/);
      assert.match(text, /required --reason|reason is required/i);
      assert.match(text, /one re-evaluation/);
      assert.match(text, /unchanged/i);
    }
  });

  it("R11: TC-29: spec-local lifecycle covers eligible recovery, unchanged rejection, display, repeated failure, and pass reset", async () => {
    const {
      ChangedEvidenceSummary,
      RetryRecoveryInput,
      applyRecoveredRetryOutcome,
      applyRetryRecoveryGrant,
      buildRetryRecoveryView,
      evaluateRecoveryEligibility,
    } = await loadRecovery();
    const root = setupRecoveryFixture({ activeStep: "task-gate", kind: "gate", phase: "task-impl" });
    cleanup.push(root);
    const flow = readJson(root, `specs/${specId}/flow.json`);
    const input = new RetryRecoveryInput({
      action: "reset",
      kind: "gate",
      phase: "task-impl",
      reason,
      yes: true,
    });
    const unchanged = evaluateRecoveryEligibility({
      kind: "gate",
      phase: "task-impl",
      attempts: 3,
      maxAttempts: 3,
      baselines: flow.reviewRecoveryBaselines,
      currentFingerprint: flow.reviewRecoveryBaselines[0].fingerprint,
    });
    assert.equal(unchanged.recoverable, false);

    const changedEvidence = new ChangedEvidenceSummary({
      sourceKind: "implementation-diff",
      baselineHash: "before",
      currentHash: "after",
      changedPaths: ["src/changed.js"],
      truncated: false,
    });
    const grant = applyRetryRecoveryGrant({
      root,
      spec: specPath,
      flowManager: makeFlowManager(root),
      input,
      eligibility: { recoverable: true, changedEvidence },
      attemptsBefore: 3,
      maxAttempts: 3,
      createdAt: "2026-05-18T00:00:03.000Z",
    });
    assert.equal(grant.counterAfter, 2);

    const display = buildRetryRecoveryView({
      kind: "gate",
      phase: "task-impl",
      canonicalPhase: "task-impl",
      attempts: 3,
      max: 3,
      recoveryPossible: true,
      recoveryReason: "changed-evidence",
      changedEvidence,
      reason,
    });
    assert.match(display.recoveryCommand, /flow set retry reset gate task-impl/);

    const fail = applyRecoveredRetryOutcome(flow, {
      kind: "gate",
      phase: "task-impl",
      verdict: "fail",
      maxAttempts: 3,
    });
    assert.equal(fail.exhausted, true);
    const pass = applyRecoveredRetryOutcome(flow, {
      kind: "gate",
      phase: "task-impl",
      verdict: "pass",
      maxAttempts: 3,
    });
    assert.equal(pass.counterAfter, 0);
  });
});
