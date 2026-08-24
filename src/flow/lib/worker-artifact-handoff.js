import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { AtomicFile } from "../../lib/atomic-file.js";
import { PRODUCT } from "../../lib/product.js";
import { validateSpecJsonObject } from "../../lib/spec-json.js";
import {
  CanonicalFlowArtifactBaseline,
  CanonicalWorkerSpecPublication,
  CurrentAttemptIdentity,
} from "./current-flow-state.js";
import {
  captureRegularFile,
  sameFileIdentity,
} from "../../lib/regular-file-snapshot.js";
import { FlowVersionRuntimeLockLocation } from "../../lib/flow-version.js";
import { draftReviewRouteForStepId } from "./draft-review-routes.js";
import { findActiveNode, getFlowNode, PromoteDraftQuestionAndKeepRefineActive, resolveLifecyclePlan } from "../definition.js";
import { DraftLifecycle } from "./draft-lifecycle.js";
import { DraftTransitionFacts } from "./draft-transition-facts.js";
import { TaskStepIdentity } from "./task-step-identity.js";
import { findStepById } from "./step-tree.js";
import { validateTestHeaders, formatValidationMessages } from "./test-headers.js";
import { SpecTestBootstrapValidator } from "./spec-test-bootstrap-validator.js";
import {
  validateSpecRepairDocument,
  validateSpecTriageDocument,
} from "./spec-review-artifacts.js";
import {
  requiresWorkerArtifactHandoff,
  requiresWorkerSourceHandoff,
} from "./flow-artifact-authority.js";
import { canonicalPlanGateRepairForTarget } from "./plan-gate-repair.js";
import { canonicalTestReviewRepairForTarget } from "./test-review-repair.js";
import { DraftWorkerContextSnapshot } from "./worker-context-snapshot.js";
import {
  CanonicalWorkerArtifactAddress,
  CanonicalWorkerTestTree,
  mediaTypeForPath,
} from "./canonical-worker-artifacts.js";
import {
  CanonicalDraftReviewHandoffArtifact,
  CanonicalDraftReviewHandoffEvidence,
} from "./canonical-review-artifacts.js";
import { FlowRepositoryRuntimeArtifactRegistry } from "./flow-repository-runtime-artifacts.js";
import { validateAdditions } from "./overview-merge.js";
import { AcceptanceRepairFindingSet } from "./acceptance-review-artifacts.js";
import { validateUpgradeResultArtifact } from "./upgrade-result-artifact.js";

export const WORKER_ARTIFACT_HANDOFF_REQUEST_ENV = PRODUCT.env("FLOW_HANDOFF_REQUEST");
export const WORKER_ARTIFACT_HANDOFF_VERSION = 3;
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
const FLOW_REPOSITORY_RUNTIME_ARTIFACTS = new FlowRepositoryRuntimeArtifactRegistry();
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

