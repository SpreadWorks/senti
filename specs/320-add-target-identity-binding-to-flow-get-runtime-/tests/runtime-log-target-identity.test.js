// spec: R1 R2 R3 R4 R5 R6 R7
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cliPath = path.join(repoRoot, "src/senti.js");
const EXPECT_OPTIONS = ["--expect-issue", "--expect-spec", "--expect-run-id"];

function createProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-log-target-"));
  fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senti", "config.json"), JSON.stringify({
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  }));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    name: "runtime-log-target-fixture",
    version: "0.0.0",
    type: "module",
  }));
  const git = spawnSync("git", ["init", "-b", "main"], { cwd: root, encoding: "utf8" });
  assert.equal(git.status, 0, git.stderr);
  return root;
}

function saveActiveFlow(root, specId, { issue, runId }) {
  const specDir = path.join(root, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
    goal: "fixture",
    requirements: [],
  }));
  const state = {
    spec: `specs/${specId}/spec.json`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    issue,
    runId,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
  };
  const flowManager = makeFlowManager(root);
  flowManager.save(state);
  flowManager.addActiveFlow(specId, "branch");
  return state;
}

function savePreparingFlow(root, { issue, runId }) {
  return makeFlowManager(root).createPreparingFlow(runId, {
    issue,
    request: `inspect Issue #${issue}`,
  });
}

function runtimeBlock({ runId, sequence, command, payload }) {
  const startedAt = "2026-07-12T00:00:00.000Z";
  const endedAt = "2026-07-12T00:00:01.000Z";
  return [
    `===== start runId=${runId} sequence=${sequence} attempt=1 command="${command}" startedAt="${startedAt}" exitCode="" endedAt="" =====`,
    `[stdout] ${payload}`,
    `===== end runId=${runId} sequence=${sequence} attempt=1 command="${command}" startedAt="${startedAt}" exitCode=0 endedAt="${endedAt}" =====`,
  ].join("\n");
}

