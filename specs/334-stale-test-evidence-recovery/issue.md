## Symptom

At the flow-level `impl-gate`, if a previous `test-execute-result.json` contains requirement failures and a subsequent implementation fix changes the repair fingerprint, the gate stops with `ARTIFACT_PLACEHOLDER`.

After that, running `senti flow run rewind-test-evidence` is rejected with `STALE_TEST_EVIDENCE_BLOCKER_MISMATCH` because the latest attempt is not an `impl-gate` `external-blocked` outcome. The stale-evidence recovery branch of `senti flow run review --phase impl` also cannot be used because the active step is `impl-gate`, resulting in `REVIEW_SCOPE_INVALID`.

## Problem

`checkIntegrationTestArtifacts()` performs trust validation before detecting repair fingerprint mismatches. Because failed test artifacts return early during trust validation, `StaleIntegrationTestEvidence.recover()` is not called, and the `external-blocked` attempt required by `rewind-test-evidence` is not recorded.

There is no canonical path to regenerate test evidence after an implementation fix, leaving the flow unrecoverable at `impl-gate`.

## Reproduction Evidence

- Issue #455 / runId `2d0439dc-13ce-4358-846f-48278d21c02c`
- integration gate: `ARTIFACT_PLACEHOLDER: test artifact validation failed: spec-local requirement tests failed: R1, R3, R5, R7, R9`
- rewind: `STALE_TEST_EVIDENCE_BLOCKER_MISMATCH: the latest flow attempt must be an impl-gate external-blocked outcome`
- review recovery: `REVIEW_SCOPE_INVALID: no single active impl-review scope could be resolved`

## Proposal

Clarify the priority and authority between failed/malformed trust results and repair fingerprint mismatches, and allow the flow-level `impl-gate` to rewind to `test-execute` with auditing when an implementation fix has materialized and changed the fingerprint.

Options:

1. Have the integration gate detect fingerprint mismatches before the trust verdict and apply the existing `StaleIntegrationTestEvidence.recover()`.
2. Alternatively, record structural failures as an `ExternalBlockedOutcome` so `rewind-test-evidence` can consume them.

## Target

- `src/flow/lib/run-gate.js`
- `src/flow/lib/run-rewind-test-evidence.js`
- Related flow regression tests

## Completion Criteria

- After fixing the implementation following a failed test artifact, it is possible to return to `test-execute` through a guarded canonical command.
- Stale evidence invalidation and lifecycle transition are atomic and auditable.
- Recovery is possible without manually editing or deleting artifacts.
- Existing constraints around target guards, material repair, and artifact ownership are not weakened.

<details>
<summary>ja</summary>

stale test evidence の回復経路が impl-gate で閉塞する

## 現象

flow-level `impl-gate` で、以前の `test-execute-result.json` が requirement failure を含み、その後に実装修正で repair fingerprint が変わった場合、gate は `ARTIFACT_PLACEHOLDER` で停止する。

その後 `senti flow run rewind-test-evidence` を実行しても、最新 attempt が `impl-gate` の `external-blocked` outcome ではないため `STALE_TEST_EVIDENCE_BLOCKER_MISMATCH` で拒否される。`senti flow run review --phase impl` の stale-evidence 回復分岐も、active step が `impl-gate` のため `REVIEW_SCOPE_INVALID` で利用できない。

## 問題

`checkIntegrationTestArtifacts()` は trust validation を repair fingerprint mismatch の検出より先に行う。failed test artifact は trust validation で早期 return されるため、`StaleIntegrationTestEvidence.recover()` が呼ばれず、`rewind-test-evidence` が要求する `external-blocked` attempt も記録されない。

実装修正後に test evidence を再生成する正規経路がなく、flow が `impl-gate` で回復不能になる。

## 再現証跡

- Issue #455 / runId `2d0439dc-13ce-4358-846f-48278d21c02c`
- integration gate: `ARTIFACT_PLACEHOLDER: test artifact validation failed: spec-local requirement tests failed: R1, R3, R5, R7, R9`
- rewind: `STALE_TEST_EVIDENCE_BLOCKER_MISMATCH: the latest flow attempt must be an impl-gate external-blocked outcome`
- review recovery: `REVIEW_SCOPE_INVALID: no single active impl-review scope could be resolved`

## 提案

failed/malformed trust resultと repair fingerprint mismatch の優先順位・authority を整理し、実装修正が materialized して fingerprint が変わった場合に、flow-level `impl-gate` から監査付きで `test-execute` へ rewind できるようにする。

候補:

1. integration gate が fingerprint mismatch を trust verdict より先に検出し、既存の `StaleIntegrationTestEvidence.recover()` を適用する。
2. または structural failure を `ExternalBlockedOutcome` として記録し、`rewind-test-evidence` が消費できるようにする。

## 対象

- `src/flow/lib/run-gate.js`
- `src/flow/lib/run-rewind-test-evidence.js`
- 関連する flow regression tests

## 完了条件

- failed test artifact の後に実装を修正すると、guarded な正規コマンドで `test-execute` に戻れる。
- stale evidence の invalidation と lifecycle transition が原子的かつ監査可能である。
- artifact を手編集・削除せず回復できる。
- target guard、material repair、artifact ownership の既存制約を弱めない。

</details>