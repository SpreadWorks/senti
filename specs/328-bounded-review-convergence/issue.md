## Summary

`review` must be treated not as a process that keeps resolving findings without limit, but as a bounded process that converges by handing off the disposition and unresolved items to `acceptance`. Currently, the reviewer disposition and review tooling failures are treated as the same incomplete state, so even non-blocking results can trigger repeated provider switching or recovery of the recording path, preventing the flow from converging.

In Issue #451, the independent review result itself was `ADVISORY` with `blocking findings = 0`, but launching the external review process or recording its result failed due to execution environment constraints. Because this failure was not separated from the review disposition, the flow still treated review as incomplete, causing a retry loop for non-blocking findings that should have been handed off to `acceptance`.

This is not an implementation bug in an individual issue. It is a design-level convergence problem caused by the flow treating review disposition and review tooling success/failure as the same completion condition.

## Current Behavior

- Even when an independent review has 0 blocking findings, the flow cannot proceed from the review step if the normal recording process fails.
- Provider startup failures, subprocess errors, post-hook failures, and result recording failures are not distinguished from review rejection.
- `next-action` does not uniquely indicate whether to adopt an existing result, perform a bounded retry, register alternative evidence, or hand off to `acceptance`.
- The flow cannot suppress re-execution against the same tree SHA and the same evidence.
- Tooling recovery can continue as work required to complete the flow even when it does not correspond to the issue's Acceptance Criteria.
- Sandbox or provider permission shortages can spill over into user approval requests instead of being treated as tooling errors in the flow.

## Problem

The flow's completion condition depends not on the product-level review disposition, but on successful completion of a normal recording path through a specific provider. Also, because retry / remediation limits are not stored as enforced state, users or agents can continue recovery loops.

At minimum, the following states must be explicitly separated.

- `PASS`: passes with no blocking findings
- `ADVISORY`: passes after handing off non-blocking findings to `acceptance` evidence
- `REJECTED`: has blocking findings. Apply the default remediation limit
- `TOOLING_ERROR`: not a reviewer disposition, but a failure in the execution mechanism such as startup, communication, parsing, or recording

## Proposal

Revise review state transitions and evidence recording so that review content and tooling failures are persisted separately.

1. A valid review result with `blocking findings = 0` is treated as review completion regardless of whether non-blocking improvements exist.
2. `ADVISORY` content is handed off to `acceptance` evidence and is not used as a reason to rerun review.
3. `REJECTED` is sent through the existing remediation / acceptance path, but after the limit is reached it must not return to the same review.
4. Provider startup, communication, parsing, post-hook, and recording failures are recorded as `TOOLING_ERROR` and do not generate review findings.
5. Tooling recovery is limited to a configured number of attempts, in principle 1, and after failure must transition deterministically to alternative evidence registration, handoff to `acceptance`, or an explicit blocker.
6. Provide a path to safely register a finalized independent audit result as typed evidence with provenance and target tree SHA.
7. Reject duplicate execution for the same tree SHA, same evidence, and same review phase.
8. `next-action` returns the remaining retry count, the single next permitted operation, and either findings to hand off or a tooling blocker.
9. Separate `autoApprove` from OS / sandbox / provider execution permissions, and do not convert permission shortages into user flow approval requests.

## Acceptance Criteria

- [ ] If a valid review result has `blockingFindings: []`, review completes and proceeds to the next step or `acceptance` even when non-blocking improvements exist.
- [ ] `ADVISORY` content is saved to `acceptance` evidence together with the target tree SHA, and does not require rerunning the same review.
- [ ] `REJECTED` follows the configured remediation limit, and after the limit is reached proceeds to final `acceptance` judgment without returning to the same review.
- [ ] Provider startup, communication, parse, post-hook, and result recording failures become `TOOLING_ERROR` and are not treated as review rejection or blocking findings.
- [ ] The number of tooling recovery attempts is persisted in flow state, and the CLI rejects reruns beyond the limit.
- [ ] The CLI deterministically rejects duplicate reviews with the same phase, same tree SHA, and same evidence.
- [ ] Independent verification results can be registered with provenance, target phase, tree SHA, and disposition, and used as normal `acceptance` evidence.
- [ ] `next-action` returns exactly one permitted operation among `retry review`, `register alternative evidence`, `move to acceptance`, or `stop as blocker`.
- [ ] A tooling error does not require fixes to providers or the review mechanism that are unrelated to the issue's own Acceptance Criteria.
- [ ] Tooling errors while `autoApprove` is enabled are not converted into user flow approval requests.
- [ ] Normal review, target guard, revision / CAS, and existing `acceptance` judgment do not regress.

## Validation

- Verify `PASS`, `ADVISORY`, `REJECTED`, provider startup failure, JSON parse failure, and recording failure after result retrieval with separate fixtures.
- Confirm that `next-action` and persisted state change as expected before and after the remediation limit.
- Confirm that duplicate execution with the same tree SHA is rejected, and revalidation is possible only after the tree SHA changes.
- Confirm that after independent evidence is registered, review is not rerun and the evidence can be referenced from `acceptance`.
- Reproduce the `ADVISORY / blocking findings = 0 + recording path failure` observed in Issue #451 as a regression fixture.

## Out of Scope

- Fixes to external app servers or sandbox products themselves
- Bypassing permission checks or automatic privilege escalation
- Product implementation belonging to the Acceptance Criteria of an individual issue
- An operation that keeps adding findings discovered in review to the same issue without limit

<details>
<summary>ja</summary>

review tooling failureでbounded flowが収束しない

## Summary

`review` は、指摘を無制限に解消し続ける工程ではなく、判定結果と未解決事項を `acceptance` に引き継いで収束する bounded な工程として扱う必要がある。現状は reviewer の判定結果と review tooling の失敗が同じ未完了状態として扱われるため、非 blocking な結果でも provider 切り替えや記録経路の復旧を繰り返せてしまい、flow が収束しない。

