// spec: R1 R2 R3 R4 R5 R6 R7 R8
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const SENTI = path.join(ROOT, "src/senti.js");
const tmpDirs = [];

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
  }
});

function tmpRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "senti-313-"));
  tmpDirs.push(dir);
  return dir;
}

function runSenti(root, args, options = {}) {
  const stdout = execFileSync("node", [SENTI, ...args], {
    cwd: options.cwd || root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: options.workRoot || root },
  });
  return JSON.parse(stdout);
}

function runSentiFailure(root, args, options = {}) {
  try {
    runSenti(root, args, options);
  } catch (error) {
    return JSON.parse(error.stdout.toString());
  }
  assert.fail(`expected command to fail: senti ${args.join(" ")}`);
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

function initGit(root) {
  git(root, ["init"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test User"]);
  git(root, ["commit", "--allow-empty", "-m", "init"]);
  git(root, ["branch", "-M", "main"]);
}

function addActiveFlow(root, specId, mode = "local") {
  const activePath = path.join(root, ".senti", ".active-flow");
  fs.mkdirSync(path.dirname(activePath), { recursive: true });
  const existing = fs.existsSync(activePath) ? JSON.parse(fs.readFileSync(activePath, "utf8")) : [];
  if (!existing.some((entry) => entry.spec === specId)) {
    existing.push({ spec: specId, mode });
  }
  fs.writeFileSync(activePath, JSON.stringify(existing, null, 2));
}

function flowState(specId, overrides = {}) {
  return {
    spec: `specs/${specId}/spec.json`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    issue: 407,
    runId: `${specId}-run`,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [
      {
        id: "T-1",
        title: "Task",
        goal: "Test task",
        parent: null,
        origin: "plan",
        added_round: 0,
        status: "pending",
      },
    ],
    currentTaskId: null,
    ...overrides,
  };
}

function writeSpec(root, specId, state) {
  const specDir = path.join(root, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
    goal: "test",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "test",
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  }, null, 2));
  fs.writeFileSync(path.join(specDir, "flow.json"), JSON.stringify(state, null, 2));
}

function setupDiscoveryRoot() {
  const root = tmpRoot();
  initGit(root);
  writeSpec(root, "001-active", flowState("001-active"));
  addActiveFlow(root, "001-active");
  writeSpec(root, "002-finalized", flowState("002-finalized", { finalizedAt: "2026-06-25T00:00:00Z" }));
  const stale = flowState("003-stale", { featureBranch: "feature/003-stale" });
  writeSpec(root, "003-stale", stale);
  return root;
}

function addWorktreeCandidate(root, specId = "005-worktree") {
  const worktree = path.join(root, ".senti", "worktree", `feature-${specId}`);
  fs.mkdirSync(path.dirname(worktree), { recursive: true });
  git(root, ["worktree", "add", worktree, "-b", `feature/${specId}`]);
  writeSpec(worktree, specId, flowState(specId, {
    worktree: true,
    runId: `${specId}-run`,
  }));
  return worktree;
}

function addBranchOnlyCandidate(root, specId = "006-branch-only", branchName = `feature/${specId}`) {
  git(root, ["switch", "-c", branchName]);
  writeSpec(root, specId, flowState(specId, {
    runId: `${specId}-run`,
    featureBranch: branchName,
  }));
  git(root, ["add", `specs/${specId}/spec.json`, `specs/${specId}/flow.json`]);
  git(root, ["commit", "-m", `add ${specId}`]);
  git(root, ["switch", "main"]);
}

test("R1: normal active-flow status ignores recovery discovery candidates", () => {
  const root = tmpRoot();
  initGit(root);
  writeSpec(root, "003-stale", flowState("003-stale"));

  const resume = runSenti(root, ["flow", "resume"]);
  assert.equal(resume.ok, true);
  assert.ok(Array.isArray(resume.data.recoveryCandidates));

  const status = runSenti(root, ["flow", "get", "status"]);
  assert.equal(status.ok, true);
  assert.equal(status.data.active, false);

  const nextAction = runSenti(root, ["flow", "get", "next-action"]);
  assert.notEqual(nextAction.data?.spec, "specs/003-stale/spec.json");
  assert.doesNotMatch(JSON.stringify(nextAction), /003-stale/);
});

test("R2: resume discovery classifies recovery candidate states", () => {
  const root = setupDiscoveryRoot();
  addWorktreeCandidate(root, "005-worktree");
  addBranchOnlyCandidate(root, "006-branch-only");

  const result = runSenti(root, ["flow", "resume"]);
  const bySpec = new Map(result.data.recoveryCandidates.map((candidate) => [candidate.specId, candidate]));

  assert.equal(bySpec.get("001-active").state, "active");
  assert.equal(bySpec.get("002-finalized").state, "finalized");
  assert.equal(bySpec.get("003-stale").state, "stale");
  assert.equal(bySpec.get("005-worktree").state, "orphan-worktree");
  assert.equal(bySpec.get("006-branch-only").state, "branch-only");
});

test("R3: resume --spec selects only candidates with runId and execution root", () => {
  const root = setupDiscoveryRoot();
  writeSpec(root, "004-missing-run", flowState("004-missing-run", { runId: null }));
  addBranchOnlyCandidate(root, "006-branch-only");

  const selected = runSenti(root, ["flow", "resume", "--spec", "001-active"]);
  assert.equal(selected.ok, true);
  assert.equal(selected.data.selected.runId, "001-active-run");
  assert.equal(selected.data.selected.executionRoot, root);

  const blocked = runSentiFailure(root, ["flow", "resume", "--spec", "004-missing-run"]);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errors[0].code, "RESUME_TARGET_NOT_CONTINUABLE");

  const noExecutionRoot = runSentiFailure(root, ["flow", "resume", "--spec", "006-branch-only"]);
  assert.equal(noExecutionRoot.errors[0].code, "RESUME_TARGET_NOT_CONTINUABLE");
});

