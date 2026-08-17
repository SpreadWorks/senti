# Tests: 174-record-test-summary

## 何をテストするか

インストール済みの flow-plan スキル（`.claude/skills/sdd-forge.flow-plan/SKILL.md`）に
`flow set test-summary` の記録指示が含まれているかを検証する。

`sdd-forge upgrade` 実行前は FAIL、実行後は PASS となることを確認する。

## テストの場所

`specs/174-record-test-summary/tests/verify-skill-sync.js`（spec 検証テスト）

スキルへの指示変更（プロンプトエンジニアリング）であるため、`tests/`（正式テスト）には配置しない。

## 実行方法

```bash
# worktree ルートから実行
node specs/174-record-test-summary/tests/verify-skill-sync.js
```

## テスト数

- spec 検証テスト: 1（unit）

## 期待結果

| タイミング | 結果 |
|---|---|
| `sdd-forge upgrade` 実行前 | FAIL: installed flow-plan skill is missing 'flow set test-summary' instruction |
| `sdd-forge upgrade` 実行後 | PASS: installed flow-plan skill contains 'flow set test-summary' instruction |
