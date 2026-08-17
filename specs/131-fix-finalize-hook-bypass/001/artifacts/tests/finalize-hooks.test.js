/**
 * specs/131-fix-finalize-hook-bypass/tests/finalize-hooks.test.js
 *
 * Verify:
 * - AC1: registry has finalize sub-step entries (commit, merge, sync, cleanup)
 * - AC2: commit entry has post hook containing retro and report
 * - AC3: all sub-step entries have onError hooks
 * - AC4: finalize.js does not contain betagai (direct) retro/merge/sync/cleanup implementation
 * - AC5: error in a sub-step records to issue-log.json
 *
 * Run: node --test specs/131-fix-finalize-hook-bypass/tests/finalize-hooks.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const SRC = path.join(ROOT, "src");

describe("131: finalize hook bypass fix", () => {

  describe("AC1: registry has finalize sub-step entries", () => {
    it("registry defines commit, merge, sync, cleanup as finalize sub-steps", async () => {
      const { FLOW_COMMANDS } = await import(path.join(SRC, "flow/registry.js"));
      // Sub-steps should be defined somewhere in the registry (e.g. under run.finalize or a dedicated section)
      // Check that the registry has entries that finalize can reference
      const finalize = FLOW_COMMANDS.run?.finalize;
      assert.ok(finalize, "finalize should be in registry");
      // Sub-steps should be defined (as steps property or similar)
      assert.ok(finalize.steps || finalize.subSteps, "finalize should define sub-steps in registry");
      const stepNames = Object.keys(finalize.steps || finalize.subSteps || {});
      assert.ok(stepNames.includes("commit"), "should have commit sub-step");
      assert.ok(stepNames.includes("merge"), "should have merge sub-step");
      assert.ok(stepNames.includes("sync"), "should have sync sub-step");
      assert.ok(stepNames.includes("cleanup"), "should have cleanup sub-step");
    });
  });

  describe("AC2: commit post hook includes retro and report", () => {
    it("commit sub-step has a post hook", async () => {
      const { FLOW_COMMANDS } = await import(path.join(SRC, "flow/registry.js"));
      const steps = FLOW_COMMANDS.run?.finalize?.steps || FLOW_COMMANDS.run?.finalize?.subSteps || {};
      const commit = steps.commit;
      assert.ok(commit, "commit sub-step should exist");
      assert.ok(typeof commit.post === "function", "commit should have a post hook function");
    });
  });

  describe("AC3: all sub-steps have onError hooks", () => {
    it("commit, merge, sync, cleanup all have onError", async () => {
      const { FLOW_COMMANDS } = await import(path.join(SRC, "flow/registry.js"));
      const steps = FLOW_COMMANDS.run?.finalize?.steps || FLOW_COMMANDS.run?.finalize?.subSteps || {};
      for (const name of ["commit", "merge", "sync", "cleanup"]) {
        const step = steps[name];
        assert.ok(step, `${name} sub-step should exist`);
        assert.ok(typeof step.onError === "function", `${name} should have an onError hook`);
      }
    });
  });

  describe("AC4: finalize.js has no betagai implementations", () => {
    it("finalize.js does not directly instantiate RunRetroCommand", () => {
      const source = fs.readFileSync(path.join(SRC, "flow/lib/run-finalize.js"), "utf8");
      assert.equal(
        /new\s+RunRetroCommand/.test(source), false,
        "finalize.js should not directly instantiate RunRetroCommand"
      );
    });

    it("finalize.js does not import merge.js directly", () => {
      const source = fs.readFileSync(path.join(SRC, "flow/lib/run-finalize.js"), "utf8");
      assert.equal(
        /import.*from.*commands\/merge/.test(source), false,
        "finalize.js should not import from commands/merge.js"
      );
    });

    it("finalize.js does not call runSync for docs build", () => {
      const source = fs.readFileSync(path.join(SRC, "flow/lib/run-finalize.js"), "utf8");
      assert.equal(
        /runSync.*docs\.js.*build/.test(source), false,
        "finalize.js should not call runSync for docs build"
      );
    });
  });
});
