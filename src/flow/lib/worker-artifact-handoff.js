import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { AtomicFile } from "../../lib/atomic-file.js";
import { PRODUCT } from "../../lib/product.js";
import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { validateSpecJsonObject } from "../../lib/spec-json.js";
import {
  captureRegularFile,
  sameFileIdentity,
} from "../../lib/regular-file-snapshot.js";
import { DraftArtifactRevision } from "./draft-artifact-promotion.js";
import {
  DraftReviewArtifactFile,
  DraftReviewEvidenceSet,
} from "./draft-review-artifacts.js";
import { draftReviewRouteForStepId } from "./draft-review-routes.js";
import { findActiveNode, getFlowNode } from "../definition.js";
import { findStepById } from "./step-tree.js";
import {
  NormalStepTransition,
  StepTransitionCommitIntent,
} from "./step-transition-policy.js";
import { validateTestHeaders, formatValidationMessages } from "./test-headers.js";
import { SpecTestBootstrapValidator } from "./spec-test-bootstrap-validator.js";
import {
  validateSpecRepairDocument,
  validateSpecTriageDocument,
} from "./spec-review-artifacts.js";
import { WorkerArtifactRevision } from "./worker-artifact-revision.js";
import { requiresWorkerArtifactHandoff } from "./flow-artifact-authority.js";
import { PlanGateRepairRecord } from "./plan-gate-repair.js";
import {
  TestReviewRepairCompletion,
  TestReviewRepairRecord,
} from "./test-review-repair.js";
import { DraftWorkerContextSnapshot } from "./worker-context-snapshot.js";

export const WORKER_ARTIFACT_HANDOFF_REQUEST_ENV = PRODUCT.env("FLOW_HANDOFF_REQUEST");
export const WORKER_ARTIFACT_HANDOFF_VERSION = 2;
export const WORKER_ARTIFACT_HANDOFF_ROOT = PRODUCT.managedPath("handoffs");

const SHA256 = /^[a-f0-9]{64}$/;
const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MAX_PAYLOAD_FILES = 256;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_RELATIVE_PATH_BYTES = 500;
const MAX_AUTHORITY_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;
const MAX_AUTHORITY_DIRTY_PATHS = 20_000;
const MAX_AUTHORITY_FILE_BYTES = 64 * 1024 * 1024;
const MAX_AUTHORITY_TOTAL_FILE_BYTES = 256 * 1024 * 1024;
const WORKER_RUNTIME_DIRECTORIES = new Set(["agent-cache", "agent-work", "handoffs"]);
const AUTHORITY_ENTRY_KINDS = new Set(["missing", "symlink", "directory", "file", "other"]);
const SPEC_TEST_FILE = /\.(?:js|mjs|ts|json|md|ya?ml|txt|sh)$/;
const COMMAND_OWNED_SPEC_TEST_DIRECTORY = ".raw";

function requiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

function requiredDigest(value, field) {
  const digest = requiredString(value, field);
  if (!SHA256.test(digest)) throw new Error(`${field} must be a SHA-256 digest`);
  return digest;
}

