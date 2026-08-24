import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import os from "os";
import { EventEmitter } from "events";
import { fileURLToPath } from "url";
import { Agent, ChildProcessSupervisor } from "../../../src/lib/agent.js";
import {
  AgentAuthenticationFailure,
  EmptyAgentResponseFailure,
  AgentPermissionConfigurationFailure,
  TemporaryRateLimitFailure,
  UnknownProviderFailure,
} from "../../../src/lib/agent-failure.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";
import { ReviewExecutionLease } from "../../../src/flow/lib/review-execution-lease.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-test-"));
}

const WORKER_ARTIFACT_HANDOFF_SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../src/flow/schemas/next-action/worker-artifact-handoff.schema.json",
);

function makeAgent(profile, { config, paths, flowManager, logger, supervision } = {}) {
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
    supervision,
  });
}

async function waitForFile(file, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (!fs.existsSync(file)) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${file}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function waitForProcessExit(pid, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return;
      throw error;
    }
    if (Date.now() >= deadline) throw new Error(`provider descendant ${pid} remained alive after timeout cleanup`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function successfulSpawnRecorder(record) {
  return (command, args, options) => {
    record.command = command;
    record.args = args;
    record.options = options;
    const child = new EventEmitter();
    child.pid = null;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => {
      child.stdout.emit("data", "ok");
      child.emit("close", 0, null);
    });
    return child;
  };
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

  it("preserves replacement syntax as literal prompt content", async () => {
    const agent = makeAgent({ command: "echo", args: ["{{PROMPT}}"] });
    const result = await agent.call("literal $& and $1 content", { commandId: "test" });
    assert.equal(result, "literal $& and $1 content");
  });

  it("appends prompt when no {{PROMPT}} token", async () => {
    const agent = makeAgent({ command: "echo", args: ["-n"] });
    const result = await agent.call("appended", { commandId: "test" });
    assert.match(result, /appended/);
  });

  it("injects an explicit repository-local execution directory for a worker call", () => {
    const root = tmpDir();
    const executionWorkDir = path.join(root, "worker");
    fs.mkdirSync(executionWorkDir);
    const agent = makeAgent(
      {
        command: "worker",
        args: ["exec", "{{PROMPT}}"],
        workDirFlag: "--cwd",
      },
      { paths: { root, agentWorkDir: path.join(root, ".tmp") } },
    );

    const invocation = agent._buildInvocationForTest("work", {
      commandId: "test",
      executionWorkDir,
    });

    assert.deepEqual(invocation.finalArgs, ["exec", "--cwd", executionWorkDir, "work"]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("starts a flagless provider inside the execution work directory", async (t) => {
    const root = tmpDir();
    const executionWorkDir = path.join(root, "review-snapshot");
    fs.mkdirSync(executionWorkDir);
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const spawned = {};
    const agent = makeAgent(
      { command: "worker", args: ["exec", "{{PROMPT}}"] },
      {
        paths: { root, agentWorkDir: path.join(root, ".tmp") },
        supervision: { spawn: successfulSpawnRecorder(spawned) },
      },
    );

    assert.equal(await agent.call("review", {
      commandId: "test",
      executionWorkDir,
      retryCount: 0,
    }), "ok");
    assert.equal(spawned.options.cwd, executionWorkDir);
    assert.deepEqual(spawned.args, ["exec", "review"]);
  });

  it("starts a flagged provider inside the same execution work directory", async (t) => {
    const root = tmpDir();
    const executionWorkDir = path.join(root, "review-snapshot");
    fs.mkdirSync(executionWorkDir);
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const spawned = {};
    const agent = makeAgent(
      { command: "worker", args: ["exec", "{{PROMPT}}"], workDirFlag: "--cwd" },
      {
        paths: { root, agentWorkDir: path.join(root, ".tmp") },
        supervision: { spawn: successfulSpawnRecorder(spawned) },
      },
    );

    assert.equal(await agent.call("review", {
      commandId: "test",
      executionWorkDir,
      retryCount: 0,
    }), "ok");
    assert.equal(spawned.options.cwd, executionWorkDir);
    assert.deepEqual(spawned.args, ["exec", "--cwd", executionWorkDir, "review"]);
  });

  it("keeps the repository root as the default child working directory", async (t) => {
    const root = tmpDir();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const spawned = {};
    const agent = makeAgent(
      { command: "worker", args: ["exec", "{{PROMPT}}"] },
      {
        paths: { root, agentWorkDir: path.join(root, ".tmp") },
        supervision: { spawn: successfulSpawnRecorder(spawned) },
      },
    );

    assert.equal(await agent.call("review", { commandId: "test", retryCount: 0 }), "ok");
    assert.equal(spawned.options.cwd, root);
  });

  it("passes the spec schema through a schema-capable provider profile", (t) => {
    const root = tmpDir();
    const agentWorkDir = path.join(root, ".tmp");
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const agent = makeAgent(null, {
      config: { agent: { default: "codex/gpt-5.6-terra-medium" } },
      paths: { root, agentWorkDir },
    });
    const schema = { type: "object", properties: { goal: { type: "string" } } };

    const invocation = agent._buildInvocationForTest("write spec", {
      commandId: "flow.dispatch",
      executionWorkDir: root,
      jsonSchema: schema,
      fmtFallback: "FALLBACK SPEC INSTRUCTIONS",
    });

    assert.ok(invocation.finalArgs.includes("--output-schema"));
    assert.equal(invocation.pendingSchemaWrite != null, true);
    const providerSchema = JSON.parse(invocation.pendingSchemaWrite.content);
    assert.deepEqual(providerSchema.required, ["goal"]);
    assert.equal(providerSchema.additionalProperties, false);
    assert.deepEqual(providerSchema.properties.goal.type, ["string", "null"]);
    assert.doesNotMatch(invocation.finalArgs.join(" "), /FALLBACK SPEC INSTRUCTIONS/);
  });

  it("writes a Codex-compatible sealed handoff response schema", (t) => {
    const root = tmpDir();
    const agentWorkDir = path.join(root, ".tmp");
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const agent = makeAgent(null, {
      config: { agent: { default: "codex/gpt-5.6-terra-medium" } },
      paths: { root, agentWorkDir },
    });
    const canonical = JSON.parse(fs.readFileSync(WORKER_ARTIFACT_HANDOFF_SCHEMA_PATH, "utf8"));

    const invocation = agent._buildInvocationForTest("seal handoff", {
      commandId: "flow.dispatch",
      executionWorkDir: root,
      jsonSchema: canonical,
    });
    const providerSchema = JSON.parse(invocation.pendingSchemaWrite.content);

    assert.deepEqual(providerSchema.properties.sealed, { const: true, type: "boolean" });
    assert.ok(providerSchema.required.includes("runtimeLog"));
    assert.deepEqual(providerSchema.properties.runtimeLog.type, ["object", "null"]);
    assert.equal(providerSchema.properties.runtimeLog.additionalProperties, false);
    assert.deepEqual(canonical.properties.sealed, { const: true });
  });

  it("uses the equivalent prompt fallback for a provider without schema support", (t) => {
    const root = tmpDir();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const agent = makeAgent({
      command: "worker",
      args: ["{{PROMPT}}"],
      jsonSchemaFlag: "--schema",
    }, { paths: { root, agentWorkDir: path.join(root, ".tmp") } });

    const invocation = agent._buildInvocationForTest("write spec", {
      commandId: "flow.dispatch",
      executionWorkDir: root,
      jsonSchema: { type: "object" },
      fmtFallback: "FALLBACK SPEC INSTRUCTIONS",
    });

    assert.equal(invocation.pendingSchemaWrite, null);
    assert.equal(invocation.finalArgs.includes("--schema"), false);
    assert.match(invocation.finalArgs[0], /^FALLBACK SPEC INSTRUCTIONS\n\nwrite spec$/);
  });

  it("rejects an execution directory outside the repository before spawning", async (t) => {
    const root = tmpDir();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const agent = makeAgent(
      { command: "echo", args: ["{{PROMPT}}"] },
      { paths: { root, agentWorkDir: path.join(root, ".tmp") } },
    );

    await assert.rejects(
      agent.call("work", {
        commandId: "test",
        executionWorkDir: path.dirname(root),
      }),
      (error) => (
        error instanceof AgentPermissionConfigurationFailure
        && error.code === "AGENT_PERMISSION_CONFIGURATION_FAILED"
        && error.retryable === false
        && /executionWorkDir must stay inside/.test(error.message)
      ),
    );
  });

  it("types work-directory setup failures before spawning", async (t) => {
    const root = tmpDir();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const agentWorkDir = path.join(root, "agent-work-file");
    fs.writeFileSync(agentWorkDir, "not a directory\n");
    const agent = makeAgent(
      { command: "echo", args: ["{{PROMPT}}"] },
      { paths: { root, agentWorkDir } },
    );

    await assert.rejects(
      agent.call("work", { commandId: "test" }),
      (error) => (
        error instanceof AgentPermissionConfigurationFailure
        && error.code === "AGENT_PERMISSION_CONFIGURATION_FAILED"
        && error.retryable === false
        && error.attemptCount === 1
        && error.maxAttempts === 1
      ),
    );
  });

  it("waits for a provider process group before returning when requested", async (t) => {
    const root = tmpDir();
    const marker = path.join(root, "descendant-finished.txt");
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const descendant = [
      "const fs=require('node:fs');",
      `setTimeout(()=>{fs.writeFileSync(${JSON.stringify(marker)},'done');},150);`,
    ].join("");
    const provider = [
      "const {spawn}=require('node:child_process');",
      `const child=spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'});`,
      "child.unref();",
      "process.stdout.write('provider returned');",
    ].join("");
    const agent = makeAgent(
      { command: process.execPath, args: ["-e", provider] },
      { paths: { root, agentWorkDir: path.join(root, ".tmp") } },
    );

    const result = await agent.call("", {
      commandId: "test",
      retryCount: 0,
      waitForProcessTree: true,
    });

    assert.equal(result, "provider returned");
    assert.equal(fs.readFileSync(marker, "utf8"), "done");
  });

  it("kills a forked timed-out provider tree before releasing its review execution lease", async (t) => {
    if (process.platform === "win32") t.skip("POSIX process-group containment is covered by the Windows supervisor separately");
    const root = tmpDir();
    const marker = path.join(root, "forked-provider-child.pid");
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const descendant = [
      "const fs=require('node:fs');",
      `fs.writeFileSync(${JSON.stringify(marker)},String(process.pid));`,
      "setInterval(()=>{},1_000);",
    ].join("");
    const provider = [
      "const {spawn}=require('node:child_process');",
      `spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'});`,
      "setInterval(()=>{},1_000);",
    ].join("");
    const agent = makeAgent(
      { command: process.execPath, args: ["-e", provider] },
      {
        paths: { root, agentWorkDir: path.join(root, ".tmp") },
        config: {
          agent: {
            default: "test/exec",
            providers: { "test/exec": { command: process.execPath, args: ["-e", provider] } },
            timeout: 0.2,
          },
        },
      },
    );
    const identity = { mainRoot: root, runId: "timeout-run", nodeId: "spec-review", attemptId: "timeout-attempt" };
    const lease = new ReviewExecutionLease(identity);
    lease.acquire();
    try {
      await assert.rejects(agent.call("", {
        commandId: "test",
        retryCount: 0,
        waitForProcessTree: true,
      }), /timed out/i);
    } finally {
      lease.release();
    }
    await waitForFile(marker);
    await waitForProcessExit(Number.parseInt(fs.readFileSync(marker, "utf8"), 10));
    const afterTimeout = new ReviewExecutionLease(identity);
    afterTimeout.acquire();
    afterTimeout.release();
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

  it("rejects too many execution environment variables before spawning", () => {
    const agent = makeAgent({ command: "echo", args: ["{{PROMPT}}"] });
    const executionEnvironment = Object.fromEntries(
      Array.from({ length: 65 }, (_, index) => [`SENNEL_TEST_${index}`, "value"]),
    );

    assert.throws(
      () => agent._buildInvocationForTest("work", { commandId: "test", executionEnvironment }),
      /must contain at most 64 variables/,
    );
  });

  it("rejects an oversized execution environment before spawning", () => {
    const agent = makeAgent({ command: "echo", args: ["{{PROMPT}}"] });

    assert.throws(
      () => agent._buildInvocationForTest("work", {
        commandId: "test",
        executionEnvironment: { SENNEL_TEST_VALUE: "x".repeat(64 * 1024) },
      }),
      /must not exceed 65536 bytes/,
    );
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

  it("types an empty response without retry when retryCount is 0", async () => {
    const agent = makeAgent({ command: "node", args: ["-e", ""] });
    await assert.rejects(
      agent.call("", { commandId: "test", retryCount: 0 }),
      (error) => (
        error instanceof EmptyAgentResponseFailure
        && error.retryable === true
        && error.attemptCount === 1
        && error.maxAttempts === 1
      ),
    );
  });

  it("does not retry an unexplained non-zero exit", async (t) => {
    const tmp = path.join(os.tmpdir(), `agent-retry-exit-${Date.now()}`);
    t.after(() => fs.rmSync(tmp, { force: true }));
    const script = `
      const fs = require("fs");
      const f = process.argv[1];
      let n = 0;
      try { n = Number(fs.readFileSync(f, "utf8")); } catch {}
      n++;
      fs.writeFileSync(f, String(n));
      process.exit(1);
    `;
    const agent = makeAgent({ command: "node", args: ["-e", script, tmp] });
    await assert.rejects(
      agent.call("", { commandId: "test", retryCount: 2, retryDelayMs: 10 }),
      (error) => (
        error instanceof UnknownProviderFailure
        && error.retryable === false
        && error.attemptCount === 1
        && error.maxAttempts === 3
      ),
    );
    assert.equal(fs.readFileSync(tmp, "utf8"), "1");
  });

  it("retries a rate limit and succeeds", async (t) => {
    const tmp = path.join(os.tmpdir(), `agent-retry-rate-limit-${Date.now()}`);
    t.after(() => fs.rmSync(tmp, { force: true }));
    const script = `
      const fs = require("fs");
      const f = process.argv[1];
      let n = 0;
      try { n = Number(fs.readFileSync(f, "utf8")); } catch {}
      n++;
      fs.writeFileSync(f, String(n));
      if (n === 1) {
        process.stderr.write("HTTP 429 rate limited");
        process.exit(1);
      }
      process.stdout.write("recovered");
    `;
    const agent = makeAgent({ command: "node", args: ["-e", script, tmp] });
    const result = await agent.call("", { commandId: "test", retryCount: 2, retryDelayMs: 10 });
    assert.equal(result, "recovered");
    assert.equal(fs.readFileSync(tmp, "utf8"), "2");
  });

  it("does not retry an authentication failure", async (t) => {
    const tmp = path.join(os.tmpdir(), `agent-no-retry-auth-${Date.now()}`);
    t.after(() => fs.rmSync(tmp, { force: true }));
    const script = `
      const fs = require("fs");
      const f = process.argv[1];
      let n = 0;
      try { n = Number(fs.readFileSync(f, "utf8")); } catch {}
      fs.writeFileSync(f, String(n + 1));
      process.stderr.write("HTTP 401 Unauthorized");
      process.exit(1);
    `;
    const agent = makeAgent({ command: "node", args: ["-e", script, tmp] });
    await assert.rejects(
      agent.call("", { commandId: "test", retryCount: 2, retryDelayMs: 10 }),
      (error) => (
        error instanceof AgentAuthenticationFailure
        && error.retryable === false
        && error.attemptCount === 1
        && error.maxAttempts === 3
      ),
    );
    assert.equal(fs.readFileSync(tmp, "utf8"), "1");
  });

  it("preserves bounded attempt metadata after retry exhaustion", async () => {
    const agent = makeAgent({
      command: "node",
      args: ["-e", "process.stderr.write('HTTP 429 rate limited'); process.exit(1)"],
    });
    await assert.rejects(
      agent.call("", { commandId: "test", retryCount: 1, retryDelayMs: 10 }),
      (error) => (
        error instanceof TemporaryRateLimitFailure
        && error.retryable === true
        && error.attemptCount === 2
        && error.maxAttempts === 2
      ),
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
    const specId = "cache";
    const decisions = [];
    const flowManager = {
      resolveCurrentContext() {
        return { specId, taskId: null, flowPhase: "impl" };
      },
      loadActiveFlows() { return [{ specId }]; },
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
        default: "codex/gpt-5.6-terra-medium",
        useProfile: "codex",
        profiles: {
          default: {
            "plugin.sample.publish": "claude/sonnet",
          },
          codex: {
            flow: "codex/gpt-5.6-terra-medium",
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
            "plugin.sample.publish": "codex/gpt-5.6-terra-medium",
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

  it("throws when SENNEL_PROFILE references an undefined profile", () => {
    const cfg = { agent: { default: "claude/opus", useProfile: "missing" } };
    const agent = makeAgent(null, { config: cfg });
    assert.throws(() => agent.resolve());
  });
});
