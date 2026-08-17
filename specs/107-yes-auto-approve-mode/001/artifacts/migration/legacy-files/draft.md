# Draft: 107-yes-auto-approve-mode

## Q&A

1. Q: スコープは Phase 1（SKILL.md 指示ベース）か Phase 2（コマンド内完結）か？
   A: Phase 1。コンソールに見える形。Phase 2 は将来。

2. Q: auto mode での選択肢処理はどこで行うか？
   A: AI 経由。SKILL.md の指示で「autoApprove: true なら id=1 が選ばれたものとして進む」。

3. Q: draft フェーズの扱いは？
   A: auto mode でも必ず自問自答で実施。スキップしない。AI 判断でブレさせない。

4. Q: デフォルト選択はどの id？
   A: 全選択肢 id=1 固定。

5. Q: Hard Stop / リトライ上限は？
   A: gate 20回, impl テスト修正 5回, review 3回。固定値。上限到達でユーザーに返す。

6. Q: 入口は？
   A: `/sdd-forge.flow-auto-on` skill と `/sdd-forge.flow-auto-off` skill。内部で `flow set auto on/off` を実行。

7. Q: skill 間遷移は？
   A: 同じ仕組み。完了時の選択肢で id=1 が選ばれたものとして次の skill へ。

8. Q: prepare-spec --yes は必要か？
   A: 不要。prepare-spec 後に `flow set auto on` で設定。

9. Q: auto OFF のタイミングは？
   A: 変更不要。flow.json に残り続ける。

10. Q: prompt.js の recommended 変更は？
    A: 不要。auto は id=1 固定なので recommended を参照しない。

11. Q: flow.json 未存在時は？
    A: `flow set auto on` がエラーを返す。前提チェックは既存の `flow get check` で十分。

12. Q: draft 自問自答のブラッシュアップは？
    A: 別 spec。

## Decisions

- Phase 1 = SKILL.md 指示ベース（コンソールに見える形）
- autoApprove: true なら選択肢を提示せず id=1 として進む
- draft は必ず自問自答（Issue + docs + guardrail → チェックリスト → draft.md）
- リトライ上限: gate 20, impl test 5, review 3
- skill: flow-auto-on / flow-auto-off を別々に作成
- prompt.js / prepare-spec は変更不要

- [x] User approved this draft
- Confirmed at: 2026-03-31
