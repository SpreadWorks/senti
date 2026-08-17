# Tests for spec 115: centralize-timeout-and-threshold-constants

## What was tested
- DEFAULT_AGENT_TIMEOUT_MS が agent.js から export されていること
- JSDoc 以外のコードに DEFAULT_AGENT_TIMEOUT * 1000 が残っていないこと
- text.js, forge.js, translate.js にローカル DEFAULT_TIMEOUT_MS 定義がないこと

## Where tests are located
- `specs/115-centralize-timeout-and-threshold-constants/tests/verify-timeout-constants.test.js`

## How to run
```bash
node --test specs/115-centralize-timeout-and-threshold-constants/tests/verify-timeout-constants.test.js
```

## Expected results
- 実装前: 3テスト中2-3が FAIL
- 実装後: 全テスト PASS
