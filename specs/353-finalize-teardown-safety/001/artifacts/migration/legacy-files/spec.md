# Feature Specification: 353-finalize-teardown-safety

**Feature Branch**: `feature/353-finalize-teardown-safety`
**Created**: 2026-07-27
**Status**: Draft
**Input**: GitHub Issue #473

## Goal
Make finalize persist an explicit transaction at every destructive boundary, perform at most one retry per invocation against the recorded target, keep sync output outside the removable worktree, and complete without accessing a removed worktree.

## Background
Finalize spans persistence, Git state, generated output, worktree deletion, branch deletion, flow authority, and response construction. A failure at any boundary must leave a replayable old or new state with at most one retry per invocation. Impact on existing features: finalize commands, registry hooks, docs and analysis artifacts, flow state, outbox, report pointer, runtime logs, and cleanup side effects retain public contracts while their owner changes. Existing code already has staged cleanup and main-repository sync routing, but Issue #473 requires that every boundary use durable ownership and that no post-cleanup path reopens the removed worktree.

## Scope
- Journaled persistence for merge outcome, finalize metadata, authority deletion, worktree removal, branch deletion, validation, pointer publication, and active-flow clearing.
- At most one exact retry per invocation and foreign-target protection after authority deletion.
- Finalize-sync output paths that do not dirty the worktree scheduled for cleanup.
- Teardown-safe completion context for logger, dispatcher, post-hook, filesystem, module resolution, and result-envelope handling.
- Single ownership path for flow.json mutation and fault-matrix or lifecycle coverage for retained finalize behavior.

## Out of Scope
- Unrelated flow lifecycle changes, new external dependencies, and unrelated CLI behavior changes.
- Removal or renaming of existing finalize commands, options, result-envelope fields, or exit-code contracts.

## Constraints
- Use Node.js built-in modules only.
- Represent new structured transaction, authority, and completion values with classes that enforce constructor invariants.
- Do not retain compatibility aliases for replaced state-write paths during alpha development.
- Migration parity inventory: retain user-facing commands `finalize-commit`, `finalize-merge`, `finalize-sync`, and `finalize-cleanup`; their options; orphan recovery; JSON envelopes; and exit codes. Retain the finalize command APIs, registry lifecycle hooks, and main-repository authority routing. Retain no config entry changes. Retain generated docs, analysis output, flow.json, outbox, report pointer, and runtime-log artifacts. Retain commit, sync, worktree removal, branch removal, pointer publication, and active-flow-release side effects. The journal transaction owns checkpoints and retry identity; the main-repository FlowManager mutation path owns lifecycle state; the sync root owns generated output; and the completion snapshot owns post-cleanup reporting. Tests verify each retained command, hook/state update, artifact, and side effect through the replacement owner.
- Keep all active-flow work inside the managed worktree until finalize-cleanup releases it.

## Design Principles
- Persist the next replay point before beginning its destructive operation.
- Resolve cleanup identity from durable metadata rather than rescanning an ephemeral worktree.
- Snapshot every post-cleanup value before deletion and make completion depend only on the snapshot and durable main-repository state.
- Use one mutation owner for flow.json so concurrent paths and at-most-one-retry paths cannot select conflicting state transitions.

## Overview
### Modules
- src/flow/lib/run-finalize-cleanup.js owns cleanup transaction execution, durable replay, teardown validation, pointer publication, and active-flow release.
- src/flow/lib/run-finalize.js provides shared finalize persistence and commit helpers.
- src/flow/lib/run-finalize-sync.js builds generated output and commits it during finalize-sync.
- src/flow/registry.js routes finalize lifecycle hooks and switches merge-onward mutations to main-repository flow authority.
- FinalizeTeardownCheckpoint in run-finalize-cleanup.js represents the single durable next boundary while FinalizeTeardownTransaction enforces phase order.
- FinalizeCommitExpectation and FinalizeTeardownTransaction jointly own durable cleanup target identity, including transaction, repository, branch, worktree path, and object IDs.
- RunFinalizeSyncCommand owns injectable build, Git staging, and commit boundaries while retaining its existing command surface.
- Dispatcher finalize-cleanup handling owns retained runtime logging and post-return metadata persistence through the main-repository FlowManager.
- Main-repository FlowManager and its FlowOutboxStore are the sole production mutation path for finalize lifecycle flow.json state.
- specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js provides the requirement-tagged finalize fault matrix for R1 through R7.

### Data Flow
- Finalize records transaction identity and the next checkpoint before each commit, authority, worktree, branch, validation, pointer, and active-flow transition.
- At most one retry per invocation reads the persisted transaction and validates its recorded target before resuming only unfinished checkpoints.
- Finalize-sync generates output in the retained repository path, then cleanup removes the recorded worktree and returns a completion envelope assembled from retained values.
- Finalize persists a checkpoint before each lifecycle boundary, performs the boundary once, then durably advances the completed phase; recovery adopts or resumes only that recorded checkpoint.
- Checkpoint replay loads the identity-keyed journal, validates it against current Flow state, and rechecks worktree, feature ref, base reachability, and binding authority before deletion.
- For managed worktrees, finalize-sync resolves the retained main repository once and uses it as the cwd for build, stage, diff inspection, and commit; the removable worktree receives no generated output.
- Before teardown, cleanup snapshots FlowCompletion, plugin results, report root, main manager, and metadata; after worktree removal, dispatcher output, warnings, runtime logs, and metadata use only those retained values.
- Registry and cleanup resolve main authority before lifecycle transitions; checkpoint journals retain retry identity separately while all step, outbox, and active-flow state changes use the main FlowManager.
- The spec-local suite injects each durable checkpoint boundary, replays the single recorded unfinished phase, rejects changed cleanup identities, and verifies retained-root sync, teardown-safe reporting, success envelopes, and centralized state ownership.

