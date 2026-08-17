# Scope

Compare the developer experience and quality of Spec-Driven Development flow review/gate failure behavior when moving from the current operation, which tends to retry until passing, toward bounded loop + automatic defer + acceptance re-evaluation.

# Background

In the current flow, review/gate retries do result in findings being fixed and quality improving. On the other hand, AI review/gate is a detector, and when it is used as a pass/fail judge and run until it passes, it is prone to long fix loops caused by false positives, existing issues, findings that are naturally incomplete mid-process, and repeated discussion of the same point.

A method that requires user approval to decide whether to exceed the limit breaks the continuous execution property of Spec-Driven Development and significantly reduces developer experience and productivity. Therefore, the validation target is a design where unresolved findings detected by AI are structured and carried forward to later stages without requiring human approval midway.

# Hypothesis

Do not make review/gate strictly one-time only. Instead, retry up to a defined maxAttempts. When the limit is reached, do not hard stop or request user approval; record unresolved findings as artifacts / issue-log / flow findings and automatically proceed to the next stage.

After that, acceptance review surveys the flow findings, test evidence, retro, issue-log, and the state before final regression, then classifies each item as resolved, false positive, pre-existing issue, spec amendment required, implementation fix required, or mechanical blocker. This may preserve the quality improvement benefit of intermediate retries while reducing the problem of AI holding too much control over flow progression.

# Comparison Options

A: Current-equivalent
- review/gate for draft/spec/test/impl retries in the conventional retry loop.
- When the limit is reached, stop / retry recovery / manual intervention is required.
- Outcomes before and after finalize are checked through the normal retro/report.

B: bounded loop + automatic defer + acceptance re-evaluation
- AI review retries up to maxAttempts.
- After maxAttempts is reached, proceed to the next stage without user approval.
- Remaining findings are not discarded; they are recorded as flow findings.
- Apply this to all AI review/gate steps, and defer AI-derived findings such as guardrail judgments after bounded retries.
- The block boundary is limited to whether artifacts / tests / commands exist and succeed.
- schema invalid, required artifact missing, test command failure, test evidence missing, flow state corruption, no-progress rerun guard, and tooling failure remain blocking.
- Semantic insufficiencies such as missing coverage mapping, guardrail judgments that evidence is insufficient, weak spec/test/impl alignment, pre-existing issues, and out-of-scope issues are deferred to acceptance-review as long as artifacts/tests/commands exist and succeed.
- acceptance review does not take flow findings at face value. Based on the completed spec / implementation / test evidence / retro, it re-evaluates whether the finding was truly valid and should be fixed.
- If the final output is correct, flow findings may be closed lightly as fixed / not_needed / false_positive / pre_existing.
- acceptance review ultimately classifies flow findings as fixed / not_needed / false_positive / pre_existing / still_open / blocking.
- If acceptance review reports a critical/blocking gap, route it to spec amendment or an additional implementation round rather than applying a direct fix.

# Investigation Points

Sample historical data from existing specs and examine how findings from intermediate review/gate steps were ultimately handled. Current artifacts do not have stable finding IDs, so complete causal tracing is difficult, but trends can be observed by combining issue-log, review/gate artifacts, retro, test-result-review, and final-regression.

Classifications to examine:
- transient: naturally resolved later because the process was still in progress
- evidence_gap: implementation or test evidence became available later
- false_positive: false positive from AI judgment
- pre_existing: outside the change scope of this spec or an existing issue
- real_blocker: an issue that should not proceed unless fixed at that point
- semantic_gap: mismatch in requirements, specification, or implementation meaning
- mechanical_blocker: failure to satisfy existence/success conditions for schema, required artifacts, test evidence, commands, flow state, or tooling
- semantic_or_evidence_weakness: artifacts/tests/commands exist and succeed, but semantic alignment or evidence strength is questionable

# Metrics To Examine

