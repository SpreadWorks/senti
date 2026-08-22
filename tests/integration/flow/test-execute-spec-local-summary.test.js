import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { failedRequirementIdsFromSpecLocal } from "../../../src/flow/lib/run-test-execute.js";

function specLocal(stdout, exitCode = 1) {
  return {
    result: {
      started: true,
      exitCode,
      signal: null,
      timedOut: false,
      spawnError: null,
      stdout,
      stderr: "",
    },
  };
}

const REQUIREMENTS = [
  { id: "R1" },
  { id: "R2" },
  { id: "R3" },
  { id: "R4" },
  { id: "R5" },
];

describe("test-execute spec-local requirement summary", () => {
  it("extracts only failed requirement ids from TAP subtest failures", () => {
    const failedIds = failedRequirementIdsFromSpecLocal(specLocal([
      "TAP version 13",
      "# Subtest: R1: first behavior",
      "ok 1 - R1: first behavior",
      "# Subtest: R4: flow-level implementation instructions expose complete file-map guidance",
      "not ok 4 - R4: flow-level implementation instructions expose complete file-map guidance",
      "# Subtest: R5: contract remains unchanged",
      "ok 5 - R5: contract remains unchanged",
      "1..5",
    ].join("\n")), REQUIREMENTS);

    assert.deepEqual([...failedIds], ["R4"]);
  });

  it("returns an empty set when spec-local tests pass", () => {
    const failedIds = failedRequirementIdsFromSpecLocal(specLocal("ok 1 - R1: first behavior", 0), REQUIREMENTS);

    assert.deepEqual([...failedIds], []);
  });

  it("returns null when tests fail but no requirement id can be extracted", () => {
    const failedIds = failedRequirementIdsFromSpecLocal(specLocal([
      "TAP version 13",
      "not ok 1 - helper setup fails before named requirement tests",
      "1..1",
    ].join("\n")), REQUIREMENTS);

    assert.equal(failedIds, null);
  });
});
