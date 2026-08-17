# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Specify acceptance-review routing fields for user-decision deferred findings
**Target:** R7 / Acceptance Criteria: acceptance-review verdict for still_open deferred findings
**Issue:** The spec requires still_open deferred findings to produce user_decision_required, but the existing acceptance-review artifact contract requires every non-pass verdict to carry a valid nextAction and targetStep. Current code validates nextAction against amend/repair/user_decision and targetStep against the allowed flow targets, and user_decision_required is only derivable when nextAction is user_decision or explicit user-decision state is present.
**Required change:** Extend R7 or its acceptance criteria to state the required nextAction and targetStep for still_open deferred findings when acceptance-review emits user_decision_required, for example nextAction=user_decision and the intended targetStep such as implement.
**Why blocking:** Without these mandatory artifact fields, an implementation can set the requested verdict but still produce an invalid acceptance-review.json, and tests cannot unambiguously assert the valid downstream state transition or user-decision path.


## Non-blocking Improvements

### 1. Mention lifecycle dispatcher files
**Target:** Overview / Modules
**Improvement:** Add src/flow/definition.js and src/flow/registry.js as related verification surfaces because review post-hook action ordering currently runs through resolveReviewLifecycle and RegistryLifecycleAdapter before updateReviewRetryCounter is called.
**Why non-blocking:** The spec already names src/flow/lib/run-review.js as the primary implementation target, and the behavior can still be implemented there without changing the dispatcher files.

### 2. Clarify TOOLING_FAILURE exhaustion wording
**Target:** Acceptance Criteria: TOOLING_FAILURE case
**Improvement:** Reword the TOOLING_FAILURE acceptance criterion to avoid implying TOOLING_FAILURE consumes reviewRetry in the post-hook path; existing behavior skips retry metric consumption for TOOLING_FAILURE and records tooling recovery instead.
**Why non-blocking:** The scope and requirements already clearly exclude TOOLING_FAILURE from semantic deferral, so implementers can preserve the existing recovery path despite the wording.
