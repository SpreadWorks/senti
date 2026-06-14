## Background

While reorganizing retry management for review / gate, we confirmed that mixing mechanical judgment and repair with AI-driven semantic judgment and repair breaks the meaning of the retry counter.

In particular, draft-gate handles mechanical issues such as draft artifact schema / lifecycle / review-triage-repair audit and AI semantic FAIL based on guardrails within the same gate execution. This makes it difficult to distinguish failures caused by AI judgment from producer contract violations or protocol failures.

## Decisions

- Mechanical judgment and mechanical repair are not the primary responsibility of review / gate, but part of the producer contract for the side that creates the artifact.
- Immediately after an artifact is created or changed, run a common normalize / validate / deterministic repair once / validate again flow.
- review / gate performs semantic judgment using a formally valid artifact as input.
- AI semantic FAIL consumes reviewRetry / gateRetry.
- If AI semantic FAIL reaches the retry limit, do not stop at that review / gate. Record the finding in flow-findings.json, continue passing it as input to subsequent steps, and let acceptance-review make the final judgment.
- Cases that stop the flow are limited to those where an evaluable state cannot be created, such as producer contract violation, invalid artifact, provider/tooling/protocol failure, AI output schema failure, or missing required test evidence.
- Mechanical failure, provider/tooling/protocol failure, and AI output schema failure are not counted as AI semantic retries.
- Do not create a new top-level phase. Artifact checks are not a one-time stage; they are required every time an artifact is changed.
- Rather than injecting this externally as a generic lifecycle hook, create common functions and have artifact producers / repairers call them explicitly.
- This is not about creating a step hierarchy with class inheritance / extends. If needed, limit class usage to representing return values with a dedicated class.

## Handling semantic retry exhausted

```text
AI semantic FAIL retry exhausted
  -> record in flow-findings.json
  -> do not stop at that review / gate
  -> always include the unresolved finding in the context of subsequent steps
  -> acceptance-review makes the final judgment
```

This applies commonly to AI semantic findings in draft-gate / spec-review / spec-gate / impl-review / impl-gate.

However, states that cannot be evaluated even by acceptance-review, such as inability to save evaluation results, broken artifacts, invalid schema, or missing required evidence, must not be allowed to proceed.

## Assumed Common Function

Example:

```text
completeArtifactChange(...)
  -> normalize
  -> validate
  -> deterministic repair once
  -> validate again
  -> return clean / unresolvedMechanicalFailure
```

When the caller receives unresolvedMechanicalFailure, it decides based on that step's responsibility whether to stop, return to repair, send to acceptance, and so on. The common function does not directly decide flow transitions or retry counters.

## Current Investigation

### definition / registry

- src/flow/definition.js does not have preHooks / postHooks attributes on FlowNode.
- However, registry.js command hooks and definition.js resolveLifecycle(event) / RunLifecycleHook mean lifecycle hooks effectively exist.
- gate uses gate:pre / gate:post, review uses review:post, and finalize uses finalize:pre / post / onError.
- This use case is not an arbitrary hook but a producer contract, so making the producer side explicitly call a common function gives clearer responsibility than adding generic hooks to definition.js.

### draft-gate

- executeDraft in run-gate.js handles draft.json parsing, draft lifecycle validation, draft review artifact validation, and guardrail AI judgment within the same gate execution.
- There is already a structure where the AI guardrail is not called if textCheck returns mechanical issues.
- However, because the gate still owns the mechanical checks, the boundary between producer contract violation and AI semantic FAIL is not closed immediately after artifact changes.

### spec-review

- spec-review is an AI semantic review step. It generates blockingFindings / nonBlockingImprovements and decides FAIL / ADVISORY / PASS.
- If the AI output schema is broken, spec-review JSON response shape repair runs once. This is protocol/schema repair, not re-review.
- spec-review itself is not a guardrail checklist gate. The design pushes schema/static issues in the input spec toward the downstream gate side.
- Under this policy, after spec creation / spec-repair changes spec.json, common validation should run immediately, and spec-review should perform AI semantic review on a clean spec.

### spec-gate

- spec-gate runs via executeSpec / runGateFlow in run-gate.js.
- It performs mechanical checks such as schema validation through loadSpecJson, checkSpecJson, tasks monotonic check, and validateSpecRepairAudit, then proceeds to AI guardrail judgment.
- In runGateFlow, if there are textCheck issues, the AI guardrail is not called. Structurally, it is mechanical-first.
- However, since the mechanical checks remain inside the gate, there is room to close them earlier as completion conditions for spec producer / spec-repair.
- This is a good improvement target. Call common artifact validation immediately after spec / spec-repair, and let spec-gate focus on readiness / guardrail judgment.

