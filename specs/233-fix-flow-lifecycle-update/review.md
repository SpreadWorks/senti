# Code Review Results

### [x] 1. Keep Expected `ERR_MISSING_FILE` Silent During Finalize Step Updates
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** The new loop logs warnings for all errors, including `ERR_MISSING_FILE`, which was previously treated as an expected condition during cleanup timing. This can create noisy, non-actionable warnings.  
**Suggestion:** Restore selective suppression for `ERR_MISSING_FILE` inside the loop (or via a small local helper like `markStepDoneIfExists(stepId)`), and only log genuinely unexpected errors.

**Verdict:** APPROVED
**Reason:** This restores prior intent: `ERR_MISSING_FILE` is expected during finalize/cleanup timing and warning on it is noisy. Suppressing only that code improves signal without changing functional behavior.

### [ ] 2. Extract Flow Status Mapping to a Named Helper
**File:** `src/docs/commands/changelog.js`  
**Issue:** Flow status derivation is now embedded inline (`flow.state?.finalizedAt ? "completed" : "active"`), which makes lifecycle-state mapping harder to evolve and less self-documenting.  
**Suggestion:** Introduce a local helper such as `resolveFlowStatus(flow)` and call it from `parseSpecDir`. This improves naming clarity and keeps status-mapping logic consistent in one place.

**Verdict:** REJECTED
**Reason:** As proposed, this is mostly naming/structure polish around a single simple expression. It adds indirection with little concrete quality gain and no clear behavior-risk reduction.

### [x] 3. Remove Legacy `lifecycle` From Test State Construction
**File:** `tests/unit/lib/flow-state-runid.test.js`  
**Issue:** The test now does `delete state.lifecycle`, which indicates the local state fixture still builds deprecated schema by default. That keeps dead structure alive in tests.  
**Suggestion:** Update this test file’s `makeState` fixture so it does not include `lifecycle` unless explicitly requested. Then remove ad-hoc `delete` calls for cleaner, forward-only schema tests.

**Verdict:** APPROVED
**Reason:** This is a meaningful test-quality improvement: it removes deprecated schema from default fixtures and makes forward-schema intent explicit. Product behavior is unchanged; only test setup is cleaned up.

### [ ] 4. Simplify Flow Fixture Construction Without Mutation
**File:** `tests/e2e/docs/commands/changelog.test.js`  
**Issue:** `fixtureFlowJson` builds `flow` and mutates it conditionally (`if (finalizedAt) flow.state = ...`), which is a minor readability and consistency issue for fixture patterns.  
**Suggestion:** Return a single expression using conditional object spread so both active/completed cases are declarative and easier to scan.

**Verdict:** REJECTED
**Reason:** This is cosmetic-only refactoring (mutation vs expression style) with negligible quality impact and no behavioral benefit. Conservative review should not accept style-only churn.
