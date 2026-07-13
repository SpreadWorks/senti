// spec: R1 R2 R3 R4 R5 R6
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { FinalizeCleanupPathResolver } from "../../../src/lib/finalize-cleanup-paths.js";
import { runFlowCommandWithPluginLifecycle } from "../../../src/lib/plugin-registry.js";
import * as cleanup from "../../../src/flow/lib/run-finalize-cleanup.js";

const SPEC_ID = "304-finalize-cleanup-readonly";

function makeRoots() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-304-cleanup-"));
  const worktreeRoot = path.join(tmp, "worktree");
  const mainRoot = path.join(tmp, "main");
  fs.mkdirSync(worktreeRoot, { recursive: true });
  fs.mkdirSync(mainRoot, { recursive: true });
  return {
    tmp,
    worktreeRoot,
    mainRoot,
    cleanup() {
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

function makeActiveResolver(worktreeRoot, mainRoot) {
  return new FinalizeCleanupPathResolver({
    enabled: true,
    worktreeRoot,
    mainRoot,
    inWorktree: true,
  });
}

function writeFlowState(root, extra = {}) {
  const specDir = path.join(root, "specs", SPEC_ID);
  fs.mkdirSync(specDir, { recursive: true });
  const state = {
    spec: `specs/${SPEC_ID}/spec.json`,
    worktree: true,
    baseBranch: "main",
    featureBranch: "feature/304-finalize-cleanup-readonly",
    steps: [],
    tasks: [],
    currentTaskId: null,
    metrics: [],
    notes: [],
    ...extra,
  };
  fs.writeFileSync(path.join(specDir, "flow.json"), JSON.stringify(state, null, 2) + "\n", "utf8");
  return state;
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function snapshotTree(root) {
  const entries = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const hash = crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex");
        entries.push([rel, hash]);
      }
    }
  }
  walk(root);
  return entries.sort((a, b) => a[0].localeCompare(b[0]));
}

function assertOutsideWorktree(worktreeRoot, filePath) {
  const rel = path.relative(path.resolve(worktreeRoot), path.resolve(filePath));
  assert.ok(rel.startsWith("..") || path.isAbsolute(rel), `${filePath} must be outside target worktree`);
}

function makeGitRecorder() {
  const calls = [];
  const runGit = (args) => {
    calls.push(args);
    return { ok: true, stdout: "", stderr: "" };
  };
  return { calls, runGit };
}

function writeFakeGit(binDir, { worktreeRoot, mainRoot, logPath }) {
  fs.mkdirSync(binDir, { recursive: true });
  const gitPath = path.join(binDir, "git");
  fs.writeFileSync(gitPath, `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(args) + "\\n");
let rest = args.slice();
if (rest[0] === "-C") rest = rest.slice(2);
function ok(stdout = "") { if (stdout) process.stdout.write(stdout); process.exit(0); }
if (rest[0] === "rev-parse" && rest[1] === "--show-toplevel") ok(${JSON.stringify(worktreeRoot)} + "\\n");
if (rest[0] === "rev-parse" && rest[1] === "--git-common-dir") ok(${JSON.stringify(path.join(mainRoot, ".git"))} + "\\n");
if (rest[0] === "status") ok("");
if (rest[0] === "add" || rest[0] === "commit") ok("");
if (rest[0] === "worktree" && rest[1] === "list") ok("");
if (rest[0] === "worktree" && rest[1] === "remove") {
  fs.rmSync(rest[rest.length - 1], { recursive: true, force: true });
  ok("");
}
if (rest[0] === "branch" && rest[1] === "-D") ok("");
if (rest[0] === "branch" && rest[1] === "--list") ok("");
ok("");
`, "utf8");
  fs.chmodSync(gitPath, 0o755);
}

test("R1: cleanup write policy relocates flow and plugin artifact writes away from target worktree", () => {
  const roots = makeRoots();
  try {
    const resolver = makeActiveResolver(roots.worktreeRoot, roots.mainRoot);
    assert.equal(typeof resolver.cleanupWritePath, "function");

    const flowJson = path.join(roots.worktreeRoot, "specs", "304-finalize-cleanup-readonly", "flow.json");
    const pluginArtifact = path.join(
      roots.worktreeRoot,
      "specs",
      "304-finalize-cleanup-readonly",
      "plugin-artifacts",
      "workflow",
      "finalize-cleanup.json",
    );

    const relocatedFlow = resolver.cleanupWritePath(flowJson, { specId: "304-finalize-cleanup-readonly" });
    const relocatedPlugin = resolver.cleanupWritePath(pluginArtifact, { specId: "304-finalize-cleanup-readonly" });

    assertOutsideWorktree(roots.worktreeRoot, relocatedFlow);
    assertOutsideWorktree(roots.worktreeRoot, relocatedPlugin);
    assert.equal(
      path.resolve(relocatedFlow),
      path.join(roots.mainRoot, "specs", "304-finalize-cleanup-readonly", "flow.json"),
    );
  } finally {
    roots.cleanup();
  }
});

