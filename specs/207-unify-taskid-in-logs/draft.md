---
issue: 203
title: Unify taskId field across append-only logs (cac6/T10)
---

# Draft: Unify taskId field across append-only logs

**開発種別:** enhancement（cac6 分解タスク 10/11）

**目的:** metrics / notes / issue-log / prompt logs の各エントリに `taskId` フィールドを統一的に持たせ、タスク横断分析を可能にする。現在 per-task に分岐保存されている metrics / notes を単一フラット構造（append-only エントリ配列）に統一する。

## Requirements（優先順位順）

以下、各要件は `When/If ... , <X> shall ...` 形式で条件と期待挙動を対にする。優先度は P1 が最も高い。

### P1: データ構造の統一（最優先）
- **R1.1:** When flow state に metrics を追加するとき, `metrics` は append-only のエントリ配列として保存されること（`[{ taskId, phase, counter, delta, ts }]`）。per-task 分岐保存は行われないこと。
- **R1.2:** When flow state に note を追加するとき, `notes` は append-only のエントリ配列として保存されること（`[{ taskId, text, ts }]`）。per-task 分岐保存は行われないこと。
- **R1.3:** If entry が flow レベル（非 task）スコープで記録される場合, その `taskId` は `null` であること。
- **R1.4:** When issue-log にエントリを追加するとき, 各エントリは `taskId` フィールドを持つこと。
- **R1.5:** When prompt log（Logger の agent / git / event）にエントリを追加するとき, 各エントリは `taskId` フィールドを持つこと。

### P2: CLI スコープ推論
- **R2.1:** If active task が存在し, かつ CLI 実行時に `--task-id` が省略されている場合, エントリの `taskId` は active task の ID となること。
- **R2.2:** If active task が存在せず, かつ `--task-id` が省略されている場合, エントリの `taskId` は `null`（flow スコープ）となること。
- **R2.3:** When `--task-id <id>` が明示されたとき, 推論より明示値が優先されること。
- **R2.4:** If `--task-id <id>` に指定された id が tasks に存在しない場合, エラーを返すこと。

### P3: 読み取り API
- **R3.1:** When `flow get status` を実行したとき, `metrics` / `notes` は raw エントリ配列として返されること。
- **R3.2:** When `flow get status` を実行したとき, 集計済みビュー `metricsSummary` が併記されること（flow スコープ合計・task 別合計・全体合計を含む）。

### P4: alpha 版後方互換
- **R4.1:** If 旧形式の flow.json（per-task 保存形式）が読み込まれた場合, 明示的なエラーで拒絶されること（マイグレーションはしない）。

## Impact on existing

- 現在 metrics / notes を参照している内部処理（QA 回数カウント、report 集計、gate / resume 時の notes 表示）が新構造に追従する必要あり。
- issue-log / prompt log は既にフラット構造のため、フィールド追加のみで consumers は大きく影響しない。
- 既存 unit テストは新構造に合わせて刷新される。

## Constraints

- alpha 版ポリシーに従い、旧形式の読み込みは拒絶（明示エラー）。
- 外部依存なし（Node.js 組み込みのみ）。
- `src/` プロジェクト固有情報禁止ルール遵守。

## Edge cases

- active task あり + `--task-id` 明示 → 明示値が優先（explicit always wins）。
- active task なし + `--task-id` 省略 → flow scope（taskId=null）。
- active task なし + `--task-id <id>` 明示 → tasks に存在しなければエラー。
- `completeTask` 後も過去の taskId 付きエントリは保持される（履歴性）。
- Logger 呼び出し時に active flow が無い場合 → taskId=null、spec=null（既存の null 挙動を踏襲）。

## Test strategy

- **unit**: metrics / notes / issue-log / prompt log の各書き込み経路で taskId が正しく記録されること、`--task-id` 明示・推論・エラー系の分岐網羅。
- **integration**: `flow prepare → addTask → set metric (task scope) → completeTask → set metric (flow scope) → get status` の end-to-end シナリオで、taskId が正しく付与・分離・集計されることを検証。

## Alternatives considered

- **metrics をスコープ別 counter map (`metrics[taskKey][phase][counter]`) に保つ案** — issue 本文の「append-only」「flat 追記」要件と乖離するため却下。根拠: issue #203 本文。
- **エントリ配列 + 集計キャッシュ併用** — 整合維持コストが増え、読み取り時 aggregation のコストは小さいため却下。根拠: 既存 report.js の集計パターン。

## Future extensibility

- `flow get metrics --task-id X --phase impl` 等のクエリサブコマンド追加が容易（entry 配列を filter するだけ）。
- タスク別のトークン/コスト比較、QA 分布などの分析機能拡張の土台となる。
- 外部分析パイプラインへの接続（prompt JSON に taskId が含まれるため）が容易。

## Q&A（recommendation の根拠）

recommendation の根拠は (1) issue #203 本文 / (2) 既存コード構造 / (3) guardrail 原則 のいずれかに明示的に紐づけている。ユーザの選択は **decision モード**（brainstorm でなく意思決定）として確定済み。

### Q1: metrics データモデル
**[2] append-only イベント配列**: `metrics = [{taskId, phase, counter, delta, ts}]`。
根拠: issue #203「append-only ログ」「flat 追記」明記 (1)。

### Q2: notes データモデル
**[1] notes も append-only 配列**: `notes = [{taskId, text, ts}]`。
根拠: issue #203 が「note の scope も同じルールで CLI 推論」と明記 (1) + metrics との一貫性 (2)。

### Q3: CLI 明示スコープ指定
**[2] `--task-id <id>` のみ提供**。省略時は自動推論。
根拠: 既存 `flow run draft-task` が `--task-id` パターンを採用済み (2)。

### Q4: read 側 API
**[2] raw 配列 + 集計済みビュー併記**: `metrics` + `metricsSummary: { flow, tasks, total }`。
根拠: 既存 consumers（report.js, get-qa-count）は集計値を期待しており、破壊最小化のため両方提供 (2)。

### Q5: テスト戦略
**[2] unit + integration**。
根拠: task 境界を越えた invariant は複数コマンド連鎖で初めて検証可能 (3: Complete Context 原則)。

### Q6: 最終承認
[1] 承認。

- [x] User approved this draft
