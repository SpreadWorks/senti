# Code Review Results

### [ ] 1. Unify `failed[]` validation rules across summarization and persistence
**File:** `src/flow/lib/set-test-summary.js`  
**Issue:** `failed[]` constraints (`MAX_ID_CHARS`, `MAX_REASON_CHARS`, `MAX_FAILED`) are redefined here while similar limits also exist in `summarize-test-log.js`, which risks drift and inconsistent behavior.  
**Suggestion:** Reuse shared constants/validation from `summarize-test-log.js` (or centralize in one touched module) so both paths enforce exactly the same schema contract.

**Verdict:** REJECTED
**Reason:** Drift risk is real, but forcing “exactly same schema contract” is risky because these paths currently have different roles (`summarize-test-log` normalizes/truncates agent output, `set-test-summary` is a strict CLI validator). Unifying logic could change behavior.

### [x] 2. Remove inconsistent `failed_count` field naming
**File:** `src/flow/lib/set-test-summary.js`  
**Issue:** JSON mode maps `counts.failed` to `summary.failed_count`, while other code paths use `failed`/`failed[]`, creating naming inconsistency and harder downstream handling.  
**Suggestion:** Keep a single naming convention (prefer `failed` for count and `failed[]` for details), and avoid introducing `failed_count` unless all readers explicitly depend on it.

**Verdict:** APPROVED
**Reason:** This improves schema consistency (`failed` count vs `failed[]` details) and reduces downstream ambiguity; low break risk if internal readers are updated together.

### [x] 3. Eliminate unused template substitution
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** `createSpecTemplate()` replaces `{{STATUS}}`, but `DEFAULT_SPEC_TEMPLATE` hardcodes `**Status**: Draft` and contains no `{{STATUS}}` token.  
**Suggestion:** Either add `{{STATUS}}` to the template or remove the unused `.replace(/\{\{STATUS\}\}/g, "Draft")` call to reduce dead logic.

**Verdict:** APPROVED
**Reason:** `.replace(/\{\{STATUS\}\}/g, "Draft")` is dead with the current template, so removing it (or adding the token) is a safe quality cleanup.

### [x] 4. Avoid duplicated “baseline missing” signaling paths
**File:** `src/flow/lib/run-gate.js`  
**Issue:** Baseline absence is communicated in two places (`buildImplCheckPrompt` warning text and `unusedWarnings.push("baseline not captured")`), which can drift or become inconsistent.  
**Suggestion:** Generate the warning message once and pass it to both prompt construction and artifacts, or derive artifacts from the prompt decision branch to keep behavior synchronized.

**Verdict:** APPROVED
**Reason:** Centralizing the warning source reduces drift between prompt text and artifacts while preserving behavior if message content stays unchanged.

### [ ] 5. Replace silent truncation with explicit validation outcome
**File:** `src/flow/lib/summarize-test-log.js`  
**Issue:** `validateAndNormalize()` silently truncates `id`/`reason` length, while other command paths prefer explicit validation errors; this is a design inconsistency that can hide malformed agent output.  
**Suggestion:** Return `ok: false` on over-limit values (or make truncation explicit in the contract and naming, e.g., `normalizeAndTruncate`) so behavior is predictable and testable.

**Verdict:** REJECTED
**Reason:** Turning truncation into hard failure changes runtime behavior and can increase false-negative summarization failures; too risky as a refactor-only change without explicit contract/spec update.
