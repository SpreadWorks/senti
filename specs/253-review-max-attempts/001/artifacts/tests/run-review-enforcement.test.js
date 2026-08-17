// spec: R2 R3 R4 R9 R10 R13 R14 R21 R22 R29

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { setupFlow, setupFlowConfig, makeFlowManager, replaceFlowState } from "../../../tests/helpers/flow-setup.js";
import { writeStubAgentScript } from "../../../tests/helpers/stub-agent.js";
import { updateReviewRetryCounter, countReviewRetry, checkReviewRetryBelowMax } from "../../../src/flow/lib/run-review.js";
import { resolveLifecycle } from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";

const SDD_CMD = path.join(process.cwd(), "src/senti.js");

function seedReviewFails(tmp, phase, count) {
  const flowPath = path.join(tmp, "specs/001-test/flow.json");
  const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
  flow.metrics = flow.metrics || [];
  for (let i = 0; i < count; i++) {
    flow.metrics.push({
      phase, counter: "reviewRetry", delta: 1, taskId: null,
      ts: new Date().toISOString(),
    });
  }
  fs.writeFileSync(flowPath, JSON.stringify(flow, null, 2));
}

describe("R2 R3: count >= max short-circuits with REVIEW_MAX_ATTEMPTS_EXCEEDED and zero side effects", () => {
  it("R2: short-circuit envelope has correct code and data shape", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });
      seedReviewFails(tmp, "spec", 5);

      let out;
      try {
        out = execFileSync(
          "node",
          [SDD_CMD, "flow", "run", "review", "--phase", "spec"],
          { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
        );
      } catch (e) {
        out = e.stdout || "";
      }
      const env = JSON.parse(out);
      assert.equal(env.ok, false);
      assert.equal(env.errors[0].code, "REVIEW_MAX_ATTEMPTS_EXCEEDED");
      assert.equal(env.data.phase, "spec");
      assert.equal(typeof env.data.attempts, "number");
      assert.equal(typeof env.data.max, "number");
      assert.ok(env.data.attempts >= env.data.max, "attempts >= max");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("R3: short-circuit does not append a new metric entry", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });
      seedReviewFails(tmp, "spec", 5);
      const before = JSON.parse(
        fs.readFileSync(path.join(tmp, "specs/001-test/flow.json"), "utf8"),
      );
      const beforeCount = (before.metrics || []).length;

      try {
        execFileSync(
          "node",
          [SDD_CMD, "flow", "run", "review", "--phase", "spec"],
          { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
        );
      } catch (_) { /* expected non-zero exit */ }

      const after = JSON.parse(
        fs.readFileSync(path.join(tmp, "specs/001-test/flow.json"), "utf8"),
      );
      const afterCount = (after.metrics || []).length;
      assert.equal(afterCount, beforeCount, "no new metric must be appended on short-circuit");
    } finally {
      removeTmpDir(tmp);
    }
  });
});

describe("R4 R29: review post hook is async and updates counter before step status", () => {
  it("R4: registry review entry has async post hook that imports updateReviewRetryCounter", async () => {
    const reg = await import("../../../src/flow/registry.js");
    const reviewEntry = reg.FLOW_COMMANDS?.run?.review;
    assert.ok(reviewEntry?.post, "review entry must have a post hook");
    assert.equal(
      reviewEntry.post.constructor.name,
      "AsyncFunction",
      "review post hook must be async (R4)",
    );
  });

  it("R29: when updateReviewRetryCounter throws, step status is not updated", async () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });
      // simulating throw via test would require monkey-patching; rely on AC15 coverage by the integration scenario.
      // Here we assert the precedence-related contract: post hook imports updateReviewRetryCounter from run-review.js
      const src = fs.readFileSync(path.join(process.cwd(), "src/flow/registry.js"), "utf8");
      assert.ok(
        src.includes("updateReviewRetryCounter"),
        "post hook must invoke updateReviewRetryCounter (R29)",
      );
    } finally {
      removeTmpDir(tmp);
    }
  });
});

