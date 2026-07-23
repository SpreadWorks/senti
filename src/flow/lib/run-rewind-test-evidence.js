import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { Envelope } from "../../lib/flow-envelope.js";
import { runGit } from "../../lib/git-helpers.js";
import { findActiveNode, flowLeafIdsBetween } from "../definition.js";
import {
  buildRepairFingerprint,
  ChangedPathGroup,
  commitImplRepairEffects,
  completeImplRepair,
  completeImplTriage,
  EVIDENCE_FILE_BY_STEP,
  IMPL_TRIAGE_ARTIFACT_FILE,
  ImplRepairEntry,
  ImplRepairLedger,
  ImplRepairPrecommitAuthority,
  ImplRepairTransaction,
  ImplRepairTransitionIntent,
  InvalidatedArtifactRecord,
  readImplRepairLedger,
} from "./impl-repair-artifacts.js";
import { FlowCommand } from "./base-command.js";
import { IssueLogDocument } from "./issue-log-store.js";
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
  changedRepairPaths,
  REPAIR_DELTA_DIR,
  REPAIR_FINGERPRINT_MANIFEST_FILE,
  RepairArtifactRegistry,
  RepairFingerprintManifest,
  repairDeltaArtifact,
} from "./repair-state-identity.js";

const TEST_EXECUTE_RESULT = "test-execute-result.json";
const TEST_RESULT_REVIEW = "test-result-review.json";
const TEST_EXECUTION_LOG = "tests/.raw/test-execution.log";
const ISSUE_LOG = "issue-log.json";
const IMPL_REVIEW = "impl-review.json";
const IMPL_GATE_RESULT = "impl-gate-result.json";
const MAX_EVIDENCE_BYTES = 1024 * 1024;
const MAX_SEMANTIC_FINDINGS = 100;
const MAX_REPAIR_REFERENCES = 100;
const CHANGED_PATH_PREVIEW_LIMIT = 20;
const CHANGED_PATH_GROUP_LIMIT = 20;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const FINGERPRINT_MISMATCH_PATTERN = /^(test-execute-result\.json|test-result-review\.json) repairFingerprint mismatch: expected ([a-f0-9]{64}), got ([a-f0-9]{64})$/;
const REQUIRED_RESET_STEPS = Object.freeze([
  "test-execute",
  "test-result-review",
  "impl-review",
  "impl-gate",
]);
const ASSOCIATED_EVIDENCE_PATHS = Object.freeze({
  [TEST_EXECUTE_RESULT]: [TEST_EXECUTION_LOG],
  [TEST_RESULT_REVIEW]: ["test-result-review.md"],
  [IMPL_REVIEW]: ["review.md"],
});

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
    if (this.staleTaskOwner === null) return null;
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
    return gate;
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
    timestamp: latest.timestamp,
  });
}

function parseTimestamp(value, field) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    reject("STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED", `${field} must be an ISO timestamp`);
  }
  return timestamp;
}

function gitResult(root, args, label) {
  const result = runGit(args, { cwd: root });
  if (!result.ok) {
    reject(
      "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      `${label}: ${result.stderr.trim() || "Git authority query failed"}`,
    );
  }
  return result.stdout.trim();
}

function gitBlobOid(bytes, objectFormat) {
  const algorithm = objectFormat === "sha256" ? "sha256" : "sha1";
  return crypto.createHash(algorithm)
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest("hex");
}

