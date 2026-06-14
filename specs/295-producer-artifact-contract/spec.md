# Feature Specification: 295-producer-artifact-contract

**Feature Branch**: `feature/295-producer-artifact-contract`
**Created**: 2026-06-14
**Status**: Draft
**Input**: GitHub Issue #385

## Goal
Move mechanical artifact validation to explicit producer-side completion contracts while keeping reviewRetry and gateRetry tied to AI semantic FAIL only.

## Background
Issue #385 identified that review/gate retry counters lose meaning when mechanical artifact checks and AI semantic judgment share the same failure path. The flow already has deterministic validators in gate, test artifact, review, set-step, and flow-findings modules, but the producer boundary is not consistent. This spec moves primary mechanical validation to artifact producers while retaining defensive gate checks and preserving public command behavior.

## Scope
- Reusable producer-side artifact completion contract for normalize, validate, one deterministic repair attempt, and revalidate.
- Producer completion validation for draft.json, spec.json, draft/spec repair artifacts, scenario-validity-result.json, test-execute-result.json v2, test-result-review.json, and implement completion state.
- Failure classification that separates mechanical, protocol, tooling, and AI output schema failure from AI semantic FAIL.
- Deferred flow finding propagation for AI semantic retry exhaustion in draft-gate, spec-review, spec-gate, impl-review, impl-gate task-impl, and impl-gate integration.
- Migration parity tests for retained public command surfaces and generated artifacts.

## Out of Scope
- No new top-level flow phase.
- No generic FlowNode preHooks or postHooks attributes in definition.js.
- No inheritance-based step hierarchy.
- No removal of existing defensive gate-side validation unless the retained behavior is covered by producer-side validation and behavior-level tests.

## Constraints
- Use only Node.js built-in modules; do not add dependencies.
- Represent new meaningful result values with dedicated classes, not discriminated-union object literals.
- The shared artifact completion helper must return validation status and mechanical failure detail only; callers decide flow transitions and retry effects.
- Gate-side static validation may remain as a defensive precondition, but producer-side validation must be the primary completion condition for changed artifacts.
- Review/gate retry counters must not be incremented by mechanical validation failure, deterministic repair failure, provider/tooling/protocol failure, or AI output schema failure.
- Semantic retry exhaustion must not hide invalid or missing artifacts; states that cannot be evaluated by acceptance-review must still stop before progression.

## Design Principles
- Put artifact validity at the producer boundary so downstream semantic checks receive formally evaluable inputs.
- Keep semantic review/gate judgment separate from structural artifact trust.
- Prefer explicit producer calls over implicit lifecycle hooks for this concern.
- Keep migration parity visible by listing retained surfaces, new owners, and behavior-level checks.

## Overview
### Modules
- `src/flow/lib/run-gate.js` remains the semantic gate orchestrator and retains defensive preconditions for draft/spec/integration surfaces.
- `src/flow/lib/test-artifacts.js` owns test artifact schema, raw evidence, placeholder, file-map, and trust validation primitives.
- `src/flow/lib/set-step.js` owns completion-time transition checks for steps that do not have a dedicated producer command.
- `src/flow/commands/review.js` owns review artifact generation and AI output protocol handling for draft, spec, test, and impl reviews.
- `src/flow/lib/flow-findings.js` owns `flow-findings.json` entries used by acceptance-review for deferred semantic findings.
- `senti flow run gate --phase task-impl` is a retained public impl-gate surface and must keep phase-keyed retry, artifact, and progression behavior alongside integration.

### Data Flow
- Producer writes or mutates an artifact, runs artifact completion, receives success or unresolved mechanical failure, and only then allows the step-specific transition.
- Review/gate receives artifact input that has already passed producer completion; defensive preconditions may re-check the same surface before semantic AI judgment.
- AI semantic FAIL increments reviewRetry or gateRetry; non-semantic failures return classified envelopes or artifacts without consuming semantic retry budget.
- When semantic retry is exhausted, the source finding is mirrored into `flow-findings.json` and later context exposes it to acceptance-review.

