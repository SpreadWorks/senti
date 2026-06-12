// spec: R1 R2 R3 R4 R5 R6 R7
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { Agent, createPluginAgentApi } from "../../../src/lib/agent.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spec-289-agent-"));
}

function makeAgent(config) {
  const root = tmpDir();
  const agent = new Agent({
    config,
    paths: {
      root,
      agentWorkDir: path.join(root, ".tmp"),
    },
    registry: new ProviderRegistry(config.agent?.providers || {}),
    logger: new Logger({ logDir: os.tmpdir(), enabled: false }),
  });
  agent._specRootForTest = root;
  return agent;
}

describe("Issue #378 plugin Agent resolution", () => {
  it("R1: resolves a plugin command id through the generic default when the active profile has no plugin mapping", () => {
    const agent = makeAgent({
      agent: {
        default: "codex",
        useProfile: "codex-only",
        profiles: {
          "codex-only": {
            "docs.text": "codex/gpt-5.4",
          },
        },
      },
    });

    const resolved = agent.resolve("workflow.publish");
    assert.ok(resolved, "workflow.publish should fall back to the default agent");
    assert.equal(resolved.profileKey, "codex/gpt-5.4");
  });

  it("R1: resolves a plugin command id through an active profile prefix before default fallback", () => {
    const agent = makeAgent({
      agent: {
        default: "codex",
        useProfile: "mixed",
        profiles: {
          mixed: {
            workflow: "claude/opus",
          },
          default: {
            workflow: "codex/gpt-5.4",
          },
        },
      },
    });

    const resolved = agent.resolve("workflow.publish");
    assert.ok(resolved);
    assert.equal(resolved.profileKey, "claude/opus");
  });

  it("R1: resolves a plugin command id through the default profile before generic default fallback", () => {
    const agent = makeAgent({
      agent: {
        default: "codex",
        useProfile: "codex-only",
        profiles: {
          "codex-only": {
            "docs.text": "codex/gpt-5.4",
          },
          default: {
            workflow: "claude/sonnet",
          },
        },
      },
    });

    const resolved = agent.resolve("workflow.publish");
    assert.ok(resolved);
    assert.equal(resolved.profileKey, "claude/sonnet");
  });

  it("R2: keeps explicit plugin provider overrides ahead of profile and default fallback", () => {
    const agent = makeAgent({
      agent: {
        default: "codex",
        useProfile: "codex-only",
        profiles: {
          "codex-only": {
            "workflow.publish": "codex/gpt-5.4",
          },
        },
      },
    });

    const resolved = agent.resolve("workflow.publish", { provider: "claude/sonnet" });
    assert.ok(resolved);
    assert.equal(resolved.profileKey, "claude/sonnet");
    assert.equal(resolved.profile.command, "claude");
  });

  it("R2: forwards plugin provider overrides through createPluginAgentApi", async () => {
    const calls = [];
    const api = createPluginAgentApi({
      pluginId: "workflow",
      pluginConfig: { provider: "claude/sonnet" },
      agent: {
        call(prompt, options) {
          calls.push({ prompt, options });
          return Promise.resolve("ok");
        },
      },
    });

    await api.call("publish", { commandId: "publish" });
    assert.equal(calls[0].options.commandId, "workflow.publish");
    assert.equal(calls[0].options.provider, "claude/sonnet");
  });

  it("R2: forwards and applies plugin profile overrides ahead of active profile routing", async () => {
    const agent = makeAgent({
      agent: {
        default: "codex",
        useProfile: "active-profile",
        providers: {
          "test/active": {
            command: "node",
            args: ["-e", "process.stdout.write('active-profile')"],
          },
          "test/plugin": {
            command: "node",
            args: ["-e", "process.stdout.write('plugin-profile')"],
          },
        },
        profiles: {
          "active-profile": {
            workflow: "test/active",
          },
          "plugin-profile": {
            workflow: "test/plugin",
          },
        },
      },
    });
    const api = createPluginAgentApi({
      pluginId: "workflow",
      pluginConfig: { agentProfile: "plugin-profile" },
      agent,
    });

    const result = await api.call("ignored", { commandId: "publish", retryCount: 0 });
    assert.equal(result, "plugin-profile");
  });

  it("R3: maps bare built-in default codex to codex/gpt-5.4", () => {
    const agent = makeAgent({
      agent: {
        default: "codex",
      },
    });

    const resolved = agent.resolve("workflow.publish");
    assert.ok(resolved);
    assert.equal(resolved.profileKey, "codex/gpt-5.4");
  });

  it("R3: maps bare built-in default claude to claude/sonnet", () => {
    const agent = makeAgent({
      agent: {
        default: "claude",
      },
    });

    const resolved = agent.resolve("workflow.publish");
    assert.ok(resolved);
    assert.equal(resolved.profileKey, "claude/sonnet");
  });

  it("R3: does not silently select another configured provider when agent.default is unknown", () => {
    const agent = makeAgent({
      agent: {
        default: "missing-provider",
        providers: {
          "test/other": {
            command: "node",
            args: ["-e", "process.stdout.write('wrong-provider')"],
          },
        },
        profiles: {
          unrelated: {
            "docs.text": "test/other",
          },
        },
      },
    });

    assert.equal(agent.resolve("workflow.publish"), null);
  });

  it("R4: includes resolution context when no provider can be resolved", async () => {
    const agent = makeAgent({
      agent: {
        default: "missing-provider",
        useProfile: "codex-only",
        profiles: {
          "codex-only": {},
        },
      },
    });

    await assert.rejects(
      agent.call("SECRET_PROMPT_BODY", {
        commandId: "workflow.publish",
        systemPrompt: "SECRET_SYSTEM_BODY",
        retryCount: 0,
      }),
      (err) => {
        assert.match(err.message, /workflow\.publish/);
        assert.match(err.message, /codex-only/);
        assert.match(err.message, /missing-provider/);
        assert.match(err.message, /providerOverride=none/);
        assert.match(err.message, /profileSource=useProfile/);
        assert.match(err.message, /activeProfile=codex-only/);
        assert.match(err.message, /default=missing-provider/);
        assert.match(err.message, /failed|unresolved|could not resolve|no provider/i);
        return true;
      },
    );
  });

  it("R4: reports explicit unresolved provider override state", async () => {
    const agent = makeAgent({
      agent: {
        default: "claude/sonnet",
      },
    });

    await assert.rejects(
      agent.call("SECRET_PROMPT_BODY", {
        commandId: "workflow.publish",
        provider: "missing-override",
        retryCount: 0,
      }),
      (err) => {
        assert.match(err.message, /workflow\.publish/);
        assert.match(err.message, /providerOverride=missing-override/);
        assert.match(err.message, /default=claude\/sonnet/);
        assert.match(err.message, /failed|unresolved|could not resolve|no provider/i);
        assert.doesNotMatch(err.message, /SECRET_PROMPT_BODY/);
        return true;
      },
    );
  });

  it("R5: redacts prompt, system prompt, provider args, tokens, and absolute paths from diagnostics", async () => {
    const agent = makeAgent({
      agent: {
        default: "missing-provider",
        providers: {
          "secret/provider": {
            command: "secret-command",
            args: ["--token", "TOKEN_SHOULD_NOT_LEAK", "{{PROMPT}}"],
          },
        },
      },
    });

    await assert.rejects(
      agent.call("PROMPT_SHOULD_NOT_LEAK", {
        commandId: "workflow.publish",
        systemPrompt: "SYSTEM_SHOULD_NOT_LEAK",
        retryCount: 0,
      }),
      (err) => {
        assert.doesNotMatch(err.message, /PROMPT_SHOULD_NOT_LEAK/);
        assert.doesNotMatch(err.message, /SYSTEM_SHOULD_NOT_LEAK/);
        assert.doesNotMatch(err.message, /TOKEN_SHOULD_NOT_LEAK/);
        assert.doesNotMatch(err.message, /secret-command/);
        assert.doesNotMatch(err.message, new RegExp(agent._specRootForTest.replaceAll(path.sep, String.raw`[\\/]`)));
        return true;
      },
    );
  });

  it("R6: preserves normal command active-profile precedence over default profile fallback", () => {
    const agent = makeAgent({
      agent: {
        default: "claude/sonnet",
        useProfile: "codex-only",
        profiles: {
          default: {
            "docs.text": "claude/opus",
          },
          "codex-only": {
            "docs.text": "codex/gpt-5.4",
          },
        },
      },
    });

    const resolved = agent.resolve("docs.text");
    assert.ok(resolved);
    assert.equal(resolved.profileKey, "codex/gpt-5.4");
  });

  it("R6: preserves flow command active-profile precedence over default profile fallback", () => {
    const agent = makeAgent({
      agent: {
        default: "claude/sonnet",
        useProfile: "codex-only",
        profiles: {
          default: {
            flow: "claude/opus",
          },
          "codex-only": {
            flow: "codex/gpt-5.4",
          },
        },
      },
    });

    const resolved = agent.resolve("flow.spec.gate");
    assert.ok(resolved);
    assert.equal(resolved.profileKey, "codex/gpt-5.4");
  });

  it("R7: exercises the regression guard against unrelated provider fallback", () => {
    const agent = makeAgent({
      agent: {
        default: "missing-provider",
        providers: {
          "test/other": {
            command: "node",
            args: ["-e", "process.stdout.write('wrong-provider')"],
          },
        },
        profiles: {
          "codex-only": {
            "docs.text": "test/other",
          },
        },
        useProfile: "codex-only",
      },
    });

    const resolved = agent.resolve("workflow.publish");
    assert.equal(resolved, null, "workflow.publish must not fall back to unrelated configured providers");
  });
});
