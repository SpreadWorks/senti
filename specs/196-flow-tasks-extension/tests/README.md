# Tests for spec 196-flow-tasks-extension

このディレクトリは spec 196（cac6/T2）のテストポリシーを記述する。実テストは **正式テスト**（公開 API 契約のため）として `tests/unit/lib/` に配置している。

## What is tested

cac6/T2 の以下を検証する:

- `FlowManager` の task 操作 API（`addTask`, `completeTask`, `getCurrentTask`, `getCurrentTaskStep`, `setCurrentTaskStep`）
- 既存 mutator（`addNote` 等）の scope 推論・明示引数
- 旧形式 flow.json を load した際の strict throw
- `flow-helpers.js` の `buildInitialTaskSteps(origin)` と `derivePhase(state)` の 2 系統動作

## Where tests live

- `tests/unit/lib/flow-manager-tasks.test.js`
- `tests/unit/lib/flow-helpers-tasks.test.js`

正式テストとして配置した理由: FlowManager / FlowStore / flow-helpers は本プロジェクトの公開 API 契約に該当する。これらの API が将来破壊された場合、常に regression として扱うべきであり、spec 固有テストではなく恒久テストとして保持する。

## How to run

```bash
npm test -- --scope unit
# または対象のみ:
node tests/run.js --scope unit --filter "flow-manager-tasks|flow-helpers-tasks"
```

## Expected results

実装完了後（全 REQ を満たした時点）:

- 上記 2 ファイルの全テストが PASS
- 既存テスト（`tests/unit/` 配下全て）の全 PASS を維持

test-first サイクル中（spec の test phase 完了〜impl phase 着手時点）:

- 上記 2 ファイルは **意図的に FAIL** する（API 未実装）
- 既存テストは全 PASS のまま
