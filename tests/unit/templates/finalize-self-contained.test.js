/**
 * Spec 251 R10: assert that finalize self-contained patterns are gone from the
 * skill template + worktree-mode partial. The cleanup envelope now carries
 * `data.report.text`, so the AI no longer needs `flow report show`,
 * `cd <mainRepoPath>`, or per-leaf `flow set step finalize-*` instructions.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = path.resolve(
  __dirname,
  "../../../src/templates/skills/sdd-forge.flow/SKILL.md",
);
const WORKTREE_MODE_PATH = path.resolve(
  __dirname,
  "../../../src/templates/partials/worktree-mode.md",
);

const TARGETS = [
  ["SKILL.md", SKILL_PATH],
  ["worktree-mode.md", WORKTREE_MODE_PATH],
];

const FORBIDDEN = [
  { name: "flow report show", pattern: /flow report show/ },
  { name: "cd <mainRepoPath>", pattern: /cd <mainRepoPath>|cd <main-repository-path>/ },
  { name: "flow set step finalize-*", pattern: /flow set step\s+finalize-/ },
];

describe("templates — finalize self-contained patterns (spec 251 R10)", () => {
  for (const [name, p] of TARGETS) {
    for (const { name: patternName, pattern } of FORBIDDEN) {
      it(`${name} contains no '${patternName}'`, () => {
        const text = fs.readFileSync(p, "utf8");
        assert.equal(
          pattern.test(text),
          false,
          `${name} must not contain pattern matching '${patternName}'`,
        );
      });
    }
  }
});
