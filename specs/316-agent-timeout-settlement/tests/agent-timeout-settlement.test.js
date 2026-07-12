// spec: R1 R2 R3 R4 R5 R6
import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Agent, AgentTimeoutError } from "../../../src/lib/agent.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";

const tempDirs = [];
const TEST_CLEANUP_MARGIN_MS = 200;
after(() => {
  for (const dir of tempDirs.splice(0)) {
    const pids = path.join(dir, "pids.json");
    if (fs.existsSync(pids)) for (const pid of JSON.parse(fs.readFileSync(pids, "utf8"))) {
      try { process.kill(pid, "SIGKILL"); } catch (_) {}
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "senti-316-")); tempDirs.push(dir); return dir; }
function agentFor({ command, args, root: suppliedRoot, timeout = 0.05, threshold = 100_000, extra = {}, logger, flowManager, supervision }) {
  const root = suppliedRoot || tempDir();
  const config = { agent: { default: "test/fixture", timeout, stdinFallbackThreshold: threshold, providers: { "test/fixture": { command, args, ...extra } } } };
  return new Agent({ config, paths: { root, agentWorkDir: path.join(root, ".tmp") }, registry: new ProviderRegistry(config.agent.providers), logger: logger || new Logger({ logDir: root, enabled: false }), flowManager, supervision });
}
function ignoringTree(pidsPath) {
  return `const fs=require("fs"),{spawn}=require("child_process");const a=spawn(process.execPath,["-e","process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"]);const b=spawn(process.execPath,["-e","process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"]);fs.writeFileSync(process.argv[1],JSON.stringify([process.pid,a.pid,b.pid]));process.on("SIGTERM",()=>{});setInterval(()=>{},1000);`;
}
function assertNotRunning(pid) {
  try {
    process.kill(pid, 0);
    const state = fs.readFileSync(`/proc/${pid}/stat`, "utf8").split(" ")[2];
    assert.equal(state, "Z", `PID ${pid} must be absent or a non-running zombie`);
  } catch (error) {
    assert.equal(error.code, "ESRCH");
  }
}
async function timeoutError(agent, commandId, events = []) {
  let thrown;
  const started = Date.now();
  try { await agent.call("", { commandId, retryCount: 0, onSupervisorEvent: (event) => events.push(event) }); } catch (error) { thrown = error; }
  assert.ok(thrown instanceof AgentTimeoutError, "deadline-owned call must reject as AgentTimeoutError");
  return { error: thrown, elapsed: Date.now() - started, events };
}

test("R1: POSIX supervision uses a detached group and TERM-to-KILL escalation", async () => {
  const root = tempDir(); const pids = path.join(root, "pids.json");
  const events = [];
  await timeoutError(agentFor({ command: process.execPath, args: ["-e", ignoringTree(pids), pids] }), "spec.316.r1", events);
  if (process.platform !== "win32") {
    assert.deepEqual(events.filter(({ type }) => type === "signal").map(({ signal, target }) => [signal, target]), [["SIGTERM", "process-group"], ["SIGKILL", "process-group"]]);
    assert.equal(events.find(({ type }) => type === "spawn")?.detached, true);
  }
});

test("R2: supervisor arbitrates terminal events and releases listeners and timers", async () => {
  const events = [];
  const { error } = await timeoutError(agentFor({ command: process.execPath, args: ["-e", "process.on('SIGTERM',()=>{});setTimeout(()=>process.exit(0),80)"] }), "spec.316.r2", events);
  assert.equal(error.code, "AGENT_TIMEOUT");
  assert.equal(events.filter(({ type }) => type === "timeout").length, 1);
  assert.equal(events.filter(({ type }) => type === "close").length, 1);
  assert.equal(events.filter(({ type }) => type === "settled").length, 1);
  const cleanup = events.find(({ type }) => type === "cleanup");
  assert.deepEqual(cleanup, { type: "cleanup", closeListeners: 0, errorListeners: 0, activeTimers: 0 });
  assert.equal(events.some(({ type }) => type === "grace-expiry"), false, "a closed and dead tree settles without treating grace expiry as cleanup");
});

test("R3: timeout error exposes final action and bounded timing while ordinary failures stay ordinary", async () => {
  const timed = await timeoutError(agentFor({ command: process.execPath, args: ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], timeout: 0.2 }), "spec.316.r3-timeout");
  assert.equal(timed.error.code, "AGENT_TIMEOUT");
  assert.equal(timed.error.killed, true);
  assert.equal(timed.error.finalAction, process.platform === "win32" ? "taskkill /T /F" : "SIGKILL");
  assert.ok(timed.elapsed <= timed.error.timeoutMs + timed.error.graceMs + TEST_CLEANUP_MARGIN_MS);
  await assert.rejects(agentFor({ command: process.execPath, args: ["-e", "process.exit(7)"], timeout: 2 }).call("", { commandId: "spec.316.r3-exit", retryCount: 0 }), (error) => error.code === 7 && !(error instanceof AgentTimeoutError));
  await assert.rejects(agentFor({ command: "senti-316-no-command", args: [] }).call("", { commandId: "spec.316.r3-spawn", retryCount: 0 }), (error) => !(error instanceof AgentTimeoutError));
});

