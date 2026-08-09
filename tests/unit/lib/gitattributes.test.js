import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SENRAIL_ANALYSIS_GITATTRIBUTE,
  normalizeSenrailGitattributes,
} from "../../../src/lib/gitattributes.js";

describe("normalizeSenrailGitattributes", () => {
  it("appends the managed entry when it is missing", () => {
    assert.equal(
      normalizeSenrailGitattributes("*.png binary\n"),
      `*.png binary\n${SENRAIL_ANALYSIS_GITATTRIBUTE}\n`,
    );
  });

  it("leaves unrelated content unchanged when append is disabled", () => {
    const content = "*.png binary\n";
    assert.equal(normalizeSenrailGitattributes(content, { appendIfMissing: false }), content);
  });
});
