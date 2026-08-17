## Background

Currently, auto-check is evaluated only once at the beginning of the flow. Even for minor fixes, a thin request leads to rejection, and users give up and proceed in manual mode. However, as the flow progresses, information (issue retrieval, draft, spec, etc.) naturally accumulates, so re-evaluation at a later point may result in eligibility.

If a user wanted auto mode but was rejected, we should remember that intent and proactively suggest "you can now proceed in auto mode" once enough information is available.

## Requirements

- R1: Add an `autoDesired` flag to flow.json. When `flow set auto on` is executed and rejected with `eligible=false`, persist `autoDesired=true`. Set to `false` when `flow set auto off` is run.
- R2: Re-run auto-check in a hook upon phase completion (at least draft done / spec approved). Target flows where `autoDesired=true` and `autoApprove=false`.
- R3: If the re-evaluation results in eligibility, include a promotion candidate signal (e.g., `autoUpgrade: { available: true, reason }`) in the next next-action envelope.
- R4: On the skill side, upon seeing that signal, present the user with options: `[1] Switch to auto  [2] Continue in manual`.
- R5: Do not save failed verdicts to flow.json (from old #5). A stale verdict left before re-evaluation would block promotion detection; the set-auto side should also trust `eligible=true` only.
- R6: Do not send promotion notifications to users with `autoDesired=false` (opt-in).

## Out of Scope

- Relaxing hard-gate zero-tolerance / THRESHOLD re-tuning is a separate issue (tuning).
- Improving reason string display (not needed here since users won't read reason under this feature).

## Related

- Integrates #5 from Issue #255 into this feature
- Continuation of the auto-check feature series alongside specs 208 / 213 / 218 / 220

<details>
<summary>ja</summary>

[ENHANCE] auto-check: フェーズ進行に伴う昇格提案 (autoDesired フラグ + 再評価 + 通知)

## 背景

現状 auto-check はフロー初期の 1 点でしか評価されない。軽微修正でも request が薄いと reject され、ユーザーは諦めて手動モードで進める。しかしフローが進むにつれて情報（Issue 取得、draft、spec 等）は自然に蓄積されるため、後から再評価すれば eligible になる可能性がある。

ユーザーが auto モードを希望したのに reject された場合、その意思を覚えておき、情報が揃った時点で能動的に「今なら auto で進められます」と提案する。

## 要件

- R1: flow.json に autoDesired フラグを追加。`flow set auto on` 実行時、eligible=false で reject された場合でも autoDesired=true を永続化する。`flow set auto off` で false に戻る。
- R2: フェーズ完了時（少なくとも draft done / spec approved）の hook で auto-check を再実行。対象は autoDesired=true かつ autoApprove=false の flow。
- R3: 再評価で eligible に転じた場合、次の next-action envelope に昇格候補シグナル（例: `autoUpgrade: { available: true, reason }`）を含める。
- R4: skill 側はそのシグナルを見たらユーザーに選択肢を提示 `[1] auto に切り替える [2] 手動のまま進める`。
- R5: failed verdict を flow.json に保存しない（旧 #5）。再評価前に古い verdict が残っていると昇格判定が阻害されるため。set-auto 側も eligible=true のときのみ trust。
- R6: autoDesired=false のユーザーには昇格通知しない（オプトイン）。

## スコープ外

- hard-gate zero-tolerance 緩和・THRESHOLD 再調整は別 issue（tuning）。
- reason 文字列の表示改善（この機能下ではユーザーが reason を読まないため不要）。

## 関連

- Issue #255 の #5 を本機能に統合
- spec 208 / 213 / 218 / 220 と連続する auto-check 系の機能

</details>