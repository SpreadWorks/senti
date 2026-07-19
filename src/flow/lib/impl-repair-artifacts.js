import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { findStepById } from "./step-tree.js";

export const REPAIR_FINGERPRINT_PATH_LIMIT = 500;
export const REPAIR_FINGERPRINT_PATH_LENGTH_LIMIT = 300;
export const REPAIR_FINGERPRINT_FILE_SIZE_LIMIT = 1024 * 1024;
export const IMPL_REPAIR_ARTIFACT_FILE = "impl-repair.json";
export const IMPL_TRIAGE_ARTIFACT_FILE = "impl-triage.json";
const IMPL_REPAIR_ENTRY_LIMIT = 100;
const IMPL_REPAIR_LEDGER_SIZE_LIMIT = 1024 * 1024;

export const EVIDENCE_FILE_BY_STEP = Object.freeze({
  "test-execute": "test-execute-result.json",
  "test-result-review": "test-result-review.json",
  "impl-review": "impl-review.json",
  "impl-gate": "impl-gate-result.json",
  retro: "retro.json",
  "acceptance-review": "acceptance-review.json",
});

const ASSOCIATED_EVIDENCE_PATHS = Object.freeze({
  "test-execute-result.json": ["tests/.raw/test-execution.log"],
  "test-result-review.json": ["test-result-review.md"],
  "impl-review.json": ["review.md"],
});
const TRIAGE_DECISIONS = new Set(["apply", "reject"]);

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function requireStringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} must be a non-empty array`);
  }
  return value.map((entry, index) => requireString(entry, `${field}[${index}]`));
}

function normalizeRelPath(value) {
  const source = String(value || "").replace(/\\/g, "/").replace(/^\.\//, "");
  const normalized = path.posix.normalize(source);
  if (!normalized || normalized === ".") throw new Error("repair fingerprint path must be non-empty");
  if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`repair fingerprint path must stay inside the repository: ${normalized}`);
  }
  if (normalized.length > REPAIR_FINGERPRINT_PATH_LENGTH_LIMIT) {
    throw new Error(`repair fingerprint path exceeds ${REPAIR_FINGERPRINT_PATH_LENGTH_LIMIT} characters: ${normalized}`);
  }
  return normalized;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function fingerprintFrom(value, field) {
  if (value instanceof RepairFingerprint) return value;
  try {
    return new RepairFingerprint(value);
  } catch (error) {
    throw new Error(`${field}: ${error.message}`);
  }
}

export class RepairFingerprint {
  constructor(input = {}) {
    if (!Array.isArray(input.paths) || input.paths.length === 0) throw new Error("paths must be a non-empty array");
    this.paths = Object.freeze([...new Set(input.paths.map(normalizeRelPath))].sort());
    if (this.paths.length > REPAIR_FINGERPRINT_PATH_LIMIT) {
      throw new Error(`repair fingerprint path count exceeds ${REPAIR_FINGERPRINT_PATH_LIMIT}`);
    }
    this.truncated = input.truncated === true;
    if (this.truncated) throw new Error("truncated repair fingerprint is not valid evidence");
    if (!input.pathHashes || typeof input.pathHashes !== "object" || Array.isArray(input.pathHashes)) {
      throw new Error("pathHashes must be an object");
    }
    const hashKeys = Object.keys(input.pathHashes).map(normalizeRelPath).sort();
    if (JSON.stringify(hashKeys) !== JSON.stringify(this.paths)) {
      throw new Error("pathHashes keys must exactly match paths");
    }
    this.pathHashes = Object.freeze(Object.fromEntries(this.paths.map((relPath) => {
      const digest = requireString(input.pathHashes[relPath], `pathHashes.${relPath}`);
      if (!/^[a-f0-9]{64}$/i.test(digest)) throw new Error(`pathHashes.${relPath} must be a SHA-256 digest`);
      return [relPath, digest];
    })));
    const canonical = crypto.createHash("sha256");
    for (const relPath of this.paths) {
      canonical.update(relPath);
      canonical.update("\0");
      canonical.update(this.pathHashes[relPath]);
      canonical.update("\0");
    }
    const canonicalHash = canonical.digest("hex");
    if (input.hash != null && requireString(input.hash, "hash") !== canonicalHash) {
      throw new Error("hash does not match paths and pathHashes");
    }
    this.hash = canonicalHash;
    Object.freeze(this);
  }

  toJSON() {
    return { hash: this.hash, paths: [...this.paths], pathHashes: { ...this.pathHashes }, truncated: false };
  }
}

export class ImplTriageItem {
  constructor(input = {}) {
    this.findingId = requireString(input.findingId, "findingId");
    this.sourceStep = requireString(input.sourceStep || "impl-review", "sourceStep");
    this.decision = requireString(input.decision, "decision");
    if (!TRIAGE_DECISIONS.has(this.decision)) throw new Error(`invalid triage decision: ${this.decision}`);
    this.rationale = requireString(input.rationale, "rationale");
    this.evidenceRefs = Object.freeze(requireStringArray(input.evidenceRefs || [], "evidenceRefs"));
    Object.freeze(this);
  }

  toJSON() {
    return {
      findingId: this.findingId,
      sourceStep: this.sourceStep,
      decision: this.decision,
      rationale: this.rationale,
      evidenceRefs: [...this.evidenceRefs],
    };
  }
}

export class InvalidatedArtifactRecord {
  constructor(input = {}) {
    this.path = normalizeRelPath(input.path);
    this.reason = requireString(input.reason, "reason");
    this.previousFingerprint = requireString(input.previousFingerprint, "previousFingerprint");
    if (!/^[a-f0-9]{64}$/i.test(this.previousFingerprint)) {
      throw new Error("previousFingerprint must be a 64-character SHA-256 digest");
    }
    Object.freeze(this);
  }

  toJSON() {
    return { path: this.path, reason: this.reason, previousFingerprint: this.previousFingerprint };
  }
}

export class ImplRepairEntry {
  constructor(input = {}) {
    this.id = requireString(input.id, "id");
    this.sourceFindingIds = Object.freeze(requireStringArray(input.sourceFindingIds, "sourceFindingIds"));
    if (new Set(this.sourceFindingIds).size !== this.sourceFindingIds.length) {
      throw new Error("sourceFindingIds must not contain duplicates");
    }
    this.changedPaths = Object.freeze(requireStringArray(input.changedPaths, "changedPaths").map(normalizeRelPath).sort());
    if (new Set(this.changedPaths).size !== this.changedPaths.length) {
      throw new Error("changedPaths must not contain duplicates");
    }
    this.reason = requireString(input.reason, "reason");
    this.previousFingerprint = fingerprintFrom(input.previousFingerprint, "previousFingerprint");
    this.currentFingerprint = fingerprintFrom(input.currentFingerprint, "currentFingerprint");
    if (this.previousFingerprint.hash === this.currentFingerprint.hash) {
      throw new Error("previousFingerprint and currentFingerprint must differ");
    }
    const expectedChangedPaths = repairChangedPaths(this.previousFingerprint, this.currentFingerprint);
    if (JSON.stringify(this.changedPaths) !== JSON.stringify(expectedChangedPaths)) {
      throw new Error("changedPaths must exactly match the fingerprint transition");
    }
    if (!Array.isArray(input.invalidations) || input.invalidations.length === 0) {
      throw new Error("invalidations must be a non-empty array");
    }
    this.invalidations = Object.freeze(input.invalidations.map((record) => (
      record instanceof InvalidatedArtifactRecord ? record : new InvalidatedArtifactRecord(record)
    )));
    if (new Set(this.invalidations.map((record) => record.path)).size !== this.invalidations.length) {
      throw new Error("invalidations must not contain duplicate paths");
    }
    this.invalidatedArtifacts = Object.freeze(this.invalidations.map((record) => record.path));
    if (input.invalidatedArtifacts != null) {
      const recordedPaths = requireStringArray(input.invalidatedArtifacts, "invalidatedArtifacts").map(normalizeRelPath);
      if (JSON.stringify(recordedPaths) !== JSON.stringify(this.invalidatedArtifacts)) {
        throw new Error("invalidatedArtifacts must match invalidations");
      }
    }
    this.createdAt = requireString(input.createdAt, "createdAt");
    if (Number.isNaN(Date.parse(this.createdAt))) throw new Error("createdAt must be an ISO timestamp");
    Object.freeze(this);
  }

  toJSON() {
    return {
      id: this.id,
      sourceFindingIds: [...this.sourceFindingIds],
      changedPaths: [...this.changedPaths],
      reason: this.reason,
      previousFingerprint: this.previousFingerprint.toJSON(),
      currentFingerprint: this.currentFingerprint.toJSON(),
      invalidatedArtifacts: [...this.invalidatedArtifacts],
      invalidations: this.invalidations.map((record) => record.toJSON()),
      createdAt: this.createdAt,
    };
  }
}

export class ImplRepairLedger {
  constructor(input = {}) {
    if (input.version !== 1) throw new Error("impl-repair ledger version must be 1");
    if (!Array.isArray(input.entries)) throw new Error("impl-repair ledger entries must be an array");
    if (input.entries.length > IMPL_REPAIR_ENTRY_LIMIT) {
      throw new Error(`impl-repair ledger exceeds ${IMPL_REPAIR_ENTRY_LIMIT} entries`);
    }
    this.version = 1;
    this.entries = Object.freeze(input.entries.map((entry) => (
      entry instanceof ImplRepairEntry ? entry : new ImplRepairEntry(entry)
    )));
    if (new Set(this.entries.map((entry) => entry.id)).size !== this.entries.length) {
      throw new Error("impl-repair ledger contains duplicate entry ids");
    }
    for (let index = 1; index < this.entries.length; index++) {
      if (this.entries[index - 1].currentFingerprint.hash !== this.entries[index].previousFingerprint.hash) {
        throw new Error("impl-repair fingerprint chain is discontinuous");
      }
    }
    Object.freeze(this);
  }

  append(entry) {
    const next = entry instanceof ImplRepairEntry ? entry : new ImplRepairEntry(entry);
    return new ImplRepairLedger({ version: 1, entries: [...this.entries, next] });
  }

  toJSON() {
    return { version: this.version, entries: this.entries.map((entry) => entry.toJSON()) };
  }
}

function addFingerprintPath(paths, relPath) {
  const normalized = normalizeRelPath(relPath);
  paths.add(normalized);
  if (paths.size > REPAIR_FINGERPRINT_PATH_LIMIT) {
    throw new Error(`repair fingerprint path count exceeds ${REPAIR_FINGERPRINT_PATH_LIMIT}`);
  }
}

function collectTree(root, relDir, paths, { excludePath = () => false } = {}) {
  if (excludePath(normalizeRelPath(relDir))) return;
  const absolute = path.resolve(root, relDir);
  const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
  if (!stat) return;
  if (stat.isSymbolicLink()) {
    addFingerprintPath(paths, relDir);
    return;
  }
  if (!stat.isDirectory()) {
    addFingerprintPath(paths, relDir);
    return;
  }
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.join(relDir, entry.name);
    if (entry.isSymbolicLink()) addFingerprintPath(paths, child);
    else if (entry.isDirectory()) collectTree(root, child, paths, { excludePath });
    else if (entry.isFile()) addFingerprintPath(paths, child);
  }
}

export function collectRepairFingerprintPaths({ root, specPath }) {
  requireString(root, "root");
  const normalizedSpec = normalizeRelPath(specPath);
  const paths = new Set();
  collectTree(root, "src", paths);
  collectTree(root, "plugins", paths);
  addFingerprintPath(paths, ".senti/config.json");
  addFingerprintPath(paths, normalizedSpec);
  const specTests = path.posix.join(path.posix.dirname(normalizedSpec), "tests");
  const rawEvidence = `${specTests}/.raw`;
  collectTree(root, specTests, paths, {
    excludePath: (relPath) => relPath === rawEvidence || relPath.startsWith(`${rawEvidence}/`),
  });
  return [...paths].sort();
}

export function buildRepairFingerprint({ root, specPath, truncated = false }) {
  if (truncated) throw new Error("truncated repair fingerprint is not valid evidence");
  const paths = collectRepairFingerprintPaths({ root, specPath });
  const pathHashes = {};
  for (const relPath of paths) {
    const absolute = path.resolve(root, relPath);
    const contentHash = crypto.createHash("sha256");
    const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
    if (!stat) {
      contentHash.update("missing\0");
    } else {
      if (stat.size > REPAIR_FINGERPRINT_FILE_SIZE_LIMIT) {
        throw new Error(`repair fingerprint input exceeds ${REPAIR_FINGERPRINT_FILE_SIZE_LIMIT} bytes: ${relPath}`);
      }
      if (stat.isSymbolicLink()) {
        contentHash.update("symlink\0");
        contentHash.update(fs.readlinkSync(absolute));
      } else {
        if (!stat.isFile()) throw new Error(`repair fingerprint input is not a file: ${relPath}`);
        contentHash.update("file\0");
        contentHash.update(fs.readFileSync(absolute));
      }
    }
    pathHashes[relPath] = contentHash.digest("hex");
  }
  return new RepairFingerprint({ paths, pathHashes, truncated: false });
}

export function stampRepairFingerprint({ root, specPath, artifact, fingerprint = null }) {
  const current = fingerprint instanceof RepairFingerprint
    ? fingerprint
    : (fingerprint ? new RepairFingerprint(fingerprint) : buildRepairFingerprint({ root, specPath }));
  return { ...artifact, repairFingerprint: current.hash };
}

export function assertRepairFingerprint({ artifact, fingerprint, label = "artifact" }) {
  const current = fingerprintFrom(fingerprint, "fingerprint");
  if (!artifact || typeof artifact !== "object") throw new Error(`${label} must be an object`);
  if (typeof artifact.repairFingerprint !== "string" || artifact.repairFingerprint === "") {
    throw new Error(`${label} repairFingerprint is missing`);
  }
  if (artifact.repairFingerprint !== current.hash) {
    throw new Error(`${label} repairFingerprint mismatch: expected ${current.hash}, got ${artifact.repairFingerprint}`);
  }
  return artifact;
}

export function assertCurrentRepairEvidenceFiles({ root, state, specDir, files }) {
  const existing = files.filter((file) => fs.existsSync(path.join(specDir, file)));
  if (existing.length === 0) return null;
  const fingerprint = buildRepairFingerprint({ root, specPath: state.spec });
  for (const file of existing) {
    assertRepairFingerprint({ artifact: readJson(path.join(specDir, file)), fingerprint, label: file });
  }
  return fingerprint;
}

export function writeRepairEvidenceArtifact({ specDir, stepId, artifact, fingerprint }) {
  const fileName = EVIDENCE_FILE_BY_STEP[stepId];
  if (!fileName) throw new Error(`unknown repair evidence step: ${stepId}`);
  const current = fingerprintFrom(fingerprint, "fingerprint");
  const stamped = stampRepairFingerprint({ artifact, fingerprint: current });
  const file = path.join(specDir, fileName);
  writeJson(file, stamped);
  return { path: file, artifact: stamped };
}

export function validateImplTriageArtifact(artifact, { sourceFindingIds } = {}) {
  if (!artifact || typeof artifact !== "object") throw new Error("impl-triage artifact must be an object");
  if (artifact.version !== 1) throw new Error("impl-triage version must be 1");
  if (artifact.phase !== "impl-triage") throw new Error("impl-triage phase is required");
  const sourceStep = requireString(artifact.sourceStep, "sourceStep");
  requireString(artifact.sourceArtifact, "sourceArtifact");
  const expected = requireStringArray(sourceFindingIds, "sourceFindingIds");
  const items = Array.isArray(artifact.items) ? artifact.items.map((item) => new ImplTriageItem(item)) : [];
  const actual = new Set();
  for (const item of items) {
    if (actual.has(item.findingId)) throw new Error(`duplicate finding id: ${item.findingId}`);
    if (item.sourceStep !== sourceStep) throw new Error(`finding ${item.findingId} sourceStep does not match ${sourceStep}`);
    if (sourceStep === "acceptance-review" && item.decision !== "apply") {
      throw new Error(`acceptance finding ${item.findingId} must use apply disposition`);
    }
    actual.add(item.findingId);
    if (!expected.includes(item.findingId)) throw new Error(`unknown finding id: ${item.findingId}`);
  }
  for (const findingId of expected) {
    if (!actual.has(findingId)) throw new Error(`missing finding id: ${findingId}`);
  }
  fingerprintFrom(artifact.previousFingerprint, "previousFingerprint");
  return artifact;
}

export function prepareImplTriageArtifact({ specDir, sourceStep, sourceArtifact, findings, fingerprint }) {
  const current = fingerprintFrom(fingerprint, "fingerprint");
  const sourceFindings = Array.isArray(findings) ? findings : [];
  if (sourceFindings.length === 0) throw new Error("impl-triage requires at least one source finding");
  const items = sourceFindings.map((finding, index) => {
    const findingId = requireString(finding.findingId || `F-${index + 1}`, "findingId");
    return new ImplTriageItem({
      findingId,
      sourceStep,
      decision: finding.decision || "apply",
      rationale: finding.suggestion || finding.summary || finding.issue || `Repair ${findingId}.`,
      evidenceRefs: [`${sourceArtifact}#${findingId}`],
    }).toJSON();
  });
  const artifact = {
    version: 1,
    phase: "impl-triage",
    sourceStep,
    sourceArtifact,
    previousFingerprint: current.toJSON(),
    generatedAt: new Date().toISOString(),
    items,
  };
  validateImplTriageArtifact(artifact, { sourceFindingIds: items.map((item) => item.findingId) });
  const file = path.join(specDir, IMPL_TRIAGE_ARTIFACT_FILE);
  writeJson(file, artifact);
  return { path: file, artifact };
}

