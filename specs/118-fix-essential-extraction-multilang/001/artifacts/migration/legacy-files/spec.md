# Feature Specification: 118-fix-essential-extraction-multilang

**Feature Branch**: `feature/118-fix-essential-extraction-multilang`
**Created**: 2026-04-02
**Status**: Draft
**Input**: Essential 抽出が JS 専用で PHP プロジェクトの enrich が 0 件になるバグ

## Goal
Essential 抽出を lang ハンドラに委譲し、JS/PHP/Python それぞれの言語に最適な抽出を実装する。minify.js から言語固有パターンを除去し、ディスパッチャに徹する設計にする。

## Scope
- `src/docs/lib/lang/js.js` に `extractEssential(code)` ��追加
- `src/docs/lib/lang/php.js` に `extractEssential(code)` を追加
- `src/docs/lib/lang/py.js` に `extractEssential(code)` を追加
- `src/docs/lib/minify.js` から `extractEssential` 関数を削除し、`handler.extractEssential` へのディスパッチに変更

## Out of Scope
- `yaml.js` への `extractEssential` 追加（YAML はデータファイルであり Essential 抽出不要）
- 新しい言語ハンドラの追加
- enrich のバッチ分割ロジックの変更

## Clarifications (Q&A)
- Q: handler.extractEssential がない場合はどうなるか？
  - A: 通常の minify（コメント削除）にフォールバック。情報は保持される。
- Q: 先ほどのコミット（minify.js への PHP/Python パターン直書き + 5% フォールバック）はどうなるか？
  - A: 削除する。PHP/Python パターンは各 lang ハンドラに移動し、5% フォールバックは lang ハンドラ方式で不要になる。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: 承認済み

## Requirements
1. [P0] `src/docs/lib/lang/js.js` に `extractEssential(code)` を export する。import 文、export 文、function/class 宣言、UPPER_CASE 定数定義、return 文、throw 文、await/new 文、主要 API 呼び出し（fs.*, path.*, JSON.*, process.*, child_process）を残し、それ以外の行を削除する
2. [P0] `src/docs/lib/lang/php.js` に `extractEssential(code)` を export する。require/require_once/include/include_once 文、use 文、namespace 文、function 宣言（public/protected/private/static/abstract 修飾子付き含む）、class/interface/trait 宣言、return 文、throw 文、new 文を残す
3. [P0] `src/docs/lib/lang/py.js` に `extractEssential(code)` を export する。from...import/import 文、def 宣言、class 宣言、return 文、raise 文、yield 文を��す
4. [P0] `src/docs/lib/minify.js` の `mode: "essential"` 処理を変更する。`extractEssential` 関数を削除し、代わりに `handler.extractEssential` があればそれを呼び、なければ通常の minify 処理にフォールバックする
5. [P1] 先ほどのコミット（minify.js への PHP/Python パターン直書き + 5% sparse フォールバック）のコードを削除する（要件 4 で自動的に達成される）

## Impact on Existing Code
- `src/docs/lib/lang/js.js`: `extractEssential` メソッド追加。既存の parse/minify/extractImports/extractExports に影響なし
- `src/docs/lib/lang/php.js`: 同上
- `src/docs/lib/lang/py.js`: ��上
- `src/docs/lib/minify.js`: `extractEssential` 関数削除、`mode: "essential"` のディスパッチロジック変更。`mode` なしの既存動作は変更なし
- `src/docs/lib/lang-factory.js`: 変更なし（extractEssential は handler のメソッドとして自動的に公開される）
- `tests/unit/docs/lib/minify.test.js`: Essential モードのテストが lang ハンドラ経由で動作するよう更新が���要

## Acceptance Criteria
- JS ファイルに対して `minify(code, "file.js", { mode: "essential" })` が import/export/return/throw 等を残すこと
- PHP ファイルに対して `minify(code, "file.php", { mode: "essential" })` が require/use/namespace/function/class/return/throw 等を残すこと
- Python ファイルに対して `minify(code, "file.py", { mode: "essential" })` が import/def/class/return/raise 等を残すこと
- YAML ファイルに対して `minify(code, "file.yaml", { mode: "essential" })` が通常の minify にフォールバックすること
- lang ハンドラがない拡張子に対して通常の minify にフォールバックすること
- `npm test` が全件 PASS すること

## Open Questions
- [ ]
