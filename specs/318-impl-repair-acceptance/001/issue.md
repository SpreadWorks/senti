## Summary
Implement the flow closure from `impl repair` through semantic `acceptance` so findings F-002 and F-003 can be resolved in units that are independently implementable, reviewable, revertible, and verifiable.

## Problem
Current flow semantics are incomplete in two ways:

1. There is no domain evidence or artifact invalidation model for review-driven repairs.
2. `acceptance-review` does not evaluate the original request, requirements, and resulting diff at the semantic requirement level.

This issue targets gaps that are reproducible on the current source. It is not a re-registration of past issues.

## Scope
- Category: Release blocker / flow correctness
- Findings: F-002, F-003
- Target paths:
  - `src/flow/definition.js`
  - `src/flow/lib/run-review.js`
  - `src/flow/lib/run-acceptance-review.js`
  - `src/flow/lib/acceptance-review-artifacts.js`
  - acceptance schema
  - impl prompts

## Required Changes
- Add `impl-triage` and `impl-repair` states.
- After any repair, the flow must always return to `test-execute` before proceeding.
- When the relevant fingerprint changes, invalidate artifacts produced from `test-execute` through `acceptance-review`.
- Record the invalidation reason and prior fingerprint in the ledger.
- Extend acceptance evaluation so it judges, per requirement unit:
  - original request
  - explicit requirements
  - produced diff
  - repair audit evidence
  - test evidence
- Route acceptance outcomes as follows:
  - `notMet` -> repair
  - `notVerifiable` -> approval-required decision
- `risk acceptance` and `abort` must not be auto-selected.

## Acceptance Criteria
- `impl-triage` / `impl-repair` are implemented and wired so repair always re-enters `test-execute`.
- Fingerprint changes invalidate all stale artifacts from `test-execute` through `acceptance-review`.
- Ledger entries preserve both the invalidation reason and the previous fingerprint.
- `acceptance-review` evaluates request, requirements, diff, repair audit, and test evidence at requirement granularity.
- `notMet` transitions to repair.
- `notVerifiable` transitions only to an approval-required decision path.
- Automatic selection of `risk acceptance` or `abort` is impossible in this path.
- In a CLI-only `FAIL -> repair -> retest -> PASS` scenario, stale artifacts are rejected and cannot satisfy acceptance.

## Verification
- Add a failing reproduction before implementation and confirm it fails on the pre-fix source.
- Prove every acceptance criterion with automated tests or reproducible commands.
- Confirm existing success-path behavior still passes.
- Tests must not force success by directly mutating flow state or artifacts.
- If source behavior changes, update the necessary docs in the same change.

## Dependencies and Scheduling
- Depends on: D-01
- Integrate into `test:ci` after D-03 is complete.
- Parallel safety: occupies the flow semantic lane; do not run in parallel with D-10, D-11, or D-13.
- Recommended wave: Wave 2

## Related Issues
- GitHub Issue #380: current implementation does not satisfy the semantic validation requirements of `acceptance-review`.
- This issue covers unmet behavior or follow-on defects reproducible from the current source, not historical restatement alone.

## Evidence
- Relevant findings and source references in `.tmp/refactoring/report.md`

## Out of Scope
- Opportunistic fixes for findings not explicitly listed in this issue
- `npm publish`
- `npm dist-tag`
- formal release execution

<details>
<summary>ja</summary>

impl repair から semantic acceptance までの閉包を実装する

## Summary
Implement the flow closure from `impl repair` through semantic `acceptance` so findings F-002 and F-003 can be resolved in units that are independently implementable, reviewable, revertible, and verifiable.

## Problem
Current flow semantics are incomplete in two ways:

1. There is no domain evidence or artifact invalidation model for review-driven repairs.
2. `acceptance-review` does not evaluate the original request, requirements, and resulting diff at the semantic requirement level.

This issue targets gaps that are reproducible on the current source. It is not a re-registration of past issues.

## Scope
- Category: Release blocker / flow correctness
- Findings: F-002, F-003
- Target paths:
  - `src/flow/definition.js`
  - `src/flow/lib/run-review.js`
  - `src/flow/lib/run-acceptance-review.js`
  - `src/flow/lib/acceptance-review-artifacts.js`
  - acceptance schema
  - impl prompts

## Required Changes
- Add `impl-triage` and `impl-repair` states.
- After any repair, the flow must always return to `test-execute` before proceeding.
- When the relevant fingerprint changes, invalidate artifacts produced from `test-execute` through `acceptance-review`.
- Record the invalidation reason and prior fingerprint in the ledger.
- Extend acceptance evaluation so it judges, per requirement unit:
  - original request
  - explicit requirements
  - produced diff
  - repair audit evidence
  - test evidence
- Route acceptance outcomes as follows:
  - `notMet` -> repair
  - `notVerifiable` -> approval-required decision
- `risk acceptance` and `abort` must not be auto-selected.

## Acceptance Criteria
- `impl-triage` / `impl-repair` are implemented and wired so repair always re-enters `test-execute`.
- Fingerprint changes invalidate all stale artifacts from `test-execute` through `acceptance-review`.
- Ledger entries preserve both the invalidation reason and the previous fingerprint.
- `acceptance-review` evaluates request, requirements, diff, repair audit, and test evidence at requirement granularity.
- `notMet` transitions to repair.
- `notVerifiable` transitions only to an approval-required decision path.
- Automatic selection of `risk acceptance` or `abort` is impossible in this path.
- In a CLI-only `FAIL -> repair -> retest -> PASS` scenario, stale artifacts are rejected and cannot satisfy acceptance.

## Verification
- Add a failing reproduction before implementation and confirm it fails on the pre-fix source.
- Prove every acceptance criterion with automated tests or reproducible commands.
- Confirm existing success-path behavior still passes.
- Tests must not force success by directly mutating flow state or artifacts.
- If source behavior changes, update the necessary docs in the same change.

## Dependencies and Scheduling
- Depends on: D-01
- Integrate into `test:ci` after D-03 is complete.
- Parallel safety: occupies the flow semantic lane; do not run in parallel with D-10, D-11, or D-13.
- Recommended wave: Wave 2

## Related Issues
- GitHub Issue #380: current implementation does not satisfy the semantic validation requirements of `acceptance-review`.
- This issue covers unmet behavior or follow-on defects reproducible from the current source, not historical restatement alone.

## Evidence
- Relevant findings and source references in `.tmp/refactoring/report.md`

## Out of Scope
- Opportunistic fixes for findings not explicitly listed in this issue
- `npm publish`
- `npm dist-tag`
- formal release execution

</details>