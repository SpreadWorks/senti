# Feature Specification: 163-logger-callsite-replace

**Feature Branch**: `feature/163-logger-callsite-replace`
**Created**: 2026-04-09
**Status**: Draft
**Input**: GitHub Issue #123

## Goal

spec 153 で実装済みの `Logger.git` / `Logger.event` API を実際の呼び出し元に接続し、git 実行・パイプライン進捗・config ロード・flow step 変更を統合 JSONL ログに記録できるようにする。

## Scope

- `src/lib/process.js` の `runCmd` / `runCmdAsync` で git コマンド実行を検出して `Logger.git` を呼ぶ
- `Logger.event` を最低限の主要 call site（config-loaded / pipeline-step / flow-step-change / error）に追加する
- 上記の実装を検証するテストを作成する

## Out of Scope

- `Logger.event` の網羅的な call site 追加（主要4イベントのみ）
- `sdd-forge logs` ログ閲覧コマンド（別 spec）
- 集計・レポート機能（別 spec）
- 同期版 `loggerSync`（ボード ffe7）
- `pipeline-step` の終了イベント・duration / counts 計測

## Why This Approach

`runCmd` 内での git 検出（アプローチ [1]）を選んだ理由:
- `git-helpers.js` を経由しない `runCmd("git", ...)` 直接呼び出しも漏れなくカバーできる
- 変更箇所が1箇所（`runCmd` + `runCmdAsync`）に集約され、git-helpers の各関数を個別修正するより保守性が高い

## Clarifications (Q&A)

- Q: Logger.git をどのレイヤーでフックするか？
  - A: `runCmd` 内で `cmd === "git"` を検出して `Logger.getInstance().git(...)` を fire-and-forget で呼ぶ。`runCmdAsync` も同様。

- Q: Logger.event のイベント名命名規約は？
  - A: kebab-case（既存テスト `log.test.js` および issue 本文の例に合わせる）

- Q: catch ブロックで stderr + JSONL の二重ログは許容するか？
  - A: 許容する。stderr はリアルタイム通知、JSONL は後から追跡という役割が異なる。`cfg.logs.enabled = false` 時は JSONL に書かれないため常時二重にはならない

- Q: `pipeline-step` イベントのフィールド構造は？
  - A: `{ step, phase: "start" }` のシンプル構造。終了イベント・duration は今回スコープ外

## Alternatives Considered

- **git-helpers.js 各関数内でフック**: 関数の数だけ追加が必要で漏れリスクあり。`runCmd` 直接呼び出しは拾えない。→ 不採用

## Requirements

優先順位: P1（コア動作）→ P2（追加イベント）

**P1: Logger.git 接続**

1. `runCmd(cmd, args, opts)` は、`cmd === "git"` のとき、コマンド完了後に `Logger.getInstance().git({ cmd: [cmd, ...args], exitCode: result.status, stderr: result.stderr })` を fire-and-forget で呼ぶこと
2. `runCmdAsync(cmd, args, opts)` も同様に `cmd === "git"` を検出し、`Logger.git` を fire-and-forget で呼ぶこと
3. `Logger` が未初期化または `cfg.logs.enabled !== true` の場合は no-op であること（既存動作、変更なし）
4. `runCmd` / `runCmdAsync` の関数シグネチャ・戻り値は変更しないこと

**P2: Logger.event 接続（最低限の主要 call site）**

5. `loadConfig` 完了時に `Logger.getInstance().event("config-loaded", { path, keys })` を呼ぶこと
6. docs build パイプラインの各ステップ開始時に `Logger.getInstance().event("pipeline-step", { step, phase: "start" })` を呼ぶこと（対象: scan / enrich / init / data / text / readme / agents / translate）
7. `flow set step` で step 状態が変更されたとき `Logger.getInstance().event("flow-step-change", { step, status })` を呼ぶこと
8. 既存の重要な `console.error` 出力箇所（ユーザーに見せるレベルのエラー）に `Logger.getInstance().event("error", { message })` を追加すること

## Acceptance Criteria

- `cfg.logs.enabled = true` の状態で git コマンドを実行すると、JSONL に `type: "git"` レコードが append される
- `cfg.logs.enabled = true` の状態で docs build パイプラインを実行すると、各ステップに対応する `type: "event", name: "pipeline-step"` レコードが記録される
- `cfg.logs.enabled = false`（または未設定）の状態では JSONL に何も書かれない（既存の no-op 動作を維持）
- `runCmd` / `runCmdAsync` の戻り値オブジェクトの構造が変わっていない

## Test Strategy

**配置**: `specs/163-logger-callsite-replace/tests/`（spec 要件検証テスト）

- `runCmd("git", ...)` を実行 → Logger が有効なとき JSONL に `type: "git"` レコードが記録されること
- `runCmdAsync("git", ...)` を実行 → 同様に記録されること
- `runCmd("gh", ...)` など git 以外は JSONL に記録されないこと
- `cfg.logs.enabled = false` のとき何も記録されないこと（disabled モード回帰）

## Open Questions

- なし

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-09 (autoApprove)
- Notes: Q&A フェーズで設計判断を完了済み。gate PASS 後に自動承認。
