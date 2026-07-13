import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { makeFlowManager, makeFlowState } from "../../helpers/flow-setup.js";
import {
  applyRetryReset,
  buildCurrentRecoveryFingerprint,
  persistRecoveryBaseline,
} from "../../../src/flow/lib/retry-recovery.js";

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
});
