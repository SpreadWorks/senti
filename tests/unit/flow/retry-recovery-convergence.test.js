import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { makeFlowManager, makeFlowState } from "../../helpers/flow-setup.js";
import {
  applyRetryReset,
  buildStateRetryRecoveryView,
  buildCurrentRecoveryFingerprint,
  persistRecoveryBaseline,
  resolveRecoveryMaxAttempts,
} from "../../../src/flow/lib/retry-recovery.js";
import {
  ReviewRecoveryIdentity,
  ReviewSemanticRecoveryMutation,
  ReviewToolingRecoveryMutation,
} from "../../../src/flow/lib/review-convergence.js";
import { checkReviewRetryBelowMax } from "../../../src/flow/lib/run-review.js";
import GetStatusCommand from "../../../src/flow/lib/get-status.js";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import { resolveGateRecoveryDisplayPhase } from "../../../src/flow/lib/gate-recovery-display.js";
import {
  ExternalBlockedOutcome,
  StepAttempt,
} from "../../../src/flow/lib/step-outcome.js";

function setOnlyInProgress(state, targetId) {
  const visit = (steps) => {
    for (const step of steps || []) {
      if (step.status === "in_progress") step.status = "pending";
      if (step.id === targetId) step.status = "in_progress";
      visit(step.children);
    }
  };
  visit(state.steps);
}

function setupInterruptedRecovery(root, specId) {
  const spec = `specs/${specId}/spec.json`;
  const specDir = path.join(root, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), '{"revision":1}\n');
  const state = makeFlowState({
    spec,
    runId: `run-${specId}`,
    featureBranch: `feature/${specId}`,
    metrics: [{ phase: "spec", counter: "reviewRetry", delta: 1, taskId: null }],
  });
  setOnlyInProgress(state, "spec-review");
  const baseline = buildCurrentRecoveryFingerprint({
    root,
    flowState: state,
    kind: "review",
    canonicalPhase: "spec",
    baseline: null,
  });
  persistRecoveryBaseline(state, {
    kind: "review",
    phase: "spec",
    fingerprint: baseline,
    createdAt: "2026-07-13T00:00:00.000Z",
  });
  const baseFlowManager = makeFlowManager(root);
  baseFlowManager.create(state);
  const flowManager = baseFlowManager.forRoot(root, { specId });
  fs.writeFileSync(path.join(specDir, "spec.json"), '{"revision":2}\n');
  const input = {
    root,
    spec,
    flowManager,
    resolveConfiguredMaxAttempts: () => 1,
    input: {
      action: "reset",
      kind: "review",
      phase: "spec",
      reason: "candidate8 recovery convergence evidence changed",
      yes: true,
    },
    expectedAttempts: 1,
    expectedMaxAttempts: 1,
    expectedRunId: state.runId,
    expectedHasIssue: false,
    createdAt: "2026-07-13T00:01:00.000Z",
  };
  assert.throws(
    () => applyRetryReset({
      ...input,
      recoveryFaultInjector({ phase }) {
        if (phase === "after-flow-commit") throw new Error("simulated process crash after flow commit");
      },
    }),
    /simulated process crash/,
  );
  const privatePath = path.join(specDir, ".retry-recovery.transaction.json");
  const publicPath = path.join(specDir, "retry-recovery.json");
  const issuePath = path.join(specDir, "issue-log.json");
  const flowPath = path.join(specDir, "flow.json");
  const transaction = JSON.parse(fs.readFileSync(privatePath, "utf8")).transaction;
  assert.equal(transaction.status, "pending");
  assert.equal(JSON.parse(fs.readFileSync(flowPath, "utf8")).retryRecovery.entries.length, 1);
  return { input, transaction, privatePath, publicPath, issuePath, flowPath, specDir };
}

function snapshot(paths) {
  return new Map(paths.map((filePath) => {
    if (!fs.existsSync(filePath)) return [filePath, null];
    const stat = fs.statSync(filePath);
    return [filePath, { bytes: fs.readFileSync(filePath), mode: stat.mode & 0o777 }];
  }));
}

