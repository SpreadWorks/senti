# Code Review Results

### [x] Here are the code quality proposals based on the diff:
---

**Verdict:** APPROVED
**Reason:** The duplication is real — `groupByExtension(ds.uncovered)` and the `dsPct` formula are re-evaluated independently in all three output paths (`formatText`, `formatMarkdown`, JSON branch) from identical inputs. Pre-computing `percent` and `uncoveredByExtension` inside `computeCoverage()` is semantically correct (these are properties of the coverage result, not of the display format), eliminates the redundancy cleanly, and does not change any output values. The `showAll` flag only affects `uncovered` list truncation — not `uncoveredByExtension` — so the pre-computed field is safe to use in all paths.

### [x] 1. Redundant `groupByExtension` and `dsPct` computations across all output paths
**File:** `src/check/commands/scan.js`
**Issue:** `groupByExtension(ds.uncovered)` is called independently in `formatText` (line 155), `formatMarkdown` (line 189), and the JSON branch of `main()` (line 261). The `dsPct` percentage formula (`ds.total === 0 ? 0 : Math.round(...)`) is likewise recomputed in all three places. All three derive from the same `ds.uncovered` / `ds.analyzed` / `ds.total` values that come from `computeCoverage()`.
**Suggestion:** Include these as pre-computed fields in the `dataSourceCoverage` return from `computeCoverage()`:
```js
return {
  dataSourceCoverage: {
    total: includedFiles.length,
    analyzed: analyzedFiles.size,
    percent: total === 0 ? 0 : Math.round((analyzedFiles.size / includedFiles.length) * 100),
    uncovered,
    uncoveredByExtension: groupByExtension(uncovered),
  },
};
```
Then every consumer reads `ds.percent` and `ds.uncoveredByExtension` directly — no repeated computation, and the JSON output shape already matches without extra work in `main()`.

---

**Verdict:** APPROVED
**Reason:** The duplication is genuine: both formatters share identical slice-and-overflow logic that differs only in the per-line string template. The proposed `paginateList` helper is a minimal, well-scoped extraction. The `overflow` calculation (`list.length - display.length`) is correct for both the `showAll=false` and `showAll=true` cases, and the helper does not alter any output values. Consistent with the project's DRY rule ("2 or more repetitions → extract a common helper").

### [x] 2. Duplicate file-list truncation pattern in `formatText` and `formatMarkdown`
**File:** `src/check/commands/scan.js`
**Issue:** Both formatters repeat an identical structure: slice the list to `DEFAULT_MAX_FILES`, iterate to emit entries, then conditionally append an "…and N more" line (lines 164–168 in `formatText`, lines 202–206 in `formatMarkdown`). The only variation is the per-line string template (`      - ${f}` vs `- \`${f}\``).
**Suggestion:** Extract a small helper that returns the display slice and the optional overflow note, leaving only the formatting to the caller:
```js
/**
 * @param {string[]} list
 * @param {boolean} showAll
 * @returns {{ display: string[], overflow: number }}
 */
function paginateList(list, showAll) {
  if (showAll) return { display: list, overflow: 0 };
  const display = list.slice(0, DEFAULT_MAX_FILES);
  return { display, overflow: list.length - display.length };
}
```
Each formatter calls `paginateList`, iterates `display`, and appends its own overflow line when `overflow > 0`. This eliminates the duplicated slice+conditional from both format functions.

---

**Verdict:** APPROVED
**Reason:** The removed block (the subcommand-aware flag injection) was a confirmed bug fix recorded in `issue-log.json` for spec-158 with explicit entry: *"review command failed: codex --json exec causes 'unexpected argument --json found' error"* and marked `guardrailCandidate`. The retro also classifies the fix as unplanned-but-intentional. Reverting it without explanation restores a known functional failure for codex invocations — this is a real behavioral regression, not a cosmetic change. The fix should be restored, or if the revert is deliberate (e.g., codex support dropped), a comment must document the rationale to prevent the fix from being silently re-applied again.

### [ ] 3. `injectJsonFlag` revert re-introduces the codex `--json` flag-order bug
**File:** `src/lib/agent.js`
**Issue:** The removed block (lines 93–95 in the original) was added in spec-158 specifically to fix a known failure: `codex --json exec` is rejected by the codex CLI, which requires `codex exec --json`. Without that block, `injectJsonFlag` always prepends `flagParts`, so codex invocations revert to the broken form. The `issue-log.json` for spec-158 records this as a confirmed pre-existing bug (`"review command failed: codex --json exec causes 'unexpected argument --json found' error"`), and spec-158's retro marks the fix as unplanned-but-intentional.
**Suggestion:** If the revert is intentional (e.g., codex CLI has since changed its flag parsing, or the project has dropped codex support), add a comment explaining the rationale to prevent the fix from being re-applied. If unintentional, restore the subcommand-aware placement:
```js
// Subcommand-first CLIs (e.g. codex) require flags after the subcommand:
//   codex exec --json  ✓    codex --json exec  ✗
if (args.length > 0 && !args[0].startsWith("-")) {
  return [args[0], ...flagParts, ...args.slice(1)];
}
return [...flagParts, ...args];
```

**Verdict:** REJECTED
**Reason:** No verdict provided
