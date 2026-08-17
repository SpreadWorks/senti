# Tests for 161-fix-log-usage-recording

## What was tested and why

spec 155（`agent-json-output-usage`）の実装漏れ修正を検証する。

`log.js` の `#agentImpl` が `entry.usage` を無視していたため、usage（token 数・cache hit 数・cost）がログに記録されなかった。このテストは修正後の動作を検証する。

## Test location

`specs/161-fix-log-usage-recording/tests/log-usage-recording.test.js`

正式テスト（`npm test`）には含まれない spec 検証テスト。

## How to run

```bash
# プロジェクトルートから
node --test specs/161-fix-log-usage-recording/tests/log-usage-recording.test.js
```

## Test cases

| テストケース | 確認内容 |
|---|---|
| prompt JSON — usage あり | `entry.usage` が指定された場合、per-request JSON のトップレベルに `usage` オブジェクトが記録される |
| prompt JSON — usage: null | `entry.usage = null` の場合、per-request JSON に `"usage": null` が記録される |
| prompt JSON — usage 省略 | `entry.usage` を渡さない場合、per-request JSON に `"usage": null` が記録される |
| JSONL — usage あり | `entry.usage` が指定された場合、JSONL end-event にフラットフィールド（`inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheCreationTokens`, `costUsd`）が記録される |
| JSONL — usage: null | `entry.usage = null` の場合、JSONL end-event に usage 関連フィールドが含まれない |
| JSONL — usage 省略 | `entry.usage` を渡さない場合、JSONL end-event に usage 関連フィールドが含まれない |

## Expected results

修正前: 全テスト FAIL（usage フィールドが記録されない）
修正後: 全テスト PASS
