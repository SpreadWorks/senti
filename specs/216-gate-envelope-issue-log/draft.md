# Draft: 216-gate-envelope-issue-log

**開発種別:** bugfix
**目的:** gate エスカレーション判定 (`ESCALATE_RETRY_EXHAUSTED` / `NO_PROGRESS_SINCE_LAST_FAIL`) で issue-log にエントリが記録されないバグを修正し、throw 経由の `ESCALATE_REPEATED_FAIL` と挙動を揃える。

## Scope Verification
- In scope:
  - `checkRetryBelowMax` / `checkNoProgressSinceLastFail` が `Envelope.fail` を返す直前に `appendIssueLogFromGateError` を呼び、issue-log にエントリを書く。
  - 既存の `skipPost=true` 挙動（gateRetry カウンタ非加算）は維持する。
  - 両経路で issue-log エントリが1件のみ書かれ、重複しないことをユニットテストで検証。
- Out of scope:
  - dispatcher 側 (`src/lib/dispatcher.js:213-233`) の `skipPost` ロジック変更。成功パスで Envelope.fail を honor する設計は spec 213 の意図であり、本修正では触らない。
  - `assertNoRepeatedFail` の throw 経由の記録経路（既に動作している）。
  - issue-log エントリのスキーマ・フィールド追加。既存 `appendIssueLogFromGateError` をそのまま流用する。

## Impact on Existing Features
- 影響ありの既存機能:
  - gate-impl / gate-task-impl の retry budget 超過時・no-progress 時に issue-log に FAIL エントリが追記されるようになる（現状は抜けている）。これにより後続の retro / review / 監査が完全になる。
- 影響なし:
  - 正常 PASS / 通常 FAIL / repeated-identical-FAIL の issue-log 記録経路は変更なし。
  - gateRetry カウンタの増減ルール（成功パス `skipPost=true` により非加算）は維持。
  - dispatcher の共通ディスパッチ経路、他コマンドの onError 経路に影響なし。

## Q&A
- Q: dispatcher の成功パスで Envelope.fail を honor する挙動 (spec 213) を元に戻す選択肢はないか。
  - A: 戻すと `skipPost=true` による「gateRetry 非加算」という設計意図も失われ、判定失敗が retry 回数を消費してしまう。修正は「記録だけ追加」に絞り、判定と記録の分離を保つ。
- Q: 記録を dispatcher 側で skipPost 時に共通処理として行う案は?
  - A: dispatcher は汎用ディスパッチャで、issue-log 書き込みは flow/gate ドメインの関心事。ドメイン層 (`checkRetryBelowMax` / `checkNoProgressSinceLastFail`) に留めるのが関心分離として自然。
- Q: `appendIssueLogFromGateError` の引数は `Error` 想定だが Envelope.fail のメッセージで呼べるか。
  - A: 実装は `err.message || String(err)` を参照するのみ。`new Error(messages.join("\n"))` 形の合成エラーを作って渡す、または messages を直接合成して書き込む小ヘルパーに揃える。

## Open Questions
-

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-23
- Notes: auto-check score 24/24, all hard gates satisfied.
