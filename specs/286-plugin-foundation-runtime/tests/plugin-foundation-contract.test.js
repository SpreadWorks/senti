// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const sha = "0123456789abcdef0123456789abcdef01234567";

function sourceUrl(rel) {
  return pathToFileURL(path.join(root, rel)).href;
}

function requiredFunction(mod, name) {
  assert.equal(typeof mod[name], "function", `${name} must be exported`);
  return mod[name];
}

function tmpRoot(name) {
  const base = path.join(root, ".tmp", "plugin-foundation-contract");
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, `${name}-`));
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function baseConfig(overrides = {}) {
  return {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    scan: { include: ["src"] },
    ...overrides,
  };
}

function createProject(name, config) {
  const project = tmpRoot(name);
  writeJson(path.join(project, ".senti", "config.json"), config);
  return project;
}

function createPluginPackage(dir, manifest = {}) {
  writeJson(path.join(dir, "plugin.json"), {
    name: manifest.name || "sample-plugin",
    type: manifest.type || "mixed",
    contributions: manifest.contributions || {},
  });
}

function createInstalledPlugin(project, id = "sample-plugin", manifest = {}) {
  const pluginRoot = path.join(project, ".senti", "plugins", id);
  createPluginPackage(pluginRoot, { name: id, ...manifest });
  return pluginRoot;
}

function initGitRepo(dir) {
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "contract@example.invalid"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Contract Test"], { cwd: dir });
  execFileSync("git", ["add", "."], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "fixture"], { cwd: dir });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
}

function listFiles(base, rel = "") {
  const current = path.join(base, rel);
  const entries = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) entries.push(...listFiles(base, child));
    else entries.push(child);
  }
  return entries;
}

async function assertRejectsMaybeSync(fn, pattern) {
  await assert.rejects(async () => fn(), pattern);
}

test("R1: config validation and registry resolution use plugin.sources/packages[].source", async () => {
  const { validate } = await import(sourceUrl("src/lib/config.js"));
  const registryMod = await import(sourceUrl("src/lib/plugin-registry.js"));
  const pluginCli = await import(sourceUrl("src/plugin.js"));
  const resolvePackages = requiredFunction(registryMod, "resolvePluginPackageSources");
  const renderPluginList = requiredFunction(pluginCli, "renderPluginList");
  const renderMigrationGuide = requiredFunction(pluginCli, "renderPluginSourceMigrationGuide");

  const pluginSource = tmpRoot("r1-source");
  createPluginPackage(pluginSource);
  const commit = initGitRepo(pluginSource);
  const project = createProject("r1-project", baseConfig({
    plugin: {
      sources: [{ id: "local-source", type: "local", path: pluginSource }],
      packages: [{ id: "sample-plugin", source: "local-source", commit }],
    },
  }));

  assert.doesNotThrow(() => validate(readJson(path.join(project, ".senti", "config.json"))));
  assert.throws(
    () => validate(baseConfig({ plugin: { repos: [{ id: "old", source: pluginSource }], packages: [{ id: "sample-plugin", repo: "old", commit }] } })),
    /plugin\.sources|packages\[\]\.source|migrate/i,
  );

  const resolved = await resolvePackages(project);
  assert.deepEqual(resolved.map((entry) => ({ id: entry.id, source: entry.source.id })), [
    { id: "sample-plugin", source: "local-source" },
  ]);
  assert.match(renderPluginList(resolved, { json: false }), /source/i);
  assert.doesNotMatch(renderPluginList(resolved, { json: false }), /\brepo\b/i);
  const jsonOutput = JSON.parse(renderPluginList(resolved, { json: true }));
  assert.deepEqual(jsonOutput.packages.map((entry) => ({ id: entry.id, source: entry.source })), [
    { id: "sample-plugin", source: "local-source" },
  ]);
  assert.equal(Object.hasOwn(jsonOutput, "repos"), false);
  assert.equal(JSON.stringify(jsonOutput).includes('"repo"'), false);
  assert.match(renderMigrationGuide(), /plugin\.sources/i);
  assert.match(renderMigrationGuide(), /packages\[\]\.source/i);
  assert.match(renderMigrationGuide(), /plugin\.repos|packages\[\]\.repo/i);
});

