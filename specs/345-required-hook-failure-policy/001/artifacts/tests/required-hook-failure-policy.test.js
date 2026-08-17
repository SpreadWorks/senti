// spec: R1 R2 R3 R4 R5 R6 R7 R8
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager, replaceFlowState, setupFlow } from "../../../tests/helpers/flow-setup.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { RunFinalizeCleanupCommand } from "../../../src/flow/lib/run-finalize-cleanup.js";
import { RunPrepareSpecCommand } from "../../../src/flow/lib/run-prepare-spec.js";
import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from "../../../src/lib/worktree-flow-binding.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");

function requiredHookFlow() {
  return { specId: "001-required-hook", specRoot: "specs" };
}

async function importFresh(file) {
  return import(`${pathToFileURL(file).href}?t=${Date.now()}-${Math.random()}`);
}

function writeProjectConfig(projectRoot) {
  fs.mkdirSync(path.join(projectRoot, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, ".senti", "config.json"), JSON.stringify({
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      sources: [{ id: "local", type: "local", path: "." }],
      packages: [{ id: "fixture", source: "local", commit: "0".repeat(40) }],
    },
  }), "utf8");
}

function writeHook(projectRoot, source) {
  const hookFile = path.join(projectRoot, ".senti", "plugins", "fixture", "hooks", "prepare.js");
  fs.mkdirSync(path.dirname(hookFile), { recursive: true });
  fs.writeFileSync(hookFile, source, "utf8");
  return hookFile;
}

const businessFailureCases = [
  ["throw", "throw new Error('boom');"],
  ["failed envelope", "return context.envelope.fail('plugin', 'hook', 'FAILED', 'boom');"],
  ["malformed result", "return { data: { unexpected: true } };"],
  ["artifact write failure", "await context.artifacts.writeJson('../escape.json', {});"],
];

function hookSource({ policy, body, command = "prepare", hook = "post" }) {
  return `
export default function register(api) {
  return class FixtureHook extends api.FlowCommandHook {
    static command = ${JSON.stringify(command)};
    static hook = ${JSON.stringify(hook)};
    static failurePolicy = ${JSON.stringify(policy)};
    async run(context) { ${body} }
  };
}
`;
}

async function loadRegistry() {
  return importFresh(path.join(root, "src", "lib", "plugin-registry.js"));
}

function writeModule(projectRoot, name, source) {
  const file = path.join(projectRoot, ".senti", "plugins", "fixture", "hooks", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source, "utf8");
  return file;
}

function git(projectRoot, args) {
  return execFileSync("git", ["-C", projectRoot, ...args], { encoding: "utf8" }).trim();
}

function initGitRepo(projectRoot) {
  git(projectRoot, ["init", "--quiet"]);
  git(projectRoot, ["config", "user.email", "test@example.com"]);
  git(projectRoot, ["config", "user.name", "Test User"]);
  fs.writeFileSync(path.join(projectRoot, "README.md"), "# fixture\n");
  git(projectRoot, ["add", "README.md"]);
  git(projectRoot, ["commit", "--quiet", "-m", "initial"]);
}

function setupFinalizeFlow(projectRoot, specId) {
  const featureBranch = `feature/${specId}`;
  const state = setupFlow(projectRoot, {
    specId,
    runId: `run-${specId}`,
    baseBranch: "master",
    featureBranch,
    worktree: false,
  });
  state.state = { mergeStrategy: "pr" };
  replaceFlowState(projectRoot, state, { specId });
  git(projectRoot, ["add", `specs/${specId}/flow.json`]);
  git(projectRoot, ["commit", "--quiet", "-m", "add flow"]);
  git(projectRoot, ["branch", featureBranch]);
  makeFlowManager(projectRoot).addActiveFlow(specId, "branch");
  return state;
}

