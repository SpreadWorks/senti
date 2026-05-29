# Feature Specification: 268-after-finalize-flow-json-of-other-active-flows-l

**Feature Branch**: `feature/268-after-finalize-flow-json-of-other-active-flows-l`
**Created**: 2026-05-29
**Status**: Draft
**Input**: GitHub Issue #345

## Goal
Prevent worktree-mode finalize from silently leaving another active flow's flow.json dirty in the main repository.

## Background
Issue #345 describes a concurrent-flow failure mode: a branch-mode flow and a worktree-mode flow can coexist, and after the worktree-mode flow finalizes, a different active flow's specs/<id>/flow.json can remain modified and unstaged in the main repository. The finalized worktree cannot see or commit that other main-repo-side file, and finalize-cleanup intentionally commits only its target spec's terminal metadata. The bugfix therefore needs two verifiable properties: current flow commands must not mutate other active flows' flow.json files, and cleanup must warn when another flow's dirty flow.json remains in the main repo instead of leaving it silent.

## Scope
- must: enforce or preserve that flow metadata writes performed by a flow command mutate only the selected current flow's authoritative flow.json.
- must: after worktree-mode finalize-cleanup, detect dirty specs/*/flow.json files in the main repository that do not belong to the finalized spec.
- must: prevent already-staged non-target specs/*/flow.json files from being included in the finalized flow's cleanup commit.
- must: surface detected other-flow dirty flow.json paths as a warning without committing, staging, deleting, or rescuing those files.
- must: add spec-local regression coverage for concurrent active flows where one worktree-mode finalize path must not silently orphan another flow's flow.json.
- should: keep single-flow finalize-cleanup behavior unchanged except for bounded no-op detection work.

## Out of Scope
- Changing GitHub Issue workflow semantics.
- Committing, staging, stashing, or auto-rescuing another active flow's metadata as part of the finalized flow.
- Changing finalize command names, user-facing options, or merge strategy behavior.
- Changing orphan commit recovery policy.
- Adding external dependencies, TypeScript, release commands, npm publish, or npm dist-tag operations.

## Constraints
- Use Node.js built-in modules and existing git/process/flow helpers only; do not add dependencies.
- src/ changes must be project-generic and must not encode observed repository names, spec ids, branch names, or commit shas from Issue #345.
- backward-compatible-cli-interface: `sdd-forge flow run finalize-cleanup` keeps its existing command name, flags, and option meanings. The new behavior is an additional warning for an already-successful cleanup path.
- exit-code-contract: successful finalize-cleanup remains ok:true / exit 0 when the only new condition is detected dirty other-flow flow.json files. Existing failure conditions such as commit failure, orphan recovery halt, dirty auto-rescue preflight, and invalid flags keep their current non-zero or fail-envelope behavior.
- validate-user-input-at-entry-point: no new user-facing arguments are added. Existing `--auto-rescue`, `--force`, and `--agent-work-dir` validation remains unchanged.
- bounded-resource-usage: dirty-flow detection must use bounded git status/index scans for specs/*/flow.json paths and exclude the finalized spec id. It must not recursively inspect all repository files or iterate over unbounded active-flow history.
- Before the target finalize-cleanup commit is created, staged non-target specs/*/flow.json entries must be detected and must not be included in the finalized flow's commit.
- No implementation may silently swallow git/status errors during the new warning path; errors must be logged, returned as warnings, or left to existing failure handling.

## Design Principles
- Each active flow owns its own flow.json writes; one flow's finalize must not assume responsibility for another flow's metadata snapshot.
- Visibility is preferred over implicit repair for other-flow dirty state, because automatically committing another active flow's metadata would cross flow ownership boundaries.
- The current spec's finalize transaction remains narrow: it commits the finalized spec's terminal metadata and reports external dirty metadata separately.
- Concurrent-flow tests should demonstrate both absence of cross-flow mutation and presence of warning visibility.

## Overview
### Modules
- src/flow/lib/run-finalize-cleanup.js - owns finalize-cleanup teardown, final flow.json commit, active-flow removal, and the response envelope that can carry warnings.
- src/flow/lib/flow-context.js - resolves the authoritative flow manager/state for the selected flow, including worktree-to-main authority after merge.
- src/flow/registry.js - wires flow command hooks and metric recording through the current command context and ctx.flowManager.
- src/lib/flow-manager.js and src/lib/flow-store.js - provide flow.json mutation surfaces that must continue to target the selected spec.
- specs/268-after-finalize-flow-json-of-other-active-flows-l/tests - spec-local coverage for concurrent flow metadata isolation and cleanup warning behavior.

### Data Flow
- worktree flow finalize-cleanup -> pre-commit staged non-target specs/*/flow.json safeguard -> commit target specs/<target>/flow.json -> clear target active-flow -> inspect main repo specs/*/flow.json dirty state -> attach warning.
- flow command context -> resolveFlowContext / selected specId -> ctx.flowManager mutation -> only the current authoritative flow.json is written.
- concurrent active flows -> one target worktree cleanup runs -> other active flow metadata remains owned by its own flow -> dirty state is reported, not auto-committed.

