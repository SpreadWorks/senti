import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import os from "os";
import { EventEmitter } from "events";
import { Agent, ChildProcessSupervisor } from "../../../src/lib/agent.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-test-"));
}

function makeAgent(profile, { config, paths, flowManager, logger } = {}) {
  const root = paths?.root || tmpDir();
  const agentWorkDir = paths?.agentWorkDir || path.join(root, ".tmp");
  const userProviders = profile ? { "test/exec": profile } : {};
  const cfg = config || {
    agent: {
      default: profile ? "test/exec" : "claude/opus",
      providers: userProviders,
      timeout: 300,
    },
  };
  const registry = new ProviderRegistry(cfg.agent?.providers || {});
  return new Agent({
    config: cfg,
    paths: { root, agentWorkDir, ...(paths || {}) },
    registry,
    logger: logger || new Logger({ logDir: os.tmpdir(), enabled: false }),
    flowManager,
  });
}

describe("Agent.call() — basic invocation", () => {
  it("calls a command and returns trimmed output", async () => {
    const agent = makeAgent({ command: "echo", args: ["{{PROMPT}}"] });
    const result = await agent.call("hello world", { commandId: "test" });
    assert.equal(result, "hello world");
  });

  it("substitutes {{PROMPT}} token in args", async () => {
    const agent = makeAgent({ command: "echo", args: ["{{PROMPT}}"] });
    const result = await agent.call("test-prompt", { commandId: "test" });
    assert.equal(result, "test-prompt");
  });

  it("appends prompt when no {{PROMPT}} token", async () => {
    const agent = makeAgent({ command: "echo", args: ["-n"] });
    const result = await agent.call("appended", { commandId: "test" });
    assert.match(result, /appended/);
  });

  it("throws on failing command", async () => {
    const agent = makeAgent({ command: "node", args: ["-e", "process.exit(1)"] });
    await assert.rejects(agent.call("test", { commandId: "test" }));
  });

  it("persists complete failed subprocess output and links the diagnostic log", async (t) => {
    const root = tmpDir();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const stdout = "stdout-" + "x".repeat(500);
    const stderr = "stderr-" + "y".repeat(500);
    const script = `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write(${JSON.stringify(stderr)}); process.exit(1);`;
    const logger = new Logger({ logDir: path.join(root, ".tmp", "logs"), enabled: true, cwd: root });
    const agent = makeAgent(
      { command: "node", args: ["-e", script] },
      { paths: { root, agentWorkDir: path.join(root, ".tmp") }, logger },
    );

    let error;
    try {
      await agent.call("test", { commandId: "test", retryCount: 0 });
    } catch (caught) {
      error = caught;
    }

    assert.ok(error instanceof Error);
    assert.equal(error.stdout, stdout);
    assert.equal(error.stderr, stderr);
    assert.match(error.message, /stdoutPreview=stdout-/);
    assert.ok(error.diagnosticLog);
    assert.match(error.message, /diagnosticLog=/);
    const diagnostic = JSON.parse(fs.readFileSync(error.diagnosticLog, "utf8"));
    assert.equal(diagnostic.response.stdout, stdout);
    assert.equal(diagnostic.response.stderr, stderr);
  });

  it("falls back to stdin when args exceed threshold", async () => {
    const agent = makeAgent(
      { command: "cat", args: [] },
      { config: { agent: { default: "test/exec", providers: { "test/exec": { command: "cat", args: [] } }, stdinFallbackThreshold: 1000 } } },
    );
    const largePrompt = "X".repeat(2000);
    const result = await agent.call(largePrompt, { commandId: "test" });
    assert.equal(result, largePrompt);
  });
});

describe("ChildProcessSupervisor", () => {
  it("settles after a bounded drain when the direct child exits without close", async () => {
    const child = new EventEmitter();
    const supervisor = new ChildProcessSupervisor({
      child,
      timeoutMs: 1_000,
      graceMs: 10,
      exitDrainMs: 1,
    });

    const completion = supervisor.wait();
    child.emit("exit", 0, null);

    assert.deepEqual(await completion, { code: 0, signal: null });
    assert.equal(child.listenerCount("close"), 0);
    assert.equal(child.listenerCount("exit"), 0);
  });
});

