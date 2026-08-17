# Feature Specification: 304-finalize-cleanup-readonly

**Feature Branch**: `feature/304-finalize-cleanup-readonly`
**Created**: 2026-06-17
**Status**: Draft
**Input**: GitHub Issue #396

## Goal
Prevent finalize-cleanup from dirtying the worktree it is about to remove, and make finalize-cleanup --force pass force removal through to dirty worktree teardown.

## Background
Spec #303 observed finalize-cleanup failing because the cleanup command itself appended agent metrics to specs/<spec>/flow.json inside the worktree it was about to delete. That made the target worktree dirty and caused git worktree remove to fail. Issue #396 identifies the CLI command as the root cause and requires finalize-cleanup to treat the target worktree as read-only after cleanup starts, while still preserving final state updates on the main repository side. The same issue also requires `--force` to actually perform force worktree removal when external dirtiness remains.

## Scope
- During `senti flow run finalize-cleanup`, all cleanup-time writes for flow state, metrics, notes, issue logs, plugin artifacts, and runtime-derived artifacts must target the main repository side or a durable cleanup location, not the worktree being removed.
- `senti flow run finalize-cleanup --force` must invoke force worktree removal for dirty external-state cases instead of retrying the same non-force removal path.
- Retained finalize-cleanup behavior must continue through the new write path: final flow state, finalize-cleanup step status, issue-log audit, embedded report, plugin hook result, runtime/metrics persistence, `.senti/last-finalized-spec`, active-flow clearing, worktree removal, and feature-branch deletion.
- Spec-local regression coverage must reproduce the cleanup-time flow.json metrics dirtying failure and the explicit dirty-worktree --force path.

## Out of Scope
- Changing finalize-commit, finalize-sync, or merge strategy behavior outside what finalize-cleanup needs for read-only teardown.
- Redesigning the plugin lifecycle API. This spec only constrains finalize-cleanup write destinations for existing cleanup hooks.
- Repairing historical Spec #303 artifacts or rewriting repository history.

## Constraints
- Use only Node.js built-in modules and existing project helpers.
- Do not add project-specific values to src/; Issue #396 and prior spec references stay in spec/test artifacts.
- The target worktree read-only boundary starts after finalize-cleanup argument validation once the cleanup target worktree is resolved.
- No retained public finalize-cleanup behavior is intentionally removed; behavior is retained with cleanup-time write ownership moved away from the target worktree.

## Design Principles
- Prefer existing FlowManager, FlowStore, FinalizeCleanupPathResolver, runtime log, plugin lifecycle, and git helper responsibilities over new parallel cleanup state mechanisms.
- Keep cleanup teardown transactional: final metadata is persisted before deleting the worktree, and recovery envelopes retain enough data for manual retry.
- Make force behavior explicit at the git worktree removal boundary so `--force` is observable in diff and tests.

## Overview
### Modules
- `src/flow/lib/run-finalize-cleanup.js` owns finalize-cleanup teardown, metadata sync, plugin lifecycle handling, report attachment, worktree removal, and feature branch deletion.
- `src/lib/finalize-cleanup-paths.js` resolves cleanup-time paths so writes that would target the removable worktree can be relocated to the main repository or durable agent work directory.
- `src/lib/flow-store.js` persists flow.json metrics and notes; finalize-cleanup must route these mutations to the durable owner once the target worktree is read-only.
- `src/lib/dispatcher.js` and `src/lib/runtime-log.js` own command runtime log completion after `run-finalize-cleanup.js` returns; post-command cleanup metadata must use non-worktree durable storage.

### Data Flow
- Before teardown removes the worktree, finalize-cleanup resolves `worktreePath` and `mainRepoPath`, syncs retained metadata to main, performs final state updates on the durable owner, then removes the worktree and branch.
- Cleanup-time metrics, notes, issue-log entries, runtime log pointers, and plugin hook artifacts must flow to main/durable locations so `git worktree remove` sees no cleanup-created changes in the target worktree.
- With `--force`, worktree teardown must pass a force flag to the git worktree removal operation when dirty files or initialized submodule state remain due to external causes.
- Post-command dispatcher/agent runtimeLog metadata and metrics created after the final flow.json snapshot is committed must not reopen or mutate that final flow.json; they must be written to a target-worktree-external durable sidecar or runtime log store.