test("R2: installer copies known paths and rejects unsafe package contents", async () => {
  const { installPlugin, PluginManifest } = await import(sourceUrl("src/lib/plugin-registry.js"));
  const source = tmpRoot("req-two-source");
  createPluginPackage(source, {
    contributions: {
      commands: [{ name: "sample-command", path: "commands/sample.js" }],
      skills: [{ name: "senti.sample", path: "skills/senti.sample" }],
      presets: [{ key: "sample-preset", path: "presets/sample-preset" }],
      config: { schema: "config.schema.json", defaults: "config.defaults.json" },
    },
  });
  write(path.join(source, "commands", "sample.js"), "export default function register() { return { main() {} }; }\n");
  write(path.join(source, "skills", "senti.sample", "SKILL.md"), "---\nname: senti.sample\n---\n");
  writeJson(path.join(source, "presets", "sample-preset", "preset.json"), { label: "Sample preset" });
  write(path.join(source, "hooks", "prepare-post.js"), "export default function register() { return class SampleHook {}; }\n");
  writeJson(path.join(source, "config.schema.json"), { type: "object", properties: {} });
  writeJson(path.join(source, "config.defaults.json"), { plugin: { config: { "sample-plugin": { mode: "default" } } } });
  write(path.join(source, "not-allowed.txt"), "must not be installed\n");
  const commit = initGitRepo(source);
  const project = createProject("req-two-project", baseConfig({
    plugin: {
      sources: [{ id: "fixture-source", type: "local", path: source }],
      packages: [{ id: "sample-plugin", source: "fixture-source", commit }],
    },
  }));

  assert.doesNotThrow(() => PluginManifest.fromRoot(source), "plugin.json.files must not be required");
  await installPlugin(project, "sample-plugin");

  const installed = path.join(project, ".senti", "plugins", "sample-plugin");
  assert.deepEqual(listFiles(installed).sort(), [
    "commands/sample.js",
    "config.defaults.json",
    "config.schema.json",
    "hooks/prepare-post.js",
    "plugin.json",
    "presets/sample-preset/preset.json",
    "skills/senti.sample/SKILL.md",
  ]);

  for (const [name, build, pattern] of [
    ["path traversal", (dir) => writeJson(path.join(dir, "plugin.json"), { name: "sample-plugin", contributions: { commands: [{ name: "bad", path: "../bad.js" }] } }), /traversal|outside|unsafe/i],
    [".git content", (dir) => write(path.join(dir, "commands", ".git", "config"), "[core]\n"), /\.git/i],
    ["node_modules content", (dir) => write(path.join(dir, "commands", "node_modules", "leftpad", "index.js"), "export default {}\n"), /node_modules/i],
    ["symlink", (dir) => fs.symlinkSync(path.join(dir, "plugin.json"), path.join(dir, "commands", "linked.js")), /symlink/i],
    ["scripts", (dir) => writeJson(path.join(dir, "package.json"), { scripts: { postinstall: "node bad.js" } }), /scripts/i],
    ["package dependencies", (dir) => writeJson(path.join(dir, "package.json"), { dependencies: { sample: "1.0.0" } }), /dependencies/i],
    ["deep path", (dir) => write(path.join(dir, "commands", Array.from({ length: 21 }, (_, i) => `d${i}`).join("/"), "too-deep.js"), "export default {}\n"), /depth|20/i],
    ["long path", (dir) => write(path.join(dir, "commands", Array.from({ length: 4 }, () => "a".repeat(80)).join("/"), "too-long.js"), "export default {}\n"), /path|300/i],
    ["large metadata", (dir) => write(path.join(dir, "config.defaults.json"), `{ "blob": "${"x".repeat(1024 * 1024 + 1)}" }\n`), /1 MiB|1048576|metadata/i],
    ["copy file cap", (dir) => {
      for (let i = 0; i < 2001; i += 1) write(path.join(dir, "commands", `file-${i}.js`), "export default {}\n");
    }, /2000|file cap|too many/i],
  ]) {
    const badSource = tmpRoot(`req-two-bad-${name.replace(/\W+/g, "-")}`);
    createPluginPackage(badSource);
    fs.mkdirSync(path.join(badSource, "commands"), { recursive: true });
    build(badSource);
    const badCommit = initGitRepo(badSource);
    const badProject = createProject(`req-two-bad-project-${name.replace(/\W+/g, "-")}`, baseConfig({
      plugin: {
        sources: [{ id: "fixture-source", type: "local", path: badSource }],
        packages: [{ id: "sample-plugin", source: "fixture-source", commit: badCommit }],
      },
    }));
    await assertRejectsMaybeSync(() => installPlugin(badProject, "sample-plugin"), pattern);
  }
});

