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
} from "./review-convergence.js";

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function reviewEvidenceError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function resolveCurrentReviewTreeSha(root) {
  const result = runGit(["rev-parse", "HEAD^{tree}"], { cwd: root });
  if (!result.ok) {
    throw reviewEvidenceError(
      "REVIEW_TARGET_TREE_UNAVAILABLE",
      `failed to resolve current review target tree: ${result.stderr.trim()}`,
    );
  }
  return result.stdout.trim().toLowerCase();
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

  validateTarget({ phase, taskId = null, treeSha } = {}) {
    if (this.phase !== phase) throw new Error(`review evidence phase target mismatch: ${this.phase} != ${phase}`);
    if (this.taskId !== (taskId ?? null)) {
      throw new Error(`review evidence task target mismatch: ${this.taskId} != ${taskId ?? null}`);
    }
    if (this.treeSha !== treeSha) {
      throw new Error(`review evidence tree target mismatch: ${this.treeSha} != ${treeSha}`);
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
  constructor({ root, specDir } = {}) {
    this.root = fs.realpathSync(path.resolve(root));
    this.specDir = fs.realpathSync(path.resolve(specDir));
    if (!isInside(this.root, this.specDir)) {
      throw new Error("specDir must be inside root");
    }
    this.evidenceDir = path.join(this.specDir, "review-evidence");
    Object.freeze(this);
  }

  ensureEvidenceDirectory() {
    if (fs.existsSync(this.evidenceDir)) {
      const stat = fs.lstatSync(this.evidenceDir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw reviewEvidenceError(
          "REVIEW_EVIDENCE_PATH_INVALID",
          "canonical review evidence directory must be a real directory",
        );
      }
    } else {
      fs.mkdirSync(this.evidenceDir, { recursive: true });
    }
    if (!isInside(this.specDir, fs.realpathSync(this.evidenceDir))) {
      throw reviewEvidenceError(
        "REVIEW_EVIDENCE_PATH_OUTSIDE_SPEC",
        "canonical review evidence directory must stay inside the active spec directory",
      );
    }
  }

  write(evidence) {
    if (!(evidence instanceof ReviewEvidence)) throw new Error("ReviewEvidence is required");
    const bytes = Buffer.from(`${evidence.canonicalText}\n`, "utf8");
    if (bytes.length > MAX_REVIEW_EVIDENCE_BYTES) {
      throw reviewEvidenceError("REVIEW_EVIDENCE_TOO_LARGE", "canonical review evidence is too large");
    }
    this.ensureEvidenceDirectory();
    const artifactPath = path.join(this.evidenceDir, `${evidence.identity.evidenceDigest}.json`);
    try {
      fs.writeFileSync(artifactPath, bytes, { flag: "wx", mode: 0o600 });
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
