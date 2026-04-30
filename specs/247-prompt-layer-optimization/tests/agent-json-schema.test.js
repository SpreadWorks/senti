import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Agent _buildInvocation with jsonSchema", () => {
  async function createAgent(profileKey = "claude/sonnet") {
    const { Agent } = await import("../../../src/lib/agent.js");
    return new Agent({
      config: { agent: { default: profileKey } },
      paths: { root: "/tmp", agentWorkDir: "/tmp/sdd-work" },
      logger: { agent: async () => {} },
    });
  }

  it("claude provider includes --json-schema flag with inline JSON", async () => {
    const agent = await createAgent("claude/sonnet");
    const schema = { type: "object", properties: { x: { type: "number" } } };
    const result = agent._buildInvocationForTest("test prompt", {
      commandId: "test",
      jsonSchema: schema,
    });
    const args = result.finalArgs;
    const idx = args.indexOf("--json-schema");
    assert.ok(idx >= 0, "--json-schema flag must be present");
    const schemaArg = args[idx + 1];
    assert.deepStrictEqual(JSON.parse(schemaArg), schema);
  });

  it("codex provider includes --output-schema flag with file path", async () => {
    const agent = await createAgent("codex/gpt-5.4");
    const schema = { type: "object", properties: { y: { type: "string" } } };
    const result = agent._buildInvocationForTest("test prompt", {
      commandId: "test",
      jsonSchema: schema,
    });
    const args = result.finalArgs;
    const idx = args.indexOf("--output-schema");
    assert.ok(idx >= 0, "--output-schema flag must be present");
    const filePath = args[idx + 1];
    assert.ok(typeof filePath === "string" && filePath.length > 0);
  });

  it("no jsonSchema flag when jsonSchema option is not provided", async () => {
    const agent = await createAgent("claude/sonnet");
    const result = agent._buildInvocationForTest("test prompt", {
      commandId: "test",
    });
    const args = result.finalArgs;
    assert.strictEqual(args.indexOf("--json-schema"), -1);
    assert.strictEqual(args.indexOf("--output-schema"), -1);
  });

  it("fmtFallback is prepended to prompt when provider lacks jsonSchemaFlag", async () => {
    const { Agent } = await import("../../../src/lib/agent.js");
    const { ProviderRegistry } = await import("../../../src/lib/provider.js");
    const registry = new ProviderRegistry({
      "custom/model": { command: "custom-cli", args: ["{{PROMPT}}"] },
    });
    const agent = new Agent({
      config: { agent: { default: "custom/model" } },
      paths: { root: "/tmp", agentWorkDir: "/tmp/sdd-work" },
      registry,
      logger: { agent: async () => {} },
    });
    const schema = { type: "object" };
    const result = agent._buildInvocationForTest("main prompt", {
      commandId: "test",
      jsonSchema: schema,
      fmtFallback: "OUTPUT FORMAT: JSON only",
    });
    const prompt = result.stdinContent || result.finalArgs.join(" ");
    assert.ok(prompt.includes("OUTPUT FORMAT: JSON only"), "fmtFallback must be present in prompt");
  });
});