function writeRuntimeLog(root, flowId, blocks) {
  const file = path.join(root, ".tmp", "logs", `${flowId}.log`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${blocks.join("\n")}\n`);
  return file;
}

function runFlow(root, args) {
  const result = spawnSync("node", [cliPath, "flow", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
  const stdout = result.stdout.trim();
  let envelope = null;
  if (stdout.startsWith("{")) envelope = JSON.parse(stdout);
  return { ...result, envelope };
}

function errorCode(result) {
  return result.envelope?.errors?.[0]?.code;
}

function expectSuccess(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.envelope?.ok, true);
  return result.envelope.data;
}

function snapshotTree(root, relativeRoots) {
  const snapshot = {};
  function visit(absolute, relative) {
    if (!fs.existsSync(absolute)) return;
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) {
        visit(path.join(absolute, name), path.join(relative, name));
      }
      return;
    }
    snapshot[relative] = fs.readFileSync(absolute).toString("base64");
  }
  for (const relative of relativeRoots) visit(path.join(root, relative), relative);
  return snapshot;
}

describe("runtime-log target identity binding", () => {
  const roots = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it("R1: requires a non-empty subset of the shared target expectations", () => {
    const entry = FLOW_COMMANDS.get["runtime-log"];
    for (const option of EXPECT_OPTIONS) {
      assert.ok(entry.args?.options?.includes(option), `runtime-log must declare ${option}`);
    }

    const root = createProject();
    roots.push(root);
    const bare = runFlow(root, ["get", "runtime-log"]);
    assert.notEqual(bare.status, 0);
    assert.equal(errorCode(bare), "ARGS_ERROR");
    assert.match(bare.envelope.errors[0].messages.join(" "), /expect|target/i);
  });

  it("R1: accepts run ID, Issue, and spec as independent single expectations", () => {
    const root = createProject();
    roots.push(root);
    const state = saveActiveFlow(root, "438-target", { issue: 438, runId: "run-438" });
    const block = runtimeBlock({
      runId: state.runId,
      sequence: 1,
      command: "flow run review",
      payload: "target output",
    });
    writeRuntimeLog(root, "438-target", [block]);

    for (const expectation of [
      ["--expect-run-id", "run-438"],
      ["--expect-issue", "438"],
      ["--expect-spec", "438-target"],
      ["--expect-run-id", "run-438", "--expect-issue", "438"],
      ["--expect-run-id", "run-438", "--expect-spec", "438-target"],
      ["--expect-issue", "438", "--expect-spec", "438-target"],
    ]) {
      const data = expectSuccess(runFlow(root, [
        "get", "runtime-log", ...expectation, "--format", "json",
      ]));
      assert.equal(data.runId, "run-438");
      assert.match(data.text, /target output/);
    }
  });

  it("R2: isolates exact active and preparing targets when several flows exist", () => {
    const root = createProject();
    roots.push(root);
    saveActiveFlow(root, "437-unrelated", { issue: 437, runId: "run-437" });
    saveActiveFlow(root, "438-target", { issue: 438, runId: "run-438" });
    savePreparingFlow(root, { issue: 439, runId: "run-439-preparing" });
    writeRuntimeLog(root, "437-unrelated", [runtimeBlock({
      runId: "run-437",
      sequence: 1,
      command: "flow run review",
      payload: "unrelated active",
    })]);
    writeRuntimeLog(root, "438-target", [runtimeBlock({
      runId: "run-438",
      sequence: 1,
      command: "flow run review",
      payload: "selected active",
    })]);
    writeRuntimeLog(root, "no-flow", [
      runtimeBlock({
        runId: "run-other-preparing",
        sequence: 1,
        command: "flow set init",
        payload: "unrelated preparing",
      }),
      runtimeBlock({
        runId: "run-439-preparing",
        sequence: 2,
        command: "flow prepare",
        payload: "selected preparing",
      }),
    ]);

    const active = expectSuccess(runFlow(root, [
      "get", "runtime-log",
      "--expect-run-id", "run-438",
      "--expect-issue", "438",
      "--expect-spec", "438-target",
      "--format", "json",
    ]));
    assert.match(active.text, /selected active/);
    assert.doesNotMatch(active.text, /unrelated/);

    const preparing = expectSuccess(runFlow(root, [
      "get", "runtime-log",
      "--expect-run-id", "run-439-preparing",
      "--expect-issue", "439",
      "--format", "json",
    ]));
    assert.match(preparing.text, /selected preparing/);
    assert.doesNotMatch(preparing.text, /unrelated preparing/);
  });

  it("R3: reports each local target identity mismatch without log content", () => {
    const root = createProject();
    roots.push(root);
    saveActiveFlow(root, "438-target", { issue: 438, runId: "run-438" });
    writeRuntimeLog(root, "438-target", [runtimeBlock({
      runId: "run-438",
      sequence: 1,
      command: "flow run review",
      payload: "must stay hidden",
    })]);

    const cases = [
      {
        args: ["--expect-run-id", "wrong-run", "--expect-spec", "438-target"],
        expected: { expectedRunId: "wrong-run", activeRunId: "run-438" },
      },
      {
        args: ["--expect-run-id", "run-438", "--expect-issue", "999"],
        expected: { expectedIssue: 999, activeIssue: 438 },
      },
      {
        args: ["--expect-issue", "438", "--expect-spec", "999-wrong"],
        expected: { expectedSpec: "999-wrong", activeSpec: "438-target" },
      },
    ];
    for (const mismatch of cases) {
      const result = runFlow(root, ["get", "runtime-log", ...mismatch.args, "--format", "json"]);
      assert.notEqual(result.status, 0);
      assert.equal(errorCode(result), "ACTIVE_FLOW_MISMATCH");
      assert.deepEqual(
        Object.fromEntries(Object.keys(mismatch.expected).map((key) => [key, result.envelope.data[key]])),
        mismatch.expected,
      );
      assert.doesNotMatch(result.stdout, /must stay hidden/);
    }
  });

  it("R4: distinguishes missing target from missing runtime log without fallback", () => {
    const root = createProject();
    roots.push(root);
    saveActiveFlow(root, "437-unrelated", { issue: 437, runId: "run-437" });
    saveActiveFlow(root, "438-no-log", { issue: 438, runId: "run-438" });
    writeRuntimeLog(root, "437-unrelated", [runtimeBlock({
      runId: "run-437",
      sequence: 1,
      command: "flow run review",
      payload: "must not fall back",
    })]);

    const missingTarget = runFlow(root, [
      "get", "runtime-log", "--expect-run-id", "missing-run", "--format", "json",
    ]);
    assert.notEqual(missingTarget.status, 0);
    assert.equal(errorCode(missingTarget), "FLOW_TARGET_NOT_FOUND");
    assert.doesNotMatch(missingTarget.stdout, /must not fall back/);

    const missingLog = runFlow(root, [
      "get", "runtime-log",
      "--expect-run-id", "run-438",
      "--expect-issue", "438",
      "--expect-spec", "438-no-log",
      "--format", "json",
    ]);
    assert.notEqual(missingLog.status, 0);
    assert.equal(errorCode(missingLog), "RUNTIME_LOG_NOT_FOUND");
    assert.doesNotMatch(missingLog.stdout, /must not fall back/);

    saveActiveFlow(root, "440-first", { issue: 440, runId: "run-440-first" });
    saveActiveFlow(root, "440-second", { issue: 440, runId: "run-440-second" });
    writeRuntimeLog(root, "440-first", [runtimeBlock({
      runId: "run-440-first",
      sequence: 1,
      command: "flow run review",
      payload: "ambiguous first",
    })]);
    writeRuntimeLog(root, "440-second", [runtimeBlock({
      runId: "run-440-second",
      sequence: 1,
      command: "flow run review",
      payload: "ambiguous second",
    })]);
    const ambiguous = runFlow(root, [
      "get", "runtime-log", "--expect-issue", "440", "--format", "json",
    ]);
    assert.notEqual(ambiguous.status, 0);
    assert.equal(errorCode(ambiguous), "FLOW_TARGET_NOT_FOUND");
    assert.doesNotMatch(ambiguous.stdout, /ambiguous first|ambiguous second/);
  });

  it("R5: preserves raw, JSON, and block-selector contracts after target match", () => {
    const root = createProject();
    roots.push(root);
    saveActiveFlow(root, "438-target", { issue: 438, runId: "run-438" });
    const first = runtimeBlock({
      runId: "run-438",
      sequence: 1,
      command: "flow run review",
      payload: "first block",
    });
    const second = runtimeBlock({
      runId: "run-438",
      sequence: 2,
      command: "flow run gate",
      payload: "second block",
    });
    const runtimeLogRead = runtimeBlock({
      runId: "run-438",
      sequence: 3,
      command: "flow get runtime-log",
      payload: "self read must be skipped by default",
    });
    const foreign = runtimeBlock({
      runId: "run-foreign",
      sequence: 4,
      command: "flow run review",
      payload: "foreign run must stay hidden",
    });
    writeRuntimeLog(root, "438-target", [first, second, runtimeLogRead, foreign]);
    const guard = [
      "--expect-run-id", "run-438",
      "--expect-issue", "438",
      "--expect-spec", "438-target",
    ];

    const raw = runFlow(root, ["get", "runtime-log", ...guard, "--sequence", "2"]);
    assert.equal(raw.status, 0, raw.stderr);
    assert.equal(raw.stdout, `${second}\n`);

    const json = expectSuccess(runFlow(root, [
      "get", "runtime-log", ...guard, "--run-id", "run-438#1", "--format", "json",
    ]));
    assert.equal(json.text, first);
    assert.equal(json.runId, "run-438");
    assert.equal(json.sequence, 1);
    assert.equal(json.command, "flow run review");

    const latest = expectSuccess(runFlow(root, [
      "get", "runtime-log", ...guard, "--format", "json",
    ]));
    assert.equal(latest.sequence, 2);
    assert.match(latest.text, /second block/);
    assert.doesNotMatch(latest.text, /self read must be skipped|foreign run must stay hidden/);

    const foreignSequence = runFlow(root, [
      "get", "runtime-log", ...guard, "--sequence", "4", "--format", "json",
    ]);
    assert.notEqual(foreignSequence.status, 0);
    assert.equal(errorCode(foreignSequence), "RUNTIME_LOG_NOT_FOUND");
    assert.doesNotMatch(foreignSequence.stdout, /foreign run must stay hidden/);

    const conflict = runFlow(root, [
      "get", "runtime-log", ...guard,
      "--sequence", "2", "--run-id", "run-438#1", "--format", "json",
    ]);
    assert.notEqual(conflict.status, 0);
    assert.equal(errorCode(conflict), "INVALID_ARG_VALUE");

    for (const invalidArgs of [
      ["--format", "text"],
      ["--sequence", "0"],
    ]) {
      const invalid = runFlow(root, ["get", "runtime-log", ...guard, ...invalidArgs]);
      assert.notEqual(invalid.status, 0);
      assert.equal(errorCode(invalid), "INVALID_ARG_VALUE");
    }
  });

  it("R6: leaves flow and runtime-log files unchanged on success and mismatch", () => {
    const root = createProject();
    roots.push(root);
    saveActiveFlow(root, "438-target", { issue: 438, runId: "run-438" });
    const logFile = writeRuntimeLog(root, "438-target", [runtimeBlock({
      runId: "run-438",
      sequence: 1,
      command: "flow run review",
      payload: "immutable content",
    })]);
    const flowFile = path.join(root, "specs", "438-target", "flow.json");
    const specDir = path.dirname(flowFile);
    fs.writeFileSync(path.join(specDir, "issue-log.json"), JSON.stringify({
      issue: 438,
      entries: [{ step: "fixture", reason: "immutable Issue metadata" }],
    }));
    fs.writeFileSync(path.join(specDir, "file-map.json"), JSON.stringify({
      R1: ["src/flow/lib/get-runtime-log.js"],
    }));
    fs.mkdirSync(path.join(specDir, "plugin-artifacts", "workflow"), { recursive: true });
    fs.writeFileSync(
      path.join(specDir, "plugin-artifacts", "workflow", "prepare.json"),
      JSON.stringify({ issue: 438, boardState: "unchanged" }),
    );
    fs.mkdirSync(path.join(root, ".senti", "workflow"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".senti", "workflow", "board.json"),
      JSON.stringify({ items: [{ issue: 438, state: "in-progress" }] }),
    );
    fs.writeFileSync(
      path.join(root, ".senti", "issue-metadata.json"),
      JSON.stringify({ 438: { title: "target identity", state: "open" } }),
    );
    const before = {
      productState: snapshotTree(root, [".senti", "specs"]),
      targetLog: fs.readFileSync(logFile),
    };

    const success = runFlow(root, [
      "get", "runtime-log",
      "--expect-run-id", "run-438",
      "--expect-issue", "438",
      "--expect-spec", "438-target",
      "--format", "json",
    ]);
    assert.equal(success.status, 0, success.stderr);
    const mismatch = runFlow(root, [
      "get", "runtime-log", "--expect-issue", "999", "--format", "json",
    ]);
    assert.notEqual(mismatch.status, 0);

    assert.ok(fs.existsSync(flowFile));
    assert.ok(fs.existsSync(logFile));
    assert.deepEqual(
      snapshotTree(root, [".senti", "specs"]),
      before.productState,
      "read paths must preserve flow/spec, metadata, Issue/board, and generated-artifact surfaces",
    );
    assert.deepEqual(fs.readFileSync(logFile), before.targetLog, "the selected runtime log must not be rewritten");
  });

  it("R7: confines target-option behavior to runtime-log while every other get contract keeps regression coverage", () => {
    const runtimeEntry = FLOW_COMMANDS.get["runtime-log"];
    for (const option of EXPECT_OPTIONS) assert.ok(runtimeEntry.args?.options?.includes(option));

    const expectedRegistry = {
      status: { positional: ["runId"], flags: ["--details"], options: EXPECT_OPTIONS },
      "resolve-context": { options: EXPECT_OPTIONS },
      check: { positional: ["target"] },
      prompt: { positional: ["kind"], options: EXPECT_OPTIONS },
      "qa-count": { options: EXPECT_OPTIONS },
      guardrail: { positional: ["phase"], options: ["--format"] },
      issue: { positional: ["number"] },
      "next-action": { options: EXPECT_OPTIONS },
      context: { positional: ["path"], flags: ["--raw"], options: ["--search", ...EXPECT_OPTIONS] },
    };
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(FLOW_COMMANDS.get)
          .filter(([key]) => key !== "runtime-log")
          .map(([key, entry]) => [key, entry.args]),
      ),
      expectedRegistry,
      "runtime-log changes must not alter any adjacent get registry contract",
    );

    const root = createProject();
    roots.push(root);
    saveActiveFlow(root, "438-target", { issue: 438, runId: "run-438" });
    const status = runFlow(root, [
      "get", "status", "run-438",
      "--expect-run-id", "run-438",
      "--expect-issue", "438",
      "--expect-spec", "438-target",
    ]);
    assert.equal(status.status, 0, status.stderr);
    assert.equal(status.envelope?.data?.runId, "run-438");
    assert.equal(status.envelope?.data?.issue, 438);

    const permanentGetTests = [
      "tests/unit/flow/get-status.test.js",
      "tests/unit/flow/get-check.test.js",
      "tests/unit/flow/get-prompt.test.js",
      "tests/unit/flow/get-next-action.test.js",
      "tests/unit/flow/get-context-ai-search.test.js",
      "tests/unit/flow/get-context-search.test.js",
      "tests/unit/flow/get-context-ngram.test.js",
      "tests/unit/flow/get-step-instructions.test.js",
      "tests/unit/flow/get-unknown-options.test.js",
      "tests/unit/flow/fetch-issue.test.js",
      "tests/unit/flow/resolve-context-extended.test.js",
      "tests/unit/flow/resolve-context-worktree-main-repo.test.js",
      "tests/unit/flow/ctx-dispatch.test.js",
    ];
    const regression = spawnSync("node", ["--test", ...permanentGetTests], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.equal(regression.status, 0, regression.stdout || regression.stderr);
  });
});
