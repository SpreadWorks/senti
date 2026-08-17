## Summary

Pass a minimal, authoritative same-spec contract context into each `impl-gate` requirement evaluation so preservation checks are evaluated against the current contract established by that spec, not against superseded legacy contracts.

This is a targeted bootstrap fix for the bug observed in #437. It is intentionally narrower than #436 and only covers the subset needed for preservation evaluation to correctly interpret same-spec contract replacement and clarification decisions.

## Problem

`impl-gate` currently evaluates each requirement with insufficient access to same-spec context that updates or narrows the meaning of that requirement. As a result, a preservation requirement can be interpreted as preserving an old contract that the same spec has already replaced.

In the failing case from #437 (`runId=3b5c1463-e8c1-47dd-920b-635833912000`, `spec=320-impl-review-finding-contract`):

- R1-R5 and R7 passed.
- R6 alone consumed 4/5 semantic retries.
- R1/R2 establish replacement of nullable/optional legacy output with a known required enum contract.
- The alpha policy forbids a compatibility fallback.
- A clarification explicitly marks legacy `[]` as invalid.
- R6 valid-output preservation did not reliably see that authoritative same-spec context and instead treated the legacy nullable/`[]` form as something that must still be preserved.

Issue #436 addresses broader requirement-context handling, but it is currently blocked on the #437 impl-review schema fix path. This smaller change removes the bootstrap loop without expanding scope into the full #436 design.

## Proposed Change

For each `impl-gate` requirement evaluation, add an authoritative bounded subset of same-spec context:

1. The current requirement ID and full text.
2. ID-keyed summaries of requirements from the same spec.
3. Same-spec migration / contract replacement decisions.
4. Same-spec clarifications that change the validity of legacy inputs or outputs.

### Ordering rules

- Current requirement first.
- Explicitly referenced requirement IDs next.
- Remaining same-spec items in source order.
- Stable source references preserved throughout.

### Evaluation rule

Preservation must be evaluated against the authoritative current contract established by the same spec. It must not require preservation of a legacy contract that the spec explicitly replaces or invalidates. Real preservation violations against the current contract must still fail.

## Bounded Context Contract

The added context must be deterministic and bounded:

- Requirement summaries: max 64 items, max 768 chars per item.
- Contract replacement decisions: max 24 items, max 1,024 chars per item.
- Clarifications: max 24 items, max 1,024 chars per item.
- Total bootstrap subset: max 48,000 chars.
- Selection, ordering, summarization, truncation, and serialization must be byte-identical for the same input.
- Truncation must occur only at item boundaries.
- Each truncated section must emit a fixed-format truncation record including omitted item count and original character count.
- Construction must be deterministic from existing structured spec artifacts only.
- Do not add a new agent call to generate summaries.

## Scope

### In scope

- `src/flow/lib/run-gate.js`
- Impl-gate requirement prompt/context construction
- Bounded serialization of the authoritative subset
- Preservation-specific evaluation guidance
- Minimal focused tests for contract replacement context, R6 regression, negative preservation, deterministic truncation, and impl-gate non-regression

### Out of scope

Leave these to #436:

- Full requirement context beyond this bootstrap subset
- General architecture/design decision context
- Full authoritative schema redesign
- `implementationTargets`, task ownership, file-map ownership, or mapped diff/evidence full-context support
- Broad obligation-classification redesign
- Global finding citation contract changes
- Gate-wide or review-type-wide architecture changes
- Retry architecture redesign
- Branch repair, rebase, or merge work for #436

## Acceptance Criteria

