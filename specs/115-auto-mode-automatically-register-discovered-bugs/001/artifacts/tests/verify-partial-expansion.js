import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKTREE = join(__dirname, "..", "..", "..");

// Expanded SKILL.md files (after upgrade)
const SKILLS_DIR = join(WORKTREE, ".claude", "skills");
const PLAN_SKILL = join(SKILLS_DIR, "sdd-forge.flow-plan", "SKILL.md");
const IMPL_SKILL = join(SKILLS_DIR, "sdd-forge.flow-impl", "SKILL.md");
const FINALIZE_SKILL = join(SKILLS_DIR, "sdd-forge.flow-finalize", "SKILL.md");

// Source partial
const PARTIAL = join(WORKTREE, "src", "templates", "partials", "redo-recording.md");

function readFile(path) {
  return readFileSync(path, "utf-8");
}

describe("redo-recording.md partial", () => {
  test("contains 'When to record' section with at least 6 trigger conditions", () => {
    const content = readFile(PARTIAL);
    assert.match(content, /when to record/i, "Missing 'When to record' section");
    // Count bullet points under the section
    const section = content.split(/when to record/i)[1];
    const bullets = section.match(/^- /gm) || [];
    assert.ok(bullets.length >= 6, `Expected at least 6 trigger conditions, found ${bullets.length}`);
  });

  test("contains 'Examples' subsection with at least 2 command invocations", () => {
    const content = readFile(PARTIAL);
    assert.match(content, /examples/i, "Missing 'Examples' subsection");
    const exampleMatches = content.match(/sdd-forge flow set redo/g) || [];
    // Original command template + at least 2 examples = at least 3 occurrences
    assert.ok(exampleMatches.length >= 3, `Expected at least 3 'sdd-forge flow set redo' occurrences (1 template + 2 examples), found ${exampleMatches.length}`);
  });
});

describe("flow-plan SKILL.md", () => {
  test("contains redo note in test phase section", () => {
    const content = readFile(PLAN_SKILL);
    // Should contain redo-related guidance near test phase
    assert.match(content, /redolog|redo/i, "Missing redo reference in flow-plan");
    // The expanded partial content should be present
    assert.match(content, /when to record/i, "Partial not expanded in flow-plan");
  });
});

describe("flow-impl SKILL.md", () => {
  test("contains redo note in implement section", () => {
    const content = readFile(IMPL_SKILL);
    assert.match(content, /when to record/i, "Partial not expanded in flow-impl");
  });
});

describe("flow-finalize SKILL.md", () => {
  test("contains redo note near worktree/merge/commit", () => {
    const content = readFile(FINALIZE_SKILL);
    assert.match(content, /when to record/i, "Partial not expanded in flow-finalize");
  });
});

describe("no changes to src/flow/", () => {
  test("src/flow/ has no uncommitted changes", () => {
    const result = execFileSync("git", ["diff", "--name-only", "--", "src/flow/"], {
      cwd: WORKTREE,
      encoding: "utf-8",
    });
    assert.equal(result.trim(), "", `Unexpected changes in src/flow/: ${result}`);
  });
});
