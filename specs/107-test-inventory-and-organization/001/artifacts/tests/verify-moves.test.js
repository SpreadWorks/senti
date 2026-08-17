import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../..");

const MOVED_FILES = [
  { from: "tests/unit/docs/lib/073-b3-chapter-order.test.js", toPattern: "specs/073-" },
  { from: "tests/unit/docs/data/073-b4-strip-markdown.test.js", toPattern: "specs/073-" },
  { from: "tests/unit/docs/lib/081-directive-parser-new-syntax.test.js", toPattern: "specs/081-" },
  { from: "tests/unit/docs/lib/081-template-merger-new-syntax.test.js", toPattern: "specs/081-" },
  { from: "tests/unit/specs/commands/081-guardrail-new-syntax.test.js", toPattern: "specs/081-" },
  { from: "tests/unit/lib/082-multi-select-defaults.test.js", toPattern: "specs/082-" },
  { from: "tests/unit/presets/079-preset-chapter-hierarchy.test.js", toPattern: "specs/079-" },
  { from: "tests/e2e/081-flow-steps.test.js", toPattern: "specs/081-" },
  { from: "tests/e2e/082-setup-wizard-bugs.test.js", toPattern: "specs/082-" },
];

describe("test file moves", () => {
  for (const { from } of MOVED_FILES) {
    it(`${from} should no longer exist in tests/`, () => {
      assert.ok(!existsSync(resolve(ROOT, from)), `${from} should have been moved`);
    });
  }
});

describe("SKILL.md classification criteria", () => {
  it("flow-plan SKILL.md contains test placement criteria", async () => {
    const { readFileSync } = await import("node:fs");
    const skillPath = resolve(ROOT, "src/templates/skills/sdd-forge.flow-plan/SKILL.md");
    const content = readFileSync(skillPath, "utf8");
    assert.ok(content.includes("specs/<spec>/tests/"), "should mention specs/<spec>/tests/");
    assert.ok(content.includes("tests/"), "should mention tests/");
    // Check that classification criteria keywords exist
    assert.ok(
      content.includes("API") || content.includes("contract") || content.includes("interface"),
      "should mention API/contract/interface as criteria for formal tests"
    );
  });
});
