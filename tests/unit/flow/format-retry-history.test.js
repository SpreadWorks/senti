import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { checkRetryBelowMax } from "../../../src/flow/lib/run-gate.js";

// -----------------------------------------------------------------------------
// spec 224: formatRetryHistory must scope `Previous FAIL reasons` to the
// escalating phase only, excluding entries from other phases, escalation
// self-records, non-gate steps, and phase-less legacy entries.
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

function seedIssueLog(specDir, entries) {
  fs.writeFileSync(
    path.join(specDir, "issue-log.json"),
    JSON.stringify({ entries }, null, 2),
  );
}

/**
 * Build enough gateRetry deltas to exhaust the budget for the given phase.
 * Since spec 236, maxAttempts is sourced from definition.js (impl-gate = 5).
 */
function exhaustedMetrics(phase) {
  return Array.from({ length: 5 }, () => ({ phase, counter: "gateRetry", delta: 1 }));
}

function extractPreviousFailReasons(envelope) {
  const messages = envelope.errors[0].messages;
  const startIdx = messages.findIndex((m) => m === "Previous FAIL reasons:");
  assert.ok(startIdx !== -1, "expected 'Previous FAIL reasons:' marker in envelope messages");
  // history is a single multi-line string on the next line (may be "  (no issue-log entries found)")
  return messages[startIdx + 1];
}

describe("formatRetryHistory (via checkRetryBelowMax) — spec 224", () => {
  it("AC-1: task-impl escalation includes only task-impl FAIL entries, excludes draft entries", () => {
    const tmp = createTmpDir();
    try {
      const phase = "task-impl";
      const { ctx, specDir } = setupCtx(tmp, { phase, metrics: exhaustedMetrics(phase) });

      seedIssueLog(specDir, [
        {
          step: "draft-gate",
          phase: "draft",
          reason: "draft fail B",
          trigger: "gate post hook (auto)",
        },
        {
          step: "impl-gate",
          phase: "task-impl",
          reason: "task-impl fail A",
          trigger: "gate post hook (auto)",
        },
      ]);

      const result = checkRetryBelowMax(ctx, phase);
      assert.ok(result);
      assert.equal(result.errors[0].code, "ESCALATE_RETRY_EXHAUSTED");

      const history = extractPreviousFailReasons(result);
      assert.match(history, /task-impl fail A/);
      assert.doesNotMatch(history, /draft fail B/);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("AC-2: integration escalation includes only integration FAIL entries, excludes task-impl entries", () => {
    const tmp = createTmpDir();
    try {
      const phase = "integration";
      const { ctx, specDir } = setupCtx(tmp, { phase, metrics: exhaustedMetrics(phase) });

      seedIssueLog(specDir, [
        {
          step: "impl-gate",
          phase: "task-impl",
          reason: "taskimpl fail",
          trigger: "gate post hook (auto)",
        },
        {
          step: "impl-gate",
          phase: "integration",
          reason: "integration fail",
          trigger: "gate post hook (auto)",
        },
      ]);

      const result = checkRetryBelowMax(ctx, phase);
      assert.ok(result);

      const history = extractPreviousFailReasons(result);
      assert.match(history, /integration fail/);
      assert.doesNotMatch(history, /taskimpl fail/);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("AC-3: escalation self-records (trigger=onError) are excluded, only normal FAIL entries remain", () => {
    const tmp = createTmpDir();
    try {
      const phase = "task-impl";
      const { ctx, specDir } = setupCtx(tmp, { phase, metrics: exhaustedMetrics(phase) });

      seedIssueLog(specDir, [
        {
          step: "impl-gate",
          phase: "task-impl",
          reason: "normal fail X",
          trigger: "gate post hook (auto)",
        },
        {
          step: "impl-gate",
          phase: "task-impl",
          reason: "escalation self-record Y",
          trigger: "gate onError hook (auto)",
        },
      ]);

      const result = checkRetryBelowMax(ctx, phase);
      assert.ok(result);

      const history = extractPreviousFailReasons(result);
      assert.match(history, /normal fail X/);
      assert.doesNotMatch(history, /escalation self-record Y/);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("AC-4: entries missing the phase field are excluded", () => {
    const tmp = createTmpDir();
    try {
      const phase = "task-impl";
      const { ctx, specDir } = setupCtx(tmp, { phase, metrics: exhaustedMetrics(phase) });

      seedIssueLog(specDir, [
        {
          step: "impl-gate",
          // phase omitted
          reason: "legacy fail no phase",
          trigger: "gate post hook (auto)",
        },
        {
          step: "impl-gate",
          phase: "task-impl",
          reason: "current fail",
          trigger: "gate post hook (auto)",
        },
      ]);

      const result = checkRetryBelowMax(ctx, phase);
      assert.ok(result);

      const history = extractPreviousFailReasons(result);
      assert.match(history, /current fail/);
      assert.doesNotMatch(history, /legacy fail no phase/);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("AC (REQ-5): entries with a non-gate step are excluded", () => {
    const tmp = createTmpDir();
    try {
      const phase = "task-impl";
      const { ctx, specDir } = setupCtx(tmp, { phase, metrics: exhaustedMetrics(phase) });

      seedIssueLog(specDir, [
        {
          step: "finalize",
          phase: "task-impl",
          reason: "non-gate fail should be excluded",
          trigger: "some other hook",
        },
        {
          step: "impl-gate",
          phase: "task-impl",
          reason: "gate fail kept",
          trigger: "gate post hook (auto)",
        },
      ]);

      const result = checkRetryBelowMax(ctx, phase);
      assert.ok(result);

      const history = extractPreviousFailReasons(result);
      assert.match(history, /gate fail kept/);
      assert.doesNotMatch(history, /non-gate fail should be excluded/);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("AC-1 (extra): matching entries are not polluted by other-phase matching steps", () => {
    // Edge case: step='gate' is used by both spec (phase=spec) and task-spec
    // (phase=task-spec). When task-impl escalates, neither 'spec' nor
    // 'task-spec' entries should appear in the history.
    const tmp = createTmpDir();
    try {
      const phase = "task-impl";
      const { ctx, specDir } = setupCtx(tmp, { phase, metrics: exhaustedMetrics(phase) });

      seedIssueLog(specDir, [
        {
          step: "spec-gate",
          phase: "spec",
          reason: "spec phase fail",
          trigger: "gate post hook (auto)",
        },
        {
          step: "spec-gate",
          phase: "task-spec",
          reason: "task-spec phase fail",
          trigger: "gate post hook (auto)",
        },
        {
          step: "impl-gate",
          phase: "task-impl",
          reason: "task-impl real fail",
          trigger: "gate post hook (auto)",
        },
      ]);

      const result = checkRetryBelowMax(ctx, phase);
      assert.ok(result);

      const history = extractPreviousFailReasons(result);
      assert.match(history, /task-impl real fail/);
      assert.doesNotMatch(history, /spec phase fail/);
      assert.doesNotMatch(history, /task-spec phase fail/);
    } finally {
      removeTmpDir(tmp);
    }
  });
});
