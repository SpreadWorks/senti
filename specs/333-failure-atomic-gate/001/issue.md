## Summary

`run-gate.js` currently marks stale `in-progress` gate steps as `done` before the current gate evaluation has fully succeeded. If a later step fails, that premature mutation remains persisted, so phase inference is not failure-atomic.

## Problem

Current gate processing mutates step state during inference, before validation and gate judgment have completed. As a result:

- a failed run can still leave a gate step recorded as `done`
- retries observe mutated state from the failed attempt
- rewind/recovery behavior becomes ambiguous because inferred completion was never actually committed as a successful transition

## Required Invariants

- Gate transitions commit only after validation and gate judgment both succeed.
- On failure, state remains identical to the pre-transition state.
- If rewind is needed, record it as an explicit transition rather than inferring completion and marking a step `done`.

## Scope

- `src/flow/lib/run-gate.js`
- phase inference / transition ordering for gate steps
- fault-injection and retry coverage for validation, agent, and artifact write boundaries

## Acceptance Criteria

- Failures at each boundary below do not change persisted step state:
  - validation
  - agent execution
  - artifact write
- Successful execution applies the gate transition exactly once.
- Retrying after a failure does not create duplicate findings or duplicate artifacts.
- Tests assert that failed attempts preserve pre-transition state instead of expecting partial mutation.

## Evidence

`run-gate.js:4630-4631` updates a stale gate to `done` before evaluating the current gate. Existing tests also appear to encode this non-atomic behavior by expecting state mutation to remain after downstream failure.

<details>
<summary>ja</summary>

gateのphase遷移をfailure-atomicにする

## Summary

`run-gate.js` currently marks stale `in-progress` gate steps as `done` before the current gate evaluation has fully succeeded. If a later step fails, that premature mutation remains persisted, so phase inference is not failure-atomic.

## Problem

Current gate processing mutates step state during inference, before validation and gate judgment have completed. As a result:

- a failed run can still leave a gate step recorded as `done`
- retries observe mutated state from the failed attempt
- rewind/recovery behavior becomes ambiguous because inferred completion was never actually committed as a successful transition

## Required Invariants

- Gate transitions commit only after validation and gate judgment both succeed.
- On failure, state remains identical to the pre-transition state.
- If rewind is needed, record it as an explicit transition rather than inferring completion and marking a step `done`.

## Scope

- `src/flow/lib/run-gate.js`
- phase inference / transition ordering for gate steps
- fault-injection and retry coverage for validation, agent, and artifact write boundaries

## Acceptance Criteria

- Failures at each boundary below do not change persisted step state:
  - validation
  - agent execution
  - artifact write
- Successful execution applies the gate transition exactly once.
- Retrying after a failure does not create duplicate findings or duplicate artifacts.
- Tests assert that failed attempts preserve pre-transition state instead of expecting partial mutation.

## Evidence

`run-gate.js:4630-4631` updates a stale gate to `done` before evaluating the current gate. Existing tests also appear to encode this non-atomic behavior by expecting state mutation to remain after downstream failure.

</details>