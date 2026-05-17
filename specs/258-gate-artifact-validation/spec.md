# Feature Specification: 258-gate-artifact-validation

**Feature Branch**: `feature/258-gate-artifact-validation`
**Created**: 2026-05-17
**Status**: Draft
**Input**: GitHub Issue #328

## Goal
flow-level gate-impl (phase=integration) validates required flow artifacts before accepting implementation fulfillment, so missing or placeholder artifacts cannot support a false done claim.

## Background
Issue #328 addresses a gap where an AI can place hand-written placeholder artifacts such as test-execute-result.json or file-map.json and then claim requirement fulfillment is done. The current flow already validates v2 test artifacts and regression snapshots, but flow-level gate-impl (phase=integration) does not yet treat the full set of required flow artifacts as a single trust precondition with placeholder rejection and audited exception handling.

## Scope
- Define the required artifact contract in spec.json using existing schema fields: requirements, acceptance_criteria, constraints, and clarifications.
- Validate test-execute-result.json, test-result-review.json, file-map.json, and tests/.raw/test-execution.log before flow-level gate-impl (phase=integration) can pass.
- Fail flow-level gate-impl (phase=integration) with ARTIFACT_PLACEHOLDER when a required artifact is missing, malformed, empty, stale, inconsistent with raw output, or matches a known placeholder sentinel/hash.
- Require explicit user permission, recorded in specs/<spec>/placeholder-permission.json, before placeholder artifacts can be tolerated in environments where real execution is unavailable.
- Preserve the existing v2 test artifact validation, test-result-review verdict checks, and regression snapshot stale checks.
- Add tests under this spec to cover valid artifacts and each blocking invalid artifact class.

## Out of Scope
- Changing task-level gate-impl (phase=task-impl) to require test-execute-result.json or test-result-review.json before those artifacts exist.
- Changing the single execution point for tests: test-execute remains the only runtime test execution step.
- Changing GitHub Projects or issue publish workflow behavior.
- Adding external dependencies.
- Migrating historical spec artifacts.
- Running npm publish or npm dist-tag.

## Constraints
- No external dependencies; use only Node.js built-in modules.
- Do not add backward-compatibility code for retired or historical artifact formats.
- Represent artifact validation concepts with classes when new structured value types are needed; constructors enforce invariants and methods own behavior.
- If two or more artifact validations share a pattern, extract a common helper instead of duplicating checks.
- Do not weaken existing pass conditions for test-execute-result.json version 2, test-result-review verdict, raw output range checks, or regression snapshot stale checks.
- If src/templates or skill templates change, run sdd-forge upgrade before finalization.

## Design Principles
- Gate preconditions should reject untrusted artifacts before AI guardrail evaluation starts.
- Artifact validation should produce deterministic failure reasons that tests can assert without invoking an AI agent.
- Existing flow artifacts remain the source of truth; spec.md is rendered output and is not parsed for contract data.

## Overview
### Modules
- src/flow/lib/test-artifacts.js owns deterministic validation for test-execute-result.json, test-result-review.json, raw output evidence, and regression snapshots.
- src/flow/lib/run-gate.js owns flow-level gate-impl (phase=integration) preconditions and invokes artifact validation before the AI guardrail pipeline.
- src/flow/lib/req-map.js owns file-map.json loading and requirement id validation for requirement-to-file mappings.
- src/flow/prompts/impl/implement.md and distributed flow skills communicate the no-placeholder and user-permission rules to agents.

### Data Flow
- test-execute writes test-execute-result.json and tests/.raw/test-execution.log; test-result-review validates them and writes test-result-review.json.
- flow-level gate-impl (phase=integration) reads spec.json, file-map.json, test-execute-result.json, test-result-review.json, and raw output, then fails before AI evaluation if artifact trust checks fail.
- retro and report consume artifacts after gate/test review validation; they are not the first-line contract validators for placeholder rejection.

### Decisions
- [VERIFY] Existing v2 artifact validation checks version, summary, raw output ranges, test evidence, and regression snapshot stale state.
- [VERIFY] Existing gate integration precheck already reads test-execute-result.json and test-result-review.json before running the AI guardrail pipeline.
- [CORRECTION] Artifact trust validation applies only to flow-level gate-impl (phase=integration), not task-level gate-impl (phase=task-impl).
- [VERIFY] file-map.json is the existing requirement-to-file artifact and validates req ids against spec.json requirements.
- [CORRECTION] Do not add a new top-level artifact_contract field unless the schema is intentionally changed; this spec records the contract in schema-supported fields.
- Artifact scope includes test-execute-result.json, test-result-review.json, file-map.json, and tests/.raw/test-execution.log; retro.json and report.json remain downstream summaries.
- Placeholder exception handling requires specs/<spec>/placeholder-permission.json with version=1, phase=integration, approvedByUser=true, artifactPaths[], permissionText, reason, and createdAt.
- Sentinel scanning is limited to named execution-evidence JSON paths and does not globally scan raw logs or file-map path strings.

## Clarifications (Q&A)
- Q: Where is the artifact contract stored?
  - A: Use existing spec.json schema-supported fields in this spec: requirements, acceptance_criteria, constraints, and clarifications. Do not add a new top-level field unless implementation intentionally changes spec.schema.json.
- Q: What counts as placeholder for the initial implementation?
  - A: A required trust input is placeholder when a sentinel string appears in the exact JSON paths listed by R3, when a required summary is empty for testable requirements, or when a JSON artifact hash matches a documented placeholder fixture hash used by this spec's tests. file-map.json path values and tests/.raw/test-execution.log text are not globally sentinel-scanned.
