import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateSchema } from "../../../src/lib/schema-validate.js";

const SCHEMA_PATH = path.resolve(import.meta.dirname, "../../../src/flow/schemas/spec.schema.json");

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

function minimalValidSpec() {
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

describe("spec.schema.json — authorized_test_modifications (spec 207 / T8)", () => {
  it("declares optional authorized_test_modifications property", () => {
    const schema = loadSchema();
    assert.ok(schema.properties.authorized_test_modifications, "missing authorized_test_modifications property");
    assert.equal(schema.properties.authorized_test_modifications.type, "array");
  });

  it("accepts a spec with authorized_test_modifications entries", () => {
    const schema = loadSchema();
    const spec = {
      ...minimalValidSpec(),
      authorized_test_modifications: [
        {
          path: "tests/unit/foo.test.js",
          reason: "The test encodes behavior that this spec intentionally changes for reason X.",
        },
      ],
    };
    const errors = validateSchema(spec, schema);
    assert.deepEqual(errors, [], `expected no errors, got: ${errors.join(" / ")}`);
  });

  it("accepts a spec without authorized_test_modifications (field is optional)", () => {
    const schema = loadSchema();
    const errors = validateSchema(minimalValidSpec(), schema);
    assert.deepEqual(errors, []);
  });

  it("rejects authorized_test_modifications entries missing required path/reason", () => {
    const schema = loadSchema();
    const spec = {
      ...minimalValidSpec(),
      authorized_test_modifications: [{ path: "tests/x.test.js" }],
    };
    const errors = validateSchema(spec, schema);
    assert.ok(errors.length > 0, "expected schema error for missing reason");
  });
});
