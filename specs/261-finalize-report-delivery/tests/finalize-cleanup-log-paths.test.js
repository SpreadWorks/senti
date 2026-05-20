// spec: R4 R5 R7
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command } from "../../../src/lib/command.js";
import { Container, container as sharedContainer, initContainer } from "../../../src/lib/container.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { captureProcessStderr } from "./helpers/process-stream.js";

function makeFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-finalize-log-"));
  const mainRoot = path.join(tmp, "main");
  const worktreeRoot = path.join(tmp, "worktree");
  fs.mkdirSync(mainRoot, { recursive: true });
  fs.mkdirSync(worktreeRoot, { recursive: true });
  return { tmp, mainRoot, worktreeRoot };
}

function optionValue(argv, name) {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function resolveAgentWorkDir(worktreeRoot, argv) {
  return path.resolve(worktreeRoot, optionValue(argv, "--agent-work-dir") || path.join(".sdd-forge", "agent-work"));
}

function makeContainer({ mainRoot, worktreeRoot, argv = [] }) {
  const container = new Container();
  const agentWorkDir = resolveAgentWorkDir(worktreeRoot, argv);
  container.register("config", {});
  container.register("root", worktreeRoot);
  container.register("paths", {
    root: worktreeRoot,
    agentWorkDir,
    logDir: path.join(agentWorkDir, "logs"),
  });
  container.register("mainRoot", mainRoot);
  container.register("inWorktree", true);
  return container;
}

function assertNoDeletedWorktreeLogWarning(stderr) {
  assert.doesNotMatch(stderr, /\[sdd-forge\] log write failed/);
  assert.doesNotMatch(stderr, /ENOENT[\s\S]*worktree[\s\S]*agent-work/);
}

function runGit(cwd, args) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function makeGitWorktreeFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-config-log-"));
  const mainRoot = path.join(tmp, "main");
  const worktreeRoot = path.join(tmp, "worktree");
  fs.mkdirSync(mainRoot, { recursive: true });
  runGit(mainRoot, ["init"]);
  runGit(mainRoot, ["config", "user.email", "test@example.com"]);
  runGit(mainRoot, ["config", "user.name", "Test User"]);
  fs.mkdirSync(path.join(mainRoot, ".sdd-forge"), { recursive: true });
  fs.writeFileSync(path.join(mainRoot, "README.md"), "test\n");
  fs.writeFileSync(
    path.join(mainRoot, ".sdd-forge", "config.json"),
    JSON.stringify({
      lang: "en",
      type: "node-cli",
      docs: { languages: ["en"], defaultLanguage: "en" },
      logs: { enabled: true, dir: path.join(".sdd-forge", "logs") },
    }, null, 2),
  );
  runGit(mainRoot, ["add", "."]);
  runGit(mainRoot, ["commit", "-m", "initial"]);
  runGit(mainRoot, ["worktree", "add", "-b", "feature/finalize-report", worktreeRoot]);
  return { tmp, mainRoot, worktreeRoot };
}

async function runCleanupThatDeletesWorktree({ mainRoot, worktreeRoot, argv = [] }) {
  class Cmd extends Command {
    static outputMode = "envelope";
    execute() {
      fs.rmSync(worktreeRoot, { recursive: true, force: true });
      return { status: "done" };
    }
  }

  const stdout = [];
  const stderr = [];
  await dispatch({
    container: makeContainer({ mainRoot, worktreeRoot, argv }),
    entry: {
      command: async () => ({ default: Cmd }),
      args: { options: ["--agent-work-dir", "--log-file"] },
      requiresFlow: false,
    },
    argv,
    envelopeType: "run",
    envelopeKey: "finalize-cleanup",
    runtimeLog: true,
    stdout: (s) => stdout.push(s),
    stderr: (s) => stderr.push(s),
    buildHookCtx: () => ({
      specId: "261-finalize-report-delivery",
      root: worktreeRoot,
      mainRoot,
      inWorktree: true,
      flowState: { worktree: true },
    }),
  });
  return { stdout: stdout.join(""), stderr: stderr.join("") };
}