test("R1: production post-command metadata writer does not mutate the target worktree", () => {
  const roots = makeRoots();
  try {
    writeFlowState(roots.worktreeRoot);
    writeFlowState(roots.mainRoot);
    const targetFlowJson = path.join(roots.worktreeRoot, "specs", SPEC_ID, "flow.json");
    const mainFlowJson = path.join(roots.mainRoot, "specs", SPEC_ID, "flow.json");
    const targetBefore = readText(targetFlowJson);
    const mainBefore = readText(mainFlowJson);
    const treeBefore = snapshotTree(roots.worktreeRoot);

    assert.equal(typeof cleanup.recordFinalizeCleanupPostCommandMetadata, "function");
    const result = cleanup.recordFinalizeCleanupPostCommandMetadata({
      flowManager: new FlowManager({
        root: roots.worktreeRoot,
        mainRoot: roots.mainRoot,
        inWorktree: true,
        specId: SPEC_ID,
      }),
      specId: SPEC_ID,
      metrics: [{ phase: "finalize", counter: "agent", delta: 1 }],
      runtimeLog: { runId: "r1", sequence: 99, exitCode: 0 },
      notes: ["post-command finalize-cleanup metadata"],
      issueLogEntries: [{ reason: "post-command audit entry", step: "finalize-cleanup" }],
      pluginArtifacts: [
        {
          relPath: `specs/${SPEC_ID}/plugin-artifacts/workflow/finalize-cleanup.json`,
          data: { ok: true, followUps: ["durable"] },
        },
      ],
      report: { text: "Finalize Report\n", path: `specs/${SPEC_ID}/report.json` },
    });

    assert.equal(readText(targetFlowJson), targetBefore);
    assert.equal(readText(mainFlowJson), mainBefore);
    assert.deepEqual(snapshotTree(roots.worktreeRoot), treeBefore);
    assert.ok(Array.isArray(result.writtenPaths));
    assert.ok(result.writtenPaths.length >= 5);
    for (const writtenPath of result.writtenPaths) {
      assertOutsideWorktree(roots.worktreeRoot, writtenPath);
      assert.ok(fs.existsSync(writtenPath), `${writtenPath} should be created in durable storage`);
    }
    assert.deepEqual([...new Set(result.surfaces)].sort(), [
      "agent-metrics",
      "issue-log",
      "notes",
      "plugin-artifact",
      "plugin-hook-output",
      "report-envelope",
      "runtime-log",
    ]);
  } finally {
    roots.cleanup();
  }
});

