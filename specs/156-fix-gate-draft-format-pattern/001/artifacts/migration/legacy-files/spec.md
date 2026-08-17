# Feature Specification: 156-fix-gate-draft-format-pattern

**Feature Branch**: `feature/156-fix-gate-draft-format-pattern`
**Created**: 2026-04-08
**Status**: Draft
**Input**: Issue #110

## Goal

`gate draft` のフォーマット検出において、`## 見出し形式` を `key: コロン形式` と同等に受け付けるよう正規表現を拡張する。
ユーザーが draft.md を自然な Markdown で書けるようにすることで、gate FAIL → 書き直しのフリクションをなくす。

## Scope

- `src/flow/lib/run-gate.js` 内 `checkDraftText()` 関数の `hasDevType` と `hasGoal` の正規表現を拡張する
- 対象パターン: `開発種別` / `Development Type` / `目的` / `Goal`
- 日本語・英語両対応を維持する

## Out of Scope

- `checkSpecText()` の変更（spec フェーズは元々見出し形式なので問題なし）
- `gate --phase impl` の変更
- draft.md のテンプレートやスケルトンの変更
- SKILL.md / ドキュメントの更新（別 spec で対応）

## Clarifications (Q&A)

- Q: 現状の正規表現は？
  - A: `hasDevType` → `/\*{0,2}(?:開発種別|dev(?:elopment)?\s*type)\*{0,2}\s*[:：]/i`、`hasGoal` → `/\*{0,2}(?:目的|goal)\*{0,2}\s*[:：]/i`。コロン形式のみ受け付ける。

- Q: 見出し形式とは具体的にどんな書き方か？
  - A: `## 開発種別`（`##` レベル見出し）。`### 開発種別` のような深い見出しは対象外とする。

- Q: `## 開発種別` の後に内容が空でも PASS か？
  - A: PASS とする。見出し行が存在すれば記入済みとみなす。

- Q: spec/impl フェーズへの波及はあるか？
  - A: ない。`checkSpecText()` は元々見出し形式で検出しており、今回の変更対象ではない。

## Alternatives Considered

- **見出し形式を SKILL.md の MUST ルールから除外する（ドキュメント修正のみ）**: ユーザーへの周知でフリクションは減らせるが、根本解決にならない。今回は正規表現修正を選択。
- **draft.md テンプレートをコロン形式に固定化する**: ユーザーの自由度を下げるため不採用。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08 (autoApprove)
- Notes: gate PASS 後の自動承認

## Requirements

1. `checkDraftText()` の `hasDevType` 検出パターンを拡張し、`## 開発種別` および `## Development Type`（または同等の英語表記）を PASS と判定できるようにする
2. `checkDraftText()` の `hasGoal` 検出パターンを拡張し、`## 目的` および `## Goal` を PASS と判定できるようにする
3. 既存の PASS 条件（`**開発種別:** ...`、`開発種別: ...` 等のコロン形式）を壊さない
4. 日本語・英語両対応（`i` フラグ）を維持する

## Test Strategy

`checkDraftText()` は `run-gate.js` からエクスポートされているため、ユニットテストで直接検証できる。

- テスト配置: `specs/156-fix-gate-draft-format-pattern/tests/` (spec 検証テスト)
  - 理由: 「見出し形式が PASS すべき」という要件はこの spec 固有の修正検証。将来の変更で意図的にパターンを変える場合は FAIL が正当なため、`tests/` (formal) には置かない。
- フレームワーク: Node.js 組み込み `assert` + `node:test`
- 対象: `checkDraftText(text)` に対して見出し形式・コロン形式の PASS/FAIL を直接アサート

## Acceptance Criteria

- `## 開発種別` のみを含む draft.md で `gate --phase draft` が PASS する
- `## Development Type` のみを含む draft.md で `gate --phase draft` が PASS する
- `## 目的` のみを含む draft.md で `gate --phase draft` が PASS する
- `## Goal` のみを含む draft.md で `gate --phase draft` が PASS する
- 従来の `**開発種別:** value` 形式は引き続き PASS する
- 従来の `**目的:** value` 形式は引き続き PASS する
- `checkSpecText()` の挙動は変わらない

## Open Questions

- なし
