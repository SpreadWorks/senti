/**
 * tests/unit/flow/get-unknown-options.test.js
 *
 * Regression tests for unknown options in `flow get` commands.
 */

import { describe, it, afterEach } from "node:test";
import { CanonicalFlowFixture, makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
const FLOW_CMD = join(process.cwd(), "src/sennel.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

function setupFlowState(dir) {
  const specId = "001-test";
  new CanonicalFlowFixture({
    flowManager: makeFlowManager(dir), specId, runId: `run-${specId}`,
  }).create().registerActive();
}

describe("flow get unknown options", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("fails for unknown option on flow get status", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);

    let threw = false;
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status", "--spec", "specs/999/spec.json"], {
        encoding: "utf8",
        env: { ...process.env, SENNEL_WORK_ROOT: tmp },
      });
    } catch (err) {
      threw = true;
      assert.notEqual(err.status, 0);
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /unknown option/i);
      assert.match(out, /flow get status --help/i);
    }
    assert.equal(threw, true, "flow get status with unknown option should fail");
  });

  it("fails for unknown option on flow get qa-count", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);

    let threw = false;
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "qa-count", "--spec", "specs/999/spec.json"], {
        encoding: "utf8",
        env: { ...process.env, SENNEL_WORK_ROOT: tmp },
      });
    } catch (err) {
      threw = true;
      assert.notEqual(err.status, 0);
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /unknown option/i);
      assert.match(out, /flow get qa-count --help/i);
    }
    assert.equal(threw, true, "flow get qa-count with unknown option should fail");
  });
});
