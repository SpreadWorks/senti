# Tests for spec 182-metrics-finalized-at

## Overview

本 spec の要件 R1〜R5 を検証するテストは `tests/` 配下（公式テスト）に配置している。
「将来変更で壊れた場合は常にバグ」に該当するため、一時テストではなく本体テストとしてメンテナンスする。

## Test Files

- `tests/unit/flow/finalize-writes-finalized-at.test.js` — R1（`flow finalize` が `state.finalizedAt` を書き込む）
- `tests/e2e/metrics/token-finalized-at.test.js` — R2, R3, R4, R5
  - R2: `metrics token` が `state.finalizedAt` を日付軸に使う
  - R3: `state.finalizedAt` 欠損 spec を除外し警告ログを出す
  - R4/R5: キャッシュの `maxFinalizedAt` ベース無効化

R6（本 spec finalize 時の一度きり backfill）は `sdd-forge flow run finalize` 実行時の実動作で検証されるため、ユニットテストは不要。

R7/R8 は backfill スクリプト・既存 fixture 更新に伴う付帯要件で、R1〜R5 のテストが成功することが結果的な検証となる。

## Running

```bash
npm test
# or scoped:
node tests/run.js --scope unit
node tests/run.js --scope e2e
```

## Expected

実装前はすべて失敗する（TDD）。実装完了時に全テスト pass。
