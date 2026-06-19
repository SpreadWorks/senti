# Feature Specification: 309-target-mismatch-guard

**Feature Branch**: `feature/309-target-mismatch-guard`
**Created**: 2026-06-19
**Status**: Draft
**Input**: GitHub Issue #404

## Goal
Prevent Spec-Driven Development flow entry from executing an active flow that does not match an explicitly requested Issue, spec, or runId target.

## Background
Issue #404 reports that an explicit flow target can be ignored when another active flow is present. If the skill enters the dispatcher based only on active: true, a different session's flow can receive next-action, repair, finalize, or cleanup operations. The existing CLI has partial Issue mismatch support in get-status, but the entry procedure must use it before any action that can mutate or advance a flow.

## Scope
- Add or complete CLI-side target-aware status guards for explicit Issue, spec, and runId targets.
- Update senti.flow skill guidance so explicit targets are checked before dispatcher, next-action, repair, run, finalize, or cleanup execution.
- Ensure autoApprove and requires_approval never bypass target mismatch checks.
- Add regression coverage that proves mismatch stops have no flow execution side effects and target-matched retained behavior still works.
- Run senti upgrade if src/skills or preset templates change.

## Out of Scope
- Do not redesign flow lifecycle step ordering.
- Do not change GitHub Issue fetch, board workflow, npm publish, or release behavior.
- Do not change finalize-cleanup orphan commit or squash recovery policy.
- Do not perform a broad active-flow registry format migration beyond the minimum target lookup data needed for this fix.

## Constraints
- No external npm dependencies.
- Source under src/ must not contain project- or environment-specific values.
- Validate user-supplied target values at the CLI entry boundary.
- Treat target mismatch as a safety guard, not as an approval policy.
- When skill prompt placement changes, tests must assert both old unsafe placement removal and new safe placement presence.
- If src/skills or src/presets change, run senti upgrade and keep the generated skill or preset outputs in sync.

## Design Principles
- Prefer a machine-readable CLI stop over prose-only skill guidance.
- Keep current-context status display available for callers that do not specify an explicit target.
- Use existing FlowManager and get-status resolution paths instead of introducing a parallel flow lookup system.

## Overview
### Modules
- src/flow/lib/get-status.js owns target-aware status output and ACTIVE_FLOW_MISMATCH envelopes for resolved flow state.
- src/lib/flow-manager.js owns active flow, spec, and runId resolution; new target checks should reuse these resolution paths.
- src/skills/senti.flow/SKILL.md and its source partials own the agent entry procedure before dispatcher execution.
- tests/unit/flow and skill placement tests own regression coverage for CLI mismatch guards and generated guidance.

### Data Flow
- User input with explicit target -> skill parses target -> skill runs current-context expectation guard -> mismatch stops before next-action/repair/run/finalize; match continues to dispatcher.
- CLI status guard resolves current flow or requested runId/spec, compares expected target fields, and returns ACTIVE_FLOW_MISMATCH without mutating flow state.
- Target-matched flows continue through existing next-action, repair, run, approval, and finalize paths with unchanged post hooks and artifacts.

### Decisions
- [VERIFY] get-status already has Issue mismatch support.
- [VERIFY] get-status has a runId lookup path.
- [CORRECTION] runId lookup status is display-only for explicit target entry safety.
- [CORRECTION] runId lookup must include active worktree flow state.
- [VERIFY] active flow fallback can select the wrong target when only one active flow exists.
- Target mismatch guard belongs in both layers.
- Migration parity is required because entry behavior is being guarded, not removed.

## Clarifications (Q&A)
- Q: Should mismatch be recoverable by auto approval?
  - A: No. It is a safety stop before approval policy. The user can resume the existing active flow explicitly, but the mismatched request must not advance it.
- Q: Should current-context `senti flow get status` be removed?
  - A: No. It remains the default display when no explicit target is supplied. Target-aware guards are used only when the entry request names a target.
- Q: Is the CLI or skill responsible for validation?
  - A: Both have bounded roles. CLI returns machine-readable mismatch results against the current execution context; skill parses the user's target and must call the guard before dispatcher execution.

