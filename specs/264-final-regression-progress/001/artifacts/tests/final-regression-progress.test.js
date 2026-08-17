// spec: R1 R2 R3 R4 R5
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import RunFinalRegressionCommand, {
  FINAL_REGRESSION_HEARTBEAT_MS,
} from "../../../src/flow/lib/run-final-regression.js";
import { validateFinalRegressionResult } from "../../../src/flow/lib/test-artifacts.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../../tests/helpers/git-repo.js";

const SPEC_DIR = "specs/001-test";
const FIXTURE_PATH = "final-regression-fixture.sh";
const RAW_LOG = "specs/001-test/tests/.raw/final-regression-attempt-001.log";
const RESULT_PATH = "specs/001-test/final-regression-result.json";

function setupProject(tmp, scriptBody, extraFlowState = {}) {
  fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
  writeFile(tmp, `${SPEC_DIR}/spec.md`, "# Spec\n");
  writeFile(tmp, FIXTURE_PATH, scriptBody);
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  return {
    root: tmp,
    config: { test: { command: `sh ${FIXTURE_PATH}`, timeout: 5 } },
    flowState: {
      spec: `${SPEC_DIR}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      ...extraFlowState,
    },
    finalRegressionProgress: {
      heartbeatMs: 1000,
    },
  };
}

async function captureProcessStreams(fn, hooks = {}) {
  const originalStderrWrite = process.stderr.write;
  let stderr = "";
  process.stderr.write = function writeStderr(chunk, ...args) {
    stderr += String(chunk);
    if (hooks.onStderr) hooks.onStderr(stderr, String(chunk));
    if (typeof args.at(-1) === "function") args.at(-1)();
    return true;
  };
  try {
    const result = await fn();
    return { result, stderr };
  } finally {
    process.stderr.write = originalStderrWrite;
  }
}

function readFinalRegressionArtifact(tmp) {
  return validateFinalRegressionResult(JSON.parse(fs.readFileSync(path.join(tmp, RESULT_PATH), "utf8")));
}

function assertArtifactPathsInStderr(stderr) {
  assert.match(stderr, new RegExp(RESULT_PATH.replaceAll(".", "\\.")));
  assert.match(stderr, new RegExp(RAW_LOG.replaceAll(".", "\\.")));
}

describe("spec 264 final-regression progress", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R1: writes the discovered command to stderr before the child process starts", async () => {
    tmp = createTmpDir("spec-264-final-regression-command-");
    const marker = path.join(tmp, "progress-ready");
    const ctx = setupProject(tmp, [
      `[ -f ${JSON.stringify(marker)} ] || { printf '%s\\n' 'progress missing before start' >&2; exit 42; }`,
      "sleep 0.05",
      "printf '%s\\n' done",
      "",
    ].join("\n"));

    const { result, stderr } = await captureProcessStreams(
      () => new RunFinalRegressionCommand().execute(ctx),
      {
        onStderr(output) {
          if (output.includes("command: sh final-regression-fixture.sh")) {
            fs.writeFileSync(marker, "ready\n");
          }
        },
      },
    );

    assert.equal(result.result, "pass");
    assert.match(stderr, /command: sh final-regression-fixture\.sh/);
  });

  it("R2: writes the raw log path to stderr before the child process starts", async () => {
    tmp = createTmpDir("spec-264-final-regression-raw-path-");
    const marker = path.join(tmp, "progress-ready");
    const ctx = setupProject(tmp, [
      `[ -f ${JSON.stringify(marker)} ] || { printf '%s\\n' 'raw path missing before start' >&2; exit 42; }`,
      "sleep 0.05",
      "printf '%s\\n' done",
      "",
    ].join("\n"));

    const { result, stderr } = await captureProcessStreams(
      () => new RunFinalRegressionCommand().execute(ctx),
      {
        onStderr(output) {
          if (output.includes(RAW_LOG)) {
            fs.writeFileSync(marker, "ready\n");
          }
        },
      },
    );

    assert.equal(result.result, "pass");
    assert.match(stderr, new RegExp(RAW_LOG.replaceAll(".", "\\.")));
  });

  it("R3: emits elapsed-time heartbeat messages to stderr while the process is running", async () => {
    assert.equal(FINAL_REGRESSION_HEARTBEAT_MS, 30_000);
    tmp = createTmpDir("spec-264-final-regression-heartbeat-");
    const started = path.join(tmp, "child-started");
    const marker = path.join(tmp, "heartbeat-seen");
    const ctx = setupProject(tmp, [
      `printf '%s\\n' started > ${JSON.stringify(started)}`,
      "i=0",
      `while [ ! -f ${JSON.stringify(marker)} ] && [ $i -lt 300 ]; do`,
      "  i=$((i + 1))",
      "  sleep 0.01",
      "done",
      `[ -f ${JSON.stringify(marker)} ] || { printf '%s\\n' 'heartbeat missing while running' >&2; exit 43; }`,
      "printf '%s\\n' done",
      "",
    ].join("\n"));
    let elapsedCount = 0;

    const { result, stderr } = await captureProcessStreams(
      () => new RunFinalRegressionCommand().execute(ctx),
      {
        onStderr(output, chunk) {
          if (fs.existsSync(started) && /elapsed/i.test(chunk)) elapsedCount += 1;
          if (elapsedCount >= 2 && !fs.existsSync(marker)) {
            fs.writeFileSync(marker, "ready\n");
          }
        },
      },
    );

    const heartbeatMatches = stderr.match(/elapsed/ig) || [];
    assert.equal(result.result, "pass");
    assert.ok(heartbeatMatches.length >= 2, `expected at least two heartbeat lines, got stderr:\n${stderr}`);
  });

  it("R4: prints result and raw artifact paths for process failures", async () => {
    tmp = createTmpDir("spec-264-final-regression-failure-links-");
    const ctx = setupProject(tmp, "printf '%s\\n' 'boom' >&2\nexit 1\n");

    const { stderr } = await captureProcessStreams(() => new RunFinalRegressionCommand().execute(ctx));

    assertArtifactPathsInStderr(stderr);
  });

  it("R4: prints result and raw artifact paths for discovery errors", async () => {
    tmp = createTmpDir("spec-264-final-regression-discovery-error-");
    const ctx = setupProject(tmp, "printf '%s\\n' SHOULD_NOT_RUN\n");
    ctx.config = {};

    const { stderr } = await captureProcessStreams(() => new RunFinalRegressionCommand().execute(ctx));

    assertArtifactPathsInStderr(stderr);
  });

  it("R4: prints result and raw artifact paths for worktree root mismatch failures", async () => {
    tmp = createTmpDir("spec-264-final-regression-root-mismatch-");
    const ctx = setupProject(tmp, "printf '%s\\n' SHOULD_NOT_RUN\n", {
      worktree: true,
      worktreePath: path.join(tmp, "different-active-worktree"),
    });
    fs.mkdirSync(ctx.flowState.worktreePath, { recursive: true });

    const { stderr } = await captureProcessStreams(() => new RunFinalRegressionCommand().execute(ctx));

    assertArtifactPathsInStderr(stderr);
  });

  it("R5: preserves final-regression artifact and envelope fields", async () => {
    tmp = createTmpDir("spec-264-final-regression-artifact-contract-");
    const ctx = setupProject(tmp, "printf '%s\\n' done\n");

    const { result } = await captureProcessStreams(() => new RunFinalRegressionCommand().execute(ctx));
    const artifact = readFinalRegressionArtifact(tmp);

    assert.equal(RunFinalRegressionCommand.outputMode, "envelope");
    assert.equal(result.artifacts.result_path, RESULT_PATH);
    assert.equal(result.artifacts.raw_output_path, RAW_LOG);
    assert.equal(artifact.rawOutputPath, RAW_LOG);
    assert.equal(artifact.nextAction, "finalize-commit");
    assert.equal(artifact.retryable, false);
  });

  it("R5: preserves final-regression failure classification and envelope semantics", async () => {
    tmp = createTmpDir("spec-264-final-regression-failure-contract-");
    const ctx = setupProject(tmp, "printf '%s\\n' 'existing failure' >&2\nexit 1\n");

    const { result } = await captureProcessStreams(() => new RunFinalRegressionCommand().execute(ctx));
    const artifact = readFinalRegressionArtifact(tmp);

    assert.equal(RunFinalRegressionCommand.outputMode, "envelope");
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FINAL_REGRESSION_FAILED");
    assert.equal(result.data.failureKind, "unattributed_existing_failure");
    assert.equal(result.data.nextAction, "user-confirmation");
    assert.equal(result.data.retryable, false);
    assert.equal(artifact.failureKind, "unattributed_existing_failure");
    assert.equal(artifact.nextAction, "user-confirmation");
    assert.equal(artifact.retryable, false);
    assert.equal(artifact.rawOutputPath, RAW_LOG);
  });
});
