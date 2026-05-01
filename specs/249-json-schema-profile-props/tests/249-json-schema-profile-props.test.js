import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import os from "os";
import fs from "fs";
import { Agent } from "../../../src/lib/agent.js";
import { ProviderRegistry, ClaudeProvider, CodexProvider } from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";
import { validate as validateConfig } from "../../../src/lib/config.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "249-schema-"));
}

function makeAgent({ config, paths } = {}) {
  const root = paths?.root || tmpDir();
  const agentWorkDir = paths?.agentWorkDir || path.join(root, ".tmp");
  const cfg = config || {
    agent: {
      default: "claude/opus",
      timeout: 300,
    },
  };
  const resolvedPaths = { root, agentWorkDir, ...(paths || {}) };
  const registry = new ProviderRegistry(cfg.agent?.providers || {});
  const logger = new Logger({ logDir: os.tmpdir(), enabled: false });
  return new Agent({ config: cfg, paths: resolvedPaths, registry, logger });
}

// ---------------------------------------------------------------------------
// R1 / R2: builtin profile properties
// ---------------------------------------------------------------------------
describe("249: builtin profile jsonSchemaFlag/jsonSchemaMode properties", () => {
  it("R1: claude/opus has jsonSchemaFlag '--json-schema' and jsonSchemaMode 'inline'", () => {
    const profiles = new ClaudeProvider().builtinProfiles();
    assert.equal(profiles["claude/opus"].jsonSchemaFlag, "--json-schema");
    assert.equal(profiles["claude/opus"].jsonSchemaMode, "inline");
  });

  it("R1: claude/sonnet has jsonSchemaFlag '--json-schema' and jsonSchemaMode 'inline'", () => {
    const profiles = new ClaudeProvider().builtinProfiles();
    assert.equal(profiles["claude/sonnet"].jsonSchemaFlag, "--json-schema");
    assert.equal(profiles["claude/sonnet"].jsonSchemaMode, "inline");
  });

  it("R2: codex/gpt-5.4 has jsonSchemaFlag '--output-schema' and jsonSchemaMode 'file'", () => {
    const profiles = new CodexProvider().builtinProfiles();
    assert.equal(profiles["codex/gpt-5.4"].jsonSchemaFlag, "--output-schema");
    assert.equal(profiles["codex/gpt-5.4"].jsonSchemaMode, "file");
  });

  it("R2: codex/gpt-5.3 has jsonSchemaFlag '--output-schema' and jsonSchemaMode 'file'", () => {
    const profiles = new CodexProvider().builtinProfiles();
    assert.equal(profiles["codex/gpt-5.3"].jsonSchemaFlag, "--output-schema");
    assert.equal(profiles["codex/gpt-5.3"].jsonSchemaMode, "file");
  });
});

// ---------------------------------------------------------------------------
// R3: jsonSchemaFlag() method removal
// ---------------------------------------------------------------------------
describe("249: jsonSchemaFlag() method removed from Provider classes", () => {
  it("R3: ClaudeProvider does not have jsonSchemaFlag method", () => {
    const provider = new ClaudeProvider();
    assert.equal(provider.jsonSchemaFlag, undefined);
  });

  it("R3: CodexProvider does not have jsonSchemaFlag method", () => {
    const provider = new CodexProvider();
    assert.equal(provider.jsonSchemaFlag, undefined);
  });
});

