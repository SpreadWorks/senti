import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeManagedGitignore } from "../../../src/lib/gitignore.js";

describe("normalizeManagedGitignore", () => {
  it("keeps .senrail contents ignored while allowing managed files and directories", () => {
    const normalized = normalizeManagedGitignore([
      ".senrail/*",
      "!.senrail/config.json",
      "!.senrail/templates/",
      "!.senrail/output/",
      ".senrail/output/acceptance-report-*.json",
      ".senrail/",
      "",
      "node_modules",
      "",
    ].join("\n"));

    assert.equal(normalized, [
      ".senrail/*",
      "!.senrail/config.json",
      "!.senrail/templates/",
      "!.senrail/output/",
      "!.senrail/presets/",
      ".senrail/output/acceptance-report-*.json",
      "",
      "node_modules",
      "",
    ].join("\n"));
  });

  it("normalizes a mechanically renamed legacy directory ignore", () => {
    const normalized = normalizeManagedGitignore([
      ".senrail/",
      "",
      ".tmp/",
      "",
    ].join("\n"));

    assert.equal(normalized, [
      ".senrail/*",
      "!.senrail/config.json",
      "!.senrail/templates/",
      "!.senrail/output/",
      "!.senrail/presets/",
      ".senrail/output/acceptance-report-*.json",
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
