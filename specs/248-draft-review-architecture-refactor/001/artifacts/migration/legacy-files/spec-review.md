# Spec Review Results

## Proposals

### 1. I’ll inspect the review flow files, prompt templates, registry hooks, and generated skill/template references so the proposals are grounded in the current code rather than the spec text alone.The first broad search did not return usable output, so I’m narrowing the checks to the exact source tree and then I’ll pull the relevant files directly.The working directory provided for this review is an empty scratch directory, so I’m relying on the supplied codebase context for module relationships and using only non-mutating checks from here. The main risk areas are now clear: generated skill instructions, parser `next` semantics, and tests/contracts around envelopes and provider output.I found the repository one level above the scratch directory. I’m going to read the relevant files by absolute/relative path without mutating anything, especially the template paths and tests that are easy to miss from the spec.### 1. Review Verdict Schema Still Uses Lowercase
**File:** `src/flow/schemas/next-action/review.schema.json`  
**Issue:** R7 requires canonical verdict values to be uppercase `PASS` / `FAIL`, but the next-action review schema still defines `["pass", "fail"]`. This contradicts the prompt contract.  
**Suggestion:** Add a requirement to update `review.schema.json` to uppercase, and update any schema-validation tests that assert lowercase verdicts.

### 2. 2. Prompt-Driven Loop Conflicts With `next` Semantics
**File:** `src/flow/lib/run-review.js`  
**Issue:** R5 says `verdict=PASS` should keep the previous `next` value, while the design says review step completion and progression are prompt-driven. Existing next values like `gate-draft`, `approval`, and `implement` can still be interpreted as automatic progression hints.  
**Suggestion:** Clarify whether plan review phases should return `next: null` for both PASS and FAIL, or explicitly state that skill instructions must ignore `next` for review phases and rely only on verdict.

### 3. 3. Flow Skill Needs Phase-Specific Review Hook Rules
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The skill currently treats any `flow run review` command as hook-managed completion. The spec says plan review hooks should no longer auto-done, but Out keeps impl/code review behavior unchanged.  
**Suggestion:** Update the spec to require phase-specific wording: `flow run review --phase draft|spec|test` does not auto-complete the step; plain impl/task `flow run review` still uses the existing hook.

### 4. 4. Task Review Prompt Is Not Explicitly Out Of Scope
**File:** `src/flow/prompts/task/review.md`  
**Issue:** The spec excludes “code / impl phase review”, but task-level review also depends on the fallback `review` post hook and says step status is automatically managed. It is not explicitly mentioned.  
**Suggestion:** Add `src/flow/prompts/task/review.md` and `src/flow/prompts/impl/review.md` to Out of Scope, or explicitly say their hook instructions remain unchanged.

### 5. 5. Draft AutoApprove Instructions Still Approve Inside Draft
**File:** `src/flow/prompts/plan/draft.md`  
**Issue:** R2 removes approval from draft, but the existing autoApprove section tells the AI to set `approval.approved = true`, write approval notes, and proceed. That conflicts with R3’s move of approval to `review-draft`.  
**Suggestion:** Require rewriting the autoApprove draft section so it only completes draft content; approval must happen after `review-draft` PASS.

### 6. 6. Provider Boundary For Streaming JSON Filtering Is Underspecified
**File:** `src/lib/provider.js`  
**Issue:** The spec targets `agent.js` plain text mode, but built-in Claude/Codex JSON handling lives in `provider.js`. Custom Claude profiles without `jsonOutputFlag` may be treated as plain text, while built-in profiles should continue through provider parsing.  
**Suggestion:** Specify the boundary: filtering applies only when `profile.jsonOutputFlag` is absent and must not affect provider-parsed Claude/Codex JSON modes. Add tests for custom Claude streaming JSON plain-text output.

### 7. 7. Tests Depending On Old Review Contracts Are Not Listed
**File:** `tests/unit/flow/get-next-action.test.js`  
**Issue:** Tests currently validate lowercase review verdict schema and broader review-step behavior. The spec changes verdict casing, exit semantics, parser behavior, and registry post-hook behavior but does not mention affected tests.  
**Suggestion:** Add test scope requirements covering uppercase review schema, `verdict=FAIL` with exit 0, no retry on review FAIL, no plan-review auto-done post hook, and unchanged impl/task review hook behavior.
