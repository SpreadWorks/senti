// spec: R1 R3
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");

const NEW_FLOW_LEAVES = [
  "impl-review",
  "spec-gate",
  "draft-gate",
  "impl-gate",
  "draft-questions-review",
  "draft-coverage-review",
  "spec-review",
  "test-review",
  "spec-triage",
];
const OLD_FLOW_LEAVES = [
  "review",
  "gate",
  "gate-draft",
  "gate-impl",
  "review-draft-questions",
  "review-draft-coverage",
  "review-spec",
  "review-test",
  "spec-review-triage",
];
const KEPT_LEAVES = [
  "draft", "spec", "test", "draft-refine",
  "draft-questions-triage", "draft-questions-repair",
  "draft-coverage-triage", "draft-coverage-repair",
  "spec-repair", "test-execute", "test-result-review",
  "finalize-commit", "finalize-merge", "finalize-sync", "finalize-cleanup",
  "prepare-spec", "branch", "approval", "scenario-validity",
  "implement", "retro", "final-regression",
];

test("R1: FLOW_DEFINITION leaf ids use new phase-prefixed names and drop old bare names", async () => {
  const { collectLeafIds, FLOW_DEFINITION } = await import(
    path.join(repoRoot, "src", "flow", "definition.js")
  );
  const leaves = collectLeafIds(FLOW_DEFINITION);
  for (const id of NEW_FLOW_LEAVES) {
    assert.ok(leaves.includes(id), `FLOW_DEFINITION should contain new leaf '${id}'`);
  }
  for (const id of OLD_FLOW_LEAVES) {
    assert.ok(!leaves.includes(id), `FLOW_DEFINITION should not contain old leaf '${id}'`);
  }
  for (const id of KEPT_LEAVES) {
    assert.ok(leaves.includes(id), `FLOW_DEFINITION should keep leaf '${id}'`);
  }
});

test("R1: TASK_DEFINITION leaf ids are task-prefixed", async () => {
  const { collectLeafIds, TASK_DEFINITION } = await import(
    path.join(repoRoot, "src", "flow", "definition.js")
  );
  const leaves = collectLeafIds(TASK_DEFINITION);
  assert.deepEqual([...leaves].sort(), ["task-gate", "task-impl", "task-review"]);
});

test("R1: top-level branch ids plan/impl are unchanged", async () => {
  const { FLOW_DEFINITION } = await import(
    path.join(repoRoot, "src", "flow", "definition.js")
  );
  const branchIds = FLOW_DEFINITION.map((n) => n.id);
  assert.deepEqual(branchIds, ["plan", "impl"]);
});

test("R3: renamed prompt files exist under prompts/<branch>/<new-step>.md", () => {
  const promptsDir = path.join(repoRoot, "src", "flow", "prompts");
  const expectExist = [
    "impl/impl-review.md",
    "impl/impl-gate.md",
    "plan/spec-gate.md",
    "plan/draft-gate.md",
    "plan/draft-questions-review.md",
    "plan/draft-coverage-review.md",
    "plan/spec-review.md",
    "plan/test-review.md",
    "plan/spec-triage.md",
    "task/task-impl.md",
    "task/task-review.md",
  ];
  for (const rel of expectExist) {
    assert.ok(
      fs.existsSync(path.join(promptsDir, rel)),
      `prompt file should exist: prompts/${rel}`,
    );
  }
});

test("R3: old prompt files are removed", () => {
  const promptsDir = path.join(repoRoot, "src", "flow", "prompts");
  const expectAbsent = [
    "impl/review.md",
    "impl/gate-impl.md",
    "plan/gate.md",
    "plan/gate-draft.md",
    "plan/review-draft-questions.md",
    "plan/review-draft-coverage.md",
    "plan/review-spec.md",
    "plan/review-test.md",
    "plan/spec-review-triage.md",
    "task/impl.md",
    "task/review.md",
  ];
  for (const rel of expectAbsent) {
    assert.ok(
      !fs.existsSync(path.join(promptsDir, rel)),
      `old prompt file should be removed: prompts/${rel}`,
    );
  }
});

test("R3: renamed prompt-backed steps carry exact instructionsKey values", async () => {
  const { FLOW_DEFINITION, TASK_DEFINITION, resolveNodeFor } = await import(
    path.join(repoRoot, "src", "flow", "definition.js")
  );
  // [definition, stepId, expected instructionsKey]
  const expectations = [
    [FLOW_DEFINITION, "impl-review", "impl.impl-review"],
    [FLOW_DEFINITION, "impl-gate", "impl.impl-gate"],
    [FLOW_DEFINITION, "spec-gate", "plan.spec-gate"],
    [FLOW_DEFINITION, "spec-review", "plan.spec-review"],
    [FLOW_DEFINITION, "draft-questions-review", "plan.draft-questions-review"],
    [TASK_DEFINITION, "task-impl", "task.task-impl"],
    [TASK_DEFINITION, "task-review", "task.task-review"],
    // task gate shares the impl-branch gate prompt (instructionsKey impl.impl-gate)
    [TASK_DEFINITION, "task-gate", "impl.impl-gate"],
  ];
  for (const [def, id, key] of expectations) {
    const node = resolveNodeFor(def, id);
    assert.ok(node, `step '${id}' must exist`);
    assert.equal(node.instructionsKey, key, `step '${id}' instructionsKey`);
  }
});

test("R3: every leaf instructionsKey resolves to an existing prompt file", async () => {
  const { FLOW_DEFINITION, TASK_DEFINITION, collectLeafIds, resolveNodeFor } = await import(
    path.join(repoRoot, "src", "flow", "definition.js")
  );
  const promptsDir = path.join(repoRoot, "src", "flow", "prompts");
  const check = (def) => {
    for (const id of collectLeafIds(def)) {
      const node = resolveNodeFor(def, id);
      // Only AI-prompt steps (with outputSchemaRef) back a prompt file; metadata-only
      // steps like `branch` / `prepare-spec` carry an instructionsKey without a prompt.
      if (!node || !node.instructionsKey || !node.outputSchemaRef) continue;
      const [branch, ...rest] = node.instructionsKey.split(".");
      const step = rest.join(".");
      const file = path.join(promptsDir, branch, `${step}.md`);
      assert.ok(fs.existsSync(file), `instructionsKey '${node.instructionsKey}' should resolve to ${branch}/${step}.md`);
    }
  };
  check(FLOW_DEFINITION);
  check(TASK_DEFINITION);
});
