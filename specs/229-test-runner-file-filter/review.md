# Code Review Results

### [x] 1. Extract Repeated Exit/Error Handling
**File:** `tests/run.js`  
**Issue:** `console.error(...); process.exit(1);` is repeated many times, and the same limit-check block appears in multiple loops. This duplicates control-flow logic and makes future message/exit behavior changes error-prone.  
**Suggestion:** Add small helpers like `fail(message)` and `ensureWithinLimit(count, limit)` (or `pushWithLimit(arr, value, limit)`) and replace repeated inline blocks. This reduces duplication and keeps failure behavior consistent.

**Verdict:** APPROVED
**Reason:** This is a real maintainability improvement (deduplicates repeated failure/limit control flow) and can preserve behavior exactly if helpers are thin wrappers around current logic.

### [x] 2. Consolidate File Collection Logic Into Mode-Specific Functions
**File:** `tests/run.js`  
**Issue:** Main script flow now contains a large `if (fileSpecMode) { ... } else { ... }` block with parsing, validation, expansion, deduplication, and empty-check logic interleaved. This hurts readability and design consistency.  
**Suggestion:** Extract to functions such as `collectTestFilesFromFileSpec(...)` and `collectTestFilesFromSearchDirs(...)`, both returning file lists and sharing a single post-check (`assertNonEmptyTestFiles`). Keep top-level flow as orchestration only.

**Verdict:** APPROVED
**Reason:** Splitting file-spec collection vs directory-search collection improves structure and readability meaningfully; behavior can stay unchanged if both functions return the same file sets and keep the same validation/error paths.

### [ ] 3. Remove Duplication in Flag Parsing for Value Flags
**File:** `tests/run.js`  
**Issue:** `--file` and `--pattern` parsing branches repeat identical “next-arg required” logic, while `knownFlags`/`valueFlags` handling adds another layer of branching.  
**Suggestion:** Introduce a reusable `readFlagValue(args, i, flagName)` helper and a single value-flag dispatch map (`{ "--file": fileArgs, "--pattern": patternArgs, ... }`). This simplifies control flow and eliminates repeated validation code.

**Verdict:** REJECTED
**Reason:** The quality gain is modest relative to parser fragility risk (index advancement, unknown-flag handling, and value consumption edge cases). Easy to introduce subtle behavior regressions.

### [ ] 4. Clarify Selector Naming Symmetry
**File:** `tests/helpers/test-runner-search-dirs.js`  
**Issue:** `fileSpec` and `dirSearch` are concise but asymmetric and somewhat abstract compared to the user-facing exclusivity rule.  
**Suggestion:** Rename to clearer paired terms like `hasFileSelector` and `hasDirectorySelector` (or `fileSelectionMode` / `directorySelectionMode`) to improve intent and align with the exclusivity message semantics.

**Verdict:** REJECTED
**Reason:** Mostly cosmetic renaming with limited code-quality impact; not strong enough to justify churn under a conservative review standard.

### [x] 5. Reduce Test Duplication With Table-Driven Cases
**File:** `tests/unit/test-runner-flags.test.js`  
**Issue:** Many tests differ only by input flags and expected “error exists / no error,” creating repetitive boilerplate.  
**Suggestion:** Convert repeated cases into table-driven loops (arrays of `{ name, input, expectError }`) for accepted and rejected combinations. Keep one or two explicit “semantic” tests (like `--agent` error message match) and generate the rest to improve maintainability.

**Verdict:** APPROVED
**Reason:** This improves test maintainability and consistency without changing product behavior, as long as key semantic assertions (like specific error-message checks) remain explicit.
