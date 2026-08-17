# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Bound generated header findings
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`  
**Issue:** `buildHeaderBlockingFindings()` iterates over every array in `headerResult` without an explicit cap. A malformed or huge `test-coverage.json` could produce unbounded findings, violating the bounded-resource-usage guardrail.  
**Suggestion:** Add a shared maximum, such as `MAX_HEADER_BLOCKING_FINDINGS`, stop after that count, and optionally append one summary finding indicating additional failures were omitted.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Issue:** `buildHeaderBlockingFindings()` iterates over every array in `headerResult` without an explicit cap. A malformed or huge `test-coverage.json` could produce unbounded findings, violating the bounded-resource-usage guardrail.  
**Suggestion:** Add a shared maximum, such as `MAX_HEADER_BLOCKING_FINDINGS`, stop after that count, and optionally append one summary finding indicating additional failures were omitted.
**Rationale:** Loop review proposal.

### 2. 2. Prevent metadata override in header finding factory
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`  
**Issue:** `headerFinding()` sets `origin` and `failureKind` before spreading `item`, so a future caller could accidentally override the structured metadata.  
**Suggestion:** Reverse the spread order:

```js
const headerFinding = (failureKind, item) => new TestReviewFinding("blocking", {
  ...item,
  origin: "test-coverage",
  failureKind,
});
```
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Issue:** `headerFinding()` sets `origin` and `failureKind` before spreading `item`, so a future caller could accidentally override the structured metadata.  
**Suggestion:** Reverse the spread order:

```js
const headerFinding = (failureKind, item) => new TestReviewFinding("blocking", {
  ...item,
  origin: "test-coverage",
  failureKind,
});
```
**Rationale:** Loop review proposal.

### 3. 3. Extract optional string normalization
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`  
**Issue:** `origin` and `failureKind` duplicate the same trim/non-empty normalization logic.  
**Suggestion:** Add a small helper, for example `normalizeOptionalTestReviewText(value)`, and use it for both fields to keep future optional structured fields consistent.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Issue:** `origin` and `failureKind` duplicate the same trim/non-empty normalization logic.  
**Suggestion:** Add a small helper, for example `normalizeOptionalTestReviewText(value)`, and use it for both fields to keep future optional structured fields consistent.
**Rationale:** Loop review proposal.

### 4. 4. Reduce repeated header-finding loop structure
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`  
**Issue:** `buildHeaderBlockingFindings()` now repeats the same pattern for every header error type: read array, map entry, create blocking finding with a `failureKind`.  
**Suggestion:** Consider a descriptor table with `{ key, failureKind, buildItem }` entries and one loop over descriptors. That would make it harder for future header failure types to forget `origin` or `failureKind`.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Issue:** `buildHeaderBlockingFindings()` now repeats the same pattern for every header error type: read array, map entry, create blocking finding with a `failureKind`.  
**Suggestion:** Consider a descriptor table with `{ key, failureKind, buildItem }` entries and one loop over descriptors. That would make it harder for future header failure types to forget `origin` or `failureKind`.
**Rationale:** Loop review proposal.

### 5. 1. Avoid Unbounded Deferred Source Scanning
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `deferredSourceBlockers` iterates every deferred finding and `sourceIncludesFindingId` stringifies each source artifact. The new processing path has no visible upper bound on finding count or serialized source size.  
**Suggestion:** Enforce an explicit cap before scanning, or rely on and document a bounded normalized deferred-findings collection. Prefer checking structured fields over `JSON.stringify(...).includes(...)`.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `deferredSourceBlockers` iterates every deferred finding and `sourceIncludesFindingId` stringifies each source artifact. The new processing path has no visible upper bound on finding count or serialized source size.  
**Suggestion:** Enforce an explicit cap before scanning, or rely on and document a bounded normalized deferred-findings collection. Prefer checking structured fields over `JSON.stringify(...).includes(...)`.
**Rationale:** Loop review proposal.

