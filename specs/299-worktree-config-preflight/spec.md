# Feature Specification: 299-worktree-config-preflight

**Feature Branch**: `feature/299-worktree-config-preflight`
**Created**: 2026-06-15
**Status**: Draft
**Input**: GitHub Issue #389

## Goal
`senti flow prepare --worktree` が worktree 作成前に `.senti/config.json` の branch 反映状態を検査し、worktree 側に必要な config が欠落または stale になる状態を副作用前に止める。

## Background
When `.senti/config.json` is untracked, `flow prepare --worktree` can start by reading the main repository config but then create a worktree that lacks that file, causing the later worktree-side docs scan to fail. When the file is tracked but locally modified, the new worktree receives the committed stale content, so the flow continues with config different from the invoking repository. The current worktree path copies only local overlay and plugin runtime after `git worktree add`; it intentionally does not copy `.senti/config.json`.

## Scope
- `senti flow prepare --worktree` の worktree 作成前 preflight。
- 必須 branch-reflected file としての `.senti/config.json`。
- `.senti/config.json` が HEAD/base に存在しない状態の検出。
- `.senti/config.json` の staged / unstaged / untracked 状態の検出。
- preflight failure 時の halt envelope または prompt context。
- 既存 `.senti/config.local.json` overlay 同期と plugin runtime 同期の維持。
- spec-local regression tests と関連 prepare worktree tests。

## Out of Scope
- `.senti/config.json` の暗黙 commit。
- `.senti/config.json` の worktree への自動コピー。
- `.senti/config.json` 以外の必須ファイル追加。
- `--worktree` 以外の branch mode / no-branch mode prepare 挙動変更。
- npm publish / dist-tag 操作。

## Constraints
- 外部依存を追加しない。Git 状態検査は Node.js built-in modules と既存 `runGit` / process helper を使う。
- `src/` に project 固有情報を入れない。必須ファイル `.senti/config.json` は senti の汎用 flow prepare contract として扱う。
- preflight failure は prepare-state cleanup/deletion と `git worktree add` より前に返し、preparing run state、worktree directory、feature branch、spec files、flow state、docs scan の副作用を発生させない。
- `.senti/config.json` を local filesystem から worktree へ自動コピーしない。worktree state は branch history に含まれる content を基準にする。
- 確認なしの commit はしない。commit を伴う recovery はユーザーの明示選択または明示操作が必要。
- 既存 `.senti/config.local.json` overlay 同期と plugin runtime 同期は維持する。
- branch-reflected required file 検査は初期対象 1 件に限定する。将来の拡張に備える場合も処理対象数に明示的な上限を置く。
- 新しい spec behavior coverage は `specs/299-worktree-config-preflight/tests/` 配下に置き、各 spec-local test file に `// spec: R<N> ...` header を付ける。

## Design Principles
- prepare の source of truth は branch commit とする。local file injection ではなく、worktree に checkout される内容を事前に検証する。
- preflight と side effect を分ける。検査は worktree path 作成、branch 作成、spec artifact 作成より前に完了する。
- recovery は明示的にする。shared config の履歴追加や abort はユーザー判断が必要な action として返す。
- 既存 overlay behavior は retained public behavior として扱い、`.senti/config.local.json` は branch-reflected 検査対象に含めない。

## Overview
### Modules
- `src/flow/lib/run-prepare-spec.js`: `senti flow prepare` の worktree / branch / no-branch 分岐、spec files 作成、flow state 作成、docs scan を担当する。
- `src/lib/git-helpers.js`: Git 状態検査の既存 wrapper。新しい preflight は direct git spawn を増やさず既存 helper 経由に寄せる。
- `tests/e2e/flow/commands/post-worktree-hook.test.js`: `.senti/config.local.json` と plugin runtime の worktree 同期を既存 behavior として検証している。
- spec-local tests: HEAD/base 欠落、staged、unstaged、untracked、正常系、overlay 維持を temporary git project で検証する。

### Data Flow
- `flow prepare --worktree` は title / base / run-id を解決し、worktree mode が選ばれた場合だけ required branch-reflected files preflight を実行する。
- preflight は `.senti/config.json` について、base ref に存在するか、index / working tree / untracked state が base checkout と一致しないかを判定する。
- failure 時は halt envelope または prompt context に対象 file、状態、worktree に反映されない理由、recovery choices を含めて返す。
- preflight pass 後だけ `git worktree add`、`syncPluginRuntimeToWorktree()`、`PostWorktree` hook、spec files 作成、flow state 作成、docs scan を実行する。
- worktree 作成後の `.senti/config.local.json` overlay と plugin runtime copy は既存順序を維持する。

### Decisions
- [VERIFY] worktree prepare currently creates the worktree before overlay sync and docs scan.
- [VERIFY] `.senti/config.json` is not copied by the overlay sync helper.
- [VERIFY] existing tests cover `.senti/config.local.json` and plugin runtime preservation.
- Required file boundary: initial branch-reflected required files list contains only `.senti/config.json`.
- Recovery boundary: preflight returns user-action choices and does not perform an implicit commit.
- Migration inventory: retained behavior includes successful `--worktree` prepare when config is reflected, `.senti/config.local.json` overlay copy, plugin runtime copy, PostWorktree hook order after worktree creation, and non-worktree prepare paths.
- Migration mapping: the new owner of branch-reflected required file validation is a pre-worktree-add preflight inside prepare; all retained post-worktree behaviors stay with their existing helpers.
- Prepare-state preservation: required-file preflight failure must not delete the `--run-id` preparing flow record.

