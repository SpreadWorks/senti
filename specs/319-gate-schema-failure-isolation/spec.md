# Feature Specification: 319-gate-schema-failure-isolation

**Feature Branch**: `feature/319-gate-schema-failure-isolation`
**Created**: 2026-07-12
**Status**: Draft
**Input**: GitHub Issue #435

## Goal
Separate gate output protocol/schema failures from semantic PASS/FAIL retry handling so malformed output stops with root-cause tooling evidence and never changes semantic counters, artifacts, or routing.

## Background
Gate Observation validation currently has three conflicting layers: a provider schema that accepts any `requirementRef` string, a parser that rejects unknown IDs, and a retry helper whose attempt count and exhaustion code belong to the semantic gate lifecycle. Because every retry reuses the same agent prompt and cache identity, an invalid cached response can be replayed without a fresh provider call and ultimately surface as `ESCALATE_RETRY_EXHAUSTED`. When the phase was inferred, the local effective phase was not copied into the registry onError context, allowing a secondary empty-phase diagnostic to obscure the validation failure. The change isolates this malformed-output path while retaining valid gate behavior.

## Scope
- Constrain guardrail Observation `requirementRef` values in both the provider-facing prompt and JSON schema to the exact requirement and guardrail IDs known for the current invocation.
- Permit at most one uncached fresh repair call after an invalid initial response, for at most two provider calls total, and reject cached replay as a repair attempt.
- Classify parse, schema-validation, and repair exhaustion as tooling/provider failures with durable root-cause, effective-phase, attempt, and cache evidence.
- Prevent protocol/schema failures from entering semantic result persistence, retry accounting, post-result side effects, or task/integration routing.
- Propagate explicit and inferred gate phases through the same diagnostic and registry onError contract.
- Preserve dispatcher target-guard ordering and valid semantic PASS/FAIL behavior with unit, end-to-end, and spec-local regression coverage.

## Out of Scope
- Changing semantic finding verdicts to bypass, defer, or pass.
- Resetting or increasing semantic gate retry limits.
- Repairing flow state, artifacts, or counters from Issues 430 or 432.
- Changing public command names, phase arguments, hooks, config entries, or FlowStore ownership.
- Adding external dependencies, compatibility shims, manual recovery, push, publish, or release work.

## Constraints
- Use only Node.js built-in modules and existing command, envelope, registry, prompt-builder, agent, and cache patterns.
- Limit production changes to `src/flow/lib/run-gate.js`, `src/flow/registry.js`, and `src/lib/agent.js`; preserve all other agent call sites and cache behavior.
- Use one initial provider call and at most one fresh repair call. The repair call shall bypass prompt-cache reads and writes or use a repair-specific identity that cannot resolve the initial cached response.
- Represent protocol/tooling evidence with a dedicated class whose constructor requires a non-empty effective phase, original error, attempt evidence, cache outcome, and tooling/provider classification.
- Do not write or update phase gate-result artifacts, gate recovery baselines, passed-guardrail memory, `gateRetry`, PASS/FAIL counters, or routing state for protocol/schema failures.
- Keep dispatcher target-guard validation before command loading, lifecycle hooks, agent invocation, cache access, runtime target persistence, and artifact/state mutation.
- Run `npm test`; because `src/lib/agent.js` is in scope, also run `npm run test:agent`.

## Design Principles
- Treat provider output validity as a tooling protocol boundary, not a semantic gate verdict.
- Make the provider-facing schema and prompt carry the same invocation-specific ID set that the parser enforces.
- Make freshness explicit and auditable for every repair attempt.
- Preserve the original failure as primary evidence and prevent lifecycle hooks from replacing it with secondary diagnostics.
- Retain valid semantic behavior and move only malformed-output ownership to the tooling failure path.

## Overview
### Modules
- `src/flow/lib/run-gate.js` builds invocation-specific Observation contracts, validates responses, performs one optional fresh repair, and creates typed tooling failure evidence.
- `src/lib/agent.js` provides an internal cache policy for a repair call that cannot read or persist the initial prompt-cache entry while leaving other call sites unchanged.
- `src/flow/registry.js` receives the effective phase for explicit and inferred gate failures and records tooling evidence without semantic post-result lifecycle actions.
- Existing dispatcher and FlowCommand target guards remain the pre-execution authority and are covered by gate-specific side-effect-ordering regression tests.

