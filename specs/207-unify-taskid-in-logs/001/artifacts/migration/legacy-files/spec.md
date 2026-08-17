# Feature Specification: 207-unify-taskid-in-logs

**Feature Branch**: `feature/207-unify-taskid-in-logs`
**Created**: 2026-04-21
**Status**: Ready for gate
**Input**: Issue #203 (cac6/T10)

## Goal

metrics / notes / issue-log / prompt logs の各エントリに `taskId` フィールドを統一的に持たせ、タスク横断分析を可能にする。現在 per-task に分岐保存されている metrics / notes を単一フラット構造（append-only エントリ配列）に統一する。

## Scope

- `state.metrics` / `state.notes`（flow.json）を append-only エントリ配列へ刷新する
- `state.tasks[].metrics` / `state.tasks[].notes`（per-task 分岐保存）を廃止する
- issue-log（`specs/<spec>/issue-log.json`）の各エントリに `taskId` フィールドを追加する
- prompt log（daily JSONL + per-request JSON）の各エントリに `taskId` フィールドを追加する
- CLI `flow set metric` / `flow set note` / `flow set issue-log` に `--task-id <id>` オプションを追加する
- active task 有無による taskId 自動推論を CLI 側で行う
- `flow get status` は raw エントリ配列 + 集計済みビュー (`metricsSummary`) を返す
- 既存 consumers（QA 回数カウント、report 集計、gate/resume の notes 表示）を新構造に対応させる

## Out of Scope

- 既存ログファイル（過去の issue-log.json / JSONL）からのマイグレーション（alpha 版ポリシーにより後方互換なし、明示エラーで拒絶）
- `flow get metrics --task-id X --phase impl` 等の新クエリサブコマンド（後続タスク）
- docs の更新（`/sdd-forge.flow-sync` で別途同期）

## Clarifications (Q&A)

- Q: metrics のデータモデルは？
  - A: append-only イベント配列 `[{taskId, phase, counter, delta, ts}]`。根拠: issue #203 が「append-only」「flat 追記」明記。
- Q: notes のデータモデルは？
  - A: append-only 配列 `[{taskId, text, ts}]`。metrics と一貫。
- Q: CLI の明示スコープ指定は？
  - A: `--task-id <id>` のみ提供。省略時は active task 推論。
- Q: read 側 API の形は？
  - A: raw 配列 + 集計済みビュー `metricsSummary: { flow, tasks, total }` を併記。
- Q: テスト戦略は？
  - A: unit + integration（task 境界越えの invariant 検証のため）。
- Q: 旧形式 flow.json はどう扱う？
  - A: 明示エラーで拒絶（マイグレーションしない、alpha 版ポリシー）。

## Alternatives Considered

- **metrics をスコープ別 counter map (`metrics[taskKey][phase][counter]`) に保つ案**: issue 本文の「append-only」「flat 追記」要件と乖離するため却下。
- **エントリ配列 + 集計キャッシュ併用案**: 書き込み毎の整合維持コストが増え、読み取り時集計のコストは小さいため却下。

## Why This Approach

- issue #203 は「append-only ログ」「単一ファイルに flat 追記（分割しない）」を明示要件としており、append-only エントリ配列がこれに直接適合する。
- 既存の `resolveMutationScope` 経由の per-task 分岐保存は、task 完了後にその task の metrics/notes が構造的に分離されたままとなり、横断分析に不向き。フラット化により、taskId を単なる filter key として扱えるようになる。
- issue-log / prompt log は既にフラット構造のため、taskId フィールド追加のみで整合が取れる。統一データモデルにより、全ログを横断的にクエリする後続機能の基盤となる。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-21
- Notes: draft Q1-Q6 で合意済み。auto mode で実装へ進む。

## Requirements

優先順位順（P1 が最優先）。各要件は `When/If ... , <X> shall ...` 形式。

### P1: データ構造の統一

- **R1.1:** When flow state に metrics エントリが追加されるとき, 当該エントリは `{ taskId, phase, counter, delta, ts }` を持つ単一の append-only 配列（`state.metrics`）に追記される shall。per-task 分岐保存は廃止する shall。
- **R1.2:** When flow state に note エントリが追加されるとき, 当該エントリは `{ taskId, text, ts }` を持つ単一の append-only 配列（`state.notes`）に追記される shall。per-task 分岐保存は廃止する shall。
- **R1.3:** If エントリが flow レベル（非 task）スコープで記録される場合, その `taskId` は `null` である shall。
- **R1.4:** When issue-log にエントリが追加されるとき, 当該エントリは `taskId` フィールドを持つ shall。
- **R1.5:** When Logger の agent / git / event 経路でエントリが JSONL に追記されるとき, 当該エントリは `taskId` フィールドを持つ shall。

### P2: CLI スコープ推論

