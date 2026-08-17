## Target
Recovery evidence evaluation for `sdd-forge flow set retry reset` after retry exhaustion. The main targets are the phase-specific evidence sources in `src/flow/lib/retry-recovery.js` and the actual behavior of the related review / gate prompts.

## Problem
Currently, the impl-review prompt instructs users to record acknowledgement in `spec.json` under `constraints` / `clarifications` / `alternatives_considered` as a recovery action for guardrail exceptions. However, recovery evidence evaluation for review impl only looks at `src`, so even if `spec.json` is modified exactly as instructed, it may be rejected as `unchanged-evidence` after retry exhaustion.

For impl-gate, the normal no-progress guard checks the diff / status of the entire worktree, but the retry-exhausted reset evaluation uses only `src` as the evidence source for gate task-impl. As a result, cases that should be reevaluated based only on fixes to accountability notes or guardrail acknowledgements cannot recover.

## Cause
The reevaluation input artifacts for each phase do not match the artifacts that the prompts actually instruct users to modify. In particular, `spec.json` can be a valid recovery input for impl-review / impl-gate, but it is excluded from the recovery fingerprint target.

## Improvement Plan
- For review impl, include `spec.json`, the guardrail acknowledgement surface, in recovery evidence in addition to `src`.
- For gate task-impl, also make it possible to treat at least `spec.json` acknowledgement changes as recovery evidence.
- Do not unconditionally treat `issue-log.json` as evidence, because it could become a loophole that allows retry reset by itself. Limit it to cases where it is actually meaningful as reviewer / gate input for the phase, or where it is combined with `spec.json` / implementation diffs.
- Add unit tests around `resolveRecoveryEvidenceSource` and `buildRecoveryEligibilityForState` to verify that `spec.json` changes result in `changed-evidence`, and that unintended phases do not pass with only issue-log changes.

## Reason to Keep on the Board
This mismatch creates a real operational dead end where, after SDD flow reaches retry exhaustion, the CLI rejects the correct fix that the prompt guided the user to make. It does not happen constantly, but when it does, recovery cost is high, and it directly affects the flow's self-recovery capability, so it is worth improving.

## Completion Criteria
- In impl-review, a case where only the `spec.json` acknowledgement is fixed can recover from retry without unnecessary `src` changes.
- In impl-gate retry-exhausted recovery, valid `spec.json` acknowledgement fixes are treated as changed evidence.
- A simple append-only change to `issue-log.json` does not allow retry reset for unintended phases.
- Unit tests covering the above behavior are added.

<details>
<summary>ja</summary>

[ENHANCE] retry recovery: spec と issue-log の変更も再評価 evidence に含める

## 対象
retry exhausted 後の sdd-forge flow set retry reset の recovery evidence 判定。主な対象は src/flow/lib/retry-recovery.js の phase 別 evidence source と、関連する review / gate prompt の実挙動である。

## 問題
現状は impl-review の prompt が、guardrail exception の回復策として spec.json の constraints / clarifications / alternatives_considered への acknowledgement 記録を指示している。一方で recovery evidence 判定では review impl が src だけを見ているため、指示どおり spec.json を修正しても retry exhausted 後に unchanged-evidence として拒否され得る。

impl-gate も通常の no-progress guard は worktree 全体の diff / status を見るが、retry exhausted の reset 判定では gate task-impl が src のみを evidence source にしている。このため、説明責務や guardrail acknowledgement の修正だけで再評価したいケースが recovery できない。

## 原因
phase ごとの再評価入力 artifact が、実際に prompt が修正先として指示する artifact と一致していない。特に impl-review / impl-gate で spec.json が正当な回復入力になり得るのに、recovery fingerprint の対象から外れている。

## 改善方針
- review impl は src に加えて、guardrail acknowledgement surface である spec.json を recovery evidence に含める。
- gate task-impl も、少なくとも spec.json の acknowledgement 変更を recovery evidence として扱えるようにする。
- issue-log.json は単独で retry reset を許可する抜け道になり得るため、無条件には evidence にしない。phase の reviewer / gate 入力として実際に意味を持つ場合、または spec.json / 実装差分と組み合わせる場合に限定する。
- resolveRecoveryEvidenceSource と buildRecoveryEligibilityForState 周辺に、spec.json 変更で changed-evidence になること、意図しない phase では issue-log だけで通らないことを確認する単体テストを追加する。

## ボードに残す理由
この不一致は、SDD flow が retry exhausted した後に、prompt が案内した正しい修正を CLI が拒否するという実挙動上の詰まりを生む。発生頻度は常時ではないが、発生時の復旧コストが高く、flow の自己回復性に直結するため改善価値がある。

## 完了条件
- impl-review で spec.json acknowledgement の修正だけを行ったケースが、不要な src 変更なしに retry recovery できる。
- impl-gate の retry exhausted recovery でも、正当な spec.json acknowledgement 修正が changed evidence として扱われる。
- issue-log.json の単純な追記だけでは、意図しない phase の retry reset を通せない。
- 上記を覆う単体テストが追加されている。

</details>