// spec: R1 R2 R3 R4
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import * as scenarioValidity from "../../../src/flow/lib/run-scenario-validity.js";

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function write(root, relativePath, content) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function commit(root, subject) {
  git(root, "add", ".");
  git(root, "commit", "-m", subject);
  return git(root, "rev-parse", "HEAD");
}

async function withRepository(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-scenario-validity-"));
  try {
    git(root, "init", "--initial-branch=main");
    git(root, "config", "user.email", "scenario-validity@example.test");
    git(root, "config", "user.name", "Scenario Validity Test");
    write(root, "src/stable.js", "export const stable = true;\n");
    write(root, "tests/retained.test.js", "export const retained = true;\n");
    write(root, "package.json", "{\"type\":\"module\"}\n");
    write(root, ".senti/config.json", "{}\n");
    const baselineCommit = commit(root, "baseline");
    return await callback({ root, baselineCommit });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function flowState(root, baselineCommit, runId = "flow-479") {
  const ref = `refs/senti/flows/${runId}/baseline`;
  git(root, "update-ref", ref, baselineCommit);
  return {
    runId,
    repairBaseline: {
      kind: "git",
      objectFormat: git(root, "rev-parse", "--show-object-format"),
      commitOid: baselineCommit,
      treeOid: git(root, "rev-parse", `${baselineCommit}^{tree}`),
      sourceRef: "main",
      ref,
      capturedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function writeScenarioFixture(root, requirements = ["R1"]) {
  write(root, "specs/479/spec.json", JSON.stringify({
    requirements: requirements.map((id) => ({ id, desc: `${id} behavior`, priority: "must" })),
  }, null, 2));
  write(root, "specs/479/tests/expected-failure.test.js", [
    `// spec: ${requirements.join(" ")}`,
    'import assert from "node:assert/strict";',
    'import { test } from "node:test";',
    ...requirements.map((id) => `test("${id}: fixture is executable", () => assert.equal(true, true));`),
    "",
  ].join("\n"));
}

function expectedFailureExecutor({ root, files }) {
  return files.map((file) => ({
    file,
    rel: path.relative(root, file).split(path.sep).join("/"),
    command: `node ${path.relative(root, file).split(path.sep).join("/")}`,
    process: {
      started: true,
      exitCode: 1,
      signal: null,
      timedOut: false,
      spawnError: null,
      stdout: "",
      stderr: "AssertionError: pre-implementation scenario failure",
    },
  }));
}

function scenarioCommand() {
  return new scenarioValidity.default({ scenarioTestExecutor: expectedFailureExecutor });
}

test("R1: rejects missing, mismatched, unresolvable, and ambiguous baseline authority before diffing", () => withRepository(({ root, baselineCommit }) => {
  const state = flowState(root, baselineCommit);
  const authority = scenarioValidity.resolveScenarioValidityBaselineAuthority({ root, flowState: state });
  assert.equal(authority.ref, state.repairBaseline.ref);
  assert.equal(authority.commitOid, baselineCommit);

  assert.throws(
    () => scenarioValidity.resolveScenarioValidityBaselineAuthority({ root, flowState: { runId: state.runId } }),
    { code: "REPAIR_BASELINE_REQUIRED" },
  );
  assert.throws(
    () => scenarioValidity.resolveScenarioValidityBaselineAuthority({
      root,
      flowState: { ...state, repairBaseline: { ...state.repairBaseline, commitOid: "f".repeat(baselineCommit.length) } },
    }),
    { code: "REPAIR_BASELINE_AUTHORITY_MISMATCH" },
  );
  assert.throws(
    () => scenarioValidity.resolveScenarioValidityBaselineAuthority({
      root,
      flowState: { ...state, repairBaseline: { ...state.repairBaseline, treeOid: "f".repeat(baselineCommit.length) } },
    }),
    { code: "REPAIR_BASELINE_AUTHORITY_MISMATCH" },
  );
  assert.throws(
    () => scenarioValidity.resolveScenarioValidityBaselineAuthority({
      root,
      flowState: state,
      resolveObjectFormat: () => state.repairBaseline.objectFormat === "sha1" ? "sha256" : "sha1",
    }),
    { code: "REPAIR_BASELINE_AUTHORITY_MISMATCH" },
  );
  git(root, "update-ref", "-d", state.repairBaseline.ref);
  assert.throws(
    () => scenarioValidity.resolveScenarioValidityBaselineAuthority({ root, flowState: state }),
    { code: "REPAIR_BASELINE_UNRESOLVABLE" },
  );
  assert.throws(
    () => scenarioValidity.resolveScenarioValidityBaselineAuthority({
      root,
      flowState: { ...state, repairBaseline: { ...state.repairBaseline, ref: `refs/senti/flows/${state.runId}/baseline` } },
      resolveRef: () => [baselineCommit, "e".repeat(baselineCommit.length)],
    }),
    { code: "REPAIR_BASELINE_AMBIGUOUS" },
  );
}));

test("R2: derives production changes from the immutable baseline and retains committed plus worktree detection", () => withRepository(({ root, baselineCommit }) => {
  const state = flowState(root, baselineCommit);
  git(root, "switch", "-c", "feature/479");

  git(root, "switch", "main");
  write(root, "src/upstream-only.js", "export const upstream = true;\n");
  commit(root, "upstream-only change");
  git(root, "switch", "feature/479");

  write(root, "src/committed.js", "export const committed = true;\n");
  commit(root, "feature change");
  write(root, "src/staged.js", "export const staged = true;\n");
  git(root, "add", "src/staged.js");
  write(root, "tests/retained.test.js", "export const retained = false;\n");
  write(root, "src/untracked.js", "export const untracked = true;\n");

  const authority = scenarioValidity.resolveScenarioValidityBaselineAuthority({ root, flowState: state });
  const changed = scenarioValidity.listScenarioValidityPreflightFiles({ root, baselineRef: authority.ref });
  assert.deepEqual(new Set(changed), new Set([
    "src/committed.js",
    "src/staged.js",
    "src/untracked.js",
    "tests/retained.test.js",
  ]));
  assert.equal(changed.includes("src/upstream-only.js"), false);
}));

test("R3: writes the version-1 artifact and raw log for pass, then preserves the block contract", async () => withRepository(async ({ root, baselineCommit }) => {
  const state = { ...flowState(root, baselineCommit), spec: "specs/479/spec.json" };
  writeScenarioFixture(root);
  scenarioValidity.resolveScenarioValidityBaselineAuthority({ root, flowState: state });

  const command = scenarioCommand();
  const passed = await command.execute({ root, flowState: state, config: { test: { timeoutSeconds: 5 } } });
  const specDir = path.join(root, "specs/479");
  const passArtifact = JSON.parse(fs.readFileSync(path.join(specDir, "scenario-validity-result.json"), "utf8"));
  assert.equal(passed.result, "pass");
  assert.equal(passed.next, "test-review");
  assert.equal(passArtifact.version, "1");
  assert.equal(passArtifact.result, "pass");
  assert.equal(fs.readFileSync(path.join(specDir, "tests/.raw/scenario-validity.log"), "utf8").length > 0, true);

  write(root, "src/blocked-before-implementation.js", "export const blocked = true;\n");
  const blocked = await command.execute({ root, flowState: state, config: { test: { timeoutSeconds: 5 } } });
  const blockArtifact = JSON.parse(fs.readFileSync(path.join(specDir, "scenario-validity-result.json"), "utf8"));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errors[0].code, "SCENARIO_VALIDITY_BLOCKED");
  assert.equal(blockArtifact.version, "1");
  assert.equal(blockArtifact.result, "block");
}));

test("R4: covers advanced-base exclusion, every production change class, invalid authority, and pass transition together", async () => withRepository(async ({ root, baselineCommit }) => {
  const state = { ...flowState(root, baselineCommit), spec: "specs/479/spec.json" };
  git(root, "switch", "-c", "feature/479-contract");
  git(root, "switch", "main");
  write(root, "src/upstream-only.js", "export const upstream = true;\n");
  commit(root, "advanced base");
  git(root, "switch", "feature/479-contract");
  writeScenarioFixture(root);
  const command = scenarioCommand();
  const passed = await command.execute({ root, flowState: state, config: { test: { timeoutSeconds: 5 } } });
  assert.equal(passed.result, "pass");
  assert.equal(passed.next, "test-review");

  write(root, "src/committed.js", "export const committed = true;\n");
  commit(root, "current-flow commit");
  write(root, "src/staged.js", "export const staged = true;\n");
  git(root, "add", "src/staged.js");
  write(root, "tests/retained.test.js", "export const retained = false;\n");
  write(root, "package.json", "{\"type\":\"module\",\"private\":true}\n");
  write(root, "src/untracked.js", "export const untracked = true;\n");

  const authority = scenarioValidity.resolveScenarioValidityBaselineAuthority({ root, flowState: state });
  const changed = scenarioValidity.listScenarioValidityPreflightFiles({ root, baselineRef: authority.ref });
  assert.deepEqual(new Set(changed), new Set([
    "src/committed.js",
    "src/staged.js",
    "tests/retained.test.js",
    "package.json",
    "src/untracked.js",
  ]));
  assert.equal(changed.includes("src/upstream-only.js"), false);
  assert.throws(
    () => scenarioValidity.resolveScenarioValidityBaselineAuthority({
      root,
      flowState: { ...state, repairBaseline: { ...state.repairBaseline, ref: "refs/senti/flows/another-flow/baseline" } },
    }),
    { code: "REPAIR_BASELINE_AUTHORITY_MISMATCH" },
  );

  const outcome = await command.execute({ root, flowState: state, config: { test: { timeoutSeconds: 5 } } });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.errors[0].code, "SCENARIO_VALIDITY_BLOCKED");
}));