### 6. 2. Replace Broad String Matching With Structured Lookup
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `sourceIncludesFindingId` can produce false positives by matching the finding ID anywhere in the serialized artifact, including unrelated fields or substrings.  
**Suggestion:** Inspect the expected source artifact shape directly and compare against finding ID fields exactly, for example by walking known finding arrays and matching `id === sourceFindingId`.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `sourceIncludesFindingId` can produce false positives by matching the finding ID anywhere in the serialized artifact, including unrelated fields or substrings.  
**Suggestion:** Inspect the expected source artifact shape directly and compare against finding ID fields exactly, for example by walking known finding arrays and matching `id === sourceFindingId`.
**Rationale:** Loop review proposal.

### 7. 3. Align Helper Naming With Existing Classifier Pattern
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `deferredSourceBlockers` returns mechanical blockers but is named like a data accessor rather than a classifier/build step.  
**Suggestion:** Rename it to something like `classifyDeferredSourceBlockers` or `buildDeferredSourceBlockers` to match `classifyMechanicalBlockers` and make the returned type clearer.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `deferredSourceBlockers` returns mechanical blockers but is named like a data accessor rather than a classifier/build step.  
**Suggestion:** Rename it to something like `classifyDeferredSourceBlockers` or `buildDeferredSourceBlockers` to match `classifyMechanicalBlockers` and make the returned type clearer.
**Rationale:** Loop review proposal.

### 8. 1. Combine Finding Sources Before Classification
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `failedGateFindings()` now returns `blockingFindings` immediately when present, skipping failed `evaluations` and `observations`. That can hide structured coverage/header failures if `blockingFindings` contains only semantic findings.  
**Suggestion:** Build one combined findings list from `blockingFindings`, failed `evaluations`, and `observations`, then classify across the full set.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `failedGateFindings()` now returns `blockingFindings` immediately when present, skipping failed `evaluations` and `observations`. That can hide structured coverage/header failures if `blockingFindings` contains only semantic findings.  
**Suggestion:** Build one combined findings list from `blockingFindings`, failed `evaluations`, and `observations`, then classify across the full set.
**Rationale:** Loop review proposal.

### 9. 2. Add Explicit Bounds When Collecting Findings
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `failedGateFindings()` can return unbounded arrays from `blockingFindings`, `evaluations`, or `observations`, which conflicts with the `bounded-resource-usage` guardrail and R6’s bounded deferred-finding references.  
**Suggestion:** Apply a shared max findings constant when collecting/classifying retry-exhausted findings, and ensure downstream deferred references are capped consistently.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `failedGateFindings()` can return unbounded arrays from `blockingFindings`, `evaluations`, or `observations`, which conflicts with the `bounded-resource-usage` guardrail and R6’s bounded deferred-finding references.  
**Suggestion:** Apply a shared max findings constant when collecting/classifying retry-exhausted findings, and ensure downstream deferred references are capped consistently.
**Rationale:** Loop review proposal.

### 10. 1. Clarify semantic classification name
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `isReviewSemanticFinding()` currently means “not a structured mechanical finding,” which is broader than proving the finding is semantic. That name can mislead future changes into treating unknown structured values as positively semantic.  
**Suggestion:** Rename it to something like `isDeferableReviewFinding()` or `isNotStructuredMechanicalReviewFinding()`, and keep the defer-specific intent local to `tryDeferReviewRetryExhaustion()`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `isReviewSemanticFinding()` currently means “not a structured mechanical finding,” which is broader than proving the finding is semantic. That name can mislead future changes into treating unknown structured values as positively semantic.  
**Suggestion:** Rename it to something like `isDeferableReviewFinding()` or `isNotStructuredMechanicalReviewFinding()`, and keep the defer-specific intent local to `tryDeferReviewRetryExhaustion()`.
**Rationale:** Loop review proposal.

### 11. 2. Reduce duplicated failure-mode checks
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `isStructuredReviewMechanicalFinding()` normalizes and checks `failureKind` and `failureMode` separately against the same set. This duplicates the membership logic and makes future structured fields easier to miss.  
**Suggestion:** Use a small helper or array check, for example normalize the candidate fields into an array and return `modes.some(mode => REVIEW_STRUCTURED_MECHANICAL_FAILURE_MODES.has(mode))`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `isStructuredReviewMechanicalFinding()` normalizes and checks `failureKind` and `failureMode` separately against the same set. This duplicates the membership logic and makes future structured fields easier to miss.  
**Suggestion:** Use a small helper or array check, for example normalize the candidate fields into an array and return `modes.some(mode => REVIEW_STRUCTURED_MECHANICAL_FAILURE_MODES.has(mode))`.
**Rationale:** Loop review proposal.

