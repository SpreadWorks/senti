import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AgentTimeout,
  DEFAULT_AGENT_TIMEOUT_SECONDS,
} from "../../../src/lib/agent-timeout.js";

describe("AgentTimeout", () => {
  it("keeps the canonical default in seconds and converts only at the API boundary", () => {
    const timeout = AgentTimeout.fromConfig();

    assert.equal(DEFAULT_AGENT_TIMEOUT_SECONDS, 900);
    assert.equal(timeout.seconds, 900);
    assert.equal(timeout.toMilliseconds(), 900_000);
  });

  it("uses configured seconds", () => {
    const timeout = AgentTimeout.fromConfig({ timeout: 42 });

    assert.equal(timeout.seconds, 42);
    assert.equal(timeout.toMilliseconds(), 42_000);
  });

  it("rejects non-positive durations", () => {
    assert.throws(() => new AgentTimeout(0), /positive number of seconds/);
  });
});
