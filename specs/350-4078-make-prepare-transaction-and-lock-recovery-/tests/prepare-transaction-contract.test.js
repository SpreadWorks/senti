// spec: R1 R2 R3 R4 R5
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import { RunPrepareSpecCommand } from "../../../src/flow/lib/run-prepare-spec.js";
import { PreparingFlowStore } from "../../../src/lib/preparing-flow-store.js";
import { ProcessIdentitySource } from "../../../src/lib/process-identity.js";
import { ProcessOwnedLock, RealDirectoryAuthority } from "../../../src/lib/process-owned-lock.js";
import { makeContainer, makeFlowManager } from "../../../tests/helpers/flow-setup.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const roots = [];
const preparePhases = [
  "after-journal-publication",
  "after-worktree-add",
  "after-exclusion-registration",
  "after-planning-state-publication",
  "after-identity-binding",
  "after-registry-publication",
  "after-preparing-flow-removal",
  "after-journal-completion",
];

function root() {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "senti-472-"));
  roots.push(value);
  return value;
}

function git(directory, args) {
  const result = spawnSync("git", ["-C", directory, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function identity({ platform = "linux", boot = "boot", fingerprint = "1" } = {}) {
  return new ProcessIdentitySource({
    platform,
    pid: process.pid,
    readBootIdentity: () => boot,
    readProcessStartFingerprint: () => fingerprint,
  });
}

function lock(dir, source) {
  return new ProcessOwnedLock({
    directoryAuthority: new RealDirectoryAuthority(dir),
    fileName: ".lock",
    kind: "spec-472",
    authority: { root: fs.realpathSync(dir), scope: "spec-472" },
    processIdentitySource: source,
  });
}

function writeLock(candidate, owner) {
  fs.writeFileSync(candidate.lockPath, `${JSON.stringify({
    version: 1,
    kind: "spec-472",
    root: candidate.authority.root,
    scope: "spec-472",
    processIdentity: owner,
  })}\n`);
}

function createProject() {
  const project = root();
  const config = { lang: "en", type: "base", docs: { languages: ["en"], defaultLanguage: "en" } };
  fs.mkdirSync(path.join(project, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(project, ".senti", "config.json"), JSON.stringify(config));
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "senti-472-fixture", version: "0.0.0", type: "module" }));
  git(project, ["init", "-b", "main"]);
  git(project, ["config", "user.email", "test@example.com"]);
  git(project, ["config", "user.name", "Test User"]);
  git(project, ["add", ".senti/config.json", "package.json"]);
  git(project, ["commit", "-m", "fixture"]);
  return { project, config };
}

function prepareContext(project, config, runId) {
  const flowManager = makeFlowManager(project);
  flowManager.createPreparingFlow(runId, {
    issue: 472,
    issueBody: "Issue #472",
    request: "make prepare atomic",
  });
  return {
    root: project,
    mainRoot: project,
    flowManager,
    config,
    title: "prepare-transaction",
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

function interruptPrepareAt(project, config, runId, phase) {
  const prepareUrl = pathToFileURL(path.join(repoRoot, "src/flow/lib/run-prepare-spec.js")).href;
  const managerUrl = pathToFileURL(path.join(repoRoot, "src/lib/flow-manager.js")).href;
  const script = `
    import { RunPrepareSpecCommand } from ${JSON.stringify(prepareUrl)};
    import { FlowManager } from ${JSON.stringify(managerUrl)};
    const [root, configJson, runId, phase] = process.argv.slice(1);
    const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false });
    await new RunPrepareSpecCommand().execute({
      root, mainRoot: root, flowManager, config: JSON.parse(configJson),
      title: "prepare-transaction", base: "main", runId, worktree: true,
      noBranch: false, dryRun: false, issue: null, request: "", flowState: null,
      worktreePrepareFaultInjector: ({ phase: checkpoint }) => {
        if (checkpoint === phase) process.kill(process.pid, "SIGKILL");
      },
    });
  `;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script, project, JSON.stringify(config), runId, phase]);
}

function journalPath(project) {
  return path.join(project, ".senti", ".worktree-prepare-attempt.json");
}

function flowCli(project, args) {
  return spawnSync(process.execPath, [path.join(repoRoot, "src/senti.js"), "flow", ...args], {
    cwd: project,
    encoding: "utf8",
  });
}

function nextActionContainer(project, config) {
  const container = makeContainer(project);
  container.register("paths", { root: project });
  container.register("mainRoot", project);
  container.register("config", config);
  container.register("inWorktree", false);
  return container;
}

function foreignAuthority(project) {
  const worktreePath = path.join(project, "foreign-authority");
  git(project, ["worktree", "add", "-b", "feature/900-foreign", worktreePath]);
  const marker = path.join(worktreePath, "foreign.txt");
  fs.writeFileSync(marker, "foreign authority\n");
  git(worktreePath, ["add", "foreign.txt"]);
  git(worktreePath, ["commit", "-m", "foreign authority"]);
  return {
    worktreePath,
    marker,
    oid: git(project, ["rev-parse", "feature/900-foreign"]),
    bytes: fs.readFileSync(marker),
  };
}

function assertForeignAuthorityUnchanged(project, foreign) {
  assert.equal(fs.existsSync(foreign.worktreePath), true);
  assert.equal(git(project, ["rev-parse", "feature/900-foreign"]), foreign.oid);
  assert.deepEqual(fs.readFileSync(foreign.marker), foreign.bytes);
}

afterEach(() => roots.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

test("R1: unavailable identity rejects lock and preparing-state mutation before publication", async () => {
  const dir = root();
  const candidate = lock(dir, identity({ platform: "darwin" }));
  assert.throws(() => candidate.acquire(), (error) => error.code === "PROCESS_IDENTITY_UNAVAILABLE");
  assert.equal(fs.existsSync(candidate.lockPath), false);

  const store = new PreparingFlowStore({ mainRoot: dir, processIdentitySource: identity({ platform: "win32" }) });
  assert.throws(() => store.create("run-472"), (error) => error.code === "PROCESS_IDENTITY_UNAVAILABLE");
  assert.equal(fs.existsSync(path.join(dir, ".senti")), false);

  const unavailable = new ProcessIdentitySource({
    platform: "linux",
    pid: process.pid,
    readBootIdentity: () => { throw new Error("boot identity unreadable"); },
    readProcessStartFingerprint: () => "1",
  });
  const unavailableLock = lock(dir, unavailable);
  assert.throws(() => unavailableLock.acquire(), (error) => error.code === "PROCESS_IDENTITY_UNAVAILABLE");
  assert.throws(
    () => new PreparingFlowStore({ mainRoot: dir, processIdentitySource: unavailable }).create("run-unavailable"),
    (error) => error.code === "PROCESS_IDENTITY_UNAVAILABLE",
  );
  assert.equal(fs.existsSync(unavailableLock.lockPath), false);
  assert.equal(fs.existsSync(path.join(dir, ".senti")), false);

  const { project, config } = createProject();
  const ctx = prepareContext(project, config, "run-r1-prepare");
  const preparingPath = path.join(project, ".senti", ".active-flow.run-r1-prepare");
  const preparingBefore = fs.readFileSync(preparingPath);
  ctx.worktreePrepareProcessIdentitySource = unavailable;
  await assert.rejects(
    () => new RunPrepareSpecCommand().execute(ctx),
    (error) => error.code === "PROCESS_IDENTITY_UNAVAILABLE",
  );
  assert.deepEqual(fs.readFileSync(preparingPath), preparingBefore);
  assert.equal(fs.existsSync(path.join(project, ".senti", ".repository-flow-operation.lock")), false);
  assert.equal(fs.existsSync(journalPath(project)), false);
  assert.equal(fs.existsSync(path.join(project, ".senti", "worktree")), false);
  assert.equal(git(project, ["branch", "--list", "feature/*"]), "");
});

test("R2: only proven stale owners are reclaimed", () => {
  const dir = root();
  const owner = identity({ boot: "current" }).createOwner("11111111-1111-4111-8111-111111111111");
  const unknownOwner = { ...owner, pid: 999999 };
  for (const [label, source, storedOwner, reclaimed] of [
    ["live", identity({ boot: "current" }), owner, false],
    ["unknown", new ProcessIdentitySource({
      platform: "linux",
      pid: process.pid,
      readBootIdentity: () => "current",
      readProcessStartFingerprint: (pid) => {
        if (pid === process.pid) return "1";
        throw new Error("unavailable");
      },
    }), unknownOwner, false],
    ["stale", new ProcessIdentitySource({
      platform: "linux",
      pid: process.pid,
      readBootIdentity: () => "current",
      readProcessStartFingerprint: () => "2",
    }), owner, true],
    ["stale", identity({ boot: "other" }), owner, true],
  ]) {
    const candidate = lock(dir, source);
    writeLock(candidate, storedOwner);
    if (reclaimed) {
      assert.doesNotThrow(() => candidate.acquire({ claimStale: true }), label);
      candidate.release();
    } else {
      const before = fs.readFileSync(candidate.lockPath);
      assert.throws(() => candidate.acquire({ claimStale: true }), (error) => error.code === `PROCESS_OWNED_LOCK_${label.toUpperCase()}`);
      assert.deepEqual(fs.readFileSync(candidate.lockPath), before);
      fs.unlinkSync(candidate.lockPath);
    }
  }
});

test("R3: corrupt preparing state fails closed instead of becoming missing", async () => {
  for (const [label, materialize] of [
    ["truncated", (file) => fs.writeFileSync(file, "{truncated")],
    ["corrupt", (file) => fs.writeFileSync(file, JSON.stringify({ lifecycle: "invalid" }))],
    ["unreadable", (file) => fs.mkdirSync(file)],
  ]) {
    const { project, config } = createProject();
    const file = path.join(project, ".senti", ".active-flow.run-472");
    materialize(file);
    const store = new PreparingFlowStore({ mainRoot: project });
    assert.throws(() => store.resolveInputs("run-472", "", ""), (error) => error.code === "PREPARING_FLOW_CORRUPT", label);
    for (const args of [
      ["prepare", "--run-id", "run-472", "--title", "corrupt-state", "--worktree"],
      ["get", "status", "run-472"],
    ]) {
      const result = flowCli(project, args);
      const output = `${result.stdout}\n${result.stderr}`;
      if (args[0] === "prepare") assert.notEqual(result.status, 0, `${label}: ${args.join(" ")}`);
      assert.match(output, /PREPARING_FLOW_CORRUPT|preparing flow is corrupt/i, label);
      assert.doesNotMatch(output, /FLOW_TARGET_NOT_FOUND|"active": false/, label);
    }
    await assert.rejects(
      () => new GetNextActionCommand().run(nextActionContainer(project, config), { runId: "run-472" }),
      (error) => error.code === "PREPARING_FLOW_CORRUPT",
      label,
    );
    if (label !== "unreadable") assert.equal(fs.readFileSync(file, "utf8").length > 0, true, label);
    assert.equal(config.lang, "en");
  }
});

test("R4: a different retry cannot consume a durable attempt journal", async () => {
  const { project, config } = createProject();
  const ctx = prepareContext(project, config, "run-r4");
  assert.equal(interruptPrepareAt(project, config, "run-r4", "after-worktree-add").signal, "SIGKILL");
  const before = fs.readFileSync(journalPath(project));
  await assert.rejects(
    () => new RunPrepareSpecCommand().execute({ ...ctx, title: "different-request" }),
    /exact retry target/,
  );
  assert.deepEqual(fs.readFileSync(journalPath(project)), before);
  const result = await new RunPrepareSpecCommand().execute(ctx);
  assert.equal(result.result, "ok");
  assert.equal(fs.existsSync(journalPath(project)), false);
});

test("R4: an anonymous retry cannot consume a durable attempt journal", async () => {
  const { project, config } = createProject();
  const ctx = prepareContext(project, config, "run-anonymous");
  assert.equal(interruptPrepareAt(project, config, "run-anonymous", "after-worktree-add").signal, "SIGKILL");
  const before = fs.readFileSync(journalPath(project));
  await assert.rejects(
    () => new RunPrepareSpecCommand().execute({
      ...ctx,
      runId: "",
      issue: 472,
      request: "make prepare atomic",
    }),
    /exact retry target/,
  );
  assert.deepEqual(fs.readFileSync(journalPath(project)), before);
  const result = await new RunPrepareSpecCommand().execute(ctx);
  assert.equal(result.result, "ok");
  assert.equal(fs.existsSync(journalPath(project)), false);
});

test("R4: every retry identity field rejects a different invocation without consuming the journal", async () => {
  const { project, config } = createProject();
  const ctx = prepareContext(project, config, "run-identity");
  assert.equal(interruptPrepareAt(project, config, "run-identity", "after-worktree-add").signal, "SIGKILL");
  const assertRejectedWithoutConsumption = async (label, changed) => {
    const before = fs.readFileSync(journalPath(project));
    await assert.rejects(() => new RunPrepareSpecCommand().execute(changed), /exact retry target|base revision|managed path/i, label);
    assert.deepEqual(fs.readFileSync(journalPath(project)), before, label);
  };
  ctx.flowManager.createPreparingFlow("run-other", { issue: 472, request: "make prepare atomic" });
  await assertRejectedWithoutConsumption("runId", { ...ctx, runId: "run-other" });
  await assertRejectedWithoutConsumption("Issue", { ...ctx, issue: 473 });
  await assertRejectedWithoutConsumption("request", { ...ctx, request: "different request" });
  await assertRejectedWithoutConsumption("branch", { ...ctx, title: "different-request" });
  fs.writeFileSync(path.join(project, "base-change.txt"), "new base revision\n");
  git(project, ["add", "base-change.txt"]);
  git(project, ["commit", "-m", "advance base"]);
  await assertRejectedWithoutConsumption("base revision", ctx);
  const journal = JSON.parse(fs.readFileSync(journalPath(project), "utf8"));
  journal.worktreePath = path.join(project, "foreign-worktree");
  fs.writeFileSync(journalPath(project), `${JSON.stringify(journal)}\n`);
  await assertRejectedWithoutConsumption("worktree path", ctx);
});

test("R4: production rollback removes its durable journal without touching foreign authority", async () => {
  const { project, config } = createProject();
  const ctx = prepareContext(project, config, "run-rollback");
  const foreign = foreignAuthority(project);
  const preparingPath = path.join(project, ".senti", ".active-flow.run-rollback");
  const preparingBefore = fs.readFileSync(preparingPath);
  ctx.worktreePrepareFaultInjector = ({ phase }) => {
    if (phase === "after-worktree-add") throw new Error("inject rollback");
  };
  await assert.rejects(() => new RunPrepareSpecCommand().execute(ctx), /inject rollback/);
  assert.equal(fs.existsSync(journalPath(project)), false);
  assert.equal(fs.existsSync(path.join(project, ".senti", "worktree", "feature-901-prepare-transaction")), false);
  assert.equal(git(project, ["branch", "--list", "feature/901-prepare-transaction"]), "");
  assert.deepEqual(fs.readFileSync(preparingPath), preparingBefore);
  assertForeignAuthorityUnchanged(project, foreign);
});

test("R5: every durable boundary either exact-retries or completes without a journal", { concurrency: false }, async () => {
  for (const phase of preparePhases) {
    const { project, config } = createProject();
    const runId = `run-${phase}`;
    const ctx = prepareContext(project, config, runId);
    const foreign = foreignAuthority(project);
    assert.equal(interruptPrepareAt(project, config, runId, phase).signal, "SIGKILL", phase);
    if (phase === "after-journal-completion") {
      assert.equal(fs.existsSync(journalPath(project)), false, phase);
      assert.equal(ctx.flowManager.loadPreparingFlow(runId), null, phase);
      assertForeignAuthorityUnchanged(project, foreign);
      continue;
    }
    assert.equal(fs.existsSync(journalPath(project)), true, phase);
    const result = await new RunPrepareSpecCommand().execute(ctx);
    assert.equal(result.result, "ok", phase);
    assert.equal(fs.existsSync(journalPath(project)), false, phase);
    assertForeignAuthorityUnchanged(project, foreign);
  }
});