test("R3: hook discovery validates factory hook modules and bounded metadata", async () => {
  const registryMod = await import(sourceUrl("src/lib/plugin-registry.js"));
  const discoverFlowCommandHooks = requiredFunction(registryMod, "discoverFlowCommandHooks");
  const { FlowCommandHook } = registryMod;
  assert.equal(typeof FlowCommandHook, "function", "FlowCommandHook base class must be exported");

  const project = createProject("r3-project", baseConfig({
    plugin: {
      packages: [{ id: "sample-plugin", source: "fixture-source", commit: sha }],
      sources: [{ id: "fixture-source", type: "local", path: "." }],
    },
  }));
  const pluginRoot = createInstalledPlugin(project, "sample-plugin");
  write(path.join(pluginRoot, "hooks", "prepare-post.js"), `
    export default function register(api) {
      return class SamplePreparePostHook extends api.FlowCommandHook {
        static command = "prepare";
        static hook = "post";
        static priority = 10;
        async run() {}
      };
    }
  `);

  const plans = await discoverFlowCommandHooks(project);
  assert.deepEqual(plans.map((plan) => ({
    pluginId: plan.pluginId,
    module: plan.module,
    className: plan.className,
    command: plan.command,
    hook: plan.hook,
    priority: plan.priority,
  })), [{
    pluginId: "sample-plugin",
    module: "hooks/prepare-post.js",
    className: "SamplePreparePostHook",
    command: "prepare",
    hook: "post",
    priority: 10,
  }]);

  for (const [name, moduleText, pattern] of [
    ["anonymous register", "export default (api) => class NamedHook extends api.FlowCommandHook { static command = 'prepare'; static hook = 'post'; };", /register|anonymous/i],
    ["anonymous class", "export default function register(api) { return class extends api.FlowCommandHook { static command = 'prepare'; static hook = 'post'; }; }", /class|anonymous/i],
    ["unknown command", "export default function register(api) { return class BadHook extends api.FlowCommandHook { static command = 'unknown'; static hook = 'post'; }; }", /command/i],
    ["prepare pre", "export default function register(api) { return class BadHook extends api.FlowCommandHook { static command = 'prepare'; static hook = 'pre'; }; }", /prepare\.pre|pre/i],
    ["non integer priority", "export default function register(api) { return class BadHook extends api.FlowCommandHook { static command = 'prepare'; static hook = 'post'; static priority = 1.5; }; }", /priority|integer/i],
    ["missing inheritance", "export default function register() { return class BadHook { static command = 'prepare'; static hook = 'post'; }; }", /FlowCommandHook|inherit|extends/i],
    ["multiple hooks in one file", "export default function register(api) { return [class FirstHook extends api.FlowCommandHook { static command = 'prepare'; static hook = 'post'; }, class SecondHook extends api.FlowCommandHook { static command = 'gate'; static hook = 'post'; }]; }", /one hook|multiple|array/i],
  ]) {
    const badProject = createProject(`r3-bad-${name.replace(/\W+/g, "-")}`, baseConfig({
      plugin: {
        packages: [{ id: "sample-plugin", source: "fixture-source", commit: sha }],
        sources: [{ id: "fixture-source", type: "local", path: "." }],
      },
    }));
    const badRoot = createInstalledPlugin(badProject, "sample-plugin");
    write(path.join(badRoot, "hooks", "bad.js"), moduleText);
    await assertRejectsMaybeSync(() => discoverFlowCommandHooks(badProject), pattern);
  }

  const tooManyHooksProject = createProject("r3-too-many-hooks", baseConfig({
    plugin: {
      packages: [{ id: "sample-plugin", source: "fixture-source", commit: sha }],
      sources: [{ id: "fixture-source", type: "local", path: "." }],
    },
  }));
  const tooManyHooksRoot = createInstalledPlugin(tooManyHooksProject, "sample-plugin");
  for (let i = 0; i < 201; i += 1) {
    write(path.join(tooManyHooksRoot, "hooks", `hook-${i}.js`), `
      export default function register(api) {
        return class Hook${i} extends api.FlowCommandHook {
          static command = "prepare";
          static hook = "post";
        };
      }
    `);
  }
  await assertRejectsMaybeSync(() => discoverFlowCommandHooks(tooManyHooksProject), /200|hook files/i);

  const tooManyPluginsProject = createProject("r3-too-many-plugins", baseConfig({
    plugin: {
      packages: Array.from({ length: 101 }, (_, i) => ({ id: `sample-plugin-${i}`, source: "fixture-source", commit: sha })),
      sources: [{ id: "fixture-source", type: "local", path: "." }],
    },
  }));
  for (let i = 0; i < 101; i += 1) createInstalledPlugin(tooManyPluginsProject, `sample-plugin-${i}`);
  await assertRejectsMaybeSync(() => discoverFlowCommandHooks(tooManyPluginsProject), /100|enabled plugin/i);
});

