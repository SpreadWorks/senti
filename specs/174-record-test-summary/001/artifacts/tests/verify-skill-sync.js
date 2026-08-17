/**
 * Spec verification test: 174-record-test-summary
 *
 * Checks that the installed flow-plan skill contains the test-summary
 * recording instruction after `sdd-forge upgrade` has been run.
 *
 * Run: node specs/174-record-test-summary/tests/verify-skill-sync.js
 * Expected: PASS after `sdd-forge upgrade`
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// In worktree mode, sdd-forge upgrade writes to the worktree's .claude/skills/.
// worktree path: <repo>/.sdd-forge/worktree/<branch>/specs/<spec>/tests/
// 3 levels up to reach worktree root where .claude/skills/ was created
const root = resolve(__dirname, "../../..");

const installedSkillPath = resolve(root, ".claude/skills/sdd-forge.flow-plan/SKILL.md");

let content;
try {
  content = readFileSync(installedSkillPath, "utf-8");
} catch {
  console.error(`FAIL: Could not read installed skill: ${installedSkillPath}`);
  process.exit(1);
}

const hasInstruction = content.includes("flow set test-summary");

if (hasInstruction) {
  console.log("PASS: installed flow-plan skill contains 'flow set test-summary' instruction");
  process.exit(0);
} else {
  console.error("FAIL: installed flow-plan skill is missing 'flow set test-summary' instruction");
  console.error("  → Run `sdd-forge upgrade` to sync the template changes");
  process.exit(1);
}
