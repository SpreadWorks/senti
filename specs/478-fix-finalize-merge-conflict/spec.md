# Feature Specification: 478-fix-finalize-merge-conflict

**Feature Branch**: `feature/478-fix-finalize-merge-conflict`
**Created**: 2026-07-27
**Status**: Draft
**Input**: GitHub Issue #478

## Goal
Keep normal finalize-merge conflict recovery rebase-ready by automatically committing only Flow-owned conflict metadata before returning the rebase instruction.

## Background
Normal finalize-merge conflict handling restores the worktree and instructs the user to rebase, but the subsequent error lifecycle writes Flow-owned outbox, step, and issue-log evidence into that worktree. The guided rebase cannot start until that metadata is manually committed. Existing code already has an allowlisted metadata-only commit boundary and retry-state normalization; this change applies those guarantees to the normal conflict error boundary without changing direct-finalize or teardown ownership.

## Scope
- Normal worktree finalize-merge conflict handling, evidence persistence, clean-worktree recovery, retry state restoration, and idempotent merge/outbox completion.
- Metadata-only commits limited to the active spec's flow.json and issue-log.json.
- Unit, worktree CLI/E2E, and spec-local behavior coverage for actual conflicting branches.

## Out of Scope
- Automatic conflict-content resolution, user-owned change commits, squash/PR strategy changes, and skipping rebase.
- Redesign of direct finalize, durable teardown, or unrelated Flow lifecycle behavior.

## Constraints
- Use Node.js built-in modules only.
- Retain the existing worktree boundary: active-flow reads and writes remain inside the managed worktree until cleanup releases it.
- Do not add alpha compatibility aliases or preserve replaced state-write paths.
- Migration parity inventory: retain the user-facing `senti flow run finalize-merge` conflict hint and retry command, existing result-envelope and exit behavior, registry error/post hooks, no configuration changes, and flow.json/issue-log/runtime-log/outbox artifacts. Conflict detection continues to own hint generation; the finalize error lifecycle owns failure recording and the new scoped commit; retry lifecycle owns restoring downstream states. The normal merge path retains no metadata-only commit. Behavior-level E2E verifies conflict response, committed evidence, clean status, manual rebase, retry, exactly one merge/outbox completion, sync, and cleanup.

## Design Principles
- Persist Flow-owned conflict evidence before asking the user to perform a rebase.
- Treat any dirty path outside the active spec metadata boundary as a stop condition before lifecycle or Git mutation.
- Keep normal conflict recovery, retry state restoration, and merge/outbox idempotency as one observable transaction.

## Overview
### Modules
- src/flow/commands/merge.js detects normal worktree pre-merge conflicts and returns the manual rebase recovery instruction.
- src/flow/lib/run-finalize.js owns the active-spec metadata allowlist and safe metadata-only commit helper.
- src/flow/definition.js declares finalize error and retry lifecycle transitions.
- src/flow/registry.js executes finalize lifecycle hooks, outbox updates, and downstream-step transitions.
- tests/unit/flow/finalize-merge-retry.test.js covers failed-merge retry state behavior.
- src/flow/lib/run-finalize.js now owns the explicit conflict-metadata commit boundary, retaining the active-spec allowlist and conflict-specific commit subject.
- src/flow/lib/flow-outbox.js retains immutable per-attempt failure history across retry and completion.
- tests/unit/flow/finalize-merge-conflict-metadata.test.js covers the shared lifecycle contract for allowlisted conflict evidence and external-dirty preflight.
- Finalize lifecycle defers normal finalize-merge outbox mutation until the merge outcome, while preserving a committed retry reset when recovery resumes.

### Data Flow
- A normal pre-merge conflict is detected, the rebase is aborted, and the conflict result enters finalize-merge error lifecycle handling.
- Error lifecycle records the failed outbox, conflict reason, issue log, and skipped downstream steps; it then commits only flow.json and issue-log.json when the worktree has no external dirty path.
- The response leaves the worktree clean for user rebase. Retry restores finalize-sync and finalize-cleanup to pending, then executes merge/outbox side effects once and continues normal finalization.
- After the finalize error lifecycle records Flow-owned failure state, the conflict boundary can commit flow.json and issue-log.json without staging user-owned paths.
- The finalize-merge error route validates external dirtiness before mutation, then records failed outbox history, skipped downstream states, issue-log receipt, and the allowlisted evidence commit.
- Spec-local coverage now verifies the error message as the recovery instruction source, while shared unit coverage verifies the lifecycle mutation boundary.
- A normal merge receives a deterministic outbox idempotency key without writing Flow state; success initializes and completes its outbox in main-repository authority, while failure records and commits conflict metadata in the worktree.