describe("Agent.call() — retry behavior", () => {
  it("retries on empty response and succeeds", async () => {
    const tmp = path.join(os.tmpdir(), `agent-retry-${Date.now()}`);
    const script = `
      const fs = require("fs");
      const f = process.argv[1];
      let n = 0;
      try { n = Number(fs.readFileSync(f, "utf8")); } catch {}
      n++;
      fs.writeFileSync(f, String(n));
      if (n === 1) process.stdout.write("");
      else process.stdout.write("ok");
    `;
    const agent = makeAgent({ command: "node", args: ["-e", script, tmp] });
    const result = await agent.call("", { commandId: "test", retryCount: 2, retryDelayMs: 10 });
    assert.equal(result, "ok");
    try { fs.unlinkSync(tmp); } catch {}
  });

  it("does not retry when retryCount is explicitly 0 (opt-out)", async () => {
    const agent = makeAgent({ command: "node", args: ["-e", ""] });
    const result = await agent.call("", { commandId: "test", retryCount: 0 });
    assert.equal(result, "");
  });

  it("retries on non-zero exit and succeeds", async () => {
    const tmp = path.join(os.tmpdir(), `agent-retry-exit-${Date.now()}`);
    const script = `
      const fs = require("fs");
      const f = process.argv[1];
      let n = 0;
      try { n = Number(fs.readFileSync(f, "utf8")); } catch {}
      n++;
      fs.writeFileSync(f, String(n));
      if (n === 1) process.exit(1);
      process.stdout.write("recovered");
    `;
    const agent = makeAgent({ command: "node", args: ["-e", script, tmp] });
    const result = await agent.call("", { commandId: "test", retryCount: 1, retryDelayMs: 10 });
    assert.equal(result, "recovered");
    try { fs.unlinkSync(tmp); } catch {}
  });

  it("throws last error after all retries exhausted", async () => {
    const agent = makeAgent({ command: "node", args: ["-e", "process.exit(1)"] });
    await assert.rejects(
      agent.call("", { commandId: "test", retryCount: 1, retryDelayMs: 10 }),
      /exit=1/,
    );
  });
});

describe("Agent.call() — prompt cache policy", () => {
  it("bypasses cache reads and writes only for cacheMode=bypass", async (t) => {
    const root = tmpDir();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const countFile = path.join(root, "count.txt");
    const script = [
      "const fs=require('fs');",
      "const file=process.argv[1];",
      "let count=fs.existsSync(file)?Number(fs.readFileSync(file,'utf8')):0;",
      "count+=1;fs.writeFileSync(file,String(count));",
      "process.stdout.write('provider-'+count);",
    ].join("");
    const spec = "specs/cache/spec.json";
    const decisions = [];
    const flowManager = {
      resolveCurrentContext() {
        return { spec, taskId: null, sentiPhase: "impl" };
      },
      loadActiveFlows() { return [{ spec }]; },
      appendMetric() {},
      accumulateAgentMetrics() {},
    };
    const agent = makeAgent(
      { command: "node", args: ["-e", script, countFile, "{{PROMPT}}"] },
      {
        paths: { root, agentWorkDir: path.join(root, ".tmp") },
        flowManager,
      },
    );

    const normal = await agent.call("same", {
      commandId: "test",
      onCacheDecision(decision) { decisions.push(decision); },
    });
    const cached = await agent.call("same", {
      commandId: "test",
      onCacheDecision(decision) { decisions.push(decision); },
    });
    const bypassed = await agent.call("same", {
      commandId: "test",
      cacheMode: "bypass",
      onCacheDecision(decision) { decisions.push(decision); },
    });
    const normalAgain = await agent.call("same", { commandId: "test" });

    assert.equal(normal, "provider-1");
    assert.equal(cached, "provider-1");
    assert.equal(bypassed, "provider-2");
    assert.equal(normalAgain, "provider-1");
    assert.deepEqual(decisions.map((entry) => entry.cacheOutcome), ["miss", "hit", "bypass"]);
  });
});