test("R4: flow prepare snapshots hook plans into flow.json and active flows use the snapshot", async () => {
  const registryMod = await import(sourceUrl("src/lib/plugin-registry.js"));
  const prepareMod = await import(sourceUrl("src/flow/lib/run-prepare-spec.js"));
  const discoverFlowCommandHooks = requiredFunction(registryMod, "discoverFlowCommandHooks");
  const writeFlowCommandHookSnapshot = requiredFunction(registryMod, "writeFlowCommandHookSnapshot");
  const loadFlowCommandHookSnapshot = requiredFunction(registryMod, "loadFlowCommandHookSnapshot");
  const runFlowCommandWithPluginLifecycle = requiredFunction(registryMod, "runFlowCommandWithPluginLifecycle");
  const runPrepareWithPluginHooks = requiredFunction(prepareMod, "runPrepareWithPluginHooks");

  const project = createProject("r4-project", baseConfig({
    plugin: {
      packages: [{ id: "sample-plugin", source: "fixture-source", commit: sha }],
      sources: [{ id: "fixture-source", type: "local", path: "." }],
    },
  }));
  const pluginRoot = createInstalledPlugin(project, "sample-plugin");
  const hookPath = path.join(pluginRoot, "hooks", "prepare-post.js");
  write(hookPath, `
    export default function register(api) {
      return class SnapshotHook extends api.FlowCommandHook {
        static command = "prepare";
        static hook = "post";
        static priority = 5;
        async run(context) {
          const order = await context.artifacts.readJson("r4-active-order.json", []);
          order.push("snapshot");
          await context.artifacts.writeJson("r4-active-order.json", order);
          return context.envelope.ok();
        }
      };
    }
  `);
  const flowPath = path.join(project, "specs", "1-sample", "flow.json");
  writeJson(flowPath, { version: 1, spec: "specs/1-sample/spec.json", plugins: {} });
  initGitRepo(project);

  const discovered = await discoverFlowCommandHooks(project);
  writeFlowCommandHookSnapshot(flowPath, discovered);

  const prepared = await runPrepareWithPluginHooks({
    root: project,
    title: "plugin hook snapshot fixture",
    noBranch: true,
    request: "exercise prepare hook snapshot contract",
  });
  const preparedFlow = readJson(path.join(project, prepared.flowPath));
  assert.deepEqual(preparedFlow.plugins.flowCommandHooks, [{
    apiVersion: 1,
    pluginId: "sample-plugin",
    module: "hooks/prepare-post.js",
    className: "SnapshotHook",
    command: "prepare",
    hook: "post",
    priority: 5,
  }]);
  assert.equal(JSON.stringify(preparedFlow.plugins.flowCommandHooks).includes(pluginRoot), false);
  assert.equal(preparedFlow.plugins.flowCommandHooks.some((entry) => Object.values(entry).some((value) => typeof value === "string" && path.isAbsolute(value))), false);

  write(path.join(pluginRoot, "hooks", "added-after-snapshot.js"), `
    export default function register(api) {
      return class AddedAfterSnapshotHook extends api.FlowCommandHook {
        static command = "prepare";
        static hook = "post";
        async run(context) {
          const order = await context.artifacts.readJson("r4-active-order.json", []);
          order.push("rediscovered");
          await context.artifacts.writeJson("r4-active-order.json", order);
          return context.envelope.ok();
        }
      };
    }
  `);

  await runFlowCommandWithPluginLifecycle(project, preparedFlow.plugins.flowCommandHooks, {
    command: "prepare",
    main: async () => ({ ok: true, data: { prepared: true } }),
  });
  assert.deepEqual(readJson(path.join(project, ".senti", "plugin-artifacts", "sample-plugin", "r4-active-order.json")), ["snapshot"]);

  const snapshot = loadFlowCommandHookSnapshot(flowPath);
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].module, "hooks/prepare-post.js");
  assert.equal(snapshot[0].className, "SnapshotHook");
  assert.equal(path.isAbsolute(snapshot[0].module), false);
  assert.equal(JSON.stringify(snapshot).includes(pluginRoot), false);
  assert.equal(snapshot.some((entry) => entry.module === "hooks/added-after-snapshot.js"), false);
});

