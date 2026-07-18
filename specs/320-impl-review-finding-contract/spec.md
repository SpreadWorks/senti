# Feature Specification: 320-impl-review-finding-contract

**Feature Branch**: `feature/320-impl-review-finding-contract`
**Created**: 2026-07-12
**Status**: Draft
**Input**: GitHub Issue #437

## Goal
impl-review の model output contract で全 finding に target spec の既知 requirementId を必須化し、schema validation failure を semantic verdict から分離した bounded tooling failure として返す。

## Background
Impl-review currently requires the requirementId field structurally but allows null and instructs the provider to use null. The consumer later resolves target requirement IDs, so repeated provider outputs can contain dozens of findings that cannot satisfy the effective contract. These schema failures are non-semantic: they must not consume reviewRetry, write review artifacts, defer findings, or promote the step. The fix makes the generation and consumer contracts identical and returns field-complete tooling diagnostics after existing bounded retries are exhausted.

## Scope
- [must] impl-review の blockingFindings と nonBlockingImprovements に共通する finding schema、generation prompt、parser validation を一致させる。
- [must] 全 finding の requirementId を non-empty string とし、target spec の requirements に存在する ID だけを許可する。
- [must] missing、null、unknown requirementId とその他の schema violation を bounded tooling retry 対象にする。
- [must] tooling retry exhaustion を failure class、target review、validation error、current attempt、maximum attempts を持つ structured failure envelope で返す。
- [must] valid output の PASS/ADVISORY/FAIL、reviewRetry、artifact、step promotion、routing を維持する。
- [must] exactly 41 件の nonBlockingImprovements と stopped impl-review state の guarded resume を spec-local unit/e2e fixture で検証する。

## Out of Scope
- `Preset not found: node-cli` warning の原因調査または修正。
- Issue #436 が実装する機能内容の変更。
- finding の品質改善、件数制限、severity policy の変更。
- draft、spec、test、acceptance review の schema、prompt、parser、routing の変更。
- 全 review retry architecture の再設計。
- missing、null、unknown requirementId を受理する compatibility fallback。

## Constraints
- Node.js built-in modules と既存 project helpers だけを使用し、外部依存を追加しない。
- `src/` に project、Issue、runId 固有値または fixture 固有分岐を含めない。
- Model/provider output を system boundary として validation し、validation 済みの内部 interface は信頼する。
- Finding invariant は `ImplReviewFinding`、review failure invariant は `ReviewFailure` または同等の専用 class に所有させ、新しい meaningful failure/result を object-literal type tag で表現しない。
- Alpha policy に従い、invalid legacy output を受理する fallback を追加しない。
- 共通化は impl-review finding contract または impl-review tooling-failure envelope を直接共有する既存 module に限定する。
- Flow registry の impl-review pre/post hooks と config entries は変更しない。
- Schema failure は semantic reviewRetry を消費せず、semantic/deferred finding、review artifact、step promotion を生成しない。
- Provider internal retry と flow-side tooling retry は既存上限を維持し、無限 retry を追加しない。
- テストを通すために既存 assertion を弱めず、変更後 contract と回帰面を追加 coverage で検証する。

## Design Principles
- Prompt、schema、parser が同じ allowed requirement ID contract を表現する。
- Schema/tooling failure と semantic review result の lifecycle を交差させない。
- Valid output の既存 behavior を behavior-level tests で固定する。
- Failure diagnostics は operator と test が同じ stable fields で判定できる形にする。
- Impl-review 固有 contract を修正し、他 review 種別へ policy を波及させない。

## Overview
### Modules
- `src/flow/commands/review.js` owns the impl-review prompt, dynamic response schema, finding normalization, requirement-ID boundary validation, and review artifact writes.
- `src/flow/lib/review-failure.js` owns review failure classification, retry eligibility, structured recovery diagnostics, and envelope fields.
- `src/flow/lib/run-review.js` owns bounded flow-side subprocess retries, preserves attempt counts, and returns the final structured tooling failure without semantic post-processing.
- `tests/unit/flow/commands/review.test.js` and `tests/unit/flow/run-review-advisory.test.js` cover the shared impl output and review lifecycle regression surfaces.
- `specs/320-impl-review-finding-contract/tests/` owns spec-local requirement coverage, including exactly 41-finding and stopped-flow resume fixtures.