export class WorkerArtifactHandoffError extends Error {
  constructor(classification, code, message, {
    cause = null,
    data = {},
    retryable = false,
    recoveryPossible = classification === "recovery-required",
  } = {}) {
    if (!["missing", "invalid", "stale", "conflict", "recovery-required"].includes(classification)) {
      throw new Error(`invalid worker artifact handoff classification: ${classification}`);
    }
    if (typeof retryable !== "boolean") throw new Error("worker artifact handoff retryable must be boolean");
    if (typeof recoveryPossible !== "boolean") throw new Error("worker artifact handoff recoveryPossible must be boolean");
    super(message, cause ? { cause } : undefined);
    this.name = "WorkerArtifactHandoffError";
    this.classification = classification;
    this.code = requiredString(code, "worker artifact handoff error code");
    this.recoveryPossible = recoveryPossible;
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
  constructor({ stepId, inputs, repairInputs = {}, testReviewRepairInputs = [], acceptanceRepairInputs = [] }) {
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
    this.acceptanceRepairInputs = Object.freeze(acceptanceRepairInputs.map((entry) => (
      normalizedRelativePath(entry, `${this.stepId}.acceptanceRepair.input`)
    )));
    if (this.acceptanceRepairInputs.length > 0 && this.stepId !== "impl-triage") {
      throw new Error("acceptance repair inputs may only belong to the implementation triage handoff");
    }
    this.allowedSignatures = Object.freeze([
      this.inputs,
      ...Object.values(variants),
      ...(this.testReviewRepairInputs.length > 0 ? [this.testReviewRepairInputs] : []),
      ...(this.acceptanceRepairInputs.length > 0 ? [this.acceptanceRepairInputs] : []),
    ].map((paths) => paths.join("\u0000")));
    if (new Set(this.allowedSignatures).size !== this.allowedSignatures.length) {
      throw new Error(`duplicate worker artifact input contract for ${this.stepId}`);
    }
    Object.freeze(this);
  }

  resolve({ planGateRepair = null, testReviewRepair = null, acceptanceRepairRoute = null } = {}) {
    if (acceptanceRepairRoute !== null) return this.acceptanceRepairInputs;
    if (testReviewRepair) return this.testReviewRepairInputs;
    return planGateRepair ? (this.repairInputs[planGateRepair.phase] || this.inputs) : this.inputs;
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
    acceptanceRepairInputs = [],
    payloads,
    revisionKind = null,
    kind = "artifact",
  }) {
    this.stepId = requiredString(stepId, "worker artifact policy stepId");
    if (!new Set(["artifact", "source"]).has(kind)) throw new Error(`invalid worker handoff kind: ${kind}`);
    if (kind === "artifact" && !requiresWorkerArtifactHandoff(this.stepId)) {
      throw new Error(`worker artifact policy is not declared by the authority matrix: ${this.stepId}`);
    }
    if (kind === "source" && !requiresWorkerSourceHandoff(this.stepId)) {
      throw new Error(`worker source policy is not declared by the authority matrix: ${this.stepId}`);
    }
    this.kind = kind;
    this.inputContract = new WorkerArtifactInputContract({
      stepId: this.stepId,
      inputs,
      repairInputs,
      testReviewRepairInputs,
      acceptanceRepairInputs,
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
  new WorkerArtifactHandoffPolicy({
    stepId: "implement",
    inputs: ["spec.json"],
    payloads: [
      { logicalName: "effects.json", targetRelativePath: "effects.json" },
      { logicalName: "upgrade.result", targetRelativePath: "upgrade-result.json", required: false },
    ],
    kind: "source",
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "impl-triage",
    inputs: ["spec.json", "impl-review.json"],
    acceptanceRepairInputs: ["spec.json", "acceptance-review.json"],
    payloads: [
      { logicalName: "effects.json", targetRelativePath: "effects.json" },
      { logicalName: "upgrade.result", targetRelativePath: "upgrade-result.json", required: false },
    ],
    kind: "source",
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "impl-repair",
    inputs: ["spec.json", "impl-review.json", "impl-triage.json"],
    payloads: [
      { logicalName: "effects.json", targetRelativePath: "effects.json" },
      { logicalName: "upgrade.result", targetRelativePath: "upgrade-result.json", required: false },
    ],
    kind: "source",
  }),
  new WorkerArtifactHandoffPolicy({
    stepId: "task-impl",
    inputs: [],
    payloads: [
      { logicalName: "effects.json", targetRelativePath: "effects.json" },
      { logicalName: "upgrade.result", targetRelativePath: "upgrade-result.json", required: false },
    ],
    kind: "source",
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

/**
 * The only worker-to-parent control surface for a source-producing leaf.
 * Source edits stay in the execution checkout; this sealed document merely
 * declares the catalog effects the parent may commit with completion.
 */
export class SourceRequirementEffect {
  constructor({ reference, status } = {}) {
    this.reference = requiredString(reference, "source worker requirement reference");
    this.status = requiredString(status, "source worker requirement status");
    if (this.status !== "done") throw new Error("source worker requirement status must be done");
    Object.freeze(this);
  }
  toJSON() { return { reference: this.reference, status: this.status }; }
}

export class SourceFileEffect {
  constructor({ requirementId, paths } = {}) {
    this.requirementId = requiredString(requirementId, "source worker file requirementId");
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PAYLOAD_FILES) {
      throw new Error("source worker file paths must be a bounded non-empty array");
    }
    this.paths = Object.freeze(paths.map((candidate) => normalizedRelativePath(candidate, "source worker file path")));
    Object.freeze(this);
  }
  toJSON() { return { requirementId: this.requirementId, paths: [...this.paths] }; }
}

export class SourceIssueEffect {
  constructor({ reason, trigger = null, resolution = null } = {}) {
    this.reason = requiredString(reason, "source worker issue reason");
    if (this.reason.length < 20) throw new Error("source worker issue reason must be at least 20 characters");
    for (const [name, value] of [["trigger", trigger], ["resolution", resolution]]) {
      if (value !== null && (typeof value !== "string" || value.trim().length < 10)) {
        throw new Error(`source worker issue ${name} must be null or at least 10 characters`);
      }
    }
    this.trigger = trigger;
    this.resolution = resolution;
    Object.freeze(this);
  }
  toJSON() { return { reason: this.reason, trigger: this.trigger, resolution: this.resolution }; }
}

export class SourceOverviewEffect {
  constructor(additions) {
    const errors = validateAdditions(additions);
    if (errors.length > 0) throw new Error(`invalid source worker overview additions: ${errors.join("; ")}`);
    this.additions = Object.freeze({
      modules: Object.freeze([...additions.modules]),
      data_flow: Object.freeze([...additions.data_flow]),
      decisions: Object.freeze([...additions.decisions]),
    });
    Object.freeze(this);
  }
  toJSON() { return { ...this.additions, modules: [...this.additions.modules], data_flow: [...this.additions.data_flow], decisions: [...this.additions.decisions] }; }
}

export class SourceTriageDisposition {
  constructor({ findingKey, disposition, rationale } = {}) {
    this.findingKey = requiredString(findingKey, "source triage findingKey");
    this.disposition = requiredString(disposition, "source triage disposition");
    if (!new Set(["apply", "reject"]).has(this.disposition)) throw new Error("source triage disposition is invalid");
    this.rationale = requiredString(rationale, "source triage rationale");
    if (this.rationale.length < 10) throw new Error("source triage rationale must be at least 10 characters");
    Object.freeze(this);
  }
  toJSON() { return { findingKey: this.findingKey, disposition: this.disposition, rationale: this.rationale }; }
}

export class SourceTriageEffect {
  constructor({ dispositions } = {}) {
    if (!Array.isArray(dispositions) || dispositions.length > MAX_PAYLOAD_FILES) throw new Error("source triage dispositions are invalid");
    this.dispositions = Object.freeze(dispositions.map((entry) => {
      exactObjectKeys(entry, ["findingKey", "disposition", "rationale"], "source triage disposition");
      return new SourceTriageDisposition(entry);
    }));
    if (new Set(this.dispositions.map((entry) => entry.findingKey)).size !== this.dispositions.length) {
      throw new Error("source triage dispositions must not duplicate findingKey");
    }
    Object.freeze(this);
  }
  toJSON() { return { version: 1, dispositions: this.dispositions.map((entry) => entry.toJSON()) }; }
}

export class SourceRepairEffect {
  constructor({ appliedFindingKeys, summary } = {}) {
    if (!Array.isArray(appliedFindingKeys) || appliedFindingKeys.length === 0 || appliedFindingKeys.length > MAX_PAYLOAD_FILES) {
      throw new Error("source repair appliedFindingKeys are invalid");
    }
    this.appliedFindingKeys = Object.freeze(appliedFindingKeys.map((value) => requiredString(value, "source repair findingKey")));
    if (new Set(this.appliedFindingKeys).size !== this.appliedFindingKeys.length) throw new Error("source repair findings must not duplicate");
    this.summary = requiredString(summary, "source repair summary");
    if (this.summary.length < 10) throw new Error("source repair summary must be at least 10 characters");
    Object.freeze(this);
  }
  toJSON() { return { version: 1, appliedFindingKeys: [...this.appliedFindingKeys], summary: this.summary }; }
}

export class SourceWorkerEffect {
  constructor({ version, stepId, completionStatus, requirements = [], files = [], issues = [], overview = null, triage = null, repair = null } = {}) {
    if (version !== 1) throw new Error("source worker effect version must be 1");
    this.version = 1;
    this.stepId = requiredString(stepId, "source worker effect stepId");
    if (!requiresWorkerSourceHandoff(this.stepId)) throw new Error(`source worker effect step is not source-owned: ${this.stepId}`);
    this.completionStatus = requiredString(completionStatus, "source worker completionStatus");
    if (!new Set(["done", "skipped"]).has(this.completionStatus)) throw new Error("source worker completionStatus is invalid");
    if (this.completionStatus === "skipped" && this.stepId !== "implement") {
      throw new Error("only implement may report a skipped source completion");
    }
    if (!Array.isArray(requirements) || !Array.isArray(files) || !Array.isArray(issues)) {
      throw new Error("source worker effect collections must be arrays");
    }
    this.requirements = Object.freeze(requirements.map((entry) => {
      exactObjectKeys(entry, ["reference", "status"], "source worker requirement effect");
      return new SourceRequirementEffect(entry);
    }));
    this.files = Object.freeze(files.map((entry) => {
      exactObjectKeys(entry, ["requirementId", "paths"], "source worker file effect");
      return new SourceFileEffect(entry);
    }));
    this.issues = Object.freeze(issues.map((entry) => {
      exactObjectKeys(entry, ["reason", "trigger", "resolution"], "source worker issue effect");
      return new SourceIssueEffect(entry);
    }));
    if (this.stepId === "task-impl" && overview === null) throw new Error("task-impl source effect requires overview additions");
    if (this.stepId !== "task-impl" && overview !== null) throw new Error("only task-impl may submit overview additions");
    this.overview = overview === null ? null : new SourceOverviewEffect(overview);
    if ((this.stepId === "impl-triage") !== (triage !== null)) throw new Error("source triage effect is required only for impl-triage");
    if ((this.stepId === "impl-repair") !== (repair !== null)) throw new Error("source repair effect is required only for impl-repair");
    this.triage = triage === null ? null : new SourceTriageEffect(triage);
    this.repair = repair === null ? null : new SourceRepairEffect(repair);
    if (this.stepId === "impl-triage" && (this.requirements.length > 0 || this.files.length > 0 || this.issues.length > 0 || this.overview !== null || this.repair !== null)) {
      throw new Error("impl-triage source effect may contain only typed triage dispositions");
    }
    if (this.stepId === "impl-repair" && (this.requirements.length > 0 || this.overview !== null || this.triage !== null)) {
      throw new Error("impl-repair source effect may contain source files, issues, and one typed repair only");
    }
    Object.freeze(this);
  }

  static fromDocument(value, expectedStepId) {
    exactObjectKeys(value, ["version", "stepId", "completionStatus", "requirements", "files", "issues", "overview", "triage", "repair"], "source worker effect");
    const effect = new SourceWorkerEffect(value);
    if (effect.stepId !== expectedStepId) throw new Error("source worker effect step does not match the handoff");
    return effect;
  }

  toJSON() {
    return {
      version: this.version,
      stepId: this.stepId,
      completionStatus: this.completionStatus,
      requirements: this.requirements.map((entry) => entry.toJSON()),
      files: this.files.map((entry) => entry.toJSON()),
      issues: this.issues.map((entry) => entry.toJSON()),
      overview: this.overview?.toJSON() ?? null,
      triage: this.triage?.toJSON() ?? null,
      repair: this.repair?.toJSON() ?? null,
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

/**
 * Resolve a stable worker protocol filename through the Version Store.
 * `workerPath` remains part of the agent handoff contract; it is never a
 * filesystem authority.  The Store verifies catalog hash and consumer
 * ownership before this boundary parses the established JSON document.
 */
function canonicalHandoffInputSnapshot({ flowManager, state, workerPath, consumerNodeId, label }) {
  const address = CanonicalWorkerArtifactAddress.from(workerPath);
  const input = address.read({
    flowManager,
    specId: state.specId,
    consumerNodeId,
  });
  return Object.freeze({
    document: input.jsonDocument(label),
    snapshot: input.snapshot(),
  });
}

function canonicalIssueSnapshotText({ flowManager, state }) {
  if (state.issue == null) return null;
  return CanonicalWorkerArtifactAddress.from("issue.md").read({
    flowManager,
    specId: state.specId,
    consumerNodeId: "draft",
  }).text("linked Issue context");
}

function canonicalPayloadBaseline({ flowManager, state, rule }) {
  if (rule.logicalName === "effects.json") return null;
  if (rule.kind === "tree") {
    const snapshot = CanonicalWorkerTestTree.catalogSnapshot({ flowManager, specId: state.specId });
    return Object.freeze({
      digest: digest(stableStringify(snapshot.entries)),
      byteLength: snapshot.entries.reduce((total, entry) => total + entry.byteLength, 0),
      entries: snapshot.entries,
    });
  }
  return CanonicalWorkerArtifactAddress.from(rule.targetRelativePath)
    .catalogSnapshot({ flowManager, specId: state.specId });
}

function executionHandoffRoot(executionRoot, specId) {
  if (typeof executionRoot !== "string" || !path.isAbsolute(executionRoot)) {
    throw new Error("worker handoff requires an absolute execution root");
  }
  return path.resolve(
    executionRoot,
    WORKER_ARTIFACT_HANDOFF_ROOT,
    digest(requiredString(specId, "handoff specId")).slice(0, 24),
  );
}

function handoffActionDirectory(handoffRoot, runId, dispatchInvocationId, actionDigest) {
  return path.resolve(
    handoffRoot,
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

function isWorkerRuntimePath(relativePath, runtimeLocks = []) {
  const segments = relativePath.split("/");
  if (segments.includes(".git") || segments.includes(".tmp")) return true;
  return FLOW_REPOSITORY_RUNTIME_ARTIFACTS.owns(relativePath, { runtimeLocks });
}

/**
 * Resolve the one worker-owned transient subtree relative to a repository
 * authority root. Only this exact guarded handoff directory is excluded from
 * the repository snapshot.
 */
function authorityIgnoredDirectories(directories = []) {
  if (!Array.isArray(directories)) throw new Error("worker authority ignored directories must be an array");
  const normalized = directories.flatMap((directory) => {
    if (typeof directory !== "string" || directory === "") {
      throw authoritySnapshotError("worker authority ignored directory is invalid");
    }
    const relativePath = directory.split(path.sep).join("/");
    if (
      path.posix.isAbsolute(relativePath)
      ||
      path.posix.normalize(relativePath) !== relativePath
      || relativePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    ) {
      throw authoritySnapshotError("worker authority ignored directory escapes its repository");
    }
    return [relativePath];
  });
  return Object.freeze([...new Set(normalized)].sort((left, right) => left.localeCompare(right)));
}

function authorityRuntimeLocks(runtimeLocks = []) {
  if (!Array.isArray(runtimeLocks) || runtimeLocks.some((lock) => !(lock instanceof FlowVersionRuntimeLockLocation))) {
    throw authoritySnapshotError("worker authority runtime locks must be typed Version lock locations");
  }
  return Object.freeze([...new Set(runtimeLocks)]);
}

function isIgnoredAuthorityPath(relativePath, ignoredDirectories, runtimeLocks = []) {
  if (isWorkerRuntimePath(relativePath, runtimeLocks)) return true;
  return ignoredDirectories.some((directory) => (
    relativePath === directory || relativePath.startsWith(`${directory}/`)
  ));
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

function filteredIndexDigest(bytes, ignoredDirectories, runtimeLocks) {
  const hash = crypto.createHash("sha256");
  for (const record of bytes.toString("utf8").split("\u0000").filter(Boolean)) {
    const separator = record.indexOf("\t");
    if (separator === -1) {
      throw authoritySnapshotError("worker artifact authority received malformed Git index data");
    }
    const relativePath = record.slice(separator + 1);
    if (!isIgnoredAuthorityPath(relativePath, ignoredDirectories, runtimeLocks)) hash.update(record).update("\u0000");
  }
  return hash.digest("hex");
}

function gitAuthoritySnapshot(root, { ignoredDirectories = [], runtimeLocks = [] } = {}) {
  const head = boundedGitOutput(root, ["rev-parse", "HEAD"], "Git HEAD").toString("utf8").trim();
  const indexDigest = filteredIndexDigest(
    boundedGitOutput(root, ["ls-files", "--stage", "-z"], "Git index"),
    ignoredDirectories,
    runtimeLocks,
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
    .filter((relativePath) => !isIgnoredAuthorityPath(relativePath, ignoredDirectories, runtimeLocks))
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

function filesystemAuthoritySnapshot(root, { ignoredDirectories = [], runtimeLocks = [] } = {}) {
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
        if (isIgnoredAuthorityPath(relativePath, ignoredDirectories, runtimeLocks)) continue;
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
  constructor({ root, authorities, ignoredDirectories = [], runtimeLocks = [], mode, head, indexDigest, entries }) {
    this.root = path.resolve(root);
    this.authorities = Object.freeze(authorities.map((entry) => requiredString(
      entry,
      "worker artifact repository authority",
    )));
    this.ignoredDirectories = authorityIgnoredDirectories(ignoredDirectories);
    this.runtimeLocks = authorityRuntimeLocks(runtimeLocks);
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

  static capture({ root, authorities, ignoredDirectories = [], runtimeLocks = [] }) {
    try {
      const ignored = authorityIgnoredDirectories(ignoredDirectories);
      const locks = authorityRuntimeLocks(runtimeLocks);
      const snapshot = exactGitRoot(root)
        ? gitAuthoritySnapshot(root, { ignoredDirectories: ignored, runtimeLocks: locks })
        : filesystemAuthoritySnapshot(root, { ignoredDirectories: ignored, runtimeLocks: locks });
      return new WorkerArtifactRepositoryMutationSnapshot({
        root,
        authorities,
        ignoredDirectories: ignored,
        runtimeLocks: locks,
        ...snapshot,
      });
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
    return this.allChangedPaths(current).slice(0, 20);
  }

  allChangedPaths(current) {
    const changed = [];
    if (this.head !== current.head) changed.push("<HEAD>");
    if (this.indexDigest !== current.indexDigest) changed.push("<index>");
    const before = new Map(this.entries.map((entry) => [entry.path, stableStringify(entry.toJSON())]));
    const after = new Map(current.entries.map((entry) => [entry.path, stableStringify(entry.toJSON())]));
    for (const relativePath of new Set([...before.keys(), ...after.keys()])) {
      if (before.get(relativePath) !== after.get(relativePath)) changed.push(relativePath);
    }
    return changed;
  }
}

export class WorkerArtifactMutationAuthoritySnapshot {
  constructor({ specId, repositories, sourceMode = false }) {
    this.specId = requiredString(specId, "worker artifact mutation authority specId");
    this.repositories = Object.freeze(repositories);
    this.sourceMode = sourceMode === true;
    Object.freeze(this);
  }

  static capture(request) {
    if (!(request instanceof WorkerArtifactHandoffRequest)) {
      throw new Error("worker mutation authority requires a handoff request");
    }
    const roots = new Map();
    try {
      const isolatedCanonicalScope = request.policy.kind === "source"
        || fs.realpathSync(request.executionRoot) !== fs.realpathSync(request.mainRoot);
      const canonicalRoot = isolatedCanonicalScope
        ? request.canonicalDirectory
        : request.mainRoot;
      for (const [authority, root] of [
        ["execution", request.executionRoot],
        // Source and worktree handoffs isolate canonical authority to their
        // active Version. Direct artifact handoffs retain the full checkout
        // snapshot because they do not have source authority.
        ["canonical", canonicalRoot],
      ]) {
        const resolved = fs.realpathSync(path.resolve(root));
        const existing = roots.get(resolved) || {
          authorities: [], ignoredDirectories: [], runtimeLocks: [],
        };
        existing.authorities.push(authority);
        for (const lock of request.runtimeLocks) {
          if (isWithin(resolved, fs.realpathSync(lock.directory))) existing.runtimeLocks.push(lock);
        }
        const relativeHandoff = path.relative(resolved, path.resolve(request.directory))
          .split(path.sep)
          .join("/");
        if (
          relativeHandoff !== ""
          && relativeHandoff !== ".."
          && !relativeHandoff.startsWith("../")
          && !path.posix.isAbsolute(relativeHandoff)
        ) existing.ignoredDirectories.push(relativeHandoff);
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
      sourceMode: request.policy.kind === "source",
      repositories: [...roots].map(([root, scope]) => (
        WorkerArtifactRepositoryMutationSnapshot.capture({
          root,
          authorities: scope.authorities,
          ignoredDirectories: scope.ignoredDirectories,
          runtimeLocks: scope.runtimeLocks,
        })
      )),
    });
  }

  assertUnchanged() {
    for (const captured of this.repositories) {
      if (this.sourceMode && captured.authorities.includes("execution")) continue;
      const current = WorkerArtifactRepositoryMutationSnapshot.capture({
        root: captured.root,
        authorities: captured.authorities,
        ignoredDirectories: captured.ignoredDirectories,
        runtimeLocks: captured.runtimeLocks,
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

  assertSourceDiff({ stepId, completionStatus, effect }) {
    if (!this.sourceMode) return Object.freeze([]);
    const changes = [];
    for (const captured of this.repositories) {
      if (!captured.authorities.includes("execution")) continue;
      const current = WorkerArtifactRepositoryMutationSnapshot.capture({
        root: captured.root,
        authorities: captured.authorities,
        ignoredDirectories: captured.ignoredDirectories,
        runtimeLocks: captured.runtimeLocks,
      });
      const changed = captured.allChangedPaths(current);
      if (changed.includes("<HEAD>") || changed.includes("<index>")) {
        throw new WorkerArtifactHandoffError(
          "invalid",
          "FLOW_SOURCE_HANDOFF_FINALIZE_AUTHORITY_VIOLATION",
          "source worker must not commit or stage repository changes",
          { retryable: false, data: { stepId, changedPaths: changed.slice(0, 20) } },
        );
      }
      changes.push(...changed);
    }
    const unique = [...new Set(changes)].sort();
    const forbidden = unique.filter((entry) => entry.startsWith(".sennel/") || entry.startsWith("specs/"));
    if (forbidden.length > 0) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_SOURCE_HANDOFF_CANONICAL_PATH_VIOLATION",
        "source worker changed a canonical or runtime path",
        { retryable: false, data: { stepId, changedPaths: forbidden.slice(0, 20) } },
      );
    }
    const declared = new Set(effect.files.flatMap((entry) => entry.paths));
    const undeclared = [...declared].filter((entry) => !unique.includes(entry));
    if (undeclared.length > 0) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_SOURCE_HANDOFF_EFFECT_PATH_INVALID",
        "source worker effect declares paths absent from the validated source diff",
        { retryable: false, data: { stepId, paths: undeclared.slice(0, 20) } },
      );
    }
    const noSourceDiff = stepId === "impl-triage" || (stepId === "implement" && completionStatus === "skipped");
    if (noSourceDiff && unique.length > 0) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_SOURCE_HANDOFF_DIFF_FORBIDDEN",
        `source handoff ${stepId} with ${completionStatus} must not change source files`,
        { retryable: false, data: { stepId, changedPaths: unique.slice(0, 20) } },
      );
    }
    if (completionStatus === "skipped" && (effect.requirements.length > 0 || effect.files.length > 0)) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_SOURCE_HANDOFF_SKIP_EFFECT_INVALID",
        "skipped implementation may report issues but cannot report requirements or file-map effects",
        { retryable: false, data: { stepId } },
      );
    }
    const required = completionStatus === "done" && new Set(["implement", "impl-repair", "task-impl"]).has(stepId);
    if (required && unique.length === 0) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_SOURCE_HANDOFF_DIFF_REQUIRED",
        `source handoff ${stepId} requires a source diff before completion`,
        { retryable: false, data: { stepId } },
      );
    }
    const missingEffects = required ? unique.filter((entry) => !declared.has(entry)) : [];
    if (missingEffects.length > 0) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_SOURCE_HANDOFF_EFFECT_INCOMPLETE",
        "source worker effect must declare every validated changed source path",
        { retryable: false, data: { stepId, paths: missingEffects.slice(0, 20) } },
      );
    }
    return Object.freeze(unique);
  }
}

function inputRevision(inputDigest, {
  attempt,
  planGateRepair = null,
  testReviewRepair = null,
  acceptanceRepairRoute = null,
} = {}) {
  const baseRevision = digest(stableStringify({
    inputDigest,
    attempt: CurrentAttemptIdentity.from(attempt).toJSON(),
  }));
  if (acceptanceRepairRoute !== null) {
    return digest(stableStringify({ baseRevision, acceptanceRepairRoute: acceptanceRepairRoute.toJSON() }));
  }
  if (testReviewRepair) {
    return digest(stableStringify({
      baseRevision,
      testReviewRepair: testReviewRepair.toJSON(),
    }));
  }
  if (!planGateRepair) return baseRevision;
  return digest(stableStringify({
    baseRevision,
    planGateRepair: planGateRepair.toJSON(),
  }));
}

function currentPlanGateRepair({ flowManager, state, stepId }) {
  return canonicalPlanGateRepairForTarget({ flowManager, state, targetStepId: stepId });
}

function canonicalAttempt({ flowManager, state }) {
  const canonical = typeof flowManager.canonicalState === "function"
    ? flowManager.canonicalState(state.specId)
    : state;
  if (canonical?.attempt == null || canonical.attempt.failure !== null) {
    throw new Error("worker handoff requires an active unfailed Attempt");
  }
  return canonical.attempt;
}

function currentTestReviewRepair({ flowManager, state, stepId }) {
  return canonicalTestReviewRepairForTarget({ flowManager, state, targetStepId: stepId });
}

/** Immutable binding for the dedicated acceptance-review implementation-repair route. */
class AcceptanceImplementationRepairRoute {
  constructor({ activityId, acceptanceDigest, attemptId, sequence }) {
    this.activityId = requiredString(activityId, "acceptance repair Activity id");
    this.acceptanceDigest = requiredDigest(acceptanceDigest, "acceptance repair artifact digest");
    this.attemptId = requiredString(attemptId, "acceptance repair impl-triage Attempt id");
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("acceptance repair impl-triage Attempt sequence is invalid");
    this.sequence = sequence;
    Object.freeze(this);
  }
  toJSON() {
    return {
      activityId: this.activityId,
      acceptanceDigest: this.acceptanceDigest,
      attemptId: this.attemptId,
      sequence: this.sequence,
    };
  }
}

function currentAcceptanceImplementationRepair({ flowManager, state, stepId }) {
  const canonicalState = typeof flowManager.canonicalState === "function"
    ? flowManager.canonicalState(state.specId)
    : state;
  if (stepId !== "impl-triage" || canonicalState?.current?.at(-1) !== "impl-triage" || canonicalState.attempt === null) return null;
  const attempt = canonicalState.attempt;
  const entry = flowManager.activityLedger(state.specId).findLast((activity) => (
    activity.transition?.operation === "repair_acceptance_review"
    && activity.nodeId === "acceptance-review"
    && activity.transition?.attempt?.nodeId === "impl-triage"
    && activity.transition.attempt.id === attempt.id
    && activity.transition.attempt.sequence === attempt.sequence
  ));
  if (entry === undefined) return null;
  const reference = entry.references?.artifacts?.find((candidate) => candidate.label === "acceptance.review") ?? null;
  if (reference === null) throw new WorkerArtifactHandoffError(
    "invalid", "FLOW_ACCEPTANCE_REPAIR_ROUTE_INVALID", "acceptance repair Activity lacks its canonical acceptance.review reference",
  );
  const artifact = flowManager.readArtifact({
    specId: state.specId, logicalKey: "acceptance.review", consumerNodeId: "impl-triage",
  });
  if (artifact.descriptor.hash !== reference.id) throw new WorkerArtifactHandoffError(
    "stale", "FLOW_ACCEPTANCE_REPAIR_ROUTE_STALE", "acceptance repair Activity does not bind the current canonical acceptance.review artifact",
  );
  return new AcceptanceImplementationRepairRoute({
    activityId: entry.id, acceptanceDigest: reference.id, attemptId: attempt.id, sequence: attempt.sequence,
  });
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
    canonicalLocation = null,
    flowManager = null,
  }) {
    this.mainRoot = path.resolve(mainRoot);
    this.executionRoot = path.resolve(executionRoot);
    this.state = state;
    if (state?.schemaRevision !== 3) {
      throw new Error("worker handoff requires a Version-1 Flow state");
    }
    if (!flowManager || typeof flowManager.readArtifact !== "function") {
      throw new Error("canonical worker handoff requires a Version Store catalog reader");
    }
    this.flowManager = flowManager;
    this.policy = policy;
    this.version = WORKER_ARTIFACT_HANDOFF_VERSION;
    this.runId = requiredString(state.runId, "handoff runId");
    this.specId = requiredString(state.specId, "handoff specId");
    this.issue = state.issue ?? null;
    this.stepId = policy.stepId;
    this.taskId = invocation.action.nextAction?.taskId ?? null;
    if ((this.stepId === "task-impl") !== (typeof this.taskId === "string" && this.taskId.trim() !== "")) {
      throw new Error("task-impl worker handoff requires exactly one taskId");
    }
    this.actionDigest = requiredDigest(invocation.action.digest, "handoff actionDigest");
    this.dispatchInvocationId = requiredString(invocation.id, "handoff dispatchInvocationId");
    this.targetAuthority = policy.kind === "source"
      ? "execution-checkout"
      : "canonical-flow-artifacts";
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
    this.handoffRoot = executionHandoffRoot(this.executionRoot, this.specId);
    if (typeof canonicalLocation?.runtimeLock !== "function") {
      throw new Error("canonical worker handoff requires Version runtime lock locations");
    }
    this.canonicalDirectory = canonicalLocation.directory;
    this.runtimeLocks = Object.freeze([
      canonicalLocation.runtimeLock("runtime.lock.artifact-catalog"),
      canonicalLocation.runtimeLock("runtime.lock.current-flow-state"),
    ]);
    const actionDirectory = handoffActionDirectory(
      this.handoffRoot,
      this.runId,
      this.dispatchInvocationId,
      this.actionDigest,
    );
    this.directory = path.resolve(actionDirectory);
    this.payloadDirectory = path.join(this.directory, "payload");
    this.requestPath = path.join(this.directory, "request.json");
    this.submissionPath = path.join(this.directory, "handoff.json");
    this.quarantinePath = path.join(this.directory, "quarantine.json");
    if (!isWithin(this.handoffRoot, this.directory)) throw new Error("handoff directory escapes its runtime authority");
    Object.freeze(this);
  }

  static create({ mainRoot, executionRoot, state, invocation, flowManager = null, now = () => new Date() }) {
    const policy = workerArtifactHandoffPolicy(invocation?.action?.nextAction?.step);
    if (!policy) return null;
    if (state?.schemaRevision !== 3) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_ARTIFACT_HANDOFF_INVALID",
        "worker handoff requires a Version-1 Flow state",
      );
    }
    if (!flowManager || typeof flowManager.readArtifact !== "function" || typeof flowManager.specLocation !== "function") {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_ARTIFACT_HANDOFF_INVALID",
        "canonical worker handoff requires the Version Store catalog reader",
      );
    }
    const planGateRepair = currentPlanGateRepair({ flowManager, state, stepId: policy.stepId });
    const testReviewRepair = currentTestReviewRepair({ flowManager, state, stepId: policy.stepId });
    const acceptanceRepairRoute = currentAcceptanceImplementationRepair({ flowManager, state, stepId: policy.stepId });
    const inputs = policy.inputContract.resolve({ planGateRepair, testReviewRepair, acceptanceRepairRoute }).map((relativePath) => {
      const { document, snapshot } = canonicalHandoffInputSnapshot({
        flowManager,
        state,
        workerPath: relativePath,
        consumerNodeId: policy.stepId,
        label: `canonical handoff input ${relativePath}`,
      });
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
          executionRoot,
          state,
          invocation,
          issueText: canonicalIssueSnapshotText({ flowManager, state }),
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
      const baseline = canonicalPayloadBaseline({ flowManager, state, rule });
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
      inputRevision: inputRevision(inputDigestValue, {
        attempt: canonicalAttempt({ flowManager, state }),
        planGateRepair,
        testReviewRepair,
        acceptanceRepairRoute,
      }),
      generatedAt: now().toISOString(),
      canonicalLocation: flowManager.specLocation(state.specId),
      flowManager,
    });
  }

  static restore({ mainRoot, state, journal, flowManager = null, canonicalLocation = null }) {
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
      canonicalLocation,
      flowManager,
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
      : path.join(this.payloadDirectory, payload.rule.targetRelativePath);
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      issue: this.issue,
      stepId: this.stepId,
      taskId: this.taskId,
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
    // The handoff is an uncommitted work unit, not a Flow artifact. Keep it
    // inside the execution checkout that the worker is allowed to mutate.
    ensureRealDirectory(this.handoffRoot, this.executionRoot);
    ensureRealDirectory(this.directory, this.handoffRoot);
    ensureRealDirectory(this.payloadDirectory, this.handoffRoot);
    for (const payload of this.payloads) {
      if (payload.rule.kind === "tree") {
        ensureRealDirectory(this.payloadPath(payload.rule.logicalName), this.handoffRoot);
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
      taskId: this.taskId,
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
      effectContract: this.sourceEffectContract(),
      sealCommand: "sennel flow run seal-handoff",
      completionOwner: "parent-dispatcher",
    };
  }

  sourceEffectContract() {
    if (this.policy.kind !== "source") return null;
    const diffRequired = this.stepId === "impl-repair" || this.stepId === "task-impl" || this.stepId === "implement";
    const acceptanceRepairRoute = this.stepId === "impl-triage"
      && this.inputs.some((input) => input.name === "acceptance-review.json");
    return Object.freeze({
      path: this.payloadPath("effects.json"),
      exactKeys: Object.freeze(["version", "stepId", "completionStatus", "requirements", "files", "issues", "overview", "triage", "repair"]),
      required: Object.freeze({
        version: 1,
        stepId: this.stepId,
        completionStatus: this.stepId === "implement" ? ["done", "skipped"] : ["done"],
        overview: this.stepId === "task-impl" ? "required additions object" : "must be null",
        triage: this.stepId === "impl-triage" ? "required { dispositions:[{ findingKey, disposition:apply|reject, rationale }] }" : "must be null",
        repair: this.stepId === "impl-repair" ? "required { appliedFindingKeys:[...], summary }" : "must be null",
        sourceDiff: diffRequired ? "required for done; every changed source path must occur in files[].paths" : "optional",
        triageRoute: this.stepId !== "impl-triage" ? null : acceptanceRepairRoute
          ? "acceptance repair: classify every requirement:<id> and hard-blocker:<findingId> as apply"
          : "implementation review: classify every canonical review finding exactly once",
      }),
      example: Object.freeze({
        version: 1,
        stepId: this.stepId,
        completionStatus: "done",
        requirements: [],
        files: [],
        issues: [],
        overview: this.stepId === "task-impl" ? { modules: [], data_flow: [], decisions: [] } : null,
        triage: this.stepId === "impl-triage" ? { dispositions: [] } : null,
        repair: this.stepId === "impl-repair" ? { appliedFindingKeys: ["finding-key"], summary: "Applied the reviewed source correction." } : null,
      }),
    });
  }

  executionEnvironment() {
    return { [WORKER_ARTIFACT_HANDOFF_REQUEST_ENV]: this.requestPath };
  }

  assertCurrent(state) {
    const taskIdentity = TaskStepIdentity.active(state);
    const active = taskIdentity === null
      ? findActiveNode(state)
      : { scope: "task", taskId: taskIdentity.taskId, stepId: taskIdentity.definitionId };
    if (
      state?.runId !== this.runId
      || state?.specId !== this.specId
      || (state?.issue ?? null) !== this.issue
      || active?.stepId !== this.stepId
      || active?.taskId !== this.taskId
    ) {
      throw new WorkerArtifactHandoffError(
        "stale",
        "FLOW_ARTIFACT_HANDOFF_STALE",
        "worker artifact handoff no longer matches the active Flow target or step",
      );
    }
    let currentAttempt;
    try {
      currentAttempt = canonicalAttempt({ flowManager: this.flowManager, state });
    } catch (cause) {
      throw new WorkerArtifactHandoffError(
        "stale",
        "FLOW_ARTIFACT_HANDOFF_STALE",
        `worker artifact handoff no longer matches an active Attempt: ${cause.message}`,
        { cause },
      );
    }
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
        const currentContext = DraftWorkerContextSnapshot.materialize({
          executionRoot: this.executionRoot,
          state,
          invocation: {
            id: this.dispatchInvocationId,
            action: { digest: this.actionDigest },
            target: { digest: this.contextSnapshot.binding.targetDigest },
          },
          issueText: canonicalIssueSnapshotText({ flowManager: this.flowManager, state }),
        });
        if (currentContext.digest !== this.contextSnapshot.digest) {
          throw new Error("draft worker context content changed after handoff capture");
        }
      } catch (cause) {
        throw new WorkerArtifactHandoffError(
          "stale",
          "FLOW_ARTIFACT_HANDOFF_STALE",
          `draft worker context binding is stale: ${cause.message}`,
          { cause },
        );
      }
    }
    const planGateRepair = currentPlanGateRepair({
      flowManager: this.flowManager,
      state,
      stepId: this.stepId,
    });
    const testReviewRepair = currentTestReviewRepair({
      flowManager: this.flowManager,
      state,
      stepId: this.stepId,
    });
    const acceptanceRepairRoute = currentAcceptanceImplementationRepair({
      flowManager: this.flowManager,
      state,
      stepId: this.stepId,
    });
    const expectedInputPaths = this.policy.inputContract.resolve({ planGateRepair, testReviewRepair, acceptanceRepairRoute });
    if (
      expectedInputPaths.length !== this.inputs.length
      || expectedInputPaths.some((relativePath, index) => relativePath !== this.inputs[index].targetRelativePath)
    ) {
      throw new WorkerArtifactHandoffError(
        "stale",
        "FLOW_ARTIFACT_HANDOFF_STALE",
        "worker artifact handoff input contract changed before publication",
      );
    }
    const current = this.inputs.map(({ targetRelativePath: relativePath }) => {
      const input = CanonicalWorkerArtifactAddress.from(relativePath).read({
        flowManager: this.flowManager,
        specId: state.specId,
        consumerNodeId: this.stepId,
      });
      return { path: relativePath, digest: input.snapshot().digest, byteLength: input.snapshot().byteLength };
    });
    const currentDigest = handoffInputDigest(current.map((input) => ({
      targetRelativePath: input.path,
      digest: input.digest,
      byteLength: input.byteLength,
    })), this.contextSnapshot);
    const currentRevision = inputRevision(currentDigest, {
      attempt: currentAttempt,
      planGateRepair,
      testReviewRepair,
      acceptanceRepairRoute,
    });
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
        if (!fs.existsSync(source) && !rule.required) continue;
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
    if (rule.logicalName === "upgrade.result") {
      const validation = validateUpgradeResultArtifact(document);
      if (!validation.ok) throw new Error(`upgrade result is invalid: ${validation.reason}`);
    }
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
          retryable: request.policy.kind !== "source"
            && (cause.classification === "invalid" || cause.classification === "missing"),
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
        retryable: request.policy.kind !== "source",
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

function requestFromStored(filePath) {
  const resolvedRequestPath = path.resolve(filePath);
  const actionDirectory = path.dirname(resolvedRequestPath);
  const invocationDirectory = path.dirname(actionDirectory);
  const runDirectory = path.dirname(invocationDirectory);
  const handoffRoot = path.dirname(runDirectory);
  const sharedHandoffRoot = path.dirname(handoffRoot);
  const managedDirectory = path.dirname(sharedHandoffRoot);
  const executionRoot = path.dirname(managedDirectory);
  const executionAuthority = path.basename(sharedHandoffRoot) === "handoffs"
    && path.basename(managedDirectory) === PRODUCT.managedDirName;
  if (path.basename(resolvedRequestPath) !== "request.json" || !executionAuthority) {
    throw new Error("handoff request path is outside its dedicated runtime authority");
  }
  const { document } = boundedJson(resolvedRequestPath, "worker artifact handoff request");
  exactObjectKeys(document, [
    "version", "runId", "specId", "issue", "stepId", "taskId", "actionDigest", "dispatchInvocationId",
    "targetAuthority", "inputDigest", "inputRevision", "inputs", "contextSnapshot",
    "payloads", "generatedAt",
  ], "worker artifact handoff request");
  if (document.version !== WORKER_ARTIFACT_HANDOFF_VERSION) {
    throw new Error(`worker artifact handoff version must be ${WORKER_ARTIFACT_HANDOFF_VERSION}`);
  }
  const policy = workerArtifactHandoffPolicy(document.stepId);
  if (!policy) throw new Error(`unsupported worker artifact handoff step: ${document.stepId}`);
  const runId = requiredString(document.runId, "handoff request runId");
  const invocationId = requiredString(document.dispatchInvocationId, "handoff request dispatchInvocationId");
  const actionDigest = requiredDigest(document.actionDigest, "handoff request actionDigest");
  const specId = requiredString(document.specId, "handoff request specId");
  const taskId = document.taskId == null ? null : requiredString(document.taskId, "handoff request taskId");
  if ((document.stepId === "task-impl") !== (taskId !== null)) {
    throw new Error("handoff request task identity does not match its step");
  }
  if (path.basename(handoffRoot) !== digest(specId).slice(0, 24)) {
    throw new Error("handoff request path does not match its Spec identity");
  }
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
      || stored.targetAuthority !== (policy.kind === "source" ? "execution-checkout" : "canonical-flow-artifacts")
    ) {
      throw new Error(`handoff request payload contract is invalid for ${rule.logicalName}`);
    }
  }
  const payloadDirectory = path.join(actionDirectory, "payload");
  const request = {
    policy,
    version: document.version,
    runId,
    specId,
    issue: document.issue ?? null,
    stepId: requiredString(document.stepId, "handoff request stepId"),
    taskId,
    actionDigest,
    dispatchInvocationId: invocationId,
    targetAuthority: requiredString(document.targetAuthority, "handoff request targetAuthority"),
    inputDigest: requiredDigest(document.inputDigest, "handoff request inputDigest"),
    inputRevision: requiredDigest(document.inputRevision, "handoff request inputRevision"),
    generatedAt: requiredString(document.generatedAt, "handoff request generatedAt"),
    executionRoot,
    handoffRoot,
    directory: actionDirectory,
    payloadDirectory,
    requestPath: resolvedRequestPath,
    submissionPath: path.join(actionDirectory, "handoff.json"),
    payloads: policy.payloads.map((rule) => {
      const stored = storedPayloads.find((entry) => entry?.logicalName === rule.logicalName);
      return Object.freeze({
        rule,
        baselineDigest: stored.baselineDigest ?? null,
        baselineByteLength: stored.baselineByteLength ?? 0,
        // Tree baselines are advisory only during a restart replay: the
        // sealed manifest and catalog are the authority.  The original
        // request format deliberately has no duplicate copy of the tree.
        baselineEntries: null,
      });
    }),
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
        : path.join(payloadDirectory, rule.targetRelativePath);
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
  if (!isWithin(handoffRoot, request.requestPath) || !isWithin(handoffRoot, payloadDirectory)) {
    throw new Error("handoff request escapes execution root");
  }
  return Object.freeze(request);
}

function restoreExecutionHandoffRequest({ mainRoot, executionRoot, state, stored, canonicalLocation, flowManager }) {
  if (state?.schemaRevision !== 3) {
    throw new Error("canonical handoff restore requires a Version-1 Flow state");
  }
  const policy = workerArtifactHandoffPolicy(stored.stepId);
  if (!policy) throw new Error(`unsupported canonical worker handoff step: ${stored.stepId}`);
  const request = new WorkerArtifactHandoffRequest({
    mainRoot,
    executionRoot,
    state,
    invocation: {
      id: stored.dispatchInvocationId,
      action: {
        digest: stored.actionDigest,
        nextAction: { step: stored.stepId, taskId: stored.taskId },
      },
      ...(stored.contextSnapshot === null ? {} : {
        target: { digest: stored.contextSnapshot.binding.targetDigest },
      }),
    },
    policy,
    inputs: stored.inputs,
    contextSnapshot: stored.contextSnapshot,
    payloads: stored.payloads,
    inputDigest: stored.inputDigest,
    inputRevision: stored.inputRevision,
    generatedAt: stored.generatedAt,
    canonicalLocation,
    flowManager,
  });
  if (request.directory !== stored.directory || request.requestDigest !== stored.requestDigest) {
    throw new Error("canonical handoff request does not reproduce its persisted identity");
  }
  return request;
}

/**
 * Validate the inherited handoff boundary before an invoked CLI command can
 * mutate the execution checkout. Artifact-producing workers never receive
 * source authority; their dry-run may observe the upgrade, but a materialized
 * upgrade is rejected before it can touch the checkout.
 */
export function assertWorkerUpgradeAllowed({ requestPath, dryRun = false } = {}) {
  try {
    const request = requestFromStored(requiredString(requestPath, "worker upgrade handoff request"));
    if (request.policy.kind === "source") return request;
    if (dryRun === true) return null;
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_WORKER_UPGRADE_SOURCE_AUTHORITY_REQUIRED",
      "materialized upgrade requires a source-worker handoff authority",
      { retryable: false, data: { stepId: request.stepId } },
    );
  } catch (cause) {
    if (cause instanceof WorkerArtifactHandoffError) throw cause;
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_WORKER_UPGRADE_HANDOFF_INVALID",
      `worker upgrade handoff is invalid: ${cause.message}`,
      { cause, retryable: false },
    );
  }
}

