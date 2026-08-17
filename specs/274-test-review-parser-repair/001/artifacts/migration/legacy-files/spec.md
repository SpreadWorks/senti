# Feature Specification: 274-test-review-parser-repair

**Feature Branch**: `feature/274-test-review-parser-repair`
**Created**: 2026-06-04
**Status**: Draft
**Input**: GitHub Issue #354

## Goal
test-review provider が top-level findings arrays を省略した JSON を返しても、欠落分を空配列として補完し、parser_error tooling failure を防ぐ。

## Background
Issue #354 records a test-review tooling failure: provider output omitted blockingFindings and advisoryFindings, causing schema validation to report parser_error after scenario-validity had passed. The failure prevents test-review from producing the normal artifact even when the provider likely meant zero findings. The same source file already has a spec-review normalization path for missing top-level findings arrays, so the test-review parser can adopt the same narrow contract without changing artifact names or public CLI behavior.

## Scope
- test-review response parsing before TEST_REVIEW_RESPONSE_SCHEMA validation
- blockingFindings と advisoryFindings の top-level field 欠落時の normalization
- test-review artifact shape と verdict derivation の維持
- spec-local tests と既存 unit regression による parser recovery coverage

## Out of Scope
- AI provider 設定、model selection、agent retry policy の変更
- test-review prompt の大幅な再設計
- draft-review / impl-review artifact contract の変更
- public CLI command name、option、exit code contract の変更
- finding item schema の緩和

## Constraints
- 外部依存を追加しない。Node.js 組み込みモジュールと既存 helper のみを使う。
- src/ 以下に Issue 固有本文、ローカル環境固有 path、特定 model 名を hardcode しない。
- bounded-resource-usage: normalization は blockingFindings と advisoryFindings の固定 2 field だけを扱い、再帰処理や追加 agent call を行わない。
- No silent error swallowing: invalid JSON、non-array top-level field、malformed finding item は validation failure として表面化させる。
- 既存の `sdd-forge flow run review --phase test` CLI surface と exit code contract は変更しない。
- backward-compatible-cli-interface: artifact の top-level field 名である blockingFindings と advisoryFindings は維持する。

## Design Principles
- 空 findings category の省略だけを補完し、実際の finding item は schema で検証する。
- spec-review に既にある top-level review array 補正方針と揃え、同種処理の重複を抑える。
- provider prompt compliance だけに依存せず、parser boundary で machine-readable contract を安定させる。

## Overview
### Modules
- `src/flow/commands/review.js` owns test-review prompt construction, response parsing, finding object construction, artifact writing, and verdict output.
- `tests/unit/flow/commands/review.test.js` already contains parser-level tests for parseTestReviewFindings.
- `specs/274-test-review-parser-repair/tests/` will contain spec-local coverage with requirement headers.

### Data Flow
- Current flow: raw provider output -> extract JSON object -> JSON.parse / repairJson -> TEST_REVIEW_RESPONSE_SCHEMA validation -> TestReviewFinding objects -> TestReviewArtifact.
- New flow: raw provider output -> extract JSON object -> JSON.parse / repairJson -> missing top-level findings array normalization -> schema validation -> TestReviewFinding objects -> TestReviewArtifact.

### Decisions
- [VERIFY] test-review schema requires both findings arrays and currently validates before any missing-array normalization.
- [VERIFY] spec-review already normalizes missing top-level findings arrays before schema validation.
- [VERIFY] finding item fields remain separate schemas and must not be silently filled by this change.
- Accepted scope is test-review top-level array recovery only; prompt redesign and provider settings are out of scope.
- Spec-local coverage and shared unit regression are both required.

## Clarifications (Q&A)
- Q: Does this change alter public CLI arguments?
  - A: No. It changes internal parsing behind the existing `sdd-forge flow run review --phase test` command. No user-facing argument is added or changed.
- Q: Does this change add a retry or second agent call?
  - A: No. Missing-array normalization is deterministic parser behavior over two fixed top-level fields.
- Q: Are malformed finding objects accepted after normalization?
  - A: No. Only absent top-level findings array fields are filled. Item-level schema remains enforced.

## Alternatives Considered
- Only strengthen the test-review prompt and fallback text. — Rejected because Issue #354 occurred despite the existing prompt, jsonSchema, and fmtFallback already instructing the provider to include both arrays.
- Add a test-review-only normalization function. — Rejected as the only implementation direction because spec-review already has the same top-level missing-array behavior; duplicating the pattern would violate the project rule to extract repeated code when the same pattern appears in two places.
- Coerce malformed finding items using TestReviewFinding fallback text. — Rejected because it would hide malformed review findings and weaken the schema contract. R2 keeps item-level validation strict.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-04T05:23:55.324Z
- Notes: User approved gate-passed spec for issue #354

## Requirements
- R1 [must]: When parsed test-review JSON omits blockingFindings, advisoryFindings, or both, the parser must add each omitted top-level field as an empty array before validating against TEST_REVIEW_RESPONSE_SCHEMA.
- R2 [must]: The parser must still reject invalid JSON, non-object JSON, non-array blockingFindings or advisoryFindings values, and malformed finding item objects after missing-array normalization.
- R3 [must]: Accepted test-review output must continue to produce TestReviewArtifact JSON with blockingFindings and advisoryFindings arrays, accurate counts, and the existing PASS / ADVISORY / FAIL verdict rules.
- R4 [must]: The implementation must share or centralize the top-level review array normalization pattern used by test-review and spec-review so future changes do not maintain two divergent missing-array code paths.
- R5 [must]: Regression coverage must include spec-local tests for R1-R4 and a shared unit test that proves parseTestReviewFindings accepts missing top-level test-review findings arrays while preserving rejection of invalid item shape.

## Acceptance Criteria
- parseTestReviewFindings accepts `{}` as zero blocking findings and zero advisory findings.
- parseTestReviewFindings accepts a response containing only blockingFindings[] and fills advisoryFindings[] as an empty array.
- parseTestReviewFindings accepts a response containing only advisoryFindings[] and fills blockingFindings[] as an empty array.
- A response with blockingFindings set to a non-array value fails schema validation.
- A response with a malformed blocking or advisory finding item fails schema validation.
- Accepted output still serializes artifacts with blockingFindings and advisoryFindings arrays and count totals derived from those arrays.
- Spec-local tests under specs/274-test-review-parser-repair/tests/ contain `// spec: R<N>` headers and cover the new behavior.

## Implementation Targets
- src/flow/commands/review.js
- tests/unit/flow/commands/review.test.js
- specs/274-test-review-parser-repair/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Normalize test review arrays
  - Add deterministic normalization for missing top-level test-review findings arrays before schema validation while preserving strict validation for invalid values and malformed items.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Cover parser recovery
  - Add regression tests that prove missing top-level arrays are accepted and invalid test-review shapes remain rejected.
  - see `tasks/T-2.md` for full spec
