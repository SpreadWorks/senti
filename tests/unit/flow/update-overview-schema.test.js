import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateSchema } from "../../../src/lib/schema-validate.js";

const SCHEMA_PATH = path.resolve(
  import.meta.dirname,
  "../../../src/flow/schemas/next-action/update-overview.schema.json",
);

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

describe("next-action/update-overview.schema.json (spec 207)", () => {
  it("accepts a well-formed additions-only payload", () => {
    const schema = loadSchema();
    const errors = validateSchema(
      {
        updated: true,
        additions: {
          modules: ["src/x.js"],
          data_flow: ["a -> b"],
          decisions: ["use X"],
        },
      },
      schema,
    );
    assert.deepEqual(errors, []);
  });

  it("accepts empty additions arrays", () => {
    const schema = loadSchema();
    const errors = validateSchema(
      { updated: true, additions: { modules: [], data_flow: [], decisions: [] } },
      schema,
    );
    assert.deepEqual(errors, []);
  });

  it("rejects payloads that include a removals field", () => {
    const schema = loadSchema();
    const errors = validateSchema(
      {
        updated: true,
        additions: { modules: [], data_flow: [], decisions: [] },
        removals: { modules: [0] },
      },
      schema,
    );
    assert.ok(errors.length > 0);
  });

  it("rejects payloads that include a modifications field", () => {
    const schema = loadSchema();
    const errors = validateSchema(
      {
        updated: true,
        additions: { modules: [], data_flow: [], decisions: [] },
        modifications: [],
      },
      schema,
    );
    assert.ok(errors.length > 0);
  });

  it("rejects unknown overview categories inside additions", () => {
    const schema = loadSchema();
    const errors = validateSchema(
      {
        updated: true,
        additions: { modules: [], data_flow: [], decisions: [], strategies: [] },
      },
      schema,
    );
    assert.ok(errors.length > 0);
  });

  it("rejects non-string entries inside additions categories", () => {
    const schema = loadSchema();
    const errors = validateSchema(
      {
        updated: true,
        additions: { modules: [{ text: "nope" }], data_flow: [], decisions: [] },
      },
      schema,
    );
    assert.ok(errors.length > 0);
  });
});
