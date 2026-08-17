/**
 * specs/202-stabilize-agent-subprocess/tests/agent-stabilization.test.js
 *
 * Spec verification tests for issue #195 / spec 202.
 *
 *   - R3 (project-level): config.agent.retryCount flows through to the
 *        effective retry count used by _normalizeRetryOptionsForTest.
 *        Backoff delay grows with each attempt (exponential).
 *   - R4: empty response / non-zero exit are retried; timeout (SIGTERM)
 *        is terminal.
 *   - R1: stdin-fallback write error does not crash the Node process.
 *
 * Run with: node --test specs/202-stabilize-agent-subprocess/tests/agent-stabilization.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import os from "os";
import { Agent } from "../../../src/lib/agent.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent202-"));
}

function counterFile() {
  return path.join(os.tmpdir(), `agent202-count-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function makeAgent(profile, cfgExtra = {}) {
  const root = tmp();
  const config = {
    agent: {
      default: "test/exec",
      providers: { "test/exec": profile },
      timeout: 300,
      ...cfgExtra,
    },
  };
  const registry = new ProviderRegistry(config.agent.providers);
  return new Agent({
    config,
    paths: { root, agentWorkDir: path.join(root, ".tmp") },
    registry,
    logger: new Logger({ logDir: os.tmpdir(), enabled: false }),
  });
}

describe("spec 202 R3: config-driven retry + exponential backoff", () => {
  it("config.agent.retryCount flows through to normalized retry count", () => {
    const agent = makeAgent({ command: "echo", args: [""] }, { retryCount: 2 });
    const normalized = agent._normalizeRetryOptionsForTest({});
    assert.equal(normalized.retryCount, 2);
  });

  it("retries by default when config.agent.retryCount is set", async () => {
    const f = counterFile();
    const script = `
      const fs = require("fs");
      const p = ${JSON.stringify(f)};
      let n = 0;
      try { n = Number(fs.readFileSync(p, "utf8")); } catch {}
      n++;
      fs.writeFileSync(p, String(n));
      if (n < 2) process.exit(1);
      process.stdout.write("ok");
    `;
    const agent = makeAgent({ command: "node", args: ["-e", script] }, { retryCount: 2 });
    const result = await agent.call("", { commandId: "test", retryDelayMs: 10 });
    assert.equal(result, "ok");
    try { fs.unlinkSync(f); } catch {}
  });

  it("uses exponential backoff between attempts (delay grows)", async () => {
    const f = counterFile();
    const stampsFile = counterFile();
    const script = `
      const fs = require("fs");
      const p = ${JSON.stringify(f)};
      const sp = ${JSON.stringify(stampsFile)};
      let n = 0;
      try { n = Number(fs.readFileSync(p, "utf8")); } catch {}
      n++;
      fs.writeFileSync(p, String(n));
      fs.appendFileSync(sp, String(Date.now()) + "\\n");
      if (n < 3) process.exit(1);
      process.stdout.write("ok");
    `;
    const agent = makeAgent({ command: "node", args: ["-e", script] });
    const result = await agent.call("", { commandId: "test", retryCount: 2, retryDelayMs: 50 });
    assert.equal(result, "ok");
    const stamps = fs.readFileSync(stampsFile, "utf8").trim().split("\n").map(Number);
    assert.equal(stamps.length, 3);
    const d1 = stamps[1] - stamps[0];
    const d2 = stamps[2] - stamps[1];
    assert.ok(d2 > d1, `expected growing delay, got d1=${d1} d2=${d2}`);
    try { fs.unlinkSync(f); fs.unlinkSync(stampsFile); } catch {}
  });
});

describe("spec 202 R4: retryable vs terminal classification", () => {
  it("timeout (SIGTERM) is terminal and not retried", async () => {
    const f = counterFile();
    const script = `
      const fs = require("fs");
      const p = ${JSON.stringify(f)};
      let n = 0;
      try { n = Number(fs.readFileSync(p, "utf8")); } catch {}
      n++;
      fs.writeFileSync(p, String(n));
      setTimeout(() => {}, 5000);
    `;
    const agent = makeAgent(
      { command: "node", args: ["-e", script] },
      { timeout: 0.2 },
    );
    await assert.rejects(
      agent.call("", { commandId: "test", retryCount: 3, retryDelayMs: 10 }),
    );
    const n = Number(fs.readFileSync(f, "utf8"));
    assert.equal(n, 1, `timeout should be terminal (1 attempt), got ${n}`);
    try { fs.unlinkSync(f); } catch {}
  });

  it("empty response is retryable", async () => {
    const f = counterFile();
    const script = `
      const fs = require("fs");
      const p = ${JSON.stringify(f)};
      let n = 0;
      try { n = Number(fs.readFileSync(p, "utf8")); } catch {}
      n++;
      fs.writeFileSync(p, String(n));
      if (n < 2) process.stdout.write("");
      else process.stdout.write("ok");
    `;
    const agent = makeAgent({ command: "node", args: ["-e", script] });
    const result = await agent.call("", { commandId: "test", retryCount: 2, retryDelayMs: 10 });
    assert.equal(result, "ok");
    try { fs.unlinkSync(f); } catch {}
  });
});

describe("spec 202 R1: stdin-fallback error handling", () => {
  it("does not crash the Node process when child closes stdin early", async () => {
    const agent = makeAgent(
      { command: "node", args: ["-e", "process.exit(0)"] },
      { stdinFallbackThreshold: 10 },
    );
    const bigPrompt = "X".repeat(1024);
    try {
      await agent.call(bigPrompt, { commandId: "test", retryCount: 0 });
    } catch (err) {
      assert.ok(err, "error must be surfaced to caller");
    }
    assert.ok(true);
  });
});

describe("spec 202 R2: runText does not mutate process.exitCode", () => {
  it("runText body does not assign process.exitCode", () => {
    const src = fs.readFileSync("src/docs/commands/text.js", "utf8");
    const match = src.match(/(?:async\s+)?function runText\s*\([^)]*\)\s*\{([\s\S]*?)\n\}\s*\n/);
    assert.ok(match, "expected to locate runText function body");
    const body = match[1];
    assert.ok(
      !/process\.exitCode\s*=/.test(body),
      "runText body must not assign to process.exitCode (R2)",
    );
  });
});
