/**
 * src/flow/lib/run-finalize-cleanup.js
 *
 * finalize-cleanup: clear flow state, commit the final flow.json snapshot to
 * the main repo, remove the worktree + feature branch, and embed the finalize
 * Report in the response envelope so the AI dispatcher does not need a follow-
 * up `flow report show` round-trip (spec 251).
 *
 * Spec 253 — orphan commit detection (squash route only):
 *
 * The cleanup body now executes a 4-stage decision flow before the existing
 * teardown transaction:
 *
 *   (A) args validation      — reject mutually-exclusive flags
 *   (B) route routing        — spec-only / PR / unknown skip decisions
 *   (C) orphan guard         — baseline ancestry + SHA comparison
 *   (D) existing teardown    — (i) step done → (ii) commit → (iv) cleanup
 *
 * Stages (A)/(B)/(C) halt before any side effects (worktree, branch, commit,
 * step status remain unchanged on halt). Once stage (D) starts, the original
 * transactional ordering (R5) is preserved.
 *
 * Recovery paths:
 *  - --auto-rescue: cherry-pick orphan commits onto baseBranch on the main
 *    repo, with detached-worktree fallback when baseBranch is locked, and
 *    `cherry-pick --skip` for empty-patch (duplicate) cases. Conflicts trigger
 *    `cherry-pick --abort` and CHERRY_PICK_CONFLICT halt.
 *  - --force: emit FORCED_ORPHAN_DROP warning, persist the dropped commit list
 *    to issue-log, then proceed to teardown.
 */

import fs from "fs";
import crypto from "node:crypto";
import os from "os";
import path from "path";
import { Envelope } from "../../lib/flow-envelope.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { FinalizeCleanupPathResolver } from "../../lib/finalize-cleanup-paths.js";
import { runGit } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";
import { writeLastFinalizedPointer } from "./run-finalize.js";
import { resolveLatestReportPath, readReportText } from "./run-report-show.js";
import { flattenSteps } from "./step-tree.js";
import { IssueLogStore } from "./issue-log-store.js";
import { runFlowCommandWithPluginLifecycle } from "../../lib/plugin-registry.js";
import { FlowManager } from "../../lib/flow-manager.js";
import { AtomicJsonFile } from "../../lib/atomic-json-file.js";
import { ProcessOwnedLock, RealDirectoryAuthority } from "../../lib/process-owned-lock.js";
import { resolveRepositoryLockRoot } from "../../lib/repository-maintenance-lock.js";

const ORPHAN_COMMIT_LIST_LIMIT = 50;
const SUBMODULE_DIAGNOSTIC_LIMIT = 50;
const SUBMODULE_ERROR_TEXT_LIMIT = 1000;
const RECOVERY_OPTIONS_DETECT = ["cherry-pick", "abort", "force-continue"];
const RECOVERY_OPTIONS_BASELINE = ["archive-and-manual-cherry-pick", "force-continue"];
const RECOVERY_OPTIONS_RESCUE_FAIL = ["archive-and-manual-cherry-pick", "retry-without-rescue"];
const RECOVERY_OPTIONS_DIRTY = ["commit-or-stash-first", "retry-without-rescue"];
const SUBMODULE_RECOVERY_OPTIONS_DIRTY = ["commit-or-stash-first", "clean-submodules-and-retry", "manual-remove-after-review"];
const SUBMODULE_RECOVERY_OPTIONS_STATUS = ["inspect-status-manually", "clean-submodules-and-retry", "manual-remove-after-review"];
const SUBMODULE_RECOVERY_OPTIONS_FORCE = ["inspect-worktree-manually", "manual-remove-after-review", "retry-after-fixing-git-error"];
const FINALIZE_TEARDOWN_VERSION = 2;
const GIT_OBJECT_ID = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const FINALIZE_TEARDOWN_PHASES = Object.freeze([
  "pre-commit",
  "commit-durable",
  "worktree-removed",
  "branch-deleted",
  "validated",
  "pointer-written",
  "active-cleared",
  "completed",
]);
const FINALIZE_REPOSITORY_LOCK_FILE = ".repository-finalize.lock";
const AUTO_RESCUE_CLEANUP_VERSION = 2;
const AUTO_RESCUE_CLEANUP_PHASES = new Set([
  "staged",
  "worktree-added",
  "body-failed",
  "abort-failed",
  "base-updated",
  "cleanup-failed",
]);

