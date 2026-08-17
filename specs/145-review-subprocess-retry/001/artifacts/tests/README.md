# Tests for 145-review-subprocess-retry

## What was tested
- runCmdWithRetry が1回目で成功した場合リトライしないこと
- 失敗→成功のシーケンスで正常結果が返ること
- 全リトライ失敗で最後の失敗結果が返ること
- killed/signal 含む場合はリトライしないこと
- retryCount=0 でリトライしないこと

## Where tests are located
- `specs/145-review-subprocess-retry/tests/retry-logic.test.js`

## How to run
```bash
node --test specs/145-review-subprocess-retry/tests/retry-logic.test.js
```

## Expected results
全テストが PASS すること。
