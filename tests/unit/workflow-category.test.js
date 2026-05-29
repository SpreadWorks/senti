import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prefixCategory,
  VALID_CATEGORIES,
} from "../../src/workflow/lib/category.js";

describe("workflow category prefix", () => {
  it("exposes the four valid categories", () => {
    assert.deepEqual(
      [...VALID_CATEGORIES].sort(),
      ["BUG", "ENHANCE", "OTHER", "RESEARCH"],
    );
  });

  it("prefixes title with [CATEGORY] when category is provided", () => {
    assert.equal(prefixCategory("実装する", "BUG"), "[BUG] 実装する");
    assert.equal(prefixCategory("調査する", "RESEARCH"), "[RESEARCH] 調査する");
  });

  it("returns title unchanged when category is null/undefined", () => {
    assert.equal(prefixCategory("実装する", null), "実装する");
    assert.equal(prefixCategory("実装する", undefined), "実装する");
  });

  it("throws on invalid category", () => {
    assert.throws(
      () => prefixCategory("title", "INVALID"),
      /category must be one of/,
    );
  });

  it("does not double-prefix if category already present", () => {
    assert.equal(
      prefixCategory("[BUG] 既存タイトル", "BUG"),
      "[BUG] 既存タイトル",
    );
  });
});
