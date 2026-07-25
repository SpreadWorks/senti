// spec: R5 R6 R7 R8
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { validateFinalRegressionResult } from "../../../src/flow/lib/test-artifacts.js";
import * as testRegression from "../../../src/flow/lib/test-regression.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";
import { commitAll, initGitRepo } from "../../../tests/helpers/git-repo.js";

const SPEC_DIR = "specs/001-test";

function requiredExport(name) {
  assert.equal(typeof testRegression[name], "function", `${name} must be exported`);
  return testRegression[name];
}

function setupProject(tmp, fixtureBody, { autoApprove = false } = {}) {
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  writeFile(tmp, `${SPEC_DIR}/spec.md`, "# Spec\n");
  writeFile(tmp, "nested-fixture.mjs", fixtureBody);
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  return {
    root: tmp,
    config: { test: { command: "node nested-fixture.mjs", timeout: 5 } },
    flowState: {
      spec: `${SPEC_DIR}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      autoApprove,
    },
  };
}

function readArtifact(tmp) {
  return JSON.parse(fs.readFileSync(
    path.join(tmp, SPEC_DIR, "final-regression-result.json"),
    "utf8",
  ));
}

function readIssueLog(tmp) {
  return JSON.parse(fs.readFileSync(
    path.join(tmp, SPEC_DIR, "issue-log.json"),
    "utf8",
  ));
}

function encodedRecord({
  status = 1,
  signal = null,
  error = null,
  stdout = "",
  stderr = "",
  captureLimitBytes = 64,
} = {}) {
  const Codec = requiredExport("ChildProcessExecutionRecordCodec");
  const result = testRegression.processResultFromSpawnSync(
    ["node", "--test", "tests/unit/nested.test.js"],
    { status, signal, error, stdout, stderr },
    { captureLimitBytes },
  );
  return new Codec().encode(result);
}

function fixturePrinting(line, { counter = false } = {}) {
  return [
    "import fs from 'node:fs';",
    ...(counter ? [
      "const counter = 'invocation-count.txt';",
      "const value = fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0;",
      "fs.writeFileSync(counter, String(value + 1));",
    ] : []),
    `process.stderr.write(${JSON.stringify(line)} + '\\n');`,
    "process.exitCode = 1;",
    "",
  ].join("\n");
}

let tmp;
afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

test("R5: final artifact and raw log preserve the nested typed record", async () => {
  const marker = encodedRecord({ status: 9, stderr: "" });
  tmp = createTmpDir("spec-340-final-record-");
  const ctx = setupProject(tmp, fixturePrinting(marker));
  writeFile(tmp, "src/current-change.js", "export const changed = true;\n");

  await new RunFinalRegressionCommand().execute(ctx);

  const artifact = readArtifact(tmp);
  assert.equal(artifact.childProcesses.length, 1);
  const child = artifact.childProcesses[0];
  assert.equal(child.kind, "nonzero-exit");
  assert.deepEqual(child.command, ["node", "--test", "tests/unit/nested.test.js"]);
  assert.equal(child.started, true);
  assert.equal(child.completed, true);
  assert.equal(child.exitCode, 9);
  assert.equal(child.signal, null);
  assert.equal(child.errorCode, null);
  assert.equal(child.timedOut, false);
  assert.equal(child.stdout.truncated, false);
  assert.equal(child.stderr.truncated, false);
  assert.equal(child.rawOutputPath, artifact.rawOutputPath);
  assert.equal(artifact.failureKind, "unattributed_unknown_failure");
  assert.equal(artifact.currentDiffRelationship, "unknown");
  const raw = fs.readFileSync(path.join(tmp, artifact.rawOutputPath), "utf8");
  assert.match(raw, /child process execution record/);
  assert.match(raw, /nonzero-exit/);
});

test("R6: unsupported assertion and attribution become a non-proceed unknown failure", async () => {
  const marker = encodedRecord({ status: 4 });
  tmp = createTmpDir("spec-340-final-unknown-");
  const ctx = setupProject(tmp, fixturePrinting(marker), { autoApprove: true });
  writeFile(tmp, "src/unrelated-current-change.js", "export const changed = true;\n");

  const envelope = await new RunFinalRegressionCommand().execute(ctx);
  const artifact = readArtifact(tmp);

  assert.equal(envelope.ok, false);
  assert.equal(artifact.failureKind, "unattributed_unknown_failure");
  assert.notEqual(artifact.failureNature, "assertion");
  assert.notEqual(artifact.failureCategory, "existing_failure");
  assert.equal(artifact.recordAndProceed.eligible, false);
  assert.notEqual(artifact.selectedAction, "record-and-proceed");
  assert.equal(artifact.nextAction, "stop");
});

test("R7: pass behavior and outer invocation count remain unchanged", async () => {
  tmp = createTmpDir("spec-340-final-parity-");
  const ctx = setupProject(tmp, [
    "import fs from 'node:fs';",
    "const counter = 'invocation-count.txt';",
    "const value = fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0;",
    "fs.writeFileSync(counter, String(value + 1));",
    "process.stdout.write('final pass\\n');",
    "",
  ].join("\n"));

  const result = await new RunFinalRegressionCommand().execute(ctx);
  const artifact = readArtifact(tmp);

  assert.equal(result.result, "pass");
  assert.equal(result.next, "report");
  assert.equal(artifact.completed, true);
  assert.equal(artifact.result, "pass");
  assert.equal(artifact.nextAction, "report");
  assert.equal(fs.readFileSync(path.join(tmp, "invocation-count.txt"), "utf8"), "1");
});

test("R7: malformed marker-like output cannot intercept a passing envelope", async () => {
  tmp = createTmpDir("spec-340-final-pass-malformed-marker-");
  const ctx = setupProject(tmp, [
    "process.stdout.write('[senti] child process execution record {\\n');",
    "process.stdout.write('pass payload\\n');",
    "",
  ].join("\n"));

  const result = await new RunFinalRegressionCommand().execute(ctx);
  const artifact = readArtifact(tmp);

  assert.equal(result.result, "pass");
  assert.equal(result.next, "report");
  assert.equal(artifact.result, "pass");
  assert.equal(artifact.failureKind, null);
  assert.deepEqual(artifact.childProcesses, []);
  assert.equal(artifact.nextAction, "report");
});

test("R7: current-change failure keeps one repair retry and issue-log side effects", async () => {
  const marker = encodedRecord({
    status: 1,
    stderr: "src/current-change.js failed\n",
  });
  tmp = createTmpDir("spec-340-final-retry-");
  const ctx = setupProject(tmp, fixturePrinting(marker, { counter: true }));
  writeFile(tmp, "src/current-change.js", "export const changed = true;\n");

  const result = await new RunFinalRegressionCommand().execute(ctx);
  const artifact = readArtifact(tmp);
  const issueLog = readIssueLog(tmp);

  assert.equal(result.ok, false);
  assert.equal(artifact.failureKind, "caused_by_current_change");
  assert.equal(artifact.retryable, true);
  assert.equal(artifact.nextAction, "regression-repair");
  assert.equal(issueLog.entries.at(-1).step, "final-regression");
  assert.equal(issueLog.entries.at(-1).failureKind, "caused_by_current_change");
  assert.equal(fs.readFileSync(path.join(tmp, "invocation-count.txt"), "utf8"), "1");
});

test("R7: docs-only changes keep the skipped report route without running the command", async () => {
  tmp = createTmpDir("spec-340-final-skip-");
  const ctx = setupProject(tmp, [
    "import fs from 'node:fs';",
    "fs.writeFileSync('should-not-run.txt', 'ran');",
    "process.exitCode = 1;",
    "",
  ].join("\n"));
  writeFile(tmp, "docs/change.md", "# docs-only\n");

  const result = await new RunFinalRegressionCommand().execute(ctx);
  const artifact = readArtifact(tmp);

  assert.equal(result.result, "skipped");
  assert.equal(result.next, "report");
  assert.equal(artifact.result, "skipped");
  assert.equal(artifact.completed, true);
  assert.equal(artifact.nextAction, "report");
  assert.equal(fs.existsSync(path.join(tmp, "should-not-run.txt")), false);
});

test("R7: concrete unchanged assertion evidence keeps record-and-proceed display", async () => {
  const marker = encodedRecord({
    status: 1,
    stdout: "not ok 1 - existing test\n",
    stderr: "tests/unit/existing.test.js\ncode: ERR_ASSERTION\n",
  });
  tmp = createTmpDir("spec-340-final-existing-");
  const ctx = setupProject(tmp, fixturePrinting(marker, { counter: true }), {
    autoApprove: true,
  });
  writeFile(tmp, "src/unrelated-current-change.js", "export const changed = true;\n");

  const command = new RunFinalRegressionCommand();
  const first = await command.execute(ctx);
  const firstArtifact = readArtifact(tmp);

  assert.equal(first.ok, false);
  assert.equal(firstArtifact.nextAction, "user-confirmation");
  assert.equal(firstArtifact.nextRecommendedAction, "fix-and-rerun");
  writeFile(tmp, "src/unrelated-current-change.js", "export const changed = false;\n");

  const result = await command.execute(ctx);
  const artifact = readArtifact(tmp);

  assert.equal(result.result, "fail");
  assert.equal(result.failedRecorded, true);
  assert.equal(result.next, "report");
  assert.equal(artifact.failureCategory, "existing_failure");
  assert.equal(artifact.failureNature, "assertion");
  assert.equal(artifact.completed, true);
  assert.equal(artifact.selectedAction, "record-and-proceed");
  assert.equal(artifact.recordAndProceed.validated, true);
  assert.equal(artifact.nextAction, "report");
  assert.equal(fs.readFileSync(path.join(tmp, "invocation-count.txt"), "utf8"), "2");
});

test("R7: config-derived timeout keeps timeout recovery and one issue-log record", async () => {
  tmp = createTmpDir("spec-340-final-timeout-");
  const ctx = setupProject(tmp, "setTimeout(() => {}, 5000);\n");
  ctx.config.test.timeout = 0.02;
  writeFile(tmp, "src/current-change.js", "export const changed = true;\n");

  const result = await new RunFinalRegressionCommand().execute(ctx);
  const artifact = readArtifact(tmp);
  const issueLog = readIssueLog(tmp);

  assert.equal(result.ok, false);
  assert.equal(artifact.failureKind, "timeout");
  assert.equal(artifact.process.timedOut, true);
  assert.equal(artifact.nextAction, "stop");
  assert.equal(issueLog.entries.length, 1);
  assert.equal(issueLog.entries[0].failureKind, "timeout");
});

test("R8: truncated nested evidence keeps exact metadata and a durable raw reference", async () => {
  const marker = encodedRecord({
    status: 2,
    stdout: "αβγδεζηθ",
    captureLimitBytes: 8,
  });
  tmp = createTmpDir("spec-340-final-truncated-");
  const ctx = setupProject(tmp, fixturePrinting(marker, { counter: true }));
  writeFile(tmp, "src/current-change.js", "export const changed = true;\n");

  await new RunFinalRegressionCommand().execute(ctx);
  const artifact = readArtifact(tmp);
  const stream = artifact.childProcesses[0].stdout;

  assert.equal(stream.originalByteLength, 16);
  assert.equal(stream.capturedByteLength <= 8, true);
  assert.equal(stream.truncated, true);
  assert.equal(stream.rawOutputPath, artifact.rawOutputPath);
  assert.equal(artifact.childProcesses[0].rawOutputPath, artifact.rawOutputPath);
  assert.equal(fs.existsSync(path.join(tmp, artifact.rawOutputPath)), true);
  assert.equal(fs.readFileSync(path.join(tmp, "invocation-count.txt"), "utf8"), "1");

  delete stream.rawOutputPath;
  assert.throws(
    () => validateFinalRegressionResult(artifact),
    /stdout\.rawOutputPath must reference final-regression rawOutputPath when truncated/,
  );
});

test("R8: typed timeout signal spawn-error and max-buffer records drive classification without reruns", async () => {
  const cases = [
    {
      name: "timeout",
      marker: encodedRecord({
        status: null,
        error: Object.assign(new Error("nested command timed out"), {
          code: "ETIMEDOUT",
          killed: true,
        }),
      }),
      childKind: "timeout",
      failureKind: "timeout",
    },
    {
      name: "signal",
      marker: encodedRecord({ status: null, signal: "SIGTERM" }),
      childKind: "signal",
      failureKind: "infra_failure",
    },
    {
      name: "spawn-error",
      marker: encodedRecord({
        status: null,
        error: Object.assign(new Error("spawn node ENOENT"), { code: "ENOENT" }),
      }),
      childKind: "spawn-error",
      failureKind: "dependency_failure",
    },
    {
      name: "max-buffer",
      marker: encodedRecord({
        status: null,
        error: Object.assign(new Error("stdout maxBuffer length exceeded"), {
          code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
        }),
      }),
      childKind: "max-buffer",
      failureKind: "infra_failure",
    },
  ];
  const projects = [];
  try {
    for (const entry of cases) {
      const project = createTmpDir(`spec-340-final-${entry.name}-`);
      projects.push(project);
      const ctx = setupProject(project, fixturePrinting(entry.marker, { counter: true }));
      writeFile(project, "src/current-change.js", "export const changed = true;\n");

      await new RunFinalRegressionCommand().execute(ctx);

      const artifact = readArtifact(project);
      assert.equal(artifact.childProcesses[0].kind, entry.childKind);
      assert.equal(artifact.failureKind, entry.failureKind);
      assert.equal(
        fs.readFileSync(path.join(project, "invocation-count.txt"), "utf8"),
        "1",
      );
    }
  } finally {
    for (const project of projects) removeTmpDir(project);
  }
});

test("R8: final artifact rejects child-process count overflow", async () => {
  tmp = createTmpDir("spec-340-final-child-count-");
  const marker = encodedRecord({ status: null, signal: "SIGTERM" });
  const ctx = setupProject(tmp, fixturePrinting(marker));
  writeFile(tmp, "src/current-change.js", "export const changed = true;\n");

  await new RunFinalRegressionCommand().execute(ctx);

  const artifact = readArtifact(tmp);
  artifact.childProcesses = Array.from(
    { length: 129 },
    () => ({ ...artifact.childProcesses[0] }),
  );
  assert.throws(
    () => validateFinalRegressionResult(artifact),
    /childProcesses\[\] exceeds 128 entries/,
  );
});

test("R8: malformed marker fails closed and preserves decoder evidence without reruns", async () => {
  tmp = createTmpDir("spec-340-final-malformed-");
  const malformed = "[senti] child process execution record {";
  const ctx = setupProject(tmp, fixturePrinting(malformed, { counter: true }));
  writeFile(tmp, "src/current-change.js", "export const changed = true;\n");

  await new RunFinalRegressionCommand().execute(ctx);

  const artifact = readArtifact(tmp);
  const raw = fs.readFileSync(path.join(tmp, artifact.rawOutputPath), "utf8");
  assert.equal(artifact.failureKind, "infra_failure");
  assert.deepEqual(artifact.childProcesses, []);
  assert.match(raw, /childRecordError:/);
  assert.equal(fs.readFileSync(path.join(tmp, "invocation-count.txt"), "utf8"), "1");
});

test("R8: absent marker fails closed as unknown and keeps one invocation", async () => {
  tmp = createTmpDir("spec-340-final-absent-");
  const ctx = setupProject(tmp, fixturePrinting(
    "not ok 1 - existing test\\ntests/unit/existing.test.js\\ncode: ERR_ASSERTION",
    { counter: true },
  ), { autoApprove: true });
  writeFile(tmp, "src/unrelated-current-change.js", "export const changed = true;\n");

  await new RunFinalRegressionCommand().execute(ctx);

  const artifact = readArtifact(tmp);
  assert.deepEqual(artifact.childProcesses, []);
  assert.equal(artifact.failureKind, "unattributed_unknown_failure");
  assert.equal(artifact.failureNature, "execution");
  assert.notEqual(artifact.selectedAction, "record-and-proceed");
  assert.equal(artifact.nextAction, "stop");
  assert.equal(fs.readFileSync(path.join(tmp, "invocation-count.txt"), "utf8"), "1");
});

test("R8: retained surface matrix uses production pass skip retry and proceed routes", async () => {
  const projects = [];
  try {
    const passing = createTmpDir("spec-340-parity-pass-");
    projects.push(passing);
    const passResult = await new RunFinalRegressionCommand().execute(setupProject(
      passing,
      "process.stdout.write('pass\\n');\n",
    ));
    assert.deepEqual(
      { result: passResult.result, next: passResult.next },
      { result: "pass", next: "report" },
    );

    const skipped = createTmpDir("spec-340-parity-skip-");
    projects.push(skipped);
    const skipCtx = setupProject(skipped, "process.exitCode = 1;\n");
    writeFile(skipped, "docs/change.md", "# docs-only\n");
    const skipResult = await new RunFinalRegressionCommand().execute(skipCtx);
    assert.deepEqual(
      { result: skipResult.result, next: skipResult.next },
      { result: "skipped", next: "report" },
    );

    const retry = createTmpDir("spec-340-parity-retry-");
    projects.push(retry);
    const retryMarker = encodedRecord({
      status: 1,
      stderr: "src/current-change.js failed\n",
    });
    const retryCtx = setupProject(retry, fixturePrinting(retryMarker));
    writeFile(retry, "src/current-change.js", "export const changed = true;\n");
    await new RunFinalRegressionCommand().execute(retryCtx);
    const retryArtifact = readArtifact(retry);
    assert.deepEqual(
      { retryable: retryArtifact.retryable, nextAction: retryArtifact.nextAction },
      { retryable: true, nextAction: "regression-repair" },
    );

    const proceed = createTmpDir("spec-340-parity-proceed-");
    projects.push(proceed);
    const proceedMarker = encodedRecord({
      status: 1,
      stdout: "not ok 1 - existing test\n",
      stderr: "tests/unit/existing.test.js\ncode: ERR_ASSERTION\n",
    });
    const proceedCtx = setupProject(proceed, fixturePrinting(proceedMarker), {
      autoApprove: true,
    });
    writeFile(proceed, "src/unrelated.js", "export const changed = true;\n");
    const proceedCommand = new RunFinalRegressionCommand();
    const firstProceedResult = await proceedCommand.execute(proceedCtx);
    assert.equal(firstProceedResult.ok, false);
    writeFile(proceed, "src/unrelated.js", "export const changed = false;\n");
    const proceedResult = await proceedCommand.execute(proceedCtx);
    assert.deepEqual(
      {
        result: proceedResult.result,
        failedRecorded: proceedResult.failedRecorded,
        next: proceedResult.next,
      },
      { result: "fail", failedRecorded: true, next: "report" },
    );
  } finally {
    for (const project of projects) removeTmpDir(project);
  }
});
