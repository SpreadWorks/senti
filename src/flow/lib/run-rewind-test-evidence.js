/**
 * Canonical stale-test-evidence rewind.
 *
 * Version 1 treats a rewind as one fixed Activity transition from `retro` to
 * `test-execute`.  The command reads only cataloged producer histories and a
 * cataloged material-repair receipt; it has no checkout, Git, or mutable
 * sidecar authority.
 */

import crypto from "node:crypto";

import { Envelope } from "../../lib/flow-envelope.js";
import { missingExactTargetGuardNames } from "../../lib/flow-target-guard.js";
import { FlowCommand } from "./base-command.js";
import { CanonicalCommandAttemptArtifactHistory } from "./canonical-command-result.js";

const SHA256 = /^[a-f0-9]{64}$/i;
const REQUIRED_EVIDENCE = Object.freeze([
  "test.execute",
  "test.result.review",
  "impl.gate",
  "issue.log",
]);

class CanonicalTestEvidenceRewindError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CanonicalTestEvidenceRewindError";
    this.code = code;
  }
}

function reject(code, message) {
  throw new CanonicalTestEvidenceRewindError(code, message);
}

function canonicalState(state) {
  if (state?.schemaRevision !== 3) {
    reject("STALE_TEST_EVIDENCE_V1_REQUIRED", "stale test evidence rewind requires a Version-1 Flow");
  }
  return state;
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function jsonObject(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    reject("STALE_TEST_EVIDENCE_CATALOG_INVALID", `${field} must be a JSON object`);
  }
  return value;
}

function repairFingerprint(value, field) {
  if (typeof value !== "string" || !SHA256.test(value)) {
    reject("STALE_TEST_EVIDENCE_CATALOG_INVALID", `${field} must be a SHA-256 repair fingerprint`);
  }
  return value.toLowerCase();
}

function requiredHistory(flowManager, specId, logicalKey) {
  const resolved = flowManager.readArtifact({
    specId,
    logicalKey,
    consumerNodeId: "retro",
    optional: logicalKey === "issue.log",
  });
  if (resolved === null) {
    reject("STALE_TEST_EVIDENCE_CATALOG_MISSING", `canonical ${logicalKey} artifact is absent`);
  }
  return resolved;
}

function currentAttempt(resolved, logicalKey) {
  try {
    return CanonicalCommandAttemptArtifactHistory.fromBytes({
      logicalKey,
      bytes: resolved.bytes,
    }).current;
  } catch (error) {
    reject("STALE_TEST_EVIDENCE_CATALOG_INVALID", `canonical ${logicalKey} attempt history is invalid: ${error.message}`);
  }
}

/** Immutable catalog reference used for pre-transition compare-and-set. */
export class CatalogEvidenceReference {
  constructor({ logicalKey, resolved, attempt = null }) {
    this.logicalKey = logicalKey;
    this.relativePath = resolved.relativePath;
    this.hash = resolved.descriptor.hash;
    this.attempt = attempt;
    this.digest = digest({ logicalKey, relativePath: this.relativePath, hash: this.hash, attempt });
    Object.freeze(this);
  }

  toJSON() {
    return {
      logicalKey: this.logicalKey,
      relativePath: this.relativePath,
      hash: this.hash,
      attempt: this.attempt,
    };
  }
}

/** Typed, bounded material-repair receipt recorded in the canonical issue log. */
export class MaterialRepairReceipt {
  constructor({ fingerprint, findingIds }) {
    this.fingerprint = repairFingerprint(fingerprint, "material repair receipt fingerprint");
    if (!Array.isArray(findingIds) || findingIds.length === 0 || findingIds.some((id) => typeof id !== "string" || id === "")) {
      reject("STALE_TEST_EVIDENCE_MATERIAL_REPAIR_INVALID", "material repair receipt requires findingIds");
    }
    this.findingIds = Object.freeze([...new Set(findingIds)].sort());
    Object.freeze(this);
  }

  static fromIssueLog(document, fingerprint) {
    const entries = jsonObject(document, "canonical issue.log").entries;
    if (!Array.isArray(entries)) {
      reject("STALE_TEST_EVIDENCE_CATALOG_INVALID", "canonical issue.log entries must be an array");
    }
    const matching = entries.filter((entry) => (
      entry?.kind === "material_repair"
      && entry?.status === "applied"
      && entry?.repairFingerprint === fingerprint
    ));
    if (matching.length !== 1) {
      reject("STALE_TEST_EVIDENCE_MATERIAL_REPAIR_MISSING", "canonical issue.log requires one applied material repair receipt for the stale evidence fingerprint");
    }
    return new MaterialRepairReceipt({
      fingerprint: matching[0].repairFingerprint,
      findingIds: matching[0].findingIds,
    });
  }
}

/** Catalog-only eligibility snapshot for the fixed test-evidence rewind route. */
export class CanonicalTestEvidenceRewindEligibility {
  constructor({ flowManager, state, references, fingerprint, receipt }) {
    this.flowManager = flowManager;
    this.state = canonicalState(state);
    this.references = Object.freeze(references);
    this.fingerprint = repairFingerprint(fingerprint, "rewind evidence fingerprint");
    this.receipt = receipt instanceof MaterialRepairReceipt
      ? receipt
      : new MaterialRepairReceipt(receipt);
    if (this.receipt.fingerprint !== this.fingerprint) {
      reject("STALE_TEST_EVIDENCE_MATERIAL_REPAIR_INVALID", "material repair receipt does not bind the stale evidence fingerprint");
    }
    Object.freeze(this);
  }