async function runFinalize(projectRoot, specId, flowState) {
  const flowManager = new FlowManager({ root: projectRoot, mainRoot: projectRoot, inWorktree: false, specId });
  return new RunFinalizeCleanupCommand().execute({
    root: projectRoot,
    mainRoot: projectRoot,
    flowManager,
    flowState,
    autoRescue: false,
    force: false,
  });
}

function setupWorktreeFinalizeFlow(projectRoot, specId) {
  const featureBranch = `feature/${specId}`;
  const worktreePath = path.join(projectRoot, ".senti", "worktree", specId);
  const state = setupFlow(projectRoot, {
    specId,
    runId: `run-${specId}`,
    baseBranch: "master",
    featureBranch,
    worktree: true,
  });
  state.state = { mergeStrategy: "pr" };
  replaceFlowState(projectRoot, state, { specId });
  const mainFlowManager = makeFlowManager(projectRoot);
  mainFlowManager.addActiveFlow(specId, "worktree");
  git(projectRoot, ["add", `specs/${specId}/flow.json`]);
  git(projectRoot, ["commit", "--quiet", "-m", "add worktree flow"]);
  git(projectRoot, ["worktree", "add", "-b", featureBranch, worktreePath]);
  new WorktreeFlowBindingStore({ worktreePath }).save(new WorktreeFlowIdentity({
    runId: state.runId,
    issue: null,
    specId: state.specId,
    worktreePath,
  }));
  const flowManager = new FlowManager({ root: worktreePath, mainRoot: projectRoot, inWorktree: true, specId });
  return { featureBranch, worktreePath, state: flowManager.loadReadOnly(specId), flowManager, mainFlowManager };
}

async function runWorktreeFinalize(mainRoot, fixture) {
  return new RunFinalizeCleanupCommand().execute({
    root: fixture.worktreePath,
    mainRoot,
    flowManager: fixture.flowManager,
    flowState: fixture.state,
    autoRescue: false,
    force: false,
  });
}

async function runPrepare(projectRoot, flowManager, runId = "prepare-required-hook") {
  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, ".senti", "config.json"), "utf8"));
  return new RunPrepareSpecCommand().execute({
    root: projectRoot,
    mainRoot: projectRoot,
    flowManager,
    config,
    title: "required-hook-fixture",
    base: git(projectRoot, ["branch", "--show-current"]),
    runId,
    noBranch: true,
    worktree: false,
    dryRun: false,
    issue: null,
    request: "",
    flowState: null,
  });
}

async function assertRequiredPrepareHookFailureIsAtomic(hook) {
  const projectRoot = createTmpDir(`required-hook-prepare-${hook}-`);
  try {
    initGitRepo(projectRoot);
    writeProjectConfig(projectRoot);
    writeHook(projectRoot, hookSource({
      policy: "required",
      command: "prepare",
      hook,
      body: "await context.artifacts.writeText('partial.txt', 'partial'); throw new Error('required prepare failure');",
    }));
    const specDir = path.join(projectRoot, "specs", "001-required-hook-fixture");
    const artifactDir = path.join(specDir, "plugin-artifacts", "fixture");
    const statePath = path.join(specDir, "flow.json");
    const draftPath = path.join(specDir, "draft.json");
    const specPath = path.join(specDir, "spec.json");
    const issueLogPath = path.join(specDir, "issue-log.json");
    const runId = `prepare-required-${hook}-hook`;
    const flowManager = makeFlowManager(projectRoot);
    flowManager.createPreparingFlow(runId, { request: "required hook fixture" });
    const preparingBefore = structuredClone(flowManager.loadPreparingFlow(runId));

    const result = await runPrepare(projectRoot, flowManager, runId);

    assert.equal(result.ok, false, "required prepare hook must stop the command");
    assert.equal(result.errors[0].code, "PLUGIN_HOOK_REQUIRED_FAILED", "prepare must expose the typed required failure");
    assert.equal(result.data.pluginLifecycle.outcome.policy, "required", "prepare must consume the structured lifecycle outcome");
    for (const file of [specPath, draftPath, statePath, issueLogPath]) {
      assert.equal(fs.existsSync(file), false, `required prepare failure must not create ${path.relative(projectRoot, file)}`);
    }
    assert.deepEqual(flowManager.loadPreparingFlow(runId), preparingBefore, "required prepare failure must not modify or clear its preparing flow state");
    assert.equal(fs.existsSync(artifactDir), false, "required prepare failure must remove plugin artifacts written by the hook");

    writeHook(projectRoot, hookSource({
      policy: "required",
      command: "prepare",
      hook,
      body: "return context.envelope.ok('plugin', 'hook', {});",
    }));
    const retried = await runPrepare(projectRoot, flowManager, runId);
    assert.equal(retried.result, "ok", "required prepare failure must permit the same preparing run to retry");
  } finally {
    removeTmpDir(projectRoot);
  }
}

