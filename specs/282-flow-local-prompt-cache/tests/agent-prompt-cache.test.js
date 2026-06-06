// spec: R1 R2 R3 R4 R5 R6 R7
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { Agent } from "../../../src/lib/agent.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";
import { makeFlowManager, makeFlowState } from "../../../tests/helpers/flow-setup.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sdd-agent-cache-spec-"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readCount(file) {
  try {
    return Number(fs.readFileSync(file, "utf8"));
  } catch {
    return 0;
  }
}

function hasCacheHitEvidenceText(value) {
  return /(agent-cache|cacheHit|cachedResponse|cache[- ]hit)/i.test(String(value || ""));
}

function stepRuntimeLogs(steps, out = []) {
  for (const step of steps || []) {
    if (step.runtimeLog) out.push(step.runtimeLog);
    stepRuntimeLogs(step.children, out);
  }
  return out;
}

function runtimeLogTexts(root) {
  const dir = path.join(root, ".tmp", "logs");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".log"))
    .map((name) => fs.readFileSync(path.join(dir, name), "utf8"));
}

function hasCacheHitEvidence(root, flowState) {
  const metrics = flowState.metrics || [];
  if (metrics.some((entry) => entry.kind === "agent-cache" || entry.counter === "cacheHit" || entry.cachedResponse === true)) {
    return true;
  }
  const runtimeLogs = stepRuntimeLogs(flowState.steps)
    .map((entry) => JSON.stringify(entry))
    .concat(runtimeLogTexts(root));
  return runtimeLogs.some(hasCacheHitEvidenceText);
}

function setupActiveFlow(root, specId = "001-cache") {
  const fm = makeFlowManager(root);
  const state = makeFlowState({
    spec: `specs/${specId}/spec.md`,
    featureBranch: `feature/${specId}`,
    metrics: [],
  });
  fm.save(state);
  fm.addActiveFlow(specId, "local");
  return fm;
}

function makeCountingAgent({ root, countFile, flowManager, providers, defaultProvider = "test/exec" }) {
  const script = [
    "const fs = require('fs');",
    "const countFile = process.argv[1];",
    "const payload = process.argv[2] || '';",
    "let count = 0;",
    "try { count = Number(fs.readFileSync(countFile, 'utf8')); } catch {}",
    "fs.writeFileSync(countFile, String(count + 1));",
    "process.stdout.write('response:' + payload);",
  ].join(" ");
  const userProviders = providers || {
    [defaultProvider]: {
      command: process.execPath,
      args: ["-e", script, countFile, "{{PROMPT}}"],
    },
  };
  const config = {
    agent: {
      default: defaultProvider,
      providers: userProviders,
      timeout: 30,
      retryCount: 0,
    },
  };
  return new Agent({
    config,
    paths: { root, agentWorkDir: path.join(root, ".tmp") },
    registry: new ProviderRegistry(config.agent.providers),
    logger: new Logger({ logDir: path.join(root, ".tmp", "logs"), enabled: false, flowManager, cwd: root }),
    flowManager,
  });
}

test("R1: identical active-flow Agent.call input returns cached response without a second provider invocation", async () => {
  const root = tmpDir();
  const countFile = path.join(root, "count.txt");
  const flowManager = setupActiveFlow(root);
  const agent = makeCountingAgent({ root, countFile, flowManager });

  const first = await agent.call("same prompt", { commandId: "flow.review", systemPrompt: "sys" });
  const second = await agent.call("same prompt", { commandId: "flow.review", systemPrompt: "sys" });

  assert.equal(first, second);
  assert.equal(readCount(countFile), 1);
});