// ---------------------------------------------------------------------------
// R4 / R5 / R8: _buildInvocation jsonSchema handling via profile properties
// ---------------------------------------------------------------------------
describe("249: _buildInvocation jsonSchema via profile properties", () => {
  it("R4/R8: inline mode — schema is passed inline as JSON string", () => {
    const cfg = { agent: { default: "claude/opus", timeout: 300 } };
    const agent = makeAgent({ config: cfg });
    const schema = { type: "object", properties: { name: { type: "string" } } };
    const built = agent._buildInvocationForTest("hello", {
      commandId: "test",
      jsonSchema: schema,
    });
    const flagIdx = built.finalArgs.indexOf("--json-schema");
    assert.notEqual(flagIdx, -1, "expected --json-schema flag");
    assert.equal(built.finalArgs[flagIdx + 1], JSON.stringify(schema));
    assert.equal(built.pendingSchemaWrite, null);
  });

  it("R4/R8: file mode — schema is written to file and path is passed", () => {
    const cfg = { agent: { default: "codex/gpt-5.4", timeout: 300 } };
    const agent = makeAgent({ config: cfg });
    const schema = { type: "object" };
    const built = agent._buildInvocationForTest("hello", {
      commandId: "test",
      jsonSchema: schema,
    });
    const flagIdx = built.finalArgs.indexOf("--output-schema");
    assert.notEqual(flagIdx, -1, "expected --output-schema flag");
    assert.ok(built.pendingSchemaWrite, "expected pendingSchemaWrite for file mode");
    assert.equal(built.pendingSchemaWrite.content, JSON.stringify(schema));
    assert.equal(built.finalArgs[flagIdx + 1], built.pendingSchemaWrite.path);
  });

  it("R4/R8: fmtFallback — no jsonSchemaFlag means fallback is prepended to prompt", () => {
    const cfg = {
      agent: {
        default: "custom/noflag",
        timeout: 300,
        providers: {
          "custom/noflag": {
            command: "my-cli",
            args: ["{{PROMPT}}"],
          },
        },
      },
    };
    const agent = makeAgent({ config: cfg });
    const schema = { type: "object" };
    const built = agent._buildInvocationForTest("hello", {
      commandId: "test",
      jsonSchema: schema,
      fmtFallback: "Return JSON matching this schema.",
    });
    const promptArg = built.finalArgs.find((a) => a.includes("Return JSON"));
    assert.ok(promptArg, "expected fmtFallback to be prepended to prompt");
    assert.ok(promptArg.startsWith("Return JSON matching this schema."));
    assert.equal(built.pendingSchemaWrite, null);
  });

  it("R5/R8: cross-provider — codex command with jsonSchemaMode 'inline' uses inline", () => {
    const cfg = {
      agent: {
        default: "codex-inline",
        timeout: 300,
        providers: {
          "codex-inline": {
            command: "codex",
            args: ["exec", "{{PROMPT}}"],
            jsonSchemaFlag: "--output-schema",
            jsonSchemaMode: "inline",
          },
        },
      },
    };
    const agent = makeAgent({ config: cfg });
    const schema = { type: "object" };
    const built = agent._buildInvocationForTest("hello", {
      commandId: "test",
      jsonSchema: schema,
    });
    const flagIdx = built.finalArgs.indexOf("--output-schema");
    assert.notEqual(flagIdx, -1);
    assert.equal(built.finalArgs[flagIdx + 1], JSON.stringify(schema),
      "codex command with jsonSchemaMode 'inline' must pass schema inline, not via file");
    assert.equal(built.pendingSchemaWrite, null);
  });

  it("R5/R8: cross-provider — non-codex command with jsonSchemaMode 'file' uses file", () => {
    const cfg = {
      agent: {
        default: "custom-file",
        timeout: 300,
        providers: {
          "custom-file": {
            command: "my-cli",
            args: ["{{PROMPT}}"],
            jsonSchemaFlag: "--schema",
            jsonSchemaMode: "file",
          },
        },
      },
    };
    const agent = makeAgent({ config: cfg });
    const schema = { type: "object" };
    const built = agent._buildInvocationForTest("hello", {
      commandId: "test",
      jsonSchema: schema,
    });
    const flagIdx = built.finalArgs.indexOf("--schema");
    assert.notEqual(flagIdx, -1);
    assert.ok(built.pendingSchemaWrite, "non-codex profile with jsonSchemaMode 'file' must produce pendingSchemaWrite");
    assert.equal(built.pendingSchemaWrite.content, JSON.stringify(schema));
  });

  it("R5: default jsonSchemaMode is 'inline' when not specified", () => {
    const cfg = {
      agent: {
        default: "custom-default",
        timeout: 300,
        providers: {
          "custom-default": {
            command: "my-cli",
            args: ["{{PROMPT}}"],
            jsonSchemaFlag: "--json-schema",
          },
        },
      },
    };
    const agent = makeAgent({ config: cfg });
    const schema = { type: "object" };
    const built = agent._buildInvocationForTest("hello", {
      commandId: "test",
      jsonSchema: schema,
    });
    const flagIdx = built.finalArgs.indexOf("--json-schema");
    assert.notEqual(flagIdx, -1);
    assert.equal(built.finalArgs[flagIdx + 1], JSON.stringify(schema),
      "default mode should be inline when jsonSchemaMode is not specified");
    assert.equal(built.pendingSchemaWrite, null);
  });
});

// ---------------------------------------------------------------------------
// R6: config schema validation
// ---------------------------------------------------------------------------
describe("249: config schema accepts jsonSchemaFlag/jsonSchemaMode", () => {
  it("R6: accepts valid jsonSchemaFlag string", () => {
    const config = {
      lang: "ja",
      type: "cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      agent: {
        default: "my/provider",
        providers: {
          "my/provider": {
            command: "my-cli",
            args: ["{{PROMPT}}"],
            jsonSchemaFlag: "--json-schema",
          },
        },
      },
    };
    assert.doesNotThrow(() => validateConfig(config));
  });

  it("R6: accepts valid jsonSchemaMode 'inline'", () => {
    const config = {
      lang: "ja",
      type: "cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      agent: {
        default: "my/provider",
        providers: {
          "my/provider": {
            command: "my-cli",
            args: ["{{PROMPT}}"],
            jsonSchemaMode: "inline",
          },
        },
      },
    };
    assert.doesNotThrow(() => validateConfig(config));
  });

  it("R6: accepts valid jsonSchemaMode 'file'", () => {
    const config = {
      lang: "ja",
      type: "cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      agent: {
        default: "my/provider",
        providers: {
          "my/provider": {
            command: "my-cli",
            args: ["{{PROMPT}}"],
            jsonSchemaMode: "file",
          },
        },
      },
    };
    assert.doesNotThrow(() => validateConfig(config));
  });

  it("R6: rejects invalid jsonSchemaMode value", () => {
    const config = {
      lang: "ja",
      type: "cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      agent: {
        default: "my/provider",
        providers: {
          "my/provider": {
            command: "my-cli",
            args: ["{{PROMPT}}"],
            jsonSchemaMode: "stream",
          },
        },
      },
    };
    assert.throws(() => validateConfig(config), /validation failed/i);
  });
});

// ---------------------------------------------------------------------------
// R9: builtin profile property coverage (via ProviderRegistry)
// ---------------------------------------------------------------------------
describe("249: all builtin profiles have jsonSchemaFlag and jsonSchemaMode", () => {
  it("R9: every builtin profile key has both properties", () => {
    const registry = new ProviderRegistry({});
    for (const key of registry.profileKeys()) {
      const resolved = registry.resolveProfile(key);
      assert.ok(resolved, `profile ${key} should resolve`);
      assert.ok(resolved.profile.jsonSchemaFlag,
        `builtin profile '${key}' must have jsonSchemaFlag`);
      assert.ok(["file", "inline"].includes(resolved.profile.jsonSchemaMode),
        `builtin profile '${key}' must have jsonSchemaMode 'file' or 'inline', got: ${resolved.profile.jsonSchemaMode}`);
    }
  });
});