function sourceFindingIds(sourceStep, source) {
  if (sourceStep === "impl-review") {
    const blocking = (source.blockingFindings || [])
      .map((finding, index) => finding.findingId || `F-${index + 1}`);
    const nonBlocking = (source.nonBlockingImprovements || [])
      .map((finding, index) => finding.findingId || `I-${index + 1}`);
    return [...blocking, ...nonBlocking];
  }
  if (sourceStep === "acceptance-review") {
    return (source.requirementJudgments || [])
      .filter((judgment) => judgment.status === "notMet")
      .map((judgment) => `acceptance:${judgment.requirementId}`);
  }
  throw new Error(`unsupported impl-triage source step: ${sourceStep}`);
}

export function validateStoredImplTriageArtifact({ specDir }) {
  const triage = readJson(path.join(specDir, IMPL_TRIAGE_ARTIFACT_FILE));
  const source = readJson(path.join(specDir, requireString(triage.sourceArtifact, "sourceArtifact")));
  validateImplTriageArtifact(triage, {
    sourceFindingIds: sourceFindingIds(triage.sourceStep, source),
  });
  const previous = fingerprintFrom(triage.previousFingerprint, "previousFingerprint");
  if (source.repairFingerprint !== previous.hash) {
    throw new Error("impl-triage previousFingerprint must match its source artifact");
  }
  return triage;
}

