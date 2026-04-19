# Code Review Results

### [x] 1. Extract Repeated Log-Entry Assertion Setup
**File:** `tests/unit/lib/log.test.js`  
**Issue:** Many tests repeat the same sequence (`await inst...`, `await inst.flush()`, `const entry = readJsonl(logFile)[0]`), which increases maintenance cost and noise.  
**Suggestion:** Add a small test helper (e.g. `async function writeAndReadEntry(action)`) that runs the action, flushes, and returns the first entry. Reuse it across masking tests.

**Verdict:** APPROVED
**Reason:** This is a small test-only deduplication that improves readability/maintainability with very low behavior risk if the helper preserves the exact `action -> flush -> first entry` sequence.

### [ ] 2. Improve Fixture Naming and Token Factory Reuse
**File:** `tests/unit/lib/log.test.js`  
**Issue:** `FAKE` is too generic, and token construction logic is duplicated (e.g. rebuilding `ghp_*` strings in multiple places).  
**Suggestion:** Rename `FAKE` to something intention-revealing like `SENSITIVE_FIXTURES`, and add small builders (`buildGhToken(prefix, ch)`) to generate tokens consistently.

**Verdict:** REJECTED
**Reason:** Renaming `FAKE` is mostly cosmetic, and introducing token builders can accidentally change token shapes/lengths and weaken masking coverage; limited quality gain vs regression risk.

### [ ] 3. Consolidate Masked Write Paths Into One Internal Writer Pattern
**File:** `src/lib/log.js`  
**Issue:** `appendJsonlMasked` and `writePromptFileMasked` both perform “mask then write” with similar structure, while `Logger` also adds thin wrapper methods (`#appendJsonl`, `#writePromptFile`).  
**Suggestion:** Introduce a single internal masked-write utility (or fully move logic into Logger private methods) so masking and write concerns are centralized and duplication is reduced.

**Verdict:** REJECTED
**Reason:** Centralization is attractive, but these paths have subtle differences (JSONL append vs pretty JSON file write, return/error semantics). Refactoring here has meaningful behavior-regression risk unless tightly proven equivalent.

### [ ] 4. Clarify Retro Invocation Context Naming
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** Passing `{ ...ctx, force: true }` inline to `RetroCommand.run(...)` is correct but less explicit about intent than a named value.  
**Suggestion:** Create a named variable (e.g. `const retroCtx = { ...ctx, force: true };`) before invocation to improve readability and align with intention-revealing naming.

**Verdict:** REJECTED
**Reason:** This is readability-only churn (`const retroCtx = ...`) with no material quality improvement under a conservative review bar.