describe("finalize-cleanup durable log path contract", () => {
  it("R4: relocates the default runtime log when --agent-work-dir is under the deleted worktree", async () => {
    const fixture = makeFixture();
    const relAgentWorkDir = path.join(".sdd-forge", "agent-work");
    try {
      const result = await runCleanupThatDeletesWorktree({
        ...fixture,
        argv: ["--agent-work-dir", relAgentWorkDir],
      });
      assert.equal(JSON.parse(result.stdout).ok, true);
      assertNoDeletedWorktreeLogWarning(result.stderr);
      assert.equal(fs.existsSync(fixture.worktreeRoot), false);

      const logDir = path.join(
        fixture.mainRoot,
        ".sdd-forge",
        "agent-work",
        "logs",
        "261-finalize-report-delivery",
      );
      assert.ok(fs.existsSync(logDir), "runtime log directory must survive under main repo");
      assert.ok(fs.readdirSync(logDir).some((file) => file.startsWith("finalize-cleanup-")));
    } finally {
      fs.rmSync(fixture.tmp, { recursive: true, force: true });
    }
  });

  it("R4: relocates a worktree-local --log-file to the same relative path under main repo", async () => {
    const fixture = makeFixture();
    const relLogFile = path.join(".sdd-forge", "agent-work", "logs", "finalize.log");
    try {
      const result = await runCleanupThatDeletesWorktree({
        ...fixture,
        argv: ["--log-file", relLogFile],
      });
      assert.equal(JSON.parse(result.stdout).ok, true);
      assert.equal(fs.existsSync(fixture.worktreeRoot), false);

      const mainLogFile = path.join(fixture.mainRoot, relLogFile);
      assert.ok(fs.existsSync(mainLogFile), "explicit runtime log file must survive under main repo");
      assert.match(fs.readFileSync(mainLogFile, "utf8"), /start flow run finalize-cleanup/);
      assert.match(fs.readFileSync(mainLogFile, "utf8"), /end flow run finalize-cleanup/);
    } finally {
      fs.rmSync(fixture.tmp, { recursive: true, force: true });
    }
  });

  it("R5: cleanup stderr contains no deleted-worktree log write warning", async () => {
    const fixture = makeFixture();
    try {
      const result = await runCleanupThatDeletesWorktree(fixture);
      assertNoDeletedWorktreeLogWarning(result.stderr);
    } finally {
      fs.rmSync(fixture.tmp, { recursive: true, force: true });
    }
  });

  it("R5: explicit worktree-local --log-file emits no deleted-worktree warning", async () => {
    const fixture = makeFixture();
    const relLogFile = path.join(".sdd-forge", "agent-work", "logs", "finalize.log");
    try {
      const result = await runCleanupThatDeletesWorktree({
        ...fixture,
        argv: ["--log-file", relLogFile],
      });
      assertNoDeletedWorktreeLogWarning(result.stderr);
    } finally {
      fs.rmSync(fixture.tmp, { recursive: true, force: true });
    }
  });

  it("R4/R5: relocates config.logs.dir before a deleted-worktree logger write", async () => {
    const fixture = makeGitWorktreeFixture();
    const savedEnv = { ...process.env };
    sharedContainer.reset();
    try {
      process.env.SDD_FORGE_WORK_ROOT = fixture.worktreeRoot;
      process.env.SDD_FORGE_SOURCE_ROOT = fixture.worktreeRoot;
      const stderr = await captureProcessStderr(async () => {
        initContainer({
          entryCommand: "flow run finalize-cleanup",
          finalizeCleanupDurablePaths: true,
        });
        fs.rmSync(fixture.worktreeRoot, { recursive: true, force: true });
        const logger = sharedContainer.get("logger");
        logger.event("after-cleanup", { requirement: "R5" });
        await logger.flush();
      });

      const mainLogDir = path.join(fixture.mainRoot, ".sdd-forge", "logs");
      assert.ok(fs.existsSync(mainLogDir), "config.logs.dir log directory must survive under main repo");
      assert.ok(fs.readdirSync(mainLogDir).some((file) => file.startsWith("sdd-forge-")));
      assertNoDeletedWorktreeLogWarning(stderr);
    } finally {
      sharedContainer.reset();
      process.env = savedEnv;
      fs.rmSync(fixture.tmp, { recursive: true, force: true });
    }
  });

  it("R7: includes a --agent-work-dir fixture under the worktree deleted by cleanup", async () => {
    const fixture = makeFixture();
    const relAgentWorkDir = path.join(".sdd-forge", "agent-work");
    try {
      const result = await runCleanupThatDeletesWorktree({
        ...fixture,
        argv: ["--agent-work-dir", relAgentWorkDir],
      });
      assert.equal(JSON.parse(result.stdout).ok, true);
      assert.equal(fs.existsSync(fixture.worktreeRoot), false);

      const logDir = path.join(
        fixture.mainRoot,
        relAgentWorkDir,
        "logs",
        "261-finalize-report-delivery",
      );
      assert.ok(fs.existsSync(logDir), "R7 fixture must prove the deleted worktree agent-work-dir case");
    } finally {
      fs.rmSync(fixture.tmp, { recursive: true, force: true });
    }
  });
});
