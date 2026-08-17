# Feature Specification: 114-rebuild-json-parser-with-backtracking

**Feature Branch**: `feature/114-rebuild-json-parser-with-backtracking`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #51

## Goal
`src/lib/json-parse.js` をバックトラック付き再帰下降パーサーとして再構築し、AI レスポンスの壊れた JSON を安定して修復できるようにする。josdejong/jsonrepair（ISC ライセンス）のアーキテクチャを参考にし、NOTICE に謝辞を記載する。

## Scope
- `src/lib/json-parse.js` を再帰下降パーサーベースの `repairJson(text)` 関数として再構築する
- 呼び出し元（`enrich.js`, `text.js`）の `parseEnrichResponse` / テキストパース処理を新 API に移行する
- NOTICE ファイルに jsonrepair への謝辞を追加する
- 既存の `fixUnescapedQuotes` と `extractBalancedJson` を削除する

## Out of Scope
- jsonrepair のソースコードの直接コピー（参考にして再構築する）
- シングルクォート → ダブルクォート変換
- コメント除去（`//`, `/* */`）
- JSONP / MongoDB / Python キーワード対応
- ストリーミングパーサー

## Clarifications (Q&A)
- Q: jsonrepair のコードをコピーするのか？
  - A: コピーではなく、アーキテクチャ（再帰下降 + バックトラック）を参考にして自前で再構築する。NOTICE に謝辞を記載する。
- Q: 公開インターフェースはどう変わるか？
  - A: `repairJson(text): string` を新設。`fixUnescapedQuotes` と `extractBalancedJson` は削除。呼び出し元は `repairJson` → `JSON.parse` の 2 ステップに簡素化される。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: 承認済み

## Requirements
1. [P0] `src/lib/json-parse.js` に `repairJson(text)` 関数を実装する。再帰下降パーサー（`parseValue` → `parseObject` / `parseArray` / `parseString` / `parseNumber` / `parseKeyword`）として構築し、修復済み JSON 文字列を返す
2. [P0] `parseString` にバックトラック機構を実装する。`"` が閉じクォートかどうかの判定が間違っていた場合、カーソル位置と出力を巻き戻して `stopAtDelimiter` モードでリトライする。これにより `type=""` のような曖昧なパターンを正しく処理する
3. [P0] 切断 JSON の補完を実装する。文字列・オブジェクト・配列が途中で終わった場合、閉じ `"` `}` `]` を自動挿入する
4. [P0] `repairJson` の前処理として、入力テキストが markdown fence（` ```json ` / ` ``` `）で囲まれている場合、fence を除去してから修復処理を行う
5. [P0] 呼び出し元（`enrich.js` の `parseEnrichResponse`、`text.js` のパース処理）を新 API に移行する。`JSON.parse(repairJson(text))` の 2 ステップに簡素化する
6. [P1] この spec の実装時に、プロジェクトルートに NOTICE ファイルを作成し、jsonrepair（josdejong/jsonrepair, ISC License）への謝辞を記載する
7. [P1] 旧関数 `fixUnescapedQuotes` と `extractBalancedJson` を削除する

## Impact on Existing Code
- `src/lib/json-parse.js`: 全面書き換え。export が `fixUnescapedQuotes` + `extractBalancedJson` から `repairJson` に変更
- `src/docs/commands/enrich.js`: `parseEnrichResponse` 内の 3 段フォールバックを `repairJson` → `JSON.parse` に簡素化
- `src/docs/commands/text.js`: 同様のパース処理を簡素化
- `tests/unit/lib/json-parse.test.js`: 新 API に合わせてテストを書き換え
- NOTICE: 新規作成

## Acceptance Criteria
- 以下のパターンを `repairJson` → `JSON.parse` で正しくパースできること:
  - 正常な JSON（そのまま返す）
  - 文字列値内の未エスケープ `"`（`type=""` パターン含む）
  - markdown fence で囲まれた JSON
  - 切断された JSON（閉じ括弧なし）
  - JSON の前後に余分なテキストがある場合
- `npm test` が全件 PASS すること
- NOTICE ファイルが存在し jsonrepair への謝辞が記載されていること

## Open Questions
- [ ]
