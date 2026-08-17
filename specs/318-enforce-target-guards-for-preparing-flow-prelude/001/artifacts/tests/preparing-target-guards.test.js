// spec: R1 R2 R3 R4 R5 R6
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Container } from "../../../src/lib/container.js";
import { Command } from "../../../src/lib/command.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { FlowCommand } from "../../../src/flow/lib/base-command.js";
import { resolveFlowContext } from "../../../src/flow/lib/flow-context.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../../tests/helpers/git-repo.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { writeCapturingStubAgentScript, stubAgentConfig } from "../../../tests/helpers/stub-agent.js";

const CMD = path.join(process.cwd(), "src/senti.js");
const GUARD_OPTIONS = ["--expect-run-id", "--expect-issue", "--expect-spec"];

function preparingContainer({ preparingState = null, activeState = null } = {}) {
  const calls = { preparingLoads: [], load: 0, resolveActiveFlow: 0 };
  const flowManager = {
    loadPreparingFlow(runId) {
      calls.preparingLoads.push(runId);
      return preparingState?.runId === runId ? preparingState : null;
    },
    forRoot() {
      return flowManager;
    },
    load() {
      calls.load += 1;
      return activeState;
    },
    resolveActiveFlow() {
      calls.resolveActiveFlow += 1;
      return activeState
        ? { state: activeState, specId: "999-unrelated", worktreePath: null }
        : null;
    },
  };
  const container = new Container();
  container.register("paths", { root: "/repo" });
  container.register("mainRoot", "/repo");
  container.register("config", {});
  container.register("flowManager", flowManager);
  container.register("inWorktree", false);
  return { container, calls };
}

function errorCode(result) {
  return result.errors?.[0]?.code;
}

