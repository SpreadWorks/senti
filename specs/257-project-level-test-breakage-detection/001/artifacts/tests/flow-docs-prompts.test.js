// spec: R19 R24 R28 R29 R32 R34 R35
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertContains, read } from "./helpers.js";

describe("spec 257: docs, prompts, flow order, resets, and generated rules", () => {
  it("R19: public docs, prompts, schemas, fixtures, and types describe v2 test config/artifacts", () => {
    for (const relPath of [
      "docs/cli_commands.md",
      "docs/ja/cli_commands.md",
      "src/flow/prompts/impl/implement.md",
      "src/flow/prompts/impl/test-execute.md",
      "src/flow/prompts/impl/test-result-review.md",
      "src/flow/schemas/next-action/test-execute.schema.json",
      "src/lib/types.js",
    ]) {
      assertContains(relPath, /test\.command|projectPaths|test-execute-result|test-result-review|version|regression|v2/i, "must describe new v2/test config contract");
    }
  });

  it("R24: flow skill template and implement prompt document hard stops and do not skip gate-impl", () => {
    const skill = read("src/templates/skills/sdd-forge.flow/SKILL.md");
    const implement = read("src/flow/prompts/impl/implement.md");
    assert.match(skill, /docs[- ]scan|analysis|hard stop|prerequisite/i, "skill must document prepare/test prerequisite hard stops");
    assert.match(skill, /test-execute|test-result-review|gate-impl/i, "skill must document post-hook-managed test steps");
    assert.match(implement, /test-only|gate-impl|regression/i, "implement prompt must keep test-only specs on regression gate path");
    assert.doesNotMatch(implement, /gate-impl\s+skipped|set step gate-impl skipped/i, "implement prompt must not skip flow-level gate-impl");
  });

  it("R28: flow definition and impl-confirm guide implementation through test-execute before review/gate", () => {
    const definition = read("src/flow/definition.js");
    const implConfirm = read("src/flow/lib/run-impl-confirm.js");
    assert.match(definition, /test-execute[\s\S]*test-result-review[\s\S]*review[\s\S]*gate-impl[\s\S]*retro/, "impl sequence must include execution, review, gate, retro order");
    assert.match(definition, /maxAttempts|next-action|schema|context/i, "definition must wire attempts, schemas, or contexts");
    assert.match(implConfirm, /test-execute/i, "impl-confirm must point to test-execute after implementation");
    assert.doesNotMatch(implConfirm, /next["']?\s*:\s*["']review["']/, "impl-confirm must not jump directly to review");
  });

  it("R29: impl review changes reset downstream test and gate evidence or force rerun", () => {
    const review = read("src/flow/lib/run-review.js");
    const prompt = read("src/flow/prompts/impl/review.md");
    const gate = read("src/flow/lib/run-gate.js");
    for (const step of ["test-execute", "test-result-review", "gate-impl", "retro"]) {
      assert.match(`${review}\n${prompt}\n${gate}`, new RegExp(step), `downstream step ${step} must be reset or rerun-gated`);
    }
    assert.match(`${review}\n${prompt}\n${gate}`, /stale|rerun|reset|delete/i, "code or prompt must handle stale downstream evidence");
  });

  it("R32: review-applied code changes use one reset owner for downstream artifacts", () => {
    const review = read("src/flow/lib/run-review.js");
    assert.match(review, /review-applied|applied|code changes|changes/i, "review must detect applied code changes");
    assert.match(review, /reset|pending/i, "review must reset downstream steps");
    assert.match(review, /unlink|delete|cleanup|artifact/i, "review reset must delete stale downstream artifacts");
  });

  it("R34: flow-order and next-action tests/fixtures cover the new impl sequence", () => {
    for (const relPath of [
      "specs/251-fix-flow-impl-phase-order/tests/definition-impl-order.test.js",
      "tests/unit/flow/get-next-action.test.js",
    ]) {
      assertContains(relPath, /test-execute|test-result-review|review|gate-impl|retro/i, "existing flow tests must be updated for the new sequence");
    }
  });

  it("R35: generated flow tracking rules exempt post-hook-managed test steps from manual done guidance", () => {
    for (const relPath of [
      "src/templates/partials/flow-tracking.md",
      "src/templates/skills/rules.json",
      "src/templates/skills/sdd-forge.flow/SKILL.md",
    ]) {
      assertContains(relPath, /test-execute|test-result-review|retro/i, "generated rules must mention post-hook-managed test steps");
      assertContains(relPath, /post-hook|manual|set step|prerequisite/i, "generated rules must block manual masking of prerequisite failures");
    }
  });
});