### Decisions
- [VERIFY] finalize-cleanup teardown already centralizes the affected behavior in `run-finalize-cleanup.js`; this spec changes write routing and force removal, not the public command surface.
- [VERIFY] existing path relocation support should be reused for cleanup-time durable writes.
- Migration parity inventory: retained surfaces are the finalize-cleanup command, final flow.json commit, step status, issue-log audit, metrics/notes/runtime logs, plugin hook artifacts, report envelope, last-finalized pointer, active-flow clear, worktree removal, and branch deletion.
- Owner mapping: final flow state, step status, issue-log audit, metrics, notes, and report state belong to the main repo FlowManager/FlowStore or durable cleanup path after the read-only boundary.
- Transaction boundary: the final flow.json snapshot is committed before teardown deletion; dispatcher/agent metrics or runtimeLog metadata produced after command return use a durable sidecar and are not part of that final commit.
- Owner mapping: plugin hook artifacts and follow-up data remain observable through the plugin lifecycle result and durable artifact path, not through new files created inside the target worktree during cleanup.
- Force cleanup applies to dirty root files and initialized submodule dirty state when the user explicitly passed `--force`.

## Clarifications (Q&A)
- Q: Does this spec remove any finalize-cleanup public behavior?
  - A: No. It relocates cleanup-time writes away from the target worktree and preserves existing observable command behavior through main/durable owners.
- Q: When does target worktree read-only mode begin?
  - A: After argument validation, once finalize-cleanup has resolved the target worktree that may be deleted.
- Q: What does `--force` mean for this spec?
  - A: `--force` remains the explicit destructive recovery choice and must also be reflected at the git worktree removal call when dirty external state is present.

## Alternatives Considered
- Only prevent the known metrics append and leave other cleanup-time write surfaces unchanged. — Rejected because issue-log, notes, plugin artifacts, and runtime-derived writes can dirty the same target worktree and recreate the removal failure.
- Treat submodule dirty state as non-forceable even when `--force` is passed. — Rejected because Issue #396 requires force cleanup to be equivalent to git worktree remove --force for abnormal dirty cases.
- Move cleanup responsibilities into a new command. — Rejected because Issue #396 defines one finalize-cleanup concern and existing code already centralizes teardown in `run-finalize-cleanup.js`.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-17T08:27:45.458Z
- Notes: autoApprove: spec gate passed; approval prompt rendered and option [1] selected automatically.

## Requirements
- R1 [must]: After finalize-cleanup resolves the target worktree, cleanup-time flow state, metrics, notes, issue-log, runtime-derived, and plugin artifact writes must not create or modify files under that target worktree.
- R2 [must]: Retained finalize-cleanup surfaces must still be persisted or reported through the main repository FlowManager/FlowStore before the final flow.json commit, or through a durable non-worktree sidecar/runtime log for dispatcher and agent metadata produced after that commit.
- R6 [must]: After the final flow.json snapshot is committed during finalize-cleanup, dispatcher-owned runtimeLog completion and agent metric writes must not mutate the committed flow.json; they must persist to target-worktree-external durable storage.
- R3 [must]: `senti flow run finalize-cleanup --force` must call git worktree removal with force semantics for dirty root files and initialized submodule dirty state caused by external factors.
- R4 [must]: Spec-local regression tests must cover cleanup-time metrics append relocation, retained public finalize-cleanup surfaces, normal worktree removal, feature branch deletion, and dirty worktree force removal.
- R5 [should]: Existing finalize-cleanup report warnings, plugin hook warning/follow-up data, and recovery envelopes must remain available to callers after write relocation.

## Acceptance Criteria
- A regression test fails against the previous behavior where cleanup-time metrics append mutates the target worktree's specs/<spec>/flow.json before removal.
- The same regression test passes after cleanup-time metrics/notes/runtime writes are routed to main/durable storage and the target worktree remains unmodified by cleanup-created writes.
- A behavior-level test verifies final flow state, finalize-cleanup step status, issue-log audit, embedded report data, plugin hook output, last-finalized pointer, active-flow clear, worktree removal, and feature branch deletion through the retained path.
- A behavior-level test verifies dispatcher/agent metadata produced after finalize-cleanup command return is stored outside the target worktree and does not leave the main repo flow.json dirty after the final commit.
- A dirty worktree force-removal test verifies `--force` passes force semantics to git worktree removal for dirty root files.
- A submodule dirty force-removal test or existing submodule robustness test verifies `--force` uses force removal for initialized submodule dirtiness instead of returning the non-force dirty halt.

## Implementation Targets
- src/flow/lib/run-finalize-cleanup.js
- src/lib/finalize-cleanup-paths.js
- src/lib/flow-store.js
- tests/unit/flow/finalize-cleanup-robustness.test.js
- specs/304-finalize-cleanup-readonly/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Relocate cleanup writes
  - Route finalize-cleanup-time flow state, metrics, notes, issue-log, runtime-derived, and plugin artifact writes away from the target worktree after the read-only boundary.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Apply force teardown
  - Make `finalize-cleanup --force` pass force semantics to dirty worktree removal for root-file and initialized-submodule dirty states.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add cleanup regressions
  - Add spec-local and focused regression coverage proving read-only cleanup and migration parity for retained finalize-cleanup surfaces.
  - see `tasks/T-3.md` for full spec
