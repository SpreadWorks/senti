import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { Envelope } from "../../lib/flow-envelope.js";
import { findActiveNode, flowLeafIdsBetween } from "../definition.js";
import {
  buildRepairFingerprint,
  commitImplRepairEffects,
  completeImplRepair,
  completeImplTriage,
  IMPL_TRIAGE_ARTIFACT_FILE,
  ImplRepairPrecommitAuthority,
  ImplRepairTransitionIntent,
} from "./impl-repair-artifacts.js";
import { FlowCommand } from "./base-command.js";
import {
  ExternalBlockedOutcome,
  StepAttemptLog,
} from "./step-outcome.js";
import {
  ExplicitRecoveryTransition,
} from "./step-transition-policy.js";
import { resolveGatePhaseFromState } from "./gate-step.js";
import { flattenSteps } from "./step-tree.js";
import {
  REPAIR_FINGERPRINT_MANIFEST_FILE,
  RepairFingerprintManifest,
} from "./repair-state-identity.js";

const TEST_EXECUTE_RESULT = "test-execute-result.json";
const TEST_RESULT_REVIEW = "test-result-review.json";
const TEST_EXECUTION_LOG = "tests/.raw/test-execution.log";
const ISSUE_LOG = "issue-log.json";
const IMPL_REVIEW = "impl-review.json";
const IMPL_GATE_RESULT = "impl-gate-result.json";
const MAX_EVIDENCE_BYTES = 1024 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const FINGERPRINT_MISMATCH_PATTERN = /^(test-execute-result\.json|test-result-review\.json) repairFingerprint mismatch: expected ([a-f0-9]{64}), got ([a-f0-9]{64})$/;
const REQUIRED_RESET_STEPS = Object.freeze([
  "test-execute",
  "test-result-review",
  "impl-review",
  "impl-gate",
]);

class StaleTestEvidenceRecoveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StaleTestEvidenceRecoveryError";
    this.code = code;
  }
}

function reject(code, message) {
  throw new StaleTestEvidenceRecoveryError(code, message);
}

function normalizeRepoPath(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    reject("STALE_TEST_EVIDENCE_AUTHORITY_INVALID", `${field} must be a non-empty repository-relative path`);
  }
  const normalized = value.replaceAll("\\", "/");
  if (
    path.posix.isAbsolute(normalized)
    || normalized === ".."
    || normalized.startsWith("../")
    || normalized.includes("/../")
  ) {
    reject("STALE_TEST_EVIDENCE_AUTHORITY_INVALID", `${field} escapes the repository authority`);
  }
  return path.posix.normalize(normalized);
}

function fileIdentity(stat) {
  return Object.freeze({
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    mode: stat.mode.toString(),
    nlink: stat.nlink.toString(),
    size: stat.size.toString(),
    mtimeNs: stat.mtimeNs.toString(),
    ctimeNs: stat.ctimeNs.toString(),
  });
}

