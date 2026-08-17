# Code Review Results

### 1. 1. Extract ignored directory set to a named constant
**File:** `src/check/commands/scan.js`
**Issue:** The walk function uses an inline OR chain (`entry.name === ".git" || entry.name === "node_modules" || entry.name === "vendor" || entry.name === ".sdd-forge"`) to skip directories. This is awkward to read, hard to extend, and the list is implicit. Given the file now defines other scan-related constants (`MAX_SCAN_DEPTH`, `MAX_SCAN_FILES`, etc.) at module scope, leaving this list inline is inconsistent.
**Suggestion:** Define `const SCAN_SKIP_DIRECTORIES = new Set([".git", "node_modules", "vendor", ".sdd-forge"]);` near the other constants and replace the chain with `if (SCAN_SKIP_DIRECTORIES.has(entry.name)) continue;`.

### 2. 2. Move the file-count check into `addResult` before push for clearer semantics
**File:** `src/check/commands/scan.js`
**Issue:** `addResult` pushes first, then throws when `results.length > MAX_SCAN_FILES`. The bound is honored (the array can hold up to `MAX_SCAN_FILES` entries before the next push triggers), but the off-by-one phrasing makes the invariant subtle. A reader has to reason that "push then check `> MAX`" leaves the array at `MAX + 1` momentarily.
**Suggestion:** Check before pushing:
```js
function addResult(relPath) {
  if (results.length >= MAX_SCAN_FILES) {
    throw new Error(`scan matched file count exceeds max ${MAX_SCAN_FILES}`);
  }
  results.push(relPath);
}
```
This makes the upper bound exact and matches the natural reading of the constant name.

### 3. 3. Unify the bound-violation error message format
**File:** `src/check/commands/scan.js`
**Issue:** The three bound errors use slightly different phrasings — "scan matched file count exceeds max N", "scan directory depth exceeds max N: <path>", "scan directory entry count exceeds max N: <path>". Two include a path suffix, one does not; the wording mixes "matched file count" vs "directory entry count" vs "directory depth". This is fine functionally but makes the messages harder to parse uniformly in logs/tests.
**Suggestion:** Adopt a single shape, e.g. `scan: <metric> exceeds max <N> (<context>)`, and always include a context value (use `relPath` for file-count overflow). This also makes the file-count error actionable (operators learn which file tipped it over).

### 4. 4. `walkIncludedFiles` should signal partial completion explicitly, not by throwing through callers
**File:** `src/check/commands/scan.js`
**Issue:** The new bounds throw `Error` from deep inside the recursion, but the call site `walkIncludedFiles(...)` in `computeCoverage` (and ultimately `runCheckScan`) does not catch or contextualize the failure — so a large repo would surface a bare "scan matched file count exceeds max 100000" with no indication that the user can raise the limit or narrow the include glob. Bounded resource use is correct, but the UX for hitting the bound is abrupt.
**Suggestion:** Catch the bound errors at the `runCheckScan` boundary and emit a CLI-appropriate message (e.g., "Aborted: include patterns matched more than 100,000 files; narrow the glob or raise MAX_SCAN_FILES."). Keeps the bound enforcement intact while giving users a recoverable action.

### 5. 1. `compileExcludeMatchers` is a trivial one-liner that adds indirection
**File:** `src/docs/lib/analysis-filter.js`
**Issue:** `compileExcludeMatchers` wraps a single `excludePatterns.map((p) => globToRegex(p))` call. Per the project rule "不要な間接層禁止" (no unnecessary indirection), a helper that just renames a one-liner adds reading cost without payoff — especially since it's used in only two places, both inside the same module.
**Suggestion:** Inline the `.map(globToRegex)` call at both call sites, or, if you want to keep one helper, drop `compileExcludeMatchers` and inline only the regex compilation while keeping `filterEntriesByExcludeMatchers` (which is the actual reuse target). Also `(p) => globToRegex(p)` can be simplified to `globToRegex` (point-free).

### 6. 2. Inconsistent terminology: "matchers" vs "regexes" vs original "regexes"
**File:** `src/docs/lib/analysis-filter.js`
**Issue:** The new helpers name the compiled values "matchers", but the parameter inside the closure is still `re` and the values are concretely `RegExp` instances produced by `globToRegex`. The pre-diff code used the more direct name `regexes`. Mixing "matchers" (abstract) with `re` (concrete) within a few lines hurts readability and signals an abstraction that isn't there — there is no matcher interface, just `RegExp.test`.
**Suggestion:** Pick one term consistently. Either rename to `compileExcludeRegexes` / `filterEntriesByExcludeRegexes` (matching the concrete type and the prior naming), or, if you intend to support non-regex matchers later, change the closure variable from `re` to `matcher` and document the contract.

### 7. 3. `filterByDocsExclude` is now redundant with the new helpers
**File:** `src/docs/lib/analysis-filter.js`
**Issue:** After extraction, `filterByDocsExclude` is just `filterEntriesByExcludeMatchers(entries, compileExcludeMatchers(patterns))` with an early-return for empty patterns. If `filterAnalysisByDocsExclude` is the only other in-tree consumer of the pre-compiled path, the two-step public API duplicates intent: callers with raw patterns use `filterByDocsExclude`, callers that already compiled use `filterEntriesByExcludeMatchers`. This invites future drift (e.g., adding normalization in one but not the other).
**Suggestion:** Audit external callers of `filterByDocsExclude`. If all callers can hold a compiled regex list, expose only `filterEntriesByExcludeRegexes` plus a small `compileExcludeRegexes`, and delete `filterByDocsExclude`. If `filterByDocsExclude` must remain (per the alpha "後方互換コードは書かない" policy this should be a deliberate choice, not residual), document why it stays alongside the lower-level helper.

