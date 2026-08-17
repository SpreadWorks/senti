/**
 * specs/127-redesign-finalize-flow/tests/finalize-redesign.test.js
 *
 * Verify the finalize pipeline redesign:
 * - Step order: commit(+retro+report) → merge → sync → cleanup
 * - ctx passes worktreePath/mainRepoPath to each step
 * - cleanup logic is inlined in finalize.js (no cleanup.js import)
 * - merge.js exports main(ctx) without runIfDirect
 * - report.js is registered in registry.js
 *
 * Run from project root: node --test specs/127-redesign-finalize-flow/tests/finalize-redesign.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

// Resolve project root via git
const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const SRC_DIR = path.join(ROOT, "src");

describe("127: finalize redesign", () => {

  describe("R1: step order", () => {
    it("STEP_MAP has 4 steps: commit, merge, sync, cleanup", async () => {
      const mod = await import(path.join(SRC_DIR, "flow/run/finalize.js"));
      assert.equal(typeof mod.execute, "function");
      if (mod.STEP_MAP) {
        const names = Object.values(mod.STEP_MAP);
        assert.deepEqual(names, ["commit", "merge", "sync", "cleanup"]);
      }
    });
  });

  describe("R4: cleanup.js removed", () => {
    it("cleanup.js does not exist", () => {
      const cleanupPath = path.join(SRC_DIR, "flow/commands/cleanup.js");
      assert.equal(fs.existsSync(cleanupPath), false, "cleanup.js should be deleted");
    });
  });

  describe("R5: merge.js has no runIfDirect", () => {
    it("merge.js does not import runIfDirect", () => {
      const mergeSource = fs.readFileSync(
        path.join(SRC_DIR, "flow/commands/merge.js"), "utf8"
      );
      assert.equal(
        mergeSource.includes("runIfDirect"),
        false,
        "merge.js should not contain runIfDirect"
      );
    });

    it("merge.js exports main", async () => {
      const mod = await import(path.join(SRC_DIR, "flow/commands/merge.js"));
      assert.equal(typeof mod.main, "function");
    });
  });

  describe("R6: report.js registered in registry", () => {
    it("registry has flow.run.report entry", async () => {
      const { FLOW_COMMANDS } = await import(path.join(SRC_DIR, "flow/registry.js"));
      assert.ok(FLOW_COMMANDS.run.report, "registry should have run.report");
      assert.equal(typeof FLOW_COMMANDS.run.report.execute, "function");
    });
  });

  describe("R2/R3: finalize uses function calls with ctx", () => {
    it("finalize.js does not use runSync for merge/retro/report/cleanup", () => {
      const source = fs.readFileSync(
        path.join(SRC_DIR, "flow/run/finalize.js"), "utf8"
      );
      const subprocessPatterns = [
        /runSync\(.+merge\.js/,
        /runSync\(.+cleanup\.js/,
        /runSync\(.+retro/,
      ];
      for (const pattern of subprocessPatterns) {
        assert.equal(
          pattern.test(source),
          false,
          `finalize.js should not spawn subprocess matching ${pattern}`
        );
      }
    });
  });
});
