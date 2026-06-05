// spec: R1 R2 R3 R4 R5 R6 R7 R8

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import GetStatusCommand from "../../../src/flow/lib/get-status.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const SDD_FORGE = path.join(ROOT, "src", "sdd-forge.js");
const CURRENT_FIELDS = [
  "active",
  "spec",
  "baseBranch",
  "featureBranch",
  "worktree",
  "issue",
  "runId",
  "phase",
  "steps",
  "stepsProgress",
  "requirements",
  "requirementsProgress",
  "mergeStrategy",
  "autoApprove",
];
const DETAIL_FIELDS = [
  "notes",
  "metrics",
  "metricsSummary",
  "request",
  "broadModeHistory",
  "broadModeHistoryTotal",
  "broadModeHistoryTruncated",
];

function findStep(steps, id) {
  for (const step of steps) {
    if (step.id === id) return step;
    const child = step.children ? findStep(step.children, id) : null;
    if (child) return child;
  }
  return null;
}

function stepsWithActive(id) {
  const steps = buildInitialSteps();
  const step = findStep(steps, id);
  assert.ok(step, `missing step fixture ${id}`);
  step.status = "in_progress";
  return steps;
}

function makeTmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-status-details-"));
  fs.mkdirSync(path.join(root, ".sdd-forge"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".sdd-forge", "config.json"),
    JSON.stringify({
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    }, null, 2),
  );
  return root;
}

function writeSpec(root, specId) {
  const dir = path.join(root, "specs", specId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "spec.json"),
    JSON.stringify({
      goal: "status details contract fixture",
      scope: { in: [], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      background: "",
      requirements: [
        { id: "R-fixture", priority: "must", desc: "fixture requirement", status: "pending" },
      ],
      acceptance_criteria: [],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
    }, null, 2),
  );
}

function setupActiveFlow(overrides = {}) {
  const root = makeTmpRoot();
  const specId = "001-status-details";
  writeSpec(root, specId);
  const state = {
    spec: `specs/${specId}/spec.json`,
    baseBranch: "main",
    featureBranch: "feature/status-details",
    worktree: false,
    issue: 363,
    runId: "status-details-run-id",
    phase: "plan",
    steps: buildInitialSteps(),
    request: "long request text that belongs in detailed output",
    requirements: [],
    tasks: [],
    currentTaskId: null,
    notes: [{ text: "audit note", taskId: null, ts: "2026-01-01T00:00:00.000Z" }],
    metrics: [{ phase: "draft", counter: "srcRead", delta: 1, taskId: null, ts: "2026-01-01T00:00:00.000Z" }],
    broadModeHistory: [{ step: "implement", enabled: true, reason: "audit history", ts: "2026-01-01T00:00:00.000Z" }],
    mergeStrategy: "squash",
    autoApprove: true,
    ...overrides,
  };
  const fm = makeFlowManager(root);
  fm.save(state);
  fm.addActiveFlow(specId, "local");
  return { root, runId: state.runId };
}

function setupRetryRecoveryFlow() {
  return setupActiveFlow({
    steps: stepsWithActive("spec-review"),
    metrics: [{ phase: "spec", counter: "reviewRetry", delta: 1, taskId: null, ts: "2026-01-01T00:00:00.000Z" }],
    retryRecovery: {
      entries: [{
        kind: "review",
        phase: "spec",
        canonicalPhase: "spec",
        attemptsBefore: 1,
        maxAttempts: 4,
        changedEvidence: {
          sourceKind: "spec",
          baselineHash: "before-hash",
          currentHash: "after-hash",
          changedPaths: ["specs/001-status-details/spec.json"],
          truncated: false,
        },
        reason: "changed evidence",
        createdAt: "2026-01-01T00:00:00.000Z",
      }],
    },
  });
}

