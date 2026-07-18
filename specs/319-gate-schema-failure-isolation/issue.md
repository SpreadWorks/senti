## Summary

Separate gate output protocol/schema failures from the semantic PASS/FAIL retry lifecycle. Malformed observations, schema repair failures, and provider/tooling exhaustion must stop as tooling/provider failures with precise phase/error evidence, without mutating semantic artifacts or gate retry counters.

## Problem

In #430 and #432, the guardrail observation was semantically plausible, but `Observation.requirementRef` contained malformed values such as `no-overengineering: ...`. The schema-repair path replayed the same cached invalid response instead of forcing a fresh repair attempt, and eventually surfaced `ESCALATE_RETRY_EXHAUSTED`.

At the same time, an inferred integration phase was not propagated to `onError`, which triggered a secondary diagnostic failure: `phase must be a non-empty string`. That secondary error obscured the original protocol/schema failure and misclassified it as semantic retry exhaustion.

Protocol/schema failures are not semantic gate results. They must not:

- increment `gateRetry` or semantic PASS/FAIL counters
- create or update semantic result artifacts
- trigger normal semantic post-result lifecycle
- affect task/integration routing

## Scope

- `src/flow/lib/run-gate.js`
- `src/flow/registry.js`
- agent/cache invocation helpers only where required for fresh repair or tooling classification
- focused unit/e2e coverage

## Requirements

1. Restrict `Observation.requirementRef` in both the gate prompt and output schema to the exact requirement IDs and guardrail IDs known for the current invocation. Reject explanatory text, prefixes/suffixes, and unknown IDs.
2. Never treat replay of the same cached invalid output as a fresh schema-repair attempt.
3. If repair is allowed, force an uncached fresh provider call via cache bypass or key separation. If a fresh repair attempt cannot be guaranteed, stop with a tooling/provider failure instead of replaying the same response.
4. Classify parse failures, schema-validation failures, and repair exhaustion as tooling/provider failures, not semantic `ESCALATE_RETRY_EXHAUSTED`.
5. Propagate explicit and inferred phases through the same contract so `onError` always receives a non-empty effective gate phase.
6. On protocol/schema failure, skip semantic post-result processing, semantic artifact persistence, and `gateRetry` mutation.
7. Preserve the original validation/repair/provider error as the primary evidence. Record effective phase and cache/fresh-repair outcome without letting secondary errors overwrite the root cause.
8. Preserve existing counter behavior and task/integration routing for valid semantic PASS/FAIL results.
9. Validate run / Issue / spec target guards before agent invocation, cache access, or artifact/state mutation.
10. Preserve public ownership/store invariants. Do not add new dependencies or compatibility shims.

## Acceptance Criteria

- [ ] The gate prompt/schema restricts `Observation.requirementRef` to exact known requirement/guardrail IDs for the invocation; values such as `known-id: explanation` and unknown IDs fail schema validation.
- [ ] When repairing a malformed `requirementRef` from cached output, the same cached invalid response is not replayed as a fresh repair attempt.
- [ ] When uncached fresh repair is possible, a new provider response is requested; when it is not provably possible, execution stops in a bounded way as a tooling/provider failure.
- [ ] Repeated invalid/cached output and schema-repair exhaustion are never classified as semantic `ESCALATE_RETRY_EXHAUSTED`.
- [ ] Protocol/schema failure leaves `gateRetry` and semantic PASS/FAIL counters unchanged and does not create or update semantic result artifacts.
- [ ] Both explicit and inferred task/integration phases propagate the same non-empty effective phase into diagnostics and `onError`.
- [ ] Missing explicit phase does not trigger `phase must be a non-empty string`; the original schema/tooling error remains the primary diagnostic.
- [ ] Durable error evidence records effective phase, schema violation, repair attempts, cache bypass/replay decision, and final tooling/provider classification.
- [ ] Valid semantic PASS/FAIL observations preserve existing counter semantics and task/integration routing.
- [ ] Protocol failures in both task and integration phases bypass semantic lifecycle processing and behave equivalently for explicit vs inferred phase inputs.
- [ ] Run / Issue / spec guard mismatches return `ACTIVE_FLOW_MISMATCH` before agent invocation, cache access, or artifact/state mutation, leaving durable state byte-identical.
- [ ] Focused unit/e2e tests cover malformed refs, repeated cached output, missing/inferred phase, zero `gateRetry` mutation, valid observations, and explicit/implicit phase parity.

## Verification

- Provide fixtures with known requirement/guardrail ID sets and compare exact-match refs against description-suffixed or unknown refs.
- Assert repair cache bypass/key separation and provider call counts so repeated cached output cannot be counted as repair success.
- Snapshot flow state, semantic artifacts, and retry counters before and after protocol failure.
- Compare error envelopes and durable evidence for explicit vs inferred task/integration phases.
- Run regression coverage for valid PASS/FAIL fixtures and next-action routing.

## Non-Goals

- changing semantic findings to bypass, defer, or pass
- resetting or increasing semantic gate retry limits
- repairing flow state, artifacts, or counters from #430 / #432
- manual state recovery
- adding external dependencies or public compatibility shims

