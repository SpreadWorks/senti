# Test Design

### Test Design

- **TC-1: normalize lowercases and tokenizes basic text**
  - Type: unit
  - Input: `"The QUICK brown fox"`
  - Expected: returns `Set { "quick", "brown", "fox" }`; stopword `"the"` removed.

- **TC-2: normalize removes punctuation but preserves hyphens**
  - Type: unit
  - Input: `"REQ-7: foo-bar, baz!"`
  - Expected: returns `Set { "req-7", "foo-bar", "baz" }`.

- **TC-3: normalize excludes punctuation-only and hyphen-only tokens**
  - Type: unit
  - Input: `"--- -- !! ... foo"`
  - Expected: returns `Set { "foo" }`; hyphen-only tokens are excluded because they contain no `\w`.

- **TC-4: normalize filters short tokens**
  - Type: unit
  - Input: `"a x i 1 _ ok aa"`
  - Expected: returns `Set { "ok", "aa" }`; one-character tokens are removed.

- **TC-5: normalize removes all STOPWORDS**
  - Type: unit
  - Input: all 30 stopwords in mixed case.
  - Expected: returns an empty `Set`.

- **TC-6: normalize deduplicates tokens**
  - Type: unit
  - Input: `"Fail fail FAIL failed"`
  - Expected: returns `Set { "fail", "failed" }`.

- **TC-7: normalize handles non-string input through String(text)**
  - Type: unit
  - Input: `12345`, `null`, `undefined`
  - Expected: returns normalized tokens from `"12345"`, `"null"`, `"undefined"` without throwing.

- **TC-8: normalize empty or punctuation-only input**
  - Type: unit
  - Input: `""`, `"   "`, `"!!!"`
  - Expected: returns empty `Set`.

- **TC-9: jaccard returns 0 for two empty sets**
  - Type: unit
  - Input: `new Set()`, `new Set()`
  - Expected: returns `0`.

- **TC-10: jaccard returns 0 when only one set is empty**
  - Type: unit
  - Input: `Set { "a" }`, empty `Set`
  - Expected: returns `0`.

- **TC-11: jaccard returns 1 for identical sets**
  - Type: unit
  - Input: `Set { "alpha", "beta" }`, `Set { "alpha", "beta" }`
  - Expected: returns `1`.

- **TC-12: jaccard returns raw unrounded float**
  - Type: unit
  - Input: `Set { "a", "b" }`, `Set { "b", "c" }`
  - Expected: returns `1 / 3`, not rounded.

- **TC-13: buildFailedEvaluations keeps existing FAIL-only behavior**
  - Type: unit
  - Input: mixed evaluations containing `PASS`, `FAIL`, and other statuses.
  - Expected: returns only failed evaluations with required fields preserved.

- **TC-14: findPreviousFailedEvaluations returns [] when issueLog is missing**
  - Type: unit
  - Input: `{ issueLog: null, phase: "plan" }`
  - Expected: returns `[]`, not `null`.

- **TC-15: findPreviousFailedEvaluations ignores phase mismatches**
  - Type: unit
  - Input: entries with failed evaluations for other phases only.
  - Expected: returns `[]`.

- **TC-16: findPreviousFailedEvaluations skips empty or legacy entries**
  - Type: unit
  - Input: matching phase entries with missing, `null`, or empty `failedEvaluations`.
  - Expected: returns `[]`.

- **TC-17: findPreviousFailedEvaluations flattens all matching entries in order**
  - Type: unit
  - Input: multiple matching phase entries, each with one or more failed evaluations.
  - Expected: returns one flattened array preserving issueLog entry order and inner failedEvaluation order.

- **TC-18: assertNoRepeatedFail no-ops for untracked phase**
  - Type: unit
  - Input: phase not in `RETRY_TRACKED_PHASES`, repeated similar failures present.
  - Expected: does not throw.

- **TC-19: assertNoRepeatedFail ignores current non-FAIL evaluations**
  - Type: unit
  - Input: current evaluations with similar reason but status not `FAIL`.
  - Expected: does not throw.

