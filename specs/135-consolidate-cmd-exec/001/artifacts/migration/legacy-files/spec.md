# Feature Specification: 135-consolidate-cmd-exec

**Feature Branch**: `feature/135-consolidate-cmd-exec`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #80

## Goal
`execFileSync` の直接呼び出し（7ファイル・28箇所以上）を共通ヘルパーに統合し、git/gh 状態取得関数の重複を解消する。

## Scope
1. `src/lib/process.js` にコマンド実行ヘルパー `runCmd` / `runCmdAsync` を実装する
2. `src/lib/git-state.js` を `src/lib/git-helpers.js` にリネームし、重複関数を集約する
3. 全呼び出し元を新ヘルパーに移行する

## Out of Scope
- `runCmdStreaming`（agent.js の spawn 置き換え）: agent.js は stdio 制御が特殊であり、単純な置き換えはリスクが高い。別 spec で対応する
- `agent.js` の `execFileSync`（callAgent 内）: spawn と同様に stdio 制御が特殊であり、別 spec で対応する
- CLI コマンドの外部インターフェース変更
- 新機能の追加

## Clarifications (Q&A)
- Q: 既存の `runSync` はどうなるか？
  - A: `runCmd` に置き換えて `runSync` は削除する。`runCmd` は `execFileSync` ベースに変更する（現在の `runSync` は `spawnSync` ベース）。
- Q: `runCmdStreaming` を含めるか？
  - A: agent.js の spawn は `stdio: ["ignore", "pipe", "pipe"]` が必須で、CLAUDE.md にも明記された制約がある。汎用ヘルパーに押し込むと制約が見えにくくなるため、別 spec で対応する。
- Q: 共通化する関数としない関数の判断基準は？
  - A: 2箇所以上から呼ばれる git/gh コマンド → git-helpers.js に集約。1箇所のみのフロー固有コマンド（git merge --squash 等）→ 各ファイルから runCmd を直接呼ぶ。

## Design Rationale
- `runCmd` を `execFileSync` ベースにする理由: 現在の直接呼び出しが全て `execFileSync` であり、移行時の振る舞い変更を最小化するため。`spawnSync` ベースの `runSync` は1箇所のみ使用で、`execFileSync` に統一しても問題ない。
- エラーハンドリングを「常に return」にする理由: 28箇所以上の try/catch を全て不要にでき、コード量を大幅に削減できる。ENOENT（コマンド不在）も `{ ok: false }` で返すため、gh 未インストール環境でもクラッシュしない。
- git-state.js → git-helpers.js のリネーム理由: 現在 `commentOnIssue`（write 操作）が含まれており、「All functions are read-only」コメントと矛盾している。helpers の方が実態に合う。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-04
- Notes: Issue #80 の設計を基に、runCmdStreaming は別 spec に分離

## Requirements
1. `src/lib/process.js` に `runCmd(cmd, args, opts?)` を実装する。戻り値は `{ ok, status, stdout, stderr }`。コマンド失敗・ENOENT 時も throw せず `{ ok: false }` を返す。
2. `src/lib/process.js` に `runCmdAsync(cmd, args, opts?)` を実装する。戻り値は `Promise<{ ok, status, stdout, stderr }>`。reject しない。
3. `src/lib/git-state.js` を `src/lib/git-helpers.js` にリネームする。全 import を更新する（`specs/` 配下のテストファイル内の `git-state.js` import も更新対象に含める）。
4. `git-helpers.js` の `tryExec` を `runCmd` に置き換え、`tryExec` を削除する。
5. `get-check.js` の `checkDirty()` 内の `execFileSync` 直接呼び出しを `runCmd` に置き換える。（注: `checkGh()` は既に `isGhAvailable()` を呼んでおり独自実装はないため、import パス更新は Requirement 3 に包含される。）
6. `run-finalize.js` の `commitOrSkip` を `runCmd` ベースに書き換え、ローカル関数として残す（フロー固有のため集約しない）。
7. 全ファイルの `execFileSync` 直接呼び出しを `runCmd` に置き換える。対象: run-finalize.js (8箇所), merge.js (6箇所), flow-state.js (6箇所), run-sync.js (3箇所), run-gate.js (1箇所), cli.js (1箇所), run-report.js (2箇所), run-retro.js (2箇所), get-issue.js (1箇所), get-check.js (1箇所)。
8. `forge.js` の `runCommand`（execFile + Promise）を `runCmdAsync` に置き換える。
9. 全ファイルの `runSync` 呼び出しを `runCmd` に置き換える。対象: run-review.js, run-prepare-spec.js, run-impl-confirm.js, run-sync.js, review.js, lint.js, run-finalize.js（動的 import）。
10. 既存の `runSync` を削除する。
11. 全移行完了後、`npm test` を実行し全既存テストが通ること。

優先順位: 1 > 2 > 3 > 4-9 > 10 > 11

## Acceptance Criteria
- `src/lib/process.js` に `runCmd` と `runCmdAsync` が export されている
- `src/lib/git-state.js` が存在せず、`src/lib/git-helpers.js` が存在する
- `execFileSync` の直接呼び出しが `src/lib/process.js` 以外に存在しない（agent.js は対象外）
- `spawnSync` の直接呼び出しが `src/lib/process.js` 以外に存在しない（テストファイルは除外）
- `runSync` の import が全ファイルから除去されていること
- `tryExec` と `runSync` が削除されている
- `npm test` が全て通る

## Test Strategy
- `src/lib/process.js` の `runCmd` / `runCmdAsync` のユニットテスト: 正常終了、異常終了、ENOENT の3パターン
- `git-helpers.js` の関数が正しく動作するユニットテスト
- 既存の `tests/unit/lib/process.test.js` の `runSync` テストを `runCmd` テストに移行する（振る舞いが同等であることを検証）
- 既存の全テスト（npm test）がパスすることで後方互換を確認

## Open Questions
None
