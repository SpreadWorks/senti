// spec: R1 R2 R3 R4 R5 R6
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { flattenSteps, findStepById } from "../../../src/flow/lib/step-tree.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cliPath = path.join(repoRoot, "src/senti.js");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function createTmpProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flow-target-status-"));
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "specs", "397-active"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "specs", "399-target"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "specs", "397-active", "spec.json"), JSON.stringify({ requirements: [] }));
  fs.writeFileSync(path.join(tmp, "specs", "399-target", "spec.json"), JSON.stringify({ requirements: [] }));
  fs.writeFileSync(path.join(tmp, ".senti", "config.json"), JSON.stringify({
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  }));
  const git = spawnSync("git", ["init", "-b", "main"], { cwd: tmp, encoding: "utf8" });
  assert.equal(git.status, 0, git.stderr);
  return tmp;
}

function saveFlow(tmp, specId, { issue, runId, autoApprove }) {
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
  makeFlowManager(tmp).save(state, { specId });
  makeFlowManager(tmp).addActiveFlow(specId, "branch");
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

function extractIssueEntryGuardCommand() {
  const skill = read("src/skills/senti.flow/SKILL.md");
  const entryIndex = skill.indexOf("### A. Entry");
  const dispatcherIndex = skill.indexOf("### C. Dispatcher loop");
  const guardIndex = skill.indexOf("senti flow get status <runId> --expect-issue <n>", entryIndex);

  assert.notEqual(entryIndex, -1, "flow skill must contain an Entry section");
  assert.notEqual(guardIndex, -1, "flow entry guidance must name the issue-targeted status guard");
  assert.notEqual(dispatcherIndex, -1, "flow skill must contain a Dispatcher loop section");
  assert.ok(entryIndex < guardIndex && guardIndex < dispatcherIndex, "issue-targeted status guard must be in Entry before Dispatcher loop");

  return ["get", "status", "run-active-397", "--expect-issue", "399"];
}

describe("target flow status mismatch guard", () => {
  const tmpDirs = [];

  afterEach(() => {
    for (const tmp of tmpDirs.splice(0)) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("R1: issue-targeted entry guard stops before dispatcher actions", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    saveFlow(tmp, "397-active", { issue: 397, runId: "run-active-397", autoApprove: true });
    const beforeBranchStatus = findStepById(makeFlowManager(tmp).load("397-active").steps, "branch")?.status;

    const res = runFlow(tmp, extractIssueEntryGuardCommand());

    assert.notEqual(res.status, 0, "mismatch should return a non-zero CLI result");
    assert.equal(res.envelope?.ok, false);
    assert.equal(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(res.envelope?.data?.expectedIssue, 399);
    assert.equal(res.envelope?.data?.activeIssue, 397);

    const saved = makeFlowManager(tmp).load("397-active");
    assert.equal(findStepById(saved.steps, "branch")?.status, beforeBranchStatus, "status mismatch check must not mutate or advance the active flow");
  });

  it("R2: active runId status reads the target flow autoApprove instead of another active context", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    saveFlow(tmp, "397-active", { issue: 397, runId: "run-active-397", autoApprove: false });
    saveFlow(tmp, "399-target", { issue: 399, runId: "run-target-399", autoApprove: true });

    const res = runFlow(tmp, ["get", "status", "run-target-399", "--expect-issue", "399"]);

    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.envelope?.data?.issue, 399);
    assert.equal(res.envelope?.data?.runId, "run-target-399");
    assert.equal(res.envelope?.data?.autoApprove, true);
  });

  it("R2: preparing status does not expose autoApprove as active-flow approval state", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const fm = makeFlowManager(tmp);
    fm.createPreparingFlow("run-preparing-400", {
      issue: 400,
      request: "target flow mismatch",
      autoCheck: {
        eligible: true,
        score: 24,
        reason: "spec-local trusted verdict",
        goalGate: { checked: true, passed: true },
      },
    });

    const before = runFlow(tmp, ["get", "status", "run-preparing-400", "--expect-issue", "400"]);
    const auto = runFlow(tmp, ["set", "auto", "on", "--run-id", "run-preparing-400"]);
    const afterAuto = runFlow(tmp, ["get", "status", "run-preparing-400", "--expect-issue", "400"]);
    const prepare = runFlow(tmp, [
      "prepare",
      "--title",
      "preparing-inherits",
      "--base",
      "main",
      "--no-branch",
      "--run-id",
      "run-preparing-400",
    ]);
    const active = runFlow(tmp, ["get", "status", "run-preparing-400", "--expect-issue", "400"]);

    assert.equal(before.status, 0, before.stderr);
    assert.equal(before.envelope?.data?.autoApprove, false);
    assert.equal(auto.status, 0, auto.stderr);
    assert.equal(auto.envelope?.data?.autoApprove, true);
    assert.equal(auto.envelope?.data?.runId, "run-preparing-400");
    assert.equal(afterAuto.status, 0, afterAuto.stderr);
    assert.equal(afterAuto.envelope?.data?.autoApprove, false, "preparing status stays false even after set-auto");
    assert.equal(prepare.status, 0, prepare.stderr);
    assert.equal(active.status, 0, active.stderr);
    assert.equal(active.envelope?.data?.issue, 400);
    assert.equal(active.envelope?.data?.runId, "run-preparing-400");
    assert.equal(active.envelope?.data?.autoApprove, true, "prepare must inherit preparing autoApprove into active flow");
  });

  it("R3: unsafe bare-status guidance is removed from source skill guidance", () => {
    const corePrinciple = read("src/skills/partials/core-principle.md");

    assert.doesNotMatch(corePrinciple, /Run the command exactly as `senti flow get status`/);
    assert.doesNotMatch(corePrinciple, /no extra options/i);
    assert.match(corePrinciple, /senti flow get status <runId>/);
    assert.match(corePrinciple, /--expect-issue/);
  });

  it("R4: mismatch envelope exposes machine-readable target and active identifiers", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    saveFlow(tmp, "397-active", { issue: 397, runId: "run-active-397", autoApprove: true });

    const res = runFlow(tmp, ["get", "status", "run-active-397", "--expect-issue", "399"]);

    assert.notEqual(res.status, 0);
    assert.equal(res.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.deepEqual(
      {
        expectedIssue: res.envelope?.data?.expectedIssue,
        activeIssue: res.envelope?.data?.activeIssue,
        expectedRunId: res.envelope?.data?.expectedRunId,
        activeRunId: res.envelope?.data?.activeRunId,
      },
      {
        expectedIssue: 399,
        activeIssue: 397,
        expectedRunId: "run-active-397",
        activeRunId: "run-active-397",
      },
    );
  });

  it("R5: bare status remains current-context and runId status remains target lookup", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    saveFlow(tmp, "397-active", { issue: 397, runId: "run-active-397", autoApprove: false });
    const bare = runFlow(tmp, ["get", "status"]);

    saveFlow(tmp, "399-target", { issue: 399, runId: "run-target-399", autoApprove: true });
    const target = runFlow(tmp, ["get", "status", "run-target-399"]);

    assert.equal(bare.status, 0, bare.stderr);
    assert.equal(bare.envelope?.data?.issue, 397);
    assert.equal(bare.envelope?.data?.autoApprove, false);
    assert.equal(target.status, 0, target.stderr);
    assert.equal(target.envelope?.data?.issue, 399);
    assert.equal(target.envelope?.data?.autoApprove, true);
  });

  it("R5: autoApprove approval path keeps target status plus requires_approval behavior", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const state = saveFlow(tmp, "399-target", { issue: 399, runId: "run-target-399", autoApprove: true });
    setOnlyStepInProgress(state, "approval");
    makeFlowManager(tmp).save(state);

    const status = runFlow(tmp, ["get", "status", "run-target-399"]);
    const next = runFlow(tmp, ["get", "next-action"]);
    const corePrinciple = read("src/skills/partials/core-principle.md");

    assert.equal(status.status, 0, status.stderr);
    assert.equal(status.envelope?.data?.autoApprove, true);
    assert.equal(next.status, 0, next.stderr);
    assert.equal(next.envelope?.data?.step, "approval");
    assert.equal(next.envelope?.data?.requires_approval, true);
    assert.match(corePrinciple, /requires_approval/);
    assert.match(corePrinciple, /treat choice id=1 as selected/);
  });

  it("R5: finalize recovery exception remains an executable recovery envelope", () => {
    const tmp = createTmpProject();
    tmpDirs.push(tmp);
    const state = saveFlow(tmp, "399-target", { issue: 399, runId: "run-target-399", autoApprove: true });
    setOnlyStepInProgress(state, "finalize-cleanup");
    makeFlowManager(tmp).save(state);

    const res = runFlow(tmp, ["run", "finalize-cleanup"]);
    const saved = makeFlowManager(tmp).load("399-target");

    assert.notEqual(res.status, 0);
    assert.equal(res.envelope?.ok, false);
    assert.equal(res.envelope?.errors?.[0]?.code, "SQUASH_BASELINE_MISSING");
    assert.deepEqual(res.envelope?.data?.recoveryOptions, ["archive-and-manual-cherry-pick", "force-continue"]);
    assert.equal(findStepById(saved.steps, "finalize-cleanup")?.status, "in_progress");
  });

  it("R6: generated agent skill stays synchronized with source runId-aware guidance", () => {
    const source = read("src/skills/partials/core-principle.md");
    const generated = read(".agents/skills/senti.flow/SKILL.md");

    for (const marker of ["senti flow get status <runId>", "--expect-issue", "preparing"]) {
      assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `source missing ${marker}`);
      assert.match(generated, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `generated skill missing ${marker}`);
    }
    assert.doesNotMatch(generated, /Run the command exactly as `senti flow get status`/);
  });
});
