# Test: 170-flow-runid-state-mgmt

## What was tested

runId ベースの flow 状態管理の各要件を検証する。

- **Req 1**: `flow set init` による `.active-flow.<runId>` の作成
- **Req 2**: `flow prepare` での runId の flow.json 保存
- **Req 3**: lifecycle フィールド（preparing / active）
- **Req 4**: `loadFlowState` の透過的移行（runId なし → 自動採番）
- **Req 5**: `flow get status` の runId 出力・runId 解決
- **Req 6**: stale `.active-flow.*` の TTL ベースクリーンアップ
- **Req 8**: preparing 状態での autoApprove = false
- **Req 9**: 複数 preparing ファイルの共存（競合ガード）

## Where tests are located

| ファイル | 種別 | 配置 |
|---|---|---|
| `tests/unit/lib/flow-state-runid.test.js` | 正式テスト（`npm test` で実行） | flow-state.js の公開関数テスト |
| `specs/170-flow-runid-state-mgmt/tests/flow-init-prepare.test.js` | spec 検証テスト | `flow set init` → `flow prepare` の統合フロー |

## How to run

```bash
# 正式テストのみ
node --test tests/unit/lib/flow-state-runid.test.js

# spec 検証テストのみ
node --test specs/170-flow-runid-state-mgmt/tests/flow-init-prepare.test.js

# 全テスト
npm test
```

## Expected results

実装前: 透過的移行テスト（Req 4）が失敗する。その他は成功。
実装後: 全テスト成功。
