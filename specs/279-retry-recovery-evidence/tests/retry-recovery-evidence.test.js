// spec: R1 R2 R3 R4
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import {
  buildRecoveryEligibilityForState,
  persistCurrentRecoveryBaseline,
  resolveRecoveryEvidenceSource,
} from "../../../src/flow/lib/retry-recovery.js";

const specId = "001-test";
const specPath = `specs/${specId}/spec.json`;
const issueLogPath = `specs/${specId}/issue-log.json`;

function git(root, args) {
  execFileSync("git", args, { cwd: root, stdio: "ignore" });
}

function setupRepo() {
  const root = createTmpDir("retry-recovery-evidence-");
  writeFile(root, "src/retry-target.js", "export const value = 1;\n");
  writeJson(root, specPath, {
    goal: "fixture",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [{ id: "R1", priority: "must", status: "pending", desc: "fixture" }],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  });
  writeJson(root, issueLogPath, { entries: [] });
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-q", "-m", "baseline"]);
  return root;
}

function readJson(root, relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

function mutateSpecAcknowledgement(root) {
  const spec = readJson(root, specPath);
  spec.constraints.push("exit-code-contract acknowledged because this fixture changes recovery evidence only.");
  writeJson(root, specPath, spec);
}

function appendIssueLog(root) {
  const log = readJson(root, issueLogPath);
  log.entries.push({
    step: "impl-gate",
    reason: "audit-only entry",
    trigger: "test",
    resolution: "no source or spec change",
  });
  writeJson(root, issueLogPath, log);
}

function baselineFor(root, kind, phase) {
  const flowState = {
    spec: specPath,
    baseBranch: "main",
    reviewRecoveryBaselines: [],
  };
  persistCurrentRecoveryBaseline({
    root,
    flowState,
    kind,
    phase,
    trigger: "test-baseline",
    createdAt: "2026-06-05T00:00:00.000Z",
  });
  return flowState;
}

function evaluate(root, flowState, kind, phase) {
  return buildRecoveryEligibilityForState({
    root,
    flowState,
    kind,
    phase,
    attempts: 3,
    maxAttempts: 3,
  });
}

describe("retry recovery evidence source alignment", () => {
  const cleanup = [];
  afterEach(() => {
    while (cleanup.length > 0) removeTmpDir(cleanup.pop());
  });

  it("R1: review impl evidence source includes src and active spec.json", () => {
    const source = resolveRecoveryEvidenceSource({
      kind: "review",
      canonicalPhase: "impl",
      specDir: `specs/${specId}`,
    });
    assert.deepEqual(source.paths, ["src", specPath]);
    assert.ok(source.includes(specPath));
    assert.equal(source.includes(issueLogPath), false);
  });

  it("R2: gate task-impl evidence source includes src and active spec.json", () => {
    const source = resolveRecoveryEvidenceSource({
      kind: "gate",
      canonicalPhase: "task-impl",
      specDir: `specs/${specId}`,
    });
    assert.deepEqual(source.paths, ["src", specPath]);
    assert.ok(source.includes(specPath));
    assert.equal(source.includes(issueLogPath), false);
  });

  it("R1: R2: R4: spec.json acknowledgement changes produce changed evidence", () => {
    for (const [kind, phase] of [["review", "impl"], ["gate", "task-impl"]]) {
      const root = setupRepo();
      cleanup.push(root);
      const flowState = baselineFor(root, kind, phase);
      mutateSpecAcknowledgement(root);

      const eligibility = evaluate(root, flowState, kind, phase);
      assert.equal(eligibility.reason, "changed-evidence", `${kind}/${phase} should accept spec.json evidence`);
      assert.equal(eligibility.changedEvidence.changed, true);
      assert.ok(
        eligibility.changedEvidence.changedPaths.includes(specPath),
        `${kind}/${phase} changed paths should include spec.json`,
      );
    }
  });

  it("R3: R4: issue-log-only changes do not produce changed evidence", () => {
    for (const [kind, phase] of [["review", "impl"], ["gate", "task-impl"]]) {
      const root = setupRepo();
      cleanup.push(root);
      const flowState = baselineFor(root, kind, phase);
      appendIssueLog(root);

      const eligibility = evaluate(root, flowState, kind, phase);
      assert.equal(eligibility.recoverable, false);
      assert.equal(eligibility.reason, "unchanged-evidence");
      assert.equal(eligibility.changedEvidence.changed, false);
      assert.equal(
        eligibility.changedEvidence.changedPaths.includes(issueLogPath),
        false,
        `${kind}/${phase} changed paths must not include issue-log.json`,
      );
    }
  });

  it("R4: spec-local coverage declares all recovery evidence requirements", () => {
    const header = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n")[0];
    assert.match(header, /R1/);
    assert.match(header, /R2/);
    assert.match(header, /R3/);
    assert.match(header, /R4/);
  });
});