### Decisions
- [VERIFY] finalize-cleanup currently commits only target spec metadata.
- [CORRECTION] worktree authority switch must keep the selected spec id bound.
- [VERIFY] metric hooks use ctx.flowManager, so binding that manager fixes the integration path.
- Warn rather than repair other-flow dirty metadata.
- Limit dirty detection to specs/*/flow.json.

## Clarifications (Q&A)
- Q: What counts as another flow's flow.json?
  - A: A dirty main-repository path matching specs/*/flow.json whose spec id is different from the spec being finalized.
- Q: Does the finalized flow repair the other flow's dirty metadata?
  - A: No. It reports the path so the user can decide how that active flow should persist its own metadata.
- Q: Does the warning fail cleanup?
  - A: No. The warning is visibility for a concurrent-flow state after an otherwise successful cleanup. Existing cleanup failures keep their current behavior.
- Q: Does this spec add a new CLI argument?
  - A: No. The behavior is internal to existing flow command execution.

## Alternatives Considered
- Only warn about dirty other-flow flow.json files — Rejected because Issue #345 also identifies cross-flow metric writes as a root bug if present. The spec must lock the own-flow-only write invariant with tests.
- Auto-commit all dirty specs/*/flow.json files during finalize-cleanup — Rejected because it would let one flow persist another active flow's in-progress metadata without that flow's own command or finalize transaction.
- Fail finalize-cleanup when other dirty flow.json paths remain — Rejected because Issue #345 asks for a warning as short-term mitigation, and failing after a successful target cleanup would change the exit-code contract for a state the target flow does not own.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-29T00:42:23.139Z
- Notes: User selected [1] approve gate-passed spec.

## Requirements
- R1 [must]: Flow metadata writes performed through command context must target only the selected current flow's authoritative flow.json, including the post-merge worktree authority-switch path where the main repository is checked out to another active flow branch; regression coverage must show that another active flow's flow.json content is unchanged by a current-flow metric/context write.
- R2 [must]: After successful worktree-mode finalize-cleanup, the command must detect dirty main-repository paths matching specs/*/flow.json except the finalized spec's own flow.json, including staged non-target flow.json paths, and report those relative paths in a warning.
- R3 [must]: The target finalize-cleanup commit and the new warning path must not stage, commit, stash, reset, delete, or otherwise modify other active flows' flow.json files, including other-flow flow.json files that were already staged before cleanup.
- R4 [must]: When no other dirty specs/*/flow.json path remains, successful finalize-cleanup output must not include the new other-flow dirty warning.
- R5 [should]: Spec-local tests under specs/268-after-finalize-flow-json-of-other-active-flows-l/tests must cover R1 through R4 with // spec: R<N> headers.

## Acceptance Criteria
- Given two active flows exist, the current command runs from a worktree after authority has switched to the main repository, and the main repository branch corresponds to another active flow, a selected-flow metadata write changes the selected flow.json and leaves the other active flow.json byte-for-byte unchanged.
- Given worktree-mode finalize-cleanup succeeds and git status in the main repository contains ` M specs/<otherSpecId>/flow.json`, the cleanup envelope or stderr includes a warning code/message naming that relative path.
- Given `specs/<otherSpecId>/flow.json` is already staged before the target finalize-cleanup commit, that file is not included in the target flow's finalize commit and the warning names the staged non-target path.
- Given worktree-mode finalize-cleanup succeeds and the only dirty specs/*/flow.json path is the finalized spec's own path, the new other-flow dirty warning is absent.
- Given worktree-mode finalize-cleanup reports another dirty flow.json, git status after the command still shows that other flow.json with the same dirty state and no commit was created for it by the finalized flow.
- Given single-flow finalize-cleanup succeeds with no dirty other-flow flow.json paths, cleanup still returns ok:true / exit 0 and follows the existing teardown behavior.
- Spec-local tests contain // spec headers that collectively reference R1, R2, R3, R4, and R5.

## Implementation Targets
- src/flow/lib/run-finalize-cleanup.js
- src/flow/lib/flow-context.js
- src/flow/registry.js
- src/lib/flow-manager.js
- src/lib/flow-store.js
- specs/268-after-finalize-flow-json-of-other-active-flows-l/tests

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Lock metadata ownership
  - Verify and, if needed, constrain flow metadata writes so a command mutates only the selected current flow's authoritative flow.json, including after a worktree flow switches authority to the main repository.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Report dirty flow metadata
  - Add finalize-cleanup warning visibility for dirty main-repository specs/*/flow.json paths that belong to specs other than the finalized spec.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover concurrent finalize
  - Add spec-local regression coverage that ties the metadata ownership invariant and cleanup warning behavior to the Issue #345 concurrent-flow scenario.
  - see `tasks/T-3.md` for full spec