/**
 * Stage the validated output of a source-worker `sennel upgrade` invocation
 * under the existing handoff payload authority. The worker never writes the
 * Version Store; sealing binds these bytes to the parent-owned publication.
 */
export function stageWorkerUpgradeResult({ requestPath, artifact } = {}) {
  const request = assertWorkerUpgradeAllowed({ requestPath, dryRun: false });
  if (fs.existsSync(request.submissionPath)) {
    throw new WorkerArtifactHandoffError(
      "stale",
      "FLOW_WORKER_UPGRADE_HANDOFF_SEALED",
      "worker upgrade cannot stage evidence after the handoff has been sealed",
      { retryable: false, data: { stepId: request.stepId, handoffDirectory: request.directory } },
    );
  }
  const validation = validateUpgradeResultArtifact(artifact);
  if (!validation.ok) {
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_WORKER_UPGRADE_RESULT_INVALID",
      `worker upgrade result is invalid: ${validation.reason}`,
      { retryable: false, data: { stepId: request.stepId } },
    );
  }
  const target = request.payloadPath("upgrade.result");
  new AtomicFile(target, { phaseNamespace: "worker-upgrade-result" })
    .write(Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8"));
  return Object.freeze({ staged: true, path: target, stepId: request.stepId });
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
    if (rule.kind === "file" && rule.required && entries.length !== 1) {
      throw new WorkerArtifactHandoffError("missing", "FLOW_ARTIFACT_HANDOFF_MISSING", `handoff requires exactly one ${rule.logicalName} payload`);
    }
    if (rule.kind === "file" && entries.length > 1) {
      throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", `handoff duplicates optional ${rule.logicalName} payload`);
    }
    if (rule.kind === "file" && entries.length === 1 && entries[0].targetRelativePath !== rule.targetRelativePath) {
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

function optionalUpgradeResultBytes(request, submission) {
  const entry = submission.payloadManifest.find((candidate) => candidate.logicalName === "upgrade.result");
  if (!entry) return null;
  const source = path.join(request.payloadDirectory, ...entry.relativePath.split("/"));
  const snapshot = readRegularFile(source, "sealed handoff payload upgrade.result", MAX_JSON_BYTES);
  let document;
  try {
    document = JSON.parse(snapshot.bytes.toString("utf8"));
  } catch (cause) {
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_INVALID",
      `sealed handoff payload upgrade.result is malformed JSON: ${cause.message}`,
      { cause },
    );
  }
  const validation = validateUpgradeResultArtifact(document);
  if (!validation.ok) {
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_WORKER_UPGRADE_RESULT_INVALID",
      `sealed handoff payload upgrade.result is invalid: ${validation.reason}`,
    );
  }
  if (document.dryRun === true) {
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_WORKER_UPGRADE_RESULT_INVALID",
      "sealed handoff payload upgrade.result must record a materialized upgrade",
    );
  }
  return Buffer.from(snapshot.bytes);
}