test("R5: hook runner exposes public context and normalizes non-blocking failures", async () => {
  const registryMod = await import(sourceUrl("src/lib/plugin-registry.js"));
  const runFlowCommandHooks = requiredFunction(registryMod, "runFlowCommandHooks");
  const runFlowCommandWithPluginLifecycle = requiredFunction(registryMod, "runFlowCommandWithPluginLifecycle");
  const project = createProject("r5-project", baseConfig({
    plugin: {
      config: { "sample-plugin": { mode: "record" } },
      packages: [{ id: "sample-plugin", source: "fixture-source", commit: sha }],
      sources: [{ id: "fixture-source", type: "local", path: "." }],
    },
  }));
  const pluginRoot = createInstalledPlugin(project, "sample-plugin");
  write(path.join(pluginRoot, "hooks", "record.js"), `
    export default function register(api) {
      return class RecordHook extends api.FlowCommandHook {
        static command = "prepare";
        static hook = "post";
        async run(context) {
          if ("flowManager" in context) throw new Error("raw flowManager leaked");
          await context.artifacts.writeJson("hook-context.json", {
            projectRoot: context.project.root,
            pluginId: context.plugin.id,
            mode: context.config.mode,
            flowSpec: context.flow.spec,
            flowIssue: context.flow.issue,
            resultOk: context.result.ok,
            artifactReadJson: typeof context.artifacts.readJson,
            artifactWriteJson: typeof context.artifacts.writeJson,
            artifactWriteText: typeof context.artifacts.writeText,
            envelopeOk: typeof context.envelope.ok,
            envelopeFail: typeof context.envelope.fail
          });
          return context.envelope.ok({ recorded: true });
        }
      };
    }
  `);
  write(path.join(pluginRoot, "hooks", "throw.js"), `
    export default function register(api) {
      return class ThrowHook extends api.FlowCommandHook {
        static command = "prepare";
        static hook = "post";
        static priority = 20;
        async run() {
          throw new Error("fixture hook failed");
        }
      };
    }
  `);
  write(path.join(pluginRoot, "hooks", "gate-pre.js"), `
    export default function register(api) {
      return class GatePreHook extends api.FlowCommandHook {
        static command = "gate";
        static hook = "pre";
        async run(context) {
          const order = await context.artifacts.readJson("lifecycle-order.json", []);
          order.push("gate.pre");
          await context.artifacts.writeJson("lifecycle-order.json", order);
          return context.envelope.ok();
        }
      };
    }
  `);
  write(path.join(pluginRoot, "hooks", "gate-post.js"), `
    export default function register(api) {
      return class GatePostHook extends api.FlowCommandHook {
        static command = "gate";
        static hook = "post";
        async run(context) {
          const order = await context.artifacts.readJson("lifecycle-order.json", []);
          order.push("gate.post");
          await context.artifacts.writeJson("lifecycle-order.json", order);
          return context.envelope.ok();
        }
      };
    }
  `);
  const snapshot = [
    { apiVersion: 1, pluginId: "sample-plugin", module: "hooks/record.js", className: "RecordHook", command: "prepare", hook: "post", priority: 0 },
    { apiVersion: 1, pluginId: "sample-plugin", module: "hooks/throw.js", className: "ThrowHook", command: "prepare", hook: "post", priority: 20 },
    { apiVersion: 1, pluginId: "sample-plugin", module: "hooks/gate-pre.js", className: "GatePreHook", command: "gate", hook: "pre", priority: 0 },
    { apiVersion: 1, pluginId: "sample-plugin", module: "hooks/gate-post.js", className: "GatePostHook", command: "gate", hook: "post", priority: 0 },
  ];

  const result = await runFlowCommandHooks(project, snapshot, {
    command: "prepare",
    hook: "post",
    flow: { spec: "specs/1-sample/spec.json", issue: 373 },
    result: { ok: true, data: { issue: 373 } },
  });
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].code, "PLUGIN_HOOK_FAILED");
  assert.match(result.issueLogEntries[0].reason, /fixture hook failed/);
  assert.deepEqual(readJson(path.join(project, ".senti", "plugin-artifacts", "sample-plugin", "hook-context.json")), {
    projectRoot: project,
    pluginId: "sample-plugin",
    mode: "record",
    flowSpec: "specs/1-sample/spec.json",
    flowIssue: 373,
    resultOk: true,
    artifactReadJson: "function",
    artifactWriteJson: "function",
    artifactWriteText: "function",
    envelopeOk: "function",
    envelopeFail: "function",
  });

  const lifecycle = await runFlowCommandWithPluginLifecycle(project, snapshot, {
    command: "gate",
    main: async () => ({ ok: true, data: { gate: "ran" } }),
  });
  assert.equal(lifecycle.ok, true);
  assert.deepEqual(readJson(path.join(project, ".senti", "plugin-artifacts", "sample-plugin", "lifecycle-order.json")), [
    "gate.pre",
    "gate.post",
  ]);
});