### Data Flow
- The gate resolves target guards and the effective phase, collects the exact current requirement/guardrail IDs, and injects that set into the prompt, JSON schema enum, and parser.
- The initial agent call may use normal cache behavior. A parse/schema failure records its cache outcome; if fresh repair is supported, one cache-bypassed call is made and validated against the same exact ID set.
- A valid response enters the existing PASS/FAIL evaluation and registry post lifecycle. An invalid response after the allowed calls throws a typed tooling/provider failure carrying effective phase and attempt evidence to registry onError.
- Registry onError persists root-cause tooling evidence. It does not invoke semantic post actions, update retry memory, write semantic gate-result artifacts, or change task/integration routing.

### Decisions
- [VERIFY] checked `parseGuardrailArticleEvaluation`; result=match: it rejects unknown `requirementRef` values against `knownIds`, including description-suffixed strings, after parsing.
- [CORRECTION] checked the provider contract; replace the static string-only `requirementRef` schema and placeholder fallback text with an invocation-specific enum and exact-ID instruction.
- [CORRECTION] checked output retry ownership; use a tooling-only maximum of two provider calls rather than semantic `gateRetry` remaining budget.
- [CORRECTION] checked prompt-cache identity; the repair call must explicitly bypass cache because replaying the same prompt/schema/options resolves the same cache key.
- [CORRECTION] checked inferred phase handling; assign the resolved phase to the shared command/hook context before gate execution so thrown failures and registry onError use the same non-empty effective phase.
- [VERIFY] checked semantic retry accounting; result=match: only results marked `ai_semantic_fail` increment `gateRetry`, so the tooling path must throw before semantic result construction and registry post handling.
- [VERIFY] checked guard ordering; result=match: dispatcher validates run, Issue, and spec expectations before command module loading, pre hooks, command execution, cache access, and artifacts. Preserve this boundary and add gate-specific byte-identity regression evidence.
- Migration parity maps the retained CLI and valid PASS/FAIL path to RunGateCommand/registry post, the replaced malformed-output path to typed tooling failure/registry onError, valid artifacts to existing phase owners, and protocol evidence to issue-log; no public API, hook, or config surface is removed.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Keep the provider schema string-only and rely on parser membership checks. — Rejected because the provider would still be invited to emit explanatory or unknown IDs, and the Issue requires the prompt and output schema to share the exact invocation-specific set.
- Reuse semantic `gateRetry` as the schema-repair budget. — Rejected because protocol validity is a tooling boundary and must not consume, reset, exhaust, or otherwise depend on semantic PASS/FAIL retries.
- Retry the identical prompt through normal cache behavior. — Rejected because it can replay the same invalid cached output without a provider call and cannot prove repair freshness.
- Return a semantic FAIL result for malformed output. — Rejected because registry post hooks would persist semantic artifacts and counters, obscuring the provider protocol failure and changing routing.
- Add a public no-cache command or configuration option. — Rejected because freshness is an internal schema-repair concern and public surface expansion is outside Issue #435.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-12T21:07:32.774Z
- Notes: Parent granted routine Issue-preserving approval for Issue #435.

