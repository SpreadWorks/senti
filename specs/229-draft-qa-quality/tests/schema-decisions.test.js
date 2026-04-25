import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// spec 229 R7: spec.schema.json の decisions に evidence/consideredAlternatives を追加

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, "../../../src/flow/schemas/spec.schema.json");

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

describe("spec.schema.json decisions — R7: evidence/consideredAlternatives", () => {
  it("decisions items allow evidence field", () => {
    const schema = loadSchema();
    const props = schema.properties.overview.properties.decisions.items.properties;
    assert.ok("evidence" in props, "decisions items must have evidence property");
    assert.equal(props.evidence.type, "string");
  });

  it("decisions items allow consideredAlternatives field", () => {
    const schema = loadSchema();
    const props = schema.properties.overview.properties.decisions.items.properties;
    assert.ok("consideredAlternatives" in props, "decisions items must have consideredAlternatives property");
    assert.equal(props.consideredAlternatives.type, "string");
  });

  it("evidence and consideredAlternatives are optional (not in required)", () => {
    const schema = loadSchema();
    const required = schema.properties.overview.properties.decisions.items.required;
    assert.ok(!required.includes("evidence"), "evidence must not be required");
    assert.ok(!required.includes("consideredAlternatives"), "consideredAlternatives must not be required");
  });

  it("text remains required", () => {
    const schema = loadSchema();
    const required = schema.properties.overview.properties.decisions.items.required;
    assert.ok(required.includes("text"), "text must remain required");
  });
});
