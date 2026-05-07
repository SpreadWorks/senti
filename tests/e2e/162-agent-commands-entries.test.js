import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

describe("162 — agent.commands entries migration", () => {
  describe("static source analysis", () => {
    // GAP-2a: init.js passes commandId to resolveCommandContext
    it("init.js passes commandId to resolveCommandContext", () => {
      const src = fs.readFileSync("src/docs/commands/init.js", "utf8");
      assert.ok(
        src.includes('"docs.init"'),
        'commandId "docs.init" should be present in init.js'
      );
      assert.ok(
        !src.includes("resolveCommandContext(cli)"),
        "1-arg call to resolveCommandContext should not exist in init.js"
      );
    });

    // spec 251: run-retro.js is now a result-file aggregator (no AI agent
    // invocation). The legacy 'agent.commands' message is no longer present;
    // the GAP-2b assertion is satisfied by absence of 'agent.commands'.
    it("run-retro.js does not reference legacy 'agent.commands'", () => {
      const src = fs.readFileSync("src/flow/lib/run-retro.js", "utf8");
      assert.ok(
        !src.includes("agent.commands"),
        'run-retro.js must not reference "agent.commands"'
      );
    });
  });
});
