# Feature Specification: 219-fix-resolve-context-main-repo

**Feature Branch**: `feature/219-fix-resolve-context-main-repo`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #234

## Goal
- Fix the `flow get resolve-context` / `flow run resume` CLI commands so that, when invoked from inside a git worktree created by `flow prepare --worktree`, the returned `mainRepoPath` points to the primary repository (the worktree's owner) instead of the worktree itself.

## Background
- `flow prepare --worktree` creates an isolated worktree under `.sdd-forge/worktree/<branch>/` and the AI agent `cd`s into that worktree for the duration of the flow.
- The finalize skill (`SKILL.md`) instructs the agent to obtain `mainRepoPath` via `sdd-forge flow get resolve-context` before `flow run finalize`, then — after cleanup deletes the worktree — `cd <mainRepoPath>` to restore a valid working directory.
- In current code both `get-resolve-context` and `run-resume` assign `mainRepoPath = ctx.root`, where `ctx.root` is the current repository root (= the worktree itself when running inside the worktree). The returned `mainRepoPath` therefore equals `worktreePath`, and the finalize fallback has never actually worked.
- Observed during the flow 217 (`validate-explicit-run-id`) finalize run: the AI had to hardcode `cd /home/nakano/workspace/sdd-forge` manually because the documented fallback was broken.
- The correct main repository path is already resolved by `src/lib/container.js` (`mainRoot = inWorktree ? getMainRepoPath(root) : root`) and surfaced to commands via `ctx.mainRoot`. No new resolution logic is needed — the two buggy commands simply use the wrong field.

## Scope
- P1. `sdd-forge flow get resolve-context`: when executed inside a worktree, `data.mainRepoPath` shall point to the primary repository (the directory containing the shared `.git` dir), not the worktree.
- P2. `sdd-forge flow run resume`: same corrected semantics, applied consistently with P1 because both commands return the same envelope shape.
- P3. A unit test shall assert that, in worktree mode, `mainRepoPath !== worktreePath` and both paths refer to distinct, existing locations.

## Out of Scope
- Changing the persisted shape of `flow.json` / `active-flow.json` or adding new keys to the `resolve-context` / `resume` envelope.
- Editing `src/templates/skills/sdd-forge.flow/SKILL.md`. The existing instructions ("Get `mainRepoPath` from `sdd-forge flow get resolve-context`") already describe the correct operational pattern; the fix makes that pattern actually work.
- Finalize / merge / cleanup code (`src/flow/lib/run-finalize.js`, `src/flow/commands/merge.js`): these already resolve `mainRepoPath` correctly via `FlowStore.resolveWorktreePaths(state)`.
- Non-worktree (branch / local) mode: `mainRepoPath` was already correct there.

## Constraints
- No external dependencies — Node.js built-ins only.
- alpha policy: no backward-compatibility shims. The previous `mainRepoPath == worktreePath` behavior is a bug, not a contract; do not preserve it behind a flag.
- Do not modify the envelope key names, field types, or the ordering of existing keys.
- Source files under `src/` must remain free of project-specific paths or values.

## Design Principles
- Reuse the already-resolved `ctx.mainRoot` rather than introducing a second resolution path. Single source of truth.
- Keep the fix symmetric across the two commands (`get-resolve-context`, `run-resume`) since they share an envelope contract.
- Prefer a regression test that fixes the exact invariant violated by the bug (`mainRepoPath !== worktreePath` in worktree mode) so future drift is caught.

## Overview
### Modules
- `src/flow/lib/get-resolve-context.js` — producer of the `flow get resolve-context` envelope.
- `src/flow/lib/run-resume.js` — producer of the `flow run resume` envelope (same shape).
- `src/lib/container.js` / `src/flow/lib/flow-context.js` — already expose `ctx.mainRoot`; no change.
- `tests/unit/flow/` — a new (or extended) test asserts worktree-mode invariants on `mainRepoPath`.

### Data Flow
- Caller runs CLI inside worktree → `container.js` sets `root = worktree`, `mainRoot = getMainRepoPath(root)`, `inWorktree = true` → `flow-context.js` exposes both as `ctx.root` and `ctx.mainRoot` → command returns `mainRepoPath = ctx.mainRoot`, `worktreePath = resolveActiveFlow(...).worktreePath`.

### Decisions
- Fix both commands in the same spec to prevent envelope drift.
- No SKILL.md text change; the current text is correct in intent and becomes correct in practice after the fix.

## Clarifications (Q&A)
- Q: Should `resolveActiveFlow()` be extended to return `mainRepoPath` so callers never have to read `ctx.mainRoot` directly?
  - A: Not in this spec. Both current callers already receive `ctx.mainRoot` via `resolveFlowContext`. Adding a field to `resolveActiveFlow` would be a broader API change with additional call-site impact. Keep the fix minimal and symmetric.
- Q: Does fixing this change any consumer's expectations?
  - A: No. The only documented consumer of `mainRepoPath` is the finalize skill, which already expects the corrected semantics.

## Alternatives Considered
- **Extend `resolveActiveFlow()` to return `mainRepoPath`.** Rejected: unnecessary surface-area expansion; `ctx.mainRoot` is already the canonical source.
- **Call `getMainRepoPath(root)` directly inside each command.** Rejected: duplicates the resolution already performed in `container.js` and could drift if the resolution logic changes.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23
- Notes: autoApprove mode

## Requirements
- **R1 (P1).** When `flow get resolve-context` is executed while `state.worktree === true`, the returned `data.mainRepoPath` shall equal the primary repository path (the directory containing the shared `.git` dir), not the worktree path. Verifiable by: reading the CLI JSON envelope and comparing against the primary repo path established by test setup.
- **R2 (P2).** When `flow run resume` is executed in the same conditions as R1, the returned `data.mainRepoPath` shall satisfy the same invariant as R1. Verifiable by: same mechanism as R1 on the resume envelope.
- **R3 (P3).** When `flow get resolve-context` is executed outside a worktree (plain branch / local mode), the returned `data.mainRepoPath` shall equal the repository root (unchanged behavior). Verifiable by: existing non-worktree unit test continues to pass without modification.
- **R4 (P3).** The test suite shall include a unit test that fails if, in worktree mode, `mainRepoPath === worktreePath`. Verifiable by: inspecting the new test's assertions and running it before/after the fix.

## Acceptance Criteria
- `npm test` passes with the new regression test included.
- Running `sdd-forge flow get resolve-context` from inside a worktree returns a `data.mainRepoPath` different from `data.worktreePath`, both pointing to existing directories.
- Running `sdd-forge flow run resume` in the same environment returns the same corrected `data.mainRepoPath`.
- No changes to `flow.json` schema, envelope keys, or existing test fixtures.

## Test Strategy
- **New unit test** (under `tests/unit/flow/`): construct a `FlowManager` with `root !== mainRoot` and `inWorktree: true`, build a container context exposing `ctx.mainRoot !== ctx.root`, invoke both `GetResolveContextCommand` and `RunResumeCommand`, and assert `data.mainRepoPath === ctx.mainRoot` and `data.mainRepoPath !== data.worktreePath`.
- **Existing tests** (`tests/unit/flow/resolve-context-extended.test.js`): continue to pass unmodified, proving R3 (non-worktree behavior preserved).
- No integration / e2e test is required because the fix is a single-value correction on an existing envelope.

## Implementation Targets
- `src/flow/lib/get-resolve-context.js` — replace `const mainRepoPath = root;` with a read from `ctx.mainRoot`.
- `src/flow/lib/run-resume.js` — same change.
- `tests/unit/flow/<new-or-extended>.test.js` — add the R4 regression test.

## Open Questions
- [ ] None.
