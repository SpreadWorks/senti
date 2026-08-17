# Tests for spec 110: auto-mode-flow-start-and-skill-transitions

## What was tested

- flow-auto-on SKILL.md がゲートキーパーとして flow status / request / issue をチェックすること
- flow-auto-on SKILL.md が phase に基づく skill マッピングを持つこと
- flow-plan SKILL.md に autoApprove 時の flow-impl 遷移指示があること
- flow-impl SKILL.md に autoApprove 時の flow-finalize 遷移指示があること

## Where tests are located

- `specs/110-auto-mode-flow-start-and-skill-transitions/tests/verify-skill-templates.test.js`

## How to run

```bash
node --test specs/110-auto-mode-flow-start-and-skill-transitions/tests/verify-skill-templates.test.js
```

## Expected results

- 実装前: 2テスト FAIL（flow-auto-on のゲートキーパー、flow-plan の遷移指示）
- 実装後: 全テスト PASS
