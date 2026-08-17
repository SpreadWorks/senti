# Feature Specification: 302-mechanical-spec-gate-checks

**Feature Branch**: `feature/302-mechanical-spec-gate-checks`
**Created**: 2026-06-17
**Status**: Draft
**Input**: GitHub Issue #393

## Goal
spec gate の AI guardrail のうち deterministic に判定できる `prioritize-requirements` と `spec-includes-test-strategy` の構造違反を、AI 実行前の `checkSpecJson()` precheck に移す。

## Background
Issue #393 targets flow speed and retry stability. Today, `runGateFlow()` already has a deterministic `textCheck()` short-circuit before AI guardrail evaluation. Some spec guardrails still ask AI to notice field presence that can be checked with stable rules. Moving only those field-presence failures into `checkSpecJson()` reduces AI variance without weakening semantic guardrail review.

## Scope
- `src/flow/lib/run-gate.js` の `checkSpecJson()` に requirements priority field 欠落と task test_strategy 欠落/空文字の mechanical issue を追加する。
- `tests/unit/flow/gate-spec-sanity.test.js` と `tests/unit/specs/commands/gate.test.js` に regression coverage を追加する。
- `senti flow run gate --phase spec --skip-guardrail` 相当の command path で mechanical issue が AI skip より先に返ることを確認する。
- 既存の schema validation、AI guardrail 定義、retry accounting、issue-log semantics、test header coverage behavior を維持する。

## Out of Scope
- `spec.schema.json` に top-level `test_strategy` を追加しない。
- `tasks[].test_strategy` を schema required にしない。
- `src/presets/base/guardrail.json` から AI guardrail 定義を削除しない。
- `spec-test-coverage`、diff-context guardrail、secret/log literal、empty catch、skip test detection、bounded-resource-usage の新規機械判定は扱わない。
- `completeSpecArtifactChange()` への責務移動は扱わない。

## Constraints
- Node.js 組み込みモジュールと既存 test runner だけを使い、外部依存を追加しない。
- `src/` 以下へ Issue 固有の文字列や project 固有値を入れない。
- `runGateFlow()` の textCheck -> retry guard -> skipGuardrail -> AI guardrail という順序を変更しない。
- `validateSpecJsonObject()` が扱う priority enum/type validation を `checkSpecJson()` に二重実装しない。
- `bounded-resource-usage` に関する例外は不要。今回の check は existing arrays を 1 回走査するだけで、入力サイズは既存 spec schema と gate 入力に従う。

## Design Principles
- obvious structural failure は AI semantic judgment の前で deterministic に返す。
- schema validation、structural precheck、AI semantic guardrail の責務境界を混ぜない。
- failure message は修正対象を field path、index、id で特定できる形にする。
- 既存 public surface の envelope shape と CLI behavior を変えず、追加 issue だけを mechanical path に載せる。

## Overview
### Modules
- `src/flow/lib/run-gate.js`: spec gate execution and `checkSpecJson()` structural precheck owner.
- `src/flow/schemas/spec.schema.json`: priority enum/type validation and task field schema owner; this spec does not change it.
- `src/presets/base/guardrail.json`: AI guardrail definitions owner; this spec keeps definitions for semantic adequacy judgment.
- `src/flow/lib/test-headers.js`: existing spec-test-coverage mechanical validation owner; this spec does not move it.

### Data Flow
- `executeSpec()` validates spec schema, then `runGateFlow()` runs `textCheck()` before skipGuardrail and AI guardrail evaluation.
- New `checkSpecJson()` issues flow into `gateFail(..., evaluations=[], issues)` and preserve `failureKind: "mechanical"`.
- When structural precheck passes, existing AI guardrails still evaluate priority choice quality and test strategy sufficiency.

### Decisions
- [VERIFY] `checkSpecJson()` is the correct owner for the two new structural checks.
- [VERIFY] priority value validation remains schema-owned.
- [VERIFY] test strategy is task-scoped, not top-level.
- [VERIFY] migration parity inventory and retained owner mapping are explicit.
- [CORRECTION] Optional null values are structural absence for migrated fields.