### implement

- In definition.js, implement has action: run-impl, but registry.js has no independent run-impl command. The implementation body is performed by the skill changing code according to impl/implement.md instructions, and step completion proceeds with `senti flow set step implement done`.
- run-impl-confirm.js is for readiness confirmation and only checks the number of done requirements and the list of changed files. It does not handle normalize / validate as an artifact producer.
- The implement prompt instructs updating req status, guardrail lint, and preparing the file-map, but these are procedural instructions and are not closed in one place as a producer contract.
- Therefore, to apply this policy, common validation must be called explicitly before implement done, or the necessary artifact validation must be performed in `flow set req` / `flow set files` / `flow set step implement done`.

### impl-review / task-review

- impl-review performs AI semantic review through `senti flow run review` and writes review.md and impl-review.json.
- impl-review.json has blockingFindings[] / nonBlockingImprovements[] / verdict / summary, and there is also a FlowJudgmentContract completion contract.
- blocking failureMode is limited to `missing_acceptance_requirement`, `spec_behavior_contradiction`, and `security_or_data_integrity_bug`.
- PASS / ADVISORY proceeds to impl-review done, while FAIL does not complete the step. Tests also show PASS / ADVISORY reset reviewRetry, while FAIL increments reviewRetry.
- Invalid AI output schema is treated as parser/schema failure, but unlike spec-review, impl-review does not appear to have a schema-repair-only prompt.
- impl-review is already quite close to this policy. However, it would be good to make the distinction between AI output protocol failure and semantic FAIL more explicit in the artifact / envelope.

### test / scenario-validity / test-review

- scenario-validity generates scenario-validity-result.json and raw logs, and validates the artifact with validateScenarioValidityResult before saving it.
- test-execute and test-result-review each call validateTestExecuteResultV2 / validateTestResultReview from registry.js post hooks before marking the step done.
- test-review mixes coverage artifact generation, test header validation, and AI static review. coverage/header validation failure is treated as TOOLING_FAILURE or as a blocking finding.
- The test system already has multiple entry points for deterministic artifact validation, so it should be easy to move them toward a common function. However, the boundary between semantic test design findings and tooling/protocol failures in test-review header validation needs to be reviewed.

### impl-gate / integration gate

- integration gate validates test-execute / test-result-review artifacts before AI guardrail through validateIntegrationArtifactTrust.
- Comments also state that missing / unverified results are structural failures and do not consume retry budget.
- gate-impl / integration aligns with this responsibility separation, but currently holds it as a gate-side precondition. In the future, duplication between artifact producer-side completion conditions and gate-side trust validation should be整理ed.

## Improvement Policy

1. Extract validation / normalization for each artifact type into common function groups.
2. Explicitly call them immediately after steps that create or change artifacts, such as draft / spec / test / repair.
3. Because implement does not directly write artifacts through a CLI command, close the producer contract through `flow set req` / `flow set files` / `flow set step implement done` or through the implementation completion confirmation command.
4. Make review / gate retry counters correspond only to AI semantic verdicts.
5. Move AI semantic retry exhausted to flow-findings.json, expose it to subsequent context, and pass it to acceptance-review.
6. Static validation remaining inside gates may remain for the time being as defensive preconditions, but the primary responsibility should move to the producer contract.
7. The common function does not decide flow transitions for unresolved mechanical failure; the caller handles it in the context of the step.

## Completion Criteria

- Major steps that create or change artifacts explicitly call the common artifact validation function.
- Before implement completion, producer contracts for req status / file-map / lint / required artifacts are mechanically verified.
- validation failure / deterministic repair failure does not consume reviewRetry / gateRetry.
- AI semantic FAIL and protocol/tooling/mechanical failure can be distinguished in artifacts / issue logs / envelopes.
- AI semantic retry exhausted does not stop the flow at review / gate, and is passed to acceptance-review through flow-findings.json and subsequent context.
- spec-gate / draft-gate can assume clean artifacts before AI guardrail judgment.
- Existing deterministic validation for test-execute / scenario-validity / test-result-review has been moved to the common function, or organized under the same contract.

## Related

- 5878: UX and audit design for moving auto toward the default execution mode
- 04d0: flow judgment result common contract
- dc7f: review retry and recovery model
- 1544: acceptance-review and failurePolicy
- 251a: gate-impl artifact existence / non-placeholder validation

<details>
<summary>ja</summary>

[ENHANCE] artifact変更後の機械検証をproducer責務として共通化する

## 背景

review / gate の retry 管理を整理する中で、機械的な判定・修正と、AI を伴う semantic 判定・修正が混ざると retry counter の意味が壊れることを確認した。

