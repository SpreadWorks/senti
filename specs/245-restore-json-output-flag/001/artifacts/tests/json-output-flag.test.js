import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, chmodSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("jsonOutputFlag in provider config schema", () => {
  it("R1: config schema accepts jsonOutputFlag as optional string in provider", async () => {
    const { validate } = await import("../../../src/lib/config.js");
    const base = {
      lang: "en",
      type: ["node-cli"],
      docs: { languages: ["en"], defaultLanguage: "en" },
      scan: { include: ["src/**/*.js"] },
      agent: {
        default: "test/foo",
        providers: {
          "test/foo": {
            command: "test-cli",
            args: ["{{PROMPT}}"],
            jsonOutputFlag: "--json",
          },
        },
      },
    };
    const config = validate(base);
    assert.strictEqual(
      config.agent.providers["test/foo"].jsonOutputFlag,
      "--json",
    );
  });

  it("R1: config schema accepts provider without jsonOutputFlag", async () => {
    const { validate } = await import("../../../src/lib/config.js");
    const base = {
      lang: "en",
      type: ["node-cli"],
      docs: { languages: ["en"], defaultLanguage: "en" },
      scan: { include: ["src/**/*.js"] },
      agent: {
        default: "test/bar",
        providers: {
          "test/bar": {
            command: "test-cli",
            args: ["{{PROMPT}}"],
          },
        },
      },
    };
    const config = validate(base);
    assert.strictEqual(
      config.agent.providers["test/bar"].jsonOutputFlag,
      undefined,
    );
  });
});

describe("jsonOutputFlag in builtin profiles", () => {
  it("R2: ClaudeProvider builtinProfiles include jsonOutputFlag", async () => {
    const { ClaudeProvider } = await import("../../../src/lib/provider.js");
    const provider = new ClaudeProvider();
    const profiles = provider.builtinProfiles();
    for (const [key, profile] of Object.entries(profiles)) {
      assert.ok(
        profile.jsonOutputFlag,
        `${key} must have jsonOutputFlag`,
      );
      assert.strictEqual(typeof profile.jsonOutputFlag, "string");
    }
  });

  it("R2: CodexProvider builtinProfiles include jsonOutputFlag", async () => {
    const { CodexProvider } = await import("../../../src/lib/provider.js");
    const provider = new CodexProvider();
    const profiles = provider.builtinProfiles();
    for (const [key, profile] of Object.entries(profiles)) {
      assert.ok(
        profile.jsonOutputFlag,
        `${key} must have jsonOutputFlag`,
      );
      assert.strictEqual(typeof profile.jsonOutputFlag, "string");
    }
  });
});

describe("parse branching based on jsonOutputFlag", () => {
  const claudeJson = JSON.stringify({
    result: "parsed-text",
    usage: { input_tokens: 10, output_tokens: 20 },
    total_cost_usd: 0.001,
  });

  let stubDir;
  let stubPath;

  function setupStub() {
    stubDir = join(tmpdir(), `sdd-test-${Date.now()}`);
    mkdirSync(stubDir, { recursive: true });
    stubPath = join(stubDir, "stub-claude");
    writeFileSync(
      stubPath,
      `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(claudeJson)});\n`,
    );
    chmodSync(stubPath, 0o755);
  }

  function cleanupStub() {
    try { rmSync(stubDir, { recursive: true, force: true }); } catch {}
  }

  it("R3: with jsonOutputFlag, provider.parse() extracts result from JSON envelope", async () => {
    setupStub();
    try {
      const { Agent } = await import("../../../src/lib/agent.js");
      const { ProviderRegistry } = await import("../../../src/lib/provider.js");

      const registry = new ProviderRegistry({
        "stub/claude": {
          command: stubPath,
          args: [],
          jsonOutputFlag: "--output-format json",
        },
      });

      const agent = new Agent({
        config: { agent: { default: "stub/claude", retryCount: 0 } },
        paths: { root: process.cwd() },
        registry,
        logger: { agent: async () => {} },
      });

      const result = await agent.call("test", { commandId: "test", retryCount: 0 });
      assert.strictEqual(result, "parsed-text",
        "parse() must extract envelope.result, not return raw JSON");
    } finally {
      cleanupStub();
    }
  });

  it("R3: without jsonOutputFlag, raw stdout is returned without parse", async () => {
    setupStub();
    try {
      const { Agent } = await import("../../../src/lib/agent.js");
      const { ProviderRegistry } = await import("../../../src/lib/provider.js");

      const registry = new ProviderRegistry({
        "stub/claude-noparse": {
          command: stubPath,
          args: [],
        },
      });

      const logPayloads = [];
      const agent = new Agent({
        config: { agent: { default: "stub/claude-noparse", retryCount: 0 } },
        paths: { root: process.cwd() },
        registry,
        logger: { agent: async (p) => logPayloads.push(p) },
      });

      const result = await agent.call("test", { commandId: "test", retryCount: 0 });
      assert.strictEqual(result, claudeJson,
        "without jsonOutputFlag, raw stdout must be returned as-is");

      const endPayload = logPayloads.find((p) => p.phase === "end");
      assert.strictEqual(endPayload.usage, null,
        "usage must be null when jsonOutputFlag is not set");
    } finally {
      cleanupStub();
    }
  });

  it("R3: builtin claude profile resolves with jsonOutputFlag set", async () => {
    const { ProviderRegistry } = await import("../../../src/lib/provider.js");
    const registry = new ProviderRegistry({});
    const resolved = registry.resolveProfile("claude/sonnet");
    assert.ok(resolved, "claude/sonnet must resolve");
    assert.ok(
      resolved.profile.jsonOutputFlag,
      "builtin claude profile must have jsonOutputFlag",
    );
  });

  it("R3: user-defined profile without jsonOutputFlag resolves as undefined", async () => {
    const { ProviderRegistry } = await import("../../../src/lib/provider.js");
    const registry = new ProviderRegistry({
      "plain/cli": {
        command: "my-cli",
        args: ["{{PROMPT}}"],
      },
    });
    const resolved = registry.resolveProfile("plain/cli");
    assert.ok(resolved, "plain/cli must resolve");
    assert.strictEqual(
      resolved.profile.jsonOutputFlag,
      undefined,
      "user-defined profile without jsonOutputFlag must be undefined",
    );
  });
});