function assertSnapshot(before) {
  for (const [filePath, expected] of before) {
    assert.equal(fs.existsSync(filePath), expected != null, filePath);
    if (!expected) continue;
    assert.deepEqual(fs.readFileSync(filePath), expected.bytes, filePath);
    assert.equal(fs.statSync(filePath).mode & 0o777, expected.mode, filePath);
  }
}

function auditEntry(grant) {
  return {
    step: "retry-recovery",
    grantId: grant.id,
    ...structuredClone(grant),
    timestamp: grant.createdAt,
    issueLogId: grant.id,
  };
}

describe("retry recovery authority convergence", () => {
  const roots = [];
  afterEach(() => {
    for (const root of roots.splice(0)) removeTmpDir(root);
  });

  it("uses the active flow gate phase instead of an exhausted task phase", () => {
    const root = createTmpDir("retry-convergence-active-gate-");
    roots.push(root);
    fs.mkdirSync(path.join(root, "specs", "active-gate"), { recursive: true });
    fs.writeFileSync(path.join(root, "specs", "active-gate", "spec.json"), "{}\n");
    const flowState = makeFlowState({
      spec: "specs/active-gate/spec.json",
      metrics: Array.from({ length: 5 }, () => ({
        phase: "task-impl",
        counter: "gateRetry",
        delta: 1,
      })),
    });
    setOnlyInProgress(flowState, "impl-gate");

    const display = resolveGateRecoveryDisplayPhase({
      root,
      flowState,
      stepId: "impl-gate",
      maxAttempts: 5,
    });

    assert.equal(display.phase, "integration");
    assert.equal(display.attempts, 0);
    assert.equal(display.max, 5);
  });

  it("returns a granted spec gate retry to normal Flow execution", async () => {
    const root = createTmpDir("retry-convergence-spec-gate-");
    roots.push(root);
    const spec = "specs/spec-gate/spec.json";
    const specDir = path.join(root, path.dirname(spec));
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(root, spec), '{"revision":1}\n');
    const state = makeFlowState({
      spec,
      runId: "run-spec-gate",
      metrics: [{ phase: "spec", counter: "gateRetry", delta: 1 }],
      stepAttempts: [new StepAttempt({
        runId: "run-spec-gate",
        stepId: "spec-gate",
        attempt: 1,
        outcome: new ExternalBlockedOutcome({
          reason: "missing_repair_evidence",
          resumeInstruction: "Repair the evidence and retry the gate.",
        }),
        recordedAt: "2020-01-01T00:00:00.000Z",
      }).toJSON()],
    });
    setOnlyInProgress(state, "spec-gate");
    const baseline = buildCurrentRecoveryFingerprint({
      root,
      flowState: state,
      kind: "gate",
      canonicalPhase: "spec",
      baseline: null,
    });
    persistRecoveryBaseline(state, {
      kind: "gate",
      phase: "spec",
      fingerprint: baseline,
      createdAt: "2026-07-27T00:00:00.000Z",
    });
    const flowManager = makeFlowManager(root);
    flowManager.create(state);
    fs.writeFileSync(path.join(root, spec), '{"revision":2}\n');

    applyRetryReset({
      root,
      spec,
      flowManager,
      input: {
        action: "reset",
        kind: "gate",
        phase: "spec",
        reason: "The spec gate evidence changed after the recorded failure.",
        yes: true,
      },
      expectedAttempts: 1,
      expectedMaxAttempts: 1,
      expectedRunId: state.runId,
      expectedHasIssue: false,
      createdAt: "2026-07-27T00:01:00.000Z",
      resolveConfiguredMaxAttempts: () => 1,
    });

    const recovered = flowManager.load();
    assert.equal(buildStateRetryRecoveryView({
      root,
      flowState: recovered,
      kind: "gate",
      phase: "spec",
      attempts: 0,
      max: 1,
    }), null);

    const next = await new GetNextActionCommand().execute({
      root,
      flowState: recovered,
      flowManager,
    });
    assert.equal(next.directive.kind, "execute_step");
    assert.equal(next.directive.action, "run-gate");
    assert.equal(next.stepAttempt, undefined);
  });

  it("commits a changed-tree review grant and tooling reset in one flow mutation", () => {
    const root = createTmpDir("retry-convergence-review-tooling-");
    roots.push(root);
    const spec = "specs/review-tooling/spec.json";
    const specDir = path.join(root, path.dirname(spec));
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(root, spec), '{"revision":1}\n');
    const previousTreeSha = "1".repeat(40);
    const nextTreeSha = "2".repeat(40);
    const state = makeFlowState({
      spec,
      runId: "run-review-tooling",
      metrics: [{ phase: "spec", counter: "reviewRetry", delta: 1, taskId: null }],
      reviewConvergence: {
        version: 1,
        records: [{
          phase: "spec",
          taskId: null,
          treeSha: previousTreeSha,
          semanticAttempts: 2,
          semanticMaxAttempts: 4,
          toolingAttempts: 1,
          toolingMaxAttempts: 1,
          evidence: null,
          finalizedEvidenceAvailable: false,
          handoffFindings: [],
          blocker: {
            kind: "tooling_attempts_exhausted",
            reason: "review provider failed",
          },
          toolingOutcome: {
            kind: "TOOLING_ERROR",
            stage: "communication",
            attempt: 2,
            maxAttempts: 2,
            remainingAttempts: 0,
            reason: "review provider failed",
            permissionRelated: false,
          },
          provider: "independent-reviewer",
          targetStateDigest: "3".repeat(64),
        }],
      },
    });
    setOnlyInProgress(state, "spec-review");
    const baseline = buildCurrentRecoveryFingerprint({
      root,
      flowState: state,
      kind: "review",
      canonicalPhase: "spec",
      baseline: null,
    });
    persistRecoveryBaseline(state, {
      kind: "review",
      phase: "spec",
      fingerprint: baseline,
      createdAt: "2026-07-24T00:00:00.000Z",
    });
    const flowManager = makeFlowManager(root);
    flowManager.create(state);
    fs.writeFileSync(path.join(root, spec), '{"revision":2}\n');

    applyRetryReset({
      root,
      spec,
      flowManager,
      input: {
        action: "reset",
        kind: "review",
        phase: "spec",
        reason: "changed review evidence",
        yes: true,
      },
      expectedAttempts: 1,
      expectedMaxAttempts: 1,
      expectedRunId: state.runId,
      expectedHasIssue: false,
      createdAt: "2026-07-24T00:01:00.000Z",
      resolveConfiguredMaxAttempts: () => 1,
      afterReset(flowState) {
        new ReviewToolingRecoveryMutation({
          phase: "spec",
          taskId: null,
          previousTreeSha,
          nextTreeSha,
          expectedRunId: state.runId,
          expectedSpec: spec,
        }).apply(flowState);
      },
    });

    const recovered = flowManager.load();
    assert.equal(recovered.retryRecovery.entries.length, 1);
    assert.equal(recovered.reviewConvergence.records.length, 1);
    assert.equal(recovered.reviewConvergence.records[0].treeSha, nextTreeSha);
    assert.equal(recovered.reviewConvergence.records[0].toolingAttempts, 0);
    assert.equal(recovered.reviewConvergence.records[0].toolingMaxAttempts, 1);
    assert.equal(recovered.reviewConvergence.records[0].semanticAttempts, 2);
    assert.equal(recovered.reviewConvergence.records[0].provider, "independent-reviewer");
  });

  it("commits a changed-tree review grant and semantic reset in one flow mutation", () => {
    const root = createTmpDir("retry-convergence-review-semantic-");
    roots.push(root);
    const spec = "specs/review-semantic/spec.json";
    const specDir = path.join(root, path.dirname(spec));
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(root, spec), '{"revision":1}\n');
    const previousTreeSha = "4".repeat(40);
    const nextTreeSha = "5".repeat(40);
    const state = makeFlowState({
      spec,
      runId: "run-review-semantic",
      metrics: [{ phase: "spec", counter: "reviewRetry", delta: 1, taskId: null }],
      reviewConvergence: {
        version: 1,
        records: [{
          phase: "spec",
          taskId: null,
          treeSha: previousTreeSha,
          semanticAttempts: 1,
          semanticMaxAttempts: 1,
          toolingAttempts: 0,
          toolingMaxAttempts: 1,
          evidence: { evidenceId: "6".repeat(64), disposition: "REJECTED" },
          finalizedEvidenceAvailable: true,
          handoffFindings: [],
          blocker: null,
          toolingOutcome: null,
          provider: "independent-reviewer",
          targetStateDigest: "7".repeat(64),
        }],
      },
    });
    setOnlyInProgress(state, "spec-review");
    const baseline = buildCurrentRecoveryFingerprint({
      root,
      flowState: state,
      kind: "review",
      canonicalPhase: "spec",
      baseline: null,
    });
    persistRecoveryBaseline(state, {
      kind: "review",
      phase: "spec",
      fingerprint: baseline,
      createdAt: "2026-07-24T00:00:00.000Z",
    });
    const flowManager = makeFlowManager(root);
    flowManager.create(state);
    fs.writeFileSync(path.join(root, spec), '{"revision":2}\n');

    applyRetryReset({
      root,
      spec,
      flowManager,
      input: {
        action: "reset",
        kind: "review",
        phase: "spec",
        reason: "changed review evidence",
        yes: true,
      },
      expectedAttempts: 1,
      expectedMaxAttempts: 1,
      expectedRunId: state.runId,
      expectedHasIssue: false,
      createdAt: "2026-07-24T00:01:00.000Z",
      resolveConfiguredMaxAttempts: () => 1,
      afterReset(flowState) {
        new ReviewSemanticRecoveryMutation({
          phase: "spec",
          taskId: null,
          previousTreeSha,
          nextTreeSha,
          expectedRunId: state.runId,
          expectedSpec: spec,
        }).apply(flowState);
      },
    });

    const recovered = flowManager.load().reviewConvergence.records[0];
    assert.equal(recovered.treeSha, nextTreeSha);
    assert.equal(recovered.semanticAttempts, 0);
    assert.equal(recovered.toolingAttempts, 0);
    assert.equal(recovered.evidence, null);
    assert.equal(recovered.finalizedEvidenceAvailable, false);
    assert.deepEqual(recovered.handoffFindings, []);
    assert.equal(recovered.blocker, null);
    assert.equal(recovered.toolingOutcome, null);
  });

  it("permits semantic retry recovery for a changed target-state identity on the same tree", () => {
    const treeSha = "4".repeat(40);
    const previousTargetStateDigest = "5".repeat(64);
    const nextTargetStateDigest = "6".repeat(64);
    const spec = "specs/review-target-state/spec.json";
    const state = makeFlowState({
      spec,
      runId: "run-review-target-state",
      reviewConvergence: {
        version: 1,
        records: [{
          phase: "spec",
          taskId: null,
          treeSha,
          semanticAttempts: 1,
          semanticMaxAttempts: 1,
          toolingAttempts: 0,
          toolingMaxAttempts: 1,
          evidence: { evidenceId: "7".repeat(64), disposition: "REJECTED" },
          finalizedEvidenceAvailable: true,
          handoffFindings: [],
          blocker: null,
          toolingOutcome: null,
          targetStateDigest: previousTargetStateDigest,
        }],
      },
    });

    assert.equal(
      new ReviewRecoveryIdentity({ treeSha, targetStateDigest: nextTargetStateDigest }).changedFrom(
        new ReviewRecoveryIdentity({ treeSha, targetStateDigest: previousTargetStateDigest }),
      ),
      true,
    );

    new ReviewSemanticRecoveryMutation({
      phase: "spec",
      taskId: null,
      previousTreeSha: treeSha,
      nextTreeSha: treeSha,
      previousTargetStateDigest,
      nextTargetStateDigest,
      expectedRunId: state.runId,
      expectedSpec: spec,
    }).apply(state);

    const recovered = state.reviewConvergence.records[0];
    assert.equal(recovered.treeSha, treeSha);
    assert.equal(recovered.targetStateDigest, nextTargetStateDigest);
    assert.equal(recovered.semanticAttempts, 0);
    assert.equal(recovered.finalizedEvidenceAvailable, false);
  });

  it("keeps dispatch invocation id out of review recovery identity comparison", () => {
    const treeSha = "9".repeat(40);
    const targetStateDigest = "a".repeat(64);
    const targetBindingDigest = "b".repeat(64);

    assert.equal(
      new ReviewRecoveryIdentity({
        treeSha,
        targetStateDigest,
        targetBindingDigest,
        dispatchInvocationId: "next-dispatch",
      }).changedFrom(new ReviewRecoveryIdentity({
        treeSha,
        targetStateDigest,
        targetBindingDigest,
        dispatchInvocationId: "previous-dispatch",
      })),
      false,
    );
  });

  it("recovers an exhausted rejected review after result recording lost its evidence reference", () => {
    const state = makeFlowState({
      spec: "specs/review-tooling/spec.json",
      runId: "run-review-tooling",
      reviewConvergence: {
        version: 1,
        records: [{
          phase: "spec",
          taskId: null,
          treeSha: "8".repeat(40),
          semanticAttempts: 1,
          semanticMaxAttempts: 1,
          toolingAttempts: 1,
          toolingMaxAttempts: 1,
          evidence: null,
          finalizedEvidenceAvailable: false,
          handoffFindings: [],
          blocker: { kind: "tooling_attempts_exhausted", reason: "result recording failed" },
          toolingOutcome: {
            stage: "result_recording",
            attempt: 2,
            maxAttempts: 2,
            reason: "review semantic attempt budget is exhausted for this target",
            permissionRelated: false,
          },
          evidenceIdentity: { evidenceDigest: "9".repeat(64) },
        }],
      },
    });

    new ReviewSemanticRecoveryMutation({
      phase: "spec",
      taskId: null,
      previousTreeSha: "8".repeat(40),
      nextTreeSha: "a".repeat(40),
      expectedRunId: state.runId,
      expectedSpec: state.spec,
    }).apply(state);

    const recovered = state.reviewConvergence.records[0];
    assert.equal(recovered.treeSha, "a".repeat(40));
    assert.equal(recovered.semanticAttempts, 0);
    assert.equal(recovered.toolingAttempts, 0);
    assert.equal(recovered.evidence, null);
    assert.equal(recovered.blocker, null);
  });

  it("grants one retry when prior rejected evidence belongs to a newer review tree", () => {
    const state = makeFlowState({
      spec: "specs/review-new-tree/spec.json",
      runId: "run-review-new-tree",
      reviewConvergence: {
        version: 1,
        records: [{
          phase: "impl",
          taskId: null,
          treeSha: "b".repeat(64),
          semanticAttempts: 1,
          semanticMaxAttempts: 4,
          toolingAttempts: 0,
          toolingMaxAttempts: 1,
          evidence: { evidenceId: "c".repeat(64), disposition: "REJECTED" },
          finalizedEvidenceAvailable: true,
          handoffFindings: [],
          blocker: null,
          toolingOutcome: null,
        }],
      },
    });

    new ReviewSemanticRecoveryMutation({
      phase: "impl",
      taskId: null,
      previousTreeSha: "b".repeat(64),
      nextTreeSha: "d".repeat(64),
      expectedRunId: state.runId,
      expectedSpec: state.spec,
    }).apply(state);

    const recovered = state.reviewConvergence.records[0];
    assert.equal(recovered.treeSha, "d".repeat(64));
    assert.equal(recovered.semanticAttempts, 3);
    assert.equal(recovered.evidence, null);
  });

  for (const scenario of ["flow-payload", "flow-duplicate", "public-payload", "issue-payload"]) {
    it(`rejects ${scenario} before any mutation`, () => {
      const root = createTmpDir(`retry-convergence-${scenario}-`);
      roots.push(root);
      const fixture = setupInterruptedRecovery(root, `441-${scenario}`);
      const grant = fixture.transaction.grant;
      const originalFlow = fs.readFileSync(fixture.flowPath);
      if (scenario.startsWith("flow-")) {
        const flow = JSON.parse(originalFlow);
        if (scenario === "flow-payload") flow.retryRecovery.entries[0].reason = `${grant.reason} divergent`;
        else flow.retryRecovery.entries.push(structuredClone(flow.retryRecovery.entries[0]));
        fs.writeFileSync(fixture.flowPath, `${JSON.stringify(flow, null, 2)}\n`);
      } else if (scenario === "public-payload") {
        fs.writeFileSync(fixture.publicPath, `${JSON.stringify({
          version: 1,
          entries: [{ ...grant, reason: `${grant.reason} divergent` }],
        }, null, 2)}\n`);
      } else {
        const divergent = auditEntry(grant);
        divergent.reason = `${grant.reason} divergent`;
        fs.writeFileSync(fixture.issuePath, `${JSON.stringify({ entries: [divergent] }, null, 2)}\n`);
      }
      const before = snapshot([fixture.privatePath, fixture.publicPath, fixture.flowPath, fixture.issuePath]);

      assert.throws(() => applyRetryReset(fixture.input), /diverg|duplicate|converg|payload|authority/i, scenario);

      assertSnapshot(before);
      assert.equal(fs.existsSync(path.join(fixture.specDir, ".retry-recovery.lock")), false, scenario);
      assert.equal(fs.existsSync(path.join(root, ".senti", ".repository-flow-operation.lock")), false, scenario);

      fs.writeFileSync(fixture.flowPath, originalFlow);
      fs.rmSync(fixture.publicPath, { force: true });
      fs.rmSync(fixture.issuePath, { force: true });
      const resumed = applyRetryReset(fixture.input);
      assert.equal(resumed.grant.id, grant.id, scenario);
      assert.equal(JSON.parse(fs.readFileSync(fixture.privatePath, "utf8")).transaction, null, scenario);
      const flowEntries = JSON.parse(fs.readFileSync(fixture.flowPath, "utf8")).retryRecovery.entries;
      const publicEntries = JSON.parse(fs.readFileSync(fixture.publicPath, "utf8")).entries;
      const issueEntries = JSON.parse(fs.readFileSync(fixture.issuePath, "utf8")).entries;
      assert.equal(flowEntries.filter((entry) => entry.id === grant.id).length, 1, scenario);
      assert.equal(publicEntries.filter((entry) => entry.id === grant.id).length, 1, scenario);
      assert.equal(issueEntries.filter((entry) => entry.grantId === grant.id).length, 1, scenario);
      assert.deepEqual(flowEntries[0], grant, scenario);
      assert.deepEqual(publicEntries[0], grant, scenario);
      assert.deepEqual(issueEntries[0], auditEntry(grant), scenario);
    });
  }

  const foreignPendingSurfaces = new Map([
    ["resolved budget", ({ root, flowState }) => resolveRecoveryMaxAttempts({
      root,
      flowState,
      kind: "review",
      phase: "spec",
      attempts: 0,
      resolvedMax: 3,
    })],
    ["state view", ({ root, flowState }) => buildStateRetryRecoveryView({
      root,
      flowState,
      kind: "review",
      phase: "spec",
      attempts: 0,
      max: 3,
    })],
    ["review pre-check", ({ root, flowState, flowManager }) => checkReviewRetryBelowMax({
      root,
      flowState,
      flowManager,
    }, "spec")],
    ["status", ({ root, flowState, flowManager }) => new GetStatusCommand().execute({
      root,
      flowState,
      flowManager,
      details: true,
    })],
    ["next action", ({ root, flowState, flowManager }) => new GetNextActionCommand().execute({
      root,
      flowState,
      flowManager,
    })],
    ["gate display", ({ root, flowState }) => resolveGateRecoveryDisplayPhase({
      root,
      flowState,
      stepId: "spec-gate",
      maxAttempts: 3,
    })],
  ]);

  for (const [surface, invoke] of foreignPendingSurfaces) {
    it(`rejects a foreign pending request before ${surface} authority use`, async () => {
      const root = createTmpDir(`retry-convergence-foreign-${surface.replace(/\s+/g, "-")}-`);
      roots.push(root);
      const fixture = setupInterruptedRecovery(root, `441-foreign-${surface.replace(/\s+/g, "-")}`);
      const nextRunId = `${fixture.transaction.request.runId}-replacement`;
      const flowState = JSON.parse(fs.readFileSync(fixture.flowPath, "utf8"));
      flowState.runId = nextRunId;
      fs.writeFileSync(fixture.flowPath, `${JSON.stringify(flowState, null, 2)}\n`);
      const flowManager = fixture.input.flowManager;
      const before = snapshot([
        fixture.privatePath,
        fixture.publicPath,
        fixture.flowPath,
        fixture.issuePath,
      ]);

      await assert.rejects(
        async () => invoke({ root, flowState, flowManager }),
        (error) => error.code === "RETRY_RECOVERY_FOREIGN_AUTHORITY",
      );

      assertSnapshot(before);
      assert.equal(fs.existsSync(path.join(fixture.specDir, ".retry-recovery.lock")), false);
      assert.equal(fs.existsSync(path.join(root, ".senti", ".repository-flow-operation.lock")), false);
    });
  }

  for (const identityVariant of ["issue", "spec"]) {
    it(`rejects a pending request with foreign ${identityVariant} identity`, () => {
      const root = createTmpDir(`retry-convergence-foreign-${identityVariant}-`);
      roots.push(root);
      const fixture = setupInterruptedRecovery(root, `441-foreign-${identityVariant}`);
      const flowState = JSON.parse(fs.readFileSync(fixture.flowPath, "utf8"));
      if (identityVariant === "issue") {
        flowState.issue = 441;
        fs.writeFileSync(fixture.flowPath, `${JSON.stringify(flowState, null, 2)}\n`);
      } else {
        const foreignDir = path.join(root, "specs", "foreign");
        fs.renameSync(fixture.specDir, foreignDir);
        flowState.spec = "specs/foreign/spec.json";
        fixture.specDir = foreignDir;
        fixture.privatePath = path.join(foreignDir, ".retry-recovery.transaction.json");
        fixture.publicPath = path.join(foreignDir, "retry-recovery.json");
        fixture.flowPath = path.join(foreignDir, "flow.json");
        fixture.issuePath = path.join(foreignDir, "issue-log.json");
        fs.writeFileSync(fixture.flowPath, `${JSON.stringify(flowState, null, 2)}\n`);
      }
      const before = snapshot([
        fixture.privatePath,
        fixture.publicPath,
        fixture.flowPath,
        fixture.issuePath,
      ]);

      assert.throws(
        () => resolveRecoveryMaxAttempts({
          root,
          flowState,
          kind: "review",
          phase: "spec",
          attempts: 0,
          resolvedMax: 3,
        }),
        (error) => error.code === "RETRY_RECOVERY_FOREIGN_AUTHORITY",
      );

      assertSnapshot(before);
    });
  }
});