test("R6: plugin commands load through register(api), receive public context, and return envelopes", async () => {
  const { dispatchPluginCommand } = await import(sourceUrl("src/lib/plugin-registry.js"));
  const project = createProject("r6-project", baseConfig({
    plugin: {
      packages: [{ id: "sample-plugin", source: "fixture-source", commit: sha }],
      sources: [{ id: "fixture-source", type: "local", path: "." }],
    },
  }));
  const pluginRoot = createInstalledPlugin(project, "sample-plugin", {
    contributions: {
      commands: [
        { name: "sample-success", path: "commands/success.js", desc: "Sample success" },
        { name: "sample-invalid", path: "commands/invalid.js", desc: "Sample invalid" },
        { name: "sample-throw", path: "commands/throw.js", desc: "Sample throw" },
      ],
    },
  });
  write(path.join(pluginRoot, "commands", "success.js"), `
    export default function register(api) {
      return {
        async main(argv, context) {
          await context.artifacts.writeJson("command-context.json", {
            argv,
            projectRoot: context.project.root,
            pluginId: context.plugin.id,
            hasRawCtx: "sourceRoot" in context || "packageRoot" in context,
            envelope: typeof api.Envelope.ok
          });
          return api.Envelope.ok("plugin", "sample-success", { done: true });
        }
      };
    }
  `);
  write(path.join(pluginRoot, "commands", "invalid.js"), "export default function register() { return { main() { return { done: true }; } }; }\n");
  write(path.join(pluginRoot, "commands", "throw.js"), "export default function register() { return { main() { throw new Error('command failed'); } }; }\n");

  const ok = await dispatchPluginCommand(project, "sample-success", ["--flag"]);
  assert.equal(ok.ok, true);
  assert.deepEqual(readJson(path.join(project, ".senti", "plugin-artifacts", "sample-plugin", "command-context.json")), {
    argv: ["--flag"],
    projectRoot: project,
    pluginId: "sample-plugin",
    hasRawCtx: false,
    envelope: "function",
  });
  const invalid = await dispatchPluginCommand(project, "sample-invalid", []);
  const thrown = await dispatchPluginCommand(project, "sample-throw", []);
  assert.equal(invalid.ok, false);
  assert.notEqual(invalid.exitCode, 0);
  assert.equal(thrown.ok, false);
  assert.notEqual(thrown.exitCode, 0);
});

