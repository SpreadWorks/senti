import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadSpecJsonSchema } from "../../../src/lib/spec-json.js";
import { adaptJsonSchemaForProvider } from "../../../src/lib/provider-schema.js";

function objectSchemas(node, result = []) {
  if (!node || typeof node !== "object") return result;
  if (Array.isArray(node)) {
    for (const entry of node) objectSchemas(entry, result);
    return result;
  }
  if (node.properties || node.type === "object" || (Array.isArray(node.type) && node.type.includes("object"))) {
    result.push(node);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== "properties") objectSchemas(value, result);
  }
  for (const value of Object.values(node.properties || {})) objectSchemas(value, result);
  return result;
}

describe("provider JSON schema adaptation", () => {
  it("makes the canonical spec schema compatible with Codex strict output", () => {
    const canonical = loadSpecJsonSchema();
    const strict = adaptJsonSchemaForProvider("codex", canonical);

    for (const objectSchema of objectSchemas(strict)) {
      const propertyKeys = Object.keys(objectSchema.properties || {}).sort();
      assert.deepEqual([...objectSchema.required].sort(), propertyKeys);
      assert.equal(objectSchema.additionalProperties, false);
    }

    const modules = strict.properties.overview.properties.modules.items;
    assert.ok(modules.required.includes("added_by_task"));
    assert.deepEqual(modules.properties.added_by_task.type, ["string", "null"]);
    assert.deepEqual(canonical.properties.overview.properties.modules.items.required, ["text"]);
  });

  it("does not mutate the canonical schema", () => {
    const canonical = loadSpecJsonSchema();
    const before = JSON.stringify(canonical);
    adaptJsonSchemaForProvider("codex", canonical);
    assert.equal(JSON.stringify(canonical), before);
  });

  it("preserves ordinary JSON Schema semantics for non-Codex providers", () => {
    const canonical = loadSpecJsonSchema();
    const prepared = adaptJsonSchemaForProvider("claude", canonical);

    assert.notStrictEqual(prepared, canonical);
    assert.deepEqual(prepared, canonical);
  });
});
