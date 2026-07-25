// spec: R1 R2 R3 R4 R5
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { ActiveFlowRegistry } from "../../../src/lib/active-flow-registry.js";
import { AtomicJsonFile } from "../../../src/lib/atomic-json-file.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { FlowTargetExpectation } from "../../../src/lib/flow-target-guard.js";
import { FlowManager, ParkedFlowIdentity } from "../../../src/lib/flow-manager.js";
import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from "../../../src/lib/worktree-flow-binding.js";
import RunResumeCommand from "../../../src/flow/lib/run-resume.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";

const acceptanceModulePath = path.join(process.cwd(), "src/flow/lib/acceptance-review-artifacts.js");
const repairModulePath = path.join(process.cwd(), "src/flow/lib/impl-repair-artifacts.js");
const targetSpec = "338-active-flow-registry-race";
const otherSpec = "339-independent-active-flow";

async function loadAcceptanceModule() {
  return import(`${pathToFileURL(acceptanceModulePath).href}?t=${Date.now()}`);
}

async function repairFingerprint(root, state) {
  const repair = await import(`${pathToFileURL(repairModulePath).href}?t=${Date.now()}`);
  return repair.buildRepairFingerprint({ root, specPath: state.spec }).hash;
}

function decisionArtifact(repairFingerprint) {
  return {
    version: 2,
    repairFingerprint,
    mechanicalBlockers: [],
    hardBlockers: [],
    requirementJudgments: [{
      requirementId: "R1",
      status: "notVerifiable",
      requestRefs: ["flow.request"],
      requirementRefs: ["spec.json#R1"],
      diffRefs: [],
      repairRefs: ["impl-repair.json#no-repair"],
      testRefs: [],
      missingEvidence: ["A user decision is required before final regression."],
    }],
    deferredFindings: [],
    userDecision: null,
    verdict: "user_decision_required",
  };
}

function acceptanceDecisionState({ specId, runId, issue }) {
  const state = {
    runId,
    issue,
    spec: `specs/${specId}/spec.json`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    worktree: true,
    steps: buildInitialSteps(),
    requirements: ["R1"],
    tasks: [],
    currentTaskId: null,
  };
  prepareAcceptanceDecisionState(state);
  return state;
}

function prepareAcceptanceDecisionState(state) {
  for (const step of state.steps.flatMap((entry) => entry.children || [entry])) step.status = "done";
  findStepById(state.steps, "acceptance-review").status = "in_progress";
  findStepById(state.steps, "acceptance-decision").status = "pending";
  findStepById(state.steps, "final-regression").status = "pending";
}

function createManagedFlow(root, specId, issue) {
  const worktreePath = path.join(root, ".senti", "worktree", `feature-${specId}`);
  fs.mkdirSync(worktreePath, { recursive: true });
  const runId = `run-${specId}`;
  const manager = new FlowManager({ root: worktreePath, mainRoot: root, inWorktree: true, specId });
  const state = acceptanceDecisionState({ specId, runId, issue });
  manager.create(state);
  new WorktreeFlowBindingStore({ worktreePath }).save(new WorktreeFlowIdentity({
    runId,
    issue,
    spec: state.spec,
    worktreePath,
  }));
  const specDir = path.join(worktreePath, "specs", specId);
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
    requirements: [{ id: "R1", priority: "must", desc: "Guard the active-flow registry.", status: "done" }],
  }, null, 2));
  manager.addActiveFlow(specId, "worktree");
  return {
    manager,
    issue,
    root,
    runId,
    spec: state.spec,
    specId,
    worktreePath,
    flowPath: path.join(specDir, "flow.json"),
  };
}

function flowExpectation(flow) {
  return new FlowTargetExpectation({
    expectRunId: flow.runId,
    expectIssue: flow.issue,
    expectSpec: flow.specId,
  });
}

