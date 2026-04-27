import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import {
  checkRetryBelowMax,
  checkNoProgressSinceLastFail,
} from "../../../src/flow/lib/run-gate.js";

// -----------------------------------------------------------------------------
// spec 216: issue-log entries must be written on the Envelope.fail escalation
// paths (ESCALATE_RETRY_EXHAUSTED / NO_PROGRESS_SINCE_LAST_FAIL) so their
// behavior matches the throw-based ESCALATE_REPEATED_FAIL path.
// -----------------------------------------------------------------------------

function setupCtx(tmp, { phase, metrics, baseBranch = "main" }) {
  const specRel = "specs/0001-test/spec.json";
  const specDir = path.join(tmp, "specs/0001-test");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), "{}");
  return {
    ctx: {
      root: tmp,
      phase,
      config: { flow: { retry: { max: 3 } } },
      flowState: { spec: specRel, baseBranch, metrics: metrics || [] },
    },
    specDir,
  };
}

describe("checkRetryBelowMax — REQ-1: writes issue-log on Envelope.fail", () => {
  const phase = "task-impl";

  it("appends exactly one issue-log entry when budget is exhausted", () => {
    const tmp = createTmpDir();
    try {
      // gate-impl maxAttempts = 5 (from definition.js); supply 5 deltas to exhaust.
      const { ctx, specDir } = setupCtx(tmp, {
        phase,
        metrics: Array.from({ length: 5 }, () => ({ phase, counter: "gateRetry", delta: 1 })),
      });
      const before = ctx.flowState.metrics.filter(
        (m) => m.phase === phase && m.counter === "gateRetry",
      ).reduce((n, m) => n + (m.delta || 0), 0);

      const result = checkRetryBelowMax(ctx, phase);

      assert.ok(result, "expected an Envelope, got null");
      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "ESCALATE_RETRY_EXHAUSTED");

      const log = JSON.parse(
        fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"),
      );
      assert.equal(log.entries.length, 1, "expected exactly one issue-log entry");
      const entry = log.entries[0];

      // REQ-1: reason contains envelope messages content.
      assert.match(entry.reason, /gate retry limit exhausted/);
      // REQ-4: phase matches, step resolved via resolveGateStepId.
      assert.equal(entry.phase, phase);
      assert.equal(entry.step, "gate-impl");

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
      const { ctx, specDir } = setupCtx(tmp, {
        phase,
        metrics: [{ phase, counter: "gateRetry", delta: 1 }],
      });
      const result = checkRetryBelowMax(ctx, phase);
      assert.equal(result, null);
      assert.equal(
        fs.existsSync(path.join(specDir, "issue-log.json")),
        false,
        "issue-log.json should not be created when the gate is allowed to proceed",
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
      const { ctx, specDir } = setupCtx(tmp, {
        phase,
        metrics: [{ phase, counter: "gateRetry", delta: 1 }],
      });

      // Seed an earlier FAIL entry carrying state identifiers so the
      // no-progress guard has something to compare against.
      fs.writeFileSync(
        path.join(specDir, "issue-log.json"),
        JSON.stringify(
          {
            entries: [
              {
                step: "gate-impl",
                phase,
                reason: "prev fail",
                headSha: "aaa",
                worktreeHash: "111",
              },
            ],
          },
          null,
          2,
        ),
      );

      const before = ctx.flowState.metrics.filter(
        (m) => m.phase === phase && m.counter === "gateRetry",
      ).reduce((n, m) => n + (m.delta || 0), 0);

      const issueLog = JSON.parse(
        fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"),
      );
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

      const log = JSON.parse(
        fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"),
      );
      // One seed + one new escalation entry.
      assert.equal(log.entries.length, 2);
      const added = log.entries[log.entries.length - 1];

      // REQ-2: reason contains envelope messages content.
      assert.match(added.reason, /working tree is unchanged/);
      // REQ-4: phase matches, step resolved via resolveGateStepId.
      assert.equal(added.phase, phase);
      assert.equal(added.step, "gate-impl");

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
      const { ctx, specDir } = setupCtx(tmp, {
        phase,
        metrics: [{ phase, counter: "gateRetry", delta: 1 }],
      });
      fs.writeFileSync(
        path.join(specDir, "issue-log.json"),
        JSON.stringify(
          {
            entries: [
              {
                step: "gate-impl",
                phase,
                reason: "prev fail",
                headSha: "aaa",
                worktreeHash: "111",
              },
            ],
          },
          null,
          2,
        ),
      );
      const issueLog = JSON.parse(
        fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"),
      );
      const result = checkNoProgressSinceLastFail({
        flowState: ctx.flowState,
        issueLog,
        phase,
        currentState: { headSha: "bbb", worktreeHash: "222" },
        ctx,
      });
      assert.equal(result, null);

      // Still has the seeded entry, no new entry added.
      const log = JSON.parse(
        fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"),
      );
      assert.equal(log.entries.length, 1);
    } finally {
      removeTmpDir(tmp);
    }
  });
});
