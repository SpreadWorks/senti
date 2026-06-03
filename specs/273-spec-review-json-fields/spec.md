# Feature Specification: 273-spec-review-json-fields

**Feature Branch**: `feature/273-spec-review-json-fields`
**Created**: 2026-06-03
**Status**: Draft
**Input**: GitHub Issue #352

## Goal
spec-review provider が必須の top-level review arrays を欠く JSON を返した場合でも、補完または schema-repair retry により spec-review artifact を作成できるようにする。

## Background
Issue #352 reports a repeated spec-review failure where provider output omitted blockingFindings / nonBlockingImprovements. The CLI could not tell whether there were zero findings or merely missing fields, so it failed schema validation and could not create the review trace required by downstream SDD steps.

## Scope
- spec-review prompt / fallback の JSON 出力契約を、blockingFindings[] と nonBlockingImprovements[] が常に必要であると明示する。
- parse 済み JSON が blockingFindings または nonBlockingImprovements だけを欠く場合、その field を空配列として補完して schema validation を行う。
- 補完後も spec-review response schema に失敗する parse 済み JSON は、schema-repair-only prompt で 1 回だけ再出力させる。
- schema-repair retry 後も invalid な JSON / non-array field / malformed item は従来通り spec-review failure として扱う。
- spec-review.md と spec-review.json の既存 artifact field / section 名を維持する。
- spec-local tests と既存 unit tests で missing-array 補完、schema-repair retry、invalid output rejection を検証する。

## Out of Scope
- provider 全体の output parsing redesign。
- spec-review artifact file name、field name、Markdown section name の変更。
- flow review command の public CLI option / command name の変更。
- 特定 model、特定プロジェクト、特定ローカル環境にだけ効く分岐。
- blocking / non-blocking finding item の schema 緩和。

## Constraints
- 外部依存を追加しない。Node.js 組み込みモジュールと既存 helper のみを使う。
- bounded-resource-usage: schema-repair re-prompt は spec-review 1 実行につき最大 1 回に制限する。
- 既存の `sdd-forge flow run review --phase spec` CLI surface と exit code contract は変更しない。
- src/ 以下にプロジェクト固有の path、Issue 固有の本文、環境固有の model 名を hardcode しない。
- schema-repair prompt は review 判定をやり直さず、既存 raw response を required JSON shape に整形する目的に限定する。
- errors は握りつぶさない。補完および schema-repair retry 後も validation が失敗した場合は、既存と同じ spec review schema validation failure として表面化する。

## Design Principles
- 必須 top-level arrays の欠落だけを自動補完し、finding item の中身は schema で検証する。
- provider に再判定を依頼せず、schema-repair retry は同じ review result の JSON 形状修復に限定する。
- 既存 artifact reader / renderer が期待する blockingFindings と nonBlockingImprovements の契約を保つ。

## Overview
### Modules
- `src/flow/commands/review.js` owns spec-review prompt construction, provider invocation, response parsing, artifact formatting, and spec-review execution.
- `tests/unit/flow/commands/review.test.js` already covers spec-review prompt schema, JSON parsing, markdown rejection, and artifact rendering; new cases extend that surface.
- `specs/273-spec-review-json-fields/tests/` provides spec-local behavior tests with requirement headers.

### Data Flow
- runSpecReview builds a spec summary and codebase context, calls the review agent, parses the raw JSON response, derives verdict, then writes spec-review.md and spec-review.json.
- New flow: raw response -> JSON parse/repair -> missing-array normalization -> schema validation -> optional schema-repair retry -> final schema validation -> artifact formatting.

### Decisions
- [VERIFY] `SPEC_REVIEW_RESPONSE_SCHEMA` requires both review arrays and `buildSpecReviewPrompt` already sends the schema to the agent.
- [VERIFY] Current parsing validates immediately after JSON parse/repair, so missing top-level arrays fail before artifact creation.
- [VERIFY] runSpecReview has one review agent call before parsing, so schema-repair retry belongs in the spec-review execution boundary, not artifact rendering.
- Missing top-level arrays are equivalent to empty categories only for spec-review response shape; malformed item objects and non-array fields are not silently accepted.

