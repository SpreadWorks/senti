# Tests for 164-flow-metrics-recording

## What was tested and why

| テスト | 目的 | 対象要件 |
|---|---|---|
| `tests/unit/lib/flow-state-agent-metrics.test.js` | `accumulateAgentMetrics()` 関数の単体テスト | R1-1〜R1-4 |
| `tests/unit/flow/commands/report-metrics.test.js` | report コマンドへのトークン/コスト表示追加 | R3-1, R3-2 |
| `specs/164-flow-metrics-recording/tests/backfill.test.js` | バックフィルスクリプトのフィクスチャテスト | R2-1〜R2-6 |

## Test locations

### Formal tests (run by `npm test`)
- `tests/unit/lib/flow-state-agent-metrics.test.js` — 公開 API の契約テスト。将来の変更でこのテストが壊れたら常にバグ
- `tests/unit/flow/commands/report-metrics.test.js` — report コマンドの挙動仕様テスト

### Spec verification tests (spec-local, NOT run by `npm test`)
- `specs/164-flow-metrics-recording/tests/backfill.test.js` — バックフィルスクリプトのワンタイム検証

## How to run

```bash
# Formal tests (P1, P3)
npm test -- --scope unit

# Backfill script spec test (P2) — after script is implemented
node specs/164-flow-metrics-recording/tests/backfill.test.js
```

## Expected results

- P1: `accumulateAgentMetrics()` 実装後、全テストが PASS
- P2: バックフィルスクリプト実装後、フィクスチャから正しく flow.json に書き込まれることを確認
- P3: `generateReport()` / `formatText()` 更新後、トークン数・callCount が出力に含まれ、コストが null の場合は `N/A` が表示されることを確認
