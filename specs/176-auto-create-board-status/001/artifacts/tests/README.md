# Tests for spec 176-auto-create-board-status

## What is tested

ボードの status (`Ideas` / `Todo` 等) が事前に存在しない場合に自動作成するため、`experimental/workflow/lib/graphql.js` に追加する SingleSelect option 作成関数 (`addSingleSelectOption`) の構造的契約を検証する。

## Test location

正式テストとして `experimental/tests/workflow-graphql-option.test.js` に配置。
理由: `experimental/CLAUDE.md` のルールにより、`experimental/` 配下のコードをテストするファイルは `experimental/tests/` に置くことが必須。

## How to run

```bash
node --test experimental/tests/workflow-graphql-option.test.js
```

または既存テストをまとめて:

```bash
node --test experimental/tests/
```

注: `tests/run.js` の `--scope unit|e2e` には `experimental/tests/` は含まれない（プロジェクトの既存運用）。

## Expected results

実装完了後、両テストが PASS する:
- `addSingleSelectOption` 関数が export されている
- 引数を 3 個受け取る (`projectId`, `fieldId`, `optionName`)

## Coverage map (spec requirements)

- 要件 1（status not-found エラーの解消）の前提となる「option 作成手段」の存在を構造的に保証する
- 要件 2/3/4 は実 GitHub API 呼び出しを伴うため自動テストはせず、手動検証（Acceptance Criteria AC1-AC4）でカバーする
