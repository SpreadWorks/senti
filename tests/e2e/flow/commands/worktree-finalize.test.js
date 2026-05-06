/**
 * Spec 251 R8: end-to-end regression for finalize self-contained behavior.
 *
 * Runs the cleanup CLI against a minimal git repo, exercising the
 * spec-only branch (featureBranch === baseBranch) so we don't need a real
 * worktree to reach the cleanup envelope. The branch covers the new
 * envelope contract:
 *   - data.report is null when no report.json exists (and an errors entry
 *     with code REPORT_MISSING is attached at level 'warn', preserving ok:true)
 *   - .sdd-forge/last-finalized-spec is written
 *   - .sdd-forge/.active-flow is cleared
 *   - flow get status returns active:false post-cleanup (R17)
 *
 * The full worktree path (commit → merge → sync → cleanup with squash) is
 * exercised at the registry-hook level by tests/unit/flow/finalize-merge-retry
 * and the registry hooks themselves; orchestrating real git worktree state
 * here would balloon the test without adding contract coverage beyond what
 * the unit and post-hook tests already provide.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";
import { makeFlowState, makeFlowManager } from "../../../helpers/flow-setup.js";

const FLOW_CMD = path.join(process.cwd(), "src/sdd-forge.js");

function git(args, cwd) {
  return execSync(`git ${args}`, { cwd, encoding: "utf8" });
}

function initGitRepo(tmp) {
  git("init -q -b main", tmp);
  git('config user.email "test@example.com"', tmp);
  git('config user.name "Test"', tmp);
  fs.writeFileSync(path.join(tmp, "README.md"), "x\n");
  git("add -A", tmp);
  git('commit -q -m "init"', tmp);
}

function setupSpecOnlyFlow(tmp) {
  initGitRepo(tmp);
  const state = makeFlowState({
    spec: "specs/001-test/spec.json",
    baseBranch: "main",
    featureBranch: "main", // spec-only mode
  });
  // Mark all leaves up to finalize-cleanup as done; cleanup is in_progress.
  for (const s of state.steps) {
    if (Array.isArray(s.children)) {
      for (const c of s.children) {
        if (c.id === "finalize") {
          for (const leaf of c.children || []) {
            leaf.status = leaf.id === "finalize-cleanup" ? "in_progress" : "done";
          }
          c.status = "in_progress";
        } else {
          c.status = "done";
        }
      }
      s.status = s.id === "impl" ? "in_progress" : "done";
    } else if (s.status !== "in_progress") {
      s.status = "done";
    }
  }
  // Persist a minimal spec.json so resolve-context can read it without crashing.
  const specDir = path.join(tmp, "specs", "001-test");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({ goal: "x", scope: { in: [], out: [] }, requirements: [] }) + "\n");
  fs.writeFileSync(path.join(specDir, "spec.md"), "# spec\n## Goal\nx\n## Scope\n");
  makeFlowManager(tmp).save(state);
  makeFlowManager(tmp).addActiveFlow("001-test", "local");
}

function runCli(args, tmp) {
  return execFileSync("node", [FLOW_CMD, "flow", ...args], {
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
  });
}

describe("flow run finalize-cleanup — self-contained envelope (spec 251)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("emits ok:true envelope with data.report=null + REPORT_MISSING warning when no report.json exists", () => {
    tmp = createTmpDir("sdd-finalize-e2e-");
    setupSpecOnlyFlow(tmp);

    const out = runCli(["run", "finalize-cleanup"], tmp);
    const env = JSON.parse(out);

    assert.equal(env.ok, true, "cleanup envelope must be ok:true even when report is missing");
    assert.equal(env.type, "run");
    assert.equal(env.key, "finalize-cleanup");
    assert.equal(env.data.report, null, "data.report must be null when report.json is missing");
    const warn = env.errors.find((e) => e.code === "REPORT_MISSING");
    assert.ok(warn, "errors must contain a REPORT_MISSING entry");
    assert.equal(warn.level, "warn");
  });

  it("writes .sdd-forge/last-finalized-spec and clears .active-flow", () => {
    tmp = createTmpDir("sdd-finalize-e2e-pointer-");
    setupSpecOnlyFlow(tmp);

    runCli(["run", "finalize-cleanup"], tmp);

    const pointer = path.join(tmp, ".sdd-forge", "last-finalized-spec");
    assert.ok(fs.existsSync(pointer), "last-finalized-spec pointer must be written");
    assert.match(fs.readFileSync(pointer, "utf8"), /specs\/001-test\/spec\.json/);

    const activeFlow = path.join(tmp, ".sdd-forge", ".active-flow");
    if (fs.existsSync(activeFlow)) {
      const content = fs.readFileSync(activeFlow, "utf8").trim();
      assert.ok(
        content === "" || content === "[]" || !content.includes("001-test"),
        `.active-flow must not still reference the finalized spec (got: ${content})`,
      );
    }
  });

  it("flow get status returns active:false after cleanup (R17 post-cleanup inactive)", () => {
    tmp = createTmpDir("sdd-finalize-e2e-status-");
    setupSpecOnlyFlow(tmp);

    runCli(["run", "finalize-cleanup"], tmp);
    const out = runCli(["get", "status"], tmp);
    const env = JSON.parse(out);

    assert.equal(env.ok, true);
    assert.equal(env.data.active, false, "flow get status must report active:false post-cleanup");
  });
});
