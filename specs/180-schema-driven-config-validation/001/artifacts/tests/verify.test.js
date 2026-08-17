import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const SRC_ROOT = path.resolve(import.meta.dirname, "../../../src");

describe("spec-180 acceptance criteria", () => {
  it("validate() accepts a valid config without error", async () => {
    const { validate } = await import(path.join(SRC_ROOT, "lib/config.js"));
    const validConfig = {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    };
    const result = validate({ ...validConfig });
    assert.equal(result.lang, "ja");
  });

  it("validate() throws on unknown fields", async () => {
    const { validate } = await import(path.join(SRC_ROOT, "lib/config.js"));
    const config = {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      unknownField: 1,
    };
    assert.throws(() => validate(config), /unknownField/);
  });

  it("validate() throws on deprecated fields", async () => {
    const { validate } = await import(path.join(SRC_ROOT, "lib/config.js"));
    const config = {
      lang: "ja",
      type: "node-cli",
      output: { default: "ja" },
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    };
    assert.throws(() => validate(config), /deprecated/i);
  });

  it("error messages include field path and reason", async () => {
    const { validate } = await import(path.join(SRC_ROOT, "lib/config.js"));
    const config = {
      lang: 123,
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    };
    try {
      validate(config);
      assert.fail("should have thrown");
    } catch (e) {
      assert.match(e.message, /lang/);
    }
  });

  it("validate() throws when defaultLanguage is not in languages", async () => {
    const { validate } = await import(path.join(SRC_ROOT, "lib/config.js"));
    const config = {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja", "en"], defaultLanguage: "zh" },
    };
    assert.throws(() => validate(config), /defaultLanguage/);
  });

  it("validate() throws when profile references undefined provider", async () => {
    const { validate } = await import(path.join(SRC_ROOT, "lib/config.js"));
    const config = {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      agent: {
        profiles: {
          default: {
            "docs.text": "nonexistent/provider",
          },
        },
      },
    };
    assert.throws(() => validate(config), /nonexistent/);
  });

  it("validateConfig does not exist in types.js", async () => {
    const types = await import(path.join(SRC_ROOT, "lib/types.js"));
    assert.equal(types.validateConfig, undefined);
  });

  it("config.example.json does not exist", () => {
    const examplePath = path.join(SRC_ROOT, "templates/config.example.json");
    assert.equal(fs.existsSync(examplePath), false);
  });

  it("schema-validate.js works with non-config schemas", async () => {
    const { validateSchema } = await import(path.join(SRC_ROOT, "lib/schema-validate.js"));
    const schema = {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "number", minimum: 1 },
        tags: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    };
    const errors = validateSchema({ id: 5, tags: ["a"] }, schema);
    assert.equal(errors.length, 0);
  });
});
