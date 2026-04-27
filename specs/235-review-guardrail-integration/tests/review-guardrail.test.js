import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDraftSystemPrompt } from "../../../src/flow/commands/review.js";

describe("buildDraftSystemPrompt guardrail injection (spec 235)", () => {
  it("returns base prompt when called with no arguments", () => {
    const prompt = buildDraftSystemPrompt();
    assert.match(prompt, /code quality reviewer/i);
    assert.match(prompt, /Duplicate code/i);
    assert.doesNotMatch(prompt, /Guardrail/i);
  });

  it("returns base prompt when guardrails array is empty", () => {
    const prompt = buildDraftSystemPrompt([]);
    assert.match(prompt, /code quality reviewer/i);
    assert.doesNotMatch(prompt, /Guardrail/i);
  });

  it("injects guardrail articles when guardrails are provided", () => {
    const guardrails = [
      { id: "bounded-resource-usage", title: "Bounded Resource Usage", body: "Retries shall have explicit upper bounds." },
      { id: "no-silent-errors", title: "No Silent Errors", body: "Empty catch blocks are prohibited." },
    ];
    const prompt = buildDraftSystemPrompt(guardrails);

    assert.match(prompt, /code quality reviewer/i);
    assert.match(prompt, /Duplicate code/i);
    assert.match(prompt, /bounded-resource-usage/);
    assert.match(prompt, /Bounded Resource Usage/);
    assert.match(prompt, /Retries shall have explicit upper bounds/);
    assert.match(prompt, /no-silent-errors/);
    assert.match(prompt, /No Silent Errors/);
    assert.match(prompt, /Empty catch blocks are prohibited/);
  });

  it("preserves base prompt content when guardrails are present", () => {
    const basePrompt = buildDraftSystemPrompt();
    const guardrails = [
      { id: "test-g", title: "Test Guardrail", body: "Test body." },
    ];
    const extendedPrompt = buildDraftSystemPrompt(guardrails);

    assert.ok(extendedPrompt.includes("Duplicate code elimination"));
    assert.ok(extendedPrompt.includes("Naming improvements"));
    assert.ok(extendedPrompt.includes("NO_PROPOSALS"));
    assert.ok(extendedPrompt.length > basePrompt.length);
  });

  it("includes each guardrail id, title, and body in the prompt", () => {
    const guardrails = [
      { id: "g-1", title: "First Rule", body: "Body of first rule." },
      { id: "g-2", title: "Second Rule", body: "Body of second rule." },
      { id: "g-3", title: "Third Rule", body: "Body of third rule." },
    ];
    const prompt = buildDraftSystemPrompt(guardrails);

    for (const g of guardrails) {
      assert.ok(prompt.includes(g.id), `prompt should include id: ${g.id}`);
      assert.ok(prompt.includes(g.title), `prompt should include title: ${g.title}`);
      assert.ok(prompt.includes(g.body), `prompt should include body: ${g.body}`);
    }
  });
});
