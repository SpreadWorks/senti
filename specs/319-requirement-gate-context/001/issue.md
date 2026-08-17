## Summary

`implementation gate evaluation` currently evaluates primarily from isolated requirement text and mapped diffs, which leaves out the authoritative context needed to interpret intent correctly. Add deterministic, bounded structured context per requirement so the evaluator can distinguish obligation types, rely on authoritative sources, and stop inventing missing behavior or schema fields.

## Problem

The current prompt does not reliably include relevant `Out of Scope`, constraints, matching Acceptance Criteria, architecture/design decisions, data-flow ownership, `implementationTargets`, task intent, file-map ownership, or authoritative schema/contracts.

That gap is causing two failure modes:

- preserve-only or regression-only requirements are misread as reimplementation requirements
- evaluator findings invent fields, outcomes, or rejection rules that do not exist in the authoritative spec/schema

### Known regressions

- `#432` `R6`: a preserve-only requirement was treated as requiring reimplementation of delegated existing behavior
- `#434` `R7`: the evaluator required rejecting safe canonical path `a/../x` and invented a `mergeOutcome` field that does not exist in the authoritative schema

These are prompt/context defects, not implementation-evidence defects. Adding more retries or tests alone does not fix them and currently burns semantic retries into gate exhaustion.

## Scope

- `src/flow/lib/run-gate.js`
- focused prompt/context/unit/e2e tests
- the minimum helper surface necessary to preserve existing context-construction ownership

## Requirements

- Build bounded structured context for each evaluated requirement.
- Include at least the following in that context:
  - requirement ID and full requirement text
  - matching Acceptance Criteria
  - relevant `Out of Scope` and constraints
  - relevant architecture/design decisions and data-flow ownership
  - authoritative schema field names and contracts
  - `implementationTargets`, task intent, and task ownership
  - file-map ownership and mapped diffs/evidence
- Select context deterministically from requirement/ID/ownership linkage; do not dump unrelated full-spec text into the prompt.
- Define explicit section/item/character/token-equivalent bounds and deterministic ordering/truncation so identical input yields identical prompt bytes and cache identity.
- Make obligation type explicit in the prompt, distinguishing:
  - implementation obligation
  - regression-only obligation
  - preservation/non-interception obligation
- For regression-only and preservation/non-interception requirements, do not require reimplementation of delegated existing behavior; evaluate only required regression evidence and non-interference.
- Prevent the evaluator from requiring fields, outcomes, or rejection rules that are absent from the authoritative spec/schema/context.
- Require finding reasons to cite the authoritative context actually used via stable references to requirement/AC/constraint/decision/schema/task/file-map sources.
- Continue to return semantic `FAIL` for genuine missing changed behavior, missing required integration, or contradictory implementation.
- Preserve existing behavior for:
  - semantic gate counters
  - cache semantics and result schema
  - task/integration routing
  - run/Issue/spec target guards
- Validate target guards before context construction, agent/cache access, or state/artifact mutation.
- Do not add:
  - gate bypass
  - manual disposition
  - retry reset or limit extension
  - new dependencies
  - compatibility shims

## Acceptance Criteria

- [ ] `implementation gate` prompt passes bounded structured context per requirement including full requirement text, matching ACs, relevant `Out of Scope`/constraints/design/data-flow/schema, `implementationTargets`/task intent, and file-map ownership.
- [ ] context selection, ordering, and truncation are deterministic, stay within explicit resource bounds, and produce identical prompt/cache identity for identical input.
- [ ] finding reasons cite the authoritative context sources used via stable references.
- [ ] a preserve-only fixture modeled on `#432` `R6` returns `PASS` when delegated existing behavior is not reimplemented but required regression evidence and preservation are satisfied.
- [ ] the same fixture returns `FAIL` when preservation/non-interception is broken or required regression evidence is missing.
- [ ] a fixture modeled on `#434` `R7` returns `PASS` when safe canonical path `a/../x` is accepted per the authoritative contract and the implementation uses the exact schema field names.
- [ ] evaluator does not require `mergeOutcome` or reject canonical safe paths unless the authoritative context explicitly requires it.
- [ ] evaluator still returns semantic `FAIL` when authoritative context requires changed behavior or exact fields that are genuinely missing.
- [ ] unit tests cover obligation classification and evaluation instructions for implementation, regression-only, preservation, and non-interception requirements.
- [ ] semantic `PASS`/`FAIL` counters, cache/result schema, and task/integration routing show no regressions.
- [ ] run/Issue/spec guard mismatches return `ACTIVE_FLOW_MISMATCH` before context construction, agent/cache access, or mutation, and state/artifacts remain byte-identical.
- [ ] focused prompt/context/unit/e2e tests pass and include `#432 R6`, `#434 R7`, and genuine-missing-behavior contrast cases.

## Verification

- Inspect generated prompt/context snapshots for source references, obligation classification, bounds, ordering, and truncation.
- Rebuild context repeatedly with identical input and confirm identical prompt bytes and cache identity.
- Cover preserve-only delegated behavior and exact merge-schema fields with positive fixtures, plus missing-behavior negative fixtures, in agent-independent unit tests.
- Validate end-to-end `PASS`/`FAIL` behavior with mapped diffs, file-map ownership, and task ownership in scope.
- Run existing regression coverage for semantic counters, cache/result schema, and guard behavior.

## Out of Scope

- gate finding bypass, defer, or manual disposition
- semantic retry-counter reset or limit extension
- repairing existing flow state, findings, or counters for `#432` or `#434`
- adding behavior not present in the authoritative spec/schema
- new external dependencies or public compatibility shims

