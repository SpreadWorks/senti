import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ProcessOwnedLock, RealDirectoryAuthority } from "./process-owned-lock.js";
import { PRODUCT } from "./product.js";

const LOCK_KIND = "flow-handoff-authority";
const WAIT_INTERVAL_MS = 50;

function digest(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function lockError(status, message, { lockPath, cause } = {}) {
  const error = new Error(message, { cause });
  error.name = "FlowHandoffAuthorityLeaseError";
  error.code = status === "live"
    ? "FLOW_HANDOFF_AUTHORITY_BUSY"
    : `FLOW_HANDOFF_AUTHORITY_LOCK_${status.replace(/-/g, "_").toUpperCase()}`;
  error.lockPath = lockPath;
  return error;
}

/**
 * Handoff authority lease held while a parent dispatcher delegates work to an
 * untrusted worker. Scope follows the checkout identity: main-checkout
 * direct/branch work shares the repository lock, while each worktree path
 * remains independent even if its Flow run changes.
 */
export class FlowHandoffAuthorityLease {
  constructor({ mainRoot, executionRoot } = {}) {
    this.mainRoot = fs.realpathSync(path.resolve(requiredText(mainRoot, "Flow handoff authority mainRoot")));
    this.executionRoot = fs.realpathSync(path.resolve(requiredText(executionRoot, "Flow handoff authority executionRoot")));
    if (!fs.statSync(this.mainRoot).isDirectory() || !fs.statSync(this.executionRoot).isDirectory()) {
      throw new Error("Flow handoff authority roots must be real directories");
    }
    this.scope = this.executionRoot === this.mainRoot ? "repository" : "worktree";
    this.scopeId = this.scope === "repository" ? "repository" : this.executionRoot;
    const root = new RealDirectoryAuthority(this.mainRoot, { errorFactory: lockError });
    const directory = new RealDirectoryAuthority(path.join(this.mainRoot, PRODUCT.managedDirName), {
      create: true,
      parentAuthority: root,
      errorFactory: lockError,
    });
    this.lock = new ProcessOwnedLock({
      directoryAuthority: directory,
      fileName: `.flow-handoff-${this.scope}-${digest(this.scopeId).slice(0, 24)}.lock`,
      kind: LOCK_KIND,
      authority: { scope: this.scope, scopeId: this.scopeId },
      errorFactory: lockError,
    });
  }

  acquire({ wait = false, timeoutMs = null } = {}) {
    if (typeof wait !== "boolean") throw new Error("Flow handoff authority wait must be boolean");
    if (timeoutMs !== null && (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0)) {
      throw new Error("Flow handoff authority timeout must be null or a non-negative integer");
    }
    const deadline = timeoutMs === null ? null : Date.now() + timeoutMs;
    for (;;) {
      try {
        // ProcessOwnedLock only reclaims locks when the recorded owner
        // identity is conclusively stale. Live and indeterminate owners stay
        // exclusive, while a crashed owner cannot permanently block recovery.
        return this.lock.acquire({ claimStale: true });
      } catch (error) {
        if (!wait || error?.code !== "FLOW_HANDOFF_AUTHORITY_BUSY") throw error;
        const remaining = deadline === null ? null : deadline - Date.now();
        if (remaining !== null && remaining <= 0) {
          const timeout = new Error("timed out waiting for the active Flow handoff authority", { cause: error });
          timeout.name = "FlowHandoffAuthorityLeaseTimeoutError";
          timeout.code = "FLOW_HANDOFF_AUTHORITY_WAIT_TIMEOUT";
          timeout.lockPath = error.lockPath;
          throw timeout;
        }
        Atomics.wait(
          new Int32Array(new SharedArrayBuffer(4)),
          0,
          0,
          remaining === null ? WAIT_INTERVAL_MS : Math.min(WAIT_INTERVAL_MS, remaining),
        );
      }
    }
  }

  release() {
    this.lock.release();
  }
}
