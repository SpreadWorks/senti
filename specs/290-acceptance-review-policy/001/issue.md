# Scope

Add an acceptance-review phase to the Spec-Driven Development flow, and add failurePolicy for each phase/step defined in src/flow/definition.js.

# Background

The current flow has retry loops inside review/gate phases, which can make sequential discovery and fixing of comments continue for a long time. On the other hand, a final, holistic acceptance review can reveal cases where the implementation is missing part of what should have been built, or where the evidence is too shallow.

# Implementation approach

Add failurePolicy to src/flow/definition.js, which defines the flow structure, rather than to a configuration file.

Candidate policies:
- retry: Current-compatible behavior. If a step fails, fix and rerun within the same phase.
- record: Save findings to an artifact / issue-log, and do not retry within the same phase.
- amend-spec: For acceptance-review. Send gaps to spec amendment / next implementation retry.
- block: For mechanical failures such as schema, artifact, and test evidence. Do not proceed until fixed.

Initial assignment:
- run-review family: retry by default.
- impl-review: retry in the normal flow. Keep a structure that allows record only for comparative validation.
- run-gate family: block.
- acceptance-review: amend-spec.
- finalize-* family: preserve existing behavior, and explicitly define policy later if needed.
- Other normal steps: preserve existing maxAttempts / retry behavior.

# Decisions

- Do not apply record/no-loop behavior for impl-review to the normal flow in the initial implementation. The normal flow preserves the current-compatible retry behavior.
- Introduce record/no-loop behavior gradually, limited to a comparative-validation branch/spec in a separate item.
- Initially place acceptance-review after retro and before final-regression. Detect critical gaps in requirement satisfaction before final-regression, reducing costly rework after the final regression.
- Critical/blocking gaps from acceptance-review do not unconditionally return to reimplementation. Send only gaps that are critical/blocking and that the implementing AI judges should and reasonably can be reimplemented to spec amendment / next implementation retry.
- Even if critical/blocking, gaps with low reimplementation validity, gaps requiring user decision-making, and out-of-scope gaps are recorded in artifact / issue-log and routed to user decision or backlog/advisory.
- acceptance-review must not narrow the validation scope primarily to requirements. The implementing AI performs a holistic review of whether the implementation satisfies the request, considering the original request, spec, goal, and implementation context.
- The main output of acceptance-review is findings. Each finding has mappedRequirementIds and links to requirementAmendmentProposals.
- The output of acceptance-review maps detected findings to existing requirements, and findings that cannot be expressed by existing requirements are saved as requirementAmendmentProposals.
- acceptance-review connects to part of spec rework. However, the review step itself does not directly modify spec.json; it structures findings and amendment proposals and passes them to the next amendment retry.
- The pass/fail judgment for acceptance-review must not be based only on a score. Hard blockers stop the flow regardless of score.
- Do not introduce roundLimit as a new control term. Align with the existing maxAttempts / retry counter / attempt terminology.
- The highest-level pass/fail criterion for acceptance-review is whether the goal is satisfied. Do not average requirement alignment, implementation quality, and spec alignment scores in a way that dilutes failure to meet the goal.
- Implementation quality issues of the level 'the requirement is satisfied, but the implementation approach is not ideal' may pass and remain as finding/advisory unless they are clear hard blockers.
- If existing requirements are not fully satisfied, but the requirements themselves are misaligned with the current code or goal and the original goal is satisfied, the review may pass. In that case, leave candidate fixes for the spec side in requirementAmendmentProposals.
- If the goal is not satisfied, the result is NG. Do not pass even if other scores such as implementation quality or requirements alignment are high.
- Treat tests/evidence as preconditions for acceptance-review and as the basis for each judgment, rather than as an independent pass/fail score. If tests fail, necessary tests were not created, or required artifacts are missing, treat this as a mechanical blocker before semantic scoring.
- If tests/evidence exist, treat them as grounds and confidence support for judgments about goal satisfaction and implementation quality, and reflect them in each finding's evidenceRefs and confidence.
- The acceptance-review verdict has four values: pass / amend_required / user_decision_required / blocked.
- For verdict: amend_required, include a mechanism from the initial implementation to return to the spec. acceptance-review does not directly modify spec.json; instead, it returns to the spec amendment step using requirementAmendmentProposals as input, then proceeds to implementation retry.
- In spec amendment retry, the AI generally fixes automatically without user approval. AI implementation mistakes, missed requirement interpretation, and insufficient spec conversion are recovered by the AI itself through amendment / implementation retry.
- However, scope changes beyond the original request, specification decisions that require confirming the user's intent, and trade-offs requiring product decisions stop as user_decision_required.
- If user_decision_required occurs, ask the user before returning to spec amendment. The choices are amend_and_retry / abort / accept_risk_and_continue.
- If blocked or mechanicalBlockers exist, do not offer accept_risk_and_continue. The choices are repair_and_reevaluate / abort.
- acceptance-review itself has maxAttempts: 1. Do not rerun repeatedly with the same input; if reevaluation is needed, fix the spec / implementation / tests / artifact before returning to acceptance-review.
- Do not split the implementation scope. Implement it all together as 1544. Treat the broad scope itself as a test case for validating the effectiveness of acceptance-review.
- However, the internal implementation order may be organized, such as failurePolicy / acceptance-review artifact-schema-leaf / verdict transitions / impl-review(record) structure.