function assertGuardedTargetResolution(flow) {
  const resolved = flow.manager.resolveExplicitFlowTargetForRead(flowExpectation(flow));
  assert.deepEqual(
    { runId: resolved.state.runId, issue: resolved.state.issue, spec: resolved.specId },
    { runId: flow.runId, issue: flow.issue, spec: flow.specId },
  );
  return resolved;
}

function parkedIdentity(flow) {
  return new ParkedFlowIdentity({
    expectRunId: flow.runId,
    expectIssue: flow.issue,
    expectSpec: flow.spec,
  });
}

function registry(root) {
  return new ActiveFlowRegistry({ mainRoot: root });
}

function registryEntries(root) {
  return sortRegistryEntries(registry(root).load());
}

function sortRegistryEntries(entries) {
  return [...entries].sort((left, right) => (
    `${left.spec}\u0000${left.mode}`.localeCompare(`${right.spec}\u0000${right.mode}`)
  ));
}

function sortRegistryIdentityEntries(entries) {
  return [...entries].sort((left, right) => (
    `${left.runId}\u0000${left.issue}\u0000${left.spec}\u0000${left.mode}`
      .localeCompare(`${right.runId}\u0000${right.issue}\u0000${right.spec}\u0000${right.mode}`)
  ));
}

function registryIdentityEntries(...flows) {
  return sortRegistryIdentityEntries(flows.map((flow) => targetIdentity(flow)));
}

function registryDocumentSnapshot(root) {
  const filePath = path.join(root, ".senti", ".active-flow");
  const stat = fs.lstatSync(filePath);
  return {
    bytes: fs.readFileSync(filePath),
    device: stat.dev,
    inode: stat.ino,
  };
}

function fileSnapshot(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
}

function acceptanceDecisionArtifacts(flow) {
  const specDir = path.join(flow.worktreePath, "specs", flow.specId);
  return {
    acceptanceReview: path.join(specDir, "acceptance-review.json"),
    issueLog: path.join(specDir, "issue-log.json"),
  };
}

function injectRegistrySnapshotFailure(code, failAt = 1) {
  const originalSnapshot = ActiveFlowRegistry.prototype.snapshot;
  const restore = () => { ActiveFlowRegistry.prototype.snapshot = originalSnapshot; };
  restore.calls = 0;
  ActiveFlowRegistry.prototype.snapshot = function failedRegistrySnapshot() {
    restore.calls += 1;
    if (restore.calls !== failAt) return originalSnapshot.call(this);
    const error = new Error(`active-flow registry failure: ${code}`);
    error.code = code;
    throw error;
  };
  return restore;
}

function injectRegistryRevisionConflict(flow) {
  const originalSnapshot = ActiveFlowRegistry.prototype.snapshot;
  const restore = () => { ActiveFlowRegistry.prototype.snapshot = originalSnapshot; };
  restore.calls = 0;
  restore.postMutationObserved = false;
  ActiveFlowRegistry.prototype.snapshot = function revisedRegistrySnapshot() {
    restore.calls += 1;
    const snapshot = originalSnapshot.call(this);
    if (restore.calls !== 2) return snapshot;
    restore.postMutationObserved = (
      decisionStep(flow).status === "done"
      && finalRegressionStep(flow).status === "in_progress"
    );
    return { entries: snapshot.entries, revision: `${snapshot.revision}-changed` };
  };
  return restore;
}

function injectIdentityVerificationFailure(flow) {
  const originalResolve = flow.manager.resolveExplicitFlowTargetForRead;
  const restore = () => { flow.manager.resolveExplicitFlowTargetForRead = originalResolve; };
  restore.calls = 0;
  flow.manager.resolveExplicitFlowTargetForRead = (expectation) => {
    restore.calls += 1;
    if (restore.calls < 2) return originalResolve.call(flow.manager, expectation);
    return {
      specId: flow.specId,
      state: { ...flow.manager.load(), runId: "run-foreign" },
    };
  };
  return restore;
}

