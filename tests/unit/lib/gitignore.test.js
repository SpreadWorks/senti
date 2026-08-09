import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSenrailGitignore } from "../../../src/lib/gitignore.js";

describe("normalizeSenrailGitignore", () => {
  it("keeps .senrail contents ignored while allowing managed files and directories", () => {
    const normalized = normalizeSenrailGitignore([
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
    const normalized = normalizeSenrailGitignore([
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

    assert.equal(normalizeSenrailGitignore(content, { appendIfMissing: false }), content);
  });
});
