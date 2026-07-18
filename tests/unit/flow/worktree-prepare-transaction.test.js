import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RunPrepareSpecCommand } from "../../../src/flow/lib/run-prepare-spec.js";
import { iterateAnalysisCategories } from "../../../src/docs/lib/analysis-entry.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { RepositoryFlowOperationLock } from "../../../src/lib/repository-maintenance-lock.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureRoot = path.join(repoRoot, ".tmp", "issue-440-prepare-transaction");
const roots = [];

function git(root, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  if (!allowFailure) assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createProject() {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(fixtureRoot, "project-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
  const config = {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    flow: {
      hooks: {
        PostWorktree: "node -e \"require('fs').writeFileSync('post-worktree.marker','ok')\"",
      },
    },
  };
  fs.writeFileSync(path.join(root, ".senti", "config.json"), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    name: "prepare-binding-fixture",
    version: "0.0.0",
    type: "module",
  }, null, 2));
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test User"]);
  git(root, ["add", ".senti/config.json", "package.json"]);
  git(root, ["commit", "-m", "fixture"]);
  fs.writeFileSync(path.join(root, ".gitignore"), ".senti/*\n!.senti/config.json\n!.senti/output/\n");
  fs.writeFileSync(path.join(root, ".senti", "config.local.json"), JSON.stringify({
    plugin: {
      sources: [{ id: "workflow-src", type: "local", path: ".senti/plugins/workflow" }],
      packages: [{
        id: "workflow",
        source: "workflow-src",
        commit: "0000000000000000000000000000000000000000",
      }],
    },
  }, null, 2));
  const pluginRoot = path.join(root, ".senti", "plugins", "workflow");
  fs.mkdirSync(path.join(pluginRoot, "hooks"), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, "plugin.json"), JSON.stringify({
    name: "workflow",
    files: ["plugin.json", "hooks/", "config.defaults.json"],
    contributions: {
      hooks: [{ path: "hooks/prepare.js" }],
      config: { defaults: "config.defaults.json" },
    },
  }, null, 2));
  fs.writeFileSync(path.join(pluginRoot, "config.defaults.json"), JSON.stringify({
    plugin: { config: { workflow: { flowIntegration: "enable" } } },
  }, null, 2));
  fs.writeFileSync(path.join(pluginRoot, "hooks", "prepare.js"), `
import fs from "node:fs";
import path from "node:path";

export default function register(api) {
  return class PrepareHook extends api.FlowCommandHook {
    static command = "prepare";
    static hook = "post";
    async run(context) {
      await context.artifacts.writeJson("prepare-seen.json", {
        issue: context.flow.issue,
        flowIntegration: context.config.flowIntegration,
        postWorktreeSeen: fs.existsSync(path.join(context.project.root, "post-worktree.marker"))
      });
      return context.envelope.ok("plugin-hook", "prepare", {});
    }
  };
}
`);
  return { root, config };
}

function prepareContext(root, config, { runId = "run-440", issue = 440 } = {}) {
  const flowManager = makeFlowManager(root);
  flowManager.createPreparingFlow(runId, {
    ...(issue == null ? {} : { issue }),
    ...(issue == null ? {} : { issueBody: `Issue #${issue} body` }),
    request: issue == null ? "fix issue-less flow" : `fix Issue #${issue}`,
  });
  return {
    root,
    mainRoot: root,
    flowManager,
    config,
    title: "binding-transaction",
    base: "main",
    runId,
    worktree: true,
    noBranch: false,
    dryRun: false,
    issue: null,
    request: "",
    flowState: null,
  };
}

function fileBytes(file) {
  return fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null;
}

function killSetIssueAtWriterPhase({ root, worktreePath, specId, phase }) {
  const flowManagerUrl = pathToFileURL(path.join(repoRoot, "src/lib/flow-manager.js")).href;
  const script = `
    import { FlowManager } from ${JSON.stringify(flowManagerUrl)};
    const [worktreePath, mainRoot, specId, phase] = process.argv.slice(1);
    const manager = new FlowManager({ root: worktreePath, mainRoot, inWorktree: true, specId });
    manager.setIssue(440, {
      specId,
      faultInjector: (event) => {
        if (event.phase === phase) process.kill(process.pid, "SIGKILL");
      },
    });
  `;
  return spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    script,
    worktreePath,
    root,
    specId,
    phase,
  ]);
}

function attemptArtifacts(root) {
  const worktreePath = path.join(root, ".senti", "worktree", "feature-001-binding-transaction");
  return {
    worktree: fs.existsSync(worktreePath),
    branch: git(root, ["branch", "--list", "feature/001-binding-transaction"], { allowFailure: true }),
    mainSpec: fs.existsSync(path.join(root, "specs", "001-binding-transaction")),
  };
}

