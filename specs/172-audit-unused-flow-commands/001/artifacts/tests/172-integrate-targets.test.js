/**
 * Spec 172: Verify integrate targets are wired into skill templates.
 *
 * R5: flow-plan skill template includes flow set test-summary instruction
 * R6: flow-impl skill template includes flow run lint instruction
 * R7: flow-finalize skill template includes flow run retro instruction
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const TEMPLATES = path.join(ROOT, "src/templates/skills");

describe("172: integrate targets in skill templates", () => {
  it("R5: flow-plan template shall include flow set test-summary instruction", () => {
    const content = fs.readFileSync(
      path.join(TEMPLATES, "sdd-forge.flow-plan/SKILL.md"), "utf8",
    );
    assert.ok(
      content.includes("flow set test-summary"),
      "flow-plan SKILL.md does not mention flow set test-summary",
    );
  });

  it("R6: flow-impl template shall include flow run lint instruction", () => {
    const content = fs.readFileSync(
      path.join(TEMPLATES, "sdd-forge.flow-impl/SKILL.md"), "utf8",
    );
    assert.ok(
      content.includes("flow run lint"),
      "flow-impl SKILL.md does not mention flow run lint",
    );
  });

  it("R7: flow-finalize template shall include flow run retro instruction", () => {
    const content = fs.readFileSync(
      path.join(TEMPLATES, "sdd-forge.flow-finalize/SKILL.md"), "utf8",
    );
    assert.ok(
      content.includes("flow run retro"),
      "flow-finalize SKILL.md does not mention flow run retro",
    );
  });
});
