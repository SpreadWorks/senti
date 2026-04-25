# Draft: 228-fix-phase-to-skill-dead-ref

**開発種別:** bugfix
**目的:** phase→skill マッピングが撤去済み skill 名を返すバグを修正し、`recommendedSkill` が現行 skill 構成と一致するようにする。

## Requirements

1. (P1) `flow get resolve-context` または `flow run resume` を実行したとき、返される `recommendedSkill` は現行の skill 名でなければならない。
2. (P2) フローがいずれかの phase にあるとき、その phase に対する skill マッピングが明示的に定義されていなければならない。未定義の phase が default フォールバックで誤った skill 名を返す状態を解消する。
3. (P3) `flow get resolve-context` または `flow run resume` を実行したとき、`recommendedSkill` フィールドが envelope に含まれていなければならない（削除しない）。

## Scope Verification
- In scope:
  - phase→skill マッピングの値を現行 skill 構成に合わせる修正
  - 未カバーの phase 値に対する明示的なマッピング追加
- Out of scope:
  - `recommendedSkill` フィールド自体の削除検討
  - flow-resume skill テンプレート側のマッピングの整理

## Impact on Existing Features
- `flow get resolve-context` / `flow run resume` の envelope に含まれる `recommendedSkill` の値が変わる
- 既存テストは `recommendedSkill` の存在のみ検証しており、値は検証していないため破壊なし

## Q&A
- Q: マッピング修正のみか、フィールド削除か？
  - A: マッピング修正のみ。根拠: 既存テストが存在を前提としており、CLI envelope の安定性を維持する（既存コードパターン準拠）。
- Q: 全 phase のマッピング先は？
  - A: sync 以外は統合ディスパッチャー skill にマッピングする。根拠: flow-resume skill テンプレートが plan/impl/finalize を同一 skill に案内している（既存 skill 構成準拠）。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-25
- Notes: マッピング修正方針で合意
