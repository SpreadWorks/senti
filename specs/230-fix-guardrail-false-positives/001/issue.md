Bulk fix for repeatedly occurring false positives in guardrail evaluation, identified from the issue logs of the last 12 specs.

Targets:
- draft-scope-boundary (23 occurrences): Relax body to allow mentions of function names and file paths
- complete-context (22 occurrences): Relax to pass when trigger→behavior is clear regardless of when/if grammar
- task-single-responsibility (8 occurrences): Exclude T-pending-spec placeholders before gate evaluation
- prioritize-requirements (10 occurrences): Add condition that explicit prioritization is not required when there are 3 or fewer requirements or all have the same priority
- exit-code-contract (6 occurrences): Restrict phase to task-impl only

Files to change: src/presets/base/guardrail.json, src/flow/lib/run-gate.js

<details>
<summary>ja</summary>

[BUG] ガードレール評価の false positive 一括修正

直近12 specのissue-logから、ガードレール評価で繰り返し発生している false positive を一括修正する。

対象:
- draft-scope-boundary (23回): 関数名・ファイルパス言及を許容するよう body 緩和
- complete-context (22回): when/if 文法に拘らず trigger→behavior が明白なら pass と緩和
- task-single-responsibility (8回): T-pending-spec プレースホルダーを gate 評価前に除外
- prioritize-requirements (10回): 要件3件以下または同一優先度なら明示不要と条件追加
- exit-code-contract (6回): phase を task-impl のみに限定

変更対象: src/presets/base/guardrail.json, src/flow/lib/run-gate.js

</details>