test("R4: timeout waits for direct close and complete descendant tree death", async () => {
  const root = tempDir(); const pids = path.join(root, "pids.json");
  const events = [];
  await timeoutError(agentFor({ command: process.execPath, args: ["-e", ignoringTree(pids), pids], timeout: 0.2 }), "spec.316.r4", events);
  for (const pid of JSON.parse(fs.readFileSync(pids, "utf8"))) assertNotRunning(pid);
  assert.ok(events.some(({ type }) => type === "close"));
  assert.ok(events.some(({ type }) => type === "tree-dead"));
  assert.ok(["ESRCH", "taskkill-complete"].includes(events.find(({ type }) => type === "tree-dead")?.probe));
});

test("R5: exit immediately after deadline rejects by code instead of returning a close result", async () => {
  const events = [];
  const { error } = await timeoutError(agentFor({ command: process.execPath, args: ["-e", "process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000)"] }), "spec.316.r5-race", events);
  assert.equal(error.code, "AGENT_TIMEOUT");
  assert.ok(events.findIndex(({ type }) => type === "timeout") < events.findIndex(({ type }) => type === "close"));
});

test("R5: SIGTERM-ignoring child is mapped to the timeout scenario", async () => {
  const root = tempDir(); const pids = path.join(root, "pids.json");
  const { error } = await timeoutError(agentFor({ command: process.execPath, args: ["-e", ignoringTree(pids), pids] }), "spec.316.r5-ignore");
  assert.equal(error.code, "AGENT_TIMEOUT");
});

test("R5: spawn errors retain their ordinary non-timeout failure behavior", async () => {
  await assert.rejects(agentFor({ command: "senti-316-r5-missing", args: [] }).call("", { commandId: "spec.316.r5-spawn", retryCount: 0 }), (error) => error.code !== "AGENT_TIMEOUT");
});

test("R5: descendant termination is mapped to the timeout scenario inventory", async () => {
  const root = tempDir(); const pids = path.join(root, "pids.json");
  await timeoutError(agentFor({ command: process.execPath, args: ["-e", ignoringTree(pids), pids], timeout: 0.2 }), "spec.316.r5-descendant");
  for (const pid of JSON.parse(fs.readFileSync(pids, "utf8"))) assertNotRunning(pid);
});

test("R1 R4: injected win32 provider spawn waits for direct close and taskkill completion", async () => {
  const taskkillCalls = []; const events = [];
  const agent = agentFor({
    command: process.execPath,
    args: ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],
    timeout: 0.2,
    supervision: {
      platform: "win32",
      runTaskkill: async (args) => {
        taskkillCalls.push(args);
        process.kill(Number(args[1]), "SIGKILL");
        return { completed: true };
      },
    },
  });
  await timeoutError(agent, "spec.316.win32", events);
  assert.deepEqual(taskkillCalls, [["/PID", String(events.find(({ type }) => type === "spawn").pid), "/T", "/F"]]);
  assert.equal(events.find(({ type }) => type === "spawn")?.detached, false);
  assert.equal(events.find(({ type }) => type === "taskkill")?.completed, true);
  assert.ok(events.findIndex(({ type }) => type === "taskkill") < events.findIndex(({ type }) => type === "close"));
  assert.equal(events.find(({ type }) => type === "tree-dead")?.probe, "taskkill-complete");
});

