// spec: R1 R2 R3 R4 R5 R6 R7 R8
// shared-test: tests/unit/flow/stale-test-evidence-refresh.test.js
// shared-test: tests/unit/flow/upgrade-required-changed-paths.test.js
// shared-test: tests/unit/flow/gate-phase-inference.test.js
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  matchUpgradeRequiredSourcePaths,
  upgradeRawLogPath,
  upgradeResultPath,
  validateUpgradeEvidenceForGate,
  validateUpgradeResultArtifact,
  writeUpgradeResultArtifact,
} from "../../../src/flow/lib/test-artifacts.js";
import { RepairArtifactRegistry } from "../../../src/flow/lib/repair-state-identity.js";
import {
  createTmpDir,
  removeTmpDir,
  writeFile,
  writeJson,
} from "../../../tests/helpers/tmp-dir.js";

const temporaryRoots = [];
const currentFingerprint = "a".repeat(64);
const target = Object.freeze({
  runId: "spec-481-test-run",
  issue: 481,
  spec: "specs/demo/spec.json",
});

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) removeTmpDir(root);
});

function fixture() {
  const root = createTmpDir("spec-481-upgrade-evidence-");
  temporaryRoots.push(root);
  const specDir = path.join(root, "specs", "demo");
  fs.mkdirSync(specDir, { recursive: true });
  return { root, specDir };
}

function writeEvidence(specDir, {
  checkedPaths = ["src/skills/demo.md"],
  fingerprint = currentFingerprint,
  evidenceTarget = target,
  recoveryDecision = null,
  rawLog = true,
  rawLogContent = "upgrade output\n",
  authority = true,
} = {}) {
  const rawPath = upgradeRawLogPath(specDir);
  fs.mkdirSync(path.dirname(rawPath), { recursive: true });
  if (rawLog) fs.writeFileSync(rawPath, rawLogContent);
  writeJson(specDir, "upgrade-result.json", {
    version: 1,
    command: "senti upgrade",
    dryRun: false,
    exitCode: 0,
    result: "success-updated",
    summary: {},
    checkedPaths,
    rawLogPath: "tests/.raw/upgrade.log",
  });
  if (authority) {
    writeJson(specDir, "upgrade-recovery-audit.json", {
      version: 1,
      decision: recoveryDecision ?? "reuse",
      action: recoveryDecision ?? "reuse",
      reason: null,
      currentFingerprint: fingerprint,
      target: evidenceTarget,
      checkedPaths,
      artifactPaths: ["upgrade-result.json", "tests/.raw/upgrade.log"],
      rawLogDigest: crypto.createHash("sha256").update(rawLogContent).digest("hex"),
      nextActiveStep: "impl-gate",
    });
  }
}

async function recovery(specDir, requiredPaths) {
  const { UpgradeEvidenceRecovery } = await import("../../../src/flow/lib/test-artifacts.js");
  return new UpgradeEvidenceRecovery({
    specDir,
    currentFingerprint,
    currentRequiredPaths: requiredPaths,
    target,
  });
}

// spec: R1
test("R1: upgrade-unrelated recovery bypasses upgrade execution", async () => {
  const { specDir } = fixture();
  let calls = 0;

  const result = (await recovery(specDir, [])).resolve({
    runUpgrade() {
      calls += 1;
      throw new Error("upgrade must not run");
    },
  });

  assert.equal(result.decision, "missing");
  assert.equal(result.action, "bypass");
  assert.equal(result.reason, "not-required");
  assert.equal(calls, 0);
  assert.equal(fs.existsSync(upgradeResultPath(specDir)), false);
});

// spec: R1
test("R1: upgrade-unrelated recovery bypasses malformed leftover evidence", async () => {
  const { specDir } = fixture();
  fs.writeFileSync(upgradeResultPath(specDir), "{\"version\":");

  const result = (await recovery(specDir, [])).resolve({
    runUpgrade() {
      throw new Error("upgrade must not run");
    },
  });

  assert.equal(result.decision, "missing");
  assert.equal(result.action, "bypass");
});

