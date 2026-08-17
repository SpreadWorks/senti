/**
 * Verify SKILL.md templates contain autoApprove transition instructions.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SKILLS = path.join(ROOT, "src/templates/skills");

describe("auto-mode skill transitions", () => {
  it("flow-auto-on checks flow status before enabling", () => {
    const content = fs.readFileSync(path.join(SKILLS, "sdd-forge.flow-auto-on/SKILL.md"), "utf8");
    assert.ok(content.includes("flow get status"), "should check flow status");
    assert.ok(content.includes("request") && content.includes("issue"), "should check request/issue");
  });

  it("flow-auto-on has phase-to-skill mapping", () => {
    const content = fs.readFileSync(path.join(SKILLS, "sdd-forge.flow-auto-on/SKILL.md"), "utf8");
    assert.ok(content.includes("flow-plan"), "should reference flow-plan");
    assert.ok(content.includes("flow-impl"), "should reference flow-impl");
    assert.ok(content.includes("flow-finalize"), "should reference flow-finalize");
  });

  it("flow-plan has autoApprove transition to flow-impl", () => {
    const content = fs.readFileSync(path.join(SKILLS, "sdd-forge.flow-plan/SKILL.md"), "utf8");
    assert.ok(
      content.includes("autoApprove") && content.includes("flow-impl"),
      "should have autoApprove transition to flow-impl"
    );
  });

  it("flow-impl has autoApprove transition to flow-finalize", () => {
    const content = fs.readFileSync(path.join(SKILLS, "sdd-forge.flow-impl/SKILL.md"), "utf8");
    assert.ok(
      content.includes("autoApprove") && content.includes("flow-finalize"),
      "should have autoApprove transition to flow-finalize"
    );
  });
});
