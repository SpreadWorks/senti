import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import {
  checkRetryBelowMax,
  checkNoProgressSinceLastFail,
  findPreviousFailState,
  assertNoRepeatedFail,
  countGateRetry,
  updateGateRetryCounter,
  appendIssueLogFromGateResult,
  buildFailedEvaluations,
  computeGitState,
} from "../../../src/flow/lib/run-gate.js";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// spec 228: plan phase gate guards
// ---------------------------------------------------------------------------

// REQ-1: retry counter for plan phase
describe("REQ-1: retry counter applies to plan phase (draft/spec)", () => {
  it("countGateRetry counts entries for phase 'draft'", () => {
    const entries = [
      { phase: "draft", counter: "gateRetry", delta: 1 },
      { phase: "draft", counter: "gateRetry", delta: 1 },
      { phase: "task-impl", counter: "gateRetry", delta: 1 },
    ];
    assert.equal(countGateRetry(entries, "draft"), 2);
  });

  it("countGateRetry counts entries for phase 'spec'", () => {
    const entries = [
      { phase: "spec", counter: "gateRetry", delta: 1 },
      { phase: "draft", counter: "gateRetry", delta: 1 },
    ];
    assert.equal(countGateRetry(entries, "spec"), 1);
  });

  it("checkRetryBelowMax returns escalation envelope for draft phase at max", () => {
    const ctx = {
      flowState: {
        spec: "specs/001/spec.json",
        metrics: [
          { phase: "draft", counter: "gateRetry", delta: 1 },
          { phase: "draft", counter: "gateRetry", delta: 1 },
          { phase: "draft", counter: "gateRetry", delta: 1 },
        ],
      },
      config: { flow: { retry: { max: 3 } } },
      root: "/tmp/nonexistent",
    };
    const result = checkRetryBelowMax(ctx, "draft");
    assert.ok(result, "should return escalation envelope");
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "ESCALATE_RETRY_EXHAUSTED");
  });

  it("checkRetryBelowMax returns null for draft phase below max", () => {
    const ctx = {
      flowState: {
        metrics: [
          { phase: "draft", counter: "gateRetry", delta: 1 },
        ],
      },
      config: { flow: { retry: { max: 3 } } },
    };
    assert.equal(checkRetryBelowMax(ctx, "draft"), null);
  });

  it("checkRetryBelowMax returns escalation envelope for spec phase at max", () => {
    const ctx = {
      flowState: {
        spec: "specs/001/spec.json",
        metrics: [
          { phase: "spec", counter: "gateRetry", delta: 1 },
          { phase: "spec", counter: "gateRetry", delta: 1 },
          { phase: "spec", counter: "gateRetry", delta: 1 },
        ],
      },
      config: { flow: { retry: { max: 3 } } },
      root: "/tmp/nonexistent",
    };
    const result = checkRetryBelowMax(ctx, "spec");
    assert.ok(result);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "ESCALATE_RETRY_EXHAUSTED");
  });
});

// REQ-2: no-progress guard for plan phase
describe("REQ-2: no-progress guard applies to plan phase", () => {
  it("findPreviousFailState returns state for draft phase", () => {
    const flowState = { metrics: [{ phase: "draft", counter: "gateRetry", delta: 1 }] };
    const issueLog = {
      entries: [
        { step: "gate-draft", phase: "draft", reason: "fail", headSha: "aaa", worktreeHash: "111" },
      ],
    };
    const res = findPreviousFailState({ flowState, issueLog, phase: "draft" });
    assert.deepEqual(res, { headSha: "aaa", worktreeHash: "111" });
  });

  it("checkNoProgressSinceLastFail rejects unchanged state for draft phase", () => {
    const flowState = { metrics: [{ phase: "draft", counter: "gateRetry", delta: 1 }] };
    const issueLog = {
      entries: [
        { step: "gate-draft", phase: "draft", reason: "prev fail reason for draft", headSha: "aaa", worktreeHash: "111" },
      ],
    };
    const result = checkNoProgressSinceLastFail({
      flowState, issueLog, phase: "draft",
      currentState: { headSha: "aaa", worktreeHash: "111" },
    });
    assert.ok(result);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "NO_PROGRESS_SINCE_LAST_FAIL");
  });

  it("checkNoProgressSinceLastFail allows changed state for spec phase", () => {
    const flowState = { metrics: [{ phase: "spec", counter: "gateRetry", delta: 1 }] };
    const issueLog = {
      entries: [
        { step: "gate", phase: "spec", reason: "spec fail", headSha: "aaa", worktreeHash: "111" },
      ],
    };
    const result = checkNoProgressSinceLastFail({
      flowState, issueLog, phase: "spec",
      currentState: { headSha: "aaa", worktreeHash: "222" },
    });
    assert.equal(result, null);
  });
});

