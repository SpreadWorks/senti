# Feature Specification: 174-record-test-summary

**Feature Branch**: `feature/174-record-test-summary`
**Created**: 2026-04-14
**Status**: Draft
**Input**: Issue #144

## Goal

flow-plan テストフェーズ完了時にテスト数を flow.json に記録し、レポートの Tests 欄が正しく表示されるようにする。

## Scope

- flow-plan SKILL.md テンプレート（`src/templates/skills/sdd-forge.flow-plan/SKILL.md`）の test フェーズ「On complete」に `flow set test-summary` 記録指示を追加する
- `sdd-forge upgrade` を実行してインストール済みスキルへ変更を反映する

## Out of Scope

- flow-impl SKILL.md への変更（テスト実行後の test-summary 更新）
- テストランナー出力の自動パース
- `set-test-summary.js` や `report.js` の変更

## Clarifications (Q&A)

- Q: test-summary に記録する数値は「書いたテスト数」か「実行結果（pass/fail）」か？
  - A: 書いたテスト数。テストランナー出力のパースはプロジェクト固有の実装に依存するため採用しない。

- Q: 自動カウントは可能か？
  - A: テスト仕様書（README）を書く時点で AI はテスト数を把握しているため、その時点での記録で十分。言語・フレームワーク非依存。

- Q: flow-impl にも test-summary 更新指示を追加するか？
  - A: しない。plan フェーズの記録で十分。

## Impact on Existing Features

- `flow run report` / `flow run finalize`: Tests 欄の表示が `-` から実際のテスト数に変わる（バグ修正）
- `sdd-forge upgrade`: 既存のスキル同期挙動に変更なし
- 他の既存機能への影響: なし

## Why This Approach

テンプレートには既に正しい指示が存在するが、インストール済みスキルへの反映が欠落していることが根本原因である。テンプレートの変更は不要で、`sdd-forge upgrade` による同期のみで解決できる。テストランナー固有の出力パースを採用しない理由は、sdd-forge が汎用ツールであり特定プロジェクトの実装に依存してはならないため。

## Alternatives Considered

- TAP 出力の自動パース: プロジェクト・言語固有のため採用せず
- flow-impl への記録追加: plan フェーズで十分であり、スコープを広げる理由がないため採用せず

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-14
- Notes: スコープは flow-plan テンプレートの upgrade のみ

## Requirements

1. **【必須】** flow-plan テストフェーズ完了時（テスト仕様書 README を作成した後）に、書いたテスト数を unit/integration/acceptance 別に記録しなければならない
2. **【必須】** テスト数を記録する際は、テストランナー・言語固有の出力（TAP 等）に依存する手段を使ってはならない（テスト仕様書執筆時に把握できる情報のみで記録する）
3. **【任意】** flow-impl フェーズでの記録更新は行わない

## Acceptance Criteria

- flow-plan テストフェーズ後に `flow run report` または `flow run finalize` を実行したとき、Tests 欄に `-` 以外の値（例: `unit 2  integration 0  acceptance 1  total 3`）が表示される
- 記録手順はテストランナーの種類に依存せず、任意の言語・プロジェクトで使用できる

## Test Strategy

スキルへの指示変更（プロンプトエンジニアリング）であるため、自動化されたユニットテストの対象外。代わりに以下を実施する:

- インストール済みスキル（`.claude/skills/sdd-forge.flow-plan/SKILL.md`）の該当箇所を目視確認し、`flow set test-summary` 指示が含まれていることを検証する
- `sdd-forge upgrade` 実行後、インストール済みスキルとテンプレートの内容が一致していることを確認する

## Open Questions

（なし）
