// spec: R13
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

test("R13: base preset guardrail.json has a code-quality entry covering integration and task-impl", () => {
  const file = path.join(repoRoot, "src/presets/base/guardrail.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const codeQuality = (data.guardrails || []).filter((g) => g?.meta?.category === "code-quality");
  assert.ok(codeQuality.length >= 1, "base preset must have at least one code-quality guardrail");
  const newRule = codeQuality.find((g) => /indirection|DRY|design direction/i.test(g.text || ""));
  assert.ok(newRule, "expected a code-quality rule covering indirection/DRY/design direction");
  const phase = newRule.meta?.phase || [];
  assert.ok(phase.includes("integration"), "phase must include integration");
  assert.ok(phase.includes("task-impl"), "phase must include task-impl");
});

test("R13: filterByPhase surfaces the new rule in integration and task-impl, not in spec", async () => {
  const { filterByPhase, loadMergedGuardrails } = await import(path.join(repoRoot, "src/lib/guardrail.js"));
  const merged = loadMergedGuardrails(repoRoot);
  const integration = filterByPhase(merged, "integration").map((g) => g.id);
  const taskImpl = filterByPhase(merged, "task-impl").map((g) => g.id);
  const spec = filterByPhase(merged, "spec").map((g) => g.id);
  const overlap = integration.filter((id) => taskImpl.includes(id));
  assert.ok(overlap.length >= 1, "at least one rule must surface in both integration and task-impl");
  for (const id of overlap) {
    assert.ok(!spec.includes(id), `rule ${id} must NOT surface in spec`);
  }
});
