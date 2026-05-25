# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Gate failures are not covered by the specified failure fields
**Target:** R2 / src/flow/lib/run-gate.js appendIssueLogFromGateResult
**Issue:** Existing gate issue-log entries record gate result context as step, level, phase, reason, trigger, and timestamp. The failure signal for appendIssueLogFromGateResult is available through level and sometimes arbitrary reason text, but R2 only checks result/status/failureKind for gate/review/final-regression failure classification. A real gate failure whose reason text does not contain fail/error/blocked would be classified as non-important.
**Required change:** Extend R2's important-entry criteria to include the existing gate issue-log failure field, minimally by treating gate entries with a failing level value as important.
**Why blocking:** Leaving this unchanged can hide existing gate failures from the Important subsection or omit them behind the 5-entry Recent Other cap, contradicting the stated gate-failure behavior and making tests against the current gate issue-log shape fail or under-specify the behavior.


## Non-blocking Improvements

### 1. Specify which important entries survive the 10-entry cap
**Target:** R3 / R4
**Improvement:** Clarify whether the 10 displayed important entries are the earliest important entries, the most recent important entries, or another deterministic ordering. Recent Other already defines tail-5 selection and display order, but Important does not.
**Why non-blocking:** The cap and omitted-count behavior can still be implemented and tested, but selection identity for more than 10 important entries remains a product choice rather than a codebase integration blocker.

### 2. Tighten summary entry field list
**Target:** Clarifications / T-1
**Improvement:** Replace the open-ended 'step、reason、resolution、classification などの短い fields' wording with the exact fields intended for data.issueLog.entries, or explicitly say implementation may include other short scalar display fields.
**Why non-blocking:** The current wording is enough to avoid copying all full entries, but exact report.json shape assertions would be easier and less subjective with a closed field list.
