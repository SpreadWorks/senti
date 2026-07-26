# Feature Specification: 350-4078-make-prepare-transaction-and-lock-recovery-

**Feature Branch**: `feature/350-4078-make-prepare-transaction-and-lock-recovery-`
**Created**: 2026-07-26
**Status**: Draft
**Input**: GitHub Issue #472

## Goal
Make flow preparation failure-atomic: lock-owning operations are Linux-only, corrupt preparing state fails closed, and an interrupted prepare can be completed only by an exact retry without altering another run's branch, worktree, active-flow entry, state, or lock.

## Background
Preparation currently coordinates repository authority, a branch/worktree, and flow state. Partial failure must not cause corrupt state to be treated as absent, reclaim uncertain ownership, or leave a retry unable to determine which resources it owns.

## Scope
- Linux process identity and process-owned lock behavior for flow mutations.
- Fail-closed preparing-flow state persistence and ownership recovery.
- Failure-atomic worktree/local prepare with a durable exact-retry journal and fault-injection coverage.

## Out of Scope
- Non-Linux lock ownership support during the alpha period.
- Unrelated flow lifecycle changes, foreign-flow recovery, dependency additions, or package publication.

## Constraints
- Use Node.js built-ins and existing class-based value and error patterns.
- Unsupported or unavailable process identity fails before lock or state mutation.
- A live or unknown lock owner is never removed; stale recovery requires a provably dead owner.
- Corrupt or truncated preparing state is a typed failure, never a missing-state fallback.

## Design Principles
- Process identity is the sole authority for ownership recovery.
- Each runId has at most one journal; one retry invocation validates and consumes that journal, and successful completion or rollback removes it.
- Foreign authority is preserved before local recovery is attempted.

## Overview
### Modules
- `process-identity.js` creates Linux owner identity and assesses live, stale, and unknown owners.
- `process-owned-lock.js` publishes and releases ownership-checked locks.
- `preparing-flow-store.js` serializes preparing state mutation under a process-owned lock.
- `run-prepare-spec.js` coordinates journaled worktree preparation, rollback, and exact retry.

### Data Flow
- Prepare records an owned attempt journal before repository mutation, then publishes worktree, state, binding, registry, and completion in order.
- A retry validates the same request and owned journal before completing or rolling back only attempt-owned resources.
- T-1 validates Linux process identity before process-owned lock publication and preparing-flow mutation.
- T-2 turns unreadable preparing-flow persistence into PREPARING_FLOW_CORRUPT instead of treating it as absent.
- T-3 journals worktree preparation before mutation, validates exact retries, and exposes every durable publication checkpoint for interruption testing.

### Decisions
- [VERIFY] Existing process identity already models Linux boot identity and process-start fingerprint. result=match: extend the same authority contract across lock and preparing-state mutation.
- [VERIFY] Existing worktree prepare has a durable attempt journal and ownership-checked rollback. result=match: make all failure boundaries observable and exact-retry safe.
- Migration parity: valid `set init` remains owned by PreparingFlowStore; valid `prepare --run-id` and status/next-action remain owned by FlowManager/prepare command; preparing state and lock remain owned by PreparingFlowStore/ProcessOwnedLock. Corrupt-state missing fallback is removed and replaced by typed failure. Branch, worktree, registry, lock, and foreign flow are retained unchanged on rejected or failed attempts.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Treat unreadable preparing state as missing. — Rejected: it can overwrite incomplete or foreign authority.
- Use PID existence alone for stale recovery. — Rejected: PID reuse cannot prove ownership.
- Allow compatible-but-different prepare retries. — Rejected: retry would be able to adopt resources from another request.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-26T01:10:22.258Z
- Notes: User approved #472 specification

## Requirements
- R1 [must]: On non-Linux platforms or unavailable process identity, lock creation and preparing-flow mutation return a typed non-zero failure before any lock, state, branch, or worktree mutation.
- R2 [must]: On Linux, a lock is reclaimed only when boot identity and process-start fingerprint prove the stored owner is dead; live and unknown owners remain untouched.
- R3 [must]: Unreadable, truncated, or corrupt preparing-flow state returns a typed fail-closed error and is not interpreted as missing by prepare, status, or next-action handling.
- R4 [must]: A failed prepare leaves either no attempt-owned mutations or one durable journal per runId; one retry invocation requires the same runId, Issue, request, branch, worktree path, and base revision, while a different retry is rejected without mutation. Completion or rollback removes the journal.
- R5 [must]: Fault injection at journal publication, worktree-and-branch creation, exclusion registration, planning-state publication, identity binding, registry publication, preparing-flow removal, and journal completion proves R4 and preserves foreign authority.

## Acceptance Criteria
- AC1: darwin and win32 fixtures reject lock/state mutation before filesystem mutation.
- AC2: Linux fixtures preserve live and unknown locks, recover only boot-mismatched, missing-PID, or PID-reused owners, and retain existing ownership checks.
- AC3: corrupt preparing state produces a typed error; valid state still prepares; status/next-action never report corrupt state active.
- AC4: every R5 failure boundary permits only exact retry and leaves no altered foreign branch, worktree, registry, state, or lock.
- AC5: focused unit and spec-local tests map R1–R5 to behavior-level evidence.

## Implementation Targets
- package.json
- src/lib/process-identity.js
- src/lib/process-owned-lock.js
- src/lib/preparing-flow-store.js
- src/flow/lib/run-prepare-spec.js
- src/flow/lib/run-review.js
- tests/unit/lib/preparing-flow-store-atomic.test.js
- tests/unit/lib/process-owned-lock-failure-semantics.test.js
- tests/unit/flow/commands/review.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Enforce process identity platform contract
  - Apply Linux-only typed identity failure consistently before lock-owning flow mutation.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Fail closed for preparing state
  - Make invalid preparing state a typed failure while retaining valid-state behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Journal prepare retries
  - Preserve one bounded exact-retry invocation per journal across every prepare persistence boundary.
  - see `tasks/T-3.md` for full spec
