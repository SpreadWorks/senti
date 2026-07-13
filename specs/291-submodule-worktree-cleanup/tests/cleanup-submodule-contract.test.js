// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { runTeardown } from "../../../src/flow/lib/run-finalize-cleanup.js";

const SPEC_ID = "291-submodule-worktree-cleanup";

function makeFlowState() {
  return {
    spec: `specs/${SPEC_ID}/spec.json`,
    runId: `run-${SPEC_ID}`,
    baseBranch: "main",
    featureBranch: "feature/submodule-cleanup",
    worktree: true,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    plugins: { flowCommandHooks: [] },
  };
}

function writeFakeGit(binDir) {
  const gitPath = path.join(binDir, "git");
  fs.writeFileSync(gitPath, `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2);
const logPath = process.env.FAKE_GIT_LOG;

let rest = args.slice();
let cTarget = null;
if (rest[0] === "-C") {
  cTarget = rest[1];
  rest = rest.slice(2);
}
if (logPath) fs.appendFileSync(logPath, JSON.stringify({ args, cwd: process.cwd(), cTarget, rest }) + "\\n");
const scenario = process.env.FAKE_GIT_SCENARIO || "clean_submodule";

function exitOk(stdout = "") {
  if (stdout) process.stdout.write(stdout);
  process.exit(0);
}
function exitFail(stderr = "") {
  if (stderr) process.stderr.write(stderr);
  process.exit(1);
}
function removeTarget(target) {
  fs.rmSync(target, { recursive: true, force: true });
}
function lastArg() {
  return rest[rest.length - 1];
}
function boundedText(text) {
  return text;
}

if (rest[0] === "add" || rest[0] === "commit") exitOk();
if (rest[0] === "worktree" && rest[1] === "list") exitOk("");
if (rest[0] === "branch" && rest[1] === "--list") exitOk("");
if (rest[0] === "branch" && rest[1] === "-D") exitOk();

if (rest[0] === "status" && rest.includes("--porcelain")) {
  const inSubmodule = cTarget && cTarget.endsWith(path.join("vendor", "sub"));
  const lateDirtySubmodule = cTarget && cTarget.endsWith(path.join("vendor", "sub-59"));
  if (inSubmodule && scenario === "dirty_submodule") exitOk("?? sub-dirty.txt\\n");
  if (lateDirtySubmodule && scenario === "dirty_late_submodule") exitOk("?? late-sub-dirty.txt\\n");
  if (inSubmodule && scenario === "dirty_many") exitOk(Array.from({ length: 80 }, (_, i) => "?? sub-dirty-" + i + ".txt").join("\\n") + "\\n");
  if (inSubmodule && scenario === "status_fail_submodule") exitFail("fatal: submodule status failed\\n");
  if (inSubmodule && scenario === "status_fail_submodule_many") exitFail("fatal: submodule status failed " + "s".repeat(5000) + "\\n");
  if (scenario === "dirty_root") exitOk("?? root-dirty.txt\\n");
  if (scenario === "dirty_many") exitOk(Array.from({ length: 80 }, (_, i) => "?? root-dirty-" + i + ".txt").join("\\n") + "\\n");
  if (scenario === "status_fail") exitFail("fatal: root status failed\\n");
  if (scenario === "status_fail_many") exitFail("fatal: root status failed " + "x".repeat(5000) + "\\n");
  exitOk("");
}

if (rest[0] === "submodule") {
  if (scenario === "status_fail") exitFail("fatal: submodule status failed\\n");
  if (scenario === "status_fail_many") exitFail("fatal: submodule status failed " + "y".repeat(5000) + "\\n");
  if (rest.includes("foreach")) {
    const runsStatus = rest.join(" ").includes("status") && rest.join(" ").includes("--porcelain");
    if (scenario === "dirty_submodule" && runsStatus) exitOk("Entering 'vendor/sub'\\n?? sub-dirty.txt\\n");
    if (scenario === "dirty_many" && runsStatus) {
      exitOk("Entering 'vendor/sub'\\n" + Array.from({ length: 80 }, (_, i) => "?? sub-dirty-" + i + ".txt").join("\\n") + "\\n");
    }
    if (scenario === "status_fail_submodule" && runsStatus) exitFail("fatal: submodule status failed\\n");
    if (scenario === "status_fail_submodule_many" && runsStatus) exitFail("fatal: submodule status failed " + "s".repeat(5000) + "\\n");
    exitOk("Entering 'vendor/sub'\\n");
  }
  if (scenario === "dirty_late_submodule" && rest.includes("status")) {
    exitOk(Array.from({ length: 60 }, (_, i) => " 0123456789abcdef vendor/sub-" + i + " (heads/main)").join("\\n") + "\\n");
  }
  if (rest.includes("status")) exitOk(" 0123456789abcdef vendor/sub (heads/main)\\n");
  exitOk("");
}

if (rest[0] === "worktree" && rest[1] === "remove") {
  const force = rest.includes("--force");
  const target = lastArg();
  if (!force && scenario === "non_submodule_fail") {
    exitFail("fatal: worktree contains untracked files\\n");
  }
  if (!force) {
    exitFail("fatal: working trees containing submodules cannot be moved or removed\\n");
  }
  if (scenario === "force_fail") {
    exitFail("fatal: force remove failed\\n");
  }
  if (scenario === "force_fail_many") {
    exitFail("fatal: force remove failed " + "z".repeat(5000) + "\\n");
  }
  removeTarget(target);
  exitOk(boundedText(""));
}

exitOk("");
`, "utf8");
  fs.chmodSync(gitPath, 0o755);
}