// REQ-3: repeated-fail detection for plan phase
describe("REQ-3: repeated-fail detection for plan phase", () => {
  it("assertNoRepeatedFail throws for draft phase with matching (guardrail, reason)", () => {
    const issueLog = {
      entries: [
        {
          step: "gate-draft", phase: "draft",
          failedEvaluations: [{ guardrail_id: "g-scope", reason: "scope too broad" }],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g-scope", result: "fail", reason: "Scope Too Broad" },
    ];
    assert.throws(
      () => assertNoRepeatedFail({ issueLog, phase: "draft", currentEvaluations }),
      (err) => err.code === "ESCALATE_REPEATED_FAIL",
    );
  });

  it("assertNoRepeatedFail does not throw for spec phase with different reason", () => {
    const issueLog = {
      entries: [
        {
          step: "gate", phase: "spec",
          failedEvaluations: [{ guardrail_id: "g1", reason: "reason A" }],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g1", result: "fail", reason: "reason B" },
    ];
    assertNoRepeatedFail({ issueLog, phase: "spec", currentEvaluations });
  });
});

// REQ-4: passedGuardrails recording
describe("REQ-4: passedGuardrails in issue-log", () => {
  it("appendIssueLogFromGateResult includes passedGuardrails field", () => {
    const tmp = createTmpDir();
    try {
      const specDir = path.join(tmp, "specs/001-test");
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, "spec.json"), "{}");

      const ctx = {
        root: tmp,
        phase: "draft",
        flowState: { spec: "specs/001-test/spec.json" },
        gitState: { headSha: "h", worktreeHash: "w" },
      };
      const result = {
        result: "fail",
        artifacts: {
          phase: "draft",
          level: "parent",
          evaluations: [
            { guardrail_id: "g-pass-1", result: "pass", reason: "ok" },
            { guardrail_id: "g-fail-1", result: "fail", reason: "bad" },
            { guardrail_id: "g-pass-2", result: "pass", reason: "fine" },
            { guardrail_id: "g-skip-1", result: "skip", reason: "n/a" },
          ],
          issues: [],
        },
      };

      appendIssueLogFromGateResult(ctx, result);

      const log = JSON.parse(fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"));
      const entry = log.entries[0];
      assert.ok(Array.isArray(entry.passedGuardrails), "passedGuardrails should be an array");
      assert.deepEqual(entry.passedGuardrails, ["g-pass-1", "g-pass-2"]);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("passedGuardrails is empty array when no PASS evaluations", () => {
    const tmp = createTmpDir();
    try {
      const specDir = path.join(tmp, "specs/001-test");
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, "spec.json"), "{}");

      const ctx = {
        root: tmp,
        phase: "draft",
        flowState: { spec: "specs/001-test/spec.json" },
        gitState: { headSha: "h", worktreeHash: "w" },
      };
      const result = {
        result: "fail",
        artifacts: {
          phase: "draft", level: "parent",
          evaluations: [
            { guardrail_id: "g1", result: "fail", reason: "bad" },
          ],
          issues: [],
        },
      };

      appendIssueLogFromGateResult(ctx, result);

      const log = JSON.parse(fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"));
      assert.deepEqual(log.entries[0].passedGuardrails, []);
    } finally {
      removeTmpDir(tmp);
    }
  });
});

// REQ-7: gate-impl/integration behavior unchanged
describe("REQ-7: gate-impl/integration existing behavior preserved", () => {
  it("checkRetryBelowMax still works for task-impl", () => {
    const ctx = {
      flowState: {
        spec: "specs/001/spec.json",
        metrics: [
          { phase: "task-impl", counter: "gateRetry", delta: 1 },
          { phase: "task-impl", counter: "gateRetry", delta: 1 },
          { phase: "task-impl", counter: "gateRetry", delta: 1 },
        ],
      },
      config: { flow: { retry: { max: 3 } } },
      root: "/tmp/nonexistent",
    };
    const result = checkRetryBelowMax(ctx, "task-impl");
    assert.ok(result);
    assert.equal(result.errors[0].code, "ESCALATE_RETRY_EXHAUSTED");
  });

  it("assertNoRepeatedFail still works for task-impl", () => {
    const issueLog = {
      entries: [
        {
          step: "gate-impl", phase: "task-impl",
          failedEvaluations: [{ guardrail_id: "g", reason: "same" }],
        },
      ],
    };
    assert.throws(
      () => assertNoRepeatedFail({
        issueLog, phase: "task-impl",
        currentEvaluations: [{ guardrail_id: "g", result: "fail", reason: "same" }],
      }),
      (err) => err.code === "ESCALATE_REPEATED_FAIL",
    );
  });

  it("checkNoProgressSinceLastFail still works for integration", () => {
    const flowState = { metrics: [{ phase: "integration", counter: "gateRetry", delta: 1 }] };
    const issueLog = {
      entries: [
        { step: "gate-impl", phase: "integration", reason: "fail", headSha: "a", worktreeHash: "1" },
      ],
    };
    const result = checkNoProgressSinceLastFail({
      flowState, issueLog, phase: "integration",
      currentState: { headSha: "a", worktreeHash: "1" },
    });
    assert.ok(result);
    assert.equal(result.errors[0].code, "NO_PROGRESS_SINCE_LAST_FAIL");
  });
});
