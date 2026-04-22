# Draft: 212-draft-recommended-first

**開発種別:** docs
**目的:** AI が draft フェーズで提示する選択肢の「推奨案」を常に `[1]` に配置するよう、共通スタイルガイドにルールを明記する。

## Requirements

- **R1:** When the AI presents a choice block and a recommended option exists, the style guide shall require the recommended option to be placed at id `[1]`.
- **R2:** When multiple options are tied as top recommendations, the style guide shall require one of them to be placed at `[1]` (ties are broken arbitrarily; all remaining candidates may be noted in the surrounding prose).
- **R3:** When no recommendation exists for a choice block, the style guide shall not mandate any specific ordering (the `[1]` placement rule applies only when a recommendation is present).

## Scope Verification
- In scope:
  - `src/templates/partials/ai-question-style.md` § 3「選択肢提示」に推奨案の配置位置ルールを追加
  - SKILL.md（`sdd-forge.flow`）への partial 反映は既存の include 経由で自動
- Out of scope:
  - CLI の固定プロンプト（`src/flow/lib/get-prompt.js`）の並び順保証ロジック追加
  - 他 skill（flow-auto / flow-status 等）個別の選択肢見直し
  - draft フェーズ以外（impl / review 等）の選択肢スタイル変更

## Impact on Existing Features
- 影響ありの既存機能:
  - AI が生成する choice ブロックの並び順の規約化（出力形式のみ、動作変化なし）
- 影響なし: CLI コマンド動作・テスト・docs 生成パイプライン・既存 spec データ

## Q&A
- Q: 対象は CLI 固定プロンプト（`get-prompt.js`）か、AI 生成 choice か？
  - Recommendation: AI 生成 choice のみ。
  - Basis (issue text): Issue #217 本文「draft フェーズで AI が提示する選択肢」に合致。CLI の固定プロンプトは別概念。
  - A: AI 生成 choice のみ。CLI 側は out of scope。
- Q: 推奨案が複数ある場合（僅差）の扱いは？
  - Recommendation: 同率トップの 1 件を `[1]` に置く。
  - Basis (guardrail `draft-recommend-with-reasoning`): 推奨明示のルールは単一の top 候補を前提とする。僅差でも選択肢ブロックは単純化すべき（ai-question-style § 3 の「ラベル＋1 行注釈のみ」方針）。
  - A: 同率トップを `[1]` に置く。代替候補は本文側の比較テーブル等で補足する。
- Q: 推奨案が無い場合は？
  - Recommendation: 配置ルール不発動。
  - Basis (guardrail `draft-recommend-with-reasoning`): 「推奨案があれば明示」と条件付きで定義されているため、無い場合は既存ルールに整合させる。
  - A: 推奨案がある場合にのみ `[1]` 配置ルールが発動する条件付きルールとする。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-22
- Notes: Issue #217 からの要望。スコープは partial 1 ファイルのルール追記のみ。
