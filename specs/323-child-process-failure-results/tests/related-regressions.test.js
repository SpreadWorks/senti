// spec: R6
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("R6: existing runner and final-regression focused suites pass", () => {
  const result = spawnSync(process.execPath, [
    "--test",
    "tests/unit/test-runner-file-filter.test.js",
    "tests/unit/flow/final-regression.test.js",
  ], {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.signal);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
