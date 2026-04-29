import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("run-update-overview export default", () => {
  it("dynamic import .default is RunUpdateOverviewCommand class", async () => {
    const mod = await import("../../../src/flow/lib/run-update-overview.js");
    assert.ok(mod.default, ".default must be defined");
    assert.strictEqual(mod.default.name, "RunUpdateOverviewCommand");
  });

  it(".default is a FlowCommand subclass", async () => {
    const mod = await import("../../../src/flow/lib/run-update-overview.js");
    const { FlowCommand } = await import("../../../src/flow/lib/base-command.js");
    assert.ok(mod.default.prototype instanceof FlowCommand, ".default must extend FlowCommand");
  });

  it("named exports are preserved alongside default", async () => {
    const mod = await import("../../../src/flow/lib/run-update-overview.js");
    assert.strictEqual(typeof mod.persistOverviewUpdate, "function");
    assert.strictEqual(typeof mod.validateOverviewAdditions, "function");
    assert.strictEqual(typeof mod.RunUpdateOverviewCommand, "function");
  });
});
