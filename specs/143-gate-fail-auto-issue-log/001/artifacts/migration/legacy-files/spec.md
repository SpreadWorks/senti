# Feature Specification: 143-gate-fail-auto-issue-log

**Feature Branch**: `feature/143-gate-fail-auto-issue-log`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #89
**開発種別:** Enhancement

## Goal

`src/flow/registry.js` の gate エントリに post フック（FAIL 時の issue-log 自動記録）と onError フック（gate コマンド自体のクラッシュ記録）を追加する。AI のスキル指示遵守に依存せず、gate FAIL の追跡を確実にする。

## Scope

- `src/flow/registry.js` の `run.gate` エントリの post フックを拡張して、gate FAIL 時に issue-log エントリを自動追加する
- `run.gate` エントリに onError フックを追加して、gate コマンドのクラッシュを issue-log に記録する

## Out of Scope

- gate 以外のコマンド（review, finalize 等）への同様のフック追加
- issue-log の format 変更
- gate ロジック（`run-gate.js`）の変更

## Clarifications (Q&A)

- Q: エラーハンドリングパターンは？
  - A: `finalizeOnError` と同じ best-effort パターン。フック内でのエラーは catch して `console.error` で stderr に出力する（完全な黙殺ではない）。gate 本体のレスポンスをフックの二次障害で壊さないことが最優先。これは既存の `tryUpdateStepStatus` (registry.js L28) や `finalizeOnError` (run-finalize.js L39) と同じ設計判断であり、フック = 副作用であるため本体の結果を変えてはならない。

- Q: gate PASS 時の動作は？
  - A: issue-log への記録は行わない。既存の step status 更新のみ。

- Q: 複数回 gate 実行（リトライ）時はどうなるか？
  - A: FAIL ごとにエントリが追加される。これは意図通り — 各 FAIL の理由を個別に記録する。

- Q: gate FAIL は例外として扱われるのか？
  - A: gate FAIL は例外ではなく `result.result === "fail"` の正常レスポンスとして返される。post hook は PASS/FAIL 両方で呼ばれるため、post hook 内で `result.result !== "pass"` を判定して issue-log 記録を行う。onError hook が発火するのは gate コマンド自体が throw した場合（クラッシュ）のみ。

- Q: gate hook からの issue-log 書き込みで issueLog メトリクスは更新されるか？
  - A: gate hook からの issue-log 書き込みは `set issue-log` コマンドを経由しないため、`issueLog` メトリクスはインクリメントされない。これは `finalizeOnError` と同じ best-effort パターンに従う意図的な動作。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-04
- Notes: auto mode

## Requirements

Requirements are listed in priority order (highest first).

1. When `sdd-forge flow run gate` returns `result.result !== "pass"`, the post hook shall append an issue-log entry with: step = resolveGateStepId(ctx.phase), reason = gate FAIL issues summary, trigger = "gate post hook (auto)".
2. When `sdd-forge flow run gate` throws an error (command crash), the onError hook shall append an issue-log entry with: step = resolveGateStepId(ctx.phase), reason = error message, trigger = "gate onError hook (auto)".
3. When `sdd-forge flow run gate` returns `result.result === "pass"`, no issue-log entry shall be appended by the post hook.

## Implementation Notes

- post hook のシグネチャは `(ctx, result)` であり、issue-log の読み書きには `ctx.flowState.spec` を使ってパスを解決する。`finalizeOnError` パターンと同様に、worktree モードでの書き込み先消失を防ぐため `const logRoot = ctx.mainRoot || ctx.root;` でルートを解決してから `loadIssueLog(logRoot, ctx.flowState.spec)` / `saveIssueLog(logRoot, ctx.flowState.spec, issueLog)` を呼ぶ。
- FAIL reason は `result.artifacts.issues`（gate チェックで検出された問題の配列）から導出する（例: `result.artifacts.issues.join('; ')` またはその truncated summary）。`result.artifacts.issues` が空の場合は `result.artifacts.reasons.join('; ')` にフォールバックする。
- `ctx.phase` はディスパッチャが gate のターゲット引数から設定する。post hook では gate コマンドが正常完了しているため `ctx.phase` は常に存在する。onError hook 内では `ctx.phase` が undefined の可能性がある（例: コマンドモジュールの動的 import 自体が失敗した場合）。`resolveGateStepId(ctx.phase)` の呼び出しは `ctx.phase` の存在をガードし、undefined の場合はフォールバック値（例: `"gate"`）を使用する。
- onError hook は `finalizeOnError` と同じ worktree-safe パターン（`ctx.mainRoot || ctx.root`、try/catch ラップ、issue-log append）を使用する。`finalizeOnError` に省略可能な `trigger` パラメータを追加して一般化する。gate の onError は直接インライン実装してもよい（`finalizeOnError` の呼び出しでも同等）。
- フック内の処理は全て best-effort の try/catch でラップし、フック内エラーが gate 本体の結果を壊さないようにする。

## Acceptance Criteria

1. gate FAIL 時に `issue-log.json` にエントリが自動追加されること
2. gate PASS 時に issue-log にエントリが追加されないこと
3. gate コマンドのクラッシュ時に issue-log にエントリが追加されること
4. 既存の gate step status 更新が壊れないこと
5. 既存テストが全て PASS すること

## Test Strategy

- registry.js の gate エントリに post/onError フックが定義されていることの構造テスト
- `ctx.mainRoot` が設定されている場合（worktree モード）、issue-log が `ctx.root` ではなく `mainRoot` に書き込まれることを検証するテスト
- テスト配置: `specs/143-gate-fail-auto-issue-log/tests/` — spec 固有の検証テスト

## Existing Feature Impact

- **gate post hook**: 既存の step status 更新は維持。FAIL 時に issue-log 記録を追加。
- **gate の使用者（AI スキル）**: 変動なし。自動記録はフック内で完結。
- **issue-log.json**: エントリが自動追加されるようになる。フォーマットは既存と同一。
- **finalizeOnError**: 省略可能な `trigger` パラメータを受け付けるように一般化される。既存の呼び出し元（finalize）は引数なしのため影響なし。

## Open Questions
- (none)
