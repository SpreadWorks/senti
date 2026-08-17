# Draft: 145-review-subprocess-retry

**Created**: 2026-04-04
**Status**: Approved
**Issue**: #94
**Development Type**: bugfix

**目的:** review サブプロセス（run-review.js）の runCmd 呼び出しにリトライ機構を追加し、AI サブプロセスの一時的なクラッシュ時に自動回復できるようにする。

## Q&A

- Q: リトライのスコープはどこか？
  - A: `src/flow/lib/run-review.js` の `RunReviewCommand.execute()` 内の `runCmd()` 呼び出し。1箇所のみ。

- Q: 既存のリトライパターンはあるか？
  - A: `src/lib/agent.js` の `callAgentAsyncWithRetry` が参考実装。retryCount + retryDelayMs（デフォルト3秒）のパターン。ただし agent.js は非同期（spawn）、run-review.js は同期（execFileSync via runCmd）という違いがある。

- Q: runCmd 自体にリトライを追加するか、run-review.js レベルで追加するか？
  - A: run-review.js レベルで追加する。runCmd は汎用ユーティリティであり、リトライはすべての呼び出しに必要ではない。呼び出し側で制御すべき。

- Q: リトライ回数とスリープ間隔は？
  - A: agent.js と同様にデフォルト retryCount=2（計3回試行）、retryDelayMs=3000（3秒）。config から設定可能にする必要はない（agent.js の既存パターンに合わせる）。

- Q: どの失敗条件でリトライするか？
  - A: `res.ok === false` の場合にリトライする。ただし `killed` や `signal` による終了（タイムアウト等）はリトライしない（agent.js と同じ判断）。

- Q: 既存テストへの影響は？
  - A: run-review.js の既存テストはない（review コマンドのテストは integration level）。新規テストを追加する。

## Decisions

- D1: runCmd のリトライラッパー関数を run-review.js 内に作成する（process.js は変更しない）
- D2: リトライは同期的に行う（setTimeout ではなく、Atomics.wait 等の同期スリープ、または単にブロッキングループ）
  - 訂正: runCmd は同期だが、execute() は async なので、await + setTimeout による非同期スリープが使える
- D3: retryCount=2, retryDelayMs=3000 をデフォルトとする

## Priority

1. **P1**: runCmd のリトライラッパー実装（コア機能）
2. **P2**: リトライ条件の判定（killed/signal の除外）
3. **P3**: テスト追加

## Impact

- `src/flow/lib/run-review.js` のみ変更
- 既存の動作は変更なし（retryCount=0 と同じ動作）
- CLI インターフェースの変更なし

- [x] User approved this draft (autoApprove)
- Approved at: 2026-04-04
