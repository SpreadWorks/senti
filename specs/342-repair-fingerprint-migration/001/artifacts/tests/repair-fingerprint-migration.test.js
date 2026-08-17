// spec: R1 R2 R3 R4 R5

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  buildRepairFingerprint,
  ensureRepairFingerprintContract,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import {
  captureRepairBaseline,
  readRepairFingerprintManifest,
  writeRepairFingerprintManifest,
} from "../../../src/flow/lib/repair-state-identity.js";
import { RunGateCommand } from "../../../src/flow/lib/run-gate.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

let tmp = null;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function canonicalHash(parts) {
  const hash = crypto.createHash("sha256");
  for (const part of parts) {
    hash.update(String(part));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function write(relPath, content) {
  const file = path.join(tmp, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function git(...args) {
  return execFileSync("git", args, { cwd: tmp, encoding: "utf8" }).trim();
}

function legacyV2Manifest(fingerprint) {
  const manifest = fingerprint.toJSON();
  const parts = [
    2,
    JSON.stringify({
      kind: manifest.baseline.kind,
      objectFormat: manifest.baseline.objectFormat,
      commitOid: manifest.baseline.commitOid,
      treeOid: manifest.baseline.treeOid,
    }),
    manifest.environmentHash,
    ...manifest.entries.flatMap((entry) => [
      entry.path,
      entry.oldPath || "",
      ...entry.statuses,
      entry.mode,
      entry.indexOid || "",
      entry.contentHash,
    ]),
  ];
  return { ...manifest, version: 2, hash: canonicalHash(parts) };
}

function initializeLegacyFlow() {
  tmp = createTmpDir("repair-fingerprint-v2-migration-");
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
  write(".senti/config.json", "{}\n");
  write("specs/demo/spec.json", JSON.stringify({ requirements: [] }));
  write("specs/demo/tests/demo.test.js", "export const test = true;\n");
  write("app/original.js", "export const value = 1;\n");
  git("add", ".");
  git("commit", "-q", "-m", "baseline");

  const baseline = captureRepairBaseline({ root: tmp, baseRef: "main", runId: "legacy-run" });
  const state = {
    runId: "legacy-run",
    spec: "specs/demo/spec.json",
    baseBranch: "main",
    repairBaseline: baseline.toJSON(),
    steps: [
      { id: "test-execute", status: "done" },
      { id: "test-result-review", status: "in_progress" },
      { id: "finalize-cleanup", status: "pending" },
    ],
  };
  write("app/original.js", "export const value = 2;\n");
  const current = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
  const legacy = legacyV2Manifest(current);
  write("specs/demo/repair-fingerprint.json", JSON.stringify(legacy, null, 2));
  write("specs/demo/test-execute-result.json", JSON.stringify({ repairFingerprint: legacy.hash }));
  write("specs/demo/report.json", JSON.stringify({ repairFingerprint: legacy.hash }));
  return {
    state,
    legacy,
    flowManager: { mutate(mutator) { mutator(state); } },
    specDir: path.join(tmp, "specs", "demo"),
  };
}

describe("repair fingerprint v2 migration", () => {
  // spec: R1
  it("R1: recognizes a valid legacy v2 canonical hash and rewrites the current v3 manifest", () => {
    const { state, flowManager, specDir } = initializeLegacyFlow();

    const result = ensureRepairFingerprintContract({
      root: tmp,
      state,
      flowManager,
      continueAfterMigration: true,
    });
    const current = readRepairFingerprintManifest(specDir);

    assert.equal(result.migrated, true);
    assert.equal(current.version, 3);
    assert.equal(current.hash, buildRepairFingerprint({ root: tmp, specPath: state.spec, state }).hash);
  });

  // spec: R2
  it("R2: persists an auditable v2-to-v3 migration record before invalidating evidence", () => {
    const { state, flowManager, specDir } = initializeLegacyFlow();

    ensureRepairFingerprintContract({
      root: tmp,
      state,
      flowManager,
      continueAfterMigration: true,
    });

    const migration = JSON.parse(fs.readFileSync(path.join(specDir, "repair-state-migration.json"), "utf8"));
    assert.equal(migration.runId, "legacy-run");
    assert.equal(migration.specPath, "specs/demo/spec.json");
    assert.equal(migration.sourceVersion, 2);
    assert.equal(migration.targetVersion, 3);
    assert.ok(migration.invalidations.some((entry) => entry.path === "test-execute-result.json"));
    assert.ok(migration.resetStepIds.includes("test-execute"));
  });

  // spec: R3
  it("R3: makes the integration gate return recovered and next=test-execute for a baseline-bearing v2 flow", async () => {
    const { state, flowManager, specDir } = initializeLegacyFlow();

    const result = await new RunGateCommand().execute({
      root: tmp,
      phase: "integration",
      flowState: state,
      flowManager,
      skipGuardrail: true,
    });

    assert.equal(result.result, "recovered");
    assert.equal(result.next, "test-execute");
    assert.equal(result.artifacts.evidenceRefresh.recovered, true);
    assert.equal(result.artifacts.evidenceRefresh.migration, "repair-fingerprint-v2-to-v3");
    assert.equal(state.steps[0].status, "in_progress");
    assert.equal(state.steps[1].status, "pending");
    assert.ok(!fs.existsSync(path.join(specDir, "test-execute-result.json")));
    assert.ok(!fs.existsSync(path.join(specDir, "report.json")));
  });

  // spec: R4
  it("R4: uses the migration contract to preserve evidence while malformed and unsupported artifacts fail closed", () => {
    const { state, flowManager, specDir } = initializeLegacyFlow();
    const current = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    writeRepairFingerprintManifest(specDir, current);

    assert.equal(ensureRepairFingerprintContract({
      root: tmp,
      state,
      flowManager,
      continueAfterMigration: true,
    }).migrated, false);
    assert.equal(readRepairFingerprintManifest(specDir).version, 3);

    const evidence = path.join(specDir, "test-execute-result.json");
    fs.writeFileSync(path.join(specDir, "repair-fingerprint.json"), "{not json");
    assert.throws(() => ensureRepairFingerprintContract({
      root: tmp,
      state,
      flowManager,
      continueAfterMigration: true,
    }));
    assert.ok(fs.existsSync(evidence));

    fs.writeFileSync(path.join(specDir, "repair-fingerprint.json"), JSON.stringify({ ...current.toJSON(), version: 1 }));
    assert.throws(() => ensureRepairFingerprintContract({
      root: tmp,
      state,
      flowManager,
      continueAfterMigration: true,
    }));
    assert.ok(fs.existsSync(evidence));
  });

  // spec: R5
  it("R5: keeps requirement markers beside the v2 migration, record, recovery, and regression scenarios", () => {
    const source = fs.readFileSync(new URL(import.meta.url), "utf8");
    for (const requirementId of ["R1", "R2", "R3", "R4", "R5"]) {
      assert.match(source, new RegExp(`// spec: ${requirementId}`));
      assert.match(source, new RegExp(`it\\(\\\"${requirementId}:`));
    }
  });
});