- [ ] Each `impl-gate` requirement evaluation receives the current requirement plus same-spec requirement summaries, migration/contract replacement decisions, and clarifications with stable source references.
- [ ] Preservation evaluates against the current contract established by the same spec and does not require preserving explicitly retired nullable/optional/legacy contracts.
- [ ] A fixture equivalent to `spec=320-impl-review-finding-contract` causes R6 valid-output preservation to PASS when evaluated with the R1/R2 contract replacement and the clarification that legacy `[]` is invalid.
- [ ] The same fixture FAILS when the implementation actually breaks valid output under the new required enum contract or otherwise violates current-contract preservation/non-interception requirements.
- [ ] Context count, per-item size, total size, selection, ordering, truncation records, and serialized prompt bytes are deterministic and bounded.
- [ ] In over-limit fixtures, the current requirement and explicitly referenced requirements are prioritized, and deterministic truncation with omitted counts is verified.
- [ ] Existing impl-gate output schema, cache identity contract, semantic counter, retry policy, artifact lifecycle, and task/integration routing are unchanged except for legitimate prompt/cache-key updates caused by the added context.
- [ ] Draft/spec/test/acceptance and other gates are unchanged in prompt, schema, evaluation, counters, retry, artifacts, and routing.
- [ ] No external dependencies are added; Node.js built-ins only.
- [ ] `src/` remains generic and does not embed project/spec/Issue/run-specific values; any new context representation with meaningful invariants is modeled explicitly in code.
- [ ] No compatibility fallback is added for legacy nullable/optional/`[]` behavior under the alpha policy.
- [ ] Focused unit/e2e regression tests pass.

## Validation

- Inspect the generated prompt/context for the R6 reproduction fixture and confirm that the R1/R2 contract replacement and the legacy `[]` clarification are included with stable references.
- Add an agent-independent PASS case for correct current-contract preservation and a FAIL case for an actual preservation violation against the new contract.
- Rebuild boundary and overflow fixtures repeatedly and verify byte-identical prompt/cache input plus deterministic truncation records.
- Run existing impl-gate semantic/cache/counter/retry/artifact/routing coverage and relevant non-regression coverage for other gates.

## Constraints

- Do not add gate bypass, manual disposition, retry reset, or retry-limit extension.
- Do not convert schema/tooling failures into semantic outcomes.
- Do not change the output finding contract or tooling-failure boundary defined by #437.
- Do not change existing output schema, cache semantics, counters, retries, artifacts, or routing beyond the required prompt-context update.

<details>
<summary>ja</summary>

impl-gateのpreservation評価へ同一specのcontract contextを渡す

## Summary

Pass a minimal, authoritative same-spec contract context into each `impl-gate` requirement evaluation so preservation checks are evaluated against the current contract established by that spec, not against superseded legacy contracts.

This is a targeted bootstrap fix for the bug observed in #437. It is intentionally narrower than #436 and only covers the subset needed for preservation evaluation to correctly interpret same-spec contract replacement and clarification decisions.

## Problem

`impl-gate` currently evaluates each requirement with insufficient access to same-spec context that updates or narrows the meaning of that requirement. As a result, a preservation requirement can be interpreted as preserving an old contract that the same spec has already replaced.

In the failing case from #437 (`runId=3b5c1463-e8c1-47dd-920b-635833912000`, `spec=320-impl-review-finding-contract`):

- R1-R5 and R7 passed.
- R6 alone consumed 4/5 semantic retries.
- R1/R2 establish replacement of nullable/optional legacy output with a known required enum contract.
- The alpha policy forbids a compatibility fallback.
- A clarification explicitly marks legacy `[]` as invalid.
- R6 valid-output preservation did not reliably see that authoritative same-spec context and instead treated the legacy nullable/`[]` form as something that must still be preserved.

Issue #436 addresses broader requirement-context handling, but it is currently blocked on the #437 impl-review schema fix path. This smaller change removes the bootstrap loop without expanding scope into the full #436 design.

## Proposed Change

For each `impl-gate` requirement evaluation, add an authoritative bounded subset of same-spec context:

1. The current requirement ID and full text.
2. ID-keyed summaries of requirements from the same spec.
3. Same-spec migration / contract replacement decisions.
4. Same-spec clarifications that change the validity of legacy inputs or outputs.

### Ordering rules

- Current requirement first.
- Explicitly referenced requirement IDs next.
- Remaining same-spec items in source order.
- Stable source references preserved throughout.

### Evaluation rule