function sameFileIdentity(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

class SecureBoundedFileSnapshot {
  constructor({ file, label, descriptor, identity, bytes }) {
    this.file = file;
    this.label = label;
    this.descriptor = descriptor;
    this.identity = identity;
    this.bytes = Buffer.from(bytes);
    Object.freeze(this);
  }

  static capture(file, label) {
    let descriptor;
    const flags = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW;
    try {
      descriptor = fs.openSync(file, flags);
    } catch (error) {
      const code = error.code === "ENOENT"
        ? "STALE_TEST_EVIDENCE_MISSING"
        : "STALE_TEST_EVIDENCE_AUTHORITY_INVALID";
      reject(code, `${label} cannot be opened as a real file: ${error.message}`);
    }

    try {
      const before = fs.fstatSync(descriptor, { bigint: true });
      if (!before.isFile()) {
        reject("STALE_TEST_EVIDENCE_AUTHORITY_INVALID", `${label} must be a regular file`);
      }
      if (before.size > BigInt(MAX_EVIDENCE_BYTES)) {
        reject(
          "STALE_TEST_EVIDENCE_AUTHORITY_INVALID",
          `${label} exceeds ${MAX_EVIDENCE_BYTES} bytes`,
        );
      }
      const chunks = [];
      let total = 0;
      while (total <= MAX_EVIDENCE_BYTES) {
        const chunk = Buffer.alloc(Math.min(
          64 * 1024,
          MAX_EVIDENCE_BYTES + 1 - total,
        ));
        const count = fs.readSync(descriptor, chunk, 0, chunk.length, null);
        if (count === 0) break;
        chunks.push(chunk.subarray(0, count));
        total += count;
      }
      if (total > MAX_EVIDENCE_BYTES) {
        reject(
          "STALE_TEST_EVIDENCE_AUTHORITY_INVALID",
          `${label} exceeds ${MAX_EVIDENCE_BYTES} bytes`,
        );
      }
      const bytes = Buffer.concat(chunks, total);
      const after = fs.fstatSync(descriptor, { bigint: true });
      const beforeIdentity = fileIdentity(before);
      if (
        !sameFileIdentity(beforeIdentity, fileIdentity(after))
        || after.size !== BigInt(bytes.length)
      ) {
        reject(
          "STALE_TEST_EVIDENCE_AUTHORITY_INVALID",
          `${label} changed while its authority was captured`,
        );
      }
      return new SecureBoundedFileSnapshot({
        file,
        label,
        descriptor,
        identity: beforeIdentity,
        bytes,
      });
    } catch (error) {
      fs.closeSync(descriptor);
      throw error;
    }
  }

  json() {
    try {
      const value = JSON.parse(this.bytes.toString("utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        reject("STALE_TEST_EVIDENCE_AUTHORITY_INVALID", `${this.label} must contain a JSON object`);
      }
      return value;
    } catch (error) {
      if (error instanceof StaleTestEvidenceRecoveryError) throw error;
      reject(
        "STALE_TEST_EVIDENCE_AUTHORITY_INVALID",
        `${this.label} is not valid JSON: ${error.message}`,
      );
    }
  }

  assertCurrent() {
    let observed = null;
    try {
      observed = SecureBoundedFileSnapshot.capture(this.file, this.label);
      if (
        !sameFileIdentity(this.identity, observed.identity)
        || !this.bytes.equals(observed.bytes)
      ) {
        reject(
          "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
          `${this.label} authority changed before recovery mutation`,
        );
      }
    } catch (error) {
      if (
        error instanceof StaleTestEvidenceRecoveryError
        && error.code === "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED"
      ) {
        throw error;
      }
      reject(
        "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
        `${this.label} authority changed before recovery mutation: ${error.message}`,
      );
    } finally {
      observed?.close();
    }
  }

  close() {
    try {
      fs.closeSync(this.descriptor);
    } catch (error) {
      if (error.code !== "EBADF") throw error;
    }
  }
}

function captureJson(file, label) {
  const snapshot = SecureBoundedFileSnapshot.capture(file, label);
  try {
    return { snapshot, value: snapshot.json() };
  } catch (error) {
    snapshot.close();
    throw error;
  }
}

function captureMaterializationJson(file, label) {
  try {
    return captureJson(file, label);
  } catch (error) {
    reject(
      "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      `${label} repair materialization is unavailable: ${error.message}`,
    );
  }
}

class StaleTestEvidenceAuthority {
  constructor({ specPath, executeArtifact, reviewArtifact }) {
    const executeHash = String(executeArtifact.repairFingerprint || "");
    const reviewHash = String(reviewArtifact.repairFingerprint || "");
    if (!HASH_PATTERN.test(executeHash) || !HASH_PATTERN.test(reviewHash)) {
      reject(
        "STALE_TEST_EVIDENCE_AUTHORITY_INVALID",
        "test-execute and test-result-review must both carry a repairFingerprint",
      );
    }
    if (executeHash !== reviewHash) {
      reject(
        "STALE_TEST_EVIDENCE_AUTHORITY_MISMATCH",
        "test-execute and test-result-review repairFingerprint values do not match",
      );
    }

    const specDirectory = path.posix.dirname(specPath.replaceAll("\\", "/"));
    const expectedResultPath = `${specDirectory}/${TEST_EXECUTE_RESULT}`;
    const expectedRawPath = `${specDirectory}/${TEST_EXECUTION_LOG}`;
    const resultPath = normalizeRepoPath(reviewArtifact.result_file_path, "test-result-review.result_file_path");
    const executeRawPath = normalizeRepoPath(executeArtifact.raw_output_path, "test-execute.raw_output_path");
    const reviewRawPath = normalizeRepoPath(reviewArtifact.raw_output_path, "test-result-review.raw_output_path");
    if (resultPath !== expectedResultPath) {
      reject(
        "STALE_TEST_EVIDENCE_AUTHORITY_MISMATCH",
        "test-result-review does not reference the active spec test-execute result",
      );
    }
    if (executeRawPath !== expectedRawPath || reviewRawPath !== expectedRawPath) {
      reject(
        "STALE_TEST_EVIDENCE_AUTHORITY_MISMATCH",
        "test-execute and test-result-review do not reference the active spec raw test output",
      );
    }
    this.fingerprint = executeHash;
    this.executeArtifact = executeArtifact;
    this.reviewArtifact = reviewArtifact;
    Object.freeze(this);
  }
}

function requireExactGuards(ctx, state) {
  const missing = [];
  if (ctx.expectRunId == null) missing.push("--expect-run-id");
  if (ctx.expectSpec == null) missing.push("--expect-spec");
  if (state.issue == null) {
    if (ctx.expectNoIssue !== true) missing.push("--expect-no-issue");
  } else if (ctx.expectIssue == null) {
    missing.push("--expect-issue");
  }
  if (missing.length > 0) {
    return Envelope.fail(
      "run",
      "rewind-test-evidence",
      "TARGET_GUARDS_REQUIRED",
      `stale test evidence recovery requires explicit target guards: ${missing.join(", ")}`,
    );
  }
  return null;
}

class ImplGateBlockerAuthority {
  constructor(state) {
    const active = findActiveNode(state);
    const flowInProgress = flattenSteps(state.steps || []).filter((step) => step.status === "in_progress");
    const taskInProgress = (state.tasks || []).flatMap((task) => (
      flattenSteps(task.steps || []).filter((step) => step.status === "in_progress")
    ));
    const phase = resolveGatePhaseFromState(state);
    if (
      active?.scope !== "flow"
      || active.stepId !== "impl-gate"
      || phase?.phase !== "integration"
      || flowInProgress.length !== 1
      || flowInProgress[0].id !== "impl-gate"
      || taskInProgress.length !== 0
    ) {
      reject(
        "STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH",
        "recovery requires one unambiguous flow-level integration impl-gate lifecycle with no active task leaf",
      );
    }

    const attempts = new StepAttemptLog(state.stepAttempts || []);
    const latest = attempts.latestForRun(state.runId);
    if (
      latest?.stepId !== "impl-gate"
      || !(latest.outcome instanceof ExternalBlockedOutcome)
    ) {
      reject(
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
        "the latest flow attempt must be an impl-gate external-blocked outcome",
      );
    }

    this.latest = latest;
    this.staleTaskOwner = latest.taskId === null
      ? null
      : this.#resolveStaleTaskOwner(state, latest.taskId);
    Object.freeze(this);
  }

  #resolveStaleTaskOwner(state, taskId) {
    const task = (state.tasks || []).find((candidate) => candidate.id === taskId);
    const leaves = task ? flattenSteps(task.steps || []) : [];
    if (
      state.currentTaskId !== taskId
      || !task
      || task.status !== "in_progress"
      || leaves.length === 0
      || leaves.some((step) => !["done", "skipped"].includes(step.status))
    ) {
      reject(
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
        "the non-null impl-gate attempt owner must be the stale current task with completed task leaves",
      );
    }
    return task;
  }

  captureIntegrationArtifact(specDir, capture) {
    if (this.staleTaskOwner === null) return;
    const gate = capture(path.join(specDir, IMPL_GATE_RESULT), IMPL_GATE_RESULT);
    const artifact = gate.value;
    if (
      artifact.level !== "integration"
      || artifact.phase !== "integration"
      || artifact.contractSummary?.targetStep !== "impl-gate"
      || Object.hasOwn(artifact, "taskId")
      || Object.hasOwn(artifact, "target")
    ) {
      reject(
        "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
        "the stale task owner is not backed by an unscoped integration impl-gate artifact",
      );
    }
  }
}

function assertFlowLevelImplGateBlocked(state) {
  return new ImplGateBlockerAuthority(state);
}

function latestFingerprintMismatch(entries) {
  const gateFailures = entries.filter((entry) => (
    entry?.step === "impl-gate"
    && entry?.phase === "integration"
    && entry?.trigger === "gate onError hook (auto)"
    && typeof entry?.reason === "string"
  ));
  const latest = gateFailures.at(-1);
  const match = latest?.reason.match(FINGERPRINT_MISMATCH_PATTERN);
  if (!match) {
    reject(
      "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
      "the latest structural impl-gate failure is not a test evidence repairFingerprint mismatch",
    );
  }
  return Object.freeze({
    artifact: match[1],
    expected: match[2],
    observed: match[3],
  });
}

function flowIdentity(state) {
  return Object.freeze({
    runId: state.runId,
    spec: state.spec,
    hasIssue: Object.hasOwn(state, "issue") && state.issue != null,
    issue: state.issue == null ? null : Number(state.issue),
  });
}

function sameFlowIdentity(left, right) {
  return (
    left.runId === right.runId
    && left.spec === right.spec
    && left.hasIssue === right.hasIssue
    && left.issue === right.issue
  );
}

class StaleTestEvidenceAuthoritySnapshot extends ImplRepairPrecommitAuthority {
  constructor({
    root,
    specDir,
    specId,
    state,
    files,
    issueLog,
    authority,
    previous,
    current,
    mismatch,
  }) {
    super();
    this.root = root;
    this.specDir = specDir;
    this.specId = specId;
    this.originalState = structuredClone(state);
    this.identity = flowIdentity(state);
    this.files = Object.freeze([...files]);
    this.issueLog = issueLog;
    this.authority = authority;
    this.previous = previous;
    this.current = current;
    this.mismatch = mismatch;
    Object.freeze(this);
  }

  static capture({ root, state, specId }) {
    const files = [];
    const capture = (file, label, { materialization = false } = {}) => {
      const captured = materialization
        ? captureMaterializationJson(file, label)
        : captureJson(file, label);
      files.push(captured.snapshot);
      return captured;
    };
    try {
      const blockerAuthority = assertFlowLevelImplGateBlocked(state);
      const specDir = path.dirname(path.resolve(root, state.spec));
      const issueLog = capture(path.join(specDir, ISSUE_LOG), ISSUE_LOG);
      if (!Array.isArray(issueLog.value.entries)) {
        reject("STALE_TEST_EVIDENCE_BLOCKER_MISMATCH", `${ISSUE_LOG} entries must be an array`);
      }
      const mismatch = latestFingerprintMismatch(issueLog.value.entries);
      blockerAuthority.captureIntegrationArtifact(specDir, capture);
      const execute = capture(path.join(specDir, TEST_EXECUTE_RESULT), TEST_EXECUTE_RESULT);
      const review = capture(path.join(specDir, TEST_RESULT_REVIEW), TEST_RESULT_REVIEW);
      const authority = new StaleTestEvidenceAuthority({
        specPath: state.spec,
        executeArtifact: execute.value,
        reviewArtifact: review.value,
      });
      const raw = SecureBoundedFileSnapshot.capture(
        path.join(specDir, TEST_EXECUTION_LOG),
        TEST_EXECUTION_LOG,
      );
      files.push(raw);
      const manifest = capture(
        path.join(specDir, REPAIR_FINGERPRINT_MANIFEST_FILE),
        REPAIR_FINGERPRINT_MANIFEST_FILE,
        { materialization: true },
      );
      let previous;
      try {
        previous = new RepairFingerprintManifest(manifest.value);
      } catch (error) {
        reject(
          "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
          `${REPAIR_FINGERPRINT_MANIFEST_FILE} repair materialization is invalid: ${error.message}`,
        );
      }
      const triage = capture(
        path.join(specDir, IMPL_TRIAGE_ARTIFACT_FILE),
        IMPL_TRIAGE_ARTIFACT_FILE,
        { materialization: true },
      );
      if (
        triage.value.sourceStep !== "impl-review"
        || triage.value.sourceArtifact !== IMPL_REVIEW
      ) {
        reject(
          "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
          "stale implementation test evidence requires impl-review triage authority",
        );
      }
      capture(path.join(specDir, IMPL_REVIEW), IMPL_REVIEW, { materialization: true });
      try {
        const triageResult = completeImplTriage({ specDir });
        if (!triageResult.requiresRepair) {
          reject(
            "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
            "current repair evidence has no applied impl-triage finding",
          );
        }
      } catch (error) {
        if (
          error instanceof StaleTestEvidenceRecoveryError
          && error.code === "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED"
        ) {
          throw error;
        }
        reject(
          "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
          `impl-triage repair materialization is invalid: ${error.message}`,
        );
      }
      const current = buildRepairFingerprint({ root, specPath: state.spec, state });
      if (authority.fingerprint !== previous.hash) {
        reject(
          "STALE_TEST_EVIDENCE_AUTHORITY_MISMATCH",
          "stale test evidence does not match the materialized repair manifest",
        );
      }
      if (current.hash === previous.hash) {
        reject(
          "STALE_TEST_EVIDENCE_ALREADY_CURRENT",
          "test evidence already matches the current repair fingerprint",
        );
      }
      if (
        mismatch.expected !== current.hash
        || mismatch.observed !== authority.fingerprint
      ) {
        reject(
          "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
          "the structural failure fingerprint pair does not match current and stale evidence",
        );
      }
      return new StaleTestEvidenceAuthoritySnapshot({
        root,
        specDir,
        specId: specId || state.spec.split("/")[1],
        state,
        files,
        issueLog: issueLog.snapshot,
        authority,
        previous,
        current,
        mismatch,
      });
    } catch (error) {
      for (const file of files) file.close();
      throw error;
    }
  }

  assertTransition(state, transaction) {
    try {
      this.#assertIdentity(state);
      if (!isDeepStrictEqual(state, this.originalState)) {
        reject(
          "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
          "flow revision changed before stale test evidence recovery",
        );
      }
      assertFlowLevelImplGateBlocked(state);
      const mismatch = latestFingerprintMismatch(this.issueLog.json().entries);
      if (!isDeepStrictEqual(mismatch, this.mismatch)) {
        reject(
          "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
          "structural blocker authority changed before recovery mutation",
        );
      }
      this.#assertEvidenceAndRepair(state, transaction);
    } catch (error) {
      this.#rejectChanged(error);
    }
  }

  assertEffects(state, transaction) {
    try {
      this.#assertIdentity(state);
      const active = findActiveNode(state);
      if (active?.scope !== "flow" || active.stepId !== "test-execute") {
        reject(
          "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
          "owned impl-repair transition is not active at test-execute",
        );
      }
      if (
        state.implRepairTransaction == null
        || !isDeepStrictEqual(state.implRepairTransaction, transaction.toJSON())
      ) {
        reject(
          "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
          "owned impl-repair transaction changed before effects commit",
        );
      }
      this.#assertEvidenceAndRepair(state, transaction);
    } catch (error) {
      this.#rejectChanged(error);
    }
  }

  #assertIdentity(state) {
    if (!sameFlowIdentity(this.identity, flowIdentity(state))) {
      reject(
        "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
        "flow run, spec, or Issue authority changed before recovery mutation",
      );
    }
  }

  #assertEvidenceAndRepair(state, transaction) {
    for (const file of this.files) file.assertCurrent();
    const observed = buildRepairFingerprint({
      root: this.root,
      specPath: this.identity.spec,
      state,
    });
    if (
      observed.hash !== this.current.hash
      || transaction.currentManifest.hash !== this.current.hash
      || transaction.entry.previousHash !== this.previous.hash
      || transaction.entry.currentHash !== this.current.hash
    ) {
      reject(
        "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
        "repair fingerprint authority changed before recovery mutation",
      );
    }
    try {
      const triage = completeImplTriage({ specDir: this.specDir });
      if (!triage.requiresRepair) throw new Error("impl-triage no longer requires repair");
    } catch (error) {
      reject(
        "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
        `impl-triage materialization changed before recovery mutation: ${error.message}`,
      );
    }
  }

  #rejectChanged(error) {
    if (
      error instanceof StaleTestEvidenceRecoveryError
      && error.code === "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED"
    ) {
      throw error;
    }
    reject(
      "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
      `stale test evidence authority changed before recovery mutation: ${error.message}`,
    );
  }

  close() {
    for (const file of this.files) file.close();
  }
}

