# Code Review Results

### [ ] 1. Reuse guardrail assertion helpers instead of repeating `map`/`find` loops
**File:** `specs/138-symfony-guardrails/tests/guardrail-content.test.js`  
**Issue:** The test repeats the same patterns many times: building `jaIds`, checking `includes(id)`, then calling `find()` again to inspect phases. This is duplicated logic and makes the test harder to extend when more guardrails are added.  
**Suggestion:** Precompute an `id -> guardrail` map once per fixture and extract helpers such as `assertGuardrailsExist(ids, map)` and `assertGuardrailHasPhases(id, map, ["spec"])`. This removes repeated scans and keeps the test focused on the expected rule sets.

**Verdict:** REJECTED
**Reason:** The repeated `map`/`find` pattern in the test file is idiomatic for `node:test` assertion-style tests and makes each test block self-contained and readable. The data is loaded once at module scope (`loadGuardrails`), so there's no performance concern. Extracting helpers like `assertGuardrailsExist()` adds indirection that obscures what each test actually verifies. The repetition is structural, not logic duplication — each test checks different id sets against different phase expectations. This is a cosmetic-only proposal with no quality improvement.

### [ ] 2. Restore a named sanitizer instead of leaving regex cleanup inline
**File:** `src/flow/commands/review.js`  
**Issue:** The spec-fix cleanup is now an inline regex chain inside `runSpecReview()`. That makes the intent less obvious than the previous `stripPreamble()` helper and weakens naming consistency in a module that otherwise uses named helpers for prompt building and validation.  
**Suggestion:** Extract the cleanup into a narrowly named helper such as `stripMarkdownFences()` or `sanitizeSpecFixOutput()`, then call it from `runSpecReview()`. This keeps the review pipeline readable and gives the cleanup step a clear contract.

**Verdict:** REJECTED
**Reason:** The diff shows that `stripPreamble()` was deliberately removed in this branch because the previous spec (#138-fix-review-preamble) was replaced by the current work (#138-symfony-guardrails). The inline regex `.replace(/^```(?:markdown)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()` on line 749 is a two-step fence strip — simple enough to be self-documenting, especially with the comment "Extract spec content (strip markdown fences if present)" immediately above it. Extracting a single-use two-line operation into a named helper adds indirection without a second consumer. The previous `stripPreamble()` was more complex (fence removal + preamble header detection); the current code only does fence stripping, so the old name wouldn't fit anyway.

### [x] 3. Keep the spec-fix prompt aligned with the validator’s output contract
**File:** `src/flow/commands/review.js`  
**Issue:** `buildSpecFixPrompt()` was simplified from explicit output rules to a generic “Output the complete updated spec.md content.” At the same time, the fix path still depends on `isValidSpecOutput()` expecting actual spec content. The prompt and validator now describe different levels of strictness.  
**Suggestion:** Restore the explicit constraints (“no preamble”, “no markdown fences”, “start with the first heading”) or define them as a shared prompt contract constant used by both the prompt builder and the sanitizing/validation path. That keeps the design consistent and reduces hidden assumptions.

**Verdict:** APPROVED
**Reason:** This is a genuine design consistency issue. The diff shows `buildSpecFixPrompt` was simplified from explicit output constraints ("no preamble", "no markdown fences", "start with the spec's first heading") to just "Output the complete updated spec.md content." Meanwhile, the downstream `isValidSpecOutput()` still validates that output starts with a spec header, and the inline cleanup still strips markdown fences — meaning the code expects problems the prompt no longer attempts to prevent. The two-layer defense (prompt + sanitize) was the explicit design from spec #138-fix-review-preamble. Weakening the prompt layer without documenting why creates a hidden assumption gap that will cause more AI preamble injection issues. Restoring the constraints or sharing them as a constant costs nothing and prevents real bugs.

### [x] 4. Remove the reintroduced obsolete draft-step command
**File:** `src/templates/skills/sdd-forge.flow-plan/SKILL.md`  
**Issue:** The draft instructions reintroduce `sdd-forge flow run scan`, while nearby changes show this command had already been treated as obsolete in the workflow docs. Leaving a dead command in the skill template creates maintenance noise and inconsistent process guidance.  
**Suggestion:** Delete the `flow run scan` step again, or replace it with the currently supported command path if one exists. The skill should describe only executable workflow steps.

**Verdict:** APPROVED
**Reason:** The diff clearly shows `sdd-forge flow run scan` was reintroduced in the SKILL.md template (line 106), but `flow run scan` does not exist — there is no `scan` entry in `registry.js` and no handler in `src/flow/run/`. The previous spec (#140-fix-skill-scan-cmd) explicitly removed this dead command, and the deleted `specs/140-fix-skill-scan-cmd/` confirms it was already fixed. This branch's changes to SKILL.md inadvertently reverted that fix. Leaving a non-existent command in the skill template will cause runtime errors when the SDD flow executes the draft phase.