test("R4: guarded continuation rejects mismatched runId before command work", () => {
  const root = setupDiscoveryRoot();
  writeSpec(root, "001-active", flowState("001-active", { runId: "expected-run" }));

  const statusMismatch = runSentiFailure(root, [
    "flow",
    "get",
    "status",
    "--expect-run-id",
    "other-run",
  ]);
  assert.equal(statusMismatch.errors[0].code, "ACTIVE_FLOW_MISMATCH");

  const mismatch = runSentiFailure(root, [
    "flow",
    "get",
    "next-action",
    "--expect-run-id",
    "other-run",
  ]);

  assert.equal(mismatch.errors[0].code, "ACTIVE_FLOW_MISMATCH");

  const runMismatch = runSentiFailure(root, [
    "flow",
    "run",
    "gate",
    "--phase",
    "draft",
    "--expect-run-id",
    "other-run",
  ]);
  assert.equal(runMismatch.errors[0].code, "ACTIVE_FLOW_MISMATCH");
  assert.equal(
    fs.existsSync(path.join(root, "specs", "001-active", "draft-gate-source.json")),
    false,
    "run gate mismatch must stop before writing draft gate artifacts",
  );
});

test("R4: recovered execution root is used for guarded continuation", () => {
  const root = tmpRoot();
  initGit(root);
  addWorktreeCandidate(root, "005-worktree");

  const selected = runSenti(root, ["flow", "resume", "--spec", "005-worktree"]);
  const executionRoot = selected.data.selected.executionRoot;
  const runId = selected.data.selected.runId;

  const status = runSenti(executionRoot, ["flow", "get", "status", "--expect-run-id", runId], {
    cwd: executionRoot,
    workRoot: executionRoot,
  });
  assert.equal(status.data.runId, runId);

  const nextActionMismatch = runSentiFailure(executionRoot, [
    "flow",
    "get",
    "next-action",
    "--expect-run-id",
    "wrong-run",
  ], { cwd: executionRoot, workRoot: executionRoot });
  assert.equal(nextActionMismatch.errors[0].code, "ACTIVE_FLOW_MISMATCH");

  const runMismatch = runSentiFailure(executionRoot, [
    "flow",
    "run",
    "gate",
    "--phase",
    "draft",
    "--expect-run-id",
    "wrong-run",
  ], { cwd: executionRoot, workRoot: executionRoot });
  assert.equal(runMismatch.errors[0].code, "ACTIVE_FLOW_MISMATCH");
  assert.equal(
    fs.existsSync(path.join(executionRoot, "specs", "005-worktree", "draft-gate-source.json")),
    false,
    "recovered-root run mismatch must stop before writing draft gate artifacts",
  );
});

