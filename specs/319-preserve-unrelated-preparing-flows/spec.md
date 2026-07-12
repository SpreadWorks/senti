# Feature Specification: 319-preserve-unrelated-preparing-flows

**Feature Branch**: `feature/319-preserve-unrelated-preparing-flows`
**Created**: 2026-07-12
**Status**: Draft
**Input**: GitHub Issue #433

## Goal
Preserve every unrelated unresolved preparing-flow record across init and prepare, and consume only the selected record after successful preparation conversion.

## Background
Preparing records hold unresolved flow requests before flow.json exists. The current init and prepare paths globally remove records whose file modification time exceeds one hour, so an unrelated command can destroy unresolved state. Prepare also deletes its selected record before conversion operations complete. Issue #433 narrows the remedy to preventing future loss: records remain unresolved until their exact runId is successfully converted, while cleanup policy and historical reconstruction remain outside scope.

## Scope
- Remove age-based global preparing-record deletion from flow set init and flow prepare.
- Retain init creation and existing-run warning behavior without modifying pre-existing records.
- Delete only the run selected by flow prepare --run-id after preparation conversion succeeds.
- Preserve selected and unrelated preparing records when prepare fails before conversion completes.
- Replace obsolete TTL-deletion tests and add spec-local preservation, isolation, and failure-atomicity coverage.

## Out of Scope
- Reconstructing, inferring, or replacing the missing #415 preparing record.
- Adding cleanup, archive, audited deletion, or other preparing-record lifecycle commands.
- Changing target resolution, command syntax, flow lifecycle behavior outside init and prepare, or compatibility policy.

## Constraints
- Use Node.js built-in modules only; add no dependency.
- Preserve the existing FlowManager and PreparingFlowStore ownership boundary.
- Add no compatibility shim for TTL cleanup APIs removed by this alpha-version change.
- Do not reconstruct or silently replace any lost preparing record, including #415.
- Do not introduce an implicit or explicit cleanup/archive replacement in this issue.
- Keep PreparingFlowStore.list() bounded by PREPARING_SCAN_LIMIT at 100 runIds; init warning generation must not read or emit more than that limit.

## Design Principles
- Preparing state remains the retryable source until its selected conversion has succeeded.
- Deletion is explicit to the selected runId; unrelated records are never lifecycle side effects.
- Elapsed time alone does not authorize disposal of unresolved preparing state.
- Tests compare raw record bytes where the contract requires byte-identical preservation.

## Overview
### Modules
- src/flow/lib/set-init.js creates preparing records and warns when other preparing records already exist.
- src/flow/lib/run-prepare-spec.js converts a selected preparing record into worktree/spec/active-flow state.
- src/lib/preparing-flow-store.js owns per-run preparing record creation, loading, mutation, listing, and target deletion.
- src/lib/flow-manager.js exposes PreparingFlowStore operations to flow commands; src/lib/flow-helpers.js contains shared preparing constants.

### Data Flow
- flow set init lists at most PREPARING_SCAN_LIMIT (100) existing preparing runIds without writing or deleting their files, warns when the bounded list is non-empty, and creates one new runId record.
- flow prepare resolves and loads the selected runId, performs validation and conversion, then deletes that selected preparing record only after all successful conversion work completes.
- Any prepare failure before target deletion leaves selected and unrelated preparing record bytes unchanged, even if other preparation side effects require a later retry or external cleanup.

### Decisions
- [VERIFY] Remove init's global prune while retaining its existing-run warning from a non-mutating list.
- [VERIFY] Move selected-record deletion to the successful end of prepare conversion and remove global preparing cleanup from prepare.
- [VERIFY] Keep preparing-record persistence operations owned by PreparingFlowStore behind FlowManager.
- Migration parity inventory: affected commands are flow set init and flow prepare; affected internal APIs are FlowManager preparing delegates and PreparingFlowStore list/delete. CLI syntax, exported package APIs, config keys, and hook registration remain unchanged.
- Migration ownership map: init validation, issue caching, warning, and creation stay on SetInitCommand -> FlowManager -> PreparingFlowStore; prepare target resolution, conversion, and output stay on RunPrepareSpecCommand and existing helpers; selected deletion stays on FlowManager -> PreparingFlowStore and moves to post-success.
- Migration artifact and side-effect map: preparing files, spec/draft/issue/flow artifacts, branch/worktree creation, plugin/config synchronization, docs analysis, and active registry keep their current owners and order except selected deletion moves after success. Only implicit global TTL deletion is removed.

## Clarifications (Q&A)
- Q: Does preservation prevent prepare from deleting its selected source record?
  - A: No. Successful conversion consumes only the explicitly selected runId after every conversion operation succeeds.
