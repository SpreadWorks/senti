// spec: R6 R9
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");

test("R6: src/AGENTS.md documents the <phase>-<concern>-<action> naming convention", () => {
  const text = fs.readFileSync(path.join(repoRoot, "src", "AGENTS.md"), "utf8");
  assert.ok(
    text.includes("<phase>-<concern>-<action>"),
    "AGENTS.md should contain the naming-convention format token",
  );
  for (const kw of ["phase", "concern", "action"]) {
    assert.ok(text.includes(kw), `AGENTS.md naming-convention section should mention '${kw}'`);
  }
  // at least one concrete example of a new-convention step id
  const exampleIds = [
    "draft-questions-review",
    "draft-coverage-review",
    "spec-review",
    "test-review",
    "impl-review",
    "impl-gate",
    "spec-gate",
  ];
  assert.ok(
    exampleIds.some((id) => text.includes(id)),
    "AGENTS.md should include at least one concrete example step id following the convention",
  );
  // explicit statement that the phase prefix is mandatory
  assert.ok(
    /必須|例外なし|mandatory|required/i.test(text),
    "AGENTS.md should state the phase prefix is mandatory",
  );
});

test("R9: CHANGELOG.md records the step-rename breaking change with migration details", () => {
  const text = fs.readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8");
  const lower = text.toLowerCase();
  // breaking change marker
  assert.ok(lower.includes("breaking"), "CHANGELOG should mark the change as breaking");
  // migration tool reference
  assert.ok(
    text.includes("rename-phase-steps"),
    "CHANGELOG should reference the migration tool (rename-phase-steps)",
  );
  // merge precondition: no other active flow
  assert.ok(
    text.includes("active flow"),
    "CHANGELOG should state the 'no other active flow' merge precondition",
  );
  // branches with flow.json must re-run the tool after merge
  assert.ok(
    lower.includes("re-run") || text.includes("再走"),
    "CHANGELOG should state that branches containing flow.json must re-run the tool after merge",
  );
  // old names removed without aliases
  assert.ok(
    lower.includes("alias"),
    "CHANGELOG should state old step names are removed without aliases",
  );
  // existing PRs/branches containing flow.json need migration after merge
  assert.ok(
    text.includes("flow.json") && (lower.includes("branch") || lower.includes("pr")),
    "CHANGELOG should mention existing PRs/branches containing flow.json need the tool after merge",
  );
});
