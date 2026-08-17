# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Shared draft QA rules also affect coverage review
**Target:** R1 / Design Principles / Acceptance Criteria
**Issue:** The spec directs the priority marker rule into the shared Draft QA Rules partial, but existing code also loads that partial in buildDraftReviewPrompt for draft coverage review, not only in plan.draft next-action guidance. The spec does not state whether draft coverage review should treat missing priority markers as a coverage-review finding, even though that review is limited to unresolved user decisions and must not propose edits to existing QA.
**Required change:** Add a spec-level clarification for the draft coverage review consumer of the shared partial: either the new priority marker text must be framed as authoring/preflight guidance that coverage review must not report as a blocking user-decision gap, or coverage review behavior and tests must be explicitly included if it is intended to flag missing markers there.
**Why blocking:** Without this, an implementation can satisfy the named draft and draft-gate prompt targets while accidentally causing draft coverage review to report procedural marker omissions as blocking user decisions, creating false review failures or retry loops that the specified tests would not catch.


## Non-blocking Improvements

### 1. Use exact draft field names in R1
**Target:** R1
**Improvement:** R1 says draft QA, scope, impact, decision, and open-question entries; using the existing draft field names such as scopeVerification.in/out, impactOnExisting, decisionMap.*, qa.*, and openQuestions would reduce interpretation work.
**Why non-blocking:** Clarifications and draft-gate acceptance already identify the relevant fields closely enough for implementation and tests.
