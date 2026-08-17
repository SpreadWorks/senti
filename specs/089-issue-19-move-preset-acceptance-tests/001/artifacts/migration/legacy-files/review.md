# Code Review Results

### [x] 1. Use `fileURLToPath` when resolving fixture URLs
**File:** `tests/acceptance/lib/test-template.js`
**Issue:** `resolveFixtureDir()` converts `URL` inputs with `fixtureDir.pathname`, which can mis-handle percent-encoded characters and is less robust across platforms than Node’s standard file URL conversion.
**Suggestion:** Replace the `URL` branch with `fileURLToPath(fixtureDir)` and then `path.resolve(...)`. This keeps URL-to-path handling consistent with the previous implementation and avoids subtle path bugs.

**Verdict:** APPROVED
**Reason:** The current code uses `fixtureDir.pathname` on URL objects, which does not decode percent-encoded characters (e.g., `%20` stays as `%20` instead of becoming a space) and breaks on Windows where `file:///C:/...` gives `/C:/...` via `.pathname`. `fileURLToPath()` is the standard Node.js API for this conversion and was actually used in the previous implementation (removed in this diff). This is a real correctness fix, not cosmetic.

### [x] 2. Remove duplicated fixture-copy logic
**File:** `tests/e2e/docs/commands/parent-chain.test.js`
**Issue:** `setupFromFixture()` reimplements recursive fixture copying and config override behavior that already exists elsewhere in the acceptance test helpers. That duplicates filesystem behavior in a second place and makes future fixture-layout changes harder to maintain.
**Suggestion:** Extract the “copy fixture + apply config overrides + ensure output dir” flow into a shared helper under `tests/acceptance/lib/` or reuse `copyFixture()` directly if its behavior fits. Keep `parent-chain.test.js` focused on test intent rather than fixture setup mechanics.

**Verdict:** APPROVED
**Reason:** `setupFromFixture()` in `parent-chain.test.js` reimplements the exact same "recursive copy + config override + ensure output dir" flow that `copyFixture()` in `tests/acceptance/lib/pipeline.js` already provides. The only difference is `copyFixture` also creates a tmp dir and ensures a `docs/` dir. Consolidating prevents drift between the two implementations and reduces maintenance burden. The e2e test could use `copyFixture` (passing the fixture dir from `getAcceptanceFixtureDir`) or a lighter shared `copyDir + applyConfigOverrides` helper.

### [ ] 3. Centralize preset validation in one helper
**File:** `tests/acceptance/run.js`
**Issue:** The script now gets preset names and test file paths from `lib/targets.js`, but it still performs its own membership validation loop before building `testFiles`. That spreads preset-resolution rules across multiple call sites.
**Suggestion:** Move validation into `getAcceptanceTestFile()` or add a dedicated `resolveAcceptancePreset()` helper that both validates and returns the canonical test target. Then `run.js` can map presets directly and fail from one source of truth.

**Verdict:** REJECTED
**Reason:** The current `run.js` is already clean — it gets the preset list from `listAcceptancePresetNames()`, validates against it, and maps via `getAcceptanceTestFile()`. The validation loop is 5 lines and is specific to CLI argument handling (printing usage, calling `process.exit`). Moving exit-on-error behavior into a library helper couples CLI concerns with utility logic. The current separation is appropriate and the duplication is minimal.

### [x] 4. Avoid repeating preset directory enumeration logic
**File:** `tests/run.js`
**Issue:** `getPresetNames()` and `collectPresetTestDirs()` both enumerate preset directories independently, and one path includes aliases while the other intentionally does not. That split makes the behavior harder to follow and easy to break during future refactors.
**Suggestion:** Extract a small helper for “real preset directory names” and build alias-aware names on top of it. That keeps naming and directory traversal rules explicit and removes the current near-duplicate directory scan.

**Verdict:** APPROVED
**Reason:** `getPresetNames()` enumerates preset directories and merges alias names, while `collectPresetTestDirs()` independently re-enumerates the same directory but intentionally excludes aliases. The divergent inclusion/exclusion of aliases in two near-identical directory scans is fragile — if a new preset or alias is added, it's easy to get inconsistent behavior. Extracting a "real directory names" helper that both functions build on would make the alias-vs-no-alias distinction explicit and reduce the risk of subtle breakage.
