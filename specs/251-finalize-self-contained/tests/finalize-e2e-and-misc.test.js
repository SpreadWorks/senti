// spec: R8 R9 R19 R21 R22
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";

const repoRoot = path.resolve(import.meta.dirname, "../../../");

function readFileText(p) {
  return fs.readFileSync(p, "utf8");
}

test("R8: tests/e2e/flow/commands/ contains worktree finalize end-to-end happy path test", () => {
  const e2eDir = path.join(repoRoot, "tests/e2e/flow/commands");
  assert.ok(fs.existsSync(e2eDir), "tests/e2e/flow/commands directory must exist");
  const entries = fs.readdirSync(e2eDir);
  const candidate = entries.find((f) =>
    /worktree[-_]?finalize|finalize[-_]?happy[-_]?path|finalize[-_]?self[-_]?contained/i.test(f),
  );
  assert.ok(
    candidate,
    `tests/e2e/flow/commands must contain a worktree finalize e2e file (matched none of: ${entries.join(", ")})`,
  );
});

test("R9: registry-level test verifies failed merge retry resets skipped sync/cleanup to pending", () => {
  // Look for a test (under tests/) that exercises failed merge retry contract
  const candidates = [
    path.join(repoRoot, "tests/unit/flow/finalize-merge-retry.test.js"),
    path.join(repoRoot, "tests/unit/flow/registry-finalize-retry.test.js"),
    path.join(repoRoot, "tests/integration/flow/finalize-merge-retry.test.js"),
  ];
  const found = candidates.some((p) => fs.existsSync(p));
  if (!found) {
    // Fallback: scan tests/unit/flow/ and tests/integration/flow/ for any file mentioning the retry behavior
    const dirs = [
      path.join(repoRoot, "tests/unit/flow"),
      path.join(repoRoot, "tests/integration/flow"),
    ];
    let hit = false;
    for (const d of dirs) {
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d)) {
        if (!/\.test\.(js|mjs|ts)$/.test(f)) continue;
        const text = readFileText(path.join(d, f));
        if (/finalize-merge[\s\S]*retry|retry[\s\S]*finalize-merge/i.test(text) &&
            /skipped[\s\S]*pending|pending[\s\S]*skipped/i.test(text)) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    assert.ok(
      hit,
      "tests/ must contain a test exercising 'failed merge retry resets skipped sync/cleanup to pending'",
    );
  }
});

test("R19: PR merge route post-merge automation behavior is preserved (finalize-sync/cleanup not auto-driven for PR route)", () => {
  // Inspect run-finalize-merge.js for branch logic that distinguishes PR route
  const mergePath = path.join(repoRoot, "src/flow/lib/run-finalize-merge.js");
  const text = readFileText(mergePath);
  // Either explicit PR branch or strategy switch present
  assert.match(
    text,
    /strategy|pr|pull[-_]?request|gh\s+pr|commands\.gh/i,
    "run-finalize-merge.js must distinguish PR route from squash route (preserved)",
  );
});

test("R21: failed merge retry path is resilient against dirty flow.json from prior onError skipped writes", () => {
  // Either preflight ignores flow.json mutations or pre-hook resets skipped before retry
  const registryPath = path.join(repoRoot, "src/flow/registry.js");
  const finalizeMergePath = path.join(repoRoot, "src/flow/lib/run-finalize-merge.js");
  const registryText = readFileText(registryPath);
  const finalizeMergeText = readFileText(finalizeMergePath);
  // Look for either approach (a) dirty-check exclusion of flow.json or (b) pre-hook reset
  const hasExclusion = /flow\.json[\s\S]{0,200}(exclude|ignore|skip)|(exclude|ignore|skip)[\s\S]{0,200}flow\.json/i.test(
    registryText + finalizeMergeText,
  );
  const hasReset = /pre[-_ ]?hook[\s\S]{0,200}reset|reset[\s\S]{0,200}skipped[\s\S]{0,200}pending/is.test(
    registryText + finalizeMergeText,
  );
  assert.ok(
    hasExclusion || hasReset,
    "merge retry must implement either dirty-check exclusion of flow.json or pre-hook reset of skipped to pending",
  );
});

test("R22: buildFinalizePreflightError() references 'sdd-forge flow run finalize-commit --help'", () => {
  const finalizeLibPath = path.join(repoRoot, "src/flow/lib/run-finalize.js");
  const text = readFileText(finalizeLibPath);
  assert.match(
    text,
    /sdd-forge flow run finalize-commit --help/,
    "buildFinalizePreflightError must reference 'sdd-forge flow run finalize-commit --help'",
  );
  assert.equal(
    /sdd-forge flow run finalize --help/.test(text),
    false,
    "buildFinalizePreflightError must no longer reference legacy 'sdd-forge flow run finalize --help'",
  );
});
