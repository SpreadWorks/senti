// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specDir = path.resolve(__dirname, "..");
const root = path.resolve(specDir, "../..");
const pluginWorkspaceManifest = path.join(specDir, "plugin-workspace.json");
const safeSpecPath = "specs/288-workflow-plugin-migration/spec.json";
const expectedWorkflowSurface = {
  add: { positionals: ["title"], options: ["--status", "--category", "--body"] },
  update: { positionals: ["hash"], options: ["--status", "--title", "--body"] },
  show: { positionals: ["hash"], options: [] },
  search: { positionals: ["query"], options: [] },
  list: { positionals: [], options: ["--status"] },
  publish: { positionals: ["hash"], options: ["--label"] },
  ideas: { positionals: [], options: ["--spec"] },
};

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function listFiles(dir, predicate = () => true) {
  const out = [];
  const visit = (current) => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && predicate(full)) out.push(full);
    }
  };
  visit(dir);
  return out.sort();
}

function jsFiles(dir) {
  return listFiles(dir, (file) => file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs"));
}

function rel(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function assertNoMatchInFiles(files, pattern, message) {
  const offenders = files
    .map((file) => ({ file, text: readText(file) }))
    .filter(({ text }) => pattern.test(text))
    .map(({ file }) => rel(file));
  assert.deepEqual(offenders, [], message);
}

async function importFresh(file) {
  return import(`${pathToFileURL(file).href}?t=${Date.now()}-${Math.random()}`);
}

function pluginWorkspace() {
  assert.equal(fs.existsSync(pluginWorkspaceManifest), true, "plugin-workspace.json must record the in-flow plugin workspace");
  const manifest = readJson(pluginWorkspaceManifest);
  assert.equal(typeof manifest.path, "string", "plugin-workspace.json path must be a string");
  assert.equal(path.isAbsolute(manifest.path), false, "plugin workspace path must be root-relative");
  assert.equal(manifest.path.includes(".."), false, "plugin workspace path must not contain parent traversal");
  const pluginRoot = path.resolve(root, manifest.path);
  assert.equal(pluginRoot.startsWith(root + path.sep), true, "plugin workspace must live under the active flow worktree");
  assert.equal(fs.existsSync(path.join(pluginRoot, "plugin.json")), true, "plugin workspace must contain plugin.json");
  assert.match(String(manifest.sourceCommit || ""), /^[0-9a-f]{40}$/i, "plugin workspace must record a source commit");
  const sourceIdentity = [
    manifest.sourceRepository,
    manifest.sourceRemote,
    manifest.sourceUrl,
    manifest.sourcePath,
    manifest.externalRepository,
  ].filter(Boolean).join("\n");
  assert.match(sourceIdentity, /senti-workflow-plugin|workflow-plugin/, "plugin workspace manifest must identify the external workflow plugin source");
  assert.equal(readJson(path.join(pluginRoot, "plugin.json")).name, "workflow", "external plugin manifest must identify the workflow plugin");
  return pluginRoot;
}

function coreRuntimeFiles() {
  return [
    ...jsFiles(path.join(root, "src")),
    ...listFiles(path.join(root, "tests"), (file) => file.endsWith(".js")),
    path.join(root, "package.json"),
    path.join(root, ".senti", "config.json"),
  ].filter((file) => fs.existsSync(file));
}

function envelopeApi() {
  return {
    Envelope: {
      ok: (type = "plugin", key = "workflow", data = {}) => ({ ok: true, type, key, data, errors: [] }),
      fail: (type = "plugin", key = "workflow", code = "PLUGIN_FAILED", messages = "plugin failed", data = null) => ({
        ok: false,
        type,
        key,
        data,
        errors: [{ level: "fatal", code, messages: Array.isArray(messages) ? messages : [messages] }],
      }),
    },
    FlowCommandHook: class FlowCommandHook {},
  };
}

async function workflowCommand(pluginRoot) {
  const mod = await importFresh(path.join(pluginRoot, "commands", "workflow.js"));
  assert.equal(typeof mod.default, "function", "workflow command module must export register(api)");
  const registered = mod.default(envelopeApi());
  assert.equal(typeof registered?.main, "function", "workflow register(api) must return { main }");
  return registered;
}

function fakeServices() {
  const calls = [];
  const record = (service, method) => async (input) => {
    calls.push({ service, method, input });
    return { ok: true, id: `${service}:${method}` };
  };
  return {
    calls,
    services: {
      board: {
        add: record("board", "add"),
        update: record("board", "update"),
        show: record("board", "show"),
        search: record("board", "search"),
        list: record("board", "list"),
      },
      publish: { publish: record("publish", "publish") },
      issueStart: { start: record("issueStart", "start") },
      ideas: { extract: record("ideas", "extract") },
    },
  };
}

function fakeClients(calls = []) {
  return {
    boardClient: {
      async add(input) { calls.push(["boardClient", "add", input]); return { id: "added" }; },
      async update(input) { calls.push(["boardClient", "update", input]); return { id: "updated" }; },
      async show(input) { calls.push(["boardClient", "show", input]); return { id: "shown", title: "日本語タイトル", body: "本文" }; },
      async search(input) { calls.push(["boardClient", "search", input]); return []; },
      async list(input) { calls.push(["boardClient", "list", input]); return []; },
      async moveIssue(input) { calls.push(["boardClient", "moveIssue", input]); return { id: "moved" }; },
    },
    githubClient: {
      async createIssue(input) { calls.push(["githubClient", "createIssue", input]); return { url: "https://example.invalid/issues/1" }; },
      async publish(input) { calls.push(["githubClient", "publish", input]); return { url: "https://example.invalid/issues/1" }; },
    },
    agent: {
      resolve(commandId, options = {}) { calls.push(["agent", "resolve", { commandId, options }]); return true; },
      async call(prompt, options = {}) { calls.push(["agent", "call", { prompt, options }]); return JSON.stringify({ title: "Generated", body: "Generated body", keep: true }); },
    },
  };
}

async function runWorkflow(command, argv, services = fakeServices()) {
  const result = await command.main(argv, {
    project: { root },
    plugin: { id: "workflow", root: pluginWorkspace(), commandPath: "commands/workflow.js" },
    config: {
      workflow: {
        flowIntegration: "enable",
        languages: { source: "ja", publish: "en" },
        agent: {
          publish: { profile: "workflow-publish" },
          classify: { profile: "workflow-classify" },
          similarity: { profile: "workflow-similarity" },
          compose: { profile: "workflow-compose" },
        },
      },
    },
    services: services.services,
    rootConfig: { lang: "ja" },
    envelope: envelopeApi().Envelope,
  });
  return { result, calls: services.calls };
}

async function runWorkflowWithClients(command, argv) {
  const clientCalls = [];
  const result = await command.main(argv, {
    project: { root },
    plugin: { id: "workflow", root: pluginWorkspace(), commandPath: "commands/workflow.js" },
    config: { workflow: { flowIntegration: "enable", languages: { source: "ja", publish: "en" } } },
    clients: fakeClients(clientCalls),
    rootConfig: { lang: "ja" },
    envelope: envelopeApi().Envelope,
  });
  return { result, clientCalls };
}

function writeTempProjectConfig(tmp) {
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".senti", "config.json"), JSON.stringify({
    plugin: {
      sources: [{ id: "local", type: "local", path: "." }],
      packages: [{ id: "workflow", source: "local", commit: "0".repeat(40) }],
    },
  }), "utf8");
}

