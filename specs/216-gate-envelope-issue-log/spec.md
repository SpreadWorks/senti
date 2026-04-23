# Feature Specification: 216-gate-envelope-issue-log

**Feature Branch**: `feature/216-gate-envelope-issue-log`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #224

## Goal
- gate エスカレーション判定 (`ESCALATE_RETRY_EXHAUSTED` / `NO_PROGRESS_SINCE_LAST_FAIL`) を `Envelope.fail` で返すパスでも、`ESCALATE_REPEATED_FAIL` (throw 経由) と同様に issue-log エントリを1件記録する。

## Background
- spec 213 で `checkRetryBelowMax` / `checkNoProgressSinceLastFail` は throw から `Envelope.fail` return へ変更された。dispatcher 成功パス (`src/lib/dispatcher.js:213-248`) は `result instanceof Envelope && result.ok === false` を `skipPost=true` として扱い、`entry.post` / `entry.onError` いずれも呼ばない。
- その結果、retry budget 超過と no-progress 判定は issue-log に残らず、`assertNoRepeatedFail` の throw 経由ケースだけが記録され挙動が非対称になっている。
- `appendIssueLogFromGateError(ctx, err)` (`src/flow/lib/run-gate.js:1457-1467`) は既に実装されており、`err.message` を `reason` として issue-log に追記する汎用ヘルパーとして利用できる。

## Scope
- `checkRetryBelowMax` が `ESCALATE_RETRY_EXHAUSTED` の `Envelope.fail` を返す直前に、同じ reason 文で issue-log エントリを1件追記する。
- `checkNoProgressSinceLastFail` が `NO_PROGRESS_SINCE_LAST_FAIL` の `Envelope.fail` を返す直前に、同じ reason 文で issue-log エントリを1件追記する。
- 既存 `skipPost=true` 挙動（`gateRetry` カウンタ非加算）は維持する。
- ユニットテストで次を検証する: (a) 両経路で issue-log エントリが1件追記される。(b) reason に envelope messages 由来の文字列が含まれる。(c) `gateRetry` メトリクスが増えていない。

## Out of Scope
- dispatcher (`src/lib/dispatcher.js`) の `skipPost` 分岐および success-path で Envelope.fail を honor する挙動の変更。
- `appendIssueLogFromGateError` のシグネチャ・フィールド追加・スキーマ変更。
- `assertNoRepeatedFail` (throw 経由) の記録経路の変更。
- `authorized_test_modifications` / `checkTestChanges` など gate の他の early-return パスの記録挙動変更。

## Constraints
- 外部依存なし (Node.js 組み込みのみ)。
- `src/` 配下。プロジェクト固有情報を含めない。
- 既存テストを修正しない。新規ユニットテストを追加する。
- issue-log 書き込み失敗時はエラーを呑まない。`appendIssueLogFromGateError` 内で発生した例外は呼び出し元に伝播する（既存挙動と同じ）。

## Design Principles
- **記録と判定の分離を保つ**: dispatcher は判定を honor しつつ post/onError を skip する。記録はドメイン層（gate ヘルパー）の責務として明示的に呼び出す。
- **既存ヘルパーの再利用**: 新しい書き込み経路を作らず、`appendIssueLogFromGateError` を使う。
- **retry budget 非消費の維持**: カウンタ加算は `updateGateRetryCounter` (post-hook) が担う。本修正は記録のみを追加し、retry 非加算の意図を変えない。

## Overview
### Modules
- `src/flow/lib/run-gate.js`: `checkRetryBelowMax`, `checkNoProgressSinceLastFail`, `appendIssueLogFromGateError` (既存)。

### Data Flow
- `executeDiffBasedGate` → `checkRetryBelowMax(ctx, phase)` または `checkNoProgressSinceLastFail({...})` → 判定成立時、新たに `appendIssueLogFromGateError(ctx, errLike)` 相当の呼び出しで issue-log へ追記 → `Envelope.fail` を return → dispatcher 成功パスで `skipPost=true` により post/onError 非実行。
- `errLike` は `{ message: messages.join("\n") }` 形の軽量オブジェクト、または `new Error(...)` を用いる。`appendIssueLogFromGateError` は `err.message || String(err)` しか参照しないため、どちらでも動作する。

