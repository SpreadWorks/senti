## Summary

`flow set init` and `flow prepare` currently perform a global stale prune of preparing records older than 1 hour. That behavior can delete unrelated unresolved preparing runs and breaks the data-integrity invariant for preparing state.

This already occurred in #415: preparing run `ffd8b360-9295-4598-8af8-861ccb16d2fa` was implicitly unlinked when `flow set init` ran for unrelated issue #431. Because there is no tombstone or journal, the lost record cannot be recovered exactly. The same unrelated prune path also exists on successful `flow prepare`.

## Goal

Introduce a minimal fix that preserves unrelated preparing runs across `init` and `prepare`, regardless of elapsed time. This issue is only about preventing future loss. It must not reconstruct, silently replace, or infer the missing record from #415.

## Scope

- `src/flow/lib/set-init.js`
- `src/flow/lib/run-prepare-spec.js`
- `src/lib/preparing-flow-store.js`
- `src/lib/flow-helpers.js`
- focused unit/e2e tests

## Requirements

- `flow set init` must never delete existing preparing runs.
- `flow prepare --run-id X` may delete only `X`, and only after successful state conversion.
- If `flow prepare --run-id X` fails during validation, agent execution, write, or conversion, `X` must remain intact.
- `init` and `prepare` must never modify or delete unrelated preparing runs.
- Unresolved preparing runs must not be disposed of solely because they are older than 1 hour.
- Remove or disable global stale unlink/prune paths and obsolete TTL assumptions from production code and tests.
- Do not add a new cleanup/archive command in this minimal fix if none is already publicly supported.
- Preserve existing FlowStore/preparing-store ownership boundaries; do not add new dependencies or compatibility shims.
- Do not reconstruct or silently replace the missing #415 record.

## Acceptance Criteria

- [ ] If stale preparing run `A` exists for more than 1 hour, running `flow set init` to create run `B` leaves `A` byte-identical.
- [ ] If unrelated preparing run `A` exists, successful `flow prepare --run-id B` leaves `A` byte-identical and removes only `B`.
- [ ] If `flow prepare --run-id B` fails, both `A` and `B` remain unchanged.
- [ ] No hidden `init`/`prepare` path prunes unresolved preparing runs based only on elapsed time, including at 60+ minutes.
- [ ] Global stale unlink/prune helpers are removed from, or unreachable from, production paths.
- [ ] Tests that previously justified deleting 61-minute-old records are replaced with preservation/invariance tests.
- [ ] Target-record deletion happens only after successful conversion.
- [ ] If explicit cleanup/archive is not publicly supported, this issue does not introduce an implicit replacement; future deletion must be explicit, target-guarded, and auditable.
- [ ] Public `init`/`prepare` behavior stays unchanged except for removing stale global deletion.
- [ ] Focused unit/e2e tests pass and cover multiple preparing runs, isolation, and failure atomicity.

## Verification

- Compare run `A` record bytes/hash before and after `init B` and `prepare B`.
- Verify that successful `prepare B` removes only `B`, and only after active/spec conversion succeeds.
- Verify that validation, agent, write, and conversion failures preserve both `A` and `B`.
- Confirm no direct or indirect `init`/`prepare` call path still triggers global stale cleanup.
- Update prior TTL-based deletion tests to assert preservation and catch hidden prune regressions.

## Non-goals

- Reconstructing, inferring, or silently replacing the missing preparing run from #415
- Designing or implementing a new cleanup/archive command
- Implementing a target-guarded audited deletion operation
- Changing unrelated flow lifecycle behavior
- Adding new dependencies or public compatibility shims

<details>
<summary>ja</summary>

init と prepare の間に unrelated preparing flow を保持する

## Summary

`flow set init` and `flow prepare` currently perform a global stale prune of preparing records older than 1 hour. That behavior can delete unrelated unresolved preparing runs and breaks the data-integrity invariant for preparing state.

This already occurred in #415: preparing run `ffd8b360-9295-4598-8af8-861ccb16d2fa` was implicitly unlinked when `flow set init` ran for unrelated issue #431. Because there is no tombstone or journal, the lost record cannot be recovered exactly. The same unrelated prune path also exists on successful `flow prepare`.

## Goal

Introduce a minimal fix that preserves unrelated preparing runs across `init` and `prepare`, regardless of elapsed time. This issue is only about preventing future loss. It must not reconstruct, silently replace, or infer the missing record from #415.

## Scope

- `src/flow/lib/set-init.js`
- `src/flow/lib/run-prepare-spec.js`
- `src/lib/preparing-flow-store.js`
- `src/lib/flow-helpers.js`
- focused unit/e2e tests

## Requirements

- `flow set init` must never delete existing preparing runs.
- `flow prepare --run-id X` may delete only `X`, and only after successful state conversion.
- If `flow prepare --run-id X` fails at validation, agent, write, or conversion, `X` must remain intact.
- `init` and `prepare` must never modify or delete unrelated preparing runs.
- Unresolved preparing runs must not be disposed solely because they are older than 1 hour.
- Remove or disable global stale unlink/prune paths and obsolete TTL assumptions from production code and tests.
- Do not add a new cleanup/archive command in this minimal fix if none is already publicly supported.
- Preserve existing FlowStore/preparing-store ownership boundaries; do not add new dependencies or compatibility shims.
- Do not reconstruct or silently replace the missing #415 record.

## Acceptance Criteria

- [ ] If stale preparing run `A` exists for more than 1 hour, running `flow set init` to create run `B` leaves `A` byte-identical.
- [ ] If unrelated preparing run `A` exists, successful `flow prepare --run-id B` leaves `A` byte-identical and removes only `B`.
- [ ] If `flow prepare --run-id B` fails, both `A` and `B` remain unchanged.
- [ ] No hidden `init`/`prepare` path prunes unresolved preparing runs based only on elapsed time, including at 60+ minutes.
- [ ] Global stale unlink/prune helpers are removed from, or unreachable from, production paths.
- [ ] Tests that previously justified deleting 61-minute-old records are replaced with preservation/invariance tests.
- [ ] Target-record deletion happens only after successful conversion.
- [ ] If explicit cleanup/archive is not publicly supported, this issue does not introduce an implicit replacement; future deletion must be explicit, target-guarded, and auditable.
- [ ] Public `init`/`prepare` behavior stays unchanged except for removing stale global deletion.
- [ ] Focused unit/e2e tests pass and cover multiple preparing runs, isolation, and failure atomicity.

## Verification

- Compare run `A` record bytes/hash before and after `init B` and `prepare B`.
- Verify that successful `prepare B` removes only `B`, and only after active/spec conversion succeeds.
- Verify that validation, agent, write, and conversion failures preserve both `A` and `B`.
- Confirm no direct or indirect `init`/`prepare` call path still triggers global stale cleanup.
- Update prior TTL-based deletion tests to assert preservation and catch hidden prune regressions.

## Non-goals

- Reconstructing, inferring, or silently replacing the missing preparing run from #415
- Designing or implementing a new cleanup/archive command
- Implementing a target-guarded audited deletion operation
- Changing unrelated flow lifecycle behavior
- Adding new dependencies or public compatibility shims

</details>