/**
 * tests/unit/spec/spec-user-approval-schema.test.js
 *
 * spec 221 R4: spec.json の schema が optional な user_approval オブジェクトを
 * 受け入れ、未知のサブプロパティを拒否することを検証する。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchema } from "../../../src/lib/schema-validate.js";

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
    tasks: [],
    ...extras,
  };
}

describe("spec.json schema — user_approval (spec 221 R4)", () => {
  it("accepts a spec without user_approval (optional field)", () => {
    const errors = validateSchema(minSpec(), schema);
    assert.deepEqual(errors, []);
  });

  it("accepts user_approval with all properties", () => {
    const errors = validateSchema(
      minSpec({
        user_approval: {
          approved: true,
          confirmed_at: "2026-04-23T00:00:00.000Z",
          notes: "ok",
        },
      }),
      schema,
    );
    assert.deepEqual(errors, []);
  });

  it("accepts user_approval with only `approved`", () => {
    const errors = validateSchema(
      minSpec({ user_approval: { approved: false } }),
      schema,
    );
    assert.deepEqual(errors, []);
  });

  it("rejects unknown sub-properties under user_approval", () => {
    const errors = validateSchema(
      minSpec({
        user_approval: {
          approved: true,
          confirmed_at: "2026-04-23T00:00:00.000Z",
          notes: "ok",
          unknown_field: "x",
        },
      }),
      schema,
    );
    assert.ok(errors.length > 0, "expected schema rejection for unknown sub-property");
  });

  it("rejects non-boolean approved", () => {
    const errors = validateSchema(
      minSpec({ user_approval: { approved: "yes" } }),
      schema,
    );
    assert.ok(errors.length > 0, "expected schema rejection for non-boolean approved");
  });

  it("rejects non-string confirmed_at", () => {
    const errors = validateSchema(
      minSpec({ user_approval: { approved: true, confirmed_at: 12345 } }),
      schema,
    );
    assert.ok(errors.length > 0, "expected schema rejection for non-string confirmed_at");
  });
});
