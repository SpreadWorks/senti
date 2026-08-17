/**
 * Verify SKILL.md template contains new checklist items and deep-read instruction.
 * Spec: 144-improve-auto-spec-quality
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SKILL_PATH = path.join(ROOT, "src/templates/skills/sdd-forge.flow-plan/SKILL.md");

describe("144: auto spec quality improvements", () => {
  const content = fs.readFileSync(SKILL_PATH, "utf8");

  it("autoApprove checklist contains Alternatives considered", () => {
    assert.ok(
      content.includes("Alternatives considered"),
      "should contain 'Alternatives considered' in checklist"
    );
  });

  it("autoApprove checklist contains Future extensibility", () => {
    assert.ok(
      content.includes("Future extensibility"),
      "should contain 'Future extensibility' in checklist"
    );
  });

  it("contains source code deep-read instruction for thin issues", () => {
    assert.ok(
      content.includes("thin") || content.includes("200"),
      "should contain instruction about thin issue content"
    );
  });

  it("DEFAULT_SPEC_TEMPLATE contains Alternatives Considered section", () => {
    const prepareSpecPath = path.join(ROOT, "src/flow/lib/run-prepare-spec.js");
    const prepareContent = fs.readFileSync(prepareSpecPath, "utf8");
    assert.ok(
      prepareContent.includes("Alternatives Considered"),
      "DEFAULT_SPEC_TEMPLATE should contain Alternatives Considered section"
    );
  });
});
