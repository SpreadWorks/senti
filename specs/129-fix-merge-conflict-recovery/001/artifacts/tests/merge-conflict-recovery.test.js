import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Create a git repo with a conflict scenario:
 * - main branch has file.txt with "main content"
 * - feature branch has file.txt with "feature content"
 * Returns { mainRepo, featureBranch }
 */
function createConflictScenario() {
  const tmp = mkdtempSync(join(tmpdir(), "sdd-merge-test-"));
  const mainRepo = join(tmp, "main");
  const worktreeDir = join(tmp, "worktree");

  // Create main repo
  mkdirSync(mainRepo, { recursive: true });
  execFileSync("git", ["init", "-b", "main", mainRepo], { stdio: "ignore" });
  execFileSync("git", ["-C", mainRepo, "config", "user.email", "test@test.com"], { stdio: "ignore" });
  execFileSync("git", ["-C", mainRepo, "config", "user.name", "Test"], { stdio: "ignore" });

  // Initial commit
  writeFileSync(join(mainRepo, "file.txt"), "initial");
  execFileSync("git", ["-C", mainRepo, "add", "."], { stdio: "ignore" });
  execFileSync("git", ["-C", mainRepo, "commit", "-m", "initial"], { stdio: "ignore" });

  // Create feature branch
  execFileSync("git", ["-C", mainRepo, "branch", "feature"], { stdio: "ignore" });

  // Modify on main
  writeFileSync(join(mainRepo, "file.txt"), "main content");
  execFileSync("git", ["-C", mainRepo, "add", "."], { stdio: "ignore" });
  execFileSync("git", ["-C", mainRepo, "commit", "-m", "main change"], { stdio: "ignore" });

  // Modify on feature (conflicting)
  execFileSync("git", ["-C", mainRepo, "checkout", "feature"], { stdio: "ignore" });
  writeFileSync(join(mainRepo, "file.txt"), "feature content");
  execFileSync("git", ["-C", mainRepo, "add", "."], { stdio: "ignore" });
  execFileSync("git", ["-C", mainRepo, "commit", "-m", "feature change"], { stdio: "ignore" });

  // Go back to main
  execFileSync("git", ["-C", mainRepo, "checkout", "main"], { stdio: "ignore" });

  return { tmp, mainRepo, featureBranch: "feature" };
}

function cleanup(tmp) {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}

// R1: merge.js should abort on conflict and return clean state
describe("merge conflict recovery", () => {
  let scenario;
  afterEach(() => scenario && cleanup(scenario.tmp));

  it("git merge --squash conflict leaves repo in merge state (pre-implementation baseline)", () => {
    scenario = createConflictScenario();
    const { mainRepo, featureBranch } = scenario;

    // Attempt squash merge — should fail
    try {
      execFileSync("git", ["-C", mainRepo, "merge", "--squash", featureBranch], { stdio: "pipe" });
      assert.fail("should have thrown on conflict");
    } catch (e) {
      // Expected: conflict
    }

    // After conflict, repo is in merge state
    const status = execFileSync("git", ["-C", mainRepo, "status", "--porcelain"], { encoding: "utf8" });
    assert.ok(status.includes("UU") || status.includes("file.txt"), "repo should have conflicted files");

    // Clean up — squash merge conflict requires reset, not merge --abort
    execFileSync("git", ["-C", mainRepo, "reset", "--merge"], { stdio: "ignore" });
  });
});

// R3: registry.js post hook should not crash when flow.json is absent
describe("registry post hook safety", () => {
  it("loadFlowState returns null for non-existent flow.json", async () => {
    const { loadFlowState } = await import("../../../src/lib/flow-state.js");
    const result = loadFlowState("/nonexistent/path");
    assert.equal(result, null, "should return null for missing flow.json");
  });
});