test("R7: help rendering uses plugin metadata without importing command modules", async () => {
  const helpMod = await import(sourceUrl("src/help.js"));
  const renderHelp = requiredFunction(helpMod, "renderHelp");
  const project = createProject("r7-project", baseConfig({
    plugin: {
      packages: [{ id: "sample-plugin", source: "fixture-source", commit: sha }],
      sources: [{ id: "fixture-source", type: "local", path: "." }],
    },
  }));
  const pluginRoot = createInstalledPlugin(project, "sample-plugin", {
    contributions: {
      commands: [{
        name: "sample-tool",
        path: "commands/sample-tool.js",
        desc: "Sample plugin command",
        section: "Plugins",
        experimental: true,
        help: "Usage: senti sample-tool [--json]",
        locale: {
          ja: { desc: "サンプルプラグインコマンド", help: "Usage: senti sample-tool [--json]\n\nサンプル" },
        },
        subcommands: [{
          name: "child",
          desc: "Child command",
          help: "Usage: senti sample-tool child",
          locale: { ja: { desc: "子コマンド", help: "Usage: senti sample-tool child\n\n子コマンド" } },
        }],
      }],
    },
  });
  const importMarker = path.join(project, ".tmp", "command-imported");
  write(path.join(pluginRoot, "commands", "sample-tool.js"), `
    import fs from "node:fs";
    fs.mkdirSync(${JSON.stringify(path.dirname(importMarker))}, { recursive: true });
    fs.writeFileSync(${JSON.stringify(importMarker)}, "imported");
    throw new Error("help must not import command modules");
  `);

  const output = await renderHelp({ root: project, argv: [], lang: "en" });
  assert.match(output, /sample-tool/);
  assert.match(output, /Sample plugin command/);
  assert.match(output, /experimental/i);
  assert.doesNotMatch(output, /\bworkflow\b/i);
  assert.equal(fs.existsSync(importMarker), false);

  const commandHelp = await renderHelp({ root: project, argv: ["sample-tool", "--help"], lang: "en" });
  assert.match(commandHelp, /Usage: senti sample-tool/);
  assert.match(commandHelp, /Child command/);

  const subcommandHelp = await renderHelp({ root: project, argv: ["sample-tool", "child", "--help"], lang: "ja" });
  assert.match(subcommandHelp, /Usage: senti sample-tool child/);
  assert.match(subcommandHelp, /子コマンド/);
  assert.equal(fs.existsSync(importMarker), false);
});

