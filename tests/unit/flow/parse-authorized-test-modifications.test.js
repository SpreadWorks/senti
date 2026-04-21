/**
 * tests/unit/flow/parse-authorized-test-modifications.test.js
 *
 * Spec 205: parser for the optional `## Authorized Existing Test Modifications`
 * section in spec.md.
 *
 * Contract:
 *   parseAuthorizedTestModifications(specText) →
 *     { files: string[], errors: string[] }
 *
 * - files: list of authorized file paths (no duplicates, in source order)
 * - errors: list of parse error messages (human-readable)
 *
 * Entry syntax (flat bullet list, one entry per line):
 *   - `<path>` — <reason (40+ chars)>
 *
 * The "—" separator is a literal em dash (U+2014).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAuthorizedTestModifications } from "../../../src/flow/lib/run-gate.js";

const SECTION = "## Authorized Existing Test Modifications";

describe("parseAuthorizedTestModifications", () => {
  it("returns empty files and no errors when the section is absent", () => {
    const spec = "# Title\n\n## Goal\n\nsomething.\n";
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(files, []);
    assert.deepEqual(errors, []);
  });

  it("returns empty files when the section exists but is empty", () => {
    const spec = `# Title\n\n${SECTION}\n\n## Next Section\n`;
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(files, []);
    assert.deepEqual(errors, []);
  });

  it("parses one entry with path and reason of exactly 40 chars", () => {
    const reason = "x".repeat(40);
    const spec = `${SECTION}\n- \`tests/a.test.js\` — ${reason}\n`;
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(files, ["tests/a.test.js"]);
    assert.deepEqual(errors, []);
  });

  it("rejects entry with reason under 40 chars (R4)", () => {
    const shortReason = "too short";
    const spec = `${SECTION}\n- \`tests/a.test.js\` — ${shortReason}\n`;
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(files, []);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /tests\/a\.test\.js/);
    assert.match(errors[0], /40/);
  });

  it("rejects entry missing the em-dash separator (R4)", () => {
    const spec = `${SECTION}\n- \`tests/a.test.js\` a short reason without dash that is long enough\n`;
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(files, []);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /syntax|format|separator/i);
  });

  it("rejects entry without the backtick-quoted path (R4)", () => {
    const reason = "x".repeat(40);
    const spec = `${SECTION}\n- tests/a.test.js — ${reason}\n`;
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(files, []);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /path|backtick/i);
  });

  it("parses multiple entries in order", () => {
    const reason = "This is a long reason that meets the 40-char minimum.";
    const spec = [
      SECTION,
      `- \`tests/a.test.js\` — ${reason}`,
      `- \`tests/b.test.js\` — ${reason}`,
      `- \`tests/c.test.js\` — ${reason}`,
    ].join("\n");
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(files, ["tests/a.test.js", "tests/b.test.js", "tests/c.test.js"]);
    assert.deepEqual(errors, []);
  });

  it("stops parsing at the next `##` header", () => {
    const reason = "x".repeat(40);
    const spec = [
      SECTION,
      `- \`tests/a.test.js\` — ${reason}`,
      "",
      "## Next Section",
      `- \`tests/out-of-section.test.js\` — ${reason}`,
    ].join("\n");
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(files, ["tests/a.test.js"]);
    assert.deepEqual(errors, []);
  });

  it("preserves blank lines and ignores them", () => {
    const reason = "x".repeat(40);
    const spec = [
      SECTION,
      "",
      `- \`tests/a.test.js\` — ${reason}`,
      "",
      `- \`tests/b.test.js\` — ${reason}`,
      "",
    ].join("\n");
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(files, ["tests/a.test.js", "tests/b.test.js"]);
    assert.deepEqual(errors, []);
  });

  it("reports all errors across multiple bad entries", () => {
    const reason = "x".repeat(40);
    const spec = [
      SECTION,
      `- \`tests/good.test.js\` — ${reason}`,
      `- \`tests/short.test.js\` — too short`,
      `- tests/no-backtick.test.js — ${reason}`,
    ].join("\n");
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(files, ["tests/good.test.js"]);
    assert.equal(errors.length, 2);
  });
});