### Data Flow
- Impl review resolves the target spec requirement IDs and passes the same allowed values into the generation prompt and response schema before invoking the provider.
- Provider output is parsed at the boundary; every finding is constructed only when requirementId is non-empty and belongs to the target spec.
- A valid payload proceeds to scope filtering and writes review.md plus impl-review.json; artifact verdict drives the existing PASS, ADVISORY, or FAIL lifecycle.
- A schema violation exits the producer path before artifact writes, is classified as schema tooling failure, and is retried only through the existing bounded provider and flow-side tooling retry paths.
- After flow-side exhaustion, RunReviewCommand returns a structured failure containing failure class, target review, validation error, current attempt, and maximum attempts; semantic retry and registry promotion are not invoked.

### Decisions
- [VERIFY] The current impl-review prompt and schema allow null requirementId while the consumer also resolves target requirement IDs; result=contract mismatch confirmed.
- [VERIFY] The current finding model omits empty requirementId and validates blocking failureMode only; result=finding invariant does not enforce the consumer contract.
- [VERIFY] Existing flow-side subprocess retry is bounded but schema failures finish as generic subprocess errors without schema diagnostics; result=classification gap confirmed.
- [VERIFY] Existing semantic retry accounting can remain unchanged when tooling failure returns before semantic artifact processing; result=lifecycle boundary matches the draft policy.
- Use every finding as a requirement-scoped finding and require a known target-spec ID.
- Extend the existing ReviewFailure model for schema tooling failure rather than normalize invalid output into a semantic verdict.
- [MIGRATION] Replace only the impl-review model output JSON contract; retain the existing command, hooks, config, valid artifacts, counters, states, and routing.
- [MIGRATION] Reject missing, null, or unknown requirementId without compatibility fallback and expose a tooling failure instead of a semantic result.

## Clarifications (Q&A)
- Q: Can an impl-review finding omit requirementId when it has a touched file?
  - A: No. Every blocking and non-blocking finding is requirement-scoped and must use an ID from the target spec; file remains an independent scope field.
- Q: Does schema failure produce an impl-review artifact with TOOLING_FAILURE verdict?
  - A: No. It returns a tooling failure envelope before semantic artifact creation. Existing review artifacts, if present from an earlier valid attempt, are not replaced by the invalid attempt.
- Q: Which retry counter applies to schema-invalid output?
  - A: Existing bounded provider and flow-side tooling retries apply. The semantic reviewRetry counter remains unchanged.
- Q: Does this change other review types?
  - A: No. Draft, spec, test, and acceptance review contracts and routing remain unchanged.

## Alternatives Considered
- Allow null requirementId and discard invalid findings during scope filtering. — Rejected because discarded invalid output would be normalized into a semantic result and could hide a producer contract failure.
- Add a separate unscoped observation finding variant. — Rejected because no current consumer requires it and it expands the impl-review contract beyond Issue #437.
- Count schema violations as semantic FAIL. — Rejected because no semantic verdict exists before schema validation and reviewRetry must retain its semantic meaning.
- Generalize schema tooling failure handling across all review types. — Rejected because Issue #437 is bounded to the impl-review contract and requires other review behavior to remain unchanged.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-12T23:53:36.382Z
- Notes: Approved: known requirementId contract, non-semantic schema tooling failure with bounded five-field diagnostics, valid PASS/ADVISORY/FAIL parity, unchanged other review types, exactly 41-item fixture, and guarded resume are verifiable and all spec guardrails passed.

