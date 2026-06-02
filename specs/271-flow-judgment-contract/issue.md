## Background
Even when a review or gate stops due to reaching the maximum number of attempts, the same type of failure can repeat after resumption. Individual stop handling works, but the way judgment results, failure classifications, resume conditions, and artifact formats are handled varies across steps, making it difficult to improve convergence and initial generation quality.

## Approach
Maintain separation of responsibilities for each step. On top of that, define a common contract for failure information returned by reviews, gates, test result checks, and similar steps. The common contract should include failure classification, owning step, target, required fixes, verification method, and information used for progress determination.

## Step completion / override contract
Also define as a common contract the conditions under which each step may be marked done. Normal completion requires explicit conditions: the target artifact exists, the verdict is permitted, and there are no blocking findings.

When proceeding while leaving a failed artifact in place, treat it as an override completion rather than a plain done. An override must record user approval, the reason, the disposition of each blocking finding, the responsible successor step for accountability transfer, and accepted risks. This allows a FAIL artifact + done step to be mechanically distinguished as either a valid human judgment or a state inconsistency.

As an example: test-review permits normal done only for PASS/ADVISORY; when proceeding with a FAIL, each blocking finding must have a disposition such as out_of_scope, transferred_to_impl_gate, accepted_risk, or false_positive. impl-gate permits normal done for PASS only in principle, and overrides require stronger user approval and evidence. final-regression explicitly defines override conditions based on failureKind, such as failures caused by the existing environment.

## Expected improvements
Enable downstream processing to handle judgment results in a consistent format. Treat out-of-scope findings as transfers to the appropriate owning step rather than as stop reasons. Feed past failures back as pre-constraints to generation steps, reducing the pattern where acceptance criteria first appear during review.

Also, align the meaning of artifact verdict and flow step status. Even when a FAIL artifact remains with the step marked done, override completion explicitly records the reason and accountability transfer, allowing subsequent steps and resume processing to make safe decisions.

## Considerations
Inventory the gap between current review artifacts and the schema for next-action. Design common failure classifications and step-specific allowlists. Enable resume conditions to be determined based on changes to inputs and artifacts, not just attempt count.

List the normal completion and override completion conditions for each step. Specifically define, for test-review, impl-review, impl-gate, test-result-review, and final-regression, how to handle artifact verdict, blocking findings, user approval, disposition, and accountability transfer to successor steps.

<details>
<summary>ja</summary>

[ENHANCE] フロー判定結果の共通契約化によるレビュー収束性の改善

## 背景
レビューやゲートが試行上限で停止しても、再開後に同種の失敗が繰り返されることがある。個別の停止処理は機能しているが、各ステップで判定結果、失敗分類、再開条件、成果物形式の扱いがばらついており、収束性と初回生成品質の改善につながりにくい。

## 方針
各ステップの責務分離は維持する。そのうえで、レビュー、ゲート、テスト結果確認などが返す失敗情報の共通契約を定義する。共通契約には失敗分類、所有ステップ、対象、必須修正、検証方法、進捗判定に使う情報を含める。

## step completion / override contract
各 step を done にしてよい条件も共通契約として定義する。通常完了は、対象 artifact が存在し、許可された verdict で、blocking finding がないことを明示条件にする。

失敗 artifact を残したまま進む場合は、単なる done ではなく override completion として扱う。override には user approval、理由、各 blocking finding の disposition、後続 step への責任移管先、受け入れリスクを記録する。これにより FAIL artifact + done step が、妥当な人間判断なのか状態不整合なのかを機械的に区別できるようにする。

例として test-review は PASS/ADVISORY のみ通常 done を許可し、FAIL で進む場合は blocking finding ごとに out_of_scope、transferred_to_impl_gate、accepted_risk、false_positive などの disposition を必須にする。impl-gate は原則 PASS のみ通常 done とし、override はより強い user approval と evidence を要求する。final-regression は既存環境起因 failure など、failureKind に応じた override 条件を明示する。

## 期待する改善
判定結果を後続処理が同じ形式で扱えるようにする。範囲外の指摘は停止理由にせず、適切な所有ステップへ送る。過去の失敗を生成ステップの事前制約へ戻し、レビューで初めて合格基準が現れる構造を減らす。

また、artifact の verdict と flow step status の意味を揃える。FAIL artifact が残っているのに step が done になっている場合でも、override completion として理由と責任移管が明示されるため、後続 step や resume 処理が安全に判断できる。

## 検討事項
現在の各レビュー成果物と次アクション用スキーマの差分を整理する。共通失敗分類とステップ固有の許可リストを設計する。再開条件を試行回数だけでなく、入力や成果物の変化に基づいて判定できるようにする。

各 step の normal completion 条件と override completion 条件を一覧化する。特に test-review、impl-review、impl-gate、test-result-review、final-regression について、artifact verdict、blocking finding、user approval、disposition、後続 step への責任移管の扱いを定義する。

</details>