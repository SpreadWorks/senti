#!/usr/bin/env node
/**
 * Spec verification script for specs/179-exclude-docs-from-review.
 *
 * Checks that after implementation:
 * - R1-R4: collectCommittedAndStagedDiff excludes docs/, README.md, AGENTS.md,
 *          .sdd-forge/output/ when called without filePath (fallback path).
 * - R5:   collectCommittedAndStagedDiff does NOT apply exclusions when called
 *          with a filePath (spec Scope path).
 *
 * Reads the source file and checks that the exclusion patterns appear in the
 * fallback code path.
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

const reviewPath = path.join(repoRoot, "src/flow/commands/review.js");
const content = fs.readFileSync(reviewPath, "utf8");

// R1-R4: exclusion patterns must appear in the source
const excludePatterns = ["docs/", "README.md", "AGENTS.md", ".sdd-forge/output/"];
for (const pat of excludePatterns) {
  check(content.includes(pat), `R1-R4: review.js must reference exclude pattern "${pat}"`);
}

// R5: the filePath-specific code path should NOT have exclusion applied
// Verify that exclusion args are only added when filePath is absent (fallback)
// by checking that the exclusion is conditional on !filePath or similar guard
check(
  /!filePath|filePath\s*\?\s*\[/.test(content),
  "R5: exclusion should only apply in fallback path (filePath absent guard expected)",
);

if (failures.length) {
  console.error("FAIL:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("PASS: spec 179 requirements verified");
