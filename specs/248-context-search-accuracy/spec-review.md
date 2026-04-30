# Spec Review Results

## Proposals

### 1. I’ll inspect the scoped modules plus nearby tests/templates/config references, then compare the spec’s coverage against actual call sites and generated assets. No code changes are needed for this review.The worktree root given in the prompt appears to be a `.tmp` directory with no file listing from `rg`. I’m checking the immediate directory shape while staying inside the declared worktree path.This directory contains only a zero-byte `.codex` marker, so the actual repository files are not present under the allowed worktree path. I’m checking whether Git sees a worktree from here; if not, the review has to be limited to gaps inferable from the spec text itself.Git reports the repository root one level above `.tmp`, so I’ll read files via `../…` without modifying anything. That keeps the review grounded in the actual worktree contents.I found the expected scope files and several test suites that assert current context search behavior. I’m narrowing the read to the prompt builders, search pipeline, schema, and plan prompt so the proposals are tied to concrete files.### 1. Scope paths are not wired into `contextSearch`
**File:** `src/flow/commands/review.js`  
**Issue:** R6 makes `extractGoalAndScope()` return only `spec.keywords.join(" ")` when keywords exist, but R7 requires `scope.in` path matching. `contextSearch()` only receives a query string, so it cannot access `spec.scope.in` unless `review.js` passes or merges that data separately.  
**Suggestion:** Specify the wiring explicitly: either `review.js` performs scope-path matching/import expansion alongside keyword search, or the query construction includes scope paths in a documented parseable form while keeping the public `contextSearch` signature unchanged.

### 2. 2. `review-draft` cannot use `spec.keywords`
**File:** `src/flow/commands/review.js`  
**Issue:** The goal includes `review-draft`, but `runDraftReview()` searches with `draftJson.goal || requestText`; `spec.keywords` does not exist yet during draft review. The spec only defines keyword-based extraction for spec review.  
**Suggestion:** Add a requirement for draft review’s query strategy, or clarify that `review-draft` token savings come only from removing `detail` and sorted/trimmed context output.

### 3. 3. `importedBy` does not exist in analysis output
**File:** `src/docs/commands/scan.js`  
**Issue:** R8 defines hub detection as `imports.length + importedBy.length`, but the scanner populates reverse dependencies as `usedBy`, not `importedBy`.  
**Suggestion:** Change the spec to use `usedBy.length` for connection count, or add an explicit requirement to generate/rename an `importedBy` field in analysis entries.

### 4. 4. Scores for scope/import/fallback results are undefined
**File:** `src/flow/lib/get-context.js`  
**Issue:** R10 requires all results, including import-expanded entries, to be sorted by score. But R7/R8 do not define scores for scope path matches or import-expanded entries, and fallback/AI search currently returns unscored entries.  
**Suggestion:** Define an internal candidate scoring model, including default scores for scope matches, fallback/AI matches, import expansion, and tie-break ordering, while keeping returned result shape unchanged.

### 5. 5. `imports` and `methods` are optional/null in analysis entries
**File:** `src/presets/cli/data/modules.js`  
**Issue:** R4 assumes every entry has countable `imports` and `methods`, but many analysis entry classes do not define them, and `ModuleEntry` initializes them as `null`. The spec also does not define behavior when `maxImports` or `maxMethods` is zero.  
**Suggestion:** Specify normalization rules: non-arrays count as `0`, max denominators of `0` produce a `0` bonus, and only arrays participate in the scoring bonus.

### 6. 6. N-gram search tests are not covered by the spec
**File:** `tests/unit/flow/get-context-ngram.test.js`  
**Issue:** Existing tests assert the old whole-query bigram behavior and do not cover multi-match selection, score bonuses, min/max result counts, scope matches, or import expansion.  
**Suggestion:** Add test requirements for R3-R8, ideally with synthetic entries that verify word-level bigram matching, `matchCount`, dynamic N, hub exclusion, and import expansion.

### 7. 7. Schema property-list test will fail
**File:** `tests/unit/spec/schema.test.js`  
**Issue:** This test asserts the exact set of allowed `spec.schema.json` properties. Adding optional `keywords` will fail unless the expected list is updated.  
**Suggestion:** Add explicit schema test requirements: `keywords` appears in `properties`, is optional, accepts `string[]`, rejects non-string items, and existing specs without `keywords` still validate.

### 8. 8. Review prompt helper behavior lacks tests
**File:** `tests/unit/flow/commands/review.test.js`  
**Issue:** `extractGoalAndScope`, `buildSpecReviewPrompt`, and `buildDraftReviewPrompt` are exported, but current tests do not verify keyword preference, English-word fallback, `detail` removal, or the relatedness-order sentence.  
**Suggestion:** Add unit test requirements for R6, R9, and R11 in this file.

### 9. 9. Rendered spec visibility for `keywords` is unspecified
**File:** `src/spec/commands/render.js`  
**Issue:** `spec render` produces `spec.md` from `spec.json`, but the spec does not say whether `keywords` should be rendered or intentionally hidden. If hidden, humans cannot review/correct generated keywords from `spec.md`.  
**Suggestion:** Clarify whether `keywords` is internal metadata only. If it should be human-visible, add a `## Keywords` rendering requirement and corresponding render tests.
