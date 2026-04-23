/**
 * tests/unit/spec/spec-tasks-schema.test.js
 *
 * Tests for REQ-1 (spec 215): spec.json の tasks[] が schema バリデーションで
 * 正しく扱われることを検証する。origin の有効値は plan のみであること、
 * 必須フィールドが揃っていること、不正な値が reject されることを確認する。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateSchema } from "../../../src/lib/schema-validate.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../src/flow/schemas/spec.schema.json",
);
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));

function minSpec(extras = {}) {
  return {
    goal: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "",
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    ...extras,
  };
}

describe("spec.json tasks[] schema (REQ-1)", () => {
  it("accepts a valid plan-origin task", () => {
    const spec = minSpec({
      tasks: [
        { id: "T-1", title: "First task", description: "", origin: "plan", added_round: 0, status: "pending" },
      ],
    });
    const errors = validateSchema(spec, schema);
    assert.deepEqual(errors, []);
  });

  it("rejects origin='addition'", () => {
    const spec = minSpec({
      tasks: [
        { id: "T-1", title: "x", origin: "addition", added_round: 0, status: "pending" },
      ],
    });
    const errors = validateSchema(spec, schema);
    assert.ok(errors.some((e) => /origin/.test(e)), `expected origin error, got: ${errors.join("; ")}`);
  });

  it("rejects origin='integration'", () => {
    const spec = minSpec({
      tasks: [
        { id: "T-1", title: "x", origin: "integration", added_round: 0, status: "pending" },
      ],
    });
    const errors = validateSchema(spec, schema);
    assert.ok(errors.some((e) => /origin/.test(e)));
  });

  it("rejects negative added_round", () => {
    const spec = minSpec({
      tasks: [
        { id: "T-1", title: "x", origin: "plan", added_round: -1, status: "pending" },
      ],
    });
    const errors = validateSchema(spec, schema);
    assert.ok(errors.some((e) => /added_round/.test(e)));
  });

  it("rejects non-integer added_round", () => {
    const spec = minSpec({
      tasks: [
        { id: "T-1", title: "x", origin: "plan", added_round: 1.5, status: "pending" },
      ],
    });
    const errors = validateSchema(spec, schema);
    assert.ok(errors.some((e) => /added_round/.test(e)));
  });

  it("rejects invalid status", () => {
    const spec = minSpec({
      tasks: [
        { id: "T-1", title: "x", origin: "plan", added_round: 0, status: "invalid" },
      ],
    });
    const errors = validateSchema(spec, schema);
    assert.ok(errors.some((e) => /status/.test(e)));
  });

  it("rejects empty id", () => {
    const spec = minSpec({
      tasks: [
        { id: "", title: "x", origin: "plan", added_round: 0, status: "pending" },
      ],
    });
    const errors = validateSchema(spec, schema);
    assert.ok(errors.length > 0);
  });

  it("rejects empty title", () => {
    const spec = minSpec({
      tasks: [
        { id: "T-1", title: "", origin: "plan", added_round: 0, status: "pending" },
      ],
    });
    const errors = validateSchema(spec, schema);
    assert.ok(errors.length > 0);
  });

  it("rejects missing required fields", () => {
    const spec = minSpec({ tasks: [{ id: "T-1", title: "x" }] });
    const errors = validateSchema(spec, schema);
    assert.ok(errors.length > 0);
  });

  it("accepts empty tasks[]", () => {
    const spec = minSpec({ tasks: [] });
    const errors = validateSchema(spec, schema);
    assert.deepEqual(errors, []);
  });

  it("accepts spec without tasks field (optional)", () => {
    const spec = minSpec({});
    const errors = validateSchema(spec, schema);
    assert.deepEqual(errors, []);
  });

  it("accepts multiple tasks with different added_round", () => {
    const spec = minSpec({
      tasks: [
        { id: "T-1", title: "a", description: "", origin: "plan", added_round: 0, status: "done" },
        { id: "T-2", title: "b", description: "", origin: "plan", added_round: 0, status: "in_progress" },
        { id: "T-3", title: "c", description: "", origin: "plan", added_round: 1, status: "pending" },
      ],
    });
    const errors = validateSchema(spec, schema);
    assert.deepEqual(errors, []);
  });
});
