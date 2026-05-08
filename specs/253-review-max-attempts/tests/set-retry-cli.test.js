// spec: R11 R16 R20 R27

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { setupFlow, setupFlowConfig } from "../../../tests/helpers/flow-setup.js";

const SDD_CMD = path.join(process.cwd(), "src/sdd-forge.js");

function readFlow(tmp) {
  return JSON.parse(fs.readFileSync(path.join(tmp, "specs/001-test/flow.json"), "utf8"));
}

describe("R20: registry exposes 'set retry' (not 'set gate-retry')", () => {
  it("R20: registry.set has 'retry' entry and no 'gate-retry' entry", async () => {
    const reg = await import("../../../src/flow/registry.js");
    const setEntries = reg.FLOW_COMMANDS?.set;
    assert.ok(setEntries.retry, "registry.set.retry must exist (R20)");
    assert.equal(setEntries["gate-retry"], undefined, "registry.set['gate-retry'] must be removed (R20)");
  });
});

describe("R11 R16: new reset CLI works for both kinds", () => {
  it("R16: `flow set retry reset gate task-impl --yes` appends a gate reset entry", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });

      const out = execFileSync(
        "node",
        [SDD_CMD, "flow", "set", "retry", "reset", "gate", "task-impl", "--yes"],
        { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
      );
      const env = JSON.parse(out);
      assert.equal(env.ok, true);

      const flow = readFlow(tmp);
      const gateResets = (flow.metrics || []).filter(
        (e) => e.counter === "gateRetry" && e.reset === true && e.phase === "task-impl",
      );
      assert.equal(gateResets.length, 1, "exactly one gate reset entry");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("R11: `flow set retry reset review draft --yes` appends a review reset entry", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });

      const out = execFileSync(
        "node",
        [SDD_CMD, "flow", "set", "retry", "reset", "review", "draft", "--yes"],
        { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
      );
      const env = JSON.parse(out);
      assert.equal(env.ok, true);

      const flow = readFlow(tmp);
      const reviewResets = (flow.metrics || []).filter(
        (e) => e.counter === "reviewRetry" && e.reset === true && e.phase === "draft",
      );
      assert.equal(reviewResets.length, 1, "exactly one review reset entry");
      assert.equal(reviewResets[0].taskId, null, "appendMetric must set taskId:null");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("R11: short-circuit envelope code differs before and after reset (proving next call would not short-circuit)", async () => {
    // R14: prove that after reset, the next `flow run review --phase X` no
    // longer returns REVIEW_MAX_ATTEMPTS_EXCEEDED. Without invoking AI,
    // we verify the *short-circuit decision* changes: before reset the call
    // returns code=REVIEW_MAX_ATTEMPTS_EXCEEDED; after reset the count is 0
    // (verified via countReviewRetry) so checkReviewRetryBelowMax returns null
    // and execute proceeds to subprocess (covered separately).
    const { checkReviewRetryBelowMax, countReviewRetry } = await import("../../../src/flow/lib/run-review.js");
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });
      const flowPath = path.join(tmp, "specs/001-test/flow.json");
      const flow0 = JSON.parse(fs.readFileSync(flowPath, "utf8"));
      flow0.metrics = flow0.metrics || [];
      flow0.autoApprove = true; // review-draft auto max=1
      for (let i = 0; i < 5; i++) {
        flow0.metrics.push({ phase: "draft", counter: "reviewRetry", delta: 1, taskId: null, ts: new Date().toISOString() });
      }
      fs.writeFileSync(flowPath, JSON.stringify(flow0, null, 2));
      // BEFORE reset: short-circuit fires
      const before = checkReviewRetryBelowMax({ flowState: flow0 }, "draft");
      assert.equal(before?.ok, false, "BEFORE reset: must short-circuit");
      assert.equal(before.errors[0].code, "REVIEW_MAX_ATTEMPTS_EXCEEDED");
      // Reset via CLI
      execFileSync(
        "node",
        [SDD_CMD, "flow", "set", "retry", "reset", "review", "draft", "--yes"],
        { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
      );
      const flow1 = JSON.parse(fs.readFileSync(flowPath, "utf8"));
      // AFTER reset: count=0 → checkReviewRetryBelowMax returns null (no short-circuit)
      assert.equal(countReviewRetry(flow1.metrics, "draft"), 0);
      const after = checkReviewRetryBelowMax({ flowState: flow1 }, "draft");
      assert.equal(after, null, "AFTER reset: checkReviewRetryBelowMax returns null — next review call proceeds to subprocess");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("R11: reset entry zeroes countReviewRetry so the next review call would not short-circuit", async () => {
    // R14 (spec 253): after reset, the next `flow run review --phase X` must
    // not short-circuit. Verifying via countReviewRetry===0 is sufficient
    // because checkReviewRetryBelowMax allows the call when count < max,
    // and the AI subprocess is only blocked by the count >= max condition.
    const { countReviewRetry } = await import("../../../src/flow/lib/run-review.js");
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });
      // Seed 5 FAIL entries, then reset.
      const flowPath = path.join(tmp, "specs/001-test/flow.json");
      const flow0 = JSON.parse(fs.readFileSync(flowPath, "utf8"));
      flow0.metrics = flow0.metrics || [];
      for (let i = 0; i < 5; i++) {
        flow0.metrics.push({ phase: "draft", counter: "reviewRetry", delta: 1, taskId: null, ts: new Date().toISOString() });
      }
      fs.writeFileSync(flowPath, JSON.stringify(flow0, null, 2));
      assert.equal(countReviewRetry(flow0.metrics, "draft"), 5);
      execFileSync(
        "node",
        [SDD_CMD, "flow", "set", "retry", "reset", "review", "draft", "--yes"],
        { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
      );
      const flow1 = JSON.parse(fs.readFileSync(flowPath, "utf8"));
      assert.equal(
        countReviewRetry(flow1.metrics, "draft"),
        0,
        "after reset, countReviewRetry must return 0 — next review will not short-circuit",
      );
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("R27: argument shortage is rejected with INVALID_USAGE", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });

      let out;
      try {
        out = execFileSync(
          "node",
          [SDD_CMD, "flow", "set", "retry", "reset"],
          { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
        );
      } catch (e) { out = e.stdout || ""; }
      const env = JSON.parse(out);
      assert.equal(env.ok, false);
      assert.equal(env.errors[0].code, "INVALID_USAGE");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("R16: missing --yes is rejected with CONFIRMATION_REQUIRED", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });

      let out;
      try {
        out = execFileSync(
          "node",
          [SDD_CMD, "flow", "set", "retry", "reset", "review", "draft"],
          { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
        );
      } catch (e) { out = e.stdout || ""; }
      const env = JSON.parse(out);
      assert.equal(env.ok, false);
      assert.equal(env.errors[0].code, "CONFIRMATION_REQUIRED");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("R20: old form `flow set gate-retry reset task-impl` is rejected", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });

      let out;
      let exitCode = 0;
      try {
        out = execFileSync(
          "node",
          [SDD_CMD, "flow", "set", "gate-retry", "reset", "task-impl", "--yes"],
          { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
        );
      } catch (e) {
        out = e.stdout || "";
        exitCode = e.status || 1;
      }
      assert.notEqual(exitCode, 0, "old form must exit non-zero");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("R20: invalid kind is rejected with INVALID_KIND", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });

      let out;
      try {
        out = execFileSync(
          "node",
          [SDD_CMD, "flow", "set", "retry", "reset", "bogus", "draft", "--yes"],
          { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
        );
      } catch (e) { out = e.stdout || ""; }
      const env = JSON.parse(out);
      assert.equal(env.ok, false);
      assert.equal(env.errors[0].code, "INVALID_KIND");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("R20: invalid action is rejected with INVALID_ACTION", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });

      let out;
      try {
        out = execFileSync(
          "node",
          [SDD_CMD, "flow", "set", "retry", "increment", "review", "draft", "--yes"],
          { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
        );
      } catch (e) { out = e.stdout || ""; }
      const env = JSON.parse(out);
      assert.equal(env.ok, false);
      assert.equal(env.errors[0].code, "INVALID_ACTION");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("R20: invalid phase is rejected with INVALID_PHASE (per kind)", () => {
    const tmp = createTmpDir();
    try {
      setupFlowConfig(tmp, "ja");
      setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });

      let out;
      try {
        out = execFileSync(
          "node",
          [SDD_CMD, "flow", "set", "retry", "reset", "review", "task-impl", "--yes"],
          { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
        );
      } catch (e) { out = e.stdout || ""; }
      const env = JSON.parse(out);
      assert.equal(env.ok, false);
      assert.equal(env.errors[0].code, "INVALID_PHASE");
    } finally {
      removeTmpDir(tmp);
    }
  });
});
