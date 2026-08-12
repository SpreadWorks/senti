import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runGit } from "../../lib/git-helpers.js";
import {
  MAX_REVIEW_EVIDENCE_BYTES,
  REVIEW_EVIDENCE_VERSION,
  ReviewDisposition,
  ReviewEvidence,
  ReviewProvenance,
  applyReviewEvidenceTransition,
  resolveReviewPermittedOperation,
  REVIEW_NODE_ID_BY_PHASE,
} from "./review-convergence.js";
import { RepairArtifactRegistry } from "./repair-state-identity.js";
import { FlowArtifactCatalogStore, FlowVersionLocation } from "../../lib/flow-version.js";
import { ArtifactPublicationClaim } from "./flow-artifact-authority.js";
import { FLOW_ARTIFACT_CONTRACTS } from "../../lib/flow-artifact-contract.js";

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function reviewEvidenceError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function resolveCurrentReviewTreeSha(root, specPath = null) {
  const tree = runGit(["rev-parse", "HEAD^{tree}"], { cwd: root });
  if (!tree.ok) {
    throw reviewEvidenceError(
      "REVIEW_TARGET_TREE_UNAVAILABLE",
      `failed to resolve current review target tree: ${tree.stderr.trim()}`,
    );
  }
  const registry = specPath == null ? null : new RepairArtifactRegistry(specPath);
  const diff = runGit([
    "diff",
    "--binary",
    "HEAD",
    ...(registry ? ["--", ".", ...registry.gitPathspecExcludes()] : []),
  ], { cwd: root });
  if (!diff.ok) {
    throw reviewEvidenceError(
      "REVIEW_TARGET_TREE_UNAVAILABLE",
      `failed to resolve current review target diff: ${diff.stderr.trim()}`,
    );
  }
  const treeSha = tree.stdout.trim().toLowerCase();
  if (diff.stdout === "") return treeSha;
  return crypto.createHash("sha1").update(treeSha).update("\0").update(diff.stdout).digest("hex");
}

function requireDocument(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw reviewEvidenceError("REVIEW_EVIDENCE_INVALID", "review evidence must be a JSON object");
  }
  return value;
}

function sameRevision(left, right) {
  return left === right;
}

const REQUIRED_REVIEW_EVIDENCE_INPUT_FIELDS = Object.freeze([
  "version",
  "phase",
  "taskId",
  "treeSha",
  "provenance",
  "disposition",
  "blockingFindings",
  "advisoryFindings",
]);

export class ReviewEvidenceInput {
  constructor(input = {}) {
    const document = requireDocument(input);
    for (const field of REQUIRED_REVIEW_EVIDENCE_INPUT_FIELDS) {
      if (!Object.hasOwn(document, field)) {
        throw reviewEvidenceError("REVIEW_EVIDENCE_INVALID", `${field} is required`);
      }
    }
    if (Object.hasOwn(document, "identity") || Object.hasOwn(document, "evidenceDigest")) {
      throw reviewEvidenceError(
        "REVIEW_EVIDENCE_INVALID",
        "identity and evidenceDigest are computed by the CLI and cannot be supplied by a caller",
      );
    }
    try {
      if (document.version !== REVIEW_EVIDENCE_VERSION) {
        throw new Error(`version must be ${REVIEW_EVIDENCE_VERSION}`);
      }
      this.phase = document.phase;
      this.taskId = document.taskId;
      this.treeSha = document.treeSha;
      this.provenance = new ReviewProvenance(document.provenance);
      this.disposition = new ReviewDisposition({
        value: document.disposition,
        blockingFindings: document.blockingFindings,
        advisoryFindings: document.advisoryFindings,
      });
      this.evidence = new ReviewEvidence({
        version: document.version,
        phase: this.phase,
        taskId: this.taskId,
        treeSha: this.treeSha,
        targetStateDigest: document.targetStateDigest,
        provenance: this.provenance,
        disposition: this.disposition,
      });
    } catch (error) {
      if (error.code) throw error;
      throw reviewEvidenceError("REVIEW_EVIDENCE_INVALID", error.message);
    }
    Object.freeze(this);
  }

