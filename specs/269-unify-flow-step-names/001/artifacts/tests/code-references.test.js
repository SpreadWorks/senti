// spec: R2
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");

// Unambiguous old step-id tokens (no collision with kept ids, command names, or new names).
const UNAMBIGUOUS_OLD_IDS = [
  "gate-draft",
  "gate-impl",
  "review-draft-questions",
  "review-draft-coverage",
  "review-spec",
  "review-test",
  "spec-review-triage",
];

function walkJs(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "prompts") continue; // prompts are covered by R3
      walkJs(full, acc);
    } else if (ent.isFile() && full.endsWith(".js")) {
      acc.push(full);
    }
  }
  return acc;
}

function tokenRegex(tok) {
  // match the token only when not part of a longer [\w-] run
  return new RegExp(`(?<![\\w-])${tok}(?![\\w-])`);
}

test("R2: draft review routes resolve to new review step ids", async () => {
  const { draftReviewRouteForKey } = await import(
    path.join(repoRoot, "src", "flow", "lib", "draft-review-routes.js")
  );
  const q = draftReviewRouteForKey("questions");
  const c = draftReviewRouteForKey("coverage");
  assert.equal(q.reviewStepId, "draft-questions-review");
  assert.equal(c.reviewStepId, "draft-coverage-review");
  // triage/repair step ids are already compliant and kept unchanged
  assert.equal(q.triageStepId, "draft-questions-triage");
  assert.equal(q.repairStepId, "draft-questions-repair");
  assert.equal(c.triageStepId, "draft-coverage-triage");
  assert.equal(c.repairStepId, "draft-coverage-repair");
});

test("R2: task-scope.js BROAD_STEPS uses flow-scope new names", async () => {
  const { BROAD_STEPS } = await import(
    path.join(repoRoot, "src", "flow", "lib", "task-scope.js")
  );
  assert.deepEqual([...BROAD_STEPS], ["implement", "impl-review", "impl-gate"]);
});

test("R2: gate-step TASK_STEP_TO_PHASE uses new task gate keys", () => {
  const src = fs.readFileSync(path.join(repoRoot, "src", "flow", "lib", "gate-step.js"), "utf8");
  assert.match(src, /"spec-gate":\s*"task-spec"/);
  assert.match(src, /"task-gate":\s*"task-impl"/);
  assert.ok(!/"gate-impl":\s*"task-impl"/.test(src), "old 'gate-impl' task key must be renamed");
  assert.ok(!/"gate":\s*"task-spec"/.test(src), "old 'gate' task key must be renamed to 'spec-gate'");
});

test("R2: gate-step resolveGateStepId returns new gate step ids incl. fallback", async () => {
  const { resolveGateStepId } = await import(
    path.join(repoRoot, "src", "flow", "lib", "gate-step.js")
  );
  assert.equal(resolveGateStepId("spec"), "spec-gate");
  assert.equal(resolveGateStepId("integration"), "impl-gate");
  // fallback for an unknown phase resolves to the spec gate's new name
  assert.equal(resolveGateStepId("no-such-phase"), "spec-gate");
});

test("R2: registry REVIEW_RUNTIME_STEP_BY_PHASE maps phases to new review step ids", () => {
  const src = fs.readFileSync(path.join(repoRoot, "src", "flow", "registry.js"), "utf8");
  assert.match(src, /spec:\s*"spec-review"/);
  assert.match(src, /test:\s*"test-review"/);
  assert.match(src, /impl:\s*"impl-review"/);
  assert.ok(!/impl:\s*"review"/.test(src), "registry must not map the impl phase to bare 'review'");
});

test("R2: src/flow has no unambiguous old step-id literals", () => {
  const files = walkJs(path.join(repoRoot, "src", "flow"));
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const tok of UNAMBIGUOUS_OLD_IDS) {
      if (tokenRegex(tok).test(text)) {
        hits.push(`${path.relative(repoRoot, file)} :: ${tok}`);
      }
    }
  }
  assert.deepEqual(hits, [], `old step-id literals remain in src/flow:\n${hits.join("\n")}`);
});
