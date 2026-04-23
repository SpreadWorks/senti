# Code Review Results

### [x] 1. Unify merge strategy resolution for dry-run vs real execution
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** Dry-run currently reports `strategy: mergeStrategy` (often `"auto"`) instead of the actually resolved strategy. This can diverge from real execution and from sync-step branching logic.  
**Suggestion:** Resolve the effective strategy once (including `"auto"` resolution) via a shared helper and use that value for both dry-run output and real execution branching.

**Verdict:** APPROVED
**Reason:** This fixes a real behavioral inconsistency (`dry-run` reporting `"auto"` while real execution resolves to `pr/squash/skip`) and reduces branch drift risk.

### [x] 2. Remove duplicated `gh` availability checks in merge path
**File:** `src/flow/commands/merge.js`  
**Issue:** `isGhAvailable()` is evaluated in multiple places for the same decision path, duplicating logic and risking inconsistent behavior.  
**Suggestion:** Compute availability once and resolve a single final strategy (`skip|pr|squash`) before branching.

**Verdict:** APPROVED
**Reason:** Consolidating to one computed final strategy improves consistency and avoids split logic, as long as explicit `pr` + missing `gh` still preserves current failure behavior.

### [x] 3. Re-centralize repeated validation error construction
**File:** `src/flow/lib/set-test-summary.js`  
**Issue:** Multiple branches repeat `new Error(...); e.code = "TEST_SUMMARY_INVALID"; throw e;`, increasing duplication and maintenance cost.  
**Suggestion:** Introduce a small helper (e.g. `throwTestSummaryInvalid(message)`) and reuse it across parse/validation branches.

**Verdict:** APPROVED
**Reason:** This is meaningful duplication removal with low risk if helper preserves the same message/code (`TEST_SUMMARY_INVALID`) and throw points.

### [x] 4. Restore explicit `--run-id` existence validation
**File:** `src/flow/lib/set-auto.js`  
**Issue:** `resolvePreparingRunId()` now returns explicit `runId` without checking existence, creating inconsistency with other structured validation paths and pushing failure later.  
**Suggestion:** Validate `explicitRunId` immediately with `loadPreparingFlow(...)` and return a structured fail envelope (`PREPARING_FLOW_NOT_FOUND`) early.

**Verdict:** APPROVED
**Reason:** This is a correctness fix, not cosmetic: it restores early structured failure (`PREPARING_FLOW_NOT_FOUND`) and prevents late/unstructured errors and unnecessary downstream work.

### [ ] 5. Eliminate duplicated finalize prompt structure across locales
**File:** `src/flow/lib/get-prompt.js`  
**Issue:** `finalize.merge-strategy` is duplicated in both `ja` and `en` blocks with nearly identical shape.  
**Suggestion:** Extract a shared prompt factory/common choice definition and keep only localized text fields per language.

**Verdict:** REJECTED
**Reason:** Mostly structural cleanup with limited behavioral benefit; risk/reward is weak unless duplication is already causing concrete defects.
