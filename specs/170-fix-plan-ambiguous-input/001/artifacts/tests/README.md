# Tests for spec 170-fix-plan-ambiguous-input

## What is tested

- R7: `get-prompt.js` から `plan.approach` プロンプト定義が削除されていること
- R8: SKILL.md の step ID リストから `approach` が削除されていること
- R1/R2/R3: SKILL.md に入力解釈確認ルールが含まれていること
- R6: SKILL.md に autoApprove 時のスキップ動作が記述されていること

## Where tests are located

- `specs/170-fix-plan-ambiguous-input/tests/verify-spec.test.js` — spec 検証テスト
- `tests/unit/flow/get-prompt.test.js` — 既存テスト（実装時に approach 関連を更新）

## How to run

```bash
node --test specs/170-fix-plan-ambiguous-input/tests/verify-spec.test.js
```

## Expected results

実装完了後、全 6 テストが PASS すること。
