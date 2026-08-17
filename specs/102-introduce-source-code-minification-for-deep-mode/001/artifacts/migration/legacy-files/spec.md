# Feature Specification: 102-introduce-source-code-minification-for-deep-mode

**Feature Branch**: `feature/102-introduce-source-code-minification-for-deep-mode`
**Created**: 2026-03-30
**Status**: Draft
**Input**: GitHub Issue #28

## Goal
deep モードでプロンプトに含めるソースコードを minify し、同じ 8000 文字枠内により多くの実質コードを含められるようにする。コメント・空行・インデントの正規化により、コメントが多いファイルで約 30% の削減を見込む。

## Scope
- `src/docs/lib/minify.js` の新規作成（共通ユーティリティ関数 + 拡張子→minify 関数マッピング）
- `src/docs/lib/text-prompts.js` の `getEnrichedContext()` に minify 呼び出しを追加
- JS/TS, PHP, Python, YAML の言語別 minify ルール

## Out of Scope
- スケルトン化（関数ボディ除去）— ボード 5513 の一環として別途対応
- JSDoc/PHPDoc 保持オプション — 将来追加可能
- minify の on/off 設定 — deep モードでは常に適用
- light モードへの影響

## Clarifications (Q&A)
- Q: minify ルールはプリセットに持たせるか？
  - A: いいえ。拡張子→minify 関数のマッピングで管理する。プリセットではなく `minify.js` に集約。
- Q: JS と TS は同じ処理で良いか？
  - A: はい。コメント構文・インデント規則が同一のため、同じ minify 関数を適用。
- Q: スケルトン化（関数の IO だけ残す）も含めるか？
  - A: 今回はスコープ外。ボード 5513（enrich 廃止の代替案）の一環として別途対応。
- Q: minify の on/off 制御は必要か？
  - A: 不要。deep モードでは常に適用。YAGNI、alpha 版ポリシー。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-30
- Notes: ドラフト Q&A 後、ユーザー承認済み

## Requirements

### R1: minify.js の作成（優先度: 1）
- `src/docs/lib/minify.js` を新規作成する
- 共通ユーティリティ関数を提供する:
  - `removeBlankLines(code)` — 空行を除去する
  - `removeTrailingWhitespace(code)` — 各行の末尾空白を除去する
  - `removeLineComments(code, pattern)` — 指定パターンの行コメントを除去する
  - `removeBlockComments(code)` — `/* */` 形式のブロックコメントを除去する
  - `normalizeIndent(code, from, to)` — インデント幅を変換する
- エントリポイント `minify(code, filePath)` を export する
  - 汎用 minify（空行除去・末尾空白除去）を全ファイルに適用
  - 拡張子に対応する言語別 minify があれば追加適用

### R2: 拡張子→minify 関数マッピング（優先度: 2）
- 以下のマッピングを実装する:

| 拡張子 | 処理 |
|--------|------|
| `.js`, `.ts`, `.mjs`, `.cjs`, `.jsx`, `.tsx` | `//` コメント除去（URL の `://` を誤除去しない `(?<!:)//` パターン）、`/* */` 除去、インデント正規化 (4 spaces → 2 spaces) |
| `.php` | `//` コメント除去（同上）、`/* */` 除去、`#` コメント除去（`#!` shebang 行は除外） |
| `.py` | `#` コメント除去（`#!` shebang 行は除外）、インデント正規化スキップ |
| `.yaml`, `.yml` | `#` コメント除去（`#!` shebang 行は除外）、インデント正規化スキップ |
| その他 | 汎用のみ（空行除去・末尾空白除去） |

### R3: text-prompts.js への統合（優先度: 3）
- `getEnrichedContext()` 内のソースコード読み込み処理を変更する
- 適用順序: `fs.readFileSync(absPath)` → `minify(code, filePath)` → 8000 文字 truncate
- minify は deep モードの場合のみ適用される（既存の `if (mode === "deep")` ブロック内）

### R4: URL 内 `//` の保護（優先度: 4）
- 行コメント除去で `//` を検出する際、`://` の一部である場合は除去しない
- `(?<!:)//` の lookbehind パターンを使用する

### R5: 文字列リテラル内の誤検出許容（優先度: 5）
- 行コメント除去・ブロックコメント除去を正規表現で行う場合、文字列リテラル内のコメント風テキスト（例: `const url = "http://example.com"` の `//`、`const msg = "/* not a comment */"` の `/* */`）が誤って除去されることがある
- minify の出力はドキュメント生成用の AI コンテキストであり、コード実行には使用しないため、この誤検出は許容する

## Acceptance Criteria
1. deep モードで生成されるプロンプト内のソースコードから、コメント・空行・末尾空白が除去されていること
2. JS/TS ファイルのインデントが 4 spaces → 2 spaces に正規化されていること
3. URL 内の `://` がコメントとして誤除去されないこと
4. Python/YAML ファイルのインデントが変更されないこと
5. マッピングにない拡張子のファイルでも汎用 minify（空行・末尾空白除去）が適用されること
6. light モードの動作に影響がないこと
7. 既存テストが引き続きパスすること

## Open Questions
- [x] `#` コメント除去で shebang 行（`#!/...`）を誤除去しないか → `#!` で始まる行は除去対象から除外する（R2 に反映済み）