## Clarifications (Q&A)
- Q: Is `.senti/config.local.json` part of the required branch-reflected file check?
  - A: No. It remains a local overlay copied by existing worktree sync behavior and is not required to be present in branch history.
- Q: Should prepare automatically commit `.senti/config.json`?
  - A: No. The command may expose a commit-and-continue recovery choice or prompt context, but the commit side effect requires explicit user selection or user action.
- Q: Should prepare copy `.senti/config.json` into the new worktree to repair the mismatch?
  - A: No. Copying would make the worktree diverge from branch history and obscure whether the config change is part of the feature.
- Q: Are branch mode and no-branch mode in scope?
  - A: No. The stale/missing config failure is caused by `git worktree add` creating an isolated checkout from a branch commit.

## Alternatives Considered
- Auto-copy `.senti/config.json` into the worktree — Rejected because it would make the worktree state diverge from branch history and make the config change ambiguous.
- Automatically commit `.senti/config.json` before worktree creation — Rejected because `.senti/config.json` can contain shared scan, agent, plugin, and flow settings; adding history requires explicit user decision.
- Reuse only the existing dirty worktree check — Rejected because current dirty handling intentionally skips worktree mode, while this issue needs a targeted branch-reflected required-file check before `git worktree add`.
- Apply the same preflight to all prepare modes — Rejected because the observed failure is specific to worktree checkout from base/HEAD; expanding to other modes would change unrelated behavior.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-15T03:05:27.198Z
- Notes: autoApprove: approved gate-passed spec for issue #389

## Requirements
- R1 [must]: `senti flow prepare --worktree` runs a preflight for required branch-reflected files before prepare-state cleanup/deletion and before invoking `git worktree add`.
- R2 [must]: The preflight fails before side effects when `.senti/config.json` does not exist in the selected base/HEAD checkout that would be used for the new worktree.
- R3 [must]: The preflight fails before side effects when `.senti/config.json` has staged, unstaged, or untracked local state that would not be reflected in the new worktree checkout.
- R4 [must]: A preflight failure preserves any `--run-id` preparing state and returns a clear halt envelope or prompt context containing the required file path, detected status, reason it will not be reflected in the worktree, and recovery choices for commit-and-continue or abort.
- R5 [must]: When `.senti/config.json` is reflected in the selected base/HEAD checkout, `--worktree` prepare preserves existing successful behavior, including worktree creation, spec artifact creation, docs scan, `.senti/config.local.json` overlay sync, and plugin runtime sync.
- R6 [must]: The change does not modify branch mode or no-branch prepare behavior and does not auto-copy `.senti/config.json` into the worktree or auto-commit it.

## Acceptance Criteria
- R1: A spec-local test observes that a failing required-file preflight returns before prepare-state cleanup/deletion, before any worktree directory is created, and before the feature branch exists.
- R2: In a temporary git project where `.senti/config.json` is untracked and absent from HEAD/base, `senti flow prepare --worktree` returns the required-file halt before `git worktree add` side effects.
- R2: In a temporary git project where `.senti/config.json` is missing from the selected base ref even though command startup can read config from the invoking filesystem, the halt names `.senti/config.json` as missing from the branch-reflected source.
- R3: In separate temporary git projects, staged-only, unstaged-only, and untracked `.senti/config.json` states each halt before worktree creation and report the matching detected status.
- R4: The halt response contains `.senti/config.json`, a machine-readable status or issue code, a reason explaining that the new worktree would not contain the local content, and recovery choices equivalent to commit-and-continue and abort.
- R4: When `flow prepare --run-id <id> --worktree` halts on required-file preflight, the preparing flow record for `<id>` still exists and retains request, issue, notes, autoApprove, and autoCheck fields needed to retry after the user commits.
- R5: In a temporary git project where `.senti/config.json` is committed and clean, `senti flow prepare --worktree` succeeds and creates the worktree, branch, `spec.json`, `draft.json`, and valid worktree-side `.senti/output/analysis.json`.
- R5: Existing overlay behavior is preserved: a worktree prepare with `.senti/config.local.json` and plugin runtime still copies those overlay files into the worktree.
- R6: A branch mode or no-branch prepare regression test continues to pass without invoking the new required-file halt.
- R6: No implementation path copies `.senti/config.json` from the invoking working tree into the new worktree after `git worktree add`, and no path creates a commit without an explicit user action.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add required-file preflight
  - Introduce a bounded preflight that determines whether `.senti/config.json` will be present and clean in the selected worktree source checkout before worktree creation.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Return prepare halt context
  - Wire preflight failures into `flow prepare --worktree` so the command stops before side effects and returns clear recovery context.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Preserve worktree success path
  - Keep existing successful worktree prepare behavior unchanged when `.senti/config.json` is branch-reflected and clean.
  - see `tasks/T-3.md` for full spec
