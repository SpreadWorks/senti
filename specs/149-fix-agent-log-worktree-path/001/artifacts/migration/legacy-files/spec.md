# Feature Specification: 149-fix-agent-log-worktree-path

**Feature Branch**: `feature/149-fix-agent-log-worktree-path`
**Created**: 2026-04-06
**Status**: Draft
**Input**: User request

## Goal

worktree モードで SDD フローを実行中に `callAgent` / `callAgentAsync` が書き込むエージェントログが、worktree の `.tmp/logs/` に保存されてしまい、worktree クリーンアップ後に消失する問題を修正する。ログは常にメインリポジトリ側に書き込まれるようにする。

## Scope

- `src/lib/agent-log.js` の `resolveLogDir` 関数のみ修正する
- worktree 検出に `src/lib/cli.js` の既存関数 `isInsideWorktree` / `getMainRepoPath` を使用する

## Out of Scope

- `callAgent` / `callAgentAsync` の引数変更
- `appendAgentLog` の try/catch 範囲の変更
- ログローテーション・圧縮
- worktree 以外のパス解決ロジックの変更

## Clarifications (Q&A)

- Q: worktree 検出にどの関数を使うか？
  - A: `src/lib/cli.js` の `isInsideWorktree(root)` と `getMainRepoPath(root)` を使用する。これらは既に `flow-state.js` でも使われている実績ある関数。

- Q: `resolveLogDir` 内で検出するか、呼び出し側が渡すか？
  - A: `resolveLogDir` 内で検出する。`callAgent` の引数変更を避け、影響範囲を最小化するため。

- Q: `getMainRepoPath` が失敗した場合の挙動は？
  - A: throw してプロセスを終了する。ログ書き込み先の決定に失敗した場合は致命的エラーとして扱う。

## Alternatives Considered

- **呼び出し側から main repo パスを渡す案**: `callAgent` の引数を変更する必要があり、影響範囲が広いため不採用。
- **エラー時にフォールバックする案**: worktree パスにサイレントで書き続けるとデータ消失が気づかれないため不採用。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-06
- Notes:

## Requirements

**P1 (必須)**

- req0: `resolveLogDir(cwd, cfg)` は `cfg.logs.dir` が設定されている場合、worktree 検出を行わずそのまま返す
- req1: `resolveLogDir(cwd, cfg)` は `cwd` が worktree パス（`isInsideWorktree(cwd)` が true）の場合、`getMainRepoPath(cwd)` で取得したメインリポジトリパスをベースにログディレクトリを解決する
- req2: `resolveLogDir(cwd, cfg)` は `cwd` が通常リポジトリ（`isInsideWorktree(cwd)` が false）の場合、従来通り `cwd` ベースでログディレクトリを解決する
- req3: `getMainRepoPath(cwd)` が throw した場合、`resolveLogDir` はそのエラーをキャッチせず伝播させる

## Acceptance Criteria

- worktree 内から `callAgent` を呼び出した場合、`prompts.jsonl` がメインリポジトリの `{workDir}/logs/` に書き込まれる
- 通常リポジトリ（非 worktree）での動作は変わらない
- `cfg.logs.dir` が明示指定されている場合は worktree 検出を行わず、指定パスに書き込まれる
- `getMainRepoPath` が失敗した場合はプロセスが throw で終了する

## Test Plan

`specs/149-fix-agent-log-worktree-path/tests/` に spec 検証テストを配置する（`node:test` を使用）。

- `resolveLogDir` の単体テスト:
  - 通常リポジトリ（非 worktree）では `cwd` ベースのパスを返すこと（req2）
  - worktree パスを渡した場合、メインリポジトリベースのパスを返すこと（req1）
  - `cfg.logs.dir` が設定されている場合は worktree 検出なしでそのまま返すこと（req0）
  - `getMainRepoPath` が失敗した場合はエラーが伝播すること（req3）
- worktree ディレクトリを実際に作成してテストする（git worktree add / remove を使用）

## Open Questions

なし