### 12. 3. Make coverage artifact helper more specific
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `reviewArtifactHasStructuredCoverageFailure()` sounds generic, but it specifically reads `test-coverage.json` and checks `validation.ok === false`.  
**Suggestion:** Rename it to `testCoverageArtifactHasValidationFailure()` or similar so callers can immediately see that this is the test-review coverage artifact path, not a general review artifact inspection.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `reviewArtifactHasStructuredCoverageFailure()` sounds generic, but it specifically reads `test-coverage.json` and checks `validation.ok === false`.  
**Suggestion:** Rename it to `testCoverageArtifactHasValidationFailure()` or similar so callers can immediately see that this is the test-review coverage artifact path, not a general review artifact inspection.
**Rationale:** Loop review proposal.

### 13. 1. Add Explicit Bounds For Deferred Artifact Reads
**Failure mode:** refactor
**File:** src/flow/prompts/impl/acceptance-review.md
**Issue:** **File:** `src/flow/prompts/impl/acceptance-review.md`
**Issue:** The prompt now instructs acceptance-review to read `flow-findings.json` and source artifacts referenced by deferred findings, but it does not define limits on finding count, artifact count, artifact size, or total loaded content. This violates the bounded-resource-usage guardrail.
**Suggestion:** Add explicit caps, for example: maximum deferred findings processed, maximum source artifacts per finding, maximum bytes/characters per artifact, and maximum total loaded content. Also specify the fallback behavior when limits are exceeded, such as producing `blocked` with a clear rationale.
**Suggestion:** **File:** `src/flow/prompts/impl/acceptance-review.md`
**Issue:** The prompt now instructs acceptance-review to read `flow-findings.json` and source artifacts referenced by deferred findings, but it does not define limits on finding count, artifact count, artifact size, or total loaded content. This violates the bounded-resource-usage guardrail.
**Suggestion:** Add explicit caps, for example: maximum deferred findings processed, maximum source artifacts per finding, maximum bytes/characters per artifact, and maximum total loaded content. Also specify the fallback behavior when limits are exceeded, such as producing `blocked` with a clear rationale.
**Rationale:** Loop review proposal.

### 14. 2. Make `finalDisposition` Values Explicit
**Failure mode:** refactor
**File:** src/flow/prompts/impl/acceptance-review.md
**Issue:** **File:** `src/flow/prompts/impl/acceptance-review.md`
**Issue:** “Deferred findings must receive a bounded `finalDisposition`” says the value is bounded, but does not name the allowed values. That leaves room for inconsistent string values in `flow-findings.json`.
**Suggestion:** Enumerate the allowed `finalDisposition` values in the prompt, or refer directly to the existing schema-defined enum if one exists.
**Suggestion:** **File:** `src/flow/prompts/impl/acceptance-review.md`
**Issue:** “Deferred findings must receive a bounded `finalDisposition`” says the value is bounded, but does not name the allowed values. That leaves room for inconsistent string values in `flow-findings.json`.
**Suggestion:** Enumerate the allowed `finalDisposition` values in the prompt, or refer directly to the existing schema-defined enum if one exists.
**Rationale:** Loop review proposal.

### 15. 1. Preserve Explicit Retry Bound
**Failure mode:** refactor
**File:** src/flow/prompts/impl/impl-gate.md
**Issue:** **File:** `src/flow/prompts/impl/impl-gate.md`  
**Issue:** The updated text says “At semantic retry exhaustion” but removes the explicit `maxAttempts` bound that previously made retry behavior concrete. This weakens bounded-resource clarity and may violate the `bounded-resource-usage` guardrail.  
**Suggestion:** Reintroduce the bound while keeping the new deferral behavior, e.g. “If semantic gate retries are exhausted within the definition’s `maxAttempts` limit, unresolved gate findings are recorded…”
**Suggestion:** **File:** `src/flow/prompts/impl/impl-gate.md`  
**Issue:** The updated text says “At semantic retry exhaustion” but removes the explicit `maxAttempts` bound that previously made retry behavior concrete. This weakens bounded-resource clarity and may violate the `bounded-resource-usage` guardrail.  
**Suggestion:** Reintroduce the bound while keeping the new deferral behavior, e.g. “If semantic gate retries are exhausted within the definition’s `maxAttempts` limit, unresolved gate findings are recorded…”
**Rationale:** Loop review proposal.

