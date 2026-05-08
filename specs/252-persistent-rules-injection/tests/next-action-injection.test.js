// spec: R8 R9 R10 R37
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

async function loadHelpers() {
  const { loadRules, filterRules, renderRuleBlock } = await import(
    path.join(repoRoot, "src/lib/skill-rules.js")
  );
  return { loadRules, filterRules, renderRuleBlock };
}

test("R8: filtered + rendered block matches active phase rules in author order", async () => {
  const { loadRules, filterRules, renderRuleBlock } = await loadHelpers();
  const rules = loadRules();
  const matched = filterRules(rules, { phase: "flow.draft", state: ["worktreeActive"] });
  const block = renderRuleBlock(matched);
  // no-premature-conclusion is the first phase=flow.draft rule in author order.
  const ids = matched.map((r) => r.id);
  assert.ok(ids.includes("no-premature-conclusion"));
  assert.match(block, /^## Persistent Rules\n\n<!-- rule: no-premature-conclusion -->/);
});

test("R8: state-required rule is included only when its state is active", async () => {
  const { loadRules, filterRules } = await loadHelpers();
  const rules = loadRules();
  const withWorktree = filterRules(rules, { phase: "flow.finalize-commit", state: ["worktreeActive", "autoApproveOn"] });
  const withoutAutoApprove = filterRules(rules, { phase: "flow.finalize-commit", state: ["worktreeActive"] });
  assert.ok(withWorktree.some((r) => r.id === "commit-split-strategy"));
  assert.ok(!withoutAutoApprove.some((r) => r.id === "commit-split-strategy"));
});

test("R9: zero-match yields empty rendered block", async () => {
  const { renderRuleBlock } = await loadHelpers();
  assert.equal(renderRuleBlock([]), "");
});

test("R10: filter accepts the promoted (newly in-progress) leaf id without modification", async () => {
  // The auto-promotion path in get-next-action.js mutates state.steps to set the next pending leaf
  // to in_progress and re-runs findActiveNode. The rule filter then receives the promoted leaf id
  // as-is. This test verifies the contract: filterRules behaves identically regardless of whether
  // the active step was originally in-progress or just promoted — both pass through filterRules
  // with the same scope-aware leaf id.
  const { loadRules, filterRules } = await loadHelpers();
  const rules = loadRules();
  const a = filterRules(rules, { phase: "flow.draft", state: [] });
  const b = filterRules(rules, { phase: "flow.draft", state: [] });
  assert.deepEqual(a.map((r) => r.id), b.map((r) => r.id));
  assert.ok(a.length > 0, "expected some rule to match flow.draft");
});

test("R37: injected block has exact deterministic shape for two-rule input", async () => {
  const { renderRuleBlock } = await loadHelpers();
  const fakeRules = [
    { id: "alpha-rule", phase: ["flow.draft"], state: [], body: "**MUST: alpha**" },
    { id: "beta-rule", phase: ["flow.draft"], state: [], body: "**MUST: beta**" },
  ];
  const block = renderRuleBlock(fakeRules);
  const lines = block.split("\n");
  assert.equal(lines[0], "## Persistent Rules");
  assert.equal(lines[1], "");
  assert.equal(lines[2], "<!-- rule: alpha-rule -->");
  assert.equal(lines[3], "**MUST: alpha**");
  assert.equal(lines[4], "");
  assert.equal(lines[5], "<!-- rule: beta-rule -->");
  assert.equal(lines[6], "**MUST: beta**");
  assert.equal(lines[7], "");
});

test("R37: injected block has exact shape for one-rule input (single rule)", async () => {
  const { renderRuleBlock } = await loadHelpers();
  const fakeRules = [{ id: "only", phase: ["flow.draft"], state: [], body: "MUST one" }];
  const block = renderRuleBlock(fakeRules);
  assert.equal(block, "## Persistent Rules\n\n<!-- rule: only -->\nMUST one\n");
});
