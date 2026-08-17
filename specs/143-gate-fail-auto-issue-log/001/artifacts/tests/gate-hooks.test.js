import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("gate hooks in registry", () => {
  it("gate entry has post and onError hooks", async () => {
    const { FLOW_COMMANDS } = await import("../../../src/flow/registry.js");
    const gate = FLOW_COMMANDS.run.gate;
    assert.ok(typeof gate.post === "function", "gate should have a post hook");
    assert.ok(typeof gate.onError === "function", "gate should have an onError hook");
  });
});
