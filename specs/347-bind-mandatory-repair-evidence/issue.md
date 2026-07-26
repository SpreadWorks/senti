## Summary

`#422` added finding disposition, but the current policy still lets a `mandatory` finding become `Deferred` after the occurrence cap is reached. That transition can also clear `requiresRepair`.

At the same time, repair-evidence validation is too weak: it accepts evidence based on file existence and `mtime` only, so stale or unrelated files can be reused.

Together, these behaviors break the gate contract:

- A must-fix finding can become non-blocking without repair or explicit approval.
- Repair evidence is not tightly bound to the specific finding, reviewed tree, or actual repair.
- Distinct findings can be merged under a coarse fingerprint and incorrectly share status.

## Problem

We need a corrective follow-up to `#422` that preserves the existing type surface while fixing two policy bugs:

1. `mandatory` findings must not auto-defer just because they repeat.
2. Repair evidence must be bound to the exact finding instance and current code state.

## Scope

- Update `src/flow/lib/finding-disposition-policy.js`
- Add or update focused tests for:
  - finding disposition behavior
  - repair-evidence validation
  - finding identity / fingerprint separation
- Keep this as a targeted bug fix, not a redesign of the disposition model introduced in `#422`

## Acceptance Criteria

- A `mandatory` finding that reaches the max occurrence threshold still blocks the gate unless there is:
  - valid repair evidence, or
  - an explicit allow/defer decision
- `mandatory` findings do not implicitly clear `requiresRepair` solely because of repetition.
- Repair evidence is rejected when it is unrelated, stale, touched-only, or not exactly bound to the current finding and reviewed tree.
- Repair evidence is bound to the exact finding fingerprint, target `HEAD` / tree, repair diff, and validating test result.
- Findings with different locations and/or root causes are tracked independently and do not share repair status.
- Existing disposition behavior for non-mandatory findings remains unchanged.

## Evidence

- `finding-disposition-policy.js:629` converts a `mandatory` finding into `Deferred`.
- `finding-disposition-policy.js:335-367` validates file-based repair evidence using existence plus `mtime` only.
- Current tests encode the existing behavior, so the fix must land with focused coverage updates.

## Non-Goals

- Redesigning the type surface or overall disposition model introduced in `#422`
- Broad changes outside finding disposition and repair-evidence binding

<details>
<summary>ja</summary>

mandatory findingの自動deferを禁止しrepair証跡を厳密にbindingする

## Summary

`#422` added finding disposition, but the current policy still lets a `mandatory` finding become `Deferred` after the occurrence cap is reached. That transition can also clear `requiresRepair`.

At the same time, repair-evidence validation is too weak: it accepts evidence based on file existence and `mtime` only, so stale or unrelated files can be reused.

Together, these behaviors break the gate contract:

- A must-fix finding can become non-blocking without repair or explicit approval.
- Repair evidence is not tightly bound to the specific finding, reviewed tree, or actual repair.
- Distinct findings can be merged under a coarse fingerprint and incorrectly share status.

## Problem

We need a corrective follow-up to `#422` that preserves the existing type surface while fixing two policy bugs:

1. `mandatory` findings must not auto-defer just because they repeat.
2. Repair evidence must be bound to the exact finding instance and current code state.

## Scope

- Update `src/flow/lib/finding-disposition-policy.js`
- Add or update focused tests for:
  - finding disposition behavior
  - repair-evidence validation
  - finding identity / fingerprint separation
- Keep this as a targeted bug fix, not a redesign of the disposition model introduced in `#422`

## Acceptance Criteria

- A `mandatory` finding that reaches the max occurrence threshold still blocks the gate unless there is:
  - valid repair evidence, or
  - an explicit allow/defer decision
- `mandatory` findings do not implicitly clear `requiresRepair` solely because of repetition.
- Repair evidence is rejected when it is unrelated, stale, touched-only, or not exactly bound to the current finding and reviewed tree.
- Repair evidence is bound to the exact finding fingerprint, target `HEAD` / tree, repair diff, and validating test result.
- Findings with different locations and/or root causes are tracked independently and do not share repair status.
- Existing disposition behavior for non-mandatory findings remains unchanged.

## Evidence

- `finding-disposition-policy.js:629` converts a `mandatory` finding into `Deferred`.
- `finding-disposition-policy.js:335-367` validates file-based repair evidence using existence plus `mtime` only.
- Current tests encode the existing behavior, so the fix must land with focused coverage updates.

## Non-Goals

- Redesigning the type surface or overall disposition model introduced in `#422`
- Broad changes outside finding disposition and repair-evidence binding

</details>