# Feature Specification: 228-empty-spec-gate-sanity

**Feature Branch**: `feature/228-empty-spec-gate-sanity`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #252

## Goal
空の spec.json（goal=""、requirements=[]、acceptance_criteria=[]）が spec gate（phase=spec）を PASS するバグを修正する。AI guardrail 呼び出しの手前で静的 sanity check を追加し、最低限の内容が記入されていない spec を早期 FAIL させる。

## Background
spec 221 実装中に発見。`flow prepare` が生成する空 stub のまま `flow run gate --phase spec` を実行すると、AI guardrail が「該当なし」として PASS を返す。auto mode では特に危険で、空 spec が後続の gate-impl / review と噛み合わなく���る。

## Scope
- spec gate の静的チェック（`checkSpecJson` 関数）に goal / requirements / acceptance_criteria の非空チェックを追加
- 上記を検証するユニットテスト

## Out of Scope
- spec.schema.json への minLength / minItems 制約追加（空 stub 生成に影響するため）
- scope.in 等その他フィールドの非空チェック
- AI guardrail プロンプトの修正

## Constraints
- `flow prepare` が生成する空 stub は JSON スキーマバリデーション（`loadSpecJson`）を通過しなければならない。制約はスキーマではなく gate の静的チェックでのみ追加する
- 既存の `checkSpecJson` が返す issues 配列に追加する形で実装する（新しい関数を切り出さない���

## Design Principles
- 既存パターンとの一貫性: tasks[] の非空チェック（spec 226）と同じ場所・同じ形式で追加する
- 最小変更: Issue が特定した3フィールドのみ。将来追加が必要になれば同パターンで拡張可能

## Overview
### Modules
- `src/flow/lib/run-gate.js` の `checkSpecJson()`: spec.json の静的チェック関数。tasks[] 非空チェック等を行っている。ここに3つのチェックを追加する

### Data Flow
- `executeSpec()` → `runGateFlow({ textCheck: () => checkSpecJson(spec) })` → 静的チェック → （PASS なら）AI guardrail 呼び出し

### Decisions
- スキーマ vs gate: gate レベルで制約する。空 stub が loadSpecJson を通過する必要があるため

## Clarifications (Q&A)
- Q: goal の空判定基準は？
  - A: `spec.goal.trim() === ""` で判定。空白のみの goal は実質空と同等（既存 tasks[] チェックパターンに合わせる）
- Q: requirements の各エントリの desc の非空もチェックすべきか？
  - A: 不要。Issue #252 のスコープは「配列が空」のケース。エントリ内容の品質は AI guardrail（unambiguous-requirements）が担当する

## Alternatives Considered
- spec.schema.json に `minLength: 1` / `minItems: 1` を追加する案 → `flow prepare` 生成の空 stub がスキーマバリデーションを通過できなくなるため却下

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-25
- Notes: auto mode

## Requirements

**REQ-1** When `spec.goal` is empty (trimmed), spec gate (phase=spec) shall return FAIL without invoking AI guardrails.

**REQ-2** When `spec.requirements` is an empty array, spec gate (phase=spec) shall return FAIL without invoking AI guardrails.

**REQ-3** When `spec.acceptance_criteria` is an empty array, spec gate (phase=spec) shall return FAIL without invoking AI guardrails.

**REQ-4** When all three fields are non-empty, the gate shall proceed to AI guardrail evaluation as before (no regression).

**REQ-5** Unit tests shall verify each of REQ-1 through REQ-4.

## Acceptance Criteria
- 空の spec.json（goal=""、requirements=[]、acceptance_criteria=[]）で `flow run gate --phase spec` を実行すると FAIL が返る
- goal のみ空、requirements のみ空、acceptance_criteria のみ空のそれぞれで FAIL ��返る
- 全フィールドが適切に記入された spec.json では既存通り AI guardrail 評価に進む
- 既存テストが��れない

## Implementation Targets
- src/flow/lib/run-gate.js

## Open Questions
- なし
