import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { createTmpDir, removeTmpDir, writeJson } from "../../../helpers/tmp-dir.js";
import { commitAll, initGitRepo } from "../../../helpers/git-repo.js";
import {
  makeDefaultTask,
  makeFlowManager,
  makeFlowState,
  moveFlowToStep,
} from "../../../helpers/flow-setup.js";
import { findStepById } from "../../../../src/flow/lib/step-tree.js";
import { buildRepairFingerprint } from "../../../../src/flow/lib/impl-repair-artifacts.js";
import { resolveCurrentReviewTreeSha } from "../../../../src/flow/lib/review-evidence-store.js";

const SENNEL = path.resolve("src/sennel.js");

function invoke(root, args) {
  const result = spawnSync(process.execPath, [SENNEL, "flow", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENNEL_WORK_ROOT: root, SENNEL_SOURCE_ROOT: root },
  });
  let envelope;
  try {
    envelope = JSON.parse(result.stdout);
  } catch {
    assert.fail(`CLI did not return an envelope.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
  return { ...result, envelope };
}

function guards(state) {
  return [
    "--expect-run-id", state.runId,
    "--expect-no-issue",
    "--expect-spec", state.specId,
  ];
}

test("nonblocking policy keeps normal Flow ownership", () => {
  const root = createTmpDir("sennel-nonblocking-policy-e2e-");
  try {
    const specId = "477-nonblocking-e2e";
    const spec = `specs/${specId}/spec.json`;
    const evidence = JSON.stringify({ verdict: "REJECTED" }, null, 2) + "\n";
    writeJson(root, ".sennel/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      commands: { gh: "disable" },
    });
    writeJson(root, spec, { requirements: [] });
    fs.writeFileSync(path.join(root, `specs/${specId}/impl-review.json`), evidence);

    const state = moveFlowToStep(makeFlowState({
      specId,
      runId: "run-477-nonblocking-e2e",
      baseBranch: "main",
      featureBranch: "main",
    }), "impl-review");
    writeJson(root, `specs/${specId}/flow.json`, state);
    makeFlowManager(root).addActiveFlow(specId, "local");
    initGitRepo(root);
    commitAll(root, "initial flow fixture");

    const policy = invoke(root, [
      "set", "policy", "nonblocking",
      "--reason", "The strict implementation review has reached a user decision.",
      ...guards(state),
    ]);
    assert.equal(policy.status, 0, policy.stderr || policy.stdout);
    assert.equal(policy.envelope.ok, true);
    assert.equal(policy.envelope.data.enabled, true);

    const next = invoke(root, ["get", "next-action", ...guards(state)]);
    assert.equal(next.status, 0, next.stderr || next.stdout);
    assert.deepEqual(next.envelope.data.nonblockingDecision.allowedActions, ["repair", "continue"]);
    const digest = next.envelope.data.nonblockingDecision.evidenceDigest;
    assert.equal(digest, crypto.createHash("sha256").update(evidence).digest("hex"));

    const continued = invoke(root, [
      "set", "nonblocking-decision",
      "--choice", "continue",
      "--reason", "The requested behavior is complete despite the review finding.",
      "--remaining-risk", "The rejected review artifact remains in the completion evidence.",
      "--expect-evidence-digest", digest,
      ...guards(state),
    ]);
    assert.equal(continued.status, 0, continued.stderr || continued.stdout);
    assert.equal(continued.envelope.data.action, "continue");

    const persisted = JSON.parse(fs.readFileSync(path.join(root, `specs/${specId}/flow.json`), "utf8"));
    assert.equal(findStepById(persisted.steps, "impl-review").status, "done");
    assert.equal(findStepById(persisted.steps, "impl-gate").status, "in_progress");
    assert.equal(
      persisted.stepAttempts.some((entry) => entry.outcome?.kind === "nonblocking-decision" && entry.outcome.action === "continue"),
      true,
    );
  } finally {
    removeTmpDir(root);
  }
});

test("nonblocking test-review continuation creates an acceptance disposition handoff", () => {
  const root = createTmpDir("sennel-nonblocking-test-review-e2e-");
  try {
    const specId = "477-test-review-nonblocking-e2e";
    const spec = `specs/${specId}/spec.json`;
    const evidence = JSON.stringify({
      verdict: "REJECTED",
      blockingFindings: [{
        findingId: "missing-test-behavior",
        fingerprint: "a".repeat(64),
        disposition: "must-fix",
        rationale: "The test design omits a required acceptance behavior.",
        category: "semantic",
        title: "Missing acceptance behavior test",
      }],
    }, null, 2) + "\n";
    writeJson(root, ".sennel/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      commands: { gh: "disable" },
    });
    writeJson(root, spec, { requirements: [] });
    fs.writeFileSync(path.join(root, `specs/${specId}/test-review.json`), evidence);

    const state = moveFlowToStep(makeFlowState({
      specId,
      runId: "run-477-test-review-nonblocking-e2e",
      baseBranch: "main",
      featureBranch: "main",
    }), "test-review");
    writeJson(root, `specs/${specId}/flow.json`, state);
    makeFlowManager(root).addActiveFlow(specId, "local");
    initGitRepo(root);
    commitAll(root, "initial test-review flow fixture");

    const policy = invoke(root, [
      "set", "policy", "nonblocking",
      "--reason", "The strict test review reached a bounded continuation decision.",
      ...guards(state),
    ]);
    assert.equal(policy.status, 0, policy.stderr || policy.stdout);
    assert.equal(policy.envelope.data.activatedStep, "test-review");

    const next = invoke(root, ["get", "next-action", ...guards(state)]);
    assert.equal(next.status, 0, next.stderr || next.stdout);
    assert.deepEqual(next.envelope.data.nonblockingDecision.allowedActions, ["repair", "continue"]);
    const digest = next.envelope.data.nonblockingDecision.evidenceDigest;
    assert.equal(digest, crypto.createHash("sha256").update(evidence).digest("hex"));

    const continued = invoke(root, [
      "set", "nonblocking-decision",
      "--choice", "continue",
      "--reason", "Implementation can proceed while acceptance retains the finding.",
      "--remaining-risk", "Acceptance review must disposition the deferred test-review finding.",
      "--expect-evidence-digest", digest,
      ...guards(state),
    ]);
    assert.equal(continued.status, 0, continued.stderr || continued.stdout);
    assert.equal(continued.envelope.data.sourceStep, "test-review");

    const specDir = path.join(root, `specs/${specId}`);
    const persisted = JSON.parse(fs.readFileSync(path.join(specDir, "flow.json"), "utf8"));
    assert.equal(findStepById(persisted.steps, "test-review").status, "done");
    assert.equal(findStepById(persisted.steps, "implement").status, "in_progress");
    const deferred = JSON.parse(fs.readFileSync(path.join(specDir, "flow-findings.json"), "utf8"));
    assert.deepEqual(deferred.entries.map((entry) => ({
      sourceStep: entry.sourceStep,
      sourceArtifact: entry.sourceArtifact,
      sourceFindingId: entry.sourceFindingId,
      finalDisposition: entry.finalDisposition,
    })), [{
      sourceStep: "test-review",
      sourceArtifact: "test-review.json",
      sourceFindingId: "missing-test-behavior",
      finalDisposition: "still_open",
    }]);
  } finally {
    removeTmpDir(root);
  }
});

test("strict semantic exhaustion completes its acceptance handoff without advisory activation", () => {
  const root = createTmpDir("sennel-strict-review-exhaustion-e2e-");
  try {
    const specId = "481-strict-review-exhaustion-e2e";
    const spec = `specs/${specId}/spec.json`;
    const finding = {
      findingId: "missing-test-behavior",
      fingerprint: "a".repeat(64),
      disposition: "must-fix",
      rationale: "The test design omits a required acceptance behavior.",
      category: "semantic",
      title: "Missing acceptance behavior test",
    };
    writeJson(root, ".sennel/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      commands: { gh: "disable" },
    });
    writeJson(root, spec, { requirements: [] });
    writeJson(root, `specs/${specId}/test-review.json`, {
      verdict: "REJECTED",
      blockingFindings: [finding],
    });
    const state = moveFlowToStep(makeFlowState({
      specId,
      runId: "run-481-strict-review-exhaustion-e2e",
      baseBranch: "main",
      featureBranch: "main",
      currentTaskId: "T-1",
      tasks: [makeDefaultTask({ id: "T-1", status: "in_progress" })],
    }), "test-review");
    writeJson(root, `specs/${specId}/flow.json`, state);
    makeFlowManager(root).addActiveFlow(specId, "local");
    initGitRepo(root);
    commitAll(root, "initial exhausted review fixture");

    const treeSha = resolveCurrentReviewTreeSha(root, spec);
    const targetStateDigest = buildRepairFingerprint({
      root,
      specPath: spec,
      state,
    }).hash;
    state.reviewConvergence = {
      version: 1,
      records: [{
        phase: "test",
        taskId: null,
        treeSha,
        semanticAttempts: 5,
        semanticMaxAttempts: 5,
        toolingAttempts: 1,
        toolingMaxAttempts: 1,
        evidence: {
          evidenceId: "b".repeat(64),
          disposition: "REJECTED",
        },
        finalizedEvidenceAvailable: false,
        handoffFindings: [{ findingId: finding.findingId }],
        blocker: {
          kind: "tooling_attempts_exhausted",
          reason: "A later review invocation could not record another result.",
        },
        toolingOutcome: {
          kind: "TOOLING_ERROR",
          stage: "result_recording",
          attempt: 2,
          maxAttempts: 2,
          remainingAttempts: 0,
          reason: "A later review invocation could not record another result.",
          permissionRelated: false,
        },
        targetStateDigest,
      }],
    };
    writeJson(root, `specs/${specId}/flow.json`, state);

    const next = invoke(root, ["get", "next-action", ...guards(state)]);
    assert.equal(next.status, 0, next.stderr || next.stdout);
    assert.equal(next.envelope.data.directive.kind, "execute_command");
    assert.equal(next.envelope.data.directive.actionId, "COMPLETE_REVIEW_LIFECYCLE");
    assert.equal(next.envelope.data.directive.requiresUserAction, false);
    assert.equal(next.envelope.data.directive.actionPrompt, undefined);

    const completed = invoke(root, ["run", "review", "--phase", "test", ...guards(state)]);
    assert.equal(completed.status, 0, completed.stderr || completed.stdout);
    assert.equal(completed.envelope.data.result, "deferred");
    assert.equal(completed.envelope.data.artifacts.attempts, 5);

    const persisted = JSON.parse(fs.readFileSync(path.join(root, `specs/${specId}/flow.json`), "utf8"));
    assert.equal(persisted.nonblocking, undefined);
    assert.equal(findStepById(persisted.steps, "test-review").status, "done");
    assert.equal(findStepById(persisted.steps, "implement").status, "in_progress");
    assert.equal(
      persisted.stepAttempts.filter((entry) => (
        entry.stepId === "test-review" && entry.outcome?.kind === "defer"
      )).length,
      1,
    );
    const deferred = JSON.parse(fs.readFileSync(
      path.join(root, `specs/${specId}/flow-findings.json`),
      "utf8",
    ));
    assert.equal(deferred.entries[0].sourceFindingId, finding.findingId);
    assert.equal(deferred.entries[0].finalDisposition, "still_open");
  } finally {
    removeTmpDir(root);
  }
});

test("scenario-validity block records refreshed evidence after nonblocking activation", () => {
  const root = createTmpDir("sennel-nonblocking-scenario-validity-e2e-");
  try {
    const specId = "477-scenario-validity-nonblocking-e2e";
    const spec = `specs/${specId}/spec.json`;
    writeJson(root, ".sennel/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      commands: { gh: "disable" },
    });
    writeJson(root, spec, { requirements: [] });
    const state = moveFlowToStep(makeFlowState({
      specId,
      runId: "run-477-scenario-validity-nonblocking-e2e",
      baseBranch: "main",
      featureBranch: "main",
    }), "scenario-validity");
    writeJson(root, `specs/${specId}/flow.json`, state);
    makeFlowManager(root).addActiveFlow(specId, "local");
    initGitRepo(root);
    commitAll(root, "initial flow fixture");

    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(path.join(root, "src", "blocked.js"), "export const blocked = true;\n");
    const strictBlock = invoke(root, ["run", "scenario-validity", ...guards(state)]);
    assert.notEqual(strictBlock.status, 0);
    assert.equal(strictBlock.envelope.errors[0].code, "SCENARIO_VALIDITY_BLOCKED");
    assert.equal(strictBlock.envelope.data.artifacts.result_path.endsWith("scenario-validity-result.json"), true);

    const policy = invoke(root, [
      "set", "policy", "nonblocking",
      "--reason", "The durable pre-implementation block needs explicit acceptance disposition.",
      ...guards(state),
    ]);
    assert.equal(policy.status, 0, policy.stderr || policy.stdout);
    assert.equal(policy.envelope.data.activatedStep, "scenario-validity");

    // Alter the authoritative artifact on the next run. The failed Envelope
    // must still reach the nonblocking hook; otherwise next-action would see
    // changed evidence with no durable observation.
    fs.writeFileSync(path.join(root, "src", "another-blocked.js"), "export const anotherBlocked = true;\n");
    const advisoryBlock = invoke(root, ["run", "scenario-validity", ...guards(state)]);
    assert.notEqual(advisoryBlock.status, 0);
    assert.equal(advisoryBlock.envelope.errors[0].code, "SCENARIO_VALIDITY_BLOCKED");

    const next = invoke(root, ["get", "next-action", ...guards(state)]);
    assert.equal(next.status, 0, next.stderr || next.stdout);
    assert.deepEqual(next.envelope.data.nonblockingDecision.allowedActions, ["retry", "continue"]);
  } finally {
    removeTmpDir(root);
  }
});