function canonicalDraftReviewPayload(request, submission, artifactName) {
  const entry = submission.payloadManifest.find((candidate) => candidate.logicalName === artifactName);
  if (!entry) throw new Error(`handoff payload is missing: ${artifactName}`);
  return CanonicalDraftReviewHandoffArtifact.fromPayload({
    name: artifactName,
    digest: entry.digest,
    document: payloadDocument(request, submission, artifactName),
  });
}

function canonicalDraftReviewEvidence(request, submission, state, route, { triage = null, repair = null } = {}) {
  return CanonicalDraftReviewHandoffEvidence.fromInputs({
    route,
    state,
    inputs: request.inputs,
    triage,
    repair,
  });
}

function validateDraftPayload(request, submission, state) {
  const draft = payloadDocument(request, submission, "draft.json");
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    throw new Error("draft.json must contain a JSON object");
  }
  const route = draftReviewRouteForStepId(request.stepId);
  if (!route) return;
  const evidence = canonicalDraftReviewEvidence(request, submission, state, route, {
    repair: canonicalDraftReviewPayload(request, submission, route.repairArtifact),
  });
  const validation = evidence.validateThrough(request.stepId);
  if (validation.issues.length > 0) throw new Error(validation.issues.join("; "));
}

function assertPlanGateRepairMadeProgress(request, submission, state, logicalName) {
  const repair = currentPlanGateRepair({
    flowManager: request.flowManager,
    state,
    stepId: request.stepId,
  });
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
  const repair = currentTestReviewRepair({
    flowManager: request.flowManager,
    state,
    stepId: request.stepId,
  });
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
    if (request.policy.kind === "source") {
      const effect = SourceWorkerEffect.fromDocument(
        payloadDocument(request, submission, "effects.json"),
        request.stepId,
      );
      if (effect.triage !== null) {
        const acceptance = request.inputs.find((input) => input.name === "acceptance-review.json")?.document ?? null;
        const keys = acceptance === null
          ? [
              ...((request.inputs.find((input) => input.name === "impl-review.json")?.document?.blockingFindings) ?? []),
              ...((request.inputs.find((input) => input.name === "impl-review.json")?.document?.nonBlockingImprovements) ?? []),
            ].map((finding) => finding?.findingKey)
          : new AcceptanceRepairFindingSet(acceptance).keys;
        if (keys.some((key) => typeof key !== "string" || key === "")
          || new Set(keys).size !== keys.length
          || keys.length !== effect.triage.dispositions.length
          || effect.triage.dispositions.some((entry) => !keys.includes(entry.findingKey))
          || (acceptance !== null && effect.triage.dispositions.some((entry) => entry.disposition !== "apply"))) {
          throw new Error("source triage must classify each canonical route finding exactly once");
        }
      }
      if (effect.repair !== null) {
        const triage = request.inputs.find((input) => input.name === "impl-triage.json")?.document;
        const applied = Array.isArray(triage?.dispositions)
          ? triage.dispositions.filter((entry) => entry?.disposition === "apply").map((entry) => entry.findingKey)
          : null;
        if (applied === null
          || applied.length !== effect.repair.appliedFindingKeys.length
          || applied.some((key) => !effect.repair.appliedFindingKeys.includes(key))) {
          throw new Error("source repair must apply exactly the canonical impl-triage apply findings");
        }
      }
      return;
    }
    if (request.stepId.startsWith("draft")) {
      if (request.stepId.endsWith("triage")) {
        const route = draftReviewRouteForStepId(request.stepId);
        const evidence = canonicalDraftReviewEvidence(request, submission, state, route, {
          triage: canonicalDraftReviewPayload(request, submission, route.triageArtifact),
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
        canonicalSpecDir: CanonicalWorkerTestTree.artifactRoot({
          flowManager: request.flowManager,
          specId: state.specId,
        }),
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
        retryable: request.policy.kind !== "source",
        data: {
          stepId: request.stepId,
          handoffDirectory: request.directory,
        },
      },
    );
  }
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

/** Durable fail-closed receipt for a sealed handoff rejected by its parent. */
class WorkerArtifactHandoffQuarantineReceipt {
  constructor(input = {}) {
    exactObjectKeys(input, [
      "version", "runId", "specId", "stepId", "actionDigest", "dispatchInvocationId",
      "requestDigest", "handoffDigest", "classification", "code", "message", "quarantinedAt",
    ], "worker artifact handoff quarantine");
    if (input.version !== 1) throw new Error("worker artifact handoff quarantine version must be 1");
    this.version = 1;
    this.runId = requiredString(input.runId, "handoff quarantine runId");
    this.specId = requiredString(input.specId, "handoff quarantine specId");
    this.stepId = requiredString(input.stepId, "handoff quarantine stepId");
    this.actionDigest = requiredDigest(input.actionDigest, "handoff quarantine actionDigest");
    this.dispatchInvocationId = requiredString(input.dispatchInvocationId, "handoff quarantine dispatchInvocationId");
    this.requestDigest = requiredDigest(input.requestDigest, "handoff quarantine requestDigest");
    this.handoffDigest = requiredDigest(input.handoffDigest, "handoff quarantine handoffDigest");
    this.classification = requiredString(input.classification, "handoff quarantine classification");
    this.code = requiredString(input.code, "handoff quarantine code");
    this.message = requiredString(input.message, "handoff quarantine message");
    this.quarantinedAt = requiredString(input.quarantinedAt, "handoff quarantine timestamp");
    if (!Number.isFinite(Date.parse(this.quarantinedAt))) throw new Error("handoff quarantine timestamp must be ISO-8601");
    Object.freeze(this);
  }

  static create(request, submission, error, now) {
    return new WorkerArtifactHandoffQuarantineReceipt({
      version: 1,
      runId: request.runId,
      specId: request.specId,
      stepId: request.stepId,
      actionDigest: request.actionDigest,
      dispatchInvocationId: request.dispatchInvocationId,
      requestDigest: request.requestDigest,
      handoffDigest: submission.handoffDigest,
      classification: error.classification,
      code: error.code,
      message: error.message,
      quarantinedAt: now().toISOString(),
    });
  }

  assertMatches(request, submission) {
    if (
      this.runId !== request.runId
      || this.specId !== request.specId
      || this.stepId !== request.stepId
      || this.actionDigest !== request.actionDigest
      || this.dispatchInvocationId !== request.dispatchInvocationId
      || this.requestDigest !== request.requestDigest
      || this.handoffDigest !== submission.handoffDigest
    ) {
      throw new Error("handoff quarantine receipt does not match its sealed request");
    }
    return this;
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
      classification: this.classification,
      code: this.code,
      message: this.message,
      quarantinedAt: this.quarantinedAt,
    };
  }
}

function readHandoffQuarantine(request, submission) {
  if (!fs.existsSync(request.quarantinePath)) return null;
  try {
    const { document } = boundedJson(request.quarantinePath, "worker artifact handoff quarantine");
    return new WorkerArtifactHandoffQuarantineReceipt(document).assertMatches(request, submission);
  } catch (cause) {
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_QUARANTINE_INVALID",
      `worker artifact handoff quarantine cannot be trusted: ${cause.message}`,
      { cause, retryable: false, recoveryPossible: false, data: { handoffDirectory: request.directory } },
    );
  }
}

