# Feature Specification: 319-requirement-gate-context

**Feature Branch**: `feature/319-requirement-gate-context`
**Created**: 2026-07-12
**Status**: Draft
**Input**: GitHub Issue #436

## Goal
Give every task-implementation and integration requirement evaluation deterministic, size-capped, cited specification context so the evaluator applies the requirement's actual obligation and rejects only behavior missing from or contradictory to authoritative sources.

## Background
Implementation requirement evaluation currently renders RequirementPromptExcerpt values containing only id, description, priority, and testability, then pairs them with file-map-selected diffs. It does not pass matching acceptance criteria, global exclusions and constraints, design/data-flow/schema contracts, task intent, implementation targets, or file-map ownership as cited context. The resulting model can treat preservation or regression evidence as a request to reimplement delegated code, and it can invent fields or rejection rules absent from the spec. Issue #436 records Issue #432 R6 and Issue #434 R7 as concrete regressions and requires prompt/context correction without changing retry or gate contracts.

## Scope
- Construct and render per-requirement context in src/flow/lib/run-gate.js.
- Include requirement text, matching acceptance criteria, global Out of Scope and constraints, linked design and data-flow entries, exact contract identifiers, linked task intent, implementation targets, file-map ownership, and mapped diff evidence.
- Classify implementation, regression-only, and preservation/non-interception obligations with deterministic rules and render obligation-specific evaluation instructions.
- Add spec-local, unit, and end-to-end coverage for deterministic bytes, resource caps, citations, Issue #432 R6, Issue #434 R7, missing behavior, guard ordering, counters, cache/result shape, and routing.

## Out of Scope
- Gate bypass, semantic finding deferral, or manual finding disposition.
- Retry reset, retry-limit extension, or mutation of prior Issue #432 or Issue #434 flow state.
- New spec schema fields, evaluator result fields, external dependencies, or public compatibility shims.
- Push, npm publish, npm dist-tag, or release operations.

## Constraints
- Use Node.js built-in modules only.
- Keep the existing implementation evaluation result schema {evaluations:[{guardrail_id,result,reason}]} unchanged.
- Keep MAX_IMPL_REQUIREMENT_BATCH_CHARS at 120000 and MAX_AGENT_PROMPT_INPUT_CHARS at 900000; context and diff characters must count toward the existing limits.
- Validate run, Issue, and spec target guards before loading spec context, file-map data, agent/cache state, or mutable gate artifacts.
- Represent context entries, rendered context, and obligation kind with classes whose constructors enforce source-reference, text, ordering, and size invariants.
- Do not add fallback fields, alternate result formats, gate bypasses, retry changes, dependencies, or compatibility branches.

## Design Principles
- Authoritative context is additive to existing mapped diff evidence; it does not change which task or integration route owns evaluation.
- Global constraints and Out of Scope entries apply to every requirement; acceptance criteria and module, data-flow, decision, task, target, file-map, and schema-contract entries require an exact requirement-ID or ownership linkage.
- Stable references derive from source kind plus source index or identifier, never from model-generated labels.
- Truncation preserves fixed section order, source order within spec arrays, lexical path order for file-map entries, and whole-entry boundaries before emitting one fixed truncation marker.
- Absence from cited authoritative context cannot create a required field, outcome, rejection rule, or implementation obligation.

## Overview
### Modules
- src/flow/lib/run-gate.js owns RequirementPromptExcerpt, RequirementGateBatch, buildImplCheckPrompt, planRequirementGateCalls, file-map loading, mapped diffs, agent invocation, and implementation gate persistence.
- RequirementContextEntry stores one stable source reference and bounded source text; RequirementGateContext owns ordered entries, obligation metadata, total-cap enforcement, and toPromptText().
- RequirementObligation stores exactly one kind: implementation, regression-only, or preservation/non-interception, and renders the matching evaluation contract.
- Spec-local tests provide Issue #436 behavioral evidence; shared unit and end-to-end tests protect prompt construction, gate routing, guard ordering, counters, cache identity, and result shape.