Implementation cost:
- wall-clock time
- agent calls
- token/cost
- issue-log count
- review/gate attempt count
- retry exhausted count
- human intervention count

Quality:
- number of critical gaps in final acceptance review
- final disposition distribution of flow findings
- percentage of flow findings that were truly valid and should have been fixed
- number of missing requirements / wrong implementations / test gaps
- whether spec amendment was required
- final regression / tests pass
- whether it can be considered correct from the user's perspective

# Decisions

- Target all AI review/gate steps.
- Treat maxAttempts as allowance for improving quality, and after the limit is reached, automatically defer instead of stopping.
- acceptance-review does not take flow findings at face value. It re-evaluates whether each finding was truly valid and should be fixed based on the completed output and evidence.
- The block boundary is limited to whether artifacts / tests / commands exist and succeed; semantic insufficiencies are deferred to acceptance-review.
- Do not add step statuses. Even when deferring and proceeding to the next step, traversal treats the step as `done`, and artifacts such as `flow-findings.json` record `completionKind: deferred`, sourceStep, attempts, findings, and finalDisposition.

- When returning from acceptance-review to spec amendment / reimplementation, the source of truth for subsequent processing is `acceptance-review.json`. `flow-findings.json` may be referenced as input history, but must not be used for routing or verdict decisions.
- If acceptance-review has `verdict !== pass`, `acceptance-review.json` explicitly specifies `nextAction` and `targetStep`. The code validates `targetStep` against an allowlist and resets from that step through `acceptance-review`. Candidates are `spec` / `test` / `implement` / `test-execute` / `impl-review` / `impl-gate`.
- The return destination from acceptance-review is not always fixed to spec. Semantic gaps such as missing requirements from the spec, ambiguous specification, or weak acceptance criteria return to `spec`. If implementation does not satisfy something already specified in spec/test, return to `implement`; test insufficiency returns to `test`; artifact insufficiency or cases that only require rerun return to `test-execute`.
- The automatic limit for acceptance rounds is 2. If round 1 has `verdict !== pass`, automatically return to targetStep. If round 2 still has `verdict !== pass`, stop the automatic loop and present user choices.
- When the round limit is reached, the default choices are: fix from the specification and rerun, fix from implementation/verification and re-evaluate, accept the risk and continue, or abort. If there is a mechanical blocker such as test failure, missing required artifact, or no evidence, do not allow risk acceptance.
- In the current implementation, `amend_required` automatically returns to spec, but when the round limit is reached, do not automatically return; present it as an option to fix the specification.

# Implementation Notes

Minimal proposal:
- Use FlowNode failurePolicy and consider a policy equivalent to retry-then-defer in addition to retry / block / amend-spec.
- Do not limit the target to impl-review; cover all AI review/gate steps for draft/spec/test/impl/task.
- gate separates AI findings from mechanical failures, and mechanical failures remain blocking.
- Add a `flow-findings.json` artifact containing findingId, sourceStep, sourceArtifact, sourceFindingId, retryExhausted, attempts, and round. Do not copy detailed findings; resolve them through sourceArtifact/sourceFindingId. Do not add step statuses. Even when recording findings and proceeding after retry exhaustion, mark the target step as `done`. Keep only a summary of flowFindings in flow.json.
- acceptance-review reads flow findings as input and saves the re-evaluation results and final classifications based on the current outputs and evidence.

# Expected Validation Result

This validation is less about deciding a winner and more about comparing the failure modes of the current method and the bounded defer method. In particular, confirm how many findings are worth fixing through intermediate retries, the percentage of findings automatically deferred after the limit that naturally resolve later, and conversely the percentage of real blockers whose fix cost increases when carried forward to acceptance.

<details>
<summary>ja</summary>

[ENHANCE] bounded loop + 自動 defer + acceptance 再評価を検証する

# 対象