- **TC-20: assertNoRepeatedFail ignores prior failures with different guardrail_id**
  - Type: unit
  - Input: current `FAIL` similar to prior reason, but guardrail IDs differ.
  - Expected: does not throw.

- **TC-21: assertNoRepeatedFail escalates high-similarity repeated failure**
  - Type: unit
  - Input: prior/current `FAIL` with same `guardrail_id`, normalized Jaccard >= `0.5`.
  - Expected: throws `Error` with `code = "ESCALATE_REPEATED_FAIL"`.

- **TC-22: assertNoRepeatedFail does not escalate low-similarity failure**
  - Type: unit
  - Input: same `guardrail_id`, normalized Jaccard < `0.5`.
  - Expected: does not throw.

- **TC-23: assertNoRepeatedFail escalates exact boundary similarity**
  - Type: unit
  - Input: same `guardrail_id`, normalized Jaccard exactly `0.5`.
  - Expected: throws repeated-fail escalation error.

- **TC-24: assertNoRepeatedFail selects max similarity among multiple priors**
  - Type: unit
  - Input: one current `FAIL`, several prior failures with same `guardrail_id`.
  - Expected: `err.data.matched[0].priorReason` is from the prior with highest similarity.

- **TC-25: assertNoRepeatedFail tie-breaks by prior traversal order**
  - Type: unit
  - Input: one current `FAIL`, multiple equal max-similarity priors.
  - Expected: first matching prior in flattened order is used.

- **TC-26: assertNoRepeatedFail preserves matched order by current FAIL order**
  - Type: unit
  - Input: multiple current failed evaluations that each repeat prior failures.
  - Expected: `err.data.matched` order follows current evaluation order.

- **TC-27: assertNoRepeatedFail error data shape**
  - Type: unit
  - Input: repeated similar failure.
  - Expected: `err.data = { phase, matched }`; each match includes `guardrail_id`, `currentReason`, `priorReason`, and raw numeric `similarity`.

- **TC-28: assertNoRepeatedFail error message contains useful diagnostics**
  - Type: unit
  - Input: repeated similar failure in phase `"plan"` with guardrail `"REQ-7"`.
  - Expected: message contains phase value, `"similar"` or `"jaccard"`, guardrail ID, current reason, prior reason, and similarity displayed with two decimals.

- **TC-29: synthetic high-similarity scenario escalates**
  - Type: integration
  - Input: 3-5 prior/current reason pairs about deleting tests without approval, designed so every pair has Jaccard >= `0.5`.
  - Expected: `assertNoRepeatedFail` escalates all matching current failures.

- **TC-30: synthetic low-similarity scenario does not escalate**
  - Type: integration
  - Input: 3-5 prior/current reason pairs with unrelated topics and vocabulary, all Jaccard < `0.5`.
  - Expected: no escalation.

- **TC-31: synthetic boundary scenario escalates at threshold**
  - Type: integration
  - Input: pair whose normalized token sets produce exactly `0.5` Jaccard.
  - Expected: escalation occurs.

- **TC-32: obsolete exports are removed**
  - Type: unit
  - Input: import module namespace from `src/flow/lib/run-gate.js`.
  - Expected: `normalize` and `jaccard` are named exports; `normalizeReason` and `buildFailPairKey` are not exported.

- **TC-33: repeated failure behavior across full issueLog fixture**
  - Type: acceptance
  - Input: realistic issueLog with old entries, unrelated phases, empty entries, and multiple prior failures.
  - Expected: only same-phase prior failed evaluations participate; repeated similar current failure escalates with correct matched metadata.

- **TC-34: plan-phase gate guard fixture uses genuinely different reasons**
  - Type: acceptance
  - Input: REQ-3 scenario using reasons like `"critical infra blocker"` vs `"unrelated coverage gap"`.
  - Expected: normalized Jaccard is below threshold and the existing “different reason does not escalate” intent remains valid.
