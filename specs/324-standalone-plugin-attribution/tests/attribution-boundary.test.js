// spec: R1 R2 R3 R4 R5 R6 R7 R8
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { Agent, createPluginAgentApi } from "../../../src/lib/agent.js";
import { Logger } from "../../../src/lib/log.js";
import {
  dispatchPluginCommand,
  runFlowCommandHooks,
} from "../../../src/lib/plugin-registry.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";

const PLUGIN_SHA = "0123456789abcdef0123456789abcdef01234567";

function temporaryRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `spec-324-${label}-`));
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

function cacheFileName(specId) {
  return String(specId).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function snapshot(files) {
  return Object.fromEntries(files.map((file) => [file, fs.readFileSync(file).toString("base64")]));
}

function makeLayout(label, { activeCount = 1, worktree = false, withFlowManager = true } = {}) {
  const root = temporaryRoot(label);
  if (worktree) write(path.join(root, ".git"), "gitdir: /tmp/managed-worktree\n");
  const contexts = [];
  const protectedFiles = [];
  for (let index = 1; index <= activeCount; index += 1) {
    const spec = `specs/foreign-${index}/spec.json`;
    const flowFile = path.join(root, `specs/foreign-${index}/flow.json`);
    const cacheFile = path.join(root, ".senti", "agent-cache", `${cacheFileName(spec)}.json`);
    writeJson(flowFile, { version: 1, spec, metrics: [{ sentinel: `flow-${index}` }] });
    writeJson(cacheFile, { version: 1, entries: { sentinel: { text: `cache-${index}` } } });
    contexts.push({ spec, taskId: `task-${index}`, sentiPhase: "impl-review" });
    protectedFiles.push(flowFile, cacheFile);
  }

  const counters = { resolved: 0, invocationMetrics: 0, cacheMetrics: 0 };
  const mutateFlow = (entry) => {
    const flowFile = path.join(root, "specs/foreign-1/flow.json");
    const value = JSON.parse(fs.readFileSync(flowFile, "utf8"));
    value.metrics.push(entry);
    writeJson(flowFile, value);
  };
  const flowManager = withFlowManager ? {
    resolveCurrentContext() {
      counters.resolved += 1;
      return contexts[0];
    },
    loadActiveFlows() {
      return contexts.slice(0, activeCount);
    },
    appendMetric(metric) {
      counters.cacheMetrics += 1;
      mutateFlow(metric);
    },
    accumulateAgentMetrics(phase, metric) {
      counters.invocationMetrics += 1;
      mutateFlow({ phase, ...metric });
    },
  } : null;
  return { root, contexts, protectedFiles, counters, flowManager };
}

function makeAgent(layout, { fail = false, logging = true } = {}) {
  const countFile = path.join(layout.root, "provider-count.txt");
  const successScript = [
    "const fs=require('fs');",
    "const file=process.argv[1];",
    "const count=(fs.existsSync(file)?Number(fs.readFileSync(file,'utf8')):0)+1;",
    "fs.writeFileSync(file,String(count));",
    "fs.writeSync(1,'provider-'+count);",
  ].join("");
  const profile = fail
    ? { command: "node", args: ["-e", "process.exit(2)", "{{PROMPT}}"] }
    : { command: "node", args: ["-e", successScript, countFile, "{{PROMPT}}"] };
  const config = {
    agent: {
      default: "test/exec",
      providers: { "test/exec": profile },
      profiles: { default: { "sample-plugin": "test/exec" } },
    },
  };
  const logger = new Logger({
    logDir: path.join(layout.root, "logs"),
    enabled: logging,
    entryCommand: "plugin-test",
    cwd: layout.root,
    flowManager: layout.flowManager,
  });
  const agent = new Agent({
    config,
    paths: { root: layout.root, agentWorkDir: path.join(layout.root, ".tmp", "agent") },
    registry: new ProviderRegistry(config.agent.providers),
    logger,
    flowManager: layout.flowManager,
  });
  return { agent, logger, countFile };
}

function standaloneApi(agent, pluginConfig = {}) {
  return createPluginAgentApi({
    pluginId: "sample-plugin",
    pluginConfig,
    agent,
    flowAttribution: "none",
  });
}

function installPlugin(project, { commandSource, hookSource } = {}) {
  const pluginRoot = path.join(project, ".senti", "plugins", "sample-plugin");
  const commands = commandSource
    ? [{ name: "sample-agent", path: "commands/sample-agent.js", desc: "Agent fixture" }]
    : [];
  writeJson(path.join(project, ".senti", "config.json"), {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    scan: { include: ["src"] },
    plugin: {
      sources: [{ id: "fixture-source", type: "local", path: "." }],
      packages: [{ id: "sample-plugin", source: "fixture-source", commit: PLUGIN_SHA }],
      config: { "sample-plugin": { agentProfile: "default" } },
    },
  });
  writeJson(path.join(pluginRoot, "plugin.json"), {
    name: "sample-plugin",
    type: "mixed",
    contributions: { commands },
  });
  if (commandSource) write(path.join(pluginRoot, "commands", "sample-agent.js"), commandSource);
  if (hookSource) write(path.join(pluginRoot, "hooks", "attribution.js"), hookSource);
  return pluginRoot;
}

describe("Issue #445 standalone plugin agent attribution", () => {
  test("R1: no-flow policy bypasses ambient cache and metric authority", async (t) => {
    const layout = makeLayout("policy");
    t.after(() => fs.rmSync(layout.root, { recursive: true, force: true }));
    const { agent, countFile } = makeAgent(layout);
    assert.throws(
      () => createPluginAgentApi({
        pluginId: "sample-plugin",
        agent,
        flowAttribution: "foreign",
      }),
      /flow attribution|flowAttribution|attribution mode/i,
    );
    const api = standaloneApi(agent);
    const before = snapshot(layout.protectedFiles);

    const first = await api.call("same", { commandId: "run", retryCount: 0 });
    const second = await api.call("same", {
      commandId: "run",
      retryCount: 0,
      flowAttribution: "ambient",
    });

    assert.equal(first, "provider-1");
    assert.equal(second, "provider-2", "no-flow calls must not hit a foreign flow cache");
    assert.equal(fs.readFileSync(countFile, "utf8"), "2");
    assert.deepEqual(snapshot(layout.protectedFiles), before);
    assert.equal(layout.counters.resolved, 0);
    assert.equal(layout.counters.invocationMetrics, 0);
    assert.equal(layout.counters.cacheMetrics, 0);
  });

  test("R2: provider failure preserves foreign bytes and error behavior", async (t) => {
    const layout = makeLayout("failure");
    t.after(() => fs.rmSync(layout.root, { recursive: true, force: true }));
    const { agent } = makeAgent(layout, { fail: true });
    const before = snapshot(layout.protectedFiles);
    const decisions = [];

    await assert.rejects(
      standaloneApi(agent).call("fail", {
        commandId: "run",
        retryCount: 0,
        onCacheDecision(decision) { decisions.push(decision); },
      }),
      /provider=test\/exec|exit=2/,
    );

    assert.deepEqual(decisions, [{ cacheOutcome: "miss", providerCalled: true, fresh: false }]);
    assert.deepEqual(snapshot(layout.protectedFiles), before);
    assert.equal(layout.counters.resolved, 0);
    assert.equal(layout.counters.invocationMetrics, 0);
  });

  test("R3: standalone logs keep explicit null flow identity", async (t) => {
    const layout = makeLayout("logging");
    t.after(() => fs.rmSync(layout.root, { recursive: true, force: true }));
    const { agent, logger } = makeAgent(layout);

    await standaloneApi(agent).call("logged", { commandId: "run", retryCount: 0 });
    await logger.flush();

    const jsonl = fs.readdirSync(path.join(layout.root, "logs"))
      .find((name) => name.endsWith(".jsonl"));
    const entries = fs.readFileSync(path.join(layout.root, "logs", jsonl), "utf8")
      .trim().split("\n").map((line) => JSON.parse(line));
    const start = entries.find((entry) => entry.type === "agent" && entry.phase === "start");
    const end = entries.find((entry) => entry.type === "agent" && entry.phase === "end");
    assert.deepEqual(
      { spec: start.spec, sentiPhase: start.sentiPhase, taskId: start.taskId },
      { spec: null, sentiPhase: null, taskId: null },
    );
    assert.deepEqual(
      { spec: end.spec, sentiPhase: end.sentiPhase, taskId: end.taskId },
      { spec: null, sentiPhase: null, taskId: null },
    );
    const prompt = JSON.parse(fs.readFileSync(path.resolve(layout.root, end.promptFile), "utf8"));
    assert.deepEqual(
      {
        spec: prompt.context.spec,
        sentiPhase: prompt.context.sentiPhase,
        taskId: prompt.context.taskId,
      },
      { spec: null, sentiPhase: null, taskId: null },
    );
    assert.doesNotMatch(JSON.stringify({ end, prompt }), /foreign-1/);
    assert.equal(layout.counters.resolved, 0, "logging must not resolve ambient flow context");
  });

  test("R4: plugin API delegates resolve and preserves resolution options", async () => {
    const calls = [];
    const agent = {
      resolve(commandId, options) {
        calls.push({ method: "resolve", commandId, options });
        return { profileKey: "test/exec" };
      },
      async call(prompt, options) {
        calls.push({ method: "call", prompt, options });
        return "ok";
      },
    };
    const api = standaloneApi(agent, { provider: "test/exec", agentProfile: "plugin-profile" });

    assert.deepEqual(api.resolve("task", {
      profile: "explicit-profile",
      flowAttribution: "ambient",
    }), { profileKey: "test/exec" });
    assert.equal(await api.call("prompt", {
      commandId: "task",
      profile: "explicit-profile",
      flowAttribution: "ambient",
    }), "ok");
    for (const entry of calls) {
      assert.equal(entry.commandId || entry.options.commandId, "sample-plugin.task");
      assert.equal(entry.options.provider, "test/exec");
      assert.equal(entry.options.profile, "explicit-profile");
      assert.equal(entry.options.flowAttribution, "none");
    }
  });

  test("R5: standalone registry dispatch binds no-flow attribution", async (t) => {
    const layout = makeLayout("dispatch");
    t.after(() => fs.rmSync(layout.root, { recursive: true, force: true }));
    const { agent } = makeAgent(layout);
    installPlugin(layout.root, {
      commandSource: `
        export default function register(api) {
          return {
            async main(argv, context) {
              const resolved = context.agent.resolve("run", { flowAttribution: "ambient" });
              const text = await context.agent.call("dispatch", {
                commandId: "run",
                retryCount: 0,
                flowAttribution: "ambient"
              });
              return api.Envelope.ok("plugin", "sample-agent", { text, resolved: Boolean(resolved) });
            }
          };
        }
      `,
    });
    const before = snapshot(layout.protectedFiles);
    const previous = globalThis.__sentiPluginAgent;
    globalThis.__sentiPluginAgent = agent;
    t.after(() => { globalThis.__sentiPluginAgent = previous; });

    const result = await dispatchPluginCommand(layout.root, "sample-agent", []);

    assert.equal(result.ok, true);
    assert.deepEqual(result.data, { text: "provider-1", resolved: true });
    assert.deepEqual(snapshot(layout.protectedFiles), before);
    assert.equal(layout.counters.resolved, 0);
  });

  test("R6: repeated standalone calls keep every seeded flow and cache byte-identical", async (t) => {
    const layout = makeLayout("foreign-files", { activeCount: 2 });
    t.after(() => fs.rmSync(layout.root, { recursive: true, force: true }));
    const { agent } = makeAgent(layout);
    const api = standaloneApi(agent);
    const before = snapshot(layout.protectedFiles);

    await api.call("repeat", { commandId: "run", retryCount: 0 });
    await api.call("repeat", { commandId: "run", retryCount: 0 });

    assert.deepEqual(snapshot(layout.protectedFiles), before);
  });

  test("R7: repository-layout matrix never selects foreign flow authority", async (t) => {
    const cases = [
      ["managed-worktree", { activeCount: 1, worktree: true }],
      ["main-single", { activeCount: 1 }],
      ["main-multiple", { activeCount: 2 }],
      ["no-flow", { activeCount: 0, withFlowManager: false }],
    ];
    for (const [label, options] of cases) {
      const layout = makeLayout(label, options);
      t.after(() => fs.rmSync(layout.root, { recursive: true, force: true }));
      const before = snapshot(layout.protectedFiles);
      const { agent } = makeAgent(layout);
      const api = standaloneApi(agent);
      await api.call(label, { commandId: "run", retryCount: 0 });
      await api.call(label, { commandId: "run", retryCount: 0 });
      const { agent: failingAgent } = makeAgent(layout, { fail: true });
      await assert.rejects(
        standaloneApi(failingAgent).call(`${label}-failure`, { commandId: "run", retryCount: 0 }),
      );
      assert.deepEqual(snapshot(layout.protectedFiles), before, label);
      assert.equal(layout.counters.resolved, 0, label);
    }
  });

  test("R8: explicit flow hook retains one ambient provider-call attribution", async (t) => {
    const layout = makeLayout("hook");
    t.after(() => fs.rmSync(layout.root, { recursive: true, force: true }));
    const { agent } = makeAgent(layout);
    installPlugin(layout.root, {
      hookSource: `
        export default function register(api) {
          return class AttributionHook extends api.FlowCommandHook {
            static command = "gate";
            static hook = "pre";
            async run(context) {
              await context.agent.call("hook", { commandId: "run", retryCount: 0 });
              return context.envelope.ok();
            }
          };
        }
      `,
    });
    const previous = globalThis.__sentiPluginAgent;
    globalThis.__sentiPluginAgent = agent;
    t.after(() => { globalThis.__sentiPluginAgent = previous; });

    const coreFirst = await agent.call("core", { commandId: "flow.gate", retryCount: 0 });
    const coreCached = await agent.call("core", { commandId: "flow.gate", retryCount: 0 });
    assert.equal(coreFirst, "provider-1");
    assert.equal(coreCached, "provider-1");
    assert.equal(layout.counters.invocationMetrics, 1);
    assert.equal(layout.counters.cacheMetrics, 1);

    const result = await runFlowCommandHooks(layout.root, [{
      apiVersion: 1,
      pluginId: "sample-plugin",
      module: "hooks/attribution.js",
      className: "AttributionHook",
      command: "gate",
      hook: "pre",
      priority: 0,
    }], {
      command: "gate",
      hook: "pre",
      flow: { spec: layout.contexts[0].spec },
    });

    assert.equal(result.ok, true);
    assert.equal(result.warnings.length, 0);
    assert.equal(layout.counters.invocationMetrics, 2);
    assert.equal(layout.counters.cacheMetrics, 1);
    assert.ok(layout.counters.resolved > 0);
    const cacheFile = layout.protectedFiles.find((file) => file.includes("agent-cache"));
    assert.ok(Object.keys(JSON.parse(fs.readFileSync(cacheFile, "utf8")).entries).length > 1);
  });
});
