# Draft: Move docs generation from feature branch to main branch after merge

## Issue

GitHub Issue #32: docs生成タイミングの変更 - featureブランチからメインブランチ側へ移行

## 決定事項

### 1. ステップ順序の変更

現在: `commit → merge → cleanup → sync → record`
変更: `commit → merge → sync → cleanup → record`

syncをcleanupの前に移動する。cleanup後はworktreeが削除されcwdが無効になるため、sync(docs build)が実行できない問題を解決する。

### 2. sync の実行先

worktreeモードではmerge後のコードはメインリポジトリ（mainRepoPath）にある。
- worktreeモード: `{ cwd: mainRepoPath }` で docs build を実行
- branchモード: `{ cwd: root }` で docs build を実行（mergeでbaseBranchにcheckout済み）
- `resolveWorktreePaths()` を使ってパスを解決

### 3. PR ルート時の sync

PR ルートではまだマージされていないため sync は実行できない。
- `mergeStrategy === "pr"` の場合、sync を自動スキップ
- finalize の出力にリマインドメッセージを含める: 「PR マージ後に sdd-forge build または /sdd-forge.flow-sync を実行してください」

### 4. マージ方法の auto 判定

現在の 3 択（merge/squash/pr）を auto 判定に変更:
- `commands.gh = "enable"` かつ `gh` コマンド利用可 → PR ルート
- それ以外 → squash merge

「すべて実行」はauto判定のみ。「個別選択」時はマージステップで上書き可能。

### 5. 影響を受けるファイル

- `src/flow/run/finalize.js` — ステップ順序変更、sync の cwd 変更、auto 判定の導入
- `src/flow/get/prompt.js`（または該当箇所）— finalize.steps の番号変更、merge-strategy prompt の変更
- `src/templates/skills/sdd-forge.flow-finalize/SKILL.md` — スキルテンプレートの更新

## 承認

- [x] User approved this draft (2026-03-30)
