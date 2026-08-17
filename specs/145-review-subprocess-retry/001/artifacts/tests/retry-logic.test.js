import { describe, it } from "node:test";
import assert from "node:assert/strict";

// We'll test the retry wrapper by importing it after implementation.
// For now, define the expected behavior as tests that will fail.

// The retry wrapper should be exported from run-review.js as `runCmdWithRetry`
const { runCmdWithRetry } = await import(
  "../../../src/flow/lib/run-review.js"
);

describe("runCmdWithRetry", () => {
  it("returns result on first success without retry", async () => {
    let callCount = 0;
    const mockRunCmd = () => {
      callCount++;
      return { ok: true, status: 0, stdout: "success", stderr: "" };
    };

    const result = await runCmdWithRetry(mockRunCmd, { retryCount: 2, retryDelayMs: 10 });
    assert.equal(result.ok, true);
    assert.equal(result.stdout, "success");
    assert.equal(callCount, 1);
  });

  it("retries on failure and returns result on eventual success", async () => {
    let callCount = 0;
    const mockRunCmd = () => {
      callCount++;
      if (callCount < 3) {
        return { ok: false, status: 1, stdout: "", stderr: "error" };
      }
      return { ok: true, status: 0, stdout: "success", stderr: "" };
    };

    const result = await runCmdWithRetry(mockRunCmd, { retryCount: 2, retryDelayMs: 10 });
    assert.equal(result.ok, true);
    assert.equal(callCount, 3);
  });

  it("throws after all retries exhausted", async () => {
    let callCount = 0;
    const mockRunCmd = () => {
      callCount++;
      return { ok: false, status: 1, stdout: "", stderr: "persistent error" };
    };

    const result = await runCmdWithRetry(mockRunCmd, { retryCount: 2, retryDelayMs: 10 });
    assert.equal(result.ok, false);
    assert.equal(callCount, 3);
    assert.ok(result.stderr.includes("persistent error"));
  });

  it("does not retry when stderr contains killed", async () => {
    let callCount = 0;
    const mockRunCmd = () => {
      callCount++;
      return { ok: false, status: 1, stdout: "", stderr: "process was killed" };
    };

    const result = await runCmdWithRetry(mockRunCmd, { retryCount: 2, retryDelayMs: 10 });
    assert.equal(result.ok, false);
    assert.equal(callCount, 1);
  });

  it("does not retry when stderr contains signal", async () => {
    let callCount = 0;
    const mockRunCmd = () => {
      callCount++;
      return { ok: false, status: 1, stdout: "", stderr: "terminated by signal SIGTERM" };
    };

    const result = await runCmdWithRetry(mockRunCmd, { retryCount: 2, retryDelayMs: 10 });
    assert.equal(result.ok, false);
    assert.equal(callCount, 1);
  });

  it("defaults to no retry when retryCount is 0", async () => {
    let callCount = 0;
    const mockRunCmd = () => {
      callCount++;
      return { ok: false, status: 1, stdout: "", stderr: "fail" };
    };

    const result = await runCmdWithRetry(mockRunCmd, { retryCount: 0, retryDelayMs: 10 });
    assert.equal(result.ok, false);
    assert.equal(callCount, 1);
  });
});