test("R1: finalize-cleanup plugin lifecycle writes artifacts to durable cleanup storage", async () => {
  const roots = makeRoots();
  try {
    writeFlowState(roots.worktreeRoot);
    writeFlowState(roots.mainRoot);
    fs.mkdirSync(path.join(roots.mainRoot, ".senti", "plugins", "probe", "hooks"), { recursive: true });
    fs.writeFileSync(path.join(roots.mainRoot, ".senti", "config.json"), JSON.stringify({
      lang: "en",
      plugin: {
        sources: [],
        packages: [
          { id: "probe", source: "local" },
          { id: "second", source: "local" },
        ],
      },
    }, null, 2) + "\n", "utf8");
    fs.writeFileSync(path.join(roots.mainRoot, ".senti", "plugins", "probe", "hooks", "finalize-cleanup.js"), `
export default function register(api) {
  class ProbeFinalizeCleanupHook extends api.FlowCommandHook {
    static command = "finalize-cleanup";
    static hook = "post";
    static priority = 0;

    async run(ctx) {
      await ctx.artifacts.writeText("probe.txt", "ok");
      return { ok: true, data: { followUps: ["probe artifact written"] } };
    }
  }
  return ProbeFinalizeCleanupHook;
}
`, "utf8");
    fs.mkdirSync(path.join(roots.mainRoot, ".senti", "plugins", "second", "hooks"), { recursive: true });
    fs.writeFileSync(path.join(roots.mainRoot, ".senti", "plugins", "second", "hooks", "finalize-cleanup.js"), `
export default function register(api) {
  class SecondFinalizeCleanupHook extends api.FlowCommandHook {
    static command = "finalize-cleanup";
    static hook = "post";
    static priority = 1;

    async run(ctx) {
      await ctx.artifacts.writeText("probe.txt", "second");
      return { ok: true, data: { followUps: ["second artifact written"] } };
    }
  }
  return SecondFinalizeCleanupHook;
}
`, "utf8");

    const state = writeFlowState(roots.worktreeRoot);
    const context = cleanup.finalizeCleanupPluginLifecycleContext({
      root: roots.worktreeRoot,
      state,
      worktreePath: roots.worktreeRoot,
      mainRepoPath: roots.mainRoot,
      specId: SPEC_ID,
    });
    const hookSnapshot = [{
      apiVersion: 1,
      pluginId: "probe",
      module: "hooks/finalize-cleanup.js",
      className: "ProbeFinalizeCleanupHook",
      command: "finalize-cleanup",
      hook: "post",
      priority: 0,
    }, {
      apiVersion: 1,
      pluginId: "second",
      module: "hooks/finalize-cleanup.js",
      className: "SecondFinalizeCleanupHook",
      command: "finalize-cleanup",
      hook: "post",
      priority: 1,
    }];

    const lifecycle = await runFlowCommandWithPluginLifecycle(context.root, hookSnapshot, {
      command: "finalize-cleanup",
      flow: context.flow,
      main: async () => ({
        ok: true,
        data: {
          specPath: state.spec,
          artifactPath: context.artifactPath,
        },
      }),
    });

    const durableArtifact = path.join(roots.mainRoot, context.artifactPath, "probe", "probe.txt");
    const secondArtifact = path.join(roots.mainRoot, context.artifactPath, "second", "probe.txt");
    const worktreeArtifact = path.join(roots.worktreeRoot, "specs", SPEC_ID, "plugin-artifacts", "probe", "probe.txt");
    assert.equal(lifecycle.ok, true);
    assert.equal(context.root, roots.mainRoot);
    assertOutsideWorktree(roots.worktreeRoot, durableArtifact);
    assert.equal(readText(durableArtifact), "ok");
    assert.equal(readText(secondArtifact), "second");
    assert.equal(fs.existsSync(worktreeArtifact), false);
    assert.ok(context.artifactPath.startsWith(".senti/agent-work/finalize-cleanup/"));
  } finally {
    roots.cleanup();
  }
});

test("R2: retained finalize-cleanup surfaces have durable owners outside the removable worktree", () => {
  const roots = makeRoots();
  try {
    writeFlowState(roots.worktreeRoot);
    writeFlowState(roots.mainRoot);
    const resolver = makeActiveResolver(roots.worktreeRoot, roots.mainRoot);
    assert.equal(typeof resolver.cleanupSurfaceOwner, "function");

    const owners = [
      resolver.cleanupSurfaceOwner("final-flow-json", { specId: "304-finalize-cleanup-readonly" }),
      resolver.cleanupSurfaceOwner("issue-log", { specId: "304-finalize-cleanup-readonly" }),
      resolver.cleanupSurfaceOwner("plugin-artifact", { specId: "304-finalize-cleanup-readonly" }),
      resolver.cleanupSurfaceOwner("runtime-metadata", { specId: "304-finalize-cleanup-readonly" }),
    ];

    for (const owner of owners) {
      assert.equal(typeof owner.path, "string");
      assertOutsideWorktree(roots.worktreeRoot, owner.path);
    }
    assert.equal(owners[0].commitBoundary, "final-flow-json-commit");
    assert.equal(owners[3].commitBoundary, "post-command-sidecar");

    assert.equal(typeof cleanup.recordFinalizeCleanupPostCommandMetadata, "function");
    const result = cleanup.recordFinalizeCleanupPostCommandMetadata({
      flowManager: new FlowManager({
        root: roots.worktreeRoot,
        mainRoot: roots.mainRoot,
        inWorktree: true,
        specId: SPEC_ID,
      }),
      specId: SPEC_ID,
      metrics: [{ phase: "finalize", counter: "agent", delta: 1 }],
      runtimeLog: { runId: "r2", sequence: 1, exitCode: 0 },
      notes: ["retained note"],
      issueLogEntries: [{ reason: "retained audit", step: "finalize-cleanup" }],
      pluginArtifacts: [{ relPath: `specs/${SPEC_ID}/plugin-artifacts/hook.json`, data: { retained: true } }],
      report: { text: "report", path: `specs/${SPEC_ID}/report.json` },
    });

    for (const surface of ["agent-metrics", "runtime-log", "notes", "issue-log", "plugin-artifact", "report-envelope"]) {
      assert.ok(result.surfaces.includes(surface), `${surface} should be persisted or reported`);
    }
  } finally {
    roots.cleanup();
  }
});