function pruneEmptyHandoffAncestors(handoffRoot, startDirectory) {
  const sharedHandoffRoot = path.dirname(path.resolve(handoffRoot));
  let current = path.resolve(startDirectory);
  while (current !== sharedHandoffRoot) {
    if (!isWithin(sharedHandoffRoot, current)) {
      throw new Error(`handoff cleanup ancestor escapes its authority: ${current}`);
    }
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (cause) {
      if (cause.code !== "ENOENT") throw cause;
      current = path.dirname(current);
      continue;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(current) !== current) {
      throw new Error(`handoff cleanup ancestor is not a real directory: ${current}`);
    }
    if (fs.readdirSync(current).length > 0) break;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

function cleanupCompletedHandoff(handoffRoot, receiptValue, faultInjector = () => {}) {
  const receipt = receiptValue instanceof WorkerArtifactHandoffReceipt
    ? receiptValue
    : new WorkerArtifactHandoffReceipt(receiptValue);
  const directory = handoffActionDirectory(
    handoffRoot,
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
      pruneEmptyHandoffAncestors(handoffRoot, path.dirname(consumedDirectory));
      cleaned = true;
    }
    if (!realDirectory(directory)) {
      pruneEmptyHandoffAncestors(handoffRoot, path.dirname(directory));
      return cleaned;
    }
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
    pruneEmptyHandoffAncestors(handoffRoot, path.dirname(consumedDirectory));
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

function canonicalTestTreeBaselineForPublication(request) {
  const payload = request.payloads.find(({ rule }) => rule.kind === "tree" && rule.targetRelativePath === "tests");
  if (!payload) {
    throw new WorkerArtifactHandoffError(
      "invalid",
      "FLOW_ARTIFACT_HANDOFF_INVALID",
      "canonical test publication has no declared test-tree baseline",
    );
  }
  const baseline = CanonicalWorkerTestTree.catalogSnapshot({
    flowManager: request.flowManager,
    specId: request.specId,
  });
  const baselineDigest = digest(stableStringify(baseline.entries));
  const baselineByteLength = baseline.entries.reduce((total, entry) => total + entry.byteLength, 0);
  if (payload.baselineDigest !== baselineDigest || payload.baselineByteLength !== baselineByteLength) {
    throw new WorkerArtifactHandoffError(
      "conflict",
      "FLOW_ARTIFACT_HANDOFF_CONFLICT",
      "canonical worker test-source collection changed after handoff capture",
      {
        data: {
          expectedBaselineDigest: payload.baselineDigest,
          currentBaselineDigest: baselineDigest,
        },
      },
    );
  }
  return baseline;
}

class DraftPromotionHandoffAdapter {
  constructor({ flowManager, specId, sourceBytes, sourcePayloadDigest, handoffDigest, handoffRequestDigest, action }) {
    this.flowManager = flowManager;
    this.specId = specId;
    this.sourceBytes = Buffer.from(sourceBytes);
    this.sourcePayloadDigest = sourcePayloadDigest;
    this.handoffDigest = handoffDigest;
    this.handoffRequestDigest = handoffRequestDigest;
    this.action = action;
  }

  promoteDraftQuestionAndKeepRefineActive(action) {
    if (action !== this.action) throw new Error("unselected draft promotion action");
    return this.flowManager.promoteDraftQuestionAndKeepRefineActive({
      specId: this.specId,
      questionId: action.questionId,
      questionRevision: action.questionRevision,
      digest: action.digest,
      byteLength: action.byteLength,
      sourceBytes: this.sourceBytes,
      sourcePayloadDigest: this.sourcePayloadDigest,
      handoffDigest: this.handoffDigest,
      handoffRequestDigest: this.handoffRequestDigest,
    });
  }
}

function canonicalHandoffPublications(request, submission) {
  const artifactWrites = [];
  const artifactRemovals = [];
  const artifactBaselines = new Map();
  let specRecord;
  let testSourceBaseline;
  const testEntries = [];
  const addArtifactBaseline = (baseline) => {
    const relativePath = baseline.artifact.relativePath;
    const existing = artifactBaselines.get(relativePath) ?? null;
    if (existing !== null && (
      existing.digest !== baseline.digest
      || existing.byteLength !== baseline.byteLength
    )) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_ARTIFACT_HANDOFF_INVALID",
        `handoff captured inconsistent baselines for ${relativePath}`,
      );
    }
    artifactBaselines.set(relativePath, baseline);
  };
  for (const input of request.inputs) {
    const address = CanonicalWorkerArtifactAddress.from(input.targetRelativePath);
    addArtifactBaseline(new CanonicalFlowArtifactBaseline({
      logicalKey: address.logicalKey,
      parameters: address.parameters,
      digest: input.digest,
      byteLength: input.byteLength,
    }));
  }
  for (const entry of submission.payloadManifest) {
    const bytes = manifestPayloadBytes(request, entry, "canonical handoff payload");
    if (entry.targetRelativePath.startsWith("tests/")) {
      testEntries.push({
        targetRelativePath: entry.targetRelativePath,
        bytes,
        mediaType: mediaTypeForPath(entry.targetRelativePath),
      });
      continue;
    }
    const address = new CanonicalWorkerArtifactAddress(entry.targetRelativePath);
    const payload = request.payloads.find(({ rule }) => (
      rule.kind === "file"
      && rule.logicalName === entry.logicalName
      && rule.targetRelativePath === entry.targetRelativePath
    ));
    if (!payload) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_ARTIFACT_HANDOFF_INVALID",
        `handoff output has no captured target baseline: ${entry.targetRelativePath}`,
      );
    }
    addArtifactBaseline(new CanonicalFlowArtifactBaseline({
      logicalKey: address.logicalKey,
      parameters: address.parameters,
      digest: payload.baselineDigest,
      byteLength: payload.baselineByteLength,
    }));
    if (address.logicalKey === "spec.record") {
      if (specRecord !== undefined) {
        throw new WorkerArtifactHandoffError("invalid", "FLOW_ARTIFACT_HANDOFF_INVALID", "handoff publishes spec.json more than once");
      }
      try {
        specRecord = new CanonicalWorkerSpecPublication(JSON.parse(bytes.toString("utf8")));
      } catch (cause) {
        throw new WorkerArtifactHandoffError(
          "invalid",
          "FLOW_ARTIFACT_HANDOFF_INVALID",
          `canonical spec payload is malformed JSON: ${cause.message}`,
          { cause, retryable: true },
        );
      }
      continue;
    }
    artifactWrites.push(address.publication(bytes, mediaTypeForPath(entry.targetRelativePath)));
  }
  if (testEntries.length > 0) {
    const replacement = new CanonicalWorkerTestTree(testEntries)
      .replacement(canonicalTestTreeBaselineForPublication(request));
    artifactWrites.push(...replacement.artifactWrites);
    artifactRemovals.push(...replacement.artifactRemovals);
    testSourceBaseline = replacement.testSourceBaseline;
  }
  return Object.freeze({
    specRecord: specRecord ?? undefined,
    artifactWrites: Object.freeze(artifactWrites),
    artifactRemovals: Object.freeze(artifactRemovals),
    artifactBaselines: Object.freeze([...artifactBaselines.values()]),
    testSourceBaseline: testSourceBaseline ?? undefined,
  });
}

