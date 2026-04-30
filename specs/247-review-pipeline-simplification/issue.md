Simplify the review steps (review-spec, review-test, impl review) along two axes.

1. **Remove user confirmation**: Remove the choice UI from the current prompts (plan/review-spec.md, plan/review-test.md, impl/review.md) and always run reviews automatically. The autoApprove branch in SKILL.md will also become unnecessary.

2. **Remove the external validation agent (flow.impl.review.final)**: Change the current three-stage pipeline (propose agent → final agent (claude/opus) → session AI) to a two-stage pipeline (propose agent → session AI). The session AI has full context of the spec, design history, and tradeoffs, making it better suited for judgment than an external agent that only sees the diff. This applies to both impl review and spec review.

Note: review-draft was changed in spec 246 to a question completion mechanism (gap detection → additional questions → user answers) and has a different nature from reviews, so it is out of scope.

<details>
<summary>ja</summary>

[ENHANCE] レビューパイプライン簡素化: ユーザー確認廃止 + 外部検証エージェント廃止

レビューステップ（review-spec, review-test, impl review）を2軸で簡素化する。

1. ユーザー確認の廃止: 現在のプロンプト（plan/review-spec.md, plan/review-test.md, impl/review.md）から選択肢UIを削除し、常にレビューを自動実行する。SKILL.md の autoApprove 分岐も不要になる。

2. 外部検証エージェント（flow.impl.review.final）の廃止: 現状の propose agent → final agent（claude/opus）→ セッション AI の3段を、propose agent → セッション AI の2段に変更する。セッション AI は spec・設計経緯・tradeoff の全コンテキストを持っており、diff だけで判断する外部エージェントより適切な判定ができる。対象は impl review と spec review の両方。

review-draft は spec 246 で設問補完機構（不足検出 → 追加質問 → ユーザー回答）に変更済みであり、レビューとは異なる性質のため対象外。

</details>