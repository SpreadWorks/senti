# Draft: 229-unify-priority-format

**開発種別:** refactor
**目的:** spec の priority 表記を must/should/nice-to-have に統一し、draft 段階で P1/P2/P3 が使われて spec.json schema validation が FAIL するパターンを解消する。

## Scope Verification
- In scope:
  - When gate-draft evaluates a draft's priority notation, the guardrail body shall reference the spec.json enum values (must / should / nice-to-have) so that AI uses the same notation from draft through spec.json.
  - When requirements exceed three items, the guardrail shall instruct the author to assign each requirement a priority from the spec.json enum (must / should / nice-to-have) instead of P1/P2/P3.
- Out of scope:
  - spec.json の priority enum 変更（現行 enum は正しい）
  - 既存 spec ファイルの修正（既に正しい値が入っている）
  - spec render / review / retro のレンダリングロジック変更（priority 値をそのまま表示しており変更不要）

## Impact on Existing Features
- 影響ありの既存機能:
  - gate-draft の guardrail 評価: prioritize-requirements guardrail の body テキストが変わるため、gate-draft 実行時に AI が参照するガードレール文言が変わる。priority の指定形式が具体的になるだけで、評価ロジック自体は変わらない。
- 影響なし: spec.json schema、spec render、review、retro のレンダリング

## Q&A
- Q1: 対応方針
  - A: A+C を採用。P1/P2 を廃止し、guardrail 文言を must/should/nice-to-have に統一する。alpha 版ポリシー（後方互換コードを書かない）に合致し、変換層や schema 緩和のような間接コストを避けられる。
- Q2: 変更スコープ
  - A: prioritize-requirements guardrail の body テキスト変更のみ。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-25
- Notes:
