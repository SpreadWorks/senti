// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R12 R13
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createTmpDir, removeTmpDir, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../../tests/helpers/git-repo.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { Command } from "../../../src/lib/command.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CLI = path.join(REPO_ROOT, "src/sdd-forge.js");
let tmpDirs = [];

afterEach(() => {
  for (const dir of tmpDirs) removeTmpDir(dir);
  tmpDirs = [];
});

function tmpProject(prefix = "runtime-log-spec-") {
  const dir = createTmpDir(prefix);
  tmpDirs.push(dir);
  writeJson(dir, ".sdd-forge/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    agent: { provider: "none" },
  });
  writeJson(dir, "package.json", { name: "runtime-log-fixture", version: "0.0.0" });
  initGitRepo(dir);
  commitAll(dir, "initial");
  return dir;
}

function runCli(cwd, args) {
  return spawnSync("node", [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: cwd },
  });
}

function parseEnvelope(res) {
  return JSON.parse(res.stdout.trim());
}

function prepareFlow(cwd) {
  const init = runCli(cwd, ["flow", "set", "init", "--request", "runtime log fixture"]);
  assert.equal(init.status, 0, init.stderr);
  const runId = parseEnvelope(init).data.runId;
  const prep = runCli(cwd, [
    "flow", "prepare",
    "--title", "runtime-log-fixture",
    "--no-branch",
    "--run-id", runId,
  ]);
  assert.equal(prep.status, 0, prep.stderr);
  const specDir = parseEnvelope(prep).data.artifacts.specDir;
  return { runId, specDir, flowId: path.basename(specDir) };
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);
}

function assertClosedBlock(text, command) {
  assert.match(text, /===== start .*runId=.*sequence=\d+.*attempt=\d+.*startedAt=.*exitCode=.*endedAt=/, "block must have start metadata");
  assert.match(text, new RegExp(`command="${escapeRegex(command)}"`), "block must include command");
  assert.match(text, /===== end .*runId=.*sequence=\d+.*exitCode=\d+.*endedAt=/, "block must have end metadata");
}

function assertClosedCommandBlock(text, command) {
  assertClosedBlock(runtimeLogBlockForCommand(text, command), command);
}

function assertPrefixedOutput(text, stream) {
  assert.match(text, new RegExp(`^\\[${stream}\\]`, "m"), `${stream} output must be captured with a prefix`);
}

function runtimeLogBlocks(text) {
  return [...text.matchAll(/^===== start [^\n]*\n[\s\S]*?^===== end [^\n]*$/gm)].map((match) => match[0]);
}

function runtimeLogBlockForCommand(text, command) {
  const pattern = new RegExp(`command="${escapeRegex(command)}"`);
  const blocks = runtimeLogBlocks(text).filter((block) => pattern.test(block));
  assert.ok(blocks.length > 0, `expected runtime log block for ${command}`);
  return blocks.at(-1);
}

function runtimeLogBlockMetadata(block) {
  const start = block.split("\n")[0];
  const runId = start.match(/\brunId=([^ ]+)/)?.[1];
  const sequence = Number(start.match(/\bsequence=(\d+)/)?.[1]);
  assert.ok(runId, "runtime log block must expose runId in start metadata");
  assert.ok(Number.isInteger(sequence), "runtime log block must expose sequence in start metadata");
  return { runId, sequence };
}

function outputLines(block) {
  return block
    .split("\n")
    .filter((line) => line !== "")
    .filter((line) => !line.startsWith("===== start ") && !line.startsWith("===== end "));
}

function assertEveryOutputLinePrefixed(block) {
  const lines = outputLines(block);
  const stdoutLines = lines.filter((line) => line.startsWith("[stdout]"));
  const stderrLines = lines.filter((line) => line.startsWith("[stderr]"));
  assert.ok(stdoutLines.length > 1, "fixture must exercise multi-line stdout capture");
  assert.ok(stderrLines.length > 0, "fixture must exercise stderr capture");
  for (const line of lines) {
    assert.match(line, /^\[(stdout|stderr)\]/, `captured output line must be stream-prefixed: ${line}`);
  }
}

