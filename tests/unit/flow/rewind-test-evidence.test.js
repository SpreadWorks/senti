import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Container } from "../../../src/lib/container.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import {
  buildRepairFingerprint,
  prepareImplTriageArtifact,
  recoverImplRepairTransaction,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import { runGit } from "../../../src/lib/git-helpers.js";
import { resolveFlowContext } from "../../../src/flow/lib/flow-context.js";
import {
  ExternalBlockedOutcome,
  RetryOutcome,
  StepAttempt,
} from "../../../src/flow/lib/step-outcome.js";
import { findActiveNode, flowLeafIdsBetween } from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { readRepairFingerprintManifest } from "../../../src/flow/lib/repair-state-identity.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "001-stale-test-evidence";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;
const RUN_ID = "run-stale-test-evidence";
const ISSUE = 7;
const TRACE_PREFIX = "/tmp/impl-gate-stale-test-evidence-case";
const MAX_EVIDENCE_BYTES = 1024 * 1024;
const SEMANTIC_FINDING_ID = "2".repeat(64);
const SEMANTIC_FINDING_AT = "2026-07-23T10:40:03.000Z";
const MATERIAL_REPAIR_AT = "2026-07-23T10:42:00.000Z";
const MATERIAL_ISSUE_AT = "2026-07-23T10:44:00.000Z";
const STRUCTURAL_BLOCKER_AT = "2026-07-23T10:48:00.000Z";
const MATERIAL_REPAIR_PATH = "tests/unit/flow/commands/review.test.js";

const roots = new Set();

class CaseRecorder {
  constructor(caseName, expectedCode) {
    this.caseName = caseName;
    this.expectedCode = expectedCode;
    this.file = `${TRACE_PREFIX}-${caseName.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}.jsonl`;
    fs.writeFileSync(this.file, "");
  }

  record(phase, status, detail = {}) {
    fs.appendFileSync(this.file, `${JSON.stringify({
      version: 1,
      case: this.caseName,
      expectedCode: this.expectedCode,
      phase,
      status,
      ...detail,
    })}\n`);
  }

