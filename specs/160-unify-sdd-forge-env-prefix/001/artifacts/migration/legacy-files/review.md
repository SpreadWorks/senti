# Code Review Results

### [x] Now I have a complete picture. Here are my proposals:
---

**Verdict:** APPROVED
**Reason:** The locale files contain user-facing help text that documents `SDD_WORK_ROOT`/`SDD_SOURCE_ROOT` — env var names that no longer work after the rename in `cli.js`. This is a correctness bug in documentation shown to end users, not cosmetic. The fix is a direct, low-risk string update with clear correctness value.

### [x] 1. Stale env var names in locale strings
**File:** `src/locale/ja/ui.json`, `src/locale/en/ui.json`
**Issue:** The rename from `SDD_WORK_ROOT`/`SDD_SOURCE_ROOT` to `SDD_FORGE_WORK_ROOT`/`SDD_FORGE_SOURCE_ROOT` was applied to the implementation in `cli.js` and tests, but the user-facing `descDetail` strings in both locale files still reference the old names. These strings are shown to users via the CLI help output, so they will document env vars that no longer work.
**Suggestion:** Update both locale files:
```json
// ja/ui.json line 184
"descDetail": "引数なしの場合は ${SDD_FORGE_WORK_ROOT}/docs を対象とする。"
// ja/ui.json line 189
"descDetail": "引数なしの場合は ${SDD_FORGE_SOURCE_ROOT}/docs/change_log.md に出力する。"
// en/ui.json — same pattern
```

---

**Verdict:** APPROVED
**Reason:** `src/AGENTS.md` is developer/agent-facing documentation that is read as part of the project's knowledge base (per CLAUDE.md). Outdated env var names here would actively mislead agents working on the codebase into using broken variable names. Same category as proposal #1 — correctness fix, not cosmetic.

### [ ] 2. Stale env var names in AGENTS.md
**File:** `src/AGENTS.md`
**Issue:** The env var table at lines 82–83 still lists `SDD_SOURCE_ROOT` and `SDD_WORK_ROOT`. This is the documentation read by agents working on the codebase, so outdated names here will cause confusion.
**Suggestion:** Update the table entries to `SDD_FORGE_SOURCE_ROOT` and `SDD_FORGE_WORK_ROOT`.

---

**Verdict:** REJECTED
**Reason:** Each env var string appears exactly twice within a single small file (`cli.js`) — once in a JSDoc comment and once in the `if` guard. The motivation ("a future rename would require another grep") is speculative; this rename already happened cleanly via the diff. Exporting `ENV_WORK_ROOT`/`ENV_SOURCE_ROOT` constants introduces an additional public export surface from `cli.js` that consumers could depend on, increasing the cost of future changes. The duplication is minimal and within a single file, which does not meet the threshold for extraction per the project's own rule ("same pattern appears in 2+ places" — not 2 occurrences of 1 constant in one file). Risk of breaking the module's public API contract outweighs the marginal benefit.

### [x] 3. Magic string duplication of env var names in `cli.js`
**File:** `src/lib/cli.js`
**Issue:** The env var key strings `"SDD_FORGE_WORK_ROOT"` and `"SDD_FORGE_SOURCE_ROOT"` each appear twice as bare string literals in `repoRoot()` and `sourceRoot()`. A future rename (or third reference site) would require another grep across the codebase, as happened in this PR.
**Suggestion:** Export named constants at the top of `cli.js` and use them throughout:
```js
export const ENV_WORK_ROOT = "SDD_FORGE_WORK_ROOT";
export const ENV_SOURCE_ROOT = "SDD_FORGE_SOURCE_ROOT";

// repoRoot()
if (process.env[ENV_WORK_ROOT]) return process.env[ENV_WORK_ROOT];
// sourceRoot()
if (process.env[ENV_SOURCE_ROOT]) return process.env[ENV_SOURCE_ROOT];
```
Test files can then import these constants instead of repeating the string literals.

---

**Verdict:** APPROVED
**Reason:** The identical object spread `{ ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp }` appears 4 times across 2 files — exactly the pattern this PR's bug demonstrates (the locale/AGENTS.md misses in proposals #1 and #2 happened because the env var names were inlined in many places). A `testEnv(tmp)` helper reduces future rename surface from 4 sites to 1, directly addresses the recurrence risk, and does not change test behavior. The project's coding rule explicitly permits extraction at 2+ repetitions without waiting for 3.

### [ ] 4. Duplicated test env setup across e2e test files
**File:** `src/presets/laravel/tests/e2e/integration.test.js`, `src/presets/symfony/tests/e2e/integration.test.js`
**Issue:** The expression `{ ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp }` appears twice in each file (4 occurrences total). This is the same mechanical duplication that made proposal #1 and #2 easy to miss in this PR — when the env var keys are inlined everywhere, a rename requires updating every call site.
**Suggestion:** Extract a local helper at the top of each test file:
```js
const testEnv = (tmp) => ({
  ...process.env,
  SDD_FORGE_WORK_ROOT: tmp,
  SDD_FORGE_SOURCE_ROOT: tmp,
});
// usage:
env: testEnv(tmp),
```
If a shared test utility already exists (e.g. `tests/e2e/lib/`), the helper can live there and be imported by both files, making it a single source of truth.

**Verdict:** REJECTED
**Reason:** No verdict provided
