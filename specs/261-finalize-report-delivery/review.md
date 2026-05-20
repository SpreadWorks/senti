# Code Review Results

### 1. 1. Centralize finalize-cleanup detection
**File:** `src/sdd-forge.js`  
**Issue:** The command check `subCmd === "flow" && rest[0] === "run" && rest[1] === "finalize-cleanup"` is a narrow inline predicate. If another entry path needs the same behavior, it is easy to duplicate or subtly diverge.  
**Suggestion:** Extract a small helper such as `isFinalizeCleanupRun(subCmd, rest)` and reuse it for both `enableFinalizeCleanupDurablePaths` and related flow-run argument handling.

### 2. 2. Make warning truncation naming more precise
**File:** `src/lib/dispatcher.js`  
**Issue:** `FINALIZE_CLEANUP_WARNING_TEXT_LIMIT` sounds like it limits each warning text, but the code applies it after joining all shown messages plus the suffix.  
**Suggestion:** Rename it to something like `FINALIZE_CLEANUP_WARNING_DISPLAY_LIMIT` to reflect the actual behavior.

### 3. 3. Simplify report display branching
**File:** `src/lib/dispatcher.js`  
**Issue:** `formatFinalizeCleanupReportDisplay()` has several early exits and a `report !== null` check that makes the nullable cases harder to scan.  
**Suggestion:** Normalize the report state first, for example: return text when `report?.text` is a string, return null unless `report === null`, then handle `REPORT_MISSING`. This keeps the missing-report path visually distinct from malformed/non-finalize cases.

### 4. 4. Avoid partial-template test drift
**File:** `tests/unit/templates/finalize-self-contained.test.js`  
**Issue:** The test now allows `flow report show` globally, although the intended rule is narrower: it should only appear as an explicit re-display fallback after cleanup succeeds.  
**Suggestion:** Add a positive assertion around the allowed fallback wording, or replace the removed forbidden regex with a more specific assertion that prevents `flow report show` from being reintroduced as the primary delivery path.
