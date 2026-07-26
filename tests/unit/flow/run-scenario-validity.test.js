import assert from "node:assert/strict";
import { test } from "node:test";
import { buildScenarioValidityDiffArgs } from "../../../src/flow/lib/run-scenario-validity.js";

test("scenario-validity diff accepts an immutable repair baseline", () => {
  assert.deepEqual(buildScenarioValidityDiffArgs("refs/senti/flows/run-id/baseline"), [
    "diff",
    "--name-only",
    "refs/senti/flows/run-id/baseline",
    "--",
    "src/",
    "tests/",
    "package.json",
    ".senti/config.json",
  ]);
});

test("scenario-validity diff defaults to main", () => {
  assert.equal(buildScenarioValidityDiffArgs()[2], "main");
});