function containsRequirement(value, requirementId) {
  const escaped = requirementId.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}([^A-Za-z0-9_-]|$)`).test(
    Array.isArray(value) ? value.join("\n") : String(value || ""),
  );
}

class MaterialRepairEvidenceAuthority {
  constructor({
    root,
    state,
    specDir,
    issueLog,
    gateArtifact,
    mismatch,
    previous,
    capture,
    captureFile,
  }) {
    if (previous.baseline.kind !== "git") {
      reject(
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
        "formal material repair evidence requires a Git repair baseline",
      );
    }
    const structuralAt = parseTimestamp(mismatch.timestamp, "structural blocker timestamp");
    const artifact = gateArtifact.value;
    const artifactAt = parseTimestamp(artifact.generatedAt, `${IMPL_GATE_RESULT}.generatedAt`);
    if (
      artifactAt >= structuralAt
      || artifact.level !== "integration"
      || artifact.phase !== "integration"
      || artifact.contractSummary?.targetStep !== "impl-gate"
      || artifact.repairFingerprint !== previous.hash
      || Object.hasOwn(artifact, "taskId")
      || Object.hasOwn(artifact, "target")
    ) {
      reject(
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
        "material repair evidence requires the preceding unscoped semantic integration gate artifact",
      );
    }

    const findings = (artifact.evaluations || []).filter((finding) => (
      finding?.result === "fail"
      && finding?.disposition === "must-fix"
      && HASH_PATTERN.test(String(finding?.findingId || ""))
      && typeof finding?.requirementId === "string"
      && finding.requirementId.trim() !== ""
    ));
    if (findings.length === 0 || findings.length > MAX_SEMANTIC_FINDINGS) {
      reject(
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
        `semantic integration findings must contain 1-${MAX_SEMANTIC_FINDINGS} must-fix entries`,
      );
    }

    const spec = capture(path.resolve(root, state.spec), state.spec).value;
    const document = new IssueLogDocument(issueLog);
    if (document.entries.length > MAX_REPAIR_REFERENCES) {
      reject(
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
        `formal repair issue-log entries exceed ${MAX_REPAIR_REFERENCES}`,
      );
    }
    const registry = new RepairArtifactRegistry(state.spec);
    const specPrefix = `${path.posix.dirname(state.spec.replaceAll("\\", "/"))}/`;
    const qualified = [];
    for (const finding of findings) {
      const findingAt = parseTimestamp(
        finding.reportedAt || artifact.generatedAt,
        `finding ${finding.findingId} reportedAt`,
      );
      const entries = document.entries.filter((entry) => (
        entry?.normalizedFindingId === finding.findingId
        && entry?.step === "impl-gate"
        && (entry.phase == null || entry.phase === "integration")
        && typeof entry?.trigger === "string"
        && /\bintegration gate\b/i.test(entry.trigger)
        && typeof entry?.reason === "string"
        && entry.reason.trim() !== ""
      ));
      for (const entry of entries) {
        const entryAt = parseTimestamp(entry.timestamp, `repair entry ${finding.findingId} timestamp`);
        if (entryAt <= findingAt || entryAt >= structuralAt) continue;
        if (!this.#taskMatches(spec, entry.taskId, finding.requirementId)) continue;
        const references = entry.repairRef?.files;
        if (!Array.isArray(references) || references.length === 0) continue;
        if (references.length > MAX_REPAIR_REFERENCES) {
          reject(
            "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
            `repair entry ${finding.findingId} exceeds ${MAX_REPAIR_REFERENCES} file references`,
          );
        }
        for (const reference of references) {
          const relPath = normalizeRepoPath(reference, "issue-log repairRef.files[]");
          if (
            relPath.startsWith(specPrefix)
            || relPath.startsWith(".senti/")
            || registry.owns(relPath)
          ) {
            continue;
          }
          const file = captureFile(path.resolve(root, relPath), relPath);
          if (
            fs.realpathSync(file.file) !== file.file
            || !this.#qualifiesCommittedPath({
              root,
              state,
              relPath,
              bytes: file.bytes,
              findingAt,
              previous,
            })
          ) {
            continue;
          }
          qualified.push(Object.freeze({
            findingId: finding.findingId,
            requirementId: finding.requirementId,
            relPath,
          }));
          break;
        }
        if (qualified.at(-1)?.findingId === finding.findingId) break;
      }
    }
    if (qualified.length === 0) {
      reject(
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
        "no semantic integration finding has qualifying formal material repair evidence",
      );
    }

    this.findingIds = Object.freeze([...new Set(qualified.map((entry) => entry.findingId))]);
    this.paths = Object.freeze([...new Set(qualified.map((entry) => entry.relPath))].sort());
    this.root = root;
    this.baseRef = state.baseBranch;
    this.headOid = gitResult(root, ["rev-parse", "HEAD"], "resolve material repair HEAD");
    this.baseOid = gitResult(root, ["rev-parse", state.baseBranch], "resolve material repair base");
    Object.freeze(this);
  }

  #taskMatches(spec, taskId, requirementId) {
    if (taskId == null) return true;
    const task = Array.isArray(spec.tasks)
      ? spec.tasks.find((candidate) => candidate?.id === taskId)
      : null;
    return Boolean(
      task
      && [
        task.goal,
        task.acceptance,
        task.origin,
      ].some((value) => containsRequirement(value, requirementId)),
    );
  }

  #qualifiesCommittedPath({ root, state, relPath, bytes, findingAt, previous }) {
    const tracked = runGit(["ls-files", "--error-unmatch", "--", relPath], { cwd: root });
    if (!tracked.ok) return false;
    const currentBlob = gitBlobOid(bytes, previous.baseline.objectFormat);
    const headBlob = gitResult(root, ["rev-parse", `HEAD:${relPath}`], `resolve HEAD blob for ${relPath}`);
    if (currentBlob !== headBlob) return false;

    const featureDiff = gitResult(
      root,
      ["diff", "--name-only", `${state.baseBranch}...HEAD`, "--", relPath],
      `resolve feature diff for ${relPath}`,
    ).split("\n").filter(Boolean);
    if (!featureDiff.includes(relPath)) return false;

    const staleBlob = runGit(["rev-parse", `${previous.headOid}:${relPath}`], { cwd: root });
    if (staleBlob.ok && staleBlob.stdout.trim() === currentBlob) return false;
    const manifestEntry = previous.entries.find((entry) => entry.path === relPath);
    const contentHash = crypto.createHash("sha256").update(bytes).digest("hex");
    if (manifestEntry && manifestEntry.contentHash === contentHash) return false;

    const log = gitResult(
      root,
      ["log", "-1", "--format=%H%x00%cI", "--", relPath],
      `resolve material repair commit for ${relPath}`,
    );
    const [commitOid, committedAtValue] = log.split("\0");
    if (!commitOid || parseTimestamp(committedAtValue, `material repair commit ${relPath}`) <= findingAt) {
      return false;
    }
    if (!runGit(["merge-base", "--is-ancestor", commitOid, "HEAD"], { cwd: root }).ok) return false;
    const inBase = runGit(["merge-base", "--is-ancestor", commitOid, state.baseBranch], { cwd: root });
    if (inBase.ok) return false;
    if (inBase.status !== 1) {
      reject(
        "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
        `failed to prove feature-only material repair commit for ${relPath}`,
      );
    }
    return true;
  }

  assertCurrent() {
    if (
      gitResult(this.root, ["rev-parse", "HEAD"], "revalidate material repair HEAD") !== this.headOid
      || gitResult(this.root, ["rev-parse", this.baseRef], "revalidate material repair base") !== this.baseOid
    ) {
      reject(
        "STALE_TEST_EVIDENCE_AUTHORITY_CHANGED",
        "material repair Git authority changed before recovery mutation",
      );
    }
  }
}

function changedPathGroups(paths) {
  const counts = new Map();
  for (const relPath of paths) {
    const parts = relPath.split("/");
    const prefix = parts.length > 1
      ? `${parts.slice(0, Math.min(2, parts.length - 1)).join("/")}/`
      : relPath;
    counts.set(prefix, (counts.get(prefix) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, CHANGED_PATH_GROUP_LIMIT)
    .map(([prefix, count]) => new ChangedPathGroup({ prefix, count }));
}

function planMaterialRepairInvalidations({ specDir, previous, current, reason }) {
  const invalidations = [];
  const plan = (relPath, suffix, previousFingerprint) => {
    if (!fs.existsSync(path.join(specDir, relPath))) return;
    invalidations.push(new InvalidatedArtifactRecord({
      path: relPath,
      reason: `${reason} (${suffix})`,
      previousFingerprint,
    }));
  };
  for (const relPath of Object.values(EVIDENCE_FILE_BY_STEP)) {
    const file = path.join(specDir, relPath);
    if (!fs.existsSync(file)) continue;
    let artifact = null;
    try {
      artifact = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      artifact = null;
    }
    if (artifact?.repairFingerprint === current.hash) continue;
    const previousFingerprint = HASH_PATTERN.test(String(artifact?.repairFingerprint || ""))
      ? artifact.repairFingerprint
      : previous.hash;
    const suffix = artifact?.repairFingerprint
      ? "repair_fingerprint_mismatch"
      : "missing_repair_fingerprint";
    plan(relPath, suffix, previousFingerprint);
    for (const associated of ASSOCIATED_EVIDENCE_PATHS[relPath] || []) {
      plan(associated, `associated_${suffix}`, previousFingerprint);
    }
  }
  return invalidations;
}

function completeMaterialRepair({
  state,
  specDir,
  previous,
  current,
  authority,
  resetStepIds,
}) {
  const changedPaths = changedRepairPaths(previous, current);
  if (changedPaths.length === 0) {
    reject(
      "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      "formal material repair evidence produced no repair fingerprint change",
    );
  }
  const reason = `Material repair requires stale tests to rerun; finding resolution is not asserted (${authority.findingIds.join(", ")}).`;
  const invalidations = planMaterialRepairInvalidations({
    specDir,
    previous,
    current,
    reason,
  });
  if (invalidations.length === 0) {
    reject(
      "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
      "formal material repair must invalidate stale test evidence",
    );
  }
  const existing = readImplRepairLedger(specDir) || new ImplRepairLedger({ version: 2, entries: [] });
  const id = `repair-${String(existing.entries.length + 1).padStart(3, "0")}`;
  const delta = repairDeltaArtifact({
    id,
    previous,
    current,
    changedPaths,
  });
  const entry = new ImplRepairEntry({
    id,
    sourceFindingIds: authority.findingIds,
    reason,
    previousHash: previous.hash,
    currentHash: current.hash,
    changedPathCount: changedPaths.length,
    changedPathsRef: `${REPAIR_DELTA_DIR}/${id}.json`,
    changedPathsDigest: delta.digest,
    changedPathsPreview: changedPaths.slice(0, CHANGED_PATH_PREVIEW_LIMIT),
    changedPathGroups: changedPathGroups(changedPaths),
    invalidations,
    createdAt: new Date().toISOString(),
  });
  const transaction = new ImplRepairTransaction({
    version: 1,
    id,
    sourceStep: "impl-gate",
    resetStepIds,
    entry,
    ledger: existing.append(entry),
    currentManifest: current,
    delta,
    invalidations,
  });
  return {
    entry: entry.toJSON(),
    invalidations: invalidations.map((record) => record.toJSON()),
    stepChanges: resetStepIds.filter((stepId) => stepId !== "impl-repair").flatMap((stepId) => {
      const step = flattenSteps(state.steps || []).find((candidate) => candidate.id === stepId);
      return step ? [{
        stepId,
        currentStatus: step.status,
        requestedStatus: stepId === "test-execute" ? "in_progress" : "pending",
      }] : [];
    }),
    transaction: transaction.toJSON(),
  };
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
    materialRepair,
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
    this.materialRepair = materialRepair;
    Object.freeze(this);
  }

  static capture({ root, state, specId }) {
    const files = [];
    const captureFile = (file, label) => {
      const snapshot = SecureBoundedFileSnapshot.capture(file, label);
      files.push(snapshot);
      return snapshot;
    };
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
      let gateArtifact = blockerAuthority.captureIntegrationArtifact(specDir, capture);
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
      let triageResult;
      try {
        triageResult = completeImplTriage({ specDir });
      } catch (error) {
        reject(
          "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
          `impl-triage repair materialization is invalid: ${error.message}`,
        );
      }
      if (
        triageResult.requiresRepair
        && triageResult.artifact.items.some((item) => item.decision !== "apply")
      ) {
        reject(
          "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
          "mixed impl-triage decisions cannot authorize stale test evidence recovery",
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
      let materialRepair = null;
      if (!triageResult.requiresRepair) {
        if (
          triageResult.artifact.items.length === 0
          || triageResult.artifact.items.some((item) => item.decision !== "reject")
        ) {
          reject(
            "STALE_TEST_EVIDENCE_REPAIR_NOT_MATERIALIZED",
            "material repair recovery requires complete all-reject impl-triage authority",
          );
        }
        gateArtifact ||= capture(path.join(specDir, IMPL_GATE_RESULT), IMPL_GATE_RESULT);
        materialRepair = new MaterialRepairEvidenceAuthority({
          root,
          state,
          specDir,
          issueLog: issueLog.value,
          gateArtifact,
          mismatch,
          previous,
          capture,
          captureFile,
        });
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
        materialRepair,
      });
    } catch (error) {
      for (const file of files) file.close();
      throw error;
    }
  }

  completeRepair(state, resetStepIds) {
    if (this.materialRepair === null) {
      return completeImplRepair({
        root: this.root,
        state,
        resetStepIds,
      });
    }
    return completeMaterialRepair({
      state,
      specDir: this.specDir,
      previous: this.previous,
      current: this.current,
      authority: this.materialRepair,
      resetStepIds,
    });
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
      if (this.materialRepair === null) {
        if (
          !triage.requiresRepair
          || triage.artifact.items.some((item) => item.decision !== "apply")
        ) {
          throw new Error("all-apply impl-triage authority changed");
        }
      } else {
        if (
          triage.requiresRepair
          || triage.artifact.items.length === 0
          || triage.artifact.items.some((item) => item.decision !== "reject")
        ) {
          throw new Error("all-reject impl-triage authority changed");
        }
        if (
          !isDeepStrictEqual(
            transaction.entry.sourceFindingIds,
            this.materialRepair.findingIds,
          )
        ) {
          throw new Error("material repair finding authority changed");
        }
        this.materialRepair.assertCurrent();
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
      const completed = snapshot.completeRepair(
        state,
        flowLeafIdsBetween("test-execute", "finalize-cleanup"),
      );
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
