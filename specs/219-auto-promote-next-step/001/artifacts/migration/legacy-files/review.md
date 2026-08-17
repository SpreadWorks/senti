# Code Review Results

### [x] 1. Remove orphaned/duplicated JSDoc block
**File:** `src/lib/flow-store.js`  
**Issue:** A standalone JSDoc block (`@returns {object} scope object on which to mutate`) appears immediately before the new `promoteFirstPending` comment, which makes the docs flow ambiguous and looks like leftover documentation for `resolveMutationScope`.  
**Suggestion:** Move that `@returns` block directly above `resolveMutationScope` (or merge it into one coherent JSDoc there) and keep `promoteFirstPending` with its own dedicated comment only.

**Verdict:** APPROVED
**Reason:** This is a documentation-structure fix that improves clarity and has no runtime impact, so behavior should remain unchanged.

### [ ] 2. Make fallback promotion logic more explicit
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** `const promoted = (task && promoteFirstPending(task.steps)) || promoteFirstPending(state.steps);` is compact but mixes short-circuiting with mutation side effects, which hurts readability and debugging.  
**Suggestion:** Replace with explicit branching:
- decide target step list (`task?.steps ?? state.steps`)
- call `promoteFirstPending` once (or call task first then flow in separate `if`)
- rename `promoted` to `promotedStep` for intent clarity.

**Verdict:** REJECTED
**Reason:** As proposed, it risks subtle behavior changes in fallback order/scope (task vs flow) and side-effect timing; readability gain is not worth potential regression unless semantics are explicitly preserved.

### [x] 3. Extract repeated test setup into helpers
**File:** `tests/unit/flow.test.js`  
**Issue:** New tests repeat the same setup sequence (`createTmpDir` → `setupFlow` → `makeFlowManager`) and repeated step lookup/assert patterns, increasing noise and maintenance cost.  
**Suggestion:** Add local test helpers (e.g., `createFlowManagerFixture()` and `findStep(state, id)`) and reuse them across these new cases to reduce duplication and make each test focus only on behavior differences.

**Verdict:** APPROVED
**Reason:** This reduces real duplication in tests and improves maintainability without changing production behavior, if helpers are kept local and simple.

### [x] 4. Reduce duplicated state-shaping patterns in next-action tests
**File:** `tests/unit/flow/get-next-action.test.js`  
**Issue:** The new auto-recovery tests manually mutate all step statuses inline (`for ... of state.steps`) with ad-hoc logic; this pattern is likely to repeat for future edge cases.  
**Suggestion:** Introduce a small helper in this file (e.g., `setStatuses(state, doneIds)` or `markAllSteps(state, status)`) and reuse it, improving consistency and reducing accidental test drift.

**Verdict:** APPROVED
**Reason:** Consolidating repeated status-mutation patterns lowers test drift risk and improves consistency, with no production behavior impact.
