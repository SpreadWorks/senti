// spec: R1 R2 R3 R4
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { findStepById } from "../../../src/flow/definition.js";
import { getStepInstructions } from "../../../src/flow/lib/get-step-instructions.js";
import { makeFlowManager, makeFlowState, setStepDone } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const flowCli = path.join(repoRoot, "src/flow.js");
const draftQaRulesPath = path.join(repoRoot, "src/flow/prompts/partials/draft-qa-rules.md");
const draftGatePromptPath = path.join(repoRoot, "src/flow/prompts/plan/draft-gate.md");

function readDraftQaRules() {
  return fs.readFileSync(draftQaRulesPath, "utf8");
}

function readDraftGatePrompt() {
  return fs.readFileSync(draftGatePromptPath, "utf8");
}

function assertDraftPriorityMarkerGuidance(text) {
  assert.match(text, /requirement-like/i);
  assert.match(text, /priority marker/i);
  assert.match(text, /must/);
  assert.match(text, /should/);
  assert.match(text, /nice-to-have/);
  assert.match(text, /(?:exactly )?one accepted priority marker/i);
  assert.match(text, /qa\[\]/);
  assert.match(text, /scopeVerification/);
  assert.match(text, /impactOnExisting/);
  assert.match(text, /decisionMap/);
  assert.match(text, /openQuestions/);
}

function assertNoSchemaChangeGuidance(text) {
  assert.doesNotMatch(text, /new persisted priority field/i);
  assert.doesNotMatch(text, /add(?:s|ing)? [`"]?priority[`"]? (?:property|field)/i);
  assert.doesNotMatch(text, /relax(?:es|ing)?[^.\n]*prioritize-requirements/i);
}

function assertDraftGatePriorityPreflight(text) {
  assert.match(text, /before running the gate/i);
  assert.match(text, /scan/i);
  assert.match(text, /missing priority marker/i);
  assert.match(text, /draft\.json/);
  assert.match(text, /must/);
  assert.match(text, /should/);
  assert.match(text, /nice-to-have/);
  assert.match(text, /sdd-forge flow run gate --phase draft/);
  assert.match(text, /scopeVerification/);
  assert.match(text, /impactOnExisting/);
  assert.match(text, /decisionMap/);
  assert.match(text, /openQuestions/);
}

function setupFlowAtStep(root, step) {
  const specId = "001-test";
  const state = makeFlowState({ spec: `specs/${specId}/spec.json` });
  if (step === "draft") {
    setStepDone(state, "branch", "prepare-spec");
    findStepById(state.steps, "draft").status = "in_progress";
  } else if (step === "draft-gate") {
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
  } else {
    throw new Error(`unsupported step: ${step}`);
  }

  const fm = makeFlowManager(root);
  fm.create(state);
  fm.addActiveFlow(specId, "local");
}

function nextActionInstructions(root, step) {
  setupFlowAtStep(root, step);
  const result = spawnSync("node", [flowCli, "get", "next-action"], {
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: root },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.step, step);
  return envelope.data.instructions.content;
}

test("R1: shared draft QA rules require accepted priority markers for requirement-like draft text", () => {
  assertDraftPriorityMarkerGuidance(readDraftQaRules());
  assertDraftPriorityMarkerGuidance(getStepInstructions("plan.draft"));
});

test("R2: draft-gate prompt requires a missing-priority preflight scan before the gate command", () => {
  assertDraftGatePriorityPreflight(readDraftGatePrompt());
});

test("R3: priority guidance stays marker-based and does not introduce schema or guardrail relaxation", () => {
  const draftGuidance = getStepInstructions("plan.draft");
  const gateGuidance = getStepInstructions("plan.draft-gate");
  assertDraftPriorityMarkerGuidance(draftGuidance);
  assertDraftGatePriorityPreflight(gateGuidance);
  assertNoSchemaChangeGuidance(draftGuidance);
  assertNoSchemaChangeGuidance(gateGuidance);
});

test("R4: rendered next-action instructions expose draft and draft-gate priority guidance", () => {
  const tmp = createTmpDir("requirement-priority-guidance-");
  try {
    assertDraftPriorityMarkerGuidance(nextActionInstructions(tmp, "draft"));
    assertDraftGatePriorityPreflight(nextActionInstructions(tmp, "draft-gate"));
  } finally {
    removeTmpDir(tmp);
  }
});
