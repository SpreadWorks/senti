# [ENHANCE] [DOCS] Add format parameter to {{data}} directive to allow specifying output format

## Reconfirmation Notes (2026-05-20)

This ticket is old, but after reviewing the current presets/templates and generated output, the problem statement remains valid. However, implementing the original "generically transform any Renderable on the directive side" approach would be too broad.

## Current State

- `{{data(...)}}` appears 180 times across `src/presets/**/templates/**/*.md`.
- Occurrences with explicit table labels: 2-column 48, 3-column 58, 4-column 19, 5-column 6.
- 2-column candidates include: chapter lists, command lists, auth config, Controller-Action, Model/Entity relations, Controller dependencies, etc.
- `src/docs/lib/directive-parser.js` currently recognizes only `labels`, `header`, `footer`, and `ignoreError` as parser-owned options. `format` does not exist; if specified, it flows through as `params.format` to the DataSource side.
- `src/docs/lib/renderable.js` defines `Table`, `BulletList`, `OrderedList`, `Paragraph`, `Blockquote`, `Heading`, and `Fragment`; the Renderable type system itself is well established.
- DataSources still primarily return `Table` via `toMarkdownTable(...)`, but `Paragraph` and `Blockquote` are also used, so the old ticket's premise that "Table is almost the only type used" is partially outdated.

## Generated Output Review

Temporarily ran scan → init → data → readme without AI on acceptance fixtures and reviewed the generated Markdown tables.

- `base`: 0 tables
- `cli`: 1 table, 2-column only (README chapter list)
- `node-cli`: 1 table, 2-column only (README chapter list)
- `library`: 1 table, 2-column only (README chapter list)
- `js-webapp` / `webapp` / `php-webapp`: 1 table, 2-column only (README chapter list)
- `cakephp2`: 20 tables (2-col 9, 3-col 9, 4-col 1, 5-col 1)
- `laravel`: 14 tables (2-col 5, 3-col 8, 4-col 1)
- `symfony`: 14 tables (2-col 8, 3-col 5, 5-col 1)

Specific output examples where list rendering may be preferable:

- Laravel `docs/controller_routes.md`: `Controller | Action` with 21 rows. A grouped list may be more readable.
- Symfony `docs/controller_routes.md`: `Controller | Action` with 15 rows, `Controller | Dependency Service` with 6 rows. Grouped list candidates.
- Laravel/Symfony/CakePHP2 `Model/Entity | Relations` are 2-column, but bullet/definition list format may be more natural for expressing relationships.
- README `Chapter | Summary` appears fine as-is with the current table format.

## Decision

This is a valid task. However, rather than implementing a "generic format parameter," the scope should first be narrowed to display improvements for 2-column `Table`.

## Recommended Scope

1. When considering `{{data(..., {format: "table" | "list"})}}`, initially limit the target to `Table` with exactly 2 columns.
2. `table` is the default value, maintaining backward compatibility.
3. `list` converts a 2-column Table to a Markdown bullet list or definition-list equivalent.
4. Tables with 3+ columns, `Paragraph`, `Blockquote`, `CodeBlock`, etc. are out of scope. If `format` is specified for these, output an explicit error or unsupported warning.
5. Data where the same first-column value repeats consecutively (e.g., Controller-Action) may require a group format rather than a simple list. This could be extracted as a separate issue under `format: "grouped-list"`.
6. In the implementation, add `format` as a parser-owned option in the directive parser and do not pass it to DataSource. Place the transformation responsibility in the Renderable type/method (e.g., `Table`).
7. Add unit tests for directive parser/data expansion and Renderable transformation.

## Priority

If converting to a Todo, first select one specific table in a preset to target for list/grouped-list format. Currently valid as an Idea. Rather than closing, the appropriate action is to narrow the spec and re-file/redefine.

<details>
<summary>ja</summary>

[ENHANCE] [DOCS]{{data}} ディレクティブに format パラメータを追加して出力形式を指定可能にする

