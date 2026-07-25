## Summary
Even after a plan rewind, the `implement` step completion check accepts persistent evidence generated before the rewind. `approval` checks freshness against the latest rewind epoch and rejects stale evidence, but `implement` lacks an equivalent check, so old artifacts that were retained or skipped can incorrectly satisfy completion conditions.

## Problem
The `implement` step determines completion by validating test artifacts on disk, but it does not verify whether each piece of evidence was generated after the latest plan rewind. As a result, scenario, test execution, and result review evidence that does not correspond to the current plan may still be marked complete based only on existence and machine validation.

## Evidence
- `src/flow/lib/plan-rewind.js` has freshness checks based on the latest `rewoundAt`.
- The `approval` completion check in `src/flow/lib/set-step.js` uses this freshness contract.
- The `implement` completion check in the same file checks `status`, file maps, artifacts, and machine validators, but does not apply rewind freshness to scenario, test, or review evidence.

## Acceptance Criteria
- The `implement` completion check rejects evidence generated before the latest rewind as stale.
- Required scenario, test execution, and result review evidence is evaluated by correspondence with the current plan epoch, not by whether residual files exist.
- Current behavior is preserved for flows where no rewind has occurred.
- Stale evidence and missing / malformed evidence are handled as distinct, identifiable errors.
- Focused tests cover retained, skipped, regenerated, and no-rewind cases.

## Scope
Only fix `implement` evidence eligibility after plan rewind.

## Out of Scope
- Changes included in issue #443 are not part of this issue.

<details>
<summary>ja</summary>

implement 完了判定が rewind 前の永続証跡を受理する

## 概要
plan rewind 後でも、`implement` step の完了判定が rewind 前に生成された永続証跡を受理してしまう。`approval` は最新 rewind epoch に対する freshness を確認して stale な証跡を拒否するが、`implement` には同等の判定が不足しているため、保持または skip された古い artifact が誤って完了条件を満たし得る。

## 問題
`implement` step は disk 上の test artifact を検証して完了を判定するが、各証跡が最新の plan rewind 後に生成されたものかを確認していない。その結果、最新 plan と対応しない scenario・test execution・result review 証跡でも、存在と機械検証だけで完了扱いになる可能性がある。

## 根拠
- `src/flow/lib/plan-rewind.js` には最新 `rewoundAt` を基準にした freshness 判定がある。
- `src/flow/lib/set-step.js` の `approval` 完了判定はこの freshness 契約を利用している。
- 同ファイルの `implement` 完了判定は `status`、file map、artifact、機械 validator を確認するが、scenario・test・review 証跡に rewind freshness を適用していない。

## Acceptance Criteria
- `implement` 完了判定は、最新 rewind より前に生成された証跡を stale として拒否する。
- 必須の scenario・test execution・result review 証跡は、残存ファイルの有無ではなく current plan epoch との対応で評価される。
- rewind が発生していない flow では現行動作を維持する。
- stale な証跡と missing / malformed な証跡を別エラーとして扱い、識別できる。
- retained・skipped・regenerated・no-rewind の各ケースを focused test で検証する。

## スコープ
plan rewind 後の `implement` evidence eligibility の修正のみを対象とする。

## Out of Scope
- Issue #443 に含まれる変更はこの issue に含めない。

</details>