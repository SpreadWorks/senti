import { DocumentationSourceSelection } from "../../docs/lib/source-selection.js";
import { DEFAULT_FLOW_SPEC_DIR, FlowSpecRoot } from "../../lib/flow-workspace.js";
import { PRODUCT } from "../../lib/product.js";

function normalizedRelativePath(value, field) {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/$/, "").replace(/\/$/, "");
  if (normalized === "" || normalized === ".") return "";
  if (normalized.startsWith("../") || normalized.includes("/../")) throw new Error(`${field} must not leave the repository root`);
  return normalized;
}

function isSameOrDescendant(path, directory) {
  return path === directory || path.startsWith(`${directory}/`);
}

export class DocumentationBuildInputSelection {
  constructor({ scanSelection, flowSpecRoot = DEFAULT_FLOW_SPEC_DIR, sourceRootRelativePath = "", managedRoot = PRODUCT.managedDirName }) {
    if (!(scanSelection instanceof DocumentationSourceSelection)) throw new Error("documentation build input selection requires a DocumentationSourceSelection");
    this.scanSelection = scanSelection;
    this.flowSpecRoot = flowSpecRoot === null ? null : FlowSpecRoot.from(flowSpecRoot).toString();
    this.sourceRootRelativePath = normalizedRelativePath(sourceRootRelativePath, "source root relative path");
    this.managedRoot = managedRoot === null ? null : normalizedRelativePath(managedRoot, "managed root");
    this.managedInputFiles = Object.freeze(this.managedRoot === null ? [] : ["config.json", "config.local.json", "overrides.json"].map((file) => `${this.managedRoot}/${file}`));
    this.managedInputDirectories = Object.freeze(this.managedRoot === null ? [] : ["templates", "presets", "plugins", "locale", "data"].map((directory) => `${this.managedRoot}/${directory}`));
    Object.freeze(this);
  }

  matchesConservativeFile(relativePath) {
    const repositoryPath = this.#repositoryPath(relativePath);
    if (this.#isManagedPath(repositoryPath)) return this.#isManagedInput(repositoryPath);
    return this.flowSpecRoot === null || !isSameOrDescendant(repositoryPath, this.flowSpecRoot);
  }

  shouldEnterConservativeDirectory(relativePath) {
    const repositoryPath = this.#repositoryPath(relativePath);
    if (this.#isManagedPath(repositoryPath)) return this.#isManagedInputDirectory(repositoryPath);
    return this.flowSpecRoot === null || !isSameOrDescendant(repositoryPath, this.flowSpecRoot);
  }

  matchesExplicitOrManagedFile(relativePath) {
    const repositoryPath = this.#repositoryPath(relativePath);
    return this.scanSelection.matchesFile(relativePath) || this.#isManagedInput(repositoryPath);
  }

  shouldEnterExplicitOrManagedDirectory(relativePath) {
    const repositoryPath = this.#repositoryPath(relativePath);
    return this.scanSelection.shouldEnterDirectory(relativePath) || this.#isManagedInputDirectory(repositoryPath);
  }

  conservativeGitPathspec() {
    const exclusions = [];
    for (const directory of [this.flowSpecRoot, this.managedRoot]) {
      const relative = this.#relativeDirectoryWithinSource(directory);
      if (relative === null) return [];
      if (relative !== false) exclusions.push(`:(exclude,literal)${relative}`);
    }
    return [".", ...new Set(exclusions)];
  }

  #repositoryPath(relativePath) {
    return [this.sourceRootRelativePath, normalizedRelativePath(relativePath, "documentation source path")].filter(Boolean).join("/");
  }

  #isManagedPath(repositoryPath) {
    return this.managedRoot !== null && isSameOrDescendant(repositoryPath, this.managedRoot);
  }

  #isManagedInput(repositoryPath) {
    return this.managedInputFiles.includes(repositoryPath) || this.managedInputDirectories.some((directory) => isSameOrDescendant(repositoryPath, directory));
  }

  #isManagedInputDirectory(repositoryPath) {
    return this.managedInputDirectories.some((directory) => isSameOrDescendant(repositoryPath, directory) || isSameOrDescendant(directory, repositoryPath));
  }

  #relativeDirectoryWithinSource(directory) {
    if (directory === null) return false;
    if (this.sourceRootRelativePath === directory || this.sourceRootRelativePath.startsWith(`${directory}/`)) return null;
    if (this.sourceRootRelativePath === "") return directory;
    return directory.startsWith(`${this.sourceRootRelativePath}/`) ? directory.slice(this.sourceRootRelativePath.length + 1) : false;
  }
}
