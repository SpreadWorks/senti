# Code Review Results

### [x] 1. Extract duplicated legacy-file assertions
**File:** `specs/154-guardrail-english-only/tests/guardrail-migration.test.js`  
**Issue:** The `templates/en/guardrail.json` and `templates/ja/guardrail.json` checks duplicate the same loop/assert structure with only `lang` differing.  
**Suggestion:** Introduce a small helper like `assertNoLegacyTemplateGuardrails(lang)` and call it for `"en"`/`"ja"` to reduce duplication and keep test intent clearer.

**Verdict:** APPROVED
**Reason:** The two loop/assert blocks are structurally identical, differing only in `"en"` vs `"ja"`. A `assertNoLegacyTemplateGuardrails(lang)` helper genuinely reduces duplication, keeps test intent clear, and carries zero behavioral risk since the tests are spec-scope only.

### [ ] 2. Remove hardcoded preset inventory from test logic
**File:** `specs/154-guardrail-english-only/tests/guardrail-migration.test.js`  
**Issue:** `expectedPresets` is a large hardcoded list that can drift from actual preset structure, creating maintenance noise and fragile failures unrelated to this migration.  
**Suggestion:** Derive expected targets from filesystem metadata (for example, enumerate preset directories and assert placement invariants), or load the expected preset set from a single shared manifest/source-of-truth.

**Verdict:** REJECTED
**Reason:** The hardcoded `expectedPresets` list is intentionally asserting what *was expected to be migrated*, not what currently exists on disk. Deriving the list from the filesystem would invert the test's purpose — it would simply confirm that every *present* preset has a file, silently passing even if presets were accidentally omitted during migration. The "drift" risk is acceptable for a one-time historical migration test.

### [ ] 3. Clarify naming overlap between “read” and “load”
**File:** `src/lib/guardrail.js`  
**Issue:** `readGuardrailFile()` and `loadGuardrailFile()` are both used, but their names are very close and can be misread as the same abstraction level.  
**Suggestion:** Rename one side to make responsibilities explicit (for example, `findPresetGuardrailFile()` + `parseGuardrailFile()`), improving readability and reducing cognitive overhead.

**Verdict:** REJECTED
**Reason:** The distinction is already encoded in the parameter signatures: `readGuardrailFile(dir)` takes a directory; `loadGuardrailFile(filePath)` takes a full path. The rename to `findPresetGuardrailFile` + `parseGuardrailFile` is purely cosmetic — it adds no semantic precision beyond what the parameter names already convey, and introduces unnecessary churn to private internal functions.

### [x] 4. Replace string-based error classification with explicit predicate
**File:** `src/lib/guardrail.js`  
**Issue:** `err.message?.startsWith("Missing file:")` couples behavior to message text, which is brittle and inconsistent with robust error handling patterns.  
**Suggestion:** Add an explicit error discriminator (for example, `code`/custom error type from `loadConfig`) and check that instead; or centralize into `isMissingConfigError(err)` helper.

**Verdict:** APPROVED
**Reason:** `err.message?.startsWith("Missing file:")` couples control flow to an opaque string contract in `loadConfig`. If that message ever changes, `resolveGuardrailContext` will silently swallow all config errors again — the same bug the catch-all previously had. Adding an error `code` property (e.g. `ERR_MISSING_FILE`) in `loadConfig` and checking that instead is a genuine robustness improvement. Even a minimal `isMissingConfigError(err)` helper that centralizes the string check would localize the coupling and make the intent explicit.

### [x] 5. Remove or fill placeholder-only QA content
**File:** `specs/154-guardrail-english-only/qa.md`  
**Issue:** The `Q:` / `A:` section is empty placeholder content, which behaves like dead documentation and adds noise.  
**Suggestion:** Either remove the empty section until real Q&A exists, or populate it with concrete resolved clarifications from the spec/draft.

**Verdict:** APPROVED
**Reason:** An empty `Q: / A:` block in `qa.md` is actively misleading — it implies open questions were raised and answered with nothing. This is dead documentation, not merely minimal. Removing the empty stub (the `## Confirmation` section can remain) eliminates noise without any behavioral risk.
