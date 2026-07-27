import path from "path";

export const FINALIZE_CLEANUP_DURABLE_AGENT_WORK_DIR = path.join(".senti", "agent-work");
export const FINALIZE_CLEANUP_DURABLE_SUBDIR = "finalize-cleanup";
const DIRECT_FINALIZE_ACTIONS = new Set([
  "FINALIZE_DIRECT",
  "FINALIZE_DIRECT_RECONCILE",
]);

function isPathInside(base, target) {
  const rel = path.relative(path.resolve(base), path.resolve(target));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index >= 0) return argv[index + 1] ?? null;
  const prefix = `${name}=`;
  const entry = argv.find((arg) => arg.startsWith(prefix));
  return entry == null ? null : entry.slice(prefix.length);
}

export class FinalizeCleanupRoute {
  constructor({ command = null, action = null } = {}) {
    if (command != null && typeof command !== "string") {
      throw new Error("finalize cleanup route command must be a string");
    }
    if (action != null && typeof action !== "string") {
      throw new Error("finalize cleanup route action must be a string");
    }
    this.command = command;
    this.action = action;
    Object.freeze(this);
  }

  static fromCliArgs(argv = []) {
    if (!Array.isArray(argv) || argv.some((arg) => typeof arg !== "string")) {
      throw new Error("finalize cleanup CLI arguments must contain only strings");
    }
    if (argv[0] !== "flow" || argv[1] !== "run") {
      return new FinalizeCleanupRoute();
    }
    return new FinalizeCleanupRoute({
      command: argv[2] ?? null,
      action: optionValue(argv.slice(3), "--action"),
    });
  }

  static fromDispatch({ envelopeKey = null, action = null } = {}) {
    return new FinalizeCleanupRoute({ command: envelopeKey, action });
  }

  get removesManagedWorktree() {
    return this.command === "finalize-cleanup"
      || (
        this.command === "direct"
        && DIRECT_FINALIZE_ACTIONS.has(this.action)
      );
  }
}

export class FinalizeCleanupPathResolver {
  constructor({ enabled = false, worktreeRoot, mainRoot, inWorktree = false } = {}) {
    this.enabled = enabled === true;
    this.worktreeRoot = worktreeRoot ? path.resolve(worktreeRoot) : null;
    this.mainRoot = mainRoot ? path.resolve(mainRoot) : null;
    this.inWorktree = inWorktree === true;
  }

  get active() {
    return Boolean(
      this.enabled
      && this.inWorktree
      && this.worktreeRoot
      && this.mainRoot
      && path.resolve(this.worktreeRoot) !== path.resolve(this.mainRoot),
    );
  }

  get authorityRoot() {
    return this.active ? this.mainRoot : this.worktreeRoot;
  }

  flowManager(flowManager) {
    if (!this.active) return flowManager;
    return flowManager.forRoot(this.mainRoot);
  }

  isInsideWorktree(filePath) {
    return this.active && isPathInside(this.worktreeRoot, filePath);
  }

  relocatePath(filePath) {
    const resolved = path.resolve(filePath);
    if (!this.isInsideWorktree(resolved)) return resolved;
    const rel = path.relative(this.worktreeRoot, resolved);
    return path.resolve(this.mainRoot, rel);
  }

  agentWorkDir(filePath) {
    const resolved = path.resolve(filePath);
    if (!this.isInsideWorktree(resolved)) return resolved;
    return path.resolve(this.mainRoot, FINALIZE_CLEANUP_DURABLE_AGENT_WORK_DIR);
  }

  cleanupWritePath(filePath) {
    return this.relocatePath(filePath);
  }

  postCommandMetadataPath(fileName, { specId } = {}) {
    const safeName = path.basename(String(fileName || "metadata.json"));
    const scope = specId ? String(specId) : "unknown-spec";
    const base = this.mainRoot || this.worktreeRoot || process.cwd();
    return path.resolve(
      base,
      FINALIZE_CLEANUP_DURABLE_AGENT_WORK_DIR,
      FINALIZE_CLEANUP_DURABLE_SUBDIR,
      scope,
      safeName,
    );
  }

  cleanupSurfaceOwner(surface, { specId } = {}) {
    const scope = specId ? String(specId) : "unknown-spec";
    const root = this.mainRoot || this.worktreeRoot || process.cwd();
    const finalCommit = "final-flow-json-commit";
    const sidecar = "post-command-sidecar";
    const surfaceKey = String(surface || "metadata");
    const mainSpecPath = (fileName) => path.resolve(root, "specs", scope, fileName);
    const sidecarPath = (fileName) => this.postCommandMetadataPath(fileName, { specId: scope });

    const owners = {
      "final-flow-json": { path: mainSpecPath("flow.json"), commitBoundary: finalCommit, observable: true },
      "step-status": { path: mainSpecPath("flow.json"), commitBoundary: finalCommit, observable: true },
      "issue-log": { path: mainSpecPath("issue-log.json"), commitBoundary: finalCommit, observable: true },
      "agent-metrics": { path: sidecarPath("agent-metrics.json"), commitBoundary: sidecar, observable: true },
      "runtime-metadata": { path: sidecarPath("runtime-log.json"), commitBoundary: sidecar, observable: true },
      "runtime-log": { path: sidecarPath("runtime-log.json"), commitBoundary: sidecar, observable: true },
      "notes": { path: sidecarPath("notes.json"), commitBoundary: sidecar, observable: true },
      "plugin-artifact": { path: sidecarPath("plugin-artifacts.json"), commitBoundary: sidecar, observable: true },
      "plugin-hook-output": { path: sidecarPath("plugin-hook-output.json"), commitBoundary: sidecar, observable: true },
      "report-envelope": { path: sidecarPath("report-envelope.json"), commitBoundary: sidecar, observable: true },
      "recovery-envelope": { path: sidecarPath("recovery-envelope.json"), commitBoundary: sidecar, observable: true },
    };

    return owners[surfaceKey] || {
      path: sidecarPath(`${surfaceKey}.json`),
      commitBoundary: sidecar,
      observable: true,
    };
  }
}
