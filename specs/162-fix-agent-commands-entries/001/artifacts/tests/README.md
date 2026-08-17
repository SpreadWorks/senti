# Test Plan: 162-fix-agent-commands-entries

## What was tested and why

`validateConfig` の `agent.profiles` バリデーション（R2）を検証する。`agent.profiles` は既存コードで読まれているが、今まで validateConfig で検証されていなかった。

## Test location

- **Formal tests**: `tests/unit/lib/types-agent-profiles.test.js`
  - 公開 API（validateConfig）の契約テスト → `tests/` に配置
  - 将来の変更でこのテストが壊れた場合は常にバグ

## How to run

```bash
node tests/unit/lib/types-agent-profiles.test.js
# または
npm test
```

## Expected results

| Test | 説明 |
|---|---|
| ✓ accepts profiles referencing a BUILTIN_PROVIDERS key | `"claude/sonnet"` 等の組み込みキーはパス |
| ✓ accepts profiles referencing a user-defined provider key | user providers にあるキーはパス |
| ✓ throws when profiles reference an unknown provider key | 未定義キーはエラー |
| ✓ throws when agent.profiles is not an object | 非オブジェクトはエラー |
| ✓ throws when a profile entry is not an object | プロファイル値が非オブジェクトはエラー |
| ✓ throws when a profile command entry value is not a string | エントリ値が非文字列はエラー |
| ✓ accepts config without agent.profiles | profiles 省略はパス |

## Notes

- R1（typedef 修正）と R4（init.js / run-retro.js 修正）はコードレビューで確認
- R3（config.example.json 書き直し）は JSON.parse + validateConfig で確認可能
