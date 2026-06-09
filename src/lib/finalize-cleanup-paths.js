import path from "path";

export const FINALIZE_CLEANUP_DURABLE_AGENT_WORK_DIR = path.join(".senti", "agent-work");

function isPathInside(base, target) {
  const rel = path.relative(path.resolve(base), path.resolve(target));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
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
}
