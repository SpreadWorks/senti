import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { createTmpDir, removeTmpDir, writeJson } from "../../../helpers/tmp-dir.js";
import { commitAll, initGitRepo } from "../../../helpers/git-repo.js";
import { makeFlowState, moveFlowToStep } from "../../../helpers/flow-setup.js";
import { findStepById } from "../../../../src/flow/lib/step-tree.js";

const SENTI = path.resolve("src/senti.js");

function invoke(root, args) {
  const result = spawnSync(process.execPath, [SENTI, "flow", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: root },
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
    "--expect-spec", state.spec,
  ];
}

test("nonblocking policy keeps normal Flow ownership and excludes direct mode", () => {
  const root = createTmpDir("senti-nonblocking-policy-e2e-");
  try {
    const specId = "477-nonblocking-e2e";
    const spec = `specs/${specId}/spec.json`;
    const evidence = JSON.stringify({ verdict: "REJECTED" }, null, 2) + "\n";
    writeJson(root, ".senti/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      commands: { gh: "disable" },
    });
    writeJson(root, spec, { requirements: [] });
    fs.writeFileSync(path.join(root, `specs/${specId}/impl-review.json`), evidence);

    const state = moveFlowToStep(makeFlowState({
      spec,
      runId: "run-477-nonblocking-e2e",
      baseBranch: "main",
      featureBranch: "main",
    }), "impl-review");
    writeJson(root, `specs/${specId}/flow.json`, state);
    writeJson(root, ".senti/.active-flow", [{ spec: specId, mode: "local" }]);
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

    const direct = invoke(root, [
      "run", "direct", "--action", "SELECT_DIRECT_FIX",
      ...guards(state),
    ]);
    assert.notEqual(direct.status, 0);
    assert.equal(direct.envelope.errors[0].code, "NONBLOCKING_POLICY_ACTIVE");
    assert.equal(direct.envelope.data.continuation.actionId, "CONTINUE_NONBLOCKING_FLOW");

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
    assert.equal(persisted.directFlowSession, undefined);
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
