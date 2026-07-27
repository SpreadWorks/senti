/**
 * Durable acceptance handoff for an evidence-backed checkpoint whose result
 * cannot be decomposed into the semantic findings emitted by review/gate.
 *
 * The original artifact remains authoritative.  This small index gives the
 * acceptance finding protocol a stable, bounded source finding to cite; it
 * never copies the original failure text into flow-findings.json.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendDeferredFlowFinding,
  MAX_SOURCE_ARTIFACT_READ_BYTES,
  normalizeSourceArtifactPath,
  readBoundedSourceArtifact,
  specDirFromFlowState,
} from "./flow-findings.js";

export const NONBLOCKING_HANDOFF_FILE = "nonblocking-handoffs.json";

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
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

function sourceRefWithinSpec({ root, specDir, evidenceRef }) {
  const absolute = path.resolve(root, evidenceRef);
  const relative = path.relative(specDir, absolute).replaceAll("\\", "/");
  if (relative === "" || relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error("nonblocking evidence must be inside the active spec directory");
  }
  return relative;
}

function handoffSourcePath(specDir, sourceArtifact) {
  const normalized = normalizeSourceArtifactPath(sourceArtifact, "sourceArtifact");
  const absolute = path.resolve(specDir, normalized);
  const relative = path.relative(specDir, absolute);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("handoff sourceArtifact must be inside the active spec directory");
  }
  return absolute;
}

function readHandoffArtifact(specDir) {
  const stored = readBoundedSourceArtifact(specDir, NONBLOCKING_HANDOFF_FILE);
  return new NonBlockingHandoffArtifact(stored || {});
}

function writeHandoffArtifact(specDir, artifact) {
  fs.writeFileSync(
    path.join(specDir, NONBLOCKING_HANDOFF_FILE),
    `${JSON.stringify(artifact.toJSON(), null, 2)}\n`,
  );
}

/**
 * A handoff index is not source evidence by itself. Acceptance must prove that
 * the immutable bytes it cites still exist before it can disposition the risk.
 */
export function verifyNonblockingHandoffSource(specDir, value) {
  try {
    const handoff = value instanceof NonBlockingHandoffFinding
      ? value
      : new NonBlockingHandoffFinding(value);
    const sourcePath = handoffSourcePath(specDir, handoff.sourceArtifact);
    const stat = fs.lstatSync(sourcePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_SOURCE_ARTIFACT_READ_BYTES) return false;
    return digest(fs.readFileSync(sourcePath, "utf8")) === handoff.evidenceDigest;
  } catch {
    return false;
  }
}

/**
 * Materialize exactly one acceptance finding for a non-semantic checkpoint.
 * Idempotence is keyed to the source step and the immutable artifact digest.
 */
export function materializeNonblockingAcceptanceHandoff({
  root,
  flowState,
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
  const specDir = specDirFromFlowState(root, flowState);
  const sourceArtifact = sourceRefWithinSpec({ root, specDir, evidenceRef });
  const fingerprint = digest(`${sourceStep}\u0000${evidenceDigest}`);
  const artifact = readHandoffArtifact(specDir);
  let finding = artifact.findings.find((entry) => (
    entry.sourceStep === sourceStep && entry.evidenceDigest === evidenceDigest
  ));
  if (!finding) {
    finding = new NonBlockingHandoffFinding({
      findingId: `NB-${fingerprint.slice(0, 16)}`,
      fingerprint,
      sourceStep,
      sourceArtifact,
      evidenceDigest,
      resultKind,
    });
    const next = new NonBlockingHandoffArtifact({
      findings: [...artifact.findings, finding],
    });
    writeHandoffArtifact(specDir, next);
  }
  appendDeferredFlowFinding({
    root,
    flowState,
    sourceStep,
    sourceArtifact: NONBLOCKING_HANDOFF_FILE,
    sourceFindingId: finding.findingId,
    fingerprint,
    rationale: "An explicit nonblocking decision deferred this checkpoint to acceptance.",
    attempts,
    finalDisposition: "still_open",
  });
  return { findingCount: 1, sourceArtifact: NONBLOCKING_HANDOFF_FILE, sourceFindingId: finding.findingId };
}
