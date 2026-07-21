import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runGit, runGitToFile } from "../../lib/git-helpers.js";

export const REPAIR_STATE_VERSION = 2;
export const DEFAULT_REPAIR_CHANGED_PATH_LIMIT = 20_000;
export const MAX_REPAIR_CHANGED_PATH_LIMIT = 1_000_000;
export const REPAIR_FINGERPRINT_MANIFEST_FILE = "repair-fingerprint.json";
export const REPAIR_DELTA_DIR = "repair-deltas";
export const REPAIR_TRANSACTION_FILE = "impl-repair-transaction.json";
export const REPAIR_MIGRATION_FILE = "repair-state-migration.json";
export const REPAIR_LOCK_DIR = ".impl-repair.lock";
export const REPAIR_BASELINE_PUBLICATION_DIR = path.join(".senti", "recovery", "repair-baselines");

const MAX_PATH_LENGTH = 4096;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const RUN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const REPAIR_REF_PATTERN = /^refs\/senti\/flows\/([A-Za-z0-9._-]+)\/baseline$/;
const ENTRY_MODE_PATTERN = /^(?:100644|100755|120000|160000|missing)$/;
const ENTRY_STATUS_PATTERN = /^(?:(?:committed|index|worktree):(?:[ACDMTUXBR]|untracked)|explicit:(?:input|missing)|filesystem:input)$/;
const ENTRY_OID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;

function compareCanonicalText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export class RepairStateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RepairStateError";
    this.code = requireString(code, "code");
    this.details = Object.freeze({ ...details });
  }
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function requireHash(value, field) {
  const digest = requireString(value, field);
  if (!HASH_PATTERN.test(digest)) throw new Error(`${field} must be a SHA-256 digest`);
  return digest.toLowerCase();
}

function requireArtifactId(value, field) {
  const id = requireString(value, field);
  if (!RUN_ID_PATTERN.test(id) || id === "." || id === "..") {
    throw new Error(`${field} must be a safe artifact identifier`);
  }
  return id;
}

export function normalizeRepairPath(value) {
  const source = String(value || "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (source.includes("\0")) throw new Error("repair state path must not contain NUL");
  const normalized = path.posix.normalize(source);
  if (!normalized || normalized === ".") throw new Error("repair state path must be non-empty");
  if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`repair state path must stay inside the repository: ${normalized}`);
  }
  if (normalized.length > MAX_PATH_LENGTH) {
    throw new Error(`repair state path exceeds ${MAX_PATH_LENGTH} characters: ${normalized}`);
  }
  return normalized;
}

