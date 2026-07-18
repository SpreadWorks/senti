import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SENTI_ANALYSIS_GITATTRIBUTE,
  normalizeSentiGitattributes,
} from "../../../src/lib/gitattributes.js";

describe("normalizeSentiGitattributes", () => {
  it("replaces the legacy analysis merge entry", () => {
    const normalized = normalizeSentiGitattributes([
      "*.png binary",
      ".sdd-forge/output/analysis.json merge=ours",
      "",
    ].join("\n"), { appendIfMissing: false });

    assert.equal(normalized, [
      "*.png binary",
      SENTI_ANALYSIS_GITATTRIBUTE,
      "",
    ].join("\n"));
  });

  it("appends the managed entry when it is missing", () => {
    assert.equal(
      normalizeSentiGitattributes("*.png binary\n"),
      `*.png binary\n${SENTI_ANALYSIS_GITATTRIBUTE}\n`,
    );
  });

  it("leaves unrelated content unchanged when append is disabled", () => {
    const content = "*.png binary\n";
    assert.equal(normalizeSentiGitattributes(content, { appendIfMissing: false }), content);
  });
});
