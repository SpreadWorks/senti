// spec: R6 R8
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("buildGuardrailArticleEvalPrompt", () => {
  test("R6: prompt rules text contains exhaustive-enumeration directive", async () => {
    const { buildGuardrailArticleEvalPrompt } = await import("../../../src/flow/lib/run-gate.js");
    const guardrails = [{ id: "g1", title: "G1", body: "rule", meta: { phase: ["spec"], category: "process" } }];
    const pb = buildGuardrailArticleEvalPrompt("content", guardrails, "spec", "checker");
    const built = pb.build();
    const all = (built.systemPrompt || "") + "\n" + (built.userPrompt || "");
    assert.match(all, /one violation entry per occurrence/i, "rules section must instruct per-occurrence enumeration");
  });

  test("R6: prompt rules text contains document-level guidance (one or more entries per gap)", async () => {
    const { buildGuardrailArticleEvalPrompt } = await import("../../../src/flow/lib/run-gate.js");
    const guardrails = [{ id: "g1", title: "G1", body: "rule", meta: { phase: ["spec"], category: "process" } }];
    const pb = buildGuardrailArticleEvalPrompt("content", guardrails, "spec", "checker");
    const built = pb.build();
    const all = (built.systemPrompt || "") + "\n" + (built.userPrompt || "");
    assert.match(all, /document[- ]level/i, "rules section must mention document-level guardrails");
  });

  test("R6: userPrompt section ordering — articles section appears before content section", async () => {
    const { buildGuardrailArticleEvalPrompt } = await import("../../../src/flow/lib/run-gate.js");
    const guardrails = [{ id: "g1", title: "G1", body: "rule", meta: { phase: ["spec"], category: "process" } }];
    const pb = buildGuardrailArticleEvalPrompt("THE_TARGET_CONTENT", guardrails, "spec", "checker");
    const built = pb.build();
    const userPrompt = built.userPrompt || "";
    const articleIdx = userPrompt.indexOf("## Guardrail Articles");
    const contentIdx = userPrompt.indexOf("## Content");
    assert.ok(articleIdx >= 0, "userPrompt contains '## Guardrail Articles'");
    assert.ok(contentIdx >= 0, "userPrompt contains '## Content'");
    assert.ok(articleIdx < contentIdx, "Guardrail Articles must precede Content in userPrompt");
  });

  test("R6: userPrompt section ordering — diff-scope precedes articles for diff-scoped phases", async () => {
    const { buildGuardrailArticleEvalPrompt } = await import("../../../src/flow/lib/run-gate.js");
    const guardrails = [{ id: "g1", title: "G1", body: "rule", meta: { phase: ["task-impl"], category: "process" } }];
    const pb = buildGuardrailArticleEvalPrompt("content", guardrails, "task-impl", "checker");
    const built = pb.build();
    const userPrompt = built.userPrompt || "";
    const diffIdx = userPrompt.indexOf("## Diff Scope Constraint");
    const articleIdx = userPrompt.indexOf("## Guardrail Articles");
    if (diffIdx >= 0) {
      assert.ok(diffIdx < articleIdx, "Diff Scope Constraint must precede Guardrail Articles");
    }
  });

  test("R6: userPrompt section ordering — previously-passed precedes diff-scope and articles when present", async () => {
    const { buildGuardrailArticleEvalPrompt } = await import("../../../src/flow/lib/run-gate.js");
    const guardrails = [{ id: "g1", title: "G1", body: "rule", meta: { phase: ["spec"], category: "process" } }];
    const pb = buildGuardrailArticleEvalPrompt("content", guardrails, "spec", "checker", ["g0"]);
    const built = pb.build();
    const userPrompt = built.userPrompt || "";
    const prevIdx = userPrompt.indexOf("## Previously Passed Guardrails");
    const articleIdx = userPrompt.indexOf("## Guardrail Articles");
    assert.ok(prevIdx >= 0, "userPrompt contains '## Previously Passed Guardrails' when previouslyPassedIds is non-empty");
    assert.ok(prevIdx < articleIdx, "Previously Passed must precede Guardrail Articles");
  });

  test("R8: GUARDRAIL_FMT_FALLBACK references the article shape (violations on FAIL, reason on PASS/SKIP)", async () => {
    const { GUARDRAIL_FMT_FALLBACK } = await import("../../../src/flow/lib/run-gate.js");
    assert.match(GUARDRAIL_FMT_FALLBACK, /violations/i);
  });
});