## Requirements
- R1 [must]: The impl-review generation prompt and JSON schema shall require a non-empty requirementId on every blockingFindings and nonBlockingImprovements item and shall expose only requirement IDs present in the target spec as allowed values.
- R2 [must]: Impl-review boundary parsing shall reject missing, null, empty, or target-spec-unknown requirementId values before scope filtering or artifact creation; every accepted ImplReviewFinding shall preserve a known requirementId in JSON and prompt memory.
- R3 [must]: An impl-review output schema violation shall use the existing bounded provider and flow-side tooling retry limits and, after exhaustion, return a non-semantic structured failure containing failure class, target review, validation error, current attempt, and maximum attempts.
- R4 [must]: Schema tooling failure shall not consume reviewRetry, write or replace review.md or impl-review.json, record semantic/deferred findings, emit semantic PASS/ADVISORY/FAIL, or promote impl-review to impl-gate.
- R5 [must]: For valid known-ID output, blocking findings shall produce FAIL, increment semantic reviewRetry, and keep impl-review active; only non-blocking findings shall produce ADVISORY, reset reviewRetry, write both review artifacts, and promote impl-gate; empty arrays shall produce PASS with the same reset, artifact, and promotion behavior as ADVISORY.
- R6 [must]: The change shall preserve draft, spec, test, and acceptance review schema/prompt/parser/routing behavior and shall keep impl-review registry hooks, config entries, artifact paths, semantic counter behavior, state transitions, and routing unchanged for valid output.
- R7 [must]: Spec-local regression tests shall cover exactly 41 valid and invalid nonBlockingImprovements, bounded schema-failure exhaustion, and a stopped impl-review state whose guarded next-action and review resume without manual counter, state, or artifact edits.

## Acceptance Criteria
- For R1 and R2, a payload containing blocking and non-blocking findings with requirementId values from the target spec passes schema validation and every persisted finding contains that ID; missing, null, empty, and unknown IDs each fail before filtering and artifact writes.
- For R3, a test that returns the same schema-invalid impl-review output through all provider and flow-side attempts terminates within the configured limits and returns failure class, target review, validation error, current attempt, and maximum attempts with current attempt equal to maximum attempts.
- For R4, schema-failure tests compare state and files before and after execution and observe no reviewRetry delta, semantic/deferred finding, review.md or impl-review.json write/replacement, semantic verdict, or impl-gate promotion.
- For R5, valid known-ID fixtures prove blocking findings yield FAIL plus one semantic reviewRetry increment and no promotion; only non-blocking findings yield ADVISORY plus counter reset, both artifacts, and impl-gate promotion; empty arrays yield PASS with the same reset, artifacts, and promotion.
- For R6, targeted existing tests for draft/spec/test/acceptance review and impl-review registry/counter/artifact routing pass without changing their expected contracts, hooks, config, or artifact paths.
- For R7, a spec-local fixture with exactly 41 nonBlockingImprovements is accepted when every item has a known requirementId and returns tooling failure when any one item lacks or uses an unknown requirementId.
- For R7, a spec-local e2e fixture starts from impl-review state after schema failure with no semantic verdict, artifact write, or reviewRetry delta; after applying the fixed code baseline, guarded next-action resolves impl-review and guarded review returns PASS, ADVISORY, FAIL, or the five-field bounded tooling failure without fixture-side counter/state/artifact repair.
- Every spec-local test file under `specs/320-impl-review-finding-contract/tests/` contains a `// spec: R<N>` header covering its asserted requirements.

## Implementation Targets
- src/flow/commands/review.js
- src/flow/lib/review-failure.js
- src/flow/lib/run-review.js
- tests/unit/flow/commands/review.test.js
- tests/unit/flow/run-review-advisory.test.js
- specs/320-impl-review-finding-contract/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Enforce finding requirement IDs
  - Align the impl-review prompt, dynamic schema, parser, and finding invariant so every accepted finding carries a target-spec requirement ID.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Classify schema tooling failures
  - Route impl-review schema violations through existing bounded tooling retries and return field-complete non-semantic failure diagnostics after exhaustion.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Prove review lifecycle parity
  - Lock valid-output lifecycle, unaffected review types, large finding sets, and stopped-state resume behavior to observable regression tests.
  - see `tasks/T-3.md` for full spec