function assertCommandFailure(result, label) {
  assert.equal(result.ok, false, `${label} must return a failure envelope`);
  assert.ok(result.exitCode === undefined || result.exitCode !== 0, `${label} must not report a zero exit code`);
  assert.ok(result.errors?.length > 0, `${label} must include validation or command errors`);
}

test("R1: external workflow plugin workspace is recorded inside the active flow worktree", () => {
  const pluginRoot = pluginWorkspace();
  assert.equal(fs.existsSync(pluginRoot), true, "recorded plugin workspace path must exist");
  const check = spawnSync(process.execPath, ["--check", "commands/workflow.js"], {
    cwd: pluginRoot,
    encoding: "utf8",
  });
  assert.equal(check.status, 0, `plugin command syntax check must run from plugin workspace\nstdout=${check.stdout}\nstderr=${check.stderr}`);
});

test("R2: workflow command validates every public subcommand before routing to plugin services", async () => {
  const pluginRoot = pluginWorkspace();
  assertNoMatchInFiles(jsFiles(pluginRoot), /src\/workflow|packageRoot.+workflow.+index\.js|workflow\/index\.js/, "plugin JS must not import or shell into core workflow runtime");

  const command = await workflowCommand(pluginRoot);
  assert.deepEqual(command.publicSurface, expectedWorkflowSurface, "workflow command must declare the complete public argument and option surface");
  const validCases = [
    {
      argv: ["add", "日本語タイトル", "--status", "Ideas", "--category", "BUG", "--body", "本文"],
      service: "board",
      method: "add",
      input: { title: "日本語タイトル", status: "Ideas", category: "BUG", body: "本文" },
    },
    {
      argv: ["update", "abc123", "--status", "To-do", "--title", "更新タイトル", "--body", "本文"],
      service: "board",
      method: "update",
      input: { hash: "abc123", status: "To-do", title: "更新タイトル", body: "本文" },
    },
    { argv: ["show", "abc123"], service: "board", method: "show", input: { hash: "abc123" } },
    { argv: ["search", "検索語"], service: "board", method: "search", input: { query: "検索語" } },
    { argv: ["list", "--status", "Ideas"], service: "board", method: "list", input: { status: "Ideas" } },
    { argv: ["publish", "abc123", "--label", "enhancement"], service: "publish", method: "publish", input: { hash: "abc123", label: "enhancement" } },
    { argv: ["ideas", "--spec", safeSpecPath], service: "ideas", method: "extract", input: { spec: safeSpecPath } },
  ];

  for (const expected of validCases) {
    const { result, calls } = await runWorkflow(command, expected.argv);
    assert.equal(result.ok, true, `${expected.argv.join(" ")} should succeed with fake services`);
    assert.deepEqual(
      calls.map(({ service, method }) => ({ service, method })),
      [{ service: expected.service, method: expected.method }],
      `${expected.argv[0]} must route through the plugin-owned service boundary`,
    );
    assert.deepEqual(calls[0].input, expected.input, `${expected.argv[0]} must preserve validated argument and option values`);
  }

  const invalidCases = [
    ["add", "", "--status", "Done"],
    ["add", "ascii only"],
    ["add", "日本語タイトル", "--status", "Done"],
    ["add", "日本語タイトル", "--category", "INVALID"],
    ["add", "日本語タイトル", "--body", "ascii"],
    ["add", "日本語タイトル", "--label", "wrong-surface"],
    ["update", "", "--title", "更新"],
    ["update", "abc123", "--status", ""],
    ["update", "abc123", "--title", "ascii"],
    ["update", "abc123", "--body", "ascii"],
    ["update", "abc123", "--category", "BUG"],
    ["show"],
    ["show", ""],
    ["show", "abc123", "--status", "Ideas"],
    ["search", ""],
    ["search", "検索語", "--status", "Ideas"],
    ["list", "--status", ""],
    ["list", "--category", "BUG"],
    ["publish"],
    ["publish", "abc123", "--label", ""],
    ["publish", "abc123", "--status", "Ideas"],
    ["ideas"],
    ["ideas", "--spec", "/tmp/spec.json"],
    ["ideas", "--spec", "../spec.json"],
    ["ideas", "--spec", "specs/288-workflow-plugin-migration/spec.json;rm"],
    ["ideas", "--spec", "README.md"],
    ["ideas", "--status", "Ideas"],
    ["issue-start", "375"],
    ["issue-log-import", "--spec", safeSpecPath],
    ["unknown"],
  ];

  for (const argv of invalidCases) {
    const { result, calls } = await runWorkflow(command, argv);
    assertCommandFailure(result, argv.join(" "));
    assert.deepEqual(calls, [], `${argv.join(" ")} must fail before invoking services`);
  }
});

