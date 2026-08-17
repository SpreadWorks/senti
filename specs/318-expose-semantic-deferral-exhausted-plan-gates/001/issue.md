## Summary

`flow get next-action` should expose a guarded semantic-deferral continuation for exhausted `draft`/`spec` plan gates when the durable gate source is classified as `semantic_findings`.

This should reuse the existing `run gate` semantic-deferral transition, or an equivalent atomic transition with the same invariants, so the finding is persisted, the gate is completed, and the flow can continue without any additional provider evaluation, retry increment, or reset.

## Problem

Issue #414 is currently blocked by run `a6b9012b-271a-4de5-875a-eca9b439f19b`, where `draft-gate` has reached `5/5` attempts and still has one deferrable semantic wording finding.

The semantic-deferral path already exists in `run gate`: it can defer a semantic finding based on a durable gate source, persist it to `flow-findings.json`, and complete the gate without requesting a new provider evaluation. However, `flow get next-action` currently treats every exhausted plan gate as unrecoverable and returns `recoveryPossible: false` with `unsupported-plan-gate-phase`, so it never exposes a guarded continuation to that existing transition.

Manual execution of a sixth gate evaluation is not allowed. This issue is a prerequisite for resuming #414, but it must not mutate or otherwise operate on the blocked run itself.

## Scope

- `src/flow/lib/get-next-action.js`
- Reuse of the semantic-deferral transition already present in `src/flow/lib/run-gate.js`
- Focused unit and e2e coverage
- Only the minimal related files needed to preserve ownership of this behavior

## Requirements

- For exhausted `draft` and `spec` gates, inspect the durable gate source with the existing structured classifier.
- Only when classification is `semantic_findings`, return a target-guarded next action that executes the existing semantic-deferral transition from `run gate`, or an equivalent atomic transition with the same invariants.
- Preserve run / Issue / spec target guards in the exposed action and reject mismatches before any state mutation with `ACTIVE_FLOW_MISMATCH`.
- Preserve the gate attempt count at `5/5`; do not reset the gate, increment attempts, or trigger any additional provider evaluation.
- Persist the deferred finding to `flow-findings.json`, mark the gate as done, and allow the flow to continue to the next step.
- Keep exhausted gates blocked for tooling, schema, coverage, corruption, missing-source, and other non-deferable outcomes; do not expose a continuation for those cases.
- Do not change task/integration retry recovery behavior.
- Do not add rewind/reset/retry features, manual recovery paths, or new external dependencies.

## Acceptance Criteria

- [ ] When an exhausted `draft` or `spec` gate has a durable gate source classified by the existing classifier as `semantic_findings`, `flow get next-action` returns `recoveryPossible: true` and a target-guarded continuation.
- [ ] The exposed continuation executes the existing `run gate` semantic-deferral transition, or an equivalent atomic transition with the same invariants.
- [ ] Executing the continuation keeps the gate attempt count at `5/5` and does not perform a reset, retry increment, or sixth provider evaluation.
- [ ] The semantic finding is persisted to `flow-findings.json`, the gate is marked done, and the flow becomes able to advance to the next step.
- [ ] Matching run / Issue / spec guards succeed, and any guard mismatch fails before mutation with `ACTIVE_FLOW_MISMATCH`.
- [ ] Tooling, schema, coverage, corruption, missing-source, and other non-deferable classifications remain blocked with `recoveryPossible: false`.
- [ ] When an exhausted gate is not eligible for semantic deferral, `flow get next-action` does not offer manual retry, rewind, or reset actions.
- [ ] Existing task/integration retry recovery and target-guard behavior do not regress.
- [ ] Unit tests cover exhausted `draft`/`spec` gates for semantic vs. non-semantic classification, action generation, guard enforcement, attempt preservation, durable finding persistence, and gate completion.
- [ ] An e2e test covers the path: fifth semantic FAIL -> guarded `get next-action` continuation -> semantic deferral -> gate completion, with no additional provider evaluation.

## Verification

- Reuse existing structured-classifier fixtures/contracts to validate both `semantic_findings` and the failure classes that must remain blocked.
- Verify that the next-action payload/command includes run / Issue / spec guards.
- Verify that attempt count remains `5` before and after the transition and that provider invocation count does not increase.
- Verify the deferred finding in `flow-findings.json`, the gate `done` state, and that a subsequent `get next-action` advances to the next step.
- Run focused regression coverage for task/integration recovery.

## Non-Goals

- Operating on, resetting, or mutating the blocked run for Issue #414
- Any sixth-or-later plan-gate evaluation
- New rewind/reset/retry features for plan gates
- Automatic recovery for tooling/schema/coverage/corruption/missing-source/non-deferable failures
- New external dependencies

