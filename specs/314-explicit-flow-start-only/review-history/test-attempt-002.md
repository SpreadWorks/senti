# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/314-explicit-flow-start-only/test-coverage.json`

## Blocking Findings

### 1. Upgrade evidence can be faked without exercising senti upgrade behavior
**Target:** specs/314-explicit-flow-start-only/tests/explicit-flow-start-only.test.js:74
**Issue:** The R5 test only reads a committed specs/314-explicit-flow-start-only/upgrade-result.json file and checks that it says ok with a matching changed string. It does not verify that generated skill or preset artifacts were actually refreshed, nor that the evidence was produced by running the setup/upgrade path against the current source templates.
**Required change:** Add a spec-local assertion that compares the relevant generated skill/preset artifacts against the source templates or otherwise verifies the current generated outputs reflect the source changes, not just the presence of upgrade-result.json.
**Why blocking:** R5 requires refreshed generated artifacts after source template changes using senti upgrade. A stale or manually edited JSON file could satisfy this test while production generated artifacts remain outdated, so the test has a static anti-pattern that can pass without exercising the required behavior.

### 2. Generated AGENTS coverage does not verify regeneration path or source parity
**Target:** specs/314-explicit-flow-start-only/tests/explicit-flow-start-only.test.js:83
**Issue:** The R6 test only checks root AGENTS.md and optional CLAUDE.md for forbidden wording. It does not verify that AGENTS.md was regenerated through the setup/docs-agent path or that readable generated guidance matches the refreshed template content expected by the new policy.
**Required change:** Add a spec-local assertion that verifies regeneration evidence or parity between generated AGENTS.md/CLAUDE.md guidance and the refreshed templates, in addition to checking forbidden wording absence.
**Why blocking:** R6 specifically requires generated AGENTS.md and CLAUDE.md guidance to be refreshed or verified through the setup/docs-agent regeneration path. A manually edited generated file with old omissions or stale non-forbidden content could pass the current test, so the coverage does not correspond to the requirement.


## Advisory Findings

No advisory findings.