test("R5: resume output provides execution-root guarded guidance or safe-stop guidance", () => {
  const root = setupDiscoveryRoot();

  const selected = runSenti(root, ["flow", "resume", "--spec", "001-active"]);
  assert.match(selected.data.guidance.continueFrom, /001-active-run/);
  assert.equal(selected.data.guidance.executionRoot, root);

  const finalized = runSentiFailure(root, ["flow", "resume", "--spec", "002-finalized"]);
  assert.match(finalized.errors[0].messages.join("\n"), /safe-stop|finalized|blocked/i);

  const skill = fs.readFileSync(path.join(ROOT, "src/skills/senti.flow-resume/SKILL.md"), "utf8");
  assert.doesNotMatch(skill, /Mainline phases.*\/senti\.flow/);
  assert.match(skill, /--expect-run-id/);
  assert.match(skill, /execution root|worktreePath|worktree path/i);
});

test("R6: recovery discovery does not register display-only candidates as active flows", () => {
  const root = setupDiscoveryRoot();

  runSenti(root, ["flow", "resume"]);

  const activeRegistry = path.join(root, ".senti", ".active-flow");
  const registryText = fs.existsSync(activeRegistry) ? fs.readFileSync(activeRegistry, "utf8") : "";
  assert.doesNotMatch(registryText, /002-finalized|003-stale/);

  const statusMismatch = runSentiFailure(root, [
    "flow",
    "get",
    "status",
    "--expect-run-id",
    "not-the-active-run",
  ]);
  assert.equal(statusMismatch.errors[0].code, "ACTIVE_FLOW_MISMATCH");

  const nextActionMismatch = runSentiFailure(root, [
    "flow",
    "get",
    "next-action",
    "--expect-run-id",
    "not-the-active-run",
  ]);
  assert.equal(nextActionMismatch.errors[0].code, "ACTIVE_FLOW_MISMATCH");

  const runMismatch = runSentiFailure(root, [
    "flow",
    "run",
    "review",
    "--phase",
    "draft",
    "--expect-run-id",
    "not-the-active-run",
  ]);
  assert.equal(runMismatch.errors[0].code, "ACTIVE_FLOW_MISMATCH");

  const context = runSenti(root, ["flow", "get", "resolve-context"]);
  assert.equal(context.data.activeFlow, "001-active");
  assert.equal(context.data.recoveryCandidates, undefined);
});

test("R7: worktree recovery candidate is selectable from its execution root", () => {
  const root = tmpRoot();
  initGit(root);
  const worktree = path.join(root, ".senti", "worktree", "feature-005-worktree");
  fs.mkdirSync(path.dirname(worktree), { recursive: true });
  git(root, ["worktree", "add", worktree, "-b", "feature/005-worktree"]);
  writeSpec(worktree, "005-worktree", flowState("005-worktree", {
    worktree: true,
    runId: "worktree-run",
  }));

  const selected = runSenti(root, ["flow", "resume", "--spec", "005-worktree"]);

  assert.equal(selected.data.selected.runId, "worktree-run");
  assert.equal(selected.data.selected.executionRoot, worktree);

  const mainStatus = runSenti(root, ["flow", "get", "status"]);
  assert.equal(mainStatus.data.active, false);
});

test("R8: recovery discovery reports candidate cap and truncation state", () => {
  const root = tmpRoot();
  initGit(root);
  for (let i = 1; i <= 205; i += 1) {
    const specId = `${String(i).padStart(3, "0")}-candidate`;
    writeSpec(root, specId, flowState(specId));
  }

  const result = runSenti(root, ["flow", "resume"]);

  assert.equal(result.data.discovery.limit, 200);
  assert.equal(result.data.discovery.truncated, true);
  assert.equal(result.data.recoveryCandidates.length, 200);
});

test("R8: recovery discovery excludes branch prefixes outside traversal scope", () => {
  const root = tmpRoot();
  initGit(root);
  addBranchOnlyCandidate(root, "250-feature-branch", "feature/250-feature-branch");
  addBranchOnlyCandidate(root, "251-topic-branch", "topic/251-topic-branch");

  const result = runSenti(root, ["flow", "resume"]);
  const specs = new Set(result.data.recoveryCandidates.map((candidate) => candidate.specId));

  assert.ok(specs.has("250-feature-branch"));
  assert.equal(specs.has("251-topic-branch"), false);
});