特に draft-gate では、draft artifact の schema / lifecycle / review-triage-repair audit などの機械的問題と、guardrail に基づく AI semantic FAIL が同じ gate 実行内で扱われている。これにより、AI 判断で失敗した回数と、producer contract 違反や protocol failure を区別しにくい。

## 決定事項

- 機械判定・機械修正は review / gate の主責務ではなく、artifact を作る側の producer contract とする。
- artifact を作成または変更した直後に、共通の normalize / validate / deterministic repair once / validate again を通す。
- review / gate は、形式的に成立した artifact を入力として semantic 判定を行う。
- AI semantic FAIL は reviewRetry / gateRetry を消費する。
- AI semantic FAIL が retry 上限に達した場合、その review / gate では止めない。finding を flow-findings.json に記録し、後続 step の入力に出し続け、acceptance-review が最終判断する。
- 止める対象は、producer contract violation、artifact invalid、provider/tooling/protocol failure、AI 出力 schema failure、必須 test evidence 欠落など、評価可能な状態を作れないケースに限定する。
- 機械的 failure、provider/tooling/protocol failure、AI 出力 schema failure は AI semantic retry として数えない。
- 新しいトップレベル phase は作らない。artifact check は一度だけ通る工程ではなく、artifact が変更されるたびに必要な処理だから。
- 汎用 lifecycle hook として外から差し込むより、共通関数を作り、artifact producer / repairer が明示的に呼ぶ。
- class inheritance / extends で step 階層を作る話ではない。必要なら戻り値を専用 class で表現する程度に留める。

## semantic retry exhausted の扱い

```text
AI semantic FAIL retry exhausted
  -> flow-findings.json に記録
  -> その review / gate では止めない
  -> 後続 step の context に unresolved finding を必ず含める
  -> acceptance-review が最終判断する
```

これは draft-gate / spec-review / spec-gate / impl-review / impl-gate の AI semantic finding に共通で適用する。

ただし、評価結果を保存できない、artifact が壊れている、schema が成立しない、必須 evidence が欠けているなど、acceptance-review でも評価不能な状態は前進させない。

## 想定する共通関数

例:

```text
completeArtifactChange(...)
  -> normalize
  -> validate
  -> deterministic repair once
  -> validate again
  -> clean / unresolvedMechanicalFailure を返す
```

呼び出し元は unresolvedMechanicalFailure を受け取った時に、その step の責務で止める、repair に戻す、acceptance に送るなどを判断する。共通関数は flow 遷移や retry counter を直接決めない。

## 現状調査

### definition / registry

- src/flow/definition.js には FlowNode の preHooks / postHooks 属性はない。
- ただし registry.js の command hook と definition.js の resolveLifecycle(event) / RunLifecycleHook により、実質的な lifecycle hook は存在する。
- gate は gate:pre / gate:post、review は review:post、finalize は finalize:pre / post / onError を使う。
- 今回の用途は任意 hook ではなく producer contract なので、definition.js に汎用 hook を足すより、producer 側から共通関数を明示呼び出しする方が責務が明確。

### draft-gate

- run-gate.js の executeDraft は draft.json parse、draft lifecycle validation、draft review artifact validation、guardrail AI 判定を同じ gate 実行内で扱っている。
- textCheck が機械的 issue を返すと AI guardrail は呼ばれない構造はある。
- ただし gate の責務として機械チェックまで抱えており、producer contract 違反と AI semantic FAIL の境界が artifact 変更直後に閉じていない。

### spec-review

- spec-review は AI semantic review step。blockingFindings / nonBlockingImprovements を生成し、FAIL / ADVISORY / PASS を決める。
- AI 出力 schema が壊れた場合は spec-review JSON response shape repair が一度走る。これは再レビューではなく protocol/schema repair。
- spec-review 自体は guardrail checklist gate ではない。入力 spec の schema/static 問題は downstream gate 側に寄せる設計になっている。
- 今回の方針では、spec を作る / spec-repair が spec.json を変更した直後に共通 validation を通し、spec-review は clean な spec を AI semantic review する形に寄せる。

### spec-gate

- spec-gate は run-gate.js の executeSpec / runGateFlow で動く。
- loadSpecJson による schema validation、checkSpecJson、tasks monotonic check、validateSpecRepairAudit などの機械チェックを行い、その後に AI guardrail 判定へ進む。
- runGateFlow では textCheck issue がある場合、AI guardrail は呼ばれない。構造としては機械 first になっている。
- ただし、機械チェックが gate の中に残っているため、spec producer / spec-repair の完了条件として先に閉じる余地がある。
- 改善対象として相性がよい。spec / spec-repair 直後に共通 artifact validation を呼び、spec-gate は readiness / guardrail 判定に集中させる。

