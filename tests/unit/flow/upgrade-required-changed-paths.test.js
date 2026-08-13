import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";
import {
  matchUpgradeRequiredSourcePaths,
  listUpgradeRequiredChangedPaths,
  validateUpgradeResultArtifact,
  writeUpgradeResultArtifact,
} from "../../../src/flow/lib/test-artifacts.js";
import { buildUpgradeReportDataFromArtifacts } from "../../../src/flow/lib/run-report.js";

let tmp;

function git(args) {
  return execFileSync("git", args, { cwd: tmp, encoding: "utf8" });
}

function initRepo() {
  tmp = createTmpDir("sennel-upgrade-paths-");
  git(["init"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test User"]);
  writeFile(tmp, "src/presets/base/guardrail.json", "{\"guardrails\":[]}\n");
  writeFile(tmp, "README.md", "initial\n");
  git(["add", "."]);
  git(["commit", "-m", "initial"]);
  git(["branch", "-M", "main"]);
}

describe("listUpgradeRequiredChangedPaths", () => {
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("includes uncommitted upgrade-required source edits", () => {
    initRepo();
    writeFile(tmp, "src/presets/base/guardrail.json", "{\"guardrails\":[{\"id\":\"migration-parity\"}]}\n");
    writeFile(tmp, "README.md", "changed\n");

    assert.deepEqual(
      listUpgradeRequiredChangedPaths({ root: tmp, baseBranch: "main" }),
      ["src/presets/base/guardrail.json"],
    );
  });

  it("includes untracked upgrade-required source files", () => {
    initRepo();
    writeFile(tmp, "src/skills/example/SKILL.md", "# Example\n");

    assert.deepEqual(
      listUpgradeRequiredChangedPaths({ root: tmp, baseBranch: "main" }),
      ["src/skills/"],
    );
  });

  it("uses the canonical upgrade evidence source path matcher", () => {
    assert.deepEqual(
      matchUpgradeRequiredSourcePaths([
        "src/skills/demo/SKILL.md",
        "src/presets/base/preset.json",
        "src/templates/partials/example.md",
        "src/flow/lib/run-gate.js",
        "tests/unit/flow/upgrade-required-changed-paths.test.js",
      ]),
      [
        "src/presets/base/preset.json",
        "src/skills/demo/SKILL.md",
        "src/templates/partials/example.md",
      ],
    );
  });

  it("keeps the structured upgrade result authoritative when its diagnostic log is absent", () => {
    initRepo();
    writeFile(tmp, "src/presets/base/guardrail.json", "{\"guardrails\":[{\"id\":\"migration-parity\"}]}\n");
    const specDir = path.join(tmp, "specs", "demo");
    const written = writeUpgradeResultArtifact({
      root: tmp,
      specDir,
      baseBranch: "main",
      command: "sennel upgrade",
      dryRun: false,
      exitCode: 1,
      result: "failed",
      summary: { error: "upgrade failed" },
      rawOutput: "diagnostic output\n",
    });
    fs.unlinkSync(written.rawLogPath);

    const validation = validateUpgradeResultArtifact(specDir, written.artifact);
    assert.equal(validation.ok, true);
    assert.equal(validation.rawPath, null);
    assert.equal(written.artifact.failureReason, "upgrade failed");
    assert.deepEqual(buildUpgradeReportDataFromArtifacts(specDir), {
      result: "failed",
      summary: { error: "upgrade failed" },
      failureReason: "upgrade failed",
      rawLogPath: null,
    });
  });
});
