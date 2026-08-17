# Feature Specification: 124-fix-finalize-report-save

**Feature Branch**: `feature/124-fix-finalize-report-save`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #64 (follow-up bug fix)

## Goal
finalize パイプラインの retro/report ステップがメインリポジトリに成果物を保存するよう修正し、worktree cleanup が正常に動作するようにする。また、finalize SKILL.md に report text の表示指示を追加する。

## Root Cause
finalize の Step 1 (commit) で worktree 内の全ファイルをコミットした後、Step 3 (retro) が `retro.json` を worktree 内に書き込み、Step 6 (report) が `report.json` を worktree 内に書き込む。これにより Step 5 (cleanup) の `git worktree remove` が untracked files で失敗し、report.json も worktree 削除時に消える。

## Scope
- `src/flow/run/finalize.js`: retro と report の保存先をメインリポジトリの `specs/NNN/` に変更
- `src/flow/run/finalize.js`: report 保存後に retro.json + report.json を git add + commit する
- `src/templates/skills/sdd-forge.flow-finalize/SKILL.md`: report text の表示指示を追加

## Out of Scope
- retro.js 本体の変更（finalize.js 側で保存先を制御する）
- cleanup.js への `--force` 追加（根本原因を修正すれば不要）

## Clarifications (Q&A)
- Q: retro.json の保存先をどう変えるか？
  - A: finalize.js の retro ステップで retro サブプロセスの実行後、生成された retro.json を worktree から mainRepoPath にコピーする。または retro の実行 cwd をメインリポジトリにする。
- Q: report と retro のコミットタイミングは？
  - A: report ステップ（Step 6、cleanup の後）でまとめて `git add specs/NNN/retro.json specs/NNN/report.json && commit`。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: autoApprove mode

## Requirements

優先順位: P1（必須）> P2（重要）

R1 [P1]: finalize.js の retro ステップ（Step 3）で、worktree モードの場合は retro 実行後に生成された `retro.json` をメインリポジトリの `specs/NNN/` にコピーする。branch モードでは変更不要（同じリポジトリ内で保存される）。

R2 [P1]: finalize.js の report ステップ（Step 6）で、`saveReport()` の保存先をメインリポジトリの `specs/NNN/` にする。worktree モードでは `mainRepoPath` を使い、branch モードでは `root` を使う。

R3 [P2]: report ステップの最後に、メインリポジトリで `git add specs/NNN/retro.json specs/NNN/report.json && git commit -m "chore: add retro and report for <specTitle>"` を実行する。コミット対象ファイルが存在しない場合（retro 失敗等）はスキップする。

R4 [P1]: flow-finalize SKILL.md の post-finalize セクションに、`steps.report.text` が存在する場合はそのテキストをそのまま表示する指示を追加する。

## Acceptance Criteria

AC1: worktree モードで finalize --mode all を実行後、メインリポジトリの `specs/NNN/report.json` にファイルが存在する。

AC2: worktree モードで finalize --mode all を実行後、cleanup（git worktree remove）が untracked files なしで成功する。

AC3: finalize の JSON レスポンスの `steps.report.text` が SKILL.md の指示に従って画面に表示される。

AC4: retro が失敗した場合でも report.json のコミットは成功する（retro.json がない場合は report.json のみコミット）。

## Open Questions
(none)
