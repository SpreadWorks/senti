# Draft: 096-flow-plan-rework

## Q&A

### Q1: FLOW_STEPS 順序変更
- Q: ステップの順序をどう変えるか？
- A: `approach → branch → prepare-spec → draft → spec → gate → approval → test → ...`。`spec` → `prepare-spec`、`fill-spec` → `spec`、gate が approval の前に移動。

### Q2: draft フェーズのチェックリスト
- Q: 要件カテゴリのチェックリストはどこに置くか？
- A: skill テンプレートに埋め込み。5カテゴリ: 目的・スコープ / 既存への影響 / 制約 / エッジケース / テスト方針。

### Q3: コマンド更新範囲
- Q: flow get/set/run への置換は flow-plan のみか全 skill か？
- A: 全 skill テンプレートを一括置換。

### Q4: test step 再設計
- Q: テスト選択肢は？
- A: 「作成する / 作成しない / その他」。テスト種別選択は廃止。AI がプロジェクトのテスト体系を読んで判断。`specs/<spec>/tests` の配置規約を本スコープに含める。

### Q5: plan.test-mode の選択肢更新
- Q: flow get prompt plan.test-mode を更新するか？
- A: はい。「テストコードを作成する / 作成しない / その他」に変更。

## Approval

- [x] User approved this draft
- Confirmed at: 2026-03-29
