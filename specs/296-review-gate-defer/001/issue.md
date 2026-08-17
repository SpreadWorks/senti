## Goal
Create a mechanism that lets the flow proceed without stopping even when AI-based judgment in review / gate reaches the retry limit.

Until the retry limit is reached, retry while fixing the issues found by the AI judgment. Even when the retry limit is reached, record unresolved AI findings in flow-findings.json and delegate the decision to acceptance-review. Treat the target step as completed and proceed to subsequent steps.

## Problem Summary
Currently, there are still paths where review / gate stops when the retry limit is reached. This is a straightforward bug against the expected specification.

Under the expected specification, findings from AI judgment are finally decided by acceptance-review after the retry limit is reached. review / gate itself should not return control to the user and stop just because the limit was reached.

## Role of Mechanical Judgments
The purpose of moving mechanical judgments outside review / gate is to clear noisy defects before passing them to the AI judgment in review / gate.

For example, the following should be handled as deterministic prechecks before asking the AI to judge them:

- test header / requirement coverage / malformed header / duplicate header / unknown id / header-test-name mismatch
- tooling / parser / schema / prompt-size / command failure
- items that are not AI semantic judgments, such as command execution failures or invalid artifact schemas

These are not semantic findings that should consume the AI retry budget of review / gate. They should either be explicitly handled in the previous stage or recorded in structured fields as tooling/mechanical failures.

## What Should Be Treated as AI Judgments
Semantic issues, design issues, requirement alignment issues, and weaknesses in test design found by AI review / gate should be treated as semantic/deferable findings.

Defer must not be rejected by inferring that a finding is mechanical/mixed merely because words such as test, missing, or invalid appear in the finding title/body. Whether something is mechanical should be determined by the preceding precheck or structured artifact fields, not by the prose of the AI finding.

## Current Problem Areas
- src/flow/lib/run-review.js: hasReviewMechanicalBlocker / isContentAlignmentFinding determine whether an AI finding is mechanical by applying regexes to its text
- src/flow/lib/run-review.js: tryDeferReviewRetryExhaustion requires findings.every(isContentAlignmentFinding) and does not defer when findings are treated as mechanical/mixed
- src/flow/lib/run-gate.js: hasGateMechanicalBlocker / classifyGateRetryExhaustionSource reject defer with mechanical_or_mixed_findings
- src/flow/lib/flow-judgment-contract.js: the completion contract side still has regex-based mechanical judgments for schema/tooling/command/test/missing/invalid, etc.
- src/flow/commands/review.js: test-review is executed as a one-shot static review, and on FAIL it is not connected to a fix retry loop or delegation to acceptance-review at the limit
- src/flow/prompts/plan/test-review.md and others still contain instructions to STOP on REVIEW_MAX_ATTEMPTS_EXCEEDED

## Fix Policy
- When the retry limit is reached in review / gate, do not stop; record unresolved AI findings in flow-findings.json
- After recording them in flow-findings.json, mark the target step as done and proceed to the next step
- acceptance-review reads deferred findings and decides repair / amend / blocked if necessary
- Remove or significantly reduce mechanical judgment based on regexes over AI finding text
- Move deterministically judgeable items to prechecks before review / gate
- Distinguish tooling/schema/command failures from AI semantic findings, and do not mix them into retry budget consumption or defer judgment
- test-review should also perform fixes and re-review until the retry limit, and delegate to acceptance-review when the limit is reached

## Acceptance Criteria
- Even when review / gate reaches the retry limit, it does not stop for the user with REVIEW_MAX_ATTEMPTS_EXCEEDED / GATE_MAX_ATTEMPTS_EXCEEDED or equivalent
- Unresolved AI findings are saved to flow-findings.json, the target step is marked done, and the next step proceeds
- acceptance-review reads deferred findings and reflects them in the final decision
- Even if an AI blocking finding in test-review contains the word test, as in R10/R12, defer is not rejected as mechanical_or_mixed
- test coverage/header/tooling/schema/command issues that can be detected by deterministic prechecks are classified before AI review/gate
- tooling/schema/command failures are distinguished from AI semantic retries and do not consume the semantic retry budget
- Instructions to STOP when the retry limit is reached are removed from prompts, and delegation to acceptance-review is described as the main path
- unit/e2e tests cover the defer path when review/gate reaches the retry limit, delegation when test-review reaches the limit, and the mechanical precheck path

## Reference
In /home/nakano/workspace/OOS_echub/.senti/worktree/feature-024-d1-migration/, test-review stopped after AI findings R10/R12. The causes were that an implementation path still stopped when the retry limit was reached, and that AI findings were classified as mechanical/mixed by prose regexes, preventing delegation to acceptance-review.

<details>
<summary>ja</summary>

