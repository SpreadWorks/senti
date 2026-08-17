# Tests: 148-save-agent-prompt-logs

## What was tested and why

spec の全要件（1〜9）を検証するスペック検証テスト。
`AgentLog` クラスの単体動作と、`callAgent` との統合動作の両方をカバーする。

## テスト配置

`specs/148-save-agent-prompt-logs/tests/` — spec 検証テスト（`npm test` では実行されない）

「このテストが future change で壊れた場合、それは常にバグか？」→ NO（この spec 固有の要件検証のため）

## 実行方法

```bash
node --test specs/148-save-agent-prompt-logs/tests/agent-log.test.js
```

worktree から実行する場合:

```bash
cd /home/nakano/workspace/sdd-forge/.sdd-forge/worktree/feature-148-save-agent-prompt-logs
node --test specs/148-save-agent-prompt-logs/tests/agent-log.test.js
```

## 期待結果

実装前: 全テスト FAIL（`AgentLog` クラス・`callAgent` の新引数が未実装）
実装後: 全テスト PASS

## カバレッジ

| 要件 | テスト |
|------|--------|
| req1: prompts=true でログ追記 | `appends log entry when logs.prompts is true` |
| req2: prompts=false でログなし | `no log file created when logs.prompts is false` |
| req2: logs 未設定でログなし | `no log file created when logs config is absent` |
| req3: AgentLog 未渡しでログなし | `no log file created when AgentLog is not passed` |
| req4: エントリフィールドと ISO 8601 形式 | `log entry dates are ISO 8601 strings` / req1 テスト |
| req5: logs.dir でカスタムパス | `custom logs.dir writes to specified path` |
| req6: エラー時もログ追記 | `log entry is appended even when agent fails` |
| req7: ディレクトリ自動作成 | `logs directory is created automatically` |
| req8: 複数呼び出しで複数エントリ | `multiple calls append multiple entries` |
| req9: 書き込み失敗でも throw しない | `log write failure does not throw` |
