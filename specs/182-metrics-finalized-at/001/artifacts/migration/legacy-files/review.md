# Code Review Results

### [ ] 1. Centralize `finalizedAt` Validation/Parsing
**File:** `src/metrics/commands/token.js`  
**Issue:** `finalizedAt` handling is implemented separately from `saveFinalizedAt` validation, and the rules are inconsistent (`token.js` accepts loose `YYYY-MM-DDT...`, while `flow-state.js` enforces strict UTC ISO).  
**Suggestion:** Extract a shared helper (e.g., `src/lib/finalized-at.js`) with `isValidFinalizedAtUtc()` and `toIsoDate()` and use it in both [`src/lib/flow-state.js`](/home/nakano/workspace/sdd-forge/.sdd-forge/worktree/feature-182-metrics-finalized-at/.tmp/src/lib/flow-state.js) and [`src/metrics/commands/token.js`](/home/nakano/workspace/sdd-forge/.sdd-forge/worktree/feature-182-metrics-finalized-at/.tmp/src/metrics/commands/token.js).

**Verdict:** REJECTED
**Reason:** This is not a pure refactor as proposed; unifying `token.js` with strict UTC validation can change current acceptance behavior (some currently accepted timestamps may start being skipped). Good direction, but behavior-risky without an explicit migration/compatibility decision.

### [ ] 2. Make Date Extraction Name Match Behavior
**File:** `src/metrics/commands/token.js`  
**Issue:** `isoDateFromFinalizedAt()` sounds like full ISO parsing, but currently it only checks a prefix and slices the first 10 chars.  
**Suggestion:** Either rename it to something explicit like `extractDatePrefixFromIsoString()` or make it actually parse/validate via `new Date()` + UTC normalization to match the function name.

**Verdict:** REJECTED
**Reason:** Renaming alone is cosmetic, and changing implementation to full `Date` parsing/UTC normalization risks changing emitted dates. As written, this proposal is either cosmetic-only or behavior-changing.

### [ ] 3. Eliminate Placeholder/Unused QA Content
**File:** `specs/182-metrics-finalized-at/qa.md`  
**Issue:** The file contains an empty Q/A template (`Q:` / `A:` with no content), which is effectively dead content and adds noise.  
**Suggestion:** Remove the empty section or replace it with actual finalized decisions already documented in `draft.md` / `spec.md`.

**Verdict:** REJECTED
**Reason:** This is documentation cleanup only, not a code-quality refactor, and has no behavioral impact.

### [x] 4. Reduce Test Setup Duplication
**File:** `tests/e2e/metrics/token-finalized-at.test.js`  
**Issue:** Command runner and environment setup logic duplicates patterns already present in other metrics e2e tests.  
**Suggestion:** Move shared helpers (`runTokenJson`, `runTokenCapture`, base config setup) into `tests/helpers/metrics-token.js` and reuse from both e2e files.

**Verdict:** APPROVED
**Reason:** Extracting shared test helpers improves maintainability and consistency across e2e tests while preserving product behavior, if helper APIs are thin and equivalent.

### [x] 5. Simplify Backfill Flow to Avoid Double File Reads
**File:** `specs/182-metrics-finalized-at/scripts/finalize-migration.js`  
**Issue:** The script reads all `flow.json` files once in `alreadyFullyBackfilled()` and then reads them again in `processFlow()`.  
**Suggestion:** Merge the pre-check and processing into a single pass that tracks whether any update is needed while processing, reducing I/O and simplifying control flow.

**Verdict:** APPROVED
**Reason:** A one-pass implementation can reduce I/O and simplify control flow without changing outcomes, as long as idempotency and existing exit conditions are preserved.