test("R1: discovery and snapshots require an explicit known failure policy", async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-required-hook-policy-"));
  writeProjectConfig(projectRoot);
  writeHook(projectRoot, hookSource({ policy: "required", body: "return context.envelope.ok();" }));
  const { discoverFlowCommandHooks, runFlowCommandWithPluginLifecycle } = await loadRegistry();

  const plans = await discoverFlowCommandHooks(projectRoot);
  assert.equal(plans[0].failurePolicy, "required", "discovery must persist the declared failure policy in the hook plan");

  writeHook(projectRoot, hookSource({ policy: "unknown", body: "return context.envelope.ok();" }));
  await assert.rejects(
    () => discoverFlowCommandHooks(projectRoot),
    /failure policy.*unknown/i,
    "unknown policy must be rejected during registration",
  );

  writeHook(projectRoot, hookSource({ policy: undefined, body: "return context.envelope.ok();" }));
  await assert.rejects(
    () => discoverFlowCommandHooks(projectRoot),
    /failure policy.*required|failure policy.*missing/i,
    "missing policy must be rejected during registration",
  );

  writeHook(projectRoot, hookSource({ policy: "advisory", body: "return context.envelope.ok();" }));
  const snapshotWithoutPolicy = [{ pluginId: "fixture", module: "hooks/prepare.js", className: "FixtureHook", command: "prepare", hook: "post", priority: 0 }];
  let mainCalls = 0;
  await assert.rejects(
    () => runFlowCommandWithPluginLifecycle(projectRoot, snapshotWithoutPolicy, {
      command: "prepare",
      flow: requiredHookFlow(),
      main: async () => {
        mainCalls += 1;
        return { ok: true, data: {} };
      },
    }),
    /failure policy.*required|failure policy.*missing/i,
    "missing snapshot policy must be rejected before hook or main execution",
  );
  assert.equal(mainCalls, 0, "missing snapshot policy must stop before main execution");
});

test("R2: lifecycle returns a structured outcome instead of warning-code severity inference", async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-required-hook-outcome-"));
  writeProjectConfig(projectRoot);
  writeHook(projectRoot, hookSource({ policy: "required", body: "throw new Error('required failure');" }));
  const { runFlowCommandWithPluginLifecycle } = await loadRegistry();
  const snapshot = [{ pluginId: "fixture", module: "hooks/prepare.js", className: "FixtureHook", command: "prepare", hook: "post", priority: 0, failurePolicy: "required" }];

  const result = await runFlowCommandWithPluginLifecycle(projectRoot, snapshot, {
    command: "prepare",
    flow: requiredHookFlow(),
    main: async () => ({ ok: true, data: { mainRan: true } }),
  });

  assert.equal(result.ok, false, "required post-hook failure must fail the caller after main execution");
  assert.equal(result.data.mainRan, true, "post-hook coverage must preserve the completed main result while failing the caller");
  assert.equal(result.outcome.policy, "required", "structured outcome must identify the declared policy");
  assert.equal(result.outcome.kind, "business-failure", "structured outcome must classify the hook business failure");
});

