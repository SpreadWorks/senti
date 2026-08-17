# Code Review Results

### [ ] 1. Extract shared test command logic
**File:** `package.json`
**Issue:** `test`, `test:unit`, and `test:e2e` repeat the same `find ... | xargs node --test` pattern. This duplicates shell logic and makes future changes to test discovery or invocation easy to miss in one script.
**Suggestion:** Introduce a single reusable test runner script or a small Node-based test launcher that accepts target directories as arguments. Then have `test`, `test:unit`, and `test:e2e` delegate to it instead of duplicating the shell pipeline.

**Verdict:** REJECTED
**Reason:** The duplication is three short, nearly identical `find ... | xargs node --test` one-liners in `package.json`. Introducing a separate test launcher script or Node-based wrapper for this adds a new file to maintain and is over-engineering for a pattern that is trivially readable and rarely changes. The cost of missing an update across three lines is negligible compared to the indirection cost.

### [x] 2. Reduce duplicated fixture setup in data CLI tests
**File:** `tests/e2e/docs/commands/data.test.js`
**Issue:** `setupProject`, `makeEnv`, repeated `execFileSync("node", [CMD], ...)`, and repeated `readFileSync(join(tmp, "docs/overview.md"), "utf8")` create a lot of local duplication. The file is readable now, but the pattern is already repeated across nearly every case.
**Suggestion:** Add small helpers such as `runData(args = [])`, `readOverview()`, and possibly a `writeOverview(content)` wrapper. That would simplify each test to its intent and make future additions less repetitive.

**Verdict:** APPROVED
**Reason:** The diff already implements this — `setupProject()`, `makeEnv()`, and `dataBlock()` helpers were introduced in the new `tests/e2e/docs/commands/data.test.js`. The helpers reduce per-test boilerplate significantly (from ~6 setup lines to 1-2), make test intent clearer, and don't change observable behavior. This is a genuine readability and maintainability improvement.

### [ ] 3. Split mixed responsibilities in the configurable scan test
**File:** `tests/e2e/043-configurable-scan.test.js`
**Issue:** This file now lives under `e2e`, but it still contains direct imports of internal modules like `parseFile`, `DataSource`, `Scannable`, and `validateConfig`. That mixes unit-level API verification with end-to-end CLI behavior, which is inconsistent with the new `tests/unit` vs `tests/e2e` structure.
**Suggestion:** Move the direct-import sections into unit test files under `tests/unit/...`, and keep this file focused on CLI-level scan behavior only. That will make the test taxonomy consistent and easier to navigate.

**Verdict:** REJECTED
**Reason:** The file was moved to `tests/e2e/` but still contains direct imports of `parseFile`, `DataSource`, `Scannable`, and `validateConfig` for unit-level assertions. While the taxonomy inconsistency is real, splitting this file risks breaking the intentional co-location of related scan-configuration tests that were designed to be validated together. The proposal is primarily organizational/cosmetic and the split introduces risk of test gaps or duplicated setup without improving test signal.

### [x] 4. Centralize common test project bootstrapping in README tests
**File:** `tests/e2e/docs/commands/readme.test.js`
**Issue:** The new tests repeat the same config/env/package/docs setup inline several times. This is the same pattern already solved in `data.test.js` with helper functions, so the design is inconsistent across neighboring command tests.
**Suggestion:** Extract a local `setupProject()` and `makeEnv()` helper in this file, or move these shared fixtures into a common helper used by multiple docs command tests.

**Verdict:** APPROVED
**Reason:** The new tests in `tests/e2e/docs/commands/readme.test.js` repeat the identical `writeJson(tmp, ".sdd-forge/config.json", {...})` / `writeJson(tmp, "package.json", {...})` / env setup inline three times, while the neighboring `data.test.js` already demonstrates the `setupProject()`/`makeEnv()` pattern. Extracting local helpers would improve consistency across sibling test files and reduce copy-paste errors when adding future readme tests. No behavioral risk.

### [x] 5. Remove weak “type-only” assertions that add little signal
**File:** `tests/unit/docs/lib/resolver-factory.test.js`
**Issue:** Several tests only assert `typeof resolver.resolve === "function"`. Those checks are low-value once one constructor smoke test exists, and they dilute the purpose of neighboring tests that claim to verify overrides, options, or parent-chain behavior.
**Suggestion:** Keep one basic construction test, then make the rest assert observable behavior tied to the specific scenario, such as actual resolution output or option effects. That will eliminate effectively dead assertions and improve signal-to-noise.

**Verdict:** APPROVED
**Reason:** The new `tests/unit/docs/lib/resolver-factory.test.js` still has tests like "loads overrides.json when present" and "accepts docsDir option" that only assert `typeof resolver.resolve === "function"` — identical to the basic construction test. These assertions verify nothing beyond object creation and give false confidence that overrides or docsDir actually affect behavior. The diff already improved several tests (e.g., adding `resolves project.version`, `returns null for known source but unknown method`), but the remaining type-only checks should be strengthened to assert actual resolution output or removed to avoid diluting test signal.