function exactObjectKeys(value, keys, field) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${field} has an invalid schema`);
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function boundedJson(filePath, label) {
  const snapshot = readRegularFile(filePath, label, MAX_JSON_BYTES);
  try {
    return { document: JSON.parse(snapshot.bytes.toString("utf8")), snapshot };
  } catch (cause) {
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_INVALID",
      `${label} is malformed JSON: ${cause.message}`,
      { cause },
    );
  }
}

function readRegularFile(filePath, label, maxBytes = MAX_PAYLOAD_BYTES) {
  try {
    return captureRegularFile(filePath, { label, maxBytes });
  } catch (cause) {
    if (cause instanceof WorkerArtifactHandoffError) throw cause;
    throw new WorkerArtifactHandoffError(
      cause?.code === "ENOENT" ? "missing" : "invalid",
      cause?.code === "ENOENT"
        ? "FLOW_ARTIFACT_HANDOFF_MISSING"
        : "FLOW_ARTIFACT_HANDOFF_INVALID",
      `${label} is unavailable: ${cause.message}`,
      { cause },
    );
  }
}

function readOptionalSnapshot(filePath, label, maxBytes = MAX_PAYLOAD_BYTES) {
  try {
    return readRegularFile(filePath, label, maxBytes);
  } catch (error) {
    if (error.classification === "missing") return null;
    throw error;
  }
}

function normalizedRelativePath(value, field) {
  const relative = requiredString(value, field).replaceAll("\\", "/");
  if (
    Buffer.byteLength(relative) > MAX_RELATIVE_PATH_BYTES
    || path.posix.isAbsolute(relative)
    || path.posix.normalize(relative) !== relative
    || relative.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`${field} must be a normalized repository-relative path`);
  }
  return relative;
}

function isWithin(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== ""
    && relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

function ensureRealDirectory(directory, boundary) {
  const resolved = path.resolve(directory);
  const stop = path.resolve(boundary);
  try {
    if (resolved !== stop && !isWithin(stop, resolved)) {
      throw new Error(`directory escapes its authority boundary: ${resolved}`);
    }

    const missing = [];
    let current = resolved;
    while (true) {
      let stat;
      try {
        stat = fs.lstatSync(current);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        if (current === stop) throw new Error(`directory authority boundary is missing: ${stop}`);
        missing.push(current);
        current = path.dirname(current);
        continue;
      }
      if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(current) !== current) {
        throw new Error(`directory authority must be a real directory: ${current}`);
      }
      if (current === stop) break;
      current = path.dirname(current);
    }

    for (const missingDirectory of missing.reverse()) {
      fs.mkdirSync(missingDirectory);
      const stat = fs.lstatSync(missingDirectory);
      if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(missingDirectory) !== missingDirectory) {
        throw new Error(`directory authority must be a real directory: ${missingDirectory}`);
      }
    }
    return resolved;
  } catch (cause) {
    if (cause instanceof WorkerArtifactHandoffError) throw cause;
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_INVALID",
      `worker artifact directory authority is invalid: ${cause.message}`,
      { cause, data: { directory: resolved, boundary: stop } },
    );
  }
}

function removeEmptyParents(directory, stop) {
  let current = path.resolve(directory);
  const boundary = path.resolve(stop);
  while (current !== boundary && isWithin(boundary, current)) {
    try {
      fs.rmdirSync(current);
    } catch (error) {
      if (["ENOTEMPTY", "ENOENT"].includes(error.code)) return;
      throw error;
    }
    current = path.dirname(current);
  }
}

export class WorkerArtifactHandoffError extends Error {
  constructor(classification, code, message, { cause = null, data = {}, retryable = false } = {}) {
    if (!["missing", "invalid", "stale", "conflict", "recovery-required"].includes(classification)) {
      throw new Error(`invalid worker artifact handoff classification: ${classification}`);
    }
    if (typeof retryable !== "boolean") throw new Error("worker artifact handoff retryable must be boolean");
    super(message, cause ? { cause } : undefined);
    this.name = "WorkerArtifactHandoffError";
    this.classification = classification;
    this.code = requiredString(code, "worker artifact handoff error code");
    this.recoveryPossible = classification === "recovery-required";
    this.retryable = retryable;
    this.data = Object.freeze({ ...data });
  }
}

/**
 * The worker produced an invalid payload twice. The parent must stop before
 * creating a publication journal; the canonical artifact and Flow step remain
 * untouched so a later operator retry starts from the same authority.
 */
export class WorkerArtifactRetryExhaustedError extends WorkerArtifactHandoffError {
  constructor({ firstError, secondError, firstRequest, secondRequest }) {
    if (!(firstError instanceof WorkerArtifactHandoffError)) {
      throw new Error("worker artifact retry exhaustion requires the first handoff error");
    }
    if (!(secondError instanceof WorkerArtifactHandoffError)) {
      throw new Error("worker artifact retry exhaustion requires the second handoff error");
    }
    const summarize = (error, request) => ({
      code: error.code,
      classification: error.classification,
      message: error.message,
      handoffDirectory: request?.directory || error.data?.handoffDirectory || null,
      actionDigest: request?.actionDigest || error.data?.actionDigest || null,
      dispatchInvocationId: request?.dispatchInvocationId || error.data?.dispatchInvocationId || null,
    });
    super(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_RETRY_EXHAUSTED",
      "worker artifact handoff remained invalid after one fresh retry",
      {
        cause: secondError,
        retryable: false,
        data: {
          retryExhausted: true,
          attempts: 2,
          first: summarize(firstError, firstRequest),
          second: summarize(secondError, secondRequest),
        },
      },
    );
    this.name = "WorkerArtifactRetryExhaustedError";
  }
}

export class WorkerArtifactPayloadRule {
  constructor({ logicalName, kind = "file", targetRelativePath, required = true }) {
    this.logicalName = requiredString(logicalName, "worker artifact payload logicalName");
    if (!new Set(["file", "tree"]).has(kind)) throw new Error(`invalid payload kind: ${kind}`);
    this.kind = kind;
    this.targetRelativePath = normalizedRelativePath(
      targetRelativePath,
      `${this.logicalName}.targetRelativePath`,
    );
    this.required = required === true;
    Object.freeze(this);
  }
}

export class WorkerArtifactInputContract {
  constructor({ stepId, inputs, repairInputs = {}, testReviewRepairInputs = [] }) {
    this.stepId = requiredString(stepId, "worker artifact input contract stepId");
    this.inputs = Object.freeze(
      inputs.map((entry) => normalizedRelativePath(entry, `${this.stepId}.input`)),
    );
    const variants = {};
    for (const [phase, entries] of Object.entries(repairInputs)) {
      if (!new Set(["draft", "spec", "test"]).has(phase)) {
        throw new Error(`invalid plan-gate repair input phase for ${this.stepId}: ${phase}`);
      }
      const paths = Object.freeze(
        entries.map((entry) => normalizedRelativePath(entry, `${this.stepId}.${phase}.input`)),
      );
      variants[phase] = paths;
    }
    this.repairInputs = Object.freeze(variants);
    this.testReviewRepairInputs = Object.freeze(testReviewRepairInputs.map((entry) => (
      normalizedRelativePath(entry, `${this.stepId}.testReviewRepair.input`)
    )));
    if (this.testReviewRepairInputs.length > 0 && this.stepId !== "test") {
      throw new Error("test-review repair inputs may only belong to the test handoff");
    }
    this.allowedSignatures = Object.freeze([
      this.inputs,
      ...Object.values(variants),
      ...(this.testReviewRepairInputs.length > 0 ? [this.testReviewRepairInputs] : []),
    ].map((paths) => paths.join("\u0000")));
    if (new Set(this.allowedSignatures).size !== this.allowedSignatures.length) {
      throw new Error(`duplicate worker artifact input contract for ${this.stepId}`);
    }
    Object.freeze(this);
  }

  resolve(state) {
    const testReviewRepair = TestReviewRepairRecord.forTarget(state, this.stepId);
    if (testReviewRepair) return this.testReviewRepairInputs;
    const repair = PlanGateRepairRecord.forTarget(state, this.stepId);
    return repair ? (this.repairInputs[repair.phase] || this.inputs) : this.inputs;
  }

  accepts(paths) {
    const signature = paths.map((entry) => normalizedRelativePath(
      entry,
      `${this.stepId}.request.input`,
    )).join("\u0000");
    return this.allowedSignatures.includes(signature);
  }
}

export class WorkerArtifactHandoffPolicy {
  constructor({
    stepId,
    inputs,
    repairInputs = {},
    testReviewRepairInputs = [],
    payloads,
    revisionKind = null,
  }) {
    this.stepId = requiredString(stepId, "worker artifact policy stepId");
    if (!requiresWorkerArtifactHandoff(this.stepId)) {
      throw new Error(`worker artifact policy is not declared by the authority matrix: ${this.stepId}`);
    }
    this.inputContract = new WorkerArtifactInputContract({
      stepId: this.stepId,
      inputs,
      repairInputs,
      testReviewRepairInputs,
    });
    this.inputs = this.inputContract.inputs;
    this.payloads = Object.freeze(payloads.map((entry) => (
      entry instanceof WorkerArtifactPayloadRule ? entry : new WorkerArtifactPayloadRule(entry)
    )));
    if (new Set(this.payloads.map((entry) => entry.logicalName)).size !== this.payloads.length) {
      throw new Error(`duplicate worker artifact payload for ${this.stepId}`);
    }
    if (revisionKind != null && !["draft", "spec", "test"].includes(revisionKind)) {
      throw new Error(`invalid worker artifact revision kind: ${revisionKind}`);
    }
    this.revisionKind = revisionKind;
    Object.freeze(this);
  }
}

const POLICIES = Object.freeze([
  new WorkerArtifactHandoffPolicy({
    stepId: "draft",
    inputs: [],
    payloads: [{ logicalName: "draft.json", targetRelativePath: "draft.json" }],
    revisionKind: "draft",
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "draft-questions-triage",
    inputs: ["draft.json", "draft-review-questions.json"],
    payloads: [{ logicalName: "draft-questions-triage.json", targetRelativePath: "draft-questions-triage.json" }],
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "draft-questions-repair",
    inputs: ["draft.json", "draft-review-questions.json", "draft-questions-triage.json"],
    payloads: [
      { logicalName: "draft-questions-repair.json", targetRelativePath: "draft-questions-repair.json" },
      { logicalName: "draft.json", targetRelativePath: "draft.json" },
    ],
    revisionKind: "draft",
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "draft-refine",
    inputs: ["draft.json"],
    payloads: [{ logicalName: "draft.json", targetRelativePath: "draft.json" }],
    revisionKind: "draft",
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "draft-coverage-triage",
    inputs: ["draft.json", "draft-review-coverage.json"],
    payloads: [{ logicalName: "draft-coverage-triage.json", targetRelativePath: "draft-coverage-triage.json" }],
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "draft-coverage-repair",
    inputs: ["draft.json", "draft-review-coverage.json", "draft-coverage-triage.json"],
    payloads: [
      { logicalName: "draft-coverage-repair.json", targetRelativePath: "draft-coverage-repair.json" },
      { logicalName: "draft.json", targetRelativePath: "draft.json" },
    ],
    revisionKind: "draft",
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "spec",
    inputs: ["draft.json"],
    repairInputs: { spec: ["draft.json", "spec.json"] },
    payloads: [{ logicalName: "spec.json", targetRelativePath: "spec.json" }],
    revisionKind: "spec",
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "spec-triage",
    inputs: ["spec.json", "spec-review.json"],
    payloads: [{ logicalName: "spec-triage.json", targetRelativePath: "spec-triage.json" }],
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "spec-repair",
    inputs: ["spec.json", "spec-review.json", "spec-triage.json"],
    payloads: [
      { logicalName: "spec-repair.json", targetRelativePath: "spec-repair.json" },
      { logicalName: "spec.json", targetRelativePath: "spec.json" },
    ],
    revisionKind: "spec",
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "test",
    inputs: ["spec.json"],
    repairInputs: { test: ["spec.json", "scenario-validity-result.json"] },
    testReviewRepairInputs: ["spec.json", "test-review.json"],
    payloads: [{ logicalName: "spec-tests", kind: "tree", targetRelativePath: "tests" }],
    revisionKind: "test",
  }),
]);

const POLICY_BY_STEP = new Map(POLICIES.map((policy) => [policy.stepId, policy]));

export function workerArtifactHandoffPolicy(stepId) {
  return POLICY_BY_STEP.get(stepId) || null;
}

export class WorkerArtifactInputSnapshot {
  constructor({ name, targetRelativePath, snapshot, document }) {
    this.name = requiredString(name, "worker artifact input name");
    this.targetRelativePath = normalizedRelativePath(targetRelativePath, `${this.name}.targetRelativePath`);
    this.digest = requiredDigest(snapshot.digest, `${this.name}.digest`);
    if (!Number.isSafeInteger(snapshot.byteLength) || snapshot.byteLength < 0 || snapshot.byteLength > MAX_INPUT_BYTES) {
      throw new Error(`${this.name}.byteLength is invalid`);
    }
    this.byteLength = snapshot.byteLength;
    if (document == null || typeof document !== "object" || Array.isArray(document)) {
      throw new Error(`${this.name}.document must be a JSON object`);
    }
    this.document = Object.freeze(structuredClone(document));
    Object.freeze(this);
  }

  toJSON() {
    return {
      name: this.name,
      targetRelativePath: this.targetRelativePath,
      digest: this.digest,
      byteLength: this.byteLength,
      document: structuredClone(this.document),
    };
  }
}

function scanTree(directory, {
  allowMissing = false,
  label = "payload tree",
  directories = null,
  commandOwnedEvidence = "reject",
} = {}) {
  if (!["reject", "exclude"].includes(commandOwnedEvidence)) {
    throw new Error(`invalid command-owned spec-test evidence policy: ${commandOwnedEvidence}`);
  }
  const root = path.resolve(directory);
  if (!fs.existsSync(root)) {
    if (allowMissing) return [];
    throw new WorkerArtifactHandoffError(
      "missing",
      "FLOW_ARTIFACT_HANDOFF_MISSING",
      `${label} is missing: ${root}`,
    );
  }
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || fs.realpathSync(root) !== root) {
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_INVALID",
      `${label} must be a regular real directory: ${root}`,
    );
  }
  const files = [];
  function walk(directoryPath) {
    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
      const filePath = path.join(directoryPath, entry.name);
      const stat = fs.lstatSync(filePath);
      if (entry.isSymbolicLink() || stat.isSymbolicLink()) {
        throw new WorkerArtifactHandoffError(
          "invalid",
          "FLOW_ARTIFACT_HANDOFF_INVALID",
          `${label} contains a symlink: ${filePath}`,
        );
      }
      if (entry.isDirectory()) {
        if (fs.realpathSync(filePath) !== filePath) {
          throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", `${label} directory is not real: ${filePath}`);
        }
        const relativeDirectory = path.relative(root, filePath).split(path.sep).join("/");
        if (relativeDirectory === COMMAND_OWNED_SPEC_TEST_DIRECTORY) {
          if (commandOwnedEvidence === "exclude") continue;
          throw new WorkerArtifactHandoffError(
            "invalid",
            "FLOW_ARTIFACT_HANDOFF_INVALID",
            `${label} contains the command-owned ${COMMAND_OWNED_SPEC_TEST_DIRECTORY} evidence directory`,
          );
        }
        if (directories) {
          directories.push(relativeDirectory);
        }
        walk(filePath);
        continue;
      }
      if (!entry.isFile() || !stat.isFile()) {
        throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", `${label} contains a non-file entry: ${filePath}`);
      }
      const relativePath = path.relative(root, filePath).split(path.sep).join("/");
      normalizedRelativePath(relativePath, `${label} relative path`);
      if (!SPEC_TEST_FILE.test(relativePath)) {
        throw new WorkerArtifactHandoffError(
          "invalid",
          "FLOW_ARTIFACT_HANDOFF_INVALID",
          `${label} contains an unsupported file: ${relativePath}`,
        );
      }
      files.push({ relativePath, snapshot: readRegularFile(filePath, `${label} ${relativePath}`) });
      if (files.length > MAX_PAYLOAD_FILES) {
        throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", `${label} exceeds ${MAX_PAYLOAD_FILES} files`);
      }
    }
  }
  walk(root);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function parentRelativePaths(relativePath) {
  const parents = [];
  let current = path.posix.dirname(relativePath);
  while (current !== ".") {
    parents.push(current);
    current = path.posix.dirname(current);
  }
  return parents;
}

function isCommandOwnedSpecTestTarget(relativePath) {
  const reserved = `tests/${COMMAND_OWNED_SPEC_TEST_DIRECTORY}`;
  return relativePath === reserved || relativePath.startsWith(`${reserved}/`);
}

function assertPayloadDirectoryMatchesManifest(request, manifest, label) {
  const declaredFiles = new Set();
  const allowedDirectories = new Set();
  for (const { rule } of request.payloads) {
    if (rule.kind === "tree") {
      allowedDirectories.add(rule.targetRelativePath);
      for (const parent of parentRelativePaths(rule.targetRelativePath)) {
        allowedDirectories.add(parent);
      }
    }
  }
  for (const entry of manifest) {
    if (declaredFiles.has(entry.relativePath)) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_ARTIFACT_HANDOFF_INVALID",
        `${label} declares one payload file more than once: ${entry.relativePath}`,
      );
    }
    declaredFiles.add(entry.relativePath);
    for (const parent of parentRelativePaths(entry.relativePath)) {
      allowedDirectories.add(parent);
    }
  }

  const actualDirectories = [];
  const actualFiles = scanTree(request.payloadDirectory, {
    label: `${label} directory`,
    directories: actualDirectories,
  });
  for (const directory of actualDirectories) {
    if (!allowedDirectories.has(directory)) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_ARTIFACT_HANDOFF_INVALID",
        `${label} contains an unknown payload directory: ${directory}`,
      );
    }
  }
  for (const { relativePath } of actualFiles) {
    if (!declaredFiles.has(relativePath)) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_ARTIFACT_HANDOFF_INVALID",
        `${label} contains an unknown payload file: ${relativePath}`,
      );
    }
  }
  for (const relativePath of declaredFiles) {
    if (!actualFiles.some((entry) => entry.relativePath === relativePath)) {
      throw new WorkerArtifactHandoffError(
        "missing",
        "FLOW_ARTIFACT_HANDOFF_MISSING",
        `${label} manifest file is missing: ${relativePath}`,
      );
    }
  }
}

function manifestDigest(entries) {
  return digest(stableStringify(entries.map((entry) => ({
    logicalName: entry.logicalName,
    targetRelativePath: entry.targetRelativePath,
    digest: entry.digest,
    byteLength: entry.byteLength,
  }))));
}

function treeSnapshot(directory) {
  const entries = scanTree(directory, {
    allowMissing: true,
    label: "canonical spec-test tree",
    commandOwnedEvidence: "exclude",
  })
    .map(({ relativePath, snapshot }) => ({
      targetRelativePath: path.posix.join("tests", relativePath),
      digest: snapshot.digest,
      byteLength: snapshot.byteLength,
    }));
  return Object.freeze({
    entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
    digest: digest(stableStringify(entries)),
    byteLength: entries.reduce((sum, entry) => sum + entry.byteLength, 0),
  });
}

function specDirectory(mainRoot, state) {
  return path.dirname(path.resolve(mainRoot, relativeFlowSpecFile(state)));
}

function handoffActionDirectory(executionRoot, runId, dispatchInvocationId, actionDigest) {
  return path.resolve(
    executionRoot,
    WORKER_ARTIFACT_HANDOFF_ROOT,
    digest(runId).slice(0, 24),
    digest(dispatchInvocationId).slice(0, 24),
    actionDigest,
  );
}

function authoritySnapshotError(message, cause = null, data = {}) {
  return new WorkerArtifactHandoffError(
    "invalid",
    "FLOW_ARTIFACT_HANDOFF_AUTHORITY_UNAVAILABLE",
    message,
    { cause, data },
  );
}

function isWorkerRuntimePath(relativePath) {
  const segments = relativePath.split("/");
  if (segments.includes(".git") || segments.includes(".tmp")) return true;
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (
      segments[index] === PRODUCT.managedDirName
      && WORKER_RUNTIME_DIRECTORIES.has(segments[index + 1])
    ) return true;
  }
  return false;
}

function boundedGitOutput(root, args, label) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "buffer",
      maxBuffer: MAX_AUTHORITY_GIT_OUTPUT_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (cause) {
    throw authoritySnapshotError(
      `worker artifact authority could not read ${label}: ${cause.message}`,
      cause,
      { root: path.resolve(root), label },
    );
  }
}

function exactGitRoot(root) {
  try {
    const output = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return fs.realpathSync(output) === fs.realpathSync(root);
  } catch {
    return false;
  }
}

function nullSeparatedPaths(bytes, label) {
  const paths = bytes.toString("utf8").split("\u0000").filter(Boolean);
  if (paths.length > MAX_AUTHORITY_DIRTY_PATHS) {
    throw authoritySnapshotError(
      `worker artifact authority ${label} exceeds ${MAX_AUTHORITY_DIRTY_PATHS} paths`,
    );
  }
  return paths;
}

class WorkerArtifactRepositoryEntry {
  constructor({ path: relativePath, kind, mode, digest: contentDigest }) {
    if (typeof relativePath !== "string" || relativePath === "") {
      throw new Error("worker artifact repository entry path is required");
    }
    this.path = relativePath;
    if (!AUTHORITY_ENTRY_KINDS.has(kind)) {
      throw new Error(`invalid worker artifact repository entry kind: ${kind}`);
    }
    this.kind = kind;
    if (mode != null && (!Number.isSafeInteger(mode) || mode < 0)) {
      throw new Error("worker artifact repository entry mode is invalid");
    }
    this.mode = mode;
    this.digest = contentDigest == null
      ? null
      : requiredDigest(contentDigest, "worker artifact repository entry digest");
    Object.freeze(this);
  }

  toJSON() {
    return { path: this.path, kind: this.kind, mode: this.mode, digest: this.digest };
  }
}

function digestAuthorityFile(filePath, visible, relativePath, budget) {
  let descriptor = null;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || !sameFileIdentity(visible, opened)) {
      throw new Error("file identity changed while opening");
    }
    if (opened.size > MAX_AUTHORITY_FILE_BYTES) {
      throw new Error(`file exceeds ${MAX_AUTHORITY_FILE_BYTES} bytes`);
    }
    const hash = crypto.createHash("sha256");
    const chunk = Buffer.allocUnsafe(64 * 1024);
    let fileBytes = 0;
    while (true) {
      const bytesRead = fs.readSync(descriptor, chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      fileBytes += bytesRead;
      if (fileBytes > MAX_AUTHORITY_FILE_BYTES) {
        throw new Error(`file exceeds ${MAX_AUTHORITY_FILE_BYTES} bytes while reading`);
      }
      budget.bytes += bytesRead;
      if (budget.bytes > MAX_AUTHORITY_TOTAL_FILE_BYTES) {
        throw new Error(`dirty content exceeds ${MAX_AUTHORITY_TOTAL_FILE_BYTES} bytes`);
      }
      hash.update(chunk.subarray(0, bytesRead));
    }
    const completed = fs.fstatSync(descriptor);
    if (!sameFileIdentity(opened, completed) || completed.size !== fileBytes) {
      throw new Error("file identity changed while reading");
    }
    return hash.digest("hex");
  } catch (cause) {
    throw authoritySnapshotError(
      `worker artifact authority could not fingerprint ${relativePath}: ${cause.message}`,
      cause,
      { path: relativePath },
    );
  } finally {
    if (descriptor != null) fs.closeSync(descriptor);
  }
}

function authorityFileEntry(root, relativePath, budget) {
  const normalized = relativePath.split(path.sep).join("/");
  if (
    path.posix.isAbsolute(normalized)
    || path.posix.normalize(normalized) !== normalized
    || normalized === "."
    || normalized.startsWith("../")
  ) {
    throw authoritySnapshotError(`worker artifact authority path is invalid: ${relativePath}`);
  }
  const filePath = path.resolve(root, ...normalized.split("/"));
  if (!isWithin(root, filePath)) {
    throw authoritySnapshotError(`worker artifact authority path escapes its repository: ${relativePath}`);
  }
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch (cause) {
    if (cause.code === "ENOENT") {
      return new WorkerArtifactRepositoryEntry({
        path: normalized,
        kind: "missing",
        mode: null,
        digest: null,
      });
    }
    throw authoritySnapshotError(
      `worker artifact authority could not inspect ${normalized}: ${cause.message}`,
      cause,
    );
  }
  const mode = stat.mode & 0o7777;
  if (stat.isSymbolicLink()) {
    return new WorkerArtifactRepositoryEntry({
      path: normalized,
      kind: "symlink",
      mode,
      digest: digest(fs.readlinkSync(filePath)),
    });
  }
  if (stat.isDirectory()) {
    return new WorkerArtifactRepositoryEntry({
      path: normalized,
      kind: "directory",
      mode,
      digest: null,
    });
  }
  if (!stat.isFile()) {
    return new WorkerArtifactRepositoryEntry({
      path: normalized,
      kind: "other",
      mode,
      digest: null,
    });
  }
  return new WorkerArtifactRepositoryEntry({
    path: normalized,
    kind: "file",
    mode,
    digest: digestAuthorityFile(filePath, stat, normalized, budget),
  });
}

function filteredIndexDigest(bytes) {
  const hash = crypto.createHash("sha256");
  for (const record of bytes.toString("utf8").split("\u0000").filter(Boolean)) {
    const separator = record.indexOf("\t");
    if (separator === -1) {
      throw authoritySnapshotError("worker artifact authority received malformed Git index data");
    }
    const relativePath = record.slice(separator + 1);
    if (!isWorkerRuntimePath(relativePath)) hash.update(record).update("\u0000");
  }
  return hash.digest("hex");
}

function gitAuthoritySnapshot(root) {
  const head = boundedGitOutput(root, ["rev-parse", "HEAD"], "Git HEAD").toString("utf8").trim();
  const indexDigest = filteredIndexDigest(
    boundedGitOutput(root, ["ls-files", "--stage", "-z"], "Git index"),
  );
  const tracked = nullSeparatedPaths(
    boundedGitOutput(
      root,
      ["diff", "--name-only", "-z", "--no-renames", "HEAD", "--"],
      "changed paths",
    ),
    "changed path set",
  );
  const untracked = nullSeparatedPaths(
    boundedGitOutput(
      root,
      ["ls-files", "--others", "--exclude-standard", "-z"],
      "untracked paths",
    ),
    "untracked path set",
  );
  const paths = [...new Set([...tracked, ...untracked])]
    .filter((relativePath) => !isWorkerRuntimePath(relativePath))
    .sort((left, right) => left.localeCompare(right));
  if (paths.length > MAX_AUTHORITY_DIRTY_PATHS) {
    throw authoritySnapshotError(
      `worker artifact authority exceeds ${MAX_AUTHORITY_DIRTY_PATHS} changed paths`,
    );
  }
  const budget = { bytes: 0 };
  return {
    mode: "git",
    head,
    indexDigest,
    entries: paths.map((relativePath) => authorityFileEntry(root, relativePath, budget)),
  };
}

function filesystemAuthoritySnapshot(root) {
  const relativePaths = [];
  const directories = [path.resolve(root)];
  while (directories.length > 0) {
    const directoryPath = directories.pop();
    const handle = fs.opendirSync(directoryPath);
    try {
      let entry;
      while ((entry = handle.readSync()) != null) {
        const absolutePath = path.join(directoryPath, entry.name);
        const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
        if (isWorkerRuntimePath(relativePath)) continue;
        relativePaths.push(relativePath);
        if (relativePaths.length > MAX_AUTHORITY_DIRTY_PATHS) {
          throw authoritySnapshotError(
            `non-Git worker artifact authority exceeds ${MAX_AUTHORITY_DIRTY_PATHS} paths`,
          );
        }
        if (entry.isDirectory()) directories.push(absolutePath);
      }
    } finally {
      handle.closeSync();
    }
  }
  const budget = { bytes: 0 };
  return {
    mode: "filesystem",
    head: null,
    indexDigest: null,
    entries: relativePaths
      .sort((left, right) => left.localeCompare(right))
      .map((relativePath) => authorityFileEntry(root, relativePath, budget)),
  };
}

export class WorkerArtifactRepositoryMutationSnapshot {
  constructor({ root, authorities, mode, head, indexDigest, entries }) {
    this.root = path.resolve(root);
    this.authorities = Object.freeze(authorities.map((entry) => requiredString(
      entry,
      "worker artifact repository authority",
    )));
    if (!new Set(["git", "filesystem"]).has(mode)) {
      throw new Error(`invalid worker artifact repository snapshot mode: ${mode}`);
    }
    this.mode = mode;
    this.head = head;
    this.indexDigest = indexDigest;
    this.entries = Object.freeze(entries.map((entry) => (
      entry instanceof WorkerArtifactRepositoryEntry
        ? entry
        : new WorkerArtifactRepositoryEntry(entry)
    )));
    this.digest = digest(stableStringify({
      mode,
      head,
      indexDigest,
      entries: this.entries.map((entry) => entry.toJSON()),
    }));
    Object.freeze(this);
  }

  static capture({ root, authorities }) {
    try {
      const snapshot = exactGitRoot(root)
        ? gitAuthoritySnapshot(root)
        : filesystemAuthoritySnapshot(root);
      return new WorkerArtifactRepositoryMutationSnapshot({ root, authorities, ...snapshot });
    } catch (cause) {
      if (cause instanceof WorkerArtifactHandoffError) throw cause;
      throw authoritySnapshotError(
        `worker artifact repository authority could not be captured: ${cause.message}`,
        cause,
        { root: path.resolve(root) },
      );
    }
  }

  changedPaths(current) {
    const changed = [];
    if (this.head !== current.head) changed.push("<HEAD>");
    if (this.indexDigest !== current.indexDigest) changed.push("<index>");
    const before = new Map(this.entries.map((entry) => [entry.path, stableStringify(entry.toJSON())]));
    const after = new Map(current.entries.map((entry) => [entry.path, stableStringify(entry.toJSON())]));
    for (const relativePath of new Set([...before.keys(), ...after.keys()])) {
      if (before.get(relativePath) !== after.get(relativePath)) changed.push(relativePath);
    }
    return changed.slice(0, 20);
  }
}

export class WorkerArtifactMutationAuthoritySnapshot {
  constructor({ specId, repositories }) {
    this.specId = requiredString(specId, "worker artifact mutation authority specId");
    this.repositories = Object.freeze(repositories);
    Object.freeze(this);
  }

  static capture(request) {
    if (!(request instanceof WorkerArtifactHandoffRequest)) {
      throw new Error("worker mutation authority requires a handoff request");
    }
    const roots = new Map();
    try {
      for (const [authority, root] of [
        ["execution", request.executionRoot],
        ["canonical", request.mainRoot],
      ]) {
        const resolved = fs.realpathSync(path.resolve(root));
        const existing = roots.get(resolved) || [];
        existing.push(authority);
        roots.set(resolved, existing);
      }
    } catch (cause) {
      throw authoritySnapshotError(
        `worker artifact repository authority root is unavailable: ${cause.message}`,
        cause,
      );
    }
    return new WorkerArtifactMutationAuthoritySnapshot({
      specId: request.specId,
      repositories: [...roots].map(([root, authorities]) => (
        WorkerArtifactRepositoryMutationSnapshot.capture({ root, authorities })
      )),
    });
  }

  assertUnchanged() {
    for (const captured of this.repositories) {
      const current = WorkerArtifactRepositoryMutationSnapshot.capture({
        root: captured.root,
        authorities: captured.authorities,
      });
      if (current.digest === captured.digest) continue;
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION",
        "repository content changed outside the worker's dedicated handoff payload authority",
        {
          data: {
            specId: this.specId,
            authorities: captured.authorities,
            changedPaths: captured.changedPaths(current),
          },
        },
      );
    }
  }
}

function baseInputRevision(state, policy, inputDigest) {
  if (policy.revisionKind === "draft" && SHA256.test(state?.draftArtifactRevision?.digest || "")) {
    return state.draftArtifactRevision.digest;
  }
  if (["spec", "test"].includes(policy.revisionKind) && SHA256.test(state?.specArtifactRevision?.digest || "")) {
    return state.specArtifactRevision.digest;
  }
  return inputDigest;
}

function inputRevision(state, policy, inputDigest) {
  const baseRevision = baseInputRevision(state, policy, inputDigest);
  const testReviewRepair = TestReviewRepairRecord.forTarget(state, policy.stepId);
  if (testReviewRepair) {
    return digest(stableStringify({
      baseRevision,
      testReviewRepair: testReviewRepair.toJSON(),
    }));
  }
  const repair = PlanGateRepairRecord.forTarget(state, policy.stepId);
  if (!repair) return baseRevision;
  return digest(stableStringify({
    baseRevision,
    planGateRepair: repair.toJSON(),
  }));
}

function requiresDraftWorkerContext(policy) {
  const kinds = getFlowNode(policy.stepId)?.contextKinds || [];
  return ["issue", "guardrail", "project_overview"].every((kind) => kinds.includes(kind));
}

function handoffInputDigest(inputs, contextSnapshot) {
  return digest(stableStringify({
    artifacts: inputs.map((input) => ({
      path: input.targetRelativePath,
      digest: input.digest,
      byteLength: input.byteLength,
    })),
    context: contextSnapshot?.digest ?? null,
  }));
}

export class WorkerArtifactHandoffRequest {
  constructor({
    mainRoot,
    executionRoot,
    state,
    invocation,
    policy,
    inputs,
    contextSnapshot,
    payloads,
    inputDigest,
    inputRevision: revision,
    generatedAt,
  }) {
    this.mainRoot = path.resolve(mainRoot);
    this.executionRoot = path.resolve(executionRoot);
    this.state = state;
    this.policy = policy;
    this.version = WORKER_ARTIFACT_HANDOFF_VERSION;
    this.runId = requiredString(state.runId, "handoff runId");
    this.specId = requiredString(state.specId, "handoff specId");
    this.issue = state.issue ?? null;
    this.stepId = policy.stepId;
    this.actionDigest = requiredDigest(invocation.action.digest, "handoff actionDigest");
    this.dispatchInvocationId = requiredString(invocation.id, "handoff dispatchInvocationId");
    this.targetAuthority = "canonical-flow-artifacts";
    this.inputDigest = requiredDigest(inputDigest, "handoff inputDigest");
    this.inputRevision = requiredDigest(revision, "handoff inputRevision");
    this.inputs = Object.freeze(inputs);
    if (contextSnapshot != null && !(contextSnapshot instanceof DraftWorkerContextSnapshot)) {
      throw new Error("handoff contextSnapshot must be a DraftWorkerContextSnapshot or null");
    }
    if (requiresDraftWorkerContext(policy) !== (contextSnapshot != null)) {
      throw new Error("handoff context snapshot does not match its step context contract");
    }
    contextSnapshot?.assertBinding({
      runId: this.runId,
      specId: this.specId,
      issue: this.issue,
      dispatchInvocationId: this.dispatchInvocationId,
      actionDigest: this.actionDigest,
      targetDigest: invocation.target?.digest ?? contextSnapshot.binding.targetDigest,
    });
    this.contextSnapshot = contextSnapshot;
    this.payloads = Object.freeze(payloads);
    this.generatedAt = requiredString(generatedAt, "handoff generatedAt");
    const actionDirectory = handoffActionDirectory(
      this.executionRoot,
      this.runId,
      this.dispatchInvocationId,
      this.actionDigest,
    );
    this.directory = path.resolve(actionDirectory);
    this.payloadDirectory = path.join(this.directory, "payload");
    this.requestPath = path.join(this.directory, "request.json");
    this.submissionPath = path.join(this.directory, "handoff.json");
    if (!isWithin(this.executionRoot, this.directory)) throw new Error("handoff directory escapes execution root");
    Object.freeze(this);
  }

  static create({ mainRoot, executionRoot, state, invocation, now = () => new Date() }) {
    const policy = workerArtifactHandoffPolicy(invocation?.action?.nextAction?.step);
    if (!policy) return null;
    const specDir = specDirectory(mainRoot, state);
    const inputs = policy.inputContract.resolve(state).map((relativePath) => {
      const { document, snapshot } = boundedJson(
        path.join(specDir, relativePath),
        `canonical handoff input ${relativePath}`,
      );
      if (snapshot.byteLength > MAX_INPUT_BYTES) {
        throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", `canonical handoff input ${relativePath} is oversized`);
      }
      return new WorkerArtifactInputSnapshot({
        name: path.posix.basename(relativePath),
        targetRelativePath: relativePath,
        snapshot,
        document,
      });
    });
    let contextSnapshot = null;
    if (requiresDraftWorkerContext(policy)) {
      try {
        contextSnapshot = DraftWorkerContextSnapshot.materialize({
          specDirectory: specDir,
          executionRoot,
          state,
          invocation,
        });
      } catch (cause) {
        throw new WorkerArtifactHandoffError(
          "invalid",
          "FLOW_ARTIFACT_HANDOFF_CONTEXT_INVALID",
          `draft worker context could not be materialized: ${cause.message}`,
          { cause },
        );
      }
    }
    const inputDigestValue = handoffInputDigest(inputs, contextSnapshot);
    const payloads = policy.payloads.map((rule) => {
      const canonicalPath = path.join(specDir, ...rule.targetRelativePath.split("/"));
      const baseline = rule.kind === "tree"
        ? treeSnapshot(canonicalPath)
        : readOptionalSnapshot(canonicalPath, `canonical target ${rule.targetRelativePath}`);
      return Object.freeze({
        rule,
        baselineDigest: baseline?.digest ?? null,
        baselineByteLength: baseline?.byteLength ?? 0,
        baselineEntries: baseline?.entries ?? null,
      });
    });
    return new WorkerArtifactHandoffRequest({
      mainRoot,
      executionRoot,
      state,
      invocation,
      policy,
      inputs,
      contextSnapshot,
      payloads,
      inputDigest: inputDigestValue,
      inputRevision: inputRevision(state, policy, inputDigestValue),
      generatedAt: now().toISOString(),
    });
  }

  static restore({ mainRoot, state, journal }) {
    if (!(journal instanceof WorkerArtifactPublicationJournal)) {
      throw new Error("restoring a worker artifact handoff requires a publication journal");
    }
    const stored = requestFromStored(path.join(journal.handoffDirectory, "request.json"));
    const policy = workerArtifactHandoffPolicy(stored.stepId);
    const baselineByName = new Map(journal.targetBaselines.map((entry) => [entry.logicalName, entry]));
    const request = new WorkerArtifactHandoffRequest({
      mainRoot,
      executionRoot: stored.executionRoot,
      state,
      invocation: {
        id: stored.dispatchInvocationId,
        action: { digest: stored.actionDigest },
      },
      policy,
      inputs: stored.inputs,
      contextSnapshot: stored.contextSnapshot,
      payloads: policy.payloads.map((rule) => {
        const baseline = baselineByName.get(rule.logicalName);
        if (!baseline || baseline.kind !== rule.kind || baseline.targetRelativePath !== rule.targetRelativePath) {
          throw new Error(`publication baseline is invalid for ${rule.logicalName}`);
        }
        return Object.freeze({
          rule,
          baselineDigest: baseline.digest,
          baselineByteLength: baseline.byteLength,
          baselineEntries: baseline.entries,
        });
      }),
      inputDigest: stored.inputDigest,
      inputRevision: stored.inputRevision,
      generatedAt: stored.generatedAt,
    });
    if (
      request.directory !== journal.handoffDirectory
      || request.requestDigest !== journal.requestDigest
      || stored.requestDigest !== journal.requestDigest
    ) {
      throw new WorkerArtifactHandoffError(
        "recovery-required",
        "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
        "pending worker artifact publication request no longer matches its journal",
      );
    }
    return request;
  }

  payloadPath(logicalName) {
    const payload = this.payloads.find((entry) => entry.rule.logicalName === logicalName);
    if (!payload) throw new Error(`unknown handoff payload: ${logicalName}`);
    return payload.rule.kind === "tree"
      ? path.join(this.payloadDirectory, payload.rule.targetRelativePath)
      : path.join(this.payloadDirectory, payload.rule.logicalName);
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      issue: this.issue,
      stepId: this.stepId,
      actionDigest: this.actionDigest,
      dispatchInvocationId: this.dispatchInvocationId,
      targetAuthority: this.targetAuthority,
      inputDigest: this.inputDigest,
      inputRevision: this.inputRevision,
      inputs: this.inputs.map((input) => input.toJSON()),
      contextSnapshot: this.contextSnapshot?.toJSON() ?? null,
      payloads: this.payloads.map(({ rule, baselineDigest, baselineByteLength }) => ({
        logicalName: rule.logicalName,
        kind: rule.kind,
        payloadPath: this.payloadPath(rule.logicalName),
        targetRelativePath: rule.targetRelativePath,
        targetAuthority: this.targetAuthority,
        required: rule.required,
        maxBytes: MAX_PAYLOAD_BYTES,
        baselineDigest,
        baselineByteLength,
      })),
      generatedAt: this.generatedAt,
    };
  }

  get requestDigest() {
    return digest(stableStringify(this.toJSON()));
  }

  prepare() {
    ensureRealDirectory(this.directory, this.executionRoot);
    ensureRealDirectory(this.payloadDirectory, this.executionRoot);
    for (const payload of this.payloads) {
      if (payload.rule.kind === "tree") {
        ensureRealDirectory(this.payloadPath(payload.rule.logicalName), this.executionRoot);
      }
    }
    new AtomicFile(this.requestPath, { phaseNamespace: "worker-handoff-request" })
      .write(`${JSON.stringify(this.toJSON(), null, 2)}\n`);
    return this;
  }

  toWorkerJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      issue: this.issue,
      stepId: this.stepId,
      actionDigest: this.actionDigest,
      dispatchInvocationId: this.dispatchInvocationId,
      targetAuthority: this.targetAuthority,
      requestPath: this.requestPath,
      requestDigest: this.requestDigest,
      payloadDirectory: this.payloadDirectory,
      payloads: this.toJSON().payloads,
      inputDigest: this.inputDigest,
      inputRevision: this.inputRevision,
      inputs: this.inputs.map((input) => input.toJSON()),
      contextSnapshot: this.contextSnapshot?.toJSON() ?? null,
      sealCommand: "sennel flow run seal-handoff",
      completionOwner: "parent-dispatcher",
    };
  }

  executionEnvironment() {
    return { [WORKER_ARTIFACT_HANDOFF_REQUEST_ENV]: this.requestPath };
  }

  assertCurrent(state) {
    if (
      state?.runId !== this.runId
      || state?.specId !== this.specId
      || (state?.issue ?? null) !== this.issue
      || findActiveNode(state)?.stepId !== this.stepId
    ) {
      throw new WorkerArtifactHandoffError(
        "stale",
        "FLOW_ARTIFACT_HANDOFF_STALE",
        "worker artifact handoff no longer matches the active Flow target or step",
      );
    }
    const specDir = specDirectory(this.mainRoot, state);
    if (this.contextSnapshot) {
      try {
        this.contextSnapshot.assertBinding({
          runId: state.runId,
          specId: state.specId,
          issue: state.issue ?? null,
          dispatchInvocationId: this.dispatchInvocationId,
          actionDigest: this.actionDigest,
          targetDigest: this.contextSnapshot.binding.targetDigest,
        });
      } catch (cause) {
        throw new WorkerArtifactHandoffError(
          "stale",
          "FLOW_ARTIFACT_HANDOFF_STALE",
          `draft worker context binding is stale: ${cause.message}`,
          { cause },
        );
      }
    }
    const current = this.inputs.map(({ targetRelativePath: relativePath }) => {
      const snapshot = readRegularFile(
        path.join(specDir, relativePath),
        `current canonical handoff input ${relativePath}`,
        MAX_INPUT_BYTES,
      );
      return { path: relativePath, digest: snapshot.digest, byteLength: snapshot.byteLength };
    });
    const currentDigest = handoffInputDigest(current.map((input) => ({
      targetRelativePath: input.path,
      digest: input.digest,
      byteLength: input.byteLength,
    })), this.contextSnapshot);
    const currentRevision = inputRevision(state, this.policy, currentDigest);
    if (currentDigest !== this.inputDigest || currentRevision !== this.inputRevision) {
      throw new WorkerArtifactHandoffError(
        "stale",
        "FLOW_ARTIFACT_HANDOFF_STALE",
        "worker artifact handoff input digest or revision is stale",
        {
          data: {
            expectedInputDigest: this.inputDigest,
            currentInputDigest: currentDigest,
            expectedInputRevision: this.inputRevision,
            currentInputRevision: currentRevision,
          },
        },
      );
    }
    return state;
  }
}

export class WorkerArtifactManifestEntry {
  constructor({ logicalName, relativePath, targetRelativePath, digest: hash, byteLength }) {
    this.logicalName = requiredString(logicalName, "handoff manifest logicalName");
    this.relativePath = normalizedRelativePath(relativePath, `${this.logicalName}.relativePath`);
    this.targetRelativePath = normalizedRelativePath(targetRelativePath, `${this.logicalName}.targetRelativePath`);
    this.digest = requiredDigest(hash, `${this.logicalName}.digest`);
    if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > MAX_PAYLOAD_BYTES) {
      throw new Error(`${this.logicalName}.byteLength is invalid`);
    }
    this.byteLength = byteLength;
    Object.freeze(this);
  }

  toJSON() {
    return {
      logicalName: this.logicalName,
      relativePath: this.relativePath,
      targetRelativePath: this.targetRelativePath,
      digest: this.digest,
      byteLength: this.byteLength,
    };
  }
}

export class WorkerArtifactHandoffSubmission {
  constructor(input = {}) {
    exactObjectKeys(input, [
      "version",
      "requestDigest",
      "runId",
      "specId",
      "issue",
      "stepId",
      "actionDigest",
      "dispatchInvocationId",
      "targetAuthority",
      "inputDigest",
      "inputRevision",
      "payloadManifest",
      "generatedAt",
      "handoffDigest",
    ], "worker artifact handoff submission");
    if (input.version !== WORKER_ARTIFACT_HANDOFF_VERSION) {
      throw new Error(`worker artifact handoff version must be ${WORKER_ARTIFACT_HANDOFF_VERSION}`);
    }
    this.version = WORKER_ARTIFACT_HANDOFF_VERSION;
    this.requestDigest = requiredDigest(input.requestDigest, "handoff requestDigest");
    this.runId = requiredString(input.runId, "handoff runId");
    this.specId = requiredString(input.specId, "handoff specId");
    this.issue = input.issue ?? null;
    this.stepId = requiredString(input.stepId, "handoff stepId");
    this.actionDigest = requiredDigest(input.actionDigest, "handoff actionDigest");
    this.dispatchInvocationId = requiredString(input.dispatchInvocationId, "handoff dispatchInvocationId");
    this.targetAuthority = requiredString(input.targetAuthority, "handoff targetAuthority");
    this.inputDigest = requiredDigest(input.inputDigest, "handoff inputDigest");
    this.inputRevision = requiredDigest(input.inputRevision, "handoff inputRevision");
    if (!Array.isArray(input.payloadManifest) || input.payloadManifest.length > MAX_PAYLOAD_FILES) {
      throw new Error("handoff payloadManifest is invalid");
    }
    this.payloadManifest = Object.freeze(input.payloadManifest.map((entry) => (
      entry instanceof WorkerArtifactManifestEntry ? entry : new WorkerArtifactManifestEntry(entry)
    )));
    const total = this.payloadManifest.reduce((sum, entry) => sum + entry.byteLength, 0);
    if (total > MAX_TOTAL_PAYLOAD_BYTES) throw new Error("handoff total payload is oversized");
    this.generatedAt = requiredString(input.generatedAt, "handoff generatedAt");
    if (!Number.isFinite(Date.parse(this.generatedAt))) throw new Error("handoff generatedAt must be an ISO timestamp");
    this.handoffDigest = requiredDigest(input.handoffDigest, "handoff handoffDigest");
    const expected = digest(stableStringify(this.unsignedJSON()));
    if (expected !== this.handoffDigest) throw new Error("handoff digest does not match its content");
    Object.freeze(this);
  }

  unsignedJSON() {
    return {
      version: this.version,
      requestDigest: this.requestDigest,
      runId: this.runId,
      specId: this.specId,
      issue: this.issue,
      stepId: this.stepId,
      actionDigest: this.actionDigest,
      dispatchInvocationId: this.dispatchInvocationId,
      targetAuthority: this.targetAuthority,
      inputDigest: this.inputDigest,
      inputRevision: this.inputRevision,
      payloadManifest: this.payloadManifest.map((entry) => entry.toJSON()),
      generatedAt: this.generatedAt,
    };
  }

  toJSON() {
    return { ...this.unsignedJSON(), handoffDigest: this.handoffDigest };
  }

  static seal(request, now = () => new Date()) {
    const manifest = [];
    for (const payload of request.payloads) {
      const { rule } = payload;
      const source = request.payloadPath(rule.logicalName);
      if (rule.kind === "file") {
        validateFilePayloadAtCliBoundary(request, rule, source);
        const snapshot = readRegularFile(source, `handoff payload ${rule.logicalName}`);
        const relativePath = path.relative(request.payloadDirectory, source).split(path.sep).join("/");
        manifest.push(new WorkerArtifactManifestEntry({
          logicalName: rule.logicalName,
          relativePath,
          targetRelativePath: rule.targetRelativePath,
          digest: snapshot.digest,
          byteLength: snapshot.byteLength,
        }));
      } else {
        for (const { relativePath, snapshot } of scanTree(source, { label: `handoff payload ${rule.logicalName}` })) {
          const payloadRelative = path.posix.join(rule.targetRelativePath, relativePath);
          manifest.push(new WorkerArtifactManifestEntry({
            logicalName: rule.logicalName,
            relativePath: payloadRelative,
            targetRelativePath: path.posix.join(rule.targetRelativePath, relativePath),
            digest: snapshot.digest,
            byteLength: snapshot.byteLength,
          }));
        }
      }
    }
    assertPayloadDirectoryMatchesManifest(request, manifest, "handoff");
    manifest.sort((left, right) => left.targetRelativePath.localeCompare(right.targetRelativePath));
    const unsigned = {
      version: request.version,
      requestDigest: request.requestDigest,
      runId: request.runId,
      specId: request.specId,
      issue: request.issue,
      stepId: request.stepId,
      actionDigest: request.actionDigest,
      dispatchInvocationId: request.dispatchInvocationId,
      targetAuthority: request.targetAuthority,
      inputDigest: request.inputDigest,
      inputRevision: request.inputRevision,
      payloadManifest: manifest.map((entry) => entry.toJSON()),
      generatedAt: now().toISOString(),
    };
    return new WorkerArtifactHandoffSubmission({
      ...unsigned,
      handoffDigest: digest(stableStringify(unsigned)),
    });
  }
}

function validateFilePayloadAtCliBoundary(request, rule, source) {
  try {
    // Every file payload is JSON. Parsing it here keeps malformed worker
    // output outside the sealed handoff protocol and gives the parent a
    // retryable producer error before any publication journal can exist.
    const { document } = boundedJson(source, `handoff payload ${rule.logicalName}`);
    if (
      rule.logicalName === "spec.json"
      && ["spec", "spec-repair"].includes(request.stepId)
    ) {
      validateSpecJsonObject(document);
    }
  } catch (cause) {
    if (cause instanceof WorkerArtifactHandoffError) {
      throw new WorkerArtifactHandoffError(
        cause.classification,
        cause.code,
        cause.message,
        {
          cause,
          retryable: cause.classification === "invalid" || cause.classification === "missing",
          data: {
            stepId: request.stepId,
            logicalName: rule.logicalName,
            payloadPath: source,
            ...cause.data,
          },
        },
      );
    }
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_INVALID",
      `handoff payload ${rule.logicalName} failed CLI boundary validation: ${cause.message}`,
      {
        cause,
        retryable: true,
        data: {
          stepId: request.stepId,
          logicalName: rule.logicalName,
          payloadPath: source,
        },
      },
    );
  }
}

function invalidUnsealedFilePayload(request) {
  for (const { rule } of request.payloads) {
    if (rule.kind !== "file") continue;
    try {
      validateFilePayloadAtCliBoundary(request, rule, request.payloadPath(rule.logicalName));
    } catch (cause) {
      if (cause instanceof WorkerArtifactHandoffError && cause.classification === "invalid") {
        return cause;
      }
    }
  }
  return null;
}

function prePublicationArtifactError(request, error) {
  if (
    !(error instanceof WorkerArtifactHandoffError)
    || error.classification !== "invalid"
    || error.retryable === true
  ) return error;
  return new WorkerArtifactHandoffError(
    error.classification,
    error.code,
    error.message,
    {
      cause: error,
      retryable: true,
      data: {
        stepId: request.stepId,
        actionDigest: request.actionDigest,
        dispatchInvocationId: request.dispatchInvocationId,
        handoffDirectory: request.directory,
        ...error.data,
      },
    },
  );
}

function pendingPublicationRecoveryError(request, state, error) {
  const pending = state?.workerArtifactPublication;
  if (!pending || path.resolve(pending.handoffDirectory || "") !== request.directory) return null;
  return publicationRecoveryError(request, error, {
    stepId: pending.stepId,
    actionDigest: pending.actionDigest,
    dispatchInvocationId: pending.dispatchInvocationId,
    handoffDirectory: pending.handoffDirectory,
    requestDigest: pending.requestDigest,
    handoffDigest: pending.handoffDigest,
  });
}

function publicationRecoveryError(request, error, data = {}) {
  return new WorkerArtifactHandoffError(
    "recovery-required",
    "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
    `worker artifact publication requires recovery: ${error.message}`,
    {
      cause: error,
      data: {
        stepId: request.stepId,
        actionDigest: request.actionDigest,
        dispatchInvocationId: request.dispatchInvocationId,
        handoffDirectory: request.directory,
        ...data,
        ...error.data,
      },
    },
  );
}

function requestFromStored(filePath) {
  const resolvedRequestPath = path.resolve(filePath);
  const actionDirectory = path.dirname(resolvedRequestPath);
  const invocationDirectory = path.dirname(actionDirectory);
  const runDirectory = path.dirname(invocationDirectory);
  const handoffRoot = path.dirname(runDirectory);
  const managedDirectory = path.dirname(handoffRoot);
  const executionRoot = path.dirname(managedDirectory);
  if (
    path.basename(resolvedRequestPath) !== "request.json"
    || path.basename(handoffRoot) !== "handoffs"
    || path.basename(managedDirectory) !== PRODUCT.managedDirName
  ) {
    throw new Error("handoff request path is outside the dedicated execution-root handoff authority");
  }
  const { document } = boundedJson(resolvedRequestPath, "worker artifact handoff request");
  const policy = workerArtifactHandoffPolicy(document.stepId);
  if (!policy) throw new Error(`unsupported worker artifact handoff step: ${document.stepId}`);
  const runId = requiredString(document.runId, "handoff request runId");
  const invocationId = requiredString(document.dispatchInvocationId, "handoff request dispatchInvocationId");
  const actionDigest = requiredDigest(document.actionDigest, "handoff request actionDigest");
  if (
    path.basename(runDirectory) !== digest(runId).slice(0, 24)
    || path.basename(invocationDirectory) !== digest(invocationId).slice(0, 24)
    || path.basename(actionDirectory) !== actionDigest
  ) {
    throw new Error("handoff request path does not match its guarded identities");
  }
  const storedPayloads = Array.isArray(document.payloads) ? document.payloads : [];
  if (storedPayloads.length !== policy.payloads.length) {
    throw new Error("handoff request payload contract does not match its step policy");
  }
  for (const rule of policy.payloads) {
    const stored = storedPayloads.find((entry) => entry?.logicalName === rule.logicalName);
    if (
      !stored
      || stored.kind !== rule.kind
      || stored.targetRelativePath !== rule.targetRelativePath
      || stored.required !== rule.required
      || stored.targetAuthority !== "canonical-flow-artifacts"
    ) {
      throw new Error(`handoff request payload contract is invalid for ${rule.logicalName}`);
    }
  }
  const payloadDirectory = path.join(actionDirectory, "payload");
  const request = {
    version: document.version,
    runId,
    specId: requiredString(document.specId, "handoff request specId"),
    issue: document.issue ?? null,
    stepId: requiredString(document.stepId, "handoff request stepId"),
    actionDigest,
    dispatchInvocationId: invocationId,
    targetAuthority: requiredString(document.targetAuthority, "handoff request targetAuthority"),
    inputDigest: requiredDigest(document.inputDigest, "handoff request inputDigest"),
    inputRevision: requiredDigest(document.inputRevision, "handoff request inputRevision"),
    generatedAt: requiredString(document.generatedAt, "handoff request generatedAt"),
    executionRoot,
    directory: actionDirectory,
    payloadDirectory,
    requestPath: resolvedRequestPath,
    submissionPath: path.join(actionDirectory, "handoff.json"),
    payloads: policy.payloads.map((rule) => ({ rule })),
    inputs: (Array.isArray(document.inputs) ? document.inputs : []).map((input) => (
      new WorkerArtifactInputSnapshot({
        name: input?.name,
        targetRelativePath: input?.targetRelativePath,
        snapshot: {
          digest: input?.digest,
          byteLength: input?.byteLength,
        },
        document: input?.document,
      })
    )),
    contextSnapshot: document.contextSnapshot == null
      ? null
      : DraftWorkerContextSnapshot.fromStored(document.contextSnapshot),
    payloadPath(logicalName) {
      const rule = policy.payloads.find((entry) => entry.logicalName === logicalName);
      if (!rule) throw new Error(`unknown handoff payload: ${logicalName}`);
      return rule.kind === "tree"
        ? path.join(payloadDirectory, rule.targetRelativePath)
        : path.join(payloadDirectory, rule.logicalName);
    },
  };
  if (
    !policy.inputContract.accepts(request.inputs.map((input) => input.targetRelativePath))
  ) {
    throw new Error("handoff request inputs do not match its step policy");
  }
  if (requiresDraftWorkerContext(policy) !== (request.contextSnapshot != null)) {
    throw new Error("handoff request context snapshot does not match its step contract");
  }
  request.requestDigest = digest(stableStringify(document));
  if (!isWithin(executionRoot, request.requestPath) || !isWithin(executionRoot, payloadDirectory)) {
    throw new Error("handoff request escapes execution root");
  }
  return Object.freeze(request);
}

export function sealWorkerArtifactHandoff({ requestPath, invocationId, now = () => new Date() } = {}) {
  try {
    const resolvedRequestPath = path.resolve(requiredString(requestPath, "handoff request path"));
    const request = requestFromStored(resolvedRequestPath);
    if (request.version !== WORKER_ARTIFACT_HANDOFF_VERSION) {
      throw new Error(`worker artifact handoff request version must be ${WORKER_ARTIFACT_HANDOFF_VERSION}`);
    }
    if (request.dispatchInvocationId !== requiredString(invocationId, "handoff invocation id")) {
      throw new WorkerArtifactHandoffError(
        "stale",
        "FLOW_ARTIFACT_HANDOFF_STALE",
        "handoff request belongs to another dispatch invocation",
      );
    }
    const submission = WorkerArtifactHandoffSubmission.seal(request, now);
    new AtomicFile(request.submissionPath, { phaseNamespace: "worker-handoff-seal" })
      .write(`${JSON.stringify(submission.toJSON(), null, 2)}\n`);
    return Object.freeze({
      sealed: true,
      handoffPath: request.submissionPath,
      handoffDigest: submission.handoffDigest,
      payloadCount: submission.payloadManifest.length,
    });
  } catch (cause) {
    if (cause instanceof WorkerArtifactHandoffError) throw cause;
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_INVALID",
      `worker artifact handoff could not be sealed: ${cause.message}`,
      { cause },
    );
  }
}

export class WorkerArtifactPublicationJournal {
  constructor(input = {}) {
    if (input.version !== 1) throw new Error("worker artifact publication version must be 1");
    this.version = 1;
    this.runId = requiredString(input.runId, "publication runId");
    this.specId = requiredString(input.specId, "publication specId");
    this.issue = input.issue ?? null;
    this.stepId = requiredString(input.stepId, "publication stepId");
    this.actionDigest = requiredDigest(input.actionDigest, "publication actionDigest");
    this.dispatchInvocationId = requiredString(input.dispatchInvocationId, "publication dispatchInvocationId");
    this.requestDigest = requiredDigest(input.requestDigest, "publication requestDigest");
    this.handoffDigest = requiredDigest(input.handoffDigest, "publication handoffDigest");
    this.inputDigest = requiredDigest(input.inputDigest, "publication inputDigest");
    this.inputRevision = requiredDigest(input.inputRevision, "publication inputRevision");
    this.handoffDirectory = path.resolve(requiredString(input.handoffDirectory, "publication handoffDirectory"));
    this.payloadManifest = Object.freeze((input.payloadManifest || []).map((entry) => new WorkerArtifactManifestEntry(entry)));
    this.targetBaselines = Object.freeze((input.targetBaselines || []).map((entry) => {
      if (!["file", "tree"].includes(entry.kind)) throw new Error("publication baseline kind is invalid");
      const byteLength = Number(entry.byteLength || 0);
      if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > MAX_TOTAL_PAYLOAD_BYTES) {
        throw new Error("publication baseline byteLength is invalid");
      }
      const entries = entry.entries == null ? null : Object.freeze(entry.entries.map((item) => {
        const itemByteLength = Number(item.byteLength);
        if (!Number.isSafeInteger(itemByteLength) || itemByteLength < 0 || itemByteLength > MAX_PAYLOAD_BYTES) {
          throw new Error("publication baseline entry byteLength is invalid");
        }
        return Object.freeze({
          targetRelativePath: normalizedRelativePath(item.targetRelativePath, "publication baseline entry path"),
          digest: requiredDigest(item.digest, "publication baseline entry digest"),
          byteLength: itemByteLength,
        });
      }));
      if (entry.kind === "file" && entries != null) {
        throw new Error("file publication baseline cannot contain tree entries");
      }
      if (entry.kind === "tree") {
        if (entries == null) throw new Error("tree publication baseline requires entries");
        const expectedDigest = digest(stableStringify(entries.map((item) => ({
          targetRelativePath: item.targetRelativePath,
          digest: item.digest,
          byteLength: item.byteLength,
        }))));
        const expectedBytes = entries.reduce((sum, item) => sum + item.byteLength, 0);
        if (entry.digest !== expectedDigest || byteLength !== expectedBytes) {
          throw new Error("tree publication baseline digest or byteLength is invalid");
        }
      }
      return Object.freeze({
        logicalName: requiredString(entry.logicalName, "publication baseline logicalName"),
        kind: entry.kind,
        targetRelativePath: normalizedRelativePath(entry.targetRelativePath, "publication baseline targetRelativePath"),
        digest: entry.digest == null ? null : requiredDigest(entry.digest, "publication baseline digest"),
        byteLength,
        entries,
      });
    }));
    this.startedAt = requiredString(input.startedAt, "publication startedAt");
    Object.freeze(this);
  }

  static create(request, submission, now = () => new Date()) {
    return new WorkerArtifactPublicationJournal({
      version: 1,
      runId: request.runId,
      specId: request.specId,
      issue: request.issue,
      stepId: request.stepId,
      actionDigest: request.actionDigest,
      dispatchInvocationId: request.dispatchInvocationId,
      requestDigest: request.requestDigest,
      handoffDigest: submission.handoffDigest,
      inputDigest: request.inputDigest,
      inputRevision: request.inputRevision,
      handoffDirectory: request.directory,
      payloadManifest: submission.payloadManifest.map((entry) => entry.toJSON()),
      targetBaselines: request.payloads.map(({ rule, baselineDigest, baselineByteLength, baselineEntries }) => ({
        logicalName: rule.logicalName,
        kind: rule.kind,
        targetRelativePath: rule.targetRelativePath,
        digest: baselineDigest,
        byteLength: baselineByteLength,
        entries: baselineEntries,
      })),
      startedAt: now().toISOString(),
    });
  }

  matches(request, submission) {
    return this.runId === request.runId
      && this.specId === request.specId
      && this.stepId === request.stepId
      && this.requestDigest === request.requestDigest
      && this.handoffDigest === submission.handoffDigest;
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      issue: this.issue,
      stepId: this.stepId,
      actionDigest: this.actionDigest,
      dispatchInvocationId: this.dispatchInvocationId,
      requestDigest: this.requestDigest,
      handoffDigest: this.handoffDigest,
      inputDigest: this.inputDigest,
      inputRevision: this.inputRevision,
      handoffDirectory: this.handoffDirectory,
      payloadManifest: this.payloadManifest.map((entry) => entry.toJSON()),
      targetBaselines: this.targetBaselines.map((entry) => ({
        ...entry,
        entries: entry.entries?.map((item) => ({ ...item })) ?? null,
      })),
      startedAt: this.startedAt,
    };
  }
}

export function validateWorkerArtifactPublicationState(value, state) {
  const journal = new WorkerArtifactPublicationJournal(value);
  if (journal.runId !== state.runId || journal.specId !== state.specId) {
    throw new Error("worker artifact publication does not match Flow state");
  }
  return journal;
}

export class WorkerArtifactHandoffReceipt {
  constructor(input = {}) {
    if (input.version !== 1) throw new Error("worker artifact receipt version must be 1");
    this.version = 1;
    this.runId = requiredString(input.runId, "worker artifact receipt runId");
    this.specId = requiredString(input.specId, "worker artifact receipt specId");
    this.stepId = requiredString(input.stepId, "worker artifact receipt stepId");
    this.actionDigest = requiredDigest(input.actionDigest, "worker artifact receipt actionDigest");
    this.dispatchInvocationId = requiredString(input.dispatchInvocationId, "worker artifact receipt dispatchInvocationId");
    this.requestDigest = requiredDigest(input.requestDigest, "worker artifact receipt requestDigest");
    this.handoffDigest = requiredDigest(input.handoffDigest, "worker artifact receipt handoffDigest");
    this.inputDigest = requiredDigest(input.inputDigest, "worker artifact receipt inputDigest");
    this.inputRevision = requiredDigest(input.inputRevision, "worker artifact receipt inputRevision");
    this.payloadDigest = requiredDigest(input.payloadDigest, "worker artifact receipt payloadDigest");
    this.consumedAt = requiredString(input.consumedAt, "worker artifact receipt consumedAt");
    if (!Number.isFinite(Date.parse(this.consumedAt))) {
      throw new Error("worker artifact receipt consumedAt must be an ISO timestamp");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      stepId: this.stepId,
      actionDigest: this.actionDigest,
      dispatchInvocationId: this.dispatchInvocationId,
      requestDigest: this.requestDigest,
      handoffDigest: this.handoffDigest,
      inputDigest: this.inputDigest,
      inputRevision: this.inputRevision,
      payloadDigest: this.payloadDigest,
      consumedAt: this.consumedAt,
    };
  }
}

export function validateWorkerArtifactReceiptsState(value, state) {
  if (!Array.isArray(value) || value.length > 64) {
    throw new Error("workerArtifactReceipts must be an array with at most 64 entries");
  }
  const digests = new Set();
  return value.map((entry) => {
    const receipt = new WorkerArtifactHandoffReceipt(entry);
    if (receipt.runId !== state.runId || receipt.specId !== state.specId) {
      throw new Error("worker artifact receipt does not match Flow state");
    }
    if (digests.has(receipt.handoffDigest)) {
      throw new Error("worker artifact receipts contain a duplicate handoff digest");
    }
    digests.add(receipt.handoffDigest);
    return receipt;
  });
}

function validateSubmission(request, submission) {
  let storedRequest;
  try {
    storedRequest = requestFromStored(request.requestPath);
  } catch (cause) {
    if (cause instanceof WorkerArtifactHandoffError) throw cause;
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_INVALID",
      `worker artifact handoff request is invalid during parent validation: ${cause.message}`,
      { cause },
    );
  }
  const stale = (
    storedRequest.requestDigest !== request.requestDigest
    || storedRequest.directory !== request.directory
    || storedRequest.payloadDirectory !== request.payloadDirectory
    || submission.requestDigest !== request.requestDigest
    || submission.runId !== request.runId
    || submission.specId !== request.specId
    || submission.issue !== request.issue
    || submission.stepId !== request.stepId
    || submission.actionDigest !== request.actionDigest
    || submission.dispatchInvocationId !== request.dispatchInvocationId
    || submission.targetAuthority !== request.targetAuthority
    || submission.inputDigest !== request.inputDigest
    || submission.inputRevision !== request.inputRevision
  );
  if (stale) {
    throw new WorkerArtifactHandoffError(
      "stale",
      "FLOW_ARTIFACT_HANDOFF_STALE",
      "sealed worker artifact handoff does not match the guarded action or input revision",
    );
  }
  assertPayloadDirectoryMatchesManifest(request, submission.payloadManifest, "sealed handoff");
  const byLogicalName = new Map();
  const targetPaths = new Set();
  const allowedLogicalNames = new Set(request.payloads.map(({ rule }) => rule.logicalName));
  for (const entry of submission.payloadManifest) {
    if (!allowedLogicalNames.has(entry.logicalName)) {
      throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", `handoff manifest declares an unknown logical payload: ${entry.logicalName}`);
    }
    if (targetPaths.has(entry.targetRelativePath)) {
      throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", `handoff manifest duplicates target path: ${entry.targetRelativePath}`);
    }
    targetPaths.add(entry.targetRelativePath);
    if (!byLogicalName.has(entry.logicalName)) byLogicalName.set(entry.logicalName, []);
    byLogicalName.get(entry.logicalName).push(entry);
    const source = path.join(request.payloadDirectory, ...entry.relativePath.split("/"));
    if (!isWithin(request.payloadDirectory, source)) {
      throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", "handoff manifest path escapes the payload directory");
    }
    const snapshot = readRegularFile(source, `sealed handoff payload ${entry.relativePath}`);
    if (snapshot.digest !== entry.digest || snapshot.byteLength !== entry.byteLength) {
      throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", `sealed handoff payload changed after sealing: ${entry.relativePath}`);
    }
  }
  for (const { rule } of request.payloads) {
    const entries = byLogicalName.get(rule.logicalName) || [];
    if (rule.kind === "file" && entries.length !== 1) {
      throw new WorkerArtifactHandoffError("missing", "FLOW_ARTIFACT_HANDOFF_MISSING", `handoff requires exactly one ${rule.logicalName} payload`);
    }
    if (rule.kind === "file" && entries[0].targetRelativePath !== rule.targetRelativePath) {
      throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", `handoff target is invalid for ${rule.logicalName}`);
    }
    if (rule.kind === "tree" && entries.some((entry) => (
      !entry.targetRelativePath.startsWith(`${rule.targetRelativePath}/`)
      || isCommandOwnedSpecTestTarget(entry.targetRelativePath)
    ))) {
      throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", `handoff tree target is invalid for ${rule.logicalName}`);
    }
  }
}

function payloadDocument(request, submission, logicalName) {
  const entry = submission.payloadManifest.find((candidate) => candidate.logicalName === logicalName);
  if (!entry) throw new Error(`handoff payload is missing: ${logicalName}`);
  const source = path.join(request.payloadDirectory, ...entry.relativePath.split("/"));
  return boundedJson(source, `handoff payload ${logicalName}`).document;
}

function validateDraftPayload(request, submission, state) {
  const draft = payloadDocument(request, submission, "draft.json");
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    throw new Error("draft.json must contain a JSON object");
  }
  const route = draftReviewRouteForStepId(request.stepId);
  if (!route) return;
  const canonicalSpecDir = specDirectory(request.mainRoot, state);
  const reviewFile = new DraftReviewArtifactFile({ specDir: canonicalSpecDir, filename: route.reviewArtifact });
  const triageFile = request.stepId === route.triageStepId
    ? new DraftReviewArtifactFile({
        specDir: request.payloadDirectory,
        filename: route.triageArtifact,
      })
    : new DraftReviewArtifactFile({ specDir: canonicalSpecDir, filename: route.triageArtifact });
  const repairFile = request.stepId === route.repairStepId
    ? new DraftReviewArtifactFile({
        specDir: request.payloadDirectory,
        filename: route.repairArtifact,
      })
    : null;
  const evidence = new DraftReviewEvidenceSet({ route, state, reviewFile, triageFile, repairFile });
  const validation = evidence.validateThrough(request.stepId);
  if (validation.issues.length > 0) throw new Error(validation.issues.join("; "));
}

function assertPlanGateRepairMadeProgress(request, submission, state, logicalName) {
  const repair = PlanGateRepairRecord.forTarget(state, request.stepId);
  if (!repair) return;
  const target = request.payloads.find(({ rule }) => rule.logicalName === logicalName);
  const entries = submission.payloadManifest.filter((candidate) => candidate.logicalName === logicalName);
  if (!target || entries.length === 0) return;
  const payloadDigest = target.rule.kind === "tree"
    ? digest(stableStringify(entries.map((entry) => ({
        targetRelativePath: entry.targetRelativePath,
        digest: entry.digest,
        byteLength: entry.byteLength,
      }))))
    : entries[0].digest;
  if (target.baselineDigest === payloadDigest) {
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_PLAN_GATE_REPAIR_NO_PROGRESS",
      `${logicalName} did not change while repairing ${repair.phase} gate observations`,
      { data: { sourceIssueLogId: repair.sourceIssueLogId, stepId: request.stepId } },
    );
  }
}

function assertTestReviewRepairMadeProgress(request, submission, state, logicalName) {
  const repair = TestReviewRepairRecord.forTarget(state, request.stepId);
  if (!repair) return;
  const target = request.payloads.find(({ rule }) => rule.logicalName === logicalName);
  const entries = submission.payloadManifest.filter((candidate) => candidate.logicalName === logicalName);
  if (!target || entries.length === 0) return;
  const payloadDigest = target.rule.kind === "tree"
    ? digest(stableStringify(entries.map((entry) => ({
        targetRelativePath: entry.targetRelativePath,
        digest: entry.digest,
        byteLength: entry.byteLength,
      }))))
    : entries[0].digest;
  if (target.baselineDigest === payloadDigest) {
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_TEST_REVIEW_REPAIR_NO_PROGRESS",
      `${logicalName} did not change while repairing test-review findings`,
      {
        data: {
          sourceEvidenceId: repair.sourceEvidenceId,
          sourceTestRevisionDigest: repair.sourceTestRevision.digest,
          stepId: request.stepId,
        },
      },
    );
  }
}

function validatePayload(request, submission, state) {
  try {
    if (request.stepId.startsWith("draft")) {
      if (request.stepId.endsWith("triage")) {
        const route = draftReviewRouteForStepId(request.stepId);
        const canonicalSpecDir = specDirectory(request.mainRoot, state);
        const evidence = new DraftReviewEvidenceSet({
          route,
          state,
          reviewFile: new DraftReviewArtifactFile({ specDir: canonicalSpecDir, filename: route.reviewArtifact }),
          triageFile: new DraftReviewArtifactFile({ specDir: request.payloadDirectory, filename: route.triageArtifact }),
        });
        const result = evidence.validateThrough(request.stepId);
        if (result.issues.length > 0) throw new Error(result.issues.join("; "));
      } else {
        validateDraftPayload(request, submission, state);
        if (request.stepId === "draft-refine") {
          assertPlanGateRepairMadeProgress(request, submission, state, "draft.json");
        }
      }
      return;
    }
    if (request.stepId === "spec") {
      validateSpecJsonObject(payloadDocument(request, submission, "spec.json"));
      assertPlanGateRepairMadeProgress(request, submission, state, "spec.json");
      return;
    }
    if (request.stepId === "spec-triage") {
      validateSpecTriageDocument({
        review: request.inputs.find((input) => input.name === "spec-review.json").document,
        triage: payloadDocument(request, submission, "spec-triage.json"),
      });
      return;
    }
    if (request.stepId === "spec-repair") {
      validateSpecRepairDocument({
        review: request.inputs.find((input) => input.name === "spec-review.json").document,
        triage: request.inputs.find((input) => input.name === "spec-triage.json").document,
        repair: payloadDocument(request, submission, "spec-repair.json"),
      });
      validateSpecJsonObject(payloadDocument(request, submission, "spec.json"));
      return;
    }
    if (request.stepId === "test") {
      const spec = request.inputs.find((input) => input.name === "spec.json").document;
      const result = validateTestHeaders({ specDir: request.payloadDirectory, spec });
      if (!result.ok) throw new Error(formatValidationMessages(result).join("; "));
      new SpecTestBootstrapValidator({
        payloadSpecDir: request.payloadDirectory,
        canonicalSpecDir: specDirectory(request.mainRoot, state),
        repositoryRoot: request.mainRoot,
        executionRoot: request.executionRoot,
      }).validate().assertValid();
      assertPlanGateRepairMadeProgress(request, submission, state, "spec-tests");
      assertTestReviewRepairMadeProgress(request, submission, state, "spec-tests");
    }
  } catch (cause) {
    if (cause instanceof WorkerArtifactHandoffError) throw cause;
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_INVALID",
      `worker artifact payload failed ${request.stepId} validation: ${cause.message}`,
      {
        cause,
        retryable: true,
        data: {
          stepId: request.stepId,
          handoffDirectory: request.directory,
        },
      },
    );
  }
}

function manifestByTarget(entries) {
  return new Map(entries.map((entry) => [entry.targetRelativePath, entry]));
}

function currentFileIdentity(filePath) {
  const snapshot = readOptionalSnapshot(filePath, `canonical publication target ${filePath}`);
  return snapshot ? { digest: snapshot.digest, byteLength: snapshot.byteLength } : null;
}

function manifestPayloadBytes(request, entry, label = "publication payload") {
  const source = path.join(request.payloadDirectory, ...entry.relativePath.split("/"));
  const snapshot = readRegularFile(source, `${label} ${entry.relativePath}`);
  if (snapshot.digest !== entry.digest || snapshot.byteLength !== entry.byteLength) {
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_INVALID",
      `sealed handoff payload changed before publication: ${entry.relativePath}`,
    );
  }
  return snapshot.bytes;
}

function publicationCommitGuard(target, baseline, desired, targetRelativePath) {
  return () => {
    const status = assertFilePublishable(
      currentFileIdentity(target),
      baseline,
      desired,
      targetRelativePath,
    );
    if (status !== "pending") {
      throw new WorkerArtifactHandoffError(
        "conflict",
        "FLOW_ARTIFACT_HANDOFF_CONFLICT",
        `canonical artifact changed during publication: ${targetRelativePath}`,
      );
    }
  };
}

function assertFilePublishable(current, baseline, desired, target) {
  const same = (left, right) => left?.digest === right?.digest && left?.byteLength === right?.byteLength;
  if (same(current, desired)) return "published";
  if (same(current, baseline) || (current == null && baseline == null)) return "pending";
  throw new WorkerArtifactHandoffError(
    "conflict",
    "FLOW_ARTIFACT_HANDOFF_CONFLICT",
    `canonical artifact changed after handoff capture: ${target}`,
    { data: { target, baselineDigest: baseline?.digest ?? null, currentDigest: current?.digest ?? null } },
  );
}

function publishJournal({ request, journal, faultInjector }) {
  const specDir = specDirectory(request.mainRoot, request.state);
  const desired = manifestByTarget(journal.payloadManifest);
  for (const baseline of journal.targetBaselines) {
    if (baseline.kind === "file") {
      const target = path.join(specDir, ...baseline.targetRelativePath.split("/"));
      const desiredEntry = desired.get(baseline.targetRelativePath);
      const current = currentFileIdentity(target);
      const status = assertFilePublishable(
        current,
        baseline.digest == null ? null : { digest: baseline.digest, byteLength: baseline.byteLength },
        desiredEntry,
        baseline.targetRelativePath,
      );
      if (status === "pending") {
        ensureRealDirectory(path.dirname(target), specDir);
        const baselineIdentity = baseline.digest == null
          ? null
          : { digest: baseline.digest, byteLength: baseline.byteLength };
        new AtomicFile(target, {
          phaseNamespace: "worker-handoff-publication",
          faultInjector,
          commitGuard: publicationCommitGuard(
            target,
            baselineIdentity,
            desiredEntry,
            baseline.targetRelativePath,
          ),
        }).write(manifestPayloadBytes(request, desiredEntry));
      }
      continue;
    }

    const treeRoot = path.join(specDir, ...baseline.targetRelativePath.split("/"));
    ensureRealDirectory(treeRoot, specDir);
    const baselineByTarget = manifestByTarget(baseline.entries || []);
    const desiredEntries = journal.payloadManifest.filter((entry) => entry.logicalName === baseline.logicalName);
    for (const entry of desiredEntries) {
      const target = path.join(specDir, ...entry.targetRelativePath.split("/"));
      const current = currentFileIdentity(target);
      const status = assertFilePublishable(current, baselineByTarget.get(entry.targetRelativePath), entry, entry.targetRelativePath);
      if (status === "pending") {
        ensureRealDirectory(path.dirname(target), specDir);
        const baselineIdentity = baselineByTarget.get(entry.targetRelativePath) || null;
        new AtomicFile(target, {
          phaseNamespace: "worker-handoff-publication",
          faultInjector,
          commitGuard: publicationCommitGuard(
            target,
            baselineIdentity,
            entry,
            entry.targetRelativePath,
          ),
        }).write(manifestPayloadBytes(request, entry));
      }
    }
    const desiredTargets = new Set(desiredEntries.map((entry) => entry.targetRelativePath));
    for (const previous of baseline.entries || []) {
      if (desiredTargets.has(previous.targetRelativePath)) continue;
      const target = path.join(specDir, ...previous.targetRelativePath.split("/"));
      const current = currentFileIdentity(target);
      if (current == null) continue;
      assertFilePublishable(current, previous, null, previous.targetRelativePath);
      new AtomicFile(target, {
        phaseNamespace: "worker-handoff-publication",
        faultInjector,
      }).remove();
      removeEmptyParents(path.dirname(target), treeRoot);
    }
  }
}

function assertJournalPublished(mainRoot, state, journal) {
  const specDir = specDirectory(mainRoot, state);
  const desiredTargets = new Set(journal.payloadManifest.map((entry) => entry.targetRelativePath));
  for (const entry of journal.payloadManifest) {
    const target = path.join(specDir, ...entry.targetRelativePath.split("/"));
    const current = readRegularFile(target, `published handoff target ${entry.targetRelativePath}`);
    if (current.digest !== entry.digest || current.byteLength !== entry.byteLength) {
      throw new WorkerArtifactHandoffError("recovery-required", "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED", `published handoff target is incomplete: ${entry.targetRelativePath}`);
    }
  }
  for (const baseline of journal.targetBaselines.filter((entry) => entry.kind === "tree")) {
    for (const previous of baseline.entries || []) {
      if (!desiredTargets.has(previous.targetRelativePath)) {
        const target = path.join(specDir, ...previous.targetRelativePath.split("/"));
        if (fs.existsSync(target)) {
          throw new WorkerArtifactHandoffError("recovery-required", "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED", `stale canonical test file remains after publication: ${previous.targetRelativePath}`);
        }
      }
    }
  }
}

class WorkerArtifactCompletionIntent extends StepTransitionCommitIntent {
  constructor({ mainRoot, journal, revision, now = () => new Date() }) {
    super();
    this.mainRoot = mainRoot;
    this.journal = journal;
    this.revision = revision;
    this.completedAt = now().toISOString();
    Object.freeze(this);
  }

  assertBeforeTransition(state) {
    const pending = new WorkerArtifactPublicationJournal(state.workerArtifactPublication);
    if (pending.handoffDigest !== this.journal.handoffDigest) {
      throw new WorkerArtifactHandoffError("conflict", "FLOW_ARTIFACT_HANDOFF_CONFLICT", "pending worker artifact publication changed before transition");
    }
    assertJournalPublished(this.mainRoot, state, this.journal);
  }

  applyTo(state) {
    const testReviewRepair = TestReviewRepairRecord.forTarget(state, this.journal.stepId);
    if (this.revision?.kind === "draft") state.draftArtifactRevision = this.revision.value;
    if (this.revision?.kind === "spec") state.specArtifactRevision = this.revision.value;
    if (this.revision?.kind === "test") state.specTestArtifactRevision = this.revision.value;
    const receipts = Array.isArray(state.workerArtifactReceipts) ? state.workerArtifactReceipts : [];
    const receipt = new WorkerArtifactHandoffReceipt({
      version: 1,
      runId: this.journal.runId,
      specId: this.journal.specId,
      stepId: this.journal.stepId,
      actionDigest: this.journal.actionDigest,
      dispatchInvocationId: this.journal.dispatchInvocationId,
      requestDigest: this.journal.requestDigest,
      handoffDigest: this.journal.handoffDigest,
      inputDigest: this.journal.inputDigest,
      inputRevision: this.journal.inputRevision,
      payloadDigest: manifestDigest(this.journal.payloadManifest),
      consumedAt: this.completedAt,
    });
    state.workerArtifactReceipts = [...receipts, receipt.toJSON()].slice(-64);
    if (testReviewRepair) {
      if (this.revision?.kind !== "test") {
        throw new WorkerArtifactHandoffError(
          "conflict",
          "FLOW_ARTIFACT_HANDOFF_CONFLICT",
          "test-review repair publication did not produce a canonical test revision",
        );
      }
      const history = Array.isArray(state.testReviewRepairHistory)
        ? state.testReviewRepairHistory
        : [];
      const completion = new TestReviewRepairCompletion({
        version: 1,
        repair: testReviewRepair.toJSON(),
        publishedTestRevisionDigest: this.revision.value.digest,
        handoffDigest: receipt.handoffDigest,
        completedAt: this.completedAt,
      });
      state.testReviewRepairHistory = [...history, completion.toJSON()].slice(-64);
      delete state.testReviewRepair;
    }
    const repair = PlanGateRepairRecord.forTarget(state, this.journal.stepId);
    if (repair) delete state.planGateRepair;
    delete state.draftArtifactPromotion;
    delete state.workerArtifactPublication;
  }
}

function revisionFor(request, journal, now = () => new Date()) {
  if (!request.policy.revisionKind) return null;
  const entries = journal.payloadManifest.filter((entry) => (
    request.policy.revisionKind === "draft"
      ? entry.targetRelativePath === "draft.json"
      : request.policy.revisionKind === "spec"
        ? entry.targetRelativePath === "spec.json"
        : entry.logicalName === "spec-tests"
  ));
  const hash = manifestDigest(entries);
  const byteLength = entries.reduce((sum, entry) => sum + entry.byteLength, 0);
  if (request.policy.revisionKind === "draft") {
    const draftEntry = entries[0];
    return {
      kind: "draft",
      value: new DraftArtifactRevision({
        version: 1,
        runId: request.runId,
        specId: request.specId,
        sourceStepId: request.stepId,
        digest: draftEntry.digest,
        byteLength: draftEntry.byteLength,
        finalizedAt: now().toISOString(),
      }).toJSON(),
    };
  }
  return {
    kind: request.policy.revisionKind,
    value: new WorkerArtifactRevision({
      version: 1,
      runId: request.runId,
      specId: request.specId,
      stepId: request.stepId,
      digest: hash,
      byteLength,
      finalizedAt: now().toISOString(),
    }).toJSON(),
  };
}

function readSubmission(request) {
  let document;
  try {
    ({ document } = boundedJson(request.submissionPath, "sealed worker artifact handoff"));
  } catch (error) {
    if (error instanceof WorkerArtifactHandoffError) throw error;
    throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", error.message, { cause: error });
  }
  try {
    return new WorkerArtifactHandoffSubmission(document);
  } catch (cause) {
    throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", `sealed worker artifact handoff is invalid: ${cause.message}`, { cause });
  }
}

function receiptFor(state, handoffDigest) {
  return (state?.workerArtifactReceipts || []).find((entry) => entry?.handoffDigest === handoffDigest) || null;
}

function receiptForRequest(state, request) {
  return (state?.workerArtifactReceipts || []).find((entry) => (
    entry?.requestDigest === request.requestDigest
    && entry?.dispatchInvocationId === request.dispatchInvocationId
    && entry?.actionDigest === request.actionDigest
  )) || null;
}

function cleanupCompletedHandoff(executionRoot, receiptValue, faultInjector = () => {}) {
  const receipt = receiptValue instanceof WorkerArtifactHandoffReceipt
    ? receiptValue
    : new WorkerArtifactHandoffReceipt(receiptValue);
  const directory = handoffActionDirectory(
    executionRoot,
    receipt.runId,
    receipt.dispatchInvocationId,
    receipt.actionDigest,
  );
  const consumedDirectory = `${directory}.consumed-${receipt.handoffDigest.slice(0, 24)}`;
  const data = {
    handoffDirectory: directory,
    consumedHandoffDirectory: consumedDirectory,
    stepId: receipt.stepId,
    actionDigest: receipt.actionDigest,
    dispatchInvocationId: receipt.dispatchInvocationId,
  };
  function realDirectory(candidate) {
    let stat;
    try {
      stat = fs.lstatSync(candidate);
    } catch (cause) {
      if (cause.code === "ENOENT") return false;
      throw cause;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(candidate) !== candidate) {
      throw new Error(`completed handoff cleanup target is not a real directory: ${candidate}`);
    }
    return true;
  }
  try {
    let cleaned = false;
    if (realDirectory(consumedDirectory)) {
      fs.rmSync(consumedDirectory, { recursive: true });
      cleaned = true;
    }
    if (!realDirectory(directory)) return cleaned;
    let stored = null;
    try {
      stored = requestFromStored(path.join(directory, "request.json"));
    } catch (cause) {
      if (!(cause instanceof WorkerArtifactHandoffError) || cause.classification !== "missing") {
        throw cause;
      }
    }
    if (stored && (
      stored.runId !== receipt.runId
      || stored.specId !== receipt.specId
      || stored.stepId !== receipt.stepId
      || stored.actionDigest !== receipt.actionDigest
      || stored.dispatchInvocationId !== receipt.dispatchInvocationId
      || stored.requestDigest !== receipt.requestDigest
    )) throw new Error("completed handoff directory does not match its canonical receipt");
    faultInjector({ phase: "before-worker-handoff-cleanup-rename", stepId: receipt.stepId });
    fs.renameSync(directory, consumedDirectory);
    faultInjector({ phase: "after-worker-handoff-cleanup-rename", stepId: receipt.stepId });
    fs.rmSync(consumedDirectory, { recursive: true });
    faultInjector({ phase: "after-worker-handoff-cleanup", stepId: receipt.stepId });
    return true;
  } catch (cause) {
    throw new WorkerArtifactHandoffError(
      "recovery-required",
      "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
      `completed worker artifact handoff cleanup requires recovery: ${cause.message}`,
      { cause, data },
    );
  }
}

export class WorkerArtifactHandoffCoordinator {
  constructor({ faultInjector = () => {}, now = () => new Date() } = {}) {
    this.faultInjector = faultInjector;
    this.now = now;
  }

  createRequest({ ctx, state, invocation }) {
    const request = WorkerArtifactHandoffRequest.create({
      mainRoot: ctx.mainRoot || ctx.root,
      executionRoot: ctx.executionRoot || ctx.root,
      state,
      invocation,
      now: this.now,
    });
    return request?.prepare() || null;
  }

  recoverPending({ ctx }) {
    const state = typeof ctx.flowManager.load === "function"
      ? ctx.flowManager.load(ctx.specId)
      : ctx.flowManager.loadReadOnly(ctx.specId);
    if (state.workerArtifactPublication == null) {
      const cleaned = (state.workerArtifactReceipts || []).reduce((count, receipt) => (
        cleanupCompletedHandoff(ctx.executionRoot || ctx.root, receipt, this.faultInjector) ? count + 1 : count
      ), 0);
      return cleaned > 0
        ? { completed: true, replayed: true, cleanedHandoffs: cleaned }
        : null;
    }
    let journal;
    let request;
    try {
      journal = validateWorkerArtifactPublicationState(state.workerArtifactPublication, state);
      request = WorkerArtifactHandoffRequest.restore({
        mainRoot: ctx.mainRoot || ctx.root,
        state,
        journal,
      });
    } catch (cause) {
      const pending = journal || state.workerArtifactPublication || {};
      const data = {
        ...(typeof pending.stepId === "string" && { stepId: pending.stepId }),
        ...(SHA256.test(pending.actionDigest || "") && { actionDigest: pending.actionDigest }),
        ...(typeof pending.dispatchInvocationId === "string" && {
          dispatchInvocationId: pending.dispatchInvocationId,
        }),
        ...(typeof pending.handoffDirectory === "string" && {
          handoffDirectory: pending.handoffDirectory,
        }),
      };
      if (cause instanceof WorkerArtifactHandoffError) {
        throw new WorkerArtifactHandoffError(
          cause.classification,
          cause.code,
          cause.message,
          { cause, data: { ...data, ...cause.data } },
        );
      }
      throw new WorkerArtifactHandoffError(
        "recovery-required",
        "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
        `pending worker artifact publication cannot be reconstructed: ${cause.message}`,
        { cause, data },
      );
    }
    return this.reconcile({ ctx, request });
  }

  reconcile({ ctx, request }) {
    if (!(request instanceof WorkerArtifactHandoffRequest)) return null;
    let state = ctx.flowManager.load(request.specId);
    const completedReceipt = receiptForRequest(state, request);
    if (completedReceipt) {
      cleanupCompletedHandoff(request.executionRoot, completedReceipt, this.faultInjector);
      return {
        completed: true,
        replayed: true,
        stepId: completedReceipt.stepId,
        handoffDigest: completedReceipt.handoffDigest,
        payloadDigest: completedReceipt.payloadDigest,
      };
    }
    const operation = new RepositoryFlowOperationLock({ mainRoot: request.mainRoot });
    let operationOwnerToken;
    let journal = null;
    let publicationJournalActive = false;
    try {
      operationOwnerToken = operation.acquire();
    } catch (cause) {
      throw new WorkerArtifactHandoffError(
        "conflict",
        "FLOW_ARTIFACT_HANDOFF_CONFLICT",
        `worker artifact publication could not acquire canonical repository authority: ${cause.message}`,
        { cause },
      );
    }
    try {
      let submission;
      try {
        submission = readSubmission(request);
      } catch (cause) {
        const recoveryError = pendingPublicationRecoveryError(request, state, cause);
        if (recoveryError) throw recoveryError;
        // A worker that could not seal a file payload leaves no submission and
        // therefore no publication journal. An invalid file is retryable, but
        // a worker that never produced a payload remains a non-retryable
        // missing-handoff failure. A missing submission while a journal is
        // already pending remains recovery-owned below.
        if (
          cause instanceof WorkerArtifactHandoffError
          && cause.classification === "missing"
          && state.workerArtifactPublication == null
        ) {
          const invalidPayload = invalidUnsealedFilePayload(request);
          if (invalidPayload) throw invalidPayload;
          throw new WorkerArtifactHandoffError(
            "missing",
            cause.code,
            cause.message,
            {
              cause,
              retryable: false,
              data: {
                stepId: request.stepId,
                actionDigest: request.actionDigest,
                dispatchInvocationId: request.dispatchInvocationId,
                handoffDirectory: request.directory,
                ...cause.data,
              },
            },
          );
        }
        throw prePublicationArtifactError(request, cause);
      }
      try {
        validateSubmission(request, submission);
      } catch (cause) {
        const recoveryError = pendingPublicationRecoveryError(request, state, cause);
        if (recoveryError) throw recoveryError;
        throw prePublicationArtifactError(request, cause);
      }
      state = ctx.flowManager.load(request.specId);
      if (receiptFor(state, submission.handoffDigest)) {
        cleanupCompletedHandoff(
          request.executionRoot,
          receiptFor(state, submission.handoffDigest),
          this.faultInjector,
        );
        return { completed: true, replayed: true };
      }
      const hasJournal = state.workerArtifactPublication != null;
      journal = hasJournal
        ? new WorkerArtifactPublicationJournal(state.workerArtifactPublication)
        : WorkerArtifactPublicationJournal.create(request, submission, this.now);
      if (!journal.matches(request, submission)) {
        throw new WorkerArtifactHandoffError("conflict", "FLOW_ARTIFACT_HANDOFF_CONFLICT", "another worker artifact publication is already pending");
      }
      publicationJournalActive = hasJournal;
      if (!hasJournal) {
        request.assertCurrent(state);
        try {
          validatePayload(request, submission, state);
        } catch (cause) {
          throw prePublicationArtifactError(request, cause);
        }
        ctx.flowManager.mutate((current) => {
          request.assertCurrent(current);
          current.workerArtifactPublication = journal.toJSON();
        }, {
          specId: request.specId,
          expectedOriginal: state,
          operationOwnerToken,
        });
        publicationJournalActive = true;
        state = ctx.flowManager.load(request.specId);
      }
      this.faultInjector({ phase: "after-worker-handoff-journal", stepId: request.stepId });
      validateSubmission(request, submission);
      publishJournal({ request, journal, faultInjector: this.faultInjector });
      this.faultInjector({ phase: "after-worker-handoff-publication", stepId: request.stepId });
      validateSubmission(request, submission);
      assertJournalPublished(request.mainRoot, state, journal);
      const active = findActiveNode(state);
      const step = findStepById(state.steps || [], request.stepId);
      const transition = new NormalStepTransition({
        stepId: request.stepId,
        currentStepId: active?.stepId,
        currentStatus: step?.status,
        requestedStatus: "done",
        lifecycleOwned: false,
      });
      const revision = revisionFor(request, journal, this.now);
      ctx.flowManager.updateStepStatus(
        transition,
        {
          specId: request.specId,
          taskId: null,
          expectedOriginal: state,
          operationOwnerToken,
        },
        new WorkerArtifactCompletionIntent({
          mainRoot: request.mainRoot,
          journal,
          revision,
          now: this.now,
        }),
      );
      this.faultInjector({ phase: "after-worker-handoff-transition", stepId: request.stepId });
      const completedState = ctx.flowManager.load(request.specId);
      const receipt = receiptForRequest(completedState, request);
      if (!receipt) {
        throw new WorkerArtifactHandoffError(
          "recovery-required",
          "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
          "completed worker artifact handoff has no canonical receipt",
          {
            data: {
              stepId: request.stepId,
              actionDigest: request.actionDigest,
              dispatchInvocationId: request.dispatchInvocationId,
              handoffDirectory: request.directory,
            },
          },
        );
      }
      cleanupCompletedHandoff(request.executionRoot, receipt, this.faultInjector);
      return {
        completed: true,
        replayed: false,
        stepId: request.stepId,
        handoffDigest: submission.handoffDigest,
        payloadDigest: manifestDigest(submission.payloadManifest),
      };
    } catch (cause) {
      if (cause instanceof WorkerArtifactHandoffError) {
        if (publicationJournalActive && cause.classification === "invalid") {
          throw publicationRecoveryError(request, cause);
        }
        throw cause;
      }
      throw new WorkerArtifactHandoffError(
        "recovery-required",
        "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
        `worker artifact publication requires recovery: ${cause.message}`,
        {
          cause,
          data: {
            stepId: request.stepId,
            actionDigest: request.actionDigest,
            handoffDirectory: request.directory,
          },
        },
      );
    } finally {
      operation.release();
    }
  }
}