  async dispatch(fixture, operation = "primary", overrides = {}) {
    this.record("dispatch", "start", { operation });
    try {
      const result = await dispatchRecovery(fixture, overrides);
      this.record("dispatch", "done", {
        operation,
        exitCode: result.exitCode,
        ok: result.envelope.ok,
        actualCode: result.envelope.errors?.[0]?.code ?? null,
      });
      return result;
    } catch (error) {
      this.record("dispatch", "failed", {
        operation,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  assert(operation, assertion) {
    this.record("assert", "start", { operation });
    try {
      assertion();
      this.record("assert", "done", { operation });
    } catch (error) {
      this.record("assert", "failed", {
        operation,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function writeJson(root, relativePath, value) {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function runFixtureGit(root, args, env = {}) {
  const result = runGit(args, {
    cwd: root,
    env: { ...process.env, ...env },
  });
  assert.equal(result.ok, true, `${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function commitFixture(root, message, timestamp, paths = ["."]) {
  runFixtureGit(root, ["add", "--", ...paths]);
  runFixtureGit(root, ["commit", "-m", message], {
    GIT_AUTHOR_DATE: timestamp,
    GIT_COMMITTER_DATE: timestamp,
  });
}

function snapshot(root, relativePaths) {
  return Object.fromEntries(relativePaths.map((relativePath) => {
    const file = path.join(root, relativePath);
    return [relativePath, fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null];
  }));
}

function authorityPaths(fixture) {
  return [
    SPEC_PATH,
    `${fixture.specDir}/flow.json`,
    `${fixture.specDir}/issue-log.json`,
    `${fixture.specDir}/impl-gate-result.json`,
    `${fixture.specDir}/test-execute-result.json`,
    `${fixture.specDir}/test-result-review.json`,
    `${fixture.specDir}/tests/.raw/test-execution.log`,
    `${fixture.specDir}/repair-fingerprint.json`,
    `${fixture.specDir}/impl-triage.json`,
    `${fixture.specDir}/impl-review.json`,
    `${fixture.specDir}/impl-repair.json`,
    `${fixture.specDir}/impl-repair-transaction.json`,
    `${fixture.specDir}/repair-deltas/repair-001.json`,
    "src/repair-target.js",
    MATERIAL_REPAIR_PATH,
  ];
}

function replaceAuthorityFile(root, relativePath, bytes) {
  const target = path.join(root, relativePath);
  const replacement = `${target}.fault-replacement`;
  fs.writeFileSync(replacement, bytes);
  fs.renameSync(replacement, target);
}

function replaceWithSymlink(root, relativePath) {
  const target = path.join(root, relativePath);
  const authorityTarget = `${target}.symlink-target`;
  fs.renameSync(target, authorityTarget);
  fs.symlinkSync(path.basename(authorityTarget), target);
}

function makeContainer(root, flowManager) {
  const container = new Container();
  container.register("paths", { root });
  container.register("mainRoot", root);
  container.register("inWorktree", false);
  container.register("config", {});
  container.register("flowManager", flowManager);
  return container;
}

async function dispatchRecovery(fixture, overrides = {}) {
  const output = [];
  let exitCode = null;
  const input = {
    expectRunId: RUN_ID,
    expectSpec: SPEC_PATH,
    expectIssue: String(ISSUE),
    ...overrides,
  };
  const argv = [];
  if (input.expectRunId !== undefined) argv.push("--expect-run-id", input.expectRunId);
  if (input.expectSpec !== undefined) argv.push("--expect-spec", input.expectSpec);
  if (input.expectIssue !== undefined) argv.push("--expect-issue", input.expectIssue);
  if (input.expectNoIssue === true) argv.push("--expect-no-issue");
  await dispatch({
    container: fixture.container,
    entry: FLOW_COMMANDS.run["rewind-test-evidence"],
    argv,
    envelopeType: "run",
    envelopeKey: "rewind-test-evidence",
    stdout: (chunk) => output.push(chunk),
    stderr: () => {},
    setExitCode: (code) => { exitCode = code; },
    buildHookCtx: (container, parsed) => resolveFlowContext(container, { input: parsed }),
  });
  return { envelope: JSON.parse(output.join("")), exitCode };
}

function completedTask() {
  return {
    id: "T-1",
    title: "Finished task",
    goal: "Retained task state.",
    parent: null,
    origin: "plan",
    added_round: 0,
    status: "done",
    steps: ["task-impl", "task-review", "task-gate"].map((id) => ({ id, status: "done" })),
    requirements: [],
    summary: "complete",
  };
}

function activeTask() {
  return {
    id: "T-1",
    title: "Active task",
    goal: "Create valid competing task authority.",
    parent: null,
    origin: "plan",
    added_round: 0,
    status: "in_progress",
    steps: [
      { id: "task-impl", status: "in_progress" },
      { id: "task-review", status: "pending" },
      { id: "task-gate", status: "pending" },
    ],
    requirements: [],
    summary: null,
  };
}

function staleOwnerTask({ status = "in_progress", stepStatuses = {} } = {}) {
  return {
    id: "T-1",
    title: "Stale current task owner",
    goal: "Represent completed task leaves retained by an integration attempt.",
    parent: null,
    origin: "plan",
    added_round: 0,
    status,
    steps: ["task-impl", "task-review", "task-gate"].map((id) => ({
      id,
      status: stepStatuses[id] || "done",
    })),
    requirements: [],
    summary: null,
  };
}

function prepareFixture({
  activeStep = "impl-gate",
  latestOutcome = "external-blocked",
  failureReason = null,
  applySourceChange = true,
  inconsistentReviewFingerprint = false,
  materializedRepair = true,
  ambiguousTask = false,
  staleAttemptOwner = false,
  staleTaskStatus = "in_progress",
  staleTaskStepStatuses = {},
  attemptTaskId = undefined,
  currentTaskId = undefined,
  gateArtifactOverrides = {},
  materialRepair = false,
  materialReference = MATERIAL_REPAIR_PATH,
  materialReferences = undefined,
  materialTaskId = "T-2",
  materialCommitAt = MATERIAL_REPAIR_AT,
  materialIssueAt = MATERIAL_ISSUE_AT,
  materialFindingId = SEMANTIC_FINDING_ID,
  materialRequirementId = "R8",
  materialTaskAcceptance = "R8 requires the focused producer fixture.",
  semanticFinding = true,
  triageDecisions = undefined,
  structuralExpected = undefined,
} = {}) {
  const root = createTmpDir("rewind-stale-test-evidence-");
  roots.add(root);
  const specDir = `specs/${SPEC_ID}`;
  const rawOutputPath = `${specDir}/tests/.raw/test-execution.log`;
  const resultPath = `${specDir}/test-execute-result.json`;
  const resolvedMaterialReferences = materialReferences ?? [materialReference];

  writeJson(root, SPEC_PATH, {
    goal: "Recover stale implementation test evidence.",
    requirements: [],
    tasks: materialRepair ? [{
      id: "T-2",
      goal: "Add the focused requirement regression.",
      acceptance: [materialTaskAcceptance],
      origin: "plan",
    }] : [],
  });
  writeJson(root, `${specDir}/draft.json`, { marker: "draft remains unchanged" });
  writeJson(root, `${specDir}/file-map.json`, { marker: "source evidence remains unchanged" });
  writeJson(root, `${specDir}/retry-recovery.json`, { marker: "retry recovery remains unchanged" });
  writeFile(root, "src/repair-target.js", "export const value = 'before';\n");
  if (materialRepair) {
    writeFile(root, MATERIAL_REPAIR_PATH, "test('before material repair', () => {});\n");
    writeFile(root, "src/unchanged.js", "export const unchanged = true;\n");
    runFixtureGit(root, ["init", "-b", "main"]);
    runFixtureGit(root, ["config", "user.name", "Fixture Author"]);
    runFixtureGit(root, ["config", "user.email", "fixture@example.test"]);
    commitFixture(root, "Create material repair baseline", "2026-07-23T10:30:00.000Z");
    runFixtureGit(root, ["switch", "-c", "feature/material-repair"]);
  }

  const previous = buildRepairFingerprint({ root, specPath: SPEC_PATH });
  const decisions = triageDecisions ?? (materialRepair ? ["reject"] : ["apply"]);
  const reviewFindings = decisions.map((decision, index) => ({
    findingId: `F-${index + 1}`,
    suggestion: `Disposition ${decision} for fixture finding ${index + 1}.`,
  }));
  writeJson(root, `${specDir}/impl-review.json`, {
    version: 1,
    phase: "impl",
    verdict: "REJECTED",
    summary: { blocking: reviewFindings.length, nonBlocking: 0, total: reviewFindings.length },
    blockingFindings: reviewFindings,
    nonBlockingImprovements: [],
    repairFingerprint: previous.hash,
  });
  if (materializedRepair) {
    prepareImplTriageArtifact({
      specDir: path.join(root, specDir),
      sourceStep: "impl-review",
      sourceArtifact: "impl-review.json",
      findings: reviewFindings,
      fingerprint: previous,
    });
    const triage = readJson(root, `${specDir}/impl-triage.json`);
    triage.items = triage.items.map((item, index) => ({
      ...item,
      decision: decisions[index],
    }));
    writeJson(root, `${specDir}/impl-triage.json`, triage);
  }
  writeFile(root, rawOutputPath, "test output\n");
  writeJson(root, resultPath, {
    repairFingerprint: previous.hash,
    raw_output_path: rawOutputPath,
  });
  writeJson(root, `${specDir}/test-result-review.json`, {
    repairFingerprint: inconsistentReviewFingerprint ? "f".repeat(64) : previous.hash,
    result_file_path: resultPath,
    raw_output_path: rawOutputPath,
  });
  writeFile(root, `${specDir}/test-result-review.md`, "review evidence\n");
  writeFile(root, `${specDir}/review.md`, "implementation review evidence\n");
  writeJson(root, `${specDir}/impl-gate-result.json`, {
    repairFingerprint: previous.hash,
    result: "fail",
    generatedAt: SEMANTIC_FINDING_AT,
    level: "integration",
    phase: "integration",
    evaluations: semanticFinding ? [{
      findingId: SEMANTIC_FINDING_ID,
      requirementId: materialRequirementId,
      result: "fail",
      disposition: "must-fix",
      reportedAt: SEMANTIC_FINDING_AT,
    }] : [],
    contractSummary: {
      targetStep: "impl-gate",
    },
    ...gateArtifactOverrides,
  });
  if (materialRepair) {
    writeFile(root, MATERIAL_REPAIR_PATH, "test('after material repair', () => {});\n");
    commitFixture(root, "Add formal material repair", materialCommitAt, [MATERIAL_REPAIR_PATH]);
    if (resolvedMaterialReferences.includes("src/untracked.js")) {
      writeFile(root, "src/untracked.js", "export const untracked = true;\n");
    }
    if (resolvedMaterialReferences.includes("node_modules/material-link.js")) {
      fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
      fs.symlinkSync("../src/unchanged.js", path.join(root, "node_modules/material-link.js"));
    }
  } else if (applySourceChange) {
    writeFile(root, "src/repair-target.js", "export const value = 'after';\n");
  }

  const effectiveStaleOwner = staleAttemptOwner || materialRepair;
  const task = effectiveStaleOwner
    ? staleOwnerTask({
        status: staleTaskStatus,
        stepStatuses: staleTaskStepStatuses,
      })
    : ambiguousTask
      ? activeTask()
      : completedTask();
  const resolvedCurrentTaskId = currentTaskId !== undefined
    ? currentTaskId
    : effectiveStaleOwner || ambiguousTask
      ? "T-1"
      : null;
  const resolvedAttemptTaskId = attemptTaskId !== undefined
    ? attemptTaskId
    : effectiveStaleOwner
      ? "T-1"
      : null;
  const state = moveFlowToStep(makeFlowState({
    spec: SPEC_PATH,
    runId: RUN_ID,
    issue: ISSUE,
    baseBranch: "main",
    featureBranch: "feature/stale-test-evidence",
    ...(materialRepair ? { repairBaseline: previous.baseline.toJSON() } : {}),
    currentTaskId: resolvedCurrentTaskId,
    tasks: [task],
    metrics: [
      { phase: "integration", counter: "gateRetry", delta: 5, taskId: null, ts: "2026-07-23T00:00:00.000Z" },
    ],
    retryLimits: { gate: 5, review: 4 },
  }), activeStep);
  const current = buildRepairFingerprint({ root, specPath: SPEC_PATH, state });
  const outcome = latestOutcome === "external-blocked"
    ? new ExternalBlockedOutcome({
        reason: "gate_failure",
        resumeInstruction: "Resolve the structural gate blocker.",
      })
    : new RetryOutcome({ nextAction: "run-gate-integration" });
  state.stepAttempts = [new StepAttempt({
    runId: RUN_ID,
    taskId: resolvedAttemptTaskId,
    stepId: "impl-gate",
    attempt: 1,
    outcome,
    recordedAt: "2026-07-23T00:00:02.000Z",
  }).toJSON()];
  writeJson(root, `${specDir}/issue-log.json`, {
    entries: [...(materialRepair ? [{
      step: "impl-gate",
      reason: "The formal focused repair was implemented after the semantic gate finding.",
      trigger: "integration gate attempt 1 identified missing requirement coverage",
      normalizedFindingId: materialFindingId,
      repairRef: { files: resolvedMaterialReferences },
      taskId: materialTaskId,
      timestamp: materialIssueAt,
    }] : []), {
      step: "impl-gate",
      phase: "integration",
      trigger: "gate onError hook (auto)",
      reason: failureReason || `${resultPath.split("/").at(-1)} repairFingerprint mismatch: expected ${structuralExpected || current.hash}, got ${previous.hash}`,
      timestamp: materialRepair ? STRUCTURAL_BLOCKER_AT : "2026-07-23T00:00:01.000Z",
    }],
  });

  const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false });
  flowManager.create(state);
  flowManager.addActiveFlow(SPEC_ID, "branch");
  return {
    root,
    specDir,
    state,
    previous,
    current,
    flowManager,
    container: makeContainer(root, flowManager),
  };
}

function cleanupFixture(fixture) {
  if (!fixture) return;
  removeTmpDir(fixture.root);
  roots.delete(fixture.root);
}

async function withFixtureCase({ caseName, expectedCode, options = {} }, action) {
  const recorder = new CaseRecorder(caseName, expectedCode);
  let fixture = null;
  recorder.record("fixture-build", "start");
  try {
    fixture = prepareFixture(options);
    recorder.record("fixture-build", "done", {
      activeNode: findActiveNode(fixture.state),
      currentTaskId: fixture.state.currentTaskId,
    });
    await action(fixture, recorder);
  } catch (error) {
    recorder.record("case", "failed", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    recorder.record("cleanup", "start", { root: fixture?.root ?? null });
    try {
      cleanupFixture(fixture);
      recorder.record("cleanup", "done");
    } catch (error) {
      recorder.record("cleanup", "failed", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

async function assertRejectedWithoutMutation({
  caseName,
  expectedCode,
  options = {},
  overrides = {},
  arrange = null,
}) {
  await withFixtureCase({ caseName, expectedCode, options }, async (fixture, recorder) => {
    if (arrange) {
      recorder.record("fixture-arrange", "start");
      arrange(fixture);
      recorder.record("fixture-arrange", "done");
    }
    const paths = authorityPaths(fixture);
    const before = snapshot(fixture.root, paths);
    const result = await recorder.dispatch(fixture, "rejection", overrides);
    recorder.assert("rejection-and-no-mutation", () => {
      assert.equal(result.exitCode, 1, caseName);
      assert.equal(result.envelope.ok, false, caseName);
      assert.equal(
        result.envelope.errors[0].code,
        expectedCode,
        `${caseName}: ${JSON.stringify(result.envelope.errors)}`,
      );
      assert.deepEqual(snapshot(fixture.root, paths), before, caseName);
    });
  });
}

afterEach(() => {
  for (const root of roots) removeTmpDir(root);
  roots.clear();
});

describe("public stale test evidence recovery", () => {
  it("uses the public dispatcher to commit the existing impl-repair transition core", async () => {
    await withFixtureCase({
      caseName: "matrix-a-success-and-second-invocation",
      expectedCode: "OK_THEN_STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH",
    }, async (fixture, recorder) => {
      const retainedPaths = [
        SPEC_PATH,
        `${fixture.specDir}/draft.json`,
        `${fixture.specDir}/file-map.json`,
        `${fixture.specDir}/retry-recovery.json`,
        "src/repair-target.js",
      ];
      const retainedBefore = snapshot(fixture.root, retainedPaths);
      const before = fixture.flowManager.loadReadOnly();
      const tasksBefore = structuredClone(before.tasks);
      const metricsBefore = structuredClone(before.metrics);
      const retryLimitsBefore = structuredClone(before.retryLimits);
      const attemptsBefore = structuredClone(before.stepAttempts);

      const result = await recorder.dispatch(fixture, "first");
      recorder.assert("committed-transition", () => {
        assert.equal(result.exitCode, 0, JSON.stringify(result.envelope));
        assert.equal(result.envelope.ok, true, JSON.stringify(result.envelope.errors));
        assert.equal(result.envelope.data.recovered, true);
        assert.equal(result.envelope.data.previousRepairFingerprint, fixture.previous.hash);
        assert.equal(result.envelope.data.currentRepairFingerprint, fixture.current.hash);
        assert.equal(result.envelope.data.activeStep, "test-execute");
        const after = fixture.flowManager.loadReadOnly();
        assert.deepEqual(findActiveNode(after), {
          scope: "flow",
          stepId: "test-execute",
          taskId: null,
        });
        for (const stepId of flowLeafIdsBetween("test-execute", "finalize-cleanup")) {
          const expectedStatus = stepId === "test-execute"
            ? "in_progress"
            : stepId === "impl-repair"
              ? "done"
              : "pending";
          assert.equal(findStepById(after.steps, stepId).status, expectedStatus, stepId);
        }
        assert.deepEqual(after.tasks, tasksBefore);
        assert.deepEqual(after.metrics, metricsBefore);
        assert.deepEqual(after.retryLimits, retryLimitsBefore);
        assert.deepEqual(after.stepAttempts, attemptsBefore);
        assert.deepEqual(snapshot(fixture.root, retainedPaths), retainedBefore);
        assert.equal(
          readRepairFingerprintManifest(path.join(fixture.root, fixture.specDir)).hash,
          fixture.current.hash,
        );
        assert.equal(readJson(fixture.root, `${fixture.specDir}/impl-repair.json`).entries.length, 1);
        for (const relativePath of [
          "test-execute-result.json",
          "tests/.raw/test-execution.log",
          "test-result-review.json",
          "test-result-review.md",
          "impl-review.json",
          "review.md",
          "impl-gate-result.json",
        ]) {
          assert.equal(fs.existsSync(path.join(fixture.root, fixture.specDir, relativePath)), false, relativePath);
        }
      });

      const beforeSecond = snapshot(fixture.root, [
        `${fixture.specDir}/flow.json`,
        `${fixture.specDir}/impl-repair.json`,
        `${fixture.specDir}/repair-fingerprint.json`,
        `${fixture.specDir}/issue-log.json`,
        "src/repair-target.js",
      ]);
      const second = await recorder.dispatch(fixture, "second");
      recorder.assert("second-invocation-fails-closed", () => {
        assert.equal(second.exitCode, 1);
        assert.equal(second.envelope.ok, false);
        assert.equal(second.envelope.errors[0].code, "STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH");
        assert.deepEqual(snapshot(fixture.root, Object.keys(beforeSecond)), beforeSecond);
      });
    });
  });

  it("accepts the bounded real integration shape with a stale task attempt owner", async () => {
    await withFixtureCase({
      caseName: "matrix-v4-stale-task-owner-success-and-second-invocation",
      expectedCode: "OK_THEN_STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH",
      options: { staleAttemptOwner: true },
    }, async (fixture, recorder) => {
      const before = fixture.flowManager.loadReadOnly();
      assert.equal(before.currentTaskId, "T-1");
      assert.equal(before.tasks[0].status, "in_progress");
      assert.ok(before.tasks[0].steps.every((step) => step.status === "done"));
      assert.equal(before.stepAttempts.at(-1).taskId, "T-1");

      const result = await recorder.dispatch(fixture, "first");
      recorder.assert("stale-owner-integration-transition", () => {
        assert.equal(result.exitCode, 0, JSON.stringify(result.envelope));
        assert.equal(result.envelope.ok, true, JSON.stringify(result.envelope.errors));
        assert.equal(result.envelope.data.activeStep, "test-execute");
        const after = fixture.flowManager.loadReadOnly();
        assert.deepEqual(after.tasks, before.tasks);
        assert.equal(after.currentTaskId, "T-1");
        assert.deepEqual(after.stepAttempts, before.stepAttempts);
        assert.deepEqual(findActiveNode(after), {
          scope: "flow",
          stepId: "test-execute",
          taskId: null,
        });
      });

      const beforeSecond = snapshot(fixture.root, [
        `${fixture.specDir}/flow.json`,
        `${fixture.specDir}/impl-repair.json`,
        `${fixture.specDir}/repair-fingerprint.json`,
        "src/repair-target.js",
      ]);
      const second = await recorder.dispatch(fixture, "second");
      recorder.assert("stale-owner-second-invocation-fails-closed", () => {
        assert.equal(second.exitCode, 1);
        assert.equal(second.envelope.ok, false);
        assert.equal(second.envelope.errors[0].code, "STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH");
        assert.deepEqual(snapshot(fixture.root, Object.keys(beforeSecond)), beforeSecond);
      });
    });
  });

  it("rejects non-integration, incomplete, mismatched, and task-scoped stale owners", async () => {
    const cases = [
      [
        "matrix-v4-active-task-impl",
        { staleAttemptOwner: true, staleTaskStepStatuses: { "task-impl": "in_progress" } },
        "STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH",
      ],
      [
        "matrix-v4-incomplete-task-leaf",
        { staleAttemptOwner: true, staleTaskStepStatuses: { "task-review": "pending" } },
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
      ],
      [
        "matrix-v4-active-task-gate",
        { staleAttemptOwner: true, staleTaskStepStatuses: { "task-gate": "in_progress" } },
        "STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH",
      ],
      [
        "matrix-v4-current-latest-owner-mismatch",
        { staleAttemptOwner: true, attemptTaskId: "T-2" },
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
      ],
      [
        "matrix-v4-inconsistent-completed-task-status",
        { staleAttemptOwner: true, staleTaskStatus: "done" },
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
      ],
      [
        "matrix-v4-task-scoped-gate-artifact",
        { staleAttemptOwner: true, gateArtifactOverrides: { taskId: "T-1" } },
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
      ],
      [
        "matrix-v4-target-scoped-gate-artifact",
        { staleAttemptOwner: true, gateArtifactOverrides: { target: "T-1" } },
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
      ],
      [
        "matrix-v4-wrong-gate-level",
        { staleAttemptOwner: true, gateArtifactOverrides: { level: "task" } },
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
      ],
      [
        "matrix-v4-wrong-gate-phase",
        { staleAttemptOwner: true, gateArtifactOverrides: { phase: "task-impl" } },
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
      ],
      [
        "matrix-v4-wrong-gate-target-step",
        {
          staleAttemptOwner: true,
          gateArtifactOverrides: { contractSummary: { targetStep: "task-gate" } },
        },
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
      ],
    ];
    for (const [caseName, options, expectedCode] of cases) {
      await assertRejectedWithoutMutation({ caseName, expectedCode, options });
    }
  });

  it("refreshes stale tests from a formal material repair without resolving gate findings", async () => {
    await withFixtureCase({
      caseName: "matrix-v5-real-shape-material-repair-success",
      expectedCode: "OK_THEN_STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH",
      options: {
        materialRepair: true,
        materialReferences: ["src/unchanged.js", MATERIAL_REPAIR_PATH, MATERIAL_REPAIR_PATH],
      },
    }, async (fixture, recorder) => {
      const before = fixture.flowManager.loadReadOnly();
      const issueLogBefore = readJson(fixture.root, `${fixture.specDir}/issue-log.json`);
      let gitCalls = 0;
      fixture.container.register("staleTestEvidenceRecoveryGitRunner", (args, options) => {
        gitCalls += 1;
        return runGit(args, options);
      });
      const result = await recorder.dispatch(fixture, "first");
      recorder.assert("material-repair-refresh-only", () => {
        assert.equal(result.exitCode, 0, JSON.stringify(result.envelope));
        assert.equal(result.envelope.ok, true, JSON.stringify(result.envelope.errors));
        assert.equal(result.envelope.data.activeStep, "test-execute");
        const after = fixture.flowManager.loadReadOnly();
        assert.deepEqual(after.tasks, before.tasks);
        assert.deepEqual(after.stepAttempts, before.stepAttempts);
        assert.equal(findStepById(after.steps, "impl-gate").status, "pending");
        const repair = readJson(fixture.root, `${fixture.specDir}/impl-repair.json`).entries.at(-1);
        assert.deepEqual(repair.sourceFindingIds, [SEMANTIC_FINDING_ID]);
        assert.match(repair.reason, /finding resolution is not asserted/);
        assert.equal(Object.hasOwn(after, "allFindingsResolved"), false);
        assert.equal(Object.hasOwn(after, "resolvedFindings"), false);
        assert.deepEqual(
          readJson(fixture.root, `${fixture.specDir}/issue-log.json`),
          issueLogBefore,
        );
        assert.equal(
          issueLogBefore.entries.some((entry) => Object.hasOwn(entry, "resolution")),
          false,
        );
        assert.ok(gitCalls > 0 && gitCalls <= 128, `bounded Git calls: ${gitCalls}`);
      });

      const beforeSecond = snapshot(fixture.root, [
        `${fixture.specDir}/flow.json`,
        `${fixture.specDir}/impl-repair.json`,
        `${fixture.specDir}/repair-fingerprint.json`,
        MATERIAL_REPAIR_PATH,
      ]);
      const second = await recorder.dispatch(fixture, "second");
      recorder.assert("material-repair-second-invocation-fails-closed", () => {
        assert.equal(second.exitCode, 1);
        assert.equal(second.envelope.ok, false);
        assert.equal(second.envelope.errors[0].code, "STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH");
        assert.deepEqual(snapshot(fixture.root, Object.keys(beforeSecond)), beforeSecond);
      });
    });
  });

  it("rejects aggregate material repair references before any Git authority query", async () => {
    let gitCalls = 0;
    await assertRejectedWithoutMutation({
      caseName: "matrix-v5-aggregate-references-bound",
      expectedCode: "STALE_TEST_EVIDENCE_BOUND_EXCEEDED",
      options: {
        materialRepair: true,
        materialReferences: Array.from({ length: 65 }, () => MATERIAL_REPAIR_PATH),
      },
      arrange: (fixture) => {
        fixture.container.register("staleTestEvidenceRecoveryGitRunner", (args, options) => {
          gitCalls += 1;
          return runGit(args, options);
        });
      },
    });
    assert.equal(gitCalls, 0);
  });

  it("preserves refresh-only purpose and unresolved finding authority through recovery", async () => {
    await withFixtureCase({
      caseName: "matrix-v5-refresh-purpose-crash-recovery",
      expectedCode: "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED_THEN_RECOVERED",
      options: { materialRepair: true },
    }, async (fixture, recorder) => {
      const issueLogBefore = readJson(fixture.root, `${fixture.specDir}/issue-log.json`);
      let faultInjected = false;
      fixture.container.register("staleTestEvidenceRecoveryFaultInjector", ({ phase }) => {
        if (phase !== "after-update-step-statuses" || faultInjected) return;
        faultInjected = true;
        throw new Error("simulated crash after durable transition intent");
      });

      const result = await recorder.dispatch(fixture, "crash-after-transition-intent");
      recorder.assert("durable-refresh-purpose", () => {
        assert.equal(result.exitCode, 1);
        assert.equal(result.envelope.ok, false);
        assert.equal(
          result.envelope.errors[0].code,
          "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
        );
        assert.equal(faultInjected, true);
        const pending = fixture.flowManager.loadReadOnly();
        assert.deepEqual(findActiveNode(pending), {
          scope: "flow",
          stepId: "test-execute",
          taskId: null,
        });
        assert.equal(
          pending.implRepairTransaction?.purpose?.kind,
          "test-evidence-refresh",
        );
        assert.deepEqual(
          readJson(fixture.root, `${fixture.specDir}/issue-log.json`),
          issueLogBefore,
        );
      });

      const pending = fixture.flowManager.loadReadOnly();
      const recovered = recoverImplRepairTransaction({
        root: fixture.root,
        state: pending,
        flowManager: fixture.flowManager,
      });
      recorder.assert("refresh-only-recovery", () => {
        assert.equal(recovered.entry.id, "repair-001");
        const after = fixture.flowManager.loadReadOnly();
        assert.equal(after.implRepairTransaction, undefined);
        assert.equal(findStepById(after.steps, "impl-gate").status, "pending");
        assert.equal(Object.hasOwn(after, "allFindingsResolved"), false);
        assert.equal(Object.hasOwn(after, "resolvedFindings"), false);
        const issueLogAfter = readJson(fixture.root, `${fixture.specDir}/issue-log.json`);
        assert.deepEqual(issueLogAfter, issueLogBefore);
        assert.equal(
          issueLogAfter.entries.filter(
            (entry) => entry.normalizedFindingId === SEMANTIC_FINDING_ID,
          ).length,
          1,
        );
        assert.equal(
          issueLogAfter.entries.some((entry) => Object.hasOwn(entry, "resolution")),
          false,
        );
      });
    });
  });

  it("rejects non-formal, stale, mismatched, or ambiguous material repair authority", async () => {
    const cases = [
      [
        "matrix-v5-generated-artifact-ref",
        { materialRepair: true, materialReference: `specs/${SPEC_ID}/flow.json` },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-unchanged-ref",
        { materialRepair: true, materialReference: "src/unchanged.js" },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-untracked-ref",
        { materialRepair: true, materialReference: "src/untracked.js" },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-symlink-ref",
        { materialRepair: true, materialReference: "node_modules/material-link.js" },
        "STALE_TEST_EVIDENCE_AUTHORITY_INVALID",
      ],
      [
        "matrix-v5-stale-issue-entry",
        { materialRepair: true, materialIssueAt: "2026-07-23T10:39:00.000Z" },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-stale-material-commit",
        { materialRepair: true, materialCommitAt: "2026-07-23T10:35:00.000Z" },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-wrong-normalized-finding",
        { materialRepair: true, materialFindingId: "3".repeat(64) },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-wrong-task-requirement",
        { materialRepair: true, materialTaskAcceptance: "R9 covers another task." },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-null-task-authority",
        { materialRepair: true, materialTaskId: null },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-empty-task-authority",
        { materialRepair: true, materialTaskId: "" },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-unknown-task-authority",
        { materialRepair: true, materialTaskId: "T-unknown" },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-no-semantic-finding",
        { materialRepair: true, semanticFinding: false },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-mixed-triage",
        { materialRepair: true, triageDecisions: ["apply", "reject"] },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-pending-triage",
        { materialRepair: true, triageDecisions: ["pending"] },
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      ],
      [
        "matrix-v5-stale-structural-expected",
        { materialRepair: true, structuralExpected: "f".repeat(64) },
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
      ],
    ];
    for (const [caseName, options, expectedCode] of cases) {
      await assertRejectedWithoutMutation({ caseName, expectedCode, options });
    }
  });

  it("fails closed for wrong lifecycle, outcome, structural failure, and valid competing task authority", async () => {
    const cases = [
      ["matrix-b-wrong-phase", { activeStep: "impl-review" }, "STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH"],
      ["matrix-b-wrong-outcome", { latestOutcome: "retry" }, "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH"],
      ["matrix-b-wrong-failure", { failureReason: "provider unavailable" }, "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH"],
      ["matrix-b-competing-task-authority", { ambiguousTask: true }, "STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH"],
    ];
    for (const [caseName, options, expectedCode] of cases) {
      await assertRejectedWithoutMutation({ caseName, expectedCode, options });
    }
  });

  it("fails closed for current, inconsistent, or unmaterialized repair evidence", async () => {
    const cases = [
      ["matrix-c-already-current", { applySourceChange: false }, "STALE_TEST_EVIDENCE_ALREADY_CURRENT"],
      ["matrix-c-inconsistent-pair", { inconsistentReviewFingerprint: true }, "STALE_TEST_EVIDENCE_AUTHORITY_MISMATCH"],
      ["matrix-c-unmaterialized-repair", { materializedRepair: false }, "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED"],
    ];
    for (const [caseName, options, expectedCode] of cases) {
      await assertRejectedWithoutMutation({ caseName, expectedCode, options });
    }
  });

  it("rejects authority replacement between validation and the locked transition boundary", async () => {
    const replaceJsonWhitespace = (fixture, artifact) => {
      const relativePath = `${fixture.specDir}/${artifact}`;
      const bytes = fs.readFileSync(path.join(fixture.root, relativePath));
      replaceAuthorityFile(fixture.root, relativePath, Buffer.concat([bytes, Buffer.from("\n")]));
    };
    const cases = [
      ["matrix-f-precommit-flow-run", (fixture) => {
        const relativePath = `${fixture.specDir}/flow.json`;
        const flow = readJson(fixture.root, relativePath);
        flow.runId = "run-replaced-after-validation";
        replaceAuthorityFile(
          fixture.root,
          relativePath,
          Buffer.from(`${JSON.stringify(flow, null, 2)}\n`),
        );
      }],
      ["matrix-f-precommit-flow-issue", (fixture) => {
        const relativePath = `${fixture.specDir}/flow.json`;
        const flow = readJson(fixture.root, relativePath);
        flow.issue = ISSUE + 1;
        replaceAuthorityFile(
          fixture.root,
          relativePath,
          Buffer.from(`${JSON.stringify(flow, null, 2)}\n`),
        );
      }],
      ["matrix-f-precommit-issue-log", (fixture) => replaceJsonWhitespace(fixture, "issue-log.json")],
      ["matrix-f-precommit-result", (fixture) => replaceJsonWhitespace(fixture, "test-execute-result.json")],
      ["matrix-f-precommit-review", (fixture) => replaceJsonWhitespace(fixture, "test-result-review.json")],
      ["matrix-f-precommit-raw", (fixture) => {
        const relativePath = `${fixture.specDir}/tests/.raw/test-execution.log`;
        const bytes = fs.readFileSync(path.join(fixture.root, relativePath));
        replaceAuthorityFile(
          fixture.root,
          relativePath,
          Buffer.concat([bytes, Buffer.from("replacement\n")]),
        );
      }],
      ["matrix-f-precommit-manifest", (fixture) => replaceJsonWhitespace(fixture, "repair-fingerprint.json")],
      ["matrix-f-precommit-triage", (fixture) => replaceJsonWhitespace(fixture, "impl-triage.json")],
      ["matrix-f-precommit-impl-review", (fixture) => replaceJsonWhitespace(fixture, "impl-review.json")],
      [
        "matrix-v4-precommit-integration-gate",
        (fixture) => replaceJsonWhitespace(fixture, "impl-gate-result.json"),
        { staleAttemptOwner: true },
      ],
      [
        "matrix-v5-precommit-material-repair",
        (fixture) => {
          const bytes = fs.readFileSync(path.join(fixture.root, MATERIAL_REPAIR_PATH));
          replaceAuthorityFile(
            fixture.root,
            MATERIAL_REPAIR_PATH,
            Buffer.concat([bytes, Buffer.from("\n")]),
          );
        },
        { materialRepair: true },
      ],
    ];

    for (const [caseName, injectFault, options = {}] of cases) {
      await withFixtureCase({
        caseName,
        expectedCode: "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
        options,
      }, async (fixture, recorder) => {
        const paths = authorityPaths(fixture);
        let afterFault = null;
        fixture.container.register("staleTestEvidenceRecoveryFaultInjector", ({ phase }) => {
          assert.equal(phase, "before-update-step-statuses");
          recorder.record("fault-injection", "start", { phase });
          injectFault(fixture);
          afterFault = snapshot(fixture.root, paths);
          recorder.record("fault-injection", "done", { phase });
        });

        const result = await recorder.dispatch(fixture, "precommit-authority-replacement");
        recorder.assert("typed-reject-and-no-owned-mutation", () => {
          assert.equal(result.exitCode, 1, caseName);
          assert.equal(result.envelope.ok, false, caseName);
          assert.equal(
            result.envelope.errors[0].code,
            "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
            `${caseName}: ${JSON.stringify(result.envelope.errors)}`,
          );
          assert.ok(afterFault, `${caseName}: fault hook did not run`);
          assert.deepEqual(snapshot(fixture.root, paths), afterFault, caseName);
        });
      });
    }
  });

  it("rejects symlinked or oversized result, review, and raw evidence without mutation", async () => {
    const cases = [
      ["matrix-g-raw-symlink", "tests/.raw/test-execution.log", "symlink"],
      ["matrix-g-raw-oversized", "tests/.raw/test-execution.log", "oversized"],
      ["matrix-g-result-symlink", "test-execute-result.json", "symlink"],
      ["matrix-g-result-oversized", "test-execute-result.json", "oversized"],
      ["matrix-g-review-symlink", "test-result-review.json", "symlink"],
      ["matrix-g-review-oversized", "test-result-review.json", "oversized"],
    ];
    for (const [caseName, artifact, mode] of cases) {
      await assertRejectedWithoutMutation({
        caseName,
        expectedCode: "STALE_TEST_EVIDENCE_AUTHORITY_INVALID",
        arrange: (fixture) => {
          const relativePath = `${fixture.specDir}/${artifact}`;
          if (mode === "symlink") {
            replaceWithSymlink(fixture.root, relativePath);
            return;
          }
          writeFile(fixture.root, relativePath, Buffer.alloc(MAX_EVIDENCE_BYTES + 1, "x"));
        },
      });
    }
  });

  it("requires exact guards and lets dispatcher reject a mismatched target before mutation", async () => {
    await assertRejectedWithoutMutation({
      caseName: "matrix-d-missing-guard",
      expectedCode: "TARGET_GUARDS_REQUIRED",
      overrides: { expectRunId: undefined },
    });
    for (const [caseName, overrides] of [
      ["matrix-d-mismatched-run", { expectRunId: "another-run" }],
      ["matrix-d-mismatched-spec", { expectSpec: "specs/foreign/spec.json" }],
      ["matrix-d-mismatched-issue", { expectIssue: "999" }],
    ]) {
      await assertRejectedWithoutMutation({
        caseName,
        expectedCode: "ACTIVE_FLOW_MISMATCH",
        overrides,
      });
    }
  });

  it("publishes a bounded discoverable command without arbitrary rewind inputs", async () => {
    const recorder = new CaseRecorder("matrix-e-discoverability", "DISCOVERABLE_BOUNDED_COMMAND");
    recorder.record("fixture-build", "start", { fixture: "registry-entry" });
    recorder.record("fixture-build", "done", { fixture: "registry-entry" });
    recorder.record("dispatch", "start", { operation: "registry-read" });
    const entry = FLOW_COMMANDS.run["rewind-test-evidence"];
    recorder.record("dispatch", "done", { operation: "registry-read", found: Boolean(entry) });
    recorder.assert("bounded-public-contract", () => {
      assert.ok(entry);
      assert.deepEqual(entry.args.flags, ["--expect-no-issue"]);
      assert.deepEqual(entry.args.options, [
        "--agent-work-dir",
        "--expect-issue",
        "--expect-spec",
        "--expect-run-id",
        "--expect-binding",
      ]);
      assert.match(entry.help, /Usage: senti flow run rewind-test-evidence/);
      assert.match(entry.help, /exact runId, spec, and Issue identity guards are required/);
      assert.match(entry.help, /no step, fingerprint, or allowlist input/);
    });
    recorder.record("cleanup", "start", { fixture: "registry-entry" });
    recorder.record("cleanup", "done", { fixture: "registry-entry" });
  });
});