<details>
<summary>ja</summary>

guarded next-action で exhausted plan gate の semantic deferral を公開する

## Summary

`flow get next-action` should expose a guarded semantic-deferral continuation for exhausted `draft`/`spec` plan gates when the durable gate source is classified as `semantic_findings`.

This should reuse the existing `run gate` semantic-deferral transition, or an equivalent atomic transition with the same invariants, so the finding is persisted, the gate is completed, and the flow can continue without any additional provider evaluation, retry increment, or reset.

## Problem

Issue #414 is currently blocked by run `a6b9012b-271a-4de5-875a-eca9b439f19b`, where `draft-gate` has reached `5/5` attempts and still has one deferrable semantic wording finding.

The semantic-deferral path already exists in `run gate`: it can defer a semantic finding based on a durable gate source, persist it to `flow-findings.json`, and complete the gate without requesting a new provider evaluation. However, `flow get next-action` currently treats every exhausted plan gate as unrecoverable and returns `recoveryPossible: false` with `unsupported-plan-gate-phase`, so it never exposes a guarded continuation to that existing transition.

Manual execution of a sixth gate evaluation is not allowed. This issue is a prerequisite for resuming #414, but it must not mutate or otherwise operate on the blocked run itself.

## Scope

- `src/flow/lib/get-next-action.js`
- Reuse of the semantic-deferral transition already present in `src/flow/lib/run-gate.js`
- Focused unit and e2e coverage
- Only the minimal related files needed to preserve ownership of this behavior

## Requirements

- For exhausted `draft` and `spec` gates, inspect the durable gate source with the existing structured classifier.
- Only when classification is `semantic_findings`, return a target-guarded next action that executes the existing semantic-deferral transition from `run gate`, or an equivalent atomic transition with the same invariants.
- Preserve run / Issue / spec target guards in the exposed action and reject mismatches before any state mutation with `ACTIVE_FLOW_MISMATCH`.
- Preserve the gate attempt count at `5/5`; do not reset the gate, increment attempts, or trigger any additional provider evaluation.
- Persist the deferred finding to `flow-findings.json`, mark the gate as done, and allow the flow to continue to the next step.
- Keep exhausted gates blocked for tooling, schema, coverage, corruption, missing-source, and other non-deferable outcomes; do not expose a continuation for those cases.
- Do not change task/integration retry recovery behavior.
- Do not add rewind/reset/retry features, manual recovery paths, or new external dependencies.

## Acceptance Criteria

- [ ] When an exhausted `draft` or `spec` gate has a durable gate source classified by the existing classifier as `semantic_findings`, `flow get next-action` returns `recoveryPossible: true` and a target-guarded continuation.
- [ ] The exposed continuation executes the existing `run gate` semantic-deferral transition, or an equivalent atomic transition with the same invariants.
- [ ] Executing the continuation keeps the gate attempt count at `5/5` and does not perform a reset, retry increment, or sixth provider evaluation.
- [ ] The semantic finding is persisted to `flow-findings.json`, the gate is marked done, and the flow becomes able to advance to the next step.
- [ ] Matching run / Issue / spec guards succeed, and any guard mismatch fails before mutation with `ACTIVE_FLOW_MISMATCH`.
- [ ] Tooling, schema, coverage, corruption, missing-source, and other non-deferable classifications remain blocked with `recoveryPossible: false`.
- [ ] When an exhausted gate is not eligible for semantic deferral, `flow get next-action` does not offer manual retry, rewind, or reset actions.
- [ ] Existing task/integration retry recovery and target-guard behavior do not regress.
- [ ] Unit tests cover exhausted `draft`/`spec` gates for semantic vs. non-semantic classification, action generation, guard enforcement, attempt preservation, durable finding persistence, and gate completion.
- [ ] An e2e test covers the path: fifth semantic FAIL -> guarded `get next-action` continuation -> semantic deferral -> gate completion, with no additional provider evaluation.

## Verification

- Reuse existing structured-classifier fixtures/contracts to validate both `semantic_findings` and the failure classes that must remain blocked.
- Verify that the next-action payload/command includes run / Issue / spec guards.
- Verify that attempt count remains `5` before and after the transition and that provider invocation count does not increase.
- Verify the deferred finding in `flow-findings.json`, the gate `done` state, and that a subsequent `get next-action` advances to the next step.
- Run focused regression coverage for task/integration recovery.

## Non-Goals

- Operating on, resetting, or mutating the blocked run for Issue #414
- Any sixth-or-later plan-gate evaluation
- New rewind/reset/retry features for plan gates
- Automatic recovery for tooling/schema/coverage/corruption/missing-source/non-deferable failures
- New external dependencies

</details>