function interruptPrepareAfterWorktreeAdd(root, config, runId = "run-440") {
  const prepareUrl = pathToFileURL(path.join(repoRoot, "src/flow/lib/run-prepare-spec.js")).href;
  const managerUrl = pathToFileURL(path.join(repoRoot, "src/lib/flow-manager.js")).href;
  const script = `
    import { RunPrepareSpecCommand } from ${JSON.stringify(prepareUrl)};
    import { FlowManager } from ${JSON.stringify(managerUrl)};
    const [root, configJson, runId] = process.argv.slice(1);
    const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false });
    await new RunPrepareSpecCommand().execute({
      root,
      mainRoot: root,
      flowManager,
      config: JSON.parse(configJson),
      title: "binding-transaction",
      base: "main",
      runId,
      worktree: true,
      noBranch: false,
      dryRun: false,
      issue: null,
      request: "",
      flowState: null,
      worktreePrepareFaultInjector: ({ phase }) => {
        if (phase === "after-worktree-add") process.kill(process.pid, "SIGKILL");
      },
    });
  `;
  return spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    script,
    root,
    JSON.stringify(config),
    runId,
  ]);
}

afterEach(() => {
  mock.restoreAll();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("worktree prepare binding transaction", () => {
  it("verifies the persisted exact identity through a fresh worktree manager before publish", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config);
    const resolutions = [];
    const originalForRoot = ctx.flowManager.forRoot;
    mock.method(ctx.flowManager, "forRoot", function forRoot(...args) {
      const manager = originalForRoot.apply(this, args);
      if (typeof manager.resolveWorktreeBinding === "function") {
        const originalResolve = manager.resolveWorktreeBinding;
        mock.method(manager, "resolveWorktreeBinding", function resolve(...resolveArgs) {
          const identity = originalResolve.apply(this, resolveArgs);
          resolutions.push(identity.toJSON());
          return identity;
        });
      }
      return manager;
    });

    const result = await new RunPrepareSpecCommand().execute(ctx);

    assert.equal(result.result, "ok");
    assert.deepEqual(resolutions.at(-1), {
      runId: "run-440",
      issue: 440,
      spec: result.spec,
      worktreePath: fs.realpathSync(result.worktreePath),
    });
    assert.equal(ctx.flowManager.loadPreparingFlow("run-440"), null);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(root, ".senti", ".active-flow"), "utf8")),
      [{ spec: "001-binding-transaction", mode: "worktree" }],
    );
  });

  it("recovers an exact stale prepare attempt after SIGKILL following git worktree add", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config);
    const stopped = interruptPrepareAfterWorktreeAdd(root, config);
    assert.equal(stopped.signal, "SIGKILL");
    assert.deepEqual(attemptArtifacts(root), {
      worktree: true,
      branch: "+ feature/001-binding-transaction",
      mainSpec: false,
    });
    assert.equal(fs.existsSync(path.join(root, ".senti", ".worktree-prepare-attempt.json")), true);

    const retried = await new RunPrepareSpecCommand().execute(ctx);

    assert.equal(retried.result, "ok");
    assert.equal(retried.runId, "run-440");
    assert.equal(fs.existsSync(path.join(root, ".senti", ".worktree-prepare-attempt.json")), false);
  });

  it("fails stopped when stale prepare-attempt Git authority changed", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config);
    assert.equal(interruptPrepareAfterWorktreeAdd(root, config).signal, "SIGKILL");
    const worktreePath = path.join(root, ".senti", "worktree", "feature-001-binding-transaction");
    fs.writeFileSync(path.join(worktreePath, "foreign.txt"), "foreign authority\n");
    git(worktreePath, ["add", "foreign.txt"]);
    git(worktreePath, ["commit", "-m", "foreign mutation"]);
    const foreignOid = git(worktreePath, ["rev-parse", "HEAD"]);

    await assert.rejects(
      () => new RunPrepareSpecCommand().execute(ctx),
      /authority changed|expected OID|prepare attempt/i,
    );
    assert.equal(git(worktreePath, ["rev-parse", "HEAD"]), foreignOid);
    assert.equal(fs.readFileSync(path.join(worktreePath, "foreign.txt"), "utf8"), "foreign authority\n");
    assert.equal(fs.existsSync(path.join(root, ".senti", ".worktree-prepare-attempt.json")), true);
  });

  it("publishes explicit null for an Issue-less worktree", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config, { runId: "run-no-issue", issue: null });

    const result = await new RunPrepareSpecCommand().execute(ctx);

    assert.equal(result.issue, null);
    const binding = JSON.parse(fs.readFileSync(path.join(result.worktreePath, ".senti", "flow-identity.json"), "utf8"));
    assert.equal(binding.issue, null);
    const flowPath = path.join(result.worktreePath, result.spec.replace(/\/spec\.json$/, "/flow.json"));
    assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(flowPath, "utf8")), "issue"), false);
  });

  it("updates an Issue-less flow and binding as one restart-stable identity transaction", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config, { runId: "run-set-issue", issue: null });
    const result = await new RunPrepareSpecCommand().execute(ctx);
    const manager = ctx.flowManager.forRoot(result.worktreePath, { specId: result.spec.split("/")[1] });

    manager.setIssue(440, { specId: result.spec.split("/")[1] });

    assert.equal(manager.resolveWorktreeBinding().issue, 440);
    assert.equal(manager.load().issue, 440);
    const restarted = new FlowManager({
      root: result.worktreePath,
      mainRoot: root,
      inWorktree: true,
    });
    assert.deepEqual(
      {
        runId: restarted.load().runId,
        issue: restarted.load().issue,
        spec: restarted.load().spec,
      },
      { runId: result.runId, issue: 440, spec: result.spec },
    );
  });

  it("recovers a committed flow rename before directory fsync across manager restart", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config, { runId: "run-set-issue-committed", issue: null });
    const result = await new RunPrepareSpecCommand().execute(ctx);
    const specId = result.spec.split("/")[1];
    const manager = ctx.flowManager.forRoot(result.worktreePath, { specId });
    let injected = false;

    assert.throws(
      () => manager.setIssue(440, {
        specId,
        faultInjector: ({ phase }) => {
          if (!injected && phase === "after-state-rename") {
            injected = true;
            throw new Error("injected committed state interruption");
          }
        },
      }),
      /committed state interruption/,
    );

    const restarted = new FlowManager({
      root: result.worktreePath,
      mainRoot: root,
      inWorktree: true,
      specId,
    });
    assert.equal(restarted.load().issue, 440);
    assert.equal(restarted.resolveWorktreeBinding().issue, 440);
  });

  it("recovers exact flow and binding identity after process interruption following flow rename", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config, { runId: "run-set-issue-killed", issue: null });
    const result = await new RunPrepareSpecCommand().execute(ctx);
    const specId = result.spec.split("/")[1];
    const flowManagerUrl = pathToFileURL(path.join(repoRoot, "src/lib/flow-manager.js")).href;
    const script = `
      import { FlowManager } from ${JSON.stringify(flowManagerUrl)};
      const [worktreePath, mainRoot, specId] = process.argv.slice(1);
      const manager = new FlowManager({ root: worktreePath, mainRoot, inWorktree: true, specId });
      manager.setIssue(440, {
        specId,
        faultInjector: ({ phase }) => {
          if (phase === "after-state-rename") process.kill(process.pid, "SIGKILL");
        },
      });
    `;

    const stopped = spawnSync(process.execPath, [
      "--input-type=module",
      "-e",
      script,
      result.worktreePath,
      root,
      specId,
    ]);
    assert.equal(stopped.signal, "SIGKILL");

    const specDirectory = path.join(result.worktreePath, "specs", specId);
    const markerPath = path.join(
      result.worktreePath,
      ".senti",
      "flow-identity.issue-transaction.json",
    );
    let specDirectorySynced = false;
    const originalFsync = fs.fsyncSync;
    const originalUnlink = fs.unlinkSync;
    fs.fsyncSync = (descriptor) => {
      let openedPath = null;
      try { openedPath = fs.readlinkSync(`/proc/self/fd/${descriptor}`); } catch {}
      if (openedPath === specDirectory) specDirectorySynced = true;
      return originalFsync(descriptor);
    };
    fs.unlinkSync = (target) => {
      if (path.resolve(String(target)) === markerPath) {
        assert.equal(specDirectorySynced, true, "spec directory must be durable before marker removal");
      }
      return originalUnlink(target);
    };
    const restarted = new FlowManager({
      root: result.worktreePath,
      mainRoot: root,
      inWorktree: true,
      specId,
    });
    try {
      assert.equal(restarted.load().issue, 440);
    } finally {
      fs.fsyncSync = originalFsync;
      fs.unlinkSync = originalUnlink;
    }
    assert.equal(restarted.resolveWorktreeBinding().issue, 440);
    restarted.setRequest("mutation after committed recovery", { specId });
    assert.equal(restarted.load().request, "mutation after committed recovery");
    assert.equal(fs.existsSync(path.join(specDirectory, ".flow.json.writer.lock")), false);
    assert.deepEqual(
      fs.readdirSync(specDirectory).filter((name) => /^\.flow\.json\..*\.tmp$/.test(name)),
      [],
    );
    assert.equal(
      fs.existsSync(markerPath),
      false,
    );
  });

  it("recovers the exact transition after SIGKILL immediately after writer lock acquisition", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config, { runId: "run-set-issue-lock-killed", issue: null });
    const result = await new RunPrepareSpecCommand().execute(ctx);
    const specId = result.spec.split("/")[1];
    const flowManagerUrl = pathToFileURL(path.join(repoRoot, "src/lib/flow-manager.js")).href;
    const script = `
      import { FlowManager } from ${JSON.stringify(flowManagerUrl)};
      const [worktreePath, mainRoot, specId] = process.argv.slice(1);
      const manager = new FlowManager({ root: worktreePath, mainRoot, inWorktree: true, specId });
      manager.setIssue(440, {
        specId,
        faultInjector: ({ phase }) => {
          if (phase === "lock-acquired") process.kill(process.pid, "SIGKILL");
        },
      });
    `;

    const stopped = spawnSync(process.execPath, [
      "--input-type=module",
      "-e",
      script,
      result.worktreePath,
      root,
      specId,
    ]);
    assert.equal(stopped.signal, "SIGKILL");

    const specDirectory = path.join(result.worktreePath, "specs", specId);
    const markerPath = path.join(result.worktreePath, ".senti", "flow-identity.issue-transaction.json");
    const lockPath = path.join(specDirectory, ".flow.json.writer.lock");
    assert.equal(fs.existsSync(markerPath), true);
    assert.equal(fs.existsSync(lockPath), true);
    assert.equal(
      JSON.parse(fs.readFileSync(markerPath, "utf8")).transitionId,
      JSON.parse(fs.readFileSync(lockPath, "utf8")).transitionId,
    );

    const restarted = new FlowManager({
      root: result.worktreePath,
      mainRoot: root,
      inWorktree: true,
      specId,
    });
    assert.equal(Object.hasOwn(restarted.load(), "issue"), false);
    assert.equal(restarted.resolveWorktreeBinding().issue, null);
    restarted.setRequest("mutation after pre-commit recovery", { specId });
    assert.equal(restarted.load().request, "mutation after pre-commit recovery");
    assert.equal(fs.existsSync(markerPath), false);
    assert.equal(fs.existsSync(lockPath), false);
  });

  for (const [phase, expectedVisibleLinks] of [
    ["after-lock-publish", 2],
    ["after-lock-owner-fsync", 0],
  ]) {
    it(`recovers the marker-owned writer publication after SIGKILL at ${phase}`, async () => {
      const { root, config } = createProject();
      const ctx = prepareContext(root, config, { runId: `run-writer-${phase}`, issue: null });
      const result = await new RunPrepareSpecCommand().execute(ctx);
      const specId = result.spec.split("/")[1];
      const stopped = killSetIssueAtWriterPhase({
        root,
        worktreePath: result.worktreePath,
        specId,
        phase,
      });
      assert.equal(stopped.signal, "SIGKILL");

      const specDirectory = path.join(result.worktreePath, "specs", specId);
      const markerPath = path.join(result.worktreePath, ".senti", "flow-identity.issue-transaction.json");
      const lockPath = path.join(specDirectory, ".flow.json.writer.lock");
      const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
      const ownerTempPath = path.join(specDirectory, marker.writerOwnerTempName);
      const owner = JSON.parse(fs.readFileSync(ownerTempPath, "utf8"));
      assert.equal(path.basename(ownerTempPath), marker.writerOwnerTempName);
      assert.equal(owner.processIdentity.ownerToken, marker.writerOwnerToken);
      assert.equal(owner.transitionId, marker.transitionId);
      assert.equal(fs.existsSync(lockPath), expectedVisibleLinks > 0);
      assert.equal(fs.lstatSync(ownerTempPath).nlink, expectedVisibleLinks || 1);
      if (expectedVisibleLinks > 0) {
        assert.equal(fs.lstatSync(lockPath).nlink, expectedVisibleLinks);
        assert.equal(fs.lstatSync(lockPath).ino, fs.lstatSync(ownerTempPath).ino);
      }

      const restarted = new FlowManager({
        root: result.worktreePath,
        mainRoot: root,
        inWorktree: true,
        specId,
      });
      assert.equal(Object.hasOwn(restarted.load(), "issue"), false);
      restarted.setRequest(`mutation after ${phase}`, { specId });
      assert.equal(restarted.load().request, `mutation after ${phase}`);
      assert.equal(fs.existsSync(markerPath), false);
      assert.equal(fs.existsSync(lockPath), false);
      assert.equal(fs.existsSync(ownerTempPath), false);
    });
  }

  for (const publicationAttack of ["foreign", "third", "mismatched"]) {
    it(`fails stopped for a ${publicationAttack} writer publication authority`, async () => {
      const { root, config } = createProject();
      const ctx = prepareContext(root, config, { runId: `run-writer-${publicationAttack}`, issue: null });
      const result = await new RunPrepareSpecCommand().execute(ctx);
      const specId = result.spec.split("/")[1];
      const stopped = killSetIssueAtWriterPhase({
        root,
        worktreePath: result.worktreePath,
        specId,
        phase: "after-lock-publish",
      });
      assert.equal(stopped.signal, "SIGKILL");

      const specDirectory = path.join(result.worktreePath, "specs", specId);
      const markerPath = path.join(result.worktreePath, ".senti", "flow-identity.issue-transaction.json");
      const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
      const lockPath = path.join(specDirectory, ".flow.json.writer.lock");
      const ownerTempPath = path.join(specDirectory, marker.writerOwnerTempName);
      const foreignPath = path.join(specDirectory, `.foreign-${publicationAttack}.lock`);
      if (publicationAttack === "foreign") {
        fs.unlinkSync(ownerTempPath);
        fs.linkSync(lockPath, foreignPath);
      } else if (publicationAttack === "third") {
        fs.linkSync(lockPath, foreignPath);
      } else {
        const owner = JSON.parse(fs.readFileSync(lockPath, "utf8"));
        owner.transitionId = "33333333-3333-4333-8333-333333333333";
        fs.writeFileSync(lockPath, `${JSON.stringify(owner, null, 2)}\n`);
      }
      const authorityPaths = [
        path.join(specDirectory, "flow.json"),
        lockPath,
        markerPath,
        path.join(result.worktreePath, ".senti", "flow-identity.json"),
        ...(fs.existsSync(ownerTempPath) ? [ownerTempPath] : []),
        ...(fs.existsSync(foreignPath) ? [foreignPath] : []),
      ];
      const before = new Map(authorityPaths.map((target) => [target, fileBytes(target)]));

      const restarted = new FlowManager({
        root: result.worktreePath,
        mainRoot: root,
        inWorktree: true,
        specId,
      });
      assert.throws(() => restarted.load());
      for (const [target, bytes] of before) assert.deepEqual(fileBytes(target), bytes, target);
    });
  }

  it("fails stopped when a stale writer lock belongs to another Issue transition", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config, { runId: "run-set-issue-lock-mismatch", issue: null });
    const result = await new RunPrepareSpecCommand().execute(ctx);
    const specId = result.spec.split("/")[1];
    const flowManagerUrl = pathToFileURL(path.join(repoRoot, "src/lib/flow-manager.js")).href;
    const script = `
      import { FlowManager } from ${JSON.stringify(flowManagerUrl)};
      const [worktreePath, mainRoot, specId] = process.argv.slice(1);
      const manager = new FlowManager({ root: worktreePath, mainRoot, inWorktree: true, specId });
      manager.setIssue(440, {
        specId,
        faultInjector: ({ phase }) => {
          if (phase === "lock-acquired") process.kill(process.pid, "SIGKILL");
        },
      });
    `;
    const stopped = spawnSync(process.execPath, [
      "--input-type=module",
      "-e",
      script,
      result.worktreePath,
      root,
      specId,
    ]);
    assert.equal(stopped.signal, "SIGKILL");

    const specDirectory = path.join(result.worktreePath, "specs", specId);
    const flowPath = path.join(specDirectory, "flow.json");
    const lockPath = path.join(specDirectory, ".flow.json.writer.lock");
    const markerPath = path.join(result.worktreePath, ".senti", "flow-identity.issue-transaction.json");
    const bindingPath = path.join(result.worktreePath, ".senti", "flow-identity.json");
    const owner = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    owner.transitionId = "22222222-2222-4222-8222-222222222222";
    fs.writeFileSync(lockPath, `${JSON.stringify(owner, null, 2)}\n`);
    const before = new Map([
      [flowPath, fileBytes(flowPath)],
      [lockPath, fileBytes(lockPath)],
      [markerPath, fileBytes(markerPath)],
      [bindingPath, fileBytes(bindingPath)],
    ]);

    const restarted = new FlowManager({
      root: result.worktreePath,
      mainRoot: root,
      inWorktree: true,
      specId,
    });
    assert.throws(
      () => restarted.load(),
      (error) => error.code === "FLOW_STATE_ATOMIC_TRANSITION_MISMATCH",
    );
    for (const [target, bytes] of before) assert.deepEqual(fileBytes(target), bytes, target);
  });

  it("recovers the original identity after process interruption during marker publication", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config, { runId: "run-set-issue-marker-killed", issue: null });
    const result = await new RunPrepareSpecCommand().execute(ctx);
    const specId = result.spec.split("/")[1];
    const flowManagerUrl = pathToFileURL(path.join(repoRoot, "src/lib/flow-manager.js")).href;
    const script = `
      import { FlowManager } from ${JSON.stringify(flowManagerUrl)};
      const [worktreePath, mainRoot, specId] = process.argv.slice(1);
      const manager = new FlowManager({
        root: worktreePath,
        mainRoot,
        inWorktree: true,
        specId,
        bindingFaultInjector: ({ phase }) => {
          if (phase === "before-issue-transition-directory-fsync") {
            process.kill(process.pid, "SIGKILL");
          }
        },
      });
      manager.setIssue(440, { specId });
    `;

    const stopped = spawnSync(process.execPath, [
      "--input-type=module",
      "-e",
      script,
      result.worktreePath,
      root,
      specId,
    ]);
    assert.equal(stopped.signal, "SIGKILL");

    const restarted = new FlowManager({
      root: result.worktreePath,
      mainRoot: root,
      inWorktree: true,
      specId,
    });
    assert.equal(Object.hasOwn(restarted.load(), "issue"), false);
    assert.equal(restarted.resolveWorktreeBinding().issue, null);
    assert.equal(
      fs.existsSync(path.join(result.worktreePath, ".senti", "flow-identity.issue-transaction.json")),
      false,
    );
  });

  for (const fault of ["flow", "binding"]) {
    it(`restores flow and binding after an injected ${fault} write fault`, async () => {
      const { root, config } = createProject();
      const ctx = prepareContext(root, config, { runId: `run-${fault}-fault`, issue: null });
      const result = await new RunPrepareSpecCommand().execute(ctx);
      let injected = false;
      const manager = ctx.flowManager.forRoot(result.worktreePath, {
        specId: result.spec.split("/")[1],
        bindingFaultInjector: ({ phase }) => {
          if (fault === "binding" && !injected && phase === "before-binding-temp-write") {
            injected = true;
            throw new Error("injected set-issue binding fault");
          }
        },
      });

      assert.throws(
        () => manager.setIssue(440, {
          specId: result.spec.split("/")[1],
          faultInjector: ({ phase }) => {
            if (fault === "flow" && !injected && phase === "before-state-temp-write") {
              injected = true;
              throw new Error("injected set-issue flow fault");
            }
          },
        }),
        new RegExp(`injected set-issue ${fault} fault`),
      );
      assert.equal(manager.resolveWorktreeBinding().issue, null);
      assert.equal(Object.hasOwn(manager.load(), "issue"), false);
    });
  }

  it("rejects set-issue during live repository-operation contention without changing identity", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config, { runId: "run-contention", issue: null });
    const result = await new RunPrepareSpecCommand().execute(ctx);
    const manager = ctx.flowManager.forRoot(result.worktreePath, { specId: result.spec.split("/")[1] });
    const competing = new RepositoryFlowOperationLock({ mainRoot: root });
    competing.acquire();
    try {
      assert.throws(
        () => manager.setIssue(440, { specId: result.spec.split("/")[1] }),
        (error) => error.code === "REPOSITORY_FLOW_OPERATION_BUSY",
      );
    } finally {
      competing.release();
    }
    assert.equal(manager.resolveWorktreeBinding().issue, null);
    assert.equal(Object.hasOwn(manager.load(), "issue"), false);
  });

  for (const fault of ["write", "readback"]) {
    it(`rolls back only attempt-owned artifacts after binding ${fault} failure and permits same-run retry`, async () => {
      const { root, config } = createProject();
      const ctx = prepareContext(root, config, { issue: null });
      const registryPath = path.join(root, ".senti", ".active-flow");
      const currentPath = path.join(root, ".senti", ".current-flow");
      const preexisting = [{ spec: "900-preexisting", mode: "branch" }];
      fs.writeFileSync(registryPath, `${JSON.stringify(preexisting, null, 2)}\n`);
      fs.writeFileSync(currentPath, "999-unrelated\n");
      const beforeCurrent = fileBytes(currentPath);
      let injected = false;
      let bindingReads = 0;

      ctx.worktreeFlowBindingFaultInjector = ({ phase }) => {
        if (
          !injected
          && (
            (fault === "write" && phase === "before-binding-temp-write")
            || (fault === "readback" && phase === "before-binding-read" && ++bindingReads === 2)
          )
        ) {
            injected = true;
            fs.writeFileSync(registryPath, `${JSON.stringify([
              ...preexisting,
              { spec: "901-concurrent", mode: "branch" },
            ], null, 2)}\n`);
            throw new Error(
              fault === "write"
                ? "injected binding write failure"
                : "injected worktree verification failure",
            );
        }
      };

      await assert.rejects(
        () => new RunPrepareSpecCommand().execute(ctx),
        new RegExp(`injected ${fault === "write" ? "binding write" : "worktree verification"} failure`),
      );
      assert.deepEqual(attemptArtifacts(root), { worktree: false, branch: "", mainSpec: false });
      assert.equal(fileBytes(currentPath), beforeCurrent);
      assert.deepEqual(JSON.parse(fs.readFileSync(registryPath, "utf8")), [
        ...preexisting,
        { spec: "901-concurrent", mode: "branch" },
      ]);
      const preparing = ctx.flowManager.loadPreparingFlow("run-440");
      assert.equal(Object.hasOwn(preparing, "issue"), false);
      assert.equal(preparing.request, "fix issue-less flow");

      mock.restoreAll();
      delete ctx.worktreeFlowBindingFaultInjector;
      const retried = await new RunPrepareSpecCommand().execute(ctx);
      assert.equal(retried.result, "ok");
      assert.equal(retried.runId, "run-440");
    });
  }

  it("restores the shared info/exclude exact before-image after prepare rollback", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config, { issue: null });
    const excludePath = path.resolve(root, git(root, ["rev-parse", "--git-path", "info/exclude"]));
    fs.writeFileSync(excludePath, "# shared before-image\n/custom-entry\n");
    const before = fs.readFileSync(excludePath);
    ctx.worktreeFlowBindingFaultInjector = ({ phase }) => {
      if (phase === "before-binding-temp-write") throw new Error("injected exclude rollback fault");
    };

    await assert.rejects(
      () => new RunPrepareSpecCommand().execute(ctx),
      /injected exclude rollback fault/,
    );

    assert.deepEqual(fs.readFileSync(excludePath), before);
    assert.deepEqual(attemptArtifacts(root), { worktree: false, branch: "", mainSpec: false });
  });

  for (const publicationFault of ["registry", "preparing-delete"]) {
    it(`rolls back ${publicationFault} publication failure and permits the same-run retry`, async () => {
      const { root, config } = createProject();
      const ctx = prepareContext(root, config, { runId: `run-${publicationFault}`, issue: null });
      const method = publicationFault === "registry" ? "addActiveFlow" : "deletePreparingFlow";
      const original = ctx.flowManager[method];
      let injected = false;
      mock.method(ctx.flowManager, method, function failAfterPublication(...args) {
        const value = original.apply(this, args);
        if (!injected) {
          injected = true;
          throw new Error(`injected ${publicationFault} publication fault`);
        }
        return value;
      });

      await assert.rejects(
        () => new RunPrepareSpecCommand().execute(ctx),
        new RegExp(`injected ${publicationFault} publication fault`),
      );
      assert.equal(ctx.flowManager.loadPreparingFlow(`run-${publicationFault}`)?.runId, `run-${publicationFault}`);
      assert.deepEqual(attemptArtifacts(root), { worktree: false, branch: "", mainSpec: false });
      assert.deepEqual(ctx.flowManager.loadActiveFlows(), []);

      const retried = await new RunPrepareSpecCommand().execute(ctx);
      assert.equal(retried.result, "ok");
      assert.equal(retried.runId, `run-${publicationFault}`);
    });
  }

  it("counts a feature branch checked out in another worktree when choosing the next index", async () => {
    const { root, config } = createProject();
    const foreignPath = path.join(root, "foreign-index-worktree");
    git(root, ["worktree", "add", "-b", "feature/001-binding-transaction", foreignPath]);
    const foreignFlowPath = path.join(foreignPath, "specs", "001-binding-transaction", "flow.json");
    fs.mkdirSync(path.dirname(foreignFlowPath), { recursive: true });
    fs.writeFileSync(foreignFlowPath, "preserve sequential flow bytes\n");
    const foreignOid = git(root, ["rev-parse", "feature/001-binding-transaction"]);
    const ctx = prepareContext(root, config, { runId: "run-plus-index", issue: null });

    const result = await new RunPrepareSpecCommand().execute(ctx);

    assert.equal(result.spec, "specs/002-binding-transaction/spec.json");
    assert.equal(git(root, ["rev-parse", "feature/001-binding-transaction"]), foreignOid);
    assert.equal(fs.readFileSync(foreignFlowPath, "utf8"), "preserve sequential flow bytes\n");
  });

  it("does not roll back a same-name worktree and branch created before this attempt acquires authority", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config, { runId: "run-collision", issue: null });
    const collisionPath = path.join(
      root,
      ".senti",
      "worktree",
      "feature-001-binding-transaction",
    );
    const registryPath = path.join(root, ".senti", ".active-flow");
    const registryBytes = `${JSON.stringify([{ spec: "900-foreign", mode: "branch" }], null, 2)}\n`;
    fs.writeFileSync(registryPath, registryBytes);
    const originalAcquire = RepositoryFlowOperationLock.prototype.acquire;
    let injected = false;
    mock.method(RepositoryFlowOperationLock.prototype, "acquire", function acquire(...args) {
      if (!injected) {
        injected = true;
        git(root, [
          "worktree",
          "add",
          "-b",
          "feature/001-binding-transaction",
          collisionPath,
        ]);
        const foreignFlowPath = path.join(
          collisionPath,
          "specs",
          "001-binding-transaction",
          "flow.json",
        );
        fs.mkdirSync(path.dirname(foreignFlowPath), { recursive: true });
        fs.writeFileSync(foreignFlowPath, "preserve collision flow bytes\n");
      }
      return originalAcquire.apply(this, args);
    });

    await assert.rejects(
      () => new RunPrepareSpecCommand().execute(ctx),
      /worktree add|already exists|already checked out/i,
    );

    assert.equal(fs.existsSync(collisionPath), true);
    assert.equal(
      fs.readFileSync(
        path.join(collisionPath, "specs", "001-binding-transaction", "flow.json"),
        "utf8",
      ),
      "preserve collision flow bytes\n",
    );
    assert.notEqual(git(root, ["branch", "--list", "feature/001-binding-transaction"]), "");
    assert.equal(fs.readFileSync(registryPath, "utf8"), registryBytes);
  });

  it("ignores only the six exact flow identity authority files", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config, { runId: "run-exclude-exact", issue: null });
    const result = await new RunPrepareSpecCommand().execute(ctx);
    const exactTransition = path.join(
      result.worktreePath,
      ".senti",
      "flow-identity.issue-transaction.json",
    );
    const similarBinding = path.join(result.worktreePath, ".senti", "flow-identity.backup.json");
    const similarTransition = `${exactTransition}.backup`;
    const similarReceipt = path.join(result.worktreePath, ".senti", ".flow-identity.publication.json.backup");
    const similarIntent = path.join(result.worktreePath, ".senti", ".flow-identity.publication.intent.backup");
    const similarReceiptTemp = path.join(result.worktreePath, ".senti", ".flow-identity.publication.receipt.tmp.backup");
    const similarBindingTemp = path.join(result.worktreePath, ".senti", ".flow-identity.publication.binding.tmp.backup");
    fs.writeFileSync(exactTransition, "{}\n");
    fs.writeFileSync(similarBinding, "visible binding prefix\n");
    fs.writeFileSync(similarTransition, "visible transition prefix\n");
    fs.writeFileSync(similarReceipt, "visible receipt prefix\n");
    fs.writeFileSync(similarIntent, "visible intent prefix\n");
    fs.writeFileSync(similarReceiptTemp, "visible receipt temp prefix\n");
    fs.writeFileSync(similarBindingTemp, "visible binding temp prefix\n");

    assert.notEqual(git(result.worktreePath, ["check-ignore", ".senti/flow-identity.json"]), "");
    assert.notEqual(
      git(result.worktreePath, ["check-ignore", ".senti/flow-identity.issue-transaction.json"]),
      "",
    );
    assert.notEqual(
      git(result.worktreePath, ["check-ignore", ".senti/.flow-identity.publication.json"]),
      "",
    );
    for (const authority of [
      ".senti/.flow-identity.publication.intent",
      ".senti/.flow-identity.publication.receipt.tmp",
      ".senti/.flow-identity.publication.binding.tmp",
    ]) {
      assert.notEqual(git(result.worktreePath, ["check-ignore", authority]), "", authority);
    }
    const status = git(result.worktreePath, ["status", "--porcelain", "--untracked-files=all"]);
    assert.match(status, /\.senti\/flow-identity\.backup\.json/);
    assert.match(status, /\.senti\/flow-identity\.issue-transaction\.json\.backup/);
    assert.match(status, /\.senti\/\.flow-identity\.publication\.json\.backup/);
    assert.match(status, /\.senti\/\.flow-identity\.publication\.intent\.backup/);
    assert.match(status, /\.senti\/\.flow-identity\.publication\.receipt\.tmp\.backup/);
    assert.match(status, /\.senti\/\.flow-identity\.publication\.binding\.tmp\.backup/);
  });

  it("retains PostWorktree, artifact, plugin, docs, Git, and registry behavior", async () => {
    const { root, config } = createProject();
    const ctx = prepareContext(root, config);
    const result = await new RunPrepareSpecCommand().execute(ctx);
    const specDir = path.join(result.worktreePath, "specs", "001-binding-transaction");

    for (const relative of ["spec.json", "draft.json", "issue.md", "flow.json"]) {
      assert.equal(fs.existsSync(path.join(specDir, relative)), true, relative);
    }
    assert.equal(fs.readFileSync(path.join(result.worktreePath, "post-worktree.marker"), "utf8"), "ok");
    assert.deepEqual(
      fs.readFileSync(path.join(result.worktreePath, ".senti", "config.local.json")),
      fs.readFileSync(path.join(root, ".senti", "config.local.json")),
    );
    const analysis = JSON.parse(fs.readFileSync(
      path.join(result.worktreePath, ".senti", "output", "analysis.json"),
      "utf8",
    ));
    assert.doesNotThrow(() => [...iterateAnalysisCategories(analysis, { strict: true })]);
    assert.equal(
      git(root, ["branch", "--list", "feature/001-binding-transaction"]).replace(/^[+* ]+/, ""),
      "feature/001-binding-transaction",
    );
    const flow = JSON.parse(fs.readFileSync(path.join(specDir, "flow.json"), "utf8"));
    assert.deepEqual(
      { runId: flow.runId, issue: flow.issue, spec: flow.spec, worktree: flow.worktree },
      { runId: "run-440", issue: 440, spec: result.spec, worktree: true },
    );
    assert.ok(flow.plugins.flowCommandHooks.some((hook) => hook.pluginId === "workflow" && hook.command === "prepare"));
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(specDir, "plugin-artifacts", "workflow", "prepare-seen.json"), "utf8")),
      { issue: 440, flowIntegration: "enable", postWorktreeSeen: true },
    );
  });

  it("keeps required-config preflight ahead of worktree and binding side effects", async () => {
    const { root, config } = createProject();
    fs.appendFileSync(path.join(root, ".senti", "config.json"), "\n");
    const ctx = prepareContext(root, config);
    const registryPath = path.join(root, ".senti", ".active-flow");
    const currentPath = path.join(root, ".senti", ".current-flow");
    const beforeRegistry = fileBytes(registryPath);
    const beforeCurrent = fileBytes(currentPath);

    const result = await new RunPrepareSpecCommand().execute(ctx);

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "REQUIRED_WORKTREE_FILES_UNREFLECTED");
    assert.deepEqual(attemptArtifacts(root), { worktree: false, branch: "", mainSpec: false });
    assert.equal(fileBytes(registryPath), beforeRegistry);
    assert.equal(fileBytes(currentPath), beforeCurrent);
  });
});
