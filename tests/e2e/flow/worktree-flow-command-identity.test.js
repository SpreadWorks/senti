import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cliPath = path.join(repoRoot, "src/senti.js");
const fixtureRoot = path.join(repoRoot, ".tmp", "issue-440-command-identity");
const bindingFile = path.join(".senti", "flow-identity.json");
const roots = [];

function git(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createProject() {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(fixtureRoot, "project-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senti", "config.json"), JSON.stringify({
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
  }, null, 2));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    name: "worktree-command-fixture",
    version: "0.0.0",
    type: "module",
  }, null, 2));
  fs.writeFileSync(path.join(root, ".gitignore"), ".senti/*\n!.senti/config.json\n");
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test User"]);
  git(root, ["add", ".senti/config.json", ".gitignore", "package.json"]);
  git(root, ["commit", "-m", "fixture"]);
  return root;
}

function runFlow(root, args) {
  const result = spawnSync("node", [cliPath, "flow", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
  const stdout = result.stdout.trim();
  return { ...result, envelope: stdout.startsWith("{") ? JSON.parse(stdout) : null };
}

function expectSuccess(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.envelope?.ok, true, result.stderr || result.stdout);
  return result.envelope.data;
}

function prepareWorktree(root, { issue, title }) {
  const initArgs = ["set", "init", "--request", issue == null ? "fix issue-less flow" : `fix Issue #${issue}`];
  if (issue != null) initArgs.push("--issue", String(issue));
  const init = expectSuccess(runFlow(root, initArgs));
  const prepared = expectSuccess(runFlow(root, [
    "prepare", "--title", title, "--base", "main", "--worktree", "--run-id", init.runId,
  ]));
  return {
    ...prepared,
    root,
    issue,
    specId: prepared.spec.split("/")[1],
  };
}

function targetArgs(flow) {
  return [
    "--expect-run-id", flow.runId,
    ...(flow.issue == null ? ["--expect-no-issue"] : ["--expect-issue", String(flow.issue)]),
    "--expect-spec", flow.spec,
  ];
}

function readFlowState(flow) {
  return JSON.parse(fs.readFileSync(path.join(flow.worktreePath, "specs", flow.specId, "flow.json"), "utf8"));
}

function snapshotTarget(flow) {
  const mainHead = path.resolve(flow.root, git(flow.root, ["rev-parse", "--git-path", "HEAD"]));
  const worktreeHead = path.resolve(flow.worktreePath, git(flow.worktreePath, ["rev-parse", "--git-path", "HEAD"]));
  const files = [
    path.join(flow.root, ".senti", ".active-flow"),
    path.join(flow.root, ".senti", ".current-flow"),
    mainHead,
    worktreeHead,
    path.join(flow.worktreePath, bindingFile),
    path.join(flow.worktreePath, "specs", flow.specId, "flow.json"),
    path.join(flow.worktreePath, "specs", flow.specId, "spec.json"),
  ];
  return Object.fromEntries(files.map((file) => [
    file,
    fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null,
  ]));
}

function snapshotPendingTransition(flow) {
  const markerPath = path.join(
    flow.worktreePath,
    ".senti",
    "flow-identity.issue-transaction.json",
  );
  const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  const files = [
    markerPath,
    path.join(flow.worktreePath, bindingFile),
    path.join(flow.worktreePath, "specs", flow.specId, "flow.json"),
    path.join(flow.worktreePath, "specs", flow.specId, ".flow.json.writer.lock"),
    path.join(flow.worktreePath, "specs", flow.specId, marker.writerOwnerTempName),
  ];
  return Object.fromEntries(files.map((file) => [
    file,
    fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null,
  ]));
}

function interruptIssueTransition(flow) {
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
  return spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    script,
    flow.worktreePath,
    flow.root,
    flow.specId,
  ]);
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("worktree command identity", () => {
  it("uses the binding for the first guarded mutation with Issue or explicit no-Issue", () => {
    for (const issue of [440, null]) {
      const root = createProject();
      const flow = prepareWorktree(root, { issue, title: `first-command-${issue ?? "no-issue"}` });
      fs.rmSync(path.join(root, ".senti", ".active-flow"));
      fs.writeFileSync(path.join(root, ".senti", ".current-flow"), "999-unrelated\n");

      expectSuccess(runFlow(flow.worktreePath, [
        "set", "request", "first command succeeded", "--run-id", flow.runId, ...targetArgs(flow),
      ]));
      assert.equal(readFlowState(flow).request, "first command succeeded");

      const status = expectSuccess(runFlow(flow.worktreePath, [
        "get", "status", flow.runId, ...targetArgs(flow),
      ]));
      assert.deepEqual(
        { runId: status.runId, issue: status.issue ?? null, spec: status.spec },
        { runId: flow.runId, issue, spec: flow.spec },
      );
    }
  });

  it("returns ACTIVE_FLOW_MISMATCH before persistent mutation for every identity mismatch", () => {
    for (const issue of [440, null]) {
      const root = createProject();
      const flow = prepareWorktree(root, { issue, title: `mismatch-${issue ?? "no-issue"}` });
      fs.writeFileSync(path.join(root, ".senti", ".current-flow"), "999-unrelated\n");
      const cases = issue == null ? [
        ["--expect-run-id", "wrong-run", "--expect-no-issue", "--expect-spec", flow.spec],
        ["--expect-run-id", flow.runId, "--expect-issue", "440", "--expect-spec", flow.spec],
        ["--expect-run-id", flow.runId, "--expect-no-issue", "--expect-spec", "specs/999-wrong/spec.json"],
      ] : [
        ["--expect-run-id", "wrong-run", "--expect-issue", "440", "--expect-spec", flow.spec],
        ["--expect-run-id", flow.runId, "--expect-issue", "999", "--expect-spec", flow.spec],
        ["--expect-run-id", flow.runId, "--expect-no-issue", "--expect-spec", flow.spec],
        ["--expect-run-id", flow.runId, "--expect-issue", "440", "--expect-spec", "specs/999-wrong/spec.json"],
        ["--expect-run-id", "wrong-run", "--expect-issue", "999", "--expect-spec", "specs/999-wrong/spec.json"],
      ];

      for (const args of cases) {
        const before = snapshotTarget(flow);
        const result = runFlow(flow.worktreePath, [
          "set", "request", "must not be written", "--run-id", flow.runId, ...args,
        ]);
        assert.notEqual(result.status, 0);
        assert.equal(result.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
        assert.deepEqual(snapshotTarget(flow), before);
      }

      const runtimeMismatch = runFlow(flow.worktreePath, [
        "get", "runtime-log",
        "--expect-run-id", "wrong-runtime-run",
        ...(issue == null ? ["--expect-no-issue"] : ["--expect-issue", String(issue)]),
        "--expect-spec", flow.spec,
        "--format", "json",
      ]);
      assert.notEqual(runtimeMismatch.status, 0);
      assert.equal(runtimeMismatch.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
      assert.equal(runtimeMismatch.envelope?.data?.activeRunId, flow.runId);
    }
  });

  it("propagates required-command identity mismatch before the NO_FLOW precondition", () => {
    const root = createProject();
    const flow = prepareWorktree(root, { issue: 440, title: "required-mismatch-order" });
    const mismatchedTarget = [
      "--expect-run-id", "wrong-required-run",
      "--expect-issue", "999",
      "--expect-spec", "specs/999-wrong/spec.json",
    ];

    for (const command of [
      ["set", "issue", "441"],
      ["set", "step", "draft", "done"],
    ]) {
      const before = snapshotTarget(flow);
      const result = runFlow(flow.worktreePath, [...command, ...mismatchedTarget]);

      assert.notEqual(result.status, 0);
      assert.equal(result.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
      const expectedIdentity = {
        expectedIssue: 999,
        activeIssue: 440,
        expectedSpec: "999-wrong",
        activeSpec: flow.specId,
        expectedRunId: "wrong-required-run",
        activeRunId: flow.runId,
      };
      assert.deepEqual(
        Object.fromEntries(
          Object.keys(expectedIdentity).map((key) => [key, result.envelope?.data?.[key]]),
        ),
        expectedIdentity,
      );
      assert.equal(result.envelope?.data?.runtimeLog?.runId, "no-flow");
      assert.deepEqual(snapshotTarget(flow), before);
    }
  });

  it("rejects a mismatched guard before reconciling a pending Issue transition", () => {
    const root = createProject();
    const flow = prepareWorktree(root, { issue: null, title: "pending-guard-order" });
    assert.equal(interruptIssueTransition(flow).signal, "SIGKILL");
    const before = snapshotPendingTransition(flow);

    const result = runFlow(flow.worktreePath, [
      "set", "request", "must not reconcile",
      "--run-id", flow.runId,
      "--expect-run-id", "wrong-run",
      "--expect-issue", "999",
      "--expect-spec", "specs/999-wrong/spec.json",
    ]);

    assert.notEqual(result.status, 0);
    assert.equal(result.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.deepEqual(snapshotPendingTransition(flow), before);
  });

  it("isolates concurrent worktrees from main registry and current-flow selection", () => {
    const root = createProject();
    const first = prepareWorktree(root, { issue: 440, title: "isolated-first" });
    const second = prepareWorktree(root, { issue: null, title: "isolated-second" });
    const registryPath = path.join(root, ".senti", ".active-flow");
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    fs.writeFileSync(registryPath, JSON.stringify(registry.reverse(), null, 2));

    for (const [variant, current] of [
      ["unset", null],
      ["matching", first.specId],
      ["other", second.specId],
    ]) {
      const currentPath = path.join(root, ".senti", ".current-flow");
      if (current == null) fs.rmSync(currentPath, { force: true });
      else fs.writeFileSync(currentPath, `${current}\n`);
      expectSuccess(runFlow(first.worktreePath, [
        "set", "request", `first-${variant}`, "--run-id", first.runId, ...targetArgs(first),
      ]));
      expectSuccess(runFlow(second.worktreePath, [
        "set", "request", `second-${variant}`, "--run-id", second.runId, ...targetArgs(second),
      ]));
    }

    assert.equal(readFlowState(first).request, "first-other");
    assert.equal(readFlowState(second).request, "second-other");
    const swapped = runFlow(first.worktreePath, ["get", "status", second.runId, ...targetArgs(second)]);
    assert.notEqual(swapped.status, 0);
    assert.equal(swapped.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
  });

  it("selects no-Issue flow uniquely and propagates structured zero/multiple errors", () => {
    for (const [name, issues, expectedMatchCount] of [
      ["unique", [440, null], 1],
      ["missing", [440, 441], 0],
      ["ambiguous", [null, null], 2],
    ]) {
      const root = createProject();
      const flows = issues.map((issue, index) => prepareWorktree(root, {
        issue,
        title: `no-issue-${name}-${index}`,
      }));
      fs.rmSync(path.join(root, ".senti", ".current-flow"), { force: true });

      const result = runFlow(root, ["get", "status", "--expect-no-issue"]);
      if (expectedMatchCount === 1) {
        const status = expectSuccess(result);
        assert.equal(status.runId, flows[1].runId);
        assert.equal(status.issue ?? null, null);
      } else {
        assert.notEqual(result.status, 0);
        assert.equal(
          result.envelope?.errors?.[0]?.code,
          expectedMatchCount === 0 ? "FLOW_TARGET_NOT_FOUND" : "FLOW_TARGET_AMBIGUOUS",
        );
        assert.equal(result.envelope?.data?.matchCount, expectedMatchCount);
        assert.equal(result.envelope?.data?.expectedIssue, null);
      }
    }
  });

  it("preserves bound identity across process restart and resume", () => {
    const root = createProject();
    const flow = prepareWorktree(root, { issue: null, title: "resume-bound" });
    const restarted = expectSuccess(runFlow(flow.worktreePath, [
      "get", "status", flow.runId, ...targetArgs(flow),
    ]));
    assert.deepEqual(
      { runId: restarted.runId, issue: restarted.issue ?? null, spec: restarted.spec },
      { runId: flow.runId, issue: null, spec: flow.spec },
    );

    const resumed = expectSuccess(runFlow(root, ["resume", "--spec", flow.specId]));
    assert.equal(resumed.runId, flow.runId);
    assert.equal(fs.realpathSync(resumed.worktreePath), fs.realpathSync(flow.worktreePath));
    assert.equal(resumed.recoveryCandidates, undefined);
  });

  it("selects one registered active flow by spec", () => {
    const root = createProject();
    const first = prepareWorktree(root, { issue: 440, title: "resume-first" });
    const second = prepareWorktree(root, { issue: 441, title: "resume-second" });

    const ambiguous = runFlow(root, ["resume"]);
    assert.notEqual(ambiguous.status, 0);
    assert.match(ambiguous.envelope?.errors?.[0]?.messages?.[0], /multiple active flows/);

    for (const flow of [first, second]) {
      const resumed = expectSuccess(runFlow(root, ["resume", "--spec", flow.specId]));
      assert.equal(resumed.activeFlow, flow.specId);
      assert.equal(resumed.runId, flow.runId);
      assert.equal(fs.realpathSync(resumed.worktreePath), fs.realpathSync(flow.worktreePath));
    }
  });

  it("does not resume an unregistered worktree flow", () => {
    const root = createProject();
    const flow = prepareWorktree(root, { issue: 440, title: "resume-active-only" });
    fs.rmSync(path.join(root, ".senti", ".active-flow"));

    const resumed = runFlow(root, ["resume", "--spec", flow.specId]);

    assert.notEqual(resumed.status, 0);
    assert.equal(resumed.envelope?.errors?.[0]?.code, "FLOW_TARGET_NOT_FOUND");
    assert.equal(resumed.envelope?.data?.expectedSpec, flow.specId);
  });

  it("validates positional and expected status run IDs independently", () => {
    const root = createProject();
    const flow = prepareWorktree(root, { issue: 440, title: "status-double-run-id" });

    for (const args of [
      ["wrong-positional", "--expect-run-id", flow.runId],
      [flow.runId, "--expect-run-id", "wrong-expectation"],
    ]) {
      const result = runFlow(flow.worktreePath, ["get", "status", ...args]);
      assert.notEqual(result.status, 0);
      assert.equal(result.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
      assert.equal(result.envelope?.data?.activeRunId, flow.runId);
    }
  });

  it("updates flow and binding identity together for set issue across restart", () => {
    const root = createProject();
    const flow = prepareWorktree(root, { issue: null, title: "set-issue-bound" });
    const updated = expectSuccess(runFlow(flow.worktreePath, [
      "set", "issue", "440", ...targetArgs(flow),
    ]));
    assert.equal(updated.issue, 440);
    assert.equal(readFlowState(flow).issue, 440);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(flow.worktreePath, bindingFile), "utf8")).issue,
      440,
    );

    const restarted = expectSuccess(runFlow(flow.worktreePath, [
      "get", "status", flow.runId,
      "--expect-run-id", flow.runId,
      "--expect-issue", "440",
      "--expect-spec", flow.spec,
    ]));
    assert.equal(restarted.issue, 440);
  });

  it("retains binding provenance after main becomes state authority", () => {
    const root = createProject();
    const bound = prepareWorktree(root, { issue: null, title: "post-merge-bound" });
    const other = prepareWorktree(root, { issue: 441, title: "post-merge-other" });
    const mainSpecDirectory = path.join(root, "specs", bound.specId);
    fs.mkdirSync(mainSpecDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(mainSpecDirectory, "flow.json"),
      `${JSON.stringify(readFlowState(bound), null, 2)}\n`,
    );

    const redirected = runFlow(bound.worktreePath, [
      "get", "status", other.runId, ...targetArgs(other),
    ]);
    assert.notEqual(redirected.status, 0);
    assert.equal(redirected.envelope?.errors?.[0]?.code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(redirected.envelope?.data?.activeRunId, bound.runId);

    const mainFlowPath = path.join(mainSpecDirectory, "flow.json");
    const bindingPath = path.join(bound.worktreePath, bindingFile);
    const before = {
      mainFlow: fs.readFileSync(mainFlowPath),
      binding: fs.readFileSync(bindingPath),
    };
    const rejected = runFlow(bound.worktreePath, [
      "set", "issue", "440", ...targetArgs(bound),
    ]);
    assert.notEqual(rejected.status, 0);
    assert.equal(
      rejected.envelope?.errors?.[0]?.code,
      "WORKTREE_FLOW_BINDING_AUTHORITY_MISMATCH",
    );
    assert.deepEqual(fs.readFileSync(mainFlowPath), before.mainFlow);
    assert.deepEqual(fs.readFileSync(bindingPath), before.binding);
  });

  it("keeps the modern registry-wide explicit resolver allowlist exact", () => {
    const entries = [];
    const mismatchEntries = [];
    for (const [groupName, group] of Object.entries(FLOW_COMMANDS)) {
      for (const [commandName, entry] of Object.entries(group)) {
        if (entry.explicitTargetResolution === true) entries.push(`${groupName}.${commandName}`);
        if (entry.mismatchTargetResolution === true) mismatchEntries.push(`${groupName}.${commandName}`);
      }
    }
    assert.deepEqual(entries, [
      "get.runtime-log",
      "set.step",
      "set.issue-log",
      "run.finalize-cleanup",
      "run.start-task",
      "run.complete-task",
    ]);
    assert.deepEqual(mismatchEntries, ["get.runtime-log"]);
  });

  it("retains main/bare reads and branch-only/no-branch prepare behavior", () => {
    const root = createProject();
    const flow = prepareWorktree(root, { issue: 440, title: "retained-commands" });
    for (const result of [
      expectSuccess(runFlow(root, ["get", "status", flow.runId, ...targetArgs(flow)])),
      expectSuccess(runFlow(root, ["get", "status"])),
      expectSuccess(runFlow(flow.worktreePath, ["get", "status"])),
    ]) {
      assert.deepEqual(
        { runId: result.runId, issue: result.issue, spec: result.spec },
        { runId: flow.runId, issue: 440, spec: flow.spec },
      );
    }

    const branchRoot = createProject();
    const branchInit = expectSuccess(runFlow(branchRoot, [
      "set", "init", "--issue", "440", "--request", "branch fixture",
    ]));
    const branch = expectSuccess(runFlow(branchRoot, [
      "prepare", "--title", "branch-retained", "--base", "main", "--run-id", branchInit.runId,
    ]));
    assert.equal(branch.artifacts.mode, "branch");
    assert.equal(git(branchRoot, ["branch", "--show-current"]), branch.artifacts.branch);

    const localRoot = createProject();
    const localInit = expectSuccess(runFlow(localRoot, [
      "set", "init", "--issue", "441", "--request", "local fixture",
    ]));
    const local = expectSuccess(runFlow(localRoot, [
      "prepare", "--title", "local-retained", "--base", "main", "--no-branch", "--run-id", localInit.runId,
    ]));
    assert.equal(local.artifacts.mode, "spec-only");
    assert.equal(git(localRoot, ["branch", "--show-current"]), "main");
  });
});