# Verdict semantics

- pass: Goal achieved, with no mechanical/hard blockers. Proceed to final-regression.
- amend_required: The goal is unmet or there is a gap valid for reimplementation, and the flow should proceed to spec amendment / next implementation retry. In principle, return automatically to spec amendment without approval.
- user_decision_required: Scope judgment, specification judgment, or user decision-making is required. Ask the user before returning to spec amendment.
- blocked: There is a mechanical blocker before AI scoring, such as test failure, missing artifact, or invalid schema.

# Choices for user_decision_required

- amend_and_retry: Save the user's answer as amendment input, return to spec amendment, and attempt reimplementation. Usually no approval is inserted.
- abort: End and discard the implementation here. Do not proceed to finalize. The concrete cleanup/abort behavior follows the existing flow termination operation.
- accept_risk_and_continue: Record the finding as a known risk in artifact / issue-log and proceed to final-regression. This cannot be selected when mechanicalBlockers exist.

# Choices for blocked

- repair_and_reevaluate: Return to the cause step or the necessary spec amendment, repair tests/artifacts/implementation, and then rerun acceptance-review. Do not merely remove the blocker; also resolve issues discovered during repair of the unevaluable state as needed.
- abort: End and discard the implementation here. Do not proceed to finalize.

# Minimum scope

1. Add failurePolicy to FlowNode.
2. Add a structure that allows impl-review to use record policy. However, preserve the current-compatible retry behavior as the initial behavior, and limit record/no-loop behavior to the comparative-validation branch/spec.
3. Add an acceptance-review leaf after retro and before final-regression, with maxAttempts: 1.
4. After implementation, acceptance-review holistically reviews the original request, spec, goal, implementation diff, test evidence, issue-log, and retro/report.
5. acceptance-review asks whether the implementation was completed according to the request, and detects missing requirement, wrong implementation, test gap, spec gap, and advisory.
6. acceptance-review uses findings as its main output and maps detected findings to existing requirements. Items that do not naturally link to existing requirements are saved as requirementAmendmentProposals with candidate requirements to add/modify, reasons, relationship to the original request, and reimplementation validity.
7. If acceptance-review finds a critical/blocking gap, judge reimplementation validity for each gap. Only gaps that are critical/blocking and that the implementing AI judges should and reasonably can be reimplemented are sent to spec amendment / next implementation retry, rather than directly retried.
8. Control acceptance retry using the existing maxAttempts / retry counter / attempt representation. The acceptance-review step itself has maxAttempts: 1, and reevaluation is treated as passing through the step again after changing inputs.
9. Keep the mechanical gate as block.
10. As a prerequisite for acceptance-review, mechanically confirm that required test evidence / artifacts / schemas exist. Missing or failed items are treated as block, not scoring.
11. Add a transition that returns to the spec amendment step when verdict: amend_required, applies requirementAmendmentProposals, and then proceeds to implementation retry.
12. Spec amendment retry normally does not request approval again. Stop with user_decision_required only when user decision-making is needed.
13. Save the three choices for user_decision_required, and transition to spec amendment / abort / final-regression according to the selected result.
14. Save the two choices for blocked, and have repair_and_reevaluate return to the cause step or spec amendment and rerun acceptance-review.
15. Implement 1544 all at once without splitting it. Include as a validation perspective whether acceptance-review can catch implementation omissions in a large change scope.

# acceptance-review artifact proposal

