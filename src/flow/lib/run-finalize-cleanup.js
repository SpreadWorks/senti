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
import { IssueLogDocument, IssueLogStore } from "./issue-log-store.js";
import { runFlowCommandWithPluginLifecycle } from "../../lib/plugin-registry.js";
import { FlowManager } from "../../lib/flow-manager.js";
import { AtomicJsonFile } from "../../lib/atomic-json-file.js";
import { ProcessOwnedLock, RealDirectoryAuthority } from "../../lib/process-owned-lock.js";
import {
  RepositoryFlowOperationLock,
  resolveRepositoryLockRoot,
} from "../../lib/repository-maintenance-lock.js";

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
const FINALIZE_TEARDOWN_VERSION = 6;
const GIT_OBJECT_ID = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const FINALIZE_BEFORE_IMAGE_MAX_FILES = 512;
const FINALIZE_BEFORE_IMAGE_MAX_DIRECTORIES = 512;
const FINALIZE_BEFORE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const FINALIZE_TEARDOWN_PHASES = Object.freeze([
  "prepared",
  "commit-durable",
  "index-reconciled",
  "worktree-removed",
  "branch-deleted",
  "validated",
  "pointer-written",
  "active-cleared",
  "completed",
]);
const FINALIZE_REPOSITORY_LOCK_FILE = ".repository-finalize.lock";
const AUTO_RESCUE_CLEANUP_VERSION = 5;
const AUTO_RESCUE_CLEANUP_PHASES = new Set([
  "staged",
  "worktree-added",
  "ref-update-prepared",
  "body-failed",
  "abort-failed",
  "base-updated",
  "worktree-materialized",
  "cleanup-failed",
  "completed",
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
    commitPaths,
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
    if (
      !Array.isArray(commitPaths)
      || commitPaths.length === 0
      || commitPaths.some((entry) => {
        try {
          assertFinalizeRelativePath(entry, "finalize commit path");
          return false;
        } catch {
          return true;
        }
      })
      || new Set(commitPaths).size !== commitPaths.length
    ) {
      throw new Error("finalize commit expectation.commitPaths is invalid");
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
    this.commitPaths = Object.freeze([...commitPaths]);
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
      "commitPaths",
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
      commitPaths: [...this.commitPaths],
      worktreePath: this.worktreePath,
      worktreeHead: this.worktreeHead,
    };
  }
}

class FinalizeFileBeforeImage {
  constructor({ relativePath, bytes, mode, revision }) {
    assertFinalizeRelativePath(relativePath, "finalize file before-image path");
    if (typeof bytes !== "string" || !Number.isInteger(mode) || !SHA256.test(String(revision))) {
      throw new Error("finalize file before-image is invalid");
    }
    const decoded = Buffer.from(bytes, "base64");
    if (crypto.createHash("sha256").update(decoded).digest("hex") !== revision) {
      throw new Error("finalize file before-image revision is invalid");
    }
    this.relativePath = relativePath;
    this.bytes = bytes;
    this.mode = mode;
    this.revision = revision;
    Object.freeze(this);
  }

  static capture(root, filePath, stat) {
    const bytes = fs.readFileSync(filePath);
    return new FinalizeFileBeforeImage({
      relativePath: path.relative(root, filePath),
      bytes: bytes.toString("base64"),
      mode: stat.mode & 0o777,
      revision: crypto.createHash("sha256").update(bytes).digest("hex"),
    });
  }

  toJSON() {
    return {
      relativePath: this.relativePath,
      bytes: this.bytes,
      mode: this.mode,
      revision: this.revision,
    };
  }
}

class FinalizeDirectoryBeforeImage {
  constructor({ relativePath, mode }) {
    assertFinalizeRelativePath(relativePath, "finalize directory before-image path");
    if (!Number.isInteger(mode)) {
      throw new Error("finalize directory before-image is invalid");
    }
    this.relativePath = relativePath;
    this.mode = mode;
    Object.freeze(this);
  }

  toJSON() {
    return { relativePath: this.relativePath, mode: this.mode };
  }
}

class FinalizeTreeBeforeImage {
  constructor({ rootRelative, rootExisted, sharedState, files, directories }) {
    assertFinalizeRelativePath(rootRelative, "finalize tree before-image root");
    if (typeof rootExisted !== "boolean" || typeof sharedState !== "boolean") {
      throw new Error("finalize tree before-image root authority is invalid");
    }
    if (!rootExisted && (files.length > 0 || directories.length > 0 || sharedState)) {
      throw new Error("absent finalize tree before-image contains entries or shared state");
    }
    this.rootRelative = rootRelative;
    this.rootExisted = rootExisted;
    this.sharedState = sharedState;
    this.files = Object.freeze(files.map((entry) => entry instanceof FinalizeFileBeforeImage
      ? entry
      : new FinalizeFileBeforeImage(entry)));
    this.directories = Object.freeze(directories.map((entry) => entry instanceof FinalizeDirectoryBeforeImage
      ? entry
      : new FinalizeDirectoryBeforeImage(entry)));
    if (
      this.files.length > FINALIZE_BEFORE_IMAGE_MAX_FILES
      || this.directories.length > FINALIZE_BEFORE_IMAGE_MAX_DIRECTORIES
    ) {
      throw new Error("finalize tree before-image exceeds the entry bound");
    }
    const ownedPrefix = `${this.rootRelative}${path.sep}`;
    const paths = [...this.files, ...this.directories].map((entry) => entry.relativePath);
    if (
      paths.some((entry) => entry !== this.rootRelative && !entry.startsWith(ownedPrefix))
      || new Set(paths).size !== paths.length
    ) {
      throw new Error("finalize tree before-image has invalid path ownership");
    }
    const byteCount = this.files.reduce((total, entry) => total + Buffer.from(entry.bytes, "base64").length, 0);
    if (byteCount > FINALIZE_BEFORE_IMAGE_MAX_BYTES) {
      throw new Error("finalize tree before-image exceeds the byte bound");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      rootRelative: this.rootRelative,
      rootExisted: this.rootExisted,
      sharedState: this.sharedState,
      files: this.files.map((entry) => entry.toJSON()),
      directories: this.directories.map((entry) => entry.toJSON()),
    };
  }
}

class FinalizeIndexLockAuthority {
  constructor({
    token,
    dev = null,
    ino = null,
    markerRevision,
    publishPhase = "marker",
    expectedIndexRevision = null,
    expectedIndexMode = null,
    publicationDev = null,
    publicationIno = null,
  }) {
    if (typeof token !== "string" || !/^[0-9a-f-]{36}$/.test(token)) {
      throw new Error("finalize caller index lock token is invalid");
    }
    if ((dev === null) !== (ino === null)) {
      throw new Error("finalize caller index lock identity is incomplete");
    }
    if (dev !== null && (![dev, ino].every(Number.isSafeInteger) || dev < 0 || ino < 0)) {
      throw new Error("finalize caller index lock identity is invalid");
    }
    if (markerRevision !== FinalizeIndexLockAuthority.revision(FinalizeIndexLockAuthority.marker(token))) {
      throw new Error("finalize caller index lock marker revision is invalid");
    }
    if (!new Set(["marker", "publishing"]).has(publishPhase)) {
      throw new Error("finalize caller index lock publish phase is invalid");
    }
    if ((publicationDev === null) !== (publicationIno === null)) {
      throw new Error("finalize caller index publication identity is incomplete");
    }
    if (
      (
        publishPhase === "marker"
        && (
          expectedIndexRevision !== null
          || expectedIndexMode !== null
          || publicationDev !== null
        )
      )
      || (
        publishPhase === "publishing"
        && (
          dev === null
          || !SHA256.test(String(expectedIndexRevision))
          || !Number.isInteger(expectedIndexMode)
          || expectedIndexMode < 0
          || expectedIndexMode > 0o777
          || ![publicationDev, publicationIno].every(Number.isSafeInteger)
          || publicationDev < 0
          || publicationIno < 0
        )
      )
    ) {
      throw new Error("finalize caller index lock publication authority is invalid");
    }
    this.token = token;
    this.dev = dev;
    this.ino = ino;
    this.markerRevision = markerRevision;
    this.publishPhase = publishPhase;
    this.expectedIndexRevision = expectedIndexRevision;
    this.expectedIndexMode = expectedIndexMode;
    this.publicationDev = publicationDev;
    this.publicationIno = publicationIno;
    Object.freeze(this);
  }

  static plan() {
    const token = crypto.randomUUID();
    return new FinalizeIndexLockAuthority({
      token,
      markerRevision: FinalizeIndexLockAuthority.revision(FinalizeIndexLockAuthority.marker(token)),
    });
  }

  static fromStored(value) {
    assertExactObjectKeys(value, [
      "token",
      "dev",
      "ino",
      "markerRevision",
      "publishPhase",
      "expectedIndexRevision",
      "expectedIndexMode",
      "publicationDev",
      "publicationIno",
    ], "finalize caller index lock authority");
    return new FinalizeIndexLockAuthority(value);
  }

  static marker(token) {
    return Buffer.from(`senti-finalize-index-lock-v1:${token}\n`);
  }

  static revision(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }

  withIdentity(stat) {
    return new FinalizeIndexLockAuthority({
      ...this.toJSON(),
      dev: stat.dev,
      ino: stat.ino,
    });
  }

  forPublication(bytes, mode, publicationStat) {
    if (this.dev === null) throw new Error("finalize caller index lock needs durable identity before publication");
    const expectedIndexRevision = FinalizeIndexLockAuthority.revision(bytes);
    const expectedIndexMode = mode & 0o777;
    if (
      publicationStat == null
      || ![publicationStat.dev, publicationStat.ino].every(Number.isSafeInteger)
      || publicationStat.nlink !== 1
    ) {
      throw new Error("finalize caller index publication file identity is invalid");
    }
    if (
      this.publishPhase === "publishing"
      && (
        this.expectedIndexRevision !== expectedIndexRevision
        || this.expectedIndexMode !== expectedIndexMode
        || this.publicationDev !== publicationStat.dev
        || this.publicationIno !== publicationStat.ino
      )
    ) {
      throw new Error("finalize caller index publication changed after becoming durable");
    }
    return new FinalizeIndexLockAuthority({
      ...this.toJSON(),
      publishPhase: "publishing",
      expectedIndexRevision,
      expectedIndexMode,
      publicationDev: publicationStat.dev,
      publicationIno: publicationStat.ino,
    });
  }

  contentState(bytes) {
    if (bytes.equals(FinalizeIndexLockAuthority.marker(this.token))) return "marker";
    if (
      this.publishPhase === "publishing"
      && FinalizeIndexLockAuthority.revision(bytes) === this.expectedIndexRevision
    ) {
      return "expected-index";
    }
    return "foreign";
  }

  matches(stat) {
    return this.dev !== null && stat.dev === this.dev && stat.ino === this.ino;
  }

  matchesPublication(stat) {
    return (
      this.publicationDev !== null
      && stat.dev === this.publicationDev
      && stat.ino === this.publicationIno
    );
  }

  toJSON() {
    return {
      token: this.token,
      dev: this.dev,
      ino: this.ino,
      markerRevision: this.markerRevision,
      publishPhase: this.publishPhase,
      expectedIndexRevision: this.expectedIndexRevision,
      expectedIndexMode: this.expectedIndexMode,
      publicationDev: this.publicationDev,
      publicationIno: this.publicationIno,
    };
  }
}

class FinalizeTempIndexAuthority {
  constructor({ workspacePath, token, dev = null, ino = null }) {
    if (
      typeof workspacePath !== "string"
      || !path.isAbsolute(workspacePath)
      || typeof token !== "string"
      || !/^[0-9a-f-]{36}$/.test(token)
    ) {
      throw new Error("finalize temporary index workspace authority is invalid");
    }
    const workspaceParent = path.dirname(workspacePath);
    const recoveryDirectory = path.dirname(workspaceParent);
    const sentiDirectory = path.dirname(recoveryDirectory);
    const gitDirectory = path.dirname(sentiDirectory);
    if (
      path.basename(workspacePath) !== `senti-finalize-index-${token}`
      || path.basename(workspaceParent) !== "finalize-index-workspaces"
      || path.basename(recoveryDirectory) !== "recovery"
      || path.basename(sentiDirectory) !== "senti"
      || path.basename(gitDirectory) !== ".git"
    ) {
      throw new Error("finalize temporary index workspace path is invalid");
    }
    if ((dev === null) !== (ino === null)) {
      throw new Error("finalize temporary index workspace identity is incomplete");
    }
    if (dev !== null && (![dev, ino].every(Number.isSafeInteger) || dev < 0 || ino < 0)) {
      throw new Error("finalize temporary index workspace identity is invalid");
    }
    this.workspacePath = workspacePath;
    this.token = token;
    this.dev = dev;
    this.ino = ino;
    Object.freeze(this);
  }

  static plan(targetRoot) {
    const token = crypto.randomUUID();
    const gitDirectory = fs.realpathSync(path.join(targetRoot, ".git"));
    return new FinalizeTempIndexAuthority({
      workspacePath: path.join(
        gitDirectory,
        "senti",
        "recovery",
        "finalize-index-workspaces",
        `senti-finalize-index-${token}`,
      ),
      token,
    });
  }

  static fromStored(value) {
    assertExactObjectKeys(value, ["workspacePath", "token", "dev", "ino"], "finalize temporary index authority");
    return new FinalizeTempIndexAuthority(value);
  }

  withIdentity(stat) {
    return new FinalizeTempIndexAuthority({
      workspacePath: this.workspacePath,
      token: this.token,
      dev: stat.dev,
      ino: stat.ino,
    });
  }

  matches(stat) {
    return this.dev !== null && stat.dev === this.dev && stat.ino === this.ino;
  }

