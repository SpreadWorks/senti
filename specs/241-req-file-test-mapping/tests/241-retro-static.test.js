import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("R6: retro static evaluation from test-map.json", () => {
  it("should determine done when all tests pass", async () => {
    const { evaluateReqByResults } = await import("../../../src/flow/lib/req-map.js");

    const status = evaluateReqByResults({ passed: 2, failed: 0 });
    assert.strictEqual(status, "done");
  });

  it("should determine partial when some tests pass", async () => {
    const { evaluateReqByResults } = await import("../../../src/flow/lib/req-map.js");

    const status = evaluateReqByResults({ passed: 1, failed: 1 });
    assert.strictEqual(status, "partial");
  });

  it("should determine not_done when all tests fail", async () => {
    const { evaluateReqByResults } = await import("../../../src/flow/lib/req-map.js");

    const status = evaluateReqByResults({ passed: 0, failed: 2 });
    assert.strictEqual(status, "not_done");
  });

  it("should determine unverified when no tests are mapped", async () => {
    const { evaluateReqByResults } = await import("../../../src/flow/lib/req-map.js");

    const status = evaluateReqByResults(null);
    assert.strictEqual(status, "unverified");
  });

  it("should parse TAP output into per-test results", async () => {
    const { parseTapOutput } = await import("../../../src/flow/lib/req-map.js");

    const tap = [
      "TAP version 13",
      "ok 1 - should create file-map.json",
      "not ok 2 - should reject invalid reqId",
      "ok 3 - should deduplicate paths",
    ].join("\n");

    const results = parseTapOutput(tap);
    assert.strictEqual(results.get("should create file-map.json"), true);
    assert.strictEqual(results.get("should reject invalid reqId"), false);
    assert.strictEqual(results.get("should deduplicate paths"), true);
  });
});
