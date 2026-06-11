// spec: R1 R2 R3 R4 R5
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const sha = "0123456789abcdef0123456789abcdef01234567";

function sourceUrl(rel) {
  return pathToFileURL(path.join(root, rel)).href;
}

function tmpRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `senti-287-${name}-`));
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

function createProject(name, pluginPackage = {}) {
  const project = tmpRoot(name);
  writeJson(path.join(project, ".senti", "config.json"), {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    scan: { include: ["src"] },
    plugin: {
      sources: [{ id: "fixture-source", type: "local", path: "." }],
      packages: [{ id: "sample-plugin", source: "fixture-source", commit: sha, ...pluginPackage }],
    },
  });
  return project;
}

function createInstalledPlugin(project) {
  const pluginRoot = path.join(project, ".senti", "plugins", "sample-plugin");
  writeJson(path.join(pluginRoot, "plugin.json"), {
    name: "sample-plugin",
    type: "mixed",
    contributions: {},
  });
  return pluginRoot;
}

function hookPlan(overrides = {}) {
  return {
    apiVersion: 1,
    pluginId: "sample-plugin",
    module: "hooks/hook.js",
    className: "SampleHook",
    command: "gate",
    hook: "post",
    priority: 0,
    ...overrides,
  };
}

function validHookSource(runBody = "return context.envelope.ok();") {
  return `
    export default function register(api) {
      return class SampleHook extends api.FlowCommandHook {
        static command = "gate";
        static hook = "post";
        static priority = 0;
        async run(context) {
          ${runBody}
        }
      };
    }
  `;
}

async function expectSnapshotReject(project, plan, pattern) {
  const { runFlowCommandHooks } = await import(sourceUrl("src/lib/plugin-registry.js"));
  await assert.rejects(
    () => runFlowCommandHooks(project, [plan], { command: "gate", hook: "post", flow: { spec: "specs/001-sample/spec.json" } }),
    pattern,
  );
}

test("R1: hook discovery rejects core-internal imports before importing hooks", async () => {
  const { discoverFlowCommandHooks } = await import(sourceUrl("src/lib/plugin-registry.js"));
  const project = createProject("core-import");
  const pluginRoot = createInstalledPlugin(project);
  const coreUrl = pathToFileURL(path.join(root, "src", "lib", "plugin-registry.js")).href;
  const evalMarker = path.join(project, ".tmp", "forbidden-hook-imported");
  write(path.join(pluginRoot, "hooks", "hook.js"), `
    import fs from "node:fs";
    import { FlowCommandHook } from ${JSON.stringify(coreUrl)};
    fs.mkdirSync(${JSON.stringify(path.dirname(evalMarker))}, { recursive: true });
    fs.writeFileSync(${JSON.stringify(evalMarker)}, "imported");
    void FlowCommandHook;
    ${validHookSource()}
  `);

  await assert.rejects(
    () => discoverFlowCommandHooks(project),
    /sample-plugin\/hooks\/hook\.js.*core internal/i,
  );
  assert.equal(fs.existsSync(evalMarker), false, "forbidden hook module must not be dynamically imported");
});

