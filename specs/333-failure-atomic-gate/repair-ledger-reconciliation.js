import {
  ImplRepairEntry,
  ImplRepairLedger,
} from "../../src/flow/lib/impl-repair-artifacts.js";
import {
  RepairDeltaArtifact,
} from "../../src/flow/lib/repair-state-identity.js";

const BRIDGE_SOURCE_FINDING_ID = "repair-ledger-manifest-discontinuity";
const BRIDGE_REASON = "History-preserving bridge for the audited repair fingerprint ledger gap.";
const CHANGED_PATH_PREVIEW_LIMIT = 20;

function requireRecord(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function serialized(value) {
  return JSON.stringify(value);
}

export class RepairLedgerReconciliationPlan {
  constructor({ originalLedger, entry, delta }) {
    if (!(originalLedger instanceof ImplRepairLedger)) {
      throw new Error("originalLedger must be an ImplRepairLedger");
    }
    if (!(entry instanceof ImplRepairEntry)) {
      throw new Error("entry must be an ImplRepairEntry");
    }
    if (!(delta instanceof RepairDeltaArtifact)) {
      throw new Error("delta must be a RepairDeltaArtifact");
    }
    this.originalLedger = originalLedger;
    this.entry = entry;
    this.delta = delta;
    this.appliedLedger = originalLedger.append(entry);
    Object.freeze(this);
  }
}

export class RepairLedgerReconciliationResult {
  constructor({ preservedEntryCount, bridgeEntryId }) {
    if (!Number.isSafeInteger(preservedEntryCount) || preservedEntryCount < 1) {
      throw new Error("preservedEntryCount must be a positive integer");
    }
    this.preservedEntryCount = preservedEntryCount;
    this.bridgeEntryId = requireString(bridgeEntryId, "bridgeEntryId");
    Object.freeze(this);
  }
}

export class RepairLedgerManifestEvidence {
  constructor({ hash } = {}) {
    if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) {
      throw new Error("historical manifest hash must be a sha256");
    }
    this.hash = hash;
    Object.freeze(this);
  }
}

export class RepairLedgerReconciliationAuthority {
  constructor(input = {}) {
    const value = requireRecord(input, "reconciliation authority");
    if (value.version !== 1) throw new Error("reconciliation authority version must be 1");
    this.version = 1;
    this.runId = requireString(value.runId, "runId");
    this.spec = requireString(value.spec, "spec");
    if (!Number.isSafeInteger(value.issue) || value.issue < 1) {
      throw new Error("issue must be a positive integer");
    }
    this.issue = value.issue;
    if (!Number.isSafeInteger(value.preservedEntryCount) || value.preservedEntryCount < 1) {
      throw new Error("preservedEntryCount must be a positive integer");
    }
    this.preservedEntryCount = value.preservedEntryCount;
    this.bridgeEntryId = requireString(value.bridgeEntryId, "bridgeEntryId");
    const expectedBridgeEntryId = `repair-${String(this.preservedEntryCount + 1).padStart(3, "0")}`;
    if (this.bridgeEntryId !== expectedBridgeEntryId) {
      throw new Error(`bridgeEntryId must be the next ledger id: ${expectedBridgeEntryId}`);
    }
    this.createdAt = requireString(value.createdAt, "createdAt");
    if (!Number.isFinite(Date.parse(this.createdAt))) {
      throw new Error("createdAt must be an ISO date-time");
    }

    const delta = new RepairDeltaArtifact({
      version: 1,
      id: this.bridgeEntryId,
      previousHash: value.expectedLedgerTail,
      currentHash: value.expectedManifestHash,
      changedPaths: value.changedPaths,
      digest: value.changedPathsDigest,
    });
    this.expectedLedgerTail = delta.previousHash;
    this.expectedManifestHash = delta.currentHash;
    this.changedPaths = delta.changedPaths;
    this.changedPathsDigest = delta.digest;
    Object.freeze(this);
  }

