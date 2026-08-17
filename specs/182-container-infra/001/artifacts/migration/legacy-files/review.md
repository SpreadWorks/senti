# Code Review Results

### [x] 1. Extract Shared Command Runner
**File:** `src/check.js`
**Issue:** `check.js`, `docs.js`, and `metrics.js` now duplicate the same dynamic-import + `main()` + try/catch exit handling.
**Suggestion:** Move this into a shared helper (for example `src/lib/command-runner.js` with `runModuleMain(scriptPath, argvRest)`), and reuse it across all dispatchers to remove duplication and keep error behavior consistent.

**Verdict:** APPROVED
**Reason:** The duplication is real and error-prone; a shared runner can improve consistency and maintainability with low behavioral risk if it preserves current `argv`, error printing, and exit code behavior.

### [ ] 2. Avoid Double Container Initialization
**File:** `src/sdd-forge.js`
**Issue:** `initContainer()` is called in `sdd-forge.js`, and also again in child entry files (`check.js`, `docs.js`, `metrics.js`, `flow.js`), creating repeated initialization paths.
**Suggestion:** Define a single ownership rule: initialize only in root CLI entry (`sdd-forge.js`) and treat sub-dispatchers as container consumers, or make a dedicated `ensureContainerInitialized()` helper and use that consistently.

**Verdict:** REJECTED
**Reason:** As proposed, this is ambiguous and can break direct invocation paths (`node src/check.js`, etc.) if initialization ownership is moved incorrectly. Without a guaranteed idempotent `ensure...` contract, risk is too high.

### [x] 3. Fail Fast When Imported Command Has No `main`
**File:** `src/check.js`
**Issue:** New behavior silently does nothing if imported module has no `main` function (`if (typeof mod.main === "function")`).
**Suggestion:** Convert this to explicit failure (print clear error + `EXIT_ERROR`) so missing/incorrect exports are caught immediately instead of becoming silent no-ops.

**Verdict:** APPROVED
**Reason:** Silent no-op on missing `main` hides wiring errors. For mapped command modules that are expected to export `main`, explicit failure improves reliability without intended behavior loss.

### [ ] 4. Replace Repeated `resolveDocsContext(container, cli, …)` Boilerplate
**File:** `src/docs/commands/readme.js`
**Issue:** Many docs command files now repeat the same context bootstrap pattern (`container` import + `resolveDocsContext(...)` + flag assignment).
**Suggestion:** Introduce a small docs-command bootstrap utility (for example `createDocsCommandContext(cli, options)`) to centralize this logic and keep command files focused on command behavior.

**Verdict:** REJECTED
**Reason:** Mostly structural/cosmetic; command files have small but meaningful per-command context tweaks, so forced abstraction may reduce clarity and introduce subtle coupling.

### [ ] 5. Harmonize Test Constant Naming
**File:** `tests/e2e/help.test.js`
**Issue:** Test updates mix `CMD_ARGS`, `CMD_ARGS_PREFIX`, and `FLOW_CMD_ARGS_PREFIX` for equivalent “fixed subcommand prefix” intent.
**Suggestion:** Standardize on one naming scheme (for example `BASE_ARGS`) across test suites to improve readability and reduce cognitive overhead.

**Verdict:** REJECTED
**Reason:** Cosmetic-only rename with no behavioral or substantial quality gain; not worth churn/risk.

### [x] 6. Remove Remaining Dead Import in `command-context` Tests Scope
**File:** `tests/unit/docs/lib/command-context.test.js`
**Issue:** `resolveCommandContext` tests were removed due to refactor, but there is no corresponding replacement coverage in this diff for `resolveDocsContext`.
**Suggestion:** Add/relocate equivalent unit tests to `docs-context` tests to prevent dead coverage gaps and keep design consistency after moving responsibility out of `command-context.js`.

**Verdict:** APPROVED
**Reason:** Replacing removed `resolveCommandContext` tests with `resolveDocsContext` coverage closes a real regression-risk gap and improves confidence without changing runtime behavior.