export function completeImplTriage({ specDir, flowManager }) {
  const triage = validateStoredImplTriageArtifact({ specDir });
  if (triage.items.some((item) => item.decision === "apply")) {
    return { requiresRepair: true, artifact: triage };
  }
  flowManager.mutate((state) => {
    const now = new Date().toISOString();
    for (const stepId of ["impl-triage", "impl-repair"]) {
      const step = findStepById(state.steps || [], stepId);
      if (!step) continue;
      step.status = "done";
      step.finishedAt = now;
    }
    const gate = findStepById(state.steps || [], "impl-gate");
    if (gate?.status === "pending") {
      gate.status = "in_progress";
      gate.startedAt = now;
    }
  });
  return { requiresRepair: false, artifact: triage };
}

export function readRejectedImplReviewTriage(specDir) {
  const file = path.join(specDir, IMPL_TRIAGE_ARTIFACT_FILE);
  if (!fs.existsSync(file)) return null;
  const triage = validateStoredImplTriageArtifact({ specDir });
  if (triage.sourceStep !== "impl-review") return null;
  return triage.items.every((item) => item.decision === "reject") ? triage : null;
}

function evidencePreviousFingerprint(artifact, fallback) {
  return typeof artifact?.repairFingerprint === "string" && /^[a-f0-9]{64}$/i.test(artifact.repairFingerprint)
    ? artifact.repairFingerprint
    : fallback.hash;
}

