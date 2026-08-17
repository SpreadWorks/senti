# Feature Specification: 327-approval-task-sync-atomic

**Feature Branch**: `feature/327-approval-task-sync-atomic`
**Created**: 2026-07-22
**Status**: Draft
**Input**: GitHub Issue #451

## Goal
Make approval completion and spec task synchronization one atomic flow-state update so no outcome can persist only one side of the combined state.

## Background
Approval completion currently writes `approval=done` before a separate task-sync mutation. The sync helper then resolves flow authority again and suppresses several load failures, so approval can remain complete while tasks are absent. The flow store already supports a concrete commit intent inside the same target-bound atomic mutation as a step transition. Issue #451 uses that existing extension point to eliminate the split commit without broadening the transaction model.

## Scope
- Make the `approval` done transition and additions derived from `spec.json.tasks` commit through one target-bound flow-state write.
- Return spec load, parse, validation, target mismatch, and flow-state write failures to the caller without warning-success fallback or partial task state; preserve old bytes for uncommitted failures and a complete combined state for `committed:true` durability failures.
- Reject concurrent revision drift between approval task preparation and commit without replacing the concurrent winner or implicitly re-resolving the target.
- Keep one retry with the same input deterministic and idempotent after a failed attempt.
- Preserve the existing approval happy path, task mapping, round assignment, pending-task promotion, `tasksSynced` result, and #443 target/revision guards.
- Cover the failure matrix, retry behavior, and retained success contract in spec-local and focused approval-task-sync tests.

## Out of Scope
- Task lifecycle changes unrelated to approval-time synchronization.
- Review, gate, finalize, cleanup, or external reviewer tooling changes.
- A general transaction framework or changes to flow mutations outside approval task synchronization.
- Fallbacks, allowlists, dependency additions, skipped tests, reduced assertions, or compatibility adapters for malformed specs.

## Constraints
- Product changes are limited to `src/flow/lib/set-step.js` and `src/flow/lib/sync-spec-tasks.js`; tests may change only to add direct Issue #451 regression evidence.
- Use Node.js built-in modules only and add no external dependency.
- Represent the prepared task-sync mutation as a dedicated class with constructor invariants, and integrate it through the existing `StepTransitionCommitIntent` contract rather than an object-literal mutation descriptor.
- Do not weaken or bypass the resolved target identity, transition policy, or revision-aware atomic writer introduced by #443.
- Preserve the atomic writer's existing commit boundary: failures before rename report `committed:false` and retain old bytes, while failures after rename report `committed:true` and retain the complete renamed state.
- Do not add an internal retry loop. Verification exercises exactly one caller retry after a failed attempt.
- Spec-local behavior coverage must live under `specs/327-approval-task-sync-atomic/tests/` and carry a `// spec: R<N>` header.

## Design Principles
- Load and validate the active spec and prepare the task additions before the flow-state commit begins.
- Commit approval status, timestamps, next-step promotion, and prepared task additions through the already-resolved flow manager in one atomic mutation.
- Bind the combined commit to the exact flow-state revision used to prepare task additions; do not recompute from or merge into a newer revision implicitly.
- Treat an active flow with a missing, malformed, or invalid spec as a caller-visible failure; only the absence of any active flow may retain the existing explicit no-active result for the standalone helper.
- Keep task construction and append-only deduplication in `sync-spec-tasks.js`, while `set-step.js` remains the owner of approval transition orchestration.
- Validate retained behavior at the public set-step boundary and at the task-sync module boundary.

## Overview
### Modules
- `src/flow/lib/sync-spec-tasks.js` loads and validates the active spec, computes append-only flow tasks, and owns a concrete task-sync commit intent that applies prepared additions to the same flow-state object.
- `src/flow/lib/set-step.js` prepares approval-time task synchronization before mutation and passes its commit intent with the validated approval transition to the resolved `FlowManager`.
- The existing `FlowStore.updateStepStatus` path remains the sole durable commit point and applies `StepTransitionCommitIntent` inside the same revision-aware mutation as the step transition.
- `SpecTaskSyncCommitIntent` owns the validated append-only task batch and applies task insertion plus pending-task promotion inside the existing step-transition mutation.

### Data Flow
- For `approval=done`, set-step resolves the active flow once, validates approval eligibility, loads and validates that flow's spec, and prepares only task ids not already present. Any preparation failure returns before flow mutation.
- The resolved flow manager commits the approval transition and prepared task-sync intent together. An uncommitted writer failure preserves previous bytes; a post-rename `committed:true` durability failure retains the complete combined state, never one side.
- After commit, the command reports the prepared added task ids through `tasksSynced`; a failed attempt can be retried once without observing or duplicating a partial update.
- Approval completion prepares task additions from the initially loaded flow state, then passes both that state as `expectedOriginal` and the prepared intent to `updateStepStatus` for one revision-bound commit.

### Decisions
- [VERIFY] The current approval path persists the step transition before invoking task sync, and converts sync exceptions into warning-success.
- [VERIFY] The current sync helper resolves a second flow manager and treats active-flow load errors and missing or malformed specs as skipped synchronization.
- [VERIFY] The existing commit-intent extension point can apply task additions in the same atomic mutation as the approval transition.
- [CORRECTION] The draft's write-failure invariant is split at the existing atomic rename boundary: uncommitted failures retain old bytes, while `committed:true` durability failures retain one complete combined new state.
- [CORRECTION] Approval task preparation must bind commit to the initial loaded revision instead of relying only on target identity.
- Migration parity retains the `senti flow set step approval done` success surface, `tasksSynced` ids, append-only deduplication, task fields, round assignment, and pending promotion; active-spec failures intentionally change from warning-success to explicit failure.
- The standalone sync helper reuses the same preparation intent and revision check; only the absence of an active flow remains a skipped result, while active-flow state and spec failures propagate.