function runCli(root, args) {
  return spawnSync("node", [CMD, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
}

function runGit(root, args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

function parseCli(result) {
  assert.notEqual(result.stdout.trim(), "", result.stderr);
  return JSON.parse(result.stdout.trim());
}

function setupCliProject({ withAgent = false } = {}) {
  const root = createTmpDir("spec-318-prelude-guards-");
  let capturePath = null;
  const config = {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  };
  if (withAgent) {
    capturePath = path.join(root, "agent-invoked.log");
    const response = JSON.stringify({
      specBuildability: 2,
      ambiguity: 2,
      verifiability: 2,
      scopeBoundedness: 2,
      targetSpecificity: 2,
      precedent: 2,
      goal: "guard prelude target",
      reason: "stub pass",
    });
    const script = writeCapturingStubAgentScript(root, ".stub-agent.cjs", capturePath, response);
    config.agent = stubAgentConfig(script);
  }
  writeJson(root, ".senti/config.json", config);
  writeJson(root, "package.json", { name: "fixture", version: "0.0.0" });
  initGitRepo(root);
  commitAll(root, "initial");
  return { root, capturePath };
}

function initPreparingRun(root, issue = 431) {
  const result = runCli(root, [
    "flow", "set", "init",
    "--issue", String(issue),
    "--request", "guard preparing target with bounded scope",
  ]);
  assert.equal(result.status, 0, result.stderr);
  return parseCli(result).data.runId;
}

function assertActiveMismatch(result) {
  assert.notEqual(result.status, 0, result.stdout);
  assert.equal(parseCli(result).errors[0].code, "ACTIVE_FLOW_MISMATCH");
}

describe("preparing-flow target guards", () => {
  it("R1: exposes known and missing preparing selections without active-flow fallback", () => {
    const state = { runId: "run-431", issue: 431, spec: null };
    const known = preparingContainer({ preparingState: state });
    const knownCtx = resolveFlowContext(known.container, { input: { runId: "run-431" } });

    assert.equal(knownCtx.flowState, null);
    assert.equal(knownCtx.preparingFlowState, state);
    assert.deepEqual(known.calls.preparingLoads, ["run-431"]);
    assert.equal(known.calls.load, 0);
    assert.equal(known.calls.resolveActiveFlow, 0);

    const unrelated = { runId: "run-999", issue: 999, spec: "specs/999-unrelated/spec.json" };
    const missing = preparingContainer({ activeState: unrelated });
    const missingCtx = resolveFlowContext(missing.container, { input: { runId: "missing-run" } });

    assert.equal(missingCtx.flowState, null);
    assert.deepEqual(missingCtx.preparingFlowState, {});
    assert.deepEqual(missing.calls.preparingLoads, ["missing-run"]);
    assert.equal(missing.calls.load, 0);
    assert.equal(missing.calls.resolveActiveFlow, 0);
  });

  it("R2: FlowCommand validates every expectation against the selected preparing state", async () => {
    const state = { runId: "run-431", issue: 431, spec: null };
    const mismatches = [
      { expectRunId: "wrong-run" },
      { expectRunId: "run-431", expectIssue: 999 },
      { expectRunId: "run-431", expectIssue: 431, expectSpec: "specs/431-demo/spec.json" },
    ];

    for (const expected of mismatches) {
      const { container } = preparingContainer({ preparingState: state });
      let executed = false;
      class PreparingCommand extends FlowCommand {
        constructor() {
          super({ requiresFlow: false });
        }

        execute() {
          executed = true;
          return { executed: true };
        }
      }

      const result = await new PreparingCommand().run(container, {
        runId: "run-431",
        ...expected,
        _envelopeType: "set",
        _envelopeKey: "request",
      });
      assert.equal(result.ok, false);
      assert.equal(errorCode(result), "ACTIVE_FLOW_MISMATCH");
      assert.equal(executed, false);
    }
  });

  it("R3: request, note, and auto enforce preparing guards before mutation", async () => {
    const { root } = setupCliProject();
    try {
      const runId = initPreparingRun(root);
      const matching = ["--expect-run-id", runId, "--expect-issue", "431"];

      const request = runCli(root, ["flow", "set", "request", "updated request", "--run-id", runId, ...matching]);
      assert.equal(request.status, 0, request.stderr);
      const note = runCli(root, ["flow", "set", "note", "guarded note", "--run-id", runId, ...matching]);
      assert.equal(note.status, 0, note.stderr);
      const auto = runCli(root, ["flow", "set", "auto", "off", "--run-id", runId, ...matching]);
      assert.equal(auto.status, 0, auto.stderr);

      const guardFreeRequest = runCli(root, ["flow", "set", "request", "guard-free request", "--run-id", runId]);
      assert.equal(guardFreeRequest.status, 0, guardFreeRequest.stderr);
      const guardFreeNote = runCli(root, ["flow", "set", "note", "guard-free note", "--run-id", runId]);
      assert.equal(guardFreeNote.status, 0, guardFreeNote.stderr);
      const guardFreeAuto = runCli(root, ["flow", "set", "auto", "off", "--run-id", runId]);
      assert.equal(guardFreeAuto.status, 0, guardFreeAuto.stderr);
      const guardFreeState = makeFlowManager(root).loadPreparingFlow(runId);
      assert.equal(guardFreeState.request, "guard-free request");
      assert.ok(guardFreeState.notes.some((entry) => entry.text === "guard-free note"));
      assert.equal(guardFreeState.autoApprove, false);

      const setCommands = [
        ["request", ["blocked request"]],
        ["note", ["blocked note"]],
        ["auto", ["off"]],
      ];
      const mismatchMatrix = [
        ["--expect-run-id", "wrong-run"],
        ["--expect-run-id", runId, "--expect-issue", "999"],
        ["--expect-run-id", runId, "--expect-issue", "431", "--expect-spec", "specs/not-prepared/spec.json"],
      ];
      for (const [command, positional] of setCommands) {
        for (const mismatch of mismatchMatrix) {
          if (command === "auto") {
            makeFlowManager(root).mutatePreparingFlow(runId, (state) => {
              state.autoApprove = true;
              state.autoDesired = true;
            });
          }
          const beforeMismatch = makeFlowManager(root).loadPreparingFlow(runId);
          assertActiveMismatch(runCli(root, [
            "flow", "set", command, ...positional, "--run-id", runId, ...mismatch,
          ]));
          assert.deepEqual(makeFlowManager(root).loadPreparingFlow(runId), beforeMismatch);
        }
      }

      for (const [command, args] of [
        ["request", ["unchanged", "--run-id", "missing-run"]],
        ["note", ["unchanged", "--run-id", "missing-run"]],
        ["auto", ["off", "--run-id", "missing-run"]],
      ]) {
        const result = runCli(root, ["flow", "set", command, ...args]);
        assert.notEqual(result.status, 0);
        assert.equal(parseCli(result).errors[0].code, "PREPARING_FLOW_NOT_FOUND");
      }
      for (const [command, positional] of setCommands) {
        assertActiveMismatch(runCli(root, [
          "flow", "set", command, ...positional,
          "--run-id", "missing-run", "--expect-run-id", "missing-run",
        ]));
      }

      for (const key of ["request", "note", "auto"]) {
        const entry = FLOW_COMMANDS.set[key];
        assert.equal(entry.requiresFlow, false, `${key} must allow preparing routing`);
        for (const option of GUARD_OPTIONS) assert.ok(entry.args.options.includes(option));
      }
      const NoteCommand = (await FLOW_COMMANDS.set.note.command()).default;
      assert.equal(new NoteCommand().requiresFlow, false);
    } finally {
      removeTmpDir(root);
    }
  });

  it("R4: auto-check and prepare reject guarded mismatches before side effects", () => {
    const { root, capturePath } = setupCliProject({ withAgent: true });
    try {
      const runId = initPreparingRun(root);
      const initialBranches = runGit(root, ["branch", "--format=%(refname)"]).stdout;
      const initialWorktrees = runGit(root, ["worktree", "list", "--porcelain"]).stdout;
      for (const [key, entry] of [
        ["auto-check", FLOW_COMMANDS.run["auto-check"]],
        ["prepare", FLOW_COMMANDS.prepare],
      ]) {
        for (const option of GUARD_OPTIONS) {
          assert.ok(entry.args.options.includes(option), `${key} missing registry ${option}`);
          assert.ok(entry.help.includes(option), `${key} missing help ${option}`);
        }
      }

      const autoMismatch = runCli(root, [
        "flow", "run", "auto-check", "--run-id", runId,
        "--expect-run-id", runId, "--expect-issue", "999",
      ]);
      assertActiveMismatch(autoMismatch);
      assert.equal(fs.existsSync(capturePath), false);
      assert.equal(makeFlowManager(root).loadPreparingFlow(runId).autoCheck, undefined);

      assertActiveMismatch(runCli(root, [
        "flow", "run", "auto-check", "--run-id", "missing-run",
        "--expect-run-id", "missing-run",
      ]));
      assert.equal(fs.existsSync(capturePath), false);
      const guardFreeAuto = runCli(root, ["flow", "run", "auto-check", "--run-id", "missing-run"]);
      assert.notEqual(guardFreeAuto.status, 0);
      assert.equal(parseCli(guardFreeAuto).errors[0].code, "PREPARING_FLOW_NOT_FOUND");

      assertActiveMismatch(runCli(root, [
        "flow", "prepare", "--title", "guard-mismatch", "--worktree", "--run-id", runId,
        "--expect-run-id", runId, "--expect-issue", "999",
      ]));
      assert.equal(fs.existsSync(path.join(root, "specs")), false);
      assert.equal(fs.existsSync(path.join(root, ".senti", "worktree")), false);
      assert.equal(runGit(root, ["branch", "--format=%(refname)"]).stdout, initialBranches);
      assert.equal(runGit(root, ["worktree", "list", "--porcelain"]).stdout, initialWorktrees);

      assertActiveMismatch(runCli(root, [
        "flow", "prepare", "--title", "null-spec-mismatch", "--no-branch", "--run-id", runId,
        "--expect-run-id", runId, "--expect-issue", "431", "--expect-spec", "specs/not-prepared/spec.json",
      ]));
      assert.equal(fs.existsSync(path.join(root, "specs")), false);

      assertActiveMismatch(runCli(root, [
        "flow", "prepare", "--title", "unknown-run", "--no-branch", "--run-id", "missing-run",
        "--expect-run-id", "missing-run",
      ]));
      assert.equal(fs.existsSync(path.join(root, "specs")), false);
      assert.equal(fs.existsSync(path.join(root, ".senti", "worktree")), false);
      assert.equal(runGit(root, ["branch", "--format=%(refname)"]).stdout, initialBranches);
      assert.equal(runGit(root, ["worktree", "list", "--porcelain"]).stdout, initialWorktrees);
      const guardFreePrepare = runCli(root, [
        "flow", "prepare", "--title", "guard-free-unknown", "--no-branch", "--run-id", "missing-run",
      ]);
      assert.notEqual(guardFreePrepare.status, 0);
      assert.equal(parseCli(guardFreePrepare).errors[0].code, "ERROR");
    } finally {
      removeTmpDir(root);
    }
  });

  it("R5: successful guarded prepare promotes the same target and preserves active guards", () => {
    const { root } = setupCliProject();
    try {
      const runId = initPreparingRun(root);
      const prepare = runCli(root, [
        "flow", "prepare", "--title", "guarded-promotion", "--no-branch", "--run-id", runId,
        "--expect-run-id", runId, "--expect-issue", "431",
      ]);
      assert.equal(prepare.status, 0, prepare.stderr);
      const prepared = parseCli(prepare).data;
      const guards = [
        "--expect-run-id", runId,
        "--expect-issue", "431",
        "--expect-spec", prepared.spec,
      ];

      const matching = runCli(root, ["flow", "get", "next-action", ...guards]);
      assert.equal(matching.status, 0, matching.stderr);
      const guardFree = runCli(root, ["flow", "get", "next-action"]);
      assert.equal(guardFree.status, 0, guardFree.stderr);

      for (const changed of [
        ["--expect-run-id", "wrong-run", "--expect-issue", "431", "--expect-spec", prepared.spec],
        ["--expect-run-id", runId, "--expect-issue", "999", "--expect-spec", prepared.spec],
        ["--expect-run-id", runId, "--expect-issue", "431", "--expect-spec", "specs/wrong/spec.json"],
      ]) {
        assertActiveMismatch(runCli(root, ["flow", "get", "next-action", ...changed]));
      }

      const promoted = makeFlowManager(root).load();
      assert.equal(promoted.runId, runId);
      assert.equal(promoted.issue, 431);
      assert.equal(promoted.spec, prepared.spec);
      assert.equal(makeFlowManager(root).loadPreparingFlow(runId), null);
    } finally {
      removeTmpDir(root);
    }
  });

  it("R6: dispatcher rejects every preparing mismatch before command loading and hooks", async () => {
    for (const argv of [
      ["--expect-run-id", "wrong-run"],
      ["--expect-run-id", "run-431", "--expect-issue", "999"],
      ["--expect-run-id", "run-431", "--expect-issue", "431", "--expect-spec", "specs/not-prepared/spec.json"],
    ]) {
      const container = new Container();
      let commandLoads = 0;
      let preHooks = 0;
      let executions = 0;
      const output = [];
      class SideEffectCommand extends Command {
        static outputMode = "envelope";
        execute() {
          executions += 1;
          return { executed: true };
        }
      }

      await dispatch({
        container,
        entry: {
          requiresFlow: false,
          args: { options: GUARD_OPTIONS },
          command: async () => {
            commandLoads += 1;
            return { default: SideEffectCommand };
          },
          pre() {
            preHooks += 1;
          },
        },
        argv,
        envelopeType: "run",
        envelopeKey: "auto-check",
        stdout: (chunk) => output.push(chunk),
        setExitCode: () => {},
        buildHookCtx: () => ({
          flowState: null,
          preparingFlowState: { runId: "run-431", issue: 431, spec: null },
        }),
      });

      const envelope = JSON.parse(output.join(""));
      assert.equal(envelope.ok, false);
      assert.equal(envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
      assert.equal(commandLoads, 0);
      assert.equal(preHooks, 0);
      assert.equal(executions, 0);
    }
  });
});
