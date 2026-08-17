# Draft: subprocess-crash-details

**開発種別:** Enhancement（機能追加 + バグ修正）
**目的:** サブプロセスがクラッシュした際にシグナル名・終了コード・killed フラグをエラーメッセージに含め、根本原因を特定可能にする

## 背景

Issue #83 で spec review サブプロセスが OOM で kill されたが、エラーメッセージには stderr 出力のみが含まれ、クラッシュの根本原因（シグナル名、killed フラグ）が失われた。

また、`runCmdAsync` は `err.code` が文字列（`"ENOENT"`、`"ERR_CHILD_PROCESS_STDIO_MAXBUFFER"` 等）の場合に数値以外の `status` を返すバグがある。

## Q&A

**Q: `run-finalize.js` の `stdout` も見るケースは `formatError` のスコープか？**
A: Yes。`throw new Error(...)` を使う箇所は全て対象。"nothing to commit" 検出は throw の前処理であり独立している。`formatError` は throw 行のみに適用する。

**Q: `git-helpers.js:69` の `{ ok: false, error: res.stderr }` はメタデータ記録か？**
A: PR #97 の要件「ログ/メタデータにエラーメッセージを記録する箇所も対象」に該当するため、`formatError` を適用する。

## 決定事項（優先順位順）

**P1（コア拡張）:**
- `runCmd` / `runCmdAsync` の返り値に `signal: string|null`、`killed: boolean` を追加
- `runCmdAsync` の `status` は常に数値（文字列コード → 1 にフォールバック）
- `formatError(res)` を `src/lib/process.js` に export
  - フォーマット: `signal=SIGKILL (killed) | exit=137 | stderr内容` / `exit=1 | stderr内容`
  - stderr が空なら省略
  - コンテキスト文字列の付加は呼び出し元の責務

**P2（呼び出し元の更新）:**
- `ok === false` で `throw new Error(...)` / `process.stderr.write(...)` する全箇所に `formatError` を適用
- `runCmdWithRetry` のシグナル判定を正規表現から `res.signal || res.killed` に変更

## スコープ外

- `callAgentAsync`（spawn 使用、既にシグナル情報含む）
- `callAgent`（同期版）のエラーハンドリング改善
- issue-log のスキーマ変更

## 既存機能への影響

- `runCmd` / `runCmdAsync` の戻り値に新フィールドが追加される（後方互換あり、既存呼び出し元に破壊的変更なし）
- エラーメッセージの形式が変わる（人間が読む用途のみ、パースしている箇所は `runCmdWithRetry` の正規表現が唯一の例外だが本 spec で置き換える）

- [x] User approved this draft