### 8. 1. `patternToRegex` and imported `globToRegex` are near-duplicate glob converters in the same file
**File:** `src/docs/lib/scanner.js`
**Issue:** The diff extracted `globToRegex` to `src/lib/glob.js` and re-imports it, but `patternToRegex` (lines 22–27) was left in place. Both functions do glob→regex conversion. `patternToRegex` is even more permissive (`*` → `.*` instead of `[^/]*`), but the only in-file caller — `findFiles` (line 49) — applies it to `entry.name`, which never contains `/`, so `globToRegex` would produce equivalent matches for that call site. Having two glob implementations side-by-side in one file invites drift and contradicts the project rule about consolidating duplicate patterns into a shared helper (this is exactly the duplication called out previously in `specs/075-guardrail-metadata/review.md`).
**Suggestion:** Switch the internal `findFiles` call to use the imported `globToRegex(pattern)` and remove the local `patternToRegex` from scanner.js. External callers (`src/lib/guardrail.js`, `src/lib/container.js`, creating_presets.md template) should import `globToRegex` from `src/lib/glob.js` (or have container register `glob.globToRegex` instead of `scanner.patternToRegex`). This finishes the extraction the diff started and leaves a single canonical glob converter.

### 9. 2. Stale `glob ベースファイル収集` section header now leads with no helper
**File:** `src/docs/lib/scanner.js`
**Issue:** The section banner at lines 203–205 (`// glob ベースファイル収集`) used to introduce both `globToRegex` and `collectFiles`. After moving `globToRegex` out, the section contains only `collectFiles`, while the actual glob-pattern conversion utility has been relocated. The comment header still implies the helper lives here.
**Suggestion:** Either tighten the section comment to reflect that pattern conversion is delegated to `../../lib/glob.js` (e.g. add a one-line pointer), or merge `collectFiles` into the existing `ファイル探索` section so the file structure stays self-describing.

### 10. 1. Over-engineered all-static factory class
**File:** `src/flow/lib/run-final-regression.js`
**Issue:** `FinalRegressionProcessResultFactory` is a class with only static methods, no state, and no instances. The project's OOP guidance is about expressing *values* as classes whose invariants are enforced by the constructor (e.g. `FinalRegressionAttempt`, `FinalRegressionRootCheck`). A "factory" with only static methods that build plain objects is just a namespaced function group, with no instances and no invariants — so the class wrapper adds an indirection layer ("不要な間接層禁止" per the project's code-quality feedback). Moreover `commandDiscovery` and `rootMismatch` are one-liners that merely re-pack arguments before calling `failure`.
**Suggestion:** Replace the class with two module-local helpers, e.g.

```js
function discoveryFailureResult(err) {
  const msg = err.message || String(err);
  return failureResult({ spawnError: msg, stderr: msg });
}
function rootMismatchFailureResult(msg) {
  return failureResult({ stderr: msg });
}
function failureResult({ spawnError = null, stderr = "" } = {}) {
  return { started: false, exitCode: 1, signal: null, timedOut: false, spawnError, stdout: "", stderr };
}
```

This matches the style of the other plain helpers in the same file (`appendRaw`, `repoRelative`, `sameRealPath`) and removes a class that exists only to host static functions.

### 11. 2. Misplaced comment on `failure()`
**File:** `src/flow/lib/run-final-regression.js`
**Issue:** Inside `FinalRegressionProcessResultFactory.failure`, the comment `// spawnError is set only for actual command discovery or spawn failures.` documents how *callers* are expected to use the parameter, not the function itself. Placed inside the function body, it reads as a claim about `failure`'s behavior, but `failure` happily accepts a non-null `spawnError` from anywhere. The constraint is enforced (loosely) at the call sites, not here.
**Suggestion:** Move the comment to the two call sites (or drop it; the call-site names `commandDiscovery` / `rootMismatch` already convey intent). If kept, restate it as a parameter contract on the doc/JSDoc above the function, not as an inline assertion in the body.

### 12. 3. One-shot constant `ATTEMPT_LIMIT_MESSAGE`
**File:** `src/flow/lib/run-final-regression.js`
**Issue:** `ATTEMPT_LIMIT_MESSAGE` is declared as a top-level frozen-style constant but is referenced exactly once, and the only use immediately appends `; next=${nextIndex}` to it. Extracting the prefix as a named constant adds a hop without aiding reuse or testability — the full string is constructed on the fly anyway.
**Suggestion:** Inline the message into the `throw` site:
```js
throw new Error(`final-regression attempt limit exceeded (max=${MAX_FINAL_REGRESSION_ATTEMPTS}); next=${nextIndex}`);
```
and remove the constant. Same pattern as `MAX_FINAL_REGRESSION_RAW_DIR_SCAN_ENTRIES`'s error message, which is constructed inline.

### 13. 4. `previousFailures` array used only for its length
**File:** `src/flow/lib/run-final-regression.js`
**Issue:** After the removal of `previousFailureKind` (R3), `previousFailures` is consumed solely as `previousFailures.length` when calling `FinalRegressionDecision.fail`. The full array of issue-log entries is loaded just to count them. This obscures the intent — readers see an `array` and may assume entries themselves are inspected later.
**Suggestion:** Either (a) rename the local to `previousFailureCount` and convert at the call site:
```js
const previousFailureCount = previousFinalRegressionFailures(root, state).length;
```
or (b) introduce a `countPreviousFinalRegressionFailures(root, state)` helper that returns a number directly, keeping the issue-log shape encapsulated in `set-issue-log.js`/this file. Option (b) aligns better with the "モジュールのカプセル化" rule in CLAUDE.md (expose query functions, not raw data).

