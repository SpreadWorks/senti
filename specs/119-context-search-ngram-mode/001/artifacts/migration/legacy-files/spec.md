# Feature Specification: 119-context-search-ngram-mode

**Feature Branch**: `feature/119-context-search-ngram-mode`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #60

## Goal

コンテキスト検索（`sdd-forge flow get context --search`）のデフォルト検索方式を AI キーワード選定から N-gram (bigram) マッチに変更し、`config.json` で AI モードと切り替え可能にする。AI 呼び出し不要で瞬時・無料・決定的な検索をデフォルトとする。

## Scope

- `src/flow/get/context.js` に N-gram 検索関数を追加し、検索モード分岐ロジックを実装する
- `src/lib/types.js` に `flow.commands.context.search.mode` のバリデーションを追加する
- 3段フォールバック（ngram → fallbackSearch → AI）を実装する
- テスト（P1〜P3）を実施する

## Out of Scope

- 日本語プロジェクトでの閾値チューニング（別 spec で検証後に対応）
- 大規模プロジェクト（1000+ エントリ）のパフォーマンス最適化
- enrich 未完了エントリへの keywords 自動付与
- `collectAllKeywords` の変更（既に頻出順ソート + 上限 2000 実装済み）

## Clarifications (Q&A)

- Q: 設定フィールドの配置場所は？
  - A: `flow.commands.context.search.mode` に配置する。flow コマンド固有の設定として `flow` セクション配下が自然。
- Q: N-gram マッチ失敗時のフォールバックは？
  - A: 3段フォールバック: ngram → fallbackSearch（スペース分割 OR マッチ）→ AI（エージェント利用可能時のみ）。各段で 0 件の場合のみ次段に進む。
- Q: AI モード選択時の動作は？
  - A: 従来通り AI → fallbackSearch の2段。既存動作を維持する。
- Q: `collectAllKeywords` の変更は必要か？
  - A: 不要。頻出順ソート + 上限 2000 は既に実装済み。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: Gate PASS 後に承認

## Requirements

### R1: N-gram 検索関数の実装 [P1]

`ngramSearch(allEntries, analysis, query)` 関数を `context.js` に追加する。

- R1.1: `ngramSearch` が呼ばれたとき、クエリ文字列を bigram (n=2) に分解する。入力をローワーケースに変換し、連続する2文字の配列を返す関数 `toBigrams(text)` を使用する。
- R1.2: エントリの keywords とクエリの類似度を判定するとき、2つの bigram セットの Dice 係数（`2 * |intersection| / (|a| + |b|)`）を計算する関数 `bigramSimilarity(a, b)` を使用する。
- R1.3: クエリの bigram と各エントリの keywords の bigram を比較し、閾値 0.15 以上のエントリをスコア降順で返す。
- R1.4: エントリの keywords が空または未定義の場合、そのエントリのスコアは 0 となり、結果配列に含まれない。フォールバックチェーンの次段判定には影響しない（全エントリのスコアが閾値未満なら結果は空配列となり、次段に進む）。

### R2: 設定による切り替え [P1]

- R2.1: `config.json` の `flow.commands.context.search.mode` フィールドで `"ngram"` / `"ai"` を指定可能にする。
- R2.2: デフォルト値は `"ngram"`（フィールド省略時）。
- R2.3: `src/lib/types.js` の `validateConfig()` に `flow.commands.context.search.mode` のバリデーションを追加する。許可値は `"ngram"` と `"ai"` のみ。
- R2.4: `context.js` の検索ロジックで config から mode を読み取り、分岐する。

### R3: 3段フォールバック [P1]

- R3.1: N-gram モード（`mode === "ngram"` またはデフォルト）の検索チェーン: `ngramSearch` → 0 件なら `fallbackSearch` → 0 件かつエージェント利用可能なら `aiSearch`（従来の AI 検索）。
- R3.2: AI モード（`mode === "ai"`）の検索チェーン: `aiSearch` → 0 件なら `fallbackSearch`（従来動作を維持）。
- R3.3: 各段で結果が 1 件以上あれば、その結果を返す（次段に進まない）。

### R4: エラーハンドリング [P2]

- R4.1: N-gram 検索関数が例外を投げた場合、例外メッセージを stderr に出力したうえで、フォールバックチェーンの次段（fallbackSearch）に進む。
- R4.2: `validateConfig()` は不正な mode 値（`"ngram"` / `"ai"` 以外）に対してエラーメッセージを返す（終了コード 1 で `sdd-forge` が停止する既存の validateConfig の動作に従う）。バリデーション通過後の実行時には不正値は発生しない。
- R4.3: 全段フォールバック後も検索結果が 0 件の場合、終了コード 0 で空の結果（`{ok: true, total: 0, entries: []}`）を返す。これは既存動作と同じ。

### R5: 既存インターフェースの維持 [P2]

- R5.1: CLI の `--search` フラグの使い方は変更しない。
- R5.2: JSON 出力（`{ok, total, entries}`）のフォーマットは変更しない。
- R5.3: `--raw` モードの出力フォーマットは変更しない。

## Acceptance Criteria

- AC1: デフォルト設定（config 未指定）で `--search` を実行すると、N-gram 検索が使用される（AI エージェントが呼ばれない）。
- AC2: `flow.commands.context.search.mode: "ai"` を設定すると、従来の AI 検索が使用される。
- AC3: N-gram 検索で 0 件 → fallbackSearch で 0 件 → AI にフォールバックする（エージェント利用可能時）。
- AC4: N-gram 検索で 0 件 → fallbackSearch で結果あり → fallbackSearch の結果が返る（AI は呼ばれない）。
- AC5: `toBigrams("hello")` が `["he", "el", "ll", "lo"]` を返す。
- AC6: 日本語2文字キーワード（例: "認証"）の bigram が1つ（`["認証"]`）となり、閾値次第でマッチ/不マッチすることを確認する。
- AC7: 不正な mode 値（例: `"fuzzy"`）が `validateConfig()` でエラーになる。

## Open Questions

- [x] 日本語短語の閾値を別途調整する必要があるか → 本 spec では 0.15 固定。日本語プロジェクトでの検証後、必要なら別 spec で閾値チューニングを行う
