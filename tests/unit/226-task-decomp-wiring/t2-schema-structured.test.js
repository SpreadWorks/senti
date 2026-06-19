/**
 * tests/unit/226-task-decomp-wiring/t2-schema-structured.test.js
 *
 * Spec 226 / T-2: spec.json.tasks[*] スキーマの構造化。
 * description 削除、goal/acceptance/implementation_notes/test_strategy/parent
 * の追加を検証する。
 *
 * REQ-2 / REQ-3 / REQ-8 に対応。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateSchema } from "../../../src/lib/schema-validate.js";

const SCHEMA_PATH = path.resolve(
  import.meta.dirname,
  "../../../src/flow/schemas/spec.schema.json",
);

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

function taskItemSchema() {
  return loadSchema().properties.tasks.items;
}

/** Minimal spec.json without tasks (pre-226 shape). */
function minimalSpec() {
  return {
    goal: "g",
    scope: { in: ["a"], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [{ text: "m" }], data_flow: [], decisions: [] },
    background: "",
    requirements: [{ id: "R1", desc: "d", priority: "must", status: "pending" }],
    acceptance_criteria: ["ok"],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };
}

/** Minimal valid task entry per the 226 schema. */
function validTask(overrides = {}) {
  return {
    id: "T1",
    title: "task title",
    goal: "task goal",
    origin: "plan",
    added_round: 0,
    status: "pending",
    ...overrides,
  };
}

