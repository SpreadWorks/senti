# Feature Specification: 479-scenario-validity-baseline

**Feature Branch**: `feature/479-scenario-validity-baseline`
**Created**: 2026-07-28
**Status**: Draft
**Input**: GitHub Issue #479

## Goal
Make scenario-validity attribute production-target changes to the current flow by using validated immutable flow baseline authority instead of a moving base-branch tip.

## Background
The current diff can compare a feature worktree with a base branch that advanced after the flow was created. Upstream-only commits then appear as implementation changes, forcing an unnecessary rebase. Prepared flows already carry immutable baseline metadata, which provides the authority needed to distinguish current-flow changes from later base-branch advancement.

## Scope
- Scenario-validity baseline authority validation.
- Current-flow change attribution and focused unit regression coverage.
- Existing preflight artifact and transition parity.

## Out of Scope
- Production-target allowlist changes.
- Repair-fingerprint baseline changes.
- Finalize-time rebase or merge strategy changes.

## Constraints
- Use Node.js built-in modules only.
- Fail closed with a typed error when baseline authority is missing, inconsistent, ambiguous, or unresolvable.
- Retain the current scenario-validity production-target allowlist and artifact paths.

## Design Principles
- Treat persisted, authority-backed flow state as the source of attribution truth.
- Never infer a baseline from a moving branch name when immutable authority is unavailable.

## Overview
### Modules
- src/flow/lib/run-scenario-validity.js resolves and uses the preflight baseline.
- src/flow/lib/repair-state-identity.js provides immutable baseline and authority-validation conventions.
- tests/unit/flow/run-scenario-validity.test.js covers the public preflight contract.
- RepairStateError and resolveRepairBaselineAuthority enforce immutable baseline authority for scenario-validity.
- RunScenarioValidityCommand accepts a scenario-test execution boundary while retaining the default process runner.

### Data Flow
- Flow state repairBaseline -> authority validation -> immutable Git ref -> scoped diff plus working-tree status -> preflight decision -> existing artifacts and step transition.
- flow.json repairBaseline -> namespace and ref resolution -> commit identity check -> preflight diff baseline.
- Validated immutable baseline ref -> git diff for committed production paths; status scan retains index, worktree, and untracked paths.
- Scenario test process records -> version-1 result and raw log -> pass-to-test-review or typed block outcome.

### Decisions
- [VERIFY] The prepared flow already persists repairBaseline and run-scenario-validity already prefers repairBaseline.ref when present; validation will make absent or invalid authority fail closed.
- Migration parity inventory and ownership: flow run scenario-validity remains owned by RunScenarioValidityCommand; its scoped allowlist and all internal helper APIs remain owned by run-scenario-validity; no hooks or config keys change; result artifact and raw log remain produced by the command; pass/block side effects and pass-to-test-review remain owned by existing post hooks. No public surface is removed; only baseline resolution changes to validated authority.
- Scenario-validity fails closed when it cannot prove that the immutable baseline belongs to the active flow.
- Scenario-validity compares committed changes to the immutable flow baseline, never to the moving base branch name.
- Artifact contract tests simulate only the external process boundary; baseline validation, path filtering, and artifact persistence remain real command behavior.

## Clarifications (Q&A)
- Q: Which baseline is authoritative?
  - A: Only a repairBaseline whose persisted flow identity, immutable ref, commit identity, and publication authority agree.

## Alternatives Considered
- Compare against the current base branch tip. — Rejected because upstream commits after flow creation are misattributed to the feature.
- Infer a merge base when immutable authority is unavailable. — Rejected because Issue #479 requires fail-closed behavior rather than guessing.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-28T02:23:03.379Z
- Notes: Auto-approved after preflight acceptance and passed draft/spec gates.

## Requirements
- R1 [must]: Validate repairBaseline authority before scenario-validity computes its preflight diff: its flow identity, ref, and commit identity must agree with persisted authority; missing, mismatched, ambiguous, or unresolvable authority returns a typed fail-closed error.
- R2 [must]: Compute scenario-validity's committed diff from the validated immutable baseline while retaining detection of staged, unstaged, and untracked production-target changes from the existing allowlist.
- R3 [must]: Preserve the scenario-validity public contract: valid runs write the version-1 result artifact and raw log, retain pass/block semantics, and advance pass results to test review.
- R4 [must]: Add unit coverage for advanced-base exclusion, committed/staged/unstaged/untracked current-flow changes, invalid baseline authority, and retained artifact/transition behavior.

## Acceptance Criteria
- An advanced main branch with no current-flow production-target changes produces no preflight invalid paths.
- Each committed, staged, unstaged, and untracked current-flow change under src/, tests/, package.json, or .senti/config.json is still blocked.
- Missing, inconsistent, ambiguous, and multiple-merge-base authority fail with explicit typed errors.
- A valid baseline run still produces scenario-validity-result.json and tests/.raw/scenario-validity.log with existing pass/block and pass-to-test-review behavior.

## Implementation Targets
- src/flow/lib/run-scenario-validity.js
- src/flow/lib/repair-state-identity.js
- tests/unit/flow/run-scenario-validity.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Validate preflight baseline authority
  - Resolve and validate immutable baseline authority before the scenario-validity preflight diff. Return typed failures for authority states that cannot prove current-flow attribution.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Diff from validated baseline
  - Use the validated baseline for scenario-validity committed-change attribution while retaining existing working-tree detection and path filtering.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Verify preflight contract parity
  - Extend regression coverage for the retained scenario-validity artifacts, result values, and pass transition after immutable-baseline attribution.
  - see `tasks/T-3.md` for full spec