  static fromFile({ root, specDir, inputPath } = {}) {
    const resolvedRoot = path.resolve(root);
    const resolvedSpecDir = path.resolve(specDir);
    const resolvedInput = path.resolve(resolvedRoot, inputPath);
    if (!isInside(resolvedSpecDir, resolvedInput)) {
      throw reviewEvidenceError(
        "REVIEW_EVIDENCE_PATH_OUTSIDE_SPEC",
        "review evidence file must be inside the active spec directory",
      );
    }
    let stat;
    try {
      stat = fs.lstatSync(resolvedInput);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw reviewEvidenceError("REVIEW_EVIDENCE_FILE_INVALID", "review evidence file does not exist");
      }
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw reviewEvidenceError("REVIEW_EVIDENCE_FILE_INVALID", "review evidence path must be a regular file");
    }
    if (!isInside(fs.realpathSync(resolvedSpecDir), fs.realpathSync(resolvedInput))) {
      throw reviewEvidenceError(
        "REVIEW_EVIDENCE_PATH_OUTSIDE_SPEC",
        "review evidence file must resolve inside the active spec directory",
      );
    }
    if (stat.size > MAX_REVIEW_EVIDENCE_BYTES) {
      throw reviewEvidenceError(
        "REVIEW_EVIDENCE_TOO_LARGE",
        `review evidence exceeds ${MAX_REVIEW_EVIDENCE_BYTES} bytes`,
      );
    }
    let document;
    try {
      document = JSON.parse(fs.readFileSync(resolvedInput, "utf8"));
    } catch (error) {
      throw reviewEvidenceError("REVIEW_EVIDENCE_INVALID", `review evidence JSON is invalid: ${error.message}`);
    }
    return new ReviewEvidenceInput(document);
  }

  validateTarget({ phase, taskId = null, treeSha, targetStateDigest = null } = {}) {
    if (this.phase !== phase) throw new Error(`review evidence phase target mismatch: ${this.phase} != ${phase}`);
    if (this.taskId !== (taskId ?? null)) {
      throw new Error(`review evidence task target mismatch: ${this.taskId} != ${taskId ?? null}`);
    }
    if (this.treeSha !== treeSha) {
      throw new Error(`review evidence tree target mismatch: ${this.treeSha} != ${treeSha}`);
    }
    if (targetStateDigest != null && this.evidence.targetStateDigest !== targetStateDigest) {
      throw new Error("review evidence state digest target mismatch");
    }
    return this;
  }

  toEvidence(target) {
    this.validateTarget(target);
    return this.evidence;
  }
}

export class ReviewEvidenceWrite {
  constructor({ path: artifactPath, created }) {
    this.path = artifactPath;
    this.created = created === true;
    Object.freeze(this);
  }
}

export class ReviewEvidenceStore {
  static forVersion({ location, publicationClaim } = {}) {
    if (!(location instanceof FlowVersionLocation)) throw new Error("FlowVersionLocation is required for Version review evidence storage");
    location.requireScope("canonical");
    if (!(publicationClaim instanceof ArtifactPublicationClaim)) throw new Error("ArtifactPublicationClaim is required for Version review evidence storage");
    return new ReviewEvidenceStore({ location, publicationClaim });
  }

  constructor({ root, specDir, location = null, publicationClaim = null } = {}) {
    if (location instanceof FlowVersionLocation) {
      this.root = location.directory;
      this.specDir = location.directory;
      this.location = location;
      this.evidenceDir = null;
      this.catalogStore = new FlowArtifactCatalogStore({ location });
      this.publicationClaim = publicationClaim;
    } else {
      this.root = fs.realpathSync(path.resolve(root));
      this.specDir = fs.realpathSync(path.resolve(specDir));
      this.location = null;
      this.evidenceDir = path.join(this.specDir, "review-evidence");
      this.catalogStore = null;
      this.publicationClaim = null;
    }
    if (!isInside(this.root, this.specDir)) {
      throw new Error("specDir must be inside root");
    }
    Object.freeze(this);
  }

  ensureEvidenceDirectory(directory) {
    if (fs.existsSync(directory)) {
      const stat = fs.lstatSync(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw reviewEvidenceError(
          "REVIEW_EVIDENCE_PATH_INVALID",
          "canonical review evidence directory must be a real directory",
        );
      }
    } else {
      fs.mkdirSync(directory, { recursive: true });
    }
    if (!isInside(this.specDir, fs.realpathSync(directory))) {
      throw reviewEvidenceError(
        "REVIEW_EVIDENCE_PATH_OUTSIDE_SPEC",
        "canonical review evidence directory must stay inside the active spec directory",
      );
    }
  }