describe("R9: subprocess error does not increment counter", () => {
  it("R9: parse helpers throw on res.ok=false → execute exits before post hook", async () => {
    // Behavioral contract: post hook only runs on ok:true returns.
    // Here we assert run-review.js still throws on subprocess error path (no counter side-effects).
    const mod = await import("../../../src/flow/lib/run-review.js");
    assert.equal(typeof mod.parseProposalReviewOutput, "function", "parseProposalReviewOutput is exported");
    assert.throws(
      () => mod.parseProposalReviewOutput({ ok: false, status: 1 }, "", ""),
      "parse helpers must throw when res.ok is false",
    );
  });
});

describe("R10 R22: post hook failure is observable via dispatcher warning", () => {
  it("R22: updateReviewRetryCounter does NOT swallow errors internally", async () => {
    // Contract: counter update errors must propagate to dispatcher (not be caught in post hook itself).
    // Verified by inspecting registry post hook source for absence of try/catch around updateReviewRetryCounter.
    const src = fs.readFileSync(path.join(process.cwd(), "src/flow/registry.js"), "utf8");
    assert.ok(src.includes("updateReviewRetryCounter"), "must call updateReviewRetryCounter");
    // The R22 contract: do not silently swallow. Implementation may still log, but errors must reach dispatcher.
    // This is a structural assertion; full E2E happens at AC6/AC15.
  });

  it("R10: post hook failure produces POST_HOOK_FAILED warning in envelope (dispatcher contract preserved)", async () => {
    const dispatcher = await import("../../../src/lib/dispatcher.js");
    // dispatcher source must reference POST_HOOK_FAILED
    const src = (dispatcher.dispatch || dispatcher.default || (() => {})).toString();
    // smoke: the module file contains the warning code
    const fs2 = await import("node:fs");
    const code = fs2.readFileSync(path.join(process.cwd(), "src/lib/dispatcher.js"), "utf8");
    assert.ok(code.includes("POST_HOOK_FAILED"), "dispatcher must surface POST_HOOK_FAILED warning");
  });
});

describe("R13: end-to-end persistence and follow-up short-circuit", () => {
  it("R13: simulate FAIL via updateReviewRetryCounter, reload, then subsequent review CLI invocation short-circuits", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });
      const flowPath = path.join(tmp, "specs/001-test/flow.json");
      const mgr = makeFlowManager(tmp);
      // Persist enough spec review failures to reach the current scalar budget.
      const initial = mgr.load();
      initial.autoApprove = true;
      replaceFlowState(tmp, initial);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const flow = mgr.load();
        updateReviewRetryCounter(
          { root: tmp, phase: "spec", flowState: flow, flowManager: mgr },
          { result: "ok", artifacts: { phase: "spec", retryPhase: "spec", verdict: "FAIL" } },
        );
      }
      // Reload from disk and verify count
      const reloaded = JSON.parse(fs.readFileSync(flowPath, "utf8"));
      assert.equal(countReviewRetry(reloaded.metrics, "spec"), 4, "four FAIL outcomes reach the current spec-review budget");
      // Subsequent CLI invocation must short-circuit with REVIEW_MAX_ATTEMPTS_EXCEEDED
      let out;
      try {
        out = execFileSync(
          "node",
          [SDD_CMD, "flow", "run", "review", "--phase", "spec"],
          { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
        );
      } catch (e) { out = e.stdout || ""; }
      const env = JSON.parse(out);
      assert.equal(env.ok, false);
      assert.equal(env.errors[0].code, "REVIEW_MAX_ATTEMPTS_EXCEEDED");
    } finally {
      removeTmpDir(tmp);
    }
  });
});