### 16. 2. Keep CLI Outcome Naming Consistent
**Failure mode:** refactor
**File:** src/flow/prompts/impl/impl-gate.md
**Issue:** **File:** `src/flow/prompts/impl/impl-gate.md`  
**Issue:** The previous instruction named the CLI outcome `ESCALATE_RETRY_EXHAUSTED`; the new wording replaces it with prose only. That makes this prompt less consistent with CLI-facing instructions and harder to trace mechanically.  
**Suggestion:** Mention the CLI code alongside the semantic behavior, e.g. “When the CLI returns `ESCALATE_RETRY_EXHAUSTED` for semantic findings…”
**Suggestion:** **File:** `src/flow/prompts/impl/impl-gate.md`  
**Issue:** The previous instruction named the CLI outcome `ESCALATE_RETRY_EXHAUSTED`; the new wording replaces it with prose only. That makes this prompt less consistent with CLI-facing instructions and harder to trace mechanically.  
**Suggestion:** Mention the CLI code alongside the semantic behavior, e.g. “When the CLI returns `ESCALATE_RETRY_EXHAUSTED` for semantic findings…”
**Rationale:** Loop review proposal.

### 17. 1. Preserve the Explicit Retry-Exceeded Trigger
**Failure mode:** refactor
**File:** src/flow/prompts/impl/impl-review.md
**Issue:** **File:** `src/flow/prompts/impl/impl-review.md`  
**Issue:** The updated text removes the concrete `REVIEW_MAX_ATTEMPTS_EXCEEDED` condition and payload details, replacing them with the vaguer phrase “At semantic retry exhaustion.” That makes the prompt less precise and less consistent with nearby condition-driven bullets.  
**Suggestion:** Reintroduce the explicit trigger name, then describe the semantic vs non-semantic behavior under it.
**Suggestion:** **File:** `src/flow/prompts/impl/impl-review.md`  
**Issue:** The updated text removes the concrete `REVIEW_MAX_ATTEMPTS_EXCEEDED` condition and payload details, replacing them with the vaguer phrase “At semantic retry exhaustion.” That makes the prompt less precise and less consistent with nearby condition-driven bullets.  
**Suggestion:** Reintroduce the explicit trigger name, then describe the semantic vs non-semantic behavior under it.
**Rationale:** Loop review proposal.

### 18. 2. Consolidate Recovery Guidance
**Failure mode:** refactor
**File:** src/flow/prompts/impl/impl-review.md
**Issue:** **File:** `src/flow/prompts/impl/impl-review.md`  
**Issue:** Recovery behavior is now spread across adjacent bullets: non-semantic failures mention retry reset, the next bullet explains recovery reason/audit/evidence behavior, and provider/input-size recovery is separate. This makes the retry policy harder to scan.  
**Suggestion:** Group recovery rules under one `Recovery:` bullet with subclauses for semantic deferral, non-semantic retry reset, and provider/input-size recovery.
**Suggestion:** **File:** `src/flow/prompts/impl/impl-review.md`  
**Issue:** Recovery behavior is now spread across adjacent bullets: non-semantic failures mention retry reset, the next bullet explains recovery reason/audit/evidence behavior, and provider/input-size recovery is separate. This makes the retry policy harder to scan.  
**Suggestion:** Group recovery rules under one `Recovery:` bullet with subclauses for semantic deferral, non-semantic retry reset, and provider/input-size recovery.
**Rationale:** Loop review proposal.