test("R8: loadConfig merges plugin config defaults under plugin.config.<pluginId> and agent API passes plugin overrides", async () => {
  const { loadConfig } = await import(sourceUrl("src/lib/config.js"));
  const agentMod = await import(sourceUrl("src/lib/agent.js"));
  const upgradeMod = await import(sourceUrl("src/upgrade.js"));
  const createPluginAgentApi = requiredFunction(agentMod, "createPluginAgentApi");
  const migratePluginConfigNamespaces = requiredFunction(upgradeMod, "migratePluginConfigNamespaces");
  const project = createProject("r8-project", baseConfig({
    agent: {
      providers: {
        test: {
          command: "node",
          args: ["-e", "process.stdout.write('ok')"],
        },
      },
      profiles: {
        default: { "docs.enrich": "test/default" },
        pluginProfile: { "sample-plugin.task": "test/plugin" },
      },
    },
    plugin: {
      config: { "sample-plugin": { agentProfile: "pluginProfile" } },
      packages: [{ id: "sample-plugin", source: "fixture-source", commit: sha }],
      sources: [{ id: "fixture-source", type: "local", path: "." }],
    },
  }));
  const configPath = path.join(project, ".senti", "config.json");
  const before = fs.readFileSync(configPath, "utf8");
  const pluginRoot = createInstalledPlugin(project, "sample-plugin", {
    contributions: { config: { schema: "config.schema.json", defaults: "config.defaults.json" } },
  });
  writeJson(path.join(pluginRoot, "config.schema.json"), {
    type: "object",
    properties: {
      plugin: {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              "sample-plugin": {
                type: "object",
                properties: {
                  mode: { type: "string" },
                  provider: { type: "string" },
                  agentProfile: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  });
  writeJson(path.join(pluginRoot, "config.defaults.json"), {
    plugin: {
      config: {
        "sample-plugin": {
          mode: "default-mode",
          provider: "test",
        },
      },
    },
  });

  const config = loadConfig(project);
  assert.equal(config.plugin.config["sample-plugin"].mode, "default-mode");
  assert.equal(fs.readFileSync(configPath, "utf8"), before, "loadConfig must not write merged defaults to disk");

  const schemaProject = createProject("r8-schema-project", baseConfig({
    plugin: {
      config: { "sample-plugin": { mode: 42 } },
      packages: [{ id: "sample-plugin", source: "fixture-source", commit: sha }],
      sources: [{ id: "fixture-source", type: "local", path: "." }],
    },
  }));
  fs.cpSync(pluginRoot, path.join(schemaProject, ".senti", "plugins", "sample-plugin"), { recursive: true });
  assert.throws(() => loadConfig(schemaProject), /plugin\.config\.sample-plugin\.mode|mode.*string/i);

  const calls = [];
  const api = createPluginAgentApi({
    pluginId: "sample-plugin",
    pluginConfig: config.plugin.config["sample-plugin"],
    agent: { call: async (prompt, options) => calls.push({ prompt, options }) || "ok" },
  });
  await api.call("prompt", { commandId: "task", profile: "pluginProfile" });
  assert.deepEqual(calls[0].options, {
    commandId: "sample-plugin.task",
    provider: "test",
    profile: "pluginProfile",
  });

  assert.throws(
    () => loadConfig(createProject("r8-old-workflow", baseConfig({ workflow: { flowIntegration: "enable" } }))),
    /plugin\.config\.workflow|senti upgrade|migrate/i,
  );

  const oldConfig = baseConfig({ workflow: { flowIntegration: "enable" } });
  const migrated = migratePluginConfigNamespaces(oldConfig);
  assert.equal(migrated.plugin.config.workflow.flowIntegration, "enable");
  assert.equal(Object.hasOwn(migrated, "workflow"), false);
});

test("R9: official workflow plugin prepare.post hook preserves migrated issue-start behavior", async () => {
  const registryMod = await import(sourceUrl("src/lib/plugin-registry.js"));
  const discoverFlowCommandHooks = requiredFunction(registryMod, "discoverFlowCommandHooks");
  const runFlowCommandHooks = requiredFunction(registryMod, "runFlowCommandHooks");
  const project = createProject("r9-project", baseConfig({
    commands: { gh: "disable" },
    plugin: {
      config: { workflow: { flowIntegration: "enable" } },
      packages: [{ id: "workflow", source: "official-workflow", commit: sha }],
      sources: [{ id: "official-workflow", type: "local", path: path.join(root, "src", "official-plugins", "senti-workflow-plugin") }],
    },
  }));
  const officialRoot = path.join(root, "src", "official-plugins", "senti-workflow-plugin");
  const installedRoot = path.join(project, ".senti", "plugins", "workflow");
  fs.cpSync(officialRoot, installedRoot, { recursive: true });
  writeJson(path.join(project, "specs", "1-sample", "flow.json"), {
    version: 1,
    issue: 373,
    spec: "specs/1-sample/spec.json",
    plugins: {},
  });

  const plans = await discoverFlowCommandHooks(project);
  assert.deepEqual(plans.map((plan) => `${plan.pluginId}:${plan.command}.${plan.hook}`), ["workflow:prepare.post"]);
  const result = await runFlowCommandHooks(project, plans, {
    command: "prepare",
    hook: "post",
    result: { ok: true, data: { issue: 373, spec: "specs/1-sample/spec.json" } },
  });
  assert.equal(result.ok, true);
  assert.match(JSON.stringify(result), /issue-start|workflow/i);
  assert.equal(Array.isArray(result.issueLogEntries), true);
  assert.ok(result.issueLogEntries.length > 0, "workflow hook must create an issue-start issue-log candidate");
  assert.ok(
    result.issueLogEntries.some((entry) => entry.pluginId === "workflow" && /issue-start/i.test(`${entry.reason || ""} ${JSON.stringify(entry.payload || {})}`)),
    "workflow hook issue-log candidate must identify issue-start behavior",
  );
  assert.doesNotMatch(fs.readFileSync(path.join(root, "src", "skills", "senti.flow", "SKILL.md"), "utf8"), /senti workflow issue-start|workflow\.flowIntegration/);
});

test("R10: core foundation source and tests do not depend on official preset names", () => {
  const roots = [
    "src/lib",
    "src/flow",
    "src/help.js",
    "src/plugin.js",
    "src/senti.js",
    "src/upgrade.js",
    "specs/286-plugin-foundation-runtime/tests",
  ];
  const names = ["lara" + "vel", "sym" + "fony", "cake" + "php2", "driz" + "zle", "graph" + "ql", "ho" + "no", "r" + "2", "web" + "app", "work" + "ers", "post" + "gres"];
  const officialPresetNames = new RegExp(`\\b(${names.join("|")})\\b`);
  const excluded = /(^|\/)(official-plugins|docs|node_modules|\.git|\.tmp|\.raw)\/|historical|acceptance-report|spec-review|draft/;
  const files = [];
  for (const rel of roots) {
    const abs = path.join(root, rel);
    if (fs.statSync(abs).isFile()) {
      files.push(rel);
    } else {
      for (const file of listFiles(abs)) files.push(`${rel}/${file}`);
    }
  }
  const offenders = files
    .filter((file) => /\.(js|json|md)$/.test(file))
    .filter((file) => !excluded.test(file))
    .filter((file) => officialPresetNames.test(fs.readFileSync(path.join(root, file), "utf8")));

  assert.deepEqual(offenders, [], `official preset names found in core foundation contract surface: ${offenders.join(", ")}`);
});
