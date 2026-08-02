import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  WorktreeFlowIdentity,
  WorktreeFlowIssueTransition,
} from "../../src/lib/worktree-flow-binding.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = path.join(repoRoot, "src/senti.js");
const fixtureRoot = path.join(repoRoot, ".tmp", "flow-park-resume");
const diagnosticPath = path.join(repoRoot, ".tmp", "park-flow-diagnostic-v2.jsonl");
const roots = [];

class ParkFlowDiagnosticTrace {
  constructor(filePath) {
    if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
      throw new Error("park flow diagnostic trace requires an absolute path");
    }
    this.filePath = filePath;
    this.sequence = 0;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "");
    this.#append("trace", "module", { status: "started" });
  }

  commandStart(step, cwd, argv) {
    this.#append("command-start", step, { cwd, argv: [...argv] });
  }

  commandResult(step, cwd, argv, result) {
    this.#append("command-result", step, {
      cwd,
      argv: [...argv],
      status: result.status,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error == null ? null : String(result.error.stack || result.error.message || result.error),
    });
  }

  expectation(step, summary) {
    this.#append("expectation", step, { summary });
  }

  hook(step, status, error = null) {
    this.#append("hook", step, {
      status,
      error: error == null ? null : String(error.stack || error.message || error),
    });
  }

  #append(kind, step, data) {
    this.sequence += 1;
    fs.appendFileSync(this.filePath, `${JSON.stringify({
      sequence: this.sequence,
      kind,
      step,
      ...data,
    })}\n`);
  }
}

const diagnostic = new ParkFlowDiagnosticTrace(diagnosticPath);

function git(root, args) {
  const step = `git:${args.join(" ")}`;
  const argv = ["git", "-C", root, ...args];
  diagnostic.commandStart(step, root, argv);
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  diagnostic.commandResult(step, root, argv, result);
  diagnostic.expectation(step, "git child process starts without a spawn error");
  assert.equal(
    result.error,
    undefined,
    result.error?.stack || result.error?.message || String(result.error),
  );
  diagnostic.expectation(step, "git command exits with status 0");
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createProject() {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(fixtureRoot, "project-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senti", "config.json"), JSON.stringify({
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
  }, null, 2));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    name: "flow-park-resume-fixture",
    version: "0.0.0",
    type: "module",
  }, null, 2));
  fs.writeFileSync(path.join(root, ".gitignore"), ".senti/*\n!.senti/config.json\n");
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test User"]);
  git(root, ["add", ".senti/config.json", ".gitignore", "package.json"]);
  git(root, ["commit", "-m", "fixture"]);
  return root;
}