function readCommands(logPath) {
  return fs.readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line).args);
}

function readCommandEntries(logPath) {
  return fs.readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function runCleanupScenario(scenario) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `senti-${SPEC_ID}-`));
  const mainRoot = path.join(tmp, "main");
  const worktreeRoot = path.join(tmp, "worktree");
  const binDir = path.join(tmp, "bin");
  const logPath = path.join(tmp, "git.jsonl");
  fs.mkdirSync(mainRoot, { recursive: true });
  fs.mkdirSync(worktreeRoot, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  writeFakeGit(binDir);

  const specDir = path.join(mainRoot, "specs", SPEC_ID);
  fs.mkdirSync(specDir, { recursive: true });
  const state = makeFlowState();
  const mainFlowManager = new FlowManager({ root: mainRoot, mainRoot, inWorktree: false, specId: SPEC_ID });
  mainFlowManager.create(state);
  mainFlowManager.addActiveFlow(SPEC_ID, "worktree");
  fs.writeFileSync(path.join(specDir, "report.json"), JSON.stringify({ text: "Final report text" }, null, 2));

  const previousPath = process.env.PATH;
  const previousScenario = process.env.FAKE_GIT_SCENARIO;
  const previousLog = process.env.FAKE_GIT_LOG;
  process.env.PATH = `${binDir}${path.delimiter}${previousPath}`;
  process.env.FAKE_GIT_SCENARIO = scenario;
  process.env.FAKE_GIT_LOG = logPath;
  try {
    const flowManager = new FlowManager({ root: worktreeRoot, mainRoot, inWorktree: true, specId: SPEC_ID });
    const result = await runTeardown(
      {
        flowManager,
        flowState: state,
        root: worktreeRoot,
        mainRoot,
        specId: SPEC_ID,
      },
      {
        worktreePath: worktreeRoot,
        mainRepoPath: mainRoot,
        reportRoot: mainRoot,
        specId: SPEC_ID,
      },
    );
    const lastFinalizedPath = path.join(mainRoot, ".senti", "last-finalized-spec");
    return {
      result,
      commands: readCommands(logPath),
      commandEntries: readCommandEntries(logPath),
      worktreeExists: fs.existsSync(worktreeRoot),
      worktreeRoot,
      lastFinalized: fs.existsSync(lastFinalizedPath) ? fs.readFileSync(lastFinalizedPath, "utf8").trim() : null,
      activeFlows: mainFlowManager.loadActiveFlows(),
      reportText: result.data?.report?.text ?? null,
    };
  } finally {
    process.env.PATH = previousPath;
    if (previousScenario === undefined) delete process.env.FAKE_GIT_SCENARIO;
    else process.env.FAKE_GIT_SCENARIO = previousScenario;
    if (previousLog === undefined) delete process.env.FAKE_GIT_LOG;
    else process.env.FAKE_GIT_LOG = previousLog;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function commandText(commands) {
  return commands.map((args) => args.join(" ")).join("\n");
}

function countCommands(commands, pattern) {
  return commands.filter((args) => pattern.test(args.join(" "))).length;
}

function commandTargetsWorktree(entry, worktreeRoot) {
  return entry.cTarget === worktreeRoot || entry.cwd === worktreeRoot;
}

function errorCode(result) {
  return result.errors?.[0]?.code;
}

function errorText(result) {
  return (result.errors || [])
    .flatMap((entry) => entry.messages || [])
    .join("\n");
}

test("R1: normal worktree remove is attempted before submodule force retry", async () => {
  const { result, commands } = await runCleanupScenario("clean_submodule");
  const text = commandText(commands);
  const normalIndex = text.indexOf("worktree remove ");
  const forceIndex = text.indexOf("worktree remove --force ");

  assert.equal(result.ok, true);
  assert.ok(normalIndex >= 0, "normal worktree remove must run");
  assert.ok(forceIndex >= 0, "force retry must run after submodule rejection");
  assert.ok(normalIndex < forceIndex, "normal remove must precede force retry");
});

test("R2: submodule cleanup inspects root and submodule cleanliness", async () => {
  const { commands, commandEntries, worktreeRoot } = await runCleanupScenario("clean_submodule");
  const text = commandText(commands);

  assert.match(text, /status --porcelain/, "root status must be inspected");
  assert.match(text, /submodule status|submodule foreach/, "initialized submodule list or foreach must run");
  assert.match(text, /submodule foreach|submodule status[\s\S]*status --porcelain/, "initialized submodule cleanliness must be inspected");
  assert.ok(
    commandEntries.some((entry) => commandTargetsWorktree(entry, worktreeRoot) && entry.rest.join(" ").includes("status --porcelain")),
    "root status inspection must target the cleanup worktree root",
  );
  assert.ok(
    commandEntries.some((entry) => commandTargetsWorktree(entry, worktreeRoot) && entry.rest.join(" ").includes("submodule")),
    "submodule inspection must be scoped to the cleanup worktree",
  );
});

test("R3: clean submodule force retry succeeds before branch deletion", async () => {
  const { result, commands, worktreeExists } = await runCleanupScenario("clean_submodule");
  const text = commandText(commands);
  const forceIndex = text.indexOf("worktree remove --force ");
  const branchIndex = text.indexOf("branch -D feature/submodule-cleanup");

  assert.equal(result.ok, true);
  assert.equal(worktreeExists, false);
  assert.ok(forceIndex >= 0);
  assert.equal(countCommands(commands, /worktree remove --force/), 1, "clean submodule path must force-retry exactly once");
  assert.ok(branchIndex > forceIndex, "branch deletion must happen after successful force remove");
});

test("R4: dirty root or submodule returns SUBMODULE_WORKTREE_DIRTY and preserves resources", async () => {
  const rootDirty = await runCleanupScenario("dirty_root");
  const submoduleDirty = await runCleanupScenario("dirty_submodule");
  const lateSubmoduleDirty = await runCleanupScenario("dirty_late_submodule");

  assert.equal(rootDirty.result.ok, false);
  assert.equal(errorCode(rootDirty.result), "SUBMODULE_WORKTREE_DIRTY");
  assert.equal(rootDirty.worktreeExists, true);
  assert.ok(rootDirty.result.data?.dirtyRootFiles?.length > 0);
  assert.match(errorText(rootDirty.result), /recover|retry|clean|commit|stash/i, "dirty root halt must include recovery guidance");
  assert.ok(rootDirty.result.data?.recoveryOptions?.length > 0, "dirty root halt must include recovery options");
  assert.ok(
    !commandText(rootDirty.commands).includes("branch -D feature/submodule-cleanup"),
    "dirty root halt must preserve the feature branch",
  );

  assert.equal(submoduleDirty.result.ok, false);
  assert.equal(errorCode(submoduleDirty.result), "SUBMODULE_WORKTREE_DIRTY");
  assert.equal(submoduleDirty.worktreeExists, true);
  assert.ok(submoduleDirty.result.data?.dirtySubmodules?.length > 0);
  assert.match(errorText(submoduleDirty.result), /recover|retry|clean|commit|stash/i, "dirty submodule halt must include recovery guidance");
  assert.ok(submoduleDirty.result.data?.recoveryOptions?.length > 0, "dirty submodule halt must include recovery options");
  assert.ok(
    !commandText(submoduleDirty.commands).includes("branch -D feature/submodule-cleanup"),
    "dirty submodule halt must preserve the feature branch",
  );

  assert.equal(lateSubmoduleDirty.result.ok, false);
  assert.equal(errorCode(lateSubmoduleDirty.result), "SUBMODULE_WORKTREE_DIRTY");
  assert.ok(JSON.stringify(lateSubmoduleDirty.result.data?.dirtySubmodules).includes("vendor/sub-59"));
  assert.ok(
    !commandText(lateSubmoduleDirty.commands).includes("worktree remove --force"),
    "dirty submodules beyond diagnostic limit must still prevent force removal",
  );
});

test("R5: non-submodule remove failure retains WORKTREE_REMOVE_FAILED", async () => {
  const { result, commands, worktreeExists } = await runCleanupScenario("non_submodule_fail");
  const cleanSubmodule = await runCleanupScenario("clean_submodule");

  assert.equal(result.ok, false);
  assert.equal(errorCode(result), "WORKTREE_REMOVE_FAILED");
  assert.equal(worktreeExists, true);
  assert.match(errorText(result), /Resolve the dirty state|untracked|uncommitted/i, "generic remove failure must keep existing recovery guidance");
  assert.doesNotMatch(commandText(commands), /worktree remove --force/, "non-submodule failure must not force-remove");
  assert.notEqual(errorCode(cleanSubmodule.result), "WORKTREE_REMOVE_FAILED", "submodule clean path must no longer use generic remove failure");
});

test("R6: successful cleanup preserves side effects and teardown validation ordering", async () => {
  const { result, commands, lastFinalized, activeFlows, reportText } = await runCleanupScenario("clean_submodule");
  const text = commandText(commands);

  assert.equal(result.ok, true);
  assert.equal(reportText, "Final report text");
  assert.equal(lastFinalized, `specs/${SPEC_ID}/spec.json`);
  assert.deepEqual(activeFlows, [], "successful cleanup must clear the active-flow registry");
  assert.ok(text.includes("add -- specs/291-submodule-worktree-cleanup/flow.json"));
  assert.match(text, /commit -m chore: finalize 291-submodule-worktree-cleanup/);
  assert.ok(text.includes("branch -D feature/submodule-cleanup"));
  assert.match(text, /worktree list --porcelain/);
  assert.ok(text.includes("branch --list feature/submodule-cleanup"));
});

test("R7: status inspection failure returns SUBMODULE_WORKTREE_STATUS_FAILED and preserves resources", async () => {
  const { result, commands, worktreeExists } = await runCleanupScenario("status_fail");
  const submoduleStatus = await runCleanupScenario("status_fail_submodule");

  assert.equal(result.ok, false);
  assert.equal(errorCode(result), "SUBMODULE_WORKTREE_STATUS_FAILED");
  assert.equal(worktreeExists, true);
  assert.ok(result.data?.statusFailures?.length > 0);
  assert.match(errorText(result), /recover|retry|status|inspect|manual/i, "status failure halt must include recovery guidance");
  assert.ok(result.data?.recoveryOptions?.length > 0, "status failure halt must include recovery options");
  assert.doesNotMatch(commandText(commands), /worktree remove --force/, "status failure must not force-remove");
  assert.ok(
    !commandText(commands).includes("branch -D feature/submodule-cleanup"),
    "status failure halt must preserve the feature branch",
  );

  assert.equal(submoduleStatus.result.ok, false);
  assert.equal(errorCode(submoduleStatus.result), "SUBMODULE_WORKTREE_STATUS_FAILED");
  assert.equal(submoduleStatus.worktreeExists, true);
  assert.match(JSON.stringify(submoduleStatus.result.data?.statusFailures), /fatal: submodule status failed/);
  assert.ok(
    !commandText(submoduleStatus.commands).includes("branch -D feature/submodule-cleanup"),
    "submodule status failure must preserve the feature branch",
  );
});

test("R8: force retry failure returns SUBMODULE_WORKTREE_FORCE_REMOVE_FAILED before branch deletion", async () => {
  const { result, commands, worktreeExists } = await runCleanupScenario("force_fail");
  const text = commandText(commands);

  assert.equal(result.ok, false);
  assert.equal(errorCode(result), "SUBMODULE_WORKTREE_FORCE_REMOVE_FAILED");
  assert.equal(worktreeExists, true);
  assert.match(text, /worktree remove --force/);
  assert.equal(countCommands(commands, /worktree remove --force/), 1, "force failure path must force-retry exactly once");
  assert.ok(!text.includes("branch -D feature/submodule-cleanup"), "branch deletion must not run after force retry failure");
  const afterForce = text.slice(text.indexOf("worktree remove --force"));
  assert.ok(!afterForce.includes("worktree list --porcelain"), "teardown validation must not run after force retry failure");
  assert.ok(!afterForce.includes("branch --list feature/submodule-cleanup"), "branch validation must not run after force retry failure");
});

test("R9: submodule halt diagnostics are bounded and carry git error output", async () => {
  const { result: dirtyResult } = await runCleanupScenario("dirty_many");
  const { result: statusResult } = await runCleanupScenario("status_fail_many");
  const { result: submoduleStatusResult } = await runCleanupScenario("status_fail_submodule_many");
  const { result: forceResult } = await runCleanupScenario("force_fail_many");

  assert.equal(dirtyResult.data?.truncated, true);
  assert.ok((dirtyResult.data?.dirtyRootFiles?.length || 0) < 80, "dirty root diagnostics must be capped");
  assert.equal(statusResult.data?.truncated, true);
  assert.ok(JSON.stringify(statusResult.data?.statusFailures).length < 6000, "status failure diagnostics must be capped");
  assert.match(JSON.stringify(statusResult.data?.statusFailures), /fatal: root status failed|fatal: submodule status failed/);
  assert.equal(submoduleStatusResult.data?.truncated, true);
  assert.ok(JSON.stringify(submoduleStatusResult.data?.statusFailures).length < 6000, "submodule status diagnostics must be capped");
  assert.match(JSON.stringify(submoduleStatusResult.data?.statusFailures), /fatal: submodule status failed/);
  assert.equal(forceResult.data?.truncated, true);
  assert.ok(JSON.stringify(forceResult.data).length < 6000, "force failure diagnostics must be capped");
  assert.match(JSON.stringify(forceResult.data), /fatal: force remove failed/);
  assert.ok(JSON.stringify(dirtyResult.data?.dirtySubmodules || []).length < 6000, "dirty submodule diagnostics must be capped");
});
