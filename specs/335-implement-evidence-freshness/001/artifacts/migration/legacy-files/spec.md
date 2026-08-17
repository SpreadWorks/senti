# Feature Specification: 335-implement-evidence-freshness

**Feature Branch**: `feature/335-implement-evidence-freshness`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #460

## Goal
Prevent the implement completion check from accepting scenario-validity, test-execute, or test-result-review evidence from before the latest plan rewind while preserving the existing no-rewind completion contract.

## Background
Plan rewind deliberately retains prior artifacts for audit, then resets planning and implementation steps so current evidence can be regenerated. Approval completion already checks the latest rewind epoch, but implement completion currently checks only requirement status, file-map coverage, artifact presence, artifact shape, and raw output. Consequently, an otherwise valid artifact created before the latest rewind can be mistaken for current-plan readiness. The fix must filter old evidence without deleting it, preserve existing mechanical diagnostics, and avoid changing flows that have never rewound.

## Scope
- Evaluate implement-completion test evidence against the latest plan rewind epoch before it can satisfy readiness or enter mechanical validation.
- Exclude stale retained artifacts from current-plan eligibility without deleting or rewriting them.
- Report stale evidence separately from absent or mechanically malformed evidence.
- Preserve implement completion behavior when the flow has no plan rewind.
- Add focused spec-local coverage for retained, skipped, regenerated, malformed, and no-rewind evidence.

## Out of Scope
- Changes included in Issue #443.
- Changes to supported plan-rewind stages, rewind reset behavior, audit records, or evidence inventory.
- Freshness-policy changes for approval or completion steps other than implement.
- Schema changes to scenario-validity, test-execute, or test-result-review artifacts.
- Deletion, migration, or rewriting of retained pre-rewind artifact files.

## Constraints
- Use only Node.js built-in modules and the existing plan-rewind freshness contract.
- Keep `IMPLEMENT_COMPLETION_VALIDATION_FAILED` as the public envelope error and expose stale evidence through a distinct `durable-artifact-stale` issue code.
- Retain the existing `durable-artifact-missing` and producer-specific mechanical issue codes for absent or malformed current evidence.
- Do not let a stale optional artifact left by a reset or skipped producer poison otherwise sufficient current-plan evidence, and do not let it substitute for current-plan evidence.
- Do not add project-specific Issue numbers, spec paths, or fixture values to `src/`.
- Reuse one shared eligibility helper for the three implement evidence paths instead of duplicating rewind checks.

## Design Principles
- Separate evidence eligibility from artifact existence and mechanical validity.
- Treat the latest plan rewind as an epoch boundary: only evidence after that boundary can participate in current implement readiness.
- Preserve retained artifacts for audit while filtering them out of the current completion decision.
- Make no-rewind behavior an explicit compatibility branch of the existing freshness contract.
- Keep the change inside the implement-completion boundary and reuse existing artifact completion adapters.

## Overview
### Modules
- `src/flow/lib/set-step.js` owns implement completion pre-validation and will apply rewind-aware eligibility before presence and mechanical artifact checks.
- `src/flow/lib/plan-rewind.js` remains the owner of the latest-rewind timestamp and file modification-time freshness contract.
- `specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js` provides production-path coverage for retained, skipped, regenerated, malformed, and no-rewind fixtures.
- `src/flow/lib/set-step.js` classifies implement-completion evidence before readiness and producer validation.

### Data Flow
- Implement completion resolves the scenario-validity, test-execute, and test-result-review paths, then classifies each existing path as eligible or stale against the latest plan rewind.
- Only eligible evidence participates in the existing readiness rule and producer-specific completion adapters; stale residual evidence is not parsed as current evidence.
- If no eligible scenario-validity or test-execute evidence remains, the result reports `durable-artifact-stale` when a stale candidate exists and `durable-artifact-missing` when no candidate exists.
- When no plan rewind exists, every existing artifact remains eligible and follows the current presence, schema, raw-output, requirement-status, and file-map checks.
- Implement completion filters each retained evidence artifact by the latest rewind epoch; only current evidence reaches the existing completion adapters.

### Decisions
- [VERIFY] checked the plan-rewind freshness policy; result=match: reuse the existing latest-rewind and artifact-mtime contract, including its no-rewind success behavior.
- [VERIFY] checked implement completion ownership; result=match: add eligibility filtering before the existing artifact presence and completion-adapter checks.
- [VERIFY] checked current diagnostics; result=match: keep the public validation envelope and add one stale-specific issue code alongside the accumulated existing issue codes.
- Stale optional artifacts are ignored rather than treated as malformed current artifacts, because a rewind retains downstream files while the renewed route reaches implement before producing new test-execute and test-result-review artifacts.
- Use the existing `isPlanArtifactFresh` contract and one eligibility type so scenario-validity, test-execute, and test-result-review share strict boundary and no-rewind behavior.

