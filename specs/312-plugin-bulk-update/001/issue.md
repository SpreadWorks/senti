## Background

We want to make the UX of `senti plugin update` closer to npm / pnpm-style `update [name]`. Rather than adding a separate command like `update-all`, running it without arguments should be treated as "checking all installed plugins for update candidates, then performing a bulk update after explicit approval."

## Goal

- `senti plugin update` can check all installed plugins for update candidates
- When run without arguments, a confirmation prompt is required before any actual updates are performed
- `senti plugin update <name>` continues to update a single plugin as before, and does not show the bulk update confirmation

## Expected Behavior

### `senti plugin update`

- Lists update candidates for installed plugins
- Shows a confirmation equivalent to `Update all installed plugins? [y/N]` before performing updates
- Updates all plugins only if `y` or `yes` is entered
- Does not update if the input is `Enter`, `n`, `no`, or anything else

### `senti plugin update <name>`

- Updates only the specified plugin
- Does not show the confirmation prompt for updating all plugins

## Out of Scope

- Interactive selection UI
- Dry run
- Adding an `--all` option
- Advanced ways to specify a detailed subset of update targets
- Adding a new command equivalent to `update-all`

## Acceptance Criteria

- `senti plugin update` without arguments displays update candidates for all plugins
- `senti plugin update` without arguments performs the bulk update only when `y` / `yes` is entered at the confirmation prompt
- `senti plugin update` without arguments does not perform updates when `Enter` or `n` / `no` is entered
- `senti plugin update <name>` updates only the specified plugin
- `senti plugin update <name>` does not display the confirmation for updating all plugins
- No separate command is added solely for bulk updates

<details>
<summary>ja</summary>

senti plugin update の引数なし全件更新確認を追加

## 背景

`senti plugin update` の UX を npm / pnpm 系の `update [name]` に近づけたい。`update-all` のような別コマンドは増やさず、引数なし実行を「全件更新候補の確認と、明示的な承認後の一括更新」として扱う。

## 目的

- `senti plugin update` は、インストール済み plugin 全件を対象に更新候補を確認できる
- 引数なし実行では、実際の更新前に確認プロンプトを必須にする
- `senti plugin update <name>` は従来どおり単一 plugin 更新として扱い、一括更新確認は出さない

## 期待する挙動

### `senti plugin update`

- インストール済み plugin の更新候補を一覧表示する
- 更新実行前に `Update all installed plugins? [y/N]` 相当の確認を出す
- `y` または `yes` を入力した場合のみ、全 plugin を更新する
- `Enter`、`n`、`no`、またはそれ以外の入力では更新しない

### `senti plugin update <name>`

- 指定した plugin のみ更新する
- 全件更新用の確認プロンプトは出さない

## スコープ外

- interactive な選択 UI
- dry-run
- `--all` オプションの追加
- 更新対象を細かく選ぶ高機能な指定方法
- `update-all` 相当の新規コマンド追加

## 受け入れ条件

- 引数なしの `senti plugin update` で、全件の更新候補が表示される
- 引数なしの `senti plugin update` は、確認プロンプトで `y` / `yes` が入力された場合のみ全件更新を実行する
- 引数なしの `senti plugin update` は、`Enter` または `n` / `no` の場合は更新を実行しない
- `senti plugin update <name>` は指定 plugin のみ更新する
- `senti plugin update <name>` では全件更新確認を表示しない
- 一括更新のためだけの別コマンドは追加しない

</details>