### Decisions
- 記録のトリガを dispatcher 側ではなく gate ヘルパー内で実装する。理由: dispatcher は汎用ディスパッチャで、issue-log は flow/gate ドメインの関心事。ドメイン層で完結させることで他コマンドへ波及しない。
- reason 文は `Envelope.fail` に渡した `messages` と同じ内容（joined で1つの文字列）にする。`ESCALATE_REPEATED_FAIL` (throw 経由) と記録内容を揃えるため。
- エントリに `headSha` / `worktreeHash` / `failedEvaluations` は付与しない。`appendIssueLogFromGateError` の既存シグネチャを維持し、スキーマを拡張しない（`appendIssueLogFromGateResult` とは意図的に異なる簡易エントリ）。

## Clarifications
- Q: dispatcher の success-path で Envelope.fail を honor する設計 (spec 213) を変更する案は?
  - A: 採らない。`skipPost=true` による「gateRetry 非加算」という設計意図と不可分。判定と記録を分離し、記録だけドメイン層で追加する。
- Q: 記録用の新ヘルパーを作るか、既存 `appendIssueLogFromGateError` を流用するか?
  - A: 流用する。reason 文字列を書くだけの要件で、既存関数のシグネチャ (`err.message || String(err)` 参照) が合致する。

## Alternatives Considered
- **dispatcher を修正して skipPost 時も onError を呼ぶ**: onError の本来の契約 (成功パスを通らない=throw 経路) と矛盾し、汎用ディスパッチャに gate 固有の振る舞いを混ぜる。却下。
- **appendIssueLogFromGateResult を使って evaluations 付きで記録**: `checkRetryBelowMax` / `checkNoProgressSinceLastFail` は AI 評価結果を持たず、evaluations が空になる。エントリに意味のある構造情報が増えないため却下。throw 経路の記録 (reason のみ) と揃える。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-23
- Notes: auto-check 24/24. bugfix scope, 修正範囲も明確。

## Requirements

優先順位: **P1** は記録欠落の修正本体 (REQ-1 / REQ-2)、**P2** は挙動不変性の維持 (REQ-3)、**P3** は記録フォーマットの整合性 (REQ-4)。P1 が満たされなければ修正の目的を達成できない。

- REQ-1 (P1): `checkRetryBelowMax` が `Envelope.fail` (code=`ESCALATE_RETRY_EXHAUSTED`) を return する場合、同じ呼び出しで issue-log に新しいエントリが1件追記される。エントリの `reason` には envelope messages を連結した文字列が含まれる。
- REQ-2 (P1): `checkNoProgressSinceLastFail` が `Envelope.fail` (code=`NO_PROGRESS_SINCE_LAST_FAIL`) を return する場合、同じ呼び出しで issue-log に新しいエントリが1件追記される。エントリの `reason` には envelope messages を連結した文字列が含まれる。
- REQ-3 (P2): REQ-1 / REQ-2 のいずれのケースでも、`flowState.metrics[phase].gateRetry` は増加しない (既存の post-hook 非実行挙動を維持)。
- REQ-4 (P3): REQ-1 / REQ-2 で追記されるエントリの `phase` は呼び出し時の `phase` と一致し、`step` は `resolveGateStepId(phase)` の結果に一致する。

## Acceptance Criteria
- ユニットテスト `tests/unit/flow/lib/run-gate/...` に次を追加する:
  - `checkRetryBelowMax` が budget 超過時に `Envelope.fail` を return し、かつ `specs/<n>/issue-log.json` に reason 文字列を持つエントリを1件追記する (REQ-1, REQ-4)。
  - `checkNoProgressSinceLastFail` が state 一致時に `Envelope.fail` を return し、かつ `specs/<n>/issue-log.json` に reason 文字列を持つエントリを1件追記する (REQ-2, REQ-4)。
  - 両ケースで `flowState.metrics[phase].gateRetry` が変化しない (REQ-3)。
- `npm test` が PASS する。既存テストのスナップショット/期待値は変更しない。

## Implementation Targets
- `src/flow/lib/run-gate.js` (checkRetryBelowMax / checkNoProgressSinceLastFail 内部のみ)

## Open Questions
- なし
