// spec: R1 R2 R3 R4
import assert from "node:assert/strict";
import { test } from "node:test";
import { executeFiles } from "../../../tests/run.js";
import * as testRegression from "../../../src/flow/lib/test-regression.js";

function requiredExport(name) {
  assert.equal(typeof testRegression[name], "function", `${name} must be exported`);
  return testRegression[name];
}

function spawnResult({
  status = 0,
  signal = null,
  error = null,
  stdout = "",
  stderr = "",
} = {}) {
  return { status, signal, error, stdout, stderr };
}

test("R1: every child result serializes lifecycle termination and bounded stream fields", () => {
  const result = testRegression.processResultFromSpawnSync(
    ["node", "--test", "tests/unit/example.test.js"],
    spawnResult({ stdout: "# pass 1\n" }),
    { captureLimitBytes: 64 },
  );

  const json = result.toJSON();
  assert.deepEqual(json.command, ["node", "--test", "tests/unit/example.test.js"]);
  assert.equal(json.kind, "passed");
  assert.equal(json.started, true);
  assert.equal(json.completed, true);
  assert.equal(json.exitCode, 0);
  assert.equal(json.signal, null);
  assert.equal(json.errorCode, null);
  assert.equal(json.timedOut, false);
  assert.equal(json.spawnError, null);
  for (const stream of [json.stdout, json.stderr]) {
    assert.equal(typeof stream.content, "string");
    assert.equal(Number.isInteger(stream.originalByteLength), true);
    assert.equal(Number.isInteger(stream.capturedByteLength), true);
    assert.equal(typeof stream.truncated, "boolean");
  }
});

test("R2: numeric exits require assertion evidence before using assertion-failure", () => {
  const silent = testRegression.processResultFromSpawnSync(
    ["node", "--test"],
    spawnResult({ status: 2 }),
  );
  assert.equal(silent.kind, "nonzero-exit");

  const generic = testRegression.processResultFromSpawnSync(
    ["node", "--test"],
    spawnResult({ status: 3, stderr: "command failed\n" }),
  );
  assert.equal(generic.kind, "nonzero-exit");

  const assertion = testRegression.processResultFromSpawnSync(
    ["node", "--test"],
    spawnResult({
      status: 1,
      stdout: "not ok 1 - preserves child evidence\n",
      stderr: "code: ERR_ASSERTION\n",
    }),
  );
  assert.equal(assertion.kind, "assertion-failure");

  const truncatedPrefix = testRegression.processResultFromSpawnSync(
    ["node", "--test"],
    spawnResult({
      status: 1,
      stderr: `${"diagnostic noise ".repeat(20)}ERR_ASSERTION: late evidence`,
    }),
    { captureLimitBytes: 32 },
  );
  assert.equal(truncatedPrefix.kind, "assertion-failure");
  assert.match(truncatedPrefix.toJSON().stderr.content, /ERR_ASSERTION/);
  assert.equal(truncatedPrefix.toJSON().stderr.capturedByteLength <= 32, true);
});

test("R2: signal timeout spawn-error and max-buffer keep distinct invariants", () => {
  const cases = [
    [
      spawnResult({ status: null, signal: "SIGKILL" }),
      "signal",
    ],
    [
      spawnResult({
        status: null,
        signal: "SIGTERM",
        error: Object.assign(new Error("timed out"), { code: "ETIMEDOUT", killed: true }),
      }),
      "timeout",
    ],
    [
      spawnResult({
        status: null,
        error: Object.assign(new Error("missing"), { code: "ENOENT" }),
      }),
      "spawn-error",
    ],
    [
      spawnResult({
        status: null,
        signal: "SIGTERM",
        error: Object.assign(new Error("buffer exceeded"), { code: "ENOBUFS" }),
      }),
      "max-buffer",
    ],
  ];

  for (const [input, expected] of cases) {
    assert.equal(
      testRegression.processResultFromSpawnSync(["node", "--test"], input).kind,
      expected,
    );
  }

  const spawnError = testRegression.processResultFromSpawnSync(
    ["missing-node", "--test"],
    spawnResult({
      status: null,
      error: Object.assign(new Error("missing"), { code: "ENOENT" }),
    }),
  ).toJSON();
  assert.equal(spawnError.kind, "spawn-error");
  assert.equal(spawnError.started, false);
  assert.equal(spawnError.completed, false);
});

