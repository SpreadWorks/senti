/**
 * Catalog-backed acceptance handoff for a non-semantic checkpoint.
 *
 * The handoff is a bounded index, never a root sidecar: its source evidence,
 * the index itself, and the deferred finding are all resolved through the
 * active Version Store.
 */

import crypto from "node:crypto";
import {
  appendDeferredFlowFinding,
  MAX_SOURCE_ARTIFACT_READ_BYTES,
  normalizeSourceArtifactPath,
  readCatalogedSourceArtifact,
} from "./flow-findings.js";

export const NONBLOCKING_HANDOFF_LOGICAL_KEY = "nonblocking.handoffs";

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function canonicalFlowState(flowState) {
  if (flowState?.schemaRevision !== 3 || typeof flowState.specId !== "string" || flowState.specId === "") {
    throw new Error("nonblocking handoff requires a Version-1 Flow state");
  }
  return flowState;
}

function jsonFromBytes(bytes, field) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${field} must be JSON: ${error.message}`);
  }
}

export class NonBlockingHandoffFinding {
  constructor({ findingId, fingerprint, sourceStep, sourceArtifact, evidenceDigest, resultKind } = {}) {
    this.findingId = requireString(findingId, "findingId");
    if (!/^[a-f0-9]{64}$/.test(fingerprint || "")) throw new Error("handoff finding fingerprint must be SHA-256");
    this.fingerprint = fingerprint;
    this.sourceStep = requireString(sourceStep, "sourceStep");
    this.sourceArtifact = normalizeSourceArtifactPath(sourceArtifact, "sourceArtifact");
    if (!/^[a-f0-9]{64}$/.test(evidenceDigest || "")) throw new Error("handoff evidenceDigest must be SHA-256");
    this.evidenceDigest = evidenceDigest;
    if (!["quality", "tooling", "unavailable"].includes(resultKind)) {
      throw new Error("handoff resultKind is invalid");
    }
    this.resultKind = resultKind;
    Object.freeze(this);
  }

  toJSON() {
    return {
      findingId: this.findingId,
      fingerprint: this.fingerprint,
      sourceStep: this.sourceStep,
      sourceArtifact: this.sourceArtifact,
      evidenceDigest: this.evidenceDigest,
      resultKind: this.resultKind,
    };
  }
}

export class NonBlockingHandoffArtifact {
  constructor({ version = 1, findings = [] } = {}) {
    if (version !== 1) throw new Error("nonblocking handoff version is invalid");
    if (!Array.isArray(findings)) throw new Error("nonblocking handoff findings must be an array");
    this.version = 1;
    this.findings = Object.freeze(findings.map((entry) => (
      entry instanceof NonBlockingHandoffFinding ? entry : new NonBlockingHandoffFinding(entry)
    )));
    Object.freeze(this);
  }

  toJSON() {
    return { version: this.version, findings: this.findings.map((finding) => finding.toJSON()) };
  }
}

/** Deep typed Store adapter for handoff publication and evidence validation. */
export class CanonicalNonBlockingHandoffStore {
  constructor({ flowManager, flowState, nodeId } = {}) {
    if (!flowManager || typeof flowManager.readArtifact !== "function" || typeof flowManager.readProducerArtifact !== "function" || typeof flowManager.publishArtifacts !== "function") {
      throw new Error("canonical nonblocking handoff requires FlowManager catalog APIs");
    }
    this.flowManager = flowManager;
    this.flowState = canonicalFlowState(flowState);
    this.nodeId = requireString(nodeId, "nonblocking handoff nodeId");
    Object.freeze(this);
  }

  read() {
    const resolved = this.flowManager.readArtifact({
      specId: this.flowState.specId,
      logicalKey: NONBLOCKING_HANDOFF_LOGICAL_KEY,
      consumerNodeId: this.nodeId,
      optional: true,
    });
    return new NonBlockingHandoffArtifact(resolved === null ? {} : jsonFromBytes(resolved.bytes, "canonical nonblocking handoff"));
  }

  publish(artifact) {
    const normalized = artifact instanceof NonBlockingHandoffArtifact ? artifact : new NonBlockingHandoffArtifact(artifact);
    this.flowManager.publishArtifacts({
      specId: this.flowState.specId,
      nodeId: this.nodeId,
      artifactWrites: [{
        logicalKey: NONBLOCKING_HANDOFF_LOGICAL_KEY,
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify(normalized.toJSON(), null, 2)}\n`, "utf8"),
      }],
    });
    return normalized;
  }

  evidence(relativePath, { optional = false } = {}) {
    const source = readCatalogedSourceArtifact({
      flowManager: this.flowManager,
      flowState: this.flowState,
      nodeId: this.nodeId,
      sourceArtifact: normalizeSourceArtifactPath(relativePath, "evidenceRef"),
    });
    if (source === null && !optional) {
      throw new Error(`canonical handoff evidence is absent from catalog: ${relativePath}`);
    }
    return source;
  }
}

