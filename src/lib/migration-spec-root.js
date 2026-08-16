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
  const canonical = fs.existsSync(canonicalDirectory) ? configAt(canonicalDirectory) : null;
  const legacyDirectories = LEGACY_MANAGED_DIRECTORY_NAMES
    .map((name) => path.join(projectRoot, name))
    .filter((directory) => fs.existsSync(directory));
  if (legacyDirectories.length > 1) {
    return { blocker: new MigrationBlocker({
      code: "MULTIPLE_LEGACY_MANAGED_DIRECTORIES",
      message: `cannot resolve a spec root from multiple legacy managed directories: ${legacyDirectories.map((directory) => path.basename(directory)).join(", ")}`,
    }) };
  }
  let legacy = null;
  try {
    legacy = legacyDirectories.length === 1 ? configAt(legacyDirectories[0]) : null;
    const canonicalSpecDir = canonical === null ? null : configuredSpecDir(canonical.config, canonical.path);
    const legacySpecDir = legacy === null ? null : configuredSpecDir(legacy.config, legacy.path);
    if (canonicalSpecDir !== null && legacySpecDir !== null && canonicalSpecDir !== legacySpecDir) {
      return { blocker: new MigrationBlocker({
        code: "SPEC_ROOT_CONFLICT",
        message: `canonical and legacy configuration disagree on flow.specDir (${canonicalSpecDir} / ${legacySpecDir})`,
      }) };
    }
    if (canonicalSpecDir !== null) return { root: new MigrationSpecRoot({ root: projectRoot, relativePath: canonicalSpecDir, authority: "canonical" }) };
    if (legacySpecDir !== null) return { root: new MigrationSpecRoot({ root: projectRoot, relativePath: legacySpecDir, authority: "legacy" }) };
    return { root: new MigrationSpecRoot({ root: projectRoot, relativePath: "specs", authority: "default" }) };
  } catch (error) {
    return { blocker: new MigrationBlocker({ code: "SPEC_ROOT_CONFIG_INVALID", message: error.message }) };
  }
}

export { LEGACY_MANAGED_DIRECTORY_NAMES };