export function invalidateRepairEvidence({ specDir, currentFingerprint, previousFingerprint, reason }) {
  const current = fingerprintFrom(currentFingerprint, "currentFingerprint");
  const previous = fingerprintFrom(previousFingerprint, "previousFingerprint");
  const invalidations = [];
  const invalidatePath = (relPath, recordReason, priorHash) => {
    const full = path.join(specDir, relPath);
    if (!fs.existsSync(full)) return;
    fs.rmSync(full, { recursive: true, force: true });
    invalidations.push(new InvalidatedArtifactRecord({
      path: relPath,
      reason: `${requireString(reason, "reason")} (${recordReason})`,
      previousFingerprint: priorHash,
    }));
  };
  for (const relPath of Object.values(EVIDENCE_FILE_BY_STEP)) {
    const full = path.join(specDir, relPath);
    if (!fs.existsSync(full)) continue;
    let artifact = null;
    try {
      artifact = readJson(full);
    } catch (_) {
      artifact = null;
    }
    if (artifact?.repairFingerprint === current.hash) continue;
    const priorHash = evidencePreviousFingerprint(artifact, previous);
    const recordReason = artifact?.repairFingerprint ? "repair_fingerprint_mismatch" : "missing_repair_fingerprint";
    invalidatePath(relPath, recordReason, priorHash);
    for (const associated of ASSOCIATED_EVIDENCE_PATHS[relPath] || []) {
      invalidatePath(associated, `associated_${recordReason}`, priorHash);
    }
  }
  return {
    invalidatedArtifacts: invalidations.map((record) => record.path),
    invalidations: invalidations.map((record) => record.toJSON()),
  };
}