### Decisions
- [VERIFY] Draft policy matches `run-gate.js`: draft/spec gates already run mechanical checks before guardrail AI calls.
- [VERIFY] Draft policy matches `test-artifacts.js`: test artifact trust checks are already deterministic and bounded.
- [VERIFY] Draft policy matches `set-step.js`: completion transitions already host mechanical validation for some managed steps.
- [VERIFY] Draft policy matches `flow-findings.js`: deferred semantic findings already have a durable artifact model.
- [VERIFY] Draft policy matches `review.js`: review artifacts and AI output protocol are separate from gate guardrail evaluation.
- [VERIFY] Impl-gate uses phase-keyed behavior for task-impl and integration; both surfaces are in scope for parity.
- [VERIFY] Spec-review deferral must read the real review artifact finding arrays instead of test-only normalized fixtures.
- [IMPACT] Existing review/gate commands keep user-facing command names, artifact paths, and success progression; ownership of first-pass mechanical validation moves to producer completion.
- [IMPACT] Existing defensive gate checks remain unless parity tests prove producer completion covers the same behavior and the spec explicitly removes a duplicate check.
- [MIGRATION] gate draft/spec: current parse/schema/lifecycle/static checks move first to producer completion; run-gate remains semantic owner and defensive precondition owner.
- [MIGRATION] gate task-impl/integration: phase-keyed retry/artifact behavior remains in run-gate; producer completion supplies trusted evidence before integration trust checks.
- [MIGRATION] review draft/spec/test/impl: review commands keep artifact generation; producer completion or protocol handling owns artifact shape and schema failures.
- [MIGRATION] scenario-validity/test-execute/test-result-review: current validators remain the baseline; the producer contract becomes their shared completion path.
- [MIGRATION] set step implement done: completion keeps flow transition surface; new owner for readiness checks is completion-time producer contract.

## Clarifications (Q&A)
- Q: Should gate-side static validation be removed after producer validation is added?
  - A: No. It remains as a defensive precondition unless a later change proves every retained public behavior through the producer path and explicitly removes the duplicate check.
- Q: Does the shared completion contract decide whether a flow step stops, repairs, or proceeds?
  - A: No. It returns success or unresolved mechanical failure. The caller owns the flow transition, repair route, acceptance deferral, and retry counter behavior.
- Q: Can semantic retry exhaustion proceed when required artifacts are missing or invalid?
  - A: No. Missing or invalid artifacts are not evaluable by acceptance-review and must stop as structural failures before semantic deferral.

## Alternatives Considered
- Add generic FlowNode preHooks/postHooks for artifact validation. — Rejected because Issue #385 scopes this as an explicit producer responsibility. Generic hooks obscure the owner of each artifact mutation.
- Keep mechanical validation primarily inside review/gate. — Rejected because it preserves the current retry-counter ambiguity and delays producer contract violations until semantic gate execution.
- Create a class inheritance hierarchy for flow steps. — Rejected because Issue #385 excludes step hierarchy inheritance. Dedicated classes are acceptable only for meaningful return values.
- Stop immediately when semantic retry is exhausted. — Rejected because Issue #385 assigns final judgment for exhausted semantic findings to acceptance-review through flow-findings.json.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-14T03:23:35.567Z
- Notes: User approved the gate-passed spec via option 1.

## Requirements
- R1 [must]: Introduce a reusable artifact completion contract that runs normalize, validate, one deterministic repair attempt when configured, and revalidate; it must return dedicated success or unresolved mechanical failure classes and must not decide flow transitions or retry counters.
- R2 [must]: Apply the artifact completion contract to draft.json and spec.json producer or repair paths so invalid JSON, schema/lifecycle issues, review-triage-repair audit issues, unresolved markers, task monotonic issues, and spec repair audit issues are detected before semantic guardrail judgment.
- R3 [must]: Apply the same producer contract or a shared adapter to scenario-validity-result.json, test-execute-result.json v2, and test-result-review.json so their existing schema, raw evidence range, file-map, placeholder, and regression trust checks still run before downstream trust decisions.
- R4 [must]: Before implement can be marked done, mechanically verify requirement status completion, file-map coverage for testable requirements, and required durable artifacts; a failed check must block completion with a structural failure envelope. Lint readiness is excluded until a durable lint evidence artifact exists.
- R5 [must]: Ensure reviewRetry and gateRetry are consumed only by AI semantic FAIL verdicts; mechanical validation failure, deterministic repair failure, provider/tooling/protocol failure, and AI output schema failure must be represented in artifacts or envelopes without semantic retry consumption.
- R6 [must]: When AI semantic FAIL retry is exhausted in draft-gate, spec-review, spec-gate, impl-review, impl-gate task-impl, or impl-gate integration, append unresolved findings to flow-findings.json, keep the current review/gate step from stopping solely because of that exhaustion, and include the deferred finding summary in subsequent context for acceptance-review. Spec-review deferral must read semantic blocking records from the current spec-review.json source arrays (`blocking[]` when present, otherwise `blockingFindings[]`) and preserve existing ids or synthesize stable sourceFindingId values.
- R7 [must]: Preserve migration parity for retained public surfaces with no removals: gate draft/spec map parse, schema, lifecycle, static, and repair-audit checks to producer completion first while run-gate remains semantic and defensive owner; gate task-impl/integration keep phase-keyed retry, artifact, failure envelope, and progression behavior; review draft/spec/test/impl keep artifact generation while protocol/schema failure remains non-semantic; scenario-validity/test-execute/test-result-review keep existing schema, raw evidence, placeholder, file-map, and regression checks; implement completion keeps the set-step surface and adds observable readiness checks.

