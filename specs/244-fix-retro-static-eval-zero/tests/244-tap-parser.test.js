import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("244: Fix retro static eval zero", () => {
  describe("R1: parseTapOutput handles indented subtests", () => {
    it("R1: captures indented ok/not ok lines from nested TAP output", async () => {
      const { parseTapOutput } = await import("../../../src/flow/lib/req-map.js");
      const tap = [
        "TAP version 13",
        "# Subtest: 244: Fix retro static eval",
        "    # Subtest: R1: parseTapOutput handles indent",
        "    ok 1 - R1: parseTapOutput handles indent",
        "      ---",
        "      duration_ms: 1.5",
        "      type: 'test'",
        "      ...",
        "    not ok 2 - R1: parseTapOutput rejects bad input",
        "      ---",
        "      duration_ms: 0.8",
        "      ...",
        "    1..2",
        "ok 1 - 244: Fix retro static eval",
        "  ---",
        "  duration_ms: 5.0",
        "  ...",
        "1..1",
      ].join("\n");

      const results = parseTapOutput(tap);
      assert.strictEqual(results.get("R1: parseTapOutput handles indent"), true);
      assert.strictEqual(results.get("R1: parseTapOutput rejects bad input"), false);
    });

    it("R1: captures 8-space indented subtests (double nesting)", async () => {
      const { parseTapOutput } = await import("../../../src/flow/lib/req-map.js");
      const tap = [
        "TAP version 13",
        "# Subtest: outer",
        "    # Subtest: middle",
        "        # Subtest: R1: deep nested test",
        "        ok 1 - R1: deep nested test",
        "        1..1",
        "    ok 1 - middle",
        "    1..1",
        "ok 1 - outer",
        "1..1",
      ].join("\n");

      const results = parseTapOutput(tap);
      assert.strictEqual(results.get("R1: deep nested test"), true);
    });
  });

  describe("R2: parseTapOutput handles TAP directives", () => {
    it("R2: strips # SKIP directive and excludes from results", async () => {
      const { parseTapOutput } = await import("../../../src/flow/lib/req-map.js");
      const tap = [
        "    ok 1 - R2: normal test",
        "    ok 2 - R2: skipped test # SKIP not implemented",
      ].join("\n");

      const results = parseTapOutput(tap);
      assert.strictEqual(results.get("R2: normal test"), true);
      assert.strictEqual(results.has("R2: skipped test"), false);
    });

    it("R2: strips # TODO directive from test name", async () => {
      const { parseTapOutput } = await import("../../../src/flow/lib/req-map.js");
      const tap = [
        "    not ok 1 - R2: pending feature # TODO not yet done",
      ].join("\n");

      const results = parseTapOutput(tap);
      assert.strictEqual(results.has("R2: pending feature"), true);
      assert.strictEqual(results.get("R2: pending feature"), false);
    });
  });

  describe("R3: requirement-ID-based mapping", () => {
    it("R3: extractReqResults groups TAP results by requirement ID", async () => {
      const { extractReqResults } = await import("../../../src/flow/lib/req-map.js");
      const tapResults = new Map([
        ["R1: test A passes", true],
        ["R1: test B passes", true],
        ["R2: test C fails", false],
        ["R2: test D passes", true],
        ["R3: test E passes", true],
      ]);

      const reqResults = extractReqResults(tapResults);
      assert.deepStrictEqual(reqResults.get("R1"), { passed: 2, failed: 0 });
      assert.deepStrictEqual(reqResults.get("R2"), { passed: 1, failed: 1 });
      assert.deepStrictEqual(reqResults.get("R3"), { passed: 1, failed: 0 });
    });

    it("R3: evaluateRequirement uses reqResults for done/partial/not_done", async () => {
      const { evaluateReqByResults } = await import("../../../src/flow/lib/req-map.js");

      assert.strictEqual(evaluateReqByResults({ passed: 3, failed: 0 }), "done");
      assert.strictEqual(evaluateReqByResults({ passed: 1, failed: 1 }), "partial");
      assert.strictEqual(evaluateReqByResults({ passed: 0, failed: 2 }), "not_done");
    });

    it("R3: evaluateReqByResults returns unverified for null/undefined", async () => {
      const { evaluateReqByResults } = await import("../../../src/flow/lib/req-map.js");

      assert.strictEqual(evaluateReqByResults(null), "unverified");
      assert.strictEqual(evaluateReqByResults(undefined), "unverified");
    });
  });

  describe("R4: test-map.json file identification preserved", () => {
    it("R4: test-map entry split(' > ')[0] still extracts filename", async () => {
      const entry = "244-tap-parser.test.js > R1: captures indented lines";
      const file = entry.split(" > ")[0]?.trim();
      assert.strictEqual(file, "244-tap-parser.test.js");
    });
  });

  describe("R5: fallback when no requirement IDs in TAP output", () => {
    it("R5: extractReqResults returns empty map when no R-prefix found", async () => {
      const { extractReqResults } = await import("../../../src/flow/lib/req-map.js");
      const tapResults = new Map([
        ["should create file", true],
        ["should validate input", false],
      ]);

      const reqResults = extractReqResults(tapResults);
      assert.strictEqual(reqResults.size, 0);
    });
  });
});
