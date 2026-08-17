# Draft: scan パイプライン再設計

## Issue
#20 — be10: Redesign scan pipeline

## 決定事項

### DataSource インターフェース
- Scannable mixin を維持し、`match(file)/scan(files)` → `match(relPath)/parse(absPath)` に変更
- `summarize` メソッドは廃止。エントリクラスの `static summary` 定義 + 共通層自動集計に置き換え
- resolve 側メソッド（list, tree, actions 等）は DataSource にそのまま残す
- resolve 側の変更は `analysis[cat].entries` への読み替えのみ

### エントリ・サマリー
- 基底クラス名: `AnalysisEntry`（scan 限定でなく analysis 全体で使われるため）
- 配置: `src/docs/lib/analysis-entry.js`
- JSON 復元: `static restore(obj)` — `Object.assign(new this(), obj)` でサブクラス override 不要
- プロパティ初期値は全て null
- 空エントリ判定: 共通フィールド以外が全て null なら空（共通層で判定）
- サマリー: エントリクラスの `static summary` で集計定義を宣言的に記述。共通層が自動集計

### scan 処理フロー
- ファイル単位の hash スキップ（現在のカテゴリ単位から変更）
- hash 一致 → エントリごと保持（enrichment も含む）
- hash 不一致 → 再パース（enrichment なし）
- `parse(absPath)` のみ渡す。共通フィールドは共通層が設定
- 削除ファイルは自動除去（ファイルリストにないエントリを除去）

### analysis.json 構造
- `analysis[cat][cat]` → `analysis[cat].entries` に統一
- `_incrementalMeta` は廃止（差分再生成は別 spec）
- `preserveEnrichment` は廃止（hash スキップで自動保持）

### プリセット移行
- 全18プリセットの DataSource を新インターフェースに移行
- `scan/` ディレクトリのパーサーは DataSource の `parse` に統合し、`scan/` を削除
- 後段コマンド（enrich, text, data, init, agents, forge, readme, review 等）全て対応

### スコープ外
- upgrade コマンドでのプリセット変更検出 → ボード f314
- text 差分再生成の改善（prevChapter 方式）→ ボード a08a

- [x] User approved this draft (2026-03-24)