### 14. 5. `FinalRegressionRootCheck.fromContext` silently re-resolves worktree paths
**File:** `src/flow/lib/run-final-regression.js`
**Issue:** `fromContext` does `state.worktreePath ?? ctx.flowManager.resolveWorktreePaths(state).worktreePath`. The fallback hides a non-trivial call (`resolveWorktreePaths`) behind a null-coalesce that looks like a default value. If `state.worktreePath` is missing on a worktree-mode state, this silently reaches into `ctx.flowManager`, coupling root-check construction to FlowManager internals. Future maintainers reading the call site won't realize a worktree resolution can be invoked here.
**Suggestion:** Make the resolution explicit and guarded — e.g. assert that worktree-mode state carries `worktreePath`, or compute the expected root in the caller (`execute`) where the FlowManager dependency is visible, then pass it as a plain string into `new FinalRegressionRootCheck({ root, expectedRoot })`. The class then has one well-defined responsibility (compare two roots), and `fromContext` no longer needs to exist.

### 15. 6. Bounded-resource guard duplicated across two thresholds
**File:** `src/flow/lib/run-final-regression.js`
**Issue:** `MAX_FINAL_REGRESSION_ATTEMPTS` (cap on attempt index) and `MAX_FINAL_REGRESSION_RAW_DIR_SCAN_ENTRIES` (cap on directory entries scanned) are both `10_000` and both serve as upper bounds for the same activity. Having two constants with the same value invites drift (someone bumps one and not the other) and clutters the rationale: the directory scan only exists to find the next attempt index, so its bound should be a function of the attempt cap, not an independent magic number.
**Suggestion:** Derive the scan bound from the attempt bound, e.g.
```js
const MAX_FINAL_REGRESSION_ATTEMPTS = 10_000;
// Allow some slack for unrelated files in the raw dir.
const MAX_FINAL_REGRESSION_RAW_DIR_SCAN_ENTRIES = MAX_FINAL_REGRESSION_ATTEMPTS * 2;
```
Or collapse to a single constant if no unrelated files are expected in `TESTS_RAW_DIR_RELATIVE`. This preserves the bounded-resource guarantee (guardrail `bounded-resource-usage`) while making the relationship between the two limits explicit.

### 16. 1. Inconsistent failure handling between `git add` and `git commit` in `executeCommitPost`
**File:** `src/flow/lib/run-finalize.js`
**Issue:** The diff adds `assertOk(addRes, "failed to stage durable test/report artifacts")` for the `git add` call (lines 211–212), but the very next `commitOrSkip(...)` call is wrapped in a `try/catch` that downgrades commit failures to a soft `commitNote` on `results.report` (lines 214–220). As a result, the two adjacent git operations in the same logical step ("commit durable artifacts") now have opposite failure semantics:

- `git add` failure → uncaught throw, aborts `executeCommitPost` entirely (and any subsequent post-commit work the caller might do).
- `git commit` failure → swallowed into a 200-char note on the report.

The previous code silently dropped both. The new code is louder for `add` but silent-ish for `commit`. This split is not justified by either related requirement (R4/R8 concern log path naming and prompt guidance, not staging error policy), and a reader has to stop and figure out why staging is "hard fail" while committing is "soft fail" for the same artifact set.

**Suggestion:** Pick one policy and apply it to both calls. Two reasonable options:

- **Option A — fail loudly throughout (recommended for evidence integrity):** move the `commitOrSkip` call out of the `try/catch` so durable-artifact commit failures also throw. The `finalizeOnError` hook will record the failure in `issue-log.json`, which matches how other finalize steps surface real problems.
- **Option B — keep the soft-fail behavior:** move `assertOk(addRes, …)` inside the existing `try { … } catch (e) { … }` block (or rethrow inside it) so a staging failure becomes the same `commitNote` as a commit failure.

Either way, the two adjacent operations on the same artifact set should share one failure policy, and a brief comment should state why (e.g. "soft-fail: report should still be produced even if artifact staging fails" or "hard-fail: durable evidence must be staged").

### 17. 1. Bound check measures the wrong length
**File:** `src/flow/lib/run-review.js`
**Issue:** The bounded-resource guard checks `ids.length` (the full count of leaves under `impl`), but the constant `MAX_IMPL_DOWNSTREAM_RESET_STEPS` is conceptually a cap on the *reset slice* (the inclusive range that will be reset). If `impl` ever grows past 20 leaves but the reset slice itself stays small, this aborts spuriously; conversely, the constant misnames what it guards.
**Suggestion:** Compute the slice first, then enforce the cap on `result.length`. e.g.
```js
const slice = ids.slice(start, end + 1);
if (slice.length > MAX_IMPL_DOWNSTREAM_RESET_STEPS) {
  throw new Error(`impl downstream reset leaf count exceeds max ${MAX_IMPL_DOWNSTREAM_RESET_STEPS}`);
}
return Object.freeze(slice);
```
This makes the bound semantically match the constant's name and intent.

### 18. 2. Helper name is generic but error/constant tie it to `impl`
**File:** `src/flow/lib/run-review.js`
**Issue:** `inclusiveFlowLeafStepIdsBetween(parentId, startId, endId)` reads as a reusable utility, but the body hard-codes the `"impl downstream reset"` error string and uses a constant prefixed `IMPL_`. The mixed abstraction level confuses future readers — either it's generic (and the error/constant should not mention `impl`) or it's purpose-built (and the parameters should not pretend otherwise).
**Suggestion:** Since this is used in exactly one place and lives in `run-review.js`, collapse it to a purpose-named helper such as `computeImplReviewDownstreamStepIds()` taking no parameters, with `parent="impl"`, `start="test-execute"`, `end="finalize-cleanup"` as locals. That matches the single use site and removes the abstraction mismatch. Reserve a generic helper for when a second call site appears.

