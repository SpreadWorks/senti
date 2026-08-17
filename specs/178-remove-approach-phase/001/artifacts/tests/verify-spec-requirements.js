#!/usr/bin/env node
/**
 * Spec verification script for specs/178-remove-approach-phase.
 *
 * Checks that after implementation:
 * - R1 / R5: FLOW_STEPS does not include "approach"; PHASE_MAP does not have "approach" key
 * - R9:    flow-auto SKILL.md does not reference "approach" as a plan-phase step
 * - R10:   flow-status SKILL.md does not display "approach" as a step
 * - R12:   flow-plan SKILL.md description field does not contain the substring "approach"
 *
 * Exits non-zero if any assertion fails.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

const failures = [];
function check(cond, msg) {
  if (!cond) failures.push(msg);
}

// R1 / R5: FLOW_STEPS / PHASE_MAP
const { FLOW_STEPS, PHASE_MAP } = await import(path.join(repoRoot, "src/lib/flow-state.js"));
check(!FLOW_STEPS.includes("approach"), 'R1: FLOW_STEPS must not contain "approach"');
check(!Object.prototype.hasOwnProperty.call(PHASE_MAP, "approach"), 'R5: PHASE_MAP must not have "approach" key');

// R12: flow-plan SKILL.md description must not contain the substring "approach"
const planPath = path.join(repoRoot, "src/templates/skills/sdd-forge.flow-plan/SKILL.md");
const planSkill = fs.readFileSync(planPath, "utf8");
const descMatch = planSkill.match(/^description:\s*(.+)$/m);
check(descMatch && !/approach/i.test(descMatch[1]), 'R12: flow-plan SKILL.md description must not contain "approach"');

// R9: flow-auto SKILL.md must not include "approach" as a plan-phase step
const autoPath = path.join(repoRoot, "src/templates/skills/sdd-forge.flow-auto/SKILL.md");
const autoSkill = fs.readFileSync(autoPath, "utf8");
check(!/plan-phase steps \([^)]*approach/i.test(autoSkill), 'R9: flow-auto SKILL.md plan-phase step list must not contain "approach"');

// R10: flow-status SKILL.md must not display "approach" in step examples
const statusPath = path.join(repoRoot, "src/templates/skills/sdd-forge.flow-status/SKILL.md");
const statusSkill = fs.readFileSync(statusPath, "utf8");
check(!/\d+\.\s+approach\b/i.test(statusSkill), 'R10: flow-status SKILL.md must not display "approach" as a step entry');

if (failures.length) {
  console.error("FAIL:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("PASS: spec 178 requirements verified");
