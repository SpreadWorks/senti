# Code Review Results

### [x] 1. Await async post-hook command execution
**File:** `src/flow/registry.js`  
**Issue:** `RunUpdateOverviewCommand.execute(...)` is called without `await` inside an async hook. If `execute` rejects asynchronously, the `try/catch` won’t reliably handle it, and warning logging can be skipped.  
**Suggestion:** Change to `await cmd.execute(...)` (and keep it inside the same `try/catch`) so failures are deterministically captured.

**Verdict:** APPROVED
**Reason:** This is a real correctness fix: without `await`, async rejections can bypass the local `try/catch` and skip warning logs.

### [ ] 2. Remove inconsistent/unused default export
**File:** `src/flow/lib/run-complete-task.js`  
**Issue:** The file now exports both a named class and a default export; this can create inconsistent import style and dead API surface if only one style is used.  
**Suggestion:** Keep one export style (prefer named export for consistency with other flow commands) unless there is a confirmed default-import caller.

**Verdict:** REJECTED
**Reason:** This is mostly style-level unless caller usage is proven; removing an export can break importers and is not safely behavior-neutral without call-site confirmation.

### [x] 3. Fix stale error text after schema rule change
**File:** `src/lib/flow-store.js`  
**Issue:** The existing error message still says `tasks: []` and `currentTaskId: null` are required, but this diff now rejects empty `tasks` and supports non-null `currentTaskId`.  
**Suggestion:** Update the error message to match actual validation rules (non-empty `tasks`, `currentTaskId` presence with nullable value) to avoid misleading diagnostics.

**Verdict:** APPROVED
**Reason:** Improves diagnostic accuracy with no runtime behavior risk; current message is inconsistent with actual validation rules.

### [ ] 4. Extract placeholder task builder to avoid magic literals
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The placeholder task object is inlined with many hardcoded fields, which makes future task-shape changes easy to miss and encourages duplication.  
**Suggestion:** Move it to a small helper/factory (for example `createPendingSpecPlaceholderTask()`) shared by flow initialization paths.

**Verdict:** REJECTED
**Reason:** Refactor benefit is speculative unless duplication exists in production paths; adds indirection without clear behavioral or quality gain yet.

### [x] 5. Reduce duplicated task fixture shape in tests
**File:** `tests/helpers/flow-setup.js`  
**Issue:** Many tests in this diff still inline near-identical task objects (`id/title/goal/...`) instead of using one canonical fixture builder.  
**Suggestion:** Export a helper like `makeDefaultTask(overrides)` from this file and migrate touched tests to use it, eliminating repetitive literal blocks and drift risk.

**Verdict:** APPROVED
**Reason:** Test-only consolidation reduces drift risk and maintenance cost, with low risk to product behavior when fixture defaults are explicit.

### [ ] 6. Remove dead imports in expanded task wiring tests
**File:** `tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js`  
**Issue:** The file imports helpers that are not used in assertions/execution paths, which adds noise and weakens test readability.  
**Suggestion:** Prune unused imports and keep only symbols used by this test file; this also prevents false coupling to unrelated modules.

**Verdict:** REJECTED
**Reason:** This is cosmetic cleanup only; it does not materially improve code quality or behavior robustness by itself.