<details>
<summary>ja</summary>

gate output-schema failure を semantic retry lifecycle から分離する

## Summary

Separate gate output protocol/schema failures from the semantic PASS/FAIL retry lifecycle. Malformed observations, schema repair failures, and provider/tooling exhaustion must stop as tooling/provider failures with precise phase/error evidence, without mutating semantic artifacts or gate retry counters.

## Problem

In #430 and #432, the guardrail observation was semantically plausible, but `Observation.requirementRef` contained malformed values such as `no-overengineering: ...`. The schema-repair path replayed the same cached invalid response instead of forcing a fresh repair attempt, and eventually surfaced `ESCALATE_RETRY_EXHAUSTED`.

At the same time, an inferred integration phase was not propagated to `onError`, which triggered a secondary diagnostic failure: `phase must be a non-empty string`. That secondary error obscured the original protocol/schema failure and misclassified it as semantic retry exhaustion.

Protocol/schema failures are not semantic gate results. They must not:

- increment `gateRetry` or semantic PASS/FAIL counters
- create or update semantic result artifacts
- trigger normal semantic post-result lifecycle
- affect task/integration routing

## Scope

- `src/flow/lib/run-gate.js`
- `src/flow/registry.js`
- agent/cache invocation helpers only where required for fresh repair or tooling classification
- focused unit/e2e coverage

## Requirements

1. Restrict `Observation.requirementRef` in both the gate prompt and output schema to the exact requirement IDs and guardrail IDs known for the current invocation. Reject explanatory text, prefixes/suffixes, and unknown IDs.
2. Never treat replay of the same cached invalid output as a fresh schema-repair attempt.
3. If repair is allowed, force an uncached fresh provider call via cache bypass or key separation. If a fresh repair attempt cannot be guaranteed, stop with a tooling/provider failure instead of replaying the same response.
4. Classify parse failures, schema-validation failures, and repair exhaustion as tooling/provider failures, not semantic `ESCALATE_RETRY_EXHAUSTED`.
5. Propagate explicit and inferred phases through the same contract so `onError` always receives a non-empty effective gate phase.
6. On protocol/schema failure, skip semantic post-result processing, semantic artifact persistence, and `gateRetry` mutation.
7. Preserve the original validation/repair/provider error as the primary evidence. Record effective phase and cache/fresh-repair outcome without letting secondary errors overwrite the root cause.
8. Preserve existing counter behavior and task/integration routing for valid semantic PASS/FAIL results.
9. Validate run / Issue / spec target guards before agent invocation, cache access, or artifact/state mutation.
10. Preserve public ownership/store invariants. Do not add new dependencies or compatibility shims.

## Acceptance Criteria

- [ ] The gate prompt/schema restricts `Observation.requirementRef` to exact known requirement/guardrail IDs for the invocation; values such as `known-id: explanation` and unknown IDs fail schema validation.
- [ ] When repairing a malformed `requirementRef` from cached output, the same cached invalid response is not replayed as a fresh repair attempt.
- [ ] When uncached fresh repair is possible, a new provider response is requested; when it is not provably possible, execution stops in a bounded way as a tooling/provider failure.
- [ ] Repeated invalid/cached output and schema-repair exhaustion are never classified as semantic `ESCALATE_RETRY_EXHAUSTED`.
- [ ] Protocol/schema failure leaves `gateRetry` and semantic PASS/FAIL counters unchanged and does not create or update semantic result artifacts.
- [ ] Both explicit and inferred task/integration phases propagate the same non-empty effective phase into diagnostics and `onError`.
- [ ] Missing explicit phase does not trigger `phase must be a non-empty string`; the original schema/tooling error remains the primary diagnostic.
- [ ] Durable error evidence records effective phase, schema violation, repair attempts, cache bypass/replay decision, and final tooling/provider classification.
- [ ] Valid semantic PASS/FAIL observations preserve existing counter semantics and task/integration routing.
- [ ] Protocol failures in both task and integration phases bypass semantic lifecycle processing and behave equivalently for explicit vs inferred phase inputs.
- [ ] Run / Issue / spec guard mismatches return `ACTIVE_FLOW_MISMATCH` before agent invocation, cache access, or artifact/state mutation, leaving durable state byte-identical.
- [ ] Focused unit/e2e tests cover malformed refs, repeated cached output, missing/inferred phase, zero `gateRetry` mutation, valid observations, and explicit/implicit phase parity.

## Verification

- Provide fixtures with known requirement/guardrail ID sets and compare exact-match refs against description-suffixed or unknown refs.
- Assert repair cache bypass/key separation and provider call counts so repeated cached output cannot be counted as repair success.
- Snapshot flow state, semantic artifacts, and retry counters before and after protocol failure.
- Compare error envelopes and durable evidence for explicit vs inferred task/integration phases.
- Run regression coverage for valid PASS/FAIL fixtures and next-action routing.

## Non-Goals

- changing semantic findings to bypass, defer, or pass
- resetting or increasing semantic gate retry limits
- repairing flow state, artifacts, or counters from #430 / #432
- manual state recovery
- adding external dependencies or public compatibility shims

</details>