### Decisions
- [VERIFY] Checked cleanup lifecycle state; result=match.
- [VERIFY] Checked sync execution root; result=match.
- [VERIFY] Checked merge-onward hook authority; result=match.
- Impact on existing features: retained finalize commands, hooks, artifacts, and cleanup side effects keep their public contracts while their internal owner changes.
- Encode the checkpoint in the existing teardown result record so transaction persistence remains one atomic journal write without introducing a second state file.
- Reuse the existing transaction and commit-expectation value classes as the single cleanup target authority instead of adding a parallel recovery identity.
- Treat the retained repository cwd as one execution invariant across every finalize-sync side effect and verify it with an integration-style command-boundary test.
- Successful cleanup warnings remain warning entries on an ok:true envelope and do not change exit code 0; no post hook reloads the removed worktree.
- Keep journals and metadata sidecars as separate durable artifacts, but prohibit them from directly replacing or rewriting flow.json.
- Use one behavior-level spec-local suite to cover every finalize contract while retaining shared regression tests unchanged.

## Clarifications (Q&A)
- Q: Does this spec change finalize CLI commands or recovery options?
  - A: No. Existing commands, options, orphan handling, result envelopes, and exit contracts remain retained surfaces.
- Q: Can at most one retry per invocation discover a cleanup target by scanning an old worktree path?
  - A: No. At most one retry per invocation uses recorded durable metadata and verifies that identity before destructive work.
- Q: May post-cleanup diagnostics reload worktree-owned files?
  - A: No. Completion uses values captured before deletion and durable main-repository state only.
- Q: Does the preimplementation scenario-validity artifact prove R7 runtime coverage?
  - A: No. This Flow used the audited preimplementation-bootstrap transition because implementation-target changes already existed, so scenario-validity and test-review are intentionally skipped while their preflight block remains preserved. R7 source coverage is reviewed during task implementation, and the spec-level test-execute step is the sole runtime execution authority after implementation.

## Alternatives Considered
- Continue using multiple direct flow.json writers with an ordering convention. — Rejected because Issue #473 requires one ownership path and concurrent or at-most-one-retry writers would preserve ambiguous transition authority.
- Re-rescan the worktree after authority deletion to reconstruct retry state. — Rejected because the worktree is ephemeral and at most one retry per invocation must verify the same recorded target without trusting a rescanned path.
- Perform docs generation in the cleanup worktree then remove its residue. — Rejected because cleanup must receive a clean target; retained-repository generation avoids creating cleanup residue.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-27T09:31:43.174Z
- Notes: Auto approval selected during flow setup.

## Requirements
- R1 [must]: Finalize cleanup shall persist a validated transaction checkpoint before each destructive persistence, authority, worktree, branch, validation, pointer, and active-flow transition, and at most one retry per invocation shall resume only from the recorded unfinished checkpoint.
- R2 [must]: After authority deletion, at most one retry per invocation shall resolve the recorded worktree, feature branch, base branch, and transaction identity exactly; it shall reject a missing, changed, or foreign target before deletion.
- R3 [must]: Finalize-sync shall generate and commit documentation or analysis output from the retained repository path so the worktree selected for cleanup has no generated or untracked residue before removal.
- R4 [must]: After worktree removal, completion paths shall use only pre-deletion snapshots and durable main-repository state; they shall not dynamically import from, read from, validate locks against, or log the removed worktree path.
- R5 [must]: Successful cleanup shall return an ok: true envelope with exit code 0, and later warnings or post-processing shall not change that success result into a failure.
- R6 [must]: Production flow.json updates for finalize lifecycle transitions shall pass through one main-repository FlowManager mutation owner: journal checkpoints retain at-most-one-retry identity, registry hooks retain step transition behavior through that owner, outbox completion retains idempotency state through that owner, and replaced direct writers are removed without removing any user-facing behavior.
- R7 [must]: Spec-local tests shall cover each requirement with // spec: R<N> headers, including persistence-boundary fault cases, at-most-one exact-target retry per invocation, clean sync, removed-worktree avoidance, success-envelope consistency, and state-write ownership.
- R8 [should]: If implementation changes documented flow internals, documentation shall be regenerated through finalize-sync; otherwise documentation changes shall be absent.

## Acceptance Criteria
- Fault injection or process termination at every R1 persistence boundary leaves either the prior checkpoint or the next checkpoint, and at most one exact retry per invocation reaches completion without selecting another target.
- A merge-outcome or finalize-metadata persistence failure returns before cleanup begins.
- An altered or foreign worktree, branch, or transaction identity is rejected before deletion.
- After finalize-sync, the recorded cleanup worktree has no generated or untracked residue attributable to sync.
- After cleanup, tests observe no import, filesystem read, lock validation, or logger context using the removed worktree path.
- A successful worktree and branch deletion produces ok: true and exit code 0 despite later non-fatal warnings.
- Source inspection and tests show one production owner for finalize flow.json lifecycle mutations.
- Spec-local tests under specs/353-finalize-teardown-safety/tests/ cover R1 through R7 with required headers.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Journal finalize checkpoints
  - Record and validate the finalize transaction checkpoint for every destructive lifecycle boundary.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Validate exact cleanup targets
  - Bind at most one retry per invocation and destructive cleanup to the recorded target identity.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Isolate finalize sync output
  - Generate finalize-sync output outside the removable worktree.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Snapshot teardown completion
  - Complete cleanup without accessing a removed worktree.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Centralize finalize state writes
  - Route finalize lifecycle flow.json updates through one owner.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Cover finalize fault matrix
  - Add spec-local behavior coverage for the finalize contracts.
  - see `tasks/T-6.md` for full spec