function canonicalHash(parts) {
  const hash = crypto.createHash("sha256");
  for (const part of parts) {
    hash.update(String(part));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function baselineIdentity(baseline) {
  return {
    kind: baseline.kind,
    objectFormat: baseline.objectFormat,
    commitOid: baseline.commitOid,
    treeOid: baseline.treeOid,
  };
}

function runGitRequired(root, args, label) {
  const result = runGit(args, { cwd: root });
  if (!result.ok) throw new Error(`${label}: ${result.stderr || result.stdout}`.trim());
  return result.stdout;
}

function gitObjectFormat(root) {
  const result = runGit(["rev-parse", "--show-object-format"], { cwd: root });
  if (!result.ok) return "sha1";
  const format = result.stdout.trim();
  if (format !== "sha1" && format !== "sha256") {
    throw new Error(`unsupported Git object format: ${format}`);
  }
  return format;
}

function oidPattern(format) {
  return format === "sha256" ? /^[a-f0-9]{64}$/i : /^[a-f0-9]{40}$/i;
}

function requireOid(value, field, format) {
  const oid = requireString(value, field);
  if (!oidPattern(format).test(oid)) throw new Error(`${field} is not a ${format} object id`);
  return oid.toLowerCase();
}

export class ImmutableGitBaseline {
  constructor(input = {}) {
    this.kind = input.kind || "git";
    if (this.kind !== "git" && this.kind !== "filesystem") {
      throw new Error(`unsupported repair baseline kind: ${this.kind}`);
    }
    this.objectFormat = this.kind === "git" ? requireString(input.objectFormat, "objectFormat") : "sha256";
    if (this.kind === "git" && this.objectFormat !== "sha1" && this.objectFormat !== "sha256") {
      throw new Error(`unsupported Git object format: ${this.objectFormat}`);
    }
    this.commitOid = this.kind === "git"
      ? requireOid(input.commitOid, "commitOid", this.objectFormat)
      : requireHash(input.commitOid, "commitOid");
    this.treeOid = this.kind === "git"
      ? requireOid(input.treeOid, "treeOid", this.objectFormat)
      : requireHash(input.treeOid, "treeOid");
    this.sourceRef = requireString(input.sourceRef, "sourceRef");
    this.ref = input.ref == null ? null : requireString(input.ref, "ref");
    if (this.kind === "git" && this.ref != null) {
      const match = REPAIR_REF_PATTERN.exec(this.ref);
      if (!match || match[1] === "." || match[1] === "..") {
        throw new Error("repair baseline ref must use the refs/senti/flows/<runId>/baseline namespace");
      }
    }
    this.createdRef = input.createdRef === true;
    this.capturedAt = requireString(input.capturedAt, "capturedAt");
    if (Number.isNaN(Date.parse(this.capturedAt))) throw new Error("capturedAt must be an ISO timestamp");
    Object.freeze(this);
  }

  toJSON() {
    return {
      kind: this.kind,
      objectFormat: this.objectFormat,
      commitOid: this.commitOid,
      treeOid: this.treeOid,
      sourceRef: this.sourceRef,
      ref: this.ref,
      capturedAt: this.capturedAt,
    };
  }
}

export class RepairBaselinePublication {
  constructor(input = {}) {
    if (input.version !== 1) throw new Error("repair baseline publication version must be 1");
    this.version = 1;
    this.runId = requireArtifactId(input.runId, "runId");
    this.statePath = requireString(input.statePath, "statePath");
    if (!path.isAbsolute(this.statePath) || path.basename(this.statePath) !== "flow.json") {
      throw new Error("repair baseline publication statePath must be an absolute flow.json path");
    }
    this.baseline = input.baseline instanceof ImmutableGitBaseline
      ? input.baseline
      : new ImmutableGitBaseline(input.baseline);
    const expectedRef = `refs/senti/flows/${this.runId}/baseline`;
    if (this.baseline.kind !== "git" || this.baseline.ref !== expectedRef) {
      throw new Error("repair baseline publication ref does not match its runId");
    }
    this.createdAt = requireString(input.createdAt, "createdAt");
    if (Number.isNaN(Date.parse(this.createdAt))) {
      throw new Error("repair baseline publication createdAt must be an ISO timestamp");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      statePath: this.statePath,
      baseline: this.baseline.toJSON(),
      createdAt: this.createdAt,
    };
  }
}

export class CanonicalRepairEntry {
  constructor(input = {}) {
    this.path = normalizeRepairPath(input.path);
    this.oldPath = input.oldPath == null ? null : normalizeRepairPath(input.oldPath);
    this.statuses = Object.freeze([...new Set((input.statuses || []).map((entry) => requireString(entry, "status")))].sort());
    if (this.statuses.length === 0) throw new Error(`repair state entry has no status: ${this.path}`);
    this.mode = requireString(input.mode, "mode");
    if (!this.statuses.every((status) => ENTRY_STATUS_PATTERN.test(status))) {
      throw new Error(`repair state entry has an invalid status: ${this.path}`);
    }
    if (!ENTRY_MODE_PATTERN.test(this.mode)) throw new Error(`repair state entry has an invalid mode: ${this.path}`);
    this.indexOid = input.indexOid == null ? null : requireString(input.indexOid, "indexOid").toLowerCase();
    if (this.indexOid != null && !ENTRY_OID_PATTERN.test(this.indexOid)) {
      throw new Error(`repair state entry has an invalid indexOid: ${this.path}`);
    }
    this.contentHash = requireHash(input.contentHash, "contentHash");
    Object.freeze(this);
  }

  toJSON() {
    return {
      path: this.path,
      oldPath: this.oldPath,
      statuses: [...this.statuses],
      mode: this.mode,
      indexOid: this.indexOid,
      contentHash: this.contentHash,
    };
  }

  canonicalParts() {
    return [this.path, this.oldPath || "", ...this.statuses, this.mode, this.indexOid || "", this.contentHash];
  }
}

export class RepairFingerprintManifest {
  constructor(input = {}) {
    if (input.version !== REPAIR_STATE_VERSION) {
      throw new Error(`repair fingerprint version must be ${REPAIR_STATE_VERSION}`);
    }
    this.version = REPAIR_STATE_VERSION;
    this.baseline = input.baseline instanceof ImmutableGitBaseline
      ? input.baseline
      : new ImmutableGitBaseline(input.baseline);
    this.headOid = this.baseline.kind === "git"
      ? requireOid(input.headOid, "headOid", this.baseline.objectFormat)
      : requireHash(input.headOid, "headOid");
    this.headTreeOid = this.baseline.kind === "git"
      ? requireOid(input.headTreeOid, "headTreeOid", this.baseline.objectFormat)
      : requireHash(input.headTreeOid, "headTreeOid");
    this.environmentHash = requireHash(input.environmentHash, "environmentHash");
    if (!Array.isArray(input.entries)) throw new Error("repair fingerprint entries must be an array");
    this.entries = Object.freeze(input.entries.map((entry) => (
      entry instanceof CanonicalRepairEntry ? entry : new CanonicalRepairEntry(entry)
    )).sort((a, b) => compareCanonicalText(a.path, b.path)));
    if (new Set(this.entries.map((entry) => entry.path)).size !== this.entries.length) {
      throw new Error("repair fingerprint entries must not contain duplicate paths");
    }
    const parts = [
      this.version,
      JSON.stringify(baselineIdentity(this.baseline)),
      this.environmentHash,
      ...this.entries.flatMap((entry) => entry.canonicalParts()),
    ];
    const expectedHash = canonicalHash(parts);
    if (input.hash != null && requireHash(input.hash, "hash") !== expectedHash) {
      throw new Error("repair fingerprint hash does not match its canonical state");
    }
    this.hash = expectedHash;
    Object.freeze(this);
  }

  toReference() {
    return {
      version: this.version,
      hash: this.hash,
      manifestRef: REPAIR_FINGERPRINT_MANIFEST_FILE,
    };
  }

  toJSON() {
    return {
      version: this.version,
      hash: this.hash,
      baseline: this.baseline.toJSON(),
      headOid: this.headOid,
      headTreeOid: this.headTreeOid,
      environmentHash: this.environmentHash,
      entries: this.entries.map((entry) => entry.toJSON()),
    };
  }
}

export class RepairFingerprintReference {
  constructor(input = {}) {
    if (input.version !== REPAIR_STATE_VERSION) {
      throw new Error(`repair fingerprint reference version must be ${REPAIR_STATE_VERSION}`);
    }
    this.version = REPAIR_STATE_VERSION;
    this.hash = requireHash(input.hash, "hash");
    this.manifestRef = normalizeRepairPath(input.manifestRef);
    Object.freeze(this);
  }

  toJSON() {
    return { version: this.version, hash: this.hash, manifestRef: this.manifestRef };
  }
}

export class RepairArtifactRegistry {
  #exact;
  #prefixes;

  constructor(specPath) {
    this.specPath = normalizeRepairPath(specPath);
    this.specDir = path.posix.dirname(this.specPath);
    const specArtifacts = [
      "flow.json",
      "draft.json",
      "draft.md",
      "issue.md",
      "issue-log.json",
      "flow-findings.json",
      "acceptance-review-evidence.json",
      "qa.md",
      "spec.md",
      "file-map.json",
      "review.md",
      "draft-review.md",
      "draft-review-questions.json",
      "draft-review-questions.md",
      "draft-review-questions-repair.json",
      "draft-review-coverage.json",
      "draft-review-coverage.md",
      "draft-questions-triage.json",
      "draft-questions-repair.json",
      "draft-coverage-triage.json",
      "draft-coverage-repair.json",
      "draft-gate-source.json",
      "spec-review.json",
      "spec-review.md",
      "spec-review-triage.json",
      "spec-triage.json",
      "spec-repair.json",
      "spec-gate-source.json",
      "test-review.json",
      "test-review.md",
      "test-coverage.json",
      "test-result-review.md",
      "scenario-validity-result.json",
      "upgrade-result.json",
      "placeholder-permission.json",
      "test-execute-result.json",
      "test-result-review.json",
      "impl-review.json",
      "impl-gate-result.json",
      "retro.json",
      "acceptance-review.json",
      "final-regression-result.json",
      "gate-impl-memory.json",
      "retry-recovery.json",
      ".retry-recovery.transaction.json",
      "completion-overrides.json",
      "report.json",
      "impl-triage.json",
      "impl-repair.json",
      REPAIR_FINGERPRINT_MANIFEST_FILE,
      REPAIR_TRANSACTION_FILE,
      REPAIR_MIGRATION_FILE,
    ].map((name) => `${this.specDir}/${name}`);
    this.#exact = new Set([
      ".senti/.active-flow",
      ".senti/.repository-flow-operation.lock",
      ".senti/.repository-maintenance.lock",
      ".senti/.worktree-prepare-attempt.json",
      ".senti/flow-identity.json",
      ".senti/flow-identity.issue-transaction.json",
      ".senti/.flow-identity.publication.json",
      ".senti/.flow-identity.publication.intent",
      ".senti/.flow-identity.publication.receipt.tmp",
      ".senti/.flow-identity.publication.binding.tmp",
      ".senti/last-finalized-spec",
      ...specArtifacts,
    ]);
    this.#prefixes = Object.freeze([
      ".tmp/",
      ".senti/.active-flow.",
      ".senti/agent-cache/",
      ".senti/agent-work/",
      ".senti/output/",
      ".senti/recovery/",
      ".senti/worktree/",
      `${this.specDir}/tests/.raw/`,
      `${this.specDir}/review-history/`,
      `${this.specDir}/${REPAIR_DELTA_DIR}/`,
      `${this.specDir}/${REPAIR_LOCK_DIR}/`,
    ]);
    Object.freeze(this);
  }

  owns(value) {
    const relPath = normalizeRepairPath(value);
    if (this.#exact.has(relPath) || this.#prefixes.some((prefix) => relPath.startsWith(prefix))) return true;
    const directory = path.posix.dirname(relPath);
    const basename = path.posix.basename(relPath);
    if (directory !== this.specDir || !basename.endsWith(".tmp")) return false;
    return [...this.#exact].some((owned) => {
      const ownedName = path.posix.basename(owned);
      return basename.startsWith(`${ownedName}.`);
    });
  }

  gitPathspecExcludes() {
    return Object.freeze([
      ...[...this.#exact].flatMap((owned) => [
        `:(exclude,top,literal)${owned}`,
        `:(exclude,top,glob)${owned}.*.tmp`,
      ]),
      ...this.#prefixes.map((prefix) => `:(exclude,top,glob)${prefix}**`),
    ]);
  }
}

