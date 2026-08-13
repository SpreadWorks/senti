/**
 * tests/unit/flow/routing.test.js
 *
 * Tests for flow.js get/set/run dispatcher routing.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";

const FLOW_CMD = join(process.cwd(), "src/sennel.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

describe("flow dispatcher routing", () => {
  it("shows get/set/run in help output", () => {
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "--help"], { encoding: "utf8" });
    assert.match(result, /get/);
    assert.match(result, /set/);
    assert.match(result, /run/);
    assert.doesNotMatch(result, /park/i);
  });

  it("exits non-zero with no subcommand", () => {
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX], { encoding: "utf8" });
      assert.fail("should exit non-zero");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /get|set|run/);
    }
  });

  it("rejects unknown subcommand 'status'", () => {
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "status"], { encoding: "utf8" });
      assert.fail("should exit non-zero");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /unknown command/i);
    }
  });

  it("rejects unknown subcommand 'start'", () => {
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "start"], { encoding: "utf8" });
      assert.fail("should exit non-zero");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /unknown command/i);
    }
  });

  it("rejects removed park command", () => {
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "park"], { encoding: "utf8" });
      assert.fail("should exit non-zero");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /unknown command/i);
    }
  });

  it("rejects removed --parked resume argument", () => {
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "resume", "--parked"], { encoding: "utf8" });
      assert.fail("should exit non-zero");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /unknown option: --parked/i);
    }
  });
});
