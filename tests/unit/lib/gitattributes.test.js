import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MANAGED_ANALYSIS_GITATTRIBUTE,
  normalizeManagedGitattributes,
} from "../../../src/lib/gitattributes.js";

describe("normalizeManagedGitattributes", () => {
  it("appends the managed entry when it is missing", () => {
    assert.equal(
      normalizeManagedGitattributes("*.png binary\n"),
      `*.png binary\n${MANAGED_ANALYSIS_GITATTRIBUTE}\n`,
    );
  });

  it("leaves unrelated content unchanged when append is disabled", () => {
    const content = "*.png binary\n";
    assert.equal(normalizeManagedGitattributes(content, { appendIfMissing: false }), content);
  });

  it("does not interpret a retired managed-root attribute outside the migration boundary", () => {
    const legacy = ".senti/output/analysis.json merge=ours\n";
    const normalized = normalizeManagedGitattributes(legacy);
    assert.match(normalized, /^\.senti\/output\/analysis\.json merge=ours$/m);
    assert.match(normalized, new RegExp(`^${MANAGED_ANALYSIS_GITATTRIBUTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  });
});
