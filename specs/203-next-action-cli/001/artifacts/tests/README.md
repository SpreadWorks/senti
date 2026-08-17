# Tests: 203-next-action-cli

## What was tested and why

`sdd-forge flow get next-action` は cac6/T5 で新設した skill 薄化のための CLI ハブである。
公開 CLI 契約であり将来の変更で壊れた場合は常にバグなので、正式テスト（`tests/unit/`）として長期維持する。

## Test location

- `tests/unit/flow/get-next-action.test.js`

本 spec 固有のテストは作成していない（契約テストのみで要件を網羅できるため）。

## Coverage

spec 203 の全要件 (REQ-1〜REQ-11) を以下の観点でカバー:

| 観点 | テストスイート |
| --- | --- |
| envelope 7 フィールド (REQ-1) | `envelope shape (REQ-1)` |
| active flow 無しのエラー (REQ-2) | `active flow missing (REQ-2)` |
| current task 対象 (REQ-3) | `task-level target (REQ-3)` |
| flow レベルフォールバック (REQ-4) | `flow-level fallback (REQ-4)` |
| approval 3 点 (REQ-5) | `approval points (REQ-5)` |
| context 記述子の型 (REQ-6, REQ-7) | `context descriptor (REQ-7)` |
| output_schema がインライン JSON Schema (REQ-8, REQ-10) | `output_schema (REQ-8, REQ-10)` |
| ルール未定義 step のエラー (REQ-9, REQ-11 の裏付け) | `rule missing (REQ-9)` |
| plan 由来・addition 由来 task step の網羅 | `task step coverage` |
| instructions が識別子であること | `instructions identifier` |

## How to run

```bash
npm test -- tests/unit/flow/get-next-action.test.js
```

または単独実行:

```bash
node --test tests/unit/flow/get-next-action.test.js
```

フルスイート実行:

```bash
node tests/run.js
```

## Expected results

- 全 16 ケース PASS (exit code 0)
- 既存 1748 ユニットテスト + 265 統合テストに影響なし