test("R2: cache identity includes resolved profile invocation shape", async () => {
  const root = tmpDir();
  const countFile = path.join(root, "count.txt");
  const flowManager = setupActiveFlow(root);
  const script = [
    "const fs = require('fs');",
    "const countFile = process.argv[1];",
    "const marker = process.argv[2];",
    "let count = 0;",
    "try { count = Number(fs.readFileSync(countFile, 'utf8')); } catch {}",
    "fs.writeFileSync(countFile, String(count + 1));",
    "process.stdout.write(marker);",
  ].join(" ");
  const providers = {
    "test/exec": {
      command: process.execPath,
      args: ["-e", script, countFile, "v1", "{{PROMPT}}"],
    },
    "test/exec-mutated": {
      command: process.execPath,
      args: ["-e", script, countFile, "v2", "{{PROMPT}}"],
    },
  };
  const agent = makeCountingAgent({ root, countFile, flowManager, providers });
  const resolved = agent.resolve("flow.review");
  assert.equal(typeof agent._buildPromptCacheKeyForTest, "function");
  const jsonSchemaA = { z: 1, nested: { b: 2, a: 1 } };
  const jsonSchemaB = { nested: { a: 1, b: 2 }, z: 1 };
  const options = {
    commandId: "flow.review",
    systemPrompt: "system",
    jsonSchema: jsonSchemaA,
    fmtFallback: "format fallback",
  };
  const key = agent._buildPromptCacheKeyForTest(resolved, "same prompt", options);
  const sameKey = agent._buildPromptCacheKeyForTest(resolved, "same prompt", { ...options, jsonSchema: jsonSchemaB });
  assert.equal(typeof agent._buildPromptCacheKeyMaterialForTest, "function");
  const keyMaterial = agent._buildPromptCacheKeyMaterialForTest(resolved, "same prompt", options);
  const expectedSha256Key = crypto.createHash("sha256").update(keyMaterial).digest("hex");
  const changedInvocation = {
    ...resolved,
    profile: { ...resolved.profile, args: [...resolved.profile.args, "--changed"] },
  };

  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key, expectedSha256Key);
  assert.equal(key, sameKey);
  assert.notEqual(key, agent._buildPromptCacheKeyForTest({ ...resolved, providerKey: "other/provider" }, "same prompt", options));
  assert.notEqual(key, agent._buildPromptCacheKeyForTest({ ...resolved, profileKey: "other/profile" }, "same prompt", options));
  assert.notEqual(key, agent._buildPromptCacheKeyForTest(changedInvocation, "same prompt", options));
  assert.notEqual(key, agent._buildPromptCacheKeyForTest(resolved, "same prompt", { ...options, commandId: "flow.spec" }));
  assert.notEqual(key, agent._buildPromptCacheKeyForTest(resolved, "same prompt", { ...options, systemPrompt: "other system" }));
  assert.notEqual(key, agent._buildPromptCacheKeyForTest(resolved, "other prompt", options));
  assert.notEqual(key, agent._buildPromptCacheKeyForTest(resolved, "same prompt", { ...options, jsonSchema: { ...jsonSchemaA, z: 2 } }));
  assert.notEqual(key, agent._buildPromptCacheKeyForTest(resolved, "same prompt", { ...options, fmtFallback: "other format" }));

  assert.equal(await agent.call("same prompt", { commandId: "flow.review" }), "v1");
  providers["test/exec"].args = providers["test/exec-mutated"].args;
  const changed = await agent.call("same prompt", { commandId: "flow.review" });

  assert.equal(changed, "v2");
  assert.equal(readCount(countFile), 2);
});

