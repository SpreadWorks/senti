# Code Review Results

### [x] 1. Harden and simplify `checkDraftJson` validation
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkDraftJson` repeats the same non-empty-string checks in multiple places, and `qa` validation can throw if an entry is `null`/non-object (`entry.why` access).  
**Suggestion:** Introduce a small helper like `isNonEmptyString(value)` and guard each `qa` item with `if (!entry || typeof entry !== "object")`. This removes duplicated conditionals and avoids runtime errors when validating malformed `draft.json`.

**Verdict:** APPROVED
**Reason:** This addresses a real robustness bug (`qa` entry can be `null`/non-object and currently throw) and reduces duplicated validation logic; behavior becomes safer without changing intended validation outcomes.

### [x] 2. Align artifact naming in spec prompt
**File:** `src/flow/prompts/plan/spec.md`  
**Issue:** The prompt says to “Fill Goal, Scope...” in `spec.md` but mapping instructions reference `spec.json` fields (`spec.overview.decisions`, `spec.open_questions`), which is inconsistent and can confuse agents/users.  
**Suggestion:** Use one artifact vocabulary consistently in this prompt (either `spec.md` sections or `spec.json` keys) and rewrite the mapping bullets to match that single target format.

**Verdict:** APPROVED
**Reason:** The current prompt is internally inconsistent (`spec.md` wording vs `spec.json` mappings), which can mislead agent behavior. Unifying terminology improves correctness and maintainability, provided it matches the actual target artifact used by the flow.

### [ ] 3. Improve test file naming consistency after migration
**File:** `tests/unit/flow/check-draft-text.test.js`  
**Issue:** The file name still says `check-draft-text` even though it now tests `checkDraftJson`, leaving stale naming from pre-migration behavior.  
**Suggestion:** Rename to `check-draft-json.test.js` (and keep describe/title strings aligned) so test intent matches implementation and future maintenance/search is clearer.

**Verdict:** REJECTED
**Reason:** Renaming the test file is mostly cosmetic and does not materially improve code quality or runtime behavior.

### [x] 4. Use realistic JSON fixtures in auto-check tests
**File:** `tests/unit/flow/set-auto.test.js`  
**Issue:** The test writes markdown-like content into `draft.json` (`# Draft ...`), which no longer reflects real draft format and weakens migration fidelity.  
**Suggestion:** Replace fixture text with minimal valid JSON (or intentionally invalid JSON only in tests meant to cover parse failure). Keep marker strings inside JSON fields to preserve assertion behavior.

**Verdict:** APPROVED
**Reason:** Using JSON-shaped fixtures in `draft.json` tests better reflects real inputs and improves test fidelity; this strengthens confidence without changing product behavior.

### [ ] 5. Reduce duplicated draft fixture construction in tests
**File:** `tests/unit/specs/commands/gate-draft.test.js`  
**Issue:** `buildValidDraft` logic is duplicated across test files with near-identical structure, increasing maintenance cost when schema changes.  
**Suggestion:** Consolidate fixture shape usage by mirroring one canonical builder style (same required fields and defaults) and keep only test-specific overrides here. At minimum, standardize required fields/messages so schema updates require fewer edits.

**Verdict:** REJECTED
**Reason:** This is primarily maintainability/cosmetic refactoring. It brings limited quality gain and can reduce test clarity/independence if over-centralized, with no direct behavior-safety benefit.
