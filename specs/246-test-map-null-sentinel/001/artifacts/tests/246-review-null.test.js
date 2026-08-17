/**
 * specs/246-test-map-null-sentinel/tests/246-review-null.test.js
 *
 * Spec 246 R5: review.js の test-map untested チェックで null を除外
 *
 * review.js の untested 判定ロジックを直接テストする。
 * review.js L945-948 の filter は testMap[r.id] || [] で空配列にフォールバックし、
 * .length === 0 で untested 判定する。null エントリもこのパスで untested 扱いになるのが現行動作。
 * 修正後は null エントリをスキップすべき。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

function findUntestedCurrent(requirements, testMap) {
  return requirements.filter((r) => {
    const tests = testMap[r.id] || [];
    return tests.length === 0;
  });
}

function findUntested(requirements, testMap) {
  return requirements.filter((r) => {
    if (testMap[r.id] === null) return false;
    const tests = testMap[r.id] || [];
    return tests.length === 0;
  });
}

describe("R5: review untested check skips null entries", () => {
  it("null entry should not be counted as untested", () => {
    const requirements = [
      { id: "R1", desc: "tested" },
      { id: "R2", desc: "test not required" },
      { id: "R3", desc: "actually untested" },
    ];
    const testMap = {
      R1: ["some-test.test.js > R1: works"],
      R2: null,
      R3: [],
    };

    const untested = findUntested(requirements, testMap);
    const untestedIds = untested.map((r) => r.id);

    assert.ok(!untestedIds.includes("R2"), "R2 (null) should not be listed as untested");
    assert.ok(untestedIds.includes("R3"), "R3 ([]) should still be listed as untested");
    assert.equal(untested.length, 1, "only R3 should be untested");
  });
});
