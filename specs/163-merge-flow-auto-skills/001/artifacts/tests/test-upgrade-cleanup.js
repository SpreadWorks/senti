/**
 * Spec verification test: upgrade cleanup logic
 *
 * Verifies that cleanupObsoleteSkills() removes sdd-forge.* skill directories
 * that are no longer present in any template source (main or experimental).
 *
 * NOT part of npm test — this is a one-time spec requirement verification.
 * Run with: node specs/163-merge-flow-auto-skills/tests/test-upgrade-cleanup.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cleanupObsoleteSkills } from "../../../src/lib/skills.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function mkSkill(dir, name) {
  const skillDir = path.join(dir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: test\n---\n# ${name}\n`
  );
}

function createTmpWorkRoot(name) {
  const tmp = path.join(repoRoot, ".tmp", "test-upgrade-cleanup", name);
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true });
  fs.mkdirSync(path.join(tmp, ".claude", "skills"), { recursive: true });
  fs.mkdirSync(path.join(tmp, ".agents", "skills"), { recursive: true });
  return tmp;
}

function createTmpTemplatesDir(name, skills) {
  const tmp = path.join(repoRoot, ".tmp", "test-upgrade-cleanup", name);
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true });
  for (const skill of skills) {
    mkSkill(tmp, skill);
  }
  return tmp;
}

// ---------------------------------------------------------------------------
// Test 1: Old sdd-forge.* skills not in main templates are removed
// ---------------------------------------------------------------------------

console.log("\nTest 1: Old sdd-forge.* skills are removed");

{
  const workRoot = createTmpWorkRoot("test1");

  // Pre-populate with old skills (simulating a user's existing install)
  mkSkill(path.join(workRoot, ".claude", "skills"), "sdd-forge.flow-auto-on");
  mkSkill(path.join(workRoot, ".claude", "skills"), "sdd-forge.flow-auto-off");
  mkSkill(path.join(workRoot, ".agents", "skills"), "sdd-forge.flow-auto-on");
  mkSkill(path.join(workRoot, ".agents", "skills"), "sdd-forge.flow-auto-off");

  // Main templates: only flow-auto (new skill)
  const mainTemplates = createTmpTemplatesDir("templates1", ["sdd-forge.flow-auto"]);

  cleanupObsoleteSkills(workRoot, [mainTemplates]);

  const claudeSkills = fs.readdirSync(path.join(workRoot, ".claude", "skills"));
  const agentsSkills = fs.readdirSync(path.join(workRoot, ".agents", "skills"));

  assert(
    !claudeSkills.includes("sdd-forge.flow-auto-on"),
    ".claude/skills/sdd-forge.flow-auto-on is deleted"
  );
  assert(
    !claudeSkills.includes("sdd-forge.flow-auto-off"),
    ".claude/skills/sdd-forge.flow-auto-off is deleted"
  );
  assert(
    !agentsSkills.includes("sdd-forge.flow-auto-on"),
    ".agents/skills/sdd-forge.flow-auto-on is deleted"
  );
  assert(
    !agentsSkills.includes("sdd-forge.flow-auto-off"),
    ".agents/skills/sdd-forge.flow-auto-off is deleted"
  );
}

// ---------------------------------------------------------------------------
// Test 2: Experimental skills are NOT removed
// ---------------------------------------------------------------------------

console.log("\nTest 2: Experimental skills are NOT removed");

{
  const workRoot = createTmpWorkRoot("test2");

  // Pre-populate with old skill + experimental skill
  mkSkill(path.join(workRoot, ".claude", "skills"), "sdd-forge.flow-auto-on");
  mkSkill(path.join(workRoot, ".claude", "skills"), "sdd-forge.exp.workflow");
  mkSkill(path.join(workRoot, ".agents", "skills"), "sdd-forge.flow-auto-on");
  mkSkill(path.join(workRoot, ".agents", "skills"), "sdd-forge.exp.workflow");

  // Main templates: only flow-auto; experimental: exp.workflow
  const mainTemplates = createTmpTemplatesDir("templates2", ["sdd-forge.flow-auto"]);
  const expTemplates = createTmpTemplatesDir("exp-templates2", ["sdd-forge.exp.workflow"]);

  cleanupObsoleteSkills(workRoot, [mainTemplates, expTemplates]);

  const claudeSkills = fs.readdirSync(path.join(workRoot, ".claude", "skills"));
  const agentsSkills = fs.readdirSync(path.join(workRoot, ".agents", "skills"));

  assert(
    !claudeSkills.includes("sdd-forge.flow-auto-on"),
    ".claude/skills/sdd-forge.flow-auto-on is deleted"
  );
  assert(
    claudeSkills.includes("sdd-forge.exp.workflow"),
    ".claude/skills/sdd-forge.exp.workflow is preserved"
  );
  assert(
    !agentsSkills.includes("sdd-forge.flow-auto-on"),
    ".agents/skills/sdd-forge.flow-auto-on is deleted"
  );
  assert(
    agentsSkills.includes("sdd-forge.exp.workflow"),
    ".agents/skills/sdd-forge.exp.workflow is preserved"
  );
}

// ---------------------------------------------------------------------------
// Test 3: Return value lists removed skills (deduplicated)
// ---------------------------------------------------------------------------

console.log("\nTest 3: Return value lists removed skills (deduplicated)");

{
  const workRoot = createTmpWorkRoot("test3");

  mkSkill(path.join(workRoot, ".claude", "skills"), "sdd-forge.flow-auto-on");
  mkSkill(path.join(workRoot, ".claude", "skills"), "sdd-forge.flow-auto-off");
  mkSkill(path.join(workRoot, ".agents", "skills"), "sdd-forge.flow-auto-on");
  mkSkill(path.join(workRoot, ".agents", "skills"), "sdd-forge.flow-auto-off");

  const mainTemplates = createTmpTemplatesDir("templates3", ["sdd-forge.flow-auto"]);
  const removed = cleanupObsoleteSkills(workRoot, [mainTemplates]);

  const removedNames = removed.map((r) => r.name).sort();
  assert(
    removedNames.length === 2,
    `returns 2 removed entries (got ${removedNames.length})`
  );
  assert(
    removedNames.includes("sdd-forge.flow-auto-on"),
    "result includes sdd-forge.flow-auto-on"
  );
  assert(
    removedNames.includes("sdd-forge.flow-auto-off"),
    "result includes sdd-forge.flow-auto-off"
  );
  assert(
    removed.every((r) => r.status === "removed"),
    "all entries have status 'removed'"
  );
}

// ---------------------------------------------------------------------------
// Test 4: dryRun does not delete files
// ---------------------------------------------------------------------------

console.log("\nTest 4: dryRun does not delete files");

{
  const workRoot = createTmpWorkRoot("test4");

  mkSkill(path.join(workRoot, ".claude", "skills"), "sdd-forge.flow-auto-on");
  mkSkill(path.join(workRoot, ".agents", "skills"), "sdd-forge.flow-auto-on");

  const mainTemplates = createTmpTemplatesDir("templates4", ["sdd-forge.flow-auto"]);
  const removed = cleanupObsoleteSkills(workRoot, [mainTemplates], { dryRun: true });

  const claudeSkills = fs.readdirSync(path.join(workRoot, ".claude", "skills"));

  assert(
    claudeSkills.includes("sdd-forge.flow-auto-on"),
    "dryRun: .claude/skills/sdd-forge.flow-auto-on is NOT deleted"
  );
  assert(
    removed.length === 1 && removed[0].name === "sdd-forge.flow-auto-on",
    "dryRun: return value still lists obsolete skill"
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