// spec: R2
test("R2: current authoritative evidence is reused without upgrade", async () => {
  const { specDir } = fixture();
  writeEvidence(specDir);
  let calls = 0;

  const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
    runUpgrade() {
      calls += 1;
    },
  });

  assert.equal(result.decision, "reuse");
  assert.equal(result.currentFingerprint, currentFingerprint);
  assert.deepEqual(result.checkedPaths, ["src/skills/demo.md"]);
  assert.equal(calls, 0);
});

// spec: R2 R5
test("R2: authorityless public evidence is regenerated before canonical reuse", async () => {
  const { specDir } = fixture();
  writeEvidence(specDir, { authority: false });
  let calls = 0;

  const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
    runUpgrade() {
      calls += 1;
      writeEvidence(specDir, { authority: false });
    },
  });

  assert.equal(result.decision, "stale");
  assert.equal(result.action, "regenerate");
  assert.equal(calls, 1);
});

// spec: R2 R5
test("R2: stale fingerprint and mismatched target authority are never reused", async () => {
  for (const evidence of [
    { fingerprint: "b".repeat(64), evidenceTarget: target, reason: "stale fingerprint" },
    { fingerprint: currentFingerprint, evidenceTarget: { ...target, runId: "other-run" }, reason: "target mismatch" },
  ]) {
    const { specDir } = fixture();
    writeEvidence(specDir, evidence);
    let calls = 0;
    const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
      runUpgrade() {
        calls += 1;
        writeEvidence(specDir);
      },
    });
    assert.equal(result.decision, "stale", evidence.reason);
    assert.equal(result.action, "regenerate", evidence.reason);
    assert.equal(calls, 1, evidence.reason);
  }
});

// spec: R2 R5
test("R2: a raw log whose bytes differ from the audit evidence is regenerated", async () => {
  const { specDir } = fixture();
  writeEvidence(specDir, { rawLogContent: "recorded upgrade output\n" });
  fs.writeFileSync(upgradeRawLogPath(specDir), "different raw log\n");
  let calls = 0;

  const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
    runUpgrade() {
      calls += 1;
      writeEvidence(specDir);
    },
  });

  assert.equal(result.decision, "stale");
  assert.equal(result.action, "regenerate");
  assert.equal(calls, 1);
});

// spec: R3
test("R3: missing or stale evidence is regenerated before impl-gate", async () => {
  for (const setup of [
    () => {},
    (specDir) => writeEvidence(specDir, { checkedPaths: ["src/presets/old.json"] }),
  ]) {
    const { specDir } = fixture();
    setup(specDir);
    let calls = 0;

    const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
      runUpgrade() {
        calls += 1;
        writeEvidence(specDir);
      },
    });

    assert.match(result.decision, /missing|stale/);
    assert.equal(result.action, "regenerate");
    assert.equal(calls, 1);
    assert.equal(fs.existsSync(upgradeResultPath(specDir)), true);
    assert.equal(fs.existsSync(upgradeRawLogPath(specDir)), true);
    const regenerated = JSON.parse(fs.readFileSync(upgradeResultPath(specDir), "utf8"));
    assert.deepEqual(regenerated.checkedPaths, ["src/skills/demo.md"]);
  }
});

// spec: R4
test("R4: recovery decision records current authority and next step", async () => {
  const { specDir } = fixture();
  const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
    runUpgrade() {
      writeEvidence(specDir);
    },
  });

  assert.equal(result.currentFingerprint, currentFingerprint);
  assert.deepEqual(result.target, target);
  assert.equal(result.nextActiveStep, "impl-gate");
  assert.ok(result.artifactPaths.includes("upgrade-result.json"));
  assert.ok(result.artifactPaths.includes("tests/.raw/upgrade.log"));
});