test("R3: changed provider profile or prompt identity misses the cache", async () => {
  const root = tmpDir();
  const countFile = path.join(root, "count.txt");
  const flowManager = setupActiveFlow(root);
  const providers = {
    "test/exec": {
      command: process.execPath,
      args: ["-e", "require('fs').appendFileSync(process.argv[1], 'a'); process.stdout.write('a')", countFile, "{{PROMPT}}"],
    },
    "other/exec": {
      command: process.execPath,
      args: ["-e", "require('fs').appendFileSync(process.argv[1], 'b'); process.stdout.write('b')", countFile, "{{PROMPT}}"],
    },
    "test/exec-alt": {
      command: process.execPath,
      args: ["-e", "require('fs').appendFileSync(process.argv[1], 'a'); process.stdout.write('a')", countFile, "{{PROMPT}}"],
    },
  };
  const config = {
    agent: {
      default: "test/exec",
      useProfile: "switching",
      profiles: {
        switching: { "flow.a": "test/exec", "flow.a2": "test/exec", "flow.b": "other/exec", "flow.alt": "test/exec-alt" },
        providerA: { "flow.same": "test/exec" },
        providerB: { "flow.same": "other/exec" },
      },
      providers,
      timeout: 30,
      retryCount: 0,
    },
  };
  const agent = new Agent({
    config,
    paths: { root, agentWorkDir: path.join(root, ".tmp") },
    registry: new ProviderRegistry(config.agent.providers),
    logger: new Logger({ logDir: path.join(root, ".tmp", "logs"), enabled: false, flowManager, cwd: root }),
    flowManager,
  });
  const originalProfile = process.env.SDD_FORGE_PROFILE;
  try {
    process.env.SDD_FORGE_PROFILE = "providerA";
    assert.equal(await agent.call("same", { commandId: "flow.same", systemPrompt: "sys", jsonSchema: { a: 1 }, fmtFallback: "fmt" }), "a");
    assert.equal(await agent.call("same", { commandId: "flow.same", systemPrompt: "sys", jsonSchema: { a: 1 }, fmtFallback: "fmt" }), "a");
    process.env.SDD_FORGE_PROFILE = "providerB";
    assert.equal(await agent.call("same", { commandId: "flow.same", systemPrompt: "sys", jsonSchema: { a: 1 }, fmtFallback: "fmt" }), "b");
  } finally {
    if (originalProfile == null) delete process.env.SDD_FORGE_PROFILE;
    else process.env.SDD_FORGE_PROFILE = originalProfile;
  }

  assert.equal(await agent.call("same", { commandId: "flow.a", systemPrompt: "sys", jsonSchema: { a: 1 }, fmtFallback: "fmt" }), "a");
  assert.equal(await agent.call("same", { commandId: "flow.a", systemPrompt: "sys", jsonSchema: { a: 1 }, fmtFallback: "fmt" }), "a");
  assert.equal(await agent.call("same", { commandId: "flow.a2", systemPrompt: "sys", jsonSchema: { a: 1 }, fmtFallback: "fmt" }), "a");
  assert.equal(await agent.call("same", { commandId: "flow.b", systemPrompt: "sys", jsonSchema: { a: 1 }, fmtFallback: "fmt" }), "b");
  assert.equal(await agent.call("same", { commandId: "flow.alt", systemPrompt: "sys", jsonSchema: { a: 1 }, fmtFallback: "fmt" }), "a");
  providers["test/exec"].args = ["-e", "require('fs').appendFileSync(process.argv[1], 'c'); process.stdout.write('c')", countFile, "{{PROMPT}}"];
  assert.equal(await agent.call("same", { commandId: "flow.a", systemPrompt: "sys", jsonSchema: { a: 1 }, fmtFallback: "fmt" }), "c");
  assert.equal(await agent.call("same", { commandId: "flow.a", systemPrompt: "changed", jsonSchema: { a: 1 }, fmtFallback: "fmt" }), "c");
  assert.equal(await agent.call("same", { commandId: "flow.a", systemPrompt: "sys", jsonSchema: { a: 2 }, fmtFallback: "fmt" }), "c");
  assert.equal(await agent.call("same", { commandId: "flow.a", systemPrompt: "sys", jsonSchema: { a: 1 }, fmtFallback: "changed" }), "c");
  assert.equal(await agent.call("different", { commandId: "flow.a", systemPrompt: "sys", jsonSchema: { a: 1 }, fmtFallback: "fmt" }), "c");
  assert.equal(fs.readFileSync(countFile, "utf8"), "abaabaccccc");
});

test("R4: empty responses, provider errors, and parse failures are not stored", async () => {
  const root = tmpDir();
  const countFile = path.join(root, "count.txt");
  const flowManager = setupActiveFlow(root);
  const emptyAgent = makeCountingAgent({
    root,
    countFile,
    flowManager,
    providers: {
      "test/empty": {
        command: process.execPath,
        args: ["-e", "require('fs').appendFileSync(process.argv[1], 'e')", countFile, "{{PROMPT}}"],
      },
    },
    defaultProvider: "test/empty",
  });

  assert.equal(await emptyAgent.call("empty", { commandId: "flow.empty", retryCount: 0 }), "");
  assert.equal(await emptyAgent.call("empty", { commandId: "flow.empty", retryCount: 0 }), "");
  assert.equal(fs.readFileSync(countFile, "utf8"), "ee");

  const failAgent = makeCountingAgent({
    root,
    countFile,
    flowManager,
    providers: {
      "test/fail": {
        command: process.execPath,
        args: ["-e", "require('fs').appendFileSync(process.argv[1], 'f'); process.exit(1)", countFile, "{{PROMPT}}"],
      },
    },
    defaultProvider: "test/fail",
  });
  await assert.rejects(failAgent.call("fail", { commandId: "flow.fail", retryCount: 0 }));
  await assert.rejects(failAgent.call("fail", { commandId: "flow.fail", retryCount: 0 }));
  assert.equal(fs.readFileSync(countFile, "utf8"), "eeff");

  const claudeFixture = path.join(root, "claude-fixture.mjs");
  fs.writeFileSync(claudeFixture, "#!/usr/bin/env node\nimport fs from 'fs'; fs.appendFileSync(process.argv[2], 'p'); process.stdout.write('not-json');\n", { mode: 0o755 });
  const parseAgent = makeCountingAgent({
    root,
    countFile,
    flowManager,
    providers: {
      "claude/spec-fixture": {
        command: pathToFileURL(claudeFixture).pathname,
        args: [countFile, "{{PROMPT}}"],
        jsonOutputFlag: "--output-format json",
      },
    },
    defaultProvider: "claude/spec-fixture",
  });

  assert.equal(await parseAgent.call("parse", { commandId: "flow.parse" }), "not-json");
  assert.equal(await parseAgent.call("parse", { commandId: "flow.parse" }), "not-json");
  assert.equal(fs.readFileSync(countFile, "utf8"), "eeffpp");
});

