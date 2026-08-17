# Feature Specification: 108-mechanical-extraction-of-structural-info-and-fac

**Feature Branch**: `feature/108-mechanical-extraction-of-structural-info-and-fac`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #38

## Goal

言語ごとの処理（parse, minify, imports/exports 抽出）を Factory パターンで統合し、scan 時に構造情報（imports, exports, usedBy, extends）を機械的に抽出して analysis.json に追加する。

## Scope

1. `src/docs/lib/lang/` に言語ハンドラを配置し、`lang-factory.js` で拡張子からハンドラを取得する Factory を実装
2. 既存の `scanner.js` の `parseJSFile`/`parsePHPFile` と `minify.js` の言語別処理を `lang/` に移動
3. JS/PHP の `extractImports`/`extractExports` を実装
4. scan 完了後に全 entry の imports を逆引きして `usedBy` を算出
5. `src/AGENTS.md` に言語ハンドラの開発方法を記載

## Out of Scope

- enrich の廃止（enrich はそのまま残す）
- Python/YAML の imports/exports 抽出（minify のみ移行）
- `flow get context` の出力フォーマット変更（#34 で対応済み）
- 他のプリセット固有の Entry クラスへの構造情報追加（各プリセットの parse で言語ハンドラを呼べば自然に対応可能）

## Clarifications (Q&A)

- Q: usedBy はいつ算出するか？
  - A: scan.js のファイルループ完了後に、全 entry の imports を走査して逆引き。hook 機構は不要。
- Q: Factory 化で既存の scanner.js/minify.js の呼び出し元に影響はあるか？
  - A: scanner.js の `parseFile()` と minify.js の `minify()` のインターフェースは維持する。内部で lang-factory を使うようにリファクタするだけ。
- Q: enrich を廃止するか？
  - A: しない。構造情報は enrich の入力品質を上げる効果がある。enrich は AI でしか判断できない情報（summary, chapter, role）を担当する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: Draft Q&A で全論点を解決済み。Factory パターン + 構造情報抽出 + AGENTS.md 更新。

## Requirements

**Priority 1 — Factory パターン導入とリファクタ**

1. When `src/docs/lib/lang-factory.js` is loaded, it shall export a `getLangHandler(filePath)` function that returns a language handler object based on file extension, or `null` for unsupported extensions.
2. When a language handler for JS (`.js`, `.mjs`, `.cjs`, `.jsx`, `.tsx`, `.ts`) is requested, it shall return an object with methods: `parse(content, filePath)`, `minify(content)`, `extractImports(content)`, `extractExports(content)`.
3. When a language handler for PHP (`.php`) is requested, it shall return an object with methods: `parse(content, filePath)`, `minify(content)`, `extractImports(content)`, `extractExports(content)`.
4. When a language handler for Python (`.py`) or YAML (`.yaml`, `.yml`) is requested, it shall return an object with only `minify(content)` (no parse/extract methods).
5. When `scanner.js` `parseFile()` is called, it shall use `getLangHandler()` internally instead of the current if-else dispatch. The external interface (`parseFile(filePath, lang)`) shall remain unchanged.
6. When `minify.js` `minify()` is called, it shall use `getLangHandler()` internally instead of `LANG_MINIFIERS`. The external interface (`minify(code, filePath)`) shall remain unchanged.

**Priority 2 — 構造情報の抽出**

7. When JS handler's `extractImports(content)` is called, it shall extract all `import ... from "..."` and `require("...")` statements and return an array of relative paths.
8. When JS handler's `extractExports(content)` is called, it shall extract all `export function`, `export class`, `export default`, and `export { ... }` statements and return an array of exported names.
9. When PHP handler's `extractImports(content)` is called, it shall extract `use` statements and `require_once`/`include_once` paths and return an array.
10. When PHP handler's `extractExports(content)` is called, it shall extract class names and public function names and return an array.
11. When scan processes a file, it shall call `extractImports` and `extractExports` via the language handler and store the results in the entry's `imports` and `exports` fields. The `extends` field shall be populated from the parse result's `parentClass`.
12. When scan completes the file loop, it shall iterate all entries across all categories, build an imports-to-file reverse mapping, and populate each entry's `usedBy` field with the list of files that import it.

**Priority 3 — ドキュメント**

13. When `src/AGENTS.md` is updated, it shall include a section on language handler development: file placement (`src/docs/lib/lang/<ext>.js`), required interface (`parse`, `minify`, `extractImports`, `extractExports`), and how to register a new language in `lang-factory.js`.

## Acceptance Criteria

1. `getLangHandler("foo.js")` returns an object with `parse`, `minify`, `extractImports`, `extractExports` methods.
2. `getLangHandler("foo.php")` returns an object with `parse`, `minify`, `extractImports`, `extractExports` methods.
3. `getLangHandler("foo.py")` returns an object with `minify` only.
4. `getLangHandler("foo.txt")` returns `null`.
5. After scan, analysis.json entries for JS files contain `imports` (array of paths), `exports` (array of names), and `extends` (string or null).
6. After scan, analysis.json entries contain `usedBy` (array of file paths that import this file).
7. Existing `parseFile()` and `minify()` functions continue to work with unchanged external interfaces.
8. Existing scan and minify tests pass without modification.
9. `src/AGENTS.md` contains language handler development instructions.

## Open Questions

- [x] Should `extractImports` resolve relative paths to absolute paths? → No, store relative paths as written in the source. Resolution is the consumer's responsibility.
