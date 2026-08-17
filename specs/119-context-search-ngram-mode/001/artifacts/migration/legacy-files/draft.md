# Draft: Context Search N-gram Mode (#119)

GitHub Issue: #60

## Goal

コンテキスト検索（`sdd-forge flow get context --search`）のデフォルト検索方式を AI キーワード選定から N-gram マッチに変更し、設定で切り替え可能にする。

## Requirements

### R1: N-gram 検索関数の実装
- bigram (n=2) ベースのキーワードマッチを実装する
- クエリを bigram 分解し、各エントリの keywords と bigram 類似度を計算する
- 閾値 0.15 以上のエントリをスコア降順で返す
- デフォルトの検索方式とする

### R2: 設定による切り替え
- `config.json` の `flow.commands.context.search.mode` で `ngram` / `ai` を切り替え可能にする
- デフォルト値: `ngram`
- `types.js` にバリデーションを追加する

### R3: 3段フォールバック
- N-gram モード: ngram → fallbackSearch → AI（エージェント利用可能時）
- AI モード: AI → fallbackSearch（従来動作維持）
- 各段で 0 件の場合のみ次段に進む

### R4: collectAllKeywords 改善
- 頻出順ソート + 上限 2000 は既に実装済み（変更不要を確認）

## Scope

### In Scope
- `src/flow/get/context.js` — N-gram 検索ロジック追加、モード分岐
- `src/lib/types.js` — `flow.commands` のバリデーション追加
- テスト（P1〜P3 全項目）

### Out of Scope
- 日本語プロジェクトでの閾値チューニング（検証後の別 spec）
- 大規模プロジェクト（1000+ エントリ）のパフォーマンス最適化
- enrich 未完了エントリへの keywords 自動付与

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | デフォルトを N-gram に変更 | AI 不要で瞬時・無料・決定的。Recall 72%, 偽陽性 0 |
| D2 | 設定は `flow.commands.context.search.mode` に配置 | flow コマンド固有の設定として `flow` セクション配下が自然 |
| D3 | 3段フォールバック (ngram → fallback → AI) | N-gram で拾えないケースだけ AI に頼る。全体的にロバスト |
| D4 | AI モードは従来動作維持 | 後方互換。AI → fallbackSearch のチェーン |

## Impact on Existing Features

- `context.js` の `aiSearch()` をリファクタし、モード分岐を追加
- `types.js` に `flow.commands` のバリデーション追加
- CLI インターフェース（`--search`）の使い方は変更なし
- flow-plan / flow-impl の内部呼び出しは影響なし（`--search` 経由のため）

## Test Strategy

- **P1**: N-gram マッチ関数の正確性（bigram 生成、スコア計算、閾値フィルタ）
- **P1**: 3段フォールバックチェーン（ngram → fallback → AI）の遷移ロジック
- **P2**: `flow.commands.context.search.mode` 設定の読み取りとモード切り替え
- **P2**: AI モード時の既存動作が壊れていないこと（回帰テスト）
- **P3**: 日本語短語（2文字）での挙動確認

## Approval

- [x] User approved this draft (2026-04-02)
