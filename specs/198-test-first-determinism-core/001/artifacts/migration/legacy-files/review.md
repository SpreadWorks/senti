# Code Review Results

### [x] 1. Remove Dead Imports and Constants in Spec E2E Test
**File:** `specs/198-test-first-determinism-core/tests/e2e-task-complete-run.test.js`  
**Issue:** `execFileSync` and `FLOW_CMD` are declared/imported but never used. This is dead code and adds noise.  
**Suggestion:** Remove the unused `execFileSync` import and `FLOW_CMD` constant to keep the test focused and reduce maintenance clutter.

**Verdict:** APPROVED
**Reason:** `execFileSync` and `FLOW_CMD` are unused in that test file, so removing them improves clarity with no behavior impact.

### [ ] 2. Unify Integration Step IDs to a Single Source of Truth
**File:** `tests/unit/lib/flow-helpers-integration-skip.test.js`  
**Issue:** `INTEGRATION_STEPS` is duplicated in the test while production now exports `INTEGRATION_STEP_IDS`. This can drift and break design consistency.  
**Suggestion:** Import and use `INTEGRATION_STEP_IDS` from `src/lib/flow-helpers.js` instead of redefining the same list in the test.

**Verdict:** REJECTED
**Reason:** In tests, duplicating expected IDs is often intentional; importing production constants can weaken the test by validating behavior against the same source it is supposed to verify.

### [ ] 3. Clarify Retry Semantics and Naming in Draft Task Loop
**File:** `src/flow/lib/run-draft-task.js`  
**Issue:** `while (attempts <= retryMax)` executes `retryMax + 1` times, but variable naming (`retryMax`) reads like a total-attempt cap. This is easy to misread and causes ambiguity.  
**Suggestion:** Rename to `maxRetries` and implement `1 + maxRetries` intentionally, or keep `retryMax` and change loop to `< retryMax` for true max-attempt semantics. Add one explicit comment documenting which contract is intended.

**Verdict:** REJECTED
**Reason:** The proposal mixes two different semantic changes (rename vs loop bound change). Without explicitly locking the contract first, this risks behavior drift in retry count.

### [x] 4. Eliminate Repeated Glob Compilation in Context Filtering
**File:** `src/flow/lib/get-context.js`  
**Issue:** `matchesAny()` recompiles glob regexes on every call (`globToRegExp(g)` each time), and this logic is reused across file/list/search paths.  
**Suggestion:** Compile `blockedGlobs` once (e.g., `blockedMatchers`) right after `resolveWriteTestsTargets(ctx)` and reuse compiled regexes in all modes. This removes duplicated work and simplifies filtering logic.

**Verdict:** APPROVED
**Reason:** Precompiling blocked globs once is a real quality/performance improvement and can preserve behavior if matcher semantics stay identical.

### [ ] 5. Remove Duplicate/Outdated Comment Block in Test Runner
**File:** `src/flow/lib/run-tests.js`  
**Issue:** `parseCountsFromLog` has two consecutive docblocks, where the first is partially outdated and redundant. This weakens naming/documentation clarity.  
**Suggestion:** Keep one authoritative docblock describing current parsing behavior and delete the duplicate block.

**Verdict:** REJECTED
**Reason:** This is documentation-only cleanup and does not materially improve behavior or design; conservative review should reject cosmetic-only refactors.

### [x] 6. Avoid Hardcoding “No Tasks” at Initial Step Construction
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** `buildInitialSteps({ tasks: [] })` is always called, forcing integration steps to `skipped` regardless of actual task presence. This risks inconsistency with the intended step policy.  
**Suggestion:** Pass real spec task data when available (or defer skip decision until tasks are known). If tasks are intentionally unknown here, make that explicit in naming/comment and perform a later normalization pass.

**Verdict:** APPROVED
**Reason:** Hardcoding `tasks: []` at initialization can force incorrect `skipped` integration states; using real task data or deferring the decision improves correctness and alignment with intended policy.