## Clarifications (Q&A)
- Q: Does this change add or alter public CLI options?
  - A: No. It changes internal spec-review prompt/parsing/retry behavior behind the existing `sdd-forge flow run review --phase spec` command.
- Q: Does schema-repair retry re-review the spec?
  - A: No. It asks the provider to rewrite the existing raw response into the required JSON shape and is bounded to one additional call.
- Q: Are malformed finding item objects accepted after missing-array normalization?
  - A: No. Top-level missing arrays can be defaulted, but item-level schema remains enforced.

## Alternatives Considered
- Only strengthen the prompt and rely on the provider to comply. — Rejected because Issue #352 reports repeated provider non-compliance; prompt wording alone does not guarantee artifact creation.
- Only auto-fill missing arrays and keep every other malformed response as immediate failure. — Rejected because Issue #352 explicitly includes a schema-repair-only re-prompt fallback when auto-fill is not possible.
- Accept any malformed response by coercing item fields or non-array values. — Rejected because it would hide real review defects and weaken the existing spec-review response schema.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-03T11:22:20.850Z
- Notes: autoApprove: approved gate-passed spec for issue #352

## Requirements
- R1 [must]: The spec-review prompt and fallback format must explicitly require a JSON object containing blockingFindings[] and nonBlockingImprovements[], and must instruct the provider to return empty arrays for categories with no findings.
- R2 [must]: When parsed spec-review JSON omits blockingFindings, nonBlockingImprovements, or both, the parser must add the omitted top-level fields as empty arrays before validating against the spec-review response schema.
- R3 [must]: When parsed spec-review JSON still fails the spec-review response schema after missing-array normalization, the spec-review execution must call the review agent at most one additional time with a schema-repair-only prompt.
- R4 [must]: If schema-repair retry returns invalid JSON, non-array review fields, malformed finding items, or output that still violates the spec-review response schema, spec-review must fail with schema validation error behavior instead of writing a successful artifact.
- R5 [must]: Accepted and repaired spec-review outputs must continue to write spec-review.json with blockingFindings and nonBlockingImprovements arrays and spec-review.md with separate blocking and non-blocking sections.
- R6 [must]: Regression coverage must include spec-local tests for R1-R5 and unit-level assertions for missing-array normalization, schema-repair retry, and invalid-output rejection.

## Acceptance Criteria
- A provider response `{}` is accepted as zero blocking findings and zero non-blocking improvements after normalization.
- A provider response containing only blockingFindings[] is accepted with nonBlockingImprovements[] filled as an empty array.
- A provider response containing only nonBlockingImprovements[] is accepted with blockingFindings[] filled as an empty array.
- A parsed response with a non-array review field triggers exactly one schema-repair agent call before final success or failure.
- A schema-repair response that fixes the shape produces the same spec-review artifact structure as a valid first response.
- A schema-repair response that remains invalid does not write a successful spec-review artifact and surfaces a schema validation failure.
- Existing tests for markdown rejection, structured findings parsing, and artifact rendering continue to pass.

## Implementation Targets
- src/flow/commands/review.js
- tests/unit/flow/commands/review.test.js
- specs/273-spec-review-json-fields/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Normalize missing review arrays
  - Default omitted top-level spec-review arrays to empty arrays while preserving existing item-level schema validation.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add schema repair retry
  - Retry one schema-invalid parsed spec-review response through a schema-repair-only prompt and feed the repaired response through the same parser.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover spec review recovery
  - Add spec-local and unit regression tests that prove the prompt contract, missing-array normalization, schema-repair retry, rejection behavior, and artifact compatibility.
  - see `tasks/T-3.md` for full spec