- **R2.1:** If active task が存在し、CLI コマンドに `--task-id` が指定されていない場合, 書き込まれるエントリの `taskId` は active task の ID となる shall。
- **R2.2:** If active task が存在せず、`--task-id` が指定されていない場合, 書き込まれるエントリの `taskId` は `null` となる shall。
- **R2.3:** When `--task-id <id>` が指定されたとき, 推論結果より明示値が優先される shall。
- **R2.4:** If `--task-id <id>` に指定された id が state.tasks に存在しない場合, コマンドはエラーを返し非ゼロ終了コードで終了する shall。

### P3: 読み取り API

- **R3.1:** When `flow get status` が実行されるとき, `metrics` / `notes` は raw エントリ配列として返される shall。
- **R3.2:** When `flow get status` が実行されるとき, 集計済みビュー `metricsSummary: { flow, tasks: { <id>: ... }, total }` が返される shall。

### P4: alpha 版後方互換

- **R4.1:** If 旧形式の flow.json（`task.metrics` / `task.notes` を含む、または `state.metrics` が非配列の）読み込みが発生した場合, 明示エラーで拒絶される shall（マイグレーションは行わない shall）。

## Acceptance Criteria

- `flow-store` の metrics/notes 書き込みが append-only 配列へのエントリ追加となり、per-task 保存が行われないことが unit テストで確認される。
- `flow set metric`, `flow set note`, `flow set issue-log` の各 CLI が `--task-id` オプションを受け付け、active task 推論 / 明示指定 / 不明タスクエラーの 3 分岐が unit テストで網羅される。
- Logger の agent / git / event が書き出す JSONL エントリに `taskId` が含まれることが unit テストで確認される。
- `flow get status` が raw 配列 + `metricsSummary` を返すことが unit テストで確認される。
- integration シナリオ: task 作成 → set metric (task scope) → completeTask → set metric (flow scope) → get status で、taskId の付与と集計が期待通りであることが確認される。
- 旧形式 flow.json 読み込み時にエラーで拒絶されることが unit テストで確認される。
- 全既存テストが新構造下で PASS する（テストコードは新構造対応のため刷新される。承認済み: draft Q5）。

## Impact on Existing Features

- QA 回数カウント（`get-qa-count`）: entry 配列対応へ刷新。
- report 集計（`report.js` の `aggregateActivityMetrics` / `aggregateTokenMetrics`）: entry 配列対応へ刷新。
- gate / resume の notes 表示: flat 配列をそのまま扱う（taskId フィルタなし、全件表示）。
- issue-log / prompt log: フィールド追加のみ、consumers に構造的影響なし。

## Test Strategy

**unit:**
- `flow-store`: metrics/notes 追加が append-only 配列への単一エントリ追加となること、per-task 分岐が行われないこと、旧形式拒絶の分岐。
- `set-metric` / `set-note` / `set-issue-log`: `--task-id` 明示 / 省略時推論 / active task 無時の null / 不明 id エラーの 4 分岐。
- Logger: agent / git / event のエントリに taskId が含まれること、active flow 無時に null となること。
- `get-status`: raw 配列と `metricsSummary` の両方が返されること、空 state 時の挙動。

**integration:**
- `flow prepare → addTask → set metric (推論で task scope) → set note → completeTask → set metric (推論で flow scope) → get status` の end-to-end で、エントリの taskId と集計値が期待通り。

**bounded resource:**
- CLI の flow state mutation は単一書き込み（リトライなし、深さ 1）。
- Logger の非同期書き込みはエントリ毎 1 回の append（リトライなし、深さ 1）。
- `metricsSummary` 集計は `state.metrics` 配列の単一 pass（O(n) 線形、`n = エントリ総数`、再帰なし）。
- integration テストのシナリオは固定 1 タスクの線形操作（最大 10 ステップ以内、再帰なし）。
- いずれのパスも再帰・無限ループ・無上限リトライを含まない。

## Authorized Existing Test Modifications

- `tests/unit/flow/set-metric.test.js` — legacy counter-map assertions rewritten to flat entry assertions per R1.1 (user-approved in draft Q5).
- `tests/unit/flow/gate-retry-counter.test.js` — legacy counter-map reads replaced by flat-entry filter to support R1.1 append-only metrics.
- `tests/unit/lib/flow-manager-tasks.test.js` — per-task `task.notes` string assertions replaced by flat `notes[{taskId,text,ts}]` entries per R1.2 / R4.1.
- `tests/unit/lib/flow-state-agent-metrics.test.js` — nested token-structure assertions replaced by flat agent-entry plus `buildMetricsSummary` aggregation per R1.1.
- `tests/unit/flow/commands/report-metrics.test.js` — test harness rewritten to emit flat metrics entries from a phase-shorthand so report code sees R1.1 shape.
- `tests/e2e/flow/commands/set-request-note.test.js` — legacy string-array notes assertions replaced by flat `{taskId,text,ts}` entry assertions per R1.2.
- `tests/e2e/flow/gate-impl-integration.test.js` — legacy nested gateRetry fixture replaced by flat entry fixture with reset-aware counter derivation per R1.1.

## Open Questions

なし（draft Q1-Q6 で全解決済み）。
