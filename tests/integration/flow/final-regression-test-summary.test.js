import test from "node:test";
import assert from "node:assert/strict";
import { finalRegressionTestCount } from "../../../src/flow/lib/test-artifacts.js";

test("finalRegressionTestCount reads the Node spec reporter summary", () => {
  const stdout = [
    "✔ project addition (0.625462ms)",
    "ℹ tests 1",
    "ℹ suites 0",
    "ℹ pass 1",
    "ℹ fail 0",
  ].join("\n");

  assert.equal(finalRegressionTestCount(stdout), 1);
});

test("finalRegressionTestCount ignores ANSI styling around the Node summary", () => {
  const stdout = [
    "\u001b[32m✔ project addition (0.625462ms)\u001b[39m",
    "\u001b[34mℹ\u001b[39m tests 12",
    "\u001b[34mℹ\u001b[39m pass 12",
  ].join("\n");

  assert.equal(finalRegressionTestCount(stdout), 12);
});

test("finalRegressionTestCount retains supported TAP, Jest, and Mocha summaries", () => {
  assert.equal(finalRegressionTestCount("TAP version 13\n1..3\n"), 3);
  assert.equal(finalRegressionTestCount("# tests 4\n# pass 4\n"), 4);
  assert.equal(finalRegressionTestCount("Tests: 5 passed, 5 total\n"), 5);
  assert.equal(finalRegressionTestCount("  6 passing (20ms)\n"), 6);
});

test("finalRegressionTestCount does not infer a count from unrelated output", () => {
  assert.equal(finalRegressionTestCount("project tests completed successfully\n"), 0);
});