test("R3: required pre-hook failures stop the caller for every business-failure form", async (t) => {
  for (const [label, body] of businessFailureCases) {
    await t.test(`R3: required ${label}`, async () => {
      const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-required-hook-required-"));
      writeProjectConfig(projectRoot);
      writeHook(projectRoot, hookSource({ policy: "required", command: "gate", hook: "pre", body }));
      const { runFlowCommandWithPluginLifecycle } = await loadRegistry();
      const snapshot = [{ pluginId: "fixture", module: "hooks/prepare.js", className: "FixtureHook", command: "gate", hook: "pre", priority: 0, failurePolicy: "required" }];
      let mainCalls = 0;

      const result = await runFlowCommandWithPluginLifecycle(projectRoot, snapshot, {
        command: "gate",
        flow: requiredHookFlow(),
        main: async () => {
          mainCalls += 1;
          return { ok: true, data: {} };
        },
      });

      assert.equal(result.ok, false, `required ${label} must fail the lifecycle`);
      assert.equal(mainCalls, 0, `required ${label} must stop before main execution`);
      assert.equal(result.warnings?.length || 0, 0, `required ${label} must not be warning-only`);
    });
  }
});

test("R4: advisory hook failures retain reporting while the main command continues", async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-required-hook-advisory-"));
  writeProjectConfig(projectRoot);
  writeHook(projectRoot, hookSource({ policy: "advisory", body: "throw new Error('advisory failure');" }));
  const { runFlowCommandWithPluginLifecycle } = await loadRegistry();
  const snapshot = [{ pluginId: "fixture", module: "hooks/prepare.js", className: "FixtureHook", command: "prepare", hook: "post", priority: 0, failurePolicy: "advisory" }];

  const result = await runFlowCommandWithPluginLifecycle(projectRoot, snapshot, {
    command: "prepare",
    flow: requiredHookFlow(),
    main: async () => ({ ok: true, data: { mainRan: true } }),
  });

  assert.equal(result.ok, true, "advisory failure must not fail the main lifecycle");
  assert.equal(result.data.mainRan, true, "advisory failure must preserve main success");
  assert.equal(result.outcome.policy, "advisory", "outcome must retain advisory policy");
  assert.equal(result.warnings.length, 1, "advisory failure must retain warning evidence");
  assert.equal(result.issueLogEntries.length, 1, "advisory failure must retain issue-log evidence");
});

test("R4: successful required and advisory hooks preserve hook data and follow-ups", async (t) => {
  for (const policy of ["required", "advisory"]) {
    await t.test(`R4: successful ${policy} hook`, async () => {
      const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-required-hook-success-"));
      writeProjectConfig(projectRoot);
      writeHook(projectRoot, hookSource({
        policy,
        body: "return context.envelope.ok('plugin', 'hook', { marker: true, followUps: ['follow up'] });",
      }));
      const { runFlowCommandWithPluginLifecycle } = await loadRegistry();
      const snapshot = [{ pluginId: "fixture", module: "hooks/prepare.js", className: "FixtureHook", command: "prepare", hook: "post", priority: 0, failurePolicy: policy }];
      const result = await runFlowCommandWithPluginLifecycle(projectRoot, snapshot, {
        command: "prepare",
        flow: requiredHookFlow(),
        main: async () => ({ ok: true, data: { mainRan: true } }),
      });
      assert.equal(result.ok, true, `${policy} successful hook must preserve main result`);
      assert.deepEqual(result.data.pluginHooks[0].data, { marker: true, followUps: ["follow up"] }, `${policy} successful hook must preserve hook data`);
      assert.deepEqual(result.data.followUps, [{ pluginId: "fixture", command: "prepare", hook: "post", text: "follow up" }], `${policy} successful hook must preserve follow-ups`);
    });
  }
});

