/**
 * Spec verification tests: 148-save-agent-prompt-logs
 *
 * Tests for AgentLog class and callAgent/callAgentAsync logging integration.
 * Requirements covered: 1, 2, 3, 4, 5, 6, 7, 8, 9
 */

import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { AgentLog } from "../../../src/lib/agent-log.js";
import { callAgent } from "../../../src/lib/agent.js";

// ---------------------------------------------------------------------------
// AgentLog class unit tests
// ---------------------------------------------------------------------------

describe("AgentLog", () => {
  it("initializes with spec and phase", () => {
    const log = new AgentLog({ spec: "148-test", phase: "spec" });
    assert.equal(log.spec, "148-test");
    assert.equal(log.phase, "spec");
  });

  it("initializes with null defaults when not provided", () => {
    const log = new AgentLog();
    assert.equal(log.spec, null);
    assert.equal(log.phase, null);
  });

  it("toJSON returns all required fields", () => {
    const log = new AgentLog({ spec: "148-test", phase: "draft" });
    log.executeStartAt = new Date("2026-04-06T10:00:00.000Z");
    log.executeEndAt = new Date("2026-04-06T10:01:30.000Z");
    log.executeTime = 90;
    log.prompt = "test prompt";

    const entry = log.toJSON();
    assert.ok("executeStartAt" in entry, "missing executeStartAt");
    assert.ok("executeEndAt" in entry, "missing executeEndAt");
    assert.ok("executeTime" in entry, "missing executeTime");
    assert.ok("spec" in entry, "missing spec");
    assert.ok("phase" in entry, "missing phase");
    assert.ok("prompt" in entry, "missing prompt");

    assert.equal(entry.spec, "148-test");
    assert.equal(entry.phase, "draft");
    assert.equal(entry.prompt, "test prompt");
    assert.equal(entry.executeTime, 90);
  });
});

// ---------------------------------------------------------------------------
// Integration tests: callAgent + AgentLog
// ---------------------------------------------------------------------------

/** Minimal agent config that runs `node -e "process.stdout.write('ok')"` */
function makeEchoAgent() {
  return { command: "node", args: ["-e", "process.stdout.write('ok')"] };
}

/** Minimal agent config that always fails */
function makeFailAgent() {
  return { command: "node", args: ["-e", "process.exit(1)"] };
}

