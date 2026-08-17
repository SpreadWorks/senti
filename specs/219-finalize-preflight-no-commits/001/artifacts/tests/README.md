# Tests for spec 219-finalize-preflight-no-commits

## What was tested and why
spec 219 で finalize preflight の判定ロジックを更新するため、`runPreflightChecks` の挙動を 2 軸 × 4 ケースで網羅した:
- commitStepActive=true: 真の no-op (ahead==0 && uncommitted==0) のみ fail
- commitStepActive=false: ahead==0 → no-commits、uncommitted>0 → dirty-worktree
- spec-only モード: 両軸とも skip

## Where tests are located
formal tests (`tests/`)。preflight の挙動は spec 219 起源だが、将来の変更で破れたら常にバグなので formal 配下に配置:
- `tests/unit/flow/run-finalize-early-stop.test.js`

## How to run
```
node tests/run.js tests/unit/flow/run-finalize-early-stop.test.js
```

または `npm test` で全体実行。

## Expected results
全テスト PASS。実装変更後に baseline と同等以上の結果になることを `flow run gate --phase task-impl` で確認する。
