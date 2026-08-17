# Spec Tests: 163-merge-flow-auto-skills

## What is tested

`sdd-forge upgrade` のクリーンアップロジック（`deploySkillsFromDir`）が要件通りに動作することを検証する。

1. テンプレートに存在しない `sdd-forge.*` スキルが削除されること
2. experimental テンプレートから配置されたスキルは削除されないこと
3. 新スキル `sdd-forge.flow-auto` が配置されること

SKILL.md（AIへの指示テキスト）の動作は自動テスト不可のため手動確認とする。

## Test location

`specs/163-merge-flow-auto-skills/tests/test-upgrade-cleanup.js`

## How to run

```bash
node specs/163-merge-flow-auto-skills/tests/test-upgrade-cleanup.js
```

worktreeまたはリポジトリルートから実行すること。

## Expected results

```
Test 1: Old sdd-forge.* skills are removed after upgrade
  ✓ .claude/skills/sdd-forge.flow-auto-on is deleted
  ✓ .claude/skills/sdd-forge.flow-auto-off is deleted
  ✓ .agents/skills/sdd-forge.flow-auto-on is deleted
  ✓ .agents/skills/sdd-forge.flow-auto-off is deleted

Test 2: Experimental skills are NOT removed
  ✓ .claude/skills/sdd-forge.flow-auto-on is deleted
  ✓ .claude/skills/sdd-forge.exp.workflow is preserved
  ✓ .agents/skills/sdd-forge.flow-auto-on is deleted
  ✓ .agents/skills/sdd-forge.exp.workflow is preserved

Test 3: sdd-forge.flow-auto is deployed after upgrade
  ✓ .claude/skills/sdd-forge.flow-auto is created

9 tests: 9 passed, 0 failed
```

## Note

このテストは npm test には含まれない。将来のコード変更でテンプレート名や
ディレクトリ構造が変わった場合に合法的に動作が変わりうるため、長期メンテナンスを
前提とした `tests/` には適さない。