## Clarifications (Q&A)
- Q: Should every stale residual artifact make implement completion fail?
  - A: No. A stale artifact is ineligible. It causes `durable-artifact-stale` when stale scenario-validity or test-execute evidence leaves no current readiness evidence, but a stale optional downstream artifact is ignored when current eligible readiness evidence is sufficient.
- Q: How is the latest plan epoch represented?
  - A: Use the existing latest `planRewinds[]` record and its `rewoundAt` timestamp. File evidence is current only when its mtime is strictly later.
- Q: Does malformed stale evidence report both stale and malformed?
  - A: No. Eligibility is evaluated first. Stale evidence is not parsed as current evidence; malformed diagnostics apply to eligible evidence.
- Q: How does guardrail `spec-test-coverage` apply to the supplemental shared review-identity regression?
  - A: The shared `tests/unit/flow/commands/review.test.js` update protects the independently repaired review-identity contract and is permitted supplemental regression coverage; it does not substitute for the R1-R5 spec-local coverage in `specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js`.

## Alternatives Considered
- Delete retained artifacts during plan rewind. — Rejected because plan rewind intentionally preserves prior artifacts and Issue #460 asks for epoch correspondence rather than cleanup.
- Reject completion whenever any stale artifact remains on disk. — Rejected because downstream test-execute and test-result-review files can remain after rewind while the renewed route reaches implement before replacing them; they must be ineligible without poisoning sufficient current evidence.
- Add independent timestamp parsing in each artifact branch. — Rejected because the existing plan-rewind helper already defines the strict boundary and no-rewind behavior, and duplicated checks would risk divergent semantics.
- Map stale evidence to `durable-artifact-missing`. — Rejected because Issue #460 explicitly requires stale and missing or malformed evidence to remain identifiable as different failures.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T03:38:30.153Z
- Notes: User approved the gate-passed Issue #460 specification before implementation.

## Requirements
- R1 [must]: When a latest plan rewind exists, implement completion shall classify each existing scenario-validity, test-execute, and test-result-review artifact as current only when its modification time is strictly later than the latest `rewoundAt`; an artifact at or before the boundary shall be stale and shall not participate in current readiness or mechanical validation.
- R2 [must]: If stale scenario-validity or test-execute evidence is the reason no eligible readiness artifact remains, implement completion shall fail with `IMPLEMENT_COMPLETION_VALIDATION_FAILED` and include `durable-artifact-stale`; a fixture with no corresponding artifact shall continue to include `durable-artifact-missing`, and malformed eligible evidence shall continue to expose its existing producer-specific mechanical issue codes.
- R3 [must]: A stale retained test-execute or test-result-review artifact shall neither substitute for missing current evidence nor block completion when another eligible current readiness artifact and all existing requirement-status, file-map, raw-output, and mechanical checks are satisfied.
- R4 [must]: When no plan rewind exists, implement completion shall preserve the current decisions for missing evidence, incomplete requirements, incomplete file-map entries, valid scenario-validity or test-execute evidence, raw output presence, and all three producer completion adapters.
- R5 [must]: Spec-local tests shall exercise the exported implement completion pre-validator with retained pre-rewind evidence, stale artifacts left by reset or skipped producers, evidence regenerated after rewind, malformed eligible evidence, the exact rewind-time boundary, and no-rewind fixtures, and each test file shall carry the required `// spec: R<N>` coverage header.

## Acceptance Criteria
- AC1: With all non-artifact prerequisites satisfied and only scenario-validity or test-execute evidence whose mtime is before or equal to the latest rewoundAt, implement completion fails with `IMPLEMENT_COMPLETION_VALIDATION_FAILED`, includes `durable-artifact-stale`, and does not classify that evidence as current.
- AC2: With no scenario-validity or test-execute file, the existing missing-evidence fixture includes `durable-artifact-missing` without adding `durable-artifact-stale`.
- AC3: With a current scenario-validity artifact plus stale retained test-execute and test-result-review artifacts, implement completion ignores the stale optional artifacts and succeeds when the current artifact and every existing non-artifact prerequisite pass.
- AC4: With an eligible post-rewind artifact whose content is malformed, implement completion returns the existing producer-specific mechanical issue code and does not replace it with `durable-artifact-stale`.
- AC5: Moving the required artifact mtime from the rewind boundary to a timestamp strictly after rewoundAt changes the result from stale rejection to the same success or mechanical-validation result produced by an equivalent no-rewind fixture.
- AC6: No-rewind fixtures preserve the pre-change results for incomplete requirements, missing file-map entries, missing evidence, valid scenario-validity evidence, valid test-execute evidence and raw output, and present test-result-review evidence.
- AC7: The spec-local focused test passes and the affected shared project regression reports no failures.

## Implementation Targets
- src/flow/lib/set-step.js
- specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Enforce implement evidence freshness
  - Filter implement completion evidence through the existing latest-plan-rewind boundary while preserving no-rewind and mechanical-validation behavior.
  - see `tasks/T-1.md` for full spec