- Q: Does a failed prepare need to roll back worktree or spec side effects?
  - A: This issue requires preparing-record byte preservation. Existing recovery behavior for other partial side effects remains unchanged and outside scope.
- Q: What replaces the removed one-hour cleanup behavior?
  - A: Nothing in this issue. Any future deletion operation must be designed separately as an explicit, target-guarded, auditable action.

## Alternatives Considered
- Retain TTL pruning but increase the threshold — Rejected because any elapsed-time threshold can delete unrelated unresolved state without explicit target authorization.
- Delete the selected record before conversion and reconstruct it on failure — Rejected because reconstruction cannot guarantee byte identity or preserve metadata added by other prelude operations.
- Add cleanup or archive commands now — Rejected because Issue #433 is a minimal prevention fix and explicitly excludes lifecycle design.
- Reconstruct the missing #415 record — Rejected because no tombstone or journal exists from which to recover exact historical bytes.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-12T20:24:16.908Z
- Notes: Parent pre-authorized routine Issue #433-preserving approval after guarded draft/spec review and gate PASS.

## Requirements
- R1 [must]: flow set init must leave every pre-existing preparing record byte-identical, including records older than one hour, while creating the requested new record and warning with the at-most-100 runIds returned by the existing PREPARING_SCAN_LIMIT-bounded list when that list is non-empty.
- R2 [must]: A successful flow prepare --run-id B must leave every unrelated preparing record byte-identical and delete only B after worktree/spec/flow conversion, docs validation, plugin lifecycle, and active-flow registration succeed.
- R3 [must]: If flow prepare --run-id B fails before successful conversion completes, B and every unrelated preparing record must retain their original bytes.
- R4 [must]: Production init and prepare call paths must contain no reachable global preparing-record deletion based on file age, and obsolete preparing TTL constants and prune helpers must be removed when they have no remaining caller.
- R5 [must]: flow set init must retain positive-integer issue validation, issue-body and request persistence, warning format for a non-empty at-most-100-runId list, and its runId/issue/issueBody/request response fields; flow prepare must retain target guards and input inheritance, branch/worktree/spec/draft/flow creation, docs validation, plugin lifecycle, active-flow registration, and its result/runId/issue/spec/worktreePath/changed/artifacts/next/output response fields.
- R6 [must]: Shared tests in the listed implementation targets and spec-local tests must cover multiple preparing records, records older than 60 minutes, byte-identical isolation, target-only successful deletion, and selected/unrelated preservation across prepare failure paths.

## Acceptance Criteria
- Given preparing record A with an mtime more than one hour old, flow set init creates B and the raw bytes of A before and after the command are equal.
- Given more than one preparing record, flow set init reports the at-most-100 runIds returned by PreparingFlowStore.list() in its warning and modifies none of the preparing files, including files beyond the warning scan limit.
- Given unrelated A and selected B, successful flow prepare --run-id B removes B only after conversion succeeds and leaves A bytes equal to their pre-command value.
- When prepare validation rejects B before conversion, raw bytes for A and B remain equal to their pre-command values.
- When agent, write, docs validation, plugin lifecycle, or active-flow conversion fails before completion, raw bytes for A and B remain equal to their pre-command values.
- Search and diff inspection show no init or prepare call to a global age-based preparing cleanup path and no obsolete one-hour preparing TTL deletion contract in production code.
- Existing init creation/warning and successful prepare behavior tests pass with only the intentional preservation semantics changed.
- Spec-local tests under specs/319-preserve-unrelated-preparing-flows/tests include requirement headers covering R1 through R6 and pass at integration scope.

## Implementation Targets
- src/flow/lib/set-init.js
- src/flow/lib/run-prepare-spec.js
- src/lib/preparing-flow-store.js
- src/lib/flow-manager.js
- src/lib/flow-helpers.js
- tests/unit/flow/set-init-cleanup.test.js
- tests/unit/flow/clean-stale-preparing-flows.test.js
- tests/unit/lib/flow-state-runid.test.js
- specs/319-preserve-unrelated-preparing-flows/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Remove implicit preparing cleanup
  - Make init and prepare enumerate or resolve preparing records within the existing 100-runId scan bound without global age-based deletion, and remove obsolete TTL cleanup surfaces.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Defer selected record deletion
  - Keep the selected preparing record intact until prepare conversion completes successfully, then delete only that runId.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover preparing record isolation
  - Provide spec-local behavioral evidence for preservation, target-only consumption, compatibility, and failure atomicity across the complete Issue #433 contract.
  - see `tasks/T-3.md` for full spec