test("R5: integrity failures and invalid snapshot policy are hard failures for either policy", async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-required-hook-integrity-"));
  writeProjectConfig(projectRoot);
  writeHook(projectRoot, hookSource({ policy: "advisory", body: "return context.envelope.ok();" }));
  const { runFlowCommandWithPluginLifecycle } = await loadRegistry();
  const invalidSnapshot = [{ pluginId: "fixture", module: "hooks/prepare.js", className: "FixtureHook", command: "prepare", hook: "post", priority: 0, failurePolicy: "invalid" }];

  await assert.rejects(
    () => runFlowCommandWithPluginLifecycle(projectRoot, invalidSnapshot, {
      command: "prepare",
      flow: requiredHookFlow(),
      main: async () => ({ ok: true, data: {} }),
    }),
    /failure policy.*invalid/i,
    "invalid snapshot policy must stop execution as an integrity failure",
  );

  writeModule(projectRoot, "import-error.js", "throw new Error('import-time failure');");
  writeModule(projectRoot, "invalid-register.js", "export default function register(api) { return {}; }");
  writeModule(projectRoot, "invalid-inheritance.js", `
export default function register(api) {
  return class InvalidInheritance {
    static command = "prepare";
    static hook = "post";
    static failurePolicy = "advisory";
  };
}
`);
  const integrityCases = [
    ["missing snapshot module", { ...invalidSnapshot[0], failurePolicy: "advisory", module: "hooks/missing.js" }],
    ["snapshot metadata mismatch", { ...invalidSnapshot[0], failurePolicy: "advisory", className: "DifferentHook" }],
    ["import-time failure", { ...invalidSnapshot[0], failurePolicy: "advisory", module: "hooks/import-error.js" }],
    ["invalid register return", { ...invalidSnapshot[0], failurePolicy: "advisory", module: "hooks/invalid-register.js", className: "Object" }],
    ["invalid hook inheritance", { ...invalidSnapshot[0], failurePolicy: "advisory", module: "hooks/invalid-inheritance.js", className: "InvalidInheritance" }],
  ];
  for (const policy of ["required", "advisory"]) {
    for (const [label, snapshot] of integrityCases) {
      await assert.rejects(
        () => runFlowCommandWithPluginLifecycle(projectRoot, [{ ...snapshot, failurePolicy: policy }], {
          command: "prepare",
          flow: requiredHookFlow(),
          main: async () => ({ ok: true, data: {} }),
        }),
        undefined,
        `${label} must remain a hard failure for ${policy} policy`,
      );
    }
  }
});

test("R6/R7: required prepare pre-hook failure is atomic and exposes its structured outcome", async () => {
  await assertRequiredPrepareHookFailureIsAtomic("pre");
});

test("R6/R7: required prepare post-hook failure rolls back completed state", async () => {
  await assertRequiredPrepareHookFailureIsAtomic("post");
});