### Decisions
- [VERIFY] Checked the active-spec metadata boundary; result=match.
- [VERIFY] Checked normal conflict recovery and retry state; result=match.
- Automatic metadata-only commit was selected because it saves Flow-owned evidence at the error boundary and lets the user begin the instructed rebase without a separate recovery command.
- Conflict evidence persistence is represented by a dedicated owner-level helper so lifecycle routing does not duplicate staging policy or commit messaging.
- Retry keeps the current outbox result idempotent while preserving prior failed attempts as durable evidence for the main-side snapshot.
- Recovery tests assert production lifecycle effects and Git state rather than treating the onError hook return value as a public recovery API.
- Use metadata-only commits exclusively for conflict evidence and recovery resets, never for a clean initial finalize-merge preparation.

## Clarifications (Q&A)
- Q: Does the automatic commit include user-owned source, test, docs, or unrelated spec files?
  - A: No. It is restricted to the active spec's flow.json and issue-log.json, and any other dirty path stops before mutation.
- Q: Does Flow resolve a rebase conflict automatically?
  - A: No. Flow saves its own evidence, leaves the worktree clean, and the user resolves the conflict through the existing manual rebase procedure.
- Q: Does this change direct finalize or teardown recovery?
  - A: No. Those Issue #473 contracts remain retained behavior and are regression-protected.

## Alternatives Considered
- Return a separate CLI-owned recovery command after the conflict. — Rejected by user decision because it adds a required command before rebase while the automatic scoped commit can make the worktree immediately ready.
- Commit all dirty paths before returning the rebase instruction. — Rejected because Flow must never commit user-owned or out-of-scope changes.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-27T14:43:16.354Z
- Notes: User approved automatic metadata-only conflict recovery specification.

## Requirements
- R1 [must]: After normal worktree finalize-merge conflict handling records failure state, Flow shall create one metadata-only commit containing only the active spec's flow.json and issue-log.json before returning the rebase instruction; git status --porcelain in the worktree shall then be empty.
- R2 [must]: The conflict metadata persisted by R1 shall include the conflict reason, failed finalize-merge outbox state, finalize-sync/finalize-cleanup skipped states, and issue-log evidence, and these records shall remain available in the final main-side snapshot after successful retry.
- R3 [must]: If any dirty path exists outside the active spec's flow.json and issue-log.json, Flow shall not create a commit, begin or alter the finalize-merge outbox, or alter step state; it shall return the exact path, `git status --short -- <path>`, and require a later `senti flow run finalize-merge` retry after user resolution.
- R4 [must]: Before a retry after resolved conflict, finalize-sync and finalize-cleanup shall change from skipped to pending; after retry success, finalize-merge shall be done, merge and outbox side effects shall execute exactly once, and downstream steps shall remain pending for normal execution.
- R5 [must]: The normal no-conflict finalize-merge path shall create no metadata-only commit. Direct finalize/cleanup shall update verification and integration records through the main-repository flow state after rebase, resume an interrupted completion from its saved transaction, complete teardown journal/receipt/cleanup through that main-repository state, and perform no import, filesystem read, lock validation, or log access against a deleted worktree.
- R6 [must]: Spec-local tests with `// spec: R<N>` headers shall cover R1 through R5, and shared unit plus worktree CLI/E2E tests shall exercise actual conflict detection, evidence commit, clean rebase preparation, manual rebase, retry, one merge/outbox completion, sync, and cleanup.

## Acceptance Criteria
- An actual normal finalize-merge conflict returns the rebase instruction only after a commit limited to the active spec flow.json and issue-log.json, and the worktree is clean.
- A final main-side snapshot after rebase and retry retains conflict reason, runtime metadata, failed outbox, downstream step history, and issue-log evidence.
- An external dirty path returns that path plus `git status --short -- <path>` without a Flow mutation, outbox change, or metadata commit.
- Retry changes finalize-sync/finalize-cleanup from skipped to pending and completes merge/outbox effects once before normal sync and cleanup.
- No-conflict merge creates no additional metadata commit; direct-finalize tests confirm post-rebase main-repository verification/integration records, saved-transaction resume, main-side teardown completion, and no access to a deleted worktree.
- Spec-local tests under specs/478-fix-finalize-merge-conflict/tests/ cover R1 through R6 with required headers.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Persist conflict metadata
  - Commit allowlisted normal-conflict evidence after failure state is recorded and before the recovery hint returns.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Route conflict lifecycle
  - Integrate scoped metadata persistence into the normal finalize-merge error lifecycle while retaining retry state and side-effect contracts.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Verify conflict recovery
  - Add behavior-level spec-local and worktree CLI/E2E coverage for the complete normal conflict recovery path.
  - see `tasks/T-3.md` for full spec
