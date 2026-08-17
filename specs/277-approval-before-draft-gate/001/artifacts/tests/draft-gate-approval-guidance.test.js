// spec: R1 R2 R3
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { findStepById } from "../../../src/flow/definition.js";
import { parseDraftLifecycle } from "../../../src/flow/lib/draft-lifecycle.js";
import { getStepInstructions } from "../../../src/flow/lib/get-step-instructions.js";
import { makeFlowManager, makeFlowState, setStepDone } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const flowCli = path.join(repoRoot, "src/flow.js");
const promptPath = path.join(repoRoot, "src/flow/prompts/plan/draft-gate.md");

function draftGatePrompt() {
  return fs.readFileSync(promptPath, "utf8");
}

function assertApprovalSetupGuidance(text) {
  assert.match(text, /approval\.approved/);
  assert.match(text, /approval\.confirmedAt/);
  assert.match(text, /draft\.json[^.\n]*approval\.approved/i);
  assert.match(text, /(?:draft\.json[^.\n]*approval\.confirmedAt|approval\.confirmedAt[^.\n]*draft\.json)/i);
  assert.match(text, /sdd-forge flow run gate --phase draft/);
  assert.match(text, /no unresolved user decision/i);
  assert.match(text, /approval\.approved\s*=\s*true/i);
  assert.match(text, /(?:set|write|confirm)[^.\n]*approval\.confirmedAt[^.\n]*(?:timestamp|non-empty|ISO)/i);
  assert.doesNotMatch(text, /approval\.approved[^.\n]*(?:not|false|missing)[^.\n]*true/i);
  assert.doesNotMatch(text, /approval\.confirmedAt[^.\n]*(?:not|unset|missing)[^.\n]*(?:set|timestamp|non-empty|ISO)/i);
  assert.match(text, /(?:only|when|if)[^.\n]*no unresolved (?:`?requires_user_decision`? )?user decision/i);
  assert.doesNotMatch(text, /(?:approve|proceed)[^.\n]*(?:despite|with)[^.\n]*unresolved `?requires_user_decision`?/i);
  assert.doesNotMatch(text, /bypass `?DraftApproval\.validate\(\)`?/i);
  assert.doesNotMatch(text, /loosen draft-gate approval/i);
}

function setupDraftGateFlow(root) {
  const specId = "001-test";
  const state = makeFlowState({ spec: `specs/${specId}/spec.json` });
  setStepDone(
    state,
    "branch",
    "prepare-spec",
    "draft",
    "draft-questions-review",
    "draft-questions-triage",
    "draft-questions-repair",
    "draft-refine",
    "draft-coverage-review",
    "draft-coverage-triage",
    "draft-coverage-repair",
  );
  findStepById(state.steps, "draft-gate").status = "in_progress";
  const fm = makeFlowManager(root);
  fm.create(state);
  fm.addActiveFlow(specId, "local");
}

function nextActionInstructions(root) {
  const result = spawnSync("node", [flowCli, "get", "next-action"], {
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: root },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.step, "draft-gate");
  return envelope.data.instructions.content;
}

test("R1: draft-gate prompt requires approval setup before running the gate", () => {
  assertApprovalSetupGuidance(draftGatePrompt());
});

test("R2: draft approval validation remains strict", () => {
  const baseDraft = {
    devType: "bugfix",
    goal: "test draft",
    analysis: {
      problem: "problem",
      proposedApproach: "approach",
      validation: "validation",
    },
    decisionMap: {
      knownFacts: ["fact"],
      decisionPoints: ["decision"],
      resolvedByProjectRules: ["rule"],
      requiresUserJudgment: ["none"],
      deferredToSpec: ["test"],
    },
    qa: [],
    approval: {
      approved: false,
      confirmedAt: "",
      notes: "",
    },
  };

  assert.deepEqual(parseDraftLifecycle(baseDraft).validate(), [
    "draft approval is required: set approval.approved = true",
  ]);

  const approvedDraft = {
    ...baseDraft,
    approval: {
      approved: true,
      confirmedAt: "2026-06-04T00:00:00Z",
      notes: "approved",
    },
  };
  assert.deepEqual(parseDraftLifecycle(approvedDraft).validate(), []);
});

test("R3: draft-gate next-action renders approval setup guidance from prompt source", () => {
  const prompt = draftGatePrompt();
  assert.equal(getStepInstructions("plan.draft-gate"), prompt);

  const tmp = createTmpDir("draft-gate-approval-guidance-");
  try {
    setupDraftGateFlow(tmp);
    assertApprovalSetupGuidance(nextActionInstructions(tmp));
  } finally {
    removeTmpDir(tmp);
  }
});
