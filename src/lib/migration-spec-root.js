import fs from "node:fs";
import path from "node:path";

import { MigrationBlocker } from "./migration.js";
import { LEGACY_MANAGED_DIRECTORY_NAMES } from "./legacy-managed-directory-migration.js";
import { PRODUCT } from "./product.js";

function readObject(filePath, label) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must contain an object`);
  }
  return value;
}

function configuredSpecDir(config, label) {
  const value = config.flow?.specDir;
  if (value == null) return "specs";
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label}.flow.specDir must be a non-empty relative path`);
  const normalized = value.trim().replaceAll("\\", "/");
  if (path.posix.isAbsolute(normalized) || normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${label}.flow.specDir must be a normalized relative path`);
  }
  return normalized;
}

function configAt(directory) {
  const configPath = path.join(directory, "config.json");
  if (!fs.existsSync(configPath)) return null;
  const stat = fs.lstatSync(configPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${configPath} must be a regular file`);
  return { path: configPath, config: readObject(configPath, configPath) };
}

/** Resolves the sole project spec root used by revisioned specs migrations. */
export class MigrationSpecRoot {
  constructor({ root, relativePath, authority } = {}) {
    this.root = path.resolve(root);
    if (typeof relativePath !== "string" || relativePath === "") throw new Error("migration spec root path is required");
    if (path.posix.isAbsolute(relativePath) || relativePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
      throw new Error("migration spec root path is invalid");
    }
    if (!new Set(["canonical", "legacy", "default"]).has(authority)) throw new Error("migration spec root authority is invalid");
    this.relativePath = relativePath;
    this.authority = authority;
    this.path = path.join(this.root, ...relativePath.split("/"));
    Object.freeze(this);
  }
}

/**
 * Returns either a resolved root or a typed project blocker.  This is kept at
 * the system boundary so individual spec adapters never choose a different
 * root from each other.
 */
export function resolveMigrationSpecRoot(root) {
  const projectRoot = path.resolve(root);
  const canonicalDirectory = path.join(projectRoot, PRODUCT.managedDirName);
  try {
    // A managed directory is not an authority by itself.  Layout migration
    // can leave retired directories beside the canonical one, and a clean
    // checkout may deliberately contain more than one such directory while
    // only the canonical config owns the Flow root.  Read configuration
    // records first, then resolve their explicit authority order.
    const canonical = fs.existsSync(canonicalDirectory) ? configAt(canonicalDirectory) : null;
    const legacy = LEGACY_MANAGED_DIRECTORY_NAMES
      .map((name) => ({ name, directory: path.join(projectRoot, name) }))
      .filter(({ directory }) => fs.existsSync(directory))
      .flatMap(({ name, directory }) => {
        const configuration = configAt(directory);
        return configuration === null ? [] : [{ name, ...configuration }];
      });
    const canonicalSpecDir = canonical === null ? null : configuredSpecDir(canonical.config, canonical.path);
    const legacySpecDirs = legacy.map((entry) => ({
      name: entry.name,
      path: entry.path,
      relativePath: configuredSpecDir(entry.config, entry.path),
    }));

    // Canonical configuration wins, but every actual legacy configuration
    // must agree with it.  A directory without config has no competing
    // authority and therefore cannot make this decision ambiguous.
    const conflictingLegacy = canonicalSpecDir === null
      ? null
      : legacySpecDirs.find((entry) => entry.relativePath !== canonicalSpecDir);
    if (conflictingLegacy !== null && conflictingLegacy !== undefined) {
      return { blocker: new MigrationBlocker({
        code: "SPEC_ROOT_CONFLICT",
        message: `canonical and legacy configuration disagree on flow.specDir (${canonicalSpecDir} / ${conflictingLegacy.relativePath})`,
      }) };
    }
    if (canonicalSpecDir !== null) return { root: new MigrationSpecRoot({ root: projectRoot, relativePath: canonicalSpecDir, authority: "canonical" }) };
    // Without canonical configuration there may be at most one legacy
    // configuration authority.  Equal values do not turn two independent
    // legacy authority records into one authoritative source: either could
    // change independently before the next migration invocation.
    if (legacySpecDirs.length > 1) {
      return { blocker: new MigrationBlocker({
        code: "MULTIPLE_LEGACY_SPEC_ROOT_AUTHORITIES",
        message: `multiple legacy configurations define flow.specDir (${legacySpecDirs.map((entry) => `${entry.name}:${entry.relativePath}`).join(", ")})`,
      }) };
    }
    if (legacySpecDirs.length === 1) {
      return { root: new MigrationSpecRoot({ root: projectRoot, relativePath: legacySpecDirs[0].relativePath, authority: "legacy" }) };
    }
    return { root: new MigrationSpecRoot({ root: projectRoot, relativePath: "specs", authority: "default" }) };
  } catch (error) {
    return { blocker: new MigrationBlocker({ code: "SPEC_ROOT_CONFIG_INVALID", message: error.message }) };
  }
}

export { LEGACY_MANAGED_DIRECTORY_NAMES };
