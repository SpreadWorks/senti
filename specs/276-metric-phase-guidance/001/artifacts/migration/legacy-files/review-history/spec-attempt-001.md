# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Status-derived phases are not all valid metric phases
**Target:** R1 / Metric Recording guidance
**Issue:** The spec says to fix the guidance by using `draft` for planning/draft metric recording, but codebase behavior shows `sdd-forge flow get status` derives and returns branch phases such as `plan` and `finalize` via `derivePhase`, while `flow set metric` accepts only `VALID_PHASES` and rejects `plan` and `finalize`. If the guidance continues to tell users to use the phase from status/next-action, merely changing the example to `draft` leaves an invalid implementation path in place.
**Required change:** Amend R1 or the acceptance criteria to require metric guidance to use only `VALID_PHASES` values for `flow set metric`, and to remove or explicitly map any status/step phase values such as `plan` and `finalize` before presenting them as metric phases.
**Why blocking:** Without this correction, an implementation can satisfy the stated `draft` example while still instructing users to run rejected commands such as `sdd-forge flow set metric plan srcRead` or `sdd-forge flow set metric finalize docsRead`, so the guidance remains unsafe to implement and test against the CLI contract.


## Non-blocking Improvements

### 1. Broaden guidance text test
**Target:** Acceptance Criteria / test_strategy
**Improvement:** The proposed spec-local text test only checks for exact `flow set metric plan docsRead` and `flow set metric plan srcRead` examples, but the current source exposes `plan` as a phase example rather than as those exact commands. It would be stronger to also assert that the metric guidance section contains no invalid phase examples and that listed metric phases are drawn from `VALID_PHASES`.
**Why non-blocking:** R1 already states that `plan` must not be presented as a valid metric phase, so implementers can derive an adequate test from the requirement even though the suggested test wording is narrower.
