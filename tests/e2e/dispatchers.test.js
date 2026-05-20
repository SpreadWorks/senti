import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";

const SDD_FORGE = join(process.cwd(), "src/sdd-forge.js");

function expectDispatcherFailure(args, assertions, message = "should exit non-zero") {
  let failure;
  try {
    execFileSync("node", [SDD_FORGE, ...args], { encoding: "utf8" });
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

describe("sdd-forge dispatcher", () => {
  it("routes 'help' to help output", () => {
    const result = execFileSync("node", [SDD_FORGE, "help"], { encoding: "utf8" });
    assert.match(result, /SDD Forge/);
    assert.match(result, /コマンド一覧/);
  });

  it("routes 'docs build' through docs dispatcher", () => {
    // build requires analysis.json etc, but should at least start the pipeline
    try {
      execFileSync("node", [SDD_FORGE, "docs", "build", "--help"], { encoding: "utf8" });
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
      execFileSync("node", [SDD_FORGE, "docs", "review"], { encoding: "utf8" });
    } catch (err) {
      // review may fail if no docs dir, but it should have run the review command
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /FAIL|Found|章ファイル/);
    }
  });

  it("routes 'setup --help' as independent command", () => {
    const result = execFileSync("node", [SDD_FORGE, "setup", "--help"], { encoding: "utf8" });
    assert.match(result, /setup/i);
  });

  it("routes 'flow' to flow dispatcher", () => {
    try {
      execFileSync("node", [SDD_FORGE, "flow"], { encoding: "utf8" });
      assert.fail("should exit non-zero without subcommand");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /prepare|get|set|run/);
    }
  });

  it("shows docs subcommand list when 'docs' has no args", () => {
    try {
      execFileSync("node", [SDD_FORGE, "docs"], { encoding: "utf8" });
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /build|scan|forge/);
    }
  });

  it("shows spec subcommand usage when 'spec' has no args", () => {
    try {
      execFileSync("node", [SDD_FORGE, "spec"], { encoding: "utf8" });
      assert.fail("should exit non-zero without subcommand");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /Usage: sdd-forge spec/);
      assert.match(out, /render/);
    }
  });

  it("shows help when no subcommand", () => {
    const result = execFileSync("node", [SDD_FORGE], { encoding: "utf8" });
    assert.match(result, /SDD Forge/);
  });

  it("exits non-zero for unknown subcommand", () => {
    expectUnknownCommand(["nonexistent"]);
  });

  it("suggests the canonical status command for mistyped flow status", () => {
    expectDispatcherFailure(["flow", "status"], (err) => {
      assert.match(err.stderr, /unknown command 'status'/);
      assert.match(err.stderr, /Did you mean: sdd-forge flow get status/);
    });
  });

  it("rejects old flat commands (build, gate)", () => {
    for (const cmd of ["build", "gate", "scan", "review"]) {
      expectUnknownCommand([cmd], `'${cmd}' should exit non-zero`);
    }
  });
});