### Data Flow
- After FlowCommand target validation, executeDiffBasedGate loads validated spec.json, computes committed/uncommitted/untracked diffs, then loads file-map ownership exactly where the existing gate does today.
- For each requirement, the context builder emits [REQ:<id>] first; AC entries containing the exact requirement ID; every global [OUT:<n>] and [CONSTRAINT:<n>]; then linked [PRINCIPLE:<n>], [MODULE:<n>], [DATA:<n>], [DECISION:<n>], [SCHEMA:<source>:<n>], [TASK:<id>], [TARGET:<n>], and lexically ordered [FILE-MAP:<id>:<n>] entries.
- A requirement ID matches only at non-identifier boundaries, so R1 cannot match R10. Exact backtick-delimited identifiers establish other non-global links. Task intent links when goal, acceptance, implementation_notes, or test_strategy contains the requirement ID; targets link when named by requirement, matched AC, linked task, or file-map.
- Each item is capped at 1000 characters, each section at 12 items, and each per-requirement rendered context at 24000 characters. Overflow stops at the next whole entry and appends [CONTEXT:TRUNCATED].
- RequirementGateBatch counts rendered context plus mapped diff toward the unchanged 120000-character batch cap, then buildImplCheckPrompt emits fixed-order Requirement Contexts and Git Diff sections whose bytes are the existing agent-cache input.
- The evaluator returns the unchanged evaluations array. Prompt rules require each reason to cite [REQ:<id>] and every additional AC, constraint, decision, schema, task, target, file-map, or evidence source used; uncited or absent sources cannot justify a finding.

### Decisions
- [VERIFY] Extend the existing requirement batch pipeline rather than create a second evaluation route.
- [VERIFY] Preserve current aggregate resource and cache boundaries while adding smaller per-requirement caps.
- [VERIFY] Preserve target guard order by constructing context only inside executeDiffBasedGate after FlowCommand context resolution.
- Impact on existing features: requirement prompt bytes change, while semantic counters, retry memory, agent cache mechanism, evaluation result schema, task/integration selection, file-map reconciliation, and post-hook persistence retain their current owners and shapes.
- Use global applicability for constraints and Out of Scope rather than lexical filtering, because those spec sections constrain every requirement; all other supplemental sources require exact ID or ownership linkage.
- Keep source-derived context and obligation classes in run-gate.js unless a shared constructor/rendering invariant is used by two production modules.

## Clarifications (Q&A)
- Q: Does global applicability violate the requirement not to dump unrelated full-spec text?
  - A: No. Only scope.out and constraints are globally applicable, each is capped at 12 entries and 1000 characters per entry, and the full context is capped at 24000 characters. All other sections require exact linkage.
- Q: Does this change the evaluator response schema to carry citations separately?
  - A: No. Stable citations remain inside the existing non-empty reason string, preserving the result schema and persistence contract.
- Q: Is mergeOutcome added as a compatibility field?
  - A: No. It is an explicit negative fixture: the evaluator cannot require it unless a rendered source defines it.

## Alternatives Considered
- Pass the complete rendered spec to every requirement call. — Rejected because unrelated sections consume prompt budget, weaken source attribution, and violate Issue #436's per-requirement selection requirement.
- Use retries or additional tests without changing prompt context. — Rejected because the known failures arise from missing authoritative interpretation context and consume semantic retries without changing the evaluator input.
- Add obligationType, schemaFields, or citations fields to spec.json and evaluator result schemas. — Rejected because Issue #436 excludes new or invented schema fields and requires preservation of the evaluator result schema.
- Validate citations by adding a new parser output field. — Rejected because prompt-enforced stable references fit the existing reason field; a parser schema change would expand the public and persisted contract.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-12T22:01:36.628Z
- Notes: Parent pre-approved routine Issue-preserving specification approval; spec-review and spec-gate both passed.

