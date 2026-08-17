/**
 * Spec verification test: gate impl should detect uncommitted changes.
 *
 * These tests verify spec #157 requirements:
 * 1. gate impl uses combined diff (committed + uncommitted) for requirements check
 * 2. Only fails with "no changes found (committed or uncommitted)" when truly no changes
 * 3. Works correctly in worktree mode
 *
 * Test placement: specs/157-fix-gate-impl-uncommitted/tests/ (spec verification, not formal tests)
 * Run: node --test specs/157-fix-gate-impl-uncommitted/tests/gate-impl-uncommitted.test.js
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { execFileSync, execSync } from "child_process";
import { saveFlowState, addActiveFlow, FLOW_STEPS } from "../../../src/lib/flow-state.js";

const FLOW_CMD = resolve(process.cwd(), "src/flow.js");

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), "sdd-gate-impl-test-"));
  execSync("git init", { cwd: dir });
  execSync("git config user.email test@test.com", { cwd: dir });
  execSync("git config user.name Test", { cwd: dir });
  // Initial commit on default branch (master)
  writeFileSync(join(dir, "README.md"), "# project\n");
  execSync("git add README.md", { cwd: dir });
  execSync('git commit -m "initial"', { cwd: dir });
  // Capture default branch name
  const branch = execSync("git branch --show-current", { cwd: dir, encoding: "utf8" }).trim();
  // Create feature branch
  execSync("git checkout -b feature/001-test", { cwd: dir });
  return { dir, baseBranch: branch };
}

function setupFlowAndSpec(dir, baseBranch) {
  mkdirSync(join(dir, ".sdd-forge"), { recursive: true });
  writeFileSync(
    join(dir, ".sdd-forge", "config.json"),
    JSON.stringify({ lang: "ja", type: "base", docs: { languages: ["ja"], defaultLanguage: "ja" } }),
  );

  mkdirSync(join(dir, "specs", "001-test"), { recursive: true });
  writeFileSync(
    join(dir, "specs", "001-test", "spec.md"),
    [
      "# Spec: test",
      "",
      "## Requirements",
      "- Add a new file hello.js",
      "",
      "## Acceptance Criteria",
      "- hello.js exists",
      "",
      "## User Confirmation",
      "- [x] User approved this spec",
    ].join("\n"),
  );

  const state = {
    spec: "specs/001-test/spec.md",
    baseBranch,
    featureBranch: "feature/001-test",
    worktree: false,
    steps: FLOW_STEPS.map((id) => ({ id, status: "pending" })),
    requirements: [],
  };
  saveFlowState(dir, state);
  addActiveFlow(dir, "001-test", "branch");
}

function runGateImpl(dir) {
  try {
    const out = execFileSync("node", [FLOW_CMD, "run", "gate", "--phase", "impl"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: dir },
    });
    return JSON.parse(out);
  } catch (err) {
    const raw = err.stdout || err.message;
    try { return JSON.parse(raw); } catch { return { ok: false, _raw: raw }; }
  }
}

// ---------------------------------------------------------------------------
// Test: uncommitted changes (unstaged) are detected
// ---------------------------------------------------------------------------

describe("gate impl: detects unstaged uncommitted changes (spec req #1)", () => {
  let tmpRepo;
  before(() => {
    const { dir, baseBranch } = createGitRepo();
    tmpRepo = dir;
    setupFlowAndSpec(dir, baseBranch);
    // Modify an existing tracked file without staging — realistic impl scenario
    writeFileSync(join(dir, "README.md"), "# project\n\nchanged\n");
  });
  after(() => rmSync(tmpRepo, { recursive: true, force: true }));

  it("does not fail with 'no changes found' when unstaged changes exist", () => {
    const result = runGateImpl(tmpRepo);
    // Pre-fix: result.data.artifacts.issues = ["no changes found against base branch"]
    // Post-fix: gate proceeds past diff detection; no "no changes found" error
    const issues = result?.data?.artifacts?.issues ?? [];
    assert.ok(
      !issues.some((m) => /no changes found/i.test(m)),
      `Expected gate to proceed past diff detection, but got: ${JSON.stringify(issues)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Test: staged changes are detected
// ---------------------------------------------------------------------------

describe("gate impl: detects staged (git add) uncommitted changes (spec req #1)", () => {
  let tmpRepo;
  before(() => {
    const { dir, baseBranch } = createGitRepo();
    tmpRepo = dir;
    setupFlowAndSpec(dir, baseBranch);
    // Stage changes but do NOT commit
    writeFileSync(join(dir, "hello.js"), 'console.log("hello");\n');
    execSync("git add hello.js", { cwd: dir });
  });
  after(() => rmSync(tmpRepo, { recursive: true, force: true }));

  it("does not fail with 'no changes found' when staged changes exist", () => {
    const result = runGateImpl(tmpRepo);
    const issues = result?.data?.artifacts?.issues ?? [];
    assert.ok(
      !issues.some((m) => /no changes found/i.test(m)),
      `Expected gate to proceed past diff detection, but got: ${JSON.stringify(issues)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Test: truly clean state returns appropriate FAIL message (spec req #2)
// ---------------------------------------------------------------------------

describe("gate impl: returns updated message when truly no changes (spec req #2)", () => {
  let tmpRepo;
  before(() => {
    const { dir, baseBranch } = createGitRepo();
    tmpRepo = dir;
    setupFlowAndSpec(dir, baseBranch);
    // No changes at all — clean state
  });
  after(() => rmSync(tmpRepo, { recursive: true, force: true }));

  it("fails with message mentioning 'uncommitted' when no changes exist anywhere", () => {
    const result = runGateImpl(tmpRepo);
    const issues = result?.data?.artifacts?.issues ?? [];
    assert.ok(
      issues.some((m) => /no changes found/i.test(m) && /uncommitted/i.test(m)),
      `Expected 'no changes found (committed or uncommitted)' message, but got: ${JSON.stringify(issues)}`,
    );
  });
});