export function appendImplRepairEntry({ specDir, entry }) {
  const normalized = entry instanceof ImplRepairEntry ? entry : new ImplRepairEntry(entry);
  const file = path.join(specDir, IMPL_REPAIR_ARTIFACT_FILE);
  const ledger = fs.existsSync(file) ? readImplRepairLedger(specDir) : new ImplRepairLedger({ version: 1, entries: [] });
  const artifact = ledger.append(normalized).toJSON();
  writeJson(file, artifact);
  return { path: file, artifact };
}

export function readImplRepairLedger(specDir) {
  const file = path.join(specDir, IMPL_REPAIR_ARTIFACT_FILE);
  if (!fs.existsSync(file)) return null;
  if (fs.statSync(file).size > IMPL_REPAIR_LEDGER_SIZE_LIMIT) {
    throw new Error(`${IMPL_REPAIR_ARTIFACT_FILE} exceeds ${IMPL_REPAIR_LEDGER_SIZE_LIMIT} bytes`);
  }
  return new ImplRepairLedger(readJson(file));
}

function repairChangedPaths(previousFingerprint, currentFingerprint) {
  const paths = new Set([...previousFingerprint.paths, ...currentFingerprint.paths]);
  return [...paths].filter((relPath) => (
    previousFingerprint.pathHashes[relPath] !== currentFingerprint.pathHashes[relPath]
  )).sort();
}

