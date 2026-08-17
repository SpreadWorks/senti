/**
 * Spec 209 verification: buildImplCheckPrompt の structured summary 受け取り
 *
 * Verifies:
 * - REQ-7: baseline + head の 2 セクションに structured JSON を挿入
 * - REQ-7: 差集合ルール（"escalate only when head.failed contains id not in baseline.failed"）を prompt に含める
 * - REQ-8: baseline 未記録時は head のみ + warning
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildImplCheckPrompt } from "../../../src/flow/lib/run-gate.js";

describe("spec 209: buildImplCheckPrompt structured summary", () => {
  it("includes both baseline and head summary sections when both present", () => {
    const specText = "## Requirements\n- **REQ-1**";
    const diff = "+++ new code";
    const testEvidence = {
      baseline: {
        exitCode: 1,
        counts: { unit: 10, failed: 1 },
        failed: [{ id: "pre_existing", reason: "known" }],
      },
      summary: {
        exitCode: 1,
        counts: { unit: 11, failed: 2 },
        failed: [
          { id: "pre_existing", reason: "known" },
          { id: "new_break", reason: "spec-induced" },
        ],
      },
    };
    const prompt = buildImplCheckPrompt(specText, diff, testEvidence, ["REQ-1"]);
    assert.match(prompt, /Baseline Test Results/);
    assert.match(prompt, /Head Test Results/);
    assert.match(prompt, /pre_existing/);
    assert.match(prompt, /new_break/);
  });

  it("includes differential rule instruction", () => {
    const testEvidence = {
      baseline: { exitCode: 0, counts: {}, failed: [] },
      summary: { exitCode: 0, counts: {}, failed: [] },
    };
    const prompt = buildImplCheckPrompt("spec", "diff", testEvidence, ["REQ-1"]);
    assert.match(prompt, /head\.failed/i);
    assert.match(prompt, /baseline\.failed/i);
  });

  it("omits baseline section and adds warning when baseline missing", () => {
    const testEvidence = {
      baseline: null,
      summary: {
        exitCode: 1,
        counts: { failed: 2 },
        failed: [{ id: "t1", reason: "r" }],
      },
    };
    const prompt = buildImplCheckPrompt("spec", "diff", testEvidence, ["REQ-1"]);
    assert.doesNotMatch(prompt, /## Baseline Test Results/);
    assert.match(prompt, /## Head Test Results/);
    assert.match(prompt, /baseline not captured/i);
  });

  it("omits both test sections when evidence is null", () => {
    const prompt = buildImplCheckPrompt("spec", "diff", null, ["REQ-1"]);
    assert.doesNotMatch(prompt, /## Baseline Test Results/);
    assert.doesNotMatch(prompt, /## Head Test Results/);
  });
});