## Requirements
- R1 [must]: For each guardrail or implementation-requirement agent invocation, the prompt and JSON output schema shall restrict `Observation.requirementRef` or equivalent evaluation IDs to an enum containing exactly the requirement IDs and guardrail IDs valid for that invocation; exact values pass, while prefixed, suffixed, explanatory, empty, and unknown values fail validation.
- R2 [must]: The post-response parser shall validate the same invocation-specific ID set as the provider schema and preserve the original parse or schema-validation error, including the invalid field locator and value, as the primary failure cause.
- R3 [must]: After an invalid initial output, schema repair shall make at most one additional provider call and at most two provider calls total. The repair call shall be provably fresh through cache bypass or repair-specific key separation; a cache replay shall not count as a fresh attempt, and inability to guarantee freshness shall stop before repair.
- R4 [must]: Parse failure, schema-validation failure, freshness-unavailable repair, and invalid fresh repair output shall throw a tooling/provider failure code distinct from `ESCALATE_RETRY_EXHAUSTED`, with typed durable evidence containing original error, effective phase, attempt count, per-attempt cache/freshness outcome, and final classification.
- R5 [must]: Explicit and inferred draft, spec, task-impl, and integration phases shall populate the same non-empty effective phase before gate execution and shall pass it unchanged to error envelopes, runtime diagnostics, issue-log evidence, and registry onError handling; secondary diagnostic failures shall not replace the original tooling error.
- R6 [must]: A protocol/schema/tooling gate failure shall not create or update semantic gate-result artifacts, gate source/recovery baselines, passed-guardrail memory, `gateRetry`, PASS/FAIL counters, task completion, integration routing, or normal semantic post-result lifecycle state.
- R7 [must]: Valid semantic PASS and FAIL outputs shall preserve existing result artifacts, `gateRetry` reset/increment behavior, passed-guardrail memory, task completion, side effects, and task/integration routing for both explicit and inferred phase inputs.
- R8 [must]: Run ID, Issue, and spec guard mismatches shall return `ACTIVE_FLOW_MISMATCH` before command loading, gate pre hooks, agent invocation, prompt-cache reads or writes, runtime target persistence, issue-log changes, semantic artifacts, or flow-state mutation, leaving durable state byte-identical.
- R9 [must]: Agent cache changes shall affect only the schema-repair call, retain existing normal cache hit/miss and metric behavior for all other calls, add no public command/config surface, use no external dependency, and preserve FlowStore, artifact-store, and registry ownership.

## Acceptance Criteria
- AC1: Schema and prompt tests provide two known IDs and show exact `requirementRef` values accepted while `known-id: explanation`, prefixed values, empty strings, and unknown IDs are rejected before semantic evaluation.
- AC2: Parser tests show the same known-ID membership rule and retain the original field locator and invalid value in the primary validation error.
- AC3: An invalid cached initial response triggers one cache-bypassed provider call, produces two total calls, and never returns the identical cached response as fresh repair evidence.
- AC4: When cache bypass or key separation is unavailable, execution stops after the initial invalid response with a tooling/provider failure and one provider-or-cache resolution attempt; no semantic retry exhaustion code is emitted.
- AC5: A second invalid response stops after two total calls with original validation error, effective phase, attempt evidence, cache outcomes, and tooling/provider classification in the envelope and durable issue-log evidence.
- AC6: For explicit and inferred task-impl and integration inputs, equivalent malformed output produces the same non-empty effective phase and tooling classification without `phase must be a non-empty string` or other secondary-error replacement.
- AC7: Before and after snapshots for malformed output show unchanged `gateRetry`, PASS/FAIL metrics, task cursor, routing steps, recovery memory, semantic gate-result artifacts, and phase gate source artifacts.
- AC8: Valid PASS resets and valid FAIL increments the existing semantic counter exactly as before, persists the same semantic artifacts/memory, and follows the same task/integration routing for explicit and inferred phases.
- AC9: A mismatch of run ID, Issue, or spec returns `ACTIVE_FLOW_MISMATCH` with zero agent calls, zero cache reads/writes, zero hook calls, and byte-identical flow state, issue-log, cache store, and semantic artifact snapshots.
- AC10: Normal non-repair agent calls retain existing cache keys, cache hit/miss behavior, and metrics; no public CLI option, config key, hook name, or external dependency is added.
- AC11: Spec-local tests contain `// spec: R<N>` headers covering R1-R9; relevant unit/E2E suites, `npm test`, `npm run test:agent`, and final regression pass.

## Implementation Targets
- src/flow/lib/run-gate.js
- src/flow/registry.js
- src/lib/agent.js
- tests/unit/flow/gate-evaluation-schema.test.js
- tests/unit/flow/gate-retry-counter.test.js
- tests/unit/flow/gate-phase-inference.test.js
- tests/unit/lib/agent.test.js
- tests/unit/lib/dispatcher.test.js
- tests/e2e/flow/gate-impl-integration.test.js
- specs/319-gate-schema-failure-isolation/tests/gate-schema-failure-isolation.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Constrain gate observation references
  - Make the provider-facing prompt, JSON schema, and parser enforce one exact invocation-specific requirement and guardrail ID set.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Isolate gate output repair
  - Move invalid provider output to a two-call tooling repair path with provable cache freshness and typed root-cause evidence.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Preserve gate lifecycle boundaries
  - Propagate effective phase and keep tooling failures outside semantic hooks, artifacts, counters, routing, and pre-guard side effects while retaining valid PASS/FAIL behavior.
  - see `tasks/T-3.md` for full spec
