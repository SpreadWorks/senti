# Spec Verification Tests: 158-flow-impl-approach-step

## What is tested

`src/templates/skills/sdd-forge.flow-impl/SKILL.md` に、spec の要件を満たす実装方針確認ステップが追記されているかを検証する。

具体的には以下を確認する:
- コードを書く前に実装方針を提示する指示があること（Req 1）
- 提示フォーマットに「各要件ごとの方針・既存コード・設計理由」が含まれること（Req 2）
- 承認/差し戻し選択肢（`[1]` / `[2]`）があること（Req 3）
- 差し戻しリトライ上限が3回であること（Req 4）
- autoApprove 時の自動承認ルールがあること（Req 5）
- 承認前にコーディングを禁止する記述があること（Req 6）

## Test location

`specs/158-flow-impl-approach-step/tests/skill-approach-step.test.js`

これは spec 固有の検証テストであり、`tests/`（formal テスト）には含まれない。
SKILL.md の内容が将来意図的に再設計された場合、このテストを更新する必要はない。

## How to run

```bash
node specs/158-flow-impl-approach-step/tests/skill-approach-step.test.js
```

## Expected results

実装後（SKILL.md 追記後）は 7/7 PASS。
実装前は Req 1, 2(既存コード), 5, 6 が FAIL になる。