test("R6: required finalize-cleanup pre-hook failure preserves core state but retains plugin side effects", async () => {
  const projectRoot = createTmpDir("required-hook-finalize-");
  try {
    initGitRepo(projectRoot);
    const specId = "901";
    const state = setupFinalizeFlow(projectRoot, specId);
    writeProjectConfig(projectRoot);
    const hookFile = path.join(projectRoot, ".senti", "plugins", "fixture", "hooks", "finalize.js");
    fs.mkdirSync(path.dirname(hookFile), { recursive: true });
    fs.writeFileSync(hookFile, `
export default function register(api) {
  return class RequiredFinalizeHook extends api.FlowCommandHook {
    static command = "finalize-cleanup";
    static hook = "pre";
    static failurePolicy = "required";
    async run(context) { await context.artifacts.writeText("partial.txt", "partial"); throw new Error("required finalize failure"); }
  };
}
`, "utf8");
    state.plugins = { flowCommandHooks: [{
      apiVersion: 1, pluginId: "fixture", module: "hooks/finalize.js", className: "RequiredFinalizeHook",
      command: "finalize-cleanup", hook: "pre", priority: 0, failurePolicy: "required",
    }] };
    replaceFlowState(projectRoot, state, { specId });
    const pluginArtifactDir = path.join(projectRoot, `specs/${specId}/plugin-artifacts/fixture`);
    fs.mkdirSync(pluginArtifactDir, { recursive: true });
    for (let index = 0; index < 513; index += 1) {
      fs.writeFileSync(path.join(pluginArtifactDir, `existing-${String(index).padStart(3, "0")}.txt`), "x");
    }
    const headBefore = git(projectRoot, ["rev-parse", "HEAD"]);
    const flowBefore = fs.readFileSync(path.join(projectRoot, `specs/${specId}/flow.json`), "utf8");

    const result = await runFinalize(projectRoot, specId, state);

    assert.equal(result.ok, false, "required hook must fail finalize-cleanup");
    assert.equal(result.errors[0].code, "PLUGIN_HOOK_REQUIRED_FAILED", "finalize-cleanup must expose the typed required failure");
    assert.equal(git(projectRoot, ["rev-parse", "HEAD"]), headBefore, "required failure must not create a finalize commit");
    assert.equal(fs.readFileSync(path.join(projectRoot, `specs/${specId}/flow.json`), "utf8"), flowBefore, "required failure must not change flow state");
    assert.notEqual(git(projectRoot, ["branch", "--list", `feature/${specId}`]), "", "required failure must not delete feature branch");
    assert.equal(fs.existsSync(path.join(projectRoot, ".senti", "last-finalized-spec")), false, "required failure must not write completion pointer");
    assert.equal(
      fs.readFileSync(path.join(projectRoot, `specs/${specId}/plugin-artifacts/fixture/partial.txt`), "utf8"),
      "partial",
      "required failure must leave plugin-owned artifacts for plugin-managed recovery",
    );
  } finally {
    removeTmpDir(projectRoot);
  }
});

test("R7: required finalize post-hook failure retains plugin-owned artifacts", async () => {
  const projectRoot = createTmpDir("required-hook-finalize-post-");
  try {
    initGitRepo(projectRoot);
    const specId = "904";
    const state = setupFinalizeFlow(projectRoot, specId);
    writeProjectConfig(projectRoot);
    const hookFile = path.join(projectRoot, ".senti", "plugins", "fixture", "hooks", "finalize.js");
    fs.mkdirSync(path.dirname(hookFile), { recursive: true });
    fs.writeFileSync(hookFile, `
export default function register(api) {
  return class RequiredFinalizePostHook extends api.FlowCommandHook {
    static command = "finalize-cleanup";
    static hook = "post";
    static failurePolicy = "required";
    async run(context) { await context.artifacts.writeText("partial.txt", "partial"); throw new Error("required finalize post failure"); }
  };
}
`, "utf8");
    state.plugins = { flowCommandHooks: [{
      apiVersion: 1, pluginId: "fixture", module: "hooks/finalize.js", className: "RequiredFinalizePostHook",
      command: "finalize-cleanup", hook: "post", priority: 0, failurePolicy: "required",
    }] };
    replaceFlowState(projectRoot, state, { specId });
    const flowManager = makeFlowManager(projectRoot);
    const activeBefore = structuredClone(flowManager.loadActiveFlows());
    const flowBefore = fs.readFileSync(path.join(projectRoot, `specs/${specId}/flow.json`), "utf8");

    const result = await runFinalize(projectRoot, specId, state);

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "PLUGIN_HOOK_REQUIRED_FAILED");
    assert.deepEqual(flowManager.loadActiveFlows(), activeBefore, "required post failure must not clear active flow state");
    assert.equal(fs.readFileSync(path.join(projectRoot, `specs/${specId}/flow.json`), "utf8"), flowBefore, "required post failure must not change flow state");
    assert.equal(git(projectRoot, ["branch", "--list", `feature/${specId}`]), "", "required post failure must not roll back completed branch deletion");
    assert.equal(
      fs.readFileSync(path.join(projectRoot, ".senti", "last-finalized-spec"), "utf8").trim(),
      specId,
      "required post failure must not roll back the durable completion pointer",
    );
    assert.equal(
      fs.readFileSync(path.join(projectRoot, `specs/${specId}/plugin-artifacts/fixture/partial.txt`), "utf8"),
      "partial",
      "required post failure must leave plugin-owned artifacts for plugin-managed recovery",
    );
  } finally {
    removeTmpDir(projectRoot);
  }
});

