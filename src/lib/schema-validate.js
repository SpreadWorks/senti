/**
 * sdd-forge/lib/schema-validate.js
 *
 * Generic JSON Schema subset validator.
 * Supports: type, required, properties, additionalProperties, enum,
 * oneOf, items, minimum, minLength, minItems, deprecated.
 */

/**
 * Validate a value against a JSON Schema subset definition.
 *
 * @param {*} value - The value to validate
 * @param {Object} schema - Schema definition
 * @param {string} [path=""] - Current property path (for error messages)
 * @returns {string[]} Array of error messages (empty = valid)
 */
export function validateSchema(value, schema, path = "") {
  const errors = [];

  // oneOf — try each sub-schema, pass if exactly one matches
  if (schema.oneOf) {
    const matching = schema.oneOf.filter((sub) => validateSchema(value, sub, path).length === 0);
    if (matching.length === 0) {
      errors.push(`${path || "(root)"}: must match oneOf — no schema matched`);
    }
    return errors;
  }

  // deprecated — report error if value is present (caller handles presence check)
  if (schema.deprecated) {
    errors.push(`${path || "(root)"}: deprecated field`);
    return errors;
  }

  // type check
  if (schema.type) {
    if (!checkType(value, schema.type)) {
      errors.push(`${path || "(root)"}: must be ${schema.type}, got ${typeOf(value)}`);
      return errors; // no point checking further
    }
  }

  // enum
  if (schema.enum) {
    if (!schema.enum.includes(value)) {
      errors.push(`${path || "(root)"}: must be one of enum [${schema.enum.join(", ")}], got "${value}"`);
    }
  }

  // string constraints
  if (schema.type === "string") {
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push(`${path || "(root)"}: minLength ${schema.minLength}, got ${value.length}`);
    }
  }

  // number / integer constraints
  if (schema.type === "number" || schema.type === "integer") {
    if (schema.minimum != null && value < schema.minimum) {
      errors.push(`${path || "(root)"}: minimum ${schema.minimum}, got ${value}`);
    }
  }

  // array constraints
  if (schema.type === "array") {
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push(`${path || "(root)"}: minItems ${schema.minItems}, got ${value.length}`);
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        errors.push(...validateSchema(value[i], schema.items, `${path}[${i}]`));
      }
    }
  }

  // object constraints
  if (schema.type === "object") {
    // required
    if (schema.required) {
      for (const key of schema.required) {
        if (value[key] == null) {
          errors.push(`${path ? path + "." : ""}${key}: required field is missing`);
        }
      }
    }

    // properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const propPath = path ? `${path}.${key}` : key;
        if (value[key] == null) continue; // absent optional

        if (propSchema.deprecated) {
          errors.push(`${propPath}: deprecated field`);
          continue;
        }

        errors.push(...validateSchema(value[key], propSchema, propPath));
      }
    }

    // additionalProperties
    if (schema.additionalProperties !== undefined) {
      const known = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(value)) {
        if (known.has(key)) continue;
        const propPath = path ? `${path}.${key}` : key;
        if (schema.additionalProperties === false) {
          errors.push(`${propPath}: unknown field`);
        } else if (typeof schema.additionalProperties === "object") {
          errors.push(...validateSchema(value[key], schema.additionalProperties, propPath));
        }
      }
    }
  }

  return errors;
}

function checkType(value, type) {
  switch (type) {
    case "string": return typeof value === "string";
    case "number": return typeof value === "number";
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "object": return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array": return Array.isArray(value);
    default: return true;
  }
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
