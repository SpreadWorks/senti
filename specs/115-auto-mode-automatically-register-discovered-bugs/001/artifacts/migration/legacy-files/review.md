# Code Review Results

### [x] Looking at this diff carefully, I can identify several meaningful code quality issues.


**Verdict:** APPROVED
**Reason:** The diff clearly removes `DEFAULT_AGENT_TIMEOUT_MS` from `agent.js` and reverts all 7+ call sites back to inline `DEFAULT_AGENT_TIMEOUT * 1000`. This is a textbook DRY violation — a derived constant that was correctly centralized is now scattered across the codebase. The constant eliminates a class of errors (e.g., someone changing the base value without updating all multiplication sites) and costs nothing to maintain.

### [x] 1. Duplicate `DEFAULT_AGENT_TIMEOUT * 1000` multiplication re-introduced across 8 files
**File:** `src/lib/agent.js`, `src/docs/commands/agents.js`, `src/docs/commands/enrich.js`, `src/docs/commands/forge.js`, `src/docs/commands/readme.js`, `src/docs/commands/text.js`, `src/docs/commands/translate.js`
**Issue:** `DEFAULT_AGENT_TIMEOUT_MS` was removed from `agent.js` and all callers were reverted to `DEFAULT_AGENT_TIMEOUT * 1000`. This re-introduces exactly the duplication that constant was created to eliminate. The multiplication now appears at least 8 times across the codebase.
**Suggestion:** Restore `export const DEFAULT_AGENT_TIMEOUT_MS = DEFAULT_AGENT_TIMEOUT * 1000;` in `src/lib/agent.js` and re-import it in the 7 command files that use the value. This was the correct abstraction before this diff undid it.

---

**Verdict:** APPROVED
**Reason:** The diff deletes `analysis-filter.js` (a shared module with two exported functions), copies `filterByDocsExclude` verbatim into `enrich.js` as a private function, and removes the `filterAnalysisByDocsExclude` call from `data.js` entirely. This breaks the `docs.exclude` contract for the data pipeline — excluded entries will now appear in `{{data}}` directive output. The shared module existed to serve both `enrich.js` and `data.js`; inlining it into one and dropping it from the other is a functional regression, not just a style issue.

### [x] 2. `filterByDocsExclude` logic inlined back into `enrich.js` after being extracted to a shared module
**File:** `src/docs/commands/enrich.js`, `src/docs/lib/analysis-filter.js` (deleted)
**Issue:** `analysis-filter.js` was deleted and `filterByDocsExclude` was copied verbatim back into `enrich.js` (lines 79–95 of the new diff). `filterAnalysisByDocsExclude` was also removed from `data.js`. If `data.js` or any future command needs the same filtering, the logic will need to be duplicated again. The shared module existed for this exact reason.
**Suggestion:** Restore `src/docs/lib/analysis-filter.js` with both `filterByDocsExclude` and `filterAnalysisByDocsExclude`. Re-import `filterByDocsExclude` in `enrich.js` instead of defining it inline. Re-apply the `filterAnalysisByDocsExclude` call in `data.js` to maintain the `docs.exclude` contract for the data pipeline.

---

**Verdict:** APPROVED
**Reason:** The diff removes the `.filter((c) => typeof c === "string" || !c.exclude)` guard from `resolveChaptersOrder`. The config schema still documents `exclude` as a valid field (visible in the same diff's `configuration.md` update: `"Each entry: { chapter: "name.md", desc?: string, exclude?: boolean }"`). Users who set `exclude: true` on a chapter will see it processed anyway. This is a silent behavioral regression that contradicts the tool's own documented configuration contract.

### [x] 3. `exclude: true` chapter filtering silently removed from `resolveChaptersOrder`
**File:** `src/docs/lib/template-merger.js`
**Issue:** The diff removes the `.filter((c) => typeof c === "string" || !c.exclude)` guard. As a result, `config.chapters[{ chapter: "foo.md", exclude: true }]` entries now pass through to `init`, `data`, `text`, `readme`, and `agents` as if `exclude` were never set. The config schema still documents `exclude` as a valid field, so this silently breaks user configuration.
**Suggestion:** Restore the filter before the `.map()`:
```js
return configChapters
  .filter((c) => typeof c === "string" || !c.exclude)
  .map((c) => typeof c === "string" ? c : c.chapter);
```

---

**Verdict:** APPROVED
**Reason:** The deleted tests directly cover behaviors that proposals #1–#3 identify as regressions. The `analysis-filter.test.js` tests verify `docs.exclude` filtering in the data pipeline (proposal #2). The `resolveChaptersOrder — exclude:true` tests verify chapter exclusion (proposal #3). The timeout constant tests verify the centralized export (proposal #1). The project's own CLAUDE.md explicitly states: "テストを通すためにテストコードを修正してはならない" (tests must not be modified to make them pass). Deleting tests alongside the code they protect — when that code removal is itself a regression — violates this policy. Tests should be restored in tandem with the corresponding production code.

### [ ] 4. Three test suites deleted without behavioral justification
**File:** `tests/unit/docs/lib/analysis-filter.test.js`, `tests/unit/docs/lib/template-merger.test.js` (the `resolveChaptersOrder — exclude:true` describe block), `specs/115-centralize-timeout-and-threshold-constants/tests/verify-timeout-constants.test.js`
**Issue:** All three test suites were deleted alongside the code they covered. The `template-merger.test.js` deletion removes regression coverage for the `exclude: true` behavior (see Proposal #3). The `analysis-filter.test.js` deletion removes coverage for `filterByDocsExclude` and `filterAnalysisByDocsExclude` (see Proposal #2). The timeout constant tests were removed together with `DEFAULT_AGENT_TIMEOUT_MS` (see Proposal #1). Deleting tests to make a failing suite pass is explicitly prohibited by the project's test policy.
**Suggestion:** Restore all three test suites in line with restoring the corresponding production code. Tests should only be removed when the behavior they describe is intentionally and permanently removed.

**Verdict:** REJECTED
**Reason:** No verdict provided
