import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCoreHelpModel } from "../../src/help.js";
import { allCommands } from "../../src/lib/command-registry.js";
import { validate } from "../../src/lib/config.js";

// ---------------------------------------------------------------------------
// A: help.js LAYOUT — flow subcommands
// ---------------------------------------------------------------------------

describe("060-A: help layout includes flow subcommands", () => {
  const names = buildCoreHelpModel({ commands: allCommands, lang: "en" }).allCommands().map((c) => c.name);

  it("includes flow get", () => {
    assert.ok(names.includes("flow get"));
  });

  it("includes flow set", () => {
    assert.ok(names.includes("flow set"));
  });

  it("includes flow run", () => {
    assert.ok(names.includes("flow run"));
  });
});

// ---------------------------------------------------------------------------
// B: validateConfig — nested agent.* structure
// ---------------------------------------------------------------------------

/** Minimal valid config (no agent section) */
function baseConfig() {
  return {
    lang: "en",
    type: "sample-node-command",
    docs: {
      languages: ["en"],
      defaultLanguage: "en",
    },
  };
}

describe("060-B: validateConfig with nested agent structure", () => {
  it("accepts config without agent section", () => {
    const cfg = baseConfig();
    assert.doesNotThrow(() => validate(cfg));
  });

  it("accepts valid nested agent.providers", () => {
    const cfg = {
      ...baseConfig(),
      agent: {
        default: "claude",
        providers: {
          claude: {
            command: "claude",
            args: ["-p", "{{PROMPT}}"],
          },
        },
      },
    };
    assert.doesNotThrow(() => validate(cfg));
  });

  it("rejects agent.providers entry missing command", () => {
    const cfg = {
      ...baseConfig(),
      agent: {
        default: "claude",
        providers: {
          claude: {
            args: ["-p", "{{PROMPT}}"],
          },
        },
      },
    };
    assert.throws(() => validate(cfg), /agent\.providers\.claude\.command/);
  });

  it("rejects agent.providers entry missing args", () => {
    const cfg = {
      ...baseConfig(),
      agent: {
        default: "claude",
        providers: {
          claude: {
            command: "claude",
          },
        },
      },
    };
    assert.throws(() => validate(cfg), /agent\.providers\.claude\.args/);
  });

  it("rejects flat providers as unknown field", () => {
    const cfg = {
      ...baseConfig(),
      providers: {
        claude: {
          command: "claude",
          args: ["-p"],
        },
      },
    };
    // flat providers is an unknown top-level field — rejected by additionalProperties: false
    assert.throws(() => validate(cfg), /providers/);
  });

  it("accepts full config matching real .senrail/config.json structure", () => {
    const cfg = {
      lang: "ja",
      type: "sample-node-command",
      concurrency: 2,
      docs: {
        languages: ["en", "ja"],
        defaultLanguage: "en",
        mode: "generate",
        style: {
          purpose: "user-guide",
          tone: "polite",
        },
      },
      flow: { merge: "squash" },
      agent: {
        default: "claude",
        workDir: ".tmp",
        timeout: 600,
        providers: {
          claude: {
            command: "claude",
            args: ["-p", "{{PROMPT}}"],
            systemPromptFlag: "--system-prompt",
            profiles: {
              default: [],
              opus: ["--model", "opus"],
            },
          },
          codex: {
            command: "codex",
            args: ["exec", "--full-auto", "-C", ".tmp", "{{PROMPT}}"],
            profiles: { default: [] },
          },
        },
        commands: {
          "docs.enrich": { agent: "claude", profile: "opus" },
          "docs.text": { agent: "claude", profile: "opus" },
        },
      },
    };
    assert.doesNotThrow(() => validate(cfg));
  });
});