function assertSafeRunId(runId) {
  const value = requireString(runId, "runId");
  if (!RUN_ID_PATTERN.test(value) || value === "." || value === "..") {
    throw new Error("runId is not safe for a repair baseline ref");
  }
  return value;
}

function resolveSingleMergeBase(root, baseRef) {
  const result = runGit(["merge-base", "--all", "HEAD", baseRef], { cwd: root });
  if (!result.ok) {
    throw new RepairStateError(
      "REPAIR_BASELINE_UNRESOLVABLE",
      `failed to resolve repair baseline merge-base: ${result.stderr || result.stdout}`.trim(),
      { baseRef },
    );
  }
  const candidates = result.stdout.trim().split("\n").filter(Boolean);
  if (candidates.length !== 1) {
    throw new RepairStateError(
      "REPAIR_BASELINE_AMBIGUOUS",
      `repair baseline requires exactly one merge-base; observed ${candidates.length}`,
      { candidateCount: candidates.length },
    );
  }
  return candidates[0];
}

export function captureRepairBaseline({ root, baseRef, runId, useMergeBase = false, pin = true }) {
  const objectFormat = gitObjectFormat(root);
  const sourceRef = requireString(baseRef, "baseRef");
  const ref = pin ? `refs/senti/flows/${assertSafeRunId(runId)}/baseline` : null;
  const pinned = ref ? runGit(["rev-parse", "--verify", ref], { cwd: root }) : null;
  let commitCandidate = pinned?.ok ? pinned.stdout.trim() : null;
  if (commitCandidate == null) {
    const source = runGit(["rev-parse", "--verify", "--end-of-options", `${sourceRef}^{commit}`], { cwd: root });
    if (!source.ok) {
      throw new RepairStateError(
        "REPAIR_BASELINE_UNRESOLVABLE",
        `failed to resolve repair baseline source ${sourceRef}: ${source.stderr || source.stdout}`.trim(),
        { sourceRef },
      );
    }
    const sourceCommit = source.stdout.trim();
    commitCandidate = useMergeBase ? resolveSingleMergeBase(root, sourceCommit) : sourceCommit;
  }
  const commitOid = requireOid(commitCandidate, "commitOid", objectFormat);
  const tree = runGit(["rev-parse", "--verify", `${commitOid}^{tree}`], { cwd: root });
  if (!tree.ok) {
    throw new RepairStateError(
      "REPAIR_BASELINE_OBJECT_MISSING",
      `failed to resolve repair baseline tree for ${commitOid}: ${tree.stderr || tree.stdout}`.trim(),
      { commitOid },
    );
  }
  const treeOid = requireOid(tree.stdout.trim(), "treeOid", objectFormat);
  if (ref) {
    if (!pinned.ok) {
      const created = runGit(["update-ref", ref, commitOid, ""], { cwd: root });
      if (!created.ok) {
        throw new RepairStateError(
          "REPAIR_BASELINE_PIN_FAILED",
          `failed to pin repair baseline ${ref}: ${created.stderr || created.stdout}`.trim(),
          { ref, commitOid },
        );
      }
    }
  }
  return new ImmutableGitBaseline({
    kind: "git",
    objectFormat,
    commitOid,
    treeOid,
    sourceRef,
    ref,
    createdRef: Boolean(ref && !pinned.ok),
    capturedAt: new Date().toISOString(),
  });
}

function repairBaselinePublicationFile(mainRoot, runId) {
  return path.join(mainRoot, REPAIR_BASELINE_PUBLICATION_DIR, `${requireArtifactId(runId, "runId")}.json`);
}

