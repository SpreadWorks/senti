import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../../../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/senti.js");

function initProject(tmp) {
  execFileSync("git", ["init", tmp], { encoding: "utf8" });
  execFileSync("git", ["-C", tmp, "checkout", "-b", "main"], { encoding: "utf8" });
  writeJson(tmp, ".senti/config.json", {
    lang: "en", type: "node-cli",
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
  execFileSync("git", ["-C", tmp, "add", "-A"], { encoding: "utf8" });
  execFileSync("git", ["-C", tmp, "commit", "-m", "init"], { encoding: "utf8" });
}

function assertPrepareArtifacts(root, specDir) {
  assert.ok(fs.existsSync(join(root, specDir, "spec.json")));
  assert.ok(fs.existsSync(join(root, specDir, "draft.json")));
}

describe("spec init CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("creates spec files in dry-run mode", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "test-feature", "--base", "main", "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.match(envelope.data.result, /dry-run/);
    assert.match(envelope.data.artifacts.specDir, /001-test-feature/);
  });

  it("throws when no title given", () => {
    tmp = createTmpDir();
    initProject(tmp);
    try {
      execFileSync("node", [CMD, "flow", "prepare"], {
        encoding: "utf8",
        env: { ...process.env, SENTI_WORK_ROOT: tmp },
      });
      assert.fail("should throw");
    } catch (err) {
      const envelope = JSON.parse(err.stdout);
      assert.equal(envelope.ok, false);
      assert.ok(envelope.errors[0].messages.some((m) => m.includes("--title is required")));
    }
  });

  it("creates spec files and branch", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "my-feat", "--base", "main"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.match(envelope.data.output, /created branch/);
    assert.match(envelope.data.output, /created spec/);
    assertPrepareArtifacts(tmp, "specs/001-my-feat");
  });

  it("shows help with --help", () => {
    tmp = createTmpDir();
    initProject(tmp);
    const result = execFileSync("node", [CMD, "flow", "prepare", "--help"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });
    assert.match(result, /--title/);
    assert.match(result, /--no-branch/);
    assert.match(result, /--worktree/);
  });

  it("creates spec without branch using --no-branch", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "nb-feat", "--base", "main", "--no-branch"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    // Should create spec but NOT branch
    assert.match(envelope.data.output, /created spec/);
    assert.ok(!envelope.data.output.includes("created branch"));
    assertPrepareArtifacts(tmp, "specs/001-nb-feat");

    // Should still be on main
    const branch = execFileSync("git", ["-C", tmp, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
    assert.equal(branch, "main");
  });

  it("shows mode: spec-only in --no-branch --dry-run", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "test-so", "--base", "main", "--no-branch", "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.artifacts.mode, "spec-only");
  });

  it("creates worktree with --worktree", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "wt-feat", "--base", "main", "--worktree"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.match(envelope.data.output, /created worktree/);
    assert.match(envelope.data.output, /created branch/);
    const wtPath = join(tmp, ".senti", "worktree", "feature-001-wt-feat");
    assertPrepareArtifacts(wtPath, "specs/001-wt-feat");

    // Cleanup worktree
    execFileSync("git", ["-C", tmp, "worktree", "remove", "--force", wtPath], { encoding: "utf8" });
  });

  it("shows mode: worktree in --worktree --dry-run", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "test-wt", "--base", "main", "--worktree", "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.artifacts.mode, "worktree");
    assert.ok(envelope.data.artifacts.worktree, "should have worktree path");
  });

  it("auto-detects worktree and skips branch creation", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const wtPath = join(tmp, "auto-wt");
    execFileSync("git", ["-C", tmp, "worktree", "add", wtPath, "-b", "wt-auto"], { encoding: "utf8" });
    writeJson(wtPath, ".senti/config.json", {
      lang: "en", type: "node-cli",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "auto-feat", "--base", "main"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: wtPath },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    // Should detect worktree and create spec-only (no branch)
    assert.ok(!envelope.data.output.includes("created branch"));
    assert.match(envelope.data.output, /created spec/);
    assertPrepareArtifacts(wtPath, "specs/001-auto-feat");

    // Cleanup worktree
    execFileSync("git", ["-C", tmp, "worktree", "remove", "--force", wtPath], { encoding: "utf8" });
  });
});