  contains(evidence) {
    if (!(evidence instanceof ReviewEvidence)) throw new Error("ReviewEvidence is required");
    const artifactPath = this.#artifactPath(evidence);
    const artifact = this.location === null ? null : this.#resolvedArtifact(evidence);
    const contains = () => {
    let stat;
    try {
      stat = fs.lstatSync(artifactPath);
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const expected = Buffer.from(`${evidence.canonicalText}\n`, "utf8");
    return fs.readFileSync(artifactPath).equals(expected);
    };
    if (!this.catalogStore) return contains();
    return this.catalogStore.read({
      read: (catalog) => {
        if (fs.existsSync(artifactPath)) catalog.resolve(artifact.relativePath);
        return contains();
      },
    });
  }

  write(evidence) {
    if (!(evidence instanceof ReviewEvidence)) throw new Error("ReviewEvidence is required");
    const bytes = Buffer.from(`${evidence.canonicalText}\n`, "utf8");
    if (bytes.length > MAX_REVIEW_EVIDENCE_BYTES) {
      throw reviewEvidenceError("REVIEW_EVIDENCE_TOO_LARGE", "canonical review evidence is too large");
    }
    const artifactPath = this.#artifactPath(evidence);
    const artifact = this.location === null ? null : this.#resolvedArtifact(evidence);
    this.ensureEvidenceDirectory(path.dirname(artifactPath));
    try {
      if (this.catalogStore) {
        this.catalogStore.publish({
          ...artifact.publication({
            updater: evidence.taskId == null ? REVIEW_NODE_ID_BY_PHASE[evidence.phase] : "task-review",
            mediaType: "application/json",
          }),
          publicationClaim: this.publicationClaim,
          write: () => fs.writeFileSync(artifactPath, bytes, { flag: "wx", mode: 0o600 }),
        });
      } else {
        fs.writeFileSync(artifactPath, bytes, { flag: "wx", mode: 0o600 });
      }
      return new ReviewEvidenceWrite({ path: artifactPath, created: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const existingStat = fs.lstatSync(artifactPath);
    if (!existingStat.isFile() || existingStat.isSymbolicLink()) {
      throw reviewEvidenceError(
        "REVIEW_EVIDENCE_PATH_INVALID",
        "canonical review evidence artifact must be a real regular file",
      );
    }
    const existing = fs.readFileSync(artifactPath);
    if (!existing.equals(bytes)) {
      throw reviewEvidenceError(
        "REVIEW_EVIDENCE_IMMUTABLE_CONFLICT",
        "canonical review evidence path already contains different bytes",
      );
    }
    return new ReviewEvidenceWrite({ path: artifactPath, created: false });
  }

  #artifactPath(evidence) {
    if (this.location === null) return path.join(this.evidenceDir, `${evidence.identity.evidenceDigest}.json`);
    return this.location.resolve(this.#resolvedArtifact(evidence).relativePath);
  }

  #resolvedArtifact(evidence) {
    return FLOW_ARTIFACT_CONTRACTS.reviewEvidence({
      ...(evidence.taskId == null ? { reviewStep: REVIEW_NODE_ID_BY_PHASE[evidence.phase] } : { taskId: evidence.taskId }),
      digest: evidence.identity.evidenceDigest,
    });
  }
}

export class ReviewEvidenceRegistration {
  constructor({ nextState, evidenceWrite, convergenceState }) {
    this.nextState = nextState;
    this.evidenceWrite = evidenceWrite;
    this.convergenceState = convergenceState;
    Object.freeze(this);
  }

  toCommandResult({ root, target, evidence }) {
    return {
      providerInvoked: false,
      phase: target.phase,
      taskId: target.taskId,
      treeSha: target.treeSha,
      evidenceDigest: evidence.identity.evidenceDigest,
      artifactPath: path.relative(root, this.evidenceWrite.path).split(path.sep).join("/"),
      reviewAction: resolveReviewPermittedOperation(this.convergenceState).toJSON(),
    };
  }

  applyTo(flowState) {
    for (const key of Object.keys(flowState)) delete flowState[key];
    Object.assign(flowState, structuredClone(this.nextState));
  }
}

export class ReviewEvidenceRegistrar {
  constructor({ store } = {}) {
    if (!(store instanceof ReviewEvidenceStore)) throw new Error("ReviewEvidenceStore is required");
    this.store = store;
    Object.freeze(this);
  }

  register({
    flowState,
    evidence,
    expectedRevision = flowState,
    configuredSemanticMaxAttempts = 1,
    targetStateDigest = null,
    targetState = null,
  } = {}) {
    if (!sameRevision(flowState, expectedRevision)) {
      throw reviewEvidenceError("REVIEW_STATE_REVISION_MISMATCH", "expected flow-state revision does not match");
    }
    if (!(evidence instanceof ReviewEvidence)) throw new Error("ReviewEvidence is required");
    const nextState = structuredClone(flowState);
    const convergenceState = applyReviewEvidenceTransition(nextState, evidence, {
      configuredSemanticMaxAttempts,
      targetStateDigest,
      targetState,
    });
    const evidenceWrite = this.store.write(evidence);
    return new ReviewEvidenceRegistration({ nextState, evidenceWrite, convergenceState });
  }
}