test("R5: cache hits are recorded separately from real provider call count", async () => {
  const root = tmpDir();
  const countFile = path.join(root, "count.txt");
  const flowManager = setupActiveFlow(root);
  const agent = makeCountingAgent({ root, countFile, flowManager });

  await agent.call("metric prompt", { commandId: "flow.review" });
  await agent.call("metric prompt", { commandId: "flow.review" });

  const flowState = flowManager.load();
  assert.equal(readCount(countFile), 1);
  assert.ok(hasCacheHitEvidence(root, flowState), "cache hit evidence must be recorded separately");
});

test("R6: cache does not cross active flow scopes and is disabled without active flow", async () => {
  const firstRoot = tmpDir();
  const firstCount = path.join(firstRoot, "count.txt");
  const firstFlow = setupActiveFlow(firstRoot, "001-cache");
  const firstAgent = makeCountingAgent({ root: firstRoot, countFile: firstCount, flowManager: firstFlow });
  await firstAgent.call("scope prompt", { commandId: "flow.review" });
  await firstAgent.call("scope prompt", { commandId: "flow.review" });
  assert.equal(readCount(firstCount), 1);

  const secondRoot = tmpDir();
  const secondCount = path.join(secondRoot, "count.txt");
  const secondFlow = setupActiveFlow(secondRoot, "002-cache");
  const secondAgent = makeCountingAgent({ root: secondRoot, countFile: secondCount, flowManager: secondFlow });
  await secondAgent.call("scope prompt", { commandId: "flow.review" });
  assert.equal(readCount(secondCount), 1);

  const sameRootCount = path.join(firstRoot, "same-root-count.txt");
  firstFlow.removeActiveFlow("001-cache");
  const secondState = makeFlowState({
    spec: "specs/002-cache/spec.md",
    featureBranch: "feature/002-cache",
    metrics: [],
  });
  firstFlow.save(secondState);
  firstFlow.addActiveFlow("002-cache", "local");
  const sameRootSecondFlowAgent = makeCountingAgent({ root: firstRoot, countFile: sameRootCount, flowManager: firstFlow });
  await sameRootSecondFlowAgent.call("scope prompt", { commandId: "flow.review" });
  assert.equal(readCount(sameRootCount), 1);

  const noFlowRoot = tmpDir();
  const noFlowCount = path.join(noFlowRoot, "count.txt");
  const noFlowAgent = makeCountingAgent({ root: noFlowRoot, countFile: noFlowCount, flowManager: makeFlowManager(noFlowRoot) });
  await noFlowAgent.call("scope prompt", { commandId: "flow.review" });
  await noFlowAgent.call("scope prompt", { commandId: "flow.review" });
  assert.equal(readCount(noFlowCount), 2);
});

test("R7: cache misses preserve existing Agent.call response and retry behavior", async () => {
  const root = tmpDir();
  const countFile = path.join(root, "count.txt");
  const flowManager = setupActiveFlow(root);
  const script = [
    "const fs = require('fs');",
    "const countFile = process.argv[1];",
    "let count = 0;",
    "try { count = Number(fs.readFileSync(countFile, 'utf8')); } catch {}",
    "fs.writeFileSync(countFile, String(count + 1));",
    "if (count === 0) process.stdout.write('');",
    "else process.stdout.write('recovered');",
  ].join(" ");
  const agent = makeCountingAgent({
    root,
    countFile,
    flowManager,
    providers: {
      "test/retry": {
        command: process.execPath,
        args: ["-e", script, countFile, "{{PROMPT}}"],
      },
    },
    defaultProvider: "test/retry",
  });

  const result = await agent.call("retry prompt", { commandId: "flow.retry", retryCount: 1, retryDelayMs: 1 });
  assert.equal(result, "recovered");
  assert.equal(readCount(countFile), 2);
});