function canonicalHandoffResult(request, submission, now, { status = "done" } = {}) {
  return Object.freeze({
    outcome: status === "skipped" ? "skipped" : "passed",
    summary: `Worker handoff confirmed for ${request.stepId}.`,
    confirmedAt: now().toISOString(),
    artifactRefs: [
      { kind: "worker-handoff", id: submission.handoffDigest },
      { kind: "worker-handoff-request", id: request.requestDigest },
    ],
  });
}

function canonicalHandoffReceipt(request, submission, now) {
  return new WorkerArtifactHandoffReceipt({
    version: 1,
    runId: request.runId,
    specId: request.specId,
    stepId: request.stepId,
    actionDigest: request.actionDigest,
    dispatchInvocationId: request.dispatchInvocationId,
    requestDigest: request.requestDigest,
    handoffDigest: submission.handoffDigest,
    inputDigest: request.inputDigest,
    inputRevision: request.inputRevision,
    payloadDigest: manifestDigest(submission.payloadManifest),
    consumedAt: now().toISOString(),
  });
}

function canonicalHandoffReceiptForRequest(state, request, flowManager = null) {
  const step = request.taskId === null
    ? findStepById(state?.steps || [], request.stepId)
    : findStepById(state?.tasks?.find((task) => task.id === request.taskId)?.steps || [], `${request.taskId}-impl`);
  const resultReferences = step && new Set(["done", "skipped"]).has(step.status) && Array.isArray(step.result?.artifactRefs)
    ? [step.result.artifactRefs]
    : flowManager?.activityLedger?.(request.specId)
      .filter((activity) => (
        activity?.nodeId === request.stepId
        && ["repair_implementation", "triage_implementation_for_repair", "triage_implementation_no_repair"].includes(activity?.transition?.operation)
        && Array.isArray(activity?.result?.artifactRefs)
      ))
      .map((activity) => activity.result.artifactRefs) ?? [];
  for (const references of resultReferences) {
    const requestReference = references.find((reference) => (
      reference.kind === "worker-handoff-request" && reference.id === request.requestDigest
    )) ?? null;
    const handoffReference = references.find((reference) => reference.kind === "worker-handoff") ?? null;
    if (requestReference !== null && handoffReference !== null) return handoffReference;
  }
  const promotionReceipt = flowManager?.activityLedger?.(request.specId)
    .find((activity) => {
      if (activity?.nodeId !== request.stepId || activity?.transition?.operation !== "publish_artifacts") return false;
      const artifacts = activity?.references?.artifacts;
      if (!Array.isArray(artifacts)) return false;
      return artifacts.some((reference) => (
        reference.id === request.requestDigest && reference.label === "draft-refine handoff request"
      )) && artifacts.some((reference) => reference.label === "draft-refine handoff");
    });
  if (promotionReceipt !== undefined) {
    const handoffReference = promotionReceipt.references.artifacts.find((reference) => (
      reference.label === "draft-refine handoff"
    ));
    if (handoffReference !== undefined) return handoffReference;
  }
  return null;
}

