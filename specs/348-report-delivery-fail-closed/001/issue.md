## Summary

Harden `report` delivery semantics so the workflow fails closed and the final evidence is cryptographically bound to the exact source state used to generate the report.

## Problem

`report` generation currently permits successful completion when required inputs or delivery steps are not trustworthy:

- A corrupt `issue-log` can be treated as an empty log and execution continues.
- If `gh` is unavailable, delivery can degrade into a skipped-success path and the step still completes.
- Final evidence is not bound to the exact target `HEAD`/tree or to the hashes of the source artifacts used during generation.

As a result, a report can appear complete even when required inputs were unreadable, required delivery never occurred, or the evidence no longer matches the source state it supposedly represents.

## Expected Behavior

- Corruption or unreadability of required source inputs must fail closed.
- Any required delivery failure must block the report from reaching a done state.
- Report artifacts and final evidence must record enough binding data to verify freshness against the intended `HEAD`/tree and the hashes of the source artifacts used to produce them.
- If offline draft generation is supported, it must be represented as an explicit unsent or pending state and must remain distinct from successful delivery.

## Primary Scope

Implementation target:

- `src/flow/lib/run-report.js`

Validation target:

- report artifact tests
- delivery and retry tests
- freshness and source-binding tests

## Acceptance Criteria

- A corrupt `issue-log` causes the report step to fail instead of being treated as an empty log.
- `gh` unavailability, delivery failure, or any other required delivery failure prevents the report from being marked done.
- Retry performs the exact missing delivery step without creating duplicate issue publication.
- Report output records the binding data required to verify freshness against the intended `HEAD`/tree and source artifact hashes.
- A freshness check rejects report or evidence after relevant source-artifact or tree changes that occur after report generation.
- If an offline draft mode exists, it is clearly marked unsent or pending and is not equivalent to successful delivery.

## Evidence

Current behavior is called out in `src/flow/lib/run-report.js`:

- around `:63`, `issue-log` load failure is swallowed and execution continues
- around `:126`, `gh` unavailability is converted into a success or skipped outcome

## Notes

This is separate from issue `#343`, which concerns summary quality rather than report integrity, delivery semantics, or evidence freshness.

<details>
<summary>ja</summary>

report deliveryをfail closedし証跡freshnessをbindingする

## Summary

Harden `report` delivery semantics so the workflow fails closed and the final evidence is cryptographically bound to the exact source state used to generate the report.

## Problem

`report` generation currently permits successful completion when required inputs or delivery steps are not trustworthy:

- A corrupt `issue-log` can be treated as an empty log and execution continues.
- If `gh` is unavailable, delivery can degrade into a skipped-success path and the step still completes.
- Final evidence is not bound to the exact target `HEAD`/tree or to the hashes of the source artifacts used during generation.

As a result, a report can appear complete even when required inputs were unreadable, required delivery never occurred, or the evidence no longer matches the source state it supposedly represents.

## Expected Behavior

- Corruption or unreadability of required source inputs must fail closed.
- Any required delivery failure must block the report from reaching a done state.
- Report artifacts and final evidence must record enough binding data to verify freshness against the intended `HEAD`/tree and the hashes of the source artifacts used to produce them.
- If offline draft generation is supported, it must be represented as an explicit unsent or pending state and must remain distinct from successful delivery.

## Primary Scope

Implementation target:

- `src/flow/lib/run-report.js`

Validation target:

- report artifact tests
- delivery and retry tests
- freshness and source-binding tests

## Acceptance Criteria

- A corrupt `issue-log` causes the report step to fail instead of being treated as an empty log.
- `gh` unavailability, delivery failure, or any other required delivery failure prevents the report from being marked done.
- Retry performs the exact missing delivery step without creating duplicate issue publication.
- Report output records the binding data required to verify freshness against the intended `HEAD`/tree and source artifact hashes.
- A freshness check rejects report or evidence after relevant source-artifact or tree changes that occur after report generation.
- If an offline draft mode exists, it is clearly marked unsent or pending and is not equivalent to successful delivery.

## Evidence

Current behavior is called out in `src/flow/lib/run-report.js`:

- around `:63`, `issue-log` load failure is swallowed and execution continues
- around `:126`, `gh` unavailability is converted into a success or skipped outcome

## Notes

This is separate from issue `#343`, which concerns summary quality rather than report integrity, delivery semantics, or evidence freshness.

</details>