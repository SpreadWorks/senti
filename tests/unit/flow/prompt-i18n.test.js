/**
 * tests/unit/flow/prompt-i18n.test.js
 *
 * Tests for prompt i18n — verifies ja/en language support.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, setupFlowConfig } from "../../helpers/flow-setup.js";

const FLOW_CMD = join(process.cwd(), "src/flow.js");
const PROMPT_TEST_TIMEOUT_MS = 5000;

function setupFlowState(dir, lang) {
  setupFlow(dir);
  setupFlowConfig(dir, lang);
}

function getPromptEnvelope(workRoot, promptId) {
  const result = execFileSync(
    "node", [FLOW_CMD, "get", "prompt", promptId],
    {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: workRoot },
      timeout: PROMPT_TEST_TIMEOUT_MS,
    },
  );
  return JSON.parse(result);
}

describe("flow get prompt i18n — Japanese", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns Japanese description for plan.work-environment when lang=ja", () => {
    tmp = createTmpDir();
    setupFlowState(tmp, "ja");
    const envelope = getPromptEnvelope(tmp, "plan.work-environment");
    assert.equal(envelope.ok, true);
    assert.ok(envelope.data.description.includes("作業環境"), `should be Japanese: ${envelope.data.description}`);
  });

  it("returns Japanese choices for plan.work-environment when lang=ja", () => {
    tmp = createTmpDir();
    setupFlowState(tmp, "ja");
    const envelope = getPromptEnvelope(tmp, "plan.work-environment");
    const labels = envelope.data.choices.map((c) => c.label);
    assert.ok(labels.some((l) => l.includes("worktree") || l.includes("隔離")), `should have Japanese label: ${labels}`);
  });

  it("returns Japanese for plan.approval when lang=ja", () => {
    tmp = createTmpDir();
    setupFlowState(tmp, "ja");
    const envelope = getPromptEnvelope(tmp, "plan.approval");
    assert.ok(envelope.data.description.includes("承認"), `should be Japanese: ${envelope.data.description}`);
  });
});

describe("flow get prompt i18n — English", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns English description for plan.work-environment when lang=en", () => {
    tmp = createTmpDir();
    setupFlowState(tmp, "en");
    const envelope = getPromptEnvelope(tmp, "plan.work-environment");
    assert.equal(envelope.ok, true);
    assert.ok(envelope.data.description.includes("Choose"), `should be English: ${envelope.data.description}`);
  });

  it("returns English choices for plan.approval when lang=en", () => {
    tmp = createTmpDir();
    setupFlowState(tmp, "en");
    const envelope = getPromptEnvelope(tmp, "plan.approval");
    const labels = envelope.data.choices.map((c) => c.label);
    assert.ok(labels.includes("Approve"), `should have English label: ${labels}`);
  });

  it("returns English for plan.test-mode when lang=en", () => {
    tmp = createTmpDir();
    setupFlowState(tmp, "en");
    const envelope = getPromptEnvelope(tmp, "plan.test-mode");
    assert.equal(envelope.data.description, "Run tests?", `should be exact English description, got: ${envelope.data.description}`);
    const labels = envelope.data.choices.map((c) => c.label);
    assert.ok(labels.includes("Run"), `should have English label "Run": ${labels}`);
  });
});

describe("flow SKILL.md has no hardcoded prompt text", () => {
  it("does not contain fixed choice blocks for plan prompts", () => {
    const skillPath = join(process.cwd(), "src/skills/sdd-forge.flow/SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    assert.ok(!content.includes("[1] Organize requirements"), "should not hardcode approach choices");
    assert.ok(!content.includes("[1] Write test code"), "should not hardcode test-mode choices");
    assert.ok(!content.includes("[1] Approve"), "should not hardcode approval choices");
    assert.ok(!content.includes("[1] Proceed to implementation"), "should not hardcode complete choices");
    // The consolidated flow skill is a thin dispatcher; per-step instructions
    // (loaded by `flow get next-action`) own the prompt references. The skill
    // only retains the Prelude-phase prompt calls.
    assert.ok(content.includes("flow get prompt plan.work-environment"), "should reference prelude prompt command");
    assert.ok(content.includes("flow get prompt plan.base-branch"), "should reference prelude prompt command");
  });
});