## Clarifications (Q&A)
- Q: Does this change weaken AI guardrails?
  - A: No. It short-circuits only field-presence failures that are deterministic. AI still judges priority choice quality and test strategy sufficiency after structural checks pass.
- Q: What public behavior is migrated?
  - A: Only two obvious failure classifications move from AI semantic guardrail detection to `checkSpecJson()` mechanical issues. CLI command names, flags, envelope fields, schema contracts, and guardrail definitions are retained.

## Alternatives Considered
- Add top-level `test_strategy` to `spec.schema.json`. — Rejected because current schema models test strategy as `tasks[].test_strategy`, and Issue #393 explicitly excludes schema contract changes.
- Make `tasks[].test_strategy` schema-required. — Rejected because the target is spec gate precheck behavior, not schema validation contract expansion.
- Remove migrated AI guardrail definitions. — Rejected because semantic adequacy remains AI-owned even when obvious structural failures become mechanical.
- Move the checks into `completeSpecArtifactChange()`. — Rejected because producer completion responsibility is a separate board and this Issue scopes implementation to `checkSpecJson()`.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-17T03:09:17.665Z
- Notes: User approved the gate-passed spec via option 1.

## Requirements
- R1 [must]: `checkSpecJson()` must return one deterministic issue for each requirement whose own `priority` field is missing or null when `spec.requirements.length > 3`; each issue must include `requirements[N].priority` and the requirement id.
- R2 [must]: `checkSpecJson()` must not duplicate priority enum/type validation for non-null values; empty string, invalid string, and non-string non-null priority values remain `validateSpecJsonObject()` schema failures before `checkSpecJson()` runs in spec gate.
- R3 [must]: `checkSpecJson()` must return one deterministic issue for each existing task whose `test_strategy` is missing, null, or whitespace-only; each issue must include `tasks[N].test_strategy` and the task id.
- R4 [must]: `tasks` missing and empty failures must remain owned by the existing `checkSpecJson()` task decomposition checks; the new task test_strategy check must run only when `spec.tasks` is an array with at least one task.
- R5 [must]: Spec gate behavior must preserve `runGateFlow()` ordering, `--skip-guardrail` semantics, retry accounting, issue-log semantics, `gateFail()` envelope shape, schema validation boundaries, and AI guardrail definitions.
- R6 [must]: Existing mechanical checks for unresolved markers, empty goal, empty requirements, empty acceptance criteria, missing tasks, empty tasks, task depth, and `validateTestHeaders()` coverage behavior must not regress.

## Acceptance Criteria
- `specs/302-mechanical-spec-gate-checks/tests/gate-spec-precheck.test.js` contains spec-local regression coverage with `// spec: R<N>` headers for R1-R6.
- `node --test tests/unit/flow/gate-spec-sanity.test.js` passes with new cases for R1, R3, valid input, and deterministic issue ordering.
- `node --test tests/unit/specs/commands/gate.test.js` passes with command-level or equivalent coverage proving spec gate mechanical failures survive `--skip-guardrail`.
- A regression case proves requirements with 3 or fewer entries do not fail only because `priority` is absent.
- A regression case proves empty, invalid, and non-null non-string priority values are schema validation failures, not duplicate `checkSpecJson()` enum checks.
- A regression case proves `priority: null` and `tasks[].test_strategy: null` are handled as `checkSpecJson()` structural failures because optional null values are skipped by current schema validation.
- A regression case proves existing unresolved marker, empty field, tasks missing/empty/depth behavior still passes or fails as before.
- No diff changes `src/flow/schemas/spec.schema.json` to add top-level `test_strategy` or require `tasks[].test_strategy`.
- No diff removes or renames `prioritize-requirements`, `spec-includes-test-strategy`, or `spec-test-coverage` guardrail definitions.

## Implementation Targets
- src/flow/lib/run-gate.js
- tests/unit/flow/gate-spec-sanity.test.js
- tests/unit/specs/commands/gate.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add spec prechecks
  - Add deterministic `checkSpecJson()` issues for missing requirement priority and missing or empty task test strategy while preserving schema and gate execution boundaries.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add gate regressions
  - Add regression coverage proving the new mechanical failures and retained spec gate behavior work through the existing unit and command-level test surfaces.
  - see `tasks/T-2.md` for full spec
