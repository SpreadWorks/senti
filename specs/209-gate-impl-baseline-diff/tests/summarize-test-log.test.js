/**
 * Spec 209 verification: summarize-test-log モジュール
 *
 * Verifies:
 * - REQ-2: agent.call() の結果を JSON 検証してから返す
 * - REQ-3: agent 失敗時に throw せず { ok: false, reason } を返す
 * - REQ-2: 入力ログを 256KB に切り詰める
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeTestLog } from "../../../src/flow/lib/summarize-test-log.js";

function makeFakeAgent(responseText) {
  return {
    resolve: () => true,
    call: async () => responseText,
  };
}

function makeErroringAgent(err) {
  return {
    resolve: () => true,
    call: async () => { throw err; },
  };
}

describe("spec 209: summarizeTestLog", () => {
  it("returns parsed failed[] on valid agent JSON", async () => {
    const agent = makeFakeAgent(JSON.stringify({
      failed: [{ id: "test_a", reason: "AssertionError" }],
    }));
    const res = await summarizeTestLog({
      agent,
      log: "FAIL test_a\nAssertionError",
      exitCode: 1,
      counts: { unit: 5, failed: 1 },
    });
    assert.equal(res.ok, true);
    assert.equal(res.failed.length, 1);
    assert.equal(res.failed[0].id, "test_a");
  });

  it("returns ok=false on invalid JSON", async () => {
    const agent = makeFakeAgent("not a json");
    const res = await summarizeTestLog({
      agent,
      log: "x", exitCode: 1, counts: {},
    });
    assert.equal(res.ok, false);
    assert.match(res.reason, /parse|invalid/i);
  });

  it("returns ok=false on agent throw", async () => {
    const agent = makeErroringAgent(new Error("agent timeout"));
    const res = await summarizeTestLog({
      agent,
      log: "x", exitCode: 1, counts: {},
    });
    assert.equal(res.ok, false);
    assert.match(res.reason, /agent timeout/);
  });

  it("returns ok=false when schema violated (empty id)", async () => {
    const agent = makeFakeAgent(JSON.stringify({
      failed: [{ id: "", reason: "x" }],
    }));
    const res = await summarizeTestLog({
      agent,
      log: "x", exitCode: 1, counts: {},
    });
    assert.equal(res.ok, false);
  });

  it("truncates log to 256KB before calling agent", async () => {
    const bigLog = "x".repeat(600 * 1024); // 600KB
    let receivedPrompt = null;
    const agent = {
      resolve: () => true,
      call: async (prompt) => {
        receivedPrompt = prompt;
        return JSON.stringify({ failed: [] });
      },
    };
    await summarizeTestLog({
      agent,
      log: bigLog,
      exitCode: 0,
      counts: { unit: 10 },
    });
    // prompt should contain log but trimmed; total prompt size should be well under 300KB
    assert.ok(receivedPrompt.length < 300 * 1024, `prompt size ${receivedPrompt.length} exceeds 300KB`);
  });

  it("truncates reason to 500 chars per entry", async () => {
    const longReason = "y".repeat(800);
    const agent = makeFakeAgent(JSON.stringify({
      failed: [{ id: "t1", reason: longReason }],
    }));
    const res = await summarizeTestLog({
      agent, log: "x", exitCode: 1, counts: {},
    });
    assert.equal(res.ok, true);
    assert.equal(res.failed[0].reason.length, 500);
  });

  it("caps failed[] at 100 entries", async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ id: `t${i}`, reason: "r" }));
    const agent = makeFakeAgent(JSON.stringify({ failed: many }));
    const res = await summarizeTestLog({
      agent, log: "x", exitCode: 1, counts: {},
    });
    assert.equal(res.ok, true);
    assert.equal(res.failed.length, 100);
  });
});