Issue #451 では、独立 review の結果自体は `ADVISORY` かつ `blocking findings = 0` だったが、外部 review プロセスの起動または結果記録が実行環境の制約で失敗した。この failure が review disposition と分離されず、flow 上は review 未完了として残ったため、本来は `acceptance` へ引き継ぐべき非 blocking 指摘に対して再試行ループが発生した。

これは個別 Issue の実装不良ではなく、flow が review disposition と review tooling の成否を同じ完了条件として扱っていることによる設計上の収束性の問題である。

## Current Behavior

- 独立 review で blocking finding が 0 件でも、通常の記録プロセスが失敗すると review 工程から進めない。
- provider 起動失敗、subprocess error、post-hook 失敗、結果記録失敗が、review rejection と区別されない。
- `next-action` が、既存結果の採用、bounded な再試行、代替 evidence 登録、`acceptance` への引き継ぎを一意に示さない。
- 同じ tree SHA と同じ evidence に対する再実行を flow 側で抑止できない。
- tooling 復旧が Issue の Acceptance Criteria に対応しなくても、flow 完走のための作業として継続できてしまう。
- sandbox や provider の権限不足が、flow 上の tooling error ではなくユーザーへの承認要求に波及し得る。

## Problem

flow の完了条件が、製品上の review disposition ではなく、特定 provider による正常な記録経路の完遂に依存している。また、retry / remediation 上限が強制的な状態として保持されていないため、利用者やエージェントが復旧ループを継続できる。

少なくとも以下の状態を明示的に分離する必要がある。

- `PASS`: blocking finding なしで通過
- `ADVISORY`: 非 blocking 指摘を `acceptance` evidence に引き継いで通過
- `REJECTED`: blocking finding あり。既定の remediation 上限を適用
- `TOOLING_ERROR`: reviewer の判定ではなく、起動・通信・parse・記録など実行機構の失敗

## Proposal

review の状態遷移と evidence 記録を見直し、review 内容と tooling failure を別々に永続化する。

1. `blocking findings = 0` の有効な review 結果は、non-blocking improvement の有無にかかわらず review 完了として扱う。
2. `ADVISORY` の内容は `acceptance` evidence に引き継ぎ、review 再実行の理由にしない。
3. `REJECTED` は既存の remediation / acceptance 経路に送るが、上限到達後は同じ review に戻さない。
4. provider 起動・通信・parse・post-hook・記録失敗は `TOOLING_ERROR` として記録し、review finding を生成しない。
5. tooling recovery は既定回数（原則 1 回）に制限し、失敗後は代替 evidence 登録、`acceptance` への引き継ぎ、または明示的 blocker のいずれかに決定的に遷移させる。
6. 固定済みの独立監査結果を、provenance と対象 tree SHA を伴う型付き evidence として安全に登録できる経路を用意する。
7. 同じ tree SHA・同じ evidence・同じ review phase への重複実行を拒否する。
8. `next-action` は、残り再試行回数、次に許可される一意の操作、引き継ぐ findings または tooling blocker を返す。
9. `autoApprove` と OS / sandbox / provider の実行権限を分離し、権限不足をユーザーへの flow 承認要求に変換しない。

## Acceptance Criteria

- [ ] 有効な review 結果が `blockingFindings: []` の場合、non-blocking improvement が存在しても review は完了し、次工程または `acceptance` へ進む。
- [ ] `ADVISORY` の内容は対象 tree SHA とともに `acceptance` evidence へ保存され、同じ review の再実行を要求しない。
- [ ] `REJECTED` は設定された remediation 上限に従い、上限到達後は同じ review へ戻らず `acceptance` の最終判定へ進む。
- [ ] provider の起動・通信・parse・post-hook・結果記録の失敗は `TOOLING_ERROR` となり、review rejection や blocking finding として扱われない。
- [ ] tooling recovery の試行回数が flow state に永続化され、上限を超える再実行を CLI が拒否する。
- [ ] 同一 phase・同一 tree SHA・同一 evidence での重複 review を CLI が決定的に拒否する。
- [ ] 独立検証結果を provenance、対象 phase、tree SHA、disposition 付きで登録し、通常の `acceptance` evidence として利用できる。
- [ ] `next-action` は `review 再試行`、`代替 evidence 登録`、`acceptance へ移行`、`blocker として停止` のうち許可された一意の操作を返す。
- [ ] tooling error を理由に、Issue 本体の Acceptance Criteria と無関係な provider や review 機構の修正を要求しない。
- [ ] `autoApprove` 有効時の tooling error は、ユーザーへの flow 承認要求に変換されない。
- [ ] 正常な review、target guard、revision / CAS、既存の `acceptance` 判定を退行させない。

## Validation

- `PASS`、`ADVISORY`、`REJECTED`、provider 起動失敗、JSON parse 失敗、結果取得後の記録失敗を個別 fixture で検証する。
- remediation 上限の前後で `next-action` と永続状態が期待どおりに変化することを確認する。
- 同じ tree SHA での重複実行が拒否され、tree SHA 変更後のみ再検証可能であることを確認する。
- 独立 evidence 登録後に review が再実行されず、`acceptance` から参照できることを確認する。
- Issue #451 で観測した `ADVISORY / blocking findings = 0 + 記録経路失敗` を回帰 fixture として再現する。

## Out of Scope

- 外部 app-server や sandbox 製品自体の修正
- 権限チェックの迂回や自動的な権限昇格
- 個別 Issue の Acceptance Criteria に属するプロダクト実装
- review で見つかった指摘を、同じ Issue に無制限に追加し続ける運用

</details>