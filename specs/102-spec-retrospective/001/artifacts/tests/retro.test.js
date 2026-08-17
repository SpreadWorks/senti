/**
 * specs/102-spec-retrospective/tests/retro.test.js
 *
 * Tests for flow run retro command.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { tmpdir } from "os";

const RETRO_CMD = join(process.cwd(), "src/flow/run/retro.js");
const REGISTRY_PATH = join(process.cwd(), "src/flow/registry.js");

describe("retro registry entry", () => {
  it("registry.js contains retro entry under run keys", async () => {
    const { FLOW_COMMANDS } = await import(REGISTRY_PATH);
    assert.ok(FLOW_COMMANDS.run.keys.retro, "retro key should exist in run.keys");
    assert.ok(FLOW_COMMANDS.run.keys.retro.script, "retro should have a script path");
    assert.ok(FLOW_COMMANDS.run.keys.retro.desc.en, "retro should have an English description");
    assert.ok(FLOW_COMMANDS.run.keys.retro.desc.ja, "retro should have a Japanese description");
  });
});

describe("retro --help", () => {
  it("shows help output", () => {
    const result = execFileSync("node", [RETRO_CMD, "--help"], { encoding: "utf8" });
    assert.match(result, /retro/i);
    assert.match(result, /--force/);
    assert.match(result, /--dry-run/);
  });
});

describe("retro without flow.json", () => {
  it("returns fail envelope when no flow.json exists", () => {
    const tmp = mkdtempSync(join(tmpdir(), "retro-test-"));
    // Initialize a minimal git repo so git commands don't fail unexpectedly
    execFileSync("git", ["init"], { cwd: tmp, encoding: "utf8" });
    execFileSync("git", ["commit", "--allow-empty", "-m", "init"], { cwd: tmp, encoding: "utf8" });

    try {
      execFileSync("node", [RETRO_CMD], { cwd: tmp, encoding: "utf8" });
      assert.fail("should exit non-zero");
    } catch (err) {
      const stdout = err.stdout || "";
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.ok, false);
      assert.equal(parsed.errors[0].code, "NO_FLOW");
    }
  });
});

describe("retro --force flag", () => {
  it("returns error when retro.json exists and --force is not specified", () => {
    const tmp = mkdtempSync(join(tmpdir(), "retro-force-"));
    execFileSync("git", ["init"], { cwd: tmp, encoding: "utf8" });
    execFileSync("git", ["commit", "--allow-empty", "-m", "init"], { cwd: tmp, encoding: "utf8" });

    // Create minimal flow state
    const sddDir = join(tmp, ".sdd-forge");
    mkdirSync(sddDir, { recursive: true });
    const specDir = join(tmp, "specs", "001-test");
    mkdirSync(specDir, { recursive: true });

    writeFileSync(join(sddDir, ".active-flow"), JSON.stringify([{ spec: "001-test", mode: "local" }]));
    writeFileSync(join(specDir, "flow.json"), JSON.stringify({
      spec: "specs/001-test/spec.md",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: [],
      requirements: [{ desc: "test req", status: "done" }],
    }));
    writeFileSync(join(specDir, "spec.md"), "# Test Spec\n## Requirements\n1. test req\n");
    // Pre-existing retro.json
    writeFileSync(join(specDir, "retro.json"), JSON.stringify({ existing: true }));

    try {
      execFileSync("node", [RETRO_CMD], { cwd: tmp, encoding: "utf8" });
      assert.fail("should exit non-zero");
    } catch (err) {
      const stdout = err.stdout || "";
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.ok, false);
      assert.equal(parsed.errors[0].code, "RETRO_EXISTS");
    }
  });
});
