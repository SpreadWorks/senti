import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { parseArgs, repoRoot, sourceRoot, isInsideWorktree, getMainRepoPath } from "../../../src/lib/cli.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

describe("parseArgs", () => {
  it("parses flags", () => {
    const result = parseArgs(["--dry-run", "--force"], {
      flags: ["--dry-run", "--force"],
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.force, true);
    assert.equal(result.help, false);
  });

  it("parses options with values", () => {
    const result = parseArgs(["--type", "webapp", "--agent", "claude"], {
      options: ["--type", "--agent"],
    });
    assert.equal(result.type, "webapp");
    assert.equal(result.agent, "claude");
  });

  it("parses --help / -h", () => {
    assert.equal(parseArgs(["--help"], {}).help, true);
    assert.equal(parseArgs(["-h"], {}).help, true);
  });

  it("applies defaults", () => {
    const result = parseArgs([], {
      flags: ["--force"],
      defaults: { force: false, count: "5" },
    });
    assert.equal(result.force, false);
    assert.equal(result.count, "5");
  });

  it("resolves aliases", () => {
    const result = parseArgs(["-v"], {
      flags: ["--verbose"],
      aliases: { "-v": "--verbose" },
    });
    assert.equal(result.verbose, true);
  });

  it("throws on unknown option", () => {
    assert.throws(() => parseArgs(["--unknown"], { flags: [] }), {
      message: /Unknown option/,
    });
  });

  it("throws when an option value is missing", () => {
    assert.throws(() => parseArgs(["--type"], { options: ["--type"] }), {
      message: /Missing value for option: --type/,
    });
    assert.throws(() => parseArgs(["--type", "--agent"], { options: ["--type", "--agent"] }), {
      message: /Missing value for option: --type/,
    });
  });

  it("skips --", () => {
    const result = parseArgs(["--"], { flags: [] });
    assert.equal(result.help, false);
  });

  it("converts kebab-case to camelCase", () => {
    const result = parseArgs(["--dry-run"], {
      flags: ["--dry-run"],
    });
    assert.equal(result.dryRun, true);
  });
});

describe("repoRoot", () => {
  const origWorkRoot = process.env.SENTI_WORK_ROOT;

  afterEach(() => {
    if (origWorkRoot !== undefined) {
      process.env.SENTI_WORK_ROOT = origWorkRoot;
    } else {
      delete process.env.SENTI_WORK_ROOT;
    }
  });

  it("returns SENTI_WORK_ROOT when set", () => {
    process.env.SENTI_WORK_ROOT = "/tmp/test-root";
    assert.equal(repoRoot(), "/tmp/test-root");
  });

  it("returns a string when SENTI_WORK_ROOT is not set", () => {
    delete process.env.SENTI_WORK_ROOT;
    const result = repoRoot();
    assert.equal(typeof result, "string");
    assert.ok(result.length > 0);
  });
});

describe("sourceRoot", () => {
  const origSourceRoot = process.env.SENTI_SOURCE_ROOT;
  const origWorkRoot = process.env.SENTI_WORK_ROOT;

  afterEach(() => {
    if (origSourceRoot !== undefined) {
      process.env.SENTI_SOURCE_ROOT = origSourceRoot;
    } else {
      delete process.env.SENTI_SOURCE_ROOT;
    }
    if (origWorkRoot !== undefined) {
      process.env.SENTI_WORK_ROOT = origWorkRoot;
    } else {
      delete process.env.SENTI_WORK_ROOT;
    }
  });

  it("returns SENTI_SOURCE_ROOT when set", () => {
    process.env.SENTI_SOURCE_ROOT = "/tmp/src-root";
    assert.equal(sourceRoot(), "/tmp/src-root");
  });

  it("falls back to repoRoot when SENTI_SOURCE_ROOT is not set", () => {
    delete process.env.SENTI_SOURCE_ROOT;
    process.env.SENTI_WORK_ROOT = "/tmp/work";
    assert.equal(sourceRoot(), "/tmp/work");
  });
});

describe("isInsideWorktree", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns false for a normal git repo", () => {
    tmp = createTmpDir();
    execFileSync("git", ["init", tmp], { encoding: "utf8" });
    assert.equal(isInsideWorktree(tmp), false);
  });

  it("returns false for a directory without .git", () => {
    tmp = createTmpDir();
    assert.equal(isInsideWorktree(tmp), false);
  });

  it("returns true inside a git worktree", () => {
    tmp = createTmpDir();
    execFileSync("git", ["init", tmp], { encoding: "utf8" });
    execFileSync("git", ["-C", tmp, "commit", "--allow-empty", "-m", "init"], { encoding: "utf8" });
    const wtPath = path.join(tmp, "wt");
    execFileSync("git", ["-C", tmp, "worktree", "add", wtPath, "-b", "wt-branch"], { encoding: "utf8" });
    assert.equal(isInsideWorktree(wtPath), true);
    // Cleanup worktree
    execFileSync("git", ["-C", tmp, "worktree", "remove", wtPath], { encoding: "utf8" });
  });
});

describe("getMainRepoPath", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns main repo path from a worktree", () => {
    tmp = createTmpDir();
    execFileSync("git", ["init", tmp], { encoding: "utf8" });
    execFileSync("git", ["-C", tmp, "commit", "--allow-empty", "-m", "init"], { encoding: "utf8" });
    const wtPath = path.join(tmp, "wt");
    execFileSync("git", ["-C", tmp, "worktree", "add", wtPath, "-b", "wt-branch"], { encoding: "utf8" });
    const mainPath = getMainRepoPath(wtPath);
    assert.equal(mainPath, tmp);
    // Cleanup worktree
    execFileSync("git", ["-C", tmp, "worktree", "remove", wtPath], { encoding: "utf8" });
  });

  it("returns repo path for a normal repo", () => {
    tmp = createTmpDir();
    execFileSync("git", ["init", tmp], { encoding: "utf8" });
    const mainPath = getMainRepoPath(tmp);
    assert.equal(mainPath, tmp);
  });
});
