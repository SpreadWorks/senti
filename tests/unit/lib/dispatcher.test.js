import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Container } from "../../../src/lib/container.js";
import { Command } from "../../../src/lib/command.js";
import { dispatch } from "../../../src/lib/dispatcher.js";

describe("dispatcher (unified runner)", () => {
  let container;
  beforeEach(() => {
    container = new Container();
    container.register("config", {});
    container.register("root", "/tmp/root");
  });

  describe("argument parsing (R6)", () => {
    it("parses flags and options from argv into input object before calling command", async () => {
      let captured;
      class Cmd extends Command {
        static outputMode = "raw";
        execute(ctx) {
          captured = ctx;
        }
      }
      const entry = {
        command: async () => ({ default: Cmd }),
        args: { flags: ["--dry-run"], options: ["--mode"] },
      };
      await dispatch({ container, entry, argv: ["--dry-run", "--mode", "select"] });
      assert.equal(captured.dryRun, true);
      assert.equal(captured.mode, "select");
    });

    it("parses the no-Issue expectation as a flag before target value options", async () => {
      let captured;
      class Cmd extends Command {
        static outputMode = "raw";
        execute(ctx) {
          captured = ctx;
        }
      }
      const entry = {
        command: async () => ({ default: Cmd }),
        args: {
          flags: ["--expect-no-issue"],
          options: ["--expect-run-id"],
        },
      };

      await dispatch({
        container,
        entry,
        argv: ["--expect-no-issue", "--expect-run-id", "run-440"],
      });

      assert.equal(captured.expectNoIssue, true);
      assert.equal(captured.expectRunId, "run-440");
    });

    it("parses options with optional values before calling command", async () => {
      const captured = [];
      class Cmd extends Command {
        static outputMode = "raw";
        execute(ctx) {
          captured.push(ctx);
        }
      }
      const entry = {
        command: async () => ({ default: Cmd }),
        args: { flags: ["--dry-run"], optionalOptions: ["--reset"] },
      };
      await dispatch({ container, entry, argv: ["--reset", "--dry-run"] });
      await dispatch({ container, entry, argv: ["--reset", "modules"] });
      assert.equal(captured[0].reset, true);
      assert.equal(captured[0].dryRun, true);
      assert.equal(captured[1].reset, "modules");
    });
  });

  describe("lifecycle hooks (R4)", () => {
    it("runs pre → execute → post in order on success", async () => {
      const calls = [];
      class Cmd extends Command {
        static outputMode = "raw";
        execute() {
          calls.push("execute");
          return { ok: true };
        }
      }
      const entry = {
        command: async () => ({ default: Cmd }),
        pre: () => calls.push("pre"),
        post: () => calls.push("post"),
        onError: () => calls.push("onError"),
      };
      await dispatch({ container, entry, argv: [] });
      assert.deepEqual(calls, ["pre", "execute", "post"]);
    });

    it("runs pre → execute → onError (not post) on failure", async () => {
      const calls = [];
      class Cmd extends Command {
        static outputMode = "raw";
        execute() {
          calls.push("execute");
          throw new Error("boom");
        }
      }
      const entry = {
        command: async () => ({ default: Cmd }),
        pre: () => calls.push("pre"),
        post: () => calls.push("post"),
        onError: () => calls.push("onError"),
      };
      await dispatch({ container, entry, argv: [] }).catch(() => {});
      assert.deepEqual(calls, ["pre", "execute", "onError"]);
    });

    it("does not invoke undeclared hooks", async () => {
      class Cmd extends Command {
        static outputMode = "raw";
        execute() {}
      }
      const entry = { command: async () => ({ default: Cmd }) };
      await assert.doesNotReject(() => dispatch({ container, entry, argv: [] }));
    });

    it("rejects a target mismatch before command loading or runtime metadata persistence", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-"));
      try {
        container.register("paths", {
          root: tmp,
          agentWorkDir: path.join(tmp, ".agent-work"),
        });
        let commandLoads = 0;
        let metadataWrites = 0;
        const out = [];
        await dispatch({
          container,
          entry: {
            command: async () => {
              commandLoads += 1;
              throw new Error("mismatched target must not load the command");
            },
            args: { options: ["--expect-run-id", "--expect-issue", "--expect-spec"] },
            runtimeLog: { stepId: "test-review" },
          },
          argv: [
            "--expect-run-id", "wrong-run",
            "--expect-issue", "430",
            "--expect-spec", "specs/demo/spec.json",
          ],
          envelopeType: "run",
          envelopeKey: "guarded",
          runtimeLog: true,
          stdout: (chunk) => out.push(chunk),
          setExitCode: () => {},
          buildHookCtx: () => ({
            specId: "specs/demo/spec.json",
            flowState: {
              runId: "run-430",
              issue: 430,
              spec: "specs/demo/spec.json",
              currentTaskId: null,
              steps: [{ id: "test-review", status: "in_progress" }],
              tasks: [],
            },
            flowManager: {
              setStepRuntimeLog() { metadataWrites += 1; },
            },
          }),
        });

        const envelope = JSON.parse(out.join(""));
        assert.equal(envelope.ok, false);
        assert.equal(envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
        assert.equal(commandLoads, 0);
        assert.equal(metadataWrites, 0);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("exits on unresolved or ambiguous targets before runtime logs, metadata, commands, or hooks", async () => {
      for (const [code, matchCount] of [
        ["FLOW_TARGET_NOT_FOUND", 0],
        ["FLOW_TARGET_AMBIGUOUS", 2],
      ]) {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-resolution-"));
        try {
          container.register("paths", {
            root: tmp,
            agentWorkDir: path.join(tmp, ".agent-work"),
          });
          let commandLoads = 0;
          let hookCalls = 0;
          let metadataWrites = 0;
          let exitCode = null;
          const out = [];
          const resolutionError = Object.assign(new Error(`target resolution failed: ${code}`), {
            code,
            data: { matchCount, expectedIssue: 443 },
          });

          await dispatch({
            container,
            entry: {
              command: async () => {
                commandLoads += 1;
                throw new Error("target resolution failure must not load the command");
              },
              args: { options: ["--expect-issue"] },
              runtimeLog: { stepId: "test-review" },
              pre() { hookCalls += 1; },
              post() { hookCalls += 1; },
              onError() { hookCalls += 1; },
            },
            argv: ["--expect-issue", "443"],
            envelopeType: "run",
            envelopeKey: "guarded-resolution",
            runtimeLog: true,
            stdout: (chunk) => out.push(chunk),
            setExitCode: (value) => { exitCode = value; },
            buildHookCtx: () => ({
              flowResolutionError: resolutionError,
              flowState: null,
              flowManager: {
                setStepRuntimeLog() { metadataWrites += 1; },
              },
            }),
          });

          const envelope = JSON.parse(out.join(""));
          assert.equal(envelope.errors[0].code, code);
          assert.equal(envelope.data.matchCount, matchCount);
          assert.equal(exitCode, 1);
          assert.equal(commandLoads, 0);
          assert.equal(hookCalls, 0);
          assert.equal(metadataWrites, 0);
          assert.deepEqual(fs.readdirSync(tmp), [], "runtime-log open must not create files or directories");
        } finally {
          fs.rmSync(tmp, { recursive: true, force: true });
        }
      }
    });

    it("rejects a preparing target before runtime logs, metadata, commands, or hooks", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-preparing-"));
      try {
        container.register("paths", {
          root: tmp,
          agentWorkDir: path.join(tmp, ".agent-work"),
        });
        const calls = { command: 0, pre: 0, post: 0, onError: 0, metadata: 0 };
        const out = [];
        await dispatch({
          container,
          entry: {
            requiresFlow: false,
            runtimeLog: { stepId: "prepare-spec" },
            args: { options: ["--expect-run-id", "--expect-issue", "--expect-spec"] },
            command: async () => {
              calls.command += 1;
              throw new Error("mismatched preparing target must not load the command");
            },
            pre() { calls.pre += 1; },
            post() { calls.post += 1; },
            onError() { calls.onError += 1; },
          },
          argv: ["--expect-run-id", "run-431", "--expect-issue", "999"],
          envelopeType: "run",
          envelopeKey: "auto-check",
          runtimeLog: true,
          stdout: (chunk) => out.push(chunk),
          setExitCode: () => {},
          buildHookCtx: () => ({
            flowState: null,
            preparingFlowState: { runId: "run-431", issue: 431, spec: null },
            flowManager: {
              setStepRuntimeLog() { calls.metadata += 1; },
            },
          }),
        });

        const envelope = JSON.parse(out.join(""));
        assert.equal(envelope.ok, false);
        assert.equal(envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
        assert.equal(envelope.data.runtimeLog.runId, "no-flow");
        assert.deepEqual(calls, { command: 0, pre: 0, post: 0, onError: 0, metadata: 0 });
        assert.deepEqual(fs.readdirSync(tmp), [], "preparing rejection must not open a runtime log");
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  describe("output modes (R5)", () => {
    it("envelope mode writes JSON to stdout", async () => {
      class Cmd extends Command {
        static outputMode = "envelope";
        execute() {
          return { data: 42 };
        }
      }
      const entry = {
        command: async () => ({ default: Cmd }),
        envelopeType: "test",
        envelopeKey: "demo",
      };
      const out = [];
      await dispatch({
        container,
        entry,
        argv: [],
        stdout: (s) => out.push(s),
      });
      const parsed = JSON.parse(out.join(""));
      assert.equal(parsed.ok, true);
      assert.equal(parsed.data.data, 42);
    });

    it("flow run envelope mode writes automatic runtime log without changing stdout envelope", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-"));
      try {
        container.register("paths", {
          root: tmp,
          agentWorkDir: path.join(tmp, ".agent-work"),
        });

        class Cmd extends Command {
          static outputMode = "envelope";
          execute() {
            process.stderr.write("human progress\n");
            return { data: 42 };
          }
        }

        const entry = {
          command: async () => ({ default: Cmd }),
          args: { options: [] },
          requiresFlow: false,
        };
        const out = [];
        await dispatch({
          container,
          entry,
          argv: [],
          envelopeType: "run",
          envelopeKey: "gate",
          runtimeLog: true,
          stdout: (s) => out.push(s),
          buildHookCtx: () => ({ specId: "demo-flow" }),
        });

        const parsed = JSON.parse(out.join(""));
        assert.equal(parsed.ok, true);
        assert.equal(parsed.data.data, 42);
        assert.doesNotMatch(out.join(""), /human progress/);

        const logText = fs.readFileSync(path.join(tmp, ".tmp", "logs", "demo-flow.log"), "utf8");
        assert.match(logText, /command="flow run gate"/);
        assert.match(logText, /\[stderr\] human progress/);
        assert.match(logText, /\[stdout\] \{/);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("flow run uses root .tmp/logs/<flowId>.log", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-"));
      try {
        const agentWorkDir = path.join(tmp, ".agent-work");
        container.register("paths", { root: tmp, agentWorkDir });

        class Cmd extends Command {
          static outputMode = "envelope";
          execute() {
            process.stderr.write("active flow progress\n");
            return { ok: true };
          }
        }

        const entry = {
          command: async () => ({ default: Cmd }),
          args: { options: ["--phase"] },
          requiresFlow: false,
        };
        const out = [];
        await dispatch({
          container,
          entry,
          argv: ["--phase", "draft"],
          envelopeType: "run",
          envelopeKey: "gate",
          runtimeLog: true,
          stdout: (s) => out.push(s),
          buildHookCtx: () => ({ specId: "demo-flow" }),
        });

        assert.equal(JSON.parse(out.join("")).ok, true);
        const logText = fs.readFileSync(path.join(tmp, ".tmp", "logs", "demo-flow.log"), "utf8");
        assert.match(logText, /sequence=1/);
        assert.match(logText, /\[stderr\] active flow progress/);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("persists runtime metadata in the resolved flow or task scope", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-"));
      try {
        container.register("paths", {
          root: tmp,
          agentWorkDir: path.join(tmp, ".agent-work"),
        });
        const calls = [];
        const flowManager = {
          setStepRuntimeLog(stepId, metadata, opts) {
            calls.push({ stepId, metadata, opts });
          },
        };
        class Cmd extends Command {
          static outputMode = "envelope";
          execute() { return { result: "ok" }; }
        }
        const activeTask = (activeStepId = null) => ({
          id: "T-1",
          steps: ["task-impl", "task-review", "task-gate"].map((id) => ({
            id,
            status: id === activeStepId ? "in_progress" : "pending",
          })),
        });
        const cases = [
          {
            stepId: "test-review",
            taskId: null,
            flowState: {
              currentTaskId: "T-1",
              steps: [{ id: "test-review", status: "in_progress" }],
              tasks: [activeTask()],
            },
          },
          ...["task-impl", "task-review", "task-gate"].map((stepId) => ({
            stepId,
            taskId: "T-1",
            flowState: {
              currentTaskId: "T-1",
              steps: [{ id: "implement", status: "in_progress" }],
              tasks: [activeTask(stepId)],
            },
          })),
        ];

        for (const testCase of cases) {
          const out = [];
          await dispatch({
            container,
            entry: {
              command: async () => ({ default: Cmd }),
              args: { options: [] },
              runtimeLog: { stepId: testCase.stepId },
            },
            argv: [],
            envelopeType: "run",
            envelopeKey: "scope-test",
            runtimeLog: true,
            stdout: (chunk) => out.push(chunk),
            setExitCode: () => {},
            buildHookCtx: () => ({
              specId: "specs/demo/spec.json",
              flowState: testCase.flowState,
              flowManager,
            }),
          });
          assert.equal(JSON.parse(out.join("")).ok, true);
          const call = calls.at(-1);
          assert.equal(call.stepId, testCase.stepId);
          assert.deepEqual(call.opts, {
            specId: "specs/demo/spec.json",
            taskId: testCase.taskId,
          });
        }
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("runtime log captures dispatcher stderr callback writes", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-"));
      try {
        container.register("paths", {
          root: tmp,
          agentWorkDir: path.join(tmp, ".agent-work"),
        });

        class Cmd extends Command {
          static outputMode = "raw";
          execute() {
            throw new Error("raw runtime failure");
          }
        }

        const entry = {
          command: async () => ({ default: Cmd }),
          args: { options: [] },
          requiresFlow: false,
        };
        const err = [];
        await dispatch({
          container,
          entry,
          argv: [],
          envelopeType: "run",
          envelopeKey: "gate",
          runtimeLog: true,
          stderr: (s) => err.push(s),
          setExitCode: () => {},
          buildHookCtx: () => ({ specId: "demo-flow" }),
        });

        assert.match(err.join(""), /raw runtime failure/);
        const logText = fs.readFileSync(path.join(tmp, ".tmp", "logs", "demo-flow.log"), "utf8");
        assert.match(logText, /\[stderr\] Error: raw runtime failure/);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("flow run without active flow uses root .tmp/logs/no-flow.log", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-"));
      try {
        const agentWorkDir = path.join(tmp, ".agent-work");
        container.register("paths", { root: tmp, agentWorkDir });

        class Cmd extends Command {
          static outputMode = "envelope";
          execute() {
            process.stderr.write("no flow progress\n");
            return { ok: true };
          }
        }

        const entry = {
          command: async () => ({ default: Cmd }),
          args: { options: ["--phase"] },
          requiresFlow: false,
        };
        const out = [];
        await dispatch({
          container,
          entry,
          argv: ["--phase", "draft"],
          envelopeType: "run",
          envelopeKey: "auto-check",
          runtimeLog: true,
          stdout: (s) => out.push(s),
        });

        assert.equal(JSON.parse(out.join("")).ok, true);
        const logText = fs.readFileSync(path.join(tmp, ".tmp", "logs", "no-flow.log"), "utf8");
        assert.match(logText, /command="flow run auto-check"/);
        assert.match(logText, /\[stderr\] no flow progress/);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("allows a strict no-Flow read to suppress the runtime log", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-"));
      try {
        const agentWorkDir = path.join(tmp, ".agent-work");
        container.register("paths", { root: tmp, agentWorkDir });

        class Cmd extends Command {
          static outputMode = "envelope";
          execute() {
            return { code: "NO_FLOW", yieldsControl: false };
          }
        }

        const entry = {
          command: async () => ({ default: Cmd }),
          args: { options: [] },
          requiresFlow: false,
          runtimeLog: { stepMetadata: false, writeWhenNoFlow: false },
        };
        const out = [];
        await dispatch({
          container,
          entry,
          argv: [],
          envelopeType: "get",
          envelopeKey: "status",
          runtimeLog: true,
          stdout: (s) => out.push(s),
          buildHookCtx: () => ({ flowState: null }),
        });

        assert.equal(JSON.parse(out.join("")).data.code, "NO_FLOW");
        assert.equal(fs.existsSync(path.join(tmp, ".tmp")), false);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("runtime log write is best-effort when cleanup removes the log directory", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-"));
      try {
        const agentWorkDir = path.join(tmp, ".agent-work");
        container.register("paths", { root: tmp, agentWorkDir });

        class Cmd extends Command {
          static outputMode = "envelope";
          execute() {
            fs.rmSync(agentWorkDir, { recursive: true, force: true });
            return { ok: true };
          }
        }

        const entry = {
          command: async () => ({ default: Cmd }),
          args: { options: [] },
          requiresFlow: false,
        };
        const out = [];
        await dispatch({
          container,
          entry,
          argv: [],
          envelopeType: "run",
          envelopeKey: "finalize-cleanup",
          runtimeLog: true,
          stdout: (s) => out.push(s),
          buildHookCtx: () => ({ specId: "demo-flow" }),
        });

        assert.equal(JSON.parse(out.join("")).ok, true);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("writes finalize cleanup runtime logs outside the managed worktree", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-finalize-cleanup-"));
      const mainRoot = path.join(tmp, "main");
      const worktreeRoot = path.join(mainRoot, ".senti", "worktree", "feature-demo");
      try {
        fs.mkdirSync(worktreeRoot, { recursive: true });
        container.register("paths", {
          root: worktreeRoot,
          agentWorkDir: path.join(worktreeRoot, ".agent-work"),
        });
        const mainFlowManager = {};
        const flowManager = {
          resolveWorktreePaths() {
            return { mainRepoPath: mainRoot, worktreePath: worktreeRoot };
          },
          forRoot(root) {
            assert.equal(root, mainRoot);
            return mainFlowManager;
          },
        };

        class Cmd extends Command {
          static outputMode = "envelope";
          execute() {
            return { status: "done" };
          }
        }

        const entry = {
          command: async () => ({
            default: Cmd,
            recordFinalizeCleanupPostCommandMetadata() {},
          }),
          args: { options: [] },
          requiresFlow: false,
          runtimeLog: { stepMetadata: false },
        };
        const out = [];
        await dispatch({
          container,
          entry,
          argv: [],
          envelopeType: "run",
          envelopeKey: "finalize-cleanup",
          runtimeLog: true,
          stdout: (s) => out.push(s),
          buildHookCtx: () => ({
            root: worktreeRoot,
            specId: "demo-flow",
            flowState: { runId: "run-demo", worktree: true },
            flowManager,
          }),
        });
        assert.equal(JSON.parse(out.join("")).ok, true);

        assert.equal(
          fs.existsSync(path.join(mainRoot, ".tmp", "logs", "demo-flow.log")),
          true,
        );
        assert.equal(fs.existsSync(path.join(worktreeRoot, ".tmp")), false);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("persists cleanup runtime metadata through the loaded command module and main flow authority", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-dispatcher-cleanup-metadata-"));
      try {
        const agentWorkDir = path.join(tmp, ".agent-work");
        container.register("paths", { root: tmp, agentWorkDir });

        class Cmd extends Command {
          static outputMode = "envelope";
          execute() {
            return { status: "done" };
          }
        }

        const mainFlowManager = { authority: "main" };
        const worktreeFlowManager = {
          resolveWorktreePaths() {
            return { mainRepoPath: tmp };
          },
          forRoot(root) {
            assert.equal(root, tmp);
            return mainFlowManager;
          },
        };
        let recorded = null;
        const entry = {
          command: async () => ({
            default: Cmd,
            recordFinalizeCleanupPostCommandMetadata(input) {
              recorded = input;
            },
          }),
          args: { options: [] },
          requiresFlow: false,
          runtimeLog: { stepMetadata: false },
        };
        const out = [];
        await dispatch({
          container,
          entry,
          argv: [],
          envelopeType: "run",
          envelopeKey: "finalize-cleanup",
          runtimeLog: true,
          stdout: (s) => out.push(s),
          buildHookCtx: () => ({
            specId: "demo-flow",
            flowState: { runId: "run-demo", worktree: true },
            flowManager: worktreeFlowManager,
          }),
        });

        assert.equal(JSON.parse(out.join("")).ok, true);
        assert.equal(recorded.flowManager, mainFlowManager);
        assert.equal(recorded.specId, "demo-flow");
        assert.equal(recorded.runtimeLog.runId, "run-demo");
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("raw mode lets the command write stdout itself", async () => {
      class Cmd extends Command {
        static outputMode = "raw";
        execute() {
          process.stdout.write("raw-output\n");
        }
      }
      const entry = { command: async () => ({ default: Cmd }) };
      await dispatch({ container, entry, argv: [] });
      // Just verify dispatcher does NOT wrap in envelope (no assertion on stdout;
      // compared to the envelope test above, absence of JSON parsing means raw).
    });
  });

  describe("exit code contract (R8a)", () => {
    it("sets non-zero exit code on failure in envelope mode", async () => {
      class Cmd extends Command {
        static outputMode = "envelope";
        execute() {
          throw new Error("bad");
        }
      }
      const entry = {
        command: async () => ({ default: Cmd }),
        envelopeType: "test",
        envelopeKey: "demo",
      };
      let exit = 0;
      await dispatch({
        container,
        entry,
        argv: [],
        stdout: () => {},
        setExitCode: (code) => {
          exit = code;
        },
      }).catch(() => {});
      assert.notEqual(exit, 0);
    });
  });

  describe("post hook failure exit code (issue #177)", () => {
    const makeCmd = (mode, executeImpl = () => ({})) =>
      class extends Command {
        static outputMode = mode;
        execute(ctx) { return executeImpl(ctx); }
      };

    const makeEntry = ({ mode, post, executeImpl }) => ({
      command: async () => ({ default: makeCmd(mode, executeImpl) }),
      ...(mode === "envelope" ? { envelopeType: "test", envelopeKey: "demo" } : {}),
      ...(post ? { post } : {}),
    });

    const runDispatch = async ({ entry, captureStdout = false, captureStderr = false }) => {
      const stdoutChunks = [];
      const stderrChunks = [];
      const exitCodes = [];
      await dispatch({
        container,
        entry,
        argv: [],
        stdout: captureStdout ? (s) => stdoutChunks.push(s) : () => {},
        stderr: captureStderr ? (s) => stderrChunks.push(s) : () => {},
        setExitCode: (code) => exitCodes.push(code),
      });
      return {
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
        exitCodes,
        lastExitCode: exitCodes.length ? exitCodes[exitCodes.length - 1] : undefined,
      };
    };

    const findWarning = (parsed, code) =>
      (parsed.errors || []).find((e) => e.code === code);

    it("envelope mode: post hook failure sets exit code 1 while keeping ok=true and POST_HOOK_FAILED warning", async () => {
      const entry = makeEntry({
        mode: "envelope",
        post: () => { throw new Error("post-failed"); },
      });
      const { stdout, lastExitCode } = await runDispatch({ entry, captureStdout: true });
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.ok, true, "envelope ok stays true (command body succeeded)");
      const warning = findWarning(parsed, "POST_HOOK_FAILED");
      assert.ok(warning, "POST_HOOK_FAILED entry is present in errors array");
      assert.equal(warning.level, "warn", "POST_HOOK_FAILED is recorded at warn level");
      assert.ok(
        warning.messages.some((m) => m.includes("post-failed")),
        "post hook error message is preserved",
      );
      assert.equal(lastExitCode, 1, "exit code is 1 despite ok=true");
    });

    it("raw mode: post hook failure sets exit code 1 and writes stderr", async () => {
      const entry = makeEntry({
        mode: "raw",
        post: () => { throw new Error("post-failed-raw"); },
      });
      const { stderr, lastExitCode } = await runDispatch({ entry, captureStderr: true });
      assert.match(stderr, /post-failed-raw/, "post hook error is surfaced to stderr");
      assert.equal(lastExitCode, 1, "exit code is 1 in raw mode");
    });

    it("envelope mode: async (Promise reject) post hook failure also sets exit code 1", async () => {
      const entry = makeEntry({
        mode: "envelope",
        post: async () => {
          await Promise.resolve();
          throw new Error("async-post-failed");
        },
      });
      const { lastExitCode } = await runDispatch({ entry });
      assert.equal(lastExitCode, 1);
    });

    it("raw mode: async post hook failure also sets exit code 1", async () => {
      const entry = makeEntry({
        mode: "raw",
        post: async () => {
          await Promise.resolve();
          throw new Error("async-post-failed-raw");
        },
      });
      const { lastExitCode } = await runDispatch({ entry });
      assert.equal(lastExitCode, 1);
    });

    it("post hook success does not change exit code behavior (envelope mode ok=true → exit 0)", async () => {
      const entry = makeEntry({ mode: "envelope", post: () => {} });
      const { lastExitCode } = await runDispatch({ entry });
      assert.equal(lastExitCode, 0, "successful envelope run exits 0");
    });

    it("raw mode without post hook and successful command does not set exit code to 1", async () => {
      const entry = makeEntry({ mode: "raw" });
      const { exitCodes } = await runDispatch({ entry });
      assert.ok(
        !exitCodes.includes(1),
        "setExitCode(1) must not be called when post hook is undefined and command succeeds",
      );
    });
  });

  describe("error visibility (R8b)", () => {
    it("errors are emitted to stderr or envelope, never silently swallowed", async () => {
      class Cmd extends Command {
        static outputMode = "envelope";
        execute() {
          throw new Error("visible-error");
        }
      }
      const entry = {
        command: async () => ({ default: Cmd }),
        envelopeType: "test",
        envelopeKey: "demo",
      };
      const out = [];
      await dispatch({
        container,
        entry,
        argv: [],
        stdout: (s) => out.push(s),
        setExitCode: () => {},
      }).catch(() => {});
      const parsed = JSON.parse(out.join(""));
      assert.equal(parsed.ok, false);
      const errText = JSON.stringify(parsed.errors || []);
      assert.match(errText, /visible-error/);
    });
  });
});
