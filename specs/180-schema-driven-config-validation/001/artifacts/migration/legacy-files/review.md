# Code Review Results

### [ ] 1. Clarify Validator Naming
**File:** `src/lib/config.js`  
**Issue:** `validate` is too generic and weakens intent at call sites (`validate(config)` vs what?). This reduces design consistency as the codebase grows.  
**Suggestion:** Rename export to `validateConfig` (or `validateSddConfig`) and keep `validate` only as a local alias if needed. This improves readability and avoids future naming collisions with other validators.

**Verdict:** REJECTED
**Reason:** Mostly cosmetic churn. Renaming `validate` again adds broad call-site updates and potential API break risk without clear functional gain.

### [x] 2. Separate Concerns in `config.js`
**File:** `src/lib/config.js`  
**Issue:** File now mixes path/constants loading logic with a large embedded schema and cross-field validation logic. This creates a “god module” and makes maintenance harder.  
**Suggestion:** Move `CONFIG_SCHEMA` and validation-specific helpers into `src/lib/config-schema.js` (or `config-validator.js`), and keep `config.js` focused on config I/O (`loadJsonFile`, `loadConfig`, paths, defaults).

**Verdict:** APPROVED
**Reason:** Extracting schema/validation into a dedicated module is a meaningful maintainability improvement and can preserve behavior if it is a pure move with unchanged exports and tests passing.

### [ ] 3. Narrow Exception Handling for Optional Config
**File:** `src/docs/lib/command-context.js`  
**Issue:** `catch { config = {}; }` swallows all errors (parse errors, schema errors, runtime bugs), which can hide real defects and make debugging difficult.  
**Suggestion:** Catch only “config missing” cases (e.g., `ENOENT`) and rethrow others. If lenient behavior is intentional for selected commands, add an explicit `allowInvalidConfig`/`optionalConfig` flag instead of blanket swallowing.

**Verdict:** REJECTED
**Reason:** As written, it likely changes runtime behavior for commands currently relying on “swallow-all” fallback. Safer error handling is good, but this proposal is behavior-sensitive unless command-level semantics are redesigned first.

### [x] 4. Reduce Repeated Validation Test Setup
**File:** `tests/e2e/043-configurable-scan.test.js`, `tests/e2e/071-multi-preset-selection.test.js`, `tests/e2e/081-config-commands.test.js`, `tests/unit/lib/*.test.js`  
**Issue:** Repeated patterns (`baseConfig`, repeated `validate(...)` import/use, repeated assertion shapes) increase maintenance cost.  
**Suggestion:** Introduce a small shared test helper (e.g., `tests/helpers/config-fixture.js`) exposing `baseValidConfig()` and `assertConfigInvalid(cfg, pattern)`. This removes duplication and keeps future schema changes easier to propagate.

**Verdict:** APPROVED
**Reason:** Shared test fixtures/helpers reduce duplication and maintenance cost while not affecting product behavior when assertions remain equivalent.

### [ ] 5. Update Legacy Test Naming for Consistency
**File:** `tests/e2e/060-help-layout-validate-config.test.js`, `tests/e2e/081-config-commands.test.js`, `tests/unit/lib/types-agent-profiles.test.js`, `tests/unit/lib/types-chapters.test.js`, `tests/unit/lib/types-docs-exclude.test.js`  
**Issue:** Many `describe`/test labels still say `validateConfig` while implementation now uses `validate`, creating naming drift.  
**Suggestion:** Standardize test titles to one convention (`validate config` or `validate()`) across the suite so output and intent stay consistent.

**Verdict:** REJECTED
**Reason:** Cosmetic-only (test label text). No substantive code-quality or behavior benefit.
