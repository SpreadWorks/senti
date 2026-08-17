// spec: R1 R2 R3 R4 R5 R6 R7 R8
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const CMD = join(ROOT, "src/senti.js");
const SELF = fileURLToPath(import.meta.url);

function runSenti(args) {
  const result = spawnSync("node", [CMD, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

describe("workflow plugin help dispatch", () => {
  it("R1: workflow --help prints command-level workflow usage", () => {
    const result = runSenti(["workflow", "--help"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: senti workflow <subcommand> \[args\]/);
  });

  it("R2: workflow --help lists current workflow command subcommands", () => {
    const result = runSenti(["workflow", "--help"]);

    assert.equal(result.status, 0, result.stderr);
    for (const subcommand of ["add", "update", "show", "search", "list", "publish", "ideas"]) {
      assert.match(result.stdout, new RegExp(`\\b${subcommand}\\b`));
    }
  });

  it("R3: workflow --help does not render plugin package help as the primary output", () => {
    const result = runSenti(["workflow", "--help"]);

    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.startsWith("Plugin: workflow"), result.stdout);
  });

  it("R4: help workflow keeps package-level workflow plugin help", () => {
    const result = runSenti(["help", "workflow"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^Plugin: workflow/m);
    assert.match(result.stdout, /workflow\s+\[EXPERIMENTAL\] Manage workflow board drafts/);
  });

  it("R5: existing core and independent help routes keep shared metadata behavior", () => {
    const topLevelHelp = runSenti(["help"]);
    assert.equal(topLevelHelp.status, 0, topLevelHelp.stderr);
    assert.match(topLevelHelp.stdout, /senti/);
    assert.match(topLevelHelp.stdout, /コマンド一覧/);

    const pluginHelp = runSenti(["plugin", "--help"]);
    assert.equal(pluginHelp.status, 0, pluginHelp.stderr);
    assert.match(pluginHelp.stdout, /Subcommands:/);
    assert.match(pluginHelp.stdout, /find\s+Find installable plugin packages/);

    const pluginFindHelp = runSenti(["plugin", "find", "--help"]);
    assert.equal(pluginFindHelp.status, 0, pluginFindHelp.stderr);
    assert.match(pluginFindHelp.stdout, /Usage: senti plugin find \[--json\]/);
    assert.match(pluginFindHelp.stdout, /--json/);
  });

  it("R6: workflow without a help flag still dispatches to the workflow command", () => {
    const result = runSenti(["workflow"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: senti workflow <subcommand> \[args\]/);
  });

  it("R7: unknown plugin command help requests do not become successful help output", () => {
    const result = runSenti(["definitely-not-a-command", "--help"]);

    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(!result.stdout.startsWith("Usage: senti definitely-not-a-command"), result.stdout);
  });

  it("R8: spec-local coverage declares every testable requirement in the header", () => {
    const source = readFileSync(SELF, "utf8");

    assert.match(source, /^\/\/ spec: R1 R2 R3 R4 R5 R6 R7 R8$/m);
  });
});