### implement

- definition.js 上の implement は action: run-impl だが、registry.js に独立した run-impl command はない。実装本体は skill が impl/implement.md の指示でコードを変更し、step 完了は `senti flow set step implement done` で進む。
- run-impl-confirm.js は readiness 確認用で、requirements の done 数と変更ファイル一覧を見るだけ。artifact producer としての normalize / validate は担っていない。
- implement prompt は req status 更新、guardrail lint、file-map 準備を指示しているが、これらは手順指示であって producer contract として一箇所に閉じていない。
- そのため今回の方針を適用するなら、implement done 前に共通 validation を明示的に呼ぶ、または `flow set req` / `flow set files` / `flow set step implement done` 側で必要な artifact validation を行う必要がある。

### impl-review / task-review

- impl-review は `senti flow run review` で AI semantic review を行い、review.md と impl-review.json を書く。
- impl-review.json は blockingFindings[] / nonBlockingImprovements[] / verdict / summary を持ち、FlowJudgmentContract の completion contract もある。
- blocking failureMode は `missing_acceptance_requirement`, `spec_behavior_contradiction`, `security_or_data_integrity_bug` に限定されている。
- PASS / ADVISORY は impl-review done に進み、FAIL は step を完了させない。テスト上も PASS / ADVISORY は reviewRetry reset、FAIL は reviewRetry increment。
- AI 出力 schema 不正は parser/schema failure として扱われるが、spec-review のような schema-repair-only prompt は impl-review には見当たらない。
- impl-review は今回の方針にかなり近い。ただし AI 出力 protocol failure と semantic FAIL の区別を artifact / envelope 上でより明示するとよい。

### test / scenario-validity / test-review

- scenario-validity は scenario-validity-result.json と raw log を生成し、validateScenarioValidityResult で artifact を検証してから保存する。
- test-execute と test-result-review は registry.js の post hook でそれぞれ validateTestExecuteResultV2 / validateTestResultReview を呼んでから step done にしている。
- test-review は coverage artifact generation、test header validation、AI static review が混在している。coverage/header validation failure は TOOLING_FAILURE または blocking finding として扱われる。
- test 系は既に deterministic artifact validation の入口が複数あるため、共通関数へ寄せやすい。ただし test-review の header validation は semantic test design finding と tooling/protocol failure の境界を見直す必要がある。

### impl-gate / integration gate

- integration gate は validateIntegrationArtifactTrust によって test-execute / test-result-review artifact を AI guardrail の前に検証している。
- コメント上も missing / unverified results は structural failure であり retry budget consumption なしとされている。
- gate-impl / integration は今回の責務分離と方向性が合っているが、現状は gate 側 precondition として持っている。将来的には artifact producer 側の完了条件と gate 側 trust validation の重複を整理する。

## 改善方針

1. artifact 種別ごとの validation / normalization を共通関数群に切り出す。
2. draft / spec / test / repair など、artifact を作る・変更する step の直後に明示的に呼ぶ。
3. implement は CLI command が直接 artifact を書かないため、`flow set req` / `flow set files` / `flow set step implement done` または実装完了確認コマンドで producer contract を閉じる。
4. review / gate の retry counter は AI semantic verdict のみに対応させる。
5. AI semantic retry exhausted は flow-findings.json に移送して後続 context に出し、acceptance-review へ渡す。
6. gate 内に残る static validation は、当面は防御的 precondition として残してもよいが、主責務は producer contract へ寄せる。
7. unresolved mechanical failure は共通関数が flow 遷移を決めず、呼び出し元が step の文脈で扱う。

## 完了条件

- artifact を作成・変更する主要 step が、共通 artifact validation 関数を明示的に呼んでいる。
- implement 完了前に、req status / file-map / lint / required artifacts の producer contract が機械的に確認される。
- validation failure / deterministic repair failure が reviewRetry / gateRetry を消費しない。
- AI semantic FAIL と protocol/tooling/mechanical failure が artifact / issue-log / envelope 上で区別できる。
- AI semantic retry exhausted が review / gate で flow を停止させず、flow-findings.json と後続 context を通じて acceptance-review に渡る。
- spec-gate / draft-gate は、AI guardrail 判定前に clean artifact を前提にできる。
- test-execute / scenario-validity / test-result-review の既存 deterministic validation が共通関数へ寄せられている、または同じ contract に整理されている。

## 関連

- 5878: auto を default 実行モードに寄せる UX と監査設計
- 04d0: flow judgment result common contract
- dc7f: review retry and recovery model
- 1544: acceptance-review and failurePolicy
- 251a: gate-impl artifact existence / non-placeholder validation

</details>