  toJSON() {
    return {
      workspacePath: this.workspacePath,
      token: this.token,
      dev: this.dev,
      ino: this.ino,
    };
  }
}

class FinalizeTeardownTransaction {
  constructor({
    transactionId,
    identity,
    commitRequired = true,
    authorization,
    phase = "prepared",
    result = null,
    commitExpectation = null,
    indexLockAuthority = null,
    tempIndexAuthority = null,
    beforeImages = [],
    issueLogIds = [],
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
    this.indexLockAuthority = indexLockAuthority == null
      ? null
      : indexLockAuthority instanceof FinalizeIndexLockAuthority
        ? indexLockAuthority
        : FinalizeIndexLockAuthority.fromStored(indexLockAuthority);
    this.tempIndexAuthority = tempIndexAuthority == null
      ? null
      : tempIndexAuthority instanceof FinalizeTempIndexAuthority
        ? tempIndexAuthority
        : FinalizeTempIndexAuthority.fromStored(tempIndexAuthority);
    if (!Array.isArray(beforeImages) || beforeImages.length > 2) {
      throw new Error("finalize teardown before-images are invalid");
    }
    this.beforeImages = beforeImages.map((entry) => entry instanceof FinalizeTreeBeforeImage
      ? entry
      : new FinalizeTreeBeforeImage(entry));
    if (!Array.isArray(issueLogIds) || issueLogIds.some((entry) => typeof entry !== "string" || entry === "")) {
      throw new Error("finalize teardown issue-log IDs are invalid");
    }
    this.issueLogIds = [...new Set(issueLogIds)];
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
      if (
        !this.phase.atLeast("index-reconciled")
        && (this.indexLockAuthority == null || this.tempIndexAuthority == null)
      ) {
        throw new Error("commit-durable finalize teardown requires index recovery authority");
      }
      if (
        this.phase.atLeast("index-reconciled")
        && (this.indexLockAuthority != null || this.tempIndexAuthority != null)
      ) {
        throw new Error("index-reconciled finalize teardown retains stale index authority");
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
      "indexLockAuthority",
      "tempIndexAuthority",
      "beforeImages",
      "issueLogIds",
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
    const phase = commitRequired ? "prepared" : "validated";
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

  planIndexLock() {
    if (this.phase.atLeast("index-reconciled")) throw new Error("finalize caller index lock is already reconciled");
    this.indexLockAuthority = FinalizeIndexLockAuthority.plan();
    this.updatedAt = new Date().toISOString();
    return this.indexLockAuthority;
  }

  ownIndexLock(authority) {
    if (this.phase.atLeast("index-reconciled")) throw new Error("finalize caller index lock is already reconciled");
    const candidate = authority instanceof FinalizeIndexLockAuthority
      ? authority
      : FinalizeIndexLockAuthority.fromStored(authority);
    if (this.indexLockAuthority != null && candidate.token !== this.indexLockAuthority.token) {
      throw new Error("finalize caller index lock intent changed");
    }
    this.indexLockAuthority = candidate;
    this.updatedAt = new Date().toISOString();
  }

  authorizeIndexPublication(bytes, mode, publicationStat) {
    if (this.phase.atLeast("index-reconciled") || this.indexLockAuthority == null) {
      throw new Error("finalize caller index lock is unavailable for publication");
    }
    this.indexLockAuthority = this.indexLockAuthority.forPublication(bytes, mode, publicationStat);
    this.updatedAt = new Date().toISOString();
    return this.indexLockAuthority;
  }

  clearIndexLock() {
    this.indexLockAuthority = null;
    this.updatedAt = new Date().toISOString();
  }

  planTempIndexWorkspace(targetRoot) {
    if (this.phase.atLeast("index-reconciled")) throw new Error("finalize temporary index workspace is already reconciled");
    this.tempIndexAuthority = FinalizeTempIndexAuthority.plan(targetRoot);
    this.updatedAt = new Date().toISOString();
    return this.tempIndexAuthority;
  }

  ownTempIndexWorkspace(authority) {
    if (this.phase.atLeast("index-reconciled")) throw new Error("finalize temporary index workspace is already reconciled");
    const candidate = authority instanceof FinalizeTempIndexAuthority
      ? authority
      : FinalizeTempIndexAuthority.fromStored(authority);
    if (
      this.tempIndexAuthority != null
      && (
        candidate.token !== this.tempIndexAuthority.token
        || candidate.workspacePath !== this.tempIndexAuthority.workspacePath
      )
    ) {
      throw new Error("finalize temporary index workspace intent changed");
    }
    this.tempIndexAuthority = candidate;
    this.updatedAt = new Date().toISOString();
  }

  clearTempIndexWorkspace() {
    this.tempIndexAuthority = null;
    this.updatedAt = new Date().toISOString();
  }

  setBeforeImages(beforeImages) {
    if (this.phase.name !== "prepared" || this.beforeImages.length > 0) {
      throw new Error("finalize before-images can only be attached once while prepared");
    }
    this.beforeImages = beforeImages.map((entry) => entry instanceof FinalizeTreeBeforeImage
      ? entry
      : new FinalizeTreeBeforeImage(entry));
    this.updatedAt = new Date().toISOString();
    return this;
  }

  ownIssueLogIds(issueLogIds) {
    if (this.phase.name !== "prepared") throw new Error("finalize issue-log IDs require prepared phase");
    this.issueLogIds = [...new Set(issueLogIds)];
    this.updatedAt = new Date().toISOString();
    return this;
  }

  resetPrepared() {
    this.phase = FinalizeTeardownPhase.from("prepared");
    this.result = null;
    this.commitExpectation = null;
    this.indexLockAuthority = null;
    this.tempIndexAuthority = null;
    this.beforeImages = [];
    this.issueLogIds = [];
    this.updatedAt = new Date().toISOString();
    return this;
  }

  clearBeforeImages() {
    this.beforeImages = [];
    this.issueLogIds = [];
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
      indexLockAuthority: this.indexLockAuthority?.toJSON() ?? null,
      tempIndexAuthority: this.tempIndexAuthority?.toJSON() ?? null,
      beforeImages: this.beforeImages.map((entry) => entry.toJSON()),
      issueLogIds: [...this.issueLogIds],
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

const FINALIZE_TEMP_INDEX_BASE_NAMES = new Set(["expected.index", "commit.index", "reconcile.index"]);
const FINALIZE_TEMP_INDEX_NAMES = new Set([
  ...FINALIZE_TEMP_INDEX_BASE_NAMES,
  ...[...FINALIZE_TEMP_INDEX_BASE_NAMES].map((name) => `${name}.lock`),
  "publication.index",
]);
const FINALIZE_TEMP_OWNER_FILE = ".owner";

function fsyncDirectory(directoryPath) {
  const descriptor = fs.openSync(directoryPath, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function assertRealFinalizeFile(filePath, label) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs.realpathSync(filePath) !== filePath) {
    throw new Error(`${label} must be one real file`);
  }
  return stat;
}

function finalizeTempIndexWorkspaceParent(targetRoot) {
  return path.join(
    fs.realpathSync(path.join(targetRoot, ".git")),
    "senti",
    "recovery",
    "finalize-index-workspaces",
  );
}

function ensureFinalizeTempIndexWorkspaceParent(targetRoot) {
  const gitDirectory = new RealDirectoryAuthority(fs.realpathSync(path.join(targetRoot, ".git")));
  gitDirectory.ensure();
  const sentiDirectory = new RealDirectoryAuthority(path.join(gitDirectory.directory, "senti"), {
    create: true,
    parentAuthority: gitDirectory,
  });
  sentiDirectory.ensure();
  const recoveryDirectory = new RealDirectoryAuthority(path.join(sentiDirectory.directory, "recovery"), {
    create: true,
    parentAuthority: sentiDirectory,
  });
  recoveryDirectory.ensure();
  const workspaceParent = new RealDirectoryAuthority(
    path.join(recoveryDirectory.directory, "finalize-index-workspaces"),
    { create: true, parentAuthority: recoveryDirectory },
  );
  workspaceParent.ensure();
  return workspaceParent;
}

function readFinalizeDescriptorBytes(descriptor) {
  const stat = fs.fstatSync(descriptor);
  const bytes = Buffer.alloc(stat.size);
  let offset = 0;
  while (offset < bytes.length) {
    const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
    if (!Number.isSafeInteger(count) || count <= 0) {
      throw new Error("finalize descriptor read ended before the journaled size");
    }
    offset += count;
  }
  return { stat, bytes };
}

function writeFinalizeDescriptorBytes(descriptor, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const count = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
    if (!Number.isSafeInteger(count) || count <= 0) {
      throw new Error("finalize descriptor write made no progress");
    }
    offset += count;
  }
}

function finalizeIndexAcquireCleanupError(primary, {
  descriptor,
  createdIdentity,
  lockPath,
  authority,
}) {
  const cleanupErrors = [];
  let descriptorClosed = true;
  try {
    fs.closeSync(descriptor);
  } catch (error) {
    descriptorClosed = false;
    cleanupErrors.push(error);
  }
  let status = descriptorClosed ? "foreign" : "descriptor-close-failed";
  let residue = true;
  let unlinked = false;
  try {
    if (!descriptorClosed) throw Object.assign(new Error("created caller index lock descriptor close failed"), {
      code: "FINALIZE_INDEX_CLEANUP_SKIPPED",
    });
    const before = assertRealFinalizeFile(lockPath, "created caller index lock cleanup");
    const bytes = fs.readFileSync(lockPath);
    const after = assertRealFinalizeFile(lockPath, "created caller index lock cleanup");
    const owned = (
      before.dev === createdIdentity.dev
      && before.ino === createdIdentity.ino
      && after.dev === createdIdentity.dev
      && after.ino === createdIdentity.ino
      && before.nlink === 1
      && after.nlink === 1
      && authority.contentState(bytes) === "marker"
    );
    if (owned) {
      fs.unlinkSync(lockPath);
      unlinked = true;
      status = "removed-owned";
      residue = false;
      fsyncDirectory(path.dirname(lockPath));
    }
  } catch (error) {
    if (unlinked) {
      status = "removed-owned-durability-uncertain";
      cleanupErrors.push(error);
    } else if (error.code === "ENOENT") {
      status = "missing";
      residue = false;
    } else if (error.code === "FINALIZE_INDEX_CLEANUP_SKIPPED") {
      // The close failure is already retained; do not inspect or mutate the pathname.
    } else {
      status = "inspection-failed";
      cleanupErrors.push(error);
    }
  }
  const cleanupResidue = Object.freeze({ lockPath, status, residue });
  if (cleanupErrors.length === 0) {
    primary.cleanupResidue = cleanupResidue;
    return primary;
  }
  const combined = new AggregateError(
    [primary, ...cleanupErrors],
    "caller index lock acquisition and authority cleanup both failed",
    { cause: primary },
  );
  combined.code = primary.code || "FINALIZE_INDEX_RECONCILIATION_FAILED";
  combined.lockPath = lockPath;
  combined.cleanupResidue = cleanupResidue;
  return combined;
}

class FinalizeTempIndexWorkspace {
  constructor(authority, targetRoot) {
    this.authority = authority;
    this.targetRoot = targetRoot;
    this.indexPath = path.join(targetRoot, ".git", "index");
  }

  static acquire(authority, targetRoot) {
    const marker = `${authority.token}\n`;
    if (path.dirname(authority.workspacePath) !== finalizeTempIndexWorkspaceParent(targetRoot)) {
      throw Object.assign(new Error("finalize temporary index workspace targets a different Git authority"), {
        code: "FINALIZE_TEMP_INDEX_AUTHORITY_FAILED",
      });
    }
    const workspaceParent = ensureFinalizeTempIndexWorkspaceParent(targetRoot);
    workspaceParent.assertStable();
    let created = false;
    try {
      fs.mkdirSync(authority.workspacePath, { mode: 0o700 });
      created = true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const stat = fs.lstatSync(authority.workspacePath);
    if (
      !stat.isDirectory()
      || stat.isSymbolicLink()
      || fs.realpathSync(authority.workspacePath) !== authority.workspacePath
      || (stat.mode & 0o077) !== 0
      || (typeof process.getuid === "function" && stat.uid !== process.getuid())
      || (authority.dev !== null && !authority.matches(stat))
    ) {
      throw Object.assign(new Error("finalize temporary index workspace authority diverged"), {
        code: "FINALIZE_TEMP_INDEX_AUTHORITY_FAILED",
      });
    }
    const markerPath = path.join(authority.workspacePath, FINALIZE_TEMP_OWNER_FILE);
    if (fs.existsSync(markerPath)) {
      assertRealFinalizeFile(markerPath, "finalize temporary index owner marker");
      if (fs.readFileSync(markerPath, "utf8") !== marker) {
        throw Object.assign(new Error("finalize temporary index owner marker diverged"), {
          code: "FINALIZE_TEMP_INDEX_AUTHORITY_FAILED",
        });
      }
    } else {
      if (!created) {
        throw Object.assign(new Error("finalize temporary index workspace is not owned"), {
          code: "FINALIZE_TEMP_INDEX_BUSY",
        });
      }
      const descriptor = fs.openSync(markerPath, "wx", 0o600);
      try {
        fs.writeFileSync(descriptor, marker);
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      fsyncDirectory(authority.workspacePath);
    }
    const indexStat = assertRealFinalizeFile(path.join(targetRoot, ".git", "index"), "caller index authority");
    if (indexStat.dev !== stat.dev) {
      throw Object.assign(new Error("finalize temporary index workspace is on a different filesystem"), {
        code: "FINALIZE_TEMP_INDEX_AUTHORITY_FAILED",
      });
    }
    return new FinalizeTempIndexWorkspace(authority.withIdentity(stat), targetRoot);
  }

  assertAuthority() {
    const stat = fs.lstatSync(this.authority.workspacePath);
    if (
      !stat.isDirectory()
      || stat.isSymbolicLink()
      || fs.realpathSync(this.authority.workspacePath) !== this.authority.workspacePath
      || !this.authority.matches(stat)
    ) {
      throw Object.assign(new Error("finalize temporary index workspace identity changed"), {
        code: "FINALIZE_TEMP_INDEX_AUTHORITY_FAILED",
      });
    }
  }

  prepare(name) {
    if (!FINALIZE_TEMP_INDEX_BASE_NAMES.has(name)) throw new Error("invalid finalize temporary index name");
    this.assertAuthority();
    const filePath = path.join(this.authority.workspacePath, name);
    fs.copyFileSync(this.indexPath, filePath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(filePath, 0o600);
    assertRealFinalizeFile(filePath, "finalize temporary index");
    return filePath;
  }

  remove(name) {
    if (!FINALIZE_TEMP_INDEX_NAMES.has(name)) throw new Error("invalid finalize temporary index name");
    this.assertAuthority();
    const filePath = path.join(this.authority.workspacePath, name);
    try {
      assertRealFinalizeFile(filePath, "finalize temporary index");
      fs.unlinkSync(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  preparePublication(bytes, mode, authority) {
    if (!Buffer.isBuffer(bytes) || !Number.isInteger(mode)) {
      throw new Error("finalize index publication source is invalid");
    }
    this.assertAuthority();
    const filePath = path.join(this.authority.workspacePath, "publication.index");
    if (authority.publishPhase === "marker") {
      let descriptor;
      try {
        descriptor = fs.openSync(
          filePath,
          fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
          0o600,
        );
      } catch (cause) {
        throw Object.assign(new Error("finalize index publication source is busy", { cause }), {
          code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
        });
      }
      try {
        writeFinalizeDescriptorBytes(descriptor, bytes);
        fs.fchmodSync(descriptor, mode & 0o777);
        fs.fsyncSync(descriptor);
        const verified = readFinalizeDescriptorBytes(descriptor);
        if (
          verified.stat.nlink !== 1
          || verified.stat.size !== bytes.length
          || (verified.stat.mode & 0o777) !== (mode & 0o777)
          || FinalizeIndexLockAuthority.revision(verified.bytes)
            !== FinalizeIndexLockAuthority.revision(bytes)
        ) {
          throw new Error("finalize index publication source verification failed");
        }
      } finally {
        fs.closeSync(descriptor);
      }
      fsyncDirectory(this.authority.workspacePath);
      return new FinalizeIndexPublicationSource({
        workspace: this,
        filePath,
        indexPath: this.indexPath,
        stat: assertRealFinalizeFile(filePath, "finalize index publication source"),
      });
    }
    try {
      const stat = assertRealFinalizeFile(filePath, "finalize index publication source");
      return new FinalizeIndexPublicationSource({
        workspace: this,
        filePath,
        indexPath: this.indexPath,
        stat,
      }).assertAuthority(authority, bytes, mode);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const indexStat = assertRealFinalizeFile(this.indexPath, "published caller index");
    return new FinalizeIndexPublicationSource({
      workspace: this,
      filePath,
      indexPath: this.indexPath,
      stat: indexStat,
      published: true,
    }).assertAuthority(authority, bytes, mode);
  }

  cleanup() {
    this.assertAuthority();
    const allowed = new Set([...FINALIZE_TEMP_INDEX_NAMES, FINALIZE_TEMP_OWNER_FILE]);
    const entries = fs.readdirSync(this.authority.workspacePath);
    if (entries.some((entry) => !allowed.has(entry))) {
      throw Object.assign(new Error("finalize temporary index workspace contains foreign entries"), {
        code: "FINALIZE_TEMP_INDEX_AUTHORITY_FAILED",
      });
    }
    for (const entry of entries.filter((candidate) => candidate !== FINALIZE_TEMP_OWNER_FILE)) {
      this.remove(entry);
    }
    const markerPath = path.join(this.authority.workspacePath, FINALIZE_TEMP_OWNER_FILE);
    assertRealFinalizeFile(markerPath, "finalize temporary index owner marker");
    if (fs.readFileSync(markerPath, "utf8") !== `${this.authority.token}\n`) {
      throw Object.assign(new Error("finalize temporary index owner marker diverged"), {
        code: "FINALIZE_TEMP_INDEX_AUTHORITY_FAILED",
      });
    }
    fs.unlinkSync(markerPath);
    fs.rmdirSync(this.authority.workspacePath);
    fsyncDirectory(path.dirname(this.authority.workspacePath));
  }
}

class FinalizeIndexPublicationSource {
  constructor({ workspace, filePath, indexPath, stat, published = false }) {
    this.workspace = workspace;
    this.filePath = filePath;
    this.indexPath = indexPath;
    this.stat = stat;
    this.published = published;
  }

  assertAuthority(authority, bytes, mode) {
    this.workspace.assertAuthority();
    const sourcePath = this.published ? this.indexPath : this.filePath;
    const before = assertRealFinalizeFile(sourcePath, "finalize index publication source");
    const sourceBytes = fs.readFileSync(sourcePath);
    const stat = assertRealFinalizeFile(sourcePath, "finalize index publication source");
    if (
      !authority.matchesPublication(stat)
      || before.dev !== stat.dev
      || before.ino !== stat.ino
      || stat.nlink !== 1
      || stat.size !== bytes.length
      || (stat.mode & 0o777) !== (mode & 0o777)
      || FinalizeIndexLockAuthority.revision(sourceBytes) !== authority.expectedIndexRevision
    ) {
      throw Object.assign(new Error("finalize index publication source authority diverged"), {
        code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
      });
    }
    this.stat = stat;
    return this;
  }

  publish(authority, bytes, mode) {
    this.assertAuthority(authority, bytes, mode);
    if (!this.published) {
      fs.renameSync(this.filePath, this.indexPath);
      fsyncDirectory(path.dirname(this.indexPath));
      this.published = true;
    }
    this.assertAuthority(authority, bytes, mode);
  }
}

class FinalizeCallerIndexLease {
  constructor({ authority, targetRoot, descriptor }) {
    this.authority = authority;
    this.gitDirectory = path.join(targetRoot, ".git");
    this.indexPath = path.join(this.gitDirectory, "index");
    this.lockPath = `${this.indexPath}.lock`;
    this.descriptor = descriptor;
  }

  static acquire(authority, targetRoot) {
    const gitDirectory = path.join(targetRoot, ".git");
    const indexPath = path.join(gitDirectory, "index");
    const lockPath = `${indexPath}.lock`;
    assertRealFinalizeFile(indexPath, "caller index authority");
    const marker = FinalizeIndexLockAuthority.marker(authority.token);
    let descriptor;
    let created = false;
    let createdIdentity = null;
    try {
      descriptor = fs.openSync(lockPath, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      created = true;
      createdIdentity = fs.fstatSync(descriptor);
    } catch (cause) {
      if (cause.code !== "EEXIST") {
        throw Object.assign(new Error("caller index lock acquisition failed", { cause }), {
          code: "FINALIZE_INDEX_RECONCILIATION_FAILED",
          lockPath,
        });
      }
      if (authority.dev === null) {
        throw Object.assign(new Error("caller index lock is busy"), {
          code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
          lockPath,
        });
      }
      try {
        assertRealFinalizeFile(lockPath, "caller index lock");
        descriptor = fs.openSync(lockPath, fs.constants.O_RDWR | fs.constants.O_NOFOLLOW);
      } catch (error) {
        if (error.code?.startsWith("FINALIZE_")) throw error;
        throw Object.assign(new Error("caller index lock is busy", { cause: error }), {
          code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
          lockPath,
        });
      }
    }
    try {
      if (created) {
        fs.writeFileSync(descriptor, marker);
        fs.fsyncSync(descriptor);
        fsyncDirectory(gitDirectory);
      }
      const { stat: descriptorStat, bytes: currentBytes } = readFinalizeDescriptorBytes(descriptor);
      const pathStat = assertRealFinalizeFile(lockPath, "caller index lock");
      if (
        descriptorStat.dev !== pathStat.dev
        || descriptorStat.ino !== pathStat.ino
        || (authority.dev !== null && !authority.matches(descriptorStat))
        || authority.contentState(currentBytes) === "foreign"
      ) {
        throw Object.assign(new Error("caller index lock is busy"), {
          code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
          lockPath,
        });
      }
      return new FinalizeCallerIndexLease({
        authority: authority.withIdentity(descriptorStat),
        targetRoot,
        descriptor,
      });
    } catch (error) {
      if (created) {
        throw finalizeIndexAcquireCleanupError(error, {
          descriptor,
          createdIdentity,
          lockPath,
          authority,
        });
      }
      try {
        fs.closeSync(descriptor);
      } catch (cleanupError) {
        const combined = new AggregateError(
          [error, cleanupError],
          "caller index lock acquisition and descriptor cleanup both failed",
          { cause: error },
        );
        combined.code = error.code || "FINALIZE_INDEX_RECONCILIATION_FAILED";
        combined.lockPath = lockPath;
        throw combined;
      }
      throw error;
    }
  }

  assertAuthority() {
    const descriptorStat = fs.fstatSync(this.descriptor);
    const pathStat = assertRealFinalizeFile(this.lockPath, "caller index lock");
    if (
      descriptorStat.dev !== pathStat.dev
      || descriptorStat.ino !== pathStat.ino
      || !this.authority.matches(pathStat)
    ) {
      throw Object.assign(new Error("caller index lock authority changed"), {
        code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
        lockPath: this.lockPath,
      });
    }
  }

  authorizePublication(authority) {
    if (!(authority instanceof FinalizeIndexLockAuthority) || !this.authority.matches(authority)) {
      throw new Error("finalize caller index publication authority changed identity");
    }
    this.authority = authority;
  }

  publish(bytes, mode, publicationSource) {
    this.assertAuthority();
    if (!(publicationSource instanceof FinalizeIndexPublicationSource)) {
      throw new Error("finalize index publication source is unavailable");
    }
    if (
      this.authority.publishPhase !== "publishing"
      || FinalizeIndexLockAuthority.revision(bytes) !== this.authority.expectedIndexRevision
      || (mode & 0o777) !== this.authority.expectedIndexMode
    ) {
      throw new Error("finalize caller index publication lacks durable content authority");
    }
    const { stat, bytes: currentBytes } = readFinalizeDescriptorBytes(this.descriptor);
    const contentState = this.authority.contentState(currentBytes);
    if (contentState === "foreign") {
      throw Object.assign(new Error("caller index lock content is busy"), {
        code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
        lockPath: this.lockPath,
      });
    }
    if (contentState === "marker") {
      fs.ftruncateSync(this.descriptor, 0);
      writeFinalizeDescriptorBytes(this.descriptor, bytes);
      fs.fchmodSync(this.descriptor, this.authority.expectedIndexMode);
      fs.fsyncSync(this.descriptor);
    } else if ((stat.mode & 0o777) !== this.authority.expectedIndexMode) {
      throw Object.assign(new Error("caller index lock mode is busy"), {
        code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
        lockPath: this.lockPath,
      });
    }
    const verified = readFinalizeDescriptorBytes(this.descriptor);
    if (
      verified.stat.dev !== this.authority.dev
      || verified.stat.ino !== this.authority.ino
      || verified.stat.size !== bytes.length
      || (verified.stat.mode & 0o777) !== this.authority.expectedIndexMode
      || this.authority.contentState(verified.bytes) !== "expected-index"
    ) {
      throw Object.assign(new Error("caller index lock publication verification failed"), {
        code: "FINALIZE_INDEX_RECONCILIATION_FAILED",
        lockPath: this.lockPath,
      });
    }
    this.assertAuthority();
    publicationSource.publish(this.authority, bytes, mode);
    this.assertAuthority();
    fs.closeSync(this.descriptor);
    this.descriptor = null;
    const lockBefore = assertRealFinalizeFile(this.lockPath, "published caller index lock cleanup");
    const lockBytes = fs.readFileSync(this.lockPath);
    const lockStat = assertRealFinalizeFile(this.lockPath, "published caller index lock cleanup");
    if (
      !this.authority.matches(lockStat)
      || lockBefore.dev !== lockStat.dev
      || lockBefore.ino !== lockStat.ino
      || this.authority.contentState(lockBytes) !== "expected-index"
    ) {
      throw Object.assign(new Error("published caller index lock cleanup authority diverged"), {
        code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
        lockPath: this.lockPath,
      });
    }
    fs.unlinkSync(this.lockPath);
    fsyncDirectory(this.gitDirectory);
  }

  release() {
    this.assertAuthority();
    fs.closeSync(this.descriptor);
    this.descriptor = null;
    fs.unlinkSync(this.lockPath);
    fsyncDirectory(this.gitDirectory);
  }

  detach() {
    if (this.descriptor == null) return;
    fs.closeSync(this.descriptor);
    this.descriptor = null;
  }
}

function buildExpectedPathspecTree(targetRoot, expectedParent, commitPaths, workspace) {
  const tempIndex = workspace.prepare("expected.index");
  const env = { ...process.env, GIT_INDEX_FILE: tempIndex };
  let primaryError = null;
  let tree = null;
  try {
    const read = runGit(["-C", targetRoot, "read-tree", expectedParent], { env });
    if (!read.ok) throw gitFailure("FINALIZE_TREE_BUILD_FAILED", "temporary index read-tree failed", read);
    fs.chmodSync(tempIndex, 0o600);
    const add = runGit(["-C", targetRoot, "add", "--", ...commitPaths], { env });
    if (!add.ok) throw gitFailure("FINALIZE_TREE_BUILD_FAILED", "temporary index git add failed", add);
    tree = gitValueWithOptions(targetRoot, ["write-tree"], "finalize staged tree", { env });
  } catch (error) {
    primaryError = error;
  }
  let cleanupError = null;
  try {
    workspace.remove("expected.index");
  } catch (error) {
    cleanupError = error;
  }
  try {
    workspace.remove("expected.index.lock");
  } catch (error) {
    if (cleanupError == null) cleanupError = error;
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

function runIsolatedFinalizeCommit({ targetRoot, expectedParent, commitMessage, commitPaths, workspace }) {
  const tempIndex = workspace.prepare("commit.index");
  const env = { ...process.env, GIT_INDEX_FILE: tempIndex };
  let result = null;
  let primaryError = null;
  try {
    const readTree = runGit(["-C", targetRoot, "read-tree", expectedParent], { env });
    if (!readTree.ok) {
      result = { stage: "read-tree", result: readTree };
    } else {
      fs.chmodSync(tempIndex, 0o600);
      const add = runGit(["-C", targetRoot, "add", "--", ...commitPaths], { env });
      if (!add.ok) {
        result = { stage: "add", result: add };
      } else {
        const writeTree = runGit(["-C", targetRoot, "write-tree"], { env });
        if (!writeTree.ok) {
          result = { stage: "write-tree", result: writeTree };
        } else {
          const commit = runGit([
            "-C", targetRoot, "commit", "-m", commitMessage, "--only", "--", ...commitPaths,
          ], { env });
          result = { stage: "commit", result: commit };
        }
      }
    }
  } catch (error) {
    primaryError = error;
  }
  const cleanupErrors = [];
  try {
    workspace.remove("commit.index");
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    workspace.remove("commit.index.lock");
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (primaryError && cleanupErrors.length > 0) {
    throw new AggregateError(
      [primaryError, ...cleanupErrors],
      "isolated finalize index operation and cleanup both failed",
      { cause: primaryError },
    );
  }
  if (primaryError) throw primaryError;
  return { ...result, cleanupErrors };
}

function isolatedIndexFailure(primaryError, isolatedCommit) {
  if (isolatedCommit.cleanupErrors.length === 0) return primaryError;
  return new AggregateError(
    [primaryError, ...isolatedCommit.cleanupErrors],
    "isolated finalize index operation and cleanup both failed",
    { cause: primaryError },
  );
}

function throwIsolatedIndexCleanup(isolatedCommit) {
  if (isolatedCommit.cleanupErrors.length === 0) return;
  throw new AggregateError(
    isolatedCommit.cleanupErrors,
    "isolated finalize index cleanup failed",
    { cause: isolatedCommit.cleanupErrors[0] },
  );
}

class FinalizeIndexEntry {
  constructor({ mode, objectId, relativePath }) {
    if (!/^\d{6}$/.test(String(mode)) || !GIT_OBJECT_ID.test(String(objectId))) {
      throw new Error("finalize index entry authority is invalid");
    }
    assertFinalizeRelativePath(relativePath, "finalize index entry path");
    this.mode = String(mode);
    this.objectId = objectId;
    this.relativePath = relativePath;
    Object.freeze(this);
  }

  equals(other) {
    return other instanceof FinalizeIndexEntry
      && this.mode === other.mode
      && this.objectId === other.objectId
      && this.relativePath === other.relativePath;
  }
}

class FinalizeIndexSnapshot {
  constructor(entries) {
    this.entries = new Map();
    for (const entry of entries) {
      if (this.entries.has(entry.relativePath)) {
        throw new Error(`finalize index contains non-stage-zero authority: ${entry.relativePath}`);
      }
      this.entries.set(entry.relativePath, entry);
    }
  }

  entry(relativePath) {
    return this.entries.get(relativePath) ?? null;
  }

  matches(relativePath, other) {
    const left = this.entry(relativePath);
    const right = other.entry(relativePath);
    return left == null ? right == null : left.equals(right);
  }
}

function parseFinalizeIndexSnapshot(output, { tree = false } = {}) {
  const entries = [];
  for (const line of output.split("\n").filter(Boolean)) {
    const match = tree
      ? /^(\d{6}) blob ([a-f0-9]{40})\t(.+)$/.exec(line)
      : /^(\d{6}) ([a-f0-9]{40}) 0\t(.+)$/.exec(line);
    if (!match) throw new Error(`finalize index authority output is invalid: ${line}`);
    entries.push(new FinalizeIndexEntry({
      mode: match[1],
      objectId: match[2],
      relativePath: match[3],
    }));
  }
  return new FinalizeIndexSnapshot(entries);
}

function readFinalizeIndex(targetRoot, commitPaths, env = undefined) {
  const result = runGit(["-C", targetRoot, "ls-files", "--stage", "--", ...commitPaths], { env });
  if (!result.ok) throw gitFailure("FINALIZE_INDEX_RECONCILIATION_FAILED", "caller index probe failed", result);
  return parseFinalizeIndexSnapshot(result.stdout);
}

function readFinalizeTree(targetRoot, treeish, commitPaths) {
  const result = runGit(["-C", targetRoot, "ls-tree", treeish, "--", ...commitPaths]);
  if (!result.ok) throw gitFailure("FINALIZE_INDEX_RECONCILIATION_FAILED", "caller index tree probe failed", result);
  return parseFinalizeIndexSnapshot(result.stdout, { tree: true });
}

class FinalizeIndexPublication {
  constructor(bytes, mode) {
    if (!Buffer.isBuffer(bytes) || !Number.isInteger(mode)) {
      throw new Error("finalize index publication is invalid");
    }
    this.bytes = Buffer.from(bytes);
    this.mode = mode & 0o777;
    Object.freeze(this);
  }

  publish(lease, source) {
    lease.publish(this.bytes, this.mode, source);
  }
}

function prepareFinalizeCallerIndexReconciliation(expectation, workspace) {
  const { targetRoot, expectedParent, commitPaths } = expectation;
  const indexPath = path.join(targetRoot, ".git", "index");
  let indexStat;
  try {
    indexStat = fs.lstatSync(indexPath);
  } catch (cause) {
    throw Object.assign(new Error("caller index authority is unavailable", { cause }), {
      code: "FINALIZE_INDEX_RECONCILIATION_FAILED",
    });
  }
  if (!indexStat.isFile() || indexStat.isSymbolicLink() || fs.realpathSync(indexPath) !== indexPath) {
    throw Object.assign(new Error("caller index authority must be one real file"), {
      code: "FINALIZE_INDEX_RECONCILIATION_FAILED",
    });
  }
  let tempPrepared = false;
  let primaryError = null;
  let publication = null;
  try {
    const current = readFinalizeIndex(targetRoot, commitPaths);
    const parent = readFinalizeTree(targetRoot, expectedParent, commitPaths);
    const committed = readFinalizeTree(targetRoot, "HEAD", commitPaths);
    const updatePaths = commitPaths.filter((relativePath) => (
      current.matches(relativePath, parent)
      && !current.matches(relativePath, committed)
    ));
    if (updatePaths.length > 0) {
      const tempIndex = workspace.prepare("reconcile.index");
      tempPrepared = true;
      const env = { ...process.env, GIT_INDEX_FILE: tempIndex };
      const reset = runGit(["-C", targetRoot, "reset", "--quiet", "HEAD", "--", ...updatePaths], { env });
      if (!reset.ok) {
        throw gitFailure("FINALIZE_INDEX_RECONCILIATION_FAILED", "caller index reconciliation failed", reset);
      }
      fs.chmodSync(tempIndex, 0o600);
      const reconciled = readFinalizeIndex(targetRoot, commitPaths, env);
      for (const relativePath of updatePaths) {
        if (!reconciled.matches(relativePath, committed)) {
          throw Object.assign(new Error(`caller index reconciliation diverged: ${relativePath}`), {
            code: "FINALIZE_INDEX_RECONCILIATION_FAILED",
          });
        }
      }
      const bytes = fs.readFileSync(tempIndex);
      workspace.remove("reconcile.index");
      tempPrepared = false;
      publication = new FinalizeIndexPublication(bytes, indexStat.mode);
    }
  } catch (error) {
    primaryError = error;
  }
  const cleanupErrors = [];
  if (tempPrepared) {
    try { workspace.remove("reconcile.index"); } catch (error) { cleanupErrors.push(error); }
  }
  try { workspace.remove("reconcile.index.lock"); } catch (error) { cleanupErrors.push(error); }
  if (primaryError && cleanupErrors.length > 0) {
    throw new AggregateError(
      [primaryError, ...cleanupErrors],
      "caller index reconciliation and cleanup both failed",
      { cause: primaryError },
    );
  }
  if (primaryError) throw primaryError;
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "caller index reconciliation cleanup failed", {
      cause: cleanupErrors[0],
    });
  }
  return publication;
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
  workspace,
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
    stagedTree: buildExpectedPathspecTree(resolvedTargetRoot, expectedParent, commitPaths, workspace),
    messageHash: hashCommitMessage(commitMessage),
    baseRef: gitValue(resolvedTargetRoot, ["rev-parse", state.baseBranch], "finalize base ref"),
    featureRef: gitValue(resolvedTargetRoot, ["rev-parse", state.featureBranch], "finalize feature ref"),
    commitPaths,
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

class AutoRescueIssueLogAllowance {
  constructor({ mainRepoPath, specId, idempotencyKey }) {
    this.mainRepoPath = mainRepoPath;
    this.relativePath = `specs/${specId}/issue-log.json`;
    this.idempotencyKey = idempotencyKey;
  }

  allowsCurrentDocument() {
    if (typeof this.idempotencyKey !== "string" || this.idempotencyKey === "") return false;
    const currentPath = path.join(this.mainRepoPath, this.relativePath);
    let current;
    try {
      current = new IssueLogDocument(JSON.parse(fs.readFileSync(currentPath, "utf8")));
    } catch {
      return false;
    }
    const ownedEntries = current.entries.filter((entry) => (
      entry?.issueLogId === this.idempotencyKey || entry?.grantId === this.idempotencyKey
    ));
    if (ownedEntries.length !== 1 || !current.remove(this.idempotencyKey)) return false;

    const exists = runGit([
      "-C", this.mainRepoPath, "ls-tree", "--name-only", "--full-tree", "HEAD", "--", this.relativePath,
    ]);
    let committed;
    if (!exists.ok) return false;
    const committedPath = exists.stdout.trim();
    if (committedPath === this.relativePath) {
      const show = runGit(["-C", this.mainRepoPath, "show", `HEAD:${this.relativePath}`]);
      if (!show.ok) return false;
      try {
        committed = new IssueLogDocument(JSON.parse(show.stdout));
      } catch {
        return false;
      }
    } else if (committedPath === "") {
      committed = new IssueLogDocument({ entries: [] });
    } else {
      return false;
    }
    return JSON.stringify(current.toJSON()) === JSON.stringify(committed.toJSON());
  }
}

/**
 * R14: a retry may ignore only the exact stable-ID audit mutation produced by
 * its prior CHERRY_PICK_CONFLICT halt. Any other issue-log edit remains dirty.
 */
function listMainRepoDirtyFiles(mainRepoPath, specId, allowedIssueLogId = null) {
  const issueLogPath = `specs/${specId}/issue-log.json`;
  const res = runGit([
    "-C",
    mainRepoPath,
    "status",
    "--porcelain",
    "--",
    ".",
    `:!${issueLogPath}`,
  ]);
  if (!res.ok) {
    const error = new Error(`main repository status probe failed: ${res.stderr || res.stdout || "unknown Git error"}`);
    error.code = "MAIN_REPO_STATUS_FAILED";
    throw error;
  }
  const dirtyFiles = res.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "")
    .map((line) => line.slice(3));
  const issueStatus = runGit([
    "-C",
    mainRepoPath,
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    issueLogPath,
  ]);
  if (!issueStatus.ok) {
    const error = new Error(`main repository issue-log status probe failed: ${issueStatus.stderr || issueStatus.stdout || "unknown Git error"}`);
    error.code = "MAIN_REPO_STATUS_FAILED";
    throw error;
  }
  if (issueStatus.stdout.trim()) {
    const allowance = new AutoRescueIssueLogAllowance({
      mainRepoPath,
      specId,
      idempotencyKey: allowedIssueLogId,
    });
    if (!allowance.allowsCurrentDocument()) dirtyFiles.push(issueLogPath);
  }
  return dirtyFiles;
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
  operationOwnerToken = null,
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
    new IssueLogStore({ root: mainRoot, spec: specPath, operationOwnerToken }).appendMany(issueLogEntries.map((entry) => {
      const normalized = { ...entry, timestamp: entry?.timestamp || timestamp };
      const idempotencyKey = finalizeLifecycleIssueLogId(entry);
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

function finalizeLifecycleIssueLogId(entry) {
  return entry?.issueLogId || `finalize-cleanup-lifecycle-${crypto
    .createHash("sha256")
    .update(JSON.stringify(entry))
    .digest("hex")}`;
}

function restoreFinalizeIssueLog(root, state, image, issueLogIds, authorization, operationOwnerToken) {
  const policy = new FinalizeBeforeImageRestorePolicy(image.rootRelative);
  const issueImage = image.files.find((entry) => entry.relativePath === policy.issueLogPath);
  if (image.directories.some((entry) => entry.relativePath === policy.issueLogPath)) return;
  const ownedIds = [
    ...issueLogIds,
    ...(authorization.route === "forced" ? [authorization.auditId] : []),
  ];
  if (ownedIds.length === 0 && issueImage == null) return;
  const store = new IssueLogStore({
    root,
    spec: state.spec,
    operationOwnerToken,
  });
  store.restoreOwnedMutation({
    idempotencyKeys: ownedIds,
    before: issueImage == null
      ? { exists: false, bytes: null, mode: null }
      : { exists: true, bytes: issueImage.bytes, mode: issueImage.mode },
  });
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
function appendIssueLog(mainRepoPath, specPath, entry, idempotencyKey, { operationOwnerToken = null } = {}) {
  new IssueLogStore({ root: mainRepoPath, spec: specPath, operationOwnerToken }).append({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  }, idempotencyKey);
  return idempotencyKey;
}

function restoreIssueLog(mainRepoPath, specPath, idempotencyKey, { operationOwnerToken = null } = {}) {
  if (!idempotencyKey) return;
  new IssueLogStore({ root: mainRepoPath, spec: specPath, operationOwnerToken }).compensate(idempotencyKey);
}

function appendForcedFinalizeAudit(root, state, authorization, { operationOwnerToken = null } = {}) {
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
  }, authorization.auditId, { operationOwnerToken });
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

class AutoRescueWorktreeAuthority {
  constructor({ worktreeDev, worktreeIno, gitDirPath, gitDirDev, gitDirIno, headSha }) {
    for (const [name, value] of Object.entries({ worktreeDev, worktreeIno, gitDirDev, gitDirIno })) {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error(`auto-rescue ${name} authority is invalid`);
    }
    if (typeof gitDirPath !== "string" || !path.isAbsolute(gitDirPath)) {
      throw new Error("auto-rescue git directory authority is invalid");
    }
    if (!GIT_OBJECT_ID.test(headSha)) throw new Error("auto-rescue worktree HEAD authority is invalid");
    this.worktreeDev = worktreeDev;
    this.worktreeIno = worktreeIno;
    this.gitDirPath = path.resolve(gitDirPath);
    this.gitDirDev = gitDirDev;
    this.gitDirIno = gitDirIno;
    this.headSha = headSha;
    Object.freeze(this);
  }

  static fromStored(value) {
    assertExactObjectKeys(
      value,
      ["worktreeDev", "worktreeIno", "gitDirPath", "gitDirDev", "gitDirIno", "headSha"],
      "auto-rescue worktree authority",
    );
    return new AutoRescueWorktreeAuthority(value);
  }

  sameGeneration(other) {
    const current = other instanceof AutoRescueWorktreeAuthority
      ? other
      : AutoRescueWorktreeAuthority.fromStored(other);
    return JSON.stringify(this.toJSON()) === JSON.stringify(current.toJSON());
  }

  toJSON() {
    return {
      worktreeDev: this.worktreeDev,
      worktreeIno: this.worktreeIno,
      gitDirPath: this.gitDirPath,
      gitDirDev: this.gitDirDev,
      gitDirIno: this.gitDirIno,
      headSha: this.headSha,
    };
  }
}

class AutoRescueWorktreeAuthoritySource {
  constructor(mainRepoPath) {
    this.mainRepoPath = path.resolve(mainRepoPath);
  }

  capture(worktreePath, expectedHeadSha = null) {
    const resolvedWorktree = path.resolve(worktreePath);
    const worktreeStat = fs.lstatSync(resolvedWorktree);
    if (
      !worktreeStat.isDirectory()
      || worktreeStat.isSymbolicLink()
      || fs.realpathSync(resolvedWorktree) !== resolvedWorktree
    ) {
      throw new Error("auto-rescue worktree generation is not a real directory");
    }
    const dotGitPath = path.join(resolvedWorktree, ".git");
    const dotGitStat = fs.lstatSync(dotGitPath);
    if (!dotGitStat.isFile() || dotGitStat.isSymbolicLink() || dotGitStat.nlink !== 1) {
      throw new Error("auto-rescue worktree Git pointer is not one real file");
    }
    const match = /^gitdir: (.+)\r?\n?$/.exec(fs.readFileSync(dotGitPath, "utf8"));
    if (!match) throw new Error("auto-rescue worktree Git pointer is malformed");
    const gitDirPath = path.resolve(path.dirname(dotGitPath), match[1]);
    const worktreesRoot = fs.realpathSync(path.join(this.mainRepoPath, ".git", "worktrees"));
    const realGitDirPath = fs.realpathSync(gitDirPath);
    if (path.dirname(realGitDirPath) !== worktreesRoot) {
      throw new Error("auto-rescue worktree Git directory is outside the repository authority");
    }
    const gitDirStat = fs.lstatSync(realGitDirPath);
    if (!gitDirStat.isDirectory() || gitDirStat.isSymbolicLink()) {
      throw new Error("auto-rescue worktree Git directory is not a real directory");
    }
    const headSha = fs.readFileSync(path.join(realGitDirPath, "HEAD"), "utf8").trim();
    if (expectedHeadSha !== null && headSha !== expectedHeadSha) {
      throw new Error("auto-rescue worktree HEAD differs from the expected generation");
    }
    return new AutoRescueWorktreeAuthority({
      worktreeDev: worktreeStat.dev,
      worktreeIno: worktreeStat.ino,
      gitDirPath: realGitDirPath,
      gitDirDev: gitDirStat.dev,
      gitDirIno: gitDirStat.ino,
      headSha,
    });
  }

  assertCurrent(worktreePath, expected) {
    const authority = expected instanceof AutoRescueWorktreeAuthority
      ? expected
      : AutoRescueWorktreeAuthority.fromStored(expected);
    if (!authority.sameGeneration(this.capture(worktreePath, authority.headSha))) {
      throw new Error("auto-rescue temporary worktree generation changed before cleanup");
    }
  }

  assertAbsent(worktreePath, expected) {
    if (!pathIsAbsent(worktreePath) || !pathIsAbsent(expected.gitDirPath)) {
      throw new Error("auto-rescue temporary worktree generation remains after cleanup");
    }
  }
}

class AutoRescueCleanupJournal {
  constructor({
    identity,
    phase,
    expectedBaseSha,
    expectedUpdatedSha = null,
    tempWorktreePath,
    worktreeAuthority = null,
    materializeBase,
    outcome,
    updatedAt,
  }) {
    assertExactObjectKeys(
      identity,
      ["mainRepoPath", "baseBranch", "baseline", "featureBranch", "specId", "allowedIssueLogId"],
      "auto-rescue cleanup identity",
    );
    if (identity.allowedIssueLogId !== null && (
      typeof identity.allowedIssueLogId !== "string" || identity.allowedIssueLogId === ""
    )) {
      throw new Error("auto-rescue issue-log allowance authority is invalid");
    }
    if (!AUTO_RESCUE_CLEANUP_PHASES.has(phase)) throw new Error("auto-rescue cleanup phase is invalid");
    if (!GIT_OBJECT_ID.test(expectedBaseSha)) throw new Error("auto-rescue expected base OID is invalid");
    if (expectedUpdatedSha !== null && !GIT_OBJECT_ID.test(expectedUpdatedSha)) {
      throw new Error("auto-rescue expected updated OID is invalid");
    }
    if (typeof materializeBase !== "boolean") throw new Error("auto-rescue materialization authority is invalid");
    const parsedWorktreeAuthority = worktreeAuthority == null
      ? null
      : worktreeAuthority instanceof AutoRescueWorktreeAuthority
        ? worktreeAuthority
        : AutoRescueWorktreeAuthority.fromStored(worktreeAuthority);
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
    if (
      !["staged", "body-failed", "cleanup-failed", "completed"].includes(phase)
      && parsedWorktreeAuthority == null
    ) {
      throw new Error("auto-rescue cleanup phase requires worktree generation authority");
    }
    if (phase === "body-failed" && parsedOutcome?.ok !== false) {
      throw new Error("body-failed auto-rescue cleanup journal needs a failed outcome");
    }
    if (phase === "abort-failed" && parsedOutcome?.abortFailure == null) {
      throw new Error("abort-failed auto-rescue cleanup journal needs an abort failure");
    }
    if (["base-updated", "worktree-materialized"].includes(phase) && parsedOutcome?.ok !== true) {
      throw new Error(`${phase} auto-rescue cleanup journal needs a successful outcome`);
    }
    if (phase === "completed" && parsedOutcome == null) {
      throw new Error("completed auto-rescue cleanup journal needs a terminal outcome");
    }
    if (phase === "ref-update-prepared" && (parsedOutcome?.ok !== true || expectedUpdatedSha == null)) {
      throw new Error("ref-update-prepared auto-rescue journal needs the successful expected OID");
    }
    if (typeof updatedAt !== "string" || updatedAt === "") throw new Error("auto-rescue cleanup timestamp is invalid");
    this.identity = Object.freeze({ ...identity, mainRepoPath: path.resolve(identity.mainRepoPath) });
    this.phase = phase;
    this.expectedBaseSha = expectedBaseSha;
    this.expectedUpdatedSha = expectedUpdatedSha;
    this.tempWorktreePath = path.resolve(tempWorktreePath);
    this.worktreeAuthority = parsedWorktreeAuthority;
    this.materializeBase = materializeBase;
    this.outcome = parsedOutcome;
    this.updatedAt = updatedAt;
  }

  static create(identity, expectedBaseSha, tempWorktreePath, materializeBase) {
    return new AutoRescueCleanupJournal({
      identity,
      phase: "staged",
      expectedBaseSha,
      expectedUpdatedSha: null,
      tempWorktreePath,
      worktreeAuthority: null,
      materializeBase,
      outcome: null,
      updatedAt: new Date().toISOString(),
    });
  }

  static fromStored(expectedIdentity, value) {
    assertExactObjectKeys(
      value,
      [
        "version", "identity", "phase", "expectedBaseSha", "expectedUpdatedSha",
        "tempWorktreePath", "worktreeAuthority", "materializeBase", "outcome", "updatedAt",
      ],
      "auto-rescue cleanup journal",
    );
    if (value.version !== AUTO_RESCUE_CLEANUP_VERSION) throw new Error("auto-rescue cleanup version is invalid");
    const journal = new AutoRescueCleanupJournal(value);
    if (JSON.stringify(journal.identity) !== JSON.stringify(expectedIdentity)) {
      throw new Error("auto-rescue cleanup journal targets a different authority");
    }
    return journal;
  }

  advance(phase, outcome = this.outcome, expectedUpdatedSha = this.expectedUpdatedSha) {
    const advanced = new AutoRescueCleanupJournal({
      identity: this.identity,
      phase,
      expectedBaseSha: this.expectedBaseSha,
      expectedUpdatedSha,
      tempWorktreePath: this.tempWorktreePath,
      worktreeAuthority: this.worktreeAuthority,
      materializeBase: this.materializeBase,
      outcome,
      updatedAt: new Date().toISOString(),
    });
    Object.assign(this, advanced);
  }

  recordWorktreeAuthority(authority) {
    this.worktreeAuthority = authority instanceof AutoRescueWorktreeAuthority
      ? authority
      : AutoRescueWorktreeAuthority.fromStored(authority);
  }

  toJSON() {
    return {
      version: AUTO_RESCUE_CLEANUP_VERSION,
      identity: this.identity,
      phase: this.phase,
      expectedBaseSha: this.expectedBaseSha,
      expectedUpdatedSha: this.expectedUpdatedSha,
      tempWorktreePath: this.tempWorktreePath,
      worktreeAuthority: this.worktreeAuthority?.toJSON() ?? null,
      materializeBase: this.materializeBase,
      outcome: this.outcome?.toJSON() ?? null,
      updatedAt: this.updatedAt,
    };
  }
}

class AutoRescueCleanupStore {
  constructor(identity) {
    this.identity = identity;
    const token = crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex");
    this.directory = path.join(identity.mainRepoPath, ".git", "senti", "recovery", "auto-rescue");
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
    expectedUpdatedSha: journal.expectedUpdatedSha,
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

function removeAutoRescueWorktree(runGitFn, journal, worktreeAuthoritySource) {
  const worktrees = runGitFn(["-C", journal.identity.mainRepoPath, "worktree", "list", "--porcelain"]);
  if (!worktrees.ok) return { ok: false, error: autoRescueCleanupError(journal, worktrees) };
  const registered = worktrees.stdout.split("\n").includes(`worktree ${journal.tempWorktreePath}`);
  if (registered) {
    if (journal.worktreeAuthority == null) {
      return {
        ok: false,
        error: autoRescueCleanupError(
          journal,
          { stderr: "registered temporary worktree has no durable generation authority" },
          { worktreeResidue: true },
        ),
      };
    }
    try {
      worktreeAuthoritySource.assertCurrent(journal.tempWorktreePath, journal.worktreeAuthority);
    } catch (error) {
      return {
        ok: false,
        error: autoRescueCleanupError(journal, { stderr: error.message }, { worktreeResidue: true }),
      };
    }
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
  let generationAbsent = true;
  if (journal.worktreeAuthority != null) {
    try {
      worktreeAuthoritySource.assertAbsent(journal.tempWorktreePath, journal.worktreeAuthority);
    } catch {
      generationAbsent = false;
    }
  }
  if (
    !verified.ok
    || verified.stdout.split("\n").includes(`worktree ${journal.tempWorktreePath}`)
    || !pathIsAbsent(journal.tempWorktreePath)
    || !generationAbsent
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
function autoRescueIdentity({
  mainRepoPath,
  baseBranch,
  baseline,
  featureBranch,
  specId,
  allowedIssueLogId = null,
}) {
  return {
    mainRepoPath: path.resolve(mainRepoPath),
    baseBranch,
    baseline,
    featureBranch,
    specId,
    allowedIssueLogId,
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

function completeAutoRescueCleanup(store, journal, outcome, runGitFn, worktreeAuthoritySource) {
  const cleanup = removeAutoRescueWorktree(runGitFn, journal, worktreeAuthoritySource);
  if (!cleanup.ok) return autoRescueCleanupFailure(store, journal, outcome, cleanup.error);
  if (outcome != null) {
    journal.advance("completed", outcome, journal.expectedUpdatedSha);
    try {
      store.write(journal);
    } catch (cause) {
      const cleanupError = autoRescueCleanupError(
        journal,
        { stderr: cause.message },
        { worktreeResidue: false },
      );
      cleanupError.cause = cause;
      return autoRescueCleanupFailure(store, journal, outcome, cleanupError);
    }
  } else {
    store.remove();
  }
  return outcome?.toJSON() ?? null;
}

function baseBranchIsCheckedOut(mainRepoPath, baseBranch) {
  try {
    return fs.readFileSync(path.join(mainRepoPath, ".git", "HEAD"), "utf8").trim()
      === `ref: refs/heads/${baseBranch}`;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function autoRescueAuthorityFailure(store, journal, message) {
  const error = new Error(message);
  error.code = "AUTO_RESCUE_CLEANUP_FAILED";
  error.cleanupAuthority = autoRescueRecoveryAuthority(store, journal, journal.phase);
  return error;
}

function assertAutoRescueUpdatedRef(store, journal, runGitFn) {
  const baseRef = `refs/heads/${journal.identity.baseBranch}`;
  const current = runGitFn(["-C", journal.identity.mainRepoPath, "rev-parse", "--verify", baseRef]);
  if (!current.ok || current.stdout.trim() !== journal.expectedUpdatedSha) {
    throw autoRescueAuthorityFailure(store, journal, "auto-rescue updated base ref diverged from journal authority");
  }
}

function materializeAutoRescueBase(store, journal, runGitFn) {
  assertAutoRescueUpdatedRef(store, journal, runGitFn);
  if (!journal.materializeBase) return;
  const baseRef = `refs/heads/${journal.identity.baseBranch}`;
  const headRef = runGitFn(["-C", journal.identity.mainRepoPath, "symbolic-ref", "-q", "HEAD"]);
  if (!headRef.ok || headRef.stdout.trim() !== baseRef) {
    throw autoRescueAuthorityFailure(store, journal, "auto-rescue base checkout authority changed before materialization");
  }
  const oldIndex = runGitFn([
    "-C", journal.identity.mainRepoPath,
    "diff-index", "--cached", "--quiet", journal.expectedBaseSha, "--",
  ]);
  const updatedIndex = runGitFn([
    "-C", journal.identity.mainRepoPath,
    "diff-index", "--cached", "--quiet", journal.expectedUpdatedSha, "--",
  ]);
  if (oldIndex.ok) {
    const materialized = runGitFn([
      "-C", journal.identity.mainRepoPath,
      "read-tree", "-u", "-m", journal.expectedBaseSha, journal.expectedUpdatedSha,
    ]);
    if (!materialized.ok) {
      throw autoRescueAuthorityFailure(store, journal, "auto-rescue base checkout materialization failed");
    }
  } else if (!updatedIndex.ok) {
    throw autoRescueAuthorityFailure(store, journal, "auto-rescue caller index diverged before materialization");
  }
  const verifiedIndex = runGitFn([
    "-C", journal.identity.mainRepoPath,
    "diff-index", "--cached", "--quiet", journal.expectedUpdatedSha, "--",
  ]);
  let dirtyFiles;
  try {
    dirtyFiles = listMainRepoDirtyFiles(
      journal.identity.mainRepoPath,
      journal.identity.specId,
      journal.identity.allowedIssueLogId,
    );
  } catch {
    dirtyFiles = null;
  }
  if (!verifiedIndex.ok || dirtyFiles == null || dirtyFiles.length > 0) {
    throw autoRescueAuthorityFailure(store, journal, "auto-rescue base checkout materialization is not clean");
  }
}

function probeAutoRescueRefOid(mainRepoPath, baseRef, runGitFn) {
  const probe = runGitFn(["-C", mainRepoPath, "rev-parse", "--verify", baseRef]);
  return probe.ok ? probe.stdout.trim() : null;
}

export function runDetachedAutoRescue({
  mainRepoPath,
  baseBranch,
  baseline,
  featureBranch,
  specId,
  allowedIssueLogId = null,
  range,
  runGitFn = runGit,
  worktreeAuthoritySource = new AutoRescueWorktreeAuthoritySource(mainRepoPath),
  tempWorktreePathFactory = () => path.join(
    os.tmpdir(),
    `senti-rescue-tmp-${process.pid}-${Date.now()}`,
  ),
}) {
  const identity = autoRescueIdentity({
    mainRepoPath, baseBranch, baseline, featureBranch, specId, allowedIssueLogId,
  });
  const store = new AutoRescueCleanupStore(identity);
  const existing = store.load();
  if (existing) {
    if (existing.phase === "ref-update-prepared") {
      const baseRef = `refs/heads/${baseBranch}`;
      const current = runGitFn(["-C", mainRepoPath, "rev-parse", "--verify", baseRef]);
      const currentOid = current.ok ? current.stdout.trim() : null;
      if (currentOid === existing.expectedBaseSha) {
        const update = runGitFn([
          "-C", mainRepoPath, "update-ref", baseRef,
          existing.expectedUpdatedSha, existing.expectedBaseSha,
        ]);
        if (!update.ok) {
          const observedOid = probeAutoRescueRefOid(mainRepoPath, baseRef, runGitFn);
          if (observedOid === existing.expectedBaseSha) {
            const error = new Error("auto-rescue prepared ref update could not be resumed");
            error.code = "AUTO_RESCUE_CLEANUP_FAILED";
            error.cleanupAuthority = autoRescueRecoveryAuthority(store, existing, existing.phase);
            throw error;
          }
          if (observedOid !== existing.expectedUpdatedSha) {
            throw autoRescueAuthorityFailure(store, existing, "auto-rescue resumed ref update result is ambiguous");
          }
        }
      } else if (currentOid !== existing.expectedUpdatedSha) {
        const error = new Error("auto-rescue base ref diverged from both journaled OIDs");
        error.code = "AUTO_RESCUE_CLEANUP_FAILED";
        error.cleanupAuthority = autoRescueRecoveryAuthority(store, existing, existing.phase);
        throw error;
      }
      existing.advance("base-updated", existing.outcome, existing.expectedUpdatedSha);
      store.write(existing);
    }
    if (existing.phase === "base-updated") {
      materializeAutoRescueBase(store, existing, runGitFn);
      existing.advance("worktree-materialized", existing.outcome, existing.expectedUpdatedSha);
      store.write(existing);
    }
    if (["worktree-materialized", "completed"].includes(existing.phase) && existing.outcome?.ok) {
      assertAutoRescueUpdatedRef(store, existing, runGitFn);
    }
    const recoveredOutcome = existing.outcome;
    const recovered = completeAutoRescueCleanup(
      store,
      existing,
      recoveredOutcome,
      runGitFn,
      worktreeAuthoritySource,
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
  const journal = AutoRescueCleanupJournal.create(
    identity,
    expectedBaseSha,
    tempWorktreePath,
    baseBranchIsCheckedOut(mainRepoPath, baseBranch),
  );
  store.write(journal);
  const addRes = runGitFn([
    "-C", mainRepoPath, "worktree", "add", "--detach", tempWorktreePath, expectedBaseSha,
  ]);
  if (!addRes.ok) {
    const outcome = AutoRescueOutcome.failure("MAIN_REPO_LOCKED");
    journal.advance("body-failed", outcome);
    store.write(journal);
    return completeAutoRescueCleanup(store, journal, outcome, runGitFn, worktreeAuthoritySource);
  }
  journal.recordWorktreeAuthority(worktreeAuthoritySource.capture(tempWorktreePath, expectedBaseSha));
  journal.advance("worktree-added");
  store.write(journal);

  let outcome;
  try {
    outcome = AutoRescueOutcome.fromResult(cherryPickRange(tempWorktreePath, range, runGitFn));
  } catch (primaryError) {
    if (primaryError.code !== "AUTO_RESCUE_CONFLICT_PROBE_FAILED") throw primaryError;
    const cleanup = completeAutoRescueCleanup(store, journal, null, runGitFn, worktreeAuthoritySource);
    if (cleanup?.ok === false) {
      const cleanupError = Object.assign(new Error("auto-rescue cleanup failed after Git probe failure"), {
        code: cleanup.code,
        cleanupAuthority: cleanup.cleanupAuthority,
      });
      throw new AggregateError(
        [primaryError, cleanupError],
        "auto-rescue Git probe and temporary worktree cleanup both failed",
        { cause: primaryError },
      );
    }
    throw primaryError;
  }
  journal.recordWorktreeAuthority(worktreeAuthoritySource.capture(tempWorktreePath));
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
      const updatedSha = headRes.stdout.trim();
      journal.advance("ref-update-prepared", outcome, updatedSha);
      store.write(journal);
      const updateRes = runGitFn([
        "-C",
        mainRepoPath,
        "update-ref",
        baseRef,
        updatedSha,
        expectedBaseSha,
      ]);
      if (!updateRes.ok) {
        const observedOid = probeAutoRescueRefOid(mainRepoPath, baseRef, runGitFn);
        if (observedOid === updatedSha) {
          outcome = AutoRescueOutcome.success();
        } else if (observedOid === expectedBaseSha) {
          outcome = AutoRescueOutcome.failure("MAIN_REPO_LOCKED");
        } else {
          throw autoRescueAuthorityFailure(store, journal, "auto-rescue ref update result is ambiguous");
        }
      }
    }
  }
  journal.advance(outcome.ok ? "base-updated" : "body-failed", outcome);
  store.write(journal);
  if (outcome.ok) {
    materializeAutoRescueBase(store, journal, runGitFn);
    journal.advance("worktree-materialized", outcome, journal.expectedUpdatedSha);
    store.write(journal);
  }
  return completeAutoRescueCleanup(store, journal, outcome, runGitFn, worktreeAuthoritySource);
}

export function runAutoRescue({
  mainRepoPath,
  baseBranch,
  baseline,
  featureBranch,
  specId,
  allowedIssueLogId = null,
}) {
  const range = `${baseline}..${featureBranch}`;
  const identity = autoRescueIdentity({
    mainRepoPath, baseBranch, baseline, featureBranch, specId, allowedIssueLogId,
  });
  const pendingCleanup = new AutoRescueCleanupStore(identity).load();
  if (pendingCleanup) {
    try {
      return runDetachedAutoRescue({
        mainRepoPath, baseBranch, baseline, featureBranch, specId, range, allowedIssueLogId,
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

  let dirtyFiles;
  try {
    dirtyFiles = listMainRepoDirtyFiles(mainRepoPath, specId, allowedIssueLogId);
  } catch (error) {
    return { ok: false, code: error.code || "MAIN_REPO_STATUS_FAILED", message: error.message };
  }
  if (dirtyFiles.length > 0) {
    return { ok: false, code: "MAIN_REPO_DIRTY", dirtyFiles };
  }

  try {
    return runDetachedAutoRescue({
      mainRepoPath, baseBranch, baseline, featureBranch, specId, range, allowedIssueLogId,
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
      const stateProbe = runGitFn(["-C", repoPath, "rev-parse", "--verify", "-q", "CHERRY_PICK_HEAD"]);
      if (!stateProbe.ok) {
        if (stateProbe.status === 1 && !stateProbe.stdout && !stateProbe.stderr) {
          // No in-progress cherry-pick → sequence completed.
          break;
        }
        const error = new Error(`cherry-pick state probe failed: ${stateProbe.stderr || stateProbe.stdout || "unknown Git error"}`);
        error.code = "AUTO_RESCUE_CHERRY_PICK_STATE_FAILED";
        throw error;
      }
      continue;
    }
    // Genuine conflict.
    const statusRes = runGitFn(["-C", repoPath, "diff", "--name-only", "--diff-filter=U"]);
    if (!statusRes.ok) {
      const primaryError = gitFailure(
        "AUTO_RESCUE_CONFLICT_PROBE_FAILED",
        "cherry-pick conflict file probe failed",
        statusRes,
      );
      const abort = runGitFn(["-C", repoPath, "cherry-pick", "--abort"]);
      if (!abort.ok) {
        const abortError = AutoRescueAbortFailure.fromGitResult(abort).toError();
        const error = new AggregateError(
          [primaryError, abortError],
          "auto-rescue conflict probe and abort both failed",
          { cause: primaryError },
        );
        error.code = primaryError.code;
        throw error;
      }
      throw primaryError;
    }
    const conflictFiles = statusRes.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
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
    const repositoryOperation = new RepositoryFlowOperationLock({
      mainRoot,
      operationOwnerToken: ctx.repositoryOperationOwnerToken || null,
    });
    let token;
    try {
      token = repositoryOperation.acquire();
    } catch (error) {
      if (["REPOSITORY_FLOW_OPERATION_BUSY", "REPOSITORY_MAINTENANCE_BUSY"].includes(error.code)) {
        return Envelope.fail("run", "finalize-cleanup", error.code, error.message, { lockPath: error.lockPath });
      }
      throw error;
    }
    let result;
    let primaryError = null;
    try {
      const operation = new FinalizeRepositoryOperationLock(mainRoot);
      result = await withFinalizeRepositoryOperation(operation, () => this.executeOwned({
        ...ctx,
        repositoryOperationOwnerToken: token,
      }));
    } catch (error) {
      primaryError = error;
    }
    let releaseError = null;
    try {
      repositoryOperation.release();
    } catch (error) {
      releaseError = error;
    }
    if (primaryError && releaseError) {
      throw new AggregateError(
        [primaryError, releaseError],
        "finalize operation and repository barrier release both failed",
        { cause: primaryError },
      );
    }
    if (primaryError) throw primaryError;
    if (releaseError) throw releaseError;
    return result;
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
        allowedIssueLogId: finalizeAuditId("cherry-pick-conflict", state, { baseline, featureBranch }),
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
          }, finalizeAuditId("cherry-pick-conflict", state, { baseline, featureBranch }), {
            operationOwnerToken: ctx.repositoryOperationOwnerToken,
          });
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
        ctx.flowManager.clearFlowState(specId, {
          operationOwnerToken: ctx.repositoryOperationOwnerToken,
        });
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

function assertFinalizeRelativePath(relativePath, label) {
  if (
    typeof relativePath !== "string"
    || relativePath === ""
    || path.isAbsolute(relativePath)
    || path.normalize(relativePath) !== relativePath
    || relativePath === ".."
    || relativePath.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`${label} is outside the finalize authority`);
  }
}

function captureFinalizeTreeAt(targetRoot, rootRelative, { sharedState = false, required = false } = {}) {
  assertFinalizeRelativePath(rootRelative, "finalize tree root");
  const treeRoot = path.join(targetRoot, rootRelative);
  const files = [];
  const directories = [];
  if (!fs.existsSync(treeRoot)) {
    if (required) throw new Error(`finalize tree root is absent: ${treeRoot}`);
    return new FinalizeTreeBeforeImage({
      rootRelative,
      rootExisted: false,
      sharedState: false,
      files,
      directories,
    });
  }
  const visit = (directory) => {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== directory) {
      throw new Error(`finalize tree directory is not a real authority: ${directory}`);
    }
    directories.push(new FinalizeDirectoryBeforeImage({
      relativePath: path.relative(targetRoot, directory),
      mode: stat.mode & 0o777,
    }));
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      const targetStat = fs.lstatSync(target);
      if (targetStat.isDirectory() && !targetStat.isSymbolicLink()) {
        visit(target);
      } else if (targetStat.isFile() && !targetStat.isSymbolicLink() && targetStat.nlink === 1) {
        files.push(FinalizeFileBeforeImage.capture(targetRoot, target, targetStat));
      } else {
        throw new Error(`finalize tree entry is not a real non-hardlinked authority: ${target}`);
      }
    }
  };
  visit(treeRoot);
  return new FinalizeTreeBeforeImage({
    rootRelative,
    rootExisted: true,
    sharedState,
    files,
    directories,
  });
}

function captureFinalizeTree(targetRoot, specId) {
  return captureFinalizeTreeAt(targetRoot, path.join("specs", specId), {
    sharedState: true,
    required: true,
  });
}

function finalizeChangedFilePaths(targetRoot, beforeImage) {
  const before = beforeImage instanceof FinalizeTreeBeforeImage
    ? beforeImage
    : new FinalizeTreeBeforeImage(beforeImage);
  const after = captureFinalizeTree(targetRoot, path.basename(before.rootRelative));
  const beforeFiles = new Map(before.files.map((entry) => [entry.relativePath, entry]));
  const afterFiles = new Map(after.files.map((entry) => [entry.relativePath, entry]));
  return [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])]
    .filter((relativePath) => {
      const left = beforeFiles.get(relativePath);
      const right = afterFiles.get(relativePath);
      return left == null
        || right == null
        || left.revision !== right.revision
        || left.mode !== right.mode;
    })
    .sort();
}

function durableRestoreFile(filePath, bytes, mode) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.finalize-restore-${process.pid}-${crypto.randomUUID()}`,
  );
  const descriptor = fs.openSync(tempPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, mode);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fchmodSync(descriptor, mode);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(tempPath, filePath);
  const directoryDescriptor = fs.openSync(path.dirname(filePath), "r");
  try {
    fs.fsyncSync(directoryDescriptor);
  } finally {
    fs.closeSync(directoryDescriptor);
  }
}

function fsyncFinalizeDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

export class FinalizeBeforeImageRestorePolicy {
  constructor(rootRelative, sharedState = true) {
    if (
      typeof rootRelative !== "string"
      || rootRelative === ""
      || path.isAbsolute(rootRelative)
      || path.normalize(rootRelative) !== rootRelative
      || rootRelative.split(path.sep).includes("..")
    ) {
      throw new Error("finalize restore root authority is invalid");
    }
    this.sharedFlowRelativePath = sharedState ? path.join(rootRelative, "flow.json") : null;
    this.issueLogPath = sharedState ? path.join(rootRelative, "issue-log.json") : null;
    Object.freeze(this);
  }

  usesSharedWriter(relativePath) {
    return relativePath === this.sharedFlowRelativePath || relativePath === this.issueLogPath;
  }

  allowsRawByteRestore(relativePath) {
    return !this.usesSharedWriter(relativePath);
  }
}

function restoreFinalizeTree(targetRoot, image) {
  const tree = image instanceof FinalizeTreeBeforeImage ? image : new FinalizeTreeBeforeImage(image);
  const expectedFiles = new Map(tree.files.map((entry) => [entry.relativePath, entry]));
  const expectedDirectories = new Map(tree.directories.map((entry) => [entry.relativePath, entry]));
  const treeRoot = path.join(targetRoot, tree.rootRelative);
  const currentFiles = [];
  const currentDirectories = [];
  const restorePolicy = new FinalizeBeforeImageRestorePolicy(tree.rootRelative, tree.sharedState);
  const visit = (directory) => {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== directory) {
      throw new Error(`finalize restore encountered an unknown directory mutation: ${directory}`);
    }
    currentDirectories.push(path.relative(targetRoot, directory));
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      const targetStat = fs.lstatSync(target);
      if (targetStat.isDirectory() && !targetStat.isSymbolicLink()) visit(target);
      else if (targetStat.isFile() && !targetStat.isSymbolicLink() && targetStat.nlink === 1) {
        currentFiles.push(path.relative(targetRoot, target));
      } else {
        throw new Error(`finalize restore encountered an unknown path mutation: ${target}`);
      }
    }
  };
  if (fs.existsSync(treeRoot)) visit(treeRoot);
  if (!tree.rootExisted) {
    for (const relativePath of currentFiles) {
      const target = path.join(targetRoot, relativePath);
      fs.unlinkSync(target);
      fsyncFinalizeDirectory(path.dirname(target));
    }
    for (const relativePath of currentDirectories.sort((a, b) => b.length - a.length)) {
      const target = path.join(targetRoot, relativePath);
      fs.rmdirSync(target);
      fsyncFinalizeDirectory(path.dirname(target));
    }
    return;
  }
  for (const relativePath of currentFiles) {
    if (!restorePolicy.allowsRawByteRestore(relativePath)) continue;
    if (!expectedFiles.has(relativePath)) {
      const target = path.join(targetRoot, relativePath);
      fs.unlinkSync(target);
      fsyncFinalizeDirectory(path.dirname(target));
    }
  }
  for (const directory of [...tree.directories].sort((a, b) => a.relativePath.length - b.relativePath.length)) {
    const target = path.join(targetRoot, directory.relativePath);
    const existed = fs.existsSync(target);
    fs.mkdirSync(target, { recursive: true, mode: directory.mode });
    fs.chmodSync(target, directory.mode);
    fsyncFinalizeDirectory(target);
    if (!existed) fsyncFinalizeDirectory(path.dirname(target));
  }
  for (const file of tree.files) {
    if (!restorePolicy.allowsRawByteRestore(file.relativePath)) continue;
    durableRestoreFile(path.join(targetRoot, file.relativePath), Buffer.from(file.bytes, "base64"), file.mode);
  }
  for (const relativePath of currentDirectories.sort((a, b) => b.length - a.length)) {
    if (!expectedDirectories.has(relativePath)) {
      const target = path.join(targetRoot, relativePath);
      fs.rmdirSync(target);
      fsyncFinalizeDirectory(path.dirname(target));
    }
  }
  fsyncFinalizeDirectory(treeRoot);
}

function restorePreparedFinalize(
  transactionStore,
  transaction,
  targetRoot,
  targetFm,
  specId,
  state,
  operationOwnerToken,
) {
  for (const image of transaction.beforeImages) {
    restoreFinalizeTree(targetRoot, image);
    if (!image.sharedState) continue;
    const restorePolicy = new FinalizeBeforeImageRestorePolicy(image.rootRelative);
    const flowImage = image.files.find((entry) => entry.relativePath === restorePolicy.sharedFlowRelativePath);
    if (flowImage) {
      const beforeBytes = Buffer.from(flowImage.bytes, "base64");
      const currentBytes = fs.readFileSync(path.join(targetRoot, flowImage.relativePath));
      if (!currentBytes.equals(beforeBytes)) {
        const flowAuthority = targetFm.forRoot(targetRoot, { specId });
        const current = flowAuthority.loadReadOnly(specId);
        flowAuthority.saveAtomic(JSON.parse(beforeBytes.toString("utf8")), {
          expectedOriginal: current,
          operationOwnerToken,
        });
      }
    }
    restoreFinalizeIssueLog(
      targetRoot,
      state,
      image,
      transaction.issueLogIds,
      transaction.authorization,
      operationOwnerToken,
    );
  }
  transaction.resetPrepared();
  transactionStore.write(transaction);
}

function gitFailure(code, message, result) {
  const error = new Error(`${message}: ${result.stderr || result.stdout || "unknown git error"}`);
  error.code = code;
  return error;
}

function acquireFinalizeTempIndexWorkspace(transactionStore, transaction, targetRoot) {
  if (transaction.tempIndexAuthority == null) {
    transaction.planTempIndexWorkspace(targetRoot);
    transactionStore.write(transaction);
  } else if (
    transaction.tempIndexAuthority.dev !== null
    && !fs.existsSync(transaction.tempIndexAuthority.workspacePath)
  ) {
    transaction.planTempIndexWorkspace(targetRoot);
    transactionStore.write(transaction);
  }
  const workspace = FinalizeTempIndexWorkspace.acquire(transaction.tempIndexAuthority, targetRoot);
  if (transaction.tempIndexAuthority.dev === null) {
    transaction.ownTempIndexWorkspace(workspace.authority);
    try {
      transactionStore.write(transaction);
    } catch (error) {
      throw Object.assign(error, { finalizeTempIndexWorkspace: workspace });
    }
  }
  return workspace;
}

function acquireFinalizeCallerIndexLease(transactionStore, transaction, targetRoot) {
  const lockPath = path.join(targetRoot, ".git", "index.lock");
  const indexPath = path.join(targetRoot, ".git", "index");
  if (transaction.indexLockAuthority == null) {
    if (fs.existsSync(lockPath)) {
      throw Object.assign(new Error("caller index lock is busy"), {
        code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
        lockPath,
      });
    }
    transaction.planIndexLock();
    transactionStore.write(transaction);
  } else if (transaction.indexLockAuthority.dev !== null && !fs.existsSync(lockPath)) {
    if (transaction.indexLockAuthority.publishPhase === "publishing") {
      let indexStat;
      let indexBytes;
      try {
        indexStat = assertRealFinalizeFile(indexPath, "published caller index");
        indexBytes = fs.readFileSync(indexPath);
      } catch (cause) {
        throw Object.assign(new Error("published caller index authority is unavailable", { cause }), {
          code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
          lockPath,
        });
      }
      if (
        !transaction.indexLockAuthority.matchesPublication(indexStat)
        || transaction.indexLockAuthority.contentState(indexBytes) !== "expected-index"
        || (indexStat.mode & 0o777) !== transaction.indexLockAuthority.expectedIndexMode
      ) {
        throw Object.assign(new Error("published caller index authority diverged"), {
          code: "FINALIZE_INDEX_RECONCILIATION_BUSY",
          lockPath,
        });
      }
    }
    transaction.planIndexLock();
    transactionStore.write(transaction);
  }
  const lease = FinalizeCallerIndexLease.acquire(transaction.indexLockAuthority, targetRoot);
  if (transaction.indexLockAuthority.dev === null) {
    transaction.ownIndexLock(lease.authority);
    try {
      transactionStore.write(transaction);
    } catch (error) {
      lease.detach();
      throw error;
    }
  }
  return lease;
}

function cleanupFinalizePreparedAuthorities(
  transactionStore,
  transaction,
  targetRoot,
  { callerIndexLease = null, tempIndexWorkspace = null } = {},
) {
  if (transaction.indexLockAuthority != null) {
    const lockPath = path.join(targetRoot, ".git", "index.lock");
    if (callerIndexLease == null && fs.existsSync(lockPath)) {
      callerIndexLease = FinalizeCallerIndexLease.acquire(transaction.indexLockAuthority, targetRoot);
    }
    if (callerIndexLease != null) callerIndexLease.release();
    transaction.clearIndexLock();
  }
  if (transaction.tempIndexAuthority != null) {
    if (tempIndexWorkspace == null && fs.existsSync(transaction.tempIndexAuthority.workspacePath)) {
      tempIndexWorkspace = FinalizeTempIndexWorkspace.acquire(transaction.tempIndexAuthority, targetRoot);
    }
    if (tempIndexWorkspace != null) tempIndexWorkspace.cleanup();
    transaction.clearTempIndexWorkspace();
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
  const transactionExisted = transactionStore.hasExisting();
  const transaction = transactionStore.loadOrCreate();
  let callerIndexLease = null;
  let tempIndexWorkspace = null;
  if (!transactionExisted) transactionStore.write(transaction);
  if (!transaction.phase.atLeast("commit-durable") && transaction.commitExpectation) {
    const recovery = inspectExpectedCommit(transaction.commitExpectation, { targetRoot, state });
    if (recovery.adopted) {
      transaction.advance("commit-durable", { commitSha: recovery.head });
      transaction.clearBeforeImages();
      transactionStore.write(transaction);
    }
  }
  if (!transaction.phase.atLeast("commit-durable") && transaction.beforeImages.length > 0) {
    cleanupFinalizePreparedAuthorities(transactionStore, transaction, targetRoot);
    restorePreparedFinalize(
      transactionStore,
      transaction,
      targetRoot,
      targetFm,
      specId,
      state,
      ctx.repositoryOperationOwnerToken,
    );
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
  const failBeforeCommit = (env, primaryError = null) => {
    try {
      cleanupFinalizePreparedAuthorities(transactionStore, transaction, targetRoot, {
        callerIndexLease,
        tempIndexWorkspace,
      });
      callerIndexLease = null;
      tempIndexWorkspace = null;
      restorePreparedFinalize(
        transactionStore,
        transaction,
        targetRoot,
        targetFm,
        specId,
        state,
        ctx.repositoryOperationOwnerToken,
      );
    } catch (restoreError) {
      if (primaryError == null) throw restoreError;
      const error = new AggregateError(
        [primaryError, restoreError],
        "finalize pre-commit operation and exact restoration both failed",
        { cause: primaryError },
      );
      error.finalizeRestoreAttempted = true;
      throw error;
    }
    return attachTransaction(env);
  };
  if (!transaction.phase.atLeast("commit-durable")) {
    const cleanupResolver = new FinalizeCleanupPathResolver({
      enabled: true,
      worktreeRoot: worktreePath || ctx.root,
      mainRoot: targetRoot,
      inWorktree: Boolean(worktree && mainRepoPath),
    });
    const sidecarRoot = path.dirname(cleanupResolver.postCommandMetadataPath("metadata.json", { specId }));
    transaction.setBeforeImages([
      captureFinalizeTree(targetRoot, specId),
      captureFinalizeTreeAt(targetRoot, path.relative(targetRoot, sidecarRoot)),
    ]);
    transactionStore.write(transaction);
  }
  if (transaction.authorization.route === "forced" && !transaction.phase.atLeast("commit-durable")) {
    try {
      appendForcedFinalizeAudit(reportRoot, state, transaction.authorization, {
        operationOwnerToken: ctx.repositoryOperationOwnerToken,
      });
    } catch (error) {
      return failBeforeCommit(Envelope.fail(
        "run",
        "finalize-cleanup",
        "ISSUE_LOG_AUDIT_FAILED",
        `Required forced teardown audit append failed: ${error.message}`,
        { causeCode: error.code || null, auditId: transaction.authorization.auditId },
      ), error);
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
    try {
    // Spec 272: sync unreflected flow metadata (e.g. retry success logs) from
    // worktree to main before teardown.
    if (worktree && mainRepoPath && ctx.root !== mainRepoPath) {
      try {
        syncMetadataFromWorktreeToMain(
          ctx.root,
          mainRepoPath,
          specId,
          ctx.repositoryOperationOwnerToken,
        );
      } catch (err) {
        return failBeforeCommit(Envelope.fail(
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
        ), err);
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
      return failBeforeCommit(Envelope.fail(
        "run",
        "finalize-cleanup",
        "PLUGIN_LIFECYCLE_FAILED",
        `Plugin finalize-cleanup lifecycle failed: ${err.message}`,
        { causeCode: err.code || null },
      ), err);
    }
    const pluginHookFailure = (pluginLifecycle.warnings || [])
      .find((warning) => warning.code === "PLUGIN_HOOK_FAILED");
    if (pluginHookFailure) {
      const error = Object.assign(new Error(pluginHookFailure.message), {
        code: "PLUGIN_LIFECYCLE_FAILED",
      });
      return failBeforeCommit(Envelope.fail(
        "run",
        "finalize-cleanup",
        error.code,
        `Plugin finalize-cleanup lifecycle failed: ${error.message}`,
        {
          pluginId: pluginHookFailure.pluginId || null,
          hook: pluginHookFailure.hook || null,
        },
      ), error);
    }

    if (worktree && mainRepoPath) {
      transaction.ownIssueLogIds(
        (pluginLifecycle.issueLogEntries || []).map((entry) => finalizeLifecycleIssueLogId(entry)),
      );
      transactionStore.write(transaction);
      const finalizeCleanupStep = flattenSteps(state.steps || []).find((step) => step.id === "finalize-cleanup");
      retainedCleanupMetadata = recordFinalizeCleanupPostCommandMetadata({
        flowManager: ctx.flowManager,
        specId,
        metrics: Array.isArray(state.metrics) ? state.metrics : [],
        runtimeLog: finalizeCleanupStep?.runtimeLog || null,
        notes: Array.isArray(state.notes) ? state.notes : [],
        issueLogEntries: pluginLifecycle.issueLogEntries || [],
        pluginArtifacts: pluginLifecycle.data?.pluginHooks || [],
        operationOwnerToken: ctx.repositoryOperationOwnerToken,
      });
    }

    const flowJsonRel = `specs/${specId}/flow.json`;
    targetFm.updateStepStatus("finalize-cleanup", "done", {
      specId,
      operationOwnerToken: ctx.repositoryOperationOwnerToken,
    });

    // (ii) stage + commit. Stage flow.json plus issue-log if present so audit
    // entries written by --force / CHERRY_PICK_CONFLICT during the same run
    // become atomically persisted (R14).
    const commitPaths = finalizeChangedFilePaths(targetRoot, transaction.beforeImages[0]);
    if (!commitPaths.includes(flowJsonRel)) {
      throw new Error("finalize flow state mutation is absent from the prepared tree diff");
    }
    try {
      callerIndexLease = acquireFinalizeCallerIndexLease(transactionStore, transaction, targetRoot);
      tempIndexWorkspace = acquireFinalizeTempIndexWorkspace(transactionStore, transaction, targetRoot);
    } catch (error) {
      if (
        error.code === "FINALIZE_INDEX_RECONCILIATION_BUSY"
        && transaction.indexLockAuthority?.dev === null
      ) {
        transaction.clearIndexLock();
      }
      if (
        error.code === "FINALIZE_TEMP_INDEX_BUSY"
        && transaction.tempIndexAuthority?.dev === null
      ) {
        transaction.clearTempIndexWorkspace();
      }
      return failBeforeCommit(Envelope.fail(
        "run",
        "finalize-cleanup",
        error.code || "FINALIZE_INDEX_AUTHORITY_FAILED",
        error.message,
        { lockPath: error.lockPath || null },
      ), error);
    }
    const commitMsg = `chore: finalize ${specId}`;
    const commitExpectation = buildCommitExpectation({
      transaction,
      targetRoot,
      state,
      commitMessage: commitMsg,
      commitPaths,
      workspace: tempIndexWorkspace,
      worktreePath: worktree && mainRepoPath ? (worktreePath || ctx.root) : null,
    });
    transaction.expectCommit(commitExpectation);
    transactionStore.write(transaction);
    assertCommitExpectationFresh(transaction.commitExpectation, {
      targetRoot,
      state,
      commitMessage: commitMsg,
      commitPaths,
      workspace: tempIndexWorkspace,
      worktreePath: worktree && mainRepoPath ? (worktreePath || ctx.root) : null,
    });
    const isolatedCommit = runIsolatedFinalizeCommit({
      targetRoot,
      expectedParent: commitExpectation.expectedParent,
      commitMessage: commitMsg,
      commitPaths,
      workspace: tempIndexWorkspace,
    });
    if (isolatedCommit.stage === "read-tree" && !isolatedCommit.result.ok) {
      const primary = gitFailure(
        "FINALIZE_TREE_BUILD_FAILED",
        "isolated finalize read-tree failed",
        isolatedCommit.result,
      );
      if (isolatedCommit.cleanupErrors.length > 0) throw isolatedIndexFailure(primary, isolatedCommit);
      return failBeforeCommit(Envelope.fail("run", "finalize-cleanup", primary.code, primary.message), primary);
    }
    if (isolatedCommit.stage === "add" && !isolatedCommit.result.ok) {
      const primary = gitFailure("FINALIZE_GIT_ADD_FAILED", "isolated finalize git add failed", isolatedCommit.result);
      if (isolatedCommit.cleanupErrors.length > 0) throw isolatedIndexFailure(primary, isolatedCommit);
      return failBeforeCommit(Envelope.fail("run", "finalize-cleanup", primary.code, primary.message), primary);
    }
    if (isolatedCommit.stage === "write-tree" && !isolatedCommit.result.ok) {
      const primary = gitFailure(
        "FINALIZE_TREE_BUILD_FAILED",
        "isolated finalize write-tree failed",
        isolatedCommit.result,
      );
      if (isolatedCommit.cleanupErrors.length > 0) throw isolatedIndexFailure(primary, isolatedCommit);
      return failBeforeCommit(Envelope.fail("run", "finalize-cleanup", primary.code, primary.message), primary);
    }
    const commitRes = isolatedCommit.result;
    if (!commitRes.ok) {
      const recovery = inspectExpectedCommit(transaction.commitExpectation, { targetRoot, state });
      if (recovery.adopted) {
        transaction.advance("commit-durable", { commitSha: recovery.head });
        transaction.clearBeforeImages();
        transactionStore.write(transaction);
      } else {
        const primary = gitFailure("COMMIT_FAILED", "git commit failed", commitRes);
        if (isolatedCommit.cleanupErrors.length > 0) throw isolatedIndexFailure(primary, isolatedCommit);
        return failBeforeCommit(Envelope.fail("run", "finalize-cleanup", "COMMIT_FAILED", [
          primary.message,
        ]), primary);
      }
    } else {
      const committed = inspectExpectedCommit(transaction.commitExpectation, { targetRoot, state });
      if (!committed.adopted) {
        const primary = new Error("finalize commit durability could not be confirmed");
        primary.code = "COMMIT_DURABILITY_UNCONFIRMED";
        transaction.fail("COMMIT_DURABILITY_UNCONFIRMED");
        transactionStore.write(transaction);
        return failBeforeCommit(Envelope.fail("run", "finalize-cleanup", "COMMIT_DURABILITY_UNCONFIRMED", [
          "Finalize commit returned success but repository HEAD did not advance.",
        ]), primary);
      }
      transaction.advance("commit-durable", { commitSha: committed.head });
      transaction.clearBeforeImages();
      transactionStore.write(transaction);
    }
    try {
      throwIsolatedIndexCleanup(isolatedCommit);
    } catch (error) {
      callerIndexLease.detach();
      callerIndexLease = null;
      throw error;
    }
    } catch (error) {
      if (error.finalizeRestoreAttempted === true) throw error;
      if (!transaction.phase.atLeast("commit-durable") && transaction.beforeImages.length > 0) {
        try {
          cleanupFinalizePreparedAuthorities(transactionStore, transaction, targetRoot, {
            callerIndexLease,
            tempIndexWorkspace,
          });
          callerIndexLease = null;
          tempIndexWorkspace = null;
          restorePreparedFinalize(
            transactionStore,
            transaction,
            targetRoot,
            targetFm,
            specId,
            state,
            ctx.repositoryOperationOwnerToken,
          );
        } catch (restoreError) {
          throw new AggregateError(
            [error, restoreError],
            "finalize pre-commit operation and exact restoration both failed",
            { cause: error },
          );
        }
      }
      throw error;
    }
  }

  if (transaction.phase.atLeast("commit-durable") && !transaction.phase.atLeast("index-reconciled")) {
    try {
      if (callerIndexLease == null) {
        callerIndexLease = acquireFinalizeCallerIndexLease(transactionStore, transaction, targetRoot);
      }
      if (tempIndexWorkspace == null) {
        tempIndexWorkspace = acquireFinalizeTempIndexWorkspace(transactionStore, transaction, targetRoot);
      }
      const publication = prepareFinalizeCallerIndexReconciliation(
        transaction.commitExpectation,
        tempIndexWorkspace,
      );
      if (publication == null) {
        callerIndexLease.release();
      } else {
        const publicationSource = tempIndexWorkspace.preparePublication(
          publication.bytes,
          publication.mode,
          transaction.indexLockAuthority,
        );
        if (transaction.indexLockAuthority.publishPhase === "marker") {
          transaction.authorizeIndexPublication(
            publication.bytes,
            publication.mode,
            publicationSource.stat,
          );
          transactionStore.write(transaction);
          callerIndexLease.authorizePublication(transaction.indexLockAuthority);
          publicationSource.assertAuthority(
            transaction.indexLockAuthority,
            publication.bytes,
            publication.mode,
          );
        }
        publication.publish(callerIndexLease, publicationSource);
      }
      callerIndexLease = null;
      tempIndexWorkspace.cleanup();
      tempIndexWorkspace = null;
    } catch (error) {
      callerIndexLease?.detach();
      callerIndexLease = null;
      return failAfterCommit(Envelope.fail(
        "run",
        "finalize-cleanup",
        error.code || "FINALIZE_INDEX_RECONCILIATION_FAILED",
        error.message,
        { lockPath: error.lockPath || null },
      ));
    }
    transaction.clearIndexLock();
    transaction.clearTempIndexWorkspace();
    transaction.advance("index-reconciled", { commitSha: transaction.result.commitSha });
    transactionStore.write(transaction);
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
      ctx.flowManager.clearFlowState(specId, {
        operationOwnerToken: ctx.repositoryOperationOwnerToken,
      });
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
export function syncMetadataFromWorktreeToMain(worktreeRoot, mainRoot, specId, operationOwnerToken = null) {
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
  }, { specId, operationOwnerToken });
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
  const { baseline, featureBranch, baseBranch } = opts;
  const droppedCommits = opts.droppedCommits || [];
  const droppedCount = opts.droppedCount ?? droppedCommits.length;
  const droppedTruncated = opts.droppedTruncated ?? false;
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
    return teardown;
  }

  return teardown;
}

export default RunFinalizeCleanupCommand;