describe("T-2: spec.json tasks[*] schema restructuring", () => {
  it("schema requires id, title, goal, origin, added_round, status", () => {
    const taskSchema = taskItemSchema();
    const expected = ["id", "title", "goal", "origin", "added_round", "status"];
    for (const field of expected) {
      assert.ok(
        taskSchema.required.includes(field),
        `'${field}' should be in required, got: ${taskSchema.required.join(", ")}`,
      );
    }
    // Also verify via validateSchema: omitting each required field yields an error.
    for (const field of expected) {
      const task = validTask();
      delete task[field];
      const errors = validateSchema(task, taskSchema, "task");
      assert.ok(
        errors.some((e) => e.includes(field)),
        `expected validation error for missing '${field}', got: ${errors.join(" / ") || "(none)"}`,
      );
    }
  });

  it("schema does not include description in properties or required", () => {
    const taskSchema = taskItemSchema();
    assert.ok(
      !("description" in taskSchema.properties),
      "description must not appear in task properties",
    );
    assert.ok(
      !taskSchema.required.includes("description"),
      "description must not appear in task required",
    );
    // Since additionalProperties=false, adding description to a task should fail validation.
    const task = validTask({ description: "some description" });
    const errors = validateSchema(task, taskSchema, "task");
    assert.ok(
      errors.some((e) => e.includes("description") && e.includes("unknown")),
      `expected 'unknown field' error for description, got: ${errors.join(" / ") || "(none)"}`,
    );
  });

  it("schema accepts acceptance as optional array of strings (max 500 each)", () => {
    const taskSchema = taskItemSchema();
    // acceptance is not in required
    assert.ok(
      !taskSchema.required.includes("acceptance"),
      "acceptance must not be in required",
    );
    // acceptance schema is array of strings
    const accSchema = taskSchema.properties.acceptance;
    assert.equal(accSchema.type, "array");
    assert.equal(accSchema.items.type, "string");
    assert.equal(accSchema.items.maxLength, 500);
    // Validates a task with acceptance
    const task = validTask({ acceptance: ["criterion 1", "criterion 2"] });
    const errors = validateSchema(task, taskSchema, "task");
    assert.deepEqual(errors, []);
    // Validates a task without acceptance (optional)
    const taskNoAcc = validTask();
    const errors2 = validateSchema(taskNoAcc, taskSchema, "task");
    assert.deepEqual(errors2, []);
    // Non-string items in acceptance should fail
    const taskBadAcc = validTask({ acceptance: [42] });
    const errors3 = validateSchema(taskBadAcc, taskSchema, "task");
    assert.ok(
      errors3.some((e) => e.includes("acceptance") && e.includes("string")),
      `expected type error for non-string acceptance item, got: ${errors3.join(" / ")}`,
    );
  });

  it("schema accepts implementation_notes as optional string (max 5000)", () => {
    const taskSchema = taskItemSchema();
    assert.ok(
      !taskSchema.required.includes("implementation_notes"),
      "implementation_notes must not be in required",
    );
    const notesSchema = taskSchema.properties.implementation_notes;
    assert.equal(notesSchema.type, "string");
    assert.equal(notesSchema.maxLength, 5000);
    // Valid task with implementation_notes
    const task = validTask({ implementation_notes: "some notes" });
    const errors = validateSchema(task, taskSchema, "task");
    assert.deepEqual(errors, []);
    // Valid task without implementation_notes (optional)
    const taskNoNotes = validTask();
    const errors2 = validateSchema(taskNoNotes, taskSchema, "task");
    assert.deepEqual(errors2, []);
  });

  it("schema accepts test_strategy as optional string (max 2000)", () => {
    const taskSchema = taskItemSchema();
    assert.ok(
      !taskSchema.required.includes("test_strategy"),
      "test_strategy must not be in required",
    );
    const tsSchema = taskSchema.properties.test_strategy;
    assert.equal(tsSchema.type, "string");
    assert.equal(tsSchema.maxLength, 2000);
    // Valid task with test_strategy
    const task = validTask({ test_strategy: "unit tests" });
    const errors = validateSchema(task, taskSchema, "task");
    assert.deepEqual(errors, []);
    // Valid task without test_strategy (optional)
    const taskNoTs = validTask();
    const errors2 = validateSchema(taskNoTs, taskSchema, "task");
    assert.deepEqual(errors2, []);
  });

  it("schema accepts parent as optional string or null", () => {
    const taskSchema = taskItemSchema();
    assert.ok(
      !taskSchema.required.includes("parent"),
      "parent must not be in required",
    );
    // Schema uses a strict-compatible union type with string and null.
    const parentSchema = taskSchema.properties.parent;
    assert.deepEqual(parentSchema.type, ["string", "null"]);
    // Valid task with string parent
    const task1 = validTask({ parent: "T0" });
    const errors1 = validateSchema(task1, taskSchema, "task");
    assert.deepEqual(errors1, []);
    // Valid task with null parent
    const task2 = validTask({ parent: null });
    const errors2 = validateSchema(task2, taskSchema, "task");
    assert.deepEqual(errors2, []);
    // Valid task without parent (optional, absent)
    const task3 = validTask();
    const errors3 = validateSchema(task3, taskSchema, "task");
    assert.deepEqual(errors3, []);
  });

  it("schema rejects unknown fields (additionalProperties=false)", () => {
    const taskSchema = taskItemSchema();
    assert.equal(taskSchema.additionalProperties, false);
    // A task with an unknown field should produce an error
    const task = validTask({ unknown_field: "x" });
    const errors = validateSchema(task, taskSchema, "task");
    assert.ok(
      errors.some((e) => e.includes("unknown_field") && e.includes("unknown")),
      `expected unknown field error, got: ${errors.join(" / ") || "(none)"}`,
    );
    // Multiple unknown fields
    const task2 = validTask({ foo: 1, bar: 2 });
    const errors2 = validateSchema(task2, taskSchema, "task");
    assert.ok(errors2.some((e) => e.includes("foo")), "expected error for 'foo'");
    assert.ok(errors2.some((e) => e.includes("bar")), "expected error for 'bar'");
  });

  it("schema validates existing 326 spec.json (tasks undefined) as valid", () => {
    const schema = loadSchema();
    // tasks is not in the top-level required array
    assert.ok(
      !schema.required.includes("tasks"),
      "tasks must not be in the top-level required list",
    );
    // A spec without tasks should validate without errors
    const spec = minimalSpec();
    assert.ok(!("tasks" in spec), "minimalSpec should not have tasks");
    const errors = validateSchema(spec, schema);
    assert.deepEqual(
      errors,
      [],
      `spec without tasks should be valid, got: ${errors.join(" / ")}`,
    );
  });
});