// spec: R4
test("R4: recovery writes the complete decision to a durable flow audit artifact", async () => {
  const { specDir } = fixture();
  const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
    runUpgrade() {
      writeEvidence(specDir);
    },
  });

  const auditPath = path.join(specDir, "upgrade-recovery-audit.json");
  assert.equal(result.auditArtifactPath, auditPath);
  const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  assert.equal(audit.version, 1);
  assert.equal(audit.decision, "missing");
  assert.equal(audit.action, "regenerate");
  assert.equal(audit.reason, "missing");
  assert.equal(audit.currentFingerprint, currentFingerprint);
  assert.deepEqual(audit.checkedPaths, ["src/skills/demo.md"]);
  assert.deepEqual(audit.artifactPaths, ["upgrade-result.json", "tests/.raw/upgrade.log"]);
  assert.equal(audit.nextActiveStep, "impl-gate");
});

// spec: R4
test("R4: preserve, reuse, missing, and stale decisions are audited with their action", async () => {
  const cases = [
    { decision: "preserve", setup: (specDir) => writeEvidence(specDir, { recoveryDecision: "preserve" }) },
    { decision: "reuse", setup: (specDir) => writeEvidence(specDir) },
    { decision: "missing", action: "regenerate", reason: "missing", setup: () => {} },
    { decision: "stale", action: "regenerate", reason: "authority mismatch", setup: (specDir) => writeEvidence(specDir, { fingerprint: "b".repeat(64) }) },
    { decision: "stale", action: "regenerate", reason: "checkedPaths mismatch", setup: (specDir) => writeEvidence(specDir, { checkedPaths: ["src/presets/old.json"] }) },
  ];
  for (const entry of cases) {
    const { specDir } = fixture();
    entry.setup(specDir);
    const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
      runUpgrade() { writeEvidence(specDir); },
    });
    assert.equal(result.audit.decision, entry.decision);
    assert.equal(result.audit.action, entry.action ?? entry.decision);
    assert.equal(result.audit.reason, entry.reason ?? null);
    assert.equal(result.audit.currentFingerprint, currentFingerprint);
    assert.deepEqual(result.audit.target, target);
    assert.deepEqual(result.audit.checkedPaths, ["src/skills/demo.md"]);
    assert.deepEqual(result.audit.artifactPaths, ["upgrade-result.json", "tests/.raw/upgrade.log"]);
    assert.equal(result.audit.nextActiveStep, "impl-gate");
  }
});

// spec: R3
test("R3: malformed, failed, or unowned evidence is regenerated before impl-gate", async () => {
  for (const mutate of [
    (specDir) => fs.writeFileSync(upgradeResultPath(specDir), "{\"version\":"),
    (specDir) => writeEvidence(specDir, { rawLog: false }),
    (specDir) => {
      writeEvidence(specDir);
      const artifact = JSON.parse(fs.readFileSync(upgradeResultPath(specDir), "utf8"));
      artifact.result = "failed";
      fs.writeFileSync(upgradeResultPath(specDir), `${JSON.stringify(artifact)}\n`);
    },
  ]) {
    const { specDir } = fixture();
    mutate(specDir);
    let calls = 0;
    const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
      runUpgrade() {
        calls += 1;
        writeEvidence(specDir);
      },
    });
    assert.equal(result.decision, "stale");
    assert.equal(result.action, "regenerate");
    assert.equal(calls, 1);
  }
});