### 19. 3. Validation order can mask the real problem
**File:** `src/flow/lib/run-review.js`
**Issue:** When `startId` or `endId` is missing from the flattened list (a likely cause when the flow definition is edited), the bound check `ids.length > MAX_IMPL_DOWNSTREAM_RESET_STEPS` runs first and may either throw an unrelated cap error or silently pass through to `slice(-1, …)` producing an odd range. The "range not found" diagnostic is far more actionable.
**Suggestion:** Reorder: first resolve `start`/`end` and assert `start >= 0 && end >= start`, then derive the slice, then bound the slice length. This surfaces the most diagnostic error first and avoids the misleading cap message.

### 20. 4. Comment placement loses context at the declaration
**File:** `src/flow/lib/run-review.js`
**Issue:** The intent comment "Review proposals invalidate all implementation leaves from fresh test execution through finalize cleanup; both endpoints are intentionally reset." sits on the module-level constant, while the deleted "Review-applied code changes can alter file contents…" comment that justified *why* the reset exists now lives inside `resetImplEvidenceAfterReviewProposals`. Splitting the rationale across two locations makes neither read as a complete justification.
**Suggestion:** Consolidate the rationale (proposals can alter file contents without changing the changed-file list ⇒ downstream evidence is stale ⇒ reset from `test-execute` through `finalize-cleanup` inclusively) into a single docblock above `resetImplEvidenceAfterReviewProposals`, and shorten the constant's comment to a one-liner like `// Inclusive: test-execute … finalize-cleanup.`

### 21. 1. Unnecessary read-after-write of the temp summary
**File:** `src/flow/lib/run-test-execute.js`
**Issue:** After `writeTempRequirementSummary(specDir, summary)`, the code immediately calls `readJsonStrict(tempRequirementSummaryPath(specDir))` to obtain `persistedSummary`, which is then used for `validateSummaryEvidence` and the final `artifact.summary`. The in-memory `summary` is identical to what was just serialized (the writer does a `JSON.stringify` and `readJsonStrict` parses it back). This is wasted disk I/O and adds two parallel names (`summary` vs `persistedSummary`) for the same data.
**Suggestion:** Drop the round-trip read. Pass `summary` directly to `validateSummaryEvidence` and use it for `artifact.summary`. If the intent is to guarantee a JSON-serializable shape, do that with a single in-memory `JSON.parse(JSON.stringify(summary))` once, or push that responsibility into `writeTempRequirementSummary` and have it return the normalized object.

### 22. 2. `testableRequirementsForSummary` name no longer matches its use
**File:** `src/flow/lib/run-test-execute.js`
**Issue:** The helper is now also consumed when generating the spec-local log lines (`...testableRequirements.map(...)`), not just by `buildSummary`. The `ForSummary` suffix overstates its scope and will mislead future readers.
**Suggestion:** Rename to something call-site neutral such as `boundedTestableRequirements(requirements)` or `selectTestableRequirements(requirements)`. The cap (resource bound) is the helper's real responsibility; the name should reflect that, not one of its two consumers.

### 23. 3. `tempSummaryWritten` flag is redundant with idempotent cleanup
**File:** `src/flow/lib/run-test-execute.js`
**Issue:** The success path now does `removeTempRequirementSummary(specDir); tempSummaryWritten = false;`, and the `finally` block does `if (tempSummaryWritten) removeTempRequirementSummary(specDir);`. If `removeTempRequirementSummary` is implemented with the same "remove-if-exists" semantics as the old `removeIfExists`, the flag adds branching for no benefit — calling it twice is safe.
**Suggestion:** Drop `tempSummaryWritten` and unconditionally call `removeTempRequirementSummary(specDir)` in `finally`. Remove the explicit success-path delete (or keep it, but stop tracking state). This also removes a class of bugs where the flag and disk state could drift.

### 24. 4. Bounded-resource cap is enforced after expensive work, not before
**File:** `src/flow/lib/run-test-execute.js`
**Issue:** `testableRequirementsForSummary(requirements)` (which enforces `MAX_TEST_EXECUTE_REQUIREMENTS = 500`) is invoked *after* `spec.json` is read but the throw still happens before `runSpecLocalTests`, which is good. However, the cap is on *testable* requirements only; an attacker/bug producing 100k non-testable requirements still flows through `Array.isArray(spec.requirements) ? spec.requirements : []` and into `.filter(...)` unbounded. For a guardrail that exists to bound resource usage, the cap should apply to the raw input length as well, or the helper should validate `requirements.length` before filtering.
**Suggestion:** Check `requirements.length > MAX_TEST_EXECUTE_REQUIREMENTS` first (cheap, before any filtering), then filter. This makes the bound apply to total input, not just the testable subset, and matches the spirit of the bounded-resource-usage guardrail.

### 25. 5. Inconsistent helper-vs-constant split in the `test-artifacts` import
**File:** `src/flow/lib/run-test-execute.js`
**Issue:** The refactor moved most temp-summary handling behind helpers (`writeTempRequirementSummary`, `removeTempRequirementSummary`, `removeTestExecuteResetArtifacts`), but still imports `RAW_OUTPUT_RELATIVE` as a raw constant and joins it with `path.join(specDir, RAW_OUTPUT_RELATIVE)` directly in `run()`. This is the same pattern (`path.join(specDir, X_RELATIVE)`) that was just encapsulated for `TEMP_SUMMARY_RELATIVE` and the reset list — keeping one raw constant export defeats the "queries only, no raw data" rule from `CLAUDE.md` (モジュールのカプセル化).
**Suggestion:** Add a `rawOutputPath(specDir)` (or similar) helper in `test-artifacts.js` and stop exporting `RAW_OUTPUT_RELATIVE`. Same treatment as the temp-summary path keeps the module's encapsulation consistent.

