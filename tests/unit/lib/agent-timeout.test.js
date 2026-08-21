import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AgentTimeout,
  DEFAULT_AGENT_TIMEOUT_SECONDS,
  DEFAULT_AGENT_PROCESS_TREE_GRACE_MS,
  OUTER_AGENT_PROCESS_TREE_TIMEOUT_ALLOWANCE_MS,
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

  it("gives an outer process time to finish its provider tree cleanup", () => {
    const timeout = AgentTimeout.fromConfig({ timeout: 42 });

    assert.equal(DEFAULT_AGENT_PROCESS_TREE_GRACE_MS, 100);
    assert.equal(OUTER_AGENT_PROCESS_TREE_TIMEOUT_ALLOWANCE_MS, 1_000);
    assert.equal(timeout.toOuterProcessMilliseconds(), 43_000);
  });

  it("rejects non-positive durations", () => {
    assert.throws(() => new AgentTimeout(0), /positive number of seconds/);
  });
});
