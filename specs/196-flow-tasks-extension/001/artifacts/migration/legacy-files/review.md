# Code Review Results

### [ ] 1. Remove Redundant Phase Guard
**File:** `src/flow/lib/get-status.js`  
**Issue:** `buildStatusOutput` checks `state.steps ? derivePhase(state) : null`, but `derivePhase(state)` already handles missing state/steps and returns a default. This adds unnecessary branching and inconsistent usage vs other call sites.  
**Suggestion:** Simplify to `const phase = derivePhase(state);` and rely on helper behavior.

**Verdict:** REJECTED
**Reason:** `derivePhase(state)` returns `"plan"` on missing steps, while current code returns `null`; removing the guard changes observable behavior in edge states.

### [x] 2. Clarify Scope Resolver Naming
**File:** `src/lib/flow-store.js`  
**Issue:** `_resolveScope` uses a private-style prefix but is exported and reused broadly. This naming is inconsistent with its actual role and visibility.  
**Suggestion:** Rename `_resolveScope` to something explicit and public-facing like `resolveMutationScope` (and update references/comments) for clearer design intent.

**Verdict:** APPROVED
**Reason:** Renaming `_resolveScope` to a public-intent name (with all references/comments updated) improves API clarity without changing logic.

### [x] 3. Centralize Task Enum Definitions
**File:** `src/lib/flow-store.js`  
**Issue:** Task literals (`origin`, `status`, step/requirement statuses) are hardcoded in multiple places (`validateTaskShape`, helpers, tests), which risks drift.  
**Suggestion:** Extract shared constants (e.g., `TASK_ORIGINS`, `TASK_STATUSES`, `TASK_REQUIREMENT_STATUSES`) into one module and reuse everywhere.

**Verdict:** APPROVED
**Reason:** Consolidating task/status literals reduces drift risk and improves maintainability; behavior should remain unchanged if values are identical.

### [x] 4. Eliminate Duplicate Metric-Scope Logic
**File:** `src/lib/flow-store.js`  
**Issue:** `incrementMetric` and `accumulateAgentMetrics` duplicate ambient/explicit task-scope branching and scope resolution patterns.  
**Suggestion:** Extract a shared helper for metric mutation scope resolution (including no-active-flow behavior), then reuse it in both methods.

**Verdict:** APPROVED
**Reason:** Shared scope-resolution logic removes duplication and reduces inconsistency bugs, provided helper preserves current no-active-flow and explicit-scope semantics.

### [ ] 5. Reuse Shared Task Test Fixture Builder
**File:** `tests/unit/lib/flow-manager-tasks.test.js`  
**Issue:** `makeTask()` hardcodes step arrays and task shape, duplicating logic already represented by production helpers/constants.  
**Suggestion:** Build test tasks via shared helpers (`buildInitialTaskSteps`) and/or add a common test factory in `tests/helpers/` to keep fixtures consistent and reduce maintenance.

**Verdict:** REJECTED
**Reason:** Reusing production helpers in tests can couple tests to implementation and weaken regression detection; this is not a clear quality win.

### [ ] 6. Collapse Repetitive Gate Entries
**File:** `specs/196-flow-tasks-extension/issue-log.json`  
**Issue:** Many `gate-draft`/`gate-impl` entries are near-duplicates, making the artifact noisy and harder to review.  
**Suggestion:** Store only the latest effective evaluation per step (or summarize prior ones) to reduce duplication and improve readability.

**Verdict:** REJECTED
**Reason:** `issue-log.json` appears to be append-only audit evidence; collapsing history risks losing traceability and may break workflow assumptions.