# [ENHANCE] [DOCS] {{data}} ディレクティブに format パラメータを追加して出力形式を指定可能にする

## 再確認メモ（2026-05-20）

この記票は古いが、現状の presets/templates と生成後の出力を確認した結果、問題意識はまだ有効。ただし、元の「任意の Renderable を directive 側で汎用変換する」案のまま実装するのは広すぎる。

## 現状確認

- `src/presets/**/templates/**/*.md` の `{{data(...)}}` は 180 件。
- 明示的な表ラベルを持つものは、2列 48 件、3列 58 件、4列 19 件、5列 6 件。
- 2列の候補には、章一覧、コマンド一覧、認証設定、Controller-Action、Model/Entity relations、Controller dependency などがある。
- `src/docs/lib/directive-parser.js` は現状 `labels`, `header`, `footer`, `ignoreError` だけを parser-owned option として扱う。`format` は存在せず、指定しても DataSource 側の `params.format` として流れるだけ。
- `src/docs/lib/renderable.js` には `Table`, `BulletList`, `OrderedList`, `Paragraph`, `Blockquote`, `Heading`, `Fragment` があり、Renderable 型自体は整備済み。
- DataSource は依然として `toMarkdownTable(...)` による `Table` 返却が中心。ただし `Paragraph` や `Blockquote` の利用もあり、古い記票の「Table 以外はほぼ未使用」という前提は一部古い。

## 生成後出力の確認

acceptance fixture を AI なしで scan → init → data → readme まで一時実行し、生成 Markdown の表を確認した。

- `base`: 表 0 件
- `cli`: 表 1 件、2列のみ（README 章一覧）
- `node-cli`: 表 1 件、2列のみ（README 章一覧）
- `library`: 表 1 件、2列のみ（README 章一覧）
- `js-webapp` / `webapp` / `php-webapp`: 表 1 件、2列のみ（README 章一覧）
- `cakephp2`: 表 20 件（2列 9、3列 9、4列 1、5列 1）
- `laravel`: 表 14 件（2列 5、3列 8、4列 1）
- `symfony`: 表 14 件（2列 8、3列 5、5列 1）

具体的にリスト表示の余地がある出力例:

- Laravel `docs/controller_routes.md`: `Controller | Action` が 21 行。グループ化リストのほうが読みやすい可能性がある。
- Symfony `docs/controller_routes.md`: `Controller | Action` が 15 行、`Controller | Dependency Service` が 6 行。グループ化リスト候補。
- Laravel/Symfony/CakePHP2 の `Model/Entity | Relations` は 2列だが、関係の説明としては bullet/definition list のほうが自然な可能性がある。
- README の `Chapter | Summary` は現状の表で問題なさそう。

## 判断

有効なタスクではある。ただし「汎用 format パラメータ」ではなく、まずは 2列 `Table` の表示改善として狭めるべき。

## 推奨スコープ

1. `{{data(..., {format: "table" | "list"})}}` を検討する場合、対象はまず `Table` かつ 2列に限定する。
2. `table` は既定値として現状互換。
3. `list` は 2列 Table を Markdown bullet list または definition-list 相当の表現へ変換する。
4. 3列以上の Table、`Paragraph`、`Blockquote`、`CodeBlock` などは対象外。指定された場合は明示エラーまたは未対応警告にする。
5. Controller-Action のように同じ1列目が連続するデータは、単純 list ではなく group format が必要かもしれない。これは `format: "grouped-list"` の別課題として切り出す判断もあり。
6. 実装時は directive parser 側で `format` を parser-owned option に追加し、DataSource へ渡さないようにする。変換責務は `Table` など Renderable 側の型/メソッドに寄せる。
7. tests は directive parser/data expansion と Renderable 変換のユニットテストを追加する。

## 優先度

Todo 化するなら、先に「どの preset のどの表を list/grouped-list にしたいか」を1つ選ぶべき。現時点では Ideas として有効。close ではなく、仕様を狭めて再起票/再定義するのが妥当。

</details>