function observeRegistryMutations(root) {
  const registryPath = path.resolve(root, ".senti", ".active-flow");
  const calls = [];
  const originalRemove = ActiveFlowRegistry.prototype.remove;
  const originalPark = ActiveFlowRegistry.prototype.park;
  const originalWrite = AtomicJsonFile.prototype.write;
  ActiveFlowRegistry.prototype.remove = function observedRemove(...args) {
    calls.push("remove");
    return originalRemove.apply(this, args);
  };
  ActiveFlowRegistry.prototype.park = function observedPark(...args) {
    calls.push("park");
    return originalPark.apply(this, args);
  };
  AtomicJsonFile.prototype.write = function observedWrite(...args) {
    if (this.filePath === registryPath) calls.push("document-replacement");
    return originalWrite.apply(this, args);
  };
  return {
    calls,
    restore() {
      ActiveFlowRegistry.prototype.remove = originalRemove;
      ActiveFlowRegistry.prototype.park = originalPark;
      AtomicJsonFile.prototype.write = originalWrite;
    },
  };
}

function targetIdentity(flow) {
  return { spec: flow.specId, runId: flow.runId, issue: flow.issue, mode: "worktree" };
}

function decisionStep(flow) {
  return findStepById(flow.manager.load().steps, "acceptance-decision");
}

function finalRegressionStep(flow) {
  return findStepById(flow.manager.load().steps, "final-regression");
}

