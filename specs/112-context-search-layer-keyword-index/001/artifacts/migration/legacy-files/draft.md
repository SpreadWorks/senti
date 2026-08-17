# Draft: 112-context-search-layer-keyword-index

## Issue
#47 Context Search Layer (Keyword Index)

## 背景
- guardrail / AGENTS.md に情報を詰め込むと後半が無視される
- 必要な知識を必要なタイミングで引く仕組みが必要
- 既存の `flow get context` は全エントリを返すだけで検索機能がない

## 決定事項

### スコープ
- Phase 1: enrich で keywords 生成 + `flow get context --search` のみ
- flow 統合 → ボード 0bc9、review 履歴 → ボード ce15 に分離

### インデックスソース
- analysis.json の enriched エントリをそのまま使う
- 別途 index.json は作らない

### キーワード+シソーラス
- enrich プロンプトに keywords フィールドを追加
- AI がエントリごとにシソーラス付きキーワード配列を生成
- 例: `["auth", "認証", "session", "login", "authentication"]`
- analysis.json のエントリに `keywords` として保存

### 検索方式
- 静的キーワードマッチ（AI 不使用）
- keywords 配列の部分文字列マッチ（大文字小文字無視）
- シソーラスはインデックス作成時に事前定義済み

### CLI
- `sdd-forge flow get context --search "keyword"` として既存コマンドに統合
- マッチしたエントリの file + summary + detail を返す
- `--raw` でプレーンテキスト、なしで JSON envelope

- [x] User approved this draft (2026-03-31)