function pinPublishedBaseline(root, baseline) {
  const current = baseline instanceof ImmutableGitBaseline ? baseline : new ImmutableGitBaseline(baseline);
  const existing = runGit(["rev-parse", "--verify", current.ref], { cwd: root });
  if (existing.ok) {
    if (existing.stdout.trim() !== current.commitOid) {
      throw new RepairStateError(
        "REPAIR_BASELINE_AUTHORITY_MISMATCH",
        `repair baseline publication authority mismatch: ${current.ref}`,
        { ref: current.ref, expected: current.commitOid },
      );
    }
    return current;
  }
  const created = runGit(["update-ref", current.ref, current.commitOid, ""], { cwd: root });
  if (!created.ok) {
    throw new RepairStateError(
      "REPAIR_BASELINE_PIN_FAILED",
      `failed to pin repair baseline ${current.ref}: ${created.stderr || created.stdout}`.trim(),
      { ref: current.ref, commitOid: current.commitOid },
    );
  }
  return current;
}

function assertPublicationStatePath(mainRoot, publication) {
  const relative = path.relative(path.resolve(mainRoot), path.resolve(publication.statePath));
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new RepairStateError(
      "REPAIR_BASELINE_PUBLICATION_INVALID",
      `repair baseline publication state path escapes the repository authority: ${publication.statePath}`,
      { runId: publication.runId },
    );
  }
}

export function beginRepairBaselinePublication({
  root,
  mainRoot,
  baseRef,
  runId,
  useMergeBase = false,
  statePath,
}) {
  const authorityRoot = path.resolve(mainRoot || root);
  const resolvedStatePath = path.resolve(statePath);
  const file = repairBaselinePublicationFile(authorityRoot, runId);
  let publication;
  if (fs.existsSync(file)) {
    publication = new RepairBaselinePublication(JSON.parse(fs.readFileSync(file, "utf8")));
    if (publication.statePath !== resolvedStatePath || publication.baseline.sourceRef !== baseRef) {
      throw new RepairStateError(
        "REPAIR_BASELINE_PUBLICATION_CONFLICT",
        `repair baseline publication retry does not match run ${runId}`,
        { runId },
      );
    }
  } else {
    const resolved = captureRepairBaseline({ root, baseRef, runId, useMergeBase, pin: false });
    const baseline = new ImmutableGitBaseline({
      ...resolved.toJSON(),
      ref: `refs/senti/flows/${requireArtifactId(runId, "runId")}/baseline`,
    });
    publication = new RepairBaselinePublication({
      version: 1,
      runId,
      statePath: resolvedStatePath,
      baseline,
      createdAt: new Date().toISOString(),
    });
    assertPublicationStatePath(authorityRoot, publication);
    atomicWriteJson(file, publication.toJSON());
  }
  assertPublicationStatePath(authorityRoot, publication);
  pinPublishedBaseline(root, publication.baseline);
  return publication;
}

export function completeRepairBaselinePublication({ mainRoot, publication }) {
  const current = publication instanceof RepairBaselinePublication
    ? publication
    : new RepairBaselinePublication(publication);
  const file = repairBaselinePublicationFile(path.resolve(mainRoot), current.runId);
  if (!fs.existsSync(file)) return false;
  const stored = new RepairBaselinePublication(JSON.parse(fs.readFileSync(file, "utf8")));
  if (
    stored.statePath !== current.statePath
    || stored.baseline.ref !== current.baseline.ref
    || stored.baseline.commitOid !== current.baseline.commitOid
  ) {
    throw new RepairStateError(
      "REPAIR_BASELINE_PUBLICATION_CONFLICT",
      `repair baseline publication completion authority mismatch: ${current.runId}`,
      { runId: current.runId },
    );
  }
  fs.rmSync(file, { force: true });
  return true;
}

export function rollbackRepairBaselinePublication({ root, mainRoot, publication }) {
  const current = publication instanceof RepairBaselinePublication
    ? publication
    : new RepairBaselinePublication(publication);
  deleteRepairBaselineRef({ root, baseline: current.baseline });
  completeRepairBaselinePublication({ mainRoot, publication: current });
}

export function recoverRepairBaselinePublications({ root, mainRoot, excludeRunId = null }) {
  const authorityRoot = path.resolve(mainRoot || root);
  const directory = path.join(authorityRoot, REPAIR_BASELINE_PUBLICATION_DIR);
  if (!fs.existsSync(directory)) return { recovered: [], retained: [] };
  const recovered = [];
  const retained = [];
  for (const name of fs.readdirSync(directory).sort(compareCanonicalText)) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(directory, name);
    const publication = new RepairBaselinePublication(JSON.parse(fs.readFileSync(file, "utf8")));
    assertPublicationStatePath(authorityRoot, publication);
    if (publication.runId === excludeRunId) {
      retained.push(publication.runId);
      continue;
    }
    if (fs.existsSync(publication.statePath)) {
      const state = JSON.parse(fs.readFileSync(publication.statePath, "utf8"));
      const baseline = state?.repairBaseline == null ? null : new ImmutableGitBaseline(state.repairBaseline);
      if (
        state?.runId !== publication.runId
        || baseline?.ref !== publication.baseline.ref
        || baseline?.commitOid !== publication.baseline.commitOid
      ) {
        throw new RepairStateError(
          "REPAIR_BASELINE_PUBLICATION_CONFLICT",
          `repair baseline publication state authority mismatch: ${publication.runId}`,
          { runId: publication.runId },
        );
      }
      pinPublishedBaseline(root, publication.baseline);
      completeRepairBaselinePublication({ mainRoot: authorityRoot, publication });
      retained.push(publication.runId);
      continue;
    }
    rollbackRepairBaselinePublication({ root, mainRoot: authorityRoot, publication });
    recovered.push(publication.runId);
  }
  return { recovered, retained };
}

export function deleteRepairBaselineRef({ root, baseline }) {
  const current = baseline instanceof ImmutableGitBaseline ? baseline : new ImmutableGitBaseline(baseline);
  if (current.kind !== "git" || current.ref == null) return false;
  const existing = runGit(["rev-parse", "--verify", current.ref], { cwd: root });
  if (!existing.ok) return false;
  if (existing.stdout.trim() !== current.commitOid) {
    throw new RepairStateError(
      "REPAIR_BASELINE_AUTHORITY_MISMATCH",
      `repair baseline cleanup authority mismatch: ${current.ref}`,
      { ref: current.ref },
    );
  }
  runGitRequired(root, ["update-ref", "-d", current.ref, current.commitOid], "failed to delete repair baseline ref");
  return true;
}

