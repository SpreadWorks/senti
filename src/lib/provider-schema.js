/**
 * Provider-specific JSON Schema preparation.
 *
 * The canonical application schemas use ordinary JSON Schema semantics, where
 * a property is optional unless it is listed in `required`. Some providers
 * expose a stricter structured-output dialect and require every property to
 * be required. Keep that dialect adaptation at the provider boundary so the
 * canonical artifact schema remains the source of truth.
 */

function isObjectSchema(schema) {
  return schema
    && typeof schema === "object"
    && !Array.isArray(schema)
    && (
      schema.properties
      || schema.type === "object"
      || (Array.isArray(schema.type) && schema.type.includes("object"))
    );
}

function addNullType(schema) {
  if (Array.isArray(schema.type)) {
    if (!schema.type.includes("null")) schema.type = [...schema.type, "null"];
    return schema;
  }
  if (typeof schema.type === "string") {
    schema.type = [schema.type, "null"];
    return schema;
  }
  if (Array.isArray(schema.anyOf)) {
    if (!schema.anyOf.some((entry) => entry?.type === "null")) {
      schema.anyOf = [...schema.anyOf, { type: "null" }];
    }
    return schema;
  }
  if (Array.isArray(schema.oneOf)) {
    if (!schema.oneOf.some((entry) => entry?.type === "null")) {
      schema.oneOf = [...schema.oneOf, { type: "null" }];
    }
    return schema;
  }
  return { anyOf: [schema, { type: "null" }] };
}

function strictifySchemaNode(node, optional = false) {
  if (Array.isArray(node)) return node.map((entry) => strictifySchemaNode(entry));
  if (!node || typeof node !== "object") return node;

  const result = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "properties") continue;
    result[key] = strictifySchemaNode(value);
  }

  if (isObjectSchema(node)) {
    const properties = node.properties && typeof node.properties === "object"
      ? node.properties
      : {};
    const originalRequired = new Set(Array.isArray(node.required) ? node.required : []);
    result.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        strictifySchemaNode(value, !originalRequired.has(key)),
      ]),
    );
    result.required = Object.keys(properties);
    result.additionalProperties = false;
  }

  return optional ? addNullType(result) : result;
}

/**
 * Adapt an application JSON Schema to the selected provider's output dialect.
 * Non-Codex providers receive an isolated copy without provider-specific
 * restrictions.
 */
export function adaptJsonSchemaForProvider(providerKey, schema) {
  if (schema == null) return null;
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error("provider JSON schema must be an object");
  }
  return providerKey === "codex"
    ? strictifySchemaNode(schema)
    : structuredClone(schema);
}
