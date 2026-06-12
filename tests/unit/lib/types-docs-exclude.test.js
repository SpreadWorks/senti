import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../../../src/lib/config.js";

const base = {
  lang: "ja",
  type: "sample-node-command",
  docs: { languages: ["ja"], defaultLanguage: "ja" },
};

describe("validateConfig docs.exclude", () => {
  it("accepts docs.exclude as string array", () => {
    const result = validate({
      ...base,
      docs: { ...base.docs, exclude: ["src/presets/*/tests/**"] },
    });
    assert.ok(result);
  });

  it("accepts docs without exclude", () => {
    const result = validate({ ...base });
    assert.ok(result);
  });

  it("accepts empty docs.exclude array", () => {
    const result = validate({
      ...base,
      docs: { ...base.docs, exclude: [] },
    });
    assert.ok(result);
  });

  it("rejects non-array docs.exclude", () => {
    assert.throws(
      () => validate({
        ...base,
        docs: { ...base.docs, exclude: "src/presets/**" },
      }),
      /docs\.exclude/i,
    );
  });

  it("rejects docs.exclude with non-string entries", () => {
    assert.throws(
      () => validate({
        ...base,
        docs: { ...base.docs, exclude: [123] },
      }),
      /docs\.exclude/i,
    );
  });
});
