import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../helpers/flow-setup.js";
import {
  checkRetryBelowMax,
  checkNoProgressSinceLastFail,
} from "../../../src/flow/lib/run-gate.js";
import { loadCanonicalIssueLog } from "../../../src/flow/lib/set-issue-log.js";

// -----------------------------------------------------------------------------
// spec 216: issue-log entries must be written on the Envelope.fail escalation
// paths (ESCALATE_RETRY_EXHAUSTED / NO_PROGRESS_SINCE_LAST_FAIL) so their
// behavior matches the throw-based ESCALATE_REPEATED_FAIL path.
// -----------------------------------------------------------------------------

function setupCtx(tmp, { phase, retryCount = 0, issueEntries = [] }) {
  const flowManager = makeFlowManager(tmp);
  const fixture = new CanonicalFlowFixture({
    flowManager,
    specId: "0001-test",
    runId: "run-gate-envelope",
  }).create().registerActive();
  fixture.activate("impl-gate");
  for (let index = 0; index < retryCount; index += 1) {
    flowManager.incrementMetric(phase, "gateRetry", {
      specId: fixture.specId,
      nodeId: "impl-gate",
    });
  }
  for (const [index, entry] of issueEntries.entries()) {
    flowManager.appendIssueLog({
      specId: fixture.specId,
      entry,
      idempotencyKey: `gate-envelope-seed-${index}`,
    });
  }
  const flowState = flowManager.loadReadOnly(fixture.specId);
  return {
    ctx: {
      root: tmp,
      phase,
      config: { flow: { retry: { max: 3 } } },
      flowState,
      flowManager,
      issueLog: loadCanonicalIssueLog(flowManager, flowState, { consumerNodeId: "impl-gate" }),
    },
    flowManager,
    specId: fixture.specId,
  };
}

describe("checkRetryBelowMax — REQ-1: writes issue-log on Envelope.fail", () => {
  const phase = "task-impl";

  it("appends exactly one issue-log entry when budget is exhausted", () => {
    const tmp = createTmpDir();
    try {
      // impl-gate maxAttempts = 5 (from definition.js); supply 5 deltas to exhaust.
      const { ctx, flowManager, specId } = setupCtx(tmp, {
        phase,
        retryCount: 5,
      });
      const before = ctx.flowState.metrics.filter(
        (m) => m.phase === phase && m.counter === "gateRetry",
      ).reduce((n, m) => n + (m.delta || 0), 0);

      const result = checkRetryBelowMax(ctx, phase);

      assert.ok(result, "expected an Envelope, got null");
      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "ESCALATE_RETRY_EXHAUSTED");

      const committed = flowManager.loadReadOnly(specId);
      const log = loadCanonicalIssueLog(flowManager, committed, { consumerNodeId: "impl-gate" });
      assert.equal(log.entries.length, 1, "expected exactly one issue-log entry");
      const entry = log.entries[0];

      // REQ-1: reason contains envelope messages content.
      assert.match(entry.reason, /gate retry limit exhausted/);
      // REQ-4: phase matches, step resolved via resolveGateStepId.
      assert.equal(entry.phase, phase);
      assert.equal(entry.step, "impl-gate");

      // REQ-3: gateRetry counter has not increased (no metric mutation).
      const after = ctx.flowState.metrics.filter(
        (m) => m.phase === phase && m.counter === "gateRetry",
      ).reduce((n, m) => n + (m.delta || 0), 0);
      assert.equal(after, before, "gateRetry delta must not change");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("does not touch issue-log when budget is still available", () => {
    const tmp = createTmpDir();
    try {
      const { ctx, flowManager, specId } = setupCtx(tmp, {
        phase,
        retryCount: 1,
      });
      const result = checkRetryBelowMax(ctx, phase);
      assert.equal(result, null);
      assert.equal(
        flowManager.readArtifact({
          specId,
          logicalKey: "issue.log",
          consumerNodeId: "impl-gate",
          optional: true,
        }),
        null,
        "issue.log should not be cataloged when the gate is allowed to proceed",
      );
    } finally {
      removeTmpDir(tmp);
    }
  });
});

describe("checkNoProgressSinceLastFail — REQ-2: writes issue-log on Envelope.fail", () => {
  const phase = "task-impl";

  it("appends exactly one issue-log entry when working tree is unchanged", () => {
    const tmp = createTmpDir();
    try {
      const { ctx, flowManager, specId } = setupCtx(tmp, {
        phase,
        retryCount: 1,
        issueEntries: [{
          step: "impl-gate",
          phase,
          reason: "previous semantic gate failure",
          headSha: "aaa",
          worktreeHash: "111",
        }],
      });

      const before = ctx.flowState.metrics.filter(
        (m) => m.phase === phase && m.counter === "gateRetry",
      ).reduce((n, m) => n + (m.delta || 0), 0);

      const issueLog = ctx.issueLog;
      const result = checkNoProgressSinceLastFail({
        flowState: ctx.flowState,
        issueLog,
        phase,
        currentState: { headSha: "aaa", worktreeHash: "111" },
        ctx,
      });

      assert.ok(result, "expected an Envelope, got null");
      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "NO_PROGRESS_SINCE_LAST_FAIL");

      const committed = flowManager.loadReadOnly(specId);
      const log = loadCanonicalIssueLog(flowManager, committed, { consumerNodeId: "impl-gate" });
      // One seed + one new escalation entry.
      assert.equal(log.entries.length, 2);
      const added = log.entries[log.entries.length - 1];

      // REQ-2: reason contains envelope messages content.
      assert.match(added.reason, /working tree is unchanged/);
      // REQ-4: phase matches, step resolved via resolveGateStepId.
      assert.equal(added.phase, phase);
      assert.equal(added.step, "impl-gate");

      // REQ-3: gateRetry counter has not increased.
      const after = ctx.flowState.metrics.filter(
        (m) => m.phase === phase && m.counter === "gateRetry",
      ).reduce((n, m) => n + (m.delta || 0), 0);
      assert.equal(after, before, "gateRetry delta must not change");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("does not touch issue-log when the state differs from the previous FAIL", () => {
    const tmp = createTmpDir();
    try {
      const { ctx, flowManager, specId } = setupCtx(tmp, {
        phase,
        retryCount: 1,
        issueEntries: [{
          step: "impl-gate",
          phase,
          reason: "previous semantic gate failure",
          headSha: "aaa",
          worktreeHash: "111",
        }],
      });
      const issueLog = ctx.issueLog;
      const result = checkNoProgressSinceLastFail({
        flowState: ctx.flowState,
        issueLog,
        phase,
        currentState: { headSha: "bbb", worktreeHash: "222" },
        ctx,
      });
      assert.equal(result, null);

      // Still has the seeded entry, no new entry added.
      const committed = flowManager.loadReadOnly(specId);
      const log = loadCanonicalIssueLog(flowManager, committed, { consumerNodeId: "impl-gate" });
      assert.equal(log.entries.length, 1);
    } finally {
      removeTmpDir(tmp);
    }
  });
});