### 26. 1. Redundant alias functions for the same operation
**File:** `src/flow/lib/test-artifacts.js`
**Issue:** `removeReviewResetArtifacts(specDir)` and `removeTestExecuteResetArtifacts(specDir)` are both pure one-line aliases that just call `removeRebuildableTestArtifacts(specDir)`. There is no behavioral difference between them — they exist only to provide phase-flavored names. This violates the encapsulation/DRY guidance in CLAUDE.md ("不要な間接層禁止") and gives readers the false impression that the three phases reset different artifact sets.
**Suggestion:** Drop both aliases and have callers (review/test-execute) call `removeRebuildableTestArtifacts(specDir)` directly. If the intent is to document which phase invokes the reset, leave the call-site comment there rather than minting a synonym per phase. If a phase truly needs a different set later, introduce the alias at that point with a distinct relative-pattern list.

### 27. 2. Three near-identical artifact-pattern lists built by accretion
**File:** `src/flow/lib/test-artifacts.js`
**Issue:** `DURABLE_…`, `IMPLEMENTATION_COMMIT_EXCLUDED_…`, and `REBUILDABLE_…` are all derived from the same base list with one inclusion/exclusion rule. The current shape (`...DURABLE`, filter, spread `TEMP`) is hard to scan and the `filter((pattern) => pattern !== FINAL_REGRESSION_RAW_OUTPUT_PATTERN)` silently becomes a no-op if the constant name ever drifts.
**Suggestion:** Define small role-tagged lists once (e.g. `DURABLE_PROJECT_TEST_ARTIFACTS`, `DURABLE_FINAL_REGRESSION_LOGS`, `TEMP_ARTIFACTS`) and compose the three exported sets explicitly:
- `DURABLE = [...DURABLE_PROJECT_TEST_ARTIFACTS, ...DURABLE_FINAL_REGRESSION_LOGS]`
- `REBUILDABLE = [...DURABLE_PROJECT_TEST_ARTIFACTS, ...TEMP_ARTIFACTS]` (i.e. everything except the final-regression attempt logs, which must persist across rebuilds)
- `IMPLEMENTATION_COMMIT_EXCLUDED = [...DURABLE, ...TEMP_ARTIFACTS]`
This removes the filter-by-identity, makes the durability rationale visible, and protects against accidental rename drift.

### 28. 3. `addCollectedArtifactPathspec` over-counts by one before throwing
**File:** `src/flow/lib/test-artifacts.js`
**Issue:** The helper adds first and only then checks `existing.size > MAX_COLLECTED_ARTIFACTS`, which means the limit is effectively `MAX_COLLECTED_ARTIFACTS + 1` and the set is mutated past its declared bound before the error is thrown. The `MAX_ARTIFACT_GLOB_ENTRIES` check has a similar inconsistency: `if (++seen > MAX)` allows up to `MAX + 1` entries to be processed before the error fires (the entry that triggers the throw was already iterated via `readSync`).
**Suggestion:** Check the bound before mutating: `if (existing.size >= MAX_COLLECTED_ARTIFACTS) throw …; existing.add(pathspec);`. Apply the same shape to the directory loop so "max N" really means "at most N items observed/added."

### 29. 4. Validate glob-shape up-front instead of mid-loop
**File:** `src/flow/lib/test-artifacts.js`
**Issue:** `collectExistingArtifactPathspecs` validates `dir.includes("*")` inside the per-pattern loop, after it has already mutated `globPatternsByDir` for previous patterns. If a malformed pattern appears late in the list, partial state has already been built and discarded. The function also silently accepts patterns with `*` anywhere in the basename (treated as glob) but rejects them in the directory portion — that asymmetric rule deserves a single up-front guard.
**Suggestion:** Split into a small `parseArtifactPathspecPattern(pattern)` that returns `{ kind: "literal", pathspec } | { kind: "glob", dir, basenameRegex }` and throws on unsupported shapes. Validate all inputs first, then walk the parsed list. This also makes the literal vs. glob branches symmetric and testable.

### 30. 5. `FINAL_REGRESSION_RAW_OUTPUT_PATTERN` mixes "constant" and "glob" semantics under one name
**File:** `src/flow/lib/test-artifacts.js`
**Issue:** Other exported constants in this file are concrete file paths (`RAW_OUTPUT_RELATIVE`, `SCENARIO_VALIDITY_RAW_OUTPUT_RELATIVE`, `TEMP_SUMMARY_RELATIVE`). `FINAL_REGRESSION_RAW_OUTPUT_PATTERN` is a glob, which means consumers that previously used `path.join(specDir, FINAL_REGRESSION_RAW_OUTPUT_RELATIVE)` to read or write the file cannot use the new constant the same way. Co-locating both in the same module without distinguishing concerns invites misuse — someone will eventually `fs.writeFileSync(path.join(specDir, FINAL_REGRESSION_RAW_OUTPUT_PATTERN), …)` and emit a file literally named `final-regression-attempt-*.log`.
**Suggestion:** Encapsulate the convention behind a function rather than exporting the raw glob — for example `finalRegressionAttemptLogPath(specDir, attemptN)` that returns `tests/.raw/final-regression-attempt-${String(attemptN).padStart(3, "0")}.log`, plus a separate `finalRegressionAttemptLogGlob(specDir)` used only by the artifact collector. This also lets the zero-padding rule from R4 live in one place instead of being duplicated at every write site.

