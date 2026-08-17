# Draft: generate-mode-multilang

## 要件整理

### 現状
- `mode: generate` は `src/docs.js` に基本実装あり（156-172行）
- 各非デフォルト言語に対して `init → data → text → readme` を逐次実行
- テストカバレッジなし
- forge コマンドは generate モード未対応

### 方針
- generate モードの不足部分を実装し正しく動作するようにする
- 言語ループは逐次のまま（text 内部の既存並列化に任せる）
- 実際にドキュメントを生成し translate モードとの品質を比較する
  - diff: translate 版と generate 版の差分を取る
  - review: `sdd-forge review` で品質チェック
  - AI 見解: 品質・自然さ・正確さについてコメント

- [x] User approved this draft (2026-03-15)