## Clarifications (Q&A)
- Q: What is the atomic boundary?
  - A: The existing target-bound `FlowStore.updateStepStatus` mutation is the sole durable commit. The approval transition and a concrete prepared task-sync commit intent are applied to the same in-memory state before one atomic write.
- Q: What does target mismatch mean for task synchronization?
  - A: Task synchronization uses the flow state already resolved and guarded for set-step. It does not resolve a second active flow. The combined commit passes the initially loaded state as `expectedOriginal`, so any run/spec/issue mismatch or preparation-time revision drift fails through the existing #443 path before the losing mutation is written.
- Q: Which skipped result remains valid?
  - A: A direct standalone sync call with no active flow may retain the existing explicit no-active result. Once an active flow exists, a missing spec path or unreadable, malformed, or invalid spec is an error and is never treated as synchronization not being required.

## Alternatives Considered
- Synchronize tasks first, then mark approval done. — Rejected because a later step write failure would leave tasks persisted while approval remains incomplete, reversing rather than eliminating the partial update.
- Keep two writes and roll back the first write when the second fails. — Rejected because rollback is another fallible write and cannot guarantee byte-identical state, timestamps, promotion, or concurrent target revision behavior.
- Introduce a general multi-resource transaction framework. — Rejected because both values already share flow.json and the existing commit-intent hook provides the required single-write boundary; a broader framework exceeds Issue #451.
- Continue warning and allow retry to repair tasks later. — Rejected because the caller observes false success and retrying an already-terminal approval cannot reliably reconstruct the missing atomic update.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-22T00:56:36.673Z
- Notes: Auto-approved under the user-enabled autoApprove policy after ADVISORY review with zero blocking findings and an independent spec-gate PASS.

## Requirements
- R1 [must]: When the current target completes `approval`, the approval status and timestamps, definition-driven next-step promotion, and every newly derived spec task shall be persisted through one target-bound atomic flow-state mutation. A failure with `committed:false` shall retain the complete pre-update bytes and logical state; a post-rename failure with `committed:true` shall retain the complete combined new state. No failure may persist approval without tasks or tasks without approval.
- R2 [must]: Missing, malformed, or invalid active-flow spec input, any guarded run/spec/issue target mismatch, and any revision drift after task preparation but before commit shall return a caller-visible failure before the combined mutation. These failures shall not be converted to warnings or skipped synchronization, shall not select or replace a foreign/concurrent winner flow, shall perform no implicit re-resolution or retry, and shall leave the losing approval/task state unchanged while preserving #443 target and revision checks.
- R3 [must]: One caller retry with the same logical input shall be deterministic and idempotent: an unchanged pre-commit, parse, validation, or target-mismatch condition shall repeat the same failure with unchanged state; removing that condition shall produce the same single success state as a clean first attempt; and retry after a `committed:true` failure shall leave the already-complete combined state unchanged with no duplicate task or promotion.
- R4 [must]: The retained happy path shall append only previously absent spec task ids and preserve each task's spec path, origin, parent, initial status and steps, empty requirements, null summary, computed `added_round`, pending-task promotion, and command `tasksSynced` result. The standalone no-active-flow result may remain explicit, but active-flow spec load errors shall propagate; no unrelated lifecycle, tooling, dependency, allowlist, skip, or assertion behavior shall change.

## Acceptance Criteria
- AC1 [R1]: An injected pre-rename atomic flow-state write failure during `approval=done` returns `committed:false` and leaves the complete flow.json bytes, approval status/timestamps, current step, and task collection equal to the pre-attempt snapshot; an injected post-rename durability failure returns `committed:true` and the persisted file contains both completed approval and all prepared tasks with no partial combination.
- AC2 [R2]: Missing spec, malformed JSON, schema-invalid tasks, and guarded run/spec/issue mismatch each return a caller-visible failure before mutation; stderr warning-success and foreign-flow selection do not occur, and approval/task snapshots remain unchanged. A dedicated approval-path fixture changes flow.json after task preparation but before commit and proves the loser returns `FLOW_STATE_ATOMIC_STALE` with `committed:false`, performs no implicit retry/re-resolution, and preserves the concurrent winner bytes exactly.
- AC3 [R3]: Repeating each AC1-AC2 pre-commit failure once with unchanged input and fault yields the same failure and unchanged bytes; retry after removing only that fault yields the same state as a clean first-attempt success. Retry after `committed:true` leaves the complete committed state unchanged, with each task id and promotion present exactly once.
- AC4 [R1, R4]: The approval happy path performs one flow-state commit containing `approval=done` and all new tasks, returns the new ids once in `tasksSynced`, and preserves append-only deduplication, task field mapping, round assignment, and pending-task promotion.
- AC5 [R2, R4]: The task-sync module distinguishes no active flow from a broken active-flow spec: no active flow retains its explicit skipped result, while active state load errors and missing, malformed, or invalid spec input throw or return a failure that set-step propagates.
- AC6 [R1-R4]: Spec-local tests under `specs/327-approval-task-sync-atomic/tests/` carry `// spec: R1 R2 R3 R4` coverage, focused approval-task-sync and related transition/writer tests remain enabled without assertion reduction or skip, and the fixed commit passes an independent AC audit before the single full `npm test` run.

## Implementation Targets
- src/flow/lib/set-step.js
- src/flow/lib/sync-spec-tasks.js
- tests/unit/flow/approval-task-sync.test.js
- specs/327-approval-task-sync-atomic/tests/approval-task-sync-atomic.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Commit approval task sync atomically
  - Prepare approval-time task additions before mutation and apply them with the approval transition through the existing target-bound atomic writer.
  - see `tasks/T-1.md` for full spec
