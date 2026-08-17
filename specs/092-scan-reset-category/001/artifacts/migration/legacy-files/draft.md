# Draft: scan --reset オプション

## 要件まとめ

### オプション名
- `--reset` （`--reset-category` や `--reset-hash` ではない）
- scan コマンドのコンテキストで「リセット」は直感的に伝わる

### 使い方
```
sdd-forge scan --reset                     # 全カテゴリリセット
sdd-forge scan --reset controllers         # 単一カテゴリ
sdd-forge scan --reset controllers,modules # 複数カテゴリ
```

### 動作
- analysis.json の指定カテゴリのエントリの hash を null に設定して保存
- scan 自体は実行しない（hash クリアのみ）
- enrich フィールド（summary/detail）はクリアしない（hash のみ）

### 引数解析
- `process.argv` で `--reset` の存在を検出し、値がなければ全カテゴリ扱い
- `parseArgs` の `options` として値を取得

### 出力
```
reset: controllers (12 entries)
reset: models (8 entries)
total: 20 entries reset in 2 categories
```

### エッジケース
- 存在しないカテゴリ: 警告を出して正常終了（他の有効カテゴリは処理する）
  ```
  warn: category "foobar" not found in analysis.json (skipped)
  ```
- analysis.json が存在しない: メッセージを出して正常終了
  ```
  no analysis.json found — nothing to reset
  ```

### 既存機能への影響
- なし。新規オプションの追加のみ
- 既存の `--stdout`, `--dry-run` フラグに影響しない

## Q&A ログ

1. **scan 続行?** → hash クリアのみ。build で scan も含めて再実行される
2. **オプション名?** → `--reset`（hash は実装詳細、category は引数なし時に不自然）
3. **引数省略の検出?** → `process.argv.includes("--reset")` で存在チェック
4. **出力?** → カテゴリ名と件数を表示
5. **存在しないカテゴリ?** → 警告して正常終了
6. **analysis.json なし?** → メッセージして正常終了
7. **enrich フィールド?** → クリアしない（hash のみ）。ただし scan 再パース時にエントリが丸ごと置き換わるため、結果的に enrich も再実行される
8. **enrich.processedAt** → enrich のスキップ判定は `!!enrich?.processedAt` で行われている（summary ではない）
9. **正規化レイヤー** → 別スコープ（ボード 83f6）。analysis.json のスキーマ変更時にデータ移行を自動化する仕組み

- [x] User approved this draft (2026-03-27)
