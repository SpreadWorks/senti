# Code Review Results

### [x] 1. Align spec-local test docs with actual test behavior
**File:** `specs/204-unify-ai-prompt-style/tests/README.md`  
**Issue:** README says `placement-integrity.test.js` verifies wiring into “every interactive step instruction file,” but the test only checks `SKILL.md` wiring. This is a design-consistency gap and can mislead future maintenance.  
**Suggestion:** Update the README scope text to match the real assertions (SKILL-only), or extend the test to actually verify step-instruction files if that is still intended.

**Verdict:** APPROVED
**Reason:** This is a real consistency fix (docs currently overstate coverage) and can be done without runtime risk if you update README to match current SKILL-only assertions.

### [x] 2. Remove stale requirement text that conflicts with the finalized direction
**File:** `specs/204-unify-ai-prompt-style/flow.json`  
**Issue:** `requirements[].desc` still mentions “step instruction … get-step-instructions.js 展開,” while `spec.md` explicitly states step-instruction delivery is unchanged. This is effectively stale/dead process metadata.  
**Suggestion:** Rewrite R2/R4 descriptions in `flow.json` to match the finalized implementation scope (SKILL-based delivery + include resolver changes), so audit history is internally consistent.

**Verdict:** APPROVED
**Reason:** `flow.json` is process metadata; correcting stale requirement wording improves auditability and avoids future confusion without changing product behavior.

### [x] 3. Extract duplicated include-test fixture setup
**File:** `tests/unit/lib/include.test.js`  
**Issue:** The new tests repeat very similar file-generation logic (`for` loops creating partial files and include lines) in multiple cases.  
**Suggestion:** Add a small local helper (for example, `createLinearIncludes(count)` / `createFlatIncludes(count)`) to build fixtures once and reuse across tests. This reduces duplication and makes test intent clearer.

**Verdict:** APPROVED
**Reason:** Small local test helper extraction improves readability/maintainability and should preserve behavior if assertions and generated fixtures stay identical.

### [ ] 4. Replace ad-hoc private recursion state with a single structured state object
**File:** `src/lib/include.js`  
**Issue:** Internal recursion context is currently split across `_seen`, `_counter`, `_depth` on `opts`, which is harder to reason about and easy to misuse.  
**Suggestion:** Consolidate these into one internal state object (for example `_state: { ancestors, includeCount, depth }`) and pass it through recursion. This improves naming clarity and design consistency.

**Verdict:** REJECTED
**Reason:** Benefit is mostly stylistic, while touching recursion/cycle-limit plumbing in `resolveIncludes` risks subtle regressions in include counting, depth, and circular detection.

### [ ] 5. Clarify depth-limit semantics to avoid off-by-one ambiguity
**File:** `src/lib/include.js`  
**Issue:** The check `if (depth > MAX_INCLUDE_DEPTH)` with root depth `0` makes “8 levels” interpretation implicit and potentially confusing.  
**Suggestion:** Normalize semantics explicitly (for example, start depth at `1` and use `>`, or keep `0` and rename constants/messages to “max nested includes beyond root”) so tests and error messages describe the same boundary unambiguously.

**Verdict:** REJECTED
**Reason:** The proposal likely changes boundary behavior (or encourages it) for a currently tested limit; ambiguity can be clarified via comments/error text/tests instead of altering depth semantics.
