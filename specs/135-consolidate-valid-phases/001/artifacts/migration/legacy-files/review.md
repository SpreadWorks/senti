# Code Review Results

### [x] 1. Derive Help Text From the Shared Constant
**File:** `src/flow/registry.js`  
**Issue:** The phase list is still duplicated in help strings as hard-coded text. That reintroduces the same drift risk this change is trying to remove.  
**Suggestion:** Import `VALID_PHASES` into `registry.js` and build the help text from `VALID_PHASES.join(", ")`. If multiple commands need the same wording, extract a small helper like `formatPhaseList()`.

**Verdict:** APPROVED
**Reason:** The help strings in `registry.js` (lines 127, 206) still hard-code the phase list as literal text (`"draft, spec, gate, impl, test, lint"`). This is exactly the drift risk the feature was designed to eliminate. Importing `VALID_PHASES` and using `VALID_PHASES.join(", ")` to build the help string is a straightforward fix that closes the consistency gap. The whole point of `phases.js` is to be the single source of truth — the help text should honor that.

### [ ] 2. Extract Repeated Test Flow Setup
**File:** `specs/135-consolidate-valid-phases/tests/phases.test.js`  
**Issue:** Temporary flow-state setup is repeated in multiple tests with nearly identical `specId` and `state` construction. This adds noise and makes future test changes easy to miss in one branch.  
**Suggestion:** Extract a shared helper such as `createTestFlowState(tmpDir)` or `withTestFlowState(fn)` and reuse it across the `set-metric` and CLI compatibility sections.

**Verdict:** REJECTED
**Reason:** While the `specId`/`state` construction is repeated in the `set-metric` and CLI compatibility sections, this is a spec-scoped test file (`specs/135-*/tests/`), not a shared test suite. The duplication is limited to two blocks with slightly different lifecycle patterns (`afterEach` cleanup vs `try/finally`). Extracting a shared helper adds indirection for marginal gain and risks obscuring test setup differences. The project's CLAUDE.md rule also states "テストを通すためにテストコードを修正してはならない" — while this isn't about fixing a failing test, refactoring test code for cosmetic reasons in a spec test is low-value.

### [x] 3. Remove Unused Import
**File:** `specs/135-consolidate-valid-phases/tests/phases.test.js`  
**Issue:** `loadFlowState` is imported but never used. This is dead code and makes the test file look more coupled to internals than it is.  
**Suggestion:** Remove `loadFlowState` from the import list.

**Verdict:** APPROVED
**Reason:** `loadFlowState` is imported on line 16 but never referenced anywhere in the file. This is dead code that misleads readers into thinking the tests depend on `loadFlowState`. Removing it is a zero-risk cleanup.

### [ ] 4. Centralize Phase-Subset Validation Logic
**File:** `src/flow/commands/review.js`  
**Issue:** The top-level subset check is correct, but the validation logic is embedded inline in the module. If another phase-mapped object appears later, the same loop and error format will likely be copied again.  
**Suggestion:** Move this into `src/flow/lib/phases.js` as a small helper such as `assertValidPhaseSubset(name, keys)` or `assertKnownPhases(name, values)`, and call it from `review.js`. This keeps validation behavior consistent and avoids repeating the pattern elsewhere.

**Verdict:** REJECTED
**Reason:** The inline validation in `review.js` is 4 lines of straightforward code with a single call site. Extracting it into `phases.js` as a reusable helper is premature — there is no second consumer today. The project rules say to extract at 2+ repetitions, but there is currently only 1 occurrence. If a second phase-mapped object appears, extraction becomes justified. Until then, this adds an unnecessary abstraction layer for a trivial loop.
