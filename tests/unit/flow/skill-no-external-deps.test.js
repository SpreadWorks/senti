/**
 * tests/unit/flow/skill-no-external-deps.test.js
 *
 * Verify that skill sources have no direct git/gh execution instructions.
 * Allowed exceptions: git rebase in worktree notes, Hard Stops mentioning
 * destructive git commands, and PR merge instructions for user reference.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const SKILL_SOURCES_DIR = path.join(process.cwd(), "src/skills");
const SKILL_NAMES = [
  "senrail.flow",
  "senrail.flow-status",
  "senrail.flow-sync",
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
const DISALLOWED_COMMAND_PATTERNS = [
  /^\s*-?\s*`?git (add|commit|checkout|status|rev-parse|log |push |branch -D)/,
  /^\s*-?\s*`?gh (issue|pr|--version)/,
];

function isAllowed(line) {
  return ALLOWED_PATTERNS.some((re) => re.test(line));
}

describe("skill sources have no direct git/gh execution", () => {
  for (const name of SKILL_NAMES) {
    it(`${name} has no direct git/gh execution instructions`, () => {
      const skillPath = path.join(SKILL_SOURCES_DIR, name, "SKILL.md");
      assert.ok(fs.existsSync(skillPath), `expected skill source at ${skillPath}`);
      const content = fs.readFileSync(skillPath, "utf8");
      const lines = content.split("\n");

      const violations = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (DISALLOWED_COMMAND_PATTERNS.some((re) => re.test(line)) && !isAllowed(line)) {
          violations.push(`line ${i + 1}: ${line.trim()}`);
        }
      }

      assert.equal(violations.length, 0,
        `${name} has direct git/gh instructions:\n${violations.join("\n")}`);
    });
  }
});