function recoveryTransition(completed) {
  const changes = completed.stepChanges;
  for (const stepId of REQUIRED_RESET_STEPS) {
    const change = changes.find((candidate) => candidate.stepId === stepId);
    const expectedStatus = stepId === "test-execute" ? "in_progress" : "pending";
    if (!change || change.requestedStatus !== expectedStatus) {
      reject(
        "STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH",
        `impl-repair recovery did not produce ${stepId}=${expectedStatus}`,
      );
    }
  }
  if (changes.length === 0) {
    reject("STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH", "impl-repair recovery produced no lifecycle changes");
  }
  return new ExplicitRecoveryTransition({
    stepId: changes[0].stepId,
    currentStatus: changes[0].currentStatus,
    requestedStatus: changes[0].requestedStatus,
    entrypoint: "impl-repair-invalidation",
    changes,
  });
}

export default class RunRewindTestEvidenceCommand extends FlowCommand {
  async execute(ctx) {
    const state = ctx.flowState;
    const guardFailure = requireExactGuards(ctx, state);
    if (guardFailure) return guardFailure;

    let snapshot = null;
    try {
      snapshot = StaleTestEvidenceAuthoritySnapshot.capture({
        root: ctx.root,
        state,
        specId: ctx.specId,
      });
      const completed = completeImplRepair({
        root: ctx.root,
        state,
        resetStepIds: flowLeafIdsBetween("test-execute", "finalize-cleanup"),
      });
      const transition = recoveryTransition(completed);
      const mutationOptions = {
        ...(ctx.specId ? { specId: ctx.specId } : {}),
        taskId: null,
        expectedOriginal: state,
        passThroughError: (error) => error instanceof StaleTestEvidenceRecoveryError,
      };
      if (this.container.has("staleTestEvidenceRecoveryFaultInjector")) {
        this.container.get("staleTestEvidenceRecoveryFaultInjector")({
          phase: "before-update-step-statuses",
          root: ctx.root,
          specDir: snapshot.specDir,
          specId: snapshot.specId,
          flowManager: ctx.flowManager,
        });
      }
      ctx.flowManager.updateStepStatus(
        transition,
        mutationOptions,
        new ImplRepairTransitionIntent(completed.transaction, snapshot),
      );
      commitImplRepairEffects({
        root: ctx.root,
        state,
        flowManager: ctx.flowManager,
        transaction: completed.transaction,
        specId: ctx.specId,
        precommitAuthority: snapshot,
      });

      const refreshed = ctx.specId
        ? ctx.flowManager.loadReadOnly(ctx.specId)
        : ctx.flowManager.loadReadOnly();
      const active = findActiveNode(refreshed);
      if (active?.scope !== "flow" || active.stepId !== "test-execute") {
        reject(
          "STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH",
          "committed recovery did not promote flow-level test-execute",
        );
      }
      return Envelope.ok("run", "rewind-test-evidence", {
        recovered: true,
        previousRepairFingerprint: snapshot.previous.hash,
        currentRepairFingerprint: snapshot.current.hash,
        repair: completed.entry,
        invalidatedArtifacts: completed.invalidations.map((entry) => entry.path),
        activeStep: active.stepId,
      });
    } catch (error) {
      if (error instanceof StaleTestEvidenceRecoveryError) {
        return Envelope.fail("run", "rewind-test-evidence", error.code, error.message);
      }
      if (error?.code === "FLOW_STATE_ATOMIC_STALE") {
        return Envelope.fail(
          "run",
          "rewind-test-evidence",
          "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
          "flow revision changed before stale test evidence recovery mutation",
        );
      }
      return Envelope.fail(
        "run",
        "rewind-test-evidence",
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
        `stale test evidence recovery rejected: ${error.message}`,
      );
    } finally {
      snapshot?.close();
    }
  }
}
