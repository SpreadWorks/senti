# Feature Specification: 111-detect-corrupted-json-in-flow-state-js

**Feature Branch**: `feature/111-detect-corrupted-json-in-flow-state-js`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #46

## Goal
`flow-state.js` の `loadActiveFlows()` で JSON パースエラーが発生した場合に警告ログを出力する。現在はすべてのエラーを無言で握りつぶしているため、`.active-flow` ファイルが破損してもユーザーが気づけない。

## Scope
- `src/lib/flow-state.js` の `loadActiveFlows()` 内の catch ブロック1箇所を修正

## Out of Scope
- flow-state.js 内の他の catch ブロックの修正（別 issue e03c で対応）
- ファイル修復ロジックの追加
- loadFlowState() 等の他の関数の修正

## Clarifications (Q&A)
- Q: ENOENT はどう扱うか？
  - A: `loadActiveFlows()` は catch の前に `fs.existsSync()` でファイル存在を確認済み。ENOENT が catch に到達する可能性は低いが、到達した場合も無視して良い（正常動作）。
- Q: logger はどうするか？
  - A: `console.error` を使用する。flow-state.js は共有ライブラリであり、createLogger 依存を追加するのは過剰。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: autoApprove モード

## Requirements

### R1: loadActiveFlows の catch ブロックで ENOENT 以外のエラーを警告出力（優先度: 1）
- `loadActiveFlows()` の catch ブロックで、`err.code === "ENOENT"` の場合は無視して空配列を返す
- それ以外のエラー（JSON SyntaxError、EACCES 等）の場合、`console.error` で警告メッセージを出力してから空配列を返す
- 警告メッセージにはファイルパスとエラーメッセージを含める（例: `[flow-state] WARN: failed to parse .active-flow (path): SyntaxError: ...`）
- 関数の戻り値（空配列）は変更しない

## Acceptance Criteria
1. 破損した JSON を `.active-flow` に書き込んだ場合、警告メッセージが stderr に出力されること
2. ファイルが存在しない場合、警告は出力されないこと（既存動作と同じ）
3. 正常な JSON の場合、警告は出力されないこと
4. 既存テストがパスすること

## Open Questions
なし
