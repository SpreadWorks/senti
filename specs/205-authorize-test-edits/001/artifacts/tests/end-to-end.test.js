/**
 * specs/205-authorize-test-edits/tests/end-to-end.test.js
 *
 * Spec 205: end-to-end behavior of authorized test edits.
 *
 * Exercises the integration of:
 *   1. parseAuthorizedTestModifications(specText) — parser
 *   2. checkTestChanges(diff, testGlobs, authorizedFiles) — bypass-aware diff check
 *
 * Scenarios covered:
 *   - AC-1: no section → legacy behavior
 *   - AC-2: section authorizes a file → edits in that file pass
 *   - AC-3: section authorizes file A → edits in file B still FAIL
 *   - AC-5: invalid entry (short reason) → parse error surfaces
 *   - AC-6: authorized entry is unused in the diff → warning surfaces
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkTestChanges,
  parseAuthorizedTestModifications,
  findUnusedAuthorizations,
} from "../../../src/flow/lib/run-gate.js";

const TEST_GLOBS = ["**/*.test.js", "tests/**"];
const SECTION = "## Authorized Existing Test Modifications";
const REASON = "This change is required by the spec 205 contract update.";

function diffHeader(p) {
  return [`diff --git a/${p} b/${p}`, "index abc..def 100644", `--- a/${p}`, `+++ b/${p}`].join("\n");
}

const EDIT_DIFF_A = [
  diffHeader("tests/a.test.js"),
  "@@ -10,1 +10,1 @@",
  "-expect(x).toBe(5);",
  "+expect(x).toBe(3);",
].join("\n");

const EDIT_DIFF_B = [
  diffHeader("tests/b.test.js"),
  "@@ -20,1 +20,1 @@",
  "-expect(y).toBe(1);",
  "+expect(y).toBe(2);",
].join("\n");

describe("spec 205 end-to-end: authorized test edits", () => {
  it("AC-1: no section → legacy FAIL", () => {
    const spec = "# Title\n\n## Goal\n\nexample.\n";
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(errors, []);
    const { issues } = checkTestChanges(EDIT_DIFF_A, TEST_GLOBS, files);
    assert.equal(issues.length, 1);
  });

  it("AC-2: authorizing tests/a.test.js → edit in that file PASSes", () => {
    const spec = `${SECTION}\n- \`tests/a.test.js\` — ${REASON}\n`;
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(errors, []);
    const { issues } = checkTestChanges(EDIT_DIFF_A, TEST_GLOBS, files);
    assert.deepEqual(issues, []);
  });

  it("AC-3: authorizing tests/a.test.js → edit in tests/b.test.js still FAILs", () => {
    const spec = `${SECTION}\n- \`tests/a.test.js\` — ${REASON}\n`;
    const { files } = parseAuthorizedTestModifications(spec);
    const { issues } = checkTestChanges(EDIT_DIFF_B, TEST_GLOBS, files);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /tests\/b\.test\.js/);
  });

  it("AC-5: invalid entry (short reason) → parse error surfaces, no files authorized", () => {
    const spec = `${SECTION}\n- \`tests/a.test.js\` — short\n`;
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(files, []);
    assert.equal(errors.length, 1);
  });

  it("AC-6: unused authorized entry → warning surfaces, gate itself passes", () => {
    // spec authorizes tests/c.test.js but the diff only edits tests/a.test.js.
    const spec = [
      SECTION,
      `- \`tests/a.test.js\` — ${REASON}`,
      `- \`tests/c.test.js\` — ${REASON}`,
    ].join("\n");
    const { files, errors } = parseAuthorizedTestModifications(spec);
    assert.deepEqual(errors, []);
    const { issues } = checkTestChanges(EDIT_DIFF_A, TEST_GLOBS, files);
    assert.deepEqual(issues, []);
    const warnings = findUnusedAuthorizations(EDIT_DIFF_A, files);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /tests\/c\.test\.js/);
  });
});
