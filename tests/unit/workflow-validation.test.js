import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  containsJapanese,
  stripHashPrefix,
  assertJapaneseDraft,
} from "../../src/workflow/lib/validation.js";

describe("workflow draft validation", () => {
  it("detects Japanese text", () => {
    assert.equal(containsJapanese("一時ファイル"), true);
    assert.equal(containsJapanese("temporary file"), false);
  });

  it("strips board hash prefix from draft titles", () => {
    assert.equal(stripHashPrefix("1933: 一時ファイルを集約する"), "一時ファイルを集約する");
    assert.equal(stripHashPrefix("一時ファイルを集約する"), "一時ファイルを集約する");
  });

  it("allows Japanese title with empty body", () => {
    assert.doesNotThrow(() => {
      assertJapaneseDraft("一時ファイルを集約する", "", { allowEmptyBody: true });
    });
  });

  it("rejects English-only title", () => {
    assert.throws(
      () => assertJapaneseDraft("temporary files", "", { allowEmptyBody: true }),
      /タイトルは日本語で入力してください/,
    );
  });

  it("rejects English-only body when provided", () => {
    assert.throws(
      () => assertJapaneseDraft("一時ファイルを集約する", "temporary files only", { allowEmptyBody: true }),
      /本文は日本語で入力してください/,
    );
  });
});
