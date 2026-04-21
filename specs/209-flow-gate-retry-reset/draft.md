# Draft: CLI reset flow when gate retry is exhausted

**開発種別:** enhancement
**目的:** gate retry 上限到達後、flow.json の直接編集なしで CLI からリセットできる導線を提供し、併せて `run gate` 実行前に残 retry 枠を警告表示する。

## 背景

`src/flow/lib/run-gate.js` の `assertRetryBelowMax` は、`task-impl` / `integration` の gate 連続 FAIL が `config.flow.retry.max` (default 3) に達した時点で `ESCALATE_RETRY_EXHAUSTED` を throw し、自動 retry ループを停止する。しかし、ユーザーが原因を修正した後に retry を再開する手段が CLI に存在せず、`specs/*/flow.json` の `metrics` に `{ phase, counter: "gateRetry", delta: 0, reset: true }` を手で追記する必要がある（spec 207 実装中に遭遇）。

## スコープ

1. 新コマンド `sdd-forge flow set gate-retry reset <phase>`
   - `phase` は `task-impl` または `integration` のみ許可（`RETRY_TRACKED_PHASES` と同じ集合）。
   - `--yes` フラグ必須。未指定時は現在の `gateRetry` 値を表示してエラー終了（誤操作防止）。
   - 実装は `flowManager.appendMetric({ phase, counter: "gateRetry", delta: 0, reset: true })` の append 1 回。既存の `countGateRetry` が reset セマンティクスを既にサポートしているため、差分はデータ投入点のみ。
2. `run-gate.js` の `executeDiffBasedGate` で、gate 評価の前に残 retry 枠を stderr に警告表示（`[sdd-forge] gate retry: <used>/<max> used (<remaining> remaining)`）。
3. `registry.js` に `set.gate-retry` コマンドを登録。help / args 定義を含む。

## 影響範囲

- 新規: `src/flow/lib/set-gate-retry.js`
- 変更: `src/flow/lib/run-gate.js`（警告表示の追加。ロジックは変えない）
- 変更: `src/flow/registry.js`（コマンド登録）
- 新規テスト: `tests/unit/flow/lib/set-gate-retry.test.js`

## 動機

- 正当な再実行を flow.json 直接編集なしで実現。
- retry 枠が誤って消費された場合の復帰導線。
- 残 retry 枠の可視化により、ユーザーが枯渇を事前に認識できる。

## Q&A

### Q1. Issue 内容の理解確認
- **Ask:** Issue #208 の内容に沿って、`run gate` 前の残 retry 枠警告と、`flow set gate-retry reset <phase>` リセット導線、およびリセット時のユーザー確認（誤操作防止）という理解で spec 化を進めてよいか？
- **Answer (user):** [1] はい

### Q2. 実装方針の合意
- **Ask:** 実装方針として (a) `RETRY_TRACKED_PHASES` 限定、(b) `--yes` 必須で interactive prompt は持たない、(c) 既存 `appendMetric` + `reset: true` の仕組みを流用、(d) `run-gate.js` には stderr 警告を 1 行追加するのみ、という方針で進めてよいか？
- **Answer (user):** [1] はい

## Alternatives Considered

| 案 | 採否 | 理由 |
|---|---|---|
| (A) 次回 gate 試行時に自動リセット | 不採用 | 誤操作混入リスクあり。「意図した再試行」と「無限ループ」の区別が失われる |
| (B) flow.json の手編集（現状） | 不採用 | UX が悪い。手順が属人化する |
| (C) 明示 CLI コマンド（`--yes` 必須） | 採用 | 監査ログに `reset: true` が残る。誤操作は `--yes` で物理的に防止 |

## Constraints / Guardrails

- 外部依存なし（Node.js 組み込みのみ）。既存モジュール構成を維持。
- `alpha` 版ポリシー: 後方互換コードは書かない。
- 設計パターン: 既存の `set-*.js` 系（`FlowCommand` 継承 + `execute(ctx)`）に揃える。
- `src/` 配下にプロジェクト固有情報を含めない（汎用コマンド）。

## Edge Cases

- 非対象 phase（`draft` / `spec` / `task-spec`）を指定した場合: エラー（`valid: task-impl, integration`）。
- `gateRetry` 記録が存在しない状態でのリセット: no-op（`reset: true` を 1 件 append するだけ。現 count が既に 0 なら結果も 0）。
- active flow が無い状態: `requiresFlow: true` により dispatcher 側で弾かれる。
- `--yes` 未指定: stderr に現在値を表示して non-zero exit。

## Test Strategy

- ユニット: `tests/unit/flow/lib/set-gate-retry.test.js`
  - 正常系: `reset <task-impl> --yes` → metrics に `{phase, counter: "gateRetry", delta: 0, reset: true}` が append される
  - `--yes` 未指定 → throw + 現在値表示（stderr）
  - 非対象 phase → throw
  - リセット後に `countGateRetry(state.metrics, phase)` が 0 を返す
- 既存の `countGateRetry` リセット動作は spec 201 で既にカバー済み。追加テスト不要。
- run-gate.js の警告表示は stderr 出力のみ。既存 e2e で回帰を検知できる。

## Future Extensibility

- `gateRetry` 以外の counter に retry セマンティクスが追加された場合、`set gate-retry reset` を `set retry reset <counter> <phase>` に汎化可能な形で配置する（現時点では over-engineering を避ける）。
- 将来 UI（Web ダッシュボード等）が追加された際は、この CLI コマンドを同じ append を行うラッパーとして呼び出せる。

## User Confirmation

- [x] User approved this draft
