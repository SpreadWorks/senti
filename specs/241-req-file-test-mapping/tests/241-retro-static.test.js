import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("R6: retro static evaluation from test-map.json", () => {
  it("should determine done when all tests pass", async () => {
    const { evaluateRequirement } = await import("../../../src/flow/lib/req-map.js");

    const tapResults = new Map([
      ["241-set-files.test.js > should create file-map.json", true],
      ["241-set-files.test.js > should append paths", true],
    ]);

    const tests = [
      "241-set-files.test.js > should create file-map.json",
      "241-set-files.test.js > should append paths",
    ];

    const status = evaluateRequirement(tests, tapResults);
    assert.strictEqual(status, "done");
  });

  it("should determine partial when some tests pass", async () => {
    const { evaluateRequirement } = await import("../../../src/flow/lib/req-map.js");

    const tapResults = new Map([
      ["test1", true],
      ["test2", false],
    ]);

    const status = evaluateRequirement(["test1", "test2"], tapResults);
    assert.strictEqual(status, "partial");
  });

  it("should determine not_done when all tests fail", async () => {
    const { evaluateRequirement } = await import("../../../src/flow/lib/req-map.js");

    const tapResults = new Map([
      ["test1", false],
      ["test2", false],
    ]);

    const status = evaluateRequirement(["test1", "test2"], tapResults);
    assert.strictEqual(status, "not_done");
  });

  it("should determine unverified when no tests are mapped", async () => {
    const { evaluateRequirement } = await import("../../../src/flow/lib/req-map.js");

    const tapResults = new Map();
    const status = evaluateRequirement([], tapResults);
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