test("R3: forced finalize-cleanup removal passes --force to git worktree remove for dirty worktrees", () => {
  assert.equal(typeof cleanup.removeWorktreeForCleanup, "function");

  for (const scenario of ["dirty-root", "dirty-submodule"]) {
    const calls = [];
    const runGit = (args) => {
      calls.push(args);
      if (args.includes("remove") && !args.includes("--force")) {
        return {
          ok: false,
          stdout: "",
          stderr: scenario === "dirty-submodule"
            ? "fatal: working trees containing submodules cannot be moved or removed"
            : "fatal: worktree contains untracked files",
        };
      }
      return { ok: true, stdout: "", stderr: "" };
    };

    const result = cleanup.removeWorktreeForCleanup({
      mainRepoPath: "/repo/main",
      worktreePath: "/repo/wt",
      featureBranch: "feature/304",
      force: true,
      runGit,
    });

    assert.equal(result.ok, true, scenario);
    assert.ok(
      calls.some((args) => args.includes("worktree") && args.includes("remove") && args.includes("--force")),
      scenario,
    );
  }
});

test("R3: forced submodule cleanup does not downgrade to the non-force dirty halt", () => {
  const calls = [];
  const runGit = (args) => {
    calls.push(args);
    if (args.includes("worktree") && args.includes("remove") && args.includes("--force")) {
      return {
        ok: false,
        stdout: "",
        stderr: "fatal: working trees containing submodules cannot be moved or removed",
      };
    }
    if (args.includes("status") && args.includes("--porcelain")) {
      return { ok: true, stdout: " M nested/file.txt\n", stderr: "" };
    }
    if (args.includes("submodule") && args.includes("status")) {
      return { ok: true, stdout: " abcdef1234567890 nested (heads/main)\n", stderr: "" };
    }
    return { ok: true, stdout: "", stderr: "" };
  };

  const result = cleanup.removeWorktreeForCleanup({
    mainRepoPath: "/repo/main",
    worktreePath: "/repo/wt",
    featureBranch: "feature/304",
    force: true,
    runGit,
  });

  assert.equal(result.ok, false);
  assert.equal(result.env.errors[0].code, "SUBMODULE_WORKTREE_FORCE_REMOVE_FAILED");
  assert.equal(calls.some((args) => args.includes("submodule") && args.includes("status")), false);
});

