# Feature Specification: 112-context-search-layer-keyword-index

**Feature Branch**: `feature/112-context-search-layer-keyword-index`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #47

## Goal
analysis.json のエントリにシソーラス付きキーワードを付与し、`flow get context --search` でキーワード検索して関連エントリを取得できるようにする。

## Scope
- enrich プロンプトに `keywords` フィールドを追加し、AI がシソーラス付きキーワード配列を生成する
- `src/flow/get/context.js` に `--search "keyword"` オプションを追加し、keywords 配列に対する静的マッチで検索する
- enrich の結果マージ処理で `keywords` フィールドを保存する

## Out of Scope
- flow-plan/impl スキルへの自動統合（ボード 0bc9）
- review 履歴からのキーワード生成（ボード ce15）
- AI によるクエリ展開（検索時の AI 呼び出し）
- 独立した `sdd-forge context` トップレベルコマンド（既存の `flow get context` に統合）

## Clarifications (Q&A)
- Q: インデックスのデータソースは何か？
  - A: analysis.json の enriched エントリ。別途 index.json は作らない。
- Q: シソーラスはいつ作るか？
  - A: enrich 時に AI が生成。検索時には AI を使わない。
- Q: 検索結果に何を含めるか？
  - A: マッチしたエントリの file + summary + detail。`--raw` でプレーンテキスト、なしで JSON envelope。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: 承認済み

## Requirements
1. [P0] enrich プロンプト (`buildEnrichPrompt` in `enrich.js`) の出力フォーマットに `keywords` フィールドを追加する。AI は各エントリに対してシソーラス付きキーワード配列（日英混在可、同義語・関連語を含む）を生成する。例: `["auth", "認証", "session", "login", "authentication"]`
2. [P0] enrich の結果マージ処理で `keywords` 配列を analysis.json のエントリに保存する。既存の summary/detail/chapter/role の保存と同様の処理
3. [P0] `src/flow/get/context.js` に `--search "keyword"` オプションを追加する。入力キーワードが analysis.json エントリの `keywords` 配列の要素に部分文字列マッチ（大文字小文字無視）した場合、そのエントリの file, summary, detail を返す
4. [P1] `--search` の `--raw` モードでは、マッチしたエントリを `file — summary\ndetail` 形式で出力する。JSON モードでは `{total, entries: [{file, summary, detail, keywords, chapter, role}]}` を返す
5. [P1] `--search` の終了コード規約: (a) analysis.json が存在しない場合は既存の context.js の動作（NO_ANALYSIS エラー + exit code 1）をそのまま使う。これはコマンド失敗である。(b) analysis.json が存在しマッチするエントリがない場合は exit code 0。`--raw` では stdout に何も出力しない。JSON モードでは `{total: 0, entries: []}` を返す。検索は正常に実行されたがヒットがなかった状態であり、`grep` が「マッチなし=exit 1」とする慣習とは異なり、本コマンドでは「マッチなし=成功（結果が空）」と定義する

## Impact on Existing Code
- `enrich.js` の `buildEnrichPrompt()`: プロンプトに keywords フィールドの説明を追加
- `enrich.js` のマージ処理: keywords フィールドの保存を追加
- `context.js`: `--search` オプションの解析と検索ロジックを追加。既存の List モード・File モードには影響なし
- analysis.json のスキーマ: エントリに `keywords: string[]` フィールドが追加される。keywords がないエントリ（enrich 未実行）は検索対象外

## Acceptance Criteria
- `sdd-forge docs enrich` 実行後、analysis.json のエントリに `keywords` 配列が含まれること
- `sdd-forge flow get context --search "auth"` で認証関連のエントリがヒットすること
- `sdd-forge flow get context --search "存在しないキーワード"` で空の結果が返ること
- 既存の `flow get context`（パスなし / パスあり）の動作が変わらないこと

## Open Questions
- [ ]