Spec-Driven Development flow の review/gate 失敗時挙動を、現行の通るまで retry しがちな運用から、bounded loop + 自動 defer + acceptance 再評価へ寄せた場合の開発体験と品質を比較検証する。

# 背景

現行 flow では review/gate の retry により実際に指摘が修正され、品質が改善されている。一方で、AI review/gate は検出器であり、合格判定機として通るまで回すと、誤検知、既存問題、工程途中では当然未完の指摘、同じ論点の反復によって長い修正ループに入りやすい。

ユーザー承認を挟んで上限突破を判断する方式は、Spec-Driven Development の連続実行性を壊し、開発体験と生産性を大きく落とす。したがって、途中で人間承認を要求せず、AI が検出した未解決 finding を構造化して後段に持ち越す設計を検証対象にする。

# 仮説

review/gate を完全に 1 回だけにするのではなく、決められた maxAttempts までは retry する。上限に達した場合は hard stop やユーザー承認ではなく、未解決 finding を artifact / issue-log / flow finding として記録し、自動で次工程へ進める。

その後、acceptance review が flow finding、test evidence、retro、issue-log、final regression 前の状態を俯瞰し、解消済み、誤検知、既存問題、spec amendment 必要、実装修正必要、機械的 blocker を分類する。これにより、途中 retry の改善効果を残しつつ、AI が flow の進行権を握りすぎる問題を抑えられる可能性がある。

# 比較案

A: 現行相当
- draft/spec/test/impl の review/gate は従来どおり retry loop する。
- 上限到達時は stop / retry recovery / 手動介入が必要になる。
- finalize 前後の成果は通常 retro/report で確認する。

B: bounded loop + 自動 defer + acceptance 再評価
- AI review は maxAttempts までは retry する。
- maxAttempts 到達後はユーザー承認なしで次工程へ進む。
- 残った finding は捨てずに flow finding として記録する。
- すべての AI review/gate を対象にし、guardrail 判定など AI 由来の finding は bounded retry 後 defer する。
- block 境界は artifact / test / command が存在し成功しているかまでとする。schema invalid、required artifact missing、test command failure、test evidence missing、flow state corruption、no-progress rerun guard、tooling failure は block のまま残す。
- coverage mapping 不足、guardrail の証拠不足判定、spec/test/impl 対応の弱さ、既存問題やスコープ外問題など意味的な不足は、artifact/test/command が存在し成功している限り acceptance-review に defer する。
- acceptance review は flow finding を鵜呑みにせず、完成した spec / implementation / test evidence / retro を根拠に、指摘が本当に妥当で修正すべき内容だったのかを再判定する。
- 出来上がったものが正しければ、flow finding は fixed / not_needed / false_positive / pre_existing として軽く閉じてよい。
- acceptance review は flow finding を最終的に fixed / not_needed / false_positive / pre_existing / still_open / blocking に分類する。
- acceptance review が critical/blocking gap を出した場合は、直接修正ではなく spec amendment または追加実装 round に送る。

# 調査観点

既存 specs から過去データをサンプリングし、途中 review/gate の finding が最終的にどう扱われたかを見る。現状 artifact には finding の安定 ID がないため完全な因果追跡は難しいが、issue-log、review/gate artifact、retro、test-result-review、final-regression を組み合わせて傾向は見られる。

見る分類:
- transient: 工程途中だったため後段で自然解消したもの
- evidence_gap: 実装やテスト証拠が後段で揃ったもの
- false_positive: AI 判定の誤検知
- pre_existing: この spec の変更範囲外または既存問題
- real_blocker: その場で修正しないと進めるべきでない問題
- semantic_gap: 要求、仕様、実装意味のズレ
- mechanical_blocker: schema、required artifact、test evidence、command、flow state、tooling の存在/成功条件を満たさない失敗
- semantic_or_evidence_weakness: artifact/test/command は存在し成功しているが、意味的対応や証拠の強さに疑義があるもの

# 見る指標

