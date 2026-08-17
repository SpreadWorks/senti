# Feature Specification: 134-fill-skill-guardrail-gaps

**Feature Branch**: `feature/134-fill-skill-guardrail-gaps`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User request

## Goal

SDD フロー内の guardrail/gate/review 呼び出しの抜けを修正し、全フェーズで一貫した品質チェックパターン（guardrail 参照 → gate → review → gate 再検証）が実行されるようにする。

## Scope

- flow-plan SKILL.md: spec 起草ステップに `get guardrail spec` を追加
- flow-plan SKILL.md: test フェーズに `get guardrail test` + `run review --phase test` を追加
- flow-impl SKILL.md: code review 後に `run gate --phase impl`（再検証）を追加
- get-guardrail.js: phase バリデーションに `test` を追加（空結果を返す）

## Out of Scope

- test 用 guardrail 記事の作成（別タスク。phase 対応のみ行い、記事は後から追加）
- code review のループ化（review → gate → review の反復は将来検討）
- guardrail.json のフォーマット変更

## Clarifications (Q&A)

- Q: test guardrail 記事がない状態で `get guardrail test` を呼ぶとどうなるか？
  - A: phase バリデーションを通過し、該当記事がないため空結果を返す。SKILL.md 側は「output が non-empty なら参照」の条件があるため、空結果なら無視される

- Q: code review 後の gate 再検証で FAIL した場合の対応は？
  - A: spec review 後の gate 再検証と同じパターン。AI が修正して再 gate（リトライ上限あり）

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-03
- Notes: Gate PASS 後に承認

## Requirements

Priority order:

1. **R1: spec 起草時の guardrail 参照** — When: flow-plan スキルの spec 起草ステップ（step 6: Fill spec）が実行される場合、`sdd-forge flow get guardrail spec` を呼び出し、AI が guardrail 原則を参照してから spec を記述する。draft ステップと同じパターン。
2. **R2: test フェーズの guardrail 参照と review** — When: flow-plan スキルの test フェーズ（step 9）が実行される場合、テスト作成前に `sdd-forge flow get guardrail test` で guardrail を参照し、テスト作成後に `sdd-forge flow run review --phase test` でテスト品質レビューを実行する。
3. **R3: code review 後の gate 再検証** — When: flow-impl スキルの code review が完了した場合、`sdd-forge flow run gate --phase impl` を再実行し、review の自動修正が spec 要件や guardrail を壊していないか再検証する。FAIL なら AI が修正して再 gate（リトライ上限 5回）。
4. **R4: get-guardrail の test phase 対応** — When: `sdd-forge flow get guardrail test` が実行された場合、phase バリデーションエラーではなく、該当記事をフィルタした結果（記事がなければ空）を返す。

## Acceptance Criteria

- AC1: flow-plan SKILL.md の spec 起草ステップに `sdd-forge flow get guardrail spec` の呼び出しが記載されている
- AC2: flow-plan SKILL.md の test フェーズに `sdd-forge flow get guardrail test` と `sdd-forge flow run review --phase test` の呼び出しが記載されている
- AC3: flow-impl SKILL.md の code review ステップ後に `sdd-forge flow run gate --phase impl` の再検証ステップが記載されている
- AC4: `sdd-forge flow get guardrail test` がエラーではなく正常応答を返す
- AC5: When: 全変更完了後に `npm test` を実行した場合、既存テスト全通過

## 既存機能への影響

- **flow-plan SKILL.md**: spec 起草ステップと test フェーズに呼び出し追加。既存ステップの動作は変わらない
- **flow-impl SKILL.md**: code review 後に gate 再検証ステップ追加。既存ステップの動作は変わらない
- **get-guardrail.js**: phase バリデーションに test を追加。既存の draft/spec/impl/lint は影響なし

## CLI 後方互換性

- 既存コマンドの削除・意味の変更なし
- `flow get guardrail test` が新たに有効になるのみ（以前はエラー）
- alpha 版ポリシーにより内部 API の後方互換は不要

## Open Questions

- [x] test guardrail 記事がない場合の挙動 → 空結果を返す。SKILL.md の「non-empty なら参照」条件でハンドリング済み
