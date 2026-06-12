import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../../../src/lib/config.js";

const base = {
  lang: "ja",
  type: "sample-node-command",
  docs: { languages: ["ja"], defaultLanguage: "ja" },
};

// ---------------------------------------------------------------------------
// R3: chapters validation — new object array format
// ---------------------------------------------------------------------------

describe("validateConfig chapters (object array format)", () => {
  it("accepts chapters as object array", () => {
    const result = validate({
      ...base,
      chapters: [{ chapter: "overview.md" }, { chapter: "cli_commands.md", desc: "CLI" }],
    });
    assert.ok(result);
  });

  it("accepts chapters with desc and exclude fields", () => {
    const result = validate({
      ...base,
      chapters: [
        { chapter: "overview.md", desc: "Project overview" },
        { chapter: "internal_design.md", exclude: true },
      ],
    });
    assert.ok(result);
  });

  it("accepts config without chapters", () => {
    const result = validate({ ...base });
    assert.ok(result);
  });

  it("rejects chapters as string array (old format)", () => {
    assert.throws(
      () => validate({ ...base, chapters: ["overview.md", "cli_commands.md"] }),
      /chapters/i,
    );
  });

  it("rejects chapters entry without chapter field", () => {
    assert.throws(
      () => validate({ ...base, chapters: [{ desc: "no chapter field" }] }),
      /chapter/i,
    );
  });

  it("rejects chapters entry with non-string chapter", () => {
    assert.throws(
      () => validate({ ...base, chapters: [{ chapter: 123 }] }),
      /chapter/i,
    );
  });

  it("rejects chapters entry with non-string desc", () => {
    assert.throws(
      () => validate({ ...base, chapters: [{ chapter: "a.md", desc: 42 }] }),
      /desc/i,
    );
  });

  it("rejects chapters entry with non-boolean exclude", () => {
    assert.throws(
      () => validate({ ...base, chapters: [{ chapter: "a.md", exclude: "yes" }] }),
      /exclude/i,
    );
  });

  it("rejects non-array chapters", () => {
    assert.throws(
      () => validate({ ...base, chapters: "overview.md" }),
      /chapters/i,
    );
  });
});
