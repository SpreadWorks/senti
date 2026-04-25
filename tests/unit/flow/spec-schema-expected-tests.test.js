import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadSpecJson } from "../../../src/lib/spec-json.js";

function mkSpecDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spec-expected-tests-"));
}

function minimalSpec() {
  return {
    goal: "g",
    scope: { in: ["a"], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "",
    requirements: [{ id: "R1", desc: "d", priority: "must", status: "pending" }],
    acceptance_criteria: ["ok"],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };
}

// ---------------------------------------------------------------------------
// REQ-1: spec schema accepts expected_tests as optional string array in tasks
// ---------------------------------------------------------------------------

describe("spec.schema.json — expected_tests field (REQ-1)", () => {
  it("validates a spec with tasks[].expected_tests as string array", () => {
    const dir = mkSpecDir();
    const spec = {
      ...minimalSpec(),
      tasks: [
        {
          id: "T-1",
          title: "t",
          goal: "g",
          origin: "plan",
          added_round: 0,
          status: "pending",
          expected_tests: ["tests/foo.test.js", "tests/bar.test.js"],
        },
      ],
    };
    fs.writeFileSync(path.join(dir, "spec.json"), JSON.stringify(spec));
    const loaded = loadSpecJson(dir);
    assert.deepEqual(loaded.tasks[0].expected_tests, [
      "tests/foo.test.js",
      "tests/bar.test.js",
    ]);
  });

  it("validates a spec with tasks without expected_tests (optional)", () => {
    const dir = mkSpecDir();
    const spec = {
      ...minimalSpec(),
      tasks: [
        {
          id: "T-1",
          title: "t",
          goal: "g",
          origin: "plan",
          added_round: 0,
          status: "pending",
        },
      ],
    };
    fs.writeFileSync(path.join(dir, "spec.json"), JSON.stringify(spec));
    const loaded = loadSpecJson(dir);
    assert.equal(loaded.tasks[0].expected_tests, undefined);
  });

  it("validates a spec without tasks field at all (backward compat)", () => {
    const dir = mkSpecDir();
    const spec = minimalSpec();
    fs.writeFileSync(path.join(dir, "spec.json"), JSON.stringify(spec));
    const loaded = loadSpecJson(dir);
    assert.equal(loaded.tasks, undefined);
  });

  it("validates a spec with empty expected_tests array", () => {
    const dir = mkSpecDir();
    const spec = {
      ...minimalSpec(),
      tasks: [
        {
          id: "T-1",
          title: "t",
          goal: "g",
          origin: "plan",
          added_round: 0,
          status: "pending",
          expected_tests: [],
        },
      ],
    };
    fs.writeFileSync(path.join(dir, "spec.json"), JSON.stringify(spec));
    const loaded = loadSpecJson(dir);
    assert.deepEqual(loaded.tasks[0].expected_tests, []);
  });
});