<details>
<summary>ja</summary>

implementation gate evaluation に requirement context を提供する

## Summary

`implementation gate evaluation` currently evaluates primarily from isolated requirement text and mapped diffs, which leaves out the authoritative context needed to interpret intent correctly. Add a deterministic, bounded structured context per requirement so the evaluator can distinguish obligation types, rely on authoritative sources, and stop inventing missing behavior or schema fields.

## Problem

The current prompt does not reliably include relevant `Out of Scope`, constraints, matching Acceptance Criteria, architecture/design decisions, data-flow ownership, `implementationTargets`, task intent, file-map ownership, or authoritative schema/contracts.

That gap is causing two failure modes:

- preserve-only or regression-only requirements are misread as reimplementation requirements
- evaluator findings invent fields, outcomes, or rejection rules that do not exist in the authoritative spec/schema

### Known regressions

- `#432` `R6`: a preserve-only requirement was treated as requiring reimplementation of delegated existing behavior
- `#434` `R7`: the evaluator required rejecting safe canonical path `a/../x` and invented a `mergeOutcome` field that does not exist in the authoritative schema

These are prompt/context defects, not implementation-evidence defects. Adding more retries or tests alone does not fix them and currently burns semantic retries into gate exhaustion.

## Scope

- `src/flow/lib/run-gate.js`
- focused prompt/context/unit/e2e tests
- the minimum helper surface necessary to preserve existing context-construction ownership

## Requirements

- Build bounded structured context for each evaluated requirement.
- Include at least the following in that context:
  - requirement ID and full requirement text
  - matching Acceptance Criteria
  - relevant `Out of Scope` and constraints
  - relevant architecture/design decisions and data-flow ownership
  - authoritative schema field names and contracts
  - `implementationTargets`, task intent, and task ownership
  - file-map ownership and mapped diffs/evidence
- Select context deterministically from requirement/ID/ownership linkage; do not dump unrelated full-spec text into the prompt.
- Define explicit section/item/character/token-equivalent bounds and deterministic ordering/truncation so identical input yields identical prompt bytes and cache identity.
- Make obligation type explicit in the prompt, distinguishing:
  - implementation obligation
  - regression-only obligation
  - preservation/non-interception obligation
- For regression-only and preservation/non-interception requirements, do not require reimplementation of delegated existing behavior; evaluate only required regression evidence and non-interference.
- Prevent the evaluator from requiring fields, outcomes, or rejection rules that are absent from the authoritative spec/schema/context.
- Require finding reasons to cite the authoritative context actually used via stable references to requirement/AC/constraint/decision/schema/task/file-map sources.
- Continue to return semantic `FAIL` for genuine missing changed behavior, missing required integration, or contradictory implementation.
- Preserve existing behavior for:
  - semantic gate counters
  - cache semantics and result schema
  - task/integration routing
  - run/Issue/spec target guards
- Validate target guards before context construction, agent/cache access, or state/artifact mutation.
- Do not add:
  - gate bypass
  - manual disposition
  - retry reset or limit extension
  - new dependencies
  - compatibility shims

## Acceptance Criteria

- [ ] `implementation gate` prompt passes bounded structured context per requirement including full requirement text, matching ACs, relevant `Out of Scope`/constraints/design/data-flow/schema, `implementationTargets`/task intent, and file-map ownership.
- [ ] context selection, ordering, and truncation are deterministic, stay within explicit resource bounds, and produce identical prompt/cache identity for identical input.
- [ ] finding reasons cite the authoritative context sources used via stable references.
- [ ] a preserve-only fixture modeled on `#432` `R6` returns `PASS` when delegated existing behavior is not reimplemented but required regression evidence and preservation are satisfied.
- [ ] the same fixture returns `FAIL` when preservation/non-interception is broken or required regression evidence is missing.
- [ ] a fixture modeled on `#434` `R7` returns `PASS` when safe canonical path `a/../x` is accepted per the authoritative contract and the implementation uses the exact schema field names.
- [ ] evaluator does not require `mergeOutcome` or reject canonical safe paths unless the authoritative context explicitly requires it.
- [ ] evaluator still returns semantic `FAIL` when authoritative context requires changed behavior or exact fields that are genuinely missing.
- [ ] unit tests cover obligation classification and evaluation instructions for implementation, regression-only, preservation, and non-interception requirements.
- [ ] semantic `PASS`/`FAIL` counters, cache/result schema, and task/integration routing show no regressions.
- [ ] run/Issue/spec guard mismatches return `ACTIVE_FLOW_MISMATCH` before context construction, agent/cache access, or mutation, and state/artifacts remain byte-identical.
- [ ] focused prompt/context/unit/e2e tests pass and include `#432 R6`, `#434 R7`, and genuine-missing-behavior contrast cases.

## Verification

- Inspect generated prompt/context snapshots for source references, obligation classification, bounds, ordering, and truncation.
- Rebuild context repeatedly with identical input and confirm identical prompt bytes and cache identity.
- Cover preserve-only delegated behavior and exact merge-schema fields with positive fixtures, plus missing-behavior negative fixtures, in agent-independent unit tests.
- Validate end-to-end `PASS`/`FAIL` behavior with mapped diffs, file-map ownership, and task ownership in scope.
- Run existing regression coverage for semantic counters, cache/result schema, and guard behavior.

## Out of Scope

- gate finding bypass, defer, or manual disposition
- semantic retry-counter reset or limit extension
- repairing existing flow state, findings, or counters for `#432` or `#434`
- adding behavior not present in the authoritative spec/schema
- new external dependencies or public compatibility shims

</details>