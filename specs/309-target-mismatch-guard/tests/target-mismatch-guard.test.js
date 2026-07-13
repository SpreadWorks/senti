// spec: R1 R2 R3 R4 R7
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeFlowManager, replaceFlowState } from "../../../tests/helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { flattenSteps, findStepById } from "../../../src/flow/lib/step-tree.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cliPath = path.join(repoRoot, "src/senti.js");

function createTmpProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "target-mismatch-"));
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".senti", "config.json"), JSON.stringify({ lang: "ja", type: "base" }));
  return tmp;
}

function saveFlow(tmp, specId, { issue, runId, autoApprove = true }) {
  fs.mkdirSync(path.join(tmp, "specs", specId), { recursive: true });
  fs.writeFileSync(path.join(tmp, "specs", specId, "spec.json"), JSON.stringify({ requirements: [] }));
  const state = {
    spec: `specs/${specId}/spec.json`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    issue,
    runId,
    autoApprove,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
  };
  const fm = makeFlowManager(tmp);
  fm.create(state, { specId });
  fm.addActiveFlow(specId, "branch");
  return state;
}

function runFlow(tmp, args) {
  const res = spawnSync("node", [cliPath, "flow", ...args], {
    cwd: tmp,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
  });
  const stdout = res.stdout.trim();
  return { ...res, envelope: stdout ? JSON.parse(stdout) : null };
}

function snapshotSteps(tmp, specId) {
  return JSON.stringify(makeFlowManager(tmp).load(specId).steps);
}

function setOnlyStepInProgress(state, stepId) {
  for (const step of flattenSteps(state.steps)) step.status = "pending";
  const step = findStepById(state.steps, stepId);
  assert.ok(step, `step ${stepId} must exist`);
  step.status = "in_progress";
}