test("R2/R3: workflow command production path constructs plugin-owned services from clients", async () => {
  const command = await workflowCommand(pluginWorkspace());
  const productionCases = [
    { argv: ["add", "日本語タイトル"], client: "boardClient", method: "add" },
    { argv: ["update", "abc123", "--title", "更新タイトル"], client: "boardClient", method: "update" },
    { argv: ["show", "abc123"], client: "boardClient", method: "show" },
    { argv: ["search", "検索語"], client: "boardClient", method: "search" },
    { argv: ["list"], client: "boardClient", method: "list" },
    { argv: ["publish", "abc123"], client: "githubClient", method: "createIssue" },
    { argv: ["ideas", "--spec", safeSpecPath], client: "agent", method: "call" },
  ];
  for (const expected of productionCases) {
    const { result, clientCalls } = await runWorkflowWithClients(command, expected.argv);
    assert.equal(result.ok, true, `${expected.argv.join(" ")} should succeed through production service construction`);
    assert.ok(
      clientCalls.some(([client, method]) => client === expected.client && method === expected.method),
      `${expected.argv[0]} must use plugin-owned services backed by ${expected.client}.${expected.method}`,
    );
  }
});

test("R3: workflow plugin exposes real shared service modules for command and hook use", async () => {
  const pluginRoot = pluginWorkspace();
  assertNoMatchInFiles(jsFiles(pluginRoot), /from\s+["'][^"']*src\/workflow|require\(["'][^"']*src\/workflow/, "plugin services must not import core workflow modules");

  const mod = await importFresh(path.join(pluginRoot, "lib", "services", "index.js"));
  assert.equal(typeof mod.createWorkflowServices, "function", "plugin must export createWorkflowServices()");
  const services = mod.createWorkflowServices({
    boardClient: {},
    githubClient: {},
    agent: { resolve() { return true; }, async call() { return "ok"; } },
    config: { workflow: { languages: { source: "ja", publish: "en" } } },
    rootConfig: { lang: "ja" },
  });

  const expectedMethods = [
    ["board", "add"],
    ["board", "update"],
    ["board", "show"],
    ["board", "search"],
    ["board", "list"],
    ["publish", "publish"],
    ["issueStart", "start"],
    ["ideas", "extract"],
  ];
  for (const [service, method] of expectedMethods) {
    assert.equal(typeof services?.[service]?.[method], "function", `${service}.${method} must be a real shared service method`);
  }

  const clientCalls = [];
  const instrumented = mod.createWorkflowServices({
    ...fakeClients(clientCalls),
    config: { workflow: { languages: { source: "ja", publish: "en" } } },
    rootConfig: { lang: "ja" },
  });

  await instrumented.board.add({ title: "日本語タイトル", status: "Ideas", category: "BUG", body: "本文" });
  await instrumented.board.update({ hash: "abc123", status: "To-do", title: "更新タイトル", body: "本文" });
  await instrumented.board.show({ hash: "abc123" });
  await instrumented.board.search({ query: "検索語" });
  await instrumented.board.list({ status: "Ideas" });
  await instrumented.publish.publish({ hash: "abc123", label: "enhancement" });
  await instrumented.issueStart.start({ issue: 375, flow: { spec: safeSpecPath, runId: "run-1" } });
  await instrumented.ideas.extract({ spec: safeSpecPath, issueLogEntries: [{ reason: "board config missing", step: "finalize-cleanup" }] });

  for (const expected of [
    ["boardClient", "add"],
    ["boardClient", "update"],
    ["boardClient", "show"],
    ["boardClient", "search"],
    ["boardClient", "list"],
    ["boardClient", "moveIssue"],
    ["githubClient", "createIssue"],
  ]) {
    assert.ok(clientCalls.some(([client, method]) => client === expected[0] && method === expected[1]), `${expected.join(".")} must be exercised by real services`);
  }
});

test("R3: workflow hooks call shared plugin services instead of shelling out to workflow CLI", async () => {
  const pluginRoot = pluginWorkspace();
  const hookFiles = jsFiles(path.join(pluginRoot, "hooks"));
  const hookClasses = [];
  for (const file of hookFiles) {
    const mod = await importFresh(file);
    if (typeof mod.default !== "function") continue;
    const HookClass = mod.default(envelopeApi());
    hookClasses.push(HookClass);
  }

  const prepareHook = hookClasses.find((HookClass) => HookClass.command === "prepare" && HookClass.hook === "post");
  const finalizeHook = hookClasses.find((HookClass) => HookClass.command === "finalize-cleanup" && HookClass.hook === "post");
  assert.ok(prepareHook, "workflow plugin must expose a prepare.post hook");
  assert.ok(finalizeHook, "workflow plugin must expose a finalize-cleanup.post hook");

  for (const HookClass of [prepareHook, finalizeHook]) {
    assert.equal(typeof HookClass.prototype.run, "function", `${HookClass.name} must implement run(context)`);
  }

  const flow = {
    issue: 375,
    spec: safeSpecPath,
    runId: "flow-run-id",
    plugins: { flowCommandHooks: [{ pluginId: "workflow", command: "prepare", hook: "post" }] },
  };
  const artifacts = {
    writes: [],
    async writeJson(relPath, value) {
      this.writes.push({ relPath, value });
    },
    async readJson() {
      return [{ reason: "board config missing", step: "finalize-cleanup" }];
    },
  };

  const prepareServices = fakeServices();
  const prepareResult = await new prepareHook().run({
    project: { root },
    plugin: { id: "workflow", root: pluginRoot },
    config: { workflow: { flowIntegration: "enable" } },
    flow,
    result: { data: { issue: 375, spec: safeSpecPath, runId: "flow-run-id" } },
    artifacts,
    services: prepareServices.services,
    envelope: envelopeApi().Envelope,
  });
  assert.equal(prepareResult.ok, true, "prepare.post must be non-fatal when service succeeds");
  assert.deepEqual(
    prepareServices.calls.map(({ service, method }) => ({ service, method })),
    [{ service: "issueStart", method: "start" }],
    "prepare.post must call the issue-start service directly",
  );
  assert.equal(prepareServices.calls[0].input.issue, 375);
  assert.equal(prepareServices.calls[0].input.flow.spec, safeSpecPath);
  assert.equal(prepareServices.calls[0].input.flow.runId, "flow-run-id");

  const failingServices = fakeServices();
  failingServices.services.ideas.extract = async () => {
    throw new Error("gh unavailable");
  };
  const finalizeResult = await new finalizeHook().run({
    project: { root },
    plugin: { id: "workflow", root: pluginRoot },
    config: { workflow: { flowIntegration: "enable" } },
    flow,
    result: { data: { report: { artifactPath: "specs/288-workflow-plugin-migration/report.md" } } },
    artifacts,
    services: failingServices.services,
    envelope: envelopeApi().Envelope,
  });
  assert.equal(finalizeResult.ok, true, "finalize-cleanup.post business failures must remain non-fatal");
  assert.ok(
    finalizeResult.data?.warnings?.length || finalizeResult.data?.followUps?.length || artifacts.writes.length,
    "finalize-cleanup.post must surface warning, follow-up, or artifact evidence for business failures",
  );
});

test("R5: workflow plugin agent adapter resolves publish and ideas overrides through public context", async () => {
  const pluginRoot = pluginWorkspace();
  const agentModulePath = path.join(pluginRoot, "lib", "services", "agent.js");
  const mod = await importFresh(agentModulePath);
  assert.equal(typeof mod.WorkflowAgentResolver, "function", "plugin must export WorkflowAgentResolver");

  const calls = [];
  const agent = {
    resolve(commandId, options = {}) {
      calls.push({ op: "resolve", commandId, options });
      return { commandId, options };
    },
    async call(prompt, options = {}) {
      calls.push({ op: "call", prompt, options });
      return "ok";
    },
  };
  const resolver = new mod.WorkflowAgentResolver({
    agent,
    lang: "ja",
    config: {
      workflow: {
        agent: {
          publish: { provider: "codex/gpt-5.4", profile: "workflow-publish" },
          classify: { provider: "claude/haiku", profile: "workflow-classify" },
          similarity: { provider: "codex/gpt-5.4-mini", profile: "workflow-similarity" },
          compose: { provider: "claude/sonnet", profile: "workflow-compose" },
        },
      },
    },
  });

  for (const name of ["publish", "classify", "similarity", "compose"]) {
    assert.equal(typeof resolver[name], "function", `WorkflowAgentResolver must expose ${name}()`);
    await resolver[name]("prompt text", { item: "value" });
  }

  const expectedProviders = {
    publish: "codex/gpt-5.4",
    classify: "claude/haiku",
    similarity: "codex/gpt-5.4-mini",
    compose: "claude/sonnet",
  };
  for (const name of ["publish", "classify", "similarity", "compose"]) {
    const call = calls.find((entry) => entry.op === "call" && entry.options.workflowAgent === name);
    const resolve = calls.find((entry) => entry.op === "resolve" && entry.options.workflowAgent === name);
    assert.ok(resolve, `${name} must resolve through the public plugin agent context before calling`);
    assert.ok(call, `${name} must call the public plugin agent context`);
    assert.equal(call.options.lang, "ja", `${name} must propagate root lang`);
    assert.equal(call.options.profile, `workflow-${name}`, `${name} must use plugin.config.workflow.agent.${name}.profile`);
    assert.equal(resolve.options.provider, expectedProviders[name], `${name} must resolve plugin.config.workflow.agent.${name}.provider`);
    assert.equal(call.options.provider, expectedProviders[name], `${name} must pass plugin.config.workflow.agent.${name}.provider to call`);
  }

  const fallbackCalls = [];
  const fallbackResolver = new mod.WorkflowAgentResolver({
    agent: {
      resolve(commandId, options = {}) {
        fallbackCalls.push({ op: "resolve", commandId, options });
        return { commandId, options };
      },
      async call(prompt, options = {}) {
        fallbackCalls.push({ op: "call", prompt, options });
        return "ok";
      },
    },
    lang: "ja",
    config: { workflow: {} },
  });
  for (const name of ["publish", "classify", "similarity", "compose"]) {
    await fallbackResolver[name]("prompt text", {});
    const call = fallbackCalls.find((entry) => entry.op === "call" && entry.options.workflowAgent === name);
    const resolve = fallbackCalls.find((entry) => entry.op === "resolve" && entry.options.workflowAgent === name);
    assert.ok(resolve, `${name} fallback must resolve through the public agent context`);
    assert.ok(call, `${name} fallback must call through the public agent context`);
    assert.equal(call.options.lang, "ja", `${name} fallback must propagate root lang`);
    assert.equal(Object.hasOwn(call.options, "provider"), false, `${name} fallback must not invent provider overrides`);
    assert.equal(Object.hasOwn(call.options, "profile"), false, `${name} fallback must not invent profile overrides`);
  }
});

test("R5: publish and ideas services use WorkflowAgentResolver call sites", async () => {
  const pluginRoot = pluginWorkspace();
  const mod = await importFresh(path.join(pluginRoot, "lib", "services", "index.js"));
  const calls = [];
  const services = mod.createWorkflowServices({
    boardClient: {
      async get() {
        return { hash: "abc123", title: "日本語タイトル", body: "本文" };
      },
    },
    githubClient: {
      async publish() {
        return { url: "https://example.invalid/issue/1" };
      },
    },
    agent: {
      resolve(commandId, options = {}) {
        calls.push({ op: "resolve", commandId, options });
        return { commandId, options };
      },
      async call(prompt, options = {}) {
        calls.push({ op: "call", prompt, options });
        return JSON.stringify({ title: "Generated", body: "Generated body", candidates: [] });
      },
    },
    config: {
      workflow: {
        agent: {
          publish: { provider: "codex/gpt-5.4", profile: "workflow-publish" },
          classify: { provider: "claude/haiku", profile: "workflow-classify" },
          similarity: { provider: "codex/gpt-5.4-mini", profile: "workflow-similarity" },
          compose: { provider: "claude/sonnet", profile: "workflow-compose" },
        },
      },
    },
    rootConfig: { lang: "ja" },
  });

  await services.publish.publish({ hash: "abc123", label: "enhancement" });
  await services.ideas.extract({ spec: safeSpecPath, issueLogEntries: [{ reason: "board config missing", step: "finalize-cleanup" }] });

  for (const name of ["publish", "classify", "similarity", "compose"]) {
    assert.ok(calls.some((entry) => entry.op === "call" && entry.options.workflowAgent === name), `${name} service path must use WorkflowAgentResolver`);
  }
});

test("R6: core workflow runtime and bundled workflow compatibility copy are removed", () => {
  assert.equal(fs.existsSync(path.join(root, "src", "workflow")), false, "src/workflow must be removed");
  assert.equal(fs.existsSync(path.join(root, "src", "official-plugins", "senti-workflow-plugin")), false, "bundled workflow compatibility plugin must be removed");
});

test("R7: core has no workflow-specific config, bootstrap, help, locale, or agent defaults", () => {
  const files = coreRuntimeFiles();
  assertNoMatchInFiles(files, /officialWorkflowPluginRoot|official workflow plugin|workflow\.publish|workflow\.flowIntegration|CONFIG_SCHEMA[\s\S]*workflow:\s*\{/, "core must not retain workflow-specific bootstrap/config/agent defaults");
  assertNoMatchInFiles([
    path.join(root, "src", "lib", "config.js"),
    path.join(root, "src", "lib", "agent-defaults.js"),
    path.join(root, "src", "setup.js"),
    path.join(root, "src", "upgrade.js"),
  ].filter((file) => fs.existsSync(file)), /(["']?workflow["']?\s*:\s*\{)|workflow\.languages|workflow\.flowIntegration|workflow\.publish|experimental\.workflow|officialWorkflowPluginRoot|ensureOfficialPackage[\s\S]{0,400}\bworkflow\b/i, "core config/default/migration/bootstrap files must not retain workflow-specific entries");
  assertNoMatchInFiles([
    path.join(root, "src", "locale", "en", "ui.json"),
    path.join(root, "src", "locale", "ja", "ui.json"),
  ].filter((file) => fs.existsSync(file)), /Manage GitHub Projects board drafts|GitHub Projects ボードのドラフト管理/, "core locale help must not describe workflow feature");
});

test("R8: core flow prompts and skills do not hardcode workflow integration commands", () => {
  const files = [
    ...listFiles(path.join(root, "src", "flow", "prompts"), (file) => file.endsWith(".md")),
    ...listFiles(path.join(root, "src", "skills"), (file) => file.endsWith(".md")),
  ];
  assertNoMatchInFiles(
    files,
    /\bissue-start\b|\bissue-log-import\b|senti\s+workflow\s+add|\bworkflow\s+add\b|workflow board integration|board registration candidates|workflow\.flowIntegration/i,
    "flow prompts and skills must not hardcode workflow board integration guidance",
  );
});

test("R9: removed workflow subcommands fail before any service call and ideas remains public", async () => {
  const command = await workflowCommand(pluginWorkspace());
  for (const argv of [["issue-start", "375"], ["issue-log-import", "--spec", safeSpecPath]]) {
    const { result, calls } = await runWorkflow(command, argv);
    assertCommandFailure(result, argv.join(" "));
    assert.deepEqual(calls, [], `${argv.join(" ")} must not route to compatibility services`);
  }
  const { result, calls } = await runWorkflow(command, ["ideas", "--spec", safeSpecPath]);
  assert.equal(result.ok, true, "ideas must remain the public replacement command");
  assert.deepEqual(calls.map(({ service, method }) => ({ service, method })), [{ service: "ideas", method: "extract" }]);
});

test("R10: core tests use generic plugin fixtures instead of workflow feature expectations", () => {
  const testFiles = listFiles(path.join(root, "tests"));
  const offenders = testFiles.filter((file) => {
    const relative = rel(file);
    if (relative.includes("github-actions-pipelines")) return false;
    const text = readText(file);
    return /(^|\/)workflow-[^/]+|src\/workflow|workflow validation|workflow category|workflow issue-log-import|workflow graphql|workflow registry|workflow board candidate/i.test(`${relative}\n${text}`);
  });
  assert.deepEqual(offenders.map(rel), [], "core tests and fixtures must not keep workflow feature-specific expectations");
});

test("R11: external workflow plugin is enabled, discoverable, and smoke-runnable", async () => {
  const pluginRoot = pluginWorkspace();
  const workspaceManifest = readJson(pluginWorkspaceManifest);
  const config = readJson(path.join(root, ".senti", "config.json"));
  const packages = config.plugin?.packages || [];
  const sources = config.plugin?.sources || [];
  const workflowPackage = packages.find((pkg) => pkg.id === "workflow" && pkg.enabled !== false);
  assert.ok(workflowPackage, "project config must enable workflow plugin package");
  const source = sources.find((entry) => entry.id === workflowPackage.source);
  assert.ok(source, "workflow plugin package source must exist");
  assert.equal(path.resolve(root, source.path), pluginRoot, "workflow plugin source must resolve to the recorded in-boundary external plugin workspace");
  assert.equal(workflowPackage.commit, workspaceManifest.sourceCommit, "enabled workflow plugin package commit must match recorded external plugin source commit");

  const { loadPluginRegistry, discoverFlowCommandHooks } = await importFresh(path.join(root, "src", "lib", "plugin-registry.js"));
  const registry = loadPluginRegistry(root);
  const workflowCommandEntry = registry.resolveCommand("workflow");
  assert.ok(workflowCommandEntry, "plugin registry must discover the workflow command");
  assert.match(workflowCommandEntry.absolutePath, /\.senti\/plugins\/workflow\/commands\/workflow\.js$/, "registry command must come from the installed external workflow plugin package");
  const hooks = await discoverFlowCommandHooks(root);
  assert.ok(hooks.some((hook) => hook.pluginId === "workflow" && hook.command === "prepare" && hook.hook === "post"), "prepare.post hook must be discoverable");
  assert.ok(hooks.some((hook) => hook.pluginId === "workflow" && hook.command === "finalize-cleanup" && hook.hook === "post"), "finalize-cleanup.post hook must be discoverable");

  const smoke = spawnSync(process.execPath, ["src/senti.js", "workflow", "--help"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(smoke.status, 0, `senti workflow --help must succeed\nstdout=${smoke.stdout}\nstderr=${smoke.stderr}`);
});

test("R12: changed skills and templates have upgrade evidence", () => {
  const changed = execFileSync("git", ["diff", "--name-only", "main", "--", "src/skills", "src/presets", ".agents/skills", ".claude/skills"], {
    cwd: root,
    encoding: "utf8",
  }).trim().split("\n").filter(Boolean);
  if (changed.some((file) => file.startsWith("src/skills/") || file.startsWith("src/presets/"))) {
    const upgradeResult = path.join(specDir, "upgrade-result.json");
    const upgradeLog = path.join(specDir, "tests", ".raw", "upgrade.log");
    assert.ok(fs.existsSync(upgradeResult) || fs.existsSync(upgradeLog), "senti upgrade evidence must exist when skill or template sources change");
  }

  const deployedFiles = [
    ...listFiles(path.join(root, ".agents", "skills"), (file) => file.endsWith(".md")),
    ...listFiles(path.join(root, ".claude", "skills"), (file) => file.endsWith(".md")),
  ];
  assertNoMatchInFiles(deployedFiles, /workflow\.flowIntegration|senti workflow issue-start|senti workflow issue-log-import/, "deployed skills must match upgraded workflow-free source guidance");
});

test("R4: generic flow hook lifecycle passes durable flow context and records non-fatal warnings", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-plugin-lifecycle-"));
  const pluginRoot = path.join(tmp, ".senti", "plugins", "workflow");
  fs.mkdirSync(path.join(pluginRoot, "hooks"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }), "utf8");
  writeTempProjectConfig(tmp);
  fs.writeFileSync(path.join(pluginRoot, "hooks", "prepare.js"), `
export default function register(api) {
  return class PrepareHook extends api.FlowCommandHook {
    static command = "prepare";
    static hook = "post";
    async run(context) {
      await context.artifacts.writeJson("seen.json", {
        spec: context.flow.spec,
        runId: context.flow.runId,
        issue: context.flow.issue,
        snapshot: context.flow.plugins.flowCommandHooks.length
      });
      throw new Error("board config missing");
    }
  };
}
`, "utf8");

  const { runFlowCommandWithPluginLifecycle } = await importFresh(path.join(root, "src", "lib", "plugin-registry.js"));
  const { runPrepareWithPluginHooks } = await importFresh(path.join(root, "src", "flow", "lib", "run-prepare-spec.js"));
  fs.writeFileSync(path.join(pluginRoot, "hooks", "finalize.js"), `
export default function register(api) {
  return class FinalizeHook extends api.FlowCommandHook {
    static command = "finalize-cleanup";
    static hook = "post";
    async run(context) {
      await context.artifacts.writeJson("finalize-seen.json", {
        spec: context.flow.spec,
        issueLogPath: context.result.data.issueLogPath,
        artifactPath: context.result.data.artifactPath
      });
      throw new Error("AI refinement failed");
    }
  };
}
`, "utf8");
  const prepared = await runPrepareWithPluginHooks({ root: tmp, title: "plugin hook snapshot fixture", request: "fixture request", noBranch: true, issue: 375 });
  const preparedFlow = readJson(path.join(tmp, prepared.flowPath));
  assert.equal(preparedFlow.spec, "specs/001-plugin-hook-snapshot-fixture/spec.json", "prepare helper must write spec path before hooks run");
  assert.equal(typeof preparedFlow.runId, "string", "prepare helper must write runId before hooks run");
  assert.equal(preparedFlow.issue, 375, "prepare helper must write linked issue before hooks run");
  assert.ok(preparedFlow.plugins.flowCommandHooks.some((hook) => hook.command === "prepare" && hook.hook === "post"), "prepare helper must persist hook snapshot before hooks run");
  const preparedArtifact = readJson(path.join(tmp, "specs", "001-plugin-hook-snapshot-fixture", "plugin-artifacts", "workflow", "seen.json"));
  assert.deepEqual(preparedArtifact, {
    spec: "specs/001-plugin-hook-snapshot-fixture/spec.json",
    runId: preparedFlow.runId,
    issue: 375,
    snapshot: preparedFlow.plugins.flowCommandHooks.length,
  }, "prepare.post must receive the newly written flow state including linked issue");

  const snapshot = [{ pluginId: "workflow", module: "hooks/prepare.js", className: "PrepareHook", command: "prepare", hook: "post", priority: 0 }];
  const result = await runFlowCommandWithPluginLifecycle(tmp, snapshot, {
    command: "prepare",
    flow: { ...preparedFlow, issue: 375 },
    main: async () => ({ ok: true, data: { prepared: true } }),
  });

  assert.equal(result.ok, true, "hook business failure must not fail the main lifecycle command");
  assert.equal(result.data.prepared, true, "main command result must be preserved");
  assert.equal(result.warnings.length, 1, "business hook failure must become a warning");
  assert.equal(result.issueLogEntries.length, 1, "business hook failure must become issue-log evidence");
  const artifact = readJson(path.join(tmp, "specs", "001-plugin-hook-snapshot-fixture", "plugin-artifacts", "workflow", "seen.json"));
  assert.deepEqual(artifact, {
    spec: "specs/001-plugin-hook-snapshot-fixture/spec.json",
    runId: preparedFlow.runId,
    issue: 375,
    snapshot: preparedFlow.plugins.flowCommandHooks.length,
  });

  const finalizeSnapshot = [{ pluginId: "workflow", module: "hooks/finalize.js", className: "FinalizeHook", command: "finalize-cleanup", hook: "post", priority: 0 }];
  const finalizeResult = await runFlowCommandWithPluginLifecycle(tmp, finalizeSnapshot, {
    command: "finalize-cleanup",
    flow: { spec: safeSpecPath, runId: "run-1", issue: 375, plugins: { flowCommandHooks: finalizeSnapshot } },
    main: async () => ({ ok: true, data: { artifactPath: "specs/288-workflow-plugin-migration/report.md", issueLogPath: "specs/288-workflow-plugin-migration/issue-log.json" } }),
  });
  assert.equal(finalizeResult.ok, true, "finalize-cleanup hook business failure must not fail the main lifecycle command");
  assert.equal(finalizeResult.warnings.length, 1, "finalize-cleanup hook failure must become a warning");
  assert.equal(finalizeResult.issueLogEntries.length, 1, "finalize-cleanup hook failure must become issue-log evidence");
  const finalizeArtifact = readJson(path.join(tmp, "specs", "288-workflow-plugin-migration", "plugin-artifacts", "workflow", "finalize-seen.json"));
  assert.deepEqual(finalizeArtifact, {
    spec: safeSpecPath,
    issueLogPath: "specs/288-workflow-plugin-migration/issue-log.json",
    artifactPath: "specs/288-workflow-plugin-migration/report.md",
  });
});