  static capture({ flowManager, state }) {
    const current = canonicalState(state);
    if (!flowManager || typeof flowManager.readArtifact !== "function" || typeof flowManager.rewindTestEvidence !== "function") {
      reject("STALE_TEST_EVIDENCE_V1_REQUIRED", "stale test evidence rewind requires the canonical FlowManager surface");
    }
    const executeResolved = requiredHistory(flowManager, current.specId, "test.execute");
    const reviewResolved = requiredHistory(flowManager, current.specId, "test.result.review");
    const gateResolved = requiredHistory(flowManager, current.specId, "impl.gate");
    const issueResolved = requiredHistory(flowManager, current.specId, "issue.log");
    const execute = currentAttempt(executeResolved, "test.execute");
    const review = currentAttempt(reviewResolved, "test.result.review");
    const gate = currentAttempt(gateResolved, "impl.gate");
    const executePayload = jsonObject(execute.payload, "canonical test.execute payload");
    const reviewPayload = jsonObject(review.payload, "canonical test.result.review payload");
    const gatePayload = jsonObject(gate.payload, "canonical impl.gate payload");
    const fingerprint = repairFingerprint(executePayload.repairFingerprint, "canonical test.execute repairFingerprint");
    if (repairFingerprint(reviewPayload.repairFingerprint, "canonical test.result.review repairFingerprint") !== fingerprint) {
      reject("STALE_TEST_EVIDENCE_STALE", "test.execute and test.result.review catalog evidence target different repairs");
    }
    if (repairFingerprint(gatePayload.repairFingerprint, "canonical impl.gate repairFingerprint") !== fingerprint) {
      reject("STALE_TEST_EVIDENCE_STALE", "impl.gate catalog evidence does not bind the stale test repair");
    }
    if (gatePayload.result === "pass") {
      reject("STALE_TEST_EVIDENCE_NOT_BLOCKED", "impl.gate evidence is not blocked and cannot authorize test evidence rewind");
    }
    const issueDocument = jsonObject(JSON.parse(issueResolved.bytes.toString("utf8")), "canonical issue.log");
    const receipt = MaterialRepairReceipt.fromIssueLog(issueDocument, fingerprint);
    return new CanonicalTestEvidenceRewindEligibility({
      flowManager,
      state: current,
      fingerprint,
      receipt,
      references: [
        new CatalogEvidenceReference({ logicalKey: "test.execute", resolved: executeResolved, attempt: execute.attempt }),
        new CatalogEvidenceReference({ logicalKey: "test.result.review", resolved: reviewResolved, attempt: review.attempt }),
        new CatalogEvidenceReference({ logicalKey: "impl.gate", resolved: gateResolved, attempt: gate.attempt }),
        new CatalogEvidenceReference({ logicalKey: "issue.log", resolved: issueResolved }),
      ],
    });
  }

  assertCurrent() {
    for (const reference of this.references) {
      const resolved = requiredHistory(this.flowManager, this.state.specId, reference.logicalKey);
      const attempt = reference.attempt === null
        ? null
        : currentAttempt(resolved, reference.logicalKey).attempt;
      const current = new CatalogEvidenceReference({
        logicalKey: reference.logicalKey,
        resolved,
        attempt,
      });
      if (current.digest !== reference.digest) {
        reject("STALE_TEST_EVIDENCE_AUTHORITY_CHANGED", `canonical ${reference.logicalKey} evidence changed before rewind`);
      }
    }
  }

  toJSON() {
    return {
      fingerprint: this.fingerprint,
      receipt: { fingerprint: this.receipt.fingerprint, findingIds: [...this.receipt.findingIds] },
      references: this.references.map((reference) => reference.toJSON()),
    };
  }
}

function requireExactGuards(ctx, state) {
  const missing = missingExactTargetGuardNames(ctx, state);
  if (missing.length === 0) return null;
  return Envelope.fail(
    "run",
    "rewind-test-evidence",
    "FLOW_TARGET_GUARD_REQUIRED",
    `rewind-test-evidence requires ${missing.join(", ")}`,
    { missing },
  );
}

export default class RunRewindTestEvidenceCommand extends FlowCommand {
  execute(ctx) {
    const state = ctx.flowState;
    const guardFailure = requireExactGuards(ctx, state);
    if (guardFailure !== null) return guardFailure;
    try {
      const eligibility = CanonicalTestEvidenceRewindEligibility.capture({
        flowManager: ctx.flowManager,
        state,
      });
      eligibility.assertCurrent();
      ctx.flowManager.rewindTestEvidence({ specId: state.specId });
      const refreshed = ctx.flowManager.canonicalState(state.specId);
      if (refreshed.current?.at(-1) !== "test-execute") {
        reject("STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH", "canonical rewind did not activate test-execute");
      }
      return Envelope.ok("run", "rewind-test-evidence", {
        recovered: true,
        fingerprint: eligibility.fingerprint,
        materialRepair: eligibility.receipt.findingIds,
        activeStep: "test-execute",
        evidence: eligibility.toJSON(),
      });
    } catch (error) {
      if (error instanceof CanonicalTestEvidenceRewindError) {
        return Envelope.fail("run", "rewind-test-evidence", error.code, error.message);
      }
      return Envelope.fail(
        "run",
        "rewind-test-evidence",
        "STALE_TEST_EVIDENCE_REWIND_REJECTED",
        `canonical stale test evidence rewind rejected: ${error.message}`,
      );
    }
  }
}