test("R7: successful finalize-cleanup post hook persists its plugin-owned artifact", async () => {
  const projectRoot = createTmpDir("required-hook-finalize-post-success-");
  try {
    initGitRepo(projectRoot);
    const specId = "905";
    const state = setupFinalizeFlow(projectRoot, specId);
    writeProjectConfig(projectRoot);
    const hookFile = path.join(projectRoot, ".senti", "plugins", "fixture", "hooks", "finalize.js");
    fs.mkdirSync(path.dirname(hookFile), { recursive: true });
    fs.writeFileSync(hookFile, `
export default function register(api) {
  return class SuccessfulFinalizePostHook extends api.FlowCommandHook {
    static command = "finalize-cleanup";
    static hook = "post";
    static failurePolicy = "required";
    async run(context) {
      await context.artifacts.writeText("completed.txt", "completed");
      return context.envelope.ok("plugin-hook", "fixture.finalize-cleanup", { recorded: true });
    }
  };
}
`, "utf8");
    state.plugins = { flowCommandHooks: [{
      apiVersion: 1, pluginId: "fixture", module: "hooks/finalize.js", className: "SuccessfulFinalizePostHook",
      command: "finalize-cleanup", hook: "post", priority: 0, failurePolicy: "required",
    }] };
    replaceFlowState(projectRoot, state, { specId });

    const result = await runFinalize(projectRoot, specId, state);

    assert.equal(result.ok, true, "successful post hook must allow finalize-cleanup to complete");
    assert.equal(
      fs.readFileSync(path.join(projectRoot, `specs/${specId}/plugin-artifacts/fixture/completed.txt`), "utf8"),
      "completed",
      "successful post hook artifact must remain in plugin-owned storage",
    );
    assert.deepEqual(result.data.pluginHooks[0].data, { recorded: true }, "successful post hook data must remain caller-visible");
  } finally {
    removeTmpDir(projectRoot);
  }
});

test("R6: required worktree finalize-cleanup pre-hook failure preserves teardown surfaces", async () => {
  const projectRoot = createTmpDir("required-hook-worktree-finalize-");
  try {
    initGitRepo(projectRoot);
    const specId = "903";
    const fixture = setupWorktreeFinalizeFlow(projectRoot, specId);
    writeProjectConfig(fixture.worktreePath);
    const hookFile = path.join(fixture.worktreePath, ".senti", "plugins", "fixture", "hooks", "finalize.js");
    fs.mkdirSync(path.dirname(hookFile), { recursive: true });
    fs.writeFileSync(hookFile, `
export default function register(api) {
  return class RequiredWorktreeFinalizeHook extends api.FlowCommandHook {
    static command = "finalize-cleanup";
    static hook = "pre";
    static failurePolicy = "required";
    async run(context) { await context.artifacts.writeText("partial.txt", "partial"); throw new Error("required worktree finalize failure"); }
  };
}
`, "utf8");
    fixture.state.plugins = { flowCommandHooks: [{
      apiVersion: 1, pluginId: "fixture", module: "hooks/finalize.js", className: "RequiredWorktreeFinalizeHook",
      command: "finalize-cleanup", hook: "pre", priority: 0, failurePolicy: "required",
    }] };
    replaceFlowState(projectRoot, fixture.state, { specId });
    const activeBefore = structuredClone(fixture.mainFlowManager.loadActiveFlows());
    const recoveryDir = path.join(projectRoot, ".senti", "recovery", "finalize-cleanup");

    const result = await runWorktreeFinalize(projectRoot, fixture);

    assert.equal(result.ok, false, "required hook must stop worktree finalize-cleanup");
    assert.equal(result.errors[0].code, "PLUGIN_HOOK_REQUIRED_FAILED", "worktree caller must expose the typed required failure");
    assert.equal(fs.existsSync(fixture.worktreePath), true, "required failure must not remove the worktree");
    assert.equal(fs.existsSync(recoveryDir), false, "required failure must not create a teardown transaction journal");
    assert.deepEqual(fixture.mainFlowManager.loadActiveFlows(), activeBefore, "required failure must not clear active-flow state");
    assert.equal(
      fs.readFileSync(path.join(projectRoot, `specs/${specId}/plugin-artifacts/fixture/partial.txt`), "utf8"),
      "partial",
      "required failure must leave the base-side plugin artifact for plugin-managed recovery",
    );
  } finally {
    removeTmpDir(projectRoot);
  }
});

