# Feature Specification: 248-context-search-accuracy

**Feature Branch**: `feature/248-context-search-accuracy`
**Created**: 2026-04-30
**Status**: Draft
**Input**: GitHub Issue #301

## Goal
contextSearch の検索精度を改善し、review-spec / review-draft プロンプトのトークンコストを削減する。検索結果を ~27件 / ~4,590 tokens から ~21.7件 / ~977 tokens に改善する。

## Background
contextSearch の ngramSearch はクエリ全体を1文字列として bigram 化しており、日本語クエリと英語キーワードの比較で構造的に精度が低い。また review プロンプトに渡す contextEntries に detail フィールド（平均 479文字/entry）を含むためトークンコストが高い。シミュレーションにより、単語別 bigram + multi-match 戦略で 72% カバー率を維持しつつ結果件数を削減でき、imports 展開 + scope.in マッチで 55% カバー率を達成できることが検証済み。

## Scope
- `src/flow/lib/get-context.js` — 検索アルゴリズム書き換え、構造展開追加
- `src/flow/commands/review.js` — extractGoalAndScope 修正、プロンプト最適化
- `src/flow/schemas/spec.schema.json` — keywords フィールド追加
- `src/flow/prompts/plan/spec.md` — keywords 生成指示追加

## Out of Scope
- aiSearch ロジックの変更（既存の AI fallback チェーンは維持）
- contextSearch の呼び出しインターフェース変更（既存の引数・戻り値の型は維持）
- config.json へのユーザー設定追加

## Constraints
- src/ にプロジェクト固有情報をハードコードしない（hub 判定はファイル名ではなく接続数閾値で行う）
- contextSearch に optional な options パラメータ（scopePaths 等）を末尾に追加してもよいが、既存の引数位置は変更しない
- 既存の spec.json との後方互換性を維持する（keywords は optional フィールド）
- 外部依存を追加しない（Node.js 組み込みモジュールのみ）

## Design Principles
- 検索精度とトークンコストのバランスを取る — カバー率を維持しつつ件数とトークンを削減
- 動的判定 — 固定閾値や固定件数ではなくマッチの質に基づいて結果件数を制御
- 段階的 fallback — keywords → goal+scope、ngram → fallback → AI の既存チェーンを活用

## Overview
### Modules
- get-context.js: ngramSearch を単語別 bigram 比較に置き換え、スコアリング改善、動的 N 制御、scope.in パスマッチ、imports 展開を追加
- review.js: extractGoalAndScope を spec.keywords ベースに切り替え、contextEntries から detail を除去し関連度順にソート
- spec.schema.json: optional keywords: string[] フィールドを追加
- prompts/plan/spec.md: spec 記入時に英語キーワード 5-15 個を生成する指示を追加

### Data Flow
- spec 記入時: AI が spec 内容から英語キーワードを生成 → spec.json.keywords に格納
- review 時: extractGoalAndScope が spec.keywords を検索クエリとして使用（不在時は goal+scope fallback）
- contextSearch: クエリを単語分割 → 各単語×各エントリキーワードで bigram 類似度計算 → スコアリング → 動的 N で選抜 → scope.in マッチ追加 → imports 展開 → スコア順ソート
- review prompt: file+summary のみ（detail なし）の contextEntries を関連度順で埋め込み

### Decisions
- hub 除外は接続数閾値（>= 20）で動的判定する。直接マッチしたファイルは hub でも結果に含める。
- buildDraftReviewPrompt も buildSpecReviewPrompt と同じ最適化（detail 除去、関連度順ソート）を適用する。
- keywords は spec.schema.json に optional フィールドとして追加する。

## Clarifications (Q&A)
- Q: hub 閾値 20 はどのプロジェクトでも適切か？
  - A: シミュレーションで sdd-forge において適切に機能した値。汎用パッケージとして定数で定義し、将来必要があれば config で上書き可能にする拡張ポイントを残す。
- Q: detail 除去で review の精度が下がらないか？
  - A: review は spec の網羅性を見るもので、実装の正しさは見ない。file+summary で spec 見落とし検出には十分。
- Q: draft review で spec.keywords を使えるか？
  - A: 使えない。draft review 時点では spec.json が存在しない。draft review のクエリは draftJson.goal / requestText を使用し、トークン削減は detail 除去と関連度順ソートのみで実現する。
- Q: keywords は spec.md にレンダリングするか？
  - A: レンダリングしない。keywords は contextSearch の内部用メタデータであり、spec.md の人間向けドキュメントには含めない。AI が生成した keywords は spec.json で直接確認できる。

