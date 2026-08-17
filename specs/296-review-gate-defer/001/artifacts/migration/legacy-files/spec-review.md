# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Test-review header precheck has no specified structured data path
**Target:** R4 / R5 / T-1 / T-4
**Issue:** The spec requires coverage/header precheck failures to remain non-semantic, but existing test-review code writes header validation failures as ordinary blockingFindings in test-review.json while the structured validation signal lives in the separate test-coverage.json artifact. The spec does not require the classifier to read that coverage artifact or require generated header findings to carry a structured origin/failureKind.
**Required change:** Specify the structured signal used for test-review coverage/header failures, such as reading test-coverage.json validation or adding a structured origin/failureKind to generated header findings, and make that path part of the retry-exhaustion acceptance basis.
**Why blocking:** Without a required data path, implementation can incorrectly treat header coverage blockers as semantic AI findings and defer them to acceptance-review, weakening the mandatory coverage/header precheck behavior and making the non-deferral test unreliable.

### 2. Test-review repair loop ownership is ambiguous
**Target:** R5 / T-4
**Issue:** The spec says test-review supports bounded fix/re-review attempts, but existing code has two materially different possible mechanisms: command-internal repair via the unused review loop/fix helpers in src/flow/commands/review.js, or flow-level repair between repeated senti flow run review --phase test invocations using reviewRetry in src/flow/lib/run-review.js and src/flow/definition.js. The spec does not choose which owns fixes or how attempts are counted.
**Required change:** State whether test-review fixes occur inside the review command or as separate flow/skill repair between review invocations, and define how that path consumes the existing reviewRetry maxAttempts budget.
**Why blocking:** The two implementations produce different AI call counts, artifacts, retry metrics, and step-status transitions. Tests for R5 cannot be designed correctly, and an internal loop could bypass the existing maxAttempts accounting while a flow-level loop could fail an auto-fix interpretation of the requirement.


## Non-blocking Improvements

### 1. Name both draft review routes
**Target:** R1 / T-2
**Improvement:** Explicitly mention that draft review deferral covers both draft-questions and draft-coverage retry phases and their source artifacts, not only the user-facing draft phase.
**Why non-blocking:** The current wording can reasonably be read as covering draft generally, and implementationTargets already include the draft review prompt files, but naming both routes would reduce missed test cases.

### 2. Add lifecycle files to implementation targets
**Target:** implementationTargets / T-4
**Improvement:** Add src/flow/definition.js and src/flow/registry.js to implementationTargets because test-review and deferred result post-hook behavior is resolved through lifecycle actions there.
**Why non-blocking:** T-4 already says to update any post-hook status handling, so implementation is not blocked, but the explicit file list would be more complete.
