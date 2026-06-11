import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSentiGitignore } from "../../../src/lib/gitignore.js";

describe("normalizeSentiGitignore", () => {
  it("keeps .senti contents ignored while allowing managed files and directories", () => {
    const normalized = normalizeSentiGitignore([
      ".senti/*",
      "!.senti/config.json",
      "!.senti/templates/",
      "!.senti/output/",
      ".senti/output/acceptance-report-*.json",
      ".senti/",
      "",
      "node_modules",
      "",
    ].join("\n"));

    assert.equal(normalized, [
      ".senti/*",
      "!.senti/config.json",
      "!.senti/templates/",
      "!.senti/output/",
      "!.senti/presets/",
      ".senti/output/acceptance-report-*.json",
      "",
      "node_modules",
      "",
    ].join("\n"));
  });

  it("normalizes a mechanically renamed legacy directory ignore", () => {
    const normalized = normalizeSentiGitignore([
      ".senti/",
      "",
      ".tmp/",
      "",
    ].join("\n"));

    assert.equal(normalized, [
      ".senti/*",
      "!.senti/config.json",
      "!.senti/templates/",
      "!.senti/output/",
      "!.senti/presets/",
      ".senti/output/acceptance-report-*.json",
      "",
      ".tmp/",
      "",
    ].join("\n"));
  });

  it("does not change unrelated gitignore content when append is disabled", () => {
    const content = [
      "node_modules",
      ".tmp/",
    ].join("\n");

    assert.equal(normalizeSentiGitignore(content, { appendIfMissing: false }), content);
  });
});
