/**
 * senti/lib/spec-json.js
 *
 * Spec JSON I/O — the single load path for spec.json.
 * Core wiring (gate / review / retro / merge / finalize / changelog / forge /
 * metrics / prepare-spec) reads spec content through this module. spec.md is
 * a render-derived artifact and must not be parsed for content.
 *
 * Part of cac6/T8 (spec 207).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchema } from "./schema-validate.js";

const SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "flow",
  "schemas",
  "spec.schema.json",
);

let cachedSchema = null;

function loadSchema() {
  if (!cachedSchema) {
    cachedSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  }
  return cachedSchema;
}

/**
 * Resolve a caller-provided path (directory, `.json`, or `.md`) to the
 * concrete spec.json file path.
 */
export function resolveSpecJsonPath(input) {
  if (!input) throw new Error("resolveSpecJsonPath: path is required");
  let stat;
  try {
    stat = fs.statSync(input);
  } catch {
    stat = null;
  }
  if (stat?.isDirectory()) {
    return path.join(input, "spec.json");
  }
  if (input.endsWith(".json")) return input;
  if (input.endsWith(".md")) {
    return path.join(path.dirname(input), "spec.json");
  }
  return path.join(input, "spec.json");
}

/**
 * Resolve the spec directory (containing spec.json / spec.md) from any input.
 */
export function resolveSpecDir(input) {
  if (!input) throw new Error("resolveSpecDir: path is required");
  let stat;
  try {
    stat = fs.statSync(input);
  } catch {
    stat = null;
  }
  if (stat?.isDirectory()) return input;
  if (input.endsWith(".json") || input.endsWith(".md")) {
    return path.dirname(input);
  }
  return input;
}

/**
 * Load and schema-validate spec.json from a path (directory / `.json` / `.md`).
 * Returns the parsed plain object.
 *
 * @param {string} input - spec directory, spec.json path, or spec.md path
 * @param {{ validate?: boolean }} [options]
 * @returns {object}
 */
export function loadSpecJson(input, { validate = true } = {}) {
  const jsonPath = resolveSpecJsonPath(input);
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`spec.json not found at ${jsonPath}`);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (err) {
    throw new Error(`failed to parse spec.json at ${jsonPath}: ${err.message}`);
  }
  if (validate) {
    validateSpecJsonObject(data);
  }
  return data;
}

export function validateSpecJsonObject(spec) {
  const errors = validateSchema(spec, loadSchema());
  if (errors.length > 0) {
    throw new Error(`spec.json failed schema validation: ${errors.join("; ")}`);
  }
  return spec;
}

/**
 * Try-load variant that returns null when spec.json is missing (for existence
 * checks) and throws for parse/validation errors.
 */
export function tryLoadSpecJson(input, options) {
  const jsonPath = resolveSpecJsonPath(input);
  if (!fs.existsSync(jsonPath)) return null;
  return loadSpecJson(input, options);
}

/**
 * Persist a spec object back to spec.json. Validates against spec.schema.json
 * before writing so callers cannot accidentally corrupt the file.
 */
export function saveSpecJson(input, spec, { validate = true } = {}) {
  const jsonPath = resolveSpecJsonPath(input);
  if (validate) {
    validateSpecJsonObject(spec);
  }
  fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2) + "\n", "utf8");
}

/**
 * Normalize a requirements array so every entry has a concrete `status` field.
 * Entries whose `status` is missing are treated as "pending" (spec 219 R7).
 */
export function normalizeRequirements(reqs) {
  if (!Array.isArray(reqs)) return [];
  return reqs.map((r) => ({ ...r, status: r.status ?? "pending" }));
}

/**
 * Enumerate requirement IDs from spec.json for gate source selection.
 * Usable IDs are trimmed non-empty strings, de-duplicated in first-seen order.
 */