## Requirements
- R1 [must]: Create immutable RequirementContextEntry, RequirementGateContext, and RequirementObligation values in run-gate.js; constructors reject empty references/text, unknown source or obligation kinds, non-positive caps, and non-deterministic input collections, and each value owns its prompt rendering.
- R2 [must]: Build one RequirementGateContext per evaluated requirement with [REQ:<id>] full text; up to 12 exact-boundary-ID matching ACs; the first 12 global Out of Scope and constraint entries in source order; up to 12 exact-ID or exact backtick-identifier-linked principles, modules, data-flow, decisions, tasks, and implementationTargets; [SCHEMA:<source-ref>:<n>] entries for exact backtick identifiers in linked text containing schema, field, or contract; and direct file-map ownership plus mapped diff evidence.
- R3 [must]: Render context in fixed section order, preserve spec-array source order, sort file-map paths lexically, cap each section at 12 items, each item at 1000 characters, and each requirement context at 24000 characters, truncating only at deterministic character or whole-entry boundaries with [CONTEXT:TRUNCATED].
- R4 [must]: Count rendered requirement context and mapped diff toward the unchanged 120000-character RequirementGateBatch limit and unchanged 900000-character agent input limit; identical spec, file-map, diff, and task state must produce byte-identical prompts and therefore the same existing cache key.
- R5 [must]: Assign obligation kind deterministically from lowercased requirement text plus matched ACs: preservation/non-interception wins for preservation, non-interception, non-interference, remain unchanged, retain existing, or byte-identical phrases; regression-only applies for regression-only, no regression, or continue existing behavior when none of add, create, change, introduce, implement, return, write, set, support, reject, or require is present; every other requirement is implementation.
- R6 [must]: Prompt instructions for regression-only and preservation/non-interception obligations must evaluate cited regression evidence and non-interference only, must not demand reimplementation of delegated existing behavior, and must return FAIL when required regression evidence is absent or mapped changes intercept, remove, or contradict preserved behavior.
- R7 [must]: Prompt instructions must prohibit findings that require a field, outcome, rejection rule, or behavior absent from the rendered authoritative context; safe canonical path a/../x and exact schema fields must be evaluated from cited source text, and mergeOutcome must not be required when no rendered source defines it.
- R8 [must]: Prompt instructions must require every evaluation reason to cite [REQ:<id>] and every additional source reference used, and must return semantic FAIL when cited context requires changed behavior, an integration, an exact field, preservation, or regression evidence that mapped implementation/test evidence omits or contradicts.
- R9 [must]: Keep parseImplRequirementEvaluation output fields, semantic PASS/FAIL counter transitions, retry memory, agent cache mechanism, persisted impl-gate-result schema, task/integration routing, no-related-diff behavior, and file-map reconciliation behavior unchanged.
- R10 [must]: For mismatched run, Issue, or spec guards, return ACTIVE_FLOW_MISMATCH before spec/context/file-map construction, agent or cache access, and state or artifact mutation; flow state and spec artifacts must remain byte-identical and the agent stub invocation count must remain zero.
- R11 [must]: Add spec-local tests beginning with // spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 and shared unit/end-to-end coverage for source selection, bounds, ordering, citations, all three obligation kinds, Issue #432 R6 PASS/FAIL, Issue #434 R7 PASS, missing changed behavior FAIL, guard mismatch immutability, counters, cache/result shape, and routing.

## Acceptance Criteria
- AC1 (R1,R2): A context fixture renders the full R2 text and stable REQ, AC, OUT, CONSTRAINT, PRINCIPLE, MODULE, DATA, DECISION, SCHEMA, TASK, TARGET, and FILE-MAP references only when the defined global or exact-link rule applies.
- AC2 (R3,R4): Two builds from identical inputs are byte-equal; reverse-order file-map input still renders lexical paths; 13-item, 1001-character-item, 24001-character-context, 120001-character-batch, and 900001-character-agent fixtures stop at the specified caps and render deterministic markers.
- AC3 (R5): Unit fixtures classify implementation, regression-only, preservation, and non-interception wording according to the exact precedence and changed-behavior rule in R5.
- AC4 (R6): An Issue #432 R6 fixture returns PASS when delegated behavior is not reimplemented and cited regression/preservation evidence passes, and returns FAIL when that evidence is absent or mapped code intercepts the preserved route.
- AC5 (R7): An Issue #434 R7 fixture returns PASS when a/../x is accepted by the cited canonical-path contract and exact defined fields are used; its generated prompt contains no requirement to reject that path or produce mergeOutcome.
- AC6 (R8): A contrast fixture returns FAIL when a cited requirement or AC requires changed behavior, integration, or an exact field that is absent from mapped diff evidence, and the reason contains only references present in its rendered context.
- AC7 (R8): Prompt snapshots require [REQ:<id>] in every reason and additional stable references for every AC, constraint, decision, schema, task, target, file-map, or diff assertion used by the evaluator.
- AC8 (R9): Existing semantic counter, retry-memory, cache, result-schema, task/integration routing, no-related-diff, and file-map reconciliation tests pass without expected-output changes outside prompt bytes.
- AC9 (R10): Each run, Issue, and spec mismatch returns ACTIVE_FLOW_MISMATCH with byte-identical flow/spec artifact snapshots and zero context-builder, file-map, stub-agent, and cache calls.
- AC10 (R11): The spec-local test file carries the required header, focused unit/e2e commands pass, test-execute and test-result-review artifacts pass, and final full regression passes.

## Implementation Targets
- src/flow/lib/run-gate.js
- tests/unit/flow/gate-requirement-context.test.js
- tests/e2e/flow/gate-impl-integration.test.js
- specs/319-requirement-gate-context/tests/requirement-gate-context.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add cited requirement context
  - Extend the existing implementation-gate requirement pipeline with deterministic context values and obligation-aware prompt instructions while preserving gate contracts.
  - see `tasks/T-1.md` for full spec
