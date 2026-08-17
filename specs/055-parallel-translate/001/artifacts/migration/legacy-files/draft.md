# Draft: parallel-translate

## 要件整理

### 現状
- `translate.js` は言語→章ファイルの2重ループで逐次翻訳
- `mapWithConcurrency()` ユーティリティと `resolveConcurrency(config)` が既に存在

### 方針
- 言語×ファイル（章＋README）を全てフラット化して1つのタスクリストにする
- `mapWithConcurrency()` + `resolveConcurrency(config)` で既存パターン（forge.js, text.js）に従う
- dry-run / force / mtime チェックはフラット化前にフィルタ（現行と同じ挙動を維持）
- README.md も章ファイルと同じバッチに含める

- [x] User approved this draft (2026-03-15)
