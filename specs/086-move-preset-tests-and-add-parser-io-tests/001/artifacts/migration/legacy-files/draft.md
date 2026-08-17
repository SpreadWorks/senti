# Draft: 086-move-preset-tests-and-add-parser-io-tests

## Q&A Summary

### Q1: spec の分割
- 1つの spec でテスト再配置 + パーサー I/O テストをまとめる

### Q2: テスト再配置の対象
- laravel/, symfony/ 配下のプリセット固有テスト（8ファイル）のみ移動
- 横断テスト（preset-scan-integrity, preset-datasources 等）は tests/ に残す

### Q3: 移動先ディレクトリ構造
- unit/e2e のサブディレクトリを維持
  - src/presets/<name>/tests/unit/
  - src/presets/<name>/tests/e2e/

### Q4: npm test スクリプト
- 全スクリプト（test, test:unit, test:e2e）に src/presets を検索対象に追加
- `npm test -- --preset <name>` でプリセット毎のテスト実行（unit + e2e + 固有テスト）
- プリセット名はファイルシステムから動的に検証（ハードコード配列なし）

### Q5: パーサー I/O テストの対象
- 既存パーサー: laravel, symfony, cakephp2
- 新規プリセット: drizzle, workers, nextjs, hono, graphql（scan パーサー未実装）
  - テンプレート → DataSource → scan の順で不足分を作成
  - 親プリセットの汎用実装より固有実装が望ましい場合は置き換える

### Q6: cakephp2
- I/O テスト新規作成

### Q7: src/AGENTS.md への追記
1. プリセット作成手順ルール: テンプレート → DataSource → scan（トップダウン設計）
2. プリセットテストルール: tests/ 必須、I/O テスト必須、npm test -- --preset で実行

### Q8: import パス
- 相対パスを更新する

- [x] User approved this draft
- Confirmed at: 2026-03-22