// spec: R5
test("R5: impl-gate validator rejects stale checkedPaths and authority as current evidence", () => {
  for (const evidence of [
    { checkedPaths: ["src/presets/old.json"], fingerprint: currentFingerprint, evidenceTarget: target },
    { checkedPaths: ["src/skills/demo.md"], fingerprint: currentFingerprint, evidenceTarget: { ...target, runId: "other-run" } },
    { checkedPaths: ["src/skills/demo.md"], authority: false },
  ]) {
    const { specDir } = fixture();
    writeEvidence(specDir, evidence);
    const result = validateUpgradeEvidenceForGate({
      specDir,
      currentRequiredPaths: ["src/skills/demo.md"],
      currentFingerprint,
      target,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /checkedPaths|authority|fingerprint|missing/i);
  }
});

// spec: R5
test("R5: impl-gate validator rejects missing raw logs, malformed results, and failed upgrades", () => {
  for (const mutate of [
    (specDir) => writeEvidence(specDir, { rawLog: false }),
    (specDir) => fs.writeFileSync(upgradeResultPath(specDir), "{\"version\":"),
    (specDir) => {
      writeEvidence(specDir);
      const artifact = JSON.parse(fs.readFileSync(upgradeResultPath(specDir), "utf8"));
      artifact.result = "failed";
      fs.writeFileSync(upgradeResultPath(specDir), `${JSON.stringify(artifact)}\n`);
    },
  ]) {
    const { specDir } = fixture();
    mutate(specDir);
    const result = validateUpgradeEvidenceForGate({
      specDir,
      currentRequiredPaths: ["src/skills/demo.md"],
      currentFingerprint,
      target,
    });
    assert.equal(result.ok, false);
    assert.equal(typeof result.reason, "string");
    assert.ok(result.reason.length > 0);
  }
});

// spec: R6
test("R6: repeated stale recoveries each restore current upgrade evidence", async () => {
  const { specDir } = fixture();
  let calls = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    writeEvidence(specDir, { fingerprint: "b".repeat(64) });
    const recovered = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
      runUpgrade() { calls += 1; writeEvidence(specDir); },
    });
    assert.equal(recovered.action, "regenerate");
    assert.equal(recovered.nextActiveStep, "impl-gate");
  }
  const current = (await recovery(specDir, ["src/skills/demo.md"])).resolve({ runUpgrade: null });
  assert.match(current.decision, /preserve|reuse/);
  assert.equal(current.nextActiveStep, "impl-gate");
  assert.equal(calls, 2);
  assert.equal(fs.existsSync(upgradeResultPath(specDir)), true);
});

// spec: R3 R6
test("R3: regenerated evidence binds to the fingerprint observed after upgrade", async () => {
  const { specDir } = fixture();
  const refreshedFingerprint = "c".repeat(64);

  const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
    runUpgrade() {
      writeEvidence(specDir);
    },
    refreshCurrentFingerprint() {
      return refreshedFingerprint;
    },
  });

  assert.equal(result.currentFingerprint, refreshedFingerprint);
  const refreshed = validateUpgradeEvidenceForGate({
    specDir,
    currentRequiredPaths: ["src/skills/demo.md"],
    currentFingerprint: refreshedFingerprint,
    target,
  });
  assert.equal(refreshed.ok, true);
  const obsolete = validateUpgradeEvidenceForGate({
    specDir,
    currentRequiredPaths: ["src/skills/demo.md"],
    currentFingerprint,
    target,
  });
  assert.equal(obsolete.ok, false);
  assert.match(obsolete.reason, /fingerprint mismatch/);
});

// spec: R7
test("R7: decision variants remain auditable contracts", async () => {
  const { specDir } = fixture();
  writeEvidence(specDir);
  const reused = (await recovery(specDir, ["src/skills/demo.md"])).resolve({ runUpgrade: null });
  assert.match(reused.decision, /preserve|reuse/);

  fs.rmSync(upgradeResultPath(specDir));
  const regenerated = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
    runUpgrade() {
      writeEvidence(specDir);
    },
  });
  assert.equal(regenerated.action, "regenerate");
});

// spec: R7
test("R7: non-upgrade source paths bypass upgrade evidence", async () => {
  assert.deepEqual(matchUpgradeRequiredSourcePaths([
    "src/flow/lib/run-gate.js",
    "tests/unit/flow/review-convergence.test.js",
  ]), []);
  const { specDir } = fixture();
  const result = (await recovery(specDir, matchUpgradeRequiredSourcePaths(["src/flow/lib/run-gate.js"]))).resolve({
    runUpgrade() { throw new Error("upgrade must not run"); },
  });
  assert.equal(result.decision, "missing");
  assert.equal(result.action, "bypass");
  assert.equal(result.nextActiveStep, "impl-gate");
});

