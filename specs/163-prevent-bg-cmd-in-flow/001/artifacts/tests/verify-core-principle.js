/**
 * Spec verification test: 163-prevent-bg-cmd-in-flow
 *
 * Verifies that core-principle.md contains the MUST rule about
 * waiting for background commands to complete before proceeding.
 *
 * The distinction from existing rules:
 *   EXISTING: "NEVER chain or background" (prohibition)
 *   NEW: "IF background occurs, wait until complete" (what to do when it happens)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const PARTIAL_PATH = path.join(REPO_ROOT, "src/templates/partials/core-principle.md");

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

const content = fs.readFileSync(PARTIAL_PATH, "utf-8");

console.log("core-principle.md — background wait rule verification\n");

// REQ 1+2+3: The new rule must describe conditional behavior:
// "IF/When a sdd-forge command goes to background → wait for completion → do not proceed"
// Pattern: conditional (if/when background) + waiting obligation
const hasConditionalWait =
  /if.{0,80}background|when.{0,80}background|goes.{0,80}background/i.test(content);
assert(
  hasConditionalWait,
  "describes conditional: 'if/when background occurs' (not just prohibition)",
);

// REQ 3: The rule must explicitly say to wait for completion notification
const hasWaitForCompletion =
  /wait.{0,60}complet|complet.{0,60}notif|notif.{0,60}before/i.test(content);
assert(
  hasWaitForCompletion,
  "requires waiting for completion notification before proceeding",
);

// REQ 2: The rule applies to all sdd-forge commands (not a specific subcommand)
const coversAllCommands =
  /sdd-forge.{0,5}command/i.test(content) &&
  !/only.*flow run|only.*finalize|only.*review/.test(content);
assert(
  coversAllCommands,
  "applies to sdd-forge commands in general (not limited to specific subcommands)",
);

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
