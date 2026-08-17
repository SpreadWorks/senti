# Feature Specification: 154-subprocess-crash-details

**Feature Branch**: `feature/154-subprocess-crash-details`
**Created**: 2026-04-07
**Status**: Draft
**Input**: Issue #95

## Goal

サブプロセスがクラッシュした際に、シグナル名・終了コード・killed フラグをエラーメッセージに含め、障害の根本原因を特定可能にする。

Issue #83 では OOM kill されたサブプロセスの stderr 出力のみがエラーメッセージに残り、クラッシュ原因の特定ができなかった。本 spec ではこの問題を review に限らず全サブプロセス呼び出しで解決する。

## Scope

1. `runCmd`（`src/lib/process.js`）の返り値に `signal`・`killed` フィールドを追加
2. `runCmdAsync`（`src/lib/process.js`）の返り値に `signal`・`killed` フィールドを追加し、`status` の数値正規化も実施
3. `formatError(res)` ヘルパー関数を `src/lib/process.js` に export
4. `runCmd` / `runCmdAsync` の `ok === false` 時にエラーメッセージを生成する全箇所で `formatError` を使用
5. `runCmdWithRetry`（`src/flow/lib/run-review.js`）のシグナル判定を `res.signal || res.killed` に置き換え

## Out of Scope

- `callAgentAsync`（`src/lib/agent.js`）の変更（spawn + close イベントで既にシグナル情報をエラーに含めている）
- `callAgent`（同期版）のエラーハンドリング改善
- issue-log のスキーマ変更

## Clarifications (Q&A)

- Q: `run-finalize.js` の `throw new Error(output || "commit failed")` は `formatError` の適用対象か？`stdout` も参照している
  - A: 対象。"nothing to commit" 検出は throw の前処理であり独立。`formatError` は throw 行のみに適用する
- Q: `git-helpers.js:69` の `{ ok: false, error: res.stderr }` はメタデータ記録か？
  - A: PR #97 の要件「ログ/メタデータにエラーメッセージを記録する箇所も対象」に該当するため `formatError` を適用する

## Alternatives Considered

- **エラーメッセージに stdout も常に含める**: git はエラー詳細を stdout に出力することもあるが、formatError の責務を広げると呼び出し元との境界が曖昧になる。stdout はコンテキスト依存で呼び出し元が判断する（採用しない）
- **callAgentAsync も対象にする**: 既に spawn + close イベントで signal を取得しエラーに含めているため対応不要（スコープ外）

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-07
- Notes: PR #97 の実装内容を参考に進める

## Requirements

**P1: `runCmd` の拡張**
1. `runCmd` の成功時返り値に `signal: null`、`killed: false` を追加する
2. `runCmd` の失敗時（catch ブロック）に `signal: e.signal ?? null`、`killed: e.killed ?? false` を返り値に追加する

**P1: `runCmdAsync` の拡張**
3. `runCmdAsync` の成功時返り値に `signal: null`、`killed: false` を追加する
4. `runCmdAsync` の失敗時に `signal: err.signal ?? null`、`killed: err.killed ?? false` を返り値に追加する
5. `runCmdAsync` の `status` フィールドを常に数値にする: `err.code` が文字列（`"ENOENT"`、`"ERR_CHILD_PROCESS_STDIO_MAXBUFFER"` 等）または `null`（`err.killed === true` 時の Node.js 仕様）の場合は `1` にフォールバックする

**P1: `formatError` の追加**
6. `formatError(res)` 関数を `src/lib/process.js` に export する
7. `res.signal` がある場合のフォーマット: `signal=<name>[ (killed)] | exit=<status>[ | <stderr>]`（`killed` は `res.killed === true` の場合のみ付加）
8. `res.signal` がない場合のフォーマット: `exit=<status>[ | <stderr>]`
9. `res.stderr` が空文字列の場合はその部分を省略する
10. コンテキスト文字列の付加は呼び出し元の責務。推奨パターン: `throw new Error("context: " + formatError(res))`

**P2: 呼び出し元の更新**
11. 以下の箇所で `res.stderr`（または `res.stderr || fallback`）から `formatError(res)` に置き換える:
    - `src/lib/lint.js`: `throw new Error(\`git diff failed: ${res.stderr.trim()}\`)`
    - `src/lib/cli.js`: `throw new Error(res.stderr || "failed to resolve git-common-dir")`
    - `src/lib/git-helpers.js`: `{ ok: false, error: res.stderr }` → `{ ok: false, error: formatError(res) }`
    - `src/flow/lib/get-issue.js`: `throw new Error(res.stderr || "failed to fetch issue")`
    - `src/flow/lib/run-finalize.js`: `throw new Error(output || "commit failed")`（"nothing to commit" 検出ロジックは変更しない）
    - `src/flow/lib/run-finalize.js`: `throw new Error((buildRes.stderr || buildRes.stdout || "").trim())`
    - `src/flow/lib/run-sync.js`: `throw new Error(commitRes.stderr || commitRes.stdout)`
    - `src/flow/lib/run-prepare-spec.js`: `throw new Error(\`git ... failed: ${(res.stderr || "").trim()}\`)`
    - `src/flow/lib/run-gate.js`: `throw new Error(\`failed to get git diff: ${diffRes.stderr}\`)`
    - `src/flow/commands/merge.js`: 複数箇所の `throw new Error(res.stderr || "fallback")`
12. 移行後は `|| "fallback message"` のフォールバックを削除する（`formatError` が常に `exit=N` を含むため）

**P2: `runCmdWithRetry` の改善**
13. `run-review.js:115` の `/killed|signal/i.test(stderr)` を `lastRes.signal || lastRes.killed` に置き換える
14. `runCmdWithRetry` の JSDoc / 返り値型定義を `signal: string|null`、`killed: boolean` を含む形に更新する

## Acceptance Criteria

1. `runCmd` がシグナルで kill されたプロセスを実行した場合、返り値の `signal` フィールドにシグナル名が含まれる
2. `runCmdAsync` が OOM kill されたプロセスを実行した場合、返り値の `killed` フィールドが `true` になる
3. `runCmdAsync` が `ENOENT` エラーで失敗した場合、`status` フィールドが数値 `1` になる
4. `formatError({ signal: "SIGKILL", killed: true, status: 137, stderr: "Killed" })` が `"signal=SIGKILL (killed) | exit=137 | Killed"` を返す
5. `formatError({ signal: null, killed: false, status: 1, stderr: "" })` が `"exit=1"` を返す（stderr 空のため省略）
6. `runCmdWithRetry` がシグナル終了したプロセスに対してリトライしない（`res.signal || res.killed` が truthy）

## Test Strategy

- `src/lib/process.js` の `runCmd`・`runCmdAsync`・`formatError` を `tests/unit/lib/process.test.js` に formal test として追加する
  - `runCmd` 失敗時の `signal` / `killed` フィールド存在確認
  - `runCmdAsync` の `status` 数値正規化（文字列コード、null コード）
  - `formatError` の各フォーマットパターン（signal あり/なし、killed あり/なし、stderr あり/なし）
- `runCmdWithRetry` のシグナル判定は `specs/154-subprocess-crash-details/tests/` に spec 検証テストを置く

## Open Questions

なし

