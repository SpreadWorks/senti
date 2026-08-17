# Draft: deep モード用ソースコード minify

## Issue
#28: Introduce source code minification for deep mode (generic + language-specific)

## 要件

### アーキテクチャ
- `src/docs/lib/minify.js` に共通ユーティリティ関数 + 拡張子→minify関数マッピングを集約
- クラス継承は使わず、関数合成で言語別 minifier を構成

### 2層構造（パイプライン方式）
1. **汎用 minify**（全拡張子共通）: 空行除去、末尾空白除去
2. **言語別 minify**（拡張子マッピングで適用）: コメント除去、インデント正規化

### 拡張子マッピング
| 拡張子 | 処理内容 |
|--------|----------|
| `.js`, `.ts`, `.mjs`, `.cjs`, `.jsx`, `.tsx` | `//` コメント除去、`/* */` 除去、インデント正規化 (4→2) |
| `.php` | `//` コメント除去、`/* */` 除去、`#` コメント除去 |
| `.py` | `#` コメント除去。インデント正規化スキップ |
| `.yaml`, `.yml` | `#` コメント除去。インデント正規化スキップ |
| その他 | 汎用のみ（空行除去・末尾空白除去） |

### 適用タイミング
- `text-prompts.js` の `getEnrichedContext()` 内
- 順序: `fs.readFileSync → minify(code, filePath) → 8000文字 truncate`

### 制御
- deep モードでは常に minify 適用。on/off オプションなし

### 注意事項
- URL 内の `//` を誤ってコメントとして除去しない（`(?<!:)//` パターン）
- 文字列リテラル内の誤検出は許容（ドキュメント生成用コンテキストなので致命的でない）

## スコープ外
- スケルトン化（関数ボディ除去）→ ボード 5513 の一環として別途対応
- JSDoc/PHPDoc 保持オプション → 将来追加可能

## 既存機能への影響
- `getEnrichedContext()` の deep モード処理にのみ影響
- light モードには影響なし
- 既存の CLI インターフェースに変更なし

- [x] User approved this draft (2026-03-30)
