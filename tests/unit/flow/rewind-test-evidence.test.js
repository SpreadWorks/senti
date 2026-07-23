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
} from "../../../src/flow/lib/impl-repair-artifacts.js";
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

function snapshot(root, relativePaths) {
  return Object.fromEntries(relativePaths.map((relativePath) => {
    const file = path.join(root, relativePath);
    return [relativePath, fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null];
  }));
}

function authorityPaths(fixture) {
  return [
    `${fixture.specDir}/flow.json`,
    `${fixture.specDir}/issue-log.json`,
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

function prepareFixture({
  activeStep = "impl-gate",
  latestOutcome = "external-blocked",
  failureReason = null,
  applySourceChange = true,
  inconsistentReviewFingerprint = false,
  materializedRepair = true,
  ambiguousTask = false,
} = {}) {
  const root = createTmpDir("rewind-stale-test-evidence-");
  roots.add(root);
  const specDir = `specs/${SPEC_ID}`;
  const rawOutputPath = `${specDir}/tests/.raw/test-execution.log`;
  const resultPath = `${specDir}/test-execute-result.json`;

  writeJson(root, SPEC_PATH, {
    goal: "Recover stale implementation test evidence.",
    requirements: [],
    tasks: [],
  });
  writeJson(root, `${specDir}/draft.json`, { marker: "draft remains unchanged" });
  writeJson(root, `${specDir}/file-map.json`, { marker: "source evidence remains unchanged" });
  writeJson(root, `${specDir}/retry-recovery.json`, { marker: "retry recovery remains unchanged" });
  writeFile(root, "src/repair-target.js", "export const value = 'before';\n");

  const previous = buildRepairFingerprint({ root, specPath: SPEC_PATH });
  writeJson(root, `${specDir}/impl-review.json`, {
    version: 1,
    phase: "impl",
    verdict: "REJECTED",
    summary: { blocking: 1, nonBlocking: 0, total: 1 },
    blockingFindings: [{ findingId: "F-1", suggestion: "Apply the verified repair." }],
    nonBlockingImprovements: [],
    repairFingerprint: previous.hash,
  });
  if (materializedRepair) {
    prepareImplTriageArtifact({
      specDir: path.join(root, specDir),
      sourceStep: "impl-review",
      sourceArtifact: "impl-review.json",
      findings: [{ findingId: "F-1", suggestion: "Apply the verified repair." }],
      fingerprint: previous,
    });
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
  });
  if (applySourceChange) {
    writeFile(root, "src/repair-target.js", "export const value = 'after';\n");
  }

  const state = moveFlowToStep(makeFlowState({
    spec: SPEC_PATH,
    runId: RUN_ID,
    issue: ISSUE,
    baseBranch: "main",
    featureBranch: "feature/stale-test-evidence",
    currentTaskId: ambiguousTask ? "T-1" : null,
    tasks: [ambiguousTask ? activeTask() : completedTask()],
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
    taskId: null,
    stepId: "impl-gate",
    attempt: 1,
    outcome,
    recordedAt: "2026-07-23T00:00:02.000Z",
  }).toJSON()];
  writeJson(root, `${specDir}/issue-log.json`, {
    entries: [{
      step: "impl-gate",
      phase: "integration",
      trigger: "gate onError hook (auto)",
      reason: failureReason || `${resultPath.split("/").at(-1)} repairFingerprint mismatch: expected ${current.hash}, got ${previous.hash}`,
      timestamp: "2026-07-23T00:00:01.000Z",
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
    ];

    for (const [caseName, injectFault] of cases) {
      await withFixtureCase({
        caseName,
        expectedCode: "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
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
    await assertRejectedWithoutMutation({
      caseName: "matrix-d-mismatched-target",
      expectedCode: "ACTIVE_FLOW_MISMATCH",
      overrides: { expectRunId: "another-run" },
    });
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
      assert.deepEqual(entry.args.options, ["--expect-issue", "--expect-spec", "--expect-run-id"]);
      assert.match(entry.help, /Usage: senti flow run rewind-test-evidence/);
      assert.match(entry.help, /exact runId, spec, and Issue identity guards are required/);
      assert.match(entry.help, /no step, fingerprint, or allowlist input/);
    });
    recorder.record("cleanup", "start", { fixture: "registry-entry" });
    recorder.record("cleanup", "done", { fixture: "registry-entry" });
  });
});
