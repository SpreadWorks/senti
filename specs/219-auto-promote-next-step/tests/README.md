# Tests for 219-auto-promote-next-step

## What is tested
- `FlowStore.updateStepStatus` の auto-promote 挙動（REQ-1, REQ-2）
- `flow get next-action` の NO_IN_PROGRESS_STEP 時フォールバック（REQ-3）

これらは flow の公開コントラクトに属するため、formal test (`tests/`) に配置する。

## Test locations
- `tests/unit/flow.test.js`
  - `updateStepStatus auto-promotes first pending when transitioning to done (REQ-1)`
  - `updateStepStatus skips over already-done/skipped steps when promoting (REQ-1)`
  - `updateStepStatus does NOT promote when another step is already in_progress (REQ-2)`
  - `updateStepStatus does NOT promote on non-done transitions (REQ-2)`
  - `updateStepStatus does nothing when no pending steps remain (REQ-1 edge)`
- `tests/unit/flow/get-next-action.test.js`
  - `NO_IN_PROGRESS_STEP auto-recovery (spec 219 / REQ-3) > promotes first pending step when no in_progress exists, then returns envelope`
  - `NO_IN_PROGRESS_STEP auto-recovery (spec 219 / REQ-3) > still errors NO_IN_PROGRESS_STEP when every step is done/skipped`

## How to run
```bash
npm test                                        # 全テスト
node --test tests/unit/flow.test.js             # flow-store 側
node --test tests/unit/flow/get-next-action.test.js  # get-next-action 側
```

## Expected results
実装後は全テスト pass。実装前は上記 REQ-1 / REQ-3 のうち 3 ケースが fail する（test-first でベースライン確認済み）。
