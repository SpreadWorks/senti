import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeManagedGitignore } from "../../../src/lib/gitignore.js";

describe("normalizeManagedGitignore", () => {
  it("keeps .sennel contents ignored while allowing managed files and directories", () => {
    const normalized = normalizeManagedGitignore([
      ".sennel/*",
      "!.sennel/config.json",
      "!.sennel/templates/",
      "!.sennel/output/",
      ".sennel/output/acceptance-report-*.json",
      ".sennel/",
      "",
      "node_modules",
      "",
    ].join("\n"));

    assert.equal(normalized, [
      ".sennel/*",
      "!.sennel/config.json",
      "!.sennel/templates/",
      "!.sennel/output/",
      "!.sennel/presets/",
      ".sennel/output/acceptance-report-*.json",
      "",
      "node_modules",
      "",
    ].join("\n"));
  });

  it("normalizes a mechanically renamed legacy directory ignore", () => {
    const normalized = normalizeManagedGitignore([
      ".sennel/",
      "",
      ".tmp/",
      "",
    ].join("\n"));

    assert.equal(normalized, [
      ".sennel/*",
      "!.sennel/config.json",
      "!.sennel/templates/",
      "!.sennel/output/",
      "!.sennel/presets/",
      ".sennel/output/acceptance-report-*.json",
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

    assert.equal(normalizeManagedGitignore(content, { appendIfMissing: false }), content);
  });
});
