// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function loadUpgradeArtifactsModule() {
  return import("../../../src/flow/lib/test-artifacts.js");
}

async function loadReportModule() {
  return import("../../../src/flow/lib/run-report.js");
}

function createSpecDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "upgrade-evidence-"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function writeRawLog(specDir, text = "[upgrade] no changes\n") {
  const rawPath = path.join(specDir, "tests/.raw/upgrade.log");
  fs.mkdirSync(path.dirname(rawPath), { recursive: true });
  fs.writeFileSync(rawPath, text);
}

function validUpgradeResult(overrides = {}) {
  return {
    version: "1",
    command: "sdd-forge upgrade",
    dryRun: false,
    exitCode: 0,
    result: "no_changes",
    skills: {
      updated: [],
      unchanged: ["sdd-forge.flow"],
      removed: [],
    },
    configMigration: {
      changed: false,
    },
    checkedPaths: ["src/skills", "src/presets"],
    rawLogPath: "tests/.raw/upgrade.log",
    ...overrides,
  };
}

test("R1: upgrade-result.json validator requires the machine-readable artifact fields", async () => {
  const { validateUpgradeResultArtifact } = await loadUpgradeArtifactsModule();

  assert.deepEqual(validateUpgradeResultArtifact(validUpgradeResult()).ok, true);

  for (const field of ["version", "command", "dryRun", "exitCode", "result", "skills", "configMigration", "checkedPaths", "rawLogPath"]) {
    const invalid = validUpgradeResult();
    delete invalid[field];
    assert.equal(
      validateUpgradeResultArtifact(invalid).ok,
      false,
      `${field} must be required`,
    );
  }
});

test("R2: upgrade-result.json result is constrained to the execution outcome", async () => {
  const { validateUpgradeResultArtifact } = await loadUpgradeArtifactsModule();
  const { deployPresetCopies } = await import("../../../src/lib/preset-deploy.js");

  assert.equal(validateUpgradeResultArtifact(validUpgradeResult({ result: "no_changes" })).ok, true);
  assert.equal(validateUpgradeResultArtifact(validUpgradeResult({
    result: "updated",
    skills: {
      updated: ["sdd-forge.flow"],
      unchanged: ["sdd-forge.workflow"],
      removed: [],
    },
  })).ok, true);
  assert.equal(validateUpgradeResultArtifact(validUpgradeResult({
    result: "updated",
    presetDeployment: { changed: true },
  })).ok, true);
  assert.equal(validateUpgradeResultArtifact(validUpgradeResult({ exitCode: 1, result: "failed" })).ok, true);

  assert.equal(validateUpgradeResultArtifact(validUpgradeResult({ result: "skipped" })).ok, false);
  assert.equal(validateUpgradeResultArtifact(validUpgradeResult({ exitCode: 1, result: "no_changes" })).ok, false);
  assert.equal(validateUpgradeResultArtifact(validUpgradeResult({
    result: "no_changes",
    skills: {
      updated: ["sdd-forge.flow"],
      unchanged: ["sdd-forge.workflow"],
      removed: [],
    },
  })).ok, false);
  assert.equal(validateUpgradeResultArtifact(validUpgradeResult({ result: "updated" })).ok, false);

  const workRoot = createSpecDir();
  try {
    const firstDeploy = deployPresetCopies(workRoot, { presetKeys: ["base"], languages: ["en"] });
    assert.ok(firstDeploy.some((entry) => entry.status === "updated"));
    const secondDeploy = deployPresetCopies(workRoot, { presetKeys: ["base"], languages: ["en"] });
    assert.ok(secondDeploy.every((entry) => entry.status === "unchanged"));
  } finally {
    fs.rmSync(workRoot, { recursive: true, force: true });
  }
});

test("R3: raw upgrade log must exist, be non-empty, stay bounded, and match rawLogPath", async () => {
  const { validateUpgradeEvidenceFiles, UPGRADE_RAW_OUTPUT_RELATIVE, MAX_UPGRADE_RAW_OUTPUT_BYTES } = await loadUpgradeArtifactsModule();
  const specDir = createSpecDir();
  try {
    writeJson(path.join(specDir, "upgrade-result.json"), validUpgradeResult());
    writeRawLog(specDir);

    assert.equal(UPGRADE_RAW_OUTPUT_RELATIVE, "tests/.raw/upgrade.log");
    assert.equal(validateUpgradeEvidenceFiles({ specDir }).ok, true);

    fs.writeFileSync(path.join(specDir, UPGRADE_RAW_OUTPUT_RELATIVE), "");
    assert.equal(validateUpgradeEvidenceFiles({ specDir }).ok, false);

    fs.writeFileSync(path.join(specDir, UPGRADE_RAW_OUTPUT_RELATIVE), "x".repeat(MAX_UPGRADE_RAW_OUTPUT_BYTES + 1));
    assert.equal(validateUpgradeEvidenceFiles({ specDir }).ok, false);

    writeJson(path.join(specDir, "upgrade-result.json"), validUpgradeResult({ rawLogPath: "upgrade.log" }));
    writeRawLog(specDir);
    assert.equal(validateUpgradeEvidenceFiles({ specDir }).ok, false);
  } finally {
    fs.rmSync(specDir, { recursive: true, force: true });
  }
});

