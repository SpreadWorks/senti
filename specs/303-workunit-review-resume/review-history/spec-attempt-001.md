# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Define stable WorkUnit checkpoint lookup key
**Target:** R2/R3/R4 and checkpoint path
**Issue:** The spec requires stale checkpoint detection and exact identity comparison, but `review-history/work-units/impl-review/<unit-id>.json` never defines how `<unit-id>` is derived. Because the required identity includes volatile fields such as input hash, provider identity, prompt version, and schema version, an implementation that uses the full identity hash as `unitId` will treat changed inputs as missing rather than stale; an implementation that uses only order may collide across chunk, cross-check, parent, and child units.
**Required change:** Define the WorkUnit `unitId` or lookup-key derivation from stable planning fields, and state that the stored full identity in that checkpoint file is compared with the planned identity to decide reusable versus stale.
**Why blocking:** Without a stable lookup contract, stale detection may never execute or unrelated WorkUnits may overwrite each other, so resume behavior and stale checkpoint tests cannot be implemented deterministically.

### 2. Specify impl tooling-failure runner contract
**Target:** R5/R10 and `src/flow/lib/run-review.js` boundary
**Issue:** Existing impl review runner behavior differs from non-impl phases: `RunReviewCommand` throws on nonzero impl review subprocess results before `parseImplReviewOutput`, while successful impl parsing expects final artifacts and current impl retry/lifecycle paths increment `reviewRetry` for impl artifacts. The spec requires WorkUnit provider, timeout, parser, and schema failures to stop as tooling failures without writing final `impl-review.json` / `review.md`, but does not define how that state crosses the review subprocess boundary.
**Required change:** State the exact impl WorkUnit tooling-failure contract at the `run-review` boundary, including whether it is surfaced as a ReviewFailure marker/nonzero Envelope failure or as a structured `TOOLING_FAILURE` result, and require no next-step advancement and no semantic `reviewRetry` increment for that case.
**Why blocking:** If left unspecified, an implementation can save failed checkpoints but still be parsed as a generic subprocess failure, or as an impl result that advances/retries incorrectly, making R5 and R10 unsafe to implement and test.

### 3. Define retryable WorkUnit failure classification
**Target:** R5/R8 checkpoint failure fields
**Issue:** R8 depends on "the same retryable loop-chunk WorkUnit" failing twice, but the spec does not define which WorkUnit failure kinds are retryable or how the retryable state is persisted. Existing code has subprocess-level retry classification in `ReviewFailure`, but WorkUnit failures include provider, timeout, parser, and schema failures inside the review command, which are not mapped to a chunk-level fallback policy.
**Required change:** Add a small failure classification rule for WorkUnit checkpoints that names the failure kinds and whether each sets `retryable: true` for fallback splitting.
**Why blocking:** Without this rule, implementations cannot know when two failed checkpoints should trigger child WorkUnits versus normal rerun, and R8 tests cannot assert the fallback threshold against real failure paths.


## Non-blocking Improvements

### 1. Mention config validation target
**Target:** R9 / Codebase Context
**Improvement:** Add `src/lib/config.js` as a related implementation target for `flow.review.excludePaths`, since the existing config schema defines `flow` but has no `review` child yet.
**Why non-blocking:** R9 already requires adding the config setting, so an implementer can discover the schema target from the codebase; naming it would just reduce lookup time.

### 2. Clarify checkpoint path root
**Target:** R3 / R12
**Improvement:** State explicitly that `review-history/work-units/impl-review/<unit-id>.json` is rooted under the current spec directory, matching existing `review-history/impl-attempt-*.json` behavior.
**Why non-blocking:** Existing review-history conventions and R12's spec-directory evidence wording make the intended location inferable, but the explicit root would make tests and artifact assertions clearer.
