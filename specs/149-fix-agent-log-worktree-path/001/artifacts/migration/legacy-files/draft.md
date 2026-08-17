# Draft: fix-agent-log-worktree-path

**開発種別:** バグ修正
**目的:** worktree モードで SDD フローを実行中に `callAgent` / `callAgentAsync` が書き込むログが、worktree の `.tmp/logs/` に保存されてしまい、worktree クリーンアップ後に失われる問題を修正する。

## 背景

spec 148 で実装した `resolveLogDir(cwd, cfg)` は、`cwd` をそのまま使ってログディレクトリを解決する。worktree モード中は `cwd` が worktree パスになるため、ログが `{worktree}/.tmp/logs/prompts.jsonl` に書かれる。worktree は finalize 時に削除されるため、このログは失われる。

## Q&A

**Q1: worktree 検出の方法は？**
A: `src/lib/cli.js` に既存の `isInsideWorktree(root)` / `getMainRepoPath(root)` を使う。

**Q2: resolveLogDir 内で自動解決するか、呼び出し側が渡すか？**
A: `resolveLogDir` 内で `isInsideWorktree(cwd)` を確認し、worktree なら `getMainRepoPath(cwd)` でメインリポジトリパスに差し替える。呼び出し元（`callAgent` 等）の変更は不要。

**Q3: getMainRepoPath が失敗した場合は？**
A: throw してプロセスを終了する（ログが書けない状態は致命的エラーとして扱う）。

## 変更対象

- `src/lib/agent-log.js` — `resolveLogDir` に worktree 検出ロジックを追加
  - `isInsideWorktree(cwd)` が true の場合、`getMainRepoPath(cwd)` でメインリポジトリパスを取得してログ先を差し替える
  - `cfg?.logs?.dir` が設定されている場合は変更なし（明示指定を優先）
  - `getMainRepoPath` が throw した場合はそのまま伝播させる

## スコープ外

- `callAgent` / `callAgentAsync` の引数変更
- `appendAgentLog` の try/catch 範囲の変更（`resolveLogDir` は try ブロック外のため、throw は自然に伝播する）
- ログローテーション・圧縮
- worktree 以外の動作変更

## テスト方針

- `resolveLogDir` の単体テスト:
  - 通常リポジトリ（非 worktree）では `cwd` ベースのパスを返す
  - worktree（`isInsideWorktree` が true）では main repo ベースのパスを返す
  - `cfg.logs.dir` が設定されている場合は常にそちらを返す
- spec 検証テストとして `specs/149-fix-agent-log-worktree-path/tests/` に配置

- [x] User approved this draft