test("R6: timeout resolution and JSON provider result remain executable", async () => {
  const agent = agentFor({ command: process.execPath, args: ["-e", "process.stdout.write(JSON.stringify({result:'json-ok'}),()=>process.exit(0))"], timeout: 2 });
  assert.equal(agent.resolve("spec.316.r6-json").timeoutMs, 2000);
  assert.deepEqual(JSON.parse(await agent.call("", { commandId: "spec.316.r6-json", retryCount: 0 })), { result: "json-ok" });
});

test("R6: retry, callbacks, logging, metrics, cache, and schema cleanup remain executable", async () => {
  const root = tempDir(); const attempts = path.join(root, "attempts"); const events = []; const metrics = [];
  const script = `const fs=require('fs');const f=process.argv[1];let n=fs.existsSync(f)?Number(fs.readFileSync(f)):0;fs.writeFileSync(f,String(++n));if(n===1)process.exit(1);process.stderr.write('stderr');process.stdout.write('ok',()=>process.exit(0))`;
  const logger = new Logger({ logDir: root, enabled: true });
  const flowManager = {
    resolveCurrentContext: () => ({ spec: "316-agent-timeout-settlement", sentiPhase: "test" }),
    loadActiveFlows: () => [{ spec: "316-agent-timeout-settlement" }],
    accumulateAgentMetrics: (...args) => metrics.push(args),
    appendMetric: (...args) => metrics.push(args),
  };
  const agent = agentFor({ command: process.execPath, args: ["-e", script, attempts], root, timeout: 2, logger, flowManager });
  assert.equal(await agent.call("", { commandId: "spec.316.r6-surfaces", retryCount: 1, retryDelayMs: 1, onStdout: (v) => events.push(v), onStderr: (v) => events.push(v) }), "ok");
  assert.equal(fs.readFileSync(attempts, "utf8"), "2");
  assert.deepEqual(events, ["stderr", "ok"]);
  await logger.flush();
  const log = fs.readFileSync(path.join(root, `senti-${new Date().toISOString().slice(0, 10)}.jsonl`), "utf8");
  assert.match(log, /"phase":"start"/); assert.match(log, /"phase":"end"/);
  assert.ok(metrics.some(([phase]) => phase === "test"));
  assert.equal(await agent.call("", { commandId: "spec.316.r6-surfaces", retryCount: 1 }), "ok");
  assert.equal(fs.readFileSync(attempts, "utf8"), "2", "the real prompt cache prevents a second provider spawn");
  assert.ok(fs.existsSync(path.join(root, ".senti", "agent-cache", "316-agent-timeout-settlement.json")));

  const schemaSeen = path.join(root, "schema-seen");
  const schemaAgent = agentFor({ command: process.execPath, args: ["-e", `const fs=require('fs');fs.writeFileSync(process.argv[1],process.argv.at(-1));process.stdout.write('schema-ok',()=>process.exit(0))`, schemaSeen], timeout: 2, extra: { jsonSchemaFlag: "--schema", jsonSchemaMode: "file" } });
  assert.equal(await schemaAgent.call("", { commandId: "spec.316.r6-schema", jsonSchema: { type: "object" } }), "schema-ok");
  const schemaPath = fs.readFileSync(schemaSeen, "utf8");
  assert.equal(fs.existsSync(schemaPath), false, "the production schema cleanup removes the generated schema file");
});

test("R6: Agent.call retains invocation, output, callbacks, retry, stdin, logging, cache, schema, and error behavior", async () => {
  const events = []; const agent = agentFor({ command: process.execPath, args: ["-e", "process.stdout.write(process.argv[1],()=>process.exit(0))", "{{PROMPT}}"], timeout: 2 });
  assert.deepEqual(agent._buildInvocationForTest("abc", { commandId: "spec.316.r6" }).finalArgs.slice(-1), ["abc"]);
  assert.equal(await agent.call("abc", { commandId: "spec.316.r6", onStdout: (chunk) => events.push(chunk) }), "abc");
  assert.deepEqual(events, ["abc"]);
  assert.equal(await agentFor({ command: "cat", args: [], threshold: 8 }).call("large-input", { commandId: "spec.316.r6-stdin" }), "large-input");
  await assert.rejects(agentFor({ command: process.execPath, args: ["-e", "process.exit(2)"] }).call("", { commandId: "spec.316.r6-error" }), (error) => error.code === 2);
});
