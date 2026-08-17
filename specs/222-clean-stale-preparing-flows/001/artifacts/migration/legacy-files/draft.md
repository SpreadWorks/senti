# Draft: 222-clean-stale-preparing-flows

**開発種別:** bugfix
**目的:** 新しい flow を開始するたびに表示される「preparing flow が N 件存在する」警告の件数が増え続ける問題を解消する。

## Scope Verification
- In scope (priority order — higher priority must be satisfied first):
  - **P1 (must)**: When a user starts a new flow (`flow set init`), the system shall automatically delete any preparing flow file older than the stale threshold before emitting the "preparing flow(s) already exist" warning. This alone addresses the cross-session accumulation case.
  - **P2 (must)**: When the automatic cleanup described in P1 runs, it shall treat any preparing flow file older than 1 hour (3,600,000 ms) as stale and eligible for deletion. The previous threshold of 24 hours shall no longer apply. This addresses the within-session accumulation case that P1 alone cannot fix.
- Out of scope (priority order — lower priority means deferred / excluded):
  - **P3 (excluded)**: Adding cleanup to read-only observation commands (e.g. `flow get status`) — violates read-only semantics.
  - **P4 (deferred)**: Adding an explicit manual cleanup sub-command (e.g. `flow clean preparing`) — automatic cleanup is expected to be sufficient.
  - **P5 (deferred)**: Supporting concurrent flow execution beyond current behavior — separate concern.

## Migration / Transition Notes
- `flow set init` の CLI インターフェース（オプション・引数・戻り値 JSON schema）は変更しない。変更は内部挙動のみで、既存ユーザーへの破壊的影響は発生しない。
- preparing flow のクリーンアップ閾値変更により、24 時間以上 1 時間未満の既存 preparing flow が次回 `flow set init` 実行時に削除される。preparing flow はもともと中間状態ファイルであり、永続データや成果物ではないため、データ損失には該当しない。
- 移行手順は不要。既存ユーザーは意識せずに新挙動を受け取る。

## Impact on Existing Features
- 影響ありの既存機能:
  - `flow set init`: When invoked, the command shall first run stale cleanup, so the warning count shall report only preparing flows created within the shortened threshold.
  - Preparing flow cleanup semantics: Files older than 1 hour shall be treated as stale and deleted (previously 24 hours). No other cleanup call site changes.
- 影響なし: 実行中の active flow (flow.json)、閾値以内の preparing flow、ActiveFlowRegistry、FlowStore、その他の永続状態。

## Q&A
- Q: 警告件数が累積する根本原因は何か？
  - A: **推奨解釈: cleanup が特定の成功パス（spec 準備完了時）でしか起動しない構造に起因する。** 根拠: existing code pattern — cleanup 呼び出しは単一パスに限定されており、中断・auto-check rejection・別 runId での再 init 等の経路では孤児が残る。
- Q: 閾値を 1 時間に設定する理由は？
  - A: **推奨: 1 hour (3,600,000 ms)。** 根拠: existing code pattern — preparing flow は「新規 flow 開始」と「spec 準備」の間だけ存在する ephemeral 状態で、通常数分で消費される。1 時間は「作業を短時間中断して戻る」ケースを許容しつつ、単一セッション内累積を防ぐバランス点。
- Q: 観測系コマンドに cleanup を組み込まない理由は？
  - A: **推奨: 組み込まない。** 根拠: guardrail — 状態参照コマンドに write 副作用を持たせると呼び出し側の期待を裏切り、Single Responsibility 違反となる。
- Q: 並行 flow 実行中のファイルを誤って削除しないか？
  - A: **推奨: 1 時間閾値で問題なし。** 根拠: existing code pattern — cleanup は時間閾値ベースであり、1 時間以内のファイルは保護される。1 時間を超える preparing flow は既に孤児と判断して差し支えない。

## Open Questions
- なし

## Decision Mode
- ユーザーは「修正すべきものはどれか」と質問し、ブレスト/評価ではなく決定モードであることを明示した。その上で提示された選択肢 [1]〜[4] から [1] を選択。本ドラフトはその決定を記録する確定版である。

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: ユーザーは決定モードで「新規 flow 開始時の cleanup」「閾値の見直し」を選択。観測系コマンドへの副作用と手動サブコマンドは除外。
