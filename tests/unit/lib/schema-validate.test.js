import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateSchema } from "../../../src/lib/schema-validate.js";

describe("validateSchema", () => {
  describe("type checking", () => {
    it("validates string type", () => {
      const errors = validateSchema("hello", { type: "string" });
      assert.equal(errors.length, 0);
    });

    it("rejects non-string for string type", () => {
      const errors = validateSchema(123, { type: "string" });
      assert.equal(errors.length, 1);
      assert.match(errors[0], /string/);
    });

    it("validates number type", () => {
      const errors = validateSchema(42, { type: "number" });
      assert.equal(errors.length, 0);
    });

    it("rejects non-number for number type", () => {
      const errors = validateSchema("abc", { type: "number" });
      assert.equal(errors.length, 1);
    });

    it("validates boolean type", () => {
      const errors = validateSchema(true, { type: "boolean" });
      assert.equal(errors.length, 0);
    });

    it("validates object type", () => {
      const errors = validateSchema({}, { type: "object" });
      assert.equal(errors.length, 0);
    });

    it("rejects null for object type", () => {
      const errors = validateSchema(null, { type: "object" });
      assert.equal(errors.length, 1);
    });

    it("validates array type", () => {
      const errors = validateSchema([], { type: "array" });
      assert.equal(errors.length, 0);
    });

    it("rejects object for array type", () => {
      const errors = validateSchema({}, { type: "array" });
      assert.equal(errors.length, 1);
    });

    it("validates union type arrays", () => {
      assert.equal(validateSchema("x", { type: ["string", "null"] }).length, 0);
      assert.equal(validateSchema(null, { type: ["string", "null"] }).length, 0);
      const errors = validateSchema(123, { type: ["string", "null"] });
      assert.equal(errors.length, 1);
      assert.match(errors[0], /string,null/);
    });

    it("validates object constraints for nullable object union", () => {
      const schema = {
        type: ["object", "null"],
        properties: {
          file: { type: "string" },
          locator: { type: ["string", "null"] },
        },
        required: ["file", "locator"],
        additionalProperties: false,
      };

      assert.equal(validateSchema(null, schema).length, 0);
      assert.equal(validateSchema({ file: "a.js", locator: null }, schema).length, 0);

      const errors = validateSchema({ file: "a.js" }, schema);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /locator/);
    });
  });

  describe("required", () => {
    it("passes when all required properties exist", () => {
      const schema = { type: "object", required: ["a", "b"], properties: { a: { type: "string" }, b: { type: "number" } } };
      const errors = validateSchema({ a: "x", b: 1 }, schema);
      assert.equal(errors.length, 0);
    });

    it("fails when required property is missing", () => {
      const schema = { type: "object", required: ["a"], properties: { a: { type: "string" } } };
      const errors = validateSchema({}, schema);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /a/);
    });

    it("rejects null for a required string property", () => {
      const schema = { type: "object", required: ["a"], properties: { a: { type: "string" } } };
      const errors = validateSchema({ a: null }, schema);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /a.*string/);
    });
  });

  describe("properties", () => {
    it("validates nested object properties", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      };
      const errors = validateSchema({ name: "test", age: 10 }, schema);
      assert.equal(errors.length, 0);
    });

    it("reports errors for invalid nested properties", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };
      const errors = validateSchema({ name: 123 }, schema);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /name/);
    });

    it("skips absent optional properties", () => {
      const schema = {
        type: "object",
        properties: {
          optional: { type: "string" },
        },
      };
      const errors = validateSchema({}, schema);
      assert.equal(errors.length, 0);
    });
  });

  describe("additionalProperties", () => {
    it("rejects unknown properties when false", () => {
      const schema = {
        type: "object",
        properties: { a: { type: "string" } },
        additionalProperties: false,
      };
      const errors = validateSchema({ a: "x", b: 1 }, schema);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /b/);
    });

    it("validates unknown properties against schema when object", () => {
      const schema = {
        type: "object",
        properties: {},
        additionalProperties: { type: "number" },
      };
      const errors = validateSchema({ x: 1, y: 2 }, schema);
      assert.equal(errors.length, 0);
    });

    it("rejects unknown properties that don't match schema", () => {
      const schema = {
        type: "object",
        properties: {},
        additionalProperties: { type: "number" },
      };
      const errors = validateSchema({ x: "not a number" }, schema);
      assert.equal(errors.length, 1);
    });
  });

  describe("enum", () => {
    it("passes when value is in enum", () => {
      const errors = validateSchema("a", { type: "string", enum: ["a", "b", "c"] });
      assert.equal(errors.length, 0);
    });

    it("fails when value is not in enum", () => {
      const errors = validateSchema("d", { type: "string", enum: ["a", "b", "c"] });
      assert.equal(errors.length, 1);
      assert.match(errors[0], /enum/i);
    });
  });

  describe("oneOf", () => {
    it("passes when value matches one schema", () => {
      const schema = {
        oneOf: [
          { type: "string" },
          { type: "number" },
        ],
      };
      const errors = validateSchema("hello", schema);
      assert.equal(errors.length, 0);
    });

    it("fails when value matches no schema", () => {
      const schema = {
        oneOf: [
          { type: "string" },
          { type: "number" },
        ],
      };
      const errors = validateSchema(true, schema);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /oneOf/i);
    });
  });

  describe("items", () => {
    it("validates array items against schema", () => {
      const schema = { type: "array", items: { type: "string" } };
      const errors = validateSchema(["a", "b"], schema);
      assert.equal(errors.length, 0);
    });

    it("reports errors for invalid array items", () => {
      const schema = { type: "array", items: { type: "string" } };
      const errors = validateSchema(["a", 123], schema);
      assert.equal(errors.length, 1);
    });
  });

  describe("minimum", () => {
    it("passes when value meets minimum", () => {
      const errors = validateSchema(5, { type: "number", minimum: 1 });
      assert.equal(errors.length, 0);
    });

    it("fails when value is below minimum", () => {
      const errors = validateSchema(0, { type: "number", minimum: 1 });
      assert.equal(errors.length, 1);
      assert.match(errors[0], /minimum/i);
    });
  });

  describe("minLength", () => {
    it("passes when string meets minLength", () => {
      const errors = validateSchema("ab", { type: "string", minLength: 1 });
      assert.equal(errors.length, 0);
    });

    it("fails when string is too short", () => {
      const errors = validateSchema("", { type: "string", minLength: 1 });
      assert.equal(errors.length, 1);
      assert.match(errors[0], /minLength/i);
    });
  });

  describe("minItems", () => {
    it("passes when array meets minItems", () => {
      const errors = validateSchema(["a"], { type: "array", minItems: 1 });
      assert.equal(errors.length, 0);
    });

    it("fails when array has too few items", () => {
      const errors = validateSchema([], { type: "array", minItems: 1 });
      assert.equal(errors.length, 1);
      assert.match(errors[0], /minItems/i);
    });
  });

  describe("deprecated", () => {
    it("reports error when deprecated property is present", () => {
      const schema = {
        type: "object",
        properties: {
          old: { deprecated: true },
        },
      };
      const errors = validateSchema({ old: "value" }, schema);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /deprecated/i);
    });

    it("does not report when deprecated property is absent", () => {
      const schema = {
        type: "object",
        properties: {
          old: { deprecated: true },
        },
      };
      const errors = validateSchema({}, schema);
      assert.equal(errors.length, 0);
    });
  });

  describe("error paths", () => {
    it("includes full path in error messages", () => {
      const schema = {
        type: "object",
        properties: {
          nested: {
            type: "object",
            properties: {
              deep: { type: "string" },
            },
          },
        },
      };
      const errors = validateSchema({ nested: { deep: 123 } }, schema);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /nested\.deep/);
    });
  });

  describe("generality", () => {
    it("works with arbitrary schemas (not config-specific)", () => {
      const userSchema = {
        type: "object",
        required: ["name", "email"],
        properties: {
          name: { type: "string", minLength: 1 },
          email: { type: "string" },
          age: { type: "number", minimum: 0 },
        },
        additionalProperties: false,
      };
      const errors = validateSchema({ name: "Alice", email: "a@b.com" }, userSchema);
      assert.equal(errors.length, 0);

      const errors2 = validateSchema({ name: "", email: "a@b.com", extra: true }, userSchema);
      assert.equal(errors2.length, 2); // minLength + additionalProperties
    });
  });
});
