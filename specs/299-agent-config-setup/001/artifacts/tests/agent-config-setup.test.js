// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Agent } from "../../../src/lib/agent.js";
import { validate } from "../../../src/lib/config.js";
import { createI18n } from "../../../src/lib/i18n.js";
import { Logger } from "../../../src/lib/log.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";

async function importSetup() {
  return import(`../../../src/setup.js?spec299=${Date.now()}-${Math.random()}`);
}

async function importUpgrade() {
  return import(`../../../src/upgrade.js?spec299=${Date.now()}-${Math.random()}`);
}

function makeAgent(config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-299-agent-"));
  return new Agent({
    config,
    paths: {
      root,
      agentWorkDir: path.join(root, ".tmp"),
    },
    registry: new ProviderRegistry(config.agent?.providers || {}),
    logger: new Logger({ logDir: os.tmpdir(), enabled: false }),
  });
}

describe("agent config setup intent", () => {
  it("R1: interactive setup prompt plan asks main agent only for dual-family selections", async () => {
    const setup = await importSetup();

    const claudeOnly = setup.buildSetupAgentPromptPlan({ selectedAgents: ["claude"] });
    const codexOnly = setup.buildSetupAgentPromptPlan({ selectedAgents: ["codex"] });
    const dual = setup.buildSetupAgentPromptPlan({ selectedAgents: ["claude", "codex"] });

    assert.deepEqual(claudeOnly.prompts.map((prompt) => prompt.id), [
      "availableAgents",
      "agentFileMode",
    ]);
    assert.deepEqual(codexOnly.prompts.map((prompt) => prompt.id), [
      "availableAgents",
      "agentFileMode",
    ]);
    assert.deepEqual(dual.prompts.map((prompt) => prompt.id), [
      "availableAgents",
      "mainAgent",
      "agentFileTargets",
    ]);
    assert.equal(dual.prompts.find((prompt) => prompt.id === "availableAgents").mode, "multi");
    assert.equal(dual.prompts.find((prompt) => prompt.id === "mainAgent").mode, "single");
  });

  it("R1: resolves setup availability and main agent for every interactive selection", async () => {
    const setup = await importSetup();

    assert.deepEqual(
      setup.buildSetupAgentConfig({ selectedAgents: ["claude"], mainAgent: "claude" }),
      { default: "claude", useProfile: "claude-only", workDir: ".tmp" },
    );
    assert.deepEqual(
      setup.buildSetupAgentConfig({ selectedAgents: ["codex"], mainAgent: "codex" }),
      { default: "codex", useProfile: "codex-only", workDir: ".tmp" },
    );
    assert.deepEqual(
      setup.buildSetupAgentConfig({ selectedAgents: ["claude", "codex"], mainAgent: "claude" }),
      { default: "claude", useProfile: "claude-main", workDir: ".tmp" },
    );
    assert.deepEqual(
      setup.buildSetupAgentConfig({ selectedAgents: ["claude", "codex"], mainAgent: "codex" }),
      { default: "codex", useProfile: "codex-main", workDir: ".tmp" },
    );
  });

  it("R2: generated setup agent config stores aliases and useProfile without built-in profiles/providers", async () => {
    const setup = await importSetup();
    const agent = setup.buildSetupAgentConfig({
      selectedAgents: ["claude", "codex"],
      mainAgent: "codex",
    });

    assert.equal(agent.default, "codex");
    assert.equal(agent.useProfile, "codex-main");
    assert.equal(agent.workDir, ".tmp");
    assert.equal(Object.hasOwn(agent, "profiles"), false);
    assert.equal(Object.hasOwn(agent, "providers"), false);
  });

  it("R3: non-interactive --agent uses first-listed main semantics", async () => {
    const setup = await importSetup();

    assert.deepEqual(setup.parseSetupAgentOption("claude"), {
      selectedAgents: ["claude"],
      mainAgent: "claude",
    });
    assert.deepEqual(setup.parseSetupAgentOption("codex"), {
      selectedAgents: ["codex"],
      mainAgent: "codex",
    });
    assert.deepEqual(setup.parseSetupAgentOption("claude,codex"), {
      selectedAgents: ["claude", "codex"],
      mainAgent: "claude",
    });
    assert.deepEqual(setup.parseSetupAgentOption("codex,claude"), {
      selectedAgents: ["codex", "claude"],
      mainAgent: "codex",
    });
    assert.deepEqual(setup.parseSetupAgentOption("claude, codex"), {
      selectedAgents: ["claude", "codex"],
      mainAgent: "claude",
    });
  });

  it("R4: validation and runtime resolution accept built-in profiles without config-local copies", () => {
    const cfg = {
      name: "demo",
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      agent: {
        default: "codex",
        useProfile: "codex-main",
      },
    };

    assert.doesNotThrow(() => validate(cfg));
    const agent = makeAgent(cfg);
    const resolved = agent.resolve("docs.readme");
    assert.ok(resolved);
    assert.equal(resolved.profile.command, "codex");
  });

  it("R4: user-defined profiles and providers override package built-ins by key", () => {
    const cfg = {
      name: "demo",
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      agent: {
        default: "codex",
        useProfile: "codex-main",
        profiles: {
          "codex-main": {
            "docs.readme": "codex/gpt-5.4",
          },
        },
        providers: {
          "codex/gpt-5.4": {
            command: "custom-codex",
            args: ["run", "{{PROMPT}}"],
          },
        },
      },
    };

    assert.doesNotThrow(() => validate(cfg));
    const agent = makeAgent(cfg);
    const resolved = agent.resolve("docs.readme");
    assert.ok(resolved);
    assert.equal(resolved.profileKey, "codex/gpt-5.4");
    assert.equal(resolved.profile.command, "custom-codex");
    assert.deepEqual(resolved.profile.args, ["run", "{{PROMPT}}"]);
  });

  it("R5: setup config generation does not seed built-ins and preserves unknown user entries", async () => {
    const setup = await importSetup();
    const config = setup.buildSetupConfig({
      existingConfig: {
        name: "demo",
        lang: "en",
        type: "base",
        docs: { languages: ["en"], defaultLanguage: "en" },
        agent: {
          default: "claude",
          useProfile: "claude-only",
          profiles: {
            local: { docs: "local/provider" },
          },
          providers: {
            "local/provider": { command: "local-agent", args: ["{{PROMPT}}"] },
          },
        },
      },
      settings: {
        projectName: "demo",
        lang: "en",
        outputLangs: ["en"],
        outputDefault: "en",
        type: "base",
        additionalTypes: [],
        purpose: "developer-guide",
        tone: "polite",
        selectedAgents: ["claude", "codex"],
        mainAgent: "codex",
      },
    });

    assert.equal(config.agent.default, "codex");
    assert.equal(config.agent.useProfile, "codex-main");
    assert.deepEqual(config.agent.profiles, {
      local: { docs: "local/provider" },
    });
    assert.deepEqual(config.agent.providers, {
      "local/provider": { command: "local-agent", args: ["{{PROMPT}}"] },
    });
    assert.equal(Object.hasOwn(config.agent.profiles, "codex-main"), false);
    assert.equal(Object.hasOwn(config.agent.providers, "codex/gpt-5.4"), false);
  });

  it("R5: upgrade config migration preserves unknown agent entries without seeding built-ins", async () => {
    const upgrade = await importUpgrade();
    const result = upgrade.migrateConfigForUpgrade({
      name: "demo",
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      agent: {
        default: "claude",
        useProfile: "claude-only",
        profiles: {
          local: { docs: "local/provider" },
        },
        providers: {
          "local/provider": { command: "local-agent", args: ["{{PROMPT}}"] },
        },
      },
    });

    assert.equal(result.changed, false);
    assert.deepEqual(result.config.agent.profiles, {
      local: { docs: "local/provider" },
    });
    assert.deepEqual(result.config.agent.providers, {
      "local/provider": { command: "local-agent", args: ["{{PROMPT}}"] },
    });
    assert.equal(Object.hasOwn(result.config.agent.profiles, "claude-only"), false);
    assert.equal(Object.hasOwn(result.config.agent.providers, "claude/sonnet"), false);
  });

  it("R6: multi-agent setup resolves interactive and non-interactive file targets", async () => {
    const setup = await importSetup();
    const plan = setup.buildSetupAgentPromptPlan({
      selectedAgents: ["claude", "codex"],
      selectedTargets: ["AGENTS.md", "CLAUDE.md"],
    });
    const targetPrompt = plan.prompts.find((prompt) => prompt.id === "agentFileTargets");

    assert.ok(targetPrompt);
    assert.equal(targetPrompt.mode, "multi");
    assert.deepEqual(targetPrompt.options.map((option) => option.key), ["AGENTS.md", "CLAUDE.md"]);
    assert.deepEqual(plan.agentFileTargets, ["AGENTS.md", "CLAUDE.md"]);

    assert.deepEqual(
      setup.resolveSetupAgentFileTargets({
        selectedAgents: ["claude", "codex"],
        mode: "non-interactive",
      }),
      ["AGENTS.md", "CLAUDE.md"],
    );
    assert.deepEqual(
      setup.resolveSetupAgentFileTargets({
        selectedAgents: ["claude", "codex"],
        mode: "interactive",
        selectedTargets: ["CLAUDE.md"],
      }),
      ["CLAUDE.md"],
    );

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-299-agent-files-"));
    setup.writeSetupAgentFiles({
      workRoot: root,
      lang: "en",
      agentFileTargets: setup.resolveSetupAgentFileTargets({
        selectedAgents: ["claude", "codex"],
        mode: "non-interactive",
      }),
      presetTypes: "base",
      t: createI18n("en"),
    });
    assert.equal(fs.existsSync(path.join(root, "AGENTS.md")), true);
    assert.equal(fs.existsSync(path.join(root, "CLAUDE.md")), true);
  });

  it("R7: setup summary exposes selected aliases, useProfile, and built-in profile names", async () => {
    const setup = await importSetup();
    const lines = setup.buildSetupSummaryLines({
      projectName: "demo",
      lang: "en",
      outputLangs: ["en"],
      outputDefault: "en",
      type: "base",
      additionalTypes: [],
      purpose: "developer-guide",
      tone: "polite",
      agent: "codex",
      selectedAgents: ["claude", "codex"],
      mainAgent: "codex",
      agentFileTargets: ["AGENTS.md", "CLAUDE.md"],
    }, createI18n("en"), process.cwd());

    const text = lines.join("\n");
    assert.match(text, /agent\.default:\s+codex/);
    assert.match(text, /agent\.useProfile:\s+codex-main/);
    assert.match(text, /built-in profiles:.*claude-only.*codex-only.*claude-main.*codex-main/s);

    const helpText = setup.buildSetupAgentHelpText(createI18n("en"));
    assert.match(helpText, /agent\.default/);
    assert.match(helpText, /agent\.useProfile/);
    assert.match(helpText, /claude-only/);
    assert.match(helpText, /codex-only/);
    assert.match(helpText, /claude-main/);
    assert.match(helpText, /codex-main/);
    assert.match(helpText, /agent\.profiles/);
    assert.match(helpText, /agent\.providers/);
    assert.match(helpText, /"agent\.profiles"/);
    assert.match(helpText, /"agent\.providers"/);
  });

  it("R8: existing concrete provider key defaults remain resolvable", () => {
    const agent = makeAgent({
      agent: {
        default: "codex/gpt-5.4",
      },
    });

    const resolved = agent.resolve("docs.text");
    assert.ok(resolved);
    assert.equal(resolved.profile.command, "codex");
    assert.equal(resolved.profileKey, "codex/gpt-5.4");
  });

  it("R9: existing agent config normalizes into setup wizard defaults", async () => {
    const setup = await importSetup();

    assert.deepEqual(setup.resolveSetupAgentDefaults({
      default: "codex/gpt-5.4",
    }), {
      selectedAgents: ["codex"],
      mainAgent: "codex",
    });
    assert.deepEqual(setup.resolveSetupAgentDefaults({
      default: "claude",
      useProfile: "claude-main",
    }), {
      selectedAgents: ["claude", "codex"],
      mainAgent: "claude",
    });
    assert.deepEqual(setup.resolveSetupAgentDefaults({
      default: "codex",
      useProfile: "codex-main",
    }), {
      selectedAgents: ["claude", "codex"],
      mainAgent: "codex",
    });
    assert.deepEqual(setup.resolveSetupAgentDefaults({
      useProfile: "claude-main",
    }), {
      selectedAgents: ["claude", "codex"],
      mainAgent: "claude",
    });
    assert.deepEqual(setup.resolveSetupAgentDefaults({
      useProfile: "codex-main",
    }), {
      selectedAgents: ["claude", "codex"],
      mainAgent: "codex",
    });
    assert.deepEqual(setup.resolveSetupAgentDefaults({
      useProfile: "claude-only",
    }), {
      selectedAgents: ["claude"],
      mainAgent: "claude",
    });
    assert.deepEqual(setup.resolveSetupAgentDefaults({
      useProfile: "codex-only",
    }), {
      selectedAgents: ["codex"],
      mainAgent: "codex",
    });
  });
});
