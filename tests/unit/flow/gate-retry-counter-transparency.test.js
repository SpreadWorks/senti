import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, setupFlowConfig } from "../../helpers/flow-setup.js";
import {
  countGateRetry,
  checkRetryBelowMax,
  checkNoProgressSinceLastFail,
} from "../../../src/flow/lib/run-gate.js";

// -----------------------------------------------------------------------------
// spec 228: gate retry counter transparency
// -----------------------------------------------------------------------------

const SENTI_CMD = path.join(process.cwd(), "src/senti.js");

describe("countGateRetry ignores non-gateRetry metric entries (REQ-4)", () => {
  it("does not count issueLog metrics as gateRetry", () => {
    const metrics = [
      { phase: "task-impl", counter: "issueLog", delta: 1 },
      { phase: "task-impl", counter: "issueLog", delta: 1 },
      { phase: "task-impl", counter: "gateRetry", delta: 1 },
    ];
    assert.equal(countGateRetry(metrics, "task-impl"), 1);
  });

  it("returns 0 when only issueLog entries exist", () => {
    const metrics = [
      { phase: "task-impl", counter: "issueLog", delta: 1 },
      { phase: "task-impl", counter: "issueLog", delta: 1 },
    ];
    assert.equal(countGateRetry(metrics, "task-impl"), 0);
  });

  it("does not count docsRead or srcRead as gateRetry", () => {
    const metrics = [
      { phase: "task-impl", counter: "docsRead", delta: 1 },
      { phase: "task-impl", counter: "srcRead", delta: 1 },
      { phase: "task-impl", counter: "question", delta: 1 },
    ];
    assert.equal(countGateRetry(metrics, "task-impl"), 0);
  });
});

describe("issue-log recording does not increment gateRetry (REQ-4)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("flow set issue-log leaves gateRetry count at zero", () => {
    tmp = createTmpDir();
    setupFlowConfig(tmp, "ja");
    setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });

    execFileSync(
      "node",
      [SENTI_CMD, "flow", "set", "issue-log", "--step", "impl-gate",
        "--reason", "fix: some issue that was fixed during implementation"],
      { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
    );

    const flow = JSON.parse(
      fs.readFileSync(path.join(tmp, "specs/001-test/flow.json"), "utf8"),
    );
    const gateRetryEntries = (flow.metrics || [])
      .filter((e) => e.counter === "gateRetry");
    assert.equal(gateRetryEntries.length, 0,
      "flow set issue-log must not create any gateRetry metric entries");
  });
});

describe("pre-rejection does not increment gateRetry (REQ-5)", () => {
  it("checkNoProgressSinceLastFail returns Envelope.fail without touching metrics", () => {
    const flowState = { metrics: [{ phase: "task-impl", counter: "gateRetry", delta: 1 }] };
    const issueLog = {
      entries: [
        { step: "impl-gate", phase: "task-impl", reason: "prev fail",
          headSha: "aaa", worktreeHash: "111" },
      ],
    };
    const result = checkNoProgressSinceLastFail({
      flowState, issueLog, phase: "task-impl",
      currentState: { headSha: "aaa", worktreeHash: "111" },
    });
    assert.ok(result, "expected a rejection envelope");
    assert.equal(result.ok, false);
    const countAfter = countGateRetry(flowState.metrics, "task-impl");
    assert.equal(countAfter, 1,
      "gateRetry count must remain 1 after pre-rejection");
  });

  it("checkRetryBelowMax returns Envelope.fail without incrementing counter", () => {
    const flowState = {
      metrics: [
        { phase: "task-impl", counter: "gateRetry", delta: 1 },
        { phase: "task-impl", counter: "gateRetry", delta: 1 },
        { phase: "task-impl", counter: "gateRetry", delta: 1 },
        { phase: "task-impl", counter: "gateRetry", delta: 1 },
        { phase: "task-impl", counter: "gateRetry", delta: 1 },
      ],
    };
    const ctx = { flowState, config: {}, root: "/tmp", phase: "task-impl" };
    const result = checkRetryBelowMax(ctx, "task-impl");
    assert.ok(result, "expected a rejection envelope");
    assert.equal(result.ok, false);
    const countAfter = countGateRetry(flowState.metrics, "task-impl");
    assert.equal(countAfter, 5,
      "gateRetry count must remain 5 after exhaustion check");
  });
});

describe("warnGateRetryBudget includes breakdown (REQ-1)", () => {
  it("stderr output contains AI-FAIL count in bracket format", async () => {
    const origWrite = process.stderr.write;
    let captured = "";
    process.stderr.write = (s) => { captured += s; };
    try {
      const mod = await import("../../../src/flow/lib/run-gate.js");
      const warnGateRetryBudget = mod.warnGateRetryBudget;
      const ctx = {
        flowState: {
          metrics: [
            { phase: "task-impl", counter: "gateRetry", delta: 1 },
            { phase: "task-impl", counter: "gateRetry", delta: 1 },
          ],
        },
        config: {},
      };
      warnGateRetryBudget(ctx, "task-impl");
      assert.match(captured, /AI-FAIL=2/,
        "warnGateRetryBudget must include AI-FAIL count");
      assert.match(captured, /2\/5/,
        "warnGateRetryBudget must show used/max");
    } finally {
      process.stderr.write = origWrite;
    }
  });
});

describe("checkRetryBelowMax includes breakdown in exhaustion message (REQ-2)", () => {
  it("envelope messages contain counter breakdown", () => {
    const flowState = {
      metrics: [
        { phase: "task-impl", counter: "gateRetry", delta: 1 },
        { phase: "task-impl", counter: "gateRetry", delta: 1 },
        { phase: "task-impl", counter: "gateRetry", delta: 1 },
        { phase: "task-impl", counter: "gateRetry", delta: 1 },
        { phase: "task-impl", counter: "gateRetry", delta: 1 },
      ],
    };
    const ctx = { flowState, config: {}, root: "/tmp", phase: "task-impl" };
    const result = checkRetryBelowMax(ctx, "task-impl");
    assert.ok(result);
    const allMessages = result.errors[0].messages.join("\n");
    assert.match(allMessages, /Counter breakdown.*AI-FAIL=5/i,
      "exhaustion message must include counter breakdown");
  });
});

describe("pre-rejection stderr includes budget-not-consumed hint (REQ-3)", () => {
  it("checkNoProgressSinceLastFail includes budget-not-consumed in stderr", () => {
    const origWrite = process.stderr.write;
    let captured = "";
    process.stderr.write = (s) => { captured += s; };
    try {
      const flowState = { metrics: [{ phase: "task-impl", counter: "gateRetry", delta: 1 }] };
      const issueLog = {
        entries: [
          { step: "impl-gate", phase: "task-impl", reason: "prev fail",
            headSha: "aaa", worktreeHash: "111" },
        ],
      };
      checkNoProgressSinceLastFail({
        flowState, issueLog, phase: "task-impl",
        currentState: { headSha: "aaa", worktreeHash: "111" },
      });
      assert.match(captured, /retry budget not consumed/i,
        "must output budget-not-consumed hint on pre-rejection");
    } finally {
      process.stderr.write = origWrite;
    }
  });

});
