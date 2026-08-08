import path from "node:path";
import { FlowSpecId } from "./flow-spec-id.js";
import { FlowVersion, FlowVersionAuthorityScope, FlowVersionLocation } from "./flow-version.js";

export const DEFAULT_FLOW_SPEC_DIR = "specs";
const FLOW_STATE_LOCATIONS = new WeakMap();

function canonicalRepositoryRoot(value, field) {
  if (typeof value !== "string" || !path.isAbsolute(value)) {
    throw new Error(`${field} must be an absolute path`);
  }
  return path.resolve(value);
}

function normalizedRepositoryRelativePath(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty repository-relative path`);
  }
  if (value.includes("\\") || path.posix.isAbsolute(value)) {
    throw new Error(`${field} must be a repository-relative POSIX path`);
  }
  const normalized = path.posix.normalize(value);
  const segments = value.split("/");
  if (
    normalized !== value
    || value === "."
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`${field} must not contain empty, current, or parent path segments`);
  }
  return value;
}

export class FlowSpecRoot {
  constructor(value = DEFAULT_FLOW_SPEC_DIR) {
    this.relativePath = normalizedRepositoryRelativePath(value, "flow.specDir");
    Object.freeze(this);
  }

  static from(value) {
    return value instanceof FlowSpecRoot ? value : new FlowSpecRoot(value);
  }

  resolve(repositoryRoot) {
    return path.join(
      canonicalRepositoryRoot(repositoryRoot, "repository root"),
      ...this.relativePath.split("/"),
    );
  }

  toString() {
    return this.relativePath;
  }
}

export class FlowSpecLocation {
  constructor({ repositoryRoot, specRoot = DEFAULT_FLOW_SPEC_DIR, specId }) {
    this.repositoryRoot = canonicalRepositoryRoot(repositoryRoot, "repository root");
    this.specRoot = FlowSpecRoot.from(specRoot);
    this.specId = FlowSpecId.from(specId);
    this.relativeRoot = this.specRoot.toString();
    this.root = this.specRoot.resolve(this.repositoryRoot);
    this.relativeDirectory = path.posix.join(this.relativeRoot, this.specId.toString());
    this.directory = path.join(this.root, this.specId.toString());
    Object.freeze(this);
  }

  relativeArtifact(...segments) {
    const relative = segments.map((segment, index) => (
      normalizedRepositoryRelativePath(segment, `flow artifact path segment ${index + 1}`)
    ));
    return path.posix.join(this.relativeDirectory, ...relative);
  }

  artifact(...segments) {
    return path.join(this.repositoryRoot, ...this.relativeArtifact(...segments).split("/"));
  }

  get relativeSpecFile() {
    return this.relativeArtifact("spec.json");
  }

  get specFile() {
    return this.artifact("spec.json");
  }

  get relativeFlowStateFile() {
    return this.relativeArtifact("flow.json");
  }

  get flowStateFile() {
    return this.artifact("flow.json");
  }
}

export class FlowWorkspace {
  constructor({ repositoryRoot, executionRoot, specRoot = DEFAULT_FLOW_SPEC_DIR }) {
    this.repositoryRoot = canonicalRepositoryRoot(repositoryRoot, "repository root");
    this.executionRoot = canonicalRepositoryRoot(executionRoot, "execution root");
    this.specRoot = FlowSpecRoot.from(specRoot);
    Object.freeze(this);
  }

  forSpec(specId) {
    return new FlowSpecLocation({
      repositoryRoot: this.repositoryRoot,
      specRoot: this.specRoot,
      specId,
    });
  }

  canonicalVersion(specId, version) {
    return new FlowVersionLocation({
      repositoryRoot: this.repositoryRoot,
      authorityScope: FlowVersionAuthorityScope.canonical(),
      specRoot: this.specRoot.toString(),
      specId: FlowSpecId.from(specId).toString(),
      version: FlowVersion.from(version),
    });
  }

  executionVersion(specId, version) {
    return new FlowVersionLocation({
      repositoryRoot: this.executionRoot,
      authorityScope: FlowVersionAuthorityScope.execution(),
      specRoot: this.specRoot.toString(),
      specId: FlowSpecId.from(specId).toString(),
      version: FlowVersion.from(version),
    });
  }
}

export function flowSpecRootFromConfig(config) {
  return new FlowSpecRoot(config?.flow?.specDir ?? DEFAULT_FLOW_SPEC_DIR);
}

export function bindFlowStateLocation(state, location) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("flow state object is required for spec location binding");
  }
  if (!(location instanceof FlowSpecLocation)) {
    throw new Error("FlowSpecLocation is required for flow state binding");
  }
  if (state.specId !== location.specId.toString()) {
    throw new Error("flow state specId does not match its spec location");
  }
  FLOW_STATE_LOCATIONS.set(state, location);
  return state;
}

export function isLocatedFlowState(state) {
  return Boolean(state && typeof state === "object" && FLOW_STATE_LOCATIONS.has(state));
}

export function flowStateSpecLocation(state) {
  return FLOW_STATE_LOCATIONS.get(state) ?? null;
}

export function cloneLocatedFlowState(state) {
  const clone = structuredClone(state);
  const location = flowStateSpecLocation(state);
  return location ? bindFlowStateLocation(clone, location) : clone;
}

export function relativeFlowSpecFile(state, specRoot = null) {
  const location = flowStateSpecLocation(state);
  if (location) return location.relativeSpecFile;
  if (!state || typeof state !== "object") {
    throw new Error("flow state is required to resolve the spec file");
  }
  const root = FlowSpecRoot.from(specRoot ?? DEFAULT_FLOW_SPEC_DIR);
  const specId = FlowSpecId.from(state.specId).toString();
  return path.posix.join(root.toString(), specId, "spec.json");
}
