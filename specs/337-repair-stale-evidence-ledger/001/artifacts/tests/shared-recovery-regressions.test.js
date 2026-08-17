// spec: R9
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";

import { standaloneTestEnvironment } from "./standalone-test-environment.js";

const PROJECT_ROOT = path.resolve(".");
const AFFECTED_SHARED_SUITES = Object.freeze([
  "tests/unit/flow/stale-test-evidence-refresh.test.js",
  "tests/unit/flow/set-step-impl-repair.test.js",
  "tests/unit/flow/repair-state-identity.test.js",
  "tests/unit/flow/rewind-test-evidence.test.js",
  "tests/unit/flow/final-regression.test.js",
  "tests/unit/flow/retry-exhaustion-defer.test.js",
  "tests/unit/flow/run-review-advisory.test.js",
]);

test("R9: affected shared recovery unit suites execute as regression evidence", () => {
  const result = spawnSync(process.execPath, ["--test", ...AFFECTED_SHARED_SUITES], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    env: standaloneTestEnvironment(),
  });

  assert.equal(
    result.status,
    0,
    `affected shared recovery suites failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
});
