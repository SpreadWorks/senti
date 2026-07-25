## Summary

Issue #451 exposed a diagnostic gap in `final-regression`. When the outer `node tests/run.js` process exited with code `1`, the nested `unit`/`e2e` child commands were preserved as 0-byte stdout/stderr, so neither the raw log nor the final artifact showed which child failed, what failed, or whether the child ended by non-zero exit, signal, timeout, or spawn error. Despite that missing evidence, the result was still classified as `failureNature: assertion` and `unattributed_existing_failure`.

The workflow needs to preserve enough child-process evidence to explain final-regression outcomes without rerunning tests.

## Problem

At least one path drops nested child diagnostics between the project regression runner and final-regression artifact generation. When evidence is missing, the classifier currently infers assertion and existing-failure status that cannot be justified from preserved data.

## Proposed Change

- Persist a bounded per-child execution record from the outer runner for every nested command, including command identity, spawn/start result, exit code, signal, spawn error, timeout state, and captured stdout/stderr.
- When stdout/stderr exceed configured bounds, retain truncation metadata and a durable raw-log reference instead of discarding the missing context.
- Represent a non-zero exit with no output as an explicit typed diagnostic outcome rather than synthesizing an assertion failure.
- Tighten final-regression classification so `failureNature: assertion` and current-vs-existing attribution are only set when concrete preserved evidence supports them.
- Do not rerun test commands for diagnostic enrichment.

## Acceptance Criteria

- A nested `unit` or `e2e` child that fails with no output is still identifiable in both the raw log and final artifact, including whether the failure was caused by exit code, signal, timeout, or spawn error.
- Child stdout/stderr are preserved within configured bounds; when truncated, the artifact records truncation metadata and a durable source reference.
- Exit, signal, timeout, spawn error, assertion output, and no-output non-zero exit are represented as distinct typed failure modes.
- If preserved evidence does not show an assertion, the artifact does not set `failureNature: assertion`.
- Existing-vs-current attribution is explainable from preserved evidence; unknown failures are not auto-classified as existing failures.
- The change does not alter final-regression execution count, retry behavior, or record-and-proceed failed-state display.
- Tests prove nested failure diagnostics are captured without any additional test-process invocations.

## Evidence

- `specs/327-approval-task-sync-atomic/final-regression-result.json`
- `specs/327-approval-task-sync-atomic/tests/.raw/final-regression-attempt-001.log`
- Issue #451: outer `node tests/run.js` exited with code `1`, nested child output was preserved as 0 bytes, and the result was classified as `unattributed_existing_failure`.

## Scope

In scope:
- `tests/run.js`
- `src/flow/lib/run-final-regression.js`
- final-regression execution/classification tests

Out of scope:
- Re-fixing product code for Issue #451
- Changing regression execution points or invocation counts
- Converting failures into PASS or skipped outcomes via fallback behavior
- Reducing or skipping assertions

## Validation

- Process fixtures covering output/no-output plus exit, signal, timeout, and spawn-error outcomes
- Artifact and raw-log snapshot coverage for nested `unit`/`e2e` failures
- A process spy proving zero additional test-process invocations
- Related unit/e2e coverage and `npm test`

<details>
<summary>ja</summary>

final-regressionのnested child failure診断を保持する

## Summary

Issue #451 exposed a diagnostic gap in `final-regression`. When the outer `node tests/run.js` process exited with code `1`, the nested `unit`/`e2e` child commands were preserved as 0-byte stdout/stderr, so neither the raw log nor the final artifact showed which child failed, what failed, or whether the child ended by non-zero exit, signal, timeout, or spawn error. Despite that missing evidence, the result was still classified as `failureNature: assertion` and `unattributed_existing_failure`.

The workflow needs to preserve enough child-process evidence to explain final-regression outcomes without rerunning tests.

## Problem

At least one path drops nested child diagnostics between the project regression runner and final-regression artifact generation. When evidence is missing, the classifier currently infers assertion and existing-failure status that cannot be justified from preserved data.

## Proposed Change

- Persist a bounded per-child execution record from the outer runner for every nested command, including command identity, spawn/start result, exit code, signal, spawn error, timeout state, and captured stdout/stderr.
- When stdout/stderr exceed configured bounds, retain truncation metadata and a durable raw-log reference instead of discarding the missing context.
- Represent a non-zero exit with no output as an explicit typed diagnostic outcome rather than synthesizing an assertion failure.
- Tighten final-regression classification so `failureNature: assertion` and current-vs-existing attribution are only set when concrete preserved evidence supports them.
- Do not rerun test commands for diagnostic enrichment.

## Acceptance Criteria

- A nested `unit` or `e2e` child that fails with no output is still identifiable in both the raw log and final artifact, including whether the failure was caused by exit code, signal, timeout, or spawn error.
- Child stdout/stderr are preserved within configured bounds; when truncated, the artifact records truncation metadata and a durable source reference.
- Exit, signal, timeout, spawn error, assertion output, and no-output non-zero exit are represented as distinct typed failure modes.
- If preserved evidence does not show an assertion, the artifact does not set `failureNature: assertion`.
- Existing-vs-current attribution is explainable from preserved evidence; unknown failures are not auto-classified as existing failures.
- The change does not alter final-regression execution count, retry behavior, or record-and-proceed failed-state display.
- Tests prove nested failure diagnostics are captured without any additional test-process invocations.

## Evidence

- `specs/327-approval-task-sync-atomic/final-regression-result.json`
- `specs/327-approval-task-sync-atomic/tests/.raw/final-regression-attempt-001.log`
- Issue #451: outer `node tests/run.js` exited with code `1`, nested child output was preserved as 0 bytes, and the result was classified as `unattributed_existing_failure`.

## Scope

In scope:
- `tests/run.js`
- `src/flow/lib/run-final-regression.js`
- final-regression execution/classification tests

Out of scope:
- Re-fixing product code for Issue #451
- Changing regression execution points or invocation counts
- Converting failures into PASS or skipped outcomes via fallback behavior
- Reducing or skipping assertions

## Validation

- Process fixtures covering output/no-output plus exit, signal, timeout, and spawn-error outcomes
- Artifact and raw-log snapshot coverage for nested `unit`/`e2e` failures
- A process spy proving zero additional test-process invocations
- Related unit/e2e coverage and `npm test`

</details>