## Alternatives Considered
- Skill-only prose stop — Rejected because other CLI entry paths and tests would not have a machine-readable mismatch contract.
- Always require --spec for every flow command — Rejected because it would break current-context status and normal single-flow continuation behavior.
- Let user approval override target mismatch — Rejected because mismatch is a safety guard protecting another session's flow, not a normal approval decision.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-19T02:20:02.830Z
- Notes: auto-approved after spec-gate PASS for Issue #404

## Requirements
- R1 [must]: Explicit Issue targets must be compared with the resolved active flow before dispatcher execution; mismatch returns ACTIVE_FLOW_MISMATCH and no next-action, repair, run, finalize, or cleanup command is executed.
- R2 [must]: Explicit spec and runId targets must be checked against the current dispatcher execution context, for example through --expect-spec and --expect-run-id status options; positional runId status remains display-only and must not authorize later dispatcher commands.
- R3 [must]: ACTIVE_FLOW_MISMATCH responses must include machine-readable expected and active target fields for the target types available in the request, using canonical spec IDs for spec comparisons.
- R4 [must]: autoApprove and requires_approval decisions must be evaluated only after the explicit target guard has passed.
- R5 [must]: Target-matched retained behavior must continue to work for current-context status, runId display status, active worktree runId resolution, next-action, repair, run commands, finalize leaves, autoApprove shortcut, and finalize manual recovery exceptions.
- R6 [must]: senti.flow skill guidance must require target-aware status checks before dispatcher loop entry whenever user input names an Issue, spec, or runId target.
- R7 [must]: Regression coverage must detect that another active flow is not executed when an explicit target does not match.
- R8 [must]: Generated installed skill output must stay in sync with any src/skills guidance change.

## Acceptance Criteria
- When an active flow for Issue A exists and the entry target is Issue B, target-aware status returns ACTIVE_FLOW_MISMATCH before get-next-action is called.
- When mismatch occurs, flow.json step status, notes, metrics, and finalize artifacts for the active flow are unchanged except for allowed status/runtime log reads.
- When the target Issue matches the active flow, get-next-action returns the active step envelope as before.
- When positional runId status is requested for display, the response comes from that runId even if a different context has an active flow, but this display path is not used as permission to run dispatcher commands.
- When --expect-run-id or --expect-spec is used, the comparison is made against the current dispatcher execution context and fails if that context is a different active flow.
- When a runId belongs to an active worktree-mode flow, runId display status and runId expectation guards resolve the worktree flow.json through the active-flow registry/worktree path.
- When a target-matched flow reaches a representative run command or repair path, the command acts on the matched flow and does not fail with target mismatch.
- When a target-matched flow reaches finalize leaves, existing finalize preconditions and recovery envelopes are still reachable.
- When autoApprove is true on a target-matched flow, normal approval auto-selection remains available after the target guard passes.
- When finalize-cleanup reports ORPHAN_COMMITS_DETECTED or SQUASH_BASELINE_* on a target-matched flow, manual recovery remains required even if autoApprove is true.
- Skill placement tests prove old guidance that permits naked active-flow continuation is absent and new explicit-target guard guidance is present.
- If src/skills changed, senti upgrade updates generated skill files and the diff includes the synced output.

## Implementation Targets
- src/flow/lib/get-status.js
- src/flow/registry.js
- src/lib/flow-manager.js
- src/skills/senti.flow/SKILL.md
- src/skills/partials/core-principle.md
- specs/309-target-mismatch-guard/tests/target-mismatch-guard.test.js
- specs/309-target-mismatch-guard/tests/target-retained-behavior.test.js
- specs/309-target-mismatch-guard/tests/skill-placement.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add target status guards
  - Complete CLI-side target comparison for Issue, spec, and runId targets. The command must return ACTIVE_FLOW_MISMATCH before any mutating flow action can be selected.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Guard flow entry guidance
  - Update senti.flow guidance so explicit targets are validated before dispatcher loop entry and before autoApprove or requires_approval can permit execution.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover retained behavior
  - Add regression coverage proving mismatch stops have no side effects and target-matched retained behavior still works.
  - see `tasks/T-3.md` for full spec
