/**
 * specs/207-unify-taskid-in-logs/tests/logger-taskid.test.js
 *
 * Spec verification: Logger's JSONL entries (agent end, git, event) carry
 * a taskId field that is resolved from the injected FlowManager.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { Logger } from "../../../src/lib/log.js";
import { todayLocal, readJsonl } from "../../../tests/helpers/log-fixtures.js";

function buildLogger(tmpDir, flowManager = null) {
  return new Logger({
    logDir: tmpDir,
    enabled: true,
    entryCommand: "test",
    flowManager,
    cwd: tmpDir,
  });
}

function stubFlowManager({ spec = null, sddPhase = null, taskId = null } = {}) {
  return {
    resolveCurrentContext: () => ({ spec, sddPhase, taskId }),
  };
}

describe("Logger taskId propagation", () => {
  let tmp;
  let logFile;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "logger-tid-"));
    logFile = path.join(tmp, `sdd-forge-${todayLocal()}.jsonl`);
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("agent end event includes taskId from flow context", async () => {
    const fm = stubFlowManager({ spec: "042-x", sddPhase: "impl", taskId: "T1" });
    const logger = buildLogger(tmp, fm);
    await logger.agent({
      phase: "end",
      requestId: "deadbeef",
      agentKey: "claude",
      model: "opus",
      prompt: { system: "s", user: "u" },
      response: { text: "r", exitCode: 0 },
      durationSec: 1,
    });
    await logger.flush();
    const lines = readJsonl(logFile);
    const end = lines.find((l) => l.type === "agent" && l.phase === "end");
    assert.ok(end);
    assert.equal(end.taskId, "T1");
  });

  it("agent end event has taskId=null when no active task", async () => {
    const fm = stubFlowManager({ spec: "042-x", sddPhase: "impl", taskId: null });
    const logger = buildLogger(tmp, fm);
    await logger.agent({
      phase: "end",
      requestId: "cafebabe",
      prompt: { user: "u" },
      response: { text: "r" },
    });
    await logger.flush();
    const end = readJsonl(logFile).find((l) => l.type === "agent" && l.phase === "end");
    assert.equal(end.taskId, null);
  });

  it("git event includes taskId", async () => {
    const fm = stubFlowManager({ taskId: "T2" });
    const logger = buildLogger(tmp, fm);
    await logger.git({ cmd: ["status"], exitCode: 0, stderr: "" });
    await logger.flush();
    const entry = readJsonl(logFile).find((l) => l.type === "git");
    assert.equal(entry.taskId, "T2");
  });

  it("event() includes taskId", async () => {
    const fm = stubFlowManager({ taskId: "T3" });
    const logger = buildLogger(tmp, fm);
    await logger.event("custom", { foo: "bar" });
    await logger.flush();
    const entry = readJsonl(logFile).find((l) => l.type === "event");
    assert.equal(entry.taskId, "T3");
  });

  it("no flowManager → taskId=null", async () => {
    const logger = buildLogger(tmp, null);
    await logger.event("custom", {});
    await logger.flush();
    const entry = readJsonl(logFile).find((l) => l.type === "event");
    assert.equal(entry.taskId, null);
  });
});