function getRuntimeLogWithoutAppending(cwd, logPath, args = []) {
  const before = readText(logPath);
  const res = runCli(cwd, ["flow", "get", "runtime-log", ...args]);
  assert.equal(res.status, 0, res.stderr);
  const after = readText(logPath);
  assert.equal(after, before, `flow get runtime-log ${args.join(" ")} must not append anything to the runtime log file`);
  return res;
}

function assertVisibleStderrLogged({ cwd, args, logPath, command }) {
  const res = runCli(cwd, args);
  assert.notEqual(res.status, 0, `${args.join(" ")} should fail for stderr coverage`);
  assert.notEqual(res.stderr.trim(), "", "visible stderr must be preserved");
  const log = readText(logPath);
  const block = runtimeLogBlockForCommand(log, command);
  assertClosedBlock(block, command);
  assertPrefixedOutput(block, "stderr");
  if (res.stdout.trim() !== "") assertPrefixedOutput(block, "stdout");
}

function assertVisibleStdoutLogged({ cwd, args, logPath, command }) {
  const res = runCli(cwd, args);
  assert.equal(res.status, 0, res.stderr);
  assert.notEqual(res.stdout.trim(), "", "visible stdout must be preserved");
  const log = readText(logPath);
  const block = runtimeLogBlockForCommand(log, command);
  assertClosedBlock(block, command);
  assertPrefixedOutput(block, "stdout");
}

