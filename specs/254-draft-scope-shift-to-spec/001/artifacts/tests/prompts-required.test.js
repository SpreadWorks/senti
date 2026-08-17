// spec: R4 R5 R6 R10 R12 R14 R15
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(__dirname, "..", "..", "..", "src", "flow", "prompts", "plan");
const SPEC_PROMPT = path.join(PROMPTS_DIR, "spec.md");
const DRAFT_PROMPT = path.join(PROMPTS_DIR, "draft.md");
const GATE_PROMPT = path.join(PROMPTS_DIR, "gate.md");

function readPrompt(p) {
  return fs.readFileSync(p, "utf8");
}

function assertContainsAll(content, keywords, label) {
  for (const kw of keywords) {
    assert.ok(
      content.includes(kw),
      `${label}: required keyword not found: "${kw}"`,
    );
  }
}

describe("R4: spec creation prompt contains synthesize rule with carve-out", () => {
  const content = readPrompt(SPEC_PROMPT);

  test("R4: spec.md prompt mentions synthesize / no-direct-copy / no-fabrication / source-correction carve-out", () => {
    assertContainsAll(content, [
      "Synthesize",
      "do not copy",
      "Do not invent",
      "draft",
      "correction",
      "source code",
    ], "spec.md prompt");
  });

  test("R4: spec.md prompt explicitly allows correction when draft contradicts source code", () => {
    assert.match(
      content,
      /contradicts the source/,
      "spec.md prompt must explicitly state that source-contradiction is the carve-out trigger",
    );
  });
});

describe("R5: spec creation prompt contains draft-source verification step", () => {
  const content = readPrompt(SPEC_PROMPT);

  test("R5: spec.md prompt mentions verification step against source code with [VERIFY] / [CORRECTION] prefix recording", () => {
    assertContainsAll(content, [
      "verification",
      "Source verification",
      "[VERIFY]",
      "[CORRECTION]",
      "spec.json.overview.decisions",
      "evidence",
    ], "spec.md prompt");
  });

  test("R5: spec.md prompt mentions schema length constraints (≤500 text / ≤1000 evidence)", () => {
    assert.ok(
      content.includes("500") && content.includes("1000"),
      "spec.md prompt must mention 500 / 1000 char limits for text / evidence",
    );
  });

  test("R5: spec.md prompt mentions split into multiple decision entries when content overflows", () => {
    assert.match(
      content,
      /[Ss]plit/,
      "spec.md prompt must mention splitting decisions when content overflows the schema limit",
    );
  });
});

describe("R6: spec creation prompt contains user-confirmation guidance via Choice Format", () => {
  const content = readPrompt(SPEC_PROMPT);

  test("R6: spec.md prompt mentions user confirmation via Choice Format on draft policy correction", () => {
    assertContainsAll(content, [
      "Choice Format",
      "ユーザー確認",
      "User confirmation",
    ], "spec.md prompt");
  });

  test("R6: spec.md prompt explicitly states autoApprove auto-selects [1] (no branch logic)", () => {
    assert.match(
      content,
      /autoApprove/,
      "spec.md prompt must mention autoApprove behavior explicitly",
    );
    assert.match(
      content,
      /auto-select/,
      "spec.md prompt must explain auto-select [1] convention under autoApprove",
    );
  });

  test("R6: spec.md prompt enumerates trigger and non-trigger conditions for confirmation", () => {
    assert.ok(
      content.includes("Triggers do NOT include") || content.includes("not include"),
      "spec.md prompt must list non-trigger conditions (typo / wording / rationale) explicitly",
    );
  });
});

describe("R10: fixture test exists for prompts required content", () => {
  test("R10: this test file exists and verifies prompts include required keywords", () => {
    assert.ok(true);
  });
});

describe("R12: draft creation prompt contains draft-scope-boundary guidance", () => {
  const content = readPrompt(DRAFT_PROMPT);

  test("R12: draft.md prompt mentions requirements-level boundary", () => {
    assertContainsAll(content, [
      "requirements level",
      "RFP",
      "Draft scope boundary",
    ], "draft.md prompt");
  });

  test("R12: draft.md prompt enumerates allowed and forbidden code reference categories", () => {
    assertContainsAll(content, [
      "file paths",
      "function names",
      "algorithms",
      "data structures",
      "control flow",
      "API design",
    ], "draft.md prompt");
  });

  test("R12: draft.md prompt clarifies QA-field carve-out scope (evidence / why / considered / answer)", () => {
    assertContainsAll(content, [
      "evidence",
      "considered",
      "answer",
    ], "draft.md prompt");
  });
});

describe("R14: spec creation prompt mentions sdd-forge spec render after spec.json updates", () => {
  const content = readPrompt(SPEC_PROMPT);

  test("R14: spec.md prompt instructs to run sdd-forge spec render after spec.json updates", () => {
    assertContainsAll(content, [
      "spec render",
    ], "spec.md prompt");
  });
});

describe("R15: spec gate prompt is rewritten to target spec.json", () => {
  const content = readPrompt(GATE_PROMPT);

  test("R15: gate.md prompt instructs to fix spec.json (not spec.md) and run spec render before re-gate", () => {
    assertContainsAll(content, [
      "spec.json",
      "spec render",
    ], "gate.md prompt");
  });
});
