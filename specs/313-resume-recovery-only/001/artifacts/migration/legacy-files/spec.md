# Feature Specification: 313-resume-recovery-only

**Feature Branch**: `feature/313-resume-recovery-only`
**Created**: 2026-06-25
**Status**: Draft
**Input**: GitHub Issue #407

## Goal
Redesign `senti flow resume` as a recovery-only entry point that discovers ambiguous flow candidates, selects only explicitly recoverable targets, and hands a verified `runId` target to later continuation commands without contaminating normal `/senti.flow` active-flow resolution.

## Background
`flow resume` was intended to recover context after compaction or when invoked outside the worktree, but it currently mixes candidate discovery, target selection, and continuation guidance. Broad discovery can show stale branch/worktree candidates, while `resume --spec` can only select `.senti/.active-flow` registrations. The skill then tells users to invoke `/senti.flow` without preserving the selected target, allowing a later command to continue a different flow.

## Scope
- Clarify and implement responsibilities for `senti flow resume`, `senti flow get resolve-context`, normal active-flow resolution, and target-aware continuation.
- Keep broad `scanAllFlows()` discovery limited to explicit recovery/discovery behavior, not normal active-flow detection.
- Make candidates shown by recovery discovery selectable with `senti flow resume --spec <specId>` only when they carry a usable `runId`.
- Require `runId` for normal continuation after resume recovery; candidates without `runId` are displayed for diagnosis and blocked from continuation.
- Update `senti.flow-resume` so it gives guarded continuation or safe-stop instructions instead of unqualified `/senti.flow` re-entry.
- Define recovery candidate states for stale, finalized, orphan worktree, and branch-only flows.

## Out of Scope
- npm publish and release work.
- Unrelated changes to the normal new-flow `ACTIVE_FLOW_MISMATCH` application boundary.
- Prior normal flow entry-side fixes unless directly required by the recovery contract.

## Constraints
- Use only Node.js built-in modules; do not add external dependencies.
- Do not put project-specific values in `src/` package code.
- After editing `src/skills/**`, run `senti upgrade` so generated skill files are updated.
- Migration parity applies: retained public command behavior must be inventoried, mapped to the new owner, and verified with behavior-level tests.
- Normal active-flow resolution must not call broad branch/worktree discovery.
- Recovery discovery must preserve bounded scanning: at most `SCAN_FLOWS_LIMIT` candidates, currently 200, across local specs, git worktrees, and `feature/*` branches.

## Design Principles
- Recovery discovery and normal active-flow execution are separate paths.
- `runId` is the only safe identity for normal continuation after resume recovery.
- Displayed recovery candidates that cannot be safely continued should explain their state instead of disappearing silently.
- Target guards must fail before any continuation step can act on a different flow.

## Overview
### Modules
- `src/lib/flow-manager.js` owns active-flow registry resolution and broad flow scanning.
- `src/flow/lib/run-resume.js` owns the recovery/discovery command surface and selected target envelope.
- `src/flow/lib/resolve-context-envelope.js` owns the normal active-flow context envelope shared with `get resolve-context`.
- `src/lib/flow-target-guard.js` owns target mismatch checks used by guarded status, next-action, and run continuation.
- `src/skills/senti.flow-resume/SKILL.md` owns user-facing recovery guidance after context loss.

### Data Flow
- Normal `/senti.flow` continuation reads registered active flow state, applies target guards when supplied, and does not inspect branch/worktree discovery candidates.
- `senti flow resume` performs explicit recovery discovery, classifies active and recovery candidates, and returns candidate state without mutating normal active-flow registration.
- `senti flow resume --spec <specId>` selects a discovered candidate only when it has both `runId` and an execution root. Continuation runs from that root with `--expect-run-id`.
- Candidates without `runId`, without an execution root, finalized flows, stale references, and branch-only flows are displayed with state and safe-stop guidance rather than entering normal continuation.
- Recovery selectability: active and orphan-worktree candidates are continuable only when `runId` and execution root exist; stale, finalized, branch-only, and missing-runId candidates are blocked/display-only.