async function assertDispatchCapturesBothStreams({ cwd, envelopeType, envelopeKey, command, flowId }) {
  const commandFile = `${command.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}-command.mjs`;
  const commandPath = path.join(cwd, commandFile);
  fs.writeFileSync(commandPath, [
    `import { Command } from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "src/lib/command.js")).href)};`,
    "export default class MixedStreamCommand extends Command {",
    "  static outputMode = \"envelope\";",
    "  async execute() {",
    `    process.stdout.write(${JSON.stringify(`${command} stdout fixture\n`)});`,
    `    process.stderr.write(${JSON.stringify(`${command} stderr fixture\n`)});`,
    "    return { status: \"done\" };",
    "  }",
    "}",
    "",
  ].join("\n"));
  const container = {
    has(key) {
      return key === "paths";
    },
    get(key) {
      if (key === "paths") return { root: cwd, agentWorkDir: path.join(cwd, ".tmp", "agent") };
      throw new Error(`unexpected container key: ${key}`);
    },
  };
  await dispatch({
    container,
    entry: {
      command: () => import(pathToFileURL(commandPath).href),
      args: { flags: [], options: [] },
      requiresFlow: false,
    },
    argv: [],
    envelopeType,
    envelopeKey,
    runtimeLog: true,
    buildHookCtx: () => ({ root: cwd, specId: flowId }),
  });
  const block = runtimeLogBlockForCommand(readText(path.join(cwd, ".tmp", "logs", `${flowId}.log`)), command);
  assertClosedBlock(block, command);
  assert.match(block, new RegExp(`^\\[stdout\\] ${escapeRegex(`${command} stdout fixture`)}$`, "m"));
  assert.match(block, new RegExp(`^\\[stderr\\] ${escapeRegex(`${command} stderr fixture`)}$`, "m"));
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

class RuntimeLogProbeCommand extends Command {
  static outputMode = "envelope";

  async execute() {
    return { result: "pass" };
  }
}

class FailingRuntimeLogProbeCommand extends Command {
  static outputMode = "envelope";

  async execute() {
    throw new Error("runtime log probe failure");
  }
}

function collectStepRuntimeLogs(steps, out = []) {
  for (const step of steps || []) {
    if (step.runtimeLog) out.push({ id: step.id, runtimeLog: step.runtimeLog });
    collectStepRuntimeLogs(step.children, out);
    collectStepRuntimeLogs(step.steps, out);
  }
  return out;
}

describe("spec 267: flow runtime log standardization", () => {
  it("R1: flow get status opens and closes an automatic runtime log block", () => {
    const cwd = tmpProject();
    const { flowId } = prepareFlow(cwd);
    assertClosedCommandBlock(readText(path.join(cwd, ".tmp", "logs", "no-flow.log")), "flow prepare");

    const res = runCli(cwd, ["flow", "get", "status"]);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(runCli(cwd, ["flow", "set", "note", "r1 set coverage"]).status, 0);
    assert.equal(runCli(cwd, ["flow", "run", "report", "--dry-run"]).status, 0);

    const logPath = path.join(cwd, ".tmp", "logs", `${flowId}.log`);
    const log = readText(logPath);
    assertClosedCommandBlock(log, "flow get status");
    assertClosedCommandBlock(log, "flow set note");
    assertClosedCommandBlock(log, "flow run report");

    const reportFailure = runCli(cwd, ["flow", "report", "show"]);
    assert.notEqual(reportFailure.status, 0, "missing finalized report should fail through dispatcher");
    assertClosedCommandBlock(readText(logPath), "flow report show");
  });

  it("R2: active-flow and no-flow commands append to the required root .tmp log files", () => {
    const active = tmpProject();
    const { flowId } = prepareFlow(active);
    assert.equal(runCli(active, ["flow", "get", "status"]).status, 0);
    assert.ok(fs.existsSync(path.join(active, ".tmp", "logs", `${flowId}.log`)));

    const noFlow = tmpProject();
    assert.equal(runCli(noFlow, ["flow", "get", "status"]).status, 0);
    assert.ok(fs.existsSync(path.join(noFlow, ".tmp", "logs", "no-flow.log")));
    assert.ok(!fs.existsSync(path.join(noFlow, ".tmp", "logs", "no-flow")), "no-flow runtime log must be a single file");
  });

  it("R3: repeated commands append increasing sequence blocks to the same log file", () => {
    const cwd = tmpProject();
    const { flowId } = prepareFlow(cwd);
    const logPath = path.join(cwd, ".tmp", "logs", `${flowId}.log`);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, [
      "===== start runId=seed sequence=1 attempt=1 command=\"seed one\" startedAt=\"2026-01-01T00:00:00.000Z\" =====",
      "===== end runId=seed sequence=1 exitCode=0 endedAt=\"2026-01-01T00:00:00.001Z\" =====",
      "===== start runId=seed sequence=2 attempt=1 command=\"seed two\" startedAt=\"2026-01-01T00:00:01.000Z\" =====",
      "===== end runId=seed sequence=2 exitCode=0 endedAt=\"2026-01-01T00:00:01.001Z\" =====",
      "",
    ].join("\n"));
    assert.equal(runCli(cwd, ["flow", "get", "status"]).status, 0);
    const log = readText(logPath);
    assert.match(log, /command="flow get status"/);
    assert.match(log, /===== start .*sequence=3 /, "new sequence must be based on existing file blocks");
  });

  it("R4: runtime log blocks record complete command metadata and exit code", () => {
    const cwd = tmpProject();
    const { flowId } = prepareFlow(cwd);
    assert.equal(runCli(cwd, ["flow", "get", "status"]).status, 0);
    const log = runtimeLogBlockForCommand(readText(path.join(cwd, ".tmp", "logs", `${flowId}.log`)), "flow get status");
    for (const token of ["runId=", "sequence=", "attempt=", "command=", "startedAt=", "endedAt=", "exitCode="]) {
      assert.match(log, new RegExp(token), `runtime log block must include ${token}`);
    }
  });

  it("R5: runtime logs tee stdout and stderr with prefixes while preserving visible streams", () => {
    const cwd = tmpProject();
    const { flowId } = prepareFlow(cwd);
    const res = runCli(cwd, ["flow", "run", "gate", "--phase", "draft"]);
    assert.equal(res.status, 0, res.stderr);
    assert.doesNotThrow(() => JSON.parse(res.stdout), "stdout must remain the JSON envelope");
    assert.notEqual(res.stderr.trim(), "", "stderr must remain visible for mixed-stream commands");
    const log = readText(path.join(cwd, ".tmp", "logs", `${flowId}.log`));
    assertPrefixedOutput(log, "stdout");
    assertPrefixedOutput(log, "stderr");
    const block = runtimeLogBlockForCommand(log, "flow run gate");
    assertEveryOutputLinePrefixed(block);
    assert.ok(
      block.indexOf("[stderr]") < block.indexOf("[stdout]"),
      "runtime log must preserve the observed stderr-before-stdout order for flow run gate",
    );
  });

  it("R5: dispatcher runtime logging preserves deterministic interleaved stream order", async () => {
    const cwd = tmpProject("runtime-log-interleaved-");
    const commandPath = path.join(cwd, "interleaved-command.mjs");
    fs.writeFileSync(commandPath, [
      `import { Command } from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "src/lib/command.js")).href)};`,
      "export default class InterleavedCommand extends Command {",
      "  static outputMode = \"envelope\";",
      "  async execute() {",
      "    process.stdout.write(\"out-one\\n\");",
      "    process.stderr.write(\"err-one\\n\");",
      "    process.stdout.write(\"out-two\\n\");",
      "    process.stderr.write(\"err-two\\n\");",
      "    process.stdout.write(\"partial-out\");",
      "    process.stderr.write(\"partial-err\\n\");",
      "    return { status: \"done\" };",
      "  }",
      "}",
      "",
    ].join("\n"));
    const container = {
      has(key) {
        return key === "paths";
      },
      get(key) {
        if (key === "paths") return { root: cwd, agentWorkDir: path.join(cwd, ".tmp", "agent") };
        throw new Error(`unexpected container key: ${key}`);
      },
    };
    await dispatch({
      container,
      entry: {
        command: () => import(pathToFileURL(commandPath).href),
        args: { flags: [], options: [] },
        requiresFlow: false,
      },
      argv: [],
      envelopeType: "flow",
      envelopeKey: "interleaved",
      runtimeLog: true,
      buildHookCtx: () => ({ root: cwd, specId: "interleaved-flow" }),
    });
    const block = runtimeLogBlockForCommand(readText(path.join(cwd, ".tmp", "logs", "interleaved-flow.log")), "flow interleaved");
    assert.deepEqual(
      outputLines(block).filter((line) => /(?:out|err)-(?:one|two)/.test(line)),
      ["[stdout] out-one", "[stderr] err-one", "[stdout] out-two", "[stderr] err-two"],
    );
    assert.ok(outputLines(block).includes("[stdout] partial-out"), "partial stdout writes must be closed before another stream prefix");
    assert.ok(outputLines(block).includes("[stderr] partial-err"), "partial stderr writes must start on its own prefixed line");
    assertEveryOutputLinePrefixed(block);
  });

  it("R12: prepare, get, set, run, and report show paths preserve and log stderr", async () => {
    const activeCwd = tmpProject();
    const { specDir, flowId } = prepareFlow(activeCwd);
    const prepareBlock = runtimeLogBlockForCommand(readText(path.join(activeCwd, ".tmp", "logs", "no-flow.log")), "flow prepare");
    assertPrefixedOutput(prepareBlock, "stdout");
    await assertDispatchCapturesBothStreams({
      cwd: activeCwd,
      envelopeType: "run",
      envelopeKey: "prepare-spec",
      command: "flow prepare",
      flowId: "r12-prepare",
    });
    const activeLog = path.join(activeCwd, ".tmp", "logs", `${flowId}.log`);
    assertVisibleStdoutLogged({
      cwd: activeCwd,
      args: ["flow", "get", "status"],
      logPath: activeLog,
      command: "flow get status",
    });
    await assertDispatchCapturesBothStreams({
      cwd: activeCwd,
      envelopeType: "get",
      envelopeKey: "status",
      command: "flow get status",
      flowId: "r12-get",
    });
    assertVisibleStdoutLogged({
      cwd: activeCwd,
      args: ["flow", "set", "note", "r12 stdout path"],
      logPath: activeLog,
      command: "flow set note",
    });
    await assertDispatchCapturesBothStreams({
      cwd: activeCwd,
      envelopeType: "set",
      envelopeKey: "step",
      command: "flow set step",
      flowId: "r12-set",
    });
    assertVisibleStderrLogged({
      cwd: activeCwd,
      args: ["flow", "report", "show"],
      logPath: activeLog,
      command: "flow report show",
    });
    fs.writeFileSync(path.join(activeCwd, ".sdd-forge", "last-finalized-spec"), `${specDir}/spec.json\n`);
    writeJson(activeCwd, path.join(specDir, "report.json"), { text: "runtime report stdout\n" });
    assertVisibleStdoutLogged({
      cwd: activeCwd,
      args: ["flow", "report", "show"],
      logPath: activeLog,
      command: "flow report show",
    });
  });

  it("R6: step-associated commands persist path-free runtimeLog metadata and exclude finalize-cleanup", async () => {
    const cwd = tmpProject();
    const { specDir } = prepareFlow(cwd);
    assert.equal(runCli(cwd, ["flow", "set", "step", "draft", "done"]).status, 0);
    const flow = JSON.parse(readText(path.join(cwd, specDir, "flow.json")));
    const draft = flow.steps[0].children.find((step) => step.id === "draft");
    assert.ok(draft.runtimeLog, "target step must receive runtimeLog metadata");
    assert.equal(typeof draft.runtimeLog.runId, "string", "runtimeLog metadata must store runId");
    assert.equal(typeof draft.runtimeLog.sequence, "number", "runtimeLog metadata must store sequence");
    const allowedRuntimeLogKeys = new Set(["runId", "sequence", "attempt", "command", "startedAt", "endedAt", "exitCode"]);
    for (const [key, value] of Object.entries(draft.runtimeLog)) {
      assert.ok(allowedRuntimeLogKeys.has(key), `runtimeLog metadata must not store path/file/log key ${key}`);
      assert.doesNotMatch(String(value), /\.tmp\/logs|\.log$|[/\\]/, `runtimeLog metadata value must not look like a path: ${key}`);
    }
    assert.equal(
      FLOW_COMMANDS.run["finalize-cleanup"].runtimeLog?.stepMetadata,
      false,
      "finalize-cleanup registry entry must explicitly exclude runtimeLog step metadata",
    );

    const runtimeLogUpdates = [];
    const flowState = {
      steps: [
        { id: "impl", children: [{ id: "gate-impl", status: "in_progress" }] },
      ],
    };
    const container = {
      has(key) {
        return key === "paths";
      },
      get(key) {
        if (key === "paths") return { root: cwd, agentWorkDir: path.join(cwd, ".tmp", "agent") };
        throw new Error(`unexpected container key: ${key}`);
      },
    };
    await dispatch({
      container,
      entry: {
        command: async () => ({ default: RuntimeLogProbeCommand }),
        args: { flags: [], options: [] },
        requiresFlow: false,
        runtimeLog: FLOW_COMMANDS.run.gate.runtimeLog,
      },
      argv: [],
      envelopeType: "run",
      envelopeKey: "gate",
      runtimeLog: true,
      buildHookCtx: () => ({
        root: cwd,
        specId: "r6-auto-gate",
        flowState,
        flowManager: {
          setStepRuntimeLog(stepId, metadata) {
            runtimeLogUpdates.push({ stepId, metadata });
          },
        },
      }),
    });
    assert.equal(runtimeLogUpdates.at(-1)?.stepId, "gate-impl", "auto-resolved gate runtimeLog metadata must target gate-impl");

    const reviewRuntimeLogUpdates = [];
    await dispatch({
      container,
      entry: {
        command: async () => ({ default: FailingRuntimeLogProbeCommand }),
        args: { flags: [], options: [] },
        requiresFlow: false,
        runtimeLog: FLOW_COMMANDS.run.review.runtimeLog,
      },
      argv: [],
      envelopeType: "run",
      envelopeKey: "review",
      runtimeLog: true,
      setExitCode: () => {},
      buildHookCtx: () => ({
        root: cwd,
        specId: "r6-auto-review",
        flowState: {
          steps: [
            { id: "impl", children: [{ id: "review", status: "in_progress" }] },
          ],
        },
        flowManager: {
          setStepRuntimeLog(stepId, metadata) {
            reviewRuntimeLogUpdates.push({ stepId, metadata });
          },
        },
      }),
    });
    assert.equal(reviewRuntimeLogUpdates.at(-1)?.stepId, "review", "auto-resolved review failure runtimeLog metadata must target the active review step");
  });

  it("R7: failed non-step commands expose runtimeLog identifiers without step metadata", () => {
    const cwd = tmpProject();
    const { specDir } = prepareFlow(cwd);
    const flowPath = path.join(cwd, specDir, "flow.json");
    const beforeFlow = JSON.parse(readText(flowPath));
    const beforeStepRuntimeLogs = collectStepRuntimeLogs(beforeFlow.steps);
    const res = runCli(cwd, ["flow", "get", "check", "unknown-runtime-log-target"]);
    assert.notEqual(res.status, 0, "invalid non-step command should fail");
    const failureText = `${res.stdout}\n${res.stderr}`;
    const failureBlock = runtimeLogBlockForCommand(readText(path.join(cwd, ".tmp", "logs", `${path.basename(specDir)}.log`)), "flow get check");
    const failureLog = runtimeLogBlockMetadata(failureBlock);
    assert.match(failureText, /runtimeLog[\s\S]*runId/, "failure output must expose runtimeLog.runId");
    assert.match(failureText, new RegExp(escapeRegex(failureLog.runId)), "failure output must expose the failed block runId value");
    assert.match(failureText, /runtimeLog[\s\S]*sequence/, "failure output must expose runtimeLog.sequence");
    assert.match(failureText, new RegExp(`\\b${failureLog.sequence}\\b`), "failure output must expose the failed block sequence value");
    assert.deepEqual(
      collectStepRuntimeLogs(JSON.parse(readText(flowPath)).steps),
      beforeStepRuntimeLogs,
      "non-step failure must not add runtimeLog metadata to workflow steps",
    );
    assert.deepEqual(JSON.parse(readText(flowPath)), beforeFlow, "non-step failure must not mutate flow.json");
  });

  it("R8: flow get runtime-log returns raw text and JSON envelope output", () => {
    const cwd = tmpProject();
    const { flowId } = prepareFlow(cwd);
    assert.equal(runCli(cwd, ["flow", "get", "status"]).status, 0);
    const logPath = path.join(cwd, ".tmp", "logs", `${flowId}.log`);
    const raw = getRuntimeLogWithoutAppending(cwd, logPath);
    assert.match(raw.stdout, /^===== start /, "default runtime-log output must be raw block text");
    assert.throws(() => JSON.parse(raw.stdout), "default runtime-log output must not be a JSON envelope");
    assert.match(raw.stdout, /flow get status/);
    assert.doesNotThrow(() => readText(logPath));

    const json = getRuntimeLogWithoutAppending(cwd, logPath, ["--format", "json"]);
    const env = parseEnvelope(json);
    assert.equal(env.ok, true);
    assert.match(env.data.text, /flow get status/);
    assert.equal(typeof env.data.runId, "string");
    assert.equal(typeof env.data.sequence, "number");
    assert.equal(typeof env.data.command, "string");
    assert.equal(typeof env.data.startedAt, "string");
    assert.equal(typeof env.data.endedAt, "string");
    assert.equal(typeof env.data.exitCode, "number");
  });

  it("R9: flow get runtime-log selects latest, sequence, run-id, and no-flow blocks", () => {
    const cwd = tmpProject();
    const { runId, flowId } = prepareFlow(cwd);
    assert.equal(runCli(cwd, ["flow", "get", "status"]).status, 0);
    assert.equal(runCli(cwd, ["flow", "set", "note", "latest block probe"]).status, 0);
    const logPath = path.join(cwd, ".tmp", "logs", `${flowId}.log`);
    fs.appendFileSync(logPath, [
      `===== start runId=${runId} sequence=3 attempt=1 command="flow get runtime-log" startedAt="2026-01-01T00:00:02.000Z" =====`,
      "[stdout] stale runtime-log retrieval block",
      `===== end runId=${runId} sequence=3 exitCode=0 endedAt="2026-01-01T00:00:02.001Z" =====`,
      "",
    ].join("\n"));
    assert.match(getRuntimeLogWithoutAppending(cwd, logPath).stdout, /latest block probe/);
    assert.doesNotMatch(getRuntimeLogWithoutAppending(cwd, logPath).stdout, /stale runtime-log retrieval block/);
    assert.match(getRuntimeLogWithoutAppending(cwd, logPath, ["--sequence", "1"]).stdout, /flow get status/);
    assert.match(getRuntimeLogWithoutAppending(cwd, logPath, ["--run-id", `${runId}#1`]).stdout, /flow get status/);
    const mismatchedRunId = runCli(cwd, ["flow", "get", "runtime-log", "--run-id", `not-${runId}#1`]);
    assert.notEqual(mismatchedRunId.status, 0, "run-id selector must reject a mismatched runId even when the sequence exists");

    const noFlow = tmpProject();
    assert.equal(runCli(noFlow, ["flow", "get", "status"]).status, 0);
    const noFlowLog = path.join(noFlow, ".tmp", "logs", "no-flow.log");
    assert.match(getRuntimeLogWithoutAppending(noFlow, noFlowLog).stdout, /flow get status/);
  });

  it("R10: --log-file is removed from registry, help, source skills, generated skills, and tests", () => {
    const checked = [
      "src/flow/registry.js",
      "src/skills/sdd-forge.flow/SKILL.md",
      "src/skills/partials/core-principle.md",
    ];
    for (const rel of checked) {
      assert.doesNotMatch(readText(path.join(REPO_ROOT, rel)), /--log-file|logFile/, `${rel} must not mention --log-file`);
    }
    const testFiles = walkFiles(path.join(REPO_ROOT, "tests"))
      .filter((file) => /\.(js|md)$/.test(file));
    for (const file of testFiles) {
      assert.doesNotMatch(readText(file), /--log-file/, `${path.relative(REPO_ROOT, file)} must not test --log-file`);
    }
    const help = runCli(REPO_ROOT, ["flow", "run", "gate", "--help"]);
    assert.equal(help.status, 0, help.stderr);
    assert.doesNotMatch(`${help.stdout}\n${help.stderr}`, /--log-file|logFile/, "flow run gate help must not expose --log-file");
    const parserCwd = tmpProject("runtime-log-parser-");
    prepareFlow(parserCwd);
    const oldArg = runCli(parserCwd, ["flow", "run", "gate", "--phase", "draft", "--log-file", "runtime.log"]);
    assert.notEqual(oldArg.status, 0, "flow run command parser must reject removed --log-file option");
    assert.match(`${oldArg.stdout}\n${oldArg.stderr}`, /--log-file|ARGS_ERROR|Unexpected|unknown|unsupported/i);

    const cwd = tmpProject("runtime-log-upgrade-");
    const upgrade = runCli(cwd, ["upgrade"]);
    assert.equal(upgrade.status, 0, upgrade.stderr);
    for (const rel of [
      ".agents/skills/sdd-forge.flow/SKILL.md",
      ".claude/skills/sdd-forge.flow/SKILL.md",
    ]) {
      assert.doesNotMatch(readText(path.join(cwd, rel)), /--log-file|logFile/, `${rel} generated by upgrade must not mention --log-file`);
    }
  });

  it("R13: flow report show failures return through dispatcher and close runtime logs", () => {
    const cwd = tmpProject();
    const res = runCli(cwd, ["flow", "report", "show"]);
    assert.notEqual(res.status, 0, "missing report pointer should fail");
    const log = readText(path.join(cwd, ".tmp", "logs", "no-flow.log"));
    const block = runtimeLogBlockForCommand(log, "flow report show");
    assertClosedBlock(block, "flow report show");
    assertPrefixedOutput(block, "stderr");
    assert.match(block, /exitCode=1/);
  });
});
