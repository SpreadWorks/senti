# Feature Specification: 145-review-subprocess-retry

**Feature Branch**: `feature/145-review-subprocess-retry`
**Created**: 2026-04-04
**Status**: Draft
**Issue**: #94

## Goal

`src/flow/lib/run-review.js` の `RunReviewCommand.execute()` で使用している `runCmd()` 呼び出しにリトライ機構を追加し、AI サブプロセスの一時的なクラッシュ時に自動回復できるようにする。

## Design Rationale

`src/lib/agent.js` の `callAgentAsyncWithRetry` に同様のリトライパターンが存在するが、それは非同期（spawn ベース）。run-review.js は同期の `runCmd`（execFileSync）を使用しているが、`execute()` は async メソッドなので、await + setTimeout による非同期スリープが使える。

リトライは `run-review.js` 内にローカル関数として実装する。`process.js` の `runCmd` は汎用ユーティリティであり、リトライの必要性は呼び出し側が判断すべき。

## Scope

1. `src/flow/lib/run-review.js` の `execute()` に runCmd のリトライラッパーを追加

## Out of Scope

- `src/lib/process.js` の `runCmd` 自体の変更
- `src/lib/agent.js` のリトライ機構の共通化
- リトライ回数・間隔の設定ファイルによるカスタマイズ

## Clarifications (Q&A)

- Q: リトライ回数と間隔は？
  - A: retryCount=2（計3回試行）、retryDelayMs=3000（3秒）。agent.js のデフォルトと同じ。

- Q: どの失敗条件でリトライするか？
  - A: `res.ok === false` の場合。ただし stderr に `killed` や `signal` が含まれる場合（タイムアウト等）はリトライしない。

- Q: execute() は async だが runCmd は同期。スリープはどう実装するか？
  - A: `await new Promise(r => setTimeout(r, delayMs))` で非同期スリープ。agent.js と同じパターン。

## Impact on Existing Features

- **run-review.js**: `execute()` 内の runCmd 呼び出し部分のみ変更。リトライなしの場合と同じ結果を返す（1回目で成功すればリトライは発生しない）。
- **既存テスト**: run-review.js の既存ユニットテストはない。
- **CLI インターフェース**: 変更なし。

## Priority

1. **P1**: リトライラッパー関数の実装
2. **P2**: リトライ条件の判定（killed/signal の除外）
3. **P3**: テスト追加

## Requirements

### R1: runCmd 呼び出しにリトライを追加する

`RunReviewCommand.execute()` 内の `runCmd()` 呼び出しを、最大3回（retryCount=2）まで再試行するように変更する。リトライ間隔は3秒（retryDelayMs=3000）。

### R2: タイムアウト・シグナル終了ではリトライしない

stderr に `killed` や `signal` 関連の情報が含まれる場合、またはプロセスがシグナルで終了した場合はリトライせずに即座にエラーを返す。

### R3: リトライ中の進捗をstderrに出力する

リトライ発生時に `[review] retry N/M after Nms...` のようなメッセージを stderr に出力し、デバッグ可能にする。

### R4: リトライロジックのテストを追加する

リトライラッパー関数のユニットテストを作成する。runCmd をモック化し、失敗→成功、全失敗、即座の成功、killed による即座終了の各パターンを検証する。テストは必須であり、省略しない。

## Acceptance Criteria

- [ ] runCmd が1回目で失敗し2回目で成功した場合、正常な結果が返ること
- [ ] 3回すべて失敗した場合、最後の失敗結果でエラーが throw されること
- [ ] タイムアウト（killed）の場合はリトライせず即座にエラーが返ること
- [ ] 1回目で成功した場合、リトライは発生せず既存と同じ動作であること
- [ ] `npm test` が通ること

## Test Strategy

- **テスト対象**: リトライラッパー関数のロジック
- **テスト手法**: runCmd をモック化し、失敗→成功のシーケンスを検証
- **テスト配置**: `specs/145-review-subprocess-retry/tests/` に配置（spec 固有の検証）

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-04
- Notes: auto mode

## Open Questions
- (none)
