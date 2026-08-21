import crypto from "node:crypto";
import path from "node:path";
import { PRODUCT } from "../../lib/product.js";
import {
  ProcessOwnedLock,
  RealDirectoryAuthority,
} from "../../lib/process-owned-lock.js";

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value;
}

function leaseError(status, message, { lockPath, cause } = {}) {
  const error = new Error(message, { cause });
  error.name = "ReviewExecutionLeaseError";
  error.code = status === "live" ? "REVIEW_EXECUTION_BUSY" : `REVIEW_EXECUTION_LOCK_${status.replace(/-/g, "_").toUpperCase()}`;
  error.lockPath = lockPath;
  return error;
}

/** One provider admission for one canonical review Attempt. */
export class ReviewExecutionLease {
  constructor({ mainRoot, runId, nodeId, attemptId } = {}) {
    const rootPath = requiredText(mainRoot, "review execution lease mainRoot");
    const identity = [runId, nodeId, attemptId].map((value, index) => requiredText(value, `review execution lease identity[${index}]`)).join("\0");
    const root = new RealDirectoryAuthority(rootPath, { errorFactory: leaseError });
    const directory = new RealDirectoryAuthority(path.join(rootPath, PRODUCT.managedDirName), {
      create: true,
      parentAuthority: root,
      errorFactory: leaseError,
    });
    this.lock = new ProcessOwnedLock({
      directoryAuthority: directory,
      fileName: `.review-execution-${crypto.createHash("sha256").update(identity).digest("hex").slice(0, 24)}.lock`,
      kind: "review-execution",
      authority: { runId, nodeId, attemptId },
      errorFactory: leaseError,
    });
    Object.freeze(this);
  }

  // A crashed parent can leave a provider descendant alive.  This lease does
  // not persist that process tree, so it must fail closed instead of admitting
  // a second provider execution after only the parent identity goes stale.
  acquire() { return this.lock.acquire({ claimStale: false }); }
  release() { this.lock.release(); }
}
