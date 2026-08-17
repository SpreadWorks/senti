# Feature Specification: 155-agent-json-output-usage

**Feature Branch**: `feature/155-agent-json-output-usage`
**Created**: 2026-04-08
**Status**: Draft
**Input**: Issue #109

## Goal

agent 呼び出しの結果から usage（token 数・cache hit 数・cost）を計測してログに記録できるようにする。
prompt caching の効果観測のためのベースライン計測機構（Phase 0）。

## Scope

- `src/lib/agent.js` の内部実装のみ変更する
- agent config に `jsonOutputFlag` フィールドを追加して JSON 出力モードを有効化できるようにする
- provider（claude / codex）に応じた JSON パースと usage の正規化を agent.js 内部に実装する
- 解析した usage を Logger.agent end-event payload に追加し、`.tmp/logs/prompts.jsonl` に記録する
- 呼び出し側の戻り値（trimmed string）は変更しない

## Out of Scope

- 呼び出し側 12 箇所（`run-gate.js`, `review.js` 等）の変更
- prompt caching の改善・最適化（Phase 1 以降）
- usage データの可視化・レポート機能
- unknown provider への JSON パース対応

## Clarifications (Q&A)

- Q: provider 判定は完全一致か部分一致か？
  - A: 部分一致。`agent.command` に `"claude"` を含む → claude、`"codex"` を含む → codex、どちらも含まない → unknown。将来コマンド名が変わっても動作するよう部分一致を採用。

- Q: JSON 出力フラグはどう有効化するか？
  - A: agent config の `jsonOutputFlag` フィールドで制御（`systemPromptFlag` と同パターン）。設定あり → JSON モード、未設定 → plain text モード（現状維持）。

- Q: unknown provider の場合は？
  - A: `jsonOutputFlag` が設定されていても plain text として扱い、usage は記録しない。

## Alternatives Considered

- **自動付与（provider 判定のみで決定）**: provider 判定ができれば自動でフラグを追加する案。既存ユーザーの挙動が変わるリスクがあるため不採用。
- **config フラグでオプトイン（boolean）**: `agent.jsonOutput: true/false` の形。フラグ値そのものをコマンドに渡す必要があるため `jsonOutputFlag` の方が柔軟で採用。

## Why This Approach

`systemPromptFlag` という既存パターンに倣い、「config に値が設定されていれば機能が有効になる」設計を踏襲することで、学習コストを最小化しつつ明示的オプトインを実現する。
JSON パースを agent.js 内部に閉じ込めることで、呼び出し側 12 箇所への影響をゼロに保てる。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08
- Notes: Q&A を経て設計を確定。jsonOutputFlag による明示的オプトイン方式を採用。

## Requirements

優先度順（高→低）:

1. **[必須] jsonOutputFlag サポート**: `agent.providers.<key>` に `jsonOutputFlag` フィールドを設定できる。設定した値が実行時に args に追加される。ユーザーの既存 args に同フラグが含まれる場合は重複しない。

2. **[必須] provider 判定**: `agent.command` の部分一致により provider（claude / codex / unknown）を判定できる。

3. **[必須] JSON パースと usage 正規化**: `jsonOutputFlag` が設定されており provider が claude または codex の場合、stdout を JSON として解析し usage 情報を取り出す。パース失敗時は stderr に警告を出力したうえで plain text fallback とする（呼び出し元へのエラー伝播はなし）。

4. **[必須] usage のログ記録**: 解析した usage（入力トークン数・出力トークン数・cache hit 数・cost）を Logger.agent end-event payload に追加する。`jsonOutputFlag` 未設定または unknown の場合は `usage: null` を記録する。

5. **[必須] 戻り値の互換性**: すべての呼び出し元への戻り値は従来と同じ trimmed string のまま変更しない。

6. **[任意] 既存動作の完全保持**: `jsonOutputFlag` が未設定の場合、agent.js の動作は現状と一切変わらない。

## Acceptance Criteria

- `jsonOutputFlag` が設定された agent config で claude/codex を呼び出すと、`.tmp/logs/prompts.jsonl` の end-event に `usage` フィールドが記録される
- `jsonOutputFlag` が未設定の場合、ログの `usage` フィールドは `null` で、呼び出し動作は変化しない
- unknown provider で `jsonOutputFlag` が設定されていても、plain text として処理され `usage: null` が記録される
- JSON パースが失敗した場合（不正な stdout 等）、stderr に警告を出力したうえで plain text fallback で動作する（エラーは呼び出し元に伝播しない）
- 12 箇所の既存呼び出し側のコードは変更不要

## Test Strategy

`specs/155-agent-json-output-usage/tests/` に配置するスペック検証テスト（`npm test` の対象外）：

- provider 判定: claude含む / codex含む / どちらも含まない(unknown) の各ケース
- JSON パース: claude 形式 / codex 形式 / パース失敗時 fallback の各ケース
- usage 正規化: 各 provider の usage フィールドが正しく取り出されること
- `jsonOutputFlag` 未設定時: args に変化がなく usage が null になること
- 既存呼び出し側との互換性: 戻り値が trimmed string であること

## Open Questions

なし
