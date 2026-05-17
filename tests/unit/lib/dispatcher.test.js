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

    it("flow run envelope mode writes human-readable runtime log without changing stdout envelope", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-dispatcher-"));
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
          args: { options: ["--log-file"] },
          requiresFlow: false,
        };
        const out = [];
        const logFile = "logs/runtime.log";
        await dispatch({
          container,
          entry,
          argv: ["--log-file", logFile],
          envelopeType: "run",
          envelopeKey: "gate",
          stdout: (s) => out.push(s),
          buildHookCtx: () => ({ specId: "demo-flow" }),
        });

        const parsed = JSON.parse(out.join(""));
        assert.equal(parsed.ok, true);
        assert.equal(parsed.data.data, 42);
        assert.doesNotMatch(out.join(""), /human progress/);

        const logText = fs.readFileSync(path.join(tmp, logFile), "utf8");
        assert.match(logText, /start flow run gate/);
        assert.match(logText, /human progress/);
        assert.doesNotMatch(logText, /"ok": true/);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("flow run uses default runtime log path under agentWorkDir/logs/<flowId>", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-dispatcher-"));
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
          args: { options: ["--log-file", "--phase"] },
          requiresFlow: false,
        };
        const out = [];
        await dispatch({
          container,
          entry,
          argv: ["--phase", "draft"],
          envelopeType: "run",
          envelopeKey: "gate",
          stdout: (s) => out.push(s),
          buildHookCtx: () => ({ specId: "demo-flow" }),
        });

        assert.equal(JSON.parse(out.join("")).ok, true);
        const logDir = path.join(agentWorkDir, "logs", "demo-flow");
        const files = fs.readdirSync(logDir);
        assert.equal(files.length, 1);
        assert.match(files[0], /^gate-draft-/);
        assert.match(fs.readFileSync(path.join(logDir, files[0]), "utf8"), /active flow progress/);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("flow run without active flow uses no-flow default runtime log path without phase suffix", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-dispatcher-"));
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
          args: { options: ["--log-file", "--phase"] },
          requiresFlow: false,
        };
        const out = [];
        await dispatch({
          container,
          entry,
          argv: ["--phase", "draft"],
          envelopeType: "run",
          envelopeKey: "auto-check",
          stdout: (s) => out.push(s),
        });

        assert.equal(JSON.parse(out.join("")).ok, true);
        const logDir = path.join(agentWorkDir, "logs", "no-flow");
        const files = fs.readdirSync(logDir);
        assert.equal(files.length, 1);
        assert.match(files[0], /^auto-check-/);
        assert.doesNotMatch(files[0], /^auto-check-draft-/);
        assert.match(fs.readFileSync(path.join(logDir, files[0]), "utf8"), /no flow progress/);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("runtime log write is best-effort when cleanup removes the log directory", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-dispatcher-"));
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
          args: { options: ["--log-file"] },
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