export function enumerateUsableRequirementIds(spec) {
  const reqs = Array.isArray(spec?.requirements) ? spec.requirements : [];
  const ids = [];
  const seen = new Set();
  for (const req of reqs) {
    if (!req || typeof req !== "object") continue;
    if (typeof req.id !== "string") continue;
    const id = req.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Load and normalize `spec.json.requirements` for a given flow context.
 * Returns [] when spec.json does not yet exist (e.g. preparing flow) so
 * callers in the status/resume paths never have to guard the read.
 *
 * @param {string} root - repository or worktree root
 * @param {string|null|undefined} specPath - path stored in flow.json (`state.spec`)
 * @returns {Array<{id?: string, desc: string, priority?: string, status: string}>}
 */
export function loadSpecRequirements(root, specPath) {
  if (!root || !specPath) return [];
  const absPath = path.isAbsolute(specPath) ? specPath : path.resolve(root, specPath);
  const spec = tryLoadSpecJson(absPath, { validate: false });
  if (!spec) return [];
  return normalizeRequirements(spec.requirements);
}

/**
 * Update a single requirement's `status` in spec.json and write the file back.
 * Throws when the index is out of range or the spec fails schema validation.
 *
 * @param {string} root - repository or worktree root
 * @param {string} specPath - path stored in flow.json (`state.spec`)
 * @param {number} index - 0-based index into spec.requirements
 * @param {string} status - one of the schema-allowed status values
 */
export function updateSpecRequirementStatus(root, specPath, index, status) {
  if (!root) throw new Error("updateSpecRequirementStatus: root is required");
  if (!specPath) throw new Error("updateSpecRequirementStatus: specPath is required");
  const absPath = path.isAbsolute(specPath) ? specPath : path.resolve(root, specPath);
  const spec = loadSpecJson(absPath, { validate: false });
  if (!Array.isArray(spec.requirements) || !spec.requirements[index]) {
    throw new Error(`requirement index out of range: ${index}`);
  }
  spec.requirements[index] = { ...spec.requirements[index], status };
  saveSpecJson(absPath, spec);
  return spec.requirements[index];
}

/**
 * Build the minimum valid spec object used when scaffolding a new spec.json.
 */
export function emptySpecStub() {
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
  };
}

/**
 * Flatten spec.json into a plain-text blob suitable for AI prompt consumption
 * (when a legacy consumer previously passed the full spec.md text).
 */
export function specJsonToPromptText(spec, meta = {}) {
  const lines = [];
  if (meta.title) lines.push(`# ${meta.title}`, "");
  lines.push("## Goal", spec.goal || "-", "");
  if (spec.background) lines.push("## Background", spec.background, "");
  lines.push(
    "## Scope",
    ...(spec.scope?.in?.map((s) => `- ${s}`) || ["-"]),
    "",
    "## Out of Scope",
    ...(spec.scope?.out?.map((s) => `- ${s}`) || ["-"]),
    "",
  );
  if (spec.constraints?.length) {
    lines.push("## Constraints", ...spec.constraints.map((s) => `- ${s}`), "");
  }
  if (spec.requirements?.length) {
    lines.push(
      "## Requirements",
      ...spec.requirements.map((r) => `- ${r.id}${r.priority ? ` [${r.priority}]` : ""}: ${r.desc}`),
      "",
    );
  }
  if (spec.acceptance_criteria?.length) {
    lines.push("## Acceptance Criteria", ...spec.acceptance_criteria.map((s) => `- ${s}`), "");
  }
  if (spec.clarifications?.length) {
    lines.push(
      "## Clarifications",
      ...spec.clarifications.flatMap((c) => [`- Q: ${c.q}`, `  - A: ${c.a}`]),
      "",
    );
  }
  if (spec.alternatives_considered?.length) {
    lines.push(
      "## Alternatives Considered",
      ...spec.alternatives_considered.map((a) => `- ${a.option} — ${a.reason}`),
      "",
    );
  }
  if (spec.open_questions?.length) {
    lines.push("## Open Questions", ...spec.open_questions.map((s) => `- ${s}`), "");
  }
  return lines.join("\n");
}