// spec: R7
test("R7: impl-gate integration consumes recovered current evidence", async () => {
  const { specDir } = fixture();
  const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
    runUpgrade() { writeEvidence(specDir); },
  });
  assert.equal(result.nextActiveStep, "impl-gate");
  assert.equal(result.action, "regenerate");
  assert.equal(fs.existsSync(upgradeResultPath(specDir)), true);
  assert.equal(fs.existsSync(upgradeRawLogPath(specDir)), true);
});

// spec: R8
test("R8: recovered evidence preserves the public upgrade-result and raw-log contract", async () => {
  const { root, specDir } = fixture();
  writeFile(root, "src/skills/demo/SKILL.md", "# Demo\n");

  let upgradeCalls = 0;
  const result = (await recovery(specDir, ["src/skills/demo.md"])).resolve({
    runUpgrade() {
      upgradeCalls += 1;
      writeUpgradeResultArtifact({
        root,
        specDir,
        baseBranch: null,
        command: "senti upgrade",
        dryRun: false,
        exitCode: 0,
        result: "success-updated",
        summary: {},
        rawOutput: "upgrade output\n",
      });
      const artifact = JSON.parse(fs.readFileSync(upgradeResultPath(specDir), "utf8"));
      artifact.checkedPaths = ["src/skills/demo.md"];
      fs.writeFileSync(upgradeResultPath(specDir), `${JSON.stringify(artifact, null, 2)}\n`);
    },
  });

  assert.equal(upgradeCalls, 1);
  assert.deepEqual(result.artifactPaths, ["upgrade-result.json", "tests/.raw/upgrade.log"]);
  assert.equal(path.basename(result.auditArtifactPath), "upgrade-recovery-audit.json");

  const artifact = JSON.parse(fs.readFileSync(upgradeResultPath(specDir), "utf8"));
  assert.equal(artifact.version, 1);
  assert.equal(artifact.command, "senti upgrade");
  assert.equal(artifact.rawLogPath, "tests/.raw/upgrade.log");
  assert.equal(Object.hasOwn(artifact, "rawLogDigest"), false);
  assert.equal(Object.hasOwn(artifact, "recoveryAuthority"), false);
  assert.deepEqual(artifact.checkedPaths, ["src/skills/demo.md"]);
  const audit = JSON.parse(fs.readFileSync(result.auditArtifactPath, "utf8"));
  assert.match(audit.rawLogDigest, /^[a-f0-9]{64}$/);

  const gateEvidence = validateUpgradeEvidenceForGate({
    specDir,
    currentRequiredPaths: ["src/skills/demo.md"],
  });
  assert.equal(gateEvidence.ok, true);
  assert.deepEqual(gateEvidence.artifact.checkedPaths, ["src/skills/demo.md"]);
});

// spec: R5 R8
test("R8: public validation ignores stale recovery authority while gate validation rejects it", () => {
  const { specDir } = fixture();
  writeEvidence(specDir, { rawLogContent: "recovered output\n" });

  fs.writeFileSync(upgradeRawLogPath(specDir), "later user upgrade output\n");
  const artifact = JSON.parse(fs.readFileSync(upgradeResultPath(specDir), "utf8"));

  const publicValidation = validateUpgradeResultArtifact(specDir, artifact);
  assert.equal(publicValidation.ok, true);

  const gateValidation = validateUpgradeEvidenceForGate({
    specDir,
    currentRequiredPaths: ["src/skills/demo.md"],
    currentFingerprint,
    target,
  });
  assert.equal(gateValidation.ok, false);
  assert.match(gateValidation.reason, /rawLogDigest mismatch/);
});

// spec: R4 R8
test("R8: the recovery audit is owned workflow evidence, not repair fingerprint input", () => {
  const registry = new RepairArtifactRegistry("specs/demo/spec.json");
  assert.equal(registry.owns("specs/demo/upgrade-recovery-audit.json"), true);
  assert.ok(registry.gitPathspecExcludes().includes(
    ":(exclude,top,literal)specs/demo/upgrade-recovery-audit.json",
  ));
});