## Acceptance Criteria
- For R1, spec-local tests under `specs/295-producer-artifact-contract/tests/` with `// spec: R1` headers instantiate the shared completion contract with a passing validator, failing validator, repairable validator, and unrepairable validator; the returned values are dedicated classes and no test observes a flow state mutation from the helper itself.
- For R2, spec-local tests under `specs/295-producer-artifact-contract/tests/` with `// spec: R2` headers prove draft/spec producer invalid output stops before the guardrail AI call, while output passing parse plus schema/lifecycle/static checks reaches the semantic guardrail path.
- For R3, spec-local tests under `specs/295-producer-artifact-contract/tests/` with `// spec: R3` headers prove scenario-validity-result.json, test-execute-result.json v2, and test-result-review.json keep their current required fields, raw evidence range checks, file-map checks, placeholder checks, and structural failure behavior through the producer contract.
- For R4, spec-local tests under `specs/295-producer-artifact-contract/tests/` with `// spec: R4` headers prove implement completion is rejected when a testable requirement lacks done status, file-map coverage, or required durable artifact evidence, and accepted when those observable inputs satisfy the contract; lint readiness is not part of this requirement unless a durable lint artifact is added.
- For R5, spec-local tests under `specs/295-producer-artifact-contract/tests/` with `// spec: R5` headers prove AI semantic FAIL increments the relevant retry counter and mechanical/protocol/tooling/schema failures leave the same counter unchanged.
- For R6, spec-local tests under `specs/295-producer-artifact-contract/tests/` with `// spec: R6` headers prove retry exhaustion writes flow-findings.json entries with sourceStep, sourceArtifact, sourceFindingId, attempts, retryExhausted=true, completionKind=deferred, and that later context exposes the deferred finding summary to acceptance-review; spec-review tests use actual spec-review.json blocking source arrays rather than a normalized fixture only.
- For R7, spec-local tests under `specs/295-producer-artifact-contract/tests/` with `// spec: R7` headers cover every retained command surface listed in R7, including task-impl and integration gate phases, with at least one behavior-level assertion over artifact path, failure envelope or code, and progression state.

## Implementation Targets
- src/flow/lib/run-gate.js
- src/flow/lib/test-artifacts.js
- src/flow/lib/set-step.js
- src/flow/commands/review.js
- src/flow/lib/flow-findings.js
- src/flow/lib/get-context.js
- specs/295-producer-artifact-contract/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Define artifact completion
  - Create the shared producer-side completion contract and dedicated result classes for success and unresolved mechanical failure.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Apply producer validation
  - Call the shared completion contract from draft, spec, repair, and test artifact producer paths before downstream semantic checks trust their artifacts.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Enforce implement completion
  - Make implement completion validate requirement status, file-map coverage, and required durable artifacts before the step can be marked done.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Separate retry handling
  - Classify semantic and non-semantic failures consistently, and defer exhausted semantic findings through flow-findings.json.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Verify migration parity
  - Add behavior-level coverage for every retained public command surface and generated artifact path listed in R7.
  - see `tasks/T-5.md` for full spec