function setupStoppedReviewFlow() {
  return setupActiveFlow({
    steps: stepsWithActive("spec-review"),
    reviewStop: {
      stopReason: "provider_failure",
      classification: "provider_failure",
      phase: "spec",
      reason: "review provider failed",
      retryBudgetConsumed: false,
      recoveryCommand: "sdd-forge flow run review --phase spec",
    },
  });
}

function setupStoppedGateFlow() {
  return setupActiveFlow({
    steps: stepsWithActive("spec-gate"),
    metrics: Array.from({ length: 5 }, () => ({
      phase: "spec",
      counter: "gateRetry",
      delta: 1,
      taskId: null,
      ts: "2026-01-01T00:00:00.000Z",
    })),
  });
}

function setupRunIdSelectionFlows() {
  const root = makeTmpRoot();
  const activeSpecId = "001-active-status";
  const selectedSpecId = "002-selected-status";
  writeSpec(root, activeSpecId);
  writeSpec(root, selectedSpecId);
  const fm = makeFlowManager(root);
  fm.save({
    spec: `specs/${activeSpecId}/spec.json`,
    baseBranch: "main",
    featureBranch: "feature/active-status",
    worktree: false,
    issue: 101,
    runId: "active-run-id",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
    request: "active flow request",
    notes: [],
    metrics: [],
    mergeStrategy: "merge",
    autoApprove: false,
  });
  fm.save({
    spec: `specs/${selectedSpecId}/spec.json`,
    baseBranch: "main",
    featureBranch: "feature/selected-status",
    worktree: false,
    issue: 202,
    runId: "selected-run-id",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
    request: "selected flow request",
    notes: [{ text: "selected note", taskId: null, ts: "2026-01-01T00:00:00.000Z" }],
    metrics: [{ phase: "draft", counter: "srcRead", delta: 2, taskId: null, ts: "2026-01-01T00:00:00.000Z" }],
    mergeStrategy: "squash",
    autoApprove: true,
  });
  fm.addActiveFlow(activeSpecId, "local");
  fm.addActiveFlow(selectedSpecId, "local");
  return { root, selectedRunId: "selected-run-id" };
}

function sharedStatusTestSource() {
  return fs.readFileSync(path.join(ROOT, "tests", "unit", "flow", "get-status.test.js"), "utf8");
}

