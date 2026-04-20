/**
 * tests/unit/test-runner-labels.test.js
 *
 * Spec 200 — REQ-1: the project test runner emits unit/integration/acceptance
 * labels in its stdout summary. We test the shared helper that tests/run.js uses.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  categorizeTestFile,
  formatLabelSummary,
} from "../helpers/test-runner-labels.js";

describe("categorizeTestFile", () => {
  it("maps paths with /tests/unit/ to unit", () => {
    assert.equal(categorizeTestFile("/repo/tests/unit/foo.test.js"), "unit");
    assert.equal(
      categorizeTestFile("/repo/src/presets/foo/tests/unit/bar.test.js"),
      "unit",
    );
  });

  it("maps paths with /tests/e2e/ to integration", () => {
    assert.equal(categorizeTestFile("/repo/tests/e2e/foo.test.js"), "integration");
    assert.equal(
      categorizeTestFile("/repo/src/presets/foo/tests/e2e/bar.test.js"),
      "integration",
    );
  });

  it("maps paths with /tests/acceptance/ to acceptance", () => {
    assert.equal(
      categorizeTestFile("/repo/src/presets/foo/tests/acceptance/bar.test.js"),
      "acceptance",
    );
  });

  it("returns null for paths that match no category", () => {
    assert.equal(categorizeTestFile("/repo/misc/foo.js"), null);
  });
});

describe("formatLabelSummary", () => {
  it("always emits three lines in unit/integration/acceptance order", () => {
    const out = formatLabelSummary({ unit: 3, integration: 5, acceptance: 2 });
    assert.equal(out, "unit: 3\nintegration: 5\nacceptance: 2");
  });

  it("emits 0 explicitly for categories with no tests", () => {
    const out = formatLabelSummary({ unit: 1, integration: 0, acceptance: 0 });
    assert.equal(out, "unit: 1\nintegration: 0\nacceptance: 0");
  });

  it("treats missing keys as 0 (never omits lines)", () => {
    const out = formatLabelSummary({ unit: 4 });
    assert.equal(out, "unit: 4\nintegration: 0\nacceptance: 0");
  });
});