export function completeImplRepair({ root, state, flowManager, resetStepIds }) {
  const specDir = path.dirname(path.resolve(root, state.spec));
  const triagePath = path.join(specDir, IMPL_TRIAGE_ARTIFACT_FILE);
  if (!fs.existsSync(triagePath)) throw new Error(`${IMPL_TRIAGE_ARTIFACT_FILE} is required`);
  const triage = validateStoredImplTriageArtifact({ specDir });
  const appliedFindingIds = triage.items
    .filter((item) => item.decision === "apply")
    .map((item) => item.findingId);
  if (appliedFindingIds.length === 0) throw new Error("impl-repair requires at least one apply disposition");
  const previousFingerprint = new RepairFingerprint(triage.previousFingerprint);
  const currentFingerprint = buildRepairFingerprint({ root, specPath: state.spec });
  if (currentFingerprint.hash === previousFingerprint.hash) {
    throw new Error("impl-repair fingerprint did not change");
  }
  const changedPaths = repairChangedPaths(previousFingerprint, currentFingerprint);
  if (changedPaths.length === 0) throw new Error("impl-repair changedPaths must be non-empty");
  const reason = `Repair applied for findings ${appliedFindingIds.join(", ")}.`;
  const invalidation = invalidateRepairEvidence({
    specDir,
    currentFingerprint,
    previousFingerprint,
    reason,
  });
  if (invalidation.invalidations.length === 0) throw new Error("impl-repair must invalidate at least one stale artifact");
  const existing = readImplRepairLedger(specDir);
  const entry = new ImplRepairEntry({
    id: `repair-${String((existing?.entries.length || 0) + 1).padStart(3, "0")}`,
    sourceFindingIds: appliedFindingIds,
    changedPaths,
    reason,
    previousFingerprint,
    currentFingerprint,
    invalidations: invalidation.invalidations,
    createdAt: new Date().toISOString(),
  });
  appendImplRepairEntry({ specDir, entry });
  flowManager.mutate((next) => {
    const repairStep = findStepById(next.steps || [], "impl-repair");
    if (repairStep) {
      repairStep.status = "done";
      repairStep.finishedAt = new Date().toISOString();
    }
    for (const stepId of resetStepIds) {
      const step = findStepById(next.steps || [], stepId);
      if (!step) continue;
      step.status = stepId === "test-execute" ? "in_progress" : "pending";
      delete step.startedAt;
      delete step.finishedAt;
      if (stepId === "test-execute") step.startedAt = new Date().toISOString();
    }
  });
  return { entry: entry.toJSON(), invalidations: invalidation.invalidations };
}
