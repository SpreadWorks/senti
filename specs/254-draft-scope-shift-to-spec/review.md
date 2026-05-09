# Code Review Results

### 1. 1. Centralize Disabled Guardrail Detection
**File:** `src/lib/guardrail.js`  
**Issue:** `phase: []` is now a sentinel for “disabled”, but that convention is split between `hydrate()` and `validateLintGuardrails()` as raw checks. This makes the behavior easy to miss or accidentally diverge.  
**Suggestion:** Add a small helper such as `isGuardrailDisabled(meta)` or `hasDisabledPhase(meta)` in `guardrail.js`, export it, and use it from `lint.js`. This keeps the sentinel semantics in one place.

### 2. 2. Avoid Overloading `phase` For Disable State
**File:** `src/presets/base/guardrail.json`  
**Issue:** Using `"phase": []` to mean “disabled” overloads a lifecycle field with enablement state. An empty phase list can also read as malformed data rather than intentional deactivation.  
**Suggestion:** Prefer an explicit metadata field such as `"enabled": false` or `"disabled": true`, then have `hydrate()` exclude or preserve disabled guardrails intentionally. If `phase: []` must remain, add a clearly named helper in code so the convention is not implicit.

### 3. 3. Align Draft Scope Wording Across Prompt And Preset
**File:** `src/presets/base/guardrail.json`  
**Issue:** The disabled `Draft Stays at Requirements Level` guardrail body allows code references in `evidence`, `why`, and `considered`, while `draft.md` now also allows `answer`. The mismatch can confuse future re-enablement or documentation reuse.  
**Suggestion:** Update the guardrail body to include `answer` as well, or intentionally remove field-specific wording from the disabled preset entry to avoid stale policy text.

### 4. 4. Reduce Prompt Duplication Around Verification Entries
**File:** `src/flow/prompts/plan/spec.md`  
**Issue:** The `[VERIFY]` and `[CORRECTION]` bullets repeat the same storage location and length rules for `text` and `evidence`. This increases maintenance cost if the output convention changes.  
**Suggestion:** Extract the shared convention into one bullet, for example: “For `[VERIFY]` and `[CORRECTION]` entries, write concise summaries to `spec.json.overview.decisions[].text` and detailed references to `evidence` with the same length limits.” Then keep each case focused on its trigger and content.
