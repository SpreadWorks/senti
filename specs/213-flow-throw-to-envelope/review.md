# Code Review Results

### [x] 1. Remove duplicated dirty-worktree checks
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** Worktree cleanliness is checked twice (`getWorktreeStatus(...)` in `execute` and `ensureClean(...)` right after), with different error messages. This duplicates logic and can create inconsistent behavior.  
**Suggestion:** Keep a single check path. Prefer one helper (e.g., `ensureClean`) that returns a consistent error shape/message and remove the inline pre-check.

**Verdict:** APPROVED
**Reason:** This is a real maintainability issue (duplicated checks + inconsistent messages). Consolidating to one check path reduces drift risk without changing core gate behavior.

### [ ] 2. Align helper naming with actual return contract
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkRetryBelowMax` and `checkNoProgressSinceLastFail` return `Envelope|null`, but `check*` reads like boolean predicates.  
**Suggestion:** Rename to contract-revealing names like `getRetryBudgetFailureEnvelope` / `getNoProgressFailureEnvelope` (or similar), so call sites are self-explanatory and pattern-consistent.

**Verdict:** REJECTED
**Reason:** The improvement is mostly naming-level, while these are exported helpers used by tests/callers; renaming adds churn and compatibility risk with limited functional gain.

### [x] 3. Reduce repetitive validation branching
**File:** `src/flow/lib/set-issue-log.js`  
**Issue:** Optional field validation is repeated in near-identical blocks (`trigger`, `resolution`, `guardrail-candidate`), which is duplication-prone.  
**Suggestion:** Iterate over a small field list and run one shared validation loop that returns on first failure. This keeps behavior identical while simplifying maintenance.

**Verdict:** APPROVED
**Reason:** This removes true duplication in validation logic and can preserve behavior if it keeps the same field order and first-failure return semantics.

### [x] 4. Normalize error-code naming in spec test docs
**File:** `specs/213-flow-throw-to-envelope/tests/README.md`  
**Issue:** The matrix uses `GATE_RETRY_EXHAUSTED` / `GATE_NO_PROGRESS_SINCE_LAST_FAIL`, while implementation/tests use `ESCALATE_RETRY_EXHAUSTED` / `NO_PROGRESS_SINCE_LAST_FAIL`.  
**Suggestion:** Update the README code names to exactly match runtime codes to avoid drift and false expectations.

**Verdict:** APPROVED
**Reason:** Docs currently drift from runtime/test codes; correcting names improves correctness of expectations with no runtime risk.

### [x] 5. Refactor repetitive test case boilerplate into table-driven tests
**File:** `tests/unit/flow/throw-to-envelope-codes.test.js`  
**Issue:** Many R3 tests repeat the same setup/assertion pattern with only argv/code differences.  
**Suggestion:** Convert those blocks to a table-driven loop (`[{argv, code}, ...]`) and one shared assertion path; this removes duplication and makes adding new validation codes safer.

**Verdict:** APPROVED
**Reason:** This is meaningful test maintainability refactoring (not cosmetic-only) and should preserve behavior if each case still asserts argv→code mapping explicitly.
