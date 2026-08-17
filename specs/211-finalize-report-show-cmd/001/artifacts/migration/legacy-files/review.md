# Code Review Results

### [x] 1. Unify Pointer Path Definition
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `.sdd-forge/last-finalized-spec` is hardcoded here, while the same concept is also defined in `run-report-show.js` (`POINTER_REL_PATH`). This duplicates a core contract and risks drift.  
**Suggestion:** Define one shared constant name (for example `LAST_FINALIZED_SPEC_POINTER_REL_PATH`) and use it in both files and related tests, instead of repeating string literals.

**Verdict:** APPROVED
**Reason:** This removes a duplicated contract (`.sdd-forge/last-finalized-spec`) across command boundaries and lowers drift risk without changing runtime behavior if the shared constant value stays identical.

### [x] 2. Normalize Error Construction
**File:** `src/flow/lib/run-report-show.js`  
**Issue:** Error creation is repeated (`new Error(...)`, then `err.code = ...`) in multiple branches, which is repetitive and can lead to inconsistent error shapes/messages.  
**Suggestion:** Introduce a small helper like `createReportShowError(code, message)` and use it in `resolveLatestReportPath` and `readReportText` to reduce duplication and keep error behavior consistent.

**Verdict:** APPROVED
**Reason:** A small helper for `{message, code}` error creation improves consistency and maintainability in the same module, with low behavior risk as long as existing error codes/messages are preserved exactly.

### [ ] 3. Improve Naming for Path Semantics
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `writeLastFinalizedPointer(targetRoot, specPath)` uses generic names that hide an important invariant: `specPath` is expected to be a repo-relative spec path.  
**Suggestion:** Rename to something explicit, e.g. `writeLastFinalizedSpecPointer(mainRepoRoot, specRelativePath)`, so call sites and tests communicate intent and reduce misuse.

**Verdict:** REJECTED
**Reason:** This is primarily a naming-only change; readability improves slightly, but it does not materially improve behavior or structure enough to justify churn.

### [ ] 4. Avoid Hard Process Exit in Command Logic
**File:** `src/flow/lib/run-report-show.js`  
**Issue:** `execute()` calls `process.exit(1)` directly, which mixes process control with command behavior and makes unit testing/composition harder.  
**Suggestion:** Throw a command-level error (or return a failure result) and let the top-level CLI runner decide exit codes, matching a cleaner command pattern.

**Verdict:** REJECTED
**Reason:** This may be architecturally cleaner, but it can change CLI exit/error semantics unless the top-level runner is confirmed to map thrown errors identically; behavior risk is non-trivial.

### [ ] 5. Remove Empty Placeholder Content
**File:** `specs/211-finalize-report-show-cmd/qa.md`  
**Issue:** The file includes an empty `Q:` / `A:` block, which is effectively dead placeholder content and can confuse readers/tools about unresolved items.  
**Suggestion:** Either remove the empty block entirely or replace it with actual clarification entries only when they exist.

**Verdict:** REJECTED
**Reason:** This is mostly cosmetic in a spec artifact and offers limited code-quality benefit; it may also conflict with template/tooling expectations for placeholder sections.
