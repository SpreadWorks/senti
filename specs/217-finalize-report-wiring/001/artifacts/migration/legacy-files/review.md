# Code Review Results

### [x] 1. Behavior-based test instead of source-text regex
**File:** `tests/unit/flow/run-finalize-next-command.test.js`  
**Issue:** The test validates implementation text (`source.includes`, regex on raw file) rather than runtime behavior, so refactors can break tests without changing behavior (or pass while behavior is broken).  
**Suggestion:** Exercise `RunFinalizeCommand.execute()` (or the smallest callable path that returns envelopes) and assert actual returned objects for `ok`, `preflight_failed`, `merge_failed`, and `dry-run` cases.

**Verdict:** APPROVED
**Reason:** This is a real quality improvement: it tests externally observable behavior instead of implementation text, making tests less brittle and better at catching regressions.

### [ ] 2. Eliminate duplicated parsing logic in envelope tests
**File:** `tests/unit/flow/run-finalize-next-command.test.js`  
**Issue:** `preflight_failed` and `merge_failed` checks duplicate the same “extract block + assert no `nextCommand`” pattern.  
**Suggestion:** Introduce a small helper like `assertResultBlockHasNoNextCommand(resultName)` to reduce duplication and keep failure messages consistent.

**Verdict:** REJECTED
**Reason:** This is mostly cosmetic refactoring (small duplication in tests) with limited quality gain and no meaningful behavior-safety improvement.

### [ ] 3. Reduce repeated file reads and shared setup duplication
**File:** `tests/unit/flow/skill-report-show-wiring.test.js`  
**Issue:** The file is read multiple times across tests, and the same setup logic is repeated.  
**Suggestion:** Read `SKILL.md` once in `before()` (or helper cache) and reuse the content across assertions; keep one focused assertion per requirement.

**Verdict:** REJECTED
**Reason:** Reading one small file multiple times in unit tests is negligible; this is primarily cleanup/perf micro-optimization and not a substantive quality improvement.

### [x] 4. Strengthen naming consistency for command literal
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** The literal `"sdd-forge flow report show"` is embedded inline, which makes future edits error-prone and encourages string duplication across code/tests.  
**Suggestion:** Extract to a local constant (for example `REPORT_SHOW_COMMAND`) and use that in envelope construction.

**Verdict:** APPROVED
**Reason:** Extracting the command string to a constant reduces typo risk and future drift, with effectively zero behavior-change risk.

### [x] 5. Remove placeholder-only QA content
**File:** `specs/217-finalize-report-wiring/qa.md`  
**Issue:** The file currently contains empty placeholder Q/A entries (`Q:` / `A:`), which is effectively dead documentation and adds noise.  
**Suggestion:** Either delete the placeholder section or replace it with actual resolved clarifications to keep spec artifacts meaningful.

**Verdict:** APPROVED
**Reason:** Empty Q/A placeholders are dead artifact noise; removing or replacing them with actual content improves spec quality without changing runtime behavior.
