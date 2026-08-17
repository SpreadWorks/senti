// spec: R4 R5 R7 R8
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import * as definitionModule from "../../../src/flow/definition.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { draftReviewRouteForRetryPhase } from "../../../src/flow/lib/draft-review-routes.js";

const root = process.cwd();
const registryPath = path.join(root, "src/flow/registry.js");
const definitionPath = path.join(root, "src/flow/definition.js");
const thisFile = fileURLToPath(import.meta.url);
const implResetRange = [
  "test-execute",
  "test-result-review",
  "impl-review",
  "impl-gate",
  "retro",
  "final-regression",
  "finalize-commit",
  "finalize-merge",
  "finalize-sync",
  "finalize-cleanup",
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function snapshotActions(actions) {
  assert.ok(Array.isArray(actions), "resolveLifecycle must return an action array");
  return actions.map((action) => ({
    className: action.constructor.name,
    ...Object.fromEntries(Object.entries(action)),
  }));
}

function resolveLifecycle(input) {
  assert.equal(typeof definitionModule.resolveLifecycle, "function");
  return snapshotActions(definitionModule.resolveLifecycle(input));
}

function assertAction(actions, className, expected = {}) {
  const match = actions.find((action) => {
    if (action.className !== className) return false;
    return Object.entries(expected).every(([key, value]) => {
      if (Array.isArray(value)) return isDeepStrictEqual(action[key], value);
      return action[key] === value;
    });
  });
  assert.ok(match, `missing ${className} ${JSON.stringify(expected)} in ${JSON.stringify(actions)}`);
  return match;
}

function assertActionText(actions, pattern) {
  assert.match(JSON.stringify(actions), pattern);
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function runCli(args) {
  return spawnSync(process.execPath, [path.join(root, "src/sdd-forge.js"), ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function createLifecycleRecorder() {
  const calls = [];
  return {
    calls,
    setStepStatus(step, status) {
      calls.push(["setStepStatus", step, status]);
    },
    keepInProgress(step) {
      calls.push(["keepInProgress", step]);
    },
    incrementMetric(phase, counter) {
      calls.push(["incrementMetric", phase, counter]);
    },
    appendIssueLog(source) {
      calls.push(["appendIssueLog", source]);
    },
    executeSideEffects() {
      calls.push(["executeSideEffects"]);
    },
    skipSteps(steps) {
      calls.push(["skipSteps", steps]);
    },
    resetSteps(steps) {
      calls.push(["resetSteps", steps]);
    },
    runLifecycleHook(module, handler) {
      calls.push(["runLifecycleHook", module, handler]);
    },
  };
}

test("R4: resolveLifecycle returns executable draft review PASS artifact actions", () => {
  assert.equal(typeof definitionModule.applyLifecycleActions, "function");
  const actions = definitionModule.resolveLifecycle({
    event: "review:post",
    command: "run-review",
    phase: "draft",
    currentStepId: "draft-questions-review",
    result: {
      artifacts: {
        verdict: "PASS",
        retryPhase: "draft-questions",
      },
    },
  });
  const snapshots = snapshotActions(actions);

  assertAction(snapshots, "SetStepStatus", { step: "draft-questions-review", status: "done" });
  assertAction(snapshots, "SetStepStatus", { step: "draft-questions-triage", status: "done" });
  assertAction(snapshots, "SetStepStatus", { step: "draft-questions-repair", status: "done" });
  assertAction(snapshots, "RunLifecycleHook", { handler: "writeEmptyDraftReviewRouteArtifacts" });

  const recorder = createLifecycleRecorder();
  definitionModule.applyLifecycleActions(recorder, actions);
  assert.deepEqual(recorder.calls.slice(0, 3), [
    ["setStepStatus", "draft-questions-review", "done"],
    ["setStepStatus", "draft-questions-triage", "done"],
    ["setStepStatus", "draft-questions-repair", "done"],
  ]);
  assert.ok(recorder.calls.some((call) => call[0] === "runLifecycleHook" && call[2] === "writeEmptyDraftReviewRouteArtifacts"));
});

test("R4: draft PASS lifecycle helper creates missing artifacts without overwriting existing artifacts", () => {
  assert.equal(typeof definitionModule.writeEmptyDraftReviewRouteArtifacts, "function");
  const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-forge-draft-pass-"));
  const route = draftReviewRouteForRetryPhase("draft-questions");
  const triagePath = path.join(specDir, route.triageArtifact);
  const repairPath = path.join(specDir, route.repairArtifact);

  definitionModule.writeEmptyDraftReviewRouteArtifacts({
    specDir,
    route,
    generatedAt: "2026-06-08T00:00:00.000Z",
  });
  assert.deepEqual(readJson(triagePath), {
    version: 1,
    phase: "draft-questions-triage",
    sourceReview: "draft-review-questions.json",
    generatedAt: "2026-06-08T00:00:00.000Z",
    summary: "No draft review findings to triage.",
    items: [],
  });
  assert.deepEqual(readJson(repairPath), {
    version: 1,
    phase: "draft-questions-repair",
    sourceTriage: "draft-questions-triage.json",
    generatedAt: "2026-06-08T00:00:00.000Z",
    summary: "No draft triage items to repair.",
    items: [],
  });

  const existingTriage = { version: 1, preserved: "triage" };
  const existingRepair = { version: 1, preserved: "repair" };
  writeJson(triagePath, existingTriage);
  writeJson(repairPath, existingRepair);
  definitionModule.writeEmptyDraftReviewRouteArtifacts({
    specDir,
    route,
    generatedAt: "2026-06-08T00:01:00.000Z",
  });
  assert.deepEqual(readJson(triagePath), existingTriage);
  assert.deepEqual(readJson(repairPath), existingRepair);
});

test("R4: resolveLifecycle covers representative review, gate, and runtime-step transitions", () => {
  const specReview = resolveLifecycle({
    event: "review:post",
    command: "run-review",
    phase: "spec",
    currentStepId: "spec-review",
    result: { artifacts: { verdict: "PASS", phase: "spec" } },
  });
  assertAction(specReview, "SetStepStatus", { step: "spec-review", status: "done" });
  assertAction(specReview, "SetStepStatus", { step: "spec-triage", status: "done" });
  assertAction(specReview, "SetStepStatus", { step: "spec-repair", status: "done" });
  assertAction(specReview, "IncrementMetric", { phase: "spec", counter: "reviewRetry" });

  const testToolingFailure = resolveLifecycle({
    event: "review:post",
    command: "run-review",
    phase: "test",
    currentStepId: "test-review",
    result: { artifacts: { verdict: "TOOLING_FAILURE", phase: "test" } },
  });
  assertAction(testToolingFailure, "AppendIssueLog", { source: "test-review-tooling-failure" });

  const gatePass = resolveLifecycle({
    event: "gate:post",
    command: "run-gate",
    phase: "draft",
    currentStepId: "draft-gate",
    result: { result: "pass", artifacts: { phase: "draft" } },
  });
  assertAction(gatePass, "SetStepStatus", { step: "draft-gate", status: "done" });
  assertAction(gatePass, "ExecuteSideEffects");

  const gateFail = resolveLifecycle({
    event: "gate:post",
    command: "run-gate",
    phase: "draft",
    currentStepId: "draft-gate",
    result: { result: "fail", artifacts: { phase: "draft" } },
  });
  assertAction(gateFail, "SetStepStatus", { step: "draft-gate", status: "in_progress" });
  assertAction(gateFail, "AppendIssueLog", { source: "gate-result" });
  assertAction(gateFail, "IncrementMetric", { phase: "draft", counter: "gateRetry" });

  assert.equal(definitionModule.resolveRuntimeStep({
    command: "run-review",
    phase: "test",
    result: { artifacts: { phase: "test" } },
  }), "test-review");
  assert.equal(definitionModule.resolveRuntimeStep({ command: "run-gate", phase: "draft" }), "draft-gate");
  assert.equal(definitionModule.resolveRuntimeStep({ command: "finalize-merge" }), "finalize-merge");
});

test("R4: resolveLifecycle covers impl proposal reset and finalize downstream behavior", () => {
  const implProposalReset = resolveLifecycle({
    event: "review:post",
    command: "run-review",
    phase: null,
    currentStepId: "impl-review",
    dryRun: false,
    result: { artifacts: { proposalCount: 2 } },
  });
  assertAction(implProposalReset, "RunLifecycleHook", { handler: "resetImplEvidenceAfterReviewProposals" });
  assertAction(implProposalReset, "ResetSteps", { steps: implResetRange });

  assert.equal(typeof definitionModule.resetImplEvidenceAfterReviewProposals, "function");
  const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-forge-impl-reset-"));
  const rawLogPath = path.join(specDir, "tests/.raw/test-execution.log");
  const resultPath = path.join(specDir, "test-execute-result.json");
  fs.mkdirSync(path.dirname(rawLogPath), { recursive: true });
  fs.writeFileSync(rawLogPath, "stale output\n");
  writeJson(resultPath, { stale: true });
  const flowState = {
    steps: [
      {
        id: "impl",
        status: "pending",
        children: implResetRange.map((id) => ({
          id,
          status: "done",
          startedAt: "2026-06-08T00:00:00.000Z",
          finishedAt: "2026-06-08T00:01:00.000Z",
        })),
      },
    ],
  };
  definitionModule.resetImplEvidenceAfterReviewProposals({ specDir, flowState });
  for (const id of implResetRange) {
    const step = flowState.steps[0].children.find((candidate) => candidate.id === id);
    assert.equal(step.status, "pending");
    assert.equal(Object.hasOwn(step, "startedAt"), false);
    assert.equal(Object.hasOwn(step, "finishedAt"), false);
  }
  assert.equal(fs.existsSync(rawLogPath), false);
  assert.equal(fs.existsSync(resultPath), false);

  const finalizeMergeError = resolveLifecycle({
    event: "finalize:onError",
    command: "finalize-merge",
    currentStepId: "finalize-merge",
    error: new Error("merge failed"),
  });
  assertAction(finalizeMergeError, "RunLifecycleHook", { handler: "finalizeOnError" });
  assertAction(finalizeMergeError, "SkipSteps", { steps: ["finalize-sync", "finalize-cleanup"] });

  const finalizeMergeSuccess = resolveLifecycle({
    event: "finalize:post",
    command: "finalize-merge",
    currentStepId: "finalize-merge",
    result: { status: "done", strategy: "squash", mergedFromSha: "abc123" },
  });
  assertAction(finalizeMergeSuccess, "SetStepStatus", { step: "finalize-merge", status: "done" });
  assertAction(finalizeMergeSuccess, "RunLifecycleHook", { handler: "recordMergeOutcome" });
  assertAction(finalizeMergeSuccess, "RunLifecycleHook", { handler: "resetSkippedDownstreamSteps" });

  const finalizeSyncSuccess = resolveLifecycle({
    event: "finalize:post",
    command: "finalize-sync",
    currentStepId: "finalize-sync",
    result: { status: "done" },
  });
  assertAction(finalizeSyncSuccess, "SetStepStatus", { step: "finalize-sync", status: "done" });
  assertAction(finalizeSyncSuccess, "RunLifecycleHook", { handler: "resolveMainRepoFlowManager" });

  const finalizeCleanupSuccess = resolveLifecycle({
    event: "finalize:post",
    command: "finalize-cleanup",
    currentStepId: "finalize-cleanup",
    result: { status: "done" },
  });
  assertAction(finalizeCleanupSuccess, "SetStepStatus", { step: "finalize-cleanup", status: "done" });
  assertAction(finalizeCleanupSuccess, "RunLifecycleHook", { handler: "resolveMainRepoFlowManager" });
});

test("R5: registry hooks delegate definition-derived lifecycle decisions", () => {
  const registry = read(registryPath);
  const lifecycleHookSources = [
    FLOW_COMMANDS.run.gate.pre,
    FLOW_COMMANDS.run.gate.post,
    FLOW_COMMANDS.run.review.post,
    FLOW_COMMANDS.run["finalize-merge"].pre,
    FLOW_COMMANDS.run["finalize-merge"].post,
    FLOW_COMMANDS.run["finalize-merge"].onError,
    FLOW_COMMANDS.run["finalize-sync"].post,
    FLOW_COMMANDS.run["finalize-cleanup"].post,
  ].map((hook) => String(hook));
  const definitionDerivedStepLiteral = /["'](?:draft-questions-review|draft-questions-triage|draft-questions-repair|draft-coverage-review|draft-coverage-triage|draft-coverage-repair|draft-gate|spec-review|spec-triage|spec-repair|spec-gate|test-review|impl-review|impl-gate|finalize-sync|finalize-cleanup)["']/;

  assert.doesNotMatch(registry, /REVIEW_RUNTIME_STEP_BY_PHASE/);
  assert.doesNotMatch(registry, /FINALIZE_DOWNSTREAM_LEAVES/);
  assert.doesNotMatch(registry, /tryUpdateStepStatus\([^)]*"spec-review"[^)]*"done"/);
  assert.doesNotMatch(registry, /tryUpdateStepStatus\([^)]*"test-review"[^)]*"done"/);
  assert.doesNotMatch(registry, /tryUpdateStepStatus\([^)]*"finalize-sync"[^)]*"done"/);
  assert.match(registry, /applyLifecycle|resolveLifecycle|flowDefinition\.(resolveLifecycle|applyLifecycle)/);

  for (const source of lifecycleHookSources) {
    assert.match(source, /applyLifecycleActions|applyLifecycle|resolveLifecycle/);
    assert.doesNotMatch(source, /tryUpdateStepStatus|updateStepStatus|resetSkippedDownstreamSteps|REVIEW_RUNTIME_STEP_BY_PHASE|FINALIZE_DOWNSTREAM_LEAVES/);
    assert.doesNotMatch(source, definitionDerivedStepLiteral);
    assert.doesNotMatch(source, /\[[^\]]*["']finalize-sync["'][^\]]*["']finalize-cleanup["'][^\]]*\]/s);
  }
});

test("R7: registry keeps command metadata while lifecycle ownership changes", () => {
  const registry = read(registryPath);

  for (const commandKey of [
    "prepare",
    "get",
    "set",
    "run",
    "finalize-commit",
    "finalize-merge",
    "finalize-sync",
    "finalize-cleanup",
  ]) {
    assert.match(registry, new RegExp(`["']?${commandKey}["']?\\s*:`));
  }
  assert.match(registry, /helpKey/);
  assert.match(registry, /args\s*:/);
  assert.match(registry, /command:\s*\(\)\s*=>\s*import/);
  assert.match(registry, /applyLifecycle|resolveLifecycle|flowDefinition\.(resolveLifecycle|applyLifecycle)/);

  const flowHelp = runCli(["flow", "--help"]);
  assert.equal(flowHelp.status, 0);
  assert.match(flowHelp.stdout, /Usage: sdd-forge flow/);
  assert.match(flowHelp.stdout, /prepare/);
  assert.match(flowHelp.stdout, /get/);
  assert.match(flowHelp.stdout, /set/);
  assert.match(flowHelp.stdout, /run/);

  const reviewHelp = runCli(["flow", "run", "review", "--help"]);
  assert.equal(reviewHelp.status, 0);
  assert.match(reviewHelp.stdout, /Usage: sdd-forge flow run review/);
  assert.match(reviewHelp.stdout, /--phase/);
  assert.match(reviewHelp.stdout, /--agent-work-dir/);

  const status = runCli(["flow", "get", "status"]);
  assert.equal(status.status, 0);
  const envelope = JSON.parse(status.stdout);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.type, "get");
  assert.equal(envelope.key, "status");
  assert.equal(typeof envelope.data.active, "boolean");

  const invalidSubcommand = runCli(["flow", "definitely-not-a-command"]);
  assert.equal(invalidSubcommand.status, 1);
  assert.match(`${invalidSubcommand.stdout}\n${invalidSubcommand.stderr}`, /sdd-forge flow: unknown command 'definitely-not-a-command'/);
  assert.match(`${invalidSubcommand.stdout}\n${invalidSubcommand.stderr}`, /Run: sdd-forge flow --help/);

  const invalidRunCommand = runCli(["flow", "run", "definitely-not-a-command"]);
  assert.equal(invalidRunCommand.status, 1);
  assert.match(`${invalidRunCommand.stdout}\n${invalidRunCommand.stderr}`, /sdd-forge flow run: unknown key 'definitely-not-a-command'/);
  assert.match(`${invalidRunCommand.stdout}\n${invalidRunCommand.stderr}`, /Run: sdd-forge flow run --help/);
});

test("R8: spec-local coverage observes representative lifecycle transitions", () => {
  const registry = read(registryPath);
  const definition = read(definitionPath);
  const combined = `${registry}\n${definition}`;

  for (const requirement of ["R4:", "R5:", "R7:"]) {
    assert.match(read(thisFile), new RegExp(requirement.replace(":", "\\:")));
  }
  assert.match(combined, /draft[^"']*(triage|repair)|triageArtifact|repairArtifact/is);
  assert.match(combined, /resetImplEvidenceAfterReviewProposals|test-execute[^"']*finalize-cleanup/is);
  assert.doesNotMatch(registry, /REVIEW_RUNTIME_STEP_BY_PHASE/);
});