/** Read log file lines as parsed JSON objects */
function readLogEntries(logPath) {
  if (!fs.existsSync(logPath)) return [];
  return fs
    .readFileSync(logPath, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

describe("callAgent + AgentLog logging", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  // Requirement 1: logs.prompts=true → entry appended
  it("req1: appends log entry when logs.prompts is true and AgentLog provided", () => {
    tmp = createTmpDir();
    const logDir = path.join(tmp, "logs");
    const logFile = path.join(logDir, "prompts.jsonl");
    const cfg = { logs: { prompts: true, dir: logDir } };

    const agentLog = new AgentLog({ spec: "148", phase: "test" });
    callAgent(makeEchoAgent(), "hello", null, tmp, {}, agentLog, cfg);

    const entries = readLogEntries(logFile);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].prompt, "hello");
    assert.equal(entries[0].spec, "148");
    assert.equal(entries[0].phase, "test");
    assert.ok(entries[0].executeStartAt, "missing executeStartAt");
    assert.ok(entries[0].executeEndAt, "missing executeEndAt");
    assert.equal(typeof entries[0].executeTime, "number");
  });

  // Requirement 2: logs.prompts=false → no log
  it("req2: no log file created when logs.prompts is false", () => {
    tmp = createTmpDir();
    const logDir = path.join(tmp, "logs");
    const logFile = path.join(logDir, "prompts.jsonl");
    const cfg = { logs: { prompts: false, dir: logDir } };

    const agentLog = new AgentLog({ spec: "148", phase: "test" });
    callAgent(makeEchoAgent(), "hello", null, tmp, {}, agentLog, cfg);

    assert.equal(fs.existsSync(logFile), false);
  });

  // Requirement 2: logs absent → no log
  it("req2: no log file created when logs config is absent", () => {
    tmp = createTmpDir();
    const logDir = path.join(tmp, "logs");
    const logFile = path.join(logDir, "prompts.jsonl");
    const cfg = {};

    const agentLog = new AgentLog({ spec: "148", phase: "test" });
    callAgent(makeEchoAgent(), "hello", null, tmp, {}, agentLog, cfg);

    assert.equal(fs.existsSync(logFile), false);
  });

  // Requirement 3: AgentLog not passed → no log
  it("req3: no log file created when AgentLog is not passed", () => {
    tmp = createTmpDir();
    const logDir = path.join(tmp, "logs");
    const logFile = path.join(logDir, "prompts.jsonl");
    const cfg = { logs: { prompts: true, dir: logDir } };

    callAgent(makeEchoAgent(), "hello", null, tmp, {}, null, cfg);

    assert.equal(fs.existsSync(logFile), false);
  });

  // Requirement 5: logs.dir sets output path
  it("req5: custom logs.dir writes to specified path", () => {
    tmp = createTmpDir();
    const customDir = path.join(tmp, "custom", "logs");
    const logFile = path.join(customDir, "prompts.jsonl");
    const cfg = { logs: { prompts: true, dir: customDir } };

    const agentLog = new AgentLog({ spec: "148", phase: "test" });
    callAgent(makeEchoAgent(), "hello", null, tmp, {}, agentLog, cfg);

    assert.ok(fs.existsSync(logFile), "log file not found at custom path");
  });

  // Requirement 6: agent failure → log still appended
  it("req6: log entry is appended even when agent fails", () => {
    tmp = createTmpDir();
    const logDir = path.join(tmp, "logs");
    const logFile = path.join(logDir, "prompts.jsonl");
    const cfg = { logs: { prompts: true, dir: logDir } };

    const agentLog = new AgentLog({ spec: "148", phase: "test" });
    assert.throws(() => callAgent(makeFailAgent(), "hello", null, tmp, {}, agentLog, cfg));

    const entries = readLogEntries(logFile);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].prompt, "hello");
    assert.ok(entries[0].executeStartAt, "missing executeStartAt");
  });

  // Requirement 7: logs/ dir created automatically
  it("req7: logs directory is created automatically if not exists", () => {
    tmp = createTmpDir();
    const logDir = path.join(tmp, "nonexistent", "logs");
    const cfg = { logs: { prompts: true, dir: logDir } };

    const agentLog = new AgentLog({ spec: "148", phase: "test" });
    callAgent(makeEchoAgent(), "hello", null, tmp, {}, agentLog, cfg);

    assert.ok(fs.existsSync(logDir), "log directory was not created");
  });

  // Requirement 4: log entry format — ISO 8601 dates
  it("req4: log entry dates are ISO 8601 strings", () => {
    tmp = createTmpDir();
    const logDir = path.join(tmp, "logs");
    const logFile = path.join(logDir, "prompts.jsonl");
    const cfg = { logs: { prompts: true, dir: logDir } };

    const agentLog = new AgentLog({ spec: "148", phase: "test" });
    callAgent(makeEchoAgent(), "hello", null, tmp, {}, agentLog, cfg);

    const entries = readLogEntries(logFile);
    const entry = entries[0];
    assert.doesNotThrow(() => new Date(entry.executeStartAt).toISOString());
    assert.doesNotThrow(() => new Date(entry.executeEndAt).toISOString());
  });

  // Requirement 8: multiple appends (unbounded)
  it("req8: multiple calls append multiple entries (unbounded)", () => {
    tmp = createTmpDir();
    const logDir = path.join(tmp, "logs");
    const logFile = path.join(logDir, "prompts.jsonl");
    const cfg = { logs: { prompts: true, dir: logDir } };

    for (let i = 0; i < 3; i++) {
      const agentLog = new AgentLog({ spec: "148", phase: "test" });
      callAgent(makeEchoAgent(), `prompt-${i}`, null, tmp, {}, agentLog, cfg);
    }

    const entries = readLogEntries(logFile);
    assert.equal(entries.length, 3);
  });

  // Requirement 9: write failure → no throw, stderr output
  it("req9: log write failure does not throw and returns agent result", () => {
    tmp = createTmpDir();
    // Make log dir a file (not a directory) to force write failure
    const logDir = path.join(tmp, "logs");
    fs.writeFileSync(logDir, "not-a-directory");
    const cfg = { logs: { prompts: true, dir: logDir } };

    const agentLog = new AgentLog({ spec: "148", phase: "test" });
    let result;
    assert.doesNotThrow(() => {
      result = callAgent(makeEchoAgent(), "hello", null, tmp, {}, agentLog, cfg);
    });
    assert.equal(result, "ok");
  });
});