function canonicalHandoffIsCommitted(state, request, submission, flowManager = null) {
  const receipt = canonicalHandoffReceiptForRequest(state, request, flowManager);
  return receipt?.id === submission.handoffDigest;
}

function executionHandoffRuntimeEntries(handoffRoot) {
  if (!fs.existsSync(handoffRoot)) {
    return Object.freeze({
      requestPaths: Object.freeze([]),
      consumedDirectories: Object.freeze([]),
      orphanedDirectories: Object.freeze([]),
    });
  }
  const root = path.resolve(handoffRoot);
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || fs.realpathSync(root) !== root) {
    throw new WorkerArtifactHandoffError(
      "recovery-required",
      "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
      "execution worker handoff runtime authority is invalid",
      { data: { handoffRoot: root } },
    );
  }
  const requestPaths = [];
  const consumedDirectories = [];
  const orphanedDirectories = [];
  const descend = (directory, remaining) => {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== directory) {
      throw new WorkerArtifactHandoffError(
        "recovery-required",
        "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
        "execution worker handoff runtime contains an invalid directory",
        { data: { handoffDirectory: directory } },
      );
    }
    if (remaining === 0) {
      const requestPath = path.join(directory, "request.json");
      if (fs.existsSync(requestPath)) requestPaths.push(requestPath);
      else if (/^[a-f0-9]{64}$/.test(path.basename(directory))) orphanedDirectories.push(directory);
      return;
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(directory, entry.name);
      // A committed handoff is renamed before its transient runtime work unit
      // is removed.  It has no request path at its canonical identity any
      // longer, so attempting to restore it as a pending request would turn a
      // recoverable cleanup crash into an identity failure.  It is safe to
      // discard only this exact, generated cleanup name: the rename happens
      // after the Store confirmation has made the handoff receipt durable.
      if (remaining === 1 && /^[a-f0-9]{64}\.consumed-[a-f0-9]{24}$/.test(entry.name)) {
        consumedDirectories.push(candidate);
        continue;
      }
      descend(candidate, remaining - 1);
    }
  };
  // <spec>/<run>/<invocation>/<action>/request.json
  descend(root, 3);
  return Object.freeze({
    requestPaths: Object.freeze(requestPaths.sort()),
    consumedDirectories: Object.freeze(consumedDirectories.sort()),
    orphanedDirectories: Object.freeze(orphanedDirectories.sort()),
  });
}

