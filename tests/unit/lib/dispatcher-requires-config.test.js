import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Container } from "../../../src/lib/container.js";
import { Command } from "../../../src/lib/command.js";
import { dispatch } from "../../../src/lib/dispatcher.js";

describe("dispatcher — requiresConfig enforcement (R2/R3/R6, #175)", () => {
  let container;
  let stdout;
  let exitCode;

  beforeEach(() => {
    container = new Container();
    container.register("root", "/tmp/root");
    stdout = "";
    exitCode = undefined;
  });

  const io = () => ({
    stdout: (s) => { stdout += s; },
    setExitCode: (c) => { exitCode = c; },
  });

  class OkCommand extends Command {
    static outputMode = "envelope";
    execute() { return { ran: true }; }
  }

  it("fails with NO_CONFIG envelope when entry declares requiresConfig and config is null (R2)", async () => {
    container.register("config", null);
    const entry = {
      command: async () => ({ default: OkCommand }),
      requiresConfig: true,
    };
    await dispatch({
      container,
      entry,
      argv: [],
      envelopeType: "run",
      envelopeKey: "some-cmd",
      ...io(),
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, false);
    const err = parsed.errors?.[0];
    assert.ok(err, "must emit at least one error");
    assert.equal(err.code, "NO_CONFIG");
    const msg = Array.isArray(err.messages) ? err.messages[0] : err.message;
    assert.match(
      String(msg),
      /config\.json not found\. Run senti setup first\./,
      "NO_CONFIG message must match the existing canonical text",
    );
    assert.notEqual(exitCode, 0, "exit code must be non-zero on failure");
  });

  it("does NOT invoke the command body when requiresConfig fires (R2)", async () => {
    container.register("config", null);
    let executed = false;
    class TrackedCommand extends Command {
      static outputMode = "envelope";
      execute() { executed = true; return {}; }
    }
    const entry = {
      command: async () => ({ default: TrackedCommand }),
      requiresConfig: true,
    };
    await dispatch({
      container,
      entry,
      argv: [],
      envelopeType: "run",
      envelopeKey: "some-cmd",
      ...io(),
    });
    assert.equal(executed, false, "command body must not run when config is missing");
  });

  it("runs the command normally when requiresConfig is true AND config is present", async () => {
    container.register("config", { lang: "ja", type: "sample-node-command", docs: { languages: ["ja"], defaultLanguage: "ja" } });
    const entry = {
      command: async () => ({ default: OkCommand }),
      requiresConfig: true,
    };
    await dispatch({
      container,
      entry,
      argv: [],
      envelopeType: "run",
      envelopeKey: "some-cmd",
      ...io(),
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, true);
    assert.equal(exitCode, 0);
  });

  it("runs the command normally when requiresConfig is NOT declared, even if config is null (R6)", async () => {
    container.register("config", null);
    const entry = {
      command: async () => ({ default: OkCommand }),
    };
    await dispatch({
      container,
      entry,
      argv: [],
      envelopeType: "run",
      envelopeKey: "help-like-cmd",
      ...io(),
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, true, "help-like commands must succeed without config");
  });
});