- Q: What is the user-permission exception?
  - A: A placeholder artifact may be tolerated only when real execution is unavailable and specs/<spec>/placeholder-permission.json exists with version 1, phase integration, approvedByUser true, artifactPaths containing the placeholder artifact path, and non-empty permissionText, reason, and createdAt. Without that record, flow-level gate-impl fails.

## Alternatives Considered
- Validate only file existence — Rejected because existence checks allow hand-written placeholder JSON to pass and do not address Issue #328.
- Add a new artifact_contract top-level field immediately — Rejected for this spec because current spec.schema.json rejects unknown top-level fields. The contract can be represented in existing schema-supported fields without expanding the schema surface.
- Always fail placeholder artifacts even with user permission — Rejected because Issue #328 explicitly calls for a user-permission rule when real execution is unavailable; the spec makes that exception auditable and blocking by default.
- Include retro.json and report.json in gate-impl trust preconditions — Rejected because those files are downstream summaries. test-execute-result.json, test-result-review.json, raw output, and file-map.json are the trust inputs that support requirement fulfillment claims.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-17T00:49:34.776Z
- Notes: autoApprove: approved gate-passed spec for issue #328

## Requirements
- R1 [must]: The spec artifact contract shall list test-execute-result.json, test-result-review.json, file-map.json, and tests/.raw/test-execution.log as required trust inputs for flow-level gate-impl (phase=integration), shall exclude task-level gate-impl (phase=task-impl), and shall exclude retro.json and report.json from gate-impl precondition validation.
- R2 [must]: flow-level gate-impl (phase=integration) shall fail with failure code ARTIFACT_PLACEHOLDER before AI guardrail evaluation when any required trust input is missing, invalid JSON where JSON is expected, missing required keys, has an empty requirement summary, references an unknown requirement id, points raw_output_lines outside tests/.raw/test-execution.log, or mismatches raw output evidence.
- R3 [must]: flow-level gate-impl (phase=integration) shall reject known placeholder artifacts when configured placeholder sentinel strings appear in test-execute-result.json summary[].evidence.command, summary[].evidence.test_name, summary[].evidence.test_file, regression.command, regression.root_test_command, or test-result-review.json checked_items[].detail, or when a JSON artifact hash matches a documented placeholder fixture hash used by tests; file-map.json path values and tests/.raw/test-execution.log are not globally sentinel-scanned; sentinel scanning shall inspect at most 200 summary entries, 200 checked_items entries, and 1 MiB per JSON artifact before returning ARTIFACT_PLACEHOLDER.
- R4 [must]: flow-level gate-impl (phase=integration) shall preserve existing validation for test-execute-result.json version 2, test-result-review verdict pass, spec-local test evidence, and regression snapshot freshness; an implementation shall not turn any current failing condition into a pass.
- R5 [must]: The flow agent guidance shall require explicit user permission before writing or accepting placeholder artifacts when real execution is unavailable, and flow-level gate-impl (phase=integration) shall fail placeholder artifacts unless specs/<spec>/placeholder-permission.json exists with version 1, phase integration, approvedByUser true, a non-empty artifactPaths array containing the placeholder artifact path, non-empty permissionText, non-empty reason, and non-empty createdAt.
- R6 [must]: The implementation shall add automated tests under specs/258-gate-artifact-validation/tests with spec headers covering valid artifacts, missing artifacts, malformed artifacts, placeholder sentinel rejection, file-map unknown requirement rejection, and the explicit-permission exception path.

## Acceptance Criteria
- Given a flow with valid test-execute-result.json v2, test-result-review.json verdict pass, matching raw output, and file-map.json entries that use existing requirement ids, flow-level gate-impl (phase=integration) can proceed to normal guardrail evaluation.
- Given any required trust input is absent, flow-level gate-impl returns a failing envelope before AI evaluation and includes ARTIFACT_PLACEHOLDER in the failure reason or code.
- Given a JSON artifact contains an empty summary for a testable requirement set, flow-level gate-impl fails before AI evaluation.
- Given test-execute-result.json references a raw_output_lines range outside tests/.raw/test-execution.log, flow-level gate-impl fails before AI evaluation.
- Given file-map.json references a requirement id not present in spec.json, flow-level gate-impl fails before AI evaluation.
- Given a sentinel string appears in one of the R3-listed JSON paths, flow-level gate-impl fails before AI evaluation unless specs/<spec>/placeholder-permission.json covers that artifact path.
- Given a configured placeholder sentinel appears only in file-map.json path values or in unreferenced raw log text, sentinel scanning does not fail the artifact by itself.
- Given src/templates or skill templates are changed for placeholder permission guidance, sdd-forge upgrade updates the distributed skill copies before finalization.

## Implementation Targets
- src/flow/lib/test-artifacts.js
- src/flow/lib/run-gate.js
- src/flow/lib/req-map.js
- src/flow/prompts/impl/implement.md
- src/templates/skills/sdd-forge.flow/SKILL.md
- tests/unit/flow
- tests/e2e/flow

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Define artifact validator
  - Create deterministic validation for flow-level gate-impl (phase=integration) trust inputs and return auditable failure reasons for missing, malformed, stale, and placeholder artifacts.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Wire gate precondition
  - Run the artifact validator from flow-level gate-impl (phase=integration) before AI guardrail evaluation and preserve existing gate behavior for valid artifacts.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Update placeholder guidance
  - Teach flow agents that placeholder artifacts require explicit user permission and an audit record when real execution is unavailable.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Add regression tests
  - Add spec-local and project tests that make placeholder artifact rejection and valid artifact acceptance repeatable.
  - see `tasks/T-4.md` for full spec