function assertExactObjectKeys(value, keys, label) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} has an invalid schema`);
}

export class FinalizeTeardownPhase {
  constructor(name) {
    if (!FINALIZE_TEARDOWN_PHASES.includes(name)) throw new Error(`invalid finalize teardown phase: ${name}`);
    this.name = name;
    this.index = FINALIZE_TEARDOWN_PHASES.indexOf(name);
    Object.freeze(this);
  }

  static from(value) {
    return value instanceof FinalizeTeardownPhase ? value : new FinalizeTeardownPhase(value);
  }

  atLeast(other) {
    return this.index >= FinalizeTeardownPhase.from(other).index;
  }
}

export class FinalizeTeardownResult {
  constructor({ phase, ok, code = null, commitSha = null, at = new Date().toISOString() }) {
    this.phase = FinalizeTeardownPhase.from(phase);
    this.ok = ok === true;
    this.code = code == null ? null : String(code);
    this.commitSha = commitSha == null ? null : String(commitSha);
    this.at = String(at);
    Object.freeze(this);
  }

  static fromStored(value) {
    assertExactObjectKeys(value, ["phase", "ok", "code", "commitSha", "at"], "finalize teardown result");
    if (typeof value.ok !== "boolean") throw new Error("finalize teardown result.ok must be boolean");
    return new FinalizeTeardownResult(value);
  }

  toJSON() {
    return {
      phase: this.phase.name,
      ok: this.ok,
      code: this.code,
      commitSha: this.commitSha,
      at: this.at,
    };
  }
}

class FinalizeDroppedCommit {
  constructor({ sha, subject = null }) {
    if (!GIT_OBJECT_ID.test(String(sha))) throw new Error("forced finalize dropped commit.sha is invalid");
    if (subject != null && typeof subject !== "string") throw new Error("forced finalize dropped commit.subject is invalid");
    this.sha = sha;
    this.subject = subject;
    Object.freeze(this);
  }

  static fromStored(value) {
    assertExactObjectKeys(value, ["sha", "subject"], "forced finalize dropped commit");
    return new FinalizeDroppedCommit(value);
  }

  toJSON() {
    return { sha: this.sha, subject: this.subject };
  }
}

class FinalizeTeardownAuthorization {
  constructor({
    route,
    mergeStrategy,
    forceAuthorized,
    auditId,
    baseline,
    diverged,
    droppedCommits,
    droppedCount,
    droppedTruncated,
  }) {
    if (!new Set(["standard", "forced"]).has(route)) throw new Error("finalize authorization.route is invalid");
    if (![null, "pr", "squash"].includes(mergeStrategy)) throw new Error("finalize authorization.mergeStrategy is invalid");
    if (typeof forceAuthorized !== "boolean") throw new Error("finalize authorization.forceAuthorized is invalid");
    if (baseline != null && !GIT_OBJECT_ID.test(String(baseline))) throw new Error("finalize authorization.baseline is invalid");
    if (typeof diverged !== "boolean") throw new Error("finalize authorization.diverged is invalid");
    if (!Array.isArray(droppedCommits)) throw new Error("finalize authorization.droppedCommits is invalid");
    if (!Number.isSafeInteger(droppedCount) || droppedCount < droppedCommits.length) {
      throw new Error("finalize authorization.droppedCount is invalid");
    }
    if (typeof droppedTruncated !== "boolean") throw new Error("finalize authorization.droppedTruncated is invalid");
    if (route === "forced") {
      if (!forceAuthorized || typeof auditId !== "string" || auditId === "") {
        throw new Error("forced finalize authorization is incomplete");
      }
    } else if (forceAuthorized || auditId != null || baseline != null || diverged || droppedCount !== 0 || droppedTruncated || droppedCommits.length > 0) {
      throw new Error("standard finalize authorization contains forced provenance");
    }
    this.route = route;
    this.mergeStrategy = mergeStrategy;
    this.forceAuthorized = forceAuthorized;
    this.auditId = auditId;
    this.baseline = baseline;
    this.diverged = diverged;
    this.droppedCommits = Object.freeze(droppedCommits.map((commit) => (
      commit instanceof FinalizeDroppedCommit ? commit : new FinalizeDroppedCommit(commit)
    )));
    this.droppedCount = droppedCount;
    this.droppedTruncated = droppedTruncated;
    Object.freeze(this);
  }

  static standard(state) {
    return new FinalizeTeardownAuthorization({
      route: "standard",
      mergeStrategy: state.state?.mergeStrategy ?? null,
      forceAuthorized: false,
      auditId: null,
      baseline: null,
      diverged: false,
      droppedCommits: [],
      droppedCount: 0,
      droppedTruncated: false,
    });
  }

  static forced(state, input) {
    return new FinalizeTeardownAuthorization({
      route: "forced",
      mergeStrategy: state.state?.mergeStrategy ?? null,
      forceAuthorized: true,
      auditId: input.auditId,
      baseline: input.baseline ?? null,
      diverged: input.diverged === true,
      droppedCommits: input.droppedCommits ?? [],
      droppedCount: input.droppedCount ?? input.droppedCommits?.length ?? 0,
      droppedTruncated: input.droppedTruncated === true,
    });
  }

  static fromStored(value) {
    assertExactObjectKeys(value, [
      "route",
      "mergeStrategy",
      "forceAuthorized",
      "auditId",
      "baseline",
      "diverged",
      "droppedCommits",
      "droppedCount",
      "droppedTruncated",
    ], "finalize authorization");
    if (!Array.isArray(value.droppedCommits)) throw new Error("finalize authorization.droppedCommits is invalid");
    return new FinalizeTeardownAuthorization({
      ...value,
      droppedCommits: value.droppedCommits.map((commit) => FinalizeDroppedCommit.fromStored(commit)),
    });
  }

  toJSON() {
    return {
      route: this.route,
      mergeStrategy: this.mergeStrategy,
      forceAuthorized: this.forceAuthorized,
      auditId: this.auditId,
      baseline: this.baseline,
      diverged: this.diverged,
      droppedCommits: this.droppedCommits.map((commit) => commit.toJSON()),
      droppedCount: this.droppedCount,
      droppedTruncated: this.droppedTruncated,
    };
  }
}

class FinalizeCommitExpectation {
  constructor({
    transactionId,
    targetRoot,
    headRef,
    expectedParent,
    stagedTree,
    messageHash,
    baseRef,
    featureRef,
    worktreePath = null,
    worktreeHead = null,
  }) {
    if (typeof transactionId !== "string" || transactionId === "") {
      throw new Error("finalize commit expectation.transactionId is invalid");
    }
    if (typeof targetRoot !== "string" || path.resolve(targetRoot) !== targetRoot) {
      throw new Error("finalize commit expectation.targetRoot is invalid");
    }
    if (typeof headRef !== "string" || !headRef.startsWith("refs/heads/")) {
      throw new Error("finalize commit expectation.headRef is invalid");
    }
    for (const [label, value] of Object.entries({ expectedParent, stagedTree, baseRef, featureRef })) {
      if (!GIT_OBJECT_ID.test(String(value))) throw new Error(`finalize commit expectation.${label} is invalid`);
    }
    if (!SHA256.test(String(messageHash))) {
      throw new Error("finalize commit expectation.messageHash is invalid");
    }
    if ((worktreePath == null) !== (worktreeHead == null)) {
      throw new Error("finalize commit expectation worktree authority is incomplete");
    }
    if (worktreePath != null && (typeof worktreePath !== "string" || path.resolve(worktreePath) !== worktreePath)) {
      throw new Error("finalize commit expectation.worktreePath is invalid");
    }
    if (worktreeHead != null && !GIT_OBJECT_ID.test(String(worktreeHead))) {
      throw new Error("finalize commit expectation.worktreeHead is invalid");
    }
    this.transactionId = transactionId;
    this.targetRoot = targetRoot;
    this.headRef = headRef;
    this.expectedParent = expectedParent;
    this.stagedTree = stagedTree;
    this.messageHash = messageHash;
    this.baseRef = baseRef;
    this.featureRef = featureRef;
    this.worktreePath = worktreePath;
    this.worktreeHead = worktreeHead;
    Object.freeze(this);
  }

  static fromStored(value) {
    assertExactObjectKeys(value, [
      "transactionId",
      "targetRoot",
      "headRef",
      "expectedParent",
      "stagedTree",
      "messageHash",
      "baseRef",
      "featureRef",
      "worktreePath",
      "worktreeHead",
    ], "finalize commit expectation");
    return new FinalizeCommitExpectation(value);
  }

  equals(other) {
    const candidate = other instanceof FinalizeCommitExpectation
      ? other
      : FinalizeCommitExpectation.fromStored(other);
    return JSON.stringify(this.toJSON()) === JSON.stringify(candidate.toJSON());
  }

  toJSON() {
    return {
      transactionId: this.transactionId,
      targetRoot: this.targetRoot,
      headRef: this.headRef,
      expectedParent: this.expectedParent,
      stagedTree: this.stagedTree,
      messageHash: this.messageHash,
      baseRef: this.baseRef,
      featureRef: this.featureRef,
      worktreePath: this.worktreePath,
      worktreeHead: this.worktreeHead,
    };
  }
}

class FinalizeTeardownTransaction {
  constructor({
    transactionId,
    identity,
    commitRequired = true,
    authorization,
    phase = "pre-commit",
    result = null,
    commitExpectation = null,
    updatedAt = new Date().toISOString(),
  }) {
    if (typeof transactionId !== "string" || transactionId === "") {
      throw new Error("finalize teardown transactionId is invalid");
    }
    this.transactionId = transactionId;
    if (typeof commitRequired !== "boolean") throw new Error("finalize teardown commitRequired must be boolean");
    this.commitRequired = commitRequired;
    this.authorization = authorization instanceof FinalizeTeardownAuthorization
      ? authorization
      : FinalizeTeardownAuthorization.fromStored(authorization);
    const required = ["runId", "spec", "featureBranch", "baseBranch"];
    if (!identity || required.some((key) => typeof identity[key] !== "string" || identity[key] === "")) {
      throw new Error("finalize teardown transaction identity is invalid");
    }
    this.identity = Object.freeze({
      runId: identity.runId,
      spec: identity.spec,
      issue: identity.issue ?? null,
      featureBranch: identity.featureBranch,
      baseBranch: identity.baseBranch,
    });
    this.phase = FinalizeTeardownPhase.from(phase);
    this.result = result == null
      ? null
      : (result instanceof FinalizeTeardownResult ? result : new FinalizeTeardownResult(result));
    this.commitExpectation = commitExpectation == null
      ? null
      : (commitExpectation instanceof FinalizeCommitExpectation
        ? commitExpectation
        : FinalizeCommitExpectation.fromStored(commitExpectation));
    if (this.commitExpectation && this.commitExpectation.transactionId !== this.transactionId) {
      throw new Error("finalize commit expectation targets a different transaction");
    }
    if (this.commitRequired && this.phase.atLeast("commit-durable")) {
      if (!this.commitExpectation || !this.result || !GIT_OBJECT_ID.test(String(this.result.commitSha))) {
        throw new Error("commit-durable finalize teardown requires commit expectation, result, and commitSha");
      }
      if (this.result.phase.name !== this.phase.name) {
        throw new Error("finalize teardown phase and result phase must match");
      }
    } else if (!this.commitRequired) {
      if (!this.phase.atLeast("validated") || this.commitExpectation || !this.result || this.result.commitSha != null) {
        throw new Error("spec-only finalize completion transaction has invalid commit authority");
      }
      if (this.result.phase.name !== this.phase.name) {
        throw new Error("finalize teardown phase and result phase must match");
      }
    } else if (this.result && this.result.phase.name !== this.phase.name) {
      throw new Error("finalize teardown phase and result phase must match");
    }
    this.updatedAt = String(updatedAt);
  }

  static fromStored(value) {
    assertExactObjectKeys(value, [
      "version",
      "transactionId",
      "commitRequired",
      "authorization",
      "identity",
      "phase",
      "result",
      "commitExpectation",
      "updatedAt",
    ], "finalize teardown transaction");
    if (value.version !== FINALIZE_TEARDOWN_VERSION) throw new Error("unsupported finalize teardown transaction version");
    assertExactObjectKeys(
      value.identity,
      ["runId", "spec", "issue", "featureBranch", "baseBranch"],
      "finalize teardown identity",
    );
    return new FinalizeTeardownTransaction({
      ...value,
      authorization: FinalizeTeardownAuthorization.fromStored(value.authorization),
      result: value.result == null ? null : FinalizeTeardownResult.fromStored(value.result),
      commitExpectation: value.commitExpectation == null
        ? null
        : FinalizeCommitExpectation.fromStored(value.commitExpectation),
    });
  }

  static create(state, { commitRequired = true, authorization = FinalizeTeardownAuthorization.standard(state) } = {}) {
    const phase = commitRequired ? "pre-commit" : "validated";
    return new FinalizeTeardownTransaction({
      transactionId: crypto.randomUUID(),
      identity: finalizeTeardownIdentity(state),
      commitRequired,
      authorization,
      phase,
      result: commitRequired ? null : new FinalizeTeardownResult({ phase, ok: true }),
    });
  }

  matches(state) {
    return JSON.stringify(this.identity) === JSON.stringify(finalizeTeardownIdentity(state))
      && this.authorization.mergeStrategy === (state.state?.mergeStrategy ?? null);
  }

  advance(phase, { ok = true, code = null, commitSha = this.result?.commitSha ?? null } = {}) {
    const next = FinalizeTeardownPhase.from(phase);
    if (next.index < this.phase.index) throw new Error(`finalize teardown phase cannot move backward: ${this.phase.name} -> ${next.name}`);
    this.phase = next;
    this.result = new FinalizeTeardownResult({ phase: next, ok, code, commitSha });
    this.updatedAt = new Date().toISOString();
    return this;
  }

  expectCommit(expectation) {
    const candidate = expectation instanceof FinalizeCommitExpectation
      ? expectation
      : new FinalizeCommitExpectation(expectation);
    if (candidate.transactionId !== this.transactionId) {
      throw new Error("finalize commit expectation targets a different transaction");
    }
    if (this.commitExpectation && !this.commitExpectation.equals(candidate)) {
      throw new Error("finalize commit expectation changed after becoming durable");
    }
    this.commitExpectation = candidate;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  fail(code) {
    this.result = new FinalizeTeardownResult({
      phase: this.phase,
      ok: false,
      code,
      commitSha: this.result?.commitSha ?? null,
    });
    this.updatedAt = new Date().toISOString();
    return this;
  }

  toJSON() {
    return {
      version: FINALIZE_TEARDOWN_VERSION,
      transactionId: this.transactionId,
      commitRequired: this.commitRequired,
      authorization: this.authorization.toJSON(),
      identity: this.identity,
      phase: this.phase.name,
      result: this.result?.toJSON() ?? null,
      commitExpectation: this.commitExpectation?.toJSON() ?? null,
      updatedAt: this.updatedAt,
    };
  }
}

function finalizeTeardownIdentity(state) {
  return {
    runId: state.runId,
    spec: state.spec,
    issue: state.issue ?? null,
    featureBranch: state.featureBranch,
    baseBranch: state.baseBranch,
  };
}

function gitValue(root, args, label) {
  const result = runGit(["-C", root, ...args]);
  if (!result.ok) {
    throw new Error(`${label} could not be resolved: ${result.stderr || result.stdout || "unknown git error"}`);
  }
  return result.stdout.trim();
}

function hashCommitMessage(message) {
  return crypto.createHash("sha256").update(message).digest("hex");
}

function buildExpectedPathspecTree(targetRoot, expectedParent, commitPaths) {
  const tempIndex = path.join(os.tmpdir(), `senti-finalize-index-${process.pid}-${crypto.randomUUID()}`);
  const env = { ...process.env, GIT_INDEX_FILE: tempIndex };
  let primaryError = null;
  let tree = null;
  try {
    const read = runGit(["-C", targetRoot, "read-tree", expectedParent], { env });
    if (!read.ok) throw gitFailure("FINALIZE_TREE_BUILD_FAILED", "temporary index read-tree failed", read);
    const add = runGit(["-C", targetRoot, "add", "--", ...commitPaths], { env });
    if (!add.ok) throw gitFailure("FINALIZE_TREE_BUILD_FAILED", "temporary index git add failed", add);
    tree = gitValueWithOptions(targetRoot, ["write-tree"], "finalize staged tree", { env });
  } catch (error) {
    primaryError = error;
  }
  let cleanupError = null;
  try {
    fs.unlinkSync(tempIndex);
  } catch (error) {
    if (error.code !== "ENOENT") cleanupError = error;
  }
  try {
    fs.unlinkSync(`${tempIndex}.lock`);
  } catch (error) {
    if (error.code !== "ENOENT" && cleanupError == null) cleanupError = error;
  }
  if (primaryError && cleanupError) {
    throw new AggregateError(
      [primaryError, cleanupError],
      "finalize expected tree construction and cleanup both failed",
      { cause: primaryError },
    );
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
  return tree;
}

function gitValueWithOptions(root, args, label, options) {
  const result = runGit(["-C", root, ...args], options);
  if (!result.ok) {
    throw new Error(`${label} could not be resolved: ${result.stderr || result.stdout || "unknown git error"}`);
  }
  return result.stdout.trim();
}

function buildCommitExpectation({
  transaction,
  targetRoot,
  state,
  commitMessage,
  commitPaths,
  worktreePath = null,
}) {
  const resolvedTargetRoot = fs.realpathSync(targetRoot);
  const resolvedWorktreePath = worktreePath == null ? null : fs.realpathSync(worktreePath);
  const headRef = gitValue(resolvedTargetRoot, ["symbolic-ref", "-q", "HEAD"], "finalize HEAD ref");
  const expectedParent = gitValue(resolvedTargetRoot, ["rev-parse", "HEAD"], "finalize parent");
  const expectation = new FinalizeCommitExpectation({
    transactionId: transaction.transactionId,
    targetRoot: resolvedTargetRoot,
    headRef,
    expectedParent,
    stagedTree: buildExpectedPathspecTree(resolvedTargetRoot, expectedParent, commitPaths),
    messageHash: hashCommitMessage(commitMessage),
    baseRef: gitValue(resolvedTargetRoot, ["rev-parse", state.baseBranch], "finalize base ref"),
    featureRef: gitValue(resolvedTargetRoot, ["rev-parse", state.featureBranch], "finalize feature ref"),
    worktreePath: resolvedWorktreePath,
    worktreeHead: resolvedWorktreePath == null
      ? null
      : gitValue(resolvedWorktreePath, ["rev-parse", "HEAD"], "finalize worktree HEAD"),
  });
  if (expectation.headRef !== `refs/heads/${state.baseBranch}`) {
    throw new Error(`finalize HEAD must be the configured base branch: ${state.baseBranch}`);
  }
  if (expectation.expectedParent !== expectation.baseRef) {
    throw new Error("finalize HEAD parent must equal the configured base ref");
  }
  return expectation;
}

function assertInitialFinalizeGitAuthority({ targetRoot, state, worktreePath = null }) {
  const resolvedTargetRoot = fs.realpathSync(targetRoot);
  const headRef = gitValue(resolvedTargetRoot, ["symbolic-ref", "-q", "HEAD"], "finalize HEAD ref");
  const head = gitValue(resolvedTargetRoot, ["rev-parse", "HEAD"], "finalize parent");
  const baseRef = gitValue(resolvedTargetRoot, ["rev-parse", state.baseBranch], "finalize base ref");
  gitValue(resolvedTargetRoot, ["rev-parse", state.featureBranch], "finalize feature ref");
  if (headRef !== `refs/heads/${state.baseBranch}`) {
    throw new Error(`finalize HEAD must be the configured base branch: ${state.baseBranch}`);
  }
  if (head !== baseRef) throw new Error("finalize HEAD parent must equal the configured base ref");
  if (worktreePath != null) {
    const resolvedWorktreePath = fs.realpathSync(worktreePath);
    gitValue(resolvedWorktreePath, ["rev-parse", "HEAD"], "finalize worktree HEAD");
  }
}

function assertCommitExpectationFresh(expectation, input) {
  const current = buildCommitExpectation({
    transaction: { transactionId: expectation.transactionId },
    ...input,
  });
  if (!expectation.equals(current)) {
    const error = new Error("finalize commit authority diverged after the expectation became durable");
    error.code = "FINALIZE_COMMIT_AUTHORITY_DIVERGED";
    throw error;
  }
}

function inspectExpectedCommit(expectation, { targetRoot, state }) {
  const resolvedTargetRoot = fs.realpathSync(targetRoot);
  if (resolvedTargetRoot !== expectation.targetRoot) {
    throw new Error("finalize commit target root diverged from durable expectation");
  }
  const head = gitValue(resolvedTargetRoot, ["rev-parse", "HEAD"], "finalize HEAD");
  if (head === expectation.expectedParent) return { adopted: false, head };
  const headRef = gitValue(resolvedTargetRoot, ["symbolic-ref", "-q", "HEAD"], "finalize HEAD ref");
  const parents = gitValue(resolvedTargetRoot, ["show", "-s", "--format=%P", head], "finalize commit parent")
    .split(/\s+/)
    .filter(Boolean);
  const tree = gitValue(resolvedTargetRoot, ["show", "-s", "--format=%T", head], "finalize commit tree");
  const message = gitValue(resolvedTargetRoot, ["show", "-s", "--format=%B", head], "finalize commit message");
  const featureRef = gitValue(resolvedTargetRoot, ["rev-parse", state.featureBranch], "finalize feature ref");
  const baseHead = gitValue(resolvedTargetRoot, ["rev-parse", state.baseBranch], "finalize base ref");
  const matches = headRef === expectation.headRef
    && parents.length === 1
    && parents[0] === expectation.expectedParent
    && tree === expectation.stagedTree
    && hashCommitMessage(message) === expectation.messageHash
    && featureRef === expectation.featureRef
    && baseHead === head;
  if (!matches) {
    throw new Error("repository HEAD diverged from the durable finalize commit expectation");
  }
  return { adopted: true, head };
}

function assertFeatureAuthority(transaction, { mainRepoPath, state }) {
  const current = gitValue(mainRepoPath, ["rev-parse", state.featureBranch], "finalize feature ref");
  if (current !== transaction.commitExpectation.featureRef) {
    throw new Error("finalize feature ref diverged from durable teardown authority");
  }
}

function assertWorktreeAuthority(transaction, { mainRepoPath, state }) {
  const expectation = transaction.commitExpectation;
  if (expectation.worktreePath == null) return;
  if (!fs.existsSync(expectation.worktreePath) || fs.realpathSync(expectation.worktreePath) !== expectation.worktreePath) {
    throw new Error("finalize worktree path diverged from durable teardown authority");
  }
  const worktreeHead = gitValue(expectation.worktreePath, ["rev-parse", "HEAD"], "finalize worktree HEAD");
  if (worktreeHead !== expectation.worktreeHead || worktreeHead !== expectation.featureRef) {
    throw new Error("finalize worktree HEAD diverged from durable teardown authority");
  }
  assertFeatureAuthority(transaction, { mainRepoPath, state });
}

function assertCommitReachableFromBase(transaction, { mainRepoPath, state }) {
  const commitSha = transaction.result?.commitSha;
  if (!GIT_OBJECT_ID.test(String(commitSha))) {
    throw new Error("finalize commit authority is unavailable");
  }
  const reachable = runGit([
    "-C",
    mainRepoPath,
    "merge-base",
    "--is-ancestor",
    commitSha,
    state.baseBranch,
  ]);
  if (!reachable.ok) {
    throw new Error("finalize commit is no longer reachable from base HEAD");
  }
}

function pathExistsStrict(filePath) {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function assertFeatureBranchAbsent(mainRepoPath, featureBranch) {
  const ref = `refs/heads/${featureBranch}`;
  const result = runGit(["-C", mainRepoPath, "show-ref", "--verify", "--quiet", ref]);
  if (result.ok) throw new Error(`finalize persisted reality diverged: feature branch remains: ${featureBranch}`);
  if (result.status !== 1) {
    throw new Error(`finalize feature branch absence could not be verified: ${result.stderr || result.stdout || "git probe failed"}`);
  }
}

function assertPointerReality(reportRoot, spec) {
  const pointerPath = path.join(reportRoot, ".senti", "last-finalized-spec");
  let stat;
  try {
    stat = fs.lstatSync(pointerPath);
  } catch (error) {
    throw new Error(`finalize persisted pointer reality is unavailable: ${error.message}`, { cause: error });
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
    throw new Error("finalize persisted pointer reality is not one real file");
  }
  if (fs.readFileSync(pointerPath, "utf8").trim() !== spec) {
    throw new Error("finalize persisted pointer reality targets a different spec");
  }
}

function assertActiveFlowCleared(ctx, specId) {
  const active = ctx.flowManager.loadActiveFlows();
  if (active.some((entry) => entry.spec === specId)) {
    throw new Error(`finalize persisted active-flow reality still contains ${specId}`);
  }
}

function assertPersistedTeardownReality(transaction, ctx, {
  worktreePath,
  mainRepoPath,
  targetRoot,
  reportRoot,
  specId,
}) {
  const state = ctx.flowState;
  const gitRoot = mainRepoPath || targetRoot;
  if (transaction.phase.atLeast("worktree-removed") && state.worktree && worktreePath) {
    const validation = validateTeardown({
      worktreePath,
      mainRepoPath: gitRoot,
      featureBranch: "",
      specId,
      checkBranch: false,
    });
    if (!validation.ok) throw new Error(`finalize persisted worktree reality diverged: ${validation.reasons.join("; ")}`);
  }
  if (transaction.phase.atLeast("branch-deleted")) {
    assertFeatureBranchAbsent(gitRoot, state.featureBranch);
  }
  if (transaction.phase.atLeast("validated")) {
    const validation = validateTeardown({
      worktreePath,
      mainRepoPath: gitRoot,
      featureBranch: state.featureBranch,
      specId,
    });
    if (!validation.ok) throw new Error(`finalize persisted teardown reality diverged: ${validation.reasons.join("; ")}`);
  }
  if (transaction.phase.atLeast("pointer-written")) assertPointerReality(reportRoot, state.spec);
  if (transaction.phase.atLeast("active-cleared")) assertActiveFlowCleared(ctx, specId);
}

function ensureRealDirectory(directory) {
  const parent = path.dirname(directory);
  if (parent !== directory && !fs.existsSync(parent)) ensureRealDirectory(parent);
  try {
    fs.mkdirSync(directory);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== path.resolve(directory)) {
    throw new Error(`finalize teardown recovery authority must be a real directory: ${directory}`);
  }
}

class FinalizeRepositoryOperationLock {
  constructor(mainRoot) {
    this.mainRoot = fs.realpathSync(resolveRepositoryLockRoot(mainRoot));
    const errorFactory = (status, message, { lockPath, cause } = {}) => {
      const error = new Error(message, { cause });
      error.code = status === "live"
        ? "FINALIZE_REPOSITORY_BUSY"
        : `FINALIZE_REPOSITORY_LOCK_${status.replace(/-/g, "_").toUpperCase()}`;
      error.lockPath = lockPath;
      return error;
    };
    const rootAuthority = new RealDirectoryAuthority(this.mainRoot, { errorFactory });
    const directoryAuthority = new RealDirectoryAuthority(path.join(this.mainRoot, ".senti"), {
      create: true,
      parentAuthority: rootAuthority,
      errorFactory,
    });
    this.lock = new ProcessOwnedLock({
      directoryAuthority,
      fileName: FINALIZE_REPOSITORY_LOCK_FILE,
      kind: "repository-finalize-operation",
      authority: { mainRoot: this.mainRoot },
      errorFactory,
    });
  }

  acquire() {
    return this.lock.acquire({ claimStale: true });
  }

  release() {
    this.lock.release();
  }
}

async function withFinalizeRepositoryOperation(lock, body) {
  try {
    lock.acquire();
  } catch (error) {
    if (error.code === "FINALIZE_REPOSITORY_BUSY") {
      return Envelope.fail(
        "run",
        "finalize-cleanup",
        error.code,
        "Another finalize-cleanup process owns this repository operation.",
        { lockPath: error.lockPath },
      );
    }
    throw error;
  }
  let result;
  let primaryError = null;
  try {
    result = await body();
  } catch (error) {
    primaryError = error;
  }
  let releaseError = null;
  try {
    lock.release();
  } catch (error) {
    releaseError = error;
  }
  if (primaryError && releaseError) {
    throw new AggregateError(
      [primaryError, releaseError],
      "finalize repository operation and lock release both failed",
      { cause: primaryError },
    );
  }
  if (primaryError) throw primaryError;
  if (releaseError) throw releaseError;
  return result;
}

class FinalizeTeardownTransactionStore {
  constructor(mainRoot, state, {
    commitRequired = true,
    authorization = FinalizeTeardownAuthorization.standard(state),
  } = {}) {
    const identity = finalizeTeardownIdentity(state);
    const token = crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex");
    this.mainRoot = fs.realpathSync(mainRoot);
    this.directory = path.join(this.mainRoot, ".senti", "recovery", "finalize-cleanup");
    ensureRealDirectory(this.directory);
    this.path = path.join(this.directory, `${token}.json`);
    this.file = new AtomicJsonFile(this.path);
    this.state = state;
    this.commitRequired = commitRequired;
    this.authorization = authorization;
    this.revision = null;
    this.owned = false;
    const errorFactory = (status, message, { lockPath, cause } = {}) => {
      const error = new Error(message, { cause });
      error.code = status === "live"
        ? "FINALIZE_TEARDOWN_BUSY"
        : `FINALIZE_TEARDOWN_LOCK_${status.replace(/-/g, "_").toUpperCase()}`;
      error.lockPath = lockPath;
      return error;
    };
    this.lock = new ProcessOwnedLock({
      directoryAuthority: new RealDirectoryAuthority(this.directory, { errorFactory }),
      fileName: `${token}.lock`,
      kind: "finalize-teardown-operation",
      authority: {
        mainRoot: this.mainRoot,
        transactionPath: this.path,
        flowIdentity: identity,
      },
      errorFactory,
    });
  }

  static pathFor(mainRoot, state) {
    const identity = finalizeTeardownIdentity(state);
    const token = crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex");
    return path.join(path.resolve(mainRoot), ".senti", "recovery", "finalize-cleanup", `${token}.json`);
  }

  hasExisting() {
    this.#assertOwned();
    return this.#readSnapshot().value != null;
  }

  acquire() {
    this.lock.acquire({ claimStale: true });
    this.owned = true;
  }

  release() {
    try {
      this.lock.release();
    } finally {
      this.owned = false;
    }
  }

  loadOrCreate() {
    this.#assertOwned();
    const snapshot = this.#readSnapshot();
    this.revision = snapshot.revision;
    const transaction = snapshot.value == null
      ? FinalizeTeardownTransaction.create(this.state, {
        commitRequired: this.commitRequired,
        authorization: this.authorization,
      })
      : FinalizeTeardownTransaction.fromStored(snapshot.value);
    if (!transaction.matches(this.state)) throw new Error("finalize teardown transaction targets a different flow");
    if (transaction.commitRequired !== this.commitRequired) {
      throw new Error("finalize teardown transaction mode changed");
    }
    return transaction;
  }

  write(transaction) {
    this.#assertOwned();
    const current = this.#readSnapshot();
    if (current.revision !== this.revision) {
      const error = new Error("finalize teardown transaction revision changed concurrently");
      error.code = "FINALIZE_TEARDOWN_REVISION_CONFLICT";
      throw error;
    }
    this.file.write(transaction.toJSON());
    this.revision = this.#readSnapshot().revision;
  }

  remove() {
    this.#assertOwned();
    const current = this.#readSnapshot();
    if (current.revision !== this.revision || current.value == null) {
      const error = new Error("finalize teardown transaction revision changed before removal");
      error.code = "FINALIZE_TEARDOWN_REVISION_CONFLICT";
      throw error;
    }
    let descriptor = null;
    try {
      fs.unlinkSync(this.path);
      descriptor = fs.openSync(this.directory, "r");
      fs.fsyncSync(descriptor);
    } finally {
      if (descriptor != null) fs.closeSync(descriptor);
    }
    this.revision = null;
  }

  #assertOwned() {
    if (!this.owned) throw new Error("finalize teardown transaction lock is required");
  }

  #readSnapshot() {
    let stat;
    try {
      stat = fs.lstatSync(this.path);
    } catch (error) {
      if (error.code === "ENOENT") return { revision: null, value: null };
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
      throw new Error(`finalize teardown transaction must be one real non-hardlinked file: ${this.path}`);
    }
    const descriptor = fs.openSync(this.path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const opened = fs.fstatSync(descriptor);
      if (opened.dev !== stat.dev || opened.ino !== stat.ino || opened.nlink !== 1 || !opened.isFile()) {
        throw new Error(`finalize teardown transaction identity changed while reading: ${this.path}`);
      }
      const bytes = fs.readFileSync(descriptor);
      return {
        revision: crypto.createHash("sha256").update(bytes).digest("hex"),
        value: JSON.parse(bytes.toString("utf8")),
      };
    } finally {
      fs.closeSync(descriptor);
    }
  }
}

function buildReportField(mainRoot) {
  // The embedded cleanup report is the same report-show text generated from
  // validated v2 test-execute-result/test-result-review artifacts, including
  // projectRegression data. Missing or malformed report data is surfaced as
  // REPORT_MISSING instead of fabricated.
  try {
    const path = resolveLatestReportPath(mainRoot);
    const text = readReportText(path);
    return { report: { path, text }, missing: null };
  } catch (err) {
    return { report: null, missing: err };
  }
}

function attachReport(env, mainRoot) {
  const { report, missing } = buildReportField(mainRoot);
  env.data.report = report;
  if (missing) {
    env.addWarning("REPORT_MISSING", missing.message);
  }
  return env;
}

/**
 * R14: build dirty-file list for the auto-rescue precondition while excluding
 * specs/<id>/issue-log.json (which may be a leftover from a previous
 * CHERRY_PICK_CONFLICT halt and is intentionally retained until the next
 * successful cleanup commit). The pathspec uses git's negative form so the
 * result reflects only "real" dirty files.
 */
function listMainRepoDirtyFiles(mainRepoPath, specId) {
  const res = runGit([
    "-C",
    mainRepoPath,
    "status",
    "--porcelain",
    "--",
    ".",
    `:!specs/${specId}/issue-log.json`,
  ]);
  if (!res.ok) return [];
  return res.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => line.slice(3));
}

function listOtherDirtyFlowJsonPaths(mainRepoPath, specId) {
  const res = runGit([
    "-C",
    mainRepoPath,
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    ":(glob)specs/*/flow.json",
  ]);
  if (!res.ok) {
    throw new Error(res.stderr || res.stdout || "git status failed");
  }
  const targetPath = `specs/${specId}/flow.json`;
  const paths = [];
  const seen = new Set();
  for (const line of res.stdout.split("\n")) {
    if (!line.trim()) continue;
    const relPath = line.slice(3).trim();
    if (!relPath || relPath === targetPath || seen.has(relPath)) continue;
    seen.add(relPath);
    paths.push(relPath);
  }
  return paths;
}

function attachOtherFlowMetadataWarning(env, mainRepoPath, specId) {
  let paths;
  try {
    paths = listOtherDirtyFlowJsonPaths(mainRepoPath, specId);
  } catch (err) {
    env.addWarning(
      "OTHER_FLOW_METADATA_STATUS_FAILED",
      `Failed to inspect other flow metadata dirtiness: ${err.message}`,
    );
    return env;
  }
  if (paths.length === 0) return env;
  env.addWarning(
    "OTHER_FLOW_METADATA_DIRTY",
    [
      "Other active flow metadata remains dirty in the main repository:",
      ...paths.map((p) => `  - ${p}`),
    ],
  );
  return env;
}

function boundedEntries(entries, limit = SUBMODULE_DIAGNOSTIC_LIMIT) {
  return {
    entries: entries.slice(0, limit),
    truncated: entries.length > limit,
  };
}

function boundedText(text, limit = SUBMODULE_ERROR_TEXT_LIMIT) {
  const s = String(text || "");
  return {
    text: s.length > limit ? s.slice(0, limit) : s,
    truncated: s.length > limit,
  };
}

function parsePorcelainPaths(stdout) {
  return stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

function statusFailure(scope, targetPath, res) {
  const stderr = boundedText(res.stderr || "");
  const stdout = boundedText(res.stdout || "");
  return {
    failure: {
      scope,
      path: targetPath,
      stderr: stderr.text,
      stdout: stdout.text,
    },
    truncated: stderr.truncated || stdout.truncated,
  };
}

function isSubmoduleWorktreeRemoveFailure(res) {
  const text = `${res.stdout || ""}\n${res.stderr || ""}`;
  return /working trees containing submodules cannot be moved or removed/i.test(text);
}

function listInitializedSubmodules(worktreePath, runGitFn = runGit) {
  const res = runGitFn(["-C", worktreePath, "submodule", "status"]);
  if (!res.ok) {
    const failure = statusFailure("submodule-list", worktreePath, res);
    return { ok: false, statusFailures: [failure.failure], truncated: failure.truncated };
  }
  const paths = res.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => line[0] !== "-")
    .map((line) => line.trim().split(/\s+/)[1])
    .filter(Boolean);
  return { ok: true, paths };
}

function inspectSubmoduleWorktreeCleanliness(worktreePath, runGitFn = runGit) {
  let truncated = false;
  const rootStatus = runGitFn(["-C", worktreePath, "status", "--porcelain", "--untracked-files=all"]);
  if (!rootStatus.ok) {
    const failure = statusFailure("worktree", worktreePath, rootStatus);
    return { ok: false, statusFailures: [failure.failure], truncated: failure.truncated };
  }

  const root = boundedEntries(parsePorcelainPaths(rootStatus.stdout));
  truncated = truncated || root.truncated;

  const submodules = listInitializedSubmodules(worktreePath, runGitFn);
  if (!submodules.ok) return submodules;

  const dirtySubmodules = [];
  const statusFailures = [];
  for (const submodulePath of submodules.paths) {
    const absPath = path.join(worktreePath, submodulePath);
    const res = runGitFn(["-C", absPath, "status", "--porcelain", "--untracked-files=all"]);
    if (!res.ok) {
      const failure = statusFailure("submodule", submodulePath, res);
      statusFailures.push(failure.failure);
      truncated = truncated || failure.truncated;
      continue;
    }
    const dirtyFiles = boundedEntries(parsePorcelainPaths(res.stdout));
    truncated = truncated || dirtyFiles.truncated;
    if (dirtyFiles.entries.length > 0) {
      dirtySubmodules.push({ path: submodulePath, dirtyFiles: dirtyFiles.entries });
    }
  }

  const failures = boundedEntries(statusFailures);
  truncated = truncated || failures.truncated;
  if (failures.entries.length > 0) {
    return { ok: false, statusFailures: failures.entries, truncated };
  }

  const dirtyModules = boundedEntries(dirtySubmodules);
  return {
    ok: true,
    dirtyRootFiles: root.entries,
    dirtySubmodules: dirtyModules.entries,
    dirty: root.entries.length > 0 || dirtyModules.entries.length > 0,
    truncated: truncated || dirtyModules.truncated,
  };
}

function submoduleDirtyEnvelope({ worktreePath, featureBranch, inspection }) {
  return Envelope.fail(
    "run",
    "finalize-cleanup",
    "SUBMODULE_WORKTREE_DIRTY",
    [
      "Submodule worktree cleanup stopped because the worktree or an initialized submodule is dirty.",
      "Commit, stash, or remove the dirty changes, then retry finalize-cleanup.",
      "The worktree and feature branch were retained for recovery.",
    ],
    {
      worktreePath,
      featureBranch,
      dirtyRootFiles: inspection.dirtyRootFiles,
      dirtySubmodules: inspection.dirtySubmodules,
      truncated: inspection.truncated,
      recoveryOptions: SUBMODULE_RECOVERY_OPTIONS_DIRTY,
    },
  );
}

function submoduleStatusFailedEnvelope({ worktreePath, featureBranch, inspection }) {
  return Envelope.fail(
    "run",
    "finalize-cleanup",
    "SUBMODULE_WORKTREE_STATUS_FAILED",
    [
      "Submodule worktree cleanup stopped because cleanliness could not be confirmed.",
      "Inspect the reported git status failure, clean the worktree or submodules, then retry finalize-cleanup.",
      "The worktree and feature branch were retained for recovery.",
    ],
    {
      worktreePath,
      featureBranch,
      statusFailures: inspection.statusFailures,
      truncated: inspection.truncated,
      recoveryOptions: SUBMODULE_RECOVERY_OPTIONS_STATUS,
    },
  );
}

function submoduleForceRemoveFailedEnvelope({ worktreePath, featureBranch, res }) {
  const stderr = boundedText(res.stderr || "");
  const stdout = boundedText(res.stdout || "");
  return Envelope.fail(
    "run",
    "finalize-cleanup",
    "SUBMODULE_WORKTREE_FORCE_REMOVE_FAILED",
    [
      "Submodule worktree cleanup stopped because clean-confirmed force removal failed.",
      "Inspect the git error, resolve the worktree removal problem manually, then retry finalize-cleanup.",
      "Branch deletion was not attempted; the feature branch was retained for recovery.",
    ],
    {
      worktreePath,
      featureBranch,
      stderr: stderr.text,
      stdout: stdout.text,
      truncated: stderr.truncated || stdout.truncated,
      recoveryOptions: SUBMODULE_RECOVERY_OPTIONS_FORCE,
    },
  );
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function removeWorktreeForCleanup({ mainRepoPath, worktreePath, featureBranch, force = false, runGit: runGitFn = runGit }) {
  const removeArgs = ["-C", mainRepoPath, "worktree", "remove"];
  if (force) removeArgs.push("--force");
  removeArgs.push(worktreePath);
  const removeRes = runGitFn(removeArgs);
  if (removeRes.ok) return { ok: true };

  if (!isSubmoduleWorktreeRemoveFailure(removeRes)) {
    return {
      ok: false,
      env: Envelope.fail("run", "finalize-cleanup", "WORKTREE_REMOVE_FAILED", [
        `git worktree remove failed: ${removeRes.stderr || removeRes.stdout || "unknown"}`,
        "Common cause: untracked files or uncommitted changes in the worktree.",
        "Resolve the dirty state and retry cleanup.",
      ]),
    };
  }

  if (force) {
    return {
      ok: false,
      env: submoduleForceRemoveFailedEnvelope({ worktreePath, featureBranch, res: removeRes }),
    };
  }

  const inspection = inspectSubmoduleWorktreeCleanliness(worktreePath, runGitFn);
  if (!inspection.ok) {
    return {
      ok: false,
      env: submoduleStatusFailedEnvelope({ worktreePath, featureBranch, inspection }),
    };
  }
  if (inspection.dirty) {
    return {
      ok: false,
      env: submoduleDirtyEnvelope({ worktreePath, featureBranch, inspection }),
    };
  }

  const forceRes = runGitFn(["-C", mainRepoPath, "worktree", "remove", "--force", worktreePath]);
  if (!forceRes.ok) {
    return {
      ok: false,
      env: submoduleForceRemoveFailedEnvelope({ worktreePath, featureBranch, res: forceRes }),
    };
  }
  return { ok: true };
}

export function deleteFeatureBranchForCleanup({
  mainRepoPath,
  featureBranch,
  expectedSha,
  runGit: runGitFn = runGit,
}) {
  if (!GIT_OBJECT_ID.test(String(expectedSha))) throw new Error("feature branch deletion requires an expected OID");
  const ref = `refs/heads/${featureBranch}`;
  const worktrees = runGitFn(["-C", mainRepoPath, "worktree", "list", "--porcelain"]);
  if (!worktrees.ok) {
    return {
      ok: false,
      env: Envelope.fail("run", "finalize-cleanup", "BRANCH_DELETE_FAILED", [
        `Feature branch worktree ownership could not be verified: ${worktrees.stderr || worktrees.stdout || "unknown"}`,
      ]),
    };
  }
  if (worktrees.stdout.split("\n").some((line) => line === `branch ${ref}`)) {
    return {
      ok: false,
      env: Envelope.fail("run", "finalize-cleanup", "BRANCH_DELETE_FAILED", [
        `Feature branch is still checked out in a registered worktree: ${featureBranch}`,
      ]),
    };
  }
  const branchRes = runGitFn(["-C", mainRepoPath, "update-ref", "-d", ref, expectedSha]);
  if (!branchRes.ok) {
    const current = runGitFn(["-C", mainRepoPath, "rev-parse", "--verify", ref]);
    if (!current.ok) return { ok: true };
    return {
      ok: false,
      env: Envelope.fail("run", "finalize-cleanup", "BRANCH_DELETE_FAILED", [
        `git update-ref -d ${ref} failed its expected-OID check: ${branchRes.stderr || branchRes.stdout || "unknown"}`,
      ]),
    };
  }
  return { ok: true };
}

export function recordFinalizeCleanupPostCommandMetadata({
  flowManager,
  specId,
  metrics = [],
  runtimeLog = null,
  notes = [],
  issueLogEntries = [],
  pluginArtifacts = [],
  report = null,
  recoveryEnvelope = null,
} = {}) {
  if (!flowManager) throw new Error("flowManager is required");
  const state = flowManager.loadReadOnly(specId) || { worktree: false };
  const { worktreePath, mainRepoPath } = flowManager.resolveWorktreePaths(state);
  const mainRoot = mainRepoPath || flowManager._mainRoot || flowManager._root;
  const resolver = new FinalizeCleanupPathResolver({
    enabled: true,
    worktreeRoot: worktreePath,
    mainRoot,
    inWorktree: Boolean(worktreePath && mainRepoPath),
  });
  const writtenPaths = [];
  const surfaces = new Set();
  const callerVisible = {};

  function writeSurface(surface, fileName, payload) {
    if (payload == null) return null;
    const owner = resolver.cleanupSurfaceOwner(surface, { specId });
    const filePath = owner.path || resolver.postCommandMetadataPath(fileName, { specId });
    writeJsonFile(filePath, payload);
    writtenPaths.push(filePath);
    surfaces.add(surface);
    return filePath;
  }

  function appendSurfaceEntries(surface, fileName, key, entries) {
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const owner = resolver.cleanupSurfaceOwner(surface, { specId });
    const filePath = owner.path || resolver.postCommandMetadataPath(fileName, { specId });
    let existing = [];
    if (fs.existsSync(filePath)) {
      const current = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (Array.isArray(current?.[key])) existing = current[key];
    }
    writeJsonFile(filePath, { version: 1, [key]: [...existing, ...entries] });
    writtenPaths.push(filePath);
    surfaces.add(surface);
    return filePath;
  }

  if (metrics.length > 0) {
    appendSurfaceEntries("agent-metrics", "agent-metrics.json", "entries", metrics);
  }
  if (runtimeLog) {
    writeSurface("runtime-log", "runtime-log.json", { version: 1, runtimeLog });
  }
  if (notes.length > 0) {
    appendSurfaceEntries("notes", "notes.json", "entries", notes);
  }
  if (issueLogEntries.length > 0) {
    const specPath = state.spec || `specs/${specId}/spec.json`;
    const owner = resolver.cleanupSurfaceOwner("issue-log", { specId });
    const timestamp = new Date().toISOString();
    new IssueLogStore({ root: mainRoot, spec: specPath }).appendMany(issueLogEntries.map((entry) => {
      const normalized = { ...entry, timestamp: entry?.timestamp || timestamp };
      const idempotencyKey = entry?.issueLogId || `finalize-cleanup-lifecycle-${crypto
        .createHash("sha256")
        .update(JSON.stringify(normalized))
        .digest("hex")}`;
      return { entry: normalized, idempotencyKey };
    }));
    writtenPaths.push(owner.path);
    surfaces.add("issue-log");
  }
  if (pluginArtifacts.length > 0) {
    appendSurfaceEntries("plugin-artifact", "plugin-artifacts.json", "artifacts", pluginArtifacts);
    callerVisible.plugin = {
      warnings: pluginArtifacts.flatMap((a) => a?.data?.warnings || []),
      followUps: pluginArtifacts.flatMap((a) => a?.data?.followUps || []),
      artifacts: pluginArtifacts,
    };
    surfaces.add("plugin-hook-output");
  }
  if (report) {
    writeSurface("report-envelope", "report-envelope.json", { version: 1, report });
    callerVisible.report = report;
  }
  if (recoveryEnvelope) {
    writeSurface("recovery-envelope", "recovery-envelope.json", { version: 1, recoveryEnvelope });
    callerVisible.recoveryEnvelope = recoveryEnvelope;
  }

  return {
    writtenPaths,
    surfaces: [...surfaces],
    callerVisible,
  };
}

export function finalizeCleanupPluginLifecycleContext({ root, state, worktreePath, mainRepoPath, specId }) {
  const inCleanupWorktree = Boolean(state?.worktree && worktreePath && mainRepoPath);
  if (!inCleanupWorktree) {
    return {
      root,
      flow: state,
      artifactPath: `specs/${specId}`,
    };
  }

  const resolver = new FinalizeCleanupPathResolver({
    enabled: true,
    worktreeRoot: worktreePath,
    mainRoot: mainRepoPath,
    inWorktree: true,
  });
  const owner = resolver.cleanupSurfaceOwner("plugin-artifact", { specId });
  const artifactDir = path.join(path.dirname(owner.path), "plugin-artifacts");
  const artifactPath = path.relative(mainRepoPath, artifactDir).split(path.sep).join("/");
  return {
    root: mainRepoPath,
    flow: { ...state, pluginArtifactRoot: artifactPath },
    artifactPath,
  };
}

/**
 * R1/R3/R6: parse `git log --reverse <baseline>..<featureBranch>` output into
 * { sha, subject } pairs and apply the 50-commit cap.
 */
function readOrphanCommits(repoPath, baseline, featureBranch) {
  const res = runGit([
    "-C",
    repoPath,
    "log",
    "--reverse",
    "--pretty=format:%H%x09%s",
    `${baseline}..${featureBranch}`,
  ]);
  if (!res.ok) {
    return { ok: false, reason: res.stderr || res.stdout || "git log failed" };
  }
  const lines = res.stdout.split("\n").filter(Boolean);
  const total = lines.length;
  const slice = lines.slice(0, ORPHAN_COMMIT_LIST_LIMIT);
  const commits = slice.map((line) => {
    const tabIdx = line.indexOf("\t");
    if (tabIdx === -1) return { sha: line, subject: null };
    return { sha: line.slice(0, tabIdx), subject: line.slice(tabIdx + 1) };
  });
  return {
    ok: true,
    commits,
    count: total,
    truncated: total > ORPHAN_COMMIT_LIST_LIMIT,
  };
}

/**
 * R14/R15: append a single audit-log entry while keeping a snapshot of the
 * pre-write content so commit-time rollback restores the file exactly. Writes
 * unconditionally to the main repo (not the worktree, which may be deleted by
 * later teardown).
 */
function appendIssueLog(mainRepoPath, specPath, entry, idempotencyKey) {
  new IssueLogStore({ root: mainRepoPath, spec: specPath }).append({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  }, idempotencyKey);
  return idempotencyKey;
}

function restoreIssueLog(mainRepoPath, specPath, idempotencyKey) {
  if (!idempotencyKey) return;
  new IssueLogStore({ root: mainRepoPath, spec: specPath }).compensate(idempotencyKey);
}

function appendForcedFinalizeAudit(root, state, authorization) {
  const droppedCommits = authorization.droppedCommits.map((commit) => commit.toJSON());
  appendIssueLog(root, state.spec, {
    step: "finalize-cleanup",
    reason: "FORCED_ORPHAN_DROP: feature branch deleted via --force despite orphan / divergent state",
    trigger: "senti flow run finalize-cleanup --force",
    resolution: droppedCommits.length > 0
      ? `dropped ${authorization.droppedCount} commit(s); top sha=${droppedCommits[0]?.sha?.slice(0, 12) || "n/a"}`
      : authorization.diverged
      ? "baseline diverged (history rewrite); branch deleted without rescue"
      : "baseline missing; branch deleted without rescue",
    droppedCommits,
    droppedCount: authorization.droppedCount,
    droppedTruncated: authorization.droppedTruncated,
    taskId: null,
  }, authorization.auditId);
}

function attachForcedFinalizeContext(env, authorization) {
  if (!env.ok || authorization.route !== "forced") return env;
  env.data.droppedCommits = authorization.droppedCommits.map((commit) => commit.toJSON());
  env.data.count = authorization.droppedCount;
  env.data.truncated = authorization.droppedTruncated;
  env.data.forceAuthorization = {
    auditId: authorization.auditId,
    mergeStrategy: authorization.mergeStrategy,
    baseline: authorization.baseline,
    diverged: authorization.diverged,
  };
  env.addWarning("FORCED_ORPHAN_DROP", [
    `Feature branch deleted with --force despite ${authorization.droppedCount} unsaved commit(s).`,
    "The dropped commit list has been recorded in issue-log.json for audit.",
  ]);
  return env;
}

function finalizeAuditId(kind, state, details = {}) {
  return `finalize-cleanup-${crypto
    .createHash("sha256")
    .update(JSON.stringify({
      kind,
      runId: state.runId,
      spec: state.spec,
      issue: state.issue ?? null,
      ...details,
    }))
    .digest("hex")}`;
}

class AutoRescueAbortFailure {
  constructor({
    code = "CHERRY_PICK_ABORT_FAILED",
    status,
    stdout,
    stderr,
    signal,
    killed,
  }) {
    if (code !== "CHERRY_PICK_ABORT_FAILED") throw new Error("auto-rescue abort failure.code is invalid");
    if (status !== null && !Number.isInteger(status)) throw new Error("auto-rescue abort failure.status is invalid");
    if (typeof stdout !== "string" || typeof stderr !== "string") {
      throw new Error("auto-rescue abort failure output is invalid");
    }
    if (signal !== null && typeof signal !== "string") throw new Error("auto-rescue abort failure.signal is invalid");
    if (typeof killed !== "boolean") throw new Error("auto-rescue abort failure.killed is invalid");
    this.code = code;
    this.status = status;
    this.stdout = stdout;
    this.stderr = stderr;
    this.signal = signal;
    this.killed = killed;
    Object.freeze(this);
  }

  static fromGitResult(result) {
    return new AutoRescueAbortFailure({
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      signal: result.signal,
      killed: result.killed,
    });
  }

  static fromStored(value) {
    assertExactObjectKeys(
      value,
      ["code", "status", "stdout", "stderr", "signal", "killed"],
      "auto-rescue abort failure",
    );
    return new AutoRescueAbortFailure(value);
  }

  toError() {
    const error = new Error(
      `cherry-pick abort failed: ${this.stderr || this.stdout || `git exited ${this.status}`}`,
    );
    error.code = this.code;
    error.gitResult = this.toJSON();
    return error;
  }

  toJSON() {
    return {
      code: this.code,
      status: this.status,
      stdout: this.stdout,
      stderr: this.stderr,
      signal: this.signal,
      killed: this.killed,
    };
  }
}

class AutoRescueOutcome {
  constructor({ ok, code = null, conflictFiles = [], abortFailure = null }) {
    if (typeof ok !== "boolean") throw new Error("auto-rescue outcome.ok is invalid");
    if (ok && code !== null) throw new Error("successful auto-rescue outcome cannot have a code");
    if (!ok && !["MAIN_REPO_LOCKED", "CHERRY_PICK_CONFLICT"].includes(code)) {
      throw new Error("failed auto-rescue outcome.code is invalid");
    }
    if (!Array.isArray(conflictFiles) || conflictFiles.some((entry) => typeof entry !== "string")) {
      throw new Error("auto-rescue outcome.conflictFiles is invalid");
    }
    const parsedAbortFailure = abortFailure == null
      ? null
      : abortFailure instanceof AutoRescueAbortFailure
        ? abortFailure
        : AutoRescueAbortFailure.fromStored(abortFailure);
    if (parsedAbortFailure && (ok || code !== "CHERRY_PICK_CONFLICT")) {
      throw new Error("auto-rescue abort failure requires a cherry-pick conflict outcome");
    }
    this.ok = ok;
    this.code = code;
    this.conflictFiles = Object.freeze([...conflictFiles]);
    this.abortFailure = parsedAbortFailure;
    Object.freeze(this);
  }

  static success() {
    return new AutoRescueOutcome({ ok: true });
  }

  static failure(code, conflictFiles = [], abortFailure = null) {
    return new AutoRescueOutcome({ ok: false, code, conflictFiles, abortFailure });
  }

  static fromStored(value) {
    assertExactObjectKeys(value, ["ok", "code", "conflictFiles", "abortFailure"], "auto-rescue outcome");
    return new AutoRescueOutcome(value);
  }

  static fromResult(value) {
    return value.ok
      ? AutoRescueOutcome.success()
      : AutoRescueOutcome.failure(value.code, value.conflictFiles || [], value.abortFailure || null);
  }

  toJSON() {
    return {
      ok: this.ok,
      code: this.code,
      conflictFiles: [...this.conflictFiles],
      abortFailure: this.abortFailure?.toJSON() ?? null,
    };
  }
}

class AutoRescueCleanupJournal {
  constructor({ identity, phase, expectedBaseSha, tempWorktreePath, outcome, updatedAt }) {
    assertExactObjectKeys(
      identity,
      ["mainRepoPath", "baseBranch", "baseline", "featureBranch", "specId"],
      "auto-rescue cleanup identity",
    );
    if (!AUTO_RESCUE_CLEANUP_PHASES.has(phase)) throw new Error("auto-rescue cleanup phase is invalid");
    if (!GIT_OBJECT_ID.test(expectedBaseSha)) throw new Error("auto-rescue expected base OID is invalid");
    const temporaryRoot = path.resolve(os.tmpdir());
    const relativeTemp = path.relative(temporaryRoot, path.resolve(tempWorktreePath));
    if (
      relativeTemp === ""
      || relativeTemp.startsWith("..")
      || path.isAbsolute(relativeTemp)
      || !path.basename(tempWorktreePath).startsWith("senti-rescue-tmp-")
    ) {
      throw new Error("auto-rescue temporary worktree authority is invalid");
    }
    const parsedOutcome = outcome == null
      ? null
      : outcome instanceof AutoRescueOutcome ? outcome : AutoRescueOutcome.fromStored(outcome);
    if (["staged", "worktree-added"].includes(phase) && parsedOutcome !== null) {
      throw new Error("unfinished auto-rescue cleanup journal cannot have an outcome");
    }
    if (phase === "body-failed" && parsedOutcome?.ok !== false) {
      throw new Error("body-failed auto-rescue cleanup journal needs a failed outcome");
    }
    if (phase === "abort-failed" && parsedOutcome?.abortFailure == null) {
      throw new Error("abort-failed auto-rescue cleanup journal needs an abort failure");
    }
    if (phase === "base-updated" && parsedOutcome?.ok !== true) {
      throw new Error("base-updated auto-rescue cleanup journal needs a successful outcome");
    }
    if (typeof updatedAt !== "string" || updatedAt === "") throw new Error("auto-rescue cleanup timestamp is invalid");
    this.identity = Object.freeze({ ...identity, mainRepoPath: path.resolve(identity.mainRepoPath) });
    this.phase = phase;
    this.expectedBaseSha = expectedBaseSha;
    this.tempWorktreePath = path.resolve(tempWorktreePath);
    this.outcome = parsedOutcome;
    this.updatedAt = updatedAt;
  }

  static create(identity, expectedBaseSha, tempWorktreePath) {
    return new AutoRescueCleanupJournal({
      identity,
      phase: "staged",
      expectedBaseSha,
      tempWorktreePath,
      outcome: null,
      updatedAt: new Date().toISOString(),
    });
  }

  static fromStored(expectedIdentity, value) {
    assertExactObjectKeys(
      value,
      ["version", "identity", "phase", "expectedBaseSha", "tempWorktreePath", "outcome", "updatedAt"],
      "auto-rescue cleanup journal",
    );
    if (value.version !== AUTO_RESCUE_CLEANUP_VERSION) throw new Error("auto-rescue cleanup version is invalid");
    const journal = new AutoRescueCleanupJournal(value);
    if (JSON.stringify(journal.identity) !== JSON.stringify(expectedIdentity)) {
      throw new Error("auto-rescue cleanup journal targets a different authority");
    }
    return journal;
  }

  advance(phase, outcome = this.outcome) {
    const advanced = new AutoRescueCleanupJournal({
      identity: this.identity,
      phase,
      expectedBaseSha: this.expectedBaseSha,
      tempWorktreePath: this.tempWorktreePath,
      outcome,
      updatedAt: new Date().toISOString(),
    });
    Object.assign(this, advanced);
  }

  toJSON() {
    return {
      version: AUTO_RESCUE_CLEANUP_VERSION,
      identity: this.identity,
      phase: this.phase,
      expectedBaseSha: this.expectedBaseSha,
      tempWorktreePath: this.tempWorktreePath,
      outcome: this.outcome?.toJSON() ?? null,
      updatedAt: this.updatedAt,
    };
  }
}

class AutoRescueCleanupStore {
  constructor(identity) {
    this.identity = identity;
    const token = crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex");
    this.directory = path.join(identity.mainRepoPath, ".senti", "recovery", "auto-rescue");
    ensureRealDirectory(this.directory);
    this.path = path.join(this.directory, `${token}.json`);
    this.file = new AtomicJsonFile(this.path);
  }

  load() {
    let stat;
    try {
      stat = fs.lstatSync(this.path);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs.realpathSync(this.path) !== this.path) {
      throw new Error(`auto-rescue cleanup journal must be one real non-hardlinked file: ${this.path}`);
    }
    return AutoRescueCleanupJournal.fromStored(this.identity, this.file.read(null));
  }

  write(journal) {
    this.file.write(journal.toJSON());
  }

  remove() {
    fs.unlinkSync(this.path);
    const descriptor = fs.openSync(this.directory, "r");
    let primaryError = null;
    try {
      fs.fsyncSync(descriptor);
    } catch (error) {
      primaryError = error;
    } finally {
      try {
        fs.closeSync(descriptor);
      } catch (cleanupError) {
        if (primaryError) {
          throw new AggregateError(
            [primaryError, cleanupError],
            "auto-rescue journal removal and descriptor cleanup both failed",
            { cause: primaryError },
          );
        }
        throw cleanupError;
      }
    }
    if (primaryError) throw primaryError;
  }
}

function autoRescueCleanupError(journal, result, { worktreeResidue = null } = {}) {
  const error = new Error(
    `temporary auto-rescue worktree cleanup failed: ${result.stderr || result.stdout || "unknown error"}`,
  );
  error.code = "AUTO_RESCUE_CLEANUP_FAILED";
  error.cleanupAuthority = {
    journalPath: null,
    tempWorktreePath: journal.tempWorktreePath,
    expectedBaseSha: journal.expectedBaseSha,
    phase: journal.phase,
    residue: { worktree: worktreeResidue, journal: true },
  };
  return error;
}

function pathIsAbsent(filePath) {
  try {
    fs.lstatSync(filePath);
    return false;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  }
}

function removeAutoRescueWorktree(runGitFn, journal) {
  const worktrees = runGitFn(["-C", journal.identity.mainRepoPath, "worktree", "list", "--porcelain"]);
  if (!worktrees.ok) return { ok: false, error: autoRescueCleanupError(journal, worktrees) };
  const registered = worktrees.stdout.split("\n").includes(`worktree ${journal.tempWorktreePath}`);
  if (registered) {
    const cleanupRes = runGitFn([
      "-C", journal.identity.mainRepoPath, "worktree", "remove", "--force", journal.tempWorktreePath,
    ]);
    if (!cleanupRes.ok) {
      return {
        ok: false,
        error: autoRescueCleanupError(journal, cleanupRes, { worktreeResidue: true }),
      };
    }
  } else {
    try {
      fs.lstatSync(journal.tempWorktreePath);
      return {
        ok: false,
        error: autoRescueCleanupError(
          journal,
          { stderr: "unregistered temporary path remains" },
          { worktreeResidue: true },
        ),
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const verified = runGitFn(["-C", journal.identity.mainRepoPath, "worktree", "list", "--porcelain"]);
  if (
    !verified.ok
    || verified.stdout.split("\n").includes(`worktree ${journal.tempWorktreePath}`)
    || !pathIsAbsent(journal.tempWorktreePath)
  ) {
    return {
      ok: false,
      error: autoRescueCleanupError(journal, verified, {
        worktreeResidue: verified.ok ? true : null,
      }),
    };
  }
  return { ok: true };
}

/**
 * R8/R9 auto-rescue cherry-pick driver. Returns one of:
 *   { ok: true, intoBranch, commits }                            — cherry-pick succeeded.
 *   { ok: false, code: "MAIN_REPO_DIRTY", dirtyFiles }           — preflight dirty.
 *   { ok: false, code: "MAIN_REPO_LOCKED" }                      — checkout & fallback both failed.
 *   { ok: false, code: "CHERRY_PICK_CONFLICT", conflictFiles }   — cherry-pick conflict, restored.
 */
function autoRescueIdentity({ mainRepoPath, baseBranch, baseline, featureBranch, specId }) {
  return {
    mainRepoPath: path.resolve(mainRepoPath),
    baseBranch,
    baseline,
    featureBranch,
    specId,
  };
}

function autoRescueBodyError(outcome) {
  const primaryError = new Error(`auto-rescue body failed: ${outcome.code}`);
  primaryError.code = outcome.code;
  primaryError.conflictFiles = [...outcome.conflictFiles];
  if (!outcome.abortFailure) return primaryError;
  const abortError = outcome.abortFailure.toError();
  const error = new AggregateError(
    [primaryError, abortError],
    "auto-rescue cherry-pick and abort both failed",
    { cause: primaryError },
  );
  error.code = primaryError.code;
  error.conflictFiles = [...primaryError.conflictFiles];
  error.outcome = outcome.toJSON();
  return error;
}

function autoRescueRecoveryAuthority(store, journal, phase = journal.phase) {
  return {
    journalPath: store.path,
    tempWorktreePath: journal.tempWorktreePath,
    expectedBaseSha: journal.expectedBaseSha,
    phase,
    residue: { worktree: true, journal: true },
  };
}

function autoRescueCleanupFailure(store, journal, outcome, cleanupError) {
  journal.advance("cleanup-failed", outcome);
  cleanupError.cleanupAuthority.journalPath = store.path;
  cleanupError.cleanupAuthority.phase = journal.phase;
  try {
    store.write(journal);
  } catch (authorityError) {
    const error = new AggregateError(
      [cleanupError, authorityError],
      "auto-rescue cleanup and durable recovery publication both failed",
      { cause: cleanupError },
    );
    error.code = cleanupError.code;
    error.cleanupAuthority = cleanupError.cleanupAuthority;
    throw error;
  }
  if (outcome?.ok === false) {
    const primaryError = autoRescueBodyError(outcome);
    const error = new AggregateError(
      [primaryError, cleanupError],
      "auto-rescue body and temporary worktree cleanup both failed",
      { cause: primaryError },
    );
    error.code = "AUTO_RESCUE_CLEANUP_FAILED";
    error.cleanupAuthority = cleanupError.cleanupAuthority;
    error.bodyCode = primaryError.code;
    throw error;
  }
  return {
    ok: false,
    code: "AUTO_RESCUE_CLEANUP_FAILED",
    cleanupAuthority: cleanupError.cleanupAuthority,
  };
}

function completeAutoRescueCleanup(store, journal, outcome, runGitFn) {
  const cleanup = removeAutoRescueWorktree(runGitFn, journal);
  if (!cleanup.ok) return autoRescueCleanupFailure(store, journal, outcome, cleanup.error);
  try {
    store.remove();
  } catch (cause) {
    const cleanupError = autoRescueCleanupError(
      journal,
      { stderr: cause.message },
      { worktreeResidue: false },
    );
    cleanupError.cause = cause;
    return autoRescueCleanupFailure(store, journal, outcome, cleanupError);
  }
  return outcome?.toJSON() ?? null;
}

export function runDetachedAutoRescue({
  mainRepoPath,
  baseBranch,
  baseline,
  featureBranch,
  specId,
  range,
  runGitFn = runGit,
  tempWorktreePathFactory = () => path.join(
    os.tmpdir(),
    `senti-rescue-tmp-${process.pid}-${Date.now()}`,
  ),
}) {
  const identity = autoRescueIdentity({ mainRepoPath, baseBranch, baseline, featureBranch, specId });
  const store = new AutoRescueCleanupStore(identity);
  const existing = store.load();
  if (existing) {
    const recoveredOutcome = existing.outcome;
    const recovered = completeAutoRescueCleanup(
      store,
      existing,
      recoveredOutcome,
      runGitFn,
    );
    if (recovered !== null) return recovered;
  }

  const baseRef = `refs/heads/${baseBranch}`;
  const baseProbe = runGitFn(["-C", mainRepoPath, "rev-parse", "--verify", baseRef]);
  if (!baseProbe.ok || !GIT_OBJECT_ID.test(baseProbe.stdout.trim())) {
    return AutoRescueOutcome.failure("MAIN_REPO_LOCKED").toJSON();
  }
  const expectedBaseSha = baseProbe.stdout.trim();
  const tempWorktreePath = tempWorktreePathFactory();
  const journal = AutoRescueCleanupJournal.create(identity, expectedBaseSha, tempWorktreePath);
  store.write(journal);
  const addRes = runGitFn([
    "-C", mainRepoPath, "worktree", "add", "--detach", tempWorktreePath, expectedBaseSha,
  ]);
  if (!addRes.ok) {
    const outcome = AutoRescueOutcome.failure("MAIN_REPO_LOCKED");
    journal.advance("body-failed", outcome);
    store.write(journal);
    return completeAutoRescueCleanup(store, journal, outcome, runGitFn);
  }
  journal.advance("worktree-added");
  store.write(journal);

  let outcome = AutoRescueOutcome.fromResult(cherryPickRange(tempWorktreePath, range, runGitFn));
  if (outcome.abortFailure) {
    journal.advance("abort-failed", outcome);
    try {
      store.write(journal);
    } catch (authorityError) {
      const bodyError = autoRescueBodyError(outcome);
      throw new AggregateError(
        [bodyError, authorityError],
        "auto-rescue abort failure and durable recovery publication both failed",
        { cause: bodyError },
      );
    }
    const error = autoRescueBodyError(outcome);
    error.cleanupAuthority = autoRescueRecoveryAuthority(store, journal);
    throw error;
  }
  if (outcome.ok) {
    const headRes = runGitFn(["-C", tempWorktreePath, "rev-parse", "HEAD"]);
    if (!headRes.ok || !GIT_OBJECT_ID.test(headRes.stdout.trim())) {
      outcome = AutoRescueOutcome.failure("MAIN_REPO_LOCKED");
    } else {
      const updateRes = runGitFn([
        "-C",
        mainRepoPath,
        "update-ref",
        baseRef,
        headRes.stdout.trim(),
        expectedBaseSha,
      ]);
      if (!updateRes.ok) outcome = AutoRescueOutcome.failure("MAIN_REPO_LOCKED");
    }
  }
  journal.advance(outcome.ok ? "base-updated" : "body-failed", outcome);
  store.write(journal);
  return completeAutoRescueCleanup(store, journal, outcome, runGitFn);
}

function runAutoRescue({ mainRepoPath, baseBranch, baseline, featureBranch, specId }) {
  const dirtyFiles = listMainRepoDirtyFiles(mainRepoPath, specId);
  if (dirtyFiles.length > 0) {
    return { ok: false, code: "MAIN_REPO_DIRTY", dirtyFiles };
  }

  const range = `${baseline}..${featureBranch}`;
  const identity = autoRescueIdentity({ mainRepoPath, baseBranch, baseline, featureBranch, specId });
  const pendingCleanup = new AutoRescueCleanupStore(identity).load();
  if (pendingCleanup) {
    try {
      return runDetachedAutoRescue({
        mainRepoPath, baseBranch, baseline, featureBranch, specId, range,
      });
    } catch (error) {
      if (error.code !== "AUTO_RESCUE_CLEANUP_FAILED") throw error;
      return {
        ok: false,
        code: error.code,
        bodyCode: error.bodyCode || null,
        cleanupAuthority: error.cleanupAuthority,
      };
    }
  }

  // First try a direct checkout of baseBranch on the main repo.
  const checkoutRes = runGit(["-C", mainRepoPath, "checkout", baseBranch]);
  if (checkoutRes.ok) {
    const result = cherryPickRange(mainRepoPath, range, runGit);
    return result;
  }

  // baseBranch locked — fall back to a temporary detached worktree.
  try {
    return runDetachedAutoRescue({
      mainRepoPath, baseBranch, baseline, featureBranch, specId, range,
    });
  } catch (error) {
    if (error.code === "CHERRY_PICK_CONFLICT" && error.outcome?.abortFailure) {
      return { ...error.outcome, cleanupAuthority: error.cleanupAuthority };
    }
    if (error.code !== "AUTO_RESCUE_CLEANUP_FAILED") throw error;
    return {
      ok: false,
      code: error.code,
      bodyCode: error.bodyCode || null,
      cleanupAuthority: error.cleanupAuthority,
    };
  }
}

/**
 * Run `git cherry-pick <range>` with empty-patch tolerance. On the first
 * conflict, abort and return CHERRY_PICK_CONFLICT.
 */
function cherryPickRange(repoPath, range, runGitFn = runGit) {
  // --allow-empty makes `git cherry-pick` skip empty commits silently;
  // duplicate-content commits still need `--skip` recovery below.
  let res = runGitFn(["-C", repoPath, "cherry-pick", range]);
  while (!res.ok) {
    const text = `${res.stdout || ""}\n${res.stderr || ""}`;
    if (/nothing to commit|previous cherry-pick is now empty/i.test(text)) {
      // Duplicate / empty patch — skip and continue with the rest.
      const skip = runGitFn(["-C", repoPath, "cherry-pick", "--skip"]);
      if (!skip.ok) {
        // --skip itself may fail (no in-progress cherry-pick); abort defensively.
        const abort = runGitFn(["-C", repoPath, "cherry-pick", "--abort"]);
        const abortFailure = abort.ok ? null : AutoRescueAbortFailure.fromGitResult(abort);
        return AutoRescueOutcome.failure(
          "CHERRY_PICK_CONFLICT",
          [],
          abortFailure,
        ).toJSON();
      }
      // After --skip, git may have completed the sequence (skip succeeded with
      // nothing more to do) or be ready for the next commit. Probe with the
      // continuation form: another cherry-pick command is not needed — `--skip`
      // continues the in-progress sequence on its own.
      res = skip;
      // Determine whether a cherry-pick is still in progress; if not, we're done.
      const stateProbe = runGitFn(["-C", repoPath, "rev-parse", "CHERRY_PICK_HEAD"]);
      if (!stateProbe.ok) {
        // No in-progress cherry-pick → sequence completed.
        break;
      }
      continue;
    }
    // Genuine conflict.
    const statusRes = runGitFn(["-C", repoPath, "diff", "--name-only", "--diff-filter=U"]);
    const conflictFiles = statusRes.ok
      ? statusRes.stdout.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];
    const abort = runGitFn(["-C", repoPath, "cherry-pick", "--abort"]);
    const abortFailure = abort.ok ? null : AutoRescueAbortFailure.fromGitResult(abort);
    return AutoRescueOutcome.failure(
      "CHERRY_PICK_CONFLICT",
      conflictFiles,
      abortFailure,
    ).toJSON();
  }
  return { ok: true };
}

export class RunFinalizeCleanupCommand extends FlowCommand {
  async execute(ctx) {
    const mainRoot = ctx.mainRoot || ctx.flowManager?._mainRoot || ctx.root;
    const operation = new FinalizeRepositoryOperationLock(mainRoot);
    return withFinalizeRepositoryOperation(operation, () => this.executeOwned(ctx));
  }

  async executeOwned(ctx) {
    const { root, autoRescue, force } = ctx;
    const state = ctx.flowState;
    const { worktreePath, mainRepoPath } = ctx.flowManager.resolveWorktreePaths(state);
    const { baseBranch, featureBranch, worktree } = state;
    const specId = specIdFromPath(state.spec);
    const reportRoot = mainRepoPath || root;

    // ── Stage (A) — args validation ─────────────────────────────────────────
    if (autoRescue && force) {
      return Envelope.fail("run", "finalize-cleanup", "ARGS_ERROR", [
        "--auto-rescue and --force are mutually exclusive. Pass at most one.",
      ]);
    }

    if (featureBranch !== baseBranch) {
      const resumed = await runPersistedTeardownIfPresent(ctx, {
        worktreePath,
        mainRepoPath,
        reportRoot,
        specId,
      });
      if (resumed != null) return resumed;
      const targetRoot = (worktree && mainRepoPath) ? mainRepoPath : root;
      assertInitialFinalizeGitAuthority({
        targetRoot,
        state,
        worktreePath: worktree && mainRepoPath ? (worktreePath || root) : null,
      });
    }

    // Spec-only mode: feature branch === base branch. There is no merge to
    // bake into a commit — just clear active flow state and emit the report.
    if (featureBranch === baseBranch) {
      return runSpecOnlyCompletion(ctx, { reportRoot, specId });
    }

    // ── Stage (B) — route routing ───────────────────────────────────────────
    const persistedStrategy = state.state?.mergeStrategy ?? null;
    const baseline = state.state?.featureBranchSquashedSha ?? null;

    if (persistedStrategy === "pr") {
      // PR route — orphan detection is out of scope (Issue #316). Proceed
      // straight into the existing teardown transaction.
      return runTeardown(ctx, { worktreePath, mainRepoPath, reportRoot, specId });
    }

    if (persistedStrategy !== "squash") {
      // Either an old flow.json predating this feature, or a corrupt state.
      // Halt unless the user explicitly waives baseline checking via --force.
      if (!force) {
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          "SQUASH_BASELINE_MISSING",
          [
            "Squash baseline is not recorded on this flow (mergeStrategy is missing).",
            "Detection cannot run safely. Recovery: archive the feature branch, inspect commits via patch, cherry-pick post-squash fixes onto baseBranch by hand, then re-run with --force.",
            "Resolve any cherry-pick state via `git cherry-pick --skip` or `git cherry-pick --abort` before retrying.",
          ],
          {
            recordedSha: null,
            baseBranch,
            featureBranch,
            recoveryOptions: RECOVERY_OPTIONS_BASELINE,
          },
        );
      }
      // --force path: skip detection, proceed to forced teardown with audit.
      return runForcedTeardown(ctx, {
        worktreePath,
        mainRepoPath,
        reportRoot,
        specId,
        baseline: null,
        featureBranch,
        baseBranch,
      });
    }

    // ── Stage (C) — orphan guard (squash route only) ────────────────────────
    if (!baseline) {
      if (!force) {
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          "SQUASH_BASELINE_MISSING",
          [
            "Squash baseline SHA is missing for this squash-route flow.",
            "Detection cannot run safely. Recovery: archive the feature branch, inspect commits via patch, cherry-pick post-squash fixes onto baseBranch by hand, then re-run with --force.",
          ],
          {
            recordedSha: null,
            baseBranch,
            featureBranch,
            recoveryOptions: RECOVERY_OPTIONS_BASELINE,
          },
        );
      }
      return runForcedTeardown(ctx, {
        worktreePath,
        mainRepoPath,
        reportRoot,
        specId,
        baseline: null,
        featureBranch,
        baseBranch,
      });
    }

    // R1: resolve the current featureBranch ref explicitly (NOT process HEAD;
    // in branch mode HEAD points at baseBranch by the time cleanup runs).
    const currentRes = runGit([
      "-C",
      mainRepoPath || root,
      "rev-parse",
      featureBranch,
    ]);
    if (!currentRes.ok) {
      return Envelope.fail("run", "finalize-cleanup", "BRANCH_REF_RESOLUTION_FAILED", [
        `Failed to resolve ref for ${featureBranch}: ${currentRes.stderr || currentRes.stdout}`,
      ]);
    }
    const currentSha = currentRes.stdout.trim();

    if (currentSha === baseline) {
      // No-op: feature branch unchanged since squash. Proceed to teardown.
      return runTeardown(ctx, { worktreePath, mainRepoPath, reportRoot, specId });
    }

    const ancestryRes = runGit([
      "-C",
      mainRepoPath || root,
      "merge-base",
      "--is-ancestor",
      baseline,
      featureBranch,
    ]);
    if (!ancestryRes.ok) {
      // Non-zero exit means baseline is NOT an ancestor of featureBranch
      // (history rewrite — rebase / amend / force-update).
      if (!force) {
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          "SQUASH_BASELINE_DIVERGED",
          [
            "Squash baseline is no longer an ancestor of the feature branch.",
            "This indicates a history rewrite (rebase / amend / force-update).",
            "Recovery: archive the current branch, inspect commits via patch, cherry-pick fixes onto baseBranch manually, then re-run with --force.",
          ],
          {
            recordedSha: baseline,
            currentSha,
            baseBranch,
            featureBranch,
            recoveryOptions: RECOVERY_OPTIONS_BASELINE,
          },
        );
      }
      return runForcedTeardown(ctx, {
        worktreePath,
        mainRepoPath,
        reportRoot,
        specId,
        baseline,
        featureBranch,
        baseBranch,
        diverged: true,
      });
    }

    // baseline is an ancestor and SHA differs → orphan commits exist.
    const orphan = readOrphanCommits(mainRepoPath || root, baseline, featureBranch);
    if (!orphan.ok) {
      return Envelope.fail("run", "finalize-cleanup", "ORPHAN_LISTING_FAILED", [
        `Failed to list orphan commits: ${orphan.reason}`,
      ]);
    }
    if (orphan.count === 0) {
      // Baseline differs from current SHA but the range is empty
      // (e.g. a merge commit with no exclusive commits). Treat as no-op.
      return runTeardown(ctx, { worktreePath, mainRepoPath, reportRoot, specId });
    }

    if (autoRescue) {
      const rescue = runAutoRescue({
        mainRepoPath: mainRepoPath || root,
        baseBranch,
        baseline,
        featureBranch,
        specId,
      });
      if (rescue.ok) {
        const teardown = await runTeardown(ctx, {
          worktreePath,
          mainRepoPath,
          reportRoot,
          specId,
        });
        if (teardown && teardown.data) {
          teardown.data.rescued = {
            commits: orphan.commits,
            intoBranch: baseBranch,
          };
        }
        return teardown;
      }
      // Rescue failed — record audit log for CHERRY_PICK_CONFLICT, halt.
      if (rescue.code === "CHERRY_PICK_CONFLICT" && mainRepoPath) {
        try {
          appendIssueLog(mainRepoPath, state.spec, {
            step: "finalize-cleanup",
            reason: "cherry-pick conflict during auto-rescue (worktree retained for manual recovery)",
            trigger: "senti flow run finalize-cleanup --auto-rescue",
            resolution: rescue.abortFailure
              ? "cherry-pick abort failed; durable temporary-worktree cleanup authority retained for retry"
              : "cherry-pick aborted; user must resolve manually via archive + individual cherry-pick",
            taskId: null,
          }, finalizeAuditId("cherry-pick-conflict", state, { baseline, featureBranch }));
        } catch (err) {
          return Envelope.fail(
            "run",
            "finalize-cleanup",
            "ISSUE_LOG_AUDIT_FAILED",
            `Required cherry-pick conflict audit append failed: ${err.message}`,
            { originalCode: "CHERRY_PICK_CONFLICT", causeCode: err.code || null },
          );
        }
      }
      const failPayload = {
        recordedSha: baseline,
        currentSha,
        baseBranch,
        featureBranch,
        recoveryOptions: RECOVERY_OPTIONS_RESCUE_FAIL,
      };
      if (rescue.code === "MAIN_REPO_DIRTY") {
        failPayload.dirtyFiles = rescue.dirtyFiles;
        failPayload.recoveryOptions = RECOVERY_OPTIONS_DIRTY;
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          "MAIN_REPO_DIRTY",
          [
            "Main repository has uncommitted changes that block auto-rescue.",
            "Commit or stash them, then retry with --auto-rescue, or retry without rescue and rescue manually.",
          ],
          failPayload,
        );
      }
      if (rescue.code === "MAIN_REPO_LOCKED") {
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          "MAIN_REPO_LOCKED",
          [
            `Failed to acquire baseBranch ${baseBranch} for auto-rescue (locked and detached fallback failed).`,
            "Resolve worktree contention manually and retry, or rescue manually.",
          ],
          failPayload,
        );
      }
      if (rescue.code === "AUTO_RESCUE_CLEANUP_FAILED") {
        failPayload.cleanupAuthority = rescue.cleanupAuthority;
        failPayload.bodyCode = rescue.bodyCode || null;
        failPayload.recoveryOptions = ["retry-auto-rescue-cleanup", "inspect-temporary-worktree"];
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          rescue.code,
          [
            "Auto-rescue stopped because its temporary worktree cleanup was not verified.",
            "Retry with --auto-rescue to resume the durable cleanup authority before teardown.",
          ],
          failPayload,
        );
      }
      // CHERRY_PICK_CONFLICT
      failPayload.conflictFiles = rescue.conflictFiles || [];
      if (rescue.abortFailure) {
        failPayload.abortFailure = rescue.abortFailure;
        failPayload.cleanupAuthority = rescue.cleanupAuthority;
        failPayload.recoveryOptions = ["retry-auto-rescue-cleanup", "inspect-temporary-worktree"];
      }
      return Envelope.fail(
        "run",
        "finalize-cleanup",
        "CHERRY_PICK_CONFLICT",
        [
          "Cherry-pick of orphan commits onto baseBranch produced a conflict.",
          "The worktree and feature branch are retained for manual recovery.",
          rescue.abortFailure
            ? "Cherry-pick abort also failed; retry with --auto-rescue to resume the durable temporary-worktree cleanup authority."
            : "Resolve any cherry-pick state via `git cherry-pick --skip` or `git cherry-pick --abort` if your local state is left in an in-progress cherry-pick.",
        ],
        failPayload,
      );
    }

    if (force) {
      return runForcedTeardown(ctx, {
        worktreePath,
        mainRepoPath,
        reportRoot,
        specId,
        baseline,
        featureBranch,
        baseBranch,
        droppedCommits: orphan.commits,
        droppedCount: orphan.count,
        droppedTruncated: orphan.truncated,
      });
    }

    // Default: detect-and-halt with the canonical user-facing recovery menu.
    return Envelope.fail(
      "run",
      "finalize-cleanup",
      "ORPHAN_COMMITS_DETECTED",
      [
        `Orphan commits detected on ${featureBranch} (${orphan.count} commit(s) beyond the recorded squash baseline).`,
        "These commits are not reachable from the recorded squash baseline and would be dropped by branch deletion.",
        "Recovery options:",
        "  - cherry-pick: re-run with `--auto-rescue` to cherry-pick orphan commits onto baseBranch",
        "  - abort: leave the worktree and feature branch as-is and inspect/handle manually",
        "  - force-continue: re-run with `--force` to delete the branch (commits will be lost; recorded to issue-log)",
      ],
      {
        recordedSha: baseline,
        currentSha,
        count: orphan.count,
        truncated: orphan.truncated,
        orphanCommits: orphan.commits,
        baseBranch,
        featureBranch,
        recoveryOptions: RECOVERY_OPTIONS_DETECT,
      },
    );
  }
}

/**
 * Stage (D) — the original transactional teardown.
 * Extracted into a function so route routing and the no-op orphan path can
 * fall through to the same authoritative cleanup transaction.
 */
async function withFinalizeTransactionStore(store, body) {
  try {
    store.acquire();
  } catch (error) {
    if (error.code === "FINALIZE_TEARDOWN_BUSY") {
      return Envelope.fail(
        "run",
        "finalize-cleanup",
        "FINALIZE_TEARDOWN_BUSY",
        "Another finalize-cleanup process owns this flow transaction.",
        { lockPath: error.lockPath },
      );
    }
    throw error;
  }
  let result;
  let primaryError = null;
  try {
    result = await body();
  } catch (error) {
    primaryError = error;
  }
  let releaseError = null;
  try {
    store.release();
  } catch (error) {
    releaseError = error;
  }
  if (primaryError && releaseError) {
    throw new AggregateError(
      [primaryError, releaseError],
      "finalize transaction body and lock release both failed",
      { cause: primaryError },
    );
  }
  if (primaryError) throw primaryError;
  if (releaseError) throw releaseError;
  return result;
}

async function runSpecOnlyCompletion(ctx, { reportRoot, specId }) {
  const store = new FinalizeTeardownTransactionStore(reportRoot, ctx.flowState, { commitRequired: false });
  return withFinalizeTransactionStore(store, async () => {
    let result;
    const existed = store.hasExisting();
    const transaction = store.loadOrCreate();
    if (!existed) store.write(transaction);
    if (transaction.phase.atLeast("pointer-written")) assertPointerReality(reportRoot, ctx.flowState.spec);
    if (transaction.phase.atLeast("active-cleared")) assertActiveFlowCleared(ctx, specId);
    const attachTransaction = (env) => {
      if (env.data == null) env.data = {};
      env.data.teardown = transaction.result.toJSON();
      return env;
    };
    if (!transaction.phase.atLeast("pointer-written")) {
      try {
        writeLastFinalizedPointer(reportRoot, ctx.flowState.spec);
      } catch (error) {
        transaction.fail("FINALIZE_POINTER_WRITE_FAILED");
        store.write(transaction);
        result = attachTransaction(Envelope.fail(
          "run",
          "finalize-cleanup",
          "FINALIZE_POINTER_WRITE_FAILED",
          `Spec-only completion pointer publication failed: ${error.message}`,
          { causeCode: error.code || null },
        ));
      }
      if (!result) {
        transaction.advance("pointer-written", { commitSha: null });
        store.write(transaction);
      }
    }
    if (!result && !transaction.phase.atLeast("active-cleared")) {
      try {
        ctx.flowManager.clearFlowState(specId);
      } catch (error) {
        transaction.fail("ACTIVE_FLOW_CLEAR_FAILED");
        store.write(transaction);
        result = attachTransaction(Envelope.fail(
          "run",
          "finalize-cleanup",
          "ACTIVE_FLOW_CLEAR_FAILED",
          `Spec-only active-flow cleanup failed: ${error.message}`,
          { causeCode: error.code || null },
        ));
      }
      if (!result) {
        transaction.advance("active-cleared", { commitSha: null });
        store.write(transaction);
      }
    }
    if (!result) {
      if (!transaction.phase.atLeast("completed")) {
        transaction.advance("completed", { commitSha: null });
        store.write(transaction);
      }
      result = attachTransaction(attachReport(
        Envelope.ok("run", "finalize-cleanup", { status: "done", message: "spec-only mode" }),
        reportRoot,
      ));
    }
    return result;
  });
}

async function runTeardown(ctx, options) {
  const store = new FinalizeTeardownTransactionStore(options.reportRoot, ctx.flowState);
  return withFinalizeTransactionStore(
    store,
    () => runTeardownTransaction(ctx, options, store),
  );
}

async function runPersistedTeardownIfPresent(ctx, options) {
  const store = new FinalizeTeardownTransactionStore(options.reportRoot, ctx.flowState);
  return withFinalizeTransactionStore(store, async () => {
    if (!store.hasExisting()) return null;
    return runTeardownTransaction(ctx, options, store);
  });
}

function replaceFlowState(targetFm, specId, originalState) {
  targetFm.mutate((state) => {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, structuredClone(originalState));
  }, { specId });
}

function gitFailure(code, message, result) {
  const error = new Error(`${message}: ${result.stderr || result.stdout || "unknown git error"}`);
  error.code = code;
  return error;
}

function compensatePreCommit({ targetRoot, targetFm, specId, originalState, stagedPaths, primaryError }) {
  const cleanupErrors = [];
  if (stagedPaths.length > 0) {
    const reset = runGit(["-C", targetRoot, "reset", "--quiet", "HEAD", "--", ...stagedPaths]);
    if (!reset.ok) cleanupErrors.push(gitFailure("FINALIZE_INDEX_RESTORE_FAILED", "finalize index restore failed", reset));
  }
  try {
    replaceFlowState(targetFm, specId, originalState);
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      [primaryError, ...cleanupErrors],
      "finalize staging and pre-commit compensation both failed",
      { cause: primaryError },
    );
  }
}

async function runTeardownTransaction(ctx, { worktreePath, mainRepoPath, reportRoot, specId }, transactionStore) {
  const state = ctx.flowState;
  const { featureBranch, worktree, baseBranch } = state;
  let pluginLifecycle = { warnings: [], issueLogEntries: [], data: {} };
  let retainedCleanupMetadata = null;
  const pluginContext = finalizeCleanupPluginLifecycleContext({
    root: ctx.root,
    state,
    worktreePath,
    mainRepoPath,
    specId,
  });

  // (i) metadata sync + finalize-cleanup → 'done'.
  const targetRoot = (worktree && mainRepoPath) ? mainRepoPath : ctx.root;
  const targetFm = (worktree && mainRepoPath) ? ctx.flowManager.forRoot(mainRepoPath) : ctx.flowManager;
  let originalFlowState = null;
  const transaction = transactionStore.loadOrCreate();
  if (!transaction.phase.atLeast("commit-durable") && transaction.commitExpectation) {
    const recovery = inspectExpectedCommit(transaction.commitExpectation, { targetRoot, state });
    if (recovery.adopted) {
      transaction.advance("commit-durable", { commitSha: recovery.head });
      transactionStore.write(transaction);
    }
  }
  const gitAuthorityRoot = mainRepoPath || targetRoot;
  assertPersistedTeardownReality(transaction, ctx, {
    worktreePath,
    mainRepoPath,
    targetRoot,
    reportRoot,
    specId,
  });
  const attachTransaction = (env) => {
    if (env.data == null) env.data = {};
    env.data.teardown = transaction.result?.toJSON() ?? new FinalizeTeardownResult({
      phase: transaction.phase,
      ok: env.ok,
      code: env.errors?.[0]?.code ?? null,
    }).toJSON();
    return env;
  };
  if (transaction.authorization.route === "forced" && !transaction.phase.atLeast("commit-durable")) {
    try {
      appendForcedFinalizeAudit(reportRoot, state, transaction.authorization);
    } catch (error) {
      return attachTransaction(Envelope.fail(
        "run",
        "finalize-cleanup",
        "ISSUE_LOG_AUDIT_FAILED",
        `Required forced teardown audit append failed: ${error.message}`,
        { causeCode: error.code || null, auditId: transaction.authorization.auditId },
      ));
    }
  }
  if (transaction.phase.atLeast("branch-deleted")) {
    assertCommitReachableFromBase(transaction, { mainRepoPath: gitAuthorityRoot, state });
  }
  const failAfterCommit = (env) => {
    transaction.fail(env.errors?.[0]?.code || "FINALIZE_TEARDOWN_FAILED");
    transactionStore.write(transaction);
    return attachTransaction(env);
  };

  if (!transaction.phase.atLeast("commit-durable")) {
    // Spec 272: sync unreflected flow metadata (e.g. retry success logs) from
    // worktree to main before teardown.
    if (worktree && mainRepoPath && ctx.root !== mainRepoPath) {
      try {
        syncMetadataFromWorktreeToMain(ctx.root, mainRepoPath, specId);
      } catch (err) {
        return attachTransaction(Envelope.fail(
          "run",
          "finalize-cleanup",
          "FINALIZE_METADATA_SYNC_FAILED",
          [
            `Finalize metadata sync failed: ${err.message}`,
            "No finalize step, commit, active-flow, worktree, branch, or Git history cleanup was attempted.",
            "Resolve the metadata authority or writer lock failure, then retry finalize-cleanup.",
          ],
          {
            specId,
            worktreePath: ctx.root,
            mainRepoPath,
            causeCode: err.code || null,
          },
        ));
      }
    }

    try {
      pluginLifecycle = await runFlowCommandWithPluginLifecycle(pluginContext.root, state.plugins?.flowCommandHooks || [], {
        command: "finalize-cleanup",
        flow: pluginContext.flow,
        main: async () => ({
          ok: true,
          data: {
            specPath: state.spec,
            issueLogPath: `specs/${specId}/issue-log.json`,
            artifactPath: pluginContext.artifactPath,
          },
        }),
      });
    } catch (err) {
      pluginLifecycle = {
        warnings: [{ code: "PLUGIN_LIFECYCLE_FAILED", message: err.message }],
        issueLogEntries: [{ reason: `plugin finalize-cleanup lifecycle failed: ${err.message}`, payload: { code: "PLUGIN_LIFECYCLE_FAILED" } }],
        data: {},
      };
    }

    if (worktree && mainRepoPath) {
      const finalizeCleanupStep = flattenSteps(state.steps || []).find((step) => step.id === "finalize-cleanup");
      retainedCleanupMetadata = recordFinalizeCleanupPostCommandMetadata({
        flowManager: ctx.flowManager,
        specId,
        metrics: Array.isArray(state.metrics) ? state.metrics : [],
        runtimeLog: finalizeCleanupStep?.runtimeLog || null,
        notes: Array.isArray(state.notes) ? state.notes : [],
        issueLogEntries: pluginLifecycle.issueLogEntries || [],
        pluginArtifacts: pluginLifecycle.data?.pluginHooks || [],
      });
    }

    const flowJsonRel = `specs/${specId}/flow.json`;
    originalFlowState = JSON.parse(fs.readFileSync(path.join(targetRoot, flowJsonRel), "utf8"));
    targetFm.updateStepStatus("finalize-cleanup", "done", { specId });

    // (ii) stage + commit. Stage flow.json plus issue-log if present so audit
    // entries written by --force / CHERRY_PICK_CONFLICT during the same run
    // become atomically persisted (R14).
    const issueLogRel = `specs/${specId}/issue-log.json`;
    const commitPaths = [flowJsonRel];
    if (fs.existsSync(path.join(targetRoot, issueLogRel))) commitPaths.push(issueLogRel);
    const flowAdd = runGit(["-C", targetRoot, "add", "--", flowJsonRel]);
    if (!flowAdd.ok) {
      const primary = gitFailure("FINALIZE_GIT_ADD_FAILED", `git add failed for ${flowJsonRel}`, flowAdd);
      compensatePreCommit({
        targetRoot,
        targetFm,
        specId,
        originalState: originalFlowState,
        stagedPaths: [],
        primaryError: primary,
      });
      return attachTransaction(Envelope.fail("run", "finalize-cleanup", primary.code, primary.message));
    }
    if (fs.existsSync(path.join(targetRoot, issueLogRel))) {
      const issueAdd = runGit(["-C", targetRoot, "add", "--", issueLogRel]);
      if (!issueAdd.ok) {
        const primary = gitFailure("FINALIZE_GIT_ADD_FAILED", `git add failed for ${issueLogRel}`, issueAdd);
        compensatePreCommit({
          targetRoot,
          targetFm,
          specId,
          originalState: originalFlowState,
          stagedPaths: [flowJsonRel],
          primaryError: primary,
        });
        return attachTransaction(Envelope.fail("run", "finalize-cleanup", primary.code, primary.message));
      }
    }
    const commitMsg = `chore: finalize ${specId}`;
    const commitExpectation = buildCommitExpectation({
      transaction,
      targetRoot,
      state,
      commitMessage: commitMsg,
      commitPaths,
      worktreePath: worktree && mainRepoPath ? (worktreePath || ctx.root) : null,
    });
    transaction.expectCommit(commitExpectation);
    transactionStore.write(transaction);
    assertCommitExpectationFresh(transaction.commitExpectation, {
      targetRoot,
      state,
      commitMessage: commitMsg,
      commitPaths,
      worktreePath: worktree && mainRepoPath ? (worktreePath || ctx.root) : null,
    });
    const commitRes = runGit(["-C", targetRoot, "commit", "-m", commitMsg, "--", ...commitPaths]);
    if (!commitRes.ok) {
      const recovery = inspectExpectedCommit(transaction.commitExpectation, { targetRoot, state });
      if (recovery.adopted) {
        transaction.advance("commit-durable", { commitSha: recovery.head });
        transactionStore.write(transaction);
      } else {
        const primary = gitFailure("COMMIT_FAILED", "git commit failed", commitRes);
        const secondary = [];
        try {
          targetFm.updateStepStatus("finalize-cleanup", "in_progress", { specId });
        } catch (error) {
          secondary.push(error);
        }
        transaction.fail("COMMIT_FAILED");
        try {
          transactionStore.write(transaction);
        } catch (error) {
          secondary.push(error);
        }
        if (secondary.length > 0) {
          throw new AggregateError(
            [primary, ...secondary],
            "finalize commit and recovery operations failed",
            { cause: primary },
          );
        }
        return attachTransaction(Envelope.fail("run", "finalize-cleanup", "COMMIT_FAILED", [
          primary.message,
        ]));
      }
    } else {
      const committed = inspectExpectedCommit(transaction.commitExpectation, { targetRoot, state });
      if (!committed.adopted) {
        transaction.fail("COMMIT_DURABILITY_UNCONFIRMED");
        transactionStore.write(transaction);
        return attachTransaction(Envelope.fail("run", "finalize-cleanup", "COMMIT_DURABILITY_UNCONFIRMED", [
          "Finalize commit returned success but repository HEAD did not advance.",
        ]));
      }
      transaction.advance("commit-durable", { commitSha: committed.head });
      transactionStore.write(transaction);
    }
  }

  // (iii) Commit is durable. Resume destructive phases without revisiting the commit.
  if (!transaction.phase.atLeast("worktree-removed") && worktree && mainRepoPath) {
    assertWorktreeAuthority(transaction, { mainRepoPath, state });
    const wtPath = worktreePath || ctx.root;
    if (fs.existsSync(wtPath)) {
      const removeResult = removeWorktreeForCleanup({
        mainRepoPath,
        worktreePath: wtPath,
        featureBranch,
        force: ctx.force === true,
      });
      if (!removeResult.ok) return failAfterCommit(removeResult.env);
    }
    transaction.advance("worktree-removed");
    transactionStore.write(transaction);
  } else if (!transaction.phase.atLeast("worktree-removed")) {
    transaction.advance("worktree-removed");
    transactionStore.write(transaction);
  }

  if (!transaction.phase.atLeast("branch-deleted") && worktree && mainRepoPath) {
    assertFeatureAuthority(transaction, { mainRepoPath, state });
    assertCommitReachableFromBase(transaction, { mainRepoPath, state });
    const branchDelete = deleteFeatureBranchForCleanup({
      mainRepoPath,
      featureBranch,
      expectedSha: transaction.commitExpectation.featureRef,
    });
    if (!branchDelete.ok) return failAfterCommit(branchDelete.env);
    transaction.advance("branch-deleted");
    transactionStore.write(transaction);
  } else if (!transaction.phase.atLeast("branch-deleted")) {
    assertFeatureAuthority(transaction, { mainRepoPath: targetRoot, state });
    assertCommitReachableFromBase(transaction, { mainRepoPath: targetRoot, state });
    const branchDelete = deleteFeatureBranchForCleanup({
      mainRepoPath: targetRoot,
      featureBranch,
      expectedSha: transaction.commitExpectation.featureRef,
    });
    if (!branchDelete.ok) return failAfterCommit(branchDelete.env);
    transaction.advance("branch-deleted");
    transactionStore.write(transaction);
  }

  assertCommitReachableFromBase(transaction, { mainRepoPath: gitAuthorityRoot, state });

  if (!transaction.phase.atLeast("validated")) {
    const validation = validateTeardown({
      worktreePath,
      mainRepoPath: mainRepoPath || targetRoot,
      featureBranch,
      specId,
    });
    if (!validation.ok) {
      if (validation.probeFailed) {
        return attachTransaction(Envelope.fail(
          "run",
          "finalize-cleanup",
          "TEARDOWN_VALIDATION_PROBE_FAILED",
          [
            "Teardown validation could not establish Git worktree and branch reality.",
            ...validation.reasons.map((reason) => `- ${reason}`),
          ],
        ));
      }
      return failAfterCommit(Envelope.fail("run", "finalize-cleanup", "TEARDOWN_VALIDATION_FAILED", [
        "Teardown appeared to succeed but resources remain:",
        ...validation.reasons.map((r) => `- ${r}`),
      ]));
    }
    transaction.advance("validated");
    transactionStore.write(transaction);
  }

  // (iv) Publish completion only after strict validation. Each durable authority
  // transition is journaled before the next one begins, so a crash or I/O error
  // cannot remove every recovery route at once.
  if (!transaction.phase.atLeast("pointer-written")) {
    try {
      writeLastFinalizedPointer(reportRoot, state.spec);
    } catch (error) {
      return failAfterCommit(Envelope.fail(
        "run",
        "finalize-cleanup",
        "FINALIZE_POINTER_WRITE_FAILED",
        `Finalize commit and teardown are durable, but completion pointer publication failed: ${error.message}`,
        { causeCode: error.code || null },
      ));
    }
    transaction.advance("pointer-written");
    transactionStore.write(transaction);
  }

  if (!transaction.phase.atLeast("active-cleared")) {
    try {
      ctx.flowManager.clearFlowState(specId);
    } catch (error) {
      return failAfterCommit(Envelope.fail(
        "run",
        "finalize-cleanup",
        "ACTIVE_FLOW_CLEAR_FAILED",
        `Finalize completion pointer is durable, but active-flow cleanup failed: ${error.message}`,
        { causeCode: error.code || null },
      ));
    }
    transaction.advance("active-cleared");
    transactionStore.write(transaction);
  }
  if (!transaction.phase.atLeast("completed")) {
    transaction.advance("completed");
    transactionStore.write(transaction);
  }

  const env = attachReport(
    Envelope.ok("run", "finalize-cleanup", {
      status: "done",
      pluginHooks: pluginLifecycle.data?.pluginHooks || [],
      followUps: pluginLifecycle.data?.followUps || [],
      retainedCleanupMetadata: retainedCleanupMetadata
        ? { surfaces: retainedCleanupMetadata.surfaces }
        : null,
    }),
    reportRoot,
  );
  for (const warning of pluginLifecycle.warnings || []) {
    env.addWarning(warning.code || "PLUGIN_HOOK_WARNING", warning.message || JSON.stringify(warning));
  }
  if (worktree && mainRepoPath) {
    attachOtherFlowMetadataWarning(env, mainRepoPath, specId);
  }
  return attachForcedFinalizeContext(attachTransaction(env), transaction.authorization);
}

/**
 * Spec 272: Sync unreflected Spec-Driven Development metadata (runtimeLog only) from worktree to main.
 * Status and other fields are already handled by the post-hook authoritative
 * updates or squash-merge. We only pick up logs from previous successful retries
 * that might have only landed in the worktree's flow.json.
 */
export function syncMetadataFromWorktreeToMain(worktreeRoot, mainRoot, specId) {
  const wtPath = path.join(worktreeRoot, "specs", specId, "flow.json");
  const mainPath = path.join(mainRoot, "specs", specId, "flow.json");
  if (!fs.existsSync(wtPath) || !fs.existsSync(mainPath)) return;

  const wtState = JSON.parse(fs.readFileSync(wtPath, "utf8"));
  const wtSteps = flattenSteps(wtState.steps || []);
  const flowManager = new FlowManager({ root: mainRoot, mainRoot, inWorktree: false, specId });
  flowManager.mutate((mainState) => {
    const mainSteps = flattenSteps(mainState.steps || []);
    for (const wtStep of wtSteps) {
      if (!wtStep.runtimeLog) continue;
      const mainStep = mainSteps.find((s) => s.id === wtStep.id);
      if (!mainStep) continue;

      const mainSequence = mainStep.runtimeLog?.sequence;
      const worktreeSequence = wtStep.runtimeLog.sequence;
      // Preserve a concurrent main writer; only advance to a newer worktree log.
      if (
        !mainStep.runtimeLog
        || (Number.isSafeInteger(worktreeSequence) && worktreeSequence > mainSequence)
      ) {
        mainStep.runtimeLog = { ...wtStep.runtimeLog };
      }
    }
  }, { specId });
}

export function validateTeardown({
  worktreePath,
  mainRepoPath,
  featureBranch,
  specId,
  checkBranch = true,
  runGit: runGitFn = runGit,
}) {
  const reasons = [];
  let probeFailed = false;

  if (mainRepoPath) {
    const wtListRes = runGitFn(["-C", mainRepoPath, "worktree", "list", "--porcelain"]);
    if (!wtListRes.ok) {
      probeFailed = true;
      reasons.push(`Git worktree validation probe failed: ${wtListRes.stderr || wtListRes.stdout || "unknown"}`);
    } else if (worktreePath) {
      const absPath = path.resolve(worktreePath);
      if (wtListRes.stdout.split("\n").some((line) => line === `worktree ${absPath}`)) {
        reasons.push(`Worktree registration remains for ${absPath}`);
      }
    }

    if (worktreePath && pathExistsStrict(worktreePath)) {
      reasons.push(`Physical worktree directory remains: ${worktreePath}`);
    }

    if (checkBranch) {
      const branchRes = runGitFn(["-C", mainRepoPath, "branch", "--list", featureBranch]);
      if (!branchRes.ok) {
        probeFailed = true;
        reasons.push(`Git branch validation probe failed: ${branchRes.stderr || branchRes.stdout || "unknown"}`);
      } else if (branchRes.stdout.trim()) {
        reasons.push(`Feature branch remains: ${featureBranch}`);
      }
    }
  }

  return { ok: reasons.length === 0, reasons, probeFailed };
}

export { runTeardown };

/**
 * --force teardown variant: persist a FORCED_ORPHAN_DROP audit entry to the
 * main repo issue-log before the existing teardown commits + deletes. The
 * audit entry is staged together with flow.json by runTeardown so the entire
 * destructive action lands in a single commit.
 */
async function runForcedTeardown(ctx, opts) {
  const state = ctx.flowState;
  const { mainRepoPath, baseline, featureBranch, baseBranch } = opts;
  const droppedCommits = opts.droppedCommits || [];
  const droppedCount = opts.droppedCount ?? droppedCommits.length;
  const droppedTruncated = opts.droppedTruncated ?? false;
  const auditTarget = mainRepoPath || ctx.root;

  const auditId = finalizeAuditId("forced-orphan-drop", state, {
    baseline,
    featureBranch,
    droppedCommits: droppedCommits.map((commit) => commit.sha),
  });
  const authorization = FinalizeTeardownAuthorization.forced(state, {
    auditId,
    baseline,
    diverged: opts.diverged,
    droppedCommits,
    droppedCount,
    droppedTruncated,
  });
  const store = new FinalizeTeardownTransactionStore(opts.reportRoot, state, { authorization });
  const teardown = await withFinalizeTransactionStore(store, async () => {
    const existed = store.hasExisting();
    const transaction = store.loadOrCreate();
    if (!existed) store.write(transaction);
    return runTeardownTransaction(ctx, opts, store);
  });
  if (!teardown.ok) {
    if (teardown.errors?.[0]?.code === "ISSUE_LOG_AUDIT_FAILED") return teardown;
    const failedPhase = teardown.data?.teardown?.phase ?? "pre-commit";
    if (!FinalizeTeardownPhase.from(failedPhase).atLeast("commit-durable")) {
      try {
        restoreIssueLog(auditTarget, state.spec, auditId);
      } catch (err) {
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          "ISSUE_LOG_AUDIT_COMPENSATION_FAILED",
          [
            `Teardown failed with ${teardown.errors?.[0]?.code || "unknown error"}.`,
            `The forced teardown audit entry could not be compensated: ${err.message}`,
          ],
          {
            originalTeardown: teardown.toJSON ? teardown.toJSON() : teardown,
            causeCode: err.code || null,
            auditId,
          },
        );
      }
    }
    return teardown;
  }

  return teardown;
}

export default RunFinalizeCleanupCommand;
