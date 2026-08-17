/**
 * Spec verification tests for 161-fix-log-usage-recording.
 *
 * Verifies that Logger.agent() correctly records usage data
 * (token counts, cache hits, cost) in both:
 *   - per-request JSON (prompts/YYYY-MM-DD/<requestId>.json)
 *   - JSONL end-event (sdd-forge-YYYY-MM-DD.jsonl)
 *
 * These tests are NOT part of `npm test` — run with:
 *   node --test specs/161-fix-log-usage-recording/tests/log-usage-recording.test.js
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

// Dynamic import from project root
const { Logger } = await import(path.join(ROOT, "src/lib/log.js"));

function todayLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function readJsonl(file) {
  return fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const SAMPLE_USAGE = {
  input_tokens: 100,
  output_tokens: 50,
  cache_read_tokens: 200,
  cache_creation_tokens: 10,
  cost_usd: 0.0025,
};

describe("Logger.agent — usage recording in per-request JSON", () => {
  let tmpDir;
  let logFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "logger-usage-json-"));
    logFile = path.join(tmpDir, `sdd-forge-${todayLocal()}.jsonl`);
    Logger._resetForTest();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    Logger._resetForTest();
  });

  it("records usage as top-level field in prompt JSON when entry.usage is provided", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: true, dir: tmpDir } }, { entryCommand: "test" });

    await inst.agent({
      phase: "end",
      requestId: "aabbccdd",
      agentKey: "claude",
      model: null,
      prompt: { user: "hello" },
      response: { text: "world", exitCode: 0 },
      durationSec: 1.5,
      usage: SAMPLE_USAGE,
    });

    const entries = readJsonl(logFile);
    const promptFile = path.resolve(tmpDir, entries[0].promptFile);
    assert.ok(fs.existsSync(promptFile), "prompt file should exist");

    const promptJson = JSON.parse(fs.readFileSync(promptFile, "utf8"));

    assert.ok("usage" in promptJson, "prompt JSON should have top-level 'usage' field");
    assert.equal(promptJson.usage.input_tokens, 100);
    assert.equal(promptJson.usage.output_tokens, 50);
    assert.equal(promptJson.usage.cache_read_tokens, 200);
    assert.equal(promptJson.usage.cache_creation_tokens, 10);
    assert.equal(promptJson.usage.cost_usd, 0.0025);
  });

  it("records usage: null in prompt JSON when entry.usage is null", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: true, dir: tmpDir } }, { entryCommand: "test" });

    await inst.agent({
      phase: "end",
      requestId: "11223344",
      agentKey: "claude",
      model: null,
      prompt: { user: "hello" },
      response: { text: "world", exitCode: 0 },
      durationSec: 0.5,
      usage: null,
    });

    const entries = readJsonl(logFile);
    const promptFile = path.resolve(tmpDir, entries[0].promptFile);
    const promptJson = JSON.parse(fs.readFileSync(promptFile, "utf8"));

    assert.ok("usage" in promptJson, "prompt JSON should have 'usage' field even when null");
    assert.equal(promptJson.usage, null);
  });

  it("records usage: null in prompt JSON when entry.usage is omitted", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: true, dir: tmpDir } }, { entryCommand: "test" });

    await inst.agent({
      phase: "end",
      requestId: "55667788",
      agentKey: "claude",
      model: null,
      prompt: { user: "hello" },
      response: { text: "world", exitCode: 0 },
      durationSec: 0.5,
    });

    const entries = readJsonl(logFile);
    const promptFile = path.resolve(tmpDir, entries[0].promptFile);
    const promptJson = JSON.parse(fs.readFileSync(promptFile, "utf8"));

    assert.ok("usage" in promptJson, "prompt JSON should have 'usage' field even when omitted");
    assert.equal(promptJson.usage, null);
  });
});

describe("Logger.agent — usage recording in JSONL end-event", () => {
  let tmpDir;
  let logFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "logger-usage-jsonl-"));
    logFile = path.join(tmpDir, `sdd-forge-${todayLocal()}.jsonl`);
    Logger._resetForTest();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    Logger._resetForTest();
  });

  it("records flat usage fields in JSONL end-event when entry.usage is provided", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: true, dir: tmpDir } }, { entryCommand: "test" });

    await inst.agent({
      phase: "end",
      requestId: "aabb1122",
      agentKey: "claude",
      model: null,
      prompt: { user: "hello" },
      response: { text: "world", exitCode: 0 },
      durationSec: 2.0,
      usage: SAMPLE_USAGE,
    });

    const entries = readJsonl(logFile);
    const e = entries[0];

    assert.equal(e.inputTokens, 100, "inputTokens should be recorded");
    assert.equal(e.outputTokens, 50, "outputTokens should be recorded");
    assert.equal(e.cacheReadTokens, 200, "cacheReadTokens should be recorded");
    assert.equal(e.cacheCreationTokens, 10, "cacheCreationTokens should be recorded");
    assert.equal(e.costUsd, 0.0025, "costUsd should be recorded");
  });

  it("omits usage fields from JSONL end-event when entry.usage is null", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: true, dir: tmpDir } }, { entryCommand: "test" });

    await inst.agent({
      phase: "end",
      requestId: "ccdd3344",
      agentKey: "claude",
      model: null,
      prompt: { user: "hello" },
      response: { text: "world", exitCode: 0 },
      durationSec: 0.5,
      usage: null,
    });

    const entries = readJsonl(logFile);
    const e = entries[0];

    assert.ok(!("inputTokens" in e), "inputTokens should not be present when usage is null");
    assert.ok(!("outputTokens" in e), "outputTokens should not be present when usage is null");
    assert.ok(!("cacheReadTokens" in e), "cacheReadTokens should not be present when usage is null");
    assert.ok(!("cacheCreationTokens" in e), "cacheCreationTokens should not be present when usage is null");
    assert.ok(!("costUsd" in e), "costUsd should not be present when usage is null");
  });

  it("omits usage fields from JSONL end-event when entry.usage is omitted", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: true, dir: tmpDir } }, { entryCommand: "test" });

    await inst.agent({
      phase: "end",
      requestId: "eeff5566",
      agentKey: "claude",
      model: null,
      prompt: { user: "hello" },
      response: { text: "world", exitCode: 0 },
      durationSec: 0.5,
    });

    const entries = readJsonl(logFile);
    const e = entries[0];

    assert.ok(!("inputTokens" in e), "inputTokens should not be present when usage is omitted");
    assert.ok(!("outputTokens" in e), "outputTokens should not be present when usage is omitted");
    assert.ok(!("cacheReadTokens" in e), "cacheReadTokens should not be present when usage is omitted");
    assert.ok(!("cacheCreationTokens" in e), "cacheCreationTokens should not be present when usage is omitted");
    assert.ok(!("costUsd" in e), "costUsd should not be present when usage is omitted");
  });
});