- goalSatisfactionScore: 0-100. Whether the original request and goal are satisfied. Used as the highest-level pass/fail judgment.
- requirementAlignmentScore: 0-100. Consistency with existing spec.json requirements. Even if low, do not immediately fail if the goal is satisfied; connect it to requirementAmendmentProposals.
- implementationQualityScore: 0-100. Appropriateness of the implementation approach. Even if low, record it as finding/advisory if it is not a hard blocker, and do not prevent pass.
- acceptanceScore: Reference value. Do not use averaging to dilute unmet goal satisfaction in pass judgment.
- thresholds: Initial thresholds for each category.
- mechanicalBlockers: Array of blockers that stop progress before AI scoring, such as test failure, missing required artifact, invalid schema, or missing required tests.
- hardBlockers: Array of finding IDs that semantically stop progress regardless of score.
- attempt: The acceptance-review attempt count or a value corresponding to the existing retry counter.
- findings: Array of findings detected holistically by acceptance-review. Main output.
  - findingId
  - summary
  - severity: critical / blocking / major / minor / advisory
  - category: missing_requirement / wrong_implementation / test_gap / spec_gap / advisory
  - mappedRequirementIds: Array of requirement IDs when linked to existing spec.json requirements
  - linkedRequirementAmendmentProposalIds: References to requirementAmendmentProposals
  - evidenceRefs: Grounds such as diff / test evidence / issue-log / retro/report
  - confidence: high / medium / low
  - shouldReimplement: true / false
  - reimplementationReason
  - requiresUserDecision: true / false
- requirementAmendmentProposals: Candidate requirement additions/changes that cannot be expressed by existing requirements or require revision.
  - proposalId
  - proposalType: add / revise / split / clarify
  - targetRequirementIds
  - proposedRequirementSummary
  - reason
  - relationToOriginalRequest
  - linkedFindingIds
  - shouldReimplementAfterAmendment: true / false
- userDecision: Question, choices, user answer, and selection reason for user_decision_required.
- blockedDecision: Choices, user answer, and repair target for blocked.
- verdict: pass / amend_required / user_decision_required / blocked

# Expected flow

Round 0:
- spec
- implement
- impl-review(retry, current-compatible)
- mechanical gate(block)
- retro
- acceptance-review(maxAttempts: 1)
- final-regression
- finalize

Try impl-review(record) in the comparative-validation branch/spec.

If acceptance-review returns amend_required:
- use findings and requirementAmendmentProposals as input
- return to spec amendment step without routine user approval
- update spec.json / spec.md through amendment, not directly in acceptance-review
- continue to implementation retry
- run mechanical gate
- run retro
- run acceptance-review
- run final-regression

If acceptance-review returns user_decision_required:
- ask the user before returning to spec amendment
- amend_and_retry returns to spec amendment using the user answer as input
- abort stops and discards/cleans up according to existing flow conventions
- accept_risk_and_continue records the risk and proceeds to final-regression

If acceptance-review returns blocked:
- do not offer accept_risk_and_continue
- repair_and_reevaluate returns to the cause step or spec amendment and reruns acceptance-review after repair
- abort stops and discards/cleans up according to existing flow conventions

Then:
- ready if mechanicalBlockers are zero, the goal is satisfied, hardBlockers are zero, and final-regression passes
- stop/user decision if user decision findings remain or acceptance retry attempts are exhausted
- non-critical gaps may become backlog/advisory

# Notes

- Do not break the meaning of existing review/gate artifacts.
- Do not carelessly remove existing step IDs.
- Do not replace finalize prerequisites all at once.
- acceptance-review may be permanent, but introduce no-loop behavior for intermediate review/gate phases gradually so comparison remains possible.
- Do not make the entire gate single-pass. Keep mechanically judgeable failures such as schema, artifact, test evidence, and approval as blocking.
- Do not place another acceptance-review after final-regression. Treat final-regression as the final mechanical check after acceptance.
- Even if acceptance-review finds a critical/blocking gap, it must not arbitrarily send items requiring scope judgment, user decision-making, or specification-change judgment to reimplementation.
- acceptance-review must not use only requirements as its input or evaluation axis. Use requirements as the destination for organizing findings and as connection points for amendment proposals.
- Align acceptance retry control with existing maxAttempts / retry counter / attempt terms and mechanisms, and do not add a new concept name called roundLimit.
- acceptanceScore may be saved as a reference value for comparison and trend tracking, but must not be used in pass judgment to offset a low goalSatisfactionScore.
- Treat test evidence not as an independent aggregate score axis, but as a mechanical precondition and evidence for semantic findings.
- The transition to spec amendment must not rewrite the spec as a side effect of the acceptance-review step itself. Apply proposals in a separate step/handler.
- Spec amendment retry must not usually stop for approval. Stop with user_decision_required only for scope changes or specification judgments that require user decision-making.

# Validation

- Implement 1544 all at once without splitting it, and include as a validation perspective whether acceptance-review can detect implementation omissions across a broad change scope.
- Combine with the separate RESEARCH item 'compare review/gate no-loop and acceptance round', and compare implementation time, agent calls, tokens/cost, and number of final acceptance gaps between current-equivalent behavior and no-loop + acceptance round.

<details>
<summary>ja</summary>

[ENHANCE] acceptance-review と phase failurePolicy を flow definition に追加する

# 対象

Spec-Driven Development flow に acceptance-review フェーズと、src/flow/definition.js で定義するフェーズ/ステップごとの failurePolicy を追加する。

