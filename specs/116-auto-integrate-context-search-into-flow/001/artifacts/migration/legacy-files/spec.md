# Feature Specification: 116-auto-integrate-context-search-into-flow

**Feature Branch**: `feature/116-auto-integrate-context-search-into-flow`
**Created**: 2026-04-01
**Status**: Draft
**Input**: GitHub Issue #57

## Goal
`flow get context --search` を AI キーワード選定方式に変更し、flow-plan / flow-impl スキルに自動統合する。自然文クエリを受け取り、analysis.json のキーワードリストから AI が関連キーワードを選定し、静的マッチで関連エントリを返す。

## Scope
- `src/flow/get/context.js` の `--search` を AI キーワード選定 + 静的マッチの 2 段階方式に変更する
- AI agent を `resolveAgent(config, 'context.search')` で解決する
- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` の draft/spec フェーズに `--search` 呼び出しを追記する
- `src/templates/skills/sdd-forge.flow-impl/SKILL.md` の実装開始時に `--search` 呼び出しを追記する

## Out of Scope
- `--raw`（パスなし）の全エントリ一覧機能の変更
- `--search` の AI なしフォールバック（`--no-ai` オプション）
- review 履歴からのキーワード検索（ボード ce15）
- keywords の品質改善（enrich プロンプトの調整）

## Clarifications (Q&A)
- Q: --search に何を渡すか？
  - A: 自然文。flow-plan ではリクエスト文 or Issue タイトル、flow-impl では spec の Goal をそのまま渡す。
- Q: AI キーワード選定の入力は何か？
  - A: analysis.json から収集した全 keywords のユニークリスト + クエリ文。AI は「リストの中から関連するキーワードを選べ」と指示される。
- Q: agent がない場合（config 未設定）はどうなるか？
  - A: agent が解決できない場合は AI 選定をスキップし、クエリ文をスペース区切りで分割して OR の静的マッチにフォールバックする。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-01
- Notes: 承認済み

## Requirements
1. [P0] `context.js` の `--search` 処理を変更する。自然文クエリを受け取った場合、(a) analysis.json 全エントリから keywords を収集しユニーク化、(b) AI に keywords リスト + クエリを渡して関連キーワードを選定させる、(c) 選定されたキーワードで既存の `searchEntries` 静的マッチを実行する。これが中核機能であり、要件 2・3 はこの実装の詳細である
2. [P0] 要件 1 の AI 呼び出しで使う agent は `resolveAgent(config, 'context.search')` で解決する。config.json の agent 設定でプロジェクトごとに AI モデルを指定可能にする
3. [P0] 要件 2 で agent が解決できない場合（config 未設定・agent なし）は、クエリ文をスペース区切りで分割して OR の静的マッチにフォールバックする。エラーにはしない。agent なし環境でも最低限動作することを保証するため P0
4. [P1] flow-plan スキル (`src/templates/skills/sdd-forge.flow-plan/SKILL.md`) の draft 開始前と spec 記入前に `sdd-forge flow get context --search "<request or issue title>" --raw` を呼ぶ指示を追記する
5. [P1] flow-impl スキル (`src/templates/skills/sdd-forge.flow-impl/SKILL.md`) の実装開始時に `sdd-forge flow get context --search "<spec goal>" --raw` を呼ぶ指示を追記する

## Impact on Existing Code
- `src/flow/get/context.js`: `--search` の内部ロジックを変更。`searchEntries` 関数自体は変更なし（入力が keywords 配列 → マッチ結果の純粋関数のまま）
- `src/lib/agent.js`: 変更なし（既存の `resolveAgent` / `callAgent` を使う）
- `src/templates/skills/sdd-forge.flow-plan/SKILL.md`: `--search` 呼び出しの指示テキストを追記
- `src/templates/skills/sdd-forge.flow-impl/SKILL.md`: 同上
- 既存の `--search` の静的マッチテスト（`get-context-search.test.js`）は `searchEntries` 関数のテストなので影響なし

## Acceptance Criteria
- `sdd-forge flow get context --search "章の除外設定が無視されるバグ" --raw` で、AI が keywords リストから関連キーワードを選定し、関連エントリが返ること
- agent 未設定の場合、フォールバックでクエリをスペース区切り OR 検索して結果が返ること（エラーにならないこと）
- flow-plan スキルに `--search` の呼び出し指示が記載されていること
- flow-impl スキルに `--search` の呼び出し指示が記載されていること

## Open Questions
- [ ]
