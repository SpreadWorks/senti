// spec: R1 R2 R4 R6
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  ParsedCommand,
  processOutputLines,
  runProcessDetailed,
} from "../../../src/flow/lib/test-regression.js";
import * as testRegression from "../../../src/flow/lib/test-regression.js";

const fixture = fileURLToPath(new URL("./fixtures/child-process-scenario.js", import.meta.url));

function fixtureCommand(scenario) {
  return new ParsedCommand({
    argv: [process.execPath, fixture, scenario],
    source: "spec-local-tests",
  });
}

function requiredExport(name) {
  assert.equal(typeof testRegression[name], "function", `${name} must be exported`);
  return testRegression[name];
}

function assertDiagnosticFields(lines, result) {
  const expected = [
    `process.kind: ${result.kind}`,
    `process.command: ${result.command.join(" ")}`,
    `process.started: ${result.started}`,
    `process.completed: ${result.completed}`,
    `process.exitCode: ${result.exitCode}`,
    `process.signal: ${result.signal}`,
    `process.errorCode: ${result.errorCode}`,
    `process.timedOut: ${result.timedOut}`,
    `process.stdout.bytes: ${result.stdoutSummary.byteLength}`,
    `process.stdout.first: ${result.stdoutSummary.firstNonEmptyLine}`,
    `process.stdout.last: ${result.stdoutSummary.lastNonEmptyLine}`,
    `process.stderr.bytes: ${result.stderrSummary.byteLength}`,
    `process.stderr.first: ${result.stderrSummary.firstNonEmptyLine}`,
    `process.stderr.last: ${result.stderrSummary.lastNonEmptyLine}`,
  ];
  assert.deepEqual(lines.slice(0, expected.length), expected);
  const rawLines = [result.stdout, result.stderr]
    .flatMap((value) => value.split(/\r?\n/).filter(Boolean));
  assert.deepEqual(lines.slice(expected.length, expected.length + rawLines.length), rawLines);
  for (const legacyPrefix of ["spawnError:", "signal:", "timeout:", "exitCode:"]) {
    const legacyIndex = lines.findIndex((line) => line.startsWith(legacyPrefix));
    if (legacyIndex !== -1) assert.equal(legacyIndex >= expected.length + rawLines.length, true);
  }
}

test("R1: result model enforces kind and lifecycle invariants", () => {
  const ChildProcessExecutionResult = requiredExport("ChildProcessExecutionResult");
  const passed = {
    kind: "passed",
    command: ["node"],
    started: true,
    completed: true,
    exitCode: 0,
    signal: null,
    errorCode: null,
    timedOut: false,
    spawnError: null,
    stdout: "",
    stderr: "",
  };
  const invalid = [
    { name: "passed incomplete", value: { ...passed, completed: false } },
    { name: "passed signal", value: { ...passed, signal: "SIGKILL" } },
    { name: "empty command", value: { ...passed, command: [] } },
    { name: "non-string stdout", value: { ...passed, stdout: 1 } },
    { name: "non-string stderr", value: { ...passed, stderr: {} } },
    { name: "assertion zero", value: { ...passed, kind: "assertion-failure" } },
    {
      name: "spawn-error started",
      value: {
        ...passed,
        kind: "spawn-error",
        started: true,
        completed: false,
        exitCode: null,
        errorCode: "ENOENT",
        spawnError: "ENOENT",
      },
    },
    {
      name: "spawn-error missing detail",
      value: {
        ...passed,
        kind: "spawn-error",
        started: false,
        completed: false,
        exitCode: null,
        errorCode: "ENOENT",
        spawnError: null,
      },
    },
    {
      name: "signal missing signal",
      value: { ...passed, kind: "signal", completed: false, exitCode: null },
    },
    {
      name: "signal with spawn error detail",
      value: {
        ...passed,
        kind: "signal",
        completed: false,
        exitCode: null,
        signal: "SIGKILL",
        errorCode: "ENOENT",
        spawnError: "ENOENT",
      },
    },
    {
      name: "timeout flag false",
      value: { ...passed, kind: "timeout", completed: false, exitCode: null, signal: "SIGTERM" },
    },
    {
      name: "timeout with spawn error detail",
      value: {
        ...passed,
        kind: "timeout",
        completed: false,
        exitCode: null,
        timedOut: true,
        spawnError: "unexpected",
      },
    },
    {
      name: "max-buffer missing error code",
      value: { ...passed, kind: "max-buffer", completed: false, exitCode: null, signal: "SIGTERM" },
    },
    {
      name: "max-buffer marked timed out",
      value: {
        ...passed,
        kind: "max-buffer",
        completed: false,
        exitCode: null,
        errorCode: "ENOBUFS",
        timedOut: true,
        spawnError: "ENOBUFS",
      },
    },
  ];
  for (const scenario of invalid) {
    assert.throws(
      () => new ChildProcessExecutionResult(scenario.value),
      Error,
      scenario.name,
    );
  }
});

test("R2: stream summary reports UTF-8 bytes and edge non-empty lines", () => {
  const ProcessStreamSummary = requiredExport("ProcessStreamSummary");
  const summary = new ProcessStreamSummary("\nα\nmiddle\nω\n");
  assert.equal(summary.byteLength, Buffer.byteLength("\nα\nmiddle\nω\n", "utf8"));
  assert.equal(summary.firstNonEmptyLine, "α");
  assert.equal(summary.lastNonEmptyLine, "ω");
  assert.deepEqual({ ...new ProcessStreamSummary("") }, {
    byteLength: 0,
    firstNonEmptyLine: null,
    lastNonEmptyLine: null,
  });
});

