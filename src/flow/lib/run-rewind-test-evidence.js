import fs from "node:fs";
import path from "node:path";

import { Envelope } from "../../lib/flow-envelope.js";
import { findActiveNode, flowLeafIdsBetween } from "../definition.js";
import {
  buildRepairFingerprint,
  commitImplRepairEffects,
  completeImplRepair,
  completeImplTriage,
  ImplRepairTransitionIntent,
} from "./impl-repair-artifacts.js";
import { FlowCommand } from "./base-command.js";
import { loadIssueLog } from "./set-issue-log.js";
import {
  ExternalBlockedOutcome,
  StepAttemptLog,
} from "./step-outcome.js";
import {
  ExplicitRecoveryTransition,
} from "./step-transition-policy.js";
import { flattenSteps } from "./step-tree.js";
import { readRepairFingerprintManifest } from "./repair-state-identity.js";

const TEST_EXECUTE_RESULT = "test-execute-result.json";
const TEST_RESULT_REVIEW = "test-result-review.json";
const TEST_EXECUTION_LOG = "tests/.raw/test-execution.log";
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

function readBoundedJson(file, label) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    reject("STALE_TEST_EVIDENCE_MISSING", `${label} is missing: ${error.message}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    reject("STALE_TEST_EVIDENCE_AUTHORITY_INVALID", `${label} must be a regular file`);
  }
  if (stat.size > MAX_EVIDENCE_BYTES) {
    reject("STALE_TEST_EVIDENCE_AUTHORITY_INVALID", `${label} exceeds ${MAX_EVIDENCE_BYTES} bytes`);
  }
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      reject("STALE_TEST_EVIDENCE_AUTHORITY_INVALID", `${label} must contain a JSON object`);
    }
    return value;
  } catch (error) {
    if (error instanceof StaleTestEvidenceRecoveryError) throw error;
    reject("STALE_TEST_EVIDENCE_AUTHORITY_INVALID", `${label} is not valid JSON: ${error.message}`);
  }
}

class StaleTestEvidenceAuthority {
  constructor({ root, specPath, executeArtifact, reviewArtifact }) {
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
    const rawFile = path.resolve(root, expectedRawPath);
    if (!fs.existsSync(rawFile) || !fs.lstatSync(rawFile).isFile()) {
      reject("STALE_TEST_EVIDENCE_MISSING", "the referenced raw test output is missing");
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

function assertFlowLevelImplGateBlocked(state) {
  const active = findActiveNode(state);
  const flowInProgress = flattenSteps(state.steps || []).filter((step) => step.status === "in_progress");
  const taskInProgress = (state.tasks || []).flatMap((task) => (
    flattenSteps(task.steps || []).filter((step) => step.status === "in_progress")
  ));
  if (
    active?.scope !== "flow"
    || active.stepId !== "impl-gate"
    || flowInProgress.length !== 1
    || flowInProgress[0].id !== "impl-gate"
    || taskInProgress.length !== 0
  ) {
    reject(
      "STALE_TEST_EVIDENCE_LIFECYCLE_MISMATCH",
      "recovery requires one unambiguous flow-level impl-gate in_progress lifecycle",
    );
  }

  const attempts = new StepAttemptLog(state.stepAttempts || []);
  const latest = attempts.latestForRun(state.runId);
  if (
    latest?.taskId !== null
    || latest?.stepId !== "impl-gate"
    || !(latest.outcome instanceof ExternalBlockedOutcome)
  ) {
    reject(
      "STALE_TEST_EVIDENCE_BLOCKER_MISMATCH",
      "the latest flow attempt must be a flow-level impl-gate external-blocked outcome",
    );
  }
  return latest;
}

function latestFingerprintMismatch(root, state) {
  const entries = loadIssueLog(root, state.spec).entries || [];
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

function loadStaleTestEvidence(root, state) {
  const specDir = path.dirname(path.resolve(root, state.spec));
  return {
    specDir,
    authority: new StaleTestEvidenceAuthority({
      root,
      specPath: state.spec,
      executeArtifact: readBoundedJson(path.join(specDir, TEST_EXECUTE_RESULT), TEST_EXECUTE_RESULT),
      reviewArtifact: readBoundedJson(path.join(specDir, TEST_RESULT_REVIEW), TEST_RESULT_REVIEW),
    }),
  };
}

function assertRepairReady({ root, state, specDir, authority, mismatch }) {
  const previous = readRepairFingerprintManifest(specDir);
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
  const triage = completeImplTriage({ specDir });
  if (!triage.requiresRepair) {
    reject(
      "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      "current repair evidence has no applied impl-triage finding",
    );
  }
  return { previous, current };
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

    try {
      assertFlowLevelImplGateBlocked(state);
      const mismatch = latestFingerprintMismatch(ctx.root, state);
      const { specDir, authority } = loadStaleTestEvidence(ctx.root, state);
      const { previous, current } = assertRepairReady({
        root: ctx.root,
        state,
        specDir,
        authority,
        mismatch,
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
      };
      ctx.flowManager.updateStepStatus(
        transition,
        mutationOptions,
        new ImplRepairTransitionIntent(completed.transaction),
      );
      commitImplRepairEffects({
        root: ctx.root,
        state,
        flowManager: ctx.flowManager,
        transaction: completed.transaction,
        specId: ctx.specId,
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
        previousRepairFingerprint: previous.hash,
        currentRepairFingerprint: current.hash,
        repair: completed.entry,
        invalidatedArtifacts: completed.invalidations.map((entry) => entry.path),
        activeStep: active.stepId,
      });
    } catch (error) {
      if (error instanceof StaleTestEvidenceRecoveryError) {
        return Envelope.fail("run", "rewind-test-evidence", error.code, error.message);
      }
      return Envelope.fail(
        "run",
        "rewind-test-evidence",
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
        `stale test evidence recovery rejected: ${error.message}`,
      );
    }
  }
}
