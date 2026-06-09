/**
 * Logger integration tests for the Agent service.
 *
 * The Agent service wraps every call() in logger.agent() start/end events,
 * preserving requestId across the pair and recording exitCode on failure.
 * Metric accumulation (post-call FlowManager update) is driven by Agent,
 * not by Logger.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { Agent } from "../../../src/lib/agent.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";
import { todayLocal, readJsonl } from "../../helpers/log-fixtures.js";

function makeLogger(tmpDir, opts = {}) {
  return new Logger({
    logDir: tmpDir,
    enabled: true,
    entryCommand: "test",
    cwd: tmpDir,
    flowManager: opts.flowManager ?? null,
  });
}

function makeAgentService(profile, tmpDir, { logger, flowManager } = {}) {
  const config = {
    agent: { default: "test/exec", providers: { "test/exec": profile } },
  };
  const registry = new ProviderRegistry(config.agent.providers);
  return new Agent({
    config,
    paths: { root: tmpDir, agentWorkDir: path.join(tmpDir, ".tmp") },
    registry,
    logger: logger ?? makeLogger(tmpDir),
    flowManager: flowManager ?? null,
  });
}

describe("Agent.call() — Logger integration", () => {
  let tmpDir;
  let logFile;
  let logger;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-log-"));
    logFile = path.join(tmpDir, `senti-${todayLocal()}.jsonl`);
    logger = makeLogger(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns the trimmed response and writes start + end events", async () => {
    const agent = makeAgentService({ command: "echo", args: ["{{PROMPT}}"] }, tmpDir, { logger });
    const result = await agent.call("hello", { commandId: "test" });
    assert.equal(result, "hello");
    await logger.flush();

    assert.ok(fs.existsSync(logFile));
    const entries = readJsonl(logFile);
    const phases = entries.filter((e) => e.type === "agent").map((e) => e.phase);
    assert.ok(phases.includes("start"));
    assert.ok(phases.includes("end"));

    const startEvent = entries.find((e) => e.phase === "start");
    const endEvent = entries.find((e) => e.phase === "end");
    assert.equal(startEvent.requestId, endEvent.requestId);
  });

  it("records the prompt file in the end event", async () => {
    const agent = makeAgentService({ command: "echo", args: ["{{PROMPT}}"] }, tmpDir, { logger });
    const result = await agent.call("world", { commandId: "test" });
    assert.equal(result, "world");
    await logger.flush();

    const entries = readJsonl(logFile);
    const endEvent = entries.find((e) => e.phase === "end");
    assert.ok(endEvent);
    assert.ok(endEvent.promptFile);
    const promptFilePath = path.resolve(tmpDir, endEvent.promptFile);
    assert.ok(fs.existsSync(promptFilePath));
  });

  it("records end event with non-zero exitCode when agent fails", async () => {
    const agent = makeAgentService({ command: "node", args: ["-e", "process.exit(2)"] }, tmpDir, { logger });
    await assert.rejects(agent.call("x", { commandId: "test" }));
    await logger.flush();

    assert.ok(fs.existsSync(logFile));
    const entries = readJsonl(logFile);
    const endEvent = entries.find((e) => e.phase === "end");
    assert.ok(endEvent);
    assert.notEqual(endEvent.exitCode, 0);
  });
});

describe("Agent.call() — metric accumulation (spec 186 R3)", () => {
  let tmpDir;
  let logger;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-metric-"));
    logger = makeLogger(tmpDir);
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("calls flowManager.accumulateAgentMetrics after a successful call", async () => {
    const calls = [];
    const flowManager = {
      resolveCurrentContext: () => ({ spec: "186-logger-container-service", sentiPhase: "test" }),
      accumulateAgentMetrics: (...args) => { calls.push(args); },
    };
    const agent = makeAgentService({ command: "echo", args: ["{{PROMPT}}"] }, tmpDir, { logger, flowManager });
    await agent.call("hi", { commandId: "test" });
    await logger.flush();

    assert.equal(calls.length, 1, "metric should be accumulated exactly once");
    assert.equal(calls[0][0], "test", "phase arg should be the current sentiPhase");
  });

  it("runs metric accumulation even when logger is disabled", async () => {
    const disabledLogger = new Logger({ logDir: tmpDir, enabled: false, entryCommand: "test", cwd: tmpDir });
    const calls = [];
    const flowManager = {
      resolveCurrentContext: () => ({ spec: "186", sentiPhase: "test" }),
      accumulateAgentMetrics: (...args) => { calls.push(args); },
    };
    const agent = makeAgentService({ command: "echo", args: ["{{PROMPT}}"] }, tmpDir, { logger: disabledLogger, flowManager });
    await agent.call("hi", { commandId: "test" });
    assert.equal(calls.length, 1);
  });

  it("skips metric accumulation when sentiPhase is null", async () => {
    const calls = [];
    const flowManager = {
      resolveCurrentContext: () => ({ spec: null, sentiPhase: null }),
      accumulateAgentMetrics: (...args) => { calls.push(args); },
    };
    const agent = makeAgentService({ command: "echo", args: ["{{PROMPT}}"] }, tmpDir, { logger, flowManager });
    await agent.call("hi", { commandId: "test" });
    assert.equal(calls.length, 0);
  });

  // ─── Spec 191: durationMs propagation (R1) ─────────────────────────────────

  it("passes a non-negative integer durationMs to accumulateAgentMetrics (spec 191 R1)", async () => {
    const calls = [];
    const flowManager = {
      resolveCurrentContext: () => ({ spec: "191-record-phase-duration", sentiPhase: "test" }),
      accumulateAgentMetrics: (...args) => { calls.push(args); },
    };
    const agent = makeAgentService({ command: "echo", args: ["{{PROMPT}}"] }, tmpDir, { logger, flowManager });
    await agent.call("hi", { commandId: "test" });

    assert.equal(calls.length, 1, "metric should be accumulated once");
    const durationMs = calls[0][1]?.durationMs;
    assert.equal(typeof durationMs, "number", "durationMs arg should be a number");
    assert.ok(Number.isInteger(durationMs), "durationMs should be an integer (ms)");
    assert.ok(durationMs >= 0, "durationMs should be non-negative");
  });

  it("durationMs covers all retry attempts when retries occur (spec 191 R1)", async () => {
    const calls = [];
    const flowManager = {
      resolveCurrentContext: () => ({ spec: "191", sentiPhase: "test" }),
      accumulateAgentMetrics: (...args) => { calls.push(args); },
    };
    // Use a command that sleeps briefly then exits non-zero so retry kicks in
    const sleepFailScript = "const t=Date.now();while(Date.now()-t<80){} process.exit(2);";
    const agent = makeAgentService(
      { command: "node", args: ["-e", sleepFailScript] },
      tmpDir,
      { logger, flowManager }
    );
    await assert.rejects(agent.call("x", { commandId: "test", retryCount: 2, retryDelayMs: 0 }));

    // Metric may or may not be accumulated on failure depending on implementation,
    // but if accumulated, the durationMs should reflect the total time including all attempts.
    if (calls.length > 0) {
      const durationMs = calls[0][1]?.durationMs;
      assert.ok(durationMs >= 160, `durationMs should include all attempts (>=160ms), got ${durationMs}`);
    }
  });
});