describe("Agent.resolve(commandId) — profile resolution", () => {
  it("returns the configured default agent when no commandId is given", () => {
    const agent = makeAgent(null, {
      config: {
        agent: {
          default: "claude/opus",
          timeout: 300,
        },
      },
    });
    const resolved = agent.resolve();
    assert.ok(resolved);
    assert.equal(resolved.profile.command, "claude");
  });

  it("returns null when no agent configured", () => {
    const agent = makeAgent(null, { config: { agent: {} } });
    assert.equal(agent.resolve(), null);
  });

  it("resolves via useProfile and profile entry", () => {
    const cfg = {
      agent: {
        default: "claude/sonnet",
        useProfile: "high",
        profiles: { high: { docs: "claude/opus" } },
      },
    };
    const agent = makeAgent(null, { config: cfg });
    const resolved = agent.resolve("docs");
    assert.equal(resolved.profile.command, "claude");
    assert.ok(resolved.profile.args.includes("opus"));
  });

  it("matches profile entry by command-id prefix", () => {
    const cfg = {
      agent: {
        default: "claude/sonnet",
        useProfile: "high",
        profiles: { high: { docs: "claude/opus" } },
      },
    };
    const agent = makeAgent(null, { config: cfg });
    const resolved = agent.resolve("docs.review");
    assert.ok(resolved.profile.args.includes("opus"));
  });

  it("falls back to the default profile when the active profile has no command entry", () => {
    const cfg = {
      agent: {
        default: "codex/gpt-5.4",
        useProfile: "codex",
        profiles: {
          default: {
            "plugin.sample.publish": "claude/sonnet",
          },
          codex: {
            flow: "codex/gpt-5.4",
          },
        },
      },
    };
    const agent = makeAgent(null, { config: cfg });
    const resolved = agent.resolve("plugin.sample.publish");
    assert.equal(resolved.profile.command, "claude");
    assert.ok(resolved.profile.args.includes("sonnet"));
  });

  it("keeps active profile entries ahead of the default profile fallback", () => {
    const cfg = {
      agent: {
        default: "claude/sonnet",
        useProfile: "codex",
        profiles: {
          default: {
            "plugin.sample.publish": "claude/sonnet",
          },
          codex: {
            "plugin.sample.publish": "codex/gpt-5.4",
          },
        },
      },
    };
    const agent = makeAgent(null, { config: cfg });
    const resolved = agent.resolve("plugin.sample.publish");
    assert.equal(resolved.profile.command, "codex");
  });

  it("returns null when default provider is unknown", () => {
    const cfg = {
      agent: { default: "unknown-provider" },
    };
    const agent = makeAgent(null, { config: cfg });
    assert.equal(agent.resolve(), null);
  });

  it("includes timeoutMs from config agent.timeout (seconds to ms)", () => {
    const cfg = {
      agent: {
        default: "claude/opus",
        timeout: 600,
      },
    };
    const agent = makeAgent(null, { config: cfg });
    const resolved = agent.resolve();
    assert.equal(resolved.timeoutMs, 600000);
  });

  it("defaults timeoutMs to 900000 when not configured", () => {
    const cfg = { agent: { default: "claude/opus" } };
    const agent = makeAgent(null, { config: cfg });
    const resolved = agent.resolve();
    assert.equal(resolved.timeoutMs, 900000);
  });

  it("throws when SENTI_PROFILE references an undefined profile", () => {
    const cfg = { agent: { default: "claude/opus", useProfile: "missing" } };
    const agent = makeAgent(null, { config: cfg });
    assert.throws(() => agent.resolve());
  });
});
