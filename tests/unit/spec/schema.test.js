import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateSchema } from "../../../src/lib/schema-validate.js";

const SCHEMA_PATH = path.resolve(import.meta.dirname, "../../../src/flow/schemas/spec.schema.json");

function loadSchema() {
  const text = fs.readFileSync(SCHEMA_PATH, "utf8");
  return JSON.parse(text);
}

function minimalValidSpec() {
  return {
    goal: "g",
    scope: { in: ["a"], out: [] },
    constraints: [],
    design_principles: [],
    overview: {
      modules: [{ text: "src/foo.js" }],
      data_flow: [{ text: "a -> b", added_by_task: "T1" }],
      decisions: [],
    },
    background: "",
    requirements: [{ id: "R1", desc: "d", priority: "must", status: "pending" }],
    acceptance_criteria: ["ok"],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };
}

describe("spec.schema.json", () => {
  it("exists at src/flow/schemas/spec.schema.json", () => {
    assert.ok(fs.existsSync(SCHEMA_PATH), `schema file not found at ${SCHEMA_PATH}`);
  });

  it("defines the agreed fields (11 baseline + implementationTargets + tasks + user_approval)", () => {
    const schema = loadSchema();
    assert.equal(schema.type, "object");
    const expected = [
      "goal",
      "scope",
      "constraints",
      "design_principles",
      "overview",
      "background",
      "requirements",
      "acceptance_criteria",
      "clarifications",
      "alternatives_considered",
      "open_questions",
      "implementationTargets",
      "tasks",
      "user_approval",
    ].sort();
    const actual = Object.keys(schema.properties || {}).sort();
    assert.deepEqual(actual, expected);
  });

  it("defines scope with in and out array fields", () => {
    const schema = loadSchema();
    const scope = schema.properties.scope;
    assert.equal(scope.type, "object");
    assert.equal(scope.properties.in.type, "array");
    assert.equal(scope.properties.out.type, "array");
  });

  it("defines overview with modules / data_flow / decisions", () => {
    const schema = loadSchema();
    const ov = schema.properties.overview;
    assert.equal(ov.type, "object");
    assert.ok(ov.properties.modules);
    assert.ok(ov.properties.data_flow);
    assert.ok(ov.properties.decisions);
  });

  it("accepts a valid spec with no errors", () => {
    const schema = loadSchema();
    const errors = validateSchema(minimalValidSpec(), schema);
    assert.deepEqual(errors, []);
  });

  for (const field of ["goal", "scope", "requirements"]) {
    it(`reports error when required field \`${field}\` is missing`, () => {
      const schema = loadSchema();
      const spec = minimalValidSpec();
      delete spec[field];
      const errors = validateSchema(spec, schema);
      assert.ok(
        errors.some((e) => e.includes(field)),
        `expected ${field} error, got: ${errors.join(" / ")}`,
      );
    });
  }

  it("reports error when `goal` is a number instead of string", () => {
    const schema = loadSchema();
    const spec = minimalValidSpec();
    spec.goal = 123;
    const errors = validateSchema(spec, schema);
    assert.ok(errors.some((e) => e.includes("goal") && e.includes("string")));
  });

  describe("overview entry shape (spec 207)", () => {
    it("accepts structured overview entries with text and optional added_by_task", () => {
      const schema = loadSchema();
      const spec = minimalValidSpec();
      spec.overview = {
        modules: [
          { text: "src/a.js" },
          { text: "src/b.js", added_by_task: "T3" },
        ],
        data_flow: [{ text: "x -> y", added_by_task: "T1" }],
        decisions: [{ text: "decision one" }],
      };
      const errors = validateSchema(spec, schema);
      assert.deepEqual(errors, []);
    });

    it("rejects bare string entries (pre-207 shape)", () => {
      const schema = loadSchema();
      const spec = minimalValidSpec();
      spec.overview = {
        modules: ["bare string"],
        data_flow: [],
        decisions: [],
      };
      const errors = validateSchema(spec, schema);
      assert.ok(errors.length > 0, "expected at least one validation error for bare string entry");
    });

    it("rejects entry missing required `text` field", () => {
      const schema = loadSchema();
      const spec = minimalValidSpec();
      spec.overview = {
        modules: [{ added_by_task: "T1" }],
        data_flow: [],
        decisions: [],
      };
      const errors = validateSchema(spec, schema);
      assert.ok(errors.some((e) => e.includes("text")), `expected text error, got: ${errors.join(" / ")}`);
    });
  });
});