## Alternatives Considered
- summary/detail 全文検索（方式 B） — 平均 81 件、ノイズが現状より悪化するため不採用
- chapter 展開（方式 C） — 平均 125 件、chapter 粒度が粗すぎるため不採用
- importedBy（逆方向）展開 — カバー率に寄与せずノイズのみ増加するため不採用
- depth=2 imports 展開 — hub 除外でも平均 50 件に膨張するため不採用
- hub 除外にファイル名ハードコード — src/ 禁止事項（プロジェクト固有情報）に抵触するため不採用

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: spec.schema.json に `keywords` プロパティ（`type: array, items: string`）を optional フィールドとして追加する。
- R2 [must]: spec 記入ステップの instruction（`src/flow/prompts/plan/spec.md`）に、spec 内容から英語キーワード 5-15 個を `keywords` フィールドに生成する指示を追加する。
- R3 [must]: ngramSearch を単語別 bigram 比較に置き換える。クエリを空白で単語分割し、各クエリ単語と各エントリキーワードの bigram 類似度を個別に計算する。類似度 >= 0.6 のペアが1つでもあればそのエントリを候補に含める。
- R4 [must]: エントリのスコアに imports と methods の数を加味する。スコア加算: `(imports / maxImports) * 0.5 + (methods / maxMethods) * 0.3`。imports/methods が配列でない場合は 0 として扱い、maxImports/maxMethods が 0 の場合はボーナス 0 とする。usedBy は含めない。
- R5 [must]: 動的 N（multi-match 戦略）で結果件数を制御する。matchCount >= 2 のエントリは全て採用、matchCount = 1 のエントリはスコア上位から補填。合計で最低 5 件、最大 30 件。
- R6 [must]: extractGoalAndScope を spec.keywords ベースに切り替える。`spec.keywords` が存在すれば `keywords.join(' ')` を検索クエリとして使用し、不在時は従来の goal+scope から英語単語を抽出する fallback を維持する。
- R7 [must]: spec.json の scope.in からバッククォートで囲まれたファイルパスを正規表現で抽出し、analysis entry と突き合わせて一致するファイルを検索結果に追加する。review.js が scope.in パスを抽出して contextSearch に渡す（optional な options パラメータ経由）。
- R8 [must]: keyword 検索 + scope.in マッチで見つかったファイルの import 先を1段階展開して検索結果に追加する。hub ファイル（connectionCount = imports.length + usedBy.length >= 20）は展開経路から除外する。直接マッチしたファイルは hub でも結果に含める。importedBy（逆方向）は展開しない。
- R9 [must]: buildSpecReviewPrompt と buildDraftReviewPrompt の contextEntries フォーマットから detail フィールドを除去し、file + summary のみにする。
- R10 [must]: contextSearch の結果をスコア降順でソートする。scope.in マッチのエントリは bigram スコア 0 + imports/methods boost で算出。imports 展開のエントリは展開元のスコアの半分で算出。全エントリをスコア降順で統合ソートする。
- R11 [should]: buildSpecReviewPrompt と buildDraftReviewPrompt のプロンプトに「以下のファイルは spec との関連度順に並んでいます」の1行を追加する。

## Acceptance Criteria
- spec.schema.json が keywords フィールドを optional として受け入れ、既存 spec（keywords なし）もバリデーションを通過する
- ngramSearch がクエリを単語分割し、各単語×各キーワードで bigram 類似度を計算する
- matchCount >= 2 のエントリが全て結果に含まれ、合計件数が 5-30 の範囲に収まる
- extractGoalAndScope が spec.keywords を優先し、不在時に goal+scope fallback を使用する
- scope.in のバッククォート内パスが analysis entry と突き合わされて結果に追加される
- imports 展開が depth=1 で行われ、connectionCount >= 20 のファイルが展開経路から除外される
- buildSpecReviewPrompt / buildDraftReviewPrompt の出力に detail フィールドが含まれない
- contextSearch の結果がスコア降順でソートされている
- 全既存テストが通過し、新ロジックのユニットテストが追加されている

## Implementation Targets
- src/flow/lib/get-context.js
- src/flow/commands/review.js
- src/flow/schemas/spec.schema.json
- src/flow/prompts/plan/spec.md

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add keywords field to spec schema and integrate into search query
  - spec.json に optional keywords フィールドを追加し、extractGoalAndScope を keywords ベースの検索クエリ生成に切り替える。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Rewrite search algorithm with per-word bigram and dynamic N
  - ngramSearch を単語別 bigram 比較に置き換え、imports/methods スコアリングと動的 N（multi-match 戦略）による結果件数制御を実装する。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add scope.in path matching and imports expansion
  - scope.in からのパスマッチと imports 展開（depth=1, hub 除外）を追加し、検索結果のカバー率を向上させる。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Remove detail from review prompts and add relevance ordering
  - buildSpecReviewPrompt と buildDraftReviewPrompt から contextEntries の detail フィールドを除去し、関連度順ソートの説明文をプロンプトに追加することでトークンコストを削減する。
  - see `tasks/T-4.md` for full spec
