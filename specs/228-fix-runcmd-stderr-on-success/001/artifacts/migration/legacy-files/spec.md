# Feature Specification: 228-fix-runcmd-stderr-on-success

**Feature Branch**: `feature/228-fix-runcmd-stderr-on-success`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #249

## Goal
`runCmd`（同期コマンド実行関数）が成功時に stderr を破棄するバグを修正し、呼び出し側が成功時も stderr を取得できるようにする。

## Background
`src/lib/process.js` の `runCmd` は `execFileSync` を使用している。`execFileSync` は成功時に stdout のみ返却し、stderr を取得する手段がない。そのため成功時は `stderr: ""` が返り、`run-review.js` 等が stderr から正規表現で抽出するカウンタが常に 0 になる。失敗時は `catch` 節で `e.stderr` を取得できるため問題ない。

## Scope
- `src/lib/process.js` の `runCmd` 関数の内部実装を `spawnSync` に置き換える
- `tests/unit/lib/process.test.js` に成功時 stderr 取得のテストケースを追加

## Out of Scope
- `runCmdAsync` の変更（既に `execFile` コールバック経由で成功時 stderr を正しく返却している）
- `run-review.js` 等の呼び出し側の変更（`runCmd` の契約修正で自動的に解消する）
- `review.js` の出力仕様変更（stderr → stdout JSON 化等）

## Constraints
- 外部依存追加禁止: `spawnSync` は `child_process` 組み込みモジュール
- `runCmd` の戻り値契約（フィールド名・型）を変更しない

## Design Principles
- 最小変更: `runCmd` 内部の子プロセス起動 API を差し替えるだけで、インターフェースは維持する
- 対称性: `runCmdAsync` は既に成功時 stderr を返す。`runCmd` もこれと対称な挙動にする

## Overview
### Modules
- `src/lib/process.js` — `runCmd` の内部実装変更

### Data Flow
変更なし。`runCmd` の戻り値 `{ ok, status, stdout, stderr, signal, killed }` の契約は維持される。唯一の違いは成功時の `stderr` フィールドが実際の stderr 出力を含むようになること。

### Decisions
- `execFileSync` → `spawnSync` を採用: `spawnSync` は stdout / stderr を個別プロパティで返すため、成功時も stderr を取得可能。Issue #249 で提案された方針に従う。

## Clarifications (Q&A)
- Q: 呼び出し側の変更は不要か？
  - A: 不要。呼び出し側は既に `res.stderr` を参照するコードが書かれている。`runCmd` が正しく stderr を返せば連鎖的に解消する。

## Alternatives Considered
- `execFileSync` を維持し stderr-only パイプを別途張る: `execFileSync` の仕様上、成功時の stderr 取得は不可能。追加パイプでも解決できない。
- 呼び出し側を stderr 依存から stdout JSON 依存に変更: 影響範囲が大きく、`review.js` の出力仕様変更を伴う。本件のスコープ外。

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1: `runCmd` がコマンド成功（exit 0）で完了した場合、戻り値の `stderr` フィールドにサブプロセスの stderr 出力が格納されていること。
- R2: コマンドが成功した場合も失敗した場合も、戻り値は ok, status, stdout, stderr, signal, killed の6フィールドを持ち、各フィールドの型（boolean, number, string, string, string|null, boolean）は変わらないこと。
- R3: コマンド失敗時（非ゼロ終了・タイムアウト・シグナル受信）は、既存テストが全て PASS すること。

## Acceptance Criteria
- AC1: `runCmd("node", ["-e", "console.error('ERR')"])` の戻り値で `ok === true` かつ `stderr` が `"ERR"` を含む。
- AC2: 既存の `tests/unit/lib/process.test.js` が全て PASS する。
- AC3: `npm test` が全て PASS する。

## Implementation Targets
- `src/lib/process.js`
- `tests/unit/lib/process.test.js`

## Test Strategy
- 既存テスト `tests/unit/lib/process.test.js` に「成功時に stderr を返す」テストケースを追加。
- 既存テスト全体の回帰確認（`npm test`）。

## Open Questions
- なし