test("R1: spawnSync ENOENT and ENOBUFS map to distinct primary causes", () => {
  const processResultFromSpawnSync = requiredExport("processResultFromSpawnSync");
  const enoent = processResultFromSpawnSync(["missing-command"], {
    status: null,
    signal: null,
    error: Object.assign(new Error("spawnSync missing-command ENOENT"), { code: "ENOENT" }),
    stdout: "",
    stderr: "",
  });
  assert.equal(enoent.kind, "spawn-error");
  assert.equal(enoent.started, false);
  assert.equal(enoent.completed, false);
  assert.equal(enoent.exitCode, null);
  assert.equal(enoent.errorCode, "ENOENT");

  const maxBuffer = processResultFromSpawnSync(["node", "--test"], {
    status: null,
    signal: "SIGTERM",
    error: Object.assign(new Error("spawnSync node ENOBUFS"), { code: "ENOBUFS" }),
    stdout: "x".repeat(128),
    stderr: "",
  });
  assert.equal(maxBuffer.kind, "max-buffer");
  assert.equal(maxBuffer.started, true);
  assert.equal(maxBuffer.completed, false);
  assert.equal(maxBuffer.errorCode, "ENOBUFS");
});

test("R1: timeout has precedence over simultaneous max-buffer evidence", () => {
  const processResultFromSpawnSync = requiredExport("processResultFromSpawnSync");
  const result = processResultFromSpawnSync(["node", "--test"], {
    status: null,
    signal: "SIGTERM",
    error: Object.assign(new Error("timed out after overflowing the buffer"), {
      code: "ENOBUFS",
      killed: true,
    }),
    stdout: "x".repeat(128),
    stderr: "",
  });
  assert.equal(result.kind, "timeout");
  assert.equal(result.timedOut, true);
  assert.equal(result.errorCode, "ENOBUFS");
});

test("R4: runProcessDetailed reports ENOENT without starting", async () => {
  const result = await runProcessDetailed({
    argv: ["senti-issue-444-command-that-does-not-exist"],
    env: {},
    source: "spec-local-tests",
  });
  assert.equal(result.kind, "spawn-error");
  assert.equal(result.started, false);
  assert.equal(result.completed, false);
  assert.equal(result.errorCode, "ENOENT");
  assertDiagnosticFields(processOutputLines(result), result);
});

test("R4: runProcessDetailed gives SIGKILL precedence over assertion-like output", async () => {
  const result = await runProcessDetailed(fixtureCommand("signal"));
  assert.equal(result.kind, "signal");
  assert.equal(result.started, true);
  assert.equal(result.completed, false);
  assert.equal(result.signal, "SIGKILL");
  assert.match(result.stdout, /not ok 1/);
  assertDiagnosticFields(processOutputLines(result), result);
});

test("R4: runProcessDetailed gives timeout precedence over its kill signal", async () => {
  const result = await runProcessDetailed(fixtureCommand("timeout"), { timeoutMs: 30 });
  assert.equal(result.kind, "timeout");
  assert.equal(result.started, true);
  assert.equal(result.completed, false);
  assert.equal(result.timedOut, true);
  assertDiagnosticFields(processOutputLines(result), result);
});

test("R4: runProcessDetailed preserves maxBuffer primary cause", async () => {
  const result = await runProcessDetailed(fixtureCommand("max-buffer"), { maxBuffer: 128 });
  assert.equal(result.kind, "max-buffer");
  assert.equal(result.started, true);
  assert.equal(result.completed, false);
  assert.equal(result.errorCode, "ERR_CHILD_PROCESS_STDIO_MAXBUFFER");
  assert.equal(result.stdoutSummary.byteLength > 0, true);
  assertDiagnosticFields(processOutputLines(result), result);
});

test("R6: assertion failure and happy path remain completed outcomes", async () => {
  const assertion = await runProcessDetailed(fixtureCommand("assertion-failure"));
  assert.equal(assertion.kind, "assertion-failure");
  assert.equal(assertion.started, true);
  assert.equal(assertion.completed, true);
  assert.equal(assertion.exitCode, 3);
  assert.match(assertion.stderr, /assertion detail/);

  const passed = await runProcessDetailed(fixtureCommand("passed"));
  assert.equal(passed.kind, "passed");
  assert.equal(passed.started, true);
  assert.equal(passed.completed, true);
  assert.equal(passed.exitCode, 0);
  assert.match(passed.stdout, /expected pass/);
});

test("R4: processOutputLines starts with typed metadata for every result kind", async () => {
  const processResultFromSpawnSync = requiredExport("processResultFromSpawnSync");
  const results = [
    processResultFromSpawnSync(["missing-command"], {
      status: null,
      signal: null,
      error: Object.assign(new Error("missing"), { code: "ENOENT" }),
      stdout: "",
      stderr: "",
    }),
    await runProcessDetailed(fixtureCommand("signal")),
    await runProcessDetailed(fixtureCommand("timeout"), { timeoutMs: 30 }),
    await runProcessDetailed(fixtureCommand("max-buffer"), { maxBuffer: 128 }),
    await runProcessDetailed(fixtureCommand("assertion-failure")),
    await runProcessDetailed(fixtureCommand("passed")),
  ];
  assert.deepEqual(results.map((result) => result.kind), [
    "spawn-error",
    "signal",
    "timeout",
    "max-buffer",
    "assertion-failure",
    "passed",
  ]);
  for (const result of results) {
    assertDiagnosticFields(processOutputLines(result), result);
  }
});
