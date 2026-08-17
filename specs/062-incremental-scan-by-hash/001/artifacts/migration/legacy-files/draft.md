# Draft: Incremental Scan by Hash

## 要件サマリー

analysis.json のエントリーに含まれる `hash` フィールドを使い、ファイルハッシュ比較で変更されたファイルだけを処理する差分スキャン機能を追加する。

## スコープ

全レイヤー（scan + enrich + text）を差分化する。

### scan

- `analysis.json` が存在する場合、デフォルトで差分モード
- 既存 analysis.json から `hash → file` マッピングを構築
- 対象ファイルのハッシュを計算し、変更・新規ファイルだけ DataSource の `scan()` に渡す
- 削除されたファイルは analysis.json から自動除外
- `analysis.json` が存在しない場合はフル実行（従来どおり）

### enrich

- ハッシュが変わったエントリー（= summary が消えたエントリー）だけ AI に投げる
- 既存のレジューム機能（`!e.enriched` フィルター）がそのまま活用できる
- scan の差分化により、変更エントリーの enrichment が消える → enrich が自動的に変更分だけ処理

### text

- 変更エントリーの `chapter` フィールドから影響する章ファイルを特定
- 影響章のディレクティブをクリアして再生成（最新ソースを反映）
- 影響のない章はスキップ

### build

- `sdd-forge docs build` もデフォルトで差分モード
- `--full` フラグは設けない（analysis.json を削除すればフル実行と同等）

## 決定事項

| 項目 | 決定 |
|------|------|
| 起動方法 | analysis.json 存在時はデフォルト差分 |
| 削除ファイル | analysis.json から自動除外 |
| build 統合 | build もデフォルト差分 |
| --full フラグ | 不要（analysis.json 削除で代用） |
| text 粒度 | 影響章のディレクティブをクリアして再生成 |

- [x] User approved this draft (2026-03-16)