review/gate が retry 上限で止まらず acceptance-review へ移譲するようにする

## ゴール
review / gate で AI を使った判定が retry 上限に達した場合でも、フローを停止させずに次へ進める仕組みを作る。

retry 上限までの間は、AI 判定で見つかった問題を修正しながら再試行する。retry 上限に達しても、未解決の AI finding は flow-findings.json へ記録し、acceptance-review に判断を移譲する。対象 step は完了扱いにして、以降の step へ進める。

## 問題の整理
現状、review / gate の retry 上限到達時に停止する経路が残っている。これは期待仕様に対して単純なバグである。

期待仕様では、AI 判定の finding は retry 上限到達後に acceptance-review で最終判断する。review / gate 自体が上限到達を理由にユーザーへ制御を返して止めるべきではない。

## mechanical 判定の位置づけ
mechanical 判定を review / gate の外へ出す目的は、review / gate の AI 判定に渡す前に、ノイズとなる不備をクリアにすること。

たとえば以下は AI に判断させる前に deterministic precheck として処理する。

- test header / requirement coverage / malformed header / duplicate header / unknown id / header-test-name mismatch
- tooling / parser / schema / prompt-size / command failure
- 実行コマンド失敗や artifact schema 不正など、AI の意味判断ではないもの

これらは review / gate の AI retry budget を消費する semantic finding ではない。前段で明示的に扱うか、tooling/mechanical failure として構造フィールドに記録する。

## AI 判定として扱うもの
AI review / gate が見つけた意味的な問題、設計上の問題、要求との整合性問題、テスト設計の弱さは semantic/deferable finding として扱う。

finding の title/body に test, missing, invalid などの語が含まれるだけで mechanical/mixed と推測して defer を拒否してはならない。mechanical かどうかは AI finding の文章ではなく、前段 precheck または artifact の構造フィールドで決める。

## 現状の問題箇所
- src/flow/lib/run-review.js: hasReviewMechanicalBlocker / isContentAlignmentFinding が AI finding の文面を regex で mechanical 判定している
- src/flow/lib/run-review.js: tryDeferReviewRetryExhaustion が findings.every(isContentAlignmentFinding) を要求し、mechanical/mixed と見なすと defer しない
- src/flow/lib/run-gate.js: hasGateMechanicalBlocker / classifyGateRetryExhaustionSource が mechanical_or_mixed_findings で defer を拒否する
- src/flow/lib/flow-judgment-contract.js: completion contract 側にも schema/tooling/command/test/missing/invalid などの regex mechanical 判定が残っている
- src/flow/commands/review.js: test-review は one-shot static review として実行され、FAIL 時に修正 retry loop や上限時の acceptance-review 移譲へ接続されていない
- src/flow/prompts/plan/test-review.md などに REVIEW_MAX_ATTEMPTS_EXCEEDED で STOP する指示が残っている

## 修正方針
- review / gate の retry 上限到達時は停止せず、unresolved AI findings を flow-findings.json に記録する
- flow-findings.json に記録したら対象 step を done にして、次 step へ進める
- acceptance-review が deferred findings を読み、必要なら repair / amend / blocked を判断する
- AI finding の文面 regex による mechanical 判定を削除または大幅縮小する
- deterministic に判定できるものは review / gate の前段 precheck へ移す
- tooling/schema/command failure は AI semantic finding と区別し、retry budget 消費や defer 判定を混ぜない
- test-review も retry 上限までは修正と再レビューを行い、上限到達時は acceptance-review へ移譲する

## 受け入れ条件
- review / gate が retry 上限に達しても、REVIEW_MAX_ATTEMPTS_EXCEEDED / GATE_MAX_ATTEMPTS_EXCEEDED 相当でユーザー停止しない
- unresolved AI findings は flow-findings.json に保存され、対象 step が done になり次 step へ進む
- acceptance-review が deferred findings を読み、最終判断に反映する
- test-review の AI blocking finding が R10/R12 のように test という語を含んでも、mechanical_or_mixed として defer を拒否しない
- deterministic precheck で検出できる test coverage/header/tooling/schema/command 問題は、AI review/gate の前に分類される
- tooling/schema/command failure は AI semantic retry と区別され、semantic retry budget を消費しない
- prompt から retry 上限時に STOP する指示が消え、acceptance-review 移譲が主経路として説明される
- unit/e2e tests で review/gate の retry 上限時 defer 経路、test-review の上限時移譲、mechanical precheck 経路をカバーする

## 参考
/home/nakano/workspace/OOS_echub/.senti/worktree/feature-024-d1-migration/ で test-review が R10/R12 の AI finding 後に停止した。原因は retry 上限到達時に停止する実装が残っていたことと、AI finding が文面 regex により mechanical/mixed と分類され acceptance-review へ移譲されなかったこと。

</details>