/** A handoff source must remain a cataloged artifact with the same digest. */
export function verifyNonblockingHandoffSource({ flowManager, flowState, nodeId, value } = {}) {
  try {
    const handoff = value instanceof NonBlockingHandoffFinding
      ? value
      : new NonBlockingHandoffFinding(value);
    const source = new CanonicalNonBlockingHandoffStore({ flowManager, flowState, nodeId }).evidence(handoff.sourceArtifact, { optional: true });
    if (source === null || source.bytes.length > MAX_SOURCE_ARTIFACT_READ_BYTES) return false;
    return digest(source.bytes) === handoff.evidenceDigest;
  } catch {
    return false;
  }
}

/**
 * Materialize exactly one acceptance finding for a non-semantic checkpoint.
 * Idempotence is keyed to source step plus immutable catalog bytes.
 */
export function materializeNonblockingAcceptanceHandoff({
  flowManager,
  flowState,
  nodeId,
  sourceStep,
  evidenceRef,
  evidenceDigest,
  resultKind,
  attempts,
} = {}) {
  if (!/^[a-f0-9]{64}$/.test(evidenceDigest || "")) {
    throw new Error("nonblocking handoff evidenceDigest must be SHA-256");
  }
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new Error("nonblocking handoff attempts must be a positive integer");
  }
  if (!["quality", "tooling", "unavailable"].includes(resultKind)) {
    throw new Error("nonblocking handoff resultKind is invalid");
  }
  const store = new CanonicalNonBlockingHandoffStore({ flowManager, flowState, nodeId });
  const source = store.evidence(evidenceRef);
  if (source.bytes.length > MAX_SOURCE_ARTIFACT_READ_BYTES || digest(source.bytes) !== evidenceDigest) {
    throw new Error("nonblocking handoff evidence digest does not match cataloged source");
  }
  const fingerprint = digest(`${sourceStep}\u0000${evidenceDigest}`);
  const artifact = store.read();
  let finding = artifact.findings.find((entry) => (
    entry.sourceStep === sourceStep && entry.evidenceDigest === evidenceDigest
  ));
  if (!finding) {
    finding = new NonBlockingHandoffFinding({
      findingId: `NB-${fingerprint.slice(0, 16)}`,
      fingerprint,
      sourceStep,
      sourceArtifact: source.relativePath,
      evidenceDigest,
      resultKind,
    });
    store.publish(new NonBlockingHandoffArtifact({ findings: [...artifact.findings, finding] }));
  }
  const deferred = appendDeferredFlowFinding({
    flowManager,
    flowState,
    nodeId,
    sourceStep,
    sourceArtifact: NONBLOCKING_HANDOFF_LOGICAL_KEY,
    sourceFindingId: finding.findingId,
    fingerprint,
    rationale: "An explicit nonblocking decision deferred this checkpoint to acceptance.",
    attempts,
    finalDisposition: "still_open",
  });
  return { findingCount: 1, sourceArtifact: deferred.sourceArtifact, sourceFindingId: finding.findingId };
}