### Decisions
- [VERIFY] Normal `resolveActiveFlow()` intentionally avoids `scanAllFlows()`; recovery discovery remains separate from active-flow execution.
- [VERIFY] Current `resume --spec` only selects registered active flows, which contradicts the recovery candidate UX described in the Issue.
- [VERIFY] Current `senti.flow-resume` skill instructs mainline users to invoke `/senti.flow`, losing the selected resume target.
- [VERIFY] Target guard options already exist for status and next-action surfaces and should be reused for resume continuation.
- `resume --spec <specId>` remains the explicit recovery selection surface rather than introducing a second selector.
- `runId` is required for normal continuation after resume recovery; `spec` and `worktreePath` are diagnostic only when `runId` is missing.
- Continuation handoff uses the selected candidate execution root plus `--expect-run-id`; this avoids registering recovery candidates as normal active flows.
- Migration inventory: `resume` discovery keeps discovery output; `resume --spec` changes selector scope; status/next-action/run keep guarded execution; resolve-context and `.active-flow` keep normal ownership.
- Migration mapping: recovery discovery is owned by `senti flow resume`; normal active state remains owned by `.senti/.active-flow`; target mismatch remains owned by flow target guards.
- Behavior verification maps one public surface per check: resume discovery, resume selection, status, next-action, run, resolve-context, active registry, and resume skill guidance.
- Finalized flows remain visible in discovery but are blocked from normal continuation.
- The resume skill must show guarded continuation or safe-stop instructions rather than only telling users to run `/senti.flow`.

## Clarifications (Q&A)
- Q: Can `spec + worktreePath` substitute for `runId` during continuation?
  - A: No. `spec + worktreePath` may identify a displayed recovery candidate for diagnosis, but normal continuation after resume recovery requires `runId`.
- Q: Can `runId` alone load an arbitrary recovery candidate?
  - A: No. Normal continuation after resume recovery requires both `runId` and an execution root. Commands run from the execution root and use `--expect-run-id` to verify the selected flow.
- Q: Which recovery states are continuable?
  - A: Active and orphan-worktree candidates are continuable only when they have both `runId` and execution root. Stale references, finalized flows, branch-only candidates, and missing-runId candidates are display-only/blocked.
- Q: What public behavior is migrated or retained?
  - A: `senti flow resume` keeps discovery but becomes recovery-only; `resume --spec` changes from active-only selection to recovery selection with runId/root gating; status, next-action, run, resolve-context, and `.senti/.active-flow` retain normal active-flow ownership; `senti.flow-resume` changes guidance only.
- Q: What resource bounds apply to recovery discovery?
  - A: Discovery must preserve the existing `SCAN_FLOWS_LIMIT` cap of 200 candidates and scan only local specs, registered git worktrees, and `feature/*` branches.
- Q: Should finalized flows be hidden from recovery discovery?
  - A: No. They should be visible with finalized state and blocked continuation.
- Q: Does this spec change npm release behavior?
  - A: No. npm publish and release work are out of scope.

## Alternatives Considered
- Add a separate recovery selection command instead of changing `resume --spec`. — Rejected because the user chose to make the existing `resume --spec <specId>` surface match the displayed recovery candidates.
- Allow `spec + worktreePath` fallback for continuation when `runId` is missing. — Rejected because missing `runId` means normal continuation cannot prove it is acting on the selected flow instance.
- Hide finalized flows from discovery. — Rejected because hiding them removes diagnostic context and makes stale/finalized candidate differences less visible.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-25T10:15:49.392Z
- Notes: User approved spec after spec gate PASS

## Requirements
- R1 [must]: Normal active-flow resolution must remain registry-based and must not use broad `scanAllFlows()` recovery discovery when starting or continuing `/senti.flow`.
- R2 [must]: `senti flow resume` must act as explicit recovery discovery and classify active, stale, finalized, orphan worktree, and branch-only candidates separately from normal active flows.
- R3 [must]: `senti flow resume --spec <specId>` must select a displayed recovery candidate only when that candidate has a usable `runId` and execution root; candidates without both values must be display-only and blocked from normal continuation.
- R4 [must]: Continuation after resume recovery must run from the selected candidate execution root and verify the selected `runId` before status, next-action, or run command execution can proceed; a mismatched target must return `ACTIVE_FLOW_MISMATCH` before step execution.
- R5 [must]: `senti.flow-resume` must stop presenting unqualified `/senti.flow` re-entry and must instead show execution-root plus `runId` guarded continuation commands when both values exist, or safe-stop instructions when either value is missing.
- R6 [must]: Migration parity must be verified for retained public surfaces: resume discovery, resume selection, normal active-flow status, target-aware status, next-action, run continuation, resolve-context, active-flow registry, and skill guidance.
- R7 [must]: At least one e2e worktree recovery case must verify real git-worktree discovery and separation from normal active-flow resolution.
- R8 [must]: Recovery discovery must keep bounded resource usage by preserving the `SCAN_FLOWS_LIMIT` candidate cap and limiting traversal to local specs, registered git worktrees, and `feature/*` branches.

