import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { afterEach, describe, it } from "node:test";

import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../helpers/tmp-dir.js";
import {
  buildRecoveryEligibilityForState,
  persistCurrentRecoveryBaseline,
  resolveRecoveryEvidenceSource,
} from "../../../src/flow/lib/retry-recovery.js";

const SPEC_DIR = "specs/001-test";
const SPEC_PATH = `${SPEC_DIR}/spec.json`;
const FILE_MAP_PATH = `${SPEC_DIR}/file-map.json`;

function git(root, args) {
  execFileSync("git", args, { cwd: root, stdio: "ignore" });
}

function setupRepo() {
  const root = createTmpDir("retry-recovery-file-map-");
  writeFile(root, "src/unchanged.js", "export const unchanged = true;\n");
  writeJson(root, SPEC_PATH, { goal: "fixture" });
  writeJson(root, FILE_MAP_PATH, { R7: ["src/flow/lib/plan-rewind.js"] });
  writeJson(root, `${SPEC_DIR}/test-execute-result.json`, { version: 2, result: "pass" });
  writeJson(root, `${SPEC_DIR}/test-result-review.json`, { verdict: "pass" });
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-q", "-m", "baseline"]);
  return root;
}

function eligibility(root, flowState) {
  return buildRecoveryEligibilityForState({
    root,
    flowState,
    kind: "gate",
    phase: "integration",
    attempts: 5,
    maxAttempts: 5,
  });
}

function implReviewEligibility(root, flowState) {
  return buildRecoveryEligibilityForState({
    root,
    flowState,
    kind: "review",
    phase: "impl",
    attempts: 4,
    maxAttempts: 4,
  });
}

function specGateEligibility(root, flowState) {
  return buildRecoveryEligibilityForState({
    root,
    flowState,
    kind: "gate",
    phase: "spec",
    attempts: 5,
    maxAttempts: 5,
  });
}

describe("integration gate retry recovery file-map evidence", () => {
  const cleanup = [];
  afterEach(() => {
    while (cleanup.length > 0) removeTmpDir(cleanup.pop());
  });

  it("denies an unchanged map and accepts a file-map-only correction", () => {
    const root = setupRepo();
    cleanup.push(root);
    const flowState = {
      spec: SPEC_PATH,
      baseBranch: "main",
      reviewRecoveryBaselines: [],
    };
    const source = resolveRecoveryEvidenceSource({
      kind: "gate",
      canonicalPhase: "integration",
      specDir: SPEC_DIR,
    });
    assert.ok(source.includes(FILE_MAP_PATH));

    persistCurrentRecoveryBaseline({
      root,
      flowState,
      kind: "gate",
      phase: "integration",
      trigger: "test-baseline",
      createdAt: "2026-07-12T00:00:00.000Z",
    });
    const unchanged = eligibility(root, flowState);
    assert.equal(unchanged.recoverable, false);
    assert.equal(unchanged.reason, "unchanged-evidence");

    writeJson(root, FILE_MAP_PATH, {
      R7: ["src/lib/flow-manager.js", "src/lib/flow-store.js"],
    });
    const changed = eligibility(root, flowState);
    assert.equal(changed.recoverable, true);
    assert.equal(changed.reason, "changed-evidence");
    assert.deepEqual(changed.changedEvidence.changedPaths, [FILE_MAP_PATH]);
  });
});

describe("implementation review retry recovery evidence", () => {
  const cleanup = [];
  afterEach(() => {
    while (cleanup.length > 0) removeTmpDir(cleanup.pop());
  });

  it("accepts a spec-local test correction as changed implementation evidence", () => {
    const root = setupRepo();
    cleanup.push(root);
    const testPath = `${SPEC_DIR}/tests/final-regression.test.js`;
    writeFile(root, testPath, "test('initial', () => {});\n");
    const flowState = { spec: SPEC_PATH, baseBranch: "main", reviewRecoveryBaselines: [] };
    const source = resolveRecoveryEvidenceSource({ kind: "review", canonicalPhase: "impl", specDir: SPEC_DIR });
    assert.ok(source.includes(testPath));

    persistCurrentRecoveryBaseline({
      root,
      flowState,
      kind: "review",
      phase: "impl",
      trigger: "test-baseline",
      createdAt: "2026-07-12T00:00:00.000Z",
    });
    writeFile(root, testPath, "test('corrected', () => {});\n");

    const changed = implReviewEligibility(root, flowState);
    assert.equal(changed.recoverable, true);
    assert.deepEqual(changed.changedEvidence.changedPaths, [testPath]);
  });
});

describe("spec gate retry recovery evidence", () => {
  const cleanup = [];
  afterEach(() => {
    while (cleanup.length > 0) removeTmpDir(cleanup.pop());
  });

  it("migrates a pre-support stopped gate once, then requires changed spec evidence", () => {
    const root = setupRepo();
    cleanup.push(root);
    const flowState = { spec: SPEC_PATH, baseBranch: "main", reviewRecoveryBaselines: [] };
    const source = resolveRecoveryEvidenceSource({
      kind: "gate",
      canonicalPhase: "spec",
      specDir: SPEC_DIR,
    });
    assert.ok(source.includes(SPEC_PATH));
    assert.equal(source.includes(`${SPEC_DIR}/tests/spec-coverage.test.js`), false);

    const migrated = specGateEligibility(root, flowState);
    assert.equal(migrated.recoverable, true);
    assert.equal(migrated.changeKind, "runtime-evaluator");

    persistCurrentRecoveryBaseline({
      root,
      flowState,
      kind: "gate",
      phase: "spec",
      trigger: "test-baseline",
      createdAt: "2026-07-27T00:00:00.000Z",
    });
    const unchanged = specGateEligibility(root, flowState);
    assert.equal(unchanged.recoverable, false);
    assert.equal(unchanged.reason, "unchanged-evidence");

    writeJson(root, SPEC_PATH, { goal: "corrected fixture" });
    const changed = specGateEligibility(root, flowState);
    assert.equal(changed.recoverable, true);
    assert.equal(changed.changeKind, "project-evidence");
    assert.deepEqual(changed.changedEvidence.changedPaths, [SPEC_PATH]);
  });
});
