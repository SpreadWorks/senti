# 212-agent-tests-split — test notes

## What was tested and why

- `tests/run.js` の `--agent` / `--all` フラグによる searchDirs 構築ロジック、および `--agent` と `--preset` / `--scope` の排他バリデーションを検証する。
- spec 212 の R1〜R5 に対応。R6 (CLAUDE.md 追記) はドキュメント検証のため、spec の Acceptance Criteria では grep で確認する運用とし、自動テストには含めない。

## Where tests are located

- `tests/unit/test-runner-flags.test.js` — formal test (future breakage = 常にバグ)。
  - ロジック層: `tests/helpers/test-runner-search-dirs.js` に切り出された純粋関数 `buildSearchDirs` / `validateFlags` を直接検証。
  - 統合: `node tests/run.js --agent --preset hono` を spawn して非ゼロ終了を確認。

## How to run

```bash
# 単独:
node --test tests/unit/test-runner-flags.test.js

# suite 経由 (R1 達成後):
npm test
```

## Expected results

- すべてのテストケースが pass すること。
- `tests/agent/report.test.js` は `npm test` のデフォルト実行に含まれないこと (R1)。
- `tests/run.js --agent --preset hono` は exit code != 0 かつ stderr に `--agent` を含むエラーメッセージを出力すること (R5)。

## Test-first status

- この README 作成時点では実装 (`tests/helpers/test-runner-search-dirs.js` および `tests/run.js` の refactor) が未着手のため、全ケース失敗を期待する状態 (test-first)。
