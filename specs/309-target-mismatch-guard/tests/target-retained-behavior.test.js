// spec: R5
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "target-retained-"));
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".senti", "config.json"), JSON.stringify({ lang: "ja", type: "base" }));
  return tmp;
}

function writeSpec(root, specId) {
  fs.mkdirSync(path.join(root, "specs", specId), { recursive: true });
  fs.writeFileSync(path.join(root, "specs", specId, "spec.json"), JSON.stringify({ requirements: [] }));
}

function flowState(specId, { issue, runId, autoApprove = true, worktree = false }) {
  return {
    spec: `specs/${specId}/spec.json`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    issue,
    runId,
    autoApprove,
    worktree,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
  };
}

function saveLocalFlow(tmp, specId, opts) {
  writeSpec(tmp, specId);
  const state = flowState(specId, opts);
  const fm = makeFlowManager(tmp);
  fm.create(state, { specId });
  fm.addActiveFlow(specId, "branch");
  return state;
}

function setOnlyStepInProgress(state, stepId) {
  for (const step of flattenSteps(state.steps)) step.status = "pending";
  const step = findStepById(state.steps, stepId);
  assert.ok(step, `step ${stepId} must exist`);
  step.status = "in_progress";
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

describe("target-matched retained behavior", () => {
  const tmpDirs = [];

  afterEach(() => {
    for (const tmp of tmpDirs.splice(0)) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("R5: active worktree-mode runId status resolves through the worktree flow state", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const specId = "403-target";
    const wtRoot = path.join(tmp, ".senti", "worktree", `feature-${specId}`);
    writeSpec(wtRoot, specId);

    const mainFm = makeFlowManager(tmp);
    const worktreeFm = mainFm.forRoot(wtRoot, { specId });
    worktreeFm.create(flowState(specId, {
      issue: 403,
      runId: "run-target-403",
      autoApprove: true,
      worktree: true,
    }), { specId });
    mainFm.addActiveFlow(specId, "worktree");

    const res = runFlow(tmp, ["get", "status", "run-target-403"]);

    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.envelope?.data?.spec, `specs/${specId}/spec.json`);
    assert.equal(res.envelope?.data?.issue, 403);
    assert.equal(res.envelope?.data?.runId, "run-target-403");
    assert.equal(res.envelope?.data?.autoApprove, true);
  });

  it("R5: matched current-context status and positional runId display status are retained", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    saveLocalFlow(tmp, "403-target", { issue: 403, runId: "run-target-403", autoApprove: true });

    const current = runFlow(tmp, ["get", "status", "--expect-issue", "403"]);
    const display = runFlow(tmp, ["get", "status", "run-target-403"]);

    assert.equal(current.status, 0, current.stderr);
    assert.equal(current.envelope?.data?.issue, 403);
    assert.equal(current.envelope?.data?.runId, "run-target-403");
    assert.equal(display.status, 0, display.stderr);
    assert.equal(display.envelope?.data?.issue, 403);
    assert.equal(display.envelope?.data?.runId, "run-target-403");
  });

  it("R5: matched next-action and autoApprove shortcut remain available after target guard passes", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const state = saveLocalFlow(tmp, "403-target", { issue: 403, runId: "run-target-403", autoApprove: true });
    setOnlyStepInProgress(state, "approval");
    replaceFlowState(tmp, state, { specId: "403-target" });

    const next = runFlow(tmp, ["get", "next-action", "--expect-issue", "403"]);

    assert.equal(next.status, 0, next.stderr);
    assert.equal(next.envelope?.data?.step, "approval");
    assert.equal(next.envelope?.data?.requires_approval, true);
  });

  it("R5: matched run and repair command paths are not blocked by target guard", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const state = saveLocalFlow(tmp, "403-target", { issue: 403, runId: "run-target-403", autoApprove: true });
    state.tasks = [{ id: "T-1", title: "task", goal: "task", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }];
    replaceFlowState(tmp, state, { specId: "403-target" });

    const runCommand = runFlow(tmp, ["run", "start-task", "--task-id", "T-1", "--expect-issue", "403"]);
    const repairCommand = runFlow(tmp, ["run", "reopen-draft", "--reason", "matched target retained repair", "--expect-issue", "403"]);

    assert.notEqual(runCommand.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.notEqual(repairCommand.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
  });

  it("R5: matched finalize leaf reaches existing manual recovery instead of target mismatch", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const state = saveLocalFlow(tmp, "403-target", { issue: 403, runId: "run-target-403", autoApprove: true });
    setOnlyStepInProgress(state, "finalize-cleanup");
    replaceFlowState(tmp, state, { specId: "403-target" });

    const res = runFlow(tmp, ["run", "finalize-cleanup", "--expect-issue", "403"]);

    assert.notEqual(res.status, 0);
    assert.notEqual(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(res.envelope?.errors?.[0]?.code, "SQUASH_BASELINE_MISSING");
  });
});
