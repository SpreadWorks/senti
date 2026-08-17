# Draft: 110-auto-mode-flow-start-and-skill-transitions

## Q&A

1. Q: flow.json 未存在時の flow-auto-on の動作は？
   A: flow-auto-on は途中切り替え専用。flow.json 必須。未存在時はガイドして STOP。最初から auto は flow-plan の中で対応。

2. Q: auto mode で情報不足時の動作は？
   A: flow-auto-on がゲートキーパー。request も issue もなければ「要件を設定してください」とガイドして STOP。

3. Q: skill 間遷移の実装方法は？
   A: 各 SKILL.md の最終ステップに「autoApprove なら次の skill を Skill tool で呼べ」と追記。

## Decisions

- flow-auto-on: ゲートキーパー化（flow.json 確認 + request/issue 確認 → ON → skill 誘導）
- flow-plan/SKILL.md: 完了時に autoApprove なら flow-impl を呼ぶ
- flow-impl/SKILL.md: 完了時に autoApprove なら flow-finalize を呼ぶ
- コード変更なし、SKILL.md テンプレート修正のみ

- [x] User approved this draft
- Confirmed at: 2026-03-31
