// spec: R1 R2 R3 R4 R5 R7 R8
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "../../..");
const cliPath = path.join(root, "src", "sdd-forge.js");

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sdd-forge-upgrade-artifact-"));
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function initRepo() {
  const dir = tmpDir();
  runGit(dir, ["init", "-b", "main"]);
  runGit(dir, ["config", "user.email", "test@example.com"]);
  runGit(dir, ["config", "user.name", "Test User"]);
  fs.mkdirSync(path.join(dir, "src", "skills", "sdd-forge.flow"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src", "skills", "sdd-forge.flow", "SKILL.md"), "initial\n");
  runGit(dir, ["add", "."]);
  runGit(dir, ["commit", "-m", "initial"]);
  runGit(dir, ["switch", "-c", "feature"]);
  fs.writeFileSync(path.join(dir, "src", "skills", "sdd-forge.flow", "SKILL.md"), "changed\n");
  runGit(dir, ["add", "."]);
  runGit(dir, ["commit", "-m", "change skill source"]);
  return dir;
}

function validArtifact(overrides = {}) {
  return {
    version: 1,
    command: "sdd-forge upgrade --dry-run",
    dryRun: true,
    exitCode: 0,
    result: "success-no-change",
    summary: {
      skills: { updated: 0, unchanged: 1, removed: 0 },
      presets: { copied: 0 },
      config: { changed: false },
    },
    checkedPaths: ["src/skills/sdd-forge.flow/SKILL.md"],
    rawLogPath: "tests/.raw/upgrade.log",
    ...overrides,
  };
}

test("R1: upgrade artifact writer stores versioned result and checked paths", async () => {
  const artifacts = await import("../../../src/flow/lib/test-artifacts.js");
  assert.equal(typeof artifacts.writeUpgradeResultArtifact, "function");

  const repo = initRepo();
  const specDir = path.join(repo, "specs", "278-upgrade-result-artifact");
  const written = artifacts.writeUpgradeResultArtifact({
    root: repo,
    specDir,
    baseBranch: "main",
    command: "sdd-forge upgrade --dry-run",
    dryRun: true,
    exitCode: 0,
    result: "success-no-change",
    summary: validArtifact().summary,
    rawOutput: "no changes\n",
  });

  assert.equal(written.artifact.version, 1);
  assert.equal(written.artifact.command, "sdd-forge upgrade --dry-run");
  assert.equal(written.artifact.dryRun, true);
  assert.equal(written.artifact.exitCode, 0);
  assert.equal(written.artifact.result, "success-no-change");
  assert.deepEqual(written.artifact.summary, validArtifact().summary);
  assert.deepEqual(written.artifact.checkedPaths, ["src/skills/sdd-forge.flow/SKILL.md"]);
  assert.equal(written.artifact.rawLogPath, "tests/.raw/upgrade.log");

  const persisted = JSON.parse(fs.readFileSync(path.join(specDir, "upgrade-result.json"), "utf8"));
  assert.deepEqual(persisted, written.artifact);
  assert.equal(fs.existsSync(path.join(specDir, "upgrade-result.json")), true);
  assert.equal(fs.existsSync(path.join(specDir, written.artifact.rawLogPath)), true);
});

test("R2: upgrade artifact raw log preserves output and rejects outside paths", async () => {
  const artifacts = await import("../../../src/flow/lib/test-artifacts.js");
  assert.equal(typeof artifacts.writeUpgradeResultArtifact, "function");
  assert.equal(typeof artifacts.validateUpgradeResultArtifact, "function");

  const repo = initRepo();
  const specDirForSuccess = path.join(repo, "specs", "278-upgrade-result-artifact");
  const success = artifacts.writeUpgradeResultArtifact({
    root: repo,
    specDir: specDirForSuccess,
    baseBranch: "main",
    command: "sdd-forge upgrade --dry-run",
    dryRun: true,
    exitCode: 0,
    result: "success-no-change",
    summary: validArtifact().summary,
    rawOutput: "[upgrade] no changes\n",
  });
  assert.equal(
    fs.readFileSync(path.join(specDirForSuccess, success.artifact.rawLogPath), "utf8"),
    "[upgrade] no changes\n",
  );

  const specDirForFailure = path.join(repo, "specs", "278-upgrade-result-artifact-failed");
  const failed = artifacts.writeUpgradeResultArtifact({
    root: repo,
    specDir: specDirForFailure,
    baseBranch: "main",
    command: "sdd-forge upgrade",
    dryRun: false,
    exitCode: 1,
    result: "failed",
    summary: { error: "upgrade failed: broken skill include" },
    rawOutput: "upgrade failed: broken skill include\n",
  });
  assert.match(
    fs.readFileSync(path.join(specDirForFailure, failed.artifact.rawLogPath), "utf8"),
    /upgrade failed: broken skill include/,
  );

  const specDir = tmpDir();
  const outside = path.join(tmpDir(), "outside.log");
  fs.writeFileSync(outside, "raw\n");
  const result = artifacts.validateUpgradeResultArtifact(specDir, validArtifact({
    rawLogPath: path.relative(specDir, outside),
  }));

  assert.equal(result.ok, false);
  assert.match(result.reason, /rawLogPath|outside|spec directory/i);
});

test("R3: upgrade-required source paths include skill, preset, and generic upgrade sources", async () => {
  const artifacts = await import("../../../src/flow/lib/test-artifacts.js");
  assert.ok(Array.isArray(artifacts.UPGRADE_REQUIRED_SOURCE_PATTERNS));
  assert.equal(typeof artifacts.matchUpgradeRequiredSourcePaths, "function");

  const changed = [
    "src/upgrade.js",
    "src/skills/sdd-forge.flow/SKILL.md",
    "src/presets/base/guardrail.json",
    "src/lib/skills.js",
    "src/lib/include.js",
    "src/lib/skill-rules.js",
    "src/docs/lib/directive-parser.js",
    "src/lib/preset-deploy.js",
    "src/lib/presets.js",
    "src/lib/agent-defaults.js",
    "src/lib/config.js",
    "docs/notes.md",
  ];
  assert.deepEqual(artifacts.matchUpgradeRequiredSourcePaths(changed), [
    "src/docs/lib/directive-parser.js",
    "src/lib/agent-defaults.js",
    "src/lib/config.js",
    "src/lib/include.js",
    "src/lib/preset-deploy.js",
    "src/lib/presets.js",
    "src/lib/skill-rules.js",
    "src/lib/skills.js",
    "src/presets/base/guardrail.json",
    "src/skills/sdd-forge.flow/SKILL.md",
    "src/upgrade.js",
  ]);

  const repo = initRepo();
  const specDir = path.join(repo, "specs", "278-upgrade-result-artifact");
  const gateResult = artifacts.validateUpgradeEvidenceForGate({
    root: repo,
    specDir,
    baseBranch: "main",
  });
  assert.equal(gateResult.ok, false);
  assert.match(gateResult.reason, /upgrade.*artifact|missing/i);
  assert.deepEqual(gateResult.currentRequiredPaths, ["src/skills/sdd-forge.flow/SKILL.md"]);
});

test("R4: gate upgrade evidence fails invalid artifacts and skips when no upgrade paths changed", async () => {
  const artifacts = await import("../../../src/flow/lib/test-artifacts.js");
  assert.equal(typeof artifacts.validateUpgradeEvidenceForGate, "function");

  const specDir = tmpDir();
  const currentRequiredPaths = ["src/lib/agent-defaults.js"];
  assert.equal(artifacts.validateUpgradeEvidenceForGate({ specDir, currentRequiredPaths }).ok, false);

  fs.mkdirSync(path.join(specDir, "tests", ".raw"), { recursive: true });
  fs.writeFileSync(path.join(specDir, "upgrade-result.json"), "{not json");
  assert.equal(artifacts.validateUpgradeEvidenceForGate({ specDir, currentRequiredPaths }).ok, false);

  fs.writeFileSync(path.join(specDir, "upgrade-result.json"), JSON.stringify({
    version: 1,
    result: "maybe",
    checkedPaths: currentRequiredPaths,
    rawLogPath: "tests/.raw/upgrade.log",
  }));
  assert.equal(artifacts.validateUpgradeEvidenceForGate({ specDir, currentRequiredPaths }).ok, false);

  fs.writeFileSync(path.join(specDir, "upgrade-result.json"), JSON.stringify(validArtifact({
    checkedPaths: currentRequiredPaths,
  })));
  fs.rmSync(path.join(specDir, "tests", ".raw", "upgrade.log"), { force: true });
  assert.equal(artifacts.validateUpgradeEvidenceForGate({ specDir, currentRequiredPaths }).ok, false);

  fs.writeFileSync(path.join(specDir, "tests", ".raw", "upgrade.log"), "failed\n");
  fs.writeFileSync(path.join(specDir, "upgrade-result.json"), JSON.stringify(validArtifact({
    result: "failed",
    exitCode: 1,
    checkedPaths: currentRequiredPaths,
  })));
  assert.equal(artifacts.validateUpgradeEvidenceForGate({ specDir, currentRequiredPaths }).ok, false);

  fs.writeFileSync(path.join(specDir, "upgrade-result.json"), JSON.stringify(validArtifact({
    checkedPaths: ["src/skills/sdd-forge.flow/SKILL.md"],
  })));
  assert.equal(artifacts.validateUpgradeEvidenceForGate({ specDir, currentRequiredPaths }).ok, false);

  assert.equal(artifacts.validateUpgradeEvidenceForGate({
    specDir: tmpDir(),
    currentRequiredPaths: [],
  }).ok, true);
});

test("R5: durable artifacts and report data include upgrade result and raw log", async () => {
  const artifacts = await import("../../../src/flow/lib/test-artifacts.js");
  const report = await import("../../../src/flow/lib/run-report.js");
  assert.equal(typeof report.buildUpgradeReportDataFromArtifacts, "function");

  assert.ok(artifacts.durableTestArtifactPathspecs("278-upgrade-result-artifact").includes(
    "specs/278-upgrade-result-artifact/upgrade-result.json",
  ));
  assert.ok(artifacts.durableTestArtifactPathspecs("278-upgrade-result-artifact").includes(
    "specs/278-upgrade-result-artifact/tests/.raw/upgrade.log",
  ));

  const specDir = tmpDir();
  fs.mkdirSync(path.join(specDir, "tests", ".raw"), { recursive: true });
  fs.writeFileSync(path.join(specDir, "tests", ".raw", "upgrade.log"), "no changes\n");
  fs.writeFileSync(path.join(specDir, "upgrade-result.json"), JSON.stringify(validArtifact()));
  assert.deepEqual(report.buildUpgradeReportDataFromArtifacts(specDir), {
    result: "success-no-change",
    summary: validArtifact().summary,
    rawLogPath: "tests/.raw/upgrade.log",
  });
});

test("R7: this spec-local test file declares and names every testable requirement", () => {
  const text = fs.readFileSync(import.meta.filename, "utf8");
  assert.equal(text.startsWith("// spec: R1 R2 R3 R4 R5 R7 R8\n"), true);
  for (const id of ["R1", "R2", "R3", "R4", "R5", "R7", "R8"]) {
    assert.match(text, new RegExp(`^test\\("${id}:`, "m"));
  }
});

test("R8: upgrade CLI argument parser accepts only documented boolean flags", async () => {
  const upgrade = await import("../../../src/upgrade.js");
  assert.equal(typeof upgrade.parseUpgradeArgs, "function");

  assert.deepEqual(upgrade.parseUpgradeArgs(["--dry-run"]), { dryRun: true, help: false });
  assert.deepEqual(upgrade.parseUpgradeArgs(["--help"]), { dryRun: false, help: true });
  assert.deepEqual(upgrade.parseUpgradeArgs(["-h"]), { dryRun: false, help: true });
  assert.throws(() => upgrade.parseUpgradeArgs(["--dry-run", "extra"]), /Unknown option|extra/);
  assert.throws(() => upgrade.parseUpgradeArgs(["--output", "x"]), /Unknown option|--output/);
  assert.throws(() => upgrade.parseUpgradeArgs(["--dry-run=true"]), /Unknown option|--dry-run=true/);

  const invalid = spawnSync(process.execPath, [cliPath, "upgrade", "--output", "x"], {
    cwd: tmpDir(),
    encoding: "utf8",
  });
  assert.notEqual(invalid.status, 0);
  assert.match(`${invalid.stdout}\n${invalid.stderr}`, /Unknown option: --output/);

  const valueBearingFlag = spawnSync(process.execPath, [cliPath, "upgrade", "--dry-run=true"], {
    cwd: tmpDir(),
    encoding: "utf8",
  });
  assert.notEqual(valueBearingFlag.status, 0);
  assert.match(`${valueBearingFlag.stdout}\n${valueBearingFlag.stderr}`, /Unknown option: --dry-run=true/);

  const positional = spawnSync(process.execPath, [cliPath, "upgrade", "extra"], {
    cwd: tmpDir(),
    encoding: "utf8",
  });
  assert.notEqual(positional.status, 0);
  assert.match(`${positional.stdout}\n${positional.stderr}`, /Unknown option: extra/);
});
