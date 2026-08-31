import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SPEC_PROMPT = new URL("../../../src/flow/prompts/plan/spec.md", import.meta.url);

describe("spec worker output language", () => {
  it("requires human-readable spec prose to follow config.lang", () => {
    const prompt = fs.readFileSync(SPEC_PROMPT, "utf8");

    assert.match(prompt, /human-readable prose in `spec\.json` in the language specified by `config\.lang`/);
    assert.match(prompt, /technical identifiers exactly/);
    assert.match(prompt, /`keywords` remains the explicit English-only exception/);
  });
});
