# Code Review Results

### [x] 1. Extract Impl-Specific Prompt Block
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `buildGuardrailPrompt` now embeds a long impl-only instruction block inline, which makes the function harder to scan and increases maintenance cost if similar phase-specific blocks grow.  
**Suggestion:** Move the impl diff-scope text into a dedicated helper or constant (e.g., `buildImplDiffScopeConstraint()` / `IMPL_DIFF_SCOPE_LINES`) and append it conditionally. This keeps the core prompt assembly pattern consistent and easier to extend.

**Verdict:** APPROVED
**Reason:** Improves readability/maintainability of `buildGuardrailPrompt` by isolating impl-only logic, and can preserve behavior if the extracted text is appended identically under the same `phase === "impl"` condition.

### [x] 2. Replace Keyword-Heuristic Assertions with Stable Phrase Assertions
**File:** `tests/unit/specs/commands/guardrail.test.js`  
**Issue:** The new tests validate behavior via loose keyword combinations (`added|changed|modified` + `line`, `pre-existing|preexisting|unchanged`), which can pass even if the intended instruction degrades semantically.  
**Suggestion:** Assert for a few canonical phrases that the implementation intentionally guarantees (or shared constants if introduced). This reduces false positives and makes tests more precise.

**Verdict:** APPROVED
**Reason:** Makes tests more semantically strict and reduces false positives; behavior impact is limited to test accuracy (not runtime behavior), assuming phrases/constants are treated as intentional contract.

### [ ] 3. Remove Repeated Prompt Normalization Logic
**File:** `tests/unit/specs/commands/guardrail.test.js`  
**Issue:** `buildGuardrailPrompt(...)` + `toLowerCase()` is repeated across multiple test cases, creating avoidable duplication.  
**Suggestion:** Introduce a small local helper (e.g., `buildPromptLower(targetText, phase = "impl")`) and reuse it in all new cases to keep tests shorter and consistent.

**Verdict:** REJECTED
**Reason:** Mostly cosmetic DRY cleanup with minimal quality gain; duplication here is small and not a meaningful refactor.

### [ ] 4. Improve Test Variable Naming Clarity
**File:** `tests/unit/specs/commands/guardrail.test.js`  
**Issue:** Names like `lower` and `implGuardrails` are understandable but generic in a section that is phase-specific and constraint-specific.  
**Suggestion:** Rename to intent-revealing identifiers such as `promptLower` and `implPhaseGuardrails` to align with readability conventions in the rest of the suite.

**Verdict:** REJECTED
**Reason:** Purely cosmetic renaming with no substantive quality or correctness improvement.

### [ ] 5. Remove or Fill Placeholder Q&A Template
**File:** `specs/195-gate-guardrail-diff-scope/qa.md`  
**Issue:** The file contains an empty `Q:` / `A:` placeholder, which behaves like dead content and can confuse whether clarification is still pending.  
**Suggestion:** Either remove the placeholder block entirely or replace it with actual resolved clarifications only. This keeps spec artifacts clean and avoids stale template residue.

**Verdict:** REJECTED
**Reason:** Documentation hygiene only; does not improve code quality or runtime/test behavior.
