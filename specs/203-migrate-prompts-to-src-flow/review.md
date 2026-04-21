# Code Review Results

### [x] 1. Ensure temp-dir cleanup is exception-safe
**File:** `tests/unit/flow/get-next-action.test.js`  
**Issue:** The test creates `promptsStubDir` and `stubDir` and removes them at the end, but cleanup is skipped if an assertion throws earlier.  
**Suggestion:** Wrap the test body in `try/finally` and move both `fs.rmSync(..., { recursive: true, force: true })` calls into `finally` to prevent leftover temp directories and cross-test contamination.

**Verdict:** APPROVED
**Reason:** `try/finally` around temp-dir lifecycle improves test isolation and prevents cross-test pollution on assertion failures, with no intended behavior change.

### [ ] 2. Remove unused import
**File:** `tests/unit/flow/get-step-instructions.test.js`  
**Issue:** `os` is imported but never used. This is dead code and adds noise.  
**Suggestion:** Delete `import os from "node:os";`.

**Verdict:** REJECTED
**Reason:** Safe, but cosmetic-only; it does not materially improve quality or behavior.

### [ ] 3. Eliminate duplicated key-to-path logic
**File:** `tests/unit/flow/instructions-coverage.test.js`  
**Issue:** `keyToFilePath()` duplicates the key parsing/path resolution logic already implemented in `src/flow/lib/get-step-instructions.js` (`resolveKeyPath` behavior). This can drift over time.  
**Suggestion:** Export a small pure helper (e.g., `instructionsKeyToPromptPath`) from `get-step-instructions.js` and reuse it in this test to keep one canonical mapping rule.

**Verdict:** REJECTED
**Reason:** Reusing production mapping logic inside the coverage test weakens the test’s independence and can hide regressions in that logic.

### [ ] 4. Strengthen key-shape validation for consistency
**File:** `src/flow/lib/get-step-instructions.js`  
**Issue:** Validation only checks `parts.length < 2`, so malformed keys like `plan.` or `.draft` still pass shape checks and fail later as file errors.  
**Suggestion:** Validate that every segment is non-empty before joining paths, and throw `INSTRUCTIONS_INVALID_KEY` for malformed keys. This keeps error semantics consistent and easier to debug.

**Verdict:** REJECTED
**Reason:** It changes error semantics (`NOT_FOUND` vs `INVALID_KEY`) for previously accepted malformed keys, which risks breaking existing callers/tests.

### [ ] 5. Reduce instruction duplication across gate prompt files
**File:** `src/flow/prompts/impl/gate-impl.md`  
**Issue:** Very similar gate instructions are duplicated across `impl/gate-impl.md`, `task/gate.md`, and `plan/gate.md`, which increases maintenance drift risk.  
**Suggestion:** Factor shared gate wording into a common include fragment and keep only phase-specific differences in each file.

**Verdict:** REJECTED
**Reason:** Mostly maintainability-driven and risky in prompt/runtime behavior; shared includes can unintentionally alter phase-specific wording or rendering paths.