  prepare({ state, ledger, manifest } = {}) {
    const flowState = requireRecord(state, "flow state");
    if (flowState.runId !== this.runId) throw new Error("flow runId does not match reconciliation authority");
    if (flowState.spec !== this.spec) throw new Error("flow spec does not match reconciliation authority");
    if (flowState.issue !== this.issue) throw new Error("flow issue does not match reconciliation authority");
    if (!(ledger instanceof ImplRepairLedger)) {
      throw new Error("ledger must be an ImplRepairLedger");
    }
    if (!(manifest instanceof RepairLedgerManifestEvidence)) {
      throw new Error("manifest must be historical RepairLedgerManifestEvidence");
    }
    if (ledger.entries.length !== this.preservedEntryCount) {
      throw new Error("preserved ledger entry count does not match reconciliation authority");
    }
    if (ledger.entries.at(-1)?.currentHash !== this.expectedLedgerTail) {
      throw new Error("ledger tail does not match reconciliation authority");
    }
    if (ledger.entries.some((entry) => entry.id === this.bridgeEntryId)) {
      throw new Error("reconciliation bridge entry already exists");
    }
    if (manifest.hash !== this.expectedManifestHash) {
      throw new Error("manifest hash does not match reconciliation authority");
    }

    const delta = new RepairDeltaArtifact({
      version: 1,
      id: this.bridgeEntryId,
      previousHash: this.expectedLedgerTail,
      currentHash: this.expectedManifestHash,
      changedPaths: this.changedPaths,
      digest: this.changedPathsDigest,
    });
    const counts = new Map();
    for (const relPath of delta.changedPaths) {
      const parts = relPath.split("/");
      const prefix = parts.length > 1
        ? `${parts.slice(0, Math.min(2, parts.length - 1)).join("/")}/`
        : relPath;
      counts.set(prefix, (counts.get(prefix) || 0) + 1);
    }
    const changedPathGroups = [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([prefix, count]) => ({ prefix, count }));
    const entry = new ImplRepairEntry({
      id: this.bridgeEntryId,
      sourceFindingIds: [BRIDGE_SOURCE_FINDING_ID],
      reason: BRIDGE_REASON,
      changedPathCount: delta.changedPaths.length,
      changedPathsPreview: delta.changedPaths.slice(0, CHANGED_PATH_PREVIEW_LIMIT),
      changedPathGroups,
      changedPathsRef: `repair-deltas/${this.bridgeEntryId}.json`,
      invalidatedArtifacts: ["impl-review.json"],
      previousHash: this.expectedLedgerTail,
      currentHash: this.expectedManifestHash,
      createdAt: this.createdAt,
      changedPathsDigest: delta.digest,
      invalidations: [{
        path: "impl-review.json",
        reason: `${BRIDGE_REASON} (repair_fingerprint_mismatch)`,
        previousFingerprint: this.expectedLedgerTail,
      }],
    });
    return new RepairLedgerReconciliationPlan({ originalLedger: ledger, entry, delta });
  }

  verifyApplied({
    state,
    originalLedger,
    appliedLedger,
    manifest,
    delta,
  } = {}) {
    const plan = this.prepare({ state, ledger: originalLedger, manifest });
    if (!(appliedLedger instanceof ImplRepairLedger)) {
      throw new Error("appliedLedger must be an ImplRepairLedger");
    }
    if (!(delta instanceof RepairDeltaArtifact)) {
      throw new Error("delta must be a RepairDeltaArtifact");
    }
    const appliedBridgeLedger = new ImplRepairLedger({
      version: appliedLedger.version,
      entries: appliedLedger.entries.slice(0, this.preservedEntryCount + 1),
    });
    if (serialized(appliedBridgeLedger.toJSON()) !== serialized(plan.appliedLedger.toJSON())) {
      throw new Error("applied ledger does not preserve the original entries and exact bridge");
    }
    if (serialized(delta.toJSON()) !== serialized(plan.delta.toJSON())) {
      throw new Error("applied repair delta does not match the reconciliation bridge");
    }
    return new RepairLedgerReconciliationResult({
      preservedEntryCount: this.preservedEntryCount,
      bridgeEntryId: this.bridgeEntryId,
    });
  }
}
