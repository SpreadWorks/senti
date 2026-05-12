/**
 * tests/unit/flow/skill-no-external-deps.test.js
 *
 * Verify that skill templates have no direct git/gh execution instructions.
 * Allowed exceptions: git rebase in worktree notes, Hard Stops mentioning
 * destructive git commands, and PR merge instructions for user reference.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const SKILLS_DIR = path.join(process.cwd(), "src/templates/skills");
const SKILL_NAMES = [
  "sdd-forge.flow",
  "sdd-forge.flow-status",
  "sdd-forge.flow-sync",
];

// Lines containing these patterns are allowed exceptions
const ALLOWED_PATTERNS = [
  /git rebase/,           // worktree rebase recommendation
  /reset --hard/,         // Hard Stops: "do not use"
  /push --force/,         // Hard Stops: "do not use"
  /destructive git/,      // Hard Stops description
  /git branch -D/,        // PR merge user instruction
  /`git `/,               // inline code reference (not execution instruction)
];

function isAllowed(line) {
  return ALLOWED_PATTERNS.some((re) => re.test(line));
}

describe("skill templates have no direct git/gh execution", () => {
  for (const name of SKILL_NAMES) {
    it(`${name} has no direct git execution instructions`, () => {
      const skillPath = path.join(SKILLS_DIR, name, "SKILL.md");
      if (!fs.existsSync(skillPath)) return; // skip if not yet created
      const content = fs.readFileSync(skillPath, "utf8");
      const lines = content.split("\n");

      const violations = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Look for lines that instruct AI to run git commands
        // Pattern: "Run `git ...", "- `git ...", "git add", "git commit", "git checkout", "git status"
        if (/^\s*-?\s*`?git (add|commit|checkout|status|rev-parse|log |push |branch -D)/.test(line) && !isAllowed(line)) {
          violations.push(`line ${i + 1}: ${line.trim()}`);
        }
        if (/^\s*-?\s*`?git (add|commit|checkout|status|rev-parse|log |push )/.test(line) && !isAllowed(line)) {
          violations.push(`line ${i + 1}: ${line.trim()}`);
        }
      }

      assert.equal(violations.length, 0,
        `${name} has direct git instructions:\n${violations.join("\n")}`);
    });

    it(`${name} has no direct gh execution instructions`, () => {
      const skillPath = path.join(SKILLS_DIR, name, "SKILL.md");
      if (!fs.existsSync(skillPath)) return;
      const content = fs.readFileSync(skillPath, "utf8");
      const lines = content.split("\n");

      const violations = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Look for lines that instruct AI to run gh commands
        if (/^\s*-?\s*`?gh (issue|pr|--version)/.test(line) && !isAllowed(line)) {
          violations.push(`line ${i + 1}: ${line.trim()}`);
        }
      }

      assert.equal(violations.length, 0,
        `${name} has direct gh instructions:\n${violations.join("\n")}`);
    });
  }
});
