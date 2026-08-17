# Code Review Results

### [x] 1. Avoid Re-walking the Entire Worktree for Every Glob
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkExpectedTests()` calls `walkDir(root)` inside the loop for each glob entry, repeating the same expensive traversal and duplicating work.  
**Suggestion:** Precompute `allFiles`/`relFiles` once before the loop (only if at least one glob exists), then reuse that list for all glob checks.

**Verdict:** APPROVED
**Reason:** This is a real performance improvement (eliminates repeated full-tree scans) and should preserve behavior in normal use; it only changes edge behavior if files mutate during the same check.

### [x] 2. Fix Global File-Limit Enforcement in Recursive Walk
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `WALK_MAX_FILES` is checked against each function-local `results.length`, so deep recursion can exceed the intended global cap.  
**Suggestion:** Pass a shared accumulator/counter through recursion (or use iterative traversal) so `WALK_MAX_FILES` is enforced across the whole walk, not per directory frame.

**Verdict:** APPROVED
**Reason:** Current enforcement is effectively per-recursion-frame, not global, so the cap can be bypassed. A shared counter/accumulator fixes a correctness and safety issue with low behavioral risk.

### [ ] 3. Remove Limit Duplication Between Runtime and Schema
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `EXPECTED_TESTS_MAX_ENTRIES = 50` duplicates schema constraint `maxItems: 50`, which can drift over time.  
**Suggestion:** Keep one source of truth for this limit (for example, define a shared constant module used by both runtime checks and schema generation, or clearly document and centralize synchronization).

**Verdict:** REJECTED
**Reason:** Goal is valid, but forcing a single source of truth across JS runtime code and static JSON schema tends to add coupling/tooling complexity for limited practical gain; high churn risk for a minor maintenance concern.

### [ ] 4. Extract Repeated Error Construction into a Helper
**File:** `src/flow/lib/run-gate.js`  
**Issue:** The same `Error` creation pattern with `err.code = "EXPECTED_TESTS_LIMIT_EXCEEDED"` appears multiple times.  
**Suggestion:** Add a small helper like `createExpectedTestsLimitError(message)` to reduce duplication and keep error semantics consistent.

**Verdict:** REJECTED
**Reason:** Mostly cosmetic refactoring with minimal quality gain (very small duplication), and no meaningful behavior improvement.

### [x] 5. Clarify Glob Detection Naming/Behavior
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `isGlobPattern()` only checks `*` and `?`, while `globToRegExp()` may support richer glob syntax; the current name implies broader detection than implemented.  
**Suggestion:** Either expand detection to all supported glob metacharacters or rename to something explicit like `hasWildcardStarOrQuestion()` to match actual behavior.

**Verdict:** APPROVED
**Reason:** There is a clarity/correctness mismatch today. Aligning detection with supported syntax or using a precise name improves maintainability and reduces misinterpretation without inherently changing core logic.
