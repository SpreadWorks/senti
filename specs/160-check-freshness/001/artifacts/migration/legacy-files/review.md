# Code Review Results

### [x] Based on a thorough reading of all changed files, here are the proposals:
---

**Verdict:** APPROVED
**Reason:** This is a genuine correctness concern, not cosmetic. The diff reverts `cli.js` and `command-context.js` back to `SDD_WORK_ROOT`/`SDD_SOURCE_ROOT` while `SDD_FORGE_PROFILE` retains its `SDD_FORGE_` prefix — exactly the split-prefix inconsistency spec 160 was written to eliminate. The result is two env-var naming conventions co-existing in the same codebase, which will confuse users and agents alike. Aligning all three under one prefix is a correctness fix with meaningful impact. Whichever direction is chosen, it must be applied atomically across all reference sites (source, tests, comments, locale strings, docs).

### [x] 1. Env var prefix inconsistency: `SDD_WORK_ROOT` / `SDD_SOURCE_ROOT` vs `SDD_FORGE_PROFILE`
**File:** `src/lib/cli.js`, `src/docs/lib/command-context.js`
**Issue:** This diff reverts the env var names from `SDD_FORGE_WORK_ROOT` / `SDD_FORGE_SOURCE_ROOT` back to `SDD_WORK_ROOT` / `SDD_SOURCE_ROOT`. Meanwhile, `SDD_FORGE_PROFILE` in `src/lib/agent.js` retains the `SDD_FORGE_` prefix. The three env vars now have two different prefixes (`SDD_` vs `SDD_FORGE_`), which is the exact inconsistency spec 160 set out to eliminate. The `freshness.js` file comment on line 8 also documents `SDD_SOURCE_ROOT` (no `FORGE_`), cementing the split.
**Suggestion:** Align all three env vars under a single prefix. Either rename `SDD_FORGE_PROFILE` → `SDD_PROFILE` to match the reverted pair, or restore `SDD_FORGE_WORK_ROOT` / `SDD_FORGE_SOURCE_ROOT` to match the `SDD_FORGE_PROFILE` convention. Whichever direction is chosen, document the canonical prefix in `src/AGENTS.md`.

---

**Verdict:** APPROVED
**Reason:** Four identical occurrences of `{ ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp }` across two files clearly meets the project's explicit extraction rule ("same pattern at 2+ sites — no need to wait for 3"). This is not speculation: the deleted `review.md` in the diff documents that inlined key strings at call sites caused real misses during this very PR (locale and AGENTS.md were not updated). A `testEnv(tmp)` helper consolidates the rename surface to one location, directly reducing future risk. Test behavior is unchanged.

### [x] 2. Duplicate test env object construction across e2e test files
**File:** `src/presets/laravel/tests/e2e/integration.test.js`, `src/presets/symfony/tests/e2e/integration.test.js`
**Issue:** `{ ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp }` appears 4 times across 2 files (2 per file). This spread was the exact site that caused the stale-reference bug documented in the deleted `review.md` — when env var keys are inlined at every call site, a rename must be applied to all 4 locations, and it's easy to miss one.
**Suggestion:** Extract a shared helper. If a common test utilities file exists (e.g. `tests/helpers/`), add it there; otherwise add a file-local helper at the top of each test:
```js
// tests/helpers/tmp-dir.js (or top of each e2e test file)
export const testEnv = (tmp) => ({
  ...process.env,
  SDD_WORK_ROOT: tmp,
  SDD_SOURCE_ROOT: tmp,
});

// usage
env: testEnv(tmp),
```
Per the project coding rule: extraction is required when the same pattern appears at 2+ sites — no need to wait for a third occurrence.

---

**Verdict:** APPROVED
**Reason:** If `parseArgs` is called with `defaults: { format: "text" }`, `cli.format` is guaranteed to be `"text"` when the flag is absent — `undefined` is never returned. The `|| "text"` guard is dead code that cannot activate and misleads readers into thinking `cli.format` could be falsy at that point. Removing it is a correctness-clarity fix. One caveat worth checking: if the flag can be set to an empty string `""`, `|| "text"` would silently override it while the plain assignment would not — but that edge case does not apply to a format enum, so the removal is safe.

### [x] 3. Redundant default fallback for `cli.format` in `freshness.js`
**File:** `src/check/commands/freshness.js`
**Issue:** Line 170: `const format = cli.format || "text";`. The `parseArgs` call on line 160–163 already specifies `defaults: { format: "text" }`, so `cli.format` is guaranteed to be `"text"` when the flag is absent. The `|| "text"` fallback is dead code that will never activate.
**Suggestion:** Remove the redundant fallback:
```js
// Before
const format = cli.format || "text";

// After
const format = cli.format;
```

---

**Verdict:** APPROVED
**Reason:** Two structurally identical `if (xTruncated) { process.stderr.write(...) }` blocks, differing only in the label string, meet the project's 2+ extraction threshold. The proposed loop over `[[srcTruncated, "source"], [docsTruncated, "docs"]]` preserves exact runtime behavior (same output, same ordering, same condition check) while making the warning format a single source of truth. Future label or message changes require one edit instead of two, which is the point of the rule.

### [ ] 4. Duplicate truncation warning blocks in `newestMtime` caller
**File:** `src/check/commands/freshness.js`
**Issue:** Lines 131–139 contain two structurally identical `if (xTruncated) { process.stderr.write(...) }` blocks that differ only in the label (`"source"` vs `"docs"`):
```js
if (srcTruncated) {
  process.stderr.write(`...source file limit (${FILE_LIMIT}) reached...`);
}
if (docsTruncated) {
  process.stderr.write(`...docs file limit (${FILE_LIMIT}) reached...`);
}
```
Two occurrences of the same pattern meets the project's extraction threshold.
**Suggestion:** Extract a small inline helper or use a loop:
```js
for (const [flag, label] of [[srcTruncated, "source"], [docsTruncated, "docs"]]) {
  if (flag) {
    process.stderr.write(
      `sdd-forge check freshness: warning — ${label} file limit (${FILE_LIMIT}) reached, result may be approximate\n`
    );
  }
}
```

**Verdict:** REJECTED
**Reason:** No verdict provided