test("R3: UTF-8 stream capture is byte-bounded and reports truncation metadata", () => {
  const result = testRegression.processResultFromSpawnSync(
    ["node", "--test"],
    spawnResult({ stdout: "αβγ" }),
    { captureLimitBytes: 5 },
  );
  const stream = result.toJSON().stdout;

  assert.equal(stream.originalByteLength, 6);
  assert.equal(stream.capturedByteLength <= 5, true);
  assert.equal(Buffer.byteLength(stream.content, "utf8"), stream.capturedByteLength);
  assert.equal(stream.content, "αβ");
  assert.equal(stream.truncated, true);
});

test("R3: diagnostic record codec round-trips bounded typed records", () => {
  const Codec = requiredExport("ChildProcessExecutionRecordCodec");
  const codec = new Codec();
  const result = testRegression.processResultFromSpawnSync(
    ["node", "--test"],
    spawnResult({ status: 7, stderr: "generic failure\n" }),
    { captureLimitBytes: 8 },
  );

  const line = codec.encode(result);
  const decoded = codec.decodeAll(`noise\n${line}\nmore noise\n`);
  assert.equal(decoded.length, 1);
  assert.deepEqual(decoded[0].toJSON(), result.toJSON());
});

test("R8: diagnostic record codec rejects record-count overflow", () => {
  const Codec = requiredExport("ChildProcessExecutionRecordCodec");
  const line = new Codec().encode(testRegression.processResultFromSpawnSync(
    ["node", "--test"],
    spawnResult(),
  ));

  assert.throws(
    () => new Codec({ recordLimit: 1 }).decodeAll(`${line}\n${line}`),
    /record count exceeds 1/,
  );
});

test("R8: diagnostic record codec rejects marker line-byte overflow", () => {
  const Codec = requiredExport("ChildProcessExecutionRecordCodec");
  const line = new Codec().encode(testRegression.processResultFromSpawnSync(
    ["node", "--test"],
    spawnResult({ stdout: "bounded payload" }),
  ));

  assert.throws(
    () => new Codec({
      lineByteLimit: Buffer.byteLength(line, "utf8") - 1,
    }).decodeAll(line),
    /record line exceeds .* bytes/,
  );
});

test("R4: runner emits one record per category without additional spawns", () => {
  const Codec = requiredExport("ChildProcessExecutionRecordCodec");
  const codec = new Codec();
  const planned = [
    spawnResult({ stdout: "# pass 1\nunit payload\n" }),
    spawnResult({ status: 5, stderr: "generic integration failure\nintegration payload\n" }),
  ];
  let spawnCount = 0;
  let stdout = "";
  let stderr = "";

  const exitCode = executeFiles(
    [
      "tests/unit/child-record-unit.test.js",
      "tests/e2e/child-record-integration.test.js",
    ],
    {
      spawn: () => {
        spawnCount += 1;
        return planned.shift();
      },
      write: (fd, value) => {
        if (fd === 1) stdout += String(value);
        else stderr += String(value);
      },
    },
  );

  const records = codec.decodeAll(`${stdout}\n${stderr}`);
  assert.equal(spawnCount, 2);
  assert.equal(planned.length, 0);
  assert.equal(records.length, 2);
  assert.deepEqual(records.map((record) => record.kind), ["passed", "nonzero-exit"]);
  assert.equal(exitCode, 5);
  assert.match(stdout, /unit payload/);
  assert.match(stderr, /integration payload/);
  assert.match(stdout, /unit: 1/);
  assert.match(stdout, /integration: 0/);
});