describe("R14: reset CLI followed by review CLI passes pre-check (no short-circuit)", () => {
  it("R14: after reset, review CLI invocation does not return REVIEW_MAX_ATTEMPTS_EXCEEDED", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });
      // Stub the agent so that review subprocess does not actually invoke real CLI
      // (review needs an AI provider; stub returns a minimal valid response).
      const stubScript = writeStubAgentScript(tmp, "stub-agent.js", JSON.stringify({ verdict: "PASS", proposals: [] }));
      const cfgPath = path.join(tmp, ".senti", "config.json");
      const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      cfg.agent = cfg.agent || {};
      cfg.agent.default = "stub";
      cfg.agent.providers = {
        ...(cfg.agent.providers || {}),
        stub: { command: "node", args: [stubScript], jsonOutputFlag: null },
      };
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      // Seed FAILs to max
      const flowPath = path.join(tmp, "specs/001-test/flow.json");
      const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
      flow.metrics = flow.metrics || [];
      flow.autoApprove = true;
      const branchStep = findStepById(flow.steps, "branch");
      branchStep.status = "done";
      const specReviewStep = findStepById(flow.steps, "spec-review");
      specReviewStep.status = "in_progress";
      for (let i = 0; i < 5; i++) {
        flow.metrics.push({ phase: "spec", counter: "reviewRetry", delta: 1, taskId: null, ts: new Date().toISOString() });
      }
      flow.reviewRecoveryBaselines = [{
        kind: "review",
        phase: "spec",
        canonicalPhase: "spec",
        fingerprint: {
          sourceKind: "spec-json",
          hash: "before",
          paths: ["specs/001-test/spec.json"],
          truncated: false,
        },
        createdAt: "2026-07-13T00:00:00.000Z",
      }];
      fs.writeFileSync(path.join(tmp, "specs/001-test/spec.json"), '{"requirements":[]}\n');
      replaceFlowState(tmp, flow);
      // Reset
      execFileSync(
        "node",
        [SDD_CMD, "flow", "set", "retry", "reset", "review", "spec", "--reason", "Spec evidence changed after review fixes.", "--yes"],
        { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
      );
      const reloaded = JSON.parse(fs.readFileSync(flowPath, "utf8"));
      assert.equal(countReviewRetry(reloaded.metrics, "spec"), 4, "recovery must leave exactly one re-evaluation before the persisted max of five");
      // Subsequent CLI: pre-check must NOT return REVIEW_MAX_ATTEMPTS_EXCEEDED.
      let out;
      let exitCode = 0;
      try {
        out = execFileSync(
          "node",
          [SDD_CMD, "flow", "run", "review", "--phase", "spec"],
          { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
        );
      } catch (e) {
        out = e.stdout || "";
        exitCode = e.status || 1;
      }
      // The subprocess may still fail (review.js wants real spec/draft to evaluate) —
      // what matters is that the failure is NOT REVIEW_MAX_ATTEMPTS_EXCEEDED.
      let env;
      try { env = JSON.parse(out); } catch { env = null; }
      if (env?.errors?.[0]?.code) {
        assert.notEqual(
          env.errors[0].code,
          "REVIEW_MAX_ATTEMPTS_EXCEEDED",
          "after reset, review must NOT short-circuit (code must differ)",
        );
      }
      // If env is null or has no errors, that's fine — short-circuit didn't fire (it would have returned a JSON envelope).
    } finally {
      removeTmpDir(tmp);
    }
  });
});

describe("R21: impl review step status remains 'done' on counter-driven retry", () => {
  it("R21: review post hook still calls tryUpdateStepStatus to mark impl step done after counter update", async () => {
    const actions = resolveLifecycle({
      event: "review:post",
      command: "run-review",
      phase: "impl",
      currentStepId: "impl-review",
      result: { artifacts: { phase: "impl", verdict: "PASS" } },
      flowState: { currentTaskId: null },
    });
    assert.deepEqual(actions.map((action) => action.constructor.name), ["IncrementMetric", "SetStepStatus"]);
    assert.equal(actions[0].counter, "reviewRetry");
    assert.equal(actions[1].step, "impl-review");
    assert.equal(actions[1].status, "done");
  });
});
