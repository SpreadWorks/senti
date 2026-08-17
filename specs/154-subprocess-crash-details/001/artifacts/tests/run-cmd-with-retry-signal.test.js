/**
 * Spec verification test: runCmdWithRetry signal detection
 *
 * Verifies that runCmdWithRetry uses res.signal || res.killed (field-based detection)
 * instead of regex on stderr, as required by spec 154-subprocess-crash-details req #13.
 *
 * Location: specs/154-subprocess-crash-details/tests/ (spec verification, not formal)
 * Run: node --test specs/154-subprocess-crash-details/tests/run-cmd-with-retry-signal.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCmdWithRetry } from "../../../src/flow/lib/run-review.js";

describe("runCmdWithRetry signal detection", () => {
  it("does not retry when res.signal is set", async () => {
    let callCount = 0;
    const cmdFn = () => {
      callCount++;
      return {
        ok: false,
        status: 137,
        stdout: "",
        stderr: "",
        signal: "SIGKILL",
        killed: true,
      };
    };

    await runCmdWithRetry(cmdFn, { retryCount: 2, retryDelayMs: 0 });
    assert.equal(callCount, 1, "should not retry when signal is set");
  });

  it("does not retry when res.killed is true (signal may be null)", async () => {
    let callCount = 0;
    const cmdFn = () => {
      callCount++;
      return {
        ok: false,
        status: 1,
        stdout: "",
        stderr: "",
        signal: null,
        killed: true,
      };
    };

    await runCmdWithRetry(cmdFn, { retryCount: 2, retryDelayMs: 0 });
    assert.equal(callCount, 1, "should not retry when killed is true");
  });

  it("retries on regular failure (no signal, not killed)", async () => {
    let callCount = 0;
    const cmdFn = () => {
      callCount++;
      return {
        ok: false,
        status: 1,
        stdout: "",
        stderr: "some error",
        signal: null,
        killed: false,
      };
    };

    await runCmdWithRetry(cmdFn, { retryCount: 2, retryDelayMs: 0 });
    assert.equal(callCount, 3, "should retry retryCount times on regular failure");
  });

  it("retries when stderr contains 'killed' text but signal/killed fields are false", async () => {
    // Verifies field-based detection: stderr text alone should NOT prevent retry.
    // Old regex /killed|signal/i.test(stderr) would have skipped retry here.
    let callCount = 0;
    const cmdFn = () => {
      callCount++;
      return {
        ok: false,
        status: 1,
        stdout: "",
        stderr: "killed by oom killer",
        signal: null,
        killed: false,
      };
    };

    await runCmdWithRetry(cmdFn, { retryCount: 1, retryDelayMs: 0 });
    assert.equal(callCount, 2, "should retry when stderr has 'killed' text but signal/killed fields are false");
  });
});