function cleanupTransientExecutionHandoffDirectory(handoffRoot, directory) {
  if (!isWithin(handoffRoot, directory)) {
    throw new Error(`execution worker handoff cleanup target escapes its Spec authority: ${directory}`);
  }
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch (cause) {
    if (cause.code === "ENOENT") return false;
    throw cause;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== directory) {
    throw new Error(`execution worker handoff cleanup target is not a real directory: ${directory}`);
  }
  fs.rmSync(directory, { recursive: true });
  pruneEmptyHandoffAncestors(handoffRoot, path.dirname(directory));
  return true;
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
      flowManager: ctx.flowManager,
      now: this.now,
    });
    return request?.prepare() || null;
  }

  /**
   * Persist the parent decision that a sealed handoff is unsafe to replay.
   * This receipt is only a durable deny marker, never positive publication
   * authority: a matching receipt blocks recovery, and a malformed or forged
   * marker blocks it fail-closed as well.
   */
  quarantine({ request, error }) {
    if (!(request instanceof WorkerArtifactHandoffRequest)) {
      throw new Error("worker artifact handoff quarantine requires a typed request");
    }
    if (!(error instanceof WorkerArtifactHandoffError)) {
      throw new Error("worker artifact handoff quarantine requires a typed error");
    }
    if (!fs.existsSync(request.submissionPath)) return null;
    const submission = readSubmission(request);
    const existing = readHandoffQuarantine(request, submission);
    if (existing !== null) return existing;
    const receipt = WorkerArtifactHandoffQuarantineReceipt.create(request, submission, error, this.now);
    new AtomicFile(request.quarantinePath, { phaseNamespace: "worker-handoff-quarantine" })
      .write(`${JSON.stringify(receipt.toJSON(), null, 2)}\n`);
    return receipt;
  }

  recoverPending({ ctx }) {
    const state = typeof ctx.flowManager.load === "function"
      ? ctx.flowManager.load(ctx.specId)
      : ctx.flowManager.loadReadOnly(ctx.specId);
    if (state?.schemaRevision !== 3 || typeof ctx.flowManager.confirmCurrentAttempt !== "function") {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_ARTIFACT_HANDOFF_INVALID",
        "worker artifact handoff recovery requires a Version-1 Flow",
      );
    }
    return this.#recoverCanonicalPending({ ctx, state });
  }

  #recoverCanonicalPending({ ctx, state }) {
    const mainRoot = ctx.mainRoot || ctx.root;
    const executionRoot = ctx.executionRoot || ctx.root;
    const canonicalLocation = ctx.flowManager.specLocation(state.specId);
    const handoffRoot = executionHandoffRoot(executionRoot, state.specId);
    let cleaned = 0;
    const runtimeEntries = executionHandoffRuntimeEntries(handoffRoot);
    for (const requestPath of runtimeEntries.requestPaths) {
      let stored;
      try {
        stored = requestFromStored(requestPath);
      } catch (cause) {
        throw new WorkerArtifactHandoffError(
          "recovery-required",
          "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
          `execution worker handoff request cannot be restored: ${cause.message}`,
          { cause, data: { requestPath } },
        );
      }
      if (stored.specId !== state.specId || stored.runId !== state.runId) {
        throw new WorkerArtifactHandoffError(
          "recovery-required",
          "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
          "execution worker handoff runtime belongs to a different Flow identity",
          { data: { requestPath, specId: stored.specId, runId: stored.runId } },
        );
      }
      let submission;
      try {
        submission = readSubmission(stored);
      } catch (cause) {
        if (cause instanceof WorkerArtifactHandoffError && cause.classification === "missing") {
          if (workerArtifactHandoffPolicy(stored.stepId)?.kind === "source") {
            throw new WorkerArtifactHandoffError(
              "recovery-required",
              "FLOW_SOURCE_HANDOFF_RECOVERY_UNTRUSTED",
              "unsealed source worker handoff may contain unverified source edits and cannot be retried automatically",
              { data: { stepId: stored.stepId, handoffDirectory: stored.directory } },
            );
          }
          // No sealed payload exists.  The next dispatcher attempt owns a
          // fresh request; this incomplete work unit is not persisted truth.
          if (cleanupTransientExecutionHandoffDirectory(handoffRoot, stored.directory)) cleaned += 1;
          continue;
        }
        throw cause;
      }
      const request = restoreExecutionHandoffRequest({
        mainRoot,
        executionRoot,
        state,
        stored,
        canonicalLocation,
        flowManager: ctx.flowManager,
      });
      const quarantine = readHandoffQuarantine(request, submission);
      if (quarantine !== null) {
        throw new WorkerArtifactHandoffError(
          "invalid",
          "FLOW_ARTIFACT_HANDOFF_QUARANTINED",
          `sealed worker artifact handoff is quarantined after ${quarantine.code}: ${quarantine.message}`,
          {
            retryable: false,
            recoveryPossible: false,
            data: {
              stepId: request.stepId,
              handoffDirectory: request.directory,
              quarantinePath: request.quarantinePath,
              quarantineCode: quarantine.code,
            },
          },
        );
      }
      if (canonicalHandoffIsCommitted(state, request, submission, ctx.flowManager)) {
        cleanupCompletedHandoff(request.handoffRoot, canonicalHandoffReceipt(request, submission, this.now), this.faultInjector);
        cleaned += 1;
        continue;
      }
      if (request.policy.kind === "source") {
        throw new WorkerArtifactHandoffError(
          "recovery-required",
          "FLOW_SOURCE_HANDOFF_RECOVERY_UNTRUSTED",
          "sealed source worker handoff cannot be recovered without its parent-held immutable baseline",
          { data: { stepId: request.stepId, handoffDirectory: request.directory } },
        );
      }
      // A parent restart has lost the in-memory validation authority. Never
      // replay an artifact payload; discard it so a fresh dispatcher attempt
      // captures a new immutable baseline.
      if (cleanupTransientExecutionHandoffDirectory(handoffRoot, request.directory)) cleaned += 1;
      continue;
    }
    for (const transientDirectory of [
      ...runtimeEntries.consumedDirectories,
      ...runtimeEntries.orphanedDirectories,
    ]) {
      try {
        if (cleanupTransientExecutionHandoffDirectory(handoffRoot, transientDirectory)) cleaned += 1;
      } catch (cause) {
        throw new WorkerArtifactHandoffError(
          "recovery-required",
          "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
          `execution worker handoff cleanup requires recovery: ${cause.message}`,
          { cause, data: { handoffDirectory: transientDirectory } },
        );
      }
    }
    return cleaned > 0
      ? { completed: true, replayed: true, cleanedHandoffs: cleaned }
      : null;
  }

  reconcile({ ctx, request, mutationAuthority = null }) {
    if (!(request instanceof WorkerArtifactHandoffRequest)) return null;
    // A sealed V1 payload sits in `.runtime/` until the parent accepts it.
    // Validate that untrusted surface before loading the Version Store: a
    // symlink or undeclared payload must be reported as a typed handoff
    // rejection, never as a catalog corruption caused by inspecting it.
    if (request.state?.schemaRevision !== 3 || typeof ctx.flowManager.confirmCurrentAttempt !== "function") {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_ARTIFACT_HANDOFF_INVALID",
        "worker artifact handoff publication requires a Version-1 Flow",
      );
    }
    let state = null;
    try {
      state = ctx.flowManager.load(request.specId);
      const committed = canonicalHandoffReceiptForRequest(state, request, ctx.flowManager);
      if (committed !== null) {
        return {
          completed: true,
          replayed: true,
          stepId: request.stepId,
          handoffDigest: committed.id,
          payloadDigest: null,
        };
      }
    } catch {
      // An untrusted runtime payload can make catalog verification reject a
      // symlink before its own handoff validation runs. Defer that load
      // failure until after the sealed surface has been checked below.
      state = null;
    }
    let submission;
    try {
      submission = readSubmission(request);
      validateSubmission(request, submission);
    } catch (cause) {
      throw cause instanceof WorkerArtifactHandoffError
        ? cause
        : new WorkerArtifactHandoffError(
            "invalid",
            "FLOW_ARTIFACT_HANDOFF_INVALID",
            `canonical worker artifact handoff is invalid: ${cause.message}`,
            { cause },
          );
    }
    state ??= ctx.flowManager.load(request.specId);
    return this.#reconcileCanonical({ ctx, request, state, submission, mutationAuthority });
  }

  #reconcileCanonical({ ctx, request, state, submission = null, mutationAuthority = null }) {
    const committed = canonicalHandoffReceiptForRequest(state, request, ctx.flowManager);
    if (committed !== null) {
      return {
        completed: true,
        replayed: true,
        stepId: request.stepId,
        handoffDigest: committed.id,
        payloadDigest: null,
      };
    }
    try {
      const resolvedSubmission = submission ?? readSubmission(request);
      if (submission === null) validateSubmission(request, resolvedSubmission);
      submission = resolvedSubmission;
      request.assertCurrent(state);
      validatePayload(request, submission, state);
    } catch (cause) {
      throw cause instanceof WorkerArtifactHandoffError
        ? cause
        : new WorkerArtifactHandoffError(
            "invalid",
            "FLOW_ARTIFACT_HANDOFF_INVALID",
            `canonical worker artifact handoff is invalid: ${cause.message}`,
            { cause },
      );
    }
    if (request.policy.kind === "source") {
      return this.#reconcileSource({ ctx, request, submission, mutationAuthority });
    }
    const quarantine = readHandoffQuarantine(request, submission);
    if (quarantine !== null) {
      throw new WorkerArtifactHandoffError(
        "invalid",
        "FLOW_ARTIFACT_HANDOFF_QUARANTINED",
        `sealed worker artifact handoff is quarantined after ${quarantine.code}: ${quarantine.message}`,
        {
          retryable: false,
          recoveryPossible: false,
          data: { stepId: request.stepId, handoffDirectory: request.directory },
        },
      );
    }
    let publications;
    try {
      publications = canonicalHandoffPublications(request, submission);
    } catch (cause) {
      throw cause instanceof WorkerArtifactHandoffError
        ? cause
        : new WorkerArtifactHandoffError(
            "invalid",
            "FLOW_ARTIFACT_HANDOFF_INVALID",
            `canonical worker artifact publication cannot be resolved: ${cause.message}`,
            { cause, retryable: true },
          );
    }
    try {
      let promotionApplied = false;
      this.faultInjector({ phase: "before-worker-handoff-publication", stepId: request.stepId });
      if (request.stepId === "draft-refine") {
        const draftPayload = submission.payloadManifest.find((entry) => entry.targetRelativePath === "draft.json");
        const draftBytes = draftPayload === undefined ? null : manifestPayloadBytes(request, draftPayload, "draft-refine payload");
        const source = request.flowManager.readArtifact({ specId: request.specId, logicalKey: "draft", consumerNodeId: "draft-refine" });
        const draft = draftBytes === null ? null : new DraftLifecycle(JSON.parse(draftBytes.toString("utf8")));
        const latestState = ctx.flowManager.loadReadOnly(request.specId);
        const draftTransitionFacts = draft === null ? null : DraftTransitionFacts.fromDraft(draft);
        if (draftTransitionFacts?.nextQuestion !== null) {
          throw new WorkerArtifactHandoffError(
            "invalid",
            "FLOW_ARTIFACT_HANDOFF_INVALID",
            "draft-refine handoff cannot confirm an output ledger with AwaitingUserAnswer",
          );
        }
        const plan = draft === null ? null : resolveLifecyclePlan({
          event: "draft-refine:confirm", currentStepId: "draft-refine", flowState: latestState,
          draftTransitionFacts,
          draftCatalogBaseline: { digest: source.descriptor.hash, byteLength: source.descriptor.size },
        });
        const action = plan?.actions.find((entry) => entry instanceof PromoteDraftQuestionAndKeepRefineActive) ?? null;
        if (action !== null) {
          action.apply(new DraftPromotionHandoffAdapter({
            flowManager: ctx.flowManager,
            specId: request.specId,
            sourceBytes: draftBytes,
            sourcePayloadDigest: draftPayload.digest,
            handoffDigest: submission.handoffDigest,
            handoffRequestDigest: request.requestDigest,
            action,
          }));
          promotionApplied = true;
        }
      }
      if (!promotionApplied) {
        ctx.flowManager.confirmCurrentAttempt({
        specId: request.specId,
        result: canonicalHandoffResult(request, submission, this.now),
        references: {
          evaluations: [],
          findings: [],
          repairs: [],
          artifacts: [{ id: submission.handoffDigest, label: request.stepId }],
        },
        specRecord: publications.specRecord,
        artifactWrites: publications.artifactWrites,
        artifactRemovals: publications.artifactRemovals,
        artifactBaselines: publications.artifactBaselines,
        testSourceBaseline: publications.testSourceBaseline,
        });
      }
    } catch (cause) {
      if (cause?.code === "CURRENT_FLOW_STATE_CONFLICT") {
        throw new WorkerArtifactHandoffError(
          "conflict",
          "FLOW_ARTIFACT_HANDOFF_CONFLICT",
          `canonical worker artifact handoff lost its Version Store precondition: ${cause.message}`,
          { cause, data: { stepId: request.stepId, handoffDirectory: request.directory } },
        );
      }
      throw new WorkerArtifactHandoffError(
        "recovery-required",
        "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
        `canonical worker artifact handoff could not commit: ${cause.message}`,
        { cause, data: { stepId: request.stepId, handoffDirectory: request.directory } },
      );
    }
    const receipt = canonicalHandoffReceipt(request, submission, this.now);
    cleanupCompletedHandoff(request.handoffRoot, receipt, this.faultInjector);
    return {
      completed: true,
      replayed: false,
      stepId: receipt.stepId,
      handoffDigest: receipt.handoffDigest,
      payloadDigest: receipt.payloadDigest,
    };
  }

  #reconcileSource({ ctx, request, submission, mutationAuthority = null }) {
    const effect = SourceWorkerEffect.fromDocument(
      payloadDocument(request, submission, "effects.json"),
      request.stepId,
    );
    const upgradeResult = optionalUpgradeResultBytes(request, submission);
    if (!(mutationAuthority instanceof WorkerArtifactMutationAuthoritySnapshot)) {
      throw new WorkerArtifactHandoffError(
        "recovery-required",
        "FLOW_SOURCE_HANDOFF_RECOVERY_UNTRUSTED",
        "sealed source worker handoff cannot recover without a parent-owned immutable baseline",
        { retryable: false, data: { stepId: request.stepId, handoffDirectory: request.directory } },
      );
    }
    mutationAuthority.assertUnchanged();
    mutationAuthority.assertSourceDiff({
      stepId: request.stepId,
      completionStatus: effect.completionStatus,
      effect,
    });
    try {
      ctx.flowManager.confirmSourceWorkerHandoff({
        specId: request.specId,
        effect,
        handoffDigest: submission.handoffDigest,
        result: canonicalHandoffResult(request, submission, this.now, { status: effect.completionStatus }),
        ...(upgradeResult === null ? {} : { upgradeResult }),
      });
    } catch (cause) {
      throw new WorkerArtifactHandoffError(
        cause?.code === "CURRENT_FLOW_STATE_CONFLICT" ? "conflict" : "recovery-required",
        cause?.code === "CURRENT_FLOW_STATE_CONFLICT" ? "FLOW_ARTIFACT_HANDOFF_CONFLICT" : "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
        `canonical source worker handoff could not commit: ${cause.message}`,
        { cause, data: { stepId: request.stepId, handoffDirectory: request.directory } },
      );
    }
    const receipt = canonicalHandoffReceipt(request, submission, this.now);
    cleanupCompletedHandoff(request.handoffRoot, receipt, this.faultInjector);
    return {
      completed: true,
      replayed: false,
      stepId: receipt.stepId,
      handoffDigest: receipt.handoffDigest,
      payloadDigest: receipt.payloadDigest,
    };
  }
}
