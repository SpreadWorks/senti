import path from "node:path";

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function repositoryPath(value, field) {
  const candidate = requiredText(value, field).replaceAll("\\", "/");
  if (
    path.posix.isAbsolute(candidate)
    || path.posix.normalize(candidate) !== candidate
    || candidate.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`${field} must be a normalized repository-relative path`);
  }
  return candidate;
}

function specRequirementIds(spec) {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error("canonical file-map Spec must be an object");
  }
  if (!Array.isArray(spec.requirements)) {
    throw new Error("canonical file-map Spec requirements must be an array");
  }
  return new Set(spec.requirements.map((entry) => (
    entry?.id == null ? null : requiredText(entry.id, "canonical Spec requirement id")
  )).filter(Boolean));
}

/**
 * The structured, cataloged requirement-to-file authority shared by
 * implementation, review, gate, and report consumers.
 */
export class CanonicalFileMap {
  constructor(value = {}) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("canonical file-map must be an object");
    }
    const entries = [];
    for (const [rawRequirementId, rawPaths] of Object.entries(value)) {
      const requirementId = requiredText(rawRequirementId, "canonical file-map requirement id");
      if (!Array.isArray(rawPaths) || rawPaths.length === 0) {
        throw new Error(`canonical file-map ${requirementId} paths must be a non-empty array`);
      }
      const paths = [...new Set(rawPaths.map((entry) => (
        repositoryPath(entry, `canonical file-map ${requirementId} path`)
      )))];
      entries.push(Object.freeze([requirementId, Object.freeze(paths)]));
    }
    this.entries = Object.freeze(entries);
    Object.freeze(this);
  }

  static fromBytes(bytes) {
    if (!Buffer.isBuffer(bytes)) throw new Error("canonical file-map bytes must be a Buffer");
    let parsed;
    try {
      parsed = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      throw new Error(`canonical file-map must be JSON: ${error.message}`);
    }
    return new CanonicalFileMap(parsed);
  }

  assertAgainstSpec(spec) {
    const known = specRequirementIds(spec);
    for (const [requirementId] of this.entries) {
      if (!known.has(requirementId)) {
        throw new Error(`requirement id not found: ${requirementId}`);
      }
    }
    return this;
  }

  withRequirement(requirementId, paths) {
    const id = requiredText(requirementId, "canonical file-map requirementId");
    if (!Array.isArray(paths) || paths.length === 0) {
      throw new Error("canonical file-map paths must be a non-empty array");
    }
    const next = this.toJSON();
    next[id] = [...new Set([
      ...(next[id] ?? []),
      ...paths.map((entry) => repositoryPath(entry, "canonical file-map path")),
    ])];
    return new CanonicalFileMap(next);
  }

  get empty() {
    return this.entries.length === 0;
  }

  toJSON() {
    return Object.fromEntries(this.entries.map(([requirementId, paths]) => [requirementId, [...paths]]));
  }
}

/** One typed, append-only-in-meaning update to the shared file-map. */
export class CanonicalFileMapUpdate {
  constructor({ requirementId, paths } = {}) {
    this.requirementId = requiredText(requirementId, "canonical file-map requirementId");
    if (!Array.isArray(paths) || paths.length === 0) {
      throw new Error("canonical file-map paths must be a non-empty array");
    }
    this.paths = Object.freeze(paths.map((entry) => repositoryPath(entry, "canonical file-map path")));
    Object.freeze(this);
  }

  apply({ spec, fileMap }) {
    const known = specRequirementIds(spec);
    if (!known.has(this.requirementId)) {
      throw new Error(`requirement id not found: ${this.requirementId}`);
    }
    return new CanonicalFileMap(fileMap)
      .assertAgainstSpec(spec)
      .withRequirement(this.requirementId, this.paths)
      .toJSON();
  }
}