# 背景

現行 flow は review/gate がフェーズ内 retry loop を持つため、指摘の逐次発見と修正が長く続きやすい。一方で、最後に俯瞰して見る acceptance review では、作るべきものの分母不足や evidence の浅さが見つかることがある。

# 実装方針

設定ファイルではなく、flow の構造を定義している src/flow/definition.js に failurePolicy を持たせる。

候補 policy:
- retry: 現行互換。失敗したら同フェーズで修正/再実行する。
- record: 指摘を artifact / issue-log に保存し、同フェーズ retry はしない。
- amend-spec: acceptance-review 用。gap を spec amendment / next implementation retry に送る。
- block: schema、artifact、test evidence など機械的 failure 用。直さない限り進めない。

初期割り当て:
- run-review 系: 基本 retry。
- impl-review: 通常 flow は retry。比較検証用だけ record にできる構造を持つ。
- run-gate 系: block。
- acceptance-review: amend-spec。
- finalize-* 系: 既存挙動を維持し、必要なら後続で policy を明示する。
- その他の通常 step: 既存 maxAttempts / retry 挙動を維持する。

# 決定事項

- impl-review の record/no-loop 化は初期実装では通常 flow に適用しない。通常 flow は現行互換の retry 挙動を維持する。
- record/no-loop 化は、別 item の比較検証用 branch/spec に限定して段階導入する。
- acceptance-review の初期配置は retro の後、final-regression の前にする。final-regression 前に要求充足の critical gap を検出し、高コストな最終回帰後の手戻りを減らす。
- acceptance-review の critical/blocking gap は無条件に再実装へ戻さない。critical/blocking かつ実装者である AI が再実装するべきで妥当だと判断した gap だけを spec amendment / next implementation retry に送る。
- critical/blocking でも再実装妥当性が低いもの、判断にユーザー意思決定が必要なもの、スコープ外のものは artifact / issue-log に記録し、ユーザー判断または backlog/advisory に回す。
- acceptance-review は requirement 主軸に検証範囲を狭めない。実装者である AI が元要求・spec・ゴール・実装コンテキストを踏まえて「要求通りに実装できたか」を俯瞰レビューする。
- acceptance-review の出力は findings を主出力にする。各 finding に mappedRequirementIds と requirementAmendmentProposals へのリンクを持たせる。
- acceptance-review の出力は、検出した指摘を既存 requirements へマッピングし、既存 requirements で表現できない指摘は requirementAmendmentProposals として保存する。
- acceptance-review は spec 作り直しの一部に接続する。ただし review step 自体が spec.json を直接変更するのではなく、指摘と amendment proposal を構造化して次の amendment retry に渡す。
- acceptance-review の通過判定はスコアだけにしない。hard blocker は score に関係なく止める。
- 新しい制御語として roundLimit は導入しない。既存の maxAttempts / retry counter / attempt 表現に合わせる。
- acceptance-review の pass/fail は「ゴールを満たしているか」を最上位に置く。requirements 適合、実装品質、spec alignment の点数を平均してゴール未達を薄めない。
- 「要求を満たしているが実装方法がいまひとつ」程度の実装品質問題は、明確な hard blocker でない限り pass して finding/advisory に残してよい。
- 「既存 requirements を完全には満たしていないが、requirements 自体が現状コードやゴールとずれており、元のゴールは満たしている」場合は pass してよい。その場合は requirementAmendmentProposals に spec 側の修正候補を残す。
- 「ゴールを満たしていない」場合は NG。実装品質や requirements alignment の他スコアが高くても pass しない。
- テスト/evidence は独立した合否スコアというより、acceptance-review の前提条件および各判断の根拠として扱う。テストが通らない、必要なテストを作っていない、必須 artifact がない場合は、意味的スコアリング以前の mechanical blocker とする。
- テスト/evidence が存在する場合は、goal satisfaction や実装品質の判断を支える根拠・信頼度として扱い、各 finding の evidenceRefs や confidence に反映する。
- acceptance-review の verdict は pass / amend_required / user_decision_required / blocked の4値にする。
- verdict: amend_required の場合は、初期実装から spec に戻す仕組みを含める。acceptance-review が直接 spec.json を変更するのではなく、requirementAmendmentProposals を入力に spec amendment step へ戻し、その後 implementation retry に進める。
- spec amendment retry では、原則としてユーザー approval を挟まずに AI が自動で修正する。AI の実装ミス、要求解釈漏れ、spec 化不足は AI 自身が amendment / implementation retry で回収する。
- ただし、元要求の範囲を超えるスコープ変更、ユーザーの意図確認が必要な仕様判断、プロダクト判断が必要な trade-off は us
... (truncated)