test("R1: hook discovery allows relative imports inside the installed plugin package", async () => {
  const { discoverFlowCommandHooks } = await import(sourceUrl("src/lib/plugin-registry.js"));
  const project = createProject("relative-import");
  const pluginRoot = createInstalledPlugin(project);
  write(path.join(pluginRoot, "lib", "helper.js"), "export const priority = 7;\n");
  write(path.join(pluginRoot, "hooks", "hook.js"), `
    import { priority } from "../lib/helper.js";
    export default function register(api) {
      return class SampleHook extends api.FlowCommandHook {
        static command = "gate";
        static hook = "post";
        static priority = priority;
        async run(context) {
          return context.envelope.ok();
        }
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
    module: "hooks/hook.js",
    className: "SampleHook",
    command: "gate",
    hook: "post",
    priority: 7,
  }]);
});

test("R2: snapshot hooks hard-fail for disabled, removed, unresolved, and mismatched entries", async () => {
  const disabledProject = createProject("disabled", { enabled: false });
  const disabledRoot = createInstalledPlugin(disabledProject);
  write(path.join(disabledRoot, "hooks", "hook.js"), validHookSource());
  await expectSnapshotReject(disabledProject, hookPlan(), /disabled|enable|snapshot/i);

  const removedProject = createProject("removed");
  await expectSnapshotReject(removedProject, hookPlan(), /missing|removed|restore|snapshot/i);

  const unresolvedProject = createProject("unresolved");
  createInstalledPlugin(unresolvedProject);
  await expectSnapshotReject(unresolvedProject, hookPlan(), /unresolved|missing|module|snapshot/i);

  const invalidRegisterProject = createProject("invalid-register");
  const invalidRegisterRoot = createInstalledPlugin(invalidRegisterProject);
  write(path.join(invalidRegisterRoot, "hooks", "hook.js"), "export const notRegister = true;\n");
  await expectSnapshotReject(invalidRegisterProject, hookPlan(), /register|default export|snapshot/i);

  const invalidClassProject = createProject("invalid-class");
  const invalidClassRoot = createInstalledPlugin(invalidClassProject);
  write(path.join(invalidClassRoot, "hooks", "hook.js"), `
    export default function register() {
      return class SampleHook {
        static command = "gate";
        static hook = "post";
        static priority = 0;
      };
    }
  `);
  await expectSnapshotReject(invalidClassProject, hookPlan(), /FlowCommandHook|extends|snapshot/i);

  const mismatchProject = createProject("mismatch");
  const mismatchRoot = createInstalledPlugin(mismatchProject);
  write(path.join(mismatchRoot, "hooks", "hook.js"), validHookSource());
  await expectSnapshotReject(mismatchProject, hookPlan({ className: "OtherHook" }), /mismatch|expected OtherHook|snapshot/i);

  const commandMismatchProject = createProject("command-mismatch");
  const commandMismatchRoot = createInstalledPlugin(commandMismatchProject);
  write(path.join(commandMismatchRoot, "hooks", "hook.js"), `
    export default function register(api) {
      return class SampleHook extends api.FlowCommandHook {
        static command = "review";
        static hook = "post";
        static priority = 0;
        async run(context) {
          return context.envelope.ok();
        }
      };
    }
  `);
  await expectSnapshotReject(commandMismatchProject, hookPlan(), /command|metadata|mismatch|snapshot/i);

  const hookMismatchProject = createProject("hook-mismatch");
  const hookMismatchRoot = createInstalledPlugin(hookMismatchProject);
  write(path.join(hookMismatchRoot, "hooks", "hook.js"), `
    export default function register(api) {
      return class SampleHook extends api.FlowCommandHook {
        static command = "gate";
        static hook = "pre";
        static priority = 0;
        async run(context) {
          return context.envelope.ok();
        }
      };
    }
  `);
  await expectSnapshotReject(hookMismatchProject, hookPlan(), /hook|metadata|mismatch|snapshot/i);

  const priorityMismatchProject = createProject("priority-mismatch");
  const priorityMismatchRoot = createInstalledPlugin(priorityMismatchProject);
  write(path.join(priorityMismatchRoot, "hooks", "hook.js"), validHookSource());
  await expectSnapshotReject(priorityMismatchProject, hookPlan({ priority: 99 }), /priority|metadata|mismatch|snapshot/i);
});

test("R3: hook run business failures remain non-blocking warnings after valid snapshot checks", async () => {
  const { runFlowCommandHooks } = await import(sourceUrl("src/lib/plugin-registry.js"));
  const project = createProject("run-warning");
  const pluginRoot = createInstalledPlugin(project);
  write(path.join(pluginRoot, "hooks", "hook.js"), validHookSource("throw new Error('business failure');"));

  const result = await runFlowCommandHooks(project, [hookPlan()], {
    command: "gate",
    hook: "post",
    flow: { spec: "specs/001-sample/spec.json" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.warnings[0].code, "PLUGIN_HOOK_FAILED");
  assert.match(result.issueLogEntries[0].reason, /business failure/);
});

test("R4: flow hook artifacts read and write under the active spec directory", async () => {
  const { runFlowCommandHooks } = await import(sourceUrl("src/lib/plugin-registry.js"));
  const project = createProject("artifact-root");
  const pluginRoot = createInstalledPlugin(project);
  const specRel = "specs/001-sample/spec.json";
  writeJson(path.join(project, specRel), { goal: "sample" });
  write(path.join(pluginRoot, "hooks", "hook.js"), validHookSource(`
    const existing = await context.artifacts.readJson("state.json", { count: 0 });
    await context.artifacts.writeJson("state.json", { count: existing.count + 1 });
    await context.artifacts.writeText("note.txt", "recorded");
    return context.envelope.ok();
  `));

  const result = await runFlowCommandHooks(project, [hookPlan()], {
    command: "gate",
    hook: "post",
    flow: { spec: specRel },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(project, "specs", "001-sample", "plugin-artifacts", "sample-plugin", "state.json"), "utf8")),
    { count: 1 },
  );
  assert.equal(
    fs.readFileSync(path.join(project, "specs", "001-sample", "plugin-artifacts", "sample-plugin", "note.txt"), "utf8"),
    "recorded",
  );
  assert.equal(fs.existsSync(path.join(project, ".senti", "plugin-artifacts", "sample-plugin", "state.json")), false);

  await assert.rejects(
    () => runFlowCommandHooks(project, [hookPlan()], { command: "gate", hook: "post" }),
    /artifact context requires flow\.spec|flow\.spec/i,
  );
});

test("R5: spec-local test coverage declares every testable requirement", () => {
  const source = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  for (const id of ["R1", "R2", "R3", "R4", "R5"]) {
    assert.match(source, new RegExp(`test\\(["'\`]${id}:`));
  }
});
