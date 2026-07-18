// spec: R1 R2 R3 R4 R5 R6
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeFlowManager, replaceFlowState } from "../../../tests/helpers/flow-setup.js";
import { buildInitialSteps, buildInitialTaskSteps } from "../../../src/lib/flow-helpers.js";
import { flattenSteps, findStepById } from "../../../src/flow/lib/step-tree.js";
import {
  classifyGateRetryExhaustionSource,
  countGateRetry,
} from "../../../src/flow/lib/run-gate.js";
import * as runGateModule from "../../../src/flow/lib/run-gate.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sourceSpecDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "src", "senti.js");
const specId = "318-semantic-deferral";
const specPath = `specs/${specId}/spec.json`;
const runId = "run-semantic-432";
const issue = 432;
const targetGuards = [
  "--expect-run-id", runId,
  "--expect-issue", String(issue),
  "--expect-spec", specPath,
];

const tmpDirs = [];

afterEach(() => {
  for (const tmp of tmpDirs.splice(0)) {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function setOnlyStepInProgress(state, stepId) {
  let beforeTarget = true;
  for (const step of flattenSteps(state.steps)) {
    if (step.id === stepId) {
      step.status = "in_progress";
      beforeTarget = false;
    } else {
      step.status = beforeTarget ? "done" : "pending";
    }
  }
  assert.ok(findStepById(state.steps, stepId), `step ${stepId} must exist`);
}

function semanticArtifact(phase) {
  return {
    version: 1,
    phase,
    result: "fail",
    evaluations: [
      {
        guardrail_id: "complete-context",
        result: "fail",
        reason: "One wording finding remains for final acceptance disposition.",
      },
      {
        guardrail_id: "unambiguous-requirements",
        result: "fail",
        reason: "A second wording finding remains for final acceptance disposition.",
      },
    ],
    observations: [],
  };
}

function initializeGitFixture(root) {
  for (const args of [
    ["init"],
    ["config", "user.email", "fixture@example.com"],
    ["config", "user.name", "Fixture"],
    ["add", "."],
    ["commit", "-m", "fixture"],
  ]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
}

function createFixture({
  phase = "spec",
  artifact = semanticArtifact(phase),
  rawArtifact = null,
  gitFixture = false,
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plan-gate-semantic-"));
  tmpDirs.push(root);

  const providerCount = path.join(root, "provider-count.txt");
  const providerScript = path.join(root, "provider-spy.js");
  fs.writeFileSync(providerScript, [
    "const fs = require('node:fs');",
    `fs.appendFileSync(${JSON.stringify(providerCount)}, 'called\\n');`,
    "process.stdout.write(JSON.stringify({ evaluations: [] }));",
  ].join("\n"));
  writeJson(path.join(root, ".senti", "config.json"), {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    agent: {
      default: "stub",
      providers: {
        stub: { command: process.execPath, args: [providerScript], jsonOutputFlag: null },
      },
    },
  });

  const targetDir = path.join(root, "specs", specId);
  fs.mkdirSync(targetDir, { recursive: true });
  const spec = readJson(path.join(sourceSpecDir, "spec.json"));
  writeJson(path.join(targetDir, "spec.json"), spec);
  if (phase === "draft") {
    for (const file of [
      "draft.json",
      "draft-review-questions.json",
      "draft-questions-triage.json",
      "draft-questions-repair.json",
      "draft-review-coverage.json",
      "draft-coverage-triage.json",
      "draft-coverage-repair.json",
    ]) {
      fs.copyFileSync(path.join(sourceSpecDir, file), path.join(targetDir, file));
    }
  }

  const state = {
    spec: specPath,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    issue,
    runId,
    autoApprove: false,
    worktree: false,
    steps: buildInitialSteps(),
    requirements: spec.requirements,
    tasks: spec.tasks.map((task) => ({ ...task, steps: [] })),
    currentTaskId: null,
    metrics: Array.from({ length: 5 }, () => ({
      phase,
      counter: "gateRetry",
      delta: 1,
      taskId: null,
      ts: new Date().toISOString(),
    })),
  };
  setOnlyStepInProgress(state, `${phase}-gate`);
  const manager = makeFlowManager(root);
  manager.create(state);
  manager.addActiveFlow(specId, "branch");

  const sourceFile = path.join(targetDir, `${phase}-gate-source.json`);
  if (rawArtifact != null) {
    fs.writeFileSync(sourceFile, rawArtifact);
  } else if (artifact != null) {
    writeJson(sourceFile, artifact);
  }
  if (gitFixture) initializeGitFixture(root);

  return { root, targetDir, sourceFile, providerCount, phase };
}

function runFlow(root, args) {
  const result = spawnSync(process.execPath, [cliPath, "flow", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: root },
  });
  const transport = JSON.stringify({
    status: result.status,
    signal: result.signal,
    error: result.error ? String(result.error) : null,
    stderr: result.stderr,
  }, null, 2);
  assert.equal(result.error == null, true, transport);
  assert.equal(result.signal, null, transport);
  assert.ok(typeof result.stdout === "string" && result.stdout.trim() !== "", transport);
  const stdout = result.stdout.trim();
  return { ...result, envelope: stdout ? JSON.parse(stdout) : null };
}

function nextAction(root, guards = targetGuards) {
  return runFlow(root, ["get", "next-action", ...guards]);
}

function semanticRecovery(data, phase = "spec") {
  assert.equal(data.step, `${phase}-gate`);
  assert.equal(data.retryRecovery?.recoveryPossible, true);
  assert.equal(data.retryRecovery?.recoveryReason, "semantic_findings");
  return data.retryRecovery;
}

function stateSnapshot(root, phase = "spec") {
  const state = makeFlowManager(root).load();
  return {
    attempts: countGateRetry(state.metrics, phase),
    gateStatus: findStepById(state.steps, `${phase}-gate`)?.status,
  };
}

function createRetryFixture(phase, { unchanged = false } = {}) {
  const fixture = createFixture();
  const manager = makeFlowManager(fixture.root);
  const state = manager.load();
  state.metrics = Array.from({ length: 5 }, () => ({
    phase,
    counter: "gateRetry",
    delta: 1,
    taskId: null,
    ts: new Date().toISOString(),
  }));
  const sourceKind = phase === "task-impl"
    ? "implementation-diff"
    : "implementation-and-test-artifacts";
  state.reviewRecoveryBaselines = [{
    kind: "gate",
    phase,
    canonicalPhase: phase,
    fingerprint: {
      sourceKind,
      hash: unchanged ? "same" : "0".repeat(64),
      paths: ["src/changed.js"],
      truncated: false,
    },
    trigger: "retry-exhausted",
    createdAt: new Date().toISOString(),
  }];
  if (phase === "task-impl") {
    const task = state.tasks[0];
    task.steps = buildInitialTaskSteps(task.origin);
    setOnlyStepInProgress(task, "task-gate");
    task.status = "in_progress";
    state.currentTaskId = task.id;
    findStepById(state.steps, "branch").status = "done";
  } else {
    state.tasks = [];
    state.currentTaskId = null;
    setOnlyStepInProgress(state, "impl-gate");
  }
  replaceFlowState(fixture.root, state, { specId });
  fs.mkdirSync(path.join(fixture.root, "src"), { recursive: true });
  fs.writeFileSync(path.join(fixture.root, "src", "changed.js"), "export const changed = true;\n");
  return fixture;
}

test("R1: exhausted semantic eligibility inspection is bounded and read-only", () => {
  for (const phase of ["draft", "spec"]) {
    const fixture = createFixture({ phase });
    const beforeState = stateSnapshot(fixture.root, phase);
    const beforeSource = fs.readFileSync(fixture.sourceFile, "utf8");

    const result = nextAction(fixture.root);

    assert.equal(result.status, 0, result.stderr);
    semanticRecovery(result.envelope.data, phase);
    assert.deepEqual(stateSnapshot(fixture.root, phase), beforeState);
    assert.equal(fs.readFileSync(fixture.sourceFile, "utf8"), beforeSource);
    assert.equal(fs.existsSync(path.join(fixture.targetDir, "flow-findings.json")), false);

    const oversized = semanticArtifact(phase);
    oversized.padding = "x".repeat((1024 * 1024) + 1);
    const oversizedFixture = createFixture({ phase, artifact: oversized });
    const oversizedSource = fs.readFileSync(oversizedFixture.sourceFile, "utf8");
    const inspect = runGateModule.inspectDurableGateSemanticDeferral;
    assert.equal(typeof inspect, "function");
    const oversizedState = makeFlowManager(oversizedFixture.root).load();
    const originalReadFileSync = fs.readFileSync;
    let oversizedSourceRead = false;
    fs.readFileSync = (file, ...args) => {
      if (path.resolve(String(file)) === path.resolve(oversizedFixture.sourceFile)) {
        oversizedSourceRead = true;
        throw new Error("oversized durable source was read");
      }
      return originalReadFileSync(file, ...args);
    };
    try {
      const eligibility = inspect({
        root: oversizedFixture.root,
        flowState: oversizedState,
        phase,
      });
      assert.notEqual(eligibility?.reason, "semantic_findings");
    } finally {
      fs.readFileSync = originalReadFileSync;
    }
    assert.equal(oversizedSourceRead, false);
    const oversizedResult = nextAction(oversizedFixture.root);
    assert.equal(oversizedResult.status, 0, oversizedResult.stderr);
    assert.equal(oversizedResult.envelope.data.retryRecovery.recoveryPossible, false);
    assert.equal(oversizedResult.envelope.data.retryRecovery.recoveryCommand, null);
    assert.equal(fs.readFileSync(oversizedFixture.sourceFile, "utf8"), oversizedSource);
    assert.deepEqual(stateSnapshot(oversizedFixture.root, phase), {
      attempts: 5,
      gateStatus: "in_progress",
    });
  }
});

test("R2: semantic recovery command contains the selected run, Issue, and spec guards", () => {
  for (const phase of ["draft", "spec"]) {
    const fixture = createFixture({ phase });
    const recovery = semanticRecovery(nextAction(fixture.root).envelope.data, phase);

    assert.equal(
      recovery.recoveryCommand,
      `senti flow run gate --phase ${phase} --expect-run-id ${runId} --expect-issue ${issue} --expect-spec ${specPath}`,
    );
    assert.doesNotMatch(recovery.recoveryCommand, /set retry|reset|rewind/);
  }
});

test("R3: matching continuation preserves 5/5 and provider count while persisting and completing", () => {
  for (const phase of ["draft", "spec"]) {
    const fixture = createFixture({ phase, gitFixture: true });
    semanticRecovery(nextAction(fixture.root).envelope.data, phase);
    const beforeAttempts = stateSnapshot(fixture.root, phase).attempts;

    const continuation = runFlow(fixture.root, ["run", "gate", "--phase", phase, ...targetGuards]);

    assert.equal(continuation.status, 0, JSON.stringify({
      stderr: continuation.stderr,
      envelope: continuation.envelope,
    }, null, 2));
    assert.equal(continuation.envelope.data.result, "deferred");
    const after = stateSnapshot(fixture.root, phase);
    assert.equal(beforeAttempts, 5);
    assert.equal(after.attempts, 5);
    assert.equal(after.gateStatus, "done");
    assert.equal(fs.existsSync(fixture.providerCount), false, "provider must not be invoked");

    const findings = readJson(path.join(fixture.targetDir, "flow-findings.json"));
    assert.equal(findings.entries.length, 2);
    assert.deepEqual(
      findings.entries.map((entry) => entry.sourceStep),
      [`${phase}-gate`, `${phase}-gate`],
    );
    assert.deepEqual(
      findings.entries.map((entry) => entry.sourceArtifact),
      [`${phase}-gate-source.json`, `${phase}-gate-source.json`],
    );
    assert.deepEqual(findings.entries.map((entry) => entry.attempts), [5, 5]);
    assert.equal(new Set(findings.entries.map((entry) => entry.sourceFindingId)).size, 2);

    const advanced = nextAction(fixture.root);
    assert.equal(advanced.status, 0, advanced.stderr);
    assert.equal(advanced.envelope.data.step, phase === "draft" ? "spec" : "approval");
  }
});

test("R4: each mismatched continuation guard stops before semantic-deferral mutation", () => {
  const cases = [
    ["--expect-run-id", "wrong-run", "--expect-issue", String(issue), "--expect-spec", specPath],
    ["--expect-run-id", runId, "--expect-issue", "999", "--expect-spec", specPath],
    ["--expect-run-id", runId, "--expect-issue", String(issue), "--expect-spec", "specs/wrong/spec.json"],
  ];

  for (const phase of ["draft", "spec"]) {
    for (const guards of cases) {
      const fixture = createFixture({ phase });
      semanticRecovery(nextAction(fixture.root).envelope.data, phase);
      const beforeState = stateSnapshot(fixture.root, phase);
      const beforeSource = fs.readFileSync(fixture.sourceFile, "utf8");

      const result = runFlow(fixture.root, ["run", "gate", "--phase", phase, ...guards]);

      assert.notEqual(result.status, 0);
      assert.equal(result.envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
      assert.deepEqual(stateSnapshot(fixture.root, phase), beforeState);
      assert.equal(fs.readFileSync(fixture.sourceFile, "utf8"), beforeSource);
      assert.equal(fs.existsSync(path.join(fixture.targetDir, "flow-findings.json")), false);
    }
  }
});

test("R5: named non-deferable durable sources remain stopped without a recovery command", () => {
  for (const phase of ["draft", "spec"]) {
    const semanticFixture = createFixture({ phase });
    semanticRecovery(nextAction(semanticFixture.root).envelope.data, phase);

    const evaluations = semanticArtifact(phase).evaluations;
    const fixtures = [
      [{ phase, result: "fail", toolingFailure: true, evaluations }, "tooling_failure"],
      [{ phase, result: "fail", command: { exitCode: 1 }, evaluations }, "failed_command"],
      [{ phase, result: "fail", testEvidence: { result: "fail" }, evaluations }, "failed_test_evidence"],
      [{ phase, result: "fail", sourceArtifactStatus: "invalid_schema", evaluations }, "invalid_schema"],
      [{ phase, result: "fail", malformedArtifact: true, evaluations }, "malformed_artifact"],
      [{ phase, result: "fail", coverage: { validation: { ok: false } }, evaluations }, "coverage_header_failure"],
      [{ phase, result: "fail", flowStateValid: false, evaluations }, "flow_corruption"],
      [{ phase, result: "fail", guardCode: "NO_PROGRESS_SINCE_LAST_FAIL", evaluations: [] }, "no_progress_guard"],
      [{ phase, result: "fail", evaluations: [], observations: [] }, "missing_content_findings"],
    ];

    for (const [artifact, expectedReason] of fixtures) {
      assert.equal(
        classifyGateRetryExhaustionSource({ sourceArtifact: artifact }).reason,
        expectedReason,
      );
      const fixture = createFixture({ phase, artifact });
      const result = nextAction(fixture.root);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.envelope.data.retryRecovery.recoveryPossible, false);
      assert.equal(result.envelope.data.retryRecovery.recoveryCommand, null);
      assert.deepEqual(stateSnapshot(fixture.root, phase), { attempts: 5, gateStatus: "in_progress" });
    }

    for (const fixture of [
      createFixture({ phase, artifact: null }),
      createFixture({ phase, rawArtifact: "{not-json" }),
    ]) {
      const result = nextAction(fixture.root);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.envelope.data.retryRecovery.recoveryPossible, false);
      assert.equal(result.envelope.data.retryRecovery.recoveryCommand, null);
      assert.deepEqual(stateSnapshot(fixture.root, phase), { attempts: 5, gateStatus: "in_progress" });
    }
  }
});

test("R6: task and integration recovery retain changed-evidence, audit, grant, and guard contracts", () => {
  const fixture = createFixture();
  const planBefore = stateSnapshot(fixture.root, "spec");
  const planRecovery = semanticRecovery(nextAction(fixture.root).envelope.data);
  assert.equal(planRecovery.classification, "semantic_findings");
  assert.deepEqual(stateSnapshot(fixture.root, "spec"), planBefore);

  for (const phase of ["task-impl", "integration"]) {
    const unchanged = createRetryFixture(phase, { unchanged: true });
    const unchangedBefore = countGateRetry(makeFlowManager(unchanged.root).load().metrics, phase);
    const unchangedAction = nextAction(unchanged.root);
    assert.equal(unchangedAction.status, 0, unchangedAction.stderr);
    assert.equal(unchangedAction.envelope.data.step, phase === "task-impl" ? "task-gate" : "impl-gate");
    assert.equal(unchangedAction.envelope.data.retryRecovery.kind, "gate");
    assert.equal(unchangedAction.envelope.data.retryRecovery.phase, phase);
    assert.equal(unchangedAction.envelope.data.retryRecovery.canonicalPhase, phase);
    assert.equal(unchangedAction.envelope.data.retryRecovery.recoveryPossible, false);
    assert.equal(unchangedAction.envelope.data.retryRecovery.recoveryReason, "unchanged-evidence");
    assert.equal(unchangedAction.envelope.data.retryRecovery.recoveryCommand, null);
    assert.equal(unchangedAction.envelope.data.retryRecovery.classification, undefined);
    assert.equal(unchangedAction.envelope.data.retryRecovery.changedEvidence.changed, false);
    assert.equal(
      unchangedAction.envelope.data.retryRecovery.changedEvidence.sourceKind,
      phase === "task-impl" ? "implementation-diff" : "implementation-and-test-artifacts",
    );
    assert.equal(countGateRetry(makeFlowManager(unchanged.root).load().metrics, phase), unchangedBefore);
    assert.equal(fs.existsSync(path.join(unchanged.targetDir, "retry-recovery.json")), false);
    const unchangedResult = runFlow(unchanged.root, [
      "set", "retry", "reset", "gate", phase,
      "--reason", "Changed implementation evidence supports one audited retry.",
      "--yes",
      ...targetGuards,
    ]);
    assert.notEqual(unchangedResult.status, 0);
    assert.equal(unchangedResult.envelope.errors[0].code, "UNCHANGED_EVIDENCE");
    assert.equal(countGateRetry(makeFlowManager(unchanged.root).load().metrics, phase), 5);
    assert.equal(fs.existsSync(path.join(unchanged.targetDir, "retry-recovery.json")), false);

    const changed = createRetryFixture(phase);
    const changedBefore = countGateRetry(makeFlowManager(changed.root).load().metrics, phase);
    const changedAction = nextAction(changed.root);
    assert.equal(changedAction.status, 0, changedAction.stderr);
    assert.equal(changedAction.envelope.data.step, phase === "task-impl" ? "task-gate" : "impl-gate");
    assert.equal(changedAction.envelope.data.retryRecovery.kind, "gate");
    assert.equal(changedAction.envelope.data.retryRecovery.phase, phase);
    assert.equal(changedAction.envelope.data.retryRecovery.canonicalPhase, phase);
    assert.equal(changedAction.envelope.data.retryRecovery.recoveryPossible, true);
    assert.equal(changedAction.envelope.data.retryRecovery.recoveryReason, "changed-evidence");
    assert.equal(changedAction.envelope.data.retryRecovery.classification, undefined);
    assert.equal(changedAction.envelope.data.retryRecovery.changedEvidence.changed, true);
    assert.equal(changedAction.envelope.data.retryRecovery.changedEvidence.baselineHash, "0".repeat(64));
    assert.notEqual(changedAction.envelope.data.retryRecovery.changedEvidence.currentHash, "0".repeat(64));
    assert.equal(
      changedAction.envelope.data.retryRecovery.changedEvidence.sourceKind,
      phase === "task-impl" ? "implementation-diff" : "implementation-and-test-artifacts",
    );
    assert.equal(
      changedAction.envelope.data.retryRecovery.recoveryCommand,
      `senti flow set retry reset gate ${phase} --reason "Describe the changed evidence before re-evaluation." --yes`,
    );
    assert.equal(countGateRetry(makeFlowManager(changed.root).load().metrics, phase), changedBefore);
    assert.equal(fs.existsSync(path.join(changed.targetDir, "retry-recovery.json")), false);
    const changedResult = runFlow(changed.root, [
      "set", "retry", "reset", "gate", phase,
      "--reason", "Changed implementation evidence supports one audited retry.",
      "--yes",
      ...targetGuards,
    ]);
    assert.equal(changedResult.status, 0, JSON.stringify({
      status: changedResult.status,
      envelope: changedResult.envelope,
      stderr: changedResult.stderr,
    }, null, 2));
    assert.equal(changedResult.envelope.data.grants.length, 1);
    assert.equal(countGateRetry(makeFlowManager(changed.root).load().metrics, phase), 4);
    const recovery = readJson(path.join(changed.targetDir, "retry-recovery.json"));
    assert.equal(recovery.entries.length, 1);
    assert.equal(recovery.entries[0].phase, phase);
    assert.equal(recovery.entries[0].kind, "gate");
    assert.equal(recovery.entries[0].canonicalPhase, phase);
    assert.equal(recovery.entries[0].attemptsBefore, 5);
    assert.equal(recovery.entries[0].maxAttempts, 5);
    assert.equal(recovery.entries[0].permittedReevaluationCount, 1);
    assert.equal(recovery.entries[0].counterAfter, 4);
    assert.equal(recovery.entries[0].changedEvidence.changed, true);
    assert.equal(recovery.entries[0].changedEvidence.baselineHash, "0".repeat(64));
    assert.equal(
      recovery.entries[0].recoveryCommand,
      `senti flow set retry reset gate ${phase} --reason "Changed implementation evidence supports one audited retry." --yes`,
    );
    const issueLog = readJson(path.join(changed.targetDir, "issue-log.json"));
    assert.equal(issueLog.entries.at(-1).step, "retry-recovery");

    const mismatchGuards = [
      ["--expect-run-id", "wrong-run", "--expect-issue", String(issue), "--expect-spec", specPath],
      ["--expect-run-id", runId, "--expect-issue", "999", "--expect-spec", specPath],
      ["--expect-run-id", runId, "--expect-issue", String(issue), "--expect-spec", "specs/wrong/spec.json"],
    ];
    for (const guards of mismatchGuards) {
      const mismatched = createRetryFixture(phase);
      const mismatchResult = runFlow(mismatched.root, [
        "set", "retry", "reset", "gate", phase,
        "--reason", "Changed implementation evidence supports one audited retry.",
        "--yes",
        ...guards,
      ]);
      assert.notEqual(mismatchResult.status, 0);
      assert.equal(mismatchResult.envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
      assert.equal(countGateRetry(makeFlowManager(mismatched.root).load().metrics, phase), 5);
      assert.equal(fs.existsSync(path.join(mismatched.targetDir, "retry-recovery.json")), false);
    }
  }
});