## Acceptance Criteria
- Given `.senti/.active-flow` is absent, normal `/senti.flow` new-flow startup and normal status resolution are not affected by stale candidates found by recovery discovery.
- Given recovery discovery lists multiple candidates, `senti flow resume --spec <specId>` can select a displayed active or orphan-worktree candidate that has `runId` and execution root, and returns an envelope containing the selected `runId`, `spec`, and root/path context.
- Given a discovery candidate lacks `runId` or execution root, `senti flow resume --spec <specId>` does not enter normal continuation and reports the candidate as display-only or blocked.
- Given a finalized flow is discovered, it is labeled as finalized and blocked from normal continuation while remaining visible for diagnosis.
- Given a stale reference or branch-only candidate is discovered, it is labeled as a blocked/display-only recovery candidate rather than a normal active flow.
- Given an orphan worktree candidate with `runId` and execution root is discovered, it can be selected and continued from that root with `--expect-run-id`.
- Given a selected `runId` and execution root, target-aware status, next-action, and run command paths run from that root, verify `runId` before acting, and return `ACTIVE_FLOW_MISMATCH` on mismatch.
- `senti flow get resolve-context` continues to describe the normal active flow and does not include unrelated broad discovery candidates.
- `senti.flow-resume` output no longer instructs users to run `/senti.flow` without target guard context.
- Spec-local tests under `specs/313-resume-recovery-only/tests/` include `// spec: R<N>` headers covering the new behavior.
- Behavior-level verification for `senti flow resume`: discovery lists classified recovery candidates and remains capped at `SCAN_FLOWS_LIMIT` candidates.
- Behavior-level verification for `senti flow resume --spec`: selectable candidates with `runId` and execution root return a selected target envelope.
- Behavior-level verification for `senti flow get status`: normal status ignores stale recovery discovery candidates, while target-aware status rejects mismatched `runId`.
- Behavior-level verification for `senti flow get next-action`: guarded next-action rejects mismatched `runId` before dispatcher work.
- Behavior-level verification for representative `senti flow run ...`: guarded run continuation rejects mismatched `runId` before step execution.
- Behavior-level verification for `senti flow get resolve-context`: output remains the normal active-flow context envelope and does not include unrelated recovery candidates.
- Behavior-level verification for `.senti/.active-flow`: recovery discovery does not register display-only candidates as normal active flows.
- Behavior-level verification for `senti.flow-resume`: guidance includes execution-root plus `runId` guard instructions or safe-stop instructions.
- Shared unit/e2e tests cover migration parity for CLI command behavior and skill guidance, including an e2e worktree recovery case.

## Implementation Targets
- src/lib/flow-manager.js
- src/flow/lib/run-resume.js
- src/flow/lib/resolve-context-envelope.js
- src/lib/flow-target-guard.js
- src/flow/registry.js
- src/skills/senti.flow-resume/SKILL.md
- tests/unit/flow
- tests/e2e/flow
- specs/313-resume-recovery-only/tests

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Classify recovery candidates
  - Make explicit recovery discovery classify broad scan results without changing normal active-flow resolution.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Select resume target
  - Make `senti flow resume --spec <specId>` select displayed candidates only when a safe `runId` exists.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Guard continuation commands
  - Ensure continuation after resume recovery verifies selected `runId` before status, next-action, or run command execution proceeds.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Update resume guidance
  - Update `senti.flow-resume` instructions to show guarded continuation or safe-stop recovery guidance.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Verify recovery behavior
  - Add spec-local and shared regression coverage for migration parity and worktree recovery.
  - see `tasks/T-5.md` for full spec