### 19. 1. Resolve PASS-only contradiction
**Failure mode:** refactor
**File:** src/flow/prompts/plan/draft-gate.md
**Issue:** **File:** `src/flow/prompts/plan/draft-gate.md`  
**Issue:** The new retry-exhaustion behavior says semantic findings can be deferred to `acceptance-review`, but the later instruction still says “Do not proceed until PASS,” which conflicts with R8.  
**Suggestion:** Change the final instruction to allow either `PASS` or documented semantic retry exhaustion, e.g. “Do not proceed until PASS, except when semantic retry exhaustion has recorded unresolved findings in `flow-findings.json` and the gate step completed as deferred.”
**Suggestion:** **File:** `src/flow/prompts/plan/draft-gate.md`  
**Issue:** The new retry-exhaustion behavior says semantic findings can be deferred to `acceptance-review`, but the later instruction still says “Do not proceed until PASS,” which conflicts with R8.  
**Suggestion:** Change the final instruction to allow either `PASS` or documented semantic retry exhaustion, e.g. “Do not proceed until PASS, except when semantic retry exhaustion has recorded unresolved findings in `flow-findings.json` and the gate step completed as deferred.”
**Rationale:** Loop review proposal.

### 20. 2. Bound failure output volume
**Failure mode:** refactor
**File:** src/flow/prompts/plan/draft-gate.md
**Issue:** **File:** `src/flow/prompts/plan/draft-gate.md`  
**Issue:** “show every row” and “every entry” can require unbounded bulk output, which conflicts with `bounded-resource-usage`.  
**Suggestion:** Add explicit caps, such as showing the first N reasons/issues with per-entry character limits and reporting the omitted count while preserving the full artifact path for later review.
**Suggestion:** **File:** `src/flow/prompts/plan/draft-gate.md`  
**Issue:** “show every row” and “every entry” can require unbounded bulk output, which conflicts with `bounded-resource-usage`.  
**Suggestion:** Add explicit caps, such as showing the first N reasons/issues with per-entry character limits and reporting the omitted count while preserving the full artifact path for later review.
**Rationale:** Loop review proposal.

### 21. 1. Clarify Deferred Gate Progression
**Failure mode:** refactor
**File:** src/flow/prompts/plan/spec-gate.md
**Issue:** **File:** `src/flow/prompts/plan/spec-gate.md`
**Issue:** The new semantic retry exhaustion rule says the gate can complete as deferred, but the final instruction still says “Do not proceed until PASS,” which conflicts with the deferred path.
**Suggestion:** Update the final line to explicitly allow the deferred semantic-exhaustion case, e.g. “Do not proceed until PASS unless the gate completed as deferred due to semantic retry exhaustion.”
**Suggestion:** **File:** `src/flow/prompts/plan/spec-gate.md`
**Issue:** The new semantic retry exhaustion rule says the gate can complete as deferred, but the final instruction still says “Do not proceed until PASS,” which conflicts with the deferred path.
**Suggestion:** Update the final line to explicitly allow the deferred semantic-exhaustion case, e.g. “Do not proceed until PASS unless the gate completed as deferred due to semantic retry exhaustion.”
**Rationale:** Loop review proposal.

### 22. 2. Bound Retry Reset Behavior
**Failure mode:** refactor
**File:** src/flow/prompts/plan/spec-gate.md
**Issue:** **File:** `src/flow/prompts/plan/spec-gate.md`
**Issue:** “Recover them with changed evidence and a retry reset before re-running the gate” could permit repeated retry resets without an explicit upper bound, which risks violating the `bounded-resource-usage` guardrail.
**Suggestion:** Add a clear bound or reference the existing maxAttempts policy for retry resets, such as limiting reset attempts to changed mechanical evidence or a configured maximum.
**Suggestion:** **File:** `src/flow/prompts/plan/spec-gate.md`
**Issue:** “Recover them with changed evidence and a retry reset before re-running the gate” could permit repeated retry resets without an explicit upper bound, which risks violating the `bounded-resource-usage` guardrail.
**Suggestion:** Add a clear bound or reference the existing maxAttempts policy for retry resets, such as limiting reset attempts to changed mechanical evidence or a configured maximum.
**Rationale:** Loop review proposal.

