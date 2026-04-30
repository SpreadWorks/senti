import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("PromptBuilder", () => {
  async function loadBuilder() {
    const mod = await import("../../../src/lib/prompt-builder.js");
    return mod.PromptBuilder;
  }

  it("exports PromptBuilder class", async () => {
    const PromptBuilder = await loadBuilder();
    assert.strictEqual(typeof PromptBuilder, "function");
  });

  it("build() returns { systemPrompt, userPrompt, jsonSchema }", async () => {
    const PromptBuilder = await loadBuilder();
    const pb = new PromptBuilder();
    pb.setRole("You are a checker.");
    pb.add("## Content", "hello");
    const result = pb.build();
    assert.ok("systemPrompt" in result);
    assert.ok("userPrompt" in result);
    assert.ok("jsonSchema" in result);
  });

  it("systemPrompt joins role and rules", async () => {
    const PromptBuilder = await loadBuilder();
    const pb = new PromptBuilder();
    pb.setRole("Role text");
    pb.setRules("Rule text");
    const { systemPrompt } = pb.build();
    assert.ok(systemPrompt.includes("Role text"));
    assert.ok(systemPrompt.includes("Rule text"));
  });

  it("systemPrompt is null when neither role nor rules set", async () => {
    const PromptBuilder = await loadBuilder();
    const pb = new PromptBuilder();
    pb.add("## Data", "content");
    const { systemPrompt } = pb.build();
    assert.strictEqual(systemPrompt, null);
  });

  it("userPrompt contains add() sections in declaration order", async () => {
    const PromptBuilder = await loadBuilder();
    const pb = new PromptBuilder();
    pb.add("## First", "aaa");
    pb.add("## Second", "bbb");
    pb.add("## Third", "ccc");
    const { userPrompt } = pb.build();
    const firstIdx = userPrompt.indexOf("## First");
    const secondIdx = userPrompt.indexOf("## Second");
    const thirdIdx = userPrompt.indexOf("## Third");
    assert.ok(firstIdx < secondIdx, "First before Second");
    assert.ok(secondIdx < thirdIdx, "Second before Third");
  });

  it("jsonSchema passes through as-is", async () => {
    const PromptBuilder = await loadBuilder();
    const schema = { type: "object", properties: { x: { type: "number" } } };
    const pb = new PromptBuilder();
    pb.setJsonSchema(schema);
    pb.add("## Content", "data");
    const { jsonSchema } = pb.build();
    assert.deepStrictEqual(jsonSchema, schema);
  });

  it("jsonSchema is null when not set", async () => {
    const PromptBuilder = await loadBuilder();
    const pb = new PromptBuilder();
    pb.add("## Content", "data");
    const { jsonSchema } = pb.build();
    assert.strictEqual(jsonSchema, null);
  });

  it("fmtFallback is available in build result", async () => {
    const PromptBuilder = await loadBuilder();
    const pb = new PromptBuilder();
    pb.setFmtFallback("OUTPUT FORMAT: JSON only");
    pb.add("## Content", "data");
    const result = pb.build();
    assert.ok("fmtFallback" in result);
    assert.strictEqual(result.fmtFallback, "OUTPUT FORMAT: JSON only");
  });

  it("role is NOT included in userPrompt when set", async () => {
    const PromptBuilder = await loadBuilder();
    const pb = new PromptBuilder();
    pb.setRole("You are a checker.");
    pb.add("## Content", "data");
    const { userPrompt } = pb.build();
    assert.ok(!userPrompt.includes("You are a checker."));
  });
});