Preservation must be evaluated against the authoritative current contract established by the same spec. It must not require preservation of a legacy contract that the spec explicitly replaces or invalidates. Real preservation violations against the current contract must still fail.

## Bounded Context Contract

The added context must be deterministic and bounded:

- Requirement summaries: max 64 items, max 768 chars per item.
- Contract replacement decisions: max 24 items, max 1,024 chars per item.
- Clarifications: max 24 items, max 1,024 chars per item.
- Total bootstrap subset: max 48,000 chars.
- Selection, ordering, summarization, truncation, and serialization must be byte-identical for the same input.
- Truncation must occur only at item boundaries.
- Each truncated section must emit a fixed-format truncation record including omitted item count and original character count.
- Construction must be deterministic from existing structured spec artifacts only.
- Do not add a new agent call to generate summaries.

## Scope

### In scope

- `src/flow/lib/run-gate.js`
- Impl-gate requirement prompt/context construction
- Bounded serialization of the authoritative subset
- Preservation-specific evaluation guidance
- Minimal focused tests for contract replacement context, R6 regression, negative preservation, deterministic truncation, and impl-gate non-regression

### Out of scope

Leave these to #436:

- Full requirement context beyond this bootstrap subset
- General architecture/design decision context
- Full authoritative schema redesign
- `implementationTargets`, task ownership, file-map ownership, or mapped diff/evidence full-context support
- Broad obligation-classification redesign
- Global finding citation contract changes
- Gate-wide or review-type-wide architecture changes
- Retry architecture redesign
- Branch repair, rebase, or merge work for #436

## Acceptance Criteria

- [ ] Each `impl-gate` requirement evaluation receives the current requirement plus same-spec requirement summaries, migration/contract replacement decisions, and clarifications with stable source references.
- [ ] Preservation evaluates against the current contract established by the same spec and does not require preserving explicitly retired nullable/optional/legacy contracts.
- [ ] A fixture equivalent to `spec=320-impl-review-finding-contract` causes R6 valid-output preservation to PASS when evaluated with the R1/R2 contract replacement and the clarification that legacy `[]` is invalid.
- [ ] The same fixture FAILS when the implementation actually breaks valid output under the new required enum contract or otherwise violates current-contract preservation/non-interception requirements.
- [ ] Context count, per-item size, total size, selection, ordering, truncation records, and serialized prompt bytes are deterministic and bounded.
- [ ] In over-limit fixtures, the current requirement and explicitly referenced requirements are prioritized, and deterministic truncation with omitted counts is verified.
- [ ] Existing impl-gate output schema, cache identity contract, semantic counter, retry policy, artifact lifecycle, and task/integration routing are unchanged except for legitimate prompt/cache-key updates caused by the added context.
- [ ] Draft/spec/test/acceptance and other gates are unchanged in prompt, schema, evaluation, counters, retry, artifacts, and routing.
- [ ] No external dependencies are added; Node.js built-ins only.
- [ ] `src/` remains generic and does not embed project/spec/Issue/run-specific values; any new context representation with meaningful invariants is modeled explicitly in code.
- [ ] No compatibility fallback is added for legacy nullable/optional/`[]` behavior under the alpha policy.
- [ ] Focused unit/e2e regression tests pass.

## Validation

- Inspect the generated prompt/context for the R6 reproduction fixture and confirm that the R1/R2 contract replacement and the legacy `[]` clarification are included with stable references.
- Add an agent-independent PASS case for correct current-contract preservation and a FAIL case for an actual preservation violation against the new contract.
- Rebuild boundary and overflow fixtures repeatedly and verify byte-identical prompt/cache input plus deterministic truncation records.
- Run existing impl-gate semantic/cache/counter/retry/artifact/routing coverage and relevant non-regression coverage for other gates.

## Constraints

- Do not add gate bypass, manual disposition, retry reset, or retry-limit extension.
- Do not convert schema/tooling failures into semantic outcomes.
- Do not change the output finding contract or tooling-failure boundary defined by #437.
- Do not change existing output schema, cache semantics, counters, retries, artifacts, or routing beyond the required prompt-context update.

</details>