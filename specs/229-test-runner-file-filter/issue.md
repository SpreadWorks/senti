## Background

`tests/run.js` currently only accepts the following flags:
- `--preset <name>`: filter by preset
- `--scope <unit|e2e>`: filter by scope
- `--agent`: enable agent tests
- `--all`: run all tests

**There is no way to specify individual test files.** This is inconvenient when you want to run only a newly added test or iterate on a specific failing test. The current workaround is to switch to `node --test tests/unit/flow/foo.test.js` directly, but doing so bypasses the label aggregation and preset consistency checks provided by `tests/run.js`.

## Expected Behavior

Accept any of the following:

- `--file <path>` — specify a single file (repeatable)
- `--pattern <glob>` — glob matching (e.g. `--pattern 'tests/unit/flow/auto-check-*'`)
- Trailing positional arguments — additional file/directory specifications

Mutual exclusion rules with existing flags (`--preset`, `--scope`) should be handled consistently.

## Related Code

- `tests/run.js` (argument parsing, `findTestFiles`, `groupTestFilesByCategory`)
- `tests/helpers/test-runner-search-dirs.js` (`buildSearchDirs`, `validateFlags`)

## Impact

Medium. This is a missing feature that degrades UX and slows iteration speed when adding new tests. The issue was encountered in practice during spec 220 development.

<details>
<summary>ja</summary>

[ENHANCE] tests/run.js にテストファイル/パターン絞り込みフラグを追加

## 背景

`tests/run.js` は現状、以下のフラグしか受理しない:
- `--preset <name>`: preset 単位
- `--scope <unit|e2e>`: スコープ単位
- `--agent`: agent テスト有効化
- `--all`: 全テスト

**個別テストファイルを指定する手段がない。** 新規テストだけ実行したい・失敗箇所を絞って反復したいシーンで不便。現状は `node --test tests/unit/flow/foo.test.js` に直接切り替える必要があるが、その場合 `tests/run.js` が提供する label 集計 / preset 整合チェック等を通らない。

## 期待動作

以下のいずれかを受理:

- `--file <path>` … 単一ファイル指定 (複数回指定可)
- `--pattern <glob>` … glob マッチ (例: `--pattern 'tests/unit/flow/auto-check-*'`)
- 末尾 positional 引数 … ファイル/ディレクトリの追加指定

他の既存フラグ (`--preset`, `--scope`) との相互排他ルールは整合を取る。

## 関連コード

- `tests/run.js` (引数パース, `findTestFiles`, `groupTestFilesByCategory`)
- `tests/helpers/test-runner-search-dirs.js` (`buildSearchDirs`, `validateFlags`)

## 影響度

中。機能不足による UX 低下で、新規テスト追加のイテレーション速度を下げる。spec 220 開発中に実際に発生した。

</details>