describe("explicit flow target mismatch guard", () => {
  const tmpDirs = [];

  afterEach(() => {
    for (const tmp of tmpDirs.splice(0)) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("R1: issue mismatch stops with the required user-facing message before dispatcher actions", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    saveFlow(tmp, "402-active", { issue: 402, runId: "run-active-402" });
    const before = findStepById(makeFlowManager(tmp).load("402-active").steps, "branch").status;

    const res = runFlow(tmp, ["get", "status", "--expect-issue", "403"]);

    assert.notEqual(res.status, 0);
    assert.equal(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.match(res.envelope?.errors?.[0]?.messages?.join("\n") || "", /Another flow is active/);
    assert.match(res.envelope?.errors?.[0]?.messages?.join("\n") || "", /does not match the specified #403/);
    assert.equal(findStepById(makeFlowManager(tmp).load("402-active").steps, "branch").status, before);
  });

  it("R2: spec mismatch is checked against the current dispatcher context", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    saveFlow(tmp, "402-active", { issue: 402, runId: "run-active-402" });

    const res = runFlow(tmp, ["get", "status", "--expect-spec", "403-target"]);

    assert.notEqual(res.status, 0);
    assert.equal(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(res.envelope?.data?.expectedSpec, "403-target");
    assert.equal(res.envelope?.data?.activeSpec, "402-active");
  });

  it("R3: path-like spec targets are normalized to canonical spec IDs in mismatch output", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    saveFlow(tmp, "402-active", { issue: 402, runId: "run-active-402" });

    const res = runFlow(tmp, ["get", "status", "--expect-spec", "specs/403-target/spec.json"]);

    assert.notEqual(res.status, 0);
    assert.equal(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(res.envelope?.data?.expectedSpec, "403-target");
    assert.equal(res.envelope?.data?.activeSpec, "402-active");
  });

  it("R3: runId mismatch exposes expected and active runId fields", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    saveFlow(tmp, "402-active", { issue: 402, runId: "run-active-402" });

    const res = runFlow(tmp, ["get", "status", "--expect-run-id", "run-target-403"]);

    assert.notEqual(res.status, 0);
    assert.equal(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(res.envelope?.data?.expectedRunId, "run-target-403");
    assert.equal(res.envelope?.data?.activeRunId, "run-active-402");
  });

  it("R4: skill guidance places target guard before autoApprove and requires_approval decisions", () => {
    const skill = fs.readFileSync(path.join(repoRoot, "src/skills/senti.flow/SKILL.md"), "utf8");
    const entryIndex = skill.indexOf("### A. Entry");
    const guardIndex = skill.indexOf("ACTIVE_FLOW_MISMATCH", entryIndex);
    const autoIndex = skill.indexOf("autoApprove check", entryIndex);
    const approvalIndex = skill.indexOf("requires_approval", entryIndex);

    assert.notEqual(entryIndex, -1);
    assert.notEqual(guardIndex, -1, "entry guidance must name ACTIVE_FLOW_MISMATCH before dispatcher");
    assert.ok(guardIndex < autoIndex, "target guard must precede autoApprove checks");
    assert.ok(guardIndex < approvalIndex, "target guard must precede requires_approval checks");
  });

  it("R4: approval-step mismatch stops before requires_approval or autoApprove outcome is evaluated", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const state = saveFlow(tmp, "402-active", { issue: 402, runId: "run-active-402", autoApprove: true });
    setOnlyStepInProgress(state, "approval");
    replaceFlowState(tmp, state, { specId: "402-active" });
    const before = snapshotSteps(tmp, "402-active");

    const res = runFlow(tmp, ["get", "next-action", "--expect-issue", "403"]);

    assert.notEqual(res.status, 0);
    assert.equal(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(res.envelope?.data?.expectedIssue, 403);
    assert.equal(res.envelope?.data?.activeIssue, 402);
    assert.equal(res.envelope?.data?.requires_approval, undefined);
    assert.equal(res.envelope?.data?.step, undefined);
    assert.equal(snapshotSteps(tmp, "402-active"), before, "approval mismatch guard must not evaluate or mutate approval state");
  });

  it("R7: next-action with a mismatched explicit issue target stops before mutating active flow steps", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const state = saveFlow(tmp, "402-active", { issue: 402, runId: "run-active-402" });
    for (const step of flattenSteps(state.steps)) step.status = "pending";
    replaceFlowState(tmp, state, { specId: "402-active" });
    const before = snapshotSteps(tmp, "402-active");

    const res = runFlow(tmp, ["get", "next-action", "--expect-issue", "403"]);

    assert.notEqual(res.status, 0);
    assert.equal(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(res.envelope?.data?.expectedIssue, 403);
    assert.equal(res.envelope?.data?.activeIssue, 402);
    assert.equal(snapshotSteps(tmp, "402-active"), before, "mismatched next-action guard must not promote or mutate steps");
  });

  it("R1: mismatched explicit issue target stops dispatcher command paths before execution", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const state = saveFlow(tmp, "402-active", { issue: 402, runId: "run-active-402" });
    state.tasks = [{ id: "T-1", title: "task", goal: "task", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }];
    replaceFlowState(tmp, state, { specId: "402-active" });
    const commandPaths = [
      ["get", "next-action", "--expect-issue", "403"],
      ["run", "review", "--phase", "spec", "--expect-issue", "403"],
      ["run", "start-task", "--task-id", "T-1", "--expect-issue", "403"],
      ["run", "reopen-draft", "--reason", "target guard regression", "--expect-issue", "403"],
      ["run", "finalize-cleanup", "--expect-issue", "403"],
    ];

    for (const args of commandPaths) {
      const before = snapshotSteps(tmp, "402-active");
      const res = runFlow(tmp, args);

      assert.notEqual(res.status, 0, `${args.join(" ")} should stop on mismatch`);
      assert.equal(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH", args.join(" "));
      assert.equal(res.envelope?.data?.expectedIssue, 403);
      assert.equal(res.envelope?.data?.activeIssue, 402);
      assert.equal(snapshotSteps(tmp, "402-active"), before, `${args.join(" ")} must not mutate active flow`);
    }
  });

  it("R2: positional runId status is display-only and does not authorize dispatcher commands", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    saveFlow(tmp, "402-active", { issue: 402, runId: "run-active-402" });
    const fm = makeFlowManager(tmp);
    fm.createPreparingFlow("run-target-403", {
      issue: 403,
      request: "display-only target",
      autoCheck: {
        eligible: true,
        score: 24,
        reason: "fixture",
        goalGate: { checked: true, passed: true },
      },
    });

    const display = runFlow(tmp, ["get", "status", "run-target-403"]);
    const guardedNext = runFlow(tmp, ["get", "next-action", "--expect-run-id", "run-target-403"]);

    assert.equal(display.status, 0, display.stderr);
    assert.equal(display.envelope?.data?.runId, "run-target-403");
    assert.notEqual(guardedNext.status, 0);
    assert.equal(guardedNext.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(guardedNext.envelope?.data?.expectedRunId, "run-target-403");
    assert.equal(guardedNext.envelope?.data?.activeRunId, "run-active-402");
  });

  it("R2: next-action with a mismatched explicit spec target stops before mutating active flow steps", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const state = saveFlow(tmp, "402-active", { issue: 402, runId: "run-active-402" });
    for (const step of flattenSteps(state.steps)) step.status = "pending";
    replaceFlowState(tmp, state, { specId: "402-active" });
    const before = snapshotSteps(tmp, "402-active");

    const res = runFlow(tmp, ["get", "next-action", "--expect-spec", "403-target"]);

    assert.notEqual(res.status, 0);
    assert.equal(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(res.envelope?.data?.expectedSpec, "403-target");
    assert.equal(res.envelope?.data?.activeSpec, "402-active");
    assert.equal(snapshotSteps(tmp, "402-active"), before, "mismatched spec guard must not promote or mutate steps");
  });

  it("R2: run command with a mismatched explicit runId target stops before mutating active flow steps", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const state = saveFlow(tmp, "402-active", { issue: 402, runId: "run-active-402" });
    state.tasks = [{ id: "T-1", title: "task", goal: "task", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }];
    replaceFlowState(tmp, state, { specId: "402-active" });
    const before = snapshotSteps(tmp, "402-active");

    const res = runFlow(tmp, ["run", "start-task", "--task-id", "T-1", "--expect-run-id", "run-target-403"]);

    assert.notEqual(res.status, 0);
    assert.equal(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(res.envelope?.data?.expectedRunId, "run-target-403");
    assert.equal(res.envelope?.data?.activeRunId, "run-active-402");
    assert.equal(snapshotSteps(tmp, "402-active"), before, "mismatched runId guard must not mutate active flow");
  });
});
