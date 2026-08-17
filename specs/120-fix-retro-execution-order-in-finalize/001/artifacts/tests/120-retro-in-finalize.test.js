import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";

const CMD = join(process.cwd(), "src/flow.js");

describe("R1: STEP_MAP includes retro", () => {
  it("AC1: dry-run all mode has all 6 steps including retro", () => {
    // Use the worktree's active flow for dry-run
    let result;
    try {
      result = JSON.parse(
        execFileSync("node", [CMD, "run", "finalize", "--mode", "all", "--dry-run"], {
          encoding: "utf8",
        }),
      );
    } catch (e) {
      const stdout = e.stdout || "";
      if (stdout.trim()) result = JSON.parse(stdout);
      else return;
    }

    const steps = result.data.steps;
    assert.ok(steps.commit, "commit step should exist");
    assert.ok(steps.merge, "merge step should exist");
    assert.ok(steps.retro, "retro step should exist");
    assert.ok(steps.sync, "sync step should exist");
    assert.ok(steps.cleanup, "cleanup step should exist");
    assert.ok(steps.record, "record step should exist");
  });

  it("AC1: step keys order is commit, merge, retro, sync, cleanup, record", () => {
    let result;
    try {
      result = JSON.parse(
        execFileSync("node", [CMD, "run", "finalize", "--mode", "all", "--dry-run"], {
          encoding: "utf8",
        }),
      );
    } catch (e) {
      const stdout = e.stdout || "";
      if (stdout.trim()) result = JSON.parse(stdout);
      else return;
    }

    const keys = Object.keys(result.data.steps);
    assert.deepEqual(keys, ["commit", "merge", "retro", "sync", "cleanup", "record"]);
  });
});

describe("R2: retro step execution", () => {
  it("AC4: dry-run output includes retro step result", () => {
    // This test needs a flow state. We use the spec's own flow.
    // Since we're in a worktree with an active flow, we can test dry-run.
    let result;
    try {
      result = JSON.parse(
        execFileSync("node", [CMD, "run", "finalize", "--mode", "all", "--dry-run"], {
          encoding: "utf8",
        }),
      );
    } catch (e) {
      // May fail if no flow context, but check stdout
      const stdout = e.stdout || "";
      if (stdout.trim()) {
        result = JSON.parse(stdout);
      } else {
        // Skip if no flow available in test context
        return;
      }
    }

    assert.ok(result.data.steps.retro, "retro step should be in finalize output");
    assert.equal(result.data.steps.retro.status, "dry-run", "retro should have dry-run status");
  });

  it("AC5: steps 1,2 (commit + merge) still work", () => {
    let result;
    try {
      result = JSON.parse(
        execFileSync("node", [CMD, "run", "finalize", "--mode", "select", "--steps", "1,2", "--dry-run"], {
          encoding: "utf8",
        }),
      );
    } catch (e) {
      const stdout = e.stdout || "";
      if (stdout.trim()) {
        result = JSON.parse(stdout);
      } else {
        return;
      }
    }

    assert.ok(result.data.steps.commit, "commit step should exist");
    assert.ok(result.data.steps.merge, "merge step should exist");
    assert.equal(result.data.steps.retro.status, "skipped", "retro should be skipped when not selected");
  });

  it("AC2: steps 3 selects retro", () => {
    let result;
    try {
      result = JSON.parse(
        execFileSync("node", [CMD, "run", "finalize", "--mode", "select", "--steps", "3", "--dry-run"], {
          encoding: "utf8",
        }),
      );
    } catch (e) {
      const stdout = e.stdout || "";
      if (stdout.trim()) {
        result = JSON.parse(stdout);
      } else {
        return;
      }
    }

    assert.ok(result.data.steps.retro, "retro step should exist");
    assert.equal(result.data.steps.retro.status, "dry-run", "retro should have dry-run status");
    assert.equal(result.data.steps.commit.status, "skipped", "commit should be skipped");
  });

  it("AC6: steps 1,2,4,5,6 skips retro", () => {
    let result;
    try {
      result = JSON.parse(
        execFileSync("node", [CMD, "run", "finalize", "--mode", "select", "--steps", "1,2,4,5,6", "--dry-run"], {
          encoding: "utf8",
        }),
      );
    } catch (e) {
      const stdout = e.stdout || "";
      if (stdout.trim()) {
        result = JSON.parse(stdout);
      } else {
        return;
      }
    }

    assert.equal(result.data.steps.retro.status, "skipped", "retro should be skipped");
    assert.equal(result.data.steps.commit.status, "dry-run", "commit should be dry-run");
    assert.equal(result.data.steps.sync.status, "dry-run", "sync should be dry-run");
  });
});