### 31. 6. `tempRequirementSummaryPath` / `writeTempRequirementSummary` / `removeTempRequirementSummary` triple — consider collapsing the write/remove
**File:** `src/flow/lib/test-artifacts.js`
**Issue:** Three exports for one file is fine when callers need both read paths and mutation; in this module `tempRequirementSummaryPath` is only used internally by the writer/remover (no external read consumer is visible in the diff). If that holds, exporting it widens the API surface for no benefit and makes future relocation harder.
**Suggestion:** Confirm whether any consumer reads `tempRequirementSummaryPath` directly; if not, drop the export and keep it as a module-private helper. If consumers do need it, fine — but then add a `readTempRequirementSummary` to keep the read/write/remove triple symmetric instead of letting callers reinvent the read path.

### 32. 1. Redundant guidance about ignoring prior `failureKind` is missing despite R8 requirement
**File:** `src/flow/prompts/impl/final-regression.md`
**Issue:** R8 explicitly requires the prompt to mention "absence of past failureKind in pass artifacts," but the revised text only says "Treat `final-regression-result.json` as current-run only." Readers may not infer from that phrasing that a PASS artifact intentionally omits any prior `failureKind` — which is the actionable point (don't look for, or carry over, a `failureKind` from earlier runs when reading a PASS result).
**Suggestion:** Add an explicit sentence such as: "On PASS, `final-regression-result.json` does not carry a `failureKind` from prior failed attempts — do not look for one or treat its absence as ambiguity." This directly satisfies R8 and removes interpretive burden from the reader.

### 33. 2. "Any other `failureKind` → stop" loses diagnostic specificity
**File:** `src/flow/prompts/impl/final-regression.md`
**Issue:** The previous version enumerated `infra_failure`, `timeout`, `dependency_failure`, `sandbox_restriction`, `permission_error`, `child_process_eprem`. Collapsing these into "Any other `failureKind`" is a simplification, but it also removes the only place in the prompt where the reader learns which kinds exist. If a new `failureKind` is added later, the catch-all silently absorbs it without prompting reconsideration. Given the project rule "alpha 期間中は後方互換コードを書かない" and the preference for explicit enumeration in guardrail-adjacent prompts, the loss of the kind list may be unintentional.
**Suggestion:** Either (a) re-list the infrastructural kinds explicitly with the same "stop" disposition so readers know the universe of values, or (b) add a short parenthetical such as "(e.g., `infra_failure`, `timeout`, `dependency_failure`, `sandbox_restriction`, `permission_error`, `child_process_eprem`)" after "Any other `failureKind`" to preserve the diagnostic vocabulary.

### 34. 3. "Independent signals" instruction is hard to act on without an example
**File:** `src/flow/prompts/impl/final-regression.md`
**Issue:** The new sentence "read … the fields `result`, `failureKind`, `retryable`, and `nextAction` as independent signals; do not infer one from another" states a rule but does not show what an inference mistake would look like. A reader who has been treating `failureKind` and `nextAction` as redundant will not know which inference is now forbidden.
**Suggestion:** Add a brief concrete example, e.g.: "For instance, do not assume `failureKind: caused_by_current_change` implies `nextAction: continue`, or that `nextAction: stop` implies an infrastructural `failureKind` — each field is set independently by the runner."

### 35. 4. Attempt-log retention guidance lacks an upper bound
**File:** `src/flow/prompts/impl/final-regression.md`
**Issue:** The prompt now instructs "do not delete or overwrite prior attempt logs" with a glob pattern `tests/.raw/final-regression-attempt-*.log`. Combined with the project's `bounded-resource-usage` guardrail (bulk data accumulation must have explicit upper bounds), unbounded retention of per-attempt logs across many spec iterations is a latent growth path. The prompt itself caps attempts at 2 per final-regression invocation, but says nothing about lifetime accumulation across reruns/specs.
**Suggestion:** Either (a) state the implicit bound explicitly — e.g., "At most 2 attempt logs per final-regression invocation are produced; older logs from earlier invocations are retained but bounded by spec lifetime" — or (b) reference where the retention bound is enforced (cleanup hook, finalize step). This anchors the retention rule to a concrete bound rather than an open-ended "do not delete."

### 36. 5. "STOP and return control to the user" duplicated across two bullets
**File:** `src/flow/prompts/impl/final-regression.md`
**Issue:** The directive to stop on `nextAction: "stop"` appears in three places: the "always honor `nextAction: stop`" clause, the `unattributed_existing_failure` bullet, the "Any other `failureKind`" bullet, and again in the final "STOP and return control to the user" sentence. The final sentence is the only one that explicitly mentions the 2-attempt cap, but the redundancy makes the actual rule (cap=2, stop on 2nd failure) harder to locate.
**Suggestion:** Consolidate into a single "Stop conditions" line near the top of the FAIL handling block: "Stop and return control to the user whenever `nextAction: "stop"` is set — this happens on `unattributed_existing_failure`, on any infrastructural `failureKind`, and unconditionally on the 2nd consecutive failed attempt (the cap)." Then drop the trailing duplicated sentence.

### 37. 1. `failureKind` の enum 定義が二重化している
**File:** `src/flow/schemas/next-action/final-regression.schema.json`
**Issue:** `properties.failureKind.enum`（9 値 + `null`）と `allOf[1].then.properties.failureKind.enum`（9 値）で同じ失敗種別の列挙が二重に書かれている。今後失敗種別を追加するたびに 2 箇所を同期する必要があり、片方を更新し忘れる典型的なバグ源になる。実際 R2 の改修で 1 つでも漏れがあれば、結果検証が片側でしか効かない。
**Suggestion:** JSON Schema の `$defs` に `failureKindValue`（9 値）を 1 つだけ定義し、トップ側は `{ "oneOf": [{ "$ref": "#/$defs/failureKindValue" }, { "type": "null" }] }`、`allOf` 側は `{ "$ref": "#/$defs/failureKindValue" }` のように参照させて単一の真実の源にする。

### 38. 2. `nextAction` の enum 定義も二重化している
**File:** `src/flow/schemas/next-action/final-regression.schema.json`
**Issue:** トップ `properties.nextAction.enum` に 5 値（`finalize-commit` を含む）、`allOf[1].then.properties.nextAction.enum` に 4 値（`finalize-commit` を除く）と、ほぼ同じ列挙が分散している。意味的には「pass のときは `finalize-commit` のみ／fail のときはそれ以外」だが、その制約を「列挙の差分」で表現しているため、新しい遷移を増やすと両方を整合させる必要がある。
**Suggestion:** 全 `nextAction` 値を `$defs.nextActionValue` として 1 箇所に列挙し、`allOf` ブランチ内ではトップ列挙との差分（`const`／`enum`）だけで「どれが許可される遷移か」を表現する。例：pass 側は `nextAction: { "const": "finalize-commit" }`、fail 側は `nextAction: { "not": { "const": "finalize-commit" } }` のように、許可集合ではなく制約として書くことで列挙の重複をなくす。

### 39. 3. `pass` の場合に `failureKind: null` を `required` で強制できていない
**File:** `src/flow/schemas/next-action/final-regression.schema.json`
**Issue:** トップの `required` に `failureKind` を追加した一方で、`properties.failureKind.type` は `["string", "null"]` のまま。`allOf[0].then` で `pass` 時に `failureKind: null` を要求しているが、`required` の指定がないため、`pass` でも `failureKind` プロパティが完全に欠落している envelope を検出できない（`then` の `properties` 制約は欠落キーには適用されないため）。R7 で「`result`/`failureKind`/`retryable`/`nextAction` を別エントリで保持する」ことを要件にしているのに、欠落を schema が検出できないのは要件のガードとして不十分。
**Suggestion:** `allOf[0].then` と `allOf[1].then` の双方で `"required": ["failureKind", "retryable", "nextAction"]` を明示する（あるいはトップ `required` で十分網羅されていることを再確認する）。少なくとも `failureKind` の存在を `pass`/`fail` 両ケースで明確に要求し、`null` であっても「キーが存在し値が null」を保証する。

### 40. 4. allOf の `if` がトートロジー的に `required: ["result"]` を再宣言している
**File:** `src/flow/schemas/next-action/final-regression.schema.json`
**Issue:** トップ `required` に既に `result` が含まれているため、`allOf[*].if.required: ["result"]` は重複した安全策で、読み手にとってノイズになる。`if` 内で `required` を再宣言すべきなのは「トップで required にしていないがブランチ分岐の判定材料にしたい」場合に限る。
**Suggestion:** `if` 節からは `required` を削除し、`{ "properties": { "result": { "const": "pass" } } }` のみで分岐させる（トップ required で `result` の存在は保証される）。スキーマの意図が読み取りやすくなる。

### 41. 1. Reuse `failingFixtureBody` helper across all failure-fixture tests
**File:** `tests/unit/flow/final-regression.test.js`
**Issue:** The new `failingFixtureBody` helper centralizes the "console.error + exit(1)" boilerplate, but two existing tests still inline the same shape:
- `"console.log('about to exit');\nprocess.exit(2);\n"` in the silent non-zero exit test
- `writeChangedFileReferencingFailureFixture(tmp, "still failing")` is fine, but the `"current change"` test still inlines its own variant via `writeChangedFileReferencingFailureFixture` plus the initial body literal.

More directly, the `"console.log('about to exit');\nprocess.exit(2);\n"` literal in the silent non-zero exit test duplicates the failure-script pattern that `failingFixtureBody` was introduced to abstract.
**Suggestion:** Extend `failingFixtureBody` (e.g. add an optional `exitCode` parameter or add a sibling helper `exitingFixtureBody(message, code)`) and use it in the silent non-zero exit test so all `process.exit(N)` fixtures flow through one constructor. This eliminates the remaining inline duplication and makes the intent (`exitCode = 2`) explicit.

### 42. 2. Drop redundant envelope assertions when using the combined helper
**File:** `tests/unit/flow/final-regression.test.js`
**Issue:** `assertFinalRegressionFailure` already calls `assertFinalRegressionEnvelopeFailure` (which asserts `envelope.ok === false`), so the separate `assert.equal(result.errors[0].code, "FINAL_REGRESSION_FAILED")` in the "current-change failure" test is the only envelope-shape assertion left outside the helper — but `result.ok === false` is asserted twice indirectly. More importantly, the helper exposes three functions (`assertFinalRegressionEnvelopeFailure`, `assertFinalRegressionArtifactFailure`, `assertFinalRegressionFailure`) where only the combined one is used in this file.
**Suggestion:** Inline `assertFinalRegressionEnvelopeFailure` and `assertFinalRegressionArtifactFailure` into `assertFinalRegressionFailure` (or mark them non-exported locals only if a future test legitimately needs to split envelope vs artifact assertions). Removing the two unused-at-call-site helpers shrinks the API surface and follows the project's "depth over thin wrappers" guidance.

### 43. 3. Extract attempt-log existence assertion
**File:** `tests/unit/flow/final-regression.test.js`
**Issue:** `assert.ok(fs.existsSync(path.join(tmp, attemptLogPath(N))))` appears 3+ times across the pass test, attempt-logs test, and worktree-root test. This is the third repetition of the same composition (`path.join` + `existsSync` + `attemptLogPath`).
**Suggestion:** Add a small helper, e.g.:
```js
function assertAttemptLogExists(tmp, n) {
  assert.ok(fs.existsSync(path.join(tmp, attemptLogPath(n))), `attempt ${n} log missing`);
}
```
Use it in all three places. Per CLAUDE.md ("2箇所以上で繰り返される場合、共通ヘルパーに抽出"), this duplication already qualifies.

### 44. 4. Test name no longer matches its scope
**File:** `tests/unit/flow/final-regression.test.js`
**Issue:** The renamed test `"stops on the second final-regression failure and omits previous failure state"` bundles two distinct guarantees: the stop-on-second-failure transition (R7-ish) and the `previousFailureKind` removal (R3). The mixed assertion makes the failure report ambiguous when only one regresses.
**Suggestion:** Split into two `it(...)` blocks — one focused on the stop transition, one focused on `previousFailureKind` absence — or rename to reflect that the second-attempt scenario is the carrier for the R3 check (e.g. `"second final-regression failure stops and the artifact contains only current-invocation state"`). Splitting is preferable since R3 is also separately enforced.

### 45. 5. `SPEC_DIR` constant not propagated to fixture/spec strings everywhere
**File:** `tests/unit/flow/final-regression.test.js`
**Issue:** `attemptLogPath` interpolates `SPEC_DIR`, but the pass test still hard-codes the resulting string `"specs/001-test/tests/.raw/final-regression-attempt-001.log"` for comparison. If `SPEC_DIR` ever changes, this assertion silently desyncs.
**Suggestion:** Replace the literal with `attemptLogPath(1)` in the pass-test assertion so all spec-relative paths derive from the single constant.

### 46. 1. `extractExecuteCommitPost` is no longer used by any test and should be inlined or removed
**File:** `tests/unit/flow/run-finalize-retro-commit-scope.test.js`
**Issue:** After the refactor, the only caller of `extractExecuteCommitPost` is the new `readExecuteCommitPostBodySource` wrapper. The two-function indirection (`readRunFinalizeSource` → `extractExecuteCommitPost` → `readExecuteCommitPostBodySource`) adds a layer without value: there is exactly one site (`readExecuteCommitPostBodySource`) that calls both, and the wrapper itself has only two call sites. Per the project's "不要な間接層禁止" preference, this is over-layered.
**Suggestion:** Either (a) drop `readExecuteCommitPostBodySource` and have each test call `extractExecuteCommitPost(readRunFinalizeSource())` directly, or (b) merge `readRunFinalizeSource` + `extractExecuteCommitPost` into a single `readExecuteCommitPostBodySource()` helper. Option (b) is cleaner since `readRunFinalizeSource` is now only used to feed the extractor.

### 47. 2. Test describe block title no longer matches its contents
**File:** `tests/unit/flow/run-finalize-retro-commit-scope.test.js`
**Issue:** The first `describe("run-finalize retro/report commit scope (regression for issue #197)", ...)` block now contains a test for `collectExistingArtifactPathspecs` (a pure helper from `test-artifacts.js`) that has nothing to do with run-finalize source inspection. The new `describe("test-artifacts", ...)` block was added for the new helpers, but the `collectExistingArtifactPathspecs` test was left in the old block. This makes the grouping incoherent.
**Suggestion:** Move the `"collectExistingArtifactPathspecs filters missing artifact files before staging"` test into the `describe("test-artifacts", ...)` block, so the regression-scoped describe contains only the two source-inspection tests and the new describe contains all pure-helper tests.

### 48. 3. Hard-coded full pathspec list duplicates production data and is brittle
**File:** `tests/unit/flow/run-finalize-retro-commit-scope.test.js`
**Issue:** The assertion in `"durableTestArtifactPathspecs scopes artifact pathspecs under the requested spec"` uses `assert.deepEqual` against a hand-written 10-entry list of literal paths. Any future change to the durable-artifact set (adding/removing one path) requires editing this list to match exactly, and the test asserts both content **and** ordering with no comment explaining whether ordering is part of the contract. This is a brittle mirror of the production constant.
**Suggestion:** Either (a) assert only the structural contract the test cares about (every entry starts with `"specs/001/"`, the set includes the key artifacts named in R4/R8 such as `final-regression-attempt-*.log`), using `assert.ok(pathspecs.includes(...))` like the sibling test already does; or (b) keep the full-list assertion but use `assert.deepEqual([...pathspecs].sort(), [...expected].sort())` and add a comment that the canonical list lives in `test-artifacts.js`.

### 49. 4. Inconsistent assertion style across sibling tests
**File:** `tests/unit/flow/run-finalize-retro-commit-scope.test.js`
**Issue:** `durableTestArtifactPathspecs` test uses strict `deepEqual` on the whole list, while `implementationCommitExcludedTestArtifactPathspecs` test uses `assert.ok(pathspecs.includes(...))` on two entries. Both functions are pure helpers returning string arrays — the assertion style should be consistent, or the divergence should be justified.
**Suggestion:** Pick one style. Given R4/R8 only constrain specific entries (the `final-regression-attempt-*.log` pattern and that artifacts live under the spec dir), the `includes`-style is the better fit for both tests; the exhaustive list belongs in a snapshot or in the `test-artifacts.js` module's own self-documenting constant.
