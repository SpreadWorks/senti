import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ConcurrentBatchResult,
  mapWithConcurrency,
} from "../../../../src/docs/lib/concurrency.js";

describe("ConcurrentBatchResult", () => {
  it("retains ordered partial results but cannot pass throwIfErrors", async () => {
    const result = await mapWithConcurrency([1, 2, 3], 2, async (value) => {
      if (value === 2) throw new Error("batch item failed");
      return value * 10;
    });

    assert.ok(result instanceof ConcurrentBatchResult);
    assert.equal(result[0].value, 10);
    assert.equal(result[2].value, 30);
    assert.throws(() => result.throwIfErrors(), /batch item failed/);
  });

  it("returns itself after every item succeeds", async () => {
    const result = await mapWithConcurrency([1, 2], 2, async (value) => value * 10);
    assert.equal(result.throwIfErrors(), result);
  });
});
