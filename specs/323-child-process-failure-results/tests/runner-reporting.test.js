// spec: R3 R5 R6
import assert from "node:assert/strict";
import { test } from "node:test";

const oneUnitFile = ["tests/unit/issue-444-fixture.test.js"];
let defaultRunnerPromise;

async function loadDefaultRunner() {
  if (!defaultRunnerPromise) {
    const originalArgv = process.argv;
    process.argv = [process.execPath, "tests/run.js", "--help"];
    defaultRunnerPromise = import("../../../tests/run.js")
      .finally(() => {
        process.argv = originalArgv;
      });
  }
  return defaultRunnerPromise;
}

async function runWithResults(results, files = oneUnitFile) {
  const defaultRunner = await loadDefaultRunner();
  assert.equal(typeof defaultRunner.executeFiles, "function", "executeFiles must be exported");
  let stdout = "";
  let stderr = "";
  const remaining = [...results];
  const exitCode = defaultRunner.executeFiles(files, {
    spawn: () => {
      assert.equal(remaining.length > 0, true, "unexpected extra category spawn");
      return remaining.shift();
    },
    write: (fd, value) => {
      if (fd === 1) stdout += String(value);
      else stderr += String(value);
    },
  });
  assert.equal(remaining.length, 0, "every planned category result must be consumed");
  return { exitCode, stdout, stderr };
}

function runWithResult(result) {
  return runWithResults([result]);
}

test("R3: ENOENT is typed and omitted from numeric PASS aggregation", async () => {
  const result = await runWithResult({
    status: null,
    signal: null,
    error: Object.assign(new Error("spawnSync node ENOENT"), { code: "ENOENT" }),
    stdout: "",
    stderr: "",
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.stdout, /unit: not completed/);
  assert.doesNotMatch(result.stdout, /unit: 0/);
  assert.match(result.stderr, /process\.kind: spawn-error/);
  assert.match(result.stderr, /process\.command: node --test/);
  assert.match(result.stderr, /process\.errorCode: ENOENT/);
});

test("R3: signal timeout and max-buffer each produce one typed incomplete result", async () => {
  const cases = [
    [{ status: null, signal: "SIGKILL", error: null, stdout: "not ok 1 - partial\n", stderr: "" }, "signal"],
    [{ status: null, signal: "SIGTERM", error: Object.assign(new Error("timed out"), { code: "ETIMEDOUT", killed: true }), stdout: "", stderr: "" }, "timeout"],
    [{ status: null, signal: "SIGTERM", error: Object.assign(new Error("max buffer"), { code: "ENOBUFS" }), stdout: "x".repeat(128), stderr: "" }, "max-buffer"],
  ];
  for (const [spawnResult, kind] of cases) {
    const result = await runWithResult(spawnResult);
    assert.equal(result.exitCode, 1);
    assert.match(result.stdout, /unit: not completed/);
    assert.match(result.stderr, new RegExp(`process\\.kind: ${kind}`));
    assert.equal(result.stderr.match(/process\.kind:/g)?.length, 1);
  }
});

test("R3: multiple completed failures return the first numeric non-zero code", async () => {
  const result = await runWithResults([
    { status: 2, signal: null, error: null, stdout: "# pass 1\n", stderr: "unit failed\n" },
    { status: 7, signal: null, error: null, stdout: "# pass 3\n", stderr: "integration failed\n" },
  ], [
    "tests/unit/issue-444-unit.test.js",
    "tests/e2e/issue-444-integration.test.js",
  ]);
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /unit: 1/);
  assert.match(result.stdout, /integration: 3/);
});

test("R5: completed assertion failure retains output count and numeric exit code", async () => {
  const result = await runWithResult({
    status: 2,
    signal: null,
    error: null,
    stdout: "TAP version 13\n# pass 4\n# fail 1\n",
    stderr: "assertion detail\n",
  });
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /# pass 4/);
  assert.match(result.stdout, /unit: 4/);
  assert.match(result.stderr, /assertion detail/);
  assert.match(result.stderr, /process\.kind: assertion-failure/);
});

test("R5: happy path preserves existing forwarded output and summary bytes", async () => {
  const result = await runWithResult({
    status: 0,
    signal: null,
    error: null,
    stdout: "TAP version 13\n# pass 2\n",
    stderr: "",
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    "TAP version 13\n# pass 2\n\nunit: 2\nintegration: 0\nacceptance: 0\n",
  );
});

test("R6: every runner failure diagnostic includes all required field names", async () => {
  const result = await runWithResult({
    status: null,
    signal: "SIGKILL",
    error: null,
    stdout: "partial output\n",
    stderr: "partial error\n",
  });
  for (const field of [
    "kind",
    "command",
    "started",
    "completed",
    "exitCode",
    "signal",
    "errorCode",
    "timedOut",
    "stdout.bytes",
    "stdout.first",
    "stdout.last",
    "stderr.bytes",
    "stderr.first",
    "stderr.last",
  ]) {
    assert.match(result.stderr, new RegExp(`process\\.${field}:`));
  }
});