export function deleteRepairBaselineForFlow(root, flowState) {
  if (!flowState?.repairBaseline) return false;
  const expectedRef = `refs/senti/flows/${assertSafeRunId(flowState.runId)}/baseline`;
  if (flowState.repairBaseline.ref !== expectedRef) {
    throw new RepairStateError(
      "REPAIR_BASELINE_AUTHORITY_MISMATCH",
      `repair baseline does not belong to flow ${flowState.runId}`,
      { runId: flowState.runId, expectedRef },
    );
  }
  const deleted = deleteRepairBaselineRef({ root, baseline: flowState.repairBaseline });
  if (flowState.runId) {
    const file = repairBaselinePublicationFile(path.resolve(root), flowState.runId);
    if (fs.existsSync(file)) {
      const publication = new RepairBaselinePublication(JSON.parse(fs.readFileSync(file, "utf8")));
      if (
        publication.baseline.ref !== flowState.repairBaseline.ref
        || publication.baseline.commitOid !== flowState.repairBaseline.commitOid
      ) {
        throw new RepairStateError(
          "REPAIR_BASELINE_PUBLICATION_CONFLICT",
          `repair baseline finalize authority mismatch: ${flowState.runId}`,
          { runId: flowState.runId },
        );
      }
      fs.rmSync(file, { force: true });
    }
  }
  return deleted;
}

function isGitRepository(root) {
  return runGit(["rev-parse", "--is-inside-work-tree"], { cwd: root }).stdout.trim() === "true";
}

function readConfiguredBoundary(root) {
  const file = path.join(root, ".senti", "config.json");
  if (!fs.existsSync(file)) return { maxChangedPaths: DEFAULT_REPAIR_CHANGED_PATH_LIMIT, include: [] };
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  const input = config?.flow?.repairFingerprint || {};
  for (const key of Object.keys(input)) {
    if (!new Set(["maxChangedPaths", "include"]).has(key)) {
      throw new Error(`unknown flow.repairFingerprint setting: ${key}`);
    }
  }
  const maxChangedPaths = input.maxChangedPaths ?? DEFAULT_REPAIR_CHANGED_PATH_LIMIT;
  if (!Number.isSafeInteger(maxChangedPaths) || maxChangedPaths < 1 || maxChangedPaths > MAX_REPAIR_CHANGED_PATH_LIMIT) {
    throw new Error(`flow.repairFingerprint.maxChangedPaths must be an integer between 1 and ${MAX_REPAIR_CHANGED_PATH_LIMIT}`);
  }
  if (input.include != null && !Array.isArray(input.include)) {
    throw new Error("flow.repairFingerprint.include must be an array");
  }
  return {
    maxChangedPaths,
    include: Object.freeze((input.include || []).map(normalizeRepairPath)),
  };
}