async function setup({ includeOther = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-acceptance-registry-"));
  initializeRepository(root);
  const target = createManagedFlow(root, targetSpec, 461);
  const other = includeOther ? createManagedFlow(root, otherSpec, 462) : null;
  const acceptance = await loadAcceptanceModule();
  await applyDecisionArtifact(acceptance, target);
  return { acceptance, other, root, target };
}

async function applyDecisionArtifact(acceptance, target) {
  let fingerprint = await repairFingerprint(target.worktreePath, target.manager.load());
  try {
    acceptance.applyAcceptanceReviewResult({
      root: target.worktreePath,
      flowManager: target.manager,
      artifact: decisionArtifact(fingerprint),
    });
  } catch (error) {
    if (error.code !== "REPAIR_STATE_MIGRATED") throw error;
    target.manager.mutate((state) => prepareAcceptanceDecisionState(state));
    fingerprint = await repairFingerprint(target.worktreePath, target.manager.load());
    acceptance.applyAcceptanceReviewResult({
      root: target.worktreePath,
      flowManager: target.manager,
      artifact: decisionArtifact(fingerprint),
    });
  }
}

function initializeRepository(root) {
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Senti Test"], { cwd: root, stdio: "ignore" });
  fs.writeFileSync(path.join(root, ".gitkeep"), "\n");
  execFileSync("git", ["add", ".gitkeep"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "Create test baseline"], { cwd: root, stdio: "ignore" });
}

function applyContinue(context) {
  return context.acceptance.applyAcceptanceDecision({
    root: context.target.worktreePath,
    flowManager: context.target.manager,
    choice: "accept_risk_and_continue",
  });
}

function resumeParkedThroughCommand(flow) {
  return new RunResumeCommand().execute({
    parked: true,
    flowManager: flow.manager,
    expectRunId: flow.runId,
    expectIssue: flow.issue,
    expectSpec: flow.spec,
  });
}

function removeContext(context) {
  fs.rmSync(context.root, { recursive: true, force: true });
}

test("R1: acceptance-decision persists only the exact bound worktree flow identity", async () => {
  const context = await setup();
  const targetBefore = fs.readFileSync(context.target.flowPath);
  const otherBefore = fs.readFileSync(context.other.flowPath);
  try {
    const result = applyContinue(context);
    assertGuardedTargetResolution(context.target);

    assert.notDeepEqual(fs.readFileSync(context.target.flowPath), targetBefore);
    assert.deepEqual(fs.readFileSync(context.other.flowPath), otherBefore);
    assert.deepEqual(result.registryVerification.target, targetIdentity(context.target));
    assert.deepEqual(
      sortRegistryIdentityEntries(result.registryVerification.entries),
      registryIdentityEntries(context.target, context.other),
    );
  } finally {
    removeContext(context);
  }
});

test("R2: success preserves registry document identity and cannot remove, park, or replace it", async () => {
  const context = await setup();
  const beforeEntries = registry(context.root).load();
  const beforeDocument = registryDocumentSnapshot(context.root);
  const observer = observeRegistryMutations(context.root);
  try {
    const result = applyContinue(context);

    assert.deepEqual(observer.calls, []);
    assert.deepEqual(registryDocumentSnapshot(context.root), beforeDocument);
    assert.deepEqual(registry(context.root).load(), beforeEntries);
    assert.deepEqual(result.registryVerification.prohibitedOperations, []);
  } finally {
    observer.restore();
    removeContext(context);
  }
});

test("R3: guarded resolution retains identity and only continue advances final regression", async () => {
  const continueContext = await setup();
  let abortContext;
  try {
    const result = applyContinue(continueContext);
    assertGuardedTargetResolution(continueContext.target);

    assert.deepEqual(result.registryVerification.target, targetIdentity(continueContext.target));
    assert.equal(decisionStep(continueContext.target).status, "done");
    assert.equal(finalRegressionStep(continueContext.target).status, "in_progress");

    abortContext = await setup();
    abortContext.acceptance.applyAcceptanceDecision({
      root: abortContext.target.worktreePath,
      flowManager: abortContext.target.manager,
      choice: "abort",
    });
    assert.equal(finalRegressionStep(abortContext.target).status, "pending");
  } finally {
    removeContext(continueContext);
    if (abortContext) removeContext(abortContext);
  }
});

test("R4: every binding and registry failure leaves flow state and pointers unchanged", async () => {
  const cases = [
    ["worktree binding mismatch", (flow) => {
      const originalResolve = flow.manager.resolveExplicitFlowTargetForRead;
      flow.manager.resolveExplicitFlowTargetForRead = () => {
        const error = new Error("worktree binding mismatch");
        error.code = "ACTIVE_FLOW_MISMATCH";
        throw error;
      };
      return () => { flow.manager.resolveExplicitFlowTargetForRead = originalResolve; };
    }, "ACTIVE_FLOW_MISMATCH", null],
    ["registry operation lock failure", () => injectRegistrySnapshotFailure("ACTIVE_FLOW_REGISTRY_BUSY"), "ACTIVE_FLOW_REGISTRY_BUSY", 1],
    ["registry revision conflict", injectRegistryRevisionConflict, "ACTIVE_FLOW_REGISTRY_REVISION_CONFLICT", 2],
    ["registry identity verification failure", injectIdentityVerificationFailure, "ACTIVE_FLOW_TARGET_IDENTITY_MISMATCH", 3],
  ];

  for (const [name, inject, expectedCode, expectedCalls] of cases) {
    const context = await setup();
    const beforeEntries = registry(context.root).load();
    const beforeFlow = fs.readFileSync(context.target.flowPath);
    const paths = acceptanceDecisionArtifacts(context.target);
    const beforeAcceptanceReview = fileSnapshot(paths.acceptanceReview);
    const beforeIssueLog = fileSnapshot(paths.issueLog);
    let restore = () => {};
    let registryFailureBoundary = null;
    try {
      restore = inject(context.target);
      registryFailureBoundary = restore.calls == null ? null : restore;
      assert.throws(
        () => applyContinue(context),
        (error) => error.code === expectedCode,
        name,
      );
      restore();
      restore = () => {};
      if (registryFailureBoundary) assert.equal(registryFailureBoundary.calls, expectedCalls, name);
      if (name === "registry revision conflict") {
        assert.equal(registryFailureBoundary.postMutationObserved, true, name);
      }
      assert.deepEqual(registry(context.root).load(), beforeEntries, name);
      assert.deepEqual(fs.readFileSync(context.target.flowPath), beforeFlow, name);
      assert.deepEqual(fileSnapshot(paths.acceptanceReview), beforeAcceptanceReview, name);
      assert.deepEqual(fileSnapshot(paths.issueLog), beforeIssueLog, name);
      assert.equal(decisionStep(context.target).status, "in_progress", name);
      assert.equal(finalRegressionStep(context.target).status, "pending", name);
    } finally {
      restore();
      removeContext(context);
    }
  }
});

test("R4: issue-log write failure rolls back the acceptance decision transaction", async () => {
  const context = await setup();
  const beforeEntries = registry(context.root).load();
  const beforeFlow = fs.readFileSync(context.target.flowPath);
  const paths = acceptanceDecisionArtifacts(context.target);
  fs.writeFileSync(paths.issueLog, JSON.stringify({
    entries: [{ issueLogId: "preexisting-issue", reason: "Existing audit entry must survive rollback." }],
  }, null, 2) + "\n");
  fs.chmodSync(paths.issueLog, 0o640);
  const beforeAcceptanceReview = fileSnapshot(paths.acceptanceReview);
  const beforeIssueLog = fileSnapshot(paths.issueLog);
  const beforeIssueLogMode = fs.statSync(paths.issueLog).mode & 0o777;
  const appendIssueLog = () => {
    fs.writeFileSync(paths.issueLog, JSON.stringify({ entries: [] }) + "\n");
    fs.chmodSync(paths.issueLog, 0o600);
    throw new Error("issue-log write failed");
  };
  try {
    assert.throws(
      () => context.acceptance.applyAcceptanceDecision({
        root: context.target.worktreePath,
        flowManager: context.target.manager,
        choice: "accept_risk_and_continue",
        appendIssueLog,
      }),
      /issue-log write failed/,
    );
    assert.deepEqual(registry(context.root).load(), beforeEntries);
    assert.deepEqual(fs.readFileSync(context.target.flowPath), beforeFlow);
    assert.deepEqual(fileSnapshot(paths.acceptanceReview), beforeAcceptanceReview);
    assert.deepEqual(fileSnapshot(paths.issueLog), beforeIssueLog);
    assert.equal(fs.statSync(paths.issueLog).mode & 0o777, beforeIssueLogMode);
    assert.equal(decisionStep(context.target).status, "in_progress");
    assert.equal(finalRegressionStep(context.target).status, "pending");
  } finally {
    removeContext(context);
  }
});

test("R5: two-flow, single-flow, and parked-resume regressions preserve exact pointers", async () => {
  const paired = await setup();
  let single;
  try {
    const pairedBefore = registryEntries(paired.root);
    const pairedIdentityBefore = registryIdentityEntries(paired.target, paired.other);
    const pairedResult = applyContinue(paired);
    assert.deepEqual(sortRegistryIdentityEntries(pairedResult.registryVerification.entries), pairedIdentityBefore);
    assert.deepEqual(registryEntries(paired.root), pairedBefore);
    paired.target.manager.parkActiveFlow(parkedIdentity(paired.target));
    assert.deepEqual(registryEntries(paired.root), [{ spec: otherSpec, mode: "worktree" }]);
    resumeParkedThroughCommand(paired.target);
    assert.deepEqual(registryEntries(paired.root), pairedBefore);
    assertGuardedTargetResolution(paired.target);

    single = await setup({ includeOther: false });
    const singleBefore = registryEntries(single.root);
    const singleIdentityBefore = registryIdentityEntries(single.target);
    const singleResult = applyContinue(single);
    assert.deepEqual(sortRegistryIdentityEntries(singleResult.registryVerification.entries), singleIdentityBefore);
    single.target.manager.parkActiveFlow(parkedIdentity(single.target));
    resumeParkedThroughCommand(single.target);
    assert.deepEqual(registryEntries(single.root), singleBefore);
    assertGuardedTargetResolution(single.target);
  } finally {
    removeContext(paired);
    if (single) removeContext(single);
  }
});
