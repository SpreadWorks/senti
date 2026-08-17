In sdd-forge's `flow get` commands, the policy for handling states like "no active flow / no current task" is inconsistent across commands — some return `ok:false` (error) while others return `ok:true` with a special status.

## Background
During a draft review of #187 (new next-action CLI), the user pointed out that "it is unclear whether a result represents an error or is intended to return state."

## Tasks
- Audit existing `flow get` / `set` / `run` commands and enumerate their behavior when preconditions are not met
- "State query" commands (status, next-action, etc.) should return `ok:true` with an empty value or an explicit not-active state
- "Operation-on-specific-resource" commands (run gate, run finalize, etc.) should return `ok:false` as an error when guard conditions are not satisfied
- Document the policy in docs and fix any commands that deviate from it

## Related
- #187 cac6/T5: next-action CLI

<details>
<summary>ja</summary>

[ENHANCE] flow get/set/run コマンドの返却値設計（エラー vs 状態返却の方針統一）

sdd-forge の flow get 系コマンドで「active flow / current task が無い」ような状態のとき、ok:false（エラー）で返すべきか ok:true で特殊ステータスを返すべきかの方針がコマンドごとにブレている。

## 背景
#187 (next-action CLI 新設) の draft レビュー中に、ユーザーから「エラーなのか状態を返すことが目的なのか、判断がブレている」と指摘された。

## やること
- 既存の flow get / set / run 系コマンドを棚卸しし、それぞれの「前提条件を満たさない状態」での挙動を一覧化する
- 「状態を問い合わせる系」（status, next-action 等）は ok:true で空値や明示的な not-active 状態を返す
- 「特定リソースへの操作を前提とする系」（run gate, run finalize 等）はガード条件を満たさなければ ok:false でエラーにする
- 方針を docs に明文化し、逸脱しているコマンドを修正する

## 関連
- #187 cac6/T5: next-action CLI

</details>