function runCli(root, args) {
  try {
    const stdout = execFileSync(process.execPath, [SDD_FORGE, ...args], {
      cwd: ROOT,
      env: { ...process.env, SDD_FORGE_WORK_ROOT: root },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

function statusData(root, args = []) {
  const res = runCli(root, ["flow", "get", "status", ...args]);
  assert.equal(res.status, 0, `status command failed: ${res.stderr || res.stdout}`);
  const env = JSON.parse(res.stdout);
  assert.equal(env.ok, true);
  return env.data;
}

function assertHasKeys(obj, keys) {
  for (const key of keys) assert.ok(Object.hasOwn(obj, key), `expected key ${key}`);
}

function assertLacksKeys(obj, keys) {
  for (const key of keys) assert.equal(Object.hasOwn(obj, key), false, `unexpected key ${key}`);
}

function assertExactDefaultKeys(obj) {
  const allowed = new Set(CURRENT_FIELDS);
  if (Object.hasOwn(obj, "retryRecovery")) allowed.add("retryRecovery");
  assert.deepEqual(Object.keys(obj).sort(), [...allowed].sort());
}

test("R1: default active status returns current status fields", () => {
  const { root } = setupActiveFlow();
  const data = statusData(root);

  assert.equal(data.active, true);
  assertHasKeys(data, CURRENT_FIELDS);
  assertExactDefaultKeys(data);
  assert.equal(data.mergeStrategy, "squash");
  assert.equal(data.autoApprove, true);
  assert.ok(Array.isArray(data.steps));
  assert.ok(Array.isArray(data.requirements));
});

test("R1: default active status includes retryRecovery when present", () => {
  const { root } = setupRetryRecoveryFlow();
  const data = statusData(root);

  assertHasKeys(data, [...CURRENT_FIELDS, "retryRecovery"]);
  assertExactDefaultKeys(data);
  assert.equal(data.retryRecovery.kind, "review");
  assert.equal(data.retryRecovery.phase, "spec");
  assert.equal(data.retryRecovery.recoveryPossible, true);
});

test("R2: default active status omits audit and detail fields", () => {
  const { root } = setupActiveFlow();
  const data = statusData(root);

  assertLacksKeys(data, [
    ...DETAIL_FIELDS,
    "reviewStop",
    "gateStop",
  ]);
});

test("R3: --details returns default fields plus audit and detail fields", () => {
  const { root } = setupActiveFlow();
  const data = statusData(root, ["--details"]);

  assertHasKeys(data, CURRENT_FIELDS);
  assertHasKeys(data, DETAIL_FIELDS);
  assert.equal(data.request, "long request text that belongs in detailed output");
  assert.equal(data.notes.length, 1);
  assert.equal(data.metrics.length, 1);
  assert.equal(data.metricsSummary.flow.draft.srcRead, 1);
  assert.equal(data.broadModeHistory.length, 1);
});

test("R3: --details includes reviewStop and gateStop when present", () => {
  const review = statusData(setupStoppedReviewFlow().root, ["--details"]);
  const gate = statusData(setupStoppedGateFlow().root, ["--details"]);

  assert.equal(review.reviewStop.phase, "spec");
  assert.equal(review.reviewStop.classification, "provider_failure");
  assert.equal(gate.gateStop.kind, "gate");
  assert.equal(gate.gateStop.phase, "spec");
});

test("R4: runId status uses the same default and --details field contract", () => {
  const { root, runId } = setupActiveFlow();
  const defaultData = statusData(root, [runId]);
  const detailedData = statusData(root, [runId, "--details"]);

  assert.equal(defaultData.runId, runId);
  assertHasKeys(defaultData, CURRENT_FIELDS);
  assertExactDefaultKeys(defaultData);
  assertLacksKeys(defaultData, DETAIL_FIELDS);
  assert.equal(detailedData.runId, runId);
  assertHasKeys(detailedData, CURRENT_FIELDS);
  assertHasKeys(detailedData, DETAIL_FIELDS);

  const retry = setupRetryRecoveryFlow();
  const retryDefault = statusData(retry.root, [retry.runId]);
  assertExactDefaultKeys(retryDefault);
  assert.equal(retryDefault.retryRecovery.kind, "review");
  assert.equal(retryDefault.retryRecovery.phase, "spec");

  const stoppedReview = setupStoppedReviewFlow();
  const stoppedReviewDefault = statusData(stoppedReview.root, [stoppedReview.runId]);
  const stoppedReviewDetailed = statusData(stoppedReview.root, [stoppedReview.runId, "--details"]);
  assertExactDefaultKeys(stoppedReviewDefault);
  assert.equal(Object.hasOwn(stoppedReviewDefault, "reviewStop"), false);
  assert.equal(stoppedReviewDetailed.reviewStop.phase, "spec");

  const stoppedGate = setupStoppedGateFlow();
  const stoppedGateDefault = statusData(stoppedGate.root, [stoppedGate.runId]);
  const stoppedGateDetailed = statusData(stoppedGate.root, [stoppedGate.runId, "--details"]);
  assertExactDefaultKeys(stoppedGateDefault);
  assert.equal(Object.hasOwn(stoppedGateDefault, "gateStop"), false);
  assert.equal(stoppedGateDetailed.gateStop.phase, "spec");

  const selection = setupRunIdSelectionFlows();
  const selectedDefault = statusData(selection.root, [selection.selectedRunId]);
  const selectedDetailed = statusData(selection.root, [selection.selectedRunId, "--details"]);
  assert.equal(selectedDefault.runId, "selected-run-id");
  assert.equal(selectedDefault.issue, 202);
  assert.equal(selectedDefault.featureBranch, "feature/selected-status");
  assertExactDefaultKeys(selectedDefault);
  assert.equal(selectedDetailed.request, "selected flow request");
  assert.equal(selectedDetailed.notes[0].text, "selected note");
});

test("R5: inactive status remains active false with and without --details", () => {
  const root = makeTmpRoot();

  assert.deepEqual(statusData(root), { active: false });
  assert.deepEqual(statusData(root, ["--details"]), { active: false });
});

test("R6: status validates --details, unknown options, and runId failures", () => {
  const { root } = setupActiveFlow();
  const minLengthRunId = "r";
  const maxLengthRunId = "r".repeat(200);
  const minLength = setupActiveFlow({ runId: minLengthRunId });
  const maxLength = setupActiveFlow({ runId: maxLengthRunId });

  const help = runCli(root, ["flow", "get", "status", "--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--details/);

  const details = runCli(root, ["flow", "get", "status", "--details"]);
  assert.equal(details.status, 0, details.stderr || details.stdout);

  assert.equal(statusData(minLength.root, [minLengthRunId]).runId, minLengthRunId);
  assert.equal(statusData(maxLength.root, [maxLengthRunId]).runId, maxLengthRunId);

  const emptyRunId = runCli(root, ["flow", "get", "status", ""]);
  assert.notEqual(emptyRunId.status, 0);
  assert.match(`${emptyRunId.stdout}${emptyRunId.stderr}`, /runId|invalid|empty/i);

  const unknownOption = runCli(root, ["flow", "get", "status", "--not-a-status-option"]);
  assert.notEqual(unknownOption.status, 0);
  assert.match(`${unknownOption.stdout}${unknownOption.stderr}`, /unknown option/i);

  const invalidRunId = runCli(root, ["flow", "get", "status", "x".repeat(201)]);
  assert.notEqual(invalidRunId.status, 0);
  assert.match(`${invalidRunId.stdout}${invalidRunId.stderr}`, /runId|invalid/i);

  const unmatchedRunId = runCli(root, ["flow", "get", "status", "missing-run-id"]);
  assert.notEqual(unmatchedRunId.status, 0);
  assert.match(`${unmatchedRunId.stdout}${unmatchedRunId.stderr}`, /RUN_ID_NOT_FOUND|missing-run-id/);
});

test("R7: default status does not build or attach metricsSummary", () => {
  const { root } = setupActiveFlow();

  assert.equal(Object.hasOwn(statusData(root), "metricsSummary"), false);
  assert.ok(Object.hasOwn(statusData(root, ["--details"]), "metricsSummary"));
});

test("R7: default status generation does not construct metricsSummary", () => {
  const root = makeTmpRoot();
  const metrics = new Proxy([], {
    get(target, prop, receiver) {
      if (prop === "length" || prop === Symbol.iterator) {
        throw new Error("metricsSummary was constructed");
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  const command = new GetStatusCommand();
  const data = command.execute({
    root,
    flowState: {
      spec: "specs/001-status-details/spec.json",
      baseBranch: "main",
      featureBranch: "feature/status-details",
      steps: buildInitialSteps(),
      requirements: [],
      metrics,
    },
  });

  assert.equal(data.active, true);
  assert.equal(Object.hasOwn(data, "metricsSummary"), false);
});

test("R8: spec-local tests declare every requirement in the coverage header", () => {
  const testFile = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  const sharedTest = sharedStatusTestSource();

  assert.match(testFile, /^\/\/ spec: R1 R2 R3 R4 R5 R6 R7 R8/m);
  for (const id of ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]) {
    assert.ok(testFile.includes(`test("${id}:`), `${id} must have a matching test name`);
  }
  assert.match(sharedTest, /omits audit details from default status/);
  assert.match(sharedTest, /returns audit details when --details is requested/);
});