test("R3: CLI finalize-cleanup --force forwards force semantics to worktree removal", () => {
  const roots = makeRoots();
  try {
    const cliWorktreeRoot = path.join(roots.mainRoot, ".senti", "worktree", "feature-304-finalize-cleanup-readonly");
    fs.mkdirSync(cliWorktreeRoot, { recursive: true });
    fs.writeFileSync(path.join(cliWorktreeRoot, ".git"), `gitdir: ${path.join(roots.mainRoot, ".git", "worktrees", "wt")}\n`);
    fs.mkdirSync(path.join(cliWorktreeRoot, ".senti"), { recursive: true });
    fs.writeFileSync(path.join(cliWorktreeRoot, ".senti", "config.json"), JSON.stringify({
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      flow: { merge: "squash" },
    }, null, 2));

    const state = {
      spec: `specs/${SPEC_ID}/spec.json`,
      worktree: true,
      baseBranch: "main",
      featureBranch: "feature/304-finalize-cleanup-readonly",
      runId: "fixture-run",
      steps: buildInitialSteps(),
      tasks: [],
      currentTaskId: null,
      requirements: [],
      metrics: [],
      notes: [],
      plugins: { flowCommandHooks: [] },
      state: { mergeStrategy: null, featureBranchSquashedSha: null },
    };
    const worktreeFm = new FlowManager({
      root: cliWorktreeRoot,
      mainRoot: roots.mainRoot,
      inWorktree: true,
      specId: SPEC_ID,
    });
    worktreeFm.create(state);
    worktreeFm.addActiveFlow(SPEC_ID, "worktree");
    writeFlowState(roots.mainRoot, state);

    const binDir = path.join(roots.tmp, "bin");
    const logPath = path.join(roots.tmp, "git.log");
    writeFakeGit(binDir, { worktreeRoot: cliWorktreeRoot, mainRoot: roots.mainRoot, logPath });

    const res = spawnSync(process.execPath, [
      path.resolve("src/senti.js"),
      "flow",
      "run",
      "finalize-cleanup",
      "--force",
    ], {
      cwd: cliWorktreeRoot,
      env: {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
        SENTI_WORK_ROOT: cliWorktreeRoot,
        SENTI_SOURCE_ROOT: path.resolve("."),
      },
      encoding: "utf8",
    });

    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    const calls = fs.readFileSync(logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.ok(calls.some((args) => (
      args.includes("worktree")
      && args.includes("remove")
      && args.includes("--force")
      && args.includes(cliWorktreeRoot)
    )), JSON.stringify(calls, null, 2));
    const runtimeSidecar = path.join(
      roots.mainRoot,
      ".senti",
      "agent-work",
      "finalize-cleanup",
      SPEC_ID,
      "runtime-log.json",
    );
    assert.equal(fs.existsSync(runtimeSidecar), true);
    const runtimePayload = JSON.parse(readText(runtimeSidecar));
    assert.equal(runtimePayload.version, 1);
    assert.equal(runtimePayload.runtimeLog.runId, "fixture-run");
    assert.equal(fs.existsSync(path.join(roots.mainRoot, ".tmp", "logs", `${SPEC_ID}.log`)), true);
  } finally {
    roots.cleanup();
  }
});

test("R4: regression hooks cover read-only cleanup and force-removal scenarios", () => {
  const roots = makeRoots();
  try {
    const resolver = makeActiveResolver(roots.worktreeRoot, roots.mainRoot);
    assert.equal(typeof resolver.cleanupWritePath, "function");
    assert.equal(typeof resolver.cleanupSurfaceOwner, "function");
    assert.equal(typeof cleanup.removeWorktreeForCleanup, "function");
    assert.equal(typeof cleanup.deleteFeatureBranchForCleanup, "function");

    const targetFlowJson = path.join(roots.worktreeRoot, "specs", "304-finalize-cleanup-readonly", "flow.json");
    const relocatedMetricsWrite = resolver.cleanupWritePath(targetFlowJson, {
      specId: "304-finalize-cleanup-readonly",
      surface: "agent-metrics",
    });
    assertOutsideWorktree(roots.worktreeRoot, relocatedMetricsWrite);

    const normalRemove = makeGitRecorder();
    const removeResult = cleanup.removeWorktreeForCleanup({
      mainRepoPath: roots.mainRoot,
      worktreePath: roots.worktreeRoot,
      featureBranch: "feature/304-finalize-cleanup-readonly",
      force: false,
      runGit: normalRemove.runGit,
    });
    assert.equal(removeResult.ok, true);
    assert.deepEqual(normalRemove.calls[0], [
      "-C",
      roots.mainRoot,
      "worktree",
      "remove",
      roots.worktreeRoot,
    ]);

    const branchDelete = makeGitRecorder();
    const deleteResult = cleanup.deleteFeatureBranchForCleanup({
      mainRepoPath: roots.mainRoot,
      featureBranch: "feature/304-finalize-cleanup-readonly",
      runGit: branchDelete.runGit,
    });
    assert.equal(deleteResult.ok, true);
    assert.deepEqual(branchDelete.calls[0], [
      "-C",
      roots.mainRoot,
      "branch",
      "-D",
      "feature/304-finalize-cleanup-readonly",
    ]);
  } finally {
    roots.cleanup();
  }
});

test("R5: report and plugin hook outputs remain observable through durable cleanup owners", () => {
  const roots = makeRoots();
  try {
    writeFlowState(roots.worktreeRoot);
    writeFlowState(roots.mainRoot);
    const resolver = makeActiveResolver(roots.worktreeRoot, roots.mainRoot);
    assert.equal(typeof resolver.cleanupSurfaceOwner, "function");

    const reportOwner = resolver.cleanupSurfaceOwner("report-envelope", { specId: "304-finalize-cleanup-readonly" });
    const pluginOwner = resolver.cleanupSurfaceOwner("plugin-hook-output", { specId: "304-finalize-cleanup-readonly" });

    assert.equal(reportOwner.observable, true);
    assert.equal(pluginOwner.observable, true);
    assertOutsideWorktree(roots.worktreeRoot, reportOwner.path);
    assertOutsideWorktree(roots.worktreeRoot, pluginOwner.path);

    assert.equal(typeof cleanup.recordFinalizeCleanupPostCommandMetadata, "function");
    const result = cleanup.recordFinalizeCleanupPostCommandMetadata({
      flowManager: new FlowManager({
        root: roots.worktreeRoot,
        mainRoot: roots.mainRoot,
        inWorktree: true,
        specId: SPEC_ID,
      }),
      specId: SPEC_ID,
      report: {
        text: "Finalize Report\nwarning: REPORT_MISSING\n",
        path: `specs/${SPEC_ID}/report.json`,
        warnings: [{ code: "REPORT_MISSING", message: "report was unavailable" }],
      },
      pluginArtifacts: [
        {
          relPath: `specs/${SPEC_ID}/plugin-artifacts/workflow/finalize-cleanup.json`,
          data: {
            warnings: [{ code: "PLUGIN_HOOK_WARNING", message: "hook warning" }],
            followUps: ["inspect durable cleanup artifact"],
          },
        },
      ],
      recoveryEnvelope: {
        code: "WORKTREE_REMOVE_FAILED",
        recoveryOptions: ["retry-with-force"],
        messages: ["target worktree contains dirty external files"],
      },
    });

    assert.ok(result.callerVisible.report.warnings.some((w) => w.code === "REPORT_MISSING"));
    assert.ok(result.callerVisible.plugin.followUps.includes("inspect durable cleanup artifact"));
    assert.equal(result.callerVisible.recoveryEnvelope.code, "WORKTREE_REMOVE_FAILED");
    for (const writtenPath of result.writtenPaths) {
      assertOutsideWorktree(roots.worktreeRoot, writtenPath);
    }
  } finally {
    roots.cleanup();
  }
});

test("R6: post-command runtime and metric metadata use sidecar storage instead of final flow.json", () => {
  const roots = makeRoots();
  try {
    writeFlowState(roots.mainRoot);
    writeFlowState(roots.worktreeRoot);
    const resolver = makeActiveResolver(roots.worktreeRoot, roots.mainRoot);
    assert.equal(typeof resolver.postCommandMetadataPath, "function");

    const flowJson = path.join(roots.mainRoot, "specs", "304-finalize-cleanup-readonly", "flow.json");
    const metricPath = resolver.postCommandMetadataPath("agent-metrics.json", {
      specId: "304-finalize-cleanup-readonly",
    });
    const runtimePath = resolver.postCommandMetadataPath("runtime-log.json", {
      specId: "304-finalize-cleanup-readonly",
    });

    assert.notEqual(path.resolve(metricPath), path.resolve(flowJson));
    assert.notEqual(path.resolve(runtimePath), path.resolve(flowJson));
    assertOutsideWorktree(roots.worktreeRoot, metricPath);
    assertOutsideWorktree(roots.worktreeRoot, runtimePath);

    const before = readText(flowJson);
    assert.equal(typeof cleanup.recordFinalizeCleanupPostCommandMetadata, "function");
    const result = cleanup.recordFinalizeCleanupPostCommandMetadata({
      flowManager: new FlowManager({
        root: roots.worktreeRoot,
        mainRoot: roots.mainRoot,
        inWorktree: true,
        specId: SPEC_ID,
      }),
      specId: SPEC_ID,
      metrics: [{ phase: "finalize", counter: "agent", delta: 1 }],
      runtimeLog: { runId: "r6", sequence: 6, exitCode: 0 },
    });

    assert.equal(readText(flowJson), before);
    assert.ok(result.writtenPaths.some((p) => path.basename(p) === "agent-metrics.json"));
    assert.ok(result.writtenPaths.some((p) => path.basename(p) === "runtime-log.json"));

    cleanup.recordFinalizeCleanupPostCommandMetadata({
      flowManager: new FlowManager({
        root: roots.worktreeRoot,
        mainRoot: roots.mainRoot,
        inWorktree: true,
        specId: SPEC_ID,
      }),
      specId: SPEC_ID,
      metrics: [{ phase: "finalize-cleanup", counter: "agent", delta: 1 }],
    });
    const metricPayload = JSON.parse(readText(metricPath));
    assert.equal(metricPayload.entries.length, 2);
  } finally {
    roots.cleanup();
  }
});