### 23. 1. Preserve retry reset bounds
**Failure mode:** refactor
**File:** src/flow/prompts/plan/spec-review.md
**Issue:** **File:** `src/flow/prompts/plan/spec-review.md`  
**Issue:** The new non-semantic failure instruction says to recover with “changed evidence and a retry reset before re-review,” but no longer states an explicit retry bound. This weakens the `bounded-resource-usage` guardrail for retry behavior.  
**Suggestion:** Add an explicit cap, e.g. “A retry reset grants exactly one re-review attempt, and unchanged evidence is rejected.”
**Suggestion:** **File:** `src/flow/prompts/plan/spec-review.md`  
**Issue:** The new non-semantic failure instruction says to recover with “changed evidence and a retry reset before re-review,” but no longer states an explicit retry bound. This weakens the `bounded-resource-usage` guardrail for retry behavior.  
**Suggestion:** Add an explicit cap, e.g. “A retry reset grants exactly one re-review attempt, and unchanged evidence is rejected.”
**Rationale:** Loop review proposal.

### 24. 2. Name the exact semantic exhaustion trigger
**Failure mode:** refactor
**File:** src/flow/prompts/plan/spec-review.md
**Issue:** **File:** `src/flow/prompts/plan/spec-review.md`  
**Issue:** “At semantic retry exhaustion” is less precise than the previous `REVIEW_MAX_ATTEMPTS_EXCEEDED received` wording, which may make the prompt less consistent with tooling or other review prompts.  
**Suggestion:** Rephrase to include the trigger explicitly, e.g. “When `REVIEW_MAX_ATTEMPTS_EXCEEDED` is received for semantic retry exhaustion, unresolved blocking findings…”
**Suggestion:** **File:** `src/flow/prompts/plan/spec-review.md`  
**Issue:** “At semantic retry exhaustion” is less precise than the previous `REVIEW_MAX_ATTEMPTS_EXCEEDED received` wording, which may make the prompt less consistent with tooling or other review prompts.  
**Suggestion:** Rephrase to include the trigger explicitly, e.g. “When `REVIEW_MAX_ATTEMPTS_EXCEEDED` is received for semantic retry exhaustion, unresolved blocking findings…”
**Rationale:** Loop review proposal.

### 25. 1. Consolidate TOOLING_FAILURE handling
**Failure mode:** refactor
**File:** src/flow/prompts/plan/test-review.md
**Issue:** **File:** `src/flow/prompts/plan/test-review.md`
**Issue:** TOOLING_FAILURE policy is now split across several adjacent bullets, including artifact creation, synthetic finding IDs, overrides, and non-semantic deferral behavior. This increases drift risk.
**Suggestion:** Group these bullets under one `TOOLING_FAILURE handling` bullet or short subsection, keeping the non-semantic/no-deferral rule with the override requirements.
**Suggestion:** **File:** `src/flow/prompts/plan/test-review.md`
**Issue:** TOOLING_FAILURE policy is now split across several adjacent bullets, including artifact creation, synthetic finding IDs, overrides, and non-semantic deferral behavior. This increases drift risk.
**Suggestion:** Group these bullets under one `TOOLING_FAILURE handling` bullet or short subsection, keeping the non-semantic/no-deferral rule with the override requirements.
**Rationale:** Loop review proposal.

### 26. 2. Clarify deferred completion terminology
**Failure mode:** refactor
**File:** src/flow/prompts/plan/test-review.md
**Issue:** **File:** `src/flow/prompts/plan/test-review.md`
**Issue:** “the review step completes as deferred” is slightly ambiguous because earlier wording distinguishes completion overrides, retry resets, and step done behavior.
**Suggestion:** Use the project’s exact state/action wording if available, for example: “the review step is marked complete with deferred semantic findings recorded in `flow-findings.json`...” or similar.
**Suggestion:** **File:** `src/flow/prompts/plan/test-review.md`
**Issue:** “the review step completes as deferred” is slightly ambiguous because earlier wording distinguishes completion overrides, retry resets, and step done behavior.
**Suggestion:** Use the project’s exact state/action wording if available, for example: “the review step is marked complete with deferred semantic findings recorded in `flow-findings.json`...” or similar.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 5
- Out of scope: 0