test("R4: integration trust requires upgrade evidence for src/skills and src/presets changes", async () => {
  const { validateUpgradeEvidenceForChangedFiles } = await loadUpgradeArtifactsModule();
  const specDir = createSpecDir();
  try {
    assert.equal(
      validateUpgradeEvidenceForChangedFiles({
        specDir,
        changedFiles: ["src/skills/sdd-forge.flow/SKILL.md"],
      }).ok,
      false,
    );

    writeJson(path.join(specDir, "upgrade-result.json"), validUpgradeResult());
    writeRawLog(specDir);

    assert.equal(
      validateUpgradeEvidenceForChangedFiles({
        specDir,
        changedFiles: ["src/presets/base/templates/AGENTS.md"],
      }).ok,
      true,
    );
  } finally {
    fs.rmSync(specDir, { recursive: true, force: true });
  }
});

test("R5: integration trust does not require upgrade evidence for unrelated changed paths", async () => {
  const { validateUpgradeEvidenceForChangedFiles } = await loadUpgradeArtifactsModule();
  const specDir = createSpecDir();
  try {
    assert.equal(
      validateUpgradeEvidenceForChangedFiles({
        specDir,
        changedFiles: ["src/flow/lib/run-report.js", "tests/unit/report.test.js"],
      }).ok,
      true,
    );
  } finally {
    fs.rmSync(specDir, { recursive: true, force: true });
  }
});

test("R6: failed upgrade artifacts block gate trust with exitCode and result in the message", async () => {
  const { validateUpgradeEvidenceForChangedFiles } = await loadUpgradeArtifactsModule();
  const specDir = createSpecDir();
  try {
    writeJson(path.join(specDir, "upgrade-result.json"), validUpgradeResult({ exitCode: 2, result: "failed" }));
    writeRawLog(specDir, "upgrade failed\n");

    const result = validateUpgradeEvidenceForChangedFiles({
      specDir,
      changedFiles: ["src/skills/sdd-forge.flow/SKILL.md"],
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /upgrade-result\.json exitCode=2 result=failed/);
  } finally {
    fs.rmSync(specDir, { recursive: true, force: true });
  }
});

test("R7: no-change upgrade evidence is valid and distinguishes execution from missing execution", async () => {
  const { validateUpgradeEvidenceForChangedFiles } = await loadUpgradeArtifactsModule();
  const specDir = createSpecDir();
  try {
    writeJson(path.join(specDir, "upgrade-result.json"), validUpgradeResult());
    writeRawLog(specDir, "[upgrade] no changes\n");

    const result = validateUpgradeEvidenceForChangedFiles({
      specDir,
      changedFiles: ["src/presets/base/preset.json"],
    });
    assert.equal(result.ok, true);
  } finally {
    fs.rmSync(specDir, { recursive: true, force: true });
  }
});

test("R8: durable artifact pathspecs include upgrade evidence without dropping existing artifacts", async () => {
  const { durableTestArtifactPathspecs } = await loadUpgradeArtifactsModule();
  const pathspecs = durableTestArtifactPathspecs("278-upgrade-evidence-artifact");

  assert.ok(pathspecs.includes("specs/278-upgrade-evidence-artifact/upgrade-result.json"));
  assert.ok(pathspecs.includes("specs/278-upgrade-evidence-artifact/tests/.raw/upgrade.log"));
  assert.ok(pathspecs.includes("specs/278-upgrade-evidence-artifact/test-execute-result.json"));
  assert.ok(pathspecs.includes("specs/278-upgrade-evidence-artifact/report.json"));
});

test("R9: report summary maps upgrade evidence into upgradeEvidence fields", async () => {
  const { buildUpgradeEvidenceReportSummary } = await loadReportModule();
  const summary = buildUpgradeEvidenceReportSummary({
    artifactPath: "specs/278-upgrade-evidence-artifact/upgrade-result.json",
    artifact: validUpgradeResult({
      result: "updated",
      skills: {
        updated: ["sdd-forge.flow"],
        unchanged: ["sdd-forge.workflow"],
        removed: ["sdd-forge.flow-legacy"],
      },
      configMigration: { changed: true },
    }),
  });

  assert.deepEqual(summary, {
    artifactPath: "specs/278-upgrade-evidence-artifact/upgrade-result.json",
    rawLogPath: "tests/.raw/upgrade.log",
    exitCode: 0,
    result: "updated",
    updatedCount: 1,
    unchangedCount: 1,
    removedCount: 1,
    configMigrationChanged: true,
  });
});

test("R10: upgrade command user-facing argument metadata remains --dry-run and --help only", async () => {
  const { parseUpgradeArgs, upgradeUserFacingArguments } = await import("../../../src/upgrade.js");

  assert.deepEqual(upgradeUserFacingArguments(), [
    { name: "--dry-run", type: "boolean flag", takesValue: false, range: null },
    { name: "--help", type: "boolean flag", takesValue: false, range: null },
  ]);
  assert.deepEqual(parseUpgradeArgs(["--dry-run"]), { dryRun: true, help: false });
  assert.deepEqual(parseUpgradeArgs(["--help"]), { dryRun: false, help: true });
  assert.throws(() => parseUpgradeArgs(["--upgrade-result", "out.json"]), /Unknown option: --upgrade-result/);
});

test("R11: this spec-local test file declares and names every testable requirement", () => {
  const source = fs.readFileSync(import.meta.filename, "utf8");
  const header = source.match(/^\/\/ spec: (.+)$/m);
  assert.ok(header, "spec header is required");

  for (const id of header[1].trim().split(/\s+/)) {
    assert.match(source, new RegExp(`test\\(\"${id}:`));
  }
});