function forEachGitNulField(root, args, label, visit) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "senti-repair-git-"));
  const outputPath = path.join(directory, "stdout.bin");
  try {
    const result = runGitToFile(args, { cwd: root, outputPath });
    if (!result.ok) throw new Error(`${label}: ${result.stderr}`.trim());
    const descriptor = fs.openSync(outputPath, "r");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let pending = Buffer.alloc(0);
    try {
      for (;;) {
        const bytes = fs.readSync(descriptor, buffer, 0, buffer.length, null);
        if (bytes === 0) break;
        const chunk = pending.length === 0
          ? Buffer.from(buffer.subarray(0, bytes))
          : Buffer.concat([pending, buffer.subarray(0, bytes)]);
        let start = 0;
        for (let index = 0; index < chunk.length; index += 1) {
          if (chunk[index] !== 0) continue;
          visit(chunk.subarray(start, index).toString("utf8"));
          start = index + 1;
        }
        pending = Buffer.from(chunk.subarray(start));
        if (pending.length > (MAX_PATH_LENGTH * 4) + 128) {
          throw new Error(`${label}: Git emitted an overlong field`);
        }
      }
      if (pending.length !== 0) throw new Error(`${label}: Git output is not NUL terminated`);
    } finally {
      fs.closeSync(descriptor);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

class MutableChangedPath {
  constructor(relPath) {
    this.path = normalizeRepairPath(relPath);
    this.oldPath = null;
    this.statuses = new Set();
  }

  addStatus(scope, status, oldPath = null) {
    this.statuses.add(`${scope}:${status}`);
    if (oldPath != null) this.oldPath = normalizeRepairPath(oldPath);
  }
}

function changedPathEntry(changed, relPath, boundary) {
  const normalized = normalizeRepairPath(relPath);
  let entry = changed.get(normalized);
  if (entry) return entry;
  entry = new MutableChangedPath(normalized);
  changed.set(normalized, entry);
  if (changed.size > boundary.maxChangedPaths) {
    throw new RepairStateError(
      "REPAIR_CHANGED_PATH_LIMIT",
      `repair state changed path count ${changed.size} exceeds configured limit ${boundary.maxChangedPaths}; adjust flow.repairFingerprint.maxChangedPaths`,
      { observed: changed.size, limit: boundary.maxChangedPaths, setting: "flow.repairFingerprint.maxChangedPaths" },
    );
  }
  return entry;
}

function streamNameStatus(root, args, scope, changed, boundary) {
  let status = null;
  let oldPath = null;
  forEachGitNulField(root, args, `failed to collect ${scope} repair delta`, (field) => {
    if (status == null) {
      status = field;
      return;
    }
    if (/^[RC]/.test(status) && oldPath == null) {
      oldPath = field;
      return;
    }
    const entry = changedPathEntry(changed, field, boundary);
    entry.addStatus(scope, status[0], oldPath);
    status = null;
    oldPath = null;
  });
  if (status != null || oldPath != null) throw new Error(`malformed ${scope} Git name-status output`);
}

function collectGitChangedPaths(root, baseline, boundary) {
  const changed = new Map();
  streamNameStatus(root, [
    "diff", "--name-status", "-z", "--no-ext-diff", "--find-renames", baseline.commitOid, "HEAD",
  ], "committed", changed, boundary);
  streamNameStatus(root, [
    "diff", "--cached", "--name-status", "-z", "--no-ext-diff", "--find-renames", "HEAD",
  ], "index", changed, boundary);
  streamNameStatus(root, [
    "diff", "--name-status", "-z", "--no-ext-diff", "--find-renames",
  ], "worktree", changed, boundary);
  forEachGitNulField(root, [
    "ls-files", "--others", "--exclude-standard", "-z",
  ], "failed to collect untracked repair inputs", (relPath) => {
    const entry = changedPathEntry(changed, relPath, boundary);
    entry.addStatus("worktree", "untracked");
  });
  return changed;
}

function collectIndexState(root, objectFormat, paths) {
  const state = new Map();
  const input = [...paths];
  for (let offset = 0; offset < input.length; offset += 512) {
    const batch = input.slice(offset, offset + 512);
    forEachGitNulField(root, ["ls-files", "--stage", "-z", "--", ...batch], "failed to read Git index", (record) => {
      const match = record.match(/^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/i);
      if (!match) throw new Error("malformed Git index entry");
      const [, mode, rawOid, stage, rawPath] = match;
      const relPath = normalizeRepairPath(rawPath);
      if (stage !== "0") throw new Error(`unmerged Git index entry is not valid repair evidence: ${relPath}`);
      const zeroOid = /^0+$/.test(rawOid);
      const oid = zeroOid ? rawOid : requireOid(rawOid, `indexOid.${relPath}`, objectFormat);
      if (state.has(relPath)) throw new Error(`duplicate Git index entry: ${relPath}`);
      state.set(relPath, { mode, oid });
    });
  }
  return state;
}

function assertSupportedIndexFlags(root) {
  const sparseConfig = runGit(["config", "--bool", "core.sparseCheckout"], { cwd: root });
  const sparse = sparseConfig.ok && sparseConfig.stdout.trim() === "true";
  const skipWorktreePaths = [];
  forEachGitNulField(root, ["ls-files", "-v", "-z"], "failed to inspect Git index flags", (record) => {
    const tag = record[0];
    const relPath = normalizeRepairPath(record.slice(2));
    if (/[a-z]/.test(tag)) {
      throw new RepairStateError(
        "REPAIR_INDEX_FLAG_UNSUPPORTED",
        `assume-unchanged index entry is not valid repair evidence: ${relPath}`,
        { path: relPath, flag: "assume-unchanged" },
      );
    }
    if (tag === "S" && !sparse) {
      throw new RepairStateError(
        "REPAIR_INDEX_FLAG_UNSUPPORTED",
        `manual skip-worktree entry is not valid repair evidence: ${relPath}`,
        { path: relPath, flag: "skip-worktree" },
      );
    }
    if (tag === "S" && fs.lstatSync(path.join(root, relPath), { throwIfNoEntry: false })) {
      throw new RepairStateError(
        "REPAIR_INDEX_FLAG_UNSUPPORTED",
        `materialized skip-worktree entry is not valid repair evidence: ${relPath}`,
        { path: relPath, flag: "skip-worktree-materialized" },
      );
    }
    if (tag === "S") skipWorktreePaths.push(relPath);
  });
  return Object.freeze(skipWorktreePaths.sort(compareCanonicalText));
}

function environmentHash(root, skipWorktreePaths) {
  const config = runGit(["config", "--null", "--get-regexp", "^(core\\.(autocrlf|eol|symlinks|filemode|ignorecase|precomposeunicode)|filter\\..*\\.(clean|smudge|process|required))$"], { cwd: root });
  if (!config.ok && config.status !== 1) throw new Error(`failed to inspect Git filter environment: ${config.stderr}`);
  const sparseConfig = runGit(["config", "--bool", "core.sparseCheckout"], { cwd: root });
  const sparseEnabled = sparseConfig.ok && sparseConfig.stdout.trim() === "true";
  const sparse = sparseEnabled ? runGit(["sparse-checkout", "list"], { cwd: root }) : null;
  if (sparseEnabled && !sparse.ok) throw new Error(`failed to inspect sparse checkout definition: ${sparse.stderr || sparse.stdout}`);
  return canonicalHash([
    config.ok ? config.stdout : "",
    sparse?.ok ? sparse.stdout : "sparse-checkout:disabled",
    ...skipWorktreePaths,
  ]);
}

function hashRegularFile(file) {
  const hash = crypto.createHash("sha256");
  hash.update("file\0");
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  const buffer = Buffer.allocUnsafe(64 * 1024);
  const before = fs.fstatSync(descriptor, { bigint: true });
  if (!before.isFile()) {
    fs.closeSync(descriptor);
    throw new Error(`repair input changed type while opening: ${file}`);
  }
  try {
    const openedPath = fs.lstatSync(file, { bigint: true, throwIfNoEntry: false });
    if (!openedPath?.isFile() || openedPath.dev !== before.dev || openedPath.ino !== before.ino) {
      throw new Error(`repair input changed while opening: ${file}`);
    }
    for (;;) {
      const bytes = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytes === 0) break;
      hash.update(buffer.subarray(0, bytes));
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(file, { bigint: true, throwIfNoEntry: false });
    if (
      !pathAfter?.isFile()
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
      || pathAfter.dev !== after.dev
      || pathAfter.ino !== after.ino
      || pathAfter.size !== after.size
      || pathAfter.mtimeNs !== after.mtimeNs
      || pathAfter.ctimeNs !== after.ctimeNs
    ) {
      throw new Error(`repair input changed while hashing: ${file}`);
    }
    return {
      mode: (after.mode & 0o111n) === 0n ? "100644" : "100755",
      contentHash: hash.digest("hex"),
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function hashSymbolicLink(file) {
  const before = fs.lstatSync(file, { bigint: true, throwIfNoEntry: false });
  if (!before?.isSymbolicLink()) throw new Error(`repair input changed type while reading symlink: ${file}`);
  const target = fs.readlinkSync(file);
  const after = fs.lstatSync(file, { bigint: true, throwIfNoEntry: false });
  if (
    !after?.isSymbolicLink()
    || before.dev !== after.dev
    || before.ino !== after.ino
    || before.size !== after.size
    || before.mtimeNs !== after.mtimeNs
    || before.ctimeNs !== after.ctimeNs
    || fs.readlinkSync(file) !== target
  ) {
    throw new Error(`repair input changed while reading symlink: ${file}`);
  }
  return { mode: "120000", contentHash: canonicalHash(["symlink", target]) };
}

function contentIdentity(root, relPath, indexEntry) {
  const absolute = path.resolve(root, relPath);
  const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
  if (!stat) return { mode: indexEntry?.mode || "missing", contentHash: canonicalHash(["missing"]) };
  if (stat.isSymbolicLink()) return hashSymbolicLink(absolute);
  if (indexEntry?.mode === "160000" || stat.isDirectory()) {
    if (!stat.isDirectory()) throw new Error(`gitlink repair input is not a directory: ${relPath}`);
    const status = runGitRequired(absolute, ["status", "--porcelain", "--untracked-files=all"], `failed to inspect submodule ${relPath}`);
    if (status.trim() !== "") {
      throw new RepairStateError(
        "REPAIR_DIRTY_SUBMODULE",
        `dirty submodule is not valid repair evidence: ${relPath}`,
        { path: relPath },
      );
    }
    const oid = runGitRequired(absolute, ["rev-parse", "HEAD"], `failed to inspect submodule HEAD ${relPath}`).trim();
    return { mode: "160000", contentHash: canonicalHash(["gitlink", oid]) };
  }
  if (!stat.isFile()) throw new Error(`unsupported repair input type: ${relPath}`);
  return hashRegularFile(absolute);
}

function collectExplicitTree(root, relPath, changed, registry, boundary) {
  const normalized = normalizeRepairPath(relPath);
  if (registry.owns(normalized)) return;
  const absolute = path.resolve(root, normalized);
  const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
  if (!stat || stat.isFile() || stat.isSymbolicLink()) {
    const entry = changedPathEntry(changed, normalized, boundary);
    entry.addStatus("explicit", stat ? "input" : "missing");
    return;
  }
  if (!stat.isDirectory()) throw new Error(`unsupported explicit repair input: ${normalized}`);
  for (const dirent of fs.readdirSync(absolute, { withFileTypes: true })) {
    collectExplicitTree(root, path.posix.join(normalized, dirent.name), changed, registry, boundary);
  }
}

function buildFilesystemManifest({ root, specPath, boundary, registry }) {
  const changed = new Map();
  const walk = (absolute, relative = "") => {
    for (const dirent of fs.readdirSync(absolute, { withFileTypes: true })) {
      const relPath = normalizeRepairPath(path.posix.join(relative, dirent.name));
      if (registry.owns(relPath) || relPath === ".git" || relPath.startsWith(".git/")) continue;
      const full = path.join(absolute, dirent.name);
      if (dirent.isDirectory()) walk(full, relPath);
      else {
        const entry = changedPathEntry(changed, relPath, boundary);
        entry.addStatus("filesystem", "input");
      }
    }
  };
  walk(root);
  const entries = [...changed.values()].map((entry) => {
    const identity = contentIdentity(root, entry.path, null);
    return new CanonicalRepairEntry({
      path: entry.path,
      oldPath: entry.oldPath,
      statuses: [...entry.statuses],
      mode: identity.mode,
      indexOid: null,
      contentHash: identity.contentHash,
    });
  });
  if (entries.length > boundary.maxChangedPaths) {
    throw new RepairStateError(
      "REPAIR_CHANGED_PATH_LIMIT",
      `repair state changed path count ${entries.length} exceeds configured limit ${boundary.maxChangedPaths}; adjust flow.repairFingerprint.maxChangedPaths`,
      { observed: entries.length, limit: boundary.maxChangedPaths, setting: "flow.repairFingerprint.maxChangedPaths" },
    );
  }
  const treeHash = canonicalHash(entries.flatMap((entry) => entry.canonicalParts()));
  const baseline = new ImmutableGitBaseline({
    kind: "filesystem",
    commitOid: canonicalHash(["filesystem-baseline", specPath]),
    treeOid: canonicalHash(["filesystem-tree", specPath]),
    sourceRef: "filesystem",
    ref: null,
    capturedAt: new Date(0).toISOString(),
  });
  return new RepairFingerprintManifest({
    version: REPAIR_STATE_VERSION,
    baseline,
    headOid: treeHash,
    headTreeOid: treeHash,
    environmentHash: canonicalHash(["filesystem"]),
    entries,
  });
}

function baselineFromStateOrRepository({ root, state, specDir }) {
  if (state?.repairBaseline) return new ImmutableGitBaseline(state.repairBaseline);
  const latest = path.join(specDir, REPAIR_FINGERPRINT_MANIFEST_FILE);
  if (fs.existsSync(latest)) return readRepairFingerprintManifest(specDir).baseline;
  const objectFormat = gitObjectFormat(root);
  const runId = state?.runId;
  if (runId) {
    const ref = `refs/senti/flows/${assertSafeRunId(runId)}/baseline`;
    const pinned = runGit(["rev-parse", "--verify", ref], { cwd: root });
    if (pinned.ok) {
      const commitOid = requireOid(pinned.stdout.trim(), "commitOid", objectFormat);
      const treeOid = requireOid(runGitRequired(root, ["rev-parse", `${commitOid}^{tree}`], "failed to read pinned repair baseline").trim(), "treeOid", objectFormat);
      return new ImmutableGitBaseline({
        kind: "git",
        objectFormat,
        commitOid,
        treeOid,
        sourceRef: state.baseBranch || "pinned",
        ref,
        capturedAt: state.createdAt || new Date().toISOString(),
      });
    }
  }
  let defaultBaseRef = "HEAD";
  for (const candidate of ["main", "master"]) {
    if (runGit(["show-ref", "--verify", `refs/heads/${candidate}`], { cwd: root }).ok) {
      defaultBaseRef = candidate;
      break;
    }
  }
  const baseRef = state?.baseBranch || defaultBaseRef;
  return captureRepairBaseline({ root, baseRef, runId: runId || "unbound", useMergeBase: baseRef !== "HEAD", pin: Boolean(runId) });
}

export function buildRepairStateManifest({ root, specPath, state = null }) {
  requireString(root, "root");
  const normalizedSpec = normalizeRepairPath(specPath);
  const registry = new RepairArtifactRegistry(normalizedSpec);
  const boundary = readConfiguredBoundary(root);
  if (!isGitRepository(root)) return buildFilesystemManifest({ root, specPath: normalizedSpec, boundary, registry });
  const specDir = path.dirname(path.resolve(root, normalizedSpec));
  const baseline = baselineFromStateOrRepository({ root, state, specDir });
  const skipWorktreePaths = assertSupportedIndexFlags(root);
  const changed = collectGitChangedPaths(root, baseline, boundary);
  collectExplicitTree(root, ".senti/config.json", changed, registry, boundary);
  collectExplicitTree(root, ".senti/config.local.json", changed, registry, boundary);
  collectExplicitTree(root, normalizedSpec, changed, registry, boundary);
  collectExplicitTree(root, path.posix.join(path.posix.dirname(normalizedSpec), "tests"), changed, registry, boundary);
  for (const relPath of boundary.include) collectExplicitTree(root, relPath, changed, registry, boundary);
  for (const relPath of [...changed.keys()]) {
    if (registry.owns(relPath)) changed.delete(relPath);
  }
  if (changed.size > boundary.maxChangedPaths) {
    throw new RepairStateError(
      "REPAIR_CHANGED_PATH_LIMIT",
      `repair state changed path count ${changed.size} exceeds configured limit ${boundary.maxChangedPaths}; adjust flow.repairFingerprint.maxChangedPaths`,
      { observed: changed.size, limit: boundary.maxChangedPaths, setting: "flow.repairFingerprint.maxChangedPaths" },
    );
  }
  const index = collectIndexState(root, baseline.objectFormat, changed.keys());
  const entries = [...changed.values()].map((entry) => {
    const indexEntry = index.get(entry.path) || null;
    const identity = contentIdentity(root, entry.path, indexEntry);
    return new CanonicalRepairEntry({
      path: entry.path,
      oldPath: entry.oldPath,
      statuses: [...entry.statuses],
      mode: identity.mode,
      indexOid: indexEntry?.oid || null,
      contentHash: identity.contentHash,
    });
  });
  const headOid = requireOid(runGitRequired(root, ["rev-parse", "HEAD"], "failed to resolve repair state HEAD").trim(), "headOid", baseline.objectFormat);
  const headTreeOid = requireOid(runGitRequired(root, ["rev-parse", "HEAD^{tree}"], "failed to resolve repair state tree").trim(), "headTreeOid", baseline.objectFormat);
  return new RepairFingerprintManifest({
    version: REPAIR_STATE_VERSION,
    baseline,
    headOid,
    headTreeOid,
    environmentHash: environmentHash(root, skipWorktreePaths),
    entries,
  });
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const descriptor = fs.openSync(temp, "wx", 0o600);
  let failure = null;
  try {
    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2) + "\n");
    fs.fsyncSync(descriptor);
  } catch (error) {
    failure = error;
  } finally {
    fs.closeSync(descriptor);
  }
  if (failure) {
    try { fs.unlinkSync(temp); } catch (_) { /* crash recovery ignores owned temp files */ }
    throw failure;
  }
  fs.renameSync(temp, file);
  const directory = fs.openSync(path.dirname(file), "r");
  try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
}

export function writeRepairFingerprintManifest(specDir, manifest) {
  const current = manifest instanceof RepairFingerprintManifest ? manifest : new RepairFingerprintManifest(manifest);
  const file = path.join(specDir, REPAIR_FINGERPRINT_MANIFEST_FILE);
  atomicWriteJson(file, current.toJSON());
  return { path: file, artifact: current.toJSON() };
}

export function readRepairFingerprintManifest(specDir) {
  const file = path.join(specDir, REPAIR_FINGERPRINT_MANIFEST_FILE);
  if (!fs.existsSync(file)) throw new Error(`${REPAIR_FINGERPRINT_MANIFEST_FILE} is required`);
  return new RepairFingerprintManifest(JSON.parse(fs.readFileSync(file, "utf8")));
}

export function changedRepairPaths(previous, current) {
  const before = previous instanceof RepairFingerprintManifest ? previous : new RepairFingerprintManifest(previous);
  const after = current instanceof RepairFingerprintManifest ? current : new RepairFingerprintManifest(current);
  if (JSON.stringify(baselineIdentity(before.baseline)) !== JSON.stringify(baselineIdentity(after.baseline))) {
    throw new Error("repair fingerprint baseline changed within an active flow");
  }
  const byPath = (manifest) => new Map(manifest.entries.map((entry) => [entry.path, JSON.stringify(entry.toJSON())]));
  const previousEntries = byPath(before);
  const currentEntries = byPath(after);
  const paths = new Set([...previousEntries.keys(), ...currentEntries.keys()]);
  return [...paths]
    .filter((relPath) => previousEntries.get(relPath) !== currentEntries.get(relPath))
    .sort(compareCanonicalText);
}

export class RepairDeltaArtifact {
  constructor(input = {}) {
    if (input.version !== 1) throw new Error("repair delta version must be 1");
    this.version = 1;
    this.id = requireArtifactId(input.id, "id");
    this.previousHash = requireHash(input.previousHash, "previousHash");
    this.currentHash = requireHash(input.currentHash, "currentHash");
    if (this.previousHash === this.currentHash) throw new Error("repair delta hashes must differ");
    if (!Array.isArray(input.changedPaths) || input.changedPaths.length === 0) {
      throw new Error("repair delta changedPaths must be a non-empty array");
    }
    this.changedPaths = Object.freeze(input.changedPaths.map(normalizeRepairPath).sort(compareCanonicalText));
    if (new Set(this.changedPaths).size !== this.changedPaths.length) {
      throw new Error("repair delta changedPaths must not contain duplicates");
    }
    const digest = canonicalHash([
      this.version,
      this.id,
      this.previousHash,
      this.currentHash,
      ...this.changedPaths,
    ]);
    if (input.digest != null && requireHash(input.digest, "digest") !== digest) {
      throw new Error("repair delta digest does not match its canonical content");
    }
    this.digest = digest;
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      id: this.id,
      previousHash: this.previousHash,
      currentHash: this.currentHash,
      changedPaths: [...this.changedPaths],
      digest: this.digest,
    };
  }
}

export function repairDeltaArtifact({ id, previous, current, changedPaths }) {
  const before = previous instanceof RepairFingerprintManifest ? previous : new RepairFingerprintManifest(previous);
  const after = current instanceof RepairFingerprintManifest ? current : new RepairFingerprintManifest(current);
  return new RepairDeltaArtifact({
    version: 1,
    id,
    previousHash: before.hash,
    currentHash: after.hash,
    changedPaths,
  });
}

export function writeRepairDelta(specDir, delta) {
  const artifact = delta instanceof RepairDeltaArtifact ? delta : new RepairDeltaArtifact(delta);
  const fileName = `${normalizeRepairPath(artifact.id)}.json`;
  const relPath = `${REPAIR_DELTA_DIR}/${fileName}`;
  const file = path.join(specDir, relPath);
  if (fs.existsSync(file)) {
    const stored = new RepairDeltaArtifact(JSON.parse(fs.readFileSync(file, "utf8")));
    if (stored.digest !== artifact.digest) throw new Error(`repair delta already exists with different content: ${relPath}`);
    return relPath;
  }
  atomicWriteJson(file, artifact.toJSON());
  return relPath;
}

export { atomicWriteJson };
