import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../helpers/tmp-dir.js";

const SENTI = join(process.cwd(), "src/senti.js");

function createHookConfigProject(command) {
  const root = createTmpDir("senti-hook-list-e2e-");
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: "sample-node-command",
    docs: { languages: ["en"], defaultLanguage: "en" },
    flow: {
      hooks: {
        PostWorktree: command,
      },
    },
  });
  return root;
}

function expectDispatcherFailure(args, assertions, message = "should exit non-zero") {
  let failure;
  try {
    execFileSync("node", [SENTI, ...args], { encoding: "utf8" });
  } catch (err) {
    failure = err;
  }
  if (!failure) assert.fail(message);
  assertions(failure);
}

function expectUnknownCommand(args, message) {
  expectDispatcherFailure(args, (err) => {
    assert.match(err.stderr, /unknown command/);
  }, message);
}

describe("senti dispatcher", () => {
  it("routes 'help' to help output", () => {
    const result = execFileSync("node", [SENTI, "help"], { encoding: "utf8" });
    assert.match(result, /senti/);
    assert.match(result, /コマンド一覧/);
  });

  it("routes 'docs build' through docs dispatcher", () => {
    // build requires analysis.json etc, but should at least start the pipeline
    try {
      execFileSync("node", [SENTI, "docs", "build", "--help"], { encoding: "utf8" });
    } catch (err) {
      // --help may exit 0 or non-zero depending on implementation
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /build/i);
    }
  });

  it("rejects unknown spec subcommand", () => {
    expectUnknownCommand(["spec", "gate"]);
  });

  it("routes 'docs review' correctly", () => {
    try {
      execFileSync("node", [SENTI, "docs", "review"], { encoding: "utf8" });
    } catch (err) {
      // review may fail if no docs dir, but it should have run the review command
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /FAIL|Found|章ファイル/);
    }
  });

  it("routes 'setup --help' as independent command", () => {
    const result = execFileSync("node", [SENTI, "setup", "--help"], { encoding: "utf8" });
    assert.match(result, /setup/i);
  });

  it("routes 'flow' to flow dispatcher", () => {
    try {
      execFileSync("node", [SENTI, "flow"], { encoding: "utf8" });
      assert.fail("should exit non-zero without subcommand");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /prepare|get|set|run/);
    }
  });

  it("shows docs subcommand list when 'docs' has no args", () => {
    try {
      execFileSync("node", [SENTI, "docs"], { encoding: "utf8" });
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /build|scan|forge/);
    }
  });

  it("shows spec subcommand usage when 'spec' has no args", () => {
    try {
      execFileSync("node", [SENTI, "spec"], { encoding: "utf8" });
      assert.fail("should exit non-zero without subcommand");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /Usage: senti spec/);
      assert.match(out, /render/);
    }
  });

  it("routes 'hook list' through hook dispatcher", () => {
    const result = execFileSync("node", [SENTI, "hook", "list"], { encoding: "utf8" });
    assert.match(result, /PostWorktree/);
    assert.match(result, /worktree/i);
  });

  it("routes 'hook list --json' and includes the current configured command", () => {
    const tmp = createHookConfigProject("printf hook-json");
    try {
      const result = execFileSync("node", [SENTI, "hook", "list", "--json"], {
        encoding: "utf8",
        env: { ...process.env, SENTI_WORK_ROOT: tmp },
      });
      const hooks = JSON.parse(result);
      const postWorktree = hooks.find((hook) => hook.name === "PostWorktree");
      assert.ok(postWorktree);
      assert.equal(postWorktree.command, "printf hook-json");
      assert.deepEqual(postWorktree.placeholders, ["CWD"]);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("rejects unknown hook list options", () => {
    expectDispatcherFailure(["hook", "list", "--unknown"], (err) => {
      assert.match(err.stderr, /Unknown option/);
    });
  });

  it("shows help when no subcommand", () => {
    const result = execFileSync("node", [SENTI], { encoding: "utf8" });
    assert.match(result, /senti/);
  });

  it("exits non-zero for unknown subcommand", () => {
    expectUnknownCommand(["nonexistent"]);
  });

  it("suggests the canonical status command for mistyped flow status", () => {
    expectDispatcherFailure(["flow", "status"], (err) => {
      assert.match(err.stderr, /unknown command 'status'/);
      assert.match(err.stderr, /Did you mean: senti flow get status/);
    });
  });

  it("rejects old flat commands (build, gate)", () => {
    for (const cmd of ["build", "gate", "scan", "review"]) {
      expectUnknownCommand([cmd], `'${cmd}' should exit non-zero`);
    }
  });
});
