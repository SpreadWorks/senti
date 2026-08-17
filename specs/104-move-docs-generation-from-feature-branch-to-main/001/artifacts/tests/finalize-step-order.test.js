import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { setupFlow } from "../../../tests/helpers/flow-setup.js";

const CMD = join(process.cwd(), "src/flow/run/finalize.js");

describe("finalize step order and sync behavior", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("STEP_MAP reflects new order: 5=sync, 6=cleanup", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const result = execFileSync("node", [CMD, "--mode", "all", "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });
    const data = JSON.parse(result);
    assert.ok(data.ok);
    // sync should be present and cleanup should be present
    assert.ok(data.data.steps.sync, "sync step should exist in results");
    assert.ok(data.data.steps.cleanup, "cleanup step should exist in results");
  });

  it("sync is skipped when merge strategy is pr", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const result = execFileSync("node", [CMD, "--mode", "select", "--steps", "5", "--merge-strategy", "pr", "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });
    const data = JSON.parse(result);
    assert.ok(data.ok);
    assert.equal(data.data.steps.sync.status, "skipped");
    assert.match(data.data.steps.sync.message, /PR/i);
  });

  it("all mode uses --auto for merge (no --merge-strategy required)", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    // Running in all mode with dry-run should succeed without --merge-strategy
    const result = execFileSync("node", [CMD, "--mode", "all", "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });
    const data = JSON.parse(result);
    assert.ok(data.ok);
    assert.ok(data.data.steps.merge, "merge step should exist");
  });
});