test("R7: required finalize-cleanup failure is structured rather than warning-derived", async () => {
  const projectRoot = createTmpDir("required-hook-finalize-outcome-");
  try {
    initGitRepo(projectRoot);
    const specId = "902";
    const state = setupFinalizeFlow(projectRoot, specId);
    writeProjectConfig(projectRoot);
    const hookFile = path.join(projectRoot, ".senti", "plugins", "fixture", "hooks", "finalize.js");
    fs.mkdirSync(path.dirname(hookFile), { recursive: true });
    fs.writeFileSync(hookFile, `
export default function register(api) {
  return class RequiredFinalizeHook extends api.FlowCommandHook {
    static command = "finalize-cleanup";
    static hook = "pre";
    static failurePolicy = "required";
    async run() { throw new Error("required finalize failure"); }
  };
}
`, "utf8");
    state.plugins = { flowCommandHooks: [{
      apiVersion: 1, pluginId: "fixture", module: "hooks/finalize.js", className: "RequiredFinalizeHook",
      command: "finalize-cleanup", hook: "pre", priority: 0, failurePolicy: "required",
    }] };
    replaceFlowState(projectRoot, state, { specId });

    const result = await runFinalize(projectRoot, specId, state);

    assert.equal(result.errors[0].code, "PLUGIN_HOOK_REQUIRED_FAILED", "caller must consume structured required failure rather than PLUGIN_HOOK_FAILED warning scanning");
    assert.equal(result.data?.pluginLifecycle?.outcome?.policy, "required", "caller result must preserve structured policy outcome");
  } finally {
    removeTmpDir(projectRoot);
  }
});

test("R8: advisory matrix preserves reporting for every business-failure form", async (t) => {
  for (const [label, body] of businessFailureCases) {
    await t.test(`R8: advisory ${label}`, async () => {
      const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-required-hook-advisory-matrix-"));
      writeProjectConfig(projectRoot);
      writeHook(projectRoot, hookSource({ policy: "advisory", body }));
      const { runFlowCommandWithPluginLifecycle } = await loadRegistry();
      const snapshot = [{ pluginId: "fixture", module: "hooks/prepare.js", className: "FixtureHook", command: "prepare", hook: "post", priority: 0, failurePolicy: "advisory" }];
      const result = await runFlowCommandWithPluginLifecycle(projectRoot, snapshot, {
        command: "prepare",
        flow: requiredHookFlow(),
        main: async () => ({ ok: true, data: { mainRan: true } }),
      });
      assert.equal(result.ok, true, `advisory ${label} must retain main success`);
      assert.equal(result.warnings.length, 1, `advisory ${label} must retain warning evidence`);
      assert.equal(result.issueLogEntries.length, 1, `advisory ${label} must retain issue-log evidence`);
      assert.equal(result.outcome.kind, "business-failure", `advisory ${label} must return a structured business failure outcome`);
    });
  }
});
