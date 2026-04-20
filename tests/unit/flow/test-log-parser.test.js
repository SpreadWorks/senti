/**
 * tests/unit/flow/test-log-parser.test.js
 *
 * Spec 200 — default test log parser (parseCountsFromLog).
 * Covers REQ-3: unit/integration/acceptance independent parsing + missing-key fallback.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCountsFromLog } from "../../../src/flow/lib/test-log-parser.js";

describe("parseCountsFromLog (default)", () => {
  it("parses all three labeled counts independently", () => {
    const log = [
      "# pass 999",
      "unit: 3",
      "integration: 5",
      "acceptance: 2",
    ].join("\n");
    assert.deepEqual(parseCountsFromLog(log), { unit: 3, integration: 5, acceptance: 2 });
  });

  it("parses zero as a valid count", () => {
    const log = "unit: 0\nintegration: 0\nacceptance: 0\n";
    assert.deepEqual(parseCountsFromLog(log), { unit: 0, integration: 0, acceptance: 0 });
  });

  it("omits missing keys (no fabricated zero)", () => {
    const log = "unit: 4\n";
    const out = parseCountsFromLog(log);
    assert.equal(out.unit, 4);
    assert.ok(!("integration" in out), "integration key should be omitted");
    assert.ok(!("acceptance" in out), "acceptance key should be omitted");
  });

  it("falls back to '# pass N' for unit when no labels are present", () => {
    const log = "ok 1 - x\nok 2 - y\n# pass 2\n# fail 0\n";
    assert.deepEqual(parseCountsFromLog(log), { unit: 2 });
  });

  it("prefers explicit labels over '# pass N' fallback", () => {
    const log = "# pass 100\nunit: 7\n";
    assert.equal(parseCountsFromLog(log).unit, 7);
  });

  it("returns empty object when no counts are present", () => {
    assert.deepEqual(parseCountsFromLog("no counts here"), {});
  });
});
