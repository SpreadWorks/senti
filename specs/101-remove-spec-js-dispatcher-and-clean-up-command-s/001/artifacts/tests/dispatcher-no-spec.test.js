import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";

const SDD_FORGE = join(process.cwd(), "src/sdd-forge.js");

describe("sdd-forge dispatcher — spec removed", () => {
  it("rejects 'spec' as unknown command after removal", () => {
    try {
      execFileSync("node", [SDD_FORGE, "spec"], { encoding: "utf8" });
      assert.fail("should exit non-zero");
    } catch (err) {
      assert.match(err.stderr, /unknown command/);
    }
  });

  it("rejects 'spec gate' as unknown command", () => {
    try {
      execFileSync("node", [SDD_FORGE, "spec", "gate"], { encoding: "utf8" });
      assert.fail("should exit non-zero");
    } catch (err) {
      assert.match(err.stderr, /unknown command/);
    }
  });

  it("'help' does not mention spec commands", () => {
    const result = execFileSync("node", [SDD_FORGE, "help"], { encoding: "utf8" });
    assert.ok(!result.includes("spec init"), "help should not list spec init");
    assert.ok(!result.includes("spec gate"), "help should not list spec gate");
    assert.ok(!result.includes("spec guardrail"), "help should not list spec guardrail");
  });
});