function runSenti(step, root, args) {
  const argv = ["node", cliPath, ...args];
  diagnostic.commandStart(step, root, argv);
  const result = spawnSync("node", [cliPath, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
  diagnostic.commandResult(step, root, argv, result);
  diagnostic.expectation(step, "senti child process starts without a spawn error");
  assert.equal(
    result.error,
    undefined,
    result.error?.stack || result.error?.message || String(result.error),
  );
  const stdout = result.stdout.trim();
  return {
    ...result,
    diagnosticStep: step,
    envelope: stdout.startsWith("{") ? JSON.parse(stdout) : null,
  };
}

function expectSuccess(result) {
  diagnostic.expectation(result.diagnosticStep, "CLI exits with status 0");
  assert.equal(result.status, 0, result.stderr || result.stdout);
  diagnostic.expectation(result.diagnosticStep, "JSON envelope has ok=true");
  assert.equal(result.envelope?.ok, true, result.stderr || result.stdout);
  return result.envelope.data;
}

function prepareWorktree(root, issue, title) {
  const initArgs = ["flow", "set", "init", "--request", `recover ${title}`];
  if (issue != null) initArgs.push("--issue", String(issue));
  const initialized = expectSuccess(runSenti(`prepare:${title}:init`, root, initArgs));
  const prepared = expectSuccess(runSenti(`prepare:${title}:worktree`, root, [
    "flow", "prepare", "--title", title, "--base", "main", "--worktree",
    "--run-id", initialized.runId,
  ]));
  return {
    ...prepared,
    root,
    issue,
    specId: prepared.specId,
  };
}

function targetArgs(flow) {
  return [
    "--expect-run-id", flow.runId,
    "--expect-spec", flow.specId,
    ...(flow.issue == null
      ? ["--expect-no-issue"]
      : ["--expect-issue", String(flow.issue)]),
  ];
}

function registryPath(root) {
  return path.join(root, ".senti", ".active-flow");
}

function snapshotFiles(files) {
  return Object.fromEntries(files.map((file) => [
    file,
    fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null,
  ]));
}

function authorityFiles(flow) {
  return [
    path.join(flow.worktreePath, ".senti", "flow-identity.json"),
    path.join(flow.root, "specs", flow.specId, "flow.json"),
    path.join(flow.root, "specs", flow.specId, "spec.json"),
  ];
}

function gitSnapshot(root) {
  return {
    head: git(root, ["rev-parse", "HEAD"]),
    refs: git(root, ["for-each-ref", "--format=%(refname):%(objectname)", "refs/heads"]),
    worktrees: git(root, ["worktree", "list", "--porcelain"]),
  };
}

afterEach(() => {
  diagnostic.hook("afterEach", "started");
  try {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
    diagnostic.hook("afterEach", "completed");
  } catch (error) {
    diagnostic.hook("afterEach", "failed", error);
    throw error;
  }
});

describe("flow park and exact parked resume", () => {
  it("parks one concurrent worktree and resumes only from the receipt execution root", () => {
    const root = createProject();
    const target = prepareWorktree(root, 453, "park-target");
    const other = prepareWorktree(root, 454, "park-other");
    const protectedFiles = [...authorityFiles(target), ...authorityFiles(other)];
    const filesBefore = snapshotFiles(protectedFiles);
    const gitBefore = gitSnapshot(root);

    const parked = expectSuccess(runSenti("concurrent:park-target", target.worktreePath, [
      "flow", "park", ...targetArgs(target),
    ]));

    diagnostic.expectation("concurrent:park-target", "active registry retains only the unrelated worktree pointer");
    assert.deepEqual(JSON.parse(fs.readFileSync(registryPath(root), "utf8")), [
      { specId: other.specId, mode: "worktree" },
    ]);
    diagnostic.expectation("concurrent:park-target", "binding, flow state, and spec bytes remain unchanged for both worktrees");
    assert.deepEqual(snapshotFiles(protectedFiles), filesBefore);
    diagnostic.expectation("concurrent:park-target", "Git HEAD, branch refs, and worktree inventory remain unchanged");
    assert.deepEqual(gitSnapshot(root), gitBefore);
    diagnostic.expectation("concurrent:park-target", "park receipt contains exact identity, canonical execution root, and argv array");
    assert.deepEqual(parked, {
      parked: true,
      changed: true,
      identity: { runId: target.runId, specId: target.specId, issue: 453 },
      mode: "worktree",
      executionRoot: fs.realpathSync(target.worktreePath),
      resume: {
        executionRoot: fs.realpathSync(target.worktreePath),
        argv: ["flow", "resume", "--parked", ...targetArgs(target)],
      },
    });

    const registryBeforeWrongRoot = fs.readFileSync(registryPath(root));
    const wrongRoot = runSenti("concurrent:resume-wrong-root", root, parked.resume.argv);
    diagnostic.expectation("concurrent:resume-wrong-root", "resume from the main root exits non-zero");
    assert.notEqual(wrongRoot.status, 0);
    diagnostic.expectation("concurrent:resume-wrong-root", "wrong-root resume reports FLOW_PARK_MODE_UNSUPPORTED");
    assert.equal(wrongRoot.envelope?.errors?.[0]?.code, "FLOW_PARK_MODE_UNSUPPORTED");
    diagnostic.expectation("concurrent:resume-wrong-root", "wrong-root resume leaves active registry bytes unchanged");
    assert.deepEqual(fs.readFileSync(registryPath(root)), registryBeforeWrongRoot);

    const resumed = expectSuccess(runSenti(
      "concurrent:resume-exact",
      parked.resume.executionRoot,
      parked.resume.argv,
    ));
    diagnostic.expectation("concurrent:resume-exact", "resume receipt reports resumed=true");
    assert.equal(resumed.resumed, true);
    diagnostic.expectation("concurrent:resume-exact", "first exact resume reports changed=true");
    assert.equal(resumed.changed, true);
    diagnostic.expectation("concurrent:resume-exact", "active registry contains the unrelated and restored worktree pointers");
    assert.deepEqual(JSON.parse(fs.readFileSync(registryPath(root), "utf8")), [
      { specId: other.specId, mode: "worktree" },
      { specId: target.specId, mode: "worktree" },
    ]);
    const registryAfterResume = fs.readFileSync(registryPath(root));
    const retry = expectSuccess(runSenti(
      "concurrent:resume-idempotent-retry",
      parked.resume.executionRoot,
      parked.resume.argv,
    ));
    diagnostic.expectation("concurrent:resume-idempotent-retry", "retry receipt reports resumed=true");
    assert.equal(retry.resumed, true);
    diagnostic.expectation("concurrent:resume-idempotent-retry", "exact retry reports changed=false");
    assert.equal(retry.changed, false);
    diagnostic.expectation("concurrent:resume-idempotent-retry", "exact retry leaves registry bytes unchanged");
    assert.deepEqual(fs.readFileSync(registryPath(root)), registryAfterResume);
    diagnostic.expectation("concurrent:resume-idempotent-retry", "all non-pointer authority bytes remain unchanged");
    assert.deepEqual(snapshotFiles(protectedFiles), filesBefore);
    diagnostic.expectation("concurrent:resume-idempotent-retry", "all Git authority remains unchanged");
    assert.deepEqual(gitSnapshot(root), gitBefore);
  });

  it("requires the complete exact identity and retains [] when parking the last no-Issue flow", () => {
    const root = createProject();
    const flow = prepareWorktree(root, null, "park-no-issue");
    const files = authorityFiles(flow);
    const filesBefore = snapshotFiles(files);

    const pendingPath = path.join(flow.worktreePath, ".senti", "flow-identity.issue-transaction.json");
    const originalIdentity = new WorktreeFlowIdentity({
      runId: flow.runId,
      issue: null,
      specId: flow.specId,
      worktreePath: fs.realpathSync(flow.worktreePath),
    });
    const pending = WorktreeFlowIssueTransition.create(
      originalIdentity,
      originalIdentity.withIssue(455),
    );
    fs.writeFileSync(pendingPath, `${JSON.stringify(pending.toJSON(), null, 2)}\n`);
    const pendingBefore = snapshotFiles([registryPath(root), pendingPath, ...files]);
    const parseError = runSenti("no-issue:resume-parked-parse-error", flow.worktreePath, [
      "flow", "resume", "--parked", "--expect-run-id",
    ]);
    diagnostic.expectation("no-issue:resume-parked-parse-error", "parked resume with a missing option value exits non-zero");
    assert.notEqual(parseError.status, 0);
    diagnostic.expectation("no-issue:resume-parked-parse-error", "missing parked resume option value reports ARGS_ERROR");
    assert.equal(parseError.envelope?.errors?.[0]?.code, "ARGS_ERROR");
    diagnostic.expectation("no-issue:resume-parked-parse-error", "parse error leaves registry, pending transition, binding, state, and spec bytes unchanged");
    assert.deepEqual(snapshotFiles([registryPath(root), pendingPath, ...files]), pendingBefore);

    const unsettled = runSenti("no-issue:park-unsettled-transition", flow.worktreePath, [
      "flow", "park", ...targetArgs(flow),
    ]);
    diagnostic.expectation("no-issue:park-unsettled-transition", "park with a pending identity transition exits non-zero");
    assert.notEqual(unsettled.status, 0);
    diagnostic.expectation("no-issue:park-unsettled-transition", "pending transition reports FLOW_PARK_IDENTITY_UNSETTLED");
    assert.equal(unsettled.envelope?.errors?.[0]?.code, "FLOW_PARK_IDENTITY_UNSETTLED");
    diagnostic.expectation("no-issue:park-unsettled-transition", "pending transition, registry, binding, and state bytes remain unchanged");
    assert.deepEqual(snapshotFiles([registryPath(root), pendingPath, ...files]), pendingBefore);
    fs.rmSync(pendingPath);

    for (const [name, incomplete] of [
      ["missing-run-id", ["--expect-spec", flow.specId, "--expect-no-issue"]],
      ["missing-spec", ["--expect-run-id", flow.runId, "--expect-no-issue"]],
      ["missing-issue-identity", ["--expect-run-id", flow.runId, "--expect-spec", flow.specId]],
    ]) {
      const step = `no-issue:park-incomplete:${name}`;
      const before = snapshotFiles([registryPath(root), ...files]);
      const result = runSenti(step, flow.worktreePath, ["flow", "park", ...incomplete]);
      diagnostic.expectation(step, "park with an incomplete exact identity exits non-zero");
      assert.notEqual(result.status, 0);
      diagnostic.expectation(step, "incomplete exact identity reports FLOW_PARK_TARGET_REQUIRED");
      assert.equal(result.envelope?.errors?.[0]?.code, "FLOW_PARK_TARGET_REQUIRED");
      diagnostic.expectation(step, "incomplete identity leaves registry, binding, and state bytes unchanged");
      assert.deepEqual(snapshotFiles([registryPath(root), ...files]), before);
    }

    const mismatchedBefore = snapshotFiles([registryPath(root), ...files]);
    const mismatch = runSenti("no-issue:park-mismatched-run", flow.worktreePath, [
      "flow", "park",
      "--expect-run-id", "foreign-run",
      "--expect-spec", flow.specId,
      "--expect-no-issue",
    ]);
    diagnostic.expectation("no-issue:park-mismatched-run", "park with a mismatched runId exits non-zero");
    assert.notEqual(mismatch.status, 0);
    diagnostic.expectation("no-issue:park-mismatched-run", "mismatched runId reports FLOW_PARK_IDENTITY_MISMATCH");
    assert.equal(mismatch.envelope?.errors?.[0]?.code, "FLOW_PARK_IDENTITY_MISMATCH");
    diagnostic.expectation("no-issue:park-mismatched-run", "mismatched identity leaves registry, binding, and state bytes unchanged");
    assert.deepEqual(snapshotFiles([registryPath(root), ...files]), mismatchedBefore);

    const parked = expectSuccess(runSenti("no-issue:park-last-pointer", flow.worktreePath, [
      "flow", "park", ...targetArgs(flow),
    ]));
    diagnostic.expectation("no-issue:park-last-pointer", "last pointer authority contains durable [] bytes");
    assert.equal(fs.readFileSync(registryPath(root), "utf8"), "[]\n");
    diagnostic.expectation("no-issue:park-last-pointer", "no-Issue binding, flow state, and spec bytes remain unchanged");
    assert.deepEqual(snapshotFiles(files), filesBefore);
    diagnostic.expectation("no-issue:park-last-pointer", "receipt argv preserves exact no-Issue identity guards");
    assert.deepEqual(parked.resume.argv, [
      "flow", "resume", "--parked",
      "--expect-run-id", flow.runId,
      "--expect-spec", flow.specId,
      "--expect-no-issue",
    ]);
  });
});