実装コスト:
- wall-clock time
- agent calls
- token/cost
- issue-log 件数
- review/gate attempt 数
- retry exhausted 件数
- 人間介入回数

品質:
- final acceptance review の critical gap 数
- flow finding の final disposition 分布
- flow finding のうち、本当に妥当で修正すべきだった割合
- missing requirement / wrong implementation / test gap 数
- spec amendment が必要だったか
- final regression / tests pass
- ユーザー視点で要求通りと言えるか

# 決定事項

- 対象はすべての AI review/gate とする。
- maxAttempts は品質を稼ぐための猶予として扱い、上限到達後は stop ではなく自動 defer する。
- acceptance-review は flow finding を鵜呑みにせず、完成物と証拠から本当に妥当で修正すべき指摘だったかを再判定する。
- block 境界は artifact / test / command が存在し成功しているかまでとし、意味的な不足は acceptance-review に defer する。
- step status は増やさない。defer して次へ進む場合も traversal 上は `done` とし、`flow-findings.json` などの artifact に `completionKind: deferred`、sourceStep、attempts、findings、finalDisposition を記録する。

- acceptance-review から spec amendment / reimplementation に戻る場合、後続処理の source of truth は `acceptance-review.json` とする。`flow-findings.json` は入力履歴として参照してよいが、routing や verdict 判定には使わない。
- acceptance-review が `verdict !== pass` の場合、`acceptance-review.json` に `nextAction` と `targetStep` を明示する。コード側は `targetStep` を allowlist 検証し、その step から `acceptance-review` までを reset する。候補は `spec` / `test` / `implement` / `test-execute` / `impl-review` / `impl-gate` とする。
- acceptance-review の戻り先は常に spec 固定にはしない。要求が spec に無い、仕様が曖昧、acceptance criteria が弱いなど semantic gap は `spec` に戻す。一方で、spec/test に明記済みの内容を実装が満たしていない場合は `implement`、test 不足は `test`、artifact 不足や再実行だけでよい場合は `test-execute` に戻す。
- acceptance round の自動上限は 2 とする。round 1 で `verdict !== pass` なら targetStep へ自動で戻る。round 2 でも `verdict !== pass` の場合は自動 loop を止め、ユーザー選択肢を出す。
- round 上限到達時の選択肢は、仕様から修正して再実行、実装/検証から修正して再評価、リスクを受け入れて続行、中止を基本とする。テスト失敗、必須 artifact 欠落、証拠なしなど機械的 blocker がある場合はリスク受け入れを許可しない。
- 現行実装では `amend_required` は自動で spec に戻るが、round 上限到達時は自動で戻さず、仕様修正の選択肢として提示する。

# 実装メモ

最小案:
- FlowNode の failurePolicy を活用し、retry / block / amend-spec に加えて retry-then-defer 相当の policy を検討する。
- 対象は impl-review に限定せず、draft/spec/test/impl/task の AI review/gate 全体とする。
- gate は AI finding と mechanical failure を分離し、mechanical failure は block のまま扱う。
- `flow-findings.json` artifact を追加し、findingId、sourceStep、sourceArtifact、sourceFindingId、retryExhausted、attempts、round を持たせる。詳細 finding はコピーせず、sourceArtifact/sourceFindingId から解決する。step status は増やさず、retry exhausted 後に finding を記録して次へ進む場合も対象 step は `done` とする。flow.json には flowFindings の要約だけを残す。
- acceptance-review は flow finding を入力として読み、現在の成果物と証拠に基づく再評価結果と最終分類を保存する。

# 期待する検証結果

この検証では勝敗を確定するより、現行方式と bounded defer 方式の失敗モードを比較する。特に、途中 retry で直す価値のある指摘がどれだけあるか、上限後に自動 defer した finding が後段で自然解消する割合、逆に acceptance まで持ち越すと修正コストが上がる real blocker の割合を確認する。

</details>